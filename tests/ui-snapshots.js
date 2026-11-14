// Pictures of the interface in many states, without the map (its canvas and the minimaps hidden, the log's times
// blanked), to tell whether a change to the CSS moved anything: take them before, again after, and compare.
//   node tests/ui-snapshots.js <folder>                 take them
//   node tests/ui-snapshots.js <folder> --compare <ref>  take them and compare each with the one in <ref>
// Beside each picture it keeps every element's computed style (<state>.json): that is what the compare goes by, since
// it doesn't move with the clock or the map. A difference is listed by element and property; the pictures show it.
// Desktop, phones upright (iPhone SE, 15) and on their side, the map editor and the data editor. Needs Playwright.
const fs = require('fs'), path = require('path');
const { serve } = require('./serve');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright');

const out = process.argv[2], refAt = process.argv.indexOf('--compare'), ref = refAt > 0 ? process.argv[refAt + 1] : null;
if (!out) { console.log('usage: node tests/ui-snapshots.js <folder> [--compare <reference folder>]'); process.exit(1); }
fs.mkdirSync(out, { recursive: true });

// what's left out: the map and anything drawn from it, and what changes by itself
const STILL = `#view, #minimap, #hudMap canvas, #hudFace, #talkFace, #worldCanvas, canvas { visibility: hidden !important; }
  .time, .chat-line-time { visibility: hidden !important; } *, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }
  #toasts, .toast, #speedMeter { display: none !important; } .chat-line { opacity: 1 !important; }`;

const game = async (page, url) => {
  // (the same day and hour every time: the log's times and the world's clock read the date)
  await page.addInitScript(() => { const T = Date.UTC(2026, 0, 1, 12, 0, 0), D = Date; Date = class extends D { constructor(...a) { super(...(a.length ? a : [T])); } static now() { return T; } }; });
  await page.addInitScript(() => { localStorage.clear(); Math.random = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })(); });
  await page.goto(`${url}/index.html`);
  await page.fill('#createName', 'Snap'); await page.click('#createStart'); await page.click('#outfitDone', { timeout: 3000 }).catch(() => {});
  await page.waitForFunction(() => Preload.ready, null, { timeout: 60000 });
  await page.addStyleTag({ content: STILL });
  await page.evaluate(() => {
    paused = true; player.gold = 120;
    // a bag inside the bag, and a piece of gear of each grade (their coloured edges)
    bag().contents.push({ id: 'backpack', count: 1, contents: [{ id: 'bread', count: 2 }] });
    for (const q of [1, 2, 3, 4]) bag().contents.push({ id: 'wooden_club', count: 1, q });
    uiDirty();
  });
  await page.waitForTimeout(300);
};

// each state: a name and what to do to get there (from the game as it starts)
const SHARED = [ // (on desktop and phones alike)
  ['battle', async p => p.evaluate(() => { const m = spawnMonster({ type: 'rat', x: player.x + 2, y: player.y, z: player.z }); m.x = player.x + 2; m.y = player.y; monsters.push(m); player.target = m; uiDirty(); renderBattle && renderBattle(); })],
  ['shop', async p => p.evaluate(() => { const n = npcs.find(n => n.def.trade) || npcs[0]; openShop(n); uiDirty(); })],
  ['loot', async p => p.evaluate(() => { player.openPile = { id: 99, name: 'a dead rat', x: player.x, y: player.y, z: player.z, items: [{ id: 'apple', count: 3 }, { id: 'wooden_club', count: 1, q: 2 }] }; uiDirty(); })],
  ['guild', async p => p.evaluate(() => toggleGuild(true))],
  ['forge', async p => p.evaluate(() => openForge(npcs[0].npcId))],
  ['hotkeys', async p => p.evaluate(() => openHotkeys())],
  ['mark', async p => p.evaluate(() => openMark({ x: player.x, y: player.y, z: player.z }, 1))],
  ['read', async p => p.evaluate(() => showWindow('A sign', 'Words on a sign, to be read.'))],
  ['ctx', async p => p.evaluate(() => openCreatureMenu({ clientX: 220, clientY: 300 }, npcs[0], { x: npcs[0].x, y: npcs[0].y, z: npcs[0].z }))],
  ['low-hp', async p => p.evaluate(() => { player.hp = 10; updateBars(); })],
];
const DESKTOP = [
  ['start', async () => {}],
  ['guide', async p => p.evaluate(() => { $('guide').hidden = false; })],
  ['bag-open', async p => p.evaluate(() => { Actions.useItem({ root: 'bag', path: [bag().contents.length - 1] }); })],
  ['outfit', async p => p.evaluate(() => openOutfit())],
  ['worldmap', async p => p.evaluate(() => toggleWorldMap())],
  ['talk', async p => p.evaluate(() => { logDialog('Sister Ama', 'Welcome, {child}. Ask me about the {temple}.'); })],
  ...SHARED,
];
const PHONE = [
  ['start', async () => {}],
  ['guide', async p => p.evaluate(() => { $('guide').hidden = false; })],
  ['menu', async p => p.evaluate(() => openSheet('menu'))],
  ['help', async p => p.evaluate(() => openSheet('menu', 'help'))],
  ['character', async p => p.evaluate(() => openSheet('character'))],
  ['bag', async p => p.evaluate(() => openSheet('character', 'bag'))],
  ['skills', async p => p.evaluate(() => openSheet('character', 'skills'))],
  ['quests', async p => p.evaluate(() => openSheet('quests'))],
  ['talk', async p => p.evaluate(() => { const n = npcs[0]; showTalk(n.name, 'Welcome, {child}. Ask me about the {temple} or your {quest}.'); })],
  ['chat', async p => p.evaluate(() => { log('A line in the log.'); setChat(true); })],
  ['picker', async p => p.evaluate(() => openFavPicker(0))],
  ['drawer', async p => p.evaluate(() => InventoryDrawer.open(1))],
  ['drawer-full', async p => p.evaluate(() => { Actions.useItem({ root: 'bag', path: [bag().contents.length - 1] }); InventoryDrawer.open(2); })],
  ['fighting', async p => p.evaluate(() => { document.body.classList.add('fighting'); })],
  ['worldmap', async p => p.evaluate(() => toggleWorldMap())],
  ['item-menu', async p => p.evaluate(() => { const i = bag().contents.length - 1; itemMenu({ root: 'bag', path: [i] }, bag().contents[i], { clientX: 200, clientY: 400 }); })],
  ['guide-folded', async p => p.evaluate(() => { $('guide').hidden = false; $('guide').classList.add('folded'); })],
  ...SHARED,
];
const RUNS = [
  ['desktop', { width: 1280, height: 800 }, DESKTOP],
  ['phone-15', { width: 393, height: 793, isMobile: true, hasTouch: true, inset: 34 }, PHONE],
  ['phone-se', { width: 375, height: 667, isMobile: true, hasTouch: true, inset: 0 }, PHONE.filter(([n]) => ['start', 'menu', 'character', 'talk', 'drawer', 'shop', 'loot'].includes(n))],
  ['phone-side', { width: 852, height: 393, isMobile: true, hasTouch: true, inset: 21 }, PHONE.filter(([n]) => ['start', 'menu', 'character', 'talk', 'chat', 'shop', 'loot', 'fighting'].includes(n))],
];

// Every element's computed style, by its place in the page (tag#id.class:nth path), only what differs from a plain
// element of the same tag (to keep it small)
const STYLES = () => {
  const out = {}, plain = {}, frame = document.createElement('iframe');
  document.body.appendChild(frame);
  const base = tag => { if (!plain[tag]) { const e = frame.contentDocument.createElement(tag); frame.contentDocument.body.appendChild(e); plain[tag] = getComputedStyle(e); } return plain[tag]; };
  const key = el => { const parts = []; for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
    const i = e.parentElement ? [...e.parentElement.children].indexOf(e) : 0;
    parts.unshift(`${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : ''}:${i}`); } return parts.join('>'); };
  for (const el of [document.documentElement, ...document.querySelectorAll('*')]) {
    if (el === frame || frame.contains(el)) continue;
    for (const pseudo of ['', '::before', '::after']) {
      const cs = getComputedStyle(el, pseudo || null), b = base(el.tagName), st = {};
      if (pseudo && cs.content === 'none') continue;
      for (let i = 0; i < cs.length; i++) { const p = cs[i]; if (/^(transition|animation)/.test(p)) continue; const v = cs.getPropertyValue(p); if (v !== b.getPropertyValue(p)) st[p] = v; }
      out[key(el) + pseudo] = st;
    }
  }
  frame.remove();
  return out;
};
// two style dumps: what differs, element by element (sizes that follow text, like a width in px of an auto box, are
// compared too: the same page with the same text gives the same numbers)
function check(name, a, b) {
  if (!fs.existsSync(a)) { console.log(`  NEW  ${name}`); return; }
  const A = JSON.parse(fs.readFileSync(a)), B = JSON.parse(fs.readFileSync(b)), lines = [];
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (!A[k] || !B[k]) { lines.push(`${A[k] ? 'gone' : 'new '} ${k}`); continue; }
    for (const p of new Set([...Object.keys(A[k]), ...Object.keys(B[k])])) if (A[k][p] !== B[k][p]) lines.push(`${k.split('>').slice(-2).join('>')} ${p}: ${A[k][p]} -> ${B[k][p]}`);
  }
  if (lines.length) { differ++; console.log(`  DIFF ${name}: ${lines.length}\n${lines.slice(0, 12).map(l => '       ' + l).join('\n')}`); } else same++;
}
let differ = 0, same = 0;

(async () => {
  const url = await serve(), browser = await chromium.launch();
  // every state on a page of its own, four at a time
  const jobs = [];
  for (const [run, view, states] of RUNS) for (const [name, go] of states) jobs.push({ run, view, name, go });
  const one = async ({ run, view, name, go }) => {
    const page = await browser.newPage({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: 1, isMobile: !!view.isMobile, hasTouch: !!view.hasTouch });
    if (view.inset !== undefined) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, bottom: view.inset, left: 0, right: 0 } });
    }
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await game(page, url);
    await page.evaluate(() => { const g = $('guide'); if (g) g.hidden = true; });
    await go(page); await page.waitForTimeout(250);
    const file = path.join(out, `${run}-${name}.png`);
    await page.screenshot({ path: file });
    fs.writeFileSync(file.replace(/\.png$/, '.json'), JSON.stringify(await page.evaluate(STYLES)));
    if (errors.length) console.log(`  ${run}-${name}: page errors: ${errors.join(' | ')}`);
    await page.close();
    if (ref) check(`${run}-${name}`, path.join(ref, `${run}-${name}.json`), file.replace(/\.png$/, '.json'));
  };
  const queue = [...jobs];
  await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await one(queue.shift()); }));
  for (const [name, page0] of [['editor', 'editor.html'], ['data', 'data.html']]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.addInitScript(() => { const T = Date.UTC(2026, 0, 1, 12, 0, 0), D = Date; Date = class extends D { constructor(...a) { super(...(a.length ? a : [T])); } static now() { return T; } }; });
    await page.goto(`${url}/${page0}`); await page.waitForTimeout(2500); await page.addStyleTag({ content: STILL }); await page.waitForTimeout(200);
    const file = path.join(out, `${name}.png`);
    await page.screenshot({ path: file });
    fs.writeFileSync(file.replace(/\.png$/, '.json'), JSON.stringify(await page.evaluate(STYLES)));
    if (ref) check(name, path.join(ref, `${name}.json`), file.replace(/\.png$/, '.json'));
    await page.close();
  }
  await browser.close();
  console.log(ref ? (differ ? `${differ} differ, ${same} the same` : `all ${same} the same`) : `taken in ${out}`);
  process.exit(ref && differ ? 1 : 0);
})();
