'use strict';
// Balance along the Oakvale route: fights with the game's own combat code, a character with the level, gear,
// skill and potions they would have at that point, against a pack of the monsters there. 40 fights each:
// how often you win, how much health is left, how long it takes, how many potions it costs.
//   node tests/balance.js [part of a name]
// Aim: packs leave you at about half health; the bosses (the cistern slime, the Gravewaker) cost potions.
const { loadGame } = require('./harness');
function fight(stage, seed) {
  const game = loadGame({ seed });
  const { ctx, state } = game; const p = state.player, A = state.Actions;
  state.monsters = []; state.map.spawns.length = 0;
  Object.assign(p, { level: stage.level, maxHp: 150 + (stage.level - 1) * 5, home: 'oakvale' });
  p.hp = p.maxHp;
  for (const k of ['club', 'sword', 'axe', 'shielding']) p.skills[k].level = stage.skill;
  p.equipment.weapon = { id: stage.weapon, count: 1 };
  for (const [slot, id] of Object.entries(stage.gear || {})) p.equipment[slot] = { id, count: 1 };
  p.equipment.backpack.contents = [{ id: 'health_potion', count: stage.potions }];
  ctx.teleport({ x: 130, y: 172, z: 8 });
  const ms = [];
  stage.pack.forEach((type, i) => { const m = ctx.spawnMonster({ type, x: p.x + 2 + (i % 2), y: p.y - 1 + i, z: 8 }); if (m) { state.monsters.push(m); ms.push(m); } });
  let t = 0, potions = 0;
  while (t < 120000 && !p.dead && ms.some(m => !m.dead)) {
    for (let i = 0; i < 6; i++) { state.now += 1000 / 60; ctx.updateWorld(); }
    t += 100;
    if (!p.target || !ms.some(m => m.id === p.target && !m.dead)) { const m = ms.find(m => !m.dead); if (m) A.setTarget(m.id); }
    if (p.hp < p.maxHp * 0.35 && state.countItem('health_potion') && t % 1000 === 0) { A.hotkey('h'); potions++; }
  }
  return { won: !p.dead && ms.every(m => m.dead), hp: p.hp / p.maxHp, t, potions };
}
const C = 'leather_cap', S = 'wooden_shield', AR = 'leather_armor', BO = 'leather_boots', LE = 'leather_legs', CH = 'chain_helmet', ST = 'studded_shield';
const stages = [
  { name: 'L1 club, 2 rats', level: 1, skill: 10, weapon: 'wooden_club', potions: 0, pack: ['rat', 'rat'] },
  { name: 'L2 club+cap, rat+giant (sewers)', level: 2, skill: 12, weapon: 'wooden_club', gear: { head: C }, potions: 2, pack: ['rat', 'giant_rat'] },
  { name: 'L2 club+cap, 2 giant rats (drains)', level: 2, skill: 12, weapon: 'wooden_club', gear: { head: C }, potions: 2, pack: ['giant_rat', 'giant_rat'] },
  { name: 'L3 club+cap+shield, 3 giant rats (cistern)', level: 3, skill: 14, weapon: 'wooden_club', gear: { head: C, shield: S }, potions: 2, pack: ['giant_rat', 'giant_rat', 'giant_rat'] },
  { name: 'L3 club+cap+shield, slime', level: 3, skill: 14, weapon: 'wooden_club', gear: { head: C, shield: S }, potions: 2, pack: ['cistern_slime'] },
  { name: 'L3 +armor, 3 wolves (Bram)', level: 3, skill: 15, weapon: 'wooden_club', gear: { head: C, shield: S, body: AR }, potions: 2, pack: ['wolf', 'wolf', 'wolf'] },
  { name: 'L4 +boots, 2 crabs (Tilda)', level: 4, skill: 17, weapon: 'wooden_club', gear: { head: C, shield: S, body: AR, feet: BO }, potions: 2, pack: ['crab', 'crab'] },
  { name: 'L4 +legs, 3 spiders (Hilde)', level: 4, skill: 18, weapon: 'wooden_club', gear: { head: C, shield: S, body: AR, feet: BO, legs: LE }, potions: 2, pack: ['spider', 'spider', 'spider'] },
  { name: 'L5 +helmet, 3 goblins (Osric)', level: 5, skill: 20, weapon: 'wooden_club', gear: { head: CH, shield: S, body: AR, feet: BO, legs: LE }, potions: 3, pack: ['goblin', 'goblin', 'goblin'] },
  { name: 'L6 full, 3 skeletons (crypt)', level: 6, skill: 22, weapon: 'wooden_club', gear: { head: CH, shield: ST, body: AR, feet: BO, legs: LE }, potions: 3, pack: ['skeleton', 'skeleton', 'skeleton'] },
  { name: 'L6 sword, Gravewaker + skeleton', level: 6, skill: 22, weapon: 'short_sword', gear: { head: CH, shield: ST, body: AR, feet: BO, legs: LE }, potions: 4, pack: ['gravewaker', 'skeleton'] },
  { name: 'L8 sword, 2 bears', level: 8, skill: 26, weapon: 'short_sword', gear: { head: CH, shield: ST, body: AR, feet: BO, legs: LE }, potions: 4, pack: ['bear', 'bear'] },
];
const only = process.argv[2];
for (const st of stages) {
  if (only && !st.name.includes(only)) continue;
  const N = 40, r = Array.from({ length: N }, (_, i) => fight(st, i + 1));
  const won = r.filter(x => x.won);
  console.log(`${st.name.padEnd(42)} wins ${String(Math.round(won.length / N * 100)).padStart(3)}%  hp left ${won.length ? Math.round(won.reduce((a, x) => a + x.hp, 0) / won.length * 100) : 0}%  ${(r.reduce((a, x) => a + x.t, 0) / N / 1000).toFixed(0)}s  potions ${(r.reduce((a, x) => a + x.potions, 0) / N).toFixed(1)}`);
}
