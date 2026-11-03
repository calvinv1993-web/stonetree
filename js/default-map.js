'use strict';
// The built-in world. Brightwater Isle (west) is the starter island where new
// characters learn the game; at level 10 the Seer sends them to the mainland
// (east) around the city of Valoria. Ships sail from Valoria to Ashport, an
// island town in the south-west with pirate caves below it. Further east lie the
// Highlands: Castle Greymoor, the cyclops mountain with a dragon lair below it,
// and the Webwood where giant spiders live. South of it all are the southlands, and
// beyond lie the Frost Reach, the Elderwood, the Ironpeak mountains (with the dwarf
// city Deepforge), the Sunreach desert, the Mirefen, the Tazal jungle and Cinderhold.

// Named places in the built-in world: towns (shown on the in-game maps) and the
// dungeons below them (for the editor's "Go to"). [name, x, y, z]
const MAP_TOWNS = [
  ['Brightwater', 31, 36, 4], ['Valoria', 112, 57, 4], ['Glintvault Bank', 141, 42, 4], ['Ashport', 30, 92, 4], ['Castle Greymoor', 237, 52, 4],
  ['Frosthold', 430, 100, 4], ['Sylvaran', 640, 110, 4], ['Deepforge', 450, 294, 4], ['Kesh', 590, 360, 4], ['Mirehaven', 120, 330, 4],
  ['Port Verdant', 330, 400, 4], ['Cinderhold', 154, 452, 4],
];
const MAP_SIGHTS = [
  ['Cyclops mountain', 250, 100, 4], ['The Webwood', 221, 140, 4], ['Glintvault vaults', 148, 61, 2], ['Pirate caves', 30, 103, 3],
  ['Ice caves', 505, 58, 3], ['Frost dragon lair', 478, 68, 2], ['Deepforge (city)', 432, 252, 3], ['The labyrinth', 368, 252, 3],
  ['Pyramid', 700, 430, 4], ["Sand King's tomb", 680, 440, 2], ['Jungle temple', 450, 455, 4], ['Serpent lair', 424, 464, 2],
  ['Volcano', 105, 452, 5], ['Demon pit', 95, 482, 2],
];

function createDefaultMap() {
  const W = 768, H = 512, S = 4; // S = surface floor
  const m = new GameMap(W, H, 8, S);
  const r = makeRng(1234);
  const reserved = new Uint8Array(W * H); // no random vegetation here

  // ---- helpers ---------------------------------------------------------------
  const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const reserve = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inMap(x, y)) reserved[y * W + x] = 1;
  };
  const fill = (x0, y0, x1, y1, z, ground) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.setGround(x, y, z, ground);
  };
  const walls = (x0, y0, x1, y1, z, id, keep = () => true) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if ((x === x0 || x === x1 || y === y0 || y === y1) && keep(x, y)) m.addItem(x, y, z, id);
    }
  };
  const put = (x, y, z, id) => m.addItem(x, y, z, id);
  const npc = (type, x, y, z = S) => m.npcs.push({ type, x, y, z });
  const spawned = new Set(); // one spawn per tile
  const spawn = (type, list, z = S) => {
    for (const [x, y] of list) {
      if (spawned.has(`${x},${y},${z}`) || (z === S && townArea[y * W + x])) continue;
      spawned.add(`${x},${y},${z}`);
      m.spawns.push({ type, x, y, z });
    }
  };
  const meta = (x, y, z, data) => m.setMeta(x, y, z, data);
  const sign = (x, y, z, id, text) => { put(x, y, z, id); meta(x, y, z, { text }); };
  const groundAt = (x, y) => (m.get(x, y, S) || {}).ground;

  // Dirt road: a horizontal leg along y0, then a vertical leg along x1.
  const road = (x0, y0, x1, y1) => {
    const paint = (x, y) => {
      if (['grass', 'sand', 'snow', 'jungle', 'swamp', 'ash'].includes(groundAt(x, y))) m.setGround(x, y, S, 'dirt');
      reserve(x - 1, y - 1, x + 1, y + 1);
    };
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) paint(x, y0);
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) paint(x1, y);
  };

  // Walls, floor and doors, with a roof on the floor above unless roof is null (no
  // roof given: one of the common ones). doors: [[x, y]] or [[x, y, 'door_closed']]
  const ROOFS = ['roof', 'roof', 'roof_slate', 'roof_shingle', 'roof_thatch'];
  function building({ x0, y0, x1, y1, z = S, floor = 'wood', wall = 'wall_wood', roof = ROOFS[Math.floor(r() * ROOFS.length)], doors = [] }) {
    fill(x0, y0, x1, y1, z, floor);
    walls(x0, y0, x1, y1, z, wall);
    for (const [x, y, id = 'door'] of doors) m.ensure(x, y, z).items = [id];
    if (roof) fill(x0, y0, x1, y1, z + 1, roof);
    if (z === S) reserve(x0 - 2, y0 - 2, x1 + 2, y1 + 2);
  }

  // A shelter: monsters keep out, and leave you be inside (but it's no protection zone).
  const shelter = (x0, y0, x1, y1, z = S) => m.zones.push({ x0, y0, x1, y1, z, shelter: true });

  // A shop: a building with a counter the trader stands behind.
  function shop(type, x0, y0, x1, y1, door, counterX, npcX, npcY) {
    building({ x0, y0, x1, y1, doors: [door] });
    shelter(x0, y0, x1, y1);
    for (let y = y0 + 1; y < y1; y++) put(counterX, y, S, 'counter');
    npc(type, npcX, npcY);
  }

  // ---- towns ------------------------------------------------------------------------
  // A town grows around its square: a fountain in the middle with market stalls, the
  // temple on the north side, and main streets out to the west, east and south with
  // side streets off them. Along the streets stand its buildings, each with its door
  // on the street: first the halls and shops of its people and an inn, then houses -
  // furnished, with windows and a roof in the local style. Between them are gardens
  // and yards; lamps and trees line the pavements. Then the townsfolk move in.
  const townArea = new Uint8Array(W * H); // no monsters spawn here
  const townRoads = []; // roads to pave once the land is done: [[x, y], [x, y]]
  const oneOf = list => list[Math.floor(r() * list.length)];
  const TOWN_STYLES = {
    // street: the main streets; walk: their pavements; alley: side streets; plaza: the square
    northern: { townWall: 'wall_wood', green: [[0.025, 'snow_pine'], [0.008, 'woodpile'], [0.006, 'rock']], base: 'snow', street: 'cobble', walk: 'paving', alley: 'gravel', plaza: 'paving', mosaic: 'cobble', gardens: ['yard'], floor: 'wood', wall: 'wall_wood', roofs: ['roof_shingle', 'roof_slate', 'roof_shingle', 'roof'], temple: 'roof_slate', tree: 'snow_pine', yard: ['woodpile', 'woodpile', 'barrel', 'sack'] },
    elven: { green: [[0.05, 'tree'], [0.04, 'flowers'], [0.02, 'bush'], [0.01, 'fern']], base: 'grass', street: 'gravel', walk: 'paving', alley: 'gravel', plaza: 'paving', mosaic: 'tiles', floor: 'wood', wall: 'wall_wood', roofs: ['roof_green', 'roof_thatch', 'roof_green', 'roof_slate'], temple: 'roof_green', tree: 'tree', yard: ['flowers', 'bush', 'planter', 'well'] },
    desert: { townWall: 'wall_sandstone', green: [[0.012, 'palm'], [0.006, 'cactus'], [0.004, 'rock']], base: 'sand', street: 'paving', walk: 'sandstone', alley: 'gravel', plaza: 'sandstone', mosaic: 'tiles', gardens: ['yard'], floor: 'sandstone', wall: 'wall_sandstone', roofs: ['roof_flat', 'roof_flat', 'roof_flat', 'roof'], temple: 'roof_flat', tree: 'palm', yard: ['basket', 'sack', 'crate', 'palm'], stalls: 5 },
    swamp: { boardwalk: true, base: 'swamp', street: 'wood', walk: null, alley: 'wood', plaza: 'cobble', mosaic: 'gravel', green: [[0.05, 'reeds'], [0.015, 'dead_tree'], [0.012, 'mushrooms'], [0.01, 'bush']], floor: 'wood', wall: 'wall_wood', roofs: ['roof_thatch', 'roof_thatch', 'roof_shingle'], temple: 'roof_thatch', tree: 'dead_tree', yard: ['reeds', 'barrel', 'mushrooms', 'crate'] },
    jungle: { townWall: 'wall_wood', green: [[0.04, 'jungle_tree'], [0.04, 'fern'], [0.02, 'bush'], [0.012, 'palm']], base: 'jungle', street: 'brick', walk: 'gravel', alley: 'dirt', plaza: 'brick', mosaic: 'tiles', floor: 'wood', wall: 'wall_wood', roofs: ['roof_thatch', 'roof', 'roof_thatch', 'roof_green'], temple: 'roof', tree: 'palm', yard: ['basket', 'fern', 'barrel', 'crate'] },
    capital: { green: [[0.02, 'tree'], [0.03, 'flowers'], [0.01, 'bush']], base: 'grass', street: 'cobble', walk: 'paving', alley: 'gravel', plaza: 'paving', mosaic: 'brick', floor: 'wood', wall: 'wall_stone', roofs: ['roof', 'roof_slate', 'roof', 'roof_green'], temple: 'roof_slate', tree: 'tree', yard: ['flowers', 'bush', 'well', 'woodpile'] },
  };
  const NATURAL = ['grass', 'sand', 'snow', 'jungle', 'swamp', 'ash'];

  // Lay a street from a to b (a straight line), width tiles wide, with pavements on
  // both sides if walk is given. Returns the two frontages along it: where buildings
  // may stand, facing the street: { dir: which way from the street, line: the
  // coordinate of their front walls, a0..a1: how far along }.
  function street(t, [ax, ay], [bx, by], width, ground, walk) {
    const across = ay === by ? 'y' : 'x', lo = Math.floor((width - 1) / 2);
    const c0 = (across === 'y' ? ay : ax) - lo, c1 = c0 + width - 1, w0 = walk ? c0 - 1 : c0, w1 = walk ? c1 + 1 : c1;
    const a0 = Math.min(across === 'y' ? ax : ay, across === 'y' ? bx : by), a1 = Math.max(across === 'y' ? ax : ay, across === 'y' ? bx : by);
    for (let a = a0; a <= a1; a++) for (let c = w0; c <= w1; c++) {
      const [x, y] = across === 'y' ? [a, c] : [c, a];
      if (!inMap(x, y) || (t.used[y * W + x] === 2)) continue; // the square and the temple keep their ground
      if (groundAt(x, y) === 'water' && !t.st.boardwalk) continue;
      const edge = c < c0 || c > c1;
      if (!edge || ['water', ...NATURAL, t.st.base].includes(groundAt(x, y))) m.setGround(x, y, S, edge ? walk : ground);
      t.used[y * W + x] = 1;
      t.streets.push([x, y, edge]);
    }
    return across === 'y'
      ? [{ dir: 'n', line: w0 - 1, a0, a1, walk: walk ? w0 : null }, { dir: 's', line: w1 + 1, a0, a1, walk: walk ? w1 : null }]
      : [{ dir: 'w', line: w0 - 1, a0, a1, walk: walk ? w0 : null }, { dir: 'e', line: w1 + 1, a0, a1, walk: walk ? w1 : null }];
  }
  // A lot of w tiles along frontage f, d tiles deep, starting a along it.
  const lotRect = (f, a, w, d) => ({
    n: { x0: a, x1: a + w - 1, y0: f.line - d + 1, y1: f.line },
    s: { x0: a, x1: a + w - 1, y0: f.line, y1: f.line + d - 1 },
    w: { x0: f.line - d + 1, x1: f.line, y0: a, y1: a + w - 1 },
    e: { x0: f.line, x1: f.line + d - 1, y0: a, y1: a + w - 1 },
  })[f.dir];
  // Room for a lot: open, natural, unused ground, with a tile to spare around it (but
  // not in front: that's the street).
  function lotFits(t, f, L) {
    for (let y = L.y0 - 1; y <= L.y1 + 1; y++) for (let x = L.x0 - 1; x <= L.x1 + 1; x++) {
      const front = (f.dir === 'n' && y > L.y1) || (f.dir === 's' && y < L.y0) || (f.dir === 'w' && x > L.x1) || (f.dir === 'e' && x < L.x0);
      if (front) continue;
      if (!inMap(x, y) || Math.abs(x - t.x) > t.rx || Math.abs(y - t.y) > t.ry) return false;
      const i = y * W + x, here = m.get(x, y, S);
      if (t.used[i] || reserved[i] || here.items.length || !(NATURAL.includes(here.ground) || here.ground === t.st.base)) return false;
    }
    return true;
  }
  function claimLot(t, L) {
    for (let y = L.y0 - 1; y <= L.y1 + 1; y++) for (let x = L.x0 - 1; x <= L.x1 + 1; x++) if (inMap(x, y) && !t.used[y * W + x]) t.used[y * W + x] = 3;
  }
  // Lots of sizes [w0, w1] x [d0, d1] along frontage f, as many as fit.
  function lotsAlong(t, f, [w0, w1], [d0, d1], gap) {
    const lots = [];
    for (let a = f.a0 + 1; a <= f.a1;) {
      const w = w0 + Math.floor(r() * (w1 - w0 + 1)), d = d0 + Math.floor(r() * (d1 - d0 + 1));
      const L = lotRect(f, a, w, d);
      if (a + w - 1 > f.a1 || !lotFits(t, f, L)) { a++; continue; }
      claimLot(t, L);
      lots.push({ ...L, f, w, d });
      a += w + gap + (r() < 0.35 ? 1 : 0);
    }
    return lots;
  }
  // From a lot's own view: u along its front, v back from its front wall.
  const lotAt = (L, u, v) => ({
    n: [L.x0 + u, L.y1 - v], s: [L.x0 + u, L.y0 + v], w: [L.x1 - v, L.y0 + u], e: [L.x0 + v, L.y0 + u],
  })[L.f.dir];

  // A building on a lot. kind: shop, hall, bank, inn, smithy or house; who: the NPC in it.
  function townBuilding(t, L, kind, who) {
    const st = t.st, mid = Math.floor(L.w / 2), [dx, dy] = lotAt(L, mid, 0);
    const twoFloors = kind === 'inn' || kind === 'hall' || (kind === 'house' && L.w >= 6 && L.d >= 6 && r() < 0.3);
    const roof = kind === 'hall' ? st.temple : oneOf(st.roofs);
    building({ x0: L.x0, y0: L.y0, x1: L.x1, y1: L.y1, floor: kind === 'bank' ? 'marble' : st.floor, wall: st.wall, roof: twoFloors ? null : roof, doors: [[dx, dy, kind === 'house' ? 'door_closed' : 'door']] });
    for (let z = S; z <= (twoFloors ? S + 1 : S); z++) shelter(L.x0, L.y0, L.x1, L.y1, z);
    const at = (u, v) => lotAt(L, u, v);
    const inside = (u, v, id, z = S) => {
      if (u < 1 || v < 1 || u > L.w - 2 || v > L.d - 2 || (u === mid && v === 1)) return false;
      const [x, y] = at(u, v), here = m.get(x, y, z);
      if (here.items.length) return false;
      put(x, y, z, id);
      return true;
    };
    const keep = (u, v) => { const [x, y] = at(u, v); t.keep.add(`${x},${y}`); };
    keep(mid, -1);
    keep(mid, 1);
    // windows on the front and the sides
    for (let u = 1; u < L.w - 1; u += 2) if (Math.abs(u - mid) >= 2) put(...at(u, 0), S, 'window');
    put(...at(0, Math.floor(L.d / 2)), S, 'window');
    put(...at(L.w - 1, Math.floor(L.d / 2)), S, 'window');
    // a sign by the door of anything that isn't a home
    if (who || kind === 'inn') {
      const [sx, sy] = at(mid + 1, 0), here = m.get(sx, sy, S);
      here.items = here.items.filter(id => id !== 'window');
      sign(sx, sy, S, 'sign_wall', kind === 'inn' ? t.inn : `${NPCS[who].name}${NPCS[who].trade ? ' - come in and trade!' : ''}`);
    }
    const back = L.d - 2, side = L.w - 2;
    // someone who lives or sits here: on a free spot in the room, not in the doorway
    const resident = type => {
      for (let v = 2; v <= back; v++) for (let u = 1; u <= side; u++) {
        const [x, y] = at(u, v), here = m.get(x, y, S);
        if (!here.items.some(id => THINGS[id].block) && !m.npcs.some(n => n.x === x && n.y === y && n.z === S)) return void npc(type, x, y);
      }
    };
    if (kind === 'shop' || kind === 'bank') {
      for (let u = 1; u <= side; u++) inside(u, back - 1, 'counter');
      npc(who, ...at(mid, back));
      inside(1, back, kind === 'bank' ? 'chest' : 'barrel');
      inside(side, back, kind === 'bank' ? 'chest' : oneOf(['crate', 'bookshelf', 'barrel']));
      inside(1, 1, 'plant');
      if (kind === 'shop' && L.f.walk !== null) for (const u of [mid - 2, mid + 2]) { // goods out front
        const [x, y] = at(u, -1);
        if (!t.keep.has(`${x},${y}`) && !m.get(x, y, S).items.length && r() < 0.6) put(x, y, S, oneOf(['barrel', 'crate', 'basket']));
      }
    } else if (kind === 'smithy') {
      inside(1, back, 'campfire');
      inside(2, back, 'anvil');
      inside(side, back, 'barrel');
      inside(side, 1, 'crate');
      if (who) npc(who, ...at(mid, back - 1));
    } else if (kind === 'hall') {
      put(...at(mid, back), S, 'throne');
      npc(who, ...at(mid, back - 1));
      for (let u = 1; u <= side; u++) if (Math.abs(u - mid) > 1) inside(u, back, 'bookshelf');
      inside(1, 2, 'banner');
      for (const u of [1, side]) inside(u, Math.max(2, back - 2), 'torch');
      for (let v = 2; v < back; v++) { const [x, y] = at(mid, v); m.setGround(x, y, S, 'carpet'); }
    } else if (kind === 'inn') {
      for (let u = 1; u <= Math.min(3, side); u++) inside(u, back - 1, 'counter');
      npc('innkeeper', ...at(1, back));
      inside(side, back, 'barrel');
      inside(side, back - 1, 'barrel');
      inside(side, 1, 'campfire');
      for (let u = mid - 1; u <= side - 1; u += 3) for (let v = 2; v <= back - 2; v += 3) if (inside(u, v, 'table')) { inside(u - 1, v, 'chair'); inside(u + 1, v, 'chair'); }
      resident('guest');
    } else { // a home
      const bedU = r() < 0.5 ? 1 : side;
      inside(bedU, back, 'bed');
      if (inside(mid, Math.max(2, back - 1), 'table')) inside(mid + 1, Math.max(2, back - 1), 'chair');
      inside(bedU === 1 ? side : 1, back, oneOf(['chest', 'bookshelf', 'barrel']));
      inside(bedU === 1 ? side : 1, 1, oneOf(['plant', 'barrel', 'chair']));
      if (who) resident(who);
    }
    // upstairs: more rooms, and the roof one floor higher
    let roofZ = S + 1;
    if (twoFloors) {
      building({ x0: L.x0, y0: L.y0, x1: L.x1, y1: L.y1, z: S + 1, floor: 'wood', wall: st.wall, roof });
      roofZ = S + 2;
      const su = mid > 1 ? 1 : side, sv = 1;
      const [sx, sy] = at(su, sv);
      m.ensure(sx, sy, S).items = ['stairs_up'];
      put(sx, sy, S + 1, 'stairs_down');
      for (let u = 1; u < L.w - 1; u += 2) put(...at(u, 0), S + 1, 'window');
      for (let u = 1; u <= side; u += 2) {
        const [x, y] = at(u, back);
        if (!(u === su && back === sv)) put(x, y, S + 1, kind === 'hall' ? 'bookshelf' : 'bed');
      }
      const [cx, cy] = at(side, 1);
      if (!(side === su)) put(cx, cy, S + 1, 'chest');
    }
    if (roof !== 'roof_flat' && kind !== 'hall' && kind !== 'bank') put(...at(L.w - 2, L.d - 2), roofZ, 'chimney');
    else if (roof === 'roof_flat' && r() < 0.7) put(...at(1 + Math.floor(r() * (L.w - 2)), 1 + Math.floor(r() * (L.d - 2))), roofZ, oneOf(['basket', 'sack', 'plant', 'crate'])); // life on the roofs
  }

  // A garden or a yard on a lot, open to the street: flower beds, a vegetable patch,
  // or a yard with firewood, barrels, a well or a wagon - and often a tree at the back.
  function townGarden(t, L) {
    const st = t.st, fill = oneOf(st.gardens || ['flowers', 'crops', 'yard', 'yard']);
    for (let u = 0; u < L.w; u++) for (let v = 0; v < L.d; v++) {
      const [x, y] = lotAt(L, u, v), inner = u > 0 && v > 0 && u < L.w - 1 && v < L.d - 1;
      if (fill === 'flowers') {
        if (inner && r() < 0.45) put(x, y, S, r() < 0.8 ? 'flowers' : 'bush');
      } else if (fill === 'crops' && inner) {
        m.setGround(x, y, S, 'farmland');
        if (u % 2) put(x, y, S, 'crops');
      } else if (fill === 'yard' && inner && r() < 0.18) put(x, y, S, oneOf(st.yard));
    }
    if (fill === 'yard' && r() < 0.5) {
      const [wx, wy] = lotAt(L, 1, L.d - 2);
      m.get(wx, wy, S).items = [oneOf(['well', 'wagon', 'haystack'])];
    }
    const [tx, ty] = lotAt(L, L.w - 1, L.d - 1);
    if (st.tree && fill !== 'crops') m.get(tx, ty, S).items = [st.tree];
    reserve(L.x0, L.y0, L.x1, L.y1);
  }

  // A quarter added to a town made by hand: streets [[from, to, width, 'street'|'alley']]
  // with buildings along them (an inn, and homes), and townsfolk.
  function district(o) {
    const st = TOWN_STYLES[o.style], t = { x: o.x, y: o.y, st, rx: o.rx, ry: o.ry, used: new Uint8Array(W * H), streets: [], keep: new Set(), inn: o.inn };
    for (let yy = o.y - o.ry; yy <= o.y + o.ry; yy++) for (let xx = o.x - o.rx; xx <= o.x + o.rx; xx++) if (inMap(xx, yy)) townArea[yy * W + xx] = 1;
    const fronts = o.streets.flatMap(([a, b, width, kind]) => street(t, a, b, width, kind === 'street' ? st.street : st.alley, kind === 'street' ? st.walk : null));
    const lots = fronts.flatMap(f => lotsAlong(t, f, [5, 7], [5, 6], 1));
    lots.forEach((L, i) => {
      if (i === 0 && o.inn) townBuilding(t, L, 'inn');
      else if (r() < 0.2) townGarden(t, L);
      else townBuilding(t, L, 'house');
    });
    for (const f of fronts) for (const L of lotsAlong(t, f, [3, 4], [3, 4], 0)) townGarden(t, L);
    for (const f of fronts) {
      if (f.walk === null) continue;
      for (let a = f.a0 + 2; a <= f.a1 - 1; a += 6) {
        const [lx, ly] = f.dir === 'n' || f.dir === 's' ? [a, f.walk] : [f.walk, a];
        if (!t.keep.has(`${lx},${ly}`) && !m.get(lx, ly, S).items.length) put(lx, ly, S, 'lamppost');
      }
    }
    const spots = t.streets.filter(([sx, sy]) => !m.get(sx, sy, S).items.length && !t.keep.has(`${sx},${sy}`));
    for (const who of spots.length ? o.folk || [] : []) { const [fx, fy] = oneOf(spots); npc(who, fx, fy); }
    reserve(o.x - o.rx, o.y - o.ry, o.x + o.rx, o.y + o.ry);
  }
  // Townsfolk and things for a square made by hand: each on the nearest free tile to where it's asked for.
  function freeNear(x, y, z = S) {
    for (let d = 0; d < 6; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
      const t = m.get(x + dx, y + dy, z);
      if (t && t.ground && !THINGS[t.ground].block && !t.items.length && !m.npcs.some(n => n.x === x + dx && n.y === y + dy && n.z === z)) return [x + dx, y + dy];
    }
    return [x, y];
  }
  const folkAt = (list, z = S) => { for (const [who, x, y] of list) npc(who, ...freeNear(x, y, z), z); };

  // A whole town. o: { x, y: the middle of the square; style; reach / reachSouth /
  // reachNorth: how far its main streets go; priest; people: [[npc, kind]]: who has a building, and
  // what kind; folk: NPCs out on the streets; inn: its name; sign: the square's sign }
  function city(o) {
    const st = TOWN_STYLES[o.style], { x, y } = o, reach = o.reach || 30, reachS = o.reachSouth || 24, reachN = o.reachNorth || 24;
    const t = { x, y, st, rx: reach + 4, ry: Math.max(reachS, reachN) + 4, used: new Uint8Array(W * H), streets: [], keep: new Set(), inn: o.inn || 'The Inn' };
    // clear the ground: the town's own (keeping the water in a swamp town)
    for (let yy = y - t.ry - 2; yy <= y + t.ry + 2; yy++) for (let xx = x - t.rx - 2; xx <= x + t.rx + 2; xx++) {
      if (!inMap(xx, yy) || ((xx - x) / (t.rx + 2)) ** 2 + ((yy - y) / (t.ry + 2)) ** 2 > 1) continue;
      if (NATURAL.includes(groundAt(xx, yy)) && !m.get(xx, yy, S).items.length) m.setGround(xx, yy, S, st.base);
      townArea[yy * W + xx] = 1;
    }
    // the square: square, round or long, and in its middle a fountain, a well, a statue, an obelisk or an old tree
    const shape = o.square || oneOf(['square', 'round', 'long']), centre = o.centre || oneOf(['fountain', 'fountain', 'well', 'statue', 'obelisk', 'ancient_tree']);
    const hw = shape === 'long' ? 11 : 8, hh = shape === 'long' ? 4 : 5;
    const px0 = x - hw, px1 = x + hw, py0 = y - hh, py1 = y + hh;
    for (let yy = py0; yy <= py1; yy++) for (let xx = px0; xx <= px1; xx++) {
      if (shape === 'round' && ((xx - x) / (hw + 0.5)) ** 2 + ((yy - y) / (hh + 0.5)) ** 2 > 1 && Math.abs(yy - y) > 1 && Math.abs(xx - x) > 1) continue;
      const ring = centre !== 'ancient_tree' && Math.abs(xx - x + 0.5) <= 3.5 && Math.abs(yy - y + 0.5) <= 3.5;
      m.setGround(xx, yy, S, ring ? st.mosaic : centre === 'ancient_tree' && Math.hypot(xx - x, yy - y) < 2.5 ? 'grass' : st.plaza);
      t.used[yy * W + xx] = 2;
    }
    if (centre === 'fountain') for (const [fx, fy] of [[x - 1, y - 1], [x, y - 1], [x - 1, y]]) put(fx, fy, S, 'fountain_rim');
    put(x, y, S, centre);
    for (const [bx, by] of [[x - 4, y - 1], [x + 3, y - 1], [x - 4, y + 1], [x + 3, y + 1]]) put(bx, by, S, 'bench');
    for (const [lx, ly] of [[px0 + 1, py0 + 1], [px1 - 1, py0 + 1], [px0 + 1, py1 - 1], [px1 - 1, py1 - 1]]) put(lx, ly, S, 'lamppost');
    sign(x - 3, py0 + 1, S, 'signpost', o.sign);
    sign(x + 5, py0 + 1, S, 'noticeboard', o.notice || 'NOTICE: Adventurers wanted! Ask the townsfolk for news - and mind the camps in the wilds, they all have a chief.');
    // market stalls along the south side, a trader behind each of the first ones
    const stalls = [x - 6, x + 5, x - 4, x + 3, x - 2].slice(0, st.stalls || 3);
    stalls.forEach((sx, i) => {
      put(sx, py1 - 1, S, 'stall');
      put(sx + (sx < x ? -1 : 1), py1 - 1, S, oneOf(['basket', 'crate', 'sack']));
      if (i < (o.vendors ?? 1)) npc('vendor', sx, py1 - 2);
    });
    // the temple, north of the square
    const ty1 = py0 - 2, ty0 = ty1 - 9;
    building({ x0: x - 6, y0: ty0, x1: x + 6, y1: ty1, floor: 'marble', wall: st.wall === 'wall_wood' ? 'wall_stone' : st.wall, roof: st.temple, doors: [[x, ty1]] });
    for (let yy = ty0; yy <= ty1; yy++) for (let xx = x - 6; xx <= x + 6; xx++) t.used[yy * W + xx] = 2;
    m.zones.push({ x0: x - 6, y0: ty0, x1: x + 6, y1: ty1, z: S });
    for (let yy = ty0 + 3; yy < ty1; yy++) m.setGround(x, yy, S, 'carpet');
    put(x, ty0 + 1, S, 'altar');
    put(x - 4, ty0 + 1, S, 'torch'); put(x + 4, ty0 + 1, S, 'torch');
    for (const [qx, qy] of [[x - 3, ty0 + 4], [x + 3, ty0 + 4], [x - 3, ty0 + 7], [x + 3, ty0 + 7]]) put(qx, qy, S, 'pillar');
    put(x + 5, ty1 - 1, S, 'depot'); put(x - 5, ty1 - 1, S, 'plant');
    for (const wx of [x - 3, x + 3]) put(wx, ty1, S, 'window');
    for (const wy of [ty0 + 3, ty0 + 6]) { put(x - 6, wy, S, 'window'); put(x + 6, wy, S, 'window'); }
    npc(o.priest, x - 2, ty0 + 3);
    if (NPCS[o.priest].home) m.temples.push({ home: NPCS[o.priest].home.toLowerCase(), town: NPCS[o.priest].home, npc: o.priest, x, y: ty0 + 5, z: S });
    for (let xx = x - 1; xx <= x + 1; xx++) { m.setGround(xx, ty1 + 1, S, st.plaza); t.used[(ty1 + 1) * W + xx] = 2; }
    for (const px of [x - 5, x + 5]) put(px, ty1 + 1, S, 'planter');
    for (let xx = x - 6; xx <= x + 6; xx++) if (!t.used[(ty1 + 1) * W + xx]) t.used[(ty1 + 1) * W + xx] = 3;

    // the streets: main streets west, east and south; side streets off them
    const fronts = [], side = () => 13 + Math.floor(r() * 8), long = () => 11 + Math.floor(r() * 8);
    fronts.push(...street(t, [px0 - 1, y], [x - reach, y], 3, st.street, st.walk));
    fronts.push(...street(t, [px1 + 1, y], [x + reach, y], 3, st.street, st.walk));
    fronts.push(...street(t, [x, py1 + 1], [x, y + reachS], 3, st.street, st.walk));
    fronts.push(...street(t, [x + 9, py0 - 1], [x + 9, y - reachN], 3, st.street, st.walk));
    const sides = [];
    for (const dir of [-1, 1]) {
      const sx = x + dir * side();
      if (r() < 0.85) sides.push(...street(t, [sx, y - 3], [sx, y - 3 - long()], 2, st.alley, null));
      if (r() < 0.85) sides.push(...street(t, [sx, y + 3], [sx, y + 3 + long()], 2, st.alley, null));
    }
    const back = 13 + Math.floor(r() * 4), front = 14 + Math.floor(r() * 4);
    if (r() < 0.8) sides.push(...street(t, [x - 3, y + front], [x - reach + 2 + Math.floor(r() * 6), y + front], 2, st.alley, null));
    if (r() < 0.8) sides.push(...street(t, [x + 3, y + front], [x + reach - 2 - Math.floor(r() * 6), y + front], 2, st.alley, null));
    if (r() < 0.7) sides.push(...street(t, [x - 8, y - back], [x - reach + 2 + Math.floor(r() * 6), y - back], 2, st.alley, null));
    if (r() < 0.7) sides.push(...street(t, [x + 12, y - back], [x + reach - 2 - Math.floor(r() * 6), y - back], 2, st.alley, null));
    // where the roads out of town start
    t.exits = { w: [x - reach, y], e: [x + reach, y], s: [x, y + reachS], n: [x + 9, y - reachN] };

    // buildings along the main streets first (the shops want to be near the square), then the side streets
    const lots = [...fronts.flatMap(f => lotsAlong(t, f, [5, 8], [5, 7], 1)), ...sides.flatMap(f => lotsAlong(t, f, [5, 7], [5, 6], 1))];
    const dist2 = L => ((L.x0 + L.x1) / 2 - x) ** 2 + ((L.y0 + L.y1) / 2 - y) ** 2;
    lots.sort((a, b) => dist2(a) - dist2(b));
    // Everyone with a job gets the nearest lot that suits it (the inn and halls want big ones),
    // or, with none of those left, the nearest lot there is: nobody goes without a building.
    const jobs = [...(o.people || []).map(([who, kind]) => [kind, who]), ['inn', null], ...(o.smithy !== false ? [['smithy', o.smith || null]] : [])];
    const taken = new Map();
    for (const job of jobs) {
      const big = job[0] === 'inn' || job[0] === 'hall';
      let i = lots.findIndex((L, j) => !taken.has(j) && (!big || (L.w >= 7 && L.d >= 6)));
      if (i < 0) i = lots.findIndex((L, j) => !taken.has(j));
      if (i >= 0) taken.set(i, job);
    }
    lots.forEach((L, i) => {
      if (taken.has(i)) townBuilding(t, L, ...taken.get(i));
      else if (r() < 0.22) townGarden(t, L);
      else townBuilding(t, L, 'house');
    });
    // cottages in the gaps, then gardens and yards in what's left
    for (const f of [...fronts, ...sides]) for (const L of lotsAlong(t, f, [4, 5], [4, 5], 1)) {
      if (r() < 0.75) townBuilding(t, L, 'house');
      else townGarden(t, L);
    }
    for (const f of [...fronts, ...sides]) for (const L of lotsAlong(t, f, [3, 4], [3, 4], 0)) townGarden(t, L);
    // and the local trees and plants on the open ground between
    for (let yy = y - t.ry; yy <= y + t.ry; yy++) for (let xx = x - t.rx; xx <= x + t.rx; xx++) {
      if (!inMap(xx, yy) || !townArea[yy * W + xx] || t.used[yy * W + xx] || m.get(xx, yy, S).items.length || groundAt(xx, yy) !== st.base) continue;
      let v = r();
      for (const [chance, id] of st.green || []) {
        if (v < chance) { put(xx, yy, S, id); break; }
        v -= chance;
      }
    }

    // lamps, trees and benches along the pavements
    let n = 0;
    for (const f of fronts) {
      if (f.walk === null) continue;
      for (let a = f.a0 + 3; a <= f.a1 - 1; a += 4) {
        const [lx, ly] = f.dir === 'n' || f.dir === 's' ? [a, f.walk] : [f.walk, a];
        if (t.keep.has(`${lx},${ly}`) || m.get(lx, ly, S).items.length || groundAt(lx, ly) !== st.walk) continue; // only on the pavement (not where the street met the sea)
        const what = n++ % 3 === 0 ? 'lamppost' : st.tree && r() < 0.5 ? st.tree : r() < 0.3 ? 'bench' : null;
        if (what) put(lx, ly, S, what);
      }
    }
    // the townsfolk, on the streets near the square
    const near = t.streets.filter(([sx, sy, edge]) => Math.abs(sx - x) + Math.abs(sy - y) < 22 && !m.get(sx, sy, S).items.length && !t.keep.has(`${sx},${sy}`));
    for (const who of near.length ? o.folk || [] : []) {
      for (let tries = 0; tries < 20; tries++) {
        const [fx, fy] = oneOf(near);
        if (m.npcs.some(p => p.x === fx && p.y === fy && p.z === S)) continue;
        npc(who, fx, fy);
        break;
      }
    }
    // a guard where the main street leaves town towards the south
    const [gx, gy] = t.exits.s;
    if (o.guards !== false && m.get(gx, gy, S) && !m.get(gx, gy, S).items.length) npc('guard', gx, gy);
    // a wall round the town (log palisade, or sandstone), with gates where the main streets go out
    if (st.townWall) {
      const wx0 = x - t.rx - 1, wx1 = x + t.rx + 1, wy0 = y - t.ry - 1, wy1 = y + t.ry + 1;
      const gate = (wx, wy) => ((wx === wx0 || wx === wx1) && Math.abs(wy - y) <= 2) || (wy === wy1 && Math.abs(wx - x) <= 2) || (wy === wy0 && Math.abs(wx - x - 9) <= 2);
      walls(wx0, wy0, wx1, wy1, S, st.townWall, (wx, wy) => !gate(wx, wy) && inMap(wx, wy) && NATURAL.concat(st.base).includes(groundAt(wx, wy)) && !m.get(wx, wy, S).items.length);
    }
    reserve(x - t.rx - 2, y - t.ry - 2, x + t.rx + 2, y + t.ry + 2);
    return t;
  }

  // ---- terrain: lands in the sea -------------------------------------------------
  // The land is a set of shapes - ovals, and winding necks of land between them -
  // roughened by noise into ragged coasts with bays, capes and islets off the shore,
  // except around the towns and landmarks, which keep the shores they were built on.
  // Further out lie islands of all sizes. The borders between the regions are ragged too.
  const LAND = [
    [32, 40, 29, 34],                                         // Brightwater Isle
    [30, 94, 25, 15],                                         // Ashport
    [112, 58, 34, 38], [134, 22, 18, 13], [104, 92, 20, 13],  // mainland: core, north-east, south
    [144, 70, 13, 13], [84, 32, 13, 12],                      // mainland: east, west
    [166, 73, 16, 7], [184, 72, 10, 9],                       // land bridge east to the Highlands
    [236, 72, 56, 50], [240, 30, 36, 16], [290, 45, 22, 24],  // the Highlands
    [112, 108, 7, 8], [118, 118, 8, 8], [128, 128, 12, 10],   // a strip of land south from the mainland...
    [150, 145, 30, 20], [225, 145, 55, 32],                   // ...to the southlands
    [450, 70, 100, 55], [545, 42, 40, 30],                    // the Frost Reach
    [680, 120, 72, 95],                                       // the Elderwood
    [430, 235, 100, 68],                                      // the Ironpeak mountains
    [652, 375, 105, 112],                                     // the Sunreach desert
    [130, 300, 100, 72],                                      // the Mirefen
    [390, 432, 118, 62],                                      // the Tazal jungle
    [110, 455, 68, 40],                                       // Cinderhold
    [548, 166, 28, 20], [528, 150, 14, 12],                   // Greenhollow, between the Frost Reach and the Ironpeaks
    [262, 318, 11, 7], [286, 334, 9, 6], [268, 346, 8, 5], [298, 312, 7, 5], [250, 336, 6, 4], // the Shattered Isles
    [16, 205, 8, 30],                                         // the Seawall, a long isle in the west
  ];
  // Necks of land between the regions: [x0, y0, x1, y1, half width]. They wind.
  const BRIDGES = [
    [292, 48, 360, 62, 5], [575, 48, 625, 62, 5], [270, 100, 360, 220, 6], [150, 150, 140, 250, 5],
    [500, 260, 585, 330, 5], [680, 200, 670, 290, 5], [430, 285, 410, 395, 5], [200, 340, 300, 420, 5],
    [572, 165, 614, 156, 4],                                  // Greenhollow to the Elderwood
  ];
  const segDist = (x, y, [x0, y0, x1, y1]) => {
    const dx = x1 - x0, dy = y1 - y0, t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - x0 - t * dx, y - y0 - t * dy);
  };
  // Smooth noise, 0..1: a few octaves of random values on a grid, blended. (Math's
  // functions held close: inside the server's sandbox every lookup of Math is slow.)
  const { imul, floor, sqrt } = Math;
  const latticeAt = (x, y, seed) => {
    let h = imul(x, 374761393) ^ imul(y, 668265263) ^ imul(seed, 1274126177);
    h = imul(h ^ (h >>> 13), 1103515245);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const valueNoise = (x, y, seed) => {
    const xi = floor(x), yi = floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const a = latticeAt(xi, yi, seed), b = latticeAt(xi + 1, yi, seed), c = latticeAt(xi, yi + 1, seed), d = latticeAt(xi + 1, yi + 1, seed);
    return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
  };
  const noise = (x, y, seed, octaves = 3) => {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let o = 0; o < octaves; o++, amp /= 2, f *= 2) { sum += amp * valueNoise(x * f, y * f, seed + o * 31); norm += amp; }
    return sum / norm;
  };
  // How wild the land may be here: 0 at the towns and landmarks (they stay as built), 1 well away from them.
  const KEEP = [...MAP_TOWNS, ...MAP_SIGHTS].map(([, x, y]) => [x, y]);
  const wildness = (x, y) => {
    if (x < 165 && y < 115) return 0.25; // Brightwater, Ashport and Valoria, made by hand
    let near = Infinity;
    for (const [kx, ky] of KEEP) {
      const d2 = (x - kx) * (x - kx) + (y - ky) * (y - ky);
      if (d2 < near) near = d2;
    }
    const d = sqrt(near);
    return d < 32 ? 0 : d > 58 ? 1 : (d - 32) / 26;
  };
  // Biomes decide the ground and what grows on it: [cx, cy, rx, ry, biome]
  const TEMPERATE = 0, FROST = 1, FOREST = 2, HILLS = 3, DESERT = 4, SWAMP = 5, JUNGLE = 6, VOLCANO = 7;
  const BIOMES = [
    [450, 70, 112, 64, FROST], [545, 42, 50, 38, FROST], [680, 120, 82, 104, FOREST], [430, 235, 110, 76, HILLS],
    [652, 375, 116, 124, DESERT], [130, 300, 110, 82, SWAMP], [390, 432, 130, 72, JUNGLE], [110, 455, 78, 50, VOLCANO],
  ];
  const biome = new Uint8Array(W * H);
  // How far each tile is into the nearest piece of land (< 1 is land), worked out
  // shape by shape over just the tiles each shape covers.
  const landD = new Float32Array(W * H).fill(9);
  const stamp = (x0, y0, x1, y1, d) => {
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(W - 1, x1); x++) {
      const v = d(x, y), i = y * W + x;
      if (v < landD[i]) landD[i] = v;
    }
  };
  for (const [cx, cy, rx, ry] of LAND) stamp(cx - rx * 1.2, cy - ry * 1.2, cx + rx * 1.2, cy + ry * 1.2, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2);
  // The necks of land wind from end to end, and grow wider and narrower as they go.
  BRIDGES.forEach(([x0, y0, x1, y1, w], k) => {
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.ceil(len / 10)), px = -(y1 - y0) / len, py = (x1 - x0) / len;
    const points = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n, swing = (noise(i * 0.45, k * 7.3, 23, 2) - 0.5) * 2 * len * 0.2 * Math.sin(Math.PI * t);
      return [x0 + (x1 - x0) * t + px * swing, y0 + (y1 - y0) * t + py * swing, w * (0.7 + noise(i * 0.6, k * 3.1, 29, 2) * 0.7)];
    });
    for (let i = 0; i < n; i++) {
      const [ax, ay, aw] = points[i], [bx, by, bw] = points[i + 1], seg = [ax, ay, bx, by], ww = (aw + bw) / 2, pad = ww * 1.4;
      stamp(Math.min(ax, bx) - pad, Math.min(ay, by) - pad, Math.max(ax, bx) + pad, Math.max(ay, by) + pad, (x, y) => (segDist(x, y, seg) / ww) ** 2);
    }
  });
  // Islands out at sea, each with a story of its own (built at the end, see ISLE_STORIES):
  // [story, name, smallest and largest radius, where it would rather be: [x0, y0, x1, y1]]
  const ISLE_PLAN = [
    ['dragon', "Dragon's Perch", 10, 12], ['corsairs', "Corsair's Keep", 9, 11], ['giants', "The Giant's Table", 9, 11],
    ['frozen', 'The Frozen Rock', 6, 8, [180, 0, 768, 200]], ['ember', 'Ember Isle', 6, 8, [0, 380, 300, 512]],
    ['scorpions', 'Scorpion Dune', 5, 7, [480, 250, 768, 512]], ['serpent', 'Serpent Rock', 5, 7, [250, 360, 768, 512]],
    ['sunken', 'The Sunken Temple', 7, 9], ['monks', "The Monks' Retreat", 7, 9], ['battle', 'The Battle Isle', 7, 9],
    ['orchard', 'The Old Orchard', 7, 9], ['wreck', "Wreckers' Reef", 6, 7], ['smugglers', "Smugglers' Hole", 6, 8],
    ['witch', "The Witch's Isle", 6, 8], ['treasure', 'Treasure Island', 6, 8], ['echoes', 'The Isle of Echoes', 6, 8],
    ['webs', 'Web Isle', 6, 8], ['statues', 'The Statue Garden', 6, 8], ['bones', 'Bone Isle', 6, 8],
    ['wizard', "The Wizard's Folly", 6, 8], ['fishers', "The Fishers' Rest", 6, 8], ['fairy', 'The Fairy Ring', 6, 7],
    ['lighthouse', 'The Lighthouse', 5, 6], ['honey', 'Honey Isle', 5, 7], ['starfall', 'Starfall', 5, 7],
    ['hermit', "Hermit's Rock", 4, 5], ['castaway', "The Castaway's Sandbar", 4, 4], ['grave', 'The Lonely Grave', 4, 4],
  ];
  const ir = makeRng(777), ISLES = [], isleD = new Float32Array(W * H).fill(9);
  for (const [story, name, r0, r1, zone] of ISLE_PLAN) {
    for (let tries = 0; tries < 500; tries++) {
      const [zx0, zy0, zx1, zy1] = zone && tries < 300 ? zone : [0, 0, W, H];
      const rx = r0 + ir() * (r1 - r0), ry = rx * (0.7 + ir() * 0.3);
      const cx = Math.round(zx0 + 12 + ir() * (zx1 - zx0 - 24)), cy = Math.round(zy0 + 12 + ir() * (zy1 - zy0 - 24));
      if (cx - rx < 8 || cy - ry < 8 || cx + rx > W - 8 || cy + ry > H - 8) continue;
      let clear = true;
      for (let y = Math.floor(cy - ry - 5); y <= cy + ry + 5 && clear; y++) for (let x = Math.floor(cx - rx - 5); x <= cx + rx + 5; x++) {
        if (landD[y * W + x] < 3) { clear = false; break; }
      }
      if (!clear) continue;
      ISLES.push({ story, name, cx, cy, rx, ry });
      const shape = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      stamp(cx - rx * 1.3, cy - ry * 1.3, cx + rx * 1.3, cy + ry * 1.3, shape);
      for (let y = Math.floor(cy - ry * 1.6); y <= cy + ry * 1.6; y++) for (let x = Math.floor(cx - rx * 1.6); x <= cx + rx * 1.6; x++) if (inMap(x, y)) isleD[y * W + x] = Math.min(isleD[y * W + x], shape(x, y));
      reserve(Math.floor(cx - rx - 2), Math.floor(cy - ry - 2), Math.ceil(cx + rx + 2), Math.ceil(cy + ry + 2)); // the story's alone
      break;
    }
  }
  // Regions: the first listed wins, and their borders wander
  for (const [cx, cy, rx, ry, b] of [...BIOMES].reverse()) {
    for (let y = Math.max(0, cy - ry - 24); y <= Math.min(H - 1, cy + ry + 24); y++) for (let x = Math.max(0, cx - rx - 24); x <= Math.min(W - 1, cx + rx + 24); x++) {
      const wx = x + (noise(x / 38, y / 38, 41) - 0.5) * 48, wy = y + (noise(x / 38, y / 38, 43) - 0.5) * 48;
      if (((wx - cx) / rx) ** 2 + ((wy - cy) / ry) ** 2 < 1) biome[y * W + x] = b;
    }
  }
  const lr = makeRng(4321); // the coastline's own dice, so the rest of the world doesn't shift when it grows
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let d = landD[y * W + x] + 0.06 * (Math.sin(x * 0.45) + Math.cos(y * 0.38)) + (lr() - 0.5) * 0.06;
    if (d > 0.3 && d < 2.6) { // the coasts: bays and capes, and islets off the shore
      const wild = wildness(x, y) * (isleD[y * W + x] < 2.6 ? 0.35 : 1), edge = Math.min(1, (d - 0.3) / 0.5);
      if (wild > 0) d += ((noise(x / 60, y / 60, 17, 2) - 0.5) * 1.5 + (noise(x / 24, y / 24, 11) - 0.5) * 1.1 + (noise(x / 7, y / 7, 13) - 0.5) * 0.35) * wild * edge;
    }
    const b = biome[y * W + x];
    let ground = d < 0.82 ? 'grass' : d < 1 ? 'sand' : 'water';
    if (ground !== 'water') {
      const wobble = Math.sin(x * 0.3) + Math.cos(y * 0.27) + Math.sin((x + y) * 0.15);
      if (b === FROST) ground = 'snow';
      else if (b === DESERT) ground = 'sand';
      else if (b === VOLCANO) ground = 'ash';
      else if (b === JUNGLE && ground === 'grass') ground = 'jungle';
      else if (b === SWAMP && ground === 'grass') ground = wobble > 2.1 ? 'water' : wobble > -0.6 ? 'swamp' : 'grass';
    }
    m.setGround(x, y, S, ground);
  }

  // No nameless specks of land: what the rough coasts leave out at sea that is no
  // story's island goes back to the sea.
  {
    const seen = new Uint8Array(W * H);
    for (let start = 0; start < W * H; start++) {
      if (seen[start] || groundAt(start % W, (start - start % W) / W) === 'water') continue;
      const part = [start];
      seen[start] = 1;
      for (let k = 0; k < part.length && part.length < 400; k++) {
        const i = part[k], x = i % W, y = (i - x) / W;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, j = ny * W + nx;
          if (inMap(nx, ny) && !seen[j] && groundAt(nx, ny) !== 'water') { seen[j] = 1; part.push(j); }
        }
      }
      if (part.length < 400 && !part.some(i => isleD[i] < 1.2)) for (const i of part) m.setGround(i % W, (i - i % W) / W, S, 'water');
    }
  }

  // ---- underground: carve caves (rough) and crypts (square rooms) -----------------
  const CAVE = 1, CRYPT = 2;
  const carved = Array.from({ length: S }, () => new Uint8Array(W * H));
  const carve = (z, x, y, style = CAVE) => {
    if (x > 2 && y > 2 && x < W - 3 && y < H - 3) carved[z][y * W + x] = style;
  };
  const blob = (z, cx, cy, rx, ry) => {
    for (let y = cy - ry - 1; y <= cy + ry + 1; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (r() - 0.5) * 0.4 < 1) carve(z, x, y);
    }
  };
  const tunnel = (z, x0, y0, x1, y1) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / steps), y = Math.round(y0 + ((y1 - y0) * i) / steps);
      carve(z, x, y); carve(z, x + 1, y); carve(z, x, y + 1);
    }
  };
  const room = (z, x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) carve(z, x, y, CRYPT);
  };
  const clearAround = (z, x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!carved[z][(y + dy) * W + x + dx]) carve(z, x + dx, y + dy);
  };
  const isCarved = (z, x, y) => inMap(x, y) && carved[z][y * W + x];
  const torches = (z, list) => { for (const [x, y] of list) if (isCarved(z, x, y)) put(x, y, z, 'torch'); };
  const afterCarving = []; // things that need the underground already turned into floors and walls

  // ================================================================================
  // Brightwater Isle
  // ================================================================================

  // Village square, temple (where new characters start), smithy and shop
  fill(25, 34, 37, 43, S, 'cobble');
  reserve(23, 32, 39, 45);
  put(26, 34, S, 'barrel'); put(25, 43, S, 'flowers'); put(37, 34, S, 'flowers');

  building({ x0: 27, y0: 26, x1: 35, y1: 33, floor: 'marble', wall: 'wall_stone', roof: 'roof_slate', doors: [[31, 33]] });
  put(31, 27, S, 'altar'); put(28, 27, S, 'torch'); put(34, 27, S, 'torch');
  put(30, 26, S, 'painting_ship'); put(34, 32, S, 'depot');
  meta(30, 26, S, { look: 'A ship breaking up on black rocks under a red sky. On the frame: "The Gull\'s Wake, and her captain, who would not leave her."' });
  put(29, 33, S, 'window'); put(33, 33, S, 'window');
  npc('maren', 31, 29);
  m.start = { x: 31, y: 31, z: S };
  m.isle = { x0: 0, y0: 0, x1: 68, y1: 75 }; // the whole island, and the sea around it

  shop('bram', 16, 35, 22, 41, [22, 38], 19, 18, 38);
  put(17, 36, S, 'barrel'); put(17, 40, S, 'barrel'); put(21, 40, S, 'table');
  road(23, 38, 24, 38);

  shop('hilda', 40, 35, 46, 41, [40, 38], 43, 44, 38);
  put(45, 36, S, 'barrel'); put(45, 40, S, 'barrel');
  road(38, 38, 39, 38);

  npc('tomas', 38, 44);
  put(28, 40, S, 'well');
  for (const [x, y] of [[26, 36], [36, 36], [26, 42]]) put(x, y, S, 'lamppost');
  put(31, 42, S, 'bench');
  folkAt([['nella', 30, 41], ['cat', 27, 42], ['chicken', 20, 44]]);
  sign(33, 35, S, 'signpost', 'Brightwater village. Temple to the north, the smith to the west, Hilda\'s shop to the east, the Seer\'s tower to the south.');
  put(18, 41, S, 'window'); put(20, 41, S, 'window'); put(42, 41, S, 'window'); put(44, 41, S, 'window');

  // Vaelthorne: a protected town core with deliberately controlled exits.
  // The northern approach surrounds the temple; the wider southern enclosure
  // keeps the shops, square, cellar entrance and Seer's tower within the walls.
  // All gates use the editor's existing level-door metadata.
  const townWall = (x, y) => put(x, y, S, 'wall_stone');
  for (let x = 23; x <= 39; x++) if (x !== 24) townWall(x, 23);
  for (let y = 24; y <= 33; y++) { townWall(23, y); townWall(39, y); }
  for (let x = 13; x <= 22; x++) townWall(x, 33);
  for (let x = 40; x <= 48; x++) if (x !== 42) townWall(x, 33);
  for (let y = 34; y <= 53; y++) {
    if (y !== 38) townWall(13, y);
    townWall(48, y);
  }
  for (let x = 13; x <= 48; x++) if (x !== 21) townWall(x, 54);
  for (const [x, y, level] of [[24, 23, 2], [42, 33, 5], [13, 38, 6], [21, 54, 8]]) {
    put(x, y, S, 'door_level');
    meta(x, y, S, { level });
  }
  // A narrow bridge over the northern defensive ditch.
  for (let y = 20; y <= 22; y++) {
    m.setGround(23, y, S, 'water');
    m.setGround(25, y, S, 'water');
    m.setGround(24, y, S, 'bridge_ns');
  }
  // The square and town buildings are a protection zone, not a hunting area.
  m.zones.push({ x0: 14, y0: 34, x1: 47, y1: 53, z: S });
  m.zones.push({ x0: 24, y0: 24, x1: 38, y1: 33, z: S });

  // The Seer's tower: stairs to the first floor, where the Seer lives
  building({ x0: 28, y0: 47, x1: 34, y1: 52, floor: 'cobble', wall: 'wall_stone', roof: null, doors: [[31, 47]] });
  put(33, 51, S, 'stairs_up'); put(29, 48, S, 'torch');
  building({ x0: 28, y0: 47, x1: 34, y1: 52, z: S + 1, floor: 'wood', wall: 'wall_stone' });
  put(33, 51, S + 1, 'stairs_down'); put(29, 48, S + 1, 'bookshelf'); put(30, 48, S + 1, 'bookshelf'); put(29, 51, S + 1, 'table');
  npc('seer', 31, 49, S + 1);
  shelter(28, 47, 34, 52); shelter(28, 47, 34, 52, S + 1);
  road(31, 44, 31, 46);

  // Cellar below the square: rats and Hilda's lost parcel
  put(36, 42, S, 'stairs_down');
  clearAround(S - 1, 36, 42);
  tunnel(S - 1, 36, 42, 40, 43);
  blob(S - 1, 40, 43, 6, 4);
  tunnel(S - 1, 40, 43, 45, 48);
  blob(S - 1, 46, 48, 3, 2);
  clearAround(S - 1, 46, 48);
  put(36, 42, S - 1, 'stairs_up');
  put(47, 49, S - 1, 'qchest_parcel');
  spawn('rat', [[42, 44], [44, 46], [41, 41], [46, 47], [38, 43], [43, 42], [40, 45], [45, 44]], S - 1);

  // Northern forest: wolves, spiders and a hunter's hidden cache
  road(25, 34, 24, 23);
  reserve(18, 12, 22, 16);
  put(20, 14, S, 'qchest_hunter');
  spawn('wolf', [[26, 18], [34, 14], [42, 18], [16, 22], [30, 16], [22, 14]]);
  spawn('spider', [[28, 12], [38, 20], [21, 19], [33, 19], [25, 22]]);

  // Goblin camp east of the village
  for (let y = 18; y <= 32; y++) for (let x = 41; x <= 55; x++) {
    const d = Math.hypot(x - 48, y - 25);
    if (d < 5.5) m.setGround(x, y, S, 'dirt');
    if (d >= 5 && d < 6 && !(x < 45 && Math.abs(y - 25) <= 1)) put(x, y, S, 'fence');
  }
  reserve(41, 18, 55, 32);
  put(48, 25, S, 'campfire'); put(45, 22, S, 'tent'); put(51, 22, S, 'tent'); put(49, 29, S, 'tent');
  road(38, 34, 42, 25);
  spawn('goblin', [[47, 23], [50, 24], [46, 27], [50, 28], [52, 25], [48, 21], [45, 25], [51, 27], [48, 28]]);

  // Swamp to the north-west, home of Old Gnarl
  for (let y = 22; y <= 36; y++) for (let x = 5; x <= 21; x++) {
    const d = ((x - 13) / 6.5) ** 2 + ((y - 29) / 5.5) ** 2 + (r() - 0.5) * 0.3;
    if (d < 1 && groundAt(x, y) !== 'water') {
      m.setGround(x, y, S, 'swamp');
      reserved[y * W + x] = 1;
      const v = r();
      if (v < 0.12) put(x, y, S, 'reeds');
      else if (v < 0.16) put(x, y, S, 'mushrooms');
    }
  }
  fill(11, 27, 12, 28, S, 'water'); fill(15, 31, 16, 32, S, 'water');
  spawn('slime', [[11, 25], [17, 29], [13, 32], [9, 27], [15, 33]]);
  spawn('gnarl', [[9, 30]]);

  // Rats on the meadows
  spawn('rat', [[40, 48], [44, 45], [38, 52], [24, 46], [42, 50], [36, 47], [46, 52]]);

  // Graveyard and crypt to the south
  for (const [x, y, text] of [
    [15, 50, 'Here rests Wenna Lark, who kept the light on the cape for forty years.'],
    [18, 50, 'Here rest Bos and Hal, fishermen. The sea gave them back.'],
    [24, 50, 'Here rests old Tobbe. He told the best stories on the island, and believed every one of them.'],
    [15, 52, 'Here rest the crew of the Gull\'s Wake, as many as the sea gave back.'],
    [18, 52, 'Here rests Edda, who founded this village and dug its well.'],
    [24, 52, 'Here rests a stranger the tide brought in. We never learned his name.'],
    [27, 51, 'Here lies nobody. The sea kept Captain Varrow; we keep her stone. At the hour of nought her grave stands open, to any who would dig it.'],
  ]) {
    put(x, y, S, 'gravestone');
    meta(x, y, S, { look: text });
  }
  reserve(13, 48, 27, 54);
  building({ x0: 17, y0: 55, x1: 25, y1: 61, floor: 'cobble', wall: 'wall_stone', doors: [[21, 55]] });
  put(21, 59, S, 'stairs_down'); put(18, 56, S, 'torch'); put(24, 56, S, 'torch');
  road(25, 43, 21, 54);

  room(S - 1, 18, 57, 24, 60);  // entry
  room(S - 1, 12, 58, 17, 59);  // corridor west
  room(S - 1, 7, 55, 12, 63);   // west hall
  room(S - 1, 21, 61, 22, 65);  // corridor south
  room(S - 1, 16, 66, 26, 69);  // armory: pick one of three weapons
  room(S - 1, 3, 58, 6, 60);    // secret room behind a cracked rock
  put(21, 59, S - 1, 'stairs_up');
  put(18, 69, S - 1, 'qchest_longsword'); put(21, 69, S - 1, 'qchest_mace'); put(24, 69, S - 1, 'qchest_war_axe');
  spawn('skeleton', [[9, 57], [10, 61], [24, 58], [17, 67], [25, 67], [11, 58], [20, 66]], S - 1);
  spawn('spider', [[12, 57]]);
  afterCarving.push(() => {
    put(25, 65, S - 1, 'damp_wall');
    meta(25, 65, S - 1, { look: 'Water seeps from a crack and runs down the stone. Down here, so far from the sea, it tastes of salt.' });
  });

  // The southern cape, where an old ship broke up on the rocks
  for (const [x, y] of [[38, 70], [41, 70], [40, 71]]) {
    put(x, y, S, 'wreck');
    meta(x, y, S, { look: 'The black ribs of an old ship, half sunk in the surf. Gulls nest in them.' });
  }

  // ================================================================================
  // The mainland: city of Valoria
  // ================================================================================
  // The square: paving, and a fountain in a ring of brick
  for (let y = 51; y <= 62; y++) for (let x = 104; x <= 120; x++) m.setGround(x, y, S, Math.abs(x - 111.5) <= 4 && Math.abs(y - 56.5) <= 3 ? 'brick' : 'paving');
  reserve(102, 49, 122, 64);
  for (const [x, y] of [[104, 51], [120, 51], [104, 62], [120, 62]]) put(x, y, S, 'planter');

  building({ x0: 107, y0: 42, x1: 117, y1: 50, floor: 'marble', wall: 'wall_stone', roof: 'roof_slate', doors: [[112, 50]] });
  put(112, 43, S, 'altar'); put(108, 43, S, 'torch'); put(116, 43, S, 'torch');
  npc('ilsa', 110, 45);
  m.mainStart = { x: 112, y: 47, z: S };
  m.temples.push({ home: 'main', town: 'Valoria', npc: 'ilsa', ...m.mainStart });

  shop('dask', 93, 52, 101, 57, [101, 54], 96, 95, 54);
  shop('wynn', 93, 59, 101, 64, [101, 61], 96, 95, 61);
  shop('velan', 123, 52, 131, 57, [123, 54], 128, 129, 54);
  shop('orla', 123, 59, 131, 64, [123, 61], 128, 129, 61);
  put(94, 53, S, 'barrel'); put(94, 63, S, 'barrel'); put(130, 53, S, 'bookshelf'); put(130, 56, S, 'bookshelf'); put(130, 63, S, 'barrel');
  road(102, 54, 103, 54); road(102, 61, 103, 61); road(121, 54, 122, 54); road(121, 61, 122, 61);
  npc('rhea', 115, 60);
  npc('ostrom', 108, 58); npc('mira', 117, 54); npc('orin', 114, 45);
  put(115, 48, S, 'depot'); put(111, 42, S, 'painting'); put(113, 42, S, 'painting');
  sign(106, 52, S, 'signpost', 'Valoria. The temple and your depot are north, the bank is on the square. Ships to Ashport leave from the pier to the west.');
  for (const [x, y] of [[111, 56], [112, 56], [111, 57]]) put(x, y, S, 'fountain_rim');
  put(112, 57, S, 'fountain');
  for (const [x, y] of [[109, 55], [114, 55], [109, 59], [114, 59]]) put(x, y, S, 'bench');
  for (const [x, y] of [[105, 53], [119, 53], [105, 60], [119, 60]]) put(x, y, S, 'lamppost');
  for (const x of [107, 109, 115, 117]) put(x, 62, S, 'stall');
  put(106, 62, S, 'basket'); put(118, 62, S, 'crate');
  npc('vendor', 107, 61);
  sign(118, 52, S, 'noticeboard', 'NOTICE: The Glintvault Bank is east of the square. Orcs to the north-east, bandits to the south, and the mage tower east of town is NOT a tourist attraction.');
  // The lower town, south of the square, around the Golden Griffin
  district({
    x: 112, y: 75, style: 'capital', rx: 13, ry: 11, inn: 'The Golden Griffin',
    streets: [[[112, 63], [112, 86], 3, 'street'], [[100, 74], [124, 74], 2, 'alley']],
    folk: ['lysa', 'child', 'cat'],
  });
  folkAt([['bertram', 110, 53]]);
  // Pier and the road to it
  fill(74, 72, 84, 73, S, 'wood');
  reserve(72, 70, 86, 75);
  road(83, 66, 103, 63); road(84, 66, 84, 71);
  npc('bree', 76, 72);

  // Two houses with closed doors (right-click a door to open it)
  building({ x0: 92, y0: 42, x1: 99, y1: 48, doors: [[96, 48, 'door_house']] });
  put(94, 48, S, 'window'); put(98, 48, S, 'window');
  put(93, 43, S, 'table'); put(98, 43, S, 'chest'); put(93, 47, S, 'barrel');
  building({ x0: 124, y0: 42, x1: 131, y1: 48, doors: [[127, 48, 'door_house']] });
  put(125, 48, S, 'window'); put(130, 48, S, 'window');
  put(125, 43, S, 'bookshelf'); put(126, 43, S, 'bookshelf'); put(130, 46, S, 'table');

  // The Glintvault Bank, run by goblins. A mine cart takes you down to the vaults.
  fill(131, 34, 151, 50, S, 'grass');
  building({ x0: 133, y0: 36, x1: 149, y1: 48, floor: 'marble', wall: 'wall_stone', roof: 'roof_green', doors: [[133, 42]] });
  road(121, 40, 132, 42);
  for (let x = 136; x <= 145; x++) put(x, 40, S, 'counter');
  npc('vexlin', 140, 38); npc('snagg', 137, 38);
  for (const x of [137, 145]) put(x, 36, S, 'banner');
  for (const x of [138, 144]) put(x, 48, S, 'window');
  put(134, 37, S, 'torch'); put(134, 47, S, 'torch'); put(148, 47, S, 'torch');
  sign(132, 45, S, 'signpost', 'Glintvault Bank. Enter, stranger - but know that what is ours stays ours.');
  {
    const tiles = [VAULT_TRACK[0], ...trackTiles(VAULT_TRACK)];
    for (const [x, y, z] of tiles) if (z < S) carve(z, x, y); else put(x, y, z, 'rails');
    room(S - 2, 140, 56, 152, 66);   // the vaults
    room(S - 2, 144, 67, 152, 72);   // ...and the guard behind its bars
    npc('krook', 148, 60, S - 2);
    npc('vault_dragon', 148, 70, S - 2);
    afterCarving.push(() => {
      for (const [x, y, z] of tiles) if (z < S) put(x, y, z, 'rails');
      fill(140, 56, 152, 66, S - 2, 'marble');
      for (let x = 144; x <= 152; x++) put(x, 67, S - 2, 'bars');
      put(142, 57, S - 2, 'depot');
      for (const [x, y] of [[141, 64], [151, 57], [145, 65], [151, 65]]) put(x, y, S - 2, 'treasure');
      torches(S - 1, [[152, 47], [154, 57]]);
      torches(S - 2, [[151, 42], [161, 50], [141, 56], [152, 66]]);
    });
  }

  // Orc fortress to the north-east
  fill(127, 15, 141, 29, S, 'dirt');
  walls(126, 14, 142, 30, S, 'wall_wood', (x, y) => !(y === 30 && (x === 134 || x === 135)));
  reserve(124, 12, 144, 32);
  for (const [x, y] of [[129, 16], [133, 16], [137, 16], [140, 20], [129, 22], [140, 26]]) put(x, y, S, 'tent');
  put(134, 22, S, 'campfire'); put(127, 29, S, 'barrel'); put(141, 29, S, 'barrel');
  road(121, 50, 121, 36); road(121, 36, 134, 31);
  spawn('orc', [[130, 19], [138, 19], [131, 26], [137, 26], [134, 18], [134, 27], [126, 36], [118, 30]]);
  spawn('orc_archer', [[128, 18], [140, 17], [128, 27], [140, 28]]);
  spawn('orc_shaman', [[134, 24], [130, 22]]);

  // Bandit camp to the south
  for (let y = 85; y <= 99; y++) for (let x = 96; x <= 111; x++) if (Math.hypot(x - 103, y - 92) < 6.5) m.setGround(x, y, S, 'dirt');
  reserve(95, 84, 112, 100);
  for (const [x, y] of [[99, 89], [107, 89], [100, 96], [106, 96]]) put(x, y, S, 'tent');
  put(103, 92, S, 'campfire'); put(98, 93, S, 'crate'); put(109, 92, S, 'barrel');
  road(106, 86, 112, 63);
  spawn('bandit', [[101, 90], [105, 91], [102, 94], [106, 93], [99, 92]]);

  // Ogre caves to the north-west
  fill(82, 30, 86, 34, S, 'dirt');
  reserve(80, 28, 88, 36);
  put(84, 32, S, 'hole');
  put(83, 31, S, 'rock'); put(84, 31, S, 'rock'); put(85, 31, S, 'rock'); put(83, 32, S, 'rock');
  road(103, 50, 86, 34);
  blob(S - 1, 84, 32, 4, 3);
  tunnel(S - 1, 84, 32, 78, 41);
  blob(S - 1, 78, 43, 6, 4);
  tunnel(S - 1, 78, 43, 90, 47);
  blob(S - 1, 91, 47, 4, 3);
  clearAround(S - 1, 84, 32);
  clearAround(S - 1, 92, 47);
  put(84, 32, S - 1, 'ladder');
  clearAround(S - 1, 89, 48);
  put(93, 48, S - 1, 'qchest_hoard');
  spawn('ogre', [[79, 41], [75, 44], [82, 45], [89, 47], [86, 35]], S - 1);
  torches(S - 1, [[80, 42], [90, 46], [86, 33]]);

  // Dark mage tower to the east: three floors, the treasure at the top
  building({ x0: 140, y0: 66, x1: 148, y1: 74, floor: 'cobble', wall: 'wall_stone', roof: null, doors: [[140, 70]] });
  put(147, 67, S, 'stairs_up');
  building({ x0: 140, y0: 66, x1: 148, y1: 74, z: S + 1, floor: 'wood', wall: 'wall_stone', roof: null });
  put(147, 67, S + 1, 'stairs_down'); put(141, 73, S + 1, 'stairs_up'); put(144, 67, S + 1, 'bookshelf'); put(145, 67, S + 1, 'bookshelf');
  building({ x0: 140, y0: 66, x1: 148, y1: 74, z: S + 2, floor: 'wood', wall: 'wall_stone' });
  put(141, 73, S + 2, 'stairs_down'); put(147, 73, S + 2, 'qchest_tower'); put(144, 67, S + 2, 'altar');
  road(121, 58, 139, 70);
  spawn('dark_mage', [[144, 70]]);
  spawn('dark_mage', [[143, 70], [146, 72]], S + 1);
  spawn('dark_mage', [[144, 70], [146, 69]], S + 2);
  spawn('ghost', [[143, 72]], S + 2);
  put(146, 72, S + 2, 'teleport'); meta(146, 72, S + 2, { to: { x: 138, y: 70, z: S } });

  // Wilderness
  spawn('wolf', [[88, 60], [90, 72], [96, 80], [126, 84]]);
  spawn('kenny', [[90, 80]]); // he'll be back
  spawn('spider', [[86, 66], [132, 80]]);

  // ================================================================================
  // Ashport
  // ================================================================================
  fill(22, 90, 36, 96, S, 'paving');
  reserve(20, 88, 38, 98);
  put(29, 94, S, 'well');
  for (const [x, y] of [[22, 90], [36, 90], [22, 96], [36, 95]]) put(x, y, S, 'lamppost');
  building({ x0: 24, y0: 83, x1: 32, y1: 89, floor: 'marble', wall: 'wall_stone', roof: 'roof_slate', doors: [[28, 89]] });
  put(28, 84, S, 'altar'); put(31, 88, S, 'depot'); put(25, 84, S, 'torch'); put(31, 84, S, 'torch');
  put(26, 89, S, 'window'); put(30, 89, S, 'window');
  npc('aldo', 26, 86);
  shop('gus', 38, 89, 44, 95, [38, 92], 41, 43, 92);
  put(43, 90, S, 'barrel'); put(43, 94, S, 'crate');
  npc('marla', 24, 91); npc('finn', 34, 91);
  sign(23, 94, S, 'signpost', 'Ashport. Temple and depot to the north, Gus\'s store to the east, the harbour beyond it. Beware the ruin to the south-east.');
  // Harbour
  fill(50, 93, 58, 94, S, 'wood');
  reserve(48, 91, 59, 96);
  road(36, 97, 49, 94);
  npc('hal', 57, 93); npc('ida', 51, 94);
  for (const [x, y] of [[53, 92], [56, 95], [50, 96], [59, 91]]) if (groundAt(x, y) === 'water') put(x, y, S, 'boat');
  folkAt([['salty', 33, 92], ['fisher', 54, 94], ['cat', 26, 95]]);
  // Houses for rent
  building({ x0: 13, y0: 86, x1: 19, y1: 91, doors: [[19, 89, 'door_house']] });
  put(16, 91, S, 'window');
  building({ x0: 14, y0: 98, x1: 20, y1: 102, doors: [[17, 98, 'door_house']] });
  put(15, 102, S, 'window'); put(19, 102, S, 'window');
  // Lighthouse on the west tip
  building({ x0: 7, y0: 92, x1: 11, y1: 96, floor: 'cobble', wall: 'wall_stone', doors: [[11, 94]] });
  put(8, 93, S, 'torch');
  npc('keeper', 9, 94);
  shelter(7, 92, 11, 96);
  // Ruin with the way down to the pirate caves
  fill(39, 100, 45, 104, S, 'cobble');
  reserve(38, 99, 46, 105);
  for (const [x, y] of [[39, 100], [40, 100], [44, 100], [45, 101], [39, 104], [45, 104]]) put(x, y, S, 'wall_stone');
  put(42, 102, S, 'stairs_down');
  spawn('crab', [[16, 106], [44, 106], [8, 88], [50, 99]]);

  // Pirate caves below Ashport
  blob(S - 1, 42, 102, 3, 2);
  clearAround(S - 1, 42, 102);
  tunnel(S - 1, 40, 102, 31, 104);
  blob(S - 1, 28, 104, 5, 3);                   // pirate hall
  clearAround(S - 1, 31, 101); clearAround(S - 1, 25, 104); clearAround(S - 1, 29, 106);
  carve(S - 1, 28, 101); carve(S - 1, 28, 100);  // behind the secret wall...
  blob(S - 1, 28, 97, 2, 2);                    // ...the pirates' treasure nook
  room(S - 1, 45, 102, 49, 102);                // corridor: level gate and locked door
  room(S - 1, 50, 100, 53, 104);                // antechamber
  room(S - 1, 54, 102, 54, 102);                // sealed door
  room(S - 1, 55, 99, 60, 105);                 // the Drowned King's tomb
  spawn('pirate', [[27, 103], [30, 105], [31, 102], [25, 106]], S - 1);
  spawn('drowned_king', [[58, 102]], S - 1);

  // Buried cache on Brightwater's eastern beach
  carve(S - 1, 59, 40); blob(S - 1, 58, 41, 2, 2); clearAround(S - 1, 58, 41);


  // ================================================================================
  // The Highlands: Castle Greymoor
  // ================================================================================
  // Moat around it all, crossed by a bridge in the south
  for (let y = 33; y <= 73; y++) for (let x = 208; x <= 266; x++) {
    if (x <= 209 || x >= 265 || y <= 34 || y >= 72) m.setGround(x, y, S, x >= 236 && x <= 238 && y >= 72 ? 'wood' : 'water');
  }
  reserve(206, 31, 268, 75);
  fill(210, 35, 264, 71, S, 'grass');
  fill(216, 41, 258, 65, S, 'cobble');
  // Corner towers: two floors and a roof, doors into the courtyard
  const TOWERS = [[212, 37, 218, 42], [256, 37, 256, 42], [212, 63, 218, 64], [256, 63, 256, 64]];
  const inTower = (x, y) => TOWERS.some(([x0, y0]) => x >= x0 && x <= x0 + 6 && y >= y0 && y <= y0 + 6);
  for (const [x0, y0, dx, dy] of TOWERS) {
    building({ x0, y0, x1: x0 + 6, y1: y0 + 6, floor: 'cobble', wall: 'wall_stone', roof: null, doors: [[dx, dy]] });
    building({ x0, y0, x1: x0 + 6, y1: y0 + 6, z: S + 1, floor: 'wood', wall: 'wall_stone' });
    put(x0 + 1, y0 + 1, S, 'stairs_up'); put(x0 + 1, y0 + 1, S + 1, 'stairs_down');
    put(x0 + 5, y0 + 5, S, 'torch'); put(x0 + 5, y0 + 1, S + 1, 'barrel'); put(x0 + 1, y0 + 5, S + 1, 'bed');
    put(x0 + 3, y0 + 6, S + 1, 'window'); put(x0 + 3, y0, S + 1, 'window');
  }
  // Outer wall with a wide gate in the south
  walls(215, 40, 259, 66, S, 'wall_stone', (x, y) => !inTower(x, y) && !(y === 66 && x >= 236 && x <= 238));
  for (let x = 236; x <= 238; x++) put(x, 66, S, 'door');
  for (const x of [226, 248]) put(x, 66, S, 'banner');
  npc('greymoor_guard', 235, 75); npc('greymoor_guard', 239, 75);
  npc('brenna', 237, 63);
  sign(240, 75, S, 'signpost', 'Castle Greymoor. The king holds court in the keep. Harbour to the north, the cyclops mountain to the south-east, the Webwood beyond it.');

  // The keep: great hall with the throne, royal chambers above, a tower on top
  building({ x0: 226, y0: 42, x1: 248, y1: 52, floor: 'marble', wall: 'wall_stone', roof: null, doors: [[237, 52]] });
  fill(237, 44, 237, 51, S, 'carpet');
  put(237, 43, S, 'throne');
  npc('odran', 237, 44);
  for (const x of [232, 242]) { put(x, 46, S, 'torch'); put(x, 49, S, 'torch'); }
  for (const x of [229, 233, 241, 245]) put(x, 42, S, 'banner');
  put(227, 43, S, 'torch'); put(247, 43, S, 'torch'); put(227, 51, S, 'torch');
  put(229, 49, S, 'table'); put(230, 49, S, 'table'); put(244, 49, S, 'table'); put(245, 49, S, 'table');
  put(234, 52, S, 'window'); put(240, 52, S, 'window');
  put(247, 51, S, 'stairs_up');
  building({ x0: 226, y0: 42, x1: 248, y1: 52, z: S + 1, floor: 'wood', wall: 'wall_stone' });
  put(247, 51, S + 1, 'stairs_down'); put(241, 49, S + 1, 'stairs_up');
  put(228, 44, S + 1, 'bed'); put(230, 43, S + 1, 'bookshelf'); put(231, 43, S + 1, 'bookshelf'); put(228, 49, S + 1, 'table');
  npc('dobby', 233, 47, S + 1);
  put(245, 44, S + 1, 'chest'); put(232, 52, S + 1, 'window'); put(242, 52, S + 1, 'window'); put(237, 42, S + 1, 'painting');
  building({ x0: 232, y0: 44, x1: 242, y1: 50, z: S + 2, floor: 'cobble', wall: 'wall_stone' });
  put(241, 49, S + 2, 'stairs_down'); put(237, 44, S + 2, 'banner'); put(233, 45, S + 2, 'torch');

  // Around the courtyard: barracks, treasury, chapel and smithy
  building({ x0: 217, y0: 44, x1: 224, y1: 51, floor: 'wood', wall: 'wall_stone', doors: [[224, 48]] });
  for (const y of [45, 47, 49]) put(218, y, S, 'bed');
  put(223, 45, S, 'barrel'); put(222, 50, S, 'table');
  building({ x0: 250, y0: 44, x1: 257, y1: 51, floor: 'marble', wall: 'wall_stone', doors: [[250, 48]] });
  npc('pell', 253, 48); put(256, 45, S, 'depot'); put(256, 50, S, 'chest');
  building({ x0: 217, y0: 54, x1: 224, y1: 60, floor: 'marble', wall: 'wall_stone', doors: [[224, 57]] });
  put(220, 55, S, 'altar'); put(218, 55, S, 'torch'); put(223, 55, S, 'torch');
  npc('elin', 221, 57);
  building({ x0: 250, y0: 54, x1: 257, y1: 60, floor: 'cobble', wall: 'wall_stone', doors: [[250, 57]] });
  put(254, 55, S, 'anvil'); put(256, 59, S, 'campfire'); put(256, 55, S, 'barrel');
  shelter(250, 54, 257, 60); shelter(217, 44, 224, 51);
  npc('torvald', 253, 57);
  put(237, 59, S, 'well');
  for (const x of [229, 245]) put(x, 63, S, 'stall');
  put(230, 63, S, 'basket'); put(246, 63, S, 'crate');
  for (const [x, y] of [[232, 55], [242, 55], [227, 62], [247, 62]]) put(x, y, S, 'lamppost');
  folkAt([['child', 235, 57], ['dog', 240, 58], ['bard', 233, 61], ['vendor', 229, 62]]);
  for (const [x, y] of [[227, 56], [247, 56], [230, 62], [244, 62]]) put(x, y, S, 'flowers');
  put(253, 64, S, 'stairs_down');

  // The cellars below, overrun by giant spiders from the Webwood
  room(S - 1, 251, 62, 255, 65);  // below the stairs
  room(S - 1, 240, 64, 250, 64);  // corridor west, past a gate for the experienced
  room(S - 1, 228, 60, 239, 68);  // wine cellar
  room(S - 1, 220, 56, 227, 66);  // store room
  room(S - 1, 222, 46, 224, 55);  // corridor north
  room(S - 1, 217, 40, 231, 45);  // the nest
  put(253, 64, S - 1, 'stairs_up');
  put(247, 64, S - 1, 'door_level'); meta(247, 64, S - 1, { level: 25 });
  put(218, 41, S - 1, 'qchest_webs');
  for (const [x, y] of [[230, 61], [236, 67], [221, 58], [226, 65], [223, 48], [219, 43], [226, 41], [229, 44], [233, 63]]) put(x, y, S - 1, 'web');
  for (const [x, y] of [[229, 67], [221, 63], [228, 43]]) put(x, y, S - 1, 'bones');
  for (const [x, y] of [[229, 61], [238, 61], [229, 67]]) put(x, y, S - 1, 'barrel');
  spawn('giant_spider', [[234, 64], [223, 61], [223, 50], [224, 42], [229, 42]], S - 1);
  spawn('spider', [[236, 61], [230, 66], [219, 44], [226, 58]], S - 1);

  // Harbour on the north coast
  fill(225, 9, 227, 17, S, 'wood');
  reserve(223, 7, 229, 19);
  npc('rook', 226, 11);
  road(226, 18, 226, 30); road(226, 30, 268, 76);

  // The road east from Valoria, over the land bridge to the castle bridge
  road(139, 70, 139, 76); road(139, 76, 237, 74); road(237, 76, 268, 76);
  sign(186, 75, S, 'signpost', 'East: the Highlands and Castle Greymoor. West: Valoria.');

  // ================================================================================
  // The cyclops mountain, with a dragon lair below it
  // ================================================================================
  // A mountain is cliffs on one floor with ground on the floor above (each floor up
  // is drawn one tile up-left, so that ground sits right on the cliffs): rock, with
  // patches of grass. Its outline is a wobbly oval.
  const wobbly = (x, y, [cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + 0.08 * Math.sin(x * 1.3 + y * 0.7) * Math.cos(y * 1.1) < 1;
  // ...minus lone tiles sticking out, which would look like pillars.
  const inOval = (x, y, oval) => wobbly(x, y, oval) && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => wobbly(x + dx, y + dy, oval)).length >= 3;
  const plateau = (z, oval, grassy, top = 'mountain') => {
    const [cx, cy, rx, ry] = oval;
    for (let y = cy - ry - 1; y <= cy + ry + 1; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
      if (!inOval(x, y, oval)) continue;
      m.ensure(x, y, z).items = ['cliff'];
      const inner = inOval(x, y, [cx, cy, rx - 3, ry - 3]);
      m.setGround(x, y, z + 1, grassy && inner && Math.sin(x * 0.5) + Math.cos(y * 0.6) + r() * 0.6 > 0.4 ? 'grass' : top);
    }
  };
  // A path up the south side: a ramp in place of the lowest cliff, on a straight
  // stretch of the edge near column x.
  const mountainRamp = (z, oval, x0) => {
    const bottom = x => { let y = oval[1]; while (inOval(x, y + 1, oval)) y++; return y; };
    const xs = [0, 1, -1, 2, -2, 3, -3, 4, -4].map(d => x0 + d);
    const x = xs.find(x => bottom(x - 1) === bottom(x) && bottom(x + 1) === bottom(x)) ?? x0, y = bottom(x);
    m.ensure(x, y, z).items = ['ramp'];
    m.setGround(x, y, z + 1, 'ramp_top');
    return { x, y };
  };
  const MOUNTAIN = [250, 100, 15, 11], SUMMIT = [252, 98, 7, 5];
  reserve(232, 86, 268, 114);
  fill(233, 87, 267, 113, S, 'grass');
  plateau(S, MOUNTAIN, true);
  plateau(S + 1, SUMMIT, false);
  const path = mountainRamp(S, MOUNTAIN, 250);
  mountainRamp(S + 1, SUMMIT, 252);
  // Boulders and shrubs around the foot, so it doesn't rise straight out of a lawn
  for (let y = 87; y <= 113; y++) for (let x = 233; x <= 267; x++) {
    const t = m.get(x, y, S);
    if (t.items.length || !['grass', 'sand'].includes(t.ground)) continue;
    const nearCliff = [[0, -1], [-1, 0], [1, 0], [-1, -1], [1, -1]].some(([dx, dy]) => (m.get(x + dx, y + dy, S) || { items: [] }).items[0] === 'cliff');
    if (nearCliff && Math.abs(x - path.x) > 1 && r() < 0.3) put(x, y, S, r() < 0.7 ? 'rock' : 'bush');
  }
  road(232, 80, 244, 76); road(232, 80, 232, 118); road(232, 118, path.x, path.y + 1);
  for (const [x, y] of [[241, 99], [259, 95], [245, 106], [256, 106], [262, 100]]) put(x, y, S + 1, 'rock');
  for (const [x, y] of [[243, 94], [257, 104]]) put(x, y, S + 1, 'tent');
  put(247, 104, S + 1, 'campfire'); put(249, 105, S + 1, 'bones'); put(244, 102, S + 1, 'bones');
  put(252, 95, S + 2, 'qchest_summit'); put(249, 97, S + 2, 'bones');
  spawn('cyclops', [[243, 98], [256, 94], [248, 107], [259, 103], [240, 103], [262, 98], [252, 109]], S + 1);
  spawn('cyclops', [[250, 99], [255, 99]], S + 2);
  spawn('cyclops', [[238, 86], [263, 87], [266, 112]]);

  // The dragon lair: down at the east foot of the mountain
  put(268, 100, S, 'stairs_down');
  sign(268, 98, S, 'signpost', 'Here be dragons. Turn back while you still can.');
  clearAround(S - 1, 268, 100);
  tunnel(S - 1, 268, 100, 259, 100);
  blob(S - 1, 252, 100, 9, 6);
  tunnel(S - 1, 244, 101, 236, 107);
  blob(S - 1, 233, 108, 5, 4);
  clearAround(S - 1, 230, 109);
  put(268, 100, S - 1, 'stairs_up');
  put(230, 109, S - 1, 'qchest_dragon_hoard');
  for (const [x, y] of [[250, 97], [256, 103], [246, 101], [235, 110], [232, 106]]) put(x, y, S - 1, 'bones');
  spawn('dragon', [[254, 98], [249, 103], [246, 97], [234, 107], [237, 106]], S - 1);

  // ================================================================================
  // The Webwood: dark forest full of webs and giant spiders
  // ================================================================================
  for (let y = WEBWOOD.y0; y <= WEBWOOD.y1; y++) for (let x = WEBWOOD.x0; x <= WEBWOOD.x1; x++) {
    if (groundAt(x, y) !== 'grass' || m.get(x, y, S).items.length || Math.hypot(x - 221, y - 140) < 5) continue;
    const v = r();
    if (v < 0.3) put(x, y, S, r() < 0.6 ? 'pine' : 'tree');
    else if (v < 0.36) put(x, y, S, 'web');
    else if (v < 0.37) put(x, y, S, 'bones');
  }
  for (let i = 0; i < 14; i++) put(217 + ((i * 5) % 9), 136 + ((i * 3) % 9), S, 'web');
  // ...and the trunk that fell out of the flying car (the sock for Dobby is in it)
  put(222, 139, S, 'qchest_trunk');
  reserve(WEBWOOD.x0, WEBWOOD.y0, WEBWOOD.x1, WEBWOOD.y1);
  road(232, 118, 221, 124);
  spawn('giant_spider', [[210, 132], [231, 135], [221, 140], [214, 150], [238, 148]]);
  spawn('spider', [[204, 128], [226, 128], [201, 146], [242, 138], [221, 153], [208, 140]]);

  // ================================================================================
  // The southlands and the rest of the Highlands
  // ================================================================================
  road(103, 99, 118, 99); road(118, 99, 118, 125); road(118, 125, 128, 135); road(128, 135, 150, 148); road(150, 148, 196, 140);
  // Orc war camp
  for (let y = 144; y <= 160; y++) for (let x = 152; x <= 168; x++) {
    const d = Math.hypot(x - 160, y - 152);
    if (d < 6.5) m.setGround(x, y, S, 'dirt');
    if (d >= 6 && d < 7 && !(y < 152 && Math.abs(x - 155) <= 1)) put(x, y, S, 'fence');
  }
  reserve(151, 143, 169, 161);
  for (const [x, y] of [[157, 149], [163, 149], [158, 156], [163, 155]]) put(x, y, S, 'tent');
  put(160, 152, S, 'campfire');
  spawn('orc', [[156, 152], [164, 152], [160, 148], [160, 157], [149, 143]]);
  spawn('orc_archer', [[158, 147], [162, 157]]);
  spawn('orc_shaman', [[161, 151]]);
  // A lake, and a bandit hideout on the far shore
  for (let y = 158; y <= 176; y++) for (let x = 180; x <= 212; x++) {
    const d = ((x - 196) / 14) ** 2 + ((y - 167) / 7) ** 2;
    if (d < 1) m.setGround(x, y, S, 'water');
    else if (d < 1.35 && groundAt(x, y) === 'grass') m.setGround(x, y, S, 'sand');
  }
  reserve(180, 158, 212, 176);
  for (const [x, y] of [[248, 160], [254, 164]]) put(x, y, S, 'tent');
  put(251, 162, S, 'campfire'); put(247, 164, S, 'crate');
  reserve(244, 157, 258, 168);
  spawn('bandit', [[249, 162], [253, 160], [252, 166], [246, 159]]);
  // Wild animals and stragglers
  spawn('wolf', [[138, 138], [172, 134], [189, 152], [221, 170], [266, 150], [196, 92], [206, 108]]);
  spawn('crab', [[216, 174], [278, 130]]);
  // Ogres in the hills of the far north-east
  for (const [x, y] of [[284, 38], [287, 39], [296, 50], [279, 55], [300, 42]]) put(x, y, S, 'rock');
  spawn('ogre', [[286, 42], [293, 48], [281, 52], [298, 38]]);

  // ================================================================================
  // The wider world: the Frost Reach, the Elderwood, the Ironpeak mountains with
  // Deepforge below them, the Sunreach desert, the Mirefen, the Tazal jungle and
  // the volcano of Cinderhold. Each has a town, hunting grounds and a dungeon.
  // ================================================================================

  // A pier: from (x, y) walk in direction (dx, dy) to the water, then 7 tiles out to sea.
  function pier(x, y, dx, dy, captainType) {
    while (inMap(x - dx, y - dy) && groundAt(x, y) === 'water') { x -= dx; y -= dy; } // in the water already: back to the shore first
    while (inMap(x, y) && groundAt(x, y) !== 'water') { x += dx; y += dy; }
    x -= dx; y -= dy;
    for (let i = 0; i < 8 && inMap(x + dx, y + dy); i++) {
      x += dx; y += dy;
      m.setGround(x, y, S, 'wood');
      m.setGround(x + Math.abs(dy), y + Math.abs(dx), S, 'wood');
    }
    reserve(x - 3, y - 3, x + 3, y + 3);
    npc(captainType, x, y);
  }
  // n spawns of a monster scattered over the open ground (or carved caves) around (cx, cy).
  function hunt(type, cx, cy, rad, n, z = S) {
    for (let i = 0, tries = 0; i < n && tries < n * 40; tries++) {
      const x = Math.round(cx + (r() * 2 - 1) * rad), y = Math.round(cy + (r() * 2 - 1) * rad);
      if ((z < S ? !isCarved(z, x, y) : !m.isWalkable(x, y, z)) || spawned.has(`${x},${y},${z}`)) continue;
      spawn(type, [[x, y]], z);
      i++;
    }
  }

  // ---- the Frost Reach: Frosthold, the Yeti Peaks, ice caves with frost dragons ----
  const frosthold = city({
    x: 430, y: 100, style: 'northern', square: 'round', centre: 'well', priest: 'sigrun', people: [['jarl', 'hall'], ['bjorn', 'shop']], reach: 28, reachSouth: 20,
    inn: 'The Frozen Tankard', folk: ['torunn', 'crier', 'child', 'dog'],
    sign: 'Frosthold. The Yeti Peaks rise to the north-east; the ice caves open east of them. Ships sail from the pier to the south.',
    notice: 'BY ORDER OF JARL HAKON: Yeti pelts bought at fair prices. Do not feed the yetis. Do not hug the yetis.',
  });
  pier(430, 120, 0, 1, 'halvard');
  fill(452, 28, 528, 66, S, 'snow');
  const PEAKS = [490, 47, 30, 14], PEAKS_TOP = [494, 45, 13, 6];
  plateau(S, PEAKS, false, 'snow');
  plateau(S + 1, PEAKS_TOP, false, 'snow');
  mountainRamp(S, PEAKS, 490);
  mountainRamp(S + 1, PEAKS_TOP, 494);
  hunt('yeti', 490, 47, 24, 6, S + 1);
  hunt('yeti', 494, 45, 10, 2, S + 2);
  hunt('yeti', 488, 72, 14, 2);
  hunt('ice_wolf', 440, 60, 40, 10);
  hunt('ice_wolf', 380, 90, 25, 4);
  hunt('polar_bear', 450, 25, 60, 7);
  put(528, 70, S, 'stairs_down');
  sign(526, 69, S, 'signpost', 'The ice caves. Below them, they say, the frost dragons sleep.');
  clearAround(S - 1, 528, 70); tunnel(S - 1, 528, 70, 515, 60); blob(S - 1, 505, 58, 10, 6);
  tunnel(S - 1, 498, 59, 484, 66); blob(S - 1, 478, 68, 8, 5); clearAround(S - 1, 478, 68);
  put(528, 70, S - 1, 'stairs_up'); put(478, 68, S - 1, 'stairs_down');
  spawn('ice_wolf', [[506, 56], [510, 60], [500, 59], [482, 67]], S - 1);
  spawn('yeti', [[504, 61], [476, 70]], S - 1);
  blob(S - 2, 478, 68, 12, 8); tunnel(S - 2, 472, 72, 460, 77); blob(S - 2, 455, 78, 6, 4); clearAround(S - 2, 478, 68); clearAround(S - 2, 452, 79);
  put(478, 68, S - 2, 'stairs_up'); put(452, 79, S - 2, 'qchest_frost');
  spawn('frost_dragon', [[484, 64], [470, 70], [480, 74], [457, 77]], S - 2);

  // ---- the Elderwood: the elf town Sylvaran, bears, and the Shadowglen ----------------
  const sylvaran = city({
    x: 640, y: 110, style: 'elven', square: 'round', centre: 'ancient_tree', priest: 'elowen', people: [['lirael', 'hall'], ['faelan', 'shop']], reach: 28,
    inn: 'The Silver Leaf', folk: ['elandra', 'bard', 'girl', 'cat'], smithy: false,
    sign: 'Sylvaran. Bears roam the north of the Elderwood, giant spiders the Shadowglen in the south. Ships at the western pier.',
    notice: 'The Shadowglen is closed to visitors until further notice. By order of Elder Lirael. (The spiders did not sign.)',
  });
  pier(616, 110, -1, 0, 'thalion');
  hunt('bear', 690, 60, 40, 9);
  hunt('wolf', 700, 150, 30, 6);
  for (let i = 0; i < 40; i++) {
    const x = 700 + Math.round((r() * 2 - 1) * 14), y = 192 + Math.round((r() * 2 - 1) * 10);
    if (groundAt(x, y) === 'grass') { put(x, y, S, 'web'); reserved[y * W + x] = 1; }
  }
  sign(700, 178, S, 'signpost', 'The Shadowglen. Turn back.');
  hunt('giant_spider', 700, 192, 12, 4);
  hunt('spider', 700, 190, 16, 6);

  // ---- the Ironpeak mountains, and Deepforge below them ---------------------------------
  const IRON = [[400, 215, 32, 18], [465, 238, 28, 16], [372, 262, 18, 11]], IRON_TOP = [402, 212, 14, 8];
  for (const oval of IRON) {
    plateau(S, oval, true);
    mountainRamp(S, oval, oval[0]);
  }
  plateau(S + 1, IRON_TOP, false);
  mountainRamp(S + 1, IRON_TOP, 402);
  hunt('cyclops', 465, 238, 22, 4, S + 1);
  hunt('cyclops', 400, 215, 26, 3, S + 1);
  hunt('bear', 380, 190, 25, 4);
  hunt('orc', 505, 205, 18, 5); hunt('orc_archer', 505, 205, 18, 3);
  // the gatehouse, and the stairs down into the dwarf city
  building({ x0: 445, y0: 286, x1: 455, y1: 292, floor: 'cobble', wall: 'wall_stone', doors: [[450, 292]] });
  put(450, 288, S, 'stairs_down'); put(446, 287, S, 'torch'); put(454, 287, S, 'torch');
  sign(452, 294, S, 'signpost', 'Deepforge, city of the dwarves. Mind your head.');
  room(S - 1, 449, 262, 451, 288);   // the way in
  room(S - 1, 412, 244, 452, 261);   // the great hall
  room(S - 1, 418, 234, 428, 243);   // temple
  room(S - 1, 432, 234, 442, 243);   // smithy
  room(S - 1, 453, 246, 460, 254);   // bank
  put(450, 288, S - 1, 'stairs_up');
  npc('durgan', 432, 252, S - 1); npc('hilde', 421, 238, S - 1); npc('gorm', 437, 238, S - 1); npc('brunn', 457, 250, S - 1);
  m.temples.push({ home: 'deepforge', town: 'Deepforge', npc: 'hilde', x: 423, y: 240, z: S - 1 }); // its citizens wake up here
  afterCarving.push(() => {
    fill(418, 234, 428, 243, S - 1, 'marble');
    put(423, 235, S - 1, 'altar'); put(427, 242, S - 1, 'depot');
    put(436, 235, S - 1, 'anvil'); put(440, 235, S - 1, 'campfire');
    for (const x of [414, 422, 430, 438, 446]) { put(x, 245, S - 1, 'torch'); put(x, 260, S - 1, 'torch'); }
    for (const y of [266, 274, 282]) put(449, y, S - 1, 'torch');
    for (const [x, y] of [[420, 250], [440, 256], [428, 247], [446, 252]]) npc('dwarf', x, y, S - 1); // dwarves going about their business
    put(455, 247, S - 1, 'torch'); put(419, 235, S - 1, 'torch'); put(433, 242, S - 1, 'torch');
  });
  // the mines, east: golems
  tunnel(S - 1, 452, 252, 480, 250); blob(S - 1, 488, 248, 9, 6); tunnel(S - 1, 490, 252, 505, 262); blob(S - 1, 510, 265, 7, 5);
  spawn('stone_golem', [[486, 246], [492, 250], [484, 251], [496, 246], [508, 264], [512, 267], [505, 262]], S - 1);
  afterCarving.push(() => { for (let x = 454; x < 480; x += 1) if (isCarved(S - 1, x, 250)) put(x, 250, S - 1, 'rails'); torches(S - 1, [[478, 249], [488, 243]]); });
  // the labyrinth, west: minotaurs. A maze of 2x2 rooms joined by 2-wide passages.
  {
    const MX = 342, MY = 228, COLS = 14, ROWS = 12, seen = new Set();
    const cell = (cx, cy) => room(S - 1, MX + cx * 4, MY + cy * 4, MX + cx * 4 + 1, MY + cy * 4 + 1);
    const stack = [[COLS - 1, 6]];
    seen.add(`${COLS - 1},6`);
    cell(COLS - 1, 6);
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const next = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [cx + dx, cy + dy, dx, dy])
        .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && !seen.has(`${nx},${ny}`));
      if (!next.length) { stack.pop(); continue; }
      const [nx, ny, dx, dy] = next[Math.floor(r() * next.length)];
      room(S - 1, MX + cx * 4 + (dx > 0 ? 2 : dx < 0 ? -2 : 0), MY + cy * 4 + (dy > 0 ? 2 : dy < 0 ? -2 : 0), MX + cx * 4 + 1 + (dx > 0 ? 2 : dx < 0 ? -2 : 0), MY + cy * 4 + 1 + (dy > 0 ? 2 : dy < 0 ? -2 : 0));
      cell(nx, ny);
      seen.add(`${nx},${ny}`);
      stack.push([nx, ny]);
    }
    room(S - 1, MX + COLS * 4 - 2, MY + 24, 411, MY + 25); // the way in, from the great hall
    put(MX, MY, S - 1, 'qchest_maze');
    const mino = [];
    for (let i = 0; i < 14; i++) mino.push([MX + Math.floor(r() * COLS) * 4, MY + Math.floor(r() * ROWS) * 4]);
    spawn('minotaur', mino.slice(0, 11), S - 1);
    spawn('minotaur_mage', mino.slice(11), S - 1);
  }

  // ---- the Sunreach desert: Kesh, oases, nomads, and the pyramid of the Sand King ----------
  const kesh = city({
    x: 590, y: 360, style: 'desert', square: 'long', centre: 'fountain', priest: 'nadira', people: [['amal', 'hall'], ['rashid', 'shop'], ['omar', 'bank']], vendors: 1,
    inn: 'The Oasis Rest', folk: ['zahir', 'crier', 'child', 'dog'],
    sign: 'Kesh, jewel of the Sunreach. The pyramid of the Sand King lies to the east, nomads to the north-east. Ships at the western pier.',
    notice: 'GRAND BAZAAR every day! Spices, silks, scorpion antidote (results may vary).',
  });
  pier(566, 360, -1, 0, 'saba');
  const oasis = (cx, cy, rx, ry) => {
    for (let y = cy - ry - 3; y <= cy + ry + 3; y++) for (let x = cx - rx - 3; x <= cx + rx + 3; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d < 1) m.setGround(x, y, S, 'water');
      else if (d < 2.2) { m.setGround(x, y, S, 'grass'); if (r() < 0.15) put(x, y, S, 'palm'); }
    }
    reserve(cx - rx - 4, cy - ry - 4, cx + rx + 4, cy + ry + 4);
  };
  oasis(620, 336, 5, 3); oasis(690, 300, 6, 4); oasis(650, 450, 4, 3);
  hunt('scorpion', 620, 300, 40, 12);
  hunt('scorpion', 640, 440, 30, 6);
  for (const [x, y] of [[716, 316], [726, 322], [718, 328]]) put(x, y, S, 'tent');
  put(720, 322, S, 'campfire'); reserve(710, 310, 732, 334);
  hunt('nomad', 720, 322, 10, 6);
  // the pyramid: four ever smaller floors of sandstone; the way down is in its middle
  {
    const steps = [[686, 416, 714, 444], [690, 420, 710, 440], [694, 424, 706, 436], [697, 427, 703, 433]];
    steps.forEach(([x0, y0, x1, y1], i) => building({ x0, y0, x1, y1, z: S + i, floor: 'sandstone', wall: 'wall_sandstone', roof: null, doors: i ? [] : [[700, 444]] }));
    put(700, 430, S, 'stairs_down'); put(688, 418, S, 'torch'); put(712, 418, S, 'torch'); put(688, 442, S, 'torch'); put(712, 442, S, 'torch');
    sign(703, 446, S, 'signpost', 'Here sleeps the Sand King. Do not wake him.');
    room(S - 1, 694, 424, 706, 436); room(S - 1, 680, 428, 693, 432); room(S - 1, 707, 428, 720, 432);
    room(S - 1, 672, 420, 679, 440); room(S - 1, 721, 420, 728, 440);
    put(700, 430, S - 1, 'stairs_up'); put(676, 438, S - 1, 'stairs_down');
    spawn('mummy', [[698, 426], [704, 434], [675, 424], [676, 432], [724, 424], [724, 436]], S - 1);
    spawn('scorpion', [[686, 430], [714, 430], [724, 430]], S - 1);
    room(S - 2, 668, 432, 690, 448); room(S - 2, 691, 440, 692, 441); room(S - 2, 693, 437, 699, 444);
    put(676, 438, S - 2, 'stairs_up'); put(698, 440, S - 2, 'qchest_pyramid');
    spawn('sand_king', [[684, 444]], S - 2);
    spawn('mummy', [[672, 446], [686, 434], [680, 446]], S - 2);
    afterCarving.push(() => torches(S - 1, [[695, 425], [705, 425], [673, 421], [727, 421]]));
  }

  // ---- the Mirefen: Mirehaven on its boardwalks, trolls, crocodiles and a witch coven ----
  const mirehaven = city({
    x: 120, y: 330, style: 'swamp', square: 'square', centre: 'obelisk', priest: 'reed', people: [['marsh', 'hall'], ['grub', 'shop']], reach: 26, reachSouth: 22, reachNorth: 22,
    inn: 'The Soggy Boot', folk: ['bogsby', 'child', 'chicken', 'cat'], smithy: false,
    sign: 'Mirehaven. Trolls in the north of the fen, crocodiles in the pools, and witches to the west. The pier is south.',
    notice: 'LOST: one left boot. Last seen being eaten by a crocodile. If found, please keep the crocodile.',
  });
  pier(120, 352, 0, 1, 'moss');
  for (const [x, y] of [[52, 296], [60, 292], [68, 298], [56, 306], [66, 306]]) put(x, y, S, 'dead_tree');
  put(60, 300, S, 'campfire'); reserve(48, 288, 72, 312);
  hunt('witch', 60, 300, 12, 5);
  hunt('swamp_troll', 130, 262, 35, 10);
  hunt('crocodile', 182, 300, 30, 6);
  hunt('slime', 90, 290, 25, 4);

  // ---- the Tazal jungle: Port Verdant, vipers, and the lizards' temple -----------------
  const portVerdant = city({
    x: 330, y: 400, style: 'jungle', square: 'long', centre: 'statue', priest: 'ivo', people: [['vance', 'hall'], ['kiri', 'shop']], reachNorth: 18,
    inn: 'The Rum Barrel', folk: ['tico', 'bard', 'child', 'dog'],
    sign: 'Port Verdant. The jungle temple of the lizards lies east. Watch for vipers. Ships at the northern pier.',
    notice: 'WANTED: brave souls for the lizard temple. Payment on return. (Return not guaranteed.)',
  });
  pier(339, 382, 0, -1, 'reyes');
  hunt('viper', 400, 430, 50, 10);
  hunt('crocodile', 360, 465, 25, 3);
  {
    fill(440, 446, 460, 464, S, 'cobble'); reserve(436, 442, 464, 468);
    for (const [x, y] of [[440, 446], [441, 446], [446, 446], [454, 446], [459, 446], [460, 447], [440, 464], [441, 464], [460, 464], [460, 459], [440, 452]]) put(x, y, S, 'wall_stone');
    for (const [x, y] of [[444, 450], [456, 450], [444, 460], [456, 460]]) put(x, y, S, 'torch');
    put(450, 455, S, 'stairs_down');
    sign(450, 447, S, 'signpost', 'The temple of the lizards. Something old and scaly waits below.');
    hunt('lizard_warrior', 450, 455, 18, 5);
    room(S - 1, 442, 448, 458, 462); room(S - 1, 459, 453, 470, 457); room(S - 1, 471, 446, 480, 464);
    room(S - 1, 430, 453, 441, 457); room(S - 1, 420, 446, 429, 464);
    put(450, 455, S - 1, 'stairs_up'); put(476, 448, S - 1, 'qchest_idol'); put(424, 462, S - 1, 'stairs_down');
    spawn('lizard_warrior', [[446, 450], [454, 460], [474, 450], [476, 460], [424, 450]], S - 1);
    spawn('lizard_priest', [[456, 452], [478, 455], [426, 456]], S - 1);
    room(S - 2, 414, 456, 434, 470);
    put(424, 462, S - 2, 'stairs_up');
    spawn('serpent_lord', [[424, 467]], S - 2);
    spawn('lizard_priest', [[418, 466], [430, 466]], S - 2);
    afterCarving.push(() => torches(S - 1, [[443, 449], [457, 449], [421, 447], [479, 447]]));
  }

  // ---- Cinderhold: the volcano isle, fire elementals, dragon lords, and the demon pit -----
  building({ x0: 150, y0: 448, x1: 158, y1: 456, floor: 'cobble', wall: 'wall_stone', doors: [[158, 452]] });
  put(151, 449, S, 'torch'); put(151, 455, S, 'depot');
  npc('kael', 154, 452);
  shelter(150, 448, 158, 456);
  for (const [x, y] of [[146, 445], [146, 459]]) put(x, y, S, 'tent');
  put(144, 452, S, 'campfire'); put(159, 449, S, 'lamppost'); put(159, 455, S, 'lamppost'); put(149, 459, S, 'stall');
  folkAt([['guard', 160, 450], ['vendor', 149, 458]]);
  pier(160, 452, 1, 0, 'brand');
  {
    const VOLCANO = [105, 452, 32, 22], CRATER = [105, 450, 16, 10];
    plateau(S, VOLCANO, false, 'ash');
    plateau(S + 1, CRATER, false, 'ash');
    mountainRamp(S, VOLCANO, 105);
    mountainRamp(S + 1, CRATER, 105);
    for (let y = 446; y <= 452; y++) for (let x = 99; x <= 111; x++) if (((x - 105) / 6) ** 2 + ((y - 449) / 3.5) ** 2 < 1) m.setGround(x, y, S + 2, 'lava');
    hunt('dragon_lord', 105, 452, 26, 3, S + 1);
    hunt('fire_elemental', 105, 452, 14, 2, S + 2);
    for (const [cx, cy, rx, ry] of [[70, 448, 4, 3], [140, 440, 3, 2], [100, 486, 4, 2], [126, 486, 3, 2]]) { // lava pools with ragged shores
      for (let y = cy - ry - 2; y <= cy + ry + 2; y++) for (let x = cx - rx - 2; x <= cx + rx + 2; x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (r() - 0.5) * 0.7 < 1) m.setGround(x, y, S, 'lava');
      }
    }
    hunt('fire_elemental', 105, 455, 55, 6);
    put(140, 470, S, 'stairs_down');
    sign(141, 468, S, 'signpost', 'The demon pit. Warden Kael says: do not.');
    clearAround(S - 1, 140, 470); tunnel(S - 1, 140, 470, 116, 479); blob(S - 1, 105, 480, 12, 6); clearAround(S - 1, 95, 482);
    put(140, 470, S - 1, 'stairs_up'); put(95, 482, S - 1, 'stairs_down');
    spawn('fire_elemental', [[110, 478], [100, 482], [106, 484], [118, 480], [128, 474]], S - 1);
    blob(S - 2, 95, 482, 14, 7); clearAround(S - 2, 95, 482); clearAround(S - 2, 82, 478);
    put(95, 482, S - 2, 'stairs_up'); put(82, 478, S - 2, 'qchest_demon');
    spawn('demon', [[90, 480], [100, 486], [86, 486]], S - 2);
    spawn('ashen_lord', [[84, 483]], S - 2); // the end of the Ember Seal
    afterCarving.push(() => {
      for (const [x, y] of [[104, 477], [108, 483], [99, 479]]) if (isCarved(S - 1, x, y)) m.setGround(x, y, S - 1, 'lava');
    });
  }

  // ================================================================================
  // The wilds between the towns: roads, and all sorts of places to find - camps with
  // their chiefs, ruins and crypts, watchtowers, hamlets, caves, graveyards and old
  // stone circles - each with monsters of its region and, often, an old chest.
  // ================================================================================
  // Roads, following the land from town to town
  const open = (x, y) => {
    const t = m.get(x, y, S);
    return !!t && !!t.ground && !THINGS[t.ground].block && !t.items.some(id => THINGS[id].block);
  };
  // Rivers run from deep inland down to the sea (towards the coast, where the land
  // thins out), winding as they go, with a wooden bridge every so often so no land is
  // cut off. Lakes lie here and there - frozen over in the north. None of them go
  // anywhere near towns, landmarks or anything already built.
  const untouched = (x, y) => inMap(x, y) && !reserved[y * W + x] && !townArea[y * W + x] && !spawned.has(`${x},${y},${S}`)
    && NATURAL.includes(groundAt(x, y)) && !m.get(x, y, S).items.length;
  const wetAt = (x, y) => inMap(x, y) && groundAt(x, y) === 'water';
  for (let tries = 0, rivers = 0; tries < 600 && rivers < 14; tries++) {
    let x = 10 + Math.floor(r() * (W - 20)), y = 10 + Math.floor(r() * (H - 20));
    if (!untouched(x, y) || landD[y * W + x] > 0.25 || [DESERT, VOLCANO].includes(biome[y * W + x]) || wildness(x, y) < 1) continue;
    let fx = x, fy = y, a = r() * Math.PI * 2, reached = false;
    const path = [];
    for (let step = 0; step < 600; step++) {
      const gx = landD[y * W + Math.min(W - 1, x + 3)] - landD[y * W + Math.max(0, x - 3)];
      const gy = landD[Math.min(H - 1, y + 3) * W + x] - landD[Math.max(0, y - 3) * W + x];
      const want = Math.hypot(gx, gy) > 0.001 ? Math.atan2(gy, gx) : a;
      a += Math.atan2(Math.sin(want - a), Math.cos(want - a)) * 0.22 + (noise(step * 0.1, rivers * 5.7 + tries, 61, 2) - 0.5) * 0.8;
      fx += Math.cos(a);
      fy += Math.sin(a);
      const nx = Math.round(fx), ny = Math.round(fy);
      if (nx === x && ny === y) continue;
      x = nx;
      y = ny;
      if (wetAt(x, y)) { reached = true; break; }
      if (!untouched(x, y)) break;
      path.push([x, y]);
    }
    if (path.length < (reached ? 25 : 45)) continue;
    rivers++;
    for (const [px, py] of path) for (const [ox, oy] of [[0, 0], [1, 0], [0, 1]]) {
      if (untouched(px + ox, py + oy)) m.setGround(px + ox, py + oy, S, 'water');
    }
    if (!reached) { // it ends in a pond
      const [ex, ey] = path[path.length - 1];
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 8 && untouched(ex + dx, ey + dy)) m.setGround(ex + dx, ey + dy, S, 'water');
    }
    // a bridge every so often, across the flow
    for (let i = 10; i < path.length - 6; i += 18 + Math.floor(r() * 8)) {
      const [bx, by] = path[i], [ax, ay] = path[i - 3], [cx, cy] = path[Math.min(path.length - 1, i + 3)];
      const across = Math.abs(cx - ax) >= Math.abs(cy - ay) ? [0, 1] : [1, 0], kind = across[1] ? 'bridge_ns' : 'bridge_ew';
      for (const sign of [-1, 1]) for (let k = sign < 0 ? 0 : 1; k < 6; k++) {
        const tx = bx + across[0] * k * sign, ty = by + across[1] * k * sign;
        if (!wetAt(tx, ty)) break;
        m.setGround(tx, ty, S, kind);
      }
    }
    for (const [px, py] of path) reserve(px - 1, py - 1, px + 2, py + 2);
  }
  for (let tries = 0, lakes = 0; tries < 800 && lakes < 18; tries++) {
    const cx = 10 + Math.floor(r() * (W - 20)), cy = 10 + Math.floor(r() * (H - 20)), b = biome[cy * W + cx];
    const rx = 4 + r() * 7, ry = rx * (0.55 + r() * 0.4);
    if ([DESERT, VOLCANO, SWAMP].includes(b) || wildness(cx, cy) < 0.8) continue;
    let room = true;
    for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3 && room; y++) for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) if (!untouched(x, y)) { room = false; break; }
    if (!room) continue;
    lakes++;
    const frozen = b === FROST, islet = rx > 8 && r() < 0.5;
    for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y++) for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (noise(x / 4, y / 4, 71, 2) - 0.5) * 0.5;
      if (islet && d < 0.1) { m.setGround(x, y, S, frozen ? 'snow' : 'grass'); if (d < 0.03) put(x, y, S, frozen ? 'snow_pine' : 'tree'); }
      else if (d < 1) m.setGround(x, y, S, frozen ? 'ice' : 'water');
      else if (d < 1.4 && !frozen) { m.setGround(x, y, S, 'sand'); if (r() < 0.18) put(x, y, S, 'reeds'); }
    }
    reserve(Math.floor(cx - rx - 3), Math.floor(cy - ry - 3), Math.ceil(cx + rx + 3), Math.ceil(cy + ry + 3));
  }

  // Where two lands nearly touch, a long wooden bridge crosses the strait: straight
  // runs of 3 to 12 tiles of water with open land at both ends, on lands not yet joined
  // there (and not too close to another bridge).
  {
    const part = new Int32Array(W * H).fill(-1);
    let parts = 0;
    for (let start = 0; start < W * H; start++) {
      if (part[start] >= 0 || groundAt(start % W, (start - start % W) / W) === 'water') continue;
      const stack = [start];
      part[start] = parts;
      while (stack.length) {
        const i = stack.pop(), x = i % W, y = (i - x) / W;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, j = ny * W + nx;
          if (inMap(nx, ny) && part[j] < 0 && groundAt(nx, ny) !== 'water') { part[j] = parts; stack.push(j); }
        }
      }
      parts++;
    }
    const spans = [];
    for (const [dx, dy, kind] of [[1, 0, 'bridge_ew'], [0, 1, 'bridge_ns']]) {
      for (let y = 4; y < H - 4; y += 2) for (let x = 4; x < W - 4; x += 2) {
        if (!untouched(x, y) || !wetAt(x + dx, y + dy)) continue;
        let n = 1;
        while (n <= 13 && wetAt(x + dx * n, y + dy * n)) n++;
        const ex = x + dx * n, ey = y + dy * n;
        if (n < 4 || n > 13 || !untouched(ex, ey) || wildness(x, y) < 0.5) continue;
        // land on both sides of the bridge's ends, so it isn't a corner of a beach
        if (!untouched(x - dx, y - dy) || !untouched(ex + dx, ey + dy)) continue;
        spans.push({ x, y, dx, dy, n, kind, a: part[y * W + x], b: part[ey * W + ex] });
      }
    }
    const built = [];
    for (let i = spans.length - 1; i > 0; i--) { // shuffled the same everywhere (a random sort() isn't: browsers sort differently)
      const j = Math.floor(r() * (i + 1));
      [spans[i], spans[j]] = [spans[j], spans[i]];
    }
    for (const sp of spans) {
      if (built.length >= 16) break;
      if (built.some(o => Math.hypot(o.x - sp.x, o.y - sp.y) < 40)) continue;
      if (sp.a === sp.b && r() < 0.6) continue; // mostly between separate lands
      for (let k = 1; k < sp.n; k++) m.setGround(sp.x + sp.dx * k, sp.y + sp.dy * k, S, sp.kind);
      reserve(sp.x - 2, sp.y - 2, sp.x + sp.dx * sp.n + 2, sp.y + sp.dy * sp.n + 2);
      built.push(sp);
    }
  }

  const roadMiddles = []; // half way along the long roads: room for an inn
  const pave = (a, b) => {
    const path = findPath(open, a[0], a[1], b[0], b[1], { maxNodes: 250000 }) || [];
    // a track of the land it crosses: sandstone in the desert, gravel in the snow, else dirt
    const dirt = (x, y) => {
      if (!NATURAL.includes(groundAt(x, y))) return;
      const b = biome[y * W + x];
      m.setGround(x, y, S, b === DESERT ? 'sandstone' : b === FROST || b === VOLCANO ? 'gravel' : 'dirt');
    };
    path.forEach(([x, y], i) => {
      dirt(x, y);
      const [px, py] = path[i - 1] || [x, y];
      if (px !== x && py !== y) dirt(x, py); // a diagonal step: fill the corner, so the road stays one road
    });
    if (path.length > 70) roadMiddles.push(path[Math.floor(path.length / 2)]);
  };
  for (const [a, b] of [
    [[237, 77], frosthold.exits.w], [frosthold.exits.e, sylvaran.exits.n], [sylvaran.exits.s, kesh.exits.n], [kesh.exits.w, [450, 294]],
    [[450, 294], portVerdant.exits.e], [portVerdant.exits.w, mirehaven.exits.e], [mirehaven.exits.n, [150, 150]], [[268, 76], [300, 100]],
    ...townRoads,
  ]) pave(a, b);

  // What lives where, and how dangerous it is there (1-5: the loot in the chests)
  const WILD = {
    [TEMPERATE]: { danger: 2, camp: ['bandit', 'orc'], chief: 'bandit_chief', ruin: ['skeleton', 'ghost'], cave: ['ogre', 'spider'], roam: ['wolf', 'bear', 'orc'] },
    [FROST]: { danger: 3, camp: ['yeti', 'ice_wolf'], chief: 'yeti_elder', ruin: ['skeleton', 'ghost'], cave: ['ice_wolf', 'yeti'], roam: ['ice_wolf', 'polar_bear'] },
    [FOREST]: { danger: 2, camp: ['orc', 'orc_archer', 'orc_shaman'], chief: 'orc_warlord', ruin: ['skeleton', 'ghost'], cave: ['giant_spider', 'spider'], roam: ['bear', 'wolf', 'spider'] },
    [HILLS]: { danger: 3, camp: ['orc', 'orc_shaman', 'cyclops'], chief: 'orc_warlord', ruin: ['minotaur', 'minotaur_mage'], cave: ['stone_golem', 'minotaur'], roam: ['bear', 'cyclops', 'wolf'] },
    [DESERT]: { danger: 3, camp: ['nomad'], chief: 'nomad_sheik', ruin: ['mummy', 'scorpion'], cave: ['scorpion', 'mummy'], roam: ['scorpion', 'nomad'] },
    [SWAMP]: { danger: 2, camp: ['swamp_troll'], chief: 'troll_king', ruin: ['witch', 'skeleton'], cave: ['slime', 'crocodile'], roam: ['swamp_troll', 'crocodile', 'slime'] },
    [JUNGLE]: { danger: 4, camp: ['lizard_warrior', 'lizard_priest'], chief: 'lizard_chieftain', ruin: ['lizard_priest', 'viper'], cave: ['viper', 'lizard_warrior'], roam: ['viper', 'crocodile'] },
    [VOLCANO]: { danger: 5, camp: ['fire_elemental'], chief: null, ruin: ['fire_elemental'], cave: ['fire_elemental', 'dragon_lord'], roam: ['fire_elemental'] },
  };
  const CACHE_LOOT = [null,
    ['leather_armor', 'studded_shield', 'chain_helmet', 'spear', 'leather_legs'],
    ['chain_armor', 'iron_shield', 'broadsword', 'ring_swift', 'chain_legs', 'iron_boots'],
    ['steel_helmet', 'plate_legs', 'battle_axe', 'wand_flames', 'rod_thorns', 'crossbow', 'amulet_guard'],
    ['plate_armor', 'knight_blade', 'tower_shield', 'ring_life', 'witch_hat', 'lizard_mail'],
    ['crown_helmet', 'elven_bow', 'frost_blade', 'wand_storm', 'rod_glacier', 'dragon_shield'],
  ];
  const pick = list => list[Math.floor(r() * list.length)];
  const cache = (x, y, z, danger) => {
    put(x, y, z, 'cache');
    const items = [[r() < 0.5 ? 'health_potion' : 'mana_potion', 1 + danger]];
    if (r() < 0.6) items.push([pick(CACHE_LOOT[danger]), 1]);
    meta(x, y, z, { gold: Math.round((40 + r() * 80) * danger * danger), items });
  };
  const SIGNS = [
    'Beware of the bear. The bear is already aware of you.',
    'Treasure? Here? No. Definitely not. Keep walking.',
    'Danger! (The previous sign was eaten.)',
    'This way to adventure. That way: also adventure.',
    'Lost: one goblin. Answers to "oi". Reward: a smaller goblin.',
    'Do not feed the monsters. They feed themselves.',
    'Here lies Gerald. He pressed the button.',
    'Abandon hope - or at least bring potions.',
    'Free hugs! - the yeti',
    'You are here. Unfortunately.',
    'Speed limit: 3 tiles per heartbeat.',
    'Camping prohibited. (The orcs did not read this sign.)',
  ];
  const wallOf = b => (b === DESERT ? 'wall_sandstone' : b === SWAMP || b === FOREST || b === JUNGLE ? 'wall_wood' : 'wall_stone');
  const natural = id => ['grass', 'sand', 'snow', 'jungle', 'swamp', 'ash'].includes(id);
  // A footprint is free when it's all open, natural ground nobody has used yet.
  const fits = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!inMap(x, y) || reserved[y * W + x]) return false;
      const t = m.get(x, y, S);
      if (!t || !natural(t.ground) || t.items.length) return false;
    }
    return true;
  };
  // ...and so is the rock below it, for a cellar or a cave.
  const solidBelow = (x0, y0, x1, y1) => {
    for (let y = y0 - 3; y <= y1 + 3; y++) for (let x = x0 - 3; x <= x1 + 3; x++) if (isCarved(S - 1, x, y)) return false;
    return true;
  };
  const around = (x, y, rad, n, types, z = S) => {
    const list = [];
    for (let i = 0; i < n; i++) list.push([x + Math.round((r() * 2 - 1) * rad), y + Math.round((r() * 2 - 1) * rad)]);
    for (const p of list) spawn(pick(types), [p], z);
  };
  const chiefs = new Set();

  const PLACES = {
    camp(x, y, b) {
      if (!fits(x - 4, y - 4, x + 4, y + 4)) return false;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (dx * dx + dy * dy < 13) m.setGround(x + dx, y + dy, S, b === SWAMP ? 'swamp' : 'dirt');
      for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2]]) put(x + dx, y + dy, S, 'tent');
      put(x, y, S, 'campfire'); put(x + 2, y + 2, S, r() < 0.5 ? 'barrel' : 'crate');
      reserve(x - 6, y - 6, x + 6, y + 6);
      const chief = WILD[b].chief;
      if (chief && !chiefs.has(b)) { // the first camp of each region has its chief (placed first: one monster per tile)
        chiefs.add(b);
        spawn(chief, [[x + 1, y]]);
        cache(x - 3, y + 3, S, Math.min(5, WILD[b].danger + 1));
      }
      around(x, y, 3, 4, WILD[b].camp);
      return true;
    },
    ruin(x, y, b) {
      if (!fits(x - 5, y - 4, x + 5, y + 4)) return false;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -4; dx <= 4; dx++) if (r() < 0.7) m.setGround(x + dx, y + dy, S, b === DESERT ? 'sandstone' : 'cobble');
      walls(x - 4, y - 3, x + 4, y + 3, S, wallOf(b) === 'wall_wood' ? 'wall_stone' : wallOf(b), () => r() < 0.55);
      put(x + 2, y - 1, S, 'bones');
      reserve(x - 6, y - 5, x + 6, y + 5);
      around(x, y, 3, 2, WILD[b].ruin);
      if (solidBelow(x - 4, y - 3, x + 10, y + 3) && r() < 0.6) { // a crypt below
        put(x, y, S, 'stairs_down');
        room(S - 1, x - 2, y - 2, x + 2, y + 2); room(S - 1, x + 3, y, x + 5, y); room(S - 1, x + 6, y - 2, x + 9, y + 2);
        put(x, y, S - 1, 'stairs_up');
        around(x + 7, y, 1, 3, WILD[b].ruin, S - 1);
        cache(x + 9, y + 2, S - 1, WILD[b].danger);
        afterCarving.push(() => torches(S - 1, [[x - 2, y - 2]]));
      } else cache(x - 3, y + 2, S, WILD[b].danger);
      return true;
    },
    tower(x, y, b) {
      if (!fits(x - 3, y - 3, x + 3, y + 4)) return false;
      const wall = wallOf(b) === 'wall_wood' ? 'wall_stone' : wallOf(b);
      building({ x0: x - 2, y0: y - 2, x1: x + 2, y1: y + 2, floor: 'cobble', wall, roof: null, doors: [[x, y + 2]] });
      building({ x0: x - 2, y0: y - 2, x1: x + 2, y1: y + 2, z: S + 1, floor: 'wood', wall });
      put(x - 1, y - 1, S, 'stairs_up'); put(x - 1, y - 1, S + 1, 'stairs_down'); put(x + 1, y + 2, S + 1, 'window');
      cache(x + 1, y - 1, S + 1, WILD[b].danger);
      around(x, y + 4, 2, 2, WILD[b].camp);
      return true;
    },
    hamlet(x, y, b) {
      if (b === VOLCANO || !fits(x - 9, y - 7, x + 9, y + 7)) return false;
      const wall = wallOf(b) === 'wall_stone' ? 'wall_wood' : wallOf(b), floor = b === DESERT ? 'sandstone' : 'wood';
      for (const [hx, hy, dx, dy] of [[-8, -6, 2, 4], [3, -6, 2, 4], [-8, 2, 4, 2]]) {
        building({ x0: x + hx, y0: y + hy, x1: x + hx + 4, y1: y + hy + 4, floor, wall, doors: [[x + hx + dx, y + hy + dy]] });
        put(x + hx + 1, y + hy + 1, S, 'bed');
      }
      put(x, y - 1, S, 'well');
      for (let fy = y + 2; fy <= y + 6; fy++) for (let fx = x + 2; fx <= x + 8; fx++) {
        const edge = fy === y + 2 || fy === y + 6 || fx === x + 2 || fx === x + 8;
        m.setGround(fx, fy, S, 'dirt');
        if (edge && !(fy === y + 2 && fx === x + 5)) put(fx, fy, S, 'fence');
        else if (!edge && fx % 2) put(fx, fy, S, 'crops');
      }
      npc('farmer', x, y + 1);
      reserve(x - 10, y - 8, x + 10, y + 8);
      return true;
    },
    cave(x, y, b) {
      if (!fits(x - 2, y - 2, x + 2, y + 2)) return false;
      const dx = r() < 0.5 ? 1 : -1, cx = x + dx * 9, cy = y + 4;
      if (!solidBelow(Math.min(x, cx) - 6, y - 4, Math.max(x, cx) + 6, cy + 5)) return false;
      for (const [ox, oy] of [[-1, -1], [0, -1], [1, -1], [-2, 0], [2, 0], [-1, 1], [1, 1]]) put(x + ox, y + oy, S, 'rock');
      put(x, y, S, 'stairs_down');
      reserve(x - 3, y - 3, x + 3, y + 3);
      clearAround(S - 1, x, y); tunnel(S - 1, x, y, cx, cy); blob(S - 1, cx, cy, 5, 4); clearAround(S - 1, cx + dx * 3, cy + 1);
      put(x, y, S - 1, 'stairs_up');
      around(cx, cy, 3, 4, WILD[b].cave, S - 1);
      cache(cx + dx * 3, cy + 1, S - 1, Math.min(5, WILD[b].danger + 1));
      return true;
    },
    graveyard(x, y, b) {
      if (!fits(x - 4, y - 3, x + 4, y + 3)) return false;
      walls(x - 4, y - 3, x + 4, y + 3, S, 'fence', (fx, fy) => !(fy === y + 3 && fx === x));
      for (let gy = y - 2; gy <= y + 1; gy += 2) for (let gx = x - 3; gx <= x + 3; gx += 2) put(gx, gy, S, 'gravestone');
      reserve(x - 5, y - 4, x + 5, y + 4);
      around(x, y, 2, 2, b === DESERT ? ['mummy'] : ['skeleton', 'ghost']);
      return true;
    },
    stones(x, y, b) {
      if (!fits(x - 4, y - 4, x + 4, y + 4)) return false;
      for (let i = 0; i < 8; i++) put(x + Math.round(Math.cos((i * Math.PI) / 4) * 4), y + Math.round(Math.sin((i * Math.PI) / 4) * 3.5), S, i % 2 ? 'rock' : 'statue');
      put(x, y, S, 'altar');
      if (b !== VOLCANO && b !== DESERT) for (let i = 0; i < 4; i++) put(x - 2 + i, y + 2, S, 'flowers');
      sign(x, y + 4, S, 'signpost', 'The old stones hum softly. Someone left gold on the altar once. Once.');
      reserve(x - 5, y - 5, x + 5, y + 5);
      return true;
    },
    // a castle in ruins: broken walls around a courtyard, corner towers, a keep in the middle
    castle(x, y, b) {
      if (!fits(x - 10, y - 8, x + 10, y + 9)) return false;
      const wall = wallOf(b) === 'wall_wood' ? 'wall_stone' : wallOf(b);
      fill(x - 8, y - 6, x + 8, y + 6, S, b === DESERT ? 'sandstone' : 'cobble');
      walls(x - 8, y - 6, x + 8, y + 6, S, wall, (wx, wy) => !(wy === y + 6 && Math.abs(wx - x) <= 1) && r() < 0.8);
      for (const [tx, ty] of [[x - 8, y - 6], [x + 6, y - 6], [x - 8, y + 4], [x + 6, y + 4]]) building({ x0: tx, y0: ty, x1: tx + 2, y1: ty + 2, floor: 'cobble', wall, roof: r() < 0.5 ? 'roof_slate' : null });
      building({ x0: x - 3, y0: y - 3, x1: x + 3, y1: y + 2, floor: 'cobble', wall, roof: null, doors: [[x, y + 2]] });
      put(x, y - 2, S, 'throne'); put(x - 2, y - 2, S, 'torch'); put(x + 2, y - 2, S, 'torch');
      for (const fx of [x - 2, x + 2]) put(fx, y + 6, S, 'flagpole');
      for (let i = 0; i < 6; i++) { const rx = x - 7 + Math.floor(r() * 15), ry = y - 5 + Math.floor(r() * 11); if (!m.get(rx, ry, S).items.length) put(rx, ry, S, r() < 0.5 ? 'rubble' : 'fallen_pillar'); }
      reserve(x - 10, y - 8, x + 10, y + 9);
      around(x, y + 3, 3, 4, WILD[b].ruin);
      cache(x + 1, y - 2, S, Math.min(5, WILD[b].danger + 1));
      return true;
    },
    // a fort of logs: a palisade, a watchtower, tents and a fire
    fort(x, y, b) {
      if (b === DESERT || !fits(x - 7, y - 6, x + 7, y + 7)) return false;
      fill(x - 5, y - 4, x + 5, y + 4, S, b === SWAMP ? 'swamp' : 'dirt');
      walls(x - 6, y - 5, x + 6, y + 5, S, 'wall_wood', (wx, wy) => !(wy === y + 5 && Math.abs(wx - x) <= 1));
      building({ x0: x + 2, y0: y - 4, x1: x + 4, y1: y - 2, floor: 'wood', wall: 'wall_wood', roof: null, doors: [[x + 2, y - 3]] });
      building({ x0: x + 2, y0: y - 4, x1: x + 4, y1: y - 2, z: S + 1, floor: 'wood', wall: 'wall_wood', roof: 'roof_shingle' });
      put(x + 3, y - 3, S, 'stairs_up'); put(x + 3, y - 3, S + 1, 'stairs_down');
      for (const [dx, dy] of [[-3, -2], [-3, 2]]) put(x + dx, y + dy, S, 'tent');
      put(x, y, S, 'campfire'); put(x + 4, y + 3, S, 'flagpole'); put(x - 5, y + 3, S, 'barrel'); put(x - 5, y - 3, S, 'crate');
      reserve(x - 7, y - 6, x + 7, y + 7);
      around(x, y, 3, 4, WILD[b].camp);
      cache(x + 3, y - 3, S + 1, WILD[b].danger);
      return true;
    },
    // an old mine: a way down in a rock face, rails, and tunnels with what lives there now
    mine(x, y, b) {
      if (!fits(x - 3, y - 3, x + 3, y + 3) || !solidBelow(x - 4, y - 2, x + 16, y + 10)) return false;
      for (const [dx, dy] of [[-2, -1], [-1, -2], [0, -2], [1, -2], [2, -1], [-2, 0], [2, 0]]) put(x + dx, y + dy, S, 'rock');
      put(x, y, S, 'stairs_down'); put(x + 1, y + 1, S, 'wagon'); put(x - 1, y + 2, S, 'rubble');
      for (let ry = y + 1; ry <= y + 3; ry++) put(x, ry, S, 'rails');
      reserve(x - 4, y - 3, x + 4, y + 4);
      clearAround(S - 1, x, y); tunnel(S - 1, x, y, x + 8, y + 4); blob(S - 1, x + 11, y + 6, 4, 3); clearAround(S - 1, x + 13, y + 7);
      put(x, y, S - 1, 'stairs_up');
      around(x + 11, y + 6, 2, 3, b === DESERT ? ['scorpion', 'mummy'] : ['stone_golem', 'spider', 'ogre'].slice(0, WILD[b].danger), S - 1);
      cache(x + 13, y + 7, S - 1, Math.min(5, WILD[b].danger + 1));
      afterCarving.push(() => { for (let i = 1; i < 8; i++) if (isCarved(S - 1, x + i, y + Math.round(i / 2))) put(x + i, y + Math.round(i / 2), S - 1, 'rails'); torches(S - 1, [[x + 9, y + 4]]); });
      return true;
    },
    // a farm with a windmill: fields of grain, a farmhouse, hay and a scarecrow
    windmill(x, y, b) {
      if (![TEMPERATE, HILLS, FOREST].includes(b) || !fits(x - 9, y - 6, x + 9, y + 7)) return false;
      put(x - 6, y - 3, S, 'windmill');
      for (const [fx, fy] of [[x - 3, y - 4], [x - 3, y + 1]]) for (let ty = fy; ty < fy + 4; ty++) for (let tx = fx; tx < fx + 9; tx++) { m.setGround(tx, ty, S, 'farmland'); if (tx % 2) put(tx, ty, S, 'crops'); }
      building({ x0: x - 8, y0: y + 1, x1: x - 5, y1: y + 5, roof: 'roof_thatch', doors: [[x - 6, y + 1]] });
      put(x - 7, y + 4, S, 'bed');
      put(x + 7, y + 6, S, 'haystack'); put(x + 1, y, S, 'scarecrow'); put(x + 7, y - 5, S, 'haystack');
      npc('chicken', x - 4, y + 6);
      reserve(x - 9, y - 6, x + 9, y + 7);
      return true;
    },
    // where the woodcutters work: stumps, logs, firewood and their wagon
    lumber(x, y, b) {
      if (![TEMPERATE, FOREST, HILLS, FROST].includes(b) || !fits(x - 5, y - 4, x + 5, y + 4)) return false;
      for (let i = 0; i < 10; i++) { const tx = x - 5 + Math.floor(r() * 11), ty = y - 4 + Math.floor(r() * 9); if (!m.get(tx, ty, S).items.length) put(tx, ty, S, r() < 0.6 ? 'stump' : 'log'); }
      put(x, y, S, 'woodpile'); put(x + 1, y, S, 'woodpile'); put(x - 2, y + 2, S, 'wagon'); put(x + 3, y - 2, S, 'tent'); put(x + 2, y + 2, S, 'campfire');
      reserve(x - 6, y - 5, x + 6, y + 5);
      around(x, y, 4, 2, WILD[b].roam);
      return true;
    },
    // a quarry: a pit of gravel and rubble, cut stone and a living rock
    quarry(x, y, b) {
      if ([SWAMP, JUNGLE].includes(b) || !fits(x - 6, y - 5, x + 6, y + 5)) return false;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -5; dx <= 5; dx++) if (((dx / 5) ** 2 + (dy / 4) ** 2) < 1) m.setGround(x + dx, y + dy, S, 'gravel');
      for (let i = 0; i < 12; i++) { const tx = x - 5 + Math.floor(r() * 11), ty = y - 4 + Math.floor(r() * 9); if (groundAt(tx, ty) === 'gravel' && !m.get(tx, ty, S).items.length) put(tx, ty, S, r() < 0.5 ? 'rock' : 'rubble'); }
      put(x + 4, y + 3, S, 'wagon'); put(x - 3, y - 2, S, 'fallen_pillar');
      reserve(x - 6, y - 5, x + 6, y + 5);
      spawn('stone_golem', [[x, y]]);
      return true;
    },
    // a dragon's nest: eggs, bones, and the mother
    nest(x, y, b) {
      if (![HILLS, VOLCANO, DESERT, FROST].includes(b) || WILD[b].danger < 3 || !fits(x - 5, y - 4, x + 5, y + 4)) return false;
      put(x, y, S, 'eggs');
      for (let i = 0; i < 6; i++) { const tx = x - 4 + Math.floor(r() * 9), ty = y - 3 + Math.floor(r() * 7); if (!m.get(tx, ty, S).items.length) put(tx, ty, S, r() < 0.6 ? 'bones' : 'rock'); }
      spawn(b === FROST ? 'frost_dragon' : b === VOLCANO ? 'dragon_lord' : 'dragon', [[x + 2, y]]);
      cache(x - 1, y + 1, S, 5);
      reserve(x - 6, y - 5, x + 6, y + 5);
      return true;
    },
    // a witch's hut, its cauldron bubbling
    witchhut(x, y, b) {
      if (![SWAMP, FOREST].includes(b) || !fits(x - 4, y - 4, x + 4, y + 4)) return false;
      building({ x0: x - 2, y0: y - 3, x1: x + 1, y1: y, roof: 'roof_thatch', doors: [[x, y]] });
      put(x + 1, y + 2, S, 'cauldron'); put(x - 2, y + 2, S, 'dead_tree'); put(x + 3, y - 2, S, 'mushrooms');
      reserve(x - 4, y - 4, x + 4, y + 4);
      around(x, y + 2, 2, 2, ['witch']);
      cache(x - 1, y - 2, S, WILD[b].danger);
      return true;
    },
    // a wayside shrine: an altar among statues and flowers, peaceful
    shrine(x, y, b) {
      if (!fits(x - 3, y - 3, x + 3, y + 3)) return false;
      put(x, y - 1, S, 'altar');
      for (const [dx, dy] of [[-2, -1], [2, -1]]) put(x + dx, y + dy, S, 'statue');
      for (const [dx, dy] of [[-1, 1], [1, 1], [0, 2]]) put(x + dx, y + dy, S, b === DESERT || b === VOLCANO || b === FROST ? 'rock' : 'flowers');
      sign(x + 2, y + 2, S, 'signpost', oneOf(['A shrine to travellers. Somebody left a coin. Somebody else took it.', 'Rest here, and walk on lighter.', 'Built by a knight who got lost. Twice.']));
      reserve(x - 3, y - 3, x + 3, y + 3);
      return true;
    },
    // an old battlefield: swords in the ground, banners, and the fallen
    battlefield(x, y, b) {
      if (!fits(x - 7, y - 5, x + 7, y + 5)) return false;
      for (let i = 0; i < 14; i++) { const tx = x - 7 + Math.floor(r() * 15), ty = y - 5 + Math.floor(r() * 11); if (!m.get(tx, ty, S).items.length) put(tx, ty, S, oneOf(['sword_grave', 'sword_grave', 'bones', 'bones', 'rubble'])); }
      put(x - 4, y, S, 'flagpole'); put(x + 4, y + 1, S, 'flagpole');
      reserve(x - 7, y - 5, x + 7, y + 5);
      around(x, y, 4, 3, ['skeleton', 'skeleton', 'ghost']);
      return true;
    },
    // where a star fell: a crater of ash with crystals at its heart
    crater(x, y, b) {
      if (!fits(x - 5, y - 5, x + 5, y + 5)) return false;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.hypot(dx, dy); if (d < 4.5) m.setGround(x + dx, y + dy, S, d < 2.5 ? 'ash' : 'gravel'); }
      put(x, y, S, 'crystal'); put(x + 1, y - 1, S, 'crystal'); put(x - 2, y + 1, S, 'rubble'); put(x + 2, y + 2, S, 'rubble');
      cache(x - 1, y - 1, S, Math.min(5, WILD[b].danger + 1));
      reserve(x - 5, y - 5, x + 5, y + 5);
      return true;
    },
    // a fairy ring: a circle of mushrooms in the flowers
    fairyring(x, y, b) {
      if (![TEMPERATE, FOREST, SWAMP, JUNGLE].includes(b) || !fits(x - 4, y - 4, x + 4, y + 4)) return false;
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; put(Math.round(x + Math.cos(a) * 3), Math.round(y + Math.sin(a) * 3), S, 'mushrooms'); }
      for (let i = 0; i < 6; i++) put(x - 1 + Math.floor(r() * 3), y - 1 + Math.floor(r() * 3), S, 'flowers');
      reserve(x - 4, y - 4, x + 4, y + 4);
      return true;
    },
    // an ancient tree, with what makes its home there
    grove(x, y, b) {
      if (![TEMPERATE, FOREST, JUNGLE].includes(b) || !fits(x - 4, y - 4, x + 4, y + 4)) return false;
      put(x, y, S, 'ancient_tree');
      for (let i = 0; i < 8; i++) { const tx = x - 3 + Math.floor(r() * 7), ty = y - 3 + Math.floor(r() * 7); if (!m.get(tx, ty, S).items.length) put(tx, ty, S, oneOf(['fern', 'flowers', 'mushrooms', 'tallgrass'])); }
      reserve(x - 4, y - 4, x + 4, y + 4);
      around(x, y + 2, 3, 2, WILD[b].cave);
      return true;
    },
    // a caravan resting: wagons in a ring around a fire, and a trader
    caravan(x, y, b) {
      if (![DESERT, TEMPERATE, HILLS].includes(b) || !fits(x - 5, y - 5, x + 5, y + 5)) return false;
      for (const [dx, dy] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) put(x + dx, y + dy, S, 'wagon');
      put(x, y, S, 'campfire'); put(x - 1, y - 2, S, 'tent'); put(x + 2, y + 1, S, 'sack'); put(x - 2, y + 1, S, 'basket');
      npc('vendor', x + 1, y - 1);
      reserve(x - 5, y - 5, x + 5, y + 5);
      return true;
    },
    // igloos on the ice
    igloos(x, y, b) {
      if (b !== FROST || !fits(x - 5, y - 4, x + 5, y + 4)) return false;
      for (const [dx, dy] of [[-3, -2], [2, -2], [0, 2]]) put(x + dx, y + dy, S, 'igloo');
      put(x, y, S, 'campfire'); put(x + 4, y + 2, S, 'ice_spike'); put(x - 4, y + 2, S, 'woodpile');
      reserve(x - 5, y - 4, x + 5, y + 4);
      around(x, y, 4, 2, ['ice_wolf', 'yeti']);
      cache(x - 3, y, S, WILD[b].danger);
      return true;
    },
    // a camp of totem poles
    totems(x, y, b) {
      if (![JUNGLE, SWAMP, DESERT].includes(b) || !fits(x - 5, y - 5, x + 5, y + 5)) return false;
      for (const [dx, dy] of [[-3, -3], [3, -3], [0, 3]]) put(x + dx, y + dy, S, 'totem');
      put(x, y, S, 'campfire'); put(x - 2, y + 1, S, 'tent'); put(x + 2, y + 1, S, 'bones');
      reserve(x - 5, y - 5, x + 5, y + 5);
      around(x, y, 3, 4, WILD[b].camp);
      return true;
    },
    // a tomb: a small mausoleum, and a crypt below it
    tomb(x, y, b) {
      if (!fits(x - 4, y - 4, x + 4, y + 4) || !solidBelow(x - 3, y - 3, x + 10, y + 4)) return false;
      const wall = wallOf(b) === 'wall_wood' ? 'wall_stone' : wallOf(b);
      building({ x0: x - 2, y0: y - 2, x1: x + 2, y1: y + 2, floor: b === DESERT ? 'sandstone' : 'cobble', wall, roof: b === DESERT ? 'roof_flat' : 'roof_slate', doors: [[x, y + 2, 'door_closed']] });
      put(x, y, S, 'stairs_down'); put(x - 1, y - 1, S, 'torch'); put(x + 1, y - 1, S, 'torch');
      room(S - 1, x - 1, y - 1, x + 1, y + 1); room(S - 1, x + 2, y, x + 4, y); room(S - 1, x + 5, y - 2, x + 9, y + 2);
      put(x, y, S - 1, 'stairs_up');
      around(x + 7, y, 1, 3, WILD[b].ruin, S - 1);
      cache(x + 9, y - 2, S - 1, Math.min(5, WILD[b].danger + 1));
      reserve(x - 4, y - 4, x + 4, y + 4);
      return true;
    },
    // a village the living left: roofless houses, and those who stayed
    ghosts(x, y, b) {
      if ([VOLCANO].includes(b) || !fits(x - 8, y - 6, x + 8, y + 6)) return false;
      for (const [hx, hy] of [[-7, -5], [2, -5], [-3, 1]]) {
        fill(x + hx, y + hy, x + hx + 4, y + hy + 3, S, 'wood');
        walls(x + hx, y + hy, x + hx + 4, y + hy + 3, S, wallOf(b) === 'wall_sandstone' ? 'wall_sandstone' : 'wall_wood', () => r() < 0.6);
        put(x + hx + 2, y + hy + 1, S, oneOf(['bones', 'rubble', 'web']));
      }
      put(x + 5, y + 3, S, 'well');
      reserve(x - 8, y - 6, x + 8, y + 6);
      around(x, y, 5, 3, ['ghost', 'ghost', 'skeleton']);
      cache(x - 5, y - 4, S, WILD[b].danger);
      return true;
    },
    // beehives in a meadow
    apiary(x, y, b) {
      if (![TEMPERATE, FOREST, HILLS].includes(b) || !fits(x - 3, y - 3, x + 3, y + 3)) return false;
      for (const [dx, dy] of [[-2, -1], [0, -2], [2, -1], [-1, 1], [1, 1]]) put(x + dx, y + dy, S, 'beehive');
      for (let i = 0; i < 6; i++) { const tx = x - 3 + Math.floor(r() * 7), ty = y - 3 + Math.floor(r() * 7); if (!m.get(tx, ty, S).items.length) put(tx, ty, S, 'flowers'); }
      reserve(x - 3, y - 3, x + 3, y + 3);
      return true;
    },
    // an orchard: rows of fruit trees behind a fence
    orchard(x, y, b) {
      if (![TEMPERATE, FOREST, HILLS].includes(b) || !fits(x - 6, y - 5, x + 6, y + 5)) return false;
      walls(x - 6, y - 5, x + 6, y + 5, S, 'fence', (fx, fy) => !(fy === y + 5 && fx === x));
      for (let ty = y - 3; ty <= y + 3; ty += 2) for (let tx = x - 4; tx <= x + 4; tx += 2) put(tx, ty, S, 'tree');
      reserve(x - 7, y - 6, x + 7, y + 6);
      return true;
    },
    // a sunken ruin: a pond with old columns standing in it
    pond(x, y, b) {
      if ([DESERT, VOLCANO, FROST].includes(b) || !fits(x - 5, y - 4, x + 5, y + 4)) return false;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -4; dx <= 4; dx++) if ((dx / 4.3) ** 2 + (dy / 3.3) ** 2 < 1) m.setGround(x + dx, y + dy, S, 'water');
      for (const [dx, dy] of [[-2, -1], [1, -1], [2, 1], [-1, 2]]) put(x + dx, y + dy, S, 'pillar');
      put(x + 4, y - 3, S, 'fallen_pillar');
      reserve(x - 5, y - 4, x + 5, y + 4);
      return true;
    },
    // an arena of stones where the region's fiercest fight
    arena(x, y, b) {
      if (!fits(x - 6, y - 6, x + 6, y + 6)) return false;
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) { const d = Math.hypot(dx, dy); if (d < 5.5) m.setGround(x + dx, y + dy, S, d < 4.5 ? 'sand' : 'cobble'); }
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; if (i % 3) put(Math.round(x + Math.cos(a) * 5), Math.round(y + Math.sin(a) * 5), S, i % 2 ? 'pillar' : 'statue'); }
      put(x, y - 3, S, 'flagpole');
      reserve(x - 6, y - 6, x + 6, y + 6);
      around(x, y, 2, 3, WILD[b].camp);
      cache(x + 2, y - 3, S, Math.min(5, WILD[b].danger + 1));
      return true;
    },
  };
  // Which places turn up in each region, how often (repeat a name to make it likelier)
  const MIX = {
    [TEMPERATE]: ['camp', 'ruin', 'tower', 'hamlet', 'cave', 'graveyard', 'stones', 'castle', 'fort', 'mine', 'windmill', 'windmill', 'lumber', 'shrine', 'battlefield', 'crater', 'fairyring', 'grove', 'caravan', 'tomb', 'ghosts', 'apiary', 'orchard', 'pond', 'arena', 'quarry'],
    [FROST]: ['camp', 'ruin', 'tower', 'hamlet', 'cave', 'stones', 'igloos', 'igloos', 'fort', 'mine', 'lumber', 'nest', 'shrine', 'crater', 'castle', 'battlefield', 'ghosts'],
    [FOREST]: ['camp', 'ruin', 'hamlet', 'cave', 'graveyard', 'stones', 'witchhut', 'grove', 'grove', 'lumber', 'lumber', 'fairyring', 'fort', 'shrine', 'apiary', 'orchard', 'pond', 'castle', 'ghosts', 'mine'],
    [HILLS]: ['camp', 'ruin', 'tower', 'hamlet', 'cave', 'castle', 'castle', 'mine', 'mine', 'quarry', 'quarry', 'nest', 'fort', 'windmill', 'shrine', 'battlefield', 'crater', 'tomb', 'arena', 'caravan'],
    [DESERT]: ['camp', 'ruin', 'tower', 'cave', 'graveyard', 'caravan', 'caravan', 'tomb', 'tomb', 'totems', 'nest', 'crater', 'castle', 'arena', 'battlefield', 'shrine', 'ghosts', 'mine'],
    [SWAMP]: ['camp', 'ruin', 'hamlet', 'cave', 'graveyard', 'witchhut', 'witchhut', 'totems', 'fairyring', 'pond', 'ghosts', 'fort', 'shrine', 'tomb'],
    [JUNGLE]: ['camp', 'ruin', 'cave', 'stones', 'totems', 'totems', 'grove', 'fairyring', 'pond', 'tomb', 'arena', 'shrine', 'crater'],
    [VOLCANO]: ['camp', 'ruin', 'cave', 'crater', 'crater', 'nest', 'tomb', 'arena', 'battlefield', 'castle'],
  };
  // Inns half way along the long roads: somewhere to eat, rest and ask the way.
  const INNS = ['The Halfway House', 'The Weary Wanderer', 'The Crossroads Inn', 'The Last Lantern', 'The Muddy Boots', 'The Sleepy Goat', 'The Road\'s End', 'The Broken Wheel'];
  roadMiddles.forEach(([mx, my], i) => {
    for (let d = 2; d < 12; d++) for (const [ox, oy] of [[0, -d], [d, -d], [-d, -d], [d, 0], [-d, 0], [0, d]]) {
      const x0 = mx + ox - 3, y0 = my + oy - 6;
      if (!fits(x0 - 2, y0 - 1, x0 + 9, y0 + 7)) continue;
      const name = INNS[i % INNS.length], b = biome[my * W + mx];
      building({ x0, y0, x1: x0 + 6, y1: y0 + 5, floor: 'wood', wall: wallOf(b) === 'wall_sandstone' ? 'wall_sandstone' : 'wall_wood', roof: oneOf(['roof', 'roof_shingle', 'roof_thatch']), doors: [[x0 + 3, y0 + 5]] });
      sign(x0 + 4, y0 + 5, S, 'sign_wall', `${name}. Food, drink and a chair by the fire.`);
      shelter(x0, y0, x0 + 6, y0 + 5);
      put(x0 + 1, y0 + 5, S, 'window'); put(x0 + 6, y0 + 2, S, 'window'); put(x0, y0 + 2, S, 'window');
      for (let x = x0 + 1; x <= x0 + 3; x++) put(x, y0 + 2, S, 'counter');
      npc('innkeeper', x0 + 2, y0 + 1);
      put(x0 + 1, y0 + 1, S, 'barrel'); put(x0 + 5, y0 + 1, S, 'campfire'); put(x0 + 5, y0 + 3, S, 'table'); put(x0 + 4, y0 + 3, S, 'chair');
      put(x0 + 5, y0 + 4, S, 'chair'); put(x0 + 5, y0 + 1, S + 1, 'chimney');
      put(x0 + 8, y0 + 3, S, 'well'); put(x0 + 8, y0 + 5, S, 'wagon'); put(x0 - 1, y0 + 6, S, 'lamppost'); put(x0 + 1, y0 + 6, S, 'bench');
      npc(r() < 0.5 ? 'dog' : 'chicken', x0 + 5, y0 + 7);
      road(x0 + 3, y0 + 6, mx, my);
      sign(x0 + 5, y0 + 6, S, 'signpost', `${name}. Rest a while, traveller - the road goes on.`);
      reserve(x0 - 2, y0 - 1, x0 + 9, y0 + 8);
      return;
    }
  });

  // Mountains out in the wilds: cliffs with a path up, monsters of the region on top,
  // often an old chest - and on the big ones a summit above that.
  for (let tries = 0, made = 0; tries < 2500 && made < 16; tries++) {
    const cx = 15 + Math.floor(r() * (W - 30)), cy = 15 + Math.floor(r() * (H - 30)), b = biome[cy * W + cx];
    if (b === SWAMP || b === JUNGLE || (b !== HILLS && r() < 0.5)) continue;
    const rx = 6 + Math.floor(r() * 6), ry = 4 + Math.floor(r() * 4);
    if (wildness(cx, cy) < 1 || !fits(cx - rx - 3, cy - ry - 3, cx + rx + 3, cy + ry + 4)) continue;
    made++;
    const oval = [cx, cy, rx, ry], top = b === FROST ? 'snow' : b === VOLCANO ? 'ash' : 'mountain';
    plateau(S, oval, [TEMPERATE, FOREST, HILLS].includes(b), top);
    const foot = mountainRamp(S, oval, cx);
    for (let y = cy - ry - 2; y <= cy + ry + 3; y++) for (let x = cx - rx - 2; x <= cx + rx + 2; x++) { // boulders at the foot
      const t = m.get(x, y, S);
      if (!t || t.items.length || !NATURAL.includes(t.ground) || Math.abs(x - foot.x) <= 1) continue;
      const atCliff = [[0, -1], [-1, 0], [1, 0]].some(([dx, dy]) => ((m.get(x + dx, y + dy, S) || { items: [] }).items[0] === 'cliff'));
      if (atCliff && r() < 0.25) put(x, y, S, r() < 0.7 ? 'rock' : 'bush');
    }
    if (rx >= 9) {
      const summit = [cx + 1, cy - 1, rx - 4, ry - 2];
      plateau(S + 1, summit, false, top);
      mountainRamp(S + 1, summit, cx + 1);
    }
    hunt(pick(WILD[b].camp), cx, cy, Math.max(2, rx - 2), 2 + Math.floor(r() * 2), S + 1);
    if (r() < 0.6) for (let k = 0; k < 20; k++) {
      const x = cx + Math.round((r() * 2 - 1) * (rx - 3)), y = cy + Math.round((r() * 2 - 1) * (ry - 2)), t = m.get(x, y, S + 1);
      if (t && t.ground === top && !t.items.length && !spawned.has(`${x},${y},${S + 1}`)) { cache(x, y, S + 1, Math.min(5, WILD[b].danger + 1)); break; }
    }
    reserve(cx - rx - 3, cy - ry - 3, cx + rx + 3, cy + ry + 4);
  }

  // Not on Brightwater, Ashport or around Valoria: those are made by hand.
  const handmade = (x, y) => (x < 70 && y < 112) || (x < 160 && y < 112);
  let placed = 0;
  for (let tries = 0; tries < 16000 && placed < 175; tries++) {
    const x = 8 + Math.floor(r() * (W - 16)), y = 8 + Math.floor(r() * (H - 16));
    if (handmade(x, y) || !natural(groundAt(x, y))) continue;
    const b = biome[y * W + x];
    if (PLACES[pick(MIX[b])](x, y, b)) {
      placed++;
      if (r() < 0.3) { // a signpost nearby, now and then
        const sx = x + 6, sy = y - 6;
        if (open(sx, sy) && !reserved[sy * W + sx]) sign(sx, sy, S, 'signpost', pick(SIGNS));
      }
    }
  }
  // Old ways: obelisks in rings of stone that send you to their twin far away
  for (const [ba, bb] of [[FROST, DESERT], [FOREST, SWAMP], [HILLS, JUNGLE]]) {
    const gates = [];
    for (const b of [ba, bb]) for (let tries = 0; tries < 3000; tries++) {
      const x = 10 + Math.floor(r() * (W - 20)), y = 10 + Math.floor(r() * (H - 20));
      if (biome[y * W + x] !== b || wildness(x, y) < 1 || !fits(x - 3, y - 3, x + 3, y + 3)) continue;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; put(Math.round(x + Math.cos(a) * 3), Math.round(y + Math.sin(a) * 2.5), S, i % 2 ? 'rock' : 'statue'); }
      put(x, y - 1, S, 'obelisk');
      reserve(x - 3, y - 3, x + 3, y + 3);
      gates.push({ x, y });
      break;
    }
    if (gates.length < 2) continue;
    gates.forEach((g, i) => {
      const other = gates[1 - i];
      m.ensure(g.x, g.y, S).items = ['teleport'];
      meta(g.x, g.y, S, { to: { x: other.x, y: other.y + 1, z: S } });
      sign(g.x + 1, g.y + 1, S, 'signpost', 'An old way. The obelisk hums, and the light in the ring shows another land.');
    });
  }

  // Every region with a chief gets at least one camp for it
  for (const b of Object.keys(WILD).map(Number)) {
    for (let tries = 0; tries < 4000 && WILD[b].chief && !chiefs.has(b); tries++) {
      const x = 8 + Math.floor(r() * (W - 16)), y = 8 + Math.floor(r() * (H - 16));
      if (biome[y * W + x] === b && !handmade(x, y) && natural(groundAt(x, y))) PLACES.camp(x, y, b);
    }
  }
  // Monsters roaming the land in between
  for (let tries = 0, n = 0; tries < 10000 && n < 330; tries++) {
    const x = 8 + Math.floor(r() * (W - 16)), y = 8 + Math.floor(r() * (H - 16));
    if (handmade(x, y) || !natural(groundAt(x, y)) || reserved[y * W + x] || !open(x, y)) continue;
    spawn(pick(WILD[biome[y * W + x]].roam), [[x, y]]);
    n++;
  }

  // ---- turn the carved underground into floors and walls -------------------------
  const caveGround = (x, y) => ({ [FROST]: 'ice', [VOLCANO]: 'ash' })[biome[y * W + x]] || 'cave';
  // Carved tiles become floors; rock (or crypt blocks) fills 2 tiles around them.
  for (let z = 0; z < S; z++) {
    const near = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const style = carved[z][y * W + x];
      if (!style) continue;
      m.setGround(x, y, z, style === CRYPT ? 'cobble' : caveGround(x, y));
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const i = (y + dy) * W + x + dx;
        if (inMap(x + dx, y + dy) && !near[i]) near[i] = style;
      }
    }
    for (let i = 0; i < W * H; i++) {
      if (!near[i] || carved[z][i]) continue;
      const x = i % W, y = (i - x) / W;
      if (near[i] === CRYPT) { m.setGround(x, y, z, 'cobble'); put(x, y, z, 'wall_block'); }
      else { m.setGround(x, y, z, caveGround(x, y)); put(x, y, z, 'wall_cave'); }
    }
  }
  for (const fn of afterCarving) fn();
  // Dress the caves: rubble and puddles, and - in the open, where nothing gets blocked -
  // stalagmites and crystals that glow; bones and webs in the crypts. Not where people live.
  const lived = (x, y, z) => m.npcs.some(n => n.z === z && Math.abs(n.x - x) <= 15 && Math.abs(n.y - y) <= 15);
  for (let z = 0; z < S; z++) for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
    const style = carved[z][y * W + x];
    if (!style || m.get(x, y, z).items.length || spawned.has(`${x},${y},${z}`)) continue;
    const v = r();
    if (v > 0.08 || lived(x, y, z)) continue;
    let open = true;
    for (let dy = -1; dy <= 1 && open; dy++) for (let dx = -1; dx <= 1; dx++) {
      const t = m.get(x + dx, y + dy, z);
      if (!carved[z][(y + dy) * W + x + dx] || t.items.some(id => THINGS[id].change || THINGS[id].block)) { open = false; break; }
    }
    if (style === CRYPT) {
      const id = v < 0.025 ? 'bones' : v < 0.045 ? 'rubble' : v < 0.055 ? 'web' : null;
      if (id) put(x, y, z, id);
    } else if (open && v < 0.022) put(x, y, z, 'stalagmite');
    else if (open && v < (biome[y * W + x] === FROST ? 0.034 : 0.027)) put(x, y, z, 'crystal');
    else if (v < 0.06) put(x, y, z, 'rubble');
    else if (v < 0.07 && biome[y * W + x] !== VOLCANO) put(x, y, z, 'puddle');
  }
  // Ore glitters in the cave walls here and there; a pick mines it. The more dangerous the
  // cave (the monsters around), and the deeper, the better the ore.
  for (let z = 0; z < S; z++) for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
    const i = y * W + x, t = m.get(x, y, z);
    if (carved[z][i] || !t || t.items[0] !== 'wall_cave') continue;
    const open = [i - 1, i + 1, i - W, i + W].some(j => carved[z][j] && carved[z][j] !== CRYPT);
    if (!open || r() >= 0.04) continue;
    t.items[0] = 'ore_vein';
    const xp = Math.max(0, ...m.spawns.filter(s => s.z === z && Math.abs(s.x - x) <= 15 && Math.abs(s.y - y) <= 15).map(s => MONSTERS[s.type].xp));
    const tier = xp >= 2000 ? 4 : xp >= 600 ? 3 : xp >= 150 ? 2 : xp >= 40 ? 1 : 0;
    m.setMeta(x, y, z, { ore: Math.min(4, Math.max(tier, S - 1 - z)) });
  }
  torches(S - 1, [[38, 41], [44, 47], [19, 57], [8, 56], [11, 62], [17, 68], [25, 68], [41, 101], [27, 102], [51, 101], [56, 100]]);

  // Crypt secret
  put(6, 59, S - 1, 'cracked_rock'); put(4, 59, S - 1, 'qchest_crypt_secret');
  // Beach cache: dig through the loose sand, climb out with the ladder
  m.setGround(59, 40, S, 'sand'); put(59, 40, S, 'loose_sand');
  put(57, 41, S - 1, 'ladder'); put(58, 42, S - 1, 'qchest_sand');
  // Ogre caves: a rope spot leads back up
  put(89, 48, S - 1, 'rope_spot');
  // Pirate caves
  put(42, 102, S - 1, 'stairs_up');
  put(25, 104, S - 1, 'qchest_key'); put(29, 106, S - 1, 'qchest_chart');
  put(31, 101, S - 1, 'lever'); meta(31, 101, S - 1, { target: { x: 28, y: 100, z: S - 1 } });
  put(28, 100, S - 1, 'wall_secret');
  put(28, 96, S - 1, 'qchest_pirate_gold');
  put(45, 102, S - 1, 'door_level'); meta(45, 102, S - 1, { level: 20 });
  put(48, 102, S - 1, 'door_locked'); meta(48, 102, S - 1, { lock: 'bronze' });
  put(54, 102, S - 1, 'door_quest'); meta(54, 102, S - 1, { quest: 'drowned_king@2' });
  put(59, 100, S - 1, 'qchest_tide');
  put(56, 104, S - 1, 'teleport'); meta(56, 104, S - 1, { to: { x: 28, y: 87, z: S } });

  for (const [x0, y0, x1, y1] of [[92, 42, 99, 48], [124, 42, 131, 48], [13, 86, 19, 91], [14, 98, 20, 102]]) shelter(x0, y0, x1, y1);
  m.houses = [
    { id: 'val1', name: 'Elm Cottage', rent: 1500, x0: 92, y0: 42, x1: 99, y1: 48, z: S },
    { id: 'val2', name: 'Scholar House', rent: 1800, x0: 124, y0: 42, x1: 131, y1: 48, z: S },
    { id: 'ash1', name: 'Seagull Cottage', rent: 800, x0: 13, y0: 86, x1: 19, y1: 91, z: S },
    { id: 'ash2', name: 'Driftwood House', rent: 1000, x0: 14, y0: 98, x1: 20, y1: 102, z: S },
  ];

  // ---- vegetation: by biome; dense forest in the north of Brightwater ------------------
  // Keep plants off roads, floors and shores: around anything that isn't open, natural ground.
  const OPEN = new Set(['grass', 'snow', 'jungle', 'swamp', 'ash']);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = m.get(x, y, S);
    if (OPEN.has(t.ground) && !t.items.length) continue;
    if (t.ground === 'sand' && biome[y * W + x] === DESERT && !t.items.length) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inMap(x + dx, y + dy)) reserved[(y + dy) * W + x + dx] = 1;
  }
  const forest = (x, y) => (Math.sin(x * 0.19 + 1.3) + Math.sin(y * 0.23 + 0.4) + Math.sin((x - y) * 0.11 + 2)) / 6 + 0.5;
  const plant = (x, y, list) => { // list: [[chance, thing]...]
    let v = r();
    for (const [chance, id] of list) {
      if (v < chance) return put(x, y, S, typeof id === 'function' ? id() : id);
      v -= chance;
    }
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (reserved[y * W + x]) continue;
    const g = groundAt(x, y), b = biome[y * W + x], woods = Math.max(0, forest(x, y) - 0.55);
    if (g === 'grass' && b === FOREST) plant(x, y, [[0.3, () => (r() < 0.4 ? 'pine' : 'tree')], [0.05, 'bush'], [0.05, 'fern'], [0.02, 'flowers'], [0.04, 'tallgrass'], [0.008, 'log'], [0.006, 'stump'], [0.006, 'mushrooms']]);
    else if (g === 'grass' && b === HILLS) plant(x, y, [[0.05 + woods * 0.4, 'pine'], [0.04, 'rock'], [0.02, 'bush'], [0.03, 'tallgrass'], [0.003, 'stump']]);
    else if (g === 'grass' && b === SWAMP) plant(x, y, [[0.04, 'tree'], [0.05, 'reeds'], [0.04, 'tallgrass'], [0.005, 'log']]);
    else if (g === 'grass') {
      const northWoods = x < 62 && y < 23, treeChance = northWoods ? 0.28 : 0.015 + woods * 0.9;
      plant(x, y, [[treeChance, () => (northWoods || r() < 0.25 ? 'pine' : 'tree')], [0.012, 'bush'], [0.038, 'flowers'], [0.006, 'rock'], [0.045, 'tallgrass'], [0.003 + woods * 0.02, 'stump'], [0.002 + woods * 0.015, 'log']]);
    }
    else if (g === 'snow') plant(x, y, [[0.04 + woods * 0.5, 'snow_pine'], [0.012, 'rock']]);
    else if (g === 'jungle') plant(x, y, [[0.24, 'jungle_tree'], [0.08, 'fern'], [0.03, 'bush'], [0.03, 'tallgrass'], [0.006, 'log']]);
    else if (g === 'sand' && b === DESERT) plant(x, y, [[0.012, 'cactus'], [0.006, 'rock'], [0.003, 'dead_tree'], [0.01, 'dry_bush'], [0.0025, 'bones']]);
    else if (g === 'swamp') plant(x, y, [[0.03, 'dead_tree'], [0.08, 'reeds'], [0.02, 'mushrooms'], [0.02, 'puddle'], [0.005, 'log']]);
    else if (g === 'ash') plant(x, y, [[0.02, 'dead_tree'], [0.03, 'rock']]);
  }
  // ---- the islands, each with its story ----------------------------------------------
  // Every island is one of a kind: its own name, its own people or monsters, its own find.
  m.labels = []; // names for the maps
  const isleLand = I => { // the island's dry land, nearest the middle first
    const tiles = [];
    for (let y = Math.floor(I.cy - I.ry - 3); y <= I.cy + I.ry + 3; y++) for (let x = Math.floor(I.cx - I.rx - 3); x <= I.cx + I.rx + 3; x++) {
      const t = m.get(x, y, S);
      if (t && t.ground && !THINGS[t.ground].block && t.ground !== 'water') tiles.push([x, y]);
    }
    return tiles.sort((a, b) => Math.hypot(a[0] - I.cx, a[1] - I.cy) - Math.hypot(b[0] - I.cx, b[1] - I.cy));
  };
  const emptyAt = (x, y, z = S) => { const t = m.get(x, y, z); return t && t.ground && !THINGS[t.ground].block && !t.items.length && !spawned.has(`${x},${y},${z}`) && !m.npcs.some(n => n.x === x && n.y === y && n.z === z); };
  const anyFree = (I, from = 0) => I.land.slice(from).filter(([x, y]) => emptyAt(x, y));
  const place = (I, id, n = 1, from = 0) => { for (let i = 0; i < n; i++) { const f = anyFree(I, from); if (f.length) { const [x, y] = pick(f); put(x, y, S, id); } } };
  const monsters = (I, type, n, from = 0) => { for (let i = 0; i < n; i++) { const f = anyFree(I, from); if (f.length) spawn(type, [pick(f)]); } };
  const treasure = (I, danger, from = 0) => { const f = anyFree(I, from); if (f.length) { const [x, y] = pick(f); cache(x, y, S, danger); } };
  const reground = (I, ground, coast) => { for (const [x, y] of I.land) m.setGround(x, y, S, coast && groundAt(x, y) === 'sand' ? coast : ground); };
  const shoreWater = I => { // water tiles right off the island's shore
    const w = [];
    for (const [x, y] of I.land) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (groundAt(x + dx, y + dy) === 'water' && !m.get(x + dx, y + dy, S).items.length) w.push([x + dx, y + dy]);
    return w;
  };
  // a little cave below (x, y): stairs down, a hollow of radius rad, stairs back up
  const caveBelow = (x, y, rad, ground = 'cave') => {
    const z = S - 1;
    for (let dy = -rad - 1; dy <= rad + 1; dy++) for (let dx = -rad - 1; dx <= rad + 1; dx++) {
      const d = Math.hypot(dx, dy);
      if (d <= rad) m.set(x + dx, y + dy, z, { ground, items: [] });
      else if (d <= rad + 1.5 && !(m.get(x + dx, y + dy, z) || {}).ground) m.set(x + dx, y + dy, z, { ground, items: ['wall_cave'] });
    }
    m.ensure(x, y, S).items = ['stairs_down'];
    put(x, y, z, 'stairs_up');
    return z;
  };
  const ISLE_STORIES = {
    hermit(I) {
      const [x, y] = I.land[0];
      building({ x0: x - 2, y0: y - 3, x1: x + 1, y1: y, roof: 'roof_thatch', doors: [[x, y]] });
      put(x - 1, y - 2, S, 'bed'); put(x - 1, y - 1, S, 'bookshelf');
      npc('ezra', x + 1, y + 2);
      put(x + 3, y + 2, S, 'campfire');
      place(I, 'flowers', 5, 6); place(I, 'palm', 2, 8);
      sign(x - 1, y + 2, S, 'signpost', 'Hermit\'s Rock. Leave me be - unless you bring news.');
    },
    wreck(I) {
      reground(I, 'sand');
      const water = shoreWater(I);
      for (let i = 0; i < 4 && water.length; i++) { const [x, y] = water.splice(Math.floor(r() * water.length), 1)[0]; put(x, y, S, 'boat'); }
      place(I, 'crate', 4); place(I, 'barrel', 3); place(I, 'bones', 4); place(I, 'rubble', 3);
      monsters(I, 'skeleton', 3); monsters(I, 'pirate', 1);
      treasure(I, 3);
      const [sx, sy] = anyFree(I)[0] || I.land[0];
      sign(sx, sy, S, 'signpost', 'Here the Gull\'s Wing broke on the reef. Her crew never left her.');
    },
    lighthouse(I) {
      const [x, y] = I.land[0];
      building({ x0: x - 2, y0: y - 2, x1: x + 2, y1: y + 2, floor: 'cobble', wall: 'wall_stone', roof: null, doors: [[x, y + 2]] });
      building({ x0: x - 2, y0: y - 2, x1: x + 2, y1: y + 2, z: S + 1, floor: 'wood', wall: 'wall_stone', roof: 'roof_slate' });
      put(x - 1, y - 1, S, 'stairs_up'); put(x - 1, y - 1, S + 1, 'stairs_down'); put(x + 1, y - 1, S + 1, 'campfire'); put(x, y + 2, S + 1, 'window');
      shelter(x - 2, y - 2, x + 2, y + 2); shelter(x - 2, y - 2, x + 2, y + 2, S + 1);
      npc('hesk', x, y);
      place(I, 'rock', 3, 10); place(I, 'tallgrass', 4, 10);
    },
    sunken(I) {
      const [x, y] = I.land[0];
      for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) if (emptyAt(x + dx, y + dy) || (dx === 0 && dy === 0)) m.setGround(x + dx, y + dy, S, 'marble');
      put(x, y - 2, S, 'altar');
      for (const [dx, dy] of [[-3, -2], [3, -2], [-3, 2], [3, 2]]) put(x + dx, y + dy, S, 'pillar');
      for (const [px, py] of shoreWater(I).filter((_, i) => i % 7 === 0).slice(0, 6)) put(px, py, S, 'pillar'); // half drowned
      place(I, 'fallen_pillar', 3, 12); place(I, 'rubble', 4);
      monsters(I, 'ghost', 3, 6);
      treasure(I, 4, 6);
    },
    dragon(I) {
      const oval = [I.cx, I.cy, Math.max(4, Math.round(I.rx - 3)), Math.max(3, Math.round(I.ry - 3))];
      plateau(S, oval, false, 'mountain');
      mountainRamp(S, oval, I.cx);
      put(I.cx, I.cy, S + 1, 'eggs'); put(I.cx + 1, I.cy - 1, S + 1, 'bones'); put(I.cx - 2, I.cy + 1, S + 1, 'bones');
      spawn('dragon', [[I.cx - 1, I.cy - 1]], S + 1);
      for (let k = 0; k < 20; k++) {
        const x = I.cx + Math.round((r() * 2 - 1) * (oval[2] - 2)), y = I.cy + Math.round((r() * 2 - 1) * (oval[3] - 1));
        if (emptyAt(x, y, S + 1)) { cache(x, y, S + 1, 5); break; }
      }
      place(I, 'rock', 4); place(I, 'bones', 3);
    },
    smugglers(I) {
      const [x, y] = I.land[0], z = caveBelow(x, y, 4);
      for (const [dx, dy] of [[-1, -1], [1, -1], [-2, 0], [2, 0]]) if (emptyAt(x + dx, y + dy)) put(x + dx, y + dy, S, 'rock');
      spawn('bandit', [[x - 2, y + 1], [x + 2, y - 1], [x + 1, y + 2]], z);
      put(x - 3, y, z, 'crate'); put(x + 3, y + 1, z, 'barrel'); put(x, y - 3, z, 'torch');
      cache(x + 2, y + 2, z, 3);
      place(I, 'crate', 2, 4); place(I, 'palm', 2, 6);
    },
    grave(I) {
      const [x, y] = I.land[0];
      put(x, y, S, 'gravestone'); put(x, y + 1, S, 'sword_grave');
      place(I, 'flowers', 4, 1);
      sign(I.land[Math.min(3, I.land.length - 1)][0], I.land[Math.min(3, I.land.length - 1)][1], S, 'signpost', 'Here lies Sir Bertil, who swam out to fetch his lady\'s ring, and found it. He never swam back. The ring is still with him.');
      monsters(I, 'ghost', 1, 2);
    },
    fairy(I) {
      const [x, y] = I.land[0];
      reground(I, 'grass', 'sand');
      put(x, y, S, 'obelisk');
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, px = Math.round(x + Math.cos(a) * 3), py = Math.round(y + Math.sin(a) * 2.5); if (emptyAt(px, py)) put(px, py, S, 'mushrooms'); }
      place(I, 'flowers', 14, 4);
      treasure(I, 2, 6);
    },
    witch(I) {
      const [x, y] = I.land[0];
      reground(I, 'swamp', 'sand');
      building({ x0: x - 2, y0: y - 3, x1: x + 1, y1: y, roof: 'roof_thatch', doors: [[x, y]] });
      put(x - 1, y - 2, S, 'bookshelf');
      put(x + 1, y + 2, S, 'cauldron');
      npc('cat', x + 2, y + 1);
      place(I, 'dead_tree', 3, 6); place(I, 'mushrooms', 4, 4);
      monsters(I, 'witch', 3, 4);
      treasure(I, 3, 6);
    },
    orchard(I) {
      reground(I, 'grass', 'sand');
      const [x, y] = I.land[0];
      for (let dy = -3; dy <= 3; dy += 2) for (let dx = -4; dx <= 4; dx += 2) if (emptyAt(x + dx, y + dy)) put(x + dx, y + dy, S, 'tree');
      place(I, 'haystack', 2, 10); place(I, 'scarecrow', 1, 8); place(I, 'stump', 2, 10);
      monsters(I, 'wolf', 2, 8);
      sign(x - 5, y + 4, S, 'signpost', 'Hollin\'s Orchard. The best apples on the sea. (Hollin left. The apples stayed.)');
    },
    frozen(I) {
      reground(I, 'snow');
      const [x, y] = I.land[0];
      put(x, y, S, 'igloo');
      place(I, 'ice_spike', 6, 3); place(I, 'snow_pine', 3, 6);
      monsters(I, 'polar_bear', 2, 4);
      treasure(I, 4, 5);
    },
    ember(I) {
      reground(I, 'ash');
      for (const [x, y] of I.land.slice(4)) if (r() < 0.08 && emptyAt(x, y)) m.setGround(x, y, S, 'lava');
      place(I, 'crystal', 3, 3); place(I, 'dead_tree', 2, 5); place(I, 'rock', 3, 5);
      monsters(I, 'fire_elemental', 2, 3);
      treasure(I, 5, 3);
    },
    treasure(I) {
      const [x, y] = I.land[Math.min(4, I.land.length - 1)];
      place(I, 'palm', 4, 6);
      m.setGround(x, y, S, 'sand');
      m.ensure(x, y, S).items = ['loose_sand'];
      for (const [dx, dy] of [[-3, 0], [3, 1], [0, -3]]) if (emptyAt(x + dx, y + dy)) put(x + dx, y + dy, S, 'rock'); // three stones point at it
      const z = S - 1;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) m.set(x + dx, y + dy, z, { ground: 'cave', items: Math.max(Math.abs(dx), Math.abs(dy)) === 2 ? ['wall_cave'] : [] });
      put(x, y, z, 'ladder');
      cache(x + 1, y - 1, z, 4);
      put(x - 1, y + 1, z, 'treasure');
    },
    castaway(I) {
      const [x, y] = I.land[0];
      reground(I, 'sand');
      npc('wren', x, y);
      put(x + 1, y + 1, S, 'campfire');
      const water = shoreWater(I);
      if (water.length) { const [wx, wy] = water[0]; put(wx, wy, S, 'boat'); }
      place(I, 'palm', 2, 2); place(I, 'rock', 3, 2); // S O S, in stones
    },
    echoes(I) {
      const [x, y] = I.land[0];
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, px = Math.round(x + Math.cos(a) * 3), py = Math.round(y + Math.sin(a) * 2.5); if (emptyAt(px, py)) put(px, py, S, i % 2 ? 'rock' : 'statue'); }
      put(x, y - 1, S, 'obelisk');
      // a door to the mainland: stand in the light and you hear the stones of Valoria
      m.ensure(x, y + 1, S).items = ['teleport'];
      meta(x, y + 1, S, { to: { x: 88, y: 66, z: S } });
      sign(x + 2, y + 2, S, 'signpost', 'The stones echo with voices from far away. Step into the light, if you dare.');
      const [ax, ay] = anyFree(I).find(([fx, fy]) => Math.abs(fx - x) + Math.abs(fy - y - 1) === 2) || anyFree(I)[0]; // where you arrive back
      echoes = { x: ax, y: ay, z: S };
    },
    honey(I) {
      reground(I, 'grass', 'sand');
      const [x, y] = I.land[0];
      npc('melli', x, y);
      place(I, 'beehive', 5, 3); place(I, 'flowers', 10, 3); place(I, 'bush', 3, 6);
    },
    corsairs(I) {
      const [x, y] = I.land[0];
      reground(I, 'sand');
      walls(x - 5, y - 4, x + 5, y + 4, S, 'wall_wood', (wx, wy) => !(wy === y + 4 && Math.abs(wx - x) <= 1) && emptyAt(wx, wy));
      for (const [dx, dy] of [[-3, -2], [3, -2], [-3, 2]]) if (emptyAt(x + dx, y + dy)) put(x + dx, y + dy, S, 'tent');
      put(x, y, S, 'campfire'); put(x + 3, y + 2, S, 'flagpole'); put(x - 4, y - 3, S, 'barrel'); put(x + 4, y - 3, S, 'crate');
      spawn('bandit_chief', [[x + 1, y - 1]]);
      spawn('pirate', [[x - 2, y], [x + 2, y + 1], [x, y + 2], [x - 1, y - 3]]);
      cache(x + 4, y + 3, S, 4);
      for (const [wx, wy] of shoreWater(I).filter((_, i) => i % 9 === 0).slice(0, 2)) put(wx, wy, S, 'boat');
    },
    giants(I) {
      const oval = [I.cx, I.cy, Math.max(5, Math.round(I.rx - 2)), Math.max(4, Math.round(I.ry - 2))];
      plateau(S, oval, true, 'mountain');
      mountainRamp(S, oval, I.cx);
      for (let dx = -1; dx <= 1; dx++) put(I.cx + dx, I.cy, S + 1, 'table');
      put(I.cx, I.cy + 1, S + 1, 'bones'); put(I.cx + 2, I.cy - 1, S + 1, 'campfire');
      spawn('cyclops', [[I.cx - 2, I.cy - 1], [I.cx + 2, I.cy + 1]], S + 1);
      cache(I.cx - 3, I.cy + 1, S + 1, 4);
    },
    webs(I) {
      place(I, 'web', 14); place(I, 'bones', 4); place(I, 'dead_tree', 3, 4);
      monsters(I, 'giant_spider', 2, 3); monsters(I, 'spider', 3);
      treasure(I, 4, 3);
    },
    statues(I) {
      reground(I, 'grass', 'sand');
      const [x, y] = I.land[0];
      for (let dy = -2; dy <= 2; dy += 2) for (let dx = -3; dx <= 3; dx += 3) if (emptyAt(x + dx, y + dy) && (dx || dy)) put(x + dx, y + dy, S, 'statue');
      place(I, 'hedge', 6, 8); place(I, 'flowers', 6, 4);
      spawn('stone_golem', [[x, y]]); // one of them is not a statue
      sign(x + 1, y + 3, S, 'signpost', 'The sculptor Venna made a statue of every friend she had. She ran out of friends before she ran out of stone. Then the stone made friends of its own.');
    },
    bones(I) {
      const [x, y] = I.land[0];
      building({ x0: x - 2, y0: y - 2, x1: x + 2, y1: y + 2, floor: 'cobble', wall: 'wall_stone', roof: 'roof_slate', doors: [[x, y + 2, 'door_closed']] });
      put(x, y - 1, S, 'altar'); cache(x + 1, y, S, 4);
      for (const [gx, gy] of anyFree(I, 6).filter((_, i) => i % 3 === 0).slice(0, 8)) put(gx, gy, S, 'gravestone');
      monsters(I, 'skeleton', 4, 4); monsters(I, 'ghost', 1, 4);
    },
    monks(I) {
      reground(I, 'grass', 'sand');
      const [x, y] = I.land[0];
      building({ x0: x - 3, y0: y - 4, x1: x + 3, y1: y, floor: 'wood', wall: 'wall_stone', roof: 'roof_slate', doors: [[x, y]] });
      shelter(x - 3, y - 4, x + 3, y);
      put(x, y - 3, S, 'altar'); put(x - 2, y - 3, S, 'torch'); put(x + 2, y - 3, S, 'torch'); put(x - 3, y - 2, S, 'window'); put(x + 3, y - 2, S, 'window');
      npc('aurin', x - 1, y - 2);
      for (let dy = 2; dy <= 4; dy++) for (let dx = -3; dx <= 3; dx++) if (emptyAt(x + dx, y + dy)) { m.setGround(x + dx, y + dy, S, 'farmland'); if (dx % 2) put(x + dx, y + dy, S, 'crops'); }
      place(I, 'beehive', 2, 10); place(I, 'tree', 3, 10);
    },
    wizard(I) {
      const [x, y] = I.land[0];
      for (let z = S; z <= S + 2; z++) building({ x0: x - 2, y0: y - 2, x1: x + 2, y1: y + 2, z, floor: z === S ? 'cobble' : 'wood', wall: 'wall_stone', roof: z === S + 2 ? 'roof_slate' : null, doors: z === S ? [[x, y + 2]] : [] });
      put(x - 1, y - 1, S, 'stairs_up'); put(x - 1, y - 1, S + 1, 'stairs_down'); put(x + 1, y + 1, S + 1, 'stairs_up'); put(x + 1, y + 1, S + 2, 'stairs_down');
      put(x + 1, y - 1, S + 1, 'bookshelf'); put(x - 1, y + 1, S + 2, 'bookshelf'); put(x + 1, y - 1, S + 2, 'cauldron');
      spawn('dark_mage', [[x + 1, y]], S); spawn('dark_mage', [[x - 1, y]], S + 1);
      npc('quill', x, y - 1, S + 2);
      cache(x - 1, y - 1, S + 2, 4);
      place(I, 'crystal', 2, 8); place(I, 'fallen_pillar', 1, 8);
      sign(x + 3, y + 3, S, 'signpost', 'The Wizard\'s Folly. Knock first. Then duck.');
    },
    fishers(I) {
      const [x, y] = I.land[0];
      for (const ox of [-3, 2]) building({ x0: x + ox, y0: y - 2, x1: x + ox + 3, y1: y + 1, roof: 'roof_thatch', doors: [[x + ox + 1, y + 1]] });
      shelter(x - 3, y - 2, x + 5, y + 1);
      npc('gil', x, y + 3);
      put(x - 1, y + 3, S, 'barrel'); put(x + 1, y + 3, S, 'basket');
      const water = shoreWater(I);
      for (let i = 0; i < 3 && water.length; i++) { const [wx, wy] = water.splice(Math.floor(r() * water.length), 1)[0]; put(wx, wy, S, 'boat'); }
    },
    battle(I) {
      place(I, 'sword_grave', 7); place(I, 'bones', 6); place(I, 'flagpole', 2, 4); place(I, 'fallen_pillar', 2, 6);
      monsters(I, 'skeleton', 3, 3); monsters(I, 'ghost', 1, 3);
      const [x, y] = I.land[0];
      sign(x, y, S, 'signpost', 'Two kings met here to settle who owned this rock. Nobody won. Nobody left.');
      treasure(I, 3, 5);
    },
    starfall(I) {
      const [x, y] = I.land[0];
      for (const [tx, ty] of I.land.slice(0, 25)) if (emptyAt(tx, ty) || (tx === x && ty === y)) m.setGround(tx, ty, S, 'ash');
      put(x, y, S, 'crystal');
      for (const [dx, dy] of [[-2, 0], [2, 1], [0, -2], [1, 2]]) if (emptyAt(x + dx, y + dy)) put(x + dx, y + dy, S, r() < 0.5 ? 'crystal' : 'rubble');
      treasure(I, 5, 5);
      monsters(I, 'stone_golem', 1, 8);
    },
    serpent(I) {
      reground(I, 'jungle', 'sand');
      const [x, y] = I.land[0];
      put(x, y, S, 'statue');
      place(I, 'fern', 6, 2); place(I, 'jungle_tree', 3, 5);
      monsters(I, 'viper', 3, 2);
      treasure(I, 4, 3);
    },
    scorpions(I) {
      reground(I, 'sand');
      const [x, y] = I.land[0];
      put(x, y, S, 'statue'); put(x + 1, y + 1, S, 'bones');
      place(I, 'cactus', 4, 3); place(I, 'dry_bush', 4, 3);
      monsters(I, 'scorpion', 3, 2);
      treasure(I, 3, 3);
    },
  };
  let echoes = null;
  for (const I of ISLES) {
    I.land = isleLand(I);
    if (I.land.length < 6) continue;
    ISLE_STORIES[I.story](I);
    m.labels.push({ name: I.name, x: I.cx, y: I.cy, z: S });
  }
  // the way back from the Isle of Echoes: a stone circle on the mainland, west of Valoria
  if (echoes) {
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, px = Math.round(88 + Math.cos(a) * 2), py = Math.round(66 + Math.sin(a) * 2); if (emptyAt(px, py)) put(px, py, S, 'rock'); }
    put(88, 64, S, 'obelisk');
    m.ensure(88, 65, S).items = ['teleport'];
    meta(88, 65, S, { to: echoes });
  }

  // Greenhollow: the windmills and fields that feed half the world
  {
    const mills = [[540, 160], [556, 172], [530, 172]];
    for (const [x, y] of mills) if (emptyAt(x, y)) put(x, y, S, 'windmill');
    for (const [fx, fy] of [[536, 164], [548, 158], [544, 176], [560, 162]]) {
      for (let y = fy; y < fy + 4; y++) for (let x = fx; x < fx + 6; x++) if (emptyAt(x, y)) { m.setGround(x, y, S, 'farmland'); if (x % 2) put(x, y, S, 'crops'); }
      if (emptyAt(fx + 6, fy + 1)) put(fx + 6, fy + 1, S, 'haystack');
      if (emptyAt(fx - 1, fy + 2)) put(fx - 1, fy + 2, S, 'scarecrow');
    }
    building({ x0: 549, y0: 164, x1: 554, y1: 168, roof: 'roof_thatch', doors: [[551, 168]] });
    shelter(549, 164, 554, 168);
    npc('farmer_tobben', 551, 166);
    for (const [x, y] of [[548, 170], [553, 170], [545, 168]]) if (emptyAt(x, y)) npc('chicken', x, y);
    m.labels.push({ name: 'Greenhollow', x: 548, y: 166, z: S });
  }
  // the Shattered Isles: what is left of King Aldric's kingdom. Far from everything, the coasts
  // above wear them away to nothing, so they're raised again here: grass with a sandy rim.
  {
    for (const [cx, cy, rx, ry] of [[262, 318, 11, 7], [286, 334, 9, 6], [268, 346, 8, 5], [298, 312, 7, 5], [250, 336, 6, 4]]) {
      for (let y = cy - ry - 1; y <= cy + ry + 1; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + 0.15 * Math.sin(x * 0.9) * Math.cos(y * 1.3);
        if (d < 1 && groundAt(x, y) === 'water' && !m.get(x, y, S).items.length) m.setGround(x, y, S, d > 0.7 ? 'sand' : 'grass');
      }
    }
    npc('ruin_ghost', 262, 318);
    for (const [x, y] of [[258, 316], [266, 316], [258, 321], [266, 321]]) if (emptyAt(x, y)) put(x, y, S, 'pillar');
    for (const [cx, cy] of [[286, 334], [268, 346], [298, 312], [250, 336]]) {
      for (const [dx, dy, id] of [[0, 0, 'fallen_pillar'], [1, -1, 'rubble'], [-1, 1, 'statue'], [2, 1, 'sword_grave']]) if (emptyAt(cx + dx, cy + dy)) put(cx + dx, cy + dy, S, id);
      if (emptyAt(cx + 1, cy + 2)) spawn('skeleton', [[cx + 1, cy + 2]]);
    }
    if (emptyAt(287, 336)) cache(287, 336, S, 4);
    m.labels.push({ name: 'The Shattered Isles', x: 270, y: 328, z: S });
  }
  // the Seawall: a long rock in the west, and the last of its watchtowers
  {
    building({ x0: 14, y0: 203, x1: 18, y1: 207, floor: 'cobble', wall: 'wall_stone', roof: null, doors: [[16, 207]] });
    building({ x0: 14, y0: 203, x1: 18, y1: 207, z: S + 1, floor: 'wood', wall: 'wall_stone', roof: 'roof_slate' });
    put(15, 204, S, 'stairs_up'); put(15, 204, S + 1, 'stairs_down'); put(17, 204, S + 1, 'flagpole');
    shelter(14, 203, 18, 207); shelter(14, 203, 18, 207, S + 1);
    npc('watch_captain', 16, 205);
    for (const [x, y] of [[16, 185], [17, 226]]) { // two towers fallen to rubble
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) if (emptyAt(x + dx, y + dy)) put(x + dx, y + dy, S, dx || dy ? 'rubble' : 'fallen_pillar');
    }
    for (const [x, y] of [[15, 195], [18, 216]]) if (emptyAt(x, y)) spawn('crab', [[x, y]]);
    m.labels.push({ name: 'The Seawall', x: 16, y: 205, z: S });
  }

  // water lilies on the pools of the fen
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (biome[y * W + x] === SWAMP && groundAt(x, y) === 'water' && !m.get(x, y, S).items.length && r() < 0.07) put(x, y, S, 'lilypad');
  }
  return m;
}
