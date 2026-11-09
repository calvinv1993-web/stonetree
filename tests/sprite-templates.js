'use strict';
// Templates for drawing your own sprites in the game's camera (docs/art-style.md), e.g. to give PixelLab as a guide:
// the picture's size, where its tile lies on it, which way height goes (up and to the left, 0.6 of a pixel up and left
// per unit, a floor 32 pixels high) and where the light comes from. Put a finished sprite in sprites/ and list it in
// sprites/custom.js under the thing's id (a big thing under its name, e.g. founder).
//
//   node tests/sprite-templates.js
//
// Writes sprites/templates/*.png. Needs playwright-core and its Chromium.

const fs = require('fs');
const path = require('path');
const { ROOT } = require('./harness');

let chromium;
try {
  ({ chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core'));
} catch (e) {
  console.log('playwright-core is not installed: run `npm install` and `npx playwright install chromium` first.');
  process.exit(2);
}

// [file, tiles across, tiles down, how far it may reach above its tiles, what it's for]
const TEMPLATES = [
  ['thing-1x1.png', 1, 1, 64, 'one tile: a tree, a statue, furniture (96 x 96, its tile bottom right)'],
  ['big-2x2.png', 2, 2, 64, 'two by two tiles (a lantern, a bell): 128 x 128'],
  ['big-3x3-tall.png', 3, 3, 160, 'three by three, reaching high (the founder): 256 x 256'],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  fs.mkdirSync(path.join(ROOT, 'sprites', 'templates'), { recursive: true });
  for (const [file, w, h, rise, what] of TEMPLATES) {
    const url = await page.evaluate(([w, h, R]) => {
      const T = 32, W = w * T + R, H = h * T + R, c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d');
      const P = (u, v, z) => [R + u - z * 0.6, R + v - z * 0.6]; // the game's camera: height up and to the left
      g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, W, H);
      // the footprint on the ground, tile by tile
      for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) { g.fillStyle = (q + r) % 2 ? 'rgba(80,160,80,0.35)' : 'rgba(80,140,80,0.25)'; g.fillRect(R + q * T, R + r * T, T, T); }
      g.strokeStyle = '#2a7a2a'; g.lineWidth = 1; g.strokeRect(R + 0.5, R + 0.5, w * T - 1, h * T - 1);
      // a floor's height (32 px = 53 units) and the reach: the box it may fill, leaning up-left
      const box = (z, colour) => { g.strokeStyle = colour; g.beginPath(); for (const [u, v] of [[0, 0], [w * T, 0], [w * T, h * T], [0, h * T], [0, 0]]) g.lineTo(...P(u, v, z)); g.stroke(); };
      box(32 / 0.6, '#3a6ad0');
      for (const [u, v] of [[0, 0], [w * T, 0], [w * T, h * T], [0, h * T]]) { g.strokeStyle = 'rgba(58,106,208,0.6)'; g.beginPath(); g.moveTo(...P(u, v, 0)); g.lineTo(...P(u, v, 32 / 0.6)); g.stroke(); }
      // the light: from the north-west, high up
      g.fillStyle = '#e0a020'; g.font = 'bold 10px sans-serif'; g.fillText('light', 2, 10); g.strokeStyle = '#e0a020'; g.beginPath(); g.moveTo(8, 14); g.lineTo(22, 28); g.stroke();
      g.fillStyle = '#3a6ad0'; g.fillText('1 floor', ...P(w * T + 2, 0, 32 / 0.6));
      return c.toDataURL();
    }, [w, h, rise]);
    fs.writeFileSync(path.join(ROOT, 'sprites', 'templates', file), Buffer.from(url.split(',')[1], 'base64'));
    console.log(`${file}: ${what}`);
  }
  await browser.close();
  process.exit(0);
})();
