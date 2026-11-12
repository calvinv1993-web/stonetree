'use strict';
// A screenshot of the real game page, to see how a change looks without playing (handy
// for an AI working on the game, too). Plays offline as a new character, then shoots.
//
//   node tests/screenshot.js out.png [x y z] [--hour 22] [--mobile] [--view] [--zoom 2] [--eval "<js>"]
//
//   x y z     go there first (default: the start, in the temple on Brightwater Isle)
//   --hour    the in-game hour (0-23): night, dawn, dusk...
//   --mobile  a phone held sideways, with the touch controls
//   --view    just the game view, not the whole page
//   --zoom    pixels per screen pixel, e.g. 2 for a sharp 2x picture (a phone is always 2)
//   --eval    JavaScript run in the page before the shot, e.g. "player.tutorial = 0; monsters.length = 0"
//
// Needs playwright-core and its Chromium (npm install, then npx playwright install chromium).

const path = require('path');
const { serve } = require('./serve'); // the pages over http (see serve.js)
const { ROOT } = require('./harness');

let chromium;
try {
  ({ chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core'));
} catch (e) {
  console.log('playwright-core is not installed: run `npm install` and `npx playwright install chromium` first.');
  process.exit(2);
}

const args = process.argv.slice(2);
const option = name => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args.splice(i, name === '--mobile' || name === '--view' ? 1 : 2)[1] ?? true;
};
const mobile = !!option('--mobile'), viewOnly = !!option('--view'), hour = option('--hour'), code = option('--eval'), zoom = +(option('--zoom') || 1);
const [out = 'screenshot.png', x, y, z] = args;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage(mobile
    ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1300, height: 950 }, deviceScaleFactor: zoom });
  const errors = [];
  page.on('pageerror', e => errors.push(e.stack || e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.dismiss());
  if (hour !== undefined) {
    // The world clock runs from the frame time (an in-game hour per real minute, starting
    // at 9:00): push every frame's time on to the hour asked for.
    await page.addInitScript(h => {
      const shift = ((((h * 60 - 540) % 1440) + 1440) % 1440) * 1000, raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = cb => raf(t => cb(t + shift));
    }, +hour);
  }
  await page.goto(`${await serve()}/index.html${mobile ? '?mobile' : ''}`);
  await page.fill('#createName', 'Screenshot');
  await page.click('#createStart');
  await page.click('#outfitDone', { timeout: 2000 }).catch(() => {});
  await page.waitForFunction(() => Preload.ready, null, { timeout: 30000 }).catch(() => {}); // (the loading screen gone)
  if (x !== undefined) await page.evaluate(([px, py, pz]) => teleport({ x: px, y: py, z: pz }), [+x, +y, +(z ?? 4)]);
  if (code) await page.evaluate(code);
  await page.waitForTimeout(1200); // let the light, the weather and the place name settle
  await (viewOnly ? page.locator('#view') : page).screenshot({ path: path.resolve(out) });
  await browser.close();
  console.log(`Saved ${path.resolve(out)}${errors.length ? `\nErrors in the page:\n${errors.join('\n')}` : ''}`);
  process.exit(errors.length ? 1 : 0);
})();
