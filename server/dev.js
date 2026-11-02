'use strict';
// Keep playing while the game is being worked on:
//
//   node server/dev.js [port = 8080] [--test]
//
// Runs server.js, and restarts it whenever the game logic or the server code
// changes, or a map is published from the editor. The server saves every character and the world when it stops, and
// players' pages reconnect by themselves (and reload, if the page itself
// changed), so a change shows up for everyone within a few seconds.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// The files the server runs (see server.js); the rest of js/ only matters to pages.
const LOGIC = /^(defs|items|creatures|npcs|data|map|default-map|game-core|game-combat|game-npc|game-social|game-forge|game-guide|game-tales|game-update)\.js$/;
let child = null, restarting = false, timer = null;

function start() {
  child = spawn(process.execPath, [path.join(__dirname, 'server.js'), ...process.argv.slice(2)], { stdio: ['inherit', 'inherit', 'inherit', 'ipc'], env: { ...process.env, TILEQUEST_DEV: '1' } });
  child.on('exit', code => {
    child = null;
    if (restarting) {
      restarting = false;
      start();
    } else if (code) {
      console.log('The server stopped with an error. It starts again when a file changes.');
    }
  });
}

// Ask the server to save and stop. (A signal would do on Linux and macOS, but on Windows
// it ends the process on the spot, without saving.) If it doesn't, it's stopped anyway.
function stopChild() {
  const c = child;
  try {
    c.send('stop', () => {});
  } catch (e) {
    c.kill();
  }
  setTimeout(() => c.exitCode === null && c.signalCode === null && c.kill(), 5000);
}

function restart(file) {
  console.log(`\n${file} changed: restarting the game server...`);
  if (!child) return start();
  restarting = true;
  stopChild(); // it saves everything before it exits
}

// Editors write files in bursts: wait until it's quiet.
const changed = file => {
  clearTimeout(timer);
  timer = setTimeout(() => restart(file), 500);
};
fs.watch(path.join(ROOT, 'js'), (event, file) => file && LOGIC.test(file) && changed(file));
// ...and the server code, and a map published from the editor (server/map.json)
fs.watch(__dirname, (event, file) => file && ((/\.js$/.test(file) && file !== 'dev.js') || file === 'map.json') && changed(file));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!child) process.exit(0);
    restarting = false;
    child.once('exit', () => process.exit(0));
    stopChild();
  });
}

start();
