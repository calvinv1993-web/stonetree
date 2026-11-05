'use strict';
// Unit tests for the game rules, run against the real game files in Node.
//   node tests/unit.test.js

const assert = require('assert');
const { loadGame } = require('./harness');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// Advance the game by `ms`, 60 updates per second like the browser.
function tick(game, ms) {
  for (let t = 0; t < ms; t += 1000 / 60) {
    game.state.now += 1000 / 60;
    game.ctx.updateWorld();
  }
}
// A world with no monsters, so nothing interferes.
function quietGame() {
  const game = loadGame();
  game.state.monsters = [];
  return game;
}
const bagRef = (state, id) => state.findInBag(it => it.id === id);

// A typo'd id in the data only blows up when the game first touches it, which
// can be minutes into play (a monster wandering onto a tile with an unknown
// thing froze the game this way). Check everything up front.
test('the default map is consistent', () => {
  const { state } = loadGame();
  const { map, THINGS } = state;
  for (const floor of map.floors) for (const t of floor) {
    if (!t) continue;
    for (const id of [t.ground, ...t.items]) if (id) assert(THINGS[id], `unknown thing ${id}`);
  }
  for (const p of [map.start, map.mainStart]) assert(map.isWalkable(p.x, p.y, p.z), 'start points are walkable');
  for (const [key, meta] of Object.entries(map.meta)) {
    if (meta.to) assert(map.isWalkable(meta.to.x, meta.to.y, meta.to.z), `teleport at ${key} leads somewhere walkable`);
    if (meta.target) assert(map.get(meta.target.x, meta.target.y, meta.target.z), `lever at ${key} has a target`);
  }
  assert.strictEqual(state.npcs.length, map.npcs.length);
  assert(state.monsters.length > 60, 'monsters spawned');
});

test('all data references exist', () => {
  const { state } = loadGame();
  const { ITEMS, THINGS, MONSTERS, NPCS, QUESTS, VOCATIONS, SPELLS, BUYS, map } = state;
  const item = (id, where) => assert(ITEMS[id], `${where}: unknown item ${id}`);
  for (const [id, m] of Object.entries(MONSTERS)) {
    for (const [loot] of (m.loot && m.loot.items) || []) item(loot, `loot of ${id}`);
    if (m.summon) assert(MONSTERS[m.summon.type], `${id} summons ${m.summon.type}`);
  }
  for (const [id, n] of Object.entries(NPCS)) {
    if (n.trade) {
      for (const [sold] of n.trade.sells) item(sold, `${id} sells`);
      for (const kind of n.trade.buys) assert(BUYS[kind], `${id} buys ${kind}`);
    }
    for (const answer of Object.values(n.keywords || {})) {
      if (answer.quest) for (const q of answer.quest) assert(QUESTS[q], `${id} talks about quest ${q}`);
      if (answer.travel) assert(map.isWalkable(answer.travel.to.x, answer.travel.to.y, answer.travel.to.z), `${id} sails somewhere walkable`);
      if (answer.vocation) assert(VOCATIONS[answer.vocation], `${id} vocation`);
    }
  }
  for (const [id, q] of Object.entries(QUESTS)) {
    if (q.giver) assert(NPCS[q.giver], `${id} giver`);
    for (const s of q.steps || [q]) {
      for (const type of Object.keys(s.kill || {})) assert(MONSTERS[type], `${id} kills ${type}`);
      if (s.fetch) item(s.fetch, `${id} fetch`);
      if (s.npc) assert(NPCS[s.npc], `${id} step npc ${s.npc}`);
    }
    for (const [reward] of (q.reward && q.reward.items) || []) item(reward, `${id} reward`);
  }
  for (const [id, t] of Object.entries(THINGS)) {
    if (t.toggle) assert(THINGS[t.toggle], `${id} toggles into ${t.toggle}`);
    if (!t.chest) continue;
    for (const [reward] of t.chest.items || []) item(reward, `chest ${id}`);
    if (t.chest.quest) assert(QUESTS[t.chest.quest], `chest ${id} quest`);
    if (t.chest.requires) assert(QUESTS[t.chest.requires], `chest ${id} requires`);
  }
  for (const [id, v] of Object.entries(VOCATIONS)) for (const [kit] of v.kit || []) item(kit, `${id} kit`);
  for (const [id, s] of Object.entries(SPELLS)) {
    for (const v of s.vocs || []) assert(VOCATIONS[v], `${id} vocation ${v}`);
    if (s.item) item(s.item, `${id} conjures`);
  }
  for (const [id, d] of Object.entries(ITEMS)) if (d.kit) assert(THINGS[d.kit], `${id} sets up ${d.kit}`);
  for (const s of map.spawns) assert(MONSTERS[s.type], `spawn ${s.type}`);
  for (const n of map.npcs) assert(NPCS[n.type], `npc ${n.type}`);
});

test('findPath walks around walls and respects range', () => {
  const { ctx, state } = loadGame();
  const pass = (x, y) => state.map.isWalkable(x, y, 4);
  const path = ctx.findPath(pass, 31, 31, 31, 36);
  assert(path && path.length >= 5);
  for (const [x, y] of path) assert(pass(x, y));
  assert(ctx.findPath(pass, 31, 31, 31, 36, { range: 3 }).length < path.length);
  assert.strictEqual(ctx.findPath(pass, 31, 31, 110, 60, { maxNodes: 500 }), null, 'no path across the sea');
});

test('bags: stacking, slots, bags inside bags, and capacity', () => {
  const { ctx, state } = quietGame();
  const p = state.player;
  p.level = 30; // enough capacity for all of this
  state.bag().contents = [];
  assert.strictEqual(ctx.addItem('arrow', 250), 0);
  assert.deepStrictEqual(state.bag().contents.map(i => i.count), [100, 100, 50]);
  ctx.addItem('backpack', 1); // a backpack inside the bag holds more
  assert.strictEqual(ctx.addItem('dagger', 10), 0, 'what does not fit in the bag goes into the backpack inside it');
  assert.strictEqual(state.countItem('dagger'), 10);
  assert(ctx.removeItem('arrow', 120));
  assert.strictEqual(state.countItem('arrow'), 130);
  const gold = p.gold;
  ctx.addItem('gold', 15);
  assert.strictEqual(p.gold, gold + 15, 'gold goes into the purse');
  const left = ctx.addItem('plate_armor', 10);
  assert(left > 0 && state.freeCapacity() < 120, 'capacity limits what you can carry');
});

test('drag and drop: equipping, two-handed weapons, rings, the ground', () => {
  const { ctx, state } = quietGame();
  const p = state.player, A = state.Actions;
  state.bag().contents = [];
  ctx.addItem('wooden_shield');
  A.moveItem(bagRef(state, 'wooden_shield'), { root: 'equip', slot: 'shield' });
  assert.strictEqual(p.equipment.shield.id, 'wooden_shield');
  ctx.addItem('bow');
  A.moveItem(bagRef(state, 'bow'), { root: 'equip', slot: 'weapon' });
  assert.strictEqual(p.equipment.weapon.id, 'bow');
  assert.strictEqual(p.equipment.shield, null, 'a bow needs both hands');
  ctx.addItem('plate_armor');
  A.moveItem(bagRef(state, 'plate_armor'), { root: 'equip', slot: 'body' });
  assert.strictEqual(p.equipment.body, null, 'plate armor needs level 15 and a knight');
  ctx.addItem('arrow', 30);
  A.moveItem(bagRef(state, 'arrow'), { root: 'equip', slot: 'ammo' }, 10);
  assert.strictEqual(p.equipment.ammo.count, 10, 'part of a stack can be moved');
  assert.strictEqual(state.countItem('arrow'), 20);
  ctx.addItem('ring_life');
  A.moveItem(bagRef(state, 'ring_life'), { root: 'equip', slot: 'ring' });
  const time = p.equipment.ring.time;
  tick({ ctx, state }, 2000);
  assert(p.equipment.ring.time < time, 'a worn ring runs out');
  A.moveItem(bagRef(state, 'arrow'), { root: 'ground', x: p.x + 1, y: p.y, z: p.z });
  const pile = state.pileAt(p.x + 1, p.y, p.z);
  assert(pile && pile.items[0].count === 20, 'dropped on the ground');
  A.takeFromPile(pile.id, 0);
  assert.strictEqual(state.countItem('arrow'), 20, 'and picked up again');
});

test('stairs, closed doors, locked doors with keys, level and quest doors', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, A = state.Actions;
  ctx.teleport({ x: 35, y: 42, z: 4 });
  A.keyDown('d');
  A.keyUp('d');
  tick(game, 500);
  assert.strictEqual(p.z, 3, 'went down the cellar stairs');
  A.walkTo(36, 42);
  tick(game, 1500);
  assert.strictEqual(p.z, 4, 'came back up');

  ctx.teleport({ x: 96, y: 49, z: 4 }); // house door: only for whoever rents it
  A.keyDown('w');
  A.keyUp('w');
  tick(game, 400);
  assert(state.map.get(96, 48, 4).items.includes('door_house'), 'a house door stays shut for strangers');

  p.level = 25;
  ctx.teleport({ x: 44, y: 102, z: 3 });
  A.walkTo(46, 102);
  tick(game, 1500);
  assert(p.x >= 46, 'the level door lets level 25 through');
  A.walkTo(47, 102);
  tick(game, 600);
  A.keyDown('d');
  A.keyUp('d');
  tick(game, 600);
  assert(state.map.get(48, 102, 3).items.includes('door_locked'), 'locked without the key');
  ctx.addItem('key_bronze');
  A.keyDown('d');
  A.keyUp('d');
  tick(game, 600);
  assert(state.map.get(48, 102, 3).items.includes('door'), 'the bronze key unlocks it');
  ctx.teleport({ x: 53, y: 102, z: 3 });
  A.keyDown('d');
  A.keyUp('d');
  tick(game, 600);
  assert(p.x === 53, 'the sealed door stays closed before the quest');
  p.quests.drowned_king = { status: 'active', step: 2, kills: {} };
  A.keyDown('d');
  A.keyUp('d');
  tick(game, 600);
  assert(p.x === 54, 'and lets you through at the right quest step');
});

test('levers, teleports and tools', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, A = state.Actions;
  ctx.teleport({ x: 31, y: 102, z: 3 });
  A.interact('use', 31, 101, 3);
  tick(game, 100);
  assert(!state.map.get(28, 100, 3).items.includes('wall_secret'), 'the lever opens the secret wall');
  ctx.teleport({ x: 56, y: 103, z: 3 });
  A.walkTo(56, 104);
  tick(game, 800);
  assert.strictEqual(p.z, 4, 'the forcefield teleports you out');
  ctx.teleport({ x: 58, y: 40, z: 4 });
  ctx.addItem('shovel');
  A.useItemOn(bagRef(state, 'shovel'), 59, 40, 4);
  assert(state.map.get(59, 40, 4).items.includes('hole'), 'the shovel digs a hole in loose sand');
  ctx.teleport({ x: 7, y: 59, z: 3 });
  ctx.addItem('pick');
  A.useItemOn(bagRef(state, 'pick'), 6, 59, 3);
  assert(!state.map.get(6, 59, 3).items.includes('cracked_rock'), 'the pick breaks the cracked rock');
  ctx.teleport({ x: 90, y: 48, z: 3 });
  ctx.addItem('rope');
  A.useItemOn(bagRef(state, 'rope'), 89, 48, 3);
  assert.strictEqual(p.z, 4, 'the rope pulls you up through the rope spot');
});

test('combat: killing a monster gives xp, loot, and trains the skill', () => {
  const game = loadGame({ seed: 5 });
  const { ctx, state } = game;
  const p = state.player;
  const rat = state.monsters.find(m => m.type === 'rat' && m.z === 3);
  state.monsters = [rat];
  ctx.teleport({ x: rat.x - 1, y: rat.y, z: 3 });
  state.Actions.setTarget(rat.id);
  for (let i = 0; i < 60 && !rat.dead; i++) tick(game, 1000);
  assert(rat.dead, 'the rat died');
  assert.strictEqual(p.xp, 5);
  assert(p.skills.club.tries > 0 || p.skills.club.level > 10, 'club fighting trained');
  assert(state.piles.find(pl => pl.corpse && pl.name === 'dead rat'));
  tick(game, 65000);
  assert.strictEqual(state.monsters[0], rat, 'monsters do not respawn while you can see their spot');
  ctx.teleport(state.map.start);
  tick(game, 6000);
  assert(state.monsters[0] !== rat && !state.monsters[0].dead, 'the rat respawned once you left');
});

test('conditions, fields and runes', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player;
  ctx.applyCondition(p, 'poison', 5);
  const hp = p.hp;
  tick(game, 2200);
  assert(p.hp < hp, 'poison hurts');
  tick(game, 12000);
  assert(!p.conditions.poison, 'and wears off');
  ctx.teleport({ x: 92, y: 72, z: 4 }); // out of the temple: monsters never set foot in one
  const orc = ctx.spawnMonster({ type: 'orc', x: p.x + 2, y: p.y, z: p.z });
  state.monsters.push(orc);
  ctx.createField('fire', orc.x, orc.y, orc.z, p.id);
  tick(game, 2500);
  assert(orc.hp < orc.maxHp, 'a fire field burns whoever stands in it');
  ctx.createField('magic_wall', p.x, p.y - 1, p.z, p.id);
  assert(!state.isFree(p.x, p.y - 1, p.z), 'a magic wall blocks the way');
  p.skills.magic.level = 5;
  ctx.addItem('rune_missile', 3);
  const before = orc.hp;
  state.Actions.useItemOn(bagRef(state, 'rune_missile'), orc.x, orc.y, orc.z);
  assert(orc.hp < before || orc.dead, 'the missile rune hits');
  assert.strictEqual(state.countItem('rune_missile'), 2, 'and used one charge');
});

test('spells: words, conjuring, waves and haste', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, A = state.Actions;
  Object.assign(p, { vocation: 'sorcerer', level: 20, mana: 1000, maxMana: 1000 });
  ctx.addItem('blank_rune', 1);
  A.say('forma missile');
  assert.strictEqual(state.countItem('rune_missile'), 5, 'saying the words casts the spell');
  assert.strictEqual(state.countItem('blank_rune'), 0);
  state.now += 2000;
  ctx.teleport({ x: 92, y: 72, z: 4 }); // out of the temple: monsters never set foot in one
  p.dir = 1;
  const rat = ctx.spawnMonster({ type: 'skeleton', x: p.x + 2, y: p.y, z: p.z });
  state.monsters.push(rat);
  A.castSpell('energy_beam');
  assert(rat.hp < rat.maxHp || rat.dead, 'the beam hits what is in front of you');
  state.now += 2000;
  const speed = ctx.speedOf(p);
  A.castSpell('haste');
  assert(ctx.speedOf(p) < speed, 'haste makes you faster');
});

test('quests: from dialog to reward, and a quest with several steps', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  A.say('hi');
  A.say('quest');
  A.say('yes');
  assert.strictEqual(state.questState('rat_problem'), 'active');
  for (let i = 0; i < 5; i++) ctx.onMonsterKilled('rat');
  A.say('quest');
  assert.strictEqual(state.questState('rat_problem'), 'done');
  assert(state.countItem('leather_cap') === 1 && messages.some(m => m.startsWith('Elder Maren: Well done')));
  A.say('bye');

  p.level = 25;
  ctx.teleport({ x: 50, y: 94, z: 4 });
  A.say('hi'); A.say('king'); A.say('yes');
  assert.strictEqual(p.quests.drowned_king.step, 0);
  A.say('king');
  assert(/lighthouse keeper is waiting/i.test(messages[messages.length - 1]), 'Ida sends you to the keeper first');
  A.say('bye');
  ctx.teleport({ x: 12, y: 94, z: 4 });
  A.say('hi'); A.say('king'); A.say('bye');
  assert.strictEqual(p.quests.drowned_king.step, 1, 'talking to the keeper finishes step 1');
  ctx.openChest(state.THINGS.qchest_chart.chest);
  ctx.teleport({ x: 50, y: 94, z: 4 });
  A.say('hi'); A.say('chart');
  assert.strictEqual(p.quests.drowned_king.step, 2, 'bringing the chart finishes step 2');
  assert.strictEqual(state.countItem('sea_chart'), 0, 'and Ida keeps it');
  ctx.onMonsterKilled('drowned_king');
  A.say('king');
  assert.strictEqual(state.questState('drowned_king'), 'done');
});

test('a sock for Dobby: the trunk in the Webwood only opens once you are looking for it', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  Object.assign(p, { level: 25, vocation: 'knight' });
  const dobby = state.npcs.find(n => n.npcId === 'dobby');
  ctx.teleport({ x: dobby.x + 1, y: dobby.y, z: dobby.z });
  ctx.openChest(state.THINGS.qchest_trunk.chest);
  assert.strictEqual(state.countItem('old_sock'), 0, 'the trunk is stuck before the quest');
  A.say('hi'); A.say('free'); A.say('yes');
  assert.strictEqual(state.questState('free_elf'), 'active');
  ctx.openChest(state.THINGS.qchest_trunk.chest);
  assert.strictEqual(state.countItem('old_sock'), 1);
  A.say('sock');
  assert.strictEqual(state.questState('free_elf'), 'done');
  assert.strictEqual(state.countItem('old_sock'), 0, 'Dobby keeps the sock');
  assert(state.countItem('ring_swift') === 1 && messages.some(m => /A sock!/.test(m)));
});

test('rides: you travel there tile by tile; cabs keep to land, balloons fly over water, Dom is fast', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  Object.assign(p, { vocation: 'knight', level: 20, gold: 5000, home: 'main' });
  ctx.teleport({ x: 112, y: 52, z: 4 }); // Valoria's square: the cab goes down the street to the lower town
  const start = { x: p.x, y: p.y }, goal = { x: p.x, y: p.y + 14 };
  A.orderRide(goal.x, goal.y, 'cab');
  assert(p.ride && p.gold === 5000 - ctx.rideCost('cab', start, goal), 'the cab is paid and on its way');
  tick(game, 1000);
  assert(p.x === start.x && p.y === start.y, 'waiting to be picked up');
  tick(game, 1600);
  assert(p.ride && p.ride.boarded && p.y > start.y && p.y < goal.y, 'riding along, tile by tile');
  const seen = [];
  for (let i = 0; i < 40 && p.ride; i++) {
    tick(game, 100);
    seen.push(p.y);
  }
  assert(!p.ride && p.y === goal.y, 'dropped off at the destination');
  assert(new Set(seen).size > 5, 'passing every tile on the way');

  const before = p.gold;
  A.orderRide(start.x, start.y, 'dom');
  assert.strictEqual(before - p.gold, 3 * ctx.rideCost('cab', goal, start), 'Dom costs three times as much');
  tick(game, 1400);
  assert(state.effects.some(fx => fx.kind === 'speech' && fx.name === 'Dom' && /family/.test(fx.text)), 'Dom says his thing');
  tick(game, 1900 + 900);
  tick(game, 14 * 50 + 200);
  assert(!p.ride && p.y === start.y, 'and is three times as fast');

  ctx.teleport({ x: 79, y: 72, z: 4 }); // the pier: Ashport is over the water
  A.orderRide(53, 93, 'cab');
  assert(!p.ride && /over land/.test(messages[messages.length - 1]), 'a cab cannot cross the sea');
  A.orderRide(53, 93, 'balloon');
  assert(p.ride, 'a balloon can');
  tick(game, 2500 + 40 * 180);
  assert(!p.ride && Math.abs(p.x - 53) <= 3 && Math.abs(p.y - 93) <= 3, 'and lands in Ashport');

  p.skullUntil = state.now + 60000;
  A.orderRide(60, 93, 'cab');
  assert(!p.ride && /attacked a player/.test(messages[messages.length - 1]), 'nobody gives you a ride with a skull');
});

test('player killers get a skull: no temples or other buildings for them, until it fades', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  const victim = ctx.newPlayer('Victim');
  state.players.push(victim);
  for (const c of [p, victim]) Object.assign(c, { vocation: 'knight', level: 20, home: 'main', secure: false });
  // on the Valoria square, below the temple door (112,50)
  ctx.teleport({ x: 114, y: 53, z: 4 });
  Object.assign(victim, { x: 113, y: 52, z: 4 });
  A.setTarget(victim.id);
  tick(game, 1500);
  assert(p.skullUntil > state.now, 'attacking an innocent player gives you a skull');
  A.stop();
  ctx.asPlayer(victim, () => ctx.walkTo(112, 48));
  for (let i = 0; i < 40; i++) ctx.asPlayer(victim, () => tick(game, 100));
  assert(state.map.isProtected(victim.x, victim.y, 4), 'the victim flees into the temple');
  ctx.teleport({ x: 112, y: 51, z: 4 });
  A.keyDown('w', false);
  tick(game, 600);
  A.keyUp('w');
  assert.strictEqual(p.y, 51, 'the skulled player cannot follow');
  assert(messages.some(m => /may not enter a protection zone/.test(m)));
  A.setTarget(victim.id);
  assert(!p.target, 'and nobody fights inside');
  const intoTheShop = () => {
    Object.assign(p, { x: 102, y: 54, z: 4, walk: null, path: [] }); // at the door of Dask's armoury
    A.keyDown('a', false);
    tick(game, 600);
    A.keyUp('a');
    return p.x <= 101;
  };
  tick(game, 2000); // (the game says "not possible" once in a while, not at every step)
  assert(!intoTheShop() && messages.some(m => /with a white skull/.test(m)), 'nor into a shop');
  tick(game, 3 * 60000);
  assert(!p.skullUntil && messages.some(m => /skull has faded/.test(m)), 'the skull fades after a while');
  assert(intoTheShop(), 'and then the shops are open again');
  p.skullUntil = state.now + 60000;
  ctx.asPlayer(p, () => ctx.damagePlayer(null, 99999, 'physical'));
  assert(p.dead && !p.skullUntil, 'and dying wipes it right away');
});

test('rides: not right after attacking someone (a white skull), but a red skull alone may ride', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  Object.assign(p, { vocation: 'knight', level: 30, gold: 5000, home: 'main' });
  ctx.teleport({ x: 112, y: 52, z: 4 });
  p.skullUntil = state.now + 60000;
  A.orderRide(112, 66, 'cab');
  assert(!p.ride && messages.some(m => /just attacked/.test(m)), 'no ride with a white skull');
  Object.assign(p, { skullUntil: 0, pzLockUntil: 0, redSkullUntil: state.now + 3600000 });
  A.orderRide(112, 66, 'cab');
  assert(p.ride, 'a red skull alone may take a cab');
});

test('a red skull, after dying: back in the temple, and free to come and go', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, A = state.Actions;
  Object.assign(p, { vocation: 'knight', level: 30, home: 'main', redSkullUntil: state.now + 3600000, skullUntil: state.now + 60000, pzLockUntil: state.now + 60000 });
  ctx.asPlayer(p, () => ctx.damagePlayer(null, 99999, 'physical'));
  tick(game, 3500);
  assert(!p.dead && state.map.isProtected(p.x, p.y, p.z), 'you wake up in the temple');
  assert(p.redSkullUntil > state.now && !p.skullUntil && !p.pzLockUntil, 'the red skull stays, the fight is over');
  Object.assign(p, { x: 112, y: 51, z: 4, walk: null, path: [] }); // just outside Valoria's temple door
  A.keyDown('w', false);
  tick(game, 800);
  A.keyUp('w');
  assert(state.map.isProtected(p.x, p.y, 4), 'and you can walk back into the temple');
});

test('skulls as in Tibia: white for attacking innocents, yellow for those who fight back, red for killers', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const a = state.player, A = state.Actions;
  const mk = name => {
    const p = ctx.newPlayer(name);
    Object.assign(p, { vocation: 'knight', level: 20, home: 'main', hp: 300, maxHp: 300, x: 112, y: 72, z: 4, secure: false });
    state.players.push(p);
    return p;
  };
  Object.assign(a, { vocation: 'knight', level: 20, home: 'main', secure: false });
  ctx.teleport({ x: 112, y: 70, z: 4 });
  const b = mk('Bea'), c = mk('Cid');
  const hit = (from, to, dmg) => ctx.asPlayer(from, () => ctx.hurt(to, dmg, 'physical'));

  hit(a, b, 10);
  assert(a.skullUntil > state.now && a.pzLockUntil > state.now, 'attacking an innocent: a white skull and a fight lock');
  assert.strictEqual(ctx.skullOf(a, c), 'white', 'everyone sees it');
  hit(b, a, 10);
  assert(!(b.skullUntil > state.now), 'fighting back against a skull is fine');
  assert.strictEqual(ctx.skullOf(b, a), 'yellow', 'the one who started it sees a yellow skull...');
  assert.strictEqual(ctx.skullOf(b, c), null, '...nobody else does');
  hit(a, b, 9999);
  assert(b.dead && !a.frags.length, 'killing someone who fought you back is not unjustified');

  for (let i = 0; i < 3; i++) {
    const v = mk(`Victim${i}`);
    hit(a, v, 9999);
    assert(v.dead);
  }
  assert(a.redSkullUntil > state.now && messages.some(m => /RED SKULL/.test(m)), 'three unjustified kills in a day: a red skull');
  assert.strictEqual(ctx.skullOf(a, c), 'red');
  hit(c, a, 10);
  assert(!(c.skullUntil > state.now), 'anyone may attack a red skull');
  a.blessed = true;
  ctx.asPlayer(a, () => ctx.damagePlayer(c, 99999, 'physical'));
  assert(a.dead && ['body', 'legs', 'weapon', 'shield', 'head', 'feet'].every(slot => !a.equipment[slot]), 'and dying with it costs everything, blessing or not');
});

test('they killed Kenny! He comes back anyway', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player;
  Object.assign(p, { vocation: 'knight', level: 20, home: 'main' });
  ctx.teleport({ x: 100, y: 70, z: 4 });
  const kenny = ctx.spawnMonster(state.map.spawns.find(s => s.type === 'kenny'));
  state.monsters = [kenny];
  ctx.damageMonster(kenny, 999, 'physical');
  assert(kenny.dead && state.effects.some(fx => /they killed Kenny/.test(fx.text || '')), 'someone notices');
  tick(game, 4500);
  const back = state.monsters[0];
  assert(back !== kenny && !back.dead && state.dist(back, p) <= 11, 'he comes back right away, from the side of your screen');
  const d0 = state.dist(back, kenny);
  tick(game, 3000);
  assert(state.dist(state.monsters[0], kenny) < d0, 'walking back to where he fell');
});

test('hunting together: the experience is shared by damage, and everyone gets the kill', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const a = state.player, b = ctx.newPlayer('Friend');
  state.players.push(b);
  Object.assign(a, { vocation: 'knight', level: 30, home: 'main' });
  ctx.teleport({ x: 92, y: 72, z: 4 });
  Object.assign(b, { vocation: 'knight', level: 30, x: a.x + 1, y: a.y, z: 4 });
  const wolf = ctx.spawnMonster({ type: 'wolf', x: a.x, y: a.y + 2, z: 4 });
  state.monsters = [wolf];
  const before = a.xp + b.xp, xp = state.MONSTERS.wolf.xp;
  ctx.asPlayer(b, () => ctx.damageMonster(wolf, Math.ceil(wolf.maxHp / 2), 'energy'));
  while (!wolf.dead) ctx.damageMonster(wolf, wolf.maxHp, 'energy');
  assert(a.xp > 0 && b.xp > 0, 'both hunters get experience');
  assert(Math.abs(a.xp + b.xp - before - xp) <= 1, `split by damage, no bonus without a party (${a.xp + b.xp - before} of ${xp})`);
});

test('a party: invite, join, shared experience with a bonus while it is fair, no hurting each other', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const a = state.player, b = ctx.newPlayer('Friend'), A = state.Actions;
  state.players.push(b);
  Object.assign(a, { vocation: 'knight', level: 30, home: 'main' });
  ctx.teleport({ x: 92, y: 72, z: 4 });
  Object.assign(b, { vocation: 'druid', level: 24, x: a.x + 1, y: a.y, z: 4 });
  A.partyInvite(b.id);
  assert.strictEqual(ctx.partyMark(b, a), 'invited', 'the leader sees an invited player');
  assert.strictEqual(ctx.partyMark(a, b), 'inviter', 'and they see who invited them');
  ctx.asPlayer(b, () => A.partyJoin(a.id));
  assert(a.party && a.party === b.party, 'they are in one party');
  assert.strictEqual(ctx.partyMark(a, b), 'leader');
  A.setTarget(b.id);
  assert(!a.target && messages.some(m => /in your party/.test(m)), 'in secure mode, party members cannot attack each other');

  const hunt = (dmgA, dmgB) => {
    const wolf = ctx.spawnMonster({ type: 'wolf', x: a.x, y: a.y + 2, z: 4 });
    state.monsters = [wolf];
    ctx.asPlayer(b, () => ctx.damageMonster(wolf, dmgB, 'energy'));
    ctx.damageMonster(wolf, dmgA, 'energy');
  };
  const xp = state.MONSTERS.wolf.xp;
  ctx.partyShareXp(true);
  assert(state.parties[0].shared, 'the leader shares the experience');
  let [xa, xb] = [a.xp, b.xp];
  hunt(1000, 1);
  assert(ctx.partyShare(state.parties[0]).active, 'everyone is close, near in level and fighting');
  assert.strictEqual(a.xp - xa, b.xp - xb, 'shared evenly, whoever did the damage');
  assert(Math.abs(a.xp - xa + b.xp - xb - xp * 1.3) <= 1, `with a bonus for two vocations (${a.xp - xa + b.xp - xb} of ${xp})`);

  b.level = 19; // below two thirds of 30
  assert(/too low a level/.test(ctx.partyShare(state.parties[0]).reason), 'the levels must be within two thirds');
  [xa, xb] = [a.xp, b.xp];
  hunt(1000, 1);
  assert(a.xp - xa > b.xp - xb, 'then everyone gets their own share again');
  b.level = 24;
  state.now += 3 * 60000;
  ctx.asPlayer(b, () => { b.foughtAt = 0; });
  assert(/has not fought/.test(ctx.partyShare(state.parties[0]).reason), 'and everyone must have fought lately');

  A.partyLeave();
  assert(!a.party && !b.party && !state.parties.length, 'the leader leaves: one member left, so the party is over');
});

test('a guild: found it, invite and join, ranks, nicks, chat, and it shows when you look', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const a = state.player, b = ctx.newPlayer('Friend'), A = state.Actions;
  state.players.push(b);
  Object.assign(a, { vocation: 'knight', level: 30, home: 'main' });
  ctx.teleport({ x: 92, y: 72, z: 4 });
  Object.assign(b, { vocation: 'paladin', level: 25, x: a.x + 1, y: a.y, z: 4 });
  A.guildCreate('x');
  assert(!Object.keys(state.guilds).length, 'a guild needs a proper name');
  A.guildCreate('Dawn Guard');
  assert(state.guilds['dawn guard'], 'founded');
  A.guildInvite('friend');
  assert(ctx.guildView(b).invites.includes('Dawn Guard'), 'they see the invitation');
  ctx.asPlayer(b, () => A.guildJoin('Dawn Guard'));
  assert.strictEqual(ctx.guildInfo(b).rank, 'Member', 'they join as a member');
  A.guildSetRank('Friend', 1);
  A.guildNick('Friend', 'Hawkeye');
  assert.strictEqual(JSON.stringify(ctx.guildInfo(b)), JSON.stringify({ name: 'Dawn Guard', rank: 'Vice-Leader', nick: 'Hawkeye' }));
  messages.length = 0;
  ctx.look(b.x, b.y);
  assert(messages.some(m => m === 'You see Friend (Level 25). They are a paladin. They are Vice-Leader of the Dawn Guard (Hawkeye).'), messages.join(' | '));
  ctx.asPlayer(b, () => A.say('/g hello guild'));
  assert(messages.some(m => m === 'Friend: hello guild'), 'the guild channel');
  A.guildLeave();
  assert(ctx.guildInfo(a).rank === 'Leader', 'the leader cannot just leave');
  ctx.asPlayer(b, () => A.guildKick('Tester'));
  assert(ctx.guildInfo(a), 'nor be kicked by a lower rank');
  A.guildKick('Friend');
  assert(!ctx.guildInfo(b), 'the leader removes a member');
  A.guildDisband();
  assert(!Object.keys(state.guilds).length, 'and can disband the guild');
});

test('the forge: better ore, better chances; fusing ore; mining it; forged gear is better and not for sale', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  Object.assign(p, { vocation: 'knight', level: 30, home: 'main', gold: 10000 });
  // the odds, as in the example: a blue (rare) weapon for purple (epic) with two purple and two blue ore
  assert.strictEqual(ctx.forgeChance(3, [3, 3, 2, 2]), 50);
  assert.strictEqual(ctx.forgeChance(3, [3, 3, 3, 3]), 80, 'all of the grade you want: a good chance');
  assert.strictEqual(ctx.forgeChance(3, [4, 4, 4, 4]), 100, 'better ore never fails');
  assert.strictEqual(ctx.forgeChance(3, [2, 2, 2, 2]), 20, 'ore a grade below barely helps');
  assert.strictEqual(ctx.forgeChance(3, [1, 1, 1, 1]), 0);

  p.equipment.weapon = ctx.makeItem('longsword');
  const plain = ctx.playerWeapon().attack;
  ctx.addItem('ore_iron', 4);
  A.forgeItem({ root: 'equip', slot: 'weapon' }, [1, 1, 1, 1]);
  assert(!p.equipment.weapon.q && state.countItem('ore_iron') === 4, 'only at a smith');

  const dask = state.npcs.find(n => n.npcId === 'dask');
  ctx.teleport({ ...ctx.findFreeTile(dask.x, dask.y, dask.z, 2), z: dask.z });
  A.forgeItem({ root: 'equip', slot: 'weapon' }, [2, 2, 2, 2]);
  assert(/don't have/.test(messages[messages.length - 1]), 'you need the ore you put in');
  ctx.addItem('ore_mithril', 4);
  A.forgeItem({ root: 'equip', slot: 'weapon' }, [2, 2, 2, 2]); // better than fine: certain
  assert.strictEqual(p.equipment.weapon.q, 1, 'forged a grade up');
  assert(ctx.playerWeapon().attack > plain, 'and it hits harder');
  assert.strictEqual(p.gold, 10000 - 100, 'for a fee');
  ctx.addItem('ore_rough', 4);
  A.forgeItem({ root: 'equip', slot: 'weapon' }, [0, 0, 0, 0]); // two grades below rare: no chance
  assert(p.equipment.weapon.q === 1 && !state.countItem('ore_rough'), 'a failure costs the ore, never the item');

  ctx.addItem('ore_rough', 9);
  A.fuseOre(0, 5);
  assert.strictEqual(state.countItem('ore_rough'), 1, 'fusing: four into one, as often as you have four');
  assert.strictEqual(state.countItem('ore_iron'), 4 + 2);

  ctx.addItem('pick', 1);
  const t = state.map.ensure(p.x + 1, p.y, p.z);
  t.items.push('ore_vein');
  const ores = () => ['ore_rough', 'ore_iron', 'ore_mithril', 'ore_starsteel', 'ore_sunsteel'].reduce((n, id) => n + state.countItem(id), 0);
  const had = ores();
  A.useItemOn(bagRef(state, 'pick'), p.x + 1, p.y, p.z);
  assert(ores() > had && !t.items.includes('ore_vein'), 'a pick mines ore from a vein, and the vein is spent');

  ctx.addItem('longsword', 1);
  state.bagItems().find(it => it.id === 'longsword').q = 2;
  assert(!ctx.removeItem('longsword', 1), 'forged gear is never taken by mistake (selling, quests)');
});

test('fires: use one to put it out (no light then), again to light it; out, it lights itself again later', () => {
  const game = quietGame();
  const { state } = game;
  const p = state.player, A = state.Actions;
  const t = state.map.ensure(p.x + 1, p.y, p.z);
  t.items.push('torch');
  A.interact('use', p.x + 1, p.y, p.z);
  tick(game, 100);
  assert(t.items.includes('torch_out') && !state.THINGS.torch_out.light, 'put out: no more light');
  A.interact('use', p.x + 1, p.y, p.z);
  tick(game, 100);
  assert(t.items.includes('torch'), 'lit again');
  A.interact('use', p.x + 1, p.y, p.z);
  tick(game, 100);
  tick(game, 10 * 60000 + 1000);
  assert(t.items.includes('torch') && t.items.filter(id => /torch/.test(id)).length === 1, 'and it lights itself again, once');
});

test('home town: become a citizen at a temple, and wake up there when you die', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  Object.assign(p, { vocation: 'knight', level: 30, home: 'main' });
  const sigrun = state.npcs.find(n => n.npcId === 'sigrun');
  ctx.teleport({ x: sigrun.x, y: sigrun.y + 1, z: sigrun.z });
  A.say('hi');
  A.say('citizen');
  A.say('yes');
  assert.strictEqual(p.home, 'frosthold', 'a citizen of Frosthold now');
  ctx.teleport({ x: 92, y: 72, z: 4 });
  p.hp = 1;
  ctx.damagePlayer(null, 50, 'physical');
  tick(game, 30000);
  assert(!p.dead && state.dist(p, sigrun) < 10 && p.z === sigrun.z, `and wakes up in its temple (at ${p.x},${p.y})`);
  assert(messages.some(m => /temple of Frosthold/.test(m)));
});

test('the Ember Seal: the main story, chapter by chapter, from Orin to the Drowned King', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  Object.assign(p, { vocation: 'knight', level: 22, home: 'main' });
  const talkTo = (id, ...lines) => {
    const n = state.npcs.find(x => x.npcId === id);
    A.say('bye');
    ctx.teleport({ ...ctx.findFreeTile(n.x, n.y + 1, n.z, 2), z: n.z });
    A.say('hi');
    for (const line of lines) A.say(line);
  };
  const kill = type => { const m = ctx.spawnMonster({ type, x: p.x + 2, y: p.y, z: p.z }); state.monsters.push(m); while (!m.dead) ctx.damageMonster(m, 5000, 'holy'); };
  talkTo('jarl', 'ember');
  assert(messages.some(m => /Grandmaster in Valoria/.test(m)), 'before it is your chapter, people point you to Orin');
  talkTo('orin', 'seal', 'yes');
  assert.strictEqual(state.questState('seal_1'), 'active', 'Orin can start the story too (the test server skips the Seer)');
  A.say('seal');
  assert.strictEqual(state.questState('seal_1'), 'done', 'chapter I: his tale');
  A.say('seal');
  A.say('yes');
  for (let i = 0; i < 6; i++) kill('dark_mage');
  talkTo('orin', 'seal');
  assert.strictEqual(state.questState('seal_2'), 'done', 'chapter II: the Ashen Choir');
  A.say('seal');
  A.say('yes');
  talkTo('ida', 'ember');
  assert(messages.some(m => /Drowned King/.test(m)), 'Ida knows who has the Tide Ember');
  kill('drowned_king');
  talkTo('orin', 'seal');
  assert.strictEqual(state.questState('seal_3'), 'done', 'chapter III: the Tide Ember');
  p.level = 22; // (the rewards so far made a level or three)
  A.say('seal');
  assert(messages.some(m => /level 25/.test(m)), 'chapter IV waits for level 25');
});

test('a hunting ground never runs dry: a watched spawn sends its monster in from off-screen', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player;
  Object.assign(p, { vocation: 'knight', level: 30, hp: 5000, maxHp: 5000, home: 'main' });
  ctx.teleport({ x: 92, y: 72, z: 4 });
  const rat = ctx.spawnMonster({ type: 'rat', x: p.x + 3, y: p.y, z: 4 });
  state.monsters = [rat];
  while (!rat.dead) ctx.damageMonster(rat, 999, 'energy');
  let back = null;
  for (let t = 0; t < 150000 && !back; t += 500) {
    tick(game, 500);
    if (state.monsters[0] !== rat) back = state.monsters[0];
  }
  assert(back && !back.dead, 'it comes back while you stand watching its spawn');
  assert(state.dist(back, p) > 8, `from beyond the edge of the screen (${state.dist(back, p)} tiles away)`);
});

test('townsfolk stroll around their home, and stop to talk', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const n = state.npcs.find(x => x.npcId === 'bertram');
  ctx.teleport({ x: n.x, y: n.y + 3, z: n.z });
  const start = `${n.x},${n.y}`;
  let moved = false;
  for (let i = 0; i < 60; i++) { tick(game, 500); moved = moved || `${n.x},${n.y}` !== start; }
  assert(moved, 'the crier walks about the square');
  assert(Math.abs(n.x - n.home.x) <= n.def.wander && Math.abs(n.y - n.home.y) <= n.def.wander, 'but stays near home');
  ctx.teleport({ x: n.x, y: n.y + 1, z: n.z }); // right next to him: a conversation ends when you walk off
  state.player.conversation = { npc: n, pending: null };
  tick(game, 1000);
  const talking = `${n.x},${n.y}`;
  tick(game, 15000);
  assert.strictEqual(`${n.x},${n.y}`, talking, 'and stands still while you talk to him');
});

test('walking is quicker on roads than on grass, and a click takes the quickest way', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, A = state.Actions;
  Object.assign(p, { vocation: 'knight', level: 20, home: 'main' });
  const timeTo = (ground) => {
    for (let x = 88; x <= 92; x++) state.map.setGround(x, 72, 4, ground);
    Object.assign(p, { x: 88, y: 72, z: 4, walk: null, path: [] });
    const start = state.now;
    A.walkTo(92, 72);
    while (p.x !== 92 && state.now - start < 20000) tick(game, 50);
    return state.now - start;
  };
  const road = timeTo('cobble'), grass = timeTo('grass');
  assert(grass > road * 1.15, `grass is slower (${Math.round(grass)} ms) than a road (${Math.round(road)} ms)`);
  // a road around a swamp is quicker than straight through it
  for (let x = 86; x <= 98; x++) for (let y = 66; y <= 74; y++) state.map.setGround(x, y, 4, 'swamp');
  for (let x = 86; x <= 98; x++) state.map.setGround(x, 67, 4, 'cobble');
  for (const x of [86, 98]) for (let y = 67; y <= 70; y++) state.map.setGround(x, y, 4, 'cobble');
  Object.assign(p, { x: 86, y: 70, z: 4, walk: null, path: [] });
  A.walkTo(98, 70);
  assert(p.path.some(([, y]) => y === 67), 'the way goes by the road');
});

test('following someone: one step behind them, until they are gone', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  const friend = ctx.newPlayer('Friend');
  state.players.push(friend);
  Object.assign(p, { vocation: 'knight', level: 20, home: 'main' });
  ctx.teleport({ x: 92, y: 72, z: 4 });
  Object.assign(friend, { vocation: 'knight', level: 20, x: p.x + 5, y: p.y, z: 4 });
  A.follow(friend.id);
  tick(game, 3000);
  assert(state.dist(p, friend) <= 1, 'you catch up with them');
  ctx.asPlayer(friend, () => ctx.walkTo(friend.x - 1, friend.y + 6));
  for (let i = 0; i < 40; i++) ctx.asPlayer(friend, () => tick(game, 100));
  tick(game, 2000);
  assert(state.dist(p, friend) <= 1, 'and keep up as they walk');
  friend.z = 3; // they go downstairs
  tick(game, 500);
  assert(!p.follow && messages.some(m => /lost track/.test(m)), 'and lose them when they change floor');
  A.follow(friend.id);
  A.keyDown('d');
  A.keyUp('d');
  assert(!p.follow, 'walking yourself stops following');
});

test('monsters leave you be in temples and shops, and keep out of them', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player;
  Object.assign(p, { vocation: 'knight', level: 30, hp: 5000, maxHp: 5000, home: 'main' });
  ctx.teleport({ x: 99, y: 55, z: 4 }); // in Dask's armoury in Valoria, by the counter
  const wolf = ctx.spawnMonster({ type: 'wolf', x: 104, y: 54, z: 4 });
  Object.assign(wolf, { angryAt: p.id, angryUntil: state.now + 60000 });
  state.monsters = [wolf];
  tick(game, 8000);
  const inShop = wolf.x >= 93 && wolf.x <= 101 && wolf.y >= 52 && wolf.y <= 57;
  assert(!inShop, `the wolf stays outside (it is at ${wolf.x},${wolf.y})`);
  assert.strictEqual(p.hp, 5000, 'and does no harm');
});

test('archers and shamans keep their distance, and shoot', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player;
  Object.assign(p, { vocation: 'knight', level: 30, hp: 5000, maxHp: 5000, home: 'main' });
  ctx.teleport({ x: 92, y: 72, z: 4 }); // open grass south-west of Valoria
  const archer = ctx.spawnMonster({ type: 'orc_archer', x: p.x + 1, y: p.y, z: 4 });
  state.monsters = [archer];
  const hp = p.hp;
  tick(game, 3000);
  assert(state.dist(archer, p) >= 3, `the archer backs off (it is ${state.dist(archer, p)} tiles away)`);
  tick(game, 4000);
  assert(p.hp < hp, 'and shoots from there');
  // walking up to it makes it back off again
  ctx.asPlayer(p, () => state.Actions.walkTo(archer.x - 1, archer.y));
  tick(game, 2500);
  assert(state.dist(archer, p) >= 2, 'it keeps away when you come closer');
});

test('secure mode: area spells spare innocent players; switched off, whirlwind hits a teammate too', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, A = state.Actions, mate = ctx.newPlayer('Mate');
  state.players.push(mate);
  Object.assign(p, { vocation: 'knight', level: 30, home: 'main', mana: 500, maxMana: 500 });
  ctx.teleport({ x: 92, y: 72, z: 4 });
  Object.assign(mate, { vocation: 'druid', level: 30, home: 'main', hp: 400, maxHp: 400, x: p.x + 1, y: p.y, z: 4 });
  A.partyInvite(mate.id);
  ctx.asPlayer(mate, () => A.partyJoin(p.id));
  A.castSpell('whirlwind');
  assert.strictEqual(mate.hp, 400, 'secure mode on: the whirlwind spares them');
  A.setSecure(false);
  state.now += 2000;
  let tries = 0;
  while (mate.hp === 400 && tries++ < 20) { state.now += 2000; p.mana = 500; A.castSpell('whirlwind'); }
  assert(mate.hp < 400, 'secure mode off: the whirlwind hits your teammate');
  assert(p.skullUntil > state.now, 'and hurting an innocent gives you a white skull');
});

test('protection zones: no attacks, attack spells or runes in a temple, nor into one', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  Object.assign(p, { vocation: 'sorcerer', level: 30, home: 'main', mana: 1000, maxMana: 1000, secure: false });
  ctx.teleport({ x: 112, y: 49, z: 4 }); // in the temple of Valoria, by the door
  assert(state.map.isProtected(p.x, p.y, p.z));
  const orc = ctx.spawnMonster({ type: 'orc', x: 112, y: 52, z: 4 });
  state.monsters = [orc];
  A.setTarget(orc.id);
  assert(!p.target && /protection zone/.test(messages[messages.length - 1]), 'no targeting from inside');
  state.now += 2000;
  A.castSpell('flame_burst');
  assert(/protection zone/.test(messages[messages.length - 1]), 'no attack spells inside');
  ctx.addItem('rune_missile', 2);
  A.useItemOn(bagRef(state, 'rune_missile'), orc.x, orc.y, orc.z);
  assert(orc.hp === orc.maxHp && state.countItem('rune_missile') === 2, 'no attack runes from inside');
  ctx.teleport({ x: 112, y: 53, z: 4 }); // out on the square
  state.now += 2000;
  const friend = ctx.newPlayer('Friend');
  Object.assign(friend, { vocation: 'knight', level: 30, home: 'main', hp: 300, maxHp: 300, x: 112, y: 48, z: 4 });
  state.players.push(friend);
  A.useItemOn(bagRef(state, 'rune_missile'), friend.x, friend.y, friend.z);
  assert(friend.hp === 300, 'and none thrown into a temple');
  A.setTarget(orc.id);
  assert(p.target === orc, 'outside, you fight as usual');
});

test('allahu akbar: you blow yourself up and burn everyone around you', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  Object.assign(p, { vocation: 'knight', level: 20, home: 'main', secure: false });
  ctx.teleport({ x: 112, y: 70, z: 4 });
  const orc = ctx.spawnMonster({ type: 'orc', x: p.x + 1, y: p.y, z: 4 });
  const far = ctx.spawnMonster({ type: 'orc', x: p.x + 5, y: p.y, z: 4 });
  state.monsters = [orc, far];
  const other = ctx.newPlayer('Bystander');
  Object.assign(other, { vocation: 'druid', level: 20, x: p.x, y: p.y + 2, z: 4, hp: 2000, maxHp: 2000 });
  state.players.push(other);
  A.say('allahu akbar');
  assert(orc.hp < orc.maxHp && far.hp === far.maxHp, 'it hits what is close, not what is far');
  assert(other.hp < 2000, 'players around you burn too');
  assert(p.dead && messages.some(m => /blow yourself up/.test(m)), 'and you die');
  tick(game, 4000);
  ctx.teleport({ x: 112, y: 45, z: 4 }); // the temple
  A.say('allahu akbar');
  assert(!p.dead && /protection zone/.test(messages[messages.length - 1]), 'not in a protection zone');
  assert(!ctx.spellsFor('knight').slice(0, -1).includes('final_blaze'), 'it comes last, after the spells on the number keys');
});

test('quest chests: one weapon from the crypt armory, only once', () => {
  const { ctx, state } = quietGame();
  ctx.openChest(state.THINGS.qchest_longsword.chest);
  ctx.openChest(state.THINGS.qchest_mace.chest);
  assert.strictEqual(state.countItem('longsword'), 1);
  assert.strictEqual(state.countItem('mace'), 0);
  ctx.openChest(state.THINGS.qchest_parcel.chest);
  assert.strictEqual(state.countItem('parcel'), 0, "the parcel crate stays shut until Hilda's quest");
});

test('trading, the bank, ships and promotion', () => {
  const { ctx, state } = quietGame();
  const p = state.player, A = state.Actions;
  ctx.teleport({ x: 20, y: 38, z: 4 });
  A.say('hi');
  A.say('trade');
  assert.strictEqual(p.shopNpc && p.shopNpc.npcId, 'bram');
  p.gold = 100;
  A.buy('short_sword', 1);
  assert.strictEqual(p.gold, 55);
  A.buy('short_sword', 5);
  assert.strictEqual(p.gold, 55, "can't afford 5 more, so nothing is bought");
  A.sell('short_sword', 2);
  assert.strictEqual(p.gold, 67, 'sold the one you had');
  A.say('bye');

  Object.assign(p, { vocation: 'knight', level: 22, gold: 5000 });
  ctx.teleport({ x: 108, y: 57, z: 4 });
  A.say('hi'); A.say('deposit 1000');
  assert.strictEqual(p.bank, 1000);
  A.say('withdraw 400');
  assert.strictEqual(p.gold, 4400);
  A.say('bye');
  ctx.teleport({ x: 113, y: 45, z: 4 });
  A.say('hi'); A.say('promotion'); A.say('yes');
  assert(p.promoted && p.gold === 2400, 'promoted for 2000 gold');
  A.say('bye');
  ctx.teleport({ x: 77, y: 72, z: 4 });
  A.say('hi'); A.say('ashport'); A.say('yes');
  assert(p.x > 45 && p.y > 85, 'sailed to Ashport');
});

test('death: blessings protect your things, otherwise they stay in your corpse', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player;
  Object.assign(p, { vocation: 'knight', level: 20, xp: state.xpForLevel(20) + 50 });
  p.blessed = true;
  ctx.asPlayer(p, () => ctx.damagePlayer(null, 9999, 'physical'));
  assert(p.dead && !p.blessed && state.countItem('apple') === 5, 'the blessing kept the bag and was used up');
  tick(game, 3500);
  assert(!p.dead, 'back in the temple');
  ctx.asPlayer(p, () => ctx.damagePlayer(null, 9999, 'physical'));
  assert.strictEqual(state.bag().contents.length, 0, 'without a blessing the bag is emptied');
  const corpse = state.piles.find(pl => pl.name === 'dead Tester' && pl.items.length);
  assert(corpse && corpse.items.some(i => i.id === 'apple'), 'into your corpse');
});

test('death costs a tenth of your experience, and can cost levels', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player;
  Object.assign(p, { vocation: 'knight', level: 20, xp: state.xpForLevel(20) + 10, maxHp: 345, maxMana: 145 });
  const xp = p.xp;
  ctx.asPlayer(p, () => ctx.damagePlayer(null, 9999, 'physical'));
  assert.strictEqual(p.xp, xp - Math.floor(xp * 0.1), 'a tenth of all your experience is gone');
  assert(p.level < 20 && p.xp >= state.xpForLevel(p.level) && p.xp < state.xpForLevel(p.level + 1), `down to the level that fits (${p.level})`);
  assert.strictEqual(p.maxHp, 345 - (20 - p.level) * state.VOCATIONS.knight.hp, 'with the health those levels gave');
  assert(messages.some(m => /downgraded from Level 20/.test(m)), 'and you are told so');
  tick(game, 3500);
  assert.strictEqual(p.hp, p.maxHp, 'you wake up in the temple, healed');
});

test('houses: rent, the door, furniture that is saved', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, A = state.Actions;
  Object.assign(p, { vocation: 'knight', gold: 5000 });
  ctx.teleport({ x: 117, y: 55, z: 4 });
  A.say('hi'); A.say('elm cottage'); A.say('yes'); A.say('bye');
  assert.strictEqual(p.house, 'val1');
  ctx.teleport({ x: 96, y: 49, z: 4 });
  A.keyDown('w');
  A.keyUp('w');
  tick(game, 300);
  assert(state.map.get(96, 48, 4).items.includes('door_house_open'), 'the house door opens for you');
  ctx.teleport({ x: 95, y: 45, z: 4 });
  ctx.addItem('kit_plant');
  A.useItemOn(bagRef(state, 'kit_plant'), 95, 44, 4);
  assert(state.map.get(95, 44, 4).items.includes('plant'), 'furniture set up');
  const saved = ctx.serializePlayer(p);
  state.map.get(95, 44, 4).items = [];
  ctx.applySave(saved);
  assert(state.map.get(95, 44, 4).items.includes('plant'), 'and comes back when you log in');
});

test('level 10, the Seer and the mainland', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, A = state.Actions;
  ctx.gainXp(2000);
  ctx.teleport({ x: 31, y: 50, z: 5 });
  A.say('hi'); A.say('druid'); A.say('yes');
  tick(game, 3000);
  assert.strictEqual(p.vocation, 'druid');
  assert(p.x > 64, 'arrived on the mainland');
  assert.strictEqual(state.countItem('rod_frost'), 1, 'got the starter kit');
});

test('the guide takes a new adventurer around Brightwater Isle, one step at a time', () => {
  const game = loadGame();
  const { ctx, state } = game;
  const p = state.player, A = state.Actions, npc = id => state.npcs.find(n => n.npcId === id);
  const next = n => { tick(game, 50); assert.strictEqual(p.tutorial, n, `on to step ${n}`); };
  const besides = id => { const n = npc(id); ctx.teleport({ x: n.x, y: n.y + 1, z: n.z }); A.say('bye'); A.say('hi'); };
  assert.strictEqual(p.tutorial, 1, 'a new character starts with the guide');
  assert.strictEqual(ctx.guideTarget(state.GUIDE[0]), npc('maren'), 'which points at Elder Maren');
  A.say('hi');
  next(2);
  A.say('quest'); A.say('yes');
  next(3);
  const rat = state.monsters.find(m => m.type === 'rat' && m.z === 3);
  ctx.teleport({ x: rat.x, y: rat.y, z: rat.z });
  assert.strictEqual(ctx.guideTarget(state.GUIDE[2]), rat, 'down in the cellar it points at a rat');
  ctx.killMonster(rat);
  next(4);
  const corpse = state.piles.find(c => c.corpse && c.x === rat.x && c.y === rat.y);
  ctx.useThing(corpse.x, corpse.y, corpse.z);
  next(5);
  A.useItem(bagRef(state, 'apple'));
  next(6);
  p.quests.rat_problem.kills.rat = 5;
  besides('maren'); A.say('quest');
  next(7);
  A.useItem(bagRef(state, 'leather_cap'));
  next(8);
  besides('hilda'); A.say('trade');
  next(9);
  besides('tomas');
  next(10);
  tick(game, 2000);
  assert.strictEqual(p.tutorial, 10, 'the last step waits for "Got it"');
  A.endGuide();
  assert.strictEqual(p.tutorial, 0);
  // characters from before the guide don't get it, and choosing a vocation ends it
  const save = ctx.serializePlayer(p);
  delete save.tutorial;
  p.tutorial = 3;
  ctx.applySave(save);
  assert.strictEqual(p.tutorial, 0, 'an old character has no guide');
  p.tutorial = 4;
  p.vocation = 'knight';
  tick(game, 50);
  assert.strictEqual(p.tutorial, 0, 'a vocation ends the guide');
});

test('Brightwater Isle is one way: no ride off it without a vocation, none back with one', () => {
  const { ctx, state, messages } = quietGame();
  const p = state.player, A = state.Actions;
  p.gold = 10000;
  ctx.teleport({ x: 31, y: 40, z: 4 });
  A.orderRide(112, 60, 'balloon');
  assert(!p.ride, 'no balloon to the mainland without a vocation');
  A.orderRide(45, 50, 'balloon');
  assert(p.ride, 'around the island is fine');
  p.ride = null;
  Object.assign(p, { vocation: 'knight', home: 'main' });
  ctx.teleport({ x: 112, y: 60, z: 4 });
  A.orderRide(31, 40, 'balloon');
  assert(!p.ride, 'no balloon back to the island');
  assert(messages.some(m => /island is behind you/.test(m)));
  A.orderRide(140, 60, 'balloon');
  assert(p.ride, 'anywhere else is fine');
  // what is written on a gravestone shows when you look at it
  ctx.look(27, 51);
  assert(messages.some(m => /^You see a gravestone\. Here lies nobody/.test(m)));
});

// The island's tale is sealed in game-tales.js. Its plaintext (secret/tale.json) is kept out
// of the repository: with it, walk the whole tale; without it, check what can be checked.
test('the island\'s tale: deeds out of turn do nothing, and the way through works', () => {
  const fs = require('fs'), path = require('path');
  const file = path.join(__dirname, '..', 'secret', 'tale.json');
  const tale = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  const game = loadGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  for (const id of ['shovel', 'pick']) ctx.addItem(id, 1);
  // to a given in-game hour, forward
  const atHour = h => {
    const day = 1440 * 1000, want = (((h * 60 - 540) % 1440) + 1440) % 1440 * 1000 + 20000;
    state.now = Math.ceil((state.now - want) / day) * day + want;
  };
  const before = messages.length;
  ctx.teleport({ x: 25, y: 66, z: 3 });
  A.useItemOn(bagRef(state, 'pick'), 25, 65, 3);
  assert.strictEqual(messages[messages.length - 1], 'There is nothing to break here.', 'the same as any wall');
  assert(messages.length > before);
  assert.strictEqual(p.tale, 0);
  if (!tale) return console.log('       (secret/tale.json is not here: skipped walking the tale)');

  const deedAt = d => (d.at ? { x: d.at[0], y: d.at[1], z: d.at[2] } : d.near ? { x: d.near[0], y: d.near[1], z: d.near[2] } : null);
  const stand = pos => { // a free tile next to it
    for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1], [-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      if (state.isFree(pos.x + dx, pos.y + dy, pos.z)) return ctx.teleport({ x: pos.x + dx, y: pos.y + dy, z: pos.z });
    }
    ctx.teleport(pos);
  };
  const doDeed = d => {
    const pos = deedAt(d);
    if (d.kind === 'dig' || d.kind === 'pick') { stand(pos); A.useItemOn(bagRef(state, d.kind === 'dig' ? 'shovel' : 'pick'), pos.x, pos.y, pos.z); }
    if (d.kind === 'say') { stand(pos); A.say(d.words); }
    if (d.kind === 'blow') { ctx.teleport(pos); p.useReady = 0; A.useItem(bagRef(state, 'bone_whistle')); }
    if (d.kind === 'kill') ctx.killMonster(state.monsters.find(m => m.type === d.what && !m.dead));
  };
  const timeOf = d => (!d.time ? 12 : d.time === 'dawn' ? 5 : d.time === 'night' ? 23 : d.time === 'dusk' ? 20 : +d.time.slice(1));
  tale.steps.forEach((step, i) => {
    const d = step.deeds[0];
    if (d.time) { // at another hour it does nothing
      atHour((timeOf(d) + 12) % 24);
      doDeed(d);
      assert.strictEqual(p.tale, i, `step ${i + 1} only at its hour`);
    }
    if (i + 1 < tale.steps.length) { // nor does the step after it
      const later = tale.steps[i + 1].deeds[0];
      if (later.kind !== 'kill' && later.kind !== 'blow') { atHour(timeOf(later)); doDeed(later); assert.strictEqual(p.tale, i, `step ${i + 2} not before step ${i + 1}`); }
    }
    atHour(timeOf(d));
    doDeed(d);
    assert.strictEqual(p.tale, i + 1, `step ${i + 1}: ${d.kind}`);
    assert(p.events.some(e => e.kind === 'read' && e.data.title === step.tell.title), 'and you are told what happens');
    if (step.tell.give) assert(state.findInBag(it => it.id === step.tell.give[0] && (it.q || 0) === (step.tell.give[2] || 0)), `got the ${step.tell.give[0]}`);
  });
  assert(p.events.some(e => e.kind === 'banner'), 'everyone hears of it');
  // once is enough, and a vocation closes the island's tales
  const vocal = loadGame();
  Object.assign(vocal.state.player, { vocation: 'knight' });
  vocal.ctx.addItem('shovel', 1);
  const d = tale.steps[0].deeds[0], pos = deedAt(d);
  vocal.ctx.teleport({ x: pos.x - 1, y: pos.y, z: pos.z });
  vocal.state.now = (((timeOf(d) * 60 - 540) % 1440) + 1440) % 1440 * 1000 + 20000;
  vocal.state.Actions.useItemOn(vocal.state.findInBag(it => it.id === 'shovel'), pos.x, pos.y, pos.z);
  assert.strictEqual(vocal.state.player.tale, 0, 'not for those with a vocation');
});

// ---- what the last review found: each of these once let players cheat or lose things ----
test('only what is within reach: no piles or depot from afar, no fractions, no free rides', () => {
  const { ctx, state } = quietGame();
  const p = state.player, A = state.Actions;
  ctx.teleport({ x: 112, y: 60, z: 4 });
  ctx.dropToGround(ctx.makeItem('health_potion', 3), { x: 122, y: 60, z: 4 });
  const far = state.pileAt(122, 60, 4);
  p.hp = 50;
  A.useItem({ root: 'pile', pileId: far.id, path: [0] });
  assert.strictEqual(p.hp, 50, 'no drinking from a pile ten tiles away');
  p.depot.contents.push(ctx.makeItem('mace'));
  A.moveItem({ root: 'depot', path: [0] }, { root: 'bag', path: [] });
  assert.strictEqual(p.depot.contents.length, 1, 'nor taking from the depot away from a locker');
  A.moveItem(bagRef(state, 'health_potion'), { root: 'bag', path: [] }, 1.5);
  assert(state.bagItems().every(it => Number.isInteger(it.count)), 'counts stay whole');
  const gold = p.gold = 500;
  A.orderRide(140, 60, 'cart');
  assert.strictEqual(p.gold, gold, 'a cart only runs on its track');
  A.orderRide(140, 60, 'toString');
  assert.strictEqual(p.gold, gold);
});

test('house things come back once, a full bag does not copy things, a quest item stays yours', () => {
  const { ctx, state } = quietGame();
  const p = state.player, A = state.Actions, house = state.map.houses[0];
  Object.assign(p, { vocation: 'knight', level: 20, home: 'main', house: house.id });
  house.owner = p.name;
  ctx.dropToGround(ctx.makeItem('health_potion', 5), { x: Math.floor((house.x0 + house.x1) / 2), y: Math.floor((house.y0 + house.y1) / 2), z: house.z });
  const save = ctx.serializePlayer(p), potions = () => state.piles.filter(pl => pl.house === house.id).reduce((n, pl) => n + pl.items.reduce((m, it) => m + it.count, 0), 0);
  ctx.applySave(save);
  ctx.applySave(save);
  assert.strictEqual(potions(), 5, 'logging in again does not double them');
  // a bag too small for your things: nothing is copied
  const before = state.countItem('apple');
  ctx.addItem('bag', 1);
  for (let i = 0; i < 6; i++) ctx.addItem('mace', 1);
  A.moveItem(state.findInBag(it => it.id === 'bag'), { root: 'equip', slot: 'backpack' });
  assert.strictEqual(state.countItem('apple'), before);
  ctx.addItem('parcel', 1);
  ctx.teleport({ x: 112, y: 60, z: 4 });
  A.moveItem(bagRef(state, 'parcel'), { root: 'ground', x: 113, y: 60, z: 4 });
  assert.strictEqual(state.countItem('parcel'), 1, 'a quest item cannot be given away');
  p.blessed = false;
  ctx.playerDies(null);
  assert.strictEqual(state.countItem('parcel'), 1, 'nor lost when you die');
});

test('a field burns only whom its maker may hurt', () => {
  const { ctx, state } = quietGame();
  const caster = state.player, victim = ctx.newPlayer('Victim');
  state.players.push(victim);
  Object.assign(caster, { vocation: 'sorcerer', level: 30, home: 'main', mana: 500, maxMana: 500 });
  Object.assign(victim, { vocation: 'knight', level: 30, home: 'main', hp: 400, maxHp: 400, x: 115, y: 72, z: 4 });
  ctx.teleport({ x: 112, y: 72, z: 4 });
  ctx.createField('fire', 115, 72, 4, caster.id);
  tick({ ctx, state }, 3000);
  assert.strictEqual(victim.hp, 400, 'secure mode on: an innocent does not burn');
  assert(!caster.skullUntil, 'and nobody gets a skull');
  caster.secure = false;
  tick({ ctx, state }, 3000);
  assert(victim.hp < 400, 'secure mode off: they burn');
  assert(caster.skullUntil > state.now, 'and the maker gets a white skull');
});

test('the map saves compactly and comes back the same; every NPC stands on dry land', () => {
  const { ctx, state } = loadGame();
  const map = state.map, json = JSON.stringify(map);
  assert(json.length < 2e6, `small enough for a browser's storage (${(json.length / 1e6).toFixed(1)} MB)`);
  const back = require('vm').runInContext('GameMap', ctx).fromJSON(JSON.parse(json));
  assert.strictEqual(ctx.mapSignature(back), ctx.mapSignature(map));
  assert.strictEqual(JSON.stringify(back.isle), JSON.stringify(map.isle));
  for (const n of map.npcs) assert(map.isWalkable(n.x, n.y, n.z) && (map.get(n.x, n.y, n.z) || {}).ground !== 'water', `${n.type} at ${n.x},${n.y},${n.z} can be reached`);
});

test('raids bring monsters and announce themselves', () => {
  const game = quietGame();
  const { ctx, state } = game;
  ctx.startRaid({ name: 'test', message: 'Here they come!', at: { x: 31, y: 40, z: 4 }, spawns: [['rat', 3]] });
  assert.strictEqual(state.monsters.filter(m => m.raid).length, 3);
  assert(state.player.events.some(e => e.kind === 'raid'));
});

test('save and load keep the character', () => {
  const { ctx, state } = quietGame();
  const p = state.player;
  p.name = 'Saved';
  ctx.gainXp(300);
  ctx.addItem('bread', 3);
  ctx.startQuest('lost_parcel');
  p.depot.contents.push(ctx.makeItem('mace'));
  ctx.saveGame();
  const snapshot = () => JSON.stringify({ level: p.level, xp: p.xp, bag: p.equipment.backpack, quests: p.quests, depot: p.depot });
  const before = snapshot();
  p.level = 1; p.xp = 0; p.quests = {}; p.equipment.backpack.contents = []; p.depot.contents = [];
  assert(ctx.loadGame());
  assert.strictEqual(snapshot(), before);
  assert.strictEqual(p.name, 'Saved');
});

test('the sewers: a street grate takes you down to the rats, the ladder under it back up', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, A = state.Actions, map = state.map;
  ctx.teleport({ x: 131, y: 113, z: 8 });
  A.walkTo(131, 111);
  tick(game, 1500);
  assert.strictEqual(p.z, 7, 'climbed down through the grate on the square');
  assert(Math.abs(p.x - 131) <= 1 && Math.abs(p.y - 111) <= 1, 'landed beside the ladder under it');
  assert(map.get(131, 111, 7).items.includes('sewer_ladder'), 'a ladder stands under the grate');
  A.walkTo(131, 111);
  tick(game, 1500);
  assert.strictEqual(p.z, 8, 'climbed back up the ladder');
  const below = map.spawns.filter(s => s.z === 7);
  assert(below.filter(s => s.type === 'rat').length >= 8, 'rats live in the sewers');
  assert(below.some(s => s.type === 'giant_rat'), 'and giant rats in their nest');
});

test('The Silent Bell II: the cut bell rope in the cellar, Ama, and the crypt seal for Corwin', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions, map = state.map;
  p.quests.bell_1 = { status: 'done', step: 5, kills: {} };
  const rope = map.get(148, 101, 5);
  assert(rope && rope.items.includes('bell_rope'), 'the bell rope lies at the bottom of the bell shaft, three floors down');
  assert(map.spawns.some(s => s.type === 'cistern_slime' && s.z === 5) && map.spawns.filter(s => s.type === 'giant_rat' && s.z === 6).length >= 8, 'giant rats in the drains, a slime by the shaft');
  assert(map.get(146, 101, 13).items.includes('bell_nw'), 'the bell hangs at the top of the bell tower, the highest in town');
  const talk = (x, y, z, ...words) => { ctx.teleport({ x, y, z }); A.say('hi'); for (const w of words) A.say(w); A.say('bye'); };
  talk(136, 102, 9, 'bell');
  assert.strictEqual(state.questState('bell_2'), 'none', 'not at level 1');
  ctx.useThing(148, 101, 5);
  assert.strictEqual(state.countItem('chewed_rope'), 0, 'the rope gives nothing before the quest');
  p.level = 2;
  talk(136, 102, 9, 'bell', 'yes');
  assert.strictEqual(state.questState('bell_2'), 'active');
  ctx.useThing(148, 101, 5);
  assert(state.countItem('chewed_rope') === 1 && state.countItem('carved_stone') === 1, 'the cut rope and the strange stone');
  talk(136, 102, 9, 'rope');
  assert.strictEqual(p.quests.bell_2.step, 1, 'Ama takes the rope');
  assert.strictEqual(state.countItem('chewed_rope'), 0);
  ctx.useThing(148, 101, 5);
  assert.strictEqual(state.countItem('chewed_rope'), 0, 'the rope Ama keeps does not come back');
  talk(112, 103, 8, 'stone');
  assert.strictEqual(state.questState('bell_2'), 'done', 'Corwin reads the stone');
  assert(messages.some(m => /Bone Rocks/.test(m)), 'and sends you to Bone Rocks');
  ctx.useThing(147, 102, 13);
  assert(/hangs silent/.test(messages[messages.length - 1]), 'the bell stays silent for now');
});

test('The Silent Bell III: down the crypt under Bone Rocks, the clapper, the bell rings, and the oracle at level 8', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions, map = state.map;
  for (const id of ['bell_1', 'bell_2']) p.quests[id] = { status: 'done', step: 9, kills: {} };
  // the steps cut into the foot of Bone Rocks lead down, and on down to the tomb
  ctx.teleport({ x: 81, y: 200, z: 8 });
  A.walkTo(81, 198);
  tick(game, 2000);
  assert.strictEqual(p.z, 7, 'down the steps into the crypt');
  assert(map.get(69, 176, 6).items.includes('founder_tomb'), 'the founder\'s tomb is two floors down');
  assert(map.spawns.some(s => s.type === 'gravewaker' && s.z === 6) && map.spawns.filter(s => s.type === 'skeleton' && s.z <= 7).length >= 6, 'skeletons and the Gravewaker');
  const talk = (x, y, z, ...words) => { ctx.teleport({ x, y, z }); A.say('hi'); for (const w of words) A.say(w); A.say('bye'); };
  p.level = 5;
  talk(112, 103, 8, 'crypt');
  assert.strictEqual(state.questState('bell_3'), 'none', 'Corwin waits for level 6');
  ctx.useThing(69, 176, 6);
  assert.strictEqual(state.countItem('bell_clapper'), 0, 'the tomb gives nothing before the quest');
  p.level = 8;
  talk(110, 102, 9, 'destiny');
  assert(/level 10/.test(messages.slice(-4).join(' ')), 'the oracle wants level 10 while the bell is silent');
  talk(112, 103, 8, 'crypt', 'yes');
  assert.strictEqual(state.questState('bell_3'), 'active');
  ctx.useThing(69, 176, 6);
  assert.strictEqual(state.countItem('bell_clapper'), 1, 'the clapper from the founder\'s tomb');
  talk(136, 102, 9, 'clapper');
  assert.strictEqual(state.questState('bell_3'), 'done', 'Sister Ama hangs it again');
  assert(messages.some(m => /rings again/.test(m)), 'and the bell rings out');
  ctx.useThing(147, 102, 13);
  assert(/still humming/.test(messages[messages.length - 1]), 'it hums a while after ringing');
  state.now += 31000;
  ctx.useThing(147, 102, 13);
  assert(/rings the bell of Oakvale/.test(messages[messages.length - 1]), 'then anyone may ring it, and the whole isle hears');
  talk(110, 102, 9, 'destiny');
  assert(/knight/.test(messages.slice(-4).join(' ')), 'the oracle sees you at level 8 now');
});

test('NPCs say which word to ask with, and show ! or ? when they have something for you', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  assert.strictEqual(ctx.questNews('ama').mark, 'offer', 'Ama has a quest: !');
  assert.strictEqual(ctx.questNews('corwin'), null, 'Corwin has nothing yet');
  ctx.teleport({ x: 136, y: 102, z: 9 });
  A.say('hi');
  assert(messages.some(m => /Ask me about the \{bell\}/.test(m)), 'Ama names the word in blue');
  A.say('bell'); A.say('yes'); A.say('bye');
  assert.strictEqual(ctx.questNews('corwin').mark, 'report', 'Corwin is next: ?');
  ctx.teleport({ x: 112, y: 103, z: 8 });
  A.say('hi');
  assert(messages.some(m => /Tell me about the \{bell\}/.test(m)), 'Corwin names the word too');
  A.say('bell');
  assert.strictEqual(ctx.questNews('corwin').mark, 'busy', 'then waits for the rats');
  A.say('bye');
  for (let i = 0; i < 5; i++) ctx.onMonsterKilled('rat');
  ctx.teleport({ x: 112, y: 103, z: 8 }); A.say('hi'); A.say('bell'); A.say('bye');
  assert.strictEqual(ctx.questNews('postmaster').mark, 'report');
  ctx.teleport({ x: 147, y: 108, z: 8 }); A.say('hi');
  assert(messages.some(m => /\{locker\}/.test(m)), 'the postmaster asks about the locker');
  A.say('locker'); A.say('bye');
  assert.strictEqual(p.quests.bell_1.step, 3, 'and the locker finishes his step');
  ctx.teleport({ x: 147, y: 108, z: 8 }); A.say('hi'); A.say('locker');
  assert(/Pip is waiting for you: ask about the letter/.test(messages.slice(-2).join(' ')), 'he points on to Pip, with the word');
});

test('gear deep under Oakvale: a cap, a shield and leather armor, once each; one weapon of three in the crypt', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  for (const [x, y, z, item] of [[105, 121, 7, 'leather_cap'], [109, 128, 6, 'wooden_shield'], [142, 103, 5, 'leather_armor']]) {
    ctx.useThing(x, y, z);
    assert.strictEqual(state.countItem(item), 1, `the chest at ${x},${y},${z} gives ${item}`);
    ctx.useThing(x, y, z);
    assert.strictEqual(state.countItem(item), 1, 'but only once');
  }
  ctx.useThing(80, 178, 7);
  assert.strictEqual(state.countItem('hatchet'), 1, 'a weapon from the crypt');
  ctx.useThing(79, 178, 7);
  assert.strictEqual(state.countItem('short_sword'), 0, 'and only one of the three');
  assert(/already taken your pick/.test(messages[messages.length - 1]));
});

test('the gate watch: a task beyond each gate, gear for it, and each guard sends you on to the next', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  const guard = id => state.npcs.find(n => n.npcId === id);
  const talk = (id, ...words) => { const g = guard(id); ctx.teleport({ ...ctx.findFreeTile(g.x, g.y, g.z, 2), z: g.z }); A.say('hi'); for (const w of words) A.say(w); A.say('bye'); };
  for (const id of ['gate_west', 'gate_south', 'gate_east', 'gate_north']) assert(guard(id), `${id} stands at a gate`);
  talk('gate_west', 'wolves', 'yes');
  assert.strictEqual(state.questState('gate_west'), 'none', 'not at level 1');
  p.level = 5;
  for (const [id, word, kill, n, item, next] of [['gate_west', 'wolves', 'wolf', 8, 'leather_boots', /Tilda/], ['gate_south', 'crabs', 'crab', 6, 'leather_legs', /Hilde/],
    ['gate_east', 'spiders', 'spider', 8, 'chain_helmet', /Osric/], ['gate_north', 'goblins', 'goblin', 8, 'studded_shield', /crypt/]]) {
    assert.strictEqual(ctx.questNews(id).mark, 'offer', `${id} has a task: !`);
    talk(id, word, 'yes');
    for (let i = 0; i < n; i++) ctx.onMonsterKilled(kill);
    assert.strictEqual(ctx.questNews(id).mark, 'report', `${id} waits for the news: ?`);
    talk(id, word);
    assert.strictEqual(state.questState(id), 'done', `${id} is done`);
    assert.strictEqual(state.countItem(item), 1, `${id} gives ${item}`);
    assert(next.test(messages.join(' ')), `${id} sends you on`);
  }
});

test('walking goes north, east, south and west; a diagonal step only where nothing else gets past', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, A = state.Actions, map = state.map;
  // open ground in Sunny Fields: four tiles east and four south is all straight steps, never a diagonal
  const free = (x, y) => map.isWalkable(x, y, 8);
  let sx = 0, sy = 0;
  for (let y = 160; y < 180 && !sx; y++) for (let x = 112; x < 148 && !sx; x++) {
    let ok = true;
    for (let dy = -1; dy <= 6 && ok; dy++) for (let dx = -1; dx <= 6 && ok; dx++) ok = free(x + dx, y + dy);
    if (ok) { sx = x; sy = y; }
  }
  assert(sx, 'found open ground');
  ctx.teleport({ x: sx, y: sy, z: 8 });
  A.walkTo(sx + 4, sy + 4);
  assert.strictEqual(p.path.length, 8, 'eight straight steps');
  for (let i = 0, [x, y] = [sx, sy]; i < p.path.length; i++) {
    const [nx, ny] = p.path[i];
    assert(nx === x || ny === y, `step ${i + 1} is straight`);
    [x, y] = [nx, ny];
  }
  // only a diagonal gets past: walls everywhere round the corner but one diagonal gap
  const pass = (x, y) => (x === 0 && y === 0) || (x === 1 && y === 1) || (x === 2 && y === 1);
  const path = ctx.findPath(pass, 0, 0, 2, 1, { orthogonalOnly: true }) || ctx.findPath(pass, 0, 0, 2, 1, { diagonalCost: 40 });
  assert.strictEqual(JSON.stringify(path), '[[1,1],[2,1]]', 'a diagonal when there is no other way');
});

test('monsters come for you once they could be on your screen, not only when they are close', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, map = state.map;
  let spot = null;
  for (let x = 112; x < 140 && !spot; x++) if ([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].every(d => map.isWalkable(x + d, 170, 8))) spot = x;
  assert(spot, 'found a straight run of open ground');
  ctx.teleport({ x: spot, y: 170, z: 8 });
  const wolf = ctx.spawnMonster({ type: 'wolf', x: spot + 9, y: 170, z: 8 });
  state.monsters.push(wolf);
  assert.strictEqual(wolf.x - p.x, 9, 'nine tiles off: beyond its own aggro range, at the edge of the screen');
  assert.strictEqual(ctx.monsterTarget(wolf), p, 'it has seen you');
  tick(game, 5000);
  assert(Math.abs(wolf.x - p.x) <= 1, 'and comes straight for you');
});

let failed = 0;
for (const t of tests) {
  try {
    t.fn();
    console.log(`  ok   ${t.name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL ${t.name}\n${err.stack.split('\n').slice(0, 4).join('\n')}`);
  }
}
console.log(failed ? `${failed} of ${tests.length} failed` : `all ${tests.length} passed`);
process.exit(failed ? 1 : 0);
