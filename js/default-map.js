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
const MAP_TOWNS = [['Oakvale', 133, 124, 8]];
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
  town: { x0: 110, y0: 101, x1: 156, y1: 147 },  // Oakvale, inside its wall (the plan is OAKVALE below)
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
    { name: 'North road', width: 3, line: [[133, 101], [133, 92], [100, 92], [100, 63]] },
    { name: 'West road', width: 3, line: [[110, 124], [90, 124], [90, 116], [70, 116]] },
    { name: 'South road', width: 3, line: [[133, 147], [133, 199]] },
    { name: 'East road', width: 3, line: [[156, 124], [176, 124], [176, 130], [194, 130], [194, 127]] },
  ],
  paths: [
    { name: 'Lake trail', line: [[133, 96], [146, 96], [146, 86]] },
    { name: 'Goblin trail', line: [[146, 90], [180, 90], [180, 80], [190, 80], [190, 62], [202, 62], [202, 57]] },
    { name: 'Spider trail', line: [[170, 124], [170, 152], [152, 152], [152, 203], [178, 203], [178, 201]] },
    { name: 'Bone trail', line: [[133, 164], [96, 164], [96, 205], [76, 205], [76, 203]] },
    { name: 'Fisher trail', line: [[96, 172], [56, 172]] },
    { name: 'Lumber trail', line: [[70, 116], [70, 100], [66, 100]] },
    { name: 'Marsh trail', line: [[70, 116], [56, 116], [56, 130]] },
  ],
};

// Oakvale, the town: a stone wall with four gates; the temple in the middle on a paved square,
// where new characters wake up; streets out to the gates; shops, the academy (the oracle is
// upstairs), the depot, an inn, a training yard, a watchtower and houses around it.
//   streets:   [x0, y0, x1, y1, ground]
//   buildings: { id, name, kind, x0, y0, x1, y1, door: [x, y], floors (1 or 2), floor, wall, roof, sign }
//              kind says how it's furnished: temple, academy, depot, shop, smithy, inn, house, tower
//   houses:    the buildings players can rent, with their rent
const OAKVALE = {
  wall: { x0: 110, y0: 101, x1: 156, y1: 147 },
  gates: [[132, 101, 134, 101], [132, 147, 134, 147], [110, 123, 110, 125], [156, 123, 156, 125]],
  start: { x: 133, y: 124 }, // in the temple, before the altar
  streets: [
    [132, 102, 134, 113, 'cobble'], [132, 135, 134, 146, 'cobble'], [111, 123, 122, 125, 'cobble'], [144, 123, 155, 125, 'cobble'],
    [123, 114, 143, 116, 'paving'], [123, 117, 125, 134, 'paving'], [141, 117, 143, 134, 'paving'], [126, 130, 140, 134, 'paving'],
  ],
  buildings: [
    { id: 'temple', name: 'Temple of the Dawn', kind: 'temple', x0: 128, y0: 117, x1: 138, y1: 129, wings: [[126, 120, 140, 124]], door: [133, 129], floor: 'marble', wall: 'wall_stone', roof: 'roof_slate' },
    { id: 'academy', name: 'Oakvale Academy', kind: 'academy', x0: 113, y0: 103, x1: 124, y1: 109, wings: [[113, 110, 117, 113]], door: [121, 109], floors: 2, floor: 'tiles', wall: 'wall_stone', roof: 'roof_green' },
    { id: 'depot', name: 'Depot and Post', kind: 'depot', x0: 136, y0: 103, x1: 143, y1: 110, door: [136, 106], floor: 'marble', wall: 'wall_stone', roof: 'roof_slate' },
    { id: 'magic', name: 'Moonpetal Magic', kind: 'shop', x0: 113, y0: 116, x1: 119, y1: 121, door: [119, 118], floor: 'wood', wall: 'wall_wood', roof: 'roof_shingle', sign: 'Moonpetal Magic: runes, wands and potions.' },
    { id: 'smith', name: 'The Dented Shield', kind: 'smithy', x0: 113, y0: 127, x1: 120, y1: 133, door: [117, 127], floor: 'cobble', wall: 'wall_stone', roof: 'roof', sign: 'The Dented Shield: weapons, bought and sold.' },
    { id: 'armour', name: 'Hide and Iron', kind: 'shop', x0: 147, y0: 115, x1: 154, y1: 121, door: [150, 121], floor: 'wood', wall: 'wall_wood', roof: 'roof', sign: 'Hide and Iron: armour, helmets and shields.' },
    { id: 'inn', name: 'The Sleepy Boar', kind: 'inn', x0: 145, y0: 127, x1: 155, y1: 134, wings: [[151, 135, 155, 138]], door: [149, 127], floors: 2, floor: 'wood', wall: 'wall_wood', roof: 'roof_thatch', sign: 'The Sleepy Boar: food, drink and a bed.' },
    { id: 'general', name: 'Pip\'s Provisions', kind: 'shop', x0: 136, y0: 137, x1: 142, y1: 142, door: [136, 140], floor: 'wood', wall: 'wall_wood', roof: 'roof_shingle', sign: 'Pip\'s Provisions: ropes, shovels, torches and fishing rods.' },
    { id: 'bakery', name: 'The Warm Loaf', kind: 'shop', x0: 144, y0: 140, x1: 149, y1: 145, door: [146, 140], floor: 'wood', wall: 'wall_wood', roof: 'roof_thatch', sign: 'The Warm Loaf: bread, cheese and ham.' },
    { id: 'tower', name: 'North-east watchtower', kind: 'tower', x0: 151, y0: 102, x1: 155, y1: 106, door: [153, 106], floor: 'cobble', wall: 'wall_stone', roof: null },
    { id: 'house1', name: 'Ivy Cottage', kind: 'house', x0: 145, y0: 103, x1: 149, y1: 107, door: [147, 107], floor: 'wood', wall: 'wall_wood', roof: 'roof' },
    { id: 'house2', name: 'Millstone House', kind: 'house', x0: 124, y0: 137, x1: 130, y1: 141, door: [130, 139], floor: 'wood', wall: 'wall_wood', roof: 'roof_shingle' },
    { id: 'house3', name: 'Lantern Lodge', kind: 'house', x0: 151, y0: 141, x1: 155, y1: 145, door: [153, 141], floor: 'wood', wall: 'wall_wood', roof: 'roof' },
    { id: 'house4', name: 'Riverside Cottage', kind: 'house', x0: 113, y0: 136, x1: 118, y1: 140, door: [118, 138], floor: 'wood', wall: 'wall_wood', roof: 'roof_thatch' },
    { id: 'house5', name: 'Bell Cottage', kind: 'house', x0: 126, y0: 103, x1: 130, y1: 107, door: [128, 107], floor: 'wood', wall: 'wall_stone', roof: 'roof' },
    { id: 'house6', name: 'Thatch End', kind: 'house', x0: 145, y0: 109, x1: 149, y1: 112, door: [145, 111], floor: 'wood', wall: 'wall_wood', roof: 'roof_thatch' },
  ],
  houses: { house1: 400, house2: 500, house3: 300, house4: 350, house5: 400, house6: 300 },
  // Fenced gardens: vegetable rows (crops on farmland) or flower beds; gate: the gap in the fence.
  gardens: [
    { x0: 126, y0: 109, x1: 130, y1: 112, kind: 'crops', gate: [128, 112] },
    { x0: 113, y0: 122, x1: 118, y1: 122, kind: 'flowers' },
    { x0: 122, y0: 127, x1: 126, y1: 133, kind: 'crops', gate: [124, 127] },
    { x0: 140, y0: 143, x1: 143, y1: 145, kind: 'flowers', gate: [140, 143] },
  ],
  // The training yard: a fenced sandy yard with dummies.
  yard: { x0: 112, y0: 142, x1: 125, y1: 146, gate: [119, 142] },
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

  buildTown(m, S);

  // ---- where you start: in the temple ------------------------------------------------------------
  m.start = { x: OAKVALE.start.x, y: OAKVALE.start.y, z: S };
  m.mainStart = { ...m.start };
  const xs = d.coast.map(p => p[0]), ys = d.coast.map(p => p[1]);
  m.isle = { x0: Math.min(...xs) - 4, y0: Math.min(...ys) - 4, x1: Math.max(...xs) + 4, y1: Math.max(...ys) + 4 };
  return m;
}

// Builds Oakvale (see OAKVALE): wall, streets, buildings with their insides, roofs and signs, and
// the square, yards and gardens between them.
function buildTown(m, S) {
  const T = OAKVALE, put = (x, y, z, id) => m.addItem(x, y, z, id);
  const fill = (x0, y0, x1, y1, z, ground) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.set(x, y, z, { ground, items: [] }); };
  const free = (x, y, z = S) => { const t = m.get(x, y, z); return !!t && !t.items.length && !THINGS[t.ground].block; };
  const sign = (x, y, z, id, text) => { put(x, y, z, id); m.setMeta(x, y, z, { text }); };
  const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 / 1000;

  // The ground inside the wall: grass, cleared of the wilds.
  const w = T.wall;
  fill(w.x0, w.y0, w.x1, w.y1, S, 'grass');
  for (let z = S + 1; z < m.depth; z++) for (let y = w.y0; y <= w.y1; y++) for (let x = w.x0; x <= w.x1; x++) m.set(x, y, z, null);

  // The town wall, with its gates (a lamp either side) and signposts outside them.
  for (let y = w.y0; y <= w.y1; y++) for (let x = w.x0; x <= w.x1; x++) {
    if (x !== w.x0 && x !== w.x1 && y !== w.y0 && y !== w.y1) continue;
    if (T.gates.some(([gx0, gy0, gx1, gy1]) => x >= gx0 && x <= gx1 && y >= gy0 && y <= gy1)) { m.setGround(x, y, S, 'cobble'); continue; }
    put(x, y, S, 'wall_stone');
  }

  // Streets and the square round the temple.
  for (const [x0, y0, x1, y1, ground] of T.streets) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.setGround(x, y, S, ground);

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
      sign(sx, sy, S, 'sign_wall', b.sign);
    }
    if (m.get(...out, S).ground === 'grass') m.setGround(...out, S, 'gravel');
    if (b.kind !== 'temple' && b.kind !== 'depot' && b.kind !== 'tower') for (let z = S; z < S + floors; z++) for (const [x0, y0, x1, y1] of partsOf(b)) m.zones.push({ x0, y0, x1, y1, z, shelter: true });
  };
  for (const b of T.buildings) building(b);
  const B = Object.fromEntries(T.buildings.map(b => [b.id, b]));
  const inside = (b, x, y, id, z = S) => { if (free(x, y, z) && !(x === b.door[0] && Math.abs(y - b.door[1]) <= 1) && !(y === b.door[1] && Math.abs(x - b.door[0]) <= 1)) put(x, y, z, id); };

  // ---- the temple: an aisle of carpet up to the altar, pillars, benches, torches ----------------
  {
    const t = B.temple, cx = (t.x0 + t.x1) >> 1;
    for (let y = t.y0 + 2; y < t.y1; y++) m.setGround(cx, y, S, 'carpet');
    put(cx, t.y0 + 1, S, 'altar');
    for (const x of [cx - 2, cx + 2]) put(x, t.y0 + 1, S, 'torch');
    put(cx - 4, t.y0, S, 'banner'); put(cx + 4, t.y0, S, 'banner');
    for (const y of [t.y0 + 2, t.y0 + 9]) for (const x of [cx - 3, cx + 3]) put(x, y, S, 'pillar');
    for (const y of [t.y0 + 8, t.y0 + 10]) for (const x of [cx - 3, cx - 2, cx + 2, cx + 3]) put(x, y, S, 'bench');
    for (const [x, y] of [[t.x0 + 1, t.y0 + 1], [t.x1 - 1, t.y0 + 1], [t.x0 + 1, t.y1 - 1], [t.x1 - 1, t.y1 - 1]]) put(x, y, S, 'plant');
    const [wx0, , wx1] = t.wings[0];
    put(wx0 + 1, 121, S, 'statue'); put(wx1 - 1, 121, S, 'statue'); // in the side chapels
    put(wx0 + 1, 123, S, 'torch'); put(wx1 - 1, 123, S, 'torch');
    for (const y of [t.y0 + 1, t.y1 - 2]) { put(t.x0, y, S, 'wall_torch'); put(t.x1, y, S, 'wall_torch'); }
    sign(cx + 1, t.y1, S, 'sign_wall', 'Temple of the Dawn. All who wake on Oakvale Isle wake here.');
    m.temples.push({ home: 'oakvale', town: 'Oakvale', npc: null, x: T.start.x, y: T.start.y, z: S });
  }

  // ---- the academy: a classroom below, the oracle's hall upstairs -------------------------------------
  {
    const a = B.academy;
    for (let x = a.x0 + 2; x <= a.x1 - 2; x += 2) put(x, a.y0 + 1, S, 'bookshelf');
    for (const y of [a.y0 + 3, a.y0 + 5]) for (let x = a.x0 + 4; x <= a.x1 - 3; x += 3) { put(x, y, S, 'table'); inside(a, x + 1, y, 'chair'); }
    put(a.x0 + 2, 112, S, 'bed'); put(a.x0 + 3, 112, S, 'chest'); // the teacher's room in the wing
    put(a.x0 + 1, a.y0 + 4, S, 'noticeboard'); m.setMeta(a.x0 + 1, a.y0 + 4, S, { text: 'Lessons every morning: fighting, magic, and how not to get eaten by rats.' });
    put(a.x1 - 1, a.y0 + 1, S, 'stairs_up');
    put(a.x1 - 1, a.y0 + 1, S + 1, 'stairs_down');
    const cx = (a.x0 + a.x1) >> 1;
    for (let y = a.y0 + 2; y < a.y1; y++) m.setGround(cx, y, S + 1, 'carpet');
    put(cx, a.y0 + 2, S + 1, 'obelisk');
    for (const x of [cx - 3, cx + 3]) put(x, a.y0 + 2, S + 1, 'torch');
    for (const x of [a.x0 + 2, a.x1 - 3]) put(x, a.y1 - 1, S + 1, 'bookshelf');
    for (const y of [a.y0 + 5]) for (const x of [cx - 2, cx + 2]) put(x, y, S + 1, 'pillar');
    put(a.x0 + 2, a.y0 + 1, S + 1, 'banner');
  }

  // ---- the depot: lockers along the walls, a counter for the post -------------------------------------
  {
    const d = B.depot;
    for (let y = d.y0 + 1; y < d.y1; y += 2) put(d.x1 - 1, y, S, 'depot');
    for (let x = d.x0 + 2; x < d.x1 - 1; x += 2) put(x, d.y0 + 1, S, 'depot');
    for (let x = d.x0 + 2; x <= d.x0 + 4; x++) put(x, d.y1 - 2, S, 'counter');
    put(d.x0 + 1, d.y1 - 1, S, 'plant');
    sign(d.x0, d.door[1] + 1, S, 'sign_wall', 'Depot and post. Your locker keeps your things safe in every town.');
  }

  // ---- shops: a counter across the back, goods on shelves and in barrels -------------------------------
  const shop = (b, goods) => {
    const back = b.door[1] === b.y1 ? b.y0 + 1 : b.door[1] === b.y0 ? b.y1 - 1 : null;
    if (back !== null) { // door in the front (north or south) wall: the counter runs across
      const cy = back + (back === b.y0 + 1 ? 1 : -1);
      for (let x = b.x0 + 1; x < b.x1; x++) if (x !== b.x0 + 1) inside(b, x, cy, 'counter');
      for (let x = b.x0 + 1; x < b.x1; x++) inside(b, x, back, goods[(x - b.x0) % goods.length]);
    } else { // door in a side wall: the counter runs along the far side
      const back = b.door[0] === b.x0 ? b.x1 - 1 : b.x0 + 1, cx = back + (back === b.x0 + 1 ? 1 : -1);
      for (let y = b.y0 + 1; y < b.y1; y++) if (y !== b.y0 + 1) inside(b, cx, y, 'counter');
      for (let y = b.y0 + 1; y < b.y1; y++) inside(b, back, y, goods[(y - b.y0) % goods.length]);
    }
    inside(b, b.door[0] === b.x0 ? b.x0 + 1 : b.x1 - 1, b.door[1] === b.y1 ? b.y1 - 1 : b.y0 + 1, 'plant');
  };
  shop(B.magic, ['bookshelf', 'crate', 'bookshelf']);
  shop(B.armour, ['crate', 'barrel', 'crate']);
  shop(B.general, ['barrel', 'crate', 'sack']);
  shop(B.bakery, ['basket', 'barrel', 'sack']);

  // ---- the smithy: a forge and an anvil, and racks of goods ---------------------------------------------
  {
    const s = B.smith;
    put(s.x0 + 1, s.y1 - 1, S, 'campfire'); put(s.x0 + 2, s.y1 - 1, S, 'anvil');
    for (let x = s.x0 + 4; x < s.x1; x++) inside(s, x, s.y1 - 1, x % 2 ? 'crate' : 'barrel');
    for (let x = s.x0 + 4; x < s.x1; x++) inside(s, x, s.y1 - 3, 'counter');
    put(s.x1 - 1, s.y0 + 1, S, 'woodpile');
  }

  // ---- the inn: the taproom below, rooms upstairs --------------------------------------------------------
  {
    const n = B.inn;
    for (let x = n.x0 + 1; x <= n.x0 + 4; x++) inside(n, x, n.y1 - 2, 'counter');
    for (let x = n.x0 + 1; x <= n.x0 + 4; x++) inside(n, x, n.y1 - 1, 'barrel');
    put(n.x1 - 1, n.y1 - 1, S, 'campfire');
    for (const [x, y] of [[n.x0 + 7, n.y0 + 2], [n.x0 + 7, n.y0 + 5], [n.x0 + 3, n.y0 + 3]]) { put(x, y, S, 'table'); inside(n, x - 1, y, 'chair'); inside(n, x + 1, y, 'chair'); }
    put(n.x1 - 1, n.y0 + 1, S, 'stairs_up');
    put(n.x1 - 1, n.y0 + 1, S + 1, 'stairs_down');
    // three rooms off a corridor along the north wall
    const cy = n.y0 + 2;
    for (let x = n.x0 + 1; x < n.x1; x++) put(x, cy + 1, S + 1, 'wall_wood');
    for (const rx of [n.x0 + 3, n.x0 + 6]) for (let y = cy + 2; y < n.y1; y++) put(rx, y, S + 1, 'wall_wood');
    for (const [x0, x1] of [[n.x0 + 1, n.x0 + 2], [n.x0 + 4, n.x0 + 5], [n.x0 + 7, n.x1 - 1]]) {
      const door = x0 + 1;
      m.ensure(door, cy + 1, S + 1).items = ['door'];
      put(x0, n.y1 - 1, S + 1, 'bed');
      if (x1 > x0 + 1) put(x1, n.y1 - 1, S + 1, 'chest');
    }
    put(n.x0 + 1, n.y0 + 1, S + 1, 'plant');
  }

  // ---- the watchtower: a ladder up to the lookout on top ---------------------------------------------------
  {
    const t = B.tower, cx = (t.x0 + t.x1) >> 1, cy = (t.y0 + t.y1) >> 1;
    put(cx, cy - 1, S, 'ladder');
    put(t.x0 + 1, t.y0 + 1, S, 'barrel'); put(t.x1 - 1, t.y0 + 1, S, 'crate');
    fill(t.x0, t.y0, t.x1, t.y1, S + 1, 'wood');
    for (let y = t.y0; y <= t.y1; y++) for (let x = t.x0; x <= t.x1; x++) if (x === t.x0 || x === t.x1 || y === t.y0 || y === t.y1) put(x, y, S + 1, 'wall_stone');
    put(cx, cy - 1, S + 1, 'trapdoor');
    put(t.x1 - 1, t.y1 - 1, S + 1, 'flagpole');
  }

  // ---- houses: a bed, a table, a chest; rentable ---------------------------------------------------------------
  for (const [id, rent] of Object.entries(T.houses)) {
    const h = B[id];
    inside(h, h.x0 + 1, h.y0 + 1, 'bed');
    inside(h, h.x1 - 1, h.y0 + 1, 'chest');
    const tx = (h.x0 + h.x1) >> 1, ty = (h.y0 + h.y1 + 1) >> 1;
    inside(h, tx, ty, 'table'); inside(h, tx + 1, ty, 'chair');
    inside(h, h.x0 + 1, h.y1 - 1, 'plant');
    m.houses.push({ id: `oak_${id}`, name: h.name, rent, x0: h.x0, y0: h.y0, x1: h.x1, y1: h.y1, z: S });
  }

  // ---- the training yard: sand, a fence round it, dummies -------------------------------------------------
  {
    const y = T.yard;
    for (let yy = y.y0; yy <= y.y1; yy++) for (let xx = y.x0; xx <= y.x1; xx++) {
      m.setGround(xx, yy, S, 'sand');
      const edge = xx === y.x0 || xx === y.x1 || yy === y.y0;
      if (edge && !(xx === y.gate[0] && yy === y.gate[1])) put(xx, yy, S, 'fence');
    }
    for (let xx = y.x0 + 2; xx <= y.x1 - 2; xx += 3) put(xx, y.y1 - 1, S, 'dummy');
    put(y.x0 + 1, y.y0 + 1, S, 'barrel'); put(y.x1 - 1, y.y0 + 1, S, 'crate');
    sign(y.gate[0] + 1, y.y0 - 1, S, 'signpost', 'Training yard. Hit the dummies, not each other.');
  }

  // ---- the square: a fountain, lamps, benches, flower boxes, a noticeboard ---------------------------------
  {
    put(127, 132, S, 'fountain_rim'); put(128, 132, S, 'fountain_rim'); put(127, 133, S, 'fountain_rim'); put(128, 133, S, 'fountain');
    put(139, 133, S, 'statue');
    for (const [x, y] of [[123, 114], [143, 114], [123, 134], [143, 134], [131, 102], [135, 102], [131, 146], [135, 146], [111, 122], [111, 126], [155, 122], [155, 126]]) put(x, y, S, 'lamppost');
    for (const [x, y] of [[124, 120], [124, 126], [142, 120], [142, 126]]) put(x, y, S, 'bench');
    for (const [x, y] of [[129, 130], [137, 130], [126, 114], [140, 114]]) put(x, y, S, 'planter');
    sign(131, 130, S, 'noticeboard', 'NOTICE: Rats in the cellars again! Brave helpers, ask in town.');
  }

  // ---- gardens and yards between the buildings: trees, hedges, flower beds, a well, a woodpile ------------
  const occupied = (x, y) => T.buildings.some(b => partsOf(b).some(([x0, y0, x1, y1]) => x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 1 && y <= y1 + 1))
    || T.gardens.some(gd => x >= gd.x0 - 1 && x <= gd.x1 + 1 && y >= gd.y0 - 1 && y <= gd.y1 + 1);
  const nearStreet = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const g = m.get(x + dx, y + dy, S).ground; return g === 'cobble' || g === 'paving' || g === 'gravel'; });
  for (let y = w.y0 + 1; y < w.y1; y++) for (let x = w.x0 + 1; x < w.x1; x++) {
    const t = m.get(x, y, S);
    if (t.ground !== 'grass' || t.items.length || occupied(x, y) || nearStreet(x, y)) continue;
    const v = hash(x, y), byWall = x === w.x0 + 1 || x === w.x1 - 1 || y === w.y0 + 1 || y === w.y1 - 1;
    if (byWall && v < 0.35) put(x, y, S, v < 0.2 ? 'tree' : 'bush');
    else if (v < 0.07) put(x, y, S, 'tree');
    else if (v < 0.1) put(x, y, S, 'bush');
    else if (v < 0.17) put(x, y, S, 'flowers');
    else if (v < 0.2) put(x, y, S, 'grass_tuft');
  }
  // Fenced gardens.
  for (const gd of T.gardens) for (let y = gd.y0; y <= gd.y1; y++) for (let x = gd.x0; x <= gd.x1; x++) {
    const t = m.get(x, y, S), edge = x === gd.x0 || x === gd.x1 || y === gd.y0 || y === gd.y1;
    t.items = [];
    if (gd.kind === 'crops') { t.ground = edge ? 'grass' : 'farmland'; if (!edge && y % 2) put(x, y, S, 'crops'); }
    else if (!edge || gd.y0 === gd.y1) put(x, y, S, (x + y) % 3 ? 'flowers' : 'bush');
    if (edge && gd.gate && gd.y0 !== gd.y1 && !(x === gd.gate[0] && y === gd.gate[1])) { t.items = []; put(x, y, S, 'fence'); }
  }
  put(131, 104, S, 'well'); put(144, 113, S, 'woodpile'); put(150, 108, S, 'haystack'); put(150, 109, S, 'barrel');
  put(121, 134, S, 'woodpile'); put(122, 129, S, 'barrel'); put(122, 130, S, 'crate'); put(143, 136, S, 'wagon');
  put(144, 141, S, 'barrel'); put(143, 139, S, 'crate'); put(150, 113, S, 'scarecrow');
  // Paths of gravel from the streets to the doors that don't open onto one.
  const path = (pts) => { for (let i = 0; i + 1 < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) {
      const t = m.get(x, y, S); if (t.ground === 'grass') { t.ground = 'gravel'; t.items = t.items.filter(id => !THINGS[id].block); } } } };
  path([[121, 110], [121, 113], [131, 113]]);             // academy to the north street
  path([[120, 118], [122, 118]]);                         // magic shop to the square
  path([[135, 106], [131, 106]]);                         // depot from the north street
  path([[128, 108], [128, 108]]);                         // Bell Cottage
  path([[147, 108], [147, 108]]); path([[144, 111], [144, 113], [135, 113]]); // Ivy Cottage, Thatch End
  path([[150, 122], [150, 122]]);                         // armourer
  path([[146, 136], [146, 139]]);                         // bakery
  path([[153, 139], [153, 140], [150, 140], [150, 136]]); // Lantern Lodge
  path([[131, 139], [131, 139]]);                         // Millstone House
  path([[119, 138], [121, 138], [121, 135]]);             // Riverside Cottage
  path([[119, 141], [121, 141]]);                         // the training yard
  path([[153, 107], [153, 113], [150, 113]]);             // the watchtower
  for (const b of T.buildings) { const [dx, dy] = b.door; for (const [x, y] of [[dx + 1, dy], [dx - 1, dy], [dx, dy + 1], [dx, dy - 1]]) {
    const t = m.get(x, y, S); if (t && !t.items.some(id => THINGS[id].wall) && t.items.some(id => THINGS[id].block) && !(x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1)) t.items = []; } }

  // Signposts outside the gates.
  sign(131, 99, S, 'signpost', 'North: the North Peaks and Mirror Lake. South: Oakvale.');
  sign(131, 149, S, 'signpost', 'South: Sunny Fields, Bone Rocks and Lighthouse Point. North: Oakvale.');
  sign(108, 121, S, 'signpost', 'West: Willow River, Frog Marsh and Wolf Woods. East: Oakvale.');
  sign(158, 121, S, 'signpost', 'East: Deer Woods, the Old Tower and the Spider Hills. West: Oakvale.');
}
