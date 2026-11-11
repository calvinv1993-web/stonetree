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
    fightMode: 'balanced', chase: true, secure: true, conditions: {},
    path: [], pathGoal: null, action: null, target: null, openPile: null,
    input: { held: [], queued: null }, conversation: null, shopNpc: null, events: [],
    training: null, trainHits: 0, // the dummy you're hitting ({ x, y, z, fromX, fromY }), and how often you have
    lastAttack: 0, nextChase: 0, nextRegen: 0, fedUntil: 0, lightUntil: 0, spellReady: 0, potionReady: 0, useReady: 0,
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
  c.dir = dirTo(dx, dy);
  const nx = c.x + dx, ny = c.y + dy;
  const isPlayer = c.type === 'player';
  if (isPlayer && skullBlocks(c, nx, ny)) return false;
  if (isPlayer && !creatureAt(nx, ny, c.z) && bumpDoor(nx, ny, c.z)) return false;
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
const homeTown = () => (player.home === 'start' ? 'Oakvale' : (map.temples.find(t => t.home === player.home) || { town: 'Valoria' }).town);

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
    if (def.readable) return showText(capitalize(def.name), meta.text || 'It is blank.'), true;
    if (def.lever) return pullLever(x, y, z, i, meta), true;
    if (def.depot) {
      playerEvent('openContainer', { root: 'depot', path: [], title: 'Depot' });
      return true;
    }
    if (def.bookshelf) return showText('Bookshelf', LORE[(x * 7 + y * 13) % LORE.length]), true;
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
    if (def.chest) return openChest(def.chest), true;
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
    if (def.digSpot) return log('You could dig here with a shovel.'), true;
    if (def.breakable) return log('A pick could break this rock.'), true;
    if (def.oreVein) return log('Ore glitters in the rock. Use a pick on it to mine it.'), true;
    if (def.teleport) return log('A magic forcefield. Step into it to travel.'), true;
    if (player.furniture.some(f => f.x === x && f.y === y && f.z === z && f.id === id)) return packFurniture(x, y, z, i), true;
    if (['chest', 'barrel', 'crate'].includes(id)) return log(`The ${def.name} is empty.`), true;
  }
  if (t.ground === 'water') return log('You could fish here with a fishing rod.'), true;
  return false;
}

// The bell of Oakvale rings out: everyone in the world hears it, wherever they are. It hums for a while after.
let bellRungAt = -Infinity;
function ringTownBell(text = 'Dong... dong... dong... The bell of Oakvale rings out over the isle.') {
  bellRungAt = now;
  for (const p of players) asPlayer(p, () => { addSound('bell', p.x, p.y, p.z); log(text, 'quest'); });
}

// The level at which the oracle lets you choose a vocation (and sends you to the mainland).
const vocationLevel = () => 10;

// Using the bell in the bell tower: silent until its clapper is back (The Silent Bell), then anyone may ring it.
function ringBell(x, y, z) {
  if (questState('bell_4') !== 'done') return log('The great bell hangs silent. Someone has cut its rope, and its clapper is gone.');
  if (now - bellRungAt < 30000) return log('The bell is still humming. Let it rest a moment.');
  ringTownBell(`Dong... dong... dong... ${player.name} rings the bell of Oakvale, and the whole isle hears it.`);
}

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

// "Use with": a rune, tool, key or furniture kit used on a tile or creature.
function useItemOn(ref, x, y, z) {
  const found = resolve(ref);
  if (!found || !found.item) return;
  const item = found.item, def = ITEMS[item.id];
  if (z !== player.z) return log('You cannot reach that.');
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
    return;
  }
  if (!near) return log('You need to stand next to it.');
  if (tool === 'rope') {
    if (!t || !t.items.some(id => THINGS[id].ropeSpot)) return log('There is nothing to climb up to here.');
    const from = { x: player.x, y: player.y };
    Object.assign(player, { x, y });
    if (!changeFloor(1)) Object.assign(player, from);
    return;
  }
  if (tool === 'shovel') {
    if (!t || !t.items.includes('loose_sand')) return taleDeed('dig', `${x},${y},${z}`) || log('There is nothing to dig here.');
    changeTileFor(x, y, z, 'loose_sand', 'hole', 60000);
    log('You dig a hole.');
    return;
  }
  if (tool === 'pick') {
    if (t && t.items.includes('ore_vein')) return mineVein(x, y, z);
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
  log(`Test character: a level ${L} ${title(p)} with the best gear there is, 100000 gold and a million in the bank.`, 'quest');
  uiDirty();
  return true;
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
  player.potionReady = now + 1000;
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
        log(`You learned the spell ${s.name} ("${s.words}")${i < 9 ? `. Press ${i + 1} to cast it` : ''}.`, 'level');
      }
    });
    if (player.level === 10 && player.vocation === 'none') {
      log('You are ready to choose a vocation! Visit the oracle, upstairs in the academy.', 'quest');
    }
    if (player.level === 20 && player.vocation !== 'none' && !player.promoted) {
      log('You can now be promoted. Visit Grandmaster Orin in the temple of Valoria.', 'quest');
    }
  }
  uiDirty();
}

// ---- quests ------------------------------------------------------------------------
const questSteps = q => q.steps || [{ npc: q.giver, kill: q.kill, fetch: q.fetch }];
const questState = id => (player.quests[id] ? player.quests[id].status : 'none');
const questStep = id => questSteps(QUESTS[id])[player.quests[id].step || 0];

function stepReady(id) {
  const s = questStep(id), kills = player.quests[id].kills;
  if (s.kill) return Object.entries(s.kill).every(([type, n]) => (kills[type] || 0) >= n);
  if (s.fetch) return countItem(s.fetch) > 0;
  return true;
}

function questProgress(id) {
  const s = questStep(id), kills = player.quests[id].kills;
  if (s.kill) {
    return Object.entries(s.kill)
      .map(([type, n]) => `${Math.min(n, kills[type] || 0)}/${n} ${MONSTERS[type].proper ? MONSTERS[type].name : MONSTERS[type].plural || MONSTERS[type].name + 's'}`)
      .join(', ');
  }
  if (s.fetch) return countItem(s.fetch) ? 'found' : 'not found yet';
  return '';
}

function startQuest(id) {
  player.quests[id] = { status: 'active', step: 0, kills: {} };
  log(`New quest: ${QUESTS[id].name}. See the Quests tab.`, 'quest');
  uiDirty();
}

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
  player.quests[id] = { status: 'done', step: state.step, kills: {} };
  log(`Quest completed: ${q.name}!`, 'quest');
  addSound('level', player.x, player.y, player.z);
  if (r.gold) addItem('gold', r.gold);
  for (const [item, n] of r.items || []) giveItem(item, n);
  if ((r.items || []).length) log(`You received ${r.items.map(([item, n]) => itemName(item, n)).join(' and ')}.`, 'quest');
  if ((r.items || []).some(([item]) => ITEMS[item].slot === 'backpack')) log('Open the backpack in your bag to carry your things in it: it holds far more.', 'quest');
  if (r.xp) gainXp(r.xp);
  if (r.bell) ringTownBell('Dong... dong... dong... The bell of Oakvale rings again, for the first time in days!');
  uiDirty();
}

function onMonsterKilled(type) {
  for (const [id, s] of Object.entries(player.quests)) {
    if (s.status !== 'active' || !QUESTS[id]) continue;
    const st = questStep(id);
    if (!st.kill || !st.kill[type]) continue;
    const before = stepReady(id);
    s.kills[type] = Math.min(st.kill[type], (s.kills[type] || 0) + 1);
    if (before || !stepReady(id)) continue;
    if (st.auto) { // a task out in the wilds: done the moment it's done, and the quest goes on from there
      if (st.done) log(st.done, 'quest');
      advanceQuest(id);
    } else log(`${QUESTS[id].name}: done! Report to ${NPCS[st.npc || QUESTS[id].giver].name}.`, 'quest');
  }
  uiDirty();
}

function openChest(chest) {
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
  addSound('coin', player.x, player.y, player.z);
  uiDirty();
}

function chooseVocation(v) {
  player.vocation = v;
  player.home = 'main';
  player.teleportAt = now + 2500; // give the player a moment to read the Seer's farewell
  uiDirty();
}

function arriveOnMainland() {
  player.teleportAt = 0;
  endConversation(true);
  teleport(map.mainStart);
  for (const [id, n] of VOCATIONS[player.vocation].kit || []) giveItem(id, n);
  addSparkle(player, '#c58cff');
  log(`You are now a ${player.vocation}! Welcome to the mainland. Check your bag for a gift from the oracle, and the spell buttons below the map.`, 'quest');
}

// ---- saving ------------------------------------------------------------------------
const SAVED_FIELDS = ['name', 'vocation', 'promoted', 'home', 'outfit', 'x', 'y', 'z', 'level', 'xp', 'hp', 'maxHp', 'mana', 'maxMana',
  'gold', 'bank', 'skills', 'equipment', 'depot', 'quests', 'chests', 'blessed', 'house', 'furniture', 'hotkeys', 'markers',
  'fightMode', 'chase', 'secure', 'tutorial', 'tale'];

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
  const valid = it => it && ITEMS[it.id] && (!it.contents || (it.contents = it.contents.filter(valid)));
  for (const slot of SLOTS) if (!valid(player.equipment[slot])) player.equipment[slot] = null;
  if (!player.equipment.backpack) player.equipment.backpack = makeItem('bag');
  if (!player.depot || !player.depot.contents) player.depot = { depot: true, contents: [] };
  player.depot.contents = player.depot.contents.filter(valid);
  for (const id in SKILLS) if (!player.skills[id]) player.skills[id] = { level: SKILLS[id].start, tries: 0 };
  for (const id in player.quests) if (!QUESTS[id]) delete player.quests[id];
  if (!VOCATIONS[player.vocation]) player.vocation = 'none';
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
  if (player.vocation !== 'none' && onIsle(player)) player.teleportAt = now + 1000; // the Seer was about to send you
  if (!map.inBounds(player.x, player.y, player.z) || !map.isWalkable(player.x, player.y, player.z)) teleport(homePos());
}

function saveGame() {
  try {
    const data = serializePlayer(player);
    data.worldId = 'rookgaard-74-v1';
    data.explored = typeof exportExplored === 'function' ? exportExplored() : null;
    data.guilds = guilds; // playing alone, your guild lives in your save
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
  if (typeof importExplored === 'function') importExplored(data.explored);
  return true;
}
