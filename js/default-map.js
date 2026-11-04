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
const MAP_TOWNS = [['Thistlewick', 132, 119, 8]];
const MAP_SIGHTS = [
  ['Highmoor', 108, 58, 9], ['Highmoor summit', 104, 46, 10], ['Glassmere', 160, 88, 8], ['Old Pinewood', 46, 80, 8],
  ['Bramble Marsh', 44, 140, 8], ['Saltreed (fishing hamlet)', 36, 182, 8], ['Cragend', 70, 205, 9], ['Southfields', 124, 170, 8],
  ['Lantern Cape', 132, 226, 8], ['Webbed Hills', 192, 196, 9], ['Eastwood', 190, 145, 8], ['Watch Hill', 214, 122, 9],
  ['Redcap Hills (goblin camp)', 200, 76, 8], ['Hermit\'s Crag', 212, 52, 9], ['Stonefield', 86, 78, 8],
];

// The island as drawn. Outlines are [x, y] corners in order; lines are [x, y] points along them.
// Town in the middle, the river Wick along its west side; hunting grounds get harder the
// further they are from town: meadows and the lakeside first, then the woods and the marsh,
// then the hills and crags at the edges of the island.
const ISLE_DESIGN = {
  coast: [
    [36, 36], [48, 26], [66, 24], [78, 16], [96, 20], [112, 16], [130, 22], [146, 20], [156, 30], // north coast, under Highmoor
    [158, 42], [164, 50], [174, 50], [178, 40], [186, 30], [196, 22], // Kittiwake Bay
    [210, 18], [222, 26], [232, 24], [238, 38], [232, 50], [240, 62], // round Hermit's Crag
    [236, 76], [226, 84], [236, 96], [240, 110], [232, 120], [238, 134], [232, 146], // east coast
    [236, 158], [226, 164], [218, 170], [228, 178], [238, 186], // Hollow Brook's mouth
    [232, 200], [220, 212], [206, 220], [194, 214], [184, 222], [170, 224], [160, 216], [150, 222], // south-east
    [146, 232], [142, 244], [130, 246], [124, 236], [118, 224], // Lantern Cape
    [110, 214], [102, 206], [94, 212], [90, 224], [76, 232], [60, 234], // Gull Cove
    [46, 228], [34, 220], [28, 206], [32, 192], [22, 180], // round Cragend
    [14, 174], [22, 166], [18, 156], // the Wick's mouth
    [24, 146], [16, 134], [22, 122], [14, 110], [20, 98], [12, 86], [20, 74], [16, 60], [26, 48], // west coast
  ],
  islets: [],
  // Rocky shores: rocky ground and boulders (some out in the shallows) instead of a beach
  rocky: [
    [[50, 10], [160, 10], [160, 36], [140, 40], [100, 34], [56, 40]],  // under Highmoor
    [[196, 14], [246, 14], [246, 70], [214, 70], [196, 40]],           // Hermit's Crag
    [[18, 196], [60, 196], [96, 214], [96, 244], [18, 244]],          // round Cragend
    [[114, 222], [150, 222], [150, 248], [114, 248]],                  // Lantern Cape
  ],
  town: { x0: 112, y0: 98, x1: 152, y1: 140 },  // Thistlewick: kept clear for its walls and streets (phase 3)
  clearings: [ // kept clear for buildings and camps (phase 4)
    { name: 'Saltreed', x0: 34, y0: 174, x1: 48, y1: 190 },
    { name: 'Southfields farm', x0: 108, y0: 156, x1: 124, y1: 168 },
    { name: 'Lantern Cape lighthouse', x0: 126, y0: 226, x1: 136, y1: 234 },
    { name: 'Redcap camp', x0: 192, y0: 68, x1: 208, y1: 84 },
    { name: 'Lumber camp', x0: 60, y0: 98, x1: 70, y1: 106 },
  ],
  lakes: [
    [[152, 60], [168, 56], [178, 64], [178, 78], [166, 86], [152, 82], [148, 70]], // Glassmere
    [[76, 126], [86, 124], [88, 132], [80, 136], [74, 132]],                      // Frog Pond
    [[116, 178], [124, 176], [126, 184], [118, 186]],                             // a pond in Southfields
    [[190, 128], [198, 126], [200, 134], [192, 136]],                             // a pond in Eastwood
  ],
  rivers: [
    { name: 'the Wick', width: 3, line: [[153, 79], [140, 86], [128, 91], [112, 97], [105, 108], [105, 122], [102, 136], [94, 150], [80, 160], [60, 166], [40, 170], [12, 174]] },
    { name: 'Hollow Brook', width: 2, line: [[198, 134], [206, 150], [214, 162], [224, 168]] },
  ],
  // Mountains: cliffs on the surface, the top one floor up; a summit is a second step up.
  // ramps: the columns of the mountain paths up, on the south side.
  mountains: [
    { name: 'Highmoor', outline: [[58, 34], [80, 28], [110, 30], [140, 34], [150, 46], [142, 60], [120, 64], [96, 62], [74, 60], [58, 52]], ramps: [80, 108],
      summit: { outline: [[86, 38], [110, 36], [126, 42], [118, 52], [92, 52]], ramps: [104] } },
    { name: 'Cragend', outline: [[50, 186], [70, 180], [86, 188], [88, 206], [72, 216], [54, 208]], ramps: [70] },
    { name: 'Webbed Hills', outline: [[176, 172], [196, 166], [214, 176], [212, 196], [194, 204], [178, 194]], ramps: [192] },
    { name: "Hermit's Crag", outline: [[200, 36], [222, 40], [228, 56], [214, 62], [200, 54]], ramps: [212] },
    { name: 'Watch Hill', outline: [[204, 112], [216, 108], [224, 118], [216, 128], [204, 124]], ramps: [214] },
  ],
  // Rocky ground with boulders: walkable, open, stony
  stonefields: [
    { name: 'Stonefield', outline: [[76, 70], [92, 68], [96, 80], [84, 86], [74, 80]] },
    { name: 'Redcap Hills', outline: [[184, 62], [212, 60], [218, 84], [198, 92], [182, 80]] },
    { name: 'Cape rocks', outline: [[150, 196], [166, 192], [170, 206], [156, 210]] },
  ],
  // Forests: kind (which trees), density (0-1, the thickest part), outline. Trees grow in clumps
  // with glades between them, bushes and ferns round their edges.
  forests: [
    { name: 'Old Pinewood', kind: 'pine', density: 0.62, outline: [[26, 54], [50, 46], [64, 62], [72, 90], [64, 108], [40, 114], [26, 102], [24, 74]] },
    { name: 'Eastwood', kind: 'oak', density: 0.55, outline: [[166, 92], [204, 90], [226, 104], [228, 150], [212, 164], [180, 162], [164, 140], [160, 112]] },
    { name: 'Lakewood', kind: 'mixed', density: 0.45, outline: [[182, 46], [198, 42], [204, 56], [188, 60], [182, 56]] },
    { name: 'Riverside thicket', kind: 'mixed', density: 0.4, outline: [[88, 92], [100, 90], [104, 100], [92, 104]] },
    { name: 'Southfield grove', kind: 'oak', density: 0.42, outline: [[160, 150], [172, 148], [174, 160], [162, 162]] },
    { name: 'Willow Bend', kind: 'oak', density: 0.4, outline: [[64, 170], [80, 168], [86, 178], [68, 182]] },
    { name: 'Webfoot copse', kind: 'oak', density: 0.42, outline: [[156, 170], [170, 166], [172, 182], [158, 186]] },
    { name: 'Thornbrake', kind: 'mixed', density: 0.38, outline: [[92, 70], [104, 72], [106, 84], [96, 86]] },
    { name: 'Cove wood', kind: 'pine', density: 0.45, outline: [[60, 220], [76, 216], [84, 224], [66, 228]] },
  ],
  marshes: [
    { name: 'Bramble Marsh', outline: [[30, 122], [52, 118], [62, 132], [58, 156], [40, 162], [28, 150]] },
  ],
  meadows: [ // flowery meadows (no trees)
    { name: 'Southfields', outline: [[98, 150], [150, 150], [154, 186], [100, 190]] },
    { name: 'Lakeside meadow', outline: [[136, 66], [148, 64], [150, 96], [134, 100]] },
  ],
  // Roads (2 wide) and paths (1 wide); where they cross water they become bridges.
  roads: [
    { name: 'North road', width: 2, line: [[132, 98], [132, 86], [124, 76], [114, 68], [108, 66], [108, 64]] },
    { name: 'West road', width: 2, line: [[112, 119], [98, 119], [84, 116], [70, 112], [56, 116]] },
    { name: 'South road', width: 2, line: [[132, 140], [130, 166], [134, 196], [132, 224]] },
    { name: 'East road', width: 2, line: [[152, 119], [170, 118], [190, 120], [210, 121], [214, 126], [214, 129]] },
  ],
  paths: [
    { name: 'Stonefield path', line: [[70, 112], [74, 90], [80, 72], [80, 62]] },
    { name: 'Marsh path', line: [[56, 116], [46, 132], [40, 148]] },
    { name: 'Lake path', line: [[124, 76], [136, 74], [146, 86], [156, 90]] },
    { name: 'Redcap path', line: [[176, 118], [180, 100], [188, 90], [198, 86], [208, 72], [212, 64], [212, 63]] },
    { name: 'Webbed path', line: [[176, 118], [180, 140], [176, 160], [174, 184], [184, 208], [192, 207], [192, 205]] },
    { name: 'Cragend path', line: [[130, 166], [110, 172], [94, 176], [96, 200], [84, 218], [70, 218]] },
    { name: 'Saltreed path', line: [[94, 176], [70, 176], [48, 180], [40, 182]] },
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
  for (const river of d.rivers) {
    const [x0, y0, x1, y1] = lineBox(river.line, river.width);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (lineDistance(river.line, x + 0.5, y + 0.5).dist <= river.width / 2) m.setGround(x, y, S, 'water');
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
    const reach = isPath ? 0.95 : width / 2 + 0.15; // wide enough that slanted lines stay joined
    const [x0, y0, x1, y1] = lineBox(line, width + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const { dist, seg } = lineDistance(line, x + 0.5, y + 0.5);
      if (dist <= reach + 1.5) keep[y * W + x] = 1;
      if (dist > reach + (noise(x, y, 3, 99) - 0.5) * 0.5) continue; // a little wider here and there
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

  // ---- where you start: the middle of town (its temple comes in phase 3) ---------------------------
  m.start = { x: 132, y: 119, z: S };
  m.mainStart = { ...m.start };
  const xs = d.coast.map(p => p[0]), ys = d.coast.map(p => p[1]);
  m.isle = { x0: Math.min(...xs) - 4, y0: Math.min(...ys) - 4, x1: Math.max(...xs) + 4, y1: Math.max(...ys) + 4 };
  return m;
}
