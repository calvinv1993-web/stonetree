'use strict';
// Monsters, conditions, fields, vocations, skills and spells.

// dmg: melee [min, max]; speed: ms per tile; attackSpeed: ms between attacks;
// aggro: tiles at which it notices you; armor: absorbs physical damage;
// weak: damage multipliers per element; immune: elements/conditions it ignores;
// ranged: { range, dmg, missile, element, chance, keepDistance };
// hitCondition: { kind, chance, power } applied by its melee hits;
// spells: [{ kind: bolt|area|heal|condition, chance, element, dmg, radius, range, condition, power, missile }];
// summon: { type, max, chance }; flee: run away below this share of health;
// invisible: hard to see and can't be targeted from afar;
// respawn: ms (default 60 s, and never while a player can see the spot); loot: { gold: [min, max], items: [[itemId, chance, min, max]] }
const MONSTERS = {
  rat: {
    name: 'rat', hp: 18, xp: 5, dmg: [0, 3], speed: 480, attackSpeed: 1600, aggro: 4, corpse: 'blood',
    loot: { gold: [0, 4], items: [['cheese', 0.3]] },
  },
  giant_rat: { // the big rats of the Oakvale sewers
    name: 'giant rat', hp: 42, xp: 16, dmg: [1, 6], speed: 440, attackSpeed: 1500, aggro: 5, corpse: 'blood',
    loot: { gold: [0, 8], items: [['cheese', 0.4], ['meat', 0.15]] },
  },
  gravewaker: { // the hooded figure who silenced the bell of Oakvale, to wake the dead of the crypt under Bone Rocks
    name: 'Gravewaker', proper: true, hp: 150, xp: 180, dmg: [2, 9], armor: 2, speed: 520, attackSpeed: 2000, aggro: 6, corpse: 'blood',
    respawn: 300000, weak: { holy: 1.3 },
    ranged: { range: 4, dmg: [5, 14], missile: 'poison', element: 'earth', chance: 0.5, keepDistance: true },
    summon: { type: 'skeleton', max: 1, chance: 0.08 },
    loot: { gold: [20, 60], items: [['health_potion', 0.6], ['mana_potion', 0.3], ['blank_rune', 0.2]] },
  },
  spider: {
    name: 'spider', hp: 30, xp: 10, dmg: [1, 6], speed: 420, attackSpeed: 1400, aggro: 5, corpse: 'slime',
    hitCondition: { kind: 'poison', chance: 0.3, power: 4 }, immune: ['poison'],
    loot: { items: [['spider_silk', 0.3]] },
  },
  wolf: {
    name: 'wolf', hp: 40, xp: 15, dmg: [2, 8], speed: 320, attackSpeed: 1400, aggro: 6, corpse: 'blood', flee: 0.15,
    loot: { items: [['meat', 0.5, 1, 2], ['wolf_pelt', 0.2]] },
  },
  slime: {
    name: 'slime', hp: 40, xp: 12, dmg: [1, 7], speed: 800, attackSpeed: 1800, aggro: 4, corpse: 'slime',
    immune: ['poison', 'earth'], hitCondition: { kind: 'poison', chance: 0.2, power: 3 },
    loot: { gold: [0, 8] },
  },
  skeleton: {
    name: 'skeleton', hp: 50, xp: 20, dmg: [1, 9], armor: 2, speed: 560, attackSpeed: 1600, aggro: 6, corpse: 'bones',
    weak: { holy: 1.5, fire: 1.2 }, immune: ['poison', 'earth', 'paralyze'],
    loot: { gold: [0, 10], items: [['bone', 0.5], ['dagger', 0.06], ['short_sword', 0.03], ['leather_legs', 0.05]] },
  },
  ghost: {
    name: 'ghost', hp: 90, xp: 60, dmg: [4, 16], speed: 520, attackSpeed: 1700, aggro: 6, corpse: 'none', invisible: true,
    weak: { holy: 1.6, fire: 1.2 }, immune: ['physical', 'poison', 'earth', 'paralyze'],
    hitCondition: { kind: 'paralyze', chance: 0.1, power: 1 },
    loot: { gold: [5, 30], items: [['book_lore', 0.05], ['ring_life', 0.02]] },
  },
  goblin: {
    name: 'goblin', hp: 55, xp: 25, dmg: [2, 10], armor: 2, speed: 400, attackSpeed: 1500, aggro: 6, corpse: 'blood', flee: 0.2,
    loot: { gold: [0, 15], items: [['goblin_charm', 0.2], ['bread', 0.3], ['hatchet', 0.06], ['spear', 0.1, 1, 3], ['wooden_shield', 0.06], ['leather_armor', 0.04], ['bone_whistle', 0.01]] },
  },
  gnarl: {
    name: 'Old Gnarl', proper: true, hp: 260, xp: 150, dmg: [5, 18], armor: 4, speed: 640, attackSpeed: 1600, aggro: 6,
    corpse: 'big', respawn: 120000,
    spells: [{ kind: 'heal', chance: 0.15, dmg: [20, 35] }],
    loot: { gold: [40, 80], items: [['chain_helmet', 1], ['health_potion', 1, 2, 3], ['leather_boots', 0.5]] },
  },
  crab: {
    name: 'crab', hp: 45, xp: 18, dmg: [2, 9], armor: 6, speed: 600, attackSpeed: 1500, aggro: 4, corpse: 'blood',
    loot: { items: [['crab_claw', 0.4], ['fish', 0.2], ['pearl', 0.02]] },
  },
  orc: {
    name: 'orc', hp: 90, xp: 40, dmg: [4, 18], armor: 4, speed: 420, attackSpeed: 1500, aggro: 7, corpse: 'blood',
    loot: { gold: [5, 25], items: [['orc_tooth', 0.3], ['meat', 0.3], ['hatchet', 0.08], ['chain_helmet', 0.04], ['studded_shield', 0.05]] },
  },
  orc_archer: {
    name: 'orc archer', hp: 70, xp: 45, dmg: [2, 8], armor: 2, speed: 420, attackSpeed: 1800, aggro: 7, corpse: 'blood',
    ranged: { range: 5, dmg: [6, 20], missile: 'arrow', element: 'physical', chance: 0.7, keepDistance: true },
    loot: { gold: [5, 20], items: [['arrow', 0.5, 4, 10], ['orc_tooth', 0.2], ['bow', 0.03]] },
  },
  orc_shaman: {
    name: 'orc shaman', hp: 80, xp: 55, dmg: [1, 6], armor: 2, speed: 460, attackSpeed: 1800, aggro: 7, corpse: 'blood',
    ranged: { range: 4, dmg: [8, 22], missile: 'fire', element: 'fire', chance: 0.6, keepDistance: true },
    spells: [{ kind: 'heal', chance: 0.2, dmg: [15, 30] }, { kind: 'condition', chance: 0.1, condition: 'burning', power: 6, range: 4 }],
    loot: { gold: [5, 30], items: [['mana_potion', 0.1], ['blank_rune', 0.1], ['orc_tooth', 0.2]] },
  },
  bandit: {
    name: 'bandit', hp: 130, xp: 60, dmg: [6, 26], armor: 6, speed: 380, attackSpeed: 1500, aggro: 7, corpse: 'blood', flee: 0.15,
    loot: { gold: [10, 45], items: [['health_potion', 0.15], ['chain_armor', 0.05], ['iron_shield', 0.03], ['broadsword', 0.02], ['chain_legs', 0.05]] },
  },
  pirate: {
    name: 'pirate', hp: 150, xp: 75, dmg: [8, 28], armor: 6, speed: 400, attackSpeed: 1500, aggro: 7, corpse: 'blood',
    loot: { gold: [15, 60], items: [['health_potion', 0.2], ['rope', 0.05], ['broadsword', 0.03], ['pearl', 0.05], ['fish', 0.2]] },
  },
  ogre: {
    name: 'ogre', hp: 240, xp: 120, dmg: [12, 50], armor: 8, speed: 600, attackSpeed: 1700, aggro: 6, corpse: 'big',
    spells: [{ kind: 'area', chance: 0.15, radius: 1, element: 'physical', dmg: [15, 40] }],
    loot: { gold: [20, 70], items: [['ogre_tusk', 0.3], ['meat', 0.5, 1, 3], ['war_hammer', 0.04], ['plate_legs', 0.02], ['steel_helmet', 0.03]] },
  },
  dark_mage: {
    name: 'dark mage', hp: 160, xp: 100, dmg: [2, 10], armor: 2, speed: 480, attackSpeed: 2000, aggro: 7, corpse: 'blood',
    ranged: { range: 5, dmg: [12, 38], missile: 'fire', element: 'fire', chance: 0.8, keepDistance: true },
    summon: { type: 'skeleton', max: 2, chance: 0.12 },
    spells: [{ kind: 'heal', chance: 0.1, dmg: [25, 45] }, { kind: 'condition', chance: 0.1, condition: 'paralyze', power: 1, range: 5 }],
    loot: { gold: [15, 50], items: [['mana_potion', 0.3], ['wizard_hat', 0.04], ['mage_robe', 0.03], ['wand_flames', 0.015], ['rod_thorns', 0.015], ['blank_rune', 0.15]] },
  },
  cyclops: {
    name: 'cyclops', hp: 300, xp: 180, dmg: [12, 55], armor: 8, speed: 560, attackSpeed: 1700, aggro: 6, corpse: 'big',
    ranged: { range: 4, dmg: [10, 40], missile: 'boulder', element: 'physical', chance: 0.2 },
    loot: { gold: [20, 90], items: [['cyclops_toe', 0.3], ['meat', 0.4, 1, 3], ['war_hammer', 0.02], ['steel_helmet', 0.03], ['plate_legs', 0.01]] },
  },
  giant_spider: {
    name: 'giant spider', hp: 500, xp: 400, dmg: [15, 60], armor: 10, speed: 360, attackSpeed: 1500, aggro: 7, corpse: 'slime',
    hitCondition: { kind: 'poison', chance: 0.4, power: 10 }, immune: ['poison', 'earth'], weak: { fire: 1.2 },
    ranged: { range: 3, dmg: [10, 30], missile: 'poison', element: 'poison', chance: 0.3 },
    summon: { type: 'spider', max: 2, chance: 0.06 },
    loot: { gold: [40, 140], items: [['spider_silk', 0.6, 1, 3], ['health_potion', 0.2], ['steel_helmet', 0.05], ['plate_armor', 0.02], ['ring_swift', 0.02]] },
  },
  dragon: {
    name: 'dragon', hp: 900, xp: 800, dmg: [20, 75], armor: 12, speed: 520, attackSpeed: 1700, aggro: 7, corpse: 'big',
    respawn: 120000, immune: ['fire'], weak: { ice: 1.2 },
    spells: [
      { kind: 'area', chance: 0.12, radius: 2, element: 'fire', dmg: [40, 110] },
      { kind: 'bolt', chance: 0.2, range: 5, element: 'fire', dmg: [30, 85], missile: 'fire' },
      { kind: 'heal', chance: 0.05, dmg: [40, 80] },
    ],
    loot: { gold: [80, 220], items: [['dragon_scale', 0.3], ['dragon_ham', 0.5, 1, 3], ['health_potion', 0.2], ['dragon_shield', 0.03], ['plate_legs', 0.05], ['wand_flames', 0.02]] },
  },
  // Kenny: harmless, runs away, and can't stay dead - he walks back in a few seconds later.
  kenny: {
    name: 'Kenny', proper: true, hp: 25, xp: 1, dmg: [0, 1], speed: 340, attackSpeed: 4000, aggro: 0, corpse: 'blood', flee: 1.01,
    respawn: 4000, comesBack: true, loot: { gold: [0, 3] },
  },
  // ---- chiefs of the camps in the wilds: tougher, with better loot ----
  bandit_chief: {
    name: 'Rufus the Bandit Chief', proper: true, hp: 650, xp: 500, dmg: [15, 60], armor: 10, speed: 360, attackSpeed: 1400, aggro: 7, corpse: 'blood',
    respawn: 600000, summon: { type: 'bandit', max: 2, chance: 0.06 },
    loot: { gold: [150, 400], items: [['chain_armor', 0.5], ['broadsword', 0.4], ['ring_swift', 0.2], ['health_potion', 1, 3, 6]] },
  },
  orc_warlord: {
    name: 'Urgoth the Warlord', proper: true, hp: 900, xp: 800, dmg: [20, 75], armor: 12, speed: 400, attackSpeed: 1400, aggro: 8, corpse: 'big',
    respawn: 600000, summon: { type: 'orc', max: 3, chance: 0.08 },
    spells: [{ kind: 'area', chance: 0.12, radius: 1, element: 'physical', dmg: [30, 70] }],
    loot: { gold: [200, 500], items: [['battle_axe', 0.5], ['steel_helmet', 0.4], ['plate_legs', 0.2], ['orc_tooth', 1, 3, 6]] },
  },
  troll_king: {
    name: 'Gubbins the Troll King', proper: true, hp: 700, xp: 550, dmg: [16, 60], armor: 9, speed: 460, attackSpeed: 1500, aggro: 7, corpse: 'big',
    respawn: 600000, summon: { type: 'swamp_troll', max: 3, chance: 0.08 }, spells: [{ kind: 'heal', chance: 0.1, dmg: [60, 100] }],
    loot: { gold: [150, 450], items: [['witch_hat', 0.2], ['ring_life', 0.15], ['swamp_moss', 1, 3, 8], ['health_potion', 1, 3, 5]] },
  },
  nomad_sheik: {
    name: 'Sheik Zarim', proper: true, hp: 1000, xp: 900, dmg: [18, 70], armor: 11, speed: 360, attackSpeed: 1400, aggro: 8, corpse: 'blood',
    respawn: 600000, summon: { type: 'nomad', max: 2, chance: 0.08 },
    ranged: { range: 4, dmg: [20, 50], missile: 'spear', element: 'physical', chance: 0.3 },
    loot: { gold: [300, 700], items: [['crown_helmet', 0.15], ['ring_swift', 0.3], ['scorpion_tail', 1, 2, 4]] },
  },
  yeti_elder: {
    name: 'Old Whitefang', proper: true, hp: 1600, xp: 1500, dmg: [25, 90], armor: 13, speed: 460, attackSpeed: 1600, aggro: 7, corpse: 'big',
    respawn: 600000, immune: ['ice'], weak: { fire: 1.3 }, summon: { type: 'ice_wolf', max: 3, chance: 0.08 },
    ranged: { range: 5, dmg: [25, 60], missile: 'ice', element: 'ice', chance: 0.3 },
    loot: { gold: [300, 800], items: [['frost_blade', 0.1], ['crown_helmet', 0.2], ['fur', 1, 3, 6]] },
  },
  lizard_chieftain: {
    name: 'Chieftain Sskar', proper: true, hp: 1400, xp: 1300, dmg: [22, 80], armor: 14, speed: 400, attackSpeed: 1400, aggro: 8, corpse: 'big',
    respawn: 600000, immune: ['poison', 'earth'], summon: { type: 'lizard_warrior', max: 2, chance: 0.08 },
    loot: { gold: [300, 800], items: [['lizard_mail', 0.3], ['elven_bow', 0.1], ['lizard_scale', 1, 3, 6]] },
  },
  // ---- the wider world: frost, forest, mountains, desert, swamp, jungle, volcano ----
  ice_wolf: {
    name: 'ice wolf', hp: 110, xp: 60, dmg: [6, 22], armor: 3, speed: 300, attackSpeed: 1400, aggro: 7, corpse: 'blood', immune: ['ice'], weak: { fire: 1.2 },
    loot: { gold: [0, 20], items: [['fur', 0.3], ['meat', 0.4]] },
  },
  yeti: {
    name: 'yeti', hp: 380, xp: 230, dmg: [14, 55], armor: 9, speed: 480, attackSpeed: 1700, aggro: 6, corpse: 'big', immune: ['ice'], weak: { fire: 1.3 },
    ranged: { range: 4, dmg: [10, 30], missile: 'ice', element: 'ice', chance: 0.25 },
    loot: { gold: [20, 80], items: [['fur', 0.6, 1, 2], ['meat', 0.5, 1, 3], ['steel_helmet', 0.03], ['frost_blade', 0.005]] },
  },
  polar_bear: {
    name: 'polar bear', hp: 300, xp: 170, dmg: [12, 48], armor: 8, speed: 440, attackSpeed: 1600, aggro: 6, corpse: 'big', immune: ['ice'],
    loot: { items: [['fur', 0.5], ['meat', 0.6, 1, 4], ['bear_paw', 0.3]] },
  },
  frost_dragon: {
    name: 'frost dragon', hp: 1300, xp: 1200, dmg: [25, 90], armor: 14, speed: 520, attackSpeed: 1700, aggro: 7, corpse: 'big',
    respawn: 150000, immune: ['ice', 'paralyze'], weak: { fire: 1.2 },
    spells: [
      { kind: 'area', chance: 0.12, radius: 2, element: 'ice', dmg: [50, 130] },
      { kind: 'bolt', chance: 0.2, range: 5, element: 'ice', dmg: [40, 100], missile: 'ice' },
      { kind: 'condition', chance: 0.06, condition: 'paralyze', power: 1, range: 5 },
    ],
    loot: { gold: [100, 300], items: [['frost_scale', 0.4], ['meat', 0.5, 1, 3], ['frost_blade', 0.04], ['rod_glacier', 0.03], ['crown_helmet', 0.02]] },
  },
  bear: {
    name: 'bear', hp: 140, xp: 60, dmg: [6, 26], armor: 4, speed: 460, attackSpeed: 1500, aggro: 5, corpse: 'big',
    loot: { items: [['meat', 0.6, 1, 3], ['bear_paw', 0.3]] },
  },
  stone_golem: {
    name: 'stone golem', hp: 520, xp: 320, dmg: [16, 60], armor: 18, speed: 700, attackSpeed: 1900, aggro: 5, corpse: 'none',
    immune: ['earth', 'poison', 'paralyze'], weak: { energy: 1.3 },
    loot: { gold: [20, 90], items: [['golem_core', 0.25], ['steel_helmet', 0.04], ['war_hammer', 0.03]] },
  },
  minotaur: {
    name: 'minotaur', hp: 260, xp: 160, dmg: [10, 46], armor: 8, speed: 420, attackSpeed: 1500, aggro: 7, corpse: 'big',
    loot: { gold: [15, 70], items: [['minotaur_horn', 0.25], ['chain_armor', 0.05], ['battle_axe', 0.04], ['plate_legs', 0.01]] },
  },
  minotaur_mage: {
    name: 'minotaur mage', hp: 200, xp: 150, dmg: [4, 16], armor: 4, speed: 440, attackSpeed: 1900, aggro: 7, corpse: 'big',
    ranged: { range: 5, dmg: [14, 40], missile: 'energy', element: 'energy', chance: 0.75, keepDistance: true },
    spells: [{ kind: 'heal', chance: 0.12, dmg: [30, 50] }],
    loot: { gold: [15, 60], items: [['minotaur_horn', 0.2], ['mana_potion', 0.2], ['wand_flames', 0.01], ['blank_rune', 0.15]] },
  },
  scorpion: {
    name: 'scorpion', hp: 140, xp: 65, dmg: [6, 26], armor: 8, speed: 420, attackSpeed: 1500, aggro: 5, corpse: 'slime',
    hitCondition: { kind: 'poison', chance: 0.4, power: 6 }, immune: ['poison', 'earth'],
    loot: { items: [['scorpion_tail', 0.4]] },
  },
  nomad: {
    name: 'nomad', hp: 160, xp: 75, dmg: [6, 28], armor: 6, speed: 380, attackSpeed: 1500, aggro: 7, corpse: 'blood', flee: 0.15,
    ranged: { range: 4, dmg: [8, 24], missile: 'spear', element: 'physical', chance: 0.3 },
    loot: { gold: [10, 50], items: [['health_potion', 0.15], ['spear', 0.15, 1, 2], ['iron_shield', 0.02], ['bread', 0.3]] },
  },
  mummy: {
    name: 'mummy', hp: 300, xp: 200, dmg: [10, 40], armor: 6, speed: 640, attackSpeed: 1700, aggro: 6, corpse: 'bones',
    hitCondition: { kind: 'poison', chance: 0.3, power: 8 }, immune: ['poison', 'earth', 'paralyze'], weak: { fire: 1.4, holy: 1.4 },
    loot: { gold: [20, 80], items: [['mummy_wrap', 0.5], ['ring_life', 0.01], ['mage_robe', 0.03]] },
  },
  sand_king: {
    name: 'the Sand King', proper: true, hp: 2600, xp: 3200, dmg: [30, 100], armor: 14, speed: 560, attackSpeed: 1600, aggro: 8, corpse: 'big',
    respawn: 600000, immune: ['poison', 'earth', 'paralyze'], weak: { fire: 1.3 },
    spells: [
      { kind: 'area', chance: 0.18, radius: 2, element: 'earth', dmg: [50, 120] },
      { kind: 'condition', chance: 0.1, condition: 'poison', power: 14, range: 5 },
      { kind: 'heal', chance: 0.06, dmg: [120, 220] },
    ],
    summon: { type: 'mummy', max: 3, chance: 0.08 },
    loot: { gold: [600, 1200], items: [['golden_armor', 0.3], ['ring_life', 0.5], ['mummy_wrap', 1, 3, 6], ['crown_helmet', 0.3]] },
  },
  swamp_troll: {
    name: 'swamp troll', hp: 120, xp: 55, dmg: [5, 22], armor: 4, speed: 480, attackSpeed: 1500, aggro: 6, corpse: 'blood', flee: 0.1,
    immune: ['poison'], loot: { gold: [0, 25], items: [['swamp_moss', 0.4], ['fish', 0.3], ['spear', 0.1]] },
  },
  crocodile: {
    name: 'crocodile', hp: 170, xp: 75, dmg: [8, 34], armor: 10, speed: 560, attackSpeed: 1600, aggro: 5, corpse: 'blood',
    loot: { items: [['croc_hide', 0.35], ['meat', 0.4]] },
  },
  witch: {
    name: 'witch', hp: 180, xp: 110, dmg: [3, 14], armor: 3, speed: 440, attackSpeed: 1900, aggro: 7, corpse: 'blood',
    ranged: { range: 5, dmg: [12, 34], missile: 'earth', element: 'earth', chance: 0.75, keepDistance: true },
    spells: [{ kind: 'condition', chance: 0.12, condition: 'poison', power: 8, range: 5 }, { kind: 'heal', chance: 0.1, dmg: [20, 40] }],
    loot: { gold: [10, 60], items: [['witch_hat', 0.03], ['mana_potion', 0.2], ['swamp_moss', 0.3], ['blank_rune', 0.2]] },
  },
  viper: {
    name: 'viper', hp: 200, xp: 120, dmg: [8, 30], armor: 4, speed: 360, attackSpeed: 1400, aggro: 6, corpse: 'slime',
    hitCondition: { kind: 'poison', chance: 0.5, power: 10 }, immune: ['poison', 'earth'],
    loot: { gold: [0, 15] },
  },
  lizard_warrior: {
    name: 'lizard warrior', hp: 350, xp: 240, dmg: [14, 52], armor: 11, speed: 420, attackSpeed: 1500, aggro: 7, corpse: 'big',
    ranged: { range: 4, dmg: [12, 34], missile: 'spear', element: 'physical', chance: 0.25 },
    loot: { gold: [20, 90], items: [['lizard_scale', 0.4], ['lizard_mail', 0.02], ['health_potion', 0.2], ['spear', 0.15, 1, 3]] },
  },
  lizard_priest: {
    name: 'lizard priest', hp: 280, xp: 220, dmg: [4, 16], armor: 5, speed: 460, attackSpeed: 1900, aggro: 7, corpse: 'big',
    ranged: { range: 5, dmg: [18, 46], missile: 'earth', element: 'earth', chance: 0.75, keepDistance: true },
    spells: [{ kind: 'heal', chance: 0.18, dmg: [40, 70] }],
    loot: { gold: [20, 80], items: [['lizard_scale', 0.3], ['mana_potion', 0.3], ['rod_thorns', 0.02], ['blank_rune', 0.2]] },
  },
  serpent_lord: {
    name: 'the Serpent Lord', proper: true, hp: 2300, xp: 2800, dmg: [25, 90], armor: 13, speed: 420, attackSpeed: 1500, aggro: 8, corpse: 'big',
    respawn: 600000, immune: ['poison', 'earth'], weak: { ice: 1.3 },
    spells: [
      { kind: 'bolt', chance: 0.2, range: 6, element: 'earth', dmg: [50, 110], missile: 'earth' },
      { kind: 'condition', chance: 0.12, condition: 'poison', power: 16, range: 5 },
      { kind: 'heal', chance: 0.06, dmg: [120, 200] },
    ],
    summon: { type: 'viper', max: 3, chance: 0.1 },
    loot: { gold: [500, 1100], items: [['lizard_mail', 0.4], ['elven_bow', 0.3], ['wand_storm', 0.2], ['rod_glacier', 0.2], ['lizard_scale', 1, 3, 6]] },
  },
  fire_elemental: {
    name: 'fire elemental', hp: 650, xp: 500, dmg: [20, 70], armor: 6, speed: 400, attackSpeed: 1500, aggro: 7, corpse: 'none',
    immune: ['fire', 'poison', 'earth', 'paralyze'], weak: { ice: 1.4 }, hitCondition: { kind: 'burning', chance: 0.4, power: 12 },
    spells: [{ kind: 'area', chance: 0.12, radius: 1, element: 'fire', dmg: [30, 80] }],
    loot: { gold: [30, 120], items: [['ember', 0.35]] },
  },
  dragon_lord: {
    name: 'dragon lord', hp: 1900, xp: 1800, dmg: [30, 110], armor: 16, speed: 500, attackSpeed: 1700, aggro: 8, corpse: 'big',
    respawn: 180000, immune: ['fire', 'paralyze'], weak: { ice: 1.2 },
    spells: [
      { kind: 'area', chance: 0.14, radius: 2, element: 'fire', dmg: [70, 170] },
      { kind: 'bolt', chance: 0.2, range: 6, element: 'fire', dmg: [60, 140], missile: 'fire' },
      { kind: 'heal', chance: 0.05, dmg: [80, 140] },
    ],
    loot: { gold: [150, 400], items: [['dragon_scale', 0.6, 1, 2], ['dragon_ham', 0.5, 1, 4], ['fire_axe', 0.04], ['dragon_shield', 0.06], ['crown_helmet', 0.03], ['golden_armor', 0.01]] },
  },
  demon: {
    name: 'demon', hp: 4200, xp: 5000, dmg: [40, 160], armor: 20, speed: 440, attackSpeed: 1500, aggro: 8, corpse: 'big',
    respawn: 300000, immune: ['fire', 'poison', 'paralyze'], weak: { holy: 1.3, ice: 1.1 },
    spells: [
      { kind: 'area', chance: 0.12, radius: 2, element: 'fire', dmg: [90, 220] },
      { kind: 'bolt', chance: 0.18, range: 6, element: 'energy', dmg: [80, 180], missile: 'energy' },
      { kind: 'condition', chance: 0.06, condition: 'paralyze', power: 1, range: 6 },
    ],
    summon: { type: 'fire_elemental', max: 2, chance: 0.06 },
    loot: { gold: [500, 1500], items: [['demon_horn', 0.6], ['demon_shield', 0.06], ['golden_armor', 0.04], ['fire_axe', 0.06], ['ring_life', 0.2], ['mana_potion', 0.5, 2, 6]] },
  },
  // The end of the Ember Seal story: the demon lord sealed below Cinderhold, half awake.
  ashen_lord: {
    name: 'Vharzul the Ashen', proper: true, hp: 12000, xp: 20000, dmg: [60, 220], armor: 24, speed: 480, attackSpeed: 1400, aggro: 9, corpse: 'big',
    respawn: 1800000, immune: ['fire', 'poison', 'paralyze'], weak: { holy: 1.3, ice: 1.15 },
    spells: [
      { kind: 'area', chance: 0.14, radius: 3, element: 'fire', dmg: [120, 260] },
      { kind: 'bolt', chance: 0.18, range: 7, element: 'fire', dmg: [100, 220], missile: 'fire' },
      { kind: 'condition', chance: 0.08, condition: 'burning', power: 40, range: 7 },
      { kind: 'heal', chance: 0.05, dmg: [300, 600] },
    ],
    summon: { type: 'demon', max: 1, chance: 0.03 },
    loot: { gold: [3000, 6000], items: [['demon_shield', 0.3], ['golden_armor', 0.25], ['fire_axe', 0.25], ['demon_horn', 1, 2, 3], ['ring_life', 0.5], ['ore_sunsteel', 1, 2, 3]] },
  },
  drowned_king: {
    name: 'the Drowned King', proper: true, hp: 1400, xp: 1500, dmg: [20, 70], armor: 10, speed: 520, attackSpeed: 1600, aggro: 8,
    corpse: 'big', respawn: 300000, immune: ['ice', 'poison', 'paralyze'], weak: { energy: 1.3 },
    spells: [
      { kind: 'area', chance: 0.2, radius: 2, element: 'ice', dmg: [30, 70] },
      { kind: 'bolt', chance: 0.2, range: 6, element: 'ice', dmg: [25, 60], missile: 'ice' },
      { kind: 'heal', chance: 0.08, dmg: [80, 150] },
    ],
    summon: { type: 'crab', max: 3, chance: 0.1 },
    loot: { gold: [300, 600], items: [['pearl', 1, 2, 5], ['plate_armor', 0.2], ['wand_flames', 0.15], ['rod_thorns', 0.15], ['crossbow', 0.15]] },
  },
};

// Damage-over-time ticks every `interval` ms; poison weakens by one each tick.
const CONDITIONS = {
  poison: { name: 'poisoned', icon: '☠', element: 'poison', interval: 2000, decay: true },
  burning: { name: 'burning', icon: '🔥', element: 'fire', interval: 2000, ticks: 5 },
  energy: { name: 'electrified', icon: '⚡', element: 'energy', interval: 2000, ticks: 3 },
  paralyze: { name: 'paralyzed', icon: '🕸', duration: 4000, speed: 1.8 },
  haste: { name: 'hasted', icon: '»', duration: 30000, speed: 0.7 },
  shield: { name: 'magic shield', icon: '◈', duration: 180000 },
};

// Fields left on the ground by runes: burn, poison or zap whoever stands in them.
const FIELDS = {
  fire: { name: 'fire field', condition: 'burning', power: 10, duration: 45000 },
  poison: { name: 'poison field', condition: 'poison', power: 8, duration: 60000 },
  energy: { name: 'energy field', condition: 'energy', power: 15, duration: 40000 },
  magic_wall: { name: 'magic wall', block: true, duration: 20000 },
};

// Gains per level, how fast skills train (lower rate = faster), capacity per level.
// regen: [hp, mana] per second while fed. promoted: title after promotion.
const VOCATIONS = {
  none: {
    name: 'no vocation', hp: 5, mana: 5, cap: 10, regen: [2, 2],
    rates: { melee: 1.5, distance: 1.5, shielding: 1.5, magic: 3 },
  },
  knight: {
    name: 'knight', hp: 15, mana: 5, cap: 25, regen: [4, 1], kit: [['chain_armor', 1], ['health_potion', 5]], promoted: 'champion',
    rates: { melee: 1.1, distance: 1.4, shielding: 1.1, magic: 3 },
    desc: 'Knights are tough melee fighters with lots of health. They train swords, axes, clubs and shielding fast.',
  },
  paladin: {
    name: 'paladin', hp: 10, mana: 15, cap: 20, regen: [2, 2], kit: [['bow', 1], ['arrow', 80]], promoted: 'warden',
    rates: { melee: 1.2, distance: 1.1, shielding: 1.1, magic: 1.4 },
    desc: 'Paladins fight from a distance with bows, crossbows and spears, and use some holy magic and healing.',
  },
  sorcerer: {
    name: 'sorcerer', hp: 5, mana: 30, cap: 10, regen: [1, 4], kit: [['wand_sparks', 1], ['mana_potion', 5], ['blank_rune', 5]], promoted: 'archmage',
    rates: { melee: 2, distance: 2, shielding: 1.5, magic: 1.1 },
    desc: 'Sorcerers master fire and energy. They have little health, but deal heavy damage with wands, runes and attack spells.',
  },
  druid: {
    name: 'druid', hp: 5, mana: 30, cap: 10, regen: [1, 4], kit: [['rod_frost', 1], ['mana_potion', 5], ['blank_rune', 5]], promoted: 'hierophant',
    rates: { melee: 2, distance: 2, shielding: 1.5, magic: 1.1 },
    desc: 'Druids master ice and nature and are the best healers. They fight with rods, runes and earth spells.',
  },
};

// tries for the next level = base * rate ^ (level - start)
const SKILLS = {
  magic:     { name: 'magic level', kind: 'magic', start: 0, base: 120 },
  fist:      { name: 'fist fighting', kind: 'melee', start: 10, base: 40 },
  club:      { name: 'club fighting', kind: 'melee', start: 10, base: 40 },
  sword:     { name: 'sword fighting', kind: 'melee', start: 10, base: 40 },
  axe:       { name: 'axe fighting', kind: 'melee', start: 10, base: 40 },
  distance:  { name: 'distance fighting', kind: 'distance', start: 10, base: 30 },
  shielding: { name: 'shielding', kind: 'shielding', start: 10, base: 40 },
};

function skillTries(skill, level, vocation) {
  const s = SKILLS[skill];
  return Math.round(s.base * VOCATIONS[vocation].rates[s.kind] ** (level - s.start));
}

const xpForLevel = level => Math.round((50 / 3) * (level ** 3 - 6 * level ** 2 + 17 * level - 12));

// power: { min: [perLevel, perMagicLevel, perDistance, base], max: [...] }
function powerRange(p, power) {
  const f = ([a, b, c, d]) => Math.round(p.level * a + p.skills.magic.level * b + p.skills.distance.level * c + d);
  return [f(power.min), f(power.max)];
}

// Spells are cast with the hotbar, keys 1-9, F-key hotkeys, or by saying their words.
// kind: heal | light | cure | haste | shield (magic shield) | bolt (ranged, needs a
// target) | area (around you, radius) | wave (cone in front of you) | beam (line in
// front of you, length) | strike (melee, needs a target, mult of your weapon damage) |
// whirl (all adjacent, mult) | conjure (makes items: { item, count, blank: needs a blank rune })
// promoted: only after promotion.
const SPELLS = {
  light:        { name: 'Torchlight', words: 'lumen', level: 2, mana: 15, kind: 'light', desc: 'Lights up dark places for 3 minutes.' },
  light_heal:   { name: 'Light Heal', words: 'vita minor', level: 3, mana: 20, kind: 'heal', power: { min: [0.3, 2, 0, 15], max: [0.5, 3, 0, 25] }, desc: 'Heals a few hitpoints.' },
  cure_poison:  { name: 'Cure Poison', words: 'purga venenum', level: 5, mana: 30, kind: 'cure', desc: 'Cures poison.' },
  haste:        { name: 'Haste', words: 'celeritas', level: 14, mana: 60, kind: 'haste', desc: 'Walk much faster for 30 seconds.' },

  power_strike: { name: 'Power Strike', words: 'vis ictus', vocs: ['knight'], level: 10, mana: 20, kind: 'strike', mult: [0.9, 1.7], desc: 'A heavy blow at your target (melee).' },
  whirlwind:    { name: 'Whirlwind', words: 'vis turbo', vocs: ['knight'], level: 15, mana: 45, kind: 'whirl', mult: [0.7, 1.3], desc: 'Hits every monster next to you.' },
  shield_bash:  { name: 'Shield Bash', words: 'scutum ictus', vocs: ['knight'], level: 18, mana: 35, kind: 'strike', mult: [0.6, 1.2], condition: 'paralyze', desc: 'Stuns your target for a moment.' },
  earthshaker:  { name: 'Earthshaker', words: 'terra quassa', vocs: ['knight'], level: 20, promoted: true, mana: 80, kind: 'whirl', radius: 2, mult: [1, 1.8], desc: 'Shakes the ground: hits everything within 2 tiles.' },
  // Said, not clicked: hidden from the spell bar, so nobody blows themselves up by accident.
  final_blaze:  { name: 'Final Blaze', words: 'allahu akbar', vocs: ['knight', 'paladin', 'sorcerer', 'druid'], level: 15, mana: 0, kind: 'selfdestruct', hidden: true, radius: 2, element: 'fire', power: { min: [3, 4, 0, 60], max: [5, 7, 0, 120] }, desc: 'Blow yourself up: heavy fire damage to everyone within 2 tiles - and you die.' },

  holy_bolt:    { name: 'Holy Bolt', words: 'sanctus', vocs: ['paladin'], level: 10, mana: 25, kind: 'bolt', element: 'holy', range: 5, power: { min: [0.5, 2, 0.4, 8], max: [0.8, 3, 0.6, 18] }, desc: 'Holy damage at range. Very strong against the undead.' },
  conjure_arrows: { name: 'Conjure Arrows', words: 'forma sagitta', vocs: ['paladin'], level: 10, mana: 40, kind: 'conjure', item: 'arrow', count: 15, desc: 'Makes 15 arrows.' },
  greater_heal: { name: 'Greater Heal', words: 'vita major', vocs: ['paladin', 'druid'], level: 12, mana: 50, kind: 'heal', power: { min: [0.6, 4, 0, 40], max: [1, 6, 0, 70] }, desc: 'Heals a lot of hitpoints.' },
  conjure_bolts: { name: 'Conjure Bolts', words: 'forma sagitta gravis', vocs: ['paladin'], level: 15, mana: 60, kind: 'conjure', item: 'bolt', count: 10, desc: 'Makes 10 bolts.' },
  holy_wave:    { name: 'Holy Wave', words: 'sanctus unda', vocs: ['paladin'], level: 18, mana: 70, kind: 'wave', element: 'holy', power: { min: [0.5, 2, 0.5, 15], max: [0.8, 3, 0.8, 30] }, desc: 'A wave of holy light in front of you.' },
  holy_storm:   { name: 'Holy Storm', words: 'sanctus tempestas', vocs: ['paladin'], level: 20, promoted: true, mana: 120, kind: 'area', radius: 3, element: 'holy', power: { min: [0.6, 2.5, 0.6, 20], max: [1, 4, 1, 40] }, desc: 'Holy damage to everything within 3 tiles.' },

  fire_bolt:    { name: 'Fire Bolt', words: 'ignis', vocs: ['sorcerer'], level: 10, mana: 20, kind: 'bolt', element: 'fire', range: 5, power: { min: [0.4, 2.5, 0, 10], max: [0.7, 4, 0, 22] }, desc: 'Fire damage at range.' },
  conjure_missile: { name: 'Conjure Missile', words: 'forma missile', vocs: ['sorcerer', 'druid'], level: 10, mana: 50, kind: 'conjure', item: 'rune_missile', count: 5, blank: true, desc: 'Turns a blank rune into 5 arcane missile runes.' },
  conjure_fire_field: { name: 'Conjure Fire Field', words: 'forma ignis', vocs: ['sorcerer'], level: 12, mana: 60, kind: 'conjure', item: 'rune_fire_field', count: 3, blank: true, desc: 'Turns a blank rune into 3 fire field runes.' },
  conjure_fireball: { name: 'Conjure Fireball', words: 'forma ignis orbis', vocs: ['sorcerer'], level: 13, mana: 70, kind: 'conjure', item: 'rune_fireball', count: 3, blank: true, desc: 'Turns a blank rune into 3 fireball runes.' },
  flame_burst:  { name: 'Flame Burst', words: 'ignis orbis', vocs: ['sorcerer'], level: 14, mana: 50, kind: 'area', radius: 2, element: 'fire', power: { min: [0.5, 2, 0, 12], max: [0.8, 3.5, 0, 25] }, desc: 'Fire damage to every monster within 2 tiles.' },
  magic_shield: { name: 'Magic Shield', words: 'aegis arcana', vocs: ['sorcerer', 'druid'], level: 14, mana: 50, kind: 'shield', desc: 'For 3 minutes, damage takes your mana before your health.' },
  conjure_energy_field: { name: 'Conjure Energy Field', words: 'forma fulmen', vocs: ['sorcerer'], level: 15, mana: 80, kind: 'conjure', item: 'rune_energy_field', count: 3, blank: true, desc: 'Turns a blank rune into 3 energy field runes.' },
  conjure_magic_wall: { name: 'Conjure Magic Wall', words: 'forma murus', vocs: ['sorcerer'], level: 16, mana: 120, kind: 'conjure', item: 'rune_magic_wall', count: 3, blank: true, desc: 'Turns a blank rune into 3 magic wall runes.' },
  energy_beam:  { name: 'Energy Beam', words: 'fulmen linea', vocs: ['sorcerer'], level: 18, mana: 70, kind: 'beam', length: 5, element: 'energy', power: { min: [0.6, 3, 0, 20], max: [1, 5, 0, 40] }, desc: 'A beam of energy straight ahead.' },
  inferno:      { name: 'Inferno', words: 'ignis infernum', vocs: ['sorcerer'], level: 20, promoted: true, mana: 150, kind: 'area', radius: 3, element: 'fire', power: { min: [0.8, 3.5, 0, 30], max: [1.2, 5.5, 0, 60] }, desc: 'Fire damage to everything within 3 tiles.' },

  ice_bolt:     { name: 'Ice Bolt', words: 'glacies', vocs: ['druid'], level: 10, mana: 20, kind: 'bolt', element: 'ice', range: 5, power: { min: [0.4, 2.5, 0, 10], max: [0.7, 4, 0, 22] }, desc: 'Ice damage at range.' },
  conjure_heal: { name: 'Conjure Healing Rune', words: 'forma vita', vocs: ['druid'], level: 11, mana: 60, kind: 'conjure', item: 'rune_heal', count: 1, blank: true, desc: 'Turns a blank rune into a healing rune.' },
  conjure_poison_field: { name: 'Conjure Poison Field', words: 'forma venenum', vocs: ['druid'], level: 12, mana: 50, kind: 'conjure', item: 'rune_poison_field', count: 3, blank: true, desc: 'Turns a blank rune into 3 poison field runes.' },
  thorn_burst:  { name: 'Thorn Burst', words: 'spina orbis', vocs: ['druid'], level: 14, mana: 50, kind: 'area', radius: 2, element: 'earth', power: { min: [0.5, 2, 0, 12], max: [0.8, 3.5, 0, 25] }, desc: 'Earth damage to every monster within 2 tiles.' },
  conjure_paralyze: { name: 'Conjure Paralyze', words: 'forma vincula', vocs: ['druid'], level: 18, mana: 120, kind: 'conjure', item: 'rune_paralyze', count: 1, blank: true, desc: 'Turns a blank rune into a paralyze rune.' },
  frost_wave:   { name: 'Frost Wave', words: 'glacies unda', vocs: ['druid'], level: 18, mana: 70, kind: 'wave', element: 'ice', power: { min: [0.6, 3, 0, 20], max: [1, 5, 0, 40] }, desc: 'A wave of frost in front of you.' },
  blizzard:     { name: 'Blizzard', words: 'glacies tempestas', vocs: ['druid'], level: 20, promoted: true, mana: 150, kind: 'area', radius: 3, element: 'ice', power: { min: [0.8, 3.5, 0, 30], max: [1.2, 5.5, 0, 60] }, desc: 'Ice damage to everything within 3 tiles.' },
};

// Spells a vocation can learn, in the order of the hotbar.
function spellsFor(vocation) {
  return Object.keys(SPELLS)
    .filter(id => !SPELLS[id].vocs || SPELLS[id].vocs.includes(vocation))
    .sort((a, b) => (SPELLS[a].hidden ? 1 : 0) - (SPELLS[b].hidden ? 1 : 0) || SPELLS[a].level - SPELLS[b].level
      || (SPELLS[a].promoted ? 1 : 0) - (SPELLS[b].promoted ? 1 : 0));
}
