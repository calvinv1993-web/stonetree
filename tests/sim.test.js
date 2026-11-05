'use strict';
// Soak test: a random "player" plays the real game logic for a long stretch of
// simulated time (60 updates per second, like the browser) while every update
// is checked for exceptions, slow updates (freezes) and broken world state.
//
//   node tests/sim.test.js [minutes per run = 30] [runs = 4] [first seed = 1]

const { loadGame, seededRandom } = require('./harness');

const MINUTES = +process.argv[2] || 30;
const RUNS = +process.argv[3] || 4;
const FIRST_SEED = +process.argv[4] || 1;
const TICK = 1000 / 60;
const SLOW_TICK_MS = 50;     // one update taking longer than this is a visible hitch
const FREEZE_TICK_MS = 500;  // ...and this is a freeze

// Places worth visiting, so a run covers the whole world rather than one field.
// Where the random walker teleports to: places on Oakvale Isle, in town, in the wilds, up the bell tower and down
// under the town and Bone Rocks (each must be free ground).
const PLACES = [
  [137, 102, 9], [128, 118, 8], [112, 103, 8], [110, 102, 9], [147, 102, 10], [147, 103, 13], [119, 135, 8], [147, 103, 8],
  [126, 129, 7], [131, 113, 7], [146, 139, 7], [126, 137, 6], [126, 111, 6], [127, 111, 5], [141, 106, 5],
  [80, 182, 7], [70, 184, 6], [81, 201, 8], [130, 160, 8], [70, 100, 8], [56, 128, 8], [190, 72, 8], [195, 118, 9], [176, 130, 8],
];
const WORDS = ['hi', 'quest', 'mission', 'yes', 'no', 'trade', 'bye', 'destiny', 'knight', 'paladin', 'sorcerer', 'druid',
  'parcel', 'heal', 'job', 'xyz', 'deposit all', 'withdraw 50', 'balance', 'ashport', 'valoria', 'houses', 'elm cottage',
  'leave', 'promotion', 'bless', 'king', 'lumen', 'vita minor', 'forma missile', 'ignis orbis', 'celeritas'];

function run(seed) {
  const game = loadGame({ seed });
  const { ctx, state, messages } = game;
  const A = state.Actions;
  const rnd = seededRandom(seed * 7919 + 1);
  const pick = list => list[Math.floor(rnd() * list.length)];
  const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  const recent = []; // last actions, printed when something goes wrong
  const stats = { ticks: 0, slowTicks: 0, maxTickMs: 0, totalMs: 0, deaths: 0, maxLevel: 1, floorsVisited: new Set() };
  let holding = null;

  const p = () => state.player;
  const nearby = r => [p().x + int(-r, r), p().y + int(-r, r)];
  // A random item reference into the bag (or a bag inside it), the equipment, or an open corpse.
  const anyRef = () => {
    const roll = rnd();
    if (roll < 0.15) return { root: 'equip', slot: pick(state.SLOTS) };
    if (roll < 0.25 && p().openPile) return { root: 'pile', pileId: p().openPile.id, path: [int(0, 4)] };
    if (roll < 0.3) return { root: 'depot', path: [int(0, 3)] };
    const c = state.bag().contents, i = int(0, Math.max(0, c.length - 1));
    return c[i] && c[i].contents && rnd() < 0.5 ? { root: 'bag', path: [i, int(0, 3)] } : { root: 'bag', path: [i] };
  };
  const anyDestination = () => {
    const roll = rnd();
    if (roll < 0.3) return { root: 'equip', slot: pick(state.SLOTS) };
    if (roll < 0.5) { const [x, y] = nearby(3); return { root: 'ground', x, y, z: p().z }; }
    if (roll < 0.6 && p().openPile) return { root: 'pile', pileId: p().openPile.id, path: [0] };
    if (roll < 0.7) return { root: 'depot', path: [0] };
    return { root: 'bag', path: [int(0, 8)] };
  };

  // Weighted random actions, roughly what a (frantic) human does.
  const ACTIONS = [
    [30, 'tap', () => { const k = pick(Object.keys(state.DIR_KEYS)); A.keyDown(k, false); A.keyUp(k); }],
    [6, 'hold', () => { holding = { key: pick(Object.keys(state.DIR_KEYS)), until: state.now + int(200, 2000) }; A.keyDown(holding.key, false); }],
    [8, 'walkTo', () => A.walkTo(...nearby(7))],
    [2, 'walkFar', () => A.walkTo(...nearby(40), 30000)],
    [6, 'use', () => { const [x, y] = nearby(2); A.interact('use', x, y, p().z); }],
    [4, 'talk', () => {
      const n = state.npcs.find(n => n.z === p().z && state.dist(n, p()) < 10);
      if (n) A.interact('talk', n.x, n.y, n.z);
    }],
    [8, 'say', () => A.say(pick(WORDS))],
    [12, 'target', () => A.targetNext()],
    [6, 'spell', () => { const s = ctx.spellsFor(p().vocation); if (s.length) A.castSpell(pick(s)); }],
    [5, 'useItem', () => A.useItem(anyRef())],
    [5, 'useWith', () => { const [x, y] = nearby(4); A.useItemOn(anyRef(), x, y, p().z); }],
    [6, 'move', () => A.moveItem(anyRef(), anyDestination(), rnd() < 0.3 ? int(1, 5) : undefined)],
    [1, 'pushThing', () => { const [x, y] = nearby(1); const [tx, ty] = nearby(2); A.moveItem({ root: 'map', x, y, z: p().z }, { root: 'ground', x: tx, y: ty, z: p().z }); }],
    [2, 'unequip', () => A.unequip(pick(state.SLOTS))],
    [5, 'loot', () => { const pl = p().openPile; if (pl && pl.items.length) A.takeFromPile(pl.id, int(0, pl.items.length - 1)); }],
    [1, 'lootAll', () => { const pl = p().openPile; if (pl) A.takeAll(pl.id); }],
    [3, 'trade', () => {
      const n = p().shopNpc;
      if (!n) return;
      if (rnd() < 0.5) A.buy(pick(n.def.trade.sells)[0], int(1, 20));
      else { const s = ctx.sellableItems(n); if (s.length) { const [id, , count] = pick(s); A.sell(id, int(1, count)); } }
    }],
    [2, 'hotkey', () => A.hotkey(pick(['h', 'm', 'f']))],
    [1, 'fkey', () => {
      A.setHotkeys({ F1: { type: 'spell', id: pick(Object.keys(state.SPELLS)) }, F2: { type: 'rune', id: 'rune_missile' }, F3: { type: 'item', id: 'health_potion' }, F4: { type: 'say', text: 'hi' } });
      A.useHotkey(pick(['F1', 'F2', 'F3', 'F4', 'F5']));
    }],
    [1, 'modes', () => { A.setFightMode(pick(['offensive', 'balanced', 'defensive'])); A.setChase(rnd() < 0.7); }],
    [0.5, 'outfit', () => A.setOutfit({ body: pick(['#ff0000', '#00ff00', 'bad']), legs: '#123456' })],
    [1, 'teleport', () => { const [x, y, z] = pick(PLACES); ctx.teleport({ x, y, z }); }],
    [0.6, 'xp', () => ctx.gainXp(int(10, 400))],
    [0.3, 'vocation', () => { if (p().level >= 10 && p().vocation === 'none') ctx.chooseVocation(pick(['knight', 'paladin', 'sorcerer', 'druid'])); }],
    [0.4, 'gear', () => { p().gold += int(50, 2000); ctx.addItem(pick(['blank_rune', 'rune_fireball', 'rune_magic_wall', 'rope', 'shovel', 'pick', 'fishing_rod', 'key_bronze', 'kit_chair', 'backpack']), int(1, 3)); }],
    [0.2, 'raid', () => ctx.startRaid(pick(state.RAIDS))],
    [0.2, 'saveLoad', () => { ctx.saveGame(); ctx.loadGame(); }],
    [0.3, 'stop', () => A.stop()],
    [3, 'heal', () => { p().hp = p().maxHp; p().mana = p().maxMana; }], // so runs don't spend all their time dead
  ];
  const totalWeight = ACTIONS.reduce((s, a) => s + a[0], 0);
  function randomAction() {
    let r = rnd() * totalWeight;
    for (const [w, name, act] of ACTIONS) {
      if ((r -= w) <= 0) {
        recent.push(`${(state.now / 1000).toFixed(1)}s ${name} @${p().x},${p().y},${p().z}`);
        if (recent.length > 25) recent.shift();
        act();
        return;
      }
    }
  }

  const fail = (what, err) => {
    const lines = [`seed ${seed}, ${(state.now / 1000).toFixed(1)} s: ${what}`];
    if (err) lines.push(err.stack || String(err));
    lines.push('last actions:', ...recent.map(a => `  ${a}`));
    lines.push('last messages:', ...messages.slice(-10).map(m => `  ${m}`));
    throw new Error(lines.join('\n'));
  };

  const ticks = Math.round((MINUTES * 60000) / TICK);
  let wasDead = false;
  for (let i = 0; i < ticks; i++) {
    state.now += TICK;
    if (rnd() < 0.08) {
      try { randomAction(); } catch (err) { fail('exception in a player action', err); }
    }
    if (holding && state.now > holding.until) { A.keyUp(holding.key); holding = null; }

    const t0 = process.hrtime.bigint();
    try { ctx.updateWorld(); } catch (err) { fail('exception in updateWorld', err); }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    stats.ticks++;
    stats.totalMs += ms;
    stats.maxTickMs = Math.max(stats.maxTickMs, ms);
    if (ms > SLOW_TICK_MS) stats.slowTicks++;
    if (ms > FREEZE_TICK_MS) fail(`one update took ${ms.toFixed(0)} ms`);

    if (p().dead && !wasDead) stats.deaths++;
    wasDead = p().dead;
    stats.maxLevel = Math.max(stats.maxLevel, p().level);
    stats.floorsVisited.add(p().z);
    p().events.length = 0;
    if (i % 6 === 0) {
      const problem = checkInvariants(state);
      if (problem) fail(`broken state: ${problem}`);
    }
  }
  stats.kills = messages.filter(m => m.startsWith('Loot of')).length;
  stats.quests = Object.values(p().quests).filter(q => q.status === 'done').length;
  return stats;
}

// Returns a description of the first thing that is wrong, or null.
function checkInvariants(state) {
  const { player: pl, map } = state;
  const finite = (o, keys, who) => {
    for (const k of keys) if (!Number.isFinite(o[k])) return `${who}.${k} is ${o[k]}`;
    return null;
  };
  const bad = finite(pl, ['x', 'y', 'z', 'hp', 'maxHp', 'mana', 'maxMana', 'xp', 'level', 'gold', 'bank'], 'player');
  if (bad) return bad;
  if (pl.hp < 0 || pl.hp > pl.maxHp) return `player hp ${pl.hp}/${pl.maxHp}`;
  if (pl.mana < 0 || pl.mana > pl.maxMana) return `player mana ${pl.mana}/${pl.maxMana}`;
  if (pl.gold < 0 || pl.bank < 0) return `negative gold ${pl.gold} / bank ${pl.bank}`;
  if (!map.inBounds(pl.x, pl.y, pl.z)) return `player out of bounds ${pl.x},${pl.y},${pl.z}`;
  const t = map.get(pl.x, pl.y, pl.z);
  const onDoor = t && t.items.some(id => state.THINGS[id].questDoor || state.THINGS[id].levelDoor);
  if (!pl.dead && !map.isWalkable(pl.x, pl.y, pl.z) && !onDoor) return `player stands on an unwalkable tile ${pl.x},${pl.y},${pl.z}`;
  if (pl.walk && !(pl.walk.dur > 0 && state.now - pl.walk.start < pl.walk.dur + 1000)) return `player walk stuck ${JSON.stringify(pl.walk)}`;
  for (const step of pl.path) if (!Array.isArray(step) || step.length !== 2) return 'bad path';

  const occupied = new Map();
  const occupy = (c, who) => {
    const k = `${c.x},${c.y},${c.z}`;
    if (occupied.has(k)) return `${who} and ${occupied.get(k)} share tile ${k}`;
    occupied.set(k, who);
    return null;
  };
  if (!pl.dead) occupy(pl, 'player');
  for (const n of state.npcs) { const e = occupy(n, n.name); if (e) return e; }
  for (const m of state.monsters) {
    if (m.dead) continue;
    const e = finite(m, ['x', 'y', 'z', 'hp'], m.name) || occupy(m, m.name);
    if (e) return e;
    if (!map.isWalkable(m.x, m.y, m.z)) return `${m.name} on an unwalkable tile ${m.x},${m.y},${m.z}`;
    if (m.hp <= 0 || m.hp > m.maxHp) return `${m.name} alive with hp ${m.hp}`;
    if (m.walk && state.now - m.walk.start > m.walk.dur + 1000) return `${m.name} walk stuck`;
  }

  const checkItem = (it, where) => {
    if (!it || !state.ITEMS[it.id]) return `unknown item in ${where}: ${JSON.stringify(it)}`;
    if (!Number.isInteger(it.count) || it.count < 1) return `bad count in ${where}: ${JSON.stringify(it)}`;
    if (!state.ITEMS[it.id].stack && it.count !== 1) return `stacked non-stackable in ${where}: ${JSON.stringify(it)}`;
    if (it.contents) {
      if (it.contents.length > state.ITEMS[it.id].container) return `${it.id} overfull in ${where}`;
      for (const inner of it.contents) { const e = checkItem(inner, `${where} > ${it.id}`); if (e) return e; }
    }
    return null;
  };
  const b = pl.equipment.backpack;
  if (!b || !b.contents) return 'no bag';
  for (const slot of state.SLOTS) {
    const it = pl.equipment[slot];
    if (!it) continue;
    const e = checkItem(it, slot);
    if (e) return e;
    if (state.ITEMS[it.id].slot !== slot) return `${it.id} worn in ${slot}`;
  }
  for (const it of pl.depot.contents) { const e = checkItem(it, 'depot'); if (e) return e; }
  if (pl.depot.contents.length > 40) return 'depot overfull';
  const w = pl.equipment.weapon && state.ITEMS[pl.equipment.weapon.id].weapon;
  if (w && w.twoHanded && pl.equipment.shield) return 'shield worn with a two-handed weapon';
  for (const pile of state.piles) for (const it of pile.items) { const e = checkItem(it, 'pile'); if (e) return e; }
  if (state.effects.length > 3000) return `effects piling up: ${state.effects.length}`;
  if (state.piles.length > 600) return `piles piling up: ${state.piles.length}`;
  if (state.monsters.length > state.map.spawns.length * 1.3 + 50) return `monsters piling up: ${state.monsters.length}`; // spawns, plus raids and summons
  return null;
}

let failed = false;
const started = Date.now();
console.log(`Simulating ${RUNS} run(s) of ${MINUTES} min of play...`);
for (let seed = FIRST_SEED; seed < FIRST_SEED + RUNS; seed++) {
  try {
    const s = run(seed);
    console.log(`  seed ${seed}: ok - ${s.kills} kills, ${s.deaths} deaths, level ${s.maxLevel}, ${s.quests} quests done, ` +
      `floors ${[...s.floorsVisited].sort().join('/')}, update avg ${(s.totalMs / s.ticks).toFixed(3)} ms, max ${s.maxTickMs.toFixed(1)} ms, ` +
      `${s.slowTicks} slow (>${SLOW_TICK_MS} ms)`);
  } catch (err) {
    failed = true;
    console.log(`  FAILED ${err.message}`);
  }
}
console.log(`${failed ? 'FAILED' : 'passed'} in ${((Date.now() - started) / 1000).toFixed(1)} s`);
process.exit(failed ? 1 : 0);
