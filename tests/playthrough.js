'use strict';
// A bot plays Oakvale Isle as a player would, from a new character to level 10, on the real world with all its
// monsters: it walks with the game's own pathfinding (over floors, through doors), talks to the NPCs with the
// words they offer, hunts in the real hunting grounds, picks up gold, buys potions and food at Pip's with its
// own money (and at Captain Osric's for watch marks), buys armour at Brenna's when it can, rests to full before a
// fight, only takes on a monster with at most one other close by (and looks for a quieter spot otherwise), goes back
// to town for potions when it runs out or after dying, and follows the guide's route as a careful player would: The
// Last Town (the cannons and Clang, who then fights along) and The Recruit, the gate watch from level 2 to 5, the
// watch's hunts from level 3 whenever one is free, the crypt, the drains and the Gravewaker, the Chronicle pages on the
// way, the farewell and the oracle. It reports when things happen, how long each part took, deaths, money, and anything it got stuck on.
//   node tests/playthrough.js [seed=1] [hours=5] [lazy]

const { loadGame } = require('./harness');
const vm = require('vm');

const seed = +(process.argv[2] || 1), hours = +(process.argv[3] || 5);
// lazy: plays as someone who doesn't bother: buys nothing, never rests or heals with spells, fights whatever is there
const lazy = process.argv[4] === 'lazy';
const game = loadGame({ seed });
const { ctx, state, messages } = game;
const run = code => vm.runInContext(code, ctx);
const p = state.player, A = state.Actions, map = state.map, THINGS = state.THINGS;
p.tutorial = 1;
const END = hours * 3600000;
const min = () => (state.now / 60000).toFixed(1);
const problems = [];
const note = text => { console.log(`${min().padStart(6)}  L${p.level}  ${text}`); }; // as it happens, so a long run can be followed
const problem = text => { problems.push(`${min()} min, level ${p.level}: ${text}`); note(`!! ${text}`); };
let deaths = 0, potionsBought = 0, potionsFromMarks = 0, goldSpent = 0, killsTotal = 0;
const levelAt = {};

// ---- time ----------------------------------------------------------------------------------------------------
class Timeout extends Error {}
function tick() {
  state.now += 50;
  ctx.updateWorld();
  if (p.dead) onDeath();
  if (!levelAt[p.level]) { levelAt[p.level] = min(); if (p.level > 1) note(`level ${p.level}`); }
  if (state.now > END) throw new Timeout();
}
const wait = ms => { const end = state.now + ms; while (state.now < end) { tick(); fightBack(); } };
let needShop = false; // out of potions, or just died: to town first
function onDeath() {
  deaths++;
  needShop = true;
  const by = state.monsters.filter(m => !m.dead && m.z === p.z && Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) <= 4).map(m => m.type);
  problem(`died near ${p.x},${p.y},${p.z}, with ${by.join(', ') || 'nothing'} round (${state.countItem('health_potion')} potions left)`);
  while (p.dead) { state.now += 50; ctx.updateWorld(); }
}

// ---- walking over floors: a search over every floor, floor changes as the game takes them -----------------------
const key = (x, y, z) => `${x},${y},${z}`;
const walkable = (x, y, z) => {
  const t = map.get(x, y, z);
  if (!t || !t.ground || THINGS[t.ground].block) return false;
  return !t.items.some(id => THINGS[id].block && !THINGS[id].toggle && !THINGS[id].houseDoor && !((THINGS[id].questDoor || THINGS[id].levelDoor) && run(`doorOpenable(${JSON.stringify(id)}, ${x}, ${y}, ${z})`)));
};
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
// Where a floor change at (x, y, z) takes you: the same x, y one floor up or down, or the first free tile beside it.
function landing(x, y, z) {
  const dz = map.floorChange(x, y, z), nz = z + dz;
  for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    if (walkable(x + dx, y + dy, nz) && !map.floorChange(x + dx, y + dy, nz)) return [x + dx, y + dy, nz];
  }
  return null;
}
// (a goal tile is one nobody stands on, and not one a walk there just got stuck on: an NPC idling on the tile next to
// a shopkeeper, or on the landing of a stair, would otherwise send the bot at the same tile again and again)
const stuck = new Set();
const goalTile = (x, y, z) => (x === p.x && y === p.y && z === p.z) || (!stuck.has(key(x, y, z)) && !ctx.creatureAt(x, y, z));
function route(gx, gy, gz, near = 0) {
  const start = key(p.x, p.y, p.z), prev = new Map([[start, null]]), queue = [[p.x, p.y, p.z]];
  for (let i = 0; i < queue.length && i < 200000; i++) {
    const [x, y, z] = queue[i];
    if (z === gz && Math.max(Math.abs(x - gx), Math.abs(y - gy)) <= near && goalTile(x, y, z)) {
      const path = [];
      for (let k = key(x, y, z); k; k = prev.get(k)) path.push(k.split(',').map(Number));
      return path.reverse();
    }
    if (map.floorChange(x, y, z) && !(x === p.x && y === p.y && z === p.z)) {
      const l = landing(x, y, z);
      if (l && !prev.has(key(...l))) { prev.set(key(...l), key(x, y, z)); queue.push(l); }
      continue;
    }
    for (const [dx, dy] of N8) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny, z);
      if (prev.has(k) || !walkable(nx, ny, z)) continue;
      prev.set(k, key(x, y, z));
      queue.push([nx, ny, z]);
    }
  }
  return null;
}
// Walk there (within `near` tiles), floor by floor, as a player clicking ahead would.
function goTo(gx, gy, gz, near = 0, why = '') {
  stuck.clear();
  for (let tries = 0; tries < 60; tries++) {
    if (p.z === gz && Math.max(Math.abs(p.x - gx), Math.abs(p.y - gy)) <= near) return true;
    const path = route(gx, gy, gz, near);
    if (!path) { problem(`no way to ${gx},${gy},${gz} ${why} from ${p.x},${p.y},${p.z}`); wait(5000); return false; }
    // the last tile on this floor before the next floor change (or the goal)
    let target = path[path.length - 1];
    for (let i = 1; i < path.length; i++) if (path[i][2] !== p.z) { target = path[i - 1]; break; }
    for (let i = 1; i < path.length && path[i][2] === p.z; i++) if (map.floorChange(...path[i])) { target = path[i]; break; }
    const leg = path.indexOf(target); if (leg > 30) target = path[30]; // click ahead a stretch at a time, as a player does (a click can't plan the whole isle)
    if (path.length > 1 && !goalTile(...target)) target = path[path.indexOf(target) - 1] || target; // (someone on it: the tile before)
    const z0 = p.z, x0 = p.x, y0 = p.y, tt = map.get(target[0], target[1], p.z);
    if (tt && tt.items.some(id => state.THINGS ? state.THINGS[id].useToClimb : id === 'grate')) A.interact('use', target[0], target[1], p.z); // a grate: you climb down by using it
    else A.walkTo(target[0], target[1]);
    const end = state.now + 120000;
    while (state.now < end && (p.path.length || p.walk)) { tick(); if (fightBack()) break; }
    if (p.z !== z0) continue;
    if (p.x === x0 && p.y === y0) stuck.add(key(target[0], target[1], p.z)); // went nowhere: another tile next time
    if (!p.path.length && !p.walk) wait(300); // (always let time pass)
    if (!p.path.length && !p.walk && !(p.x === target[0] && p.y === target[1]) && !map.floorChange(target[0], target[1], p.z)) wait(300);
  }
  problem(`gave up walking to ${gx},${gy},${gz} ${why}`);
  return false;
}

// ---- fighting ---------------------------------------------------------------------------------------------------
const hostile = m => !m.dead && m.z === p.z && m.def.aggro > 0;
const near = (type, r) => state.monsters.filter(m => hostile(m) && (!type || m.type === type) && Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) <= r)
  .sort((a, b) => Math.max(Math.abs(a.x - p.x), Math.abs(a.y - p.y)) - Math.max(Math.abs(b.x - p.x), Math.abs(b.y - p.y)));
let healsCast = 0, eaten = 0;
const canHeal = () => p.level >= 3 && p.mana >= state.SPELLS.light_heal.mana && state.now >= p.spellReady;
function heal() {
  if (!lazy && p.hp < p.maxHp * 0.7 && canHeal()) { A.castSpell('light_heal'); healsCast++; }
  if (p.hp < p.maxHp * 0.4 && state.countItem('health_potion') && state.now - (p._drank || 0) > 1000) { A.hotkey('h'); p._drank = state.now; }
  if (p.fedUntil < state.now + 5000 && (state.countItem('bread') || state.countItem('apple') || state.countItem('cheese') || state.countItem('meat'))) { A.hotkey('f'); eaten++; }
}
// Something attacking you, or right beside you: fight it to the end. Returns true if it fought.
function fightBack() {
  heal();
  const m = near(null, 1)[0] || state.monsters.find(x => hostile(x) && x.angryAt === p.id && state.now < x.angryUntil && Math.max(Math.abs(x.x - p.x), Math.abs(x.y - p.y)) <= 3);
  if (!m || (p.target && !p.target.dead)) return false;
  kill(m);
  return true;
}
function kill(m) {
  p._switched = p._switched || 0;
  A.setChase(true); // walking yourself turns chase off, as in Tibia: a fleeing wolf would get away
  if (p.target !== m) A.setTarget(m.id); // (attacking your own target again would stop the attack)
  const end = state.now + 180000;
  while (!m.dead && !p.dead && state.now < end && m.z === p.z) {
    tick(); heal();
    if (!p.target && !m.dead && Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) <= 8) A.setTarget(m.id);
    if (!p.target && !m.dead) break; // lost it
    if (Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) > 1 && near(null, 1).length && state.now - p._switched > 3000) { p._switched = state.now; m = near(null, 1)[0]; A.setTarget(m.id); } // one is biting you: that one first
  }
  if (m.dead) {
    killsTotal++;
    const pile = state.piles.filter(x => x.z === p.z && Math.max(Math.abs(x.x - p.x), Math.abs(x.y - p.y)) <= 3).pop();
    if (pile) { // open it, take the gold and everything worth selling, as a player would
      A.lootNearest(pile.id); wait(1200);
      for (let i = pile.items.length - 1; i >= 0; i--) {
        const d = state.ITEMS[pile.items[i].id];
        const bag = p.equipment.backpack, room = state.ITEMS[bag.id].container - (bag.contents || []).length;
        const stacks = (bag.contents || []).some(x => x.id === pile.items[i].id) && d && d.stack;
        const it = pile.items[i], heavy = d && (d.weight || 0) * (it.count || 1);
        const worthIt = d && (it.id === 'gold' || (d.value || 0) >= (d.weight || 0) / 4 || (d.use && d.use.heal)); // not a pile of cheap meat
        if (d && (d.value || d.use) && !d.slot && worthIt && (stacks || room > 2) && run('freeCapacity()') - heavy > 80) A.takeFromPile(pile.id, i); // keep room for what a quest gives
      }
      A.closePile();
    }
  }
}
// Rest until well (eating if you can), when nothing is about.
function rest(to = 0.9) {
  const end = state.now + 600000;
  while (p.hp < p.maxHp * to && state.now < end) { heal(); wait(1000); } // Light Heal and food while you wait
}
// How many other hostile monsters are within r tiles of m: a careful player takes on one pack at a time, not two.
const crowd = (m, r = 4) => state.monsters.filter(o => o !== m && hostile(o) && Math.max(Math.abs(o.x - m.x), Math.abs(o.y - m.y)) <= r).length;
// Hunt `n` of `type` round (cx, cy, cz).
function hunt(type, n, [cx, cy, cz], why) {
  note(`hunting ${n} ${type} (${why})`);
  const end = state.now + 45 * 60000;
  let got = 0;
  const questDone = () => state.QUESTS[why] && state.questState(why) === 'active' && killsLeft(why, type) <= 0; // the quest log counts every kill
  while (got < n && state.now < end && !questDone()) {
    if (needShop || (!state.countItem('health_potion') && p.gold >= 40)) { shop(); needShop = false; }
    if (!lazy && p.hp < p.maxHp * 0.8) rest(); // a fight only with most of your health
    let m = near(type, 9).find(x => lazy || crowd(x) <= 2);
    if (!m) {
      const far = state.monsters.filter(x => !x.dead && x.type === type && x.z === cz && Math.max(Math.abs(x.x - cx), Math.abs(x.y - cy)) <= 30 && crowd(x) <= 2)
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (!far) { goTo(cx, cy, cz, 3, `to the ${type}s`); wait(5000); continue; }
      if (far.z === p.z && Math.max(Math.abs(far.x - p.x), Math.abs(far.y - p.y)) <= 10) m = far; // in sight: attack, chase does the walking
      else goTo(far.x, far.y, far.z, 2, `to a ${type}`);
      m = m || near(type, 9).find(x => lazy || crowd(x) <= 2) || near(type, 3)[0];
      if (!m) { wait(2000); continue; } // (always let time pass, or this could go round for ever)
    }
    const before = killsTotal, t0 = state.now; kill(m);
    if (state.now === t0) wait(500);
    if (killsTotal > before) got++;
  }
  if (got < n && !questDone()) problem(`found only ${got} of ${n} ${type}s in 45 minutes`);
}
// Make the kills a quest step wants, counted by the game.
function killsLeft(id, type) {
  if (state.questState(id) !== 'active') { problem(`${id} is not active (${state.questState(id)}): the bot could not take it`); return 0; }
  const s = run(`questStep('${id}')`);
  return (s.kill && s.kill[type] || 0) - (p.quests[id].kills[type] || 0);
}
function huntFor(id, type, where) { // the kills a quest step wants: `type` first, then the rest it asks for (a boss)
  const types = () => state.questState(id) === 'active' ? Object.keys(run(`questStep('${id}')`).kill || {}) : [];
  for (const t of [type, ...types().filter(t => t !== type)]) {
    let left;
    while ((left = killsLeft(id, t)) > 0 && state.now < END) hunt(t, left, where, id);
  }
}
// To a level: the watch's hunts whenever one is free (as the guards ask, again and again), else `type` round `where`.
function levelUp(level, type, where) { while (p.level < level && state.now < END) if (!watchHunt()) hunt(type, 3, where, `to reach level ${level}`); }
// The watch's hunts (from level 3, each once its gate's own task is done, again 20 minutes after the last): the ones
// a level past their gate's task (a careful player), the best paid first. Paid in watch marks, spent at Osric's.
const WATCH = [['task_north', 'gate_north', 'goblin', () => GOBLINS], ['task_east', 'gate_east', 'spider', () => SPIDERS],
  ['task_west', 'gate_west', 'wolf', () => WOLVES], ['task_south', 'gate_south', 'crab', () => CRABS]];
const huntSkip = {}; // (a hunt the bot couldn't take: left alone a while, so it doesn't ask again and again)
function watchHunt() {
  const free = WATCH.find(([id, gate]) => {
    const s = p.quests[id], q = state.QUESTS[id];
    if (huntSkip[id] > state.now) return false;
    return p.level >= Math.max(q.level, state.QUESTS[gate].level + (lazy ? 0 : 1)) && state.questState(gate) === 'done' && (!s || s.status === 'active' || state.now >= s.doneAt + q.repeat);
  });
  if (!free) return false;
  const [id, gate, type, where] = free;
  note(`== the watch's hunt: ${type}s (${id})`);
  const marks = state.countItem('watch_mark');
  talkFor(id, 'active', gate, 'hunt', 'yes');
  if (state.questState(id) !== 'active') { huntSkip[id] = state.now + 10 * 60000; wait(1000); return false; }
  huntFor(id, type, where()); talkFor(id, 'done', gate, 'hunt');
  note(`   ${state.countItem('watch_mark') - marks} watch marks`);
  return true;
}

// ---- the town -----------------------------------------------------------------------------------------------------
const npc = id => state.npcs.find(n => n.npcId === id);
function talk(id, ...words) {
  const n = npc(id);
  let said = [];
  for (let tries = 0; tries < 4; tries++) { // a fight in between, or a walk away, ends the talk: then start again
    if (!goTo(n.x, n.y, n.z, 1, `to talk to ${n.name}`)) return;
    const seen = messages.length, k0 = killsTotal;
    A.say('hi'); wait(300);
    for (const w of words) { A.say(w); wait(300); }
    A.say('bye'); wait(200);
    said = messages.slice(seen).filter(m => m.startsWith(n.name) && !/Good bye|^.*: (Halt|Peace|Ah, a new|Good day|Hello)/.test(m));
    const heard = messages.slice(seen).some(m => m.startsWith(n.name));
    if (heard && killsTotal === k0 && !p.dead) break;
  }
  if (said.some(m => /not sure what you mean/.test(m))) problem(`${n.name} did not understand "${words.join('", "')}"`);
}
// Talk until the quest is where it should be: taken ('active') or handed in ('done').
function talkFor(quest, want, id, ...words) {
  for (let tries = 0; tries < 3 && state.questState(quest) !== want && (want !== 'active' || state.questState(quest) === 'none'); tries++) {
    talk(id, ...words);
    if (state.questState(quest) !== want) wait(2000);
  }
  if (state.questState(quest) !== want && !(want === 'active' && state.questState(quest) === 'done')) problem(`${quest} is ${state.questState(quest)} after talking to ${id}, not ${want}`);
}
// (ok: what it should say instead of "You found", for a use that isn't a chest)
function use(x, y, z, what, ok = /You found/) {
  goTo(x, y, z, 1, `to ${what}`);
  const seen = messages.length;
  A.interact('use', x, y, z); wait(1500);
  const said = messages.slice(seen).join(' ');
  if (!ok.test(said)) problem(`${what} at ${x},${y},${z}: "${said.slice(0, 120)}"`);
  else if (!/You found/.test(said)) note(said.slice(0, 80));
  else note(said.match(/You found[^.]*\./)[0]);
}
// A thing a quest step waits for (Clang's crate, the bell): used, and the quest moves on.
function useFor(quest, x, y, z, what) {
  const step = (p.quests[quest] || {}).step;
  goTo(x, y, z, 1, `to ${what}`);
  A.interact('use', x, y, z); wait(1500);
  if ((p.quests[quest] || {}).step === step && state.questState(quest) !== 'done') problem(`${what} at ${x},${y},${z} did nothing for ${quest}`);
  else note(`used ${what}`);
}
// A page of the Oakvale Chronicle, lying where the founder wrote it.
function page(n, x, y, z) {
  if (p.chests[`chronicle_${n}`]) return;
  goTo(x, y, z, 1, `to the Chronicle's page ${n}`);
  A.interact('use', x, y, z); wait(1500);
  if (!p.chests[`chronicle_${n}`]) problem(`the Chronicle's page ${n} at ${x},${y},${z} could not be read`);
  else note(`read the Chronicle's page ${n}`);
}
// Before going out: potions and food from Pip, as far as the money goes; and a heal from Ama if hurt.
function shop(potions = 5) {
  if (lazy) return;
  const pip = npc('pip');
  goTo(pip.x, pip.y, pip.z, 2, "to Pip's");
  A.say('hi'); wait(200); A.say('trade'); wait(300);
  if (!run('player.shopNpc && player.shopNpc.def.trade')) { problem("Pip's shop did not open"); A.say('bye'); wait(200); return; }
  const g0 = p.gold; // sell the loot first
  equipBest(); // (never sell what you'd rather wear)
  for (const [id, , n] of run('sellableItems(player.shopNpc)')) if (!['health_potion', 'mana_potion', 'bread', 'apple', 'rope', 'shovel'].includes(id) && !state.ITEMS[id].slot) A.sell(id, n);
  if (p.gold > g0) note(`sold loot for ${p.gold - g0} gold`);
  // food first: it is cheap and makes resting quick
  if (state.countItem('bread') < 3 && p.gold >= 15) { const g = p.gold; A.buy('bread', 3); goldSpent += g - p.gold; }
  const price = run("NPCS.pip.trade.sells.find(s => s[0] === 'health_potion')[1]");
  const want = Math.max(0, potions - state.countItem('health_potion'));
  const n = Math.min(want, Math.floor(p.gold / price));
  if (n) { const g = p.gold; A.buy('health_potion', n); goldSpent += g - p.gold; potionsBought += state.countItem('health_potion') ? n : 0; }
  A.say('bye'); wait(200);
  note(`shopped: now ${state.countItem('health_potion')} potions, ${p.gold} gold`);
  if (want > n) note(`  (wanted ${want} potions, could pay for ${n})`);
  armour(price * 2);
  // watch marks: five potions for two at Captain Osric's, at the north gate
  if (state.countItem('watch_mark') >= 2) {
    const n0 = state.countItem('health_potion');
    for (let i = 0; i < 4 && state.countItem('watch_mark') >= 2; i++) talk('gate_north', 'potions');
    if (state.countItem('health_potion') > n0) { potionsFromMarks += state.countItem('health_potion') - n0; note(`watch marks: now ${state.countItem('health_potion')} potions`); }
  }
}
// Better armour at Brenna's (Hide and Iron), with what's left over after keeping `keep` gold for potions.
function armour(keep) { // better armour at Brenna's and a better club at the smithy, with what's left over
  const shops = [['oak_armourer', d => (d.armor || 0) + (d.defense || 0), 'to Hide and Iron'],
    ['oak_smith', d => (d.weapon && d.weapon.type === 'club' ? d.weapon.attack : 0), 'to the smithy']]; // clubs: it trains club
  for (const [id, worth, why] of shops) {
    const offers = run(`NPCS.${id}.trade.sells`).filter(([item, price]) => {
      const d = state.ITEMS[item], cur = p.equipment[d.slot];
      return price <= p.gold - keep && worth(d) > (cur ? worth(state.ITEMS[cur.id]) : 0) && !(d.level > p.level);
    }).sort((a, b) => worth(state.ITEMS[b[0]]) / b[1] - worth(state.ITEMS[a[0]]) / a[1]);
    if (!offers.length) continue;
    const n = npc(id);
    goTo(n.x, n.y, n.z, 1, why);
    A.say('hi'); wait(200); A.say('trade'); wait(300);
    for (const [item, price] of offers) {
      if (p.gold - price < keep) continue;
      const g = p.gold; A.buy(item, 1);
      if (p.gold < g) { goldSpent += g - p.gold; note(`bought ${item} for ${price} gold`); }
    }
    A.say('bye'); wait(200);
    equipBest();
  }
}
function equipBest() { // put on whatever good gear is in the bag
  for (const it of [...state.bagItems()]) { // everything carried, bags inside the backpack too
    const d = state.ITEMS[it.id];
    if (!d.slot || d.slot === 'backpack') continue;
    const cur = p.equipment[d.slot], cd = cur && state.ITEMS[cur.id];
    const better = !cur || (d.armor || 0) + (d.defense || 0) + ((d.weapon && d.weapon.attack) || 0) > ((cd && cd.armor) || 0) + ((cd && cd.defense) || 0) + ((cd && cd.weapon && cd.weapon.attack) || 0);
    if (better) {
      const ref = state.findInBag(x => x === it);
      if (ref) A.useItem(ref);
      if (p.equipment[d.slot] && p.equipment[d.slot].id === it.id) note(`put on ${it.id}`); else problem(`could not put on ${it.id} (${ref ? 'it stayed in the bag' : 'not found in the bag'})`);
    }
  }
}

// ---- the road: the guide's order (game-guide.js), the quests as they are now (npcs.js) ------------------------------
const SUNNY = [128, 165, 8], WOLVES = [62, 88, 8], CRABS = [132, 210, 8], SPIDERS = [178, 192, 8], GOBLINS = [182, 80, 8]; // (Goblin Hill's south slope, below Gnash's camp)
const CRYPT = [80, 181, 7], DRAINS = [126, 125, 6], CISTERN = [125, 110, 5], TOMB = [69, 181, 6], SEWERS = [126, 130, 7];
try {
  const step = (name, fn) => { const t0 = state.now; note(`== ${name}`); fn(); note(`   (${((state.now - t0) / 60000).toFixed(1)} min)`); };
  step('The Last Town', () => {
    talkFor('last_town', 'active', 'ama', 'fight', 'yes'); talk('gate_north', 'fight');
    for (const [x, y, z] of [[132, 94, 9], [138, 94, 9], [116, 94, 9], [105, 94, 9]]) use(x, y, z, 'a cannon on the north wall', /cannons loaded/);
    useFor('last_town', 131, 94, 9, 'the powder kegs'); use(116, 94, 9, 'the fuse', /FIRE!/);
    talkFor('last_town', 'done', 'gate_north', 'fight');
    note(p.pet ? `${p.pet.name} follows, and fights along` : 'no Clang!');
  });
  step('The Recruit', () => {
    talkFor('recruit', 'active', 'corwin', 'fighter', 'yes');
    p.quests.recruit.hits = 10; wait(20000); // (ten hits on a dummy)
    talk('corwin', 'fighter'); equipBest();
    talk('oak_farmer', 'rats'); huntFor('recruit', 'rat', SEWERS); talk('oak_farmer', 'rats');
    shop(3); p.chests.guide_bought = p.chests.guide_sold = true; talk('pip', 'supplies');
    p.depot.contents.push({ id: 'apple', count: 1 }); talk('postmaster', 'locker');
    talkFor('recruit', 'done', 'corwin', 'fighter'); equipBest();
  });
  step('to level 2', () => levelUp(2, 'rat', SUNNY));
  step('Bram: Greyfang\'s den', () => { shop(3); talkFor('gate_west', 'active', 'gate_west', 'wolves', 'yes'); huntFor('gate_west', 'wolf', WOLVES);
    goTo(69, 98, 8, 1, 'to the paw prints'); hunt('greyfang', 1, [67, 71, 8], 'Greyfang, in his den'); talkFor('gate_west', 'done', 'gate_west', 'wolves'); equipBest(); });
  step('the rats\' nest: a shield', () => { shop(3); use(144, 140, 7, 'the chest in the rats\' nest'); equipBest(); });
  step('Tilda: crabs', () => { levelUp(3, 'wolf', WOLVES); shop(3); talkFor('gate_south', 'active', 'gate_south', 'crabs', 'yes');
    for (let i = 0; i < 8 && !run('areaClear(questStep("gate_south").clear)'); i++) hunt('crab', 2, [101, 220, 8], 'the crabs round Wendel\'s rock');
    talk('oak_stranded', 'help'); talkFor('gate_south', 'done', 'gate_south', 'crabs'); equipBest(); });
  step('Hilde: spiders', () => { levelUp(4, 'wolf', WOLVES); shop(4); talkFor('gate_east', 'active', 'gate_east', 'spiders', 'yes');
    for (const [x, y] of run('GATE_SITES.nests')) { // Hilde's torch on each nest (one burnt by someone else is spun again after a while)
      goTo(x, y + 1, 8, 1, 'to a spider nest'); while (fightBack());
      for (let i = 0; i < 20 && !run(`((player.quests.gate_east || {}).burnt || []).includes('${x},${y},8')`); i++) { A.useItemOn(state.findInBag(it => it.id === 'hand_torch'), x, y, 8); wait(3000); }
    }
    talkFor('gate_east', 'done', 'gate_east', 'spiders'); equipBest(); });
  step('Osric: goblins', () => { levelUp(5, 'spider', SPIDERS); shop(5); talkFor('gate_north', 'active', 'gate_north', 'goblins', 'yes');
    goTo(190, 80, 8, 2, 'to the foot of Goblin Hill'); while (run('daylight()') >= 0.5) wait(10000); // (in at night, while they sleep)
    use(198, 70, 8, 'Gnash\'s war chest'); talkFor('gate_north', 'done', 'gate_north', 'goblins'); equipBest(); });
  step('the crypt: the founders\' arms', () => {
    shop(6); hunt('skeleton', 6, CRYPT, 'the crypt\'s hall of coffins'); use(81, 178, 7, 'a weapon chest'); equipBest();
  });
  step('to level 6', () => levelUp(6, 'goblin', GOBLINS));
  step('the drains', () => {
    shop(8); hunt('giant_rat', 6, DRAINS, 'the drains'); hunt('cistern_slime', 1, CISTERN, 'the cistern');
    use(142, 103, 5, 'the rotting pack'); equipBest();
  });
  step('to level 8', () => levelUp(8, 'skeleton', CRYPT));
  step('the Gravewaker, in the founder\'s tomb', () => { shop(10); hunt('gravewaker', 1, TOMB, 'the founder\'s tomb'); equipBest(); });
  step('to level 10', () => levelUp(10, 'goblin', GOBLINS));
  step('Farewell', () => {
    talkFor('bell_6', 'active', 'ama', 'farewell', 'yes'); useFor('bell_6', 145, 102, 11, 'the bell');
    talk('corwin', 'farewell'); talk('pip', 'farewell'); talk('gate_north', 'farewell'); talkFor('bell_6', 'done', 'ama', 'farewell');
  });
  step('the oracle', () => { const o = npc('oak_oracle'); talk('oak_oracle', 'destiny'); if (Math.max(Math.abs(p.x - o.x), Math.abs(p.y - o.y)) > 2 || p.z !== o.z) problem('did not reach the oracle'); });
} catch (e) {
  if (e instanceof Timeout) problem(`ran out of time (${hours} hours)`);
  else problem(`the bot broke: ${e.stack.split('\n').slice(0, 3).join(' | ')}`);
}
console.log();
console.log(`\nSeed ${seed}${lazy ? ' (lazy)' : ''}: level 10 at minute ${levelAt[10] || '-'}; level ${p.level} after ${min()} minutes; levels at minute ${Object.entries(levelAt).map(([l, m]) => `${l}: ${m}`).join(', ')}`);
console.log(`deaths ${deaths}, kills ${killsTotal}, potions bought ${potionsBought} (and ${potionsFromMarks} for watch marks), Light Heals ${healsCast}, meals ${eaten}, gold spent ${goldSpent}, gold now ${p.gold}`);
console.log(`gear: ${Object.entries(p.equipment).filter(([s, i]) => i && s !== 'backpack').map(([s, i]) => i.id).join(', ')}; skills club ${p.skills.club.level}, shielding ${p.skills.shielding.level}`);
console.log(`Chronicle pages ${run('chronicleCount()')} of 6, watch marks left ${state.countItem('watch_mark')}, Clang ${p.pet ? `level ${p.pet.level}` : 'not found'}; guide step ${p.tutorial} of ${run('GUIDE.length')}`);
if (problems.length) console.log(`\nProblems:\n  ${problems.join('\n  ')}`);
