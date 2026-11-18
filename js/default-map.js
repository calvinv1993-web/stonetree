'use strict';
// The built-in world: Oakvale Isle, a hand-designed starter island in the classic
// style (the plan, with every coordinate, is in docs/world-plan.md).
//
// Every feature is drawn from the coordinates in ISLE_DESIGN below: outlines (coast,
// lakes, forests, mountains...) and lines (rivers, roads). Editing one place never moves
// another. The only "randomness" is a fixed hash of the coordinates, which roughens
// coastlines by a tile or two and scatters trees and flowers inside the drawn areas, so
// the world comes out the same in every browser and on the server.
//
// Coordinates: x goes east, y south, z up. 256 x 256 tiles on 16 floors; the surface is
// floor 8, floors 0-7 are underground and 9-15 above ground (mountain tops, upper storeys,
// roofs). A mountain is cliffs on one floor with its top on the floor above, at the same
// x, y (each floor up is drawn one tile up-left, so the top sits on the cliffs).

const WORLD_SIZE = { width: 256, height: 256, depth: 16, surfaceZ: 8 };

// Named places, for the in-game maps and the editor's "Go to". [name, x, y, z]
const KESTREL_PREVIEW = typeof WORLD_PREVIEW !== 'undefined' && WORLD_PREVIEW === 'kestrel'; // (the new world's preview: see js/world-kestrel.js)
const MAP_TOWNS = KESTREL_PREVIEW ? [['Bellhaven', 125, 104, 9]] : [['Oakvale', 137, 104, 9]];
const MAP_SIGHTS = KESTREL_PREVIEW ? [] : [
  ['North Peaks', 100, 57, 9], ['Mirror Lake', 128, 57, 8], ['Willow River', 121, 76, 8], ['Wolf Woods', 60, 84, 8],
  ['Frog Marsh', 56, 128, 8], ["Fisher's Rest", 48, 174, 8], ['Bone Rocks', 76, 198, 9], ['Sunny Fields', 130, 160, 8],
  ['Lighthouse Point', 128, 204, 8], ['Spider Hills', 178, 196, 9], ['Deer Woods', 176, 112, 8], ['Old Tower', 194, 118, 9],
  ['Goblin Hill', 190, 74, 8], ['Hermit Rock', 202, 48, 9], ['Stony Field', 96, 74, 8],
];

// The island as drawn. Outlines are [x, y] corners in order. Roads and rivers are drawn the way
// the classic maps draw them: straight runs, north-south or east-west, with turns and jogs;
// [x, y, width] sets the width from that point on. Town in the middle, Willow River along its
// west side; hunting grounds get harder the further they are from town.
const ISLE_DESIGN = {
  coast: [
    [52, 40], [70, 30], [96, 28], [120, 26], [140, 32], [160, 36], [178, 34], [198, 30], [214, 38], // north coast
    [220, 56], [214, 72], [222, 90], [218, 110], [224, 130], [216, 150], [222, 170], [212, 190], // east coast
    [200, 206], [184, 212], [166, 208], [150, 214], [142, 222], [124, 224], [116, 212], // south coast, Lighthouse Point
    [100, 214], [84, 216], [66, 212], [52, 200], [46, 184], [36, 174], // south-west
    [40, 158], [34, 140], [40, 120], [34, 100], [40, 80], [36, 60], // west coast
  ],
  islets: [],
  // Rocky shores: rocky ground and boulders (some out in the shallows) instead of a beach
  rocky: [
    [[40, 16], [140, 16], [136, 44], [56, 52], [40, 50]],   // under the North Peaks
    [[186, 24], [232, 24], [232, 62], [188, 58]],            // Hermit Rock
    [[40, 190], [96, 196], [96, 230], [40, 230]],            // below Bone Rocks
    [[112, 204], [150, 204], [150, 232], [112, 232]],        // Lighthouse Point
  ],
  town: { x0: 94, y0: 89, x1: 158, y1: 151 },  // Oakvale (the plan is OAKVALE below)
  clearings: [ // kept clear for buildings and camps (phase 4)
    { name: "Fisher's Rest", x0: 42, y0: 170, x1: 56, y1: 182 },
    { name: 'Sunny Fields farm', x0: 112, y0: 150, x1: 126, y1: 160 },
    { name: 'Lighthouse', x0: 122, y0: 200, x1: 134, y1: 210 },
    { name: 'Goblin camp', x0: 184, y0: 66, x1: 198, y1: 78 },
    { name: 'Lumber camp', x0: 56, y0: 96, x1: 66, y1: 104 },
  ],
  lakes: [
    [[110, 40], [122, 35], [136, 41], [137, 53], [125, 58], [111, 54], [106, 47]],  // Mirror Lake
    [[156, 62], [164, 60], [168, 66], [160, 70]],                                 // a pond where the old lake was
    [[136, 166], [144, 164], [146, 172], [138, 174]],                             // a pond in Sunny Fields
    [[180, 136], [188, 134], [190, 142], [182, 144]],                             // a pond in Deer Woods
  ],
  rivers: [
    { name: 'Willow River', width: 3, line: [[121, 56], [121, 125], [84, 125], [84, 150], [60, 150], [60, 166, 4], [30, 166]] },
    { name: 'Deer Brook', width: 2, line: [[186, 142], [186, 156], [204, 156], [204, 170], [228, 170]] },
  ],
  // Mountains: rock walls on the surface, rugged crags on top (one floor up), and on the big ones a
  // second tier of rock and crags above that. You can only walk on a ledge where a path (ramp)
  // leads up from the south, or across the whole top of a hill (walkable).
  mountains: [
    { name: 'North Peaks', outline: [[62, 50], [78, 40], [94, 42], [106, 48], [105, 58], [92, 62], [76, 60]], tiers: 3, ramps: [99] },
    { name: 'Bone Rocks', outline: [[62, 178], [80, 174], [92, 182], [90, 198], [74, 202], [62, 194]], tiers: 2, ramps: [76] },
    { name: 'Spider Hills', outline: [[164, 172], [180, 166], [194, 176], [192, 192], [176, 200], [166, 190]], tiers: 3, ramps: [178] },
    { name: 'Old Tower', outline: [[186, 112], [198, 110], [204, 118], [198, 126], [186, 124]], tiers: 1, ramps: [194], walkable: true },
    { name: 'Hermit Rock', outline: [[192, 40], [208, 40], [212, 52], [200, 56], [192, 50]], tiers: 1, ramps: [202], walkable: true },
  ],
  // Small rocky outcrops scattered over the island, as on the old maps: [x, y, half width, half height, tiers]
  rocks: [
    [150, 76, 6, 4, 2], [166, 80, 4, 3, 1], [158, 48, 4, 3, 1], [205, 98, 4, 4, 1], [214, 142, 4, 5, 2], [196, 154, 5, 3, 1],
    [160, 140, 4, 3, 1], [112, 198, 5, 3, 2], [106, 182, 4, 3, 1], [72, 158, 4, 3, 1], [50, 152, 4, 4, 2], [78, 96, 4, 3, 1],
    [52, 78, 4, 4, 2], [74, 72, 3, 3, 1], [142, 158, 4, 3, 1], [112, 156, 3, 2, 1], [208, 186, 4, 3, 1], [190, 206, 4, 3, 1],
    [82, 210, 4, 3, 1], [44, 196, 4, 3, 1], [172, 100, 4, 3, 1], [184, 44, 4, 3, 1], [146, 44, 3, 3, 1], [94, 142, 3, 3, 1],
  ],
  // Rocky ground with boulders: walkable, open, stony
  stonefields: [
    { name: 'Stony Field', outline: [[88, 64], [104, 66], [108, 78], [94, 82], [86, 74]] },
    { name: 'Goblin Hill', outline: [[176, 58], [204, 58], [208, 84], [186, 88], [174, 78]] },
    { name: 'Cape rocks', outline: [[140, 200], [152, 196], [156, 208], [144, 212]] },
  ],
  // Forests: kind (which trees), density (0-1, the thickest part), outline. Trees grow in clumps
  // with glades between them, bushes and ferns round their edges.
  forests: [
    { name: 'Wolf Woods', kind: 'pine', density: 0.62, outline: [[42, 64], [60, 58], [76, 68], [84, 90], [80, 108], [60, 112], [44, 104], [40, 84]] },
    { name: 'Deer Woods', kind: 'oak', density: 0.55, outline: [[156, 92], [190, 88], [212, 100], [214, 140], [204, 160], [176, 160], [158, 140], [152, 112]] },
    { name: 'Owl Grove', kind: 'mixed', density: 0.45, outline: [[132, 84], [144, 86], [146, 96], [134, 96]] },
    { name: 'Fox Copse', kind: 'oak', density: 0.45, outline: [[86, 152], [100, 150], [102, 162], [88, 162]] },
    { name: 'Thorn Thicket', kind: 'mixed', density: 0.45, outline: [[140, 176], [158, 176], [158, 190], [142, 190]] },
  ],
  marshes: [
    { name: 'Frog Marsh', outline: [[42, 114], [62, 112], [72, 124], [70, 144], [52, 146], [42, 136]] },
  ],
  meadows: [ // flowery meadows (no trees)
    { name: 'Sunny Fields', outline: [[108, 146], [150, 146], [152, 184], [110, 186]] },
    { name: 'Lakeside', outline: [[108, 60], [132, 60], [132, 74], [108, 74]] },
  ],
  // Roads and trails: straight runs and turns, 2 or 3 wide; where they cross water they become bridges.
  roads: [
    { name: 'North road', width: 3, line: [[126, 92], [126, 84], [100, 84], [100, 61], [97, 61], [97, 60]] },
    { name: 'West road', width: 3, line: [[97, 121], [90, 121], [90, 116], [70, 116]] },
    { name: 'South road', width: 3, line: [[126, 150], [126, 199]] },
    { name: 'East road', width: 3, line: [[155, 121], [176, 121], [176, 130], [194, 130], [194, 125]] },
  ],
  paths: [
    { name: 'Lake trail', line: [[126, 84], [140, 84], [140, 50], [137, 50]] },
    { name: 'Goblin trail', line: [[140, 84], [146, 84], [146, 87], [180, 87], [180, 80], [190, 80], [190, 62], [202, 62], [202, 54], [205, 54], [205, 53]] },
    { name: 'Spider trail', line: [[170, 121], [170, 158], [152, 158], [152, 203], [178, 203], [178, 199]] },
    { name: 'Bone trail', line: [[126, 164], [96, 164], [96, 205], [76, 205], [76, 200]] },
    { name: 'Fisher trail', line: [[96, 172], [56, 172]] },
    { name: 'Lumber trail', line: [[70, 116], [70, 100], [66, 100]] },
    { name: 'Marsh trail', line: [[70, 116], [56, 116], [56, 130]] },
  ],
};

// Oakvale, the town: a walled town in a ring of water, as the old starter towns were. The square with its
// compass lies in the very middle; the high street runs from the north gate across it to the south gate, the cross
// street from the west gate to the east gate. A canal comes in under the north wall and runs down the west side of
// the square and out under the south wall. Round the square:
//   - north-east, on its mount: the Temple of the Dawn (where new characters wake) and the bell tower;
//   - north-west: the Sleepy Boar (the inn, green roof), and the cottages below it;
//   - east: the shops, Pip's Provisions and Moonpetal Magic; south-east: the smithy, the armourer, the graveyard;
//   - south: the academy (yellow roof; the oracle upstairs) and the depot across the high street from it;
//   - south-west: the training yard and a vegetable garden.
// A beginner's first walk: down the temple's steps onto the square, to the academy and the depot south of it, the
// shops east of it, and out of a gate.
//   bounds:    the area the town is built in (cleared first)
//   moat:      water round the wall { min, max }: its width wanders between them (the river's bed through the bounds is kept as well)
//   ramparts:  the town wall, a ring x0..x1, y0..y1, `thick` tiles deep: solid masonry with a walkway on top (the floor
//              above) all the way round, battlements on its outer edge; gates: where streets go through it (the walkway
//              goes on over them, as it does over water); stairs: stone stairs in its inner face, up
//              inside [[x, y], ...]; a tower stands on each corner, with a door into town, stairs up to the walkway
//              and the lookout on top, and (where it has an exit) a door out over a footbridge (exits: its side, NW NE SW SE)
//   hills:     rocky hills { outline, tiers }: rock walls with a rugged top
//   wall:      stone wall pieces [x0, y0, x1, y1]; gaps: where the gates are
//   streets:   { line, width, ground }, drawn like the roads outside; bridges where they cross water
//   square:    the town square, as rectangles [x0, y0, x1, y1]
//   buildings: { id, name, kind, x0, y0, x1, y1, wings, door: [x, y], floors, floor, wall, roof, sign,
//                signId, shelves, arch (a wide open archway, three tiles across, instead of a door) }; kind says how it's furnished: temple, academy, depot, shop, smithy, inn, house
//   houses:    the buildings players can rent, with their rent
//   paths:     gravel paths to doors, as lines of points
const OAKVALE = {
  bounds: { x0: 94, y0: 89, x1: 158, y1: 151 },  // (not further south: the farm by the south road starts there)
  // the moat: water round the wall, against its foot; its far bank wanders, so it is now three tiles wide, now five (less on the south, where the farm begins)
  // (min..max), and its corners are round
  moat: { min: 3, max: 5 },
  hills: [],
  // (the wall's middle, (126, 121), is the middle of the square: the four gates face each other across it)
  ramparts: { x0: 99, y0: 94, x1: 153, y1: 148, thick: 3,
    gates: [[125, 94, 127, 96], [125, 146, 127, 148], [99, 120, 101, 122], [151, 120, 153, 122]],
    stairs: [[130, 96]], exits: [null, null, null, null] }, // (exits: the side each corner tower opens on to the outside, NW NE SW SE; null: none)
  start: { x: 137, y: 104 }, // in the temple on the mount, before the altar (one floor up)
  // The bell tower (a building, see buildings): stairs: up from each floor, from the ground; shaft: the column of
  // open hatches the bell rope runs down; bell: the north-west tile of the great bell (2x2) at the top; rules: a sign
  // on the ringers' wall [x, y, text].
  belltower: { stairs: [[145, 101], [147, 101], [145, 101], [147, 101]], shaft: [147, 102], bell: [145, 102],
    rules: [146, 100, 'THE BELL OF OAKVALE. Rung at dawn, for weddings, for the dead - and when danger comes from the sea. Since the founders\' day it has never been silent for longer than a night.'],
    look: 'The bell of Oakvale, cast from the bronze of the first settlers\' ship. Its voice carries over the whole isle - when it has its clapper.' },
  // The temple mount: a knoll of rock north of the square, its top one floor up, with the temple on it, a terrace
  // in front and the bell tower on its east shoulder; a broad flight of stone steps runs down from the terrace to the
  // square. outline: its foot, roughened a little (see the mount below); keep: what must stand on it (the temple with
  // its path round it, the terrace, the bell tower and the way to it); clear: never on it; x0..y1: the box it lies in (y1: the steps' row).
  mount: { x0: 128, y0: 99, x1: 149, y1: 109, steps: [136, 137, 138],
    outline: [[128.6, 103.4], [129.8, 100.9], [132.4, 100.2], [136.8, 99.9], [141.4, 100.4], [143.6, 99.6], [149.6, 99.4],
      [150, 102.5], [149.6, 106.4], [146.4, 106.6], [143.9, 107.4], [142.9, 110], [131.9, 110], [129.9, 109.3], [128.5, 106.6]],
    keep: [[131, 99, 142, 108], [128, 102, 131, 107], [134, 109, 140, 109], [143, 99, 149, 106], [142, 105, 143, 106]], clear: [] }, // (a rim round the bell tower)
  streets: [
    { line: [[126, 89], [126, 151]], width: 3, ground: 'cobble' },              // the high street: north gate, the square, south gate
    { line: [[94, 121], [158, 121]], width: 3, ground: 'cobble' },              // across: west gate, the square, east gate
    { line: [[103, 130], [146, 130]], width: 2, ground: 'cobble' },             // the lane of shops, south of the square: narrower, one line across
    { line: [[110, 107], [110, 130]], width: 3, ground: 'cobble' },             // the academy lane
  ],
  // The canal: water let in from the moat under the north wall, down the west side of the square and out under the
  // south wall again; line: its middle, point to point (any angle), width 2; a bank that bulges a tile here and there;
  // weir: a low stone step across it, the water foaming over (the little waterfall); lilies and reeds: [x, y]
  canal: { width: 2, line: [[118, 91], [118, 101], [119, 101], [119, 110], [118, 110], [118, 126], [117, 126], [117, 129], [116, 129], [116, 151]],
    weir: [[118, 103], [116, 135]], lilies: [[119, 98], [119, 115], [117, 140], [116, 145]], reeds: [[117, 99], [120, 110], [115, 138], [118, 144]] },
  // the square: an octagon round the compass in the middle of town, and the way down from the temple's steps to it
  square: [[122, 115, 130, 127], [120, 117, 132, 125], [121, 116, 131, 126], [136, 110, 138, 119]], // (the last: the temple walk, straight down from its steps to the cross street)
  buildings: [
    { id: 'temple', name: 'Temple of the Dawn', kind: 'temple', x0: 133, y0: 101, x1: 141, y1: 106, level: 1, door: [137, 106], arch: true, floor: 'marble', wall: 'wall_temple', roof: 'roof', signId: 'sign_temple', sign: 'Temple of the Dawn. You wake here when you first come to Oakvale Isle, and again whenever you die. Nobody can fight inside a temple.' },
    { id: 'belltower', name: 'The Bell Tower', kind: 'belltower', x0: 144, y0: 100, x1: 148, y1: 104, door: [146, 104], level: 1, floors: 4, floor: 'paving', wall: 'wall_temple', signId: 'sign_temple', sign: 'The Bell Tower of Oakvale, the highest tower in town. Its bell has rung over the isle since the founders\' day.' },
    { id: 'depot', name: 'Depot and Post', kind: 'depot', x0: 119, y0: 133, x1: 124, y1: 143, door: [121, 133], floor: 'marble', wall: 'wall_stone', roof: 'roof', signId: 'sign_depot', sign: 'Depot and post. Put things in a locker to keep them safe: your locker is yours for good.' },
    { id: 'academy', name: 'Oakvale Academy', kind: 'academy', x0: 131, y0: 133, x1: 140, y1: 140, door: [135, 133], floors: 2, floor: 'tiles', wall: 'wall_stone', roof: 'roof_thatch', signId: 'sign_school', sign: 'Oakvale Academy. New here? The teachers explain the basics. Upstairs, the oracle names the path of adventurers of level 10.' },
    { id: 'magic', name: 'Moonpetal Magic', kind: 'shop', x0: 104, y0: 123, x1: 108, y1: 128, door: [108, 125], floor: 'wood', wall: 'wall_wood', roof: 'roof_shingle', signId: 'sign_magic', shelves: 'shelf', sign: 'Moonpetal Magic: runes, wands and potions. Say hi to the shopkeeper, then ask to trade.' },
    { id: 'smith', name: 'The Dented Shield', kind: 'smithy', x0: 134, y0: 124, x1: 140, y1: 129, door: [137, 129], floor: 'cobble', wall: 'wall_stone', roof: 'roof', signId: 'sign_weapons', shelves: 'weapon_rack', sign: 'The Dented Shield: weapons, bought and sold. Say hi, then ask to trade.' },
    { id: 'armour', name: 'Hide and Iron', kind: 'shop', x0: 142, y0: 124, x1: 148, y1: 129, door: [145, 129], floor: 'wood', wall: 'wall_wood', roof: 'roof', signId: 'sign_armour', shelves: 'weapon_rack', sign: 'Hide and Iron: armour, helmets and shields. Say hi, then ask to trade.' },
    { id: 'general', name: 'Pip\'s Provisions', kind: 'shop', x0: 140, y0: 113, x1: 143, y1: 118, door: [141, 118], floor: 'wood', wall: 'wall_wood', roof: 'roof_shingle', signId: 'sign_tools', shelves: 'shelf', sign: 'Pip\'s Provisions: food, potions, ropes, shovels, picks and fishing rods. Every adventurer needs a rope and a shovel.' },
    { id: 'inn', name: 'The Sleepy Boar', kind: 'inn', x0: 104, y0: 99, x1: 113, y1: 106, door: [108, 106], floors: 2, floor: 'wood', wall: 'wall_wood', roof: 'roof_green', signId: 'sign_inn', shelves: 'shelf', sign: 'The Sleepy Boar: food, drink and a bed.' },
    { id: 'fisher', name: 'The Fisher\'s Hut', kind: 'shop', x0: 112, y0: 108, x1: 116, y1: 118, door: [112, 112], floor: 'wood', wall: 'wall_wood', roof: 'roof_thatch', signId: 'sign_wall', shelves: 'shelf', sign: 'The Fisher\'s Hut: fishing rods, and fish bought and sold. The jetty out back is the place to learn.' },
    { id: 'bakery', name: 'The Warm Loaf', kind: 'shop', x0: 112, y0: 124, x1: 115, y1: 128, door: [114, 124], floor: 'wood', wall: 'wall_stone', roof: 'roof_thatch', signId: 'sign_food', shelves: 'shelf', sign: 'The Warm Loaf: bread from the grain of Oakvale\'s own field, cheese, apples and meat. Eat to get your health and mana back faster.' },
    { id: 'farm', name: 'The Hay Barn', kind: 'farm', x0: 104, y0: 133, x1: 111, y1: 137, door: [107, 133], floors: 2, floor: 'wood', wall: 'wall_wood', roof: 'roof_thatch', signId: 'sign_wall', sign: 'The town farm\'s barn. Its grain feeds the Warm Loaf\'s ovens; the hay is kept in the loft.' },
    { id: 'mill', name: 'The Water Mill', kind: 'mill', x0: 112, y0: 139, x1: 115, y1: 143, door: [113, 139], floor: 'wood', wall: 'wall_stone', roof: 'roof_slate', signId: 'sign_wall', sign: 'The water mill: the canal turns its wheel, and its stones grind the town\'s grain.' },
    { id: 'house4', name: 'Bell Cottage', kind: 'house', x0: 104, y0: 109, x1: 108, y1: 118, door: [108, 113], floor: 'wood', wall: 'wall_wood', roof: 'roof' },
    { id: 'watch', name: 'The Watch House', kind: 'shop', x0: 145, y0: 113, x1: 148, y1: 118, door: [146, 118], floor: 'wood', wall: 'wall_stone', roof: 'roof_slate', signId: 'sign_wall', shelves: 'weapon_rack', sign: 'The Watch House. Bring your watch marks: the quartermaster keeps the watch\'s stores.' },
  ],
  houses: { house4: 450 }, // (one house to let, by the inn: Bell Cottage)
  // Fenced gardens: vegetable rows (crops on farmland) or flower beds; gate: the gap in the fence.
  gardens: [
    { x0: 128, y0: 134, x1: 129, y1: 139, kind: 'flowers' },
    { x0: 136, y0: 141, x1: 140, y1: 143, kind: 'flowers' },                  // the academy's garden
    { x0: 104, y0: 138, x1: 111, y1: 143, kind: 'crops', gate: [107, 138] },   // the town's grain field, below the hay barn (open on to it: the way in)
  ],
  // The old graveyard: a fence, a gate, and gravestones you can read (look at them).
  graveyard: { x0: 107, y0: 75, x1: 114, y1: 79, gate: [114, 77], stones: [ // (outside the walls, north-west of the north gate, a path from it down to the north road)
    [108, 76, 'Here lies Old Wim, who went down the well for a bet.'],
    [110, 76, 'An adventurer who never bought a rope.'],
    [112, 76, 'Bertha Oakhart. She fed the town through the long winter.'],
    [109, 78, 'Sir Galen. He said the rats in the cellar were "only rats".'],
    [111, 78, 'Taken by the spiders of the hills. Go well armed, friend.'],
    [113, 78, 'No name. Only the words: "the hills remember".'],
    // the three of the Old Tower's last watch, side by side: the order they came to the wall is the order of its levers
    [108, 78, 'Watchman Oswin of the Old Tower. When the horn blew he was always FIRST up the stair, and he held the EAST wall.'],
    [110, 78, 'Watchwoman Marrow of the Old Tower. SECOND to the wall, every time, and she kept the WEST side of it.'],
    [112, 78, 'Watchman Tobin, the last of the Old Tower\'s watch. He came up THIRD and stood in the MIDDLE, and the cellar was his to keep. He keeps it still, they say.'],
  ] },
  // Grates over the sewers, and what you notice when you look at them.
  grates: [[130, 117], [140, 131], [110, 128], [127, 141]],
  grateLook: 'A rusty grate over the sewers. Something squeaks and scratches down there in the dark. Use it to climb down.',
  // Things with something to say when you look at them: [x, y, text]
  looks: [ // (the well's: see WELL_TUNNELS)
    [140, 119, 'Tobias Oakhart, who built the first house by the river, and the bridge after it.'],
  ],
  // A forgotten chest for whoever explores the strip behind the academy: [x, y, gold]
  cache: [105, 97, 30],
  // The training yard: a fenced sandy yard with dummies.
  yard: { x0: 142, y0: 133, x1: 148, y1: 143, gate: [145, 133] }, // (in the south-east corner)
  paths: [
    [[121, 132], [121, 132]],                   // the depot, onto the lane
    [[141, 119], [141, 119]], [[146, 119], [146, 119]], // Pip's and the Watch House, onto the cross street
    [[108, 107], [108, 107]],                   // the inn
    [[114, 123], [114, 123]],                          // the houses on the lane
    [[137, 130], [137, 130]], [[145, 130], [145, 130]],                          // the smithy and the armourer
    [[135, 132], [135, 132]],                   // the academy
    [[107, 132], [107, 132]],                   // the hay barn
    [[113, 132], [113, 138]],                   // the water mill
    [[115, 77], [115, 83]],                     // from the graveyard's gate down to the north road
    [[145, 132], [145, 132]],                   // the training yard
  ],
  pier: [118, 113, 118, 114], // the fisher's jetty out over the canal
  // Things standing about: [x, y, id]
  props: [
    [145, 109, 'bench'], [147, 109, 'bench'], [146, 108, 'flowers'], [144, 110, 'flowers'], [148, 110, 'flowers'], [146, 111, 'tree'], // (a garden below the bell tower)
    [124, 110, 'well'], [121, 118, 'stall'], [121, 119, 'apple_crate'], [131, 118, 'stall'], [131, 119, 'sack'],
    [121, 124, 'barrel'], [121, 125, 'crate'], [131, 124, 'stall'], [148, 132, 'barrel'], [149, 132, 'crate'], [150, 132, 'firewood'],
    [123, 128, 'wagon'],
     [123, 143, 'bench'],
  ],
  lamps: [[124, 98], [128, 98], [124, 104], [124, 110], [124, 133], [128, 133], [124, 139], [128, 139], [124, 144], [128, 144],
    [103, 119], [103, 123], [149, 119], [149, 123], [116, 119], [116, 123], [144, 119], [143, 123], [120, 116], [132, 116],
    [120, 126], [132, 126], [112, 107], [112, 127], [135, 110], [139, 110], [135, 115], [139, 115]],
  benches: [[122, 116], [130, 116], [122, 126], [130, 126]],
  planters: [],
  mosaic: [126, 121], // the compass mosaic (its centre tile; it reaches two tiles round): the middle of the square, and of the town
  statue: [140, 119],
  signs: [
    [124, 87, 'North: Mirror Lake and the North Peaks. South: Oakvale.'],
    [92, 119, 'West: Frog Marsh and Wolf Woods. East: Oakvale.'],
    [160, 119, 'East: Deer Woods, the Old Tower and the Spider Hills. West: Oakvale.'],
    [124, 155, 'South: Sunny Fields, Bone Rocks and Lighthouse Point. North: Oakvale.'],
    [132, 210, 'Lighthouse Point. The old light of Oakvale fell in the great storm; the new tower has never been lit. Keeper Tamsin keeps a fire.'],
  ],
  // The townsfolk: [type, x, y, z]; each stands on the nearest free tile to that spot.
  people: [
    ['ama', 136, 103, 9], ['corwin', 135, 137, 8], ['oak_oracle', 135, 136, 9], ['postmaster', 121, 136, 8], ['pip', 141, 115, 8],
    ['oak_smith', 136, 126, 8], ['oak_armourer', 143, 126, 8], ['oak_mage', 106, 125, 8], ['oak_baker', 113, 126, 8], ['oak_innkeeper', 106, 102, 8], ['oak_landlady', 111, 103, 8], ['oak_fisher', 114, 114, 8], ['oak_quartermaster', 146, 115, 8], ['oak_farmer', 106, 135, 8], ['oak_keeper', 134, 210, 8], ['oak_hermit', 194, 48, 9],
    ['gate_north', 125, 98, 8], ['gate_east', 149, 120, 8], ['gate_south', 127, 144, 8], ['gate_west', 103, 122, 8], // (each on the street, just inside its gate)
    ['townsman', 123, 117, 8], ['townswoman', 129, 125, 8], ['child', 129, 118, 8], ['cat', 122, 123, 8], ['old_man', 140, 132, 8],
  ],
  notice: [139, 118, 'NOTICE: Rats in the cellars again! Brave helpers, ask in town.'],
  founder: [129, 103], // the statue of the founder (3 x 3 tiles, its north-west corner), west of the temple on the mount
  firstSteps: [140, 110, 'Welcome to Oakvale Isle! Up the steps behind you is the temple; down the walk is the square, with the compass in the middle of town. The shops are east of the square, the academy (yellow roof) and the depot south of it, the inn north-west. Four gates lead out. Beyond the walls: rats first, then the wolves of the woods. Look at things: many have a story.'],
};

// The sewers under Oakvale, one floor down: brick tunnels under the main streets, each with a channel of
// murky water down the middle and a walkway on either side. You climb down through the grates in the
// streets (OAKVALE.grates); a ladder under each one leads back up. The rats live here, and the big ones
// nest where the brickwork has fallen in, under the training yard. A dead end under the temple mount is the
// old bell cellar, where the temple bell's rope comes down.
//   z:        the floor they're on
//   walks:    walkways and rooms, [x0, y0, x1, y1] (damp flagstones)
//   channels: water, [x0, y0, x1, y1], laid over the walkways
//   bridges:  [x, y] planks over a channel (they run across it)
//   rooms:    old stone rooms { x0, y0, x1, y1, ground, wall }
//   caves:    where the brickwork has fallen in: rough earth { cx, cy, rx, ry }
//   torches:  wall torches on north walls, [x, y]
//   props:    [x, y, id]; rats, bigRats: where they live, [x, y]
const SEWERS = {
  z: 7,
  walks: [
    [104, 128, 147, 132], // under the main street, from the west gate to the east side
    [130, 108, 134, 127], // north, under the square, to the temple mount
    [133, 107, 134, 107], // the way into the bell cellar
    [124, 133, 128, 144], // south, under the street to the south gate
    [105, 127, 106, 127], // the way into the old storeroom
    [143, 133, 144, 135], // a hole in the wall, into the rats' nest
  ],
  channels: [[104, 130, 147, 130], [132, 108, 132, 129], [126, 131, 126, 144]],
  bridges: [[112, 130], [120, 130], [138, 130], [145, 130], [132, 128], [132, 129], [132, 117], [126, 131], [126, 132], [126, 139]],
  rooms: [
    { x0: 133, y0: 101, x1: 149, y1: 106, ground: 'paving', wall: 'wall_sewer' }, // the bell cellar, under the temple and the tower, under the temple
    { x0: 103, y0: 121, x1: 108, y1: 126, ground: 'paving', wall: 'wall_sewer' }, // an old storeroom, under the river
  ],
  caves: [{ cx: 146, cy: 139.5, rx: 5.6, ry: 4.6 }],
  torches: [[108, 127], [116, 127], [125, 127], [137, 127], [143, 127], [131, 107]],
  props: [
    [103, 121, 'barrel'], [104, 121, 'barrel'], [105, 121, 'qchest_oak_cap'], [108, 121, 'crate'], [108, 122, 'crate'], [103, 126, 'sack'], [107, 124, 'bones'],
    [133, 101, 'web'], [140, 101, 'web'], [141, 105, 'crate'], [148, 105, 'clang_crate'], // (Clang, the temple's cat, stuck behind it) [133, 105, 'rubble'], [138, 105, 'bones'],
    [140, 104, 'rubble'], [134, 105, 'rubble'],
    [142, 137, 'bones'], [149, 138, 'bones'], [144, 140, 'qchest_oak_shield'], [145, 143, 'bones'], [147, 136, 'rubble'], [150, 141, 'rubble'], // a shield the rats dragged into their nest
    [118, 132, 'bones'], [130, 121, 'rubble'], [128, 136, 'bones'], [146, 128, 'rubble'],
  ],
  rats: [[107, 132], [114, 128], [121, 131], [128, 129], [136, 132], [145, 128], [131, 116], [134, 123], [125, 136], [128, 143], [106, 123], [137, 103]],
  bigRats: [[148, 140], [146, 142]], // two: a pair a level 4 can take on with care
  shaft: [147, 102, 'The bell shaft: an old hatch over a drop into the dark, far too deep to climb. Whatever fell down it lies deeper still - and the rats have dug their own way down, under the training yard.'],
  down: [147, 139], // a trapdoor in the rats' nest, down to the old drains
};

// Deeper under Oakvale, below the sewers: the way down to the bottom of the bell shaft (The Silent Bell II).
// Floor 6, the old drains: crumbling brick tunnels and fallen-in caves, where the giant rats breed. Floor 5,
// the deep cistern: a flooded cave full of giant rats, and a narrow passage that a slime keeps; past it, the
// bottom of the bell shaft under the temple, where the bell's rope lies.
//   z: the floor; up: where the ladder up stands (under the trapdoor above); down: the trapdoor further down
//   drains: brick tunnels [x0, y0, x1, y1]; caves: fallen-in parts { cx, cy, rx, ry }; rooms: [x0, y0, x1, y1, ground]
//   pools: water in the caves { cx, cy, rx, ry }; props: [x, y, id, look?]; monsters: [type, [[x, y], ...], { lurk }?]
//   (lurk: they notice you only within their own aggro range, not from anywhere on your screen)
const DEEP_SEWERS = [
  {
    z: 6, up: [147, 139], down: [128, 111],
    drains: [[129, 139, 143, 140], [125, 115, 126, 135], [113, 128, 124, 129]],
    caves: [{ cx: 147, cy: 139, rx: 4.5, ry: 3.5 }, { cx: 126, cy: 138, rx: 4, ry: 3.6 }, { cx: 126, cy: 111, rx: 5.5, ry: 4.2 }, { cx: 110, cy: 128.5, rx: 3.6, ry: 3.2 }],
    props: [[145, 137, 'bones'], [132, 140, 'rubble'], [124, 136, 'bones'], [126, 124, 'rubble'], [109, 127, 'bones'], [123, 109, 'bones'], [130, 112, 'rubble']],
    monsters: [['giant_rat', [[148, 141], [137, 139], [127, 139], [124, 137], [125, 128], [126, 120], [111, 129], [123, 112], [127, 109], [130, 110]]]],
  },
  {
    z: 5, up: [128, 111],
    caves: [{ cx: 127, cy: 111, rx: 8, ry: 6.5 }, { cx: 119, cy: 107, rx: 4, ry: 3.5 }, { cx: 131, cy: 117, rx: 4, ry: 3 }],
    pools: [{ cx: 123, cy: 113, rx: 2.6, ry: 1.8 }, { cx: 130, cy: 107, rx: 2, ry: 1.5 }, { cx: 118, cy: 106, rx: 1.6, ry: 1.2 }],
    drains: [[135, 108, 138, 109]], // the narrow way on, where the slime keeps (two rows: a south wall hides the row along it)
    rooms: [[139, 103, 144, 109, 'paving'], [145, 101, 150, 105, 'paving']], // the bottom of the bell shaft, under the tower
    props: [[147, 102, 'bell_rope'], [142, 103, 'qchest_oak_armor'], [139, 103, 'web'], [144, 109, 'bones'], [143, 104, 'rubble'], [121, 116, 'bones'], [133, 119, 'bones'], [116, 105, 'bones']],
    monsters: [
      // they lurk in the dark: each notices you only when you come near it (its aggro), not from across the cave,
      // so you can fight your way through a pair at a time - none of them by the ladder
      ['giant_rat', [[121, 107], [124, 105], [133, 112], [133, 115], [126, 116], [123, 116], [119, 110], [118, 104], [132, 118], [130, 119]], { lurk: true }],
      ['cistern_slime', [[136, 108]], { lurk: true }],
    ],
  },
];

// The founders' crypt under Bone Rocks, two floors deep: a flight of steps cut into the foot of the crag
// (on its south side, near the end of the bone trail) leads down to an antechamber, a corridor and the
// hall of coffins (floor 7); steps at the west end of the hall lead down to the founder's tomb (floor 6),
// where the bell's clapper lies and the Gravewaker waits. Skeletons walk both floors.
//   door:     the steps down, cut into the crag [x, y] (on the surface); niche: tiles cleared beside them;
//             path: the way there from the trail
//   sign:     [x, y, text] beside the door
//   floors:   per floor z: rooms [x0, y0, x1, y1] (worn grave slabs, carved walls round them), stairs
//             [x, y, 'stairs_up' | 'stairs_down'], dais [x0, y0, x1, y1] (paved), torches on north walls,
//             props [x, y, id], monsters [type, x, y]
// Keep things off the row along a south wall and the column along an east wall: those walls hide them.
// The gate watch's tasks out in the wilds (the gate quests in npcs.js, their mechanics in game-gates.js), all on the surface:
//   prints:  Greyfang's paw prints [x, y, look], from the lumber trail north through the pines; a narrow way is
//            cleared between them; den: [x0, y0, x1, y1] his den against the rocks, cleared of trees
//   rock:    the rock off the west beach of Lighthouse Point where Wendel the fisher is stranded [x, y], a sand spit out
//            to it (spit), the islet round it (islet: rows [y, x0, x1]), its crabs; wreck: his boat [x, y];
//            fisherHome: where he rows home to, at Fisher's Rest
//   nests:   the spider nests round the Spider Hills [x, y]
//   camp:    the goblin camp on Goblin Hill: tents, a totem, a fire, the war chest [x, y], its sleepers (goblins);
//            sleepers: everything in this box sleeps at night [x0, y0, x1, y1]
const GATE_SITES = {
  prints: [
    [69, 98, 'Paw prints in the soft earth by the trail, bigger than any wolf\'s you have seen. They leave the trail and go north, into the pines.'],
    [68, 95, 'More of the big paw prints, deep in the needles. North.'],
    [69, 92, 'A tuft of coarse grey fur on a twig, and the big paw prints under it, going north.'],
    [68, 89, 'The prints are fresher here. Something heavy was dragged this way: there is blood on the needles.'],
    [69, 86, 'Big paw prints, and the smaller prints of the pack round them, all going north.'],
    [68, 83, 'A gnawed deer bone, and the big paw prints. The trees grow thick to the north.'],
    [69, 80, 'The prints wind north between the trunks, towards the grey rocks.'],
    [68, 77, 'The ground is trampled bare. You smell wet fur and old bones. Something big sleeps in the thicket ahead.'],
  ],
  den: [65, 70, 70, 73],
  rock: [101, 220], spit: [[100, 216], [100, 217], [100, 218]],
  islet: [[219, 99, 103], [220, 98, 104], [221, 98, 104], [222, 99, 103]],
  rockCrabs: [[99, 220], [103, 221]], wreck: [105, 221], fisherHome: [41, 176],
  nests: [[179, 162], [195, 163], [200, 172], [165, 186]],
  camp: { tents: [[194, 67], [200, 67], [197, 70]], totem: [199, 65], fire: [197, 66], chest: [198, 70], bones: [[195, 69], [201, 65]],
    goblins: [[194, 65], [201, 69], [195, 70]] },
  sleepers: [174, 56, 208, 90],
};

// The gate watch's places (GATE_SITES), built before the hunting grounds are filled
function buildGateSites(m, S) {
  const G = GATE_SITES, put = (x, y, id) => m.addItem(x, y, S, id);
  const unblock = (x, y) => { const t = m.get(x, y, S); if (t) t.items = t.items.filter(id => !THINGS[id].block); return t; };
  // west: the den, cleared, with bones about; the prints, with a narrow way between them through the pines
  const [dx0, dy0, dx1, dy1] = G.den;
  for (let y = dy0; y <= dy1; y++) for (let x = dx0; x <= dx1; x++) if (m.get(x, y, S).ground !== 'mountain') unblock(x, y);
  // (a thicket of firs round it, the rocks behind it: the only way in is from the south, where the prints go)
  const thicket = (x, y) => { const t = m.get(x, y, S); if (t && t.ground === 'grass' && !t.items.some(id => THINGS[id].block)) t.items = ['pine']; };
  for (let y = dy0 - 2; y <= dy1; y++) for (const x of [dx0 - 2, dx0 - 1]) thicket(x, y);
  for (let x = dx0; x <= dx1 + 1; x++) for (const y of [dy0 - 2, dy0 - 1]) thicket(x, y);
  for (let x = dx0 - 2; x < dx0 + 2; x++) thicket(x, dy1 + 1);
  for (const [x, y, id] of [[66, 71, 'bones'], [69, 73, 'bones'], [70, 71, 'pebbles'], [67, 73, 'leaves']]) put(x, y, id);
  m.setMeta(66, 71, S, { look: 'Among the bones lies a grey hood, singed at the edges. It stinks of smoke. No hunter wore this.' });
  G.prints.forEach(([x, y, look], i) => {
    const next = G.prints[i + 1] || [68, 74];
    const n = Math.max(Math.abs(next[0] - x), Math.abs(next[1] - y));
    for (let k = 0; k <= n; k++) unblock(Math.round(x + ((next[0] - x) * k) / n), Math.round(y + ((next[1] - y) * k) / n));
    m.get(x, y, S).items = ['paw_prints'];
    m.setMeta(x, y, S, { look });
  });
  // south: a sand spit out to the rock, the islet round it, rocks on its edge and the fisher's wrecked boat beside it
  for (const [x, y] of G.spit) m.set(x, y, S, { ground: 'sand', items: [] });
  for (const [y, x0, x1] of G.islet) for (let x = x0; x <= x1; x++) m.set(x, y, S, { ground: 'sand', items: [] });
  for (const [x, y, id] of [[98, 221, 'rock'], [104, 220, 'rock'], [102, 222, 'driftwood'], [99, 219, 'shells'], [103, 219, 'fish_rack']]) put(x, y, id);
  put(...G.wreck, 'wreck');
  m.npcs.push({ type: 'oak_stranded', x: G.rock[0], y: G.rock[1], z: S });
  for (const [x, y] of G.rockCrabs) m.spawns.push({ type: 'crab', x, y, z: S });
  // east: the nests
  m.setMeta(...G.nests[2], S, { look: 'Burnt into the web, as neat as a brand: a flame inside a ring.' });
  for (const [x, y] of G.nests) { unblock(x, y).items = ['spider_nest']; for (const [ox, oy] of [[1, 0], [-1, 1]]) { const t = m.get(x + ox, y + oy, S); if (t && !t.items.length && t.ground === 'grass') put(x + ox, y + oy, 'web'); } }
  // north: the camp
  const C = G.camp;
  for (const [x, y] of C.tents) unblock(x, y).items = ['tent'];
  unblock(...C.totem).items = ['totem'];
  unblock(...C.fire).items = ['campfire'];
  unblock(...C.chest).items = ['qchest_gnash_plans'];
  for (const [x, y] of C.bones) unblock(x, y).items = ['bones'];
  for (const [x, y] of C.goblins) { unblock(x, y); m.spawns.push({ type: 'goblin', x, y, z: S }); }
}

// The spiders' den under the Spider Hills (z 7): steps down at the foot of the hills' south face, a winding tunnel full
// of spiders, and the Brood Queen in her egg chamber at the end. The hardest place on the starter island.
const SPIDER_DEN = {
  door: [176, 198], // the steps down, cut into the foot of the hills
  sign: [175, 199, 'Webs across the dark. Something big moves in there. TURN BACK.'],
  // chambers (ellipses: cx, cy, rx, ry) joined in this order by a tunnel
  chambers: [[176, 196.5, 2.2, 1.8], [173, 191, 2.5, 2], [178, 186, 3, 2.2], [176, 180, 5.5, 3.6]],
  spiders: [[173, 191], [174, 190], [178, 186], [179, 187], [172, 181], [180, 179]],
  queen: [176, 179],
  props: [[173, 178, 'qchest_brood_hoard'], [176, 177, 'web'], [171, 180, 'web'], [181, 181, 'web'], [174, 182, 'bones'], [179, 182, 'bones'], [172, 192, 'web'], [180, 186, 'bones']],
};

const CRYPT = {
  door: [81, 198],
  niche: [[82, 198], [82, 199]], // the crag cut back beside the steps, so they show (the rock leans over the tile west of it)
  path: [[77, 200], [81, 200], [81, 199]],
  sign: [80, 199, 'The founders\' crypt. Sealed when the last of the founders was laid to rest. LET THEM SLEEP.'],
  floors: [
    {
      z: 7,
      rooms: [[78, 192, 84, 200], [80, 185, 81, 191], [72, 178, 88, 184], [66, 181, 71, 182]],
      stairs: [[81, 198, 'stairs_up'], [66, 181, 'stairs_down']],
      torches: [[76, 177], [84, 177], [79, 191]],
      props: [
        [74, 179, 'sarcophagus'], [77, 179, 'sarcophagus'], [83, 179, 'sarcophagus'], [86, 179, 'sarcophagus'],
        [74, 182, 'sarcophagus'], [77, 182, 'sarcophagus'], [83, 182, 'sarcophagus'], [86, 182, 'sarcophagus'],
        [79, 178, 'qchest_crypt_sword'], [80, 178, 'qchest_crypt_axe'], [81, 178, 'qchest_crypt_club'],
        [69, 181, 'crypt_gate'], [69, 182, 'wall_crypt'], [71, 181, 'torn_note'], // the gate to the tomb stairs (the way narrows to it), and the note by it
        [78, 192, 'web'], [83, 192, 'rubble'], [79, 195, 'bones'], [72, 178, 'web'], [80, 180, 'bones'], [67, 181, 'bones'],
      ],
      monsters: [['skeleton', 75, 180], ['skeleton', 85, 181], ['skeleton', 80, 183], ['skeleton', 82, 194]],
    },
    {
      z: 6,
      rooms: [[62, 175, 76, 187]],
      stairs: [[66, 181, 'stairs_up']],
      dais: [67, 175, 71, 177],
      torches: [[65, 174], [73, 174]],
      props: [
        [69, 176, 'founder_tomb'],
        [64, 177, 'sarcophagus'], [64, 184, 'sarcophagus'], [74, 177, 'sarcophagus'], [74, 180, 'sarcophagus'], [74, 184, 'sarcophagus'],
        [62, 175, 'web'], [70, 183, 'bones'], [63, 180, 'rubble'], [72, 186, 'bones'],
      ],
      monsters: [['skeleton', 67, 184], ['skeleton', 72, 182], ['skeleton', 70, 186], ['gravewaker', 69, 180]],
      lurk: true, // (they notice you only up close: the tomb is fought a few at a time, not all at once by the stairs)
    },
  ],
  // The Bone Chapel (The Bone Chapel, QUESTS.bone_chapel): behind a crack in the hall of coffins' east wall (a pick
  // breaks it), a short passage and a chapel where Brother Ossian laid the island's old bones out in patterns: skull
  // pyramids in the corners, a chandelier of bones, the crest of Oakvale in bones on the north wall. A carved skull for
  // the crest lies in a cracked coffin in the hall (skull), his jawbone in the rats' nest under the training yard (jaw, in
  // the sewers), and his knucklebone in the grave with no stone in the graveyard (grave: dug with a shovel).
  chapel: {
    z: 7, crack: [89, 181], passage: [[90, 181]], room: [91, 177, 98, 184],
    props: [[94, 177, 'bone_crest'], [91, 177, 'skull_pile'], [97, 177, 'skull_pile'], [91, 183, 'skull_pile'], [97, 183, 'skull_pile'],
      [94, 180, 'bone_chandelier'], [92, 181, 'bones'], [96, 182, 'bones']],
    torches: [[92, 176], [96, 176]],
    ossian: [95, 179],
    skull: [73, 181], jaw: [149, 142], grave: [146, 141],
  },
};

// ---- the hidden quests (phase 7 of docs/world-plan.md): places nobody sends you to ---------------------------------
// The ruined watchtower on the Old Tower hill (The Watchman's Greaves). Its doorway fell in long ago: you climb to its
// top with a rope (a rope spot in the fallen doorway, under a hole in the floor above), where skeletons keep the watch,
// go down its stairs into the tower, pull its three levers in the order the watchmen's graves in Oakvale give, and the
// grate over the trapdoor to the cellar lifts. In the cellar, cut into the hill, the last watchman's shade keeps his chest.
//   x0..y1:  the tower's walls, on the hilltop (floor 9), and its broken top (floor 10)
//   breach:  the fallen doorway (a rope spot; a hole above it); rubble: fallen stone inside, behind it
//   stairs:  down from the top (stairs_down on 10, stairs_up on 9); gaps: the top's broken battlements;
//   levers:  [x, y, order, look] on floor 9; trapdoor: the way down, under a rusted grate
//   cellar:  floor 8, cut into the hill: rooms [x0, y0, x1, y1], props [x, y, id], the shade and his chest
//   skeletons: on the top
const OLD_TOWER = {
  x0: 190, y0: 114, x1: 196, y1: 120,
  breach: [193, 120, 'The tower\'s doorway fell in long ago, and the floor above sagged into it. Above, an old iron hook still sticks out of the stones: with a rope you could climb up.'],
  rubble: [[192, 119], [193, 119], [194, 119]],
  stairs: [191, 115],
  gaps: [[190, 117], [196, 116], [192, 114], [195, 114], [196, 119], [190, 119]],
  levers: [
    [192, 115, 2, 'An iron lever on the west side of the room. "WEST" is cut into its plate.'],
    [193, 115, 3, 'An iron lever in the middle of the room. "MIDDLE" is cut into its plate.'],
    [194, 115, 1, 'An iron lever on the east side of the room. "EAST" is cut into its plate.'],
  ],
  trapdoor: [193, 117],
  cellar: {
    rooms: [[191, 115, 195, 119]],
    props: [[191, 115, 'sarcophagus'], [192, 115, 'qchest_watchman'], [195, 116, 'bones'],[191, 118, 'bones'], [194, 118, 'rubble']],
    torches: [[193, 114]],
    shade: [194, 116],
  },
  skeletons: [[193, 116], [191, 118], [195, 117]],
  page: [198, 118], // (the founder's diary, page 2: on the hilltop, outside the tower)
};

// The goblins' tunnels under Goblin Hill (The Bronze Ward), floor 7: a burrow on the hill's east side leads down, and
// boulders block the tunnels. Walk into one to push it: the first rolls north into a niche past the turn, the second
// (from the archers' hall) a long way south to the end of its tunnel. Goblin archers shoot over them while you push.
// At the far end, in Gnash's hoard, the hoardkeeper sits on Brenna's bronze shield.
//   hole:     the burrow on the surface (a hole; a ladder below it), with what you read when you look at it
//   caves:    [cx, cy, rx, ry]: the burrow, the archers' hall, the hoard; tunnels: [x0, y0, x1, y1], one tile wide
//   boulders: [x, y]; props: [x, y, id]; monsters: [type, x, y] (they lurk: each notices you only up close)
const GOBLIN_WARREN = {
  z: 7,
  hole: [202, 71, 'A burrow, dug by many small claws, going down into the hill. It smells of goblin.'],
  caves: [[201, 72, 2.6, 2.2], [182, 68, 3.6, 3], [193, 81, 3.2, 2.6]],
  tunnels: [[194, 72, 198, 72], [194, 65, 194, 71], [184, 66, 193, 66], [182, 70, 182, 81], [183, 80, 190, 80]],
  boulders: [[194, 69], [182, 73]],
  props: [[195, 80, 'qchest_bronze_ward'], [194, 79, 'treasure'], [191, 82, 'bones'], [196, 82, 'rubble'], [180, 66, 'bones'], [203, 73, 'bones'], [185, 70, 'rubble']],
  monsters: [
    ['goblin_archer', 188, 66], ['goblin_archer', 180, 67], ['goblin_archer', 184, 69], ['goblin', 181, 69], ['goblin', 183, 66],
    ['goblin_hoardkeeper', 193, 81], ['goblin_archer', 192, 82], ['goblin', 194, 82],
  ],
};

// The Deep Diggings under Goblin Hill (King Mogg's Sabre), floors 7 to 4: the deepest vault on the isle, and nobody's
// arrow points at it. At the far end of Gnash's hoard (floor 7) a niche of loose earth: a shovel digs through to the
// goblins' old diggings (floor 6), full of goblins, with a boulder to push and a chest in a side cave. At their end a pit
// drops into the bone halls of the old goblin kings (floor 5): no climbing back that way, only a rope spot in the far
// hall, up into the side cave. Past the old goblin gate (level 7 and up) a hole goes down to King Mogg's throne hall
// (floor 4), where the king's bones sit on his chest.
//   floors: { z: { caves [cx, cy, rx, ry], tunnels [x0, y0, x1, y1], boulders [x, y], props [x, y, id], monsters [type, x, y] } }
//   dig: the loose earth (floor 7), with a rope spot under it; pit: the drop (floor 6) into the halls; rope: the rope spot
//   back up (floor 5); gate: the level gate [x, y, level]; down: the hole to the throne hall (floor 5, a ladder below)
//   exit: the king's way out, behind his throne: ladders [x, y, z] up through old tunnels, one floor at a time, to a hollow
//   in the Deer Woods (floor 8). Only up: nothing on any floor above leads back down it. outLook: what the hollow says
const GOBLIN_DEEP = {
  exit: [[178, 117, 4], [174, 117, 5], [171, 117, 6], [170, 116, 7]],
  outLook: [171, 116, 'A hollow among the roots, where the earth has fallen in. Far down, rough steps cut by small hands. They were cut for going up, not down.'],
  dig: [199, 84, 'Loose earth, dug and then filled in again in a hurry. The goblins stopped digging here. Something made them stop.'],
  pit: [205, 96, 'A pit in the floor, black as ink. Cold air comes up out of it, and the smell of old bones. There is no climbing back up out of that.'],
  rope: [182, 101, 'High above, a hole in the rock, and roots hanging from it. With a rope you could climb up there.'],
  gate: [186, 106, 7, 'An old gate of goblin iron, green with age. Scratched on it, in goblin and in plain letters: ONLY THE STRONG GO DOWN TO THE KING.'],
  down: [186, 110, 'A hole, with goblin footholds cut into its side, going down into the dark.'],
  floors: {
    7: { tunnels: [[194, 84, 199, 84], [170, 116, 171, 117]], props: [[198, 84, 'rubble'], [197, 84, 'bones']] },
    6: {
      caves: [[200, 85, 2.4, 2], [186, 87, 3.6, 2.6], [190, 97, 3.2, 2.4], [203, 96, 2.6, 2], [182, 100, 2.4, 1.7]],
      tunnels: [[189, 85, 197, 85], [186, 90, 186, 98], [187, 97, 188, 97], [193, 97, 201, 97], [182, 90, 182, 98], [183, 89, 183, 89], [171, 117, 174, 117]],
      boulders: [[186, 92]],
      props: [[180, 100, 'qchest_diggers_cache'], [184, 101, 'bones'], [188, 86, 'rubble'], [184, 88, 'bones'], [192, 98, 'rubble'], [189, 96, 'bones'], [204, 95, 'bones'], [173, 117, 'rubble']],
      monsters: [['goblin', 185, 86], ['goblin', 188, 88], ['goblin_archer', 184, 87], ['goblin_archer', 189, 86],
        ['goblin', 190, 96], ['goblin', 191, 98], ['giant_rat', 197, 97], ['giant_rat', 203, 97], ['goblin_archer', 181, 99]],
    },
    5: {
      caves: [[204, 97, 2.6, 2], [187, 100, 4.2, 3], [186, 110, 1.8, 1.6]],
      tunnels: [[190, 99, 203, 99], [182, 101, 183, 101], [186, 104, 186, 108], [174, 117, 178, 117]],
      props: [[184, 99, 'bones'], [190, 102, 'skull_pile'], [184, 102, 'bones'], [189, 98, 'rubble'], [199, 99, 'bones'], [205, 98, 'bones'], [187, 111, 'bones'], [176, 117, 'bones']],
      monsters: [['skeleton', 185, 99], ['skeleton', 189, 101], ['skeleton', 188, 98], ['skeleton', 196, 99], ['shade', 186, 102]],
    },
    4: {
      caves: [[186, 110, 1.8, 1.6], [193, 115, 4.6, 3.4]],
      tunnels: [[187, 111, 188, 111], [188, 112, 189, 112], [189, 113, 189, 113], [178, 117, 189, 117]],
      props: [[193, 112, 'qchest_mogg_sabre'], [192, 112, 'throne'], [194, 112, 'treasure'], [190, 113, 'skull_pile'], [196, 113, 'skull_pile'],
        [190, 117, 'bones'], [196, 117, 'bones'], [193, 118, 'rubble'], [183, 117, 'bones']],
      monsters: [['king_mogg', 193, 114], ['skeleton', 190, 115], ['skeleton', 196, 115], ['shade', 193, 117]],
    },
  },
};

// The smugglers' caves under Lighthouse Point (The Smugglers' Shield), floors 7 and 6: no arrow, only a rumour. In the
// rocks east of the point, a crevice the old keeper walled up with stones: a pick breaks them (they fall back after a
// minute) and you drop into the sea grotto (floor 7), crabs and slimes round its pools. West along the smugglers' way, a
// hole down to their drowned hall (floor 6), past a rusted grille (level 7), where Saltjaw, the great crab, has grown
// the smugglers' shield into his shell. Their way out is still there: the tunnel north, and a ladder up under the
// lighthouse's floor. Only up: nothing in the lighthouse leads down.
//   crevice: the hole in the rocks (floor 8) [x, y, look], the cracked rock in front of it [x, y], the rocks round it;
//   down: the hole to the drowned hall (floor 7, a ladder below); gate: [x, y, level, look] (floor 6); exit: the ladder up
//   into the lighthouse [x, y] (floor 7) and what the flagstones there say; floors: as GOBLIN_DEEP's
const SEA_CAVES = {
  crevice: [147, 207, 'A crevice between the rocks, black and wet. The sea booms somewhere far below. There is no climbing out of that again.'],
  crack: [146, 207, 'Stones stacked into the gap between two rocks, and mortared, long ago. Behind them the sea booms. A pick would make short work of them.'],
  rocks: [[146, 206], [147, 206], [148, 206], [148, 207], [146, 208], [147, 208], [148, 208]],
  down: [131, 215, 'A round hole in the rock floor, its edges worn smooth by ropes. Far down, water drips.'],
  gate: [138, 215, 7, 'A rusted grille across the tunnel. A smugglers\' sign is scratched on it: a crab, and under it, ONLY OLD HANDS.'],
  exit: [125, 203, 'Loose flagstones. The keeper says something knocks under them on stormy nights. They lift from below, not from up here.'],
  floors: {
    7: {
      caves: [[147, 208, 2.2, 1.8], [150, 214, 4.2, 3], [132, 214, 2.6, 2]],
      tunnels: [[148, 210, 148, 211], [135, 215, 146, 215], [126, 212, 130, 212], [125, 203, 125, 212]],
      pools: [[152, 215, 2, 1.4]],
      props: [[146, 213, 'shells'], [149, 217, 'driftwood'], [153, 212, 'shells'], [140, 215, 'bones'], [133, 213, 'barrel'], [131, 213, 'crate'], [125, 207, 'rubble']],
      monsters: [['crab', 148, 213], ['crab', 151, 212], ['crab', 147, 216], ['slime', 149, 216], ['slime', 143, 215], ['crab', 133, 215]],
    },
    6: {
      caves: [[131, 215, 2, 1.8], [144, 216, 4.6, 3.2]],
      tunnels: [[133, 215, 140, 215]],
      pools: [[147, 218, 1.8, 1.2]],
      props: [[145, 213, 'qchest_smuggler_shield'], [143, 213, 'barrel'], [147, 214, 'crate'], [141, 218, 'bones'], [144, 219, 'driftwood'], [130, 216, 'bones']],
      monsters: [['saltjaw', 144, 216], ['crab', 141, 215], ['shade', 142, 218]],
    },
  },
};

// Builds the deep webs under the Spider Hills (see DEEP_WEBS), after the den above them: the web wall, the holes and
// their ladders, the grate, the ladders out, the webs and the spiders.
function buildDeepWebs(m) {
  const D = DEEP_WEBS;
  carveVault(m, D.floors);
  const [wx, wy, wallLook] = D.webWall;
  m.get(wx, wy, 7).items = ['web_wall']; m.setMeta(wx, wy, 7, { look: wallLook });
  for (const [x, y, z, look] of D.holes) { m.get(x, y, z).items = ['hole']; m.setMeta(x, y, z, { look }); m.get(x, y, z - 1).items = ['cave_ladder']; }
  const [gx, gy, level, gateLook] = D.gate;
  m.get(gx, gy, 5).items = ['tower_grille']; m.setMeta(gx, gy, 5, { level, look: gateLook });
  for (const [x, y, z] of D.exit) m.get(x, y, z).items = ['cave_ladder'];
  for (const [zs, F] of Object.entries(D.floors)) {
    const Z = +zs;
    for (const [x, y, id] of F.props || []) if (m.isWalkable(x, y, Z) && !m.get(x, y, Z).items.length) m.addItem(x, y, Z, id);
    for (const [type, x, y] of F.monsters || []) m.spawns.push({ type, x, y, z: Z, lurk: true });
  }
}

// Builds the smugglers' caves under Lighthouse Point (see SEA_CAVES): the walled-up crevice in the rocks, the grotto and the
// drowned hall, the hole down between them, the grille, the ladder up into the lighthouse, and who lives there now.
function buildSeaCaves(m, S) {
  const C = SEA_CAVES;
  carveVault(m, C.floors);
  const [cx, cy, crevLook] = C.crevice, [kx, ky, crackLook] = C.crack;
  for (const [x, y] of C.rocks) m.get(x, y, S).items = ['rock'];
  m.get(kx, ky, S).items = ['cracked_rock']; m.setMeta(kx, ky, S, { look: crackLook });
  m.get(cx, cy, S).items = ['hole']; m.setMeta(cx, cy, S, { look: crevLook });
  const [dx, dy, downLook] = C.down;
  m.get(dx, dy, 7).items = ['hole']; m.setMeta(dx, dy, 7, { look: downLook });
  m.get(dx, dy, 6).items = ['cave_ladder'];
  const [gx, gy, level, gateLook] = C.gate;
  m.get(gx, gy, 6).items = ['tower_grille']; m.setMeta(gx, gy, 6, { level, look: gateLook });
  const [ex, ey, exitLook] = C.exit;
  m.get(ex, ey, 7).items = ['cave_ladder'];
  m.setMeta(ex, ey, S, { look: exitLook });
  for (const [zs, F] of Object.entries(C.floors)) {
    const Z = +zs;
    for (const [x, y, id] of F.props || []) if (m.isWalkable(x, y, Z)) m.addItem(x, y, Z, id);
    for (const [type, x, y] of F.monsters || []) m.spawns.push({ type, x, y, z: Z, lurk: true });
  }
}

// One-Eye Patch's den in Sunny Fields (The Carrot Bandit): dug-up ground in the meadow south-east of the farm, past the
// pond, with Farmer Odo's stolen sacks, where the rabbits' leader waits. at: the den's middle; sacks: [x, y]
const PATCH_DEN = { at: [139, 181], sacks: [[138, 180], [140, 182]] };

// The Deep Webs under the Spider Hills (The Weaver's Helm), floors 7 to 5: below the Brood Queen's den. At the back of her
// egg chamber (floor 7) a wall of old web fills a crack in the rock: fire burns it away (a torch, or Torchlight; it is
// spun again after a while). A hole beyond drops to the deep webs (floor 6), spiders in every cave, and a second hole to
// the Old Weaver's larder (floor 5), past an old iron grate (level 8), where the oldest spider on the isle keeps what was
// left of those she caught: an adventurer's helm, wrapped in silk. Her way out: ladders up, back into the den.
//   webWall: [x, y, look] (floor 7); holes: [x, y, z] down (a ladder below each); gate [x, y, level, look] (floor 5);
//   exit: ladders [x, y, z] up, one floor at a time; floors: as GOBLIN_DEEP's
const DEEP_WEBS = {
  webWall: [176, 176, 'A wall of old web, thick as felt, grey with dust, stretched across a crack in the rock. Cold air breathes through it. It would burn.'],
  holes: [[176, 172, 7, 'A hole, its edges furred with web. Threads go down into the dark, and they tremble.'], [190, 182, 6, 'A shaft, hung with web like curtains. Something below has been eating well.']],
  gate: [186, 183, 8, 'An old iron grate, gummed shut with web. Only a strong arm could heave it aside.'],
  exit: [[176, 187, 5], [173, 190, 6]],
  floors: {
    7: { tunnels: [[176, 172, 176, 175]], props: [[176, 174, 'bones']] },
    6: {
      caves: [[176, 171, 2, 1.6], [187, 170, 3.2, 2.4], [189, 181, 3, 2.2]],
      tunnels: [[178, 170, 184, 170], [188, 173, 188, 178], [173, 187, 176, 187], [173, 188, 173, 190]],
      props: [[186, 168, 'web'], [189, 171, 'bones'], [185, 171, 'web'], [188, 175, 'web'], [190, 180, 'web'], [187, 182, 'bones'], [191, 181, 'web'], [174, 187, 'web']],
      monsters: [['spider', 186, 170], ['spider', 188, 169], ['spider', 189, 171], ['spider', 188, 181], ['spider', 187, 180], ['spider', 188, 176]],
    },
    5: {
      caves: [[191, 183, 2, 1.7], [179, 184, 4.5, 3.2]],
      tunnels: [[184, 183, 189, 183], [176, 186, 176, 187]],
      props: [[178, 181, 'qchest_weaver_helm'], [176, 182, 'web'], [182, 182, 'web'], [177, 186, 'bones'], [181, 186, 'bones'], [183, 184, 'web'], [175, 184, 'bones']],
      monsters: [['old_weaver', 179, 184], ['spider', 181, 182], ['spider', 177, 185]],
    },
  },
};

// Under the town well (Down the Well), floor 7: tie a rope to the well and climb down. A pool at the bottom, a rope spot
// to climb back up, and a few dark tunnels where giant rats live. At the end a cracked rock: a pick breaks through to
// where Old Wim lies, who went down the well for a bet, with his lucky ring.
//   well: the well on the square (rope down); caves [cx, cy, rx, ry]; tunnels [x0, y0, x1, y1]; pool: water at the bottom
//   crack: the cracked rock; props: [x, y, id]; monsters: [type, x, y] (they lurk)
const WELL_TUNNELS = {
  z: 7,
  well: [124, 110, 'The old bucket rope is long gone. Far below, water glints, and the stones are worn where someone once climbed down. With a rope of your own, so could you. Someone has scratched a little rat on the stone.'],
  caves: [[124, 110, 2.2, 1.9], [114, 111, 3, 2.5], [115, 100, 3.5, 2.2], [126, 100, 1.9, 1.6]],
  tunnels: [[116, 110, 122, 110], [113, 102, 113, 108], [119, 100, 124, 100]],
  pool: [[123, 111], [124, 111], [125, 111], [125, 109]],
  crack: [122, 100],
  props: [[126, 100, 'wim_bones'], [127, 101, 'bones'], [112, 112, 'bones'], [116, 98, 'puddle'], [118, 101, 'rubble'], [112, 110, 'puddle']],
  monsters: [['giant_rat', 113, 110], ['giant_rat', 115, 112], ['giant_rat', 114, 99], ['giant_rat', 117, 100], ['slime', 112, 101]],
};

// Oakvale Isle's hidden quests (Phase 7 in docs/world-plan.md): the places they use, and the landmarks there.
//   buildings: { x0, y0, x1, y1, door, floors, floor, wall, roof, props: [[x, y, z, id]] } (z: floors up from the ground)
//   fisher:    Fisher's Rest: the hut, the jetty out over the sea [x0, y0, x1, y1] (pier), the boat, the riddle's spot
//              (three stones round where the key lies buried: Tidecutter) and the sign
//   seaCave:   under the rocks south of Fisher's Rest (z 7): steps down, a narrow way to the gate (the barnacled key),
//              two grottoes with pools, the wreck of the Gull, crabs and Brineshell
//   farm:      the Sunny Fields farm: the farmhouse with the trapdoor down to its cellar (z 7), giant rats and the oil
//   lighthouse: the new tower on Lighthouse Point, three floors, the great lamp on the top one
//   peaks:     the cave under the North Peaks' south face (z 7): chambers (ellipses) joined by passages, cracked rock
//              in some (a pick: one is a shortcut), the seam of flint, shades; at its end the climbers' chimney up through
//              the mountain (z 8 and 9, ladders and trapdoors), out onto the eyrie (z 10) on the shoulder of the peak
//   people:    [type, x, y, z]
const DISCOVERY = {
  fisher: {
    hut: { x0: 49, y0: 176, x1: 53, y1: 179, door: [51, 179], floor: 'wood', wall: 'wall_wood', roof: 'roof_thatch',
      props: [[52, 177, 0, 'qchest_tide_chart'], [50, 177, 0, 'barrel'], [52, 178, 0, 'bed']] },
    jetty: [31, 174, 36, 175], boat: [32, 173], racks: [[38, 177], [39, 179]], barrels: [[37, 176]],
    riddle: { at: [50, 188], stones: [[49, 187], [51, 188], [49, 189]] }, // (the key: Tidecutter)
    sign: [55, 170, 'Fisher\'s Rest. Fish, nets, and Old Maddock\'s tales. East: the trail to the south road.'],
  },
  seaCave: {
    z: 7, door: [51, 196], gate: [48, 196],
    look: 'Dark water slaps in a cleft between the rocks, and steps cut long ago lead down into it.',
    gateLook: 'A rusted iron gate across the passage, its lock crusted with salt. Beyond it, the sound of the sea in a cave.',
    rooms: [[50, 195, 52, 197], [47, 196, 49, 196]],          // a landing under the steps, and the narrow way to the gate
    grottoes: [[43.5, 196, 3.2, 2.6], [44, 203.5, 4.6, 2.8]], // ellipses: cx, cy, rx, ry
    passages: [[43, 199, 44, 200]],
    pools: [[42, 194.6, 1.6, 1], [40, 205, 1.2, 1], [48, 204, 1, 0.8]],
    props: [[41, 202, 'wreck'], [43, 202, 'qchest_tidecutter'], [39, 203, 'driftwood'], [46, 196, 'shells'], [45, 201, 'bones'], [40, 197, 'driftwood']],
    monsters: [['crab', 44, 197], ['crab', 41, 196], ['crab', 45, 205], ['crab', 41, 204], ['brineshell', 46, 203]],
  },
  farm: {
    house: { x0: 117, y0: 153, x1: 122, y1: 157, door: [119, 157], floor: 'wood', wall: 'wall_wood', roof: 'roof_thatch',
      props: [[118, 154, 0, 'table'], [117, 154, 0, 'chair_east'], [118, 156, 0, 'sack'], [121, 156, 0, 'sack'], [121, 154, 0, 'trapdoor']] },
    windmill: [124, 153], scarecrow: [116, 160], haystacks: [[124, 158], [125, 159]],
    crops: [113, 159, 121, 163], // farmland, a fence round it with a gate on the north side
    cellar: { z: 7, room: [116, 152, 123, 157], ladder: [121, 154],
      props: [[117, 153, 'oil_jars'], [118, 153, 'barrel'], [122, 153, 'barrel'], [116, 155, 'crate'], [120, 156, 'bones']],
      rats: [[117, 156], [119, 153], [122, 156], [119, 155]] },
  },
  lighthouse: { x0: 122, y0: 201, x1: 126, y1: 205, door: [124, 205], floors: 3, floor: 'paving', wall: 'wall_stone', roof: 'roof_slate',
    stairs: [[123, 202], [125, 202]], lamp: [124, 203], // (up from the ground at the first, from the first floor up at the second)
    props: [[125, 204, 0, 'barrel'], [123, 204, 0, 'table'], [123, 204, 1, 'crate'], [125, 204, 1, 'barrel'], [123, 204, 2, 'sack']] },
  peaks: {
    z: 7, door: [83, 61],
    look: 'A low cave mouth in the foot of the North Peaks. Cold air breathes out of it, and somewhere inside, something moans.',
    chambers: [[83, 60, 1.6, 1.4], [79, 56, 2.8, 2], [87.5, 55, 3.2, 2.3], [94.5, 51.5, 2.2, 1.8]],
    // passages, one tile wide: [[x, y], ...]; cracked rock where a pick must break through
    passages: [[[82, 58], [81, 58], [81, 57]], [[82, 55], [83, 55], [84, 55], [82, 54], [83, 54], [84, 54]],
      [[85, 59], [85, 58], [86, 58]], [[91, 55], [91, 54], [91, 53], [92, 53]]],
    cracked: [[85, 58], [91, 54]], // the shortcut from the mouth to the moaning hall; the way on to the chimney
    flint: [78, 54],
    props: [[80, 55, 'bones'], [86, 53, 'bones'], [89, 56, 'rubble'], [84, 60, 'pebbles'], [93, 52, 'bones'], [77, 56, 'rubble']],
    shades: [[80, 57, 7], [86, 54, 7], [89, 55, 7], [87, 56, 7], [93, 51, 7], [97, 51, 10], [96, 48, 10]],
    // the chimney: [x, y, z, id] on each floor of it (a 3 x 3 room cut in the rock), and the eyrie on top
    chimney: { x0: 94, y0: 49, x1: 96, y1: 51, from: 8, to: 9,
      climb: [[95, 51, 7, 'cave_ladder'], [95, 51, 8, 'trapdoor'], [95, 49, 8, 'ladder'], [95, 49, 9, 'trapdoor'], [94, 49, 9, 'ladder'], [94, 49, 10, 'hole']] },
    eyrie: { z: 10, x0: 91, y0: 47, x1: 101, y1: 53, nest: [98, 50],
      look: 'The eyrie of the great eagles, on the shoulder of the North Peaks. The whole isle lies below you.' },
  },
  people: [['rest_fisher', 36, 175, 8], ['fields_farmer', 121, 158, 8]],
};

function createDefaultMap() {
  // (the new world, Kestrel Isle, played as a preview: index.html?world=kestrel; see js/world-kestrel.js)
  if (KESTREL_PREVIEW && typeof createKestrelMap === 'function') return createKestrelMap();
  const { width: W, height: H, depth: D, surfaceZ: S } = WORLD_SIZE;
  const m = new GameMap(W, H, D, S);
  const d = ISLE_DESIGN;

  // ---- geometry ----------------------------------------------------------------------
  // A fixed hash of a tile (0..1), and smooth noise made from it, for natural-looking edges.
  const hash = (x, y, seed) => {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (x, y, scale, seed) => {
    const fx = x / scale, fy = y / scale, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = hash(x0, y0, seed), b = hash(x0 + 1, y0, seed), c = hash(x0, y0 + 1, seed), e = hash(x0 + 1, y0 + 1, seed);
    return (a + (b - a) * sx) + ((c + (e - c) * sx) - (a + (b - a) * sx)) * sy;
  };
  const inside = (poly, x, y) => {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  // Inside an outline, with its edge moved in or out by up to `rough` tiles.
  const insideRough = (poly, x, y, rough, seed) =>
    inside(poly, x + 0.5 + (noise(x, y, 5, seed) - 0.5) * 2 * rough, y + 0.5 + (noise(x, y, 5, seed + 1) - 0.5) * 2 * rough);
  const box = poly => {
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    return [Math.max(0, Math.min(...xs) - 3), Math.max(0, Math.min(...ys) - 3), Math.min(W - 1, Math.max(...xs) + 3), Math.min(H - 1, Math.max(...ys) + 3)];
  };
  const eachIn = (poly, fn) => {
    const [x0, y0, x1, y1] = box(poly);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) fn(x, y);
  };

  const at = (x, y, z = S) => m.get(x, y, z);
  const ground = (x, y, z = S) => (at(x, y, z) || {}).ground;
  const put = (x, y, z, id) => m.addItem(x, y, z, id);
  const inRect = (r, x, y, pad = 0) => x >= r.x0 - pad && x <= r.x1 + pad && y >= r.y0 - pad && y <= r.y1 + pad;
  const keep = new Uint8Array(W * H); // no trees or clutter here: town, clearings, roads, ramps

  // ---- the sea, and the land in it ----------------------------------------------------
  // Every surface tile is set: water around the island, land on it.
  const land = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // Rough at two scales: small wiggles, and coves and points a few tiles across
    const cx = x + 0.5 + (noise(x, y, 5, 11) - 0.5) * 4 + (noise(x, y, 14, 13) - 0.5) * 9;
    const cy = y + 0.5 + (noise(x, y, 5, 12) - 0.5) * 4 + (noise(x, y, 14, 14) - 0.5) * 9;
    const isLand = inside(d.coast, cx, cy) || d.islets.some(p => insideRough(p, x, y, 1.5, 12));
    land[y * W + x] = isLand ? 1 : 0;
  }
  // No lone land tiles or one-tile inlets: they look like specks.
  for (let pass = 0; pass < 2; pass++) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const n = land[y * W + x - 1] + land[y * W + x + 1] + land[(y - 1) * W + x] + land[(y + 1) * W + x];
    if (land[y * W + x] && n <= 1) land[y * W + x] = 0;
    else if (!land[y * W + x] && n >= 3) land[y * W + x] = 1;
  }
  // How far each land tile is from the sea (up to 8), for beaches.
  const shore = new Uint8Array(W * H).fill(255);
  let front = [];
  for (let i = 0; i < W * H; i++) if (!land[i]) { shore[i] = 0; front.push(i); }
  for (let dist = 1; dist <= 8 && front.length; dist++) {
    const next = [];
    for (const i of front) {
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j >= 0 && j < W * H && shore[j] === 255) { shore[j] = dist; next.push(j); }
      }
    }
    front = next;
  }
  const isRocky = (x, y) => d.rocky.some(p => inside(p, x, y));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!land[i]) { m.set(x, y, S, { ground: 'water', items: [] }); continue; }
    const beach = 2 + Math.floor(noise(x, y, 7, 21) * 3); // 2 to 4 tiles of sand
    const rocky = isRocky(x, y);
    m.set(x, y, S, { ground: shore[i] <= (rocky ? 2 : beach) ? (rocky ? 'mountain' : 'sand') : 'grass', items: [] });
  }

  // ---- places kept clear ---------------------------------------------------------------
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (inRect(d.town, x, y, 3) || d.clearings.some(c => inRect(c, x, y, 1))) keep[y * W + x] = 1;
  }

  // ---- marshes, meadows, lakes, rivers ------------------------------------------------
  for (const marsh of d.marshes) eachIn(marsh.outline, (x, y) => {
    if (ground(x, y) === 'grass' && insideRough(marsh.outline, x, y, 2, 31)) {
      // pools of open water in the reeds
      m.setGround(x, y, S, noise(x, y, 6, 32) * 0.8 + noise(x, y, 2, 33) * 0.2 > 0.68 ? 'water' : 'swamp');
    }
  });
  const meadow = new Uint8Array(W * H);
  for (const field of d.meadows) eachIn(field.outline, (x, y) => { if (insideRough(field.outline, x, y, 2, 41)) meadow[y * W + x] = 1; });
  for (const lake of d.lakes) eachIn(lake, (x, y) => { if (land[y * W + x] && insideRough(lake, x, y, 1.5, 51)) m.setGround(x, y, S, 'water'); });
  // A line of straight runs (each run north-south or east-west), `width` tiles wide; a point
  // [x, y, w] changes the width from there on; pad widens it all by that much (for margins).
  // fn(x, y, alongX) for every tile it covers.
  const runs = (line, width, fn, pad = 0) => {
    let base = width;
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, ay, aw] = line[i], [bx, by] = line[i + 1];
      if (aw) base = aw;
      const w = base + pad, lo = -Math.floor((w - 1) / 2), hi = lo + w - 1, alongX = ay === by;
      // the run, and the square at its end so turns are filled
      for (let t = Math.min(alongX ? ax : ay, alongX ? bx : by) + lo; t <= Math.max(alongX ? ax : ay, alongX ? bx : by) + hi; t++) {
        for (let c = lo; c <= hi; c++) fn(alongX ? t : ax + c, alongX ? ay + c : t, alongX);
      }
    }
  };
  // A trail out in the wilds wanders: its middle drifts a tile or two either way and it is now wider, now narrower,
  // along slow noise; at its corners and ends it keeps to the drawn line, so trails still meet. (In town they're straight.)
  const town = OAKVALE.bounds, inTownArea = (x, y) => x >= town.x0 - 2 && x <= town.x1 + 2 && y >= town.y0 - 2 && y <= town.y1 + 2;
  const wanderRuns = (line, width, fn, pad = 0, seed = 0) => {
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, ay] = line[i], [bx, by] = line[i + 1], alongX = ay === by;
      const t0 = Math.min(alongX ? ax : ay, alongX ? bx : by), t1 = Math.max(alongX ? ax : ay, alongX ? bx : by);
      for (let t = t0 - 2; t <= t1 + 2; t++) {
        const x = alongX ? t : ax, y = alongX ? ay : t;
        const fade = Math.max(0, Math.min(1, (Math.min(t - t0, t1 - t) - 1) / 4)) * (inTownArea(x, y) ? 0 : 1);
        const off = Math.round(fade * (noise(t, i + seed * 7, 9, 91 + seed) * 2 - 1) * 2.2);
        const wn = noise(t, i + seed * 7, 5, 97 + seed), w = width + pad + (fade > 0.5 ? (wn > 0.68 ? 1 : wn < 0.22 && width > 2 ? -1 : 0) : 0);
        const lo = -Math.floor((w - 1) / 2) + off, hi = lo + w - 1;
        for (let c = lo; c <= hi; c++) fn(alongX ? t : ax + c, alongX ? ay + c : t, alongX);
      }
    }
  };
  const riverBed = new Set(); // where bridges may go
  for (const river of d.rivers) runs(river.line, river.width, (x, y) => { m.setGround(x, y, S, 'water'); riverBed.add(y * W + x); });
  // Banks that step in and out a tile here and there, in short stretches (not where a road crosses).
  const crossing = (x, y) => [...d.roads, ...d.paths].some(r => { let near = false; runs(r.line, r.width || 2, (rx, ry) => { if (rx === x && ry === y) near = true; }, 6); return near; });
  for (const river of d.rivers) runs(river.line, river.width, (x, y) => {
    if (ground(x, y) !== 'grass' || shore[y * W + x] <= 4 || crossing(x, y)) return; // not at the coast: that's the beach's
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => riverBed.has((y + dy) * W + x + dx));
    if ((near && noise(x, y, 2.5, 37) > 0.52) || noise(x, y, 6, 38) > 0.8) m.setGround(x, y, S, 'water');
  }, 4);

  // No specks of water on land: pieces of fewer than six tiles not joined to the sea dry up.
  {
    const seen = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      if (seen[i] || !land[i] || ground(i % W, Math.floor(i / W)) !== 'water') continue;
      const part = [i];
      seen[i] = 1;
      for (let k = 0; k < part.length; k++) { // the whole piece, so a long brook isn't taken for a speck
        const j = part[k];
        for (const o of [1, -1, W, -W]) if (!seen[j + o] && land[j + o] && ground((j + o) % W, Math.floor((j + o) / W)) === 'water') { seen[j + o] = 1; part.push(j + o); }
      }
      if (part.length < 6) for (const j of part) {
        const x = j % W, y = Math.floor(j / W);
        const swampy = [1, -1, W, -W].some(o => ground((j + o) % W, Math.floor((j + o) / W)) === 'swamp');
        m.setGround(x, y, S, swampy ? 'swamp' : 'grass');
        riverBed.delete(j);
      }
    }
  }

  // Stony fields: rocky ground, ragged at the edge
  const stony = new Uint8Array(W * H);
  for (const field of d.stonefields) eachIn(field.outline, (x, y) => {
    if (ground(x, y) !== 'grass' || !insideRough(field.outline, x, y, 2.5, 45)) return;
    stony[y * W + x] = 1;
    if (noise(x, y, 4, 46) > 0.38) m.setGround(x, y, S, 'mountain'); // patches of grass between the rock
  });

  // ---- mountains --------------------------------------------------------------------
  // Tiles of an outline, without lone tiles sticking out (they'd look like pillars).
  const shape = (outline, seed) => {
    const raw = new Set(), set = new Set();
    eachIn(outline, (x, y) => { if (insideRough(outline, x, y, 1.5, seed)) raw.add(y * W + x); });
    for (const i of raw) if ([1, -1, W, -W].filter(o => raw.has(i + o)).length >= 3) set.add(i);
    return set;
  };
  const southEdge = (set, x) => {
    let y = -1;
    for (const i of set) if (i % W === x) y = Math.max(y, Math.floor(i / W));
    return y;
  };
  // A path up: a ramp on the lowest rock of column x (or a nearby column where the edge is
  // straight), with its top on the floor above.
  const ramp = (set, z, x0) => {
    const tries = [0, 1, -1, 2, -2, 3, -3].map(o => x0 + o);
    const x = tries.find(x => { const y = southEdge(set, x); return y >= 0 && southEdge(set, x - 1) === y && southEdge(set, x + 1) === y; }) ?? x0;
    const y = southEdge(set, x);
    m.ensure(x, y, z).items = ['ramp'];
    m.setGround(x, y, z + 1, 'ramp_top');
    for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) if (m.inBounds(x + dx, y + dy, S)) keep[(y + dy) * W + x + dx] = 1;
    return { x, y, z };
  };
  // Rock walls on floor z, with their top one floor up: rugged rock you can't walk on, or rocky
  // ground where you can (ledges and walkable hilltops).
  const rockBlock = (set, z, walk) => {
    for (const i of set) {
      const x = i % W, y = (i - x) / W;
      m.set(x, y, z, { ground: 'mountain', items: ['cliff'] });
      m.set(x, y, z + 1, { ground: walk(i) ? (noise(x, y, 4, 61) > 0.7 ? 'grass' : 'mountain') : 'rock_top', items: [] });
    }
  };
  // The tiles of a set at least `d` tiles in from its edge, ragged (noise) and without stray tiles.
  const inner = (set, d, seed, keepOut) => {
    const deep = i => { for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) if (!set.has(i + dy * W + dx)) return false; return true; };
    const raw = new Set([...set].filter(i => deep(i) && !keepOut(i) && noise(i % W, Math.floor(i / W), 5, seed) > 0.28));
    return new Set([...raw].filter(i => [1, -1, W, -W].filter(o => raw.has(i + o)).length >= 3));
  };
  const ramps = [];
  const outcrops = d.rocks.map(([cx, cy, rx, ry, tiers]) => ({
    outline: Array.from({ length: 12 }, (_, k) => [cx + Math.cos(k * Math.PI / 6) * rx, cy + Math.sin(k * Math.PI / 6) * ry]), tiers, ramps: [],
  }));
  for (const mount of [...d.mountains, ...outcrops]) {
    const base = shape(mount.outline, 71);
    // Where the path up comes out: the bottom of the ramp column on the south edge.
    const way = mount.ramps.length > 0; // a mountain without a path up is rugged rock all over
    const tries = [0, 1, -1, 2, -2, 3, -3].map(o => (mount.ramps[0] || 0) + o);
    const rx = way ? tries.find(x => { const y = southEdge(base, x); return y >= 0 && southEdge(base, x - 1) === y && southEdge(base, x + 1) === y; }) ?? mount.ramps[0] : -99;
    const ry = way ? southEdge(base, rx) : -99;
    // Where you can walk on top: the whole top of a hill, or a ledge in front of the path up.
    const ledge = i => {
      if (!way) return false;
      if (mount.walkable) return true;
      const x = i % W, y = (i - x) / W; // a rounded ledge, ragged at its edge
      return y <= ry && Math.hypot(x - rx, (y - (ry - 3)) * 1.2) < 3.6 + noise(x, y, 2, 78) * 1.6;
    };
    rockBlock(base, S, ledge);
    if (way) ramps.push(ramp(base, S, rx));
    // Tiers: each stands back two or three tiles from the one below (and off the ledge), so the
    // mountain rises in steps of rock.
    let below = base;
    for (let tier = 1; tier < (mount.tiers || 1); tier++) {
      const z = S + tier, top = inner(below, tier === 1 ? 3 : 2, 74 + tier, ledge);
      rockBlock(top, z, () => false);
      below = top;
      if (!top.size) break;
    }
    // A few crags on the rugged tops, and boulders on the ledges.
    for (let z = S + 1; z <= S + (mount.tiers || 1); z++) for (const i of base) {
      const x = i % W, y = (i - x) / W, t = at(x, y, z);
      if (!t || t.items.length || at(x, y, z - 1)?.items.includes('cliff') === false) continue;
      if (t.ground === 'rock_top' && !(at(x, y, z + 1) && at(x, y, z + 1).ground)) {
        if (hash(x, y, 75 + z) < (z === S + (mount.tiers || 1) ? 0.14 : 0.07)) put(x, y, z, 'crag');
      } else if (t.ground !== 'rock_top' && t.ground !== 'ramp_top' && !(Math.abs(x - rx) <= 1 && y >= ry - 2)) {
        const v = hash(x, y, 76);
        const rim = [1, -1, W, -W].some(o => !base.has(i + o));
        if (mount.walkable && rim && v < 0.3) put(x, y, z, 'crag');
        else if (v < 0.08) put(x, y, z, v < 0.04 ? 'rock' : 'pebbles');
      }
    }
    // Whatever can't be reached from the path up becomes rugged rock: no closed-off pockets.
    const start = (ry - 1) * W + rx, seen = new Set(way ? [start] : []), queue = way ? [start] : [];
    while (queue.length) {
      const i = queue.pop();
      for (const o of [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1]) {
        const j = i + o;
        if (!base.has(j) || seen.has(j) || !m.isWalkable(j % W, Math.floor(j / W), S + 1)) continue;
        seen.add(j);
        queue.push(j);
      }
    }
    for (const i of base) {
      const x = i % W, y = Math.floor(i / W), t = at(x, y, S + 1);
      if (!seen.has(i) && m.isWalkable(x, y, S + 1) && t.ground !== 'ramp_top') { t.ground = 'rock_top'; t.items = []; }
    }
  }

  // ---- roads, trails and bridges ------------------------------------------------------------
  let trailNo = 0;
  const paint = (line, width) => {
    const seed = ++trailNo;
    wanderRuns(line, width, (x, y) => { if (m.inBounds(x, y, S)) keep[y * W + x] = 1; }, 3, seed); // and a margin with no trees
    wanderRuns(line, width, (x, y, alongX) => {
      const g = ground(x, y);
      if (g === 'water' && riverBed.has(y * W + x)) m.setGround(x, y, S, alongX ? 'bridge_ew' : 'bridge_ns');
      else if (g === 'water') m.setGround(x, y, S, 'dirt'); // a trail through a marsh pool is a causeway
      else if (['grass', 'sand', 'swamp', 'mountain'].includes(g) && !at(x, y).items.includes('cliff')) {
        m.setGround(x, y, S, 'dirt');
        at(x, y).items = at(x, y).items.filter(id => !THINGS[id].block);
      }
    }, 0, seed);
  };
  for (const road of d.roads) paint(road.line, road.width);
  for (const path of d.paths) paint(path.line, 2);
  // Side trails: short, narrow tracks of dirt branching off the roads and trails into the grass, as feet wear them,
  // each wandering a little and fading out. (Fixed by a hash of the place, like everything else.)
  const trodden = (x, y) => { const t = at(x, y); return t && t.ground === 'grass' && !t.items.some(id => THINGS[id].block || THINGS[id].change) && !inTownArea(x, y); };
  let branchNo = 0;
  for (const [k, line] of [...d.roads.map(r => r.line), ...d.paths.map(p => p.line)].entries()) {
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, ay] = line[i], [bx, by] = line[i + 1], alongX = ay === by, len = Math.abs(alongX ? bx - ax : by - ay);
      for (let t = 6; t < len - 5; t += 9 + Math.floor(hash(k, i * 31 + t, 151) * 9)) {
        if (hash(k, t, 157 + i) < 0.4) continue; // not at every chance
        const side = hash(t, k, 163 + i) < 0.5 ? -1 : 1, n = 5 + Math.floor(hash(i, t, 167 + k) * 8), no = ++branchNo;
        let x = alongX ? ax + Math.sign(bx - ax) * t : ax, y = alongX ? ay : ay + Math.sign(by - ay) * t;
        let drift = 0, prev = null;
        for (let s = 0; s < n; s++) {
          // out from the trail, drifting sideways now and then
          if (alongX) y += side; else x += side;
          if (s > 1 && hash(no, s, 173) < 0.35) drift += hash(s, no, 179) < 0.5 ? -1 : 1;
          const px = alongX ? x + drift : x, py = alongX ? y : y + drift;
          if (s < 2) { if (!trodden(px, py) && ground(px, py) !== 'dirt') break; } // (the first steps may cross the trail's own edge)
          else if (!trodden(px, py)) break;
          if (ground(px, py) === 'grass') m.setGround(px, py, S, 'dirt');
          // a step sideways: the tile between, so the track stays joined edge to edge
          if (prev && Math.abs(prev[0] - px) + Math.abs(prev[1] - py) > 1) { const [qx, qy] = alongX ? [prev[0], py] : [px, prev[1]]; if (trodden(qx, qy)) m.setGround(qx, qy, S, 'dirt'); }
          prev = [px, py];
          if (s < n - 2 && hash(px, py, 181) < 0.45) { const qx = alongX ? px + 1 : px, qy = alongX ? py : py + 1; if (trodden(qx, qy)) m.setGround(qx, qy, S, 'dirt'); } // wider in places
        }
      }
    }
  }

  // ---- forests -------------------------------------------------------------------------------
  // Trees stand in clumps (where the noise is high) with glades between them, thinning out
  // towards the edge of the wood, where bushes and ferns take over. Leaves lie under them.
  const TREES = { pine: ['pine', 'pine', 'pine', 'tree'], oak: ['tree', 'tree', 'tree', 'pine'], mixed: ['tree', 'pine'] };
  const forest = new Uint8Array(W * H);
  const free = (x, y) => { const t = at(x, y); return t && !t.items.length && t.ground === 'grass' && !keep[y * W + x]; };
  for (const f of d.forests) eachIn(f.outline, (x, y) => {
    if (!insideRough(f.outline, x, y, 2.5, 81)) return;
    forest[y * W + x] = 1;
    if (!free(x, y)) return;
    const inner = insideRough(f.outline, x, y, 2.5, 81) && [[-3, 0], [3, 0], [0, -3], [0, 3]].every(([dx, dy]) => inside(f.outline, x + dx, y + dy));
    const clump = noise(x, y, 5, 82) * 0.75 + noise(x, y, 2.5, 85) * 0.25; // 0..1, high in the clumps
    const thick = f.density * Math.max(0, Math.min(1, (clump - 0.3) / 0.45)) * (inner ? 1 : 0.55);
    const v = hash(x, y, 83);
    if (v < thick) put(x, y, S, TREES[f.kind][Math.floor(hash(x, y, 84) * TREES[f.kind].length)]);
    else if (v < thick + (inner ? 0.05 : 0.12)) put(x, y, S, 'bush');
    else if (v < thick + (inner ? 0.09 : 0.16)) put(x, y, S, 'fern');
    else if (v < thick + 0.18 && clump > 0.45) put(x, y, S, f.kind === 'pine' ? 'grass_tuft' : 'leaves');
    else if (v < thick + 0.185) put(x, y, S, 'mushrooms');
  });

  // ---- the open land ------------------------------------------------------------------------------
  // Things come in patches, never scattered evenly: flowers where the flower noise is high, tall
  // grass where the grass noise is, small groups of trees, boulders by the cliffs and on stony
  // ground, shells and driftwood on the beaches, reeds by fresh water, boulders in the shallows.
  const nearCliff = (x, y) => [[0, -1], [-1, 0], [1, 0], [0, 1], [-1, -1], [1, -1]].some(([dx, dy]) => (at(x + dx, y + dy) || { items: [] }).items.includes('cliff'));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, t = at(x, y);
    if (!t || t.items.length || keep[i] || forest[i]) continue;
    const v = hash(x, y, 91), flowers = noise(x, y, 4, 92), grassy = noise(x, y, 5, 93), grove = noise(x, y, 6, 94);
    if (!land[i]) { // the sea: boulders in the shallows off rocky shores
      if (shore[i] === 0 && isRocky(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => land[i + dx + dy * W]) && v < 0.18) put(x, y, S, 'rock');
      continue;
    }
    const byWater = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => ground(x + dx, y + dy) === 'water');
    if (t.ground === 'swamp') {
      if (v < 0.09) put(x, y, S, 'reeds');
      else if (v < 0.115) put(x, y, S, 'dead_tree');
      else if (v < 0.13) put(x, y, S, 'puddle');
      else if (v < 0.15) put(x, y, S, 'mushrooms');
    } else if (t.ground === 'grass') {
      const sea = shore[i] <= 5;
      if (stony[i] && v < 0.12) { put(x, y, S, v < 0.05 ? 'rock' : 'pebbles'); continue; }
      if (byWater && !sea && v < 0.3) put(x, y, S, 'reeds');
      else if (nearCliff(x, y) && v < 0.18) put(x, y, S, v < 0.12 ? 'rock' : 'bush');
      else if (meadow[i] && flowers > 0.55 && v < 0.22) put(x, y, S, 'flowers');
      else if (meadow[i] && grassy > 0.6 && v < 0.25) put(x, y, S, 'tallgrass');
      else if (flowers > 0.72 && v < 0.12) put(x, y, S, 'flowers');
      else if (grassy > 0.68 && v < 0.14) put(x, y, S, v < 0.08 ? 'tallgrass' : 'grass_tuft');
      else if (!meadow[i] && grove > 0.7 && v < 0.26) put(x, y, S, v < 0.16 ? 'tree' : 'bush');
      else if (!meadow[i] && v < 0.09 + grove * 0.2) put(x, y, S, v < 0.07 ? 'pine' : v < 0.1 ? 'bush' : 'tree'); // firs and bushes everywhere
      else if (v < 0.006) put(x, y, S, 'grass_tuft');
      else if (v < 0.008) put(x, y, S, 'rock');
    } else if (t.ground === 'mountain') {
      const clump = noise(x, y, 3, 95) * 0.7 + hash(x, y, 96) * 0.3;
      if (clump > (stony[i] ? 0.62 : 0.7) && v < 0.55) put(x, y, S, 'rock');
      else if (v < (stony[i] ? 0.3 : 0.16)) put(x, y, S, 'pebbles');
    } else if (t.ground === 'sand') {
      if (v < 0.012) put(x, y, S, 'shells');
      else if (v < 0.017 && shore[i] === 1) put(x, y, S, 'driftwood');
      else if (v < 0.02) put(x, y, S, 'rock');
    } else if (t.ground === 'dirt' && v < 0.02) put(x, y, S, 'pebbles');
  }

  buildTown(m, S, runs, d.rivers[0]);
  // ---- round the town, outside its moat: not one empty lawn ------------------------------------------------------
  // A field by the west road, fenced, with crops in rows, a scarecrow and a path from its gate to the road; and in the
  // ring of open land round the moat, clumps of bushes with a tree in them, a few loose boulders and patches of
  // wildflowers (never on a road or right beside one)
  {
    // (one big field rather than small plots: rows of grain, now and then a bare furrow or a tuft of weeds)
    const B = OAKVALE.bounds, F = { x0: 76, y0: 99, x1: 93, y1: 106, gate: [90, 106] };
    for (let y = F.y0; y <= F.y1; y++) for (let x = F.x0; x <= F.x1; x++) {
      const t = m.get(x, y, S); if (!t || t.ground === 'water') continue;
      for (let z = S + 1; z < m.depth; z++) m.set(x, y, z, null);
      const edge = x === F.x0 || x === F.x1 || y === F.y0 || y === F.y1, v = hash(x, y, 141);
      if (edge) m.set(x, y, S, { ground: 'grass', items: x === F.gate[0] && y === F.gate[1] ? [] : ['fence'] });
      else m.set(x, y, S, { ground: 'farmland', items: v < 0.06 ? ['tallgrass'] : v < 0.12 ? [] : ['crops'] });
    }
    put(F.x0 + 5, F.y0 + 3, S, 'scarecrow');
    for (const [x, y] of [[F.gate[0] - 2, F.y1 + 1], [F.gate[0] - 3, F.y1 + 1]]) { const t = m.get(x, y, S); if (t && t.ground === 'grass') m.set(x, y, S, { ground: 'grass', items: ['haystack'] }); }
    for (let y = F.y1; y <= 116; y++) { const t = m.get(F.gate[0], y, S); if (t && t.ground === 'grass') m.set(F.gate[0], y, S, { ground: 'dirt', items: [] }); }
    const road = g => ['dirt', 'cobble', 'gravel', 'bridge_ns', 'bridge_ew', 'farmland'].includes(g);
    const nearRoad = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const t = m.get(x + dx, y + dy, S); if (t && (road(t.ground) || t.items.includes('fence'))) return true; } return false; };
    for (let y = B.y0 - 14; y <= B.y1 + 14; y++) for (let x = B.x0 - 14; x <= B.x1 + 14; x++) {
      if (x >= B.x0 && x <= B.x1 && y >= B.y0 && y <= B.y1) continue;
      { const g = OAKVALE.graveyard; if (x >= g.x0 - 1 && x <= g.x1 + 1 && y >= g.y0 - 1 && y <= g.y1 + 1) continue; } // (the graveyard keeps its own)
      const t = m.get(x, y, S); if (!t || t.ground !== 'grass' || t.items.length || nearRoad(x, y)) continue;
      const clump = noise(x, y, 5, 131), v = hash(x, y, 132);
      if (clump > 0.74 && v < 0.55) put(x, y, S, v < 0.12 ? 'tree' : 'bush');
      else if (clump < 0.2 && v < 0.05) put(x, y, S, 'rock');
      else if (noise(x, y, 7, 133) > 0.7 && v < 0.3) put(x, y, S, 'flowers');
    }
  }
  buildSewers(m, S);
  buildCrypt(m, S);
  buildSpiderDen(m, S);
  buildDeepSewers(m, S);
  buildOldTower(m, S);
  buildTowerTop(m, S);
  buildGoblinWarren(m, S);
  buildGoblinDeep(m);
  buildDeepWebs(m); // (after the spiders' den: it goes on below it)
  buildWellTunnels(m, S);
  buildGateSites(m, S);
  buildDiscoveries(m, S);
  { // One-Eye Patch's den (see PATCH_DEN): dug-up earth, Odo's sacks, and Patch
    const [px, py] = PATCH_DEN.at;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const t = m.get(px + dx, py + dy, S);
      if (t && m.isWalkable(px + dx, py + dy, S) && !t.items.length) t.ground = 'dirt';
    }
    for (const [x, y] of PATCH_DEN.sacks) if (m.isWalkable(x, y, S)) m.addItem(x, y, S, 'sack');
    m.spawns.push({ type: 'one_eye_patch', x: px, y: py, z: S });
  }
  buildSeaCaves(m, S); // (after the lighthouse: its ladder comes up under the lighthouse's floor)
  dressMountains(m, S);
  buildStorySites(m, S);

  // ---- hunting grounds: harder the further from town ----------------------------------------------------------
  // [type, count, [x0, y0, x1, y1], z?, ground?]: that many over the area in packs of up to three, as the old
  // spawns were, each on the nearest free tile (outside town, off roads and bridges, on `ground` if given), at
  // fixed places worked out from the coordinates.
  const huntingGrounds = [
    ['rat', 20, [110, 154, 140, 186]],                       // Sunny Fields: the first fights, in pairs over the whole meadow
    ['rabbit', 10, [134, 158, 150, 186]],                    // Sunny Fields: the rabbits that raid Farmer Odo's carrots, east of the road
    // (Fox Copse's pack keeps to the copse's far west side: well out of sight of the first rats, so a newcomer's first
    // task isn't a fight with three wolves)
    ['wolf', 3, [132, 84, 146, 96]], ['wolf', 3, [86, 152, 91, 162]], // Owl Grove, Fox Copse
    ['crab', 6, [148, 56, 178, 86], S, 'sand'],              // the shore of Mirror Lake
    ['crab', 2, [94, 210, 97, 215], S, 'sand'],              // the west beach of Lighthouse Point
    ['crab', 6, [150, 204, 180, 212], S, 'sand'],            // the long south beach, east of the point (away from the spiders; Old Snapper alone at its east end)
    ['crab', 5, [30, 160, 60, 190], S, 'sand'],              // the beach by Fisher's Rest
    ['slime', 12, [44, 123, 64, 144]],                       // Frog Marsh (its south: off the west road)
    ['wolf', 21, [42, 60, 84, 110]],                         // Wolf Woods
    // (none in Thorn Thicket on the trail south any more, nor round the Thornmother's corner in the south-east)
    ['spider', 5, [162, 178, 168, 192]],                     // the west foot of the Spider Hills, past Thorn Thicket (off the trail)
    ['spider', 10, [170, 162, 204, 180]],                    // round the north foot of the Spider Hills (south of Deer Woods)
    ['goblin', 2, [83, 63, 87, 68]],                         // Stony Field: a pair of goblin scouts, up under the North Peaks
    ['goblin', 15, [174, 58, 208, 88]],                      // Goblin Hill
    ['wolf', 8, [154, 92, 214, 158]],                        // Deer Woods
    ['skeleton', 6, [186, 110, 204, 126], S + 1],            // the top of the Old Tower hill
    ['bear', 6, [200, 136, 212, 152]],                       // deep in Deer Woods
    ['bear', 3, [198, 94, 212, 106]],                        // the north-east of Deer Woods
    ['bear', 3, [192, 40, 212, 56], S + 1],                  // the top of Hermit Rock
  ];
  // Lighthouse Point: the stump of the fallen lighthouse (a ring of rubble round two broken pillars), and the keeper's fire
  for (const [x, y] of [[126, 214], [127, 213], [129, 213], [130, 214], [130, 216], [129, 217], [127, 217], [126, 216]]) if (m.isWalkable(x, y, S)) put(x, y, S, 'rubble');
  for (const [x, y] of [[127, 215], [129, 215]]) if (m.isWalkable(x, y, S)) put(x, y, S, 'pillar');
  if (m.isWalkable(133, 211, S)) put(133, 211, S, 'campfire');
  if (m.isWalkable(195, 47, S + 1)) put(195, 47, S + 1, 'campfire_out'); // the hermit's fire on Hermit Rock (lit at night: a story)
  // the founder's diary, page by page (The Oakvale Chronicle): out in the world, where she wrote them
  for (const [page, x, y, z] of [[1, 48, 175, S], [2, ...OLD_TOWER.page, S + 1], [3, 82, 181, S - 1], [4, 197, 71, S]]) {
    const p = (m.isWalkable(x, y, z) ? { x, y } : null) || [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]].map(([dx, dy]) => ({ x: x + dx, y: y + dy })).find(q => m.isWalkable(q.x, q.y, z));
    if (p) { put(p.x, p.y, z, 'chronicle_page'); m.setMeta(p.x, p.y, z, { page }); }
  }
  const taken = new Set();
  // Open ground: not a little pocket shut in between trees or rocks (at least 40 tiles to walk about in).
  const open = (x, y, z) => {
    const seen = new Set([`${x},${y}`]), todo = [[x, y]];
    while (todo.length && seen.size < 40) {
      const [a, b] = todo.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${a + dx},${b + dy}`;
        if (!seen.has(k) && m.isWalkable(a + dx, b + dy, z)) { seen.add(k); todo.push([a + dx, b + dy]); }
      }
    }
    return seen.size >= 40;
  };
  const spot = (x, y, z, ground, far = 4) => {
    for (let r = 0; r <= far; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const px = x + dx, py = y + dy, t = m.get(px, py, z);
      if (!t || taken.has(`${px},${py},${z}`) || (ground && t.ground !== ground)) continue;
      if (px >= OAKVALE.bounds.x0 && px <= OAKVALE.bounds.x1 && py >= OAKVALE.bounds.y0 && py <= OAKVALE.bounds.y1) continue;
      if (m.isWalkable(px, py, z) && !m.floorChange(px, py, z) && !m.isShelter(px, py, z) && !['bridge_ns', 'bridge_ew', 'dirt'].includes(t.ground) && open(px, py, z)) return [px, py];
    }
    return null;
  };
  // Packs keep apart (PACK_GAP tiles between their centres, whatever their kind), so a careful hunter can take on
  // one at a time; walk carelessly and you'll still have the next one on you.
  const PACK_GAP = 8, centres = [], placedAt = [], PACK = { crab: 2, rat: 2, goblin: 2, skeleton: 2 }; // (in twos: crabs are tough, and
  // rats, goblins and skeletons are many)
  let packs = 0; // which pack is being placed
  const roomy = (x, y, z) => centres.every(c => c.z !== z || Math.max(Math.abs(c.x - x), Math.abs(c.y - y)) >= PACK_GAP);
  for (const [type, count, [x0, y0, x1, y1], z = S, ground] of huntingGrounds) {
    let placed = 0, centre = 0, misses = 0, at = null;
    for (let i = 0; placed < count && i < count * 60; i++) {
      // a pack: a centre, and up to three round it; a new centre every third one, or when this one finds no room
      if (misses > 3) { centre++; misses = 0; at = null; }
      const cx = x0 + Math.floor(hash(centre, count, 71) * (x1 - x0 + 1)), cy = y0 + Math.floor(hash(count, centre, 73) * (y1 - y0 + 1));
      if (at !== centre) {
        if (!roomy(cx, cy, z)) { centre++; continue; } // too near another pack
        at = centre; packs++; centres.push({ x: cx, y: cy, z });
      }
      const x = cx + Math.floor(hash(i, 5, 79) * 5) - 2, y = cy + Math.floor(hash(7, i, 89) * 5) - 2;
      const p = spot(x, y, z, ground);
      if (!p || placedAt.some(o => o.pack !== packs && o.z === z && Math.max(Math.abs(o.x - p[0]), Math.abs(o.y - p[1])) <= 5)) { misses++; continue; }
      placedAt.push({ x: p[0], y: p[1], z, pack: packs });
      if ((placed + 1) % (PACK[type] || 3) === 0) { centre++; misses = 0; at = null; }
      taken.add(`${p[0]},${p[1]},${z}`);
      m.spawns.push({ type, x: p[0], y: p[1], z });
      placed++;
    }
  }

  // The gate watch's bosses, one each, in the heart of their hunting ground (a free open spot near there): Old Snapper
  // on the beach where the sand spit runs out to Wendel's rock, so the south gate's task has its boss on the way
  // (Greyfang in his den in Wolf Woods, Gnash in his camp: GATE_SITES)
  for (const [type, x, y, ground] of [['greyfang', 67, 71], ['old_snapper', 104, 213, 'sand'], ['thornmother', 184, 190], ['gnash', 197, 68]]) {
    const p = spot(x, y, S, ground, 12);
    // (Gnash keeps to his camp: he doesn't join every fight on Goblin Hill, only the ones in it)
    if (p) { taken.add(`${p[0]},${p[1]},${S}`); m.spawns.push({ type, x: p[0], y: p[1], z: S, ...(type === 'gnash' ? { leash: 5 } : {}) }); }
  }
  // Greyfang's den is his own: the packs of Wolf Woods keep out of it (he calls his own wolves when he fights)
  for (let i = m.spawns.length - 1; i >= 0; i--) { const s = m.spawns[i]; if (s.type === 'wolf' && s.z === S && Math.max(Math.abs(s.x - 67), Math.abs(s.y - 72)) <= 6) m.spawns.splice(i, 1); }
  // the goblins of Goblin Hill sleep at night (game-gates.js)
  { const [x0, y0, x1, y1] = GATE_SITES.sleepers; for (const s of m.spawns) if (s.z === S && ['goblin', 'gnash'].includes(s.type) && s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1) s.sleeps = true; }
  // The Ashen Choir's landing at the tip of Lighthouse Point (The Silent Bell V): three singers round their cantor
  // (placed by hand: the point is too small for the packs' spacing). They come ashore only at night once the bell rings
  // again, or for whoever is on The Silent Bell V (night: see ashore in game-combat.js), notice you only up close (lurk)
  // and keep to the tip (leash: 3 tiles), so the keeper's fire and the beaches stay safe.
  for (const [type, x, y] of [['choir_cantor', 128, 221], ['choir_cultist', 125, 220], ['choir_cultist', 131, 220], ['choir_cultist', 128, 223]]) {
    const p = spot(x, y, S, null, 3);
    // (band: they fight as one: hit one and they all come, a real last fight, not five easy ones one at a time)
    if (p) { taken.add(`${p[0]},${p[1]},${S}`); m.spawns.push({ type, x: p[0], y: p[1], z: S, night: 'bell_5', lurk: true, leash: 3, band: 'choir' }); }
  }

  { const g = OAKVALE.graveyard; m.spawns = m.spawns.filter(p => p.z !== S || p.x < g.x0 || p.x > g.x1 || p.y < g.y0 || p.y > g.y1); } // (nothing spawns in the graveyard)
  tidyWorld(m, S);

  // ---- where you start: in the temple ------------------------------------------------------------
  m.start = { x: OAKVALE.start.x, y: OAKVALE.start.y, z: S + 1 }; // in the temple on the mount
  m.mainStart = { ...m.start };
  // (the whole world is the starter island for now: every bit of land, its strands and islets too, is on it)
  m.isle = { x0: 0, y0: 0, x1: WORLD_SIZE.width - 1, y1: WORLD_SIZE.height - 1 };
  return m;
}

// Last touches over the whole world, so the rules hold everywhere, not only where someone looked:
//   - nothing hangs on a wall that a stair or ladder climbs against (it would show through the steps)
//   - a single tile of grass left in the middle of a trail becomes trail
// The Silent Bell's longer roads, through the places the story never went (all on the surface):
//   shrine: the founders' shrine by Mirror Lake (blessed water for the Gravewaker, The Silent Bell IV)
//   hood:   the singed grey hood in Greyfang's den, Wolf Woods (the start of the Choir's ash trail, The Silent Bell V)
//   altar:  the Choir's altar of ash at the end of the causeway into Frog Marsh, a singer on watch at night
//   cairn:  their unlit signal fire on Stony Field, facing Lighthouse Point, a singer on watch at night
const STORY_SITES = { shrine: [127, 58], hood: [66, 71], altar: [60, 125], altarSinger: [62, 126], cairn: [89, 77], cairnSinger: [90, 79] };
function buildStorySites(m, S) {
  const T = STORY_SITES, place = ([x, y], id) => { const t = m.get(x, y, S); t.items = t.items.filter(i => !THINGS[i].block && i !== 'bones'); t.items.push(id); };
  place(T.shrine, 'lake_shrine'); place(T.hood, 'singed_hood'); place(T.altar, 'ash_altar'); place(T.cairn, 'signal_cairn');
  for (const at of [T.altarSinger, T.cairnSinger]) m.spawns.push({ type: 'choir_cultist', x: at[0], y: at[1], z: S, night: 'bell_5', lurk: true, leash: 3 });
}

// The hills' ledges and plateaus, so climbing up pays: the founders' lookout on Bone Rocks (a cairn with a find, the
// view over the bone trail, two skeletons on watch), the spiders' hatchery on the Spider Hills (eggs and webs, an old
// pack in them with silk, two spiders), and the hermit's heather on Hermit Rock (his beehives, a fire, bushes, flowers).
// Each takes free, walkable tiles of its box on the floor above the land (S + 1), in a fixed order, so it never blocks
// the way up: the ramp's top tiles and those beside them are kept clear.
const MOUNTAIN_SIGHTS = [
  { box: [70, 192, 86, 199], cache: 'qchest_bone_lookout', spawns: ['skeleton', 'skeleton'],
    props: ['gravestone', 'bones', 'bones'],
    look: 'From up here you see the whole bone trail, the crypt\'s steps at the foot of the crag, and the sea beyond. The founders stood here, the stones say, to watch for ships.' },
  { box: [172, 190, 188, 199], cache: 'qchest_spider_cache', spawns: ['spider', 'spider'],
    props: ['eggs', 'eggs', 'web', 'web'],
    look: 'Nests of eggs in the heather, wrapped in grey silk. Whatever lays them is big, and not far.' },
  { box: [192, 39, 211, 56], props: ['beehive', 'beehive', 'beehive', 'bush', 'bush', 'flowers', 'flowers', 'flowers', 'stump', 'rock', 'campfire'],
    look: 'The heather hums with the hermit\'s bees. On a clear night, they say, you can count every star from up here.' },
];
function dressMountains(m, S) {
  const Z = S + 1, hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000;
  for (const site of MOUNTAIN_SIGHTS) {
    const [x0, y0, x1, y1] = site.box, free = [], ground = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = m.get(x, y, Z);
      if (!t || t.items.length || !m.isWalkable(x, y, Z)) continue;
      ground.push([x, y]); // (anywhere a monster can stand)
      // (clear of the way up: no ramp top within two tiles, and all eight neighbours walkable, so nothing is blocked)
      let open = true;
      for (let dy = -2; dy <= 2 && open; dy++) for (let dx = -2; dx <= 2; dx++) { const n = m.get(x + dx, y + dy, Z); if (n && n.items.includes('ramp_top')) { open = false; break; } }
      for (let dy = -1; dy <= 1 && open; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && !m.isWalkable(x + dx, y + dy, Z)) { open = false; break; }
      if (open) free.push([x, y]);
    }
    free.sort((a, b) => hash(...a) - hash(...b));
    const take = () => { const p = free.shift(); if (p) for (let i = free.length - 1; i >= 0; i--) if (Math.max(Math.abs(free[i][0] - p[0]), Math.abs(free[i][1] - p[1])) <= 1) free.splice(i, 1); return p; };
    if (site.cache) { const p = take(); if (p) { m.addItem(p[0], p[1], Z, site.cache); m.setMeta(p[0], p[1], Z, { look: site.look }); } }
    else { const p = free[0]; if (p) m.setMeta(p[0], p[1], Z, { look: site.look }); }
    for (const id of site.props) { const p = take(); if (p) m.addItem(p[0], p[1], Z, id); }
    ground.sort((a, b) => hash(...b) - hash(...a));
    for (const type of site.spawns || []) {
      const p = ground.find(([x, y]) => !m.get(x, y, Z).items.length && !m.spawns.some(s => s.z === Z && s.x === x && s.y === y));
      if (p) m.spawns.push({ type, x: p[0], y: p[1], z: Z, lurk: true });
    }
  }
}

function tidyWorld(m, S) {
  const CLIMB = ['stairs_up', 'ladder', 'cave_ladder', 'sewer_ladder'];
  for (let z = 0; z < m.depth; z++) for (let y = 1; y < m.height - 1; y++) for (let x = 1; x < m.width - 1; x++) {
    const t = m.get(x, y, z);
    if (!t) continue;
    if (t.items.some(id => CLIMB.includes(id))) {
      const n = m.get(x, y - 1, z);
      if (n) n.items = n.items.filter(id => !THINGS[id].onWall);
    }
    if (z === S && t.ground === 'grass' && !t.items.length) {
      const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => (m.get(x + dx, y + dy, z) || {}).ground);
      if (around.every(g => g === 'dirt')) t.ground = 'dirt';
    }
  }
  // A strip of grass between two houses runs on up to the street, beside the houses' walls: their walls stand higher
  // than the tile, so a street tile left at the strip's head looks like a notch of paving cut into the gap
  const wallAt = (x, y) => (m.get(x, y, S) || { items: [] }).items.some(id => THINGS[id].wall);
  const bare = (x, y) => { const t = m.get(x, y, S); return t && t.ground === 'cobble' && !t.items.length ? t : null; };
  for (let y = 2; y < m.height - 1; y++) for (let x = 1; x < m.width - 1; x++) {
    const g = m.get(x, y, S);
    if (!g || g.ground !== 'grass' || !wallAt(x - 1, y) || !wallAt(x + 1, y)) continue; // (a narrow strip between two walls)
    for (let k = 1, up; (up = bare(x, y - k)) && (k === 1 || wallAt(x - 1, y - k) || wallAt(x + 1, y - k)); k++) up.ground = 'grass';
  }
  // ...and round a building's outer corner beside such grass: a wall stands along the south and east edge of its tile, so
  // at a corner with no roof over it (the north-east or north-west one) the rest of the tile is outside, and the wall
  // rises over the tile north of it: paving left there shows as a notch between the wall and the grass. Both grow grass,
  // the one to the north where the grass beside it runs on north too.
  const thinAt = (x, y) => (m.get(x, y, S) || { items: [] }).items.some(id => THINGS[id].wall === 'thin');
  const roofedAt = (x, y) => { const up = m.get(x, y, S + 1); return !!(up && up.ground && THINGS[up.ground].roof); };
  for (let y = 1; y < m.height - 1; y++) for (let x = 1; x < m.width - 1; x++) {
    const t = m.get(x, y, S);
    if (!t || t.ground !== 'cobble' || !thinAt(x, y) || thinAt(x, y - 1) || roofedAt(x, y)) continue;
    const grass = (dx, dy = 0) => (m.get(x + dx, y + dy, S) || {}).ground === 'grass' && !thinAt(x + dx, y + dy);
    for (const dx of [1, -1]) {
      if (!grass(dx)) continue;
      t.ground = 'grass';
      const north = bare(x, y - 1);
      if (north && grass(dx, -1)) north.ground = 'grass';
    }
  }
}

// Builds the places of Oakvale Isle's hidden quests (see DISCOVERY): Fisher's Rest with its hut and jetty, the sea cave,
// the farm in Sunny Fields and its cellar, the lighthouse, the cave under the North Peaks with the climbers' chimney and
// the eyrie, the people there, and loose sand to dig on the beaches. (Before the hunting grounds: their monsters keep
// out of what stands here.)
function buildDiscoveries(m, S) {
  const D = DISCOVERY, put = (x, y, z, id) => m.addItem(x, y, z, id);
  const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 / 1000;
  const sign = (x, y, text) => { m.set(x, y, S, { ground: m.get(x, y, S).ground, items: ['signpost'] }); m.setMeta(x, y, S, { text }); };
  // The nearest walkable tile (not a floor change) to a spot on floor z, within r.
  const near = (x, y, z, r = 2) => {
    for (let d = 0; d <= r; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === d && m.isWalkable(x + dx, y + dy, z) && !m.floorChange(x + dx, y + dy, z)) return [x + dx, y + dy];
    }
    return null;
  };
  const spawn = (type, x, y, z, how) => { const p = near(x, y, z); if (p) m.spawns.push({ type, x: p[0], y: p[1], z, ...how }); };

  // A small building out in the wilds, as the town's are built: floor, walls with windows and a door, a roof on top,
  // stairs between its floors (stairs: from each floor up, at its own place), and a shelter: monsters keep out.
  const house = b => {
    const floors = b.floors || 1, inB = (x, y) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
    const edge = (x, y) => inB(x, y) && (x === b.x0 || x === b.x1 || y === b.y0 || y === b.y1);
    for (let k = 0; k < floors; k++) for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      const z = S + k, items = edge(x, y) ? [b.wall] : [];
      const straight = (edge(x - 1, y) && edge(x + 1, y)) || (edge(x, y - 1) && edge(x, y + 1)), along = edge(x - 1, y) && edge(x + 1, y) ? x : y;
      if (edge(x, y) && straight && along % 3 === 0 && Math.abs(x - b.door[0]) + Math.abs(y - b.door[1]) > 1) items.push('window');
      m.set(x, y, z, { ground: k ? 'wood' : b.floor, items });
    }
    for (let k = S + floors; k < m.depth; k++) for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) m.set(x, y, k, null);
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (inB(x, y - 1) && inB(x - 1, y)) m.set(x, y, S + floors, { ground: b.roof, items: [] });
    const [dx, dy] = b.door;
    m.get(dx, dy, S).items = ['door'];
    const out = m.get(dx, dy + 1, S);
    if (out && ['grass', 'sand'].includes(out.ground)) { out.ground = 'gravel'; out.items = []; }
    (b.stairs || []).forEach(([x, y], k) => { put(x, y, S + k, 'stairs_up'); put(x, y, S + k + 1, 'stairs_down'); });
    for (const [x, y, k, id] of b.props || []) put(x, y, S + k, id);
    for (let k = 0; k < floors; k++) m.zones.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, z: S + k, shelter: true });
  };
  // Carving rock underground (or inside a mountain): the tiles, and a wall of rock round them where there is nothing.
  const carve = (z, tiles, ground = 'cave', wall = 'wall_cave') => {
    for (const [x, y] of tiles) m.set(x, y, z, { ground, items: [] });
    const cut = new Set(tiles.map(([x, y]) => `${x},${y}`));
    for (const [x, y] of tiles) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const t = m.get(x + dx, y + dy, z);
      if (cut.has(`${x + dx},${y + dy}`) || (t && (t.items.includes('cliff') || t.items.some(id => THINGS[id].wall)))) continue;
      if (!t || !m.isWalkable(x + dx, y + dy, z)) m.set(x + dx, y + dy, z, { ground: 'cave', items: [wall] });
    }
  };
  const ellipse = ([cx, cy, rx, ry], k = 0.85) => {
    const out = [];
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < k + hash(x + 5, y + 9) * 0.3) out.push([x, y]);
    }
    return out;
  };
  const rect = ([x0, y0, x1, y1]) => { const out = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y]); return out; };

  // ---- Fisher's Rest: Old Maddock's hut, his jetty and boat, nets drying, and where Wenna buried the key -------------
  {
    const F = D.fisher;
    house(F.hut);
    { const [x0, y0, x1, y1] = F.jetty; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.set(x, y, S, { ground: 'pier', items: [] }); }
    put(...F.boat, S, 'boat');
    for (const [x, y] of F.racks) { m.get(x, y, S).items = ['fish_rack']; }
    for (const [x, y] of F.barrels) { m.get(x, y, S).items = ['barrel']; }
    const { at: [rx, ry], stones } = F.riddle;
    for (const [x, y] of [[rx, ry], ...stones]) m.set(x, y, S, { ground: 'sand', items: [] });
    for (const [x, y] of stones) put(x, y, S, 'rock');
    m.setMeta(rx, ry, S, { dig: 'tidecutter', thing: 'tide_dig' });
    sign(...F.sign);
  }

  // ---- the sea cave south of Fisher's Rest: the gate, two grottoes, the wreck of the Gull ------------------------------
  {
    const C = D.seaCave, Z = C.z, [dx, dy] = C.door;
    m.get(dx, dy, S).items = ['stairs_down'];
    m.setMeta(dx, dy, S, { look: C.look });
    const tiles = [...C.rooms.flatMap(rect), ...C.grottoes.flatMap(g => ellipse(g)), ...C.passages.flatMap(rect)];
    carve(Z, tiles);
    for (const [cx, cy, rx, ry] of C.pools) for (const [x, y] of ellipse([cx, cy, rx, ry], 0.9)) if (m.isWalkable(x, y, Z)) m.setGround(x, y, Z, 'water');
    m.get(dx, dy, Z).items = ['stairs_up'];
    const [gx, gy] = C.gate;
    m.get(gx, gy, Z).items = ['sea_gate'];
    m.setMeta(gx, gy, Z, { lock: 'sea_cave', look: C.gateLook });
    for (const [x, y, id] of C.props) { const t = m.get(x, y, Z); if (t && m.isWalkable(x, y, Z)) put(x, y, Z, id); }
    for (const [type, x, y] of C.monsters) spawn(type, x, y, Z);
  }

  // ---- the farm in Sunny Fields: the farmhouse, the mill, the crops; the cellar the rats took ---------------------------
  {
    const F = D.farm, C = F.cellar;
    house(F.house);
    m.get(...F.windmill, S).items = ['windmill'];
    put(...F.scarecrow, S, 'scarecrow');
    for (const [x, y] of F.haystacks) m.get(x, y, S).items = ['haystack'];
    const [x0, y0, x1, y1] = F.crops, gate = [(x0 + x1) >> 1, y0];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = m.get(x, y, S), edge = x === x0 || x === x1 || y === y0 || y === y1;
      if (!t || t.items.includes('scarecrow')) continue;
      t.ground = edge ? 'grass' : 'farmland';
      t.items = edge && !(x === gate[0] && y === gate[1]) ? ['fence'] : !edge && y % 2 ? ['crops'] : [];
    }
    carve(C.z, rect(C.room), 'paving', 'wall_sewer');
    m.get(...C.ladder, C.z).items = ['cave_ladder'];
    for (const [x, y, id] of C.props) put(x, y, C.z, id);
    for (const [x, y] of C.rats) spawn('giant_rat', x, y, C.z);
  }

  // ---- the lighthouse on Lighthouse Point: three floors of stone, and the great lamp on top -----------------------------
  {
    const L = D.lighthouse;
    house(L);
    put(L.lamp[0], L.lamp[1], S + L.floors - 1, 'lighthouse_lamp');
  }

  // ---- the cave under the North Peaks, the climbers' chimney, and the eyrie ----------------------------------------------
  {
    const P = D.peaks, Z = P.z, [dx, dy] = P.door;
    m.get(dx, dy, S).items = ['stairs_down']; // cut into the foot of the peaks
    m.set(dx, dy, S + 1, null);              // (no rock over the steps)
    m.setMeta(dx, dy, S, { look: P.look });
    carve(Z, [...P.chambers.flatMap(c => ellipse(c)), ...P.passages.flat(), [dx, dy]]);
    m.get(dx, dy, Z).items = ['stairs_up'];
    for (const [x, y] of P.cracked) m.get(x, y, Z).items = ['cracked_rock'];
    m.get(...P.flint, Z).items = ['flint_seam'];
    for (const [x, y, id] of P.props) { const t = m.get(x, y, Z); if (t && m.isWalkable(x, y, Z) && !t.items.length) put(x, y, Z, id); }
    // the eyrie: the top of the peak's second tier where it stands on rock, rugged no more (before the chimney is cut under it)
    const E = P.eyrie, eyrie = [];
    for (let y = E.y0; y <= E.y1; y++) for (let x = E.x0; x <= E.x1; x++) {
      const t = m.get(x, y, E.z), below = m.get(x, y, E.z - 1);
      if (t && t.ground === 'rock_top' && !t.items.includes('cliff') && below && below.items.includes('cliff')) { t.ground = 'mountain'; t.items = []; eyrie.push([x, y]); }
    }
    for (const [x, y] of eyrie) {
      const rim = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => !eyrie.some(([a, b]) => a === x + ox && b === y + oy));
      if (rim && hash(x, y) < 0.25) m.get(x, y, E.z).items = ['crag'];
      else if (hash(x + 3, y) < 0.12) put(x, y, E.z, 'pebbles');
    }
    for (const [x, y] of eyrie) m.setMeta(x, y, E.z, { look: E.look });
    // the chimney: a room cut in the rock on each floor, ladders up, trapdoors down
    const H = P.chimney;
    for (let z = H.from; z <= H.to; z++) carve(z, rect([H.x0, H.y0, H.x1, H.y1]));
    for (const [x, y, z, id] of H.climb) m.ensure(x, y, z).items = [id];
    { const [x, y] = E.nest, t = m.get(x, y, E.z); if (t) t.items = ['eagle_nest']; }
    for (const [x, y, z] of P.shades) spawn('shade', x, y, z);
  }

  // ---- loose sand on the beaches, here and there: dig it ------------------------------------------------------------------
  for (let y = 1; y < m.height - 1; y++) for (let x = 1; x < m.width - 1; x++) {
    const t = m.get(x, y, S);
    if (!t || t.ground !== 'sand' || t.items.length || hash(x * 31 + 7, y * 17 + 1) > 0.045 || m.getMeta(x, y, S)) continue;
    if (x >= OAKVALE.bounds.x0 - 2 && x <= OAKVALE.bounds.x1 + 2 && y >= OAKVALE.bounds.y0 - 2 && y <= OAKVALE.bounds.y1 + 2) continue;
    if (![[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]].some(([ox, oy]) => (m.get(x + ox, y + oy, S) || {}).ground === 'water')) continue;
    put(x, y, S, 'buried');
  }

  // ---- the people out here ---------------------------------------------------------------------------------------------
  for (const [type, x, y, z] of D.people) { const p = near(x, y, z); if (p) m.npcs.push({ type, x: p[0], y: p[1], z }); }
}

// Builds the sewers under Oakvale (see SEWERS): the walkways, rooms and fallen-in parts, the channels and
// their bridges, a wall round all of it, a ladder under every grate, and the rats.
function buildSewers(m, S) {
  const D = SEWERS, Z = D.z, put = (x, y, id) => m.addItem(x, y, Z, id);
  const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 / 1000;
  const fill = ([x0, y0, x1, y1], fn) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) fn(x, y); };
  const wallOf = new Map(); // the wall each carved tile wants round it
  const carve = (x, y, ground, wall) => { m.set(x, y, Z, { ground, items: [] }); wallOf.set(`${x},${y}`, wall); };
  for (const r of D.walks) fill(r, (x, y) => carve(x, y, 'sewer', 'wall_sewer'));
  for (const r of D.rooms) fill([r.x0, r.y0, r.x1, r.y1], (x, y) => carve(x, y, r.ground, r.wall));
  for (const c of D.caves) {
    fill([Math.floor(c.cx - c.rx - 1), Math.floor(c.cy - c.ry - 1), Math.ceil(c.cx + c.rx + 1), Math.ceil(c.cy + c.ry + 1)], (x, y) => {
      const d = ((x - c.cx) / c.rx) ** 2 + ((y - c.cy) / c.ry) ** 2;
      if (d < 0.75 + hash(x + 3, y + 7) * 0.4) carve(x, y, 'cave', 'wall_cave');
    });
  }
  for (const r of D.channels) fill(r, (x, y) => m.setGround(x, y, Z, 'sewer_water'));
  for (const [x, y] of D.bridges) {
    const water = (dx, dy) => (m.get(x + dx, y + dy, Z) || {}).ground === 'sewer_water';
    m.setGround(x, y, Z, water(-1, 0) || water(1, 0) ? 'sewer_bridge_ns' : 'sewer_bridge_ew'); // planks across the flow
  }
  // A wall round everything carved, of the kind its neighbour asks for (rock round the fallen-in parts).
  for (const [k, wall] of wallOf) {
    const [x, y] = k.split(',').map(Number);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!m.get(x + dx, y + dy, Z)) m.set(x + dx, y + dy, Z, { ground: 'cave', items: [wall] });
    }
  }
  // A ladder under every grate, and a puddle beside it where the rain comes through.
  for (const [x, y] of OAKVALE.grates) {
    m.get(x, y, Z).items = ['sewer_ladder'];
    const wet = [[1, 0], [-1, 0], [0, 1]].find(([dx, dy]) => m.isWalkable(x + dx, y + dy, Z) && !(m.get(x + dx, y + dy, Z).items.length));
    if (wet) put(x + wet[0], y + wet[1], 'puddle');
  }
  for (const [x, y] of D.torches) put(x, y, 'wall_torch');
  for (const [x, y, id] of D.props) put(x, y, id);
  // Puddles and pebbles here and there on the walkways.
  for (const [k] of wallOf) {
    const [x, y] = k.split(',').map(Number), t = m.get(x, y, Z), v = hash(x * 3 + 1, y * 5 + 2);
    if (t.ground !== 'sewer' || t.items.length) continue;
    if (v < 0.04) put(x, y, 'puddle');
    else if (v < 0.07) put(x, y, 'pebbles');
  }
  // The rats, each on the nearest free tile to its spot.
  const spot = (x, y) => {
    for (let r = 0; r <= 2; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (m.isWalkable(x + dx, y + dy, Z) && !m.floorChange(x + dx, y + dy, Z)) return [x + dx, y + dy];
    }
    return null;
  };
  for (const [type, list] of [['rat', D.rats], ['giant_rat', D.bigRats]]) for (const [x, y] of list) {
    const p = spot(x, y);
    if (p) m.spawns.push({ type, x: p[0], y: p[1], z: Z });
  }
}

// Builds the old drains and the deep cistern under the sewers (see DEEP_SEWERS), and the way down to them.
function buildDeepSewers(m, S) {
  const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 / 1000;
  { const [x, y] = SEWERS.down; m.get(x, y, SEWERS.z).items = ['trapdoor']; }
  { const [x, y, look] = SEWERS.shaft; m.set(x, y, SEWERS.z, { ground: null, items: ['shaft_hole'] }); m.setMeta(x, y, SEWERS.z, { look }); }
  for (const L of DEEP_SEWERS) {
    const Z = L.z, wallOf = new Map();
    const carve = (x, y, ground, wall) => { m.set(x, y, Z, { ground, items: [] }); wallOf.set(`${x},${y}`, wall); };
    for (const [x0, y0, x1, y1] of L.drains || []) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) carve(x, y, 'sewer', 'wall_sewer');
    for (const c of L.caves || []) {
      for (let y = Math.floor(c.cy - c.ry - 1); y <= Math.ceil(c.cy + c.ry + 1); y++) for (let x = Math.floor(c.cx - c.rx - 1); x <= Math.ceil(c.cx + c.rx + 1); x++) {
        if (((x - c.cx) / c.rx) ** 2 + ((y - c.cy) / c.ry) ** 2 < 0.75 + hash(x + 3, y + 7) * 0.4) carve(x, y, 'cave', 'wall_cave');
      }
    }
    for (const [x0, y0, x1, y1, ground] of L.rooms || []) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) carve(x, y, ground, 'wall_sewer');
    for (const p of L.pools || []) {
      for (let y = Math.floor(p.cy - p.ry); y <= Math.ceil(p.cy + p.ry); y++) for (let x = Math.floor(p.cx - p.rx); x <= Math.ceil(p.cx + p.rx); x++) {
        if (((x - p.cx) / p.rx) ** 2 + ((y - p.cy) / p.ry) ** 2 < 1 && wallOf.has(`${x},${y}`)) m.setGround(x, y, Z, 'sewer_water');
      }
    }
    for (const [k, wall] of wallOf) {
      const [x, y] = k.split(',').map(Number);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!m.get(x + dx, y + dy, Z)) m.set(x + dx, y + dy, Z, { ground: 'cave', items: [wall] });
    }
    m.get(...L.up, Z).items = ['cave_ladder'];
    if (L.down) m.get(...L.down, Z).items = ['trapdoor'];
    for (const [x, y, id] of L.props) m.addItem(x, y, Z, id);
    for (const [type, spots, how] of L.monsters) for (const [x, y] of spots) if (m.isWalkable(x, y, Z) && !m.floorChange(x, y, Z)) m.spawns.push({ type, x, y, z: Z, ...how });
  }
}

// Builds the crypt under Bone Rocks (see CRYPT): the steps down from the crag, the way there and its sign,
// and on each floor the rooms with carved walls round them, the stairs, the tombs and the dead.
function buildSpiderDen(m, S) {
  const D = SPIDER_DEN, Z = S - 1, [dx, dy] = D.door;
  const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 / 1000;
  m.get(dx, dy, S).items = ['stairs_down']; // cut into the foot of the hills
  m.set(dx, dy, S + 1, null);               // (no rock over the steps)
  { const [x, y, text] = D.sign; const t = m.get(x, y, S); if (t && !t.items.some(id => THINGS[id].block)) { t.items = ['signpost']; m.setMeta(x, y, S, { text }); } }
  const carved = [];
  const carve = (x, y) => { if (!m.get(x, y, Z) || m.get(x, y, Z).items.includes('wall_cave')) { m.set(x, y, Z, { ground: 'cave', items: [] }); carved.push([x, y]); } };
  D.chambers.forEach(([cx, cy, rx, ry], i) => {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 0.8 + hash(x + 5, y + 9) * 0.35) carve(x, y);
    }
    const next = D.chambers[i + 1];
    if (next) { // a tunnel two wide to the next chamber
      const steps = Math.ceil(Math.hypot(next[0] - cx, next[1] - cy) * 2);
      for (let k = 0; k <= steps; k++) { const x = Math.round(cx + (next[0] - cx) * k / steps), y = Math.round(cy + (next[1] - cy) * k / steps); carve(x, y); carve(x + 1, y); }
    }
  });
  carve(dx, dy);
  m.get(dx, dy, Z).items = ['stairs_up'];
  for (const [x, y] of carved) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    if (!m.get(x + ox, y + oy, Z)) m.set(x + ox, y + oy, Z, { ground: 'cave', items: ['wall_cave'] });
  }
  for (const [x, y, id] of D.props) { const t = m.get(x, y, Z); if (t && !t.items.length) m.addItem(x, y, Z, id); }
  for (const [x, y] of D.spiders) m.spawns.push({ type: 'spider', x, y, z: Z });
  m.spawns.push({ type: 'brood_queen', x: D.queen[0], y: D.queen[1], z: Z });
}

function buildCrypt(m, S) {
  const C = CRYPT, [dx, dy] = C.door;
  m.get(dx, dy, S).items = ['stairs_down']; // cut into the foot of the crag
  for (const [x, y] of C.niche) { const t = m.get(x, y, S); t.items = []; if (t.ground === 'grass') t.ground = 'dirt'; }
  for (const [x, y] of [[dx, dy], ...C.niche]) m.set(x, y, S + 1, null); // cut out of the crag: no rock overhead
  for (let i = 0; i + 1 < C.path.length; i++) {
    const [ax, ay] = C.path[i], [bx, by] = C.path[i + 1];
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) {
      const t = m.get(x, y, S);
      t.ground = 'dirt';
      t.items = t.items.filter(id => !THINGS[id].block);
    }
  }
  { const [x, y, text] = C.sign; m.get(x, y, S).items = ['signpost']; m.setMeta(x, y, S, { text }); }
  for (const f of C.floors) {
    const Z = f.z, carved = [];
    for (const [x0, y0, x1, y1] of f.rooms) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      m.set(x, y, Z, { ground: 'crypt', items: [] });
      carved.push([x, y]);
    }
    for (const [x, y] of carved) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!m.get(x + ox, y + oy, Z)) m.set(x + ox, y + oy, Z, { ground: 'crypt', items: ['wall_crypt'] });
    }
    if (f.dais) { const [x0, y0, x1, y1] = f.dais; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.setGround(x, y, Z, 'paving'); }
    for (const [x, y, id] of f.stairs) m.get(x, y, Z).items = [id];
    for (const [x, y] of f.torches) m.addItem(x, y, Z, 'wall_torch');
    for (const [x, y, id] of f.props) m.addItem(x, y, Z, id);
    for (const [x, y, id] of f.props) if (id === 'crypt_gate') m.setMeta(x, y, Z, { quest: 'bell_4', look: 'An iron gate, its lock new and heavy. Stairs lead down behind it, into the founder\'s tomb.' });
    for (const [type, x, y] of f.monsters) m.spawns.push({ type, x, y, z: Z, ...(f.lurk ? { lurk: true } : {}) });
  }
  // the Bone Chapel: the crack in the hall's east wall, the passage and the chapel behind it, carved walls round them
  const B = C.chapel, Z = B.z, carved = [];
  const [rx0, ry0, rx1, ry1] = B.room;
  for (let y = ry0; y <= ry1; y++) for (let x = rx0; x <= rx1; x++) { m.set(x, y, Z, { ground: 'crypt', items: [] }); carved.push([x, y]); }
  for (const [x, y] of B.passage) { m.set(x, y, Z, { ground: 'crypt', items: [] }); carved.push([x, y]); }
  for (const [x, y] of carved) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    if (!m.get(x + ox, y + oy, Z)) m.set(x + ox, y + oy, Z, { ground: 'crypt', items: ['wall_crypt'] });
  }
  m.set(B.crack[0], B.crack[1], Z, { ground: 'crypt', items: ['cracked_rock'] });
  m.setMeta(B.crack[0], B.crack[1], Z, { look: 'A crack runs down the wall here, and cold air breathes through it. Somewhere behind it, faintly, someone is counting.' });
  for (const [x, y] of B.torches) m.addItem(x, y, Z, 'wall_torch');
  for (const [x, y, id] of B.props) m.addItem(x, y, Z, id);
  m.npcs.push({ type: 'oak_ossian', x: B.ossian[0], y: B.ossian[1], z: Z });
  m.addItem(B.skull[0], B.skull[1], Z, 'qchest_crest_skull');
  m.addItem(B.jaw[0], B.jaw[1], SEWERS.z, 'qchest_crest_jaw'); // (in the rats' nest under the training yard)
  const [gx, gy] = B.grave; // (the grave with no stone, up in the graveyard: dug with a shovel)
  m.setMeta(gx, gy, S, { dig: 'bone_chapel', thing: 'ossian_grave', look: 'A low mound of earth between the stones, sunken a little, with no stone of its own. Somebody tends it: the grass is cut.' });
}

// The Old Tower's upper storeys (The Captain's Mail): the tower's top is open to the sky, but above it, on the old beams,
// three storeys still stand, tilted and creaking, where the watch kept its pay and its captain kept his post. Nobody's
// arrow points there: you hear of a lantern at the top at night. From the broken top (floor 10) a rope up through a gap
// in the beams to the watch room (floor 11), its far half behind an iron grille (level 8 and up), stairs up to the
// captain's quarters (floor 12), and up again to the lookout on the roof (floor 13), where Captain Harrow keeps his post.
//   rope: the rope spot on floor 10, under the gap (a hole on floor 11); split: the watch room's dividing wall (y) and its
//   grille [x, level, look]; stairs: [x, y, from z]; props [x, y, z, id]; monsters [type, x, y, z]; gaps: the roof's
//   broken battlements (floor 13)
const TOWER_TOP = {
  rope: [195, 115, 'Above, the beams of the storey that still stands. Through a gap where the stair fell, an old iron hook. With a rope you could climb up.'],
  split: [117, [193, 8, 'An iron grille, its bars bent but holding. Cut into the beam above it: OFFICERS OF THE WATCH ONLY.']],
  stairs: [[191, 119, 11], [195, 119, 12]],
  props: [
    [191, 115, 11, 'barrel'], [192, 115, 11, 'crate'], [194, 116, 11, 'bones'], [191, 116, 11, 'rubble'], [195, 118, 11, 'bones'],
    [191, 115, 12, 'bed'], [192, 115, 12, 'table'], [195, 115, 12, 'bookshelf'], [193, 117, 12, 'bones'], [194, 118, 12, 'rubble'],
    [193, 115, 13, 'qchest_watch_mail'], [195, 117, 13, 'flagpole'], [191, 118, 13, 'bones'],
  ],
  monsters: [['skeleton', 192, 116, 11], ['skeleton', 194, 115, 11], ['shade', 193, 118, 11],
    ['shade', 192, 117, 12], ['skeleton', 194, 116, 12], ['shade', 192, 119, 12],
    ['watch_captain', 193, 117, 13], ['shade', 191, 116, 13]],
  gaps: [[190, 117], [196, 116], [193, 120], [196, 119]],
};

// Builds the Old Tower's upper storeys (see TOWER_TOP) on top of the tower (OLD_TOWER): three storeys of the same
// walls, the dividing wall and grille of the watch room, the rope up, the stairs, and who keeps them.
function buildTowerTop(m, S) {
  const T = OLD_TOWER, P = TOWER_TOP, ring = (x, y) => x === T.x0 || x === T.x1 || y === T.y0 || y === T.y1;
  for (let z = S + 3; z <= S + 5; z++) for (let y = T.y0; y <= T.y1; y++) for (let x = T.x0; x <= T.x1; x++) {
    const roof = z === S + 5, gap = roof && P.gaps.some(([gx, gy]) => gx === x && gy === y);
    m.set(x, y, z, { ground: roof ? 'cobble' : 'wood', items: ring(x, y) && !gap ? ['wall_stone'] : [] });
  }
  const [rx, ry, look] = P.rope;
  m.addItem(rx, ry, S + 2, 'rope_spot'); m.setMeta(rx, ry, S + 2, { look });
  m.addItem(rx, ry, S + 3, 'hole'); m.setMeta(rx, ry, S + 3, { look: 'The gap where the stair fell. Far below, the broken top of the tower.' });
  const [wy, [gx, level, gateLook]] = P.split;
  for (let x = T.x0 + 1; x < T.x1; x++) m.addItem(x, wy, S + 3, x === gx ? 'tower_grille' : 'wall_stone');
  m.setMeta(gx, wy, S + 3, { level, look: gateLook });
  for (const [x, y, z] of P.stairs) { m.addItem(x, y, z, 'stairs_up'); m.addItem(x, y, z + 1, 'stairs_down'); }
  for (const [x, y, z, id] of P.props) m.addItem(x, y, z, id);
  for (const [type, x, y, z] of P.monsters) m.spawns.push({ type, x, y, z, lurk: true });
}

// Builds the ruined watchtower on the Old Tower hill (see OLD_TOWER): the tower on the hilltop (floor 9), its broken
// top (floor 10), and the cellar cut into the hill under it (floor 8).
function buildOldTower(m, S) {
  const T = OLD_TOWER, top = S + 1, up = S + 2;
  const ring = (x, y) => x === T.x0 || x === T.x1 || y === T.y0 || y === T.y1;
  // the hilltop round it cleared to rocky ground, and the tower's floor
  for (let y = T.y0 - 1; y <= T.y1 + 1; y++) for (let x = T.x0 - 1; x <= T.x1 + 1; x++) {
    const t = m.get(x, y, top);
    if (!t || !m.get(x, y, S) || !m.get(x, y, S).items.includes('cliff')) continue;
    t.items = [];
    t.ground = x < T.x0 || x > T.x1 || y < T.y0 || y > T.y1 ? 'mountain' : 'cobble';
  }
  for (let y = T.y0; y <= T.y1; y++) for (let x = T.x0; x <= T.x1; x++) {
    if (ring(x, y)) m.addItem(x, y, top, 'wall_stone');
    // the top: open to the sky, its battlements broken here and there
    m.set(x, y, up, { ground: 'cobble', items: ring(x, y) && !T.gaps.some(([gx, gy]) => gx === x && gy === y) ? ['wall_stone'] : [] });
  }
  const [bx, by, look] = T.breach;
  m.set(bx, by, top, { ground: 'cobble', items: ['rope_spot'] });
  m.setMeta(bx, by, top, { look });
  m.set(bx, by, up, { ground: 'cobble', items: ['hole'] });
  for (const [x, y] of T.rubble) { m.addItem(x, y, top, 'rock'); m.setMeta(x, y, top, { look: 'Fallen stone from the floor above, piled high. There is no way through.' }); }
  m.addItem(...T.stairs, up, 'stairs_down');
  m.addItem(...T.stairs, top, 'stairs_up');
  for (const [x, y] of [[T.x0 + 1, T.y1 - 1], [T.x1 - 1, T.y1 - 2]]) m.addItem(x, y, up, 'rubble');
  for (const [x, y, order, text] of T.levers) { m.addItem(x, y, top, 'lever'); m.setMeta(x, y, top, { puzzle: 'old_tower', order, target: { x: T.trapdoor[0], y: T.trapdoor[1], z: top }, look: text }); }
  m.get(...T.trapdoor, top).items = ['trapdoor', 'cellar_bars'];
  m.setMeta(...T.trapdoor, top, { look: 'A trapdoor down into the cellar, under a rusted iron grate. Chains run from the grate up to the levers.' });
  // the cellar, cut into the hill's rock
  const C = T.cellar, carved = [];
  for (const [x0, y0, x1, y1] of C.rooms) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { m.set(x, y, S, { ground: 'crypt', items: [] }); carved.push([x, y]); }
  for (const [x, y] of carved) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const t = m.get(x + ox, y + oy, S);
    if (!t || t.items.includes('cliff')) m.set(x + ox, y + oy, S, { ground: 'crypt', items: ['wall_crypt'] });
  }
  m.get(...T.trapdoor, S).items = ['cave_ladder'];
  for (const [x, y] of C.torches) m.addItem(x, y, S, 'wall_torch');
  for (const [x, y, id] of C.props) m.addItem(x, y, S, id);
  m.spawns.push({ type: 'watchman_shade', x: C.shade[0], y: C.shade[1], z: S, lurk: true });
  for (const [x, y] of T.skeletons) m.spawns.push({ type: 'skeleton', x, y, z: up });
}

// Builds the goblins' tunnels under Goblin Hill (see GOBLIN_WARREN): the burrow down from the hill, the caves and
// tunnels with rock round them, the boulders, the hoard and the goblins.
function buildGoblinWarren(m, S) {
  const G = GOBLIN_WARREN, Z = G.z, hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 / 1000;
  const carved = [];
  const carve = (x, y) => { if (!m.get(x, y, Z) || m.get(x, y, Z).items.includes('wall_cave')) { m.set(x, y, Z, { ground: 'cave', items: [] }); carved.push([x, y]); } };
  for (const [cx, cy, rx, ry] of G.caves) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 0.75 + hash(x + 3, y + 7) * 0.4) carve(x, y);
    }
  }
  for (const [x0, y0, x1, y1] of G.tunnels) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) carve(x, y);
  for (const [x, y] of carved) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    if (!m.get(x + ox, y + oy, Z)) m.set(x + ox, y + oy, Z, { ground: 'cave', items: ['wall_cave'] });
  }
  const [hx, hy, look] = G.hole;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { // a patch of dug-up earth round the burrow
    const t = m.get(hx + dx, hy + dy, S);
    if (!t || THINGS[t.ground].block) continue;
    t.ground = 'dirt';
    t.items = t.items.filter(id => !THINGS[id].block);
  }
  m.get(hx, hy, S).items = ['hole'];
  m.setMeta(hx, hy, S, { look });
  m.get(hx, hy, Z).items = ['cave_ladder'];
  for (const [x, y] of G.boulders) m.addItem(x, y, Z, 'boulder');
  for (const [x, y, id] of G.props) m.addItem(x, y, Z, id);
  for (const [type, x, y] of G.monsters) m.spawns.push({ type, x, y, z: Z, lurk: true });
}

// Builds the Deep Diggings under Goblin Hill (see GOBLIN_DEEP), after the warren above them: each floor's caves and
// tunnels with rock round them, then the ways between the floors, the gate, the chests and the dead.
// Carves a deep vault's floors (GOBLIN_DEEP, SEA_CAVES): each floor's caves and tunnels, with rock round them, and its
// pools of water. floors: { z: { caves [cx, cy, rx, ry], tunnels [x0, y0, x1, y1], pools [cx, cy, rx, ry] } }
function carveVault(m, floors) {
  const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 / 1000;
  for (const [zs, F] of Object.entries(floors)) {
    const Z = +zs, carved = [];
    const carve = (x, y) => { const t = m.get(x, y, Z); if (!t || t.items.includes('wall_cave')) { m.set(x, y, Z, { ground: 'cave', items: [] }); carved.push([x, y]); } };
    for (const [cx, cy, rx, ry] of F.caves || []) {
      for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 0.75 + hash(x + Z, y + 11) * 0.4) carve(x, y);
      }
    }
    for (const [x0, y0, x1, y1] of F.tunnels || []) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) carve(x, y);
    for (const [x, y] of carved) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!m.get(x + ox, y + oy, Z)) m.set(x + ox, y + oy, Z, { ground: 'cave', items: ['wall_cave'] });
    }
    for (const [cx, cy, rx, ry] of F.pools || []) for (const [x, y] of carved) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1) m.setGround(x, y, Z, 'water');
    }
  }
}

function buildGoblinDeep(m) {
  const D = GOBLIN_DEEP;
  carveVault(m, D.floors);
  const at = (x, y, z, id, look) => { m.get(x, y, z).items = [id]; if (look) m.setMeta(x, y, z, { look }); };
  const [dx, dy, digLook] = D.dig, [px, py, pitLook] = D.pit, [rx, ry, ropeLook] = D.rope, [gx, gy, level, gateLook] = D.gate, [hx, hy, downLook] = D.down;
  at(dx, dy, 7, 'loose_sand', digLook);
  at(dx, dy, 6, 'rope_spot', 'Daylight? No: torchlight, far above, through loose earth. With a rope you could climb back up.');
  at(px, py, 6, 'hole', pitLook);
  at(rx, ry, 5, 'rope_spot', ropeLook);
  at(gx, gy, 5, 'goblin_gate'); m.setMeta(gx, gy, 5, { level, look: gateLook });
  at(hx, hy, 5, 'hole', downLook);
  at(hx, hy, 4, 'cave_ladder');
  for (const [x, y, z] of D.exit) at(x, y, z, 'cave_ladder');
  const [ox, oy, outLook] = D.outLook;
  m.addItem(ox, oy, m.surfaceZ, 'rubble'); m.setMeta(ox, oy, m.surfaceZ, { look: outLook });
  for (const [zs, F] of Object.entries(D.floors)) {
    const Z = +zs;
    for (const [x, y] of F.boulders || []) m.addItem(x, y, Z, 'boulder');
    for (const [x, y, id] of F.props || []) m.addItem(x, y, Z, id);
    for (const [type, x, y] of F.monsters || []) m.spawns.push({ type, x, y, z: Z, lurk: true });
  }
}

// Builds the tunnels under the town well (see WELL_TUNNELS): the well you can rope down, the pool at the bottom with
// its rope spot back up, the caves and tunnels with rock round them, the cracked rock, Old Wim and the rats.
function buildWellTunnels(m, S) {
  const L = WELL_TUNNELS, Z = L.z, hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 / 1000;
  const carved = [];
  const carve = (x, y) => { if (!m.get(x, y, Z)) { m.set(x, y, Z, { ground: 'cave', items: [] }); carved.push([x, y]); } };
  for (const [cx, cy, rx, ry] of L.caves) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 0.75 + hash(x + 5, y + 2) * 0.4) carve(x, y);
    }
  }
  for (const [x0, y0, x1, y1] of L.tunnels) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) carve(x, y);
  for (const [x, y] of carved) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    if (!m.get(x + ox, y + oy, Z)) m.set(x + ox, y + oy, Z, { ground: 'cave', items: ['wall_cave'] });
  }
  for (const [x, y] of L.pool) if (carved.some(([cx, cy]) => cx === x && cy === y)) m.setGround(x, y, Z, 'sewer_water');
  const [wx, wy, look] = L.well;
  m.setMeta(wx, wy, S, { look, ropeDown: true });
  m.get(wx, wy, Z).items = ['rope_spot'];
  m.setMeta(wx, wy, Z, { look: 'The bottom of the well. Daylight falls from far above. With a rope you can climb back up.' });
  m.get(...L.crack, Z).items = ['cracked_rock'];
  m.setMeta(...L.crack, Z, { look: 'Cracked rock, newer than the tunnel round it: a fall of stone. Cold air whistles through the cracks. A pick would break it.' });
  for (const [x, y, id] of L.props) m.addItem(x, y, Z, id);
  for (const [type, x, y] of L.monsters) if (m.isWalkable(x, y, Z)) m.spawns.push({ type, x, y, z: Z, lurk: true });
}

// Builds Oakvale (see OAKVALE): the river through it, walls and fences, streets, the square, buildings
// with their insides, roofs and signs, and the gardens, yards and things between them.
// runs: the road painter from createDefaultMap; river: the river that runs through town.
function buildTown(m, S, runs, river) {
  const SURFACE = S;
  const T = OAKVALE, put = (x, y, z, id) => m.addItem(x, y, z, id);
  const free = (x, y, z = S) => { const t = m.get(x, y, z); return !!t && !t.items.length && !THINGS[t.ground].block; };
  const sign = (x, y, z, id, text) => { put(x, y, z, id); m.setMeta(x, y, z, { text }); };
  const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 / 1000;
  const bd = T.bounds, inTown = (x, y) => x >= bd.x0 && x <= bd.x1 && y >= bd.y0 && y <= bd.y1;
  // Monsters don't come into the town (its streets and everything above them); the sewers below are theirs.
  for (let z = S; z < m.depth; z++) m.zones.push({ ...bd, z, town: true });
  // A smooth noise from the hash (0..1), for natural edges.
  const smooth = (x, y, scale, seed) => {
    const fx = x / scale, fy = y / scale, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const h = (a, b) => hash(a * 31 + seed * 977, b * 17 + seed * 131);
    const top = h(x0, y0) + (h(x0 + 1, y0) - h(x0, y0)) * tx, bottom = h(x0, y0 + 1) + (h(x0 + 1, y0 + 1) - h(x0, y0 + 1)) * tx;
    return top + (bottom - top) * ty;
  };

  // The ground: grass, cleared of the wilds, with the river through it in a tidy bed.
  const bed = new Set();
  runs(river.line, river.width, (x, y) => bed.add(`${x},${y}`));
  const inMoat = (x, y) => { // (how far out from the wall's foot, round at the corners; the far bank's distance wanders)
    const R = T.ramparts, dx = Math.max(R.x0 - x, 0, x - R.x1), dy = Math.max(R.y0 - y, 0, y - R.y1), d = Math.hypot(dx, dy);
    const w = T.moat.min + (T.moat.max - T.moat.min) * Math.min(1, Math.max(0, smooth(x, y, 11, 61) * 1.3 - 0.15));
    return d > 0 && d <= w;
  };
  for (let y = bd.y0; y <= bd.y1; y++) for (let x = bd.x0; x <= bd.x1; x++) {
    const inside = x > T.ramparts.x0 && x < T.ramparts.x1 && y > T.ramparts.y0 && y < T.ramparts.y1; // (inside the wall the river goes round, in the moat)
    m.set(x, y, S, { ground: (bed.has(`${x},${y}`) && !inside) || inMoat(x, y) ? 'water' : 'grass', items: [] });
    for (let z = S + 1; z < m.depth; z++) m.set(x, y, z, null);
  }
  const water = (x, y) => (m.get(x, y, S) || {}).ground === 'water';
  // The canal (T.canal): two tiles wide along its line, its banks bulging out a tile here and there (smooth noise), so
  // it doesn't run like a ruler; the weirs, lilies and reeds on it
  if (T.canal) {
    const C = T.canal, wet = new Set();
    for (let i = 0; i + 1 < C.line.length; i++) {
      const [ax, ay] = C.line[i], [bx, by] = C.line[i + 1], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let k = 0; k <= n; k++) {
        const x = Math.round(ax + (bx - ax) * k / n), y = Math.round(ay + (by - ay) * k / n);
        for (let c = 0; c < C.width; c++) wet.add(`${x + c},${y}`);
        const bulge = smooth(x, y, 4, 41); // (a tile more on one side, now and then)
        if (bulge > 0.74) wet.add(`${x - 1},${y}`); else if (bulge < 0.2) wet.add(`${x + C.width},${y}`);
      }
    }
    for (const k of wet) { const [x, y] = k.split(',').map(Number); if (inTown(x, y)) m.set(x, y, S, { ground: 'water', items: [] }); }
    for (const [x, y] of C.lilies) if (water(x, y)) put(x, y, S, 'lilypad');
    T.canalWeirs = C.weir; T.canalReeds = C.reeds;
  }

  // Fences.
  for (const [x0, y0, x1, y1] of T.fence || []) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!water(x, y) && !m.get(x, y, S).items.length) put(x, y, S, 'fence');
  }

  // The town wall (T.ramparts): a ring of solid masonry with a walkway on top (the floor above), battlements along
  // its outer edge. Where a street goes through it, or water, the walkway goes on over it on a lintel, so you can walk
  // all the way round. Flights of steps go up its inner face; on each corner a tower, a room on the walkway's floor
  // (doorways where the walkway comes in) with stairs up to a lookout with a flag.
  {
    const R = T.ramparts, k = R.thick;
    const inRing = (x, y) => x >= R.x0 && x <= R.x1 && y >= R.y0 && y <= R.y1 && !(x >= R.x0 + k && x <= R.x1 - k && y >= R.y0 + k && y <= R.y1 - k);
    const gate = (x, y) => R.gates.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
    // (each tower takes the ring's corner and two tiles more inwards: its door into town opens there)
    const towers = [[R.x0, R.y0, 1, 1], [R.x1, R.y0, -1, 1], [R.x0, R.y1, 1, -1], [R.x1, R.y1, -1, -1]]
      .map(([x, y, dx, dy]) => [Math.min(x, x + 4 * dx), Math.min(y, y + 4 * dy), Math.max(x, x + 4 * dx), Math.max(y, y + 4 * dy)]);
    const inTower = (x, y) => towers.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
    const parapet = (x, y, z, [x0, y0, x1, y1]) => {
      if (y === y0) put(x, y, z, 'battlement_n');
      if (x === x1) put(x, y, z, 'battlement_e');
      if (y === y1) put(x, y, z, 'battlement_s');
      if (x === x0) put(x, y, z, 'battlement_w');
    };
    for (let y = R.y0; y <= R.y1; y++) for (let x = R.x0; x <= R.x1; x++) {
      if (!inRing(x, y) || inTower(x, y)) continue;
      if (!water(x, y) && !gate(x, y)) m.set(x, y, S, { ground: 'paving', items: ['rampart'] });
      m.set(x, y, S + 1, { ground: 'temple_paving', items: [] });
      parapet(x, y, S + 1, [R.x0, R.y0, R.x1, R.y1]);
    }
    // the lintels over the gates and the water, on the faces you see
    for (let y = R.y0; y <= R.y1; y++) for (let x = R.x0; x <= R.x1; x++) {
      if (!inRing(x, y) || inTower(x, y) || m.get(x, y, S).items.includes('rampart')) continue;
      // a passage three tiles wide (a gate, the river) gets a great arch, in three parts; others a lintel
      const open = (ax, ay) => inRing(ax, ay) && !inTower(ax, ay) && !m.get(ax, ay, S).items.includes('rampart');
      const part = (dx, dy) => { let i = 0; while (open(x - dx * (i + 1), y - dy * (i + 1))) i++; let n = i + 1; while (open(x + dx * (n - i), y + dy * (n - i))) n++; return n === 3 ? i : -1; };
      put(x, y, S, 'vault_shadow'); // the shade under the walkway
      if (!inRing(x, y + 1)) { const i = part(1, 0); put(x, y, S, i < 0 ? 'arch_span_s' : `arch_gate_s${i}`); if (i >= 0 && gate(x, y)) put(x, y, S, `portcullis_s${i}`); }
      if (!inRing(x + 1, y)) { const i = part(0, 1); put(x, y, S, i < 0 ? 'arch_span_e' : `arch_gate_e${i}`); if (i >= 0 && gate(x, y)) put(x, y, S, `portcullis_e${i}`); }
    }
    // cannons along the battlements, every eleven tiles, pointing out, a pile of balls beside each and every other one a
    // keg of powder on its other side (only where the wall is solid below, not over a gate or the water)
    const CANNON_LOOK = 'An old bronze cannon on an oak carriage, pointing out over the battlements. Cold now: Oakvale has not had to fire it in a long time.';
    let cannons = 0;
    for (let y = R.y0; y <= R.y1; y++) for (let x = R.x0; x <= R.x1; x++) {
      if (!inRing(x, y) || inTower(x, y)) continue;
      const out = y === R.y0 ? 'n' : y === R.y1 ? 's' : x === R.x0 ? 'w' : x === R.x1 ? 'e' : null;
      if (!out) continue;
      const [ax, ay] = out === 'n' || out === 's' ? [1, 0] : [0, 1], along = ax ? x : y;
      const solid = (dx, dy) => (m.get(x + dx, y + dy, S) || { items: [] }).items.includes('rampart');
      if (along % 11 !== 6 || !solid(0, 0) || !solid(ax, ay) || !solid(-ax, -ay)) continue;
      put(x, y, S + 1, `cannon_${out}`); m.setMeta(x, y, S + 1, { look: CANNON_LOOK });
      put(x + ax, y + ay, S + 1, 'cannonballs');
      if (cannons++ % 2) put(x - ax, y - ay, S + 1, 'barrel');
    }
    // banners down the faces of the wall you see from outside (south and east), between the cannons
    for (let x = R.x0; x <= R.x1; x++) { const t = m.get(x, R.y1, S); if (x % 11 === 0 && !inTower(x, R.y1) && t.items.includes('rampart')) put(x, R.y1, S, 'wall_banner_s'); }
    for (let y = R.y0; y <= R.y1; y++) { const t = m.get(R.x1, y, S); if (y % 11 === 0 && !inTower(R.x1, y) && t.items.includes('rampart')) put(R.x1, y, S, 'wall_banner_e'); }
    for (const [x, y] of R.stairs) for (let dx = -1; dx <= 1; dx++) { // a flight of stone steps up the inner face, three wide,
      m.set(x + dx, y, S, { ground: 'paving', items: ['steps'] });   // as the temple mount's: their top is the walkway
      m.setGround(x + dx, y, S + 1, 'steps_top');
    }
    // a gatehouse over each gate: a room on the walkway, a tile wider than the gate on both sides, under a slate roof, so
    // you see from anywhere in town where the gate is; the walkway goes through it, a banner hangs on its town side
    for (const [gx0, gy0, gx1, gy1] of R.gates) {
      const across = gy0 === R.y0 || gy1 === R.y1, box = across ? [gx0 - 1, gy0, gx1 + 1, gy1] : [gx0, gy0 - 1, gx1, gy1 + 1];
      const [x0, y0, x1, y1] = box, mx = (x0 + x1) >> 1, my = (y0 + y1) >> 1;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const edge = x === x0 || x === x1 || y === y0 || y === y1, through = across ? y === my : x === mx; // (where the walkway comes in)
        m.set(x, y, S + 1, { ground: 'temple_paving', items: edge && !(through && (across ? x === x0 || x === x1 : y === y0 || y === y1)) ? ['wall_rampart'] : [] });
        if (x > x0 && y > y0) m.set(x, y, S + 2, { ground: 'roof', items: [] }); // (its north and west rows left out, as a building's)
      }
      const [bx, by] = across ? [mx, gy0 === R.y0 ? y1 : y0] : [gx0 === R.x0 ? x1 : x0, my]; // the side towards town
      put(bx, by, S + 1, 'banner');
    }
    const town = (x, y) => x >= R.x0 + k && x <= R.x1 - k && y >= R.y0 + k && y <= R.y1 - k && !inTower(x, y);
    towers.forEach((box, n) => {
      const [x0, y0, x1, y1] = box, west = x0 === R.x0, north = y0 === R.y0;
      // inside the 3x3 room: the corner towards the outside (stairs between the room and the walkway) and the one towards
      // town (stairs between the walkway and the lookout)
      const [ox, oy] = [west ? x0 + 1 : x1 - 1, north ? y0 + 1 : y1 - 1], [ix, iy] = [west ? x1 - 1 : x0 + 1, north ? y1 - 1 : y0 + 1];
      // its doors on the ground: one into town (on the first side that opens on to it: south, east, north, west), one out
      const sides = [[0, 1], [1, 0], [0, -1], [-1, 0]], along = [];
      for (const [dx, dy] of sides) for (let i = 1; i <= 3; i++) along.push([dx ? (dx > 0 ? x1 : x0) : x0 + i, dy ? (dy > 0 ? y1 : y0) : y0 + i, dx, dy]);
      const [inX, inY] = along.find(([x, y, dx, dy]) => town(x + dx, y + dy));
      const side = R.exits[n], [outX, outY, odx, ody] = !side ? [-1, -1, 0, 0] : side === 'n' ? [x0 + 2, y0, 0, -1] : side === 's' ? [x0 + 2, y1, 0, 1] : side === 'w' ? [x0, y0 + 2, -1, 0] : [x1, y0 + 2, 1, 0];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const edge = x === x0 || x === x1 || y === y0 || y === y1;
        const door = (x === inX && y === inY) || (x === outX && y === outY);
        // a doorway on the walkway's floor where the walkway comes in, in the middle of its width
        const gap = edge && sides.some(([dx, dy]) => {
          const nx = x + dx, ny = y + dy;
          return !inTower(nx, ny) && inRing(nx, ny) && (dx ? inRing(nx, ny - 1) && inRing(nx, ny + 1) : inRing(nx - 1, ny) && inRing(nx + 1, ny));
        });
        m.set(x, y, S, { ground: 'paving', items: edge ? [door ? 'door' : 'wall_rampart'] : [] });
        m.set(x, y, S + 1, { ground: 'temple_paving', items: edge && !gap ? ['wall_rampart'] : [] });
        m.set(x, y, S + 2, { ground: 'temple_paving', items: [] });
        parapet(x, y, S + 2, box);
      }
      put(ox, oy, S, 'stairs_up'); put(ox, oy, S + 1, 'stairs_down');
      put(ix, iy, S + 1, 'stairs_up'); put(ix, iy, S + 2, 'stairs_down');
      put(x0 + 2, y0 + 2, S + 2, 'tower_flag');
      // two cannons on the lookout, beside the flag, pointing out over the two outer sides
      for (const [cx, cy, dir] of [[x0 + 2, north ? y0 + 1 : y1 - 1, north ? 'n' : 's'], [west ? x0 + 1 : x1 - 1, y0 + 2, west ? 'w' : 'e']]) {
        put(cx, cy, S + 2, `cannon_${dir}`); m.setMeta(cx, cy, S + 2, { look: CANNON_LOOK });
      }
      // a footbridge over the moat from the door out
      if (side) for (let x = outX + odx, y = outY + ody; water(x, y); x += odx, y += ody) m.setGround(x, y, S, odx ? 'bridge_ew' : 'bridge_ns');
    });
  }

  // Streets (bridges over the river) and the square.
  for (const st of T.streets) runs(st.line, st.width, (x, y, alongX) => {
    if (!inTown(x, y)) return;
    m.setGround(x, y, S, water(x, y) ? (alongX ? 'bridge_ew' : 'bridge_ns') : st.ground);
  });
  for (const [x0, y0, x1, y1] of T.square) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.setGround(x, y, S, 'cobble');
  for (const [x, y] of T.canalWeirs || []) for (let dx = -1; dx <= 2; dx++) if (water(x + dx, y)) m.get(x + dx, y, S).items = ['weir'];

  const inPoly = (p, x, y) => { let hit = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit; } return hit; };
  // The temple mount: rock walls on the surface, and on top (one floor up) grass, with the odd crag on its edge. Its foot follows the outline, roughened by a tile or so (a fixed smooth noise, without lone tiles sticking
  // out or bites taken in); what it must carry is always on it, and in front of the steps its face runs straight.
  {
    const t = T.mount, inR = (r, x, y) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
    const kept = (x, y) => t.keep.some(r => inR(r, x, y));
    const flat = (x, y) => (y > t.y1 && x >= t.steps[0] - 4 && x <= t.steps[2] + 4) || t.clear.some(r => inR(r, x, y));
    let on = new Set();
    for (let y = t.y0; y <= t.y1; y++) for (let x = t.x0; x <= t.x1; x++) {
      const rough = inPoly(t.outline, x + 0.5 + (smooth(x, y, 3, 11) - 0.5) * 2.4, y + 0.5 + (smooth(x, y, 3, 12) - 0.5) * 2.4);
      if ((rough || kept(x, y)) && !flat(x, y)) on.add(`${x},${y}`);
    }
    const n4 = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => on.has(`${x + dx},${y + dy}`)).length;
    for (let pass = 0; pass < 3; pass++) { // smooth it: no tile hanging on by one side, no notch with rock on three
      const next = new Set();
      for (let y = t.y0; y <= t.y1; y++) for (let x = t.x0; x <= t.x1; x++) {
        const k = `${x},${y}`, n = n4(x, y);
        if (kept(x, y) || (!flat(x, y) && (on.has(k) ? n >= 2 : n >= 3))) next.add(k);
      }
      on = next;
    }
    for (const k of on) {
      const [x, y] = k.split(',').map(Number); // (no crags on its edge: the rim of stones round it is enough)
      m.set(x, y, S, { ground: 'mountain', items: ['cliff'] });
      m.set(x, y, S + 1, { ground: 'grass', items: [] });
    }
    for (const x of t.steps) { m.get(x, t.y1, S).items = ['steps']; m.setGround(x, t.y1, S + 1, 'steps_top'); }
  }

  // The hills: rock walls with a rugged top you can't walk on; a second tier stands back two tiles,
  // with crags on it.
  for (const hill of T.hills) {
    const tiles = new Set();
    // The outline, roughened by a tile or so (a fixed smooth noise), without lone tiles sticking out.
    const raw = new Set();
    for (let y = bd.y0; y <= bd.y1; y++) for (let x = bd.x0; x <= bd.x1; x++) {
      if (inPoly(hill.outline, x + 0.5 + (smooth(x, y, 3, 1) - 0.5) * 3, y + 0.5 + (smooth(x, y, 3, 2) - 0.5) * 3) && !water(x, y)) raw.add(`${x},${y}`);
    }
    const n4 = (set, x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => set.has(`${x + dx},${y + dy}`)).length;
    for (const k of raw) { const [x, y] = k.split(',').map(Number); if (n4(raw, x, y) >= 3) tiles.add(k); }
    const deep = (x, y, d) => { for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) if (!tiles.has(`${x + dx},${y + dy}`)) return false; return true; };
    for (const k of tiles) {
      const [x, y] = k.split(',').map(Number);
      m.set(x, y, S, { ground: 'mountain', items: ['cliff'] });
      const high = hill.tiers > 1 && deep(x, y, 2) && smooth(x, y, 4, 3) > 0.32;
      m.set(x, y, S + 1, high ? { ground: 'mountain', items: ['cliff'] } : { ground: 'rock_top', items: [] });
      if (high) m.set(x, y, S + 2, { ground: 'rock_top', items: [] });
    }
  }
  // A building: its main block and any wings (it's the shape they make together). Floor, walls (with
  // a door and windows), and a roof on the floor above. Upper floors get their own walls and
  // windows, and the roof goes on top of them.
  const partsOf = b => [[b.x0, b.y0, b.x1, b.y1], ...(b.wings || [])];
  const inB = (b, x, y) => partsOf(b).some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
  const isWall = (b, x, y) => inB(b, x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dy]) => !inB(b, x + dx, y + dy));
  const eachOf = (b, fn) => { for (const [x0, y0, x1, y1] of partsOf(b)) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) fn(x, y); };
  const building = b => {
    const floors = b.floors || 1, S = SURFACE + (b.level || 0); // the floor it stands on
    for (let k = 0; k < floors; k++) {
      const z = S + k;
      eachOf(b, (x, y) => m.set(x, y, z, { ground: k ? 'wood' : b.floor, items: [] }));
      const seen = new Set();
      eachOf(b, (x, y) => {
        if (seen.has(`${x},${y}`) || !isWall(b, x, y)) return;
        seen.add(`${x},${y}`);
        put(x, y, z, b.wall);
        // windows on straight stretches of wall, every third tile, not next to the door
        const straight = (isWall(b, x - 1, y) && isWall(b, x + 1, y)) || (isWall(b, x, y - 1) && isWall(b, x, y + 1));
        const along = isWall(b, x - 1, y) && isWall(b, x + 1, y) ? x : y;
        if (straight && along % 3 === 0 && Math.abs(x - b.door[0]) + Math.abs(y - b.door[1]) > 1) { if (b.wall !== 'wall_temple') put(x, y, z, 'window'); } // (the temple's walls stay bare)
      });
    }
    const [dx, dy] = b.door;
    m.ensure(dx, dy, S).items = [b.kind === 'house' ? 'door_house' : 'door'];
    if (b.arch) for (const [k, id] of [[-1, 'arch_w'], [0, 'arch_m'], [1, 'arch_e']]) m.ensure(dx + k, dy, S).items = [id]; // in a south wall
    // (the roof leaves out the building's north and west rows: drawn a floor up, it shifts up and left, and with its
    // eaves overhanging, the rest sits right over the walls)
    if (b.roof) eachOf(b, (x, y) => { if (inB(b, x, y - 1) && inB(b, x - 1, y)) m.set(x, y, S + floors, { ground: b.roof, items: [] }); });
    if (b.roof && b.kind !== 'temple' && b.kind !== 'depot') put(b.x1 - 1, b.y0 + 1, S + floors, 'chimney');
    const out = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([ox, oy]) => [dx + ox, dy + oy]).find(([x, y]) => !inB(b, x, y));
    // A sign on the wall beside the door, and a step of gravel in front of it.
    if (b.sign) {
      const across = out[0] === dx, wide = b.arch ? 2 : 1, sx = across ? dx + wide : dx, sy = across ? dy : dy + 1;
      const t = m.get(sx, sy, S);
      t.items = t.items.filter(id => !id.startsWith('window'));
      sign(sx, sy, S, b.signId || 'sign_wall', b.sign);
      // ...and a lantern on the other side of the door
      const lx = across ? dx - wide : dx, ly = across ? dy : dy - 1, lt = m.get(lx, ly, S);
      if (lt && isWall(b, lx, ly)) { lt.items = lt.items.filter(id => !id.startsWith('window')); put(lx, ly, S, 'lantern'); }
    }
    if (m.get(...out, S).ground === 'grass') m.setGround(...out, S, 'gravel');
    if (b.kind !== 'temple' && b.kind !== 'depot' && b.kind !== 'tower') for (let z = S; z < S + floors; z++) for (const [x0, y0, x1, y1] of partsOf(b)) m.zones.push({ x0, y0, x1, y1, z, shelter: true });
  };
  for (const b of T.buildings) building(b);

  // ---- the bell tower, east of the temple mount: the highest tower in town -----------------------------------
  // It stands on the east end of the temple mount. The ringers' room at the bottom, three floors of stairs above it,
  // and at the top (floor 13) the bell, open to
  // the sky between pillars under copper eaves. Its rope runs down a shaft of open hatches, one column through
  // every floor (see T.belltower.shaft): from a wheel beside the bell, whole down the stairwell, cut off in the
  // ringers' room - the rest fell down into the sewers and on to the bottom (see SEWERS, DEEP_SEWERS).
  {
    const bt = T.buildings.find(b => b.id === 'belltower'), BT = T.belltower, base = S + (bt.level || 0), top = base + bt.floors, [hx, hy] = BT.shaft;
    BT.stairs.forEach(([x, y], k) => { put(x, y, base + k, 'stairs_up'); put(x, y, base + k + 1, 'stairs_down'); });
    for (let y = bt.y0; y <= bt.y1; y++) for (let x = bt.x0; x <= bt.x1; x++) {
      const edge = x === bt.x0 || x === bt.x1 || y === bt.y0 || y === bt.y1, corner = (x === bt.x0 || x === bt.x1) && (y === bt.y0 || y === bt.y1);
      const pillar = corner && y === bt.y1; // on the two front corners: the sides stay open to walk round the bell
      const t = m.ensure(x, y, top);
      t.ground = 'paving';
      t.items = t.items.filter(id => THINGS[id].change);
      if (pillar) t.items.push('pillar');
      if (edge) m.set(x, y, top + 1, { ground: 'roof_marble', items: [] }); // the eaves, open over the bell
    }
    const [sx, sy] = BT.stairs[BT.stairs.length - 1];
    m.get(sx, sy, top).items = ['stairs_down'];
    const ropes = [[top, 'shaft_rope_top', 'The bell rope runs from a wheel beside the bell down through an open hatch in the floor.']];
    for (let z = top - 1; z > base; z--) ropes.push([z, 'shaft_rope', 'The bell rope runs down the tower through an open hatch in every floor.']);
    ropes.push([base, 'shaft_rope_cut', 'The bell rope comes down through the ceiling and ends here, over an open hatch, cut clean through. The rest of it fell down the shaft, into the dark below.',
      'The new bell rope comes down through the ceiling and ends here, over an open hatch, cut clean through again. The rest of it fell down the shaft, like the old one.']); // (lookAgain: see bellAgain)
    for (const [z, id, look, lookAgain] of ropes) { m.set(hx, hy, z, { ground: null, items: [id] }); m.setMeta(hx, hy, z, lookAgain ? { look, lookAgain } : { look }); } // an open hatch: no floor
    for (let z = S; z < base; z++) m.set(hx, hy, z, { ground: 'pit', items: [] }); // the shaft on down through the rock of the mount
    const [bx, by] = BT.bell;
    for (const [id, ox, oy] of [['bell_nw', 0, 0], ['bell_ne', 1, 0], ['bell_sw', 0, 1], ['bell_se', 1, 1]]) { put(bx + ox, by + oy, top, id); m.setMeta(bx + ox, by + oy, top, { look: BT.look }); }
    const [rx, ry, rules] = BT.rules;
    m.get(rx, ry, base).items.push('sign_wall'); m.setMeta(rx, ry, base, { text: rules, plaque: true }); // (and the plaque of who rang it home)
  }
  // Shelves or racks along the inside of the north wall; flower boxes under the windows of homes and the inn.
  for (const b of T.buildings) {
    if (b.shelves) for (let x = b.x0 + 1; x < b.x1; x++) { const t = m.get(x, b.y0, S); if (t.items.length === 1 && x % 2) put(x, b.y0, S, b.shelves); }
    if (b.kind === 'house' || b.kind === 'inn') eachOf(b, (x, y) => { const t = m.get(x, y, S); if (t.items.includes('window') && (y === b.y1 || x === b.x1)) put(x, y, S, 'window_box'); });
  }
  const B = Object.fromEntries(T.buildings.map(b => [b.id, b]));
  // A bed two tiles long, its head at (x, y) and its foot on the tile south of it.
  const longBed = (x, y, z) => { put(x, y, z, 'bed_head'); put(x, y + 1, z, 'bed_foot'); };
  const inside = (b, x, y, id, z = S) => { if (free(x, y, z) && !(x === b.door[0] && Math.abs(y - b.door[1]) <= 1) && !(y === b.door[1] && Math.abs(x - b.door[0]) <= 1)) put(x, y, z, id); };

  // ---- the temple on the mount: a hall with the altar on a rug, statues, benches, torches -------------------
  {
    const t = B.temple, cx = (t.x0 + t.x1) >> 1, Z = S + 1;
    for (let y = t.y0 + 1; y <= t.y0 + 3; y++) for (let x = cx - 1; x <= cx + 1; x++) put(x, y, Z, 'carpet_rug'); // a rug under the altar
    put(cx, t.y0 + 1, Z, 'altar');
    for (const x of [cx - 2, cx + 2]) put(x, t.y0 + 1, Z, 'torch');
    for (const x of [t.x0 + 1, t.x1 - 1]) { put(x, t.y0 + 1, Z, 'saint'); put(x, t.y1 - 1, Z, 'plant'); }
    for (const x of [cx - 3, cx - 2, cx + 2, cx + 3]) put(x, t.y0 + 3, Z, 'pew');
    for (const y of [t.y0 + 2]) { put(t.x0, y, Z, 'wall_torch'); put(t.x1, y, Z, 'wall_torch'); }
    m.temples.push({ home: 'oakvale', town: 'Oakvale', npc: null, x: T.start.x, y: T.start.y, z: Z });
    // the terrace in front: paving, pillars, lamps and flowers, with the steps down to the square
    const mt = T.mount;
    for (let y = t.y1 + 1; y < mt.y1; y++) for (let x = t.x0; x <= t.x1; x++) m.set(x, y, Z, { ground: 'temple_paving', items: [] });
    for (const x of mt.steps) m.setGround(x, mt.y1 - 1, Z, 'temple_paving');
    for (const x of [cx - 2, cx + 2]) put(x, T.mount.y1 - 1, Z, 'pillar'); // pillars either side of the top of the steps
    sign(T.firstSteps[0], T.firstSteps[1], S, 'signpost', T.firstSteps[2]); // on the square, beside the foot of the steps
    // a garden round the temple: a path of the terrace's own paving all the way round it, joining the terrace, and
    // a wide way of it east to the bell tower's door, with lamps along it; flowers beside them
    const pave = (x, y) => { const tt = m.get(x, y, Z); if (tt && (tt.ground === 'grass' || tt.ground === 'gravel' || tt.ground === 'paving')) { tt.ground = 'temple_paving'; tt.items = tt.items.filter(id => !THINGS[id].block && id !== 'flowers' && id !== 'grass_tuft'); } };
    for (let y = t.y0 - 1; y < mt.y1; y++) { pave(t.x0 - 1, y); pave(t.x1 + 1, y); }
    for (let x = t.x0 - 1; x <= t.x1 + 1; x++) pave(x, t.y0 - 1);
    const bt = B.belltower, [bdx, bdy] = bt.door;
    for (let x = t.x1 + 2; x <= bdx + 1; x++) for (const y of [bdy + 1, bdy + 2]) pave(x, y);
    for (const y of [bdy, bdy + 3]) put(t.x1 + 2, y, Z, 'lamppost'); // either side of where it leaves the temple's path
    // the statue of the founder, three tiles square, on the open ground west of the temple, facing the town
    { const [fx, fy] = T.founder;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const ft = m.get(fx + c, fy + r, Z); ft.ground = 'grass'; ft.items = [`founder_${c}${r}`];
        m.setMeta(fx + c, fy + r, Z, { look: 'The founder of Oakvale in white marble, a cloak on her shoulders, one hand on a sword\'s hilt and the other holding a golden sun high. The plinth reads: "She brought us through the long winter." $founder' });
      } }
    for (let x = mt.x0; x <= mt.x1; x++) for (let y = mt.y0; y <= mt.y1; y++) { // flowers and bushes round the edge of the mount
      const tt = m.get(x, y, Z);
      if (tt && tt.ground === 'grass' && !tt.items.length && hash(x, y) < 0.35) put(x, y, Z, hash(x + 3, y) < 0.5 ? 'flowers' : 'grass_tuft');
    }
  }

  // ---- the academy: a classroom below, the oracle's hall upstairs ---------------------------------------------
  {
    const a = B.academy, cx = (a.x0 + a.x1) >> 1;
    for (let x = a.x0 + 1; x < a.x1; x += 2) put(x, a.y0 + 1, S, 'bookshelf');
    for (const y of [a.y0 + 3, a.y0 + 5]) { put(cx - 1, y, S, 'table'); inside(a, cx, y, 'chair_west'); }
    longBed(a.x1 - 1, a.y1 - 2, S); put(a.x1 - 1, a.y1 - 3, S, 'chest');
    put(a.x0 + 1, a.y0 + 4, S, 'noticeboard'); m.setMeta(a.x0 + 1, a.y0 + 4, S, { text: 'Lessons every morning: fighting, magic, and how not to get eaten by rats.' });
    put(a.x0 + 1, a.y1 - 1, S, 'stairs_up');
    put(a.x0 + 1, a.y1 - 1, S + 1, 'stairs_down');
    for (let y = a.y0 + 2; y < a.y1; y++) put(cx, y, S + 1, 'carpet_rug');
    put(cx, a.y0 + 1, S + 1, 'obelisk');
    for (const x of [a.x0 + 1, a.x1 - 1]) { put(x, a.y0 + 1, S + 1, 'torch'); put(x, a.y0 + 4, S + 1, 'pillar'); }
    put(a.x1 - 1, a.y1 - 1, S + 1, 'bookshelf'); put(cx - 2, a.y0, S + 1, 'banner'); put(cx + 2, a.y0, S + 1, 'banner');
  }

  // ---- the depot: lockers along the walls, a counter for the post ------------------------------------------
  {
    const d = B.depot;
    // lockers along the north wall and both sides, the post counter by the east wall, the door kept clear
    for (let x = d.x0 + 1; x < d.x1; x += 2) put(x, d.y0 + 1, S, 'depot');
    for (let y = d.y0 + 3; y < d.y1 - 1; y += 2) put(d.x0 + 1, y, S, 'depot');
    for (let y = d.y0 + 3; y < d.y1 - 1; y++) put(d.x1 - 1, y, S, 'counter');
    put(d.x0 + 1, d.y1 - 1, S, 'plant');
  }

  // ---- shops: a counter across the back, goods on shelves and in barrels -----------------------------------
  const shop = (b, goods) => {
    const back = b.door[1] === b.y1 ? b.y0 + 1 : b.door[1] === b.y0 ? b.y1 - 1 : null;
    if (back !== null) { // door in the front (north or south) wall: the counter runs across
      const cy = back + (back === b.y0 + 1 ? 1 : -1);
      for (let x = b.x0 + 2; x < b.x1; x++) inside(b, x, cy, 'counter');
      for (let x = b.x0 + 1; x < b.x1; x++) inside(b, x, back, goods[(x - b.x0) % goods.length]);
    } else { // door in a side wall: the counter runs along the far side
      const back = b.door[0] === b.x0 ? b.x1 - 1 : b.x0 + 1, cx = back + (back === b.x0 + 1 ? 1 : -1);
      for (let y = b.y0 + 2; y < b.y1; y++) inside(b, cx, y, 'counter');
      for (let y = b.y0 + 1; y < b.y1; y++) inside(b, back, y, goods[(y - b.y0) % goods.length]);
    }
    inside(b, b.door[0] === b.x0 ? b.x0 + 1 : b.x1 - 1, b.door[1] === b.y1 ? b.y1 - 1 : b.y0 + 1, 'plant');
  };
  shop(B.magic, ['bookshelf', 'crate', 'bookshelf']);
  shop(B.armour, ['dummy', 'table', 'dummy']); // (armour on stands and laid out on tables)
  shop(B.general, ['barrel', 'crate', 'sack']);
  shop(B.bakery, ['basket', 'sack', 'barrel']);
  { // the hay barn: open on its south side to the grain field, below and in the loft; sacks and a barrel below,
    // stairs up to the loft in its north-east corner, the loft full of hay
    const f = B.farm;
    for (const [x, y, id] of [[f.x0 + 1, f.y0 + 1, 'sack'], [f.x0 + 2, f.y0 + 1, 'sack'], [f.x0 + 4, f.y0 + 1, 'barrel']]) inside(f, x, y, id);
    put(f.x1 - 1, f.y0 + 1, S, 'stairs_up'); put(f.x1 - 1, f.y0 + 1, S + 1, 'stairs_down');
    for (const [x, y, id] of [[f.x0 + 1, f.y0 + 1, 'haystack'], [f.x0 + 2, f.y0 + 1, 'haystack'], [f.x0 + 1, f.y0 + 2, 'haystack'], [f.x0 + 4, f.y0 + 1, 'sack'], [f.x0 + 5, f.y0 + 2, 'sack']]) put(x, y, S + 1, id);
    for (let x = f.x0 + 1; x < f.x1; x++) { m.get(x, f.y1, S).items = []; m.get(x, f.y1, S + 1).items = x % 3 ? ['haystack'] : []; } // (the open side: hay stacked in the loft's opening)
  }
  { // the water mill: millstones and sacks of flour inside, its wheel turning in the canal beside it
    const w = B.mill;
    for (const [x, y, id] of [[w.x0 + 1, w.y0 + 2, 'millstone'], [w.x0 + 2, w.y1 - 1, 'sack'], [w.x0 + 1, w.y1 - 1, 'sack']]) inside(w, x, y, id);
    for (const y of [w.y0 + 2]) { const t = m.get(w.x1 + 1, y, S); if (t && t.ground === 'water') t.items = ['waterwheel']; }
  }

  // ---- the smithy: a forge and an anvil, and racks of goods ------------------------------------------------
  {
    const s = B.smith;
    put(s.x0 + 1, s.y0 + 1, S, 'smith_hearth'); put(s.x0 + 3, s.y0 + 1, S, 'anvil');
    for (let x = s.x0 + 1; x <= s.x0 + 3; x++) inside(s, x, s.y0 + 3, 'counter');
    inside(s, s.x1 - 1, s.y0 + 1, 'barrel'); inside(s, s.x1 - 1, s.y0 + 2, 'crate');
  }

  // ---- the inn: the taproom below, rooms upstairs -----------------------------------------------------------
  {
    const n = B.inn;
    for (let x = n.x0 + 1; x <= n.x0 + 3; x++) inside(n, x, n.y1 - 2, 'counter');
    for (let x = n.x0 + 1; x <= n.x0 + 3; x++) inside(n, x, n.y1 - 1, 'barrel');
    put(n.x1 - 1, n.y1 - 1, S, 'campfire');
    for (const [x, y] of [[n.x0 + 6, n.y0 + 3], [n.x0 + 6, n.y0 + 6], [n.x0 + 2, n.y0 + 3]]) { put(x, y, S, 'table'); inside(n, x - 1, y, 'chair_east'); inside(n, x + 1, y, 'chair_west'); }
    put(n.x1 - 1, n.y0 + 1, S, 'stairs_up');
    put(n.x1 - 1, n.y0 + 1, S + 1, 'stairs_down');
    // three rooms off a corridor along the north wall
    const cy = n.y0 + 2;
    for (let x = n.x0 + 1; x < n.x1; x++) put(x, cy + 1, S + 1, 'wall_wood');
    for (const rx of [n.x0 + 3, n.x0 + 6]) for (let y = cy + 2; y < n.y1; y++) put(rx, y, S + 1, 'wall_wood');
    for (const [x0, x1] of [[n.x0 + 1, n.x0 + 2], [n.x0 + 4, n.x0 + 5], [n.x0 + 7, n.x1 - 1]]) {
      m.ensure(x0 + 1, cy + 1, S + 1).items = ['door'];
      longBed(x0, n.y1 - 2, S + 1);
      if (x1 > x0 + 1) put(x1, n.y1 - 1, S + 1, 'chest');
    }
    put(n.x0 + 1, n.y0 + 1, S + 1, 'plant');
    if (n.wings) { // the wing: the cellar store
      const [wx0, wy0, wx1, wy1] = n.wings[0];
      for (let x = wx0 + 1; x < wx1; x++) inside(n, x, wy1 - 1, x % 2 ? 'barrel' : 'crate');
      longBed(wx0 + 1, wy1 - 2, S + 1); longBed(wx1 - 1, wy1 - 2, S + 1);
      // upstairs the wing is a fourth room, through a door from the first one (a wall between them, not open floor)
      for (let x = wx0 + 1; x < wx1; x++) m.ensure(x, n.y1, S + 1).items = [x === n.x0 + 2 ? 'door' : 'wall_wood'];
    }
  }

  // ---- the watchtower: a ladder up to the lookout on top --------------------------------------------------------
  if (B.tower) {
    const t = B.tower, cx = (t.x0 + t.x1) >> 1, cy = (t.y0 + t.y1) >> 1;
    put(cx + 1, cy, S, 'ladder');
    put(t.x1 - 1, t.y0 + 1, S, 'barrel'); put(t.x1 - 1, t.y1 - 1, S, 'crate');
    for (let y = t.y0; y <= t.y1; y++) for (let x = t.x0; x <= t.x1; x++) {
      m.set(x, y, S + 1, { ground: 'wood', items: x === t.x0 || x === t.x1 || y === t.y0 || y === t.y1 ? ['wall_stone'] : [] });
    }
    put(cx + 1, cy, S + 1, 'trapdoor');
    put(t.x0 + 1, t.y0 + 1, S + 1, 'flagpole');
  }

  // ---- houses: a bed, a table, a chest; rentable --------------------------------------------------------------
  for (const [id, rent] of Object.entries(T.houses)) {
    const h = B[id];
    const bedX = h.door[0] === h.x0 || h.door[0] === h.x0 + 1 ? h.x1 - 1 : h.x0 + 1; // against the wall away from the door
    longBed(bedX, h.y0 + 1, S);
    inside(h, bedX === h.x0 + 1 ? h.x1 - 1 : h.x0 + 1, h.y0 + 1, 'chest');
    // (the rest never on the tile just inside the door)
    const [fx, fy] = [h.door[0] + (h.door[0] === h.x0) - (h.door[0] === h.x1), h.door[1] + (h.door[1] === h.y0) - (h.door[1] === h.y1)];
    const put2 = (x, y, id) => { if (x !== fx || y !== fy) inside(h, x, y, id); };
    const tx = (h.x0 + h.x1) >> 1, ty = (h.y0 + h.y1 + 1) >> 1;
    put2(tx, ty, 'table'); put2(tx + 1, ty, 'chair_west');
    put2(h.x0 + 1, h.y1 - 1, 'plant');
    m.houses.push({ id: `oak_${id}`, name: h.name, rent, x0: h.x0, y0: h.y0, x1: h.x1, y1: h.y1, z: S });
  }

  // ---- the training yard: sand, a fence round it, dummies --------------------------------------------------------
  {
    const y = T.yard;
    for (let yy = y.y0; yy <= y.y1; yy++) for (let xx = y.x0; xx <= y.x1; xx++) {
      const t = m.get(xx, yy, S);
      t.ground = 'sand'; t.items = [];
      const edge = xx === y.x0 || xx === y.x1 || yy === y.y0 || yy === y.y1;
      if (edge && !(xx === y.gate[0] && yy === y.gate[1])) put(xx, yy, S, 'fence');
    }
    for (let xx = y.x0 + 2; xx <= y.x1 - 2; xx += 2) put(xx, y.y1 - 2, S, 'dummy');
    put(y.x0 + 1, y.y0 + 1, S, 'barrel'); put(y.x1 - 1, y.y0 + 1, S, 'crate');
    sign(y.gate[0] + 1, y.y0 - 1, S, 'signpost', 'Training yard. Hit the dummies, not each other.');
  }

  // ---- fenced gardens -------------------------------------------------------------------------------------------
  for (const gd of T.gardens) for (let y = gd.y0; y <= gd.y1; y++) for (let x = gd.x0; x <= gd.x1; x++) {
    const t = m.get(x, y, S), edge = x === gd.x0 || x === gd.x1 || y === gd.y0 || y === gd.y1;
    t.items = [];
    if (gd.kind === 'crops') {
      t.ground = edge ? 'grass' : 'farmland';
      if (!edge && hash(x + 2, y + 7) > 0.1) put(x, y, S, 'crops'); // (full of grain, a bare patch here and there)
      if (edge && !(x === gd.gate[0] && y === gd.gate[1])) put(x, y, S, 'fence');
    } else put(x, y, S, (x + y) % 4 ? 'flowers' : 'bush');
  }
  // the hay barn's open south side runs straight on to the grain field: no fence between them
  { const f = B.farm; for (let x = f.x0 + 1; x < f.x1; x++) { const t = m.get(x, f.y1 + 1, S); t.items = []; t.ground = 'farmland'; } }
  // a scarecrow in the middle of every big field
  for (const gd of T.gardens) if (gd.kind === 'crops' && gd.x1 - gd.x0 >= 6 && gd.y1 - gd.y0 >= 6) m.get((gd.x0 + gd.x1) >> 1, (gd.y0 + gd.y1) >> 1, S).items = ['scarecrow'];

  // Gates of gardens and the yard: a step of gravel through them and either side, so nothing grows there.
  for (const g of [...T.gardens.filter(gd => gd.gate).map(gd => gd.gate), T.yard.gate]) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const t = m.get(g[0] + dx, g[1] + dy, S);
    if (t && !t.items.length && t.ground === 'grass') t.ground = 'gravel'; // (only on grass: never a floor or a field)
  }

  // ---- paths, the square's furniture, lamps, things about, signs ------------------------------------------------
  for (const pts of T.paths) for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) {
      const t = m.get(x, y, S);
      if (t.ground === 'grass') { t.ground = 'gravel'; t.items = t.items.filter(id => !THINGS[id].block); }
    }
  }
  put(...T.mosaic, S, 'sun_mosaic');
  for (const [x, y] of T.lamps) put(x, y, S, 'lamppost');
  for (const [x, y] of T.benches) put(x, y, S, 'bench');
  for (const [x, y] of T.planters) put(x, y, S, 'planter');
  for (const [x, y, id] of T.props) put(x, y, S, id);
  for (const [x, y] of T.canalReeds || []) { const t = m.get(x, y, S); if (t && t.ground === 'grass' && !t.items.length) put(x, y, S, 'reeds'); }
  if (T.statue) put(...T.statue, S, 'statue');
  for (const [x, y, text] of T.signs) { m.ensure(x, y, S).items = []; sign(x, y, S, 'signpost', text); }
  sign(...T.notice.slice(0, 2), S, 'noticeboard', T.notice[2]);

  // The square's edge: where it meets the grass of the quarters round it, a border of flowers with a flower box at every
  // fourth tile and a bush now and then, so it is a place of its own rather than a widening of the street (lamps and
  // benches keep their spots)
  {
    const inSq = (x, y) => T.square.slice(0, 3).some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
    let k = 0;
    for (let y = 109; y <= 130; y++) for (let x = 116; x <= 143; x++) {
      const t = m.get(x, y, S);
      if (!t || t.ground !== 'grass' || t.items.length || inSq(x, y)) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dy]) => inSq(x + dx, y + dy))) continue;
      t.items = [k % 4 === 0 ? 'planter' : k % 7 === 3 ? 'bush' : 'flowers']; k++;
    }
  }
  // ---- the graveyard ---------------------------------------------------------------------------------------------
  {
    const gy = T.graveyard;
    for (let y = gy.y0; y <= gy.y1; y++) for (let x = gy.x0; x <= gy.x1; x++) {
      const t = m.get(x, y, S), edge = x === gy.x0 || x === gy.x1 || y === gy.y0 || y === gy.y1;
      t.items = t.items.filter(id => id === 'fence');
      if (edge && !(x === gy.gate[0] && y === gy.gate[1]) && !t.items.length) put(x, y, S, 'fence');
      else if (!edge && hash(x, y) < 0.3) put(x, y, S, hash(x + 7, y) < 0.5 ? 'grass_tuft' : 'flowers');
    }
    for (const [x, y, text] of gy.stones) { m.get(x, y, S).items = ['gravestone']; m.setMeta(x, y, S, { look: text }); }
    m.get(gy.x1 - 1, gy.y0 + 1, S).items = ['dead_tree'];
    m.setGround(gy.gate[0] - 1, gy.gate[1], S, 'gravel'); m.setGround(gy.gate[0], gy.gate[1], S, 'gravel');
  }
  // ---- the pier, the grates, things to look at, a forgotten chest ----------------------------------------------------
  if (T.pier) { const [x0, y0, x1, y1] = T.pier; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.set(x, y, S, { ground: 'pier', items: [] }); }
  for (const [x, y] of T.grates) { m.get(x, y, S).items = ['grate']; m.setMeta(x, y, S, { look: T.grateLook }); }
  for (const [x, y, text] of T.looks) m.setMeta(x, y, S, { look: text });
  { const [x, y, gold] = T.cache; m.set(x, y, S, { ground: 'grass', items: ['cache'] }); m.setMeta(x, y, S, { gold }); }

  // Pebbles on the streets and the square, here and there.
  for (let y = bd.y0; y <= bd.y1; y++) for (let x = bd.x0; x <= bd.x1; x++) {
    const t = m.get(x, y, S);
    if (t && t.ground === 'cobble' && !t.items.length && hash(x + 11, y + 5) < 0.06) put(x, y, S, 'pebbles');
  }

  // ---- the moat's banks: reeds along the far bank here and there, water lilies on the water by it ------------------
  {
    const R = T.ramparts, outside = (x, y) => x < R.x0 || x > R.x1 || y < R.y0 || y > R.y1;
    for (let y = bd.y0; y <= bd.y1; y++) for (let x = bd.x0; x <= bd.x1; x++) {
      const t = m.get(x, y, S); if (!t || !outside(x, y) || t.items.length) continue;
      const wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => water(x + dx, y + dy)).length;
      if (t.ground === 'grass' && wet && hash(x + 3, y + 9) < 0.22) put(x, y, S, 'reeds');
      else if (t.ground === 'water' && wet < 4 && hash(x + 5, y + 1) < 0.05) put(x, y, S, 'lilypad');
    }
  }
  // ---- trees, bushes and flowers in the open ground, thicker by the walls and fences ------------------------------
  const busy = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const t = m.get(x + dx, y + dy, S); if (!t || t.ground !== 'grass' || t.items.some(id => THINGS[id].wall || id === 'fence')) return !(t && t.items.includes('fence') && (dx || dy)); } return false; };
  const byFence = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const t = m.get(x + dx, y + dy, S); return t && t.items.some(id => id === 'fence' || id === 'wall_stone') && !T.buildings.some(b => inB(b, x + dx, y + dy)); });
  for (let y = bd.y0; y <= bd.y1; y++) for (let x = bd.x0; x <= bd.x1; x++) {
    const t = m.get(x, y, S);
    if (t.ground !== 'grass' || t.items.length || busy(x, y)) continue;
    const v = hash(x, y);
    if (byFence(x, y) && v < 0.4) put(x, y, S, v < 0.22 ? 'tree' : 'bush');
    else if (v < 0.05) put(x, y, S, 'tree');
    else if (v < 0.08) put(x, y, S, 'bush');
    else if (v < 0.15) put(x, y, S, 'flowers');
    else if (v < 0.19) put(x, y, S, 'grass_tuft');
  }
  // The townsfolk, each on the nearest free tile to their spot (never in a doorway).
  for (const [type, x, y, z] of T.people) {
    let placed = false;
    for (let r = 0; r <= 3 && !placed; r++) for (let dy = -r; dy <= r && !placed; dy++) for (let dx = -r; dx <= r && !placed; dx++) {
      const t = m.get(x + dx, y + dy, z);
      if (!t || !m.isWalkable(x + dx, y + dy, z) || m.floorChange(x + dx, y + dy, z) || m.npcs.some(n => n.x === x + dx && n.y === y + dy && n.z === z)) continue;
      if (t.items.some(id => THINGS[id].toggle)) continue;
      m.npcs.push({ type, x: x + dx, y: y + dy, z });
      placed = true;
    }
  }

  // Nothing in a doorway or straight in front of one.
  for (const b of T.buildings) { const [dx, dy] = b.door; for (const [x, y] of [[dx + 1, dy], [dx - 1, dy], [dx, dy + 1], [dx, dy - 1]]) {
    const t = m.get(x, y, S); if (t && !inB(b, x, y) && t.items.some(id => THINGS[id].block)) t.items = []; } }
  // (the corner towers' doors too: nothing grows in front of them)
  for (let y = bd.y0; y <= bd.y1; y++) for (let x = bd.x0; x <= bd.x1; x++) if (m.get(x, y, S).items.includes('door')) for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const t = m.get(x + ex, y + ey, S); if (t && t.ground === 'grass' && t.items.some(id => ['tree', 'bush', 'flowers', 'grass_tuft'].includes(id))) t.items = []; }
}


