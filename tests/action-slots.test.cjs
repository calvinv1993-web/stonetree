// The action buttons' state (js/action-slots.js): what it shows for mana, cooldowns and potions, read from the game's
// own numbers. Run: node tests/action-slots.test.cjs
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'action-slots.js'), 'utf8');
const ctx = vm.createContext({
  requestAnimationFrame() {}, document: { hidden: false, getElementById: () => null },
  SPELLS: { power_strike: { mana: 20 }, whirlwind: { mana: 45 } }, SPELL_COOLDOWN: 1000, POTION_COOLDOWN: 1000,
  player: { mana: 40, spellReady: 0, potionReady: 0 }, now: 5000,
});
vm.runInContext(src + ';this.ActionSlots = ActionSlots;', ctx);
const S = ctx.ActionSlots, json = v => JSON.stringify(v);
assert.equal(json(S.state('power_strike')), json({ mana: 20, short: false, wait: 0, total: 1000 }));
assert.equal(S.state('whirlwind').short, true, 'too little mana');
ctx.player.spellReady = 5600;
assert.equal(S.state('power_strike').wait, 600, 'spells share one cooldown');
assert.equal(S.state('h').wait, 0);
ctx.player.potionReady = 5250;
assert.equal(S.state('m').wait, 250, 'potions have their own');
assert.equal(json(S.state('f')), '{}', 'food has neither');
assert.equal(S.art('power_strike'), 'sprites/ui/actions/power_strike.png');
assert.equal(S.art('fire_bolt'), null, 'no picture yet: initials');
for (const id of ['light', 'light_heal', 'cure_poison', 'power_strike', 'haste', 'whirlwind', 'shield_bash', 'earthshaker', 'h', 'm', 'f'])
  assert.ok(fs.existsSync(path.join(__dirname, '..', S.art(id))), `${id} has its picture`);
console.log('PASS: action slot mana, cooldowns, potions and pictures');
