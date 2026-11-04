'use strict';
// A top-down picture of the built-in world, one floor at a time, to compare it with the
// plan in docs/world-plan.md. No browser needed: it writes a PNG itself.
//
//   node tests/world-map.js out.png [z] [--scale 3] [--grid]
//
//   z        the floor (default: the surface). Floors above are drawn over it where they have ground.
//   --scale  pixels per tile (default 3)
//   --grid   a line every 16 tiles, with brighter lines every 64, to read coordinates off

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');
const { ROOT } = require('./harness');

const args = process.argv.slice(2);
const option = (name, flag) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : flag ? (args.splice(i, 1), true) : args.splice(i, 2)[1];
};
const scale = Number(option('--scale') || 3), grid = !!option('--grid', true);
const [out = 'world.png', zArg] = args;

const ctx = vm.createContext({ Math, console });
for (const f of ['defs', 'map', 'default-map']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', `${f}.js`), 'utf8'), ctx);
const map = vm.runInContext('createDefaultMap()', ctx);
const THINGS = vm.runInContext('THINGS', ctx);
const z0 = zArg === undefined ? map.surfaceZ : Number(zArg);

const GROUND = {
  water: [38, 84, 160], grass: [86, 150, 62], sand: [222, 204, 140], dirt: [150, 112, 70], mountain: [128, 120, 110],
  swamp: [80, 98, 60], cave: [70, 62, 54], bridge_ns: [160, 110, 60], bridge_ew: [160, 110, 60], cobble: [140, 140, 140],
  marble: [220, 220, 225], wood: [170, 120, 70], ramp_top: [190, 150, 90], farmland: [120, 90, 50], rock_top: [104, 94, 80],
};
const ITEM = {
  crag: [140, 128, 110], tree: [36, 92, 34], pine: [24, 74, 40], bush: [60, 120, 50], cliff: [92, 84, 76], rock: [112, 108, 100], reeds: [110, 140, 70],
  dead_tree: [90, 80, 60], ramp: [230, 180, 90], wall_cave: [52, 46, 40], stairs_up: [255, 60, 200], stairs_down: [255, 60, 200],
  ladder: [255, 60, 200], hole: [255, 60, 200],
};
const colour = t => {
  if (!t) return null;
  for (let i = t.items.length - 1; i >= 0; i--) {
    const id = t.items[i];
    if (ITEM[id]) return ITEM[id];
    if (THINGS[id] && THINGS[id].change) return [255, 60, 200];
    if (THINGS[id] && THINGS[id].block && !THINGS[id].low) return [60, 60, 60];
  }
  return GROUND[t.ground] || [200, 0, 200];
};

const Wp = map.width * scale, Hp = map.height * scale, px = Buffer.alloc(Wp * Hp * 3);
for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
  let c = colour(map.get(x, y, z0)) || [10, 10, 14];
  // Higher floors with ground (mountain tops) drawn lighter over it.
  for (let z = z0 + 1; z < map.depth; z++) {
    const t = map.get(x, y, z);
    if (t && t.ground) c = colour(t).map(v => Math.min(255, v + 18 * (z - z0)));
  }
  for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
    let p = c;
    if (grid && ((x % 16 === 0 && dx === 0) || (y % 16 === 0 && dy === 0))) p = c.map(v => (x % 64 === 0 && dx === 0) || (y % 64 === 0 && dy === 0) ? 255 : v * 0.6);
    const o = ((y * scale + dy) * Wp + x * scale + dx) * 3;
    px[o] = p[0]; px[o + 1] = p[1]; px[o + 2] = p[2];
  }
}

// A PNG: signature, header, the pixel rows (each with a filter byte), end.
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4), sum = Buffer.alloc(4), body = Buffer.concat([Buffer.from(type), data]);
  len.writeUInt32BE(data.length); sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
};
const header = Buffer.alloc(13);
header.writeUInt32BE(Wp, 0); header.writeUInt32BE(Hp, 4); header[8] = 8; header[9] = 2;
const rows = Buffer.alloc((Wp * 3 + 1) * Hp);
for (let y = 0; y < Hp; y++) px.copy(rows, y * (Wp * 3 + 1) + 1, y * Wp * 3, (y + 1) * Wp * 3);
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]));
console.log(`floor ${z0}: ${map.width}x${map.height} -> ${out}`);
