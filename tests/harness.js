'use strict';
// Loads the game's logic files (everything except the DOM/canvas code) into a
// Node sandbox, the same way the browser and the server load them as plain scripts.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const LOGIC_FILES = [
  'defs', 'items', 'creatures', 'npcs', 'data', 'map', 'default-map',
  'game-core', 'game-combat', 'game-npc', 'game-social', 'game-forge', 'game-guide', 'game-tales', 'game-update',
];

// Seeded replacement for Math.random so a failing run can be replayed.
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadGame({ seed = 1 } = {}) {
  const messages = [];
  const storage = new Map();
  const math = Object.create(Math);
  math.random = seededRandom(seed);

  const sandbox = {
    Math: math,
    console: { log() {}, warn() {}, error: (...a) => messages.push(`console.error: ${a.join(' ')}`) },
    localStorage: {
      getItem: k => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: k => storage.delete(k),
    },
    // Normally provided by game-ui.js:
    log: text => messages.push(text),
    logDialog: (who, text) => messages.push(`${who}: ${text}`),
    uiDirty() {},
  };
  const ctx = vm.createContext(sandbox);
  for (const f of LOGIC_FILES) {
    const file = path.join(ROOT, 'js', `${f}.js`);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  }

  // Top-level let/const live in the script scope, not on the global object;
  // expose them (functions are already globals).
  const state = vm.runInContext(`({
    get player() { return player; }, set player(p) { player = p; },
    get map() { return map; },
    get monsters() { return monsters; }, set monsters(v) { monsters = v; },
    get npcs() { return npcs; }, set npcs(v) { npcs = v; },
    get parties() { return parties; }, get guilds() { return guilds; },
    players, piles, fields, effects,
    get now() { return now; }, set now(v) { now = v; },
    DIR_KEYS, THINGS, ITEMS, MONSTERS, NPCS, QUESTS, SPELLS, VOCATIONS, SLOTS, BUYS, CONDITIONS, FIELDS, Actions, RAIDS, GUIDE,
    bag, dist, countItem, questState, pileAt, fieldAt, xpForLevel, freeCapacity, capacity, bagItems, findInBag, isFree, playerWeapon,
    physicalMax, physicalHit, blocked, FIGHT_MODES,
  })`, ctx);

  // Same start-up as game.js: the player, the NPCs, then the monsters.
  state.now = 1000;
  state.player = ctx.newPlayer('Tester');
  state.players.push(state.player);
  state.npcs = state.map.npcs.map(ctx.spawnNpc);
  ctx.teleport(state.map.start);
  ctx.spawnAll(state.map.spawns);

  return { ctx, state, messages, storage };
}

module.exports = { loadGame, seededRandom, ROOT };
