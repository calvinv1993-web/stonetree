'use strict';
// The Hawk's balance along the Oakvale route: fights with the game's own combat code, a Hawk with the level, bow, skill,
// gear, potions and skill tree they would have at that point (their points spent as a player would: the Volley first,
// then the Shot, the Falcon's Mark), against one monster of a kind, and against a pack. 30 fights each:
//   attacks   how many it took: plain shots and skills together (the aim: a monster of your level in 4 to 6)
//   skills    how many of those were skills
//   time      seconds the fight took
//   hp left   health left, of the fights won; potions drunk; wins
//   node tests/hawk-balance.js [part of a name] [--plain]   (--plain: no skills, plain shots only, to compare)
const { loadGame } = require('./harness');

const plainOnly = process.argv.includes('--plain');
// the order a Hawk spends their points in (each entry: one rank; skipped while it can't be learned yet)
const BUILD = ['double_shot', 'double_shot', 'double_shot', 'power_shot', 'power_shot', 'power_shot', 'falcon_mark',
  'triple_shot', 'triple_shot', 'triple_shot', 'gale_shot', 'gale_shot', 'gale_shot', 'falcon_mark', 'falcon_mark', 'sharp_eye', 'sharp_eye'];

function fight(stage, seed) {
  const game = loadGame({ seed });
  const { ctx, state } = game; const p = state.player, A = state.Actions;
  state.monsters = []; state.map.spawns.length = 0;
  const L = stage.level;
  Object.assign(p, { vocation: 'paladin', oracle: L >= 10, level: L, maxHp: 150 + (L - 1) * 10, maxMana: 50 + (L - 1) * 15, home: 'oakvale', chase: false });
  p.hp = p.maxHp; p.mana = p.maxMana;
  p.skills.distance.level = stage.skill;
  p.skills.magic.level = Math.floor(L / 2);
  p.equipment.weapon = { id: stage.bow || 'bow', count: 1 };
  p.equipment.ammo = { id: 'arrow', count: 500 };
  p.equipment.shield = null;
  for (const [slot, id] of Object.entries(stage.gear || {})) p.equipment[slot] = { id, count: 1 };
  p.equipment.backpack.contents = [{ id: 'health_potion', count: stage.potions }, { id: 'mana_potion', count: stage.potions }];
  p.skillRanks = {};
  if (!plainOnly) for (const id of BUILD) if (!ctx.cantLearn(p, id)) A.learnRank(id);
  ctx.teleport({ x: 130, y: 172, z: 8 });
  const ms = [];
  stage.pack.forEach((type, i) => { const m = ctx.spawnMonster({ type, x: p.x + 4 + (i % 2), y: p.y - 1 + i, z: 8 }); if (m) { state.monsters.push(m); ms.push(m); } });
  let t = 0, potions = 0, skills = 0;
  const arrows0 = p.equipment.ammo.count;
  let skillArrows = 0;
  while (t < 180000 && !p.dead && ms.some(m => !m.dead)) {
    for (let i = 0; i < 6; i++) { state.now += 1000 / 60; ctx.updateWorld(); }
    t += 100;
    const target = ms.find(m => m.id === (p.target && p.target.id) && !m.dead);
    if (!target) { const m = ms.find(m => !m.dead); if (m) A.setTarget(m.id); }
    if (p.hp < p.maxHp * 0.35 && state.countItem('health_potion') && t % 1000 === 0) { A.hotkey('h'); potions++; }
    // skills, as a player would: the falcon's mark on a fresh target, then the volley, then the shot
    if (!plainOnly && p.target && state.now >= (p.spellReady || 0)) {
      const marked = p.target.conditions && p.target.conditions.marked && state.now < p.target.conditions.marked.until;
      for (const anchor of [!marked && 'falcon_mark', 'double_shot', 'power_shot']) {
        if (!anchor) continue;
        const id = ctx.lineSpell(p, anchor);
        if (!id) continue;
        const s = state.SPELLS[id];
        if (p.mana < s.mana || state.now < ((p.spellCooldowns || {})[id] || 0)) continue;
        const before = p.equipment.ammo.count, readyBefore = p.spellReady;
        A.castSpell(anchor);
        if (p.spellReady !== readyBefore) { skills++; skillArrows += before - p.equipment.ammo.count; break; }
      }
      if (p.mana < p.maxMana * 0.2 && state.countItem('mana_potion') && t % 1000 === 0) A.hotkey('m');
    }
  }
  const plain = arrows0 - p.equipment.ammo.count - skillArrows;
  return { won: !p.dead && ms.every(m => m.dead), hp: p.hp / p.maxHp, t, potions, attacks: (plain + skills) / ms.length, skills: skills / ms.length };
}

const C = 'leather_cap', AR = 'leather_armor', BO = 'leather_boots', LE = 'leather_legs', CH = 'chain_helmet';
const stages = [
  { name: 'L1, a rat', level: 1, skill: 10, potions: 0, pack: ['rat'] },
  { name: 'L2, a giant rat', level: 2, skill: 12, gear: { head: C }, potions: 2, pack: ['giant_rat'] },
  { name: 'L3, a wolf', level: 3, skill: 14, gear: { head: C, body: AR }, potions: 2, pack: ['wolf'] },
  { name: 'L3, 3 wolves (Bram)', level: 3, skill: 14, gear: { head: C, body: AR }, potions: 2, pack: ['wolf', 'wolf', 'wolf'] },
  { name: 'L4, a crab', level: 4, skill: 16, gear: { head: C, body: AR, feet: BO }, potions: 2, pack: ['crab'] },
  { name: 'L4, a spider', level: 4, skill: 17, gear: { head: C, body: AR, feet: BO, legs: LE }, potions: 2, pack: ['spider'] },
  { name: 'L5, a goblin', level: 5, skill: 19, gear: { head: CH, body: AR, feet: BO, legs: LE }, potions: 3, pack: ['goblin'] },
  { name: 'L5, 3 goblins (Osric)', level: 5, skill: 19, gear: { head: CH, body: AR, feet: BO, legs: LE }, potions: 3, pack: ['goblin', 'goblin', 'goblin'] },
  { name: 'L6, a skeleton', level: 6, skill: 21, gear: { head: CH, body: AR, feet: BO, legs: LE }, potions: 3, pack: ['skeleton'] },
  { name: 'L6, the Gravewaker', level: 6, skill: 21, gear: { head: CH, body: AR, feet: BO, legs: LE }, potions: 4, pack: ['gravewaker'] },
  { name: 'L8, a bear', level: 8, skill: 25, bow: 'hawkeye_bow', gear: { head: CH, body: AR, feet: BO, legs: LE }, potions: 4, pack: ['bear'] },
  { name: 'L8, the Old Weaver', level: 8, skill: 25, bow: 'hawkeye_bow', gear: { head: CH, body: AR, feet: BO, legs: LE }, potions: 5, pack: ['old_weaver'] },
  { name: 'L10, King Mogg', level: 10, skill: 28, bow: 'hawkeye_bow', gear: { head: CH, body: AR, feet: BO, legs: LE }, potions: 5, pack: ['king_mogg'] },
];
const only = process.argv.slice(2).find(a => !a.startsWith('--'));
console.log(`${plainOnly ? 'plain shots only' : 'with the skill tree'} (aim: a monster of your level in 4 to 6 attacks)`);
console.log(`${'fight'.padEnd(30)} wins  hp left  time  attacks (skills)  potions`);
for (const st of stages) {
  if (only && !st.name.includes(only)) continue;
  const N = 30, r = Array.from({ length: N }, (_, i) => fight(st, i + 1)), won = r.filter(x => x.won);
  const avg = k => r.reduce((a, x) => a + x[k], 0) / N;
  console.log(`${st.name.padEnd(30)} ${String(Math.round(won.length / N * 100)).padStart(3)}%  ${String(won.length ? Math.round(won.reduce((a, x) => a + x.hp, 0) / won.length * 100) : 0).padStart(6)}%  ${(avg('t') / 1000).toFixed(0).padStart(3)}s  ${avg('attacks').toFixed(1).padStart(7)} (${avg('skills').toFixed(1)})  ${avg('potions').toFixed(1).padStart(7)}`);
}
