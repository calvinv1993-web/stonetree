// The phone's smart button (js/smart-button.js): what a press does, chosen in the real world with the game's own rules.
// Run: node tests/smart-button.test.js
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const { loadGame, ROOT } = require('./harness');
const g = loadGame(), { ctx, state } = g;
vm.runInContext('var paused = false; var chatOpen = false; var pickerOpen = false; var document = { body: { classList: { contains: c => c === "chat-open" && chatOpen } }, getElementById: id => (id === "favPicker" ? { hidden: !pickerOpen } : null) };' + fs.readFileSync(path.join(ROOT, 'js', 'smart-button.js'), 'utf8') + ';this.SmartButton = SmartButton;', ctx);
const S = ctx.SmartButton, P = state.player, map = state.map;
const kind = () => S.context().kind;
let pass = 0;
const check = (what, fn) => { fn(); pass++; console.log(`  ok   ${what}`); };
const clear = () => { state.monsters = []; state.piles.length = 0; state.npcs = []; };
// a protected tile (a temple) and an open one, both walkable
const tiles = [];
for (let y = 0; y < map.height && tiles.length < 2; y++) for (let x = 0; x < map.width; x++) {
  const want = tiles.length ? false : true, t = map.get(x, y, 8);
  if (t && state.isFree(x, y, 8) && map.isProtected(x, y, 8) === want && !map.isProtected(x + 1, y, 8) === !want) { tiles.push({ x, y, z: 8 }); if (tiles.length === 2) break; }
}
const [safe, open] = tiles;
const at = p => ctx.teleport(p);
const monster = (p, dx) => { const m = ctx.spawnMonster({ type: 'rat', x: p.x + dx, y: p.y, z: p.z }); m.x = p.x + dx; m.y = p.y; state.monsters.push(m); return m; };

check('nothing about: the button rests (no attack offered at nothing)', () => { clear(); at(open); assert.equal(kind(), 'idle'); });
check('a monster in sight outside a protection zone: attack, and a press targets it', () => {
  clear(); at(open); const m = monster(open, 2); assert.equal(kind(), 'attack');
  S.press(); assert.equal(P.target, m);
});
check('pressing again switches to the next target', () => {
  const second = monster(open, -3); S.press(); assert.equal(P.target, second); S.press(); assert.notEqual(P.target, second);
});
check('inside a protection zone no attack is offered, even with a monster near', () => {
  clear(); at(safe); monster(safe, 1); assert.notEqual(kind(), 'attack');
});
check('no monster, a corpse with loot near: loot', () => {
  clear(); at(open); state.piles.push({ id: 991, x: open.x + 1, y: open.y, z: 8, items: [{ id: 'gold', count: 3 }], corpse: 'rat', until: 1e12 });
  assert.equal(kind(), 'loot');
});
check('a monster near outranks the loot', () => { monster(open, 2); assert.equal(kind(), 'attack'); });
check('someone to talk to in reach: talk', () => {
  clear(); at(safe); const npc = { npcId: 'test', name: 'Tester NPC', x: safe.x + 1, y: safe.y, z: 8 }; state.npcs = [npc];
  const c = S.context(); assert.equal(c.kind, 'talk'); assert.equal(c.x, npc.x);
});
check('with the chat open it is a close button', () => { vm.runInContext('chatOpen = true', ctx); assert.equal(kind(), 'close'); vm.runInContext('chatOpen = false', ctx); });
check('with an action button\'s chooser open it is a close button', () => { vm.runInContext('pickerOpen = true', ctx); assert.equal(kind(), 'close'); vm.runInContext('pickerOpen = false', ctx); });
check('dead: nothing to do', () => { P.dead = true; assert.equal(kind(), 'idle'); P.dead = false; });
console.log(`all ${pass} passed`);
