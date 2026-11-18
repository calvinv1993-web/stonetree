'use strict';
// Unit tests for the game rules, run against the real game files in Node.
//   node tests/unit.test.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
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
// A free tile next to an NPC, wherever the town puts them: [x, y, z]
const besideNpc = (game, id) => { const n = game.state.npcs.find(o => o.npcId === id), t = game.ctx.findFreeTile(n.x, n.y, n.z, 2); return [t.x, t.y, n.z]; };

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
  const placed = new Set(map.npcs.map(n => n.id || n.npcId || n.type));
  for (const [id, n] of Object.entries(NPCS)) {
    if (n.trade) {
      for (const [sold] of n.trade.sells) item(sold, `${id} sells`);
      for (const kind of n.trade.buys) assert(BUYS[kind], `${id} buys ${kind}`);
    }
    for (const answer of Object.values(n.keywords || {})) {
      if (answer.quest) for (const q of answer.quest) assert(QUESTS[q], `${id} talks about quest ${q}`);
      // (only for those standing in the world: the old mainland's captains wait for it to come back)
      if (answer.travel && placed.has(id)) assert(map.isWalkable(answer.travel.to.x, answer.travel.to.y, answer.travel.to.z), `${id} sails somewhere walkable`);
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
    if (t.chest.requires) assert(QUESTS[t.chest.requires.split('@')[0]], `chest ${id} requires`); // 'quest' or 'quest@step'
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
  assert(messages.some(m => m === 'You see Friend (Level 25). They are a Hawk. They are Vice-Leader of the Dawn Guard (Hawkeye).'), messages.join(' | '));
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

test('quest chests: one weapon from the crypt armory, only once', () => {
  const { ctx, state } = quietGame();
  ctx.openChest(state.THINGS.qchest_longsword.chest);
  ctx.openChest(state.THINGS.qchest_mace.chest);
  assert.strictEqual(state.countItem('longsword'), 1);
  assert.strictEqual(state.countItem('mace'), 0);
  ctx.openChest(state.THINGS.qchest_parcel.chest);
  assert.strictEqual(state.countItem('parcel'), 0, "the parcel crate stays shut until Hilda's quest");
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

test('the map saves compactly and comes back the same; every NPC stands on dry land', () => {
  const { ctx, state } = loadGame();
  const map = state.map, json = JSON.stringify(map);
  assert(json.length < 2e6, `small enough for a browser's storage (${(json.length / 1e6).toFixed(1)} MB)`);
  const back = require('vm').runInContext('GameMap', ctx).fromJSON(JSON.parse(json));
  assert.strictEqual(ctx.mapSignature(back), ctx.mapSignature(map));
  assert.strictEqual(JSON.stringify(back.isle), JSON.stringify(map.isle));
  for (const n of map.npcs) assert(map.isWalkable(n.x, n.y, n.z) && (map.get(n.x, n.y, n.z) || {}).ground !== 'water', `${n.type} at ${n.x},${n.y},${n.z} can be reached`);
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
  const p = state.player, A = state.Actions, map = state.map, [gx, gy] = state.OAKVALE.grates[0]; // (the grate by the square)
  ctx.teleport({ x: gx + 2, y: gy, z: 8 });
  A.walkTo(gx, gy);
  tick(game, 1500);
  assert.strictEqual(p.z, 8, 'walking over a grate doesn\'t drop you into the sewers');
  assert.strictEqual(p.x * 1000 + p.y, gx * 1000 + gy, 'you can stand on it');
  A.walkTo(gx + 2, gy);
  tick(game, 1500);
  A.interact('use', gx, gy, 8);
  tick(game, 1500);
  assert.strictEqual(p.z, 7, 'using it climbs down through the grate on the square');
  assert(Math.abs(p.x - gx) <= 1 && Math.abs(p.y - gy) <= 1, 'landed beside the ladder under it');
  assert(map.get(gx, gy, 7).items.includes('sewer_ladder'), 'a ladder stands under the grate');
  A.walkTo(gx, gy);
  tick(game, 1500);
  assert.strictEqual(p.z, 8, 'climbed back up the ladder');
  const below = map.spawns.filter(s => s.z === 7);
  assert(below.filter(s => s.type === 'rat').length >= 8, 'rats live in the sewers');
  assert(below.some(s => s.type === 'giant_rat'), 'and giant rats in their nest');
});



test('Oakvale: every shopkeeper, teacher and keeper stands inside their own building', () => {
  const { state } = quietGame(), B = state.OAKVALE.buildings;
  const home = { ama: 'temple', corwin: 'academy', oak_oracle: 'academy', postmaster: 'depot', pip: 'general', oak_smith: 'smith', oak_armourer: 'armour',
    oak_mage: 'magic', oak_baker: 'bakery', oak_innkeeper: 'inn', oak_landlady: 'inn', oak_fisher: 'fisher', oak_quartermaster: 'watch', oak_farmer: 'farm' };
  for (const [id, where] of Object.entries(home)) {
    const n = state.npcs.find(o => o.npcId === id), b = B.find(o => o.id === where);
    assert(n && b, `${id} and ${where}`);
    assert(n.x > b.x0 && n.x < b.x1 && n.y > b.y0 && n.y < b.y1, `${id} stands inside ${b.name} (at ${n.x},${n.y})`);
  }
});

test('Oakvale: you can fish from the jetty behind the Fisher\'s Hut', () => {
  const game = quietGame(), { ctx, state } = game, [x, y] = state.OAKVALE.pier;
  ctx.addItem('fishing_rod', 1); ctx.teleport({ x, y, z: 8 });
  assert.strictEqual(state.map.get(x, y, 8).ground, 'pier', 'standing on the jetty');
  for (let i = 0; i < 40; i++) { state.now += 3000; ctx.useItemOn(bagRef(state, 'fishing_rod'), x + 1, y, 8); }
  assert(state.countItem('fish') > 0, 'a fish caught');
});

test('NPCs say which word to ask with, and show ! or ? when they have something for you', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  const go = id => { const [x, y, z] = besideNpc(game, id); ctx.teleport({ x, y, z }); };
  assert.strictEqual(ctx.questNews('ama').mark, 'offer', 'Ama has a quest: !');
  assert.strictEqual(ctx.questNews('gate_north'), null, 'Captain Osric has nothing yet');
  go('ama'); A.say('hi');
  assert(messages.some(m => /Ask me about the \{fight\}/.test(m)), 'Ama names the word in blue');
  A.say('fight'); A.say('yes'); A.say('bye');
  assert.strictEqual(ctx.questNews('gate_north').mark, 'report', 'Osric is next: ?');
  go('corwin'); A.say('hi'); A.say('fighter');
  assert(/north wall needs every pair of hands/.test(messages.slice(-2).join(' ')), 'Corwin: the wall first');
  A.say('bye');
  go('gate_north'); A.say('hi');
  assert(messages.some(m => /\{fight\}/.test(m)), 'Osric names the word too');
  A.say('fight'); A.say('bye');
  assert.strictEqual(p.quests.last_town.step, 1, 'turned away, and the Host at the wall: on to the cannons');
  assert.strictEqual(ctx.questNews('gate_north'), null, 'the cannons have no NPC: no mark over Osric');
});

test('The Last Town: turned away, then the Host at the wall: four cannons on the north wall, Clang behind the powder kegs, fire; Osric sends you to Corwin', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  const go = id => { const [x, y, z] = besideNpc(game, id); ctx.teleport({ x, y, z }); };
  const use = (x, y, z) => { const t = ctx.findFreeTile(x, y + 1, z, 2); ctx.teleport({ x: t.x, y: t.y, z }); ctx.useThing(x, y, z); tick(game, 100); };
  go('ama'); A.say('hi'); A.say('fight'); A.say('yes'); A.say('bye');
  go('gate_north'); A.say('hi'); A.say('fight'); A.say('bye');
  assert(p.quests.last_town.siegeAt > 0 && ctx.siegeScene(), 'the horns: the siege begins, for you');
  // the kegs and the fuse wait for the cannons; a cannon on another wall doesn't count
  use(131, 94, 9); assert.strictEqual(p.pet, null, 'the kegs first: nothing yet');
  const east = state.map.get(152, 96, 10).items.includes('cannon_e');
  if (east) { use(152, 96, 10); assert.strictEqual((p.quests.last_town.loaded || []).length, 0, 'a cannon on the east side: wrong way'); }
  const north = [[132, 94, 9], [138, 94, 9], [116, 94, 9], [105, 94, 9]];
  use(...north[0]); use(...north[0]);
  assert.strictEqual(p.quests.last_town.loaded.length, 1, 'one cannon loaded once');
  go('gate_north'); A.say('hi'); A.say('fight'); A.say('bye');
  assert(/Loaded: 1\/4/.test(messages.slice(-3).join(' ')) && !/Sister Ama is waiting/.test(messages.slice(-3).join(' ')), 'Osric, asked again: the cannons, not back to Ama');
  assert.notStrictEqual((ctx.questNews('ama') || {}).mark, 'busy', 'and no mark over Ama in the temple');
  for (const c of north.slice(1)) use(...c);
  assert.strictEqual(p.quests.last_town.step, 2, 'four loaded: then a mew behind the kegs');
  use(105, 94, 9); assert.strictEqual(p.quests.last_town.step, 2, 'no firing before Clang is safe');
  use(131, 94, 9);
  assert(p.pet && p.pet.name === 'Clang' && p.pet.kind === 'cat', 'Clang, found behind the kegs, is your companion');
  assert.strictEqual(p.quests.last_town.step, 3);
  assert(!p.events.some(e => e.kind === 'petName'), 'his name is asked later, not in the middle of the fight');
  use(151, 95, 10); assert.strictEqual(p.quests.last_town.step, 3, 'an unloaded cannon does not fire');
  use(116, 94, 9);
  assert(p.quests.last_town.firedAt > 0 && p.quests.last_town.step === 4, 'fire!');
  assert(ctx.siegeScene().fired, 'the Host runs');
  go('gate_north'); A.say('hi'); A.say('fight'); A.say('bye');
  assert.strictEqual(state.questState('last_town'), 'done', 'Osric: you held the wall');
  assert(p.events.some(e => e.kind === 'petName') && ctx.siegeScene(), 'now his name; and the Host is still seen running');
  assert.strictEqual(ctx.questNews('corwin').mark, 'offer', 'Corwin has training for you: !');
  tick(game, 21000); assert.strictEqual(ctx.siegeScene(), null, 'and the siege is over');
  use(131, 94, 9); assert(/Nothing mews/.test(messages[messages.length - 1]), 'the kegs are only kegs now');
});

test('The North Wall, odd cases: an old companion already (the kitten runs home); a page reloaded mid-siege (its clock started again) goes on; the kegs and cannons show and can be clicked', () => {
  const game = quietGame(), { ctx, state, messages } = game, p = state.player, A = state.Actions;
  p.quests.last_town = { status: 'active', step: 2, kills: {}, siegeAt: state.now - 5000, loaded: ['132,94,9', '138,94,9', '116,94,9', '105,94,9'] };
  p.pet = { name: 'Rex', kind: 'cat', level: 3, xp: 0, hp: 50, home: false, downUntil: 0, mode: 'assist' };
  ctx.teleport({ x: 131, y: 95, z: 9 }); ctx.useThing(131, 94, 9); tick(game, 100);
  assert(p.pet.name === 'Rex' && p.quests.last_town.step === 3 && /bolts down them/.test(messages.join(' ')), 'Rex stays; the kitten runs home; the story goes on');
  // saved an hour into a session, loaded into a page whose clock starts again
  p.quests.last_town.siegeAt = state.now + 3600000; p.quests.last_town.firedAt = 0;
  const save = ctx.serializePlayer(p); ctx.applySave(JSON.parse(JSON.stringify(save)));
  const sc = ctx.siegeScene();
  assert(sc && sc.at <= state.now, 'the siege goes on at once, not an hour from now');
  p.quests.last_town.firedAt = state.now + 3600000; ctx.applySave(JSON.parse(JSON.stringify(ctx.serializePlayer(p))));
  assert.strictEqual(ctx.siegeScene(), null, 'a volley fired long ago is over');
  assert(ctx.thingSpot('powder_kegs', p) && ctx.thingSpot('cannon_n', p), 'the kegs and cannons are on the wall');
});

test('The Recruit: the dummy (skills), a cap, Farmer Ned\'s rats down a grate with his torch, a trade with Pip, a locker with Hobb, and a shield', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  const go = id => { const [x, y, z] = besideNpc(game, id); ctx.teleport({ x, y, z }); };
  const talk = (id, ...w) => { go(id); A.say('hi'); for (const x of w) A.say(x); A.say('bye'); tick(game, 100); };
  talk('corwin', 'fighter', 'yes');
  assert.strictEqual(state.questState('recruit'), 'none', 'not before the wall');
  p.quests.last_town = { status: 'done', step: 5, kills: {} };
  talk('corwin', 'fighter', 'yes');
  assert.strictEqual(state.questState('recruit'), 'active', 'Corwin trains you');
  talk('corwin', 'fighter'); assert.strictEqual(p.quests.recruit.step, 0, 'no hits yet: still the dummy');
  // ten hits on a dummy in the training yard
  let d = null;
  for (let y = 133; y <= 143 && !d; y++) for (let x = 140; x <= 150 && !d; x++) if (state.map.get(x, y, 8) && state.map.get(x, y, 8).items.includes('dummy') && state.isFree(x, y - 1, 8)) d = { x, y };
  assert(d, 'a dummy in the training yard');
  ctx.teleport({ x: d.x, y: d.y - 1, z: 8 }); ctx.useThing(d.x, d.y, 8);
  tick(game, 30000);
  assert(p.quests.recruit.hits >= 10, `ten hits on the dummy (${p.quests.recruit.hits})`);
  talk('corwin', 'fighter');
  assert.strictEqual(p.quests.recruit.step, 1); assert.strictEqual(state.countItem('leather_cap'), 1, 'a cap from Corwin');
  talk('oak_farmer', 'rats');
  assert.strictEqual(state.countItem('farm_torch'), 1, 'Ned\'s torch'); assert.strictEqual(p.quests.recruit.step, 2);
  for (let i = 0; i < 5; i++) ctx.onMonsterKilled('rat');
  talk('oak_farmer', 'rats'); assert.strictEqual(p.quests.recruit.step, 3, 'five rats for Ned');
  talk('pip', 'supplies'); assert.strictEqual(p.quests.recruit.step, 3, 'Pip: trade first');
  assert(/trade/.test(messages.slice(-3).join(' ')), 'he says so');
  ctx.giveItem('cheese', 1); // (something the rats left: Pip doesn't sell cheese)
  p.chests.guide_bought = true; talk('pip', 'supplies'); assert.strictEqual(p.quests.recruit.step, 3, 'bought, but sold nothing yet');
  p.chests.guide_sold = true; talk('pip', 'supplies'); assert.strictEqual(p.quests.recruit.step, 4, 'bought and sold: on');
  talk('postmaster', 'locker'); assert.strictEqual(p.quests.recruit.step, 4, 'Hobb: a locker first');
  p.depot.contents.push({ id: 'apple', count: 1 }); talk('postmaster', 'locker'); assert.strictEqual(p.quests.recruit.step, 5);
  talk('corwin', 'fighter');
  assert.strictEqual(state.questState('recruit'), 'done');
  for (const it of ['wooden_shield', 'backpack', 'rope']) assert.strictEqual(state.countItem(it), 1, `a ${it}`);
});


test('the gate watch: a task beyond each gate, two potions to set out with, gear for it, and each guard sends you on to the next', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  const npc = id => state.npcs.find(n => n.npcId === id);
  const talk = (id, ...words) => { const g = npc(id); ctx.teleport({ ...ctx.findFreeTile(g.x, g.y, g.z, 2), z: g.z }); A.say('hi'); for (const w of words) A.say(w); A.say('bye'); };
  for (const id of ['gate_west', 'gate_south', 'gate_east', 'gate_north']) assert(npc(id), `${id} stands at a gate`);
  talk('gate_west', 'wolves', 'yes');
  assert.strictEqual(state.questState('gate_west'), 'none', 'not at level 1');
  p.level = 5;
  const nests = vm.runInContext('GATE_SITES.nests', game.ctx);
  const deeds = {
    // west: his pack, then Greyfang himself: his pelt
    gate_west: () => {
      for (let i = 0; i < 4; i++) ctx.onMonsterKilled('wolf');
      assert.strictEqual(ctx.questNews('gate_west').mark, 'busy', 'the pack alone is not enough');
      ctx.onMonsterKilled('greyfang');
      assert.strictEqual(state.countItem('greyfang_pelt'), 1, 'his pelt, taken from him');
      ctx.onMonsterKilled('greyfang'); assert.strictEqual(state.countItem('greyfang_pelt'), 1, 'only one');
    },
    // south: Wendel on his rock; then he rows home by himself
    gate_south: () => {
      const w = npc('oak_stranded');
      assert.deepStrictEqual([w.x, w.y], [101, 220], 'Wendel on his rock');
      talk('oak_stranded', 'help');
      assert.strictEqual(state.player.quests.gate_south.step, 1, 'rescued');
      assert(Math.abs(w.x - 41) <= 3 && Math.abs(w.y - 176) <= 3, 'and he is home at Fisher\'s Rest');
    },
    // east: four nests burnt, the first with Hilde's torch
    gate_east: () => {
      const [x, y] = nests[0];
      ctx.teleport({ x, y: y + 1, z: 8 });
      A.useItemOn(bagRef(state, 'hand_torch'), x, y, 8);
      assert(state.map.get(x, y, 8).items.includes('nest_burnt'), 'the torch burns a nest');
      ctx.burnThing(x, y, 8); // (burnt already: nothing)
      assert.strictEqual(ctx.burntCount('gate_east'), 1);
      for (const [nx, ny] of nests.slice(1)) ctx.burnThing(nx, ny, 8);
      assert.strictEqual(ctx.burntCount('gate_east'), 4);
    },
    // north: the plans from the war chest in Gnash's camp
    gate_north: () => { ctx.useThing(198, 70, 8); assert.strictEqual(state.countItem('gnash_plans'), 1, 'the war plans'); },
  };
  for (const [id, word, item, next] of [['gate_west', 'wolves', 'leather_armor', /Tilda/], ['gate_south', 'crabs', 'leather_legs', /Hilde/],
    ['gate_east', 'spiders', 'chain_helmet', /Osric/], ['gate_north', 'goblins', 'studded_shield', /Sister Ama/]]) {
    assert.strictEqual(ctx.questNews(id).mark, 'offer', `${id} has a task: !`);
    const potions = state.countItem('health_potion');
    talk(id, word, 'yes');
    assert.strictEqual(state.questState(id), 'active', `${id} taken on`);
    assert.strictEqual(state.countItem('health_potion'), potions + 2, `${id} gives two potions to set out with`);
    // (Tilda's task goes to Wendel first: with no crabs round him, he's waiting for you)
    if (id === 'gate_south') assert.strictEqual(ctx.questNews('oak_stranded').mark, 'report', 'Wendel: ?');
    else assert.strictEqual(ctx.questNews(id).mark, 'busy', `${id}: not done yet`);
    deeds[id]();
    assert.strictEqual(ctx.questNews(id).mark, 'report', `${id} waits for the news: ?`);
    talk(id, word);
    assert.strictEqual(state.questState(id), 'done', `${id} is done`);
    assert.strictEqual(state.countItem(item), 1, `${id} gives ${item}`);
    assert(next.test(messages.join(' ')), `${id} sends you on`);
  }
  assert.strictEqual(state.countItem('greyfang_pelt') + state.countItem('gnash_plans'), 0, 'what was brought is handed in');
});

test('the gate watch\'s hunts give two potions as you take one on, lying at your feet when your bag is full', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, A = state.Actions;
  p.level = 5; p.quests.gate_west = { status: 'done', step: 1, kills: {} };
  const bram = state.npcs.find(n => n.npcId === 'gate_west');
  ctx.teleport({ ...ctx.findFreeTile(bram.x, bram.y, 8, 2), z: 8 });
  const bag = p.equipment.backpack;
  bag.contents = Array.from({ length: state.ITEMS[bag.id].container }, () => ({ id: 'wooden_shield', count: 1 })); // (full)
  A.say('hi'); A.say('hunt'); A.say('yes'); A.say('bye');
  assert.strictEqual(state.questState('task_west'), 'active');
  const pile = state.piles.find(pl => pl.x === p.x && pl.y === p.y && pl.z === p.z);
  assert(pile && pile.items.some(i => i.id === 'health_potion' && i.count === 2), 'two potions at your feet');
});

test('Wendel stays on his rock while a crab of his rock lives, even one lured away', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player;
  p.level = 3; p.quests.gate_south = { status: 'active', step: 0, kills: {} };
  const s = state.map.spawns.find(sp => sp.type === 'crab' && Math.max(Math.abs(sp.x - 101), Math.abs(sp.y - 220)) <= 3);
  assert(s, 'crabs live on the rock');
  const crab = ctx.spawnMonster(s); state.monsters.push(crab);
  Object.assign(crab, { x: 100, y: 212 }); // (lured up the beach)
  const w = state.npcs.find(n => n.npcId === 'oak_stranded');
  ctx.teleport({ x: w.x, y: w.y - 1, z: 8 });
  state.Actions.say('hi'); state.Actions.say('help'); state.Actions.say('bye');
  assert.strictEqual(p.quests.gate_south.step, 0, 'not yet');
  crab.dead = true;
  state.Actions.say('hi'); state.Actions.say('help'); state.Actions.say('bye');
  assert.strictEqual(p.quests.gate_south.step, 1, 'rescued');
  state.now += 4 * 60000; ctx.teleport({ x: 129, y: 124, z: 8 }); tick(game, 100);
  assert.deepStrictEqual([w.x, w.y], [101, 220], 'and after a while he is back out on his rock');
});

test('Gnash\'s war chest opens only for the north gate\'s task, and a burnt nest is spun again after a while', () => {
  const game = quietGame();
  const { ctx, state } = game;
  ctx.teleport({ x: 198, y: 71, z: 8 });
  ctx.useThing(198, 70, 8);
  assert.strictEqual(state.countItem('gnash_plans'), 0, 'not without the task');
  const [x, y] = vm.runInContext('GATE_SITES.nests[1]', game.ctx);
  ctx.teleport({ x, y: y + 1, z: 8 });
  state.player.level = 2; state.player.mana = 100; state.player.spellReady = 0;
  state.Actions.say('lumen'); tick(game, 100);
  assert(state.map.get(x, y, 8).items.includes('nest_burnt'), 'Torchlight cast next to a nest burns it');
  ctx.teleport({ x: 129, y: 124, z: 8 });
  state.now += 11 * 60000; tick(game, 100);
  assert(state.map.get(x, y, 8).items.includes('spider_nest'), 'spun again');
});

test('the goblins of Goblin Hill sleep at night: they wake when you step right next to one, or hit one', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player;
  while (ctx.daylight() >= 0.5) state.now += 60000; // (night)
  const s = state.map.spawns.find(sp => sp.type === 'goblin' && sp.sleeps);
  assert(s, 'sleeping goblins on Goblin Hill');
  const g = ctx.spawnMonster(s), buddy = ctx.spawnMonster({ ...s, x: s.x + 2 });
  state.monsters.push(g, buddy);
  ctx.teleport({ ...ctx.findFreeTile(g.x + 3, g.y, g.z, 1), z: g.z });
  assert.strictEqual(ctx.monsterTarget(g), null, 'three tiles off, it sleeps on');
  ctx.updateMonster(g, 0); assert(g.asleep, 'asleep');
  ctx.teleport({ ...ctx.findFreeTile(g.x + 1, g.y, g.z, 0) || ctx.findFreeTile(g.x, g.y + 1, g.z, 0) || ctx.findFreeTile(g.x - 1, g.y, g.z, 0), z: g.z });
  assert(Math.max(Math.abs(p.x - g.x), Math.abs(p.y - g.y)) <= 1, 'right next to it');
  assert.strictEqual(ctx.monsterTarget(g), p, 'it wakes');
  assert(buddy.awakeUntil > state.now, 'and wakes the goblins round it');
  // by day they are up anyway; a hit wakes one at night
  const h = ctx.spawnMonster(s); state.monsters.push(h);
  ctx.teleport({ x: h.x + 4, y: h.y, z: h.z });
  assert(ctx.monsterAsleep(h));
  h.angryAt = p.id; h.angryUntil = state.now + 15000;
  assert(!ctx.monsterAsleep(h), 'a hit wakes it');
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
  tick(game, 8000);
  assert(Math.abs(wolf.x - p.x) <= 1, 'and comes straight for you');
});

test('hunting packs keep apart, and before a vocation a death costs half as much experience', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const ground = state.map.spawns.filter(s => s.z === 8 && ['wolf', 'spider', 'crab', 'goblin', 'bear'].includes(s.type));
  // a pack: monsters within 4 tiles of each other; no pack of more than three
  for (const s of ground) {
    const round = ground.filter(o => Math.max(Math.abs(o.x - s.x), Math.abs(o.y - s.y)) <= 4);
    assert(round.length <= 3, `at most a pack of three round ${s.type} at ${s.x},${s.y} (${round.map(o => o.type).join(', ')})`);
  }
  const rats = state.map.spawns.filter(s => s.z === 8 && s.type === 'rat');
  assert(!ground.some(s => s.type === 'spider' && rats.some(r => Math.max(Math.abs(r.x - s.x), Math.abs(r.y - s.y)) <= 10)), 'no spiders in sight of the first rats');
  const p = state.player;
  Object.assign(p, { tutorial: 0, xp: 10000 });
  ctx.gainXp(0);
  ctx.playerDies(null);
  assert.strictEqual(p.xp, 9500, 'a twentieth of it, not a tenth');
});

test('in the deep cistern the giant rats lurk: they notice you only when you come near, not from across the cave', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const lurkers = state.map.spawns.filter(s => s.z === 5 && s.lurk);
  assert(lurkers.length >= 10 && lurkers.some(s => s.type === 'cistern_slime'), 'the cistern\'s rats and its slime lurk');
  assert(lurkers.every(s => Math.max(Math.abs(s.x - 128), Math.abs(s.y - 111)) >= 4), 'none waits by the ladder down');
  ctx.teleport({ x: 128, y: 111, z: 5 });
  const p = state.player;
  const far = ctx.spawnMonster({ ...lurkers.find(s => s.type === 'giant_rat' && Math.max(Math.abs(s.x - p.x), Math.abs(s.y - p.y)) > 6) });
  assert.strictEqual(ctx.monsterTarget(far), null, 'a rat across the cave has not seen you');
  const near = ctx.spawnMonster({ ...lurkers[0], x: p.x + 3, y: p.y });
  assert.strictEqual(ctx.monsterTarget(near), p, 'one three tiles off has');
});

test('rats in Sunny Fields come for you once they could be on your screen, not only up close', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const s = state.map.spawns.find(o => o.type === 'rat' && o.z === 8);
  assert(!s.lurk, 'field rats don\'t lurk');
  ctx.teleport({ x: s.x + 6, y: s.y, z: 8 });
  const rat = ctx.spawnMonster({ ...s });
  rat.x = s.x; rat.y = s.y;
  assert.strictEqual(ctx.monsterTarget(rat), state.player, 'a rat six tiles off has seen you');
});

test('monsters keep to their territory: they follow you a while, then amble home, and never come into town', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, s = state.map.spawns.find(o => o.type === 'rat' && o.z === 8);
  const rat = ctx.spawnMonster({ ...s });
  Object.assign(rat, { x: s.x + 11, y: s.y }); // led far from home
  state.monsters.push(rat);
  ctx.teleport({ x: s.x + 22, y: s.y, z: 8 });
  Object.assign(p, { hp: 999, maxHp: 999 });
  assert(ctx.leftTerritory(rat, p), 'too far from home with you beyond its territory: it gives up');
  assert(rat.returning && rat.goal.x === s.x, 'and walks back to its spawn');
  for (let t = 0; t < 30000 && rat.returning; t += 500) tick(game, 500); // (once home it wanders again)
  assert(Math.max(Math.abs(rat.x - s.x), Math.abs(rat.y - s.y)) <= 3, 'it got home');
  assert(!rat.returning, 'and minds you again');
  const r3 = ctx.spawnMonster({ ...s });
  Object.assign(r3, { x: s.x + 11, y: s.y });
  state.monsters.push(r3);
  ctx.teleport({ x: s.x + 22, y: s.y, z: 8 });
  ctx.leftTerritory(r3, p);
  ctx.teleport({ x: s.x + 6, y: s.y + 1, z: 8 });
  Object.assign(r3, { x: s.x + 7, y: s.y });
  ctx.updateMonster(r3, state.monsters.indexOf(r3));
  assert(!r3.returning, 'on its way home it turns on you when you come close inside its territory');
  const r4 = ctx.spawnMonster({ ...s });
  Object.assign(r4, { x: s.x + 30, y: s.y });
  state.monsters.push(r4);
  ctx.teleport({ x: s.x + 60, y: s.y, z: 8 });
  ctx.updateMonster(r4, state.monsters.indexOf(r4));
  assert(Math.max(Math.abs(r4.x - s.x), Math.abs(r4.y - s.y)) <= 4, 'one far from home that nobody sees is back at its spawn');
  assert(state.map.isTown(130, 120, 8) && !state.map.isTown(130, 120, 7), 'the town\'s streets are town, the sewers below aren\'t');
  const r2 = ctx.spawnMonster({ ...s });
  Object.assign(r2, { x: 128, y: 152 }); // just outside the south gate, on the road at the end of the bridge
  state.monsters.push(r2);
  assert(state.map.isTown(128, 151, 8) && !state.map.isTown(128, 152, 8));
  assert(!ctx.step(r2, 0, -1), 'a monster can\'t step into town');
});

test('picking a target while walking: with chase on you stop and go for it, with chase off you walk on', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, A = state.Actions;
  ctx.teleport({ x: 120, y: 170, z: 8 });
  for (const chase of [true, false]) {
    ctx.teleport({ x: 120, y: 170, z: 8 });
    A.setChase(chase);
    A.walkTo(132, 170);
    tick(game, 300);
    assert(p.path.length > 3, 'on the way');
    const rat = ctx.spawnMonster({ type: 'rat', x: p.x + 2, y: p.y + 3, z: 8 });
    state.monsters.push(rat);
    A.setTarget(rat.id);
    assert.strictEqual(p.path.length > 0, !chase, chase ? 'chase on: the walk stops' : 'chase off: the walk goes on');
    A.setTarget(rat.id); // (again: untarget)
    state.monsters = [];
  }
});

test('a kill task you just took: the guide points to where those monsters live, not back at whoever gave it', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player;
  const step = state.GUIDE.findIndex(st => (st.target || []).some(t => t.hunt && t.hunt.includes('gate_west')));
  Object.assign(p, { tutorial: step + 1, level: 3 });
  p.quests.bell_1 = { status: 'done', step: 0, kills: {} };
  p.quests.gate_west = { status: 'active', step: 0, kills: {} };
  const bram = state.npcs.find(n => n.npcId === 'gate_west');
  ctx.teleport({ x: bram.x + 1, y: bram.y, z: bram.z });
  const t = ctx.guideTarget(state.GUIDE[step]);
  assert(t && t !== bram && state.map.spawns.some(s => s.type === 'wolf' && s.x === t.x && s.y === t.y), 'the arrow points at the wolves');
});

test('the temple has a wide open archway, three tiles across, and no door: you walk straight in', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const map = state.map, p = state.player;
  const [dx, dy] = [137, 106];
  assert.deepStrictEqual([-1, 0, 1].map(k => map.get(dx + k, dy, 9).items.join()), ['arch_w', 'arch_m', 'arch_e']);
  assert(![-2, -1, 0, 1, 2].some(k => map.get(dx + k, dy, 9).items.some(id => id.startsWith('door'))), 'no door');
  for (const k of [-1, 0, 1]) assert(map.isWalkable(dx + k, dy, 9), 'every tile of it walkable');
  ctx.teleport({ x: dx + 1, y: dy + 2, z: 9 });
  state.Actions.walkTo(dx + 1, dy - 2);
  tick(game, 4000);
  assert.strictEqual(`${p.x},${p.y}`, `${dx + 1},${dy - 2}`, 'through its east side, into the temple');
});

test('weapon hits as in Tibia: skill counts most, at least level / 5, and a monster\'s defense and armor can block a hit', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player;
  const club = state.playerWeapon();
  assert.strictEqual(club.attack, 7, 'a new character fights with a wooden club');
  assert.strictEqual(state.physicalMax(club), 4, 'level 1, skill 10, balanced: at most 0.085 x 0.75 x 7 x 10 + 0.2');
  p.fightMode = 'offensive';
  assert.strictEqual(state.physicalMax(club), 6, 'full attack hits harder');
  p.fightMode = 'balanced';
  p.skills.club.level = 30; p.level = 10;
  assert.strictEqual(state.physicalMax(club), 15, 'skill 30, level 10: 0.085 x 0.75 x 7 x 30 + 2');
  const hits = Array.from({ length: 400 }, () => state.physicalHit(club));
  assert(Math.min(...hits) >= 2 && Math.max(...hits) <= 15, 'between level / 5 and the most');
  const mid = hits.filter(h => h >= 6 && h <= 11).length;
  assert(mid > hits.length * 0.55, 'most of them round the middle');
  const wolf = ctx.spawnMonster({ type: 'wolf', x: 130, y: 172, z: 8 });
  const blocks = Array.from({ length: 200 }, () => state.blocked(wolf));
  assert(Math.min(...blocks) >= 1 && Math.max(...blocks) <= 2, 'a wolf\'s defense (2) blocks 1 to 2 of a hit');
  assert.strictEqual(state.blocked({ type: 'player' }), 0, 'players have no monster defense');
});

const vmLevelXp = (ctx, l) => require('vm').runInContext(`xpForLevel(${l})`, ctx);

test('before a vocation dying never costs a level, and Sister Ama says what to do differently', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player;
  ctx.gainXp(vmLevelXp(ctx, 3) - p.xp + 5); // (just into level 3)
  assert.strictEqual(p.level, 3);
  const wolf = { type: 'wolf', name: 'wolf', def: state.MONSTERS.wolf };
  ctx.playerDies(wolf);
  assert.strictEqual(p.level, 3, 'still level 3');
  assert(!messages.some(m => /Sister Ama: .*Wolves hunt in threes/.test(m)), 'not yet: you are still lying there');
  ctx.respawnPlayer();
  assert(messages.some(m => /Sister Ama: .*Wolves hunt in threes/.test(m)), 'a tip about wolves, once you wake');
});

test('raids come to Oakvale\'s gates and Bone Rocks, on ground monsters can stand on', () => {
  const game = quietGame();
  const { ctx, state } = game;
  for (const raid of state.RAIDS) {
    const before = state.monsters.length;
    ctx.startRaid(raid);
    const came = state.monsters.length - before;
    assert(came >= Math.ceil(raid.spawns.reduce((n, [, k]) => n + k, 0) / 2), `${raid.name}: ${came} came`);
    assert(state.map.isle && raid.at.x >= state.map.isle.x0 && raid.at.x <= state.map.isle.x1, `${raid.name} is on the island`);
  }
});

test('a newcomer who doesn\'t know the words is understood: "what do I do", "thanks", "hi" again', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const A = state.Actions, ama = state.npcs.find(n => n.npcId === 'ama');
  ctx.teleport({ ...ctx.findFreeTile(ama.x, ama.y, ama.z, 2), z: ama.z });
  const said = w => { const n = messages.length; A.say(w); tick(game, 100); return messages.slice(n).join(' | '); };
  said('hi');
  assert(/fight/.test(said('what do i do')), 'she says what she has for you (the fight)');
  assert(/welcome/i.test(said('thanks')), 'thanks: you are welcome');
  assert(/Yes, /.test(said('hello')), 'a greeting again is answered');
  assert(!/not sure/.test(said('where am i')), 'where: no "not sure what you mean"');
  assert(/long winter|ship/i.test(said('founders')), 'and she tells of the founders');
});

test('the guide never waits for Next: an explaining step passes once read, or at once when you play on', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, G = state.GUIDE;
  ctx.teleport(state.map.start); p.tutorial = 1; tick(game, 300);
  assert.strictEqual(p.tutorial, 1, 'the welcome stays a moment');
  tick(game, 17000);
  assert(p.tutorial >= 2, 'then passes by itself');
  // played on: talking to Sister Ama while the welcome is still up passes it at once
  p.tutorial = 1; tick(game, 100);
  const ama = state.npcs.find(n => n.npcId === 'ama');
  ctx.teleport({ ...ctx.findFreeTile(ama.x, ama.y + 1, ama.z, 2), z: ama.z }); state.Actions.say('hi'); tick(game, 300);
  assert(p.tutorial >= 3, 'played on: past the welcome, and past meeting her');
});

test('a tool used on a spot further off: you walk there and use it; walking away yourself calls it off', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  ctx.teleport({ x: 128, y: 170, z: 8 }); ctx.addItem('shovel', 1);
  let spot = null;
  for (let dx = 4; dx <= 6 && !spot; dx++) for (const dy of [0, 1, -1]) if (state.isFree(128 + dx, 170 + dy, 8)) { spot = { x: 128 + dx, y: 170 + dy }; break; }
  assert(spot, 'an open spot to dig');
  A.useItemOn(bagRef(state, 'shovel'), spot.x, spot.y, 8); tick(game, 4000);
  assert(state.dist(p, spot) <= 1, 'walked there');
  assert(!messages.some(m => /stand next to it/.test(m)), 'no "stand next to it"');
  ctx.teleport({ x: 128, y: 170, z: 8 }); tick(game, 200);
  A.useItemOn(bagRef(state, 'shovel'), spot.x, spot.y, 8); tick(game, 300);
  A.keyDown('arrowleft'); A.keyUp('arrowleft'); tick(game, 3000);
  assert(state.dist(p, spot) > 1 && !p.action, 'walking away yourself calls it off');
});

test('chase: a new target ends a walk and is chased; walking away switches Chase off, and ends a follow', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, A = state.Actions;
  ctx.teleport({ x: 128, y: 170, z: 8 }); p.chase = true;
  const rat = ctx.spawnMonster({ type: 'rat', x: p.x + 4, y: p.y, z: 8 }); rat.def = { ...rat.def, aggro: 0, speed: 99999 }; rat.hp = rat.maxHp = 999;
  state.monsters.push(rat);
  A.walkTo(p.x - 6, p.y); tick(game, 100);
  assert(p.path.length, 'walking somewhere');
  A.targetNearest();
  assert(p.target === rat && !p.path.length, 'attacking ends the walk');
  tick(game, 2500);
  assert(state.dist(p, rat) <= 1.5, 'and chases the monster');
  const dir = rat.x > p.x ? 'arrowleft' : 'arrowright';
  rat.nextMove = 1e15; // (it stays where it is)
  A.keyDown(dir); tick(game, 1500); A.keyUp(dir); tick(game, 600);
  assert(!p.chase, 'walking away switches Chase off');
  const at = [p.x, p.y]; tick(game, 2500);
  assert(p.x === at[0] && p.y === at[1] && state.dist(p, rat) > 1.5, 'and you are not pulled back to it');
  A.targetNearest(); tick(game, 2500);
  assert(p.x === at[0] && p.y === at[1], 'not even by attacking again, till you switch it on');
  // following someone, then tapping to use something further off: the follow ends
  A.follow(rat.id); assert(p.follow === rat.id, 'following'); A.interact('use', p.x - 3, p.y, p.z);
  assert(!p.follow, 'walking off to use something ends the follow');
});

test('auto-heal drinks a potion by itself below the health or mana you chose, health first, and says when you run out', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  ctx.teleport({ x: 128, y: 170, z: 8 });
  const potions = () => state.countItem('health_potion');
  A.setAutoHeal('hp', 999); assert.strictEqual(p.autoHeal.hp, 80, 'the setting stays within its slider');
  A.setAutoHeal('mana', 'x'); assert.strictEqual(p.autoHeal.mana, 0, 'nonsense turns it off');
  A.setAutoHeal('gold', 50); assert(!('gold' in p.autoHeal), 'only health and mana');
  A.setAutoHeal('hp', 40);
  p.hp = Math.floor(p.maxHp * 0.5); const n0 = potions(); tick(game, 300);
  assert.strictEqual(potions(), n0, 'above the setting: no potion');
  p.hp = Math.floor(p.maxHp * 0.3); p.potionReady = 0; tick(game, 300);
  assert.strictEqual(potions(), n0 - 1, 'below it: one potion drunk');
  assert(p.hp > Math.floor(p.maxHp * 0.3), 'and it healed');
  // health before mana, one potion a second
  ctx.addItem('mana_potion', 3); A.setAutoHeal('mana', 50);
  p.hp = 10; p.mana = 1; p.potionReady = 0; const m0 = state.countItem('mana_potion'), h0 = potions(); tick(game, 200);
  assert(potions() === h0 - 1 && state.countItem('mana_potion') === m0, 'health comes first');
  // out of health potions: said once, and the mana potion is drunk meanwhile
  while (potions()) ctx.removeItem('health_potion', 1);
  p.hp = 10; p.mana = 1; p.potionReady = 0; tick(game, 1500);
  assert(messages.some(m => /Out of health potions/.test(m)), 'running out is said');
  assert.strictEqual(messages.filter(m => /Out of health potions/.test(m)).length, 1, 'once');
  assert(state.countItem('mana_potion') < m0, 'mana still looked after');
  A.setAutoHeal('hp', 0); A.setAutoHeal('mana', 0);
  p.hp = 10; p.mana = 1; p.potionReady = 0; const m1 = state.countItem('mana_potion'); tick(game, 1500);
  assert.strictEqual(state.countItem('mana_potion'), m1, 'off: nothing drunk');
});

test('Clang, a companion: follows you, fights what you fight, and grows as he fights and trains', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player;
  p.level = 5; // (a companion never grows past you)
  p.pet = { name: 'Clang', kind: 'cat', level: 1, xp: 0 };
  ctx.teleport({ x: 120, y: 160, z: 8 }); tick(game, 200);
  assert(p.petBody && p.petBody.z === 8 && state.dist(p.petBody, p) <= 2, 'he appears beside you');
  ctx.teleport({ x: 128, y: 170, z: 8 }); tick(game, 3000);
  assert(state.dist(p.petBody, p) <= 2, 'and keeps up when you go');
  const rat = ctx.spawnMonster({ type: 'rat', x: p.x + 3, y: p.y, z: 8 }); rat.def = { ...rat.def, aggro: 0 }; rat.hp = rat.maxHp = 999;
  state.monsters.push(rat); p.target = rat; tick(game, 6000);
  assert(rat.hp < 999, 'he scratches your target');
  for (let i = 0; i < 40; i++) ctx.petLearn(1);
  assert(p.pet.level >= 2 && messages.some(m => /Clang grows stronger/.test(m)), 'and grows');
  // hurt by monsters now and then; knocked out, it runs home; Ama fetches it
  const before = p.pet.hp; ctx.petHurt(5); assert(p.pet.hp < before, 'a blow hurts it');
  state.Actions.petPotion(); assert.strictEqual(p.pet.hp, state.PETS.cat.hp(p.pet.level), 'a potion heals it');
  ctx.petHurt(9999); assert(p.pet.downUntil > 0 && !p.petBody, 'knocked out: it runs home');
  assert(/bandaged/.test(ctx.petCare()) && !p.pet.downUntil, 'Sister Ama fetches it back');
  state.Actions.petHome(); tick(game, 100); assert(!p.petBody, 'sent home'); state.Actions.petCall(); tick(game, 100); assert(p.petBody, 'and called back');
  state.Actions.petName('  whiskers<> '); assert.strictEqual(p.pet.name, 'Whiskers', 'named');
  p.dead = true; ctx.updatePet(); assert.strictEqual(p.petBody, null, 'gone while you are dead');
});

test("grown Clang rings his bell: the Guardian's Toll hurts and dazes every monster beside him", () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player;
  p.level = 10; p.pet = { name: 'Clang', kind: 'cat', level: 8, xp: 0, mode: 'assist' };
  ctx.teleport({ x: 128, y: 170, z: 8 }); tick(game, 200);
  const b = p.petBody, rats = [1, -1].map(d => { const r = ctx.spawnMonster({ type: 'rat', x: b.x + d, y: b.y + 1, z: 8 }); r.hp = r.maxHp = 999; r.def = { ...r.def, aggro: 0 }; state.monsters.push(r); return r; });
  p.target = rats[0]; tick(game, 1500);
  assert(rats.every(r => r.hp < 999), 'both rats beside him are hurt');
  assert(rats.every(r => r.dazedUntil > 0), 'and dazed');
  assert(state.effects.some(fx => fx.kind === 'speech' && fx.text === 'CLANG!'), 'with a CLANG!');
  const at = b.nextToll; tick(game, 3000); assert.strictEqual(b.nextToll, at, 'not again for a while');
});

// A companion's world: you with Clang at level 5, somewhere open on the island
function petGame() {
  const game = quietGame();
  const p = game.state.player;
  p.level = 5;
  p.pet = { name: 'Clang', kind: 'cat', level: 1, xp: 0 };
  game.ctx.teleport({ x: 128, y: 170, z: 8 }); tick(game, 300);
  return game;
}

test('Clang defends you without a target, keeps back hurt till 60%, and auto-heal tends him with pet tonics', () => {
  const game = petGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions, b = p.petBody;
  // a rat biting you, nothing targeted: he goes for it
  const rat = ctx.spawnMonster({ type: 'rat', x: p.x + 1, y: p.y, z: 8 }); rat.hp = rat.maxHp = 999; rat.angryAt = p.id; rat.angryUntil = state.now + 60000;
  state.monsters.push(rat); p.target = null; tick(game, 5000);
  assert(rat.hp < 999, 'he scratches what attacks you');
  // hurt: back at 29%, still back at 45%, in again at 60%
  p.pet.hp = Math.floor(b.maxHp * 0.29); tick(game, 300);
  assert(b.resting, 'badly hurt: he keeps back');
  p.pet.hp = Math.floor(b.maxHp * 0.45); tick(game, 300);
  assert(b.resting, 'not straight back in');
  p.pet.hp = Math.ceil(b.maxHp * 0.61); tick(game, 300);
  assert(!b.resting, 'healed: back in the fight');
  // auto-heal: a tonic below the setting, never your health potions
  ctx.addItem('pet_tonic', 2); const hp0 = state.countItem('health_potion');
  A.setAutoHeal('pet', 50); p.pet.hp = 5; p.pet.tendReady = 0; tick(game, 300);
  assert(p.pet.hp > 5 && state.countItem('pet_tonic') === 1, 'a pet tonic tended him');
  assert.strictEqual(state.countItem('health_potion'), hp0, 'your potions untouched');
  while (state.countItem('pet_tonic')) ctx.removeItem('pet_tonic', 1);
  for (const it of state.bagItems().filter(i => state.ITEMS[i.id].use && state.ITEMS[i.id].use.food)) ctx.removeItem(it.id, it.count);
  p.pet.hp = 5; p.pet.tendReady = 0; tick(game, 2500);
  assert(messages.some(m => /auto-heal is waiting/.test(m)), 'running out is said');
});

test('Clang never stands on your tile or a monster\'s: he steps aside', () => {
  const game = petGame();
  const { ctx, state } = game;
  const p = state.player, b = p.petBody;
  ctx.teleport({ x: b.x, y: b.y, z: b.z }); // (you walk onto him)
  tick(game, 1500);
  assert(!(b.x === p.x && b.y === p.y), 'off your tile');
  const rat = ctx.spawnMonster({ type: 'rat', x: b.x, y: b.y, z: 8 }); rat.def = { ...rat.def, aggro: 0, speed: 0 }; state.monsters.push(rat);
  tick(game, 1500);
  assert(!(p.petBody.x === rat.x && p.petBody.y === rat.y), 'off a monster\'s tile');
});

test('Clang learns half of a kill he helped with, a dummy teaches him only to level 4, and he never outgrows you', () => {
  const game = petGame();
  const { ctx, state, messages } = game;
  const p = state.player;
  const rat = ctx.spawnMonster({ type: 'rat', x: p.x + 1, y: p.y, z: 8 }); rat.def = { ...rat.def, aggro: 0 }; rat.hp = rat.maxHp = 1;
  rat.petHelp = { [p.id]: true }; state.monsters.push(rat);
  ctx.killMonster(rat);
  assert.strictEqual(p.pet.xp, Math.floor(rat.def.xp * 0.5), `half the rat's experience (${p.pet.xp})`);
  // at the dummy: a point every fourth blow of yours, up to level 4
  p.pet.xp = 0;
  ctx.teleport({ x: 144, y: 140, z: 8 }); tick(game, 300);
  ctx.useThing(144, 141, 8);
  for (let i = 0; i < 40; i++) tick(game, 1000);
  assert(p.pet.xp >= 8 && p.pet.xp <= 11 && p.pet.level === 1, `about one point every four blows (${p.pet.xp} after ${p.trainHits})`);
  p.pet.level = 4; p.pet.xp = 0;
  for (let i = 0; i < 40; i++) tick(game, 1000);
  assert(p.pet.level === 4 && p.pet.xp === 0, 'nothing more from the dummy at level 4');
  assert.strictEqual(messages.filter(m => /learned all a dummy can teach/.test(m)).length, 1, 'said once');
  // never past your level
  p.pet.level = 5; ctx.petLearn(9999);
  assert.strictEqual(p.pet.level, 5, 'waits at your level');
  p.level = 6; ctx.petLearn(1);
  assert.strictEqual(p.pet.level, 6, 'and grows when you do');
});

test('Clang: food and potions are kept at full health, home does nothing while he is knocked out, names need a letter', () => {
  const game = petGame();
  const { ctx, state, messages } = game;
  const p = state.player;
  ctx.addItem('cheese', 2); ctx.addItem('health_potion', 2);
  const food = state.countItem('cheese'), potions = state.countItem('health_potion');
  state.Actions.petFeed(); state.Actions.petPotion();
  assert.strictEqual(state.countItem('cheese'), food, 'no food used at full health');
  assert.strictEqual(state.countItem('health_potion'), potions, 'no potion used');
  assert(messages.some(m => /isn't hungry/.test(m)) && messages.some(m => /isn't hurt/.test(m)), 'he says so');
  ctx.petHurt(20); state.Actions.petFeed();
  assert(messages.some(m => /Clang eats an? \w/.test(m)) && !messages.some(m => /eats the a/.test(m)), 'hurt, he eats ("an apple", not "the an apple")');
  ctx.petHurt(9999);
  assert(p.pet.downUntil, 'knocked out');
  state.Actions.petHome();
  assert(!p.pet.home, 'sending him home does nothing while he is away');
  ctx.petCare();
  for (const bad of ['123', '  ', "'-'", 'Sister Ama', 'ama']) { state.Actions.petName(bad); assert.strictEqual(p.pet.name, 'Clang', `refused: "${bad}"`); }
  state.Actions.petName('Zéphyr'); assert.strictEqual(p.pet.name, 'Zéphyr', 'normalized');
});

test('Clang never fights players, nor from or into a protection zone; Follow keeps him out of fights', () => {
  const game = petGame();
  const { ctx, state } = game;
  const p = state.player;
  // a player as your target: nothing breaks, nobody gets hurt by him
  const q = ctx.newPlayer('Other'); state.players.push(q);
  ctx.asPlayer(q, () => ctx.teleport({ x: p.x + 2, y: p.y, z: p.z }));
  const hp = q.hp; p.target = q;
  tick(game, 4000);
  assert.strictEqual(q.hp, hp, 'he leaves players alone');
  p.target = null; state.players.splice(state.players.indexOf(q), 1);
  // from a protection zone
  const M = state.map;
  let spot = null;
  for (let y = 60; y < 220 && !spot; y++) for (let x = 60; x < 220 && !spot; x++) for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    if (!spot && M.isProtected(x, y, 8) && state.isFree(x, y, 8) && state.isFree(x + dx, y + dy, 8) && !M.isProtected(x + 2 * dx, y + 2 * dy, 8) && state.isFree(x + 2 * dx, y + 2 * dy, 8)) spot = { x, y, z: 8, dx, dy };
  }
  assert(spot, 'a protection zone with open ground by it');
  ctx.teleport({ x: spot.x, y: spot.y, z: 8 }); tick(game, 1000);
  const wolf = ctx.spawnMonster({ type: 'rat', x: spot.x + 2 * spot.dx, y: spot.y + 2 * spot.dy, z: 8 }); wolf.def = { ...wolf.def, aggro: 0, speed: 0 }; wolf.hp = wolf.maxHp = 999;
  state.monsters.push(wolf); p.chase = false; p.target = wolf;
  tick(game, 8000);
  assert.strictEqual(wolf.hp, 999, 'not from where you are safe');
  // Follow: never fights; Assist: fights again
  ctx.teleport({ x: 128, y: 170, z: 8 }); tick(game, 1000);
  Object.assign(wolf, { x: p.x + 2, y: p.y }); p.target = wolf;
  state.Actions.petMode('follow'); tick(game, 6000);
  assert.strictEqual(wolf.hp, 999, 'Follow: he keeps out of it');
  state.Actions.petMode('nonsense'); assert.strictEqual(p.pet.mode, 'follow', 'only real modes');
  state.Actions.petMode('assist'); tick(game, 8000);
  assert(wolf.hp < 999, 'Assist: he joins in');
});

test('the oracle: no mainland yet, so you stay as Oakvale\'s own; once there is one, she sends you across', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions, map = state.map;
  assert(!vm.runInContext('mainlandOpen()', ctx), 'the beginners\' island comes first: no mainland in the built-in world');
  const oracle = state.npcs.find(n => n.npcId === 'oak_oracle');
  const ask = (...words) => { ctx.teleport({ ...ctx.findFreeTile(oracle.x, oracle.y, oracle.z, 2), z: oracle.z }); const n = messages.length; A.say('hi'); for (const w of words) A.say(w); tick(game, 3000); return messages.slice(n).join(' | '); };
  p.level = 10; p.xp = state.xpForLevel(10);
  const said = ask('destiny', 'knight', 'yes'), at = { x: p.x, y: p.y, z: p.z };
  assert.strictEqual(p.vocation, 'knight');
  assert(/road to the front is closed/.test(said) && /one of Oakvale's own/.test(said), 'the farewell is honest: the road to the front is closed');
  assert(!/mainland|Orin|Valoria|dream|never come back/i.test(said), `nothing of a mainland that isn't there: ${said}`);
  assert.strictEqual(oracle.z, p.z, 'and nobody is sent anywhere');
  assert(state.dist(oracle, p) <= 3, 'you are still beside her');
  assert(state.countItem('health_potion') > 0 || p.equipment.backpack.contents.length, 'the oracle\'s gift');
  assert.strictEqual(vm.runInContext('homeTown()', ctx), 'Oakvale', 'you wake in Oakvale');
  // coming back later: no second crossing, no second gift
  const things = JSON.stringify(p.equipment);
  ctx.applySave(JSON.parse(JSON.stringify(ctx.serializePlayer(p)))); tick(game, 2000);
  assert.strictEqual(JSON.stringify(p.equipment), things, 'nothing given twice');
  assert(p.x === at.x && p.y === at.y && p.z === at.z, 'nor sent anywhere');
  // level 20: nobody in the world promotes yet, so nobody is named
  const n = messages.length; p.xp = state.xpForLevel(20) - 1; ctx.gainXp(2);
  assert(!messages.slice(n).some(m => /promot|Orin|Valoria/.test(m)), 'no promoter to send you to');
  // with a mainland the old way is back: off you go
  const game2 = quietGame(), p2 = game2.state.player;
  game2.state.map.mainStart = { x: 128, y: 170, z: 8 }; // (somewhere else: as if it were the mainland)
  assert(vm.runInContext('mainlandOpen()', game2.ctx));
  p2.level = 10;
  game2.ctx.chooseVocation('druid'); tick(game2, 3000);
  assert(p2.x === game2.state.map.mainStart.x && p2.y === game2.state.map.mainStart.y && p2.home === 'main', 'sent to the mainland');
  assert(game2.messages.some(m => /Welcome to the mainland/.test(m)));
});

test('the spiders\' den under the Spider Hills: reachable, spiders, and the Brood Queen with her rare fang', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const den = state.map.spawns.filter(s => s.z === 7 && (s.type === 'brood_queen' || (s.type === 'spider' && s.y < 200 && s.x > 165)));
  assert(den.some(s => s.type === 'brood_queen') && den.length >= 5, 'the Queen and her spiders');
  assert(state.map.get(176, 198, 8).items.includes('stairs_down'), 'steps down at the foot of the hills');
  assert(state.MONSTERS.brood_queen.loot.items.some(([id]) => id === 'brood_fang'), 'her rare fang');
  const q = ctx.spawnMonster({ type: 'brood_queen', x: 176, y: 179, z: 7 }); state.monsters.push(q);
  ctx.damageMonster(q, 99999, 'physical');
  assert(messages.some(m => /first to slay the Brood Queen/.test(m)), 'the first to slay her is told to everyone');
});

test('the watch\'s hunts: again and again after a gate\'s own task, paid in watch marks, spent at Captain Osric\'s', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  p.level = 5; p.quests.gate_west = { status: 'done', step: 1, kills: {} }; p.huntDay = ctx.realDay(); // (today's bonus already had)
  const talk = (id, ...words) => { const n = state.npcs.find(c => c.npcId === id); ctx.teleport({ ...ctx.findFreeTile(n.x, n.y, n.z, 2), z: n.z }); tick(game, 100); A.say('hi'); tick(game, 100); const at = messages.length; for (const w of words) { A.say(w); tick(game, 100); } A.say('bye'); tick(game, 200); return messages.slice(at).join(' | '); };
  talk('gate_west', 'hunt', 'yes'); assert.strictEqual(state.questState('task_west'), 'active', 'a hunt');
  for (let i = 0; i < 10; i++) ctx.onMonsterKilled('wolf');
  talk('gate_west', 'hunt'); assert.strictEqual(state.countItem('watch_mark'), 2, 'two watch marks');
  assert(/come back in a while/i.test(talk('gate_west', 'hunt')), 'nothing more right away');
  state.now += 21 * 60000; talk('gate_west', 'hunt', 'yes'); assert.strictEqual(state.questState('task_west'), 'active', 'later, a new hunt');
  assert(/potions/.test(talk('gate_north', 'marks')), 'Osric lists the stores');
  talk('gate_north', 'potions'); assert.strictEqual(state.countItem('watch_mark'), 0, 'two marks spent');
  assert(state.countItem('health_potion') >= 5, 'for five potions');
});

test('the first watch hunt of each real day pays three marks more, once a day, and the guard says so', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  p.level = 5; p.quests.gate_west = { status: 'done', step: 1, kills: {} }; p.quests.gate_south = { status: 'done', step: 1, kills: {} };
  assert.strictEqual(p.huntDay, '', 'a new character has had no bonus yet');
  const talk = (id, ...words) => { const n = state.npcs.find(c => c.npcId === id); ctx.teleport({ ...ctx.findFreeTile(n.x, n.y, n.z, 2), z: n.z }); tick(game, 100); A.say('hi'); tick(game, 100); const at = messages.length; for (const w of words) { A.say(w); tick(game, 100); } A.say('bye'); tick(game, 200); return messages.slice(at).join(' | '); };
  talk('gate_west', 'hunt', 'yes'); for (let i = 0; i < 10; i++) ctx.onMonsterKilled('wolf');
  const said = talk('gate_west', 'hunt');
  assert.strictEqual(state.countItem('watch_mark'), 5, 'two marks and three more');
  assert(/first hunt for the watch today: three more marks/.test(said), 'the guard says why');
  assert(messages.some(m => /first of these today: you received 3 watch marks more/.test(m)), 'and the log says so');
  assert.strictEqual(p.huntDay, ctx.realDay(), 'remembered for today');
  assert.strictEqual(JSON.parse(JSON.stringify(ctx.serializePlayer(p))).huntDay, ctx.realDay(), 'and saved');
  talk('gate_south', 'hunt', 'yes'); for (let i = 0; i < 8; i++) ctx.onMonsterKilled('crab');
  assert(!/three more marks/.test(talk('gate_south', 'hunt')), 'a second hunt the same day: no bonus');
  assert.strictEqual(state.countItem('watch_mark'), 7, 'only its own two marks');
  p.huntDay = '2020-1-1'; state.now += 21 * 60000; // (a day later)
  talk('gate_west', 'hunt', 'yes'); for (let i = 0; i < 10; i++) ctx.onMonsterKilled('wolf'); talk('gate_west', 'hunt');
  assert.strictEqual(state.countItem('watch_mark'), 12, 'the next day: the bonus again');
  const old = ctx.serializePlayer(p); delete old.huntDay; ctx.applySave(old);
  assert.strictEqual(p.huntDay, '', 'an old save without it: today\'s bonus is still to have');
});

test('rare named kin: now and then a beast comes back with a name, tougher, told to those near, and its trophy becomes gear at the smith', () => {
  const game = loadGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  const i = state.monsters.findIndex(m => m.type === 'wolf'), wolf = state.monsters[i];
  assert(i >= 0 && !state.monsters.some(m => m.rare), 'a wolf, and no rare kin at the start');
  // it comes back as Old Scarjaw (the roll forced), while the hunter waits nearby, out of sight of its spawn
  ctx.teleport({ ...ctx.findFreeTile(wolf.spawn.x + 18, wolf.spawn.y, wolf.spawn.z, 3), z: wolf.spawn.z });
  Object.assign(wolf, { dead: true, respawnAt: state.now - 1 });
  const random = ctx.Math.random;
  ctx.Math.random = () => 0.001;
  try { ctx.updateMonster(wolf, i); } finally { ctx.Math.random = random; }
  const rare = state.monsters[i];
  assert(rare !== wolf && rare.rare && rare.name === 'Old Scarjaw' && rare.type === 'wolf', 'Old Scarjaw, still a wolf');
  assert(rare.maxHp > state.MONSTERS.wolf.hp * 2 && rare.def.xp > state.MONSTERS.wolf.xp * 2, 'tougher, and worth more');
  assert(messages.some(t => /Old Scarjaw/.test(t)), 'those near are told');
  // without the roll, a wolf comes back a wolf
  Object.assign(rare, { dead: true, respawnAt: state.now - 1 });
  ctx.Math.random = () => 0.5;
  try { ctx.updateMonster(rare, i); } finally { ctx.Math.random = random; }
  assert(!state.monsters[i].rare, 'mostly a plain wolf');
  // killed: its trophy, and it counts as a wolf for the quests and the bestiary
  const scarjaw = ctx.maybeRare(state.monsters[i], true);
  p.quests.task_west = { status: 'active', step: 0, kills: {} };
  ctx.teleport({ ...ctx.findFreeTile(scarjaw.x, scarjaw.y, scarjaw.z, 2), z: scarjaw.z });
  ctx.killMonster(scarjaw);
  const corpse = state.piles.find(pl => pl.x === scarjaw.x && pl.y === scarjaw.y && pl.z === scarjaw.z);
  assert(corpse && corpse.items.some(it => it.id === 'scarjaw_hide'), 'its hide in the corpse');
  assert.strictEqual(p.bestiary.wolf, 1, 'one wolf in the bestiary');
  assert.strictEqual(p.quests.task_west.kills.wolf, 1, 'a wolf for the hunt');
  // Armourer Brenna makes a rare leather armor of the hide
  ctx.giveItem('scarjaw_hide');
  const n = state.npcs.find(c => c.npcId === 'oak_armourer');
  ctx.teleport({ ...ctx.findFreeTile(n.x, n.y, n.z, 2), z: n.z }); tick(game, 100);
  A.say('hi'); tick(game, 100); A.say('trophy'); tick(game, 100); A.say('bye'); tick(game, 100);
  assert.strictEqual(state.countItem('scarjaw_hide'), 0, 'the hide is taken');
  const made = state.bagItems().find(it => it.id === 'leather_armor');
  assert(made && made.q === 2, 'for a rare leather armor');
  assert(/trophy/.test(ctx.itemInfo('scarjaw_hide')), 'a trophy says what it becomes');
});

test('the bestiary: kills of each kind count, and at 25, 100 and 250 you hit that kind harder for good', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player;
  for (let k = 0; k < 24; k++) ctx.bestiaryKill('rat');
  assert.strictEqual(state.bestiaryTier('rat'), 0, 'no star before 25');
  assert.strictEqual(state.withBestiary(10, 'rat'), 10, 'no bonus yet');
  ctx.bestiaryKill('rat');
  assert.strictEqual(state.bestiaryTier('rat'), 1, 'a star at 25');
  assert(messages.some(t => /Bestiary: 25 rats/.test(t)), 'told so');
  p.bestiary.rat = 250;
  assert.strictEqual(state.bestiaryTier('rat'), 3, 'three stars at 250');
  let sum = 0;
  for (let k = 0; k < 400; k++) sum += state.withBestiary(10, 'rat');
  assert(Math.abs(sum / 400 - 11) < 0.15, `about 10% more on average (${sum / 400})`);
  assert.strictEqual(state.withBestiary(10, 'wolf'), 10, 'only against that kind');
  // in a fight: a rat with no armor takes the bonus
  const rat = ctx.spawnMonster({ type: 'rat', x: p.x + 1, y: p.y, z: p.z });
  rat.def = { ...rat.def, armor: 0 };
  state.monsters.push(rat);
  ctx.damageMonster(rat, 10, 'fire');
  assert(rat.maxHp - rat.hp >= 11, `a 10 hits for 11 (${rat.maxHp - rat.hp})`);
  // kept in the save; anything unknown in it dropped
  const data = ctx.serializePlayer(p);
  data.bestiary.nonsense = 5;
  state.player = ctx.newPlayer('Again');
  ctx.applySave(data);
  assert.strictEqual(JSON.stringify(state.player.bestiary), JSON.stringify({ rat: 250 }), 'saved and loaded');
});

test('cosmetics: Captain Osric sells a feather and cloaks for watch marks, worn over any outfit, kept and only if owned', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  const talk = (id, ...words) => { const n = state.npcs.find(c => c.npcId === id); ctx.teleport({ ...ctx.findFreeTile(n.x, n.y, n.z, 2), z: n.z }); tick(game, 100); A.say('hi'); tick(game, 100); const at = messages.length; for (const w of words) { A.say(w); tick(game, 100); } A.say('bye'); tick(game, 200); return messages.slice(at).join(' | '); };
  A.setOutfit({ cloak: 'ember_cloak' });
  assert(!p.outfit.cloak, 'not before you own it');
  ctx.giveItem('watch_mark', 7);
  assert(/feather|cloak/.test(talk('gate_north', 'marks')), 'Osric lists them');
  talk('gate_north', 'ember');
  assert.strictEqual(state.countItem('watch_mark'), 2, 'five marks spent');
  assert(p.cosmetics.includes('ember_cloak') && p.outfit.cloak === 'ember_cloak', 'owned, and worn at once');
  assert(/already/.test(talk('gate_north', 'ember')) && state.countItem('watch_mark') === 2, 'not sold twice');
  assert(/costs 5/.test(talk('gate_north', 'gull')), 'not without the marks');
  A.setOutfit({ body: '#123456' });
  assert(!p.outfit.cloak, 'taken off');
  A.setOutfit({ body: '#123456', cloak: 'ember_cloak', feather: 'ember_cloak' });
  assert(p.outfit.cloak === 'ember_cloak' && !p.outfit.feather, 'put on again; a cloak is no feather');
  const data = ctx.serializePlayer(p);
  state.player = ctx.newPlayer('Again');
  ctx.applySave(data);
  assert(state.player.cosmetics.includes('ember_cloak') && state.player.outfit.cloak === 'ember_cloak', 'kept in the save');
});

test('training: hit a dummy as long as you like and your weapon skill grows; walking away stops it', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player;
  ctx.teleport({ x: 144, y: 140, z: 8 });
  assert(state.map.get(144, 141, 8).items.includes('dummy'), 'a dummy in the training yard');
  const club = p.skills.club.level;
  ctx.useThing(144, 141, 8);
  for (let i = 0; i < 400; i++) tick(game, 1000);
  assert(p.training, 'still training after many minutes');
  assert(p.trainHits >= 390, `about one hit a second (${p.trainHits})`);
  assert(p.skills.club.level > club, `club fighting went up (${club} -> ${p.skills.club.level})`);
  state.Actions.walkTo(144, 137); tick(game, 1500);
  const hits = p.trainHits; tick(game, 3000);
  assert(!p.training && p.trainHits === hits, 'walking away stops it');
});

test('the map shows roughly where each quest you\'re on is done: Osric, the north wall, the kegs, the dummy, the rats under Ned\'s barn, the nests, the bell, and the one to tell once it\'s done; never a hidden quest', () => {
  const { ctx, state } = quietGame(), vm = require('vm'), run = code => vm.runInContext(code, ctx), p = state.player;
  const area = id => run(`questArea('${id}')`), near = (a, x, y, z, d) => a && a.z === z && Math.hypot(a.x - x, a.y - y) <= d;
  const at = id => state.map.npcs.find(n => n.type === id);
  for (const id of ['last_town', 'recruit', 'gate_west', 'gate_south', 'gate_east', 'gate_north', 'bell_6']) ctx.startQuest(id);
  const osric = at('gate_north'), corwin = at('corwin'), ned = at('oak_farmer');
  assert(near(area('last_town'), osric.x, osric.y, 8, 4), 'The Last Town begins at Osric');
  p.quests.last_town.step = 1; const wall = area('last_town');
  assert(wall.z === 9 && wall.y <= 96 && wall.r >= 15, `then the cannons along the north wall (${JSON.stringify(wall)})`);
  p.quests.last_town.step = 2; assert(near(area('last_town'), 131, 94, 9, 1), 'then the powder kegs, by the steps');
  assert(near(area('recruit'), 145, 138, 8, 1), 'The Recruit: the training yard');
  p.quests.recruit.hits = 10; assert(near(area('recruit'), corwin.x, corwin.y, 8, 4), 'ten hits: back to Corwin');
  p.quests.recruit.step = 2;
  assert(near(area('recruit'), ned.x, ned.y, 7, 6), `Ned's rats: in the sewers under his barn (${JSON.stringify(area('recruit'))})`);
  p.quests.recruit.kills = { rat: 5 }; assert(near(area('recruit'), ned.x, ned.y, 8, 4), 'five dead: back to Ned');
  const nests = area('gate_east'), [nx, ny] = run('GATE_SITES.nests')[0];
  assert(nests.z === 8 && Math.hypot(nests.x - nx, nests.y - ny) <= nests.r, 'the nests lie in the circle');
  assert(near(area('gate_south'), 101, 220, 8, 1), 'the stranded fisher');
  assert(near(area('gate_north'), 198, 70, 8, 1), 'Gnash\'s war chest');
  const bell = area('bell_6'); assert(bell && run(`map.get(${bell.x}, ${bell.y}, ${bell.z}).items.some(i => i.startsWith('bell_'))`), 'the farewell: the bell itself');
  p.quests.old_wim = { status: 'active', step: 0, kills: {} };
  assert.strictEqual(area('old_wim'), null, 'a hidden quest is found, not shown');
  const all = run('questAreas()');
  assert(all.every(a => a.key && Number.isInteger(a.x) && a.r > 0), 'every circle has a place, a size and a key');
});

test('the crypt\'s iron gate to the founder\'s tomb (the Gravewaker) opens at level 7; Mirror Lake\'s shrine gives blessed water once, to anyone', () => {
  const game = quietGame(), { ctx, state } = game, p = state.player;
  assert(!ctx.doorOpenable('crypt_gate', 69, 181, 7), 'shut below level 7');
  ctx.gainXp(state.xpForLevel(7)); assert(ctx.doorOpenable('crypt_gate', 69, 181, 7), 'open at level 7');
  assert(state.map.spawns.some(s => s.type === 'gravewaker'), 'the Gravewaker keeps the tomb');
  assert(!state.map.spawns.some(s => /choir/.test(s.type)) && !Object.keys(state.MONSTERS).some(t => /choir|_echo$/.test(t)), 'no Choir, no echoes');
  ctx.teleport({ x: 127, y: 59, z: 8 }); ctx.useThing(127, 58, 8); tick(game, 100);
  assert.strictEqual(state.countItem('blessed_water'), 3, 'the shrine\'s water'); ctx.useThing(127, 58, 8);
  assert.strictEqual(state.countItem('blessed_water'), 3, 'once');
  assert.strictEqual(p.quests.bell_4, undefined);
});

test('the whole road from level 1 to 10: the guide\'s arrow, the marks over heads and the words always point the right way (the last town, walking, talking, the tower stairs, the cannons, Clang, skills at the dummy, gear, a grate and a torch, a fight, healing, the loot, dying, trading, the locker, the gate watch, the farewell)', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, A = state.Actions;
  const vm = require('vm'), run = code => vm.runInContext(code, ctx);
  p.tutorial = 1;
  p.equipment.backpack = { id: 'backpack', count: 1, contents: [] };
  const npc = id => state.npcs.find(n => n.npcId === id);
  const talk = (id, ...words) => { const n = npc(id); ctx.teleport({ ...ctx.findFreeTile(n.x, n.y, n.z, 2), z: n.z }); A.say('hi'); tick(game, 100); for (const w of words) { A.say(w); tick(game, 100); } A.say('bye'); tick(game, 200); };
  const kill = (type, n) => { for (let i = 0; i < n; i++) { ctx.onMonsterKilled(type); run('guideDid("kill")'); } tick(game, 200); };
  const levelTo = l => ctx.gainXp(run(`xpForLevel(${l})`) - p.xp);
  const arrow = () => { tick(game, 200); const t = run('GUIDE[player.tutorial - 1] && guideTarget(GUIDE[player.tutorial - 1])'); return t ? t.npcId || `${t.x},${t.y},${t.z}` : null; };
  const mark = id => (ctx.questNews(id) || {}).mark;
  const on = (id, where) => { ctx.teleport(where); tick(game, 100); };
  const [gx, gy] = state.OAKVALE.grates[2], grate = z => `${gx},${gy},${z}`; // (the grate outside Ned's barn, and the ladder under it)
  on(null, { ...state.map.start });
  // a step that only explains waits for Next (and Next does nothing on a step with something to do)
  const next = what => { const at = p.tutorial; A.guideNext(); assert.strictEqual(p.tutorial, at + 1, `Next past ${what}`); };
  const use = (x, y, z) => { const t = ctx.findFreeTile(x, y + 1, z, 2); ctx.teleport({ x: t.x, y: t.y, z }); ctx.useThing(x, y, z); tick(game, 100); };
  assert.strictEqual(arrow(), null, 'the world points at nothing'); next('the last town');
  const st = state.map.start;
  assert.strictEqual(arrow(), `${st.x},${st.y + 3},${st.z}`, 'walking: to the temple\'s door'); assert.strictEqual(mark('ama'), 'offer');
  A.guideNext(); assert.strictEqual(p.tutorial, 2, 'Next doesn\'t skip a step with something to do');
  A.endGuide();
  assert.strictEqual(p.tutorial, 2, 'the guide can\'t be put away before its end (only folded)');
  assert.strictEqual(mark('gate_south'), undefined, 'the later gates wait for the first');
  on(null, { x: st.x, y: st.y + 3, z: st.z });
  assert(run(`map.get(${arrow()}).items.includes('signpost')`), 'looking: at the signpost below the temple steps');
  A.guideNext(); // (the browser sees the look: game.js lookHere)
  assert.strictEqual(arrow(), 'ama', 'then back to Sister Ama, to talk');
  talk('ama'); talk('ama', 'fight', 'yes');
  // The Last Town: turned away by Osric, then the Host at the wall
  assert.strictEqual(arrow(), 'gate_north', 'to Captain Osric at the north gate'); assert.strictEqual(mark('gate_north'), 'report');
  talk('gate_north'); tick(game, 100);
  assert.strictEqual(arrow(), 'gate_north', 'greeting him is not enough: ask to fight');
  talk('gate_north', 'fight');
  assert.strictEqual(arrow(), '130,96,8', 'stairs: the steps up the wall beside the gate');
  on(null, { x: 106, y: 95, z: 9 });
  assert.strictEqual(arrow(), '105,94,9', 'on the wall: to the nearest cannon');
  for (const c of [[132, 94, 9], [138, 94, 9], [116, 94, 9], [105, 94, 9]]) use(...c);
  assert.strictEqual(arrow(), '131,94,9', 'four loaded: to the powder kegs by the steps, where something mews');
  use(131, 94, 9); assert(p.pet && p.pet.name === 'Clang', 'Clang is your companion');
  assert.strictEqual(arrow(), '132,94,9', 'then the nearest loaded cannon, to fire');
  use(132, 94, 9); assert(p.quests.last_town.firedAt > 0, 'fired');
  on(null, { x: 106, y: 95, z: 9 });
  assert.strictEqual(arrow(), '130,96,9', 'down the steps again');
  on(null, { x: 120, y: 100, z: 8 });
  assert.strictEqual(arrow(), 'gate_north', 'to Osric'); talk('gate_north', 'fight'); assert.strictEqual(state.questState('last_town'), 'done');
  // The Recruit: skills at the dummy, the cap, Ned's rats down a grate (a torch, a fight, healing, the loot, dying)
  assert.strictEqual(arrow(), 'corwin', 'to Master Corwin'); assert.strictEqual(mark('corwin'), 'offer');
  talk('corwin', 'fighter', 'yes');
  assert(run(`GUIDE[player.tutorial - 1] && map.get(...(t => [t.x, t.y, t.z])(guideTarget(GUIDE[player.tutorial - 1]))).items.includes('dummy')`), 'to a training dummy');
  p.quests.recruit.hits = 10; tick(game, 300);
  assert.strictEqual(arrow(), 'corwin', 'ten hits: back to Corwin'); talk('corwin', 'fighter');
  const worn = () => ['wooden_shield', 'leather_cap'].map(id => p.equipment.backpack.contents.findIndex(i => i.id === id));
  assert(worn()[1] >= 0 && worn()[0] < 0, 'Master Corwin gives a leather cap (the shield is to be earned)');
  const step = p.tutorial;
  A.useItem({ root: 'bag', path: [worn()[1]] }); tick(game, 100);
  assert(p.equipment.head && p.tutorial === step + 1, 'worn: on to the next step');
  assert.strictEqual(arrow(), 'oak_farmer', 'to Farmer Ned at the hay barn'); assert.strictEqual(mark('oak_farmer'), 'report');
  talk('oak_farmer', 'rats'); assert.strictEqual(state.countItem('farm_torch'), 1, 'his torch to take along');
  assert.strictEqual(arrow(), grate(8), 'to the grate outside Ned\'s barn');
  on(null, { x: gx, y: gy, z: 7 });
  A.useItem({ root: 'bag', path: [p.equipment.backpack.contents.findIndex(i => i.id === 'farm_torch')] }); tick(game, 100);
  assert(p.lightUntil > state.now, 'the torch lit');
  assert(arrow(), 'a fight: to the rats');
  kill('rat', 1);
  p.fedUntil = state.now + 99999; tick(game, 100); // (healing: eaten)
  next('putting Eat on an action button (the browser sees it)');
  p.openPile = { corpse: 'blood' }; tick(game, 100); p.openPile = null; // (the loot)
  kill('rat', 4); assert.strictEqual(arrow(), grate(7), 'back up the ladder');
  on(null, { x: 128, y: 120, z: 8 });
  assert.strictEqual(arrow(), 'oak_farmer', 'back to Ned'); talk('oak_farmer', 'rats');
  next('what dying costs (told in town, not in a fight)');
  // trading with Pip, the locker with Hobb, back to Corwin
  assert.strictEqual(arrow(), 'pip', 'to Pip, to trade'); talk('pip', 'supplies');
  assert.strictEqual(arrow(), 'pip', 'asking is not enough: buy and sell');
  p.chests.guide_bought = p.chests.guide_sold = true; tick(game, 100); talk('pip', 'supplies');
  assert(run(`map.get(${arrow()}).items.includes('depot')`), 'then a locker at the depot');
  talk('postmaster', 'locker'); assert(run(`map.get(${arrow()}).items.includes('depot')`), 'asking Hobb is not enough: something in the locker');
  p.depot.contents.push({ id: 'apple', count: 1 }); tick(game, 100);
  assert.strictEqual(arrow(), 'postmaster', 'then tell Hobb'); talk('postmaster', 'locker');
  assert.strictEqual(arrow(), 'corwin'); talk('corwin', 'fighter'); assert.strictEqual(state.questState('recruit'), 'done');
  assert(worn()[0] >= 0, 'the shield, earned');
  A.useItem({ root: 'bag', path: [worn()[0]] }); tick(game, 100); assert(p.equipment.shield, 'and worn');
  // the end of the basics: from here on no arrow, but a circle on the map for each quest you're on
  assert(run('guideArrowOn()'), 'the arrow leads through the basics');
  next('the end of the basics: the map from here on');
  assert(!run('guideArrowOn()'), 'after the basics the guide shows no arrow');
  assert.strictEqual(p.tutorial, run('GUIDE.findIndex(s => (s.target || []).some(t => t.news && t.news.includes("gate_west")))') + 1, 'from here on the story leads: the gate watch');
  levelTo(2); tick(game, 100);
  A.say('lumen'); tick(game, 300); assert(p.lightUntil > state.now, 'level 2: Torchlight');
  assert.strictEqual(arrow(), 'gate_west', 'on to the gate watch');
  for (const [id, word, type, n, level, next] of [['gate_west', 'wolves', 'wolf', 8, 2, 'gate_south'], ['gate_south', 'crabs', 'crab', 6, 3, 'gate_east'],
    ['gate_east', 'spiders', 'spider', 8, 4, 'gate_north'], ['gate_north', 'goblins', 'goblin', 8, 5, null]]) {
    levelTo(level);
    assert.strictEqual(mark(id), 'offer', `${id} has a task`);
    talk(id, word, 'yes');
    if (id === 'gate_west') { // the pack, then the arrow to where his paw prints start; from there you follow them yourself
      kill('wolf', 4); assert.strictEqual(arrow(), '69,98,8', 'to the paw prints by the lumber trail');
      on(null, { x: 69, y: 96, z: 8 }); assert.strictEqual(arrow(), null, 'then you follow the prints');
      kill('greyfang', 1);
    } else if (id === 'gate_south') {
      assert.strictEqual(arrow(), '101,220,8', 'to Wendel\'s rock'); assert.strictEqual(mark('oak_stranded'), 'report');
      talk('oak_stranded', 'help');
    } else if (id === 'gate_east') {
      for (const [x, y] of run('GATE_SITES.nests')) { assert.strictEqual(arrow(), `${x},${y},8`, 'to the nearest nest'); on(null, { x, y: y + 1, z: 8 }); ctx.burnThing(x, y, 8); }
    } else {
      assert.strictEqual(arrow(), '198,70,8', 'to Gnash\'s war chest'); ctx.useThing(198, 70, 8);
    }
    assert.strictEqual(mark(id), 'report'); assert.strictEqual(arrow(), id, `the arrow goes back to ${id}`);
    talk(id, word);
    if (next) assert.strictEqual(arrow(), next, `and on to ${next}`);
  }
  // III: the farewell
  levelTo(10); assert.strictEqual(arrow(), 'ama', 'Sister Ama wants to say goodbye'); assert.strictEqual(mark('ama'), 'offer');
  talk('ama', 'farewell', 'yes'); on(null, { x: 145, y: 103, z: 13 });
  assert.strictEqual(arrow(), '145,102,13', 'to the bell'); state.now += 60000; ctx.ringBell();
  for (const id of ['corwin', 'pip', 'gate_north']) { assert.strictEqual(arrow(), id, `farewell to ${id}`); talk(id, 'farewell'); }
  assert.strictEqual(arrow(), 'ama'); talk('ama', 'farewell'); assert.strictEqual(state.questState('bell_6'), 'done');
  assert.strictEqual(arrow(), 'oak_oracle', 'and at level 10, to the oracle');
  A.endGuide();
  assert.strictEqual(p.tutorial, 0, 'at its last step, "Got it" puts it away');
  // started again from the menu: the explaining steps wait for Next, the ones already done pass by themselves
  // skipped: it goes (the story's gear comes from its quests all the same)
  { const g2 = quietGame(); const p2 = g2.state.player; p2.tutorial = 1;
    g2.state.Actions.skipGuide();
    assert.strictEqual(p2.tutorial, 0, 'Skip puts the guide away'); }
  A.restartGuide(); assert.strictEqual(p.tutorial, 1, 'the guide from the start');
  A.guideNext(); A.guideNext(); tick(game, 300);
  assert(p.tutorial > 4, `meeting Ama and the first quest pass by themselves (now on step ${p.tutorial})`);
});

test('the war spear and its circle throw: held in both hands it strikes the tile next to you, like a sword; the sweep round you hits each monster as the blade gets there, one after the other', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  ctx.teleport({ x: 128, y: 172, z: 8 });
  Object.assign(p, { vocation: 'knight', home: 'main', level: 20, mana: 500, maxMana: 500 });
  p.skills.axe.level = 40;
  A.say('hasta orbis'); tick(game, 100);
  assert(messages.some(m => /war spear in your hands/.test(m)), 'not without a war spear');
  p.equipment.weapon = { id: 'war_spear', count: 1 };
  const w = ctx.playerWeapon();
  assert(w.kind === 'melee' && w.reach === 1 && w.skill === 'axe' && state.ITEMS.war_spear.weapon.twoHanded, 'held, two-handed, striking the tile next to you');
  const at = (dx, dy) => { const m = ctx.spawnMonster({ type: 'bear', x: p.x + dx, y: p.y + dy, z: 8 }); m.hp = m.maxHp = 9999; state.monsters.push(m); return m; };
  const hurt = m => m.hp < 9999;
  p.dir = 2; // (facing south: the swing runs from your right, the west, round the south, to the east)
  const east = at(2, 0), south = at(0, 2), west = at(-2, 0), north = at(0, -2);
  state.now += 3000; A.say('hasta orbis');
  assert(state.effects.some(fx => fx.kind === 'arc'), 'everyone near sees the swing');
  tick(game, 60);
  assert(hurt(west) && !hurt(south) && !hurt(east), 'first the one where the swing starts');
  tick(game, 180);
  assert(hurt(south) && !hurt(east), 'then the one in front of you');
  tick(game, 300);
  assert(hurt(east), 'then the one where it ends');
  assert(!hurt(north), 'nothing behind you');
});

test('every plain shot from a bow, and blow of a war spear, shows the hero loosing or swinging it (a crossbow does not)', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, A = state.Actions;
  ctx.teleport({ x: 128, y: 172, z: 8 });
  Object.assign(p, { vocation: 'paladin', home: 'main', level: 20 });
  p.equipment.weapon = { id: 'bow', count: 1 }; p.equipment.ammo = { id: 'arrow', count: 10 };
  const m = ctx.spawnMonster({ type: 'bear', x: p.x + 3, y: p.y, z: 8 }); m.hp = m.maxHp = 9999; state.monsters.push(m);
  let seen = 0;
  const watch = ms => { for (let t = 0; t < ms; t += 50) { tick(game, 50); seen += state.effects.filter(fx => fx.kind === 'loose' && fx.cid === p.id).length; } };
  A.setTarget(m.id); watch(2500);
  assert(seen > 0, 'the bow is drawn and loosed');
  assert(p.equipment.ammo.count < 10, 'arrows were shot');
  state.effects.length = 0;
  p.equipment.weapon = { id: 'crossbow', count: 1 }; p.equipment.ammo = { id: 'bolt', count: 10 };
  seen = 0; watch(2500);
  assert(p.equipment.ammo.count < 10 && !seen, 'a crossbow has no such picture');
  seen = 0; p.equipment.ammo = null; p.equipment.shield = null; p.equipment.weapon = { id: 'war_spear', count: 1 };
  ctx.teleport({ x: m.x - 1, y: m.y, z: 8 }); A.setTarget(m.id);
  const watchSpear = ms => { for (let t = 0; t < ms; t += 50) { tick(game, 50); seen += state.effects.filter(fx => fx.kind === 'loose' && fx.weapon === 'spear').length; } };
  watchSpear(2500);
  assert(seen > 0, 'the war spear is swung');
});

test('Kestrel Isle (the new world, a preview): the isle and Bellhaven build, you wake in the temple, every door can be walked to', () => {
  const game = quietGame();
  const { ctx } = game;
  const m = ctx.createKestrelMap(), K = game.state.KESTREL, [OX, OY] = K.isleAt, [TX, TY] = K.townAt;
  const W = (x, y) => [OX + TX + x, OY + TY + y]; // (town-art coordinates in the world)
  assert(m.isWalkable(m.start.x, m.start.y, m.start.z), 'you wake on open floor');
  assert(m.temples.some(t => t.home === 'bellhaven'), 'the temple is home');
  assert(m.spawns.length > 40, 'game out in the wilds');
  // no rock top hangs in the air: each stands on a cliff a floor down
  for (let z = 9; z <= 11; z++) for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
    const t = m.get(x, y, z), under = m.get(x, y, z - 1);
    if (t && ['rock_top', 'mountain'].includes(t.ground)) assert(under && under.items.includes('cliff'), `a rock top in the air at ${x},${y},${z}`);
  }
  // from the temple you can walk to every door, and out of the west, east and north gates (the steps down the temple
  // rock join the floors: a step onto them climbs, a step onto their top goes down)
  const seen = new Set([`${m.start.x},${m.start.y},${m.start.z}`]), todo = [[m.start.x, m.start.y, m.start.z]];
  while (todo.length) {
    const [x, y, z] = todo.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; let nz = z;
      const t = m.get(nx, ny, nz);
      if (!t) continue;
      if (t.items.includes('steps')) nz++;
      else if (t.ground === 'steps_top') nz--;
      else if (!(m.isWalkable(nx, ny, nz) || t.items.some(id => id.startsWith('door')))) continue;
      const k = `${nx},${ny},${nz}`;
      if (!seen.has(k)) { seen.add(k); todo.push([nx, ny, nz]); }
    }
  }
  for (const b of K.buildings) {
    const [x, y] = W(...b.door), z = m.surfaceZ + (b.rock === true ? 1 : b.rock || 0);
    assert(seen.has(`${x},${y},${z}`), `${b.name}: you can walk to its door from the temple`);
    for (const [k, [sx, sy]] of (b.up || []).entries()) {
      const [ux, uy] = W(sx, sy);
      assert(m.isWalkable(ux, uy, z + k + 1) && m.isWalkable(ux + 1, uy, z + k), `${b.name}: its stairs land on open floor`);
    }
  }
  for (const [x, y] of K.gates) assert(seen.has(`${W(x, y)[0]},${W(x, y)[1]},${m.surfaceZ}`), `out of the gate at ${x},${y}`);
  // the sewers: a grate in the street over a ladder at every way down; from the ladder under the square you can walk to
  // every other ladder, to the rats and to Clang's crate in the bell cellar
  const SZ = m.surfaceZ - 1, Q = K.sewers;
  for (const [x, y] of Q.grates) {
    assert(m.get(...W(x, y), m.surfaceZ).items.includes('grate') && seen.has(`${W(x, y)[0]},${W(x, y)[1]},${m.surfaceZ}`), `a grate you can reach at ${x},${y}`);
    assert(m.get(...W(x, y), SZ).items.includes('sewer_ladder'), `a ladder under it`);
  }
  const below = new Set(), todo2 = [W(...Q.grates[0])];
  while (todo2.length) {
    const [x, y] = todo2.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${y + dy}`, t = m.get(x + dx, y + dy, SZ);
      if (below.has(k) || !t || !(m.isWalkable(x + dx, y + dy, SZ) || t.items.includes('sewer_ladder'))) continue;
      below.add(k); todo2.push([x + dx, y + dy]);
    }
  }
  for (const [x, y] of Q.grates) assert(below.has(W(x, y).join()), `the ladder at ${x},${y} is joined to the rest`);
  const crate = Q.props.find(p => p[2] === 'clang_crate');
  assert([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => below.has(W(crate[0] + dx, crate[1] + dy).join())), 'Clang\'s crate can be reached');
  const inCellar = r => K.buildings.some(b => b.cellar && b.boxes.some(([x0, y0, x1, y1]) => { const [a, c] = W(x0, y0), [e, f] = W(x1, y1); return r.x >= a && r.x <= e && r.y >= c && r.y <= f; }));
  const rats = m.spawns.filter(sp => sp.z === SZ && sp.type === 'rat' && !inCellar(sp));
  assert(rats.length >= 14 && rats.every(r => below.has(`${r.x},${r.y}`)), `rats all through the sewers (${rats.length})`);
  // a building's cellar: down its stairs, and up again
  for (const b of K.buildings.filter(o => o.cellar)) {
    const [sx, sy] = W(...b.cellar.stairs);
    assert(m.get(sx + 1, sy, m.surfaceZ).items.includes('stairs_down') && m.get(sx, sy, SZ).items.includes('stairs_up'), `${b.name}: stairs to its cellar`);
    assert(m.isWalkable(sx + 1, sy, SZ) && m.isWalkable(sx, sy, m.surfaceZ), `${b.name}: open floor at both ends of its stairs`);
  }
  assert(m.npcs.some(n => n.type === 'ama' && m.isWalkable(n.x, n.y, n.z)), 'Sister Ama in the temple');
  for (const n of m.npcs) assert(m.isWalkable(n.x, n.y, n.z), `${n.type} stands on open ground at ${n.x},${n.y},${n.z}`);
  // every door opens onto a street: from the tile before it, along streets alone (cobbles, paving, steps), to the
  // courtyard - no wading through grass, no squeezing round things
  const street = (x, y, z) => { const t = m.get(x, y, z); return !!t && (['cobble', 'paving', 'marble', 'steps_top'].includes(t.ground) || t.items.includes('steps')) && (m.isWalkable(x, y, z) || t.items.includes('steps') || t.ground === 'steps_top'); };
  const [qx, qy] = W(K.square[0], K.square[1] + 2), onRoads = new Set([`${qx},${qy},${m.surfaceZ}`]), todo3 = [[qx, qy, m.surfaceZ]];
  while (todo3.length) {
    const [x, y, z] = todo3.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let nz = z; const nx = x + dx, ny = y + dy, t = m.get(nx, ny, z);
      if (!t || !street(nx, ny, z)) continue;
      if (t.items.includes('steps')) nz++; else if (t.ground === 'steps_top') nz--;
      const k = `${nx},${ny},${nz}`; if (!onRoads.has(k)) { onRoads.add(k); todo3.push([nx, ny, nz]); }
    }
  }
  const bad = [];
  for (const b of K.buildings.filter(o => o.kind !== 'farmhouse')) { // (in town: the farmhouse out in the wilds has its track)
    const z = m.surfaceZ + (b.rock === true ? 1 : b.rock || 0), inB = (x, y) => b.boxes.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
    const [dx, dy] = [[0, 1], [1, 0], [-1, 0], [0, -1]].find(([a2, c]) => !inB(b.door[0] + a2, b.door[1] + c));
    const [fx, fy] = W(b.door[0] + dx, b.door[1] + dy);
    if (!onRoads.has(`${fx},${fy},${z}`)) bad.push(`${b.name} (${b.door})`);
  }
  assert(!bad.length, `a street from each door to the courtyard: not from ${bad.join(', ')}`);
  for (const [x, y] of K.gates) assert([...onRoads].some(k => k === `${W(x, y)[0]},${W(x, y)[1]},${m.surfaceZ}`), `a street out to the gate at ${x},${y}`);
  // every building stands free: at least a tile of open ground between it and the next
  const gap = (a, b) => Math.min(...a.boxes.flatMap(p => b.boxes.map(q => Math.max(q[0] - p[2], p[0] - q[2], q[1] - p[3], p[1] - q[3]))));
  K.buildings.forEach((a, i) => K.buildings.slice(i + 1).forEach(b => assert(gap(a, b) >= 2, `${a.name} and ${b.name} stand apart`)));
  for (const b of K.buildings.filter(o => o.kind !== 'gatehouse')) { // (and that tile is open ground: no rock, no wall, nothing missing)
    const z = m.surfaceZ + (b.rock === true ? 1 : b.rock || 0), inB = (x, y) => b.boxes.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
    for (const [x0, y0, x1, y1] of b.boxes) for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) {
      if (inB(x, y)) continue;
      const t = m.get(...W(x, y), z);
      assert(t && !t.items.some(id => id === 'cliff' || /^wall_/.test(id)), `${b.name}: open ground round it at ${x},${y}`);
    }
  }
});

test('Kestrel Isle: how far things are from the courtyard, walking at level 1 (shops under 30 s, the gates 20-45 s, the first monsters 30-60 s)', () => {
  const game = loadGame({ world: 'kestrel' });
  const { ctx, state } = game;
  const m = state.map, K = state.KESTREL, S = m.surfaceZ, [OX, OY] = K.isleAt, [TX, TY] = K.townAt;
  const W = (ax, ay) => [OX + TX + ax, OY + TY + ay];
  // the quickest way on foot from the courtyard to everywhere on the surface, step by step as the game times them
  const step = {}; const time = (g, d) => (step[g + d] ??= vm.runInContext(`stepTime(player, ${JSON.stringify(g)}, ${d})`, ctx));
  const [sx, sy] = W(K.square[0], K.square[1] + 2), best = new Map([[`${sx},${sy}`, 0]]), heap = [[0, sx, sy]];
  while (heap.length) {
    let i = 0; for (let k = 1; k < heap.length; k++) if (heap[k][0] < heap[i][0]) i = k;
    const [d, x, y] = heap.splice(i, 1)[0];
    if (d > best.get(`${x},${y}`)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy, t = m.get(nx, ny, S);
      if (!t || !(m.isWalkable(nx, ny, S) || t.items.some(id => id.startsWith('door')))) continue;
      const nd = d + time(t.ground, !!(dx && dy)), k = `${nx},${ny}`;
      if (nd < (best.get(k) ?? Infinity)) { best.set(k, nd); heap.push([nd, nx, ny]); }
    }
  }
  const secs = (x, y) => (best.get(`${x},${y}`) ?? Infinity) / 1000;
  for (const b of K.buildings.filter(o => !o.rock && o.kind !== 'gatehouse' && o.kind !== 'farmhouse')) assert(secs(...W(...b.door)) <= 30, `${b.name}: ${secs(...W(...b.door))} s`);
  for (const g of K.gates.slice(0, 2)) { const t = secs(...W(...g)); assert(t >= 20 && t <= 45, `the gate at ${g}: ${t} s`); }
  const first = Math.min(...m.spawns.filter(sp => sp.z === S).map(sp => secs(sp.x, sp.y)));
  assert(first >= 30 && first <= 60, `the first monsters out in the open: ${first} s`);
});

test('Kestrel Isle: from the temple, every door, upper floor, cellar, grate and way out of Bellhaven can be walked to', () => {
  const game = loadGame({ world: 'kestrel' });
  const { ctx, state } = game;
  const m = state.map, K = state.KESTREL, T = state.THINGS, [OX, OY] = K.isleAt, [TX, TY] = K.townAt, W = (x, y) => [OX + TX + x, OY + TY + y];
  const near = (x, y) => x >= OX + TX - 55 && x <= OX + TX + 70 && y >= OY + TY - 30 && y <= OY + TY + 45;
  const key = (x, y, z) => `${x},${y},${z}`, seen = new Set([key(m.start.x, m.start.y, m.start.z)]), visited = new Set(seen), todo = [[m.start.x, m.start.y, m.start.z]];
  const change = t => t.items.map(i => T[i].change).find(Boolean) || (T[t.ground] && T[t.ground].change) || 0;
  while (todo.length) { // (as the game walks: through doors, and a floor change takes you a floor up or down, to the nearest free tile)
    const [x, y, z] = todo.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, t = near(nx, ny) && m.get(nx, ny, z), c = t && change(t);
      if (!t || !(m.isWalkable(nx, ny, z) || c || t.items.some(i => i.startsWith('door')))) continue;
      const to = c ? { ...(ctx.findFreeTile(nx, ny, z + c, 1) || { x: nx, y: ny }), z: z + c } : { x: nx, y: ny, z };
      seen.add(key(nx, ny, z));
      if (c ? !seen.has(key(to.x, to.y, to.z)) : !visited.has(key(nx, ny, z))) { seen.add(key(to.x, to.y, to.z)); visited.add(key(to.x, to.y, to.z)); todo.push([to.x, to.y, to.z]); }
    }
  }
  const missing = [];
  for (const b of K.buildings) {
    const z = m.surfaceZ + (b.rock === true ? 1 : b.rock || 0);
    if (!seen.has(key(...W(...b.door), z))) missing.push(`${b.name}'s door`);
    (b.up || []).forEach(([x, y], k) => { const [ux, uy] = W(x, y); if (!seen.has(key(ux, uy, z + k + 1)) && !seen.has(key(ux + 1, uy, z + k + 1))) missing.push(`${b.name}, floor ${k + 2}`); });
    if (b.cellar) { const [sx, sy] = W(...b.cellar.stairs); if (!seen.has(key(sx, sy, z - 1)) && !seen.has(key(sx + 1, sy, z - 1))) missing.push(`${b.name}'s cellar`); }
  }
  for (const [x, y] of K.gates) if (!seen.has(key(...W(x, y), m.surfaceZ))) missing.push(`the way out at ${x},${y}`);
  for (const [x, y] of K.sewers.grates) if (!seen.has(key(...W(x, y), m.surfaceZ - 1))) missing.push(`the sewers under the grate at ${x},${y}`);
  assert(!missing.length, `can't be walked to: ${missing.join(', ')}`);
});

test('Kestrel Isle: every shop has its keeper inside, reachable to talk to; Old Farrow gives his rat quest', () => {
  const game = loadGame({ world: 'kestrel' });
  const { ctx, state } = game, p = state.player, K = state.KESTREL, [OX, OY] = K.isleAt, [TX, TY] = K.townAt;
  for (const b of K.buildings.filter(o => o.keeper)) {
    const n = state.npcs.find(o => o.npcId === b.keeper);
    assert(n, `${b.name}: ${b.keeper} is there`);
    const [ax, ay] = [n.x - OX - TX, n.y - OY - TY];
    assert(b.boxes.some(([x0, y0, x1, y1]) => ax > x0 && ax < x1 && ay > y0 && ay < y1), `${b.name}: ${b.keeper} stands inside`);
    assert([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => state.map.isWalkable(n.x + dx, n.y + dy, n.z)), `${b.name}: ${b.keeper} can be walked up to`);
  }
  const f = state.npcs.find(o => o.npcId === 'farrow');
  ctx.teleport({ ...ctx.findFreeTile(f.x, f.y + 1, f.z, 2), z: f.z });
  state.Actions.say('hi'); state.Actions.say('rats'); state.Actions.say('yes'); tick(game, 100);
  assert.strictEqual(p.quests.farrow_rats && p.quests.farrow_rats.status, 'active', 'the quest is taken');
});

test('the guide on Kestrel Isle: Sister Ama, the sewers and Clang, the Hall of Paths, the four trials, choosing', () => {
  const game = loadGame({ world: 'kestrel' });
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions, map = state.map, K = state.KESTREL;
  const W = (ax, ay) => [K.isleAt[0] + K.townAt[0] + ax, K.isleAt[1] + K.townAt[1] + ay];
  const step = () => p.tutorial;
  const text = () => (ctx.GUIDE || vm.runInContext('GUIDE', ctx))[p.tutorial - 1].text;
  const next = () => { A.guideNext(); tick(game, 60); };
  const npc = id => state.npcs.find(n => n.npcId === id);
  const talk = (id, ...words) => { ctx.endConversation(true); const n = npc(id); ctx.teleport({ ...ctx.findFreeTile(n.x, n.y + 1, n.z, 1), z: n.z }); A.say('hi'); for (const w of words) A.say(w); tick(game, 100); };
  assert(/Welcome to Kestrel Isle/.test(text()), text());
  next();
  assert(/Sister Ama/.test(text()));
  talk('ama'); assert(/Bellhaven/.test(messages.join(' ')), 'she speaks of Bellhaven');
  tick(game, 100);
  assert(/Clang/.test(text()), text());
  A.say('clang'); A.say('yes'); tick(game, 100);
  assert.strictEqual(state.questState('clang_rescue'), 'active', 'Clang at level 1');
  next(); // (the quests tab)
  assert(/grate/.test(text()), text());
  const [gx, gy] = W(...K.sewers.grates[0]);
  ctx.endConversation(true); ctx.teleport({ x: gx, y: gy + 1, z: 8 }); ctx.useThing(gx, gy, 8); tick(game, 300);
  assert(p.z < 8, 'down the grate');
  tick(game, 100);
  assert(/rats/.test(text()), text());
  for (let i = 0; i < 3; i++) { const r = state.monsters.find(m => !m.dead && m.type === 'rat' && m.z === 7); ctx.killMonster(r); }
  tick(game, 100);
  if (/corpse/.test(text())) { p.openPile = state.piles.find(x => x.corpse) || { corpse: true }; tick(game, 100); p.openPile = null; }
  assert(/crate/.test(text()), text());
  const crate = K.sewers.props.find(x => x[2] === 'clang_crate'), [cx, cy] = W(crate[0], crate[1]);
  ctx.teleport({ ...ctx.findFreeTile(cx - 1, cy, 7, 1), z: 7 }); ctx.useThing(cx, cy, 7); tick(game, 200);
  assert(p.tutorial, `guide still on: ${p.tutorial} ${state.questState('clang_rescue')} ${JSON.stringify(p.quests.clang_rescue)} ${messages.slice(-3).join(' | ')}`);
  assert(/Eat|stomach/.test(text()), text());
  p.fedUntil = state.now + 60000; tick(game, 100);
  assert(/Clang follows you/.test(text()), text());
  talk('ama', 'clang'); tick(game, 200);
  assert.strictEqual(state.questState('clang_rescue'), 'done');
  assert(/Hall of Paths/.test(text()), text());
  talk('pathkeeper', 'paths'); tick(game, 100);
  assert(/Try all four/.test(text()), text());
  for (const v of ['knight', 'paladin', 'sorcerer', 'druid']) {
    talk(state.PATHS[v].teacher, 'trial', 'yes');
    for (const id of state.PATHS[v].spells) ctx.trialProgress('cast', id);
    for (let i = 0; i < 3; i++) ctx.trialProgress('down');
    ctx.teleport(map.hall); tick(game, 200);
  }
  assert(/Which one made you grin/.test(text()), text());
  talk('pathkeeper', 'ember', 'yes'); tick(game, 3000);
  assert.strictEqual(p.vocation, 'sorcerer');
  assert(/You walk your path now/.test(text()), text());
  assert.strictEqual(vm.runInContext('homeTown()', ctx), 'Bellhaven');
});

test('the Hall of Paths (Kestrel Isle): a trial makes you that path for a while, safely, then all four stamps let you choose', () => {
  const game = loadGame({ world: 'kestrel' });
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions, map = state.map;
  state.monsters = state.monsters.filter(m => m.def.trial); // (only the practice dummies)
  assert.strictEqual(map.trialRooms.length, 4, 'four practice rooms');
  const npc = id => state.npcs.find(n => n.npcId === id);
  for (const id of ['pathkeeper', 'holt', 'sill', 'vela', 'fennick']) assert(npc(id) && map.isWalkable(npc(id).x, npc(id).y, npc(id).z) !== undefined, `${id} is in the hall`);
  const talk = (id, ...words) => { const n = npc(id); ctx.teleport({ ...ctx.findFreeTile(n.x, n.y + 1, n.z, 1), z: n.z }); const k = messages.length; A.say('hi'); for (const w of words) A.say(w); return messages.slice(k).join(' | '); };
  // the Pathkeeper explains, and gives the Book of Paths
  talk('pathkeeper', 'paths');
  assert(state.countItem('book_of_paths') === 1, 'the Book of Paths');
  assert(p.events.some(e => e.kind === 'paths'), 'the four cards open');
  // the teachers wait until Clang is safe
  { const said = talk('holt', 'trial'); assert(/Sister Ama/.test(said) && !p.trial, `Clang first: ${said}`); }
  p.quests.clang_rescue = { status: 'done' };
  const before = { xp: p.xp, level: p.level, maxMana: p.maxMana, gear: JSON.stringify(p.equipment), skills: JSON.stringify(p.skills) };
  talk('holt', 'trial', 'yes');
  assert(p.trial && p.vocation === 'knight', 'you are a Bastion for a while');
  const room = map.trialRooms.find(r => r.voc === 'knight');
  assert(p.z === room.z && p.x >= room.x0 && p.x <= room.x1 && p.y >= room.y0 && p.y <= room.y1, 'down in the practice room');
  assert(p.equipment.weapon && p.equipment.weapon.id === 'war_spear' && p.equipment.weapon.borrowed, 'a borrowed war spear');
  assert(p.mana >= 400, 'a deep well of mana');
  // a save mid-trial is the player as they were, back in the hall
  const save = ctx.serializePlayer(p);
  assert.strictEqual(save.vocation, 'none');
  assert(!JSON.stringify(save.equipment).includes('borrowed'), 'nothing borrowed in a save');
  assert(save.z === map.hall.z && save.x === map.hall.x, 'saved in the hall');
  // you can't die there
  ctx.damagePlayer(null, 10000, 'physical');
  assert(!p.dead && p.hp >= 1, 'nobody dies in a trial');
  // the circle throw, at any level, and a power strike on a dummy beside you
  const dummies = state.monsters.filter(m => m.z === room.z && m.x >= room.x0 && m.x <= room.x1 && m.y >= room.y0 && m.y <= room.y1 && !m.dead);
  assert(dummies.length >= 4, 'dummies to practise on');
  const d = dummies.find(m => m.type === 'straw_dummy');
  ctx.teleport({ ...ctx.findFreeTile(d.x, d.y + 1, d.z, 2), z: d.z });
  assert(p.trial && p.equipment.weapon, `still in the trial at ${p.x},${p.y},${p.z}`);
  A.say('hasta orbis'); tick(game, 3100);
  const e = state.monsters.find(m => m.def.trial && !m.dead && m.z === room.z && m.x >= room.x0 && m.x <= room.x1);
  ctx.teleport({ ...ctx.findFreeTile(e.x, e.y, e.z, 1), z: e.z }); p.target = e; A.say('vis ictus');
  assert(p.trial.spells.circle_throw && p.trial.spells.power_strike, `both spells tried: ${messages.slice(-4).join(' | ')}`);
  A.say('vis turbo');
  assert(/Not in this trial/.test(messages[messages.length - 1]), 'only the trial\'s spells');
  for (let i = 0; i < 3; i++) { const m = state.monsters.find(x => x.def.trial && !x.dead && x.z === room.z); ctx.killMonster(m); }
  assert(p.paths.knight, 'the Bastion\'s stamp');
  assert.strictEqual(p.xp, before.xp, 'no experience from practice');
  assert.strictEqual(JSON.stringify(p.skills), before.skills, 'nor skills');
  tick(game, 3500);
  assert(state.monsters.filter(m => m.def.trial && m.z === room.z && !m.dead).length >= 4, 'the dummies stand back up');
  // out by the forcefield: everything back as it was
  const exit = Object.entries(map.meta).find(([k, v]) => v.to && k.endsWith(`,${room.z}`) && +k.split(',')[0] >= room.x0 && +k.split(',')[0] <= room.x1);
  assert(exit, 'a forcefield out');
  ctx.teleport(map.hall); tick(game, 200);
  assert(!p.trial && p.vocation === 'none', 'your own self again');
  assert.strictEqual(JSON.stringify(p.equipment), before.gear, 'your own gear, nothing borrowed kept');
  assert.strictEqual(p.maxMana, before.maxMana);
  // choosing waits for all four stamps
  assert(/Try all four/.test(talk('pathkeeper', 'hawk')), 'not before all four');
  for (const v of ['paladin', 'sorcerer', 'druid']) {
    talk(state.PATHS[v].teacher, 'trial', 'yes');
    { const said = messages.slice(-3).join(' | '); assert(p.trial && p.vocation === v, `the ${v} trial: ${said}`); }
    for (const id of state.PATHS[v].spells) ctx.trialProgress('cast', id);
    for (let i = 0; i < 3; i++) ctx.trialProgress('down');
    ctx.teleport(map.hall); tick(game, 200);
    assert(!p.trial && p.paths[v], `the ${v} stamp`);
  }
  const said = talk('pathkeeper', 'hawk', 'yes');
  assert.strictEqual(p.vocation, 'paladin', said);
  assert(/Hawk/.test(said));
  tick(game, 3000);
  assert(state.countItem('arrow') >= 80, 'the teacher\'s gift');
  assert(messages.some(m => /You are now a Hawk!/.test(m)));
});

test('the hawkeye bow: about one shot in seven a critical hit, twice as hard, shown in orange', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player;
  const w = state.ITEMS.hawkeye_bow.weapon;
  let n = 0, crits = 0;
  for (; n < 4000; n++) { const [dmg, crit] = ctx.critical(w, 50); if (crit) { crits++; assert.strictEqual(dmg, 100, 'twice as hard'); } else assert.strictEqual(dmg, 50); }
  assert(crits / n > 0.12 && crits / n < 0.18, `about 15% (${crits / n})`);
  assert.strictEqual(ctx.critical(state.ITEMS.bow.weapon, 50)[1], false, 'a plain bow has none');
  assert(/critical hit 15%, 100% harder/.test(ctx.itemInfo('hawkeye_bow')), 'its look says so');
  ctx.teleport({ x: 128, y: 172, z: 8 });
  Object.assign(p, { level: 20 }); p.skills.distance.level = 60;
  p.equipment.weapon = { id: 'hawkeye_bow', count: 1 }; p.equipment.ammo = { id: 'arrow', count: 100 };
  assert(ctx.playerWeapon().crit, 'held, it shoots criticals');
  const m = ctx.spawnMonster({ type: 'bear', x: p.x + 3, y: p.y, z: 8 }); m.hp = m.maxHp = 99999; Object.assign(m.def = { ...m.def }, { speed: 0 }); state.monsters.push(m);
  state.Actions.setTarget(m.id);
  const orange = new Set();
  for (let t = 0; t < 120000; t += 100) { tick(game, 100); for (const fx of state.effects) if (fx.kind === 'text' && fx.color === '#ffb22e') orange.add(fx); }
  assert(orange.size > 0 && [...orange].every(fx => fx.text.endsWith('!')), 'some shots land as critical hits, marked with a !');
});

test('a level 100 test paladin holds the hawkeye bow; one made before gets it from the menu, the old bow kept', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player;
  ctx.makeTestHero('paladin');
  assert.strictEqual(p.equipment.weapon.id, 'hawkeye_bow', 'in the hands of a new one');
  p.equipment.weapon = { id: 'elven_bow', count: 1, q: 4 };
  assert(state.wantsTestSpear(), 'one made before is offered it');
  ctx.giveTestSpear();
  assert.strictEqual(p.equipment.weapon.id, 'hawkeye_bow', 'now in their hands');
  assert(p.equipment.backpack.contents.some(it => it.id === 'elven_bow' && it.q === 4), 'the old bow in the backpack, as it was');
  assert(!state.wantsTestSpear(), 'and not offered again');
});

test('lightning bolt (an Ember\'s): it strikes the target, then leaps to the next monster within 3 tiles, up to 6, never back', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  ctx.teleport({ x: 128, y: 172, z: 8 });
  Object.assign(p, { vocation: 'sorcerer', home: 'main', level: 30, mana: 900, maxMana: 900 });
  p.skills.magic.level = 30;
  const put = (dx, dy) => { const m = ctx.spawnMonster({ type: 'bear', x: p.x + dx, y: p.y + dy, z: 8 }); Object.assign(m, { x: p.x + dx, y: p.y + dy, hp: 9999, maxHp: 9999, aggro: 0 }); state.monsters.push(m); return m; };
  // a line of monsters 2 tiles apart, eight of them, from 3 tiles away; and one 5 tiles off the line (too far to leap to)
  const line = [0, 1, 2, 3, 4, 5, 6, 7].map(i => put(3 + 2 * i, 0)), far = put(3, 5);
  for (const m of state.monsters) m.def = { ...m.def, speed: 0 }; // (they stay put)
  A.say('fulmen saltus');
  assert(messages.some(m => /need a target/.test(m)), 'not without a target');
  p.target = line[0]; p.chase = false; state.now += 3000;
  A.say('fulmen saltus');
  const fx = state.effects.find(e => e.kind === 'chain');
  assert(fx, 'everyone near sees the lightning');
  assert.strictEqual(fx.points.length, 7, 'from you, through six monsters');
  tick(game, 1000);
  const hit = line.map(m => m.hp < 9999);
  assert.strictEqual(JSON.stringify(hit), JSON.stringify([true, true, true, true, true, true, false, false]), 'the first six along the line, in turn');
  assert.strictEqual(far.hp, 9999, 'nothing more than 3 tiles from the last one struck');
  // a pair: it leaps from one to the other and stops (never back)
  for (const m of state.monsters) m.dead = true;
  const a1 = put(2, 0), a2 = put(4, 0);
  p.target = a1; state.now += 3000; p.mana = 900;
  A.say('fulmen saltus');
  const fx2 = state.effects.filter(e => e.kind === 'chain').pop();
  assert.strictEqual(fx2.points.length, 3, 'two struck, and no leap back to the first');
  tick(game, 600);
  assert(a1.hp < 9999 && a2.hp < 9999);
  assert(!state.SPELLS.lightning_bolt.vocs.includes('druid'), 'an Ember\'s alone');
});

test('the triple shot: three quick arrows at your target, each hit on its own as it gets there, three arrows used', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  ctx.teleport({ x: 128, y: 172, z: 8 });
  Object.assign(p, { vocation: 'paladin', home: 'main', level: 20, mana: 500, maxMana: 500 });
  p.skills.distance.level = 40;
  p.equipment.weapon = { id: 'bow', count: 1 }; p.equipment.ammo = { id: 'arrow', count: 10 };
  A.say('sagitta trina'); tick(game, 100);
  assert(messages.some(m => /need a target/.test(m)), 'not without a target');
  const m = ctx.spawnMonster({ type: 'bear', x: p.x + 4, y: p.y, z: 8 }); m.hp = m.maxHp = 9999; state.monsters.push(m);
  p.target = m; p.chase = false; state.now += 3000;
  const hits = [];
  const before = () => m.hp;
  let last = before();
  A.say('sagitta trina');
  assert(state.effects.some(fx => fx.kind === 'volley' && fx.shots === 3), 'everyone near sees the volley');
  assert.strictEqual(p.equipment.ammo.count, 7, 'three arrows');
  p.target = null; // (no plain shots after it: only the three)
  for (let t = 0; t < 900; t += 20) { tick(game, 20); if (m.hp < last) { hits.push(t); } last = m.hp; }
  assert(hits.length >= 3, `three hits, one after the other (${hits})`);
  assert(hits[2] - hits[0] >= 120 && hits[2] - hits[0] <= 400, `quick: ${hits}`);
});

test('the power shot: a bow drawn to the full for a moment and a half, one arrow ten times as hard loosed through every monster in its way, each hit as the arrow gets there', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  ctx.teleport({ x: 128, y: 172, z: 8 });
  Object.assign(p, { vocation: 'paladin', home: 'main', level: 20, mana: 500, maxMana: 500 });
  p.skills.distance.level = 40;
  A.say('sagitta vis'); tick(game, 100);
  assert(messages.some(m => /bow/.test(m) && /hands/.test(m)), 'not without a bow');
  p.equipment.weapon = { id: 'bow', count: 1 }; p.equipment.ammo = { id: 'arrow', count: 10 };
  const at = (dx, dy) => { const m = ctx.spawnMonster({ type: 'bear', x: p.x + dx, y: p.y + dy, z: 8 }); m.hp = m.maxHp = 9999; state.monsters.push(m); return m; };
  const hurt = m => m.hp < 9999;
  p.dir = 2; // (no target: straight on, the way you face)
  const near = at(0, 2), mid = at(0, 4), far = at(0, 6), aside = at(2, 3);
  state.now += 3000; A.say('sagitta vis');
  assert(state.effects.some(fx => fx.kind === 'shot'), 'everyone near sees the shot');
  assert.strictEqual(p.equipment.ammo.count, 9, 'one arrow');
  const from = { x: p.x, y: p.y };
  A.walkTo(p.x - 3, p.y); tick(game, 700);
  assert(p.x === from.x && p.y === from.y, 'rooted to the spot while drawing');
  p.path = []; p.pathGoal = null;
  tick(game, 650);
  assert(!hurt(near), 'nothing while the bow is drawn, a moment and a half');
  const when = new Map();
  for (let t = 0; t < 600; t += 20) { tick(game, 20); for (const m of [near, mid, far]) if (hurt(m) && !when.has(m)) when.set(m, t); }
  assert(when.has(near) && when.has(mid) && when.has(far), 'every one in its way is hit');
  assert(when.get(near) < when.get(mid) && when.get(mid) < when.get(far), `the nearest first, then the next, then the furthest (${[...when.values()]})`);
  assert(!hurt(aside), 'nothing beside its way');
  state.now += 1500; p.mana = 500; A.say('sagitta vis');
  assert(messages.some(m => /Power Shot is not ready yet/.test(m)), 'five seconds before the next one');
  state.now += 2000; A.say('sagitta vis');
  assert.strictEqual(p.equipment.ammo.count, 8, 'then it can be shot again');
});

test('walking: speed grows with your level, ground counts, a diagonal step takes twice as long', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, vm = require('vm'), run = code => vm.runInContext(code, ctx);
  assert.strictEqual(run('speedOf(player)'), 278, 'level 1: speed 278 (as level 20 used to be)');
  assert.strictEqual(run('stepTime(player, "cobble", false)'), 400, 'a road: 1000 x 100 / 278, up to whole ticks of 50 ms');
  assert.strictEqual(run('stepTime(player, "grass", false)'), 550, 'grass is slower');
  assert.strictEqual(run('stepTime(player, "grass", true)'), 1100, 'a diagonal step twice as long');
  p.level = 21;
  assert.strictEqual(run('speedOf(player)'), 318, 'two more for every level');
  const wolf = ctx.spawnMonster({ type: 'wolf', x: 130, y: 172, z: 8 }), rat = ctx.spawnMonster({ type: 'rat', x: 131, y: 172, z: 8 });
  p.level = 1;
  assert(run('speedOf(player)') > rat.def.speed && wolf, 'a rat is slower than a new character');
});

test('a test character: level 100 with the best gear its vocation may wear, for every vocation', () => {
  for (const voc of ['knight', 'paladin', 'sorcerer', 'druid']) {
    const { ctx } = quietGame(), run = code => require('vm').runInContext(code, ctx);
    assert(run(`makeTestHero('${voc}')`), voc);
    const p = run('player');
    assert.strictEqual(p.level, 100);
    assert(p.hp === p.maxHp && p.maxHp > 150, 'full health');
    assert(p.pet && p.pet.kind === 'cat' && p.pet.level === 100 && p.pet.hp > 1000, 'Clang at level 100 beside them');
    if (voc === 'knight') { // (one made before that: the Menu's button gives him)
      p.pet = null;
      assert(run('isTestHero()'), 'a test character');
      run('giveTestClang()');
      assert(p.pet && p.pet.level === 100, 'Clang given to an older test character');
    }
    for (const slot of ['head', 'body', 'legs', 'feet', 'weapon']) {
      const it = p.equipment[slot];
      assert(it, `${voc}: something on ${slot}`);
      assert.strictEqual(run(`canWear('${it.id}')`), null, `${voc} can wear ${it.id}`);
    }
    if (voc === 'paladin') assert(p.equipment.ammo, 'ammunition for the bow');
    assert(run('bagItems().some(i => i.id === "health_potion")'), 'potions in the backpack');
  }
});

test('the equipment\'s defense: the shield\'s, or without one the weapon\'s, a better grade counting more', () => {
  const { ctx } = quietGame(), run = code => require('vm').runInContext(code, ctx);
  run(`player.equipment.weapon = { id: 'wooden_club', count: 1 }; player.equipment.shield = null;`);
  assert.strictEqual(run('totalDefense()'), run('ITEMS.wooden_club.defense'), 'no shield: the weapon defends');
  run(`player.equipment.shield = { id: 'wooden_shield', count: 1 };`);
  assert.strictEqual(run('totalDefense()'), 12, 'the shield, not the weapon');
  run(`player.equipment.shield.q = 2;`);
  assert(run('totalDefense()') > 12, 'a better shield defends more');
  run(`player.equipment.shield = null; player.equipment.weapon = null;`);
  assert.strictEqual(run('totalDefense()'), 0, 'nothing worn: nothing blocks');
});

// ---- the hidden quests (docs/world-plan.md, phase 7) ----
const inCtx = (game, src) => vm.runInContext(src, game.ctx);

test('The Watchman\'s Greaves: a rope up the Old Tower, its levers in the order on the watchmen\'s graves, the shade\'s chest in the cellar', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, map = state.map, T = inCtx(game, 'OLD_TOWER'), S = map.surfaceZ;
  p.level = 6;
  // the graves give the order: east first, then west, then the middle
  const graves = inCtx(game, 'OAKVALE').graveyard.stones.map(s => s[2]).join(' ');
  assert(/FIRST[^.]*EAST/.test(graves) && /SECOND[^.]*WEST/.test(graves) && /THIRD[^.]*MIDDLE/.test(graves), 'the watchmen\'s graves give the order');
  assert(!map.isWalkable(193, 119, S + 1), 'nobody walks in at the fallen door');
  // up with a rope, from in front of the fallen doorway
  ctx.addItem('rope', 1);
  Object.assign(p, { x: 193, y: 121, z: S + 1 });
  ctx.useItemOn(bagRef(state, 'rope'), 193, 120, S + 1);
  assert.strictEqual(p.z, S + 2, 'the rope takes you up to the top of the tower');
  assert(state.map.spawns.some(s => s.type === 'skeleton' && s.z === S + 2), 'skeletons keep the watch on top');
  // down the stairs into the tower: the levers, and the grate over the trapdoor
  Object.assign(p, { x: 192, y: 116, z: S + 1 });
  const lever = side => T.levers.find(l => l[3].includes(side));
  const pull = side => { const [x, y] = lever(side); ctx.useThing(x, y, S + 1); };
  const on = side => { const [x, y] = lever(side); return map.get(x, y, S + 1).items.includes('lever_on'); };
  const barred = () => map.get(...T.trapdoor, S + 1).items.includes('cellar_bars');
  pull('EAST'); pull('MIDDLE');
  assert(!on('EAST') && !on('MIDDLE'), 'the wrong order: every lever springs back');
  assert(messages.some(m => /not the right order/.test(m)), 'with a clank you hear');
  assert(barred(), 'and the grate stays down');
  pull('EAST'); pull('WEST');
  assert(on('EAST') && on('WEST') && barred(), 'two right: they stay, the grate waits');
  pull('MIDDLE');
  assert(!barred(), 'all three in order: the grate lifts');
  // down into the cellar: the shade keeps his chest
  ctx.useThing(...T.trapdoor, S + 1);
  assert.strictEqual(p.z, S, 'down the trapdoor into the cellar');
  const shade = ctx.spawnMonster({ type: 'watchman_shade', x: T.cellar.shade[0], y: T.cellar.shade[1], z: S });
  state.monsters.push(shade);
  const chest = T.cellar.props.find(pr => pr[2] === 'qchest_watchman');
  Object.assign(p, { x: chest[0], y: chest[1] + 1 });
  ctx.useThing(chest[0], chest[1], S);
  assert.strictEqual(state.countItem('watchman_greaves'), 0, 'not while the shade walks');
  ctx.damageMonster(shade, 99999, 'physical');
  const xp0 = p.xp;
  ctx.useThing(chest[0], chest[1], S);
  ctx.useThing(chest[0], chest[1], S);
  assert.strictEqual(state.countItem('watchman_greaves'), 1, 'the greaves, once');
  assert(p.xp - xp0 >= 200, 'and experience for the finding (the Old Tower\'s first part: its top is the quest)');
  assert(state.ITEMS.watchman_greaves.armor > state.ITEMS.leather_legs.armor, 'better than leather legs');
  // after a while the grate comes down again and the levers spring back, for the next one
  state.now += 3 * 60000 + 1;
  ctx.updateReverts();
  assert(barred() && !on('EAST') && !on('WEST') && !on('MIDDLE'), 'all as it was');
});

test('boulders: walk into one and it rolls a tile on, if there\'s room; it rolls back home after a while', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, map = state.map, G = inCtx(game, 'GOBLIN_WARREN'), Z = G.z;
  const [bx, by] = G.boulders[0]; // in the tunnel north: push it north, past the turn, into the niche
  const boulderAt = (x, y) => map.get(x, y, Z).items.includes('boulder');
  Object.assign(p, { x: bx, y: by + 1, z: Z, walk: null });
  assert(ctx.step(p, 0, -1), 'a push spends your step');
  assert(boulderAt(bx, by - 1) && !boulderAt(bx, by), 'the boulder rolls a tile on');
  assert.strictEqual(p.y, by + 1, 'and you stay where you are');
  assert(!ctx.step(p, 1, -1), 'not on a diagonal');
  for (let i = 0; i < 7; i++) { p.walk = null; ctx.step(p, 0, -1); } // (step, push, step, push...)
  assert(boulderAt(bx, by - 4) && p.y === by - 3, 'pushed on, past the turn, into the niche');
  assert(!ctx.step(p, 0, -1) && p.y === by - 3, 'it won\'t go into the rock');
  ctx.step(p, -1, 0);
  assert.strictEqual(p.x, bx - 1, 'the way west is clear');
  state.now += 10 * 60000 + 1;
  ctx.updateReverts();
  assert(boulderAt(bx, by) && !boulderAt(bx, by - 4), 'after a while it is back where it was');
});

test('The Bronze Ward: a burrow on Goblin Hill down to the goblins\' tunnels, and Brenna\'s shield in Gnash\'s hoard', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, map = state.map, G = inCtx(game, 'GOBLIN_WARREN'), Z = G.z, S = map.surfaceZ;
  assert(map.get(G.hole[0], G.hole[1], S).items.includes('hole') && map.get(G.hole[0], G.hole[1], Z).items.includes('cave_ladder'), 'the burrow and its ladder');
  const types = map.spawns.filter(s => s.z === Z && s.x >= 176 && s.x <= 206 && s.y >= 58 && s.y <= 86).map(s => s.type);
  assert(types.includes('goblin_archer') && types.includes('goblin_hoardkeeper'), 'archers, and the hoardkeeper');
  assert(state.MONSTERS.goblin_archer.ranged, 'archers shoot');
  const [cx, cy] = G.props.find(pr => pr[2] === 'qchest_bronze_ward');
  const keeper = ctx.spawnMonster({ type: 'goblin_hoardkeeper', x: cx - 2, y: cy + 1, z: Z });
  state.monsters.push(keeper);
  Object.assign(p, { x: cx - 1, y: cy, z: Z });
  ctx.useThing(cx, cy, Z);
  assert.strictEqual(state.countItem('bronze_ward'), 0, 'not while the hoardkeeper lives');
  ctx.damageMonster(keeper, 99999, 'physical');
  ctx.useThing(cx, cy, Z);
  assert.strictEqual(state.countItem('bronze_ward'), 1, 'the bronze ward');
  assert(p.chests.bronze_ward, 'the first part of Under Goblin Hill');
  assert(state.ITEMS.bronze_ward.defense > state.ITEMS.studded_shield.defense && state.ITEMS.bronze_ward.defense < state.ITEMS.iron_shield.defense, 'better than a studded shield, below the mainland\'s');
  // Brenna tells of it, when asked
  const brenna = state.npcs.find(n => n.npcId === 'oak_armourer');
  Object.assign(p, { x: brenna.x, y: brenna.y + 1, z: brenna.z });
  ctx.startConversation(brenna);
  ctx.say('bronze');
  assert(messages.some(m => /Bronze Ward/.test(m) && /under their hill/.test(m)), 'Brenna misses her grandmother\'s shield');
});

test('King Mogg\'s Sabre: dig through Gnash\'s hoard, drop into the bone halls, past the level 7 gate, and the king\'s sabre four floors down', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, map = state.map, D = inCtx(game, 'GOBLIN_DEEP');
  const go = (dx, dy) => { p.walk = null; const ok = ctx.step(p, dx, dy); tick(game, 1500); return ok; };
  ctx.addItem('shovel', 1); ctx.addItem('rope', 1);
  // the loose earth at the back of the hoard: a shovel digs through to the old diggings
  const [dx, dy] = D.dig;
  Object.assign(p, { x: dx - 1, y: dy, z: 7 });
  ctx.useItemOn(bagRef(state, 'shovel'), dx, dy, 7);
  assert(map.get(dx, dy, 7).items.includes('hole'), 'dug through');
  go(1, 0);
  assert.strictEqual(p.z, 6, 'down into the diggings');
  ctx.useItemOn(bagRef(state, 'rope'), dx, dy, 6);
  assert.strictEqual(p.z, 7, 'and a rope takes you back up');
  // the pit drops you into the bone halls, with no way back up there
  const [px, py] = D.pit;
  Object.assign(p, { x: px - 1, y: py, z: 6 });
  go(1, 0);
  assert.strictEqual(p.z, 5, 'down the pit');
  ctx.useItemOn(bagRef(state, 'rope'), px, py, 5);
  assert.strictEqual(p.z, 5, 'no climbing back up the pit');
  const [rx, ry] = D.rope;
  Object.assign(p, { x: rx + 1, y: ry, z: 5 });
  ctx.useItemOn(bagRef(state, 'rope'), rx, ry, 5);
  assert.strictEqual(p.z, 6, 'the rope spot in the far hall leads back up');
  // the old goblin gate: level 7 and up
  const [gx, gy, level] = D.gate;
  Object.assign(p, { x: gx, y: gy - 1, z: 5, level: level - 1 });
  assert(!go(0, 1) && p.y === gy - 1, 'the gate holds below level 7');
  assert(messages.some(m => m.includes(`level ${level}`)), 'and says so');
  p.level = level;
  go(0, 1); go(0, 1);
  assert.strictEqual(p.y, gy + 1, 'level 7 walks through');
  const [hx, hy] = D.down;
  Object.assign(p, { x: hx, y: hy - 1, z: 5 });
  go(0, 1);
  assert.strictEqual(p.z, 4, 'down to the throne hall');
  // King Mogg sits on his chest
  const [cx, cy] = D.floors[4].props.find(pr => pr[2] === 'qchest_mogg_sabre');
  const king = ctx.spawnMonster({ type: 'king_mogg', x: cx, y: cy + 2, z: 4 });
  state.monsters.push(king);
  Object.assign(p, { x: cx, y: cy + 1, z: 4 });
  ctx.useThing(cx, cy, 4);
  assert.strictEqual(state.countItem('mogg_sabre'), 0, 'not while the king stands');
  ctx.damageMonster(king, 99999, 'physical');
  ctx.useThing(cx, cy, 4);
  assert.strictEqual(state.countItem('mogg_sabre'), 1, 'King Mogg\'s sabre');
  assert.strictEqual(state.questState('mogg_sabre'), 'done');
  const I = state.ITEMS;
  for (const id of ['short_sword', 'longsword', 'tidecutter', 'brood_fang']) assert(I.mogg_sabre.weapon.attack > I[id].weapon.attack, `better than the ${id}`);
  assert(I.mogg_sabre.weapon.attack < I.broadsword.weapon.attack, 'below the mainland\'s blades');
  ctx.useThing(cx, cy, 4);
  assert.strictEqual(state.countItem('mogg_sabre'), 1, 'once per character');
  // the king's way out: ladders up behind his throne, floor by floor, to a hollow in the Deer Woods, and no way back down
  for (const [x, y, z] of D.exit) {
    Object.assign(p, { x: x + 1, y, z });
    go(-1, 0);
    assert.strictEqual(p.z, z + 1, `up the ladder from floor ${z}`);
    assert(!state.map.floorChange(p.x, p.y, p.z), 'nothing leads back down');
  }
  assert.strictEqual(p.z, state.map.surfaceZ, 'out in the Deer Woods');
});

test('The Captain\'s Mail: a rope up from the Old Tower\'s broken top, the officers\' grille at level 8, two stairs up, and Captain Harrow\'s pay chest', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, map = state.map, P = inCtx(game, 'TOWER_TOP'), S = map.surfaceZ;
  const go = (dx, dy) => { p.walk = null; const ok = ctx.step(p, dx, dy); tick(game, 1500); return ok; };
  ctx.addItem('rope', 1);
  const [rx, ry] = P.rope;
  Object.assign(p, { x: rx - 1, y: ry, z: S + 2 });
  ctx.useItemOn(bagRef(state, 'rope'), rx, ry, S + 2);
  assert.strictEqual(p.z, S + 3, 'a rope up into the watch room');
  // the officers' grille: level 8 and up
  const [wy, [gx, level]] = P.split;
  Object.assign(p, { x: gx, y: wy - 1, z: S + 3, level: level - 1 });
  assert(!go(0, 1) && p.y === wy - 1, 'the grille holds below level 8');
  assert(messages.some(m => m.includes(`level ${level}`)), 'and says so');
  p.level = level;
  go(0, 1); go(0, 1);
  assert.strictEqual(p.y, wy + 1, 'an officer walks through');
  for (const [x, y, z] of P.stairs) {
    Object.assign(p, { x: x + 1, y, z });
    go(-1, 0);
    assert.strictEqual(p.z, z + 1, `up the stairs from floor ${z}`);
  }
  // Captain Harrow keeps the pay chest
  const [cx, cy, cz] = P.props.find(pr => pr[3] === 'qchest_watch_mail');
  assert.strictEqual(cz, S + 5, 'on the roof');
  const captain = ctx.spawnMonster({ type: 'watch_captain', x: cx, y: cy + 2, z: cz });
  state.monsters.push(captain);
  Object.assign(p, { x: cx, y: cy + 1, z: cz });
  ctx.useThing(cx, cy, cz);
  assert.strictEqual(state.countItem('watch_mail'), 0, 'not while the captain stands');
  ctx.damageMonster(captain, 99999, 'physical');
  ctx.useThing(cx, cy, cz);
  assert.strictEqual(state.countItem('watch_mail'), 1, 'the watch captain\'s mail');
  assert.strictEqual(state.questState('watch_mail'), 'done');
  const I = state.ITEMS;
  for (const id of ['leather_armor', 'chain_armor', 'keeper_coat']) assert(I.watch_mail.armor > I[id].armor, `better than the ${id}`);
  assert(I.watch_mail.armor < I.plate_armor.armor, 'below plate');
});

test('The Smugglers\' Shield: a pick through the walled-up crevice on Lighthouse Point, the grotto, the drowned hall past the level 7 grille, Saltjaw, and up into the lighthouse', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, map = state.map, C = inCtx(game, 'SEA_CAVES'), S = map.surfaceZ;
  const go = (dx, dy) => { p.walk = null; const ok = ctx.step(p, dx, dy); tick(game, 1500); return ok; };
  ctx.addItem('pick', 1);
  const [cx, cy] = C.crevice, [kx, ky] = C.crack;
  Object.assign(p, { x: kx - 1, y: ky, z: S });
  assert(!go(1, 0) && p.x === kx - 1, 'the old keeper\'s stones block the way');
  ctx.useItemOn(bagRef(state, 'pick'), kx, ky, S);
  go(1, 0); go(1, 0);
  assert.strictEqual(p.z, 7, 'down the crevice into the grotto');
  assert(map.spawns.some(sp => sp.z === 7 && sp.type === 'crab' && Math.abs(sp.x - cx) < 10), 'crabs in the grotto');
  const [dx, dy] = C.down;
  Object.assign(p, { x: dx + 1, y: dy, z: 7 });
  go(-1, 0);
  assert.strictEqual(p.z, 6, 'down to the drowned hall');
  const [gx, gy, level] = C.gate;
  Object.assign(p, { x: gx - 1, y: gy, z: 6, level: level - 1 });
  assert(!go(1, 0) && p.x === gx - 1, 'the grille holds below level 7');
  assert(messages.some(m => m.includes(`level ${level}`)), 'and says so');
  p.level = level;
  go(1, 0); go(1, 0);
  assert.strictEqual(p.x, gx + 1, 'an old hand walks through');
  const [qx, qy] = C.floors[6].props.find(pr => pr[2] === 'qchest_smuggler_shield');
  const crab = ctx.spawnMonster({ type: 'saltjaw', x: qx, y: qy + 2, z: 6 });
  state.monsters.push(crab);
  Object.assign(p, { x: qx, y: qy + 1, z: 6 });
  ctx.useThing(qx, qy, 6);
  assert.strictEqual(state.countItem('smuggler_shield'), 0, 'not while Saltjaw lives');
  ctx.damageMonster(crab, 99999, 'physical');
  ctx.useThing(qx, qy, 6);
  assert.strictEqual(state.countItem('smuggler_shield'), 1, 'the smugglers\' copper shield');
  assert.strictEqual(state.questState('smuggler_shield'), 'done');
  const I = state.ITEMS;
  for (const id of ['wooden_shield', 'studded_shield', 'bronze_ward']) assert(I.smuggler_shield.defense > I[id].defense, `better than the ${id}`);
  assert(I.smuggler_shield.defense < I.iron_shield.defense, 'below the iron shield');
  // the smugglers' way out: up under the lighthouse's floor, and not back down
  const [ex, ey] = C.exit;
  Object.assign(p, { x: ex, y: ey + 1, z: 7 });
  go(0, -1);
  assert.strictEqual(p.z, S, 'up into the lighthouse');
  assert(!map.floorChange(ex, ey, S), 'the flagstones don\'t lead down');
});

test('The Carrot Bandit: Farmer Odo\'s rabbits, One-Eye Patch in his den, and the lucky paw', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, map = state.map, A = state.Actions;
  const den = inCtx(game, 'PATCH_DEN');
  assert(map.spawns.some(s => s.type === 'one_eye_patch' && s.x === den.at[0] && s.y === den.at[1]), 'Patch waits in his den');
  assert(map.spawns.filter(s => s.type === 'rabbit').length >= 6, 'rabbits in Sunny Fields');
  { // the rabbits are harmless: they never bite, and hit, they run
    ctx.teleport({ x: 140, y: 170, z: 8 });
    const r = ctx.spawnMonster({ type: 'rabbit', x: p.x + 1, y: p.y, z: 8 }); state.monsters.push(r);
    const hp = p.hp; tick(game, 5000);
    assert.strictEqual(p.hp, hp, 'a rabbit next to you never bites');
    r.hp = r.maxHp; ctx.damageMonster(r, 3, 'physical'); const d0 = state.dist(r, p); tick(game, 2000);
    assert(state.dist(r, p) > d0, 'hit, it runs');
    state.monsters = state.monsters.filter(m => m !== r);
  }
  const odo = state.npcs.find(n => n.npcId === 'fields_farmer');
  const talk = (...words) => { Object.assign(p, { x: odo.x, y: odo.y + 1, z: odo.z }); ctx.startConversation(odo); for (const w of words) ctx.say(w); ctx.endConversation(true); };
  p.level = 2;
  talk('carrots', 'yes');
  assert.strictEqual(state.questState('carrot_bandit'), 'active');
  const kill = type => { const m = ctx.spawnMonster({ type, x: odo.x + 3, y: odo.y + 3, z: odo.z }); state.monsters.push(m); ctx.damageMonster(m, 99999, 'physical'); };
  for (let i = 0; i < 4; i++) kill('rabbit');
  kill('one_eye_patch');
  talk('carrots');
  assert.strictEqual(state.questState('carrot_bandit'), 'done');
  assert(state.countItem('lucky_paw') === 1 && state.countItem('carrot') >= 5, 'the lucky paw, and carrots');
  assert(state.ITEMS.lucky_paw.ring.speed > 0 && state.ITEMS.carrot.use.food > 0, 'the paw runs, the carrot feeds');
});

test('The Weaver\'s Helm: fire through the web wall behind the Brood Queen, down the deep webs, the level 8 grate, the Old Weaver, and the ladders back up into the den', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, map = state.map, D = inCtx(game, 'DEEP_WEBS');
  const go = (dx, dy) => { p.walk = null; const ok = ctx.step(p, dx, dy); tick(game, 1500); return ok; };
  ctx.addItem('hand_torch', 1);
  const [wx, wy] = D.webWall;
  Object.assign(p, { x: wx, y: wy + 1, z: 7 });
  assert(!go(0, -1) && p.y === wy + 1, 'the web wall blocks the way');
  ctx.useItemOn(bagRef(state, 'hand_torch'), wx, wy, 7);
  assert(!map.get(wx, wy, 7).items.includes('web_wall'), 'fire burns it away');
  for (const [x, y, z] of D.holes) {
    Object.assign(p, { x, y: y + 1, z });
    if (!map.isWalkable(x, y + 1, z)) Object.assign(p, { x: x - 1, y });
    go(x - p.x, y - p.y);
    assert.strictEqual(p.z, z - 1, `down the hole on floor ${z}`);
  }
  const [gx, gy, level] = D.gate;
  Object.assign(p, { x: gx + 1, y: gy, z: 5, level: level - 1 });
  assert(!go(-1, 0) && p.x === gx + 1, 'the grate holds below level 8');
  assert(messages.some(m => m.includes(`level ${level}`)), 'and says so');
  p.level = level;
  go(-1, 0); go(-1, 0);
  assert.strictEqual(p.x, gx - 1, 'a strong arm heaves it aside');
  const [cx, cy] = D.floors[5].props.find(pr => pr[2] === 'qchest_weaver_helm');
  const weaver = ctx.spawnMonster({ type: 'old_weaver', x: cx, y: cy + 2, z: 5 });
  state.monsters.push(weaver);
  Object.assign(p, { x: cx, y: cy + 1, z: 5 });
  ctx.useThing(cx, cy, 5);
  assert.strictEqual(state.countItem('weaver_helm'), 0, 'not while the Old Weaver lives');
  ctx.damageMonster(weaver, 99999, 'physical');
  ctx.useThing(cx, cy, 5);
  assert.strictEqual(state.countItem('weaver_helm'), 1, 'the silk-bound helmet');
  assert.strictEqual(state.questState('weaver_helm'), 'done');
  const I = state.ITEMS;
  for (const id of ['leather_cap', 'chain_helmet']) assert(I.weaver_helm.armor > I[id].armor, `better than the ${id}`);
  assert(I.weaver_helm.armor < I.steel_helmet.armor, 'below the steel helmet');
  // her way out: up, back into the den
  for (const [x, y, z] of D.exit) {
    Object.assign(p, { x, y, z });
    assert(ctx.changeFloor(1) && p.z === z + 1, `up the ladder from floor ${z}`);
  }
  assert.strictEqual(p.z, 7, 'back in the spiders\' den');
});

test('Down the Well: a rope down the town well, rats in the dark, a pick through the fall of stone, and Old Wim\'s lucky ring', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, map = state.map, L = inCtx(game, 'WELL_TUNNELS'), Z = L.z, S = map.surfaceZ, [wx, wy] = L.well;
  ctx.addItem('rope', 1); ctx.addItem('pick', 1);
  Object.assign(p, { x: wx + 1, y: wy, z: S });
  ctx.useThing(wx, wy, S);
  assert.strictEqual(p.z, S, 'using the well alone takes you nowhere');
  ctx.useItemOn(bagRef(state, 'rope'), wx, wy, S);
  assert.strictEqual(p.z, Z, 'down the well with a rope');
  assert(map.spawns.some(s => s.z === Z && s.type === 'giant_rat' && Math.abs(s.x - wx) < 14 && Math.abs(s.y - wy) < 14), 'rats in the dark');
  ctx.useItemOn(bagRef(state, 'rope'), wx, wy, Z);
  assert.strictEqual(p.z, S, 'and up again');
  const [kx, ky] = L.crack;
  Object.assign(p, { x: kx - 1, y: ky, z: Z });
  ctx.useItemOn(bagRef(state, 'pick'), kx, ky, Z);
  assert(map.isWalkable(kx, ky, Z), 'the pick breaks through');
  const [bx, by] = L.props.find(pr => pr[2] === 'wim_bones');
  Object.assign(p, { x: bx - 1, y: by });
  ctx.useThing(bx, by, Z); ctx.useThing(bx, by, Z);
  assert.strictEqual(state.countItem('wim_ring'), 1, 'Old Wim\'s lucky ring, once');
  assert.strictEqual(state.questState('old_wim'), 'done');
});

test('rumours: the innkeeper tells of all nine hidden quests, one at a time, and townsfolk know some of them', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, R = inCtx(game, 'RUMOURS');
  const talk = (id, word, times) => {
    const n = state.npcs.find(np => np.npcId === id);
    Object.assign(p, { x: n.x + 1, y: n.y, z: n.z });
    ctx.startConversation(n);
    for (let i = 0; i < times; i++) ctx.say(word);
    ctx.endConversation(true);
  };
  talk('oak_innkeeper', 'rumours', 9);
  for (const [k, text] of Object.entries(R)) assert(messages.some(m => m.includes(text)), `Rolf tells the rumour of the ${k}`);
  assert.strictEqual(Object.keys(R).length, 9);
  messages.length = 0;
  talk('oak_old_man', 'rumours', 1);
  assert(messages.some(m => /Oswin, Marrow and Tobin/.test(m)), 'the old man knew the last watch');
  // nobody's arrow points at them: they're no quests anyone gives
  for (const id of ['watch_mail', 'mogg_sabre', 'old_wim']) assert(state.QUESTS[id].chest && !state.QUESTS[id].giver, `${id} is found, not given`);
});

// ---- Oakvale Isle's hidden quests (docs/world-plan.md, Phase 7) ----
// Stand next to x, y, z (or on it), talk, and say words.
function discoveryKit() {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions;
  const at = (x, y, z) => { const f = ctx.findFreeTile(x, y, z, 2); ctx.teleport({ x: f.x, y: f.y, z }); tick(game, 50); };
  const said = w => { const n = messages.length; A.say(w); tick(game, 100); return messages.slice(n).join(' | '); };
  const meet = id => { const n = state.npcs.find(c => c.npcId === id); if (p.conversation) said('bye'); at(n.x, n.y, n.z); return said('hi'); };
  const give = (id, n = 1) => p.equipment.backpack.contents.push(state.ITEMS[id].stack ? { id, count: n } : { id, count: 1 });
  const has = id => state.countItem(id) > 0;
  const night = () => { while (ctx.daylight() >= 1) tick(game, 60000); };
  p.equipment.backpack = { id: 'backpack', count: 1, contents: [] };
  return { game, ctx, state, messages, p, A, at, said, meet, give, has, night };
}

test('beaches: loose sand to dig with a shovel (a find, then it fills in again); fishing now and then brings up a pearl or a bottle', () => {
  const { game, ctx, state, p, at, give, has } = discoveryKit();
  const { map } = state;
  const spots = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if ((map.get(x, y, 8) || { items: [] }).items.includes('buried')) spots.push([x, y]);
  assert(spots.length >= 15, `loose sand on the beaches (${spots.length})`);
  const [x, y] = spots[0];
  give('shovel'); at(x, y, 8);
  ctx.Math.random = () => 0.3; // (a few old coins)
  const gold = p.gold;
  ctx.useItemOn(bagRef(state, 'shovel'), x, y, 8);
  assert(p.gold > gold, 'coins in the sand');
  assert(map.get(x, y, 8).items.includes('dug_sand') && !map.get(x, y, 8).items.includes('buried'), 'dug up');
  const after = p.gold;
  ctx.useItemOn(bagRef(state, 'shovel'), x, y, 8);
  assert.strictEqual(p.gold, after, 'nothing more there now');
  ctx.teleport(map.start); tick(game, 21 * 60000);
  assert(map.get(x, y, 8).items.includes('buried'), 'the tides fill it in again');
  // fishing off Old Maddock's jetty
  give('fishing_rod'); ctx.teleport({ x: 34, y: 175, z: 8 });
  ctx.Math.random = () => 0.285; state.now += 2000; ctx.useItemOn(bagRef(state, 'fishing_rod'), 34, 177, 8);
  assert(has('pearl'), 'a pearl, now and then');
  ctx.Math.random = () => 0.295; state.now += 2000; ctx.useItemOn(bagRef(state, 'fishing_rod'), 34, 177, 8);
  assert(has('bottle_message') && /Tidecutter/.test(state.ITEMS.bottle_message.text), 'a bottle with a letter: a clue');
});

test('hidden quests: no mark over the giver\'s head and no guide arrow, but the greeting hints, and the words are there', () => {
  const { ctx, state, p, said, meet } = discoveryKit();
  for (const id of ['tidecutter', 'keeper_coat', 'eagle_eyrie']) assert(state.QUESTS[id].hidden, `${id} is hidden`);
  for (const step of state.GUIDE) for (const t of step.target || []) assert(!['tidecutter', 'keeper_coat', 'eagle_eyrie'].includes(t.quest), 'no guide step for them');
  p.level = 10;
  for (const [npc, word] of [['rest_fisher', 'tale'], ['oak_keeper', 'lighthouse']]) {
    assert.strictEqual(ctx.questNews(npc, true), null, `${npc}: no mark over the head`);
    assert(new RegExp(`\\{${word}\\}`).test(meet(npc)), `${npc}: but the greeting hints at the {${word}}`);
  }
  said('bye');
});

test('greetings follow you: Osric mentions watch marks only once you have some, Corwin greets his fighters as such', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const A = state.Actions;
  const greet = id => { const n = state.npcs.find(c => c.npcId === id); ctx.teleport({ ...ctx.findFreeTile(n.x, n.y, n.z, 2), z: n.z }); tick(game, 100);
    const at = messages.length; A.say('hi'); tick(game, 100); const out = messages.slice(at).join(' | '); A.say('bye'); tick(game, 200); return out; };
  assert(!/\{marks\}/.test(greet('gate_north')), 'no marks yet: not mentioned');
  ctx.addItem('watch_mark', 2);
  assert(/\{marks\}/.test(greet('gate_north')), 'with marks: they are');
  assert(/new face/.test(greet('corwin')), 'a new face before the training');
  state.player.quests.recruit = { status: 'done', step: 1, kills: {} };
  assert(/Back again/.test(greet('corwin')) && !/new face/.test(greet('corwin')), 'one of his fighters after it');
});

test('every picture is listed with its own version (else run: node tests/sprite-versions.js)', () => {
  const { versions, OUT } = require('./sprite-versions');
  const listed = vm.runInNewContext(`${fs.readFileSync(OUT, 'utf8')}; SPRITE_HASHES`);
  const want = versions(), stale = Object.keys(want).filter(f => listed[f] !== want[f]);
  assert.strictEqual(stale.length, 0, `out of date for: ${stale.slice(0, 5).join(', ')}`);
});

test('the four lists of logic files agree (index.html, server.js, dev.js, the harness)', () => {
  const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  const { LOGIC_FILES } = require('./harness');
  const page = [...read('index.html').matchAll(/<script src="js\/([\w-]+)\.js/g)].map(m => m[1]).filter(f => LOGIC_FILES.includes(f));
  const server = (/for \(const f of \[([^\]]+)\]/.exec(read('server/server.js')) || [])[1];
  const dev = (/LOGIC\s*=\s*\/([^/]+)\//.exec(read('server/dev.js')) || [])[1];
  assert.strictEqual(page.join(), LOGIC_FILES.join(), 'index.html loads them in the harness\'s order');
  assert.ok(server, 'found the server\'s list');
  assert.strictEqual(server.match(/[\w-]+/g).join(), LOGIC_FILES.join(), 'server.js loads them in the same order');
  for (const f of LOGIC_FILES) assert.ok(dev && new RegExp(dev).test(`${f}.js`), `dev.js reloads on a change to ${f}.js`);
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
