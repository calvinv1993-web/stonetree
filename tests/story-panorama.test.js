// The story panorama (js/story-panorama.js) in a real browser: the story as it is (js/story-manifest.js) and the
// placeholder demonstration (?storydemo): its depths and planes, no bare spot anywhere the camera can go on four screens,
// Continue and a swipe moving the same camera from stop to stop with the next pictures decoded first, the pictures at
// their files' own size, reduced motion, the development view, Sister Ama's room with its window, and on to Choose Your Path.
// Run: node tests/story-panorama.test.js   (needs Playwright, as the other browser tests)
'use strict';
const path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright');
const { serve } = require(path.join(__dirname, 'serve.js'));
let passed = 0, failed = 0;
const check = (ok, what) => { if (ok) passed++; else { failed++; console.log('FAIL', what); } };
const SCREENS = [
  ['iPhone 13 Pro Max', { ...pw.devices['iPhone 13 Pro Max'] }],
  ['320 px', { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['tablet', { viewport: { width: 834, height: 1194 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['desktop', { viewport: { width: 1440, height: 900 } }],
];
async function openStory(browser, device, query, extra = {}) {
  const context = await browser.newContext({ ...device, ...extra });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (/Story panorama/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${URL}/index.html?story${query}`);
  await page.waitForSelector('#sgAuth:not([hidden])', { timeout: 30000 });
  await page.waitForTimeout(300);
  await page.fill('#sgName', 'Pano tester'); await page.fill('#sgPass', 'secret12'); await page.fill('#sgPass2', 'secret12'); await page.click('#sgGo');
  await page.waitForSelector('#sgChars:not([hidden])'); await page.click('#sgNewGo');
  await page.waitForSelector('#sortiaIntro:not([hidden])', { timeout: 30000 });
  await page.waitForFunction(() => Intro.panorama.needed(0).every(id => Intro.panorama.planes().find(p => p.id === id).loaded), null, { timeout: 15000 });
  return { context, page, errors };
}
const cam = page => page.evaluate(() => ({ ...Intro.panorama.camera }));
let URL;
(async () => {
  URL = await serve();
  const browser = await pw.chromium.launch();

  // every screen, both panoramas: no bare spot anywhere the camera can go, and every stop reachable
  for (const [name, device] of SCREENS) for (const query of ['', '&storydemo']) {
    const { context, page, errors } = await openStory(browser, device, query);
    const label = `${name}${query || ' (story)'}`;
    const info = await page.evaluate(() => ({ gaps: Intro.panorama.gaps().length, count: Intro.panorama.count, depths: [...document.querySelectorAll('.sp-layer')].map(l => l.dataset.depth), dots: siDots.children.length }));
    check(info.gaps === 0, `${label}: no bare spot anywhere the camera can go (${info.gaps})`);
    check(info.depths.join() === 'background,main,foreground', `${label}: three depths, back to front (${info.depths})`);
    check(info.dots === info.count - 1, `${label}: a dot for every card (${info.dots} for ${info.count} stops)`);
    check(errors.length === 0, `${label}: no errors (${errors})`);
    await context.close();
  }

  // the demonstration: its planes, overlaps both ways, Continue and a swipe
  {
    const { context, page, errors } = await openStory(browser, SCREENS[0][1], '&storydemo');
    const planes = await page.evaluate(() => Intro.panorama.planes());
    check(planes.length === 13 && ['background', 'main', 'foreground'].every(d => planes.some(p => p.depth === d)), `demo: 13 planes in three depths (${planes.length})`);
    const m = await page.evaluate(() => STORY_DEMO.manifest.layers.main.planes.filter(p => p.src));
    const meets = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    check(m.some((a, i) => m.some((b, j) => i < j && meets(a, b) && a.y === b.y)), 'demo: main planes overlap side by side');
    check(m.some((a, i) => m.some((b, j) => i < j && meets(a, b) && a.x === b.x)), 'demo: main planes overlap one above another');
    check(await page.evaluate(() => STORY_DEMO.manifest.world.join() === '3000,1000'), 'demo: overlapping planes leave the world its own size');
    // Continue: the next stop's pictures decoded before the camera sets off
    const start = await cam(page);
    await page.click('#siNext');
    await page.waitForFunction(x => Intro.panorama.camera.x !== x, start.x, { timeout: 5000 });
    check(await page.evaluate(() => Intro.panorama.needed(1).every(id => Intro.panorama.planes().find(p => p.id === id).loaded)), 'Continue: the next stop\'s pictures are in before the camera moves');
    await page.waitForFunction(() => !sortiaIntro.classList.contains('moving'), null, { timeout: 5000 });
    const two = await cam(page), stop2 = await page.evaluate(() => Intro.panorama.stop(1));
    check(Math.abs(two.x - stop2.x) < 0.5 && Math.abs(two.y - stop2.y) < 0.5 && await page.evaluate(() => siTitle.textContent) === 'Placeholder 2', `Continue: on stop 2, its words (${JSON.stringify(two)})`);
    // a swipe to the left: the same camera on to stop 3 (closer in, higher up)
    await page.evaluate(async () => {
      const box = sortiaIntro, target = box.querySelector('.si-copy');
      const t = (type, x) => box.dispatchEvent(new TouchEvent(type, { bubbles: true, touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target, clientX: x, clientY: 300 })], changedTouches: [new Touch({ identifier: 1, target, clientX: x, clientY: 300 })] }));
      t('touchstart', 320); t('touchmove', 300); t('touchmove', 220); t('touchmove', 160); t('touchend', 160);
    });
    await page.waitForTimeout(150);
    await page.waitForFunction(() => !sortiaIntro.classList.contains('moving') && siTitle.textContent === 'Placeholder 3', null, { timeout: 5000 }).catch(() => {});
    const three = await cam(page), stop3 = await page.evaluate(() => Intro.panorama.stop(2));
    check(await page.evaluate(() => siTitle.textContent) === 'Placeholder 3' && Math.abs(three.zoom - stop3.zoom) < 1e-6 && Math.abs(three.y - stop3.y) < 0.5, `a swipe: on to stop 3, its height and zoom (${JSON.stringify(three)})`);
    // the depths follow the camera at their own pace: half way between two stops they've drifted apart, at a stop not
    const drift = await page.evaluate(() => {
      const p = Intro.panorama, a = p.stop(2), b = p.stop(3), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, zoom: (a.zoom + b.zoom) / 2 };
      const t = () => [...document.querySelectorAll('.sp-layer')].map(l => new DOMMatrix(getComputedStyle(l).transform).m41);
      p.place(mid); const m = t(); p.place(a); const s = t();
      return { mid: m, stop: s };
    });
    check(drift.mid[0] !== drift.mid[1] && drift.mid[2] !== drift.mid[1], `between stops the depths drift apart (${drift.mid.map(v => v.toFixed(1))})`);
    // the pictures drawn at their files' own size: no plane in view stretched past 1.05x on a phone at 3x (the placeholders' main planes are drawn for it)
    const mags = await page.evaluate(() => Intro.panorama.planes().filter(p => p.depth === 'main' && p.magnification).map(p => p.magnification));
    check(mags.length && mags.every(v => v <= 1.05), `demo: the main depth's pictures at 3x are never stretched (${mags.map(v => v.toFixed(2))})`);
    // the development view
    await page.keyboard.press('Shift+D');
    await page.waitForTimeout(200);
    const dev = await page.evaluate(() => ({ canvas: !!document.querySelector('.sp-dev:not([hidden])'), hud: (document.querySelector('.sp-hud') || {}).textContent || '' }));
    check(dev.canvas && /gaps on the way: none/.test(dev.hud) && /magnification/.test(dev.hud), 'Shift+D: the development view, its numbers and no gaps');
    check(errors.length === 0, `demo: no errors (${errors})`);
    await context.close();
  }

  // reduced motion: no glide (the camera is there at once), no snow, no opening zoom
  {
    const { context, page } = await openStory(browser, SCREENS[0][1], '&storydemo', { reducedMotion: 'reduce' });
    await page.click('#siNext');
    await page.waitForTimeout(60);
    const at = await cam(page), stop2 = await page.evaluate(() => Intro.panorama.stop(1));
    check(Math.abs(at.x - stop2.x) < 0.5, `reduced motion: Continue goes straight to the next stop (${at.x} vs ${stop2.x})`);
    check(await page.evaluate(() => +getComputedStyle(document.querySelector('.si-snow-far')).opacity === 0), 'reduced motion: no snow');
    await context.close();
  }

  // Sister Ama's room (sprites/ui/story/ama): the temple fills the screen at her stop, both pictures sharp (never
  // stretched), no filters, the window's view drifting no more than its 5.43 x 3.62 world units anywhere on the way
  // (none at her stop, none with reduced motion), and no bare spot
  for (const [name, device] of SCREENS) for (const rm of ['no-preference', 'reduce']) {
    if (rm === 'reduce' && name !== 'iPhone 13 Pro Max') continue;
    const { context, page, errors } = await openStory(browser, device, '', { reducedMotion: rm });
    await page.click('#siSkip');
    await page.waitForFunction(() => Intro.panorama.needed(4).every(id => Intro.panorama.planes().find(p => p.id === id).loaded), null, { timeout: 20000 });
    await page.waitForFunction(() => !sortiaIntro.classList.contains('moving') && siTitle.textContent === 'Sister Ama', null, { timeout: 10000 });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const p = Intro.panorama, win = document.querySelector('[data-id="ama-window-view"]'), tem = document.querySelector('[data-id="ama-temple"]');
      const tb = tem.getBoundingClientRect(), col = document.querySelector('.si-col').getBoundingClientRect(), shift = el => { const t = getComputedStyle(el).translate.split(' '); return [parseFloat(t[0]) || 0, parseFloat(t[1]) || 0]; };
      const atStop = shift(win), mags = p.planes().filter(x => /^ama-/.test(x.id)).map(x => x.magnification);
      let most = [0, 0];
      for (let x = p.stop(0).x; x <= p.stop(4).x; x += 4) { p.place(p.atX(x)); const [dx, dy] = shift(win), k = new DOMMatrix(getComputedStyle(win.parentElement).transform).a / p.scale; most = [Math.max(most[0], Math.abs(dx) * k), Math.max(most[1], Math.abs(dy) * k)]; } // (the drift is in the depth's own px: the depth's scale turns it to world units)
      p.place(p.stop(4));
      return { fills: tb.left <= col.left + 0.5 && tb.right >= col.right - 0.5 && tb.top <= col.top + 0.5 && tb.bottom >= col.bottom - 0.5, atStop, most, mags, gaps: p.gaps().length,
        filters: [win, tem, tem.parentElement].map(el => getComputedStyle(el).filter).filter(f => f !== 'none').length };
    });
    const label = `${name}${rm === 'reduce' ? ' (reduced motion)' : ''}`;
    check(r.fills, `${label}: Ama's room fills the screen at her stop`);
    check(r.mags.length === 2 && r.mags.every(v => v > 0 && v <= 1.05), `${label}: Ama's two pictures never stretched (${r.mags.map(v => v && v.toFixed(2))})`);
    check(r.atStop.every(v => Math.abs(v) < 0.01), `${label}: the window's view sits as placed at her stop (${r.atStop})`);
    check(rm === 'reduce' ? r.most.every(v => v === 0) : r.most[0] <= 5.44 && r.most[0] > 2 && r.most[1] <= 3.63, `${label}: the window's view drifts at most 5.43 x 3.62 world units on the whole way (${r.most.map(v => v.toFixed(2))})`);
    check(r.gaps === 0 && r.filters === 0, `${label}: no bare spot, no filters`);
    check(errors.length === 0, `${label}: no errors (${errors})`);
    await context.close();
  }

  // at Sister Ama's first words the story is still there to go back to (the back arrow, a swipe); once you go on, not
  {
    const { context, page } = await openStory(browser, SCREENS[0][1], '');
    const settled = () => page.waitForFunction(() => !sortiaIntro.classList.contains('moving'), null, { timeout: 8000 });
    await page.click('#siSkip'); await settled();
    check(await page.evaluate(() => siTitle.textContent === 'Sister Ama' && !siBack.hidden && !siBack.disabled), 'Sister Ama\'s first words: the back arrow is there');
    await page.click('#siBack'); await settled();
    check(await page.evaluate(() => siTitle.textContent) === 'The False Signal', 'back from Sister Ama: the last card');
    await page.click('#siNext'); await settled();
    await page.evaluate(async () => {
      const box = sortiaIntro, target = box.querySelector('.si-copy');
      const t = (type, x) => box.dispatchEvent(new TouchEvent(type, { bubbles: true, touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target, clientX: x, clientY: 300 })], changedTouches: [new Touch({ identifier: 1, target, clientX: x, clientY: 300 })] }));
      t('touchstart', 100); t('touchmove', 120); t('touchmove', 200); t('touchmove', 260); t('touchend', 260);
    });
    await page.waitForTimeout(150); await settled();
    check(await page.evaluate(() => siTitle.textContent) === 'The False Signal', 'a swipe back from Sister Ama: the last card');
    await page.click('#siNext'); await settled();
    await page.click('#siNext'); await settled();
    check(await page.evaluate(() => siTitle.textContent === 'Sister Ama' && siBack.hidden), 'once on past her first words: no way back');
    await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(300);
    check(await page.evaluate(() => /Run to the gate|goblin was holding/.test(siCopy.textContent)), 'and the arrow key doesn\'t take you back either');
    await context.close();
  }

  // the story still ends in Choose Your Path
  {
    const { context, page } = await openStory(browser, SCREENS[0][1], '&pickpath&mobile');
    await page.click('#siSkip'); await page.waitForTimeout(900);
    for (let i = 0; i < 3; i++) { await page.click('#siNext'); await page.waitForTimeout(400); }
    await page.waitForSelector('#pathPick:not([hidden])', { timeout: 30000 }).catch(() => {});
    check(await page.evaluate(() => !pathPick.hidden), 'after Sister Ama: Choose Your Path');
    await context.close();
  }

  await browser.close();
  console.log(failed ? `${failed} failed, ${passed} passed` : `all ${passed} passed`);
  process.exit(failed ? 1 : 0);
})();
