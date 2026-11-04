'use strict';
// Checks the built-in world: its size, its coast, that every place can be walked to and
// back again, and every stair, ladder, hole and mountain path - by running the game's own
// floor-change code on each one, from every side you can step onto it.
//
//   node tests/world.test.js [--verbose]

const assert = require('assert');
const { loadGame } = require('./harness');

const verbose = process.argv.includes('--verbose');
const { ctx, state } = loadGame();
state.monsters = []; // nobody in the way: this is about the map
const map = state.map, THINGS = state.THINGS, S = map.surfaceZ, W = map.width, H = map.height;
const SIZE = ctx.WORLD_SIZE || require('vm').runInContext('WORLD_SIZE', ctx);
const SIGHTS = require('vm').runInContext('[...MAP_TOWNS, ...MAP_SIGHTS]', ctx);
const DESIGN = require('vm').runInContext('ISLE_DESIGN', ctx);
const GameMap = require('vm').runInContext('GameMap', ctx);
// In a river's bed (rivers run into the sea, but their banks are no coast)
const inRiver = (x, y) => DESIGN.rivers.some(r => r.line.some((p, i) => {
  const q = r.line[i + 1];
  if (!q) return false;
  const vx = q[0] - p[0], vy = q[1] - p[1], t = Math.max(0, Math.min(1, ((x + 0.5 - p[0]) * vx + (y + 0.5 - p[1]) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(x + 0.5 - p[0] - t * vx, y + 0.5 - p[1] - t * vy) <= r.width / 2 + 1;
}));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n${e.stack || e}`); }
}

const key = (x, y, z) => (z * H + y) * W + x;
const unkey = k => { const x = k % W, r = (k - x) / W, y = r % H; return { x, y, z: (r - y) / H }; };
const walkable = (x, y, z) => map.isWalkable(x, y, z);
const change = (x, y, z) => map.floorChange(x, y, z);
const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

// Where stepping onto the floor change at c from a lands you, by the game's own code.
function landing(c, from) {
  const dz = change(c.x, c.y, c.z);
  state.player = Object.assign(state.player, { x: c.x, y: c.y, z: c.z, walk: null });
  return ctx.changeFloor(dz, c.x - from.x, c.y - from.y) ? { x: state.player.x, y: state.player.y, z: state.player.z } : null;
}

// Every floor change, with each side you can step onto it from, and where that lands you.
const transitions = [];
for (let z = 0; z < map.depth; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (!change(x, y, z)) continue;
  const c = { x, y, z, dz: change(x, y, z), id: [map.get(x, y, z).ground, ...map.get(x, y, z).items].find(i => i && THINGS[i].change) };
  c.from = [];
  for (const [dx, dy] of N8) {
    const a = { x: x + dx, y: y + dy, z };
    if (walkable(a.x, a.y, z) && !change(a.x, a.y, z)) c.from.push({ a, to: landing(c, a) });
  }
  transitions.push(c);
}

// The walking graph over all floors: a step onto a floor change takes you where it leads.
const edges = new Map();
const addEdge = (a, b) => { const k = key(a.x, a.y, a.z); if (!edges.has(k)) edges.set(k, []); edges.get(k).push(key(b.x, b.y, b.z)); };
for (let z = 0; z < map.depth; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (!walkable(x, y, z) || change(x, y, z)) continue;
  for (const [dx, dy] of N8) if (walkable(x + dx, y + dy, z) && !change(x + dx, y + dy, z)) addEdge({ x, y, z }, { x: x + dx, y: y + dy, z });
}
for (const c of transitions) for (const { a, to } of c.from) if (to) addEdge(a, to);
const reverse = new Map();
for (const [k, list] of edges) for (const j of list) { if (!reverse.has(j)) reverse.set(j, []); reverse.get(j).push(k); }
const flood = (graph, start) => {
  const seen = new Set([start]), queue = [start];
  while (queue.length) for (const j of graph.get(queue.pop()) || []) if (!seen.has(j)) { seen.add(j); queue.push(j); }
  return seen;
};
const start = key(map.start.x, map.start.y, map.start.z);
const reached = flood(edges, start), back = flood(reverse, start);
const near = (x, y, z, r = 3) => {
  for (let d = 0; d <= r; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) if (walkable(x + dx, y + dy, z) && !change(x + dx, y + dy, z)) return key(x + dx, y + dy, z);
  return null;
};
const islet = () => false; // no islands off the coast: all land must be reachable

test('the world is 256 x 256 tiles on 16 floors, with the surface on floor 8', () => {
  assert.strictEqual(JSON.stringify([map.width, map.height, map.depth, map.surfaceZ]), JSON.stringify([256, 256, 16, 8]));
  assert.strictEqual(JSON.stringify(SIZE), JSON.stringify({ width: 256, height: 256, depth: 16, surfaceZ: 8 }));
  assert.strictEqual(map.floors.length, 16);
});

test('every surface tile is set, and the edge of the world is open sea', () => {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = map.get(x, y, S);
    assert.ok(t && t.ground, `no ground at ${x},${y},${S}`);
    if (x < 4 || y < 4 || x >= W - 4 || y >= H - 4) assert.strictEqual(t.ground, 'water', `land at the edge of the world: ${x},${y}`);
  }
});

test('the sea meets the land on a beach or rocks, never straight on grass or forest', () => {
  // The sea: water joined to the edge of the world (lakes and rivers may have grassy banks).
  const sea = new Set([0]), queue = [0];
  while (queue.length) {
    const i = queue.pop(), x = i % W, y = (i - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, j = ny * W + nx;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && !sea.has(j) && map.get(nx, ny, S).ground === 'water' && !inRiver(nx, ny)) { sea.add(j); queue.push(j); }
    }
  }
  const bad = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const t = map.get(x, y, S);
    if (t.ground === 'water' || !(sea.has(y * W + x - 1) || sea.has(y * W + x + 1) || sea.has((y - 1) * W + x) || sea.has((y + 1) * W + x))) continue;
    if (!['sand', 'mountain', 'dirt', 'swamp', 'bridge_ns', 'bridge_ew'].includes(t.ground)) bad.push(`${x},${y} ${t.ground}`);
  }
  assert.deepStrictEqual(bad, []);
});

test('mountains are solid: cliffs block, and their tops are one floor up at the same place', () => {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let z = S; z < map.depth - 1; z++) {
    const t = map.get(x, y, z);
    if (!t || !t.items.includes('cliff')) continue;
    assert.ok(!walkable(x, y, z), `a cliff you can walk on at ${x},${y},${z}`);
    assert.ok(map.get(x, y, z + 1) && map.get(x, y, z + 1).ground, `a cliff with no top at ${x},${y},${z + 1}`);
  }
});

test('no walkable tile underground opens onto solid rock or the void', () => {
  const bad = [];
  for (let z = 0; z < S; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!walkable(x, y, z)) continue;
    for (const [dx, dy] of N8) if (!map.get(x + dx, y + dy, z)) { bad.push(`${x},${y},${z}`); break; }
  }
  assert.deepStrictEqual(bad, []);
});

test('every stair, ladder, hole and mountain path leads to a free tile one floor away, from every side', () => {
  const problems = [];
  for (const c of transitions) {
    const where = `${c.id} at ${c.x},${c.y},${c.z}`;
    if (c.z + c.dz < 0 || c.z + c.dz >= map.depth) problems.push(`${where} leads off the map`);
    if (!c.from.length) problems.push(`${where} can't be stepped onto`);
    for (const { a, to } of c.from) {
      if (!to) { problems.push(`${where}: no way ${c.dz > 0 ? 'up' : 'down'} when stepping on from ${a.x},${a.y}`); continue; }
      if (to.z !== c.z + c.dz) problems.push(`${where} lands on floor ${to.z}`);
      if (Math.max(Math.abs(to.x - c.x), Math.abs(to.y - c.y)) > 1) problems.push(`${where} lands too far away, at ${to.x},${to.y}`);
      if (change(to.x, to.y, to.z)) problems.push(`${where} lands on another floor change (a loop)`);
    }
  }
  if (verbose) for (const c of transitions) console.log(`       ${c.id} ${c.x},${c.y},${c.z} -> ${c.from.map(f => f.to ? `${f.to.x},${f.to.y},${f.to.z}` : 'nowhere').join(' ')}`);
  assert.deepStrictEqual(problems, []);
  assert.ok(transitions.length > 0, 'there are no floor changes at all');
});

test('every floor change can be taken back: from wherever it lands, you can walk back to the start', () => {
  const stuck = [];
  for (const c of transitions) for (const { a, to } of c.from) {
    if (to && reached.has(key(a.x, a.y, a.z)) && !back.has(key(to.x, to.y, to.z))) stuck.push(`${c.id} at ${c.x},${c.y},${c.z} -> ${to.x},${to.y},${to.z}`);
  }
  assert.deepStrictEqual(stuck, []);
  for (const k of reached) if (!back.has(k)) { const p = unkey(k); assert.fail(`a one-way trap at ${p.x},${p.y},${p.z}`); }
});

test('every named place, road and mountain top can be reached on foot from the start', () => {
  const missing = [];
  for (const [name, x, y, z] of SIGHTS) {
    if (islet(x, y)) continue;
    const k = near(x, y, z);
    if (k === null || !reached.has(k)) missing.push(name);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const g = map.get(x, y, S).ground;
    if (['dirt', 'bridge_ns', 'bridge_ew'].includes(g) && walkable(x, y, S) && !change(x, y, S) && !reached.has(key(x, y, S))) missing.push(`road at ${x},${y}`);
    for (let z = S + 1; z < map.depth; z++) if (walkable(x, y, z) && !change(x, y, z) && !reached.has(key(x, y, z))) missing.push(`upper floor at ${x},${y},${z}`);
  }
  assert.deepStrictEqual(missing, []);
});

test('no land is cut off, apart from pockets of a few tiles between trees', () => {
  const seen = new Set(), cut = [];
  for (let z = 0; z < map.depth; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = key(x, y, z);
    if (!walkable(x, y, z) || change(x, y, z) || reached.has(k) || seen.has(k)) continue;
    const part = flood(edges, k);
    for (const j of part) seen.add(j);
    if (!(z === S && islet(x, y)) && part.size > 6) cut.push(`${part.size} tiles around ${x},${y},${z}`);
  }
  assert.deepStrictEqual(cut, []);
});

test('the start, monsters and NPCs stand on free ground, and no monster in a protection zone', () => {
  assert.ok(walkable(map.start.x, map.start.y, map.start.z) && !change(map.start.x, map.start.y, map.start.z), 'the start is not free');
  for (const s of map.spawns) {
    assert.ok(walkable(s.x, s.y, s.z), `spawn ${s.type} at ${s.x},${s.y},${s.z} is not walkable`);
    assert.ok(!map.isShelter(s.x, s.y, s.z), `spawn ${s.type} at ${s.x},${s.y},${s.z} is in a protection zone or shelter`);
    assert.ok(reached.has(key(s.x, s.y, s.z)), `spawn ${s.type} at ${s.x},${s.y},${s.z} can't be reached`);
  }
  for (const n of map.npcs) assert.ok(walkable(n.x, n.y, n.z), `NPC ${n.type} at ${n.x},${n.y},${n.z} is not walkable`);
});

test('the world saves compactly and loads back tile for tile', () => {
  const json = JSON.stringify(map), copy = GameMap.fromJSON(JSON.parse(json));
  assert.ok(json.length < 1.5e6, `the saved world is ${json.length} bytes`);
  assert.strictEqual(ctx.mapSignature(copy), ctx.mapSignature(map));
  for (let z = 0; z < map.depth; z++) for (let i = 0; i < W * H; i++) {
    const a = map.floors[z][i], b = copy.floors[z][i];
    assert.strictEqual(JSON.stringify(b), JSON.stringify(a), `tile ${i % W},${Math.floor(i / W)},${z} differs`);
  }
  assert.strictEqual(JSON.stringify(copy.start), JSON.stringify(map.start));
});

test('the world comes out the same every time', () => {
  assert.strictEqual(ctx.mapSignature(ctx.createDefaultMap()), ctx.mapSignature(map));
});

console.log(`\n${transitions.length} floor changes, ${reached.size} tiles reachable from the start`);
console.log(failed ? `${failed} of ${passed + failed} failed` : `all ${passed} passed`);
process.exit(failed ? 1 : 0);
