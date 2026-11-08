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
  const p = state.player, A = state.Actions, map = state.map;
  ctx.teleport({ x: 131, y: 113, z: 8 });
  A.walkTo(131, 111);
  tick(game, 1500);
  assert.strictEqual(p.z, 8, 'walking over a grate doesn\'t drop you into the sewers');
  assert.strictEqual(p.x * 1000 + p.y, 131111, 'you can stand on it');
  A.walkTo(131, 113);
  tick(game, 1500);
  A.interact('use', 131, 111, 8);
  tick(game, 1500);
  assert.strictEqual(p.z, 7, 'using it climbs down through the grate on the square');
  assert(Math.abs(p.x - 131) <= 1 && Math.abs(p.y - 111) <= 1, 'landed beside the ladder under it');
  assert(map.get(131, 111, 7).items.includes('sewer_ladder'), 'a ladder stands under the grate');
  A.walkTo(131, 111);
  tick(game, 1500);
  assert.strictEqual(p.z, 8, 'climbed back up the ladder');
  const below = map.spawns.filter(s => s.z === 7);
  assert(below.filter(s => s.type === 'rat').length >= 8, 'rats live in the sewers');
  assert(below.some(s => s.type === 'giant_rat'), 'and giant rats in their nest');
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
  for (const [id, word, kill, n, boss, item, next] of [['gate_west', 'wolves', 'wolf', 8, 'greyfang', 'leather_armor', /Tilda/],
    ['gate_south', 'crabs', 'crab', 6, 'old_snapper', 'leather_legs', /Hilde/], ['gate_east', 'spiders', 'spider', 8, 'thornmother', 'chain_helmet', /Osric/],
    ['gate_north', 'goblins', 'goblin', 8, 'gnash', 'studded_shield', /crypt/]]) {
    assert.strictEqual(ctx.questNews(id).mark, 'offer', `${id} has a task: !`);
    talk(id, word, 'yes');
    for (let i = 0; i < n; i++) ctx.onMonsterKilled(kill);
    assert.strictEqual(ctx.questNews(id).mark, 'busy', `${id}: the pack alone is not enough`);
    ctx.onMonsterKilled(boss);
    assert(state.map.spawns.some(s => s.type === boss), `${boss} lives in the hunting ground`);
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
  tick(game, 30000);
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
  Object.assign(r2, { x: 126, y: 151 }); // just outside the south gate
  state.monsters.push(r2);
  assert(state.map.isTown(126, 150, 8) && !state.map.isTown(126, 151, 8));
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

test('The Silent Bell in order of danger: the crypt hall, then the rope deep under town, then the Gravewaker', () => {
  const game = quietGame();
  const { ctx, state, messages } = game;
  const p = state.player, A = state.Actions, map = state.map;
  p.quests.bell_1 = { status: 'done', step: 5, kills: {} };
  const talk = (x, y, z, ...words) => { ctx.teleport({ x, y, z }); A.say('hi'); for (const w of words) A.say(w); A.say('bye'); };
  const kill = (type, n) => { for (let i = 0; i < n; i++) ctx.onMonsterKilled(type); };
  // II: the crypt hall, from Master Corwin at level 5
  p.level = 4;
  talk(112, 103, 8, 'crypt', 'yes');
  assert.strictEqual(state.questState('bell_2'), 'none', 'not before level 5');
  p.level = 5;
  talk(112, 103, 8, 'crypt', 'yes');
  assert.strictEqual(state.questState('bell_2'), 'active');
  assert(messages.some(m => /Brenna/.test(m) && /potions/.test(m)), 'with advice: armour from Brenna, potions from Pip');
  ctx.useThing(80, 178, 7);
  ctx.useThing(71, 181, 7);
  assert(state.countItem('war_axe') === 0 && state.countItem('torn_note') === 0, 'no weapon and no note while the dead still walk');
  kill('skeleton', 6);
  assert.strictEqual(p.quests.bell_2.step, 1, 'six skeletons: the hall is cleared, without going back');
  ctx.useThing(80, 178, 7);
  ctx.useThing(71, 181, 7);
  assert(state.countItem('war_axe') === 1 && state.countItem('torn_note') === 1, 'one of the founders\' weapons, and the note');
  assert(!ctx.playerCanEnter(69, 181, 7), 'the iron gate to the tomb stays shut');
  talk(112, 103, 8, 'crypt');
  assert.strictEqual(state.questState('bell_2'), 'done', 'Corwin reads the note');
  // III: the rope, from Ama at level 6, past the giant rats and the cistern slime
  talk(136, 102, 9, 'bell', 'yes');
  assert.strictEqual(state.questState('bell_3'), 'none', 'not before level 6');
  p.level = 6;
  talk(136, 102, 9, 'bell', 'yes');
  assert.strictEqual(state.questState('bell_3'), 'active');
  ctx.useThing(148, 101, 5);
  assert.strictEqual(state.countItem('chewed_rope'), 0, 'the rope waits until the way is cleared');
  kill('giant_rat', 8);
  kill('cistern_slime', 1);
  assert.strictEqual(p.quests.bell_3.step, 2, 'the drains and the cistern slime');
  ctx.useThing(148, 101, 5);
  ctx.useThing(142, 103, 5);
  assert(state.countItem('chewed_rope') === 1 && state.countItem('leather_boots') === 1, 'the rope, and boots in the rotting pack');
  talk(136, 102, 9, 'bell');
  assert.strictEqual(state.questState('bell_3'), 'done');
  // IV: the Gravewaker, at level 8: the gate opens, the tomb gives the clapper, the bell rings
  ctx.useThing(147, 102, 13);
  assert(/hangs silent/.test(messages[messages.length - 1]), 'the bell is still silent');
  p.level = 8;
  talk(136, 102, 9, 'bell', 'yes');
  assert.strictEqual(state.questState('bell_4'), 'active');
  assert(ctx.playerCanEnter(69, 181, 7), 'the iron gate opens now');
  ctx.useThing(69, 176, 6);
  assert.strictEqual(state.countItem('bell_clapper'), 0, 'the clapper waits for the Gravewaker');
  kill('gravewaker', 1);
  ctx.useThing(69, 176, 6);
  assert.strictEqual(state.countItem('bell_clapper'), 1);
  talk(136, 102, 9, 'bell');
  assert.strictEqual(state.questState('bell_4'), 'done');
  assert(messages.some(m => /rings again/.test(m)), 'the bell rings out');
  assert.strictEqual(state.countItem('chain_armor'), 1, 'and Ama gives chain armour');
  ctx.useThing(147, 102, 13);
  assert(/still humming/.test(messages[messages.length - 1]), 'it hums a while after');
  state.now += 31000;
  ctx.useThing(147, 102, 13);
  assert(/rings the bell of Oakvale/.test(messages[messages.length - 1]), 'then anyone may ring it');
  p.level = 9;
  talk(110, 102, 9, 'knight', 'yes');
  assert.strictEqual(p.vocation, 'none', 'the oracle wants level 10, bell or no bell');
});

test('free gear in the sewers: a cap in the old storeroom and a shield in the rats\' nest, once each', () => {
  const game = quietGame();
  const { ctx, state } = game;
  for (const [x, y, z, item] of [[105, 121, 7, 'leather_cap'], [144, 140, 7, 'wooden_shield']]) {
    ctx.useThing(x, y, z);
    assert.strictEqual(state.countItem(item), 1, `the chest at ${x},${y},${z} gives ${item}`);
    ctx.useThing(x, y, z);
    assert.strictEqual(state.countItem(item), 1, 'but only once');
  }
});

test('the whole road from level 1 to 10: the guide\'s arrow, the marks over heads and the words always point the right way', () => {
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
  on(null, { x: 137, y: 103, z: 9 });
  assert.strictEqual(arrow(), 'ama'); assert.strictEqual(mark('ama'), 'offer');
  A.endGuide();
  assert.strictEqual(p.tutorial, 1, 'the guide can\'t be put away before its end (only folded)');
  assert.strictEqual(mark('gate_south'), undefined, 'the later gates wait for the first');
  talk('ama'); talk('ama', 'bell', 'yes');
  assert.strictEqual(arrow(), 'corwin'); assert.strictEqual(mark('corwin'), 'report');
  talk('corwin', 'bell'); kill('rat', 5);
  p.openPile = { corpse: 'blood' }; tick(game, 100); p.openPile = null; p.fedUntil = state.now + 99999;
  assert.strictEqual(arrow(), 'corwin');
  talk('corwin', 'bell'); assert.strictEqual(arrow(), 'postmaster');
  talk('postmaster', 'locker'); assert.strictEqual(arrow(), 'pip');
  talk('pip', 'letter'); assert.strictEqual(arrow(), 'ama');
  talk('ama', 'bell'); assert.strictEqual(state.questState('bell_1'), 'done');
  p.shopNpc = 'pip'; tick(game, 100); p.shopNpc = null;
  levelTo(2); assert.strictEqual(arrow(), 'gate_west', 'on to the gate watch');
  for (const [id, word, type, n, level, next] of [['gate_west', 'wolves', 'wolf', 8, 2, 'gate_south'], ['gate_south', 'crabs', 'crab', 6, 3, 'gate_east'],
    ['gate_east', 'spiders', 'spider', 8, 4, 'gate_north'], ['gate_north', 'goblins', 'goblin', 8, 5, null]]) {
    levelTo(level);
    assert.strictEqual(mark(id), 'offer', `${id} has a task`);
    talk(id, word, 'yes'); kill(type, n); kill({ gate_west: 'greyfang', gate_south: 'old_snapper', gate_east: 'thornmother', gate_north: 'gnash' }[id], 1);
    assert.strictEqual(mark(id), 'report'); assert.strictEqual(arrow(), id, `the arrow goes back to ${id}`);
    talk(id, word);
    if (next) assert.strictEqual(arrow(), next, `and on to ${next}`);
  }
  assert.strictEqual(arrow(), 'corwin', 'then to Corwin and the crypt');
  assert.strictEqual(ctx.questWord('corwin', 'bell_2'), 'crypt');
  talk('corwin', 'crypt', 'yes'); on(null, { x: 128, y: 120, z: 8 });
  assert.strictEqual(arrow(), '81,198,8', 'to the crypt\'s steps');
  kill('skeleton', 6); ctx.useThing(80, 178, 7); ctx.useThing(71, 181, 7);
  assert.strictEqual(arrow(), 'corwin'); assert.strictEqual(ctx.questWord('corwin', 'bell_2'), 'note');
  talk('corwin', 'note'); assert.strictEqual(state.questState('bell_2'), 'done');
  levelTo(6); assert.strictEqual(arrow(), 'ama'); assert.strictEqual(mark('ama'), 'offer');
  talk('ama', 'rope', 'yes'); on(null, { x: 128, y: 120, z: 8 });
  assert.strictEqual(arrow(), '131,111,8', 'to the grate on the square');
  kill('giant_rat', 8); kill('cistern_slime', 1); ctx.useThing(148, 101, 5);
  assert.strictEqual(arrow(), 'ama');
  talk('ama', 'rope'); assert.strictEqual(state.questState('bell_3'), 'done');
  assert.strictEqual(mark('ama'), 'later', 'the Gravewaker waits for level 8');
  levelTo(8); assert.strictEqual(arrow(), 'ama');
  talk('ama', 'gravewaker', 'yes'); on(null, { x: 128, y: 120, z: 8 });
  assert.strictEqual(arrow(), '81,198,8', 'back to Bone Rocks');
  kill('gravewaker', 1); ctx.useThing(69, 176, 6);
  assert.strictEqual(arrow(), 'ama'); assert.strictEqual(ctx.questWord('ama', 'bell_4'), 'clapper');
  talk('ama', 'clapper'); assert.strictEqual(state.questState('bell_4'), 'done');
  levelTo(10); assert.strictEqual(arrow(), 'oak_oracle', 'and at level 10, to the oracle');
  A.endGuide();
  assert.strictEqual(p.tutorial, 0, 'at its last step, "Got it" puts it away');
});

test('walking: speed grows with your level, ground counts, a diagonal step takes twice as long', () => {
  const game = quietGame();
  const { ctx, state } = game;
  const p = state.player, vm = require('vm'), run = code => vm.runInContext(code, ctx);
  assert.strictEqual(run('speedOf(player)'), 240, 'level 1: speed 240');
  assert.strictEqual(run('stepTime(player, "cobble", false)'), 450, 'a road: 1000 x 100 / 240, up to whole ticks of 50 ms');
  assert.strictEqual(run('stepTime(player, "grass", false)'), 650, 'grass is slower');
  assert.strictEqual(run('stepTime(player, "grass", true)'), 1250, 'a diagonal step twice as long');
  p.level = 21;
  assert.strictEqual(run('speedOf(player)'), 280, 'two more for every level');
  const wolf = ctx.spawnMonster({ type: 'wolf', x: 130, y: 172, z: 8 }), rat = ctx.spawnMonster({ type: 'rat', x: 131, y: 172, z: 8 });
  p.level = 1;
  assert(run('speedOf(player)') < wolf.def.speed && run('speedOf(player)') > rat.def.speed, 'a wolf outruns a new character; a rat does not');
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
