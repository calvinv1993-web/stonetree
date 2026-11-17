'use strict';
// How long the Oakvale route takes, from level 1 to 10: one character plays it with the game's own combat code.
// It follows the route of the guide and the quests as they are now: The Silent Bell I, the Rats' Hoard and Clang at
// level 2 (Clang then fights at its side, with the game's own pet code), the gate watch from level 2 to 5, the watch's
// hunts from level 3 whenever one is free, The Silent Bell II to V, and the Chronicle pages it passes on the way.
// It hunts packs of the monsters where someone of its level would hunt, walks between them, rests when hurt (buying
// a bread for it), drinks a potion when low - only potions it has: from quests, chests and loot, from Captain
// Osric for watch marks, or bought at Pip's price with the gold and loot it earned - and goes to town for more
// when it runs out; with money to spare it buys better armour and a club. A leader that kills it is tried again a level
// later. Quest rewards are the game's own (advanceQuest). Prints when each level is reached, and the deaths (where),
// potions, gold and skills.
//   node tests/pace.js [seed=1]          (TRACE=1: the health of every fight, every two seconds)
// Aim: about 2.5 hours (150 minutes) to level 10.

const vm = require('vm');
const { loadGame } = require('./harness');

const seed = +(process.argv[2] || 1);
const game = loadGame({ seed });
const { ctx, state } = game;
const run = code => vm.runInContext(code, ctx);
const p = state.player, A = state.Actions, ITEMS = state.ITEMS, QUESTS = state.QUESTS;
state.monsters = [];
state.map.spawns.length = 0; // only the packs below
run('nextRaidAt = Infinity'); // (and no raids: they come to the gates, not to these fights)
Object.assign(p, { tutorial: 0, home: 'oakvale' });

const ARENA = { x: 130, y: 172, z: 8 }; // open ground in Sunny Fields
const WALK = 25000;                     // between one pack and the next (walking as slow as in Tibia)
const TRIP = 4 * 60000;                 // out of potions: back to town and out again
const BACK = 3 * 60000;                 // dead: from the temple back to where you were
const PRICE = run("NPCS.pip.trade.sells.find(s => s[0] === 'health_potion')[1]"), BREAD = run("NPCS.pip.trade.sells.find(s => s[0] === 'bread')[1]");
const sellable = run('[BUYS.loot, BUYS.tools]');
let deaths = 0, drunk = 0, bought = 0, fromMarks = 0, trips = 0, loose = 0, sold = 0, spentFood = 0;
const kills = {}, spent = {}, died = []; // per pack: [packs, minutes, potions, lowest health (share, summed), deaths]
const minutes = () => Math.round(state.now / 6000) / 10;
const levels = [0]; // the minute each level was reached
const track = () => { while (levels.length < p.level) levels.push(minutes()); };
const step = ms => { for (let t = 0; t < ms; t += 50) { state.now += 50; ctx.updateWorld(); track(); } };
const wait = ms => { const end = state.now + ms; while (state.now < end) { state.now += 500; ctx.updateWorld(); track(); } };
const equip = (slot, id) => { ctx.removeItem(id, 1); p.equipment[slot] = { id, count: 1 }; }; // (from the bag, if it's there)
const potions = () => state.countItem('health_potion');
let where = 'town';

// In town: sell the loot at Pip's, trade watch marks for potions at Captain Osric's, and buy potions up to `want`.
function shop(want = 10) {
  p.gold += loose; sold += loose; loose = 0;
  while (state.countItem('watch_mark') >= 2 && potions() < want + 5) { ctx.removeItem('watch_mark', 2); ctx.addItem('health_potion', 5); fromMarks += 5; }
  const n = Math.max(0, Math.min(want - potions(), Math.floor(p.gold / PRICE)));
  if (n) { p.gold -= n * PRICE; ctx.addItem('health_potion', n); bought += n; }
  // with what's left (keeping enough for five potions): better gear from the smithy and Hide and Iron
  for (const [id, price] of GEAR) {
    const d = ITEMS[id], cur = p.equipment[d.slot];
    if (worth(d) > (cur ? worth(ITEMS[cur.id]) : 0) && p.gold - price >= 5 * PRICE) { p.gold -= price; gearSpent += price; equip(d.slot, id); gearBought.push(`${id} (L${p.level})`); }
  }
}
const worth = d => (d.weapon ? d.weapon.attack * 2 : 0) + (d.armor || 0) + (d.defense || 0);
const GEAR = [...run('NPCS.oak_smith.trade.sells').filter(([id]) => ITEMS[id].weapon && ITEMS[id].weapon.type === 'club'), // (clubs: what it trains)
  ...run('NPCS.oak_armourer.trade.sells')].filter(([id]) => !ITEMS[id].level);
let gearSpent = 0;
const gearBought = [];
// How many potions to carry out: more for the harder places.
const carry = () => 4 + p.level;

// Rest until nearly healed, as a player would before the next pack: with a bread, if there's money for one.
function rest() {
  if (p.gold >= BREAD) { p.gold -= BREAD; spentFood += BREAD; p.fedUntil = state.now + 3600000; }
  const end = state.now + 300000;
  while (p.hp < p.maxHp * 0.9 && state.now < end) wait(1000);
}

// One pack: spawn it round you, fight it to the end; then take what it dropped (gold and potions; loot to sell).
function fight(pack) {
  const key = `${pack.join('+')} (${where})`, t0 = state.now, d0 = drunk;
  if (!potions() && p.gold + loose >= PRICE * 3) { wait(TRIP); trips++; shop(carry()); } // out of potions: to town first
  ctx.teleport(ARENA);
  const ms = [];
  pack.forEach((type, i) => {
    const m = ctx.spawnMonster({ type, x: ARENA.x + 2 + (i % 2), y: ARENA.y - 1 + i, z: ARENA.z });
    if (m) { state.monsters.push(m); ms.push(m); }
  });
  const end = state.now + 240000;
  let low = p.hp / p.maxHp;
  const alive = () => state.monsters.filter(m => !m.dead); // (the pack, and whatever its leader calls)
  while (!p.dead && alive().length && state.now < end) {
    low = Math.min(low, p.hp / p.maxHp);
    // the pack round a leader first, then the leader (what it calls in goes with it), then anything left
    if (!p.target || p.target.dead) { const m = ms.filter(m => !m.dead).sort((a, b) => a.hp - b.hp)[0] || alive()[0]; if (m) A.setTarget(m.id); }
    if (p.hp < p.maxHp * 0.4 && potions() && state.now >= p.potionReady) { const n = potions(); A.hotkey('h'); drunk += n - potions(); }
    step(100);
    if (process.env.TRACE && state.now % 2000 < 100) console.log(`${minutes()} ${key} hp ${p.hp}/${p.maxHp} potions ${potions()} ${state.monsters.filter(m => !m.dead).map(m => `${m.type}:${m.hp}`).join(' ')} pet ${p.pet ? p.pet.hp : '-'}`);
  }
  for (const m of state.monsters) if (m.dead) kills[m.type] = (kills[m.type] || 0) + 1;
  const won = ms.every(m => m.dead);
  for (const pile of state.piles) {
    for (const it of pile.items) {
      const d = ITEMS[it.id];
      if (it.id === 'gold' || it.id === 'health_potion') ctx.addItem(it.id, it.count || 1);
      else if (d && d.value && sellable.some(test => test(d))) loose += d.value * (it.count || 1);
    }
  }
  state.monsters = [];
  state.piles.length = 0;
  const sp = spent[key] || (spent[key] = [0, 0, 0, 0, 0]);
  if (p.dead) { // you wake in the temple, and walk back out
    deaths++; sp[4]++;
    died.push(`L${p.level} ${key} at minute ${minutes()}`);
    while (p.dead) step(500);
    shop(carry()); // (through town anyway)
    wait(BACK);
  }
  wait(WALK);
  if (p.hp < p.maxHp * 0.6) rest();
  sp[0]++; sp[1] += (state.now - t0) / 60000; sp[2] += drunk - d0; sp[3] += low;
  return won;
}
const hunt = (pack, n) => { for (let i = 0; i < n; i++) fight(pack); };
// A leader: only with full health; killed by it, a careful player grows a level first (and buys potions with what that
// brings in), then tries again, till it falls (the quest wants it).
function boss(pack) {
  for (let tries = 0; tries < 6; tries++) {
    rest();
    if (fight(pack)) return;
    const was = where; grind(p.level + 1); shop(carry() + 3); where = was;
  }
  throw new Error(`${pack[0]}: six deaths`);
}
// A quest taken in town (talking and walking for it: `talk` minutes), with potions bought for it on the way out.
const take = (talk = 3) => { wait(talk * 60000); shop(carry() + 3); };

// A quest handed in (or a step done) with the game's own reward: talking and walking for it take `talk` minutes,
// in town (so it shops on the way).
function finish(id, talk = 3) {
  wait(talk * 60000);
  p.quests[id] = { status: 'active', step: run(`questSteps(QUESTS.${id}).length`) - 1, kills: {} };
  ctx.advanceQuest(id);
  if (state.questState(id) !== 'done') throw new Error(`${id} did not finish`);
  shop(carry());
}
const page = n => { if (!p.chests[`chronicle_${n}`]) ctx.chronicleRead(n); }; // a page of the Chronicle, on the way

// The watch's hunts: free again 20 minutes after the last; each guard's own, once his gate's task is done.
const WATCH = [['task_north', 'gate_north', ['goblin', 'goblin', 'goblin'], 5], ['task_east', 'gate_east', ['spider', 'spider', 'spider'], 4],
  ['task_west', 'gate_west', ['wolf', 'wolf', 'wolf'], 3], ['task_south', 'gate_south', ['crab', 'crab'], 3]];
function watchHunt() {
  const free = WATCH.find(([id, gate, , level]) => {
    const s = p.quests[id], q = QUESTS[id];
    return p.level >= Math.max(level, q.level) && state.questState(gate) === 'done' && (!s || state.now >= s.doneAt + q.repeat);
  });
  if (!free) return false;
  const [id, , pack] = free, want = Object.values(QUESTS[id].kill)[0];
  where = id;
  wait(2 * 60000); // to the gate and out
  for (let n = 0; n < want; n += pack.length) fight(pack);
  finish(id, 2);
  return true;
}

// Where someone of each level hunts on Oakvale Isle.
const AREA = { 1: ['rat', 'rat'], 2: ['rat', 'giant_rat'], 3: ['wolf', 'wolf', 'wolf'], 4: ['spider', 'spider', 'spider'], 5: ['goblin', 'goblin', 'goblin'],
  6: ['skeleton', 'skeleton', 'skeleton'], 7: ['skeleton', 'skeleton', 'skeleton'], 8: ['bear', 'bear'], 9: ['bear', 'bear'] };
// To a level: the watch's hunts when one is free, else the hunting ground of your level (or, killed there at this
// level, a careful player goes back to the one before it till the next level).
const tooHard = new Set();
function grind(level) {
  while (p.level < level) {
    if (watchHunt()) continue;
    let l = Math.min(p.level, 9);
    while (l > 1 && tooHard.has(`${p.level}:${l}`)) l--;
    where = `level ${p.level}${l < p.level ? ` (level ${l}'s ground)` : ''}`;
    const before = deaths;
    fight(AREA[l]);
    if (deaths > before) tooHard.add(`${p.level}:${l}`);
  }
}
const section = (name, fn) => { where = name; fn(); };

// ---- the route: the guide's order (game-guide.js), the quests as in npcs.js -----------------------------------------
section('bell_1', () => {
  wait(5 * 60000);                               // the temple, the academy: The Silent Bell I begins
  equip('head', 'leather_cap');                  // (the guide's present, from Master Corwin)
  hunt(AREA[1], 3);                              // five rats in Sunny Fields
  finish('bell_1', 8);                           // Corwin, the depot, Pip, back to Ama
  const bag = p.equipment.backpack; ctx.removeItem('backpack', 1); // the backpack from Ama, with the bag's things in it
  p.equipment.backpack = { id: 'backpack', count: 1, contents: bag.contents };
});
section('to level 2', () => grind(2));
section('cellar_shield', () => {                  // the Rats' Hoard: the sewers, five rats, the shield in the storeroom
  take(3); hunt(['rat', 'rat'], 3); equip('shield', 'wooden_shield'); finish('cellar_shield', 3);
});
section('clang_rescue', () => {                   // Clang: three rats in the bell cellar, the crate, back to Ama
  take(2); hunt(['rat', 'rat'], 2); finish('clang_rescue', 3);
});
section('gate_west', () => {                      // Bram: 8 wolves and Greyfang
  take(3); hunt(['wolf', 'wolf', 'wolf'], 3); boss(['greyfang', 'wolf']); finish('gate_west', 3); equip('body', 'leather_armor');
});
section('to level 3', () => grind(3));
section('gate_south', () => {                     // Tilda: 6 crabs and Old Snapper
  take(3); hunt(['crab', 'crab'], 3); boss(['old_snapper', 'crab']); finish('gate_south', 4); equip('legs', 'leather_legs');
});
section('to level 4', () => grind(4));
section('gate_east', () => {                      // Hilde: 8 spiders and the Thornmother
  take(3); hunt(['spider', 'spider', 'spider'], 3); boss(['thornmother', 'spider']); finish('gate_east', 4); equip('head', 'chain_helmet');
});
section('to level 5', () => grind(5));
section('gate_north', () => {                     // Osric: 8 goblins and Gnash (and the Chronicle's page on Goblin Hill)
  take(3); hunt(['goblin', 'goblin', 'goblin'], 3); boss(['gnash', 'goblin']); page(4); finish('gate_north', 4); equip('shield', 'studded_shield');
});
section('bell_2', () => {                         // II: the hall of coffins, a club from the founders' chests, the note, a page
  take(6); hunt(AREA[6], 2); equip('weapon', 'mace'); page(3); finish('bell_2', 6);
});
section('to level 6', () => grind(6));
section('bell_3', () => {                         // III: the drains, the cistern slime, the rope (the rats' nest chest and the
  take(6); hunt(['giant_rat', 'giant_rat', 'giant_rat'], 3); boss(['cistern_slime']); // rotting pack on the way)
  ctx.addItem('gold', 60); ctx.addItem('health_potion', 3); equip('feet', 'leather_boots'); finish('bell_3', 8);
});
section('to level 8', () => grind(8));
section('bell_4', () => {                         // IV: the Gravewaker
  take(6); boss(['gravewaker', 'skeleton']); finish('bell_4', 8); equip('body', 'chain_armor');
});
section('bell_5', () => {                         // V: Keeper Tamsin, the Choir at Lighthouse Point
  take(6); fight(['choir_cultist']); fight(['choir_cultist']); boss(['choir_cantor', 'choir_cultist', 'choir_cultist', 'choir_cultist']); // (the trail's two watch singers, then the band as one)
  finish('bell_5', 6); p.equipment.ring = { id: 'ring_swift', count: 1 };
});
section('to level 10', () => grind(10));
const at10 = levels[9];
section('bell_6', () => finish('bell_6', 10));    // VI: the bell, the farewells (and then the oracle)

console.log(`Oakvale route, seed ${seed}: level 10 after ${at10} minutes (The Silent Bell VI done at ${minutes()})`);
console.log(`  level reached at minute: ${levels.map((m, i) => `${i + 1}: ${m}`).join(', ')}`);
console.log(`  kills: ${Object.entries(kills).map(([k, n]) => `${n} ${k}`).join(', ')}`);
console.log(`  deaths ${deaths}${died.length ? `: ${died.join('; ')}` : ''}`);
console.log(`  potions drunk ${drunk}: bought ${bought} at Pip's (${bought * PRICE} gold), ${fromMarks} for watch marks, the rest from quests, chests and loot; ` +
  `${trips} trips to town for more; ${potions()} left`);
console.log(`  gold: loot sold for ${sold}, food ${spentFood}, gear ${gearSpent} (${gearBought.join(', ') || 'nothing'}), ${p.gold} left; Chronicle pages ${run('chronicleCount()')} of 6`);
console.log(`  skills: club ${p.skills.club.level}, shielding ${p.skills.shielding.level}; Clang level ${p.pet ? p.pet.level : '-'}`);
for (const [k, [n, m, pot, low, dead]] of Object.entries(spent)) {
  console.log(`  ${k.padEnd(48)} ${String(n).padStart(3)} packs, ${(m / n).toFixed(1)} min each, ${(pot / n).toFixed(1)} potions each, down to ${Math.round(low / n * 100)}% health${dead ? `, ${dead} deaths` : ''}`);
}
