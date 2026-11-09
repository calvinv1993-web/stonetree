'use strict';
// Draws the map in the classic fake-3D style: floors are painted bottom-up, and
// every floor above the camera floor is shifted one tile up-left on screen
// (floors below: down-right), so upper floors and roofs appear to have height.

// Trees and grass that sway in the wind.
const SWAYING = new Set(['tree', 'pine', 'palm', 'snow_pine', 'jungle_tree', 'dead_tree', 'ancient_tree', 'tallgrass', 'reeds', 'fern', 'flowers', 'bush']);
const LIQUID = new Set(['water', 'sewer_water', 'lava']); // grounds a wall can stand in
const EDGE_NEIGHBOURS = [[1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0], [16, 1, -1], [32, 1, 1], [64, -1, 1], [128, -1, -1]]; // see Sprites.edge
const BORDER_DIRS = [['ne', 1, -1, 'n', 'e'], ['se', 1, 1, 's', 'e'], ['sw', -1, 1, 's', 'w'], ['nw', -1, -1, 'n', 'w']];

const Render = {
  // Draw an upright picture (a creature, drawn at px, py) leaning into the walls' slant from its feet: every pixel
  // as far left as it stands above the feet, so its height runs up-left as a wall's does (32 up, 32 left).
  CREATURE_LEAN: 0, // creatures are built in 3D now (Sprites' dolls): they stand upright, as in the world they would
  // It has some depth too: a darker copy of it a few pixels behind (north of) it, which shows along its top and
  // its east side, as a block's top and east face do.
  CREATURE_DEPTH: 0, // (a darker copy behind a flat picture, for depth; not needed for dolls)
  slanted(g, img, px, py, draw) {
    const foot = py + Sprites.h(img) - 2;
    g.save();
    g.transform(1, 0, Render.CREATURE_LEAN, 1, -foot * Render.CREATURE_LEAN, 0); // x' = x + lean * (y - foot)
    if (Render.CREATURE_DEPTH) {
      const back = Render.shadeOf(img), a = g.globalAlpha;
      for (let d = Render.CREATURE_DEPTH; d >= 1; d--) g.drawImage(back, px + d * 0.8, py - d * 0.6, Sprites.w(img), Sprites.h(img)); // its shaded east side and top, behind it
      g.globalAlpha = a;
    }
    draw();
    g.restore();
  },
  // A picture made round: lit on its left, in shade on its right, so a body, arms and a head look round, not flat.
  roundOf(img) {
    const cache = Render.rounds || (Render.rounds = new WeakMap());
    let c = cache.get(img);
    if (!c) {
      c = document.createElement('canvas');
      Object.assign(c, { width: img.width, height: img.height, res: img.res });
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      const gr = g.createLinearGradient(img.width * 0.15, 0, img.width * 0.85, 0);
      gr.addColorStop(0, 'rgba(255,250,235,0.16)');
      gr.addColorStop(0.45, 'rgba(255,255,255,0)');
      gr.addColorStop(1, 'rgba(10,8,20,0.32)');
      g.fillStyle = gr;
      g.fillRect(0, 0, img.width, img.height);
      cache.set(img, c);
    }
    return c;
  },
  // A darker copy of a picture (its sides in shade), made once per picture.
  shadeOf(img) {
    const cache = Render.shades || (Render.shades = new WeakMap());
    let c = cache.get(img);
    if (!c) {
      c = document.createElement('canvas');
      Object.assign(c, { width: img.width, height: img.height, res: img.res });
      const g = c.getContext('2d');
      g.filter = 'brightness(0.45) saturate(0.8)';
      g.drawImage(img, 0, 0);
      cache.set(img, c);
    }
    return c;
  },
  DEEPEST: 0.75, // the floors far below you never get darker than this (25% darker at most)
  // v = {
  //   cx, cy:     world pixel (on floor v.z) at the center of the view
  //   z:          camera floor; minZ..maxZ: floors to draw
  //   w, h:       view size in world pixels
  //   time:       for animated tiles
  //   objects:    [{ x, y, z, vx?, vy?, img, lift?, alpha?, slant? }] drawn after the items of
  //               tile (x, y), at the visual position (vx, vy) if given (walking
  //               creatures), raised `lift` pixels up-left, see-through with alpha
  //   dimLower:   darken the floors below the camera floor (editor)
  //   depth:      how much darker each floor below the camera floor gets (0..1; the game: they lie deeper, in shadow)
  //   onFloor(g, ox, oy, z): drawn on each floor after its ground and rugs, before anything standing on it
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

    let lit = 1; // how bright what's drawn so far still is, after the floors above it darkened it
    for (let z = v.minZ; z <= v.maxZ; z++) {
      // what's drawn so far lies below this floor: darker, a floor at a time down to the camera floor
      let shade = z > v.minZ && z <= v.z ? (v.dimLower ? (z === v.z ? 0.5 : 0) : v.depth || 0) : 0;
      if (shade && !v.dimLower) { // however deep, what's below stays at least DEEPEST lit: not night under a tower
        shade = Math.max(0, Math.min(shade, 1 - Render.DEEPEST / lit));
        lit *= 1 - shade;
      }
      if (shade) {
        g.fillStyle = `rgba(0,0,0,${shade})`;
        g.fillRect(0, 0, v.w, v.h);
      }
      const shift = (z - v.z) * TILE;
      const ox = Math.round(v.w / 2 - v.cx - shift), oy = Math.round(v.h / 2 - v.cy - shift);
      // Visible tile range on this floor, with a margin for tall things and walking creatures.
      const x0 = Math.max(0, Math.floor(-ox / TILE) - 1), x1 = Math.min(map.width - 1, Math.floor((v.w - ox) / TILE) + 2);
      const y0 = Math.max(0, Math.floor(-oy / TILE) - 1), y1 = Math.min(map.height - 1, Math.floor((v.h - oy) / TILE) + 2);
      const floor = map.floors[z], beyond = v.beyond ? v.beyond(z) : null;
      const tileAt = (x, y) => (x >= 0 && y >= 0 && x < map.width && y < map.height ? floor[y * map.width + x] : null);
      const rawGroundAt = (x, y) => (x >= 0 && y >= 0 && x < map.width && y < map.height ? (floor[y * map.width + x] || {}).ground || null : beyond);
      // The ground as it shows: under a wall, the ground the wall stands in (groundShown), so every border, shore
      // and edge treats a wall's tile as what you see there, not the grass hidden under it. (Once per tile.)
      const shownCache = new Map();
      const groundAt = (x, y) => {
        const t = tileAt(x, y);
        if (!t || !t.items.some(id => THINGS[id].wall === 'thin')) return rawGroundAt(x, y);
        const k = y * map.width + x;
        if (!shownCache.has(k)) shownCache.set(k, groundShown(x, y, t) || t.ground);
        return shownCache.get(k);
      };
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
        let beside = wallAt(x - 1, y) || !wallAt(x, y - 1) ? rawGroundAt(x, y - 1) : rawGroundAt(x - 1, y);
        // a building's corner on its terrace or street: the wall stands on that paving, not on the grass beside it
        if (!beside) { // at the edge of a raised floor: the open ground beside it (not another wall's floor), or nothing
          const open = [[1, 0], [-1, 0], [0, 1]].find(([dx, dy]) => rawGroundAt(x + dx, y + dy) && !wallAt(x + dx, y + dy));
          beside = open ? rawGroundAt(x + open[0], y + open[1]) : null;
          // a building's corner on the very edge of a raised mount stands on the mount's own top
          const under = !beside && z > 0 && map.get(x, y, z - 1);
          if (under && under.items.includes('cliff')) beside = 'grass';
        }
        const below = rawGroundAt(x, y + 1);
        if (below && !wallAt(x, y + 1) && Sprites.paved(below) && !(beside && Sprites.paved(beside))) beside = below;
        return beside && THINGS[beside].block && !LIQUID.has(beside) ? t.ground : beside; // (a wall stands in water, as a quay or a moat wall does; not in rock)
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
      // A bridge's shape: whether the same bridge goes on past its left and right side (west and east for one
      // you cross north-south, north and south for one you cross east-west), so a wide bridge is one deck.
      const bridgeShape = (x, y, id) => {
        if (!id.endsWith('bridge_ns') && !id.endsWith('bridge_ew')) return undefined;
        const [a, b] = id.endsWith('_ns') ? [groundAt(x - 1, y), groundAt(x + 1, y)] : [groundAt(x, y - 1), groundAt(x, y + 1)];
        return `${a === id ? 1 : 0}${b === id ? 1 : 0}`;
      };
      for (let y = gy0; y <= gy1; y++) for (let x = gx0; x <= gx1; x++) {
        const t = tileAt(x, y);
        if (!t && beyond && !(x >= 0 && y >= 0 && x < map.width && y < map.height)) {
          g.save();
          if (beyond === 'water') {
            g.imageSmoothingEnabled = true;
            g.drawImage(Sprites.water(x, y, v.time) || Sprites.thing(beyond, x, y, v.time), ox + x * TILE, oy + y * TILE, TILE, TILE);
          } else g.drawImage(Sprites.thing(beyond, x, y, v.time), ox + x * TILE, oy + y * TILE);
          g.restore(); continue;
        }
        if (!t || !t.ground) continue;
        const id = groundShown(x, y, t);
        if (!id) continue;
        const shape = THINGS[id].roof ? roofShape(x, y, id) : bridgeShape(x, y, id);
        if (id === 'water') {
          g.save(); g.imageSmoothingEnabled = true;
          g.drawImage(Sprites.water(x, y, v.time) || Sprites.thing(id, x, y, v.time), ox + x * TILE, oy + y * TILE, TILE, TILE);
          g.restore();
        } else g.drawImage(Sprites.thing(id, x, y, v.time, shape), ox + x * TILE, oy + y * TILE);
        if (shape && v.roofSnow > 0.05) { // snow settles on the roofs, in patches that grow together
          g.globalAlpha = 0.95;
          g.drawImage(Sprites.roofSnow(id, shape, Math.min(5, Math.ceil(v.roofSnow * 5))), ox + x * TILE, oy + y * TILE);
          g.globalAlpha = 1;
        }
      }

      // Along the shores: shallow water and foam (under the sand or grass spilling over it).
      const shoreFrame = Math.floor((v.time || 0) / 80) % 32;
      const wet = id => id === 'water';
      const dry = id => !!id && id !== 'water' && id !== 'lava';
      for (let y = gy0; y <= gy1; y++) for (let x = gx0; x <= gx1; x++) {
        if (!wet(groundAt(x, y))) continue;
        // (a wall rises straight out of the water: no beach along it)
        const bank = (bx, by) => (wallAt(bx, by) ? 'water' : groundAt(bx, by));
        const sides = { n: bank(x, y - 1), e: bank(x + 1, y), s: bank(x, y + 1), w: bank(x - 1, y) };
        for (const [d, n] of Object.entries(sides)) if (dry(n)) g.drawImage(Sprites.shore(d, shoreFrame), ox + x * TILE, oy + y * TILE, TILE, TILE);
        for (const [d, dx, dy, a, b] of BORDER_DIRS) {
          if (dry(bank(x + dx, y + dy)) && !dry(sides[a]) && !dry(sides[b])) g.drawImage(Sprites.shore(d, shoreFrame), ox + x * TILE, oy + y * TILE, TILE, TILE);
        }
      }

      // Ground borders: a higher neighbour (grass over dirt over sand over water, and any
      // of those over paving) spills over the edge. Two kinds of paving meet at a kerb.
      for (let y = gy0; y <= gy1; y++) for (let x = gx0; x <= gx1; x++) {
        // a wall stands on this tile: the ground round it meets the wall; nothing spills under it, unless the wall
        // stands on paving (a building's corner on its terrace), whose edge then runs on as the paving's beside it
        const walled = (wx, wy) => { const t = tileAt(wx, wy); return !!t && t.items.some(id => THINGS[id].wall); };
        const wt = tileAt(x, y), onWall = walled(x, y), shown = onWall && wt ? groundShown(x, y, wt) : null;
        if (onWall && !(shown && Sprites.paved(shown))) continue;
        const here = onWall ? shown : groundAt(x, y), p = Sprites.borderPriority(here);
        if (p === undefined) continue;
        if (Sprites.paved(here)) {
          const n = groundAt(x, y - 1), w = groundAt(x - 1, y);
          if (n && n !== here && Sprites.paved(n)) g.drawImage(Sprites.kerb('n'), ox + x * TILE, oy + y * TILE);
          if (w && w !== here && Sprites.paved(w)) g.drawImage(Sprites.kerb('w'), ox + x * TILE, oy + y * TILE);
        }
        // Each higher ground around this tile spills its edge in, all its sides and corners at once (lowest first).
        let higher = null;
        for (const [bit, dx, dy] of EDGE_NEIGHBOURS) {
          const n = groundAt(x + dx, y + dy), q = n && n !== here ? Sprites.borderPriority(n) : undefined;
          if (q === undefined || !(q > p) || walled(x + dx, y + dy)) continue;
          higher = higher || new Map();
          higher.set(n, (higher.get(n) || 0) | bit);
        }
        // this tile's own corners: rounded off where a lower ground lies on both sides and across the corner
        if (Sprites.cornerCut) for (const [d, dx, dy, a, b] of BORDER_DIRS) {
          const n = groundAt(x + dx, y + dy), q = n && n !== here ? Sprites.borderPriority(n) : undefined;
          if (q === undefined || !(q < p) || Sprites.paved(n) || groundAt(x + dx, y) !== n || groundAt(x, y + dy) !== n) continue; // (built ground keeps its square corners)
          if (walled(x + dx, y) || walled(x, y + dy) || walled(x + dx, y + dy)) continue;
          g.drawImage(Sprites.cornerCut(here, n, d, x, y), ox + x * TILE, oy + y * TILE);
        }
        if (!higher) continue;
        const variant = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 3; // which wobble, fixed per tile
        for (const [n, mask] of [...higher].sort((a, b) => Sprites.borderPriority(a[0]) - Sprites.borderPriority(b[0]))) {
          g.drawImage(Sprites.edge(n, mask, variant, x, y, Sprites.paved(here)), ox + x * TILE, oy + y * TILE);
        }
      }

      // Around the foot of rock walls: scree on the ground next to them (not under walls themselves).
      const rockAt = (x, y) => { const t = tileAt(x, y); return !!t && t.items.some(id => Sprites.hasFoot(id)); };
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const t = tileAt(x, y);
        if (!t || !t.ground || THINGS[t.ground].block || rockAt(x, y) || t.items.some(id => THINGS[id].wall || THINGS[id].change)) continue; // nor over steps
        const variant = ((x * 83492791) ^ (y * 2654435761)) >>> 0, sides = {};
        for (const [d, dx, dy] of [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0]]) {
          sides[d] = rockAt(x + dx, y + dy);
          if (sides[d]) g.drawImage(Sprites.foot(d, variant % 3), ox + x * TILE, oy + y * TILE);
        }
        for (const [d, dx, dy, a, b] of BORDER_DIRS) {
          if (rockAt(x + dx, y + dy) && !sides[a] && !sides[b]) g.drawImage(Sprites.foot(d, (variant >>> 4) % 3), ox + x * TILE, oy + y * TILE);
        }
      }

      // The open edges of raised ground (mountain tops): a rocky lip, so they don't end in a
      // straight line.
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const lt = tileAt(x, y), here = lt && lt.items.some(id => THINGS[id].wall === 'thin') ? groundShown(x, y, lt) : groundAt(x, y); // (a wall at the edge stands on the ground beside it, rocks and all)
        if (!Sprites.hasLip(here)) continue;
        const variant = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        for (const [d, dx, dy] of [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0]]) {
          if (!tileAt(x + dx, y + dy) && x + dx >= 0 && y + dy >= 0 && x + dx < map.width && y + dy < map.height) {
            g.drawImage(Sprites.lip(d, variant % 3), ox + x * TILE, oy + y * TILE);
          }
        }
      }

      if (v.afterGround) v.afterGround(g, ox, oy, z, gx0, gx1, gy0, gy1, groundAt);

      // Rugs are floor objects: paint them before furniture, walls and creatures.
      const rugAt = (x, y) => { const t = tileAt(x, y); return !!t && t.items.includes('carpet_rug'); };
      for (let y = gy0; y <= gy1; y++) for (let x = gx0; x <= gx1; x++) {
        if (!rugAt(x, y)) continue;
        const shape = [[0, -1], [1, 0], [0, 1], [-1, 0]]
          .map(([dx, dy]) => rugAt(x + dx, y + dy) ? '1' : '0').join('');
        g.drawImage(Sprites.thing('carpet_rug', x, y, v.time, shape), ox + x * TILE, oy + y * TILE);
      }
      if (v.onFloor) v.onFloor(g, ox, oy, z); // marks on the floor itself (where you're walking): under everything on it

      const objects = byFloor.get(z);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const t = floor[y * map.width + x];
        if (t) {
          let wallShape = null;
          for (const id of t.items) {
            if (id === 'carpet_rug') continue;
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
            const img = Sprites.thing(id, x, y, v.time, shape, material), lift = img.width - TILE, rise = img.height - TILE; // tall things rise up-left
            const st = v.seeThrough, hides = def.tall && !def.wall && st && st.z === z && st.x >= x - 1 && st.x <= x && st.y >= y - 1 && st.y <= y && !(st.x === x && st.y === y);
            if (hides) g.globalAlpha = 0.45;
            if (v.wind && SWAYING.has(id)) { // anchored at its foot, its top sways
              const bx = ox + x * TILE + TILE / 2, by = oy + y * TILE + TILE - 2;
              const lean = v.wind * Math.sin(v.time / 700 + x * 0.9 + y * 1.7) * (id === 'tallgrass' ? 0.12 : 0.035);
              g.save();
              g.translate(bx, by);
              g.transform(1, 0, -lean, 1, 0, 0);
              g.translate(-bx, -by);
              g.drawImage(img, ox + x * TILE - lift, oy + y * TILE - rise);
              g.restore();
            } else g.drawImage(img, ox + x * TILE - lift, oy + y * TILE - rise);
            if (hides) g.globalAlpha = 1;
          }
        }
        const here = objects && objects.get(y * map.width + x);
        if (here) for (const o of here) {
          const iw = Sprites.w(o.img), ih = Sprites.h(o.img), lift = iw - TILE + (o.lift || 0);
          if (o.alpha !== undefined) g.globalAlpha = o.alpha;
          const px = Math.round(ox + (o.vx ?? o.x) * TILE - lift), py = Math.round(oy + (o.vy ?? o.y) * TILE - lift);
          if (o.slant) Render.slanted(g, o.img, px, py, () => { // creatures: round, with depth, standing in the slant
            g.drawImage(Render.CREATURE_DEPTH ? Render.roundOf(o.img) : o.img, px, py, iw, ih);
            if (o.flash > 0) { g.globalAlpha = o.flash; g.drawImage(Sprites.silhouette(o.img), px, py, iw, ih); }
          });
          else {
            g.drawImage(o.img, px, py, iw, ih);
            if (o.flash > 0) { g.globalAlpha = o.flash; g.drawImage(Sprites.silhouette(o.img), px, py, iw, ih); }
          }
          g.globalAlpha = 1;
        }
      }
    }
  },
};


