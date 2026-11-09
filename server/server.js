'use strict';
// Tilequest online: serves the game and runs one shared world for everyone.
//
//   node server/server.js [port = 8080] [--test]
//
// --test starts every new character (and any below level 20 the first time they log
// in) at level 20 in Valoria, in the vocation they pick, with good gear (for trying
// things out).
//
// Then open http://<this computer>:8080 in a browser; everyone on your network
// can join. The world runs the same logic files as the offline game. Characters
// are saved in server/players.json. Put a map exported from the editor in
// server/map.json to play on it instead of the built-in world - or publish it
// straight from the editor (on this computer), which saves it there.

const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { acceptWebSocket } = require('./ws');

const ROOT = path.join(__dirname, '..');
const PORT = +process.argv.slice(2).find(a => /^\d+$/.test(a)) || +process.env.PORT || 8080;
const TEST = process.argv.includes('--test');
const SAVE_FILE = path.join(__dirname, 'players.json');
const WORLD_FILE = path.join(__dirname, 'world.json'); // monsters and things on the ground, kept over a restart
const GUILD_FILE = path.join(__dirname, 'guilds.json');
const MAP_FILE = path.join(__dirname, 'map.json');
const TICK_MS = 50;
const VIEW = { x: 12, y: 10 }; // how far around a player the server sends things

// ---- the world ----------------------------------------------------------------------
const sandbox = {
  console,
  localStorage: {
    getItem: k => (k === 'tilequest.map.v3' && fs.existsSync(MAP_FILE) ? fs.readFileSync(MAP_FILE, 'utf8') : null),
    setItem() {},
    removeItem() {},
  },
};
vm.createContext(sandbox);
// What the game tells the player whose turn it is goes to their connection.
vm.runInContext(`
  function log(text, kind) { if (player) player.outbox.push(['log', text, kind || '']); }
  function logDialog(speaker, text, isPlayer) { if (player) player.outbox.push(['dialog', speaker, text, !!isPlayer]); }
  function uiDirty() { if (player) player.dirty = true; }
`, sandbox);
for (const f of ['defs', 'items', 'creatures', 'npcs', 'data', 'map', 'default-map', 'game-core', 'game-combat', 'game-npc', 'game-social', 'game-forge', 'game-guide', 'game-tales', 'game-update']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', `${f}.js`), 'utf8'), sandbox, { filename: `${f}.js` });
}
// Test mode: level a character to 20 the way the game would, and dress them well.
vm.runInContext(`
  function testBoost(vocation, kit) {
    const from = player.vocation;
    for (let l = player.level + 1; l <= 20; l++) {
      const v = VOCATIONS[from === 'none' && l <= 10 ? 'none' : vocation];
      player.maxHp += v.hp;
      player.maxMana += v.mana;
    }
    Object.assign(player, { vocation, home: 'main', level: 20, xp: xpForLevel(20), hp: player.maxHp, mana: player.maxMana,
      gold: player.gold + 5000, bank: player.bank + 10000 });
    for (const [skill, level] of Object.entries(kit.skills)) {
      if (player.skills[skill].level < level) player.skills[skill] = { level, tries: 0 };
    }
    const eq = player.equipment;
    for (const [slot, [id, n = 1]] of Object.entries(kit.gear)) eq[slot] = makeItem(id, n);
    if (ITEMS[eq.weapon.id].weapon.twoHanded) eq.shield = null;
    eq.backpack = { ...makeItem('backpack'), contents: eq.backpack ? eq.backpack.contents : [] };
    for (const [id, n] of kit.bag) giveItem(id, n);
    teleport(map.mainStart);
    log('Test server: you are a level 20 ' + vocation + ' in Valoria, with good gear, potions and 5000 gold (and 10000 in the bank). Have fun!', 'quest');
    uiDirty();
  }
`, sandbox);
const SUPPLIES = [['meat', 10], ['rope', 1], ['shovel', 1]];
const TEST_KITS = {
  knight: {
    gear: { head: ['steel_helmet'], body: ['plate_armor'], legs: ['plate_legs'], feet: ['iron_boots'], weapon: ['knight_blade'], shield: ['tower_shield'], neck: ['amulet_guard'] },
    bag: [['health_potion', 25], ['mana_potion', 10], ['battle_axe', 1], ['war_hammer', 1], ...SUPPLIES],
    skills: { sword: 45, axe: 45, club: 45, shielding: 40, magic: 3 },
  },
  paladin: {
    gear: { head: ['steel_helmet'], body: ['ranger_cloak'], legs: ['plate_legs'], feet: ['iron_boots'], weapon: ['crossbow'], ammo: ['bolt', 100], neck: ['amulet_guard'] },
    bag: [['health_potion', 20], ['mana_potion', 20], ['bow', 1], ['arrow', 100], ...SUPPLIES],
    skills: { distance: 45, shielding: 30, sword: 20, magic: 6 },
  },
  sorcerer: {
    gear: { head: ['wizard_hat'], body: ['mage_robe'], legs: ['chain_legs'], feet: ['iron_boots'], weapon: ['wand_flames'], shield: ['spellbook'], neck: ['amulet_guard'] },
    bag: [['mana_potion', 30], ['health_potion', 10], ['rune_fireball', 30], ['rune_missile', 30], ['rune_magic_wall', 5], ['blank_rune', 10], ...SUPPLIES],
    skills: { magic: 15, shielding: 15 },
  },
  druid: {
    gear: { head: ['wizard_hat'], body: ['mage_robe'], legs: ['chain_legs'], feet: ['iron_boots'], weapon: ['rod_thorns'], shield: ['spellbook'], neck: ['amulet_guard'] },
    bag: [['mana_potion', 30], ['health_potion', 10], ['rune_heal', 20], ['rune_missile', 30], ['rune_paralyze', 3], ['blank_rune', 10], ...SUPPLIES],
    skills: { magic: 15, shielding: 15 },
  },
};

// Playing the built-in world (no server/map.json): pages make it themselves, and
// only get the tiles that changed since the server started.
const BUILTIN = !fs.existsSync(MAP_FILE);
const SERVER_ID = crypto.randomBytes(4).toString('hex'); // a restarted server has forgotten its changes
const G = vm.runInContext(`({
  get now() { return now; }, set now(v) { now = v; },
  get monsters() { return monsters; }, set monsters(v) { monsters = v; },
  get npcs() { return npcs; }, set npcs(v) { npcs = v; },
  get guilds() { return guilds; }, set guilds(v) { guilds = v; },
  players, piles, fields, effects, mapChanges, map, Actions, newId,
})`, sandbox);
const W = sandbox; // the game's functions

// The game clock counts from a fixed day, so times (respawns, skulls, rides) stay
// valid when the server restarts.
const EPOCH = Date.UTC(2026, 0, 1);
const clock = () => Date.now() - EPOCH;
G.now = clock();
G.npcs = G.map.npcs.map(W.spawnNpc);
const builtinSignature = BUILTIN ? W.mapSignature(G.map) : null;
const changedTiles = new Set(); // "x,y,z" of every tile changed since the start
const tileState = key => {
  const [x, y, z] = key.split(',').map(Number), t = G.map.get(x, y, z);
  return [x, y, z, t ? t.ground : null, t ? [...t.items] : []];
};

// ---- the world over a restart: monsters where they were, corpses and dropped things kept ----
function saveWorld() {
  const spawnIndex = new Map(G.map.spawns.map((s, i) => [s, i]));
  const world = {
    savedAt: Date.now(), map: mapId,
    monsters: G.monsters.filter(m => spawnIndex.has(m.spawn)).map(m => ({ spawn: spawnIndex.get(m.spawn), type: m.type, at: [m.spawn.x, m.spawn.y, m.spawn.z], x: m.x, y: m.y, z: m.z, hp: m.hp, dead: m.dead, respawnAt: m.respawnAt })),
    piles: G.piles.filter(p => !p.house), // things in houses are saved with their owner
    fields: G.fields,
  };
  fs.writeFileSync(`${WORLD_FILE}.tmp`, JSON.stringify(world));
  fs.renameSync(`${WORLD_FILE}.tmp`, WORLD_FILE);
}
const mapId = W.mapSignature(G.map);
function loadWorld() {
  try {
    const world = JSON.parse(fs.readFileSync(WORLD_FILE, 'utf8'));
    // an old world isn't worth keeping, nor one saved on another map (corpses would end up in walls)
    return Date.now() - world.savedAt < 10 * 60000 && world.map === mapId ? world : null;
  } catch (e) {
    return null;
  }
}
const savedWorld = loadWorld();
const savedMonsters = new Map(((savedWorld && savedWorld.monsters) || []).map(m => [m.spawn, m]));
// A monster comes back only if its spawn is still the same (the world may have been rebuilt since).
const sameSpawn = (old, s) => old && old.type === s.type && old.at && old.at.join() === `${s.x},${s.y},${s.z}`;
W.spawnAll(G.map.spawns, (m, i) => {
  const old = savedMonsters.get(i), s = G.map.spawns[i];
  if (sameSpawn(old, s)) {
    Object.assign(m, { hp: Math.min(old.hp, m.maxHp), dead: old.dead, respawnAt: old.respawnAt });
    if (!G.monsters.some(o => o.x === old.x && o.y === old.y && o.z === old.z)) Object.assign(m, { x: old.x, y: old.y, z: old.z });
  }
  return m;
});
if (savedWorld) {
  for (const p of savedWorld.piles) G.piles.push({ ...p, id: G.newId() });
  G.fields.push(...savedWorld.fields);
  console.log(`Restored the world: ${savedMonsters.size} monsters, ${savedWorld.piles.length} piles.`);
}

// ---- guilds -------------------------------------------------------------------------------
// A save file that is there but can't be read (a typo in a hand edit) stops the server:
// otherwise the next save would overwrite it with nothing.
function readSave(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null; // not made yet
    console.error(`Could not read ${file}: ${e.message}\nFix or remove it, then start the server again.`);
    process.exit(1);
  }
}
G.guilds = readSave(GUILD_FILE) || G.guilds;

// ---- accounts -----------------------------------------------------------------------------
const accounts = readSave(SAVE_FILE) || {};
// Houses stay rented while their tenants are away (also over a restart).
for (const { save } of Object.values(accounts)) {
  const house = save && save.house && G.map.houses.find(h => h.id === save.house);
  if (house && !house.owner) house.owner = save.name;
}
const hash = (key, password) => crypto.createHash('sha256').update(`${key}:${password}`).digest('hex');

// A character's save, plus what only matters while the server runs: a skull, a ride.
function saveAccount(p) {
  const key = p.name.toLowerCase();
  const save = W.asPlayer(p, () => W.serializePlayer(p));
  accounts[key] = { ...accounts[key], save: { ...save, skullUntil: p.skullUntil, redSkullUntil: p.redSkullUntil, pzLockUntil: p.pzLockUntil, frags: p.frags, ride: p.ride || null } };
}
function persist() {
  for (const p of G.players) saveAccount(p);
  saveWorld();
  fs.writeFileSync(`${SAVE_FILE}.tmp`, JSON.stringify(accounts));
  fs.renameSync(`${SAVE_FILE}.tmp`, SAVE_FILE);
  fs.writeFileSync(`${GUILD_FILE}.tmp`, JSON.stringify(G.guilds));
  fs.renameSync(`${GUILD_FILE}.tmp`, GUILD_FILE);
}
setInterval(persist, 10000);

// ---- connections --------------------------------------------------------------------------
const conns = new Set();
let effectSeq = 0;
const ACTIONS = new Set(Object.keys(G.Actions));

// After the first login a page gets a token: reloading it logs straight back in.
// A character whose page went away stays in the world for a moment, so a reload
// (or the same player on another device) takes it over without logging out.
const LINGER = 8000;

const asText = v => (typeof v === 'string' ? v : ''); // what a page sends may be anything

function login(conn, msg) {
  msg = { ...msg, name: asText(msg.name), password: asText(msg.password), token: asText(msg.token), vocation: asText(msg.vocation) };
  const name = msg.name.trim().replace(/[^\w '-]/g, '').slice(0, 20);
  if (name.length < 2) return conn.reply({ t: 'error', message: 'Choose a name of at least 2 letters.' });
  const key = name.toLowerCase();
  const account = accounts[key];
  const byToken = account && msg.token && account.token === msg.token;
  if (account && !byToken && account.password !== hash(key, msg.password || '')) {
    return conn.reply({ t: 'error', message: msg.token ? 'Please log in again.' : 'Wrong password for this character.', relogin: !!msg.token });
  }
  if (!account && msg.token) return conn.reply({ t: 'error', message: 'Please log in again.', relogin: true });

  const online = G.players.find(p => p.name.toLowerCase() === key);
  if (online) {
    clearTimeout(online.lingerTimer);
    for (const other of conns) if (other.player === online) {
      other.player = null;
      other.reply({ t: 'kicked', message: 'You are playing this character on another page now.' });
      other.ws.close();
    }
    W.asPlayer(online, () => W.log(`Welcome back, ${online.name}!`, 'quest'));
    return enter(conn, online, false);
  }

  const p = W.newPlayer(name[0].toUpperCase() + name.slice(1));
  p.outbox = [];
  G.players.push(p);
  W.asPlayer(p, () => {
    if (account && account.save) {
      W.applySave(account.save);
      if (account.save.skullUntil > G.now) p.skullUntil = account.save.skullUntil;
      if (account.save.redSkullUntil > G.now) p.redSkullUntil = account.save.redSkullUntil;
      if (account.save.pzLockUntil > G.now) p.pzLockUntil = account.save.pzLockUntil;
      p.frags = account.save.frags || [];
      if (account.save.ride) p.ride = account.save.ride;
    } else W.teleport(G.map.start);
    // once per character: dying can take a character below 20 again, and that's how it stays
    const boosted = account && (account.boosted || (account.save && account.save.level >= 20));
    if (TEST && p.level < 20 && !boosted && msg.vocation !== 'none') { // 'none': start fresh on Brightwater Isle
      const vocation = p.vocation !== 'none' ? p.vocation : Object.keys(TEST_KITS).includes(msg.vocation) ? msg.vocation : 'knight';
      W.testBoost(vocation, TEST_KITS[vocation]);
    }
    W.log(`Welcome${account ? ' back' : ''}, ${p.name}! ${G.players.length - 1} other player${G.players.length === 2 ? ' is' : 's are'} online.`, 'quest');
  });
  if (!account) accounts[key] = { password: hash(key, msg.password || ''), save: null };
  if (TEST) accounts[key].boosted = true;
  enter(conn, p, !account);
  for (const other of G.players) if (other !== p) W.asPlayer(other, () => W.log(`${p.name} has logged in.`));
}

function enter(conn, p, isNew) {
  const account = accounts[p.name.toLowerCase()];
  if (!account.token) {
    account.token = crypto.randomBytes(16).toString('hex');
    persist();
  }
  conn.player = p;
  conn.full = 0;
  p.dirty = true;
  conn.reply({
    t: 'welcome', id: p.id, name: p.name, now: G.now, isNew, token: account.token, version,
    server: SERVER_ID, ...(BUILTIN ? { builtin: builtinSignature, changes: [...changedTiles].map(tileState) } : { map: G.map }),
    npcs: G.npcs.map(n => ({ id: n.id, npcId: n.npcId, name: n.name, x: n.x, y: n.y, z: n.z, dir: n.dir })),
  });
}

function disconnect(conn) {
  const p = conn.player;
  if (!p) return;
  conn.player = null;
  saveAccount(p);
  p.lingerTimer = setTimeout(() => logout(p), LINGER);
}

function logout(p) {
  if (!G.players.includes(p)) return;
  W.asPlayer(p, () => W.endConversation(true));
  saveAccount(p);
  for (const pile of G.piles.filter(pl => p.house && pl.house === p.house)) W.removePile(pile); // they're in the save
  W.partyGone(p);
  G.players.splice(G.players.indexOf(p), 1);
  for (const other of G.players) {
    if (other.target === p) other.target = null;
    W.asPlayer(other, () => W.log(`${p.name} has logged out.`));
  }
  persist();
}

function act(conn, msg) {
  const p = conn.player;
  if (!p || !ACTIONS.has(msg.a) || !Array.isArray(msg.args)) return;
  try {
    W.asPlayer(p, () => G.Actions[msg.a](...msg.args));
  } catch (e) {
    console.error(`Action ${msg.a} by ${p.name} failed:`, e);
  }
}

// ---- what each player gets 20 times a second -----------------------------------------------
const near = (p, o) => o.z !== undefined && Math.abs(o.x - p.x) <= VIEW.x && Math.abs(o.y - p.y) <= VIEW.y;
const ALWAYS = ['id', 'name', 'trainHits', 'x', 'y', 'z', 'dir', 'walk', 'hp', 'maxHp', 'mana', 'maxMana', 'level', 'xp', 'gold', 'bank', 'dead',
  'respawnAt', 'conditions', 'fedUntil', 'lightUntil', 'skullUntil', 'redSkullUntil', 'pzLockUntil', 'frags', 'vocation', 'promoted', 'outfit', 'fightMode', 'chase', 'secure', 'blessed', 'house', 'home', 'follow', 'tutorial'];
const SOMETIMES = ['equipment', 'depot', 'skills', 'quests', 'chests', 'hotkeys', 'markers', 'furniture'];

function youState(conn) {
  const p = conn.player, you = {};
  for (const k of ALWAYS) you[k] = p[k];
  you.ride = W.rideView(p.ride) || null;
  you.target = p.target ? p.target.id : null;
  you.openPile = p.openPile ? p.openPile.id : null;
  you.shopNpc = p.shopNpc ? p.shopNpc.id : null;
  W.asPlayer(p, () => Object.assign(you, { partyView: W.partyView(p), partyMark: W.partyMark(p, p), guildView: W.guildView(p), guildInfo: W.guildInfo(p) }));
  if (p.dirty || conn.full++ % 20 === 0) {
    for (const k of SOMETIMES) you[k] = p[k];
    p.dirty = false;
  }
  return you;
}

function snapshot(conn, tiles) {
  const p = conn.player;
  const msg = {
    t: 'state', now: G.now, you: youState(conn),
    players: G.players.filter(o => o !== p && near(p, o)).map(o => ({
      id: o.id, name: o.name, vocation: o.vocation, promoted: o.promoted, outfit: o.outfit, level: o.level,
      x: o.x, y: o.y, z: o.z, dir: o.dir, walk: o.walk, hp: o.hp, maxHp: o.maxHp, dead: o.dead, skullUntil: o.skullUntil, redSkullUntil: o.redSkullUntil, yellow: (o.yellowTo || {})[p.id] > G.now, ride: W.rideView(o.ride),
      partyMark: W.partyMark(o, p), guildInfo: W.guildInfo(o), lightUntil: o.lightUntil,
    })),
    monsters: G.monsters.filter(m => !m.dead && near(p, m)).map(m => ({
      id: m.id, type: m.type, name: m.name, x: m.x, y: m.y, z: m.z, dir: m.dir, walk: m.walk, hp: m.hp, maxHp: m.maxHp,
    })),
    npcs: G.npcs.filter(n => n.def.wander && near(p, n)).map(n => ({ id: n.id, x: n.x, y: n.y, z: n.z, dir: n.dir, walk: n.walk })),
    piles: G.piles.filter(pl => near(p, pl)).map(pl => ({ id: pl.id, x: pl.x, y: pl.y, z: pl.z, corpse: pl.corpse, name: pl.name, items: pl.items })),
    fields: G.fields.filter(f => near(p, f)),
    effects: G.effects.filter(fx => fx.seq > conn.seq && W.forViewer(fx, p) && near(p, { x: fx.x ?? fx.fx, y: fx.y ?? fx.fy, z: fx.z })),
    tiles,
    out: p.outbox.splice(0),
    events: p.events.splice(0),
  };
  conn.seq = effectSeq;
  return msg;
}

setInterval(() => {
  G.now = clock();
  try {
    W.updateWorld();
  } catch (e) {
    console.error('World update failed:', e);
  }
  for (const fx of G.effects) if (fx.seq === undefined) fx.seq = ++effectSeq;
  const keys = [...new Set(G.mapChanges.splice(0).map(([x, y, z]) => `${x},${y},${z}`))];
  for (const key of keys) changedTiles.add(key);
  const tiles = keys.map(tileState);
  for (const conn of conns) if (conn.player) conn.reply(snapshot(conn, tiles));
}, TICK_MS);

// ---- updates: when the game files change, pages are told they can reload -------------------
const CLIENT_DIRS = ['js', 'css', 'sprites'];
function clientVersion() {
  let newest = 0;
  for (const dir of CLIENT_DIRS) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) newest = Math.max(newest, fs.statSync(path.join(ROOT, dir, f)).mtimeMs);
  }
  for (const f of fs.readdirSync(ROOT)) if (/\.(html|json)$/.test(f)) newest = Math.max(newest, fs.statSync(path.join(ROOT, f)).mtimeMs);
  return String(Math.floor(newest));
}
let version = clientVersion(), versionTimer = null;
const changed = () => {
  clearTimeout(versionTimer);
  versionTimer = setTimeout(() => {
    const v = clientVersion();
    if (v === version) return;
    version = v;
    for (const conn of conns) if (conn.player) conn.reply({ t: 'updated', version });
  }, 1000);
};
for (const dir of CLIENT_DIRS) fs.watch(path.join(ROOT, dir), changed);
fs.watch(ROOT, (event, file) => file && /\.(html|json)$/.test(file) && changed());

// ---- HTTP: the game files, and the WebSocket ------------------------------------------------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.md': 'text/plain' };

const server = http.createServer((req, res) => {
  let url, file;
  try { // a malformed address ("//", a broken %-escape) must not take the server down
    url = new URL(req.url.replace(/^\/+/, '/'), 'http://x');
    file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
    if (file.includes('\0')) throw new Error('a NUL byte in the address');
  } catch (e) {
    res.writeHead(400);
    return res.end('Bad request');
  }
  if (url.pathname === '/') {
    res.writeHead(302, { Location: '/index.html?online' });
    return res.end();
  }
  if (url.pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    return res.end(JSON.stringify({ test: TEST, players: G.players.length, customMap: !BUILTIN }));
  }
  if (url.pathname === '/map' && (req.method === 'POST' || req.method === 'DELETE')) return publishMap(req, res);
  if (url.pathname === '/admin/gold' && req.method === 'POST') return topUpGold(req, res, url);
  // Only the game's own files: the pages, and the folders they load from. Never the server
  // folder (it holds the accounts), nor anything else that happens to lie around.
  const rel = path.relative(ROOT, file), parts = rel.split(path.sep);
  const allowed = parts.length === 1 ? /\.html$/.test(rel) || rel === 'manifest.json' : CLIENT_DIRS.includes(parts[0]);
  if (rel.startsWith('..') || !allowed || parts.some(part => part.startsWith('.'))) {
    res.writeHead(404);
    return res.end('Not found');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// Only from this computer, with a header no web page can send without asking first.
const fromHere = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) && req.headers['x-tilequest'] === 'editor'
  && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host || ''); // not a page that renamed itself to us

// Whoever runs the server can top up the purses of everyone online, e.g. so all can travel:
//   curl -X POST -H 'X-Tilequest: editor' 'localhost:8080/admin/gold?atLeast=10000'
function topUpGold(req, res, url) {
  const reply = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (!fromHere(req)) return reply(403, { ok: false, message: 'Only on the computer the server runs on.' });
  const atLeast = Math.max(0, Math.min(1e6, Math.floor(+url.searchParams.get('atLeast') || 0)));
  const given = [];
  for (const p of G.players) {
    const add = atLeast - p.gold;
    given.push({ name: p.name, gold: Math.max(p.gold, atLeast), added: Math.max(0, add) });
    if (add <= 0) continue;
    p.gold = atLeast;
    W.asPlayer(p, () => { W.log(`A gift for the road: ${add} gold. You have ${p.gold} gold now - enough to travel.`, 'quest'); W.uiDirty(); });
  }
  persist();
  reply(200, { ok: true, given });
}

// The map editor publishes its map here (POST: play it, DELETE: back to the built-in
// world). Only from this computer: nobody else on the network gets to replace the world.
// Under server/dev.js the server restarts on the new map by itself.
function publishMap(req, res) {
  const answer = (code, message) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: code === 200, message }));
  };
  // The editor sends a header no other web page can send without asking first: so a site
  // open in a browser on this computer can't replace the world either.
  if (!fromHere(req)) {
    return answer(403, 'Maps can only be published from the map editor, on the computer the server runs on.');
  }
  const after = process.env.TILEQUEST_DEV ? 'The server restarts on it now.' : 'Restart the server to play it.';
  if (req.method === 'DELETE') {
    if (!fs.existsSync(MAP_FILE)) return answer(200, 'The server already plays the built-in world.');
    const kept = `map-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json.bak`;
    fs.renameSync(MAP_FILE, path.join(__dirname, kept));
    return answer(200, `The server plays the built-in world again (your map was kept as server/${kept}). ${after}`);
  }
  const chunks = [];
  let size = 0;
  req.on('data', c => {
    size += c.length;
    if (size > 200e6) req.destroy();
    else chunks.push(c);
  });
  req.on('end', () => {
    try {
      const text = Buffer.concat(chunks).toString('utf8'), m = JSON.parse(text);
      if (!m || !['tilequest-map-3', 'tilequest-map-4'].includes(m.format)) return answer(400, 'That is not a Tilequest map.');
      const loaded = vm.runInContext('GameMap', sandbox).fromJSON(m); // as the server will load it: if this fails, so would every start
      if (!loaded.inBounds(loaded.start.x, loaded.start.y, loaded.start.z)) return answer(400, 'The map has no start position on it.');
      fs.writeFileSync(`${MAP_FILE}.tmp`, text);
      fs.renameSync(`${MAP_FILE}.tmp`, MAP_FILE);
      answer(200, `Published (${loaded.width}×${loaded.height}, ${loaded.depth} floors). ${after}`);
    } catch (e) {
      answer(400, `Could not publish the map: ${e.message}`);
    }
  });
}

server.on('upgrade', (req, socket) => {
  if (req.url !== '/ws') return socket.destroy();
  const ws = acceptWebSocket(req, socket);
  if (!ws) return;
  const conn = { ws, player: null, seq: effectSeq, full: 0, reply: msg => ws.send(JSON.stringify(msg)) };
  conns.add(conn);
  ws.onmessage = data => {
    try { // nothing a page sends may take the server down
      const msg = JSON.parse(data);
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'login' && !conn.player) login(conn, msg);
      else if (msg.t === 'act') act(conn, msg);
    } catch (e) {
      console.error('A message from a page failed:', e);
    }
  };
  ws.onclose = () => {
    conns.delete(conn);
    disconnect(conn);
  };
});

server.listen(PORT, () => {
  if (TEST) console.log('Test mode: new characters start at level 20 in Valoria, with good gear (or fresh on Brightwater Isle, if they choose).');
  console.log(`Tilequest server running: open http://localhost:${PORT} (others on your network: http://<this computer's address>:${PORT})`);
});

// Stopping the server (Ctrl+C, or a kill while updating it) saves everyone first. dev.js
// and the tests ask it to stop with a message instead: on Windows a kill can't be caught.
const stop = () => {
  persist();
  process.exit(0);
};
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, stop);
process.on('message', msg => msg === 'stop' && stop());
