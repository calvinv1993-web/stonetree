// The phone's interface in a real browser, on three iPhone sizes (SE, 15, 15 Pro Max) installed as an app (the home
// indicator's inset emulated): every control big enough to hit and clear of the others, and each gesture doing one
// thing only - a tap on the map walks; a tap on a button uses it, a hold chooses what goes there, a sideways swipe
// changes its set; the tab opens the drawer; a tap on the chat line opens the chat. None of those walk.
// Needs Playwright (see AGENTS.md). Run: node tests/mobile-ui.test.js [screenshot folder]
const path = require('path');
const { serve } = require('./serve');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright');

const PHONES = [['iPhone SE', 375, 667, 0, 0], ['iPhone 15', 393, 852, 59, 34], ['iPhone 15 Pro Max', 430, 932, 59, 34]];
const MIN_TARGET = 40; // css px: Apple asks 44 pt for a finger; the action buttons may be a little under on the smallest phone

(async () => {
  const shots = process.argv[2], url = await serve(), browser = await chromium.launch();
  let failed = 0, passed = 0;
  const check = (name, ok, info = '') => { if (ok) passed++; else failed++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  ${info}`}`); };
  for (const [name, W, H, statusBar, home] of PHONES) {
    console.log(name);
    // installed: the page starts below the status bar; the home indicator's inset at the bottom
    const page = await browser.newPage({ viewport: { width: W, height: H - statusBar }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, bottom: home, left: 0, right: 0 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('tilequest.favs.tester', JSON.stringify(['light_heal', null, null, null, null, null, null, null, null, 'h', 'm', 'f', null, null, null, null, null, null])));
    await page.goto(`${url}/index.html`);
    await page.fill('#createName', 'Tester'); await page.click('#createStart'); await page.click('#outfitDone', { timeout: 3000 }).catch(() => {});
    await page.waitForFunction(() => Preload.ready, null, { timeout: 60000 });
    await page.evaluate(() => { $('guide').hidden = true; player.level = 5; player.mana = player.maxMana; favShown = ''; renderHotbar(); });
    await page.waitForTimeout(300);

    // every control: its size, and that a finger on its middle lands on it (nothing over it)
    const controls = await page.evaluate(() => {
      const list = [...document.querySelectorAll('#favs .fav')].map((el, i) => [`action button ${i + 1}`, el]);
      list.push(['smart button', $('tAttack')], ['drawer tab', $('drawerTab')], ['chat line', $('chatLine')], ['round map', $('hudMap')], ['menu button', $('hudMenu')]);
      return list.map(([n, el]) => { const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { n, w: Math.round(r.width), h: Math.round(r.height), hit: !!hit && (hit === el || el.contains(hit)), bottom: Math.round(r.bottom) }; });
    });
    for (const c of controls) {
      const small = c.n === 'drawer tab' || c.n === 'chat line' ? 16 : MIN_TARGET; // (the tab and the line are wide: their height may be less)
      check(`${c.n}: ${c.w} x ${c.h}, under the finger`, c.hit && Math.min(c.w, c.h) >= small, JSON.stringify(c));
    }
    const view = await page.evaluate(() => { const v = innerHeight, b = $('actionDock').getBoundingClientRect(); return { dockBottom: Math.round(b.bottom), v }; });
    check('the action bar reaches the bottom, its buttons clear of the home indicator', view.dockBottom === view.v && controls.every(c => c.bottom <= view.v - home), JSON.stringify(view));

    const at = () => page.evaluate(() => `${player.x},${player.y}`);
    const centre = async sel => { const b = await page.locator(sel).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
    const start = await at();

    // a tap on an action button uses it, and doesn't walk
    await page.evaluate(() => { player.hp = 1; messages = []; });
    let [x, y] = await centre('#favs .fav >> nth=0');
    await page.mouse.click(x, y); await page.waitForTimeout(150);
    check('a tap on a spell casts it (and nothing else)', await page.evaluate(() => player.hp > 1) && (await at()) === start);
    // a hold opens the chooser, without casting
    await page.evaluate(() => { player.hp = 1; player.spellReady = 0; player.mana = player.maxMana; });
    await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up(); await page.waitForTimeout(100);
    const held = await page.evaluate(() => ({ picker: !$('favPicker').hidden, mana: player.mana, max: player.maxMana }));
    check('a hold chooses what goes there (no cast)', held.picker && held.mana === held.max && (await at()) === start, JSON.stringify(held));
    await page.evaluate(() => { $('favPicker').hidden = true; player.hp = player.maxHp; player.mana = player.maxMana; player.spellReady = 0; });
    // a sideways swipe changes the set, without casting or walking
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(x - i * 12, y + 1);
    await page.mouse.up(); await page.waitForTimeout(150);
    const swiped = await page.evaluate(() => ({ page: favPageIndex, mana: player.mana, max: player.maxMana }));
    check('a sideways swipe over the spells shows the next set (no cast, no walk)', swiped.page === 1 && swiped.mana === swiped.max && (await at()) === start, JSON.stringify(swiped));
    await page.evaluate(() => { favPageIndex = 0; favShown = ''; renderFavs(); });
    // the drawer tab
    [x, y] = await centre('#drawerTab');
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(x, y - i * 10);
    await page.mouse.up(); await page.waitForTimeout(350);
    check('a swipe up on the tab opens the drawer (no walk)', await page.evaluate(() => InventoryDrawer.stage() === 1) && (await at()) === start);
    if (shots) await page.screenshot({ path: path.join(shots, `${name.replace(/ /g, '-')}-drawer.png`) });
    await page.evaluate(() => InventoryDrawer.close()); await page.waitForTimeout(300);
    // the chat line
    await page.evaluate(() => log('A message to tap.'));
    [x, y] = await centre('#chatLine');
    await page.mouse.click(x, y); await page.waitForTimeout(200);
    check('a tap on the chat line opens the chat (no walk)', await page.evaluate(() => document.body.classList.contains('chat-open')) && (await at()) === start);
    await page.evaluate(() => setChat(false));
    if (shots) await page.screenshot({ path: path.join(shots, `${name.replace(/ /g, '-')}.png`) });
    // and a tap on the map walks
    const v = await page.locator('#view').boundingBox(), tile = v.width / await page.evaluate(() => VIEW_W);
    await page.mouse.click(v.x + v.width / 2, v.y + v.height / 2 + 2 * tile); await page.waitForTimeout(900);
    check('a tap on the map walks there', (await at()) !== start, `${start} -> ${await at()}`);
    check('no errors on the page', !errors.length, errors.join(' | '));
    await page.close();
  }
  await browser.close();
  console.log(failed ? `${failed} failed, ${passed} passed` : `all ${passed} passed`);
  process.exit(failed ? 1 : 0);
})();
