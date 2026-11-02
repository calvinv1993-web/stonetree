'use strict';
// Items that can be carried, worn and used.
//   slot:       where it is worn (see SLOTS)
//   weapon:     { type: sword|axe|club|distance|wand, attack, range, twoHanded, ammo, thrown,
//                 breakChance, dmg: [min, max] and mana per shot for wands/rods, element }
//   ammo:       { type: arrow|bolt, attack }
//   armor:      damage absorbed while worn
//   defense:    shields (and melee weapons without a shield) block hits, scaled by shielding
//   container:  number of slots (bags), can hold other bags
//   stack:      stacks up to 100 per slot
//   weight:     in oz; what you carry is limited by your capacity
//   use:        { food: seconds } | { heal: [min, max] } | { mana: [min, max] }
//   ring:       worn effects that run out: { regen: [hp, mana], speed, duration (ms) }
//   keeping:    an amulet that saves your things when you die (used up)
//   rune:       used on a target (see castRune): { kind, element, power, radius, field, condition, ml, range }
//   tool:       rope | shovel | pick | fishing, used on a target
//   key:        opens locked doors with this lock name
//   kit:        furniture you can set up in your house
//   text:       readable
//   level / vocations: requirements to wear it
//   value:      what traders pay for it
//   quest:      quest item, can't be dropped or sold
//   ore:        forging ore of this grade (see QUALITIES and game-forge.js)
//
// A piece of gear can have a grade, item.q (0 common .. 4 legendary): better attack,
// armor and defense. Smiths forge it up a grade with ore; monsters drop some.

const SLOTS = ['head', 'neck', 'body', 'legs', 'feet', 'weapon', 'shield', 'ring', 'ammo', 'backpack'];
const SLOT_LABELS = {
  head: 'head', neck: 'neck', body: 'armor', legs: 'legs', feet: 'boots', weapon: 'weapon',
  shield: 'shield', ring: 'ring', ammo: 'ammo', backpack: 'bag',
};
const MAGES = ['sorcerer', 'druid'];
const MAX_STACK = 100;
const MIN = 60000;

// The grades of gear and ore, from common to legendary.
const QUALITIES = [
  { name: 'common', color: '#c8c8c8' }, { name: 'fine', color: '#5ad05a' }, { name: 'rare', color: '#4a8cff' },
  { name: 'epic', color: '#b05cff' }, { name: 'legendary', color: '#ff9a2a' },
];
const ORES = ['ore_rough', 'ore_iron', 'ore_mithril', 'ore_starsteel', 'ore_sunsteel']; // by grade
// What a grade adds to a stat: 12% a grade, at least half a point a grade.
const qualityStat = (base, q) => (base && q ? base + Math.max(Math.round(base * 0.12 * q), Math.ceil(q / 2)) : base || 0);
const forgeable = id => !!(ITEMS[id] && ITEMS[id].slot && (ITEMS[id].weapon || ITEMS[id].armor || ITEMS[id].defense) && !ITEMS[id].ammo && !ITEMS[id].stack);

const ITEMS = {
  gold:          { name: 'gold coin', stack: true, weight: 0 },

  apple:         { name: 'apple', stack: true, use: { food: 60 }, value: 1, weight: 1.5 },
  cheese:        { name: 'cheese', stack: true, use: { food: 90 }, value: 2, weight: 4 },
  bread:         { name: 'bread', stack: true, use: { food: 120 }, value: 2, weight: 5 },
  fish:          { name: 'fish', stack: true, use: { food: 200 }, value: 5, weight: 5 },
  dragon_ham:    { name: 'dragon ham', stack: true, use: { food: 360 }, value: 10, weight: 30 },
  meat:          { name: 'meat', stack: true, use: { food: 180 }, value: 3, weight: 13 },
  health_potion: { name: 'health potion', stack: true, use: { heal: [60, 90] }, value: 15, weight: 1.8 },
  mana_potion:   { name: 'mana potion', stack: true, use: { mana: [60, 90] }, value: 18, weight: 1.8 },

  bag:           { name: 'bag', slot: 'backpack', container: 8, value: 3, weight: 8 },
  backpack:      { name: 'backpack', slot: 'backpack', container: 20, value: 20, weight: 18 },

  wooden_club:   { name: 'wooden club', slot: 'weapon', weapon: { type: 'club', attack: 7 }, defense: 3, value: 2, weight: 25 },
  dagger:        { name: 'dagger', slot: 'weapon', weapon: { type: 'sword', attack: 8 }, defense: 4, value: 5, weight: 9.5 },
  hatchet:       { name: 'hatchet', slot: 'weapon', weapon: { type: 'axe', attack: 10 }, defense: 4, value: 8, weight: 20 },
  short_sword:   { name: 'short sword', slot: 'weapon', weapon: { type: 'sword', attack: 11 }, defense: 6, value: 12, weight: 35 },
  mace:          { name: 'mace', slot: 'weapon', weapon: { type: 'club', attack: 15 }, defense: 8, value: 30, weight: 38 },
  longsword:     { name: 'longsword', slot: 'weapon', weapon: { type: 'sword', attack: 15 }, defense: 10, value: 35, weight: 42 },
  war_axe:       { name: 'war axe', slot: 'weapon', weapon: { type: 'axe', attack: 17 }, defense: 6, value: 35, weight: 50 },
  broadsword:    { name: 'broadsword', slot: 'weapon', weapon: { type: 'sword', attack: 22 }, defense: 13, level: 12, value: 120, weight: 52 },
  battle_axe:    { name: 'battle axe', slot: 'weapon', weapon: { type: 'axe', attack: 25 }, defense: 10, level: 14, value: 140, weight: 65 },
  war_hammer:    { name: 'war hammer', slot: 'weapon', weapon: { type: 'club', attack: 25 }, defense: 11, level: 14, value: 140, weight: 85 },
  knight_blade:  { name: 'knight blade', slot: 'weapon', weapon: { type: 'sword', attack: 32 }, defense: 18, level: 20, vocations: ['knight'], value: 400, weight: 50 },

  spear:         { name: 'spear', stack: true, slot: 'weapon', weapon: { type: 'distance', attack: 14, range: 4, thrown: true, breakChance: 0.1 }, value: 3, weight: 20 },
  bow:           { name: 'bow', slot: 'weapon', weapon: { type: 'distance', attack: 2, range: 6, ammo: 'arrow', twoHanded: true }, value: 50, weight: 31 },
  crossbow:      { name: 'crossbow', slot: 'weapon', weapon: { type: 'distance', attack: 5, range: 6, ammo: 'bolt', twoHanded: true }, level: 15, vocations: ['paladin'], value: 150, weight: 40 },
  arrow:         { name: 'arrow', stack: true, slot: 'ammo', ammo: { type: 'arrow', attack: 20 }, value: 1, weight: 0.7 },
  bolt:          { name: 'bolt', stack: true, slot: 'ammo', ammo: { type: 'bolt', attack: 28 }, value: 1, weight: 0.8 },

  wand_sparks:   { name: 'wand of sparks', slot: 'weapon', weapon: { type: 'wand', dmg: [10, 20], mana: 2, range: 4, element: 'energy' }, level: 10, vocations: ['sorcerer'], value: 100, weight: 22 },
  wand_flames:   { name: 'wand of flames', slot: 'weapon', weapon: { type: 'wand', dmg: [20, 36], mana: 4, range: 4, element: 'fire' }, level: 18, vocations: ['sorcerer'], value: 250, weight: 22 },
  rod_frost:     { name: 'rod of frost', slot: 'weapon', weapon: { type: 'wand', dmg: [10, 20], mana: 2, range: 4, element: 'ice' }, level: 10, vocations: ['druid'], value: 100, weight: 22 },
  rod_thorns:    { name: 'rod of thorns', slot: 'weapon', weapon: { type: 'wand', dmg: [20, 36], mana: 4, range: 4, element: 'earth' }, level: 18, vocations: ['druid'], value: 250, weight: 22 },

  wooden_shield: { name: 'wooden shield', slot: 'shield', defense: 12, value: 5, weight: 40 },
  studded_shield:{ name: 'studded shield', slot: 'shield', defense: 15, value: 15, weight: 59 },
  iron_shield:   { name: 'iron shield', slot: 'shield', defense: 20, level: 12, value: 80, weight: 80 },
  dragon_shield: { name: 'dragon shield', slot: 'shield', defense: 30, level: 30, value: 900, weight: 60 },
  demon_shield:  { name: 'demon shield', slot: 'shield', defense: 36, level: 60, value: 3000, weight: 70 },
  frost_blade:   { name: 'frost blade', slot: 'weapon', weapon: { type: 'sword', attack: 38 }, defense: 20, level: 35, vocations: ['knight'], value: 900, weight: 55 },
  fire_axe:      { name: 'fire axe', slot: 'weapon', weapon: { type: 'axe', attack: 42 }, defense: 16, level: 45, vocations: ['knight'], value: 1400, weight: 70 },
  elven_bow:     { name: 'elven bow', slot: 'weapon', weapon: { type: 'distance', attack: 8, range: 7, ammo: 'arrow', twoHanded: true }, level: 30, vocations: ['paladin'], value: 800, weight: 25 },
  wand_storm:    { name: 'wand of storms', slot: 'weapon', weapon: { type: 'wand', dmg: [35, 60], mana: 7, range: 4, element: 'energy' }, level: 35, vocations: ['sorcerer'], value: 900, weight: 22 },
  rod_glacier:   { name: 'rod of the glacier', slot: 'weapon', weapon: { type: 'wand', dmg: [35, 60], mana: 7, range: 4, element: 'ice' }, level: 35, vocations: ['druid'], value: 900, weight: 22 },
  crown_helmet:  { name: 'crown helmet', slot: 'head', armor: 7, level: 40, vocations: ['knight', 'paladin'], value: 1200, weight: 50 },
  witch_hat:     { name: 'witch hat', slot: 'head', armor: 3, level: 20, vocations: MAGES, value: 300, weight: 8 },
  lizard_mail:   { name: 'lizard scale mail', slot: 'body', armor: 9, level: 30, vocations: ['knight', 'paladin'], value: 900, weight: 90 },
  golden_armor:  { name: 'golden armor', slot: 'body', armor: 13, level: 50, vocations: ['knight'], value: 4000, weight: 110 },
  tower_shield:  { name: 'tower shield', slot: 'shield', defense: 28, level: 20, vocations: ['knight'], value: 300, weight: 85 },
  spellbook:     { name: 'spellbook', slot: 'shield', defense: 12, vocations: MAGES, value: 100, weight: 18 },

  leather_cap:   { name: 'leather cap', slot: 'head', armor: 1, value: 4, weight: 8 },
  chain_helmet:  { name: 'chain helmet', slot: 'head', armor: 3, value: 25, weight: 42 },
  steel_helmet:  { name: 'steel helmet', slot: 'head', armor: 5, level: 15, vocations: ['knight', 'paladin'], value: 150, weight: 46 },
  wizard_hat:    { name: 'wizard hat', slot: 'head', armor: 2, vocations: MAGES, value: 60, weight: 7.5 },
  leather_armor: { name: 'leather armor', slot: 'body', armor: 3, value: 10, weight: 60 },
  chain_armor:   { name: 'chain armor', slot: 'body', armor: 6, value: 60, weight: 100 },
  ranger_cloak:  { name: 'ranger cloak', slot: 'body', armor: 7, level: 12, vocations: ['paladin'], value: 150, weight: 40 },
  mage_robe:     { name: 'mage robe', slot: 'body', armor: 5, level: 12, vocations: MAGES, value: 150, weight: 26 },
  plate_armor:   { name: 'plate armor', slot: 'body', armor: 10, level: 15, vocations: ['knight'], value: 300, weight: 120 },
  leather_legs:  { name: 'leather legs', slot: 'legs', armor: 1, value: 4, weight: 18 },
  chain_legs:    { name: 'chain legs', slot: 'legs', armor: 3, value: 30, weight: 70 },
  plate_legs:    { name: 'plate legs', slot: 'legs', armor: 6, level: 15, vocations: ['knight', 'paladin'], value: 200, weight: 70 },
  leather_boots: { name: 'leather boots', slot: 'feet', armor: 1, value: 4, weight: 9 },
  iron_boots:    { name: 'iron boots', slot: 'feet', armor: 2, level: 12, value: 60, weight: 30 },

  ring_life:     { name: 'ring of life', slot: 'ring', ring: { regen: [3, 3], duration: 20 * MIN }, value: 50, weight: 1 },
  ring_swift:    { name: 'ring of swiftness', slot: 'ring', ring: { speed: 0.8, duration: 30 * MIN }, value: 60, weight: 1 },
  amulet_guard:  { name: 'guardian amulet', slot: 'neck', armor: 2, value: 80, weight: 4 },
  amulet_keeping:{ name: 'amulet of keeping', slot: 'neck', keeping: true, value: 200, weight: 4 },

  blank_rune:    { name: 'blank rune', stack: true, value: 5, weight: 1.2 },
  rune_missile:  { name: 'arcane missile rune', stack: true, value: 8, weight: 1.2,
    rune: { kind: 'bolt', element: 'energy', ml: 0, range: 7, power: { min: [0.2, 1.5, 0, 10], max: [0.4, 2.5, 0, 20] } } },
  rune_fireball: { name: 'fireball rune', stack: true, value: 15, weight: 1.2,
    rune: { kind: 'area', radius: 1, element: 'fire', ml: 2, range: 7, power: { min: [0.3, 2, 0, 15], max: [0.5, 3, 0, 28] } } },
  rune_heal:     { name: 'healing rune', stack: true, value: 20, weight: 1.2,
    rune: { kind: 'heal', ml: 2, range: 7, power: { min: [0.4, 3, 0, 30], max: [0.7, 4.5, 0, 50] } } },
  rune_poison_field: { name: 'poison field rune', stack: true, value: 8, weight: 1.2, rune: { kind: 'field', field: 'poison', ml: 1, range: 7 } },
  rune_fire_field:   { name: 'fire field rune', stack: true, value: 10, weight: 1.2, rune: { kind: 'field', field: 'fire', ml: 1, range: 7 } },
  rune_energy_field: { name: 'energy field rune', stack: true, value: 12, weight: 1.2, rune: { kind: 'field', field: 'energy', ml: 3, range: 7 } },
  rune_magic_wall:   { name: 'magic wall rune', stack: true, value: 25, weight: 1.2, rune: { kind: 'field', field: 'magic_wall', ml: 5, range: 7 } },
  rune_paralyze:     { name: 'paralyze rune', stack: true, value: 30, weight: 1.2, rune: { kind: 'condition', condition: 'paralyze', ml: 5, range: 7 } },

  rope:          { name: 'rope', tool: 'rope', value: 15, weight: 18 },
  shovel:        { name: 'shovel', tool: 'shovel', value: 15, weight: 35 },
  pick:          { name: 'pick', tool: 'pick', value: 15, weight: 45 },
  fishing_rod:   { name: 'fishing rod', tool: 'fishing', value: 30, weight: 8.5 },
  key_bronze:    { name: 'bronze key', key: 'bronze', weight: 1 },
  key_silver:    { name: 'silver key', key: 'silver', weight: 1 },

  book_lore:     { name: 'old book', weight: 13, value: 5,
    text: 'Long ago the sea swallowed the old kingdom of the west. Its king refused to drown and still walks the dark below the tides, waiting for someone foolish enough to wake him.' },
  book_guide:    { name: 'adventurer\'s handbook', weight: 13, value: 5,
    text: 'Knights stand in front and take the blows. Paladins shoot from behind. Sorcerers burn everything, and druids keep everyone alive. Always carry a rope, a shovel and some potions.' },
  kit_table:     { name: 'table kit', kit: 'table', value: 20, weight: 70 },
  kit_chair:     { name: 'chair kit', kit: 'chair', value: 10, weight: 30 },
  kit_plant:     { name: 'potted plant', kit: 'plant', value: 15, weight: 50 },
  kit_bed:       { name: 'bed kit', kit: 'bed', value: 40, weight: 120 },

  wolf_pelt:     { name: 'wolf pelt', stack: true, value: 12, weight: 5 },
  spider_silk:   { name: 'spider silk', stack: true, value: 15, weight: 1 },
  bone:          { name: 'bone', stack: true, value: 3, weight: 5 },
  goblin_charm:  { name: 'goblin charm', stack: true, value: 10, weight: 1 },
  orc_tooth:     { name: 'orc tooth', stack: true, value: 20, weight: 1 },
  ogre_tusk:     { name: 'ogre tusk', stack: true, value: 45, weight: 7 },
  cyclops_toe:   { name: 'cyclops toe', stack: true, value: 55, weight: 10 },
  fur:           { name: 'thick fur', stack: true, value: 40, weight: 12 },
  bear_paw:      { name: 'bear paw', stack: true, value: 25, weight: 8 },
  scorpion_tail: { name: 'scorpion tail', stack: true, value: 30, weight: 3 },
  mummy_wrap:    { name: 'mummy wrapping', stack: true, value: 35, weight: 2 },
  swamp_moss:    { name: 'swamp moss', stack: true, value: 12, weight: 1 },
  croc_hide:     { name: 'crocodile hide', stack: true, value: 45, weight: 10 },
  minotaur_horn: { name: 'minotaur horn', stack: true, value: 60, weight: 6 },
  golem_core:    { name: 'golem core', stack: true, value: 110, weight: 15 },
  lizard_scale:  { name: 'lizard scale', stack: true, value: 50, weight: 1 },
  ember:         { name: 'living ember', stack: true, value: 140, weight: 1 },
  frost_scale:   { name: 'frost dragon scale', stack: true, value: 160, weight: 3 },
  demon_horn:    { name: 'demon horn', stack: true, value: 600, weight: 10 },
  dragon_scale:  { name: 'dragon scale', stack: true, value: 120, weight: 3 },
  crab_claw:     { name: 'crab claw', stack: true, value: 8, weight: 3 },
  pearl:         { name: 'pearl', stack: true, value: 60, weight: 0.5 },
  old_boot:      { name: 'old boot', value: 1, weight: 9 },
  bone_whistle:  { name: 'bone whistle', whistle: true, value: 5, weight: 1 },

  parcel:        { name: "Hilda's parcel", quest: true, weight: 20 },
  old_sock:      { name: 'old sock', quest: true, weight: 1 },
  sea_chart:     { name: 'sea chart', quest: true, weight: 1 },
  ember_seal:    { name: 'Ember Seal', slot: 'neck', armor: 4, quest: true, weight: 3 }, // reforged in the Ember Seal story
  // forging ore, from common to legendary
  ore_rough:     { name: 'rough ore', stack: true, ore: 0, value: 4, weight: 6 },
  ore_iron:      { name: 'iron ore', stack: true, ore: 1, value: 20, weight: 6 },
  ore_mithril:   { name: 'mithril ore', stack: true, ore: 2, value: 90, weight: 5 },
  ore_starsteel: { name: 'starsteel ore', stack: true, ore: 3, value: 400, weight: 5 },
  ore_sunsteel:  { name: 'sunsteel ore', stack: true, ore: 4, value: 1800, weight: 5 },
};

function itemName(id, count = 1, q = 0) {
  const name = (q ? `${QUALITIES[q].name} ` : '') + ITEMS[id].name;
  if (count === 1) return withArticle(name);
  return `${count} ${/s$/.test(name) ? name : name + 's'}`;
}

// A wand's or rod's damage at a grade: 10% more a grade.
const wandDamage = (w, q) => w.dmg.map(d => Math.round(d * (1 + 0.1 * (q || 0))));

// One-line description used for tooltips and "look" (q: the grade of this piece).
function itemInfo(id, q = 0) {
  const d = ITEMS[id], parts = [];
  const w = d.weapon, dmg = w && w.dmg && wandDamage(w, q);
  if (q) parts.push(QUALITIES[q].name);
  if (d.ore !== undefined) parts.push(`${QUALITIES[d.ore].name} ore: a smith forges gear with it`);
  if (w && w.type === 'wand') parts.push(`${w.element} ${dmg[0]}-${dmg[1]}, ${w.mana} mana per shot, range ${w.range}`);
  else if (w) parts.push(`${w.type === 'distance' ? 'distance' : w.type} attack ${qualityStat(w.attack, q)}`);
  if (w && w.ammo) parts.push(`shoots ${w.ammo}s, range ${w.range}`);
  if (w && w.thrown) parts.push(`thrown, range ${w.range}`);
  if (w && w.twoHanded) parts.push('two-handed');
  if (d.ammo) parts.push(`attack +${d.ammo.attack}`);
  if (d.defense) parts.push(`defense ${qualityStat(d.defense, q)}`);
  if (d.armor) parts.push(`armor ${qualityStat(d.armor, q)}`);
  if (d.container) parts.push(`${d.container} slots`);
  if (d.use && d.use.food) parts.push('food');
  if (d.use && d.use.heal) parts.push(`heals ${d.use.heal[0]}-${d.use.heal[1]} HP`);
  if (d.use && d.use.mana) parts.push(`restores ${d.use.mana[0]}-${d.use.mana[1]} mana`);
  if (d.ring && d.ring.regen) parts.push(`regenerate +${d.ring.regen[0]} HP/mana`);
  if (d.ring && d.ring.speed) parts.push('faster walking');
  if (d.ring) parts.push(`lasts ${Math.round(d.ring.duration / MIN)} min`);
  if (d.keeping) parts.push('keeps your things when you die');
  if (d.rune) parts.push(`use it on a target${d.rune.ml ? `, magic level ${d.rune.ml}` : ''}`);
  if (d.tool) parts.push('a tool: use it on something');
  if (d.key) parts.push('opens locked doors');
  if (d.kit) parts.push('use it on a tile in your house');
  if (d.text) parts.push('readable');
  if (d.level) parts.push(`level ${d.level}+`);
  if (d.vocations) parts.push(`${d.vocations.join('s and ')}s only`);
  if (d.quest) parts.push('quest item');
  if (d.weight) parts.push(`${d.weight} oz`);
  if (d.value && !q) parts.push(`worth ${d.value} gold`);
  return capitalize(d.name) + (parts.length ? ` (${parts.join(', ')})` : '');
}
