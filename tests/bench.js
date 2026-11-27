// The performance test (js/bench.js) in a browser on this computer, as a phone shows the game: an iPhone's screen
// (390 x 844, 3 pixels a point, touch), its JSON written to a file and a summary printed. Optionally the processor slowed
// down (--cpu 4: four times slower). It runs without a graphics card, so it measures the work, not a phone's speed:
// the numbers to compare are this computer's own, before and after a change, with the same options. A real phone's
// numbers come from the test in the game itself (Menu, Game: Performance test): see docs/perf/README.md.
// One run varies (on a shared computer the work can differ by a quarter from one run to the next): --runs 3 makes three,
// written as out-1.json, out-2.json, out-3.json, for tests/bench-compare.js to take their median.
// --quality low plays at that quality (as chosen in Settings; without it, the browser's own choice: high).
//   node tests/bench.js [out.json] [--runs 3] [--cpu 4] [--desktop] [--quality low]
const path = require('path');
const fs = require('fs');
const { serve } = require('./serve');
let chromium;
try {
  ({ chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core'));
} catch (e) {
  console.error('playwright-core is not installed: run `npm install` and `npx playwright install chromium` first.');
  process.exit(1);
}
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i < 0 ? undefined : args.splice(i, name === '--desktop' ? 1 : 2)[1] ?? true; };
const cpu = +(option('--cpu') || 1), desktop = !!option('--desktop'), runs = Math.max(1, +(option('--runs') || 1));
const quality = option('--quality');
const out = args[0];

async function once(out) {
  const browser = await chromium.launch();
  const page = await browser.newPage(desktop
    ? { viewport: { width: 1300, height: 950 } }
    : { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  if (quality) await page.addInitScript(q => { try { localStorage.setItem('tilequest.quality', q); } catch (e) { /* none */ } }, quality);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (cpu > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  }
  await page.goto(`${await serve()}/index.html?${desktop ? '' : 'mobile&'}bench`);
  await page.waitForFunction(() => typeof Bench !== 'undefined' && Bench.result, null, { timeout: 6 * 60000, polling: 1000 });
  const result = await page.evaluate(() => Bench.result);
  result.runner = { tool: 'tests/bench.js', cpuSlowdown: cpu, emulated: desktop ? 'desktop 1300x950' : 'iPhone 390x844 @3x', headless: true };
  await browser.close();
  if (out) { fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(path.resolve(out), `${JSON.stringify(result, null, 1)}\n`); }
  const s = result.summary;
  console.log(`page ${result.page} · canvas ${result.device.canvas} · sharp ${result.device.sharp} · cpu x${cpu}`);
  console.log(`fps ${s.fps} · work p50 ${s.workP50} ms · worst p95 ${s.workP95} ms · stalls ${s.stalls} · chunks ${s.chunksMade} in ${s.chunkMs} ms (longest ${s.chunkMaxMs}) · pictures ${s.picturesMB} MB`);
  for (const l of result.legs) console.log(`  ${l.name.padEnd(18)} fps ${String(l.fps).padStart(5)}  work p50 ${String(l.workMs.p50).padStart(6)} p95 ${String(l.workMs.p95).padStart(6)}  gap p95 ${String(l.intervalMs.p95).padStart(5)}  stalls ${String(l.stalls).padStart(2)}  chunks ${l.chunks.made + l.arrival.chunks}/${Math.round(l.chunks.ms + l.arrival.chunkMs)} ms  pictures ${l.memory.picturesMB} MB${l.memory.heapMB !== null ? `  heap ${l.memory.heapMB} MB` : ''}`);
  if (errors.length) console.log(`Errors in the page:\n${errors.join('\n')}`);
  if (out) console.log(`Saved ${path.resolve(out)}`);
  return errors.length;
}
(async () => {
  let bad = 0;
  for (let i = 1; i <= runs; i++) bad += await once(out && runs > 1 ? out.replace(/\.json$/, `-${i}.json`) : out);
  process.exit(bad ? 1 : 0);
})();
