'use strict';
// Procedurally drawn 32x32 sprites, rendered once into cached canvases.

const Sprites = (() => {
  const cache = new Map();
  const urls = new Map();
  const silhouettes = new WeakMap();

  function cached(key, draw, size = TILE, height = size) {
    let c = cache.get(key);
    if (!c && (c = bakedPicture(key))) cache.set(key, c); // (made ahead of time: see bakedPicture)
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
  // The lintel over an archway (see arch_span_s): on the south or east face, the top third of the floor's height.
  function spanLintel(g, r, which) {
    face(g, which, 0, () => {
      g.save(); g.beginPath(); g.rect(0, 0, TILE, 11); g.clip();
      ashlar(g, r, which === 'east');
      g.restore();
      for (let u = 3; u < TILE; u += 5) line(g, 'rgba(30,26,22,0.55)', 0.8, u, 3, u + (u - 16) * 0.12, 11); // the wedge joints
      rect(g, '#24201c', 0, 11, TILE, 1.5);                 // its edge
      rect(g, 'rgba(10,8,6,0.35)', 0, 12.5, TILE, 3);       // the vault's shadow under it
    });
  }
  // A great arch over a passage three tiles wide, part `i` (0, 1, 2) of it, on the south or east face: the wall above
  // it down to a curve that springs low at the sides and rises to the top in the middle (a circle through
  // (0, 24), (48, 6), (96, 24) in face coordinates, v down from the top), a ring of wedge-shaped stones along it, a
  // gilded keystone, and the shadow of the vault under it.
  const ARCH = { cy: 79, r: 73 }, archV = u => ARCH.cy - Math.sqrt(ARCH.r * ARCH.r - (u - 48) * (u - 48));
  function gateArch(g, r, which, i) {
    face(g, which, 0, () => {
      const u0 = i * TILE, curve = (lift, back) => { const pts = []; for (let u = 0; u <= TILE; u += 2) pts.push([u, archV(u0 + u) - lift]); return back ? pts.reverse() : pts; };
      const fill = (lift, color) => { g.fillStyle = color; g.beginPath(); g.moveTo(0, 0); g.lineTo(TILE, 0); for (const [u, v] of curve(lift, true)) g.lineTo(u, v); g.closePath(); g.fill(); };
      g.save(); g.beginPath(); g.moveTo(0, 0); g.lineTo(TILE, 0); for (const [u, v] of curve(0, true)) g.lineTo(u, v); g.closePath(); g.clip();
      ashlar(g, r, which === 'east');                                                   // the wall over the arch
      g.restore();
      // the ring of voussoirs: a band 5 deep along the curve, lighter, with joints pointing to the arch's centre
      g.fillStyle = which === 'east' ? '#a69a84' : '#d8ccb4';
      g.beginPath(); for (const [u, v] of curve(5)) g.lineTo(u, v); for (const [u, v] of curve(0, true)) g.lineTo(u, v); g.closePath(); g.fill();
      for (let u = (8 - (u0 % 8)) % 8; u <= TILE; u += 8) {
        const a = Math.atan2(archV(u0 + u) - ARCH.cy, u0 + u - 48);
        line(g, 'rgba(60,50,40,0.6)', 0.8, u, archV(u0 + u), u - Math.cos(a) * 5, archV(u0 + u) + Math.sin(a) * -5);
      }
      g.strokeStyle = '#2a2420'; g.lineWidth = 1.2; g.beginPath(); for (const [u, v] of curve(0)) g.lineTo(u, v); g.stroke(); // its edge
      if (i === 1) { poly(g, '#a87818', [13, 0.5, 19, 0.5, 18, 7, 14, 7]); poly(g, '#f2c94c', [13.8, 1, 18.2, 1, 17.4, 6, 14.6, 6]); } // the keystone
      g.fillStyle = 'rgba(10,8,6,0.35)'; g.beginPath(); for (const [u, v] of curve(0)) g.lineTo(u, v); for (const [u, v] of curve(-3, true)) g.lineTo(u, v); g.closePath(); g.fill(); // the vault's shadow
    });
  }
  // A portcullis drawn up into a gate's arch (part i of three): a grid of iron bars a little way below the arch's curve,
  // just behind its face, ending in spikes.
  function portcullis(g, which, i) {
    face(g, which, 0, () => {
      const u0 = i * TILE, hang = 9;                            // how far below the arch it hangs
      for (let u = 2; u < TILE; u += 5) {                       // the upright bars, each down to a spike
        const top = archV(u0 + u) - 1, bottom = archV(u0 + u) + hang;
        rect(g, '#1e1c1c', u - 0.8, top, 2.2, bottom - top);
        rect(g, '#5a5650', u - 0.8, top, 0.8, bottom - top);
        poly(g, '#2a2826', [u - 0.9, bottom, u + 1.4, bottom, u + 0.25, bottom + 3]);
      }
      for (const d of [2, 6]) {                                 // the crossbars, following the curve
        g.strokeStyle = '#2a2826'; g.lineWidth = 1.6; g.beginPath();
        for (let u = 0; u <= TILE; u += 2) g.lineTo(u, archV(u0 + u) + d);
        g.stroke();
      }
    });
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
  // The town wall's face: the limestone blocks of the temple's walls (its own texture, when there is one), in the
  // light on a south face, in shade on an east one; drawn blocks otherwise.
  function ashlar(g, r, shade) {
    const image = customImage('temple_wall_texture');
    if (!image) { stoneBlocks(g, r, shade ? 92 : 128, shade ? '#282624' : '#3a3834'); return; }
    const texture = cached('temple-wall:atlas', ctx => ctx.drawImage(image, 0, 0), 128);
    g.save();
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(texture, Math.floor(r() * 2) * 64, Math.floor(r() * 2) * 64, 64, 64, 0, 0, TILE, TILE);
    rect(g, 'rgba(120,116,106,0.22)', 0, 0, TILE, TILE);                       // a little greyer than the temple
    rect(g, shade ? 'rgba(30,27,22,0.42)' : 'rgba(30,27,22,0.1)', 0, 0, TILE, TILE);
    g.restore();
  }
  function templeStone(g, r, shade) {
    // Retain the temple's original carved frieze and its existing projection.
    carvedStone(g, r, shade);
    const image = customImage('temple_wall_texture');
    if (!image) return;
    const texture = cached('temple-wall:atlas', ctx => ctx.drawImage(image, 0, 0), 128);
    const column = Math.floor(r() * 2), row = Math.floor(r() * 2);
    g.save();
    g.beginPath(); g.rect(0, 11, TILE, TILE - 11); g.clip();
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    // Two small blocks across, with three courses below the ornamental band.
    g.drawImage(texture, column * 64, row * 64, 64, 64, 0, 11, TILE, TILE);
    rect(g, 'rgba(143,139,127,0.26)', 0, 11, TILE, TILE - 11);
    rect(g, shade ? 'rgba(30,27,22,0.30)' : 'rgba(30,27,22,0.12)', 0, 11, TILE, TILE - 11);
    // Recessed seam beneath the frieze.
    rect(g, shade ? '#686154' : '#817867', 0, 11, TILE, 1);
    g.restore();
  }
  // Face textures per wall material. Doors borrow the material of the wall they're in.
  const WALL_STYLES = {
    wall_stone: { south: (g, r) => stoneBlocks(g, r, 118, '#3a3a3e'), east: (g, r) => stoneBlocks(g, r, 84, '#28282c'), top: (g, r) => capStone(g, r, 158) },
    wall_wood: { south: (g, r) => timber(g, r, 0), east: (g, r) => timber(g, r, 30), top: (g, r) => capWood(g, r) },
    wall_temple: { south: (g, r) => templeStone(g, r, 0), east: (g, r) => templeStone(g, r, 34), top: (g, r) => capStone(g, r, 186) },
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
  function onWall(g, shape, paint) {
    face(g, runsNorthSouth(wallSides(shape)) ? 'east' : 'south', 0, paint);
  }
  // ---- Things on walls, in our camera (docs/art-style.md) ------------------------------------------------------------
  // They hang against the wall's face, in the same slant as the wall, and have real depth in it: a window is a recess
  // in the wall with its glass at the back, a torch, a lantern or a sign is an object on an iron bracket standing out
  // from the face. wallSpot(shape)(u, out, h): where a point lands in the 64x64 picture of the wall's tile: u along
  // the wall (west to east; north to south on an east face), out in front of the face (into it when negative), h up.
  const wallSpot = shape => (runsNorthSouth(wallSides(shape))
    ? (u, out, h) => [64 + out - h, 32 + u - h]
    : (u, out, h) => [32 + u - h, 64 + out - h]);
  const IRON = { top: '#5e5a54', south: '#3a3632', east: '#24221f', edge: '#7a756e' };
  const STONE = { top: '#ece4ce', south: '#cfc6b0', east: '#a89e88', edge: '#fff8e4' };
  // A block against the wall from u0 to u1 along it, out0 to out1 in front of it, h0 to h1 high: the faces you see.
  // (On a south wall its front faces south and its end east; on an east wall its front faces east and its end south.)
  function wallBox(g, shape, u0, u1, o0, o1, h0, h1, c) {
    const at = wallSpot(shape), east = runsNorthSouth(wallSides(shape));
    poly(g, east ? c.south : c.east, [...at(u1, o0, h0), ...at(u1, o1, h0), ...at(u1, o1, h1), ...at(u1, o0, h1)]);
    poly(g, east ? c.east : c.south, [...at(u0, o1, h0), ...at(u1, o1, h0), ...at(u1, o1, h1), ...at(u0, o1, h1)]);
    poly(g, c.top, [...at(u0, o0, h1), ...at(u1, o0, h1), ...at(u1, o1, h1), ...at(u0, o1, h1)]);
    if (c.edge) line(g, c.edge, 1, ...at(u0, o1, h1), ...at(u1, o1, h1));
  }
  // A shape lying in a plane parallel to the wall, out in front of it: points [u, h, ...].
  const wallPoly = (g, shape, out, color, pts) => {
    const at = wallSpot(shape), xy = [];
    for (let k = 0; k < pts.length; k += 2) xy.push(...at(pts[k], out, pts[k + 1]));
    poly(g, color, xy);
  };
  // Draw `paint` in a plane parallel to the wall, out in front of it, in coordinates (x along the wall, y down from
  // h = 32): so a picture made for a 32x32 face lands on a board or a canvas there.
  function onWallPlane(g, shape, out, paint) {
    const at = wallSpot(shape), [ox, oy] = at(0, out, 32), [ax, ay] = at(1, out, 32), [bx, by] = at(0, out, 31);
    g.save();
    g.setTransform(ax - ox, ay - oy, bx - ox, by - oy, ox, oy);
    paint();
    g.restore();
  }
  // An iron bracket at (u, h): a plate on the wall and an arm reaching `reach` out (and a little up).
  function bracket(g, shape, u, h, reach) {
    const at = wallSpot(shape);
    wallBox(g, shape, u - 1.5, u + 1.5, 0, 1, h - 2.5, h + 1.5, IRON);
    line(g, IRON.east, 2, ...at(u, 1, h - 0.5), ...at(u, reach, h));
    line(g, IRON.edge, 1, ...at(u, 1, h), ...at(u, reach, h + 0.5));
  }
  function wallTorch(g, shape, frame, lit) {
    const at = wallSpot(shape), [sx, sy] = at(16, 0, 30);
    if (lit) ellipse(g, 'rgba(20,14,8,0.25)', sx, sy, 3, 4.5); // soot on the wall above it
    bracket(g, shape, 16, 17, 4);
    const [bx, by] = at(16, 4, 12), [tx, ty] = at(16, 4, 23);
    line(g, '#3e2410', 2.5, bx, by, tx, ty); line(g, '#7a4c26', 1, bx - 0.8, by, tx - 0.8, ty); // the torch, lit on its west
    wallBox(g, shape, 14.8, 17.2, 2.8, 5.2, 16.5, 17.5, IRON);                                  // its ring
    wallBox(g, shape, 14.8, 17.2, 2.8, 5.2, 22, 25, { top: '#3a2a1c', south: '#24160c', east: '#160e08' }); // the pitch-wound head
    const [fx, fy] = at(16, 4, 25);
    if (lit) flame(g, fx, fy + 1, 2.8, 8, frame); // (fire rises straight up)
    else ellipse(g, '#141010', fx, fy, 1.5, 1);
  }
  // A shop sign: a board on two chains under an iron arm, parallel to the wall and out in front of it, with its
  // trade's picture on its face (drawn for a board at 8..24 x 8..23).
  // A picture in a frame hanging flat on the wall: the frame's thickness, its shadow, the picture on its face
  // (x, y, w, h in the face's 32x32 coordinates, y down from the wall's top).
  function framed(g, shape, x, y, w, h, frameColor, picture) {
    wallPoly(g, shape, 0, 'rgba(15,10,5,0.3)', [x + 1, 31 - y - h, x + w + 1, 31 - y - h, x + w + 1, 31 - y, x + 1, 31 - y]);
    wallBox(g, shape, x, x + w, 0, 1.2, 32 - y - h, 32 - y, { top: shade(frameColor, 1.3), south: shade(frameColor, 0.75), east: shade(frameColor, 0.55) });
    onWallPlane(g, shape, 1.2, () => {
      rect(g, frameColor, x, y, w, h); rect(g, shade(frameColor, 1.35), x, y, w, 1); rect(g, shade(frameColor, 1.15), x, y, 1, h);
      picture();
    });
  }
  function shopSign(g, shape, board, picture) {
    const at = wallSpot(shape), out = 6;
    wallPoly(g, shape, 0, 'rgba(15,10,5,0.25)', [10, 23, 25, 23, 25, 9, 10, 9]); // its shadow on the wall
    bracket(g, shape, 9, 27, out + 0.5); bracket(g, shape, 23, 27, out + 0.5);
    for (const u of [10.5, 21.5]) line(g, IRON.south, 1, ...at(u, out, 27), ...at(u, out, 24));  // the chains
    wallBox(g, shape, 8, 24, out - 1, out, 9, 24, { top: '#6a4a28', south: '#2a1c10', east: '#2a1c10' }); // its thickness
    onWallPlane(g, shape, out, () => {
      rect(g, board, 8, 8, 16, 15);
      rect(g, 'rgba(255,255,255,0.22)', 8, 8, 16, 1); rect(g, 'rgba(255,255,255,0.1)', 8, 8, 1, 15); // lit from the north-west
      rect(g, 'rgba(0,0,0,0.25)', 8, 22, 16, 1); rect(g, 'rgba(0,0,0,0.18)', 23, 8, 1, 15);
      picture();
    });
  }
  // A lever: an iron box on the floor, its handle a rod through space with a red knob, thrown west or east.
  function drawLever(g, on) {
    floorShadow(g, 8, 3);
    const iron = { top: '#7a7a82', south: '#5a5a62', east: '#3e3e46', edge: '#9a9aa2' };
    prism(g, 10, 17, 22, 24, 0, 5, iron);
    prism(g, 14, 19.5, 18, 21.5, 5, 6, { top: '#2a2a30', south: '#1e1e22', east: '#141418' }); // its slot
    const tip = on ? [23, 20.5, 20] : [9, 20.5, 20];
    line3(g, '#3a2a18', 2.5, 16, 20.5, 5.5, ...tip); line3(g, '#8a6a42', 1, 16, 20.5, 5.5, ...tip);
    const [kx, ky] = P(...tip); ellipse(g, '#7a1a1a', kx + 0.5, ky + 0.5, 3, 3); ellipse(g, '#c03030', kx, ky, 2.6, 2.6); ellipse(g, '#ff9a8a', kx - 0.8, ky - 0.8, 0.9, 0.9);
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
    roof_marble: { color: [250, 242, 226], course: 4, joint: 8, gild: [232, 181, 74] }, // white marble slabs, gilded ridges and eaves (the temple)
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
        light = st.gild ? 1 + (SLOPE_LIGHT[f] - 1) * 0.5 : SLOPE_LIGHT[f]; // (pale marble: its slopes in softer shade)
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
        if (st.gild && (ridge || eave < 2)) { // gilded ridges and eaves, lit as the slope they sit on
          const gl = ridge ? 1.12 : eave < 1 ? 0.62 : SLOPE_LIGHT[f] * 0.95, i = (py * TILE + px) * 4;
          for (let ch = 0; ch < 3; ch++) data[i + ch] = Math.min(255, st.gild[ch] * gl + (ridge && (px + py) % 5 === 0 ? 40 : 0));
          data[i + 3] = 255;
          continue;
        }
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
  const RAISED = new Set(['eggs', 'ladder', 'stairs_up', 'stairs_down', 'lever', 'lever_on', 'crystal', 'ice_spike', 'stalagmite', 'sword_grave', 'crops',
    'pillar', 'altar', 'table', 'counter', 'crate', 'chest', 'bed', 'bookshelf', 'depot', 'barrel', 'sack', 'basket', 'plant', 'haystack', 'well', 'chair', 'chair_east',
    'chair_west', 'chair_north', 'bench',
    'stall', 'saint', 'pew', 'lamppost', 'lamppost_off', 'signpost', 'noticeboard', 'planter', 'apple_crate', 'anvil', 'statue', 'gravestone', 'dummy',
    'scarecrow',
    'woodpile', 'fountain', 'fountain_rim', 'wagon', 'fish_rack', 'sewer_ladder', 'cave_ladder', 'bell_rope', 'chimney', 'crypt_gate', 'shaft_rope_top', 'shaft_rope', 'shaft_rope_cut', 'shaft_hole',
    'sarcophagus', 'founder_tomb', 'obelisk', 'torch', 'torch_out', 'throne', 'tent', 'hedge', 'totem', 'flagpole', 'bars',
    'fallen_pillar', 'fence', 'cauldron', 'battlement_n', 'battlement_e', 'battlement_s', 'battlement_w', 'tower_flag', 'cannon_n', 'cannon_e', 'cannon_s', 'cannon_w', 'cannonballs', 'tree', 'pine', 'snow_pine', 'palm', 'jungle_tree', 'dead_tree', 'ancient_tree',
    'bush', 'cactus', 'fern', 'reeds', 'tallgrass', 'grass_tuft', 'flowers', 'mushrooms', 'crops', 'dry_bush', 'stump', 'log', 'beehive', 'igloo', 'windmill', 'boat', 'wreck', 'treasure', 'trunk']);
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
  // Battlements on one edge of a tile (n, e, s, w): a parapet T thick, merlons on it with gaps between, drawn back
  // to front.
  const PARAPET = { top: '#ddd4c2', south: '#bab09c', east: '#8e8574', edge: '#f4ecdc' }; // (the limestone of the wall)
  function battlements(g, side) {
    const T = 6, H0 = 17, H1 = 29, along = side === 'n' || side === 's';
    const [a0, a1] = side === 'n' || side === 'w' ? [0, T] : [TILE - T, TILE];
    const box = (s0, s1, z0, z1) => (along ? prism(g, s0, a0, s1, a1, z0, z1, PARAPET) : prism(g, a0, s0, a1, s1, z0, z1, PARAPET));
    box(0, TILE, 0, H0);
    for (const s0 of [0.5, 8.5, 16.5, 24.5]) box(s0, s0 + 6, H0, H1);
  }
  function wallBanner(g, which) {
    face(g, which, 0, () => {
      const cloth = [9, 2, 23, 2, 23, 27, 16, 23, 9, 27];
      poly(g, 'rgba(20,14,8,0.32)', cloth.map((v, k) => v + (k % 2 ? 1 : 1.4)));            // its shadow on the wall
      poly(g, which === 'east' ? '#1e4682' : '#2a5aa8', cloth);
      for (const u of [12.5, 16, 19.5]) rect(g, 'rgba(0,0,30,0.18)', u, 3, 1, 20);           // folds
      rect(g, '#e8b54a', 9, 2, 1.2, 25); rect(g, '#e8b54a', 21.8, 2, 1.2, 25);                // the gold hem
      const sx = 16, sy = 11;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; line(g, '#f2c94c', 1, sx + Math.cos(a) * 2.6, sy + Math.sin(a) * 2.6, sx + Math.cos(a) * 4.6, sy + Math.sin(a) * 4.6); }
      ellipse(g, '#c8901c', sx, sy, 2.6, 2.6); ellipse(g, '#ffd860', sx - 0.4, sy - 0.4, 1.8, 1.8);
      rect(g, '#3a3632', 7.5, 0.6, 17, 1.8);                                                  // the rod
    });
  }
  // A cannon pointing along (dx, dy): see cannon_n.
  function cannon(g, dx, dy) {
    const along = dx !== 0, oak = { top: '#8a6036', south: '#6a4422', east: '#4a2e14', edge: '#a87a48' };
    floorShadow(g, 12, 4);
    // the carriage: two cheeks along the barrel, and the axles' wheels at either side
    if (along) { prism(g, 7, 10, 25, 13, 2, 9, oak); prism(g, 7, 19, 25, 22, 2, 9, oak); }
    else { prism(g, 10, 7, 13, 25, 2, 9, oak); prism(g, 19, 7, 22, 25, 2, 9, oak); }
    const wheel = (u, v) => { const [x, y] = P(u, v, 4); ellipse(g, '#2a2a2e', x, y, along ? 4.2 : 2.6, 3.6); ellipse(g, '#5a3a1e', x, y, along ? 3 : 1.8, 2.6); ellipse(g, '#9a9aa2', x, y, 0.9, 0.9); };
    for (const k of [10, 22]) for (const side of [8.5, 23.5]) wheel(along ? k : side, along ? side : k);
    // the barrel: from the breech behind the middle out past the front of the carriage, rising a little
    const b0 = [16 - dx * 9, 16 - dy * 9, 11], b1 = [16 + dx * 15, 16 + dy * 15, 14];
    line3(g, '#3a2a14', 7, ...b0, ...b1);
    line3(g, '#8a6422', 5.4, ...b0, ...b1);
    line3(g, '#d0a050', 1.6, b0[0], b0[1], b0[2] + 2, b1[0], b1[1], b1[2] + 2);   // the light along its top
    const [mx, my] = P(...b1); ellipse(g, '#5a4018', mx, my, 3.4, 3.4); ellipse(g, '#141010', mx, my, 1.7, 1.7); // the muzzle
    const [kx, ky] = P(16 - dx * 11, 16 - dy * 11, 11); ellipse(g, '#6a4c1c', kx, ky, 1.9, 1.9);                // the breech knob
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
  // The temple's archway: three tiles of carved stone wall along their south edge, as thin walls stand, with a round
  // arch nearly two tiles wide cut through it, on piers with capitals; a keystone, and the temple's golden sun above it.
  // The wall's own textures are laid on its faces, so it joins the walls either side without a seam.
  BIG.arch = { w: 3, h: 1, noInk: true, draw(g) { // (no dark outline: it's part of the wall, and walls have none)
    const FZ = FLOOR_Z, v0 = W0, v1 = TILE, a0 = 12, a1 = 84, zs = 20, rise = 20, mid = (a0 + a1) / 2, half = (a1 - a0) / 2;
    const arcZ = u => zs + rise * Math.sqrt(Math.max(0, 1 - ((u - mid) / half) ** 2));
    const arc = (v, from, to) => { const pts = []; for (let i = 0; i <= 24; i++) { const u = from + ((to - from) * i) / 24; pts.push(...P(u, v, arcZ(u))); } return pts; };
    const st = WALL_STYLES.wall_temple, rnd = makeRng(4242);
    // Limestone underside blends into the surrounding wall instead of a black band.
    poly(g, '#b8b09c', [...arc(v0, a0, a1), ...arc(v1, a1, a0)]);
    // the inner face of the west pier (it faces east, into the opening)
    poly(g, '#8a8476', [...P(a0, v0, 0), ...P(a0, v1, 0), ...P(a0, v1, zs), ...P(a0, v0, zs)]);
    // the front (south) face, the wall's own carved stone, with the arch cut out of it
    g.save();
    g.beginPath();
    g.moveTo(...P(0, v1, 0)); g.lineTo(...P(a0, v1, 0));
    for (let i = 0; i < arc(v1, a0, a1).length; i += 2) g.lineTo(arc(v1, a0, a1)[i], arc(v1, a0, a1)[i + 1]);
    g.lineTo(...P(a1, v1, 0)); g.lineTo(...P(96, v1, 0)); g.lineTo(...P(96, v1, FZ)); g.lineTo(...P(0, v1, FZ));
    g.closePath(); g.clip();
    g.setTransform(1, 0, 1, 1, 32, 64); // texture (x along the wall, y down from its top) onto the face
    for (let k = 0; k < 3; k++) { g.save(); g.translate(k * TILE, 0); st.south(g, rnd); g.restore(); }
    g.restore();
    // the east end's face, where the arch meets the wall beyond
    g.save();
    g.beginPath(); for (const [v, z] of [[v0, 0], [v1, 0], [v1, FZ], [v0, FZ]]) g.lineTo(...P(96, v, z)); g.closePath(); g.clip();
    g.setTransform(0, 1, 1, 1, 128, 32); st.east(g, rnd);
    g.restore();
    // the wall's cap along the top
    g.save();
    g.beginPath(); for (const [u, v] of [[0, v0], [96, v0], [96, v1], [0, v1]]) g.lineTo(...P(u, v, FZ)); g.closePath(); g.clip();
    g.translate(32, 32); for (let k = 0; k < 3; k++) { g.save(); g.translate(k * TILE, 0); st.top(g, rnd); g.restore(); }
    g.restore();
    // a ring of voussoirs round the arch, a keystone at its top, the capitals it springs from
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, ang = Math.PI * (1 - t), u = mid + Math.cos(ang) * half, z = zs + Math.sin(ang) * rise;
      const uo = mid + Math.cos(ang) * (half + 5), zo = zs + Math.sin(ang) * (rise + 5);
      line(g, 'rgba(90,82,66,0.75)', 1, ...P(u, v1, z), ...P(uo, v1, zo));
    }
    line(g, 'rgba(255,248,228,0.6)', 1, ...arc(v1, a0, a1));
    const cap = { top: '#e8e0cc', south: '#cfc6b0', east: '#a69e8a', edge: '#fff8e4' };
    prism(g, mid - 4, v1 - 0.5, mid + 4, v1 + 1, zs + rise - 1, zs + rise + 6, cap); // the keystone
    for (const [u0, u1] of [[a0 - 6, a0], [a1, a1 + 6]]) { line(g, 'rgba(255,248,228,0.7)', 1, ...P(u0, v1, zs), ...P(u1, v1, zs)); line(g, 'rgba(90,82,66,0.8)', 1, ...P(u0, v1, zs - 1.5), ...P(u1, v1, zs - 1.5)); } // the impost mouldings it springs from
    // the temple's golden sun over the keystone
    const [sx, sy] = P(mid + 22, v1, zs + rise + 4); // (to the keystone's side: the roof's eaves hide the wall's top)
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; line(g, '#d8a830', 1.5, sx + Math.cos(a) * 4, sy + Math.sin(a) * 4, sx + Math.cos(a) * 7.5, sy + Math.sin(a) * 7.5); }
    ellipse(g, '#d8a830', sx, sy, 4.2, 4.2); ellipse(g, '#f8dc70', sx - 0.6, sy - 0.6, 3, 3);
  } };
  // A window of stained glass in face coordinates (x along the face, y up it): an arch w wide, from zb to the
  // top of its arch; inside, a sun low in the middle, its rays, and panes round it, all held in lead.
  const SKY = ['#2f5fb8', '#c8323c', '#3e8ef7', '#6a3ab0', '#2f5fb8'];
  const sunWindow = (f, x, w, zb, zt) => {
    const rr = w / 2, cx = x + rr, cy = zb + (zt - zb) * 0.62, R = w * 0.3;
    const arch = pad => { f.beginPath(); f.moveTo(x - pad, zb - pad); f.lineTo(x - pad, zt); f.arc(cx, zt, rr + pad, Math.PI, 0, true); f.lineTo(x + w + pad, zb - pad); f.closePath(); };
    f.fillStyle = '#b4aa94'; arch(1.6); f.fill();                                  // the stone frame
    f.fillStyle = '#2a2018'; arch(0.5); f.fill();                                  // the lead round it
    f.save(); arch(0); f.clip();
    const N = 10;                                                                    // panes fanning out from the sun
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2;
      f.fillStyle = SKY[k % SKY.length]; f.beginPath(); f.moveTo(cx, cy); f.arc(cx, cy, 40, a0, a1); f.closePath(); f.fill();
    }
    for (let k = 0; k < N; k++) { // its rays: golden wedges between the panes
      const a = (k / N) * Math.PI * 2 + Math.PI / N;
      f.fillStyle = k % 2 ? '#f2c94c' : '#f08a3c'; f.beginPath();
      f.moveTo(cx + Math.cos(a - 0.2) * R, cy + Math.sin(a - 0.2) * R); f.lineTo(cx + Math.cos(a) * R * 2.1, cy + Math.sin(a) * R * 2.1); f.lineTo(cx + Math.cos(a + 0.2) * R, cy + Math.sin(a + 0.2) * R); f.closePath(); f.fill();
    }
    f.fillStyle = '#ffd860'; f.beginPath(); f.arc(cx, cy, R, 0, Math.PI * 2); f.fill();   // the sun
    f.fillStyle = '#fff4c0'; f.beginPath(); f.arc(cx - R * 0.3, cy + R * 0.3, R * 0.45, 0, Math.PI * 2); f.fill();
    f.strokeStyle = '#2a2018'; f.lineWidth = 0.5;                                    // the lead: round the sun, along the panes, two rings
    f.beginPath(); f.arc(cx, cy, R, 0, Math.PI * 2); f.stroke();
    for (let k = 0; k < N; k++) { const a = (k / N) * Math.PI * 2; f.beginPath(); f.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); f.lineTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40); f.stroke(); }
    for (const q of [2.4]) { f.beginPath(); f.arc(cx, cy, R * q, 0, Math.PI * 2); f.stroke(); }
    f.fillStyle = 'rgba(255,250,225,0.28)'; f.fillRect(x + 0.8, zb, 1.2, zt - zb + rr * 0.6); // light on the glass
    f.restore();
    rect(f, '#fffcf4', x - 2, zb - 2.2, w + 4, 1.4); rect(f, '#a89e88', x - 2, zb - 2.8, w + 4, 0.6); // the sill
    rect(f, '#e8b54a', cx - 1, zt + rr + 0.6, 2, 2.2);                                  // a gilded keystone
  };
  // The temple's lantern on the middle of its roof, two tiles square: a marble turret with tall arched windows of
  // stained glass, each a sunrise in lead (a golden sun with its rays, ringed by panes of blue, red and violet),
  // lit from inside (it glows at night, see defs.js), a cornice, and a marble roof gilded like the temple's own,
  // with the golden sun of the dawn on a rod above it.
  // The statue of the founder, three tiles square, west of the temple: a stepped marble plinth with a gilded band and a
  // plaque, and on it the founder in a long cloak, the left hand on a sword's hilt, the right holding a golden sun high.
  BIG.founder = { w: 3, h: 3, rise: 160, upright: true, draw(g) {
    const m1 = { top: '#fbf7ee', south: '#e6dfcf', east: '#bdb4a2', edge: '#ffffff' }, m2 = { top: '#efe8d8', south: '#d6cdb8', east: '#aaa18e', edge: '#fffcf4' };
    const gold = { top: '#f2c94c', south: '#d8a030', east: '#9a7420', edge: '#fff0b0' };
    shadow(g, 64 + 52, 64 + 60, 40, 15);
    prism(g, 8, 8, 88, 88, 0, 4, m2);                 // two low steps
    prism(g, 16, 16, 80, 80, 4, 8, m1);
    prism(g, 26, 26, 70, 70, 8, 20, m2);               // the plinth, as wide as the figure stands
    prism(g, 25, 25, 71, 71, 20, 22, gold);            // a gilded band
    prism(g, 27, 27, 69, 69, 22, 24, m1);              // its cap
    onSouth(g, 70, f => { rect(f, '#b8a684', 36, 10, 24, 7); rect(f, '#d8a030', 37, 11, 22, 5); rect(f, '#f2c94c', 38, 12, 20, 3); }); // the plaque
    // the founder, upright as people stand, in marble, three times a person's height, a cloak on her shoulders, holding
    // a staff crowned with a sun
    const [px, py] = P(48, 50, 24), k = 3;
    g.imageSmoothingEnabled = false; // (whole pixels, three times as big)
    g.drawImage(stoneFigure('founder', MARBLE_FOUNDER), Math.round(px - 20 * k), Math.round(py - 40.5 * k), 40 * k, 48 * k);
    sunDisc(g, px + (29.7 - 20) * k, py + (6.5 - 40.5) * k - 3, 13);     // the sun on the staff's top
  } };
  // A figure as people are drawn (tiltPerson), standing upright, in the colours of stone: for statues. Feet at (20, 40.5)
  // on a 40 x 48 picture.
  const MARBLE_SAINT = { skin: '#ece4d2', hair: '#e2d9c4', body: '#f2ecdf', robe: true, trim: '#e0b840', belt: '#e0b840', eye: '#a89e8a',
    hat: { style: 'hood', color: '#f6f1e6' } };
  const MARBLE_FOUNDER = { skin: '#ece4d2', hair: '#ddd4c0', hairStyle: 'long', female: true, body: '#f2ecdf', robe: true, trim: '#e0b840', belt: '#e0b840',
    cape: '#d9d0bc', eye: '#a89e8a', held: 'staff', heldColor: '#d8a030' };
  const BRONZE_HERO = { skin: '#6a9a86', hair: '#3e6656', body: '#6a9a86', legs: '#5e8c7a', feet: '#3e6656', belt: '#d8c070', cape: '#4e7e6c',
    eye: '#22382f', held: 'sword', heldColor: '#b4dccb', armor: '#7aa898' };
  function stoneFigure(key, look) {
    return cached(`stonefig:${key}`, g => {
      const tilt = Sprites.TILT;
      Sprites.TILT = 0;
      try { g.translate(4, 12); tiltPerson(g, look, 2, 0); } finally { Sprites.TILT = tilt; }
    }, 40, 48);
  }
  // A gilded sun: rays round a disc, at (x, y), r across.
  function sunDisc(g, x, y, r) {
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r1 = i % 2 ? r : r * 1.25; line(g, '#d8a030', Math.max(1, r / 6), x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, x + Math.cos(a) * r1, y + Math.sin(a) * r1); }
    ellipse(g, '#b8861c', x, y, r * 0.66, r * 0.66); ellipse(g, '#f2c94c', x - 0.4, y - 0.4, r * 0.55, r * 0.55); ellipse(g, '#fff0b0', x - r * 0.2, y - r * 0.2, r * 0.2, r * 0.2);
  }
  BIG.temple_lantern = { w: 2, h: 2, draw(g) {
    const marble = { top: '#fbf6ea', south: '#ece2cc', east: '#c8bea8', edge: '#fffcf4' };
    const marble2 = { top: '#f2ead8', south: '#ddd2ba', east: '#b4aa94', edge: '#fffaf0' };
    const gold = { top: '#f2c94c', south: '#d8a030', east: '#9a7420', edge: '#fff0b0' };
    const u0 = 12, u1 = 52, H = 50;
    prism(g, 8, 8, 56, 56, 0, 2.5, marble2);                                           // the base
    prism(g, 7.5, 7.5, 56.5, 56.5, 2.5, 4, gold);                                      // a gilded band
    prism(g, u0, u0, u1, u1, 4, H, marble);                                            // the turret
    onSouth(g, u1, f => sunWindow(f, 20, 24, 8, 32));                                    // one big window on the south face
    // and one on the east face, drawn in its own plane
    g.save(); g.setTransform(0, 1, -LEAN * HEIGHT, -HEIGHT, 64 + u1, 64); sunWindow(g, 20, 24, 8, 32); g.restore();
    for (const [a, b] of [[u0 - 1, u1 - 3], [u1 - 3, u1 - 3], [u1 - 3, u0 - 1]]) prism(g, a, b, a + 4, b + 4, 4, H, marble2); // corner pilasters
    onSouth(g, u1 + 1, f => { for (let u = u0; u < u1; u += 2.5) rect(f, '#b4aa94', u, H + 0.4, 1.2, 1.2); }); // dentils
    prism(g, u0 - 2, u0 - 2, u1 + 2, u1 + 2, H, H + 2, marble2);                        // the cornice
    prism(g, u0 - 2.5, u0 - 2.5, u1 + 2.5, u1 + 2.5, H + 2, H + 3.5, gold);             // a gilded band
    // a marble roof like the temple's: slabs in courses, each face in its own light, gilded hips
    const z0 = H + 3.5, rh = 14, a0 = u0 - 2, a1 = u1 + 2, A = [32, 32, z0 + rh], apex = P(...A);
    const faces = [[[a0, a0], [a1, a0], '#fbf6ea'], [[a0, a0], [a0, a1], '#efe6d2'], [[a1, a0], [a1, a1], '#d6ccb6'], [[a0, a1], [a1, a1], '#e8dfca']];
    for (const [[ua, va], [ub, vb], c] of faces) {
      poly(g, c, [...P(ua, va, z0), ...P(ub, vb, z0), ...apex]);
      for (const k of [0.25, 0.5, 0.75]) { const p = (u, v) => [u + (A[0] - u) * k, v + (A[1] - v) * k, z0 + rh * k]; line(g, 'rgba(150,135,110,0.5)', 0.6, ...P(...p(ua, va)), ...P(...p(ub, vb))); }
    }
    for (const [u, v] of [[a0, a0], [a0, a1], [a1, a1], [a1, a0]]) line3(g, '#e8b54a', 1.8, u, v, z0, ...A);  // gilded hips
    for (const [[ua, va], [ub, vb]] of faces) line3(g, '#e8b54a', 1.4, ua, va, z0, ub, vb, z0);               // and eaves
    // the sun of the dawn on a gilded rod
    const top = z0 + rh;
    const [ox, oy] = P(32, 32, top + 1.5); ellipse(g, '#a8741a', ox, oy, 3, 3); ellipse(g, '#f2c94c', ox, oy, 2.4, 2.4);
    line3(g, '#c8901e', 2.2, 32, 32, top + 3, 32, 32, top + 9);
    const [sx, sy] = P(32, 32, top + 16);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, l = i % 2 ? 11 : 15; poly(g, i % 2 ? '#e8b54a' : '#f2c94c', [sx + Math.cos(a - 0.13) * 6.2, sy + Math.sin(a - 0.13) * 6.2, sx + Math.cos(a) * l, sy + Math.sin(a) * l, sx + Math.cos(a + 0.13) * 6.2, sy + Math.sin(a + 0.13) * 6.2]); }
    ellipse(g, '#a8741a', sx, sy, 7.2, 7.2); ellipse(g, '#ffd860', sx, sy, 6.2, 6.2); ellipse(g, '#fff4c0', sx - 1.5, sy - 1.5, 2.8, 2.8);
  } };
  const PARTS = {
    founder_00: ['founder', 0, 0], founder_10: ['founder', 1, 0], founder_20: ['founder', 2, 0], founder_01: ['founder', 0, 1], founder_11: ['founder', 1, 1], founder_21: ['founder', 2, 1], founder_02: ['founder', 0, 2], founder_12: ['founder', 1, 2], founder_22: ['founder', 2, 2],
    temple_lantern_nw: ['temple_lantern', 0, 0], temple_lantern_ne: ['temple_lantern', 1, 0], temple_lantern_sw: ['temple_lantern', 0, 1], temple_lantern_se: ['temple_lantern', 1, 1],
    arch_w: ['arch', 0, 0], arch_m: ['arch', 1, 0], arch_e: ['arch', 2, 0],
    bell_nw: ['bell', 0, 0], bell_ne: ['bell', 1, 0], bell_sw: ['bell', 0, 1], bell_se: ['bell', 1, 1],
    bed_head: ['bed', 0, 0], bed_foot: ['bed', 0, 1],
    fountain_nw: ['fountain', 0, 0], fountain_ne: ['fountain', 1, 0], fountain_sw: ['fountain', 0, 1], fountain_se: ['fountain', 1, 1],
  };
  // (upright: it stands straight up, as statues' figures do, not leaning: see the clip below; rise: how far above its tiles a
  // big thing reaches, 64 unless it says more; its own PNG, sprites/custom.js, if it has one:
  // the whole thing on one picture, w * 32 + rise wide and h * 32 + rise high, its north-west tile's corner at rise, rise)
  function bigPart(id, frame) {
    const [name, col, row] = PARTS[id], b = BIG[name], R = b.rise || 64, own = customImage(name);
    const at = (f, fn) => { f.save(); f.translate(R - 64, R - 64); fn(f); f.restore(); }; // (its drawing has the corner at 64, 64, as P() has)
    const whole = own || cached(`bigthing:${name}:${frame}`, g => (b.noInk ? at(g, f => b.draw(f, frame)) : inked(g, f => at(f, h => b.draw(h, frame)))), b.w * TILE + R, b.h * TILE + R);
    const k = own ? own.naturalWidth / (b.w * TILE + R) : 1; // (its own PNG may be finer than a pixel a world pixel: k times)
    return cached(`part:${id}:${frame}:${own ? 'own' : ''}`, g => {
      g.canvas.res = k;
      g.scale(k, k);
      g.imageSmoothingEnabled = true;
      g.beginPath();
      if (!b.upright) for (const [x, y] of [[0, 0], [32, 0], [R + 32, R], [R + 32, R + 32], [R, R + 32], [0, 32]]) g.lineTo(x, y); // this tile, and the strip rising up-left from it
      else if (row === b.h - 1) g.rect(col ? R : 0, 0, col ? 32 : R + 32, R + 32); // (upright: the south row's tiles draw everything straight above them,
      else g.rect(R, R, 32, 32);                                                     // the westmost also what leans out west; the others their own tile)
      g.clip();
      g.drawImage(whole, -col * TILE, -row * TILE, whole.width / k, whole.height / k);
    }, Math.round((R + TILE) * k));
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

  // --- growing things, in the tiles' slant: a trunk is a round column, a crown a ball of leaves round a point high
  // over the tile, blades and stalks lines through space. Their parts are drawn from the back to the front.
  // A line through space: points [u, v, z, ...] joined, w wide.
  function line3(g, colour, w, ...pts) {
    const flat = [];
    for (let i = 0; i < pts.length; i += 3) flat.push(...P(pts[i], pts[i + 1], pts[i + 2]));
    line(g, colour, w, ...flat);
  }
  // A crown of leaves: n clusters in a ball round (cu, cv, cz), ru across and rz high, lit from the top left:
  // shade (the dark under each cluster), leaf colours from the shaded side to the lit side, and highlights.
  function leafCrown(g, r, cu, cv, cz, ru, rz, n, c) {
    const leaves = [];
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()), h = r() * 2 - 1, k = Math.sqrt(Math.max(0, 1 - h * h));
      leaves.push([cu + Math.cos(a) * d * ru * k, cv + Math.sin(a) * d * ru * k, cz + h * rz]);
    }
    leaves.sort((p, q) => (p[0] + p[1] + p[2] * 1.2) - (q[0] + q[1] + q[2] * 1.2)); // back to front
    const size = c.size || 5;
    for (const [u, v, z] of leaves) { const [x, y] = P(u, v, z); ellipse(g, c.shade, x + 0.6, y + 1, size + 1, size); }
    for (const [u, v, z] of leaves) {
      const [x, y] = P(u, v, z), lit = (z - cz) / rz - ((u - cu) + (v - cv)) / (2 * ru); // high and to the west/north: lit
      ellipse(g, lit > 0.25 ? c.light : lit > -0.35 ? c.mid : c.dark, x, y, size, size - 1);
      if (lit > 0.5) ellipse(g, c.glint, x - 1.5, y - 1.5, size / 2, size / 2 - 0.5);
    }
  }
  // A fir's crown: tiers of branches, each a skirt (a cone) narrower than the one under it, needles along their
  // rims, from (cu, cv) between heights z0 and z1. c: { dark, mid, light, edge, needle, snow? }.
  function firCrown(g, r, cu, cv, z0, z1, w, c) {
    const tiers = 4, h = (z1 - z0) / tiers;
    for (let i = 0; i < tiers; i++) {
      const zb = z0 + i * h * 0.92, zt = zb + h * 1.25, wb = w * (1 - i / (tiers + 0.6));
      drum(g, cu, cv, zb, zt, t => wb * (1 - t) + 0.6, c);
      // needles along the rim of the skirt, on the sides you see (south and east), and snow on its top
      for (let k = 0; k < 9; k++) {
        const a = -Math.PI / 4 + (k / 8) * Math.PI, [x, y] = P(cu + Math.cos(a) * wb, cv + Math.sin(a) * wb, zb + 1);
        poly(g, c.needle, [x - 2, y, x, y + 3 + r() * 2, x + 2, y]);
      }
      if (c.snow) { const [x, y] = P(cu, cv, zt - 1); ellipse(g, c.snow, x - wb * 0.25, y + wb * 0.15, wb * 0.55, wb * 0.4); }
    }
  }
  const BARK = { light: '#7a5030', mid: '#5b3a1e', dark: '#3a2410', top: '#c8a070' };
  const LEAVES = { shade: '#163e16', dark: '#2a6a22', mid: '#358230', light: '#4a9a3a', glint: '#80c860' };
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
    carpet_rug(g) { DRAW.carpet(g); },
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
    temple_paving(g, r) { DRAW.paving(g, r); },
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
    roof_marble: (g, r, frame, shape) => roofTile(g, r, shape, ROOF_STYLES.roof_marble),
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
    // The town wall: big dressed blocks of grey stone, three courses a floor; its walkway is the floor above.
    rampart(g, r) {
      wallBlock(g, 'block', {
        south: () => { ashlar(g, r, false); rect(g, 'rgba(255,250,235,0.3)', 0, 0, TILE, 1); },
        east: () => ashlar(g, r, true),
        top: () => capStone(g, r, 150),
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
    // Stairs up into the town wall: an arched doorway in its face, steps rising into the dark inside it.
    wall_stairs(g, r) {
      wallBlock(g, 'block', {
        south: () => {
          ashlar(g, r, false);
          const arch = (pad, color) => { g.fillStyle = color; g.beginPath(); g.moveTo(9 - pad, 32); g.lineTo(9 - pad, 15); g.arc(16, 15, 7 + pad, Math.PI, 0); g.lineTo(23 + pad, 32); g.closePath(); g.fill(); };
          arch(1.6, '#e8dcc4');                                                    // the dressed stone round it
          arch(0, '#16120e');                                                      // the dark inside
          for (let k = 0; k < 5; k++) rect(g, k % 2 ? '#4a443c' : '#625a4e', 9.5 + k * 0.6, 29 - k * 3.4, 13 - k * 1.2, 1.6); // the steps going up
          rect(g, '#f0c060', 15, 6.4, 2, 2.2);                                     // a keystone
        },
        east: () => ashlar(g, r, true),
        top: () => capStone(g, r, 150),
      });
    },
    // The top of an archway under a wall's walkway: a lintel of wedge-shaped stones across the opening, on the face
    // you see, with the shadow of the vault under it.
    arch_span_s: (g, r) => spanLintel(g, r, 'south'),
    arch_span_e: (g, r) => spanLintel(g, r, 'east'),
    // The shade under a vault: darker in the middle of the passage, as deep under the wall as it goes.
    vault_shadow(g) { rect(g, 'rgba(12,9,6,0.5)', 0, 0, TILE, TILE); },
    portcullis_s0: g => portcullis(g, 'south', 0), portcullis_s1: g => portcullis(g, 'south', 1), portcullis_s2: g => portcullis(g, 'south', 2),
    portcullis_e0: g => portcullis(g, 'east', 0), portcullis_e1: g => portcullis(g, 'east', 1), portcullis_e2: g => portcullis(g, 'east', 2),
    arch_gate_s0: (g, r) => gateArch(g, r, 'south', 0), arch_gate_s1: (g, r) => gateArch(g, r, 'south', 1), arch_gate_s2: (g, r) => gateArch(g, r, 'south', 2),
    arch_gate_e0: (g, r) => gateArch(g, r, 'east', 0), arch_gate_e1: (g, r) => gateArch(g, r, 'east', 1), arch_gate_e2: (g, r) => gateArch(g, r, 'east', 2),
    // Battlements along the outer edge of a walkway: a parapet of dressed stone with merlons on it.
    battlement_n: g => battlements(g, 'n'),
    battlement_e: g => battlements(g, 'e'),
    battlement_s: g => battlements(g, 's'),
    battlement_w: g => battlements(g, 'w'),
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

    // A broad-leaved tree: a round trunk forking into two boughs, under a ball of leaves.
    tree(g, r) {
      floorShadow(g, 15, 5);
      column(g, 16, 16, 3, 0, 32, BARK);
      line3(g, BARK.mid, 2, 16, 16, 22, 12, 13, 32);
      line3(g, BARK.mid, 2, 16, 16, 24, 20, 17, 33);
      leafCrown(g, r, 16, 16, 42, 13, 11, 34, LEAVES);
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
    // A fir: a short trunk under tiers of branches, each a skirt narrower than the one below it.
    pine(g, r) {
      floorShadow(g, 14, 5);
      column(g, 16, 16, 2.5, 0, 12, { ...BARK, top: BARK.dark });
      firCrown(g, r, 16, 16, 8, 60, 14 + r() * 2, { edge: '#123816', dark: '#1a4a1c', mid: '#246a24', light: '#3a8a32', needle: '#173f18' });
    },
    // A palm: a ringed trunk curving up through the air, fronds drooping all round its top, coconuts under them.
    palm(g, r) {
      floorShadow(g, 12, 4);
      const lean = r() < 0.5 ? 1 : -1, at = t => [16 + lean * 6 * t * t, 16 - 2 * t * t, 56 * t];
      for (let i = 0; i < 14; i++) { const [u0, v0, z0] = at(i / 14), [u1, v1, z1] = at((i + 1) / 14); line3(g, i % 2 ? '#8a6a3a' : '#7a5a30', 4, u0, v0, z0, u1, v1, z1); }
      const [tu, tv, tz] = at(1);
      const fronds = [[-1, 0], [1, 0.2], [-0.6, -0.8], [0.6, -0.9], [0.1, -1], [-0.8, 0.6], [0.7, 0.8], [0, 1]]
        .sort((a, b) => (a[0] + a[1]) - (b[0] + b[1])); // the ones at the back first
      for (const [du, dv] of fronds) {
        const pt = k => [tu + du * 15 * k, tv + dv * 15 * k, tz + 6 * k - 16 * k * k];
        const pts = [0, 0.35, 0.7, 1].map(pt);
        for (let i = 0; i < 3; i++) {
          const [a, b] = [P(...pts[i]), P(...pts[i + 1])], wdt = 3 - i * 0.8;
          poly(g, '#3a8a2a', [a[0], a[1] - wdt, b[0], b[1] - wdt * 0.6, b[0], b[1] + wdt * 0.6, a[0], a[1] + wdt]);
        }
        line3(g, '#2a6a1e', 1, ...pts.flat());
      }
      for (const [du, dv] of [[-1.5, 1], [1.5, 1.5]]) { const [x, y] = P(tu + du, tv + dv, tz - 3); ellipse(g, '#6a4a2a', x, y, 2.5, 2); }
    },
    // A cactus: a ribbed round stem with an arm bending up either side, spines catching the light.
    cactus(g) {
      floorShadow(g, 8, 3);
      const green = { light: '#5aa05a', mid: '#3a7a3a', dark: '#245a24', top: '#6ab86a' };
      column(g, 9, 16, 2, 10, 22, green);      // the west arm, behind
      line3(g, green.mid, 4, 16, 16, 12, 9, 16, 12);
      column(g, 16, 16, 3.5, 0, 34, green);   // the stem
      line3(g, green.mid, 4, 16, 16, 16, 23, 16, 16);
      column(g, 23, 16, 2, 16, 28, green);    // the east arm, in front
      for (const [u, z] of [[14, 8], [17, 14], [14, 22], [17, 30], [9, 18], [23, 24]]) { const [x, y] = P(u, 19, z); rect(g, '#e8e0a0', x, y, 1, 1); }
    },
    // A snowy fir: as a fir, with snow lying on each tier.
    snow_pine(g, r) {
      floorShadow(g, 13, 5);
      column(g, 16, 16, 2.5, 0, 12, { ...BARK, top: BARK.dark });
      firCrown(g, r, 16, 16, 8, 58, 13, { edge: '#14302a', dark: '#1a3e32', mid: '#24584a', light: '#3a7a64', needle: '#16342c', snow: '#f0f4f8' });
    },
    // A jungle tree: a thick trunk on spreading roots, a wide flat crown, vines hanging from it.
    jungle_tree(g, r) {
      floorShadow(g, 17, 6);
      for (const [du, dv] of [[-7, 3], [7, 2], [-3, 8], [5, -5]]) line3(g, '#3a2a18', 2.5, 16, 16, 8, 16 + du, 16 + dv, 0);
      column(g, 16, 16, 4, 0, 34, { light: '#6a5232', mid: '#4a3a22', dark: '#2e2414', top: '#a88a5a' });
      leafCrown(g, r, 16, 16, 42, 17, 8, 46, { shade: '#122e10', dark: '#1e4a1a', mid: '#2a5e22', light: '#3a7a2e', glint: '#5a9a48' });
      for (const [u, v] of [[6, 22], [26, 14], [14, 27]]) line3(g, '#2a5a1e', 1, u, v, 38, u, v, 18);
    },
    // A dead tree: a bare trunk and crooked branches reaching out through the air.
    dead_tree(g) {
      floorShadow(g, 10, 4);
      const c = '#3a3028';
      column(g, 16, 16, 2.5, 0, 46, { light: '#5a4a3a', mid: '#3a3028', dark: '#241c16', top: '#6a5a48' });
      line3(g, c, 3, 16, 16, 26, 9, 12, 38, 6, 8, 50);
      line3(g, c, 3, 16, 16, 32, 25, 19, 44);
      line3(g, c, 2, 16, 16, 40, 18, 12, 58);
      line3(g, c, 2, 9, 12, 38, 4, 18, 42);
      line3(g, c, 2, 25, 19, 44, 29, 14, 52);
    },
    // A fern: fronds arching up and out from its middle, leaflets along each.
    fern(g, r) {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.3, end = [16 + Math.cos(a) * 12, 17 + Math.sin(a) * 10, 3];
        const mid = [16 + Math.cos(a) * 6, 17 + Math.sin(a) * 5, 9];
        line3(g, '#2f7a2a', 2, 16, 17, 0, ...mid, ...end);
        for (const k of [0.35, 0.6, 0.85]) { const [x, y] = P(16 + Math.cos(a) * 12 * k, 17 + Math.sin(a) * 10 * k, 9 * Math.sin(k * Math.PI) + 3 * k); rect(g, '#4a9a3a', x - 2, y, 4, 1); }
      }
    },
    // A bush: a low ball of leaves on the ground, with red berries on its sunny side.
    bush(g, r) {
      floorShadow(g, 12, 4);
      leafCrown(g, r, 16, 17, 8, 11, 7, 22, { shade: '#1e4a18', dark: '#2e6a24', mid: '#3f8a30', light: '#4f9a3a', glint: '#5aa842', size: 4.5 });
      for (let i = 0; i < 4; i++) { const [x, y] = P(10 + r() * 12, 22 + r() * 4, 6 + r() * 6); rect(g, '#c8303a', x, y, 2, 2); rect(g, '#f08080', x, y, 1, 1); }
    },
    // A boulder: two or three big grey rocks heaped together, in the style of the mountains.
    rock(g, r) {
      shadow(g, 17, 27, 12, 4);
      const n = 2 + ((r() * 2) | 0);
      for (let i = 0; i < n; i++) boulder(g, 10 + i * 6 + r() * 3, 22 - (i % 2) * 5 - r() * 2, 6 + r() * 2.5, 5 + r() * 2, ROCK.top, i);
    },
    // Wild flowers: short stems with their blossoms held up.
    flowers(g, r) {
      const colors = ['#e84a5f', '#f5d547', '#ffffff', '#b06ee0'];
      for (let i = 0; i < 7; i++) {
        const u = 3 + r() * 25, v = 4 + r() * 25, h = 4 + r() * 4;
        line3(g, '#2f6a29', 1, u, v, 0, u, v, h);
        const [x, y] = P(u, v, h);
        rect(g, colors[(r() * colors.length) | 0], x - 1, y - 1, 3, 3);
        rect(g, '#f5d547', x, y, 1, 1);
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
    // A tuft of grass: a few blades standing up together.
    grass_tuft(g, r) {
      const u0 = 10 + r() * 10, v0 = 12 + r() * 10, [sx, sy] = P(u0, v0, 0);
      ellipse(g, 'rgba(0,0,0,0.15)', sx + 3, sy + 1, 5, 1.5);
      for (let i = 0; i < 9; i++) {
        const u = u0 + (r() - 0.4) * 7, v = v0 + (r() - 0.5) * 3;
        line3(g, ['#3f7d33', '#57a046', '#2f6a26', '#6ab452'][i % 4], 1, u, v, 0, u + (r() - 0.5) * 5, v + (r() - 0.5) * 3, 6 + r() * 9);
      }
    },
    driftwood(g, r) {
      ellipse(g, 'rgba(0,0,0,0.2)', 16, 21, 11, 2);
      line(g, '#8a7458', 3, 6, 19, 26, 17 + r() * 3);
      line(g, '#a8947a', 1, 7, 18, 25, 16 + r() * 3);
      line(g, '#8a7458', 2, 19, 18, 23, 13);
    },
    // Reeds: tall stalks standing up from the water's edge, some with a brown seed head.
    reeds(g, r) {
      for (let i = 0; i < 8; i++) {
        const u = 4 + r() * 24, v = 6 + r() * 22, h = 16 + r() * 14;
        line3(g, '#5a7a3a', 1, u, v, 0, u + (r() - 0.5) * 3, v, h);
        if (i % 2) { const [x, y] = P(u, v, h - 2); rect(g, '#6a4422', x - 1, y - 2, 2, 5); }
      }
    },
    // Mushrooms: pale stalks under round caps, red or brown, flecked with white.
    mushrooms(g, r) {
      const caps = [];
      for (let i = 0; i < 3; i++) caps.push([6 + r() * 18, 10 + r() * 14, i]);
      caps.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
      for (const [u, v, i] of caps) {
        column(g, u, v, 1.3, 0, 7, { light: '#fffaf0', mid: '#efe6d0', dark: '#c8bca0', top: '#efe6d0' });
        drum(g, u, v, 7, 10, t => 4.5 - t * 2.5, i % 2 ? { edge: '#801818', light: '#e05050', mid: '#c03030', dark: '#801818' } : { edge: '#6a4420', light: '#c08a50', mid: '#a0703a', dark: '#6a4420' });
        const [x, y] = P(u, v, 10); rect(g, '#fff', x - 2, y, 1, 1); rect(g, '#fff', x + 1, y - 1, 1, 1);
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
    // Crops: rows of stalks standing up, heavy with grain.
    crops(g, r) {
      for (let v = 4; v < TILE; v += 7) for (let u = 3; u < TILE; u += 6) {
        const h = 16 + r() * 4;
        line3(g, '#8a7a3a', 1, u, v, 0, u + 0.5, v, h);
        for (let z = h - 9; z <= h; z += 3) { const [x, y] = P(u, v, z); ellipse(g, '#d8b040', x + 1.5, y, 2, 1.5); ellipse(g, '#c8a030', x - 0.5, y + 1.5, 2, 1.5); }
      }
    },
    // A statue on a plinth: a bronze figure gone green, in a long coat, holding a sword straight up. Built in the
    // tiles' slant, as a pillar is: every part a block or a round body standing on the plinth.
    statue(g) {
      floorShadow(g, 13, 3);
      const stone = { top: '#c4c4c0', south: '#9a9a96', east: '#76767a', edge: '#e4e4e0' };
      prism(g, 4, 4, 28, 28, 0, 8, stone);
      prism(g, 6, 6, 26, 26, 8, 12, stone);
      onSouth(g, 28, f => rect(f, '#86867f', 9, 2, 14, 4)); // a plaque
      const [px, py] = P(16, 17, 12); // a bronze hero gone green, upright as people stand, a sword in hand
      g.drawImage(stoneFigure('hero', BRONZE_HERO), Math.round(px - 20), Math.round(py - 40.5));
    },
    // A saint of the temple: a figure in white marble robes and a hood, a gilded sun behind its head, on a stepped plinth
    // with a gilded band.
    saint(g) {
      floorShadow(g, 13, 3);
      const m1 = { top: '#fbf7ee', south: '#e6dfcf', east: '#bdb4a2', edge: '#ffffff' }, m2 = { top: '#efe8d8', south: '#d6cdb8', east: '#aaa18e', edge: '#fffcf4' };
      const gold = { top: '#f2c94c', south: '#d8a030', east: '#9a7420', edge: '#fff0b0' };
      prism(g, 3, 3, 29, 29, 0, 4, m2);              // the plinth: a wide step,
      prism(g, 5, 5, 27, 27, 4, 12, m1);             // its block,
      prism(g, 4.5, 4.5, 27.5, 27.5, 12, 13.5, gold); // a gilded band
      prism(g, 6, 6, 26, 26, 13.5, 16, m2);          // and its top
      onSouth(g, 27, f => { rect(f, '#c9bfa8', 10, 6, 12, 4); rect(f, '#f2c94c', 15, 7, 2, 2); }); // a panel with a little sun
      const [px, py] = P(16, 17, 16);              // the figure stands upright on it, as people do
      g.drawImage(stoneFigure('saint', MARBLE_SAINT), Math.round(px - 20), Math.round(py - 40.5));
    },
    // A temple pew: dark polished wood, its ends carved and capped, a seat and a high back (it faces the altar, north:
    // you see its back), a gilded rail along the top.
    pew(g) {
      floorShadow(g, 15, 3);
      const wood = { top: '#7a4a2a', south: '#5e3418', east: '#42240e', edge: '#9a6440' }, dark = { top: '#5e3418', south: '#4a2810', east: '#341a08', edge: '#7a4a2a' };
      prism(g, 2, 9, 30, 19, 9, 11.5, wood);                           // the seat
      for (const u of [1, 28]) {                                       // the ends, carved: a panel, a scroll at the top
        prism(g, u, 8, u + 3, 23, 0, 20, dark);
        onSouth(g, 23, f => { rect(f, '#2a1406', u + 0.8, 3, 1.4, 12); });
        const [cx, cy] = P(u + 1.5, 15.5, 21.5); ellipse(g, '#4a2810', cx, cy, 2.2, 2.2); ellipse(g, '#7a4a2a', cx - 0.5, cy - 0.5, 1.2, 1.2);
      }
      prism(g, 2, 19, 30, 22, 0, 22, wood);                           // the back, which faces you
      onSouth(g, 22, f => { for (const u0 of [4, 12.5, 21]) { rect(f, '#4a2810', u0, 4, 7, 14); rect(f, '#6a3c1e', u0 + 1, 5, 5, 12); } }); // its panels
      prism(g, 1.5, 18.5, 30.5, 22.5, 22, 23.5, { top: '#f2c94c', south: '#d8a030', east: '#9a7420', edge: '#fff0b0' }); // the gilded rail
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
    // Tall grass: blades standing up through the air, leaning this way and that.
    tallgrass(g, r) {
      for (let i = 0; i < 9; i++) {
        const u = 6 + r() * 20, v = 8 + r() * 18, h = 8 + r() * 12;
        line3(g, r() < 0.5 ? '#3a7a2e' : '#5aa046', 1, u, v, 0, u + (r() - 0.5) * 6, v + (r() - 0.5) * 4, h);
      }
      if (r() < 0.4) { const [x, y] = P(10 + r() * 12, 12 + r() * 10, 16); ellipse(g, '#e8d870', x, y, 1.5, 1.5); }
    },
    // A tree stump: a short round trunk, its cut top showing the rings, roots running into the ground.
    stump(g) {
      floorShadow(g, 10, 4);
      for (const [du, dv] of [[-8, 3], [8, 2], [-2, 8]]) line3(g, '#5b3a1e', 2, 16, 16, 4, 16 + du, 16 + dv, 0);
      column(g, 16, 16, 6, 0, 10, { light: '#7a5030', mid: '#5b3a1e', dark: '#3a2410', top: '#c8a070' });
      const [x, y] = P(16, 16, 10);
      ellipse(g, '#a87a48', x, y, 4, 4); ellipse(g, '#8a5a30', x, y, 1.8, 1.8);
    },
    // A fallen log, lying east to west: its bark, and its cut east end showing the rings.
    log(g, r) {
      floorShadow(g, 15, 4);
      prism(g, 2, 13, 27, 22, 0, 9, { top: '#6f4826', south: '#5b3a1e', east: '#4a2e16', edge: '#8a5a30' });
      for (let i = 0; i < 6; i++) { const [x, y] = P(4 + r() * 22, 22, 2 + r() * 6); rect(g, '#4a2e16', x, y, 3, 1); }
      const [ex, ey] = P(27, 17.5, 4.5); ellipse(g, '#c8a070', ex, ey, 3.5, 4.5); ellipse(g, '#a87a48', ex, ey, 1.6, 2.4);
      if (r() < 0.5) { const [mx, my] = P(10, 15, 9); ellipse(g, '#3a7a2e', mx, my, 3, 1.5); ellipse(g, '#4a8a3c', mx + 7, my, 2, 1); } // moss
    },
    // A dry bush: bare twigs spreading up and out from one root.
    dry_bush(g, r) {
      for (let i = 0; i < 10; i++) {
        const a = r() * Math.PI * 2, len = 4 + r() * 6;
        line3(g, r() < 0.5 ? '#8a6a3a' : '#a8844a', 1, 16, 17, 0, 16 + Math.cos(a) * len, 17 + Math.sin(a) * len, 5 + r() * 9);
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
    // Stalagmites: rock spikes growing up from the floor, tapering to a point, lit on their west.
    stalagmite(g, r) {
      floorShadow(g, 11, 3);
      const rock = { top: '#8a7e70', south: '#6a5e52', east: '#4e443a', edge: '#a4988a' };
      const n = 2 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) { const u = 8 + i * 7 + r() * 3, v = 14 + r() * 8, w = 3 + r() * 1.5; taper(g, u - w, v - w, u + w, v + w, 0, 14 + r() * 18, w * 0.92, rock); }
    },
    rubble(g, r) {
      for (let i = 0; i < 7; i++) {
        const x = 5 + r() * 22, y = 12 + r() * 14, rx = 1.5 + r() * 2.5;
        ellipse(g, 'rgba(0,0,0,0.25)', x + 1, y + 1.5, rx, rx * 0.6);
        ellipse(g, r() < 0.5 ? '#7a7068' : '#8e847a', x, y, rx, rx * 0.7);
      }
    },
    // A cluster of glowing crystals: tapering shards standing in the slant, lit through, a glow round them.
    crystal(g, r) {
      const [c, light, glow] = r() < 0.5 ? ['#40c8f0', '#c0f4ff', 'rgba(64,200,240,0.25)'] : ['#a060f0', '#e8d0ff', 'rgba(160,96,240,0.25)'];
      const [gx, gy] = P(16, 18, 10); ellipse(g, glow, gx, gy, 14, 11);
      floorShadow(g, 9, 2.5);
      const col = { top: light, south: c, east: shade(c, 0.65) };
      for (const [u, v, h, w] of [[12, 15, 22, 2.6], [19, 17, 30, 3.2], [22, 22, 16, 2.4], [14, 21, 13, 2]]) taper(g, u - w, v - w, u + w, v + w, 0, h, w * 0.95, col);
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
      floorShadow(g, 12, 4);
      const [nx, ny] = P(16, 18, 2); ellipse(g, '#5a4228', nx, ny + 1, 13, 7); ellipse(g, '#7a5a34', nx, ny, 12, 6); // the nest, of twigs
      for (let i = 0; i < 18; i++) { const a = r() * Math.PI * 2, d = 7 + r() * 5; line(g, i % 2 ? '#9a7a46' : '#4e3820', 1, nx + Math.cos(a) * d, ny + Math.sin(a) * d * 0.5, nx + Math.cos(a + 0.6) * d, ny + Math.sin(a + 0.6) * d * 0.5); }
      const tint = r() < 0.5 ? ['#e88a6a', '#c84a3a', '#8a2a1e'] : ['#8ac0e0', '#4a8ab0', '#2a5a7a'];
      for (const [u, v] of [[16, 15], [11, 19], [20, 20]]) {
        drum(g, u, v, 2, 11, t => 3.4 * Math.sqrt(Math.max(0, 1 - (2 * t - 0.8) ** 2 / 1.44)) + 0.4, { edge: tint[2], light: tint[0], mid: tint[1], dark: tint[2] });
        for (let k = 0; k < 3; k++) { const [x, y] = P(u - 1.5 + r() * 3, v, 4 + r() * 5); rect(g, 'rgba(0,0,0,0.3)', x, y, 1, 1); }
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
    // A sword stuck in the ground over a little mound: blade, crossguard, grip and pommel, all in the slant.
    sword_grave(g) {
      floorShadow(g, 7, 2.5);
      const [mx, my] = P(16, 20, 0); ellipse(g, '#6a5a44', mx, my, 7, 3); ellipse(g, '#7e6c52', mx - 1, my - 0.5, 4.5, 1.8);
      prism(g, 15.2, 19.4, 16.8, 20.6, 0, 26, { top: '#ffffff', south: '#c8ccd4', east: '#8a909a', edge: '#ffffff' }); // the blade
      prism(g, 10.5, 19.2, 21.5, 20.8, 26, 28, { top: '#e0b850', south: '#b08a30', east: '#7a5e1a', edge: '#f0d070' }); // the crossguard
      prism(g, 15.3, 19.5, 16.7, 20.5, 28, 35, { top: '#7a5a32', south: '#5a3a1a', east: '#3e2612' });                    // the grip
      const [px, py] = P(16, 20, 37); ellipse(g, '#a87a20', px + 0.4, py + 0.4, 2.2, 2.2); ellipse(g, '#e0b040', px, py, 1.8, 1.8); // the pommel
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
    // Oakvale's flag on a tower: an iron-shod pole with a gilded knob, a big blue flag with the temple's golden sun on
    // it, waving (four frames): its folds catch the light and fall into shade.
    tower_flag(g, r, frame) {
      floorShadow(g, 6, 2);
      prism(g, 12, 12, 20, 20, 0, 4, { top: '#7a7a82', south: '#5a5a62', east: '#42424a', edge: '#9a9aa2' });
      prism(g, 15.2, 15.2, 16.8, 16.8, 4, 74, { top: '#8a6a3e', south: '#6a4a26', east: '#4a3018', edge: '#a8844e' });
      const [kx, ky] = P(16, 16, 76); ellipse(g, '#a87818', kx, ky, 2.6, 2.6); ellipse(g, '#f2c94c', kx - 0.6, ky - 0.6, 1.6, 1.6);
      const U0 = 17, U1 = 47, Z0 = 38, Z1 = 72, wave = u => Math.sin((u - U0) * 0.32 - frame * Math.PI / 2) * 2.2 * ((u - U0) / (U1 - U0));
      const top = [], bottom = [];
      for (let u = U0; u <= U1; u += 1) { top.push(...P(u, 16, Z1 + wave(u))); bottom.unshift(...P(u, 16, Z0 + wave(u) - (u - U0) * 0.08)); }
      poly(g, '#2a5aa8', [...top, ...bottom]);                                                // the cloth
      for (let u = U0 + 1; u < U1; u += 1) { // its folds: light where it bellies towards the sun, shade in the troughs
        const k = Math.cos((u - U0) * 0.32 - frame * Math.PI / 2);
        if (Math.abs(k) < 0.35) continue;
        const z0 = Z0 + wave(u) - (u - U0) * 0.08, z1 = Z1 + wave(u);
        poly(g, k > 0 ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,30,0.22)', [...P(u, 16, z1), ...P(u + 1, 16, z1), ...P(u + 1, 16, z0), ...P(u, 16, z0)]);
      }
      poly(g, '#e8b54a', [...P(U0, 16, Z1), ...P(U0 + 2, 16, Z1), ...P(U0 + 2, 16, Z0), ...P(U0, 16, Z0)]); // the gold hem at the pole
      const su = 31, sz = (Z0 + Z1) / 2 + wave(31), [sx, sy] = P(su, 16, sz);              // the golden sun
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; line(g, '#f2c94c', 1.4, sx + Math.cos(a) * 4, sy + Math.sin(a) * 4, sx + Math.cos(a) * 7, sy + Math.sin(a) * 7); }
      ellipse(g, '#c8901c', sx, sy, 4, 4); ellipse(g, '#ffd860', sx - 0.6, sy - 0.6, 2.9, 2.9);
    },
    // A cannon on the wall: a carriage of oak on four iron-rimmed wheels, a long bronze barrel on it with a ring at the
    // muzzle and a knob at the breech, pointing out over the battlements.
    // Oakvale's banner down the face of the town wall: blue cloth with a gold hem and the golden sun, a swallowtail, its
    // shadow on the stone, hung from an iron rod at the top.
    wall_banner_s: (g, r) => wallBanner(g, 'south'),
    wall_banner_e: (g, r) => wallBanner(g, 'east'),
    cannon_n: g => cannon(g, 0, -1),
    cannon_e: g => cannon(g, 1, 0),
    cannon_s: g => cannon(g, 0, 1),
    cannon_w: g => cannon(g, -1, 0),
    // A pyramid of iron cannonballs on a little wooden frame.
    cannonballs(g) {
      floorShadow(g, 9, 3);
      prism(g, 7, 9, 25, 23, 0, 2, { top: '#7a5430', south: '#5a3a1e', east: '#3e2612', edge: '#9a7048' });
      const ball = (u, v, z) => { const [x, y] = P(u, v, z); ellipse(g, '#1e1e22', x, y, 3.6, 3.6); ellipse(g, '#3e3e46', x - 0.6, y - 0.6, 2.8, 2.8); ellipse(g, '#8a8a96', x - 1.4, y - 1.4, 1, 1); };
      for (const [u, v] of [[11, 13], [16, 13], [21, 13], [11, 19], [16, 19], [21, 19]]) ball(u, v, 5);
      for (const [u, v] of [[13.5, 16], [18.5, 16]]) ball(u, v, 11);
      ball(16, 16, 17);
    },
    // An ancient tree: a massive trunk on great roots, a huge old crown.
    ancient_tree(g, r) {
      floorShadow(g, 22, 8);
      for (const [du, dv] of [[-10, 4], [10, 2], [-4, 11], [8, -7], [-9, -6]]) line3(g, '#4a2e16', 4, 16, 16, 9, 16 + du, 16 + dv, 0);
      column(g, 16, 16, 6, 0, 36, { light: '#7a5432', mid: '#5b3a1e', dark: '#3a2410', top: '#c8a070' });
      leafCrown(g, r, 16, 16, 50, 20, 13, 70, { shade: '#122e10', dark: '#1f4a1c', mid: '#2a5f25', light: '#347330', glint: '#4a8a3c', size: 6 });
    },
    // Ice crystals: pale tapering spikes in the slant, lit through on their west.
    ice_spike(g, r) {
      floorShadow(g, 11, 3);
      const ice = { top: '#f0faff', south: '#b8e0f4', east: '#8ab8d4', edge: '#ffffff' };
      for (const [u, v, h, w] of [[10, 16, 20, 3], [17, 18, 30, 3.6], [23, 15, 17, 2.8]].map(([u, v, h, w]) => [u + r() * 2, v + r() * 3, h + r() * 6, w])) taper(g, u - w, v - w, u + w, v + w, 0, h, w * 0.95, ice);
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
    // The temple's lantern on its roof: a little marble turret with stained-glass windows (red, gold and blue) on
    // its south and east faces, lit from inside, under a pointed marble roof with gilded edges, crowned by the
    // golden sun of the dawn. It glows at night (light, in defs.js).
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
    // A gravestone: a stone slab with a rounded top standing on a low base, a cross cut into its face; all in the
    // slant, its top edge and east side catching less light than its face.
    gravestone(g) {
      floorShadow(g, 10, 3);
      const stone = { top: '#c4c4c0', south: '#9a9a96', east: '#76767a', edge: '#e4e4e0' };
      prism(g, 7, 13, 25, 22, 0, 4, stone);                       // the base
      const u0 = 9.5, u1 = 22.5, v0 = 16, v1 = 19, z0 = 4, z1 = 22, rad = (u1 - u0) / 2;
      const arch = (v, c) => { // the slab's outline at depth v: straight sides, a round top
        const pts = [...P(u0, v, z0), ...P(u1, v, z0)];
        for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI; pts.push(...P(u0 + rad + Math.cos(a) * rad, v, z1 + Math.sin(a) * rad)); }
        poly(g, c, pts);
      };
      arch(v0, '#c8c8c4');                                        // the back, seen over the top
      prism(g, u1 - 0.01, v0, u1, v1, z0, z1, stone);             // its east side
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI / 2, b = ((k + 1) / 6) * Math.PI / 2, c = u0 + rad; // the round top's east half, between front and back
        poly(g, '#b0b0ac', [...P(c + Math.cos(a) * rad, v0, z1 + Math.sin(a) * rad), ...P(c + Math.cos(b) * rad, v0, z1 + Math.sin(b) * rad), ...P(c + Math.cos(b) * rad, v1, z1 + Math.sin(b) * rad), ...P(c + Math.cos(a) * rad, v1, z1 + Math.sin(a) * rad)]); }
      arch(v1, '#a4a4a0');                                        // the face
      onSouth(g, v1, f => { rect(f, '#6e6e6a', 15.2, 10, 1.6, 15); rect(f, '#6e6e6a', 11.5, 19, 9, 1.6); rect(f, '#c8c8c4', 15.2, 10, 0.6, 15); }); // the cross
      line3(g, '#e0e0dc', 1, u0, v1, z0, u0, v1, z1);             // its lit west edge
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

    // A window: a recess in the wall with the glass at its back (its leading, the sky in it, the frame's shadow on
    // its north-west), the recess's sill and side showing, a stone surround standing out a little, and a sill below.
    window: (g, r, frame, shape) => {
      const at = wallSpot(shape), east = runsNorthSouth(wallSides(shape)), D = 4, u0 = 10, u1 = 22, h0 = 12, h1 = 26;
      g.save(); // what's in the recess shows only through the opening in the face
      g.beginPath(); for (const [u, h] of [[u0, h0], [u1, h0], [u1, h1], [u0, h1]]) g.lineTo(...at(u, 0, h)); g.closePath(); g.clip();
      wallPoly(g, shape, -D, '#1c2630', [u0, h0, u1, h0, u1, h1, u0, h1]);
      onWallPlane(g, shape, -D, () => {
        rect(g, '#5a8cb0', u0 + 1, 32 - h1 + 1, u1 - u0 - 1, h1 - h0 - 1);  // glass
        rect(g, '#8cc0e0', 17, 9, 3, 4); rect(g, '#b8e0f8', 19, 15, 2, 3);  // the sky in it
        rect(g, '#3a2818', 16, 32 - h1 + 1, 1, h1 - h0); rect(g, '#3a2818', u0 + 1, 13, u1 - u0, 1); // the leading
        rect(g, 'rgba(255,255,255,0.3)', 12, 9, 1, 3);
        rect(g, 'rgba(10,16,24,0.55)', u0, 32 - h1, u1 - u0, 2); rect(g, 'rgba(10,16,24,0.55)', u0, 32 - h1, 2, h1 - h0); // the frame's shadow
      });
      const sill = [...at(u0, -D, h0), ...at(u1, -D, h0), ...at(u1, 0, h0), ...at(u0, 0, h0)];
      poly(g, '#d8d0bc', sill);                                                                          // the recess's sill, lit
      poly(g, east ? '#b8b09c' : '#7e776a', [...at(u0, -D, h0), ...at(u0, 0, h0), ...at(u0, 0, h1), ...at(u0, -D, h1)]); // its side
      g.restore();
      wallBox(g, shape, u0 - 2, u1 + 2, 0, 1, h1, h1 + 2, STONE);   // the lintel
      wallBox(g, shape, u0 - 2, u0, 0, 1, h0, h1, STONE);           // the jambs
      wallBox(g, shape, u1, u1 + 2, 0, 1, h0, h1, STONE);
      wallBox(g, shape, u0 - 3, u1 + 3, 0, 3, h0 - 2, h0, STONE);   // the sill, sticking out
    },
    // A temple window: a tall arch of stained glass like the lantern's (a sun in leaded panes) set a little into the
    // wall, its shadow along the top and west of the recess, a stone sill standing out below it.
    window_stained: (g, r, frame, shape) => {
      const D = 1.5;
      wallPoly(g, shape, 0, 'rgba(20,14,8,0.35)', [9, 9, 23, 9, 23, 22, 16, 29, 9, 22]);          // the recess
      onWallPlane(g, shape, -D, () => { g.transform(1, 0, 0, -1, 0, 32); sunWindow(g, 10, 12, 10, 22); });
      wallBox(g, shape, 7, 25, 0, 2.5, 6.6, 8.2, STONE);                                         // the sill, sticking out
    },
    // A torch in an iron ring on a bracket out from the wall, soot on the wall above it.
    wall_torch: (g, r, frame, shape) => wallTorch(g, shape, frame, true),
    wall_torch_out: (g, r, frame, shape) => wallTorch(g, shape, frame, false),
    // A banner hanging flat against the wall from a rod along its top, in folds, with a swallowtail and the temple's
    // gold diamond; its shadow on the wall just beside it.
    banner: (g, r, frame, shape) => {
      const cloth = [10, 28, 22, 28, 22, 13, 16, 16, 10, 13];
      wallPoly(g, shape, 0, 'rgba(15,10,5,0.3)', cloth.map((v, k) => v + (k % 2 ? -1.2 : 1)));
      wallPoly(g, shape, 1, '#7a1820', cloth);
      onWallPlane(g, shape, 1, () => {
        for (const u of [13, 16, 19]) { rect(g, 'rgba(0,0,0,0.22)', u, 4, 1.3, 13); rect(g, 'rgba(255,150,150,0.16)', u - 1.2, 4, 1, 12); } // folds
        rect(g, '#d8b040', 10.8, 4, 0.9, 14); rect(g, '#d8b040', 20.3, 4, 0.9, 14);          // gold trim
        poly(g, '#8a6a18', [16, 7, 18.5, 10.5, 16, 14, 13.5, 10.5]); poly(g, '#f0d060', [16, 7, 17.6, 10, 16, 12.2, 14.4, 10]); // the diamond
      });
      wallBox(g, shape, 9, 23, 0, 1.6, 28, 29.6, IRON);                                       // the rod
      for (const u of [8.5, 23.5]) wallBox(g, shape, u - 1, u + 1, 0, 2, 27.8, 29.8, { top: '#f0d060', south: '#c8a030', east: '#8a6a18' });
    },
    painting: (g, r, frame, shape) => framed(g, shape, 6, 5, 20, 15, '#c8a030', () => {
      rect(g, '#7ab0e0', 8, 7, 16, 6);
      rect(g, '#4a8a3c', 8, 13, 16, 5);
      ellipse(g, '#f0e060', 19, 9, 2, 2);
    }),
    painting_ship: (g, r, frame, shape) => framed(g, shape, 5, 4, 22, 17, '#8a6a28', () => {
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
    sign_weapons: (g, r, frame, shape) => shopSign(g, shape, '#7a4a22', () => {
      line(g, '#c8ccd4', 2, 11, 21, 21, 9); line(g, '#c8ccd4', 2, 21, 21, 11, 9);
      rect(g, '#6a4220', 10, 19, 3, 3); rect(g, '#6a4220', 19, 19, 3, 3);
    }),
    sign_armour: (g, r, frame, shape) => shopSign(g, shape, '#5a4a3a', () => {
      poly(g, '#9aa0aa', [11, 9, 21, 9, 21, 15, 16, 21, 11, 15]); poly(g, '#c8ccd4', [11, 9, 16, 9, 16, 21, 11, 15]);
      rect(g, '#b03030', 15, 10, 2, 9);
    }),
    sign_magic: (g, r, frame, shape) => shopSign(g, shape, '#3a2a5a', () => {
      poly(g, '#f0d050', [16, 8, 17.5, 13, 22, 13, 18.5, 16, 20, 21, 16, 18, 12, 21, 13.5, 16, 10, 13, 14.5, 13]);
      rect(g, '#a0d0ff', 21, 9, 1, 1); rect(g, '#a0d0ff', 11, 19, 1, 1);
    }),
    sign_food: (g, r, frame, shape) => shopSign(g, shape, '#8a5a2a', () => {
      ellipse(g, '#c88a40', 16, 15, 6, 4); ellipse(g, '#e0a858', 15, 14, 4.5, 2.5);
      for (const x of [13, 16, 19]) rect(g, '#a86a2a', x, 13, 1, 3);
    }),
    sign_tools: (g, r, frame, shape) => shopSign(g, shape, '#6a5030', () => {
      ellipse(g, '#c8a868', 16, 15, 5, 5); ellipse(g, '#6a5030', 16, 15, 2.5, 2.5); // a coil of rope
      line(g, '#c8a868', 1, 20, 18, 23, 21);
    }),
    sign_inn: (g, r, frame, shape) => shopSign(g, shape, '#7a4a22', () => {
      rect(g, '#e8d8a8', 12, 10, 8, 10); rect(g, '#c88a30', 12, 13, 8, 7); rect(g, '#f8f0d8', 12, 9, 8, 2); // a mug of ale
      rect(g, '#e8d8a8', 20, 12, 3, 1); rect(g, '#e8d8a8', 22, 12, 1, 5); rect(g, '#e8d8a8', 20, 16, 3, 1);
    }),
    sign_depot: (g, r, frame, shape) => shopSign(g, shape, '#4a5a6a', () => {
      rect(g, '#d8c8a0', 10, 10, 12, 9); poly(g, '#b8a880', [10, 10, 16, 15, 22, 10]); rect(g, '#c03030', 15, 14, 2, 2); // a letter
    }),
    sign_temple: (g, r, frame, shape) => shopSign(g, shape, '#e0d8c0', () => {
      ellipse(g, '#f0c040', 16, 15, 4, 4); for (let a = 0; a < 8; a++) line(g, '#f0c040', 1, 16 + Math.cos(a * 0.785) * 5, 15 + Math.sin(a * 0.785) * 5, 16 + Math.cos(a * 0.785) * 7.5, 15 + Math.sin(a * 0.785) * 7.5);
    }),
    sign_school: (g, r, frame, shape) => shopSign(g, shape, '#2a5a3a', () => {
      rect(g, '#f0e8d0', 10, 11, 6, 9); rect(g, '#e0d8c0', 16, 11, 6, 9); rect(g, '#8a6a3a', 15, 11, 2, 9); // an open book
      for (const y of [13, 15, 17]) { rect(g, '#8a8070', 11, y, 4, 1); rect(g, '#8a8070', 17, y, 4, 1); }
    }),
    // A box of flowers under a window.
    window_box: (g, r, frame, shape) => {
      const at = wallSpot(shape);
      wallPoly(g, shape, 0, 'rgba(15,10,5,0.3)', [8, 5, 26, 5, 26, 9, 8, 9]);                 // its shadow on the wall
      wallBox(g, shape, 7, 25, 0, 4, 6, 10, { top: '#3a2614', south: '#6a4220', east: '#4a2c14', edge: '#8e5c2e' });
      for (let i = 0; i < 8; i++) { // flowers, standing up out of the soil
        const u = 8.5 + i * 2.2, o = 1.2 + (i % 2) * 1.6, top = 13 + (i % 3);
        line(g, '#3a7a30', 1, ...at(u, o, 10), ...at(u, o, top));
        const [x, y] = at(u, o, top), c = ['#e84a5f', '#f5d547', '#ffffff', '#b06ee0'][(r() * 4) | 0];
        rect(g, c, x - 1.2, y - 1.2, 2.5, 2); rect(g, 'rgba(255,255,255,0.5)', x - 1.2, y - 1.2, 1, 1);
      }
    },
    // A lantern hanging from an iron arm: a little iron house with glass sides, glowing.
    lantern: (g, r, frame, shape) => {
      const at = wallSpot(shape);
      bracket(g, shape, 16, 27, 5.5);
      line(g, IRON.south, 1, ...at(16, 5, 27), ...at(16, 5, 23));                               // its hook
      const [gx, gy] = at(16, 5, 17); ellipse(g, 'rgba(255,210,120,0.25)', gx, gy, 8, 8);      // its glow
      wallBox(g, shape, 14, 18, 3, 7, 13, 14.5, IRON);                                          // its base
      wallBox(g, shape, 14.5, 17.5, 3.5, 6.5, 14.5, 21, { top: '#fff4c8', south: '#ffd880', east: '#d89a40' }); // the glass, lit inside
      for (const [u, o] of [[14.5, 6.5], [17.5, 6.5], [17.5, 3.5]]) line(g, IRON.east, 1, ...at(u, o, 14.5), ...at(u, o, 21)); // its frame
      wallBox(g, shape, 13.8, 18.2, 2.8, 7.2, 21, 22.5, IRON);                                  // its roof
      wallBox(g, shape, 15.3, 16.7, 4.3, 5.7, 22.5, 23.5, IRON);
    },
    // A shelf with jars and pots.
    // A shelf: two boards standing out from the wall, with jars and pots standing on them.
    shelf: (g, r, frame, shape) => {
      const wood = { top: '#9a6632', south: '#6a4220', east: '#4a2c14', edge: '#b07a42' };
      for (const h of [19, 10]) {
        wallPoly(g, shape, 0, 'rgba(15,10,5,0.28)', [6, h - 1, 28, h - 1, 28, h - 3, 6, h - 3]); // its shadow
        wallBox(g, shape, 5, 27, 0, 4, h - 1.5, h, wood);
        for (let u = 7; u < 25; u += 4 + ((r() * 2) | 0)) {
          const c = ['#4a7ac0', '#c04a3a', '#d8c070', '#5aa050', '#e8e0d0'][(r() * 5) | 0], hh = 3 + ((r() * 3) | 0);
          wallBox(g, shape, u, u + 2.5, 1, 3.2, h, h + hh, { top: shade(c, 1.25), south: c, east: shade(c, 0.7) });
        }
      }
    },
    // Swords, an axe and a spear on a wooden rack against the wall.
    weapon_rack: (g, r, frame, shape) => {
      const wood = { top: '#8a5a2c', south: '#6a4220', east: '#4a2c14', edge: '#a8743e' };
      const steel = { top: '#ffffff', south: '#c8ccd4', east: '#8a909a' };
      wallPoly(g, shape, 0, 'rgba(15,10,5,0.28)', [6, 22, 28, 22, 28, 20, 6, 20]);
      for (const u of [9, 14]) { // two swords, point up
        wallBox(g, shape, u, u + 1.6, 1, 1.8, 10, 28, steel);
        wallBox(g, shape, u - 2, u + 3.6, 0.6, 2.2, 10, 11.5, { top: '#a07a3a', south: '#7a5a2a', east: '#5a4018' });
        wallBox(g, shape, u, u + 1.6, 1, 1.8, 5, 10, { top: '#6a4a28', south: '#4a3018', east: '#30200e' });
      }
      wallBox(g, shape, 20, 21.6, 1, 2, 4, 29, wood);                                          // the axe's haft
      wallPoly(g, shape, 1.5, '#c8ccd4', [21.6, 27, 27, 25, 27, 20, 21.6, 22]); wallPoly(g, shape, 1.5, '#ffffff', [21.6, 27, 27, 25, 27, 24.5, 21.6, 26.4]);
      wallBox(g, shape, 5, 27, 0, 2.5, 23, 24.5, wood); wallBox(g, shape, 5, 27, 0, 2.5, 8, 9.5, wood); // the rails
    },
    // A plaque on the wall: a board with thickness and its shadow.
    sign_wall: (g, r, frame, shape) => {
      wallPoly(g, shape, 0, 'rgba(15,10,5,0.28)', [6, 13, 28, 13, 28, 23, 6, 23]);
      wallBox(g, shape, 5, 27, 0, 1.2, 13, 24, { top: '#c08a50', south: '#6e4422', east: '#4e3018' });
      onWallPlane(g, shape, 1.2, () => {
        rect(g, '#9a6a38', 5, 8, 22, 11); rect(g, 'rgba(255,255,255,0.2)', 5, 8, 22, 1);
        rect(g, '#4a2a10', 8, 11, 15, 1); rect(g, '#4a2a10', 8, 14, 11, 1);
      });
    },
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
    // Stairs up: a flight of stone steps rising north across the whole tile, each tread lit (the higher, the
    // brighter), each riser in shade, the top step meeting the dark of the stairwell going on up out of sight.
    stairs_up(g) {
      const n = 6, run = 32 / n; // (from the wall on the north edge to the tile's south edge, climbing up the wall)
      for (let i = 0; i < n; i++) { // back (highest) to front (lowest)
        const v0 = i * run, h = ((FLOOR_Z - 3) / n) * (n - i), l = 1.12 - i * 0.06; // (the top step as high as the wall: the floor above)
        prism(g, 0, v0, 32, v0 + run, 0, h, { top: shade('#c8c0b2', l), south: shade('#8a8478', l), east: shade('#6a645a', l), edge: shade('#e8e0d2', l) });
      }
    },
    // Stairs down: an opening in the floor with steps going down into the dark, each lower one darker.
    stairs_down(g) {
      const opening = [...P(4, 4, 0), ...P(28, 4, 0), ...P(28, 28, 0), ...P(4, 28, 0)];
      poly(g, '#0e0a08', opening);
      g.save(); g.beginPath(); for (let k = 0; k < 8; k += 2) g.lineTo(opening[k], opening[k + 1]); g.closePath(); g.clip();
      for (let i = 0; i < 5; i++) { // from the deepest (north) to the top (south)
        const v0 = 4 + i * 4.8, z = -(5 - i) * 3.5, l = 0.35 + i * 0.14; // (shallow, so the steps show inside the opening)
        prism(g, 4, v0, 28, v0 + 4.8, z - 3.5, z, { top: shade('#b8b0a4', l), south: shade('#8a8478', l), east: shade('#6a645a', l) });
      }
      g.restore();
      const rim = { top: '#9a948a', south: '#7a746a', east: '#5a544a', edge: '#c0bab0' };
      prism(g, 2, 2, 30, 4, -1, 1, rim); prism(g, 2, 4, 4, 30, -1, 1, rim); prism(g, 28, 4, 30, 30, -1, 1, rim); prism(g, 4, 28, 28, 30, -1, 1, rim); // its stone rim
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
    // A ladder standing against the tile's north side, up to the floor above.
    ladder(g) {
      const wood = { top: '#a6743e', south: '#7a4f26', east: '#5a3818', edge: '#c08a4e' };
      floorShadow(g, 9, 2);
      prism(g, 8, 4, 11, 7, 0, 54, wood);
      for (let z = 7; z < 54; z += 8) prism(g, 11, 5, 21, 6, z, z + 2, wood);
      prism(g, 21, 4, 24, 7, 0, 54, wood);
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

  const ANIMATED = { torch: { frames: [0, 1, 2, 3], ms: 120 }, tower_flag: { frames: [0, 1, 2, 3], ms: 240 }, wall_torch: { frames: [0, 2, 1, 3], ms: 130 }, campfire: { frames: [0, 1, 2, 3, 1, 2], ms: 110 }, windmill: { frames: [0, 1, 2, 3], ms: 260 }, cauldron: { frames: [0, 1, 2], ms: 300 }, fountain: { frames: [0, 1, 2, 3], ms: 220 }, chimney: { frames: [0, 1, 2, 3], ms: 380 }, water: { frames: [0, 1, 2, 1], ms: 400 }, sewer_water: { frames: [0, 1, 2, 1], ms: 520 }, lava: { frames: [0, 1, 2, 1], ms: 500 }, teleport: { frames: [0, 1, 2, 3, 4, 5, 6, 7], ms: 120 } };

  // Ground tiles get 4 variants each; these get a few as well.
  const VARIANTS = { apple_crate: 2, shelf: 3, window_box: 3, pier: 3, crag: 4, pebbles: 3, shells: 2, leaves: 3, grass_tuft: 3, driftwood: 2, wreck: 2, flagpole: 3, eggs: 2, fallen_pillar: 2, ice_spike: 2, tallgrass: 3, log: 2, rubble: 2, crystal: 2, stalagmite: 3, lilypad: 2, dry_bush: 2, puddle: 2, stall: 3, basket: 3, planter: 3, hedge: 2, tree: 3, pine: 2, snow_pine: 2, jungle_tree: 3, palm: 2, bush: 2, flowers: 3, reeds: 2, mushrooms: 2, wall_cave: 3, cliff: 4, wall_stone: 2, wall_block: 2, wall_wood: 2, wall_temple: 2, bookshelf: 2 };
  const spriteOf = id => THINGS[id].sprite || id;
  // Grounds drawn as one 96x96 texture spread over 3x3 tiles, for rock that has no seams.
  // Grounds drawn as one big texture (tiles x tiles), each tile showing its own part of it by position, so
  // no tile shows as a square. The big texture wraps round at its edges, so it tiles without a seam too.
  const SEAMLESS = {
    temple_paving: { tiles: 4, draw: g => {
      const image = customImage('temple_paving');
      if (image) { g.imageSmoothingEnabled = false; g.drawImage(image, 0, 0); }
      else for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        g.save(); g.translate(x * TILE, y * TILE);
        DRAW.paving(g, makeRng(hashStr('paving') + y * 4 + x)); g.restore();
      }
    } },
    marble: { tiles: 4, draw: g => {
      const image = customImage('marble');
      if (image) {
        g.imageSmoothingEnabled = false; g.drawImage(image, 0, 0);
        for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
          const px = x * TILE, py = y * TILE;
          g.fillStyle = '#e8dfcd';
          g.fillRect(px, py, TILE - 1, 1);
          g.fillRect(px, py + 1, 1, TILE - 2);
          g.fillStyle = '#b9ae98';
          g.fillRect(px + TILE - 1, py, 1, TILE);
          g.fillRect(px, py + TILE - 1, TILE, 1);
        }
      }
      else for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        g.save(); g.translate(x * TILE, y * TILE);
        DRAW.marble(g, makeRng(hashStr('marble') + y * 4 + x)); g.restore();
      }
    } },
    rock_top: { tiles: 3, draw: g => rockSurface(g, makeRng(hashStr('rock_top')), 3 * TILE, 132) },
    grass: { tiles: 4, draw: g => {
      const image = customImage('grass');
      if (image) {
        g.imageSmoothingEnabled = false;
        g.drawImage(image, 0, 0, 4 * TILE, 4 * TILE);
      } else grassField(g, makeRng(hashStr('grass')), 4 * TILE);
    } },
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
  const DEFAULT_OUTFIT = { hair: '#8d5029', body: '#274dae', legs: '#584e46', feet: '#573925' }; // (the player sheet's own colours: see SHEET)
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
  const NO_INK = new Set(['vault_shadow', 'portcullis_s0', 'portcullis_s1', 'portcullis_s2', 'portcullis_e0', 'portcullis_e1', 'portcullis_e2', 'flowers', 'tallgrass', 'grass_tuft', 'leaves', 'pebbles', 'shells', 'puddle', 'rubble', 'bones', 'web',
    'fern', 'reeds', 'lilypad', 'crops', 'eggs', 'mushrooms', 'driftwood', 'rails', 'loose_sand', 'teleport', 'campfire', 'torch', 'grate', 'chimney']);
  const inkable = (id, def) => !def.ground && !def.wall && !def.onWall && !def.roof && !def.change && !NO_INK.has(id);
  // A selective outline (docs/art-style.md): every pixel round the thing takes a deep shade of the colour it borders,
  // not black, so a wooden crate is edged in dark brown and a stone in dark grey.
  function inked(g, draw) {
    const { width, height } = g.canvas, layer = document.createElement('canvas');
    layer.width = width;
    layer.height = height;
    const f = layer.getContext('2d');
    draw(f);
    const src = f.getImageData(0, 0, width, height).data, out = g.createImageData(width, height), d = out.data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < width && y < height && src[(y * width + x) * 4 + 3] >= 200;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (solid(x, y)) continue;
      let r = 0, gg = 0, b = 0, n = 0;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (solid(x + dx, y + dy)) {
        const j = ((y + dy) * width + x + dx) * 4; r += src[j]; gg += src[j + 1]; b += src[j + 2]; n++;
      }
      if (!n) continue;
      const i = (y * width + x) * 4;
      d[i] = (r / n) * 0.3 + 6; d[i + 1] = (gg / n) * 0.27 + 4; d[i + 2] = (b / n) * 0.27 + 4; d[i + 3] = 225; // deep, a little warm
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
    const k = g.canvas.res || 1; // (a world pixel wide)
    for (const [dx, dy] of [[-k, 0], [k, 0], [0, -k], [0, k]]) g.drawImage(edge, dx, dy);
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
    if (Sprites.DOLLS) return ratDoll(g, dir, frame, c);
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
    if (Sprites.DOLLS) return slimeDoll(g, dir, frame);
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
    if (Sprites.DOLLS) return spiderDoll(g, dir, frame, c);
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
    if (Sprites.DOLLS) return wolfDoll(g, dir, frame, c);
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
    if (Sprites.DOLLS) return bearDoll(g, dir, frame, c);
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
    if (Sprites.DOLLS) return crabDoll(g, dir, frame);
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

  // ---- dolls: people and beasts built in 3D -------------------------------------------------------------
  // A figure is put together from parts in space (blocks, round limbs, balls), each in the figure's own frame (a: to
  // its right, b: forwards, z: up), turned to face its way, seen from the same angle as the world (from above the
  // south, the light from the top left: tops lit, south faces in light, east faces in shade), and drawn from the back
  // to the front. Its feet stand at (16, 29) on a 32x32 picture.
  const DOLL_DEPTH = 0.5; // how much of the ground a figure's depth takes up on screen (as seen from above)
  const turn = (dir, a, b) => (dir === 2 ? [-a, b] : dir === 0 ? [a, -b] : dir === 1 ? [b, a] : [-b, -a]); // -> (u, v)
  // How people are built (Sprites.BUILD): the doll is modelled with a big head on a short body; a build stretches the
  // legs (to the hip) and the body (to the shoulders) and makes the head smaller, by remapping heights (dollZ).
  const BUILDS = {
    classic: null,
    hero: { hip: 10.4, shoulder: 19.6, head: 0.7, wide: 1.06 },
    tall: { hip: 11.2, shoulder: 20.4, head: 0.6, wide: 1.1 },
  };
  let dollZ = z => z;
  const buildZ = b => { const r = 5.6 * b.head, k = (1 + r) / 5.2; return z => (z <= 8.6 ? z * b.hip / 8.6 : z <= 17.6 ? b.hip + (z - 8.6) * (b.shoulder - b.hip) / 9 : b.shoulder + (z - 17.6) * k); };
  const Q = (u, v, z) => [16 + u, 29 + v * DOLL_DEPTH - dollZ(z)];
  function dollParts(g, dir, parts) {
    const at = p => turn(dir, p.a || 0, p.b || 0);
    const depth = p => { const [u, v] = at(p); return v + u * 0.35 + (p.z || 0) * 0.002 + (p.over || 0); };
    for (const p of parts.slice().sort((x, y) => depth(x) - depth(y))) p.draw(...at(p));
  }
  // a block a wide (across the figure), b deep and from z0 to z1, its centre at (u, v), turned with the figure
  function dollBox(g, dir, u, v, a, b, z0, z1, c) {
    const [w, d] = dir === 1 || dir === 3 ? [b, a] : [a, b];
    const u0 = u - w / 2, u1 = u + w / 2, v0 = v - d / 2, v1 = v + d / 2;
    poly(g, c.east || shade(c.south, 0.72), [...Q(u1, v0, z0), ...Q(u1, v1, z0), ...Q(u1, v1, z1), ...Q(u1, v0, z1)]);
    poly(g, c.south, [...Q(u0, v1, z0), ...Q(u1, v1, z0), ...Q(u1, v1, z1), ...Q(u0, v1, z1)]);
    poly(g, c.top || shade(c.south, 1.18), [...Q(u0, v0, z1), ...Q(u1, v0, z1), ...Q(u1, v1, z1), ...Q(u0, v1, z1)]);
    line(g, shade(c.south, 1.3), 1, ...Q(u0, v1, z1), ...Q(u1, v1, z1));
  }
  // a round limb from (u, v0, z0) to (u, v1, z1), r thick: lit on its left, shaded on its right
  function dollLimb(g, u0, v0, z0, u1, v1, z1, r, colour) {
    const [x0, y0] = Q(u0, v0, z0), [x1, y1] = Q(u1, v1, z1);
    line(g, shade(colour, 0.6), r * 2 + 1, x0 + 0.5, y0, x1 + 0.5, y1);
    line(g, colour, r * 2, x0, y0, x1, y1);
    line(g, shade(colour, 1.25), Math.max(1, r * 0.6), x0 - r * 0.45, y0, x1 - r * 0.45, y1);
  }
  function dollBall(g, u, v, z, r, colour) {
    const [x, y] = Q(u, v, z);
    ellipse(g, shade(colour, 0.6), x + 0.5, y + 0.5, r + 0.5, r + 0.5);
    const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.15, x, y, r);
    gr.addColorStop(0, shade(colour, 1.28)); gr.addColorStop(0.55, colour); gr.addColorStop(1, shade(colour, 0.72));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // ---- people as pixel art ----------------------------------------------------------------------------------------
  // A grown-up figure drawn pixel by pixel, 27 pixels tall (a head of 8: about one to three and a half), standing at
  // (16, 28), from templates for each view (front, side, back): letters stand for colours of the look, worked out in
  // light and shade (art-style.md: lit from the top left). Walking moves the legs and swings the arms. What the look
  // wears goes on top in layers: hair, beard, skirt, robe, coat, armour, tabard, vest, collar, cape, hat, what it holds
  // and its shield. Looks this can't draw (bones, wings, tails, one eye...) are still drawn as dolls.
  //   h hair  j its light  H its shade   s skin  z its light  S its shade   e eye   m mouth
  //   b body  c its light  B its shade   a arm   A its shade   g hand   t belt   T buckle
  //   l legs  L their shade   f feet   F their shade
  const PX_FRONT = [
    '......hhhh......', '....hhjjhhhH....', '...hhjhhhhhhH...', '...hzssssssSH...', '...hssesseSSH...',
    '....ssssSssS....', '....sssmmsSS....', '.....SsssSS.....', '.......sS.......',
    '..accbbbbbbBBA..', '..acbbbbbbbbBA..', '..acbbbbbbbbBA..', '..acbbbbbbbBBA..', '..a.bbbbbbbB.A..', '..a.bbbbbbbB.A..',
    '..g.bbbbbbbB.g..', '..g.ttttTttt.g..',
    '....llllllLL....', '....lllL.lLL....', '....lllL.lLL....', '....lllL.lLL....', '....lllL.lLL....', '....lllL.lLL....',
    '....lllL.lLL....', '....fffF.fFF....', '....fffF.fFF....', '...ffffF.ffFF...',
  ];
  const PX_BACK = [
    '......hhhh......', '....hhjjhhhH....', '...hhjhhhhhhH...', '...hhhhhhhhhH...', '...hhhhhhhhHH...',
    '....hhhhhhHH....', '....HhhhhhHH....', '.....SsssSS.....', '.......sS.......',
    '..accbbbbbbBBA..', '..acbbbbbbbbBA..', '..acbbbbbbbbBA..', '..acbbbbbbbBBA..', '..a.bbbbbbbB.A..', '..a.bbbbbbbB.A..',
    '..g.bbbbbbbB.g..', '..g.tttttttt.g..',
    '....llllllLL....', '....lllL.lLL....', '....lllL.lLL....', '....lllL.lLL....', '....lllL.lLL....', '....lllL.lLL....',
    '....lllL.lLL....', '....fffF.fFF....', '....fffF.fFF....', '...ffffF.ffFF...',
  ];
  const PX_SIDE = [ // facing east
    '......hhhh......', '.....hjjhhhh....', '....hjhhhhhhH...', '....hhhhzsssS...', '....hhhhsssess..',
    '....Hhhhsssss...', '.....HhSsssmS...', '......HSssSS....', '........sS......',
    '......cbbbbB....', '.....cbbabbBB...', '.....cbbaABB....', '.....cbbaABB....', '.....cbbaABB....', '.....cbbaABB....',
    '.....cbbgGBB....', '.....tttttTt....',
    '......llllL.....', '......llllL.....', '......llllL.....', '......llllL.....', '......llllL.....', '......llllL.....',
    '......llllL.....', '......fffffF....', '......fffffF....', '......ffffffF...',
  ];
  const PX_SIDE_STEP = [ // the legs (rows 17 to 26) of a side view mid-stride
    '......llllL.....', '.....lllLlL.....', '.....lll.llL....', '....lllL.llL....', '....lllL..llL...', '...lllL...llL...',
    '...lllL....llL..', '..ffffF....fffF.', '..ffffF....ffffF', '................',
  ];
  const PX_TOP = 2, PX_LEFT = 8; // where the templates go on the 32x32 picture
  // Which looks the pixel figure can draw.
  const pixelable = p => p && !p.ribs && !p.wings && !p.tail && !p.oneEye && !p.bigEyes && !p.ears && !p.horns;

  function pixelPerson(g0, p, dir, frame) {
    const s = p.scale || 1;
    if (s !== 1) { g0.translate(16, 28); g0.scale(s, s); g0.translate(-16, -28); }
    shadow(g0, 16, 28.6, 7, 2.6);
    outlined(g0, g => {
      const front = dir === 2, back = dir === 0, side = !front && !back, west = dir === 3;
      const hs = p.hairStyle || 'short', bald = hs === 'bald' || (p.hat && p.hat.style === 'hood');
      const skin = p.skin || '#f0c090', hair = p.hair || shade(skin, 0.6), body = p.body || '#6a6a72';
      const arms = p.arms || body, legs = p.legs || body, feet = p.feet || shade(legs, 0.6), belt = p.belt || shade(legs, 0.55);
      const C = {
        h: bald ? skin : hair, j: bald ? shade(skin, 1.12) : shade(hair, 1.32), H: bald ? shade(skin, 0.8) : shade(hair, 0.68),
        s: skin, z: shade(skin, 1.12), S: shade(skin, 0.8), e: p.eye || '#20160f', a: arms, A: shade(arms, 0.74), m: shade(skin, 0.6),
        b: body, c: shade(body, 1.22), B: shade(body, 0.74), g: skin, G: shade(skin, 0.8), t: belt, T: GOLD,
        l: legs, L: shade(legs, 0.72), f: feet, F: shade(feet, 0.68),
      };
      // the template, as a grid we can change (walking, and what the look wears)
      const grid = [...(front ? PX_FRONT : back ? PX_BACK : PX_SIDE), '................'].map(r => r.split(''));
      const at = (x, y) => (grid[y] || [])[x], set = (x, y, ch) => { if (grid[y] && x >= 0 && x < 16) grid[y][x] = ch; };
      const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
      if (step && side) { for (let k = 0; k < PX_SIDE_STEP.length; k++) grid[17 + k] = PX_SIDE_STEP[k].split(''); }
      if (step && !side) { // one foot comes a pixel nearer, the other goes back; the arms swing the other way
        const [near, far] = step > 0 ? [[3, 7], [9, 12]] : [[9, 12], [3, 7]];
        for (let x = near[0]; x <= near[1]; x++) for (let y = 26; y >= 18; y--) set(x, y + 1, at(x, y));
        for (let x = far[0]; x <= far[1]; x++) { for (let y = 23; y <= 26; y++) set(x, y - 1, at(x, y)); set(x, 26, '.'); }
        const [swungBack, swungForward] = step > 0 ? [2, 13] : [13, 2]; // (the hand on the near leg's side swings back)
        set(swungBack, 16, '.'); set(swungForward, 17, 'g');
      }
      if (step && side) { for (const y of [13, 14, 15]) { const ax = grid[y].indexOf('a'); if (ax >= 0 && step > 0) { set(ax, y, 'b'); set(ax + 1, y, 'a'); } } }
      // ---- what it wears, in layers
      const paint = (rows, x0, y0, ch) => rows.forEach((r, k) => [...r].forEach((c2, i) => { if (c2 !== '.') set(x0 + i, y0 + k, c2 === '#' ? ch : c2); }));
      if (p.beard && !back) { C.r = p.beard; C.R = shade(p.beard, 0.75); if (front) paint(['r........R', 'rr.rmmr.RR', '.rrrrrrRR.', '..rrrrRR..'], 3, 5, ''); else paint(['....rrR', '...rrRR', '....rR.'], 6, 6, ''); }
      if (!bald && (hs === 'long' || hs === 'braids' || hs === 'wild')) { // hair down to the shoulders
        if (front) for (let y = 4; y <= 11; y++) { set(3, y, 'h'); set(12, y, 'H'); }
        else if (back) for (let y = 7; y <= 12; y++) for (let x = 4; x <= 11; x++) set(x, y, x > 9 ? 'H' : 'h');
        else for (let y = 5; y <= 11; y++) set(4, y, 'H');
      }
      if (!bald && hs === 'ponytail') { if (back) for (let y = 7; y <= 13; y++) { set(7, y, 'h'); set(8, y, 'H'); } else if (side) for (let y = 6; y <= 11; y++) set(3, y, y > 8 ? 'H' : 'h'); }
      if (p.skirt) { C.k = p.skirt; C.K = shade(p.skirt, 0.74); for (let y = 17; y <= 21; y++) for (let x = 3 + (front || back ? 0 : 2); x <= (front || back ? 12 : 11); x++) if (at(x, y) !== '.' || y < 21) set(x, y, x >= (side ? 10 : 11) ? 'K' : 'k'); }
      if (p.robe || p.coat) { // a robe to the feet (a coat to the knees), widening as it goes down
        C.o = body; C.O = shade(body, 0.74); C.q = p.trim || shade(body, 1.25);
        const end = p.robe ? 26 : 22;
        for (let y = 16; y <= end; y++) {
          const spread = Math.floor((y - 16) / 3), x0 = (side ? 5 : 4) - spread, x1 = (side ? 11 : 11) + spread;
          for (let x = x0; x <= x1; x++) set(x, y, y === end && p.trim ? 'q' : x >= x1 - 1 ? 'O' : 'o');
        }
        if (p.robe && p.trim && !back && !side) for (let y = 16; y < end; y++) set(7, y, 'q');
      }
      if (p.armor) { // a breastplate and shoulder plates
        C.p = p.armor; C.P = shade(p.armor, 0.7); C.y = shade(p.armor, 1.3);
        for (let y = 9; y <= 14; y++) for (let x = 0; x < 16; x++) if ('bcB'.includes(at(x, y))) set(x, y, at(x, y) === 'c' ? 'y' : at(x, y) === 'B' ? 'P' : 'p');
        if (!side) { paint(['yyy', 'ppP'], 1, 9, ''); paint(['yyP', 'pPP'], 12, 9, ''); } else paint(['yyp', 'ppP'], 7, 9, '');
      }
      if (p.vest && !side) { C.v = p.vest; C.V = shade(p.vest, 0.74); for (let y = 9; y <= 15; y++) { set(4, y, 'v'); set(5, y, 'v'); set(10, y, 'V'); set(11, y, 'V'); } }
      if (p.stripes) { C.x = p.stripes; for (const y of [10, 12, 14]) for (let x = 0; x < 16; x++) if ('bcB'.includes(at(x, y))) set(x, y, 'x'); }
      if (p.tabard && !side) { C.d = p.tabard; C.D = shade(p.tabard, 0.74); C.n = shade(p.tabard, 1.45); for (let y = 10; y <= 21; y++) { set(6, y, 'd'); set(7, y, 'd'); set(8, y, 'd'); set(9, y, 'D'); } if (front) { set(7, 13, 'n'); set(8, 13, 'n'); set(7, 12, 'n'); set(7, 14, 'n'); } }
      if (p.collar && !back) { C.u = p.collar; if (front) paint(['.uuuu.'], 5, 9, ''); else paint(['uu'], 8, 9, ''); }
      if (p.fur) { C.w = shade(body, 1.3); C.W = shade(body, 0.9); if (!side) paint(['wwwwwwwwwwww', '.WwWwWwWwW.'], 2, 9, ''); }
      if (p.cape) { // behind: all of it from the back, its edges at the sides from the front
        C.i = p.cape; C.I = shade(p.cape, 0.7);
        if (back) for (let y = 9; y <= 24; y++) { const sp = Math.floor((y - 9) / 5); for (let x = 2 - sp; x <= 13 + sp; x++) set(x, y, x > 11 ? 'I' : 'i'); }
        else if (front) for (let y = 10; y <= 22; y++) { if (at(1, y) === '.') set(1, y, 'I'); if (at(14, y) === '.') set(14, y, 'I'); }
        else for (let y = 9; y <= 22; y++) { set(4, y, 'I'); if (y > 12) set(3, y, 'I'); }
      }
      if (p.backpack && back) { C.N = p.backpack; C.M = shade(p.backpack, 0.7); paint(['NNNNNN', 'NMMMMN', 'NNNNNN', 'NNNNNM', 'MMMMMM'], 5, 10, ''); }
      // the picture, mirrored for a west view
      const X = x => (west ? 31 - (PX_LEFT + x) : PX_LEFT + x);
      grid.forEach((row, y) => row.forEach((ch, x) => { if (ch !== '.' && C[ch]) rect(g, C[ch], X(x), PX_TOP + y, 1, 1); }));
      // ---- the hat, over the head
      if (p.hat) pixelHat(g, p.hat, dir, X);
      // ---- what it holds (in its right hand) and its shield (on its left arm)
      const hand = front ? [2, 16] : back ? [13, 16] : [9, 16];
      if (p.held && !back) pixelHeld(g, p.held, X(hand[0]), PX_TOP + hand[1], dir);
      if (p.shield && !(side && !west) ) { const sx = front ? 13 : back ? 2 : 9; const c = p.shield; for (let y = 11; y <= 17; y++) for (let x = 0; x < 4; x++) if (!(y === 17 && (x === 0 || x === 3))) rect(g, x === 0 ? shade(c, 1.25) : x === 3 ? shade(c, 0.7) : c, X(sx + x - 1), PX_TOP + y, 1, 1); rect(g, GOLD, X(sx + 1), PX_TOP + 13, 1, 2); }
    });
  }
  // A hat in pixels, on the head of a pixel figure (dir as the figure, X maps a template column to the picture).
  function pixelHat(g, hat, dir, X) {
    const c = hat.color || '#8a8a92', lit = shade(c, 1.3), dk = shade(c, 0.7), acc = hat.accent || GOLD, st = hat.style, front = dir === 2;
    const row = (y, x0, x1, col) => { for (let x = x0; x <= x1; x++) rect(g, typeof col === 'function' ? col(x) : col, X(x), PX_TOP + y, 1, 1); };
    const lightDark = (x0, x1) => x => (x <= x0 + 1 ? lit : x >= x1 - 1 ? dk : c);
    if (st === 'hood') { // over the top and down the sides of the head, the face looking out; a mantle on the shoulders
      const side = dir === 1 || dir === 3, back = dir === 0;
      row(0, 5, 10, lightDark(5, 10)); row(1, 4, 11, lightDark(4, 11)); row(2, 3, 12, lightDark(3, 12));
      for (let y = 3; y <= 8; y++) {
        if (back) row(y, 3, 12, lightDark(3, 12));
        else if (side) row(y, 3, 7, lightDark(3, 7));
        else { row(y, 3, 4, lit); row(y, 11, 12, dk); }
      }
      if (front) row(3, 5, 10, shade(c, 0.45)); // the shadow of its edge on the forehead
      row(9, 2, 13, lightDark(2, 13));
      return;
    }
    if (st === 'helmet' || st === 'plume' || st === 'horned') {
      row(0, 5, 10, lightDark(5, 10)); row(1, 4, 11, lightDark(4, 11)); row(2, 3, 12, lightDark(3, 12)); row(3, 3, 12, dk);
      if (front) { rect(g, dk, X(7), PX_TOP + 4, 1, 1); rect(g, dk, X(8), PX_TOP + 4, 1, 1); rect(g, dk, X(7), PX_TOP + 5, 1, 1); }
      if (st === 'plume') for (let y = -3; y <= 0; y++) row(y, 7 + (y < -1 ? 1 : 0), 8, acc);
      if (st === 'horned') { for (const [x, y] of [[2, 1], [1, 0], [1, -1], [13, 1], [14, 0], [14, -1]]) rect(g, acc, X(x), PX_TOP + y, 1, 1); }
      return;
    }
    if (st === 'crown') { row(1, 4, 11, GOLD); row(2, 4, 11, shade(GOLD, 0.8)); for (const x of [4, 7, 8, 11]) rect(g, '#f0d040', X(x), PX_TOP, 1, 1); rect(g, '#e04040', X(7), PX_TOP + 1, 1, 1); return; }
    if (st === 'pointy') { for (let y = -5; y <= 2; y++) { const half = Math.max(0, Math.floor((y + 5) / 2)); row(y, 8 - half, 8 + half - 1, lightDark(8 - half, 8 + half - 1)); } row(3, 1, 14, dk); return; }
    if (st === 'bandana') { row(1, 4, 11, c); row(2, 3, 12, dk); if (dir !== 2) { rect(g, c, X(dir === 0 ? 7 : 3), PX_TOP + 3, 1, 2); } return; }
    if (st === 'antlers') { for (const [x, y] of [[5, 1], [4, 0], [3, -1], [4, -2], [2, 0], [10, 1], [11, 0], [12, -1], [11, -2], [13, 0]]) rect(g, c, X(x), PX_TOP + y, 1, 1); return; }
    // a hat with a brim: wide, tricorn, hunter's, feathered
    row(0, 5, 10, lightDark(5, 10)); row(1, 5, 10, lightDark(5, 10)); row(2, 4, 11, c);
    row(3, st === 'wide' || st === 'tricorn' ? 1 : 2, st === 'wide' || st === 'tricorn' ? 14 : 13, dk);
    row(2, 5, 10, acc === GOLD ? shade(c, 0.6) : acc);
    if (st === 'feather' || st === 'hunter') for (const [x, y] of [[11, 1], [12, 0], [13, -1], [13, -2]]) rect(g, hat.accent || '#f4f0e8', X(x), PX_TOP + y, 1, 1);
  }
  // What a pixel figure holds, its hand at (x, y) on the picture.
  function pixelHeld(g, kind, x, y, dir) {
    const px = (dx, dy, c) => rect(g, c, x + dx, y + dy, 1, 1), up = (x0, y0, y1, c) => { for (let k = y0; k <= y1; k++) px(x0, k, c); };
    if (kind === 'sword' || kind === 'sabre') { up(0, -10, -2, '#dfe3ea'); up(1, -9, -2, '#9aa0aa'); px(-1, -1, GOLD); px(0, -1, GOLD); px(1, -1, GOLD); px(2, -1, GOLD); up(0, 0, 1, '#5a3a1e'); }
    else if (kind === 'axe' || kind === 'greataxe') { up(0, -9, 2, '#6a4422'); for (let k = -9; k <= -5; k++) { px(1, k, '#c4c8d0'); px(2, k, k === -9 || k === -5 ? '#8a8e96' : '#b0b4bc'); } if (kind === 'greataxe') for (let k = -9; k <= -5; k++) { px(-1, k, '#b0b4bc'); px(-2, k, '#8a8e96'); } }
    else if (kind === 'staff' || kind === 'leafstaff') { up(0, -14, 4, '#7a5030'); px(0, -15, kind === 'leafstaff' ? '#5aaa48' : '#80d0ff'); px(-1, -15, kind === 'leafstaff' ? '#3a8a30' : '#c0ecff'); px(1, -15, kind === 'leafstaff' ? '#3a8a30' : '#4aa0e0'); px(0, -16, kind === 'leafstaff' ? '#5aaa48' : '#c0ecff'); }
    else if (kind === 'bow' || kind === 'crossbow') { for (let k = -8; k <= 4; k++) px(Math.round(Math.abs(k + 2) / 4) - 1, k, '#8a5a2e'); up(1, -7, 3, '#e8e0d0'); }
    else { up(0, -7, 1, '#6a4422'); px(1, -7, '#4a2e14'); px(1, -6, '#4a2e14'); px(-1, -7, '#5a3a1e'); }
  }

  // ---- people, drawn large ------------------------------------------------------------------------------------------
  // A grown-up figure about a tile and a half tall (44 pixels, a head of 10), drawn from shapes rather than blocks: a
  // head with a jaw, hair, a face; shoulders, a chest narrowing to the waist; arms with elbows and hands; thighs,
  // knees and boots. Every part is shaded across from the light (top left) to the shade (right). Feet at (16, 29), the
  // head up to y -15, so it's drawn on a big (64 x 64) picture. Walking swings the legs and arms. What the look wears
  // and holds goes on in layers. (Looks it can't draw are still dolls: see hdable.)
  const HD_SIZE = 0.8; // the figure's size: 0.8 of the 44 pixels it's drawn at, about 35 pixels tall
  const HD_RISE = Math.ceil(44 * HD_SIZE - 29); // how far above its tile a person's head reaches
  const hdable = p => p && !p.ribs && !p.wings && !p.tail && !p.oneEye && !p.bigEyes && !p.horns && !(p.scale && p.scale !== 1);
  function hdFill(g, color, x0, x1) { // a fill lit on the left and shaded on the right
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, shade(color, 1.22)); gr.addColorStop(0.42, color); gr.addColorStop(1, shade(color, 0.66));
    g.fillStyle = gr;
  }
  function hdCapsule(g, x0, y0, r0, x1, y1, r1, color) { // a limb: two rounded ends joined
    const a = Math.atan2(y1 - y0, x1 - x0);
    g.beginPath(); g.arc(x0, y0, r0, a + Math.PI / 2, a + Math.PI * 1.5); g.arc(x1, y1, r1, a - Math.PI / 2, a + Math.PI / 2); g.closePath();
    hdFill(g, color, Math.min(x0 - r0, x1 - r1), Math.max(x0 + r0, x1 + r1)); g.fill();
  }
  function hdShape(g, pts, color, x0, x1) { // a closed shape through points [x, y, ...], smoothed
    g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath(); hdFill(g, color, x0, x1); g.fill();
  }
  function hdPerson(g0, p, dir, frame) {
    g0.translate(16, 29); g0.scale(HD_SIZE, HD_SIZE); g0.translate(-16, -29); // (smaller, standing on the same spot)
    shadow(g0, 16, 29, 8, 3);
    outlined(g0, g => {
      if (dir === 3) { g.translate(32, 0); g.scale(-1, 1); } // a west view is the east one mirrored
      const front = dir === 2, back = dir === 0, side = !front && !back;
      const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
      const skin = p.skin || '#f0c090', hair = p.hair || shade(skin, 0.6), body = p.body || '#6a6a72', arms = p.arms || body;
      const legs = p.legs || body, feet = p.feet || shade(legs, 0.6), belt = p.belt || null, hs = p.hairStyle || 'short';
      const hat = p.hat || null, hooded = hat && hat.style === 'hood', female = !!p.female;
      const wide = female ? 0.9 : 1; // her shoulders are narrower
      const later = []; // what goes in front, drawn last
      // ---- behind everything: a cape, long hair from the back, what's held seen from behind
      if (p.cape && !back) { const c = p.cape; if (front) { hdShape(g, [8.2 - 2 * wide + 2, -2, 23.8 + 2 * wide - 2, -2, 25.4, 22, 6.6, 22], shade(c, 0.6), 6, 26); } else hdShape(g, [12, -2.5, 16, -2.5, 13.5, 22, 7.5, 22], c, 7, 16); }
      if (p.held && back) hdHeld(g, p.held, 23.4, 13, dir);
      if (!back && (hs === 'long' || hs === 'braids' || hs === 'wild') && !hooded) { // long hair falling behind the shoulders
        const lx = side ? 16.8 : 16;
        if (side) hdShape(g, [lx - 4.4, -12, lx + 1, -12, lx - 1, 1.5, lx - 4.8, 1.5], shade(hair, 0.85), lx - 4.8, lx);
        else hdShape(g, [lx - 4.4, -12, lx + 4.4, -12, lx + 4.9, 0.5, lx - 4.9, 0.5], shade(hair, 0.78), lx - 4.9, lx + 4.9);
      }
      if (side && p.shield) hdShield(g, p.shield, 14.4, 6, true);
      // ---- the legs (under a robe only the toes), stepping
      const hips = side ? [[16.4, 11.5], [15.6, 11.5]] : [[13.3, 11.5], [18.7, 11.5]];
      const legPose = k => { // knee and ankle of leg k (0: left on screen or the far one, 1: right or the near one)
        const [hx, hy] = hips[k];
        if (side) {
          const swing = (k === 1 ? step : -step) * (p.robe ? 0.16 : 0.42), bend = swing < 0 && !p.robe ? 0.35 : 0;
          const kx = hx + Math.sin(swing) * 8, ky = hy + Math.cos(swing) * 8, ax = kx + Math.sin(swing - bend) * 8, ay = ky + Math.cos(swing - bend) * 8;
          return [kx, ky, ax, Math.min(ay, 26.6)];
        }
        const lift = (k === 0 ? step : -step) > 0 ? 2.2 : 0;
        return [hx - (k === 0 ? 0.3 : -0.3), hy + 8 - lift * 0.6, hx - (k === 0 ? 0.3 : -0.3), 26.6 - lift];
      };
      const drawLeg = k => {
        const [hx, hy] = hips[k], [kx, ky, ax, ay] = legPose(k), far = side && k === 0, c = far ? shade(legs, 0.8) : legs, f = far ? shade(feet, 0.8) : feet;
        if (!p.robe) { hdCapsule(g, hx, hy, 2.6, kx, ky, 2.1, c); hdCapsule(g, kx, ky, 2.1, ax, ay - 1.5, 1.6, c); }
        // the boot: a shaft and a foot pointing the way it faces
        const toe = side ? 3.2 : 0, fy = ay + 2.4;
        if (p.robe) hdShape(g, [ax - 1.8, fy - 1.8, ax + 1.6 + toe * 0.7, fy - 1.6, ax + 1.8 + toe * 0.7, fy + 0.4, ax - 1.9, fy + 0.4], f, ax - 1.9, ax + 1.8 + toe); // (only the toes, under the hem)
        else {
          hdShape(g, [ax - 2.2, ay - 3.6, ax + 2.2, ay - 3.6, ax + 2.4 + toe, fy - 0.4, ax + 2 + toe, fy + 0.4, ax - 2.3, fy + 0.4, ax - 2.4, fy - 1.2], f, ax - 2.4, ax + 2.4 + toe);
          rect(g, shade(f, 1.35), ax - 2, ay - 3.6, 3.6, 0.7); // the boot's cuff, lit
        }
      };
      if (side) { drawLeg(0); } else { drawLeg(0); drawLeg(1); }
      // ---- arms behind the body (the far arm from the side)
      const shoulderY = -1.2;
      const armPose = k => { // shoulder, elbow, wrist of arm k (0: left on screen / far, 1: right / near)
        if (side) {
          const sw = (k === 1 ? -step : step) * 0.45, sx = k === 1 ? 16.6 : 15.4;
          const ex = sx + Math.sin(sw) * 7, ey = shoulderY + 0.6 + Math.cos(sw) * 7, wx = ex + Math.sin(sw + 0.25) * 6.4, wy = ey + Math.cos(sw + 0.25) * 6.4;
          return [sx, shoulderY + 0.6, ex, ey, wx, wy];
        }
        const sgn = k === 0 ? -1 : 1, sx = 16 + sgn * 6.9 * wide, swing = (k === 0 ? -step : step) * 2;
        return [sx, shoulderY + 0.8, sx + sgn * 1.1, 6.4 - swing * 0.3, sx + sgn * 0.6, 12.6 - swing];
      };
      const drawArm = k => {
        const [sx, sy, ex, ey, wx, wy] = armPose(k), far = side && k === 0, c = far ? shade(arms, 0.8) : arms;
        hdCapsule(g, sx, sy, 2.1, ex, ey, 1.7, c);
        hdCapsule(g, ex, ey, 1.7, wx, wy, 1.4, p.armor && !p.bareArms ? shade(c, 1.08) : c);
        if (p.cuffs && !p.bareArms) hdCapsule(g, wx - (wx - ex) * 0.18, wy - (wy - ey) * 0.18, 1.55, wx, wy, 1.5, p.cuffs);
        hdFill(g, skin, wx - 1.6, wx + 1.6); g.beginPath(); g.ellipse(wx, wy + 1.3, 1.45, 1.7, 0, 0, Math.PI * 2); g.fill(); // the hand
        return [wx, wy + 1.4];
      };
      if (side) drawArm(0);
      // ---- the body: chest and shoulders down to the waist, the hips
      const W = 7.2 * wide, cx = 16;
      const torso = side ? [12.6, -2.6, 19.8, -2.6, 20.4, 3, 19.2, 10.5, 13.2, 10.5, 12.4, 3] : [cx - W, -2.8, cx + W, -2.8, cx + W - 0.4, 2.5, cx + 5, 10.5, cx - 5, 10.5, cx - W + 0.4, 2.5];
      hdShape(g, torso, body, side ? 12.4 : cx - W, side ? 20.4 : cx + W);
      if (!side) { hdShape(g, [cx - W + 0.6, -3.2, cx + W - 0.6, -3.2, cx + W, -1.6, cx - W, -1.6], shade(body, 1.08), cx - W, cx + W); } // the shoulders' curve
      const hipsShape = side ? [13.2, 10, 19.2, 10, 19.4, 13.6, 13, 13.6] : [cx - 5.2, 10, cx + 5.2, 10, cx + 5.6, 13.4, cx - 5.6, 13.4];
      if (!p.robe) hdShape(g, hipsShape, p.skirt || legs, side ? 13 : cx - 5.6, side ? 19.4 : cx + 5.6);
      // what's worn on the body
      if (p.vest && !side) { hdShape(g, [cx - W, -2.6, cx - 2, -2.6, cx - 2.6, 10, cx - 5, 10], p.vest, cx - W, cx - 2); hdShape(g, [cx + 2, -2.6, cx + W, -2.6, cx + 5, 10, cx + 2.6, 10], p.vest, cx + 2, cx + W); }
      if (p.stripes) for (const y of [0.5, 3.5, 6.5]) { g.save(); g.beginPath(); g.moveTo(torso[0], torso[1]); for (let i = 2; i < torso.length; i += 2) g.lineTo(torso[i], torso[i + 1]); g.closePath(); g.clip(); rect(g, p.stripes, 0, y, 32, 1.2); g.restore(); }
      if (p.armor) { // a breastplate shaped to the chest, a lit ridge down its middle
        const a = p.armor, pl = side ? [13, -2.2, 19.6, -2.2, 20, 3, 18.8, 9, 13.6, 9, 12.8, 3] : [cx - W + 0.6, -2.4, cx + W - 0.6, -2.4, cx + W - 0.8, 2.6, cx + 4.4, 9, cx - 4.4, 9, cx - W + 1, 2.6];
        hdShape(g, pl, a, side ? 12.8 : cx - W, side ? 20 : cx + W);
        if (front) { rect(g, shade(a, 1.4), cx - 0.4, -2, 0.8, 10.6); rect(g, shade(a, 0.72), cx + 0.4, -2, 0.6, 10.6); }
      }
      if (p.tabard && !side) { const t = p.tabard; hdShape(g, [cx - 3.4, -2.2, cx + 3.4, -2.2, cx + 3, 18, cx - 3, 18], t, cx - 3.4, cx + 3.4); if (front) { rect(g, shade(t, 1.5), cx - 0.6, 1, 1.2, 7); rect(g, shade(t, 1.5), cx - 2.4, 3, 4.8, 1.2); } }
      if (p.fur) { g.fillStyle = shade(body, 1.3); for (let x = side ? 12.6 : cx - W; x < (side ? 20 : cx + W); x += 1.6) { g.beginPath(); g.ellipse(x + 0.8, -2.2, 1.1, 1.5, 0, 0, Math.PI * 2); g.fill(); } }
      if (p.collar && !back) { if (side) hdShape(g, [16.4, -3.8, 19.4, -3.8, 19.6, -1.6, 16.2, -1.6], p.collar, 16, 20); else hdShape(g, [cx - 3.6, -3.6, cx + 3.6, -3.6, cx + 2.4, -0.6, cx, 0.6, cx - 2.4, -0.6], p.collar, cx - 3.6, cx + 3.6); }
      if (p.buttons && front) for (const y of [1.5, 4, 6.5]) { g.fillStyle = p.buttons; g.beginPath(); g.arc(cx, y, 0.55, 0, Math.PI * 2); g.fill(); }
      if (p.strap && !side) { g.strokeStyle = p.strap; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx - W + 1.4, -2.4); g.lineTo(cx + 4.6, 9.6); g.stroke(); }
      const beltColor = belt || (p.robe ? null : shade(legs, 0.55));
      if (beltColor) { hdShape(g, side ? [13.1, 9.2, 19.3, 9.2, 19.3, 10.9, 13.1, 10.9] : [cx - 5.2, 9.2, cx + 5.2, 9.2, cx + 5.3, 10.9, cx - 5.3, 10.9], beltColor, cx - 5.3, cx + 5.3); if (!back) rect(g, GOLD, side ? 18 : cx - 0.9, 9.4, 1.8, 1.3); }
      if (p.sash) hdShape(g, side ? [13.1, 8.8, 19.3, 8.8, 19.3, 10.6, 13.1, 10.6] : [cx - 5.4, 8.8, cx + 5.4, 8.8, cx + 5.4, 10.6, cx - 5.4, 10.6], p.sash, cx - 5.4, cx + 5.4);
      if (p.robe || p.coat || p.skirt) { // the skirts of a robe (to the feet), a coat (to the knees) or a skirt
        const c = p.robe || p.coat ? body : p.skirt, end = p.robe ? 27.2 : p.coat ? 19 : 18.5, flare = p.robe ? 2.4 : 1.2;
        const x0 = side ? 12.8 : cx - 5.4, x1 = side ? 19.6 : cx + 5.4, sk = [x0, 10.4, x1, 10.4, x1 + flare, end, x0 - flare, end];
        hdShape(g, sk, c, x0 - flare, x1 + flare);
        if (p.trim) rect(g, p.trim, x0 - flare + 0.2, end - 1.2, x1 - x0 + 2 * flare - 0.4, 1.2);
        if (p.robe && p.trim && front) rect(g, p.trim, cx - 0.6, 10.4, 1.2, end - 10.4);
        if (p.leaves) for (const [x, y] of [[cx - 3, 14], [cx + 2.5, 18], [cx - 1, 22], [cx + 3.5, 24]]) { g.fillStyle = p.leaves; g.beginPath(); g.ellipse(side ? x - 1 : x, y, 1.4, 0.8, 0.6, 0, Math.PI * 2); g.fill(); }
      }
      if (side) drawLeg(1); // the near leg, over the body's skirts from the side? (no: in front of the far side)
      if (p.backpack && back) { hdShape(g, [cx - 4.4, -1, cx + 4.4, -1, cx + 4.6, 8.4, cx - 4.6, 8.4], p.backpack, cx - 4.6, cx + 4.6); rect(g, shade(p.backpack, 0.7), cx - 4.4, 2.6, 8.8, 0.8); }
      if (p.quiver && !front) { hdShape(g, back ? [cx + 1, -4, cx + 4, -4, cx + 3, 8, cx, 8] : [12, -4, 14.6, -4, 14, 8, 11.4, 8], LEATHER, 11, 18); for (const k of [0, 1.2, 2.4]) rect(g, '#e8e0d0', (back ? cx + 1.2 : 12) + k, -6, 0.6, 2.4); }
      // ---- the arms in front of the body (both, or the near one)
      let handAt = null;
      if (side) handAt = drawArm(1); else { const l = drawArm(0); const r = drawArm(1); handAt = l; if (p.shield) later.push(() => hdShield(g, p.shield, r[0] + 0.6, r[1] - 6, false)); }
      if (back && p.cape) { const c = p.cape; hdShape(g, [cx - W - 0.6, -2.6, cx + W + 0.6, -2.6, cx + W + 2.6, 23, cx - W - 2.6, 23], c, cx - W - 2.6, cx + W + 2.6); }
      // ---- the neck and the head
      const hx = side ? 16.8 : cx, hy = -9.6;
      hdCapsule(g, side ? 16.6 : cx, -5.6, 1.5, side ? 16.6 : cx, -2.6, 1.6, shade(skin, 0.9));
      if (front && (hs === 'long' || hs === 'braids') && !hooded) for (const sx of [-1, 1]) hdShape(g, [hx + sx * 4.4, hy - 1, hx + sx * 3.4, hy - 1, hx + sx * 3.6, -1.4, hx + sx * 4.9, -0.8], hair, hx - 4.9, hx + 4.9); // locks over the shoulders
      hdFill(g, skin, hx - 4, hx + 4); g.beginPath(); // the head: a skull and a jaw narrowing to the chin
      if (side) { g.ellipse(hx - 0.3, hy, 3.9, 4.7, 0, 0, Math.PI * 2); g.fill(); hdShape(g, [hx + 2.6, hy - 1, hx + 4.6, hy + 0.6, hx + 3.4, hy + 1.2, hx + 3.6, hy + 3.4, hx + 1.4, hy + 4.9, hx, hy + 3], skin, hx, hx + 4.6); }
      else { g.moveTo(hx - 3.9, hy - 1); g.bezierCurveTo(hx - 4.1, hy - 7, hx + 4.1, hy - 7, hx + 3.9, hy - 1); g.bezierCurveTo(hx + 3.8, hy + 2.6, hx + 2, hy + 4.8, hx, hy + 5); g.bezierCurveTo(hx - 2, hy + 4.8, hx - 3.8, hy + 2.6, hx - 3.9, hy - 1); g.fill(); }
      if (!back && !side) for (const s of [-1, 1]) { g.fillStyle = shade(skin, s < 0 ? 1 : 0.8); g.beginPath(); g.ellipse(hx + s * 4, hy + 0.2, 0.8, 1.3, 0, 0, Math.PI * 2); g.fill(); } // the ears
      // the face
      const dark = '#24180f', brow = shade(hair === skin ? '#5a3a1e' : hair, 0.7);
      if (front) {
        for (const s of [-1, 1]) { rect(g, '#f2ece4', hx + s * 1.7 - 0.8, hy - 0.3, 1.6, 1); rect(g, p.eye || dark, hx + s * 1.7 - (s < 0 ? 0.1 : 0.5), hy - 0.3, 0.7, 1); rect(g, brow, hx + s * 1.7 - 1, hy - 1.4, 2, 0.6); }
        rect(g, shade(skin, 0.75), hx + 0.1, hy + 0.6, 0.7, 1.6);                    // the nose's shadow
        rect(g, female ? '#b85a50' : shade(skin, 0.58), hx - 1, hy + 2.8, 2, 0.55);   // the mouth
      } else if (side) {
        rect(g, '#f2ece4', hx + 1.6, hy - 0.3, 1.2, 1); rect(g, p.eye || dark, hx + 2.2, hy - 0.3, 0.6, 1); rect(g, brow, hx + 1.4, hy - 1.4, 1.8, 0.6);
        rect(g, shade(skin, 0.6), hx + 2.4, hy + 2.8, 1.2, 0.5);
        g.fillStyle = shade(skin, 0.8); g.beginPath(); g.ellipse(hx - 0.8, hy + 0.3, 0.9, 1.3, 0, 0, Math.PI * 2); g.fill(); // the ear
      }
      if (p.beard && !back) { const b = p.beard; if (front) hdShape(g, [hx - 3.9, hy + 0.4, hx - 2.6, hy + 2.2, hx - 1.2, hy + 2.1, hx + 1.2, hy + 2.1, hx + 2.6, hy + 2.2, hx + 3.9, hy + 0.4, hx + 3.2, hy + 3.6, hx, hy + 6.2, hx - 3.2, hy + 3.6], b, hx - 3.9, hx + 3.9); else hdShape(g, [hx - 0.6, hy + 1, hx + 1.4, hy + 2.2, hx + 3.6, hy + 2.6, hx + 2.8, hy + 4.8, hx + 0.6, hy + 5.8, hx - 1, hy + 3.4], b, hx - 1, hx + 3.6); if (front) rect(g, shade(skin, 0.5), hx - 1, hy + 2.8, 2, 0.5); }
      // the hair over the head
      if (hs !== 'bald' && !hooded) {
        if (back) { hdFill(g, hair, hx - 4.2, hx + 4.2); g.beginPath(); g.ellipse(hx, hy - 0.6, 4.25, 5.1, 0, 0, Math.PI * 2); g.fill(); if (hs === 'long' || hs === 'braids' || hs === 'wild') hdShape(g, [hx - 4.3, hy, hx + 4.3, hy, hx + 4.8, 1.5, hx - 4.8, 1.5], hair, hx - 4.8, hx + 4.8); }
        else if (side) hdShape(g, [hx - 4.3, hy - 1, hx - 3.4, hy - 4.6, hx - 0.6, hy - 5.8, hx + 2.4, hy - 5.2, hx + 3.9, hy - 3, hx + 3.4, hy - 1.8, hx + 1, hy - 2.6, hx - 0.6, hy - 1.6, hx - 1.6, hy + 1.6, hx - 3.4, hy + 3, hx - 4.3, hy + 1.4], hair, hx - 4.3, hx + 3.9);
        else hdShape(g, [hx - 4.2, hy + 0.6, hx - 4.3, hy - 3.2, hx - 2.4, hy - 5.6, hx + 0.6, hy - 6.1, hx + 3.2, hy - 5.1, hx + 4.4, hy - 2.6, hx + 4.2, hy + 0.6, hx + 3.4, hy - 2, hx + 1, hy - 3, hx - 1.6, hy - 2.4, hx - 3.4, hy - 2], hair, hx - 4.3, hx + 4.4);
        if (hs === 'ponytail' && !front) { const tx = back ? hx : hx - 4.2; hdCapsule(g, tx, hy - 1.4, 1.3, tx - (side ? 1.2 : 0), hy + 6.6, 0.9, shade(hair, 0.9)); }
        if (hs === 'wild') for (const [x, y] of [[-4.4, -3], [4.4, -3], [-2, -6.4], [2, -6.4]]) { g.fillStyle = shade(hair, 0.85); g.beginPath(); g.arc(hx + (side ? x * 0.8 - 0.6 : x), hy + y, 1.2, 0, Math.PI * 2); g.fill(); }
        // a lit streak on top
        g.strokeStyle = shade(hair, 1.35); g.lineWidth = 0.7; g.beginPath(); g.arc(hx - (side ? 0.6 : 0.8), hy - 1.6, 3.4, Math.PI * 1.15, Math.PI * 1.45); g.stroke();
      }
      if (hat) hdHat(g, hat, hx, hy, dir);
      // ---- held, and the shield in front
      if (p.held && !back && handAt) hdHeld(g, p.held, handAt[0], handAt[1], dir);
      for (const f of later) f();
    });
  }
  function hdShield(g, c, x, y, behind) {
    hdShape(g, [x - 3.6, y, x + 3.6, y, x + 3.6, y + 4.6, x, y + 8.6, x - 3.6, y + 4.6], behind ? shade(c, 0.75) : c, x - 3.6, x + 3.6);
    if (!behind) { rect(g, shade(c, 1.45), x - 0.5, y + 0.6, 1, 7); rect(g, shade(c, 1.45), x - 3, y + 2.6, 6, 1); g.fillStyle = GOLD; g.beginPath(); g.arc(x, y + 3.1, 0.9, 0, Math.PI * 2); g.fill(); }
  }
  // A hat on a large person's head, centred at (hx, hy).
  function hdHat(g, hat, hx, hy, dir) {
    const c = hat.color || '#8a8a92', acc = hat.accent || GOLD, st = hat.style, side = dir === 1 || dir === 3, back = dir === 0;
    const dome = (lift, down) => { hdFill(g, c, hx - 4.6, hx + 4.6); g.beginPath(); g.moveTo(hx - 4.6, hy + down); g.bezierCurveTo(hx - 4.9, hy - 7 - lift, hx + 4.9, hy - 7 - lift, hx + 4.6, hy + down); g.closePath(); g.fill(); };
    if (st === 'hood') {
      hdShape(g, [hx - 5, -3.2, hx - 5.2, hy - 1, hx - 3.4, hy - 5.6, hx, hy - 6.6, hx + 3.4, hy - 5.6, hx + 5.2, hy - 1, hx + 5, -3.2], c, hx - 5.2, hx + 5.2);
      if (!back) { g.fillStyle = shade(c, 0.4); g.beginPath(); if (side) g.ellipse(hx + 2, hy + 0.6, 2.2, 3.8, 0, 0, Math.PI * 2); else g.ellipse(hx, hy + 0.6, 3.4, 4.6, 0, 0, Math.PI * 2); g.fill(); }
      if (!back) { hdFill(g, '#e8b890', hx - 3, hx + 3); g.beginPath(); if (side) g.ellipse(hx + 2.3, hy + 1, 1.7, 3.2, 0, 0, Math.PI * 2); else g.ellipse(hx, hy + 1.2, 2.7, 3.7, 0, 0, Math.PI * 2); g.fill();
        if (!side) for (const s of [-1, 1]) rect(g, '#24180f', hx + s * 1.2 - 0.35, hy + 0.4, 0.7, 0.9); else rect(g, '#24180f', hx + 2.8, hy + 0.4, 0.6, 0.9); }
      hdShape(g, [hx - 7, -1, hx + 7, -1, hx + 6.4, 2.4, hx - 6.4, 2.4], c, hx - 7, hx + 7); // the mantle on the shoulders
      return;
    }
    if (st === 'helmet' || st === 'plume' || st === 'horned') {
      dome(0.4, -0.6); hdShape(g, [hx - 4.8, hy - 1.4, hx + 4.8, hy - 1.4, hx + 4.8, hy, hx - 4.8, hy], shade(c, 0.75), hx - 4.8, hx + 4.8);
      if (!back && !side) rect(g, shade(c, 0.7), hx - 0.5, hy - 1, 1, 3.6);
      if (st === 'plume') { hdFill(g, acc, hx - 1, hx + 3); g.beginPath(); g.moveTo(hx, hy - 6.6); g.bezierCurveTo(hx + 2, hy - 11, hx + 5, hy - 10, hx + 6, hy - 6); g.bezierCurveTo(hx + 3.6, hy - 8, hx + 2, hy - 7.6, hx + 1, hy - 6); g.closePath(); g.fill(); }
      if (st === 'horned') for (const s of [-1, 1]) { g.strokeStyle = acc; g.lineWidth = 1.6; g.beginPath(); g.moveTo(hx + s * 3.8, hy - 3.6); g.quadraticCurveTo(hx + s * 7, hy - 5, hx + s * 6.4, hy - 9); g.stroke(); }
      return;
    }
    if (st === 'crown') { hdShape(g, [hx - 3.8, hy - 4.2, hx + 3.8, hy - 4.2, hx + 3.8, hy - 2.2, hx - 3.8, hy - 2.2], GOLD, hx - 3.8, hx + 3.8); for (const k of [-3, 0, 3]) hdShape(g, [hx + k - 1.2, hy - 4.2, hx + k + 1.2, hy - 4.2, hx + k, hy - 7], '#f0d040', hx + k - 1.2, hx + k + 1.2); rect(g, '#d83a3a', hx - 0.6, hy - 3.8, 1.2, 1.2); return; }
    if (st === 'pointy') { hdShape(g, [hx - 7.4, hy - 2.6, hx + 7.4, hy - 2.6, hx + 6, hy - 1.2, hx - 6, hy - 1.2], shade(c, 0.75), hx - 7.4, hx + 7.4); hdShape(g, [hx - 4.4, hy - 2.6, hx + 4.4, hy - 2.6, hx + 2.4, hy - 9, hx + 4.6, hy - 14], c, hx - 4.4, hx + 4.6); rect(g, acc, hx - 4.2, hy - 3.6, 8.4, 1); return; }
    if (st === 'bandana') { dome(-1.2, -2); hdShape(g, [hx - 4.4, hy - 2.6, hx + 4.4, hy - 2.6, hx + 4.4, hy - 1.4, hx - 4.4, hy - 1.4], shade(c, 0.8), hx - 4.4, hx + 4.4); if (back || side) hdShape(g, [hx - (side ? 4 : 0.6), hy - 2, hx - (side ? 6 : -0.6), hy + 1.4, hx - (side ? 5 : 1.6), hy + 1.6], c, hx - 6, hx); return; }
    if (st === 'antlers') { g.strokeStyle = c; g.lineWidth = 1.1; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(hx + s * 2.6, hy - 4.6); g.lineTo(hx + s * 5, hy - 9); g.lineTo(hx + s * 7, hy - 11); g.moveTo(hx + s * 4.2, hy - 7.6); g.lineTo(hx + s * 7, hy - 7.4); g.moveTo(hx + s * 5, hy - 9); g.lineTo(hx + s * 4.4, hy - 12); g.stroke(); } return; }
    // hats with a brim: wide, tricorn, hunter's, feathered
    const brim = st === 'wide' || st === 'tricorn' ? 7.8 : 5.6;
    hdFill(g, shade(c, 0.85), hx - brim, hx + brim); g.beginPath(); g.ellipse(hx, hy - 3.4, brim, st === 'tricorn' ? 2.4 : 1.8, 0, 0, Math.PI * 2); g.fill();
    hdShape(g, [hx - 3.8, hy - 3.6, hx + 3.8, hy - 3.6, hx + 3.4, hy - 8, hx - 3.4, hy - 8], c, hx - 3.8, hx + 3.8);
    rect(g, acc === GOLD ? shade(c, 0.6) : acc, hx - 3.8, hy - 4.8, 7.6, 1.1);
    if (st === 'feather' || st === 'hunter') { hdFill(g, hat.accent || '#f4f0e8', hx + 2, hx + 7); g.beginPath(); g.moveTo(hx + 2.6, hy - 6); g.bezierCurveTo(hx + 4, hy - 12, hx + 7, hy - 12, hx + 7.4, hy - 10.6); g.bezierCurveTo(hx + 5.6, hy - 10, hx + 4.4, hy - 8, hx + 3.6, hy - 5.6); g.closePath(); g.fill(); }
  }
  // What a large person holds, in the hand at (x, y).
  function hdHeld(g, kind, x, y, dir) {
    const steel = '#dde2ea', steelDark = '#8e949e', wood = '#7a5030';
    if (kind === 'sword' || kind === 'sabre') {
      hdCapsule(g, x, y + 0.6, 0.55, x, y - 1.6, 0.55, '#5a3a1e');                                              // the grip
      hdShape(g, [x - 2.4, y - 2.1, x + 2.4, y - 2.1, x + 2.4, y - 1.1, x - 2.4, y - 1.1], GOLD, x - 2.4, x + 2.4); // the crossguard
      if (kind === 'sabre') hdShape(g, [x - 0.8, y - 2.2, x + 0.8, y - 2.2, x + 2.6, y - 10, x + 1.8, y - 15, x + 0.6, y - 10], steel, x - 0.8, x + 2.6);
      else hdShape(g, [x - 0.9, y - 2.2, x + 0.9, y - 2.2, x + 0.9, y - 14, x, y - 15.6, x - 0.9, y - 14], steel, x - 0.9, x + 0.9);
      rect(g, steelDark, x + 0.2, y - 13.6, 0.5, 11.2);
    } else if (kind === 'axe' || kind === 'greataxe') {
      hdCapsule(g, x, y + 2.4, 0.6, x, y - 12, 0.6, wood);
      hdShape(g, [x + 0.4, y - 12, x + 4.6, y - 13.4, x + 4.6, y - 7.4, x + 0.4, y - 8.8], steel, x, x + 4.6);
      if (kind === 'greataxe') hdShape(g, [x - 0.4, y - 12, x - 4.6, y - 13.4, x - 4.6, y - 7.4, x - 0.4, y - 8.8], steel, x - 4.6, x);
    } else if (kind === 'staff' || kind === 'leafstaff') {
      hdCapsule(g, x, y + 8, 0.6, x, y - 20, 0.6, wood);
      const top = kind === 'leafstaff' ? '#4aa040' : '#86d8ff';
      hdFill(g, top, x - 1.8, x + 1.8); g.beginPath(); g.arc(x, y - 21.4, 1.8, 0, Math.PI * 2); g.fill();
      if (kind === 'leafstaff') for (const s of [-1, 1]) { g.fillStyle = '#5ab048'; g.beginPath(); g.ellipse(x + s * 2.2, y - 19.4, 1.6, 0.8, s * 0.6, 0, Math.PI * 2); g.fill(); }
    } else if (kind === 'bow' || kind === 'crossbow') {
      g.strokeStyle = '#8a5a2e'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y - 9); g.quadraticCurveTo(x + 4, y - 1, x, y + 7); g.stroke();
      g.strokeStyle = '#ece4d4'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x, y + 7); g.stroke();
    } else { hdCapsule(g, x, y + 1, 0.6, x, y - 8, 1.4, '#6a4422'); }
  }

  // ---- people: the figure (Sprites.PEOPLE 'art') ------------------------------------------------------------------
  // Pixel art a little over a tile tall (35 pixels, a head of 10: grown up, not a doll), put together from parts drawn
  // pixel by pixel for each view (ART: a head, a body with its arms, legs; front, back, side), in a walk of four
  // beats over two steps (see visual(): a stride with one leg ahead, the legs passing, a stride with the other): the
  // body dips a pixel in a stride, the arms swing against the legs. Letters are the look's colours worked out in light
  // and shade (lit from the top left); what the look wears and holds goes on top. The feet stand at (16, 29); the
  // head reaches 6 above the tile, so the picture is a big one. 20 columns, the middle between 9 and 10.
  //   h hair  j its light  H its shade    s skin  z its light  S its shade   e eye   m mouth
  //   b body  c its light  B its shade    a arm  A its shade   g hand  G its shade   t belt  T buckle
  //   l legs  k their light  L their shade    f feet  F their shade
  const ART = {
    headFront: [
      '........hhhh........', '......hhjjjhhH......', '.....hhjjhhhhhH.....', '....hhjhhhhhhhhH....',
      '....hhhjhhhhhhhH....', '....hzzsssssssSH....', '....hzsesssesSSH....', '....hzssssSssSSH....',
      '.....zssmmmssS......', '......SsssssS.......', '........sSS.........',
    ],
    headBack: [
      '........hhhh........', '......hhjjjhhH......', '.....hhjjhhhhhH.....', '....hhjhhhhhhhhH....',
      '....hhhjhhhhhhhH....', '....hhhhhhhhhhHH....', '....hhhhhhhhhhHH....', '....hhhhhhhhhHHH....',
      '.....HhhhhhhhHH.....', '......SsssssS.......', '........sSS.........',
    ],
    headSide: [
      '.......hhhh.........', '.....hhjjjhhh.......', '....hhjjhhhhhh......', '....hjhhhhhhhhH.....',
      '....hhhhhhzzssS.....', '....hhhhhSzssss.....', '....HhhhSssssesS....', '....HHhhSssssssz....',
      '.....HHhSssssmS.....', '......HSssssS.......', '.........sS.........',
    ],
    torsoFront: [
      '....ccbbbbbbbbBB....', '...accbbbbbbbbbBA...', '..aacbbbbbbbbbbBAA..', '..aacbbbbbbbbbBBAA..',
      '..aa.cbbbbbbbbB.AA..', '..aa.cbbbbbbbBB.AA..', '..aa.cbbbbbbbBB.AA..', '..AA.cbbbbbbbBB.AA..',
      '..gg.ttttTttttt.gg..', '..gg.llllllllLL.gg..', '....lllllllllLL.....',
    ],
    torsoSide: [
      '.......cbbbbB.......', '......cbbbbbbB......', '......cbbaabbB......', '......cbbaAbbB......',
      '......cbbaAbbB......', '......cbbaAbbB......', '......cbbaAbBB......', '......cbbAAbBB......',
      '......ttttgtTt......', '......lllgGlLL......', '......llllllLL......',
    ],
    torsoSideBack: [
      '.......cbbbbB.......', '......cbbbbbbB......', '......cbaabbbB......', '......caAbbbbB......',
      '.....aaAbbbbbB......', '.....aAcbbbbbB......', '....aA.cbbbbBB......', '....gG.cbbbbBB......',
      '......ttttttTt......', '......llllllLL......', '......llllllLL......',
    ],
    torsoSideFore: [
      '.......cbbbbB.......', '......cbbbbbbB......', '......cbbaabbB......', '......cbbbaAbB......',
      '......cbbbbaAB......', '......cbbbbbaA......', '......cbbbbBBaA.....', '......cbbbbBB.gG....',
      '......ttttttTt.gG...', '......llllllLL......', '......llllllLL......',
    ],
    legsFront: [
      '.....lllL..llLL.....', '.....lllL..llLL.....', '.....lllL..llLL.....', '.....lllL..llLL.....',
      '.....lllL..llLL.....', '.....lklL..lkLL.....', '.....lllL..llLL.....', '.....lllL..llLL.....',
      '.....fffF..ffFF.....', '.....fffF..ffFF.....', '.....fffF..ffFF.....', '....ffffF..fffFF....',
      '....FFFFF..FFFFF....',
    ],
    legsFrontStep: [
      '.....lllL..llLL.....', '.....lllL..llLL.....', '.....lllL..llLL.....', '.....lllL..llLL.....',
      '.....lllL..llLL.....', '.....lklL..ffFF.....', '.....lllL..ffFF.....', '.....lllL..ffFF.....',
      '.....fffF..fffFF....', '.....fffF..FFFFF....', '.....fffF...........', '....ffffF...........',
      '....FFFFF...........',
    ],
    legsSide: [
      '.......lllllL.......', '.......lllllL.......', '.......lllllL.......', '.......lllllL.......',
      '.......lklllL.......', '.......lllllL.......', '.......lllllL.......', '.......lllllL.......',
      '.......ffffffF......', '.......ffffffF......', '.......ffffffF......', '.......fffffffF.....',
      '.......FFFFFFFF.....',
    ],
    legsSideStep: [
      '.......lllllL.......', '......LLllllL.......', '......LL.llllL......', '.....LL...llllL.....',
      '.....LL...lllL......', '....LL.....lllL.....', '....LL.....llllL....', '...LL.......lllL....',
      '..FFF.......ffffF...', '..FFFF......fffffF..', '..FFFF......ffffffF.', '..FFFF......FFFFFFF.',
    ],
  };
  const ART_ROW0 = -6, ART_COL0 = 6, ART_RISE = 6; // where row 0 and column 0 go on the picture; how far above its tile the head reaches
  const artable = p => p && !p.ribs && !p.wings && !p.tail && !p.oneEye && !p.bigEyes && !p.horns && !(p.scale && p.scale !== 1);
  // a row mirrored, its legs shaded again from the left (light) to the right (shade)
  const artMirror = row => {
    const r = [...row].reverse();
    for (let i = 0; i < r.length;) {
      const kind = 'lLk'.includes(r[i]) ? 'l' : 'fF'.includes(r[i]) ? 'f' : null;
      if (!kind) { i++; continue; }
      let j = i; while (j < r.length && (kind === 'l' ? 'lLk' : 'fF').includes(r[j])) j++;
      const allDark = r.slice(i, j).every(c => c === 'F');
      for (let x = i; x < j; x++) if (!allDark && r[x] !== 'k') r[x] = x >= j - (j - i > 3 ? 2 : 1) ? kind.toUpperCase() : kind;
      i = j;
    }
    return r.join('');
  };
  function artPerson(g0, p, dir, frame) {
    shadow(g0, 16, 29, 7.5, 2.8);
    outlined(g0, g => {
      if (dir === 3) { g.translate(32, 0); g.scale(-1, 1); } // a west view is the east one mirrored
      const front = dir === 2, back = dir === 0, side = !front && !back, step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
      const hs = p.hairStyle || 'short', hat = p.hat || null, hooded = hat && hat.style === 'hood', bald = hs === 'bald' || hooded;
      const skin = p.skin || '#f0c090', hair = p.hair || shade(skin, 0.6), body = p.body || '#6a6a72', arms = p.arms || body;
      const legs = p.legs || body, feet = p.feet || shade(legs, 0.6);
      const C = {
        h: bald ? skin : hair, j: bald ? shade(skin, 1.12) : shade(hair, 1.35), H: bald ? shade(skin, 0.8) : shade(hair, 0.66),
        s: skin, z: shade(skin, 1.12), S: shade(skin, 0.8), e: p.eye || '#1c120c', m: p.female ? '#b0504a' : shade(skin, 0.58),
        b: body, c: shade(body, 1.24), B: shade(body, 0.72), a: arms, A: shade(arms, 0.72), g: skin, G: shade(skin, 0.8),
        t: p.sash || p.belt || shade(legs, 0.5), T: GOLD, l: legs, k: shade(legs, 1.25), L: shade(legs, 0.7), f: feet, F: shade(feet, 0.62),
      };
      // ---- put the parts together: the legs, then the body and head over them (a pixel lower in a stride)
      const grid = Array.from({ length: 36 }, () => Array(20).fill('.'));
      const lay = (rows, top) => rows.forEach((r, i) => [...r].forEach((ch, x) => { if (ch !== '.' && grid[top + i]) grid[top + i][x] = ch; }));
      const bob = step ? 1 : 0;
      let legRows;
      if (side) legRows = step ? (step > 0 ? ART.legsSideStep : ART.legsSideStep.map(r => [...r].map((ch, x) => (x < 9 ? { L: 'l', F: 'f' }[ch] || ch : { l: 'L', f: 'F', k: 'L' }[ch] || ch)).join(''))) : ART.legsSide;
      else legRows = step ? (step > 0 ? ART.legsFrontStep : ART.legsFrontStep.map(artMirror)) : ART.legsFront;
      lay(legRows, 35 - legRows.length);
      let torso = side ? (step > 0 ? ART.torsoSideBack : step < 0 ? ART.torsoSideFore : ART.torsoSide) : ART.torsoFront;
      if (!side && step) { // the arm on the side of the leg ahead swings back (shorter), the other forward (longer)
        torso = torso.map(r => [...r]);
        const [backCols, foreCols] = step > 0 ? [[2, 3], [16, 17]] : [[16, 17], [2, 3]];
        for (const x of backCols) { torso[9][x] = '.'; torso[7][x] = 'g'; }
        for (const x of foreCols) torso[10][x] = 'g';
        torso = torso.map(r => r.join(''));
      }
      if (back) torso = torso.map(r => r.replace('T', 't'));
      lay(torso, 11 + bob);
      lay(front ? ART.headFront : back ? ART.headBack : ART.headSide, bob);
      const H = bob, T = 11 + bob; // the head's top row, the body's
      const at = (x, y) => (grid[y] || [])[x], set = (x, y, ch) => { if (grid[y] && x >= 0 && x < 20) grid[y][x] = ch; };
      const fill = (x0, x1, y, ch, only) => { for (let x = x0; x <= x1; x++) if (!only || only.includes(at(x, y))) set(x, y, ch); };
      const recolor = (y0, y1, map) => { for (let y = y0; y <= y1; y++) for (let x = 0; x < 20; x++) if (map[at(x, y)]) set(x, y, map[at(x, y)]); };
      // ---- what it wears, in layers
      if (!bald && (hs === 'long' || hs === 'braids' || hs === 'wild')) { // hair to the shoulders and down the back
        if (front) for (let y = H + 5; y <= H + 13; y++) { if ('.aAcbB'.includes(at(4, y))) set(4, y, 'h'); if ('.aAcbB'.includes(at(15, y))) set(15, y, 'H'); }
        else if (back) for (let y = H + 8; y <= H + 16; y++) fill(5, 14, y, y > H + 14 ? 'H' : 'h', 'hHjSscbBs');
        else for (let y = H + 4; y <= H + 13; y++) { set(4, y, 'H'); if (y > H + 5 && at(5, y) === '.') set(5, y, 'h'); }
      }
      if (!bald && hs === 'ponytail') { if (back) for (let y = H + 8; y <= H + 16; y++) { set(9, y, 'h'); set(10, y, 'H'); } else if (side) for (let y = H + 5; y <= H + 12; y++) set(3, y, y > H + 8 ? 'H' : 'h'); }
      if (p.beard && !back) {
        C.r = p.beard; C.R = shade(p.beard, 0.72);
        if (front) { set(5, H + 6, 'r'); set(14, H + 6, 'R'); fill(5, 6, H + 7, 'r'); fill(13, 14, H + 7, 'R'); fill(5, 13, H + 8, 'r'); fill(8, 10, H + 8, 'm'); fill(6, 12, H + 9, 'r'); fill(8, 10, H + 10, 'R'); }
        else { fill(10, 14, H + 7, 'r', 'sSz'); fill(9, 14, H + 8, 'r', 'sSzm'); fill(9, 13, H + 9, 'R', 'sSzH'); fill(10, 12, H + 10, 'R'); }
      }
      if (p.armor) { // a breastplate, lit down its middle, and shoulder plates
        C.p = p.armor; C.P = shade(p.armor, 0.68); C.y = shade(p.armor, 1.32);
        recolor(T, T + 7, { b: 'p', c: 'y', B: 'P' });
        if (front || back) { fill(2, 5, T, 'y'); fill(2, 5, T + 1, 'p'); fill(14, 17, T, 'p'); fill(14, 17, T + 1, 'P'); if (front) for (let y = T + 1; y <= T + 7; y++) set(9, y, 'y'); }
        else { fill(8, 11, T, 'y'); fill(8, 11, T + 1, 'p'); }
      }
      if (p.vest && !side) { C.v = p.vest; C.V = shade(p.vest, 0.72); for (let y = T + 1; y <= T + 7; y++) { fill(5, 6, y, 'v', 'bcB'); fill(13, 14, y, 'V', 'bcB'); } }
      if (p.stripes) { C.x = p.stripes; for (const y of [T + 2, T + 4, T + 6]) recolor(y, y, { b: 'x', c: 'x', B: 'x' }); }
      if (p.tabard && !side) {
        C.d = p.tabard; C.D = shade(p.tabard, 0.72); C.n = shade(p.tabard, 1.5);
        for (let y = T + 1; y <= T + 16; y++) { fill(8, 10, y, 'd'); set(11, y, 'D'); }
        if (front) { for (let y = T + 2; y <= T + 6; y++) fill(9, 10, y, 'n'); fill(8, 11, T + 3, 'n'); }
      }
      if (p.collar && !back) { C.u = p.collar; C.U = shade(p.collar, 0.8); if (front) { fill(7, 12, T, 'u'); set(12, T, 'U'); } else fill(10, 12, T, 'u'); }
      if (p.fur) { C.w = shade(body, 1.3); C.W = shade(body, 0.92); for (let x = 3; x <= 16; x++) { if (at(x, T) !== '.') set(x, T, x % 2 ? 'w' : 'W'); if (at(x, T + 1) !== '.' && x % 3 === 0) set(x, T + 1, 'w'); } }
      if (p.cuffs && !p.bareArms) { C.q = p.cuffs; recolor(T + 7, T + 7, { a: 'q', A: 'q' }); }
      if (p.strap && !side) { C.Y = p.strap; for (let k = 0; k <= 8; k++) set(5 + k, T + k, 'Y'); }
      if (p.robe || p.coat || p.skirt) { // a robe to the ankles, a coat to the knees, or a skirt, widening as it goes down
        const c = p.robe || p.coat ? body : p.skirt; C.o = c; C.O = shade(c, 0.72); C.Q = p.trim || shade(c, 1.3);
        const end = p.robe ? 33 : p.coat ? 28 : 27, x0 = side ? 7 : 5, x1 = side ? 13 : 14;
        for (let y = T + 9; y <= end; y++) {
          const sp = Math.floor((y - T - 9) / 4);
          for (let x = x0 - sp; x <= x1 + sp; x++) set(x, y, y === end && p.trim ? 'Q' : x >= x1 + sp - 1 ? 'O' : 'o');
        }
        if (p.robe && p.trim && front) for (let y = T + 9; y < end; y++) set(9, y, 'Q');
        if (p.leaves) { C.V2 = p.leaves; for (const [x, y] of [[7, 24], [12, 27], [9, 30], [6, 31]]) set(side ? x + 1 : x, y, 'Z'); C.Z = p.leaves; }
      }
      if (p.cape) { // all of it from the back; its edges at the sides from the front; behind the body from the side
        C.i = p.cape; C.I = shade(p.cape, 0.66);
        if (back) for (let y = T; y <= 31; y++) { const sp = Math.floor((y - T) / 6); fill(3 - sp, 16 + sp, y, y === 31 ? 'I' : 'i'); for (let x = 14 + sp; x <= 16 + sp; x++) set(x, y, 'I'); }
        else if (front) for (let y = T + 1; y <= 30; y++) { if (at(1, y) === '.') set(1, y, 'I'); if (at(18, y) === '.') set(18, y, 'I'); }
        else for (let y = T; y <= 31; y++) for (let x = 3; x <= 6; x++) if (at(x, y) === '.') set(x, y, 'I');
      }
      if (p.backpack && back) { C.N = p.backpack; C.M = shade(p.backpack, 0.68); for (let y = T + 1; y <= T + 7; y++) fill(6, 13, y, y === T + 4 ? 'M' : 'N'); fill(12, 13, T + 1, 'M'); }
      if (p.quiver && !front) { C.Y = LEATHER; C.W2 = '#ece4d4'; const qx = back ? 13 : 5; for (let y = T - 2; y <= T + 7; y++) { set(qx, y, 'Y'); set(qx + 1, y, 'Y'); } set(qx, T - 3, 'X'); set(qx + 1, T - 4, 'X'); C.X = '#ece4d4'; }
      // ---- the picture
      grid.forEach((row, y) => row.forEach((ch, x) => { if (ch !== '.' && C[ch]) rect(g, C[ch], ART_COL0 + x, ART_ROW0 + y, 1, 1); }));
      const X = col => ART_COL0 + col, Y = row => ART_ROW0 + row;
      if (hat) artHat(g, hat, dir, X, Y, H);
      // what it holds, in its right hand (the hand on the left of the picture from the front; the near one from the side)
      const hand = front ? [2.5, T + 9 + (step < 0 ? 1 : step > 0 ? -1 : 0)] : side ? (step > 0 ? [4.5, T + 7] : step < 0 ? [15.5, T + 8] : [10, T + 9]) : null;
      if (p.held && hand) artHeld(g, p.held, X(hand[0]), Y(hand[1]));
      if (p.shield && (front || back || dir === 3)) artShield(g, p.shield, X(front ? 16 : back ? 1 : 12), Y(T + 3), back);
    });
  }
  function artShield(g, c, x, y, behind) {
    const lit = shade(c, 1.3), dk = shade(c, 0.66);
    for (let r = 0; r < 9; r++) { const w = r < 5 ? 5 : 5 - (r - 4) * 1.2; for (let k = 0; k < w; k++) rect(g, behind ? dk : k === 0 ? lit : k >= w - 1 ? dk : c, Math.round(x - w / 2 + k), y + r, 1, 1); }
    if (!behind) { rect(g, GOLD, x - 0.5, y + 1, 1, 6); rect(g, GOLD, x - 2, y + 3, 4, 1); }
  }
  // A hat on the figure's head (H: the head's top row; X, Y: columns and rows to the picture).
  function artHat(g, hat, dir, X, Y, H) {
    const c = hat.color || '#8a8a92', lit = shade(c, 1.3), dk = shade(c, 0.68), acc = hat.accent || GOLD, st = hat.style;
    const front = dir === 2, back = dir === 0, side = !front && !back;
    const row = (y, x0, x1, col) => { for (let x = x0; x <= x1; x++) rect(g, typeof col === 'function' ? col(x) : col, X(x), Y(H + y), 1, 1); };
    const ld = (x0, x1) => x => (x <= x0 + 1 ? lit : x >= x1 - 1 ? dk : c);
    if (st === 'hood') {
      row(-1, 7, 12, ld(7, 12)); row(0, 5, 14, ld(5, 14)); row(1, 4, 15, ld(4, 15)); row(2, 3, 16, ld(3, 16));
      for (let y = 3; y <= 9; y++) { if (back) row(y, 3, 16, ld(3, 16)); else if (side) row(y, 3, 9, ld(3, 9)); else { row(y, 3, 4, lit); row(y, 15, 16, dk); } }
      if (front) row(3, 5, 14, shade(c, 0.42));
      row(10, 2, 17, ld(2, 17)); row(11, 2, 17, dk);
      return;
    }
    if (st === 'helmet' || st === 'plume' || st === 'horned') {
      row(-1, 7, 12, ld(7, 12)); row(0, 5, 14, ld(5, 14)); row(1, 4, 15, ld(4, 15)); row(2, 4, 15, ld(4, 15)); row(3, 4, 15, dk);
      if (front) { row(4, 9, 10, dk); row(5, 9, 10, dk); } else if (side) row(4, 12, 13, dk);
      if (st === 'plume') { for (let y = -5; y <= -1; y++) row(y, 9 + (y < -3 ? 1 : 0), 10 + (y < -3 ? 1 : 0), y < -3 ? shade(acc, 1.2) : acc); }
      if (st === 'horned') for (const [x, y] of [[3, 1], [2, 0], [2, -1], [2, -2], [16, 1], [17, 0], [17, -1], [17, -2]]) rect(g, acc, X(x), Y(H + y), 1, 1);
      return;
    }
    if (st === 'crown') { row(1, 5, 14, GOLD); row(2, 5, 14, shade(GOLD, 0.78)); for (const x of [5, 8, 11, 14]) rect(g, '#f2d24a', X(x), Y(H), 1, 1); rect(g, '#d83a3a', X(9), Y(H + 1), 2, 1); return; }
    if (st === 'pointy') { for (let y = -7; y <= 1; y++) { const half = Math.max(0, Math.floor((y + 7) / 1.6)); row(y, 10 - half, 9 + half, ld(10 - half, 9 + half)); } row(2, 1, 18, dk); row(1, 4, 15, acc); return; }
    if (st === 'bandana') { row(1, 4, 15, c); row(2, 4, 15, dk); if (!front) { rect(g, c, X(back ? 9 : 3), Y(H + 3), 1, 3); rect(g, dk, X(back ? 10 : 2), Y(H + 4), 1, 2); } return; }
    if (st === 'antlers') { for (const [x, y] of [[6, 1], [5, 0], [4, -1], [3, -2], [5, -2], [4, -3], [2, -1], [13, 1], [14, 0], [15, -1], [16, -2], [14, -2], [15, -3], [17, -1]]) rect(g, c, X(x), Y(H + y), 1, 1); return; }
    // a hat with a brim: wide, tricorn, hunter's, feathered
    const wideBrim = st === 'wide' || st === 'tricorn';
    row(-2, 7, 12, ld(7, 12)); row(-1, 6, 13, ld(6, 13)); row(0, 6, 13, ld(6, 13)); row(1, 5, 14, acc === GOLD ? shade(c, 0.55) : acc);
    row(2, wideBrim ? 1 : 3, wideBrim ? 18 : 16, dk); if (st === 'tricorn') { rect(g, dk, X(1), Y(H + 1), 1, 1); rect(g, dk, X(18), Y(H + 1), 1, 1); }
    if (st === 'feather' || st === 'hunter') for (const [x, y] of [[14, 0], [15, -1], [16, -2], [16, -3], [17, -4]]) rect(g, hat.accent || '#f4f0e8', X(x), Y(H + y), 1, 1);
  }
  // What the figure holds, its hand at (x, y) on the picture.
  function artHeld(g, kind, x, y) {
    const px = (dx, dy, c) => rect(g, c, Math.round(x + dx), Math.round(y + dy), 1, 1), up = (dx, y0, y1, c) => { for (let k = y0; k <= y1; k++) px(dx, k, c); };
    if (kind === 'sword' || kind === 'sabre') {
      up(0, -14, -2, '#e2e6ee'); up(1, -13, -2, '#9aa0aa'); if (kind === 'sabre') { px(1, -14, '#e2e6ee'); px(2, -15, '#e2e6ee'); }
      for (let k = -2; k <= 3; k++) px(k, -1, k === -2 || k === 3 ? '#a87818' : GOLD); up(0, 0, 1, '#5a3a1e'); px(1, 0, '#3e2610'); px(0, 2, GOLD);
    } else if (kind === 'axe' || kind === 'greataxe') {
      up(0, -12, 3, '#7a5030'); up(1, -12, 3, '#4e3018');
      for (let k = -12; k <= -6; k++) { px(2, k, '#cdd2da'); px(3, k, k === -12 || k === -6 ? '#8a8e96' : '#b4b8c0'); if (k > -11 && k < -7) px(4, k, '#8a8e96'); }
      if (kind === 'greataxe') for (let k = -12; k <= -6; k++) { px(-1, k, '#cdd2da'); px(-2, k, k === -12 || k === -6 ? '#8a8e96' : '#b4b8c0'); if (k > -11 && k < -7) px(-3, k, '#8a8e96'); }
    } else if (kind === 'staff' || kind === 'leafstaff') {
      up(0, -20, 6, '#8a5a34'); up(1, -19, 6, '#5a3a1e');
      const [c1, c2] = kind === 'leafstaff' ? ['#5ab048', '#3a8030'] : ['#a8e8ff', '#3a9ae0'];
      for (const [dx, dy, c] of [[0, -23, c1], [-1, -22, c1], [0, -22, c1], [1, -22, c2], [0, -21, c2], [-1, -21, c1], [1, -21, c2]]) px(dx, dy, c);
    } else if (kind === 'bow' || kind === 'crossbow') {
      for (let k = -11; k <= 6; k++) px(Math.round(Math.abs(k + 2.5) / 4.5) - 2, k, '#8a5a2e'); up(1, -10, 5, '#ece4d4');
    } else { up(0, -9, 1, '#7a5030'); up(1, -9, 1, '#4e3018'); for (const [dx, dy] of [[-1, -9], [-1, -8], [2, -9], [2, -8], [0, -10], [1, -10]]) px(dx, dy, '#5a3a1e'); }
  }

  // ---- people in the world's own camera (Sprites.PEOPLE 'lean') -------------------------------------------------------
  // Like everything with height in the world, a person leans: its height runs up and to the left, a pixel for a pixel,
  // as a wall's does, so the head is up-left of the feet. Built from a few plain blocks (legs, body, arms, head, hair)
  // in the look's colours, lit from the top left (tops light, south faces as they are, east faces in shade), drawn at
  // a pixel per world pixel with a firm dark edge round the whole figure: chunky, simple, readable.
  const leanable = p => p && !p.ribs && !p.wings && !p.tail && !p.oneEye && !p.bigEyes && !p.horns && !(p.scale && p.scale !== 1);
  function leanPerson(g0, p, dir, frame) {
    const L = (u, v, z) => [u - z * HEIGHT, v - z * HEIGHT]; // a point of the figure on the picture (leaning as things do)
    const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    const skin = p.skin || '#f0c090', hair = p.hair || shade(skin, 0.6), body = p.body || '#6a6a72', arms = p.arms || body;
    const legs = p.legs || body, feet = p.feet || shade(legs, 0.6), hs = p.hairStyle || 'short', hat = p.hat || null;
    const hooded = hat && hat.style === 'hood', bald = hs === 'bald' || hooded;
    const U = 18, V = 24; // where the figure stands
    const parts = [];
    // a block in the figure's own frame: a across (to its right), b forward, w wide, d deep, from z0 to z1
    const block = (a, b, w, d, z0, z1, color, extra) => {
      const [du, dv] = turn(dir, a, b), [ww, dd] = dir === 1 || dir === 3 ? [d, w] : [w, d];
      parts.push({ key: du + dv + z0 * 0.001, draw: g => {
        const u0 = U + du - ww / 2, u1 = U + du + ww / 2, v0 = V + dv - dd / 2, v1 = V + dv + dd / 2;
        poly(g, shade(color, 0.7), [...L(u1, v0, z0), ...L(u1, v1, z0), ...L(u1, v1, z1), ...L(u1, v0, z1)]);  // east, in shade
        poly(g, color, [...L(u0, v1, z0), ...L(u1, v1, z0), ...L(u1, v1, z1), ...L(u0, v1, z1)]);             // south
        poly(g, shade(color, 1.22), [...L(u0, v0, z1), ...L(u1, v0, z1), ...L(u1, v1, z1), ...L(u0, v1, z1)]); // top, lit
        if (extra) extra(g, { u0, u1, v0, v1 });
      } });
    };
    // legs, stepping forward and back; boots
    for (const s of [-1, 1]) {
      const sw = step * s * 2.6;
      if (!p.robe) { block(s * 2.6, sw, 4.2, 4, 4, 15, legs); block(s * 2.6, sw + 0.8, 4.4, 5.6, 0, 4.4, feet); }
    }
    if (p.robe) { block(0, 0, 11.4, 7.6, 0.5, 16, body); if (p.trim) block(0, 0, 11.8, 8, 0.3, 2.4, p.trim); }
    else block(0, 0, 10, 5, 13, 16, p.skirt || legs); // the hips
    if (p.skirt) block(0, 0, 11, 6.4, 7, 16, p.skirt);
    // the body, a belt; arms swinging against the legs, and hands
    block(0, 0, 11, 6, 15.6, 28, p.armor || body);
    if (p.tabard && dir !== 1 && dir !== 3) block(0, dir === 2 ? 3 : -3, 4.6, 0.8, 11, 27, p.tabard);
    block(0, 0, 11.2, 6.2, 15.4, 17.4, p.sash || p.belt || shade(legs, 0.5));
    if (p.cape) block(0, -3.6, 12, 1.4, 5, 27.6, p.cape);
    for (const s of [-1, 1]) {
      const sw = -step * s * 2.4;
      block(s * 7.2, sw * 0.5, 3.4, 3.6, 19, 27.6, p.armor && !p.bareArms ? p.armor : p.bareArms ? skin : arms);
      block(s * 7.2, sw, 3.2, 3.4, 15, 19.4, p.bareArms ? skin : arms);
      block(s * 7.2, sw, 3, 3.2, 12.6, 15.2, skin); // the hand
    }
    if (p.held && dir !== 0) { const [hu, hv] = turn(dir, 7.2, -step * 2.4); const c = /staff/.test(p.held) ? '#7a5030' : /bow/.test(p.held) ? '#8a5a2e' : '#d8dce4'; parts.push({ key: hu + hv + 0.5, draw: g => line(g, c, 2, ...L(U + hu, V + hv, 13), ...L(U + hu, V + hv, /staff/.test(p.held) ? 48 : 36)) }); }
    // the head (big, as the figure is meant to be read at a glance), and the face on the side it looks
    const face = (g, f) => {
      const px = ([x, y]) => rect(g, '#141010', Math.round(x), Math.round(y), 1, 2), ez = 34.6;
      if (dir === 2) for (const s of [-2.2, 2.2]) px(L(U + s, f.v1, ez));
      else if (dir === 1) px(L(f.u1, V + 1.6, ez));
      else if (dir === 3) px(L(f.u0 + 1.8, f.v1, ez));
    };
    block(0, 0, 9.6, 8.4, 28, 40, skin, dir === 0 ? null : face);
    if (!bald) { // hair: a cap over the top and down the back
      block(0, -0.6, 10.6, 9.6, 37.6, 42.4, hair);
      block(0, -3.9, 10.6, 2.2, 30, 39, hair);
      if (hs === 'long' || hs === 'braids' || hs === 'wild') block(0, -4.2, 11, 2.4, 20, 31, hair);
      if (hs === 'ponytail') block(0, -5.2, 2.6, 2, 23, 36, hair);
    }
    if (p.beard && dir !== 0) block(0, 3.6, 8, 1.8, 28, 32.4, p.beard);
    if (hat) {
      const c = hat.color || '#8a8a92', st = hat.style;
      if (st === 'hood') block(0, -0.6, 11.4, 10, 31, 43.6, c);
      else if (st === 'pointy') { block(0, 0, 14, 12.6, 40, 41.6, c); block(0, 0, 8, 7, 41.6, 48, c); block(0, 0, 4, 3.6, 48, 53, c); }
      else if (st === 'crown') block(0, 0, 10, 9, 40.4, 43.4, GOLD);
      else if (st === 'wide' || st === 'tricorn' || st === 'feather' || st === 'hunter') { block(0, 0, 15, 13.4, 40, 41.4, c); block(0, 0, 9.4, 8.4, 41.4, 45.4, c); }
      else block(0, 0, 10.8, 9.8, 37, 43.6, c); // helmets and the rest
    }
    shadow(g0, U - 2, V + 1, 8.5, 3.6);
    outlined(g0, g => { parts.sort((x, y) => x.key - y.key); for (const part of parts) part.draw(g); });
    solidify(g0); // whole pixels: chunky, no soft edges
  }

  // ---- people as a tilted figure (Sprites.PEOPLE 'tilt') -----------------------------------------------------------
  // A plain figure seen from the front (or the back, or the side), tilted as a whole along the world's lean: feet at
  // the bottom right of the tile, head up to the left. Big simple shapes (a head with hair, a body, arms, legs, boots),
  // two or three tones each, lit from the top left, drawn at a pixel per world pixel with a black edge: chunky.
  const tiltable = p => p && !p.ribs && !p.wings && !p.tail && !p.oneEye && !p.bigEyes && !p.horns && !(p.scale && p.scale !== 1);
  function tiltPerson(g0, p, dir, frame) {
    const tilt = (Sprites.TILT || 0) * Math.PI / 180, sa = Math.sin(tilt), ca = Math.cos(tilt);
    const FX = 16 + 5 * sa / 0.6, FY = 28.5, D = [-sa, -ca], N = [ca, -sa]; // the feet; along the figure (up), across it
    const at = (t, s) => [FX + D[0] * t + N[0] * s, FY + D[1] * t + N[1] * s];
    const step = frame === 1 ? 1 : frame === 2 ? -1 : 0, front = dir === 2, back = dir === 0, side = !front && !back;
    const flip = dir === 3 ? -1 : 1; // which way a profile looks across the figure
    const skin = p.skin || '#f0c090', hair = p.hair || shade(skin, 0.6), body = p.body || '#6a6a72', arms = p.arms || body;
    const legs = p.legs || body, feet = p.feet || shade(legs, 0.55), hs = p.hairStyle || 'short', hat = p.hat || null;
    const hooded = hat && hat.style === 'hood';
    const tone = (g, c, a, b) => { const gr = g.createLinearGradient(a[0] - 3, a[1] - 3, b[0] + 3, b[1] + 3); gr.addColorStop(0, shade(c, 1.25)); gr.addColorStop(0.5, c); gr.addColorStop(1, shade(c, 0.68)); g.fillStyle = gr; };
    const limb = (g, t0, s0, r0, t1, s1, r1, c) => { const [x0, y0] = at(t0, s0), [x1, y1] = at(t1, s1), a = Math.atan2(y1 - y0, x1 - x0);
      g.beginPath(); g.arc(x0, y0, r0, a + Math.PI / 2, a + Math.PI * 1.5); g.arc(x1, y1, r1, a - Math.PI / 2, a + Math.PI / 2); g.closePath(); tone(g, c, [Math.min(x0, x1) - r0, Math.min(y0, y1) - r0], [Math.max(x0, x1) + r0, Math.max(y0, y1) + r0]); g.fill(); };
    const blob = (g, t, s, rt, rs, c) => { const [x, y] = at(t, s), a = Math.atan2(D[1], D[0]); g.beginPath(); g.ellipse(x, y, rt, rs, a, 0, Math.PI * 2); tone(g, c, [x - rt, y - rt], [x + rt, y + rt]); g.fill(); };
    const W = side ? 0.7 : 1; // from the side the figure is narrower
    shadow(g0, FX - 1, FY + 0.5, 6.5, 2.6);
    outlined(g0, g => {
      // legs and boots, one ahead of the other when walking
      const legSides = side ? [0.8, -0.8] : [-2.6, 2.6];
      legSides.forEach((s, k) => {
        const sw = (k ? step : -step) * (side ? 2.2 : 1.2);
        if (!p.robe) { limb(g, 12, s * W, 2.4, 3 + sw, s * W + (side ? flip * sw * 0.6 : 0), 2, legs); blob(g, 1.6 + sw, s * W + (side ? flip * (sw * 0.6 + 1) : 0), 2.4, 2.2, feet); }
      });
      if (p.robe) { const [a, b, c, d] = [at(22, -6 * W), at(22, 6 * W), at(0.5, 7.4 * W), at(0.5, -7.4 * W)]; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...d); g.closePath(); tone(g, body, d, b); g.fill(); if (p.trim) limb(g, 1, -7 * W, 1, 1, 7 * W, 1, p.trim); }
      if (p.cape && !front) blob(g, 14, 0, 11, 7 * W, p.cape);
      // the body
      limb(g, 13, 0, 5.4 * W, 21.5, 0, 6.4 * W, p.armor || body);
      if (p.skirt) limb(g, 8, 0, 6 * W, 13, 0, 5.4 * W, p.skirt);
      limb(g, 13.4, -5.2 * W, 0.9, 13.4, 5.2 * W, 0.9, p.sash || p.belt || shade(legs, 0.5)); // the belt, across
      if (p.tabard && !side) limb(g, 7, 0, 2, 21, 0, 2.2, p.tabard);
      // arms swinging against the legs, hands
      const armSides = side ? [-0.4] : [-7.2, 7.2];
      armSides.forEach((s, k) => {
        const sw = (k ? -step : step) * 1.6;
        limb(g, 21, s * W, 2.2, 13.5 + sw, s * W * 1.06 + (side ? flip * sw : 0), 1.9, p.armor && !p.bareArms ? p.armor : p.bareArms ? skin : arms);
        blob(g, 12.4 + sw, s * W * 1.06 + (side ? flip * sw : 0), 1.8, 1.8, skin);
      });
      if (p.held && !back) { const s = side ? -0.4 : 7.2, [x0, y0] = at(12, s), [x1, y1] = at(/staff/.test(p.held) ? 34 : 26, s + 2.5); g.strokeStyle = p.heldColor || (/staff|bow/.test(p.held) ? '#7a5030' : '#dde2ea'); g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
      if (p.shield && front) blob(g, 17, -7.6, 4.2, 3.6, p.shield);
      // the head, big; the face on its front (or its side, for a profile); the hair over it
      if (!back && (hs === 'long' || hs === 'braids')) limb(g, 21, 0, 5.6, 28, 0, 5.8, shade(hair, 0.85)); // long hair behind
      blob(g, 27.8, side ? flip * 0.8 : 0, 6, 5.6, skin);
      if (!back && !hooded) {
        const eye = (t, s) => { const [x, y] = at(t, s); rect(g, p.eye || '#141010', Math.round(x), Math.round(y), 1, 1); };
        if (front) { eye(27.2, -2.2); eye(27.2, 2.2); } else eye(27.4, flip * 3.2);
      }
      if (p.beard && !back) limb(g, 24.6, side ? flip * 2 : -2, 2.2, 24.6, side ? flip * 3.4 : 2, 2.2, p.beard);
      if (hs !== 'bald' && !hooded) {
        if (back) blob(g, 28.4, 0, 6.4, 6, hair);
        else if (side) { blob(g, 31, -flip * 1.4, 4.4, 5, hair); limb(g, 30, -flip * 4.6, 1.8, 25.4, -flip * 4.2, 1.6, hair); }
        else { blob(g, 31.2, 0, 4, 6.2, hair); limb(g, 30, -5, 1.8, 25.4, -5.2, 1.4, hair); limb(g, 30, 5, 1.8, 25.4, 5.2, 1.4, hair); }
        if (hs === 'ponytail' && !front) limb(g, 28, side ? -flip * 5.6 : 0, 1.6, 20, side ? -flip * 6 : 0, 1.2, hair);
      }
      if (hat) {
        const c = hat.color || '#8a8a92', st = hat.style;
        if (st === 'hood') { blob(g, 28.6, 0, 7, 6.6, c); if (!back) { blob(g, 27.4, side ? flip * 1.6 : 0, 4.4, side ? 2.6 : 4, '#1e1612'); blob(g, 27.2, side ? flip * 1.8 : 0, 3.6, side ? 2 : 3.2, skin); } }
        else if (st === 'pointy') { const [a, b, c2] = [at(31, -7.6), at(31, 7.6), at(43, 1)]; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c2); g.closePath(); tone(g, c, a, b); g.fill(); limb(g, 31, -7.6, 1, 31, 7.6, 1, shade(c, 0.7)); }
        else if (st === 'crown') limb(g, 32, -4, 1.4, 32, 4, 1.4, GOLD);
        else if (st === 'wide' || st === 'tricorn' || st === 'feather' || st === 'hunter') { limb(g, 31, -8, 1.2, 31, 8, 1.2, shade(c, 0.8)); blob(g, 33.4, 0, 2.8, 4.6, c); }
        else blob(g, 30.4, 0, 4.8, 6.4, c); // helmets and the rest
      }
    });
    solidify(g0); // whole pixels
  }

  // ---- players from a picture: sprites/player-sheet.png ---------------------------------------------------------------
  // Drawn by hand (the owner's own), at 4 pixels a world pixel: rows front, side (facing east) and back, columns standing
  // and two steps; cells of 32 x 48 world pixels with the feet at (16, 46). West is the side row mirrored. Its hair, shirt,
  // trousers and boots take the colours of the player's outfit: each pixel is sorted into one of them by its colour (and,
  // for the browns, by its height: hair above the neck, boots below the knee) and recoloured, keeping its light and
  // shade; in the sheet's own colours (DEFAULT_OUTFIT) it's drawn exactly as it is.
  const SHEET = { res: 4, cell: [32, 48], feet: [16, 46], rows: { 2: 0, 1: 1, 3: 1, 0: 2 }, parts: ['hair', 'body', 'legs', 'feet'] };
  let sheetPixels = null; // { data, width, part: Uint8Array (0 none, 1 hair, 2 body, 3 legs, 4 feet) }, or false if it can't be read
  function sheetParts(img) {
    if (sheetPixels !== null) return sheetPixels;
    try {
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
      const data = g.getImageData(0, 0, c.width, c.height).data, part = new Uint8Array(c.width * c.height), CH = SHEET.cell[1] * SHEET.res;
      for (let i = 0; i < part.length; i++) {
        const r = data[i * 4] / 255, gg = data[i * 4 + 1] / 255, b = data[i * 4 + 2] / 255, a = data[i * 4 + 3];
        if (a < 128) continue;
        const v = Math.max(r, gg, b), d = v - Math.min(r, gg, b), s = v ? d / v : 0;
        let h = !d ? 0 : v === r ? ((gg - b) / d) % 6 : v === gg ? (b - r) / d + 2 : (r - gg) / d + 4;
        h = (h * 60 + 360) % 360;
        const yy = (Math.floor(i / c.width) % CH) / SHEET.res;
        if (v < 0.22) continue;                                                        // the outline
        if (h > 185 && h < 265 && s > 0.3) part[i] = 2;                               // the shirt
        else if ((h < 50 || h > 330) && s < 0.33 && v < 0.7) part[i] = 3;            // the trousers
        else if (h > 15 && h < 42 && s < 0.68 && v > 0.84) continue;                  // skin
        else if (h > 30 && h < 55 && s > 0.55 && v > 0.75 && yy >= 28 && yy < 38) continue; // the buckle
        else if ((h < 45 || h > 330) && s >= 0.33) { if (yy < 27) part[i] = 1; else if (yy >= 37) part[i] = 4; } // hair, boots (the belt between stays)
      }
      sheetPixels = { data, width: c.width, part };
    } catch (e) { sheetPixels = false; } // (over file:// it can't be read: drawn in its own colours)
    return sheetPixels;
  }
  const hexRgb = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
  // An NPC with its own sheet (sprites/custom.js: sheet_<npc id>, laid out as the player sheet), drawn as it is.
  function npcFromSheet(id, dir, frame) {
    const img = customImage(`sheet_${id}`), R = SHEET.res, [CW, CH] = SHEET.cell;
    return cached(`npcsheet:${id}:${dir}:${frame}`, g => {
      g.canvas.res = R;
      const sx = (frame || 0) * CW * R, sy = SHEET.rows[dir] * CH * R, ox = (TILE + 16 - SHEET.feet[0]) * R, oy = (TILE + 29 - SHEET.feet[1]) * R;
      if (dir === 3) { g.translate(ox + CW * R, oy); g.scale(-1, 1); g.drawImage(img, sx, sy, CW * R, CH * R, 0, 0, CW * R, CH * R); }
      else g.drawImage(img, sx, sy, CW * R, CH * R, ox, oy, CW * R, CH * R);
    }, 2 * TILE * R);
  }
  const ownSheet = c => !!c && ((c.type === 'player' && Sprites.PLAYER_SHEET && customImage('player_sheet')) || (c.type === 'npc' && customImage(`sheet_${c.npcId}`)));
  function playerFromSheet(key, dir, frame) {
    const img = customImage('player_sheet'), R = SHEET.res, look = lookFor(key) || {};
    return cached(`sheet:${key}:${dir}:${frame}`, g => {
      g.canvas.res = R;
      const [CW, CH] = SHEET.cell, row = SHEET.rows[dir], col = frame || 0, sx = col * CW * R, sy = row * CH * R;
      const cell = document.createElement('canvas'); cell.width = CW * R; cell.height = CH * R;
      const cg = cell.getContext('2d');
      const px = sheetParts(img);
      const targets = SHEET.parts.map(p => (look[p] && look[p] !== DEFAULT_OUTFIT[p] ? hexRgb(look[p]) : null));
      if (px && targets.some(Boolean)) { // recolour: each part's pixels, as light or dark against the part's own colour
        const out = cg.createImageData(cell.width, cell.height), o = out.data, base = SHEET.parts.map(p => hexRgb(DEFAULT_OUTFIT[p]));
        const lum = (r, gg, b) => 0.3 * r + 0.59 * gg + 0.11 * b;
        for (let y = 0; y < cell.height; y++) for (let x = 0; x < cell.width; x++) {
          const i = (sy + y) * px.width + sx + x, j = (y * cell.width + x) * 4, p = px.part[i], t = p && targets[p - 1];
          let r = px.data[i * 4], gg = px.data[i * 4 + 1], b = px.data[i * 4 + 2];
          if (t) { const f = lum(r, gg, b) / Math.max(1, lum(...base[p - 1])); r = Math.min(255, t[0] * f); gg = Math.min(255, t[1] * f); b = Math.min(255, t[2] * f); }
          o[j] = r; o[j + 1] = gg; o[j + 2] = b; o[j + 3] = px.data[i * 4 + 3];
        }
        cg.putImageData(out, 0, 0);
      } else cg.drawImage(img, sx, sy, CW * R, CH * R, 0, 0, CW * R, CH * R);
      // into a picture two tiles square, its tile bottom right, the feet where a creature's stand (16, 29 on the tile)
      const ox = (TILE + 16 - SHEET.feet[0]) * R, oy = (TILE + 29 - SHEET.feet[1]) * R;
      if (dir === 3) { g.translate(ox + CW * R, oy); g.scale(-1, 1); g.drawImage(cell, 0, 0); }
      else g.drawImage(cell, ox, oy);
    }, 2 * TILE * R);
  }

  // A person as a doll, from the same look as humanoid(): skin, hair (hairStyle), eye, body, arms, legs, feet, belt;
  // robe, trim, coat, skirt, vest, collar, buttons, stripes, tabard, armor, cape, fur, ribs, wraps; beard, ears,
  // horns, tail, wings, oneEye, bigEyes, female; hat ({ style, color }); held (sword, axe, staff, bow); scale.
  function doll(g0, p, dir, frame) {
    const build = BUILDS[Sprites.BUILD] || null;
    dollZ = build ? buildZ(build) : z => z;
    try { dollFigure(g0, p, dir, frame, build); } finally { dollZ = z => z; }
  }
  function dollFigure(g0, p, dir, frame, build) {
    const s = p.scale || 1;
    if (s !== 1) { g0.translate(16, 29); g0.scale(s, s); g0.translate(-16, -29); }
    if (p.hat && ['pointy', 'wide', 'antlers', 'horned', 'crown'].includes(p.hat.style)) g0.translate(0, 1);
    shadow(g0, 16, 29, 8, 3);
    outlined(g0, g => { // (a dark outline round the whole figure, as the pixel figures have)
    const step = frame === 1 ? 1 : frame === 2 ? -1 : 0, skin = p.skin, hair = p.hair || p.skin, hs = p.hairStyle || 'short';
    const bony = !!p.ribs, thin = bony ? 0.65 : 1; // a skeleton: bones for limbs
    const body = p.body, arms = p.arms || p.body, legs = p.legs || p.body, feet = p.feet || shade(legs, 0.6);
    const fwd = { 2: [0, 1], 0: [0, -1], 1: [1, 0], 3: [-1, 0] }[dir], front = dir === 2, back = dir === 0, side = !front && !back;
    const parts = [];
    const part = (a, b, z, draw, over = 0) => parts.push({ a, b, z, over, draw });
    const at = (u, v, a, b) => { const [du, dv] = turn(dir, a, b); return [u + du, v + dv]; }; // a point on the figure
    const W = (p.female ? 8.6 : 9.8) * (build ? build.wide : 1), D = 5.6; // the torso's width and depth
    // ---- behind: a cape, wings, a tail
    if (p.cape) part(0, -3.6, 12, (u, v) => {
      const [cu, cv] = at(u, v, 0, -0.4);
      dollBox(g, dir, cu, cv, W + 1.6, 1.2, 2.5 - Math.abs(step) * 0.5, 17.8, { south: back ? p.cape : shade(p.cape, 0.8) });
    }, -0.5);
    if (p.wings) for (const side of [-1, 1]) part(side * 4, -4, 16, (u, v) => {
      const [w0u, w0v] = at(u, v, side * 1, -1), [w1u, w1v] = at(u, v, side * 9, -3), [w2u, w2v] = at(u, v, side * 7, -2);
      poly(g, p.wings, [...Q(w0u, w0v, 17), ...Q(w1u, w1v, 25 + frame), ...Q(w2u, w2v, 10), ...Q(w0u, w0v, 11)]);
      poly(g, shade(p.wings, 0.75), [...Q(w0u, w0v, 14), ...Q(w2u, w2v, 10), ...Q(w0u, w0v, 11)]);
    }, -0.6);
    if (p.tail) part(0, -4, 8, (u, v) => { const [tu, tv] = at(u, v, 0, -3), [eu, ev] = at(u, v, 1.5, -8); dollLimb(g, tu, tv, 9, eu, ev, 3, 1.1, p.tail); }, -0.6);
    // ---- legs (under a robe, only the feet show), stepping
    for (const side of [-1, 1]) {
      const sw = step * side * 2;
      part(side * 2.3, sw, 4, (u, v) => {
        const [fu, fv] = [u + fwd[0] * 1.2, v + fwd[1] * 1.2];
        if (!p.robe) {
          dollLimb(g, u, v, 1.4, u, v * 0.5, 9, 1.9 * thin, legs);
          if (bony) dollBall(g, u, v * 0.7, 5, 1.3, shade(legs, 1.1)); // a knee
          if (p.wraps) for (const z of [3, 6]) { const [x, y] = Q(u, v * 0.8, z); rect(g, p.wraps, x - 2, y, 4, 1); }
        }
        if (!p.robe) dollBox(g, dir, fu, fv, bony ? 2.6 : 3.4, 4.8, 0, 1.9, { south: feet }); // (a robe hides the feet)
      });
    }
    // ---- the body
    part(0, 0, 12, (u, v) => {
      const hem = p.robe ? 0 : p.coat ? 4.5 : p.skirt ? 5 : 8;
      if (p.robe || p.coat) dollBox(g, dir, u, v, W + 1, D + 0.8, hem, 10, { south: body }); // a robe's or a coat's skirts
      if (p.skirt) dollBox(g, dir, u, v, W + 1.4, D + 1.2, hem, 9.4, { south: p.skirt });
      if (p.trim && p.robe) dollBox(g, dir, u, v, W + 1.15, D + 0.95, 0, 1.4, { south: p.trim });
      // the chest, a little wider at the shoulders than at the waist
      if (bony) { // a spine and ribs, with the pelvis under them
        dollBox(g, dir, u, v, 6, 3.4, 7.5, 9.8, { south: body });
        dollLimb(g, u, v, 9.5, u, v, 17, 0.9, body);
        dollBox(g, dir, u, v, 6.6, 3.2, 10.6, 17, { south: p.ribs === true ? '#3a342c' : shade(p.ribs, 0.55) }); // the dark inside of the ribcage
        for (const z of [11, 13, 15, 16.6]) dollBox(g, dir, u, v, 8 - (z - 11) * 0.3, 4.2, z, z + 1, { south: body });
      } else {
        dollBox(g, dir, u, v, W - 0.6, D, 8, 13, { south: body });
        dollBox(g, dir, u, v, W, D + 0.2, 12.5, 17.6, { south: body });
      }
      const face = (fn, z0 = 8, z1 = 17.6) => { if (back) return; const [fu, fv] = at(u, v, 0, (D + 0.2) / 2 + 0.05); fn(fu, fv, z0, z1); };
      if (p.vest) dollBox(g, dir, u, v, W + 0.3, D + 0.5, 9, 17.4, { south: p.vest });
      if (p.vest && front) face((fu, fv) => dollBox(g, dir, fu, fv, 3.4, 0.3, 9, 17.2, { south: body }));
      if (p.stripes) for (const z of [10, 12, 14, 16]) dollBox(g, dir, u, v, W + 0.1, D + 0.3, z, z + 0.8, { south: p.stripes });
      if (p.fur) for (const z of [9, 12, 15]) { const [x, y] = Q(u, v + (front ? 2.8 : 0), z); rect(g, shade(body, 1.25), x - 3, y, 6, 1); }
      if (p.armor) { // a breastplate, and shoulder plates
        dollBox(g, dir, u, v, W + 0.4, D + 0.6, 11, 17.8, { south: p.armor });
        for (const side of [-1, 1]) { const [su, sv] = at(u, v, side * (W / 2 + 0.4), 0); dollBall(g, su, sv, 17, 2.4, p.armor); }
      }
      if (p.tabard && !side) face((fu, fv) => dollBox(g, dir, fu, fv, 4.6, 0.5, 4.5, 17, { south: p.tabard }));
      else if (p.tabard) { const [tu, tv] = at(u, v, 0, 0); dollBox(g, dir, tu, tv, 0.6, D + 1, 4.5, 17, { south: p.tabard }); }
      if (p.tabard && front) face((fu, fv) => { dollBox(g, dir, fu, fv + 0.3, 0.9, 0.2, 9.5, 15, { south: shade(p.tabard, 1.4) }); dollBox(g, dir, fu, fv + 0.3, 3, 0.2, 12.5, 13.4, { south: shade(p.tabard, 1.4) }); });
      if (p.collar && !back) face((fu, fv) => dollBox(g, dir, fu, fv, 5, 0.6, 16, 17.9, { south: p.collar }));
      if (p.buttons && front) face((fu, fv) => { for (const z of [10, 12.5, 15]) { const [x, y] = Q(fu, fv + 0.4, z); rect(g, p.buttons, x - 0.5, y - 0.5, 1, 1); } });
      if (p.belt) {
        dollBox(g, dir, u, v, W - 0.2, D + 0.5, 8.6, 10, { south: p.belt });
        if (front) face((fu, fv) => { const [x, y] = Q(fu, fv + 0.4, 9.3); rect(g, GOLD, x - 1, y - 0.8, 2, 1.6); });
      }
      if (p.wraps) for (const z of [10, 13, 16]) { const [x, y] = Q(u, v + (front ? 2.9 : 0), z); line(g, p.wraps, 1, x - 4.5, y, x + 4.5, y - 1.5); }
    });
    // ---- arms, swinging opposite the legs; a hand at the end of each, and what it holds
    for (const side of [-1, 1]) {
      const sw = -step * side * 2.2, [au, av] = turn(dir, side * (W / 2 + 1), 0), [eu, ev] = turn(dir, side * (W / 2 + 1.3), sw * 0.5), [hu, hv] = turn(dir, side * (W / 2 + 1.4), sw);
      part(side * 6, sw * 0.5, 15, (u, v) => {
        dollLimb(g, au, av, 17, eu, ev, 13, 1.7 * thin, arms);
        dollLimb(g, eu, ev, 13, hu, hv, 9.8, 1.6 * thin, p.armor && !bony ? shade(arms, 1.05) : arms);
        if (bony) dollBall(g, eu, ev, 13, 1.1, shade(arms, 1.1)); // an elbow
        dollBall(g, hu, hv, 9, 1.6, skin);
        if (p.held && side === 1) dollHeld(g, dir, p.held, hu, hv, fwd);
      }, side === 1 ? 0.01 : 0);
    }
    // ---- the neck and the head: a ball, with hair, a face, ears, horns, a hat
    part(0, 0, 22, (u, v) => {
      dollLimb(g, u, v, 17, u, v, 18.6, 1.4 * thin, skin);
      const hz = 22.8, r = 5.6;
      if (build) { const [cx, cy] = Q(u, v, hz); g.save(); g.translate(cx, cy); g.scale(build.head, build.head); g.translate(-cx, -cy); } // a smaller head
      // long hair, a ponytail and braids hang behind the head
      if ((hs === 'long' || hs === 'braids') && !front) { const [bu, bv] = at(u, v, 0, -1.8); dollBox(g, dir, bu, bv, 9.5, 3, 13, 23, { south: hair }); }
      if (hs === 'ponytail' && !front) { const [bu, bv] = at(u, v, 0, -r); dollLimb(g, bu, bv, 22, bu, bv, 14, 1.3, hair); }
      if (p.ears && !back) for (const side of front ? [-1, 1] : [-fwd[0] || 1]) { const [eu, ev] = at(u, v, side * (r - 0.5), 0); const [x, y] = Q(eu, ev, hz + 0.5); poly(g, skin, [x, y + 1.5, x + side * 4, y - 2.5, x, y - 1]); }
      dollBall(g, u, v, hz, r, skin);
      const [x, y] = Q(u, v, hz);
      if (hs !== 'bald' && !(p.hat && p.hat.style === 'hood')) { // hair: a cap over the top, all of it from behind
        g.save(); g.beginPath(); g.arc(x, y, r + 0.3, 0, Math.PI * 2); g.clip();
        g.fillStyle = hair;
        if (back) g.fillRect(x - r - 1, y - r - 1, 2 * r + 2, 2 * r + 2);
        else if (front) { g.beginPath(); g.ellipse(x, y - r * 0.8, r + 0.6, r * 0.62, 0, 0, Math.PI * 2); g.fill(); g.fillRect(x - r - 0.5, y - r * 0.6, 1.6, r * 0.9); g.fillRect(x + r - 1.1, y - r * 0.6, 1.6, r * 0.9); }
        else { g.beginPath(); g.ellipse(x - fwd[0] * r * 0.45, y - r * 0.6, r + 0.4, r * 0.7, 0, 0, Math.PI * 2); g.fill(); g.fillRect(x - fwd[0] * r * 0.7 - 1.5, y - r * 0.3, 3, r); }
        g.fillStyle = shade(hair, 1.3); g.fillRect(x - r * 0.7, y - r * 0.95, r * 0.8, 1);
        g.restore();
      }
      if ((hs === 'long' || hs === 'braids') && front) for (const side of [-1, 1]) { const [bu, bv] = at(u, v, side * (r - 0.6), 0.5); dollLimb(g, bu, bv, 22, bu, bv, hs === 'braids' ? 12 : 15, 1.2, hair); }
      const hood = p.hat && p.hat.style === 'hood';
      if (hood) { // a hood first, the face looking out of its opening
        dollHat(g, p.hat, x, y, r, dir, fwd);
        if (front) { ellipse(g, shade(p.hat.color || '#888', 0.45), x, y + 1.4, r * 0.7, r * 0.8); ellipse(g, skin, x, y + 1.8, r * 0.58, r * 0.66); }
        else if (side) { const fx = x + fwd[0] * (r - 2.2); ellipse(g, skin, fx, y + 1.6, 2.2, 3); }
      }
      // the face
      const eyes = (ex, ey, sz = 1) => { if (bony) { ellipse(g, '#1a1410', ex, ey + 1, 1.3 * sz, 1.4 * sz); return; } rect(g, p.eye || '#1e1410', ex - 0.8 * sz, ey + 0.2, 1.7 * sz, 2 * sz); if (!p.eye) rect(g, '#ffffff', ex - 0.8, ey + 0.2, 0.8, 0.8); };
      if (front) {
        if (p.oneEye) { ellipse(g, '#f4f0e0', x, y + 1, 2.4, 2); eyes(x, y - 0.2, 1.1); }
        else for (const ex of [-2, 2]) { if (p.bigEyes) ellipse(g, '#f4f0e0', x + ex, y + 1.2, 1.8, 1.8); eyes(x + ex, y); if (!bony && !p.hat) rect(g, shade(hair, 0.7), x + ex - 0.9, y - 0.9, 1.9, 0.7); }
        if (bony) { rect(g, '#1a1410', x - 0.5, y + 2.6, 1, 1); for (let k = -2; k <= 2; k++) rect(g, '#2a2420', x + k - 0.3, y + 4, 0.6, 1); }
        else { rect(g, shade(skin, 0.82), x - 0.3, y + 1.8, 0.8, 1.2); rect(g, p.female ? '#c05858' : shade(skin, 0.6), x - 0.8, y + 3.6, 1.8, 0.7); }
        if (p.beard) { g.fillStyle = p.beard; g.beginPath(); g.ellipse(x, y + 3.6, 3.8, 2.6, 0, 0, Math.PI); g.fill(); g.fillRect(x - 3.8, y + 1.5, 1.2, 2.2); g.fillRect(x + 2.6, y + 1.5, 1.2, 2.2); }
      } else if (side) {
        const fx = x + fwd[0] * (r - 1.6);
        eyes(fx, y);
        if (!bony) rect(g, shade(skin, 0.85), x + fwd[0] * r - (fwd[0] < 0 ? 1 : 0), y + 1.2, 1, 1.4);
        if (p.beard) { g.fillStyle = p.beard; g.beginPath(); g.ellipse(x + fwd[0] * 2.2, y + 3.4, 2.8, 2, 0, 0, Math.PI); g.fill(); }
      }
      if (p.horns) for (const side of [-1, 1]) { const [hu2, hv2] = at(u, v, side * (r - 1), 0); const [x2, y2] = Q(hu2, hv2, hz + 3); line(g, p.horns === true ? '#e8dcc0' : p.horns, 1.8, x2, y2, x2 + side * 2.5, y2 - 2, x2 + side * 2, y2 - 5); }
      if (p.hat && !hood) dollHat(g, p.hat, x, y, r, dir, fwd);
      if (build) g.restore();
    }, 0.02);
    dollParts(g, dir, parts);
    });
  }
  // What a doll holds in its right hand, at (hu, hv), pointing its way.
  function dollHeld(g, dir, kind, hu, hv, fwd) {
    const [tu, tv] = [hu + fwd[0] * 2.2, hv + fwd[1] * 2.2];
    if (kind === 'sword') {
      dollLimb(g, hu, hv, 8.2, hu, hv, 10, 0.6, '#5a3a1e');                          // the grip
      dollBox(g, dir, hu, hv, 3.4, 0.9, 10, 10.9, { south: '#c8a040' });              // the crossguard
      dollLimb(g, hu, hv, 10.9, tu, tv, 19, 0.7, '#d8dce4');                          // the blade
    } else if (kind === 'axe') {
      dollLimb(g, hu, hv, 7.5, tu, tv, 17, 0.7, '#6a4422');
      const [bu, bv] = [tu + fwd[0] * 0.5, tv + fwd[1] * 0.5];
      dollBox(g, dir, bu, bv, 0.8, 3.4, 14, 18.5, { south: '#b8bcc4' });
    } else if (kind === 'staff') {
      dollLimb(g, hu, hv, 1, hu, hv, 25, 0.8, '#7a5030');
      dollBall(g, hu, hv, 26.2, 1.6, '#80d0ff');
    } else if (kind === 'bow') {
      const [bu, bv] = [hu + fwd[0], hv + fwd[1]];
      line(g, '#8a5a2e', 1.4, ...Q(bu, bv, 18), ...Q(bu + fwd[0] * 2, bv + fwd[1] * 2, 13), ...Q(bu, bv, 4));
      line(g, '#e8e0d0', 0.5, ...Q(bu, bv, 18), ...Q(bu, bv, 4));
    } else dollLimb(g, hu, hv, 8.8, tu, tv, 17, 1.2, '#6a4422');                     // a club
  }
  // A hat on a doll's head, at (x, y) on screen, r round.
  function dollHat(g, hat, x, y, r, dir, fwd) {
    const c = hat.color || '#8a8a92', lit = shade(c, 1.3), dk = shade(c, 0.72), st = hat.style;
    const cap = (h, down) => { // a dome over the head, down to `down` below its middle
      g.beginPath(); g.ellipse(x, y - r * 0.15, r + 0.8, r + h, 0, Math.PI, 0); g.lineTo(x + r + 0.8, y + down); g.lineTo(x - r - 0.8, y + down); g.closePath();
      g.fillStyle = c; g.fill(); rect(g, lit, x - r * 0.6, y - r - h + 0.6, r, 1); rect(g, dk, x + r * 0.2, y - r * 0.4, r * 0.6, r * 0.5);
    };
    if (st === 'helmet') { cap(0.4, -0.3); rect(g, dk, x - r - 0.8, y - 0.8, 2 * r + 1.6, 1.4); if (dir === 2) rect(g, dk, x - 0.6, y - 0.6, 1.2, 3.2); }
    else if (st === 'hood') { cap(0.8, 3.5); if (dir === 0) rect(g, dk, x - r, y + 2, 2 * r, 2); }
    else if (st === 'crown') { rect(g, '#d8a830', x - r + 0.5, y - r - 0.5, 2 * r - 1, 2.4); for (const k of [-3.5, 0, 3.5]) poly(g, '#f0d040', [x + k - 1.2, y - r - 0.5, x + k + 1.2, y - r - 0.5, x + k, y - r - 3]); rect(g, '#e04040', x - 0.6, y - r + 0.3, 1.2, 1); }
    else if (st === 'pointy') { ellipse(g, dk, x, y - r * 0.55, r + 2.5, 1.6); poly(g, c, [x - r, y - r * 0.6, x + r, y - r * 0.6, x + 1.5, y - r - 9]); poly(g, dk, [x + 1, y - r * 0.6, x + r, y - r * 0.6, x + 1.5, y - r - 9]); }
    else if (st === 'wide') { ellipse(g, dk, x, y - r * 0.5, r + 4, 2); ellipse(g, c, x, y - r * 0.6, r + 3.5, 1.6); cap(0.2, -r * 0.6); }
    else if (st === 'bandana') { cap(0.1, -1); if (dir !== 2) line(g, c, 1.2, x - fwd[0] * r, y - 1, x - fwd[0] * (r + 2.5), y + 2); }
    else if (st === 'tricorn') { poly(g, dk, [x - r - 3, y - r * 0.4, x + r + 3, y - r * 0.4, x, y - r * 0.4 + 2.5]); cap(0.6, -r * 0.4); }
    else if (st === 'feather') { cap(0.2, -1); line(g, '#e04040', 1.4, x + 2, y - r, x + 5, y - r - 5); }
    else if (st === 'antlers' || st === 'horned') { for (const side of [-1, 1]) line(g, st === 'antlers' ? '#8a6a3a' : '#e8dcc0', 1.4, x + side * 3, y - r + 1, x + side * 5, y - r - 4, x + side * 7, y - r - 5); if (st === 'horned') cap(0.3, -0.5); }
    else cap(0.3, 0);
  }
  // A wolf as a doll: a body of two balls (chest and haunches), four legs trotting, a head with a snout and ears, a tail.
  function wolfDoll(g, dir, frame, c = WOLF) {
    g.translate(16, 29); g.scale(1.25, 1.25); g.translate(-16, -29);
    ellipse(g, 'rgba(0,0,0,0.25)', 17, 29.5, 10, 3);
    const step = frame === 1 ? 1 : frame === 2 ? -1 : 0, fwd = { 2: [0, 1], 0: [0, -1], 1: [1, 0], 3: [-1, 0] }[dir];
    const parts = [], part = (a, b, z, draw, over = 0) => parts.push({ a, b, z, over, draw });
    for (const [a, b, ph] of [[-2, 3.5, 1], [2, 3.5, -1], [-2, -3.5, -1], [2, -3.5, 1]]) {
      part(a, b, 3, (u, v) => { const [su, sv] = turn(dir, 0, step * ph * 1.4); dollLimb(g, u + su, v + sv, 0.5, u, v, 7, 1.2, c.leg); });
    }
    part(0, -3, 9, (u, v) => { dollBall(g, u, v, 9, 4.2, c.body); const [tu, tv] = turn(dir, 0, -9); dollLimb(g, u, v, 10, u + tu * 0.6, v + tv * 0.6, 7, 1.2, c.tail); });
    part(0, 2.5, 9.5, (u, v) => { dollBall(g, u, v, 9.6, 4.6, c.body); const [x, y] = Q(u, v, 8); ellipse(g, c.light, x, y + 2, 3, 1.4); });
    part(0, 7, 12, (u, v) => {
      dollBall(g, u, v, 12.5, 3.3, c.head);
      const [su, sv] = [u + fwd[0] * 3, v + fwd[1] * 3];
      dollBox(g, dir, su, sv, 2.6, 3.4, 10.2, 12.4, { south: c.head });
      const [nx, ny] = Q(su + fwd[0] * 1.6, sv + fwd[1] * 1.6, 11.6); rect(g, '#1a1a1a', nx - 0.6, ny - 0.6, 1.4, 1.2);
      for (const side of [-1, 1]) { const [eu, ev] = turn(dir, side * 1.6, 0.5); const [x, y] = Q(u + eu, v + ev, 16); poly(g, c.ear, [x - 1.2, y + 1.8, x + 1.2, y + 1.8, x, y - 1.6]); }
      if (dir !== 0) for (const side of dir === 2 ? [-1, 1] : [0]) { const [eu, ev] = turn(dir, side * 1.4, 2.2); const [x, y] = Q(u + eu, v + ev, 13.4); rect(g, c.eye, x - 0.5, y - 0.5, 1.2, 1); }
    }, 0.01);
    dollParts(g, dir, parts);
  }

  // ---- beasts as dolls (group 2: the monsters of Oakvale) -------------------------------------------------
  const FWD = { 2: [0, 1], 0: [0, -1], 1: [1, 0], 3: [-1, 0] };
  // A rat: a long round body of two balls, a pointed head with ears and whiskers, four little legs, a bare tail.
  function ratDoll(g0, dir, frame, c = RAT) {
    shadow(g0, 16, 28, 9, 3);
    outlined(g0, g => {
      const step = frame === 1 ? 1 : frame === 2 ? -1 : 0, fwd = FWD[dir], parts = [];
      const part = (a, b, z, draw, over = 0) => parts.push({ a, b, z, over, draw });
      for (const [a, b, ph] of [[-2, 3, 1], [2, 3, -1], [-2, -2.5, -1], [2, -2.5, 1]]) part(a, b, 1, (u, v) => { const [su, sv] = turn(dir, 0, step * ph); dollLimb(g, u + su, v + sv, 0.3, u, v, 2.6, 0.9, shade(c.body, 0.8)); });
      part(0, -5, 3, (u, v) => { const [tu, tv] = turn(dir, step * 1.5, -10); line(g, c.tail, 1.2, ...Q(u, v, 3), ...Q(u + tu * 0.5, v + tv * 0.5, 2), ...Q(u + tu, v + tv, 0.5)); }, -0.5);
      part(0, -2, 4, (u, v) => dollBall(g, u, v, 4.2, 3.6, c.body));
      part(0, 1.5, 4.4, (u, v) => { dollBall(g, u, v, 4.6, 3.4, c.back); });
      part(0, 5, 4.5, (u, v) => {
        dollBall(g, u, v, 4.6, 2.5, c.head);
        const [su, sv] = [u + fwd[0] * 2.4, v + fwd[1] * 2.4]; dollBall(g, su, sv, 4, 1.5, c.head); // the snout
        const [nx, ny] = Q(su + fwd[0] * 1.2, sv + fwd[1] * 1.2, 4); rect(g, '#e0a0a6', nx - 0.5, ny - 0.5, 1.2, 1);
        for (const side of [-1, 1]) { const [eu, ev] = turn(dir, side * 1.8, -0.5); dollBall(g, u + eu, v + ev, 7, 1.3, c.ear); }
        if (dir !== 0) for (const side of dir === 2 ? [-1, 1] : [0]) { const [eu, ev] = turn(dir, side * 1.2, 1.4); const [x, y] = Q(u + eu, v + ev, 5.4); rect(g, c.eye, x - 0.5, y - 0.5, 1.1, 1.1); }
        if (dir !== 0) for (const k of [-1, 1]) line(g, 'rgba(230,230,230,0.6)', 0.5, nx, ny + 0.3, nx + k * 3, ny + k * 0.6);
      }, 0.01);
      dollParts(g, dir, parts);
    });
  }
  // A spider: a round abdomen with its mark, a smaller head with fangs and eyes, eight jointed legs walking.
  function spiderDoll(g0, dir, frame, c = SPIDER) {
    shadow(g0, 16, 28, 11, 3);
    outlined(g0, g => {
      const step = frame === 1 ? 1 : frame === 2 ? -1 : 0, fwd = FWD[dir], parts = [];
      const part = (a, b, z, draw, over = 0) => parts.push({ a, b, z, over, draw });
      const legs = (u, v) => { // all eight legs, the far ones first
        const list = [];
        for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
          const b0 = 2.6 - i * 1.9, ph = (i % 2 ? 1 : -1) * side * step * 1.2; // the four legs a side spread from front to back
          const [ru, rv] = turn(dir, side * 2, b0 * 0.6), [ku, kv] = turn(dir, side * 6.5, b0 * 2.2 + ph), [fu, fv] = turn(dir, side * 10, b0 * 3.4 + ph);
          list.push([[u + ru, v + rv, 4], [u + ku, v + kv, 6.5], [u + fu, v + fv, 0]]);
        }
        list.sort((x, y) => (x[1][1] + x[1][0] * 0.35) - (y[1][1] + y[1][0] * 0.35));
        return list;
      };
      part(0, 0, 0, (u, v) => { for (const leg of legs(u, v).slice(0, 4)) { line(g, c.legs, 1.6, ...leg.flatMap(([a, b, z]) => Q(a, b, z))); } }, -0.4);
      part(0, -3, 4, (u, v) => {
        dollBall(g, u, v, 4.6, 4.4, c.body);
        if (dir !== 2) { const [x, y] = Q(u, v, 7.4); poly(g, c.mark, [x, y - 1.6, x + 1.4, y, x, y + 1.6, x - 1.4, y]); }
        if (c.hairy) for (let k = 0; k < 6; k++) { const [x, y] = Q(u + (k - 2.5) * 1.3, v, 6 + (k % 3)); rect(g, shade(c.body, 1.3), x, y, 1, 1); }
      });
      part(0, 2.5, 4, (u, v) => {
        dollBall(g, u, v, 4, 2.6, c.head);
        if (dir !== 0) { const [x, y] = Q(u + fwd[0] * 2, v + fwd[1] * 2, 4.4); for (const k of [-1, 1]) rect(g, '#ff3030', x + k * 1 - 0.5, y - 1, 1, 1); for (const k of [-0.8, 0.8]) line(g, '#d8d0c0', 0.8, x + k, y + 1, x + k * 1.2, y + 2.5); }
      }, 0.01);
      part(0, 0, 0, (u, v) => { for (const leg of legs(u, v).slice(4)) { line(g, c.legs, 1.6, ...leg.flatMap(([a, b, z]) => Q(a, b, z))); const [x, y] = Q(...leg[1]); rect(g, shade(c.legs, 1.6), x - 0.5, y - 0.5, 1, 1); } }, 0.4);
      dollParts(g, dir, parts);
    });
  }
  // A crab: a wide flat shell, two big claws held up in front, eyes on stalks, three legs a side.
  function crabDoll(g0, dir, frame) {
    shadow(g0, 16, 28, 11, 3);
    outlined(g0, g => {
      const k = frame === 1 ? 1 : frame === 2 ? -1 : 0, fwd = FWD[dir], parts = [], shell = '#d0582a', dark = '#a8401f';
      const part = (a, b, z, draw, over = 0) => parts.push({ a, b, z, over, draw });
      for (const side of [-1, 1]) for (let i = 0; i < 3; i++) part(side * 7, -1 + i * 1.5, 1, (u, v) => {
        const [ru, rv] = turn(dir, side * 4.5, -1.5 + i * 1.6), [ku, kv] = turn(dir, side * 8, -2 + i * 2 + (i % 2 ? k : -k) * 0.6), [fu, fv] = turn(dir, side * 9.5, -2.5 + i * 2.3);
        const [cu, cv] = [u - turn(dir, side * 7, -1 + i * 1.5)[0], v - turn(dir, side * 7, -1 + i * 1.5)[1]];
        line(g, dark, 1.4, ...Q(cu + ru, cv + rv, 3), ...Q(cu + ku, cv + kv, 5), ...Q(cu + fu, cv + fv, 0));
      });
      part(0, 0, 3, (u, v) => {
        dollBox(g, dir, u, v, 11, 8, 1.5, 4.5, { south: dark, top: shell });
        const [x, y] = Q(u, v, 4.5); ellipse(g, shell, x, y, 6.3, 3.2); ellipse(g, shade(shell, 1.25), x - 1.5, y - 0.8, 3, 1.4);
      });
      for (const side of [-1, 1]) part(side * 4.5, 5.5, 5, (u, v) => { // the claws, raised and snapping
        const [au, av] = [u - turn(dir, side * 4.5, 5.5)[0] + turn(dir, side * 3.5, 3.5)[0], v - turn(dir, side * 4.5, 5.5)[1] + turn(dir, side * 3.5, 3.5)[1]];
        dollLimb(g, au, av, 3.5, u, v, 5 + k, 1, dark);
        dollBall(g, u, v, 5.5 + k, 2.4, shell);
        const [x, y] = Q(u + fwd[0] * 1.5, v + fwd[1] * 1.5, 6.2 + k); line(g, shade(shell, 0.6), 1, x - 1.5, y, x + 1.5, y - (k > 0 ? 1 : 0));
      }, 0.02);
      part(0, 3, 6, (u, v) => { if (dir === 0) return; for (const side of dir === 2 ? [-1, 1] : [0]) { const [eu, ev] = turn(dir, side * 1.6, 3); dollLimb(g, u + eu, v + ev, 4.5, u + eu, v + ev, 7.2, 0.5, dark); const [x, y] = Q(u + eu, v + ev, 7.6); ellipse(g, '#111', x, y, 1, 1); rect(g, '#fff', x - 0.6, y - 0.6, 0.6, 0.6); } }, 0.03);
      dollParts(g, dir, parts);
    });
  }
  // A slime: a wobbling dome of goo, see-through at its edge, with a glint on top and two dark eyes.
  function slimeDoll(g0, dir, frame) {
    shadow(g0, 16, 28, 11, 3);
    outlined(g0, g => {
      const sq = frame === 1 ? 1 : frame === 2 ? -1 : 0, fwd = FWD[dir], h = 10 - sq * 1.5, w = 10 + sq;
      for (let z = 0; z <= h; z += 0.5) { // a dome, slice by slice
        const r = w * Math.sqrt(Math.max(0, 1 - (z / h) ** 2)) + 0.4, [x, y] = Q(0, 0, z);
        const gr = g.createLinearGradient(x - r, y, x + r, y);
        gr.addColorStop(0, '#62d058'); gr.addColorStop(0.35, '#3ea83a'); gr.addColorStop(1, '#1a5a18');
        g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * DOLL_DEPTH, 0, 0, Math.PI * 2); g.fill();
      }
      const [tx, ty] = Q(-2.5, -1, h - 1.5); ellipse(g, 'rgba(220,255,210,0.75)', tx, ty, 2.2, 1.2); // a glint
      if (dir !== 0) { const [ex, ey] = Q(fwd[0] * 4, fwd[1] * 4, h * 0.55); for (const k of dir === 2 ? [-2, 2] : [0]) ellipse(g, '#0e2a0c', ex + k, ey, 1, 1.4); }
      for (const [a, b] of [[-6, 3], [5, 4], [1, -5]]) { const [x, y] = Q(a, b, 0.5); ellipse(g, 'rgba(60,170,55,0.55)', x, y, 1.6, 0.8); } // drips
    });
  }

  // A bear: a big round body on four thick legs, a hump at the shoulders, a round head with small ears and a snout.
  function bearDoll(g0, dir, frame, c = { fur: '#6a4428', dark: '#4a2e18', snout: '#8a6a4a' }) {
    shadow(g0, 16, 28, 13, 4);
    outlined(g0, g => {
      g.translate(16, 29); g.scale(1.2, 1.2); g.translate(-16, -29);
      const step = frame === 1 ? 1 : frame === 2 ? -1 : 0, fwd = FWD[dir], parts = [];
      const part = (a, b, z, draw, over = 0) => parts.push({ a, b, z, over, draw });
      for (const [a, b, ph] of [[-3, 3.5, 1], [3, 3.5, -1], [-3, -4, -1], [3, -4, 1]]) part(a, b, 3, (u, v) => { const [su, sv] = turn(dir, 0, step * ph * 1.3); dollLimb(g, u + su, v + sv, 0.8, u, v, 7, 2, c.dark); dollBall(g, u + su, v + sv, 0.8, 1.6, c.dark); });
      part(0, -3, 8, (u, v) => dollBall(g, u, v, 8, 5.4, c.fur));
      part(0, 2, 8.5, (u, v) => { dollBall(g, u, v, 9, 5.6, c.fur); const [x, y] = Q(u, v, 13.5); ellipse(g, shade(c.fur, 1.25), x - 1, y, 3, 1.2); }); // the hump
      part(0, 7, 10, (u, v) => {
        dollBall(g, u, v, 10, 3.8, c.fur);
        for (const side of [-1, 1]) { const [eu, ev] = turn(dir, side * 2.6, -0.5); dollBall(g, u + eu, v + ev, 13.4, 1.3, c.dark); }
        if (dir !== 0) {
          const [su, sv] = [u + fwd[0] * 3, v + fwd[1] * 3]; dollBall(g, su, sv, 9, 1.9, c.snout);
          const [nx, ny] = Q(su + fwd[0] * 1.5, sv + fwd[1] * 1.5, 9.5); ellipse(g, '#1a1010', nx, ny, 1, 0.8);
          for (const side of dir === 2 ? [-1, 1] : [0]) { const [eu, ev] = turn(dir, side * 1.6, 2.6); const [x, y] = Q(u + eu, v + ev, 11.2); rect(g, '#120a06', x - 0.5, y - 0.5, 1.1, 1.1); }
        }
      }, 0.01);
      dollParts(g, dir, parts);
    });
  }
  function creatureDrawer(key) {
    const look = lookFor(key);
    if (look) return (g, d, f) => (Sprites.PEOPLE === 'tilt' && tiltable(look) ? tiltPerson(g, look, d, f) : Sprites.PEOPLE === 'lean' && leanable(look) ? leanPerson(g, look, d, f) : Sprites.PEOPLE === 'art' && artable(look) ? artPerson(g, look, d, f) : Sprites.PEOPLE === 'hd' && hdable(look) ? hdPerson(g, look, d, f) : Sprites.PEOPLE === 'pixel' && pixelable(look) ? pixelPerson(g, look, d, f) : Sprites.DOLLS ? doll(g, look, d, f) : humanoid(g, look, d, f));
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
  const PAVED = { temple_paving: 0, paving: 0, cobble: 0, brick: 0, tiles: 0, gravel: 0, sandstone: 0, wood: 0, farmland: 0, bridge_ns: 0, bridge_ew: 0, sewer_bridge_ns: 0, sewer_bridge_ew: 0, marble: 0, carpet: 0 };
  // Water lies lowest: paving meets it at a stone edge, like a quay. Bridges take and give no borders:
  // they have their own beams.
  const BORDER_PRIORITY = { ...PAVED, bridge_ns: undefined, bridge_ew: undefined, sewer_bridge_ns: undefined, sewer_bridge_ew: undefined,
    water: -1, lava: -1, sewer_water: -1, sewer: 1, sand: 1, ash: 1, cave: 1, swamp: 2.2, dirt: 2, grass: 3, jungle: 3, snow: 4, mountain: 2.5, rock_top: 6 }; // grass lies over rocky ground, as over dirt
  // How a ground's edge looks where it spills over a lower one: shade (its shadow on the lower
  // ground), rim (the edge line), light (a bright line just inside), tufts or pebbles along it.
  const EDGE_STYLE = {
    default: { shade: 'rgba(0,0,0,0.16)', rim: 'rgba(0,0,0,0.28)' },
    // raised grounds (raise: how many pixels high their edge stands): side = [facing south, facing east, roots/stones],
    // rim = the darker south-east edge of the top, light = its lit north-west lip, blades = what hangs over the edge
    grass: { raise: 3, clumps: 1.1, shade: 'rgba(28,20,8,0.32)', rim: '#3e6a22', light: 'rgba(170,220,110,0.7)',
      side: ['#7a5430', '#5a3c1e', '#3c2812'], blades: ['#4f8a2c', '#3e7424', '#62a034'] },
    jungle: { raise: 3, clumps: 1.1, shade: 'rgba(10,20,8,0.35)', rim: '#1e4a1a', light: 'rgba(90,150,70,0.6)',
      side: ['#5a4228', '#3e2c18', '#241a0e'], blades: ['#275a22', '#3a7a32', '#1e4a1a'] },
    snow: { raise: 3, clumps: 1, shade: 'rgba(60,80,110,0.28)', rim: '#b8c8dc', light: 'rgba(255,255,255,0.9)',
      side: ['#d6e2ee', '#a8b8cc', '#8a9ab0'] },
    dirt: { raise: 2, clumps: 0.8, shade: 'rgba(30,20,8,0.28)', rim: '#6e4e2a', light: 'rgba(200,160,110,0.55)',
      side: ['#6a4a28', '#4e3418', '#3a2610'], pebbles: ['#a3845a', '#6e5230', '#b89a70'] },
    sand: { raise: 1, clumps: 0.6, shade: 'rgba(60,45,10,0.2)', rim: '#b8a070', light: 'rgba(250,240,205,0.75)',
      side: ['#c2a66a', '#a08550', '#8a7040'] },
    swamp: { raise: 1, clumps: 1, shade: 'rgba(10,15,8,0.3)', rim: '#36462a', light: 'rgba(120,140,80,0.5)',
      side: ['#3e3a22', '#2a2816', '#1a180c'], blades: ['#56683a', '#3f4f28'] },
    mountain: { shade: 'rgba(0,0,0,0.4)', rim: '#2a2a2a', light: 'rgba(220,220,214,0.6)' },
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
  // Raised grounds have round corners where they stick out (a convex corner: lower ground on both sides and across):
  // RR is the radius. rrDist: the distance from a point to a square [x0, y0]-[x1, y1] whose corners in `round`
  // ('tl', 'tr', 'bl', 'br') are rounded with radius RR; 0 inside.
  const RR = 24;
  function rrDist(cx, cy, x0, y0, x1, y1, round) {
    for (const c of round) {
      const kx = c[1] === 'l' ? x0 + RR : x1 - RR, ky = c[0] === 't' ? y0 + RR : y1 - RR;
      if ((c[1] === 'l' ? cx < kx : cx > kx) && (c[0] === 't' ? cy < ky : cy > ky)) return Math.max(0, Math.hypot(cx - kx, cy - ky) - RR);
    }
    return Math.hypot(Math.max(x0 - cx, 0, cx - x1), Math.max(y0 - cy, 0, cy - y1));
  }
  // Which corners of each neighbouring raised square (by its bit) stick out, seen from the lower tile with mask m
  // (all eight neighbours' bits, before corners were dropped).
  const roundCorners = (bit, m) => {
    const no = b => !(m & b), r = [];
    if (bit === 1) { if (no(128) && no(8)) r.push('bl'); if (no(16) && no(2)) r.push('br'); }
    if (bit === 4) { if (no(64) && no(8)) r.push('tl'); if (no(32) && no(2)) r.push('tr'); }
    if (bit === 8) { if (no(128) && no(1)) r.push('tr'); if (no(64) && no(4)) r.push('br'); }
    if (bit === 2) { if (no(16) && no(1)) r.push('tl'); if (no(32) && no(4)) r.push('bl'); }
    if (bit === 16) r.push('bl'); if (bit === 32) r.push('tl'); if (bit === 64) r.push('tr'); if (bit === 128) r.push('br');
    return r;
  };
  // A CSS colour as [r, g, b, a], via a 1-pixel canvas; each colour worked out once.
  const cssRgbs = new Map();
  let cssProbe = null;
  const cssRgb = c => {
    let v = cssRgbs.get(c);
    if (!v) {
      cssProbe = cssProbe || document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      cssProbe.clearRect(0, 0, 1, 1); cssProbe.fillStyle = c; cssProbe.fillRect(0, 0, 1, 1);
      cssRgbs.set(c, (v = cssProbe.getImageData(0, 0, 1, 1).data));
    }
    return v;
  };
  const EDGE_RECTS = [[1, 0, -32, 32, 0], [2, 32, 0, 64, 32], [4, 0, 32, 32, 64], [8, -32, 0, 0, 32],
    [16, 32, -32, 64, 0], [32, 32, 32, 64, 64], [64, -32, 32, 0, 64], [128, -32, -32, 0, 0]];
  function groundTexture(id) {
    if (id === 'temple_paving' || id === 'grass' || id === 'marble') return seamlessPart(id, 0, 0);
    return cached(`${id}::0:0`, g => DRAW[id](g, makeRng(hashStr(id)), 0));
  }

  // ---- the ground's pictures, made ahead of time --------------------------------------------------------------------
  // Making the ground's borders while you play (edges, rounded corners, scree, lips, shores, kerbs) is what stalls a slow
  // phone in new ground. tests/bake-ground.js makes every one the built-in world uses ahead of time, into one picture
  // (sprites/baked-ground.png, listed in sprites/baked-ground.js as BAKED_GROUND), and the game takes them from there.
  // Only if they still match: a fingerprint of the code that draws them and of the textures they're made of
  // (groundFingerprint) must be the one they were made with; else they're made as before. Bake again after changing
  // either (node tests/bake-ground.js): the game says so in the console.
  const BAKED_KINDS = ['edge9:', 'cut3:', 'foot:', 'lip:', 'kerb:']; // (shores are few and quick: made as we go)
  const baked = { img: null, index: null, ok: undefined };
  if (typeof BAKED_GROUND !== 'undefined' && BAKED_GROUND.keys) {
    baked.index = new Map(BAKED_GROUND.keys.map((k, i) => [k, i]));
    baked.img = new Image();
    baked.img.src = `sprites/baked-ground.png?f=${BAKED_GROUND.fingerprint}`;
  }
  function bakedPicture(key) {
    if (!baked.index || !baked.index.has(key)) return null;
    if (baked.ok === undefined) {
      if (!baked.img.complete || !baked.img.naturalWidth || [...custom.values()].some(i => !i.complete)) return null; // (not loaded yet)
      baked.ok = groundFingerprint() === BAKED_GROUND.fingerprint;
      if (!baked.ok) console.info('Tilequest: the baked ground pictures are out of date; making them as we go. Run node tests/bake-ground.js.');
    }
    if (!baked.ok) return null;
    const i = baked.index.get(key), T = BAKED_GROUND.tile, cols = BAKED_GROUND.cols, c = document.createElement('canvas');
    c.width = c.height = T;
    c.getContext('2d').drawImage(baked.img, (i % cols) * T, Math.floor(i / cols) * T, T, T, 0, 0, T, T);
    return c;
  }
  // What the ground's pictures are made from: the code that draws them, and the textures (sampled), as one number.
  function groundFingerprint() {
    const parts = ['edge', 'cornerCut', 'foot', 'lip', 'shore', 'kerb'].map(k => String(Sprites[k]));
    parts.push(String(rrDist), String(roundCorners), String(texturePixels), String(seamlessPart), String(groundTexture), JSON.stringify(EDGE_STYLE), JSON.stringify(PAVED));
    for (const id of Object.keys(THINGS)) if (THINGS[id].ground && DRAW[id]) parts.push(id, String(DRAW[id]));
    for (const [id, k] of Object.entries(SEAMLESS)) parts.push(id, String(k.draw), k.tiles);
    try {
      const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      probe.canvas.width = probe.canvas.height = 16;
      for (const [id, img] of [...custom].filter(([id]) => SEAMLESS[id] || (THINGS[id] && THINGS[id].ground)).sort()) { // (only the ground's own textures: not people, statues...)
        if (!img.naturalWidth) { parts.push(id, 'none'); continue; }
        probe.clearRect(0, 0, 16, 16); probe.drawImage(img, 0, 0, 16, 16);
        parts.push(id, img.naturalWidth, img.naturalHeight, Array.from(probe.getImageData(0, 0, 16, 16).data).join(','));
      }
    } catch (e) { return 'unreadable'; } // (over file:// the textures can't be read: make the pictures as we go)
    let h = 0;
    for (const p of parts) h = (Math.imul(h, 31) + hashStr(String(p))) >>> 0;
    return `${h.toString(16)}-${parts.join('').length}`;
  }

  // Your own PNGs: list them in sprites/custom.js as CUSTOM_SPRITES = { id: 'file.png' }.
  // Creature images can be a single 32x32 picture or a 96x128 sheet: 3 frames
  // (standing, step, step) across, directions north, east, south, west down.
  const custom = new Map();
  if (typeof CUSTOM_SPRITES !== 'undefined') {
    for (const [id, file] of Object.entries(CUSTOM_SPRITES)) {
      const img = new Image();
      // Replace cached fallback ground and its edge pixels when the atlas arrives.
      if (id === 'temple_paving' || id === 'grass' || id === 'marble' || id === 'temple_wall_texture' || id === 'carpet_texture' || id === 'water_texture' ) img.onload = () => { cache.clear(); texturePixels.cache.clear(); baked.ok = undefined; };
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

  // People and the beasts done so far are built in 3D (dolls); the rest are still drawn as pictures.
  // Connected carpet tiles share one textile; only exposed sides have a hem.
  // One current frame per atlas position: animation memory stays bounded.
  const waterFrames = new Map();
  // Water frames kept for good, up to WATER_KEEP bytes of pixels: less on a phone (touch screen), where memory is tight.
  const waterKept = new Map(), WATER_KEEP = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 32 : 128) * 1024 * 1024;
  waterKept.bytes = 0;
  function waterTile(x, y, time, size = TILE) {
    const image = customImage('water_texture');
    if (!image) return null;
    const phase = Math.floor(time / 80) % 80, angle = phase * Math.PI / 40;
    const px = ((x % 16) + 16) % 16, py = ((y % 16) + 16) % 16;
    const big = cached('water:surface', g => {
      g.imageSmoothingEnabled = true;
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
        g.save(); g.translate(x ? 1024 : 0, y ? 1024 : 0);
        g.scale(x ? -1 : 1, y ? -1 : 1); g.drawImage(image, 0, 0, 512, 512); g.restore();
      }
    }, 1024);
    // Every frame of every place is kept once worked out (the ripples go round in 80 frames), up to WATER_KEEP bytes;
    // past that, the rest are worked out again each time in one canvas per place, as before.
    if (waterKept.image !== image) { waterKept.clear(); waterKept.image = image; waterKept.bytes = 0; }
    const kept = waterKept.get(`${px}:${py}:${size}:${phase}`);
    if (kept) return kept;
    const keep = waterKept.bytes < WATER_KEEP, key = `${px}:${py}:${size}`;
    let entry = keep ? null : waterFrames.get(key);
    if (entry && entry.phase === phase && entry.image === image) return entry.canvas;
    if (!entry) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      entry = { canvas };
      if (keep) { waterKept.set(`${px}:${py}:${size}:${phase}`, canvas); waterKept.bytes += size * size * 4; } else waterFrames.set(key, entry);
    }
    const g = entry.canvas.getContext('2d');
    const pixels = big.waterPixels || (big.waterPixels = big.getContext('2d').getImageData(0, 0, 1024, 1024).data);
    const tile = entry.data || (entry.data = waterKept[size] || (waterKept[size] = g.createImageData(size, size))); // (one buffer per size)
    // The ripples: each wave depends on the row or on the column only, so they're worked out once per row and column
    // (not per pixel: that was most of a frame's time wherever there was a lot of water in view).
    const waveRow = new Float64Array(size), waveCol = new Float64Array(size), swellCol = new Float64Array(size);
    for (let k = 0; k < size; k++) {
      const wy = py * 64 + k * 64 / size, wx = px * 64 + k * 64 / size;
      waveRow[k] = 7 * Math.sin(wy * Math.PI / 128 - angle);
      waveCol[k] = 3 * Math.sin(angle * 2 + wx * Math.PI / 256);
      swellCol[k] = 4 * Math.sin(wx * Math.PI / 256 + angle);
    }
    const step = 64 / size, out = tile.data, colU = new Float64Array(size), colV = new Float64Array(size);
    for (let col = 0; col < size; col++) { colU[col] = px * 64 + col * step + waveCol[col] + 1024; colV[col] = swellCol[col] + 1024; }
    for (let row = 0, o = 0; row < size; row++) {
      const wr = waveRow[row], wy = py * 64 + row * step;
      for (let col = 0; col < size; col++, o += 4) { // a bilinear sample of the surface at (u, v)
        const u = colU[col] + wr, v = wy + colV[col];
        let ix = u | 0, iy = v | 0;
        const fx = u - ix, fy = v - iy;
        ix &= 1023; iy &= 1023;
        const ix1 = (ix + 1) & 1023, iy1 = (iy + 1) & 1023;
        const p00 = ((iy << 10) | ix) << 2, p10 = ((iy << 10) | ix1) << 2, p01 = ((iy1 << 10) | ix) << 2, p11 = ((iy1 << 10) | ix1) << 2;
        const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        out[o] = pixels[p00] * w00 + pixels[p10] * w10 + pixels[p01] * w01 + pixels[p11] * w11;
        out[o + 1] = pixels[p00 + 1] * w00 + pixels[p10 + 1] * w10 + pixels[p01 + 1] * w01 + pixels[p11 + 1] * w11;
        out[o + 2] = pixels[p00 + 2] * w00 + pixels[p10 + 2] * w10 + pixels[p01 + 2] * w01 + pixels[p11 + 2] * w11;
        out[o + 3] = 255;
      }
    }
    g.putImageData(tile, 0, 0); entry.phase = phase; entry.image = image;
    return entry.canvas;
  }

  function carpetTile(x, y, shape) {
    const bits = /^[01]{4}$/.test(shape) ? shape : '0000';
    const [n, e, s, w] = [...bits].map(v => v === '1');
    const px = !w ? 0 : !e ? 2 : 1, py = !n ? 0 : !s ? 2 : 1;
    return cached(`carpet:rounded:${bits}:${px}:${py}`, g => {
      // Transparent corners expose the actual floor; this sprite contains only cloth.
      const outline = inset => {
        const left = w ? -16 : 2 + inset, top = n ? -16 : 2 + inset;
        const right = e ? TILE + 16 : TILE - 2 - inset, bottom = s ? TILE + 16 : TILE - 2 - inset;
        const radius = Math.max(0, 8 - inset);
        g.beginPath();
        g.roundRect(left, top, right - left, bottom - top,
          [!n && !w ? radius : 0, !n && !e ? radius : 0,
            !s && !e ? radius : 0, !s && !w ? radius : 0]);
      };
      g.save(); outline(0); g.clip();
      const image = customImage('carpet_texture');
      if (image) {
        g.imageSmoothingEnabled = false;
        const sx = !e && !w ? TILE : px * TILE;
        g.drawImage(image, sx, py * TILE, TILE, TILE, 0, 0, TILE, TILE);
      } else DRAW.carpet(g);
      g.restore();
      // A cloth binding with small muted stitches, rather than a metallic frame.
      g.save();
      outline(1); g.lineWidth = 2; g.strokeStyle = '#62262a'; g.stroke();
      outline(1.5); g.lineWidth = 0.75; g.strokeStyle = '#a5824b';
      g.setLineDash([1, 2]); g.stroke();
      g.restore();
    });
  }

  const DOLLS_ON = true;
  return {
    water: (x, y) => waterTile(x, y, 0, 64), // (still: the water kept in the ground's chunks; open water ripples over it)
    // Open water's ripples: WATER_PHASES pictures a place, a loop of 6.4 s; null until made (warmWater makes them ahead).
    WATER_PHASES: 20,
    waterFrame(x, y, time) {
      const n = Sprites.WATER_PHASES, k = Math.floor(time / (6400 / n)) % n, px = ((x % 16) + 16) % 16, py = ((y % 16) + 16) % 16;
      return waterKept.get(`${px}:${py}:${TILE}:${(k * 80) / n}`) || null;
    },
    // Jobs that make every picture of the ripples, for the quiet time between frames.
    warmWater() {
      const jobs = [], n = Sprites.WATER_PHASES;
      for (let k = 0; k < n; k++) for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) jobs.push(() => waterTile(px, py, ((k * 80) / n) * 80, TILE));
      return jobs;
    },
    // Sprite for a map thing at map position (x, y); position picks the variant.
    // Trees, walls and wall decorations are 64x64 and must be drawn anchored at
    // the bottom-right of their tile; `shape` is which neighbours a thin wall joins
    // ('wnse' flags, see wallBlock), and `material` the wall a door sits in.
    thing(id, x = 0, y = 0, time = 0, shape = '1100', material = 'wall_stone') {
      if (id === 'carpet_rug') return carpetTile(x, y, arguments.length < 5 ? '0000' : shape);
      if (id === 'water') time = 0; // (the ground's water is still: the ripples go over it, see waterFrame)
      if (id === 'water') { const surface = waterTile(x, y, time); if (surface) return surface; }
      const own = customImage(id);
      if (id === 'temple_paving' || id === 'grass' || id === 'marble') return seamlessPart(id, x, y);
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
    DOLLS: DOLLS_ON,
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
    CREATURE_RES: 2,
    BUILD: 'classic', // how people are built: see BUILDS
    // for tests/bake-ground.js: the ground's pictures made so far ([key, canvas]), and the fingerprint they're made with
    bakeable: () => [...cache].filter(([k]) => BAKED_KINDS.some(p => k.startsWith(p))),
    groundFingerprint: () => groundFingerprint(),
    WATER_MOVES: true, // the water ripples: open water shows a loop of WATER_PHASES pictures, made ahead (see waterFrame)
    PLAYER_SHEET: true, // players drawn from sprites/player-sheet.png, when it's there (playerFromSheet)
    TILT: 0, // how far people lean, in degrees (along the world's lean: head up to the left); upright, as the owner chose
    PEOPLE: 'tilt', // people as a plain figure tilted along the world's lean ('tilt'); tried before: 'art', 'hd', 'doll', 'pixel', 'lean'
    // how far above its tile a creature's head reaches (a large person's does), for its name and bars
    // where a person's head and shoulders are on its picture [x, y, w, h], for portraits; null: the usual place
    faceBox(c) {
      if (ownSheet(c)) return [TILE + 6, TILE - 8, 20, 20]; // (a sheet's head)
      if (Sprites.PEOPLE !== 'tilt' || !c) return null;
      const def = c.type === 'npc' && NPCS[c.npcId];
      if (!(c.type === 'player' || (def && !def.creature && tiltable(def.look)))) return null;
      const t = (Sprites.TILT || 0) * Math.PI / 180, fx = 16 + 5 * Math.sin(t) / 0.6, hx = fx - 27 * Math.sin(t), hy = 28.5 - 27 * Math.cos(t);
      return [TILE + hx - 10, TILE + hy - 8, 20, 20]; // (the head a little above the middle)
    },
    headroom(c) {
      if (ownSheet(c)) return 7; // (the sheets' figures reach 7 above their tile)
      const tiltRise = Math.max(0, Math.ceil(34 * Math.cos((Sprites.TILT || 0) * Math.PI / 180) - 28.5)); // (a tilted figure's head reaches higher the straighter it stands)
      const rise = Sprites.PEOPLE === 'art' ? ART_RISE : Sprites.PEOPLE === 'hd' ? HD_RISE : Sprites.PEOPLE === 'tilt' ? tiltRise : 0;
      const able = Sprites.PEOPLE === 'art' ? artable : Sprites.PEOPLE === 'tilt' ? tiltable : hdable;
      if (!rise || !c) return 0;
      if (c.type === 'player') return rise;
      const def = c.type === 'npc' && NPCS[c.npcId];
      return def && !def.creature && able(def.look) ? rise : 0;
    },
    // a picture's size in world pixels (creatures are drawn finer: see creature())
    w: img => img.width / (img.res || 1),
    h: img => img.height / (img.res || 1),
    creature(key, dir, frame = 0) {
      if (key.startsWith('npc:') && NPCS[key.slice(4)].creature) key = NPCS[key.slice(4)].creature; // an NPC that looks like a monster
      const base = key.startsWith('player:') ? 'player' : key;
      const own = customImage(base);
      if (own) {
        if (own.naturalWidth < 96 || own.naturalHeight < 128) return own;
        return cached(`own:${base}:${dir}:${frame}`, g => g.drawImage(own, frame * TILE, dir * TILE, TILE, TILE, 0, 0, TILE, TILE));
      }
      // Drawn at CREATURE_RES canvas pixels per world pixel (the picture says so in its .res), so a figure is as sharp
      // as the screen shows it, not a small picture blown up; whatever draws one draws it at its world size (resOf).
      if (key.startsWith('player:') && Sprites.PLAYER_SHEET && customImage('player_sheet')) return playerFromSheet(key, dir, frame);
      if (key.startsWith('npc:') && customImage(`sheet_${key.slice(4)}`)) return npcFromSheet(key.slice(4), dir, frame);
      const look = lookFor(key), big = (look && look.scale > 1) || BIG_BEASTS.includes(key) || (Sprites.PEOPLE === 'hd' && hdable(look)) || (Sprites.PEOPLE === 'art' && artable(look)) || (Sprites.PEOPLE === 'lean' && leanable(look)) || (Sprites.PEOPLE === 'tilt' && tiltable(look)), R = (Sprites.PEOPLE === 'lean' && leanable(look)) || (Sprites.PEOPLE === 'tilt' && tiltable(look)) ? 1 : Sprites.CREATURE_RES; // (lean people: a pixel per world pixel)
      return cached(`c:${key}:${dir}:${frame}${Sprites.DOLLS ? ':doll' : ''}:${R}:${Sprites.BUILD}:${Sprites.PEOPLE}:${Sprites.TILT}`, g => {
        g.canvas.res = R;
        g.scale(R, R);
        if (big) g.translate(TILE, TILE);
        creatureDrawer(key)(g, dir, frame);
      }, (big ? 2 * TILE : TILE) * R);
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
        white.res = img.res;
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
        g.scale(2, 2);
        const turn = { n: 0, e: 1, s: 2, w: 3, ne: 0, se: 1, sw: 2, nw: 3 }[d];
        g.translate(16, 16); g.rotate(turn * Math.PI / 2); g.translate(-16, -16);
        const angle = frame * Math.PI / 16, lap = 1.8 * Math.sin(angle);
        const shallow = d.length === 1 ? g.createLinearGradient(0, 0, 0, 18) : g.createRadialGradient(32, 0, 0, 32, 0, 18);
        shallow.addColorStop(0, 'rgba(16,48,49,0.75)');
        shallow.addColorStop(0.32, 'rgba(75,162,163,0.65)');
        shallow.addColorStop(1, 'rgba(80,175,192,0)');
        g.fillStyle = shallow; g.fillRect(0, 0, 32, 32);
        g.lineWidth = 0.9; g.strokeStyle = 'rgba(213,239,224,0.5)';
        g.beginPath();
        if (d.length === 1) {
          for (let x = 0; x <= 32; x++) {
            const y = 10 + lap + Math.sin(x * Math.PI / 16 + angle) * 0.8;
            if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
          }
        } else g.arc(32, 0, 10 + lap, Math.PI / 2, Math.PI);
        g.stroke();
      }, 64);
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
    // A raised ground's own corner rounded off where a lower ground lies on both sides of it and across the corner
    // (corner: 'ne', 'se', 'sw' or 'nw'): the lower ground's texture fills the cut, and the raised ground's side
    // and rim run round the curve, so a trail winds round the end of a clump of grass instead of a square block.
    cornerCut(high, low, corner, x, y) {
      const kh = SEAMLESS[high], kl = SEAMLESS[low], pos = (k, n) => k ? `${((n % k.tiles) + k.tiles) % k.tiles}` : '';
      return cached(`cut3:${high}:${low}:${corner}:${pos(kh, x)}:${pos(kh, y)}:${pos(kl, x)}:${pos(kl, y)}`, g => {
        const st = edgeStyle(high), lift = st.raise || 0;
        if (!lift) return;
        const lowTex = texturePixels(low, x, y);
        const rgb = cssRgb;
        const side = st.side.map(rgb), rim = rgb(st.rim), light = rgb(st.light || st.rim), shade = rgb(st.shade);
        // this tile as a square with that corner rounded, grown by the edge's width (as its neighbours see it)
        const round = [{ ne: 'tr', se: 'br', sw: 'bl', nw: 'tl' }[corner]], width = st.width || 5;
        const out = (px, py) => rrDist(px, py, 0, 0, TILE, TILE, round) - width;
        const img = g.createImageData(TILE, TILE), d = img.data;
        const put = (i, c, a = c[3] / 255) => {
          const o = d[i + 3] / 255, na = a + o * (1 - a);
          if (!na) return;
          for (let j = 0; j < 3; j++) d[i + j] = (c[j] * a + d[i + j] * o * (1 - a)) / na;
          d[i + 3] = na * 255;
        };
        for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
          const cx = px + 0.5, cy = py + 0.5, i = (py * TILE + px) * 4, e = out(cx, cy);
          if (e < 0) { // still the raised ground (left as it is), but its rim along the curve
            if (e > -1.2) { if (out(cx - 1, cy - 1) >= 0) put(i, light, 0.75); else put(i, rim); }
            continue;
          }
          for (let j = 0; j < 4; j++) d[i + j] = lowTex[i + j];
          if (out(cx - lift, cy - lift) < 0) { const c = side[out(cx, cy - lift) < 0 ? 0 : 1]; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; }
          else if (out(cx - lift - 1.5, cy - lift - 1.5) < 0) put(i, shade);
        }
        g.putImageData(img, 0, 0);
      });
    },
    edge(ground, mask, variant, x, y, crisp = false) { // crisp: over built ground (paving, floors): square corners
      const corners = [[16, 1, 2], [32, 4, 2], [64, 4, 8], [128, 1, 8]], all = mask;
      for (const [c, a, b] of corners) if (mask & (a | b)) mask &= ~c; // a corner only counts on its own
      const k = SEAMLESS[ground], pos = k ? `${((x % k.tiles) + k.tiles) % k.tiles}:${((y % k.tiles) + k.tiles) % k.tiles}` : '';
      return cached(`edge9:${ground}:${mask}:${all}:${variant}:${pos}:${crisp ? 1 : 0}`, g => {
        const st = edgeStyle(ground), tex = texturePixels(ground, x, y);
        const width = st.width || 5, amp = st.wobble === undefined ? 1 : st.wobble, lift = st.raise || 0;
        const k1 = [2, 3, 4][variant], k2 = [5, 7, 6][variant];
        // border jitter: a slow wander of the line, never a repeating zigzag
        // (a raised ground's edge also has clumps: shorter bumps, zero at the tile's sides so neighbours still meet)
        const clump = st.clumps || 0, k3 = [9, 11, 13][variant], k4 = [15, 17, 19][variant];
        const wob0f = t => amp * (1.1 * Math.sin(k1 * Math.PI * t) + 0.5 * Math.sin(k2 * Math.PI * t));
        const wobf = t => wob0f(t) + clump * Math.sin(Math.PI * t) * (0.7 * Math.sin(k3 * Math.PI * t + variant) + 0.45 * Math.sin(k4 * Math.PI * t + 2 * variant));
        // Every point asked about lies on a half-pixel grid (x + 0.5, less whole or half pixels): the wobbles and the
        // distances are worked out once per point of it (from M0 to M0 + MN / 2), not again for every pixel near it.
        const M0 = -16, MN = 128, onGrid = v => { const k = (v - M0) * 2; return k >= 0 && k < MN && k === (k | 0) ? k : -1; };
        const wobT = new Float64Array(MN), wob0T = new Float64Array(MN);
        for (let k = 0; k < MN; k++) { wobT[k] = wobf((M0 + k / 2) / TILE); wob0T[k] = wob0f((M0 + k / 2) / TILE); }
        const wob0 = t => { const k = onGrid(t * TILE); return k < 0 ? wob0f(t) : wob0T[k]; };
        const wob = t => { const k = onGrid(t * TILE); return k < 0 ? wobf(t) : wobT[k]; };
        const rects = EDGE_RECTS.filter(([bit]) => mask & bit);
        const img = g.createImageData(TILE, TILE), d = img.data;
        // colours as [r, g, b, a] from CSS, via a 1-pixel canvas
        const rgb = cssRgb;
        const rim = rgb(st.rim), light = st.light && rgb(st.light), shade = rgb(st.shade), dots = st.tufts || st.pebbles;
        const dotRgb = dots && dots.map(rgb);
        const side = st.side && st.side.map(rgb), blades = st.blades && st.blades.map(rgb);
        const put = (i, c, a = c[3] / 255) => { // blend c over what's there
          const o = d[i + 3] / 255, na = a + o * (1 - a);
          if (!na) return;
          for (let j = 0; j < 3; j++) d[i + j] = (c[j] * a + d[i + j] * o * (1 - a)) / na;
          d[i + 3] = na * 255;
        };
        const ROUND = 9; // how round the edge turns where two neighbours meet (raised grounds)
        const hash = (px, py, s = 0) => (((px * 73856093) ^ (py * 19349663) ^ ((variant + s) * 83492791)) >>> 0) % 100;
        // how far a point lies outside the higher ground's top (negative: on it)
        let smoothOnly = false; // (the side below the edge follows the edge without its clumps: no brown teeth)
        const outMemo = new Float64Array(MN * MN * 2).fill(NaN);
        const out = (cx, cy) => {
          const kx = onGrid(cx), ky = onGrid(cy), mi = kx < 0 || ky < 0 ? -1 : ((smoothOnly ? MN * MN : 0) + ky * MN + kx);
          if (mi >= 0 && outMemo[mi] === outMemo[mi]) return outMemo[mi];
          const v = outCalc(cx, cy);
          if (mi >= 0) outMemo[mi] = v;
          return v;
        };
        const outCalc = (cx, cy) => {
          let dist = 99;
          // a smooth minimum over the neighbours, so where two of them meet the edge curves round instead of turning
          // a sharp corner: a trail winds through the grass rather than stepping in squares
          let sum = 0;
          for (const [bit, x0, y0, x1, y1] of rects) {
            const d = lift && !crisp ? rrDist(cx, cy, x0, y0, x1, y1, roundCorners(bit, all)) : Math.hypot(Math.max(x0 - cx, 0, cx - x1), Math.max(y0 - cy, 0, cy - y1));
            dist = Math.min(dist, d);
            sum += Math.exp(-d / ROUND);
          }
          if (lift && !crisp && sum > 0) dist = Math.min(dist, -ROUND * Math.log(sum));
          return dist - (width + (smoothOnly ? wob0(cx / TILE) + wob0(cy / TILE) : wob(cx / TILE) + wob(cy / TILE)));
        };
        const outS = (cx, cy) => { smoothOnly = true; const v = out(cx, cy); smoothOnly = false; return v; };
        for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
          const cx = px + 0.5, cy = py + 0.5, i = (py * TILE + px) * 4, e = out(cx, cy);
          if (lift) {
            // A raised ground (PixelLab's transition layer): its top, lit on the north-west and edged darker on the
            // south-east, then its side showing below it on the south and east (it stands lift pixels high, and
            // height goes up-left), then its shadow on the lower ground.
            if (e < 0) {
              for (let j = 0; j < 4; j++) d[i + j] = tex[i + j];
              if (out(cx - 1, cy - 1) >= 0) put(i, light || rim, hash(px, py, 9) < 60 ? 0.8 : 0.3); // the lit north-west lip, blade by blade
              else if (out(cx + 1, cy + 1) >= 0) put(i, rim);                     // its darker south-east edge
              continue;
            }
            const below = outS(cx - lift, cy - lift) < 0 && outS(cx, cy) >= -0.5, under = outS(cx, cy - lift) < 0;
            if (below) { // the side: facing south (where the top is straight above) a little lit, facing east in shade
              const c = side[under ? 0 : 1];
              d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
              if (under && out(cx, cy - lift + 1) < 0 && out(cx - 1, cy - lift) < 0 && out(cx + 1, cy - lift) < 0) put(i, side[2], 0.7); // roots, just under the top
              else if (hash(px, py) < 12) put(i, side[2], 0.6); // stones and roots in the soil
            } else if (outS(cx - lift - 1.5, cy - lift - 1.5) < 0) put(i, shade); // the soft shadow it casts south-east
            // blades of grass hanging over its edge, here and there
            if (blades && e < 4 && hash(px >> 1, py, 7) < 34 && out(cx, cy - 1 - (hash(px, py, 3) % 3)) < 0) put(i, blades[hash(px, py, 5) % blades.length], 1);
            continue;
          }
          const dist = e + width; // (the older flat edge, for grounds that lie flat on the lower one)
          const r = width;
          if (e < -1) {
            for (let j = 0; j < 4; j++) d[i + j] = tex[i + j];
            if (light && e >= -2) put(i, light);
          } else if (e < 0) {
            d[i] = rim[0]; d[i + 1] = rim[1]; d[i + 2] = rim[2]; d[i + 3] = rim[3] || 255;
          } else if (e < (st.lip || 1.5)) put(i, shade);
          if (dotRgb && dist > r - 2 && dist < r + 1.5) {
            const h = hash(px, py);
            if (h < 9) put(i, dotRgb[h % dotRgb.length], 1);
          }
        }
        g.putImageData(img, 0, 0);
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






