'use strict';
// Browser soak test: plays the real game page in headless Chromium with random
// keys, clicks, chat and trades, and fails on any JavaScript error or when the
// game loop stalls (frames stop coming, or a single frame takes too long).
//
//   node tests/browser.test.js [seconds = 120] [seed = 1]
//
// Needs playwright-core and its Chromium (npm install, then npx playwright install chromium).

const path = require('path');
const { serve } = require('./serve'); // the pages over http (see serve.js)
const { seededRandom, ROOT } = require('./harness');

let chromium;
try {
  ({ chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core'));
} catch (e) {
  console.log('playwright-core is not installed: run `npm install` and `npx playwright install chromium` first.');
  process.exit(2);
}

const SECONDS = +process.argv[2] || 120;
const SEED = +process.argv[3] || 1;
const MAX_FRAME_MS = 250; // one frame taking longer than this counts as a freeze

const PLACES = [
  [31, 31, 4], [40, 43, 3], [26, 16, 4], [48, 27, 4], [12, 29, 4], [21, 64, 3], [31, 50, 5],
  [112, 47, 4], [112, 57, 4], [134, 33, 4], [104, 88, 4], [80, 42, 3], [143, 71, 5], [96, 49, 4],
  [28, 92, 4], [50, 94, 4], [28, 104, 3], [52, 102, 3],
];
const KEYS = ['w', 'a', 's', 'd', 'q', 'e', 'z', 'c', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', ' ', 'Escape', '1', '2', '3', '4', '5', 'h', 'm', 'f', 'g', 'F1', 'F2'];
const WORDS = ['hi', 'quest', 'yes', 'no', 'trade', 'bye', 'destiny', 'mission', 'heal', 'sorcerer', 'knight'];

(async () => {
  const rnd = seededRandom(SEED);
  const pick = list => list[Math.floor(rnd() * list.length)];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1320, height: 1000 } });
  const problems = [];
  page.on('pageerror', e => problems.push(`page error: ${e.stack || e.message}`));
  page.on('console', m => { if (m.type() === 'error') problems.push(`console error: ${m.text()}`); });
  page.on('dialog', d => d.dismiss());

  // Count frames and time every animation frame callback.
  await page.addInitScript(() => {
    window.__frames = 0;
    window.__slowest = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => raf(t => {
      const start = performance.now();
      cb(t);
      window.__frames++;
      window.__slowest = Math.max(window.__slowest, performance.now() - start);
    });
  });
  await page.goto(`${await serve()}/index.html`);
  const spriteErrors = await page.evaluate(() => {
    const errors = [];
    const tryDraw = (what, f) => { try { f(); } catch (e) { errors.push(`${what}: ${e.message}`); } };
    for (const id of Object.keys(THINGS)) for (const shape of ['0000', '1000', '0100', '1100', '1111', '0110', '1001']) tryDraw(`thing ${id} ${shape}`, () => Sprites.thing(id, 0, 0, 0, shape));
    for (const id of Object.keys(ITEMS)) tryDraw(`item ${id}`, () => Sprites.itemURL(id));
    for (const id of Object.keys(MONSTERS)) tryDraw(`monster ${id}`, () => Sprites.creature(id, 2, 1));
    for (const id of Object.keys(NPCS)) tryDraw(`npc ${id}`, () => Sprites.creature(`npc:${id}`, 2, 1));
    for (const v of Object.keys(VOCATIONS)) tryDraw(`player ${v}`, () => Sprites.creature(`player:${v}`, 2, 1));
    return errors;
  });
  problems.push(...spriteErrors);
  // The page builds the built-in world itself: it must be exactly the server's (Node's), or online play can't start.
  {
    const vm = require('vm'), fs = require('fs'), c = {};
    vm.createContext(c);
    for (const f of ['defs', 'items', 'creatures', 'npcs', 'data', 'map', 'default-map']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', `${f}.js`), 'utf8'), c);
    const server = vm.runInContext('mapSignature(createDefaultMap())', c), page_ = await page.evaluate(() => mapSignature(createDefaultMap()));
    if (server !== page_) problems.push(`the browser builds another world than the server (${page_} vs ${server})`);
  }
  await page.fill('#createName', 'Soak');
  await page.click('#createStart');
  await page.click('#outfitDone');

  const view = await page.locator('#view').boundingBox();
  const clickables = '#containers .slot, #equipment .slot, #loot .slot, #lootAll, .hot, #log .kw, #shopList button, [data-shoptab], [data-tab], '
    + '[data-logtab], [data-mode], #chaseMode, .battle-row, #mmUp, #mmDown, #mmZoomIn, #mmZoomOut, #mmWorld, #worldClose, #hotkeysBtn, '
    + '#hotkeysCancel, #outfitBtn, #outfitDone, .swatch-color, #readClose, #containers h2 button';
  const actions = [
    [30, 'key', async () => {
      const k = pick(KEYS);
      if (rnd() < 0.2) { await page.keyboard.down(k); await page.waitForTimeout(300 + rnd() * 1200); await page.keyboard.up(k); }
      else await page.keyboard.press(k);
    }],
    [25, 'click map', async () => {
      const x = view.x + rnd() * view.width, y = view.y + rnd() * view.height;
      const r = rnd();
      if (r < 0.15) { await page.keyboard.down('Shift'); await page.mouse.click(x, y); await page.keyboard.up('Shift'); }
      else await page.mouse.click(x, y, { button: r < 0.45 ? 'right' : 'left' });
    }],
    [20, 'click ui', async () => {
      const els = await page.$$(clickables);
      if (els.length) await pick(els).click({ timeout: 500 }).catch(() => {});
    }],
    [5, 'chat', async () => {
      await page.keyboard.press('Enter');
      await page.keyboard.type(pick(WORDS));
      await page.keyboard.press('Enter');
    }],
    [4, 'minimap', async () => {
      const b = await page.locator('#minimap').boundingBox();
      await page.mouse.click(b.x + rnd() * b.width, b.y + rnd() * b.height);
    }],
    [3, 'travel', () => page.evaluate(([x, y, z]) => teleport({ x, y, z }), pick(PLACES))],
    [3, 'drag', async () => { // drag an item somewhere: another slot or the map
      const from = await page.$$('#containers .slot img, #equipment .slot img, #loot .slot img');
      if (!from.length) return;
      const a = await pick(from).boundingBox();
      const to = rnd() < 0.5 ? await page.$$('#containers .slot, #equipment .slot') : [];
      const b = to.length ? await pick(to).boundingBox() : { x: view.x + rnd() * view.width, y: view.y + rnd() * view.height, width: 0, height: 0 };
      if (!a || !b) return;
      await page.mouse.move(a.x + 16, a.y + 16);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
      await page.mouse.up();
    }],
    [1, 'night', () => page.evaluate(() => { now += 12 * 60000; })],
    [1, 'raid', () => page.evaluate(() => startRaid(RAIDS[0]))],
    [2, 'progress', () => page.evaluate(() => {
      gainXp(50 + Math.floor(Math.random() * 300));
      if (player.level >= 10 && player.vocation === 'none') chooseVocation(['knight', 'paladin', 'sorcerer', 'druid'][Math.floor(Math.random() * 4)]);
      player.gold += 200;
    })],
    [4, 'heal', () => page.evaluate(() => { player.hp = player.maxHp; player.mana = player.maxMana; })],
  ];
  const total = actions.reduce((s, a) => s + a[0], 0);

  const started = Date.now();
  let lastFrames = 0, lastCheck = Date.now(), count = 0;
  while (Date.now() - started < SECONDS * 1000 && !problems.length) {
    let r = rnd() * total;
    const action = actions.find(a => (r -= a[0]) <= 0);
    await action[2]().catch(e => problems.push(`test action ${action[1]} failed: ${e.message}`));
    count++;
    await page.waitForTimeout(40 + rnd() * 120);

    if (Date.now() - lastCheck > 1000) {
      const { frames, slowest, errors } = await page.evaluate(() => ({
        frames: window.__frames,
        slowest: window.__slowest,
        errors: [...document.querySelectorAll('#log .damage')].map(d => d.textContent).filter(t => t.includes('Internal error')),
      }));
      const fps = (frames - lastFrames) / ((Date.now() - lastCheck) / 1000);
      if (fps < 5) problems.push(`game loop stalled: ${fps.toFixed(1)} frames per second`);
      if (slowest > MAX_FRAME_MS) problems.push(`a frame took ${slowest.toFixed(0)} ms`);
      problems.push(...errors);
      lastFrames = frames;
      lastCheck = Date.now();
    }
  }
  const stats = await page.evaluate(() => ({ level: player.level, vocation: player.vocation, frames: window.__frames, slowest: window.__slowest }));
  await browser.close();
  console.log(`${count} random actions in ${((Date.now() - started) / 1000).toFixed(0)} s, ${stats.frames} frames, ` +
    `slowest frame ${stats.slowest.toFixed(1)} ms, ended as level ${stats.level} ${stats.vocation}`);
  if (problems.length) {
    console.log(`FAILED:\n${[...new Set(problems)].join('\n')}`);
    process.exit(1);
  }
  console.log('passed');
})();
