'use strict';
// The new world, Kestrel Isle, built by hand (phase 1: Bellhaven, the home town). Played only as a preview for now
// (index.html?world=kestrel, or Menu: "Preview: the new world"): the built-in world stays Oakvale Isle until this is ready.
//
// Bellhaven is laid out on its own grid (KESTREL_TOWN, x 0-55, y 0-57) and set into the world at its corner. The plan:
// the temple and its bell tower on a low rock in the north of town, reached by a broad stair from the square below; a
// crooked Main Street down to the harbour; lanes of trodden earth; houses with yards between them, trees and bushes
// grown where nobody walks, and worn paths from every door to the street. Edges are never ruled straight: streets fray
// into the grass, the rock has a ragged rim. (tests/unit.test.js checks that every door and stair leads somewhere.)

const KESTREL_TOWN = {
  at: [100, 96], // its corner in the world
  // the wall's outline (right angles, many turns); the wall runs just inside it, a tower at every turn
  outline: [[8, 4], [40, 4], [40, 10], [47, 10], [47, 20], [52, 20], [52, 33], [47, 33], [47, 45], [42, 45], [42, 47], [12, 47], [12, 43], [6, 43], [6, 22], [8, 22]],
  gates: [[37, 2, 39, 5], [4, 30, 7, 32], [50, 25, 53, 27], [23, 45, 25, 48]], // north, west, east, harbour
  // the temple rock: a box, its rim made ragged; a stair up its south face
  rock: { box: [17, 5, 36, 15], steps: [24, 25, 26] },
  // the square under the rock: an oval of paving, frayed at its edge
  square: { cx: 25.5, cy: 19.5, rx: 9.5, ry: 3.6 },
  // streets: [x0, y0, x1, y1, ground] (their edges fray into the grass)
  streets: [
    [37, 2, 39, 15, 'dirt'], [36, 16, 39, 19, 'dirt'],                                  // North Street, round the rock to the square
    [24, 23, 26, 30, 'cobble'], [26, 30, 28, 36, 'cobble'], [23, 36, 25, 48, 'cobble'], // Main Street, in three jogs
    [4, 30, 25, 32, 'dirt'], [26, 25, 53, 27, 'dirt'],                                  // Cross Street, its two halves
    [13, 41, 23, 42, 'dirt'], [29, 34, 44, 35, 'dirt'],                                 // Rope Lane, Baker's Row
    [10, 48, 44, 49, 'paving'],                                                         // the quay
    [12, 16, 16, 22, 'dirt'],                                                           // the market corner west of the square
  ],
  river: [[0, 0, 3, 46], [0, 44, 7, 46]],
  bridges: [[0, 30, 3, 32]],
  piers: [[16, 50, 17, 56], [24, 50, 25, 56], [32, 50, 33, 56]],
  // buildings: outer walls (and wings: more boxes the building is made of), the door (in a wall), the floor it stands on
  // (level: 1 on the rock), how many floors, wall, floor and roof, and what's inside ([x, y, thing] in town coordinates).
  // up: stairs [x, y] from that floor to the next; down again from the tile east of it.
  buildings: [
    { name: 'Temple', box: [20, 7, 30, 13], wings: [[23, 5, 27, 7]], door: [25, 13], level: 1, wall: 'wall_stone', floor: 'temple_paving', roof: 'roof_slate', temple: true,
      things: [[25, 6, 'altar'], [24, 6, 'temple_lantern_nw'], [26, 6, 'temple_lantern_ne'], [21, 8, 'saint'], [29, 8, 'saint'],
               [22, 9, 'pew'], [23, 9, 'pew'], [27, 9, 'pew'], [28, 9, 'pew'], [22, 11, 'pew'], [23, 11, 'pew'], [27, 11, 'pew'], [28, 11, 'pew'],
               [25, 7, 'carpet_rug'], [25, 8, 'carpet_rug'], [25, 9, 'carpet_rug'], [25, 10, 'carpet_rug'], [25, 11, 'carpet_rug'], [21, 12, 'plant'], [29, 12, 'plant']] },
    { name: 'Bell tower', box: [31, 7, 34, 11], door: [32, 11], level: 1, wall: 'wall_stone', floor: 'wood', roof: 'roof_slate', floors: 4,
      up: [[32, 8], [32, 9], [32, 8]], things: [] },
    { name: 'Hall of Paths', box: [9, 7, 16, 14], door: [13, 14], wall: 'wall_stone', floor: 'tiles', roof: 'roof_slate', sign: 'The Hall of Paths',
      things: [[11, 9, 'pillar_terracotta'], [14, 9, 'pillar_emerald'], [11, 12, 'pillar_royalblue'], [14, 12, 'pillar_amethyst'], [12, 8, 'bookshelf'], [13, 8, 'bookshelf']] },
    { name: 'Depot', box: [40, 12, 44, 17], door: [40, 14], wall: 'wall_stone', floor: 'marble', roof: 'roof_slate', sign: 'Depot',
      things: [[43, 13, 'depot'], [43, 14, 'depot'], [43, 15, 'depot'], [43, 16, 'depot'], [41, 16, 'plant']] },
    { name: 'Smithy', box: [8, 24, 15, 29], wings: [[15, 26, 17, 29]], door: [12, 24], wall: 'wall_stone', floor: 'brick', roof: 'roof_slate', sign: 'Smithy',
      things: [[10, 26, 'anvil'], [14, 26, 'anvil'], [9, 28, 'barrel'], [16, 28, 'crate'], [10, 28, 'firewood'], [16, 27, 'woodpile']] },
    { name: 'Arms & armour', box: [18, 24, 23, 29], door: [23, 27], wall: 'wall_wood', floor: 'wood', roof: 'roof_shingle', sign: 'Arms & armour',
      things: [[20, 25, 'counter'], [20, 26, 'counter'], [20, 27, 'counter'], [22, 25, 'crate'], [19, 28, 'barrel']] },
    { name: 'General store', box: [29, 28, 36, 33], door: [32, 28], wall: 'wall_wood', floor: 'wood', roof: 'roof_shingle', sign: 'General store',
      things: [[33, 30, 'counter'], [34, 30, 'counter'], [35, 30, 'counter'], [30, 32, 'barrel'], [31, 32, 'barrel'], [35, 32, 'crate'], [30, 29, 'sack'], [35, 29, 'basket']] },
    { name: 'House', box: [41, 18, 44, 23], door: [42, 23], wall: 'wall_wood', floor: 'wood', roof: 'roof_thatch', house: true,
      things: [[43, 19, 'bed_head'], [43, 20, 'bed_foot'], [42, 21, 'table'], [42, 22, 'chair_north']] },
    { name: 'House', box: [38, 29, 43, 32], wings: [[38, 28, 40, 29]], door: [40, 28], wall: 'wall_wood', floor: 'wood', roof: 'roof_thatch', house: true,
      things: [[42, 30, 'bed_head'], [42, 31, 'bed_foot'], [39, 30, 'table'], [39, 31, 'chair_north']] },
    { name: 'Inn: The Cracked Bell', box: [8, 33, 18, 40], door: [18, 36], wall: 'wall_wood', floor: 'wood', roof: 'roof_shingle', floors: 2, sign: 'The Cracked Bell',
      up: [[16, 34]],
      things: [[9, 35, 'counter'], [10, 35, 'counter'], [11, 35, 'counter'], [9, 34, 'barrel'], [11, 38, 'table'], [11, 37, 'chair_north'], [14, 38, 'table'], [14, 37, 'chair_north'],
               [12, 38, 'chair_west'], [15, 38, 'chair_west'], [9, 39, 'barrel']],
      // upstairs: two rooms to sleep in, off a landing, and a sitting room over the bar
      upstairs: { walls: [[9, 36, 15, 36], [12, 34, 12, 35]], doors: [[10, 36], [14, 36]],
        things: [[9, 34, 'bed_head'], [9, 35, 'bed_foot'], [11, 34, 'chest'], [13, 34, 'bed_head'], [13, 35, 'bed_foot'], [15, 34, 'chest'],
                 [11, 38, 'table'], [10, 38, 'chair_east'], [12, 38, 'chair_west'], [15, 38, 'plant'], [9, 39, 'barrel']] } },
    { name: 'Bakery', box: [29, 36, 34, 41], door: [29, 38], wall: 'wall_wood', floor: 'wood', roof: 'roof_shingle', sign: 'Bakery',
      things: [[31, 38, 'counter'], [32, 38, 'counter'], [33, 38, 'counter'], [33, 40, 'sack'], [30, 40, 'basket'], [33, 37, 'barrel']] },
    { name: 'Healer', box: [36, 37, 40, 42], door: [38, 37], wall: 'wall_stone', floor: 'wood', roof: 'roof_slate', sign: 'Healer',
      things: [[37, 39, 'bed_head'], [37, 40, 'bed_foot'], [39, 39, 'bed_head'], [39, 40, 'bed_foot'], [38, 41, 'plant']] },
    { name: 'Harbour master', box: [41, 37, 44, 42], door: [42, 37], wall: 'wall_stone', floor: 'wood', roof: 'roof_slate',
      things: [[43, 39, 'table'], [42, 39, 'chair_east'], [43, 41, 'chest']] },
    { name: 'Stables', box: [45, 21, 49, 24], door: [47, 24], wall: 'wall_wood', floor: 'dirt', roof: 'roof_thatch',
      things: [[46, 22, 'haystack'], [48, 22, 'haystack'], [46, 23, 'barrel']] },
  ],
  // placed by hand, out in the town (first: on the rock, by the temple: its little graveyard and an old tree)
  outside: [
    { z: 1, at: [[18, 7, 'gravestone'], [18, 9, 'gravestone'], [18, 11, 'gravestone'], [35, 13, 'tree'], [19, 13, 'bench'], [35, 6, 'pine'], [18, 5, 'tree']] },
    { z: 0, at: [
      [25, 19, 'fountain_nw'], [26, 19, 'fountain_ne'], [25, 20, 'fountain_sw'], [26, 20, 'fountain_se'], [21, 18, 'bench'], [30, 21, 'bench'],
      [19, 17, 'lamppost'], [32, 17, 'lamppost'], [20, 22, 'lamppost'], [31, 22, 'lamppost'],
      [13, 17, 'stall'], [13, 20, 'stall'], [15, 17, 'basket'], [15, 20, 'apple_crate'], [14, 22, 'well'], [12, 22, 'barrel'],
      [27, 33, 'lamppost'], [22, 46, 'lamppost'], [38, 24, 'lamppost'], [12, 33, 'lamppost'], [35, 26, 'lamppost'],
      [12, 49, 'barrel'], [13, 49, 'crate'], [14, 49, 'barrel'], [30, 49, 'fish_rack'], [40, 49, 'barrel'], [41, 49, 'sack'], [24, 56, 'boat'], [16, 56, 'boat'],
      [14, 40, 'woodpile'], [28, 41, 'wagon'], [44, 26, 'haystack'], [9, 30, 'crate']] },
  ],
};

function createKestrelMap() {
  const { width: W, height: H, depth: D, surfaceZ: S } = WORLD_SIZE;
  const m = new GameMap(W, H, D, S);
  const K = KESTREL_TOWN, [TX, TY] = K.at;
  const hash = (x, y, s) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const smooth = (x, y, sc, s) => { // value noise, 0..1, blobs about `sc` tiles across
    const fx = x / sc, fy = y / sc, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  const set = (x, y, z, ground, items = []) => m.set(TX + x, TY + y, z, { ground, items: [...items] });
  const tile = (x, y, z = S) => m.get(TX + x, TY + y, z);
  const each = ([x0, y0, x1, y1], fn) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) fn(x, y); };
  const inBox = ([x0, y0, x1, y1], x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const boxesOf = b => [b.box, ...(b.wings || [])];
  const inB = (b, x, y) => boxesOf(b).some(bx => inBox(bx, x, y));
  const n8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];

  // ---- the land round the town (open country for now, ragged at the sea; the rest of the isle comes next) ----
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - (TX + 28)) / 62, dy = (y - (TY + 18)) / 50, r = Math.hypot(dx, dy) + (smooth(x, y, 6, 3) - 0.5) * 0.18;
    m.set(x, y, S, { ground: r < 1 ? 'grass' : 'water', items: [] });
  }
  // the bay along the town's south (a ragged shore), the river down its west (banks a little uneven, reeds in it)
  for (let y = 46; y < 72; y++) for (let x = -10; x < 66; x++) if (y >= 48 + Math.round((smooth(x, y, 5, 7) - 0.5) * 3) || y >= 50) set(x, y, S, 'water');
  for (let y = -40; y <= 46; y++) {
    const c = 1.5 + Math.sin(y / 9) * 1.2 + (smooth(0, y, 4, 8) - 0.5) * 1.5, w = 1.8 + smooth(3, y, 5, 9) * 1.2;
    for (let x = Math.floor(c - w); x <= Math.ceil(c + w); x++) if (x <= 4) set(x, y, S, 'water', hash(x, y, 4) < 0.08 ? ['reeds'] : []);
  }
  for (const r of K.river) each(r, (x, y) => { if (x <= 3 || y >= 44) set(x, y, S, 'water'); });

  // ---- the wall, along the inside of its outline, a tower at each turn ----
  const O = K.outline, inside = (px, py) => {
    let hit = false;
    for (let i = 0, j = O.length - 1; i < O.length; j = i++) { const [xi, yi] = O[i], [xj, yj] = O[j]; if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit; }
    return hit;
  };
  const wallTiles = new Set();
  for (let i = 0; i < O.length; i++) {
    const [ax, ay] = O[(i + O.length - 1) % O.length], [bx, by] = O[i];
    for (let t = 0; t <= Math.max(Math.abs(bx - ax), Math.abs(by - ay)); t++) {
      const x = ax + Math.sign(bx - ax) * t, y = ay + Math.sign(by - ay) * t;
      for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) if (inside(x + dx + 0.5, y + dy + 0.5)) wallTiles.add(`${x + dx},${y + dy}`);
    }
  }
  const inGate = (x, y) => K.gates.some(g => inBox(g, x, y));
  for (const k of wallTiles) { const [x, y] = k.split(',').map(Number); if (!inGate(x, y)) set(x, y, S, 'grass', ['wall_stone']); }
  for (const [x, y] of O) for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) if (inside(x + dx + 0.5, y + dy + 0.5) && !inGate(x + dx, y + dy)) {
    set(x + dx, y + dy, S + 1, 'grass', ['wall_stone']); // (the towers: the corners of the wall, a floor higher)
  }
  const open = (x, y) => { const t = tile(x, y); return t && t.ground === 'grass' && !t.items.length; };

  // ---- the temple rock: cliffs with grass on top, its rim ragged, a broad stair up its south face ----
  const R = K.rock, onRock = new Set();
  const keepOn = (x, y) => K.buildings.some(b => b.level && boxesOf(b).some(([x0, y0, x1, y1]) => x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 1 && y <= y1 + 1));
  each(R.box, (x, y) => {
    const [x0, y0, x1, y1] = R.box, edge = Math.min(x - x0, x1 - x, y - y0, y1 - y);
    const stairCol = R.steps.includes(x) || R.steps.includes(x - 1) || R.steps.includes(x + 1);
    if (keepOn(x, y) || (stairCol && y >= y1 - 1) || edge >= 1 || smooth(x, y, 3, 21) > 0.45) if (!wallTiles.has(`${x},${y}`)) onRock.add(`${x},${y}`);
  });
  for (const k of onRock) {
    const [x, y] = k.split(',').map(Number);
    set(x, y, S, 'mountain', ['cliff']);
    set(x, y, S + 1, 'grass');
  }
  for (const x of R.steps) { tile(x, R.box[3]).items = ['steps']; tile(x, R.box[3], S + 1).ground = 'steps_top'; }

  // ---- the square: paving in a ragged oval; streets of cobbles and trodden earth that fray into the grass ----
  const Q = K.square;
  for (let y = Math.floor(Q.cy - Q.ry - 2); y <= Q.cy + Q.ry + 2; y++) for (let x = Math.floor(Q.cx - Q.rx - 2); x <= Q.cx + Q.rx + 2; x++) {
    const r = Math.hypot((x + 0.5 - Q.cx) / Q.rx, (y + 0.5 - Q.cy) / Q.ry) + (smooth(x, y, 2.5, 31) - 0.5) * 0.35;
    if (r < 1 && open(x, y)) set(x, y, S, 'paving');
    else if (r < 1.25 && open(x, y) && hash(x, y, 32) < 0.5) set(x, y, S, 'gravel');
  }
  for (const [x0, y0, x1, y1, g] of K.streets) {
    each([x0, y0, x1, y1], (x, y) => { const t = tile(x, y); if (t && !t.items.length && !onRock.has(`${x},${y}`)) set(x, y, S, g === 'cobble' && hash(x, y, 33) < 0.12 ? 'dirt' : g); });
    // the edges fray: a tile of the street's ground here and there beside it, and gravel where cobbles meet grass
    each([x0 - 1, y0 - 1, x1 + 1, y1 + 1], (x, y) => {
      if (inBox([x0, y0, x1, y1], x, y) || !open(x, y) || onRock.has(`${x},${y}`)) return;
      if (smooth(x, y, 2, 34) > 0.62) set(x, y, S, g === 'paving' || g === 'cobble' ? 'gravel' : 'dirt');
    });
  }
  for (const g of K.gates) each(g, (x, y) => set(x, y, S, 'cobble'));
  for (const b of K.bridges) each(b, (x, y) => set(x, y, S, 'bridge_ew'));
  for (const p of K.piers) each(p, (x, y) => set(x, y, S, 'pier'));

  // ---- the buildings: walls (windows on straight runs), a door, floors above, a roof over the top ----
  const rim = (b, x, y) => inB(b, x, y) && n8.some(([dx, dy]) => !inB(b, x + dx, y + dy));
  for (const b of K.buildings) {
    const floors = b.floors || 1, Z = S + (b.level || 0);
    for (let k = 0; k < floors; k++) {
      const z = Z + k;
      for (const bx of boxesOf(b)) each(bx, (x, y) => set(x, y, z, k ? 'wood' : b.floor));
      for (const bx of boxesOf(b)) each(bx, (x, y) => {
        const t = tile(x, y, z);
        if (!rim(b, x, y) || t.items.includes(b.wall)) return;
        t.items.push(b.wall);
        const straight = (rim(b, x - 1, y) && rim(b, x + 1, y)) || (rim(b, x, y - 1) && rim(b, x, y + 1));
        const along = rim(b, x - 1, y) && rim(b, x + 1, y) ? x : y;
        if (straight && along % 3 === 0 && Math.abs(x - b.door[0]) + Math.abs(y - b.door[1]) > 1) t.items.push('window');
      });
    }
    tile(b.door[0], b.door[1], Z).items = [b.house ? 'door_house' : 'door'];
    (b.up || []).forEach(([x, y], k) => { tile(x, y, Z + k).items.push('stairs_up'); tile(x + 1, y, Z + k + 1).items.push('stairs_down'); });
    if (b.upstairs) {
      const u = b.upstairs, z = Z + 1;
      for (const w of u.walls) each(w, (x, y) => { if (!tile(x, y, z).items.some(id => THINGS[id].change)) tile(x, y, z).items.push(b.wall); });
      for (const [x, y] of u.doors) tile(x, y, z).items = ['door'];
      for (const [x, y, id] of u.things) tile(x, y, z).items.push(id);
    }
    for (const [x, y, id] of b.things) tile(x, y, Z).items.push(id);
    // the roof, a floor above the top floor (leaving out the north and west rows: drawn up-left, it sits over the walls)
    for (const bx of boxesOf(b)) each(bx, (x, y) => { if (inB(b, x, y - 1) && inB(b, x - 1, y)) set(x, y, Z + floors, b.roof); });
    if (b.sign) { const [dx, dy] = b.door, side = tile(dx + 1, dy, Z); if (side && side.items.includes(b.wall)) { side.items = side.items.filter(id => id !== 'window'); side.items.push('sign_wall'); m.setMeta(TX + dx + 1, TY + dy, Z, { text: b.sign }); } }
    if (b.temple) {
      const [dx, dy] = b.door;
      m.start = { x: TX + dx, y: TY + dy - 2, z: Z }; // you wake in the temple, on its carpet
      m.mainStart = { ...m.start };
      m.temples.push({ home: 'bellhaven', town: 'Bellhaven', npc: null, x: m.start.x, y: m.start.y, z: Z });
      for (const [a, c, e, f] of boxesOf(b)) m.zones.push({ x0: TX + a, y0: TY + c, x1: TX + e, y1: TY + f, z: Z });
    }
  }
  { // the bell, at the top of its tower
    const b = K.buildings.find(x => x.name === 'Bell tower'), [x0, y0] = b.box, z = S + b.level + b.floors - 1;
    for (const [dx, dy, id] of [[1, 2, 'bell_nw'], [2, 2, 'bell_ne'], [1, 3, 'bell_sw'], [2, 3, 'bell_se']]) { const t = tile(x0 + dx, y0 + dy, z); if (t && !t.items.some(i => THINGS[i].change)) t.items.push(id); }
  }
  for (const { z, at } of K.outside) for (const [x, y, id] of at) { const t = tile(x, y, S + z); if (t && !t.items.length && !THINGS[t.ground]?.block) t.items.push(id); }

  // ---- worn paths: from every door, the shortest way over the grass to a street, trodden to earth ----
  const walkable = (x, y, z) => { const t = tile(x, y, z); return t && !THINGS[t.ground]?.block && !t.items.some(id => THINGS[id].block && !id.startsWith('door')); };
  const paved = (x, y, z) => { const t = tile(x, y, z); return t && t.ground !== 'grass' && t.ground !== 'farmland' && walkable(x, y, z) && !K.buildings.some(b => inB(b, x, y)); };
  const trodden = new Set();
  for (const b of K.buildings) {
    const z = S + (b.level || 0), [dx, dy] = b.door;
    const start = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([ox, oy]) => [dx + ox, dy + oy]).find(([x, y]) => !inB(b, x, y));
    if (!start || paved(...start, z)) continue;
    const prev = new Map([[start.join(), null]]), todo = [start];
    let end = null;
    while (todo.length && !end) {
      const [x, y] = todo.shift();
      for (const [ox, oy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = x + ox, ny = y + oy, k = `${nx},${ny}`;
        if (prev.has(k) || !walkable(nx, ny, z) || K.buildings.some(o => inB(o, nx, ny))) continue;
        prev.set(k, `${x},${y}`);
        if (paved(nx, ny, z)) { end = `${x},${y}`; break; }
        todo.push([nx, ny]);
      }
    }
    for (let k = end; k; k = prev.get(k)) { const [x, y] = k.split(',').map(Number); const t = tile(x, y, z); if (t.ground === 'grass') t.ground = 'dirt'; trodden.add(`${x},${y},${z}`); }
  }

  // ---- what grows where nobody walks: thickets of bushes and trees, flowers and tall grass in the yards ----
  const nearWay = (x, y, z) => n8.some(([dx, dy]) => { const t = tile(x + dx, y + dy, z); return t && (t.ground !== 'grass' || t.items.some(id => id.startsWith('door'))) && !t.items.includes('cliff'); });
  for (const [z, y0, y1, x0, x1] of [[S, -40, 50, -45, 100], [S + 1, 4, 16, 16, 37]]) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const t = tile(x, y, z), k = `${x},${y}`, inTown = inside(x + 0.5, y + 0.5);
    if (!t || t.ground !== 'grass' || t.items.length || wallTiles.has(k) || trodden.has(`${x},${y},${z}`)) continue;
    if (z === S && (n8.some(([dx, dy]) => wallTiles.has(`${x + dx},${y + dy}`)) || K.gates.some(([a, b, c, d]) => x >= a - 3 && x <= c + 3 && y >= b - 3 && y <= d + 3))) continue;
    const near = nearWay(x, y, z), thick = smooth(x, y, 3.5, inTown ? 41 : 42), r = hash(x, y, 43);
    if (!near && thick > (inTown ? 0.64 : 0.7)) t.items.push(r < (inTown ? 0.35 : 0.5) ? (inTown || r < 0.3 ? 'tree' : 'pine') : r < 0.8 ? 'bush' : 'tallgrass');
    else if (r < 0.06) t.items.push('flowers');
    else if (r < 0.11) t.items.push('grass_tuft');
    else if (!near && r < 0.14) t.items.push('tallgrass');
  }

  // the roads out of the gates, a little way into the country, fraying as they go
  const road = pts => { for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)); for (let t = 0; t <= n; t++) { const x = Math.round(ax + (bx - ax) * t / n), y = Math.round(ay + (by - ay) * t / n); for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]]) { const tt = tile(x + ox, y + oy); if (tt && tt.ground === 'grass' && (!ox && !oy || hash(x + ox, y + oy, 51) < 0.6)) { tt.ground = 'dirt'; tt.items = []; } } } } };
  road([[38, 1], [38, -10], [43, -20], [44, -30]]); road([[54, 26], [64, 26], [72, 20], [80, 18]]); road([[-1, 31], [-12, 32], [-20, 38], [-26, 42]]);

  m.isle = { x0: 0, y0: 0, x1: W - 1, y1: H - 1 };
  m.labels = [{ name: 'Bellhaven', x: TX + 25, y: TY + 2, z: S }];
  return m;
}
