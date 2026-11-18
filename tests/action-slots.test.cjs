// The action buttons' state (js/action-slots.js): what it shows for mana, cooldowns and potions, read from the game's
// own numbers. Run: node tests/action-slots.test.cjs
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'action-slots.js'), 'utf8');
const ctx = vm.createContext({
  requestAnimationFrame() {}, document: { hidden: false, getElementById: () => null },
  SPELLS: { power_strike: { mana: 20 }, whirlwind: { mana: 45 } }, SPELL_COOLDOWN: 1000, POTION_COOLDOWN: 1000,
  player: { mana: 40, spellReady: 0, potionReady: 0 }, now: 5000, countItem: id => (id === 'health_potion' ? 3 : 0),
});
vm.runInContext(src + ';this.ActionSlots = ActionSlots;', ctx);
const S = ctx.ActionSlots, json = v => JSON.stringify(v);
assert.equal(json(S.state('power_strike')), json({ mana: 20, short: false, wait: 0, total: 1000 }));
assert.equal(S.state('whirlwind').short, true, 'too little mana');
ctx.player.spellReady = 5600;
assert.equal(S.state('power_strike').wait, 600, 'spells share one cooldown');
assert.equal(S.state('h').wait, 0);
assert.equal(S.state('h').short, false, 'potions left');
assert.equal(S.state('m').short, true, 'none left: dimmed');
ctx.player.potionReady = 5250;
assert.equal(S.state('m').wait, 250, 'potions have their own');
assert.equal(json(S.state('f')), '{"short":true}', 'food has no cooldown, and nothing to eat dims it');
ctx.petFood = () => 'bread';
assert.equal(json(S.state('f')), '{"short":false}', 'with food in the bag it is ready');
assert.equal(S.art('power_strike'), 'sprites/ui/actions/power_strike.png');
assert.equal(S.art('final_blaze'), null, 'no picture: initials');
for (const id of ['light', 'light_heal', 'cure_poison', 'power_strike', 'haste', 'whirlwind', 'shield_bash', 'earthshaker', 'h', 'm', 'f',
  'fire_bolt', 'conjure_missile', 'conjure_fire_field', 'conjure_fireball', 'flame_burst', 'magic_shield', 'conjure_energy_field',
  'conjure_magic_wall', 'energy_beam', 'inferno', 'ice_bolt', 'conjure_heal', 'conjure_poison_field', 'thorn_burst', 'conjure_paralyze',
  'frost_wave', 'blizzard', 'holy_bolt', 'conjure_arrows', 'greater_heal', 'conjure_bolts', 'holy_wave', 'holy_storm'])
  assert.ok(fs.existsSync(path.join(__dirname, '..', S.art(id))), `${id} has its picture`);
console.log('PASS: action slot mana, cooldowns, potions and pictures');
