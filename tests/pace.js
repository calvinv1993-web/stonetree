'use strict';
// How long the Oakvale route takes, from level 1 to 10: one character plays it with the game's own combat code.
// It hunts packs of the monsters where someone of its level would hunt, walks between them, rests when hurt
// (eating, so it heals as a player who eats does), drinks a potion when low, does the quests along the way (their
// experience, gear and bosses, and the time spent walking and talking for them), and trains its skills as it
// fights. Prints when each level is reached, and the deaths, potions and skills.
//   node tests/pace.js [seed=1]
// Aim: about 2.5 hours (150 minutes) to level 10.

const { loadGame } = require('./harness');

const seed = +(process.argv[2] || 1);
const game = loadGame({ seed });
const { ctx, state } = game;
const p = state.player, A = state.Actions;
state.monsters = [];
state.map.spawns.length = 0; // only the packs below
Object.assign(p, { tutorial: 0, home: 'oakvale' });

const ARENA = { x: 130, y: 172, z: 8 }; // open ground in Sunny Fields
const WALK = 15000;                     // between one pack and the next
let deaths = 0, potions = 0;
const kills = {}, spent = {}; // per pack: [packs, minutes, potions]
const minutes = () => Math.round(state.now / 6000) / 10;
const step = ms => { for (let t = 0; t < ms; t += 50) { state.now += 50; ctx.updateWorld(); } };
const wait = ms => { const end = state.now + ms; while (state.now < end) { state.now += 500; ctx.updateWorld(); } };
const equip = (slot, id) => { p.equipment[slot] = { id, count: 1 }; };

// Rest (eating) until nearly healed, as a player would before the next pack.
function rest() {
  p.fedUntil = state.now + 3600000;
  const end = state.now + 300000;
  while (p.hp < p.maxHp * 0.9 && state.now < end) wait(1000);
}

// One pack: spawn it round you, fight it to the end.
function fight(pack) {
  const key = pack.join('+'), t0 = state.now, p0 = potions;
  ctx.teleport(ARENA);
  const ms = [];
  pack.forEach((type, i) => {
    const m = ctx.spawnMonster({ type, x: ARENA.x + 2 + (i % 2), y: ARENA.y - 1 + i, z: ARENA.z });
    if (m) { state.monsters.push(m); ms.push(m); }
  });
  const end = state.now + 240000;
  while (!p.dead && ms.some(m => !m.dead) && state.now < end) {
    if (!p.target || !ms.some(m => m.id === p.target.id && !m.dead)) { const m = ms.find(m => !m.dead); if (m) A.setTarget(m.id); }
    if (p.hp < p.maxHp * 0.3 && state.countItem('health_potion') === 0) ctx.addItem('health_potion', 1);
    if (p.hp < p.maxHp * 0.3 && state.now % 1000 < 50) { A.hotkey('h'); potions++; }
    step(100);
  }
  for (const m of ms) if (m.dead) kills[m.type] = (kills[m.type] || 0) + 1;
  state.monsters = [];
  state.piles.length = 0;
  if (p.dead) { // you wake in the temple, and walk back out
    deaths++;
    Object.assign(p, { dead: false, hp: p.maxHp });
    wait(180000);
  }
  wait(WALK);
  if (p.hp < p.maxHp * 0.6) rest();
  const sp = spent[key] || (spent[key] = [0, 0, 0]);
  sp[0]++; sp[1] += (state.now - t0) / 60000; sp[2] += potions - p0;
}
const hunt = (pack, n) => { for (let i = 0; i < n; i++) fight(pack); };
const huntTill = (pack, level) => { while (p.level < level) fight(pack); };
const quest = (xp, talkMinutes) => { wait(talkMinutes * 60000); if (xp) ctx.gainXp(xp); };

// Where someone of each level hunts on Oakvale Isle.
const AREA = { 1: ['rat', 'rat'], 2: ['rat', 'giant_rat'], 3: ['wolf', 'wolf', 'wolf'], 4: ['spider', 'spider', 'spider'], 5: ['goblin', 'goblin', 'goblin'],
  6: ['skeleton', 'skeleton', 'skeleton'], 7: ['skeleton', 'skeleton', 'skeleton'], 8: ['goblin', 'goblin', 'goblin'], 9: ['bear', 'bear'] };
const levels = [];
const track = () => { while (levels.length < p.level) levels.push(minutes()); };


// The route.
quest(0, 5);                                    // the temple, the academy: The Silent Bell I begins
hunt(AREA[1], 3); track();                      // five rats in Sunny Fields
quest(0, 6); quest(120, 0); track();            // the depot, Pip, back to Ama: The Silent Bell I
huntTill(AREA[1], 2); track();
quest(0, 4);                                    // The Silent Bell II: down into the sewers
equip('head', 'leather_cap');                   // the chest in the old storeroom
hunt(['rat', 'giant_rat'], 4); track();         // the sewers
equip('shield', 'wooden_shield');               // the chest in the old drains
hunt(['giant_rat', 'giant_rat'], 4); track();   // the old drains
hunt(['giant_rat', 'giant_rat', 'giant_rat'], 3); track(); // the cistern
fight(['cistern_slime']); track();              // the slime by the shaft
equip('body', 'leather_armor');
quest(200, 6); track();                         // back up to Ama, and to Corwin with the stone
huntTill(AREA[2], 3); track();
quest(0, 3); hunt(AREA[3], 3); quest(250, 3); equip('feet', 'leather_boots'); track();          // Bram: 8 wolves
quest(0, 3); hunt(['crab', 'crab'], 3); quest(300, 3); equip('legs', 'leather_legs'); track();  // Tilda: 6 crabs
huntTill(AREA[3], 4); track();
quest(0, 3); hunt(AREA[4], 3); quest(450, 3); equip('head', 'chain_helmet'); track();          // Hilde: 8 spiders
huntTill(AREA[4], 5); track();
quest(0, 3); hunt(AREA[5], 3); quest(700, 3); equip('shield', 'studded_shield'); track();     // Osric: 8 goblins
huntTill(AREA[5], 6); track();
quest(0, 6);                                    // The Silent Bell III: to Bone Rocks and down
hunt(AREA[6], 3); equip('weapon', 'spiked_club'); hunt(AREA[6], 2); track(); // the crypt, and a weapon from it (a club: it keeps your skill)
fight(['gravewaker', 'skeleton']); track();     // the founder's tomb
quest(700, 8); track();                         // back to Ama with the clapper
for (let l = p.level; l < 10; l = p.level) { huntTill(AREA[l], l + 1); track(); }


console.log(`Oakvale route, seed ${seed}: level 10 after ${minutes()} minutes`);
console.log(`  level reached at minute: ${levels.map((m, i) => `${i + 1}: ${m}`).join(', ')}`);
console.log(`  kills: ${Object.entries(kills).map(([k, n]) => `${n} ${k}`).join(', ')}`);
console.log(`  deaths ${deaths}, potions ${potions}; skills: club ${p.skills.club.level}, sword ${p.skills.sword.level}, shielding ${p.skills.shielding.level}`);
for (const [k, [n, m, pot]] of Object.entries(spent)) console.log(`  ${k.padEnd(28)} ${String(n).padStart(3)} packs, ${(m / n).toFixed(1)} min each, ${(pot / n).toFixed(1)} potions each`);
