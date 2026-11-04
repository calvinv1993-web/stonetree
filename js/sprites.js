'use strict';
// Procedurally drawn 32x32 sprites, rendered once into cached canvases.

const Sprites = (() => {
  const cache = new Map();
  const urls = new Map();
  const silhouettes = new WeakMap();

  function cached(key, draw, size = TILE) {
    let c = cache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      draw(g);
      cache.set(key, c);
    }
    return c;
  }

  // --- drawing helpers -------------------------------------------------------
  function rect(g, color, x, y, w, h) {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  }
  function ellipse(g, color, cx, cy, rx, ry) {
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }
  function poly(g, color, pts) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
    g.fill();
  }
  function line(g, color, width, ...pts) {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.stroke();
  }
  // Solid base color sprinkled with random specks.
  function noise(g, r, base, colors, count, maxSize = 2) {
    rect(g, base, 0, 0, TILE, TILE);
    for (let i = 0; i < count; i++) {
      const s = 1 + ((r() * maxSize) | 0);
      rect(g, colors[(r() * colors.length) | 0], (r() * TILE) | 0, (r() * TILE) | 0, s, s);
    }
  }
  // Draw rotated around the tile center, e.g. weapons lying diagonally.
  function diagonal(g, draw) {
    g.save();
    g.translate(16, 16);
    g.rotate(Math.PI / 4);
    draw();
    g.restore();
  }
  const shadow = (g, cx, cy, rx, ry) => ellipse(g, 'rgba(0,0,0,0.25)', cx, cy, rx, ry);
  const gray = (v, b = 5) => `rgb(${v},${v},${v + b})`;

  // --- walls: one floor tall ---------------------------------------------------------
  // Drawn in the same oblique projection as the floors (one floor up = one tile
  // up-left), as 64x64 sprites anchored at the bottom-right of their tile, so the
  // top of a wall sits exactly where the floor above is drawn.
  //
  // Building walls are thin. Every wall tile has a post in its south-east corner,
  // plus an arm reaching to the wall west of it and/or north of it. Walls to the
  // east and south reach back with their own arms, so runs join up without
  // anything sticking out, and the faces we see (south and east) form continuous
  // walls. Where the post touches a wall to its south or east, that face is
  // inside the wall and isn't drawn. The renderer passes the four neighbours as
  // the shape: 'wnse' flags, e.g. '1001' = walls to the west and east.
  // Rock is a full block ('block').
  const WALL_THICKNESS = 6, W0 = TILE - WALL_THICKNESS;
  const POST = [W0, W0, TILE, TILE], ARM_W = [0, W0, W0, TILE], ARM_N = [W0, 0, TILE, W0], BLOCK = [0, 0, TILE, TILE];
  const wallSides = shape => ({ w: shape[0] === '1', n: shape[1] === '1', s: shape[2] === '1', e: shape[3] === '1' });
  const FACES = {
    south: [1, 0, 1, 1, 0, 32], // (u, v) -> (u + v, 32 + v), v = 0 at the top edge
    east: [0, 1, 1, 1, 32, 0],  // (u, v) -> (32 + v, u + v), u runs north to south
  };
  // Paint `draw` (in 32x32 face coordinates) into the part u0..u1 of a face.
  function face(g, which, u0, draw, u1 = TILE) {
    if (u1 <= u0) return;
    g.save();
    g.setTransform(...FACES[which]);
    g.beginPath();
    g.rect(u0, 0, u1 - u0, TILE);
    g.clip();
    draw();
    g.restore();
  }
  // shape: 'block', or the 'wnse' neighbour flags of a thin wall.
  // faces: { south(), east() } paint full 32x32 face textures; top is a color or a painter.
  function wallBlock(g, shape, faces) {
    let slabs = [BLOCK], south = [0, TILE], east = [0, TILE];
    if (shape !== 'block') {
      const n = wallSides(shape);
      slabs = [...(n.w ? [ARM_W] : []), ...(n.n ? [ARM_N] : []), POST];
      // The south face runs along the west arm and the post, minus the post where the wall goes on south.
      south = [n.w ? 0 : W0, n.s ? W0 : TILE];
      east = [n.n ? 0 : W0, n.e ? W0 : TILE];
    }
    face(g, 'south', south[0], faces.south, south[1]);
    face(g, 'east', east[0], faces.east, east[1]);
    if (!faces.seeThrough) solidify(g);
    for (const [x0, y0, x1, y1] of slabs) {
      g.save();
      g.beginPath();
      g.rect(x0, y0, x1 - x0, y1 - y0);
      g.clip();
      if (typeof faces.top === 'function') faces.top();
      else rect(g, faces.top, 0, 0, TILE, TILE);
      g.restore();
    }
    for (const [x0, y0, x1, y1] of slabs) {
      // shade only the outer edges, so joined slabs look like one top
      if (y0 === 0 || slabs[0] === BLOCK || (x0 === W0 && y0 === W0 && !slabs.includes(ARM_N))) rect(g, 'rgba(255,255,255,0.25)', x0, y0, x1 - x0, 1);
      if (x0 === 0 || slabs[0] === BLOCK || (x0 === W0 && !slabs.includes(ARM_W))) rect(g, 'rgba(255,255,255,0.25)', x0, y0, 1, y1 - y0);
    }
  }
  // Sheared faces get half-transparent pixels along their slanted edges, which
  // would let the ground show through the seams between wall tiles.
  function solidify(g) {
    const { width, height } = g.canvas, img = g.getImageData(0, 0, width, height), d = img.data;
    for (let i = 3; i < d.length; i += 4) if (d[i]) d[i] = 255;
    g.putImageData(img, 0, 0);
  }
  // Natural rock: slabs with light tops and dark undersides, cracks, and a ragged rim on top.
  const ROCK = {
    south: { base: '#7a6f60', slab: ['#857a69', '#8f8472', '#746958'], light: '#a39886', dark: '#4a4236' },
    east: { base: '#5c5347', slab: ['#665c4f', '#6e6456', '#574e43'], light: '#7a7062', dark: '#362f27' },
  };
  function rockFace(g, r, c) {
    rect(g, c.dark, 0, 0, TILE, TILE);
    // overlapping rounded boulders, each lit from the top-left
    for (let i = 0; i < 16; i++) {
      const x = r() * 38 - 3, y = r() * 38 - 3, rx = 4 + r() * 6, ry = 3 + r() * 5;
      ellipse(g, c.slab[i % c.slab.length], x, y, rx, ry);
      ellipse(g, c.light, x - rx * 0.3, y - ry * 0.4, rx * 0.45, ry * 0.3);
      ellipse(g, c.slab[(i + 1) % c.slab.length], x - rx * 0.1, y - ry * 0.05, rx * 0.6, ry * 0.5);
    }
    for (let i = 0; i < 25; i++) rect(g, c.dark, r() * TILE, r() * TILE, 1, 1);
  }
  function bricks(g, r, light, mortar) {
    rect(g, mortar, 0, 0, TILE, TILE);
    for (let j = 0; j < 4; j++) {
      for (let x = -(j % 2) * 8; x < TILE; x += 16) rect(g, gray(light + ((r() * 22) | 0), 6), x + 1, j * 8 + 1, 14, 6);
    }
  }
  function sandBricks(g, r, dark) {
    rect(g, `rgb(${150 - dark},${120 - dark},${74 - dark})`, 0, 0, TILE, TILE);
    for (let j = 0; j < 4; j++) {
      for (let x = -(j % 2) * 8; x < TILE; x += 16) {
        const v = ((r() * 14) | 0) - dark;
        rect(g, `rgb(${210 + v},${178 + v},${116 + v})`, x + 1, j * 8 + 1, 14, 6);
      }
    }
  }
  // Horizontal logs, so the grain follows the wall in this projection.
  function logs(g, r, dark) {
    for (let y = 0; y < TILE; y += 8) {
      const v = ((r() * 14) | 0) - dark;
      rect(g, `rgb(${124 + v},${82 + v},${44 + v})`, 0, y, TILE, 8);
      rect(g, 'rgba(255,255,255,0.15)', 0, y + 1, TILE, 1);
      rect(g, 'rgba(0,0,0,0.4)', 0, y + 7, TILE, 1);
    }
  }
  // Face textures per wall material. Doors borrow the material of the wall they're in.
  const WALL_STYLES = {
    wall_stone: { south: (g, r) => bricks(g, r, 112, '#55555b'), east: (g, r) => bricks(g, r, 78, '#3a3a40'), top: '#9a9aa2' },
    wall_wood: { south: (g, r) => logs(g, r, 0), east: (g, r) => logs(g, r, 34), top: '#a87a48' },
    wall_sandstone: { south: (g, r) => sandBricks(g, r, 0), east: (g, r) => sandBricks(g, r, 40), top: '#e0c48a' },
  };
  function styledWall(g, r, shape, material) {
    const st = WALL_STYLES[material];
    wallBlock(g, shape, { south: () => st.south(g, r), east: () => st.east(g, r), top: st.top });
  }
  // A door: a doorway cut out of the wall's own texture, with a wooden frame, on
  // the face the wall runs along (south for a wall running east-west, east for
  // one running north-south). Through an open door you see what's behind it, with
  // the door leaf standing open against the side of the frame.
  const runsNorthSouth = n => (n.n || n.s) && !n.w && !n.e;
  function doorInWall(g, r, shape, material, open, sealed) {
    const st = WALL_STYLES[material] || WALL_STYLES.wall_stone;
    const alongEast = runsNorthSouth(wallSides(shape));
    const doorway = (paintWall, dark) => () => {
      paintWall();
      const wood = dark ? '#3a2410' : '#5a3818', leaf = dark ? '#5a3414' : '#7a4a1e';
      if (open) {
        g.save();
        g.globalCompositeOperation = 'destination-out';
        rect(g, '#000', 8, 6, 16, 26);
        g.restore();
        rect(g, leaf, 8, 6, 4, 26);
        rect(g, 'rgba(255,255,255,0.15)', 8, 6, 1, 26);
        rect(g, 'rgba(0,0,0,0.4)', 11, 6, 1, 26);
      } else {
        rect(g, leaf, 8, 6, 16, 26);
        for (let x = 12; x < 24; x += 4) rect(g, 'rgba(0,0,0,0.3)', x, 6, 1, 26);
        if (sealed) { // iron bands and a lock
          rect(g, '#5a5a62', 8, 10, 16, 3);
          rect(g, '#5a5a62', 8, 24, 16, 3);
          rect(g, '#c8a030', 14, 16, 4, 5);
        } else {
          rect(g, '#e0b030', 20, 18, 2, 3);
        }
      }
      rect(g, wood, 6, 3, 20, 3); // frame
      rect(g, wood, 6, 3, 2, 29);
      rect(g, wood, 24, 3, 2, 29);
    };
    wallBlock(g, shape, {
      south: alongEast ? () => st.south(g, r) : doorway(() => st.south(g, r), false),
      east: alongEast ? doorway(() => st.east(g, r), true) : () => st.east(g, r),
      top: st.top,
    });
  }

  // Things hung on a wall are painted onto the face the wall runs along.
  // A flame that dances: four frames move its tongues and throw a spark now and then.
  // (cx, by): the middle of its foot; w: half its width; h: its height.
  function flame(g, cx, by, w, h, frame) {
    const sway = [0, 1, 0.5, -1][frame || 0], lick = [0, 2, 1, 3][frame || 0];
    poly(g, '#e8460a', [cx - w, by, cx - w * 0.8, by - h * 0.45, cx - w * 0.45 + sway, by - h * 0.7 - lick * 0.4,
      cx + sway * 1.4, by - h - lick, cx + w * 0.4 + sway, by - h * 0.62, cx + w * 0.8, by - h * 0.42 + lick * 0.3, cx + w, by]);
    poly(g, '#ff9a20', [cx - w * 0.68, by, cx - w * 0.45, by - h * 0.42, cx + sway, by - h * 0.74 - lick * 0.6, cx + w * 0.45, by - h * 0.38, cx + w * 0.68, by]);
    poly(g, '#ffe070', [cx - w * 0.38, by, cx - w * 0.15 + sway * 0.5, by - h * 0.36 - lick * 0.3, cx + w * 0.3, by - h * 0.22, cx + w * 0.38, by]);
    rect(g, '#fff6c8', cx - 1, by - 3, 2, 2);
    if (frame % 2) rect(g, '#ffd060', cx + sway * 2 + (frame === 1 ? -w * 0.6 : w * 0.6), by - h - 3 - lick, 1, 1); // a spark
  }
  function onWall(g, shape, paint) {
    face(g, runsNorthSouth(wallSides(shape)) ? 'east' : 'south', 0, paint);
  }
  function drawLever(g, on) {
    shadow(g, 16, 27, 8, 3);
    rect(g, '#5a5a62', 10, 20, 12, 7);
    rect(g, '#7a7a82', 10, 20, 12, 2);
    line(g, '#6a4a2a', 3, 16, 21, on ? 24 : 8, 8);
    ellipse(g, '#c03030', on ? 24 : 8, 8, 3, 3);
  }

  // --- roofs -----------------------------------------------------------------------------
  // The renderer passes, for north, south, west and east, how much further the roof
  // reaches that way than towards its nearest edge (0, 1 or 2 = more), and whether
  // the tile is on the edge ('o') or inside ('i') - see render.js. From that every
  // pixel knows which slope it is on: the one whose eave is nearest. So the tiles of
  // a building make one hipped roof together, with a ridge, hips at the corners,
  // eaves along the edges and rows of tiles parallel to each eave.
  const ROOF_STYLES = {
    roof: { color: [166, 64, 42], course: 4, joint: 8 },      // clay tiles
    roof_slate: { color: [94, 104, 126], course: 5, joint: 6 },
    roof_thatch: { color: [204, 166, 92], course: 3, joint: 0, straw: true },
    roof_shingle: { color: [130, 88, 54], course: 4, joint: 5 },
    roof_green: { color: [74, 130, 100], course: 4, joint: 8 }, // copper gone green
    roof_flat: { color: [216, 190, 138], flat: true },          // a flat roof with a low wall around it
  };
  const SLOPE_LIGHT = [1.14, 0.7, 1, 0.84]; // facing north, south, west, east: lit from the north-west
  function roofTile(g, r, shape, st) {
    if (!/^[0-2]{4}[io]$/.test(shape)) shape = '0000o'; // a tile that is a whole roof by itself (the editor's palette)
    const k = [...shape.slice(0, 4)].map(Number), outer = shape[4] === 'o';
    const slope = (u, v) => {
      const d = [k[0] + v, k[1] + 1 - v, k[2] + u, k[3] + 1 - u];
      let f = 0;
      for (let i = 1; i < 4; i++) if (d[i] < d[f] - 1e-9) f = i;
      return [f, d[f]];
    };
    // how far a pixel is from the eave on the edge of the roof (9: no eave near)
    const toEave = (px, py) => (outer ? Math.min(k[0] ? 9 : py, k[1] ? 9 : 31 - py, k[2] ? 9 : px, k[3] ? 9 : 31 - px) : 9);
    const img = g.createImageData(TILE, TILE), data = img.data;
    for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
      const u = (px + 0.5) / TILE, v = (py + 0.5) / TILE, eave = toEave(px, py);
      let light;
      if (st.flat) { // square tiles, and a low wall around the edge with its shadow inside
        light = (px % 16 === 0 || py % 16 === 0 ? 0.88 : 1) * (0.94 + r() * 0.1);
        if (eave < 1) light = 0.55;
        else if (eave < 3) light = 1.18;
        else if (eave < 4) light = 0.62;
        else if (eave < 6) light *= 0.85;
      } else {
        const [f, h] = slope(u, v);
        light = SLOPE_LIGHT[f];
        const c = h * st.course, row = Math.floor(c), fr = c - row;
        if (fr < 0.14) light *= 0.7;
        else if (fr < 0.32) light *= 1.08;
        const along = f < 2 ? px : py;
        if (st.joint && (along + (row % 2) * Math.floor(st.joint / 2)) % st.joint === 0) light *= 0.8;
        light *= st.straw ? 0.86 + r() * 0.28 : 0.95 + r() * 0.1;
        const ridge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => slope(u + dx / TILE, v + dy / TILE)[0] !== f);
        if (ridge) light = 1.28;
        if (eave < 1) light = 0.42;
        else if (eave < 2) light *= 0.72;
      }
      const i = (py * TILE + px) * 4;
      for (let ch = 0; ch < 3; ch++) data[i + ch] = Math.min(255, st.color[ch] * light);
      data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }

  // Snow lying on a roof: the same slopes, ridges and eaves, in white (shadows a little
  // blue), thinning out at the eaves where the roof shows through. Drawn over the roof.
  // level 1-5: how far it has settled - patches first (the ridge and the middle), which
  // grow together; the edges last.
  function roofSnowTile(g, r, shape, flat, level) {
    if (!/^[0-2]{4}[io]$/.test(shape)) shape = '0000o';
    const k = [...shape.slice(0, 4)].map(Number), outer = shape[4] === 'o';
    const slope = (u, v) => {
      const d = [k[0] + v, k[1] + 1 - v, k[2] + u, k[3] + 1 - u];
      let f = 0;
      for (let i = 1; i < 4; i++) if (d[i] < d[f] - 1e-9) f = i;
      return f;
    };
    const toEave = (px, py) => (outer ? Math.min(k[0] ? 9 : py, k[1] ? 9 : 31 - py, k[2] ? 9 : px, k[3] ? 9 : 31 - px) : 9);
    const img = g.createImageData(TILE, TILE), data = img.data;
    // clumpy noise (the same at every level, so patches grow rather than jump about)
    const cells = [];
    for (let i = 0; i < 36; i++) cells.push(r());
    const cell = (cx, cy) => cells[(((cy % 6) + 6) % 6) * 6 + (((cx % 6) + 6) % 6)];
    const clump = (px, py) => {
      const fx = px / 9, fy = py / 9, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const a = cell(x0, y0) * (1 - tx) + cell(x0 + 1, y0) * tx, b = cell(x0, y0 + 1) * (1 - tx) + cell(x0 + 1, y0 + 1) * tx;
      return a * (1 - ty) + b * ty;
    };
    for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
      const u = (px + 0.5) / TILE, v = (py + 0.5) / TILE, eave = toEave(px, py);
      const settle = 0.9 * clump(px, py) + 0.08 * r() + (eave < 4 ? 0.2 : 0); // when this spot gets its snow
      if (level < 5 && settle > level / 5) continue;
      let light = 1, alpha = 1;
      if (flat) {
        if (eave < 3) alpha = eave < 1 ? 0.5 : 0.85; // snow on the low wall, thinner
        else if (eave < 4) light = 0.8;              // its shadow
      } else {
        const f = slope(u, v);
        light = 0.78 + 0.22 * SLOPE_LIGHT[f];
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => slope(u + dx / TILE, v + dy / TILE) !== f)) light = 1.06; // the ridge
        if (eave < 1) alpha = 0;
        else if (eave < 2) alpha = r() < 0.6 ? 0.85 : 0; // a ragged edge
      }
      light *= 0.96 + r() * 0.06;
      if (r() < 0.012) light = 1.12; // a glint
      const i = (py * TILE + px) * 4;
      data[i] = Math.min(255, 232 * light);
      data[i + 1] = Math.min(255, 240 * light);
      data[i + 2] = Math.min(255, 252 * Math.min(1.04, light + 0.08));
      data[i + 3] = alpha * 255;
    }
    g.putImageData(img, 0, 0);
  }

  function bridge(g, r, eastWest) {
    if (eastWest) { g.translate(16, 16); g.rotate(Math.PI / 2); g.translate(-16, -16); }
    rect(g, '#2d63b5', 0, 0, TILE, TILE);
    for (let y = 0; y < TILE; y += 5) {
      const v = (r() * 18) | 0;
      rect(g, `rgb(${132 + v},${88 + v},${46 + v})`, 3, y, 26, 4);
      rect(g, 'rgba(0,0,0,0.35)', 3, y + 4, 26, 1);
      rect(g, 'rgba(255,255,255,0.12)', 3, y, 26, 1);
    }
    for (const x of [1, 27]) { rect(g, '#4a2c12', x, 0, 4, TILE); rect(g, '#6a4422', x, 0, 4, 1); rect(g, '#7a5230', x + 1, 0, 1, TILE); }
  }

  // --- map tiles: draw(g, rng, animationFrame, shape, material) ---------------------
  // Trees, walls and things on walls are 64x64, drawn with their tile in the bottom-right quarter.
  const DRAW = {
    grass(g, r) {
      noise(g, r, '#4a8f3c', ['#3f7d33', '#57a046', '#437f37', '#62aa4f'], 140);
      for (let i = 0; i < 6; i++) rect(g, '#35702b', (r() * 31) | 0, (r() * 29) | 0, 1, 3);
    },
    dirt(g, r) { noise(g, r, '#8b6b42', ['#7a5c37', '#9c7a4e', '#6e5230', '#a3845a'], 110); },
    sand(g, r) {
      noise(g, r, '#dcc98f', ['#cdb87a', '#e8d8a4', '#c4ad6f'], 90, 1);
      for (let i = 0; i < 3; i++) { // ripples the wind left
        const y = 4 + i * 10 + r() * 4, x = r() * 20;
        g.strokeStyle = 'rgba(190,165,105,0.5)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + 6, y - 2, x + 12, y);
        g.stroke();
        rect(g, 'rgba(240,228,190,0.5)', x + 3, y - 2, 6, 1);
      }
    },
    cave(g, r) { noise(g, r, '#4d443b', ['#3f3730', '#5a5047', '#463d35', '#362f29'], 130); },
    snow(g, r) {
      noise(g, r, '#e8eef4', ['#dce4ee', '#f4f8fc', '#d0dae6'], 70, 2);
      for (let i = 0; i < 3; i++) rect(g, '#c4d0de', (r() * 30) | 0, (r() * 30) | 0, 3, 1);
    },
    ice(g, r) {
      noise(g, r, '#b8d6e8', ['#a8cae0', '#c8e2f0', '#9cc0d8'], 40, 3);
      for (let i = 0; i < 3; i++) line(g, 'rgba(255,255,255,0.6)', 1, r() * 32, r() * 32, r() * 32, r() * 32);
    },
    jungle(g, r) {
      noise(g, r, '#2f6a2a', ['#275a22', '#3a7a32', '#22501e', '#44863a'], 150);
      for (let i = 0; i < 7; i++) rect(g, '#1e4a1a', (r() * 31) | 0, (r() * 28) | 0, 1, 4);
    },
    sandstone(g, r) {
      rect(g, '#c8a868', 0, 0, TILE, TILE);
      for (let y = 0; y < TILE; y += 16) for (let x = (y / 16) % 2 ? -8 : 0; x < TILE; x += 16) {
        rect(g, `rgb(${196 + ((r() * 16) | 0)},${164 + ((r() * 12) | 0)},${100 + ((r() * 10) | 0)})`, x + 1, y + 1, 14, 14);
      }
    },
    ash(g, r) { noise(g, r, '#4a4644', ['#3a3634', '#5a5654', '#423e3c', '#2e2a28'], 140); },
    lava(g, r, frame) {
      rect(g, '#c83a10', 0, 0, TILE, TILE);
      for (let i = 0; i < 8; i++) {
        const x = ((r() * TILE) | 0) + frame * 2, y = (r() * TILE) | 0;
        ellipse(g, i % 2 ? '#ff8a20' : '#ffc040', x % TILE, y, 3 + r() * 3, 2);
      }
      for (let i = 0; i < 3; i++) rect(g, '#5a1a08', (r() * 30) | 0, (r() * 30) | 0, 4, 2);
    },
    mountain(g, r) {
      noise(g, r, '#857a6a', ['#776c5d', '#958a79', '#6c6254', '#a29784'], 150, 3);
      for (let i = 0; i < 3; i++) ellipse(g, '#9c917f', 3 + r() * 26, 3 + r() * 26, 1.5, 1);
    },
    // A mountain top you can't walk on: broken rock, boulders and dark clefts.
    rock_top(g, r) {
      noise(g, r, '#7a6f60', ['#6a6054', '#8c8170', '#5e5548', '#958a79'], 170, 3);
      for (let i = 0; i < 3; i++) {
        const x = 4 + r() * 24, y = 4 + r() * 24, rx = 3 + r() * 3, ry = 2 + r() * 2;
        ellipse(g, '#4f473c', x + 1, y + 1.5, rx, ry);
        ellipse(g, '#8c8170', x, y, rx, ry);
        ellipse(g, '#a89c88', x - rx * 0.35, y - ry * 0.4, rx * 0.4, ry * 0.3);
      }
      for (let i = 0; i < 2; i++) line(g, 'rgba(35,30,24,0.7)', 1, r() * 32, r() * 32, r() * 32, r() * 32);
    },
    carpet(g) {
      rect(g, '#8a1a22', 0, 0, TILE, TILE);
      rect(g, '#a8262e', 3, 0, 26, TILE);
      rect(g, '#d0a030', 3, 0, 1, TILE);
      rect(g, '#d0a030', 28, 0, 1, TILE);
      for (let y = 4; y < TILE; y += 8) rect(g, '#c08a28', 14, y, 4, 4);
    },
    swamp(g, r) {
      noise(g, r, '#4a5a30', ['#3f4f28', '#56683a', '#3a4a2a'], 130);
      for (let i = 0; i < 3; i++) ellipse(g, '#2f3f3a', 4 + r() * 24, 4 + r() * 24, 3 + r() * 2, 1.5);
    },
    cobble(g, r) {
      rect(g, '#4b4b50', 0, 0, TILE, TILE);
      for (let j = 0; j < 4; j++) {
        for (let x = -(j % 2) * 4; x < TILE; x += 8) {
          const v = 100 + ((r() * 30) | 0);
          rect(g, gray(v), x + 1, j * 8 + 1, 7, 7);
          rect(g, gray(v + 25), x + 1, j * 8 + 1, 7, 1);
        }
      }
    },
    marble(g, r) {
      rect(g, '#d8d4cc', 0, 0, TILE, TILE);
      for (let i = 0; i < 3; i++) {
        const x = r() * 32, y = r() * 32;
        line(g, 'rgba(150,145,140,0.5)', 1, x, y, x + 6 - r() * 12, y + 6 + r() * 6);
      }
      rect(g, '#b8b4ac', 0, 0, TILE, 1);
      rect(g, '#b8b4ac', 0, 16, TILE, 1);
      rect(g, '#b8b4ac', 0, 0, 1, TILE);
      rect(g, '#b8b4ac', 16, 0, 1, TILE);
    },
    wood(g, r) {
      for (let y = 0; y < TILE; y += 8) {
        const v = (r() * 14) | 0;
        rect(g, `rgb(${138 + v},${90 + v},${44 + v})`, 0, y, TILE, 8);
        rect(g, '#5e3b1a', 0, y + 7, TILE, 1);
        rect(g, '#5e3b1a', 2 + ((r() * 28) | 0), y, 1, 7);
        for (let k = 0; k < 3; k++) {
          rect(g, 'rgba(80,50,20,0.35)', (r() * 26) | 0, y + 1 + ((r() * 5) | 0), 4 + ((r() * 6) | 0), 1);
        }
      }
    },
    // Bridges: planks across the way you walk, a beam along each side.
    bridge_ns(g, r) { bridge(g, r, false); },
    bridge_ew(g, r) { bridge(g, r, true); },
    paving(g, r) {
      rect(g, '#6e6a62', 0, 0, TILE, TILE);
      for (const y of [0, 16]) {
        for (let x = y ? -7 : 0; x < TILE;) {
          const w = 10 + ((r() * 8) | 0), v = 150 + ((r() * 24) | 0);
          rect(g, `rgb(${v},${v - 5},${v - 16})`, x + 1, y + 1, w - 1, 15);
          rect(g, `rgb(${v + 16},${v + 11},${v})`, x + 1, y + 1, w - 1, 1);
          rect(g, `rgb(${v - 24},${v - 28},${v - 36})`, x + 1, y + 15, w - 1, 1);
          x += w;
        }
      }
      for (let i = 0; i < 16; i++) rect(g, 'rgba(50,45,35,0.3)', (r() * 32) | 0, (r() * 32) | 0, 1, 1);
    },
    brick(g, r) {
      rect(g, '#5a2e22', 0, 0, TILE, TILE);
      for (let cy = 0; cy < 4; cy++) for (let cx = 0; cx < 4; cx++) { // basket weave: pairs of bricks, turned cell by cell
        const v = ((r() * 24) | 0) - 12, col = `rgb(${156 + v},${72 + v / 2},${52 + v / 2})`, hi = `rgb(${180 + v},${96 + v / 2},${72 + v / 2})`;
        const x = cx * 8, y = cy * 8;
        for (const o of [1, 5]) {
          if ((cx + cy) % 2) { rect(g, col, x + 1, y + o, 7, 3); rect(g, hi, x + 1, y + o, 7, 1); }
          else { rect(g, col, x + o, y + 1, 3, 7); rect(g, hi, x + o, y + 1, 3, 1); }
        }
      }
    },
    tiles(g, r) {
      for (let y = 0; y < TILE; y += 8) for (let x = 0; x < TILE; x += 8) {
        const v = (r() * 10) | 0;
        rect(g, ((x + y) / 8) % 2 ? `rgb(${168 + v},${136 + v},${100 + v})` : `rgb(${226 + v / 2},${210 + v / 2},${180 + v / 2})`, x, y, 8, 8);
      }
      for (let i = 0; i < TILE; i += 8) { rect(g, 'rgba(0,0,0,0.12)', i, 0, 1, TILE); rect(g, 'rgba(0,0,0,0.12)', 0, i, TILE, 1); }
    },
    gravel(g, r) {
      noise(g, r, '#9a948a', ['#8a847a', '#aaa49a', '#7a746a', '#b8b2a6'], 120, 2);
      for (let i = 0; i < 10; i++) ellipse(g, r() < 0.5 ? '#c4beb2' : '#6e685e', 2 + r() * 28, 2 + r() * 28, 1.2, 1);
    },
    farmland(g, r) {
      rect(g, '#6a4a2a', 0, 0, TILE, TILE);
      for (let y = 2; y < TILE; y += 8) {
        rect(g, '#7e5a34', 0, y, TILE, 4);
        rect(g, '#8e6a40', 0, y, TILE, 1);
        rect(g, '#4e341c', 0, y + 5, TILE, 2);
      }
      for (let i = 0; i < 30; i++) rect(g, r() < 0.5 ? '#5a3c20' : '#94704a', (r() * 32) | 0, (r() * 32) | 0, 1, 1);
    },
    roof: (g, r, frame, shape) => roofTile(g, r, shape, ROOF_STYLES.roof),
    roof_slate: (g, r, frame, shape) => roofTile(g, r, shape, ROOF_STYLES.roof_slate),
    roof_thatch: (g, r, frame, shape) => roofTile(g, r, shape, ROOF_STYLES.roof_thatch),
    roof_shingle: (g, r, frame, shape) => roofTile(g, r, shape, ROOF_STYLES.roof_shingle),
    roof_green: (g, r, frame, shape) => roofTile(g, r, shape, ROOF_STYLES.roof_green),
    roof_flat: (g, r, frame, shape) => roofTile(g, r, shape, ROOF_STYLES.roof_flat),
    water(g, r, frame) {
      rect(g, '#2d63b5', 0, 0, TILE, TILE);
      for (let i = 0; i < 9; i++) {
        const x = ((r() * TILE) | 0) + frame * 2, y = 1 + ((r() * 30) | 0), w = 3 + ((r() * 5) | 0);
        for (const wrap of [0, -TILE]) {
          rect(g, '#5b8fd6', x + wrap, y, w, 1);
          if (i % 3 === 0) rect(g, '#9cc0ee', x + wrap + 1, y - 1, 2, 1);
        }
      }
    },

    // Walls and doors: see wallBlock above. The renderer passes the shape, and
    // for doors the material of the surrounding wall.
    wall_stone: (g, r, frame, shape) => styledWall(g, r, shape, 'wall_stone'),
    wall_wood: (g, r, frame, shape) => styledWall(g, r, shape, 'wall_wood'),
    wall_sandstone: (g, r, frame, shape) => styledWall(g, r, shape, 'wall_sandstone'),
    wall_block(g, r) {
      wallBlock(g, 'block', { south: () => bricks(g, r, 104, '#4f4f55'), east: () => bricks(g, r, 72, '#36363c'), top: '#8a8a92' });
    },
    wall_cave(g, r) {
      wallBlock(g, 'block', {
        south: () => {
          noise(g, r, '#4a4038', ['#3a322c', '#564b42', '#40372f'], 110, 3);
          for (let i = 0; i < 3; i++) line(g, '#2e2722', 1, r() * 32, r() * 10, r() * 32, 12 + r() * 20);
        },
        east: () => noise(g, r, '#332c26', ['#28221d', '#3d352e'], 90, 3),
        top: () => noise(g, r, '#5e544a', ['#6b6057', '#544a41', '#4d443c'], 110, 2),
      });
    },
    // A cave wall with ore glittering in it.
    ore_vein(g, r) {
      const glitter = () => { for (let i = 0; i < 7; i++) { const x = 3 + r() * 26, y = 3 + r() * 24, c = ['#e8c060', '#9fd0ff', '#c890ff'][i % 3]; rect(g, '#2a2420', x - 0.5, y - 0.5, 3, 3); rect(g, c, x, y, 2, 2); rect(g, '#fff8e0', x, y, 1, 1); } };
      wallBlock(g, 'block', {
        south: () => {
          noise(g, r, '#4a4038', ['#3a322c', '#564b42', '#40372f'], 110, 3);
          glitter();
        },
        east: () => noise(g, r, '#332c26', ['#28221d', '#3d352e'], 90, 3),
        top: () => { noise(g, r, '#5e544a', ['#6b6057', '#544a41', '#4d443c'], 110, 2); glitter(); },
      });
    },
    // A mountain side: rough rock; the floor above (rocky ground) is the mountain's top.
    cliff(g, r) {
      wallBlock(g, 'block', {
        south: () => rockFace(g, r, ROCK.south),
        east: () => rockFace(g, r, ROCK.east),
        top: () => noise(g, r, '#857a6a', ['#776c5d', '#958a79'], 80, 2),
      });
    },
    // A path up the mountain side: a rocky slope from the ground at the tile's
    // south edge to the mountain top at its north edge, with rock below it.
    ramp(g, r) {
      g.save();
      g.setTransform(...FACES.east);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, TILE);
      g.lineTo(TILE, TILE);
      g.closePath();
      g.clip();
      rockFace(g, r, ROCK.east);
      g.restore();
      g.save();
      g.setTransform(1, 0, 1, 2, 0, 0); // (u, v) on the slope -> (u + v, 2v)
      noise(g, r, '#8f7f62', ['#7f7056', '#9c8c6e', '#857660', '#a39478'], 120, 2);
      for (let v = 3; v < TILE; v += 5) { // worn steps
        rect(g, 'rgba(255,255,255,0.18)', 3, v, 26, 1);
        rect(g, 'rgba(0,0,0,0.22)', 3, v + 1, 26, 1);
      }
      rect(g, 'rgba(0,0,0,0.25)', 0, 0, 3, TILE);
      rect(g, 'rgba(0,0,0,0.15)', 29, 0, 3, TILE);
      for (let i = 0; i < 4; i++) ellipse(g, '#9a917f', r() < 0.5 ? 1.5 : 30.5, 4 + r() * 24, 2, 1.5);
      g.restore();
      solidify(g);
    },
    ramp_top() {},
    door: (g, r, frame, shape, material) => doorInWall(g, r, shape, material, true),
    door_closed: (g, r, frame, shape, material) => doorInWall(g, r, shape, material, false),
    // A fence joins the fences next to it ('wnse' flags, as for walls): a post on its
    // tile, two rails towards each neighbouring fence. A lone fence is a short stretch
    // east-west. Rails running north-south are seen from above, as two parallel bars.
    fence(g, r, frame, shape) {
      const n = wallSides(/^[01]{4}$/.test(shape) ? shape : '0000'), lone = !n.w && !n.e && !n.n && !n.s;
      const rail = '#8a5a2a', lit = '#b07a42', dark = '#4a2c12', post = '#6a4422';
      const vertical = (y0, y1) => { // two rails along the north-south run, from y0 to y1
        rect(g, 'rgba(0,0,0,0.22)', 12, y0 + 2, 10, y1 - y0);
        for (const x of [11, 18]) {
          rect(g, dark, x - 1, y0, 5, y1 - y0);
          rect(g, rail, x, y0, 3, y1 - y0);
          rect(g, lit, x, y0, 1, y1 - y0);
        }
      };
      const across = (x0, x1) => { // two rails east-west, at knee and hip height
        rect(g, 'rgba(0,0,0,0.22)', x0, 26, x1 - x0, 2);
        for (const y of [13, 20]) {
          rect(g, dark, x0, y - 1, x1 - x0, 5);
          rect(g, rail, x0, y, x1 - x0, 3);
          rect(g, lit, x0, y, x1 - x0, 1);
        }
      };
      if (n.n) vertical(0, 16);
      if (n.w || lone) across(0, 16);
      if (n.e || lone) across(16, TILE);
      if (n.s) vertical(16, TILE);
      // the post
      shadow(g, 16, 28, 5, 2);
      rect(g, dark, 12, 7, 9, 22);
      rect(g, post, 13, 8, 7, 20);
      rect(g, '#7e5230', 13, 8, 2, 20);
      rect(g, lit, 13, 8, 7, 2);
      rect(g, dark, 13, 10, 7, 1);
    },

    tree(g, r) {
      shadow(g, 50, 61, 14, 4);
      rect(g, '#5b3a1e', 45, 38, 7, 24);
      rect(g, '#6f4826', 45, 38, 3, 24);
      ellipse(g, '#2a5f25', 42, 26, 21, 18);
      ellipse(g, '#347330', 38, 22, 16, 13);
      ellipse(g, '#438a3b', 33, 17, 9, 7);
      for (let i = 0; i < 34; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 17;
        rect(g, r() < 0.5 ? '#25541f' : '#52a047', 41 + Math.cos(a) * d * 1.1, 25 + Math.sin(a) * d * 0.9, 2, 2);
      }
    },
    // A crag: a pile of weathered boulders on a mountain top, rising up-left from its tile like a
    // tree, lit from the top-left.
    crag(g, r) {
      shadow(g, 48, 60, 15, 3);
      const lumps = [];
      for (let k = 0; k < 5; k++) lumps.push([36 + r() * 22, 40 + r() * 18 - (k === 0 ? 12 : 0), 7 + r() * 6, 6 + r() * 5]);
      lumps.sort((a, b) => a[1] - b[1]); // the back ones first
      for (const [x, y, rx, ry] of lumps) {
        ellipse(g, '#4f473c', x + 1, y + 2, rx, ry);           // its dark underside
        ellipse(g, '#7d7262', x, y, rx, ry);
        ellipse(g, '#958a78', x - rx * 0.2, y - ry * 0.25, rx * 0.75, ry * 0.65);
        ellipse(g, '#b0a590', x - rx * 0.4, y - ry * 0.45, rx * 0.35, ry * 0.25); // where the light catches it
        line(g, 'rgba(40,34,28,0.6)', 1, x - rx * 0.2, y + ry * 0.1, x + rx * 0.4, y + ry * 0.5); // a crack
      }
      for (let i = 0; i < 5; i++) rect(g, ['#a29784', '#6c6254'][i % 2], 34 + r() * 26, 56 + r() * 6, 2, 1);
    },
    pine(g, r) {
      shadow(g, 50, 61, 11, 3);
      rect(g, '#5b3a1e', 46, 52, 5, 11);
      poly(g, '#1f4a2a', [46, 2, 63, 54, 29, 54]);
      poly(g, '#2a5e36', [46, 2, 58, 26, 34, 26]);
      poly(g, '#2a5e36', [46, 16, 61, 44, 31, 44]);
      for (let i = 0; i < 16; i++) rect(g, '#3a7a46', 36 + r() * 20, 12 + r() * 36, 2, 1);
    },
    palm(g, r) {
      shadow(g, 50, 61, 12, 3);
      line(g, '#8a6a3a', 5, 47, 62, 45, 40, 40, 20);
      for (let y = 26; y < 60; y += 5) line(g, '#6a4a2a', 1, 41 + (y - 20) * 0.15, y, 48, y + 1);
      for (const [dx, dy] of [[-18, 4], [16, 2], [-12, -10], [12, -12], [0, -16], [-20, -4], [20, -6]]) {
        poly(g, '#3a8a2a', [40, 20, 40 + dx, 20 + dy, 40 + dx * 0.6, 22 + dy + 4]);
        line(g, '#2a6a1e', 1, 40, 20, 40 + dx, 20 + dy);
      }
      ellipse(g, '#6a4a2a', 38, 23, 3, 2);
      ellipse(g, '#6a4a2a', 42, 24, 3, 2);
    },
    cactus(g) {
      shadow(g, 16, 28, 8, 3);
      rect(g, '#3a7a3a', 13, 6, 7, 22);
      rect(g, '#3a7a3a', 6, 12, 4, 9);
      rect(g, '#3a7a3a', 6, 19, 8, 3);
      rect(g, '#3a7a3a', 23, 9, 4, 8);
      rect(g, '#3a7a3a', 19, 15, 8, 3);
      rect(g, '#5aa05a', 14, 7, 2, 20);
      for (const [x, y] of [[12, 9], [20, 13], [12, 20], [20, 23], [7, 14], [25, 11]]) rect(g, '#e8e0a0', x, y, 1, 1);
    },
    snow_pine(g, r) {
      shadow(g, 50, 61, 11, 3);
      rect(g, '#5b3a1e', 46, 52, 5, 11);
      poly(g, '#1f4a3a', [46, 2, 63, 54, 29, 54]);
      poly(g, '#2a5e4a', [46, 16, 61, 44, 31, 44]);
      poly(g, '#f0f4f8', [46, 2, 52, 14, 40, 14]);
      for (const y of [26, 44, 54]) poly(g, '#e8eef4', [30 + (54 - y) * 0.2, y, 62 - (54 - y) * 0.2, y, 46, y - 5]);
      for (let i = 0; i < 10; i++) rect(g, '#ffffff', 36 + r() * 20, 16 + r() * 34, 2, 1);
    },
    jungle_tree(g, r) {
      shadow(g, 50, 61, 16, 4);
      rect(g, '#4a3a22', 44, 34, 8, 28);
      line(g, '#3a2a18', 2, 44, 62, 38, 60);
      line(g, '#3a2a18', 2, 52, 62, 58, 60);
      ellipse(g, '#1e4a1a', 42, 24, 24, 20);
      ellipse(g, '#2a5e22', 36, 18, 17, 13);
      ellipse(g, '#3a7a2e', 30, 13, 9, 7);
      for (let i = 0; i < 30; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 20;
        rect(g, r() < 0.5 ? '#163a12' : '#4a8a3a', 42 + Math.cos(a) * d, 24 + Math.sin(a) * d * 0.8, 2, 2);
      }
      line(g, '#2a5a1e', 1, 30, 30, 28, 52);
      line(g, '#2a5a1e', 1, 56, 28, 57, 48);
    },
    dead_tree(g) {
      shadow(g, 50, 61, 10, 3);
      line(g, '#3a3028', 5, 47, 62, 46, 24);
      line(g, '#3a3028', 3, 46, 36, 34, 22, 30, 12);
      line(g, '#3a3028', 3, 46, 30, 56, 18);
      line(g, '#3a3028', 2, 46, 24, 44, 8);
      line(g, '#3a3028', 2, 34, 22, 26, 20);
      line(g, '#3a3028', 2, 56, 18, 60, 10);
    },
    fern(g, r) {
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.5, x = 16 + Math.cos(a) * 12, y = 26 + Math.sin(a) * 12;
        line(g, '#2f7a2a', 2, 16, 27, x, y);
        for (let k = 1; k < 4; k++) rect(g, '#4a9a3a', 16 + (x - 16) * k / 4 - 2, 27 + (y - 27) * k / 4, 4, 1);
      }
    },
    bush(g, r) {
      shadow(g, 17, 27, 11, 3);
      ellipse(g, '#2f6a29', 16, 20, 12, 9);
      ellipse(g, '#3d8235', 14, 18, 8, 6);
      for (let i = 0; i < 5; i++) rect(g, '#c0303a', 8 + ((r() * 16) | 0), 15 + ((r() * 9) | 0), 2, 2);
    },
    rock(g) {
      shadow(g, 17, 26, 12, 4);
      poly(g, '#77777c', [5, 25, 8, 12, 16, 7, 25, 10, 28, 24, 18, 28]);
      poly(g, '#9a9aa0', [8, 13, 16, 8, 24, 11, 17, 15]);
      poly(g, '#5c5c61', [17, 15, 24, 11, 28, 24, 18, 28]);
    },
    flowers(g, r) {
      const colors = ['#e84a5f', '#f5d547', '#ffffff', '#b06ee0'];
      for (let i = 0; i < 7; i++) {
        const x = 3 + ((r() * 25) | 0), y = 4 + ((r() * 23) | 0);
        rect(g, '#2f6a29', x + 1, y + 2, 1, 3);
        rect(g, colors[(r() * colors.length) | 0], x, y, 3, 3);
        rect(g, '#f5d547', x + 1, y + 1, 1, 1);
      }
    },
    // Small things lying about (you walk over them): they break up plain ground.
    pebbles(g, r) {
      for (let i = 0; i < 5 + r() * 4; i++) {
        const x = 3 + r() * 26, y = 4 + r() * 24, w = 2 + ((r() * 3) | 0), v = 110 + ((r() * 50) | 0);
        rect(g, 'rgba(0,0,0,0.25)', x, y + 1, w, 1);
        rect(g, gray(v), x, y, w, 1 + ((r() * 2) | 0));
        rect(g, gray(v + 35), x, y, 1, 1);
      }
    },
    shells(g, r) {
      for (let i = 0; i < 3; i++) {
        const x = 5 + r() * 20, y = 6 + r() * 18, c = ['#f4e6d8', '#e8c4b0', '#f0d8c8'][i];
        ellipse(g, 'rgba(0,0,0,0.18)', x + 2, y + 3, 3, 1);
        poly(g, c, [x, y + 2, x + 2, y - 1, x + 4, y + 2]);
        line(g, '#c8a090', 1, x + 2, y - 1, x + 2, y + 2);
      }
      if (r() < 0.6) { const x = 8 + r() * 14, y = 8 + r() * 14; ellipse(g, '#e0d4c0', x, y, 2, 1.2); rect(g, '#b8a888', x - 1, y, 2, 1); }
    },
    leaves(g, r) {
      const colors = ['#9a6a2a', '#b8862e', '#7a5a2a', '#a8582a', '#6a7a2a'];
      for (let i = 0; i < 10; i++) {
        const x = 2 + r() * 27, y = 3 + r() * 26;
        rect(g, colors[(r() * colors.length) | 0], x, y, 2, 1 + ((r() * 2) | 0));
      }
    },
    grass_tuft(g, r) {
      const x0 = 10 + r() * 10, y0 = 18 + r() * 8;
      ellipse(g, 'rgba(0,0,0,0.15)', x0 + 3, y0 + 1, 5, 1.5);
      for (let i = 0; i < 9; i++) {
        const x = x0 + (r() - 0.2) * 8;
        line(g, ['#3f7d33', '#57a046', '#2f6a26', '#6ab452'][i % 4], 1, x, y0, x + (r() - 0.5) * 5, y0 - 4 - r() * 6);
      }
    },
    driftwood(g, r) {
      ellipse(g, 'rgba(0,0,0,0.2)', 16, 21, 11, 2);
      line(g, '#8a7458', 3, 6, 19, 26, 17 + r() * 3);
      line(g, '#a8947a', 1, 7, 18, 25, 16 + r() * 3);
      line(g, '#8a7458', 2, 19, 18, 23, 13);
    },
    reeds(g, r) {
      for (let i = 0; i < 8; i++) {
        const x = 4 + r() * 24, top = 6 + r() * 10;
        line(g, '#5a7a3a', 1, x, 30, x + (r() - 0.5) * 4, top);
        if (i % 2) rect(g, '#6a4422', x - 1, top - 1, 2, 5);
      }
    },
    mushrooms(g, r) {
      for (let i = 0; i < 3; i++) {
        const x = 6 + r() * 18, y = 12 + r() * 12;
        rect(g, '#efe6d0', x - 1, y, 3, 5);
        ellipse(g, i % 2 ? '#c03030' : '#a0703a', x + 0.5, y, 5, 3);
        rect(g, '#fff', x - 2, y - 1, 1, 1);
        rect(g, '#fff', x + 2, y - 2, 1, 1);
      }
    },

    table(g) {
      shadow(g, 17, 27, 13, 3);
      rect(g, '#5e3b1a', 6, 18, 3, 10);
      rect(g, '#5e3b1a', 23, 18, 3, 10);
      rect(g, '#9a6633', 3, 8, 26, 12);
      rect(g, '#b07a44', 3, 8, 26, 2);
      rect(g, '#6e4422', 3, 19, 26, 2);
    },
    counter(g) {
      rect(g, '#6e4422', 0, 12, TILE, 18);
      rect(g, '#5a3618', 0, 28, TILE, 2);
      for (let x = 4; x < TILE; x += 8) rect(g, '#5a3618', x, 14, 1, 14);
      rect(g, '#b07a44', 0, 6, TILE, 7);
      rect(g, '#c8925a', 0, 6, TILE, 1);
    },
    chest(g) {
      shadow(g, 16, 28, 12, 3);
      rect(g, '#6e4019', 5, 12, 22, 16);
      rect(g, '#8a5526', 5, 12, 22, 6);
      rect(g, '#4a2a0e', 5, 18, 22, 1);
      rect(g, '#9a9aa0', 8, 12, 2, 16);
      rect(g, '#9a9aa0', 22, 12, 2, 16);
      rect(g, '#e0b030', 15, 17, 3, 4);
    },
    crate(g) {
      shadow(g, 16, 28, 12, 3);
      rect(g, '#a07a46', 5, 9, 22, 19);
      rect(g, '#7a5a30', 5, 9, 22, 2);
      rect(g, '#7a5a30', 5, 26, 22, 2);
      line(g, '#7a5a30', 2, 6, 11, 26, 26);
      line(g, '#7a5a30', 2, 26, 11, 6, 26);
    },
    barrel(g) {
      shadow(g, 17, 28, 10, 3);
      rect(g, '#7a4a1e', 8, 8, 16, 20);
      rect(g, '#93602f', 10, 8, 4, 20);
      ellipse(g, '#a87440', 16, 8, 8, 3);
      ellipse(g, '#5a3410', 16, 8, 6, 2);
      rect(g, '#555', 8, 13, 16, 2);
      rect(g, '#555', 8, 23, 16, 2);
    },
    bookshelf(g, r) {
      rect(g, '#5a3618', 2, 0, 28, 31);
      rect(g, '#8a5a2a', 2, 0, 28, 3);
      const colors = ['#8a2a2a', '#2a4a8a', '#2a6a3a', '#8a7a2a', '#5a2a6a'];
      for (let row = 0; row < 3; row++) {
        const y = 4 + row * 9;
        rect(g, '#3a2210', 4, y, 24, 8);
        for (let x = 4; x < 27; x += 3) rect(g, colors[(r() * colors.length) | 0], x, y + 1 + ((r() * 2) | 0), 2, 7);
      }
    },
    throne(g) {
      shadow(g, 16, 28, 12, 3);
      rect(g, '#b08a28', 7, 2, 18, 20);
      rect(g, '#8a1a22', 9, 4, 14, 16);
      rect(g, '#b08a28', 5, 16, 22, 4);
      rect(g, '#8a1a22', 7, 17, 18, 6);
      rect(g, '#b08a28', 5, 20, 3, 8);
      rect(g, '#b08a28', 24, 20, 3, 8);
      for (const x of [7, 15, 23]) ellipse(g, '#e0c040', x + 1, 2, 2, 2);
    },
    trunk(g) {
      shadow(g, 16, 27, 13, 3);
      rect(g, '#6a3a1e', 4, 12, 24, 15);
      rect(g, '#7a4a26', 4, 9, 24, 5);
      for (const x of [8, 22]) rect(g, '#c8a030', x, 9, 2, 18);
      rect(g, '#3a2a1a', 4, 14, 24, 1);
      rect(g, '#d8b040', 14, 14, 4, 4);
      line(g, '#3a2210', 1, 6, 20, 12, 24);
      rect(g, '#e8e0d0', 25, 22, 3, 5);
    },
    crops(g, r) {
      for (let x = 3; x < TILE; x += 6) {
        line(g, '#8a7a3a', 1, x, 30, x + 1, 12);
        for (let y = 12; y < 26; y += 4) { ellipse(g, '#d8b040', x + 2, y, 2, 1.5); ellipse(g, '#c8a030', x, y + 2, 2, 1.5); }
      }
    },
    statue(g) {
      shadow(g, 48, 61, 12, 3);
      rect(g, '#8a8a90', 38, 52, 20, 10);
      rect(g, '#a0a0a8', 38, 52, 20, 2);
      rect(g, '#9a9aa2', 43, 26, 10, 26);
      ellipse(g, '#a8a8b0', 48, 20, 6, 7);
      rect(g, '#8a8a92', 40, 30, 3, 14);
      line(g, '#8a8a92', 2, 54, 30, 60, 8);
      rect(g, 'rgba(0,0,0,0.15)', 50, 26, 3, 26);
    },
    rails(g) {
      for (let y = 2; y < TILE; y += 6) rect(g, '#5a3a1e', 6, y, 20, 3);
      rect(g, '#8a8a92', 9, 0, 2, TILE);
      rect(g, '#8a8a92', 21, 0, 2, TILE);
    },
    treasure(g, r) {
      shadow(g, 16, 27, 13, 4);
      ellipse(g, '#c89a20', 16, 22, 13, 7);
      for (let i = 0; i < 26; i++) ellipse(g, r() < 0.5 ? '#f0c840' : '#e0b030', 5 + r() * 22, 15 + r() * 10, 2.5, 1.8);
      for (let i = 0; i < 3; i++) rect(g, ['#e04040', '#40c0e0', '#40d060'][i], 8 + i * 7, 16 + (i % 2) * 4, 3, 3);
      rect(g, '#f8e8a0', 12, 14, 2, 1);
    },
    bars(g) {
      shadow(g, 16, 28, 14, 2);
      rect(g, '#3a3a42', 2, 6, 28, 3);
      rect(g, '#3a3a42', 2, 26, 28, 3);
      for (let x = 3; x < 30; x += 5) { rect(g, '#5a5a62', x, 6, 2, 23); rect(g, '#8a8a92', x, 6, 1, 23); }
    },
    well(g) {
      shadow(g, 16, 27, 13, 4);
      ellipse(g, '#8a8a90', 16, 20, 12, 8);
      ellipse(g, '#1a3a6a', 16, 19, 8, 5);
      ellipse(g, 'rgba(255,255,255,0.3)', 13, 18, 3, 1.5);
      rect(g, '#5a3a1e', 5, 4, 2, 16);
      rect(g, '#5a3a1e', 25, 4, 2, 16);
      rect(g, '#6e4a26', 3, 3, 26, 3);
      line(g, '#c0b090', 1, 16, 6, 16, 16);
    },
    tallgrass(g, r) {
      for (let i = 0; i < 9; i++) {
        const x = 6 + r() * 20, h = 6 + r() * 9, lean = (r() - 0.5) * 6;
        line(g, r() < 0.5 ? '#3a7a2e' : '#5aa046', 1, x, 27, x + lean, 27 - h);
      }
      if (r() < 0.4) ellipse(g, '#e8d870', 10 + r() * 12, 14 + r() * 4, 1.5, 1.5);
    },
    stump(g) {
      shadow(g, 16, 26, 10, 3);
      rect(g, '#5b3a1e', 9, 15, 14, 10);
      rect(g, '#6f4826', 9, 15, 4, 10);
      ellipse(g, '#c8a070', 16, 15, 7, 3);
      ellipse(g, '#a87a48', 16, 15, 4.5, 2);
      ellipse(g, '#8a5a30', 16, 15, 2, 1);
      line(g, '#5b3a1e', 2, 9, 24, 5, 27);
      line(g, '#5b3a1e', 2, 22, 24, 26, 27);
    },
    log(g, r) {
      shadow(g, 16, 26, 15, 3);
      rect(g, '#5b3a1e', 2, 16, 26, 9);
      rect(g, '#6f4826', 2, 16, 26, 3);
      for (let i = 0; i < 6; i++) rect(g, '#4a2e16', 4 + r() * 22, 18 + r() * 5, 3, 1);
      ellipse(g, '#c8a070', 28, 20.5, 3, 4.5);
      ellipse(g, '#a87a48', 28, 20.5, 1.5, 2.5);
      if (r() < 0.5) { ellipse(g, '#3a7a2e', 10, 16, 3, 1.5); ellipse(g, '#4a8a3c', 18, 16, 2, 1); } // moss
    },
    dry_bush(g, r) {
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI * (0.15 + r() * 0.7), len = 5 + r() * 7;
        line(g, r() < 0.5 ? '#8a6a3a' : '#a8844a', 1, 16, 26, 16 + Math.cos(a) * len, 26 + Math.sin(a) * len);
      }
    },
    lilypad(g, r) {
      for (let i = 0; i < 3; i++) {
        const x = 7 + r() * 18, y = 8 + r() * 16;
        ellipse(g, '#3f8a3a', x, y, 4, 3);
        poly(g, '#2d63b5', [x, y, x + 4, y - 2, x + 4, y + 1]);
        ellipse(g, '#5aa04a', x - 1, y - 1, 2, 1);
      }
      if (r() < 0.5) { ellipse(g, '#f0a0c0', 16, 16, 2.5, 2); ellipse(g, '#fff0f4', 16, 15.5, 1, 1); }
    },
    stalagmite(g, r) {
      shadow(g, 16, 27, 11, 3);
      const n = 2 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) {
        const x = 8 + i * 7 + r() * 3, h = 10 + r() * 12;
        poly(g, '#6a5e52', [x - 4, 27, x + 4, 27, x + 0.5, 27 - h]);
        poly(g, '#8a7e70', [x - 4, 27, x - 0.5, 27, x + 0.5, 27 - h]);
      }
    },
    rubble(g, r) {
      for (let i = 0; i < 7; i++) {
        const x = 5 + r() * 22, y = 12 + r() * 14, rx = 1.5 + r() * 2.5;
        ellipse(g, 'rgba(0,0,0,0.25)', x + 1, y + 1.5, rx, rx * 0.6);
        ellipse(g, r() < 0.5 ? '#7a7068' : '#8e847a', x, y, rx, rx * 0.7);
      }
    },
    crystal(g, r) {
      const [c, light, glow] = r() < 0.5 ? ['#40c8f0', '#c0f4ff', 'rgba(64,200,240,0.25)'] : ['#a060f0', '#e8d0ff', 'rgba(160,96,240,0.25)'];
      ellipse(g, glow, 16, 20, 13, 9);
      shadow(g, 16, 27, 9, 2.5);
      for (const [x, h, w] of [[11, 14, 3], [16, 20, 4], [21, 12, 3], [14, 9, 2]]) {
        poly(g, c, [x - w, 27, x + w, 27, x + w, 27 - h + 3, x, 27 - h, x - w, 27 - h + 3]);
        poly(g, light, [x - w, 27, x, 27, x, 27 - h, x - w, 27 - h + 3]);
      }
    },
    puddle(g, r) {
      ellipse(g, '#2a3a4a', 16, 20, 10 + r() * 3, 4 + r() * 2);
      ellipse(g, '#3a5a7a', 14, 19, 6, 2);
      ellipse(g, 'rgba(255,255,255,0.35)', 12, 18.5, 2, 0.8);
    },

    // --- out in the wilds (windmill, totem, obelisk, flagpole and ancient tree are 64x64) ---
    windmill(g, r, frame) {
      shadow(g, 48, 61, 14, 3);
      poly(g, '#a8a090', [38, 62, 58, 62, 55, 26, 41, 26]);
      poly(g, '#8a8274', [50, 62, 58, 62, 55, 26, 50, 26]);
      rect(g, '#5a3a1e', 45, 50, 6, 12);
      rect(g, '#2a2a40', 46, 36, 4, 5);
      poly(g, '#8a3a2a', [38, 27, 58, 27, 48, 12]);
      const a0 = (frame * Math.PI) / 8;
      for (let i = 0; i < 4; i++) {
        const a = a0 + (i * Math.PI) / 2, ex = 48 + Math.cos(a) * 20, ey = 21 + Math.sin(a) * 20;
        line(g, '#6a4a2a', 2, 48, 21, ex, ey);
        const px = -Math.sin(a) * 4, py = Math.cos(a) * 4;
        poly(g, 'rgba(236,228,206,0.92)', [48 + Math.cos(a) * 6, 21 + Math.sin(a) * 6, ex, ey, ex + px, ey + py, 48 + Math.cos(a) * 6 + px, 21 + Math.sin(a) * 6 + py]);
      }
      ellipse(g, '#4a3018', 48, 21, 2.5, 2.5);
    },
    igloo(g) {
      shadow(g, 16, 28, 15, 4);
      g.fillStyle = '#eef4fa';
      g.beginPath();
      g.ellipse(16, 27, 15, 16, 0, Math.PI, 0);
      g.fill();
      for (const y of [17, 22]) rect(g, '#c8d6e4', 2, y, 28, 1);
      for (const [x, y] of [[9, 12], [16, 12], [23, 12], [6, 17], [13, 17], [20, 17], [27, 17], [9, 22], [23, 22]]) rect(g, '#c8d6e4', x, y, 1, 5);
      g.fillStyle = '#2a3440';
      g.beginPath();
      g.ellipse(16, 27, 5, 7, 0, Math.PI, 0);
      g.fill();
    },
    totem(g) {
      shadow(g, 48, 61, 8, 3);
      const faces = [['#a8402a', '#f0d040'], ['#2a6a8a', '#f0f0e8'], ['#3a8a3a', '#f0d040'], ['#8a5a2a', '#e04030']];
      faces.forEach(([c, e], i) => {
        const y = 50 - i * 11;
        rect(g, c, 42, y, 12, 11);
        rect(g, shade(c, 0.7), 51, y, 3, 11);
        rect(g, e, 44, y + 3, 3, 2); rect(g, e, 49, y + 3, 3, 2);
        rect(g, '#1a1a1a', 45, y + 7, 6, 2);
      });
      poly(g, '#d06a2a', [42, 18, 30, 12, 42, 22]);
      poly(g, '#d06a2a', [54, 18, 66, 12, 54, 22]);
      poly(g, '#a8402a', [42, 17, 54, 17, 48, 9]);
    },
    beehive(g) {
      shadow(g, 16, 28, 9, 3);
      rect(g, '#6a4422', 9, 23, 2, 6); rect(g, '#6a4422', 21, 23, 2, 6);
      rect(g, '#8a5a2e', 7, 22, 18, 2);
      for (let i = 0; i < 4; i++) ellipse(g, i % 2 ? '#c8a050' : '#dcb860', 16, 19 - i * 3, 8 - i * 1.6, 2.4);
      ellipse(g, '#3a2a10', 16, 19, 1.6, 1.4);
      for (const [x, y] of [[6, 9], [24, 7], [27, 13], [10, 5]]) { rect(g, '#f0c020', x, y, 2, 1); rect(g, '#1a1a1a', x + 1, y, 1, 1); }
    },
    eggs(g, r) {
      shadow(g, 16, 27, 13, 4);
      ellipse(g, '#6a5030', 16, 24, 13, 5);
      for (let i = 0; i < 18; i++) line(g, '#8a6a3a', 1, 4 + r() * 24, 20 + r() * 7, 4 + r() * 24, 20 + r() * 7);
      const tint = r() < 0.5 ? ['#c84a3a', '#e88a6a'] : ['#4a8ab0', '#8ac0e0'];
      for (const [x, y] of [[11, 17], [20, 18], [16, 14]]) {
        ellipse(g, tint[0], x, y, 4.5, 6);
        ellipse(g, tint[1], x - 1.5, y - 2, 1.5, 2);
        for (let k = 0; k < 4; k++) rect(g, 'rgba(0,0,0,0.3)', x - 3 + r() * 6, y - 3 + r() * 7, 1, 1);
      }
    },
    obelisk(g) {
      shadow(g, 48, 61, 10, 3);
      rect(g, '#3a3a44', 40, 56, 16, 6);
      poly(g, '#4a4a56', [42, 56, 54, 56, 52, 12, 44, 12]);
      poly(g, '#34343e', [48, 56, 54, 56, 52, 12, 48, 12]);
      poly(g, '#5a5a66', [44, 12, 52, 12, 48, 5]);
      for (let y = 18; y < 52; y += 6) rect(g, 'rgba(120,220,255,0.8)', 46, y, 3, 2);
      ellipse(g, 'rgba(120,220,255,0.25)', 48, 30, 9, 22);
    },
    cauldron(g, r, frame) {
      shadow(g, 16, 28, 11, 3);
      ellipse(g, '#ff8a20', 16, 26, 7, 2.5);
      ellipse(g, '#2a2a30', 16, 19, 11, 8);
      ellipse(g, '#3a3a44', 13, 16, 4, 3);
      ellipse(g, '#5ac040', 16, 13, 9, 3);
      for (let i = 0; i < 3; i++) {
        const y = 12 - ((frame + i) % 3) * 3;
        ellipse(g, 'rgba(160,240,120,0.85)', 11 + i * 5, y, 1.6, 1.6);
      }
      rect(g, '#1a1a1e', 5, 12, 22, 2);
    },
    sword_grave(g) {
      ellipse(g, '#6a5a44', 16, 26, 7, 2.5);
      rect(g, '#c8ccd4', 15, 10, 3, 16);
      rect(g, '#ffffff', 15, 10, 1, 15);
      rect(g, '#b08a30', 11, 9, 11, 2);
      rect(g, '#5a3a1a', 15, 4, 3, 5);
      ellipse(g, '#d0a030', 16.5, 3.5, 2, 2);
    },
    flagpole(g, r) {
      const c = ['#c03030', '#2e6ab0', '#3f8a3a'][(r() * 3) | 0];
      shadow(g, 48, 61, 5, 2);
      rect(g, '#5a3a1e', 46, 8, 3, 54);
      poly(g, c, [49, 9, 62, 12, 59, 18, 62, 24, 49, 25]);
      rect(g, 'rgba(255,255,255,0.3)', 52, 15, 4, 3);
      ellipse(g, '#d0a030', 47.5, 7, 2.5, 2.5);
    },
    ancient_tree(g, r) {
      shadow(g, 40, 60, 24, 5);
      for (const [x0, x1] of [[30, 22], [52, 62], [40, 34], [46, 54]]) line(g, '#4a2e16', 4, (x0 + x1) / 2, 50, x1, 60);
      poly(g, '#5b3a1e', [32, 62, 52, 62, 48, 26, 36, 26]);
      poly(g, '#6f4826', [32, 62, 40, 62, 40, 26, 36, 26]);
      ellipse(g, '#1f4a1c', 38, 22, 26, 20);
      ellipse(g, '#2a5f25', 34, 18, 22, 16);
      ellipse(g, '#347330', 30, 13, 15, 10);
      for (let i = 0; i < 60; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 22;
        rect(g, r() < 0.5 ? '#1c4019' : '#4a8a3c', 36 + Math.cos(a) * d * 1.1, 19 + Math.sin(a) * d * 0.8, 2, 2);
      }
    },
    ice_spike(g, r) {
      shadow(g, 16, 28, 11, 3);
      for (const [x, h, w] of [[10, 14, 3], [16, 20, 4], [22, 11, 3]].map(([x, h, w]) => [x + r() * 2, h + r() * 4, w])) {
        poly(g, '#b8e0f4', [x - w, 28, x + w, 28, x, 28 - h]);
        poly(g, '#f0faff', [x - w, 28, x, 28, x, 28 - h]);
      }
    },
    fallen_pillar(g, r) {
      shadow(g, 16, 27, 15, 3);
      rect(g, '#a8a8b0', 2, 17, 22, 9);
      for (const y of [19, 22]) rect(g, '#8a8a94', 2, y, 22, 1);
      ellipse(g, '#c0c0c8', 24, 21.5, 3, 4.5);
      rect(g, '#909098', 25, 23, 5, 5);
      for (let i = 0; i < 4; i++) ellipse(g, '#9a9aa2', 6 + r() * 20, 27 + r() * 2, 1.5, 1);
    },

    // --- in and around towns (fountain, lamp post, stall, wagon, chimney, boat, scarecrow,
    // pillar and notice board are 64x64, standing in the bottom-right quarter) ---
    fountain(g, r, frame) {
      shadow(g, 32, 56, 31, 7);
      ellipse(g, '#808088', 32, 41, 30, 17);
      ellipse(g, '#a8a8b0', 32, 38, 30, 15);
      ellipse(g, '#c0c0c8', 30, 36, 26, 11);
      ellipse(g, '#2d63b5', 32, 39, 25, 11);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + frame * 0.45;
        ellipse(g, 'rgba(170,205,245,0.7)', 32 + Math.cos(a) * 16, 39 + Math.sin(a) * 6.5, 3, 1);
      }
      rect(g, '#9a9aa2', 29, 18, 7, 22);
      rect(g, '#c0c0c8', 29, 18, 2, 22);
      ellipse(g, '#a8a8b0', 32, 19, 10, 4);
      ellipse(g, '#5b8fd6', 32, 18, 8, 2.5);
      const j = frame % 2;
      line(g, 'rgba(210,232,255,0.9)', 2, 32, 15, 32, 4 + j);
      for (const s of [-1, 1]) line(g, 'rgba(210,232,255,0.75)', 1, 32, 5 + j, 32 + s * 8, 16);
      for (const s of [-1, 1]) line(g, 'rgba(210,232,255,0.65)', 1, 32 + s * 9, 20, 32 + s * 15, 35 + j);
    },
    fountain_rim() {}, // the fountain on the tile south-east of it draws over this one
    lamppost_off(g) {
      shadow(g, 48, 61, 6, 2);
      rect(g, '#26262c', 44, 57, 9, 4);
      rect(g, '#33333a', 46, 21, 4, 37);
      rect(g, '#50505a', 46, 21, 1, 37);
      rect(g, '#26262c', 41, 20, 14, 2);
      poly(g, '#26262c', [41, 8, 55, 8, 52, 3, 44, 3]);
      rect(g, '#3a4048', 42, 8, 12, 11);
      rect(g, '#59626e', 44, 10, 3, 6);
      for (const x of [41, 47, 54]) rect(g, '#26262c', x, 8, 1, 12);
      rect(g, '#26262c', 41, 19, 14, 1);
    },
    lamppost(g) {
      shadow(g, 48, 61, 6, 2);
      rect(g, '#26262c', 44, 57, 9, 4);
      rect(g, '#33333a', 46, 21, 4, 37);
      rect(g, '#50505a', 46, 21, 1, 37);
      rect(g, '#26262c', 41, 20, 14, 2);
      poly(g, '#26262c', [41, 8, 55, 8, 52, 3, 44, 3]);
      rect(g, '#ffe090', 42, 8, 12, 11);
      rect(g, '#fff6d0', 44, 10, 4, 7);
      for (const x of [41, 47, 54]) rect(g, '#26262c', x, 8, 1, 12);
      rect(g, '#26262c', 41, 19, 14, 1);
    },
    bench(g) {
      shadow(g, 16, 27, 14, 3);
      rect(g, '#3a3a40', 5, 20, 2, 7);
      rect(g, '#3a3a40', 25, 20, 2, 7);
      rect(g, '#7a4e26', 3, 8, 26, 3);
      rect(g, '#7a4e26', 3, 12, 26, 2);
      rect(g, '#3a3a40', 5, 8, 2, 12);
      rect(g, '#3a3a40', 25, 8, 2, 12);
      rect(g, '#8a5a2e', 3, 16, 26, 4);
      rect(g, '#a8743e', 3, 16, 26, 1);
    },
    stall(g, r) {
      const [a, b] = [['#c03a30', '#f0e6d0'], ['#2e6ab0', '#f0e6d0'], ['#3f8a3a', '#f4e8b0']][(r() * 3) | 0];
      shadow(g, 46, 61, 17, 3);
      rect(g, '#6a4422', 31, 30, 2, 31);
      rect(g, '#6a4422', 60, 30, 2, 31);
      rect(g, '#8a5a2e', 29, 45, 35, 13);
      rect(g, '#a8743e', 29, 45, 35, 2);
      rect(g, '#6a4422', 29, 56, 35, 2);
      for (let i = 0; i < 7; i++) ellipse(g, ['#d03a2a', '#e8c040', '#5aa040', '#e07a20', '#8a4ab0'][(r() * 5) | 0], 33 + i * 4.5, 43, 2.5, 2);
      poly(g, a, [27, 20, 64, 20, 64, 25, 27, 25]);
      for (let i = 0; i < 6; i++) poly(g, i % 2 ? b : a, [27 + i * 6.2, 25, 33.2 + i * 6.2, 25, 34 + i * 6.2, 34, 28 + i * 6.2, 34]);
      for (let i = 0; i < 6; i++) ellipse(g, i % 2 ? b : a, 31 + i * 6.2, 34, 3.1, 2);
    },
    hedge(g, r) {
      rect(g, '#244e1f', 0, 9, TILE, 19);
      rect(g, '#3a7230', 0, 9, TILE, 4);
      for (let i = 0; i < 46; i++) rect(g, r() < 0.5 ? '#1e4419' : '#4a8a3c', r() * 31, 9 + r() * 18, 2, 2);
      rect(g, 'rgba(0,0,0,0.3)', 0, 27, TILE, 2);
    },
    planter(g, r) {
      shadow(g, 16, 28, 13, 3);
      for (let i = 0; i < 9; i++) {
        const x = 6 + i * 2.5, y = 11 + (i % 3);
        rect(g, '#3a7a30', x, y, 1, 8);
        ellipse(g, ['#e04a6a', '#f0d040', '#f4f4f4', '#a05ad0'][(r() * 4) | 0], x + 0.5, y, 2, 2);
      }
      rect(g, '#7a4a26', 4, 18, 24, 10);
      rect(g, '#93602f', 4, 18, 24, 2);
      rect(g, '#5a3418', 4, 26, 24, 2);
    },
    haystack(g, r) {
      shadow(g, 16, 28, 14, 4);
      ellipse(g, '#c8a040', 16, 20, 14, 10);
      ellipse(g, '#dcb850', 13, 16, 9, 6);
      for (let i = 0; i < 26; i++) {
        const x = 4 + r() * 24, y = 11 + r() * 16;
        line(g, r() < 0.5 ? '#a8822c' : '#ecd070', 1, x, y, x + 2 - r() * 4, y + 3);
      }
    },
    wagon(g) {
      shadow(g, 44, 60, 20, 4);
      ellipse(g, '#c8a040', 44, 34, 15, 6);
      ellipse(g, '#dcb850', 41, 32, 9, 3);
      rect(g, '#6a4422', 26, 36, 36, 14);
      rect(g, '#8a5a2e', 26, 36, 36, 3);
      for (let x = 30; x < 62; x += 8) rect(g, '#5a3818', x, 39, 1, 11);
      line(g, '#5a3818', 3, 26, 46, 12, 53);
      for (const x of [33, 55]) {
        ellipse(g, '#3a2410', x, 52, 7, 7);
        ellipse(g, '#8a6a3a', x, 52, 5, 5);
        line(g, '#3a2410', 1, x - 5, 52, x + 5, 52);
        line(g, '#3a2410', 1, x, 47, x, 57);
        ellipse(g, '#3a2410', x, 52, 1.5, 1.5);
      }
    },
    woodpile(g) {
      shadow(g, 16, 28, 14, 3);
      for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) {
        const x = 7 + i * 6 + row * 3, y = 24 - row * 5;
        ellipse(g, '#6e4422', x, y, 3.2, 3.2);
        ellipse(g, '#c8a070', x, y, 2.2, 2.2);
        ellipse(g, '#a87a48', x, y, 1, 1);
      }
    },
    chimney(g, r, frame) {
      for (let i = 0; i < 3; i++) {
        const t = (frame + i * 1.4) % 4;
        ellipse(g, `rgba(205,205,210,${0.55 - t * 0.12})`, 47 - t * 3, 27 - t * 6, 3 + t, 2.5 + t * 0.8);
      }
      rect(g, '#7a3a2a', 42, 36, 12, 22);
      rect(g, '#9a4a36', 42, 36, 4, 22);
      for (let y = 40; y < 58; y += 5) rect(g, 'rgba(0,0,0,0.25)', 42, y, 12, 1);
      rect(g, '#5a2a1e', 40, 33, 16, 4);
      rect(g, '#2a1610', 43, 33, 10, 1);
    },
    basket(g, r) {
      shadow(g, 16, 28, 11, 3);
      const goods = [['#d03a2a', '#e86040'], ['#e8b860', '#c89040'], ['#9ab8d0', '#7090a8']][(r() * 3) | 0];
      for (let i = 0; i < 7; i++) ellipse(g, goods[i % 2], 10 + (i % 4) * 4, 15 - Math.floor(i / 4) * 3, 3, 2.5);
      poly(g, '#a8783e', [6, 16, 26, 16, 23, 28, 9, 28]);
      for (let y = 18; y < 28; y += 3) rect(g, '#7a5426', 7, y, 18, 1);
    },
    sack(g) {
      shadow(g, 16, 28, 9, 3);
      ellipse(g, '#c8b080', 16, 21, 9, 8);
      ellipse(g, '#d8c494', 14, 19, 5, 4);
      rect(g, '#a89060', 13, 11, 6, 4);
      rect(g, '#7a6440', 12, 14, 8, 1);
    },
    boat(g) {
      ellipse(g, 'rgba(0,10,40,0.3)', 44, 56, 22, 5);
      poly(g, '#6a4422', [22, 44, 64, 44, 58, 58, 28, 58]);
      poly(g, '#8a5a2e', [22, 44, 64, 44, 62, 48, 24, 48]);
      rect(g, '#5a3818', 34, 45, 3, 11);
      rect(g, '#5a3818', 48, 45, 3, 11);
      line(g, '#a87a48', 2, 30, 50, 18, 57);
      line(g, '#a87a48', 2, 57, 50, 63, 58);
    },
    // the black ribs of an old ship, half sunk, fanning out from its keel; some still have a stump of mast
    wreck(g, r) {
      const mast = r() < 0.5, k = r() * 4;
      ellipse(g, 'rgba(0,10,30,0.35)', 16, 24, 14, 4);
      line(g, '#2e1e10', 3.5, 3, 25 - k, 29, 21 + k); // the keel, lying aslant
      const keelY = x => 25 - k + ((x - 3) / 26) * (k * 2 - 4);
      for (const [x, lean, h] of [[7, -5, 13], [12, -2, 9], [18, 3, 15], [24, 6, 8]]) {
        const y = keelY(x);
        line(g, '#2a1a0c', 2.5, x, y, x + lean * 0.4, y - h * 0.55, x + lean, y - h); // a rib, curving out
        line(g, '#6a4a2a', 1, x + 0.8, y - 1, x + lean * 0.4 + 0.8, y - h * 0.55);
      }
      rect(g, '#5a3e24', 6, keelY(6) - 7, 9, 2); // what is left of the planks
      rect(g, '#4a3220', 17, keelY(17) - 10, 8, 2);
      if (mast) {
        line(g, '#3a2614', 3, 14, keelY(14), 22, 2);
        poly(g, 'rgba(220,210,190,0.85)', [21, 5, 27, 9, 22, 12]); // a rag of sail
      }
      for (const x of [4, 10, 17, 24, 28]) ellipse(g, 'rgba(230,240,255,0.55)', x, keelY(x) + 2, 2.5, 1); // foam
    },
    // A straw-stuffed sack on a post, a crossbar for arms and a painted target: for practice.
    dummy(g) {
      shadow(g, 48, 61, 7, 2);
      rect(g, '#5a3a1e', 46, 30, 4, 32);
      rect(g, '#6a4422', 36, 34, 24, 3);
      ellipse(g, '#c8a868', 48, 40, 8, 10);
      ellipse(g, '#b89858', 49, 42, 6, 8);
      for (let i = 0; i < 6; i++) line(g, '#a08048', 1, 42 + i * 2, 34, 41 + i * 2, 46);
      ellipse(g, '#c03a2a', 48, 40, 4, 4); ellipse(g, '#e8d8b0', 48, 40, 2.5, 2.5); ellipse(g, '#c03a2a', 48, 40, 1, 1);
      ellipse(g, '#d8b878', 48, 26, 5, 5);
      rect(g, '#8a6a3a', 43, 22, 10, 2);
      rect(g, '#6a4422', 44, 50, 8, 3); // the rope round its waist
    },
    scarecrow(g) {
      shadow(g, 48, 61, 6, 2);
      rect(g, '#6a4422', 46, 24, 3, 38);
      rect(g, '#6a4422', 34, 30, 28, 3);
      poly(g, '#7a6a3a', [40, 31, 56, 31, 54, 48, 42, 48]);
      for (const x of [33, 59]) rect(g, '#d8b040', x, 29, 4, 5);
      ellipse(g, '#e0c890', 47.5, 21, 6, 6);
      rect(g, '#2a2a2a', 44, 20, 2, 2);
      rect(g, '#2a2a2a', 49, 20, 2, 2);
      rect(g, '#2a2a2a', 45, 24, 5, 1);
      poly(g, '#5a4a2a', [37, 17, 58, 17, 53, 14, 52, 8, 43, 8, 42, 14]);
    },
    pillar(g) {
      shadow(g, 48, 61, 10, 3);
      rect(g, '#a8a8b0', 38, 55, 20, 7);
      rect(g, '#c8c8d0', 38, 55, 20, 1);
      rect(g, '#d0d0d6', 41, 12, 14, 43);
      for (const x of [44, 48, 52]) rect(g, '#b4b4bc', x, 12, 1, 43);
      rect(g, '#ececf0', 41, 12, 2, 43);
      rect(g, '#a8a8b0', 38, 6, 20, 6);
      rect(g, '#c8c8d0', 38, 6, 20, 1);
    },
    noticeboard(g) {
      shadow(g, 48, 61, 12, 3);
      rect(g, '#5a3a1a', 37, 30, 3, 32);
      rect(g, '#5a3a1a', 56, 30, 3, 32);
      rect(g, '#8a5a2e', 34, 18, 28, 22);
      rect(g, '#6a4422', 34, 38, 28, 2);
      poly(g, '#6a4422', [32, 18, 64, 18, 58, 13, 38, 13]);
      for (const [x, y, w, h] of [[37, 21, 8, 9], [47, 22, 11, 7], [39, 31, 9, 6], [50, 30, 8, 7]]) {
        rect(g, '#efe6cc', x, y, w, h);
        rect(g, '#c03030', x + w / 2 - 0.5, y, 1, 1);
        for (let l = y + 2; l < y + h - 1; l += 2) rect(g, '#9a907a', x + 1, l, w - 2, 1);
      }
    },
    anvil(g) {
      shadow(g, 16, 27, 11, 3);
      rect(g, '#3a3a40', 12, 20, 8, 7);
      poly(g, '#55555c', [5, 13, 27, 13, 24, 19, 8, 19]);
      poly(g, '#55555c', [27, 13, 31, 14, 27, 16]);
      rect(g, '#7a7a82', 5, 13, 22, 2);
    },
    web(g) {
      g.globalAlpha = 0.75;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        line(g, '#e8e8f0', 0.8, 16, 16, 16 + Math.cos(a) * 15, 16 + Math.sin(a) * 15);
      }
      for (const rad of [4, 8, 12]) {
        g.strokeStyle = '#d8d8e4';
        g.lineWidth = 0.7;
        g.beginPath();
        for (let i = 0; i <= 8; i++) {
          const a = (i * Math.PI) / 4, k = i % 2 ? 0.85 : 1;
          g.lineTo(16 + Math.cos(a) * rad * k, 16 + Math.sin(a) * rad * k);
        }
        g.stroke();
      }
      g.globalAlpha = 1;
    },
    bones(g) {
      rect(g, '#e6e0cc', 8, 20, 12, 2);
      ellipse(g, '#e6e0cc', 8, 21, 2, 2);
      ellipse(g, '#e6e0cc', 20, 21, 2, 2);
      ellipse(g, '#e6e0cc', 21, 12, 5, 4);
      rect(g, '#3a3a3a', 19, 11, 2, 2);
      rect(g, '#3a3a3a', 22, 11, 2, 2);
      line(g, '#d8d2be', 2, 6, 27, 14, 25);
    },
    altar(g) {
      shadow(g, 16, 28, 14, 3);
      rect(g, '#a8a4a0', 3, 10, 26, 18);
      rect(g, '#c8c4bc', 3, 8, 26, 4);
      rect(g, '#e8e4ee', 3, 12, 26, 6);
      rect(g, '#d0a030', 3, 17, 26, 2);
      rect(g, '#d0a030', 14, 2, 4, 8);
      rect(g, '#d0a030', 11, 4, 10, 2);
    },
    gravestone(g) {
      shadow(g, 16, 28, 10, 3);
      rect(g, '#8a8a90', 9, 10, 14, 18);
      ellipse(g, '#8a8a90', 16, 10, 7, 6);
      rect(g, '#6a6a70', 15, 9, 2, 10);
      rect(g, '#6a6a70', 12, 12, 8, 2);
      rect(g, '#a0a0a6', 9, 10, 1, 18);
    },
    tent(g) {
      shadow(g, 16, 29, 15, 3);
      poly(g, '#b8a070', [16, 3, 31, 29, 1, 29]);
      poly(g, '#9a8458', [16, 3, 31, 29, 16, 29]);
      poly(g, '#2a2018', [16, 14, 21, 29, 11, 29]);
      rect(g, '#5a3a1a', 15, 1, 2, 4);
    },
    torch(g, r, frame) {
      shadow(g, 17, 28, 4, 2);
      rect(g, '#5b3a1e', 15, 14, 3, 14);
      rect(g, '#3a2614', 14, 13, 5, 3);
      flame(g, 16.5, 14, 4, 10, frame);
    },
    torch_out(g) {
      shadow(g, 17, 28, 4, 2);
      rect(g, '#5b3a1e', 15, 14, 3, 14);
      rect(g, '#2a2420', 14, 11, 5, 4);
      rect(g, '#4a3e36', 15, 10, 3, 2);
    },
    campfire(g, r, frame) {
      ellipse(g, 'rgba(255,140,40,0.18)', 16, 22, 13, 6); // the glow on the ground
      line(g, '#5a3a1a', 3, 7, 26, 25, 20);
      line(g, '#6a4422', 3, 7, 20, 25, 26);
      ellipse(g, '#c84a10', 16, 23, 6, 2.5); // embers
      flame(g, 16, 24, 7, 17, frame);
    },
    campfire_out(g) {
      line(g, '#3a2a1a', 3, 7, 26, 25, 20);
      line(g, '#4a3422', 3, 7, 20, 25, 26);
      ellipse(g, '#4a4440', 16, 22, 6, 3);
      ellipse(g, '#6a6460', 15, 21, 3, 1.5); // ash
      rect(g, '#a03a10', 17, 22, 1, 1); // one last ember
    },

    window: (g, r, frame, shape) => onWall(g, shape, () => {
      rect(g, '#4a3018', 8, 5, 16, 16);
      rect(g, '#9fd0f0', 10, 7, 12, 12);
      rect(g, '#cfe8ff', 11, 8, 4, 3);
      rect(g, '#4a3018', 15, 7, 2, 12);
      rect(g, '#4a3018', 10, 12, 12, 2);
      rect(g, '#6a4a28', 7, 21, 18, 2);
    }),
    wall_torch: (g, r, frame, shape) => onWall(g, shape, () => {
      rect(g, '#3a3a3a', 13, 15, 6, 2);
      rect(g, '#5b3a1e', 15, 8, 2, 8);
      flame(g, 16, 9, 3, 8, frame);
    }),
    wall_torch_out: (g, r, frame, shape) => onWall(g, shape, () => {
      rect(g, '#3a3a3a', 13, 15, 6, 2);
      rect(g, '#5b3a1e', 15, 8, 2, 8);
      rect(g, '#2a2420', 14, 6, 4, 3);
    }),
    banner: (g, r, frame, shape) => onWall(g, shape, () => {
      rect(g, '#6a4a22', 8, 3, 16, 2);
      poly(g, '#8a1a22', [10, 5, 22, 5, 22, 24, 16, 20, 10, 24]);
      rect(g, '#d0a030', 10, 5, 1, 18);
      rect(g, '#d0a030', 21, 5, 1, 18);
      poly(g, '#e0c040', [16, 8, 19, 12, 16, 16, 13, 12]);
    }),
    painting: (g, r, frame, shape) => onWall(g, shape, () => {
      rect(g, '#c8a030', 6, 5, 20, 15);
      rect(g, '#7ab0e0', 8, 7, 16, 6);
      rect(g, '#4a8a3c', 8, 13, 16, 5);
      ellipse(g, '#f0e060', 19, 9, 2, 2);
    }),
    painting_ship: (g, r, frame, shape) => onWall(g, shape, () => {
      rect(g, '#8a6a28', 5, 4, 22, 17);
      rect(g, '#a8382a', 7, 6, 18, 6); // a red sky
      rect(g, '#d8703a', 7, 11, 18, 2);
      rect(g, '#2a4a6a', 7, 13, 18, 6); // the sea
      poly(g, '#3a2614', [10, 15, 20, 13, 19, 16, 11, 17]); // a ship, heeling over
      line(g, '#e8e0d0', 1, 15, 14, 17, 8);
      poly(g, '#e8e0d0', [16, 9, 21, 10, 17, 13]);
      poly(g, '#141418', [7, 19, 9, 14, 12, 19]); // black rocks
      poly(g, '#141418', [18, 19, 21, 15, 25, 19]);
    }),
    // wet streaks running down the stone
    damp_wall: (g, r, frame, shape) => onWall(g, shape, () => {
      ellipse(g, 'rgba(10,25,35,0.45)', 16, 14, 11, 12); // a wet patch
      for (const [x, y0, len] of [[9, 4, 20], [14, 6, 17], [21, 2, 22]]) {
        rect(g, 'rgba(10,20,30,0.55)', x - 1, y0, 3, len);
        rect(g, 'rgba(170,215,240,0.75)', x, y0 + 2, 1, len - 4);
      }
      ellipse(g, 'rgba(190,225,245,0.95)', 21, 26, 1.3, 1.8); // a drop
    }),
    sign_wall: (g, r, frame, shape) => onWall(g, shape, () => {
      rect(g, '#9a6a38', 5, 8, 22, 11);
      rect(g, '#6e4422', 5, 18, 22, 1);
      rect(g, '#4a2a10', 8, 11, 15, 1);
      rect(g, '#4a2a10', 8, 14, 11, 1);
    }),
    door_sealed: (g, r, frame, shape, material) => doorInWall(g, r, shape, material, false, true),
    chair(g) {
      shadow(g, 16, 27, 8, 3);
      rect(g, '#6e4422', 10, 18, 2, 9);
      rect(g, '#6e4422', 20, 18, 2, 9);
      rect(g, '#9a6633', 9, 16, 14, 4);
      rect(g, '#8a5a2a', 9, 4, 14, 3);
      rect(g, '#6e4422', 10, 4, 2, 13);
      rect(g, '#6e4422', 20, 4, 2, 13);
    },
    plant(g) {
      shadow(g, 16, 28, 8, 3);
      poly(g, '#a8543a', [10, 18, 22, 18, 20, 28, 12, 28]);
      ellipse(g, '#3a8a35', 16, 12, 8, 7);
      ellipse(g, '#4fa046', 13, 10, 4, 4);
      ellipse(g, '#2f6e2a', 20, 14, 4, 3);
    },
    bed(g) {
      shadow(g, 16, 28, 14, 3);
      rect(g, '#6e4422', 3, 6, 26, 22);
      rect(g, '#e8e4dc', 5, 8, 22, 7);
      rect(g, '#b03a3a', 5, 14, 22, 12);
      rect(g, 'rgba(255,255,255,0.2)', 5, 14, 22, 2);
    },
    signpost(g) {
      shadow(g, 16, 28, 6, 2);
      rect(g, '#5a3a1a', 15, 10, 3, 19);
      rect(g, '#9a6a38', 5, 5, 22, 10);
      rect(g, '#6e4422', 5, 14, 22, 1);
      rect(g, '#4a2a10', 8, 8, 14, 1);
      rect(g, '#4a2a10', 8, 11, 10, 1);
    },
    depot(g) {
      shadow(g, 16, 28, 13, 3);
      rect(g, '#5a5a62', 4, 6, 24, 22);
      rect(g, '#7a7a82', 4, 6, 24, 3);
      rect(g, '#3a3a42', 6, 11, 20, 1);
      rect(g, '#3a3a42', 6, 19, 20, 1);
      rect(g, '#d0a030', 14, 13, 4, 4);
      rect(g, '#d0a030', 14, 21, 4, 4);
    },
    lever: g => drawLever(g, false),
    lever_on: g => drawLever(g, true),
    teleport(g, r, frame) {
      for (let i = 0; i < 3; i++) {
        const rad = 12 - i * 3.5, a = frame * 0.8 + i * 2;
        g.strokeStyle = ['#6a3ad0', '#9a6af0', '#d0b8ff'][i];
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(16, 18, rad, rad * 0.6, 0, a, a + 4.4);
        g.stroke();
      }
      ellipse(g, 'rgba(200,170,255,0.6)', 16, 18, 3, 2);
    },
    rope_spot(g) {
      ellipse(g, 'rgba(255,250,210,0.25)', 16, 17, 11, 8);
      ellipse(g, 'rgba(255,250,210,0.35)', 16, 17, 6, 4);
    },
    loose_sand(g, r) {
      for (let i = 0; i < 14; i++) ellipse(g, i % 2 ? '#c9b273' : '#e8d8a4', 8 + r() * 16, 10 + r() * 14, 3, 2);
    },
    cracked_rock(g) {
      shadow(g, 17, 27, 13, 4);
      poly(g, '#77777c', [3, 27, 6, 10, 16, 4, 27, 8, 30, 26, 18, 30]);
      poly(g, '#9a9aa0', [6, 11, 16, 5, 26, 9, 16, 14]);
      line(g, '#2a2a2e', 1.5, 12, 8, 16, 16, 13, 22, 17, 28);
      line(g, '#2a2a2e', 1, 16, 16, 23, 19);
    },
    stairs_up(g) {
      for (let i = 0; i < 5; i++) {
        const v = 170 - i * 18; // steps get darker toward the bottom
        rect(g, `rgb(${v},${v - 8},${v - 20})`, 4, 2 + i * 6, 24, 6);
        rect(g, `rgb(${v - 40},${v - 48},${v - 60})`, 4, 7 + i * 6, 24, 1);
      }
      rect(g, '#4a4038', 2, 2, 2, 30);
      rect(g, '#4a4038', 28, 2, 2, 30);
    },
    stairs_down(g) {
      rect(g, '#120e0b', 3, 3, 26, 26);
      for (let i = 0; i < 4; i++) {
        const v = 120 - i * 28; // steps fade into the dark below
        rect(g, `rgb(${v},${v - 8},${v - 16})`, 5, 5 + i * 6, 22, 5);
      }
      rect(g, '#6a5a48', 2, 2, 28, 2);
      rect(g, '#6a5a48', 2, 2, 2, 28);
      rect(g, '#3a3028', 28, 2, 2, 28);
      rect(g, '#3a3028', 2, 28, 28, 2);
    },
    ladder(g) {
      rect(g, '#7a4f26', 8, 0, 3, 31);
      rect(g, '#7a4f26', 21, 0, 3, 31);
      for (let y = 3; y < 30; y += 6) rect(g, '#9a6a38', 11, y, 10, 2);
    },
    hole(g) {
      ellipse(g, '#3a2a1a', 16, 17, 13, 10);
      ellipse(g, '#0b0806', 16, 18, 11, 8);
    },
    // An open wooden hatch in the floor with the top of a ladder showing.
    trapdoor(g) {
      rect(g, '#2a1c10', 6, 8, 20, 18);
      rect(g, '#0b0806', 8, 10, 16, 14);
      rect(g, '#7a4f26', 10, 10, 2, 14); rect(g, '#7a4f26', 20, 10, 2, 14);
      for (let y = 12; y < 24; y += 5) rect(g, '#9a6a38', 12, y, 8, 2);
      rect(g, '#6a4422', 6, 2, 20, 7); // the lid, open against the floor
      for (let x = 8; x < 26; x += 5) rect(g, '#4f3218', x, 2, 1, 7);
      rect(g, '#3a3a40', 14, 4, 4, 2);
    },
  };

  const ANIMATED = { torch: { frames: [0, 1, 2, 3], ms: 120 }, wall_torch: { frames: [0, 2, 1, 3], ms: 130 }, campfire: { frames: [0, 1, 2, 3, 1, 2], ms: 110 }, windmill: { frames: [0, 1, 2, 3], ms: 260 }, cauldron: { frames: [0, 1, 2], ms: 300 }, fountain: { frames: [0, 1, 2, 3], ms: 220 }, chimney: { frames: [0, 1, 2, 3], ms: 380 }, water: { frames: [0, 1, 2, 1], ms: 400 }, lava: { frames: [0, 1, 2, 1], ms: 500 }, teleport: { frames: [0, 1, 2, 3, 4, 5, 6, 7], ms: 120 } };

  // Ground tiles get 4 variants each; these get a few as well.
  const VARIANTS = { crag: 4, pebbles: 3, shells: 2, leaves: 3, grass_tuft: 3, driftwood: 2, wreck: 2, flagpole: 3, eggs: 2, fallen_pillar: 2, ice_spike: 2, tallgrass: 3, log: 2, rubble: 2, crystal: 2, stalagmite: 3, lilypad: 2, dry_bush: 2, puddle: 2, stall: 3, basket: 3, planter: 3, hedge: 2, tree: 3, pine: 2, snow_pine: 2, jungle_tree: 3, palm: 2, bush: 2, flowers: 3, reeds: 2, mushrooms: 2, wall_cave: 3, cliff: 4, wall_stone: 2, wall_block: 2, wall_wood: 2, bookshelf: 2 };
  const spriteOf = id => THINGS[id].sprite || id;
  const variantsOf = id => VARIANTS[spriteOf(id)] || (THINGS[id].ground ? 4 : 1);

  // --- inventory items --------------------------------------------------------------
  function sword(g, len, blade, grip, wide = 3) {
    diagonal(g, () => {
      rect(g, grip, -1.5, 5, 3, 8);
      rect(g, '#d0a030', -5, 3, 10, 2);
      rect(g, blade, -wide / 2, 3 - len, wide, len);
      rect(g, 'rgba(255,255,255,0.6)', -wide / 2, 3 - len, 1, len);
      poly(g, blade, [-wide / 2, 3 - len, wide / 2, 3 - len, 0, -len]);
      rect(g, '#d0a030', -1.5, 12, 3, 2);
    });
  }
  function axe(g, head, size, double) {
    diagonal(g, () => {
      rect(g, '#6a4a2a', -1.5, -12, 3, 26);
      poly(g, head, [1.5, -12, 2 + size, -15, 2 + size, -2, 1.5, -5]);
      rect(g, 'rgba(255,255,255,0.5)', 1 + size, -14, 1, 11);
      if (double) poly(g, head, [-1.5, -12, -2 - size, -15, -2 - size, -2, -1.5, -5]);
    });
  }
  function club(g, color, studs) {
    diagonal(g, () => {
      rect(g, '#6a4a2a', -1.5, 0, 3, 13);
      ellipse(g, color, 0, -6, 4.5, 9);
      if (studs) for (const [x, y] of [[-3, -9], [2, -6], [-2, -3], [3, -11], [0, -13]]) rect(g, '#e0e0e8', x, y, 2, 2);
    });
  }
  function hammer(g) {
    diagonal(g, () => {
      rect(g, '#6a4a2a', -1.5, -8, 3, 22);
      rect(g, '#8a8a92', -8, -14, 16, 8);
      rect(g, '#b0b0b8', -8, -14, 16, 2);
    });
  }
  function spear(g) {
    diagonal(g, () => {
      rect(g, '#8a5a2a', -1, -10, 2, 25);
      poly(g, '#b8b8c0', [-3, -10, 3, -10, 0, -16]);
    });
  }
  function bow(g) {
    g.strokeStyle = '#8a5a2a';
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(8, 24, 18, -Math.PI / 2, 0);
    g.stroke();
    line(g, '#e8e0d0', 1, 8, 6, 26, 24);
  }
  function crossbow(g) {
    diagonal(g, () => {
      rect(g, '#6a4422', -2, -9, 4, 22);
      g.strokeStyle = '#8a8a92';
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(0, 0, 11, Math.PI + 0.5, -0.5);
      g.stroke();
      line(g, '#e8e0d0', 1, -9.7, -5, 9.7, -5);
    });
  }
  function missiles(g, len, tip, fletch) {
    for (let i = 0; i < 3; i++) {
      const o = i * 5 - 5;
      line(g, '#8a5a2a', 1.5, 8 + o, 26 - o + 0, 8 + o + len, 26 - o - len);
      poly(g, tip, [8 + o + len - 1, 26 - o - len - 3, 8 + o + len + 3, 26 - o - len + 1, 8 + o + len + 2, 26 - o - len - 2]);
      rect(g, fletch, 6 + o, 25 - o, 3, 3);
    }
  }
  function wand(g, shaft, gem) {
    diagonal(g, () => {
      rect(g, shaft, -1.5, -9, 3, 22);
      rect(g, '#d0a030', -2, -9, 4, 2);
      ellipse(g, 'rgba(255,255,255,0.35)', 0, -13, 5, 5);
      ellipse(g, gem, 0, -13, 3.5, 3.5);
    });
  }
  function rod(g, gem) {
    diagonal(g, () => {
      rect(g, '#7a5a3a', -2, -10, 4, 24);
      rect(g, '#5a3a1a', -2, -2, 4, 2);
      poly(g, gem, [0, -17, 4, -11, 0, -7, -4, -11]);
      rect(g, 'rgba(255,255,255,0.6)', -1, -14, 1, 3);
    });
  }
  function roundShield(g, face, rim, studs, planks) {
    ellipse(g, rim, 16, 16, 12, 13);
    ellipse(g, face, 16, 16, 10, 11);
    if (planks) for (let x = 10; x < 24; x += 4) rect(g, 'rgba(0,0,0,0.2)', x, 6, 1, 20);
    if (studs) for (let a = 0; a < 8; a++) rect(g, '#d8d8e0', 15 + Math.cos(a * 0.785) * 8, 15 + Math.sin(a * 0.785) * 9, 2, 2);
    ellipse(g, '#c8c8d0', 16, 16, 3, 3);
  }
  function kiteShield(g, face, rim) {
    poly(g, rim, [5, 3, 27, 3, 27, 18, 16, 30, 5, 18]);
    poly(g, face, [7, 5, 25, 5, 25, 17, 16, 27, 7, 17]);
    rect(g, rim, 15, 6, 2, 19);
    rect(g, rim, 8, 11, 16, 2);
  }
  function helmet(g, color, kind) {
    if (kind === 'hat') {
      ellipse(g, color, 16, 25, 13, 4);
      poly(g, color, [8, 25, 24, 25, 19, 3]);
      rect(g, '#d0a030', 9, 21, 14, 2);
      return;
    }
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(16, 20, 10, 12, 0, Math.PI, 0);
    g.fill();
    rect(g, 'rgba(255,255,255,0.35)', 10, 11, 3, 6);
    if (kind === 'cap') rect(g, '#6a4422', 5, 19, 22, 3);
    if (kind === 'chain') for (let y = 20; y < 28; y += 2) for (let x = 7 + (y % 4 ? 1 : 0); x < 25; x += 2) rect(g, '#7a7a82', x, y, 1, 1);
    if (kind === 'chain') rect(g, color, 6, 19, 20, 1);
    if (kind === 'steel') {
      rect(g, color, 6, 19, 20, 8);
      rect(g, '#2a2a30', 9, 21, 14, 2);
      rect(g, '#9a9aa2', 15, 19, 2, 8);
    }
  }
  function armor(g, color, kind) {
    poly(g, color, [9, 4, 23, 4, 29, 10, 25, 14, 24, 29, 8, 29, 7, 14, 3, 10]);
    ellipse(g, 'rgba(0,0,0,0.4)', 16, 5, 4, 2);
    if (kind === 'leather') {
      rect(g, '#5a3a1a', 8, 20, 16, 2);
      for (let y = 8; y < 28; y += 4) rect(g, 'rgba(0,0,0,0.25)', 15, y, 2, 2);
    }
    if (kind === 'chain') for (let y = 8; y < 29; y += 2) for (let x = 9 + (y % 4 ? 1 : 0); x < 24; x += 2) rect(g, '#6a6a72', x, y, 1, 1);
    if (kind === 'plate') {
      rect(g, 'rgba(255,255,255,0.35)', 10, 8, 4, 12);
      rect(g, 'rgba(0,0,0,0.25)', 8, 18, 16, 2);
      for (const [x, y] of [[9, 7], [22, 7], [9, 26], [22, 26]]) rect(g, '#e0d080', x, y, 2, 2);
    }
  }
  function robe(g, color, trim) {
    poly(g, color, [10, 3, 22, 3, 28, 9, 24, 13, 27, 30, 5, 30, 8, 13, 4, 9]);
    rect(g, trim, 15, 3, 2, 27);
    rect(g, trim, 6, 28, 20, 2);
    ellipse(g, 'rgba(0,0,0,0.4)', 16, 4, 4, 2);
  }
  function legs(g, color, kind) {
    rect(g, color, 8, 4, 16, 6);
    rect(g, color, 8, 10, 7, 19);
    rect(g, color, 17, 10, 7, 19);
    rect(g, 'rgba(0,0,0,0.3)', 8, 4, 16, 2);
    if (kind === 'chain') for (let y = 7; y < 28; y += 2) for (let x = 9 + (y % 4 ? 1 : 0); x < 24; x += 2) if (x < 15 || x > 16) rect(g, '#6a6a72', x, y, 1, 1);
    if (kind === 'plate') { rect(g, 'rgba(255,255,255,0.35)', 9, 12, 2, 14); rect(g, 'rgba(255,255,255,0.35)', 18, 12, 2, 14); }
  }
  function boots(g, color) {
    for (const x of [5, 17]) {
      rect(g, color, x, 7, 7, 16);
      rect(g, color, x, 20, 11, 6);
      rect(g, 'rgba(0,0,0,0.35)', x, 25, 11, 2);
      rect(g, 'rgba(255,255,255,0.2)', x, 7, 7, 2);
    }
  }
  function potion(g, color) {
    ellipse(g, '#cfe8ee', 16, 20, 9, 9);
    ellipse(g, color, 16, 21, 7.5, 7.5);
    rect(g, '#cfe8ee', 13, 7, 6, 6);
    rect(g, '#7a5a3a', 13, 4, 6, 4);
    ellipse(g, 'rgba(255,255,255,0.6)', 13, 18, 2, 3);
  }

  function ring(g, band, gem) {
    g.strokeStyle = band;
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(16, 19, 8, 7, 0, 0, Math.PI * 2);
    g.stroke();
    ellipse(g, gem, 16, 11, 4, 3);
    ellipse(g, 'rgba(255,255,255,0.6)', 15, 10, 1.5, 1);
  }
  function amulet(g, gem) {
    line(g, '#c8a030', 1.5, 7, 3, 16, 17, 25, 3);
    ellipse(g, '#c8a030', 16, 22, 6, 6);
    ellipse(g, gem, 16, 22, 4, 4);
    ellipse(g, 'rgba(255,255,255,0.6)', 15, 20, 1.5, 1);
  }
  function rune(g, symbol) {
    rect(g, '#6a6258', 6, 5, 20, 23);
    rect(g, '#d8d0c0', 7, 6, 18, 21);
    rect(g, '#efe8d8', 7, 6, 18, 2);
    if (symbol) symbol();
  }
  function key(g, color) {
    ellipse(g, color, 9, 16, 5, 5);
    ellipse(g, 'rgba(0,0,0,0.5)', 9, 16, 2, 2);
    rect(g, color, 13, 15, 14, 3);
    rect(g, color, 22, 18, 2, 4);
    rect(g, color, 26, 18, 2, 3);
  }
  function book(g, color) {
    rect(g, '#f0ead8', 8, 6, 18, 22);
    rect(g, color, 6, 5, 18, 22);
    rect(g, 'rgba(0,0,0,0.3)', 6, 5, 3, 22);
    rect(g, '#d0a030', 12, 10, 8, 2);
  }
  function kit(g, color) {
    rect(g, '#a07a46', 5, 9, 22, 19);
    rect(g, '#7a5a30', 5, 9, 22, 2);
    rect(g, color, 11, 14, 10, 9);
    line(g, '#5a3a1a', 1, 5, 18, 27, 18);
  }

  // A lump of rock with crystals of its grade's colour in it.
  function ore(g, color, shine) {
    poly(g, '#3a3632', [6, 22, 9, 12, 16, 8, 24, 10, 27, 19, 22, 26, 11, 27]);
    poly(g, '#5a544e', [8, 21, 11, 13, 16, 10, 22, 12, 24, 19, 20, 24, 12, 25]);
    for (const [x, y, s] of [[12, 15, 4], [18, 13, 3], [15, 20, 3], [21, 18, 2]]) {
      poly(g, color, [x, y - s, x + s * 0.8, y, x, y + s, x - s * 0.8, y]);
      rect(g, shine, x - 0.5, y - s * 0.5, 1, 1);
    }
  }
  const ITEM_DRAW = {
    gold(g) {
      for (const [x, y] of [[10, 22], [20, 22], [15, 18], [12, 14], [19, 13]]) {
        ellipse(g, '#8a6a10', x, y + 1, 6, 4);
        ellipse(g, '#e8c040', x, y, 6, 4);
        ellipse(g, '#f8e080', x - 1, y - 1, 3, 1.5);
      }
    },
    apple(g) {
      ellipse(g, '#c82a2a', 16, 19, 9, 9);
      ellipse(g, 'rgba(255,255,255,0.4)', 12, 16, 2, 3);
      rect(g, '#5a3a1a', 15, 7, 2, 5);
      ellipse(g, '#4a9a3a', 20, 9, 4, 2);
    },
    cheese(g) {
      poly(g, '#e8c040', [4, 24, 28, 24, 28, 12, 4, 21]);
      poly(g, '#f8d860', [4, 21, 28, 12, 24, 10, 4, 19]);
      for (const [x, y] of [[10, 22], [18, 19], [24, 21]]) ellipse(g, '#c89a20', x, y, 2, 1.5);
    },
    bread(g) {
      ellipse(g, '#a06a30', 16, 19, 13, 8);
      ellipse(g, '#c8904a', 16, 17, 12, 6);
      for (const x of [9, 15, 21]) line(g, '#8a5a2a', 1.5, x, 14, x + 3, 19);
    },
    meat(g) {
      rect(g, '#f0ece0', 20, 20, 8, 3);
      ellipse(g, '#f0ece0', 28, 21, 2.5, 2.5);
      ellipse(g, '#e0b0a0', 14, 16, 10, 9);
      ellipse(g, '#a83a2a', 14, 16, 8, 7);
    },
    health_potion: g => potion(g, '#d02a2a'),
    mana_potion: g => potion(g, '#3a5ad0'),
    bag(g) {
      ellipse(g, '#8a6a3a', 16, 21, 10, 9);
      rect(g, '#8a6a3a', 12, 8, 8, 6);
      rect(g, '#5a3a1a', 11, 12, 10, 2);
      ellipse(g, 'rgba(255,255,255,0.2)', 12, 19, 3, 4);
    },
    backpack(g) {
      rect(g, '#6a4a2a', 7, 6, 18, 22);
      rect(g, '#543820', 7, 6, 18, 9);
      rect(g, '#d0a030', 15, 13, 3, 3);
      rect(g, '#543820', 9, 18, 14, 8);
      rect(g, '#3a2614', 9, 18, 14, 1);
    },
    wooden_club: g => club(g, '#8a5a2a', false),
    mace: g => club(g, '#9a9aa0', true),
    war_hammer: hammer,
    dagger: g => sword(g, 9, '#c8c8d0', '#6a4a2a', 3),
    short_sword: g => sword(g, 13, '#c8c8d0', '#6a4a2a', 3),
    longsword: g => sword(g, 17, '#d0d0d8', '#3a3a6a', 3),
    broadsword: g => sword(g, 17, '#d8d8e0', '#6a2a2a', 5),
    knight_blade: g => sword(g, 18, '#e8e8ff', '#d0a030', 4),
    hatchet: g => axe(g, '#a0a0a8', 5, false),
    war_axe: g => axe(g, '#b0b0b8', 8, false),
    battle_axe: g => axe(g, '#c0c0c8', 7, true),
    spear,
    bow,
    crossbow,
    arrow: g => missiles(g, 14, '#b8b8c0', '#c03030'),
    bolt: g => missiles(g, 10, '#7a7a82', '#3a3a3a'),
    wand_sparks: g => wand(g, '#4a3a6a', '#c58cff'),
    wand_flames: g => wand(g, '#6a2a1a', '#ff7a1a'),
    rod_frost: g => rod(g, '#8fe0ff'),
    rod_thorns: g => rod(g, '#6fcf3f'),
    wooden_shield: g => roundShield(g, '#8a5a2a', '#5a3a1a', false, true),
    studded_shield: g => roundShield(g, '#8a5a2a', '#5a5a62', true, true),
    iron_shield: g => roundShield(g, '#9a9aa2', '#6a6a72', true, false),
    demon_shield: g => {
      kiteShield(g, '#5a1010', '#2a2a2a');
      poly(g, '#e8d8c0', [11, 9, 14, 14, 12, 15]);
      poly(g, '#e8d8c0', [21, 9, 18, 14, 20, 15]);
      ellipse(g, '#ff6020', 16, 17, 3, 2);
    },
    frost_blade: g => sword(g, 22, '#a8e0ff', '#3a5a8a', 4),
    fire_axe: g => {
      axe(g, '#d84a20', 8, true);
      ellipse(g, 'rgba(255,200,60,0.6)', 20, 12, 3, 3);
    },
    elven_bow: g => {
      bow(g);
      for (const [x, y] of [[9, 8], [9, 24], [12, 16]]) ellipse(g, '#5ab04a', x, y, 2.5, 1.5);
    },
    wand_storm: g => wand(g, '#2a2a5a', '#c58cff'),
    rod_glacier: g => rod(g, '#bfefff'),
    crown_helmet: g => {
      helmet(g, '#d0a830', 'steel');
      poly(g, '#e8c040', [8, 9, 8, 4, 12, 7, 16, 3, 20, 7, 24, 4, 24, 9]);
      rect(g, '#c02020', 15, 6, 2, 2);
    },
    witch_hat: g => {
      poly(g, '#2a2a2a', [4, 24, 28, 24, 22, 20, 10, 20]);
      poly(g, '#3a2a4a', [10, 21, 22, 21, 20, 4, 14, 8]);
      rect(g, '#8a3aaa', 10, 18, 12, 3);
    },
    lizard_mail: g => {
      armor(g, '#3a7a3a', 'leather');
      for (let y = 10; y < 28; y += 3) for (let x = 10 + (y % 2) * 2; x < 23; x += 4) rect(g, '#5aa04a', x, y, 2, 2);
    },
    golden_armor: g => armor(g, '#e0b030', 'plate'),
    dragon_shield: g => {
      kiteShield(g, '#3f8a3a', '#c8a030');
      poly(g, '#d8c070', [16, 9, 20, 14, 16, 22, 12, 14]);
      rect(g, '#2a6028', 15, 13, 2, 4);
    },
    tower_shield: g => kiteShield(g, '#3a5a9a', '#c0c0c8'),
    spellbook(g) {
      rect(g, '#f0ead8', 9, 7, 17, 21);
      rect(g, '#5a2a7a', 7, 6, 17, 21);
      rect(g, '#3a1a5a', 7, 6, 3, 21);
      ellipse(g, '#d0a030', 16, 16, 4, 4);
      ellipse(g, '#5a2a7a', 16, 16, 2, 2);
    },
    leather_cap: g => helmet(g, '#8a5a2a', 'cap'),
    chain_helmet: g => helmet(g, '#9a9aa2', 'chain'),
    steel_helmet: g => helmet(g, '#c0c0c8', 'steel'),
    wizard_hat: g => helmet(g, '#4a2a8a', 'hat'),
    leather_armor: g => armor(g, '#8a5a2a', 'leather'),
    chain_armor: g => armor(g, '#9a9aa2', 'chain'),
    plate_armor: g => armor(g, '#c0c0c8', 'plate'),
    mage_robe: g => robe(g, '#4a2a8a', '#d0a030'),
    ranger_cloak: g => robe(g, '#3f6a32', '#8a6a3a'),
    leather_legs: g => legs(g, '#8a5a2a'),
    chain_legs: g => legs(g, '#9a9aa2', 'chain'),
    plate_legs: g => legs(g, '#c0c0c8', 'plate'),
    leather_boots: g => boots(g, '#6a4a2a'),
    iron_boots: g => boots(g, '#9a9aa2'),
    wolf_pelt(g) {
      poly(g, '#7a7a7a', [5, 10, 12, 6, 20, 7, 27, 11, 28, 20, 24, 27, 16, 25, 8, 27, 4, 20]);
      poly(g, '#9a9a9a', [9, 11, 16, 9, 23, 12, 22, 20, 12, 21]);
    },
    old_sock(g) {
      poly(g, '#d8d0b8', [11, 4, 19, 4, 19, 19, 24, 22, 24, 27, 13, 27, 11, 22]);
      rect(g, '#a83030', 11, 6, 8, 2);
      rect(g, '#a83030', 11, 10, 8, 2);
      ellipse(g, '#8a8270', 21, 24, 2, 1.5);
      ellipse(g, '#b0a890', 15, 15, 2, 3);
    },
    spider_silk(g) {
      ellipse(g, '#e8e8f0', 16, 18, 9, 8);
      for (let i = 0; i < 5; i++) line(g, '#b0b0c0', 1, 8, 12 + i * 3, 24, 14 + i * 2);
    },
    bone(g) {
      diagonal(g, () => {
        rect(g, '#efe8d8', -2, -10, 4, 20);
        for (const [x, y] of [[-2, -11], [2, -11], [-2, 11], [2, 11]]) ellipse(g, '#efe8d8', x, y, 3, 3);
      });
    },
    bone_whistle(g) {
      diagonal(g, () => {
        rect(g, '#efe6cc', -2.5, -11, 5, 20);
        rect(g, '#cfc4a4', -2.5, -11, 5, 2);
        rect(g, '#5a4a3a', -1, -6, 2, 2);
        rect(g, '#5a4a3a', -1, 1, 2, 1.5);
      });
      line(g, '#8a6a3a', 1, 9, 22, 6, 27, 11, 28);
    },
    goblin_charm(g) {
      line(g, '#8a6a3a', 1, 8, 6, 16, 18, 24, 6);
      poly(g, '#3a8a4a', [16, 16, 21, 21, 16, 28, 11, 21]);
      rect(g, '#8fd09a', 14, 19, 2, 3);
    },
    orc_tooth(g) {
      poly(g, '#f0ead0', [10, 6, 22, 6, 20, 16, 16, 28, 12, 16]);
      rect(g, '#c8b890', 10, 6, 12, 2);
    },
    fur(g) {
      ellipse(g, '#d8d4cc', 16, 18, 12, 9);
      for (let i = 0; i < 10; i++) line(g, '#b8b4ac', 1, 6 + i * 2, 12, 8 + i * 2, 25);
    },
    bear_paw(g) {
      ellipse(g, '#5a3a22', 16, 20, 8, 7);
      for (const x of [10, 14, 18, 22]) { ellipse(g, '#5a3a22', x, 12, 2.5, 3); rect(g, '#e8e0d0', x - 1, 8, 2, 2); }
    },
    scorpion_tail(g) {
      line(g, '#3a2a1a', 4, 8, 26, 14, 18, 20, 12, 22, 7);
      poly(g, '#c03020', [22, 3, 25, 8, 20, 8]);
    },
    mummy_wrap(g) {
      for (let i = 0; i < 4; i++) rect(g, i % 2 ? '#d8ccaa' : '#c8bc98', 6, 8 + i * 5, 20, 4);
      line(g, '#a8987a', 1, 6, 10, 26, 24);
    },
    swamp_moss(g) {
      ellipse(g, '#4a6a2a', 16, 20, 10, 6);
      for (let i = 0; i < 6; i++) line(g, '#3a5a1e', 1, 9 + i * 3, 20, 8 + i * 3, 27);
    },
    croc_hide(g) {
      poly(g, '#4a6a3a', [5, 10, 27, 8, 25, 26, 7, 24]);
      for (let y = 12; y < 24; y += 4) for (let x = 9; x < 24; x += 4) rect(g, '#3a5a2a', x, y, 3, 3);
    },
    minotaur_horn(g) {
      line(g, '#e8dcc0', 5, 8, 26, 16, 16, 24, 6);
      line(g, '#8a7a5a', 2, 6, 27, 10, 24);
    },
    golem_core(g) {
      ellipse(g, '#6a6a70', 16, 17, 10, 10);
      ellipse(g, '#40e0ff', 16, 17, 4, 4);
      line(g, '#4a4a50', 1, 8, 12, 24, 22);
    },
    lizard_scale(g) {
      poly(g, '#2a6a3a', [16, 5, 26, 14, 22, 27, 10, 27, 6, 14]);
      poly(g, '#4aa05a', [16, 9, 23, 15, 20, 24, 12, 24, 9, 15]);
    },
    ember(g) {
      ellipse(g, '#ff6a10', 16, 18, 8, 9);
      ellipse(g, '#ffd040', 16, 20, 4, 5);
      poly(g, '#ff8a20', [12, 12, 16, 3, 20, 12]);
    },
    frost_scale(g) {
      poly(g, '#5a88a8', [16, 5, 26, 14, 22, 27, 10, 27, 6, 14]);
      poly(g, '#a8d8f0', [16, 8, 23, 15, 20, 24, 12, 24, 9, 15]);
    },
    demon_horn(g) {
      line(g, '#3a1010', 6, 8, 27, 14, 16, 22, 10, 26, 4);
      line(g, '#6a2020', 2, 9, 25, 15, 15);
    },
    cyclops_toe(g) {
      ellipse(g, '#b89070', 16, 18, 10, 7);
      ellipse(g, '#a07a5a', 12, 19, 5, 5);
      ellipse(g, '#e8d8c0', 23, 15, 3.5, 3);
      rect(g, '#7a5a3a', 8, 20, 8, 1);
    },
    dragon_scale(g) {
      poly(g, '#2a6028', [16, 5, 26, 14, 22, 27, 10, 27, 6, 14]);
      poly(g, '#4fa040', [16, 8, 23, 15, 20, 24, 12, 24, 9, 15]);
      line(g, '#9ad070', 1, 16, 9, 16, 24);
    },
    dragon_ham(g) {
      rect(g, '#f0ece0', 22, 20, 7, 4);
      ellipse(g, '#f0ece0', 29, 22, 3, 3);
      ellipse(g, '#4a8a3a', 14, 16, 11, 10);
      ellipse(g, '#b84a32', 14, 16, 9, 8);
      ellipse(g, '#d87a5a', 12, 13, 3, 2);
    },
    ogre_tusk(g) {
      g.strokeStyle = '#f0e6c0';
      g.lineWidth = 6;
      g.beginPath();
      g.arc(10, 22, 15, -Math.PI / 2, 0.1);
      g.stroke();
      rect(g, '#a08a5a', 6, 5, 6, 5);
    },
    fish(g) {
      poly(g, '#5a8ab0', [4, 16, 10, 10, 22, 11, 27, 16, 22, 21, 10, 22]);
      poly(g, '#4a7090', [26, 16, 31, 10, 31, 22]);
      rect(g, '#111', 9, 14, 2, 2);
      line(g, '#3a6080', 1, 14, 12, 14, 20);
    },
    ring_life: g => ring(g, '#d0a030', '#e04a5a'),
    ring_swift: g => ring(g, '#c0c0c8', '#6ad0ff'),
    amulet_guard: g => amulet(g, '#3a6ad0'),
    amulet_keeping: g => amulet(g, '#e0c040'),
    blank_rune: g => rune(g, null),
    rune_missile: g => rune(g, () => ellipse(g, '#b070ff', 16, 16, 4, 4)),
    rune_fireball: g => rune(g, () => { ellipse(g, '#ff6a10', 16, 16, 6, 6); ellipse(g, '#ffd040', 16, 16, 3, 3); }),
    rune_heal: g => rune(g, () => { rect(g, '#40c040', 14, 9, 4, 14); rect(g, '#40c040', 9, 14, 14, 4); }),
    rune_poison_field: g => rune(g, () => rect(g, '#7ad040', 10, 10, 12, 12)),
    rune_fire_field: g => rune(g, () => rect(g, '#ff7a1a', 10, 10, 12, 12)),
    rune_energy_field: g => rune(g, () => rect(g, '#c58cff', 10, 10, 12, 12)),
    rune_magic_wall: g => rune(g, () => { for (const x of [10, 15, 20]) rect(g, '#4a8af0', x, 9, 3, 14); }),
    rune_paralyze: g => rune(g, () => { line(g, '#5a5a5a', 1.5, 9, 9, 23, 23); line(g, '#5a5a5a', 1.5, 23, 9, 9, 23); line(g, '#5a5a5a', 1.5, 16, 8, 16, 24); }),
    rope(g) {
      g.strokeStyle = '#c8a46a';
      g.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.ellipse(16, 17, 11 - i * 3, 8 - i * 2, 0, 0, Math.PI * 2);
        g.stroke();
      }
      rect(g, '#a8844a', 22, 22, 6, 3);
    },
    shovel(g) {
      diagonal(g, () => { rect(g, '#7a5a3a', -1.5, -14, 3, 20); rect(g, '#9a9aa2', -5, 5, 10, 9); rect(g, '#5a3a1a', -4, -15, 8, 3); });
    },
    ember_seal(g) {
      line(g, '#c8a040', 1, 9, 4, 16, 12, 23, 4); // the chain
      ellipse(g, '#7a5a20', 16, 19, 8, 8);
      ellipse(g, '#d8b050', 16, 19, 7, 7);
      ellipse(g, '#a02a08', 16, 19, 4.5, 4.5);
      ellipse(g, '#ff7a1a', 16, 19, 3, 3);
      ellipse(g, '#ffe080', 15, 18, 1.2, 1.2);
    },
    ore_rough: g => ore(g, '#8a8580', '#c8c4bc'),
    ore_iron: g => ore(g, '#3c8a3c', '#8fe08f'),
    ore_mithril: g => ore(g, '#2c5cb8', '#9cc4ff'),
    ore_starsteel: g => ore(g, '#7a34c0', '#d8a8ff'),
    ore_sunsteel: g => ore(g, '#d07a10', '#ffe08a'),
    pick(g) {
      diagonal(g, () => { rect(g, '#7a5a3a', -1.5, -10, 3, 24); poly(g, '#9a9aa2', [-13, -9, 0, -14, 13, -9, 12, -7, 0, -11, -12, -7]); });
    },
    fishing_rod(g) {
      line(g, '#8a5a2a', 2, 6, 28, 26, 4);
      line(g, '#dddddd', 0.8, 26, 4, 26, 20);
      rect(g, '#c03030', 25, 20, 3, 3);
    },
    key_bronze: g => key(g, '#c0803a'),
    key_silver: g => key(g, '#c8c8d0'),
    book_lore: g => book(g, '#6a3a1a'),
    book_guide: g => book(g, '#2a5a3a'),
    kit_table: g => kit(g, '#9a6633'),
    kit_chair: g => kit(g, '#8a5a2a'),
    kit_plant: g => kit(g, '#3a8a35'),
    kit_bed: g => kit(g, '#b03a3a'),
    crab_claw(g) {
      poly(g, '#d0502a', [6, 26, 10, 12, 20, 6, 27, 10, 18, 14, 22, 18, 14, 18]);
      poly(g, '#e87040', [10, 12, 20, 6, 22, 9, 13, 14]);
    },
    pearl(g) {
      ellipse(g, '#e8e4f0', 16, 17, 7, 7);
      ellipse(g, '#ffffff', 13, 14, 2, 2);
      ellipse(g, 'rgba(160,140,200,0.4)', 18, 20, 4, 3);
    },
    old_boot(g) {
      rect(g, '#5a4a3a', 10, 6, 9, 16);
      rect(g, '#5a4a3a', 10, 19, 15, 7);
      rect(g, '#3a2a1a', 10, 25, 15, 2);
      rect(g, '#7a6a5a', 12, 9, 3, 2);
    },
    sea_chart(g) {
      rect(g, '#e8dcb0', 5, 7, 22, 18);
      rect(g, '#7ab0e0', 8, 10, 16, 12);
      poly(g, '#d8c690', [12, 14, 17, 12, 19, 17, 13, 19]);
      line(g, '#c03030', 1, 9, 20, 21, 12);
      rect(g, '#c03030', 20, 11, 2, 2);
    },
    parcel(g) {
      shadow(g, 16, 27, 12, 3);
      rect(g, '#c8a46a', 5, 9, 22, 17);
      rect(g, '#a8844a', 5, 9, 22, 3);
      rect(g, '#6a3a1a', 15, 9, 2, 17);
      rect(g, '#6a3a1a', 5, 17, 22, 2);
    },
  };

  // --- creatures: draw(g, dir, frame) where frame 0 = standing, 1/2 = walking -------
  // People (players, NPCs and humanoid monsters) are drawn from a look: colours plus
  // what they wear, see person() below. A player's look comes from their outfit: its
  // type and cut, its four colours (head, primary, secondary, detail) and addons.
  const DEFAULT_OUTFIT = { hair: '#6b3e1a', body: '#2e6fd0', legs: '#2b3a67', feet: '#3a2a1a' };
  const rgbOf = c => {
    if (c[0] === '#') {
      const n = parseInt(c.length === 4 ? c.slice(1).replace(/./g, x => x + x) : c.slice(1), 16);
      return [n >> 16, (n >> 8) & 255, n & 255];
    }
    return (c.match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number);
  };
  // Lighter (f > 1, towards white) or darker (f < 1) shade of a colour.
  const shade = (c, f) => `rgb(${rgbOf(c).map(v => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f)))).join(',')})`;
  const withDefaults = outfit => {
    const o = { ...DEFAULT_OUTFIT, type: '', female: false, addons: 0 };
    for (const k in outfit) if (outfit[k] !== undefined && outfit[k] !== null && outfit[k] !== '') o[k] = outfit[k];
    return o;
  };
  const LEATHER = '#6a4422', STEEL = '#a8aeb8', GOLD = '#e0b840';
  function playerLook(vocation, outfit) {
    const o = withDefaults(outfit), type = OUTFITS[o.type] ? o.type : VOCATION_OUTFIT[vocation] || 'citizen';
    const head = o.hair, primary = o.body, secondary = o.legs, detail = o.feet, female = !!o.female;
    const a1 = o.addons & 1, a2 = o.addons & 2;
    const look = {
      skin: '#f0c090', hair: head, hairStyle: female ? 'long' : 'short', female,
      body: primary, arms: primary, legs: secondary, feet: detail, belt: shade(detail, 0.75),
    };
    if (type === 'citizen') {
      Object.assign(look, { collar: shade(primary, 1.35), skirt: female ? secondary : null, legs: female ? shade(secondary, 0.55) : secondary });
      if (a1) look.hat = { style: 'feather', color: shade(primary, 0.7), accent: '#f4f0e8' };
      if (a2) look.backpack = '#7a5230';
    } else if (type === 'hunter') {
      Object.assign(look, { strap: LEATHER, quiver: true, cuffs: shade(detail, 0.9), hairStyle: female ? 'ponytail' : 'short' });
      if (a1) look.hat = { style: 'hunter', color: shade(primary, 0.8), accent: detail };
      if (a2) look.held = 'crossbow';
    } else if (type === 'mage') {
      Object.assign(look, { robe: true, trim: secondary, cuffs: secondary, sash: detail, belt: null });
      if (a1) look.hat = { style: 'pointy', color: shade(primary, 0.8), accent: detail };
      if (a2) look.held = 'staff';
    } else if (type === 'knight') {
      Object.assign(look, { armor: STEEL, arms: STEEL, tabard: primary, legs: shade(secondary, 0.9), cuffs: STEEL, hairStyle: female ? 'ponytail' : 'short' });
      if (a1) look.hat = { style: 'plume', color: STEEL, accent: detail };
      if (a2) Object.assign(look, { held: 'sword', shield: secondary });
    } else if (type === 'noble') {
      Object.assign(look, { collar: '#f4f0e8', buttons: GOLD, coat: !female, robe: female, trim: GOLD, cuffs: '#f4f0e8' });
      if (a1) look.hat = { style: 'wide', color: shade(primary, 0.75), accent: detail };
      if (a2) look.cape = secondary;
    } else if (type === 'barbarian') {
      Object.assign(look, { arms: look.skin, bareArms: true, fur: true, hairStyle: female ? 'braids' : 'wild', belt: LEATHER, cuffs: shade(detail, 1.2) });
      if (a1) look.hat = { style: 'horned', color: STEEL, accent: '#ece0c4' };
      if (a2) look.held = 'greataxe';
    } else if (type === 'druid') {
      Object.assign(look, { robe: true, leaves: secondary, trim: shade(secondary, 0.8), belt: detail, cuffs: shade(primary, 0.8) });
      if (a1) look.hat = { style: 'antlers', color: '#d8c4a0', accent: '#4a9a3a' };
      if (a2) look.held = 'leafstaff';
    } else if (type === 'pirate') {
      Object.assign(look, { body: '#f0ece0', arms: '#f0ece0', stripes: primary, vest: secondary, legs: shade(secondary, 0.6), hairStyle: female ? 'long' : 'short' });
      look.hat = a1 ? { style: 'tricorn', color: '#2a2422', accent: GOLD } : { style: 'bandana', color: detail };
      if (a2) look.held = 'sabre';
    }
    return look;
  }
  const MONSTER_LOOKS = {
    skeleton: { skin: '#e6e2d3', hair: '#e6e2d3', eye: '#111', body: '#d6d1c0', belt: '#8a8574', legs: '#d0cbb9', arms: '#d0cbb9', ribs: '#8a8574' },
    goblin: { scale: 0.8, skin: '#6aa040', hair: '#6aa040', eye: '#e0d020', body: '#7a5a3a', belt: '#3a2a1a', legs: '#5a4a2a', arms: '#6aa040', held: 'axe' },
    gnarl: { scale: 1.3, skin: '#4a6a3a', hair: '#4a6a3a', eye: '#e04040', body: '#5a4a3a', belt: '#2a2a1a', legs: '#3a3a2a', arms: '#4a6a3a', held: 'club' },
    orc: { skin: '#7a9a5a', hair: '#2a2a1a', eye: '#e04040', body: '#6a5a3a', belt: '#2a1a0a', legs: '#4a3a2a', arms: '#7a9a5a', held: 'axe' },
    orc_archer: { skin: '#7a9a5a', hair: '#2a2a1a', eye: '#e04040', body: '#5a6a3a', belt: '#2a1a0a', legs: '#4a3a2a', arms: '#7a9a5a', hat: { style: 'hood', color: '#4a5a2a' }, held: 'bow' },
    bandit: { skin: '#e0b088', hair: '#2a1a0a', body: '#4a3a3a', belt: '#6a4a2a', legs: '#2a2a2a', arms: '#4a3a3a', hat: { style: 'hood', color: '#2a2a2a' }, held: 'sword' },
    ogre: { scale: 1.35, skin: '#c09a6a', hair: '#5a3a1a', body: '#7a5a3a', belt: '#3a2a1a', legs: '#5a4a3a', arms: '#c09a6a', held: 'club' },
    dark_mage: { skin: '#c8b8a8', eye: '#e03030', body: '#2a1a3a', belt: '#8a2a2a', legs: '#2a1a3a', arms: '#2a1a3a', robe: true, hat: { style: 'hood', color: '#1a0f26' }, held: 'staff' },
    pirate: { skin: '#d8a070', hair: '#2a1a0a', beard: '#2a1a0a', body: '#e8e0d0', belt: '#8a2a2a', legs: '#2a2a3a', feet: '#1a1a1a', arms: '#d8a070', hat: { style: 'bandana', color: '#b02a2a' }, held: 'sword' },
    orc_shaman: { skin: '#7a9a5a', hair: '#2a2a1a', eye: '#e0d020', body: '#5a3a5a', belt: '#c0a040', legs: '#5a3a5a', arms: '#7a9a5a', robe: true, hat: { style: 'hood', color: '#3a2a3a' }, held: 'staff' },
    cyclops: { scale: 1.5, skin: '#b8906a', hair: '#4a3018', eye: '#5a2a10', oneEye: true, body: '#b8906a', belt: '#6a4a22', legs: '#7a5a32', arms: '#b8906a', held: 'club' },
    kenny: { scale: 0.8, skin: '#f0c8a0', hair: '#f07820', body: '#f07820', belt: '#d06010', legs: '#7a4a2a', feet: '#2a2a2a', arms: '#f07820', hat: { style: 'hood', color: '#f07820' } },
    bandit_chief: { scale: 1.2, skin: '#e0b088', hair: '#5a1a0a', beard: '#5a1a0a', body: '#5a2a2a', belt: '#d0a030', legs: '#2a2a2a', arms: '#5a2a2a', hat: { style: 'hood', color: '#8a1a1a' }, held: 'sword' },
    orc_warlord: { scale: 1.35, skin: '#6a8a4a', hair: '#1a1a0a', eye: '#ff3020', body: '#4a4a52', belt: '#8a1a1a', legs: '#3a3a42', arms: '#6a8a4a', hat: { style: 'helmet', color: '#5a5a62' }, horns: '#e8dcc0', held: 'axe' },
    troll_king: { scale: 1.35, skin: '#5a7a3a', hair: '#3a4a1e', eye: '#e0d020', body: '#4a3a22', belt: '#d0a030', legs: '#3a3a22', arms: '#5a7a3a', hat: { style: 'crown', color: '#c0a040' }, held: 'club' },
    nomad_sheik: { scale: 1.2, skin: '#b07850', hair: '#1a1a1a', beard: '#1a1a1a', body: '#e8dcc0', belt: '#d0a030', legs: '#e8dcc0', arms: '#b07850', robe: true, hat: { style: 'hood', color: '#d0a030' }, held: 'sword' },
    yeti_elder: { scale: 1.65, skin: '#f4f8fc', hair: '#dce8f4', eye: '#2a4aa0', beard: '#dce8f4', body: '#e8eef4', belt: '#c4ccd8', legs: '#e8eef4', arms: '#f4f8fc' },
    lizard_chieftain: { scale: 1.4, skin: '#2a6a2a', hair: '#1a4a1a', eye: '#ff3020', body: '#8a6a2a', belt: '#d0a030', legs: '#2a5a2a', arms: '#2a6a2a', tail: '#2a6a2a', hat: { style: 'crown', color: '#d0a030' }, held: 'axe' },
    yeti: { scale: 1.4, skin: '#e8eef4', hair: '#e8eef4', eye: '#3a6aa0', body: '#dce4ec', belt: '#c4ccd8', legs: '#dce4ec', arms: '#e8eef4' },
    stone_golem: { scale: 1.45, skin: '#7a7a80', hair: '#6a6a70', eye: '#40e0ff', body: '#6a6a70', belt: '#5a5a60', legs: '#5e5e64', arms: '#7a7a80' },
    minotaur: { scale: 1.2, skin: '#7a4a2a', hair: '#5a3418', eye: '#e03020', body: '#7a4a2a', belt: '#3a2a1a', legs: '#5a3a1e', arms: '#7a4a2a', horns: '#e8dcc0', held: 'axe' },
    minotaur_mage: { scale: 1.15, skin: '#7a4a2a', hair: '#5a3418', eye: '#e03020', body: '#3a2a5a', belt: '#c0a040', legs: '#3a2a5a', arms: '#7a4a2a', horns: '#e8dcc0', robe: true, held: 'staff' },
    nomad: { skin: '#c89060', hair: '#2a1a0a', body: '#d8c8a0', belt: '#8a2a2a', legs: '#c8b890', arms: '#c89060', hat: { style: 'hood', color: '#e8dcc0' }, held: 'sword' },
    mummy: { skin: '#c8bc98', hair: '#c8bc98', eye: '#30ff60', body: '#d8ccaa', belt: '#a8987a', legs: '#d0c4a2', arms: '#c8bc98', wraps: '#a8987a' },
    sand_king: { scale: 1.45, skin: '#c8bc98', hair: '#c8bc98', eye: '#30ff60', body: '#d8ccaa', belt: '#d0a030', legs: '#d0c4a2', arms: '#c8bc98', wraps: '#a8987a', hat: { style: 'crown', color: '#e0b030' }, held: 'staff' },
    swamp_troll: { scale: 1.05, skin: '#5a7a3a', hair: '#3a4a1e', eye: '#e0d020', body: '#4a3a22', belt: '#2a2a1a', legs: '#3a3a22', arms: '#5a7a3a', held: 'club' },
    witch: { skin: '#a8c890', hair: '#2a2a2a', eye: '#e03020', body: '#2a2a2a', belt: '#8a3aaa', legs: '#2a2a2a', arms: '#2a2a2a', robe: true, hat: { style: 'pointy', color: '#2a2a2a' }, held: 'staff' },
    lizard_warrior: { scale: 1.15, skin: '#3a7a3a', hair: '#2a5a2a', eye: '#e0d020', body: '#6a5a3a', belt: '#3a2a1a', legs: '#2f6a2f', arms: '#3a7a3a', tail: '#3a7a3a', held: 'sword' },
    lizard_priest: { scale: 1.1, skin: '#3a7a3a', hair: '#2a5a2a', eye: '#e0d020', body: '#5a2a5a', belt: '#d0a030', legs: '#5a2a5a', arms: '#3a7a3a', tail: '#3a7a3a', robe: true, held: 'staff' },
    serpent_lord: { scale: 1.5, skin: '#2a6a5a', hair: '#1a4a3a', eye: '#ff3030', body: '#1a3a3a', belt: '#d0a030', legs: '#1a3a3a', arms: '#2a6a5a', tail: '#2a6a5a', robe: true, hat: { style: 'crown', color: '#d0a030' }, held: 'staff' },
    ashen_lord: { scale: 1.9, skin: '#3a302c', hair: '#140c0a', eye: '#ff7a10', body: '#241816', belt: '#ff5a10', legs: '#1c1210', arms: '#3a302c', horns: '#d06020', wings: '#2a0806', held: 'axe' },
    demon: { scale: 1.6, skin: '#a82020', hair: '#5a0a0a', eye: '#ffd020', body: '#8a1818', belt: '#3a0a0a', legs: '#6a1010', arms: '#a82020', horns: '#2a1a1a', wings: '#4a0a0a', held: 'axe' },
    drowned_king: { scale: 1.4, skin: '#5a8a8a', hair: '#2a4a4a', eye: '#a0ffff', beard: '#3a6a6a', body: '#2a4a5a', belt: '#c0a040', legs: '#1a3a4a', arms: '#5a8a8a', hat: { style: 'crown', color: '#d0b030' }, held: 'staff' },
  };

  // People get a dark outline, so they stand out from the ground as in the classic games.
  function outlined(g, draw) {
    const { width, height } = g.canvas;
    const layer = document.createElement('canvas'), edge = document.createElement('canvas');
    layer.width = edge.width = width;
    layer.height = edge.height = height;
    const f = layer.getContext('2d');
    f.setTransform(g.getTransform());
    draw(f);
    const e = edge.getContext('2d');
    e.drawImage(layer, 0, 0);
    e.globalCompositeOperation = 'source-in';
    e.fillStyle = 'rgba(18,12,8,0.78)';
    e.fillRect(0, 0, width, height);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.drawImage(edge, dx, dy);
    g.drawImage(layer, 0, 0);
    g.restore();
  }

  function humanoid(g, p, dir, frame) {
    const s = p.scale || 1;
    if (s !== 1) {
      g.translate(16, 30);
      g.scale(s, s);
      g.translate(-16, -30);
    }
    if (p.hat && ['pointy', 'wide', 'plume', 'antlers', 'horned'].includes(p.hat.style)) g.translate(0, 2); // room for tall hats
    shadow(g, 16, 29, 8, 3);
    outlined(g, f => {
      if (dir === 3) { // facing west: the east view, mirrored
        f.translate(32, 0);
        f.scale(-1, 1);
      }
      person(f, p, dir === 3 ? 1 : dir, frame);
    });
  }

  // One person, facing north (0, their back), east (1, side) or south (2, front).
  // The light comes from the top-left: lit left edges, shaded right edges.
  function person(g, p, dir, frame) {
    const R = (c, x, y, w, h) => rect(g, c, x, y, w, h);
    const front = dir === 2, back = dir === 0, side = dir === 1;
    const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    const skin = p.skin, hair = p.hair || p.skin, hs = p.hairStyle || 'short';
    const body = p.body, arms = p.arms || body, legs = p.legs || body, feet = p.feet || shade(legs, 0.6);
    const lit = c => shade(c, 1.2), dim = c => shade(c, 0.76), deep = c => shade(c, 0.55);
    const long = p.robe; // robes and dresses reach the feet
    const tx = side ? 13 : 11, tw = side ? 7 : 10; // the torso

    // ---- behind the body
    if (p.wings) {
      const f = frame === 1 ? -2 : frame === 2 ? 2 : 0;
      poly(g, p.wings, [12, 13, -2, 2 + f, 0, 12 + f, -3, 20 + f, 11, 18]);
      poly(g, p.wings, [20, 13, 34, 2 + f, 32, 12 + f, 35, 20 + f, 21, 18]);
    }
    if (p.tail && !front) line(g, p.tail, 3, 16, 22, side ? 6 : 16, side ? 27 : 30);
    if (p.cape && !back) {
      if (side) poly(g, p.cape, [12, 12, 15, 12, 13, 27, 8 - step, 27]);
      else { R(p.cape, 9, 13, 14, 13); R(dim(p.cape), 9, 24, 14, 2); }
    }
    if (side && p.backpack) { R(p.backpack, 10, 13, 4, 8); R(lit(p.backpack), 10, 13, 4, 1); }
    if (side && p.quiver) { R(LEATHER, 10, 10, 3, 11); R('#e8e0d0', 10, 8, 1, 2); R('#c03030', 12, 8, 1, 2); }
    if (back && p.held) held(p.held, 7, 18 - step, true);

    // ---- legs and feet
    if (!long) {
      if (side) {
        for (const [o, far] of [[-step, true], [step, false]]) {
          const x = 15 + o * 2, c = far ? dim(legs) : legs;
          R(c, x, 21, 3, 6);
          R(far ? dim(feet) : feet, x, 26, 4, 3);
          R(deep(feet), x, 28, 4, 1);
          if (!far) R(lit(feet), x, 26, 4, 1);
        }
      } else {
        [[12, step > 0 ? 2 : 0], [17, step < 0 ? 2 : 0]].forEach(([x, lift]) => {
          R(legs, x, 21, 3, 7 - lift);
          R(dim(legs), x + 2, 21, 1, 7 - lift);
          R(feet, x, 26 - lift, 3, 3);
          R(lit(feet), x, 26 - lift, 3, 1);
          R(deep(feet), x, 28 - lift, 3, 1);
        });
      }
    }

    // ---- the body
    if (long) {
      poly(g, body, side ? [13, 12, 20, 12, 21, 28, 12, 28] : [11, 12, 21, 12, 23, 28, 9, 28]);
      poly(g, dim(body), side ? [18, 12, 20, 12, 21, 28, 18, 28] : [19, 12, 21, 12, 23, 28, 20, 28]);
      R(lit(body), side ? 13 : 11, 12, 1, 8);
      if (front) R(dim(body), 16, 21, 1, 7); // a fold
      if (p.trim) R(p.trim, side ? 12 : 9, 26, side ? 10 : 15, 2);
      R(feet, side ? 19 + step : 12, 28, 3, 1);
      if (!side) R(feet, 17, 28, 3, 1);
    } else {
      R(body, tx, 12, tw, 9);
      if (p.female && !side) { R(dim(body), 11, 17, 1, 3); R(dim(body), 20, 17, 1, 3); } // a waist
      R(lit(body), tx, 12, 1, 9);
      R(dim(body), tx + tw - 2, 12, 2, 9);
      if (p.coat) { R(body, tx, 20, tw, 4); R(dim(body), tx + tw - 2, 20, 2, 4); if (front) R(dim(body), 16, 19, 1, 5); }
      if (p.skirt) {
        poly(g, p.skirt, side ? [13, 19, 20, 19, 22, 25, 12, 25] : [11, 19, 21, 19, 23, 25, 9, 25]);
        poly(g, dim(p.skirt), side ? [18, 19, 20, 19, 22, 25, 19, 25] : [19, 19, 21, 19, 23, 25, 20, 25]);
      }
    }
    if (p.stripes) for (let y = 13; y < 20; y += 2) R(p.stripes, tx, y, tw, 1);
    if (p.armor) {
      R(p.armor, tx, 12, tw, 6);
      R(lit(p.armor), tx, 12, tw, 1);
      R(dim(p.armor), tx + tw - 2, 12, 2, 6);
      if (front) R(dim(p.armor), 15, 14, 2, 1);
    }
    if (p.tabard && !side) {
      R(p.tabard, 13, 14, 6, 10);
      R(dim(p.tabard), 17, 14, 2, 10);
      if (front) { R(lit(p.tabard), 15, 16, 2, 4); R(lit(p.tabard), 14, 17, 4, 1); } // a cross
    } else if (p.tabard) R(p.tabard, 15, 14, 3, 10);
    if (p.vest) {
      if (front) { R(p.vest, 11, 12, 3, 9); R(p.vest, 18, 12, 3, 9); R(dim(p.vest), 20, 12, 1, 9); }
      else R(p.vest, side ? 13 : 11, 12, side ? 5 : 10, 9);
    }
    if (p.fur) {
      for (let x = tx; x < tx + tw; x += 2) { R(lit(body), x, 12, 1, 1); R(dim(body), x + 1, 20, 1, 2); }
      R(lit(body), tx, 14, 1, 1);
    }
    if (p.leaves) for (const [x, y] of [[12, 15], [18, 17], [14, 21], [20, 24], [11, 25], [16, 18], [13, 13]]) if (!side || (x > 12 && x < 21)) { R(p.leaves, x, y, 2, 1); R(dim(p.leaves), x + 1, y + 1, 1, 1); }
    if (p.ribs) for (let y = 14; y < 20; y += 2) R(p.ribs, side ? 14 : 12, y, side ? 5 : 8, 1);
    if (front && p.collar) { R(p.collar, 13, 12, 6, 2); R(skin, 15, 12, 2, 1); }
    else if (front && !p.armor && !p.robe) R(skin, 15, 12, 2, 2);
    if (front && p.buttons) for (const y of [14, 16, 18]) R(p.buttons, 16, y, 1, 1);
    if (front && p.sash) line(g, p.sash, 2, 12, 13, 20, 21);
    if (p.strap && front) line(g, p.strap, 2, 12, 12, 20, 20);
    if (p.strap && back) line(g, p.strap, 2, 20, 12, 12, 20);
    if (p.belt) {
      R(p.belt, tx, long ? 18 : 19, tw, 2);
      if (front) R(GOLD, 15, long ? 18 : 19, 2, 2);
    }

    // ---- arms and hands
    const sleeve = p.armor ? p.armor : arms;
    if (side) {
      R(sleeve, 15, 13, 3, 3);
      R(sleeve, 15 + step, 16, 3, 2);
      R(p.bareArms ? skin : p.cuffs || sleeve, 15 + 2 * step, 18, 3, 1);
      R(skin, 15 + 2 * step, 19, 3, 2);
      R(dim(skin), 15 + 2 * step, 20, 3, 1);
      if (p.armor) R(lit(p.armor), 15, 12, 4, 2);
    } else {
      [[8, step, true], [21, -step, false]].forEach(([x, o, left]) => {
        R(sleeve, x, 13 + o, 3, 5);
        R(left ? lit(sleeve) : dim(sleeve), left ? x : x + 2, 13 + o, 1, 5);
        R(p.bareArms ? skin : p.cuffs || sleeve, x, 18 + o, 3, 1);
        R(skin, x, 19 + o, 3, 2);
        R(dim(skin), x, 20 + o, 3, 1);
        if (p.armor) { ellipse(g, p.armor, x + 1.5, 13.5 + o, 3, 2); R(lit(p.armor), x, 12 + o, 3, 1); }
      });
    }

    // ---- on the back, seen from behind
    if (back) {
      if (p.backpack) { R(p.backpack, 12, 13, 8, 8); R(lit(p.backpack), 12, 13, 8, 2); R(dim(p.backpack), 18, 13, 2, 8); R(GOLD, 15, 16, 2, 1); }
      if (p.quiver) { R(LEATHER, 17, 11, 3, 10); R(dim(LEATHER), 19, 11, 1, 10); R('#e8e0d0', 17, 9, 1, 2); R('#c03030', 19, 9, 1, 2); }
      if (p.cape) { poly(g, p.cape, [10, 12, 22, 12, 24, 27, 8, 27]); poly(g, dim(p.cape), [18, 12, 22, 12, 24, 27, 19, 27]); }
    } else if (front && p.backpack) { R(dim(p.backpack), 12, 12, 1, 7); R(dim(p.backpack), 19, 12, 1, 7); }
    if (p.wraps) for (let y = 3; y < 28; y += 3) R(p.wraps, side ? 12 : 9, y, side ? 10 : 14, 1);

    // seen from the side, a weapon is held in front of the body but behind the head
    if (p.held && side) held(p.held, 15 + 2 * step, 18, false);

    // ---- the head
    const brow = shade(hair, 0.75);
    if (front) {
      R(skin, 14, 11, 4, 2);
      R(skin, 12, 2, 8, 10);
      R(skin, 11, 3, 10, 8);
      R(dim(skin), 19, 3, 2, 8);
      R(dim(skin), 12, 11, 8, 1);
      R(dim(skin), 10, 6, 1, 3);
      R(dim(skin), 21, 6, 1, 3);
      if (p.oneEye) {
        R('#f4f0e0', 14, 5, 4, 3);
        R(p.eye || '#222', 15, 5, 2, 3);
      } else if (p.bigEyes) {
        for (const ex of [12, 17]) { R('#f4f0e0', ex, 4, 4, 4); R(p.eye || '#222', ex + 1, 5, 2, 2); }
      } else {
        for (const ex of [13, 17]) {
          R(p.eye || '#1e1410', ex, 6, 2, 2);
          if (!p.eye) R('#ffffff', ex, 6, 1, 1);
          R(brow, ex, 5, 2, 1);
        }
        R(shade(skin, 0.85), 16, 7, 1, 2);
        R(p.female ? '#c05858' : shade(skin, 0.6), 15, 10, 2, 1);
        if (p.female) { R('rgba(230,110,110,0.35)', 12, 9, 1, 1); R('rgba(230,110,110,0.35)', 19, 9, 1, 1); }
      }
      if (p.beard) { R(p.beard, 12, 9, 8, 3); R(p.beard, 11, 7, 1, 4); R(p.beard, 20, 7, 1, 4); R(deep(p.beard), 15, 10, 2, 1); }
      if (hs !== 'bald') {
        R(hair, 12, 1, 8, 1);
        R(hair, 11, 2, 10, 2);
        R(hair, 11, 4, 1, 3);
        R(hair, 20, 4, 1, 3);
        R(hair, 12, 4, 3, 1);
        R(lit(hair), 13, 1, 4, 1);
        R(lit(hair), 12, 2, 2, 1);
        if (hs === 'long' || hs === 'braids') { R(hair, 10, 4, 2, 9); R(hair, 20, 4, 2, 9); R(dim(hair), 21, 5, 1, 8); }
        if (hs === 'braids') { R(hair, 10, 13, 2, 4); R(hair, 20, 13, 2, 4); R('#c03030', 10, 16, 2, 1); R('#c03030', 20, 16, 2, 1); }
        if (hs === 'wild') { R(hair, 11, 0, 2, 1); R(hair, 14, 0, 2, 1); R(hair, 18, 0, 2, 1); R(hair, 10, 3, 1, 6); R(hair, 21, 3, 1, 6); }
      }
    } else if (back) {
      R(skin, 14, 11, 4, 2);
      R(dim(skin), 10, 6, 1, 3);
      R(dim(skin), 21, 6, 1, 3);
      const top = hs === 'bald' ? skin : hair;
      R(top, 12, 1, 8, 10);
      R(top, 11, 2, 10, 8);
      R(lit(top), 13, 2, 3, 2);
      R(dim(top), 19, 3, 2, 7);
      if (hs === 'long') { R(hair, 11, 10, 10, 5); R(dim(hair), 19, 10, 2, 5); }
      if (hs === 'ponytail') { R(hair, 15, 10, 2, 6); R('#c03030', 15, 11, 2, 1); }
      if (hs === 'braids') { R(hair, 12, 10, 2, 7); R(hair, 18, 10, 2, 7); }
      if (hs === 'wild') { R(hair, 11, 0, 2, 1); R(hair, 15, 0, 2, 1); R(hair, 10, 3, 1, 7); R(hair, 21, 3, 1, 7); R(hair, 12, 10, 8, 2); }
    } else {
      R(skin, 15, 11, 3, 2);
      R(skin, 14, 2, 6, 10);
      R(skin, 13, 3, 8, 8);
      R(skin, 21, 7, 1, 2); // the nose
      R(dim(skin), 14, 11, 6, 1);
      R(dim(skin), 15, 6, 2, 3); // the ear
      if (p.oneEye) { R('#f4f0e0', 17, 5, 3, 3); R(p.eye || '#222', 19, 5, 1, 3); }
      else if (p.bigEyes) { R('#f4f0e0', 17, 4, 4, 4); R(p.eye || '#222', 19, 5, 2, 2); }
      else {
        R(p.eye || '#1e1410', 18, 6, 2, 2);
        if (!p.eye) R('#ffffff', 18, 6, 1, 1);
        R(brow, 18, 5, 2, 1);
        R(p.female ? '#c05858' : shade(skin, 0.6), 19, 10, 2, 1);
      }
      if (p.beard) { R(p.beard, 16, 9, 5, 3); R(p.beard, 15, 7, 1, 4); }
      if (hs !== 'bald') {
        R(hair, 13, 1, 7, 2);
        R(hair, 12, 2, 4, 7);
        R(hair, 19, 3, 2, 1);
        R(lit(hair), 14, 1, 3, 1);
        R(dim(hair), 12, 6, 1, 3);
        if (hs === 'long') R(hair, 11, 3, 4, 11);
        if (hs === 'ponytail') { R(hair, 10, 5, 2, 8); R('#c03030', 10, 6, 2, 1); }
        if (hs === 'braids') R(hair, 12, 9, 2, 8);
        if (hs === 'wild') { R(hair, 12, 0, 2, 1); R(hair, 16, 0, 2, 1); R(hair, 11, 2, 1, 8); }
      }
    }
    if (p.ears) {
      if (side) poly(g, skin, [15, 5, 9, 1, 14, 9]);
      else {
        poly(g, skin, [11, 5, 3, 1, 11, 9]);
        poly(g, skin, [21, 5, 29, 1, 21, 9]);
      }
    }
    if (p.horns) {
      if (!side) poly(g, p.horns, [11, 4, 6, 0, 7, -4, 10, 1]);
      poly(g, p.horns, [21, 4, 26, 0, 25, -4, 22, 1]);
    }
    if (p.hat) {
      g.save();
      if (side) g.translate(1, 0);
      hat(p.hat);
      g.restore();
    }

    // ---- in the hands
    if (p.held && front) held(p.held, 21, 19 - step, false);
    if (p.shield && front) { poly(g, p.shield, [5, 14, 11, 14, 11, 21, 8, 25, 5, 21]); R(lit(p.shield), 5, 14, 6, 1); R(GOLD, 7, 17, 2, 3); }
    if (p.shield && side) { R(p.shield, 12, 14, 2, 9); R(dim(p.shield), 13, 14, 1, 9); }

    function hat(h) {
      const c = h.color, a = h.accent || shade(c, 0.6);
      const helmet = () => {
        R(c, 10, 1, 12, 5);
        R(lit(c), 11, 1, 4, 1);
        R(dim(c), 10, 5, 12, 1);
        R(dim(c), 19, 2, 3, 3);
        if (back) R(c, 10, 1, 12, 9);
        if (side) R(c, 11, 1, 4, 8);
      };
      if (h.style === 'helmet') { helmet(); if (front) R(dim(c), 15, 5, 2, 3); }
      else if (h.style === 'plume') {
        helmet();
        if (front) R(dim(c), 15, 5, 2, 3);
        if (side) poly(g, a, [14, 1, 8, 1, 6, 7, 12, 3]);
        else { R(a, 14, -2, 4, 3); R(lit(a), 14, -2, 2, 1); R(a, 15, 1, 2, 1); }
      } else if (h.style === 'horned') {
        helmet();
        poly(g, a, [11, 3, 5, 0, 5, -3, 10, 1]);
        poly(g, a, [21, 3, 27, 0, 27, -3, 22, 1]);
      } else if (h.style === 'hood') {
        R(c, 10, 1, 12, 3);
        if (back) R(c, 10, 1, 12, 11);
        else if (front) { R(c, 10, 1, 2, 11); R(c, 20, 1, 2, 11); }
        else R(c, 10, 1, 5, 11);
      } else if (h.style === 'pointy') {
        R(c, 8, 3, 16, 2);
        R(dim(c), 8, 4, 16, 1);
        poly(g, c, [11, 3, 21, 3, 17, -2]);
        poly(g, dim(c), [17, -2, 21, 0, 18, 0]);
        R(a, 11, 2, 10, 1);
      } else if (h.style === 'feather') {
        R(c, 11, 1, 10, 3);
        R(c, 10, 2, 12, 2);
        R(lit(c), 12, 1, 4, 1);
        poly(g, a, [18, 2, 25, -2, 26, 0, 20, 3]);
      } else if (h.style === 'hunter') {
        poly(g, c, [9, 4, 23, 4, 19, -1, 12, 0]);
        R(dim(c), 9, 4, 14, 1);
        poly(g, a, [17, 1, 25, -3, 24, 0, 19, 2]);
      } else if (h.style === 'wide') {
        R(c, 7, 3, 18, 2);
        R(c, 11, -1, 10, 4);
        R(dim(c), 11, 2, 10, 1);
        R(lit(c), 12, -1, 4, 1);
        poly(g, a, [19, 0, 27, -2, 26, 2, 20, 2]);
      } else if (h.style === 'antlers') {
        R(a, 11, 2, 10, 1);
        for (const [x, y] of [[11, 1], [14, 1], [17, 1], [20, 1]]) R(shade(a, 1.2), x, y, 1, 1);
        line(g, c, 1, 12, 2, 9, -3);
        line(g, c, 1, 10, -1, 7, -1);
        line(g, c, 1, 20, 2, 23, -3);
        line(g, c, 1, 22, -1, 25, -1);
      } else if (h.style === 'tricorn') {
        poly(g, c, [8, 4, 24, 4, 22, -1, 16, 1, 10, -1]);
        R(a, 8, 4, 16, 1);
      } else if (h.style === 'bandana') {
        R(c, 10, 1, 12, 4);
        R(dim(c), 10, 4, 12, 1);
        if (back) R(c, 10, 1, 12, 6);
        if (side) R(c, 9, 3, 2, 4);
      } else if (h.style === 'crown') {
        poly(g, c, [10, 4, 10, -1, 13, 2, 16, -2, 19, 2, 22, -1, 22, 4]);
        R('#e04040', 15, 1, 2, 2);
      }
    }

    // A weapon or staff in a hand at (hx, hy) (behind the back when seen from behind).
    function held(kind, hx, hy) {
      const wood = '#6a4a2a', blade = '#d4d8e0';
      if (kind === 'sword') {
        R(blade, hx + 1, hy - 11, 2, 11);
        R('#ffffff', hx + 1, hy - 11, 1, 10);
        R(GOLD, hx - 1, hy - 1, 5, 1);
        R(wood, hx + 1, hy, 2, 2);
      } else if (kind === 'sabre') {
        line(g, blade, 2, hx + 2, hy - 1, hx + 6, hy - 11);
        line(g, '#ffffff', 1, hx + 2, hy - 2, hx + 5, hy - 10);
        R(GOLD, hx - 1, hy - 1, 5, 1);
      } else if (kind === 'axe') {
        R(wood, hx + 1, hy - 10, 2, 14);
        poly(g, '#a8a8b0', [hx + 3, hy - 10, hx + 8, hy - 11, hx + 8, hy - 4, hx + 3, hy - 5]);
      } else if (kind === 'greataxe') {
        R(wood, hx + 1, hy - 13, 2, 18);
        poly(g, '#b0b0b8', [hx + 3, hy - 13, hx + 10, hy - 15, hx + 10, hy - 4, hx + 3, hy - 6]);
        poly(g, '#909098', [hx + 1, hy - 13, hx - 5, hy - 14, hx - 5, hy - 6, hx + 1, hy - 7]);
      } else if (kind === 'club') {
        R(wood, hx + 1, hy - 8, 2, 10);
        ellipse(g, '#5a3a1a', hx + 2, hy - 9, 3, 4);
      } else if (kind === 'bow') {
        g.strokeStyle = '#7a4a1e';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(hx, hy - 3, 8, -1.2, 1.2);
        g.stroke();
        line(g, '#e8e0d0', 1, hx + 3, hy - 10, hx + 3, hy + 4);
      } else if (kind === 'crossbow') {
        R(LEATHER, hx - 3, hy - 1, 9, 3);
        R('#4a3018', hx + 4, hy - 6, 2, 12);
        line(g, '#e8e0d0', 1, hx + 5, hy - 6, hx + 1, hy);
        line(g, '#e8e0d0', 1, hx + 5, hy + 6, hx + 1, hy);
      } else if (kind === 'staff' || kind === 'leafstaff') {
        R(wood, hx + 1, hy - 16, 2, 25);
        R(shade(wood, 1.3), hx + 1, hy - 16, 1, 25);
        if (kind === 'staff') { ellipse(g, 'rgba(160,230,255,0.4)', hx + 2, hy - 17, 4, 4); ellipse(g, '#9fe8ff', hx + 2, hy - 17, 2.5, 2.5); }
        else for (const [x, y] of [[-1, -17], [3, -18], [1, -20], [4, -15], [-2, -14]]) ellipse(g, x % 2 ? '#4a9a3a' : '#6ab84a', hx + 2 + x, hy + y, 2, 1.5);
      }
    }
  }

  function rat(g, dir, frame) {
    const dx = DX[dir], dy = DY[dir], horiz = dx !== 0;
    const cx = 16, cy = 20 - (frame === 1 ? 1 : 0);
    shadow(g, 16, 26, 9, 3);
    line(g, '#d9939a', 1.5, cx - dx * 7, cy - dy * 6, cx - dx * 13 + (horiz ? 0 : 3), cy - dy * 11 + (horiz ? 3 : 0));
    ellipse(g, '#7a7068', cx, cy, horiz ? 8 : 6, horiz ? 5 : 7);
    ellipse(g, '#8d847b', cx, cy - 1, horiz ? 6 : 4, horiz ? 3 : 5);
    const hx = cx + dx * 8, hy = cy + dy * 7;
    ellipse(g, '#857b72', hx, hy, 4, 4);
    ellipse(g, '#e0a0a6', hx - dx * 2 - dy * 3, hy - dy * 2 + dx * 3 - 2, 2, 2);
    ellipse(g, '#e0a0a6', hx - dx * 2 + dy * 3, hy - dy * 2 - dx * 3 - 2, 2, 2);
    if (dir === 2) {
      rect(g, '#111', hx - 2, hy, 1, 1);
      rect(g, '#111', hx + 1, hy, 1, 1);
    } else if (horiz) {
      rect(g, '#111', hx + dx, hy - 1, 1, 1);
    }
    if (dir !== 0) rect(g, '#e0a0a6', hx + dx * 3, hy + dy * 3, 1, 1);
  }

  function slime(g, dir, frame) {
    const sq = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    shadow(g, 16, 27, 11, 3);
    ellipse(g, '#2f8f2c', 16, 20 + sq, 11 + sq, 8 - sq);
    ellipse(g, '#4fc24a', 16, 19 + sq, 10 + sq, 7 - sq);
    ellipse(g, 'rgba(255,255,255,0.6)', 11, 16 + sq, 3, 2);
    if (dir !== 0) {
      rect(g, '#123', 12 + DX[dir] * 2, 18 + sq, 2, 3);
      rect(g, '#123', 18 + DX[dir] * 2, 18 + sq, 2, 3);
    }
  }

  const SPIDER = { legs: '#1a1a1a', body: '#2a2a2a', mark: '#b02020', head: '#3a3030' };
  const GIANT_SPIDER = { legs: '#2a1a0e', body: '#4a3222', mark: '#e0b030', head: '#5a3c28', hairy: true };
  function spider(g, dir, frame, c = SPIDER) {
    const k = frame === 1 ? 1.5 : frame === 2 ? -1.5 : 0;
    shadow(g, 16, 25, 11, 3);
    for (let i = 0; i < 4; i++) {
      const y = 13 + i * 4, w = i % 2 ? k : -k;
      line(g, c.legs, 1.5, 16, 19, 6, y - 2 + w, 2, y + 4);
      line(g, c.legs, 1.5, 16, 19, 26, y - 2 - w, 30, y + 4);
    }
    ellipse(g, c.body, 16 - DX[dir] * 3, 21 - DY[dir] * 2, 7, 6);
    if (c.hairy) for (let i = 0; i < 10; i++) rect(g, c.legs, 11 + ((i * 7) % 11) - DX[dir] * 3, 17 + ((i * 5) % 8) - DY[dir] * 2, 1, 1);
    rect(g, c.mark, 15 - DX[dir] * 3, 19 - DY[dir] * 2, 2, 4);
    if (c.hairy) rect(g, c.mark, 13 - DX[dir] * 3, 20 - DY[dir] * 2, 6, 1);
    const hx = 16 + DX[dir] * 5, hy = 18 + DY[dir] * 5;
    ellipse(g, c.head, hx, hy, 4, 4);
    if (dir !== 0) {
      rect(g, '#ff3030', hx - 2 + DX[dir], hy - 1, 1, 1);
      rect(g, '#ff3030', hx + 1 + DX[dir], hy - 1, 1, 1);
    }
  }

  const WOLF = { leg: '#5a5a5a', tail: '#6a6a6a', body: '#7a7a7a', light: '#a0a0a0', head: '#808080', ear: '#606060', eye: '#ffd040' };
  const ICE_WOLF = { leg: '#a8bccc', tail: '#c0d0dc', body: '#d0dce6', light: '#f0f6fa', head: '#dce6ee', ear: '#a8bccc', eye: '#40a0ff' };
  function wolf(g, dir, frame, c = WOLF) {
    const dx = DX[dir], lift = frame === 1 ? 2 : frame === 2 ? -2 : 0;
    shadow(g, 16, 27, 11, 3);
    if (dx !== 0) {
      for (const [x, l] of [[9, lift], [12, -lift], [19, -lift], [22, lift]]) rect(g, c.leg, x, 20, 2, 8 - Math.max(0, l));
      line(g, c.tail, 3, 16 - dx * 8, 17, 16 - dx * 13, 12);
      ellipse(g, c.body, 16, 18, 9, 5);
      ellipse(g, c.light, 16, 21, 7, 2);
      const hx = 16 + dx * 9;
      ellipse(g, c.head, hx, 13, 5, 4);
      rect(g, c.head, dx > 0 ? hx + 2 : hx - 6, 13, 4, 3);
      poly(g, c.ear, [hx - 2, 10, hx + 1, 10, hx - 1, 5]);
      rect(g, c.eye, hx + dx * 2, 12, 1, 1);
    } else {
      rect(g, c.leg, 11, 21, 3, 7 - Math.max(0, lift));
      rect(g, c.leg, 18, 21, 3, 7 - Math.max(0, -lift));
      ellipse(g, c.body, 16, 19, 7, 8);
      if (dir === 2) {
        ellipse(g, c.head, 16, 13, 6, 5);
        poly(g, c.ear, [10, 11, 13, 9, 11, 4]);
        poly(g, c.ear, [22, 11, 19, 9, 21, 4]);
        ellipse(g, c.light, 16, 16, 3, 2);
        rect(g, '#111', 15, 15, 2, 1);
        rect(g, c.eye, 13, 12, 1, 1);
        rect(g, c.eye, 18, 12, 1, 1);
      } else {
        line(g, c.tail, 3, 16, 25, 16, 29);
        ellipse(g, c.head, 16, 11, 5, 4);
        poly(g, c.ear, [11, 10, 13, 8, 12, 4]);
        poly(g, c.ear, [21, 10, 19, 8, 20, 4]);
      }
    }
  }

  function ghost(g, dir, frame) {
    const b = frame === 1 ? -1 : frame === 2 ? 1 : 0;
    g.globalAlpha = 0.8;
    poly(g, '#e8ecf4', [8, 28 + b, 8, 12 + b, 11, 5 + b, 16, 3 + b, 21, 5 + b, 24, 12 + b, 24, 28 + b, 21, 25 + b, 18, 28 + b, 14, 25 + b, 11, 28 + b]);
    g.globalAlpha = 1;
    if (dir !== 0) {
      rect(g, '#222', 12 + DX[dir] * 2, 10 + b, 2, 3);
      rect(g, '#222', 18 + DX[dir] * 2, 10 + b, 2, 3);
      rect(g, '#333', 14 + DX[dir] * 2, 16 + b, 4, 2);
    }
  }
  // Big monsters get a 64x64 sprite: their tile is the bottom-right quarter and they reach up-left.
  function giantSpider(g, dir, frame) {
    g.translate(13, 28);
    g.scale(1.35, 1.35);
    g.translate(-16, -28);
    spider(g, dir, frame, GIANT_SPIDER);
  }
  // A dragon, drawn around its tile (0..32) and reaching up to 28 px up and left of it.
  const DRAGON = { skin: '#3f8a3a', dark: '#2a6028', light: '#5aa84a', belly: '#d8c070', membrane: '#78b05a' };
  const FROST_DRAGON = { skin: '#8ab8d8', dark: '#5a88a8', light: '#b8e0f0', belly: '#e8f4f8', membrane: '#a8d0e8' };
  const DRAGON_LORD = { skin: '#a83020', dark: '#6a1a10', light: '#d05030', belly: '#e8b060', membrane: '#c84a30' };
  function dragon(g, dir, frame, c = DRAGON) {
    const flap = frame === 1 ? -3 : frame === 2 ? 3 : 0, step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    const { skin, dark, light, belly, membrane } = c;
    shadow(g, 6, 29, 21, 4);
    if (dir === 1 || dir === 3) {
      if (dir === 3) { // mirror the side view around x = 4
        g.translate(8, 0);
        g.scale(-1, 1);
      }
      line(g, dark, 5, -8, 18, -16, 22, -22, 28);                       // tail
      poly(g, dark, [-22, 28, -27, 25, -24, 31]);
      rect(g, dark, -4, 21, 4, 9 - step);                               // hind leg
      poly(g, dark, [-6, -2, -18, -24 + flap, -2, -14 + flap, 8, 6]);   // far wing
      ellipse(g, skin, 2, 17, 13, 8);                                   // body
      ellipse(g, belly, 4, 21, 9, 3.5);
      for (let x = -8; x <= 8; x += 4) poly(g, light, [x - 2, 10, x, 6, x + 2, 10]);
      rect(g, skin, 8, 21, 4, 9 + step);                                // front leg
      rect(g, '#e8e0c0', 11, 28 + step, 2, 2);
      poly(g, membrane, [-4, 6, -14, -20 + flap, 4, -10 + flap, 10, 8]); // near wing
      line(g, dark, 1.5, -4, 6, -14, -20 + flap, 4, -10 + flap);
      line(g, dark, 1, -14, -20 + flap, 0, 4);
      line(g, skin, 7, 10, 13, 17, 1);                                  // neck
      ellipse(g, skin, 20, -2, 6, 5);                                   // head
      rect(g, skin, 23, -3, 7, 5);
      rect(g, '#1a1a1a', 28, -2, 1, 1);
      line(g, '#e8e0c0', 1, 24, 2, 29, 2);
      poly(g, '#e8e0c0', [16, -5, 11, -12, 18, -6]);                    // horn
      rect(g, '#ffd030', 20, -4, 2, 2);
      return;
    }
    // facing south (front) or north (back): wings spread to both sides
    for (const s of [-1, 1]) {
      const ox = 4 + s * 7;
      poly(g, dark, [ox, 8, ox + s * 22, -22 + flap, ox + s * 25, -6 + flap, ox + s * 20, 8, ox + s * 10, 14]);
      poly(g, membrane, [ox, 9, ox + s * 20, -18 + flap, ox + s * 22, -6 + flap, ox + s * 18, 7, ox + s * 9, 12]);
      line(g, dark, 1, ox, 9, ox + s * 18, -8 + flap);
    }
    if (dir === 0) line(g, dark, 5, 4, 24, 4, 31);                      // tail, seen from behind
    rect(g, dark, -3, 22, 5, 8 - step);
    rect(g, dark, 6, 22, 5, 8 + step);
    ellipse(g, skin, 4, 16, 11, 10);
    if (dir === 2) {
      ellipse(g, belly, 4, 19, 7, 7);
      for (let y = 15; y < 25; y += 3) rect(g, '#b8a050', -1, y, 10, 1);
    } else {
      for (let y = 8; y <= 20; y += 4) poly(g, light, [2, y + 2, 4, y - 2, 6, y + 2]);
    }
    rect(g, skin, 1, 2, 6, 8);                                          // neck
    ellipse(g, skin, 4, 0, 7, 6);                                       // head
    poly(g, '#e8e0c0', [-1, -4, -6, -11, 1, -6]);
    poly(g, '#e8e0c0', [9, -4, 14, -11, 7, -6]);
    if (dir === 2) {
      ellipse(g, light, 4, 4, 4, 3);
      rect(g, '#ffd030', 0, -1, 2, 2);
      rect(g, '#ffd030', 6, -1, 2, 2);
      rect(g, '#1a1a1a', 3, 5, 1, 1);
      rect(g, '#1a1a1a', 5, 5, 1, 1);
    }
  }

  function bear(g, dir, frame, c = { fur: '#6a4428', dark: '#4a2e18', snout: '#8a6a4a' }) {
    const dx = DX[dir], lift = frame === 1 ? 2 : frame === 2 ? -2 : 0;
    shadow(g, 16, 28, 13, 3);
    if (dx !== 0) {
      for (const [x, l] of [[8, lift], [12, -lift], [19, -lift], [23, lift]]) rect(g, c.dark, x, 20, 4, 8 - Math.max(0, l));
      ellipse(g, c.fur, 16, 17, 12, 8);
      const hx = 16 + dx * 11;
      ellipse(g, c.fur, hx, 13, 6, 5);
      ellipse(g, c.snout, hx + dx * 4, 15, 3, 2);
      ellipse(g, c.dark, hx - dx * 2, 8, 2, 2);
      rect(g, '#111', hx + dx * 2, 12, 1, 1);
    } else {
      rect(g, c.dark, 9, 21, 5, 7 - Math.max(0, lift));
      rect(g, c.dark, 18, 21, 5, 7 - Math.max(0, -lift));
      ellipse(g, c.fur, 16, 18, 10, 10);
      ellipse(g, c.fur, 16, dir === 2 ? 11 : 9, 7, 6);
      ellipse(g, c.dark, 10, 6, 2.5, 2.5);
      ellipse(g, c.dark, 22, 6, 2.5, 2.5);
      if (dir === 2) {
        ellipse(g, c.snout, 16, 14, 3.5, 2.5);
        rect(g, '#111', 15, 13, 2, 1);
        rect(g, '#111', 13, 10, 1, 1);
        rect(g, '#111', 18, 10, 1, 1);
      }
    }
  }
  function polarBear(g, dir, frame) {
    g.translate(14, 28);
    g.scale(1.3, 1.3);
    g.translate(-16, -28);
    bear(g, dir, frame, { fur: '#eef2f4', dark: '#c8d0d6', snout: '#d8dee2' });
  }
  function scorpion(g, dir, frame) {
    const k = frame === 1 ? 1 : frame === 2 ? -1 : 0, dx = DX[dir], dy = DY[dir];
    shadow(g, 16, 26, 11, 3);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) line(g, '#2a1a10', 1.5, 16 + s * 4, 19 + i * 2, 16 + s * 11, 23 + i * 2 + (i % 2 ? k : -k));
    ellipse(g, '#4a3020', 16, 20, 7, 5);
    // claws at the front, the tail curling over the back
    const fx = 16 + dx * 9, fy = 19 + dy * 6;
    for (const s of [-1, 1]) ellipse(g, '#5a3a24', fx + (dy ? s * 5 : 0), fy + (dx ? s * 4 : 0), 3, 2.5);
    const bx = 16 - dx * 8, by = 20 - dy * 6;
    line(g, '#4a3020', 3, 16 - dx * 4, 20 - dy * 3, bx, by - 4, bx + dx * 3, by - 10);
    poly(g, '#c03020', [bx + dx * 3 - 2, by - 10, bx + dx * 3 + 2, by - 10, bx + dx * 5, by - 13]);
  }
  function crocodile(g, dir, frame) {
    g.translate(14, 28);
    g.scale(1.25, 1.25);
    g.translate(-16, -28);
    const k = frame === 1 ? 1 : frame === 2 ? -1 : 0, dx = DX[dir], dy = DY[dir], c = '#4a6a3a';
    shadow(g, 16, 25, 14, 3);
    if (dx !== 0) {
      line(g, c, 4, 16 - dx * 8, 21, 16 - dx * 16, 23);
      ellipse(g, c, 16, 20, 11, 4);
      for (const x of [10, 21]) rect(g, '#3a5a2a', x, 22, 3, 3 + (x < 16 ? k : -k));
      poly(g, c, [16 + dx * 9, 17, 16 + dx * 18, 19, 16 + dx * 18, 21, 16 + dx * 9, 23]);
      for (let i = 0; i < 4; i++) rect(g, '#e8e0c0', 16 + dx * (11 + i * 2), 20, 1, 1);
      rect(g, '#e0c020', 16 + dx * 9, 17, 1, 1);
      for (let x = 8; x < 24; x += 3) rect(g, '#3a5a2a', x, 17, 2, 1);
    } else {
      ellipse(g, c, 16, 19, 5, 11);
      for (const y of [13, 24]) { rect(g, '#3a5a2a', 9, y, 3, 2); rect(g, '#3a5a2a', 20, y, 3, 2); }
      poly(g, c, [13, 19 + dy * 9, 19, 19 + dy * 9, 17, 19 + dy * 16, 15, 19 + dy * 16]);
      if (dir === 2) { rect(g, '#e0c020', 13, 26, 1, 1); rect(g, '#e0c020', 18, 26, 1, 1); }
    }
  }
  function viper(g, dir, frame) {
    const k = frame === 1 ? 1.5 : frame === 2 ? -1.5 : 0, dx = DX[dir], dy = DY[dir];
    shadow(g, 16, 25, 9, 3);
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6, side = Math.sin(t * Math.PI * 2 + k) * 4;
      pts.push(16 - dx * (10 - t * 18) + (dy ? side : 0), 20 - dy * (8 - t * 14) + (dx ? side : 0));
    }
    line(g, '#5a7a2a', 4, ...pts);
    line(g, '#8aa83a', 1.5, ...pts);
    const hx = pts[12], hy = pts[13];
    ellipse(g, '#4a6a22', hx, hy, 3.5, 3);
    rect(g, '#e02020', hx + dx * 3, hy + dy * 3, 2, 1);
    rect(g, '#111', hx - 1, hy - 1, 1, 1);
  }
  function fireElemental(g, dir, frame) {
    const f = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    shadow(g, 16, 28, 9, 3);
    poly(g, '#c83a10', [7, 28, 9, 14 + f, 12, 18, 13, 6 - f, 16, 12, 19, 2 + f, 21, 16, 24, 9 - f, 25, 28]);
    poly(g, '#ff8a20', [10, 28, 12, 17, 14, 21, 16, 10 + f, 18, 20, 21, 14, 22, 28]);
    poly(g, '#ffd040', [13, 28, 15, 20, 17, 23, 19, 28]);
    if (dir !== 0) { rect(g, '#fff6c0', 13, 17, 2, 2); rect(g, '#fff6c0', 18, 17, 2, 2); }
  }

  // The flying car of a certain easter egg: an old sky-blue car with two boys in it.
  function flyingCar(g) {
    const body = '#7ac0d8', dark = '#4a8aa8';
    rect(g, '#2a2a2a', 6, 22, 6, 6);
    rect(g, '#2a2a2a', 34, 22, 6, 6);
    poly(g, body, [2, 22, 4, 15, 12, 14, 16, 6, 34, 6, 38, 14, 46, 15, 47, 22]);
    rect(g, dark, 2, 21, 45, 3);
    rect(g, '#d8e8f0', 18, 8, 7, 6);
    rect(g, '#d8e8f0', 27, 8, 6, 6);
    // the boys: red hair in front, dark hair (and glasses) behind
    ellipse(g, '#f0c090', 30, 11, 2.5, 2.5);
    rect(g, '#d0601a', 28, 8, 5, 2);
    ellipse(g, '#f0c090', 21, 11, 2.5, 2.5);
    rect(g, '#1a1a1a', 19, 8, 5, 2);
    rect(g, '#1a1a1a', 19, 11, 5, 1);
    rect(g, '#ffe080', 45, 16, 2, 2);
    rect(g, '#e04040', 2, 16, 2, 2);
  }

  // A Hoofer cab facing east: a black cab with gold trim, its driver, and a trotting horse.
  function cab(g, passenger, frame) {
    const legs = frame ? [2, -2] : [-2, 2];
    shadow(g, 32, 58, 30, 5);
    for (const [x, d] of [[41, legs[0]], [45, legs[1]], [52, legs[1]], [56, legs[0]]]) line(g, '#4a2e18', 2.5, x, 44, x + d, 57);
    line(g, '#2a1a0e', 2, 39, 40, 35, 47);                                 // tail
    ellipse(g, '#7a4a26', 48, 42, 10, 6);                                  // horse
    poly(g, '#7a4a26', [53, 40, 58, 27, 62, 29, 59, 42]);
    ellipse(g, '#7a4a26', 59, 29, 4, 3);
    poly(g, '#2a1a0e', [54, 38, 58, 26, 56, 26, 52, 37]);                  // mane
    rect(g, '#111', 60, 28, 1, 1);
    line(g, '#3a2a1a', 1, 34, 40, 47, 38);                                 // shafts
    line(g, '#3a2a1a', 1, 34, 44, 47, 42);
    rect(g, '#1e1e24', 2, 22, 32, 24);                                     // the cab
    rect(g, '#2c2c34', 0, 18, 36, 5);
    rect(g, '#c8a030', 2, 31, 32, 1);
    rect(g, '#c8a030', 2, 45, 32, 1);
    rect(g, passenger ? '#e8d8a8' : '#9ab0c0', 8, 25, 12, 8);              // window
    if (passenger) {
      ellipse(g, '#f0c090', 14, 30, 3, 3);
      rect(g, '#5a3a1a', 11, 26, 6, 2);
    }
    rect(g, '#c8a030', 25, 26, 1, 16);                                     // the door
    ellipse(g, '#f0c090', 33, 15, 3, 3);                                   // driver with a top hat
    rect(g, '#111', 30, 6, 6, 7);
    rect(g, '#111', 28, 12, 10, 2);
    rect(g, '#5a2a2a', 31, 18, 5, 6);
    for (const x of [9, 28]) {                                             // wheels
      ellipse(g, '#3a2a1a', x, 50, 7, 7);
      ellipse(g, '#8a6a3a', x, 50, 5, 5);
      ellipse(g, '#3a2a1a', x, 50, 1.5, 1.5);
      line(g, '#3a2a1a', 1, x - 5, 50, x + 5, 50);
      line(g, '#3a2a1a', 1, x, 45, x, 55);
    }
  }

  // A hot air balloon with red and yellow stripes, the passenger in its basket.
  function balloon(g, passenger) {
    g.save();
    g.beginPath();
    g.ellipse(48, 34, 27, 31, 0, 0, Math.PI * 2);
    g.moveTo(26, 50);
    g.lineTo(40, 66);
    g.lineTo(56, 66);
    g.lineTo(70, 50);
    g.clip();
    for (let x = 18; x < 80; x += 9) rect(g, (x / 9) % 2 < 1 ? '#d83a30' : '#f0c040', x, 0, 9, 70);
    ellipse(g, 'rgba(255,255,255,0.25)', 38, 20, 8, 12);
    rect(g, 'rgba(0,0,0,0.15)', 60, 0, 20, 70);
    g.restore();
    for (const [x0, x1] of [[41, 39], [55, 57]]) line(g, '#5a4a3a', 1, x0, 66, x1, 76);
    rect(g, '#8a5a2a', 37, 76, 22, 14);
    for (let y = 79; y < 90; y += 3) rect(g, '#6a4220', 37, y, 22, 1);
    rect(g, '#a8783a', 36, 75, 24, 3);
    if (passenger) {
      ellipse(g, '#f0c090', 48, 72, 3.5, 3.5);
      rect(g, '#5a3a1a', 44, 68, 8, 2);
    }
  }

  // Dom's car facing east: a black muscle car with a supercharger sticking out of
  // the hood, Dom at the wheel and you next to him. frame turns the wheels.
  function domCar(g, frame) {
    shadow(g, 33, 56, 30, 4);
    poly(g, '#16161a', [2, 46, 4, 36, 18, 33, 24, 24, 40, 24, 46, 33, 62, 36, 63, 46]); // body and cabin
    rect(g, '#2c2c34', 4, 36, 58, 2);
    rect(g, '#3a3a44', 26, 26, 12, 7);                                                // window
    rect(g, '#3a3a44', 19, 27, 6, 6);
    ellipse(g, '#c89070', 33, 28, 3.5, 3.5);                                          // Dom: bald...
    rect(g, '#f0f0f0', 30, 31, 7, 2);                                                 // ...in a white tank top
    ellipse(g, '#f0c090', 22, 29, 2.5, 2.5);                                          // you
    rect(g, '#9a9aa6', 45, 22, 10, 12);                                               // the supercharger
    for (let y = 24; y < 33; y += 2) rect(g, '#c8c8d4', 45, y, 10, 1);
    rect(g, '#b02020', 44, 18, 12, 4);                                                // its air scoop
    rect(g, '#1a1a1a', 46, 16, 8, 2);
    rect(g, '#d8d8e0', 60, 39, 3, 3);                                                 // headlight
    rect(g, '#c02020', 2, 39, 2, 3);                                                  // tail light
    for (const [x, rad] of [[15, 8.5], [52, 7]]) {
      ellipse(g, '#0c0c0c', x, 47, rad, rad);
      ellipse(g, '#8a8a94', x, 47, rad * 0.45, rad * 0.45);
      const a = frame * 0.8;
      line(g, '#3a3a40', 1.5, x - Math.cos(a) * rad * 0.4, 47 - Math.sin(a) * rad * 0.4, x + Math.cos(a) * rad * 0.4, 47 + Math.sin(a) * rad * 0.4);
    }
  }

  // Town animals. Seen from the side they face east (west is the same, mirrored).
  function smallAnimal(g, dir, frame, drawSide, drawFront) {
    shadow(g, 16, 27, 8, 2.5);
    const k = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    if (dir === 1 || dir === 3) {
      g.save();
      if (dir === 3) { g.translate(32, 0); g.scale(-1, 1); }
      drawSide(k);
      g.restore();
    } else drawFront(k, dir === 2);
  }
  function cat(g, dir, frame) {
    const fur = '#8a7a6a', dark = '#5a4e44', eye = '#8ad04a';
    smallAnimal(g, dir, frame, k => {
      line(g, fur, 2, 9, 20, 5, 11);
      ellipse(g, fur, 15, 21, 7, 4);
      for (let i = 0; i < 3; i++) rect(g, dark, 11 + i * 3, 18, 1, 3);
      rect(g, dark, 11 + k, 23, 2, 4);
      rect(g, dark, 18 - k, 23, 2, 4);
      ellipse(g, fur, 22, 16, 4, 4);
      poly(g, fur, [19, 14, 20, 9, 22, 13]);
      poly(g, fur, [23, 13, 25, 9, 26, 14]);
      rect(g, eye, 23, 15, 1, 1);
      rect(g, '#d08080', 26, 17, 1, 1);
    }, (k, front) => {
      if (!front) line(g, fur, 2, 16, 22, 21, 12);
      ellipse(g, fur, 16, 22, 5, 5);
      rect(g, dark, 12, 25 - (k > 0 ? 1 : 0), 2, 3);
      rect(g, dark, 18, 25 - (k < 0 ? 1 : 0), 2, 3);
      ellipse(g, fur, 16, 14, 5, 4.5);
      poly(g, fur, [11, 13, 12, 7, 15, 11]);
      poly(g, fur, [17, 11, 20, 7, 21, 13]);
      if (front) {
        rect(g, eye, 13, 13, 2, 2);
        rect(g, eye, 17, 13, 2, 2);
        rect(g, '#d08080', 15.5, 16, 1, 1);
      }
    });
  }
  function dog(g, dir, frame) {
    const fur = '#a8743e', dark = '#6a4422', light = '#d0a070';
    smallAnimal(g, dir, frame, k => {
      line(g, fur, 2, 8, 18, 4, 13 + k);
      ellipse(g, fur, 15, 19, 8, 5);
      ellipse(g, light, 15, 21, 5, 2);
      rect(g, dark, 10 + k, 22, 2, 5);
      rect(g, dark, 19 - k, 22, 2, 5);
      ellipse(g, fur, 23, 14, 4.5, 4);
      ellipse(g, light, 26, 16, 3, 2);
      rect(g, '#1a1a1a', 28, 15, 1, 1);
      ellipse(g, dark, 21, 14, 2, 4);
      rect(g, '#1a1a1a', 24, 13, 1, 1);
    }, (k, front) => {
      if (!front) line(g, fur, 2, 16, 20, 16 + k * 3, 12);
      ellipse(g, fur, 16, 21, 6, 6);
      rect(g, dark, 12, 24 - (k > 0 ? 1 : 0), 2, 4);
      rect(g, dark, 18, 24 - (k < 0 ? 1 : 0), 2, 4);
      ellipse(g, fur, 16, 13, 5, 5);
      ellipse(g, dark, 11, 13, 2, 4);
      ellipse(g, dark, 21, 13, 2, 4);
      if (front) {
        ellipse(g, light, 16, 16, 3, 2);
        rect(g, '#1a1a1a', 15, 15, 2, 1);
        rect(g, '#1a1a1a', 13, 12, 1, 1);
        rect(g, '#1a1a1a', 18, 12, 1, 1);
        rect(g, '#d05050', 15.5, 18, 1, 2);
      }
    });
  }
  function chicken(g, dir, frame) {
    const white = '#f0ece0', shadeC = '#c8c0b0', comb = '#d02a2a', beak = '#e8a020';
    smallAnimal(g, dir, frame, k => {
      line(g, beak, 1, 14 + k, 23, 14 + k, 27);
      line(g, beak, 1, 18 - k, 23, 18 - k, 27);
      ellipse(g, white, 15, 19, 6, 5);
      poly(g, shadeC, [9, 17, 6, 12, 12, 16]);
      ellipse(g, shadeC, 14, 19, 3, 2);
      ellipse(g, white, 20, 13, 3, 3);
      rect(g, comb, 19, 9, 3, 2);
      rect(g, comb, 21, 15, 1, 2);
      poly(g, beak, [23, 12, 26, 13, 23, 14]);
      rect(g, '#1a1a1a', 21, 12, 1, 1);
    }, (k, front) => {
      line(g, beak, 1, 14, 22, 14, 27 - (k > 0 ? 1 : 0));
      line(g, beak, 1, 18, 22, 18, 27 - (k < 0 ? 1 : 0));
      ellipse(g, white, 16, 19, 5, 5);
      ellipse(g, white, 16, 13, 3, 3);
      rect(g, comb, 15, 9, 2, 2);
      if (front) {
        poly(g, beak, [15, 14, 17, 14, 16, 16]);
        rect(g, comb, 15.5, 16, 1, 2);
        rect(g, '#1a1a1a', 14, 12, 1, 1);
        rect(g, '#1a1a1a', 17, 12, 1, 1);
      }
    });
  }

  function crab(g, dir, frame) {
    const k = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    shadow(g, 16, 25, 11, 3);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) line(g, '#a8401f', 1.5, 16 + s * 6, 19 + i * 2, 16 + s * 13, 22 + i * 3 + (i % 2 ? k : -k));
    ellipse(g, '#d0502a', 16, 19, 9, 6);
    ellipse(g, '#e87040', 15, 17, 6, 3);
    for (const s of [-1, 1]) ellipse(g, '#d0502a', 16 + s * 10, 12 + k, 4, 3);
    rect(g, '#111', 13, 14, 2, 2);
    rect(g, '#111', 17, 14, 2, 2);
  }

  // key: monster type, 'npc:<id>' or 'player:<vocation>:<hair>|<body>|<legs>|<feet>'
  function lookFor(key) {
    if (key.startsWith('player:')) {
      const [, voc, colors = ''] = key.split(':');
      const [hair, body, legs, feet, type, female, addons] = colors.split('|');
      return playerLook(voc, colors ? { hair, body, legs, feet, type, female: female === '1', addons: +addons || 0 } : {});
    }
    if (key.startsWith('npc:')) return NPCS[key.slice(4)].look;
    return MONSTER_LOOKS[key] || null;
  }
  const BIG_BEASTS = ['giant_spider', 'dragon', 'frost_dragon', 'dragon_lord', 'polar_bear', 'crocodile'];
  function creatureDrawer(key) {
    const look = lookFor(key);
    if (look) return (g, d, f) => humanoid(g, look, d, f);
    return {
      rat, slime, spider, wolf, ghost, crab, cat, dog, chicken, giant_spider: giantSpider, dragon, bear, scorpion, viper,
      ice_wolf: (g, d, f) => wolf(g, d, f, ICE_WOLF),
      polar_bear: polarBear,
      crocodile,
      fire_elemental: fireElemental,
      frost_dragon: (g, d, f) => dragon(g, d, f, FROST_DRAGON),
      dragon_lord: (g, d, f) => {
        g.translate(4, 30);
        g.scale(1.08, 1.08);
        g.translate(-4, -30);
        dragon(g, d, f, DRAGON_LORD);
      },
    }[key];
  }

  const CORPSES = {
    blood(g) {
      ellipse(g, '#6e1010', 16, 22, 11, 6);
      ellipse(g, '#8a1a1a', 14, 21, 6, 3);
      rect(g, '#ddd6c4', 10, 20, 9, 2);
      rect(g, '#ddd6c4', 18, 24, 6, 2);
    },
    big(g) {
      ellipse(g, '#6e1010', 16, 21, 14, 8);
      ellipse(g, '#8a1a1a', 13, 20, 8, 4);
      rect(g, '#ddd6c4', 8, 18, 12, 3);
      rect(g, '#ddd6c4', 17, 23, 9, 3);
      ellipse(g, '#ddd6c4', 22, 17, 4, 3);
    },
    bones(g) {
      ellipse(g, 'rgba(0,0,0,0.2)', 16, 23, 11, 4);
      ellipse(g, '#e6e2d3', 20, 18, 4, 4);
      rect(g, '#111', 18, 17, 1, 2);
      rect(g, '#111', 21, 17, 1, 2);
      for (const [x, y, w] of [[7, 22, 10], [12, 25, 12], [9, 19, 7]]) rect(g, '#e6e2d3', x, y, w, 2);
    },
    slime(g) {
      ellipse(g, '#2f7f2c', 16, 22, 12, 5);
      ellipse(g, '#4fb24a', 14, 21, 7, 3);
    },
  };

  // Fields left by runes (fire/poison/energy) flicker; a magic wall is a see-through block.
  const FIELD_DRAW = {
    fire(g, f) {
      for (let i = 0; i < 5; i++) {
        const x = 6 + i * 5, h = 8 + ((i * 7 + f * 3) % 6);
        ellipse(g, 'rgba(255,110,20,0.85)', x, 26 - h / 2, 3, h / 2);
        ellipse(g, 'rgba(255,220,80,0.9)', x, 27 - h / 3, 1.5, h / 4);
      }
    },
    poison(g, f) {
      rect(g, 'rgba(90,200,60,0.35)', 2, 2, 28, 28);
      for (let i = 0; i < 6; i++) ellipse(g, 'rgba(150,240,100,0.85)', 5 + ((i * 11 + f * 4) % 24), 6 + ((i * 7 + f * 5) % 22), 2, 2);
    },
    energy(g, f) {
      rect(g, 'rgba(180,120,255,0.3)', 2, 2, 28, 28);
      for (let i = 0; i < 3; i++) line(g, 'rgba(235,210,255,0.95)', 1.5, 4 + i * 9, 4 + ((f + i) % 3) * 4, 10 + i * 7, 16, 6 + i * 9, 28);
    },
    magic_wall(g) {
      wallBlock(g, 'block', {
        south: () => rect(g, 'rgba(80,140,255,0.55)', 0, 0, TILE, TILE),
        east: () => rect(g, 'rgba(50,100,220,0.55)', 0, 0, TILE, TILE),
        top: 'rgba(150,200,255,0.6)',
        seeThrough: true,
      });
    },
  };

  // Ground borders: the higher of two neighbouring grounds spills a ragged edge onto the other.
  // Paved ground is lowest: the land around a square or a street spills over its edges.
  const PAVED = { paving: 0, cobble: 0, brick: 0, tiles: 0, gravel: 0, sandstone: 0, wood: 0, farmland: 0, bridge_ns: 0, bridge_ew: 0, marble: 0, carpet: 0 };
  const BORDER_PRIORITY = { ...PAVED, water: 0, lava: 0, sand: 1, ash: 1, cave: 1, swamp: 2, dirt: 2, grass: 3, jungle: 3, snow: 4, mountain: 5, rock_top: 6 };
  // How a ground's edge looks where it spills over a lower one: shade (its shadow on the lower
  // ground), rim (the edge line), light (a bright line just inside), tufts or pebbles along it.
  const EDGE_STYLE = {
    default: { shade: 'rgba(0,0,0,0.16)', rim: 'rgba(0,0,0,0.28)' },
    grass: { shade: 'rgba(20,30,10,0.22)', rim: 'rgba(32,72,26,0.7)', tufts: ['#3f7d33', '#57a046', '#2f6a26', '#62aa4f'] },
    jungle: { shade: 'rgba(10,20,8,0.25)', rim: 'rgba(20,50,18,0.75)', tufts: ['#275a22', '#3a7a32', '#1e4a1a'] },
    dirt: { shade: 'rgba(30,20,8,0.2)', rim: 'rgba(78,56,30,0.75)', pebbles: ['#a3845a', '#6e5230', '#b89a70'] },
    sand: { shade: 'rgba(60,45,10,0.14)', rim: 'rgba(176,150,96,0.8)', light: 'rgba(248,238,200,0.55)', pebbles: ['#c4ad6f', '#f0e4c0'] },
    swamp: { shade: 'rgba(10,15,8,0.25)', rim: 'rgba(36,46,26,0.8)', tufts: ['#56683a', '#3f4f28'] },
    mountain: { shade: 'rgba(0,0,0,0.3)', rim: 'rgba(70,62,52,0.9)', light: 'rgba(190,180,160,0.4)', pebbles: ['#a29784', '#6c6254', '#958a79'] },
    snow: { shade: 'rgba(60,80,110,0.2)', rim: 'rgba(170,190,215,0.85)', light: 'rgba(255,255,255,0.8)' },
    ash: { shade: 'rgba(0,0,0,0.25)', rim: 'rgba(40,36,34,0.85)', pebbles: ['#5a5654', '#2e2a28'] },
    rock_top: { shade: 'rgba(0,0,0,0.35)', rim: 'rgba(52,46,38,0.95)', light: 'rgba(200,190,170,0.45)', pebbles: ['#a29784', '#5a5145'] },
    cave: { shade: 'rgba(0,0,0,0.3)', rim: 'rgba(40,34,28,0.85)', pebbles: ['#5a5047', '#362f29', '#6a6056'] },
  };
  function groundTexture(id) {
    return cached(`${id}::0:0`, g => DRAW[id](g, makeRng(hashStr(id)), 0));
  }

  // Your own PNGs: list them in sprites/custom.js as CUSTOM_SPRITES = { id: 'file.png' }.
  // Creature images can be a single 32x32 picture or a 96x128 sheet: 3 frames
  // (standing, step, step) across, directions north, east, south, west down.
  const custom = new Map();
  if (typeof CUSTOM_SPRITES !== 'undefined') {
    for (const [id, file] of Object.entries(CUSTOM_SPRITES)) {
      const img = new Image();
      img.src = `sprites/${file}`;
      custom.set(id, img);
    }
  }
  const customImage = id => {
    const img = custom.get(id);
    return img && img.complete && img.naturalWidth ? img : null;
  };

  const hashStr = s => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);
  const hashXY = (x, y) => (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;

  return {
    // Sprite for a map thing at map position (x, y); position picks the variant.
    // Trees, walls and wall decorations are 64x64 and must be drawn anchored at
    // the bottom-right of their tile; `shape` is which neighbours a thin wall joins
    // ('wnse' flags, see wallBlock), and `material` the wall a door sits in.
    thing(id, x = 0, y = 0, time = 0, shape = '1100', material = 'wall_stone') {
      const own = customImage(id);
      if (own) return own;
      const def = THINGS[id], sprite = spriteOf(id);
      const variant = hashXY(x, y) % variantsOf(id);
      const anim = ANIMATED[sprite];
      const frame = anim ? anim.frames[Math.floor(time / anim.ms) % anim.frames.length] : 0;
      const shaped = def.wall === 'thin' || def.onWall || def.roof || id === 'fence';
      const form = shaped ? `${shape}:${sprite.startsWith('door') ? material : ''}` : '';
      const size = def.wall || def.tall || def.onWall ? 2 * TILE : TILE;
      return cached(`${sprite}:${form}:${variant}:${frame}`,
        g => DRAW[sprite](g, makeRng(hashStr(sprite) + variant * 7919), frame, shape, material), size);
    },
    item(id) {
      return customImage(id) || cached(`item:${id}`, g => ITEM_DRAW[id](g));
    },
    // URL of an item icon, for <img> tags in the UI.
    itemURL(id) {
      if (custom.has(id)) return `sprites/${CUSTOM_SPRITES[id]}`;
      if (!urls.has(id)) urls.set(id, this.item(id).toDataURL());
      return urls.get(id);
    },
    playerKey(vocation, outfit = {}) {
      const o = withDefaults(outfit);
      return `player:${vocation}:${o.hair}|${o.body}|${o.legs}|${o.feet}|${o.type}|${o.female ? 1 : 0}|${o.addons | 0}`;
    },
    // key: monster type, 'npc:<id>' or a playerKey(). Big monsters are 64x64.
    creature(key, dir, frame = 0) {
      if (key.startsWith('npc:') && NPCS[key.slice(4)].creature) key = NPCS[key.slice(4)].creature; // an NPC that looks like a monster
      const base = key.startsWith('player:') ? 'player' : key;
      const own = customImage(base);
      if (own) {
        if (own.naturalWidth < 96 || own.naturalHeight < 128) return own;
        return cached(`own:${base}:${dir}:${frame}`, g => g.drawImage(own, frame * TILE, dir * TILE, TILE, TILE, 0, 0, TILE, TILE));
      }
      const look = lookFor(key), big = (look && look.scale > 1) || BIG_BEASTS.includes(key);
      return cached(`c:${key}:${dir}:${frame}`, g => {
        if (big) g.translate(TILE, TILE);
        creatureDrawer(key)(g, dir, frame);
      }, big ? 2 * TILE : TILE);
    },
    flyingCar: () => cached('flying_car', flyingCar, 48),
    mineCart: passenger => cached(`minecart:${passenger}`, g => {
      shadow(g, 32, 50, 18, 4);
      poly(g, '#4a4a52', [14, 30, 50, 30, 46, 48, 18, 48]);
      rect(g, '#6a6a72', 14, 30, 36, 3);
      for (const x of [20, 30, 40]) rect(g, '#3a3a42', x, 33, 1, 14);
      rect(g, '#8a6a3a', 16, 38, 32, 2);
      for (const x of [22, 42]) { ellipse(g, '#1a1a1a', x, 50, 4, 4); ellipse(g, '#6a6a72', x, 50, 1.5, 1.5); }
      if (passenger) {
        ellipse(g, '#f0c090', 32, 24, 5, 5);
        rect(g, '#5a3a1a', 27, 18, 10, 3);
        rect(g, '#3a5a8a', 26, 28, 12, 4);
      }
    }, 2 * TILE),
    balloon: passenger => cached(`balloon:${passenger}`, g => balloon(g, passenger), 96),
    domCar: frame => cached(`dom:${frame}`, g => domCar(g, frame), 2 * TILE),
    cab: (passenger, frame) => cached(`cab:${passenger}:${frame}`, g => cab(g, passenger, frame), 2 * TILE),
    corpse(kind = 'blood') {
      return cached(`corpse:${kind}`, CORPSES[kind] || CORPSES.blood);
    },
    field(kind, time = 0) {
      const frame = Math.floor(time / 180) % 3;
      return cached(`field:${kind}:${frame}`, g => FIELD_DRAW[kind](g, frame), kind === 'magic_wall' ? 2 * TILE : TILE);
    },
    borderPriority: id => BORDER_PRIORITY[id],
    paved: id => id in PAVED,
    // A white copy of a sprite, to flash over it when it's hit.
    // The snow on a roof tile of this shape (see roofSnowTile).
    roofSnow(id, shape, level = 5) {
      const flat = !!(ROOF_STYLES[spriteOf(id)] || {}).flat;
      return cached(`roofsnow:${flat ? 1 : 0}:${shape}:${level}`, g => roofSnowTile(g, makeRng(hashStr(shape || 'x')), shape || '0000o', flat, level));
    },
    silhouette(img) {
      let white = silhouettes.get(img);
      if (!white) {
        white = document.createElement('canvas');
        white.width = img.width;
        white.height = img.height;
        const g = white.getContext('2d');
        g.drawImage(img, 0, 0);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = '#fff';
        g.fillRect(0, 0, white.width, white.height);
        silhouettes.set(img, white);
      }
      return white;
    },
    // Shallow water along a shore on side d (n, e, s, w; or ne, se, sw, nw for a corner),
    // with foam lapping in and out (frame 0-3).
    shore(d, frame) {
      return cached(`shore:${d}:${frame}`, g => {
        const turn = { n: 0, e: 1, s: 2, w: 3, ne: 0, se: 1, sw: 2, nw: 3 }[d];
        g.translate(16, 16);
        g.rotate((turn * Math.PI) / 2);
        g.translate(-16, -16);
        const lap = [0, 1, 2, 1][frame];
        if (d.length === 1) {
          const shallow = g.createLinearGradient(0, 0, 0, 18);
          shallow.addColorStop(0, 'rgba(110,190,225,0.8)');
          shallow.addColorStop(1, 'rgba(110,190,225,0)');
          g.fillStyle = shallow;
          g.fillRect(0, 0, TILE, 18);
          g.strokeStyle = 'rgba(255,255,255,0.7)';
          g.lineWidth = 1.5;
          g.beginPath();
          for (let x = 0; x <= TILE; x += 2) g.lineTo(x, 9 + lap + Math.sin((x + frame * 3) * 0.45) * 1.2);
          g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.35)';
          for (let x = 3 + frame * 2; x < TILE; x += 9) g.fillRect(x, 13 + lap, 2, 1);
        } else { // the corner (top right, before turning) is land
          const shallow = g.createRadialGradient(TILE, 0, 0, TILE, 0, 18);
          shallow.addColorStop(0, 'rgba(110,190,225,0.8)');
          shallow.addColorStop(1, 'rgba(110,190,225,0)');
          g.fillStyle = shallow;
          g.fillRect(0, 0, TILE, TILE);
          g.strokeStyle = 'rgba(255,255,255,0.7)';
          g.lineWidth = 1.5;
          g.beginPath();
          g.arc(TILE, 0, 10 + lap, Math.PI / 2, Math.PI);
          g.stroke();
        }
      });
    },
    // A kerb: the edge where two kinds of paving meet, on the north (n) or west (w) side of a tile.
    kerb(side) {
      return cached(`kerb:${side}`, g => {
        if (side === 'n') { rect(g, 'rgba(0,0,0,0.38)', 0, 0, TILE, 1); rect(g, 'rgba(255,255,255,0.2)', 0, 1, TILE, 1); }
        else { rect(g, 'rgba(0,0,0,0.38)', 0, 0, 1, TILE); rect(g, 'rgba(255,255,255,0.2)', 1, 0, 1, TILE); }
      });
    },
    // The ragged edge of `ground` reaching into a tile from direction dir (n, e, s, w, ne, se, sw, nw),
    // in one of three shapes (variant 0-2, so long edges don't repeat). The edge has a rim and a
    // soft shadow on the lower ground, and - by ground - tufts of grass or pebbles along it. The
    // ends of a straight edge are always 5 pixels in, so neighbouring tiles join up.
    border(ground, dir, variant = 0) {
      return cached(`border:${ground}:${dir}:${variant}`, g => {
        const r = makeRng(hashStr(`${ground}${dir}${variant}`));
        const turn = { n: 0, e: 1, s: 2, w: 3, ne: 0, se: 1, sw: 2, nw: 3 }[dir];
        const style = EDGE_STYLE[ground] || EDGE_STYLE.default;
        g.translate(16, 16);
        g.rotate((turn * Math.PI) / 2);
        g.translate(-16, -16);
        // The edge line, from the right of the tile to the left (the ground reaches in from the top).
        const edge = [];
        if (dir.length === 1) {
          for (let x = TILE; x >= 0; x -= 2) {
            const end = x === TILE || x === 0;
            edge.push([x, end ? 5 : Math.max(2, Math.min(10, 5 + Math.sin(x * 0.35 + variant * 2.1) * 2 + (r() - 0.5) * 3))]);
          }
        } else { // an outer corner: the ground fills the top-right corner
          const rx = 9 + r() * 3, ry = 9 + r() * 3;
          for (let a = 0; a <= 12; a++) {
            const t = (a / 12) * (Math.PI / 2), wob = (r() - 0.5) * 1.6;
            edge.push([TILE - (rx + wob) * Math.cos(t), (ry + wob) * Math.sin(t)]);
          }
        }
        const trace = (dx, dy) => { g.beginPath(); edge.forEach(([x, y], i) => (i ? g.lineTo(x + dx, y + dy) : g.moveTo(x + dx, y + dy))); };
        // The ground itself: the shape, filled with the ground's own texture (unturned, so it
        // matches the tiles it belongs to)...
        g.beginPath();
        g.moveTo(TILE, 0);
        edge.forEach(([x, y]) => g.lineTo(x, y));
        if (dir.length === 1) g.lineTo(0, 0);
        g.closePath();
        g.fillStyle = '#000';
        g.fill();
        g.save();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'source-in';
        g.drawImage(groundTexture(ground), 0, 0);
        g.restore();
        // ...with the shadow it casts on the lower ground behind it.
        g.globalCompositeOperation = 'destination-over';
        g.lineWidth = 2;
        g.strokeStyle = style.shade;
        trace(0, 1.5);
        g.stroke();
        g.globalCompositeOperation = 'source-over';
        // The rim, and a light line just inside it on bright grounds.
        g.lineWidth = 1;
        g.strokeStyle = style.rim;
        trace(0, 0.5);
        g.stroke();
        if (style.light) { g.strokeStyle = style.light; trace(0, -1); g.stroke(); }
        // Tufts reaching over the edge, or pebbles lying along it.
        for (let i = 2; i < edge.length - 2; i += 2) {
          const [x, y] = edge[i], v = r();
          if (style.tufts && v < 0.55) {
            const h = 2 + ((r() * 3) | 0);
            rect(g, style.tufts[(r() * style.tufts.length) | 0], Math.round(x), Math.round(y) - 1, 1, h);
          } else if (style.pebbles && v < 0.22) {
            rect(g, style.pebbles[(r() * style.pebbles.length) | 0], Math.round(x), Math.round(y) + 1, 2, 1);
          }
        }
      });
    },
    // The foot of a rock wall (cliff or cave wall) on side d of a ground tile (n, e, s, w; or ne,
    // se, sw, nw for a corner): scree and stones spilling out from the rock, with its shadow.
    foot(d, variant = 0) {
      return cached(`foot:${d}:${variant}`, g => {
        const r = makeRng(hashStr(`foot${d}${variant}`));
        const turn = { n: 0, e: 1, s: 2, w: 3, ne: 0, se: 1, sw: 2, nw: 3 }[d];
        g.translate(16, 16);
        g.rotate((turn * Math.PI) / 2);
        g.translate(-16, -16);
        const corner = d.length === 2; // the rock is off the top-right corner
        const reach = (x, y) => (corner ? Math.hypot(TILE - x, y) : y);
        const grad = corner ? g.createRadialGradient(TILE, 0, 0, TILE, 0, 14) : g.createLinearGradient(0, 0, 0, 12);
        grad.addColorStop(0, 'rgba(20,16,12,0.45)');
        grad.addColorStop(1, 'rgba(20,16,12,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, TILE, corner ? 16 : 12);
        // a band of scree, ragged on its outer side
        for (let x = 0; x < TILE; x += 2) {
          const depth = 3 + ((r() * 4) | 0);
          for (let y = 0; y < depth; y++) {
            if (corner && reach(x, y) > 9) continue;
            if (r() < 0.75) rect(g, ['#7a6f60', '#8f8472', '#6a6054', '#9c917f'][(r() * 4) | 0], x, y, 2, 1);
          }
        }
        // stones of a few sizes, the larger ones nearer the rock
        for (let i = 0; i < (corner ? 3 : 7); i++) {
          const x = corner ? TILE - 2 - r() * 10 : 1 + r() * 30, y = corner ? 1 + r() * 8 : 2 + r() * 8, s = y < 5 ? 2.5 : 1.5;
          if (corner && reach(x, y) > 12) continue;
          ellipse(g, 'rgba(0,0,0,0.3)', x + 0.5, y + 1, s + 0.5, s * 0.6);
          ellipse(g, ['#958a79', '#857a69', '#a29784'][i % 3], x, y, s, s * 0.75);
          rect(g, '#b8ac96', x - s * 0.5, y - s * 0.5, 1, 1);
        }
      });
    },
    // Rock walls that get a foot of scree on the ground around them.
    hasFoot: id => id === 'cliff' || id === 'wall_cave',
    // Natural ground that gets a rocky lip where it ends in the open (a mountain top's edge).
    hasLip: id => ['rock_top', 'grass', 'mountain', 'dirt', 'snow', 'sand', 'ash', 'jungle', 'swamp'].includes(id),
    // The lip along side d (n, e, s, w) of a raised tile: a ragged band of rock, lit on top,
    // with a dark line where it drops away. variant 0-2.
    lip(d, variant = 0) {
      return cached(`lip:${d}:${variant}`, g => {
        const r = makeRng(hashStr(`lip${d}${variant}`));
        g.translate(16, 16);
        g.rotate(({ n: 0, e: 1, s: 2, w: 3 })[d] * Math.PI / 2);
        g.translate(-16, -16);
        for (let x = 0; x < TILE; x += 2) {
          const depth = x === 0 || x === TILE - 2 ? 3 : 2 + ((r() * 3) | 0);
          rect(g, '#6a6054', x, 0, 2, depth);
          rect(g, r() < 0.5 ? '#a89c88' : '#958a78', x, depth - 1, 2, 1);
          if (r() < 0.25) rect(g, '#b8ac96', x, depth, 1, 1);
        }
        rect(g, 'rgba(20,16,12,0.55)', 0, 0, TILE, 1);
      });
    },
    // Start flags, only shown in the editor.
    startMarker(color = '#f0c040') {
      return cached(`start:${color}`, g => {
        shadow(g, 12, 29, 6, 2);
        rect(g, '#3a2a1a', 10, 4, 2, 25);
        poly(g, color, [12, 4, 26, 9, 12, 14]);
      });
    },
  };
})();
