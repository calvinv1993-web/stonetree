'use strict';
// Game state and the rules for moving, carrying things and progressing.
// The game logic is split over game-core.js, game-combat.js, game-npc.js and
// game-update.js. They have no DOM code, so the server and the tests run the
// same files; game-ui.js and game.js are the browser side.
//
// Everything is written from the point of view of `player`, the player whose
// turn it is: offline that's you, on the server asPlayer() switches between players.

let VIEW_W = 15, VIEW_H = 11; // visible tiles (phones change this to fit their screen)
const SCALE = 2;                 // canvas pixels per world pixel
const SAVE_KEY = 'tilequest.save.v3';

// An editor map in this browser is played instead of the built-in world, but only one made from the built-in world
// as it is now: one made from an older version would bring the old world back (the editor offers to update it).
const customMap = (() => {
  const stored = loadStoredMap();
  return stored && storedMapBase() === worldFingerprint(createDefaultMap()) ? stored : null;
})();
const map = customMap || createDefaultMap();

let now = 0;           // time of the current frame (ms)
const POTION_COOLDOWN = 1000; // ms between two potions
const AUTO_HEAL_MAX = 80; // the highest auto-heal setting (percent): above it a potion would mostly be wasted
let monsters = [];
let npcs = [];
const players = [];    // everyone in the world (offline: just you)
const piles = [];      // corpses and dropped items: { id, x, y, z, items, corpse, name, until, house }
const fields = [];     // fire/poison/energy fields and magic walls: { x, y, z, kind, until }
const effects = [];    // short-lived visuals and sounds, see game-combat.js
const reverts = [];    // temporary map changes (dug holes, broken rocks): { x, y, z, add, remove, at }
const mapChanges = []; // tiles changed at runtime, for the minimap and the server
let player = null;
let nextId = 1;
const newId = () => nextId++;

function asPlayer(p, fn) {
  const previous = player;
  player = p;
  try {
    return fn();
  } finally {
    player = previous;
  }
}

function newPlayer(name) {
  const skills = {};
  for (const id in SKILLS) skills[id] = { level: SKILLS[id].start, tries: 0 };
  return {
    id: newId(), type: 'player', name, vocation: 'none', promoted: false, home: 'start', outfit: {},
    x: 0, y: 0, z: 0, dir: 2, walk: null,
    level: 1, xp: 0, hp: 150, maxHp: 150, mana: 50, maxMana: 50, gold: 20, bank: 0, skills,
    autoHeal: { hp: 0, mana: 0 }, // drink a potion by yourself below this much health / mana (percent; 0: off): autoHeal() in game-update.js
    equipment: {
      head: null, neck: null, body: null, legs: null, feet: null, shield: null, ring: null, ammo: null,
      weapon: makeItem('wooden_club'),
      backpack: { ...makeItem('bag'), contents: [makeItem('apple', 5), makeItem('health_potion', 2)] },
    },
    depot: { depot: true, contents: [] },
    quests: {},     // id -> { status: 'active' | 'done', step, kills: { monsterType: n } }
    chests: {},     // flags of quest chests already opened
    blessed: false, house: null, furniture: [], hotkeys: {}, markers: [],
    tutorial: 1, tale: 0, // the guide's step (0: done), and how far into the island's tale
    huntDay: '', // the real day of your last first-of-the-day watch hunt (its bonus marks: reward.daily, dailyDue)
    guideSeen: 0, // the furthest step of the guide reached (started again, the ones before it pass by themselves)
    bestiary: {}, // kills of each kind of monster: type -> n (BESTIARY_TIERS in game-combat.js)
    cosmetics: [], // what you've bought from the watch's stores to wear (COSMETICS in defs.js), worn through your outfit
    pet: null, // a companion that follows you and fights with you: { name, kind, level, xp, hp, mode, ... } (Clang, the temple's cat; game-update.js updatePet)
    born: Math.floor(Math.random() * 36 ** 6).toString(36), // this character's own mark: what a browser keeps for it (its action buttons) starts fresh with a new one of the same name
    fightMode: 'balanced', chase: true, secure: true, conditions: {},
    path: [], pathGoal: null, action: null, target: null, openPile: null,
    input: { held: [], queued: null }, conversation: null, shopNpc: null, events: [],
    training: null, trainHits: 0, // the dummy you're hitting ({ x, y, z, fromX, fromY }), and how often you have
    lastAttack: 0, nextChase: 0, nextRegen: 0, fedUntil: 0, lightUntil: 0, spellReady: 0, spellCooldowns: {}, potionReady: 0, useReady: 0,
    teleportAt: 0, dead: false, respawnAt: 0, lastNotPossible: 0, lastWarning: 0, skullUntil: 0, redSkullUntil: 0, pzLockUntil: 0, frags: [], yellowTo: {},
  };
}

function makeItem(id, count = 1) {
  const item = { id, count };
  if (ITEMS[id].container) item.contents = [];
  if (ITEMS[id].ring) item.time = ITEMS[id].ring.duration;
  return item;
}

// Something the browser should show the player (read a sign, open the depot...).
function playerEvent(kind, data) {
  player.events.push({ kind, data });
}

function mapChanged(x, y, z) {
  mapChanges.push([x, y, z]);
  if (map.dirty) map.dirty.push([x, y, z]); // (the renderer draws that ground again)
}

// ---- world queries -----------------------------------------------------------------
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const inMelee = (a, b) => a.z === b.z && dist(a, b) <= 1;
const dirTo = (dx, dy) => (dx > 0 ? 1 : dx < 0 ? 3 : dy < 0 ? 0 : 2);
const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const monsterRef = c => (c.type === 'player' ? c.name : c.def.proper ? c.name : withArticle(c.name));
const topItem = t => (t && t.items.length ? t.items[t.items.length - 1] : null);

function creatureAt(x, y, z) {
  return players.find(p => !p.dead && p.x === x && p.y === y && p.z === z)
    || monsters.find(m => !m.dead && m.x === x && m.y === y && m.z === z)
    || npcs.find(n => n.x === x && n.y === y && n.z === z)
    || null;
}
const fieldAt = (x, y, z) => fields.find(f => f.x === x && f.y === y && f.z === z) || null;
const magicWallAt = (x, y, z) => fields.some(f => f.x === x && f.y === y && f.z === z && FIELDS[f.kind].block);
const isFree = (x, y, z) => map.isWalkable(x, y, z) && !magicWallAt(x, y, z) && !creatureAt(x, y, z);
const isFreeNoStairs = (x, y, z) => isFree(x, y, z) && !map.floorChange(x, y, z);

// isFreeNoStairs for the tiles within r of c, for a path search: who stands where is
// looked up once, instead of for every tile the search tries (1000+ monsters).
function freeAround(c, r) {
  const busy = new Set(), z = c.z, near = o => o.z === z && Math.abs(o.x - c.x) <= r && Math.abs(o.y - c.y) <= r;
  for (const list of [players, monsters]) for (const o of list) if (!o.dead && near(o)) busy.add(o.x * 65536 + o.y);
  for (const n of npcs) if (near(n)) busy.add(n.x * 65536 + n.y);
  return (x, y) => map.isWalkable(x, y, z) && !busy.has(x * 65536 + y) && !magicWallAt(x, y, z) && !map.floorChange(x, y, z);
}

// Nearest free, non-stair tile within `radius`, searching outward in rings.
// (forMonster: not in shops, temples and the like, where monsters can't take a step.)
function findFreeTile(x, y, z, radius, forMonster) {
  for (let r = 0; r <= radius; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !isFreeNoStairs(x + dx, y + dy, z)) continue;
      if (!forMonster || !map.isShelter(x + dx, y + dy, z)) return { x: x + dx, y: y + dy };
    }
  }
  return null;
}

// Can a missile or spell fly from a to b? Walls and trees block it, tables and fences don't.
function sightClear(a, b) {
  if (a.z !== b.z) return false;
  const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  for (let i = 1; i < n; i++) {
    const x = Math.round(a.x + ((b.x - a.x) * i) / n), y = Math.round(a.y + ((b.y - a.y) * i) / n);
    const t = map.get(x, y, a.z);
    if ((t && t.items.some(id => THINGS[id].block && !THINGS[id].low)) || magicWallAt(x, y, a.z)) return false;
  }
  return true;
}

// ---- doors -------------------------------------------------------------------------
const ownsHouseAt = (x, y, z) => {
  const h = map.houseAt(x, y, z);
  return !!h && player.house === h.id;
};
// A house door opens for its tenant - and for anyone inside, so a guest never gets shut in.
const houseDoorOpens = (x, y, z) => ownsHouseAt(x, y, z) || (!!map.houseAt(x, y, z) && map.houseAt(x, y, z) === map.houseAt(player.x, player.y, player.z));
const hasKey = lock => bagItems().some(it => ITEMS[it.id].key === lock);

// "drowned_king@2": the quest is done, or active and at step 2 or later.
function questAllows(spec) {
  const [id, step = 0] = String(spec || '').split('@');
  const q = player.quests[id];
  return !!q && (q.status === 'done' || q.step >= +step);
}

// May the player go through the blocking thing `id` at x, y, z (opening it if needed)?
function doorOpenable(id, x, y, z) {
  const def = THINGS[id], meta = map.getMeta(x, y, z) || {};
  if (def.questDoor) return questAllows(meta.quest);
  if (def.levelDoor) return player.level >= (+meta.level || 0);
  if (def.lockDoor) return hasKey(meta.lock || 'bronze');
  if (def.houseDoor) return houseDoorOpens(x, y, z);
  return !!def.toggle;
}

// Tiles the player can walk onto or through by opening a door (creatures aside).
// After attacking a player - with a white skull, or for a minute after any attack -
// you can't step into a protection zone (temples, depots): your victims can flee there.
// With a white skull, the town's buildings (shops, inns, houses: its shelters) stay shut
// too. Towers, crypts and other places out in the wilds are open to anyone. A red skull
// doesn't shut anything (it makes you fair game, and costs all you carry when you die).
const pzLocked = p => p.skullUntil > now || p.pzLockUntil > now;
function barred(p, x, y) {
  if (pzLocked(p) && map.isProtected(x, y, p.z) && !map.isProtected(p.x, p.y, p.z)) return 'You may not enter a protection zone after attacking another player.';
  if (p.skullUntil > now && map.isShelter(x, y, p.z) && !map.isShelter(p.x, p.y, p.z)) return 'Nobody lets you in with a white skull.';
  return null;
}
function skullBlocks(p, x, y) {
  const why = barred(p, x, y);
  if (!why) return false;
  if (p === player && now - player.lastNotPossible > 1500) {
    player.lastNotPossible = now;
    log(why, 'damage');
  }
  return true;
}

function playerCanEnter(x, y, z) {
  if (barred(player, x, y)) return false;
  if (map.isWalkable(x, y, z)) return !magicWallAt(x, y, z);
  const t = map.get(x, y, z);
  if (!t || !t.ground || THINGS[t.ground].block) return false;
  const blockers = t.items.filter(id => THINGS[id].block);
  return blockers.length === 1 && doorOpenable(blockers[0], x, y, z);
}

// Pass-through doors (quest and level doors) stay closed; you just walk through them.
function passThroughDoor(x, y, z) {
  const t = map.get(x, y, z);
  const id = t && t.items.find(i => THINGS[i].questDoor || THINGS[i].levelDoor);
  return !!id && doorOpenable(id, x, y, z) && t.items.filter(i => THINGS[i].block).length === 1;
}

// Bumping into a door: open it if you may, or say why not. Returns true if it was a door.
function bumpDoor(x, y, z) {
  const t = map.get(x, y, z);
  if (!t) return false;
  const i = t.items.findIndex(id => THINGS[id].block && (THINGS[id].toggle || THINGS[id].lockDoor || THINGS[id].questDoor || THINGS[id].levelDoor));
  if (i < 0) return false;
  const id = t.items[i], def = THINGS[id], meta = map.getMeta(x, y, z) || {};
  if (def.questDoor || def.levelDoor) {
    if (doorOpenable(id, x, y, z)) return false; // walk through
    log(def.levelDoor ? `Only adventurers of level ${meta.level} or higher may pass.` : 'The door is sealed. It will not open for you.');
    return true;
  }
  if (def.lockDoor) {
    if (!hasKey(meta.lock || 'bronze')) {
      log('It is locked.');
      return true;
    }
    if (def.opensTo) { // a gate: the key turns, it swings open, and a minute later it shuts and locks again
      changeTileFor(x, y, z, id, def.opensTo, 60000);
      addSound('door', x, y, z);
      return log('The key turns in the rusted lock, and the gate swings open.'), true;
    }
    t.items[i] = 'door';
    map.setMeta(x, y, z, { ...meta, lock: meta.lock || 'bronze', relock: true }); // it locks again when it's closed
    log('You unlock the door.');
  } else if (def.houseDoor) {
    const h = map.houseAt(x, y, z);
    if (!houseDoorOpens(x, y, z)) {
      log(h ? `${h.name} is ${h.owner ? 'rented by someone else' : 'for rent. Ask a landlord'}.` : 'It is locked.');
      return true;
    }
    t.items[i] = def.toggle;
  } else {
    t.items[i] = def.toggle;
  }
  addSound('door', x, y, z);
  mapChanged(x, y, z);
  return true;
}

// ---- movement ----------------------------------------------------------------------
// Walking as in Tibia: everyone has a speed (players 220 at level 1 and 2 more each level; monsters their own,
// so at a low level a wolf is quicker than you), and a step takes 1000 x the ground's speed / your speed in ms
// (see GROUND_SPEED), three times as long on a diagonal, rounded up to whole ticks of 50 ms.
// A new character walks as quickly as a level 20 one used to (240 + 2 a level from 1): 278, and 2 more each level
const PLAYER_SPEED = 278;
function speedOf(c) {
  let speed = c.type === 'player' ? PLAYER_SPEED + 2 * (c.level - 1) : c.def.speed || 150; // NPCs stroll
  if (c.type === 'player' && c.equipment.feet && ITEMS[c.equipment.feet.id]) speed += ITEMS[c.equipment.feet.id].speed || 0; // (featherstep boots)
  const cond = c.conditions || {};
  if (cond.paralyze) speed /= CONDITIONS.paralyze.speed;
  if (cond.haste) speed /= CONDITIONS.haste.speed;
  const ring = c.type === 'player' && c.equipment.ring && ITEMS[c.equipment.ring.id].ring;
  if (ring && ring.speed) speed /= ring.speed;
  return speed;
}
const DIAGONAL_STEP = 2; // a diagonal step takes twice as long: you go straight where you can
function stepTime(c, ground, diagonal) {
  return Math.ceil((1000 * groundSpeed(ground) / speedOf(c)) * (diagonal ? DIAGONAL_STEP : 1) / 50) * 50;
}

// The logical position changes immediately; `walk` animates the sprite from the old tile.
function step(c, dx, dy) {
  if (c.type === 'player' && c.drawingUntil > now) return false; // (drawing a bow for a power or triple shot: rooted to the spot)
  c.dir = dirTo(dx, dy);
  const nx = c.x + dx, ny = c.y + dy;
  const isPlayer = c.type === 'player';
  // (doors, keys and houses are checked for the acting player: another player's step is taken as them)
  if (isPlayer && c !== player) return asPlayer(c, () => step(c, dx, dy));
  if (isPlayer && skullBlocks(c, nx, ny)) return false;
  if (isPlayer && !creatureAt(nx, ny, c.z) && bumpDoor(nx, ny, c.z)) return false;
  const push = isPlayer && !creatureAt(nx, ny, c.z) && pushBoulder(nx, ny, c.z, dx, dy);
  if (push === 'stuck') return false;
  if (push) { // you push it: your step is spent on it, where you stand
    c.walk = { fromX: c.x, fromY: c.y, start: now, dur: stepTime(c, (map.get(c.x, c.y, c.z) || {}).ground, false) * 2 };
    return true;
  }
  const free = isFree(nx, ny, c.z) || (isPlayer && passThroughDoor(nx, ny, c.z) && !creatureAt(nx, ny, c.z));
  if (!free) return false;
  if (!isPlayer && c.type !== 'npc' && map.isShelter(nx, ny, c.z)) return false; // monsters keep out of temples, shops and inns
  if (!isPlayer && c.type !== 'npc' && !c.raid && map.isTown(nx, ny, c.z) && !map.isTown(c.x, c.y, c.z)) return false; // nor do they come into town
  if (!isPlayer && fieldAt(nx, ny, c.z) && !(c.def.immune || []).includes(FIELDS[fieldAt(nx, ny, c.z).kind].condition)) return false;
  // quicker on roads and floors than on grass, sand, snow or swamp (rides keep their own pace)
  const ground = (map.get(nx, ny, c.z) || {}).ground;
  c.walk = { fromX: c.x, fromY: c.y, start: now, dur: stepTime(c, ground, dx && dy) };
  c.x = nx;
  c.y = ny;
  return true;
}

function visual(c) {
  if (!c.walk) return { x: c.x, y: c.y, frame: 0 };
  const t = Math.max(0, Math.min(1, (now - c.walk.start) / c.walk.dur));
  return {
    x: c.walk.fromX + (c.x - c.walk.fromX) * t,
    y: c.walk.fromY + (c.y - c.walk.fromY) * t,
    // a walk in four beats over two steps: a stride (one leg ahead, then the other on the next step), the legs passing
    frame: t < 0.5 ? ((c.x + c.y) & 1 ? 1 : 2) : 0,
  };
}

// Ends the walk animation once it's done; returns the finished walk, if any.
function finishWalk(c) {
  const w = c.walk;
  if (!w || now < w.start + w.dur) return null;
  c.walk = null;
  return w;
}

function releaseKeys() {
  player.input.held = [];
  player.input.queued = null;
}

// Stairs, ladders and holes: move one floor and land on a free tile next to the
// destination (never on another stair, or you'd bounce straight back).
function changeFloor(dz, dx = 0, dy = 0) {
  const z = player.z + dz;
  const tries = [[0, 0], [dx, dy], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  for (const [ox, oy] of tries) {
    const x = player.x + ox, y = player.y + oy;
    if (isFreeNoStairs(x, y, z)) {
      Object.assign(player, { x, y, z, path: [], action: null, walk: null });
      releaseKeys();
      return true;
    }
  }
  log(dz > 0 ? 'There is no way up here.' : 'There is no way down here.');
  return false;
}

// Where you wake up: the starter island's temple, or the temple of the town you're a citizen of.
const homePos = () => (player.home === 'start' ? map.start : map.temples.find(t => t.home === player.home) || map.mainStart);
const homeTown = () => (player.home === 'start' ? 'Oakvale' : (map.temples.find(t => t.home === player.home) || { town: mainlandOpen() ? 'Valoria' : 'Oakvale' }).town);
// Is there a mainland to sail on to? Only once the map has a mainStart of its own (the beginners' island comes
// first: until the mainland is built, mainStart is the start, and the oracle's new vocations stay to defend Oakvale).
const mainlandOpen = () => !!map.mainStart && (map.mainStart.x !== map.start.x || map.mainStart.y !== map.start.y || map.mainStart.z !== map.start.z);

function teleport(pos) {
  const p = findFreeTile(pos.x, pos.y, pos.z, 6) || pos;
  Object.assign(player, { x: p.x, y: p.y, z: pos.z, walk: null, path: [], action: null, target: null, openPile: null });
  releaseKeys();
  uiDirty();
}

// ---- rides: a cab, a balloon or Dom takes you somewhere --------------------------------
// The ride comes to pick you up, then takes you there tile by tile - everyone sees
// you go by - and you can't do anything else on the way. Cabs and Dom drive over
// land (Dom three times as fast, for three times the gold); a balloon flies
// straight there, over water too.
const RIDES = {
  cab: { name: 'Hoofer cab', perTile: 1, min: 10, step: 150, land: true, pickup: 2000 },
  balloon: { name: 'balloon', perTile: 2, min: 20, step: 180, land: false, pickup: 2400 },
  dom: { name: 'Dom', perTile: 3, min: 30, step: 50, land: true, pickup: 3200, launch: 900 }, // a wheelie before he races off
  cart: { name: 'mine cart', step: 80, pickup: 500 }, // along a track: see startCart
};
const TRACKS = { vault: VAULT_TRACK };

// Hop into a mine cart: it rattles along the track (dropping down floors on the
// way) to its other end - or back, from there.
function startCart(trackId, back) {
  const track = TRACKS[trackId];
  if (!track || player.ride) return false;
  endConversation(true);
  const tiles = trackTiles(back ? [...track].reverse() : track);
  const [x0, y0, z0] = back ? track[track.length - 1] : track[0];
  if (player.z !== z0 || dist(player, { x: x0, y: y0 }) > 10) return false;
  Object.assign(player, { path: [], action: null, target: null });
  releaseKeys();
  teleport({ x: x0, y: y0, z: z0 });
  player.ride = { kind: 'cart', path: tiles, i: 0, at: now + RIDES.cart.pickup, boarded: false, start: 0 };
  log(back ? 'Hold on tight!' : 'You climb into the cart. "Hands inside, please. Or don\'t."');
  return true;
}

// The landmass a surface tile belongs to: cabs don't cross water. Worked out once per map.
let landmasses = null;
function landmassAt(x, y) {
  if (!landmasses || landmasses.map !== map) {
    const { width: W, height: H } = map, floor = map.floors[map.surfaceZ], ids = new Int32Array(W * H);
    const land = i => floor[i] && floor[i].ground && !THINGS[floor[i].ground].block;
    let next = 0;
    for (let i = 0; i < W * H; i++) {
      if (ids[i] || !land(i)) continue;
      ids[i] = ++next;
      const todo = [i];
      while (todo.length) {
        const j = todo.pop(), x0 = j % W, y0 = (j - x0) / W;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x0 + dx, ny = y0 + dy, k = ny * W + nx;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && !ids[k] && land(k)) {
            ids[k] = next;
            todo.push(k);
          }
        }
      }
    }
    landmasses = { map, ids };
  }
  return map.inBounds(x, y, map.surfaceZ) ? landmasses.ids[y * map.width + x] : 0;
}

function rideCost(kind, from, to) {
  return Math.max(RIDES[kind].min, Math.round(Math.hypot(to.x - from.x, to.y - from.y) * RIDES[kind].perTile));
}

// The tiles a ride goes through: a road over land, or a straight line through the air.
function ridePath(kind, from, to) {
  if (RIDES[kind].land) {
    if (landmassAt(to.x, to.y) !== landmassAt(from.x, from.y)) return null;
    return findPath((x, y) => map.isWalkable(x, y, map.surfaceZ), from.x, from.y, to.x, to.y, { maxNodes: 120000 });
  }
  const path = [], n = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  for (let i = 1; i <= n; i++) path.push([Math.round(from.x + ((to.x - from.x) * i) / n), Math.round(from.y + ((to.y - from.y) * i) / n)]);
  return path;
}

function orderRide(x, y, kind = 'cab') {
  const ride = ['cab', 'balloon', 'dom'].includes(kind) ? RIDES[kind] : null; // a cart only runs on its track
  if (!ride || player.dead || player.ride || !Number.isFinite(x) || !Number.isFinite(y)) return;
  const S = map.surfaceZ, outdoors = p => p.z === S && !map.get(p.x, p.y, S + 1);
  if (!outdoors(player)) return log(`A ${ride.name} can only pick you up outdoors.`);
  if (pzLocked(player)) return log('Nobody gives a ride to someone who has just attacked a player!'); // a white skull, or a fight; a red skull alone is fine
  const to = findFreeTile(Math.floor(x), Math.floor(y), S, 3);
  if (!to || !outdoors({ ...to, z: S })) return log(`A ${ride.name} cannot take you there.`);
  if (isleBars(to)) return log(isleBars(to));
  const cost = rideCost(kind, player, to);
  if (player.gold < cost) return log(`That ride costs ${cost} gold, and you do not have that much.`);
  const path = ridePath(kind, player, to);
  if (!path || !path.length) return log(ride.land ? 'There is no way there over land. A balloon could fly you there.' : 'You are already there.');
  endConversation(true);
  player.gold -= cost;
  player.ride = { kind, path, i: 0, at: now + ride.pickup, boarded: false, start: 0, say: kind === 'dom' ? now + 1300 : 0 };
  Object.assign(player, { path: [], action: null, target: null });
  releaseKeys();
  // it drives (or floats) up in 1.5 s, then waits for you to get in
  effects.push({ kind: 'vehicle', vehicle: kind, x: player.x, y: player.y, z: S, from: -1, to: 0, start: now, dur: ride.pickup, travel: 1500 });
  log({
    cab: `You ordered a Hoofer cab for ${cost} gold. It is on its way!`,
    balloon: `You ordered a balloon for ${cost} gold. Look up!`,
    dom: `You called Dom for ${cost} gold. You hear a supercharger screaming in the distance...`,
  }[kind]);
  uiDirty();
}

// What other players need to know about a ride (not the whole path).
function rideView(r) {
  return r && { kind: r.kind, boarded: r.boarded, start: r.start };
}

function updateRide() {
  const ride = player.ride, kind = RIDES[ride.kind];
  if (!ride.boarded) {
    if (ride.say && now >= ride.say) {
      ride.say = 0;
      effects.push({ kind: 'speech', x: player.x, y: player.y, z: player.z, name: 'Dom', text: 'Get in. We do it all for family.', start: now, dur: 2600 });
    }
    if (now < ride.at) return;
    Object.assign(ride, { boarded: true, start: now, at: now + (kind.launch || 0) });
  }
  while (now >= ride.at && ride.i < ride.path.length) {
    const [x, y, z = player.z] = ride.path[ride.i++];
    player.dir = dirTo(x - player.x, y - player.y);
    player.walk = z === player.z ? { fromX: player.x, fromY: player.y, start: ride.at, dur: kind.step } : null;
    Object.assign(player, { x, y, z });
    ride.at += kind.step;
  }
  if (ride.i < ride.path.length || now < ride.at) return;
  Object.assign(player, { ride: null, walk: null, path: [], action: null }); // whatever you clicked on the way is far behind
  effects.push({ kind: 'vehicle', vehicle: ride.kind, x: player.x, y: player.y, z: player.z, from: 0, to: 1, start: now, dur: 1400 });
  log({
    cab: '"Here we are! Thank you for riding with Hoofer."', balloon: 'The balloon touches down gently.',
    dom: '"Ride or die." Dom roars off in a cloud of tyre smoke.', cart: 'The cart screeches to a halt.',
  }[ride.kind]);
  uiDirty();
}

// ---- using things on the map --------------------------------------------------------
// Right-click / "use": doors, levers, chests, ladders, corpses, signs, depots, bookshelves,
// your own furniture. Returns false if there is nothing to use there.
function useThing(x, y, z) {
  const pile = pileAt(x, y, z);
  if (pile) {
    player.openPile = pile;
    uiDirty();
    return true;
  }
  const t = map.get(x, y, z);
  if (!t) return false;
  const meta = map.getMeta(x, y, z) || {};
  for (let i = t.items.length - 1; i >= 0; i--) {
    const id = t.items[i], def = THINGS[id];
    if (def.chronicle) return chronicleRead(+meta.page || 1), true;
    if (def.readable && meta.plaque) return showText(capitalize(def.name), bellPlaque(meta.text || '')), true;
    if (def.readable) return showText(capitalize(def.name), meta.text || 'It is blank.'), true;
    if (def.lever && meta.puzzle) return puzzleLever(x, y, z, i, meta), true;
    if (def.lever) return pullLever(x, y, z, i, meta), true;
    if (def.depot) {
      playerEvent('openContainer', { root: 'depot', path: [], title: 'Depot' });
      return true;
    }
    if (def.bookshelf) { // (Oakvale's own books on the starter island; the old world's elsewhere)
      const books = map.isle && onIsle({ x, y }) ? OAKVALE_LORE : LORE;
      return showText('Bookshelf', books[(x * 7 + y * 13) % books.length]), true;
    }
    if (def.toggle || def.lockDoor || def.questDoor || def.levelDoor) {
      if (def.block) return bumpDoor(x, y, z), true;
      if (creatureAt(x, y, z)) return log('Someone is standing in the doorway.'), true;
      if (def.houseDoor && !houseDoorOpens(x, y, z)) return true;
      t.items[i] = def.toggle === 'door_closed' && meta.relock ? 'door_locked' : def.toggle;
      addSound('door', x, y, z);
      mapChanged(x, y, z);
      return true;
    }
    if (def.fireSwap) return swapFire(x, y, z, i), true;
    if (def.deed) return questDeed(def.deed, def.deedAs || id, x, y, z), true;
    if (def.pickFind) return log(`${capitalize(def.name)}. A pick could break a piece off.`), true;
    if (def.chest) return openChest(def.chest, { x, y, z }), true;
    if (def.rescue) return rescueAt(def.rescue, id), true;
    if (def.bell) return ringBell(x, y, z), true;
    if (def.trainer) return startTraining(x, y, z), true;
    if (def.cache) return openChest({ flag: `cache:${x},${y},${z}`, ...(map.getMeta(x, y, z) || {}) }), true;
    if (def.change) {
      // Climb (or go down) from where you stand, as if you stepped onto it.
      const from = { x: player.x, y: player.y };
      Object.assign(player, { x, y });
      if (!changeFloor(def.change, x - from.x, y - from.y)) Object.assign(player, from);
      return true;
    }
    if (def.ropeSpot) return log('You need a rope to climb up here.'), true;
    if (def.push) return log('A heavy boulder. Walk into it to push it.'), true;
    if (meta.ropeDown) return log('It is a long way down. With a rope you could climb down.'), true;
    if (def.digSpot) return log('You could dig here with a shovel.'), true;
    if (def.breakable) return log('A pick could break this rock.'), true;
    if (def.oreVein) return log('Ore glitters in the rock. Use a pick on it to mine it.'), true;
    if (def.burnable) return log('Thick, sticky web. Fire would burn it: a torch, or the Torchlight spell ("lumen") cast next to it.'), true;
    if (def.teleport) return log('A magic forcefield. Step into it to travel.'), true;
    if (player.furniture.some(f => f.x === x && f.y === y && f.z === z && f.id === id)) return packFurniture(x, y, z, i), true;
    if (['chest', 'barrel', 'crate'].includes(id)) return log(`The ${def.name} is empty.`), true;
  }
  if (t.ground === 'water') return log('You could fish here with a fishing rod.'), true;
  return false;
}

// The bell of Oakvale rings out: everyone in the world hears it, wherever they are. It hums for a while after.
let bellRungAt = -Infinity;
// The bell of Oakvale is the whole world's, not each player's: once anyone brings its clapper home it rings for all.
// ringers: who brought it home (newest last); first: the first of all, the Bellringer; dawn: the last day it rang in
// the dawn by itself. Online it's kept in server/town.json; playing alone, in your save.
let townBell = { ringers: [], first: null, dawn: -1 };
const bellHung = () => townBell.ringers.length > 0 || questState('bell_4') === 'done';
// The bell was rung home by someone else, and you haven't yet: for you its clapper was stolen again, and the story
// starts over. A quest's texts (or a step's) may have such a variant in again: { key: text }; $ringer is the first
// Bellringer.
const bellAgain = () => !!townBell.first && questState('bell_4') !== 'done';
const storyText = (o, key) => {
  const s = (bellAgain() && o.again && o.again[key]) || o[key];
  return typeof s === 'string' ? s.replace(/\$ringer/g, townBell.first || '') : s;
};

// The clapper is home (The Silent Bell IV): your name on the plaque, and the first of all is the Bellringer
function bellRestored() {
  const first = !townBell.first;
  if (first) townBell.first = player.name;
  townBell.ringers = [...townBell.ringers.filter(n => n !== player.name), player.name].slice(-40);
  player.chests.bell_ringer = true;
  if (first) {
    player.chests.bellringer = true; // (the title: the first to ring it)
    for (const p of players) asPlayer(p, () => {
      log(`${townBell.first} has brought the bell of Oakvale back to life: the first Bellringer of the isle!`, 'level');
      playerEvent('banner', { message: `${townBell.first} is the first Bellringer of Oakvale!` });
    });
  }
}

// A save from before the shared bell: who brought the clapper home goes on the plaque all the same (and is the
// Bellringer, if nobody is yet), so the bell rings at dawn for them too
function rememberBellRinger() {
  if (questState('bell_4') !== 'done' || !player.name || townBell.ringers.includes(player.name)) return;
  if (!townBell.first) { townBell.first = player.name; player.chests.bellringer = true; }
  townBell.ringers = [player.name, ...townBell.ringers].slice(-40); // (they rang it before those on the plaque now)
  player.chests.bell_ringer = true;
}

// The plaque in the bell tower: who rang the bell home
function bellPlaque(text) {
  if (!townBell.ringers.length) return `${text}\n\n(Below it, a bronze plaque, still blank.)`;
  const names = townBell.ringers.filter(n => n !== townBell.first);
  return `${text}\n\nThe bell was rung home by ${townBell.first}, the first Bellringer${names.length ? `, and after: ${names.slice(-12).reverse().join(', ')}` : ''}.`;
}

// Every dawn (six in the morning, the world's clock) the bell rings by itself, once it hangs again
function updateTownBell() {
  if (!townBell.ringers.length) return;
  const day = Math.floor(((now / 1000) + 9 * 60) / 1440), hour = worldMinutes() / 60;
  if (hour >= 6 && hour < 7 && townBell.dawn !== day) {
    townBell.dawn = day;
    ringTownBell('Dong... dong... dong... The bell of Oakvale rings in the dawn, as it did in the founders\' day.');
  }
}
function ringTownBell(text = 'Dong... dong... dong... The bell of Oakvale rings out over the isle.') {
  bellRungAt = now;
  for (const p of players) asPlayer(p, () => { addSound('bell', p.x, p.y, p.z); log(text, 'quest'); });
}

// The level at which the oracle lets you choose a vocation (and, once there is one, sends you to the mainland).
const vocationLevel = () => 10;

// Using the bell in the bell tower: silent until its clapper is back (The Silent Bell), then anyone may ring it.
function ringBell(x, y, z) {
  if (!bellHung()) return log('The great bell hangs silent. Someone has cut its rope, and its clapper is gone.');
  if (now - bellRungAt < 30000) return log('The bell is still humming. Let it rest a moment.');
  ringTownBell(`Dong... dong... dong... ${player.name} rings the bell of Oakvale, and the whole isle hears it.`);
  // the farewell (The Silent Bell VI): ringing it yourself, the town looks up and waves
  const st = questState('bell_6') === 'active' && questStep('bell_6');
  if (st && st.thing === 'bell') {
    for (const n of npcs) if (n.z === map.surfaceZ && map.isTown(n.x, n.y, n.z) && FAREWELLS[n.npcId]) addSpeech(n, FAREWELLS[n.npcId], true);
    if (st.done) log(storyText(st, 'done'), 'quest');
    advanceQuest('bell_6');
  }
}

// What the people of Oakvale call up to the tower when you ring the bell to say farewell to your newcomer days
const FAREWELLS = {
  pip: 'Don\'t forget your rope!', oak_baker: 'Bread\'s on me tonight!', oak_smith: 'Keep that blade sharp!',
  oak_armourer: 'Mind the armour, it\'s mine!', oak_innkeeper: 'A round for the hero!', postmaster: 'Well rung!',
  oak_landlady: 'A cottage for a hero?', townsman: 'There goes the hero!', townswoman: 'Bless you, dear!',
  child: 'I\'m going to be just like you!', old_man: 'In my day... oh, go on then!', cat: 'Mrrrow!',
  gate_north: 'Salute!', gate_east: 'Good hunting!', gate_south: 'Well done!', gate_west: 'At ease, hero!',
};

function showText(title, text) {
  playerEvent('read', { title, text });
  log(`${title}: "${text}"`);
}

function pullLever(x, y, z, index, meta) {
  const t = map.get(x, y, z);
  t.items[index] = t.items[index] === 'lever' ? 'lever_on' : 'lever';
  mapChanged(x, y, z);
  addSound('door', x, y, z);
  const to = meta.target;
  if (!to) return log('The lever does not seem to do anything.');
  const target = map.ensure(to.x, to.y, to.z);
  const i = target.items.indexOf('wall_secret');
  if (i >= 0) {
    target.items.splice(i, 1);
    log('You hear stone grinding somewhere nearby.');
  } else if (!creatureAt(to.x, to.y, to.z)) {
    target.items.push('wall_secret');
  }
  mapChanged(to.x, to.y, to.z);
}

// A lever of a puzzle (meta puzzle, order, target): the puzzle's levers must be pulled in their order. Pulled in the
// wrong one, they all spring back with a clank; all of them in the right one, and the bars over the target lift for a
// few minutes, then everything goes back as it was for the next one to try. The levers are the world's: online,
// whoever pulls them, everyone sees it.
const PUZZLE_OPEN_MS = 3 * 60000;
function puzzleLevers(id) {
  const list = [];
  for (const [k, m] of Object.entries(map.meta)) if (m && m.puzzle === id) { const [x, y, z] = k.split(',').map(Number); list.push({ x, y, z, meta: m }); }
  return list;
}
function puzzleLever(x, y, z, index, meta) {
  const t = map.get(x, y, z);
  if (t.items[index] === 'lever_on') return log('The lever is pulled already. It will not move back by hand.');
  const levers = puzzleLevers(meta.puzzle);
  const pulled = levers.filter(l => (map.get(l.x, l.y, l.z) || { items: [] }).items.includes('lever_on')).length;
  t.items[index] = 'lever_on';
  mapChanged(x, y, z);
  addSound('door', x, y, z);
  if (+meta.order !== pulled + 1) { // the wrong one: everything springs back
    for (const l of levers) {
      const lt = map.get(l.x, l.y, l.z), i = lt ? lt.items.indexOf('lever_on') : -1;
      if (i >= 0) { lt.items[i] = 'lever'; mapChanged(l.x, l.y, l.z); }
    }
    addSound('hit', x, y, z);
    return log('Clank! Somewhere below, chains rattle, and every lever springs back. That was not the right order.');
  }
  if (pulled + 1 < levers.length) return log('The lever locks in place with a heavy clunk. Something below shifts, and waits.');
  const to = meta.target, target = to && map.get(to.x, to.y, to.z);
  if (!target || !target.items.includes('cellar_bars')) return log('The lever locks in place. Nothing more happens: it is open already.');
  changeTileFor(to.x, to.y, to.z, 'cellar_bars', null, PUZZLE_OPEN_MS);
  for (const l of levers) reverts.push({ x: l.x, y: l.y, z: l.z, from: 'lever_on', to: 'lever', at: now + PUZZLE_OPEN_MS }); // (they spring back with it)
  addSound('door', to.x, to.y, to.z);
  log('The last lever locks in place. With a long groan of iron, the rusted grate over the trapdoor swings up.', 'quest');
}

// Boulders (things with push): walk into one, straight on, and it rolls a tile further if there's room there (no
// creature, nothing else, not a floor change). Pushed ones roll back home after a while (when nobody is in the way),
// so the next one through finds them as they were.
const BOULDER_BACK_MS = 10 * 60000;
let boulders = []; // { home: {x, y, z}, at: {x, y, z}, back: when }
function pushBoulder(x, y, z, dx, dy) {
  if (dx && dy) return false; // (only straight on)
  const t = map.get(x, y, z), i = t ? t.items.findIndex(id => THINGS[id].push) : -1;
  if (i < 0) return false;
  const nx = x + dx, ny = y + dy, n = map.get(nx, ny, z);
  if (!n || !map.isWalkable(nx, ny, z) || n.items.length || map.floorChange(nx, ny, z) || creatureAt(nx, ny, z) || pileAt(nx, ny, z)) {
    if (now - (player.lastNotPossible || 0) > 1500) { player.lastNotPossible = now; log('The boulder will not budge that way.'); }
    return 'stuck';
  }
  const id = t.items.splice(i, 1)[0];
  n.items.push(id);
  let b = boulders.find(o => o.at.x === x && o.at.y === y && o.at.z === z);
  if (!b) boulders.push(b = { home: { x, y, z } });
  Object.assign(b, { at: { x: nx, y: ny, z }, back: now + BOULDER_BACK_MS });
  if (b.at.x === b.home.x && b.at.y === b.home.y) boulders = boulders.filter(o => o !== b);
  addSound('hit', nx, ny, z);
  mapChanged(x, y, z);
  mapChanged(nx, ny, z);
  return true;
}
function updateBoulders() {
  for (const b of boulders) {
    if (now < b.back) continue;
    const { home, at } = b, h = map.get(home.x, home.y, home.z), a = map.get(at.x, at.y, at.z);
    const i = a ? a.items.findIndex(id => THINGS[id].push) : -1;
    if (i < 0) { b.done = true; continue; }
    if (!h || h.items.some(id => THINGS[id].block) || creatureAt(home.x, home.y, home.z)) { b.back = now + 30000; continue; }
    h.items.push(a.items.splice(i, 1)[0]);
    b.done = true;
    mapChanged(at.x, at.y, at.z);
    mapChanged(home.x, home.y, home.z);
  }
  if (boulders.some(b => b.done)) boulders = boulders.filter(b => !b.done);
}

// Put a fire out, or light it again. One that was put out lights itself again after a
// while (someone comes by with a light), so towns don't stay dark.
function swapFire(x, y, z, i) {
  const t = map.get(x, y, z), id = t.items[i], to = THINGS[id].fireSwap;
  const pending = reverts.findIndex(r => r.x === x && r.y === y && r.z === z && r.from === id);
  if (pending >= 0) { // lit again by hand
    reverts.splice(pending, 1);
    t.items[i] = to;
    mapChanged(x, y, z);
  } else changeTileFor(x, y, z, id, to, 10 * 60000);
  addSound(THINGS[to].light ? 'ignite' : 'douse', x, y, z);
  addBurst(x, y, z, THINGS[to].light ? '#ff7a1a' : '#9cf');
}

// Temporarily change a tile, e.g. a dug hole that fills up again.
function changeTileFor(x, y, z, remove, add, ms) {
  const t = map.get(x, y, z);
  const i = t.items.indexOf(remove);
  if (i < 0) return;
  if (add) t.items[i] = add;
  else t.items.splice(i, 1);
  reverts.push({ x, y, z, from: add, to: remove, at: now + ms });
  mapChanged(x, y, z);
}

function updateReverts() {
  if (boulders.length) updateBoulders();
  for (let i = reverts.length - 1; i >= 0; i--) {
    const r = reverts[i];
    if (now < r.at || creatureAt(r.x, r.y, r.z)) continue;
    const t = map.ensure(r.x, r.y, r.z);
    const j = r.from ? t.items.indexOf(r.from) : -1;
    if (j >= 0) t.items[j] = r.to;
    else t.items.push(r.to);
    reverts.splice(i, 1);
    mapChanged(r.x, r.y, r.z);
  }
}

// Digging with a shovel where the sand lies loose (buried): whatever the sea buried there, then the hole fills in again
// with the tides. A spot a quest's riddle points to (meta dig: the quest, thing: its step) has nothing to show for it:
// only whoever is on that step finds what lies there (a lost find is there again while the quest still needs it).
const DIG_FINDS = [ // [chance, item, min, max, what it says]; else only sand
  [0.25, 'seashell', 1, 2, 'a seashell'], [0.2, 'gold', 3, 12, 'a few old coins'], [0.08, 'health_potion', 1, 1, 'an old corked bottle: a health potion, still good'],
  [0.04, 'bottle_message', 1, 1, 'a bottle with a letter in it'], [0.03, 'pearl', 1, 1, 'a pearl, the size of a pea'],
];
function digUp(x, y, z) {
  const meta = map.getMeta(x, y, z) || {};
  addBurst(x, y, z, '#d8c890');
  if (meta.dig) {
    const q = meta.dig, st = questState(q) === 'active' && questStep(q);
    if (st && st.thing === meta.thing) return questDeed(q, meta.thing, x, y, z);
    const lost = questState(q) === 'active' && (QUESTS[q].steps || []).find(s => s.thing === meta.thing && s.give);
    if (lost && lost.give.some(([id]) => !countItem(id))) {
      for (const [id, n] of lost.give) if (!countItem(id)) giveItem(id, n);
      return log('You dig in the same place again. Deeper down, wrapped in oilcloth: what you lost, or one just like it.', 'quest');
    }
    if (!(map.get(x, y, z) || { items: [] }).items.includes('buried')) return log('You dig a little, but find only sand.');
  }
  changeTileFor(x, y, z, 'buried', 'dug_sand', 20 * 60000);
  let roll = Math.random();
  for (const [chance, id, lo, hi, said] of DIG_FINDS) {
    if ((roll -= chance) >= 0) continue;
    if (id === 'gold') addItem('gold', randInt(lo, hi)); else giveItem(id, randInt(lo, hi));
    return log(`You dig in the loose sand and find ${said}.`);
  }
  log('You dig in the loose sand, but find only wet sand and a crab\'s old shell.');
}

// A thing in the world that a quest's step is done at (step.thing: its id): the lamp of the lighthouse, a spot to dig.
// step.needs: what it takes there (used up); step.give: what you get there. Anyone else: what it says (idle).
function questDeed(questId, thingId, x, y, z) {
  const st = questState(questId) === 'active' && questStep(questId);
  if (!st || st.thing !== thingId) {
    const here = (map.get(x, y, z) || { items: [] }).items.find(id => THINGS[id].idle);
    return log((here && THINGS[here].idle) || 'Nothing happens.');
  }
  const missing = (st.needs || []).filter(([id, n]) => countItem(id) < n);
  if (missing.length) return log(`${st.missing ? `${st.missing} ` : ''}You still need ${missing.map(([id, n]) => itemName(id, n - countItem(id))).join(', ')}.`, 'quest');
  for (const [id, n] of st.needs || []) removeItem(id, n);
  if (st.done) log(storyText(st, 'done'), 'quest');
  for (const [id, n] of st.give || []) giveItem(id, n);
  // (a lamp: it burns for a while, for everyone to see; lit already, it burns on)
  if (THINGS[`${thingId}_lit`] && (map.get(x, y, z) || { items: [] }).items.includes(thingId)) changeTileFor(x, y, z, thingId, `${thingId}_lit`, 15 * 60000);
  addSparkle(player, '#ffe080');
  advanceQuest(questId);
}

// "Use with": a rune, tool, key or furniture kit used on a tile or creature.
// (arrived: walked there for it already, see below)
function useItemOn(ref, x, y, z, arrived) {
  const found = resolve(ref);
  if (!found || !found.item) return;
  const item = found.item, def = ITEMS[item.id];
  if (z !== player.z) return log('You cannot reach that.');
  if (!Number.isInteger(x) || !Number.isInteger(y)) return;
  // a tool, key or kit used on a spot further off: you walk there first, and use it when you arrive (walking away
  // yourself calls it off); a fishing rod reaches 5 tiles, the rest the tile next to you
  const fishing = def.tool === 'fishing', reach = fishing ? 5 : 1;
  const far = (def.tool || def.key || def.kit) && (dist(player, { x, y }) > reach || (fishing && !sightClear(player, { x, y, z })));
  if (far && !arrived && !player.ride) return interact({ kind: 'useWith', ref, item: item.id, x, y, z, range: reach });
  if (def.rune) return castRune(ref, x, y, z);
  if (def.use) return useItem(ref);
  if (def.key) return useKeyOn(x, y, z);
  if (def.kit) return placeFurniture(ref, x, y, z);
  if (def.tool) return useTool(def.tool, x, y, z);
  log('You cannot use this object on that.');
}

function useTool(tool, x, y, z) {
  const t = map.get(x, y, z), near = dist(player, { x, y }) <= 1;
  if (tool === 'fishing') {
    if (!t || t.ground !== 'water') return log('You can only fish in water.');
    if (dist(player, { x, y }) > 5 || !sightClear(player, { x, y, z })) return log('That is too far away.');
    if (now < player.useReady) return;
    player.useReady = now + 1000;
    addBurst(x, y, z, '#9cc0ee');
    const roll = Math.random();
    if (roll < 0.25) { giveItem('fish', 1); log('You caught a fish!'); }
    else if (roll < 0.28) { giveItem('old_boot', 1); log('You fished up an old boot.'); }
    else if (roll < 0.29) { giveItem('pearl', 1); log('You fished up a fat old oyster - and in it, a pearl!'); }
    else if (roll < 0.297) { giveItem('bottle_message', 1); log('You fished up a corked bottle with a letter in it.'); }
    return;
  }
  if (!near) return log('You need to stand next to it.');
  if (tool === 'torch') return burnThing(x, y, z) || log('There is nothing here that would burn.');
  if (tool === 'rope') {
    if (t && (map.getMeta(x, y, z) || {}).ropeDown) { // (a well: tie the rope on and climb down)
      const from = { x: player.x, y: player.y };
      Object.assign(player, { x, y });
      if (changeFloor(-1)) log('You tie your rope to the well and climb down into the dark.');
      else Object.assign(player, from);
      return;
    }
    if (!t || !t.items.some(id => THINGS[id].ropeSpot)) return log('There is nothing to climb up to here.');
    const from = { x: player.x, y: player.y };
    Object.assign(player, { x, y });
    if (!changeFloor(1)) Object.assign(player, from);
    return;
  }
  if (tool === 'shovel') {
    if (t && (t.items.includes('buried') || (map.getMeta(x, y, z) || {}).dig)) return digUp(x, y, z);
    if (!t || !t.items.includes('loose_sand')) return taleDeed('dig', `${x},${y},${z}`) || log('There is nothing to dig here.');
    changeTileFor(x, y, z, 'loose_sand', 'hole', 60000);
    log('You dig a hole.');
    return;
  }
  if (tool === 'pick') {
    if (t && t.items.includes('ore_vein')) return mineVein(x, y, z);
    const seam = t && t.items.find(id => THINGS[id].pickFind);
    if (seam) { addBurst(x, y, z, '#9a9aa0'); addSound('hit', x, y, z); return openChest(THINGS[seam].pickFind); } // (a piece broken off: once each)
    if (!t || !t.items.includes('cracked_rock')) return taleDeed('pick', `${x},${y},${z}`) || log('There is nothing to break here.');
    changeTileFor(x, y, z, 'cracked_rock', null, 60000);
    addBurst(x, y, z, '#9a9aa0');
    log('The rock crumbles.');
  }
}

function useKeyOn(x, y, z) {
  const t = map.get(x, y, z);
  if (!t || !t.items.includes('door_locked') || dist(player, { x, y }) > 1) return log('There is no lock here.');
  bumpDoor(x, y, z);
}

// ---- houses ------------------------------------------------------------------------
function placeFurniture(ref, x, y, z) {
  const found = resolve(ref), id = ITEMS[found.item.id].kit;
  if (!ownsHouseAt(x, y, z)) return log('You can only set up furniture inside your own house.');
  if (dist(player, { x, y }) > 1) return log('You need to stand next to that spot.');
  const t = map.get(x, y, z);
  if (!isFree(x, y, z) || t.items.length) return log('There is no room for it there.');
  takeFrom(ref, 1);
  map.addItem(x, y, z, id);
  player.furniture.push({ x, y, z, id });
  mapChanged(x, y, z);
  log(`You set up ${withArticle(THINGS[id].name)}.`);
}

// Using your own furniture packs it back up into a kit.
function packFurniture(x, y, z, index) {
  const id = map.get(x, y, z).items[index];
  const kit = Object.keys(ITEMS).find(k => ITEMS[k].kit === id);
  map.get(x, y, z).items.splice(index, 1);
  player.furniture = player.furniture.filter(f => !(f.x === x && f.y === y && f.z === z && f.id === id));
  mapChanged(x, y, z);
  if (kit) giveItem(kit, 1);
  log(`You pack up the ${THINGS[id].name}.`);
}

function rentHouse(house) {
  player.house = house.id;
  house.owner = player.name;
  log(`You now rent ${house.name}. Its door opens for you.`);
  uiDirty();
}

function leaveHouse() {
  const house = map.houses.find(h => h.id === player.house);
  if (!house) return;
  for (const f of player.furniture) {
    const t = map.get(f.x, f.y, f.z), i = t ? t.items.indexOf(f.id) : -1;
    if (i >= 0) t.items.splice(i, 1);
    mapChanged(f.x, f.y, f.z);
    const kit = Object.keys(ITEMS).find(k => ITEMS[k].kit === f.id);
    if (kit) player.depot.contents.push(makeItem(kit));
  }
  player.furniture = [];
  for (const pile of piles.filter(pl => pl.house === house.id)) {
    player.depot.contents.push(...pile.items);
    removePile(pile);
  }
  player.house = null;
  house.owner = null;
  log(`You moved out of ${house.name}. Your furniture and things are in your depot.`);
}

// ---- items: containers, references and weight -------------------------------------------
// An item is { id, count } (+ contents for bags, time for rings). Item references
// point into the player's things: { root: 'equip', slot } | { root: 'bag' | 'depot', path }
// | { root: 'pile', pileId, path }, where path is a list of indexes into nested contents.
// Map things (barrels, furniture) are { root: 'map', x, y, z }; a tile is { root: 'ground', x, y, z }.

const bag = () => player.equipment.backpack;
const capacityOf = c => (c.depot ? 40 : c.pile ? Infinity : ITEMS[c.id].container);

// Only what is within reach: a pile next to you, and the depot while you stand at a locker.
const withinReach = o => o.z === player.z && dist(o, player) <= 1;
function atDepot() {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const t = map.get(player.x + dx, player.y + dy, player.z);
    if (t && t.items.some(id => THINGS[id].depot)) return true;
  }
  return false;
}

function rootContainer(ref) {
  if (ref.root === 'bag') return bag();
  if (ref.root === 'depot') return atDepot() ? player.depot : null;
  if (ref.root === 'pile') {
    const pile = piles.find(p => p.id === ref.pileId);
    return pile && withinReach(pile) ? { pile: true, contents: pile.items } : null;
  }
  return null;
}

// The container a path leads to (each index must point at a bag inside the previous one).
function containerAt(ref, path = ref.path) {
  let c = rootContainer(ref);
  for (const i of path || []) {
    c = c && c.contents[i];
    if (!c || !c.contents) return null;
  }
  return c;
}

// { container, index, item } for a reference to one item (or { slot, item } for equipment).
function resolve(ref) {
  if (!ref) return null;
  if (ref.root === 'equip') return { slot: ref.slot, item: player.equipment[ref.slot] };
  if (!ref.path || !ref.path.length) return null;
  const container = containerAt(ref, ref.path.slice(0, -1));
  if (!container) return null;
  const index = ref.path[ref.path.length - 1];
  return { container, index, item: container.contents[index] || null };
}

// Remove count items at ref and return them as a new item (splits stacks).
function takeFrom(ref, count) {
  const found = resolve(ref);
  const item = found.item;
  count = Math.min(Math.floor(count) || item.count, item.count);
  if (ref.root === 'equip' && count >= item.count) {
    player.equipment[ref.slot] = null;
    uiDirty();
    return item;
  }
  if (count >= item.count) {
    found.container.contents.splice(found.index, 1);
    if (ref.root === 'pile') cleanupPile(ref.pileId);
    uiDirty();
    return item;
  }
  item.count -= count;
  uiDirty();
  return { ...makeItem(item.id, count), ...(item.time ? { time: item.time } : {}) };
}

function itemWeight(item) {
  const w = (ITEMS[item.id].weight || 0) * item.count;
  return w + (item.contents || []).reduce((s, it) => s + itemWeight(it), 0);
}
const carriedWeight = () => SLOTS.reduce((s, slot) => s + (player.equipment[slot] ? itemWeight(player.equipment[slot]) : 0), 0);
const capacity = () => 400 + player.level * VOCATIONS[player.vocation].cap;
const freeCapacity = () => Math.round((capacity() - carriedWeight()) * 10) / 10;

// All items inside the bag, including inside bags in the bag.
function bagItems(c = bag()) {
  const out = [];
  if (!c) return out;
  for (const it of c.contents) {
    out.push(it);
    if (it.contents) out.push(...bagItems(it));
  }
  return out;
}
const countItem = id => bagItems().filter(i => i.id === id).reduce((n, i) => n + i.count, 0);

// Put an item into one container: stacks first, then a free slot. Returns what didn't fit.
function putInto(c, item) {
  if (ITEMS[item.id].stack) {
    for (const it of c.contents) {
      if (it.id !== item.id || it.count >= MAX_STACK || item.count <= 0) continue;
      const n = Math.min(item.count, MAX_STACK - it.count);
      it.count += n;
      item.count -= n;
    }
    if (item.count <= 0) return null;
  }
  while (c.contents.length < capacityOf(c) && item.count > 0) {
    const n = ITEMS[item.id].stack ? Math.min(item.count, MAX_STACK) : item.count;
    c.contents.push({ ...item, count: n });
    item.count -= n;
  }
  return item.count > 0 ? item : null;
}

// Into the bag, or the first bag inside it with room.
function storeInBag(item) {
  if (!bag()) return item;
  let left = putInto(bag(), item);
  for (const inner of bagItems().filter(i => i.contents)) {
    if (!left) break;
    left = putInto(inner, left);
  }
  uiDirty();
  return left;
}

// Adds items to the bag (gold goes to the purse), limited by bag space and capacity.
// Returns how many didn't fit.
function addItem(id, count = 1) {
  if (id === 'gold') {
    player.gold += count;
    uiDirty();
    return 0;
  }
  const w = ITEMS[id].weight || 0;
  const fits = w > 0 ? Math.max(0, Math.floor(freeCapacity() / w + 1e-9)) : count;
  let toAdd = Math.min(count, fits), left = count - toAdd;
  while (toAdd > 0) {
    const n = ITEMS[id].stack ? Math.min(toAdd, MAX_STACK) : 1;
    const rest = storeInBag(makeItem(id, n));
    toAdd -= n;
    if (rest) {
      left += rest.count + toAdd;
      break;
    }
  }
  return left;
}

// Like addItem, but whatever doesn't fit is put on the ground at your feet.
function giveItem(id, count = 1) {
  const left = addItem(id, count);
  if (left > 0) {
    dropToGround(makeItem(id, left), player);
    log(`You can't carry ${itemName(id, left)}: ${left === 1 ? 'it is' : 'they are'} lying at your feet.`);
  }
}

// For testing: makes you a level 100 character of a vocation, with its skills trained high and the best gear it can
// wear (legendary grade, from ITEMS), potions, runes and gold, in a backpack.
const TEST_HERO_LEVEL = 100;
const TEST_HERO_SKILLS = {
  knight: { sword: 95, axe: 95, club: 95, shielding: 90, magic: 9 },
  paladin: { distance: 95, shielding: 80, magic: 25, sword: 40 },
  sorcerer: { magic: 80, shielding: 30 },
  druid: { magic: 80, shielding: 30 },
};
function makeTestHero(vocation) {
  if (!TEST_HERO_SKILLS[vocation]) return false;
  const p = player, v = VOCATIONS[vocation], L = TEST_HERO_LEVEL;
  Object.assign(p, { vocation, promoted: true, level: L, xp: xpForLevel(L), tutorial: 0,
    maxHp: 150 + (L - 1) * v.hp, maxMana: 50 + (L - 1) * v.mana, gold: 100000, bank: 1000000 });
  p.hp = p.maxHp;
  p.mana = p.maxMana;
  for (const [skill, level] of Object.entries(TEST_HERO_SKILLS[vocation])) p.skills[skill] = { level, tries: 0 };
  // the best of each slot that this vocation may wear
  const wearable = d => !d.quest && !d.keeping && (!d.vocations || d.vocations.includes(vocation)) && (d.level || 0) <= L;
  const hit = w => (w.dmg ? (w.dmg[0] + w.dmg[1]) / 2 : w.attack || 0);
  const best = (ok, score) => {
    let top = null, topScore = -Infinity;
    for (const [id, d] of Object.entries(ITEMS)) if (wearable(d) && ok(d) && score(d) > topScore) { top = id; topScore = score(d); }
    return top;
  };
  const kind = vocation === 'knight' ? ['sword', 'axe', 'club'] : vocation === 'paladin' ? ['distance'] : ['wand'];
  const weapon = best(d => d.slot === 'weapon' && d.weapon && kind.includes(d.weapon.type) && !d.weapon.thrown, d => hit(d.weapon) * 10 + (d.defense || 0));
  const eq = p.equipment, w = ITEMS[weapon].weapon, legendary = id => ({ ...makeItem(id), q: QUALITIES.length - 1 });
  for (const slot of ['head', 'neck', 'body', 'legs', 'feet']) {
    const id = best(d => d.slot === slot, d => (d.armor || 0) * 10 + (d.defense || 0));
    eq[slot] = id ? legendary(id) : null;
  }
  eq.weapon = legendary(weapon);
  const shield = w.twoHanded ? null : best(d => d.slot === 'shield', d => d.defense || 0);
  eq.shield = shield ? legendary(shield) : null;
  const ring = best(d => d.slot === 'ring' && d.ring, d => (d.ring.regen ? d.ring.regen[0] + d.ring.regen[1] : 0) + (d.ring.speed || 0));
  eq.ring = ring ? makeItem(ring) : null;
  const ammo = w.ammo && best(d => d.slot === 'ammo' && d.ammo && d.ammo.type === w.ammo, d => d.ammo.attack);
  eq.ammo = ammo ? makeItem(ammo, MAX_STACK) : null;
  eq.backpack = { ...makeItem('backpack'), contents: [] };
  for (const [id, n] of [['health_potion', 50], ['mana_potion', 50], ['rope', 1], ['shovel', 1], ['meat', 20]]) if (ITEMS[id]) giveItem(id, n);
  if (['knight', 'paladin'].includes(vocation)) giveItem('war_spear', 1); // (to try the spear: hold it, say "hasta orbis")
  giveTestClang();
  log(`Test character: a level ${L} ${title(p)} with the best gear there is, 100000 gold and a million in the bank, and ${p.pet.name} at level ${L} beside you.`, 'quest');
  uiDirty();
  return true;
}

// For testing: Clang at your level (full grown, the temple's guardian), beside you. A test character gets him on making;
// one made before that can ask for him (Menu: "Test: Clang at level 100"). Playing alone only: the server has no button.
function isTestHero(p = player) { return p.level >= TEST_HERO_LEVEL && p.promoted; }
// For testing the circle throw: spears for a knight or paladin test character (made before they came with them)
const wantsTestSpear = () => isTestHero() && ['knight', 'paladin'].includes(player.vocation) && !countItem('war_spear') && !playerWeapon().spear;
function giveTestSpear() {
  giveItem('war_spear', 1);
  log('A war spear in your bag. Take it in your hands (it needs both: no shield), and it reaches two tiles. Then say "hasta orbis", or use Circle Throw from your spells.', 'quest');
  uiDirty();
}
function giveTestClang() {
  const p = player, L = p.level;
  p.pet = { name: (p.pet && p.pet.name) || 'Clang', kind: 'cat', level: L, xp: 0, hp: PETS.cat.hp(L), mode: 'assist', downUntil: 0, home: false };
  p.petBody = null;
  uiDirty();
}

// Takes plain items only: forged gear (with a grade) is never taken by mistake.
function removeItem(id, count = 1) {
  if (bagItems().filter(i => i.id === id && !i.q).reduce((n, i) => n + i.count, 0) < count) return false;
  const strip = c => {
    for (let i = c.contents.length - 1; i >= 0 && count > 0; i--) {
      const it = c.contents[i];
      if (it.contents) strip(it);
      if (it.id !== id || it.q) continue;
      const n = Math.min(count, it.count);
      it.count -= n;
      count -= n;
      if (!it.count) c.contents.splice(i, 1);
    }
  };
  strip(bag());
  uiDirty();
  return true;
}

function canWear(id) {
  const d = ITEMS[id];
  if (d.level && player.level < d.level) return `You need level ${d.level} to use ${itemName(id)}.`;
  if (d.vocations && !d.vocations.includes(player.vocation)) return `Only ${d.vocations.join('s and ')}s can use ${itemName(id)}.`;
  return null;
}

// Put an item back in the bag, or on the ground if there's no room.
function stash(item) {
  const left = storeInBag(item);
  if (left) {
    dropToGround(left, player);
    log(`No room: ${itemName(left.id, left.count)} fell to the ground.`);
  }
}

const fromOutside = ref => ref.root === 'pile' || ref.root === 'depot';
const intoInventory = ref => ref.root === 'bag' || ref.root === 'equip';

// Drag and drop: move count items from src to dst (an equipment slot, a container
// slot or the container itself, or the ground).
function moveItem(src, dst, count) {
  if (src.root === 'map') return moveThing(src, dst);
  if (src.root === 'equip' && src.slot === 'backpack') return log('You need your bag to carry things.');
  for (const ref of [src, dst]) {
    if (!ref || ref.root !== 'pile') continue;
    const pile = piles.find(p => p.id === ref.pileId);
    if (!pile || !withinReach(pile)) return log('You are too far away.');
  }
  const found = resolve(src);
  if (!found || !found.item) return;
  const item = found.item, def = ITEMS[item.id];
  count = Math.max(1, Math.min(Math.floor(+count) || item.count, item.count));
  const questy = it => ITEMS[it.id].quest || (it.contents || []).some(questy);
  if (questy(item) && !['bag', 'equip', 'depot'].includes(dst.root)) return log('You cannot give that away.'); // a quest needs it
  if (dst.root === 'ground') return dropAt(src, count, dst.x, dst.y, dst.z);
  if (fromOutside(src) && intoInventory(dst) && itemWeight({ ...item, count }) > freeCapacity()) {
    return log('This object is too heavy for you to carry.');
  }
  if (dst.root === 'equip') return equip(src, dst.slot, count);

  // Into a container: dropping onto a bag puts it inside; onto anything else, next to it.
  let target = null;
  const onto = dst.path && dst.path.length ? resolve(dst) : null;
  if (onto && onto.item && onto.item.contents && onto.item !== item) target = onto.item;
  else target = containerAt(dst, dst.path && dst.path.length ? dst.path.slice(0, -1) : []);
  if (!target) return;
  if (item.contents && (target === item || bagItems(item).includes(target))) return log('You cannot put a bag inside itself.');
  if (src.root !== 'equip' && dst.root === src.root && found.container === target && onto && onto.item && !onto.item.contents) {
    return; // dropped onto its own container: nothing to do
  }
  if (src.root === 'pile' && dst.root === 'pile' && found.container.contents === target.contents) return; // the same pile
  const moving = takeFrom(src, count);
  const left = putInto(target, moving);
  if (left) {
    log('There is no room there.');
    const worn = src.root === 'equip' && player.equipment[src.slot];
    if (src.root === 'equip' && !worn) player.equipment[src.slot] = left;
    else if (worn && worn.id === left.id) worn.count += left.count; // what didn't fit goes back on the stack
    else stash(left);
  }
  uiDirty();
}

function equip(src, slot, count) {
  const found = resolve(src), item = found.item, def = ITEMS[item.id];
  if (def.slot !== slot) return log(`You cannot wear ${itemName(item.id)} there.`);
  if (def.slot === 'backpack') return switchBag(src);
  const why = canWear(item.id);
  if (why) return log(why);
  const eq = player.equipment;
  const moving = takeFrom(src, def.stack ? count || item.count : 1);
  const displaced = [];
  if (eq[slot] && eq[slot].id === moving.id && def.stack) eq[slot].count += moving.count;
  else {
    if (eq[slot]) displaced.push(eq[slot]);
    eq[slot] = moving;
  }
  const weapon = eq.weapon && ITEMS[eq.weapon.id].weapon;
  if (slot === 'weapon' && def.weapon.twoHanded && eq.shield) { displaced.push(eq.shield); eq.shield = null; }
  if (slot === 'shield' && weapon && weapon.twoHanded) { displaced.push(eq.weapon); eq.weapon = null; }
  displaced.forEach(stash);
  addSound('equip', player.x, player.y, player.z);
  uiDirty();
}

function unequip(slot) {
  const item = player.equipment[slot];
  if (!item) return;
  if (slot === 'backpack') return log('You need your bag to carry things.');
  const left = storeInBag(item);
  if (left) return log('Your bag is full.');
  player.equipment[slot] = null;
  uiDirty();
}

// Use a bag that is in your bag: it becomes your main bag, with everything moved over.
function switchBag(ref) {
  const old = bag(), found = resolve(ref), next = found.item;
  if (found.container !== old) return log('Take it out of the other bag first.');
  const rest = old.contents.filter(it => it !== next), merged = [...next.contents, ...rest];
  if (merged.length + 1 > ITEMS[next.id].container) return log(`Your things don't fit in ${itemName(next.id)}.`);
  next.contents = merged;
  next.contents.push({ id: old.id, count: 1, contents: [] });
  player.equipment.backpack = next;
  log(`You now carry your things in ${itemName(next.id)}.`);
  uiDirty();
}

// Using an item: eat, drink, wear, open a bag, read, or pick a target for a rune or tool.
function useItem(ref) {
  const found = resolve(ref);
  if (!found || !found.item) return;
  const item = found.item, d = ITEMS[item.id];
  if (d.petHeal) { // (a pet tonic: for your companion)
    const pet = player.pet;
    if (!pet || pet.home || pet.downUntil) return log('That is for a companion at your side.');
    if (pet.hp >= petMaxHp(pet)) return log(`${pet.name} isn't hurt.`);
    return tendPet('tonic');
  }
  if (d.lantern) { // (the keeper's lantern: light without the spell, as long as you like)
    player.lightUntil = now + d.lantern;
    addSparkle(player, '#ffd870');
    log(`You light the ${d.name}. It throws a warm light round you.`);
    return uiDirty();
  }
  if (d.use && d.use.food) return eat(ref);
  if (d.use) return drink(ref);
  if (d.whistle) return blowWhistle();
  if (d.text) return showText(capitalize(d.name), d.text);
  if (d.container && ref.root !== 'equip') return playerEvent('openContainer', { ...ref, title: capitalize(d.name) });
  if (d.rune || d.tool || d.key || d.kit) return playerEvent('useWith', { ref, name: d.name });
  if (d.slot && ref.root !== 'equip') return equip(ref, d.slot);
  log(`You see ${itemInfo(item.id, item.q)}.`, 'look');
}

function eat(ref) {
  const item = resolve(ref).item;
  const fed = Math.max(0, player.fedUntil - now);
  if (fed > 15 * 60000) return log('You are full.');
  player.fedUntil = now + fed + ITEMS[item.id].use.food * 1000;
  addSpeech(player, 'Munch.');
  takeFrom(ref, 1);
}

function drink(ref) {
  const use = ITEMS[resolve(ref).item.id].use;
  if (now < player.potionReady) return;
  player.potionReady = now + POTION_COOLDOWN;
  if (use.heal) {
    player.hp = Math.min(player.maxHp, player.hp + randInt(...use.heal));
    addSparkle(player, '#ff8080');
  }
  if (use.mana) {
    player.mana = Math.min(player.maxMana, player.mana + randInt(...use.mana));
    addSparkle(player, '#8090ff');
  }
  addSpeech(player, 'Aaaah...');
  addSound('potion', player.x, player.y, player.z);
  takeFrom(ref, 1);
}

// Reference to the first bag item passing test (for hotkeys).
function findInBag(test, c = bag(), path = []) {
  for (let i = 0; i < c.contents.length; i++) {
    const it = c.contents[i];
    if (test(it)) return { root: 'bag', path: [...path, i] };
    if (it.contents) {
      const inner = findInBag(test, it, [...path, i]);
      if (inner) return inner;
    }
  }
  return null;
}

// ---- piles: corpses and items on the ground ---------------------------------------------
// The pile on top: the newest one there (a second corpse on a tile shows, and opens, first).
function pileAt(x, y, z) {
  for (let i = piles.length - 1; i >= 0; i--) if (piles[i].x === x && piles[i].y === y && piles[i].z === z) return piles[i];
  return null;
}

function dropToGround(item, pos) {
  let p = pileAt(pos.x, pos.y, pos.z);
  if (!p) piles.push((p = { id: newId(), x: pos.x, y: pos.y, z: pos.z, items: [], corpse: null, until: 0 }));
  const h = map.houseAt(pos.x, pos.y, pos.z);
  if (h && h.owner) p.house = h.id; // things in a rented house don't rot away
  // Merge stacks without exceeding MAX_STACK; split the remainder.
  if (ITEMS[item.id].stack) {
    for (const same of p.items) {
      if (same.id !== item.id || same.count >= MAX_STACK) continue;
      const n = Math.min(item.count, MAX_STACK - same.count);
      same.count += n;
      item.count -= n;
      if (!item.count) break;
    }
    while (item.count > 0) {
      const n = Math.min(item.count, MAX_STACK);
      p.items.push({ ...item, count: n });
      item.count -= n;
    }
  } else p.items.push(item);
  p.until = Math.max(p.until, now + 5 * 60000);
  uiDirty();
}

function dropAt(src, count, x, y, z) {
  const item = resolve(src).item;
  if (ITEMS[item.id].quest) return log('You should keep that, it belongs to a quest.');
  if (z !== player.z || dist(player, { x, y }) > 7 || !sightClear(player, { x, y, z })) return log('You cannot throw it there.');
  const t = map.get(x, y, z);
  if (!t || !t.ground || THINGS[t.ground].block || (t.items.some(id => THINGS[id].block && !THINGS[id].low) && !pileAt(x, y, z))) {
    return log('There is no room there.');
  }
  dropToGround(takeFrom(src, count), { x, y, z });
}

// Barrels, crates and furniture (and other players) can be pushed to a free tile next to them.
function moveThing(src, dst) {
  if (dst.root !== 'ground') return log('That is too heavy to carry.');
  const c = creatureAt(src.x, src.y, src.z);
  if (c && c.type === 'player' && c !== player) {
    if (src.z !== player.z || dist(player, src) > 1 || dist(src, dst) > 1 || dst.z !== src.z) return log('You can only push someone next to you, one tile.');
    if (c.walk || !isFreeNoStairs(dst.x, dst.y, dst.z)) return log('There is no room there.');
    c.walk = { fromX: c.x, fromY: c.y, start: now, dur: stepTime(c, (map.get(dst.x, dst.y, dst.z) || {}).ground, false) };
    c.x = dst.x;
    c.y = dst.y;
    c.path = [];
    return;
  }
  const t = map.get(src.x, src.y, src.z), id = topItem(t);
  if (!id || !THINGS[id].movable) return;
  if (src.z !== player.z || dist(player, src) > 1) return log('You need to stand next to it.');
  if (dst.z !== src.z || dist(src, dst) > 1 || (dst.x === src.x && dst.y === src.y)) return log('You can only push it one tile.');
  if (!isFree(dst.x, dst.y, dst.z) || map.get(dst.x, dst.y, dst.z).items.length || map.floorChange(dst.x, dst.y, dst.z)) return log('There is no room there.');
  t.items.pop();
  map.addItem(dst.x, dst.y, dst.z, id);
  const f = player.furniture.find(fu => fu.x === src.x && fu.y === src.y && fu.z === src.z && fu.id === id);
  if (f) Object.assign(f, { x: dst.x, y: dst.y, z: dst.z });
  mapChanged(src.x, src.y, src.z);
  mapChanged(dst.x, dst.y, dst.z);
}

function takeFromPile(pileId, index) {
  const pile = piles.find(p => p.id === pileId);
  if (!pile || !pile.items[index]) return;
  if (pile.z !== player.z || dist(pile, player) > 1) return log('You are too far away.');
  const item = pile.items[index];
  if (item.id === 'gold') {
    player.gold += item.count;
    log(`You take ${item.count} gold.`);
    addSound('coin', player.x, player.y, player.z);
    pile.items.splice(index, 1);
  } else if (item.contents || ITEMS[item.id].ring) {
    if (itemWeight(item) > freeCapacity()) return log('This object is too heavy for you to carry.');
    pile.items.splice(index, 1);
    const left = storeInBag(item);
    if (left) {
      pile.items.splice(index, 0, left);
      return log('Your bag is full.');
    }
  } else {
    const left = addItem(item.id, item.count);
    if (left === item.count) return log(freeCapacity() < (ITEMS[item.id].weight || 0) ? 'This object is too heavy for you to carry.' : 'Your bag is full.');
    if (left) item.count = left;
    else pile.items.splice(index, 1);
  }
  cleanupPile(pile.id);
  uiDirty();
}

function cleanupPile(pileId) {
  const pile = piles.find(p => p.id === pileId);
  if (pile && !pile.items.length && !pile.corpse) removePile(pile);
}

function removePile(pile) {
  const i = piles.indexOf(pile);
  if (i >= 0) piles.splice(i, 1);
  for (const p of players) if (p.openPile === pile) p.openPile = null;
  uiDirty();
}

// ---- skills, experience and levels ------------------------------------------------------
function addSkillTries(skill, n = 1) {
  const s = player.skills[skill];
  s.tries += n;
  let need;
  while (s.tries >= (need = skillTries(skill, s.level, player.vocation))) {
    s.tries -= need;
    s.level++;
    log(`You advanced to ${SKILLS[skill].name} ${s.level}.`, 'level');
  }
  uiDirty();
}

// What blocks part of a physical hit: the shield's defense, or without a shield the weapon's (before the fight mode)
function totalDefense() {
  const eq = player.equipment, shield = eq.shield && ITEMS[eq.shield.id];
  return (shield ? qualityStat(shield.defense, eq.shield.q) : (eq.weapon && qualityStat(ITEMS[eq.weapon.id].defense, eq.weapon.q))) || 0;
}

function totalArmor() {
  return SLOTS.reduce((sum, slot) => { const it = player.equipment[slot]; return sum + (it ? qualityStat(ITEMS[it.id].armor, it.q) : 0); }, 0);
}

const title = p => (p.vocation === 'none' ? 'no vocation' : p.promoted ? VOCATIONS[p.vocation].promoted : p.vocation);

function gainXp(amount, shared) {
  player.xp += amount;
  addText(player, `+${amount}`, shared ? PARTY_XP_COLOR : '#ffd84a'); // experience floats up in gold (shared with a party: blue)
  log(`You gained ${amount} experience points${shared ? ' (shared with your party)' : ''}.`, 'xp');
  while (player.xp >= xpForLevel(player.level + 1)) {
    player.level++;
    const v = VOCATIONS[player.vocation];
    player.maxHp += v.hp;
    player.maxMana += v.mana;
    player.hp = player.maxHp;
    player.mana = player.maxMana;
    log(`You advanced from Level ${player.level - 1} to Level ${player.level}.`, 'level');
    addSound('level', player.x, player.y, player.z);
    addSparkle(player, '#ffe080');
    spellsFor(player.vocation).forEach((id, i) => {
      const s = SPELLS[id];
      if (s.level === player.level && (!s.promoted || player.promoted)) {
        log(`You learned the spell ${s.name} ("${s.words}"): it's on your action bar${i < 9 ? ` (on a keyboard: key ${i + 1})` : ''}.`, 'level'); // (a phone has no keys)
      }
    });
    if (player.level === 10 && player.vocation === 'none') { // (Sister Ama says goodbye first: The Silent Bell VI)
      log(questState('bell_5') === 'done' && questState('bell_6') !== 'done'
        ? 'You are ready to choose a vocation! First visit Sister Ama in the temple: she wants to see you. Then the oracle, upstairs in the academy.'
        : 'You are ready to choose a vocation! Visit the oracle, upstairs in the academy.', 'quest');
    }
    // (only where someone in the world can promote you)
    const promoter = player.level === 20 && player.vocation !== 'none' && !player.promoted
      && npcs.find(n => NPCS[n.npcId] && Object.values(NPCS[n.npcId].keywords || {}).some(k => k && k.promote));
    if (promoter) log(`You can now be promoted. Visit ${NPCS[promoter.npcId].name}.`, 'quest');
  }
  uiDirty();
}

// ---- quests ------------------------------------------------------------------------
const questSteps = q => q.steps || [{ npc: q.giver, kill: q.kill, fetch: q.fetch }];
const questState = id => (player.quests[id] ? player.quests[id].status : 'none');
const questStep = id => questSteps(QUESTS[id])[player.quests[id].step || 0];

function stepReady(id) {
  const s = questStep(id), kills = player.quests[id].kills;
  if (s.thing) return false; // (done at a thing in the world: rescueAt, questDeed)
  if (s.clear && !areaClear(s.clear)) return false; // (the gate watch's tasks: game-gates.js)
  if (s.burn) return burntCount(id) >= s.burn;
  if (s.kill && !Object.entries(s.kill).every(([type, n]) => (kills[type] || 0) >= n)) return false;
  if (s.fetch) return countItem(s.fetch) > 0; // (a kill and a fetch: both)
  if (s.has) return countItem(s.has) > 0 || SLOTS.some(slot => player.equipment[slot] && player.equipment[slot].id === s.has); // (shown, and kept)
  return true;
}

function questProgress(id) {
  const s = questStep(id), kills = player.quests[id].kills;
  const fetched = s.fetch && `${ITEMS[s.fetch].name}: ${countItem(s.fetch) ? 'found' : 'not found yet'}`;
  if (s.kill) {
    return [...Object.entries(s.kill)
      .map(([type, n]) => `${Math.min(n, kills[type] || 0)}/${n} ${MONSTERS[type].proper ? MONSTERS[type].name : MONSTERS[type].plural || MONSTERS[type].name + 's'}`), fetched]
      .filter(Boolean).join(', ');
  }
  if (s.fetch) return countItem(s.fetch) ? 'found' : 'not found yet';
  if (s.burn) return `${Math.min(s.burn, burntCount(id))}/${s.burn} burnt`;
  if (s.clear) return areaClear(s.clear) ? 'the way is clear' : 'they are still there';
  if (s.has) return stepReady(id) ? 'found' : 'not found yet';
  return '';
}

function startQuest(id) {
  player.quests[id] = { status: 'active', step: 0, kills: {} };
  log(`New quest: ${QUESTS[id].name}. See the Quests tab.`, 'quest');
  uiDirty();
}

// The real day, by the calendar of whoever keeps the world (the server's, online): for what can be had once a day.
// (the one thing in the game that follows the real date rather than the game's clock)
function realDay() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
// Whether a quest's daily bonus (reward.daily: the first of those you finish each real day) is still yours today
const dailyDue = q => !!(q.reward && q.reward.daily) && player.huntDay !== realDay();

// Finish the current step; the last step completes the quest.
function advanceQuest(id) {
  const q = QUESTS[id], s = questStep(id), state = player.quests[id];
  if (s.fetch) removeItem(s.fetch, 1);
  state.step = (state.step || 0) + 1;
  state.kills = {};
  if (state.step < questSteps(q).length) {
    log(`${q.name}: ${questStep(id).summary}`, 'quest');
    uiDirty();
    return;
  }
  const r = q.reward || {};
  player.quests[id] = { status: 'done', step: state.step, kills: {}, doneAt: now }; // (doneAt: for a quest that can be done again)
  log(`Quest completed: ${q.name}!`, 'quest');
  addSound('level', player.x, player.y, player.z);
  if ((r.items || []).length) log(`You received ${r.items.map(([item, n]) => itemName(item, n)).join(' and ')}.`, 'quest'); // (before "lying at your feet")
  if (r.gold) addItem('gold', r.gold);
  for (const [item, n] of r.items || []) giveItem(item, n);
  if ((r.items || []).some(([item]) => ITEMS[item].slot === 'backpack')) log('Open the backpack in your bag to carry your things in it: it holds far more.', 'quest');
  if (r.daily && dailyDue(q)) { // the first of these you finish today: a little more (game-npc.js says so, too)
    player.huntDay = realDay();
    log(`The first of these today: you received ${r.daily.map(([item, n]) => itemName(item, n)).join(' and ')} more.`, 'quest');
    for (const [item, n] of r.daily) giveItem(item, n);
  }
  if (r.xp) gainXp(r.xp);
  if (r.chronicle && !player.chests[`chronicle_${r.chronicle}`]) chronicleRead(r.chronicle);
  if (r.bell) { const first = !townBell.first; bellRestored(); ringTownBell(first ? 'Dong... dong... dong... The bell of Oakvale rings again, for the first time in days!' : `Dong... dong... dong... ${player.name} rings the bell of Oakvale, and the whole isle hears it.`); }
  if (r.pet && !player.pet) { // a companion: it follows you from now on (game-update.js updatePet)
    player.pet = { name: r.pet.name, kind: r.pet.kind, level: 1, xp: 0, hp: PETS[r.pet.kind].hp(1), home: false, downUntil: 0, mode: 'assist' };
    playerEvent('petName', { name: r.pet.name }); // (the browser asks what to call it)
    log(`${r.pet.name} is your companion now: it follows you, fights at your side, and grows stronger as it fights and trains with you.`, 'level');
  }
  uiDirty();
}

// A monster's echo (echoOf in creatures.js) counts as the one it echoes only for a step told again (its again texts,
// bellAgain): the echo is what that telling sends you to face. The first telling wants the real one.
const killCountsAs = (st, type) => {
  const of = MONSTERS[type] && MONSTERS[type].echoOf;
  return st.kill[type] ? type : of && st.kill[of] && st.again && bellAgain() ? of : null;
};

function onMonsterKilled(type) {
  questTrophies(type); // (what a quest has you take from it: game-gates.js)
  for (const [id, s] of Object.entries(player.quests)) {
    if (s.status !== 'active' || !QUESTS[id]) continue;
    const st = questStep(id), as = st.kill && killCountsAs(st, type);
    if (!as) continue;
    const before = stepReady(id);
    s.kills[as] = Math.min(st.kill[as], (s.kills[as] || 0) + 1);
    if (before || !stepReady(id)) continue;
    if (st.auto) { // a task out in the wilds: done the moment it's done, and the quest goes on from there
      if (st.done) log(storyText(st, 'done'), 'quest');
      advanceQuest(id);
    } else log(`${QUESTS[id].name}: done! Report to ${NPCS[st.npc || QUESTS[id].giver].name}.`, 'quest');
  }
  uiDirty();
}

// A thing a quest step waits at (step.thing): the crate in the bell cellar, with Clang behind it
function rescueAt(questId, thingId) {
  const st = questState(questId) === 'active' && questStep(questId);
  if (st && st.thing === thingId) {
    if (st.done) log(storyText(st, 'done'), 'quest');
    addSparkle(player, '#ffe080');
    return advanceQuest(questId);
  }
  if (questState(questId) === 'done' || player.pet) return log('Nothing behind it now but dust and a few cat hairs.');
  log(questState(questId) === 'active' ? 'Something behind the crate hisses at the rats. Deal with them first.' : 'Something moves behind the crate, and mews.');
}

// at: where the chest stands (for a guarded one: it stays shut while its guard lives near it)
function openChest(chest, at) {
  if (!player.chests[chest.flag] && chest.guard && at && monsters.some(m => m.type === chest.guard && !m.dead && m.z === at.z && dist(m, at) <= 10)) {
    return log(chest.guarded || 'Something guards it. Deal with it first.');
  }
  if (player.chests[chest.flag]) {
    // Lost what a quest still needs (an unblessed death, long ago)? It's back in the chest.
    // (only what the quest still asks for: not what you have already handed in)
    const req = chest.requires && chest.requires.split('@')[0];
    const ahead = req && questState(req) === 'active' ? questSteps(QUESTS[req]).slice(player.quests[req].step || 0).map(st => st.fetch) : [];
    const lost = (chest.items || []).filter(([id]) => ITEMS[id].quest && ahead.includes(id) && !countItem(id));
    if (!lost.length) return log(chest.empty || (chest.choice ? 'You have already taken your pick.' : 'It is empty.'));
    for (const [id, n] of lost) giveItem(id, n);
    return log(`You found ${lost.map(([id, n]) => itemName(id, n)).join(' and ')} again.`, 'quest');
  }
  if (chest.requires && !questAllows(chest.requires)) return log(chest.locked || 'It is locked.'); // 'quest' or 'quest@step'
  player.chests[chest.flag] = true;
  const found = (chest.items || []).map(([id, n]) => itemName(id, n));
  if (chest.gold) found.push(`${chest.gold} gold`);
  log(found.length ? `You found ${found.join(' and ')}.` : 'It is empty.', 'quest');
  if (chest.gold) addItem('gold', chest.gold);
  for (const [id, n] of chest.items || []) giveItem(id, n);
  if (chest.quest) {
    player.quests[chest.quest] = { status: 'done', step: 0, kills: {} };
    log(`Quest completed: ${QUESTS[chest.quest].name}!`, 'quest');
  }
  if (chest.xp) {
    gainXp(chest.xp);
    log(`You gained ${chest.xp} experience for the finding.`, 'quest');
    addSparkle(player, '#ffe080');
  }
  addSound('coin', player.x, player.y, player.z);
  uiDirty();
}

function chooseVocation(v) {
  player.vocation = v;
  player.home = mainlandOpen() ? 'main' : 'start'; // (no mainland yet: you stay, and wake in Oakvale's temple)
  player.teleportAt = now + 2500; // give the player a moment to read the oracle's farewell
  uiDirty();
}

// The oracle's gift, a moment after you choose: and once there is a mainland, the crossing to it
function arriveOnMainland() {
  player.teleportAt = 0;
  endConversation(true);
  const away = mainlandOpen();
  if (away) teleport(map.mainStart);
  for (const [id, n] of VOCATIONS[player.vocation].kit || []) giveItem(id, n);
  addSparkle(player, '#c58cff');
  log(away ? `You are now a ${player.vocation}! Welcome to the mainland. Check your bag for a gift from the oracle, and the spell buttons below the map.`
    : `You are now a ${player.vocation}, Oakvale's own! The ship has not come yet: until it does, the isle is yours to defend. Check your bag for a gift from the oracle, and the spell buttons below the map.`, 'quest');
}

// ---- saving ------------------------------------------------------------------------
const SAVED_FIELDS = ['name', 'vocation', 'promoted', 'home', 'outfit', 'x', 'y', 'z', 'level', 'xp', 'hp', 'maxHp', 'mana', 'maxMana',
  'gold', 'bank', 'skills', 'equipment', 'depot', 'quests', 'chests', 'blessed', 'house', 'furniture', 'hotkeys', 'markers',
  'fightMode', 'chase', 'secure', 'tutorial', 'tale', 'born', 'pet', 'guideSeen', 'huntDay', 'bestiary', 'cosmetics', 'autoHeal'];

function serializePlayer(p) {
  const data = { fed: Math.max(0, p.fedUntil - now) };
  for (const f of SAVED_FIELDS) data[f] = p[f];
  data.housePiles = piles.filter(pl => p.house && pl.house === p.house).map(pl => ({ x: pl.x, y: pl.y, z: pl.z, items: pl.items }));
  return JSON.parse(JSON.stringify(data));
}

// Load saved data into the current player, dropping anything that no longer exists.
function applySave(data) {
  for (const f of SAVED_FIELDS) if (data[f] !== undefined) player[f] = data[f];
  if (data.tutorial === undefined) player.tutorial = 0; // from before the guide: they know their way
  if (data.huntDay === undefined) player.huntDay = ''; // (from before the daily bonus: today's is still to have)
  if (data.born === undefined) player.born = ''; // (from before the mark: its action buttons stay under its name)
  if (!player.autoHeal || typeof player.autoHeal !== 'object') player.autoHeal = { hp: 0, mana: 0 }; // (from before auto-heal: off)
  if (player.pet && player.pet.downUntil) player.pet.downUntil = now + 30000; // (a clock that started again: back soon)
  if (player.pet && !Object.hasOwn(PET_MODES, player.pet.mode || '')) player.pet.mode = 'assist'; // (from before its modes: it fights at your side)
  const valid = it => it && ITEMS[it.id] && (!it.contents || (it.contents = it.contents.filter(valid)));
  for (const slot of SLOTS) if (!valid(player.equipment[slot])) player.equipment[slot] = null;
  if (!player.equipment.backpack) player.equipment.backpack = makeItem('bag');
  if (!player.depot || !player.depot.contents) player.depot = { depot: true, contents: [] };
  player.depot.contents = player.depot.contents.filter(valid);
  for (const id in SKILLS) if (!player.skills[id]) player.skills[id] = { level: SKILLS[id].start, tries: 0 };
  for (const id in player.quests) if (!QUESTS[id]) delete player.quests[id];
  if (!VOCATIONS[player.vocation]) player.vocation = 'none';
  // (the bestiary and cosmetics: none in a save from before them; anything unknown is dropped)
  const kills = player.bestiary && typeof player.bestiary === 'object' && !Array.isArray(player.bestiary) ? player.bestiary : {};
  player.bestiary = {};
  for (const type of Object.keys(kills)) if (Object.hasOwn(MONSTERS, type) && kills[type] > 0) player.bestiary[type] = Math.floor(kills[type]);
  player.cosmetics = Array.isArray(player.cosmetics) ? player.cosmetics.filter(id => Object.hasOwn(COSMETICS, id)) : [];
  if (player.outfit) for (const k of ['feather', 'cloak']) if (player.outfit[k] && !player.cosmetics.includes(player.outfit[k])) delete player.outfit[k];
  player.fedUntil = now + (data.fed || 0);
  const house = map.houses.find(h => h.id === player.house);
  if (house && (!house.owner || house.owner === player.name)) {
    house.owner = player.name;
    for (const f of player.furniture) if (map.houseAt(f.x, f.y, f.z) === house && THINGS[f.id]) { map.addItem(f.x, f.y, f.z, f.id); mapChanged(f.x, f.y, f.z); }
    if (!piles.some(pl => pl.house === house.id)) { // still there, if you were only away a moment
      for (const hp of data.housePiles || []) for (const it of hp.items.filter(valid)) dropToGround(it, hp);
    }
  } else {
    if (house) { // someone else rents it now: your things wait in your depot
      for (const f of player.furniture) {
        const kit = Object.keys(ITEMS).find(k => ITEMS[k].kit === f.id);
        if (kit) player.depot.contents.push(makeItem(kit));
      }
      for (const hp of data.housePiles || []) player.depot.contents.push(...hp.items.filter(valid));
    }
    player.house = null;
    player.furniture = [];
  }
  if (player.vocation !== 'none' && mainlandOpen() && onIsle(player)) player.teleportAt = now + 1000; // the oracle was about to send you
  rememberBellRinger();
  if (!map.inBounds(player.x, player.y, player.z) || !map.isWalkable(player.x, player.y, player.z)) teleport(homePos());
}

function saveGame() {
  try {
    const data = serializePlayer(player);
    data.worldId = 'rookgaard-74-v1';
    data.explored = typeof exportExplored === 'function' ? exportExplored() : null;
    data.guilds = guilds; // playing alone, your guild lives in your save
    data.townBell = townBell; // (and the bell's plaque)
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save the game:', e);
  }
}

function loadGame() {
  let data;
  try {
    data = JSON.parse(localStorage.getItem(SAVE_KEY));
  } catch (e) {
    return false;
  }
  if (!data) return false;
  applySave(data);
  if (data.worldId !== 'rookgaard-74-v1') {
    // Preserve character progress, but never spawn at coordinates from the former world.
    teleport(map.start);
    player.home = 'start';
    data.explored = null;
  }
  if (data.guilds) guilds = data.guilds;
  if (data.townBell && Array.isArray(data.townBell.ringers)) { townBell = data.townBell; rememberBellRinger(); }
  if (typeof importExplored === 'function') importExplored(data.explored);
  return true;
}
