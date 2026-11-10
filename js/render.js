'use strict';
// Draws the map in the classic fake-3D style: floors are painted bottom-up, and
// every floor above the camera floor is shifted one tile up-left on screen
// (floors below: down-right), so upper floors and roofs appear to have height.

// Trees and grass that sway in the wind.
const SWAYING = new Set(['tree', 'pine', 'palm', 'snow_pine', 'jungle_tree', 'dead_tree', 'ancient_tree', 'tallgrass', 'reeds', 'fern', 'flowers', 'bush']);
const LIQUID = new Set(['water', 'sewer_water', 'lava']); // grounds a wall can stand in
const EDGE_NEIGHBOURS = [[1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0], [16, 1, -1], [32, 1, 1], [64, -1, 1], [128, -1, -1]]; // see Sprites.edge
const SEE_THROUGH = new Set(['ramp_top', 'steps_top']); // grounds that draw nothing over what's below them
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
  // ---- the ground, kept in chunks --------------------------------------------------------------------------------
  // The ground of a floor (its textures, shores, borders, scree, lips and rugs) doesn't change from frame to frame, but
  // drawing it is hundreds of pictures a frame. So it's drawn once per chunk of CHUNK x CHUNK tiles, into a picture
  // kept for later (CHUNK_RES pixels per world pixel: the ground's pictures are drawn that fine), and each frame only
  // the chunks in view are put down. A chunk is drawn again when a tile in or next to it changes (map.dirty, filled by
  // the map and by mapChanged), and not kept at all while it holds moving ground (lava, sewer water; water while it
  // ripples): that is drawn live. At most CHUNKS_KEPT are kept, the least recently used going first. A frame makes chunks
  // for CHUNK_MS at most (what isn't made yet is drawn live, as before), and with time to spare makes the ones round
  // the view, so walking into new ground never stops the game.
  CHUNK: 8,
  CHUNK_RES: 2,
  CHUNKS_KEPT: 110,
  CHUNK_MS: 4, // how long a frame may spend making chunks (Render.budget: until when)
  budget: 0,
  chunks: new Map(),
  pictures: 0, // how many of them hold a picture
  spare: [], // pictures of chunks let go of, to use again
  stats: { live: 0, finished: 0 }, // (how often a chunk in view wasn't ready: for measuring)
  later: new Map(), // chunks in view that weren't made in their frame
  chores: [], // small jobs for the quiet time between frames: making pictures before they're needed
  forget(key) {
    const c = Render.chunks.get(key);
    if (!c) return;
    Render.chunks.delete(key);
    if (c.canvas) Render.pictures--;
    if (c.canvas && Render.spare.length < 16) Render.spare.push(c.canvas);
  },
  ground(g, map, z, v, ox, oy, gx0, gx1, gy0, gy1, x0, x1, y0, y1, shoreFrame, pass, beyond) {
    const C = Render.CHUNK, R = Render.CHUNK_RES, keep = Render.chunks;
    if (keep.map !== map) { for (const k of [...keep.keys()]) Render.forget(k); keep.map = map; map.dirty = []; }
    if (map.dirty && map.dirty.length) { // forget the chunks round what changed
      if (map.dirty.length > 400) for (const k of [...keep.keys()]) Render.forget(k);
      else for (const [x, y, dz] of map.dirty) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) Render.forget(`${dz}:${Math.floor((x + dx) / C)}:${Math.floor((y + dy) / C)}`);
      map.dirty.length = 0;
    }
    const snow = v.roofSnow > 0.05 ? Math.min(5, Math.ceil(v.roofSnow * 5)) : 0, MOVING = ['lava', 'sewer_water'];
    const floor = map.floors[z], tag = `${snow}:${beyond}`;
    // A chunk: kept, or made now if there's time left this frame (Render.budget); null if not (it's drawn live). A chunk
    // is made in parts of 2 x 2 tiles (the ground of a tile is drawn on that tile only, so they fit together): one in
    // view is finished at once, one round the view (ahead: soon) a part at a time while the frame has time to spare.
    const PART = 2, PARTS = (C / PART) * (C / PART);
    const chunk = (cx, cy, ahead) => {
      const key = `${z}:${cx}:${cy}`;
      let c = keep.get(key);
      if (c && c.tag !== tag) { Render.forget(key); c = null; }
      if (c && c.made >= PARTS) { keep.delete(key); keep.set(key, c); return c; } // (to the back of the line: just used)
      const tx0 = cx * C, ty0 = cy * C;
      if (!c) { // (seeing what's in it is quick: done even without time to spare)
        // what's in it: nothing (an empty upper floor), moving ground (drawn live), or ground to keep
        let any = false, moving = false, bx0 = C, by0 = C, bx1 = -1, by1 = -1; // (and the box of its tiles with ground: only that is put down)
        for (let y = ty0; y < ty0 + C; y++) for (let x = tx0; x < tx0 + C; x++) {
          const t = x >= 0 && y >= 0 && x < map.width && y < map.height ? floor[y * map.width + x] : null;
          const gid = t ? t.ground : beyond;
          if (gid || (t && t.items.length)) any = true;
          if (gid) { bx0 = Math.min(bx0, x - tx0); by0 = Math.min(by0, y - ty0); bx1 = Math.max(bx1, x - tx0); by1 = Math.max(by1, y - ty0); }
          if (MOVING.includes(gid)) moving = true;
        }
        c = { tag, empty: !any, canvas: null, made: PARTS, box: bx1 < 0 ? null : [bx0, by0, bx1 - bx0 + 1, by1 - by0 + 1] };
        if (any && !moving) { // (a picture freed by a chunk let go of, if there is one: making new ones is slow)
          c.canvas = Render.spare.pop();
          if (!c.canvas) { c.canvas = document.createElement('canvas'); c.canvas.width = c.canvas.height = C * TILE * R; }
          const cg = c.canvas.getContext('2d');
          cg.setTransform(R, 0, 0, R, 0, 0);
          cg.clearRect(0, 0, C * TILE, C * TILE);
          cg.imageSmoothingEnabled = false;
          c.made = 0;
        }
        if (c.canvas) { // at most CHUNKS_KEPT pictures: the least recently used one goes (empty chunks cost nothing: they stay)
          Render.pictures++;
          for (const [k, o] of keep) { if (Render.pictures <= Render.CHUNKS_KEPT) break; if (o.canvas) Render.forget(k); }
        }
        keep.set(key, c);
      }
      if (c.made >= PARTS) return c; // (empty, or moving ground: nothing to make)
      if (performance.now() > Render.budget) { if (!ahead && !Render.later.has(key)) Render.later.set(key, () => chunk(cx, cy, true)); return null; } // (made between frames)
      const cg = c.canvas.getContext('2d');
      if (!ahead) Render.stats.finished++;
      while (c.made < PARTS && (!ahead || performance.now() < Render.budget)) {
        const px = tx0 + (c.made % (C / PART)) * PART, py = ty0 + Math.floor(c.made / (C / PART)) * PART;
        pass(cg, -tx0 * TILE, -ty0 * TILE, px, px + PART - 1, py, py + PART - 1, px, px + PART - 1, py, py + PART - 1, 0);
        c.made++;
      }
      if (ahead && c.made >= PARTS && !c.warm && !c.empty && performance.now() < Render.budget) { // and the pictures of what stands there (trees, bushes, things), ready too
        c.warm = true;
        for (let y = ty0; y < ty0 + C; y++) for (let x = tx0; x < tx0 + C; x++) {
          const t = x >= 0 && y >= 0 && x < map.width && y < map.height ? floor[y * map.width + x] : null;
          if (t) for (const id of t.items) { const d = THINGS[id]; if (!d.wall && !d.roof && !d.onWall && id !== 'carpet_rug') Sprites.thing(id, x, y, 0); }
        }
      }
      return c.made >= PARTS ? c : null;
    };
    const cx0 = Math.floor(gx0 / C), cx1 = Math.floor(gx1 / C), cy0 = Math.floor(gy0 / C), cy1 = Math.floor(gy1 / C);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const c = chunk(cx, cy), tx0 = cx * C, ty0 = cy * C;
      if (c && c.empty) continue;
      if (c && c.canvas && c.made >= PARTS) { // only the part with ground on it: on an upper floor often a thin strip
        if (c.box) { const [bx, by, bw, bh] = c.box, k = TILE * R; g.drawImage(c.canvas, bx * k, by * k, bw * k, bh * k, ox + (tx0 + bx) * TILE, oy + (ty0 + by) * TILE, bw * TILE, bh * TILE); }
        continue;
      }
      // moving ground, or not made yet: this chunk's part of the view, drawn live
      if (!c || c.canvas) Render.stats.live++;
      const ax0 = Math.max(gx0, tx0), ax1 = Math.min(gx1, tx0 + C - 1), ay0 = Math.max(gy0, ty0), ay1 = Math.min(gy1, ty0 + C - 1);
      g.save(); g.beginPath(); g.rect(ox + tx0 * TILE, oy + ty0 * TILE, C * TILE, C * TILE); g.clip();
      pass(g, ox, oy, ax0, ax1, ay0, ay1, Math.max(x0, ax0), Math.min(x1, ax1), Math.max(y0, ay0), Math.min(y1, ay1), shoreFrame);
      g.restore();
    }
    // With time to spare (this frame's, and the quiet time between frames: see idle), make the chunks round the view on
    // the floor you're on, nearest first, so they're ready before you get there.
    if (z !== v.z) return;
    Render.ahead = () => {
      for (let r = 1; r <= 2; r++) for (let cy = cy0 - r; cy <= cy1 + r; cy++) for (let cx = cx0 - r; cx <= cx1 + r; cx++) {
        if (cy > cy0 - r && cy < cy1 + r && cx > cx0 - r && cx < cx1 + r) continue; // (the ring only)
        if (performance.now() >= Render.budget) return false;
        const k = keep.get(`${z}:${cx}:${cy}`);
        if ((!k || k.made < PARTS) && !chunk(cx, cy, true)) return false;
      }
      return true; // all made
    };
    Render.ahead();
  },
  // Between frames, while the page is idle, go on making the chunks ahead (requestIdleCallback says for how long; where
  // there's none, as on iPhones, a few ms after each frame).
  idle() {
    if (Render.idleAsked || (!Render.ahead && !Render.chores.length && !Render.later.size)) return;
    Render.idleAsked = true;
    const run = deadline => {
      Render.idleAsked = false;
      Render.budget = performance.now() + (deadline ? Math.max(0, deadline.timeRemaining() - 1) : 5);
      for (const [k, f] of Render.later) { if (performance.now() >= Render.budget) break; if (f() || performance.now() < Render.budget) Render.later.delete(k); } // chunks in view not made in their frame
      if (Render.ahead && Render.ahead()) Render.ahead = null;
      while (Render.chores.length && performance.now() < Render.budget) Render.chores.shift()(); // then other pictures to make (see game.js)
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 100 });
    else setTimeout(() => run(null), 1);
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
    Render.budget = performance.now() + Render.CHUNK_MS;
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
      // The ground of tiles gx0..gx1, gy0..gy1 (the scree and lips of x0..x1, y0..y1), at (ox, oy): what lies flat,
      // under everything on the floor. Drawn live, or once into a chunk kept for later (see groundChunk).
      const groundPass = (g, ox, oy, gx0, gx1, gy0, gy1, x0, x1, y0, y1, shoreFrame, noBase) => {
        if (!noBase) for (let y = gy0; y <= gy1; y++) for (let x = gx0; x <= gx1; x++) { // (noBase: all but the grounds themselves)
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
          } else {
            const img = Sprites.thing(id, x, y, v.time, shape);
            if (img.res > 1) g.drawImage(img, ox + x * TILE, oy + y * TILE, TILE, TILE); // (a finer texture, at its world size)
            else g.drawImage(img, ox + x * TILE, oy + y * TILE);
          }
          if (shape && v.roofSnow > 0.05) { // snow settles on the roofs, in patches that grow together
            g.globalAlpha = 0.95;
            g.drawImage(Sprites.roofSnow(id, shape, Math.min(5, Math.ceil(v.roofSnow * 5))), ox + x * TILE, oy + y * TILE);
            g.globalAlpha = 1;
          }
        }

        // Along the shores: shallow water and foam (under the sand or grass spilling over it).
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

        // Rugs are floor objects: paint them before furniture, walls and creatures.
        const rugAt = (x, y) => { const t = tileAt(x, y); return !!t && t.items.includes('carpet_rug'); };
        for (let y = gy0; y <= gy1; y++) for (let x = gx0; x <= gx1; x++) {
          if (!rugAt(x, y)) continue;
          const shape = [[0, -1], [1, 0], [0, 1], [-1, 0]]
            .map(([dx, dy]) => rugAt(x + dx, y + dy) ? '1' : '0').join('');
          g.drawImage(Sprites.thing('carpet_rug', x, y, v.time, shape), ox + x * TILE, oy + y * TILE);
        }
      };
      Render.ground(g, map, z, v, ox, oy, gx0, gx1, gy0, gy1, x0, x1, y0, y1, 0, groundPass, beyond);
      // The water ripples: a picture of its loop over the still water kept in the chunks, once that picture is made
      // (between frames: until then it lies still). Water by a shore, a quay or a bridge has its borders drawn again
      // over the ripples.
      if (Sprites.WATER_MOVES) for (let y = gy0; y <= gy1; y++) for (let x = gx0; x <= gx1; x++) {
        if (groundAt(x, y) !== 'water' || wallAt(x, y)) continue;
        const f = Sprites.waterFrame(x, y, v.time);
        if (!f) continue;
        g.drawImage(f, ox + x * TILE, oy + y * TILE);
        let open = true;
        for (let dy = -1; dy <= 1 && open; dy++) for (let dx = -1; dx <= 1; dx++) if (groundAt(x + dx, y + dy) !== 'water' || wallAt(x + dx, y + dy)) { open = false; break; }
        if (!open) groundPass(g, ox, oy, x, x, y, y, x, x, y, y, 0, true);
      }
      if (v.afterGround) v.afterGround(g, ox, oy, z, gx0, gx1, gy0, gy1, groundAt);
      if (v.onFloor) v.onFloor(g, ox, oy, z); // marks on the floor itself (where you're walking): under everything on it

      const objects = byFloor.get(z);
      // A block (rock, a town wall) with blocks south, east and south-east of it, and the floor above drawn over its top,
      // can't be seen at all: its faces lie under its neighbours' tops and its top under the ground above. Inside a
      // mountain that's most of them: only the outer ones are drawn.
      const above = z < v.maxZ ? map.floors[z + 1] : null;
      const blockAt = (bx, by) => { const t = tileAt(bx, by); return !!t && t.items.some(id => THINGS[id].wall === 'block'); };
      const buried = (bx, by) => {
        if (!above || bx < 0 || by < 0 || bx >= map.width || by >= map.height) return false;
        const up = above[by * map.width + bx], gid = up && up.ground;
        return !!gid && !SEE_THROUGH.has(gid) && !THINGS[gid].roof && blockAt(bx, by + 1) && blockAt(bx + 1, by) && blockAt(bx + 1, by + 1);
      };
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const t = floor[y * map.width + x];
        if (t) {
          let wallShape = null;
          for (const id of t.items) {
            if (id === 'carpet_rug') continue;
            const def = THINGS[id];
            if (def.wall === 'block' && t.items.length === 1 && buried(x, y)) continue;
            let shape, material;
            if (def.wall === 'thin') {
              const sides = [wallAt(x - 1, y), wallAt(x, y - 1), wallAt(x, y + 1), wallAt(x + 1, y)]; // w n s e
              shape = wallShape = sides.map(w => (w ? '1' : '0')).join('');
              // which of its faces (east, south) look into a building (a roof over the tile in front of it): a wall's own
              // pictures can have an inside and an outside (see wallFromPictures)
              const roofed = (rx, ry) => { const up = map.floors[z + 1], t2 = up && up[ry * map.width + rx]; return !!(t2 && t2.ground && THINGS[t2.ground].roof); };
              shape += `:${roofed(x + 1, y) ? 'i' : 'o'}${roofed(x, y + 1) ? 'i' : 'o'}`;
              const plain = w => w && THINGS[w].wall === 'thin' && !(THINGS[THINGS[w].sprite || w] || {}).toggle && !(THINGS[w].sprite || w).startsWith('door');
              const wall = sides.find(plain);
              material = wall ? THINGS[wall].sprite || wall : 'wall_stone';
            } else if (def.onWall) {
              shape = wallShape || '1000';
            } else if (id === 'fence') { // fences join up with the fences next to them
              const fenceAt = (fx, fy) => { const n = tileAt(fx, fy); return n && n.items.includes('fence') ? '1' : '0'; };
              shape = fenceAt(x - 1, y) + fenceAt(x, y - 1) + fenceAt(x, y + 1) + fenceAt(x + 1, y);
            }
            const img = Sprites.thing(id, x, y, v.time, shape, material), iw = Sprites.w(img), ih = Sprites.h(img), lift = iw - TILE, rise = ih - TILE; // tall things rise up-left
            const fine = img.res > 1; // (a picture finer than a pixel a world pixel: drawn at its world size, smoothly)
            if (fine) g.imageSmoothingEnabled = true;
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
            } else g.drawImage(img, ox + x * TILE - lift, oy + y * TILE - rise, iw, ih);
            if (hides) g.globalAlpha = 1;
            if (fine) g.imageSmoothingEnabled = false;
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


