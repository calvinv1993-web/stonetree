'use strict';
// A new character's welcome from the first page to the world, in a real browser, on four phone widths, a tablet and a
// computer: the gate (loading, then Create account: its checks), the opening (four story cards, each its own picture),
// Sister Ama, who knows the name, and her talk, the
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
const CARDS = ['The Broken Seal', 'The Hollow Host', 'The Last Crossing', 'The False Signal'];
let failed = 0, passed = 0;
const check = (ok, what) => { if (ok) passed++; else { failed++; console.log(`  FAIL ${what}`); } };

// what must hold on every step: nothing past the screen's sides, the way on in sight and big enough to tap
const fits = page => page.evaluate(() => {
  const out = [], W = innerWidth, H = innerHeight;
  if (document.documentElement.scrollWidth > W + 1) out.push('the page scrolls sideways');
  const win = [...document.querySelectorAll('.ob-screen:not([hidden])')].pop();
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
    page.on('response', r => { if (/sprites\/ui\/(intro|story|parchment|sortia)\//.test(r.url()) && r.status() >= 400) missing.push(r.url()); });
    const step = async (label) => {
      for (const problem of await fits(page)) check(false, `${name} ${label}: ${problem}`);
      if (shots) await page.screenshot({ path: path.join(shots, `${name}-${label}.png`) });
    };
    await page.goto(`${url}/index.html?story&pickpath${device.isMobile ? '&mobile' : ''}`);
    // the gate: a moment of loading under the logo, then the way in; an account made (what's wrong said under the form)
    await page.waitForSelector('#sortiaGate:not([hidden])', { timeout: 30000 });
    check(await page.evaluate(() => !sgLoad.hidden && sgAuth.hidden), `${name}: the gate loads first`);
    await page.waitForSelector('#sgAuth:not([hidden])', { timeout: 15000 });
    await page.waitForTimeout(600);
    check(await page.evaluate(() => Gate.tab() === 'create' && !sgConfirmRow.hidden && !!document.querySelector('label[for=sgName]') && !!document.querySelector('label[for=sgPass]')),
      `${name}: then Create account: a name and a password, twice, with their labels`);
    await step('gate');
    await page.fill('#sgName', 'x'); await page.click('#sgGo');
    check(await page.evaluate(() => !!sgHint.textContent && sgName.getAttribute('aria-invalid') === 'true'), `${name}: a name too short is refused, and says why`);
    await page.fill('#sgName', 'lickii tester'); await page.fill('#sgPass', 'secret12'); await page.fill('#sgPass2', 'secret21'); await page.click('#sgGo');
    check(await page.evaluate(() => /aren't the same/.test(sgHint.textContent)), `${name}: two passwords not the same are refused`);
    await page.fill('#sgPass2', 'secret12'); await page.click('#sgGo');
    // the character select: none yet, the new one's name offered (the account's); its story begins
    await page.waitForSelector('#sgChars:not([hidden])', { timeout: 10000 });
    check(await page.evaluate(() => sgCharList.hidden && !sgNoChars.hidden && !sgNewForm.hidden && sgNewName.value === 'Lickii tester' && sgAccountName.textContent === 'Lickii tester'),
      `${name}: then the character select: no characters yet, a new one named`);
    await step('characters');
    await page.click('#sgNewGo');
    await page.waitForSelector('#sortiaIntro:not([hidden])', { timeout: 30000 });
    check(await page.evaluate(() => { const a = JSON.parse(localStorage.getItem('tilequest.account')); return a.name === 'Lickii tester' && a.characters.join() === 'Lickii tester' && !/secret12/.test(localStorage.getItem('tilequest.account')); }),
      `${name}: the account is kept, with its character, its password only as a hash`);

    // the opening: four story cards, each its own picture; Continue and back, a sideways swipe and the arrow keys go
    // through them; nothing past the sides, the way on in sight (a short screen may scroll up and down to it)
    const W = device.viewport.width, H = device.viewport.height;
    // (the words change once the camera has landed)
    const title = async () => { await page.waitForFunction(() => !sortiaIntro.classList.contains('moving'), null, { timeout: 5000 }).catch(() => {}); return page.evaluate(() => siTitle.textContent); };
    const shown = () => page.evaluate(() => ({ art: siTitle.textContent, x: Math.round(parseFloat(document.querySelector('.si-world').style.getPropertyValue('--si-x'))),
      pano: (() => { const imgs = [...document.querySelectorAll('.si-layer img')]; return imgs.length === 14 && imgs.every(i => i.complete && i.naturalWidth > 0); })(),
      sides: document.documentElement.scrollWidth <= innerWidth && sortiaIntro.scrollWidth <= sortiaIntro.clientWidth,
      way: (() => { const b = [...sortiaIntro.querySelectorAll('.si-fwd')].find(e => e.offsetParent); const r = b.getBoundingClientRect(); return r.height >= 44 && r.right <= innerWidth + 0.5; })() }));
    const seen = [], xs = [];
    await page.waitForFunction(() => [...document.querySelectorAll('.si-layer img')].every(i => i.complete), null, { timeout: 15000 }).catch(() => {});
    for (let i = 0; i < CARDS.length; i++) {
      const g = await shown(); seen.push(g.art); xs.push(g.x);
      check(g.pano, `${name}: card ${i + 1}: the panorama's 14 layers behind it`);
      check(g.sides && g.way, `${name}: card ${i + 1}: nothing past the sides, the way on 44px (${JSON.stringify(g)})`);
      await step(`story${i + 1}`);
      if (i < CARDS.length - 1) { await page.click('#siNext'); await page.waitForFunction(t => siTitle.textContent !== t && !sortiaIntro.classList.contains('moving'), seen[i], { timeout: 5000 }).catch(() => {}); }
    }
    check(seen.join() === CARDS.join(), `${name}: the four cards in order (${seen})`);
    check(xs.every((v, i) => i === 0 || v > xs[i - 1]), `${name}: the camera moves along the panorama, left to right (${xs})`);
    await page.click('#siBack'); check(await title() === 'The Last Crossing', `${name}: back goes back`);
    await page.keyboard.press('ArrowRight'); check(await title() === 'The False Signal', `${name}: the arrow key goes on`);
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); check(await title() === 'The Hollow Host', `${name}: and back`);
    await page.click('#siSkip'); await title();
    check(await page.evaluate(() => siTitle.textContent === 'Sister Ama' && siForm.hidden), `${name}: Skip intro: Sister Ama, who knows your name from the account`);
    await step('ama1');
    check(await page.evaluate(() => /^“Lickii tester, the guards/.test(siCopy.textContent)), `${name}: Sister Ama talks, your name in her words`);
    await page.click('#siNext'); check(await page.evaluate(() => /a goblin was holding the lantern/.test(siCopy.textContent)), `${name}: the second line`);
    await page.click('#siNext'); check(await page.evaluate(() => /three kinds of defenders/.test(siCopy.textContent) && siNextLabel.textContent === 'Choose Your Path'), `${name}: the third, and Choose Your Path`);
    await step('ama');
    await page.click('#siNext');
    await page.waitForTimeout(600);

    // (no appearance while the character is made: straight on to the path)
    check(await page.evaluate(() => outfit.hidden), `${name}: no outfit while the character is made`);

    // your path: one at a time, chosen only once confirmed
    const looked = () => page.evaluate(() => document.querySelector('.vs-card[aria-pressed=true]').dataset.v);
    const scene = () => page.evaluate(() => { const el = document.getElementById('templeScene'); return el.hidden ? '' : el.dataset.scene; });
    check(await scene() === 'paths' && await page.evaluate(() => !pathPick.hidden && document.querySelectorAll('.vs-card').length === 3 && document.querySelectorAll('.vs-card[aria-pressed=true]').length === 1
      && [...document.querySelectorAll('.vs-name')].map(n => n.textContent).join() === 'Hawk,Bastion,Ember'), `${name}: the vocation screen: Hawk, Bastion, Ember, one looked at`);
    await page.waitForFunction(() => [...document.querySelectorAll('.vs-hero-img, .vs-face img')].every(i => i.complete && i.naturalWidth > 0), null, { timeout: 10000 }).catch(() => {});
    check(await page.evaluate(() => [...document.querySelectorAll('.vs-hero-img, .vs-face img')].every(i => i.complete && i.naturalWidth > 0)), `${name}: the paths' pictures and emblems there`);
    // looking: a card, the arrow keys; the picture and the words follow; nothing chosen
    await page.click('.vs-card[data-v=paladin]');
    check(await looked() === 'paladin' && await page.evaluate(() => document.querySelector('.vs-art.on').dataset.v === 'paladin' && /archer/i.test(pathInfo.textContent) && player.vocation === 'none'),
      `${name}: a card shows its path: its picture and words; looking chooses nothing`);
    await page.keyboard.press('ArrowRight'); check(await looked() === 'knight', `${name}: the arrow key: the card on the right`);
    check(await page.evaluate(() => pathChoose.textContent.startsWith('Choose Bastion')), `${name}: the button names the path looked at`);
    // (each path's light: once each time they're looked at, the layers taking no taps; none with reduced motion)
    for (const v of ['knight', 'paladin', 'sorcerer']) {
      await page.click(`.vs-card[data-v=${v}]`);
      await page.waitForFunction(v => { const s = document.querySelector(`.vs-layered[data-v=${v}]`); return s.classList.contains('play') || matchMedia('(prefers-reduced-motion: reduce)').matches; }, v, { timeout: 8000 }).catch(() => {});
      check(await page.evaluate(v => { const s = document.querySelector(`.vs-layered[data-v=${v}]`), r = s.querySelector('.vs-figure').getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height * 0.3);
        return s.classList.contains('on') && !s.contains(hit) && (s.classList.contains('play') || matchMedia('(prefers-reduced-motion: reduce)').matches)
          && document.querySelectorAll('.vs-layered.on').length === 1; }, v), `${name}: ${({ knight: 'Bastion', paladin: 'Hawk', sorcerer: 'Ember' })[v]} in layers, the light playing, nothing in it taking a tap`);
    }
    await page.click('.vs-card[data-v=knight]');
    await page.keyboard.press('ArrowLeft'); check(await looked() === 'paladin', `${name}: and back`);
    // (nothing moves when you look at another: the cards and the button stay put; every card the same size, 44px and more to tap;
    // the words in the owner's study's size; nothing past the screen's sides; the whole screen fits from 375 x 667 up)
    const held = [];
    for (const v of ['paladin', 'knight', 'sorcerer']) {
      await page.click(`.vs-card[data-v=${v}]`); await page.waitForTimeout(400);
      held.push(await page.evaluate(() => {
        const R = e => e.getBoundingClientRect(), cards = [...document.querySelectorAll('.vs-card')].map(R), btn = R(pathChoose);
        const words = [...pathInfo.querySelectorAll('p, li')].map(R), bottom = Math.max(...words.map(r => r.bottom));
        const on = [...document.querySelectorAll('.vs-card')].findIndex(c => c.getAttribute('aria-pressed') === 'true'), rest = cards.filter((r, i) => i !== on);
        return { at: `${Math.round(R(document.querySelector('.vs-cards')).bottom)},${Math.round(btn.top)}`, same: on >= 0 && cards.every(r => Math.abs(r.width - cards[0].width) < 0.5 && Math.abs(r.height - cards[0].height) < 0.5 && r.height >= 44),
          btn: btn.height >= 44, clear: bottom <= R(document.querySelector('.vs-note')).top, text: parseFloat(getComputedStyle(pathIntro).fontSize) >= 11,
          sides: document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.vs-card, #pathChoose, .vs-title')].every(e => R(e).left >= 0 && R(e).right <= innerWidth) };
      }));
    }
    check(held.every(g => g.at === held[0].at), `${name}: the cards and the button stay put (${held.map(g => g.at).join(' | ')})`);
    check(held.every(g => g.same && g.btn && g.clear && g.text && g.sides), `${name}: the cards alike, the button big enough, nothing overlapping or past the sides (${JSON.stringify(held[0])})`);
    // (it never scrolls, on any screen: it fits, the button in sight)
    check(await page.evaluate(() => getComputedStyle(pathPick).overflowY === 'hidden' && document.querySelector('.vs-screen').offsetHeight <= pathPick.clientHeight + 1
      && pathChoose.getBoundingClientRect().bottom <= innerHeight), `${name}: the vocation screen fits, and can't scroll`);
    // (Go back and Escape: the question gone, the focus back on the button, the same card looked at, nothing chosen)
    await page.click('.vs-card[data-v=paladin]'); await page.click('#pathChoose');
    check(await page.evaluate(() => !pathAsk.hidden && /Choose Hawk\?/.test(pathAsk.textContent) && document.activeElement && document.activeElement.closest('#pathAsk')), `${name}: Choose Hawk asks first`);
    await page.evaluate(() => [...pathAsk.querySelectorAll('button')].find(b => b.textContent === 'Go back').click());
    check(await page.evaluate(() => pathAsk.hidden && document.activeElement === pathChoose && player.vocation === 'none' && document.querySelector('.vs-card[aria-pressed=true]').dataset.v === 'paladin'), `${name}: Go back: the focus on the button, Hawk still looked at`);
    await page.click('#pathChoose'); await page.keyboard.press('Escape');
    check(await page.evaluate(() => pathAsk.hidden && document.activeElement === pathChoose && player.vocation === 'none'), `${name}: Escape: the same`);
    check(await page.evaluate(() => pathBack.hidden), `${name}: no Back from the paths (the name is given)`);
    await page.click('.vs-card[data-v=sorcerer]');
    await step('path');
    await page.click('#pathChoose');
    check(await page.evaluate(() => player.vocation === 'none' && !pathAsk.hidden && /Choose Ember\?/.test(pathAsk.textContent) && /Confirm Ember/.test(pathAsk.textContent) && /change this character/.test(pathAsk.textContent)), `${name}: not chosen before it's confirmed, the path named`);
    await page.evaluate(() => { const yes = pathAsk.querySelector('.vs-btn'); yes.click(); yes.click(); });
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
    // (its first step only explains, and passes by itself once it's had time to be read: on a slow machine it may have)
    check(game.tutorial >= 1 && game.tutorial <= 2 && game.quests === 0 && game.guide, `${name}: the guide at its start, no quest begun twice (${game.tutorial}, ${game.quests})`);
    check(game.amas === 1 && Math.abs(game.at[0] - game.start[0]) <= 2 && Math.abs(game.at[1] - game.start[1]) <= 2 && game.at[2] === game.start[2], `${name}: in the temple where every character wakes, Sister Ama once`);
    await step('game');

    // a reload: the same character, no welcome again
    await page.evaluate(() => saveGame());
    await page.reload();
    await page.waitForFunction(() => typeof player !== 'undefined' && player && player.name !== 'Adventurer', null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const again = await page.evaluate(() => ({ story: !sortiaIntro.hidden, welcome: document.body.classList.contains('welcome'), name: player.name, vocation: player.vocation, outfit: JSON.stringify(player.outfit) }));
    check(!again.story && !again.welcome && again.name === 'Lickii tester' && again.vocation === 'sorcerer' && again.outfit === want, `${name}: after a reload, the same character, no welcome`);
    check(await page.evaluate(() => sortiaGate.hidden), `${name}: logged in already: no gate after the loading`);

    check(!missing.length, `${name}: every picture there (${missing})`);
    check(!errors.length, `${name}: no errors on the page (${errors})`);
    console.log(`  ok   ${name}`);
    await context.close();
  }
  await browser.close();
  console.log(failed ? `${failed} of ${passed + failed} failed` : `all ${passed} passed`);
  process.exit(failed ? 1 : 0);
})();
