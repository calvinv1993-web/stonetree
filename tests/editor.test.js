'use strict';
// The map editor in a real browser, on the built-in world: it shows the world (not a blank
// canvas), every floor can be looked at, zoom works, painting and erasing change the map and
// are kept over a reload, export and import lose nothing, and on a phone it pans and draws.
//
//   node tests/editor.test.js [screenshot-folder]
//
// Needs playwright-core and its Chromium (npm install, then npx playwright install chromium),
// or PLAYWRIGHT_CORE pointing at a playwright install.

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { serve } = require('./serve'); // the pages over http (see serve.js)
const { ROOT } = require('./harness');

let chromium;
try {
  ({ chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core'));
} catch (e) {
  console.log('playwright-core is not installed: run `npm install` and `npx playwright install chromium` first.');
  process.exit(2);
}
const shots = process.argv[2];
let URL_; // the editor's address, once the test server is up
let START; // the start tile of the built-in world, read from the page

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n${e.stack || e}`); }
}

// What the page sees: the status line, how varied the canvas is (a blank one has 1 colour),
// a hash of the canvas, and a tile of the map the editor saved to the browser.
const status = page => page.textContent('#status');
const canvasLook = page => page.evaluate(() => {
  const c = document.getElementById('canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const colours = new Set();
  let h = 0;
  for (let i = 0; i < d.length; i += 4 * 97) { colours.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]); h = (h * 31 + d[i] + d[i + 1] * 7 + d[i + 2] * 13) | 0; }
  return { colours: colours.size, hash: h };
});
const storedTiles = (page, x, y, z, r = 1) => page.evaluate(([x, y, z, r]) => {
  const json = localStorage.getItem(MAP_STORAGE_KEY); // nothing until the first edit: then it's the built-in world
  const m = json ? GameMap.fromJSON(JSON.parse(json)) : createDefaultMap();
  const out = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) out.push(m.get(x + dx, y + dy, z));
  return out;
}, [x, y, z, r]);
const shoot = async (page, name) => { if (shots) await page.screenshot({ path: path.join(shots, name) }); };

(async () => {
  URL_ = `${await serve()}/editor.html`;
  const browser = await chromium.launch();
  const errors = [];
  const watch = page => {
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('dialog', d => d.accept());
  };

  const context = await browser.newContext({ viewport: { width: 1300, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  watch(page);
  await page.goto(URL_);
  await page.waitForTimeout(1500);
  START = await page.evaluate(() => createDefaultMap().start);

  await test('the editor opens on the built-in world, on the start floor (the temple, one up), and shows it', async () => {
    const s = await status(page);
    assert.match(s, /Floor 9 \(\+1\)/);
    assert.match(s, /256×256, 16 floors/);
    assert.ok((await canvasLook(page)).colours > 8, 'the canvas looks blank');
    await shoot(page, 'editor-surface.png');
  });

  await test('every floor from 0 to 15 can be shown, and the buttons stop at the ends', async () => {
    for (let i = 0; i < 10; i++) await page.click('#floorDown');
    assert.match(await status(page), /Floor 0 \(-8\)/);
    const seen = new Set();
    for (let z = 0; z < 16; z++) {
      seen.add((await status(page)).match(/Floor (\d+)/)[1]);
      await page.click('#floorUp');
    }
    assert.strictEqual(seen.size, 16);
    assert.match(await status(page), /Floor 15 \(\+7\)/);
    for (let i = 0; i < 7; i++) await page.click('#floorDown');
    assert.match(await status(page), /Floor 8 \(surface\)/);
  });

  await test('"Go to" takes you to a mountain top one floor up', async () => {
    await page.selectOption('#goTo', { label: 'North Peaks' });
    assert.match(await status(page), /Floor 9 \(\+1\)/);
    assert.ok((await canvasLook(page)).colours > 8);
    await shoot(page, 'editor-peaks.png');
    await page.selectOption('#goTo', { label: 'Oakvale' });
    assert.match(await status(page), /Floor 9 \(\+1\)/);
  });

  await test('the mouse wheel zooms in and out', async () => {
    const before = await canvasLook(page), b = await page.locator('#canvas').boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(100);
    assert.match(await status(page), /zoom 2x/);
    assert.notStrictEqual((await canvasLook(page)).hash, before.hash);
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(100);
    assert.match(await status(page), /zoom 1.5x/);
  });

  // The middle of the canvas is the start tile after "Go to Oakvale" (the camera centres on it).
  const middle = async () => { const b = await page.locator('#canvas').boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const rocks = tiles => tiles.filter(t => t && t.items.includes('rock')).length;

  await test('painting puts a thing on the map, and it is saved over a reload', async () => {
    const before = rocks(await storedTiles(page, START.x, START.y, START.z));
    await page.click('.swatch[data-key="thing:rock"]');
    const m = await middle();
    await page.mouse.click(m.x, m.y);
    await page.waitForTimeout(700); // saving waits 400 ms for more strokes
    assert.match(await page.textContent('#saveState'), /Saved/);
    assert.strictEqual(rocks(await storedTiles(page, START.x, START.y, START.z)), before + 1);
    await page.reload();
    await page.waitForTimeout(1500);
    assert.strictEqual(rocks(await storedTiles(page, START.x, START.y, START.z)), before + 1, 'the rock is gone after a reload');
    assert.match(await status(page), /256×256, 16 floors/);
  });

  let exported;
  await test('export and import give back exactly the same map', async () => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#exportMap')]);
    exported = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tq-')), 'map.json');
    await download.saveAs(exported);
    const text = fs.readFileSync(exported, 'utf8');
    assert.strictEqual(text, await page.evaluate(() => localStorage.getItem(MAP_STORAGE_KEY)));
    await page.click('.swatch[data-key="thing:rock"]'); // change the map...
    const m = await middle();
    await page.mouse.click(m.x + 100, m.y + 100);
    await page.waitForTimeout(700);
    assert.notStrictEqual(await page.evaluate(() => localStorage.getItem(MAP_STORAGE_KEY)), text);
    await page.setInputFiles('#importFile', exported); // ...and importing the export puts it back
    await page.waitForTimeout(1000);
    assert.strictEqual(await page.evaluate(() => localStorage.getItem(MAP_STORAGE_KEY)), text);
  });

  await test('erasing takes the thing off again', async () => {
    await page.selectOption('#goTo', { label: 'Oakvale' });
    const before = rocks(await storedTiles(page, START.x, START.y, START.z));
    const m = await middle();
    await page.mouse.click(m.x, m.y, { button: 'right' });
    await page.waitForTimeout(700);
    assert.strictEqual(rocks(await storedTiles(page, START.x, START.y, START.z)), before - 1);
  });

  await test('the editor reports no script errors', async () => {
    assert.deepStrictEqual(errors, []);
  });
  await context.close();

  // ---- on a phone ------------------------------------------------------------------
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mobile = await phone.newPage();
  watch(mobile);
  await mobile.goto(URL_);
  await mobile.waitForTimeout(1500);
  const touch = (type, points) => mobile.evaluate(([type, points]) => {
    const c = document.getElementById('canvas');
    const list = points.map(([x, y], i) => new Touch({ identifier: i, target: c, clientX: x, clientY: y }));
    c.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : list, changedTouches: list, bubbles: true, cancelable: true }));
  }, [type, points]);

  await test('on a phone the editor shows the world, and one finger pans it', async () => {
    assert.ok((await canvasLook(mobile)).colours > 8, 'the canvas looks blank');
    await shoot(mobile, 'editor-phone.png');
    const before = (await canvasLook(mobile)).hash;
    await touch('touchstart', [[200, 400]]);
    await touch('touchmove', [[120, 300]]);
    await touch('touchend', [[120, 300]]);
    await mobile.waitForTimeout(200);
    assert.notStrictEqual((await canvasLook(mobile)).hash, before, 'the view did not move');
  });

  await test('on a phone, two fingers zoom and Draw mode paints', async () => {
    const zoom = async () => (await status(mobile)).match(/zoom ([\d.]+)x/)[1];
    const z0 = await zoom();
    await touch('touchstart', [[150, 400], [250, 400]]);
    await touch('touchmove', [[100, 400], [300, 400]]);
    await touch('touchend', [[100, 400], [300, 400]]);
    await mobile.waitForTimeout(200);
    assert.notStrictEqual(await zoom(), z0, 'pinching did not zoom');
    await mobile.click('#togglePalette');
    await mobile.click('.swatch[data-key="thing:rock"]');
    await mobile.click('#togglePalette');
    await mobile.click('#touchMode');
    const count = async () => mobile.evaluate(() => {
      const json = localStorage.getItem(MAP_STORAGE_KEY);
      const m = json ? GameMap.fromJSON(JSON.parse(json)) : createDefaultMap();
      return m.floors[m.start.z].filter(t => t && t.items.includes('rock')).length; // the editor opens on the start floor
    });
    const before = await count();
    await touch('touchstart', [[200, 420]]);
    await touch('touchend', [[200, 420]]);
    await mobile.waitForTimeout(700);
    assert.strictEqual(await count(), before + 1);
  });

  await test('the phone editor reports no script errors', async () => {
    assert.deepStrictEqual(errors, []);
  });

  await browser.close();
  console.log(failed ? `${failed} of ${passed + failed} failed` : `all ${passed} passed`);
  process.exit(failed ? 1 : 0);
})();
