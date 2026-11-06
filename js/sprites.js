'use strict';
// Procedurally drawn 32x32 sprites, rendered once into cached canvases.

const Sprites = (() => {
  const cache = new Map();
  const urls = new Map();
  const silhouettes = new WeakMap();

  function cached(key, draw, size = TILE, height = size) {
    let c = cache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = size;
      c.height = height;
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
  // Natural rock, as the classic maps draw it: big rounded grey boulders packed together, each with a
  // dark outline and crevice, a lit top-left and a bright highlight.
  const ROCK = {
    south: { fill: '#2a2a2c', stone: ['#8e8e8c', '#9c9c98', '#848482', '#a6a6a2'], light: '#c8c8c4', shine: '#ececE8', dark: '#5a5a5a' },
    east: { fill: '#1e1e20', stone: ['#6c6c6c', '#787876', '#646464', '#828280'], light: '#9a9a98', shine: '#bcbcb8', dark: '#424244' },
    top: { fill: '#2e2e30', stone: ['#9a9a96', '#a8a8a4', '#8e8e8c', '#b2b2ae'], light: '#d0d0cc', shine: '#f2f2ee', dark: '#62625f' },
  };
  function boulder(g, x, y, rx, ry, c, i = 0) {
    ellipse(g, '#1a1a1c', x + 0.5, y + 0.8, rx + 1.2, ry + 1.2);         // the outline and crevice round it
    ellipse(g, c.dark, x + 0.6, y + 0.9, rx, ry);                         // its shaded underside
    ellipse(g, c.stone[i % c.stone.length], x - 0.4, y - 0.5, rx - 0.8, ry - 0.9);
    ellipse(g, c.light, x - rx * 0.3, y - ry * 0.35, rx * 0.5, ry * 0.38); // the lit top-left
    rect(g, c.shine, x - rx * 0.45, y - ry * 0.55, Math.max(1, rx * 0.35), 1);
  }
  // A rock face (or a field of rock): boulders of a few sizes, back to front, filling a 32x32 square.
  function rockFace(g, r, c, size = TILE) {
    rect(g, c.dark, 0, 0, size, size); // between the boulders: shaded rock, not a hole
    // Big boulders scattered freely (not in rows), each also drawn wrapped round the tile's edges so
    // neighbouring tiles join without a seam; all drawn back to front.
    const copies = [];
    for (let i = 0; i < 7 * (size / TILE) ** 2; i++) {
      const x = r() * size, y = r() * size, rx = 8 + r() * 4, ry = 6.5 + r() * 3;
      for (const dy of [-size, 0, size]) for (const dx of [-size, 0, size]) {
        const sx = x + dx, sy = y + dy;
        if (sx + rx + 2 >= 0 && sx - rx - 2 <= size && sy + ry + 2 >= 0 && sy - ry - 2 <= size) copies.push([sx, sy, rx, ry, i % 4]);
      }
    }
    copies.sort((a, b2) => a[1] - b2[1]);
    for (const [x, y, rx, ry, tone] of copies) boulder(g, x, y, rx, ry, c, tone);
  }
  // The surface of a mountain: clean, even grey stone, as the classic maps fill a mountain's top - a few
  // broad soft patches and the odd thin crack, nothing busy. size: the square it fills (seamless at 96).
  function rockSurface(g, r, size = TILE, v = 138) {
    rect(g, gray(v, 2), 0, 0, size, size);
    for (let i = 0; i < size / 6; i++) {
      const x = r() * size, y = r() * size, rx = 6 + r() * 10, ry = 4 + r() * 6, c = r() < 0.5 ? gray(v - 8, 2) : gray(v + 8, 2);
      for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) ellipse(g, c, x + dx, y + dy, rx, ry);
    }
    for (let i = 0; i < size / 16; i++) { // thin cracks, lit along one side
      let x = 4 + r() * (size - 8), y = 4 + r() * (size - 8);
      for (let k = 0; k < 4; k++) { const nx = x + (r() - 0.3) * 6, ny = y + 2 + r() * 3; line(g, gray(v - 40, 2), 1, x, y, nx, ny); line(g, gray(v + 22, 2), 1, x + 1, y, nx + 1, ny); x = nx; y = ny; }
    }
    for (let i = 0; i < size / 10; i++) { const x = (r() * size) | 0, y = (r() * size) | 0; rect(g, gray(v - 30, 2), x, y + 1, 2, 1); rect(g, gray(v + 30, 2), x, y, 2, 1); }
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
  // A stone wall face: big irregular blocks in dark mortar, each lit along its top. light: how pale.
  function stoneBlocks(g, r, light, mortar) {
    rect(g, mortar, 0, 0, TILE, TILE);
    for (let row = 0; row < 3; row++) {
      const y = row * 11 - 1;
      let x = row % 2 ? -8 : -((r() * 5) | 0);
      while (x < TILE) {
        const w = 10 + ((r() * 8) | 0), v = light + ((r() * 22) | 0);
        rect(g, gray(v - 26, 4), x + 1, y + 1, w - 1, 10);
        rect(g, gray(v, 4), x + 1, y + 1, w - 2, 8);
        rect(g, gray(v + 22, 4), x + 1, y + 1, w - 2, 1);
        rect(g, gray(v + 12, 4), x + 1, y + 2, 1, 7);
        x += w;
      }
    }
  }
  // A timber wall face: upright planks between dark posts, a beam along the top.
  function timber(g, r, dark) {
    rect(g, `rgb(${70 - dark},${42 - dark},${20 - dark})`, 0, 0, TILE, TILE);
    for (let x = 0; x < TILE; x += 4) {
      const v = ((r() * 16) | 0) - dark;
      rect(g, `rgb(${132 + v},${88 + v},${48 + v})`, x, 3, 3, 29);
      rect(g, `rgb(${150 + v},${104 + v},${60 + v})`, x, 3, 1, 29);
      if (r() < 0.4) rect(g, `rgb(${104 + v},${66 + v},${34 + v})`, x + 1, 8 + ((r() * 18) | 0), 1, 3); // a knot
    }
    for (const x of [0, 16]) { rect(g, `rgb(${84 - dark},${52 - dark},${26 - dark})`, x, 0, 3, TILE); rect(g, `rgb(${110 - dark},${72 - dark},${38 - dark})`, x, 0, 1, TILE); }
    rect(g, `rgb(${96 - dark},${60 - dark},${30 - dark})`, 0, 0, TILE, 3); rect(g, `rgb(${130 - dark},${88 - dark},${48 - dark})`, 0, 0, TILE, 1);
  }
  // A temple wall face: pale carved stone, a frieze of knotwork along the top, blocks below.
  function carvedStone(g, r, dark) {
    const c = v => gray(v - dark, 0).replace(/rgb\((\d+),(\d+),(\d+)\)/, (m, a, b2, d) => `rgb(${+a + 6},${+b2 + 2},${+d - 10})`);
    rect(g, c(120), 0, 0, TILE, TILE);
    rect(g, c(150), 0, 1, TILE, 10); rect(g, c(176), 0, 1, TILE, 1); rect(g, c(110), 0, 10, TILE, 1);
    for (let x = 0; x < TILE; x += 8) { // the knotwork
      g.strokeStyle = c(104); g.lineWidth = 1.5;
      g.beginPath(); g.arc(x + 4, 6, 2.5, 0, Math.PI * 2); g.stroke();
      rect(g, c(170), x + 3, 3, 1, 1);
    }
    for (const [y, off] of [[12, 0], [22, 8]]) for (let x = -off; x < TILE; x += 16) {
      rect(g, c(140), x + 1, y, 15, 9); rect(g, c(166), x + 1, y, 15, 1); rect(g, c(112), x + 1, y + 8, 15, 1);
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
    wall_stone: { south: (g, r) => stoneBlocks(g, r, 118, '#3a3a3e'), east: (g, r) => stoneBlocks(g, r, 84, '#28282c'), top: (g, r) => capStone(g, r, 158) },
    wall_wood: { south: (g, r) => timber(g, r, 0), east: (g, r) => timber(g, r, 30), top: (g, r) => capWood(g, r) },
    wall_temple: { south: (g, r) => carvedStone(g, r, 0), east: (g, r) => carvedStone(g, r, 34), top: (g, r) => capStone(g, r, 186) },
    wall_sandstone: { south: (g, r) => sandBricks(g, r, 0), east: (g, r) => sandBricks(g, r, 40), top: '#e0c48a' },
  };
  // The tops of walls: dressed stone with a bevel, or a wooden beam.
  function capStone(g, r, v) {
    rect(g, gray(v, 4), 0, 0, TILE, TILE);
    for (let x = 0; x < TILE; x += 8) { rect(g, gray(v - 30, 4), x, 0, 1, TILE); rect(g, gray(v + 18, 4), x + 1, 0, 1, TILE); }
    for (let i = 0; i < 4; i++) rect(g, gray(v - 16, 4), (r() * 30) | 0, (r() * 30) | 0, 2, 1);
  }
  function capWood(g, r) {
    rect(g, '#8a5a2c', 0, 0, TILE, TILE);
    for (let y = 0; y < TILE; y += 6) { rect(g, '#a8743e', 0, y, TILE, 1); rect(g, '#6a4220', 0, y + 5, TILE, 1); }
  }
  function styledWall(g, r, shape, material) {
    const st = WALL_STYLES[material];
    wallBlock(g, shape, { south: () => st.south(g, r), east: () => st.east(g, r), top: typeof st.top === 'function' ? () => st.top(g, r) : st.top });
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
      top: typeof st.top === 'function' ? () => st.top(g, r) : st.top,
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
  // A shop sign: an iron arm out from the wall with a board hanging from it, and its picture.
  function hangingSign(g, board, picture) {
    rect(g, '#2e2e34', 4, 3, 22, 2); rect(g, '#5a5a62', 4, 3, 22, 1); poly(g, '#2e2e34', [4, 5, 4, 9, 9, 5]);
    for (const x of [9, 22]) rect(g, '#3a3a40', x, 5, 1, 3);
    rect(g, '#2a1c10', 7, 7, 18, 17);
    rect(g, board, 8, 8, 16, 15);
    rect(g, 'rgba(255,255,255,0.18)', 8, 8, 16, 1); rect(g, 'rgba(0,0,0,0.25)', 8, 22, 16, 1);
    picture();
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

  // shape: whether the bridge goes on past this tile on its left and right side (looking along it),
  // '00' to '11': a wide bridge is one deck, with a beam and water only along its outer sides.
  function bridge(g, r, eastWest, water = '#2d63b5', shape = '00') {
    if (eastWest) { g.translate(16, 16); g.rotate(Math.PI / 2); g.translate(-16, -16); }
    const left = shape[0] === '1', right = shape[1] === '1', x0 = left ? 0 : 3, x1 = right ? TILE : 29;
    rect(g, water, 0, 0, TILE, TILE);
    rect(g, '#4a2c12', x0, 0, x1 - x0, TILE); // dark wood in the gaps between the planks
    for (let y = 0; y < TILE; y += 5) {
      const v = (r() * 18) | 0;
      rect(g, `rgb(${132 + v},${88 + v},${46 + v})`, x0, y, x1 - x0, 4);
      rect(g, 'rgba(0,0,0,0.35)', x0, y + 4, x1 - x0, 1);
      rect(g, 'rgba(255,255,255,0.12)', x0, y, x1 - x0, 1);
      if (left || right) rect(g, 'rgba(0,0,0,0.25)', 16 + ((y * 7) % 9) - 4, y, 1, 4); // the planks' joints, staggered
    }
    for (const [x, open] of [[1, left], [27, right]]) if (!open) { rect(g, '#4a2c12', x, 0, 4, TILE); rect(g, '#6a4422', x, 0, 4, 1); rect(g, '#7a5230', x + 1, 0, 1, TILE); }
  }

  // A field of grass size x size pixels that wraps round at its edges: soft lighter and darker patches
  // and blades, spread so that no tile looks like the next.
  function grassField(g, r, size) {
    rect(g, '#3a7d22', 0, 0, size, size);
    const wrapped = draw => { for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) draw(ox, oy); };
    for (let i = 0; i < size / 6; i++) {
      const x = r() * size, y = r() * size, rx = 6 + r() * 9, ry = 4 + r() * 5, c = i % 3 === 0 ? '#33711d' : i % 3 === 1 ? '#428a27' : '#3e8324';
      wrapped((ox, oy) => ellipse(g, c, x + ox, y + oy, rx, ry));
    }
    for (let i = 0; i < size * size / 30; i++) {
      const x = (r() * size) | 0, y = (r() * size) | 0, dark = r() < 0.55, c = dark ? '#255e16' : '#4f9a30';
      wrapped((ox, oy) => {
        rect(g, c, x + ox, y + oy, 1, 2);
        rect(g, c, x + 1 + ox, y - 1 + oy, 1, 2);
        if (!dark) rect(g, '#6cb84a', x + 1 + ox, y - 1 + oy, 1, 1);
      });
    }
  }
  const BRIDGES = new Set(['bridge_ns', 'bridge_ew', 'sewer_bridge_ns', 'sewer_bridge_ew']);

  // --- things in 2.5D --------------------------------------------------------------
  // Raised things stand up from their tile: on a 96x96 canvas with their tile in the bottom-right
  // corner (so even tall ones have room and are never cut off), every point (u, v) on the tile at
  // height z is drawn z pixels up and z pixels to the left - the same slant as walls and roofs. So
  // you see each thing's top, its front (south) face and a slice of its east face - not a flat picture.
  // Everything that stands on a tile is drawn in this one slant, statues, the scarecrow and dummies too (built of
  // blocks and round bodies, as a pillar is). Only the living (people, creatures) and growing things stand upright.
  const RAISED = new Set(['pillar', 'altar', 'table', 'counter', 'crate', 'chest', 'bed', 'bookshelf', 'depot', 'barrel', 'sack', 'basket', 'plant', 'haystack', 'well', 'chair', 'chair_east',
    'chair_west', 'chair_north', 'bench',
    'stall', 'lamppost', 'lamppost_off', 'signpost', 'noticeboard', 'planter', 'apple_crate', 'anvil', 'statue', 'gravestone', 'dummy',
    'scarecrow',
    'woodpile', 'fountain', 'fountain_rim', 'wagon', 'fish_rack', 'sewer_ladder', 'cave_ladder', 'bell_rope', 'chimney', 'crypt_gate', 'shaft_rope_top', 'shaft_rope', 'shaft_rope_cut', 'shaft_hole',
    'sarcophagus', 'founder_tomb', 'obelisk', 'torch', 'torch_out', 'throne', 'tent', 'hedge', 'totem', 'flagpole', 'bars',
    'fallen_pillar', 'fence', 'cauldron', 'beehive', 'igloo', 'windmill', 'boat', 'wreck', 'treasure', 'trunk']);
  const LEAN = 1; // how far left things lean per pixel of height: exactly as walls and roofs do
  const HEIGHT = 0.6; // a floor is 32 pixels high: things are drawn in proportion to that (a pillar reaches the ceiling)
  const P = (u, v, z) => [64 + u - z * HEIGHT * LEAN, 64 + v - z * HEIGHT];
  const FLOOR_Z = 32 / HEIGHT; // one floor's height in P()'s heights: what reaches it meets the floor above
  // An open hatch: the tile has no floor, only a frame of boards round a square opening in the middle, with its lid
  // thrown open, flat on the boards to the east. middle() draws what stands in the opening (the rope): after the back
  // of the frame and before its front, so it rises up in front of what is behind it.
  function hatch(g, middle) {
    const wood = { top: '#8a5a2c', south: '#6a4220', east: '#4e2e14', edge: '#a8743e' };
    const lid = { top: '#9a6a38', south: '#7a4e26', east: '#5e3a1a', edge: '#c08a4e' };
    prism(g, 0, 0, 32, 9, 0, 3, wood);   // the back of the frame
    prism(g, 0, 9, 9, 23, 0, 3, wood);   // its west side
    poly(g, 'rgba(0,0,0,0.35)', [...P(9, 9, 0), ...P(23, 9, 0), ...P(23, 10.5, 0), ...P(10.5, 10.5, 0), ...P(10.5, 23, 0), ...P(9, 23, 0)]); // shade inside its rim
    middle();
    prism(g, 23, 9, 32, 23, 0, 3, wood); // its east side
    prism(g, 0, 23, 32, 32, 0, 3, wood); // and the front
    prism(g, 24, 8, 31, 24, 3, 5, lid);  // the lid, thrown open on the boards
    for (const v of [12, 16, 20]) line(g, 'rgba(40,24,10,0.5)', 1, ...P(24, v, 5), ...P(31, v, 5));
    const [rx, ry] = P(26, 16, 5); rect(g, '#5a5a62', rx, ry - 1, 2, 2); // its iron ring
  }
  // The bell rope as a thin column standing in the middle of the tile, from height z0 to z1; grip: its striped sally.
  function bellRope(g, z0, z1, grip) {
    const rope = { top: '#d8b47a', south: '#c8a46a', east: '#9a7a48', edge: '#e8d0a0' };
    prism(g, 15, 15, 17, 17, z0, z1, rope);
    if (grip) for (let z = 18; z < 36; z += 3) prism(g, 14.5, 14.5, 17.5, 17.5, z, z + 3, (z / 3) % 2 ? { top: '#c03030', south: '#a82828', east: '#801c1c' } : { top: '#f0e8d8', south: '#e0d8c8', east: '#b8b0a0' });
  }
  // The shadow on the floor: right under the thing's foot (the middle of its tile), shifted a little
  // down-right, away from the light, so the thing stands on it rather than floating above it.
  const floorShadow = (g, rx = 13, ry = 3) => ellipse(g, 'rgba(0,0,0,0.22)', 64 + 17, 64 + 18, rx + 1, Math.max(ry * 2.5, rx * 0.55));
  // A block from (u0, v0) to (u1, v1) on the tile, z0 to z1 high: its east face, south face and top.
  // c: { top, south, east } colours, and edge (the lit front edge of its top).
  function prism(g, u0, v0, u1, v1, z0, z1, c) {
    poly(g, c.east, [...P(u1, v0, z0), ...P(u1, v1, z0), ...P(u1, v1, z1), ...P(u1, v0, z1)]);
    poly(g, c.south, [...P(u0, v1, z0), ...P(u1, v1, z0), ...P(u1, v1, z1), ...P(u0, v1, z1)]);
    poly(g, c.top, [...P(u0, v0, z1), ...P(u1, v0, z1), ...P(u1, v1, z1), ...P(u0, v1, z1)]);
    line(g, c.edge || 'rgba(255,255,255,0.35)', 1, ...P(u0, v1, z1), ...P(u1, v1, z1));
    line(g, 'rgba(0,0,0,0.35)', 1, ...P(u1, v1, z0), ...P(u1, v1, z1));
  }
  // A block from (u0, v0) to (u1, v1) at its foot, z0 to z1 high, narrowing by `inset` on every side towards its top
  // (an obelisk's shaft, a windmill's tower): its east face, south face and top. c as for prism.
  function taper(g, u0, v0, u1, v1, z0, z1, inset, c) {
    const i = inset;
    poly(g, c.east, [...P(u1, v0, z0), ...P(u1, v1, z0), ...P(u1 - i, v1 - i, z1), ...P(u1 - i, v0 + i, z1)]);
    poly(g, c.south, [...P(u0, v1, z0), ...P(u1, v1, z0), ...P(u1 - i, v1 - i, z1), ...P(u0 + i, v1 - i, z1)]);
    poly(g, c.top, [...P(u0 + i, v0 + i, z1), ...P(u1 - i, v0 + i, z1), ...P(u1 - i, v1 - i, z1), ...P(u0 + i, v1 - i, z1)]);
    line(g, 'rgba(0,0,0,0.35)', 1, ...P(u1, v1, z0), ...P(u1 - i, v1 - i, z1));
  }
  // A pyramid on the square (u0, v0)-(u1, v1) at height z, its point h higher: the faces you see (west, north lit; south, east).
  function pyramid(g, u0, v0, u1, v1, z, h, c) {
    const apex = P((u0 + u1) / 2, (v0 + v1) / 2, z + h);
    poly(g, c.top, [...P(u0, v0, z), ...P(u1, v0, z), ...apex]);
    poly(g, c.top, [...P(u0, v0, z), ...P(u0, v1, z), ...apex]);
    poly(g, c.east, [...P(u1, v0, z), ...P(u1, v1, z), ...apex]);
    poly(g, c.south, [...P(u0, v1, z), ...P(u1, v1, z), ...apex]);
  }
  // A chair facing `facing` (n, e, s, w): the back stands on the opposite edge.
  function drawChair(g, facing) {
    floorShadow(g, 9, 3);
    const leg = { top: '#6a4220', south: '#5a3618', east: '#40260f', edge: '#8a5a2c' };
    const wood = { top: '#b07a42', south: '#8a5a2c', east: '#6a4220', edge: '#d09a5e' };
    const [u0, v0, u1, v1] = [10, 10, 22, 22], seat = 12, top = 38;
    // the back: two posts and two rails on the edge behind the sitter
    const back = { n: [u0, v1 - 2, u1, v1], s: [u0, v0, u1, v0 + 2], e: [u0, v0, u0 + 2, v1], w: [u1 - 2, v0, u1, v1] }[facing];
    const alongU = facing === 'n' || facing === 's';
    const posts = alongU ? [[back[0], back[1], back[0] + 2, back[3]], [back[2] - 2, back[1], back[2], back[3]]]
      : [[back[0], back[1], back[2], back[1] + 2], [back[0], back[3] - 2, back[2], back[3]]];
    const legs = [[u0, v0], [u1 - 2, v0], [u0, v1 - 2], [u1 - 2, v1 - 2]];
    const behind = ([u, v]) => (facing === 's' ? v < 16 : facing === 'n' ? v > 16 : facing === 'e' ? u < 16 : u > 16);
    // what's further back is drawn first: back legs and the back, then the seat, then the front legs
    const far = ([u, v]) => u - v; // further up-left on screen = drawn earlier
    for (const [u, v] of legs.filter(l => !behind(l) || true).sort((a, b) => (a[1] + a[0]) - (b[1] + b[0]))) {
      if (v > 12 && u > 12) continue; // the front-right leg goes in front of the seat, below
      prism(g, u, v, u + 2, v + 2, 0, seat, leg);
    }
    const drawBack = () => {
      for (const [a, b, c, d] of posts) prism(g, a, b, c, d, seat, top, leg);
      for (const z of [seat + 11, top - 4]) prism(g, back[0], back[1], back[2], back[3], z, z + 4, wood);
    };
    if (facing === 's' || facing === 'e') drawBack();
    prism(g, u0, v0, u1, v1, seat, seat + 2, wood);
    prism(g, u1 - 2, v1 - 2, u1, v1, 0, seat, leg);
    if (facing === 'n' || facing === 'w') drawBack();
  }
  // A round body standing on the tile, centred at (cu, cv), from z0 up to z1, as a stack of slices:
  // rad(t) is its radius at t (0 bottom .. 1 top); c: { dark, light, mid, edge } colours, lit from the left.
  function drum(g, cu, cv, z0, z1, rad, c) {
    for (let z = z0; z <= z1; z += 1) {
      const [x, y] = P(cu, cv, z), r = rad((z - z0) / (z1 - z0));
      const grad = g.createLinearGradient(x - r, y, x + r, y);
      grad.addColorStop(0, c.edge); grad.addColorStop(0.25, c.light); grad.addColorStop(0.55, c.mid); grad.addColorStop(1, c.dark);
      g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    return P(cu, cv, z1);
  }
  // The front half of a ring round a drum at height z (a hoop, a rim, a band).
  function frontRing(g, cu, cv, z, r, colour, width = 2) {
    const [x, y] = P(cu, cv, z);
    g.lineWidth = width; g.strokeStyle = colour; g.beginPath(); g.arc(x, y, r, -Math.PI / 4, Math.PI * 3 / 4); g.stroke();
  }
  // --- big things made of several tiles ---------------------------------------------------------
  // Each is drawn whole, with its outline, on one canvas (its north-west tile's corner at 64, 64, so P()
  // works over its whole footprint); then every tile it covers shows the part of that drawing that rises
  // above it: the tile and the strip up-left of it. Those strips fit together without a seam.
  //   w, h: its size in tiles; draw(g, frame)
  const BIG = {
    bed: { w: 1, h: 2, draw(g) {
      shadow(g, 64 + 18, 64 + 36, 15, 26);
      const frame = { top: '#7a4e26', south: '#6a4220', east: '#4e2e14', edge: '#9a6a38' };
      prism(g, 3, 1, 29, 4, 0, 24, { top: '#8a5a2c', south: '#6e4422', east: '#55331a', edge: '#a8743e' }); // the headboard
      prism(g, 3, 4, 29, 61, 0, 8, frame);
      prism(g, 5, 5, 27, 59, 8, 11, { top: '#f4f2ec', south: '#d8d4cc', east: '#b8b4ac', edge: '#ffffff' });   // the mattress
      prism(g, 7, 6, 25, 15, 11, 14, { top: '#ffffff', south: '#e4e0d8', east: '#c8c4bc', edge: '#ffffff' });  // the pillow
      prism(g, 5, 19, 27, 59, 11, 12, { top: '#b8302e', south: '#8e2220', east: '#701a18', edge: '#d84a46' }); // the blanket
      prism(g, 5, 19, 27, 23, 12, 13, { top: '#e8e4dc', south: '#c8c4bc', east: '#a8a49c', edge: '#ffffff' }); // its folded-back sheet
      prism(g, 3, 59, 29, 62, 0, 14, { top: '#8a5a2c', south: '#6e4422', east: '#55331a', edge: '#a8743e' }); // the footboard
    } },
    fountain: { w: 2, h: 2, draw(g, frame) {
      shadow(g, 64 + 34, 64 + 35, 30, 30);
      const stone = { light: '#d4d4d8', mid: '#a8a8ae', dark: '#6e6e76', edge: '#8a8a92' };
      drum(g, 32, 32, 0, 9, () => 29, stone);
      for (const z of [3, 6]) frontRing(g, 32, 32, z, 29, 'rgba(70,70,76,0.6)', 1);
      const [bx, by] = P(32, 32, 9);
      ellipse(g, '#9a9aa2', bx, by, 29, 29); ellipse(g, '#2d63b5', bx, by, 25, 25);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + frame * 0.35; ellipse(g, 'rgba(170,205,245,0.7)', bx + Math.cos(a) * 17, by + Math.sin(a) * 17, 3, 1.5); }
      drum(g, 32, 32, 5, 30, t => 5 - 1.5 * Math.sin(t * Math.PI), stone);
      drum(g, 32, 32, 30, 34, t => 7 + 5 * t, stone);
      const [tx, ty] = P(32, 32, 34); ellipse(g, '#5b8fd6', tx, ty, 10, 10);
      const j = frame % 2;
      line(g, 'rgba(220,238,255,0.95)', 2, tx, ty, tx, ty - 10 - j);
      for (let i = 0; i < 6; i++) { const a = -0.4 + i * 0.55; line(g, 'rgba(210,232,255,0.7)', 1, tx + Math.cos(a) * 11, ty + Math.sin(a) * 11, bx + Math.cos(a) * 20, by + Math.sin(a) * 20 + j); }
    } },
  };
  // The bell of Oakvale: a great bronze bell hanging upright (as figures stand upright) from the crossbeam of a
  // heavy oak frame that stands in the tiles' slant (its rope runs from a wheel beside it: shaft_rope_top). Its frame reaches two-thirds of the way to the roof.
  BIG.bell = { w: 2, h: 2, draw(g) {
    shadow(g, 64 + 34, 64 + 36, 30, 24);
    const oak = { top: '#6a4422', south: '#523418', east: '#3e2610', edge: '#8a5a2e' };
    prism(g, 2, 2, 62, 62, 0, 4, { top: '#7a7a82', south: '#5e5e66', east: '#46464e', edge: '#9a9aa2' }); // a stone plinth
    for (const u of [4, 54]) { // the two A-frames, west and east
      prism(g, u, 8, u + 7, 15, 4, 86, oak);
      prism(g, u, 49, u + 7, 56, 4, 86, oak);
      prism(g, u, 8, u + 7, 56, 80, 86, oak);
    }
    // The bell itself, round, in the tiles' slant: built up in slices from its mouth to its crown (as the
    // fountain and the well are), so it hangs straight down from the beam along the same slant as the frame.
    const bronze = { edge: '#6a4410', light: '#f4d470', mid: '#c48a32', dark: '#5a3a0c' };
    const mouth = 34, top = 78;
    const profile = t => (t < 0.12 ? 24 - t * 40 : t < 0.8 ? 19.2 - (t - 0.12) * 11 : 11.7 * Math.sqrt(Math.max(0, 1 - ((t - 0.8) / 0.2) ** 2)) + 0.5);
    drum(g, 32, 32, mouth, top, profile, bronze);
    frontRing(g, 32, 32, mouth + 1, 24, 'rgba(70,44,8,0.85)', 2); // the lip
    for (const [z, r] of [[mouth + 5, 19.5], [mouth + 22, 16.4], [mouth + 25, 16]]) frontRing(g, 32, 32, z, r, 'rgba(90,56,10,0.6)', 1.5); // bands
    for (let i = 0; i < 5; i++) { const [x, y] = P(32, 32, mouth + 14); rect(g, 'rgba(90,56,10,0.55)', x - 10 + i * 5, y + 9, 2, 2); } // letters round its waist
    drum(g, 32, 32, top, 86, () => 3, { edge: '#3a2408', light: '#7a5218', mid: '#5a3a10', dark: '#3a2408' }); // the crown, up to the beam
    prism(g, 0, 26, 64, 38, 86, 94, oak); // the crossbeam, over both frames
  } };
  const PARTS = {
    bell_nw: ['bell', 0, 0], bell_ne: ['bell', 1, 0], bell_sw: ['bell', 0, 1], bell_se: ['bell', 1, 1],
    bed_head: ['bed', 0, 0], bed_foot: ['bed', 0, 1],
    fountain_nw: ['fountain', 0, 0], fountain_ne: ['fountain', 1, 0], fountain_sw: ['fountain', 0, 1], fountain_se: ['fountain', 1, 1],
  };
  function bigPart(id, frame) {
    const [name, col, row] = PARTS[id], b = BIG[name];
    const whole = cached(`bigthing:${name}:${frame}`, g => inked(g, f => b.draw(f, frame)), b.w * TILE + 64, b.h * TILE + 64);
    return cached(`part:${id}:${frame}`, g => {
      g.beginPath(); // this tile, and the strip rising up-left from it
      for (const [x, y] of [[0, 0], [32, 0], [96, 64], [96, 96], [64, 96], [0, 32]]) g.lineTo(x, y);
      g.closePath();
      g.clip();
      g.drawImage(whole, -col * TILE, -row * TILE);
    }, 3 * TILE);
  }

  // A street lamp: a stone foot, an iron post and a lantern (glowing when lit) under a little roof.
  function streetLamp(g, lit) {
    floorShadow(g, 7, 2);
    const iron = { top: '#3a3a40', south: '#2a2a30', east: '#1e1e22', edge: '#5a5a62' };
    prism(g, 12, 13, 20, 21, 0, 4, { top: '#9a9a96', south: '#7a7a76', east: '#5e5e5a', edge: '#bcbcb8' });
    prism(g, 15, 16, 17, 18, 4, 40, iron);
    prism(g, 12, 13, 20, 21, 40, 42, iron);
    prism(g, 13, 14, 19, 20, 42, 52, { top: '#ffe090', south: lit ? '#ffe9a8' : '#59626e', east: lit ? '#e8c060' : '#3a4048', edge: '#fff4c8' });
    onSouth(g, 21, f => { rect(f, '#2a2a30', 15, 42, 1, 10); rect(f, '#2a2a30', 12, 47, 8, 1); });
    prism(g, 12, 13, 20, 21, 52, 54, { top: '#6a6a72', south: '#3a3a40', east: '#2a2a30', edge: '#8a8a92' });
    prism(g, 15, 16, 17, 18, 54, 58, iron); // the finial
  }
  // Draw on a block's south face: fn(g) in face coordinates, u along the face, z up it.
  function onSouth(g, v, fn) {
    g.save();
    g.setTransform(1, 0, -LEAN * HEIGHT, -HEIGHT, 64, 64 + v); // (u, z) -> P(u, v, z)
    fn(g);
    g.restore();
  }
  // A round column standing at (cu, cv), radius rad, from z0 up to z1: lit on its left, dark on its right.
  function column(g, cu, cv, rad, z0, z1, c) {
    const [bx, by] = P(cu, cv, z0), [tx, ty] = P(cu, cv, z1);
    const n = Math.hypot(1, LEAN), kx = rad / n, ky = (rad * LEAN) / n; // across the column's axis
    const grad = g.createLinearGradient(bx - kx, by + ky, bx + kx, by - ky);
    grad.addColorStop(0, c.light); grad.addColorStop(0.45, c.mid); grad.addColorStop(1, c.dark);
    g.fillStyle = grad;
    g.beginPath(); g.arc(bx, by, rad, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(bx + kx, by - ky); g.lineTo(tx + kx, ty - ky); g.lineTo(tx - kx, ty + ky); g.lineTo(bx - kx, by + ky); g.fill();
    ellipse(g, c.top, tx, ty, rad, rad);
  }

  // --- map tiles: draw(g, rng, animationFrame, shape, material) ---------------------
  // Trees, walls and things on walls are 64x64, drawn with their tile in the bottom-right quarter.
  const DRAW = {
    // Grass: soft light and dark patches, and blades everywhere, each lit at the tip.
    // Grass: one clean green with a few tufts, each a small V of darker blades lit at the tips.
    // Grass: rich green, thick with blades in little clumps of dark and light green.
    // Grass: deep green, thick with blades in clumps of dark and light green.
    grass(g, r) { // (on the map grass is drawn seamless: grassField; this is a single tile of it)
      rect(g, '#3a7d22', 0, 0, TILE, TILE);
      for (let i = 0; i < 4; i++) ellipse(g, i % 2 ? '#428a27' : '#33711d', r() * 32, r() * 32, 5 + r() * 4, 3 + r() * 3);
      for (let i = 0; i < 34; i++) {
        const x = (r() * 31) | 0, y = 2 + ((r() * 29) | 0), dark = r() < 0.55;
        rect(g, dark ? '#255e16' : '#4f9a30', x, y, 1, 2);
        rect(g, dark ? '#255e16' : '#4f9a30', x + 1, y - 1, 1, 2);
        if (!dark) rect(g, '#6cb84a', x + 1, y - 1, 1, 1);
      }
    },
    // Dirt: trodden earth with darker ruts, clods lit from the top-left, and a few small stones.
    // Dirt: plain earth with a few small stones.
    dirt(g, r) {
      rect(g, '#93714a', 0, 0, TILE, TILE);
      for (let i = 0; i < 2; i++) ellipse(g, '#8a6943', 4 + r() * 24, 4 + r() * 24, 5 + r() * 3, 3);
      for (let i = 0; i < 4; i++) {
        const x = 2 + ((r() * 27) | 0), y = 2 + ((r() * 27) | 0);
        rect(g, '#6f5236', x, y + 1, 3, 1); rect(g, '#b0916a', x, y, 2, 1);
      }
    },
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
    // The walkways of a sewer: big worn flagstones, damp, with dark joints.
    sewer(g, r) {
      rect(g, '#262a24', 0, 0, TILE, TILE);
      for (const [x0, y0, w, h] of [[0, 0, 16, 16], [16, 0, 16, 11], [16, 11, 16, 21], [0, 16, 16, 16]]) {
        const v = 84 + ((r() * 18) | 0);
        rect(g, `rgb(${v},${v + 4},${v - 6})`, x0 + 1, y0 + 1, w - 1, h - 1);
        rect(g, `rgb(${v + 14},${v + 18},${v + 6})`, x0 + 1, y0 + 1, w - 1, 1);
        rect(g, `rgb(${v - 22},${v - 18},${v - 26})`, x0 + 1, y0 + h - 1, w - 1, 1);
      }
      for (let i = 0; i < 4; i++) ellipse(g, 'rgba(40,62,30,0.3)', 3 + r() * 26, 3 + r() * 26, 2 + r() * 4, 1 + r() * 2); // damp patches
      for (let i = 0; i < 14; i++) rect(g, r() < 0.5 ? 'rgba(20,24,18,0.5)' : 'rgba(130,150,110,0.3)', (r() * 32) | 0, (r() * 32) | 0, 1, 1);
    },
    // A drop into the dark: nearly black, a little rough rock catching the light.
    pit(g, r) { noise(g, r, '#060504', ['#0e0c0a', '#14110e', '#0a0807'], 40, 2); },
    // The floor of a crypt: big dark grave slabs, cracked and dusty.
    crypt(g, r) {
      rect(g, '#1c1d22', 0, 0, TILE, TILE);
      for (const [x0, y0, w, h] of [[0, 0, 20, 14], [20, 0, 12, 14], [0, 14, 12, 18], [12, 14, 20, 18]]) {
        const v = 72 + ((r() * 16) | 0);
        rect(g, `rgb(${v},${v + 2},${v + 8})`, x0 + 1, y0 + 1, w - 1, h - 1);
        rect(g, `rgb(${v + 16},${v + 18},${v + 24})`, x0 + 1, y0 + 1, w - 1, 1);
        rect(g, `rgb(${v - 20},${v - 18},${v - 12})`, x0 + 1, y0 + h - 1, w - 1, 1);
      }
      for (let i = 0; i < 2; i++) { const x = 3 + r() * 24, y = 3 + r() * 24; line(g, '#26272c', 1, x, y, x + 3 + r() * 4, y + 2 + r() * 3); }
      for (let i = 0; i < 16; i++) rect(g, r() < 0.5 ? 'rgba(10,10,14,0.45)' : 'rgba(160,160,170,0.25)', (r() * 32) | 0, (r() * 32) | 0, 1, 1);
    },
    // The channel down the middle of a sewer: murky green water with scum drifting on it.
    sewer_water(g, r, frame) {
      rect(g, '#2c4630', 0, 0, TILE, TILE);
      for (let i = 0; i < 4; i++) ellipse(g, 'rgba(84,104,48,0.35)', 3 + r() * 26, 3 + r() * 26, 3 + r() * 5, 1.5 + r() * 2);
      for (let i = 0; i < 8; i++) {
        const x = ((r() * TILE) | 0) + frame * 2, y = 1 + ((r() * 30) | 0), w = 3 + ((r() * 5) | 0);
        for (const wrap of [0, -TILE]) rect(g, i % 3 ? '#46663f' : '#7a9a60', x + wrap, y, w, 1);
      }
    },
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
    // Rocky ground: grey-brown stone with a few loose stones on it.
    // Rocky ground you can walk on: big flat grey slabs with dark seams, lit along their top edges.
    // Rocky ground you can walk on: big flat grey slabs with dark seams, lit along their top edges.
    // Rocky ground you can walk on: grey stone, rough, with loose stones and grit lying about.
    mountain(g, r) {
      rockSurface(g, r, TILE, 134);
      for (let i = 0; i < 5; i++) {
        const x = 3 + r() * 26, y = 3 + r() * 26, rx = 1.5 + r() * 2;
        ellipse(g, 'rgba(0,0,0,0.3)', x + 0.5, y + 1, rx + 0.5, rx * 0.7);
        ellipse(g, gray(150 + ((r() * 30) | 0), 2), x, y, rx, rx * 0.7);
        rect(g, gray(200, 2), x - rx * 0.4, y - rx * 0.4, 1, 1);
      }
    },
    // A mountain top you can't walk on: broken rock, boulders and dark clefts.
    // A mountain top you can't walk on: bare rock with a few clefts and loose stones.
    // A mountain top you can't walk on: a field of big grey boulders.
    rock_top(g, r) { rockFace(g, r, ROCK.top); },
    // A red carpet with a gold border and a woven diamond pattern.
    carpet(g) {
      rect(g, '#7a1418', 0, 0, TILE, TILE);
      rect(g, '#b02a2c', 3, 0, 26, TILE);
      for (const x of [3, 28]) rect(g, '#e0a830', x, 0, 1, TILE);
      for (const x of [1, 30]) rect(g, '#c88a24', x, 0, 1, TILE);
      for (let y = 0; y < TILE; y += 8) { poly(g, '#d89a30', [16, y, 20, y + 4, 16, y + 8, 12, y + 4]); poly(g, '#8a1a1e', [16, y + 2, 18, y + 4, 16, y + 6, 14, y + 4]); }
      for (let y = 2; y < TILE; y += 4) { rect(g, '#9a2024', 6, y, 2, 1); rect(g, '#9a2024', 24, y, 2, 1); }
    },
    // Swamp: dark wet ground with a few pools of black water.
    swamp(g, r) {
      rect(g, '#566636', 0, 0, TILE, TILE);
      for (let i = 0; i < 2; i++) { const x = 6 + r() * 20, y = 6 + r() * 20; ellipse(g, '#3a4a2c', x, y, 4, 2); ellipse(g, '#2a3a32', x, y + 0.5, 2.5, 1); }
      for (let i = 0; i < 3; i++) { const x = 2 + ((r() * 27) | 0), y = 3 + ((r() * 26) | 0); rect(g, '#465630', x, y, 1, 3); rect(g, '#6a7a44', x, y - 1, 1, 1); }
    },
    // Cobblestones: round stones of different greys set in dark mortar, each lit from the top-left.
    // Cobblestones: four rows of big rounded stones in dark mortar, each lit along its top-left.
    // Cobblestones: three rows of big rounded stones in dark mortar, each lit along its top-left.
    // Cobblestones: three rows of big rounded stones in dark mortar, each lit along its top-left. The
    // rows meet the next tile without a seam: the top and bottom rows end exactly at the tile's edges,
    // and the middle row has one stone across each edge, the same on every tile.
    cobble(g, r) {
      rect(g, '#2e2c2a', 0, 0, TILE, TILE);
      const stone = (x, y, w, h) => {
        const v = 116 + ((r() * 34) | 0);
        rect(g, gray(v - 34, 2), x + 1, y + 1, w - 1, h);
        rect(g, gray(v, 3), x + 1, y + 1, w - 2, h - 2);
        rect(g, gray(v + 26, 3), x + 2, y + 1, w - 4, 2);
        rect(g, gray(v + 14, 3), x + 1, y + 2, 1, h - 4);
        if (r() < 0.4) rect(g, gray(v - 18, 2), x + 3 + ((r() * (w - 6)) | 0), y + 4 + ((r() * 3) | 0), 2, 1);
        for (const [cx, cy] of [[x + 1, y + 1], [x + w - 1, y + 1], [x + 1, y + h], [x + w - 1, y + h]]) rect(g, '#2e2c2a', cx, cy, 1, 1);
      };
      const row = (y, h, from, to) => { // stones from x = from to x = to, in two or three pieces
        const cut = r() < 0.5 ? [from + ((to - from) / 2 + (r() - 0.5) * 6) | 0] : [from + ((to - from) / 3) | 0, from + ((2 * (to - from)) / 3) | 0];
        [from, ...cut, to].reduce((a, b) => (stone(a, y, b - a, h), b));
      };
      row(-1, 10, 0, TILE);
      stone(-6, 10, 12, 10); stone(TILE - 6, 10, 12, 10); row(10, 10, 6, TILE - 6);
      row(21, 10, 0, TILE);
    },
    // Marble: big pale slabs, two to a tile, with soft grey veins and bevelled edges.
    marble(g, r) {
      for (const [x, y] of [[0, 0], [16, 0], [0, 16], [16, 16]]) {
        const v = 214 + ((r() * 14) | 0);
        rect(g, `rgb(${v},${v - 4},${v - 12})`, x, y, 16, 16);
        rect(g, `rgb(${v + 14},${v + 10},${v + 2})`, x, y, 16, 1); rect(g, `rgb(${v + 14},${v + 10},${v + 2})`, x, y, 1, 16);
        rect(g, `rgb(${v - 40},${v - 44},${v - 52})`, x, y + 15, 16, 1); rect(g, `rgb(${v - 40},${v - 44},${v - 52})`, x + 15, y, 1, 16);
        if (r() < 0.7) { const vx = x + 3 + r() * 9; line(g, `rgba(140,134,124,0.6)`, 1, vx, y + 2, vx + (r() - 0.5) * 8, y + 13); }
      }
    },
    // A wooden floor: long light planks, their ends staggered, with a dark gap between them.
    wood(g, r) {
      rect(g, '#7a5a32', 0, 0, TILE, TILE);
      for (let y = 0; y < TILE; y += 8) {
        const cut = 4 + ((r() * 24) | 0);
        for (const [x0, x1] of [[0, cut], [cut, TILE]]) {
          const v = (r() * 18) | 0;
          rect(g, `rgb(${204 + v},${170 + v},${112 + v})`, x0 + 1, y + 1, x1 - x0 - 1, 6);
          rect(g, `rgb(${226 + v},${196 + v},${140 + v})`, x0 + 1, y + 1, x1 - x0 - 1, 1);
          rect(g, `rgb(${178 + v},${142 + v},${88 + v})`, x0 + 1, y + 6, x1 - x0 - 1, 1);
          if (x1 - x0 > 8) rect(g, `rgb(${186 + v},${150 + v},${96 + v})`, x0 + 3 + ((r() * (x1 - x0 - 6)) | 0), y + 3, 3, 1); // grain
        }
      }
    },
    // Bridges: planks across the way you walk, a beam along each side.
    bridge_ns(g, r, frame, shape) { bridge(g, r, false, undefined, shape); },
    bridge_ew(g, r, frame, shape) { bridge(g, r, true, undefined, shape); },
    sewer_bridge_ns(g, r, frame, shape) { bridge(g, r, false, '#2c4630', shape); },
    sewer_bridge_ew(g, r, frame, shape) { bridge(g, r, true, '#2c4630', shape); },
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
    // Tiled floor: beige and brown squares set as diamonds, each with a lit edge.
    tiles(g, r) {
      rect(g, '#b89870', 0, 0, TILE, TILE);
      for (let j = -1; j < 3; j++) for (let i = -1; i < 3; i++) {
        const cx = i * 16 + (j % 2 ? 8 : 0) + 8, cy = j * 8 + 8, light = (i + j) % 2 === 0;
        poly(g, light ? '#e4d2b0' : '#a07a52', [cx, cy - 8, cx + 8, cy, cx, cy + 8, cx - 8, cy]);
        line(g, light ? '#f4e8cc' : '#b8916a', 1, cx - 7, cy, cx, cy - 7);
      }
    },
    // Gravel: small rounded stones, evenly spread.
    gravel(g, r) {
      rect(g, '#a49c8c', 0, 0, TILE, TILE);
      for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) {
        if (r() < 0.35) continue;
        const x = i * 5.3 + 2 + r() * 2, y = j * 5.3 + 2 + r() * 2;
        rect(g, '#857d6e', x, y + 1, 2, 1); rect(g, '#c4bcac', x, y, 2, 1);
      }
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
    wall_temple: (g, r, frame, shape) => styledWall(g, r, shape, 'wall_temple'),
    wall_sandstone: (g, r, frame, shape) => styledWall(g, r, shape, 'wall_sandstone'),
    wall_block(g, r) {
      wallBlock(g, 'block', { south: () => bricks(g, r, 104, '#4f4f55'), east: () => bricks(g, r, 72, '#36363c'), top: '#8a8a92' });
    },
    // The walls of the crypt: big dark carved blocks.
    wall_crypt(g, r) {
      wallBlock(g, 'block', { south: () => stoneBlocks(g, r, 70, '#16161c'), east: () => stoneBlocks(g, r, 46, '#121216'), top: '#26262c' });
    },
    // The brick walls of the sewers, green with slime at the foot.
    wall_sewer(g, r) {
      wallBlock(g, 'block', {
        south: () => {
          bricks(g, r, 74, '#262824');
          for (let i = 0; i < 7; i++) rect(g, 'rgba(62,92,40,0.55)', r() * 30, 21 + r() * 5, 2 + r() * 4, 11); // slime
          rect(g, 'rgba(24,34,20,0.55)', 0, 28, TILE, 4);
        },
        east: () => bricks(g, r, 52, '#1c1e1c'),
        top: '#34362f',
      });
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
        top: () => rockSurface(g, r),
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
      rockSurface(g, r, TILE, 140);
      for (let v = 3; v < TILE; v += 5) { // worn steps
        rect(g, 'rgba(255,255,255,0.18)', 3, v, 26, 1);
        rect(g, 'rgba(0,0,0,0.22)', 3, v + 1, 26, 1);
      }
      rect(g, 'rgba(0,0,0,0.25)', 0, 0, 3, TILE);
      rect(g, 'rgba(0,0,0,0.15)', 29, 0, 3, TILE);
      for (let i = 0; i < 4; i++) ellipse(g, '#a8a8a4', r() < 0.5 ? 1.5 : 30.5, 4 + r() * 24, 2, 1.5);
      g.restore();
      solidify(g);
    },
    ramp_top() {},
    // Stone steps up a rock face: dressed stone stairs, each step lit along its edge, with stone sides.
    steps(g, r) {
      g.save();
      g.setTransform(...FACES.east);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, TILE); g.lineTo(TILE, TILE); g.closePath(); g.clip();
      stoneBlocks(g, r, 96, '#2e2e32');
      g.restore();
      g.save();
      g.setTransform(1, 0, 1, 2, 0, 0); // (u, v) on the slope -> (u + v, 2v)
      rect(g, '#8e8e8a', 0, 0, TILE, TILE);
      for (let v = 0; v < TILE; v += 4) { // each step: its tread, lit, and its riser, in shade
        rect(g, '#c4c4be', 0, v, TILE, 2);
        rect(g, '#e2e2dc', 0, v, TILE, 1);
        rect(g, '#6e6e6a', 0, v + 2, TILE, 2);
      }
      rect(g, 'rgba(0,0,0,0.12)', 0, 0, 1, TILE);
      g.restore();
      solidify(g);
    },
    steps_top() {},
    door: (g, r, frame, shape, material) => doorInWall(g, r, shape, material, true),
    door_closed: (g, r, frame, shape, material) => doorInWall(g, r, shape, material, false),
    // A fence joins the fences next to it ('wnse' flags, as for walls): a post in the middle of its tile and two rails
    // towards each neighbouring fence, all in the walls' slant. A lone fence is a short stretch east-west.
    fence(g, r, frame, shape) {
      const n = wallSides(/^[01]{4}$/.test(shape) ? shape : '0000'), lone = !n.w && !n.e && !n.n && !n.s;
      const rail = { top: '#b07a42', south: '#8a5a2a', east: '#5e3a18', edge: '#c88e52' };
      const post = { top: '#8a5a30', south: '#6a4422', east: '#4a2c12', edge: '#a8743e' };
      floorShadow(g, 6, 2);
      const rails = (u0, v0, u1, v1) => { for (const z of [9, 18]) prism(g, u0, v0, u1, v1, z, z + 3, rail); };
      // what lies behind the post (north and west) first, then the post, then what lies in front of it
      if (n.n) rails(15, 0, 17, 15);
      if (n.w || lone) rails(0, 15, 15, 17);
      prism(g, 14, 14, 18, 18, 0, 24, post);
      prism(g, 13.5, 13.5, 18.5, 18.5, 24, 25.5, post); // its cap
      if (n.e || lone) rails(18, 15, 32, 17);
      if (n.s) rails(15, 18, 17, 32);
    },

    // A leafy tree: a trunk, and a round crown of three greens, lit from the top-left.
    // A leafy tree: a thick round crown of leaf clusters, dark beneath and bright on top, on a trunk.
    // A leafy tree: a thick round crown of leaf clusters, dark beneath and bright on top, on a trunk.
    tree(g, r) {
      shadow(g, 48, 61, 15, 4);
      rect(g, '#4a2e14', 44, 40, 8, 22); rect(g, '#6a4422', 44, 40, 3, 22);
      line(g, '#4a2e14', 2, 46, 44, 38, 36); line(g, '#4a2e14', 2, 50, 42, 55, 36);
      const leaves = [];
      for (let i = 0; i < 30; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 15; leaves.push([42 + Math.cos(a) * d * 1.1, 26 + Math.sin(a) * d * 0.9]); }
      leaves.sort((p, q) => p[1] - q[1]);
      for (const [x, y] of leaves) ellipse(g, '#163e16', x + 0.5, y + 1, 6, 5);
      for (const [x, y] of leaves) ellipse(g, y > 30 ? '#2a6a22' : '#358230', x, y, 5, 4);
      for (const [x, y] of leaves) if (y < 28 && x < 46) ellipse(g, '#55a43e', x - 1.5, y - 1.5, 2.5, 2);
      for (let i = 0; i < 7; i++) { const [x, y] = leaves[(r() * leaves.length) | 0]; rect(g, '#80c860', x - 2, y - 2, 2, 1); }
    },
    // A crag: a pile of weathered boulders on a mountain top, rising up-left from its tile like a
    // tree, lit from the top-left.
    // A crag: a heap of big grey boulders on a mountain top, rising up-left from its tile like a tree.
    crag(g, r) {
      shadow(g, 48, 60, 15, 3);
      const lumps = [];
      for (let k = 0; k < 5; k++) lumps.push([36 + r() * 22, 42 + r() * 16 - (k === 0 ? 14 : 0), 8 + r() * 5, 6 + r() * 4]);
      lumps.sort((a, b) => a[1] - b[1]);
      lumps.forEach(([x, y, rx, ry], i) => boulder(g, x, y, rx, ry, ROCK.top, i));
    },
    // A fir: four tiers of branches, each lit on its left, darker on its right.
    // A big fir: a dark, ragged cone of needle clusters, lit on its left, with a short trunk.
    // A big fir: a full, ragged cone of needle clusters, lit on its left, with a short trunk.
    pine(g, r) {
      shadow(g, 46, 61, 15, 3);
      rect(g, '#4a2e14', 43, 52, 6, 10); rect(g, '#6a4422', 43, 52, 2, 10);
      for (let ty = 1; ty < 54; ty += 2.5) {
        const w = 2 + (ty / 54) * 19;
        for (let k = 0; k < 6; k++) {
          const x = 46 + (r() - 0.5) * 2 * w, y = ty + r() * 4, left = x < 44;
          poly(g, '#123816', [x - 4, y + 5, x, y - 2, x + 4, y + 5]);                    // its outline
          poly(g, left ? '#2f7a2a' : '#205a22', [x - 3, y + 4, x, y - 1, x + 3, y + 4]);
          if (left && r() < 0.5) rect(g, '#55a440', x - 1, y + 1, 1, 2);
        }
      }
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
    // A round bush with a few red berries.
    bush(g, r) {
      shadow(g, 16, 28, 12, 3);
      for (const [x, y, rad] of [[11, 20, 7], [21, 20, 7], [16, 15, 8]]) ellipse(g, '#2e6a24', x + 1, y + 1.5, rad, rad * 0.85);
      for (const [x, y, rad] of [[11, 20, 7], [21, 20, 7], [16, 15, 8]]) ellipse(g, '#3f8a30', x, y, rad - 1, rad * 0.85 - 1);
      for (const [x, y] of [[9, 17], [14, 11], [19, 17]]) ellipse(g, '#5aa842', x, y, 3, 2);
      for (let i = 0; i < 4; i++) { const x = 8 + ((r() * 16) | 0), y = 14 + ((r() * 9) | 0); rect(g, '#c8303a', x, y, 2, 2); rect(g, '#f08080', x, y, 1, 1); }
    },
    // A boulder: two or three big grey rocks heaped together, in the style of the mountains.
    rock(g, r) {
      shadow(g, 17, 27, 12, 4);
      const n = 2 + ((r() * 2) | 0);
      for (let i = 0; i < n; i++) boulder(g, 10 + i * 6 + r() * 3, 22 - (i % 2) * 5 - r() * 2, 6 + r() * 2.5, 5 + r() * 2, ROCK.top, i);
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

    // A sewer grate: iron bars over a dark drop.
    grate(g) {
      rect(g, '#141210', 7, 7, 18, 18);
      rect(g, '#4a4a50', 6, 6, 20, 2); rect(g, '#4a4a50', 6, 24, 20, 2); rect(g, '#4a4a50', 6, 6, 2, 20); rect(g, '#4a4a50', 24, 6, 2, 20);
      for (let x = 10; x < 24; x += 4) { rect(g, '#5a5a62', x, 8, 2, 16); rect(g, '#8a8a92', x, 8, 1, 16); }
      rect(g, 'rgba(160,200,220,0.25)', 9, 20, 14, 2); // water far below
    },
    // A crate full of red and green apples.
    // A crate full of red and green apples.
    apple_crate(g, r) {
      floorShadow(g, 13, 3);
      prism(g, 5, 6, 27, 26, 0, 12, { top: '#6e4e28', south: '#a07a46', east: '#7a5a30', edge: '#c8a068' });
      onSouth(g, 26, f => { rect(f, '#7e5c32', 5, 6, 22, 1); });
      for (let i = 0; i < 16; i++) {
        const [x, y] = P(8 + (i % 4) * 5.5 + (r() - 0.5), 9 + Math.floor(i / 4) * 4.8, 13);
        ellipse(g, r() < 0.7 ? '#c8302a' : '#7ab040', x, y, 2.4, 2.4); rect(g, '#ffffff', x - 1, y - 1, 1, 1);
      }
    },
    // Fish hung up to dry on a wooden frame.
    // Fish hung up to dry on a wooden frame.
    fish_rack(g) {
      floorShadow(g, 14, 3);
      const wood = { top: '#7a4e26', south: '#5e3a1a', east: '#462a12', edge: '#9a6a38' };
      prism(g, 3, 15, 5, 17, 0, 28, wood); prism(g, 27, 15, 29, 17, 0, 28, wood);
      prism(g, 2, 15, 30, 17, 28, 30, wood);
      onSouth(g, 17, f => { for (const u of [8, 13, 18, 23]) { poly(f, '#8aa0b0', [u, 26, u + 3, 26, u + 3, 16, u + 1.5, 13, u, 16]); rect(f, '#c0d0d8', u, 17, 1, 8); } });
    },
    // A chopping block with an axe in it and split logs.
    // A chopping block with an axe in it, and split logs beside it.
    firewood(g) {
      shadow(g, 16, 29, 13, 3);
      ellipse(g, '#6a4220', 12, 22, 7, 5); rect(g, '#6a4220', 5, 15, 14, 7); ellipse(g, '#c8925a', 12, 15, 7, 3); ellipse(g, '#a8703a', 12, 15, 4, 1.6);
      line(g, '#5a3618', 2, 13, 14, 20, 5); poly(g, '#a8acb4', [17, 4, 24, 4, 24, 9, 19, 9]);
      for (const [x, y] of [[22, 22], [26, 25], [21, 27]]) { ellipse(g, '#8a5a2c', x, y, 4, 2); ellipse(g, '#d8a868', x - 2, y, 1.5, 1.5); }
    },
    // A wooden pier over water: planks on posts.
    pier(g, r) {
      rect(g, '#2d63b5', 0, 0, TILE, TILE);
      for (let y = 0; y < TILE; y += 5) {
        const v = (r() * 16) | 0;
        rect(g, `rgb(${120 + v},${84 + v},${48 + v})`, 0, y, TILE, 4);
        rect(g, 'rgba(0,0,0,0.3)', 0, y + 4, TILE, 1);
        rect(g, 'rgba(255,255,255,0.12)', 0, y, TILE, 1);
        rect(g, '#3a3a40', 3 + ((r() * 26) | 0), y + 1, 1, 1);
      }
    },
    // A sturdy table: a thick top lit from above, its front edge, four legs.
    // A table: a thick wooden top on four legs.
    table(g) {
      floorShadow(g, 15, 3);
      for (const [u, v] of [[4, 6], [26, 6], [4, 24], [26, 24]]) prism(g, u, v, u + 3, v + 3, 0, 13, { top: '#b07a42', south: '#7a4e26', east: '#5e3a1a', edge: '#d09a5e' });
      prism(g, 2, 4, 30, 28, 13, 17, { top: '#b07a42', south: '#7a4e26', east: '#5e3a1a', edge: '#d09a5e' });
      for (const v of [10, 16, 22]) line(g, 'rgba(90,56,26,0.35)', 1, ...P(3, v, 17), ...P(29, v, 17));
    },
    // A shop counter: a long wooden cabinet with panels, a lighter top that runs on to the next one.
    counter(g) {
      prism(g, 0, 8, 32, 25, 0, 14, { top: '#8a5a2c', south: '#6e4422', east: '#55331a', edge: '#a8743e' });
      onSouth(g, 25, f => { for (const u of [2, 18]) { rect(f, '#5e3a1c', u, 2, 12, 9); rect(f, '#7e5230', u + 1, 3, 10, 7); } });
      prism(g, 0, 7, 32, 26, 14, 17, { top: '#c08a50', south: '#8e5c2e', east: '#6e4422', edge: '#e0ac70' });
    },
    // A chest with a rounded lid, iron bands and a brass lock.
    // A chest: a wooden box with a lid, iron bands over it and a brass lock on its front.
    chest(g) {
      floorShadow(g, 14, 3);
      prism(g, 4, 9, 28, 25, 0, 10, { top: '#8a5428', south: '#6a3e1a', east: '#4e2c12', edge: '#a86c38' });
      prism(g, 4, 9, 28, 25, 10, 15, { top: '#a86c38', south: '#7e4c22', east: '#5e3818', edge: '#c88a50' });
      for (const u of [8, 24]) { line(g, '#5a5a62', 2, ...P(u, 25, 0), ...P(u, 25, 15)); line(g, '#5a5a62', 2, ...P(u, 25, 15), ...P(u, 9, 15)); line(g, '#b8b8c0', 1, ...P(u - 1, 25, 0), ...P(u - 1, 25, 15)); }
      onSouth(g, 25, f => { rect(f, '#c89a30', 13, 7, 6, 6); rect(f, '#f0d070', 13, 12, 6, 1); rect(f, '#3a2a10', 15, 8, 2, 3); });
    },
    // A crate seen from the front and a little above: a lit top, planked sides, a brace, nails.
    // A crate: a box of planks with a brace across its front and its top.
    crate(g) {
      floorShadow(g, 14, 3);
      prism(g, 5, 5, 27, 27, 0, 20, { top: '#c8a068', south: '#a07a46', east: '#7a5a30', edge: '#e0bc84' });
      onSouth(g, 27, f => { for (const z of [6, 13]) rect(f, '#7e5c32', 5, z, 22, 1); rect(f, '#6e4e28', 5, 0, 2, 20); rect(f, '#6e4e28', 25, 0, 2, 20); line(f, '#6e4e28', 2, 7, 1, 25, 19); });
      for (const u of [10, 16, 22]) line(g, 'rgba(110,80,40,0.6)', 1, ...P(u, 5, 20), ...P(u, 27, 20));
    },
    // A barrel: staves bulging at the middle, two iron hoops, the lid on top; lit from the top-left.
    // A barrel: a round body of staves with two iron hoops, its lid on top.
// A barrel: staves bulging at the middle, two iron hoops, the lid on top; lit from the top-left.
    // A barrel standing on its tile, in the same slant as everything else: a body of staves that bulges a
    // little, two iron hoops round the half that faces you, and its round lid on top.
    // A barrel standing on its tile, in the same slant as everything else: a body of staves that bulges a
    // little, two iron hoops round the half that faces you, and its round lid on top.
    barrel(g) {
      floorShadow(g, 11, 3);
      const cu = 16, cv = 17, z1 = 21, rad = t => 9 + 1.5 * Math.sin(t * Math.PI);
      drum(g, cu, cv, 0, z1, rad, { edge: '#5a3414', light: '#a8703c', mid: '#8a5628', dark: '#4a2a10' });
      for (const a of [0.15, 0.55, 0.95, 1.35, 1.75, 2.15, 2.55, 2.95]) {
        const ang = -Math.PI / 4 + a;
        g.strokeStyle = 'rgba(50,28,10,0.55)'; g.lineWidth = 1; g.beginPath();
        for (let z = 1; z <= z1 - 1; z++) { const [x, y] = P(cu, cv, z), r = rad(z / z1); const px = x + Math.cos(ang) * r, py = y + Math.sin(ang) * r; z === 1 ? g.moveTo(px, py) : g.lineTo(px, py); }
        g.stroke();
      }
      for (const z of [4, z1 - 4]) { frontRing(g, cu, cv, z, rad(z / z1) + 0.5, '#2e2a28'); frontRing(g, cu, cv, z - 1, rad(z / z1), '#8a8680', 1); }
      const [tx, ty] = P(cu, cv, z1), tr = rad(1);
      ellipse(g, '#3a2210', tx, ty, tr, tr);
      ellipse(g, '#b07a46', tx, ty, tr - 1.5, tr - 1.5);
      for (let k = -6; k <= 6; k += 3) { const h = Math.sqrt(Math.max(0, (tr - 1.5) ** 2 - k * k)); line(g, '#8a5a30', 1, tx + k, ty - h, tx + k, ty + h); }
      ellipse(g, 'rgba(255,230,190,0.35)', tx - 3, ty - 3, 3, 2);
    },
    // A bookshelf against the wall: a tall wooden case with four shelves of books on its front.
    bookshelf(g, r) {
      prism(g, 1, 12, 31, 24, 0, 40, { top: '#8a5a2c', south: '#5e3a1a', east: '#4a2c12', edge: '#a8743e' });
      const colors = ['#8a2a2a', '#2a4a8a', '#2a6a3a', '#8a7a2a', '#5a2a6a', '#a85a2a'];
      onSouth(g, 24, f => {
        for (const z of [3, 13, 23, 33]) {
          rect(f, '#3a2410', 3, z, 26, 7);
          for (let u = 4; u < 28;) { const w = 2 + ((r() * 2) | 0), h = 4 + ((r() * 3) | 0); rect(f, colors[(r() * colors.length) | 0], u, z, w, h); rect(f, 'rgba(255,255,255,0.25)', u, z + h - 1, 1, 1); u += w + (r() < 0.2 ? 1 : 0); }
          rect(f, '#7a4e26', 2, z - 1, 28, 1);
        }
      });
    },
    // A throne: a gilded seat with a red cushion and a tall back, armrests either side, gems on top.
    throne(g) {
      floorShadow(g, 13, 4);
      const gold = { top: '#d0a83a', south: '#b08a28', east: '#8a6a1a', edge: '#f0d060' };
      const red = { top: '#a82830', south: '#8a1a22', east: '#6a1218', edge: '#c84048' };
      prism(g, 4, 6, 28, 28, 0, 4, gold);                  // the dais
      prism(g, 7, 7, 25, 11, 4, 40, gold);                 // the back
      onSouth(g, 11, f => { rect(f, '#8a1a22', 10, 15, 12, 21); rect(f, '#a82830', 11, 16, 10, 19); });
      prism(g, 7, 11, 25, 26, 4, 14, gold);                // the seat
      prism(g, 8, 12, 24, 25, 14, 17, red);                // its cushion
      prism(g, 5, 11, 8, 26, 14, 24, gold);                // the armrests
      prism(g, 24, 11, 27, 26, 14, 24, gold);
      for (const u of [9, 16, 23]) { const [x, y] = P(u, 9, 40); ellipse(g, '#f0d040', x, y - 1, 2, 2); ellipse(g, '#fff8c0', x - 0.5, y - 1.5, 0.8, 0.8); }
    },
    // A battered school trunk: a planked box with brass corners and straps, its lid a little lifted, a sock hanging out.
    trunk(g) {
      floorShadow(g, 13, 4);
      prism(g, 4, 10, 28, 24, 0, 12, { top: '#7a4a26', south: '#6a3a1e', east: '#4e2a14', edge: '#9a6236' });
      prism(g, 4, 9, 28, 24, 12, 16, { top: '#8a5a2e', south: '#7a4a26', east: '#5a3418', edge: '#aa7444' });
      for (const u of [8, 22]) { line(g, '#c8a030', 2, ...P(u, 24, 0), ...P(u, 24, 16)); line(g, '#c8a030', 2, ...P(u, 24, 16), ...P(u, 9, 16)); }
      onSouth(g, 24, f => { rect(f, '#d8b040', 14, 7, 4, 4); rect(f, '#3a2210', 15, 8, 2, 2); });
      const [sx, sy] = P(27, 24, 13); rect(g, '#e8e0d0', sx, sy, 3, 6); rect(g, '#c8c0b0', sx, sy + 5, 4, 2); // the sock
    },
    crops(g, r) {
      for (let x = 3; x < TILE; x += 6) {
        line(g, '#8a7a3a', 1, x, 30, x + 1, 12);
        for (let y = 12; y < 26; y += 4) { ellipse(g, '#d8b040', x + 2, y, 2, 1.5); ellipse(g, '#c8a030', x, y + 2, 2, 1.5); }
      }
    },
    // A statue on a plinth: a bronze figure gone green, in a long coat, holding a sword straight up. Built in the
    // tiles' slant, as a pillar is: every part a block or a round body standing on the plinth.
    statue(g) {
      floorShadow(g, 13, 3);
      const stone = { top: '#c4c4c0', south: '#9a9a96', east: '#76767a', edge: '#e4e4e0' };
      prism(g, 4, 4, 28, 28, 0, 8, stone);
      prism(g, 6, 6, 26, 26, 8, 12, stone);
      const bronze = { top: '#a8d4c0', south: '#6a9a86', east: '#3e6656', edge: '#c8ecdc' };
      const dark = { top: '#5e8c7a', south: '#3e6656', east: '#2a4a3e', edge: '#7aa898' };
      const round = { edge: '#2a4a3e', light: '#b4dccb', mid: '#6a9a86', dark: '#3e6656' };
      prism(g, 11, 14, 15, 19, 12, 22, dark);                  // boots
      prism(g, 17, 14, 21, 19, 12, 22, dark);
      prism(g, 9, 12, 23, 22, 20, 34, bronze);                 // the coat's skirt, wide
      onSouth(g, 22, f => rect(f, 'rgba(30,54,44,0.7)', 15.5, 20, 1, 14)); // its opening
      prism(g, 10, 13, 22, 21, 34, 46, bronze);                // the chest
      prism(g, 9.5, 12.5, 22.5, 21.5, 33, 35, dark);           // the belt
      onSouth(g, 21.5, f => { rect(f, '#d8c070', 14.5, 33, 3, 2); for (const z of [38, 42]) rect(f, '#3e6656', 15.5, z, 1, 1); }); // buckle, buttons
      prism(g, 6.5, 13, 25.5, 20.5, 45, 49, bronze);           // broad shoulders
      prism(g, 6.5, 14, 9.5, 19, 30, 45, bronze);              // the left arm, hanging
      prism(g, 6.5, 14.5, 9.5, 18.5, 27, 30, dark);            // its fist
      prism(g, 22.5, 14, 25.5, 19, 49, 60, bronze);            // the right arm, raised
      prism(g, 14, 15, 18, 19, 49, 51, dark);                  // the neck
      const [hx, hy] = drum(g, 16, 17, 51, 61, t => 4.2 * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) + 1.4, round); // the head
      drum(g, 16, 16.5, 58, 62, t => 4.6 - t * 2, { edge: '#22382f', light: '#5e8c7a', mid: '#3e6656', dark: '#22382f' }); // hair
      const [fx, fy] = [hx, hy + 6]; // the face, on the head's front
      rect(g, '#22382f', fx - 2.5, fy - 0.5, 1.5, 1); rect(g, '#22382f', fx + 1, fy - 0.5, 1.5, 1); rect(g, '#2a4a3e', fx - 0.5, fy + 1, 1, 1.5);
      prism(g, 22.5, 15, 25.5, 18, 60, 62, dark);              // the hilt in the fist
      prism(g, 20.5, 15.8, 27.5, 17.2, 62, 64, bronze);        // the crossguard
      prism(g, 23.3, 16, 24.7, 17, 64, 86, { top: '#d4f4e8', south: '#9ac8b4', east: '#6a9a86', edge: '#f0fff8' }); // the blade
    },
    rails(g) {
      for (let y = 2; y < TILE; y += 6) rect(g, '#5a3a1e', 6, y, 20, 3);
      rect(g, '#8a8a92', 9, 0, 2, TILE);
      rect(g, '#8a8a92', 21, 0, 2, TILE);
    },
    // A heap of gold coins, with gems among them.
    treasure(g, r) {
      floorShadow(g, 13, 4);
      const [x, y] = drum(g, 16, 17, 0, 9, t => 12.5 * Math.sqrt(Math.max(0, 1 - t * t)) + 1, { edge: '#a87810', light: '#ffe070', mid: '#e0b030', dark: '#9a7010' });
      for (let i = 0; i < 22; i++) { const a = r() * Math.PI * 2, d = r() * 9, [cx, cy] = P(16 + Math.cos(a) * d, 17 + Math.sin(a) * d, 9 - d * 0.7); ellipse(g, r() < 0.5 ? '#f8d850' : '#e8b830', cx, cy, 2.2, 1.5); }
      for (let i = 0; i < 3; i++) { const [gx, gy] = P(10 + i * 6, 15 + (i % 2) * 5, 7); rect(g, ['#e04040', '#40c0e0', '#40d060'][i], gx, gy, 3, 3); }
      ellipse(g, '#fff8c0', x - 2, y - 1, 1.2, 0.8);
    },
    // Iron bars across a tile: rails top and bottom, bars standing between them, all in the slant.
    bars(g) {
      floorShadow(g, 14, 3);
      const iron = { top: '#6a6a72', south: '#4a4a52', east: '#2e2e34', edge: '#8a8a92' };
      prism(g, 1, 14, 31, 18, 0, 4, iron);
      for (let u = 3; u < 30; u += 5) prism(g, u, 15, u + 2, 17, 4, 40, iron);
      prism(g, 1, 14, 31, 18, 40, 44, iron);
    },
    // A well: a round stone wall with dark water inside, two posts, a little roof and a crank.
    // A well: a round wall of stones with dark water inside, two posts, a little roof and a crank.
    well(g) {
      floorShadow(g, 14, 3);
      const wood = { top: '#7a4e26', south: '#5e3a1a', east: '#462a12', edge: '#9a6a38' };
      prism(g, 3, 16, 6, 19, 0, 34, wood);
      const [x, y] = drum(g, 16, 18, 0, 12, () => 12, { edge: '#6e6e6a', light: '#c4c4c0', mid: '#9a9a96', dark: '#5e5e5a' });
      for (const z of [4, 8]) frontRing(g, 16, 18, z, 12, 'rgba(60,60,58,0.7)', 1);
      ellipse(g, '#4e4e4a', x, y, 12, 12); ellipse(g, '#1a3a6a', x, y, 9.5, 9.5); ellipse(g, 'rgba(255,255,255,0.25)', x - 3, y - 3, 3, 1.5);
      prism(g, 26, 16, 29, 19, 0, 34, wood);
      prism(g, 2, 15, 30, 20, 34, 36, wood);
      const [rx, ry] = P(16, 18, 34); line(g, '#c0b090', 1, rx, ry, x, y);
      prism(g, 1, 15, 31, 20, 38, 40, { top: '#a03a2a', south: '#7a2a1e', east: '#5e1e14', edge: '#c85a44' }); // the little roof
    },
    // An iron gate across a corridor running east-west: bars standing up from the floor in the tiles' slant, from the
    // north edge of the tile to the south, with crossbars and a heavy lock.
    crypt_gate(g) {
      floorShadow(g, 4, 8);
      const iron = { top: '#5a5a62', south: '#46464e', east: '#2e2e34', edge: '#7a7a84' };
      for (let v = 1; v <= 31; v += 5) prism(g, 15, v, 17, v + 2, 0, 44, iron);   // the bars
      for (const z of [6, 24, 40]) prism(g, 15, 0, 17, 32, z, z + 3, iron);         // crossbars
      prism(g, 13, 14, 19, 19, 20, 27, { top: '#8a6a2a', south: '#6a4e1a', east: '#4a3410', edge: '#b08a3e' }); // the lock
    },
    // A torn scrap of paper on the floor.
    torn_note(g) {
      shadow(g, 16, 22, 8, 2);
      poly(g, '#e8dcc0', [9, 15, 22, 13, 24, 21, 19, 24, 11, 23]);
      for (const y of [16, 18, 20]) line(g, '#8a7a5a', 1, 12, y, 21, y - 1);
    },
    // A stone coffin, long from north to south, its lid carved with a sword.
    sarcophagus(g) {
      floorShadow(g, 12, 4);
      prism(g, 7, 3, 25, 29, 0, 13, { top: '#7a7a82', south: '#5e5e66', east: '#46464e', edge: '#9a9aa2' });
      prism(g, 6, 2, 26, 30, 13, 16, { top: '#8e8e96', south: '#6e6e76', east: '#56565e', edge: '#b0b0b8' });
      const a = P(16, 6, 16), b = P(16, 25, 16), c = P(11, 11, 16), d = P(21, 11, 16);
      line(g, '#5a5a62', 2, ...a, ...b); line(g, '#5a5a62', 2, ...c, ...d); // the sword on the lid
    },
    // The founder's tomb: a bigger coffin on a step, its lid pushed half off, a glint of bronze inside.
    founder_tomb(g) {
      floorShadow(g, 14, 4);
      prism(g, 3, 1, 29, 31, 0, 4, { top: '#5a5a62', south: '#46464e', east: '#36363c', edge: '#7a7a82' }); // the step
      prism(g, 6, 3, 24, 29, 4, 17, { top: '#7a7a82', south: '#5e5e66', east: '#46464e', edge: '#9a9aa2' });
      poly(g, '#0c0c10', [...P(8, 5, 17), ...P(22, 5, 17), ...P(22, 27, 17), ...P(8, 27, 17)]); // open: dark inside
      const bone = (u0, v0, u1, v1) => line(g, '#b8b4a4', 2, ...P(u0, v0, 17), ...P(u1, v1, 17));
      bone(11, 9, 11, 22); bone(14, 12, 18, 12); bone(14, 16, 18, 16); // old bones
      const [sx, sy] = P(15, 8, 17); ellipse(g, '#c8c4b4', sx, sy, 3, 2.5); rect(g, '#0c0c10', sx - 2, sy - 1, 1, 1); rect(g, '#0c0c10', sx + 1, sy - 1, 1, 1);
      const [gx, gy] = P(17, 22, 17); ellipse(g, '#d8a840', gx, gy, 3, 2); rect(g, '#fff0b0', gx - 1, gy - 1, 1, 1); // a glint of bronze
      prism(g, 20, 6, 31, 31, 4, 7, { top: '#8e8e96', south: '#6e6e76', east: '#56565e', edge: '#b0b0b8' }); // the lid, pushed off, leaning on the step
      onSouth(g, 29, f => { rect(f, '#3a3a40', 12, 7, 4, 4); rect(f, '#9a9aa2', 13, 8, 1, 1); rect(f, '#9a9aa2', 14, 8, 1, 1); }); // a carved skull
    },
    // The bell shaft: on every floor under the bell the rope's tile is open (no floor), framed as a hatch with its
    // lid thrown back against the north edge; the rope runs up through it as a thin column, exactly one floor high
    // in the tiles' slant, so the pieces on the floors above and below join into one rope.
    // Beside the bell: the rope comes up through the hatch to a wheel on a beam joined to the bell's crossbeam.
    shaft_rope_top(g) {
      hatch(g, () => {
        bellRope(g, 0, 78);
        const oak = { top: '#6a4422', south: '#523418', east: '#3e2610', edge: '#8a5a2e' };
        prism(g, -14, 13, 18, 17, 84, 88, oak); // a beam west, to the bell's crossbeam
        const [wx, wy] = P(16, 15, 80);
        g.strokeStyle = '#3e2610'; g.lineWidth = 2; g.beginPath(); g.arc(wx, wy, 4, 0, Math.PI * 2); g.stroke(); // the wheel
        rect(g, '#3e2610', wx - 1, wy - 1, 2, 2);
      });
    },
    // The ringers' room: the rope runs up through the floor and on up through the ceiling, with its striped grip.
    shaft_rope(g) { hatch(g, () => bellRope(g, 0, FLOOR_Z, true)); },
    // The temple hall: the rope comes down from the room above and ends, cut, halfway down.
    shaft_rope_cut(g) {
      hatch(g, () => {
        bellRope(g, 30, FLOOR_Z);
        const [ex, ey] = P(16, 16, 30);
        for (const d of [-2, -1, 0, 1, 2]) line(g, '#e0c898', 1, ex, ey, ex + d, ey + 2 + Math.abs(d)); // frayed
      });
    },
    // Further down: only the open hatch over the dark shaft.
    shaft_hole(g) { hatch(g, () => {}); },
    // The temple bell's rope, hanging down through a hole in the cellar ceiling; its end lies gnawed on the floor.
    bell_rope(g) {
      // the rope, fallen in a heap on the floor and chewed to threads
      ellipse(g, 'rgba(0,0,0,0.25)', 64 + 17, 64 + 19, 13, 6);
      for (const [rx, ry, dy, c] of [[12, 5.5, 2, '#8a6a42'], [10, 4.5, 0, '#a8865a'], [7, 3.5, -2, '#b8966a'], [4, 2.2, -4, '#c8a67a']]) {
        g.strokeStyle = c; g.lineWidth = 2.5;
        g.beginPath(); g.ellipse(64 + 16, 64 + 17 + dy, rx, ry, 0, 0, Math.PI * 2); g.stroke();
      }
      g.strokeStyle = '#e0c898'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(64 + 16, 64 + 16.5, 10, 4.5, 0, 0.4, Math.PI * 1.1); g.stroke();
      for (const [dx, dy] of [[0, 0], [3, 1], [5, -1], [2, 3]]) line(g, '#e0c898', 1, 64 + 26, 64 + 19, 64 + 28 + dx, 64 + 20 + dy); // gnawed
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
    // A windmill: a stone tower narrowing to a thatched cone, its sails turning on its south face.
    windmill(g, r, frame) {
      floorShadow(g, 15, 5);
      taper(g, 4, 4, 28, 28, 0, 58, 4, { top: '#b8b0a0', south: '#a8a090', east: '#8a8274', edge: '#cac2b2' });
      onSouth(g, 28, f => { rect(f, '#5a3a1e', 13, 0, 6, 14); rect(f, '#2a2a40', 14, 30, 4, 6); });
      pyramid(g, 8, 8, 24, 24, 58, 18, { top: '#a85a3a', south: '#8a3a2a', east: '#6a2a1e' });
      onSouth(g, 25, f => { // the sails, in the plane of the tower's front
        const a0 = (frame * Math.PI) / 8, hx = 16, hz = 54;
        for (let i = 0; i < 4; i++) {
          const a = a0 + (i * Math.PI) / 2, ex = hx + Math.cos(a) * 22, ez = hz + Math.sin(a) * 22;
          line(f, '#6a4a2a', 2, hx, hz, ex, ez);
          const px = -Math.sin(a) * 5, pz = Math.cos(a) * 5;
          poly(f, 'rgba(236,228,206,0.92)', [hx + Math.cos(a) * 6, hz + Math.sin(a) * 6, ex, ez, ex + px, ez + pz, hx + Math.cos(a) * 6 + px, hz + Math.sin(a) * 6 + pz]);
        }
        ellipse(f, '#4a3018', hx, hz, 2.5, 2.5);
      });
    },
    // An igloo: a dome of snow blocks with a little tunnel to its door on the south.
    igloo(g) {
      floorShadow(g, 15, 5);
      const snow = { edge: '#b8c8d8', light: '#ffffff', mid: '#e8f0f8', dark: '#b4c4d4' };
      drum(g, 16, 14, 0, 24, t => 13.5 * Math.sqrt(Math.max(0, 1 - t * t)) + 0.5, snow);
      for (const z of [6, 12, 18]) frontRing(g, 16, 14, z, 13.5 * Math.sqrt(Math.max(0, 1 - (z / 24) ** 2)) + 0.5, 'rgba(150,170,195,0.7)', 1);
      prism(g, 11, 22, 21, 30, 0, 9, { top: '#f4f8fc', south: '#dce6f0', east: '#b8c8d8', edge: '#ffffff' });
      onSouth(g, 30, f => { f.fillStyle = '#2a3440'; f.beginPath(); f.ellipse(16, 0, 3.5, 7, 0, 0, Math.PI); f.fill(); });
    },
    // A carved totem pole: four painted faces stacked up a square post, wings spread near the top, a beak crowning it.
    totem(g) {
      floorShadow(g, 7, 3);
      const faces = [['#a8402a', '#f0d040'], ['#2a6a8a', '#f0f0e8'], ['#3a8a3a', '#f0d040'], ['#8a5a2a', '#e04030']];
      faces.forEach(([c, e], i) => {
        const z0 = i * 16;
        prism(g, 11, 11, 21, 21, z0, z0 + 16, { top: shade(c, 1.15), south: c, east: shade(c, 0.65), edge: shade(c, 1.3) });
        onSouth(g, 21, f => { rect(f, e, 12, z0 + 9, 3, 2); rect(f, e, 17, z0 + 9, 3, 2); rect(f, '#1a1a1a', 13, z0 + 3, 6, 2); });
      });
      const wing = { top: '#e07a3a', south: '#d06a2a', east: '#a04a1a', edge: '#f09a5a' };
      prism(g, 2, 14, 11, 18, 52, 56, wing);
      prism(g, 21, 14, 30, 18, 52, 56, wing);
      pyramid(g, 11, 11, 21, 21, 64, 9, { top: '#c04a30', south: '#a8402a', east: '#7a2a1a' });
    },
    // A straw beehive (a skep) on a little wooden stand, bees about it.
    beehive(g) {
      floorShadow(g, 9, 3);
      const wood = { top: '#8a5a2e', south: '#6a4422', east: '#4e3018', edge: '#a8743e' };
      for (const [u, v] of [[8, 10], [22, 10], [8, 22], [22, 22]]) prism(g, u, v, u + 2, v + 2, 0, 8, wood);
      prism(g, 7, 9, 25, 25, 8, 10, wood);
      drum(g, 16, 17, 10, 28, t => 8.5 * Math.sqrt(Math.max(0, 1 - t * t)) + 1, { edge: '#a87e30', light: '#ecc870', mid: '#d0a850', dark: '#8a6a28' });
      for (const z of [14, 18, 22, 25]) frontRing(g, 16, 17, z, 8.5 * Math.sqrt(Math.max(0, 1 - ((z - 10) / 18) ** 2)) + 1, 'rgba(120,88,30,0.6)', 1);
      const [hx, hy] = P(16, 17, 11); ellipse(g, '#3a2a10', hx, hy + 7.5, 1.8, 1.4); // the entrance
      for (const [x, y] of [[66, 50], [84, 46], [88, 56], [70, 42]]) { rect(g, '#f0c020', x, y, 2, 1); rect(g, '#1a1a1a', x + 1, y, 1, 1); }
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
    // A standing stone of the old ones: a dark shaft on a plinth, narrowing to a point, runes glowing down its front.
    obelisk(g) {
      floorShadow(g, 10, 4);
      const stone = { top: '#5a5a66', south: '#46464f', east: '#30303a', edge: '#6e6e7a' };
      prism(g, 7, 7, 25, 25, 0, 5, { top: '#4a4a54', south: '#3a3a44', east: '#2a2a32', edge: '#62626e' });
      taper(g, 10, 10, 22, 22, 5, 44, 2.5, stone); // under the ceiling, as a pillar reaches it, point and all
      pyramid(g, 12.5, 12.5, 19.5, 19.5, 44, 8, stone);
      for (let z = 10; z < 42; z += 7) { // the runes on its south face, glowing
        const v = 22 - ((z - 5) / 39) * 2.5, [x, y] = P(15, v, z);
        ellipse(g, 'rgba(120,220,255,0.28)', x + 1.5, y - 1, 4, 3);
        rect(g, 'rgba(150,235,255,0.95)', x, y - 2, 3, 2);
      }
    },
    // An iron cauldron on three short legs over a fire, something green bubbling in it.
    cauldron(g, r, frame) {
      floorShadow(g, 11, 4);
      for (const [u, v] of [[9, 12], [22, 13], [15, 23]]) prism(g, u, v, u + 2, v + 2, 0, 6, { top: '#2a2a30', south: '#1e1e22', east: '#141418', edge: '#3a3a42' });
      const [fx, fy] = P(16, 17, 0); flame(g, fx, fy + 1, 5, 8, frame);
      drum(g, 16, 17, 5, 18, t => 8 + 3 * Math.sin(t * Math.PI * 0.9), { edge: '#1a1a20', light: '#4a4a56', mid: '#2e2e36', dark: '#16161a' });
      const [x, y] = P(16, 17, 18);
      ellipse(g, '#1e1e24', x, y, 9.5, 9.5);
      ellipse(g, '#5ac040', x, y, 8, 8);
      for (let i = 0; i < 3; i++) { const k = (frame + i) % 3; ellipse(g, 'rgba(170,245,130,0.9)', x - 4 + i * 4, y - 1 - k * 2, 1.5, 1.5); }
      frontRing(g, 16, 17, 18, 9.5, '#3a3a44', 2);
    },
    sword_grave(g) {
      ellipse(g, '#6a5a44', 16, 26, 7, 2.5);
      rect(g, '#c8ccd4', 15, 10, 3, 16);
      rect(g, '#ffffff', 15, 10, 1, 15);
      rect(g, '#b08a30', 11, 9, 11, 2);
      rect(g, '#5a3a1a', 15, 4, 3, 5);
      ellipse(g, '#d0a030', 16.5, 3.5, 2, 2);
    },
    // A flag on a tall pole: the pole in the slant, the flag hanging in its own plane, east of the pole.
    flagpole(g, r) {
      const c = ['#c03030', '#2e6ab0', '#3f8a3a'][(r() * 3) | 0];
      floorShadow(g, 5, 2);
      prism(g, 13, 13, 19, 19, 0, 3, { top: '#8a8a92', south: '#6a6a72', east: '#4e4e56', edge: '#a8a8b0' });
      prism(g, 15.5, 15.5, 16.5, 16.5, 3, 86, { top: '#7a5a32', south: '#5a3a1e', east: '#3e2612', edge: '#8a6a3e' });
      const [bx, by] = P(16, 16, 87); ellipse(g, '#d0a030', bx, by, 2.2, 2.2);
      poly(g, c, [...P(16.5, 16, 84), ...P(30, 16, 82), ...P(27, 16, 76), ...P(31, 16, 69), ...P(16.5, 16, 68)]);
      poly(g, 'rgba(255,255,255,0.25)', [...P(19, 16, 80), ...P(24, 16, 79), ...P(24, 16, 75), ...P(19, 16, 76)]);
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
    // A toppled pillar, lying east to west: its fluted shaft, the broken end showing its round section, rubble round it.
    fallen_pillar(g, r) {
      floorShadow(g, 15, 4);
      const stone = { top: '#c0c0c8', south: '#a0a0a8', east: '#82828a', edge: '#d8d8e0' };
      prism(g, 2, 13, 25, 24, 0, 11, stone);
      for (const v of [15.5, 18.5, 21.5]) line(g, 'rgba(110,110,120,0.6)', 1, ...P(2, v, 11), ...P(25, v, 11));
      for (const z of [4, 8]) line(g, 'rgba(110,110,120,0.6)', 1, ...P(2, 24, z), ...P(25, 24, z));
      const [cx, cy] = P(25, 18.5, 5.5); ellipse(g, '#b4b4bc', cx, cy, 4.5, 5); ellipse(g, '#9a9aa2', cx + 0.5, cy + 0.5, 3, 3.4); // the break
      prism(g, 26, 14, 31, 23, 0, 6, { top: '#b0b0b8', south: '#909098', east: '#74747c', edge: '#c8c8d0' }); // a broken piece
      for (let i = 0; i < 4; i++) { const [x, y] = P(4 + r() * 24, 25 + r() * 5, 0); ellipse(g, '#9a9aa2', x, y, 1.5, 1); }
    },

    // --- in and around towns (fountain, lamp post, stall, wagon, chimney, boat, scarecrow,
    // pillar and notice board are 64x64, standing in the bottom-right quarter) ---
    // The fountain, drawn whole by its south-east tile (centred on the corner of its four tiles): a round
    // stone basin of water, a pillar in the middle with a bowl on top, and water falling from it.
    fountain(g, r, frame) {
      shadow(g, 64, 64, 30, 8);
      column(g, 0, 0, 26, 0, 8, { light: '#c8c8cc', mid: '#a0a0a6', dark: '#707078', top: '#b8b8be' });
      const [bx, by] = P(0, 0, 8); ellipse(g, '#2d63b5', bx, by, 22, 22);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + frame * 0.4; ellipse(g, 'rgba(170,205,245,0.7)', bx + Math.cos(a) * 14, by + Math.sin(a) * 14, 3, 1.5); }
      column(g, 0, 0, 4, 4, 28, { light: '#d0d0d4', mid: '#a8a8ae', dark: '#78787e', top: '#b8b8be' });
      column(g, 0, 0, 10, 28, 32, { light: '#d0d0d4', mid: '#a8a8ae', dark: '#78787e', top: '#b8b8be' });
      const [tx, ty] = P(0, 0, 32); ellipse(g, '#5b8fd6', tx, ty, 8, 8);
      const j = frame % 2;
      line(g, 'rgba(210,232,255,0.95)', 2, tx, ty, tx, ty - 10 - j);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [-0.7, 0.7], [0.7, 0.7]]) line(g, 'rgba(210,232,255,0.7)', 1, tx + dx * 9, ty + dy * 9, bx + dx * 16, by + dy * 16 + j);
    },
    fountain_rim() {}, // the fountain on the tile south-east of it draws over this one
    // big things' parts are drawn by bigPart (see BIG); these are never called
    fountain_nw() {}, fountain_ne() {}, fountain_sw() {}, fountain_se() {}, bed_head() {}, bed_foot() {},
    lamppost_off(g) { streetLamp(g, false); },
    // A street lamp: a stone foot, an iron post and a glowing lantern with a little roof.
    lamppost(g) { streetLamp(g, true); },
    // A town bench: three planks for the seat, two for the back, iron ends.
    // A town bench: iron ends, a slatted seat and a backrest.
    bench(g) {
      floorShadow(g, 15, 3);
      for (const u of [2, 27]) { prism(g, u, 10, u + 3, 13, 0, 22, { top: '#5a5a62', south: '#3e3e44', east: '#2c2c30', edge: '#7a7a82' }); prism(g, u, 20, u + 3, 23, 0, 10, { top: '#5a5a62', south: '#3e3e44', east: '#2c2c30', edge: '#7a7a82' }); }
      prism(g, 1, 10, 31, 12, 13, 22, { top: '#a8743e', south: '#7a4e26', east: '#5e3a1a', edge: '#c8925a' });
      line(g, '#5e3a1a', 1, ...P(2, 12, 17), ...P(30, 12, 17));
      prism(g, 1, 12, 31, 23, 9, 11, { top: '#a8743e', south: '#7a4e26', east: '#5e3a1a', edge: '#c8925a' });
      for (const v of [15, 19]) line(g, '#5e3a1a', 1, ...P(2, v, 11), ...P(30, v, 11));
    },
    // A market stall: a wooden counter heaped with goods, four poles and a striped awning.
    stall(g, r) {
      floorShadow(g, 15, 3);
      const [a, b] = [['#c03a30', '#f0e6d0'], ['#2e6ab0', '#f0e6d0'], ['#3f8a3a', '#f4e8b0']][(r() * 3) | 0];
      const pole = { top: '#5e3a1a', south: '#5e3a1a', east: '#3e2410', edge: '#7a4e26' };
      prism(g, 2, 4, 4, 6, 0, 38, pole); prism(g, 28, 4, 30, 6, 0, 38, pole);
      prism(g, 1, 12, 31, 26, 0, 14, { top: '#9a6632', south: '#7a4e26', east: '#5e3a1a', edge: '#c08a52' });
      for (let i = 0; i < 9; i++) { const [x, y] = P(5 + (i % 5) * 5.5, 15 + Math.floor(i / 5) * 6, 16); ellipse(g, ['#d03a2a', '#e8b860', '#7ab040', '#f0d050'][(i + ((r() * 4) | 0)) % 4], x, y, 2.5, 2.5); }
      prism(g, 2, 24, 4, 26, 0, 38, pole); prism(g, 28, 24, 30, 26, 0, 38, pole);
      for (let k = 0; k < 6; k++) prism(g, k * 5.4, 2, k * 5.4 + 5.4, 28, 38, 40, k % 2 ? { top: b, south: b, east: b, edge: b } : { top: a, south: a, east: a, edge: a });
      onSouth(g, 28, f => { for (let k = 0; k < 6; k++) poly(f, k % 2 ? b : a, [k * 5.4, 38, k * 5.4 + 5.4, 38, k * 5.4 + 2.7, 33]); });
    },
    // A clipped hedge: a block of leaves, lit on top, darker down its sides.
    hedge(g, r) {
      floorShadow(g, 15, 4);
      prism(g, 0, 7, 32, 26, 0, 22, { top: '#4a8a3c', south: '#2e6226', east: '#1f4a1a', edge: '#5aa048' });
      for (let i = 0; i < 40; i++) { const [x, y] = P(r() * 31, 7 + r() * 18, 22); rect(g, r() < 0.5 ? '#3a7a30' : '#62a650', x, y, 2, 1); }
      onSouth(g, 26, f => { for (let i = 0; i < 34; i++) rect(f, r() < 0.5 ? '#1e4a18' : '#3e7a32', r() * 31, r() * 21, 2, 2); });
    },
    // A flower box: a wooden box full of flowers.
    planter(g, r) {
      floorShadow(g, 13, 3);
      prism(g, 3, 9, 29, 23, 0, 9, { top: '#a8743e', south: '#7a4e26', east: '#5e3a1a', edge: '#c8925a' });
      onSouth(g, 23, f => { rect(f, '#5e3a1a', 3, 4, 26, 1); });
      for (let i = 0; i < 12; i++) {
        const [x, y] = P(6 + (i % 6) * 4, 12 + Math.floor(i / 6) * 6, 12);
        line(g, '#2f6a29', 1, x, y + 3, x, y);
        ellipse(g, ['#e84a5f', '#f5d547', '#ffffff', '#b06ee0'][(r() * 4) | 0], x, y, 2, 2);
      }
    },
    // A haystack: a round heap of straw.
    // A haystack: a round heap of straw, rounded at the top.
    haystack(g) {
      floorShadow(g, 14, 3);
      const [x, y] = drum(g, 16, 17, 0, 13, t => 13.5 * Math.sqrt(Math.max(0, 1 - t * t * 0.8)), { edge: '#a8801c', light: '#f4d880', mid: '#d8b040', dark: '#987010' });
      for (let i = 0; i < 9; i++) { const a = -0.6 + i * 0.25; line(g, '#b89030', 1, x + Math.cos(a) * 3, y + Math.sin(a) * 3, x + Math.cos(a) * 12, y + Math.sin(a) * 12 + 6); }
    },
    // A hand cart: a wooden bed with sides on two big wheels, a shaft out front.
    wagon(g) {
      floorShadow(g, 15, 3);
      const wood = { top: '#9a6632', south: '#7a4e26', east: '#5e3a1a', edge: '#c08a52' };
      prism(g, 2, 9, 30, 23, 8, 10, wood);
      prism(g, 2, 9, 30, 10, 10, 16, wood); prism(g, 29, 9, 30, 23, 10, 16, wood); prism(g, 2, 22, 30, 23, 10, 16, wood);
      prism(g, -6, 15, 2, 17, 6, 8, wood);
      onSouth(g, 23, f => { for (const u of [8, 24]) { f.strokeStyle = '#3e2410'; f.lineWidth = 2; f.beginPath(); f.arc(u, 7, 6, 0, Math.PI * 2); f.stroke(); f.fillStyle = '#6a4422'; f.beginPath(); f.arc(u, 7, 1.5, 0, Math.PI * 2); f.fill(); for (let a = 0; a < 4; a++) line(f, '#5e3a1a', 1, u, 7, u + Math.cos(a * 0.785 * 2) * 5, 7 + Math.sin(a * 0.785 * 2) * 5); } });
    },
    // A stack of split logs.
    woodpile(g) {
      floorShadow(g, 15, 3);
      for (let row = 0; row < 3; row++) for (let k = 0; k < 4 - row; k++) {
        const u = 4 + k * 7 + row * 3.5, z = row * 6;
        column(g, u, 16, 3.5, z, z + 1, { light: '#8a5a2c', mid: '#6a4220', dark: '#4a2c12', top: '#6a4220' });
        const [x, y] = P(u, 24, z + 3.5); ellipse(g, '#4a2c12', x, y, 3.6, 3.6); ellipse(g, '#d8a868', x, y, 2.8, 2.8); ellipse(g, '#a8703a', x, y, 1, 1);
      }
    },
    // A brick chimney on a roof, in the tiles' slant like everything that stands on a tile, smoking from its top.
    chimney(g, r, frame) {
      const brick = { top: '#8a4430', south: '#9a4a36', east: '#6e3424', edge: '#c06a50' };
      prism(g, 11, 11, 21, 21, 0, 30, brick);
      onSouth(g, 21, f => { for (let z = 4; z < 30; z += 5) rect(f, 'rgba(40,16,10,0.35)', 11, z, 10, 1); rect(f, 'rgba(255,200,170,0.25)', 11, 0, 2, 30); });
      prism(g, 9, 9, 23, 23, 30, 34, { top: '#5a2a1e', south: '#6e3426', east: '#4e2418', edge: '#9a5a44' }); // the cap
      poly(g, '#1e0e08', [...P(12, 12, 34), ...P(20, 12, 34), ...P(20, 20, 34), ...P(12, 20, 34)]); // its dark mouth
      const [mx, my] = P(16, 16, 34);
      for (let i = 0; i < 3; i++) { // smoke curling up from it
        const t = (frame + i * 1.4) % 4;
        ellipse(g, `rgba(215,215,220,${0.6 - t * 0.13})`, mx - t * 3, my - 5 - t * 6, 3 + t, 2.5 + t * 0.8);
      }
    },
    // A wicker basket full of goods.
    // A wicker basket full of goods.
    basket(g, r) {
      floorShadow(g, 11, 3);
      const goods = [['#d03a2a', '#e86040'], ['#e8b860', '#c89040'], ['#9ab8d0', '#7090a8']][(r() * 3) | 0];
      drum(g, 16, 17, 0, 11, t => 8 + 2 * t, { edge: '#7a5426', light: '#d0a058', mid: '#a8783e', dark: '#6a4820' });
      for (const z of [3, 6, 9]) frontRing(g, 16, 17, z, 8.5 + 2 * z / 11, '#7a5426', 1);
      const [x, y] = P(16, 17, 11); ellipse(g, '#5a3c1a', x, y, 10, 10);
      for (let i = 0; i < 7; i++) { const a = i * 0.9, d = i ? 5 : 0; ellipse(g, goods[i % 2], x + Math.cos(a) * d, y + Math.sin(a) * d, 3, 2.8); rect(g, 'rgba(255,255,255,0.6)', x + Math.cos(a) * d - 1, y + Math.sin(a) * d - 1, 1, 1); }
    },
    // A full sack, tied at the neck, sagging in folds.
    // A full sack, tied at the neck.
// A full sack, tied at the neck, sagging in folds.
    // A full sack: a round, sagging body of cloth, tied at the neck.
    sack(g) {
      floorShadow(g, 10, 3);
      const [tx, ty] = drum(g, 16, 17, 0, 12, t => 9.5 - 5.5 * t ** 3, { edge: '#9a7e50', light: '#dcc490', mid: '#c8ac78', dark: '#8a6e44' });
      drum(g, 16, 17, 12, 16, t => 3.5 + 1.5 * t, { edge: '#8a6e44', light: '#d8c08c', mid: '#c0a070', dark: '#7a5e38' });
      frontRing(g, 16, 17, 12, 4, '#6a4a28');
      line(g, 'rgba(120,96,60,0.6)', 1, tx + 3, ty + 4, tx + 7, ty + 12);
    },
    // A rowing boat on the water, bow to the west: its hull in the slant, two thwarts, its oars lying in it.
    boat(g) {
      ellipse(g, 'rgba(0,10,40,0.3)', 64 + 18, 64 + 22, 17, 6);
      const rim = [[1, 18], [7, 10], [25, 10], [31, 18], [25, 26], [7, 26]];
      poly(g, '#5a3818', rim.flatMap(([u, v]) => P(u, v, 9)));                                   // the inside
      poly(g, '#6a4422', [...P(1, 18, 9), ...P(7, 26, 9), ...P(25, 26, 9), ...P(31, 18, 9), ...P(27, 18, 0), ...P(5, 18, 0)]); // the south side
      poly(g, '#4e3018', [...P(25, 10, 9), ...P(31, 18, 9), ...P(27, 18, 0)]);                   // the stern, in shade
      line(g, '#a87a48', 1.5, ...rim.slice(3).concat([rim[0]]).flatMap(([u, v]) => P(u, v, 9)));  // the gunwale
      for (const u of [12, 20]) prism(g, u, 11, u + 2, 25, 5, 7, { top: '#8a5a2e', south: '#6a4422', east: '#4e3018', edge: '#a8743e' });
      for (const v of [14, 22]) line(g, '#a87a48', 2, ...P(5, v, 7.5), ...P(27, v, 7.5)); // the oars, shipped
    },
    // the black ribs of an old ship, half sunk, fanning out from its keel; some still have a stump of mast
    // The wreck of a boat, half sunk: a keel lying aslant, broken ribs curving up either side, maybe a mast.
    wreck(g, r) {
      const mast = r() < 0.5;
      ellipse(g, 'rgba(0,10,30,0.35)', 64 + 16, 64 + 18, 15, 6);
      const wood = { top: '#5a3e24', south: '#3e2a16', east: '#2a1a0c', edge: '#7a5a3a' };
      prism(g, 2, 15, 30, 18, 0, 3, wood); // the keel
      for (const [u, h] of [[6, 13], [11, 9], [17, 15], [23, 8], [28, 11]]) { // ribs, curving out north and south
        line(g, '#2a1a0c', 2.5, ...P(u, 16, 2), ...P(u, 11, h * 0.7), ...P(u, 8, h));
        line(g, '#3a2614', 2.5, ...P(u, 17, 2), ...P(u, 22, h * 0.7), ...P(u, 25, h));
      }
      prism(g, 5, 21, 14, 24, 2, 5, wood); prism(g, 17, 8, 25, 11, 3, 6, wood); // what is left of the planks
      if (mast) {
        line(g, '#3a2614', 3, ...P(14, 16, 3), ...P(22, 12, 46));
        poly(g, 'rgba(220,210,190,0.85)', [...P(21, 12.5, 42), ...P(29, 12.5, 36), ...P(22, 12.5, 32)]); // a rag of sail
      }
      for (const u of [3, 10, 17, 24, 29]) { const [x, y] = P(u, 27, 0); ellipse(g, 'rgba(230,240,255,0.55)', x, y, 2.5, 1); } // foam
    },
    // A straw-stuffed sack on a post, a crossbar for arms and a painted target: for practice.
    // A training dummy: a post, a straw-stuffed body with a painted target, arms and a head.
// A straw-stuffed sack on a post, a crossbar for arms and a painted target: for practice.
    // A training dummy in the tiles' slant: a post, a straw-stuffed body with a target on its front, a crossbar for
    // arms and a straw head.
    dummy(g) {
      floorShadow(g, 9, 3);
      const wood = { top: '#7a4e28', south: '#5a3618', east: '#3e2410', edge: '#8a5a2e' };
      prism(g, 15, 16, 17, 18, 0, 16, wood);                   // the post
      const straw = { edge: '#8a6a30', light: '#e8d090', mid: '#d0b070', dark: '#a08048' };
      const [bx, by] = drum(g, 16, 17, 14, 34, t => 6 + 1.5 * Math.sin(t * Math.PI), straw); // the body
      for (const z of [18, 30]) frontRing(g, 16, 17, z, 7.2, 'rgba(110,80,30,0.7)', 1.5);   // its cords
      const [tx, ty] = P(16, 17, 24); // the target, on its front
      ellipse(g, '#c03a2a', tx, ty + 7.5, 3.8, 3); ellipse(g, '#e8d8b0', tx, ty + 7.5, 2.4, 1.9); ellipse(g, '#c03a2a', tx, ty + 7.5, 1, 0.8);
      prism(g, 4, 16, 28, 18, 30, 33, wood);                   // the crossbar
      prism(g, 15, 16, 17, 18, 34, 37, wood);
      drum(g, 16, 17, 37, 45, t => 3.8 * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) + 1, straw); // the head
      void bx; void by;
    },
    // A scarecrow in the tiles' slant: a post and a crossbar, an old patched coat, straw hands, a sack head and a hat.
    scarecrow(g) {
      floorShadow(g, 9, 3);
      const wood = { top: '#7a4e28', south: '#5a3618', east: '#3e2410', edge: '#8a5a2e' };
      prism(g, 15, 16, 17, 18, 0, 44, wood);                   // the post
      prism(g, 3, 16, 29, 18, 36, 39, wood);                   // the crossbar
      taper(g, 10, 14, 22, 20, 16, 38, 1, { top: '#8a7a40', south: '#5a4a28', east: '#40341c', edge: '#a89a58' }); // the coat
      onSouth(g, 19, f => { rect(f, '#6a3a2a', 12, 26, 8, 4); rect(f, '#3a2e1a', 15.5, 16, 1, 20); }); // a patch, the coat's opening
      for (const u of [2, 27]) prism(g, u, 15.5, u + 3, 18.5, 33, 38, { top: '#f4dc80', south: '#e0c050', east: '#b89a30', edge: '#fff0a0' }); // straw hands
      const [hx, hy] = drum(g, 16, 17, 38, 47, t => 4.6 * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) + 1, { edge: '#a89060', light: '#e0c890', mid: '#c8b080', dark: '#8a7448' }); // the sack head
      rect(g, '#2a2a2a', hx - 3, hy + 5, 2, 2); rect(g, '#2a2a2a', hx + 1.5, hy + 5, 2, 2); rect(g, '#2a2a2a', hx - 2, hy + 8.5, 5, 1);
      drum(g, 16, 17, 47, 48, () => 8, { edge: '#2a2010', light: '#5a4a2a', mid: '#3a2e1a', dark: '#2a2010' });    // the hat's brim
      drum(g, 16, 17, 48, 55, t => 4.2 - t, { edge: '#3a2e1a', light: '#7a6a44', mid: '#5a4a2a', dark: '#3a2e1a' }); // its crown
    },
    // A marble pillar: a square plinth, a round fluted shaft, a square capital.
    pillar(g) {
      floorShadow(g, 12, 3);
      prism(g, 5, 5, 27, 27, 0, 5, { top: '#f2efe8', south: '#cdc8be', east: '#aaa59b', edge: '#ffffff' });
      column(g, 16, 16, 8, 5, 50, { light: '#f4f1ea', mid: '#d6d1c7', dark: '#9c978d', top: '#e8e4dc' });
      for (const o of [-4, 0, 4]) line(g, 'rgba(120,114,104,0.45)', 1, ...P(16 + o * 0.7, 16 - o * 0.7, 6), ...P(16 + o * 0.7, 16 - o * 0.7, 49));
      prism(g, 4, 4, 28, 28, 50, 56, { top: '#f2efe8', south: '#cdc8be', east: '#aaa59b', edge: '#ffffff' });
    },
    // A noticeboard: two posts, a board with notes pinned on it and a little roof.
    noticeboard(g) {
      floorShadow(g, 13, 3);
      prism(g, 4, 15, 7, 18, 0, 34, { top: '#7a4e26', south: '#5e3a1a', east: '#462a12', edge: '#9a6a38' }); prism(g, 25, 15, 28, 18, 0, 34, { top: '#7a4e26', south: '#5e3a1a', east: '#462a12', edge: '#9a6a38' });
      prism(g, 3, 16, 29, 18, 12, 32, { top: '#a8743e', south: '#7a4e26', east: '#5e3a1a', edge: '#c8925a' });
      onSouth(g, 18, f => { for (const [u, z, w, h] of [[6, 22, 8, 8], [17, 21, 9, 9], [8, 14, 7, 6], [18, 14, 6, 6]]) { rect(f, '#efe6d0', u, z, w, h); for (let k = 2; k < h - 1; k += 2) rect(f, '#9a8a70', u + 1, z + k, w - 2, 1); rect(f, '#c03030', u + w / 2, z + h - 1, 1, 1); } });
      prism(g, 2, 14, 30, 20, 34, 36, { top: '#7a4e26', south: '#5e3a1a', east: '#462a12', edge: '#9a6a38' });
    },
    // An anvil on a wooden block.
    anvil(g) {
      floorShadow(g, 12, 3);
      prism(g, 9, 10, 23, 22, 0, 9, { top: '#7a4e26', south: '#5e3a1a', east: '#462a12', edge: '#9a6a38' });
      prism(g, 12, 12, 20, 20, 9, 14, { top: '#5a5a62', south: '#3e3e44', east: '#2c2c30', edge: '#7a7a82' });
      prism(g, 6, 11, 26, 21, 14, 19, { top: '#5a5a62', south: '#3e3e44', east: '#2c2c30', edge: '#7a7a82' });
      prism(g, 26, 13, 31, 19, 15, 18, { top: '#5a5a62', south: '#3e3e44', east: '#2c2c30', edge: '#7a7a82' });
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
    // An altar: a stone block under a white cloth with a gold hem, a golden sun on it, two candles.
    altar(g) {
      floorShadow(g, 15, 3);
      prism(g, 3, 7, 29, 26, 0, 13, { top: '#e8e4dc', south: '#c4beb2', east: '#a09a8e', edge: '#ffffff' });
      prism(g, 2, 6, 30, 27, 13, 15, { top: '#fbfaf6', south: '#e8e4da', east: '#d4cfc4', edge: '#ffffff' });
      onSouth(g, 27, f => { rect(f, '#d8a830', 2, 13, 28, 2); rect(f, '#fbfaf6', 9, 5, 14, 8); rect(f, '#d8a830', 9, 5, 14, 1); });
      const [sx, sy] = P(16, 16, 16); ellipse(g, '#f0c040', sx, sy - 4, 4, 4); ellipse(g, '#fff0a0', sx - 1, sy - 5, 1.5, 1.5);
      for (const u of [6, 26]) { column(g, u, 16, 1.5, 15, 22, { light: '#fffbe8', mid: '#f0e8c8', dark: '#c8bc98', top: '#fff' }); const [fx, fy] = P(u, 16, 24); ellipse(g, '#ffb030', fx, fy, 1.2, 2); }
    },
    // A gravestone: a stone slab with a rounded top and a cross cut into it.
    // A gravestone: an upright slab with a rounded top and a cross cut into its face.
    // A gravestone: a low foot in the tiles' slant, and on it an upright stone with a rounded top, its top
    // edge showing, and a cross cut into its face.
    gravestone(g) {
      floorShadow(g, 10, 3);
      prism(g, 7, 13, 25, 21, 0, 4, { top: '#c4c4c0', south: '#9a9a96', east: '#76767a', edge: '#e4e4e0' });
      const [x, y] = P(16, 19, 4);
      const slab = (dy, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(x - 8, y + dy); g.lineTo(x - 8, y + dy - 14); g.arc(x, y + dy - 14, 8, Math.PI, 0); g.lineTo(x + 8, y + dy); g.closePath(); g.fill(); };
      slab(-3, '#c8c8c4');                 // its top edge (the back of the stone, seen from above)
      slab(0, '#9a9a96');                  // its face
      rect(g, '#b4b4b0', x - 8, y - 14, 1, 14);
      rect(g, '#5e5e5a', x - 1, y - 18, 2, 13); rect(g, '#5e5e5a', x - 5, y - 14, 10, 2);
    },
    // A canvas tent, its ridge running north to south: the west slope in the light, the east slope in shade, the
    // door in the south gable.
    tent(g) {
      floorShadow(g, 15, 5);
      const zr = 34;
      poly(g, '#c8b080', [...P(2, 4, 0), ...P(2, 28, 0), ...P(16, 28, zr), ...P(16, 4, zr)]);   // the west slope
      poly(g, '#9a8458', [...P(30, 4, 0), ...P(30, 28, 0), ...P(16, 28, zr), ...P(16, 4, zr)]); // the east slope
      poly(g, '#b49c6c', [...P(2, 28, 0), ...P(30, 28, 0), ...P(16, 28, zr)]);                   // the south gable
      poly(g, '#2a2018', [...P(11, 28, 0), ...P(21, 28, 0), ...P(16, 28, 20)]);                   // its door
      line(g, '#e0cc9a', 1, ...P(16, 4, zr), ...P(16, 28, zr));                                  // the ridge
      for (const v of [4, 28]) line(g, '#5a3a1a', 2, ...P(16, v, zr), ...P(16, v, zr + 5));      // its poles
      line(g, '#7a6440', 1, ...P(2, 28, 0), ...P(16, 28, zr));
    },
    // A torch on a pole, standing in the ground: the pole in the slant, the flame upright on top.
    torch(g, r, frame) {
      floorShadow(g, 4, 2);
      prism(g, 15, 15, 17, 17, 0, 26, { top: '#7a4e28', south: '#5b3a1e', east: '#3e2612', edge: '#8a5a2e' });
      prism(g, 14, 14, 18, 18, 26, 31, { top: '#4a4a52', south: '#3a3a42', east: '#2a2a30', edge: '#62626a' }); // its iron cup
      const [x, y] = P(16, 16, 31);
      flame(g, x, y + 1, 4, 10, frame);
    },
    torch_out(g) {
      floorShadow(g, 4, 2);
      prism(g, 15, 15, 17, 17, 0, 26, { top: '#7a4e28', south: '#5b3a1e', east: '#3e2612', edge: '#8a5a2e' });
      prism(g, 14, 14, 18, 18, 26, 31, { top: '#3a3a40', south: '#2e2e34', east: '#222226', edge: '#4e4e56' });
      prism(g, 14.5, 14.5, 17.5, 17.5, 31, 33, { top: '#2a2420', south: '#221c18', east: '#18120e', edge: '#3a322c' }); // charred
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
    // Shop signs: a board hanging from an iron arm, with a picture of the trade.
    sign_weapons: (g, r, frame, shape) => onWall(g, shape, () => hangingSign(g, '#7a4a22', () => {
      line(g, '#c8ccd4', 2, 11, 21, 21, 9); line(g, '#c8ccd4', 2, 21, 21, 11, 9);
      rect(g, '#6a4220', 10, 19, 3, 3); rect(g, '#6a4220', 19, 19, 3, 3);
    })),
    sign_armour: (g, r, frame, shape) => onWall(g, shape, () => hangingSign(g, '#5a4a3a', () => {
      poly(g, '#9aa0aa', [11, 9, 21, 9, 21, 15, 16, 21, 11, 15]); poly(g, '#c8ccd4', [11, 9, 16, 9, 16, 21, 11, 15]);
      rect(g, '#b03030', 15, 10, 2, 9);
    })),
    sign_magic: (g, r, frame, shape) => onWall(g, shape, () => hangingSign(g, '#3a2a5a', () => {
      poly(g, '#f0d050', [16, 8, 17.5, 13, 22, 13, 18.5, 16, 20, 21, 16, 18, 12, 21, 13.5, 16, 10, 13, 14.5, 13]);
      rect(g, '#a0d0ff', 21, 9, 1, 1); rect(g, '#a0d0ff', 11, 19, 1, 1);
    })),
    sign_food: (g, r, frame, shape) => onWall(g, shape, () => hangingSign(g, '#8a5a2a', () => {
      ellipse(g, '#c88a40', 16, 15, 6, 4); ellipse(g, '#e0a858', 15, 14, 4.5, 2.5);
      for (const x of [13, 16, 19]) rect(g, '#a86a2a', x, 13, 1, 3);
    })),
    sign_tools: (g, r, frame, shape) => onWall(g, shape, () => hangingSign(g, '#6a5030', () => {
      ellipse(g, '#c8a868', 16, 15, 5, 5); ellipse(g, '#6a5030', 16, 15, 2.5, 2.5); // a coil of rope
      line(g, '#c8a868', 1, 20, 18, 23, 21);
    })),
    sign_inn: (g, r, frame, shape) => onWall(g, shape, () => hangingSign(g, '#7a4a22', () => {
      rect(g, '#e8d8a8', 12, 10, 8, 10); rect(g, '#c88a30', 12, 13, 8, 7); rect(g, '#f8f0d8', 12, 9, 8, 2); // a mug of ale
      rect(g, '#e8d8a8', 20, 12, 3, 1); rect(g, '#e8d8a8', 22, 12, 1, 5); rect(g, '#e8d8a8', 20, 16, 3, 1);
    })),
    sign_depot: (g, r, frame, shape) => onWall(g, shape, () => hangingSign(g, '#4a5a6a', () => {
      rect(g, '#d8c8a0', 10, 10, 12, 9); poly(g, '#b8a880', [10, 10, 16, 15, 22, 10]); rect(g, '#c03030', 15, 14, 2, 2); // a letter
    })),
    sign_temple: (g, r, frame, shape) => onWall(g, shape, () => hangingSign(g, '#e0d8c0', () => {
      ellipse(g, '#f0c040', 16, 15, 4, 4); for (let a = 0; a < 8; a++) line(g, '#f0c040', 1, 16 + Math.cos(a * 0.785) * 5, 15 + Math.sin(a * 0.785) * 5, 16 + Math.cos(a * 0.785) * 7.5, 15 + Math.sin(a * 0.785) * 7.5);
    })),
    sign_school: (g, r, frame, shape) => onWall(g, shape, () => hangingSign(g, '#2a5a3a', () => {
      rect(g, '#f0e8d0', 10, 11, 6, 9); rect(g, '#e0d8c0', 16, 11, 6, 9); rect(g, '#8a6a3a', 15, 11, 2, 9); // an open book
      for (const y of [13, 15, 17]) { rect(g, '#8a8070', 11, y, 4, 1); rect(g, '#8a8070', 17, y, 4, 1); }
    })),
    // A box of flowers under a window.
    window_box: (g, r, frame, shape) => onWall(g, shape, () => {
      for (let i = 0; i < 7; i++) {
        const x = 8 + i * 2.5;
        rect(g, '#3a7a30', x, 20, 1, 3);
        rect(g, ['#e84a5f', '#f5d547', '#ffffff', '#b06ee0'][(r() * 4) | 0], x - 1, 18 + ((r() * 2) | 0), 3, 2);
      }
      rect(g, '#7a4a22', 7, 23, 18, 4); rect(g, '#9a6632', 7, 23, 18, 1); rect(g, '#5a3418', 7, 26, 18, 1);
    }),
    // A lantern on a bracket, glowing.
    lantern: (g, r, frame, shape) => onWall(g, shape, () => {
      rect(g, '#2e2e34', 12, 6, 8, 2);
      rect(g, '#2e2e34', 18, 6, 2, 4);
      rect(g, '#3a3a40', 15, 9, 6, 2);
      ellipse(g, 'rgba(255,210,120,0.35)', 18, 15, 7, 7);
      rect(g, '#3a3a40', 15, 11, 6, 9);
      rect(g, '#ffe090', 16, 12, 4, 7);
      rect(g, '#fff4c8', 17, 13, 2, 3);
      rect(g, '#3a3a40', 14, 20, 8, 2);
    }),
    // A shelf with jars and pots.
    shelf: (g, r, frame, shape) => onWall(g, shape, () => {
      for (const y of [13, 22]) { rect(g, '#6a4220', 5, y, 22, 2); rect(g, '#8a5a2c', 5, y, 22, 1); }
      for (const y of [13, 22]) for (let x = 7; x < 25; x += 4 + ((r() * 2) | 0)) {
        const c = ['#4a7ac0', '#c04a3a', '#d8c070', '#5aa050', '#e8e0d0'][(r() * 5) | 0], h = 4 + ((r() * 3) | 0);
        rect(g, c, x, y - h, 3, h); rect(g, 'rgba(255,255,255,0.4)', x, y - h, 1, h);
      }
    }),
    // Swords, an axe and a spear on a wooden rack.
    weapon_rack: (g, r, frame, shape) => onWall(g, shape, () => {
      rect(g, '#6a4220', 5, 8, 22, 2); rect(g, '#6a4220', 5, 22, 22, 2);
      for (const x of [9, 14]) { rect(g, '#c8ccd4', x, 4, 2, 18); rect(g, '#ffffff', x, 4, 1, 18); rect(g, '#7a5a2a', x - 2, 18, 6, 2); rect(g, '#4a3018', x, 20, 2, 5); }
      rect(g, '#6a4220', 20, 3, 2, 23); poly(g, '#c8ccd4', [22, 5, 27, 8, 27, 13, 22, 11]); // an axe
    }),
    sign_wall: (g, r, frame, shape) => onWall(g, shape, () => {
      rect(g, '#9a6a38', 5, 8, 22, 11);
      rect(g, '#6e4422', 5, 18, 22, 1);
      rect(g, '#4a2a10', 8, 11, 15, 1);
      rect(g, '#4a2a10', 8, 14, 11, 1);
    }),
    door_sealed: (g, r, frame, shape, material) => doorInWall(g, r, shape, material, false, true),
    // A chair: a slatted back, a seat lit from above, legs.
    // A chair: four legs, a seat, and a slatted back along its north edge.
    // A chair facing south (its back along the north edge); chair_east, chair_west and chair_north
    // turn it. Four thin legs, a thin seat, and a back of two posts with two rails between them.
    chair(g) { drawChair(g, 's'); },
    chair_east(g) { drawChair(g, 'e'); },
    chair_west(g) { drawChair(g, 'w'); },
    chair_north(g) { drawChair(g, 'n'); },
    // A potted plant: a clay pot and a bushy plant in it.
    // A potted plant: a clay pot with a rim, and a bushy plant growing out of it.
    plant(g) {
      floorShadow(g, 9, 3);
      drum(g, 16, 17, 0, 10, t => 6 + 2 * t, { edge: '#7a3a24', light: '#d8784e', mid: '#a8543a', dark: '#6a2e1c' });
      drum(g, 16, 17, 10, 12, () => 8.5, { edge: '#8a4228', light: '#e08858', mid: '#b86040', dark: '#7a3620' });
      const [x, y] = P(16, 17, 18);
      for (const [dx, dy, rad] of [[-4, 3, 5], [4, 3, 5], [0, -3, 6], [0, 2, 6]]) ellipse(g, '#1e5a1a', x + dx + 0.5, y + dy + 1, rad, rad * 0.9);
      for (const [dx, dy, rad] of [[-4, 3, 5], [4, 3, 5], [0, -3, 6], [0, 2, 6]]) ellipse(g, '#3a8a35', x + dx, y + dy, rad - 1, rad * 0.9 - 1);
      for (const [dx, dy] of [[-5, 1], [-1, -5], [3, 0]]) ellipse(g, '#5aaa48', x + dx, y + dy, 2, 1.5);
    },
    // A bed: a wooden frame, a white pillow and a red blanket, a tall headboard at the north end.
    bed(g) {
      floorShadow(g, 15, 3);
      prism(g, 3, 1, 29, 4, 0, 16, { top: '#8a5a2c', south: '#6e4422', east: '#55331a', edge: '#a8743e' });
      prism(g, 3, 4, 29, 30, 0, 6, { top: '#7a4e26', south: '#6a4220', east: '#4e2e14', edge: '#9a6a38' });
      prism(g, 5, 5, 27, 29, 6, 9, { top: '#f4f2ec', south: '#d8d4cc', east: '#b8b4ac', edge: '#ffffff' });
      prism(g, 7, 6, 25, 11, 9, 12, { top: '#ffffff', south: '#e4e0d8', east: '#c8c4bc', edge: '#ffffff' });
      prism(g, 5, 13, 27, 29, 9, 10, { top: '#b8302e', south: '#8e2220', east: '#701a18', edge: '#d84a46' });
      line(g, 'rgba(255,255,255,0.3)', 1, ...P(6, 16, 10), ...P(26, 16, 10));
    },
    // A signpost: a post with a board on it.
    signpost(g) {
      floorShadow(g, 7, 2);
      prism(g, 14, 15, 17, 18, 0, 26, { top: '#7a4e26', south: '#5e3a1a', east: '#462a12', edge: '#9a6a38' });
      prism(g, 4, 15, 28, 17, 16, 27, { top: '#a8743e', south: '#7a4e26', east: '#5e3a1a', edge: '#c8925a' });
      onSouth(g, 17, f => { for (const z of [19, 22]) rect(f, '#4a2a10', 8, z, 15, 1); });
    },
    // A depot locker: an iron-bound wooden cabinet with two doors, a handle and a brass plate.
    depot(g) {
      floorShadow(g, 14, 3);
      prism(g, 3, 8, 29, 26, 0, 26, { top: '#6a4a2a', south: '#5a3a1c', east: '#432a12', edge: '#8a6a40' });
      onSouth(g, 26, f => {
        for (const u of [3, 15]) { rect(f, '#4a2e14', u, 2, 11, 21); rect(f, '#6e4a26', u + 1, 3, 9, 19); }
        rect(f, '#9a9aa2', 2, 0, 24, 2); rect(f, '#9a9aa2', 2, 24, 24, 2);
        rect(f, '#e0b040', 12, 10, 2, 4); rect(f, '#e0b040', 15, 10, 2, 4);
        rect(f, '#d8c070', 8, 18, 10, 3);
      });
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
    // A ladder up through a dark hole in the ceiling, to the trapdoor on the floor above.
    cave_ladder(g) {
      poly(g, '#0a0806', [...P(5, 5, 54), ...P(27, 5, 54), ...P(27, 27, 54), ...P(5, 27, 54)]);
      const wood = { top: '#a6743e', south: '#7a4f26', east: '#5a3818', edge: '#c08a4e' };
      prism(g, 8, 3, 11, 6, 0, 54, wood);
      for (let z = 7; z < 54; z += 8) prism(g, 11, 4, 21, 5, z, z + 2, wood);
      prism(g, 21, 3, 24, 6, 0, 54, wood);
    },
    // A ladder up to a sewer grate: it stands against the tile's north edge and reaches the ceiling,
    // in the daylight that falls through the grate, striped by its bars.
    sewer_ladder(g) {
      g.save();
      g.beginPath();
      g.rect(64 + 5, 64 + 6, 22, 22);
      g.clip();
      rect(g, 'rgba(255,240,190,0.14)', 64 + 5, 64 + 6, 22, 22);
      for (let x = 64 + 7; x < 64 + 27; x += 4) rect(g, 'rgba(255,244,200,0.2)', x, 64 + 6, 2, 22);
      g.restore();
      // the grate overhead, seen from below: daylight through its bars, where the floor above is drawn
      const sky = [...P(5, 5, 54), ...P(27, 5, 54), ...P(27, 27, 54), ...P(5, 27, 54)];
      poly(g, 'rgba(255,244,205,0.55)', sky);
      for (let u = 9; u < 27; u += 4) line(g, '#3a3a40', 2, ...P(u, 5, 54), ...P(u, 27, 54));
      line(g, '#4a4a50', 2, ...P(5, 5, 54), ...P(27, 5, 54)); line(g, '#4a4a50', 2, ...P(5, 27, 54), ...P(27, 27, 54));
      const wood = { top: '#a6743e', south: '#7a4f26', east: '#5a3818', edge: '#c08a4e' };
      prism(g, 8, 3, 11, 6, 0, 54, wood);
      for (let z = 7; z < 54; z += 8) prism(g, 11, 4, 21, 5, z, z + 2, wood);
      prism(g, 21, 3, 24, 6, 0, 54, wood);
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

  const ANIMATED = { torch: { frames: [0, 1, 2, 3], ms: 120 }, wall_torch: { frames: [0, 2, 1, 3], ms: 130 }, campfire: { frames: [0, 1, 2, 3, 1, 2], ms: 110 }, windmill: { frames: [0, 1, 2, 3], ms: 260 }, cauldron: { frames: [0, 1, 2], ms: 300 }, fountain: { frames: [0, 1, 2, 3], ms: 220 }, chimney: { frames: [0, 1, 2, 3], ms: 380 }, water: { frames: [0, 1, 2, 1], ms: 400 }, sewer_water: { frames: [0, 1, 2, 1], ms: 520 }, lava: { frames: [0, 1, 2, 1], ms: 500 }, teleport: { frames: [0, 1, 2, 3, 4, 5, 6, 7], ms: 120 } };

  // Ground tiles get 4 variants each; these get a few as well.
  const VARIANTS = { apple_crate: 2, shelf: 3, window_box: 3, pier: 3, crag: 4, pebbles: 3, shells: 2, leaves: 3, grass_tuft: 3, driftwood: 2, wreck: 2, flagpole: 3, eggs: 2, fallen_pillar: 2, ice_spike: 2, tallgrass: 3, log: 2, rubble: 2, crystal: 2, stalagmite: 3, lilypad: 2, dry_bush: 2, puddle: 2, stall: 3, basket: 3, planter: 3, hedge: 2, tree: 3, pine: 2, snow_pine: 2, jungle_tree: 3, palm: 2, bush: 2, flowers: 3, reeds: 2, mushrooms: 2, wall_cave: 3, cliff: 4, wall_stone: 2, wall_block: 2, wall_wood: 2, wall_temple: 2, bookshelf: 2 };
  const spriteOf = id => THINGS[id].sprite || id;
  // Grounds drawn as one 96x96 texture spread over 3x3 tiles, for rock that has no seams.
  // Grounds drawn as one big texture (tiles x tiles), each tile showing its own part of it by position, so
  // no tile shows as a square. The big texture wraps round at its edges, so it tiles without a seam too.
  const SEAMLESS = {
    rock_top: { tiles: 3, draw: g => rockSurface(g, makeRng(hashStr('rock_top')), 3 * TILE, 132) },
    grass: { tiles: 4, draw: g => grassField(g, makeRng(hashStr('grass')), 4 * TILE) },
    mountain: { tiles: 3, draw: g => { // rocky ground: grey stone with loose stones on it
      const r = makeRng(hashStr('mountain')), size = 3 * TILE;
      rockSurface(g, r, size, 134);
      for (let i = 0; i < 40; i++) {
        const x = 3 + r() * (size - 6), y = 3 + r() * (size - 6), rx = 1.5 + r() * 2;
        ellipse(g, 'rgba(0,0,0,0.3)', x + 0.5, y + 1, rx + 0.5, rx * 0.7);
        ellipse(g, gray(150 + ((r() * 30) | 0), 2), x, y, rx, rx * 0.7);
        rect(g, gray(200, 2), x - rx * 0.4, y - rx * 0.4, 1, 1);
      }
    } },
  };
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
    spiked_club: g => club(g, '#7a4e26', true),
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
    torn_note(g) {
      poly(g, '#e8dcc0', [7, 9, 24, 7, 26, 23, 18, 26, 9, 25]);
      for (const y of [12, 15, 18, 21]) line(g, '#6a5a3a', 1, 10, y, 23, y - 1);
      line(g, '#a08a5a', 1, 24, 7, 26, 23);
    },
    bell_clapper(g) {
      shadow(g, 16, 27, 11, 3);
      line(g, '#6a4410', 3, 8, 8, 19, 19);
      line(g, '#d8a840', 1, 8, 7, 19, 18);
      ellipse(g, '#a87020', 21, 21, 6, 6);
      ellipse(g, '#e8c060', 19.5, 19.5, 3, 3);
      rect(g, '#5a3a0c', 5, 5, 5, 3); // the ring it hung by
    },
    chewed_rope(g) {
      g.strokeStyle = '#a8865a';
      g.lineWidth = 3;
      for (let i = 0; i < 2; i++) { g.beginPath(); g.ellipse(15, 18, 10 - i * 4, 7 - i * 3, 0, 0, Math.PI * 2); g.stroke(); }
      line(g, '#a8865a', 3, 24, 18, 27, 10);
      for (const [x, y] of [[25, 6], [28, 6], [30, 9], [26, 8]]) line(g, '#e0c898', 1, 27, 10, x, y); // gnawed threads
      line(g, '#6a4a2a', 1, 21, 14, 27, 12); // and a clean cut
    },
    carved_stone(g) {
      shadow(g, 16, 26, 11, 3);
      ellipse(g, '#6e6e6a', 16, 18, 12, 9);
      ellipse(g, '#8e8e88', 15, 17, 11, 8);
      g.strokeStyle = '#4a4a46'; g.lineWidth = 1;
      for (const [cx, cy] of [[9, 16], [23, 16]]) { g.beginPath(); for (let a = 0; a < 10; a += 0.4) g.lineTo(cx + Math.cos(a) * a * 0.35, cy + Math.sin(a) * a * 0.3); g.stroke(); }
      ellipse(g, '#d8d4c8', 16, 16, 3.5, 3.5); // the little skull
      rect(g, '#3a3a36', 14, 15, 1, 2); rect(g, '#3a3a36', 17, 15, 1, 2); rect(g, '#d8d4c8', 14, 19, 4, 1);
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
    gnash: { scale: 0.95, skin: '#5a8a34', hair: '#2a1a0a', eye: '#ff4020', body: '#6a2a1a', belt: '#d0a030', legs: '#3a2a1a', arms: '#5a8a34', hat: { style: 'helmet', color: '#8a8070' }, held: 'axe' }, // Chief Gnash
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
    gravewaker: { skin: '#c8d0c0', hair: '#2a2a2a', eye: '#60ff80', body: '#2a3a2e', belt: '#6a5a3a', legs: '#2a3a2e', arms: '#2a3a2e', robe: true, hat: { style: 'hood', color: '#1e2a22' }, held: 'staff' },
    demon: { scale: 1.6, skin: '#a82020', hair: '#5a0a0a', eye: '#ffd020', body: '#8a1818', belt: '#3a0a0a', legs: '#6a1010', arms: '#a82020', horns: '#2a1a1a', wings: '#4a0a0a', held: 'axe' },
    drowned_king: { scale: 1.4, skin: '#5a8a8a', hair: '#2a4a4a', eye: '#a0ffff', beard: '#3a6a6a', body: '#2a4a5a', belt: '#c0a040', legs: '#1a3a4a', arms: '#5a8a8a', hat: { style: 'crown', color: '#d0b030' }, held: 'staff' },
  };

  // Things standing on the ground get a dark ink line round them, as in the classic games, so they
  // read clearly against any ground. Their soft shadows (half see-through) get none.
  const NO_INK = new Set(['flowers', 'tallgrass', 'grass_tuft', 'leaves', 'pebbles', 'shells', 'puddle', 'rubble', 'bones', 'web',
    'fern', 'reeds', 'lilypad', 'crops', 'eggs', 'mushrooms', 'driftwood', 'rails', 'loose_sand', 'teleport', 'campfire', 'torch', 'grate', 'chimney']);
  const inkable = (id, def) => !def.ground && !def.wall && !def.onWall && !def.roof && !def.change && !NO_INK.has(id);
  function inked(g, draw) {
    const { width, height } = g.canvas, layer = document.createElement('canvas');
    layer.width = width;
    layer.height = height;
    const f = layer.getContext('2d');
    draw(f);
    const src = f.getImageData(0, 0, width, height).data, out = g.createImageData(width, height), d = out.data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < width && y < height && src[(y * width + x) * 4 + 3] >= 200;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (solid(x, y) || !(solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) continue;
      const i = (y * width + x) * 4;
      d[i] = 22; d[i + 1] = 15; d[i + 2] = 10; d[i + 3] = 215;
    }
    g.putImageData(out, 0, 0);
    g.drawImage(layer, 0, 0);
  }

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

  const RAT = { tail: '#d9939a', body: '#7a7068', back: '#8d847b', head: '#857b72', ear: '#e0a0a6', eye: '#111' };
  const GIANT_RAT = { tail: '#c07a80', body: '#5a4434', back: '#6e5644', head: '#644c3a', ear: '#c88a8e', eye: '#e02a20' };
  function rat(g, dir, frame, c = RAT) {
    const dx = DX[dir], dy = DY[dir], horiz = dx !== 0;
    const cx = 16, cy = 20 - (frame === 1 ? 1 : 0);
    shadow(g, 16, 26, 9, 3);
    line(g, c.tail, 1.5, cx - dx * 7, cy - dy * 6, cx - dx * 13 + (horiz ? 0 : 3), cy - dy * 11 + (horiz ? 3 : 0));
    ellipse(g, c.body, cx, cy, horiz ? 8 : 6, horiz ? 5 : 7);
    ellipse(g, c.back, cx, cy - 1, horiz ? 6 : 4, horiz ? 3 : 5);
    const hx = cx + dx * 8, hy = cy + dy * 7;
    ellipse(g, c.head, hx, hy, 4, 4);
    ellipse(g, c.ear, hx - dx * 2 - dy * 3, hy - dy * 2 + dx * 3 - 2, 2, 2);
    ellipse(g, c.ear, hx - dx * 2 + dy * 3, hy - dy * 2 - dx * 3 - 2, 2, 2);
    if (dir === 2) {
      rect(g, c.eye, hx - 2, hy, 1, 1);
      rect(g, c.eye, hx + 1, hy, 1, 1);
    } else if (horiz) {
      rect(g, c.eye, hx + dx, hy - 1, 1, 1);
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
  const BIG_BEASTS = ['greyfang', 'old_snapper', 'thornmother', 'cistern_slime', 'giant_rat', 'giant_spider', 'dragon', 'frost_dragon', 'dragon_lord', 'polar_bear', 'crocodile'];
  function creatureDrawer(key) {
    const look = lookFor(key);
    if (look) return (g, d, f) => humanoid(g, look, d, f);
    return {
      rat, slime, spider, wolf, ghost, crab, cat, dog, chicken, giant_spider: giantSpider, dragon, bear, scorpion, viper,
      cistern_slime: (g, d, f) => { // a slime as big as a cart, dark with the filth of the cistern
        g.translate(16, 27);
        g.scale(1.7, 1.7);
        g.translate(-16, -27);
        g.filter = 'hue-rotate(40deg) brightness(0.75)';
        slime(g, d, f);
        g.filter = 'none';
      },
      giant_rat: (g, d, f) => { // a rat the size of a dog, with red eyes
        g.translate(16, 26);
        g.scale(1.45, 1.45);
        g.translate(-16, -26);
        rat(g, d, f, GIANT_RAT);
      },
      ice_wolf: (g, d, f) => wolf(g, d, f, ICE_WOLF),
      // the gate watch's bosses: the beast they lead, bigger and darker
      greyfang: (g, d, f) => { // the alpha: grey and scarred, a head taller than the pack
        g.translate(16, 27);
        g.scale(1.35, 1.35);
        g.translate(-16, -27);
        g.filter = 'grayscale(0.7) brightness(0.8) contrast(1.2)';
        wolf(g, d, f);
        g.filter = 'none';
      },
      old_snapper: (g, d, f) => { // a crab with a shell like a cart wheel, dark with age
        g.translate(16, 26);
        g.scale(1.6, 1.6);
        g.translate(-16, -26);
        g.filter = 'brightness(0.75) saturate(1.4) hue-rotate(-12deg)';
        crab(g, d, f);
        g.filter = 'none';
      },
      thornmother: (g, d, f) => { // the spider queen: purple-black, bigger than a dog
        g.translate(16, 26);
        g.scale(1.5, 1.5);
        g.translate(-16, -26);
        g.filter = 'hue-rotate(250deg) brightness(0.7) saturate(1.6)';
        spider(g, d, f);
        g.filter = 'none';
      },
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
  const PAVED = { paving: 0, cobble: 0, brick: 0, tiles: 0, gravel: 0, sandstone: 0, wood: 0, farmland: 0, bridge_ns: 0, bridge_ew: 0, sewer_bridge_ns: 0, sewer_bridge_ew: 0, marble: 0, carpet: 0 };
  // Water lies lowest: paving meets it at a stone edge, like a quay. Bridges take and give no borders:
  // they have their own beams.
  const BORDER_PRIORITY = { ...PAVED, bridge_ns: undefined, bridge_ew: undefined, sewer_bridge_ns: undefined, sewer_bridge_ew: undefined,
    water: -1, lava: -1, sewer_water: -1, sewer: 1, sand: 1, ash: 1, cave: 1, swamp: 2, dirt: 2, grass: 3, jungle: 3, snow: 4, mountain: 2.5, rock_top: 6 }; // grass lies over rocky ground, as over dirt
  // How a ground's edge looks where it spills over a lower one: shade (its shadow on the lower
  // ground), rim (the edge line), light (a bright line just inside), tufts or pebbles along it.
  const EDGE_STYLE = {
    default: { shade: 'rgba(0,0,0,0.16)', rim: 'rgba(0,0,0,0.28)' },
    grass: { shade: '#5a3c1e', lip: 3, rim: '#2a5e1c', light: 'rgba(120,200,90,0.5)' },
    jungle: { shade: 'rgba(10,20,8,0.25)', rim: 'rgba(20,50,18,0.75)', tufts: ['#275a22', '#3a7a32', '#1e4a1a'] },
    dirt: { shade: 'rgba(30,20,8,0.2)', rim: 'rgba(78,56,30,0.75)', pebbles: ['#a3845a', '#6e5230', '#b89a70'] },
    sand: { shade: 'rgba(60,45,10,0.14)', rim: 'rgba(176,150,96,0.8)', light: 'rgba(248,238,200,0.55)', pebbles: ['#c4ad6f', '#f0e4c0'] },
    swamp: { shade: 'rgba(10,15,8,0.25)', rim: 'rgba(36,46,26,0.8)', tufts: ['#56683a', '#3f4f28'] },
    mountain: { shade: 'rgba(0,0,0,0.4)', rim: '#2a2a2a', light: 'rgba(220,220,214,0.6)' },
    snow: { shade: 'rgba(60,80,110,0.2)', rim: 'rgba(170,190,215,0.85)', light: 'rgba(255,255,255,0.8)' },
    ash: { shade: 'rgba(0,0,0,0.25)', rim: 'rgba(40,36,34,0.85)', pebbles: ['#5a5654', '#2e2a28'] },
    rock_top: { shade: 'rgba(0,0,0,0.45)', rim: '#1e1e20', light: 'rgba(230,230,224,0.6)' },
    cave: { shade: 'rgba(0,0,0,0.3)', rim: 'rgba(40,34,28,0.85)', pebbles: ['#5a5047', '#362f29', '#6a6056'] },
    sewer: { shade: 'rgba(0,0,0,0.45)', lip: 2, rim: '#1a1c18', light: 'rgba(170,180,150,0.45)', width: 3, wobble: 0 }, // a stone kerb along the channel
    paved: { shade: 'rgba(0,0,0,0.4)', lip: 2, rim: '#2e2e30', light: 'rgba(255,255,255,0.3)', width: 3, wobble: 0 },   // paving over water: a quay's edge
  };
  const edgeStyle = id => EDGE_STYLE[id] || (PAVED[id] !== undefined ? EDGE_STYLE.paved : EDGE_STYLE.default);
  // The pixels of a ground's texture for the tile at (x, y): seamless grounds by position.
  const texturePixels = (id, x, y) => {
    const k = SEAMLESS[id], key = k ? `${id}:${((x % k.tiles) + k.tiles) % k.tiles}:${((y % k.tiles) + k.tiles) % k.tiles}` : id;
    if (!texturePixels.cache.has(key)) {
      const c = k ? seamlessPart(id, x, y) : groundTexture(id);
      texturePixels.cache.set(key, c.getContext('2d').getImageData(0, 0, TILE, TILE).data);
    }
    return texturePixels.cache.get(key);
  };
  texturePixels.cache = new Map();
  function seamlessPart(id, x, y) {
    const k = SEAMLESS[id], n = k.tiles, px = ((x % n) + n) % n, py = ((y % n) + n) % n;
    const big = cached(`big:${id}`, g => k.draw(g), n * TILE);
    return cached(`${id}:part:${px}:${py}`, g => g.drawImage(big, -px * TILE, -py * TILE));
  }
  // Neighbour bits for edge(): n e s w, then the corners ne se sw nw.
  const EDGE_BITS = { n: 1, e: 2, s: 4, w: 8, ne: 16, se: 32, sw: 64, nw: 128 };
  const EDGE_RECTS = [[1, 0, -32, 32, 0], [2, 32, 0, 64, 32], [4, 0, 32, 32, 64], [8, -32, 0, 0, 32],
    [16, 32, -32, 64, 0], [32, 32, 32, 64, 64], [64, -32, 32, 0, 64], [128, -32, -32, 0, 0]];
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
      if (PARTS[sprite]) {
        const anim = ANIMATED[PARTS[sprite][0]];
        return bigPart(sprite, anim ? anim.frames[Math.floor(time / anim.ms) % anim.frames.length] : 0);
      }
      if (SEAMLESS[sprite]) return seamlessPart(sprite, x, y); // a part of one big texture, by position
      const variant = hashXY(x, y) % variantsOf(id);
      const anim = ANIMATED[sprite];
      const frame = anim ? anim.frames[Math.floor(time / anim.ms) % anim.frames.length] : 0;
      const shaped = def.wall === 'thin' || def.onWall || def.roof || id === 'fence' || BRIDGES.has(id);
      const form = shaped ? `${shape}:${sprite.startsWith('door') ? material : ''}` : '';
      const raised = RAISED.has(sprite), size = def.wall || def.tall || def.onWall || raised ? 2 * TILE : TILE;
      const paint = g => DRAW[sprite](g, makeRng(hashStr(sprite) + variant * 7919), frame, shape, material);
      return cached(`${sprite}:${form}:${variant}:${frame}`, inkable(sprite, def) ? g => inked(g, paint) : paint, raised ? 3 * TILE : size);
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
    // The edge of a higher ground spilling into a tile from the neighbours in `mask` (EDGE_BITS), all at
    // once: each pixel looks at how far it is from those neighbours, so straight edges, outer corners and
    // inner corners are all one smooth line that runs on into the next tile without a seam. The line
    // wobbles a little (variant 0-2 picks how), but always meets the tile's sides at the same width.
    // Seamless grounds show their own texture for this place (x, y).
    edge(ground, mask, variant, x, y) {
      const corners = [[16, 1, 2], [32, 4, 2], [64, 4, 8], [128, 1, 8]];
      for (const [c, a, b] of corners) if (mask & (a | b)) mask &= ~c; // a corner only counts on its own
      const k = SEAMLESS[ground], pos = k ? `${((x % k.tiles) + k.tiles) % k.tiles}:${((y % k.tiles) + k.tiles) % k.tiles}` : '';
      return cached(`edge:${ground}:${mask}:${variant}:${pos}`, g => {
        const st = edgeStyle(ground), tex = texturePixels(ground, x, y);
        const width = st.width || 5, amp = st.wobble === undefined ? 1 : st.wobble;
        const k1 = [2, 3, 4][variant], k2 = [5, 7, 6][variant];
        const wob = t => amp * (1.1 * Math.sin(k1 * Math.PI * t) + 0.5 * Math.sin(k2 * Math.PI * t));
        const rects = EDGE_RECTS.filter(([bit]) => mask & bit);
        const img = g.createImageData(TILE, TILE), d = img.data;
        // colours as [r, g, b, a] from CSS, via a 1-pixel canvas
        const probe = document.createElement('canvas').getContext('2d');
        const rgb = c => { probe.clearRect(0, 0, 1, 1); probe.fillStyle = c; probe.fillRect(0, 0, 1, 1); return probe.getImageData(0, 0, 1, 1).data; };
        const rim = rgb(st.rim), light = st.light && rgb(st.light), shade = rgb(st.shade), dots = st.tufts || st.pebbles;
        const dotRgb = dots && dots.map(rgb);
        const put = (i, c, a = c[3] / 255) => { // blend c over what's there
          const o = d[i + 3] / 255, na = a + o * (1 - a);
          if (!na) return;
          for (let j = 0; j < 3; j++) d[i + j] = (c[j] * a + d[i + j] * o * (1 - a)) / na;
          d[i + 3] = na * 255;
        };
        for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
          const cx = px + 0.5, cy = py + 0.5;
          let dist = 99;
          for (const [, x0, y0, x1, y1] of rects) dist = Math.min(dist, Math.hypot(Math.max(x0 - cx, 0, cx - x1), Math.max(y0 - cy, 0, cy - y1)));
          const r = width + wob(cx / TILE) + wob(cy / TILE) * 0.8;
          const i = (py * TILE + px) * 4;
          if (dist < r - 1) {
            for (let j = 0; j < 4; j++) d[i + j] = tex[i + j];
            if (light && dist >= r - 2) put(i, light);
          } else if (dist < r) {
            d[i] = rim[0]; d[i + 1] = rim[1]; d[i + 2] = rim[2]; d[i + 3] = rim[3] || 255;
          } else if (dist < r + (st.lip || 1.5)) put(i, shade);
          if (dotRgb && dist > r - 2 && dist < r + 1.5) {
            const h = (((px * 73856093) ^ (py * 19349663) ^ (variant * 83492791)) >>> 0) % 100;
            if (h < 9) put(i, dotRgb[h % dotRgb.length], 1);
          }
        }
        g.putImageData(img, 0, 0);
      });
    },
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
            edge.push([x, end ? 5 : 5 + Math.sin(x * 0.3 + variant * 2.1) * 1.5 + Math.sin(x * 0.9 + variant) * 0.6]);
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
        g.lineWidth = style.lip || 2;                 // a raised edge shows its earth (style.lip pixels of it)
        g.strokeStyle = style.shade;
        trace(0, style.lip ? 2 : 1.5);
        g.stroke();
        g.globalCompositeOperation = 'source-over';
        // The rim, and a light line just inside it on bright grounds.
        g.lineWidth = 1;
        g.strokeStyle = style.rim;
        trace(0, 0.5);
        g.stroke();
        if (style.light) { g.strokeStyle = style.light; trace(0, -1); g.stroke(); }
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
            if (r() < 0.75) rect(g, ['#7c7c7a', '#929290', '#6a6a6a', '#a2a29e'][(r() * 4) | 0], x, y, 2, 1);
          }
        }
        // stones of a few sizes, the larger ones nearer the rock
        for (let i = 0; i < (corner ? 3 : 7); i++) {
          const x = corner ? TILE - 2 - r() * 10 : 1 + r() * 30, y = corner ? 1 + r() * 8 : 2 + r() * 8, s = y < 5 ? 2.5 : 1.5;
          if (corner && reach(x, y) > 12) continue;
          ellipse(g, 'rgba(0,0,0,0.3)', x + 0.5, y + 1, s + 0.5, s * 0.6);
          ellipse(g, ['#9a9a96', '#8a8a88', '#acaca8'][i % 3], x, y, s, s * 0.75);
          rect(g, '#dcdcd8', x - s * 0.5, y - s * 0.5, 1, 1);
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
      // A rim of rocks along an open edge of a mountain top: big boulders lying over the edge (as the classic
      // maps edge a mountain), half on the top and half hanging over, the gaps between them in shadow.
      return cached(`lip:${d}:${variant}`, g => {
        const r = makeRng(hashStr(`lip${d}${variant}`));
        g.translate(16, 16);
        g.rotate(({ n: 0, e: 1, s: 2, w: 3 })[d] * Math.PI / 2);
        g.translate(-16, -16);
        rect(g, 'rgba(0,0,0,0.25)', 0, 0, TILE, 5);
        const stones = [];
        for (let x = -2; x < TILE + 4; x += 7 + r() * 3) stones.push([x, 2 + r() * 2, 5 + r() * 2.5, 4 + r() * 1.5]);
        stones.sort((p, q) => p[1] - q[1]);
        stones.forEach(([x, y, rx, ry], i) => boulder(g, x, y, rx, ry, ROCK.top, i));
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
