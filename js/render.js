'use strict';
// Draws the map in the classic fake-3D style: floors are painted bottom-up, and
// every floor above the camera floor is shifted one tile up-left on screen
// (floors below: down-right), so upper floors and roofs appear to have height.

// Trees and grass that sway in the wind.
const SWAYING = new Set(['tree', 'pine', 'palm', 'snow_pine', 'jungle_tree', 'dead_tree', 'ancient_tree', 'tallgrass', 'reeds', 'fern', 'flowers', 'bush']);
const BORDER_DIRS = [['ne', 1, -1, 'n', 'e'], ['se', 1, 1, 's', 'e'], ['sw', -1, 1, 's', 'w'], ['nw', -1, -1, 'n', 'w']];

const Render = {
  // v = {
  //   cx, cy:     world pixel (on floor v.z) at the center of the view
  //   z:          camera floor; minZ..maxZ: floors to draw
  //   w, h:       view size in world pixels
  //   time:       for animated tiles
  //   objects:    [{ x, y, z, vx?, vy?, img, lift?, alpha? }] drawn after the items of
  //               tile (x, y), at the visual position (vx, vy) if given (walking
  //               creatures), raised `lift` pixels up-left, see-through with alpha
  //   dimLower:   darken the floors below the camera floor (editor)
  //   afterGround(g, ox, oy, z, x0, x1, y0, y1, groundAt): drawn over each floor's ground,
  //               under everything on it (footprints, deep water)
  //   beyond(z):  the ground shown past the edge of the map on floor z (the open sea), or
  //               null to leave it black (the editor shows where the map ends)
  //   wind:       how hard trees and grass sway (0: still)
  //   roofSnow:   how much snow lies on the roofs (0: none, 1: thick)
  //   seeThrough: { x, y, z }: tall things standing in front of this tile turn see-through
  //   objects may also have flash: 0..1, a white flash over the sprite (a hit)
  // }
  world(g, map, v) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, v.w, v.h);

    const byFloor = new Map();
    for (const o of v.objects || []) {
      if (!byFloor.has(o.z)) byFloor.set(o.z, new Map());
      const tiles = byFloor.get(o.z), k = o.y * map.width + o.x;
      if (!tiles.has(k)) tiles.set(k, []);
      tiles.get(k).push(o);
    }

    for (let z = v.minZ; z <= v.maxZ; z++) {
      if (v.dimLower && z === v.z && z > v.minZ) {
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.fillRect(0, 0, v.w, v.h);
      }
      const shift = (z - v.z) * TILE;
      const ox = Math.round(v.w / 2 - v.cx - shift), oy = Math.round(v.h / 2 - v.cy - shift);
      // Visible tile range on this floor, with a margin for tall things and walking creatures.
      const x0 = Math.max(0, Math.floor(-ox / TILE) - 1), x1 = Math.min(map.width - 1, Math.floor((v.w - ox) / TILE) + 2);
      const y0 = Math.max(0, Math.floor(-oy / TILE) - 1), y1 = Math.min(map.height - 1, Math.floor((v.h - oy) / TILE) + 2);
      const floor = map.floors[z], beyond = v.beyond ? v.beyond(z) : null;
      const tileAt = (x, y) => (x >= 0 && y >= 0 && x < map.width && y < map.height ? floor[y * map.width + x] : null);
      const groundAt = (x, y) => (x >= 0 && y >= 0 && x < map.width && y < map.height ? (floor[y * map.width + x] || {}).ground || null : beyond);
      // The ground layers also cover what shows past the edge of the map.
      const gx0 = beyond ? Math.floor(-ox / TILE) - 1 : x0, gx1 = beyond ? Math.floor((v.w - ox) / TILE) + 2 : x1;
      const gy0 = beyond ? Math.floor(-oy / TILE) - 1 : y0, gy1 = beyond ? Math.floor((v.h - oy) / TILE) + 2 : y1;
      // The wall (if any) on a tile, for shaping walls and dressing doors.
      const wallAt = (x, y) => {
        const t = tileAt(x, y);
        return (t && t.items.find(id => THINGS[id].wall)) || null;
      };

      // A thin wall stands on the south edge of its tile (or the east edge, for an
      // arm going north only), so what shows of the tile past the end of the wall or
      // through a doorway is the ground on the north (west) side of the wall.
      // (On an upper floor there's often nothing on that side - open air - and then nothing shows.)
      const groundShown = (x, y, t) => {
        if (!t.items.some(id => THINGS[id].wall === 'thin')) return t.ground;
        return wallAt(x - 1, y) || !wallAt(x, y - 1) ? groundAt(x, y - 1) : groundAt(x - 1, y);
      };
      // A roof tile's shape: how much further the roof reaches north, south, west and
      // east than towards its nearest edge (0, 1, or 2 for more), and whether the
      // tile is on that edge ('o') or not ('i'). Sprites makes slopes and ridges of it.
      // Kept until the ground of the map changes.
      if (!map.roofShapes || map.roofShapes.version !== map.version) map.roofShapes = { version: map.version, shapes: new Map() };
      const roofShape = (x, y, id) => {
        const key = (z * map.height + y) * map.width + x;
        let shape = map.roofShapes.shapes.get(key);
        if (shape) return shape;
        const reach = (dx, dy) => {
          let d = 0;
          while (d < 16 && groundAt(x + dx * (d + 1), y + dy * (d + 1)) === id) d++;
          return d;
        };
        const d = [reach(0, -1), reach(0, 1), reach(-1, 0), reach(1, 0)], h = Math.min(...d);
        shape = d.map(n => Math.min(2, n - h)).join('') + (h ? 'i' : 'o');
        map.roofShapes.shapes.set(key, shape);
        return shape;
      };
      for (let y = gy0; y <= gy1; y++) for (let x = gx0; x <= gx1; x++) {
        const t = tileAt(x, y);
        if (!t && beyond && !(x >= 0 && y >= 0 && x < map.width && y < map.height)) { g.drawImage(Sprites.thing(beyond, x, y, v.time), ox + x * TILE, oy + y * TILE); continue; }
        if (!t || !t.ground) continue;
        const id = groundShown(x, y, t);
        if (!id) continue;
        const shape = THINGS[id].roof ? roofShape(x, y, id) : undefined;
        g.drawImage(Sprites.thing(id, x, y, v.time, shape), ox + x * TILE, oy + y * TILE);
        if (shape && v.roofSnow > 0.05) { // snow settles on the roofs, in patches that grow together
          g.globalAlpha = 0.95;
          g.drawImage(Sprites.roofSnow(id, shape, Math.min(5, Math.ceil(v.roofSnow * 5))), ox + x * TILE, oy + y * TILE);
          g.globalAlpha = 1;
        }
      }

      // Along the shores: shallow water and foam (under the sand or grass spilling over it).
      const shoreFrame = Math.floor((v.time || 0) / 450) % 4;
      const wet = id => id === 'water';
      const dry = id => !!id && id !== 'water' && id !== 'lava';
      for (let y = gy0; y <= gy1; y++) for (let x = gx0; x <= gx1; x++) {
        if (!wet(groundAt(x, y))) continue;
        const sides = { n: groundAt(x, y - 1), e: groundAt(x + 1, y), s: groundAt(x, y + 1), w: groundAt(x - 1, y) };
        for (const [d, n] of Object.entries(sides)) if (dry(n)) g.drawImage(Sprites.shore(d, shoreFrame), ox + x * TILE, oy + y * TILE);
        for (const [d, dx, dy, a, b] of BORDER_DIRS) {
          if (dry(groundAt(x + dx, y + dy)) && !dry(sides[a]) && !dry(sides[b])) g.drawImage(Sprites.shore(d, shoreFrame), ox + x * TILE, oy + y * TILE);
        }
      }

      // Ground borders: a higher neighbour (grass over dirt over sand over water, and any
      // of those over paving) spills over the edge. Two kinds of paving meet at a kerb.
      for (let y = gy0; y <= gy1; y++) for (let x = gx0; x <= gx1; x++) {
        const here = groundAt(x, y), p = Sprites.borderPriority(here);
        if (p === undefined) continue;
        if (Sprites.paved(here)) {
          const n = groundAt(x, y - 1), w = groundAt(x - 1, y);
          if (n && n !== here && Sprites.paved(n)) g.drawImage(Sprites.kerb('n'), ox + x * TILE, oy + y * TILE);
          if (w && w !== here && Sprites.paved(w)) g.drawImage(Sprites.kerb('w'), ox + x * TILE, oy + y * TILE);
        }
        const above = n => n && n !== here && Sprites.borderPriority(n) > p;
        const sides = { n: groundAt(x, y - 1), e: groundAt(x + 1, y), s: groundAt(x, y + 1), w: groundAt(x - 1, y) };
        const variant = ((x * 73856093) ^ (y * 19349663)) >>> 0; // which of the three shapes, fixed per tile
        for (const [d, n] of Object.entries(sides)) if (above(n)) g.drawImage(Sprites.border(n, d, variant % 3), ox + x * TILE, oy + y * TILE);
        for (const [d, dx, dy, a, b] of BORDER_DIRS) {
          const n = groundAt(x + dx, y + dy);
          if (above(n) && sides[a] !== n && sides[b] !== n) g.drawImage(Sprites.border(n, d, (variant >>> 3) % 3), ox + x * TILE, oy + y * TILE);
        }
      }

      // The open edges of raised ground (mountain tops): a rocky lip, so they don't end in a
      // straight line.
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const here = groundAt(x, y);
        if (!Sprites.hasLip(here)) continue;
        const variant = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        for (const [d, dx, dy] of [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0]]) {
          if (!tileAt(x + dx, y + dy) && x + dx >= 0 && y + dy >= 0 && x + dx < map.width && y + dy < map.height) {
            g.drawImage(Sprites.lip(d, variant % 3), ox + x * TILE, oy + y * TILE);
          }
        }
      }

      if (v.afterGround) v.afterGround(g, ox, oy, z, gx0, gx1, gy0, gy1, groundAt);

      const objects = byFloor.get(z);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const t = floor[y * map.width + x];
        if (t) {
          let wallShape = null;
          for (const id of t.items) {
            const def = THINGS[id];
            let shape, material;
            if (def.wall === 'thin') {
              const sides = [wallAt(x - 1, y), wallAt(x, y - 1), wallAt(x, y + 1), wallAt(x + 1, y)]; // w n s e
              shape = wallShape = sides.map(w => (w ? '1' : '0')).join('');
              const plain = w => w && THINGS[w].wall === 'thin' && !(THINGS[THINGS[w].sprite || w] || {}).toggle && !(THINGS[w].sprite || w).startsWith('door');
              const wall = sides.find(plain);
              material = wall ? THINGS[wall].sprite || wall : 'wall_stone';
            } else if (def.onWall) {
              shape = wallShape || '1000';
            } else if (id === 'fence') { // fences join up with the fences next to them
              const fenceAt = (fx, fy) => { const n = tileAt(fx, fy); return n && n.items.includes('fence') ? '1' : '0'; };
              shape = fenceAt(x - 1, y) + fenceAt(x, y - 1) + fenceAt(x, y + 1) + fenceAt(x + 1, y);
            }
            const img = Sprites.thing(id, x, y, v.time, shape, material), lift = img.width - TILE; // tall things rise up-left
            const st = v.seeThrough, hides = def.tall && !def.wall && st && st.z === z && st.x >= x - 1 && st.x <= x && st.y >= y - 1 && st.y <= y && !(st.x === x && st.y === y);
            if (hides) g.globalAlpha = 0.45;
            if (v.wind && SWAYING.has(id)) { // anchored at its foot, its top sways
              const bx = ox + x * TILE + TILE / 2, by = oy + y * TILE + TILE - 2;
              const lean = v.wind * Math.sin(v.time / 700 + x * 0.9 + y * 1.7) * (id === 'tallgrass' ? 0.12 : 0.035);
              g.save();
              g.translate(bx, by);
              g.transform(1, 0, -lean, 1, 0, 0);
              g.translate(-bx, -by);
              g.drawImage(img, ox + x * TILE - lift, oy + y * TILE - lift);
              g.restore();
            } else g.drawImage(img, ox + x * TILE - lift, oy + y * TILE - lift);
            if (hides) g.globalAlpha = 1;
          }
        }
        const here = objects && objects.get(y * map.width + x);
        if (here) for (const o of here) {
          const lift = o.img.width - TILE + (o.lift || 0);
          if (o.alpha !== undefined) g.globalAlpha = o.alpha;
          const px = Math.round(ox + (o.vx ?? o.x) * TILE - lift), py = Math.round(oy + (o.vy ?? o.y) * TILE - lift);
          g.drawImage(o.img, px, py);
          if (o.flash > 0) { g.globalAlpha = o.flash; g.drawImage(Sprites.silhouette(o.img), px, py); }
          g.globalAlpha = 1;
        }
      }
    }
  },
};
