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
const MAP_TOWNS = [['Oakvale', 118, 114, 8]];
const MAP_SIGHTS = [
  ['North Peaks', 100, 57, 9], ['Mirror Lake', 146, 88, 8], ['Willow River', 108, 92, 8], ['Wolf Woods', 60, 84, 8],
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
  town: { x0: 92, y0: 96, x1: 158, y1: 150 },  // Oakvale (the plan is OAKVALE below)
  clearings: [ // kept clear for buildings and camps (phase 4)
    { name: "Fisher's Rest", x0: 42, y0: 170, x1: 56, y1: 182 },
    { name: 'Sunny Fields farm', x0: 112, y0: 150, x1: 126, y1: 160 },
    { name: 'Lighthouse', x0: 122, y0: 200, x1: 134, y1: 210 },
    { name: 'Goblin camp', x0: 184, y0: 66, x1: 198, y1: 78 },
    { name: 'Lumber camp', x0: 56, y0: 96, x1: 66, y1: 104 },
  ],
  lakes: [
    [[150, 62], [164, 58], [176, 64], [176, 78], [166, 84], [154, 82], [148, 72]], // Mirror Lake
    [[136, 166], [144, 164], [146, 172], [138, 174]],                             // a pond in Sunny Fields
    [[180, 136], [188, 134], [190, 142], [182, 144]],                             // a pond in Deer Woods
  ],
  rivers: [
    { name: 'Willow River', width: 3, line: [[150, 72, 4], [116, 72], [116, 86], [104, 86], [104, 106], [102, 106], [102, 132], [84, 132],
      [84, 150], [60, 150], [60, 166, 4], [30, 166]] },
    { name: 'Deer Brook', width: 2, line: [[186, 142], [186, 156], [204, 156], [204, 170], [228, 170]] },
  ],
  // Mountains: rock walls on the surface, rugged crags on top (one floor up), and on the big ones a
  // second tier of rock and crags above that. You can only walk on a ledge where a path (ramp)
  // leads up from the south, or across the whole top of a hill (walkable).
  mountains: [
    { name: 'North Peaks', outline: [[62, 50], [78, 40], [94, 42], [106, 48], [105, 58], [92, 62], [76, 60]], tiers: 3, ramps: [99] },
    { name: 'Eagle Peak', outline: [[114, 38], [126, 34], [136, 42], [130, 52], [116, 52]], tiers: 2, ramps: [] },
    { name: 'Bone Rocks', outline: [[62, 178], [80, 174], [92, 182], [90, 198], [74, 202], [62, 194]], tiers: 2, ramps: [76] },
    { name: 'Spider Hills', outline: [[164, 172], [180, 166], [194, 176], [192, 192], [176, 200], [166, 190]], tiers: 3, ramps: [178] },
    { name: 'Old Tower', outline: [[186, 112], [198, 110], [204, 118], [198, 126], [186, 124]], tiers: 1, ramps: [194], walkable: true },
    { name: 'Hermit Rock', outline: [[192, 40], [208, 40], [212, 52], [200, 56], [192, 50]], tiers: 1, ramps: [202], walkable: true },
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
    { name: 'Lakeside', outline: [[126, 58], [146, 56], [146, 69], [126, 69]] },
  ],
  // Roads and trails: straight runs and turns, 2 or 3 wide; where they cross water they become bridges.
  roads: [
    { name: 'North road', width: 3, line: [[138, 96], [138, 92], [100, 92], [100, 63]] },
    { name: 'West road', width: 3, line: [[92, 125], [90, 125], [90, 116], [70, 116]] },
    { name: 'South road', width: 3, line: [[135, 150], [135, 199]] },
    { name: 'East road', width: 3, line: [[158, 125], [176, 125], [176, 130], [194, 130], [194, 127]] },
  ],
  paths: [
    { name: 'Lake trail', line: [[138, 94], [146, 94], [146, 86]] },
    { name: 'Goblin trail', line: [[146, 90], [180, 90], [180, 80], [190, 80], [190, 62], [202, 62], [202, 57]] },
    { name: 'Spider trail', line: [[170, 125], [170, 152], [152, 152], [152, 203], [178, 203], [178, 201]] },
    { name: 'Bone trail', line: [[135, 164], [96, 164], [96, 205], [76, 205], [76, 203]] },
    { name: 'Fisher trail', line: [[96, 172], [56, 172]] },
    { name: 'Lumber trail', line: [[70, 116], [70, 100], [66, 100]] },
    { name: 'Marsh trail', line: [[70, 116], [56, 116], [56, 130]] },
  ],
};

// Oakvale, the town, laid out the way the old towns grew: Willow River runs through it, with the
// fishermen's quarter on its west bank and two bridges; the temple stands west of the square, where
// the roads from the gates meet after a jog or two; around it, buildings of every size face whichever
// way their street runs. A stone wall guards the north and east, a fence the south and west, and a
// rocky outcrop pokes up behind the inn.
//   wall:      stone wall pieces [x0, y0, x1, y1]; fence: fence pieces; gaps leave the gates open
//   streets:   { line, width, ground } drawn like the roads outside (straight runs and turns)
//   square:    the paved square, as rectangles [x0, y0, x1, y1]
//   buildings: { id, name, kind, x0, y0, x1, y1, wings: [[x0, y0, x1, y1]], door: [x, y], floors, floor,
//                wall, roof, sign }; kind says how it's furnished: temple, academy, depot, shop, smithy,
//                inn, house, tower
//   houses:    the buildings players can rent, with their rent
//   paths:     gravel paths to doors, as lines of points
const OAKVALE = {
  bounds: { x0: 92, y0: 96, x1: 158, y1: 150 },
  wall: [[106, 96, 158, 96], [158, 96, 158, 150]],
  fence: [[92, 96, 100, 96], [92, 96, 92, 150], [92, 150, 158, 150]],
  gaps: [[137, 96, 139, 96], [158, 124, 158, 126], [134, 150, 136, 150], [92, 124, 92, 126]],
  start: { x: 118, y: 114 }, // in the temple, where the aisles cross
  streets: [
    { line: [[138, 96], [138, 106], [134, 106], [134, 108]], width: 3, ground: 'dirt' },   // from the north gate
    { line: [[108, 125], [92, 125]], width: 3, ground: 'dirt' },                            // west, over the big bridge
    { line: [[137, 116], [146, 116], [146, 125], [158, 125]], width: 3, ground: 'dirt' },   // to the east gate
    { line: [[131, 127], [131, 138], [135, 138], [135, 150]], width: 3, ground: 'dirt' },   // to the south gate
    { line: [[96, 104], [107, 104], [107, 123]], width: 2, ground: 'gravel' },              // the river lane and the footbridge
    { line: [[99, 104], [99, 123]], width: 2, ground: 'gravel' },                           // the fishermen's lane
  ],
  square: [[126, 108, 137, 122], [108, 123, 137, 127]],
  buildings: [
    { id: 'temple', name: 'Temple of the Dawn', kind: 'temple', x0: 113, y0: 108, x1: 123, y1: 122, wings: [[111, 112, 125, 115]], door: [118, 122], floor: 'marble', wall: 'wall_stone', roof: 'roof_slate', signId: 'sign_temple', sign: 'Temple of the Dawn. You wake here when you first come to Oakvale Isle, and again whenever you die. Nobody can fight inside a temple.' },
    { id: 'academy', name: 'Oakvale Academy', kind: 'academy', x0: 109, y0: 97, x1: 121, y1: 105, wings: [[121, 97, 124, 101]], door: [115, 105], floors: 2, floor: 'tiles', wall: 'wall_stone', roof: 'roof_green', signId: 'sign_school', sign: 'Oakvale Academy. New here? The teachers explain the basics. Upstairs, the oracle sends adventurers of level 10 on to the mainland.' },
    { id: 'depot', name: 'Depot and Post', kind: 'depot', x0: 126, y0: 98, x1: 133, y1: 103, door: [133, 100], floor: 'marble', wall: 'wall_stone', roof: 'roof_slate', signId: 'sign_depot', sign: 'Depot and post. Put things in a locker to keep them safe; you find the same locker in every town\'s depot.' },
    { id: 'magic', name: 'Moonpetal Magic', kind: 'shop', x0: 141, y0: 98, x1: 146, y1: 103, door: [144, 103], floor: 'wood', wall: 'wall_wood', roof: 'roof_shingle', signId: 'sign_magic', shelves: 'shelf', sign: 'Moonpetal Magic: runes, wands and potions. Say hi to the shopkeeper, then ask to trade.' },
    { id: 'armour', name: 'Hide and Iron', kind: 'shop', x0: 139, y0: 106, x1: 145, y1: 113, door: [142, 113], floor: 'wood', wall: 'wall_wood', roof: 'roof', signId: 'sign_armour', shelves: 'weapon_rack', sign: 'Hide and Iron: armour, helmets and shields. Say hi, then ask to trade.' },
    { id: 'smith', name: 'The Dented Shield', kind: 'smithy', x0: 93, y0: 107, x1: 98, y1: 114, door: [98, 110], floor: 'cobble', wall: 'wall_stone', roof: 'roof', signId: 'sign_weapons', shelves: 'weapon_rack', sign: 'The Dented Shield: weapons, bought and sold. Say hi, then ask to trade.' },
    { id: 'inn', name: 'The Sleepy Boar', kind: 'inn', x0: 148, y0: 128, x1: 157, y1: 135, wings: [[148, 136, 152, 140]], door: [152, 128], floors: 2, floor: 'wood', wall: 'wall_wood', roof: 'roof_thatch', signId: 'sign_inn', shelves: 'shelf', sign: 'The Sleepy Boar: food, drink and a bed.' },
    { id: 'general', name: 'Pip\'s Provisions', kind: 'shop', x0: 116, y0: 130, x1: 122, y1: 136, door: [119, 130], floor: 'wood', wall: 'wall_wood', roof: 'roof_shingle', signId: 'sign_tools', shelves: 'shelf', sign: 'Pip\'s Provisions: ropes, shovels, torches and fishing rods. Every adventurer needs a rope and a shovel.' },
    { id: 'bakery', name: 'The Warm Loaf', kind: 'shop', x0: 108, y0: 130, x1: 113, y1: 135, door: [110, 130], floor: 'wood', wall: 'wall_wood', roof: 'roof_thatch', signId: 'sign_food', shelves: 'shelf', sign: 'The Warm Loaf: bread, cheese and ham. Eat to get your health and mana back faster.' },
    { id: 'tower', name: 'North-east watchtower', kind: 'tower', x0: 153, y0: 97, x1: 157, y1: 101, door: [153, 99], floor: 'cobble', wall: 'wall_stone', roof: null },
    { id: 'house1', name: 'Ivy Cottage', kind: 'house', x0: 148, y0: 98, x1: 151, y1: 102, door: [150, 102], floor: 'wood', wall: 'wall_wood', roof: 'roof' },
    { id: 'house2', name: 'Millstone House', kind: 'house', x0: 149, y0: 105, x1: 155, y1: 110, door: [152, 110], floor: 'wood', wall: 'wall_stone', roof: 'roof_shingle' },
    { id: 'house3', name: 'Riverside Cottage', kind: 'house', x0: 93, y0: 117, x1: 97, y1: 121, door: [97, 119], floor: 'wood', wall: 'wall_wood', roof: 'roof_thatch' },
    { id: 'house4', name: 'Fisher\'s Hut', kind: 'house', x0: 93, y0: 98, x1: 97, y1: 102, door: [95, 102], floor: 'wood', wall: 'wall_wood', roof: 'roof_thatch' },
    { id: 'house5', name: 'Bell Cottage', kind: 'house', x0: 124, y0: 131, x1: 128, y1: 136, door: [128, 133], floor: 'wood', wall: 'wall_stone', roof: 'roof' },
    { id: 'house6', name: 'Thatch End', kind: 'house', x0: 139, y0: 141, x1: 144, y1: 146, door: [139, 143], floor: 'wood', wall: 'wall_wood', roof: 'roof_thatch' },
  ],
  houses: { house1: 400, house2: 500, house3: 350, house4: 300, house5: 400, house6: 300 },
  // Fenced gardens: vegetable rows (crops on farmland) or flower beds; gate: the gap in the fence.
  gardens: [
    { x0: 139, y0: 129, x1: 145, y1: 135, kind: 'crops', gate: [139, 132] },
    { x0: 109, y0: 108, x1: 110, y1: 121, kind: 'flowers' },
    { x0: 93, y0: 135, x1: 100, y1: 141, kind: 'crops', gate: [100, 138] },
    { x0: 124, y0: 140, x1: 129, y1: 144, kind: 'crops', gate: [129, 142] },
  ],
  // The old graveyard: a fence, a gate, and gravestones you can read (look at them).
  graveyard: { x0: 146, y0: 142, x1: 156, y1: 150, gate: [146, 145], stones: [
    [148, 144, 'Here lies Old Wim, who went down the well for a bet.'],
    [150, 144, 'Bertha Oakhart. She fed the town through the long winter.'],
    [152, 144, 'An adventurer who never bought a rope.'],
    [154, 144, 'Sir Galen. He said the rats in the cellar were "only rats".'],
    [148, 147, 'Taken by the spiders of the hills. Go well armed, friend.'],
    [150, 147, 'Mara the fisher. The river gives, the river takes.'],
    [154, 147, 'No name. Only the words: "the crag remembers".'],
  ] },
  // A pier into the river by the fishermen's quarter: [x0, y0, x1, y1]
  pier: [103, 100, 104, 100],
  // Grates over the sewers, and what you notice when you look at them.
  grates: [[134, 107], [118, 126], [147, 120], [99, 112]],
  grateLook: 'Something squeaks and scratches down there in the dark.',
  // Things with something to say when you look at them: [x, y, text]
  looks: [
    [131, 104, 'A rope runs down into black water. Someone has scratched a little rat on the stone.'],
    [135, 112, 'Tamsin Oakhart, who built the first house by the river, and the bridge after it.'],
  ],
  // A forgotten chest for whoever explores behind the outcrop: [x, y, gold]
  cache: [157, 113, 30],
  // A rocky outcrop: rock walls with a rugged top, as in the old towns.
  outcrop: [[149, 114], [154, 113], [157, 117], [155, 122], [150, 121]],
  // The training yard: a fenced sandy yard with dummies.
  yard: { x0: 106, y0: 141, x1: 120, y1: 148, gate: [113, 141] },
  paths: [
    [[115, 106], [125, 106], [125, 107]],     // academy to the square
    [[134, 100], [136, 100]],                 // depot to the north street
    [[144, 104], [144, 105]],                 // magic shop
    [[150, 103], [150, 104], [140, 104]],     // Ivy Cottage
    [[152, 111], [152, 113], [147, 113]],     // Millstone House
    [[142, 114], [142, 114]],                 // armourer
    [[155, 102], [155, 104], [152, 104]],     // round the watchtower
    [[152, 127], [152, 127]],                 // the inn
    [[110, 128], [110, 129]], [[119, 128], [119, 129]], // bakery, general store
    [[129, 133], [129, 133]],                 // Bell Cottage
    [[138, 143], [137, 143]],                 // Thatch End
    [[113, 140], [113, 137], [123, 137], [123, 128]], // the training yard
    [[95, 103], [95, 103]],                   // Fisher's Hut
    [[93, 115], [98, 115]],                   // behind the smithy
  ],
  // Things standing about: [x, y, id]
  props: [
    [131, 104, 'well'], [147, 113, 'firewood'], [147, 104, 'haystack'], [146, 105, 'barrel'], [135, 112, 'statue'],
    [93, 115, 'firewood'], [93, 116, 'barrel'], [98, 116, 'anvil'], [94, 122, 'barrel'], [100, 128, 'crate'],
    [125, 128, 'wagon'], [137, 128, 'barrel'], [137, 127, 'crate'], [146, 139, 'scarecrow'], [123, 104, 'barrel'], [155, 111, 'woodpile'],
    [147, 127, 'barrel'], [147, 126, 'crate'],
    [133, 109, 'stall'], [134, 109, 'apple_crate'], [136, 111, 'stall'], [136, 112, 'crate'], [127, 120, 'stall'], [127, 121, 'apple_crate'], [128, 121, 'sack'],
  ],
  lamps: [[136, 97], [140, 97], [157, 123], [157, 127], [133, 149], [137, 149], [93, 123], [93, 127], [126, 108], [137, 108], [126, 122], [137, 122], [108, 127], [104, 123], [104, 127], [108, 104]],
  benches: [[129, 111], [129, 119], [134, 119], [112, 126], [124, 126]],
  planters: [[117, 123], [119, 123], [126, 115], [137, 115]],
  fountain: [131, 113],
  signs: [
    [136, 94, 'North: the North Peaks and Mirror Lake. South: Oakvale.'],
    [160, 122, 'East: Deer Woods, the Old Tower and the Spider Hills. West: Oakvale.'],
    [133, 152, 'South: Sunny Fields, Bone Rocks and Lighthouse Point. North: Oakvale.'],
    [90, 122, 'West: Frog Marsh and Wolf Woods. East: Oakvale.'],
  ],
  notice: [128, 123, 'NOTICE: Rats in the cellars again! Brave helpers, ask in town.'],
  firstSteps: [116, 124, 'First steps: the depot is north-east of the square, the shops line the streets, and the academy is north. Fight rats first, then the wolves of the woods. Look at things: many have a story.'],
};

function createDefaultMap() {
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
  for (const mount of d.mountains) {
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
  const paint = (line, width) => {
    runs(line, width, (x, y) => { if (m.inBounds(x, y, S)) keep[y * W + x] = 1; }, 3); // and a margin with no trees
    runs(line, width, (x, y, alongX) => {
      const g = ground(x, y);
      if (g === 'water' && riverBed.has(y * W + x)) m.setGround(x, y, S, alongX ? 'bridge_ew' : 'bridge_ns');
      else if (g === 'water') m.setGround(x, y, S, 'dirt'); // a trail through a marsh pool is a causeway
      else if (['grass', 'sand', 'swamp', 'mountain'].includes(g) && !at(x, y).items.includes('cliff')) {
        m.setGround(x, y, S, 'dirt');
        at(x, y).items = at(x, y).items.filter(id => !THINGS[id].block);
      }
    });
  };
  for (const road of d.roads) paint(road.line, road.width);
  for (const path of d.paths) paint(path.line, 2);

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
    else if (v < thick + 0.2) put(x, y, S, 'mushrooms');
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
      else if (!meadow[i] && v < 0.06 + grove * 0.12) put(x, y, S, v < 0.045 ? 'pine' : v < 0.075 ? 'bush' : 'tree'); // firs and bushes everywhere
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

  // ---- where you start: in the temple ------------------------------------------------------------
  m.start = { x: OAKVALE.start.x, y: OAKVALE.start.y, z: S };
  m.mainStart = { ...m.start };
  const xs = d.coast.map(p => p[0]), ys = d.coast.map(p => p[1]);
  m.isle = { x0: Math.min(...xs) - 4, y0: Math.min(...ys) - 4, x1: Math.max(...xs) + 4, y1: Math.max(...ys) + 4 };
  return m;
}

// Builds Oakvale (see OAKVALE): the river through it, walls and fences, streets, the square, buildings
// with their insides, roofs and signs, and the gardens, yards and things between them.
// runs: the road painter from createDefaultMap; river: the river that runs through town.
function buildTown(m, S, runs, river) {
  const T = OAKVALE, put = (x, y, z, id) => m.addItem(x, y, z, id);
  const free = (x, y, z = S) => { const t = m.get(x, y, z); return !!t && !t.items.length && !THINGS[t.ground].block; };
  const sign = (x, y, z, id, text) => { put(x, y, z, id); m.setMeta(x, y, z, { text }); };
  const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 / 1000;
  const bd = T.bounds, inTown = (x, y) => x >= bd.x0 && x <= bd.x1 && y >= bd.y0 && y <= bd.y1;

  // The ground: grass, cleared of the wilds, with the river through it in a tidy bed.
  const bed = new Set();
  runs(river.line, river.width, (x, y) => bed.add(`${x},${y}`));
  for (let y = bd.y0; y <= bd.y1; y++) for (let x = bd.x0; x <= bd.x1; x++) {
    m.set(x, y, S, { ground: bed.has(`${x},${y}`) ? 'water' : 'grass', items: [] });
    for (let z = S + 1; z < m.depth; z++) m.set(x, y, z, null);
  }
  const water = (x, y) => (m.get(x, y, S) || {}).ground === 'water';

  // Walls and fences, open at the gates.
  const gap = (x, y) => T.gaps.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
  for (const [list, id] of [[T.wall, 'wall_stone'], [T.fence, 'fence']]) for (const [x0, y0, x1, y1] of list) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!gap(x, y) && !water(x, y) && !m.get(x, y, S).items.length) put(x, y, S, id);
  }

  // Streets (bridges over the river) and the square.
  for (const st of T.streets) runs(st.line, st.width, (x, y, alongX) => {
    if (!inTown(x, y)) return;
    m.setGround(x, y, S, water(x, y) ? (alongX ? 'bridge_ew' : 'bridge_ns') : st.ground);
  });
  for (const [x0, y0, x1, y1] of T.square) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.setGround(x, y, S, 'cobble');

  // The outcrop: rock walls with a rugged top and a few boulder piles.
  const rockAt = (x, y) => { let hit = false; const p = T.outcrop; for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit; } return hit; };
  for (let y = bd.y0; y <= bd.y1; y++) for (let x = bd.x0; x <= bd.x1; x++) {
    if (!rockAt(x + 0.5, y + 0.5)) continue;
    m.set(x, y, S, { ground: 'mountain', items: ['cliff'] });
    m.set(x, y, S + 1, { ground: 'rock_top', items: hash(x, y) < 0.25 ? ['crag'] : [] });
  }

  // A building: its main block and any wings (it's the shape they make together). Floor, walls (with
  // a door and windows), and a roof on the floor above. Upper floors get their own walls and
  // windows, and the roof goes on top of them.
  const partsOf = b => [[b.x0, b.y0, b.x1, b.y1], ...(b.wings || [])];
  const inB = (b, x, y) => partsOf(b).some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
  const isWall = (b, x, y) => inB(b, x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dy]) => !inB(b, x + dx, y + dy));
  const eachOf = (b, fn) => { for (const [x0, y0, x1, y1] of partsOf(b)) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) fn(x, y); };
  const building = b => {
    const floors = b.floors || 1;
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
        if (straight && along % 3 === 0 && Math.abs(x - b.door[0]) + Math.abs(y - b.door[1]) > 1) put(x, y, z, 'window');
      });
    }
    const [dx, dy] = b.door;
    m.ensure(dx, dy, S).items = [b.kind === 'house' ? 'door_house' : 'door'];
    if (b.roof) eachOf(b, (x, y) => m.set(x, y, S + floors, { ground: b.roof, items: [] }));
    if (b.roof && b.kind !== 'temple' && b.kind !== 'depot') put(b.x1 - 1, b.y0 + 1, S + floors, 'chimney');
    const out = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([ox, oy]) => [dx + ox, dy + oy]).find(([x, y]) => !inB(b, x, y));
    // A sign on the wall beside the door, and a step of gravel in front of it.
    if (b.sign) {
      const across = out[0] === dx, sx = across ? dx + 1 : dx, sy = across ? dy : dy + 1;
      const t = m.get(sx, sy, S);
      t.items = t.items.filter(id => id !== 'window');
      sign(sx, sy, S, b.signId || 'sign_wall', b.sign);
      // ...and a lantern on the other side of the door
      const lx = across ? dx - 1 : dx, ly = across ? dy : dy - 1, lt = m.get(lx, ly, S);
      if (lt && isWall(b, lx, ly)) { lt.items = lt.items.filter(id => id !== 'window'); put(lx, ly, S, 'lantern'); }
    }
    if (m.get(...out, S).ground === 'grass') m.setGround(...out, S, 'gravel');
    if (b.kind !== 'temple' && b.kind !== 'depot' && b.kind !== 'tower') for (let z = S; z < S + floors; z++) for (const [x0, y0, x1, y1] of partsOf(b)) m.zones.push({ x0, y0, x1, y1, z, shelter: true });
  };
  for (const b of T.buildings) building(b);
  // Shelves or racks along the inside of the north wall; flower boxes under the windows of homes and the inn.
  for (const b of T.buildings) {
    if (b.shelves) for (let x = b.x0 + 1; x < b.x1; x++) { const t = m.get(x, b.y0, S); if (t.items.length === 1 && x % 2) put(x, b.y0, S, b.shelves); }
    if (b.kind === 'house' || b.kind === 'inn') eachOf(b, (x, y) => { const t = m.get(x, y, S); if (t.items.includes('window') && (y === b.y1 || x === b.x1)) put(x, y, S, 'window_box'); });
  }
  const B = Object.fromEntries(T.buildings.map(b => [b.id, b]));
  const inside = (b, x, y, id, z = S) => { if (free(x, y, z) && !(x === b.door[0] && Math.abs(y - b.door[1]) <= 1) && !(y === b.door[1] && Math.abs(x - b.door[0]) <= 1)) put(x, y, z, id); };

  // ---- the temple: an aisle of carpet up to the altar, pillars, benches, statues in the side chapels --------
  {
    const t = B.temple, cx = (t.x0 + t.x1) >> 1, [wx0, wy0, wx1, wy1] = t.wings[0];
    for (let y = t.y0 + 2; y < t.y1; y++) m.setGround(cx, y, S, 'carpet');
    for (let x = wx0 + 1; x < wx1; x++) m.setGround(x, (wy0 + wy1 + 1) >> 1, S, 'carpet');
    put(cx, t.y0 + 1, S, 'altar');
    for (const x of [cx - 2, cx + 2]) put(x, t.y0 + 1, S, 'torch');
    put(cx - 4, t.y0, S, 'banner'); put(cx + 4, t.y0, S, 'banner');
    for (const y of [t.y0 + 2, wy1 + 2]) for (const x of [cx - 3, cx + 3]) put(x, y, S, 'pillar');
    for (const y of [wy1 + 4, wy1 + 6]) for (const x of [cx - 3, cx - 2, cx + 2, cx + 3]) put(x, y, S, 'bench');
    put(wx0 + 1, wy0 + 1, S, 'statue'); put(wx1 - 1, wy0 + 1, S, 'statue');
    put(wx0 + 1, wy1 - 1, S, 'plant'); put(wx1 - 1, wy1 - 1, S, 'plant');
    for (const [x, y] of [[t.x0 + 1, t.y1 - 1], [t.x1 - 1, t.y1 - 1]]) put(x, y, S, 'plant');
    for (const y of [t.y0 + 2, t.y1 - 3]) { put(t.x0, y, S, 'wall_torch'); put(t.x1, y, S, 'wall_torch'); }
    m.temples.push({ home: 'oakvale', town: 'Oakvale', npc: null, x: T.start.x, y: T.start.y, z: S });
  }

  // ---- the academy: a classroom below (the teacher's room in the wing), the oracle's hall upstairs ----------
  {
    const a = B.academy, [, , wx1] = a.wings[0];
    for (let x = a.x0 + 2; x <= a.x1 - 2; x += 2) put(x, a.y0 + 1, S, 'bookshelf');
    for (const y of [a.y0 + 3, a.y0 + 5]) for (let x = a.x0 + 3; x <= a.x1 - 3; x += 3) { put(x, y, S, 'table'); inside(a, x + 1, y, 'chair'); }
    put(wx1 - 1, a.y0 + 1, S, 'bed'); put(wx1 - 1, a.y0 + 3, S, 'chest');
    put(a.x0 + 1, a.y0 + 4, S, 'noticeboard'); m.setMeta(a.x0 + 1, a.y0 + 4, S, { text: 'Lessons every morning: fighting, magic, and how not to get eaten by rats.' });
    put(a.x0 + 1, a.y1 - 1, S, 'stairs_up');
    put(a.x0 + 1, a.y1 - 1, S + 1, 'stairs_down');
    const cx = (a.x0 + a.x1) >> 1;
    for (let y = a.y0 + 2; y < a.y1; y++) m.setGround(cx, y, S + 1, 'carpet');
    put(cx, a.y0 + 2, S + 1, 'obelisk');
    for (const x of [cx - 3, cx + 3]) put(x, a.y0 + 2, S + 1, 'torch');
    for (const x of [cx - 2, cx + 2]) put(x, a.y0 + 5, S + 1, 'pillar');
    for (const x of [a.x1 - 2, wx1 - 1]) put(x, a.y0 + 1, S + 1, 'bookshelf');
    put(a.x0 + 3, a.y0 + 1, S + 1, 'bookshelf'); put(a.x0 + 2, a.y0, S + 1, 'banner');
  }

  // ---- the depot: lockers along the walls, a counter for the post ------------------------------------------
  {
    const d = B.depot;
    for (let x = d.x0 + 1; x < d.x1; x += 2) put(x, d.y0 + 1, S, 'depot');
    for (let y = d.y0 + 3; y < d.y1; y += 2) put(d.x0 + 1, y, S, 'depot');
    for (let x = d.x0 + 3; x <= d.x0 + 5; x++) put(x, d.y1 - 1, S, 'counter');
    put(d.x1 - 1, d.y1 - 1, S, 'plant');
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
  shop(B.armour, ['crate', 'barrel', 'crate']);
  shop(B.general, ['barrel', 'crate', 'sack']);
  shop(B.bakery, ['basket', 'barrel', 'sack']);

  // ---- the smithy: a forge and an anvil, and racks of goods ------------------------------------------------
  {
    const s = B.smith;
    put(s.x0 + 1, s.y0 + 1, S, 'campfire'); put(s.x0 + 2, s.y0 + 1, S, 'anvil');
    for (let y = s.y0 + 3; y < s.y1; y++) inside(s, s.x0 + 2, y, 'counter');
    for (let y = s.y0 + 3; y < s.y1; y++) inside(s, s.x0 + 1, y, y % 2 ? 'crate' : 'barrel');
  }

  // ---- the inn: the taproom below, rooms upstairs -----------------------------------------------------------
  {
    const n = B.inn;
    for (let x = n.x0 + 1; x <= n.x0 + 3; x++) inside(n, x, n.y1 - 2, 'counter');
    for (let x = n.x0 + 1; x <= n.x0 + 3; x++) inside(n, x, n.y1 - 1, 'barrel');
    put(n.x1 - 1, n.y1 - 1, S, 'campfire');
    for (const [x, y] of [[n.x0 + 6, n.y0 + 3], [n.x0 + 6, n.y0 + 6], [n.x0 + 2, n.y0 + 3]]) { put(x, y, S, 'table'); inside(n, x - 1, y, 'chair'); inside(n, x + 1, y, 'chair'); }
    put(n.x1 - 1, n.y0 + 1, S, 'stairs_up');
    put(n.x1 - 1, n.y0 + 1, S + 1, 'stairs_down');
    // three rooms off a corridor along the north wall
    const cy = n.y0 + 2;
    for (let x = n.x0 + 1; x < n.x1; x++) put(x, cy + 1, S + 1, 'wall_wood');
    for (const rx of [n.x0 + 3, n.x0 + 6]) for (let y = cy + 2; y < n.y1; y++) put(rx, y, S + 1, 'wall_wood');
    for (const [x0, x1] of [[n.x0 + 1, n.x0 + 2], [n.x0 + 4, n.x0 + 5], [n.x0 + 7, n.x1 - 1]]) {
      m.ensure(x0 + 1, cy + 1, S + 1).items = ['door'];
      put(x0, n.y1 - 1, S + 1, 'bed');
      if (x1 > x0 + 1) put(x1, n.y1 - 1, S + 1, 'chest');
    }
    put(n.x0 + 1, n.y0 + 1, S + 1, 'plant');
    const [wx0, wy0, wx1, wy1] = n.wings[0]; // the wing: the cellar store
    for (let x = wx0 + 1; x < wx1; x++) inside(n, x, wy1 - 1, x % 2 ? 'barrel' : 'crate');
    put(wx0 + 1, wy1 - 1, S + 1, 'bed'); put(wx1 - 1, wy1 - 1, S + 1, 'bed');
  }

  // ---- the watchtower: a ladder up to the lookout on top --------------------------------------------------------
  {
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
    inside(h, h.x0 + 1, h.y0 + 1, 'bed');
    inside(h, h.x1 - 1, h.y0 + 1, 'chest');
    const tx = (h.x0 + h.x1) >> 1, ty = (h.y0 + h.y1 + 1) >> 1;
    inside(h, tx, ty, 'table'); inside(h, tx + 1, ty, 'chair');
    inside(h, h.x0 + 1, h.y1 - 1, 'plant');
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
    for (let xx = y.x0 + 2; xx <= y.x1 - 2; xx += 3) put(xx, y.y1 - 2, S, 'dummy');
    put(y.x0 + 1, y.y0 + 1, S, 'barrel'); put(y.x1 - 1, y.y0 + 1, S, 'crate');
    sign(y.gate[0] + 1, y.y0 - 1, S, 'signpost', 'Training yard. Hit the dummies, not each other.');
  }

  // ---- fenced gardens -------------------------------------------------------------------------------------------
  for (const gd of T.gardens) for (let y = gd.y0; y <= gd.y1; y++) for (let x = gd.x0; x <= gd.x1; x++) {
    const t = m.get(x, y, S), edge = x === gd.x0 || x === gd.x1 || y === gd.y0 || y === gd.y1;
    t.items = [];
    if (gd.kind === 'crops') {
      t.ground = edge ? 'grass' : 'farmland';
      if (!edge && y % 2) put(x, y, S, 'crops');
      if (edge && !(x === gd.gate[0] && y === gd.gate[1])) put(x, y, S, 'fence');
    } else put(x, y, S, (x + y) % 4 ? 'flowers' : 'bush');
  }

  // Gates of gardens and the yard: a step of gravel through them and either side, so nothing grows there.
  for (const g of [...T.gardens.filter(gd => gd.gate).map(gd => gd.gate), T.yard.gate]) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const t = m.get(g[0] + dx, g[1] + dy, S);
    if (t && !t.items.length && t.ground !== 'farmland' && t.ground !== 'sand') t.ground = 'gravel';
  }

  // ---- paths, the square's furniture, lamps, things about, signs ------------------------------------------------
  for (const pts of T.paths) for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) {
      const t = m.get(x, y, S);
      if (t.ground === 'grass') { t.ground = 'gravel'; t.items = t.items.filter(id => !THINGS[id].block); }
    }
  }
  const [fx, fy] = T.fountain;
  put(fx, fy, S, 'fountain_rim'); put(fx + 1, fy, S, 'fountain_rim'); put(fx, fy + 1, S, 'fountain_rim'); put(fx + 1, fy + 1, S, 'fountain');
  for (const [x, y] of T.lamps) put(x, y, S, 'lamppost');
  for (const [x, y] of T.benches) put(x, y, S, 'bench');
  for (const [x, y] of T.planters) put(x, y, S, 'planter');
  for (const [x, y, id] of T.props) put(x, y, S, id);
  for (const [x, y, text] of T.signs) { m.ensure(x, y, S).items = []; sign(x, y, S, 'signpost', text); }
  sign(...T.notice.slice(0, 2), S, 'noticeboard', T.notice[2]);

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
  { const [x0, y0, x1, y1] = T.pier; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.set(x, y, S, { ground: 'pier', items: [] }); }
  put(99, 100, S, 'fish_rack'); m.get(105, 102, S).items = ['boat'];
  for (const [x, y] of T.grates) { m.get(x, y, S).items = ['grate']; m.setMeta(x, y, S, { look: T.grateLook }); }
  for (const [x, y, text] of T.looks) m.setMeta(x, y, S, { look: text });
  { const [x, y, gold] = T.cache; m.set(x, y, S, { ground: 'grass', items: ['cache'] }); m.setMeta(x, y, S, { gold }); }
  sign(...T.firstSteps.slice(0, 2), S, 'signpost', T.firstSteps[2]);

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
  // Nothing in a doorway or straight in front of one.
  for (const b of T.buildings) { const [dx, dy] = b.door; for (const [x, y] of [[dx + 1, dy], [dx - 1, dy], [dx, dy + 1], [dx, dy - 1]]) {
    const t = m.get(x, y, S); if (t && !inB(b, x, y) && t.items.some(id => THINGS[id].block)) t.items = []; } }
}
