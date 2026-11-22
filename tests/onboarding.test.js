'use strict';
// A new character's welcome from the first page to the world, in a real browser, on four phone widths, a tablet and a
// computer: the story (each chapter its own picture), Sister Ama and the name (its checks), the outfit (its colours), the
// path (one at a time, confirmed), then the game: the welcome gone, the guide and the first quest as for any new
// character, nothing made twice; and after a reload the same character, as chosen, with no welcome again.
//   node tests/onboarding.test.js [screenshot-folder]
// Needs playwright-core and its Chromium (npm install, then npx playwright install chromium).
const path = require('path');
const { serve } = require('./serve');

let chromium;
try {
  ({ chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core'));
} catch (e) {
  console.log('playwright-core is not installed: run `npm install` and `npx playwright install chromium` first.');
  process.exit(2);
}

const shots = process.argv[2];
const phone = (width, height) => ({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const SCREENS = [['320', phone(320, 568)], ['375', phone(375, 667)], ['390', phone(390, 844)], ['430', phone(430, 932)],
  ['tablet', phone(820, 1180)], ['desktop', { viewport: { width: 1440, height: 900 } }]];
const CHAPTERS = ['01_the_beginning', '02_the_hollow_host', '03_the_last_town', '04_and_you', '05_your_road'];
let failed = 0, passed = 0;
const check = (ok, what) => { if (ok) passed++; else { failed++; console.log(`  FAIL ${what}`); } };

// what must hold on every step: nothing past the screen's sides, the way on in sight and big enough to tap
const fits = page => page.evaluate(() => {
  const out = [], W = innerWidth, H = innerHeight;
  if (document.documentElement.scrollWidth > W + 1) out.push('the page scrolls sideways');
  const win = [...document.querySelectorAll('#storyBook:not([hidden]) .sb-panel, .ob-screen:not([hidden])')].pop();
  if (win) {
    const r = win.getBoundingClientRect();
    if (r.left < -0.5 || r.right > W + 0.5 || r.top < -0.5 || r.bottom > H + 0.5) out.push('its window past the screen');
    const go = [...win.querySelectorAll('.ob-btn')].find(b => b.offsetParent && getComputedStyle(b).visibility !== 'hidden');
    if (go) { const q = go.getBoundingClientRect(); if (q.height < 44 || q.bottom > H + 0.5 || q.top < 0) out.push(`its way on ${Math.round(q.height)}px, or out of sight`); }
  }
  return out;
});

(async () => {
  const browser = await chromium.launch();
  const url = await serve();
  for (const [name, device] of SCREENS) {
    const context = await browser.newContext(device);
    const page = await context.newPage();
    const errors = [], missing = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (/sprites\/ui\/(story|parchment)\//.test(r.url()) && r.status() >= 400) missing.push(r.url()); });
    const step = async (label) => {
      for (const problem of await fits(page)) check(false, `${name} ${label}: ${problem}`);
      if (shots) await page.screenshot({ path: path.join(shots, `${name}-${label}.png`) });
    };
    await page.goto(`${url}/index.html?story&pickpath${device.isMobile ? '&mobile' : ''}`);
    await page.waitForSelector('#storyBook:not([hidden])', { timeout: 30000 });

    // the story: five chapters, each its own picture; Next shows a chapter's words, then turns
    // (turning a page without buttons: a tap on the right of the screen goes on, on the left back; a sideways swipe too)
    const W = device.viewport.width, H = device.viewport.height;
    const tap = async x => { await page.mouse.click(x, H * 0.55); await page.waitForTimeout(250); };
    const swipe = async (x0, x1) => { await page.mouse.move(x0, H * 0.4); await page.mouse.down(); await page.mouse.move((x0 + x1) / 2, H * 0.4); await page.mouse.move(x1, H * 0.41); await page.mouse.up(); await page.waitForTimeout(500); };
    const title = () => page.evaluate(() => sbTitle.textContent);
    check(await page.evaluate(() => !document.querySelector('#storyBook button.ob-btn, #sbNext, #sbBack')), `${name}: no Next or Back buttons on the story`);
    check(await page.evaluate(() => { const art = sbPage.querySelector('.sb-sheet-art'); return art.complete && art.naturalWidth === 1199 && art.naturalHeight === 1312 && /story-panel\.webp/.test(art.src); }),
      `${name}: the story's page is the parchment picture, at its own size`);
    const seen = [], spots = new Set();
    for (let i = 0; i < CHAPTERS.length; i++) {
      await page.waitForTimeout(700);
      spots.add(await page.evaluate(() => { const r = sbPage.getBoundingClientRect(); return `${r.left.toFixed(1)},${r.top.toFixed(1)},${r.width.toFixed(1)}`; }));
      seen.push(await page.evaluate(() => (document.querySelector('.sb-shot.on').getAttribute('src').match(/ui\/story\/(\w+)\.webp/) || [])[1]));
      check(await page.evaluate(() => { const w = document.querySelector('.sb-writing'); sbPage.classList.add('shown'); return w.scrollHeight <= w.clientHeight + 1; }), `${name}: chapter ${i + 1}'s words fit its page`);
      await step(`story${i + 1}`);
      if (i < CHAPTERS.length - 1) {
        const t = await title();
        for (let k = 0; k < 4 && await title() === t; k++) await tap(W * 0.8);
      }
    }
    check(spots.size === 1, `${name}: the page stands in the same place on every chapter (${[...spots].join(' | ')})`);
    check(seen.join() === CHAPTERS.join(), `${name}: the five chapters, each its own picture (${seen})`);
    check(await page.evaluate(() => /Tap to begin/.test(sbHint.textContent) && sbSkip.hidden), `${name}: the last chapter: Tap to begin, no Skip`);
    await tap(W * 0.15); check(await title() === 'And You', `${name}: a tap on the left goes back`);
    await page.waitForTimeout(2600); // (its words all in: the next tap or swipe turns the page)
    await swipe(W * 0.8, W * 0.2); check(await title() === 'Your Road', `${name}: a swipe to the left goes on`);
    await swipe(W * 0.2, W * 0.8); check(await title() === 'And You', `${name}: a swipe to the right goes back`);
    await page.waitForTimeout(2600);
    await page.evaluate(() => { StoryBook.go(1); StoryBook.go(1); StoryBook.go(1); }); await page.waitForTimeout(500);
    check(await title() === 'Your Road', `${name}: quick turns turn one page at a time`);
    for (let k = 0; k < 4 && await page.evaluate(() => !storyBook.hidden && !storyBook.classList.contains('leaving')); k++) await tap(W * 0.6);
    await page.waitForTimeout(1200);

    // your name, before Sister Ama in the temple
    const scene = () => page.evaluate(() => { const el = document.getElementById('templeScene'); return el.hidden ? '' : el.dataset.scene; });
    check(await scene() === 'temple', `${name}: the name, in the temple`);
    check(await page.evaluate(() => /what is your name\?/.test(createAma.textContent) && createStart.disabled), `${name}: Sister Ama asks your name; Continue waits`);
    await page.fill('#createName', 'x');
    check(await page.evaluate(() => createStart.disabled && !!createHint.textContent), `${name}: a name too short is refused, and says why`);
    await page.fill('#createName', 'lickii tester');
    check(await page.evaluate(() => !createStart.disabled), `${name}: a good name opens the way on`);
    // (the name's window: the story's parchment as painted, under the temple; no heading; Sister Ama's words all in sight)
    check(await page.evaluate(() => {
      const art = create.querySelector('.ns-art'), r = create.getBoundingClientRect();
      return art && art.complete && art.naturalWidth === 1199 && Math.abs(r.width / r.height - 1199 / 1312) < 0.01 && !create.querySelector('.ob-title');
    }), `${name}: the name on the story's parchment, at its own shape, with no heading`);
    check(await page.evaluate(() => { const a = create.querySelector('.ns-talk'); return a.scrollHeight <= a.clientHeight + 1; }), `${name}: Sister Ama's words fit the parchment`);
    check(await page.evaluate(() => { const w = create.querySelector('.ns-writing').getBoundingClientRect(), b = createStart.getBoundingClientRect(), f = createName.getBoundingClientRect();
      return b.bottom <= w.bottom + 0.5 && f.left >= w.left - 0.5 && f.right <= w.right + 0.5; }), `${name}: the field and the way on inside the parchment's writing area`);
    check(await page.evaluate(s => { const r = create.getBoundingClientRect(); return r.top > innerHeight * 0.1 && [r.left - s[0], r.top - s[1], r.width - s[2]].every(d => Math.abs(d) < 1.5); }, [...spots][0].split(',').map(Number)),
      `${name}: the parchment the story's size, in its place, the temple in sight`);
    await step('name');
    await page.evaluate(() => { createStart.click(); createStart.click(); });
    await page.waitForTimeout(600);

    // (no appearance while the character is made: straight on to the path)
    check(await page.evaluate(() => outfit.hidden), `${name}: no outfit while the character is made`);

    // your path: one at a time, chosen only once confirmed
    check(await scene() === 'paths' && await page.evaluate(() => !pathPick.hidden && document.querySelectorAll('.sv-card').length === 3 && document.querySelectorAll('.sv-card[data-position=center]').length === 1),
      `${name}: the path, in the hall of paths: three cards, one looked at`);
    check(await page.evaluate(() => [...document.querySelectorAll('.sv-portrait, .sv-medal')].every(i => i.complete && i.naturalWidth > 0)), `${name}: the paths' pictures and emblems there`);
    // looking: the arrows (a phone), a dot, the arrow keys; the button names the path; nothing chosen
    await page.evaluate(() => document.querySelectorAll('#pathDots button')[0].click());
    await page.keyboard.press('ArrowRight');
    check(await page.evaluate(() => pathChoose.textContent === 'Choose Hawk' && player.vocation === 'none'), `${name}: a dot and the arrow keys; looking chooses nothing`);
    // (one order for the cards, a swipe and the dots: Bastion, Hawk, Ember)
    check(await page.evaluate(() => { const at = v => document.querySelector(`.sv-card[data-v=${v}]`).dataset.position; return at('knight') === 'left' && at('paladin') === 'center' && at('sorcerer') === 'right'
      && [...pathDots.children].map(d => d.getAttribute('aria-label')).join() === 'Show Bastion,Show Hawk,Show Ember' && pathDots.children[1].getAttribute('aria-current') === 'true'; }),
      `${name}: Bastion left of Hawk, Ember right of it, the dots in that order`);
    await page.keyboard.press('ArrowLeft');
    check(await page.evaluate(() => pathChoose.textContent === 'Choose Bastion' && pathDots.children[0].getAttribute('aria-current') === 'true'), `${name}: to the left of Hawk: Bastion, its dot current`);
    { // (the parchment and the way on stand still whichever path is looked at; the whole screen fits; the title inside its banner)
      // (the parchment as tall as the longest path's at this width: the button and the dots in one place for every path, over its
      // foot, 18 to 26px under the longest path's words; the dots 44px to tap, the one shown current)
      const seen = [];
      for (let k = 0; k < 3; k++) {
        const g = await page.evaluate(() => {
          const R = e => e.getBoundingClientRect(), p = R(pathInfo), b = R(pathChoose);
          const last = Math.max(...[...pathInfo.querySelectorAll('.sv-desc, .sv-list li, .sv-items li')].map(e => R(e).bottom));
          const dots = [...pathDots.children], cur = dots.findIndex(d => d.getAttribute('aria-current') === 'true');
          return { gap: Math.round(b.top - last), at: `${Math.round(b.top)},${Math.round(R(pathDots).top)}`, over: b.top < p.bottom && b.bottom > p.bottom,
            inside: last <= p.bottom, dots: dots.every(d => R(d).width >= 44 && R(d).height >= 44),
            synced: START_PATHS[cur] === document.querySelector('.sv-card[data-position=center]').dataset.v, path: pathChoose.textContent };
        });
        seen.push(g);
        check(g.gap >= 18 && g.over && g.inside && g.dots && g.synced, `${name}: ${g.path}: the button over the parchment's foot, under all its words; the dots to tap (${JSON.stringify(g)})`);
        await page.evaluate(() => pathNext.click()); await page.waitForTimeout(150);
      }
      check(seen.every(g => g.at.split(',').every((v, i) => Math.abs(v - seen[0].at.split(',')[i]) <= 1)) && Math.min(...seen.map(g => g.gap)) <= 26, `${name}: the button and the dots in one place for every path (${seen.map(g => `${g.at} ${g.gap}`).join(' | ')})`);
      // (the whole screen fits from 375 x 667 up; the smallest phone, 320 x 568, scrolls up and down to the button, the words kept large)
      if (name !== '320') check(await page.evaluate(() => document.querySelector('.sv-scene').scrollHeight <= pathPick.clientHeight + 1), `${name}: the vocation screen fits without scrolling`);
      for (let k = 0; k < 3; k++) {
        const g = await page.evaluate(() => {
          const R = e => e.getBoundingClientRect(), hs = [...pathInfo.querySelectorAll('.sv-cols h3')].map(R), items = [...pathInfo.querySelectorAll('.sv-items li')].map(R);
          const size = s => parseFloat(getComputedStyle(pathInfo.querySelector(s)).fontSize);
          return { heads: Math.abs(hs[0].top - hs[1].top) < 1 && Math.abs(hs[0].bottom - hs[1].bottom) < 1, gear: Math.abs(hs[2].left - hs[1].left) < 1,
            items: items.every(r => Math.abs(r.width - items[0].width) < 0.5) && Math.abs((items[1].left - items[0].right) - (items[2].left - items[1].right)) < 1,
            words: size('.sv-desc') >= 13 && size('.sv-list li') >= 13, phone: matchMedia('(max-width: 600px) and (max-aspect-ratio: 4/5)').matches && size('.sv-desc') >= 14 && size('.sv-list li') >= 14,
            path: pathChoose.textContent };
        });
        check(g.heads && g.gear && g.items, `${name}: ${g.path}: Strengths and Weakness on one line, Starts with under Weakness, the kit's boxes alike (${JSON.stringify(g)})`);
        check(g.words && (g.phone || !/^(320|375|390|430)$/.test(name)), `${name}: ${g.path}: the parchment's words large enough to read`);
        await page.evaluate(() => pathNext.click()); await page.waitForTimeout(150);
      }
      check(await page.evaluate(() => { const b = document.querySelector('.sv-banner').getBoundingClientRect(), l = [...document.querySelectorAll('.sv-title i')].map(i => i.getBoundingClientRect()); return l.length === 16 && l[0].left >= b.left + b.width * 0.08 && l[15].right <= b.right - b.width * 0.08; }), `${name}: the title's letters all within its banner`);
      await page.evaluate(() => document.querySelectorAll('#pathDots button')[0].click());
    }
    check(await page.evaluate(() => { const i = pathInfo; return i.classList.contains('sv-paper') && /Strengths/.test(i.textContent) && /Weakness/.test(i.textContent) && i.querySelectorAll('.sv-items img').length >= 3; }),
      `${name}: on parchment: strengths, weakness, the kit with the game's own item pictures`);
    check(await page.evaluate(() => pathBack.hidden), `${name}: no Back from the paths (the name is given)`);
    await page.evaluate(() => document.querySelectorAll('#pathDots button')[2].click());
    await step('path');
    await page.click('#pathChoose');
    check(await page.evaluate(() => player.vocation === 'none' && !pathAsk.hidden), `${name}: not chosen before it's confirmed`);
    await page.evaluate(() => { const yes = pathAsk.querySelector('.ob-btn'); yes.click(); yes.click(); });
    await page.waitForTimeout(800);

    // the game: the outfit window, once, a moment later, in the game's own look: a colour chosen comes out on the character
    await page.waitForSelector('#outfit:not([hidden])', { timeout: 15000 }).catch(() => {});
    check(await page.evaluate(() => !outfit.hidden && !document.body.classList.contains('welcome') && !outfit.classList.contains('parchment-panel') && outfitDone.textContent === 'Done'),
      `${name}: in the world, the outfit window, in the game's own look`);
    await page.click('.outfit-parts button:nth-child(2)');
    await page.click('.outfit-hues .swatch-color:nth-child(12)');
    await page.click('.outfit-shades .swatch-color:nth-child(4)');
    await page.click('#outfit >> text=Female');
    check(await page.evaluate(() => [...document.querySelectorAll('#outfit .swatch-color.active')].every(b => getComputedStyle(b).backgroundColor === b.style.backgroundColor && getComputedStyle(b).backgroundImage === 'none')),
      `${name}: a chosen colour shows as itself`);
    const want = await page.evaluate(() => JSON.stringify(outfitDraft));
    if (shots) await page.screenshot({ path: path.join(shots, `${name}-outfit.png`) }); // (the game's own window: not the welcome's checks)
    check(await page.evaluate(() => { const r = outfit.getBoundingClientRect(); return r.top >= -0.5 && r.bottom <= innerHeight + 0.5; }), `${name}: the outfit window on the screen`);
    await page.evaluate(() => { outfitDone.click(); outfitDone.click(); });
    await page.waitForTimeout(500);
    check(await page.evaluate(() => outfit.hidden), `${name}: Done closes it`);

    // the game: as for any new character, nothing twice
    const game = await page.evaluate(() => ({
      welcome: document.body.classList.contains('welcome'), scene: !document.getElementById('templeScene').hidden, name: player.name, vocation: player.vocation,
      outfit: JSON.stringify(player.outfit), tutorial: player.tutorial, quests: Object.keys(player.quests).length, at: [player.x, player.y, player.z],
      start: [map.start.x, map.start.y, map.start.z], amas: npcs.filter(n => n.npcId === 'ama').length, guide: !$('guide').hidden, paused,
    }));
    check(!game.welcome && !game.scene && !game.paused, `${name}: into the world, the welcome gone`);
    check(game.name === 'Lickii tester' && game.vocation === 'sorcerer' && game.outfit === want, `${name}: the name, outfit and path as chosen`);
    check(game.tutorial === 1 && game.quests === 0 && game.guide, `${name}: the guide at its first step, no quest begun twice (${game.tutorial}, ${game.quests})`);
    check(game.amas === 1 && Math.abs(game.at[0] - game.start[0]) <= 2 && Math.abs(game.at[1] - game.start[1]) <= 2 && game.at[2] === game.start[2], `${name}: in the temple where every character wakes, Sister Ama once`);
    await step('game');

    // a reload: the same character, no welcome again
    await page.evaluate(() => saveGame());
    await page.reload();
    await page.waitForFunction(() => typeof player !== 'undefined' && player && player.name !== 'Adventurer', null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const again = await page.evaluate(() => ({ story: !storyBook.hidden, welcome: document.body.classList.contains('welcome'), name: player.name, vocation: player.vocation, outfit: JSON.stringify(player.outfit) }));
    check(!again.story && !again.welcome && again.name === 'Lickii tester' && again.vocation === 'sorcerer' && again.outfit === want, `${name}: after a reload, the same character, no welcome`);

    check(!missing.length, `${name}: every picture there (${missing})`);
    check(!errors.length, `${name}: no errors on the page (${errors})`);
    console.log(`  ok   ${name}`);
    await context.close();
  }
  await browser.close();
  console.log(failed ? `${failed} of ${passed + failed} failed` : `all ${passed} passed`);
  process.exit(failed ? 1 : 0);
})();
