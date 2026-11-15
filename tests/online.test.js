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

function startServer() {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js'), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit', 'ipc'] });
  server.ready = new Promise((resolve, reject) => {
    server.stdout.on('data', d => String(d).includes('running') && resolve());
    server.on('exit', code => reject(new Error(`server exited with ${code}`)));
  });
  return server;
}

(async () => {
  const backup = file => fs.existsSync(file) && fs.readFileSync(file, 'utf8');
  const hadSaves = backup(SAVES), hadWorld = backup(WORLD), hadGuilds = backup(GUILDS), hadTown = backup(TOWN);
  const SAVE_FILES = [SAVES, WORLD, GUILDS, TOWN], BAKS = SAVE_FILES.map(f => `${f}.bak`), hadBaks = BAKS.map(backup);
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
    // A page sends junk: hotkeys keep only what's real; a flood of chat is cut down; the server carries on.
    afterRestart.act('setHotkeys', { F1: { type: 'spell', id: 'light' }, F2: { type: 'spell', id: 'constructor' }, F13: { type: 'say', text: 'x' }, F3: 'gold' });
    for (let i = 0; i < 300; i++) afterRestart.act('say', `spam ${i}`);
    await sleep(1600);
    const heard = oldOne.log.filter(l => l.includes('spam')).length;
    assert(heard > 0 && heard <= 12, `a flood of chat is cut down (${heard} of 300 lines got through)`);
    assert(JSON.stringify(afterRestart.you.hotkeys) === JSON.stringify({ F1: { type: 'spell', id: 'light' } }), `hotkeys keep only what's real (${JSON.stringify(afterRestart.you.hotkeys)})`);
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
  } catch (err) {
    failed = true;
    console.log(`  FAIL ${err.stack}`);
  } finally {
    if (server.connected) server.send('stop');
    await new Promise(r => (server.exitCode !== null ? r() : server.on('exit', r)));
    // Don't leave the test characters behind in the real save file.
    for (const [file, had] of [[SAVES, hadSaves], [WORLD, hadWorld], [GUILDS, hadGuilds], [TOWN, hadTown], ...BAKS.map((f, i) => [f, hadBaks[i]])]) {
      if (had) fs.writeFileSync(file, had);
      else if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
  process.exit(failed ? 1 : 0);
})();
