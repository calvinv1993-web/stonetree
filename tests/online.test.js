'use strict';
// Online test: starts the game server, connects players over WebSocket (like
// browsers would) and checks they share one world.
//   node tests/online.test.js

const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 18000 + Math.floor(Math.random() * 1000);
const SAVES = path.join(__dirname, '..', 'server', 'players.json');
const WORLD = path.join(__dirname, '..', 'server', 'world.json');
const GUILDS = path.join(__dirname, '..', 'server', 'guilds.json');
const TOWN = path.join(__dirname, '..', 'server', 'town.json');
const OWNERS = path.join(__dirname, '..', 'server', 'accounts.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const waitFor = async (ready, ms = 5000) => {
  for (let t = 0; t < ms && !ready(); t += 100) await sleep(100);
};

function client(name, login = { password: 'secret' }) {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  const c = { state: null, you: {}, welcome: null, error: null, kicked: false, log: [], act: (a, ...args) => ws.send(JSON.stringify({ t: 'act', a, args })) };
  ws.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.t === 'welcome') c.welcome = msg;
    if (msg.t === 'error') c.error = msg.message;
    if (msg.t === 'kicked') c.kicked = true;
    if (msg.t === 'state') {
      c.state = msg;
      Object.assign(c.you, msg.you); // (what's sent only now and then stays, as in a browser)
      for (const line of msg.out) c.log.push(line.slice(1).join(' '));
    }
  };
  ws.onopen = () => ws.send(JSON.stringify({ t: 'login', name, ...login }));
  c.close = () => ws.close();
  return c;
}

// an account's page: logs in (or makes the account), then sends what it's asked (play, newchar); keeps every answer
function accountPage(login) {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  const c = { got: [], send: m => ws.send(JSON.stringify(m)), last: t => [...c.got].reverse().find(m => m.t === t), close: () => ws.close() };
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t !== 'state') c.got.push(m); };
  ws.onopen = () => c.send({ t: 'login', ...login });
  return c;
}

function startServer(...args) {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js'), String(PORT), ...args], { stdio: ['ignore', 'pipe', 'inherit', 'ipc'] });
  server.ready = new Promise((resolve, reject) => {
    server.stdout.on('data', d => String(d).includes('running') && resolve());
    server.on('exit', code => reject(new Error(`server exited with ${code}`)));
  });
  return server;
}

(async () => {
  const backup = file => fs.existsSync(file) && fs.readFileSync(file, 'utf8');
  const hadSaves = backup(SAVES), hadWorld = backup(WORLD), hadGuilds = backup(GUILDS), hadTown = backup(TOWN), hadOwners = backup(OWNERS);
  const SAVE_FILES = [SAVES, WORLD, GUILDS, TOWN, OWNERS], BAKS = SAVE_FILES.map(f => `${f}.bak`), hadBaks = BAKS.map(backup);
  let server = startServer();
  let failed = false;
  try {
    await server.ready;
    const tag = Date.now().toString(36).slice(-5);
    const alice = client(`Alice${tag}`), bob = client(`Bob${tag}`);
    await sleep(1500);
    assert(alice.welcome && bob.welcome, 'both logged in');
    assert(alice.state.players.some(p => p.name === `Bob${tag}`), 'Alice sees Bob');

    // Bob takes a step, whichever way is free (furniture may stand next to where he wakes).
    const bobAt = `${bob.state.you.x},${bob.state.you.y}`;
    let seen = null;
    for (const key of ['s', 'w', 'e', 'n']) {
      bob.act('keyDown', key, false);
      bob.act('keyUp', key);
      await sleep(800);
      seen = alice.state.players.find(p => p.name === `Bob${tag}`);
      if (seen && `${seen.x},${seen.y}` !== bobAt) break;
    }
    assert(seen && `${seen.x},${seen.y}` !== bobAt, 'Alice sees Bob walk');

    bob.act('say', 'hello there');
    await sleep(300);
    assert(alice.log.some(l => l.includes('hello there')), 'Alice hears Bob');
    alice.act('say', 'hi');
    await sleep(300);
    assert(alice.log.some(l => l.includes('Sister Ama')), 'Sister Ama answers Alice');
    assert(!bob.log.some(l => l.includes(`Welcome, Alice${tag}`)), 'but not to Bob');

    const intruder = client(`Alice${tag}`, { password: 'wrong' });
    await sleep(500);
    assert(intruder.error && !alice.kicked, 'a wrong password is refused');
    const aliceAt = alice.state.you;
    const reloaded = client(`Alice${tag}`, { token: alice.welcome.token });
    await sleep(800);
    assert(reloaded.welcome && alice.kicked, 'logging in again (a reloaded page) takes over the session');
    assert(reloaded.state.you.x === aliceAt.x && reloaded.state.you.y === aliceAt.y, 'in the same place');

    bob.close();
    await sleep(300);
    const bobBack = client(`Bob${tag}`, { token: bob.welcome.token });
    await sleep(800);
    assert(bobBack.welcome && bobBack.state.you.y === seen.y, 'a page reloaded right away gets its character back where it was');
    assert(!reloaded.log.some(l => l.includes(`Bob${tag} has logged out`)), 'without logging out');
    console.log('  ok   players share one world, chat, keep their characters, and survive reloads');

    // An update restarts the server: characters and the world come back, and the token still works.
    const before = bobBack.state.you;
    server.send('stop'); // as server/dev.js does (on Windows a kill can't be caught)
    await new Promise(r => server.on('exit', r));
    // (a character saved by an older server, its password still an unsalted SHA-256)
    const saved = JSON.parse(fs.readFileSync(SAVES, 'utf8')), old = `old${tag}`;
    saved[old] = { password: require('crypto').createHash('sha256').update(`${old}:pw`).digest('hex'), save: null };
    // (and Bob has bought a moss-green cloak from Captain Osric meanwhile, and wears it)
    Object.assign(saved[`bob${tag}`].save, { cosmetics: ['moss_cloak'] });
    saved[`bob${tag}`].save.outfit = { ...saved[`bob${tag}`].save.outfit, cloak: 'moss_cloak' };
    fs.writeFileSync(SAVES, JSON.stringify(saved));
    server = startServer();
    await server.ready;
    const afterRestart = client(`Bob${tag}`, { token: bob.welcome.token });
    await waitFor(() => afterRestart.state || afterRestart.error);
    assert(afterRestart.welcome, `the token still works after a restart (${afterRestart.error || 'no answer'})`);
    assert(afterRestart.state.you.x === before.x && afterRestart.state.you.y === before.y, 'and Bob is where he was');
    assert(fs.existsSync(WORLD), 'the world was saved');
    console.log('  ok   a restarted server (an update) keeps characters, logins and the world');

    // Passwords are kept salted (scrypt); an old one still logs in, and is made safe then.
    const oldOne = client(`Old${tag}`, { password: 'pw' });
    await waitFor(() => oldOne.welcome || oldOne.error);
    assert(oldOne.welcome, `an old password still logs in (${oldOne.error || 'no answer'})`);
    // Cosmetics: Bob's page knows what he owns, and others see him wear it; one he doesn't own can't be put on
    await sleep(300);
    assert(JSON.stringify(afterRestart.you.cosmetics) === JSON.stringify(['moss_cloak']) && afterRestart.you.bestiary, 'his cosmetics and bestiary reach his page');
    const bobSeen = () => oldOne.state.players.find(p => p.name === `Bob${tag}`);
    assert(bobSeen() && bobSeen().outfit.cloak === 'moss_cloak', 'others see his cloak');
    afterRestart.act('setOutfit', { cloak: 'ember_cloak', feather: 'gull_feather' });
    await sleep(300);
    assert(!bobSeen().outfit.cloak && !bobSeen().outfit.feather, 'what he does not own is not worn');
    // A page sends junk: hotkeys keep only what's real; a flood of chat is cut down; the server carries on.
    afterRestart.act('setHotkeys', { F1: { type: 'spell', id: 'light' }, F2: { type: 'spell', id: 'constructor' }, F13: { type: 'say', text: 'x' }, F3: 'gold' });
    for (let i = 0; i < 300; i++) afterRestart.act('say', `spam ${i}`);
    await sleep(1600);
    const heard = oldOne.log.filter(l => l.includes('spam')).length;
    assert(heard > 0 && heard <= 12, `a flood of chat is cut down (${heard} of 300 lines got through)`);
    assert(JSON.stringify(afterRestart.you.hotkeys) === JSON.stringify({ F1: { type: 'spell', id: 'light' } }), `hotkeys keep only what's real (${JSON.stringify(afterRestart.you.hotkeys)})`);
    // The gate's two ways in: an account can't be made over a name that's taken, nor with a short password; logging in
    // needs an account; a new one is made and in
    const taken = client(`Bob${tag}`, { password: 'whatever1', create: true }); await waitFor(() => taken.welcome || taken.error); taken.close();
    assert(taken.error && /taken/.test(taken.error), `a name that's taken can't be made again (${taken.error || 'it let it in'})`);
    const short = client(`Carol${tag}`, { password: 'abc', create: true }); await waitFor(() => short.welcome || short.error); short.close();
    assert(short.error && /6 characters/.test(short.error), `a short password is refused (${short.error || 'it let it in'})`);
    const nobody = client(`Nobody${tag}`, { password: 'whatever1', create: false }); await waitFor(() => nobody.welcome || nobody.error); nobody.close();
    assert(nobody.error && /No character/.test(nobody.error), `logging in needs an account (${nobody.error || 'it let it in'})`);
    const carol = client(`Carol${tag}`, { password: 'secret12', create: true }); await waitFor(() => carol.welcome || carol.error);
    assert(carol.welcome && carol.welcome.isNew, `a new account is made and in (${carol.error || 'no answer'})`);
    carol.close();
    console.log('  ok   create account and log in: names taken, short passwords and unknown names refused');
    // An account holds characters: made with no character, it lists none; a new one goes into the story, and is listed
    // next time; a name taken (by a character or an account) is refused there, and the page stays logged in
    const acc = accountPage({ account: `Dana${tag}`, password: 'secret12', create: true });
    await waitFor(() => acc.last('account') || acc.last('error'));
    assert(acc.last('account') && acc.last('account').characters.length === 0, `a new account has no characters yet (${JSON.stringify(acc.got)})`);
    acc.send({ t: 'newchar', name: `Bob${tag}` }); await waitFor(() => acc.last('error'));
    assert(acc.last('error').keep && /taken/.test(acc.last('error').message), 'a character name that is taken is refused, the account kept');
    acc.send({ t: 'newchar', name: `Dana${tag}` }); await waitFor(() => acc.last('welcome') || acc.got.filter(m => m.t === 'error').length > 1);
    assert(acc.last('welcome') && acc.last('welcome').isNew, `a new character goes into the story (${JSON.stringify(acc.got.slice(-1))})`);
    acc.send({ t: 'act', a: 'say', args: ['hello from Dana'] }); await sleep(300);
    acc.close(); await sleep(300);
    const acc2 = accountPage({ account: `dana${tag}`, password: 'secret12', create: false });
    await waitFor(() => acc2.last('account') || acc2.last('error'));
    assert(acc2.last('account') && acc2.last('account').characters.map(c => c.name).join() === `Dana${tag}`, `logging in again lists the character (${JSON.stringify(acc2.got)})`);
    acc2.send({ t: 'newchar', name: `Eve${tag}` }); await waitFor(() => acc2.last('welcome'));
    acc2.close(); await sleep(300);
    const acc3 = accountPage({ account: `Dana${tag}`, token: acc2.last('account').token });
    await waitFor(() => acc3.last('account') || acc3.last('error'));
    assert(acc3.last('account') && acc3.last('account').characters.length === 2, `by its token, the account lists both characters (${JSON.stringify(acc3.got)})`);
    acc3.send({ t: 'play', name: `Bob${tag}` }); await waitFor(() => acc3.last('error'));
    assert(acc3.last('error').keep && !acc3.last('welcome'), 'another account\'s character can\'t be played');
    acc3.send({ t: 'play', name: `Dana${tag}` }); await waitFor(() => acc3.last('welcome'));
    assert(acc3.last('welcome').isNew === false && acc3.last('welcome').name === `Dana${tag}`, 'and one of its own is played, not new');
    // one character of an account at a time: another page of it can't play its other character, nor make a new one
    const acc4 = accountPage({ account: `Dana${tag}`, token: acc2.last('account').token });
    await waitFor(() => acc4.last('account'));
    acc4.send({ t: 'play', name: `Eve${tag}` }); await waitFor(() => acc4.last('error') || acc4.last('welcome'));
    assert(acc4.last('error') && acc4.last('error').keep && /one character of an account at a time/.test(acc4.last('error').message) && !acc4.last('welcome'),
      `a second character of the account is kept out while the first plays (${JSON.stringify(acc4.got.slice(-1))})`);
    acc4.send({ t: 'newchar', name: `Fay${tag}` }); await waitFor(() => acc4.got.filter(m => m.t === 'error').length > 1 || acc4.last('welcome'));
    assert(!acc4.last('welcome'), 'nor is a new one made then');
    acc3.close(); await sleep(400);
    acc4.send({ t: 'play', name: `Eve${tag}` }); await waitFor(() => acc4.last('welcome'));
    assert(acc4.last('welcome') && acc4.last('welcome').name === `Eve${tag}`, 'once the first page has gone, the other character plays');
    acc4.close(); await sleep(300);
    // one character from a browser at a time, whatever the account: another account's character from the same browser waits
    const dev = 'device-test-' + tag;
    const g1 = accountPage({ account: `Gil${tag}`, password: 'secret12', create: true }); await waitFor(() => g1.last('account'));
    g1.send({ t: 'newchar', name: `Gil${tag}`, device: dev }); await waitFor(() => g1.last('welcome'));
    const h1 = accountPage({ account: `Hal${tag}`, password: 'secret12', create: true }); await waitFor(() => h1.last('account'));
    h1.send({ t: 'newchar', name: `Hal${tag}`, device: dev }); await waitFor(() => h1.last('error') || h1.last('welcome'));
    assert(h1.last('error') && h1.last('error').keep && /from this browser already/.test(h1.last('error').message) && !h1.last('welcome'),
      `another account's character from the same browser waits (${JSON.stringify(h1.got.slice(-1))})`);
    h1.send({ t: 'newchar', name: `Hal${tag}`, device: 'another-browser-' + tag }); await waitFor(() => h1.last('welcome'));
    assert(h1.last('welcome'), 'from another browser it plays');
    g1.close(); h1.close(); await sleep(300);
    const wrongAcc = accountPage({ account: `Dana${tag}`, password: 'nope1234', create: false }); await waitFor(() => wrongAcc.last('error') || wrongAcc.last('account'));
    assert(wrongAcc.last('error') && !wrongAcc.last('account'), 'a wrong password lists nothing'); wrongAcc.close();
    const oldAcc = accountPage({ account: `Old${tag}`, password: 'pw', create: false }); await waitFor(() => oldAcc.last('error') || oldAcc.last('account'));
    assert(oldAcc.last('account') && oldAcc.last('account').characters.map(c => c.name.toLowerCase()).join() === `old${tag}`, `a character from before accounts is its own account (${JSON.stringify(oldAcc.got)})`);
    oldAcc.close();
    console.log('  ok   accounts hold characters: listed, made, played, one at a time; names taken and other accounts\' characters refused');
    // Wrong passwords: after a few, that address waits a minute (even the right one is refused meanwhile)
    for (let i = 0; i < 9; i++) { const w = client(`Bob${tag}`, { password: `wrong${i}` }); await waitFor(() => w.error); w.close(); }
    const right = client(`Old${tag}`, { password: 'pw' });
    await waitFor(() => right.welcome || right.error);
    assert(right.error && /too many/i.test(right.error), `too many wrong passwords make it wait (${right.error || 'it let it in'})`);
    server.send('stop');
    await new Promise(r => server.on('exit', r));
    const accounts = JSON.parse(fs.readFileSync(SAVES, 'utf8'));
    assert(accounts[`alice${tag}`].password.startsWith('scrypt$') && accounts[old].password.startsWith('scrypt$'), 'passwords are saved salted, the old one turned');
    assert(fs.existsSync(`${SAVES}.bak`), 'the save before it is kept as players.json.bak');
    console.log('  ok   salted passwords, old ones turned; junk, floods and password guessing held off');

    // At most 4 characters in the world from one internet address (counted here with --ip-limit-local: this computer
    // isn't, otherwise)
    server = startServer('--ip-limit-local');
    await server.ready;
    const many = [];
    for (let i = 0; i < 5; i++) {
      const pg = accountPage({ account: `Ipa${i}${tag}`, password: 'secret12', create: true });
      await waitFor(() => pg.last('account') || pg.last('error'));
      pg.send({ t: 'newchar', name: `Ipa${i}${tag}`, device: `ip-test-${i}-${tag}` });
      await waitFor(() => pg.last('welcome') || pg.last('error') && pg.got.filter(m => m.t === 'error').length);
      many.push(pg);
    }
    assert(many.slice(0, 4).every(pg => pg.last('welcome')), 'four characters from one address play');
    assert(!many[4].last('welcome') && many[4].last('error') && /4 characters are in the world from your internet connection/.test(many[4].last('error').message),
      `the fifth is kept out (${JSON.stringify(many[4].got.slice(-1))})`);
    many[0].close(); await sleep(400);
    many[4].send({ t: 'newchar', name: `Ipa4${tag}`, device: `ip-test-4-${tag}` }); await waitFor(() => many[4].last('welcome'));
    assert(many[4].last('welcome'), 'once one has gone, it plays');
    for (const pg of many) pg.close();
    server.send('stop');
    await new Promise(r => server.on('exit', r));
    console.log('  ok   one character from a browser at a time, and at most 4 from one internet address');
  } catch (err) {
    failed = true;
    console.log(`  FAIL ${err.stack}`);
  } finally {
    if (server.connected) server.send('stop');
    await new Promise(r => (server.exitCode !== null ? r() : server.on('exit', r)));
    // Don't leave the test characters behind in the real save file.
    for (const [file, had] of [[SAVES, hadSaves], [WORLD, hadWorld], [GUILDS, hadGuilds], [TOWN, hadTown], [OWNERS, hadOwners], ...BAKS.map((f, i) => [f, hadBaks[i]])]) {
      if (had) fs.writeFileSync(file, had);
      else if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
  process.exit(failed ? 1 : 0);
})();
