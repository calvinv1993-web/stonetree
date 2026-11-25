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
    // (the story: the far mountains a depth of their own behind the main one, as the owner's packages ask; the demo: three)
    check(info.depths.join() === (query ? 'background,main,foreground' : 'background,main'), `${label}: its depths, back to front (${info.depths})`);
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

  // the seal, the first two stops: one place, one camera; whole, then broken (decoded first, fading in while the camera
  // stays), back to whole; the whole ring above the words on every screen; only then does the camera move on
  for (const [name, device] of SCREENS) for (const rm of ['no-preference', 'reduce']) {
    if (rm === 'reduce' && name !== 'iPhone 13 Pro Max') continue;
    const { context, page, errors } = await openStory(browser, device, '', { reducedMotion: rm });
    const label = `${name}${rm === 'reduce' ? ' (reduced motion)' : ''}`;
    const look = () => page.evaluate(() => {
      const op = id => +getComputedStyle(document.querySelector(`[data-id="${id}"]`)).opacity, col = document.querySelector('.si-col').getBoundingClientRect();
      const p = Intro.panorama, cam = p.camera, s = p.scale, k = STORY_SCRIPT.stops[0].keep;
      const ring = { top: (k[1] - cam.y) * s + col.height / 2, bottom: (k[1] + k[3] - cam.y) * s + col.height / 2, left: (k[0] - cam.x) * s + col.width / 2, right: (k[0] + k[2] - cam.x) * s + col.width / 2 };
      return { closed: op('opening-seal'), broken: op('opening-seal-broken'), broken2: op('opening-way-broken'), cam: { ...cam }, title: siTitle.textContent, ring, titleTop: siTitle.getBoundingClientRect().top - col.top,
        markBottom: document.querySelector('.si-mark').getBoundingClientRect().bottom - col.top, width: col.width,
        loaded: ['opening-seal', 'opening-way', 'opening-seal-broken', 'opening-way-broken'].every(id => p.planes().find(x => x.id === id).loaded), mags: p.planes().filter(x => /^opening-/.test(x.id) && x.magnification).map(x => x.magnification) };
    });
    const a = await look();
    check(a.title === 'The Seal' && a.closed === 1 && a.broken === 0 && a.loaded, `${label}: the first stop: the seal whole, both pictures decoded (${a.closed}/${a.broken}/${a.loaded})`);
    // (on a screen too short for the whole ring between the wordmark and the words, as 320 x 568, its foot stays clear of
    // the words and its top goes a little under the wordmark)
    const roomy = a.ring.bottom - a.ring.top <= a.titleTop - a.markBottom - 24;
    check((roomy ? a.ring.top >= a.markBottom - 1 : a.ring.top >= 0) && a.ring.bottom <= a.titleTop + 1 && a.ring.left >= -1 && a.ring.right <= a.width + 1,
      `${label}: the whole ring above the words (${Math.round(a.ring.top)}-${Math.round(a.ring.bottom)} between ${Math.round(a.markBottom)} and ${Math.round(a.titleTop)}, ${Math.round(a.ring.left)}-${Math.round(a.ring.right)} of ${a.width})`);
    check(a.mags.every(v => v > 0 && v <= 1.05), `${label}: the seal's pictures never stretched (${a.mags.map(v => v.toFixed(2))})`);
    // the sky behind the seal: as placed at its stop, drifting at most 7.24 x 5.43 world units anywhere on the way (none
    // with reduced motion)
    const sky = await page.evaluate(() => {
      const p = Intro.panorama, el = document.querySelector('[data-id="opening-sky-a"]'), shift = (e = el) => { const t = getComputedStyle(e).translate.split(' '); return [parseFloat(t[0]) || 0, parseFloat(t[1]) || 0]; };
      const tiles = ['a', 'b', 'c', 'd'].map(k => document.querySelector(`[data-id="opening-sky-${k}"]`));
      let apart = 0; // (the four sky tiles, wherever two show at once, shifted alike: their joins stay closed)
      const home = p.camera, at = shift();
      let most = [0, 0];
      for (let x = p.stop(0).x; x <= p.stop(p.count - 1).x; x += 4) { p.place(p.atX(x)); const shown = tiles.filter(e => e.style.display !== 'none').map(e => shift(e)); for (const s of shown) apart = Math.max(apart, Math.abs(s[0] - shown[0][0]), Math.abs(s[1] - shown[0][1])); const [dx, dy] = shift(tiles.find(e => e.style.display !== 'none')), k = new DOMMatrix(getComputedStyle(el.parentElement).transform).a / p.scale; most = [Math.max(most[0], Math.abs(dx) * k), Math.max(most[1], Math.abs(dy) * k)]; }
      p.place(p.stop(2)); const atMill = shift(tiles[1]); p.place(p.stop(4)); const atRefugees = shift(tiles[3]);
      p.place(home);
      return { at, most, atMill, atRefugees, apart };
    });
    check(sky.at.every(v => Math.abs(v) < 0.01) && (rm === 'reduce' ? sky.most.every(v => v === 0) : sky.most[0] <= 7.25 && sky.most[0] > 2 && sky.most[1] <= 5.44) && sky.atMill.every(v => Math.abs(v) < 0.01) && sky.atRefugees.every(v => Math.abs(v) < 0.01) && sky.apart < 0.01,
      `${label}: the opening's sky sits as placed at the seal, the mill and the refugees, drifting at most 7.24 x 5.43 between (${sky.most.map(v => v.toFixed(2))})`);
    await page.click('#siNext');
    const during = [];
    for (let i = 0; i < 6; i++) { await page.waitForTimeout(120); during.push(await look()); }
    await page.waitForFunction(() => !sortiaIntro.classList.contains('moving'), null, { timeout: 5000 });
    await page.waitForTimeout(rm === 'reduce' ? 50 : 1000);
    const b = await look();
    check(during.every(d => Math.abs(d.cam.x - a.cam.x) < 0.01 && Math.abs(d.cam.y - a.cam.y) < 0.01 && Math.abs(d.cam.zoom - a.cam.zoom) < 1e-6), `${label}: Continue: the camera stays still`);
    check(b.title === 'The Broken Seal' && b.broken === 1 && b.broken2 === 1 && b.closed === 1, `${label}: the second stop: the broken seal over it, both patches, its words (${b.broken}/${b.broken2})`);
    check(during.every(d => Math.abs(d.broken - d.broken2) < 0.02), `${label}: both patches fade together`);
    if (rm === 'reduce') check(during[0].broken === 1, `${label}: with reduced motion, at once`);
    else check(during.some(d => d.broken > 0.05 && d.broken < 0.95), `${label}: the broken seal fades in (${during.map(d => d.broken.toFixed(2))})`);
    await page.click('#siBack');
    await page.waitForFunction(() => !sortiaIntro.classList.contains('moving'), null, { timeout: 5000 });
    await page.waitForTimeout(rm === 'reduce' ? 50 : 1000);
    const c = await look();
    check(c.title === 'The Seal' && c.broken === 0 && Math.abs(c.cam.x - a.cam.x) < 0.01, `${label}: back: the seal whole again, the camera where it was`);
    await page.click('#siNext'); await page.waitForFunction(() => !sortiaIntro.classList.contains('moving'), null, { timeout: 5000 });
    await page.click('#siNext'); await page.waitForFunction(() => !sortiaIntro.classList.contains('moving') && siTitle.textContent === 'The Hollow Host', null, { timeout: 5000 }).catch(() => {});
    const d = await look();
    check(d.title === 'The Hollow Host' && d.cam.x > a.cam.x + 100 && d.broken === 1, `${label}: only after the broken seal does the camera move on to the right (${Math.round(d.cam.x)})`);
    check(errors.length === 0, `${label}: no errors (${errors})`);
    await context.close();
  }

  // Bastion's night scene: original two-strip art and bounded depth motion, absent from the neighbouring scenes.
  for (const [name, device] of SCREENS) for (const rm of ['no-preference', 'reduce']) {
    if (rm === 'reduce' && name !== 'iPhone 13 Pro Max') continue;
    const { context, page, errors } = await openStory(browser, device, '', { reducedMotion: rm });
    const settled = () => page.waitForFunction(() => !sortiaIntro.classList.contains('moving'), null, { timeout: 8000 });
    await page.evaluate(() => Intro.go(2)); await settled();
    check(await page.evaluate(() => [...document.querySelectorAll('[data-id^="bastion-"]')].every(e => +getComputedStyle(e).opacity === 0)), `${name}: no Bastion at the mill`);
    await page.click('#siNext'); await settled();
    await page.waitForFunction(() => Intro.panorama.planes().filter(p => p.id.startsWith('bastion-')).every(p => p.loaded));
    const before = await page.evaluate(() => {
      const p = Intro.panorama, a = document.querySelector('[data-id="bastion-top"]').getBoundingClientRect();
      const b = document.querySelector('[data-id="bastion-bottom"]').getBoundingClientRect();
      return { title: siTitle.textContent, planes: p.planes().filter(p => p.id.startsWith('bastion-')), left: a.left,
        top: a.top, bandOffset: (b.top - a.top) / p.scale };
    });
    check(before.title === 'Bastion Holds the Crossing' && before.planes.length === 4 && before.planes.every(p => p.loaded && p.magnification <= 1.05), `${name}: Bastion's four original pictures loaded, not stretched`);
    check(Math.abs(before.bandOffset - 316.75) < 0.6, `${name}: Bastion's two strips keep their overlap`);
    const shift = await page.evaluate(() => {
      const p = Intro.panorama; p.look(100, -100);
      const forest = getComputedStyle(document.querySelector('[data-id="bastion-forest"]')).translate.split(' ').map(parseFloat);
      const tree = getComputedStyle(document.querySelector('[data-id="bastion-tree"]')).translate.split(' ').map(parseFloat);
      const r = document.querySelector('[data-id="bastion-top"]').getBoundingClientRect();
      return { forest: forest.map(x => (x || 0) / p.scale), tree: tree.map(x => (x || 0) / p.scale), left: r.left, top: r.top };
    });
    check(Math.abs(shift.left - before.left) < 0.01 && Math.abs(shift.top - before.top) < 0.01, `${name}: depth motion leaves Bastion and the bridge fixed`);
    check(rm === 'reduce' ? [...shift.forest, ...shift.tree].every(x => x === 0) : Math.abs(shift.forest[0] - 7.24) < 0.02 && Math.abs(shift.forest[1] + 5.43) < 0.02 && Math.abs(shift.tree[0] - 2.715) < 0.02,
      `${name}: forest and tree bounded; reduced motion stays still`);
    await page.click('#siNext'); await settled();
    check(await page.evaluate(() => siTitle.textContent === 'The Road to Oakvale' && [...document.querySelectorAll('[data-id^="bastion-"]')].every(e => +getComputedStyle(e).opacity === 0)), `${name}: on to the road, no night pictures left`);
    await page.click('#siBack'); await settled();
    check(await page.evaluate(() => siTitle.textContent === 'Bastion Holds the Crossing'), `${name}: back reaches Bastion again`);
    check(errors.length === 0, `${name}: Bastion has no browser errors (${errors})`);
    await context.close();
  }

  // The Road to Oakvale: the refugees' place as the camera arrives, the refugees walking, no rescue; then The Last
  // Crossing (the camera still): the rescue fading in over it, the wounded man, the guards, the watchman; going back,
  // gone again; at once with reduced motion
  for (const rm of ['no-preference', 'reduce']) {
    const { context, page, errors } = await openStory(browser, SCREENS[0][1], '', { reducedMotion: rm });
    const label = `The Last Crossing${rm === 'reduce' ? ' (reduced motion)' : ''}`;
    const op = () => page.evaluate(() => ['opening-rescue', 'opening-watchman'].map(id => +getComputedStyle(document.querySelector(`[data-id="${id}"]`)).opacity));
    const settled = () => page.waitForFunction(() => !sortiaIntro.classList.contains('moving'), null, { timeout: 8000 });
    await page.evaluate(() => Intro.go(3)); await settled(); await page.waitForTimeout(300);
    check((await op()).every(v => v === 0), `${label}: at Bastion, no rescue yet`);
    await page.click('#siNext');
    const during = [];
    for (let i = 0; i < 4; i++) { await page.waitForTimeout(120); during.push({ op: await op(), moving: await page.evaluate(() => sortiaIntro.classList.contains('moving')) }); }
    await settled(); await page.waitForTimeout(rm === 'reduce' ? 50 : 1000);
    const cam = await page.evaluate(() => ({ ...Intro.panorama.camera }));
    check(during.every(d => d.op.every(v => v === 0)) && (await op()).every(v => v === 0) && await page.evaluate(() => siTitle.textContent) === 'The Road to Oakvale',
      `${label}: The Road to Oakvale: landed at the refugees' place, the refugees walking, no rescue`);
    await page.click('#siNext');
    const fading = [];
    for (let i = 0; i < 5; i++) { await page.waitForTimeout(rm === 'reduce' ? 20 : 150); fading.push({ op: await op(), cam: await page.evaluate(() => ({ ...Intro.panorama.camera })) }); }
    await settled(); await page.waitForTimeout(rm === 'reduce' ? 50 : 1000);
    const after = await op();
    check(after.every(v => v === 1) && await page.evaluate(() => siTitle.textContent) === 'The Last Crossing', `${label}: The Last Crossing: the rescue shown (${after})`);
    check(fading.every(f => Math.abs(f.cam.x - cam.x) < 0.01), `${label}: the camera holds still while it fades in`);
    if (rm === 'reduce') check(fading[0].op.every(v => v === 1), `${label}: at once`);
    else check(fading.some(f => f.op[0] > 0.05 && f.op[0] < 0.95) && fading.every(f => Math.abs(f.op[0] - f.op[1]) < 0.05), `${label}: both fade in together (${fading.map(f => f.op[0].toFixed(2))})`);
    // The False Signal: the same place; the goblin and the wolf fade in over the rescue (which stays beneath), the camera
    // still; back, only they fade out
    const fs = () => page.evaluate(() => ['opening-false-signal', 'opening-rescue', 'opening-watchman'].map(id => +getComputedStyle(document.querySelector(`[data-id="${id}"]`)).opacity));
    check((await fs())[0] === 0, `${label}: at The Last Crossing, no false signal yet`);
    await page.click('#siNext');
    const fsDuring = [];
    for (let i = 0; i < 5; i++) { await page.waitForTimeout(rm === 'reduce' ? 20 : 150); fsDuring.push({ op: await fs(), cam: await page.evaluate(() => ({ ...Intro.panorama.camera })) }); }
    await settled(); await page.waitForTimeout(rm === 'reduce' ? 50 : 1000);
    const fsAfter = await fs();
    check(fsAfter.every(v => v === 1) && await page.evaluate(() => siTitle.textContent) === 'The False Signal', `${label}: The False Signal: the goblin and wolf shown, the rescue and watchman beneath (${fsAfter})`);
    check(fsDuring.every(f => Math.abs(f.cam.x - cam.x) < 0.01 && f.op[1] === 1 && f.op[2] === 1), `${label}: the camera still and the rescue fully shown beneath while it fades in`);
    if (rm !== 'reduce') check(fsDuring.some(f => f.op[0] > 0.05 && f.op[0] < 0.95), `${label}: the false signal fades in (${fsDuring.map(f => f.op[0].toFixed(2))})`);
    await page.click('#siBack'); await settled(); await page.waitForTimeout(rm === 'reduce' ? 50 : 1000);
    const lcAgain = await fs();
    check(lcAgain[0] === 0 && lcAgain[1] === 1 && lcAgain[2] === 1 && await page.evaluate(() => siTitle.textContent) === 'The Last Crossing', `${label}: back to The Last Crossing: only the false signal gone (${lcAgain})`);
    await page.click('#siBack'); await settled(); await page.waitForTimeout(rm === 'reduce' ? 50 : 1000);
    const camBack = await page.evaluate(() => ({ ...Intro.panorama.camera }));
    check((await op()).every(v => v === 0) && Math.abs(camBack.x - cam.x) < 0.01 && await page.evaluate(() => siTitle.textContent) === 'The Road to Oakvale',
      `${label}: back to The Road to Oakvale: the rescue gone, the camera still`);
    check(errors.length === 0, `${label}: no errors (${errors})`);
    await context.close();
  }

  // the far mountains move apart from the main depth (their own depth, one offset for all four tiles), while the rescue,
  // the watchman and the false signal move exactly with the main depth's tiles: laid over the refugees' place wherever
  // the camera is
  {
    const { context, page } = await openStory(browser, SCREENS[0][1], '');
    const r = await page.evaluate(() => {
      const p = Intro.panorama, el = id => document.querySelector(`[data-id="${id}"]`), depth = id => el(id).closest('.sp-layer').dataset.depth;
      const world = (id, ref) => (el(id).getBoundingClientRect().left - el(ref).getBoundingClientRect().left) / p.scale;
      const back = [...document.querySelectorAll('.sp-background [data-id]')].map(e => e.dataset.id).sort();
      const over = ['opening-rescue', 'opening-watchman', 'opening-false-signal'];
      const xs = [p.stop(2).x, (p.stop(2).x + p.stop(4).x) / 2, p.stop(4).x - 60, p.stop(4).x, p.stop(4).x + 40], rel = [], sky = [];
      for (const x of xs) { p.place(p.atX(x)); if (over.every(id => el(id).style.display !== 'none')) rel.push(over.map(id => world(id, 'opening-refugees'))); sky.push(world('opening-sky-d', 'opening-refugees')); } // (where they're drawn: near the refugees)
      p.place(p.stop(0));
      return { back, depths: over.map(depth), rel, sky };
    });
    check(r.back.join() === 'opening-sky-a,opening-sky-b,opening-sky-c,opening-sky-d', `the far mountains, and only they, are the background depth (${r.back})`);
    check(r.depths.every(d => d === 'main'), `the rescue, the watchman and the false signal are in the main depth (${r.depths})`);
    const want = [1160.66 - 1334.42, 1495.06 - 1334.42, 1160.66 - 1334.42];
    check(r.rel.length >= 3 && r.rel.every(row => row.every((v, i) => Math.abs(v - want[i]) < 0.6)), `they keep their place on the refugees' tile wherever the camera is (${r.rel.map(row => row.map(v => v.toFixed(1)).join('/'))})`);
    const placed = 1334.42 - 1334.42;
    check(Math.abs(r.sky[0] - placed) < 0.6 && Math.abs(r.sky[3] - placed) < 0.6 && Math.abs(r.sky[1] - placed) > 2 && Math.abs(r.sky[1] - placed) <= 7.3,
      `the mountains sit as placed at the mill and the refugees and move apart from the main depth between them (${r.sky.map(v => v.toFixed(2))})`);
    await context.close();
  }

  // to Sister Ama through black: the picture fades out, the camera and the scene change while it's black, her room fades
  // in; the camera never seen gliding across the landscape's end; the same going back; at once with reduced motion; a
  // swipe towards her doesn't move the camera
  for (const rm of ['no-preference', 'reduce']) {
    const { context, page, errors } = await openStory(browser, SCREENS[0][1], '', { reducedMotion: rm });
    const label = `to Sister Ama${rm === 'reduce' ? ' (reduced motion)' : ''}`;
    const settled = () => page.waitForFunction(() => !sortiaIntro.classList.contains('moving'), null, { timeout: 8000 });
    await page.evaluate(() => Intro.go(6)); await settled(); await page.waitForTimeout(rm === 'reduce' ? 50 : 1000);
    const [fsX, amaX] = await page.evaluate(() => [Intro.panorama.stop(6).x, Intro.panorama.stop(7).x]);
    // Observe the camera change itself: polling can miss a short black hold on a busy browser.
    await page.evaluate(() => {
      window.cutChanges = []; let x = Intro.panorama.camera.x;
      new MutationObserver(() => {
        const next = Intro.panorama.camera.x;
        if (Math.abs(next - x) < 0.5) return;
        x = next; cutChanges.push({ x, veil: +getComputedStyle(document.querySelector('.si-veil')).opacity });
      }).observe(document.querySelector('.sp-main'), { attributes: true, attributeFilter: ['style'] });
    });
    const watch = async () => {
      const seen = [];
      const deadline = Date.now() + 8000;
      for (let i = 0; Date.now() < deadline; i++) {
        seen.push(await page.evaluate(() => ({ x: Intro.panorama.camera.x, veil: +getComputedStyle(document.querySelector('.si-veil')).opacity, moving: sortiaIntro.classList.contains('moving'), title: siTitle.textContent })));
        if (i > 2 && !seen[i].moving) break;
        await page.waitForTimeout(rm === 'reduce' ? 10 : 40);
      }
      return { seen, changes: await page.evaluate(() => cutChanges.splice(0)) };
    };
    const judge = ({ seen, changes }, a, b, to, what) => {
      const onlyTwo = seen.every(v => Math.abs(v.x - a) < 0.5 || Math.abs(v.x - b) < 0.5), first = seen.findIndex(v => Math.abs(v.x - b) < 0.5), end = seen[seen.length - 1];
      check(onlyTwo, `${label}: ${what}: the camera is never between the two places (${[...new Set(seen.map(v => v.x.toFixed(0)))]})`);
      if (rm === 'reduce') check(seen.every(v => v.veil < 0.01) && first === 0, `${label}: ${what}: at once, no black`);
      else check(changes.some(v => Math.abs(v.x - b) < 0.5 && v.veil >= 0.98) && seen.some(v => v.veil > 0.05 && v.veil < 0.95),
        `${label}: ${what}: fades to black, changes while black, fades in (${seen.map(v => v.veil.toFixed(2)).join(' ')})`);
      check(end.veil < 0.01 && end.title === to && Math.abs(end.x - b) < 0.5, `${label}: ${what}: landed at ${to}, nothing dark left (${end.veil})`);
    };
    await page.click('#siNext'); judge(await watch(), fsX, amaX, 'Sister Ama', 'on');
    await page.waitForTimeout(300);
    await page.click('#siBack'); judge(await watch(), amaX, fsX, 'The False Signal', 'back');
    // a swipe towards her: the camera stays where it is while the finger moves; letting go goes through black
    const drag = await page.evaluate(async () => {
      const box = sortiaIntro, target = box.querySelector('.si-copy'), xs = [];
      const t = (type, x) => box.dispatchEvent(new TouchEvent(type, { bubbles: true, touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target, clientX: x, clientY: 300 })], changedTouches: [new Touch({ identifier: 1, target, clientX: x, clientY: 300 })] }));
      t('touchstart', 320); for (const x of [300, 260, 200, 140]) { t('touchmove', x); xs.push(Intro.panorama.camera.x); }
      t('touchend', 140);
      return xs;
    });
    check(drag.every(x => Math.abs(x - fsX) < 0.5), `${label}: a swipe towards Sister Ama doesn't move the camera (${drag.map(v => v.toFixed(0))})`);
    judge(await watch(), fsX, amaX, 'Sister Ama', 'by a swipe');
    check(errors.length === 0, `${label}: no errors (${errors})`);
    await context.close();
  }

  // Sister Ama's room (sprites/ui/story/ama): the temple fills the screen at her stop, both pictures sharp (never
  // stretched), no filters, the window's view drifting no more than its 5.43 x 3.62 world units anywhere on the way
  // (none at her stop, none with reduced motion), and no bare spot
  for (const [name, device] of SCREENS) for (const rm of ['no-preference', 'reduce']) {
    if (rm === 'reduce' && name !== 'iPhone 13 Pro Max') continue;
    const { context, page, errors } = await openStory(browser, device, '', { reducedMotion: rm });
    await page.click('#siSkip');
    await page.waitForFunction(() => Intro.panorama.needed(Intro.panorama.count - 1).every(id => Intro.panorama.planes().find(p => p.id === id).loaded), null, { timeout: 20000 });
    await page.waitForFunction(() => !sortiaIntro.classList.contains('moving') && siTitle.textContent === 'Sister Ama', null, { timeout: 10000 });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const p = Intro.panorama, win = document.querySelector('[data-id="ama-window-view"]'), tem = document.querySelector('[data-id="ama-temple"]');
      const tb = tem.getBoundingClientRect(), col = document.querySelector('.si-col').getBoundingClientRect(), shift = el => { const t = getComputedStyle(el).translate.split(' '); return [parseFloat(t[0]) || 0, parseFloat(t[1]) || 0]; };
      const atStop = shift(win), mags = p.planes().filter(x => /^ama-/.test(x.id)).map(x => x.magnification);
      let most = [0, 0];
      for (let x = p.stop(0).x; x <= p.stop(p.count - 1).x; x += 4) { p.place(p.atX(x)); const [dx, dy] = shift(win), k = new DOMMatrix(getComputedStyle(win.parentElement).transform).a / p.scale; most = [Math.max(most[0], Math.abs(dx) * k), Math.max(most[1], Math.abs(dy) * k)]; } // (the drift is in the depth's own px: the depth's scale turns it to world units)
      p.place(p.stop(p.count - 1));
      return { fills: tb.left <= col.left + 0.5 && tb.right >= col.right - 0.5 && tb.top <= col.top + 0.5 && tb.bottom >= col.bottom - 0.5, atStop, most, mags, gaps: p.gaps().length,
        filters: [win, tem, tem.parentElement].map(el => getComputedStyle(el).filter).filter(f => f !== 'none').length };
    });
    const label = `${name}${rm === 'reduce' ? ' (reduced motion)' : ''}`;
    check(r.fills, `${label}: Ama's room fills the screen at her stop`);
    check(r.mags.length === 2 && r.mags.every(v => v > 0 && v <= 1.05), `${label}: Ama's two pictures never stretched (${r.mags.map(v => v && v.toFixed(2))})`);
    check(r.atStop.every(v => Math.abs(v) < 0.01), `${label}: the window's view sits as placed at her stop (${r.atStop})`);
    check(rm === 'reduce' ? r.most.every(v => v === 0) : r.most[0] <= 5.44 && r.most[0] > 0.5 && r.most[1] <= 3.63, `${label}: the window's view drifts at most 5.43 x 3.62 world units on the whole way (${r.most.map(v => v.toFixed(2))})`);
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
