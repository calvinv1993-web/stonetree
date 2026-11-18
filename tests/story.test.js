'use strict';
// The whole starter-island story, from a new character to the oracle, played through in several ways, on the real
// game logic: every quest, the guide, the siege and Clang, the recruit's training, the gate watch and its hunts, the farewell and the
// vocation. Each scenario must end with everything done and the guide gone, and may never throw, lose a quest item,
// skip a step or leave the guide pointing nowhere.
//   node tests/story.test.js            (all scenarios)
//   node tests/story.test.js <name>     (one: osric-greet-only, straight, skip-guide, save-load, deaths, out-of-order, restart-guide, two-friends)

const assert = require('assert');
const vm = require('vm');
const { loadGame } = require('./harness');

const only = process.argv[2];

function newGame(seed = 1) {
  const game = loadGame({ seed });
  game.state.monsters = []; // (no wild monsters: the story's kills are counted by hand)
  return game;
}

// A player's way through the story, step by step, for one game (and one player in it)
function driver(game) {
  const { ctx, state, messages } = game;
  const A = state.Actions, run = code => vm.runInContext(code, ctx);
  const p = () => state.player;
  const tick = ms => { for (let t = 0; t < ms; t += 1000 / 30) { state.now += 1000 / 30; ctx.updateWorld(); } };
  const npc = id => state.npcs.find(n => n.npcId === id);
  const go = where => { ctx.teleport(where); tick(150); };
  const talk = (id, ...words) => {
    const n = npc(id); assert(n, `no NPC ${id}`);
    go({ ...ctx.findFreeTile(n.x, n.y, n.z, 2), z: n.z });
    // (the hermit talks only at night)
    if (n.def.nightOnly) while (ctx.daylight() >= 1) tick(60000);
    const at = messages.length;
    A.say('hi'); tick(100);
    for (const w of words) { A.say(w); tick(100); }
    A.say('bye'); tick(200);
    return messages.slice(at).join(' | ');
  };
  const kill = (type, n) => { for (let i = 0; i < n; i++) { ctx.onMonsterKilled(type); run('guideDid("kill")'); } tick(200); };
  const use = (x, y, z) => { go({ ...ctx.findFreeTile(x, y + 1, z, 2) || { x, y: y + 1 }, z }); ctx.useThing(x, y, z); tick(150); };
  const levelTo = l => { const need = run(`xpForLevel(${l})`) - p().xp; if (need > 0) ctx.gainXp(need); tick(100); };
  const wear = id => { const i = p().equipment.backpack.contents.findIndex(it => it.id === id); if (i >= 0) A.useItem({ root: 'bag', path: [i] }); tick(150); };
  const state_ = id => state.questState(id);
  const next = () => { if (p().tutorial) { const st = run('GUIDE[player.tutorial - 1]'); if (st && !st.done && !st.on) A.guideNext(); } tick(100); }; // (a client step: the browser passes it)
  // as a player reading the guide: Next on each step that only explains, and on with what it asks (the cap: wear it)
  const settle = () => { for (let i = 0; i < 40; i++) { const t = p().tutorial; next(); if (p().equipment.backpack.contents.some(it => it.id === 'leather_cap')) wear('leather_cap'); if (p().tutorial === t) break; } };
  return { game, ctx, state, messages, A, run, p, tick, npc, go, talk, kill, use, levelTo, wear, state_, next, settle };
}

// The story's steps, each a function of a driver; between them a scenario may do something (save, die...)
const STEPS = [
  ['the last town, walking', d => { d.next(); const st = d.state.map.start; d.go({ x: st.x, y: st.y + 3, z: st.z }); }],
  ['The Last Town: Ama, Osric', d => { d.talk('ama'); d.talk('ama', 'fight', 'yes'); d.talk('gate_north', 'fight'); }],
  ['The Last Town: the cannons, Clang, fire', d => {
    d.go({ x: 106, y: 95, z: 9 });
    for (const c of [[105, 94, 9], [116, 94, 9], [138, 94, 9], [101, 95, 10]]) d.use(...c);
    d.use(115, 94, 9); d.use(116, 94, 9); d.talk('gate_north', 'fight');
  }],
  ['The Recruit: the dummy, the cap', d => { // (a dummy with a free tile north of it: a friend may be training at the first)
    d.talk('corwin', 'fighter', 'yes');
    for (let y = 133; y <= 143; y++) for (let x = 140; x <= 150; x++) {
      const t = d.state.map.get(x, y, 8);
      if (!t || !t.items.includes('dummy') || !d.state.isFree(x, y - 1, 8) || (d.p().quests.recruit.hits || 0) >= 10) continue;
      d.go({ x, y: y - 1, z: 8 }); if (d.p().x !== x) continue;
      d.ctx.useThing(x, y, 8); d.tick(25000);
    }
    d.go({ x: 126, y: 121, z: 8 }); d.talk('corwin', 'fighter'); d.wear('leather_cap');
  }],
  ['The Recruit: Ned\'s rats, down a grate', d => {
    d.talk('oak_farmer', 'rats'); const [x, y] = d.run('OAKVALE.grates[0]'); d.go({ x, y, z: 7 }); d.wear('farm_torch');
    d.kill('rat', 1); d.p().fedUntil = d.state.now + 99999; d.tick(100); d.next();
    d.p().openPile = { corpse: 'blood' }; d.tick(100); d.p().openPile = null; d.next();
    d.kill('rat', 4); d.go({ x: x + 2, y, z: 8 }); d.talk('oak_farmer', 'rats');
  }],
  ['The Recruit: Pip, Hobb, Corwin', d => {
    d.p().chests.guide_bought = d.p().chests.guide_sold = true; d.talk('pip', 'supplies');
    d.p().depot.contents.push({ id: 'apple', count: 1 }); d.talk('postmaster', 'locker');
    d.talk('corwin', 'fighter'); d.wear('wooden_shield');
  }],
  ['level 2, Torchlight', d => { d.levelTo(2); d.A.say('lumen'); d.tick(300); }],
  ['the gate watch', d => {
    // west: Greyfang's pack and Greyfang (his pelt); south: Wendel off his rock (wherever he is: a friend may have sent
    // him home already); east: four nests (one a friend burnt is spun again after a while); north: Gnash's war plans
    const deeds = {
      gate_west: () => { d.kill('wolf', 4); d.kill('greyfang', 1); },
      gate_south: () => d.talk('oak_stranded', 'help'),
      gate_east: () => {
        for (const [x, y] of d.run('GATE_SITES.nests')) {
          d.go({ x, y: y + 1, z: 8 });
          if (!d.state.map.get(x, y, 8).items.includes('spider_nest')) { d.state.now += 11 * 60000; d.tick(100); }
          d.ctx.burnThing(x, y, 8); d.tick(100);
        }
      },
      gate_north: () => d.use(198, 70, 8),
    };
    for (const [id, word, level] of [['gate_west', 'wolves', 2], ['gate_south', 'crabs', 3], ['gate_east', 'spiders', 4], ['gate_north', 'goblins', 5]]) {
      d.levelTo(level); d.talk(id, word, 'yes'); deeds[id](); d.talk(id, word);
    }
  }],
  ['a watch hunt and the stores', d => { d.talk('gate_west', 'hunt', 'yes'); d.kill('wolf', 10); d.talk('gate_west', 'hunt'); d.talk('gate_north', 'potions'); }],
  ['bell III: farewell', d => { d.levelTo(10); d.talk('ama', 'farewell', 'yes'); d.go({ x: 145, y: 103, z: 13 }); d.state.now += 60000; d.ctx.ringBell(); d.tick(100);
    for (const id of ['corwin', 'pip', 'gate_north']) d.talk(id, 'farewell'); d.talk('ama', 'farewell'); }],
  ['the oracle', d => {
    // (a guide still on has followed the whole story: it's on its last step, the oracle)
    if (d.p().tutorial && !d.p().guideSkipped) assert.strictEqual(d.p().tutorial, d.run('GUIDE.length'), `the guide got stuck on step ${d.p().tutorial}: ${d.run('GUIDE[player.tutorial - 1].text').slice(0, 60)}`);
    const said = d.talk('oak_oracle', 'destiny', 'knight', 'yes'); d.tick(3500);
    // (no mainland yet: an honest farewell, and you stay on the isle as Oakvale's own)
    assert(/has not come yet/.test(said) && !/mainland|Orin|Valoria|dream/.test(said), `the oracle's farewell: ${said}`);
    assert(d.p().home === 'start' && d.p().z >= 8 && d.run('homeTown()') === 'Oakvale', 'still on Oakvale Isle, waking in its temple');
  }],
];

const DONE = ['last_town', 'recruit', 'gate_west', 'gate_south', 'gate_east', 'gate_north', 'bell_6'];

// What must hold after each step, whatever the scenario
function check(d, name) {
  d.settle();
  const p = d.p();
  // the guide, while it's on, always has something to say, and on a step with somewhere to go, an arrow
  if (p.tutorial) assert(d.run('GUIDE[player.tutorial - 1]'), `${name}: the guide is on a step that doesn't exist (${p.tutorial})`);
  // no quest stands on a step that doesn't exist
  for (const [id, q] of Object.entries(p.quests)) if (q.status === 'active') assert(d.run(`questSteps(QUESTS['${id}'])[${q.step || 0}]`), `${name}: ${id} on a missing step`);
}

function finished(d, name) {
  const p = d.p();
  for (const id of DONE) assert.strictEqual(d.state_(id), 'done', `${name}: ${id} not done`);
  assert(p.pet && p.pet.kind === 'cat', `${name}: no Clang`);
  assert.strictEqual(p.vocation, 'knight', `${name}: no vocation`);
  assert.strictEqual(p.tutorial, 0, `${name}: the guide is still on`);
  assert(p.equipment.shield && p.equipment.head, `${name}: lost the starter gear (${JSON.stringify([p.equipment.shield, p.equipment.head, p.tutorial, p.chests.guide_kit, p.equipment.backpack.contents.map(i => i.id)])})`);
}

const SCENARIOS = {
  // greeting Osric without asking to fight: no siege yet, and the guide waits for him (never "done"); cannons do nothing
  'osric-greet-only': () => {
    const d = driver(newGame(8));
    for (const [n, f] of STEPS.slice(0, 1)) { f(d); check(d, n); }
    d.talk('ama', 'fight', 'yes'); d.talk('gate_north'); d.settle();
    const at = d.p().tutorial;
    d.use(105, 94, 9); d.use(115, 94, 9); d.settle();
    assert.strictEqual(d.p().tutorial, at, 'the guide waits at Osric');
    assert(!d.ctx.siegeScene() && !d.p().pet && !(d.p().quests.last_town.loaded || []).length, 'no siege, no cannons, no Clang yet');
    assert(/Osric/.test(d.run('(GUIDE[player.tutorial - 1].touch || "")')), 'still on the step to talk to him');
  },
  // as the guide leads
  straight: () => { const d = driver(newGame()); for (const [n, f] of STEPS) { f(d); check(d, n); } finished(d, 'straight'); },
  // the guide skipped at once: the story is the same
  'skip-guide': () => { const d = driver(newGame(2)); d.A.skipGuide(); assert.strictEqual(d.p().tutorial, 0);
    for (const [n, f] of STEPS) { f(d); check(d, n); } finished(d, 'skip-guide'); },
  // saved and loaded into a new game after every step (a closed browser, a restarted server)
  'save-load': () => {
    let d = driver(newGame(3));
    for (const [n, f] of STEPS) {
      f(d); check(d, n);
      const save = d.ctx.serializePlayer(d.p()), record = JSON.stringify(d.state.townRecord);
      const fresh = driver(newGame(3)); fresh.state.now = d.state.now; fresh.ctx.applySave(JSON.parse(JSON.stringify(save)));
      fresh.state.townRecord = JSON.parse(record); fresh.tick(200); d = fresh;
      check(d, `${n} (after loading)`);
    }
    finished(d, 'save-load');
  },
  // dying after every step: before a vocation you keep your things, your quests and your level
  deaths: () => {
    const d = driver(newGame(4));
    for (const [n, f] of STEPS) {
      f(d); check(d, n);
      if (d.p().vocation !== 'none') continue;
      const level = d.p().level, quests = JSON.stringify(d.p().quests), bag = d.p().equipment.backpack.contents.length;
      d.ctx.playerDies({ type: 'wolf', name: 'wolf', def: d.state.MONSTERS.wolf }); d.tick(3500);
      assert(!d.p().dead, `${n}: still dead`);
      assert.strictEqual(d.p().level, level, `${n}: a level lost before a vocation`);
      assert.strictEqual(JSON.stringify(d.p().quests), quests, `${n}: quests changed by dying`);
      assert.strictEqual(d.p().equipment.backpack.contents.length, bag, `${n}: things lost by dying`);
    }
    finished(d, 'deaths');
  },
  // trying everything too early: nothing opens, nothing is skipped, nothing breaks
  'out-of-order': () => {
    const d = driver(newGame(5));
    for (const [x, y, z] of [[105, 94, 9], [115, 94, 9], [116, 94, 9]]) d.use(x, y, z);
    for (const [id, word] of [['gate_north', 'fight'], ['corwin', 'fighter'], ['ama', 'farewell'], ['oak_farmer', 'rats'], ['pip', 'supplies'], ['postmaster', 'locker'],
      ['gate_north', 'goblins'], ['oak_oracle', 'knight']]) d.talk(id, word, 'yes');
    d.ctx.ringBell();
    assert.strictEqual(d.p().vocation, 'none', 'no vocation at level 1');
    for (const id of DONE) if (id !== 'last_town') assert.strictEqual(d.state_(id), 'none', `out-of-order: ${id} taken too early`); // (Ama offers the first whatever you ask)
    assert.strictEqual(d.p().quests.last_town.step, 0, 'out-of-order: still asking Osric to fight');
    for (const it of ['wooden_shield', 'leather_cap', 'farm_torch']) assert.strictEqual(d.state.countItem(it), 0, `out-of-order: ${it} taken too early`);
    assert(!d.p().pet && !d.ctx.siegeScene(), 'out-of-order: no Clang, no siege');
    for (const [n, f] of STEPS) { f(d); check(d, n); } finished(d, 'out-of-order');
  },
  // the guide started again half way: what's done passes, the rest goes on
  'restart-guide': () => { const d = driver(newGame(6));
    for (const [i, [n, f]] of STEPS.entries()) { f(d); check(d, n); if (i === 9) { d.A.restartGuide(); for (let k = 0; k < 40; k++) d.next(); } }
    finished(d, 'restart-guide'); },
  // two friends on one server: each plays the story; the bell is shared
  'two-friends': () => {
    const game = newGame(7), { ctx, state } = game;
    const second = vm.runInContext('newPlayer("Friend")', ctx);
    vm.runInContext('(p => { players.push(p); teleport.call(null, map.start); })', ctx)(second);
    Object.assign(second, { x: state.map.start.x, y: state.map.start.y, z: state.map.start.z });
    const d1 = driver(game);
    for (const [n, f] of STEPS) {
      f(d1); check(d1, `Ana: ${n}`);
      vm.runInContext('(p, fn) => asPlayer(p, fn)', ctx)(second, () => { f(d1); check(d1, `Friend: ${n}`); if (process.env.TRACE) console.log(n, second.tutorial, second.trainHits, state.player === second, vm.runInContext('GUIDE[' + (second.tutorial - 1) + '].text.slice(0,40)', ctx)); });
    }
    finished(d1, 'Ana');
    vm.runInContext('(p, fn) => asPlayer(p, fn)', ctx)(second, () => finished(d1, 'Friend'));
    assert(second.pet && second.pet.name === 'Clang' && state.player.pet, 'each found Clang on the wall');
  },
};

let pass = 0, fail = 0;
for (const [name, fn] of Object.entries(SCENARIOS)) {
  if (only && name !== only) continue;
  try { fn(); pass++; console.log(`  ok   ${name}`); } catch (e) { fail++; console.log(`  FAIL ${name}\n${e.stack.split('\n').slice(0, 4).join('\n')}`); }
}
console.log(fail ? `${fail} failed, ${pass} passed` : `all ${pass} passed`);
process.exit(fail ? 1 : 0);
