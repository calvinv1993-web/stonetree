'use strict';
// SORTIA's story panorama (browser only): one world of pictures and one camera that moves over it from stop to stop.
// The world has up to three depths (background, main, foreground), each a set of picture planes placed in the world's
// own units; every depth follows the same camera, at its own pace (its factor). What it shows comes from two plain
// files: the picture manifest (js/story-manifest.js; the placeholders in js/story-demo.js) and the story's stops
// (js/story-script.js). Intro (game-ui.js) tells the words and drives the camera. The formats, the development view
// and how to fill them in: docs/story-panorama.md.
//
// How it draws: every picture is an <img> at its file's own size, laid out once per screen size at the scale that fits
// the manifest's view height to the column (css px per world unit); the camera only moves (and, for the opening, zooms)
// whole depths with a transform, so nothing is redrawn, shrunk ahead or recompressed. Plane edges are snapped outwards to
// whole device pixels, so planes that meet leave no hairline between them.
const StoryPanorama = (() => {
  const DEPTHS = ['background', 'main', 'foreground'];
  const DEV_COLORS = { background: '#46b8ff', main: '#ffd34d', foreground: '#ff70d8' };
  const DECODE_WAIT = 900; // ms: the longest a move waits for its pictures to be decoded
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const meet = (a, b) => { const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y); return { x, y, w: Math.min(a.x + a.w, b.x + b.w) - x, h: Math.min(a.y + a.h, b.y + b.h) - y }; };
  const grow = (r, m) => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m });
  // the parts of a plane that are opaque: cover true (all of it), [x, y, w, h] or a list of those; a plane that drifts
  // (drift) counts only what stays covered wherever it drifts to
  // (the gap check moves them by the plane's drift for the camera it looks with)
  const coverRects = p => {
    if (!p.cover) return [];
    const list = p.cover === true ? [[p.x, p.y, p.w, p.h]] : Array.isArray(p.cover[0]) ? p.cover : [p.cover];
    return list.map(([x, y, w, h]) => ({ x, y, w, h, drift: p.drift })).filter(r => r.w > 0 && r.h > 0);
  };
  // A plane's own drift (drift in the manifest) for the camera at cam, the stops at cams: [x, y] world units
  function driftAt(d, cams, cam, m, colW, s0) {
    if (!d || !cam) return [0, 0];
    if (d.between) { // (one drift shared by a block of scenes: none at each of its stops, most half way between two)
      const at = d.between.map(i => cams[clamp(i, 0, cams.length - 1)]);
      for (let i = 0; i + 1 < at.length; i++) {
        const a = at[i], b = at[i + 1], t = b.x - a.x > 1 ? (cam.x - a.x) / (b.x - a.x) : -1;
        if (t > 0 && t < 1) { const e = Math.sin(Math.PI * t); return [(d.x || 0) * e, (d.y || 0) * e]; }
      }
      return [0, 0];
    }
    const home = cams[clamp(d.stop, 0, cams.length - 1)], others = cams.filter(c => c !== home).map(c => Math.abs(c.x - home.x)).filter(v => v > 1);
    const reach = d.reach || (others.length ? Math.min(...others) : colW / s0), ease = u => Math.sin(clamp(u, -1, 1) * Math.PI / 2);
    return [(d.x || 0) * ease((cam.x - home.x) / reach), (d.y || 0) * ease((cam.y - home.y) / (d.reach || m.view / 2))];
  }
  // a cover rect where its plane has drifted to, for the camera at cam
  const drifted = (r, cams, cam, m, colW, s0) => { if (!r.drift) return r; const [dx, dy] = driftAt(r.drift, cams, cam, m, colW, s0); return { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h }; };
  const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  // a picture's address: a path under sprites/ gets its own version (sprites/versions.js), as every picture in the game
  const pictureUrl = src => {
    if (/^(https?:|data:|blob:|\/|\.)/.test(src)) return src;
    const h = typeof SPRITE_HASHES !== 'undefined' && SPRITE_HASHES[src];
    return `sprites/${src}${h ? `?h=${h}` : ''}`;
  };

  // What's wrong with a manifest, in words (an empty list: nothing)
  function check(m) {
    const out = [];
    if (!m || !Array.isArray(m.world) || !(m.world[0] > 0) || !(m.world[1] > 0)) return ['world: [width, height] in world units is missing'];
    if (!(m.view > 0) || m.view > m.world[1]) out.push(`view: ${m.view} must be above 0 and at most the world's height (${m.world[1]})`);
    for (const key of Object.keys(m.layers || {})) if (!DEPTHS.includes(key)) out.push(`layers.${key}: only ${DEPTHS.join(', ')} are allowed`);
    for (const depth of DEPTHS) {
      const layer = m.layers && m.layers[depth];
      if (!layer) continue;
      if (!(layer.factor > 0)) out.push(`layers.${depth}.factor must be a number above 0`);
      const ids = new Set();
      (layer.planes || []).forEach((p, i) => {
        const where = `layers.${depth}.planes[${i}]${p.id ? ` (${p.id})` : ''}`;
        if (p.id && ids.has(p.id)) out.push(`${where}: the id is used twice`);
        ids.add(p.id);
        if (p.kind === 'glow') { if (![p.x, p.y, p.size].every(Number.isFinite)) out.push(`${where}: a glow needs x, y and size`); return; }
        if (!p.src && p.kind !== 'fill') out.push(`${where}: src is missing`);
        if (![p.x, p.y, p.w, p.h].every(Number.isFinite) || !(p.w > 0) || !(p.h > 0)) out.push(`${where}: x, y, w and h must be numbers, w and h above 0`);
      });
    }
    return out;
  }

  // The camera's stop positions for a column of colW x colH css px: each stop's focus (its at, or the world's middle),
  // held so the view never shows past the world's edges
  function stopCams(m, stops, colW, colH, band) {
    const [W, H] = m.world, s0 = colH / m.view;
    return stops.map(st => {
      // frame: [x, y, w, h], the world the view must stay inside at this stop (a scene of its own): close enough in for
      // it to fill the screen, and held within it
      const [fx, fy, fw, fh] = st.frame || [0, 0, W, H];
      let zoom = Math.max(st.zoom > 0 ? st.zoom : 1, st.frame ? Math.max(colW / (s0 * fw), colH / (s0 * fh)) : 0);
      const at = st.at || [fx + fw / 2, fy + fh / 2];
      // below: how far (world units) the view may reach under the frame, where the words' dark shade covers the screen
      // and the scene's fill (a plane) carries its picture's dark foot on
      const below = st.below || 0, held = (z, x, y) => {
        const hw = colW / (2 * s0 * z), hh = colH / (2 * s0 * z);
        return { x: fw >= 2 * hw ? clamp(x, fx + hw, fx + fw - hw) : fx + fw / 2, y: fh + below >= 2 * hh ? clamp(y, fy + hh, fy + fh + below - hh) : fy + fh / 2, zoom: z };
      };
      // keep: [x, y, w, h], what must be seen whole in the part of the screen the words leave free (band: [top, bottom]
      // css px, given by the story): the view moved from where it would be no more than needed for that (down into the
      // room below the frame if it must), the camera coming a little closer if the frame allows no room
      if (st.keep && band) {
        const [kx, ky, kw, kh] = st.keep, [bt, bb] = band;
        const place = z => {
          const s = s0 * z, hw = colW / (2 * s), c = held(z, at[0], at[1]);
          let y = c.y;
          const top = (ky - y) * s + colH / 2, foot = (ky + kh - y) * s + colH / 2;
          if (kh * s > bb - bt) y = ky + kh - (bb - colH / 2) / s; // (too tall for the free part: its foot kept clear of the words)
          else if (foot > bb) y += (foot - bb) / s;
          else if (top < bt) y -= (bt - top) / s;
          return { want: y, got: held(z, clamp(c.x, kx + kw - hw, kx + hw), y) };
        };
        let best = place(zoom);
        for (let z = zoom * 1.01; Math.abs(best.got.y - best.want) > 0.5 && z < zoom * 2.5; z *= 1.01) {
          if (kh * s0 * z > bb - bt || kw * s0 * z > colW) break; // (closer would no longer fit)
          best = place(z);
        }
        return best.got;
      }
      return held(zoom, at[0], at[1]);
    });
  }
  // Where a depth's own camera is when the main one is at cam. 'stops' (the default): at every stop each depth shows its
  // pictures exactly as placed, and between two stops the depths drift apart (most half way) by their factor, as if
  // the far ones fell behind and the near ones ran ahead; 'anchor': classic parallax around the manifest's anchor.
  function depthCam(m, cams, factor, cam) {
    if (factor === 1) return cam;
    if (m.parallax === 'anchor') {
      const [ax, ay] = m.anchor || [m.world[0] / 2, m.world[1] / 2];
      return { x: ax + (cam.x - ax) * factor, y: ay + (cam.y - ay) * factor, zoom: cam.zoom };
    }
    const byX = cams.slice().sort((a, b) => a.x - b.x);
    for (let i = 0; i + 1 < byX.length; i++) {
      const a = byX[i], b = byX[i + 1];
      if (b.x - a.x < 1 || cam.x < a.x || cam.x > b.x) continue;
      const t = (cam.x - a.x) / (b.x - a.x), k = Math.sin(Math.PI * t) / Math.PI * (factor - 1);
      return { x: cam.x + k * (b.x - a.x), y: cam.y + k * (b.y - a.y), zoom: cam.zoom };
    }
    return cam;
  }
  // The world a depth shows (in its own coordinates) with the main camera at cam
  const frame = (m, cams, factor, cam, colW, colH, extra = 1) => {
    const c = depthCam(m, cams, factor, cam), s = (colH / m.view) * cam.zoom * extra;
    return { x: c.x - colW / 2 / s, y: c.y - colH / 2 / s, w: colW / s, h: colH / s };
  };
  // The camera between the stops: by a fraction along the story (u: 0 at the first stop, 1 at the second, ...), or by
  // where it is across (x: for a drag)
  const lerpCam = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, zoom: a.zoom + (b.zoom - a.zoom) * t });
  function camAlong(cams, u) {
    const i = clamp(Math.floor(u), 0, cams.length - 2);
    return cams.length < 2 ? cams[0] : lerpCam(cams[i], cams[i + 1], clamp(u - i, 0, 1));
  }
  function camAtX(cams, x) {
    const byX = cams.slice().sort((a, b) => a.x - b.x);
    if (x <= byX[0].x) return { ...byX[0], x };
    for (let i = 0; i + 1 < byX.length; i++) if (x <= byX[i + 1].x) { const a = byX[i], b = byX[i + 1]; return { ...lerpCam(a, b, b.x > a.x ? (x - a.x) / (b.x - a.x) : 0), x }; }
    return { ...byX[byX.length - 1], x };
  }
  // The planes a depth needs to show around a frame (a margin of a quarter frame, so a move never starts on a blank)
  const planesIn = (layer, r) => (layer.planes || []).filter(p => !p.kind && hit({ x: p.x, y: p.y, w: p.w, h: p.h }, grow(r, r.w / 4)));

  // The pictures to fetch ahead for the first stops, without a page laid out yet (the gate loads these while it waits)
  function pictures(m, stops, upTo = 1) {
    const colW = Math.min(innerWidth || 390, 540), colH = Math.max(560, innerHeight || 800), cams = stopCams(m, stops, colW, colH), urls = new Set();
    for (let i = 0; i <= Math.min(upTo, cams.length - 1); i++) {
      for (const depth of DEPTHS) {
        const layer = m.layers[depth];
        if (layer) for (const p of planesIn(layer, frame(m, cams, layer.factor, cams[i], colW, colH))) urls.add(pictureUrl(p.src));
      }
    }
    return [...urls];
  }

  // Where the screen would show nothing, along the whole way the camera can go: the camera at every stop, every few
  // world units between them, past either end as far as a drag may pull (overscroll, css px, never past the world's
  // edges) and in the opening's zoom.
  // A point is covered when a plane marked cover (all of it opaque, or the [x, y, w, h] part of it that is) of any
  // depth lies under it. Returns the points left bare, with the camera that sees them.
  function gaps(m, stops, colW, colH, { overscroll = 48, opening = 1, band } = {}) {
    const cams = stopCams(m, stops, colW, colH, band), s0 = colH / m.view, byX = cams.slice().sort((a, b) => a.x - b.x);
    const covers = [];
    for (const depth of DEPTHS) {
      const layer = m.layers[depth];
      if (!layer) continue;
      for (const p of layer.planes || []) {
        for (const r of coverRects(p)) covers.push({ depth, factor: layer.factor, r });
      }
    }
    const samples = [];
    for (let i = 0; i + 1 < byX.length; i++) for (let k = 0; k < 16; k++) samples.push(camAtX(cams, byX[i].x + (byX[i + 1].x - byX[i].x) * k / 16));
    samples.push(...cams);
    const first = byX[0], last = byX[byX.length - 1], edge = c => colW / (2 * s0 * c.zoom); // (a drag never pulls the view past the world)
    samples.push({ ...first, x: Math.max(Math.min(first.x, edge(first)), first.x - overscroll / (s0 * first.zoom)) },
      { ...last, x: Math.min(Math.max(last.x, m.world[0] - edge(last)), last.x + overscroll / (s0 * last.zoom)) });
    const out = [], N = 24;
    for (const cam of samples) {
      for (const extra of opening < 1 ? [1, opening] : [1]) {
        let bare = 0;
        for (let gy = 0; gy <= N; gy++) for (let gx = 0; gx <= N; gx++) {
          const sx = (gx / N - 0.5) * colW, sy = (gy / N - 0.5) * colH, s = s0 * cam.zoom * extra;
          const covered = covers.some(c => { const dc = depthCam(m, cams, c.factor, cam); return inRect(drifted(c.r, cams, cam, m, colW, s0), dc.x + sx / s, dc.y + sy / s); });
          if (!covered) bare++;
        }
        if (bare) out.push({ cam, extra, bare: bare / ((N + 1) * (N + 1)) });
      }
    }
    return out;
  }

  // A panorama in a host element (the story's .si-world): opts.onFrame(cam, scale) after every move
  function create(host, manifest, stops, opts = {}) {
    const problems = check(manifest);
    if (problems.length) console.warn('Story panorama manifest:', problems.join('; '));
    const m = manifest, depths = DEPTHS.filter(d => m.layers && m.layers[d]);
    let colW = 0, colH = 0, s0 = 1, dpr = 1, cams = [], cam = null, extra = 1, glideReq = 0, devOn = false, canvas = null, hud = null;
    let zoomReq = 0, zoomTimer = 0;
    let state = 0; // the stop the story is at: planes with fromStop / untilStop show only around it
    let lz = 1; // the zoom the planes are laid out at: at rest the camera's own, so no depth is scaled by a transform
    const still = () => (opts.still ? opts.still() : matchMedia('(prefers-reduced-motion: reduce)').matches);
    const layers = depths.map((depth, i) => {
      const el = document.createElement('div');
      el.className = `sp-layer sp-${depth}`;
      el.dataset.depth = depth;
      el.style.zIndex = String(i + 1);
      host.append(el);
      const planes = (m.layers[depth].planes || []).map((def, n) => {
        const box = document.createElement(def.kind === 'glow' ? 'i' : 'div');
        if (def.kind === 'glow') {
          box.className = `si-glow${def.tone ? ` si-${def.tone}` : ''}`;
          box.style.setProperty('--gd', `${def.delay || 0}s`);
          el.append(box);
          return { def, el: box, glow: true };
        }
        box.className = def.kind === 'fill' ? 'sp-plane sp-fill' : 'sp-plane si-layer';
        box.dataset.id = def.id || `${depth}-${n + 1}`;
        if (Number.isFinite(def.z)) box.style.zIndex = String(def.z);
        // a fill: no picture, only a colour or gradient (fill, css) where the view may reach past a scene's picture
        if (def.kind === 'fill') { box.style.background = def.fill; el.append(box); return { def, el: box, id: box.dataset.id, solid: true }; }
        if (Number.isFinite(def.fromStop) || Number.isFinite(def.untilStop)) box.classList.add('sp-state');
        const img = document.createElement('img');
        img.alt = ''; img.draggable = false; img.decoding = 'async';
        box.append(img);
        el.append(box);
        return { def, el: box, img, id: box.dataset.id, ready: null, failed: false };
      });
      return { depth, factor: m.layers[depth].factor, el, planes };
    });
    // a plane's picture, fetched and decoded once (a promise that never fails: a missing picture is drawn as nothing)
    function load(p) {
      if (p.ready) return p.ready;
      p.ready = new Promise(done => {
        p.img.onload = () => (p.img.decode ? p.img.decode().catch(() => {}) : Promise.resolve()).then(() => { if (devOn) drawDev(); done(true); });
        p.img.onerror = () => { p.failed = true; console.warn(`Story panorama: ${p.def.src} did not load`); done(false); };
        p.img.src = pictureUrl(p.def.src);
      });
      return p.ready;
    }
    // the pictures around these camera positions, fetched; a promise for them all decoded, or the wait (DECODE_WAIT)
    function need(list, wait = DECODE_WAIT) {
      const jobs = [];
      for (const L of layers) {
        const wanted = new Set(list.flatMap(c => planesIn(m.layers[L.depth], frame(m, cams, L.factor, c, colW, colH))));
        for (const p of L.planes) if (p.img && wanted.has(p.def)) jobs.push(load(p));
      }
      return Promise.race([Promise.all(jobs), new Promise(done => setTimeout(done, wait))]);
    }
    // the stops beside stop i fetched too (the one before and after), and the way there from where the camera is
    function prepare(i, wait) {
      const around = [i - 1, i, i + 1].filter(k => k >= 0 && k < cams.length).map(k => cams[k]);
      need(around, 0);
      const to = cams[clamp(i, 0, cams.length - 1)];
      return need(cam ? [cam, lerpCam(cam, to, 0.5), to] : [to], wait);
    }
    // laid out for the column as it is now: the scale, and every plane's place and size in css px, its edges snapped
    // outwards to whole device pixels
    function layout() {
      colW = host.clientWidth || 1; colH = host.clientHeight || 1; dpr = devicePixelRatio || 1;
      s0 = colH / m.view;
      const at = cam && cams.length ? cams.indexOf(cam) : -1;
      cams = stopCams(m, stops, colW, colH, opts.band && opts.band());
      if (cam) cam = at >= 0 ? cams[at] : { ...cam };
      lay(cam ? cam.zoom * extra : 1);
      if (canvas) { canvas.width = Math.round(colW * dpr); canvas.height = Math.round(colH * dpr); }
    }
    // the planes laid out at zoom z (css px per world unit: s0 * z)
    function lay(z) {
      lz = z;
      const sl = s0 * z, lo = v => Math.floor(v * dpr + 1e-6) / dpr, hi = v => Math.ceil(v * dpr - 1e-6) / dpr;
      for (const L of layers) for (const p of L.planes) {
        const d = p.def;
        if (p.glow) { Object.assign(p.el.style, { left: `${d.x * sl}px`, top: `${d.y * sl}px`, width: `${d.size * sl}px` }); continue; }
        const x0 = lo(d.x * sl), y0 = lo(d.y * sl), x1 = hi((d.x + d.w) * sl), y1 = hi((d.y + d.h) * sl);
        Object.assign(p.el.style, { left: `${x0}px`, top: `${y0}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px` });
        // clip: [x, y, w, h], the part of the plane shown (world units), cut where a scene of its own lies over it
        if (d.clip) {
          const [cx, cy, cw, ch] = d.clip, t = Math.max(0, cy - d.y) * sl, l = Math.max(0, cx - d.x) * sl;
          const r = Math.max(0, d.x + d.w - (cx + cw)) * sl, b = Math.max(0, d.y + d.h - (cy + ch)) * sl;
          p.el.style.clipPath = `inset(${t}px ${r}px ${b}px ${l}px)`;
        }
      }
    }
    // at rest, laid out again at the camera's zoom (a scaled depth would be drawn from a scaled copy, a little soft)
    // (a moment after it stops moving: never while a drag or the story's drift moves it frame by frame)
    let settleTimer = 0;
    function settle() {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => { if (!zoomReq && cam && Math.abs(cam.zoom * extra - lz) > 1e-4) { lay(cam.zoom * extra); render(); } }, 150);
    }
    // a plane's own small drift (drift: { x, y, stop, reach }): at its stop none; as the camera moves away it shifts,
    // smoothly, never more than x and y world units (as a view through a window, far behind its frame); not with
    // reduced motion
    const drift = d => (still() ? [0, 0] : driftAt(d, cams, cam, m, colW, s0));
    // the camera drawn: each depth moved (and zoomed) by one transform
    function render() {
      if (!cam) return;
      const z = cam.zoom * extra, s = s0 * z, k = z / lz;
      for (const L of layers) {
        const c = depthCam(m, cams, L.factor, cam);
        let tx = colW / 2 - c.x * s, ty = colH / 2 - c.y * s;
        if (Math.abs(k - 1) < 1e-6) { tx = Math.round(tx * dpr) / dpr; ty = Math.round(ty * dpr) / dpr; } // (at rest on whole device pixels: no shimmer)
        L.el.style.transform = `translate3d(${tx}px, ${ty}px, 0)${Math.abs(k - 1) < 1e-6 ? '' : ` scale(${k})`}`;
        // only the planes in or near the view are drawn at all (a phone keeps nothing in memory for the others); the
        // rest wait, hidden, until the camera comes near
        const near = grow({ x: c.x - colW / 2 / s, y: c.y - colH / 2 / s, w: colW / s, h: colH / s }, colW / s / 2);
        for (const p of L.planes) {
          if (p.glow) continue;
          const on = hit({ x: p.def.x - 8, y: p.def.y - 8, w: p.def.w + 16, h: p.def.h + 16 }, near);
          if (on !== p.shown) { p.shown = on; p.el.style.display = on ? '' : 'none'; }
          if (p.def.drift && on) { const [dx, dy] = drift(p.def.drift); p.el.style.translate = `${dx * s0 * lz}px ${dy * s0 * lz}px`; }
        }
      }
      host.style.setProperty('--si-x', cam.x.toFixed(1));
      if (opts.onFrame) opts.onFrame(cam, s0 * cam.zoom * extra);
      if (devOn) drawDev();
    }
    function place(c) { cam = c; cancelAnimationFrame(glideReq); render(); if (!zoomReq) settle(); }
    // a glide from where the camera is to c in ms, slowing as it lands; resolves true when there, false if another move
    // took over
    let glideId = 0;
    function glide(c, ms, ease = t => 1 - Math.pow(1 - t, 3)) {
      cancelAnimationFrame(glideReq);
      const id = ++glideId;
      if (!cam || !(ms > 0)) { cam = c; render(); return Promise.resolve(true); }
      const from = cam, t0 = performance.now();
      return new Promise(done => {
        const step = now => {
          if (id !== glideId) return done(false);
          const t = Math.min(1, (now - t0) / ms);
          cam = t < 1 ? lerpCam(from, c, ease(t)) : c;
          render();
          if (t < 1) glideReq = requestAnimationFrame(step); else { if (!zoomReq) settle(); done(true); }
        };
        glideReq = requestAnimationFrame(step);
      });
    }
    const halt = () => { glideId++; cancelAnimationFrame(glideReq); };
    // the opening's zoom: from z down to the camera's own over ms, after delay (0 ms: at once); not with reduced motion
    function openingZoom(z, ms = 0, delay = 0) {
      cancelAnimationFrame(zoomReq); clearTimeout(zoomTimer); zoomReq = 0;
      extra = z;
      render();
      if (z === 1) { settle(); return; }
      const ease = t => 1 - Math.pow(1 - t, 2.4);
      zoomReq = -1; // (busy: the planes stay laid out as they are until it ends)
      zoomTimer = setTimeout(() => {
        const t0 = performance.now();
        const step = now => {
          const t = Math.min(1, (now - t0) / ms);
          extra = z + (1 - z) * ease(t); render();
          if (t < 1) zoomReq = requestAnimationFrame(step); else { zoomReq = 0; settle(); }
        };
        zoomReq = requestAnimationFrame(step);
      }, delay);
    }

    // ---- the development view: every plane's edges (by depth) with its magnification over its file's pixels, where
    // planes overlap, the camera's frame at every stop, the world's edge, and where the screen shows nothing now; a
    // panel with the numbers. On a canvas over the pictures, drawn as the camera moves.
    const overlapsOf = L => {
      const out = [], ps = L.planes.filter(p => p.img);
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i].def, b = ps[j].def;
        if (hit(a, b)) out.push(meet(a, b));
      }
      return out;
    };
    const magOf = p => {
      if (!p.img || !p.img.naturalWidth) return null;
      const s = s0 * cam.zoom * extra * dpr;
      return Math.max(p.def.w * s / p.img.naturalWidth, p.def.h * s / p.img.naturalHeight);
    };
    let pathGaps = null;
    function drawDev() {
      if (!canvas || !cam) return;
      const g = canvas.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, colW, colH);
      g.font = '600 10px ui-monospace, Menlo, monospace'; g.textBaseline = 'top';
      const toScreen = (L, r) => { const c = depthCam(m, cams, L.factor, cam), s = s0 * cam.zoom * extra; return { x: colW / 2 + (r.x - c.x) * s, y: colH / 2 + (r.y - c.y) * s, w: r.w * s, h: r.h * s }; };
      const label = (text, x, y, color) => { const w = g.measureText(text).width + 6; g.fillStyle = '#000b'; g.fillRect(x, y, w, 13); g.fillStyle = color; g.fillText(text, x + 3, y + 1.5); };
      const rows = [];
      for (const L of layers) {
        const color = DEV_COLORS[L.depth];
        g.save(); g.fillStyle = `${color}33`;
        for (const o of overlapsOf(L)) { const r = toScreen(L, o); g.fillRect(r.x, r.y, r.w, r.h); g.strokeStyle = `${color}aa`; g.setLineDash([2, 3]); g.strokeRect(r.x, r.y, r.w, r.h); }
        g.restore();
        for (const p of L.planes) {
          if (!p.img) continue;
          const r = toScreen(L, p.def), seen = r.x < colW && r.x + r.w > 0 && r.y < colH && r.y + r.h > 0;
          g.strokeStyle = color; g.lineWidth = p.def.cover ? 2 : 1; g.setLineDash(p.def.cover ? [] : [6, 4]);
          g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
          if (!seen) continue;
          const mag = magOf(p), text = p.failed ? `${p.id}: missing` : mag ? `${p.id} ${p.img.naturalWidth}×${p.img.naturalHeight} ${mag.toFixed(2)}×` : `${p.id} (not loaded)`;
          const mc = p.failed || (mag && mag > 1.5) ? '#ff6b5e' : mag && mag > 1.05 ? '#ffb347' : '#7dff9a';
          label(text, clamp(r.x + 4, 2, colW - 150), clamp(r.y + 4, 2, colH - 16), mc);
          rows.push([L.depth, p.id, p.img.naturalWidth ? `${p.img.naturalWidth}×${p.img.naturalHeight}` : '—', mag ? `${mag.toFixed(2)}×` : '—']);
        }
      }
      g.setLineDash([]);
      const main = layers.find(L => L.depth === 'main') || layers[0];
      g.strokeStyle = '#ffffffcc'; g.lineWidth = 1.5;
      const wr = toScreen(main, { x: 0, y: 0, w: m.world[0], h: m.world[1] }); g.strokeRect(wr.x, wr.y, wr.w, wr.h);
      cams.forEach((c, i) => {
        const hw = colW / (2 * s0 * c.zoom), hh = colH / (2 * s0 * c.zoom), r = toScreen(main, { x: c.x - hw, y: c.y - hh, w: 2 * hw, h: 2 * hh });
        g.setLineDash([10, 6]); g.strokeStyle = '#ffffff'; g.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4); g.setLineDash([]);
        label(`stop ${i + 1}`, clamp(r.x + 6, 2, colW - 60), clamp(r.y + r.h - 20, 2, colH - 16), '#ffffff');
      });
      // where the screen shows nothing at this moment
      const covers = layers.flatMap(L => L.planes.filter(p => !p.glow).flatMap(p => coverRects(p.def).map(r => ({ L, r }))));
      g.fillStyle = '#ff2d2d66';
      const N = 32;
      for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) {
        const sx = (gx + 0.5) * colW / N, sy = (gy + 0.5) * colH / N, s = s0 * cam.zoom * extra;
        const ok = covers.some(({ L, r }) => { const c = depthCam(m, cams, L.factor, cam); return inRect(still() ? r : drifted(r, cams, cam, m, colW, s0), c.x + (sx - colW / 2) / s, c.y + (sy - colH / 2) / s); });
        if (!ok) g.fillRect(gx * colW / N, gy * colH / N, colW / N, colH / N);
      }
      if (!pathGaps) pathGaps = gaps(m, stops, colW, colH, { overscroll: opts.overscroll, opening: opts.openingZoom, band: opts.band && opts.band() });
      const worst = pathGaps.reduce((a, b) => (b.bare > (a ? a.bare : 0) ? b : a), null);
      hud.textContent = [
        `STORY PANORAMA · dev`,
        `column ${colW}×${colH} css px · dpr ${dpr}`,
        `camera x ${cam.x.toFixed(0)} y ${cam.y.toFixed(0)} · zoom ${(cam.zoom * extra).toFixed(3)} · ${(s0 * cam.zoom * extra).toFixed(3)} css px per unit`,
        `world ${m.world[0]}×${m.world[1]} · view ${m.view} · parallax ${m.parallax || 'stops'}`,
        `depths: ${layers.map(L => `${L.depth} ×${L.factor}`).join(' · ')}`,
        pathGaps.length ? `GAPS on the way: ${pathGaps.length} camera positions, worst ${(worst.bare * 100).toFixed(1)}% bare at x ${worst.cam.x.toFixed(0)}` : 'gaps on the way: none',
        '',
        'in view (depth · plane · file px · magnification):',
        ...rows.map(r => r.join(' · ')),
      ].join('\n');
    }
    function dev(on) {
      devOn = !!on;
      if (devOn && !canvas) {
        canvas = document.createElement('canvas'); canvas.className = 'sp-dev';
        hud = document.createElement('pre'); hud.className = 'sp-hud';
        host.parentElement.append(canvas, hud);
        canvas.width = Math.round(colW * dpr); canvas.height = Math.round(colH * dpr);
      }
      if (canvas) { canvas.hidden = hud.hidden = !devOn; }
      host.parentElement.classList.toggle('sp-dev-on', devOn);
      pathGaps = null;
      render();
    }

    layout();
    if (opts.dev) dev(true);
    const api = {
      get camera() { return cam; },
      get scale() { return s0 * (cam ? cam.zoom : 1) * extra; },
      get count() { return cams.length; },
      stop: i => cams[clamp(i, 0, cams.length - 1)],
      along: u => camAlong(cams, u),
      atX: x => camAtX(cams, x),
      // how far across the camera may go at this zoom without the view passing the world's edges
      range(zoom = 1) { const hw = colW / (2 * s0 * zoom); return m.world[0] >= 2 * hw ? [hw, m.world[0] - hw] : [m.world[0] / 2, m.world[0] / 2]; },
      relayout() { layout(); pathGaps = null; render(); },
      // the story at stop i: the planes of a state (fromStop, untilStop) fade in or out (at once with reduced motion;
      // the camera doesn't move for it)
      state(i) {
        state = i;
        for (const L of layers) for (const p of L.planes) {
          const d = p.def;
          if (!(Number.isFinite(d.fromStop) || Number.isFinite(d.untilStop))) continue;
          p.el.style.opacity = (!Number.isFinite(d.fromStop) || i >= d.fromStop) && (!Number.isFinite(d.untilStop) || i <= d.untilStop) ? '1' : '0';
        }
      },
      // the pictures let go (once the story is over): fetched again if it's shown again
      release() { for (const L of layers) for (const p of L.planes) if (p.img) { p.img.onload = p.img.onerror = null; p.img.removeAttribute('src'); p.ready = null; } },
      place, glide, halt, prepare, openingZoom, dev,
      get devOn() { return devOn; },
      gaps: () => gaps(m, stops, colW, colH, { overscroll: opts.overscroll, opening: opts.openingZoom, band: opts.band && opts.band() }),
      // the planes (ids) a stop shows, in every depth
      needed: i => layers.flatMap(L => { const ps = planesIn(m.layers[L.depth], frame(m, cams, L.factor, cams[clamp(i, 0, cams.length - 1)], colW, colH)); return L.planes.filter(p => p.img && ps.includes(p.def)).map(p => p.id); }),
      planes: () => layers.flatMap(L => L.planes.filter(p => p.img).map(p => ({ depth: L.depth, id: p.id, src: p.def.src, loaded: !!(p.img.complete && p.img.naturalWidth), file: [p.img.naturalWidth, p.img.naturalHeight], magnification: cam && p.img.naturalWidth ? magOf(p) : null }))),
    };
    api.state(0);
    return api;
  }
  return { create, check, pictures, gaps, pictureUrl, DEPTHS };
})();
