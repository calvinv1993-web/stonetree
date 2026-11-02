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
const sleep = ms => new Promise(r => setTimeout(r, ms));
const waitFor = async (ready, ms = 5000) => {
  for (let t = 0; t < ms && !ready(); t += 100) await sleep(100);
};

function client(name, login = { password: 'secret' }) {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  const c = { state: null, welcome: null, error: null, kicked: false, log: [], act: (a, ...args) => ws.send(JSON.stringify({ t: 'act', a, args })) };
  ws.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.t === 'welcome') c.welcome = msg;
    if (msg.t === 'error') c.error = msg.message;
    if (msg.t === 'kicked') c.kicked = true;
    if (msg.t === 'state') {
      c.state = msg;
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
  const hadSaves = backup(SAVES), hadWorld = backup(WORLD);
  let server = startServer();
  let failed = false;
  try {
    await server.ready;
    const tag = Date.now().toString(36).slice(-5);
    const alice = client(`Alice${tag}`), bob = client(`Bob${tag}`);
    await sleep(1500);
    assert(alice.welcome && bob.welcome, 'both logged in');
    assert(alice.state.players.some(p => p.name === `Bob${tag}`), 'Alice sees Bob');

    const bobAt = bob.state.you.y;
    bob.act('keyDown', 's', false);
    bob.act('keyUp', 's');
    await sleep(800);
    const seen = alice.state.players.find(p => p.name === `Bob${tag}`);
    assert(seen && seen.y !== bobAt, 'Alice sees Bob walk');

    bob.act('say', 'hello there');
    await sleep(300);
    assert(alice.log.some(l => l.includes('hello there')), 'Alice hears Bob');
    alice.act('say', 'hi');
    await sleep(300);
    assert(alice.log.some(l => l.includes('Elder Maren')), 'Maren answers Alice');
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
    server = startServer();
    await server.ready;
    const afterRestart = client(`Bob${tag}`, { token: bob.welcome.token });
    await waitFor(() => afterRestart.state || afterRestart.error);
    assert(afterRestart.welcome, `the token still works after a restart (${afterRestart.error || 'no answer'})`);
    assert(afterRestart.state.you.x === before.x && afterRestart.state.you.y === before.y, 'and Bob is where he was');
    assert(fs.existsSync(WORLD), 'the world was saved');
    console.log('  ok   a restarted server (an update) keeps characters, logins and the world');
  } catch (err) {
    failed = true;
    console.log(`  FAIL ${err.stack}`);
  } finally {
    if (server.connected) server.send('stop');
    await new Promise(r => (server.exitCode !== null ? r() : server.on('exit', r)));
    // Don't leave the test characters behind in the real save file.
    for (const [file, had] of [[SAVES, hadSaves], [WORLD, hadWorld]]) {
      if (had) fs.writeFileSync(file, had);
      else if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
  process.exit(failed ? 1 : 0);
})();
