'use strict';
// The new world, Kestrel Isle, built by hand tile by tile (phase 1: Bellhaven, the home town). Played only as a preview
// for now (index.html?world=kestrel): the built-in world stays Oakvale Isle until this one is ready.
//
// Bellhaven is laid out on its own grid (KESTREL_TOWN: x 0-55, y 0-57) and set into the world at its corner (TX, TY).
// Its plan: an upper town on a rise (the temple with its bell tower, the Hall of Paths, the depot) over a plaza, a crooked
// Main Street down to the harbour, a Cross Street in two halves, two lanes, and a wall of straight runs with many turns.
// Every building is listed with its outer walls, its door and what stands inside; nothing overlaps a street or the wall
// (tests/unit.test.js checks it).

const KESTREL_TOWN = {
  at: [100, 96], // its corner in the world
  // the wall's outline (right angles, many turns); the wall runs just inside it, a tower at every turn
  outline: [[8, 4], [40, 4], [40, 10], [47, 10], [47, 20], [52, 20], [52, 33], [47, 33], [47, 45], [42, 45], [42, 47], [12, 47], [12, 43], [6, 43], [6, 22], [8, 22]],
  gates: [[37, 2, 39, 5], [4, 30, 7, 32], [50, 25, 53, 27], [23, 45, 25, 48]], // north, west, east, harbour
  // [x0, y0, x1, y1, ground]
  streets: [
    [37, 2, 39, 15, 'cobble'], [12, 16, 39, 23, 'paving'],                                       // North Street, the plaza
    [24, 24, 26, 30, 'cobble'], [26, 30, 28, 36, 'cobble'], [23, 36, 25, 48, 'cobble'],           // Main Street, in three jogs
    [4, 30, 25, 32, 'cobble'], [26, 25, 53, 27, 'cobble'],                                       // Cross Street, its two halves
    [13, 41, 23, 42, 'gravel'], [29, 34, 44, 35, 'gravel'],                                      // Rope Lane, Baker's Row
    [10, 48, 44, 49, 'paving'],                                                                  // the quay
  ],
  river: [[0, 0, 3, 46], [0, 44, 7, 46]],
  bridges: [[0, 30, 3, 32]],
  piers: [[16, 50, 17, 56], [24, 50, 25, 56], [32, 50, 33, 56]],
  gardens: [[20, 34, 22, 39], [13, 43, 22, 44], [8, 17, 11, 22], [45, 28, 49, 31], [27, 43, 40, 44]],
  // buildings: outer walls, the door (in the wall), floors, wall and floor, and what stands inside ([x, y, thing] in town
  // coordinates; stairs are made by `up`: [x, y] climbs from that floor to the next)
  buildings: [
    { name: 'Hall of Paths', box: [10, 7, 17, 15], door: [13, 15], wall: 'wall_stone', floor: 'tiles', roof: 'roof_slate', sign: 'The Hall of Paths',
      things: [[12, 9, 'pillar_terracotta'], [15, 9, 'pillar_emerald'], [12, 13, 'pillar_royalblue'], [15, 13, 'pillar_amethyst'], [13, 8, 'bookshelf'], [14, 8, 'bookshelf'], [13, 11, 'table'], [14, 11, 'table']] },
    { name: 'Temple', box: [19, 6, 31, 14], door: [25, 14], wall: 'wall_temple', floor: 'marble', roof: 'roof_marble', temple: true,
      things: [[25, 8, 'altar'], [21, 8, 'saint'], [29, 8, 'saint'], [21, 10, 'pew'], [22, 10, 'pew'], [23, 10, 'pew'], [27, 10, 'pew'], [28, 10, 'pew'], [29, 10, 'pew'],
               [21, 12, 'pew'], [22, 12, 'pew'], [23, 12, 'pew'], [27, 12, 'pew'], [28, 12, 'pew'], [29, 12, 'pew'], [20, 7, 'plant'], [30, 7, 'plant']] },
    { name: 'Bell tower', box: [32, 6, 35, 11], door: [33, 11], wall: 'wall_temple', floor: 'wood', roof: 'roof_slate', floors: 4,
      up: [[33, 7], [33, 10], [33, 7]], things: [] },
    { name: 'Depot', box: [40, 12, 44, 17], door: [40, 14], wall: 'wall_stone', floor: 'marble', roof: 'roof_slate', sign: 'Depot',
      things: [[43, 13, 'depot'], [43, 14, 'depot'], [43, 15, 'depot'], [43, 16, 'depot'], [41, 16, 'plant']] },
    { name: 'Smithy', box: [8, 24, 16, 29], door: [12, 24], wall: 'wall_stone', floor: 'brick', roof: 'roof_slate', sign: 'Smithy',
      things: [[10, 26, 'anvil'], [14, 26, 'anvil'], [9, 28, 'barrel'], [15, 28, 'crate'], [10, 28, 'firewood']] },
    { name: 'Arms & armour', box: [17, 24, 23, 29], door: [23, 27], wall: 'wall_wood', floor: 'wood', roof: 'roof_shingle', sign: 'Arms & armour',
      things: [[19, 25, 'counter'], [19, 26, 'counter'], [19, 27, 'counter'], [22, 25, 'crate'], [18, 28, 'barrel']] },
    { name: 'General store', box: [29, 28, 36, 33], door: [32, 28], wall: 'wall_wood', floor: 'wood', roof: 'roof_shingle', sign: 'General store',
      things: [[33, 30, 'counter'], [34, 30, 'counter'], [35, 30, 'counter'], [30, 32, 'barrel'], [31, 32, 'barrel'], [35, 32, 'crate'], [30, 29, 'sack'], [35, 29, 'basket']] },
    { name: 'House', box: [41, 18, 44, 23], door: [42, 23], wall: 'wall_wood', floor: 'wood', roof: 'roof_thatch', house: true,
      things: [[43, 19, 'bed_head'], [43, 20, 'bed_foot'], [42, 21, 'table'], [42, 22, 'chair_north']] },
    { name: 'House', box: [38, 28, 43, 32], door: [40, 28], wall: 'wall_wood', floor: 'wood', roof: 'roof_thatch', house: true,
      things: [[42, 29, 'bed_head'], [42, 30, 'bed_foot'], [39, 30, 'table'], [39, 31, 'chair_north'], [42, 31, 'plant']] },
    { name: 'Inn: The Cracked Bell', box: [8, 33, 18, 40], door: [18, 36], wall: 'wall_wood', floor: 'wood', roof: 'roof_shingle', floors: 2, sign: 'The Cracked Bell',
      up: [[16, 34]],
      things: [[9, 35, 'counter'], [10, 35, 'counter'], [11, 35, 'counter'], [9, 34, 'barrel'], [11, 38, 'table'], [11, 37, 'chair_north'], [14, 38, 'table'], [14, 37, 'chair_north'],
               [12, 38, 'chair_west'], [15, 38, 'chair_west'], [9, 39, 'barrel']],
      // upstairs: two rooms to rent a bed in, off a landing, and a sitting room over the bar
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
  // out in the streets and yards
  outside: [
    // the plaza: a fountain over a golden sun in the paving, benches round it, lamps at its corners, a market along its west end
    [25, 19, 'fountain_nw'], [26, 19, 'fountain_ne'], [25, 20, 'fountain_sw'], [26, 20, 'fountain_se'], [21, 19, 'bench'], [30, 19, 'bench'], [21, 21, 'bench'], [30, 21, 'bench'],
    [18, 17, 'lamppost'], [33, 17, 'lamppost'], [18, 22, 'lamppost'], [33, 22, 'lamppost'], [13, 17, 'stall'], [13, 20, 'stall'], [15, 17, 'basket'], [15, 20, 'apple_crate'],
    [36, 17, 'planter'], [36, 22, 'planter'], [14, 23, 'well'],
    [27, 33, 'lamppost'], [22, 46, 'lamppost'], [38, 24, 'lamppost'], [12, 33, 'lamppost'],
    [14, 21, 'tree'], [37, 21, 'tree'], [44, 8, 'tree'], [37, 9, 'tree'], [49, 30, 'tree'], [20, 36, 'tree'], [35, 36, 'tree'], [16, 44, 'tree'], [11, 5, 'tree'],
    [12, 49, 'barrel'], [13, 49, 'crate'], [30, 49, 'fish_rack'], [40, 49, 'barrel'], [41, 49, 'sack'], [24, 56, 'boat'],
    [24, 23, 'planter'], [26, 23, 'planter'], [34, 32, 'stall'], [14, 40, 'woodpile'],
  ],
};

function createKestrelMap() {
  const { width: W, height: H, depth: D, surfaceZ: S } = WORLD_SIZE;
  const m = new GameMap(W, H, D, S);
  const K = KESTREL_TOWN, [TX, TY] = K.at;
  const hash = (x, y, s) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const set = (x, y, z, ground, items = []) => m.set(TX + x, TY + y, z, { ground, items: [...items] });
  const tile = (x, y, z = S) => m.get(TX + x, TY + y, z);
  const put = (x, y, z, id) => m.addItem(TX + x, TY + y, z, id);
  const each = ([x0, y0, x1, y1], fn) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) fn(x, y); };

  // ---- the land round the town (for now: open country, ragged at the sea; the rest of the isle comes next) ----
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - (TX + 28)) / 62, dy = (y - (TY + 18)) / 50, r = Math.hypot(dx, dy) + (hash(x >> 2, y >> 2, 3) - 0.5) * 0.12;
    m.set(x, y, S, { ground: r < 1 ? 'grass' : 'water', items: [] });
  }
  // the bay along the town's south, the river down its west
  for (let y = 48; y < 70; y++) for (let x = -6; x < 62; x++) set(x, y, S, 'water');
  for (const r of K.river) each(r, (x, y) => set(x, y, S, 'water'));
  for (let y = -30; y < 0; y++) for (let x = 0; x <= 3; x++) set(x + Math.round(Math.sin(y / 7) * 2), y, S, 'water'); // (it comes down from the hills)

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
  const inGate = (x, y) => K.gates.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
  for (const k of wallTiles) { const [x, y] = k.split(',').map(Number); if (!inGate(x, y)) set(x, y, S, 'grass', ['wall_stone']); }
  for (const [x, y] of O) for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) if (inside(x + dx + 0.5, y + dy + 0.5) && !inGate(x + dx, y + dy)) {
    set(x + dx, y + dy, S, 'grass', ['wall_stone']); // (the towers: the corner of the wall, a floor higher)
    set(x + dx, y + dy, S + 1, 'grass', ['wall_stone']);
  }

  // ---- streets, the plaza, the quay, bridges and piers; the gates are open cobbles ----
  for (const [x0, y0, x1, y1, g] of K.streets) each([x0, y0, x1, y1], (x, y) => set(x, y, S, g));
  for (const g of K.gates) each(g, (x, y) => set(x, y, S, 'cobble'));
  for (const b of K.bridges) each(b, (x, y) => set(x, y, S, 'bridge_ew'));
  for (const p of K.piers) each(p, (x, y) => set(x, y, S, 'pier'));
  // gardens: a fence round, inside it a bed of vegetables (on farmland) or flowers, and a bush or two
  for (const [i, g] of K.gardens.entries()) each(g, (x, y) => {
    const t = tile(x, y), [x0, y0, x1, y1] = g;
    if (!t || t.ground !== 'grass' || t.items.length) return;
    const edge = x === x0 || x === x1 || y === y0 || y === y1, gap = (x === Math.floor((x0 + x1) / 2)) && (y === y0 || y === y1);
    if (edge && !gap) t.items.push('fence');
    else if (!edge) { if (i % 2 === 0 && (y - y0) % 2 === 1) set(x, y, S, 'farmland', ['crops']); else t.items.push(hash(x, y, 5) < 0.6 ? 'flowers' : 'bush'); }
  });

  // ---- the buildings: walls (windows on straight runs), a door, floors above, a roof over the top ----
  const inBox = ([x0, y0, x1, y1], x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const rim = (box, x, y) => inBox(box, x, y) && !inBox([box[0] + 1, box[1] + 1, box[2] - 1, box[3] - 1], x, y);
  for (const b of K.buildings) {
    const floors = b.floors || 1;
    for (let k = 0; k < floors; k++) {
      const z = S + k;
      each(b.box, (x, y) => set(x, y, z, k ? 'wood' : b.floor));
      each(b.box, (x, y) => {
        if (!rim(b.box, x, y)) return;
        put(x, y, z, b.wall);
        const straight = (rim(b.box, x - 1, y) && rim(b.box, x + 1, y)) || (rim(b.box, x, y - 1) && rim(b.box, x, y + 1));
        const along = rim(b.box, x - 1, y) && rim(b.box, x + 1, y) ? x : y;
        if (straight && along % 3 === 0 && Math.abs(x - b.door[0]) + Math.abs(y - b.door[1]) > 1 && b.wall !== 'wall_temple') put(x, y, z, 'window');
      });
    }
    tile(...b.door).items = [b.house ? 'door_house' : 'door'];
    // stairs: up from (x, y) on floor k to the same spot on floor k + 1, and down again from the tile beside it
    (b.up || []).forEach(([x, y], k) => {
      const z = S + k, bx = x + 1;
      tile(x, y, z).items.push('stairs_up');
      tile(bx, y, z + 1).items.push('stairs_down');
    });
    if (b.upstairs) {
      const u = b.upstairs, z = S + 1;
      for (const w of u.walls) each(w, (x, y) => { if (!tile(x, y, z).items.some(id => THINGS[id].change)) tile(x, y, z).items.push(b.wall); });
      for (const [x, y] of u.doors) tile(x, y, z).items = ['door'];
      for (const [x, y, id] of u.things) tile(x, y, z).items.push(id);
    }
    for (const [x, y, id] of b.things) tile(x, y).items.push(id);
    // the roof, a floor above the top floor (leaving out the north and west rows: drawn up-left, it sits over the walls)
    each(b.box, (x, y) => { if (inBox(b.box, x, y - 1) && inBox(b.box, x - 1, y)) set(x, y, S + floors, b.roof); });
    if (b.sign) { const [dx, dy] = b.door, side = tile(dx + 1, dy); if (side && side.items.includes(b.wall)) { side.items = side.items.filter(id => id !== 'window'); side.items.push('sign_wall'); m.setMeta(TX + dx + 1, TY + dy, S, { text: b.sign }); } }
    if (b.temple) {
      const [x0, y0, x1, y1] = b.box, [dx, dy] = b.door;
      m.start = { x: TX + dx, y: TY + dy - 2, z: S }; // you wake in the temple, before its altar
      m.mainStart = { ...m.start };
      m.temples.push({ home: 'bellhaven', town: 'Bellhaven', npc: null, x: m.start.x, y: m.start.y, z: S });
      m.zones.push({ x0: TX + x0, y0: TY + y0, x1: TX + x1, y1: TY + y1, z: S });
    }
  }
  // the bell, at the top of its tower
  { const b = K.buildings.find(x => x.name === 'Bell tower'), [x0, y0] = b.box, z = S + (b.floors - 1);
    for (const [dx, dy, id] of [[1, 2, 'bell_nw'], [2, 2, 'bell_ne'], [1, 3, 'bell_sw'], [2, 3, 'bell_se']]) { const t = tile(x0 + dx, y0 + dy, z); if (t && !t.items.some(i => THINGS[i].change)) t.items.push(id); } }

  for (const [x, y, id] of K.outside) { const t = tile(x, y); if (t && !t.items.length && !THINGS[t.ground]?.block) t.items.push(id); }
  // grass a little wilder outside the walls: tufts, flowers and a tree or two on open ground
  for (let y = TY - 30; y < TY + 48; y++) for (let x = TX - 40; x < TX + 100; x++) {
    const t = m.get(x, y, S), lx = x - TX, ly = y - TY;
    if (!t || t.ground !== 'grass' || t.items.length || inside(lx + 0.5, ly + 0.5) || wallTiles.has(`${lx},${ly}`)) continue;
    const r = hash(x, y, 9);
    if (r < 0.025 && !(lx > -8 && lx < 60 && ly > -8 && ly < 56 && (Math.abs(ly - 31) < 3 || Math.abs(ly - 26) < 3 || Math.abs(lx - 38) < 3))) t.items.push('tree');
    else if (r < 0.07) t.items.push(r < 0.05 ? 'grass_tuft' : 'flowers');
  }
  // the roads out of the gates, a little way into the country
  const road = (pts) => { for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; for (let t = 0; t <= Math.max(Math.abs(bx - ax), Math.abs(by - ay)); t++) { const x = ax + Math.sign(bx - ax) * t, y = ay + Math.sign(by - ay) * t; for (let w = -1; w <= 1; w++) { const tt = tile(x + (ax === bx ? w : 0), y + (ay === by ? w : 0)); if (tt && tt.ground === 'grass') { tt.ground = 'dirt'; tt.items = []; } } } } };
  road([[38, 1], [38, -12], [44, -24]]); road([[54, 26], [70, 26], [78, 18]]); road([[-1, 31], [-14, 31], [-22, 38]]);

  m.isle = { x0: 0, y0: 0, x1: W - 1, y1: H - 1 };
  m.labels = [{ name: 'Bellhaven', x: TX + 25, y: TY + 2, z: S }];
  return m;
}
