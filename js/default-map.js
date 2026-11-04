'use strict';
// The built-in world: Thistlewick Isle, a hand-designed starter island in the classic
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
const MAP_TOWNS = [['Thistlewick', 119, 129, 8]];
const MAP_SIGHTS = [
  ['Glassmere', 130, 72, 8], ['Highmoor', 92, 76, 9], ['Highmoor summit', 90, 64, 10], ['Old Pinewood', 62, 106, 8], ['Eastwood', 186, 120, 8],
  ['Watch Hill', 197, 110, 9], ['Cragend', 200, 181, 9], ['Bramble Marsh', 92, 194, 8], ['Gull Point', 58, 230, 8],
  ['Seal Bay', 186, 76, 8], ['Southfields', 122, 170, 8], ['Saltreed (fishing hamlet)', 52, 150, 8], ['Gannet Rock', 233, 213, 8],
];

// The island as drawn. Outlines are [x, y] corners in order; lines are [x, y] points along them.
const ISLE_DESIGN = {
  coast: [
    [95, 30], [115, 24], [140, 26], [160, 32], [172, 30], [182, 38], // north coast
    [186, 52], [176, 60], [172, 70], [180, 78], [194, 74], [206, 70], [216, 78], [220, 92], // around Seal Bay
    [224, 108], [218, 124], [222, 140], [216, 158], [208, 172], // east coast
    [214, 186], [210, 200], [196, 208], [182, 206], // Cragend headland
    [170, 212], [152, 216], [134, 214], [118, 220], [104, 216], // south coast
    [92, 222], [78, 232], [62, 238], [50, 234], [54, 224], [70, 212], [80, 200], // Gull Point and Gull Cove
    [74, 186], [60, 178], [46, 166], [40, 150], [44, 132], [38, 116], [42, 98], [52, 84], [60, 68], [72, 52], [84, 38], // west coast
  ],
  islets: [
    [[224, 206], [236, 202], [244, 210], [240, 222], [228, 224], [222, 216]], // Gannet Rock
  ],
  // Rocky shores: rocky ground and boulders instead of a beach
  rocky: [
    [[60, 40], [100, 22], [116, 22], [112, 40], [76, 52], [56, 62]], // under Highmoor
    [[204, 160], [228, 160], [228, 212], [196, 214], [204, 196]],    // around Cragend
    [[218, 196], [250, 196], [250, 230], [218, 230]],                // Gannet Rock
  ],
  town: { x0: 98, y0: 112, x1: 140, y1: 146 }, // Thistlewick: kept clear for its walls (phase 3)
  hamlet: { x0: 46, y0: 142, x1: 60, y1: 158 }, // Saltreed: kept clear for the fishing huts
  lakes: [
    [[120, 50], [134, 46], [146, 52], [148, 62], [138, 70], [124, 68], [116, 60]], // Glassmere
    [[176, 132], [182, 130], [186, 136], [180, 140], [175, 138]],                  // a pond in Eastwood
  ],
  rivers: [
    { name: 'the Wick', width: 3, line: [[138, 66], [139, 82], [146, 96], [150, 110], [152, 124], [150, 138], [154, 152], [164, 166], [176, 180], [182, 196], [185, 212]] },
    { name: 'Bramble Creek', width: 2, line: [[90, 196], [82, 199], [76, 203], [70, 209]] },
  ],
  // Mountains: cliffs on the surface, the top one floor up; a summit is a second step up.
  // ramps: the columns of the mountain paths up, on the south side.
  mountains: [
    { name: 'Highmoor', outline: [[74, 58], [88, 48], [104, 52], [108, 66], [100, 80], [84, 84], [74, 74]], ramps: [90],
      summit: { outline: [[84, 58], [94, 56], [98, 66], [90, 72], [82, 68]], ramps: [90] } },
    { name: 'Watch Hill', outline: [[188, 104], [200, 100], [206, 108], [202, 118], [190, 118]], ramps: [196] },
    { name: 'Cragend', outline: [[190, 170], [206, 172], [210, 186], [200, 192], [190, 188]], ramps: [199] },
  ],
  // Forests: kind (which trees), density (0-1), outline
  forests: [
    { name: 'Old Pinewood', kind: 'pine', density: 0.42, outline: [[44, 100], [60, 86], [70, 90], [78, 100], [84, 112], [72, 124], [56, 128], [46, 118]] },
    { name: 'Eastwood', kind: 'oak', density: 0.34, outline: [[164, 96], [188, 88], [206, 98], [212, 124], [204, 148], [180, 152], [166, 138], [162, 116]] },
    { name: 'Northwood', kind: 'mixed', density: 0.3, outline: [[150, 38], [170, 36], [178, 52], [166, 64], [150, 58]] },
    { name: 'Hollow Copse', kind: 'oak', density: 0.28, outline: [[70, 150], [84, 146], [90, 158], [80, 168], [68, 162]] },
    { name: 'Riverside thicket', kind: 'mixed', density: 0.22, outline: [[156, 140], [164, 136], [170, 150], [162, 156]] },
    { name: 'Southfield grove', kind: 'oak', density: 0.25, outline: [[140, 186], [156, 182], [160, 196], [146, 202]] },
  ],
  marshes: [
    { name: 'Bramble Marsh', outline: [[82, 180], [98, 178], [104, 192], [100, 206], [86, 210], [80, 196]] },
  ],
  meadows: [ // flowery meadows (no trees)
    { name: 'Southfields', outline: [[104, 156], [138, 156], [142, 182], [106, 186]] },
    { name: 'Lakeside meadow', outline: [[112, 72], [136, 72], [136, 90], [112, 92]] },
  ],
  // Roads (2 wide) and paths (1 wide); where they cross water they become bridges.
  roads: [
    { name: 'North road', width: 2, line: [[119, 112], [119, 96], [122, 84], [128, 74]] },
    { name: 'East road', width: 2, line: [[140, 129], [152, 129], [164, 128], [180, 124], [196, 121], [196, 119]] },
    { name: 'South road', width: 2, line: [[119, 146], [119, 170], [120, 196], [124, 214]] },
    { name: 'Cragend road', width: 2, line: [[119, 160], [140, 160], [160, 160], [176, 166], [186, 180], [192, 194], [199, 194], [199, 191]] },
    { name: 'West road', width: 2, line: [[98, 129], [84, 130], [68, 136], [58, 144], [54, 148]] },
  ],
  paths: [
    { name: 'Highmoor path', line: [[119, 96], [104, 90], [90, 86], [90, 82]] },
    { name: 'Northwood path', line: [[122, 84], [136, 80], [150, 72], [160, 56]] },
    { name: 'Seal Bay path', line: [[160, 56], [170, 66], [178, 74], [186, 76]] },
    { name: 'Marsh path', line: [[119, 176], [104, 186], [94, 190]] },
    { name: 'Gull Point path', line: [[94, 190], [88, 202], [80, 214], [70, 222], [60, 230]] },
    { name: 'Pinewood path', line: [[68, 136], [64, 124], [62, 110], [60, 96]] },
    { name: 'Copse path', line: [[84, 130], [80, 146], [78, 158]] },
  ],
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
  // Distance from a tile's middle to a line of points, and the segment nearest it.
  const lineDistance = (line, x, y) => {
    let best = Infinity, seg = 0;
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, ay] = line[i], [bx, by] = line[i + 1], vx = bx - ax, vy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1)));
      const dist = Math.hypot(x - (ax + t * vx), y - (ay + t * vy));
      if (dist < best) { best = dist; seg = i; }
    }
    return { dist: best, seg };
  };
  const lineBox = (line, pad) => box(line).map((v, i) => (i < 2 ? Math.max(0, v - pad) : Math.min(i === 2 ? W - 1 : H - 1, v + pad)));

  const at = (x, y, z = S) => m.get(x, y, z);
  const ground = (x, y, z = S) => (at(x, y, z) || {}).ground;
  const put = (x, y, z, id) => m.addItem(x, y, z, id);
  const inRect = (r, x, y, pad = 0) => x >= r.x0 - pad && x <= r.x1 + pad && y >= r.y0 - pad && y <= r.y1 + pad;
  const keep = new Uint8Array(W * H); // no trees or clutter here: town, hamlet, roads, ramps

  // ---- the sea, and the land in it ----------------------------------------------------
  // Every surface tile is set: water around the island, land on it.
  const land = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const isLand = insideRough(d.coast, x, y, 2, 11) || d.islets.some(p => insideRough(p, x, y, 1.5, 12));
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
    if (inRect(d.town, x, y, 3) || inRect(d.hamlet, x, y, 1)) keep[y * W + x] = 1;
  }

  // ---- marshes, meadows, lakes, rivers ------------------------------------------------
  for (const marsh of d.marshes) eachIn(marsh.outline, (x, y) => {
    if (ground(x, y) === 'grass' && insideRough(marsh.outline, x, y, 2, 31)) {
      // pools of open water in the reeds
      m.setGround(x, y, S, noise(x, y, 4, 32) > 0.72 ? 'water' : 'swamp');
    }
  });
  const meadow = new Uint8Array(W * H);
  for (const field of d.meadows) eachIn(field.outline, (x, y) => { if (insideRough(field.outline, x, y, 2, 41)) meadow[y * W + x] = 1; });
  for (const lake of d.lakes) eachIn(lake, (x, y) => { if (land[y * W + x] && insideRough(lake, x, y, 1.5, 51)) m.setGround(x, y, S, 'water'); });
  for (const river of d.rivers) {
    const [x0, y0, x1, y1] = lineBox(river.line, river.width);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (lineDistance(river.line, x + 0.5, y + 0.5).dist <= river.width / 2) m.setGround(x, y, S, 'water');
    }
  }

  // ---- mountains --------------------------------------------------------------------
  // Tiles of an outline, without lone tiles sticking out (they'd look like pillars).
  const shape = (outline, seed) => {
    const raw = new Set(), set = new Set();
    eachIn(outline, (x, y) => { if (insideRough(outline, x, y, 1, seed)) raw.add(y * W + x); });
    for (const i of raw) if ([1, -1, W, -W].filter(o => raw.has(i + o)).length >= 3) set.add(i);
    return set;
  };
  // The south edge tile of a shape in column x, if the edge is straight there.
  const southEdge = (set, x) => {
    let y = -1;
    for (const i of set) if (i % W === x) y = Math.max(y, Math.floor(i / W));
    return y;
  };
  // A path up: a ramp on the lowest cliff of column x (or the nearest column whose
  // neighbours are as low), with its top on the floor above.
  const ramp = (set, z, x0) => {
    const tries = [0, 1, -1, 2, -2, 3, -3].map(o => x0 + o);
    const x = tries.find(x => { const y = southEdge(set, x); return y >= 0 && southEdge(set, x - 1) === y && southEdge(set, x + 1) === y; }) ?? x0;
    const y = southEdge(set, x);
    m.ensure(x, y, z).items = ['ramp'];
    m.setGround(x, y, z + 1, 'ramp_top');
    for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) if (m.inBounds(x + dx, y + dy, S)) keep[(y + dy) * W + x + dx] = 1;
    return { x, y };
  };
  const plateau = (set, z, top) => {
    for (const i of set) {
      const x = i % W, y = (i - x) / W;
      m.set(x, y, z, { ground: z === S ? 'mountain' : top, items: ['cliff'] });
      const grassy = noise(x, y, 4, 61) > 0.62;
      m.set(x, y, z + 1, { ground: grassy ? 'grass' : 'mountain', items: [] });
    }
  };
  const ramps = []; // { x, y, z } of every mountain path
  for (const mount of d.mountains) {
    const base = shape(mount.outline, 71);
    plateau(base, S, 'mountain');
    for (const x of mount.ramps) ramps.push({ ...ramp(base, S, x), z: S });
    if (mount.summit) {
      // The summit stands back at least two tiles from the edge below, so there's a ledge to walk on.
      const ledge = i => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!base.has(i + dy * W + dx)) return false; return true; };
      const top = new Set([...shape(mount.summit.outline, 72)].filter(ledge));
      plateau(top, S + 1, 'mountain');
      for (const x of mount.summit.ramps) ramps.push({ ...ramp(top, S + 1, x), z: S + 1 });
    }
    // Boulders on the mountain top, not on the paths
    for (const i of base) {
      const x = i % W, y = (i - x) / W, t = at(x, y, S + 1);
      const nearRamp = ramps.some(r => Math.abs(r.x - x) <= 1 && Math.abs(r.y - y) <= 2);
      if (t && !t.items.length && t.ground !== 'ramp_top' && !nearRamp && hash(x, y, 73) < 0.05) put(x, y, S + 1, 'rock');
    }
  }

  // ---- roads, paths and bridges ------------------------------------------------------------
  const paint = (line, width, isPath) => {
    const reach = isPath ? 0.8 : width / 2 + 0.15; // wide enough that slanted lines stay joined
    const [x0, y0, x1, y1] = lineBox(line, width + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const { dist, seg } = lineDistance(line, x + 0.5, y + 0.5);
      if (dist <= reach + 1.5) keep[y * W + x] = 1;
      if (dist > reach) continue;
      const g = ground(x, y);
      if (g === 'water') {
        const [ax, ay] = line[seg], [bx, by] = line[seg + 1];
        m.setGround(x, y, S, Math.abs(bx - ax) >= Math.abs(by - ay) ? 'bridge_ew' : 'bridge_ns');
      } else if (['grass', 'sand', 'swamp', 'mountain'].includes(g) && !(at(x, y).items.includes('cliff'))) {
        m.setGround(x, y, S, 'dirt');
      }
    }
  };
  for (const road of d.roads) paint(road.line, road.width, false);
  for (const path of d.paths) paint(path.line, 1, true);

  // ---- forests -------------------------------------------------------------------------------
  const TREES = { pine: ['pine', 'pine', 'pine', 'tree'], oak: ['tree', 'tree', 'tree', 'pine'], mixed: ['tree', 'pine'] };
  const forest = new Uint8Array(W * H);
  const free = (x, y) => { const t = at(x, y); return t && !t.items.length && ['grass', 'sand'].includes(t.ground) && !keep[y * W + x]; };
  for (const f of d.forests) eachIn(f.outline, (x, y) => {
    if (!insideRough(f.outline, x, y, 2.5, 81)) return;
    forest[y * W + x] = 1;
    if (!free(x, y) || ground(x, y) === 'sand') return;
    // Thicker in the middle of a wood, with clearings here and there.
    const thick = f.density * (0.55 + noise(x, y, 6, 82) * 0.9);
    const v = hash(x, y, 83);
    if (v < thick) put(x, y, S, TREES[f.kind][Math.floor(hash(x, y, 84) * TREES[f.kind].length)]);
    else if (v < thick + 0.05) put(x, y, S, 'bush');
    else if (v < thick + 0.09) put(x, y, S, 'fern');
    else if (v < thick + 0.11) put(x, y, S, 'mushrooms');
  });

  // ---- the open land: lone trees, bushes, flowers, tall grass; reeds on the shores ---------------
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, t = at(x, y);
    if (!land[i] || !t || t.items.length || keep[i] || forest[i]) continue;
    const v = hash(x, y, 91);
    const byWater = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => ground(x + dx, y + dy) === 'water');
    if (t.ground === 'swamp') {
      if (v < 0.07) put(x, y, S, 'reeds');
      else if (v < 0.095) put(x, y, S, 'dead_tree');
      else if (v < 0.11) put(x, y, S, 'puddle');
    } else if (t.ground === 'grass') {
      if (byWater && v < 0.25) put(x, y, S, 'reeds');
      else if (meadow[i]) { if (v < 0.06) put(x, y, S, 'flowers'); else if (v < 0.1) put(x, y, S, 'tallgrass'); }
      else if (v < 0.012) put(x, y, S, 'tree');
      else if (v < 0.02) put(x, y, S, 'bush');
      else if (v < 0.035) put(x, y, S, 'tallgrass');
      else if (v < 0.045) put(x, y, S, 'flowers');
      else if (v < 0.049) put(x, y, S, 'rock');
    } else if (t.ground === 'mountain') {
      if (v < 0.12) put(x, y, S, 'rock');
    } else if (t.ground === 'sand' && v < 0.006) put(x, y, S, 'rock');
  }

  // ---- where you start: the middle of town (its temple comes in phase 3) ---------------------------
  m.start = { x: 119, y: 129, z: S };
  m.mainStart = { ...m.start };
  const xs = d.coast.map(p => p[0]), ys = d.coast.map(p => p[1]);
  m.isle = { x0: Math.min(...xs) - 4, y0: Math.min(...ys) - 4, x1: 250, y1: Math.max(...ys) + 4 };
  return m;
}
