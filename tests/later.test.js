'use strict';
// Tests kept for later: rules and content of the old world (Brightwater Isle, Valoria and the mainland), which the
// built-in world no longer has since it was rebuilt as Oakvale Isle. They go to fixed places and NPCs of the old
// map, so they can't pass until the mainland is back, or until they get a test area of their own. They are not run
// with the other tests: bring each one back into unit.test.js once what it needs is in the world again.
//   node tests/later.test.js   (expect failures)

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

test('findPath walks around walls and respects range', () => {
  const { ctx, state } = loadGame();
  const pass = (x, y) => state.map.isWalkable(x, y, 4);
  const path = ctx.findPath(pass, 31, 31, 31, 36);
  assert(path && path.length >= 5);
  for (const [x, y] of path) assert(pass(x, y));
  assert(ctx.findPath(pass, 31, 31, 31, 36, { range: 3 }).length < path.length);
  assert.strictEqual(ctx.findPath(pass, 31, 31, 110, 60, { maxNodes: 500 }), null, 'no path across the sea');
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

test('raids bring monsters and announce themselves', () => {
  const game = quietGame();
  const { ctx, state } = game;
  ctx.startRaid({ name: 'test', message: 'Here they come!', at: { x: 31, y: 40, z: 4 }, spawns: [['rat', 3]] });
  assert.strictEqual(state.monsters.filter(m => m.raid).length, 3);
  assert(state.player.events.some(e => e.kind === 'raid'));
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
