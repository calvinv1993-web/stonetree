'use strict';
// The world: width x height tiles on `depth` floors. Floor numbers go up with
// altitude; `surfaceZ` is ground level, lower floors are underground.
// A tile is null (nothing there) or { ground: id|null, items: [id, ...] }.

class GameMap {
  constructor(width, height, depth = 8, surfaceZ = 4) {
    Object.assign(this, { width, height, depth, surfaceZ });
    this.floors = Array.from({ length: depth }, () => new Array(width * height).fill(null));
    this.start = { x: width >> 1, y: height >> 1, z: surfaceZ };     // new characters start here
    this.mainStart = { ...this.start };                                // ...and arrive here after choosing a vocation
    this.spawns = []; // monsters: { x, y, z, type }
    this.npcs = [];   // { x, y, z, type }
    this.meta = {};   // per-tile settings, "x,y,z" -> { to, target, lock, quest, level, text, look }
    this.houses = []; // rentable houses: { id, name, rent, x0, y0, x1, y1, z }
    this.zones = [];  // protection zones besides temples and depots (marble floors): { x0, y0, x1, y1, z },
                      // and shelters, where monsters keep out: { ..., shelter: true }
    this.temples = []; // where citizens wake up when they die: { home, town, npc (its priest), x, y, z }
    this.isle = null;  // the starter island { x0, y0, x1, y1 }: who has chosen a vocation can't go back there
    this.version = GameMap.edits = (GameMap.edits || 0) + 1; // changes with every ground set, on any map
  }

  getMeta(x, y, z) {
    return this.meta[`${x},${y},${z}`] || null;
  }
  setMeta(x, y, z, data) {
    if (data) this.meta[`${x},${y},${z}`] = data;
    else delete this.meta[`${x},${y},${z}`];
  }
  houseAt(x, y, z) {
    return this.houses.find(h => h.z === z && x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) || null;
  }
  // Temples and depots (marble floors), and protection zones: no fighting, and no entry for players with a skull.
  isProtected(x, y, z) {
    const t = this.get(x, y, z);
    return !!t && (t.ground === 'marble' || this.zoneAt(x, y, z) === 2);
  }
  // Monsters keep out of these and leave you be in them: protection zones, and shelters
  // (shops, inns, halls), which are no protection zones: players with a skull may go in.
  isShelter(x, y, z) {
    return this.isProtected(x, y, z) || this.zoneAt(x, y, z) === 1;
  }
  // 2 in a protection zone, 1 in a shelter, else 0. The zones are put on a grid the first
  // time they're asked about, and again when there are more or fewer of them.
  zoneAt(x, y, z) {
    const index = this.zoneIndex;
    if (!index || index.zones !== this.zones || index.count !== this.zones.length) {
      const grid = [];
      for (const r of this.zones) {
        if (!this.inBounds(0, 0, r.z)) continue;
        const g = grid[r.z] || (grid[r.z] = new Uint8Array(this.width * this.height));
        for (let y = Math.max(0, r.y0); y <= Math.min(this.height - 1, r.y1); y++) for (let x = Math.max(0, r.x0); x <= Math.min(this.width - 1, r.x1); x++) {
          g[y * this.width + x] = Math.max(g[y * this.width + x], r.shelter ? 1 : 2);
        }
      }
      this.zoneIndex = { zones: this.zones, count: this.zones.length, grid };
    }
    const g = this.inBounds(x, y, z) && this.zoneIndex.grid[z];
    return g ? g[y * this.width + x] : 0;
  }

  inBounds(x, y, z) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.width && y < this.height && z < this.depth;
  }
  get(x, y, z) {
    return this.inBounds(x, y, z) ? this.floors[z][y * this.width + x] : null;
  }
  set(x, y, z, tile) {
    if (!this.inBounds(x, y, z)) return;
    this.floors[z][y * this.width + x] = tile;
    this.version = GameMap.edits = GameMap.edits + 1;
  }
  ensure(x, y, z) {
    let t = this.get(x, y, z);
    if (!t && this.inBounds(x, y, z)) this.set(x, y, z, (t = { ground: null, items: [] }));
    return t;
  }
  setGround(x, y, z, id) {
    const t = this.ensure(x, y, z);
    if (!t) return;
    t.ground = id;
    this.version = GameMap.edits = GameMap.edits + 1;
  }
  addItem(x, y, z, id) {
    const t = this.ensure(x, y, z);
    if (t && t.items[t.items.length - 1] !== id) t.items.push(id);
  }

  isWalkable(x, y, z) {
    const t = this.get(x, y, z);
    if (!t || !t.ground || THINGS[t.ground].block) return false;
    return !t.items.some(id => THINGS[id].block);
  }
  // +1 / -1 when standing here moves you to another floor, else 0.
  floorChange(x, y, z) {
    const t = this.get(x, y, z);
    const id = t && [t.ground, ...t.items].find(i => i && THINGS[i].change);
    return id ? THINGS[id].change : 0;
  }
  // Highest floor drawn when standing at (x, y, z). Anything directly above you,
  // or on the tile that is drawn over you (each floor up is shifted one tile
  // up-left on screen), hides that floor and everything above it - which is how
  // roofs disappear when you walk into a house.
  visibleMaxZ(x, y, z) {
    for (let up = z + 1; up < this.depth; up++) {
      const d = up - z;
      if (this.get(x, y, up) || this.get(x + d, y + d, up)) return up - 1;
    }
    return this.depth - 1;
  }
  floorLabel(z) {
    const d = z - this.surfaceZ;
    return `${z} (${d === 0 ? 'surface' : d > 0 ? `+${d}` : d})`;
  }

  // Saved compactly, so the whole world fits in a browser's storage: every distinct tile once
  // (palette: [ground, items]; 0 is no tile), then all tiles floor by floor, row by row, as
  // runs of the same tile (runs: [palette index, count, ...]).
  toJSON() {
    const palette = [null], index = new Map([['', 0]]), runs = [];
    let last = -1, count = 0;
    for (const floor of this.floors) for (const t of floor) {
      const key = t && (t.ground || t.items.length) ? `${t.ground || ''}|${t.items.join(',')}` : '';
      let i = index.get(key);
      if (i === undefined) {
        i = palette.length;
        index.set(key, i);
        palette.push([t.ground, [...t.items]]);
      }
      if (i === last) count++;
      else {
        if (count) runs.push(last, count);
        last = i;
        count = 1;
      }
    }
    if (count) runs.push(last, count);
    const { width, height, depth, surfaceZ, start, mainStart, spawns, npcs, meta, houses, zones, temples, isle } = this;
    return { format: 'tilequest-map-4', width, height, depth, surfaceZ, start, mainStart, spawns, npcs, meta, houses, zones, temples, isle, palette, runs };
  }
  static fromJSON(o) {
    const m = new GameMap(o.width, o.height, o.depth, o.surfaceZ);
    m.start = { ...o.start };
    m.mainStart = { ...(o.mainStart || o.start) };
    m.spawns = (o.spawns || []).filter(s => MONSTERS[s.type]).map(s => ({ ...s }));
    m.npcs = (o.npcs || []).filter(n => NPCS[n.type]).map(n => ({ ...n }));
    m.meta = JSON.parse(JSON.stringify(o.meta || {}));
    m.houses = (o.houses || []).map(h => ({ ...h }));
    m.zones = (o.zones || []).map(r => ({ ...r }));
    m.temples = (o.temples || []).filter(t => !t.npc || NPCS[t.npc]).map(t => ({ ...t })); // a temple without a priest yet is kept
    m.isle = o.isle ? { ...o.isle } : null;
    const tile = (ground, items) => ({ ground: THINGS[ground] ? ground : null, items: (items || []).filter(id => THINGS[id]) });
    if (o.runs) { // tilequest-map-4
      const size = o.width * o.height;
      for (let r = 0, at = 0; r < o.runs.length; r += 2) {
        const p = o.palette[o.runs[r]], end = at + o.runs[r + 1];
        if (p) for (let i = at; i < end; i++) m.set(i % size % o.width, Math.floor((i % size) / o.width), Math.floor(i / size), tile(p[0], p[1]));
        at = end;
      }
    } else { // tilequest-map-3: a list of [x, y, z, ground, items]
      for (const [x, y, z, ground, items] of o.tiles || []) m.set(x, y, z, tile(ground, items));
    }
    return m;
  }
}

// A quick fingerprint of a map (a sample of its tiles), to check that two copies
// are the same world - e.g. the built-in world a page made for itself, and the server's.
function mapSignature(m) {
  let h = (m.width * 31 + m.height * 17 + m.depth * 7 + m.spawns.length * 13 + m.npcs.length) | 0;
  for (let z = 0; z < m.depth; z++) {
    const floor = m.floors[z];
    for (let i = z; i < floor.length; i += 97) {
      const t = floor[i], s = t ? `${t.ground}|${t.items.join(',')}` : '-';
      for (let k = 0; k < s.length; k++) h = (h * 33 + s.charCodeAt(k)) | 0;
    }
  }
  return h;
}

const MAP_STORAGE_KEY = 'tilequest.map.v3';

function loadStoredMap() {
  try {
    const json = localStorage.getItem(MAP_STORAGE_KEY);
    if (json) {
      const saved = JSON.parse(json);
      // Only a map of the built-in world's size: an editor map of an older world would
      // otherwise silently replace it.
      const size = typeof WORLD_SIZE !== 'undefined' ? WORLD_SIZE : saved;
      if (saved.width === size.width && saved.height === size.height && saved.depth === size.depth && saved.surfaceZ === size.surfaceZ)
        return GameMap.fromJSON(saved);
    }
  } catch (e) {
    console.warn('Could not load the stored map:', e);
  }
  return null;
}

function storeMap(map) {
  try {
    localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(map));
    return true;
  } catch (e) {
    console.warn('Could not store the map:', e);
    return false;
  }
}

class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(priority, value) {
    const a = this.items;
    a.push({ priority, value });
    for (let i = a.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (a[p].priority <= a[i].priority) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].priority < a[m].priority) m = l;
        if (r < a.length && a[r].priority < a[m].priority) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top.value;
  }
}

// A* on a single floor with 8-way movement (diagonals cost more, like in the
// game). Returns the [x, y] steps to take, excluding the start, or null.
// Getting within `range` tiles of the goal counts as arriving (`adjacent` = range 1).
// It gives up after expanding `maxNodes` tiles.
// stepCost(x, y): how much slower a step onto (x, y) is than the quickest step (>= 1), to
// find the quickest way rather than the shortest.
// diagonalCost: what a diagonal step costs against a straight one (2, as a diagonal step takes twice as long);
// high, and paths take diagonals only where they must.
function findPath(passable, sx, sy, gx, gy, { adjacent = false, range = adjacent ? 1 : 0, maxNodes = 4000, stepCost = null, orthogonalOnly = false, diagonalCost = 2 } = {}) {
  const arrived = (x, y) => Math.max(Math.abs(x - gx), Math.abs(y - gy)) <= range;
  const h = (x, y) => {
    const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
    return Math.max(dx, dy) + 0.5 * Math.min(dx, dy);
  };
  const key = (x, y) => y * 65536 + x;
  const cost = new Map([[key(sx, sy), 0]]);
  const cameFrom = new Map();
  const open = new MinHeap();
  open.push(h(sx, sy), [sx, sy, 0]);

  for (let expanded = 0; open.size && expanded < maxNodes; expanded++) {
    const [x, y, c] = open.pop();
    if (c > cost.get(key(x, y))) continue; // stale heap entry
    if (arrived(x, y)) {
      const path = [];
      for (let k = key(x, y); k !== key(sx, sy); k = cameFrom.get(k)) path.push([k % 65536, Math.floor(k / 65536)]);
      return path.reverse();
    }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if ((!dx && !dy) || (orthogonalOnly && dx && dy) || !passable(nx, ny)) continue;
        const nc = c + (dx && dy ? diagonalCost : 1) * (stepCost ? stepCost(nx, ny) : 1), k = key(nx, ny);
        if (nc < (cost.get(k) ?? Infinity)) {
          cost.set(k, nc);
          cameFrom.set(k, key(x, y));
          open.push(nc + h(nx, ny), [nx, ny, nc]);
        }
      }
    }
  }
  return null;
}
