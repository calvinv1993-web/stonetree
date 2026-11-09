'use strict';
// Makes the ground's pictures ahead of time: every border the built-in world uses (edges, rounded corners, scree, lips,
// shores, kerbs), drawn by the game's own code in a real browser, into one picture the game takes them from, so a slow
// phone doesn't have to make them while you play (see bakedPicture in js/sprites.js).
//
//   node tests/bake-ground.js
//
// Writes sprites/baked-ground.png and sprites/baked-ground.js. Run it again after changing how the ground's borders are
// drawn or the ground textures: until then the game makes them as it goes (it notices, by a fingerprint).
// Needs playwright-core and its Chromium (npm install, then npx playwright install chromium).

const fs = require('fs');
const path = require('path');
const { serve } = require('./serve');
const { ROOT } = require('./harness');

let chromium;
try {
  ({ chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core'));
} catch (e) {
  console.log('playwright-core is not installed: run `npm install` and `npx playwright install chromium` first.');
  process.exit(2);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // (no baked pictures while baking: every one is made by the code)
  await page.route(/baked-ground\.js/, route => route.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.goto(`${await serve()}/index.html`);
  await page.fill('#createName', 'Baker');
  await page.click('#createStart');
  await page.click('#outfitDone', { timeout: 2000 }).catch(() => {});
  await page.waitForFunction(() => typeof CUSTOM_SPRITES === 'undefined' || [...document.images].length >= 0, null, { timeout: 5000 });
  await page.waitForTimeout(1500); // (the textures load)
  const result = await page.evaluate(() => {
    // Draw the ground of the whole map, floor by floor, with no time limit: every border gets made.
    Render.CHUNK_MS = 1e9;
    const g = document.createElement('canvas').getContext('2d');
    g.canvas.width = g.canvas.height = 8;
    for (let z = 0; z < map.depth; z++) {
      Render.world(g, map, {
        cx: (map.width * TILE) / 2, cy: (map.height * TILE) / 2, z, minZ: z, maxZ: z, w: map.width * TILE, h: map.height * TILE,
        time: 0, objects: [], depth: 0, beyond: f => (f === map.surfaceZ ? 'water' : null),
      });
    }
    const made = Sprites.bakeable(), T = TILE, cols = 64;
    const sheet = document.createElement('canvas');
    sheet.width = cols * T;
    sheet.height = Math.ceil(made.length / cols) * T;
    const sg = sheet.getContext('2d');
    made.forEach(([, c], i) => sg.drawImage(c, (i % cols) * T, Math.floor(i / cols) * T));
    return { png: sheet.toDataURL('image/png'), keys: made.map(([k]) => k), sizes: [...new Set(made.map(([, c]) => `${c.width}x${c.height}`))], fingerprint: Sprites.groundFingerprint(), cols, tile: T };
  });
  await browser.close();
  if (errors.length) console.log(`Errors in the page:\n${errors.join('\n')}`);
  if (result.sizes.some(s => s !== '32x32')) throw new Error(`pictures of other sizes: ${result.sizes}`);
  if (result.fingerprint === 'unreadable') throw new Error('the textures could not be read');
  const png = Buffer.from(result.png.split(',')[1], 'base64');
  fs.writeFileSync(path.join(ROOT, 'sprites', 'baked-ground.png'), png);
  fs.writeFileSync(path.join(ROOT, 'sprites', 'baked-ground.js'), `'use strict';
// The ground's pictures, made ahead of time by tests/bake-ground.js (don't edit: bake again). keys: what each picture
// is, in order, cols to a row of baked-ground.png, tile pixels square; fingerprint: what they were made with.
const BAKED_GROUND = ${JSON.stringify({ fingerprint: result.fingerprint, tile: result.tile, cols: result.cols, keys: result.keys })};
`);
  console.log(`Baked ${result.keys.length} pictures (${(png.length / 1024).toFixed(0)} KB), fingerprint ${result.fingerprint}.`);
  process.exit(0);
})();
