'use strict';
// The performance test (Menu, Game: Performance test; or index.html?bench): a fixed route through the world, the same
// every time, measured as the game really runs on this device, so a change can be judged against the run before it.
// It plays a character of its own (saved under its own key and removed afterwards: your own character is never moved),
// at fixed hours of the day, and notes for every part of the route:
//  - frames a second, and the time between frames (its middle, 95th and 99th percentile, and the stalls of 50 ms or more)
//  - the work in a frame: the game's own time per frame (update, drawing, the interface), the same percentiles
//  - the ground made into chunks: how many, how long in all, the longest single go (see Render.stats)
//  - memory: the pictures kept (chunks, sprites, the view's canvases, in bytes of pixels) and, where the browser tells
//    it (Chrome), the script heap
// The results are kept in this browser (the last 20), one can be marked as the baseline that later runs are compared to,
// and each can be copied or shared as JSON (docs/perf/README.md says what to do with it). tests/bench.js runs the same
// test in a browser on a computer and writes its JSON to a file.
const Bench = (() => {
  const FLAG = 'tilequest.bench', RUNS = 'tilequest.bench.runs', BASE = 'tilequest.bench.baseline', SLOT = 'zz-bench';
  const VERSION = 1; // (the route and what's measured: a run of another version isn't compared)
  // The route: where, at what hour, standing still (hold: seconds measured once the ground there is ready) or walking
  // (to: where to, measured until there or 30 s)
  const ROUTE = [
    { name: 'square-day', at: [126, 121, 8], hour: 12, hold: 6 },
    { name: 'church-inside', at: [137, 103, 8], hour: 12, hold: 6 },
    { name: 'tower-top', at: [137, 106, 11], hour: 12, hold: 6 },
    { name: 'walk-street-day', at: [126, 100, 8], to: [126, 140], hour: 12 },
    { name: 'outside-east', at: [175, 121, 8], hour: 12, hold: 6 },
    { name: 'sewer', at: [131, 115, 7], hour: 12, hold: 6 },
    { name: 'square-night', at: [126, 121, 8], hour: 23, hold: 6 },
    { name: 'walk-street-night', at: [126, 140, 8], to: [126, 100], hour: 23 },
  ];
  const store = (key, value) => { try { if (value === undefined) return JSON.parse(localStorage.getItem(key) || 'null'); localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* not kept */ } return null; };
  const session = value => { try { if (value === undefined) return sessionStorage.getItem(FLAG); if (value === null) sessionStorage.removeItem(FLAG); else sessionStorage.setItem(FLAG, value); } catch (e) { /* no storage */ } return null; };
  const B = { running: false, shift: 0, result: null };
  let frames = [], seg = null;

  B.wanted = () => /[?&]bench\b/.test(location.search) || session() === '1';
  // From the menu: the game saved, then loaded again into the test (and back into your game afterwards)
  B.ask = () => {
    if (typeof online === 'function' && online()) { log('The performance test runs only when playing alone.'); return; }
    if (!confirm('Run the performance test? It takes about two minutes on a character of its own, then your game comes back. Keep the screen on and don\'t touch it while it runs.')) return;
    try { saveGame(); } catch (e) { /* loaded again all the same */ }
    session('1');
    location.reload();
  };
  // The fixed hour: the world's clock (worldMinutes, from now) set to it, only ever forward, so no timer waits a day
  const setHour = (hour, t) => {
    const want = ((hour * 60 - 540) % 1440 + 1440) % 1440 * 1000, day = 1440 * 1000;
    let shift = want - (t % day);
    while (shift < B.shift) shift += day;
    B.shift = shift;
  };
  const pct = (list, p) => { if (!list.length) return 0; const s = [...list].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const round = (v, k = 1) => Math.round(v * 10 ** k) / 10 ** k;
  // the pictures kept, in bytes of pixels (4 a pixel)
  const memory = () => {
    let chunkBytes = 0, chunks = 0;
    for (const c of Render.chunks.values()) if (c.canvas) { chunks++; chunkBytes += c.canvas.width * c.canvas.height * 4; }
    for (const c of Render.spare) chunkBytes += c.width * c.height * 4;
    const sprites = Sprites.cacheStats(), view = canvas.width * canvas.height * 4 + dark.width * dark.height * 4;
    const heap = performance.memory ? performance.memory.usedJSHeapSize : null;
    const MB = b => round(b / 1048576, 1);
    return { chunks, chunkMB: MB(chunkBytes), sprites: sprites.count, spriteMB: MB(sprites.bytes), viewMB: MB(view), picturesMB: MB(chunkBytes + sprites.bytes + view), heapMB: heap === null ? null : MB(heap) };
  };
  const device = () => ({
    userAgent: navigator.userAgent,
    standalone: !!((window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone),
    dpr: window.devicePixelRatio || 1, screen: `${screen.width}x${screen.height}`, window: `${innerWidth}x${innerHeight}`,
    canvas: `${canvas.width}x${canvas.height}`, view: `${VIEW_W}x${VIEW_H}`, sharp: Sprites.CREATURE_RES, sharpDrop, sharpDropBefore: B.dropBefore, quality, fpsSetting: Math.round(1000 / FRAME_INTERVAL),
    cores: navigator.hardwareConcurrency || null, deviceMemory: navigator.deviceMemory || null, chunksKept: Render.CHUNKS_KEPT,
  });

  // every frame the game draws (game.js frame): its time since the one before and its work
  B.frame = (t, dt, work) => {
    if (player) { player.hp = player.maxHp; player.mana = player.maxMana; } // (the test's character never dies on the way)
    if (seg && seg.measuring && dt < 1000) frames.push([dt, work]);
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const until = async (test, max) => { const end = performance.now() + max; while (!test() && performance.now() < end) await wait(50); };

  async function leg(step, out) {
    const t = performance.now();
    setHour(step.hour, t);
    const s0 = { ...Render.stats };
    const arrived = performance.now();
    teleport({ x: step.at[0], y: step.at[1], z: step.at[2] });
    await wait(100);
    await until(() => Preload.ready, 20000); // (the loading screen of a long jump: the ground made round you, 15 s at most)
    const ready = performance.now() - arrived;
    const s1 = { ...Render.stats };
    seg = { measuring: true };
    frames = [];
    const from = performance.now();
    if (step.to) {
      Actions.walkTo(step.to[0], step.to[1]);
      await until(() => player.x === step.to[0] && player.y === step.to[1], 30000);
    } else await wait(step.hold * 1000);
    const span = performance.now() - from;
    seg.measuring = false;
    const s2 = { ...Render.stats }, dts = frames.map(f => f[0]), works = frames.map(f => f[1]);
    out.push({
      name: step.name, hour: step.hour, seconds: round(span / 1000),
      fps: round(frames.length / (span / 1000)), frames: frames.length,
      intervalMs: { p50: round(pct(dts, 0.5)), p95: round(pct(dts, 0.95)), p99: round(pct(dts, 0.99)), max: round(Math.max(0, ...dts)) },
      workMs: { p50: round(pct(works, 0.5), 2), p95: round(pct(works, 0.95), 2), p99: round(pct(works, 0.99), 2), max: round(Math.max(0, ...works)) },
      stalls: dts.filter(d => d >= 50).length,
      arrival: { readyMs: Math.round(ready), gaveUp: ready >= 14900, chunks: s1.chunksMade - s0.chunksMade, chunkMs: round(s1.chunkMs - s0.chunkMs) },
      chunks: { made: s2.chunksMade - s1.chunksMade, ms: round(s2.chunkMs - s1.chunkMs), live: s2.live - s1.live },
      memory: memory(),
    });
  }

  B.start = () => {
    B.running = true;
    // (it measures the quality chosen at its own sharpness: the step down a slow moment once made isn't kept for the
    // test, only noted (sharpDropBefore), so runs before and after a change draw the same pixels; not saved, so the game
    // afterwards goes on as it was)
    B.dropBefore = sharpDrop;
    sharpDrop = 0;
    fitView();
    saveSlot = SLOT; // (its saves go under a key of its own, removed at the end)
    player.name = 'Benchmark';
    player.tutorial = 0;
    teleport({ x: ROUTE[0].at[0], y: ROUTE[0].at[1], z: ROUTE[0].at[2] });
    paused = false;
    if (typeof Sound !== 'undefined' && Sound.title) Sound.title.stop();
    startWorld();
    run();
  };
  async function run() {
    const status = document.createElement('div');
    status.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99999;background:rgba(0,0,0,.75);color:#ffd84a;font:12px monospace;padding:6px 8px;border-radius:6px;pointer-events:none';
    document.body.append(status);
    const began = new Date(), legs = [], mem0 = memory();
    await until(() => Preload.ready, 30000);
    for (let i = 0; i < ROUTE.length; i++) {
      status.textContent = `Performance test ${i + 1}/${ROUTE.length}: ${ROUTE[i].name}`;
      await leg(ROUTE[i], legs);
    }
    status.remove();
    B.running = false;
    paused = true; // (the world stops, and with it the saving: the test's character leaves nothing behind)
    window.onbeforeunload = null;
    try { localStorage.removeItem(saveKey()); } catch (e) { /* nothing kept */ }
    const all = legs.flatMap(l => [l]), sum = (k, f) => round(all.reduce((a, l) => a + f(l), 0), k);
    const result = {
      version: VERSION, page: typeof PAGE_VERSION !== 'undefined' ? PAGE_VERSION : '', at: began.toISOString(), id: began.getTime().toString(36),
      device: device(),
      summary: {
        fps: round(all.reduce((a, l) => a + l.fps, 0) / all.length), workP50: round(pct(all.map(l => l.workMs.p50), 0.5), 2), workP95: round(Math.max(...all.map(l => l.workMs.p95)), 2),
        stalls: sum(0, l => l.stalls), chunksMade: sum(0, l => l.chunks.made + l.arrival.chunks), chunkMs: sum(1, l => l.chunks.ms + l.arrival.chunkMs),
        chunkMaxMs: round(Render.stats.chunkMaxMs), picturesMB: Math.max(...all.map(l => l.memory.picturesMB)), startMB: mem0.picturesMB,
      },
      legs,
    };
    B.result = result;
    const runs = store(RUNS) || [];
    runs.push(result);
    store(RUNS, runs.slice(-20));
    show(result);
  }

  // ---- the results ------------------------------------------------------------------------------------------------
  // (worse or better only past both a share and an amount, as tests/bench-compare.js: a tenth of a millisecond is noise)
  const change = (now, was, lowerBetter = true, amount = 0) => {
    if (was === null || was === undefined || now === null || now === undefined || !was) return '';
    const d = ((now - was) / was) * 100, big = Math.abs(now - was) > amount;
    const worse = big && (lowerBetter ? d > 10 : d < -5), better = big && (lowerBetter ? d < -10 : d > 5);
    return ` <span style="color:${worse ? '#ff7a6a' : better ? '#8fe08a' : '#aaa'}">${d > 0 ? '+' : ''}${Math.round(d)}%</span>`;
  };
  function show(r) {
    const runs = store(RUNS) || [], baseId = store(BASE), base = runs.find(x => x.id === baseId && x.id !== r.id && x.version === r.version);
    const bl = name => base && base.legs.find(l => l.name === name);
    const el = document.createElement('div');
    el.id = 'benchResult';
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#111;color:#eee;font:12px/1.45 monospace;overflow:auto;padding:14px;-webkit-user-select:text;user-select:text';
    const d = r.device, s = r.summary, bs = base && base.summary;
    const row = (l, b) => `<tr><td>${l.name}</td><td>${l.fps}${/walk/.test(l.name) ? change(l.fps, b && b.fps, false, 2) : ''}</td><td>${l.workMs.p50}${change(l.workMs.p50, b && b.workMs.p50, true, 1)}</td><td>${l.workMs.p95}${change(l.workMs.p95, b && b.workMs.p95, true, 2)}</td><td>${l.intervalMs.p95}</td><td>${l.stalls}</td><td>${round(l.arrival.readyMs / 1000)}${l.arrival.gaveUp ? '!' : ''}</td><td>${l.chunks.made + l.arrival.chunks}/${round(l.chunks.ms + l.arrival.chunkMs)}</td><td>${l.memory.picturesMB}${change(l.memory.picturesMB, b && b.memory.picturesMB, true, 10)}</td></tr>`;
    el.innerHTML = `<h3 style="margin:0 0 6px;color:#ffd84a">Performance test ${r.page} · ${r.at.slice(0, 16).replace('T', ' ')}</h3>`
      + `<div>${d.standalone ? 'home-screen app' : 'browser'} · canvas ${d.canvas} · view ${d.view} tiles · sharp ${d.sharp} · quality ${d.quality} · ${d.fpsSetting} fps setting</div>`
      + `<div style="margin:6px 0">fps ${s.fps} · work p50 ${s.workP50} ms${change(s.workP50, bs && bs.workP50, true, 1)} · worst p95 ${s.workP95} ms${change(s.workP95, bs && bs.workP95, true, 2)} · stalls ${s.stalls}`
      + ` · chunks ${s.chunksMade} in ${s.chunkMs} ms (longest ${s.chunkMaxMs})${change(s.chunkMs, bs && bs.chunkMs, true, 40)} · pictures ${s.picturesMB} MB${change(s.picturesMB, bs && bs.picturesMB, true, 10)}</div>`
      + '<div style="color:#aaa">work: the game\'s own time per frame (the measure to compare) · gap: time between frames · load s: the loading screen after the jump there (! = gave up at 15 s) · pictures: memory of the pictures kept</div>'
      + `<div style="color:#aaa">${base ? `compared with the baseline of ${base.at.slice(0, 16).replace('T', ' ')} (${base.page})` : 'no baseline yet: mark one to compare later runs with it'}</div>`
      + '<table style="border-collapse:collapse;margin:8px 0" cellpadding="3"><tr style="color:#ffd84a"><td>part</td><td>fps</td><td>work p50</td><td>work p95</td><td>gap p95</td><td>stalls</td><td>load s</td><td>chunks/ms</td><td>pictures MB</td></tr>'
      + r.legs.map(l => row(l, bl(l.name))).join('') + '</table>'
      + '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0">'
      + ['copy:Copy results', 'share:Share', 'base:Mark as baseline', 'again:Run again', 'close:Back to the game'].map(b => `<button data-b="${b.split(':')[0]}" style="font:14px sans-serif;padding:10px 12px">${b.split(':')[1]}</button>`).join('')
      + '</div><div id="benchNote" style="color:#8fe08a"></div>'
      + `<div style="color:#777;margin-top:8px">${runs.length} run(s) kept in this browser. ${d.userAgent}</div>`;
    document.body.append(el);
    const note = text => { el.querySelector('#benchNote').textContent = text; };
    const json = JSON.stringify(r);
    el.addEventListener('click', e => {
      const b = e.target && e.target.dataset && e.target.dataset.b;
      if (b === 'copy') {
        const done = () => note('Copied: paste it in the chat.');
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(json).then(done, () => fallback());
        else fallback();
      } else if (b === 'share') {
        if (navigator.share) navigator.share({ title: `SORTIA performance ${r.page}`, text: json }).catch(() => {});
        else note('Sharing isn\'t possible here: use Copy.');
      } else if (b === 'base') { store(BASE, r.id); note('Marked as the baseline: later runs are compared with this one.'); }
      else if (b === 'again') { session('1'); location.reload(); }
      else if (b === 'close') { session(null); try { localStorage.removeItem(saveKey()); } catch (e) { /* nothing kept */ } location.href = location.pathname + location.search.replace(/([?&])bench\b&?/, '$1').replace(/[?&]$/, ''); }
    });
    // (no clipboard: the JSON shown, selected, to copy by hand)
    const fallback = () => {
      const t = document.createElement('textarea');
      t.value = json; t.style.cssText = 'width:100%;height:160px;font:11px monospace';
      el.append(t); t.focus(); t.select();
      note('Select all and copy the text below.');
    };
  }
  B.runs = () => store(RUNS) || [];
  return B;
})();
