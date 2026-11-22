'use strict';
// The HTML side of the game: status, equipment, bags, loot, trade, battle list,
// skills and quests, spell bar, hotkeys, outfit, world map, message log, minimap,
// and dragging items around. Player actions always go through Actions.

// The version that's live (the ?v= of the page's own scripts, bumped with every update): shown on the loading screen
// and in the settings, so you can tell whether an update has reached you.
const GAME_VERSION = (((document.querySelector('script[src*="?v="]') || {}).src || '').match(/[?&]v=([^&]+)/) || [])[1] || 'dev';
const versionText = () => `Version ${GAME_VERSION.replace(/^ui/, '')}`;
const showVersion = () => { for (const id of ['versionLoading', 'versionMenu', 'versionCreate']) { const el = document.getElementById(id); if (el) el.textContent = versionText(); } };
showVersion(); document.addEventListener('DOMContentLoaded', showVersion); // (the loading screen comes after the scripts in the page)

// A touch screen (a phone or tablet, or anywhere with ?mobile in the address): touch.js shows its controls.
const touchScreen = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('mobile');
// what the chat line says while empty: shorter on a phone, where there's no Enter key to press
const CHAT_HINT = touchScreen ? 'Say something, e.g. "hi"' : 'Press Enter to talk, e.g. "hi" - or say spell words like "lumen"';

const $ = id => document.getElementById(id);
let uiNeedsRender = true;
function uiDirty() { uiNeedsRender = true; }

// ---- message log -----------------------------------------------------------------------
function addLogLine(build, kind) {
  const el = $('log');
  const line = document.createElement('div');
  line.className = kind || 'server';
  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = new Date().toTimeString().slice(0, 5) + ' ';
  line.appendChild(time);
  build(line);
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
  el.appendChild(line);
  while (el.childElementCount > 200) el.firstElementChild.remove();
  if (atBottom) el.scrollTop = el.scrollHeight;
}

function log(text, kind) {
  addLogLine(line => line.append(text), kind);
  if (kind === 'look') showLook(text);
  else if (typeof toast === 'function' && kind !== 'xp') toast(text, kind);
}

// What you look at also shows over the game itself, near the top, for a while.
let lookTimer = null;
function showLook(text) {
  const el = $('lookText'), view = $('view');
  el.textContent = text;
  el.hidden = false;
  el.classList.remove('fade');
  el.style.top = `${view.offsetTop + Math.max(touchScreen ? 96 : 14, view.offsetHeight * 0.06)}px`;
  clearTimeout(lookTimer);
  lookTimer = setTimeout(() => {
    el.classList.add('fade');
    lookTimer = setTimeout(() => { el.hidden = true; }, 600);
  }, 2500 + text.length * 50);
}

// Dialog lines: {keyword} becomes a link that says the keyword when clicked.
function logDialog(speaker, text, isPlayer) {
  // On a phone what an NPC says to you comes up as a card, its keywords as buttons (the chat keeps it too).
  // (with the chat open it stays in the chat, as you type your answers there)
  if (!isPlayer && touchScreen && typeof showTalk === 'function' && !document.body.classList.contains('chat-open')) showTalk(speaker, text);
  else if (!isPlayer) document.body.classList.add('chat-open');
  addLogLine(line => {
    const who = document.createElement('b');
    who.textContent = `${speaker}: `;
    line.appendChild(who);
    for (const part of String(text).split(/(\{[^}]+\})/)) {
      const m = /^\{(.+)\}$/.exec(part);
      if (!m) {
        line.append(part);
        continue;
      }
      const kw = document.createElement('a');
      kw.className = 'kw';
      kw.textContent = m[1];
      kw.addEventListener('click', () => Actions.say(m[1]));
      line.appendChild(kw);
    }
  }, isPlayer ? 'say' : 'npc');
}

// ---- status (updated a few times per second) --------------------------------------------
// Writing to the page makes the browser work the page's look out again, even when nothing changed: these write only
// when the value is new (the bars and texts are kept up to date several times a second)
function setText(el, text) { if (el && el.textContent !== String(text)) el.textContent = text; }
function setHTML(el, html) { if (el && el.__html !== html) { el.__html = html; el.innerHTML = html; } }
function setWidth(el, width) { if (el && el.__width !== width) { el.__width = width; el.style.width = width; } } // (not style.width: the browser
// reads a width back in its own words, 33.3333% for 33.333333333333336%, so it would never match and be written each time)

function setBar(id, value, max, text) {
  setWidth($(`${id}Fill`), `${Math.max(0, Math.min(100, (100 * value) / max))}%`);
  setText($(`${id}Text`), text);
}

// "27s", "2:05" or "3h 59m" for what's left of a timer.
function timeLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
}

const SKULL_COLORS = { white: '#f4f4f4', yellow: '#f0d020', red: '#e02020' };
const skullIcon = color => `<svg class="skull-icon" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="${SKULL_COLORS[color]}" stroke="#000"/>`
  + '<circle cx="5.5" cy="7.5" r="1.7"/><circle cx="10.5" cy="7.5" r="1.7"/><rect x="6.5" y="11" width="3" height="1.6"/></svg>';

// What you cast or ate on yourself (haste, magic shield, torchlight, fed): on a phone their time shows on the action
// button that gave it (action-slots.js), not up top
const OWN_CONDITIONS = new Set(['haste', 'shield']);
// Icons for your conditions, with how long the timed ones last (haste, magic shield, skull...). harmOnly: only what
// happens to you (poison, fire, energy, paralysis) and skulls and fights, for the phone's top of the view
function statusIcons(harmOnly = false) {
  const icon = (sign, title, until) => `<span class="status" title="${title}">${sign}${until ? `<small>${timeLeft(until - now)}</small>` : ''}</span>`;
  const icons = Object.entries(player.conditions).filter(([k]) => !(harmOnly && OWN_CONDITIONS.has(k)))
    .map(([k, c]) => icon(CONDITIONS[k].icon, CONDITIONS[k].name, c.until));
  if (!harmOnly && now < player.fedUntil) icons.push(icon('🍖', 'fed', 0));
  if (!harmOnly && now < player.lightUntil) icons.push(icon('💡', 'torchlight', player.lightUntil));
  if (!harmOnly && player.blessed) icons.push(icon('✝', 'blessed', 0));
  if (player.redSkullUntil > now) icons.push(icon(skullIcon('red'), 'red skull: you lose everything you carry when you die', player.redSkullUntil));
  else if (player.skullUntil > now) icons.push(icon(skullIcon('white'), 'white skull: no temples until it fades', player.skullUntil));
  if (player.pzLockUntil > now && !(player.skullUntil > now)) icons.push(icon('⚔', 'in a fight with a player: no temples', player.pzLockUntil));
  return icons.join(' ');
}

function updateBars() {
  setBar('hp', player.hp, player.maxHp, `${player.hp} / ${player.maxHp} HP`);
  setBar('mana', player.mana, player.maxMana, `${player.mana} / ${player.maxMana} mana`);
  const lo = xpForLevel(player.level), hi = xpForLevel(player.level + 1);
  setBar('xp', player.xp - lo, hi - lo, `${player.xp} / ${hi} XP`);
  setText($('charLine'), `${player.name} · level ${player.level} ${title(player)}`);
  const status = statusIcons();
  setHTML($('conditions'), status);
  setHTML($('tbStatus'), touchScreen ? statusIcons(true) : status);
  const m = Math.floor(worldMinutes()), clock = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  setText($('pos'), `${player.x}, ${player.y} · floor ${map.floorLabel(player.z)} · ${clock} · cap ${freeCapacity()} oz`);
  renderBattle();
  renderAutoHeal();
  renderParty();
  renderGuide();
  if (!$('guild').hidden) renderGuild();
  if (!$('forge').hidden) renderForge();
}

// ---- the guide for new adventurers (see game-guide.js) ---------------------------------------
// The task you're on, of the quests this guide step is about: what to do, how far you are, and where to go then.
function guideNow(step) {
  const ids = ((step && step.target) || []).flatMap(t => [t.quest, ...(t.hunt || [])]).filter(Boolean);
  const id = ids.find(q => QUESTS[q] && questState(q) === 'active');
  if (!id) return '';
  const s = questStep(id), progress = questProgress(id), who = s.npc || QUESTS[id].giver, word = questWord(who, id);
  const summary = s.summary || QUESTS[id].summary;
  const then = s.auto || summary.includes(NPCS[who].name) ? '' : stepReady(id) ? ` Now go to ${NPCS[who].name}${word ? ` and say "${word}"` : ''}.` : ''; // (not twice)
  return `Now: ${summary}${progress ? ` (${progress})` : ''}${then}`;
}
let guideKey = '', guideFolded = false;
try { guideFolded = localStorage.getItem('tilequest.guideFolded') === '1'; } catch (e) { /* no storage: start unfolded */ }
// The guide's step as it reads now: { step, text, now } (also shown at the top of the Quests tab)
function guideState() {
  const step = player.tutorial ? GUIDE[player.tutorial - 1] : null;
  // $progress: how far the task you're on has come: the step's own hunt (done too: 5/5), else the first active quest still
  // asking you to kill something
  const own = ((step && step.target) || []).flatMap(t => t.hunt || []).find(id => QUESTS[id] && questState(id) === 'active' && questStep(id).kill);
  const hunting = own || Object.keys(player.quests).find(id => QUESTS[id] && player.quests[id].status === 'active' && questStep(id).kill && !stepReady(id));
  // (no hunt on: none counted yet, or none asked for yet: never "done" before it is)
  const progress = hunting ? questProgress(hunting) : (step && step.done && step.done()) ? 'done' : 'not started yet: talk to whoever asked first';
  let text = step ? ((touchScreen && step.touch) || step.text).replace('$progress', progress).replace('$trained', `${Math.min(5, player.trainHits || 0)}/5`).replace('$paths', `${typeof pathStamps === 'function' ? pathStamps() : 0}/4`).replace('$loaded', `${((player.quests.last_town || {}).loaded || []).length}/4`).replace('$hits', `${Math.min(10, (player.quests.recruit || {}).hits || 0)}/10`).replace('$name', player.name) : ''; // ($trained: hits on a dummy; $loaded: cannons; $hits: The Recruit's)
  // a step for a higher level: say so, and what to do till then
  if (step && step.minLevel && player.level < step.minLevel) {
    text = `Next in the story: level ${step.minLevel} (you are level ${player.level}). Until then, grow stronger: ask any gate guard for a hunt (they pay in watch marks), and come back. The arrow points to the nearest gate.`;
    return { step, text, now: '' };
  }
  // (the "Now:" line only where it adds something: not on the basics, which say it all)
  const now = GUIDE.indexOf(step) + 1 < GUIDE_BASICS ? '' : guideNow(step);
  return { step, text, now };
}
// "step / steps" for the guide, counting only the steps this device shows (a computer skips the phone's own)
function guideCount() {
  const shown = GUIDE.map((st, i) => i).filter(i => touchScreen || !GUIDE[i].touchOnly);
  return { at: shown.filter(i => i < player.tutorial).length || 1, of: shown.length };
}

function renderGuide() {
  const { step, text, now } = guideState();
  const key = `${player.tutorial}|${text}|${now}|${guideFolded}`;
  if (key === guideKey) return;
  const before = +guideKey.split('|')[0];
  if (step && before && before !== player.tutorial) Sound.play('coin'); // a step done
  guideKey = key;
  const box = $('guide'), view = $('view');
  box.hidden = !step;
  // (the part of the screen this step is about is lit, with a ring round it: GuideSpot, below)
  if (!step) return;
  box.classList.toggle('folded', guideFolded);
  // a step with a task: short on a phone (its first lines and how far you are); one that only explains: in full
  box.classList.toggle('task', !!(step.done || step.on));
  if (before !== player.tutorial) box.classList.remove('open');
  $('guideFold').textContent = guideFolded ? '▸' : '▾';
  // top left over the game; on a phone just under the health bars, in the margin if there is one
  box.style.left = `${touchScreen ? 4 : view.offsetLeft + 8}px`;
  box.style.top = `${touchScreen ? 44 : Math.max(view.getBoundingClientRect().top, 0) + 8}px`; // (never above the window)
  { const n = guideCount(); $('guideStep').textContent = `${n.at} / ${n.of}`; }
  // (a short card on a phone: how far you are stays in sight on a line of its own, not cut off at the end of the text)
  const prog = touchScreen && (step.done || step.on) ? /\s*\(([^()]*\d[^()]*)\)\.?\s*$/.exec(text) : null;
  $('guideText').textContent = prog ? text.slice(0, prog.index) + '.' : text;
  $('guideProg').textContent = prog ? prog[1] : '';
  $('guideProg').hidden = !prog;
  $('guideNow').textContent = now;
  $('guideNow').hidden = !now;
  $('guideDone').hidden = !!(step.done || step.on || step.client);
  $('guideDone').textContent = player.tutorial === GUIDE.length ? 'Got it' : 'Next'; // (a step that only explains: on to the next)
  // a thin bar: how far through the guide you are
  $('guideBar').style.setProperty('--done', `${((guideCount().at - 1) / guideCount().of) * 100}%`);
  // its little picture
  const art = $('guideArt');
  art.replaceChildren(...(step.art && GUIDE_ART[step.art] && !(touchScreen && (step.done || step.on)) ? GUIDE_ART[step.art]() : []));
  art.hidden = !art.childNodes.length;
  // a step done: a moment of praise on the box
  if (before && before < player.tutorial) {
    box.classList.remove('cheer'); void box.offsetWidth; box.classList.add('cheer');
    clearTimeout(renderGuide.cheer); renderGuide.cheer = setTimeout(() => box.classList.remove('cheer'), 1800);
  }
}

// Clang as he walks the map, for the guide's picture (the cat's own sprite, not a symbol)
function petPicture(size = 34) {
  const c = document.createElement('canvas'); c.width = c.height = size; c.className = 'ga-pic';
  try {
    const img = Sprites.creature(Sprites.petKey(PETS.cat.look, (player.pet && player.pet.level) || 1), 2, 0), r = img.res || 1, w = Sprites.w(img);
    const g = c.getContext('2d'); g.imageSmoothingEnabled = r > 1;
    g.drawImage(img, 0, 0, w * r, w * r, 0, 0, size, size);
  } catch (e) { /* no picture yet: an empty frame */ }
  return c;
}

// ---- the guide's pictures: what its words are about, drawn small in its box ---------------------------------------
const GUIDE_ART = (() => {
  const chip = (cls, ...kids) => h('span', { className: `ga-chip ${cls || ''}` }, ...kids);
  const pic = (id, size = 34) => Object.assign(new Image(size, size), { src: Sprites.itemURL(id), className: 'ga-pic', alt: '' });
  const icon = (name, size = 18) => (typeof Icons !== 'undefined' ? Icons.img(name, size) : h('span', {}, ''));
  const row = (...kids) => h('div', { className: 'ga-row' }, ...kids);
  const cap = (pictureEl, text) => h('div', { className: 'ga-cap' }, pictureEl, h('small', {}, text));
  const bar = (cls, label) => h('div', { className: `ga-bar ${cls}` }, h('i'), h('small', {}, label));
  return {
    welcome: () => [row(cap(h('span', { className: 'ga-step do' }, '✓'), 'do it: on by itself'), cap(h('span', { className: 'ga-step' }, 'Next'), 'read it: tap Next'))],
    bars: () => [bar('hp', 'health: 0 = you die'), bar('mp', 'mana: for spells'), bar('xp', 'experience: full = level up')],
    words: () => [row(h('span', { className: 'ga-word' }, 'happened'), h('span', { className: 'ga-arrow' }, '→'), h('span', { className: 'ga-word' }, 'yes'),
      h('small', { className: 'ga-note' }, touchScreen ? 'tap the gold words' : 'click or type the gold words'))],
    lost: () => [row(cap(h('span', { className: 'ga-yellow' }, '➤'), 'the arrow: where to go'), cap(icon('quests', 22), 'Quests: what to do'))],
    train: () => [row(cap(pic('wooden_club'), 'hit the dummy'), h('span', { className: 'ga-arrow' }, '→'), cap(h('b', { className: 'ga-big' }, '+skill'), 'harder hits'))],
    smart: () => [row(...(touchScreen
      ? [['attack', 'attack'], ['talk', 'talk'], ['loot', 'loot'], ['use', 'use']].map(([kind, label]) => cap(h('span', { className: `ga-smart ${kind}` }, icon(kind, 20)), label))
      : [cap(h('kbd', {}, 'Space'), 'attack the nearest'), cap(h('kbd', {}, 'click'), 'a monster: attack'), cap(h('kbd', {}, 'click'), 'a person: talk')]))],
    gear: () => [row(cap(pic('leather_cap'), 'a leather cap'), h('span', { className: 'ga-arrow' }, '→'),
      cap(h('span', { className: 'ga-slots' }, icon('slot-head', 18)), touchScreen ? 'tap, then Wear' : 'drag it on'))],
    torch: () => [row(cap(h('span', { className: 'ga-step do' }, 'Lv 2'), 'a new spell'), h('span', { className: 'ga-arrow' }, '→'),
      cap(Object.assign(new Image(34, 34), { src: ActionSlots.art('light') || '', className: 'ga-pic', alt: '' }), touchScreen ? 'put it on a +' : '1 or "lumen"'),
      h('span', { className: 'ga-arrow' }, '→'), cap(h('span', { className: 'ga-yellow' }, '✺'), 'light in the dark'))],
    clang: () => [row(cap(petPicture(), 'Clang'), h('span', { className: 'ga-arrow' }, '→'),
      cap(h('span', { className: 'ga-step do' }, 'fights'), 'at your side'), cap(h('span', { className: 'ga-step' }, 'grows'), 'as you hunt and train'))],
    sewer: () => [row(cap(h('span', { className: 'ga-yellow' }, '▦'), 'the grate'), h('span', { className: 'ga-arrow' }, '→'),
      cap(h('b', { className: 'ga-big' }, '5×'), 'rats'), h('span', { className: 'ga-arrow' }, '→'), cap(pic('wooden_shield'), 'your shield'))],
    death: () => [row(cap(h('span', { className: 'ga-good' }, '✓'), 'you keep your things'), cap(h('span', { className: 'ga-bad' }, '−'), 'a little experience'),
      cap(icon('heart', 20), 'temple, depot, shops: safe'))],
    rats: () => [row(cap(h('span', { className: 'ga-good' }, '✓'), 'rats: easy'), cap(h('span', { className: 'ga-bad' }, '!'), 'wolf packs: not yet'))],
    loot: () => [row(cap(touchScreen ? h('span', { className: 'ga-smart loot' }, icon('loot', 20)) : h('kbd', {}, 'right-click'), 'open the corpse'),
      h('span', { className: 'ga-arrow' }, '→'), cap(h('span', { className: 'ga-step' }, 'Take all'), 'everything in it'))],
    eat: () => [row(cap(pic('apple'), touchScreen ? 'tap it, then Use' : 'right-click it'), h('span', { className: 'ga-arrow' }, '→'), cap(icon('food', 20), 'fed: you heal faster'))],
    actions: () => [row(cap(pic('health_potion'), touchScreen ? 'tap: use' : 'H: health'), cap(pic('mana_potion'), touchScreen ? 'hold: choose' : 'M: mana'),
      cap(h('span', { className: 'ga-step' }, touchScreen ? '⇆' : '1-9'), touchScreen ? 'swipe: more' : 'spells'))],
    eatslot: () => [row(cap(h('span', { className: 'ga-slot-empty' }, icon('plus', 18)), 'tap the empty +'), h('span', { className: 'ga-arrow' }, '→'),
      cap(pic('meat'), 'choose Eat'), h('span', { className: 'ga-arrow' }, '→'), cap(icon('food', 20), 'one tap: eat'))],
    questmap: () => [row(cap(h('span', { className: 'ga-map-dot' }, icon('map', 22)), 'a dot: new'),
      h('span', { className: 'ga-arrow' }, '→'), cap(h('span', { className: 'ga-yellow' }, '◯'), 'roughly where'))],
    map: () => [row(cap(icon('map', 22), touchScreen ? 'the map button' : 'the minimap'), h('span', { className: 'ga-arrow' }, '→'), cap(h('span', { className: 'ga-yellow' }, '◎'), 'tap a spot: walk there'))],
  };
})();

// ---- the guide's spotlight: the rest of the screen dims, the part a step is about stays lit, a hand points at it ----
// (a see-through layer over everything that takes no taps: the lit part and the guide's own box are holes in it)
const GuideSpot = (() => {
  let layer = null, hand = null, path = null, ring = null;
  const make = () => {
    layer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    layer.id = 'guideSpot'; layer.setAttribute('aria-hidden', 'true');
    path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill-rule', 'evenodd');
    ring = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    ring.setAttribute('class', 'ring');
    layer.append(path, ring);
    hand = document.createElement('div'); hand.id = 'guideHand'; hand.setAttribute('aria-hidden', 'true');
    hand.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V10m0-.5V3a1.5 1.5 0 0 1 3 0v7m0-1a1.5 1.5 0 0 1 3 0v4.5c0 4-2.5 7.5-6.5 7.5-2.4 0-4-1-5.3-2.8L3.5 15a1.6 1.6 0 0 1 2.5-2L9 15.5V11"/></svg>';
    document.body.append(layer, hand);
  };
  const visible = el => { if (!el || el.hidden) return false; const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.top < innerHeight; };
  // a rounded hole round a rect, pad wider, kept inside the screen (a button at its edge is lit, ring and all, not cut off)
  const hole = (r, pad, rad) => {
    const x = Math.max(3, r.left - pad), y = Math.max(3, r.top - pad), w = Math.min(innerWidth - 3, r.right + pad) - x, hh = Math.min(innerHeight - 3, r.bottom + pad) - y;
    const k = Math.max(0, Math.min(rad, w / 2, hh / 2));
    return `M${x + k} ${y}H${x + w - k}A${k} ${k} 0 0 1 ${x + w} ${y + k}V${y + hh - k}A${k} ${k} 0 0 1 ${x + w - k} ${y + hh}H${x + k}A${k} ${k} 0 0 1 ${x} ${y + hh - k}V${y + k}A${k} ${k} 0 0 1 ${x + k} ${y}Z`; };
  // (a part under an open window, say the backpack's tabs under a conversation, isn't lit: the hand would point at the window)
  const covered = el => { const r = el.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!top && !el.contains(top) && !top.contains(el) && !top.closest('#guide'); };
  // (what a step lights stops being lit once you've tapped it: the step's own task is somewhere else, the Quests tab was a tip)
  const spotTapped = { step: 0, sels: new Set() };
  document.addEventListener('click', e => {
    const step = player && player.tutorial ? GUIDE[player.tutorial - 1] : null;
    if (!step) return;
    if (spotTapped.step !== player.tutorial) { spotTapped.step = player.tutorial; spotTapped.sels = new Set(); }
    for (const sel of (touchScreen ? step.ui : step.uiDesk) || []) if (e.target.closest && e.target.closest(sel)) spotTapped.sels.add(sel);
  }, true);
  let passed = 0, looked = 0, scrolled = 0; // (the step this browser last moved the guide on from: once, not every frame while the server answers)
  function frame() {
    requestAnimationFrame(frame);
    // steps only the browser can see done: on a computer a phone's step passes at once; Eat put on an action button
    const cur = player && player.tutorial ? GUIDE[player.tutorial - 1] : null;
    if (cur && passed !== player.tutorial && cur.client === 'look' && looked !== player.tutorial) { looked = player.tutorial; guideLooked = false; } // (a look before the step doesn't count)
    if (cur && passed !== player.tutorial && ((cur.touchOnly && !touchScreen) || (cur.client === 'eatSlot' && typeof favourites === 'function' && favourites().includes('f')) || (cur.client === 'look' && guideLooked))) {
      passed = player.tutorial;
      Actions.guideNext();
    }
    const step = player && player.tutorial && !guideFolded ? GUIDE[player.tutorial - 1] : null;
    const list = step ? (touchScreen ? step.ui : step.uiDesk) || [] : [];
    let target = null;
    for (const sel of list) {
      // (a choice in the action buttons' chooser may be scrolled out of its list: scroll it into sight, once)
      const pick = sel.includes('#favPicker') && document.querySelector(sel);
      // (only its own list scrolls: scrolling the page would push the whole game up)
      if (pick && !pick.dataset.shown) {
        pick.dataset.shown = '1';
        let list = pick.parentElement;
        while (list && list.id !== 'favPicker' && !(list.scrollHeight > list.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(list).overflowY))) list = list.parentElement;
        if (list) { const lr = list.getBoundingClientRect(), pr = pick.getBoundingClientRect(); list.scrollTop += pr.top - lr.top - (lr.height - pr.height) / 2; }
        for (const el of [$('viewport'), document.scrollingElement]) if (el) el.scrollTop = 0;
      }
      if (spotTapped.step === player.tutorial && spotTapped.sels.has(sel)) { if (sel === list[0]) break; continue; } // (tapped already: done with)
      target = [...document.querySelectorAll(sel)].find(el => visible(el) && !covered(el)); if (target) break;
    }
    // on a computer what it's about may be down the side panel, below the window's edge: brought into sight, once a step
    if (target && !touchScreen && scrolled !== player.tutorial) {
      scrolled = player.tutorial;
      const r = target.getBoundingClientRect();
      if (r.bottom > innerHeight || r.top < 0) target.scrollIntoView({ block: 'center' });
    }
    // (the guide's box steps aside while a window is open, e.g. the chooser of an action button: then the light
    // follows into that window on its own. With the backpack all the way open it stays, short, over the backpack:
    // at the top, or just above the action bar when what it's about is up there)
    const box = $('guide');
    const full = !!step && document.body.classList.contains('drawer-full');
    box.classList.toggle('over-drawer', full);
    if (full) {
      const dock = $('actionDock'), low = !target || target.getBoundingClientRect().top > innerHeight * 0.4;
      const top = low ? ($('touch').querySelector('.hud') || dock).getBoundingClientRect().bottom + 8 : (dock ? dock.getBoundingClientRect().top : innerHeight) - box.offsetHeight - 8;
      box.style.setProperty('--guide-top', `${Math.round(top)}px`);
    }
    const boxShown = visible(box);
    if (touchScreen && typeof placeToasts === 'function' && $('toasts') && $('toasts').childElementCount) placeToasts(); // (below the guide's box)
    const on = !!target && (boxShown || !!target.closest('#favPicker')) && !document.body.classList.contains('panel-open');
    if (!layer) { if (!on) return; make(); }
    layer.classList.toggle('on', on);
    if (!on) { hand.classList.remove('on'); return; }
    // (a step that only explains dims more: there's nothing else to do; one with a task dims a little)
    layer.classList.toggle('soft', !!(step && (step.done || step.on)));
    const r = target.getBoundingClientRect();
    // (sized in the very pixels its holes are measured in: an iPhone's home-screen app has a 100vh that isn't the
    // window's height, and a layer of that height shifted every lit part down)
    const W = innerWidth, H = innerHeight;
    if (layer.dataset.size !== `${W}x${H}`) {
      layer.dataset.size = `${W}x${H}`;
      layer.style.width = `${W}px`; layer.style.height = `${H}px`;
      layer.setAttribute('width', W); layer.setAttribute('height', H);
      layer.setAttribute('viewBox', `0 0 ${W} ${H}`);
      layer.setAttribute('preserveAspectRatio', 'none');
    }
    path.setAttribute('d', `M0 0H${innerWidth}V${innerHeight}H0Z${hole(r, 6, 12)}${boxShown ? hole(box.getBoundingClientRect(), 0, 12) : ''}`);
    ring.setAttribute('d', hole(r, 6, 12));
    // the hand: pointing up at it from below, or down at it from above when it's low on the screen (not for something
    // as wide as the screen, like the status bar: the light round it says enough)
    const wide = r.width > innerWidth * 0.6, choice = wide && !!target.closest('#favPicker');
    hand.classList.toggle('on', !wide || choice);
    const below = r.bottom + 64 < innerHeight;
    hand.classList.toggle('down', !below && !choice);
    // (a wide choice in a list: the finger on its right end, not on the choice under it)
    hand.style.left = `${Math.round(choice ? r.right - 46 : Math.min(innerWidth - 44, Math.max(4, r.left + r.width / 2 - 20)))}px`;
    hand.style.top = `${Math.round(choice ? r.top + r.height * 0.4 : below ? r.bottom + 6 : r.top - 52)}px`;
  }
  requestAnimationFrame(frame);
  return {};
})();

// ---- party and guild ----------------------------------------------------------------------
// Online the server tells us how things stand; playing alone, we ask the game ourselves.
const myPartyView = () => (Net.online ? player.partyView : partyView(player));
const myGuildView = () => (Net.online ? player.guildView : guildView(player));
const markOf = c => (c.partyMark !== undefined ? c.partyMark : partyMark(c, player));
const guildOfCreature = c => (c.guildInfo !== undefined ? c.guildInfo : guildInfo(c));

// A little DOM helper: h('button', { onclick }, 'Join').
function h(tag, props, ...kids) {
  const el = Object.assign(document.createElement(tag), props || {});
  el.append(...kids.filter(k => k !== null && k !== undefined && k !== false));
  return el;
}

// ---- auto-heal: two sliders, a potion drunk for you below this much health / mana (Actions.setAutoHeal) -------------
// (the same controls in the Battle panel on a computer and in the Settings on a phone)
function autoHealControls() {
  const set = player.autoHeal || { hp: 0, mana: 0 }, box = h('div', { className: 'auto-heal' });
  const rows = [['hp', 'Health potion'], ['mana', 'Mana potion']];
  if (player.pet) rows.push(['pet', `${player.pet.name}: pet tonic or food`]); // (your companion, with its own tonics)
  for (const [kind, label] of rows) {
    const out = h('b', null), slider = h('input', { type: 'range', min: 0, max: AUTO_HEAL_MAX, step: 5, value: set[kind] || 0 });
    slider.setAttribute('aria-label', `${label}: by itself below this much ${kind === 'mana' ? 'mana' : 'health'}`);
    const show = () => { out.textContent = +slider.value ? `below ${slider.value}%` : 'off'; out.classList.toggle('on', +slider.value > 0); };
    slider.addEventListener('input', show);
    slider.addEventListener('change', () => Actions.setAutoHeal(kind, +slider.value));
    show();
    box.appendChild(h('label', { className: `auto-heal-row ${kind}` }, h('span', null, label, ' ', out), slider));
  }
  return box;
}
let autoHealKey = '';
function renderAutoHeal() {
  const box = $('autoHealBox');
  if (!box || touchScreen) return;
  const key = JSON.stringify(player.autoHeal || {}) + (player.pet ? player.pet.name : '');
  if (key === autoHealKey || box.contains(document.activeElement)) return; // (not while a slider is in your hand)
  autoHealKey = key;
  box.replaceChildren(h('div', { className: 'muted small' }, 'Auto-heal: drink a potion by itself'), autoHealControls());
}

let partyKey = '';
function renderParty() {
  const v = myPartyView() || null, key = JSON.stringify(v) + player.id;
  if (key === partyKey) return;
  partyKey = key;
  $('partyBox').hidden = !v;
  if (!v) return;
  const lead = v.leader === player.id, list = $('partyList');
  $('partyShare').hidden = !lead;
  $('partyShare').classList.toggle('on', !!v.shared);
  $('partyShare').textContent = v.shared ? 'Sharing XP' : 'Share XP';
  $('partyLeave').hidden = !v.members;
  $('partyStatus').textContent = v.members ? v.status : '';
  $('partyStatus').classList.toggle('on', !!v.active);
  list.replaceChildren();
  const bar = (value, max) => h('div', null, h('i', { style: `width:${Math.max(0, Math.min(100, (100 * value) / (max || 1)))}%` }));
  for (const m of v.members || []) {
    list.appendChild(h('div', { className: `party-row${m.dead ? ' dead' : ''}` },
      h('span', { className: 'party-icon', textContent: m.id === v.leader ? '👑' : '🛡', title: m.id === v.leader ? 'leader' : 'member' }),
      h('span', { className: 'who', textContent: `${m.name} · ${m.level} ${m.vocation === 'none' ? '' : vocName(m.vocation)}` }),
      h('span', { className: 'bars' }, bar(m.hp, m.maxHp), bar(m.mana, m.maxMana))));
  }
  for (const i of v.invited || []) {
    list.appendChild(h('div', { className: 'party-row' }, h('span', { className: 'who muted', textContent: `${i.name} (invited)` }),
      lead && h('button', { textContent: 'Revoke', onclick: () => Actions.partyRevoke(i.id) })));
  }
  for (const inv of v.invites || []) {
    list.appendChild(h('div', { className: 'party-row' }, h('span', { className: 'who', textContent: `${inv.name} invited you` }),
      h('button', { textContent: 'Join', onclick: () => Actions.partyJoin(inv.id) })));
  }
}

let guildKey = '';
function toggleGuild(open = $('guild').hidden) {
  $('guild').hidden = !open;
  guildKey = '';
  if (open) renderGuild();
}

// The guild window: found one or answer invitations; or your guild, its members and ranks.
function renderGuild() {
  const v = myGuildView() || { invites: [] }, key = JSON.stringify(v);
  const body = $('guildBody');
  if (key === guildKey || body.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
  guildKey = key;
  body.replaceChildren();
  const button = (text, fn, title) => h('button', { textContent: text, title: title || '', onclick: fn });
  const field = (placeholder, max) => h('input', { placeholder, maxLength: max, autocomplete: 'off' });
  if (!v.name) {
    $('guildTitle').textContent = 'Guild';
    body.appendChild(h('h3', null, 'Invitations'));
    if (!v.invites.length) body.appendChild(h('div', { className: 'muted small' }, 'Nobody has invited you to a guild yet.'));
    for (const g of v.invites) body.appendChild(h('div', { className: 'row' }, h('b', { style: 'flex:1' }, g), button('Join', () => Actions.guildJoin(g)), button('Decline', () => Actions.guildDecline(g))));
    body.appendChild(h('h3', null, 'Found a guild'));
    const name = field('The name of your guild', 29);
    body.appendChild(h('div', { className: 'row' }, name, button('Found', () => { Actions.guildCreate(name.value); name.value = ''; name.blur(); })));
    body.appendChild(h('div', { className: 'muted small' }, 'Anyone with a vocation can found a guild and lead it. Your guild has its own chat (the Guild tab), ranks, nicks and a message of the day.'));
    return;
  }
  $('guildTitle').textContent = v.name;
  const me = player.name.toLowerCase(), leader = v.myRank === 0, officer = v.myRank <= 1;
  if (v.motd) body.appendChild(h('div', { className: 'motd' }, v.motd));
  if (officer) {
    const motd = field('Message of the day', 200);
    motd.value = v.motd;
    body.appendChild(h('div', { className: 'row' }, motd, button('Set', () => { Actions.guildMotd(motd.value); motd.blur(); })));
  }
  const table = h('table', { className: 'guild-members' });
  for (const m of v.members) {
    const self = m.name.toLowerCase() === me, acts = h('td');
    if (officer || self) acts.appendChild(button('Nick', () => { const n = prompt(`Nick for ${m.name}:`, m.nick); if (n !== null) Actions.guildNick(m.name, n); }));
    if (leader && !self) {
      acts.appendChild(button(m.rank === 1 ? `▼` : `▲`, () => Actions.guildSetRank(m.name, m.rank === 1 ? 2 : 1), m.rank === 1 ? `Make ${v.ranks[2]}` : `Make ${v.ranks[1]}`));
      acts.appendChild(button('👑', () => confirm(`Make ${m.name} the leader of ${v.name}?`) && Actions.guildPassLeader(m.name), 'Pass the leadership'));
    }
    if (!self && m.rank > v.myRank && officer) acts.appendChild(button('✕', () => confirm(`Remove ${m.name} from ${v.name}?`) && Actions.guildKick(m.name), 'Remove from the guild'));
    table.appendChild(h('tr', null,
      h('td', { className: m.online ? 'online' : 'offline', textContent: m.online ? '●' : '○', title: m.online ? 'online' : 'offline' }),
      h('td', null, h('b', null, m.name), m.nick ? ` (${m.nick})` : ''),
      h('td', { className: 'muted' }, v.ranks[m.rank]),
      h('td', { className: 'muted' }, `${m.level} ${m.vocation === 'none' ? '' : vocName(m.vocation)}`),
      acts));
  }
  body.appendChild(table);
  if (officer) {
    body.appendChild(h('h3', null, 'Invite'));
    const who = field('Name of a player who is online', 20);
    body.appendChild(h('div', { className: 'row' }, who, button('Invite', () => { Actions.guildInvite(who.value); who.value = ''; who.blur(); })));
    for (const k of v.invited) body.appendChild(h('div', { className: 'row' }, h('span', { style: 'flex:1', className: 'muted' }, `${k} (invited)`), button('Revoke', () => Actions.guildRevoke(k))));
  }
  const foot = h('div', { className: 'dialog-buttons' });
  if (leader) {
    foot.appendChild(button('Rename ranks', () => {
      const t = prompt('The names of the three ranks, separated by commas:', v.ranks.join(', '));
      if (t !== null) Actions.guildRankTitles(t.split(',').map(s => s.trim()));
    }));
    foot.appendChild(button('Disband', () => confirm(`Disband ${v.name} for good?`) && Actions.guildDisband()));
  } else foot.appendChild(button('Leave guild', () => confirm(`Leave ${v.name}?`) && Actions.guildLeave()));
  body.appendChild(foot);
}

// ---- the forge --------------------------------------------------------------------------------
const forge = { npc: null, chosen: null, ores: [], key: '' };

function openForge(npcId) {
  Object.assign(forge, { npc: npcId, ores: [], key: '' });
  $('forge').hidden = false;
  renderForge();
}
function closeForge() {
  $('forge').hidden = true;
  forge.npc = null;
}

// Every piece of gear you could forge: what you wear, then what's in your bags.
function forgeableGear() {
  const out = [];
  for (const slot of SLOTS) {
    const it = player.equipment[slot];
    if (it && forgeable(it.id)) out.push({ ref: { root: 'equip', slot }, item: it });
  }
  const walk = (c, path) => c.contents.forEach((it, i) => {
    if (forgeable(it.id)) out.push({ ref: { root: 'bag', path: [...path, i] }, item: it });
    if (it.contents) walk(it, [...path, i]);
  });
  walk(bag(), []);
  return out;
}

function renderForge() {
  const npc = npcs.find(n => n.id === forge.npc);
  if (!npc || npc.z !== player.z || dist(npc, player) > TALK_RANGE + 2) return closeForge(); // walked away
  const gear = forgeableGear(), owned = ORES.map(countItem);
  const key = JSON.stringify([gear.map(g => [g.item.id, g.item.q || 0]), owned, forge.chosen, forge.ores, player.gold]);
  if (key === forge.key) return;
  forge.key = key;
  let chosen = gear.find(g => JSON.stringify(g.ref) === forge.chosen);
  if (!chosen && gear.length) { chosen = gear[0]; forge.chosen = JSON.stringify(chosen.ref); }
  const body = $('forgeBody');
  body.replaceChildren();
  if (!gear.length) return body.append(h('div', { className: 'muted' }, 'You have no weapons, armor or shields to forge.'));

  body.append(h('h3', null, 'Your gear'));
  const list = h('div', { className: 'forge-gear' });
  for (const g of gear) {
    const el = slotEl(g.item, { onClick: () => { forge.chosen = JSON.stringify(g.ref); forge.key = ''; renderForge(); } });
    if (g === chosen) el.classList.add('chosen');
    list.append(el);
  }
  body.append(list);

  const q = chosen.item.q || 0, target = q + 1, top = !QUALITIES[target];
  const main = h('div', { className: 'forge-main' });
  main.append(slotEl(chosen.item));
  const grade = n => h('b', { style: `color:${QUALITIES[n].color}` }, QUALITIES[n].name);
  main.append(h('div', { className: 'forge-arrow' }, grade(q), top ? 'can\'t get better' : '→', top ? null : grade(target)));
  if (!top) {
    const slots = h('div', { className: 'forge-ores' });
    for (let i = 0; i < FORGE_SLOTS; i++) {
      const g = forge.ores[i];
      slots.append(slotEl(g === undefined ? null : { id: ORES[g], count: 1 }, {
        label: 'ore', onClick: g === undefined ? null : () => { forge.ores.splice(i, 1); renderForge(); },
      }));
    }
    main.append(slots);
    const full = forge.ores.length === FORGE_SLOTS, chance = forgeChance(target, forge.ores);
    const color = chance >= 80 ? '#7ee07e' : chance >= 40 ? '#e8c060' : '#e07070';
    main.append(h('div', { className: 'forge-chance', style: `color:${full ? color : '#8a8070'}` }, `${chance}%`,
      h('small', null, full ? `fee ${FORGE_FEE[target - 1]} gold` : `${FORGE_SLOTS - forge.ores.length} more ore`)));
  }
  body.append(main);
  if (!top) {
    const supply = h('div', { className: 'forge-supply' });
    ORES.forEach((id, g) => {
      const left = owned[g] - forge.ores.filter(o => o === g).length;
      const el = slotEl(left > 0 ? { id, count: left } : null, {
        label: QUALITIES[g].name, hint: 'Click to put one in the forge.',
        onClick: left > 0 ? () => { if (forge.ores.length < FORGE_SLOTS) forge.ores.push(g); renderForge(); } : null,
      });
      supply.append(el);
    });
    const best = () => { // the best ore you have, from the top
      forge.ores = [];
      for (let g = ORES.length - 1; g >= 0 && forge.ores.length < FORGE_SLOTS; g--) {
        for (let n = 0; n < owned[g] && forge.ores.length < FORGE_SLOTS; n++) forge.ores.push(g);
      }
      renderForge();
    };
    body.append(h('h3', null, 'Your ore - each one adds to the chance: better ore 25%, the same grade 20%, a grade below 5%'), supply);
    body.append(h('div', { className: 'dialog-buttons' },
      h('button', { textContent: 'Best ore', onclick: best }),
      h('button', { textContent: 'Clear', onclick: () => { forge.ores = []; renderForge(); } }),
      h('button', { className: 'primary', textContent: 'Forge!', disabled: forge.ores.length < FORGE_SLOTS,
        onclick: () => { Actions.forgeItem(chosen.ref, forge.ores.slice()); forge.ores = []; } })));
  }
  body.append(h('h3', null, `Fuse ore: ${FUSE_COUNT} of a grade make one of the next`));
  for (let g = 0; g < ORES.length - 1; g++) {
    const n = Math.floor(owned[g] / FUSE_COUNT);
    body.append(h('div', { className: 'forge-row' },
      h('span', null, `${FUSE_COUNT} ${ITEMS[ORES[g]].name} → 1 ${ITEMS[ORES[g + 1]].name} (you have ${owned[g]})`),
      h('button', { textContent: 'Fuse', disabled: !n, onclick: () => Actions.fuseOre(g, 1) }),
      h('button', { textContent: `All (${n})`, disabled: n < 2, onclick: () => Actions.fuseOre(g, n) })));
  }
}

// The forge's verdict, over the game: in the colour of the new grade, or a sad grey.
function forgeResult(r) {
  showLook(r.ok ? `Success! ${capitalize(QUALITIES[r.q].name)} ${ITEMS[r.id].name}!` : `The forge failed (${r.chance}% chance).`);
  $('lookText').style.color = r.ok ? QUALITIES[r.q].color : '#c8b8b0';
  setTimeout(() => { $('lookText').style.color = ''; }, 4000);
}

// ---- dragging items ------------------------------------------------------------------------
// Slots have el.dragRef (the item there) and/or el.dropRef (where a dropped item goes).
// The map is a drop target too (the tile under the pointer), and a drag source for
// corpses, dropped items and movable things next to you.
const drag = { pending: null, active: false, ghost: null, suppressClick: false };

function startDrag(e, ref, icon, onClick) {
  if (e.button !== 0) return;
  drag.pending = { ref, icon, onClick, sx: e.clientX, sy: e.clientY, shift: e.shiftKey };
}

window.addEventListener('pointermove', e => {
  const d = drag.pending;
  if (!d) return;
  if (!drag.active && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) {
    drag.active = true;
    drag.ghost = new Image();
    drag.ghost.src = d.icon;
    drag.ghost.className = 'drag-ghost';
    document.body.appendChild(drag.ghost);
  }
  if (drag.active) {
    drag.ghost.style.left = `${e.clientX - 16}px`;
    drag.ghost.style.top = `${e.clientY - 16}px`;
  }
});

// A drag the browser took over (a scroll, an image drag of its own) just stops.
window.addEventListener('pointercancel', () => {
  if (drag.active) drag.ghost.remove();
  drag.active = false;
  drag.pending = null;
});

window.addEventListener('pointerup', e => {
  const d = drag.pending;
  drag.pending = null;
  if (!d) return;
  if (!drag.active) {
    if (d.onClick) d.onClick(e);
    return;
  }
  drag.active = false;
  drag.ghost.remove();
  drag.suppressClick = true;
  setTimeout(() => { drag.suppressClick = false; }, 0);
  let el = document.elementFromPoint(e.clientX, e.clientY), dst = null;
  if (el === canvas) dst = { root: 'ground', ...tileUnderPointer(e) };
  while (el && !dst) {
    if (el.dropRef) dst = el.dropRef;
    el = el.parentElement;
  }
  if (!dst) return;
  let count;
  const item = d.ref.root !== 'map' && resolveForUi(d.ref);
  if (item && item.count > 1 && (e.shiftKey || d.shift)) {
    count = parseInt(prompt(`How many? (1-${item.count})`, String(item.count)), 10);
    if (!(count > 0)) return;
  }
  Actions.moveItem(d.ref, dst, count);
});

const resolveForUi = ref => (resolve(ref) || {}).item || null;

function slotEl(item, { label, slot, dragRef, dropRef, onClick, onRight, hint } = {}) {
  const el = document.createElement('div');
  el.className = 'slot';
  if (item) {
    el.dataset.item = item.id; // (the guide's light can find a thing in the bag by it)
    const img = new Image();
    img.src = Sprites.itemURL(item.id);
    img.draggable = false;
    el.appendChild(img);
    if (item.count > 1) {
      const c = document.createElement('span');
      c.className = 'count';
      c.textContent = item.count;
      el.appendChild(c);
    }
    el.title = itemInfo(item.id, item.q) + (item.time ? ` - ${Math.ceil(item.time / 60000)} min left` : '') + (hint ? `\n${hint}` : '');
    // gear glows in the colour of its grade (fine, rare, epic, legendary), and ore in its own
    const grade = item.q || (ITEMS[item.id] && ITEMS[item.id].ore) || 0;
    if (grade) el.dataset.rarity = ['', 'uncommon', 'rare', 'epic', 'legendary'][grade];
  } else {
    el.classList.add('empty');
    if (label) el.dataset.label = label;
    // an empty equipment slot shows a faint drawing of what goes there
    if (slot && typeof Icons !== 'undefined') el.appendChild(Icons.img(`slot-${slot}`, 22));
  }
  if (dropRef) el.dropRef = dropRef;
  if (item && dragRef) el.addEventListener('pointerdown', e => startDrag(e, dragRef, Sprites.itemURL(item.id), onClick));
  else if (onClick) el.addEventListener('click', e => { if (!drag.suppressClick) onClick(e); });
  if (onRight) el.addEventListener('contextmenu', e => {
    e.preventDefault();
    onRight(e);
  });
  return el;
}

// Left click on an item: shift = look, ctrl = drop; otherwise use it. Right click always uses. On a phone (no keys to
// hold) a tap shows what it is and what you can do with it: use it, or drop it (all, or one) at your feet.
function itemClick(ref) {
  return e => {
    const item = resolveForUi(ref);
    if (!item) return;
    if (touchScreen && !e.shiftKey && !e.ctrlKey) return itemMenu(ref, item, e);
    if (e.shiftKey) log(`You see ${itemInfo(item.id, item.q)}.`, 'look');
    else if (e.ctrlKey || e.metaKey) Actions.moveItem(ref, { root: 'ground', x: player.x, y: player.y, z: player.z });
    else Actions.useItem(ref);
  };
}

// A tapped item on a phone: what it is (its numbers), and what you can do with it. Gear you could wear also shows what
// you wear there now, to compare; gear you wear (worn) offers Take off.
// A piece of gear's fighting stats at its grade (what the equipment window adds up), by name
function gearValues(id, q = 0) {
  const d = ITEMS[id], w = d.weapon, out = {};
  if (w && w.type === 'wand') out.Attack = `${w.element} ${wandDamage(w, q).join('-')}`;
  else if (w) out.Attack = qualityStat(w.attack, q);
  if (d.ammo) out.Attack = d.ammo.attack;
  if (d.defense) out.Defense = qualityStat(d.defense, q);
  if (d.armor) out.Armor = qualityStat(d.armor, q);
  return out;
}

// What an item is, for a card: its name, what it does, and for gear its stats beside what you wear there now:
// how much more (green) or less (red) each would be
function itemDetails(item, worn = false) {
  const slot = ITEMS[item.id].slot, gear = slot && slot !== 'backpack', now = !worn && gear ? player.equipment[slot] : null;
  const mine = gearValues(item.id, item.q), theirs = now ? gearValues(now.id, now.q) : {};
  const names = [...new Set([...Object.keys(mine), ...Object.keys(theirs)])];
  const rows = names.map(name => {
    const a = mine[name], b = theirs[name], diff = !worn && typeof (a || 0) === 'number' && typeof (b || 0) === 'number' ? (a || 0) - (b || 0) : 0;
    return h('div', { className: 'gear-stat' }, h('span', {}, name), h('b', {}, a === undefined ? '-' : String(a),
      diff ? h('em', { className: diff > 0 ? 'up' : 'down' }, ` ${diff > 0 ? '+' : '−'}${Math.abs(diff)}`) : null));
  });
  return [
    h('b', {}, itemName(item.id, item.count || 1, item.q)),
    rows.length ? h('div', { className: 'gear-stats item-stats' }, ...rows) : null,
    h('small', {}, itemInfo(item.id, item.q)),
    !worn && gear ? h('small', { className: 'item-menu-now' }, now ? `Compared with what you wear: ${itemName(now.id, 1, now.q)}.` : `You wear nothing there (${SLOT_LABELS[slot] || slot}).`) : null,
  ].filter(Boolean);
}

// A card beside a thing showing what it is (the shop's wares): over it with the mouse, or tapped on a phone
function itemCard(id, near) {
  hideItemCard();
  const box = h('div', { id: 'itemCard', className: 'item-menu item-card' }, ...itemDetails({ id, count: 1 }));
  document.body.append(box);
  const a = near.getBoundingClientRect(), r = box.getBoundingClientRect(), win = near.closest('.window');
  const side = !touchScreen && win && win.getBoundingClientRect(); // (on a computer: beside the window, not over the list)
  if (side && side.right + r.width + 16 < window.innerWidth) {
    Object.assign(box.style, { left: `${side.right + 8}px`, top: `${Math.max(8, Math.min(window.innerHeight - r.height - 8, a.top))}px` });
    return;
  }
  const x = Math.min(window.innerWidth - r.width - 8, Math.max(8, a.left + a.width / 2 - r.width / 2)), y = a.top - r.height - 6;
  Object.assign(box.style, { left: `${x}px`, top: `${y < 8 ? a.bottom + 6 : y}px` });
}
const hideItemCard = () => { const c = $('itemCard'); if (c) c.remove(); };

function itemMenu(ref, item, e, worn = false) {
  const old = $('itemMenu');
  if (old) old.remove();
  const box = h('div', { id: 'itemMenu', className: 'item-menu' });
  const close = () => { box.remove(); document.removeEventListener('pointerdown', outside, true); };
  const outside = ev => { if (!box.contains(ev.target)) close(); };
  const act = (label, f, cls) => { const b = h('button', { className: cls || '' }, label); b.addEventListener('click', () => { close(); f(); }); return b; };
  const ground = { root: 'ground', x: player.x, y: player.y, z: player.z };
  const slot = ITEMS[item.id].slot;
  box.append(...[
    ...itemDetails(item, worn),
    worn
      ? h('div', { className: 'item-menu-buttons' }, act('Take off', () => Actions.unequip(ref.slot), 'primary'))
      : h('div', { className: 'item-menu-buttons' },
        act(slot && slot !== 'backpack' ? 'Wear' : 'Use', () => Actions.useItem(ref), 'primary'), // (gear: put it on)
        ref.root !== 'depot' && openContainers.some(o => o.root === 'depot') ? act('Put in locker', () => Actions.moveItem(ref, { root: 'depot', path: [] })) : null, // (at the depot)
        act(item.count > 1 ? 'Drop all' : 'Drop', () => Actions.moveItem(ref, ground)),
        item.count > 1 ? act('Drop one', () => Actions.moveItem(ref, ground, 1)) : null),
  ].filter(Boolean));
  document.body.append(box);
  const r = box.getBoundingClientRect(), x = Math.min(window.innerWidth - r.width - 8, Math.max(8, e.clientX - r.width / 2)), y = e.clientY - r.height - 12;
  Object.assign(box.style, { left: `${x}px`, top: `${y < 8 ? e.clientY + 24 : y}px` });
  setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
}

// ---- equipment and containers -----------------------------------------------------------------
const EQUIP_LAYOUT = ['neck', 'head', 'backpack', 'weapon', 'body', 'shield', 'ring', 'legs', 'ammo', null, 'feet', null];

// What an item shows in a slot (its picture, count, grade, minutes left), and of a container all it holds: the bag and
// the equipment are only built again when this changes. (Every hit can mark the panel to be drawn again, for its skill
// bar; building the slots again each time made their pictures flicker.)
const slotKey = it => it && [it.id, it.count, it.q || 0, it.time ? Math.ceil(it.time / 60000) : 0, it.contents ? it.contents.map(slotKey) : 0];
const builtKeys = {};
function unchanged(name, key) { if (builtKeys[name] === key) return true; builtKeys[name] = key; return false; }

function renderEquipment() {
  const root = $('equipment');
  if (unchanged('equipment', JSON.stringify([SLOTS.map(sl => slotKey(player.equipment[sl])), GEAR_STATS.map(([, value]) => value()), touchScreen])) && root.childElementCount) return;
  root.replaceChildren();
  for (const slot of EQUIP_LAYOUT) {
    if (!slot) {
      root.appendChild(document.createElement('div'));
      continue;
    }
    const ref = { root: 'equip', slot };
    root.appendChild(slotEl(player.equipment[slot], {
      label: SLOT_LABELS[slot], slot, dragRef: slot === 'backpack' ? null : ref, dropRef: ref,
      // (on a phone a tap shows what it is, with Take off; on a computer a click takes it off)
      onClick: slot === 'backpack' ? null : e => (touchScreen && player.equipment[slot] ? itemMenu(ref, player.equipment[slot], e, true) : Actions.unequip(slot)),
      onRight: () => Actions.unequip(slot),
      hint: 'Click to take it off, or drag it.',
    }));
  }
  const stats = $('gearStats');
  stats.replaceChildren(
    h('div', { className: 'gear-stats' }, ...GEAR_STATS.map(([name, value, hint]) => h('div', { className: 'gear-stat', title: hint }, h('span', {}, name), h('b', {}, String(value()))))));
}

// The stats of what you wear, in the equipment window: a name, its value and what it does. More (critical hits...)
// go here as one line each.
const GEAR_STATS = [
  ['Attack', () => { const w = playerWeapon(); return w.kind === 'magic' ? `${w.dmg[0]}-${w.dmg[1]} ${w.element}` : w.noAmmo ? `no ${w.noAmmo}s!` : w.attack; },
    'Your weapon: how hard you hit'],
  ['Defense', totalDefense, 'Your shield (or without one, your weapon): blocks part of each blow you take'],
  ['Armor', totalArmor, 'All you wear together: takes something off every hit'],
];

// Open container windows: the bag is always open; others open by using them.
let openContainers = [];

function openContainer(c) {
  if (c.root === 'bag' && !c.path.length) return;
  openContainers = openContainers.filter(o => !(o.root === c.root && String(o.path) === String(c.path)));
  openContainers.push({ root: c.root, path: c.path, title: c.title });
  uiDirty();
}

function containerWindow(root, path, heading, closable) {
  const ref = { root, path };
  const c = containerAt(ref);
  if (!c) return null;
  const box = document.createElement('section');
  box.className = 'container';
  const h = document.createElement('h2');
  h.textContent = `${heading} (${c.contents.length}/${capacityOf(c)})`;
  if (closable) {
    const x = document.createElement('button');
    x.textContent = '×';
    x.title = 'Close';
    x.addEventListener('click', () => {
      openContainers = openContainers.filter(o => !(o.root === root && String(o.path) === String(path)));
      uiDirty();
    });
    h.appendChild(x);
  }
  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.dropRef = { root, path: [...path, c.contents.length] };
  for (let i = 0; i < capacityOf(c); i++) {
    const item = c.contents[i], slotRef = { root, path: [...path, i] };
    grid.appendChild(slotEl(item, {
      dragRef: slotRef, dropRef: item ? slotRef : { root, path: [...path, c.contents.length] },
      onClick: itemClick(slotRef), onRight: () => item && Actions.useItem(slotRef),
      hint: 'Click: use · drag: move · Shift: look · Ctrl: drop',
    }));
  }
  if (touchScreen && root === 'bag' && !path.length) { // on a phone the bag floats over the map: a close button on it
    const x = document.createElement('button');
    x.className = 'bag-close'; x.textContent = '×'; x.title = 'Close';
    x.addEventListener('click', () => document.body.classList.remove('bag-open'));
    h.appendChild(x);
  }
  box.append(h, grid);
  // your gold (kept apart from the bag's places), under the bag you carry
  if (root === 'bag' && !path.length) {
    const coin = new Image(), gold = document.createElement('div'), sum = document.createElement('b');
    coin.src = Sprites.itemURL('gold');
    sum.textContent = player.gold;
    gold.className = 'bag-gold'; gold.title = 'Your gold';
    gold.append(coin, sum, ' gold');
    if (player.bank) gold.append(Object.assign(document.createElement('small'), { textContent: ` (+${player.bank} in the bank)` }));
    box.append(gold);
  }
  // A bigger bag in your bag (a backpack): one tap to carry everything in it instead (the old one goes inside).
  // Dragging it onto the bag slot does the same, but on a phone that slot is rarely in sight.
  if (root === 'bag' && path.length === 1 && ITEMS[c.id].slot === 'backpack' && capacityOf(c) > capacityOf(bag())) {
    const swap = document.createElement('button');
    swap.className = 'bag-swap';
    swap.textContent = `Carry my things in this ${ITEMS[c.id].name}`;
    swap.addEventListener('click', () => {
      Actions.moveItem({ root, path }, { root: 'equip', slot: 'backpack' });
      openContainers = openContainers.filter(o => !(o.root === root && String(o.path) === String(path)));
      uiDirty();
    });
    box.insertBefore(swap, grid); // above its slots, where it's in sight
  }
  return box;
}

function renderContainers() {
  const root = $('containers');
  openContainers = openContainers.filter(o => containerAt(o));
  const key = JSON.stringify([slotKey(bag()), openContainers.map(o => [o.root, o.path, o.title, slotKey(containerAt(o))]), player.gold, player.bank || 0]);
  if (unchanged('containers', key) && root.childElementCount) return;
  root.replaceChildren();
  const b = bag();
  if (b) root.appendChild(containerWindow('bag', [], capitalize(ITEMS[b.id].name), false));
  openContainers = openContainers.filter(o => containerAt(o));
  for (const o of openContainers) {
    const w = containerWindow(o.root, o.path, o.title, true);
    if (w) root.appendChild(w);
  }
}

function renderLoot() {
  const p = player.openPile;
  $('lootBox').hidden = !p;
  if (!p) return;
  $('lootTitle').textContent = capitalize(p.name || 'items on the ground');
  const root = $('loot');
  root.replaceChildren();
  root.dropRef = { root: 'pile', pileId: p.id, path: [p.items.length] };
  p.items.forEach((item, i) => {
    const ref = { root: 'pile', pileId: p.id, path: [i] };
    root.appendChild(slotEl(item, {
      dragRef: ref, dropRef: ref, onClick: () => Actions.takeFromPile(p.id, i), onRight: () => Actions.takeFromPile(p.id, i),
      hint: 'Click to take it, or drag it somewhere.',
    }));
  });
  // (the last thing taken: the window closes by itself; one that was empty from the start says so)
  if (!p.items.length && renderLoot.had === p.id) { renderLoot.had = null; Actions.closePile(); return; }
  if (!p.items.length) root.textContent = 'Nothing in it.';
  renderLoot.had = p.items.length ? p.id : null;
}

// ---- trade window ----------------------------------------------------------------------
let shopTab = 'buy';

function shopRow(id, info, buttons) {
  const row = document.createElement('div');
  row.className = 'shop-row';
  const icon = new Image();
  icon.src = Sprites.itemURL(id);
  const text = document.createElement('div');
  text.className = 'shop-name';
  text.textContent = capitalize(ITEMS[id].name);
  const small = document.createElement('small');
  small.textContent = info;
  text.appendChild(small);
  row.append(icon, text);
  // what it is: a card over the row with the mouse, or on a tap of its picture or name on a phone
  row.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') itemCard(id, row); });
  row.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hideItemCard(); });
  for (const el of [icon, text]) el.addEventListener('click', () => {
    if (!touchScreen) return;
    if ($('itemCard')) return hideItemCard();
    itemCard(id, row);
    setTimeout(() => document.addEventListener('pointerdown', ev => { if (!row.contains(ev.target)) hideItemCard(); }, { capture: true, once: true }), 0);
  });
  if (ITEMS[id].slot && canWear(id)) row.classList.add('unusable');
  for (const [label, act] of buttons) {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', act);
    row.appendChild(b);
  }
  return row;
}

function renderShop() {
  const npc = player.shopNpc;
  $('shop').hidden = !npc;
  hideItemCard(); // (the list is drawn anew)
  if (!npc) return;
  $('shopTitle').textContent = `Trade with ${npc.name}`;
  $('shopGold').textContent = `${player.gold} gold · cap ${freeCapacity()} oz`;
  document.querySelectorAll('[data-shoptab]').forEach(b => b.classList.toggle('active', b.dataset.shoptab === shopTab));
  const list = $('shopList');
  list.replaceChildren();
  if (shopTab === 'buy') {
    for (const [id, price] of npc.def.trade.sells) {
      if (!ITEMS[id]) continue;
      const amounts = ITEMS[id].stack ? [1, 10, 50] : [1];
      list.appendChild(shopRow(id, `${price} gold each`, amounts.map(n => [ITEMS[id].stack ? `×${n}` : 'Buy', () => Actions.buy(id, n)])));
    }
  } else {
    const items = sellableItems(npc);
    for (const [id, price, count] of items) {
      list.appendChild(shopRow(id, `${price} gold each · you have ${count}`, [['Sell 1', () => Actions.sell(id, 1)], ['Sell all', () => Actions.sell(id, count)]]));
    }
    if (!items.length) list.textContent = "You have nothing I'd buy.";
  }
}

// ---- battle list ------------------------------------------------------------------------
let battleKey = '';

// The creature whose battle list row the pointer is on; the game view frames it.
let battleHover = null;

// A creature's picture for the list, made into an image once per kind (turning a canvas into a PNG costs: done
// for every row whenever a health bar moved, it stalled fights)
const battleFaces = new Map();
const battleFace = key => {
  if (battleFaces.has(key)) return battleFaces.get(key);
  const url = Sprites.creature(key, 2, 0).toDataURL();
  if (typeof Preload === 'undefined' || Preload.ready) battleFaces.set(key, url); // (kept once the pictures are all in)
  return url;
};

function renderBattle() {
  const list = [...monsters, ...players].filter(c => c !== player && !c.dead && c.z === player.z
    && Math.abs(c.x - player.x) <= 7 && Math.abs(c.y - player.y) <= 5 && (c.type === 'player' || canSee(c)))
    .sort((a, b) => dist(a, player) - dist(b, player));
  const struck = new Set(effects.filter(fx => fx.kind === 'attacker' && forViewer(fx, player) && now < fx.start + fx.dur).map(fx => fx.cid));
  const key = list.map(c => `${c.id}:${Math.round((c.hp / c.maxHp) * 20)}${struck.has(c.id) ? '!' : ''}`).join(',')
    + `|${player.target && player.target.id}|${player.follow}|${player.fightMode}|${player.chase}|${player.secure}`;
  if (key === battleKey) return;
  battleKey = key;
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === player.fightMode));
  $('chaseMode').classList.toggle('active', player.chase);
  $('secureMode').classList.toggle('active', player.secure !== false);
  $('secureMode').textContent = player.secure !== false ? 'Secure' : 'PvP';
  const root = $('battle');
  root.replaceChildren();
  for (const c of list) {
    const row = document.createElement('div');
    row.className = `battle-row${player.target === c ? ' target' : player.follow === c.id ? ' followed' : ''}${struck.has(c.id) ? ' struck' : ''}`;
    const img = new Image();
    img.src = battleFace(c.type === 'player' ? Sprites.playerKey(c.vocation, c.outfit) : creatureKey(c));
    const name = document.createElement('span');
    name.textContent = c.type === 'player' ? c.name : capitalize(c.name);
    const bar = document.createElement('div');
    bar.className = 'mini';
    bar.innerHTML = `<div style="width:${Math.round((100 * c.hp) / c.maxHp)}%"></div>`;
    name.appendChild(bar);
    row.append(img, name);
    row.addEventListener('click', () => Actions.setTarget(c.id));
    row.addEventListener('pointerenter', () => { battleHover = c.id; });
    root.appendChild(row);
  }
  if (!list.some(c => c.id === battleHover)) battleHover = null;
  if (!list.length) root.textContent = 'Nobody around.';
}

// ---- skills and quests tabs --------------------------------------------------------------
function skillRow(name, value, fraction) {
  const row = document.createElement('div');
  row.className = 'skill';
  row.innerHTML = '<span></span><b></b><div class="mini"><div></div></div>';
  row.children[0].textContent = name;
  row.children[1].textContent = value;
  // (no fraction: a plain fact, like your home town, without a bar)
  if (fraction === null) { row.querySelector('.mini').remove(); return row; }
  row.querySelector('.mini div').style.width = `${Math.floor(Math.min(1, fraction) * 100)}%`;
  row.title = `${Math.floor(fraction * 100)}% to the next level`;
  return row;
}

function renderSkills() {
  const root = $('tab-skills');
  root.replaceChildren();
  if (TREES[player.vocation]) { // your skill tree: a button, with your points to spend on it
    const n = treePoints(player), b = h('button', { className: `tree-open${n ? ' has-points' : ''}` }, 'Skill tree', n ? h('span', { className: 'tree-dot' }, String(n)) : '');
    b.addEventListener('click', openSkillTree);
    root.appendChild(b);
  }
  const lo = xpForLevel(player.level), hi = xpForLevel(player.level + 1);
  root.appendChild(skillRow('Level', player.level, (player.xp - lo) / (hi - lo)));
  root.appendChild(skillRow('Home town', homeTown(), null)); // where you wake up when you die: ask a priest about becoming a citizen
  for (const id of Object.keys(SKILLS)) {
    const s = player.skills[id];
    root.appendChild(skillRow(capitalize(SKILLS[id].name), s.level, s.tries / skillTries(id, s.level, player.vocation)));
  }
  root.appendChild(skillRow('Capacity', `${freeCapacity()} / ${capacity()} oz`, 1 - freeCapacity() / capacity()));
  const frags = (player.frags || []).filter(t => now - t < FRAG_LIMITS[0][1]).length;
  if (frags) root.appendChild(skillRow('Unjustified kills today', `${frags} / ${FRAG_LIMITS[0][0]}`, frags / FRAG_LIMITS[0][0]));
}

function renderQuests() {
  const root = $('tab-quests');
  root.replaceChildren();
  // the guide's step, in full: on a phone it can be folded away over the map, and read here
  const gs = guideState();
  if (gs.step) {
    const box = document.createElement('div');
    box.className = 'story guide-card';
    const head = document.createElement('b'); head.textContent = `Guide ${guideCount().at} / ${guideCount().of}`;
    const p = document.createElement('div'); p.textContent = gs.text;
    box.append(head, p);
    if (gs.now) { const n = document.createElement('div'); n.className = 'guide-now'; n.textContent = gs.now; box.append(n); }
    const show = document.createElement('button');
    show.textContent = guideFolded ? 'Show the guide over the map' : 'Fold the guide away';
    show.addEventListener('click', () => { $('guideHead').click(); renderQuests(); });
    box.append(show);
    root.append(box);
  }
  // Where to go now in an active quest, and what to say there.
  const goTo = id => {
    const s = questStep(id), who = s.npc || QUESTS[id].giver, word = questWord(who, id);
    if (s.auto) return '';
    return `${stepReady(id) ? 'Then go' : 'When it is done, go'} to ${NPCS[who].name}${word ? ` and say "${word}"` : ''}.`;
  };
  // The stories first (The Last Town on Oakvale Isle, The Ember Seal on the mainland): the chapters
  // behind you, the one you're on, and where the next begins.
  const stories = {};
  for (const id of Object.keys(QUESTS)) {
    const st = QUESTS[id].story;
    if (st) (stories[st === true ? 'The Ember Seal' : st] = stories[st === true ? 'The Ember Seal' : st] || []).push(id);
  }
  for (const [title, story] of Object.entries(stories)) {
    const waits = title === 'The Ember Seal' ? !graduated() || !mainlandOpen() : graduated(); // the mainland's story waits for the mainland
    if (waits && !story.some(id => questState(id) !== 'none')) continue;
    const box = document.createElement('div'), head = document.createElement('b');
    box.className = 'story';
    const done = story.filter(id => questState(id) === 'done').length;
    head.textContent = `${title} · ${done === story.length ? 'complete!' : `chapter ${Math.min(done + 1, story.length)} of ${story.length}`}`;
    box.appendChild(head);
    const chapter = id => QUESTS[id].name.replace(`${title} `, '');
    let next = true;
    for (const id of story) {
      const line = document.createElement('div'), state = questState(id);
      if (state === 'done') {
        line.className = 'done';
        line.textContent = `✓ ${chapter(id)}`;
      } else if (state === 'active') {
        const s = questStep(id), progress = questProgress(id);
        line.className = 'now';
        line.innerHTML = '<b></b><span></span><i></i>';
        line.children[0].textContent = chapter(id);
        line.children[1].textContent = `${s.summary || QUESTS[id].summary}${progress ? ` (${progress})` : ''}`;
        line.children[2].textContent = ` ${goTo(id)}`;
        next = false;
      } else if (next) {
        const q = QUESTS[id], who = q.offers && player.home !== 'start' ? Object.keys(q.offers)[0] : q.giver, word = questWord(who, id) || 'quest';
        line.className = 'next';
        line.textContent = `Next: ${chapter(id)}. ${q.level > player.level ? `From level ${q.level}: t` : 'T'}alk to ${NPCS[who].name} and say "${word}".`;
        next = false;
      } else continue;
      box.appendChild(line);
    }
    root.appendChild(box);
  }
  // (after the story) The Oakvale Chronicle: the founder's pages you've found, and a line for each (a collection, no arrow)
  if (typeof CHRONICLE !== 'undefined' && CHRONICLE.some((_, i) => player.chests[`chronicle_${i + 1}`])) {
    const box = h('div', { className: 'story' }, h('b', {}, `The Oakvale Chronicle: ${CHRONICLE.filter((_, i) => player.chests[`chronicle_${i + 1}`]).length} of ${CHRONICLE.length} pages`));
    CHRONICLE.forEach((text, i) => {
      const has = player.chests[`chronicle_${i + 1}`];
      const line = h('div', { className: 'small' + (has ? '' : ' muted') }, has ? `${i + 1}. ${text}` : `${i + 1}. (a page still missing)`);
      if (has) line.addEventListener('click', () => showWindow(`The founder's diary, page ${i + 1}`, text));
      box.append(line);
    });
    if (player.chests.chronicle_done) box.append(h('div', { className: 'small' }, 'Pieced together by Master Corwin: the diary of Edda Marrowind, first of Oakvale.'));
    root.append(box);
  }
  const ids = Object.keys(player.quests).filter(id => QUESTS[id] && !QUESTS[id].story);
  if (!ids.length) root.append(`No other quests yet. Talk to people (${touchScreen ? 'tap them' : 'click them, or type "hi"'}) to find some.`);
  for (const id of ids.sort((a, b) => (questState(a) === 'done') - (questState(b) === 'done'))) {
    const q = QUESTS[id], done = questState(id) === 'done';
    const el = document.createElement('div');
    el.className = `quest${done ? ' done' : ''}`;
    const head = document.createElement('b');
    head.textContent = `${q.name}${done ? ' ✓' : ''}`;
    const text = document.createElement('div');
    if (done) text.textContent = q.chest ? q.summary : 'Completed.';
    else {
      const s = questStep(id), progress = questProgress(id);
      text.textContent = `${s.summary || q.summary}${progress ? ` (${progress})` : ''} ${goTo(id)}`;
    }
    el.append(head, text);
    root.appendChild(el);
  }
  root.append(bestiaryBox());
}

// The bestiary (game-combat.js): every kind you've slain, how many, and what knowing them is worth. Under the quests:
// in the side panel's Quests tab, and on a phone in the drawer's Quests page.
function bestiaryBox() {
  const kills = player.bestiary || {}, kinds = Object.keys(kills).filter(t => MONSTERS[t]).sort((a, b) => kills[b] - kills[a]);
  const box = h('div', { className: 'story bestiary', id: 'bestiary' }, h('b', {}, `Bestiary${kinds.length ? ` · ${kinds.length} kind${kinds.length === 1 ? '' : 's'}` : ''}`));
  if (!kinds.length) box.append(h('div', { className: 'small muted' }, `Every monster you slay is counted here. At ${BESTIARY_TIERS.map(([n]) => n).join(', ')} of a kind you know them better: more damage against them, for good.`));
  for (const type of kinds) {
    const n = kills[type], tier = bestiaryTier(type), next = BESTIARY_TIERS[tier];
    const face = h('img', { className: 'bestiary-face', alt: '' });
    face.src = battleFace(type);
    const stars = h('span', { className: 'bestiary-stars' }, '★'.repeat(tier) + '☆'.repeat(BESTIARY_TIERS.length - tier));
    const about = tier ? `+${Math.round(bestiaryBonus(type) * 100)}% damage` : 'no bonus yet';
    const line = h('div', { className: 'bestiary-row small' }, face, h('span', { className: 'bestiary-name' }, capitalize(kindName(type))), stars,
      h('span', { className: 'muted' }, `${n} slain · ${about}${next ? ` · ${next[0] - n} to ${tier ? 'the next' : 'the first'} star` : ''}`));
    line.title = BESTIARY_TIERS.map(([at, b], i) => `${'★'.repeat(i + 1)} ${at} slain: +${Math.round(b * 100)}% damage`).join('\n');
    box.append(line);
  }
  return box;
}

// ---- spell bar ---------------------------------------------------------------------------
// Everything the bar below the map offers: your vocation's spells, potions and food.
// A line of your skill tree is one entry (its first tier's id, so a button keeps its place as it grows), showing the
// highest tier you've learned; a line with nothing learned yet waits, locked, for your skill tree.
function hotbarEntries() {
  // (in a trial of the Hall of Paths: just its two spells, open at any level)
  const tree = !player.trial && TREES[player.vocation];
  const ids = player.trial ? PATHS[player.trial.voc].spells
    : spellsFor(player.vocation).filter(id => !SPELLS[id].hidden && !(tree && treeSpot(id) && treeSpot(id).tier > 0));
  const list = ids.map((id, i) => {
    const line = tree && treeSpot(id), cur = line ? lineSpell(player, id) : id, s = SPELLS[cur || id];
    const locked = line ? !cur : !player.trial && (player.level < s.level || (s.promoted && !player.promoted));
    const sub = line && !cur ? 'skill tree' : locked ? (s.promoted && !player.promoted ? 'promotion' : `level ${s.level}`) : `${s.mana} mana`;
    const rank = line && cur ? ` (rank ${rankOf(player, cur)})` : '';
    return { id, key: i < 9 ? String(i + 1) : '', name: s.name + rank, sub, tip: `${s.desc} Words: "${s.words}"`, act: () => Actions.castSpell(id), locked,
      badge: line && !cur ? 'learn' : null };
  });
  list.push(
    { id: 'h', key: 'H', name: 'Health potion', sub: `×${countItem('health_potion')}`, tip: 'Drink a health potion', act: () => Actions.hotkey('h') },
    { id: 'm', key: 'M', name: 'Mana potion', sub: `×${countItem('mana_potion')}`, tip: 'Drink a mana potion', act: () => Actions.hotkey('m') },
    { id: 'f', key: 'F', name: 'Eat', sub: '', tip: 'Eat something from your bag', act: () => Actions.hotkey('f') },
  );
  return list;
}

function renderHotbar() {
  const root = $('hotbar');
  root.replaceChildren();
  for (const e of hotbarEntries()) {
    const b = document.createElement('button');
    b.className = 'hot';
    b.disabled = !!e.locked;
    b.title = e.tip;
    b.innerHTML = '<kbd></kbd> <span></span><small></small>';
    b.querySelector('kbd').textContent = e.key;
    b.querySelector('span').textContent = e.name;
    b.querySelector('small').textContent = e.sub;
    b.addEventListener('click', e.act);
    root.appendChild(b);
  }
  if (typeof renderFavs === 'function') renderFavs();
}

function renderUI() {
  uiNeedsRender = false;
  renderEquipment();
  renderContainers();
  renderLoot();
  renderShop();
  renderSkills();
  renderSkillTree();
  renderQuests();
  renderHotbar();
  battleKey = '';
}

// ---- events from the game: reading, opening containers, use-with, raids ------------------
let useWith = null;   // { ref, name } while picking a target for a rune or tool
let raidBanner = null;

function handleEvents() {
  const events = player.events.splice(0);
  for (const { kind, data } of events) {
    if (kind === 'read') showWindow(data.title, data.text);
    else if (kind === 'openContainer') {
      openContainer(data);
      // on a phone, open bags show in the inventory drawer (inventory-drawer.js), or else over the map
      if (touchScreen && typeof InventoryDrawer !== 'undefined' && document.getElementById('inventoryDrawer')) InventoryDrawer.open(2); // (expanded: where the other bags show)
      else document.body.classList.add(touchScreen ? 'bag-open' : 'panel-open');
    } else if (kind === 'useWith') {
      document.body.classList.remove('panel-open', 'bag-open'); // out of the way, to tap the target
      if (touchScreen && typeof InventoryDrawer !== 'undefined' && InventoryDrawer.stage()) InventoryDrawer.close(); // (the phone's drawer too)
      useWith = data;
      canvas.classList.add('targeting');
      log(touchScreen ? `Tap where to use the ${data.name}.` : `Click where to use the ${data.name}. (Right-click or Esc to cancel.)`);
    } else if (kind === 'raid') raidBanner = { text: data.message, until: now + 7000, color: '#ff6040' };
    else if (kind === 'banner') raidBanner = { text: data.message, until: now + 9000, color: '#ffd84a' };
    else if (kind === 'forge') openForge(data.npc);
    else if (kind === 'forged') forgeResult(data);
    else if (kind === 'petName') askPetName(data.name);
    else if (kind === 'siege') { raidBanner = { text: 'The Hollow Host is at the walls!', until: now + 7000, color: '#ff6040' }; Sound.play('horn'); setTimeout(() => Sound.play('horn'), 1900); }
    else if (kind === 'cannons') (data.cannons || []).forEach((c, k) => setTimeout(() => { Sound.play('cannon'); Fx.quake(5); }, k * SIEGE_VOLLEY_MS)); // (the volley: drawSiege in game.js)
    else if (kind === 'paths') showPaths();
  }
}

function cancelUseWith() {
  useWith = null;
  canvas.classList.remove('targeting');
}

function showWindow(heading, body) {
  $('readTitle').textContent = heading;
  $('readText').textContent = body;
  $('read').hidden = false;
}

// ---- choosing a path, as a new character is made (game-core.js choosePath) ------------------------------------------
// Bastion, Hawk or Ember, each a card: what it is, how it fights, and one button. Asked of anyone without a path once
// their name and outfit are done (online too: the choice goes to the server), never in a trial or on Kestrel Isle.
// How each path is shown when it's chosen: its kind of fighting and role, one line of how it plays, one of what it's best
// at and one of its weakness, all as the game's own numbers have them (VOCATIONS; health a level 15 / 10 / 5, mana
// 5 / 15 / 30; the Hawk's spells: Power Shot, volleys, its falcon, a little holy magic); nothing here the game doesn't do.
// Its art: sprites/ui/sortia/<art>-scene.webp, <art>-hero.webp (its land and its figure) and <art>-emblem.png (its emblem, over its name plate).
const PATH_PICK = {
  knight: { art: 'bastion', combat: 'Melee', role: 'Defender', intro: 'A durable frontline fighter who protects allies and holds the line.',
    plus: 'Highest health and strong melee attacks.', minus: 'No ranged attacks.' },
  paladin: { art: 'hawk', combat: 'Ranged', role: 'Archer', intro: 'An archer who strikes from afar, with a falcon at their side.',
    plus: 'Long-range shots, Power Shot and volleys.', minus: 'Vulnerable in melee.' },
  sorcerer: { art: 'ember', combat: 'Magic', role: 'Spellcaster', intro: 'A spellcaster who burns whole packs with fire and energy.',
    plus: 'The most damage and the most mana.', minus: 'Fragile and mana‑dependent.' },
};
function maybeAskPath() {
  if (!player || player.vocation !== 'none' || player.trial || map.trialRooms || !$('pathPick').hidden) return;
  // (browser tests drive a character without a path, as before, unless they ask for the choice: ?pickpath)
  if (navigator.webdriver && !/[?&]pickpath\b/.test(location.search)) return;
  if (!$('create').hidden || !$('outfit').hidden || Intro.open || document.body.classList.contains('welcome')) return;
  if (typeof Preload !== 'undefined' && !Preload.ready) return; // (once the world is ready: not behind the loading screen)
  askPath();
}
// Choosing a path: SORTIA's vocation screen (css/sortia.css), after the owner's reference (docs/sortia/vocation-select.png):
// the title over a large picture of the path looked at, three cards under it (Hawk, Bastion, Ember: emblem and name),
// what the path is in a few lines, "Your choice is permanent." and one button, Choose Bastion (or Hawk, or Ember), that asks once more ("for
// good"). A tap on a card, a sideways swipe on the picture or the arrow keys go through the paths; looking chooses nothing.
let pathAt = 0;
const classArt = file => { const h = typeof SPRITE_HASHES !== 'undefined' && SPRITE_HASHES[`ui/classes/${file}`]; return `sprites/ui/classes/${file}${h ? `?h=${h}` : ''}`; };
const sortiaArt = file => { const h = typeof SPRITE_HASHES !== 'undefined' && SPRITE_HASHES[`ui/sortia/${file}`]; return `sprites/ui/sortia/${file}${h ? `?h=${h}` : ''}`; };
const withData = (el, d) => (Object.assign(el.dataset, d), el);
const SV_ORDER = ['paladin', 'knight', 'sorcerer']; // (the cards, left to right, as in the reference: Hawk, Bastion, Ember)
// the three pictures fetched ahead, while the story is told (welcomeScene calls this), so the screen opens with them
function preloadPathArt() {
  if (preloadPathArt.done) return; preloadPathArt.done = true;
  for (const f of [...Object.values(SV_SCENES).flatMap(s => [`${s.art}-scene.webp`, `${s.art}-hero.webp`]), ...SV_ORDER.map(v => `${PATH_PICK[v].art}-emblem.png`), 'button-primary.webp']) { const i = new Image(); i.decoding = 'async'; i.src = sortiaArt(f); }
}
// The paths' pictures: in layers, after the owner's light study (docs/sortia/bastion-motion: its timing in css/sortia.css):
// the land behind them (a fortress at dusk, a forest watchtower at sunset, a ruined observatory under the moon), drifting a
// little closer; a glow in its sky; the figure itself (a picture with no background), settling once as it comes; and a
// brighter copy of it, seen only through a moving spot, so light runs once over it inside its outline (Bastion: warm, from
// his right shoulder down to the lion on his shield; Hawk: the sunset's, from her hood over her shoulder to her hand on the
// bow; Ember: cold and arcane, from the crystal on his staff down to his hand). Nothing in it takes a tap.
// (where each figure stands is css/sortia.css's, after the owner's package: --portrait-top)
const SV_SCENES = { knight: { art: 'bastion' }, paladin: { art: 'hawk' }, sorcerer: { art: 'ember' } };
function layeredScene(v) {
  const art = SV_SCENES[v].art, img = cls => h('img', { className: cls, src: sortiaArt(`${art}-hero.webp`), alt: '', decoding: 'async', draggable: false });
  return withData(h('div', { className: 'vs-art vs-layered' }, h('div', { className: 'vs-depth' }), h('div', { className: 'vs-sun' }),
    h('div', { className: 'vs-figure' }, img('vs-hero-img'), img('vs-hero-img vs-hero-light'))), { art });
}
// a figure's light plays once each time it's looked at (not at all with reduced motion); it waits while the page is hidden
function playLayered(v) {
  const turn = playLayered.turn = (playLayered.turn || 0) + 1;
  const scene = document.querySelector(`.vs-layered[data-v="${v}"]`), still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // (the one going keeps moving while it fades; its light stops once it's gone)
  for (const other of document.querySelectorAll('.vs-layered')) if (other !== scene && other.classList.contains('play')) {
    other.classList.remove('enter'); other.classList.add('leave'); // (its figure steps back while the whole of it fades)
    setTimeout(() => { if (turn === playLayered.turn) other.classList.remove('play', 'leave'); }, 520);
  }
  if (!scene || still) { if (scene) scene.classList.remove('play', 'enter', 'leave'); return; }
  // (it starts at once, from its first frame: shown first and started after, it would jump)
  scene.classList.remove('play', 'enter', 'leave');
  void scene.offsetWidth; // (the animations start again from their beginning)
  scene.classList.add('play', 'enter');
}
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', () => { const p = $('pathPick'); if (p) p.dataset.paused = document.hidden ? 'true' : 'false'; });
function askPath(onDone, onBack) {
  const win = $('pathPick'), track = $('pathTrack'), hero = $('pathHero');
  const order = SV_ORDER.filter(v => START_PATHS.includes(v));
  if (!track.childElementCount) { // (the pictures and the cards, once)
    hero.replaceChildren(...order.map(v => withData(layeredScene(v), { v })));
    track.replaceChildren(...order.map(v => {
      const art = PATH_PICK[v].art, card = withData(h('button', { className: 'vs-card', type: 'button' },
        h('span', { className: 'vs-face' }, h('img', { src: sortiaArt(`${art}-emblem.png`), alt: '', width: 59, height: 59, draggable: false }), h('span', { className: 'vs-name' }, vocName(v)))), { v, art });
      card.onclick = () => show(START_PATHS.indexOf(v));
      return card;
    }));
  }
  // the words as tall as the longest path's at this width: the cards and the button stay put when you look at another
  function steady() {
    const box = $('pathInfo'); box.style.minHeight = '';
    let most = 0;
    for (const v of order) { words(v); most = Math.max(most, box.offsetHeight); }
    box.style.minHeight = `${most}px`;
    words(START_PATHS[pathAt]);
    fitPathScreen();
  }
  // the screen never scrolls: too tall for this phone, first its spacing tighter, then the cards come up over the figure
  // (to 45% of the width under the title at most), and only then the whole column narrows, everything in it smaller alike
  function fitPathScreen() {
    const screen = win.querySelector('.vs-screen'), sel = win.querySelector('.vs-selection');
    screen.style.width = ''; sel.style.removeProperty('--vs-gap'); screen.classList.remove('vs-tight');
    const over = () => screen.offsetHeight - win.clientHeight;
    if (over() <= 0) return;
    screen.classList.add('vs-tight');
    const gap = () => parseFloat(getComputedStyle(sel).marginTop);
    if (over() > 0) sel.style.setProperty('--vs-gap', `${Math.max(screen.clientWidth * 0.45, gap() - over())}px`);
    for (let k = 0; k < 4 && over() > 0; k++) {
      screen.style.width = `${Math.max(240, Math.floor(screen.clientWidth - over() * 0.6))}px`;
      sel.style.setProperty('--vs-gap', `${Math.max(screen.clientWidth * 0.45, gap() - over())}px`);
    }
  }
  function words(v) {
    const info = PATH_PICK[v];
    $('pathRole').textContent = `${info.combat} · ${info.role}`;
    $('pathIntro').textContent = info.intro;
    $('pathPlus').textContent = info.plus;
    $('pathMinus').textContent = info.minus;
  }
  // the path looked at (a tap on a card only shows it): its picture (a short cross-fade), its card lit, its words, the button
  function show(i) {
    const n = START_PATHS.length;
    pathAt = (i + n) % n;
    const v = START_PATHS[pathAt], was = hero.querySelector('.vs-art.on');
    for (const art of hero.children) art.classList.toggle('on', art.dataset.v === v);
    if (!was || was.dataset.v !== v) playLayered(v);
    for (const c of track.children) c.setAttribute('aria-pressed', c.dataset.v === v ? 'true' : 'false');
    words(v);
    const info = $('pathInfo'); if (was && was.dataset.v !== v) { info.classList.remove('vs-swap'); void info.offsetWidth; info.classList.add('vs-swap'); } // (the words come in again, a line after another)
    $('pathChoose').firstElementChild.textContent = `Choose ${vocName(v)}`; // (the way on names the path looked at)
    ask(false);
  }
  // the path left (step -1) or right (step 1) of the one looked at, in the cards' order
  const step = d => { const r = order.indexOf(START_PATHS[pathAt]); show(START_PATHS.indexOf(order[(r + d + order.length) % order.length])); };
  // the confirmation: Choose Bastion? ... Confirm Bastion (the game's own choosePath, once) or Go back (the focus back on
  // the button, the card still looked at). Confirmed, it waits for the game to take the path (online, the server's word)
  // before it goes on; if it doesn't come, it says so and the choice can be tried again.
  function ask(on, back) {
    const v = START_PATHS[pathAt], box = $('pathAsk'), was = !box.hidden;
    box.hidden = !on;
    if (!on) { if (was && back) $('pathChoose').focus({ preventScroll: true }); return; }
    const name = vocName(v), yes = h('button', { className: 'vs-btn', type: 'button' }, `Confirm ${name}`), no = h('button', { className: 'vs-go vs-quiet', type: 'button' }, 'Go back');
    const err = h('p', { className: 'vs-error', hidden: true }, 'That didn’t go through. Please try again.');
    let sent = false;
    yes.onclick = () => {
      if (sent) return; sent = true; yes.disabled = no.disabled = true; err.hidden = true;
      Actions.choosePath(v);
      const began = performance.now();
      const done = () => {
        box.hidden = true; win.hidden = true;
        if (!document.body.classList.contains('welcome')) welcomeScene(false);
        if (onDone) onDone();
      };
      (function wait() {
        if (player.vocation === v) return done();
        if (performance.now() - began > 8000) { sent = false; yes.disabled = no.disabled = false; err.hidden = false; return; }
        setTimeout(wait, 100);
      })();
    };
    no.onclick = () => ask(false, true);
    box.replaceChildren(h('div', { className: 'vs-dialog' },
      h('h3', { id: 'pathAskTitle' }, `Choose ${name}?`), h('p', { id: 'pathAskText' }, 'You won’t be able to change this character’s vocation after confirming.'), err,
      h('div', { className: 'vs-dialog-row' }, yes, no)));
    box.setAttribute('aria-describedby', 'pathAskText');
    no.focus({ preventScroll: true });
  }
  $('pathChoose').onclick = () => ask(true);
  $('pathBack').hidden = !onBack;
  $('pathBack').onclick = () => { if (!onBack) return; win.hidden = true; $('pathAsk').hidden = true; onBack(); };
  // (a sideways swipe on the picture goes to the path beside it)
  let sx = null, sy = null;
  const screen = win.querySelector('.vs-screen');
  screen.ontouchstart = e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; };
  screen.ontouchend = e => {
    if (sx === null || e.target.closest('button')) { sx = null; return; }
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 1.2) step(dx < 0 ? 1 : -1);
  };
  // (the arrow keys go through the paths while they're shown, wherever the focus is; Escape takes back the question)
  askPath.keys = e => {
    if (!$('pathAsk').hidden) { if (e.key === 'Escape') { ask(false, true); e.stopPropagation(); } return; }
    if (e.key === 'ArrowRight') { step(1); e.preventDefault(); e.stopPropagation(); }
    else if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); e.stopPropagation(); }
  };
  askPath.step = step;
  if (!askPath.listening) { askPath.listening = true; addEventListener('keydown', e => { if (!$('pathPick').hidden && askPath.keys) askPath.keys(e); }, true); }
  if (!document.body.classList.contains('welcome')) welcomeScene('paths'); // (a character from before the paths: the hall, too)
  if (!askPath.sized) { askPath.sized = true; addEventListener('resize', () => { if (!$('pathPick').hidden && askPath.steady) askPath.steady(); }); }
  askPath.steady = steady;
  win.hidden = false;
  for (const art of hero.children) art.classList.remove('on'); // (the light plays again each time the screen opens)
  show(pathAt);
  steady();
  if (document.fonts) document.fonts.ready.then(() => { if (!win.hidden) steady(); }); // (again once Inter is in)
}

// ---- the skill tree (creatures.js TREES, docs/skills-plan.md) ----------------------------------------------------------
// Its lines one under the other, each a row of its tiers' icons (rank 2/3, a lock and the level while shut), the passives
// under them; tap one and its card shows what it does now and next, what it needs, and the one button to learn it.
let treePick = null;
function openSkillTree() {
  if (!TREES[player.vocation]) return;
  if (!treePick || !(treeSpot(treePick) || treePassive(player.vocation, treePick))) treePick = TREES[player.vocation].lines[0].tiers[0];
  $('skillTree').hidden = false;
  renderSkillTree();
}
function renderSkillTree() {
  const tree = TREES[player.vocation];
  if (!tree || $('skillTree').hidden) return;
  const n = treePoints(player);
  $('treeTitle').textContent = `${vocName(player.vocation)} skill tree`;
  $('treePoints').textContent = `${n} point${n === 1 ? '' : 's'}`;
  $('treePoints').classList.toggle('has-points', n > 0);
  const icon = (id, label, max, opens) => {
    const r = rankOf(player, id), why = cantLearn(player, id), shut = opens && player.level < opens;
    const b = h('button', { className: `tree-icon${r ? ' learned' : ''}${!why ? ' can' : ''}${shut ? ' shut' : ''}${treePick === id ? ' picked' : ''}` });
    const art = typeof ActionSlots !== 'undefined' && ActionSlots.art(id);
    b.appendChild(art ? Object.assign(new Image(), { src: art, alt: '', className: 'tree-art' })
      : h('span', { className: 'tree-initials' }, label.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()));
    b.appendChild(h('small', { className: 'tree-rank' }, shut ? `Lv ${opens}` : `${r}/${max}`));
    b.title = label;
    b.addEventListener('click', () => { treePick = id; renderSkillTree(); });
    return b;
  };
  const rows = tree.lines.map(line => h('div', { className: 'tree-line' }, h('span', { className: 'tree-name' }, line.name),
    h('div', { className: 'tree-tiers' }, ...line.tiers.map((id, t) => icon(id, SPELLS[id].name, TREE_RANKS, TREE_LEVELS[t])))));
  rows.push(h('div', { className: 'tree-line passive' }, h('span', { className: 'tree-name' }, 'Passive'),
    h('div', { className: 'tree-tiers' }, ...tree.passives.map(q => icon(q.id, q.name, q.max, TREE_FROM)))));
  $('treeLines').replaceChildren(...rows);
  // the card of the one picked
  const id = treePick, s = SPELLS[id], q = treePassive(player.vocation, id), spot = treeSpot(id), r = rankOf(player, id);
  const max = q ? q.max : TREE_RANKS, why = cantLearn(player, id), cost = rankCost(id);
  const what = [];
  if (s) {
    what.push(h('p', { className: 'tree-desc' }, s.desc));
    what.push(h('p', { className: 'tree-facts' }, [`${s.mana} mana`, s.cooldown ? `ready again after ${s.cooldown / 1000} s` : '', spot.line.weapon === 'bow' ? 'needs a bow or crossbow' : '',
      `tier ${spot.tier + 1}, opens at level ${TREE_LEVELS[spot.tier]}`].filter(Boolean).join(' · ')));
    what.push(h('p', { className: 'tree-facts' }, r ? `Rank ${r}: ${Math.round(rankPower(player, id) * 100)}% power${r < max ? `; rank ${r + 1}: ${Math.round((1 + RANK_POWER * r) * 100)}%` : ''}.`
      : 'Rank 1: its full power; each rank after it, 15% more.'));
  } else {
    what.push(h('p', { className: 'tree-desc' }, q.desc));
    what.push(h('p', { className: 'tree-facts' }, `Now: +${Math.round(q.per * r * 100)}%${r < max ? ` · next rank: +${Math.round(q.per * (r + 1) * 100)}%` : ''}`));
  }
  const learn = h('button', { className: 'primary tree-learn' }, r >= max ? 'Learned to its last rank' : `${r ? 'Next rank' : 'Learn'} (${cost} point${cost > 1 ? 's' : ''})`);
  learn.disabled = !!why;
  learn.addEventListener('click', () => { Actions.learnRank(id); });
  $('treeCard').replaceChildren(h('div', { className: 'tree-card-head' }, h('b', {}, s ? s.name : q.name), h('span', {}, `rank ${r} / ${max}`)),
    ...what, why && r < max ? h('p', { className: 'tree-why' }, why) : '', learn);
  // starting over
  const spent = treePointsSpent(player), resetCost = player.treeResets ? player.level * 50 : 0;
  $('treeReset').textContent = spent ? `Start over (${resetCost ? `${resetCost} gold` : 'free the first time'})` : 'Start over';
  $('treeReset').disabled = !spent;
}

// The Book of Paths: the four paths side by side, with the stamps of the trials you've done (game-paths.js)
function showPaths() {
  const stamps = player.paths || {};
  $('pathCards').replaceChildren(...PATH_IDS.map(v => {
    const P = PATHS[v], card = h('div', { className: `path-card${player.vocation === v ? ' mine' : ''}` },
      h('h3', {}, vocName(v)), h('p', { className: 'role' }, `${capitalize(VOCATIONS[v].role)}.`),
      h('p', {}, P.forYou), h('p', {}, h('b', {}, 'Fights with: '), P.weapons),
      h('p', {}, h('b', {}, 'Strong: '), P.strong), h('p', {}, h('b', {}, 'Weak: '), P.weak),
      h('p', {}, h('b', {}, 'Teacher: '), NPCS[P.teacher].name));
    card.style.setProperty('--path', P.colour);
    if (stamps[v]) card.prepend(h('span', { className: 'stamp' }, 'tried'));
    return card;
  }));
  const n = PATH_IDS.filter(v => stamps[v]).length;
  $('pathsNote').textContent = player.vocation !== 'none' ? `You walk the path of the ${vocName(player.vocation)}.`
    : n === 4 ? 'All four tried! Tell the Pathkeeper which one made you grin, and she lets you choose it.'
      : `Try each path with its teacher in the Hall of Paths (${n} of 4 tried). Once you've tried all four, the Pathkeeper lets you choose: it can't be undone.`;
  $('paths').hidden = false;
}

// ---- hotkeys (F1-F12) ------------------------------------------------------------------
function openHotkeys() {
  if (document.body.classList.contains('touch-ui')) return; // (F1-F12 are a keyboard's: a phone has its action bar)
  const root = $('hotkeyList');
  root.replaceChildren();
  const options = [['', '(nothing)']];
  for (const id of spellsFor(player.vocation)) options.push([`spell:${id}`, `Spell: ${SPELLS[id].name}`]);
  for (const id of Object.keys(ITEMS)) {
    const d = ITEMS[id];
    if (d.use) options.push([`item:${id}`, `Use: ${d.name}`]);
    if (d.rune) options.push([`rune:${id}`, `Rune on target: ${d.name}`]);
  }
  options.push(['say', 'Say...']);
  for (let i = 1; i <= 12; i++) {
    const key = `F${i}`, h = player.hotkeys[key] || {};
    const row = document.createElement('div');
    row.className = 'hotkey-row';
    const label = document.createElement('kbd');
    label.textContent = key;
    const select = document.createElement('select');
    select.dataset.key = key;
    for (const [value, text] of options) select.add(new Option(text, value));
    select.value = h.type === 'say' ? 'say' : h.type ? `${h.type}:${h.id}` : '';
    const text = document.createElement('input');
    text.placeholder = 'text to say';
    text.value = h.text || '';
    text.hidden = select.value !== 'say';
    select.addEventListener('change', () => { text.hidden = select.value !== 'say'; });
    row.append(label, select, text);
    root.appendChild(row);
  }
  $('hotkeys').hidden = false;
}

function saveHotkeys() {
  const hotkeys = {};
  for (const row of $('hotkeyList').children) {
    const select = row.querySelector('select'), text = row.querySelector('input');
    if (!select.value) continue;
    if (select.value === 'say') hotkeys[select.dataset.key] = { type: 'say', text: text.value };
    else {
      const [type, id] = select.value.split(':');
      hotkeys[select.dataset.key] = { type, id };
    }
  }
  Actions.setHotkeys(hotkeys);
  $('hotkeys').hidden = true;
}

// ---- settings kept in this browser ---------------------------------------------------------
function loadSetting(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(`tilequest.${key}`));
    return v === null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}
function saveSetting(key, value) {
  try {
    localStorage.setItem(`tilequest.${key}`, JSON.stringify(value));
  } catch (e) { /* not remembered */ }
}
// Right-click on a monster or player: a menu (follow, attack, look...), or straight to
// the attack, as with Tibia's classic controls (Ctrl+click still opens the menu then).
let rightClickAttacks = loadSetting('rightClickAttacks', false);

// ---- outfit ------------------------------------------------------------------------------
// As in Tibia: pick an outfit and its cut, colour its four parts (head, primary,
// secondary, detail) from a palette of 133 colours, and wear the addons your level allows.
const OUTFIT_PARTS = [['hair', 'Head'], ['body', 'Primary'], ['legs', 'Secondary'], ['feet', 'Detail']];
const OUTFIT_COLORS = (() => {
  const hex = (r, g, b) => `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  const hsl = (h, s, l) => { // hue in degrees, saturation and lightness 0..1
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = n => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
    return hex(f(0), f(8), f(4));
  };
  const rows = [[0.3, 0.86], [0.55, 0.74], [0.8, 0.62], [0.95, 0.5], [0.85, 0.38], [0.7, 0.27], [0.55, 0.16]];
  const colors = [];
  rows.forEach(([sat, light], row) => {
    const v = 255 * (1 - row / 6);
    colors.push(hex(v, v, v));
    for (let i = 0; i < 18; i++) colors.push(hsl(i * 20, sat, light));
  });
  return colors;
})();
let outfitDraft = {}, outfitPart = 'body', outfitHue = null, outfitDir = 0;
// The colours are a grid: 7 shades (rows, light to dark) of 19 hues (columns: grey, then 18 round the wheel). They're
// chosen in two steps: a hue, then one of its shades, with every one of the 133 still there.
const HUES = 19, SHADES = OUTFIT_COLORS.length / HUES;
const hueOf = color => { const i = OUTFIT_COLORS.indexOf(color); return i < 0 ? null : i % HUES; };
// the preview turns through the four ways a figure faces: towards you, to one side, away, the other side
const OUTFIT_TURN = [2, 1, 0, 3];

function openOutfit(onDone) {
  document.body.classList.remove('panel-open'); // on a phone: the drawer makes way
  outfitDraft = { ...player.outfit }; // no type chosen: you wear your vocation's outfit
  outfitHue = null; outfitDir = 0;
  const making = document.body.classList.contains('welcome'); // (a new character, or the outfit window in the game)
  $('outfitTitle').textContent = making ? 'Create your appearance' : 'Choose your outfit';
  if (making) ParchmentPanel.decorate($('outfit'), { scroll: true }); else ParchmentPanel.undecorate($('outfit')); // (the game's own look in the game)
  $('outfitDone').textContent = making ? 'Continue' : 'Done';
  renderOutfit();
  let sent = false; // (once: a double tap goes on once)
  $('outfitDone').onclick = () => {
    if (sent) return; sent = true;
    Actions.setOutfit(outfitDraft);
    $('outfit').hidden = true;
    const view = $('viewport'); if (view.scrollTop || view.scrollLeft) view.scrollTo(0, 0); // (the map never scrolls: put back what bringing the window in sight moved)
    if (onDone) onDone();
  };
  const turn = d => { outfitDir = (outfitDir + d + 4) % 4; drawOutfitPreview(); };
  $('outfitTurnL').onclick = () => turn(-1);
  $('outfitTurnR').onclick = () => turn(1);
  $('outfitPreview').onclick = () => turn(1);
  $('outfit').hidden = false;
}

function renderOutfit() {
  const types = Object.keys(OUTFITS), allowed = allowedAddons(player.level);
  const type = outfitDraft.type || VOCATION_OUTFIT[player.vocation] || 'citizen';
  const turn = d => {
    outfitDraft.type = types[(types.indexOf(type) + d + types.length) % types.length];
    renderOutfit();
  };
  const root = $('outfitParts');
  root.replaceChildren();
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const section = title => { const sec = el('section', 'outfit-sec'); sec.appendChild(el('h4', 'outfit-sec-title', title)); root.appendChild(sec); return sec; };
  // the outfit and its cut
  const look = section('Outfit');
  const row = el('div', 'outfit-type');
  const prev = el('button', 'outfit-step', '◀'), next = el('button', 'outfit-step', '▶');
  prev.setAttribute('aria-label', 'Previous outfit'); next.setAttribute('aria-label', 'Next outfit');
  prev.onclick = () => turn(-1);
  next.onclick = () => turn(1);
  row.append(prev, el('b', 'outfit-name', OUTFITS[type].name), next);
  look.appendChild(row);
  const sex = el('div', 'outfit-sex');
  for (const [female, label] of [[false, 'Male'], [true, 'Female']]) {
    const b = el('button', !!outfitDraft.female === female ? 'active' : '', label);
    b.setAttribute('aria-pressed', !!outfitDraft.female === female ? 'true' : 'false');
    b.onclick = () => { outfitDraft.female = female; renderOutfit(); };
    sex.appendChild(b);
  }
  look.appendChild(sex);
  // its addons: those your level allows can be ticked; the rest show the level they open at
  const addons = el('div', 'outfit-addons');
  OUTFITS[type].addons.forEach((name, i) => {
    const bit = 1 << i, open = !!(allowed & bit), label = el('label', open ? 'outfit-addon' : 'outfit-addon locked'), box = el('input');
    box.type = 'checkbox';
    box.disabled = !open;
    box.checked = !!(outfitDraft.addons & bit) && open;
    box.onchange = () => { outfitDraft.addons = ((outfitDraft.addons | 0) & ~bit) | (box.checked ? bit : 0); drawOutfitPreview(); };
    label.append(box, el('span', '', capitalize(name)));
    if (!open) label.append(el('small', 'outfit-lock', `Level ${ADDON_LEVELS[i]}`));
    addons.appendChild(label);
  });
  look.appendChild(addons);
  // cosmetics you've bought from the watch's stores (Captain Osric, for watch marks): one feather and one cloak at a time
  const owned = (player.cosmetics || []).filter(id => COSMETICS[id]);
  if (owned.length) {
    const row = el('div', 'outfit-cosmetics');
    for (const kind of ['feather', 'cloak']) {
      const mine = owned.filter(id => COSMETICS[id].kind === kind);
      if (!mine.length) continue;
      const pick = el('select');
      pick.append(new Option(`no ${kind}`, ''), ...mine.map(id => new Option(capitalize(COSMETICS[id].name), id)));
      pick.value = outfitDraft[kind] || '';
      pick.onchange = () => { outfitDraft[kind] = pick.value || undefined; drawOutfitPreview(); };
      const label = el('label', '', `${capitalize(kind)}: `);
      label.appendChild(pick);
      row.appendChild(label);
    }
    look.appendChild(row);
  }
  // colours: which part (its colour on its button), then a hue (taken at once), then, if you like, one of its shades
  const colours = section('Colours');
  const parts = el('div', 'outfit-parts');
  for (const [part, label] of OUTFIT_PARTS) {
    const b = el('button', part === outfitPart ? 'active' : '');
    b.setAttribute('aria-pressed', part === outfitPart ? 'true' : 'false');
    const dot = el('i', 'outfit-dot'); dot.style.background = outfitDraft[part] || '#888';
    b.append(dot, el('span', '', label));
    b.onclick = () => { outfitPart = part; outfitHue = null; renderOutfit(); };
    parts.appendChild(b);
  }
  colours.appendChild(parts);
  const current = outfitDraft[outfitPart];
  if (outfitHue === null) outfitHue = hueOf(current) ?? 0;
  const hues = el('div', 'outfit-hues');
  for (let c = 0; c < HUES; c++) {
    const b = el('button', `swatch-color hue${c === outfitHue ? ' active' : ''}`);
    b.style.background = OUTFIT_COLORS[3 * HUES + c]; // (each hue shown at its middle shade)
    b.title = c === 0 ? 'Greys' : `Hue ${c}`;
    b.setAttribute('aria-label', b.title);
    b.onclick = () => { outfitHue = c; outfitDraft[outfitPart] = OUTFIT_COLORS[3 * HUES + c]; renderOutfit(); }; // (taken at once, at its middle shade; a shade below changes it)
    hues.appendChild(b);
  }
  colours.appendChild(hues);
  const shades = el('div', 'outfit-shades');
  for (let r = 0; r < SHADES; r++) {
    const color = OUTFIT_COLORS[r * HUES + outfitHue];
    const b = el('button', `swatch-color shade${current === color ? ' active' : ''}`);
    b.style.background = color;
    b.title = color;
    b.setAttribute('aria-label', `Shade ${r + 1}${current === color ? ' (chosen)' : ''}`);
    b.onclick = () => { outfitDraft[outfitPart] = color; renderOutfit(); };
    shades.appendChild(b);
  }
  colours.appendChild(shades);
  drawOutfitPreview();
}

// The preview: one big figure walking, facing the way it's turned (the arrows, or a tap on it), and the four ways as marks.
let outfitTimer = null;
function drawOutfitPreview() {
  const c = $('outfitPreview'), g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, c.width, c.height);
  const frame = [0, 1, 0, 2][Math.floor(performance.now() / 250) % 4], dir = OUTFIT_TURN[outfitDir];
  const img = Sprites.creature(Sprites.playerKey(player.vocation, outfitDraft), dir, frame), r = img.res || 1;
  // (a tall figure's picture is two tiles square: its own tile, feet on the bottom; a small one fills the frame)
  if (Sprites.w(img) > TILE) { const s = Math.floor(c.height / 52); g.drawImage(img, TILE * r, 12 * r, TILE * r, 52 * r, (c.width - TILE * s) / 2, c.height - 52 * s, TILE * s, 52 * s); }
  else { const s = Math.floor(c.width / TILE); g.drawImage(img, 0, 0, TILE * r, TILE * r, (c.width - TILE * s) / 2, c.height - TILE * s, TILE * s, TILE * s); }
  const dirs = $('outfitDirs');
  if (dirs.childElementCount !== 4) dirs.replaceChildren(...[0, 1, 2, 3].map(() => document.createElement('i')));
  [...dirs.children].forEach((d, i) => d.classList.toggle('on', i === outfitDir));
  clearTimeout(outfitTimer);
  if (!$('outfit').hidden) outfitTimer = setTimeout(drawOutfitPreview, 250);
}

// ---- minimap and world map --------------------------------------------------------------------
const GROUND_COLORS = {
  grass: '#4a8a3c', dirt: '#8b6b42', sand: '#d8c690', cobble: '#8a8a8e', marble: '#d8d4cc', wood: '#9a6a3a',
  cave: '#6a5e52', swamp: '#4a5a30', roof: '#9e4436', water: '#2d63b5', mountain: '#857a6a', carpet: '#8a1a22',
  bridge_ns: '#8a5a2e', bridge_ew: '#8a5a2e', paving: '#a8a49a', brick: '#9a4a3a', tiles: '#c8b8a0', gravel: '#9a968e', farmland: '#6a4a2a',
  roof_slate: '#5c6476', roof_thatch: '#c4a056', roof_shingle: '#785232', roof_green: '#46785c', roof_flat: '#d6ba82',
  snow: '#e8eef4', ice: '#b8d6e8', jungle: '#2f6a2a', sandstone: '#c8a868', ash: '#4a4644', lava: '#d04a18',
  crypt: '#4a4c54', pit: '#0a0806', sewer: '#5e6458', sewer_water: '#2c4630', sewer_bridge_ns: '#8a5a2e', sewer_bridge_ew: '#8a5a2e',
};
const WALL_COLORS = {
  wall_stone: '#5a5a60', wall_temple: '#8a8478', wall_rampart: '#9a8466', wall_block: '#5a5a60', wall_secret: '#5a5a60', wall_wood: '#5e4026', wall_cave: '#3a322c', wall_sewer: '#3a3c36', wall_crypt: '#2e2e34', wall_sandstone: '#9a7a48',
  cliff: '#5e5446', tree: '#1f4f22', pine: '#1a4426', snow_pine: '#2a5a4a', jungle_tree: '#163a12', palm: '#3a7a2a', dead_tree: '#3a3028',
};

// The minimap painted as the world is: the colours of the game's own ground pictures (their average), a little
// lighter, so the map reads as the same land; high things (walls, rock, roofs, trees) cast a shadow down-right as the
// light from the top left does in the game; shallows along the shores; a faint grain so it looks painted, not flat
const PAINTED = {
  grass: '#62792c', dirt: '#86643f', sand: '#e0c592', cobble: '#7d705c', marble: '#e3d3c2', wood: '#8a6139', cave: '#55493c',
  swamp: '#5f5430', roof: '#8a4a30', water: '#2e6670', mountain: '#7a7262', carpet: '#a8432e', bridge_ns: '#93623a', bridge_ew: '#93623a',
  paving: '#c9b08a', brick: '#8f4a36', tiles: '#b06c46', gravel: '#968a76', farmland: '#55402a', roof_slate: '#5d6679',
  roof_thatch: '#bb8836', roof_shingle: '#835b38', roof_green: '#365e4b', roof_flat: '#c8b184', jungle: '#356f30', crypt: '#575a52',
  sewer: '#4a412f', sewer_water: '#44452a', temple_paving: '#cbb894', rock_top: '#8e8c84', steps_top: '#a89c86', ramp_top: '#7d7262',
};
const PAINTED_THINGS = {
  tree: '#3f5718', pine: '#33521a', bush: '#4c6a22', cliff: '#6d6a5d', wall_stone: '#7d715b', wall_wood: '#5f4d36', wall_rampart: '#a08e69',
  wall_temple: '#978a6d', wall_cave: '#463e33', wall_crypt: '#3a3b38', wall_sewer: '#3f4034', door: '#c8a060', door_house: '#c8a060',
};
const HIGH = new Set(['tree', 'pine', 'snow_pine', 'jungle_tree', 'palm', 'cliff', 'wall_stone', 'wall_wood', 'wall_rampart', 'wall_temple', 'wall_cave',
  'wall_crypt', 'wall_sewer', 'wall_block', 'wall_sandstone']);
const isHigh = t => !!t && (t.items.some(id => HIGH.has(id)) || (THINGS[t.ground] && THINGS[t.ground].roof));
const isWet = t => !!t && (t.ground === 'water' || t.ground === 'sewer_water');
const mix = (n, m, k) => [0, 8, 16].reduce((v, sh) => v | (Math.round(((n >> sh) & 255) * (1 - k) + ((m >> sh) & 255) * k) << sh), 0);
const shadeOf = (n, k) => mix(n, 0x0e0a06, k), lighten = (n, k) => mix(n, 0xf4ecd8, k);
// a tile's painted colour, as a number, with its neighbours' shade and the shallows (null: nothing there)
// (above ground a tile is seen as the highest thing over it, a few floors up: the land from the sky, the houses roofed,
// the temple on its mount, the wall's walkway and its towers; underground, the floor itself)
const seenTile = (x, y, z) => {
  if (z >= map.surfaceZ) for (let up = Math.min(map.depth - 1, z + 3); up > z; up--) { const u = map.get(x, y, up); if (u && u.ground) return u; }
  return map.get(x, y, z);
};
function paintedColor(x, y, z, plain = false) {
  const t = seenTile(x, y, z);
  if (!t) return null;
  let hex = null;
  for (let i = t.items.length - 1; i >= 0 && !hex; i--) {
    const id = t.items[i], def = THINGS[id];
    if (def.change || def.ropeSpot || def.teleport) return 0xf0c850; // (ways up and down: gold, as before)
    hex = PAINTED_THINGS[id] || WALL_COLORS[id] || (def.block && !def.low ? '#6e5f48' : null);
  }
  hex = hex || PAINTED[t.ground] || GROUND_COLORS[t.ground];
  if (!hex) return null;
  let n = parseInt(hex.slice(1), 16);
  const at = (dx, dy) => seenTile(x + dx, y + dy, z);
  if (isWet(t)) { // shallows: lighter beside the land, deeper away from it
    const land = [[0, -1], [-1, 0], [1, 0], [0, 1]].some(([dx, dy]) => { const o = at(dx, dy); return o && !isWet(o); });
    if (land) n = lighten(n, 0.18);
  } else if (!isHigh(t)) { // in the shadow of what stands up-left of it
    if (!plain && (isHigh(at(-1, -1)) || isHigh(at(0, -1)) || isHigh(at(-1, 0)))) n = shadeOf(n, 0.22);
  } else if (!isHigh(at(-1, 0)) || !isHigh(at(0, -1))) n = lighten(n, 0.1); // (and its lit edge, top left)
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263); // (a faint grain: each tile a shade lighter or darker)
  h = Math.imul(h ^ (h >>> 13), 1274126177); h = (h ^ (h >>> 16)) >>> 0;
  return h % 4 === 0 ? lighten(n, 0.04) : h % 4 === 1 ? shadeOf(n, 0.05) : n;
}

// The same, finer: eight pixels a tile, for the map seen close (minimap.fine, drawn at a zoom of 3 and more). Trees are
// round crowns lit on their top left, roofs and walls have a dark edge where they end, and what stands up casts a thin
// shadow on the tiles down-right of it instead of darkening them all. Made per floor the first time it's looked at.
const FINE = 8;
const isRoofT = t => !!t && THINGS[t.ground] && THINGS[t.ground].roof;
const isTreeId = id => ['tree', 'pine', 'snow_pine', 'jungle_tree', 'palm', 'bush', 'dead_tree'].includes(id);
// (put(px, py, colour, alpha): writes one of the tile's FINE x FINE pixels, wherever the caller keeps them)
function paintFineTile(put, x, y, z) {
  const t = seenTile(x, y, z), at = (dx, dy) => seenTile(x + dx, y + dy, z);
  if (!t) { for (let py = 0; py < FINE; py++) for (let px = 0; px < FINE; px++) put(px, py, 0, 0); return; }
  const tree = t.items.find(isTreeId), whole = paintedColor(x, y, z);
  // the ground under a tree (its crown drawn over it), or the tile's own colour
  const groundHex = PAINTED[t.ground] || GROUND_COLORS[t.ground];
  let base = tree && groundHex ? parseInt(groundHex.slice(1), 16) : whole;
  if (base === null) { for (let py = 0; py < FINE; py++) for (let px = 0; px < FINE; px++) put(px, py, 0, 0); return; }
  const high = isHigh(t) && !tree, wet = isWet(t);
  if (!high && !wet && !tree) base = paintedColor(x, y, z, true); // (the plain colour: its shade is drawn as a band below)
  for (let py = 0; py < FINE; py++) for (let px = 0; px < FINE; px++) {
    let h = Math.imul(x * FINE + px, 374761393) + Math.imul(y * FINE + py, 668265263); // (a well-mixed hash: no pattern)
    h = Math.imul(h ^ (h >>> 13), 1274126177); h = (h ^ (h >>> 16)) >>> 0;
    const k = h % 9;
    put(px, py, k === 0 ? lighten(base, 0.05) : k === 1 ? shadeOf(base, 0.06) : base);
  }
  if (!high && !wet && !tree) { // the shadow of what stands up-left: a band along the top and the left
    const n = isHigh(at(0, -1)), w = isHigh(at(-1, 0)), nw = isHigh(at(-1, -1));
    const b = Math.round(FINE * 0.4), step = 0.28 / b; // (the band: two fifths of the tile, fading out)
    for (let py = 0; py < b; py++) for (let px = 0; px < FINE; px++) {
      const k = (n ? 0.28 - py * step : 0) + (w && px < b ? 0.28 - px * step : 0) + (nw && px < b ? 0.15 : 0);
      if (k > 0) put(px, py, shadeOf(base, Math.min(0.4, k)));
    }
    if (w) for (let py = b; py < FINE; py++) for (let px = 0; px < b; px++) {
      const k = 0.28 - px * step;
      if (k > 0) put(px, py, shadeOf(base, Math.min(0.4, k)));
    }
  }
  if (high) { // a dark edge where it ends on the down-right (its side in the shade), a lit one up-left
    const same = (dx, dy) => { const u = at(dx, dy); return isRoofT(t) ? isRoofT(u) : isHigh(u); };
    for (let i = 0; i < FINE; i++) {
      if (!same(1, 0)) put(FINE - 1, i, shadeOf(base, 0.35));
      if (!same(0, 1)) put(i, FINE - 1, shadeOf(base, 0.35));
      if (!same(-1, 0)) put(0, i, lighten(base, 0.12));
      if (!same(0, -1)) put(i, 0, lighten(base, 0.12));
    }
  }
  if (tree) { // a round crown, lit on its top left
    const c = parseInt((PAINTED_THINGS[tree] || WALL_COLORS[tree] || '#3f5718').slice(1), 16);
    for (let py = 0; py < FINE; py++) for (let px = 0; px < FINE; px++) {
      const m = (FINE - 1) / 2, dx = px - m, dy = py - m, r = Math.hypot(dx, dy);
      if (r > FINE * 0.52) continue;
      put(px, py, dx + dy < -FINE * 0.3 ? lighten(c, 0.18) : dx + dy > FINE * 0.38 ? shadeOf(c, 0.25) : c);
    }
  }
}
// (made between frames, a band of rows at a time, so the first look close never stops the game; null until it's done)
function fineLayer(z) {
  const have = minimap.fine[z];
  if (have) return have.done ? have : null;
  const c = document.createElement('canvas'), W = map.width * FINE, seen = minimap.explored[z];
  c.width = W; c.height = map.height * FINE;
  minimap.fine[z] = c;
  const g = c.getContext('2d'), ROWS = 4;
  for (let y0 = 0; y0 < map.height; y0 += ROWS) Render.chores.push(() => {
    if (minimap.fine[z] !== c) return; // (repainted meanwhile: a new one is being made)
    const rows = Math.min(ROWS, map.height - y0), img = g.createImageData(W, rows * FINE), d = img.data;
    for (let y = y0; y < y0 + rows; y++) for (let x = 0; x < map.width; x++) {
      if (!seen[y * map.width + x]) continue;
      const o = ((y - y0) * FINE * W + x * FINE) * 4;
      paintFineTile((px, py, n, a = 255) => { const i = o + (py * W + px) * 4; d[i] = n >> 16; d[i + 1] = (n >> 8) & 255; d[i + 2] = n & 255; d[i + 3] = a; }, x, y, z);
    }
    g.putImageData(img, 0, y0 * FINE);
    if (y0 + rows >= map.height) { c.done = true; if (typeof drawMinimap === 'function' && player) drawMinimap(); }
  });
  return null;
}

function minimapColor(t) {
  if (!t) return null;
  for (let i = t.items.length - 1; i >= 0; i--) {
    const id = t.items[i], def = THINGS[id];
    if (def.change || def.ropeSpot || def.teleport) return '#ffe040';
    if (WALL_COLORS[id]) return WALL_COLORS[id];
    if (def.block) return '#7a6a50';
  }
  return GROUND_COLORS[t.ground] || null;
}

// Testing phase: everyone knows the whole map. Set to false to explore it bit by bit again.
const REVEAL_MAP = true;
const minimap = { zoom: 2, viewZ: null, explored: [], layers: [], fine: [], lastPos: '', whole: false, view: null, pan: { x: 0, y: 0 } };
// pan: how far (in tiles) the map has been dragged off you; back to 0 when it's opened again or zoomed
// viewZ: floor looked at, or null for yours; whole: the whole world fitted in (the phone's drawer: its Map button);
// view: where the last drawing put the map ({ scale, ox, oy }), for telling which tile a tap is on
// Start the explored map over, sized to the current map (also when the server plays another map).
function resetMinimap() {
  minimap.explored = Array.from({ length: map.depth }, () => new Uint8Array(map.width * map.height));
  minimap.layers = Array.from({ length: map.depth }, () => {
    const c = document.createElement('canvas');
    c.width = map.width;
    c.height = map.height;
    return c;
  });
  mapPlaces = null;
  if (REVEAL_MAP) repaintMinimap();
}

// The page plays another map now (the server's): start the explored map over if
// it's another size, else draw what was explored again from the new tiles.
function fitMinimap() {
  const layer = minimap.layers[0];
  if (minimap.layers.length !== map.depth || layer.width !== map.width || layer.height !== map.height) return resetMinimap();
  mapPlaces = null;
  repaintMinimap();
}

// Draw the explored map again, a floor at a time (all of it while REVEAL_MAP is on).
function repaintMinimap() {
  minimap.fine = []; // (made again when next looked at close)
  for (let z = 0; z < map.depth; z++) {
    const floor = map.floors[z], seen = minimap.explored[z], g = minimap.layers[z].getContext('2d');
    if (REVEAL_MAP) seen.fill(1);
    if (!floor.some(Boolean)) {
      g.clearRect(0, 0, map.width, map.height);
      continue;
    }
    const img = g.createImageData(map.width, map.height), d = img.data;
    for (let i = 0; i < floor.length; i++) {
      const n = seen[i] && floor[i] ? paintedColor(i % map.width, (i / map.width) | 0, z) : null;
      if (n === null) continue;
      d[i * 4] = n >> 16;
      d[i * 4 + 1] = (n >> 8) & 255;
      d[i * 4 + 2] = n & 255;
      d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
}

// Useful places, from the map's people: temples, shops, banks, ships, quest givers, and the towns.
// They show on the maps once you have explored them.
const PLACE_ICONS = { temple: ['✚', '#8fe0ff'], shop: ['$', '#ffd84a'], bank: ['¤', '#ffd84a'], ship: ['⚓', '#a8d0ff'], quest: ['!', '#ff9a30'], cart: ['⛏', '#d0d0d0'] };
let mapPlaces = null, builtinWorld = !customMap; // builtinWorld: playing the world from default-map.js
function placesOnMap() {
  if (mapPlaces) return mapPlaces;
  mapPlaces = [];
  for (const n of map.npcs) {
    const def = NPCS[n.type];
    if (!def) continue;
    const services = Object.values(def.keywords || {}).filter(v => v && typeof v === 'object');
    const has = k => services.some(v => v[k]);
    const kind = has('travel') ? 'ship' : has('cart') ? 'cart' : has('bank') ? 'bank' : has('heal') ? 'temple' : def.trade ? 'shop' : has('quest') ? 'quest' : null;
    if (kind) mapPlaces.push({ x: n.x, y: n.y, z: n.z, kind, label: def.name });
  }
  if (!builtinWorld) return mapPlaces; // a map from the editor has its own towns
  for (const [label, x, y, z] of MAP_TOWNS) mapPlaces.push({ x, y, z, kind: 'town', label });
  for (const { name, x, y, z } of map.labels || []) mapPlaces.push({ x, y, z, kind: 'isle', label: name }); // the islands
  return mapPlaces;
}
resetMinimap();

function paintTile(x, y, z) { // (and the tiles down-right of it: its shade falls on them)
  const g = minimap.layers[z].getContext('2d');
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const tx = x + dx, ty = y + dy;
    if (!map.inBounds(tx, ty, z) || (dx || dy) && !minimap.explored[z][ty * map.width + tx]) continue;
    const n = paintedColor(tx, ty, z);
    g.clearRect(tx, ty, 1, 1);
    if (n !== null) { g.fillStyle = `#${n.toString(16).padStart(6, '0')}`; g.fillRect(tx, ty, 1, 1); }
    const fine = minimap.fine[z];
    if (fine && fine.done) { // (its finer picture too)
      const fg = fine.getContext('2d'), img = fg.createImageData(FINE, FINE), d = img.data;
      paintFineTile((px, py, n, a = 255) => { const i = (py * FINE + px) * 4; d[i] = n >> 16; d[i + 1] = (n >> 8) & 255; d[i + 2] = n & 255; d[i + 3] = a; }, tx, ty, z);
      fg.putImageData(img, tx * FINE, ty * FINE);
    }
  }
}
let exploredExport = null; // exportExplored()'s answer, until something new is explored
function exploreTile(x, y, z) {
  const i = y * map.width + x;
  if (minimap.explored[z][i]) return;
  minimap.explored[z][i] = 1;
  exploredExport = null;
  paintTile(x, y, z);
}

// Mark everything on screen as explored when the player moves; repaint changed tiles.
function exploreAround() {
  for (const [x, y, z] of mapChanges.splice(0)) if (minimap.explored[z][y * map.width + x]) paintTile(x, y, z);
  const key = `${player.x},${player.y},${player.z}`;
  if (key === minimap.lastPos) return;
  minimap.lastPos = key;
  const rx = Math.ceil(VIEW_W / 2) + 1, ry = Math.ceil(VIEW_H / 2) + 1;
  for (let y = player.y - ry; y <= player.y + ry; y++) for (let x = player.x - rx; x <= player.x + rx; x++) {
    if (map.inBounds(x, y, player.z)) exploreTile(x, y, player.z);
  }
}

// The quests you're on: a gold circle roughly where each is done (questAreas in game-guide.js). On another floor
// it's dashed, with ▼ (below) or ▲ (above); off the edge of the map, a small gold point at the edge shows its way.
function drawQuestAreas(g, c, z, scale, ox, oy) {
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 400);
  g.save();
  for (const a of MapNews.areas()) {
    const px = ox + (a.x + 0.5) * scale, py = oy + (a.y + 0.5) * scale, r = Math.max(7, (a.r + 0.5) * scale), here = a.z === z;
    if (px + r < 0 || py + r < 0 || px - r > c.width || py - r > c.height) { // (off the map: a point at its edge)
      const cx = c.width / 2, cy = c.height / 2, ang = Math.atan2(py - cy, px - cx), m = 9;
      const k = Math.min((cx - m) / Math.max(1e-6, Math.abs(Math.cos(ang))), (cy - m) / Math.max(1e-6, Math.abs(Math.sin(ang))));
      g.save();
      g.translate(cx + Math.cos(ang) * k, cy + Math.sin(ang) * k);
      g.rotate(ang);
      g.beginPath(); g.moveTo(7, 0); g.lineTo(-4, -6); g.lineTo(-4, 6); g.closePath();
      g.lineWidth = 2; g.strokeStyle = '#000'; g.stroke();
      g.fillStyle = '#ffd84a'; g.fill();
      g.restore();
      continue;
    }
    g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2);
    if (here) { g.fillStyle = `rgba(255, 216, 74, ${0.14 + 0.08 * pulse})`; g.fill(); }
    g.setLineDash(here ? [] : [4, 3]);
    g.lineWidth = 3; g.strokeStyle = 'rgba(0, 0, 0, 0.7)'; g.stroke();
    g.lineWidth = 1.5; g.strokeStyle = here ? '#ffd84a' : 'rgba(255, 216, 74, 0.8)'; g.stroke();
    g.setLineDash([]);
    if (!here) {
      g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(a.z < z ? '▼' : '▲', px, py);
      g.fillStyle = '#ffd84a'; g.fillText(a.z < z ? '▼' : '▲', px, py);
    }
  }
  g.restore();
}

// ---- new on the map: a dot on the map's buttons (the phone's map button, the drawer's Map tab, Map under the
// minimap) when a quest's circle is new or has moved on, till you look at the map. Not while the guide's arrow shows
// the way (the basics). What you've seen is kept per character in this browser. ----
const MapNews = (() => {
  let seen = null, who = '', list = [], at = -1e9;
  const storeKey = () => `tilequest.mapSeen.${who}`;
  const save = () => { try { localStorage.setItem(storeKey(), JSON.stringify([...seen].slice(-200))); } catch (e) { /* (private window: kept till the page goes) */ } };
  function areas() {
    if (performance.now() - at > 500) { at = performance.now(); list = player && player.quests ? questAreas() : []; }
    return list;
  }
  function update() {
    if (!player || !player.name) return;
    if (who !== player.name) { who = player.name; seen = new Set(); try { for (const k of JSON.parse(localStorage.getItem(storeKey()) || '[]')) seen.add(k); } catch (e) { /* (none kept) */ } }
    const now = areas();
    if (player.tutorial && guideArrowOn()) { if (now.some(a => !seen.has(a.key))) { for (const a of now) seen.add(a.key); save(); } } // (the arrow leads)
    document.body.classList.toggle('map-news', now.some(a => !seen.has(a.key)));
  }
  function look() {
    if (!seen) return;
    let changed = false;
    for (const a of areas()) if (!seen.has(a.key)) { seen.add(a.key); changed = true; }
    if (changed) { save(); document.body.classList.remove('map-news'); }
  }
  return { areas, update, look };
})();

function drawMap(c, z, scale, cx, cy) {
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#1a140e'; // (past the edge of the world, and unexplored: dark parchment)
  g.fillRect(0, 0, c.width, c.height);
  const ox = c.width / 2 - (cx + 0.5) * scale, oy = c.height / 2 - (cy + 0.5) * scale;
  const fine = scale >= 3 && fineLayer(z); // (until it's made, the plain map)
  if (fine) { g.imageSmoothingEnabled = true; g.drawImage(fine, ox, oy, map.width * scale, map.height * scale); g.imageSmoothingEnabled = false; }
  else g.drawImage(minimap.layers[z], ox, oy, map.width * scale, map.height * scale);
  // the edge of the map darkens a little all round, as an old map's does
  const edge = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.35, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.75);
  edge.addColorStop(0, 'rgba(20,12,4,0)'); edge.addColorStop(1, 'rgba(20,12,4,0.38)');
  g.fillStyle = edge; g.fillRect(0, 0, c.width, c.height);
  // places you have explored: icons, and the names of towns where there's room for them
  const seen = (x, y) => map.inBounds(x, y, z) && minimap.explored[z][y * map.width + x];
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const p of placesOnMap()) {
    if (p.z !== z || !seen(p.x, p.y)) continue;
    const px = ox + (p.x + 0.5) * scale, py = oy + (p.y + 0.5) * scale;
    if (px < -40 || py < -10 || px > c.width + 40 || py > c.height + 10) continue;
    if (p.kind === 'town' || p.kind === 'isle') {
      if (scale > 6 || (p.kind === 'isle' && scale < 2)) continue;
      g.font = p.kind === 'town' ? 'bold 13px Georgia, serif' : 'italic 12px Georgia, serif'; // (names as on an old map)
      g.lineWidth = 3.5;
      g.strokeStyle = 'rgba(20,14,8,0.9)';
      g.strokeText(p.label, px, py - 8);
      g.fillStyle = p.kind === 'town' ? '#f1e2bd' : '#cfe3e6';
      g.fillText(p.label, px, py - 8);
      continue;
    }
    // a medallion, as the game's buttons: dark, a gold rim, the sign in its colour (a quest's beats)
    const [icon, color] = PLACE_ICONS[p.kind];
    const pulse = p.kind === 'quest' ? 1 + 0.12 * Math.sin(performance.now() / 260) : 1;
    const r = Math.max(6, Math.min(10, scale * 1.9)) * pulse;
    g.beginPath(); g.arc(px + 0.8, py + 1.2, r, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,0.45)'; g.fill(); // (its shadow)
    g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2);
    const face = g.createRadialGradient(px - r * 0.35, py - r * 0.35, r * 0.1, px, py, r);
    face.addColorStop(0, '#3a3128'); face.addColorStop(1, '#16110c');
    g.fillStyle = face; g.fill();
    g.lineWidth = Math.max(1.2, r * 0.18); g.strokeStyle = '#c9a24a'; g.stroke();
    g.font = `bold ${Math.round(r * 1.25)}px sans-serif`;
    g.fillStyle = color;
    g.fillText(icon, px, py + r * 0.06);
  }
  g.textAlign = 'start';
  g.textBaseline = 'alphabetic';
  // other players: green dots
  for (const o of players) {
    if (o === player || o.dead || o.z !== z) continue;
    g.fillStyle = '#30e060';
    g.fillRect(ox + o.x * scale - 1, oy + o.y * scale - 1, Math.max(3, scale), Math.max(3, scale));
  }
  // your marks: their icons, and at a close zoom their descriptions
  const size = Math.max(10, Math.min(16, scale * 3));
  for (const k of player.markers) {
    if (k.z !== z) continue;
    const kx = ox + (k.x + 0.5) * scale, ky = oy + (k.y + 0.5) * scale;
    drawMarkIcon(g, k.icon, kx, ky, size);
    if (scale >= 5 && k.label) {
      g.font = '11px sans-serif';
      g.lineWidth = 3;
      g.strokeStyle = '#000';
      g.strokeText(k.label, kx + size / 2 + 3, ky + 4);
      g.fillStyle = '#fff';
      g.fillText(k.label, kx + size / 2 + 3, ky + 4);
    }
  }
  drawQuestAreas(g, c, z, scale, ox, oy);
  if (z === player.z && Math.floor(now / 400) % 2 === 0) {
    g.fillStyle = '#fff';
    // (a white mark ringed in black, to find yourself at a glance: bigger on the whole world)
    const px = ox + (player.x + 0.5) * scale, py = oy + (player.y + 0.5) * scale, r = minimap.whole && c.id === 'minimap' ? 3 : Math.max(2.5, scale / 2 + 1);
    g.fillRect(px - r, py - r, r * 2, r * 2);
    g.strokeStyle = '#000'; g.lineWidth = 1; g.strokeRect(px - r - 0.5, py - r - 0.5, r * 2 + 1, r * 2 + 1);
  }
  return { ox, oy };
}

// ---- map marks ---------------------------------------------------------------------------
const MARK_COLORS = {
  check: '#48d848', question: '#f0e040', exclamation: '#ff9a30', star: '#ffd840', crossmark: '#ff4040', cross: '#f4f4f4',
  mouth: '#e84868', spear: '#c8c8d0', sword: '#dcdce4', flag: '#e83030', lock: '#e0b030', bag: '#b07a40', skull: '#f0f0e8',
  dollar: '#ffd040', up: '#ff4040', down: '#ff4040', left: '#ff4040', right: '#ff4040', green_up: '#48d848', green_down: '#48d848',
};
// A mark's icon, s pixels across, centred on (cx, cy), with a black outline so it shows on any ground.
function drawMarkIcon(g, icon, cx, cy, s) {
  const c = MARK_COLORS[icon] || '#fff', h = s / 2;
  g.save();
  g.translate(cx, cy);
  g.lineJoin = g.lineCap = 'round';
  const path = points => { g.beginPath(); points.forEach(([x, y], i) => (i ? g.lineTo(x * h, y * h) : g.moveTo(x * h, y * h))); g.closePath(); };
  const solid = () => { g.lineWidth = 2; g.strokeStyle = '#000'; g.stroke(); g.fillStyle = c; g.fill(); };
  const stroke = w => { g.lineWidth = w + 2; g.strokeStyle = '#000'; g.stroke(); g.lineWidth = w; g.strokeStyle = c; g.stroke(); };
  const text = ch => {
    g.font = `bold ${Math.round(s * 1.15)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 3;
    g.strokeStyle = '#000';
    g.strokeText(ch, 0, 1);
    g.fillStyle = c;
    g.fillText(ch, 0, 1);
  };
  const lineOf = (x0, y0, x1, y1, w) => { g.beginPath(); g.moveTo(x0 * h, y0 * h); g.lineTo(x1 * h, y1 * h); stroke(w); };
  const ARROW = [[0, -1], [1, 0.1], [0.38, 0.1], [0.38, 1], [-0.38, 1], [-0.38, 0.1], [-1, 0.1]];
  const arrow = turn => { g.rotate(turn); path(ARROW); solid(); };
  switch (icon) {
    case 'check': g.beginPath(); g.moveTo(-0.8 * h, 0); g.lineTo(-0.2 * h, 0.65 * h); g.lineTo(0.85 * h, -0.65 * h); stroke(Math.max(2, s / 5)); break;
    case 'question': text('?'); break;
    case 'exclamation': text('!'); break;
    case 'dollar': text('$'); break;
    case 'star': path(Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, d = i % 2 ? 0.45 : 1; return [Math.cos(a) * d, Math.sin(a) * d]; })); solid(); break;
    case 'crossmark': lineOf(-0.7, -0.7, 0.7, 0.7, Math.max(2, s / 5)); lineOf(0.7, -0.7, -0.7, 0.7, Math.max(2, s / 5)); break;
    case 'cross': path([[-0.3, -1], [0.3, -1], [0.3, -0.3], [1, -0.3], [1, 0.3], [0.3, 0.3], [0.3, 1], [-0.3, 1], [-0.3, 0.3], [-1, 0.3], [-1, -0.3], [-0.3, -0.3]]); solid(); break;
    case 'mouth': g.beginPath(); g.ellipse(0, 0, h, h * 0.55, 0, 0, Math.PI * 2); solid(); g.fillStyle = '#5a0a14'; g.fillRect(-0.7 * h, -0.5, 1.4 * h, 1.2); break;
    case 'spear': lineOf(-0.9, 0.9, 0.4, -0.4, 2); path([[1, -1], [0.15, -0.6], [0.6, -0.15]]); solid(); break;
    case 'sword': lineOf(-0.7, 0.7, 0.95, -0.95, Math.max(2, s / 6)); lineOf(-0.85, 0.05, -0.05, 0.85, 2); break;
    case 'flag': lineOf(-0.6, 1, -0.6, -1, 2); path([[-0.6, -1], [1, -0.55], [-0.6, -0.05]]); solid(); break;
    case 'lock': g.beginPath(); g.arc(0, -0.15 * h, 0.45 * h, Math.PI, 0); stroke(2); path([[-0.75, -0.15], [0.75, -0.15], [0.75, 1], [-0.75, 1]]); solid(); break;
    case 'bag': g.beginPath(); g.ellipse(0, 0.2 * h, 0.8 * h, 0.78 * h, 0, 0, Math.PI * 2); solid(); path([[-0.3, -0.9], [0.3, -0.9], [0.2, -0.5], [-0.2, -0.5]]); solid(); break;
    case 'skull':
      g.beginPath(); g.arc(0, -0.15 * h, 0.8 * h, 0, Math.PI * 2); solid();
      path([[-0.45, 0.4], [0.45, 0.4], [0.4, 1], [-0.4, 1]]); solid();
      g.fillStyle = '#000';
      for (const ex of [-0.35, 0.35]) { g.beginPath(); g.arc(ex * h, -0.15 * h, 0.2 * h, 0, Math.PI * 2); g.fill(); }
      break;
    case 'up': case 'green_up': arrow(0); break;
    case 'right': arrow(Math.PI / 2); break;
    case 'down': case 'green_down': arrow(Math.PI); break;
    case 'left': arrow(-Math.PI / 2); break;
  }
  g.restore();
}

// Your mark on or right next to tile t (how near depends on the zoom), if any.
function markAt(t, scale) {
  const reach = Math.max(1, Math.round(6 / scale));
  return player.markers.find(k => k.z === t.z && Math.abs(k.x - t.x) <= reach && Math.abs(k.y - t.y) <= reach) || null;
}

// Create a mark on tile t, or edit (or delete) the one there.
let markDraft = null;
function openMark(t, scale) {
  const old = markAt(t, scale);
  markDraft = { old, x: old ? old.x : t.x, y: old ? old.y : t.y, z: t.z, icon: old ? old.icon : 'flag' };
  $('markTitle').textContent = old ? 'Edit mark' : 'Create mark';
  $('markLabel').value = old ? old.label : '';
  $('markDelete').hidden = !old;
  const list = $('markIcons');
  list.replaceChildren();
  for (const icon of MARK_ICONS) {
    const b = document.createElement('button'), c = document.createElement('canvas');
    c.width = c.height = 24;
    drawMarkIcon(c.getContext('2d'), icon, 12, 12, 16);
    b.title = icon.replace('_', ' ');
    b.classList.toggle('active', icon === markDraft.icon);
    b.appendChild(c);
    b.addEventListener('click', () => {
      markDraft.icon = icon;
      list.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    });
    list.appendChild(b);
  }
  $('markDialog').hidden = false;
  $('markLabel').focus();
}
function closeMark(save, remove) {
  const d = markDraft;
  $('markDialog').hidden = true;
  if (!d || !(save || remove)) return;
  // the mark by where it is (online, the list itself is renewed by the server all the time)
  const at = d.old ? player.markers.findIndex(k => k.x === d.old.x && k.y === d.old.y && k.z === d.old.z) : -1;
  const mark = { x: d.x, y: d.y, z: d.z, icon: d.icon, label: $('markLabel').value.trim() }, list = [...player.markers];
  if (remove) list.splice(at, at < 0 ? 0 : 1);
  else if (at >= 0) list[at] = mark;
  else if (list.length >= MAX_MARKS) return log(`You have ${MAX_MARKS} marks already: delete one first.`);
  else list.push(mark);
  Actions.setMarkers(list);
}
// Right-click (or, on a touch screen, hold) a map to mark a spot; hovering a mark shows what it says.
function markable(canvas, tileOf, scaleOf) {
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (player) openMark(tileOf(e), scaleOf());
  });
  canvas.addEventListener('mousemove', e => {
    const k = player && markAt(tileOf(e), scaleOf());
    canvas.title = k ? k.label || k.icon : '';
  });
  // Holding one finger still marks the spot; a second finger (a pinch) or moving away doesn't.
  let hold = null, fingers = 0, holdFrom = null;
  const cancel = () => { if (hold && hold !== 'done') clearTimeout(hold); if (hold !== 'done') hold = null; };
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    cancel();
    if (++fingers > 1) return;
    hold = null; // a click after the last hold's mark is long gone
    holdFrom = { x: e.clientX, y: e.clientY };
    const t = tileOf(e);
    hold = setTimeout(() => { hold = 'done'; openMark(t, scaleOf()); }, 600);
  });
  canvas.addEventListener('pointermove', e => { if (e.pointerType === 'touch' && holdFrom && Math.hypot(e.clientX - holdFrom.x, e.clientY - holdFrom.y) > 8) cancel(); });
  const lift = e => { if (e.pointerType === 'touch') fingers = Math.max(0, fingers - 1); cancel(); };
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);
  // the tap that ends a hold isn't a click
  canvas.addEventListener('click', e => { if (hold === 'done') { e.stopImmediatePropagation(); hold = null; } }, true);
}

// The minimap showing the whole world (the phone's drawer), or round you again
function wholeMap(on) {
  minimap.whole = !!on;
  $('mmWorld').classList.toggle('active', minimap.whole);
  $('mmWorld').title = minimap.whole ? 'Back to where you are' : touchScreen ? 'The whole map' : 'World map (G)';
  if (player) drawMinimap();
}

// Whether the minimap is in sight: on a phone only on the drawer's Map tab (it lives in the hidden side panel
// otherwise); on a computer in the side panel, unless the window is too narrow for it
function minimapShown() {
  const c = $('minimap');
  if (!c || !c.isConnected) return false;
  if (touchScreen) return typeof InventoryDrawer !== 'undefined' && InventoryDrawer.stage() > 0 && InventoryDrawer.page() === 'map';
  return c.offsetParent !== null;
}

function drawMinimap() {
  MapNews.update();
  if (!$('worldmap').hidden) { drawWorldMap(); MapNews.look(); }
  if (!minimapShown()) return; // (drawn the moment it comes in sight: the drawer's Map tab draws it at once)
  if (touchScreen || minimap.whole) MapNews.look(); // (on a phone the map is only in sight when you open it; on a computer, the world map)
  const z = minimap.viewZ ?? player.z, c = $('minimap');
  if (minimap.whole) { // the whole world, as big as fits, in the middle
    const scale = Math.min(c.width / map.width, c.height / map.height);
    minimap.view = { scale, ...drawMap(c, z, scale, map.width / 2 - 0.5, map.height / 2 - 0.5) };
  } else minimap.view = { scale: minimap.zoom, ...drawMap(c, z, minimap.zoom, player.x + minimap.pan.x, player.y + minimap.pan.y) };
  setText($('minimapFloor'), `floor ${map.floorLabel(z)}`);
}

// center: the tile in the middle of the world map (null: follow the player); drag to move it.
const worldMap = { z: null, scale: 5, offset: { ox: 0, oy: 0 }, center: null, ride: false };
function drawWorldMap() {
  const z = worldMap.z ?? player.z;
  const c = worldMap.center || player;
  worldMap.offset = drawMap($('worldCanvas'), z, worldMap.scale, c.x, c.y);
  $('worldFloor').textContent = worldMap.ride ? 'Ride: tap where to go' : `Floor ${map.floorLabel(z)}`;
}

function worldMapTile(e) {
  const c = $('worldCanvas'), r = c.getBoundingClientRect();
  return {
    x: Math.floor(((e.clientX - r.left) * (c.width / r.width) - worldMap.offset.ox) / worldMap.scale),
    y: Math.floor(((e.clientY - r.top) * (c.height / r.height) - worldMap.offset.oy) / worldMap.scale),
    z: worldMap.z ?? player.z,
  };
}

function exportExplored() {
  if (exploredExport) return exploredExport;
  return (exploredExport = minimap.explored.map(arr => {
    let s = '';
    for (let i = 0; i < arr.length; i += 8) {
      let b = 0;
      for (let k = 0; k < 8; k++) if (arr[i + k]) b |= 1 << k;
      s += String.fromCharCode(b);
    }
    return btoa(s);
  }));
}

function importExplored(list) {
  if (!Array.isArray(list) || list.length !== map.depth) return;
  list.forEach((b64, z) => {
    const s = atob(b64);
    if (s.length !== Math.ceil((map.width * map.height) / 8)) return; // saved on a different map
    for (let i = 0; i < map.width * map.height; i++) {
      if ((s.charCodeAt(i >> 3) >> (i & 7)) & 1) exploreTile(i % map.width, Math.floor(i / map.width), z);
    }
  });
}

function initMaps() {
  const c = $('minimap');
  const minimapTile = e => {
    const r = c.getBoundingClientRect(), v = minimap.view || { scale: minimap.zoom, ox: 0, oy: 0 };
    return {
      x: Math.floor(((e.clientX - r.left) * (c.width / r.width) - v.ox) / v.scale),
      y: Math.floor(((e.clientY - r.top) * (c.height / r.height) - v.oy) / v.scale),
      z: minimap.viewZ ?? player.z,
    };
  };
  c.addEventListener('click', e => {
    if ((minimap.viewZ ?? player.z) !== player.z || player.dead) return;
    const t = minimapTile(e);
    Actions.walkTo(t.x, t.y, 30000);
    // on a phone the map is in the drawer: half open it stays (the world shows above it, you walk on in sight); all
    // the way open (Full map, no world left to see) it folds away so you see where you walk
    if (c.closest('.inventory-drawer') && typeof InventoryDrawer !== 'undefined' && InventoryDrawer.stage() === 2) InventoryDrawer.close();
  });
  markable(c, minimapTile, () => (minimap.view ? minimap.view.scale : minimap.zoom));
  // two fingers on the minimap zoom it in and out
  // one finger (or the mouse) drags it about; a tap that didn't move still walks there
  const mmFingers = new Map();
  let mmPinch = null, mmDrag = null, mmDragged = false;
  const mmSpread = () => { const [a, b] = [...mmFingers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  c.addEventListener('pointerdown', e => {
    mmFingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mmFingers.size === 2) { mmPinch = { from: mmSpread(), zoom: minimap.zoom }; mmDrag = null; }
    else if (mmFingers.size === 1 && e.button === 0) { mmDrag = { x: e.clientX, y: e.clientY, pan: { ...minimap.pan } }; mmDragged = false; }
  });
  c.addEventListener('pointermove', e => {
    if (!mmFingers.has(e.pointerId)) return;
    mmFingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mmPinch && mmFingers.size >= 2) { wholeMap(false); minimap.zoom = Math.max(1, Math.min(8, mmPinch.zoom * (mmSpread() / Math.max(1, mmPinch.from)))); drawMinimap(); return; }
    if (!mmDrag || minimap.whole) return;
    const r = c.getBoundingClientRect(), k = (c.width / r.width) / minimap.zoom; // (screen pixels to tiles)
    const dx = e.clientX - mmDrag.x, dy = e.clientY - mmDrag.y;
    if (!mmDragged && Math.hypot(dx, dy) < 8) return; // (a tap wobbles a little)
    mmDragged = true;
    minimap.pan = { x: mmDrag.pan.x - dx * k, y: mmDrag.pan.y - dy * k };
    drawMinimap();
  });
  for (const ev of ['pointerup', 'pointercancel']) c.addEventListener(ev, e => { mmFingers.delete(e.pointerId); if (mmFingers.size < 2) mmPinch = null; if (!mmFingers.size) mmDrag = null; });
  c.addEventListener('click', e => { if (mmFingers.size || mmPinch || mmDragged) { e.stopImmediatePropagation(); mmDragged = false; } }, true);
  markable($('worldCanvas'), e => worldMapTile(e), () => worldMap.scale);
  $('markSave').addEventListener('click', () => closeMark(true));
  $('markCancel').addEventListener('click', () => closeMark(false));
  $('markDelete').addEventListener('click', () => closeMark(false, true));
  $('markLabel').addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') closeMark(true);
    if (e.key === 'Escape') closeMark(false);
  });
  // (the zoom buttons zoom round you again)
  $('mmZoomIn').addEventListener('click', () => { wholeMap(false); minimap.pan = { x: 0, y: 0 }; minimap.zoom = Math.min(8, minimap.zoom * 2); });
  $('mmZoomOut').addEventListener('click', () => { wholeMap(false); minimap.pan = { x: 0, y: 0 }; minimap.zoom = Math.max(1, minimap.zoom / 2); });
  const look = dz => {
    const z = Math.max(0, Math.min(map.depth - 1, (minimap.viewZ ?? player.z) + dz));
    minimap.viewZ = z === player.z ? null : z;
  };
  $('mmUp').addEventListener('click', () => look(1));
  $('mmDown').addEventListener('click', () => look(-1));
  // in the phone's drawer: Full map, the whole world in it (no window); on a computer, the world map window
  $('mmWorld').addEventListener('click', () => {
    if (!c.closest('.inventory-drawer')) return toggleWorldMap();
    const on = !minimap.whole; // Full map: the drawer all the way open on the whole world; again, half way and round you
    InventoryDrawer.open(on ? 2 : 1);
    wholeMap(on);
  });

  const wc = $('worldCanvas');
  $('worldRide').addEventListener('click', () => setRideMode(!worldMap.ride));
  $('rideCancel').addEventListener('click', () => { $('rideChoice').hidden = true; });
  // Drag the world map to look around (one finger, or the mouse), pinch it to zoom
  // (two fingers); a tap without either is a click.
  let pan = null;
  const fingers = new Map();
  let pinch = null;
  const spread = () => { const [a, b] = [...fingers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  wc.addEventListener('pointerdown', e => {
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const c = worldMap.center || player;
    if (fingers.size === 2) {
      pinch = { from: spread(), scale: worldMap.scale };
      if (pan) pan.moved = true; // a pinch is never a tap
    } else pan = { x: e.clientX, y: e.clientY, cx: c.x, cy: c.y, moved: false };
    try {
      wc.setPointerCapture(e.pointerId);
    } catch (err) { /* the pointer is already gone */ }
  });
  wc.addEventListener('pointermove', e => {
    if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && fingers.size >= 2) {
      worldMap.scale = Math.max(1, Math.min(12, pinch.scale * (spread() / Math.max(1, pinch.from))));
      return;
    }
    if (!pan) return;
    const r = wc.getBoundingClientRect(), k = wc.width / r.width / worldMap.scale;
    const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) < 8) return;
    pan.moved = true;
    worldMap.center = { x: Math.round(pan.cx - dx * k), y: Math.round(pan.cy - dy * k) };
  });
  const lift = e => {
    fingers.delete(e.pointerId);
    if (fingers.size < 2) pinch = null;
    if (fingers.size === 1 && pan) { // one finger stays: drag on from where it is
      const [f] = fingers.values(), c = worldMap.center || player;
      Object.assign(pan, { x: f.x, y: f.y, cx: c.x, cy: c.y });
    }
  };
  wc.addEventListener('pointercancel', lift);
  wc.addEventListener('pointerup', e => { lift(e); if (!fingers.size) setTimeout(() => { pan = null; }); });
  wc.addEventListener('click', e => {
    if (pan && pan.moved) return;
    const t = worldMapTile(e);
    if (worldMap.ride) {
      if (!map.inBounds(t.x, t.y, map.surfaceZ)) return;
      if (!minimap.explored[map.surfaceZ][t.y * map.width + t.x]) return log('A cab can only take you to places you have seen.');
      chooseRide(t);
    } else if (t.z === player.z) {
      Actions.walkTo(t.x, t.y, 30000);
      toggleWorldMap();
    }
  });
  wc.addEventListener('wheel', e => {
    e.preventDefault();
    worldMap.scale = Math.max(1, Math.min(12, worldMap.scale + (e.deltaY < 0 ? 1 : -1)));
  }, { passive: false });
  const zoom = d => { worldMap.scale = Math.max(1, Math.min(12, worldMap.scale + d)); };
  $('worldZoomIn').addEventListener('click', () => zoom(1));
  $('worldZoomOut').addEventListener('click', () => zoom(-1));
  $('worldUp').addEventListener('click', () => { worldMap.z = Math.min(map.depth - 1, (worldMap.z ?? player.z) + 1); });
  $('worldDown').addEventListener('click', () => { worldMap.z = Math.max(0, (worldMap.z ?? player.z) - 1); });
  $('worldClose').addEventListener('click', () => toggleWorldMap());
}

// Three ways to get there: by cab, by balloon (over water too), or with Dom (fast, and pricey).
const RIDE_CHOICES = [
  ['cab', '🐴 Hoofer cab', 'by land'],
  ['balloon', '🎈 Balloon', 'flies straight there, over water too'],
  ['dom', '🏎 Dom', 'by land, three times as fast'],
];
function chooseRide(t) {
  const list = $('rideOptions');
  list.replaceChildren();
  for (const [kind, name, how] of RIDE_CHOICES) {
    const cost = rideCost(kind, player, t);
    const b = document.createElement('button');
    b.className = 'hot';
    b.disabled = player.gold < cost;
    b.innerHTML = '<span></span><small></small>';
    b.querySelector('span').textContent = `${name} - ${cost} gold`;
    b.querySelector('small').textContent = b.disabled ? 'not enough gold' : how;
    b.addEventListener('click', () => {
      Actions.orderRide(t.x, t.y, kind);
      $('rideChoice').hidden = true;
      if (!$('worldmap').hidden) toggleWorldMap();
    });
    list.appendChild(b);
  }
  $('rideChoice').hidden = false;
}

function setRideMode(on) {
  worldMap.ride = on;
  $('worldRide').classList.toggle('active', on);
  $('worldCanvas').classList.toggle('targeting', on);
}

function toggleWorldMap(ride = false) {
  const w = $('worldmap');
  w.hidden = !w.hidden;
  // above ground (upstairs, the temple's hill, a mountain top) a floor is mostly empty and dark: open on the ground
  // level instead, where the island is (underground: your own floor)
  worldMap.z = player.z > map.surfaceZ ? map.surfaceZ : null;
  worldMap.center = null;
  setRideMode(!w.hidden && ride);
  document.body.classList.remove('panel-open'); // on a phone, the drawer would cover it
  if (!w.hidden) {
    const c = $('worldCanvas'), box = $('viewport').getBoundingClientRect();
    c.width = Math.max(320, Math.floor(box.width - 40));
    c.height = Math.max(240, Math.floor(box.height - 90));
  }
}

// ---- static UI wiring --------------------------------------------------------------------------
function initUI() {
  $('guideHead').addEventListener('click', () => {
    guideFolded = !guideFolded;
    try { localStorage.setItem('tilequest.guideFolded', guideFolded ? '1' : '0'); } catch (e) { /* no storage: only for now */ }
    renderGuide();
  });
  // (on a phone a step with a task shows its first lines: a tap on them shows all of it, and again folds it short)
  $('guideText').addEventListener('click', () => $('guide').classList.toggle('open'));
  $('guideDone').addEventListener('click', () => (player.tutorial === GUIDE.length ? Actions.endGuide() : Actions.guideNext()));
  // Skip: a second tap within a few seconds to be sure (it says so in the meantime)
  let skipAsk = 0;
  $('guideSkip').addEventListener('click', e => {
    e.stopPropagation(); // (not a fold)
    const b = $('guideSkip');
    if (!b.classList.contains('sure')) {
      b.classList.add('sure'); b.textContent = 'Turn it off? Tap again';
      clearTimeout(skipAsk); skipAsk = setTimeout(() => { b.classList.remove('sure'); b.textContent = 'Turn off'; }, 3500);
      return;
    }
    clearTimeout(skipAsk); b.classList.remove('sure'); b.textContent = 'Turn off';
    Actions.skipGuide();
  });
  $('battle').addEventListener('pointerleave', () => { battleHover = null; });
  document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach(o => o.classList.toggle('active', o === b));
    document.querySelectorAll('.tab').forEach(t => { t.hidden = t.id !== `tab-${b.dataset.tab}`; });
  }));
  document.querySelector('[data-tab="skills"]').click();
  $('partyShare').addEventListener('click', () => { const v = myPartyView(); if (v) Actions.partyShareXp(!v.shared); });
  $('partyLeave').addEventListener('click', () => Actions.partyLeave());
  $('guildBtn').addEventListener('click', () => toggleGuild());
  $('guildClose').addEventListener('click', () => toggleGuild(false));
  $('forgeClose').addEventListener('click', closeForge);
  $('chat').placeholder = CHAT_HINT;
  document.querySelectorAll('[data-logtab]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('[data-logtab]').forEach(o => o.classList.toggle('active', o === b));
    $('log').dataset.filter = b.dataset.logtab;
    $('chat').placeholder = { party: 'Talk to your party', guild: 'Talk to your guild' }[b.dataset.logtab]
      || CHAT_HINT;
    $('log').scrollTop = $('log').scrollHeight;
  }));
  document.querySelectorAll('[data-shoptab]').forEach(b => b.addEventListener('click', () => {
    shopTab = b.dataset.shoptab;
    renderShop();
  }));
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => Actions.setFightMode(b.dataset.mode)));
  $('chaseMode').addEventListener('click', () => Actions.setChase(!player.chase));
  $('secureMode').addEventListener('click', () => Actions.setSecure(player.secure === false));
  $('shopClose').addEventListener('click', () => Actions.closeShop());
  $('lootClose').addEventListener('click', () => Actions.closePile());
  $('lootAll').addEventListener('click', () => player.openPile && Actions.takeAll(player.openPile.id));
  $('readClose').addEventListener('click', () => { $('read').hidden = true; });
  $('pathsClose').addEventListener('click', () => { $('paths').hidden = true; });
  $('treeClose').addEventListener('click', () => { $('skillTree').hidden = true; });
  setInterval(maybeAskPath, 500); // (a new character: its path, once its name and outfit are done)
  Intro.setup();
  Gate.setup();
  $('treeReset').addEventListener('click', () => {
    const cost = player.treeResets ? player.level * 50 : 0;
    if (confirm(`Start your skill tree over? All your points come back${cost ? `, for ${cost} gold` : ' (free the first time)'}.`)) Actions.resetTree();
  });
  $('hotkeysBtn').addEventListener('click', openHotkeys);
  $('guideBtn').addEventListener('click', () => Actions.restartGuide());
  $('hotkeysSave').addEventListener('click', saveHotkeys);
  $('hotkeysCancel').addEventListener('click', () => { $('hotkeys').hidden = true; });
  $('outfitBtn').addEventListener('click', () => { if (!paused && $('outfit').hidden) openOutfit(); }); // not while making a character
  $('soundBtn').addEventListener('click', () => { Sound.toggle(); updateSoundButtons(); });
  $('speedBtn').addEventListener('click', () => setSpeedMeter(!speedMeter.on));
  // the quality: high, medium or low (see setQuality)
  const qualityLabel = () => { $('qualityBtn').textContent = `Quality: ${quality}`; };
  qualityLabel();
  $('qualityBtn').addEventListener('click', () => { setQuality({ high: 'medium', medium: 'low', low: 'high' }[quality]); qualityLabel(); });
  // the frame rate: 60 (smoothest) or 30 (a cooler phone, a longer battery)
  const fpsLabel = () => { $('fpsBtn').textContent = `${Math.round(1000 / FRAME_INTERVAL)} fps`; };
  fpsLabel();
  $('fpsBtn').addEventListener('click', () => { setFrameRate(Math.round(1000 / FRAME_INTERVAL) === 60 ? 30 : 60); fpsLabel(); });
  $('musicBtn').addEventListener('click', () => { Sound.toggleMusic(); updateSoundButtons(); });
  $('rightBtn').addEventListener('click', () => { rightClickAttacks = !rightClickAttacks; saveSetting('rightClickAttacks', rightClickAttacks); updateSoundButtons(); });
  updateSoundButtons();
  $('mapSource').textContent = typeof Net !== 'undefined' && Net.online ? 'Playing online' : customMap ? 'Map: saved by the editor' : 'Map: built-in world';
  $('resetMap').addEventListener('click', () => {
    if (!confirm('Forget the map saved by the editor and play the built-in world?')) return;
    localStorage.removeItem(MAP_STORAGE_KEY);
    location.reload();
  });
  $('fullscreen').addEventListener('click', () => {
    toggleFullscreen(); // see touch.js: careful with browsers that can't
  });
  // (a test character playing alone: Clang at its level; the button shows only for one)
  $('testClang').addEventListener('click', () => { giveTestClang(); log(`${player.pet.name} is at your side, at level ${player.level}.`, 'quest'); });
  setInterval(() => { if (player) $('testClang').hidden = !(!Net.online && isTestHero() && !(player.pet && player.pet.level >= player.level)); }, 1000);
  $('testSpear').addEventListener('click', () => giveTestSpear());
  $('testRoom').addEventListener('click', () => goPracticeRoom());
  setInterval(() => { if (player) $('testRoom').hidden = Net.online; }, 1000);
  { const b = $('worldPreview'), on = typeof WORLD_PREVIEW !== 'undefined' && WORLD_PREVIEW; // (the new world's preview, and back)
    if (b) { if (on) b.textContent = 'Back to the current world'; b.addEventListener('click', () => { location.href = on ? 'index.html' : 'index.html?world=kestrel'; }); } }
  setInterval(() => { if (player) $('testSpear').hidden = !(!Net.online && wantsTestSpear()); }, 1000);
  $('newChar').addEventListener('click', () => {
    if (online()) { // online: log out of this browser, so you can log in as someone else
      if (!confirm('Log out? You can log in again with your name and password.')) return;
      Net.forget();
      return location.reload();
    }
    if (stored(ACCOUNT_KEY)) { // with an account: log out; the gate makes another or logs back in
      if (!confirm('Log out? You can log in again with your name and password.')) return;
      saveGame(); stored(SESSION_KEY, null);
      window.onbeforeunload = null;
      return location.reload();
    }
    if (!confirm('Delete your character and start over?')) return;
    localStorage.removeItem(SAVE_KEY);
    window.onbeforeunload = null;
    location.reload();
  });
  initMaps();
}

function updateSoundButtons() {
  $('soundBtn').textContent = Sound.enabled ? 'Sound: on' : 'Sound: off';
  $('musicBtn').textContent = Sound.musicOn ? 'Music: on' : 'Music: off';
  $('rightBtn').textContent = rightClickAttacks ? 'Right-click: attack' : 'Right-click: menu';
}

// The welcome: while you name a character and choose its outfit (or log in), the game's controls stay out of sight
// and the loading screen's picture is behind the windows, a title screen rather than the game behind glass
function welcome(on) { document.body.classList.toggle('welcome', !!on); if (!on && $('templeScene')) welcomeScene(false); if (!on) Sound.title.stop(); }

// ---- the parchment panel (css/parchment.css): a page of real paper in an antique gold frame, round any content ------
// ParchmentPanel.decorate(el, { variant, ornament }) puts the paper and the frame under what el already holds (its
// content stays as it is: words, buttons, fields); variant 'ceremonial' (the gold frame, the default) or 'compact' (a
// thin gold line); ornament: the golden tree crowning it instead of the frame's crest. ParchmentPanel.ornament(el, on)
// switches that later. Its pictures are fetched by their own version, once, for every panel.
const ParchmentPanel = (() => {
  const PICTURES = { torn: 'paper-torn', tl: 'corner-tl', tr: 'corner-tr', bl: 'corner-bl', br: 'corner-br', top: 'edge-top', bottom: 'edge-bottom',
    left: 'edge-left', right: 'edge-right', crest: 'crest', ornament: 'ornament' };
  let versioned = false;
  // (each picture's address with its version, on the page's root: every panel uses them; whole, so a stylesheet reads them right)
  function version() {
    if (versioned || typeof SPRITE_HASHES === 'undefined') return;
    versioned = true;
    for (const [key, file] of Object.entries(PICTURES)) {
      const hash = SPRITE_HASHES[`ui/parchment/${file}.webp`], url = new URL(`sprites/ui/parchment/${file}.webp${hash ? `?h=${hash}` : ''}`, location.href).href;
      document.documentElement.style.setProperty(`--pp-${key}`, `url("${url}")`);
    }
  }
  // scroll: its words go into a .pp-content that scrolls if they must; what's marked .ob-nav (the way on) stays under it
  function decorate(el, { variant = 'ceremonial', ornament = false, scroll = false } = {}) {
    version();
    el.classList.remove('pp-ceremonial', 'pp-compact');
    el.classList.add('parchment-panel', `pp-${variant}`);
    if (!el.querySelector(':scope > .pp-paper')) {
      const frame = h('div', { className: 'pp-frame' }, ...['pp-top', 'pp-bottom', 'pp-left', 'pp-right', 'pp-tl', 'pp-tr', 'pp-bl', 'pp-br', 'pp-crest', 'pp-ornament']
        .map(cls => h('i', { className: cls })));
      frame.setAttribute('aria-hidden', 'true');
      el.prepend(h('div', { className: 'pp-paper' }), frame);
    }
    if (scroll && !el.querySelector(':scope > .pp-content')) {
      const content = h('div', { className: 'pp-content' });
      const kids = [...el.children].filter(k => !k.matches('.pp-paper, .pp-frame'));
      for (const k of kids) { if (k.matches('.ob-nav, .dialog-buttons')) k.classList.add('pp-foot'); else content.append(k); }
      el.insertBefore(content, el.querySelector(':scope > .pp-foot'));
      el.classList.add('pp-scroll');
    }
    setOrnament(el, ornament);
    return el;
  }
  // back to a plain window (the outfit window in the game keeps the game's look): its words where they were
  function undecorate(el) {
    const content = el.querySelector(':scope > .pp-content');
    if (content) { el.insertBefore(content, el.querySelector(':scope > .pp-foot')); content.replaceWith(...content.children); }
    el.querySelectorAll(':scope > .pp-paper, :scope > .pp-frame').forEach(k => k.remove());
    el.querySelectorAll(':scope > .pp-foot').forEach(k => k.classList.remove('pp-foot'));
    el.classList.remove('parchment-panel', 'pp-ceremonial', 'pp-compact', 'pp-ornate', 'pp-scroll');
    return el;
  }
  const setOrnament = (el, on) => el.classList.toggle('pp-ornate', !!on);
  return { decorate, undecorate, ornament: setOrnament };
})();

// a story picture's address, by its own version (only the pictures that changed are fetched again after an update)
const storyArt = image => { const h = typeof SPRITE_HASHES !== 'undefined' && SPRITE_HASHES[`ui/story/${image}.webp`]; return `sprites/ui/story/${image}.webp${h ? `?h=${h}` : ''}`; };
// ---- the opening: SORTIA's story, then Sister Ama (docs/sortia/intro: the owner's package, intro.js its words) ------------
// One panorama behind it all (sprites/ui/intro/panorama.webp: the seal, the mill, the crossing, the false signal, Sister
// Ama, left to right; its lanterns flickering; mist and snow in front, each at its own pace), the camera moving along it: four story cards, each its title and words over its part of the
// picture, then Sister Ama: your name (offline; online it's known from the login), and three lines of talk ending in
// Choose Your Path, which opens the vocation screen. A swipe drags the picture with the finger and lands on the next scene
// (or back); Continue and the arrow keys do the same; Skip intro goes straight to Sister Ama. The words stay where they
// are and change as the camera lands. Browser tests go straight on unless they ask for it with ?story.
// INTRO_SPOTS: where the camera looks for each scene, as fractions of the panorama's width from the left
const INTRO_SPOTS = [0.10, 0.29, 0.49, 0.67, 0.90];
const INTRO_CARDS = [
  ['The Broken Seal', 'Long ago, something beneath the northern mountain made the creatures above obey its commands. The people of the north sealed the stairway so no creature would hear those commands again. Then the river flooded. When the water receded, the seal lay broken.', 'the-broken-seal'],
  ['The Hollow Host', 'Three nights later, a miller saw goblins and wolves coming down the road together. He’d seen them fight over the same prey. When he barred the bridge, two goblins stayed at the gate while the rest took the wolves upstream. As more villages fell, people fled south.', 'the-hollow-host'],
  ['The Last Crossing', 'You followed the survivors to Oakvale. Its gate still opened to refugees, and ships waited in the harbor. Just before the bridge, a watchman raised his lantern once. A wounded man by the road lifted his twice. Two guards came across to help him.', 'the-last-crossing'],
  ['The False Signal', 'After the guards brought the man inside, the lantern above the gate went up again. From the ditch came the same reply. Two lifts. This time, the light fell on a goblin’s hand. A wolf waited behind him. You ran. Halfway across the bridge, your legs gave way.', 'the-false-signal'],
];
const INTRO_AMA = {
  ask: '“You’re awake. The watch brought you in last night. I’m Sister Ama. What should I call you?”',
  talk: [
    '“$name, the guards who carried you in saw the signal again. Last night they turned back to help you. Now they’ve gone to look for whoever’s still out there.”',
    'You tell Ama a goblin was holding the lantern.\n\n“They’re already across the bridge.” She turns to a temple attendant. “Run to the gate. Tell the watch it’s a trap.”',
    '“Oakvale’s watch trains three kinds of defenders. Bastions hold the crossings so people can reach safety. Hawks scout the roads and fight with the bow. Embers use magic against threats that steel can’t stop.\n\n“If you want to help Oakvale, the watch can train you. Which path will you take?”',
  ],
};
const Intro = (() => {
  // the steps: the four cards, the name (when asked), the three lines of talk
  let at = 0, opts = null, name = '', drag = null, landing = 0, x = 0;
  const NAME = INTRO_CARDS.length;
  const steps = () => opts && opts.askName ? NAME + 1 + INTRO_AMA.talk.length : NAME + INTRO_AMA.talk.length;
  const kind = i => i < NAME ? 'card' : opts.askName && i === NAME ? 'name' : 'talk';
  const talkLine = i => INTRO_AMA.talk[i - NAME - (opts.askName ? 1 : 0)];
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const art = () => $('sortiaIntro').querySelector('.si-art');
  // the camera: the panorama's left edge, in pixels, for a scene (its spot in the middle of the column, never past an edge)
  function spot(i) {
    const col = $('sortiaIntro').querySelector('.si-col'), w = $('sortiaIntro').querySelector('.si-world').offsetWidth || col.clientHeight * 2172 / 724, view = col.clientWidth;
    return Math.max(0, Math.min(w - view, INTRO_SPOTS[Math.min(i, NAME)] * w - view / 2));
  }
  // the camera at px: the panorama moved by it, the layers in front each by their own share of it (data-f), within one
  // tile of their pattern (data-tile), so they never run out
  let glideFrame = 0;
  function place(px) {
    x = px;
    const box = $('sortiaIntro'), world = box.querySelector('.si-world');
    world.style.transform = `translate3d(${(-px).toFixed(1)}px, 0, 0)`;
    world.style.setProperty('--si-x', px.toFixed(1));
    // (no snow in the cave by the seal or indoors with Sister Ama: it comes in as the camera leaves the first scene and is gone
    // by the last; no mist indoors either)
    const clamp01 = v => Math.max(0, Math.min(1, v)), s0 = spot(0), s1 = spot(1), s3 = spot(NAME - 1), s4 = spot(NAME);
    const outside = clamp01((s4 - px) / Math.max(1, s4 - s3)), snow = clamp01((px - s0) / Math.max(1, s1 - s0)) * outside;
    for (const fx of box.querySelectorAll('.si-fx')) {
      const tile = +fx.dataset.tile, off = (((px * +fx.dataset.f) % tile) + tile) % tile;
      fx.style.transform = `translate3d(${(-off).toFixed(1)}px, 0, 0)`;
      fx.style.opacity = (fx.classList.contains('si-mist') ? outside : snow).toFixed(3);
    }
  }
  // a glide from where the camera is to px, in ms, slowing as it lands; then done()
  function glide(px, ms, done) {
    cancelAnimationFrame(glideFrame);
    const from = x, t0 = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    const frame = now => {
      const t = Math.min(1, (now - t0) / ms);
      place(from + (px - from) * ease(t));
      if (t < 1) glideFrame = requestAnimationFrame(frame); else if (done) done();
    };
    glideFrame = requestAnimationFrame(frame);
  }
  // the words and controls of the step now: changed once the camera has landed
  function words(focus) {
    const col = $('sortiaIntro').querySelector('.si-col'), k = kind(at), card = INTRO_CARDS[at];
    col.dataset.screen = k === 'card' ? 'story' : 'ama';
    $('siTitle').textContent = card ? card[0] : 'Sister Ama';
    $('siCopy').textContent = card ? card[1] : k === 'name' ? INTRO_AMA.ask : talkLine(at).replace(/\$name/g, name);
    $('siForm').hidden = k !== 'name';
    $('siFoot').hidden = k === 'name';
    $('siSkip').hidden = k !== 'card';
    $('siDots').hidden = $('siBack').hidden = k !== 'card';
    $('siBack').disabled = at === 0;
    $('siNextLabel').textContent = at === steps() - 1 ? 'Choose Your Path' : 'Continue';
    [...$('siDots').children].forEach((d, i) => { if (i === at && k === 'card') d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current'); });
    if (focus) (k === 'name' && !touchScreen ? $('siName') : $('siTitle')).focus({ preventScroll: true });
    $('sortiaIntro').scrollTop = 0;
  }
  // to a step: the camera glides to its scene (if it's another), and the words change as it lands
  function go(i) {
    if (i < 0) return;
    if (i >= steps()) { close(); return; }
    const from = Math.min(at, NAME), to = Math.min(i, NAME);
    at = i;
    const turn = ++landing;
    if (from === to && Math.abs(x - spot(to)) < 1) { words(true); return; }
    const far = Math.abs(spot(to) - x), ms = still() ? 0 : Math.round(Math.min(1100, 420 + far * 0.35));
    if (!ms) { cancelAnimationFrame(glideFrame); place(spot(to)); words(true); return; }
    $('sortiaIntro').classList.add('moving');
    glide(spot(to), ms, () => { if (turn !== landing) return; $('sortiaIntro').classList.remove('moving'); words(true); });
  }
  // (a card to the one beside it: only among the cards, and on to Sister Ama from the last)
  const turn = d => { if (at < NAME && at + d >= 0 && at + d <= NAME) go(at + d); else go(at); };
  function close() {
    const done = opts && opts.onDone; opts = null;
    cancelAnimationFrame(glideFrame);
    $('sortiaIntro').hidden = true; $('sortiaIntro').classList.remove('moving');
    if (done) done();
  }
  function show(o) {
    if (navigator.webdriver && !/[?&](story|gate)\b/.test(location.search)) { if (o.skip) o.skip(); else if (o.onDone) o.onDone(); return; } // (browser tests: straight on)
    opts = o; name = o.name || ''; at = 0; landing++;
    Sound.title.start('story'); // (The Broken Seal, from the gate's music, until you're in the world)
    welcome(true);
    $('siName').value = ''; $('siHint').textContent = ''; $('siName').setAttribute('aria-invalid', 'false');
    $('sortiaIntro').hidden = false;
    place(spot(0)); words(false);
    if (!art().complete) art().addEventListener('load', () => place(spot(at)), { once: true });
  }
  function setup() {
    const box = $('sortiaIntro'), input = $('siName');
    { const h = typeof SPRITE_HASHES !== 'undefined' && SPRITE_HASHES['ui/intro/sortia-wordmark.webp']; if (h) box.querySelector('.si-mark').src = `sprites/ui/intro/sortia-wordmark.webp?h=${h}`; }
    { const h = typeof SPRITE_HASHES !== 'undefined' && SPRITE_HASHES['ui/intro/panorama.webp']; if (h) box.querySelector('.si-art').src = `sprites/ui/intro/panorama.webp?h=${h}`; }
    $('siSkip').onclick = () => go(NAME);
    $('siBack').onclick = () => turn(-1);
    $('siNext').onclick = () => go(at + 1);
    // your name: checked as the game always has (nameProblem), what's wrong said by the field; the field stays to fix
    input.addEventListener('input', () => { $('siHint').textContent = ''; input.setAttribute('aria-invalid', 'false'); });
    input.addEventListener('keydown', e => e.stopPropagation()); // (the game's keys don't fire while you type)
    $('siForm').addEventListener('submit', e => {
      e.preventDefault();
      const problem = nameProblem(input.value);
      if (problem !== null) { $('siHint').textContent = problem || 'Enter a character name.'; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
      name = capitalize(input.value.trim().replace(/[^\w '-]/g, '').slice(0, 20));
      if (opts.onName) opts.onName(name);
      go(at + 1);
    });
    // a swipe on a card: once it's clearly sideways the picture follows the finger (a little stiff past either end); let
    // go far or fast enough and it lands on the next scene or the one before, else it slides back. Up and down scroll.
    box.addEventListener('touchstart', e => {
      drag = at < NAME && e.touches.length === 1 && !e.target.closest('input, button, select, summary')
        ? { x0: e.touches[0].clientX, y0: e.touches[0].clientY, t: performance.now(), base: x, on: false } : null;
    }, { passive: true });
    box.addEventListener('touchmove', e => {
      if (!drag) return;
      const dx = e.touches[0].clientX - drag.x0, dy = e.touches[0].clientY - drag.y0;
      if (!drag.on) { if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) { if (Math.abs(dy) > 12) drag = null; return; } drag.on = true; drag.base = x; landing++; cancelAnimationFrame(glideFrame); box.classList.remove('moving'); }
      const lo = spot(0), hi = spot(NAME); let to = drag.base - dx;
      if (to < lo) to = lo - (lo - to) * 0.35; else if (to > hi) to = hi + (to - hi) * 0.35; // (stiff past the ends)
      place(to);
    }, { passive: true });
    const release = (cx, cancelled) => {
      if (!drag) return;
      const d = drag; drag = null;
      if (!d.on) return;
      const dx = cx - d.x0, fast = Math.abs(dx) / Math.max(1, performance.now() - d.t) > 0.45;
      if (!cancelled && (Math.abs(dx) >= 55 || (fast && Math.abs(dx) > 20))) turn(dx < 0 ? 1 : -1);
      else go(at); // (back to where it was)
    };
    box.addEventListener('touchend', e => release(e.changedTouches[0].clientX, false), { passive: true });
    box.addEventListener('touchcancel', () => release(drag ? drag.x0 : 0, true), { passive: true });
    addEventListener('resize', () => { if (!box.hidden) { cancelAnimationFrame(glideFrame); place(spot(at)); } });
    addEventListener('keydown', e => {
      if (box.hidden || at >= NAME || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { turn(e.key === 'ArrowLeft' ? -1 : 1); e.preventDefault(); e.stopPropagation(); }
    }, true);
  }
  return { show, setup, go, get step() { return at; }, get open() { return !$('sortiaIntro').hidden; } };
})();

// A new character after its name: its path (in the same book), then into the world
function newCharacterPath(onDone) {
  if (player.vocation !== 'none' || (navigator.webdriver && !/[?&]pickpath\b/.test(location.search))) { onDone(); return; }
  welcomeScene('paths');
  askPath(onDone);
}
// ...and in the world, its appearance: the outfit window, once, in the game's own look (its path's outfit to start
// from), a moment after the world comes into sight
function newCharacterInWorld() {
  welcome(false);
  if (navigator.webdriver && !/[?&]pickpath\b/.test(location.search)) return; // (browser tests: as with the path, only when they ask)
  const open = () => {
    if (typeof Preload !== 'undefined' && !Preload.ready) return setTimeout(open, 300); // (once the world is ready: not behind the loading screen)
    if ($('outfit').hidden && !document.body.classList.contains('welcome')) openOutfit();
  };
  setTimeout(open, 1200);
}

// ---- after the story: Oakvale's temple, and Sister Ama at your side -------------------------------------------------
// The welcome's picture gives way to the temple (06_character_creation: Oakvale's temple, Sister Ama's statue), and
// Sister Ama speaks, a line at a time (a tap shows them all), before you're asked your name (or, online, where you made
// the character at the login, before you go on to your outfit).
const AMA_WAKE = ['You\u2019re awake. We feared you wouldn\u2019t survive the night.', 'Tell me, traveler\u2026 what is your name?'];
const AMA_WAKE_ONLINE = ['You\'re awake. We feared you wouldn\'t survive the night.', '$name... you said it over and over in your sleep. Rest a moment; then tell me which path you will walk.'];
const stillMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// the picture behind the windows a character is made in: the temple (06, your name and your outfit), the hall of paths
// (07, your path); false: none
const SCENES = { temple: '06_character_creation', paths: '07_choose_your_path' };
function welcomeScene(name) {
  preloadPathArt(); // (the vocation screen's pictures, ahead of it)
  const el = $('templeScene');
  if (!name) { el.classList.remove('on'); el.hidden = true; el.dataset.scene = ''; return; }
  if (el.dataset.scene === name && !el.hidden) return;
  el.dataset.scene = name;
  el.style.backgroundImage = `url(${storyArt(SCENES[name])})`;
  if (el.hidden) { el.hidden = false; void el.offsetWidth; }
  el.classList.add('on');
}
const templeScene = on => welcomeScene(on ? 'temple' : false);
// Sister Ama's head and shoulders, as on her conversation card (her picture may still be on its way: tried again shortly)
function amaFace(canvas, tries = 12) {
  const ama = npcs.find(n => n.npcId === 'ama'), g = canvas.getContext('2d');
  const again = () => { if (tries > 0) setTimeout(() => amaFace(canvas, tries - 1), 400); };
  if (!ama || typeof Sprites === 'undefined') return again();
  try {
    const img = Sprites.creature(creatureKey(ama), 2, 0), r = img.res || 1, box = Sprites.faceBox(ama), big = Sprites.w(img) > TILE;
    g.clearRect(0, 0, canvas.width, canvas.height); g.imageSmoothingEnabled = r > 1;
    if (box) g.drawImage(img, box[0] * r, box[1] * r, box[2] * r, box[3] * r, 0, 0, canvas.width, canvas.height);
    else g.drawImage(img, (big ? TILE + 4 : 4) * r, (big ? TILE - 4 : -4) * r, 24 * r, 24 * r, 0, 0, canvas.width, canvas.height);
    if (!img.res && tries > 0) again(); // (the drawn stand-in: her own picture may come yet)
  } catch (e) { again(); }
}
// her lines into a speaker block, one after the other; resolves when they're all shown (at once with a tap)
function amaSays(block, lines) {
  const said = block.querySelector('.ob-said');
  amaFace(block.querySelector('.ob-face'));
  said.classList.remove('shown', 'enter'); void said.offsetWidth;
  said.replaceChildren(...lines.map((t, i) => h('p', { style: `--i: ${i}` }, t.replace(/\$name/g, player.name))));
  if (stillMotion()) said.classList.add('shown'); else said.classList.add('enter');
  block.onclick = () => said.classList.add('shown');
}

// A name as the server takes it (server.js login): letters, digits, spaces, ' and -, 2 to 20 of them. What's wrong
// with one, in a word, or null; '' for nothing typed yet (no word: the way on just waits).
function nameProblem(raw) {
  const t = raw.trim();
  if (!t) return '';
  if (/[^\w '-]/.test(t)) return 'Only letters, numbers, spaces, \' and - can be used.';
  if (t.replace(/[^\w '-]/g, '').slice(0, 20).length < 2) return 'At least 2 letters, please.';
  return null;
}
// keeps the way on shut while the name won't do, and says why under the field
function watchName(input, button) {
  const check = () => {
    const problem = nameProblem(input.value);
    $('createHint').textContent = problem || '';
    $('createHint').classList.toggle('bad', !!problem);
    input.setAttribute('aria-invalid', problem ? 'true' : 'false');
    button.disabled = problem !== null;
  };
  input.addEventListener('input', check);
  check();
  return check;
}
// (on a phone the keyboard rises: the window at the screen's foot rises with it, by --ob-kb, the keyboard's height as the
// browser's visual viewport tells it; the field is kept in sight inside the window)
let keyboardWatched = false;
function keepAboveKeyboard(input) {
  const vv = window.visualViewport;
  if (vv && !keyboardWatched) {
    keyboardWatched = true;
    const fit = () => {
      const kb = Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop));
      document.documentElement.style.setProperty('--ob-kb', `${kb}px`);
      document.documentElement.classList.toggle('ob-keyboard', kb > 80); // (a short screen folds Sister Ama's words away meanwhile)
    };
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit();
  }
  input.addEventListener('focus', () => setTimeout(() => {
    const win = input.closest('.ob-screen'); if (win && win.scrollHeight > win.clientHeight) win.scrollTop = Math.max(0, input.offsetTop - 80);
  }, 300));
}

// Your name, as a talk with Sister Ama on the story's parchment (sprites/ui/parchment/story-panel.webp, as it was painted,
// never stretched): her face, name and words, then the field, other ways to start and the way on, all real HTML in the
// picture's writing area (css/onboarding.css, .name-sheet). The login online keeps its own window (net.js).
function nameSheet(dialog) {
  if (dialog.classList.contains('name-sheet')) return;
  dialog.classList.add('name-sheet');
  dialog.querySelector('.ob-title').remove(); // (Sister Ama asks it herself)
  const hash = typeof SPRITE_HASHES !== 'undefined' && SPRITE_HASHES['ui/parchment/story-panel.webp'];
  const art = h('img', { className: 'ns-art', alt: '', draggable: false, src: `sprites/ui/parchment/story-panel.webp${hash ? `?h=${hash}` : ''}` });
  art.setAttribute('aria-hidden', 'true');
  const field = h('div', { className: 'ns-field' });
  const input = $('createName'); input.replaceWith(field); field.append(input);
  const talk = $('createAma'), form = h('div', { className: 'ns-form' }, field, $('createHint'), $('createMore'), dialog.querySelector('.ob-nav'));
  dialog.append(art, h('div', { className: 'ns-writing' }, h('div', { className: 'ns-talk' }, talk), form));
}

// SORTIA's gate (index.html #sortiaGate, css/gate.css): the first thing a page shows. While the game gets ready (its
// fonts and the opening's pictures) a gold line fills under the logo; then the way in: Create account or Log in. What
// an account is depends on where the game runs (game.js startOffline, net.js): this only shows the screen, checks
// what's typed and passes it on (ask's onSubmit), saying under the form what's wrong.
const Gate = (() => {
  let tab = 'create', opts = null, busy = false;
  const box = () => $('sortiaGate');
  const hashed = file => { const h = typeof SPRITE_HASHES !== 'undefined' && SPRITE_HASHES[file]; return `sprites/${file}${h ? `?h=${h}` : ''}`; };
  // a picture fetched now, so it's there when it's needed (done when it's in, or couldn't be)
  const fetchPicture = src => new Promise(done => { const img = new Image(); img.onload = img.onerror = () => done(); img.src = src; });
  // getting ready: shown at once; done once everything's in (but shown for a moment at least, and never kept long)
  function load(text) {
    const el = box();
    Sound.title.start('gate'); // (SORTIA's title music: The Shadowed Gate; the story has its own)
    el.hidden = false; el.classList.add('sg-in'); el.classList.remove('sg-out', 'sg-leaving');
    $('sgLoad').hidden = false; $('sgAuth').hidden = true;
    $('sgLoadText').textContent = text || 'Loading…';
    const jobs = [
      document.fonts && document.fonts.ready,
      fetchPicture(el.querySelector('.sg-logo').src),
      fetchPicture(hashed('ui/intro/panorama.webp')),
      fetchPicture(hashed('ui/intro/sortia-wordmark.webp')),
      new Promise(done => setTimeout(done, 900)),
    ].map(p => Promise.resolve(p).catch(() => {}));
    let finished = 0;
    const bar = $('sgBar');
    bar.style.width = '6%';
    for (const job of jobs) job.then(() => { finished++; bar.style.width = `${Math.round(6 + 94 * finished / jobs.length)}%`; });
    return Promise.race([Promise.all(jobs), new Promise(done => setTimeout(done, 6000))]).then(() => new Promise(done => setTimeout(done, 250)));
  }
  function setTab(t) {
    tab = t;
    const create = t === 'create';
    $('sgTabCreate').setAttribute('aria-selected', String(create));
    $('sgTabLogin').setAttribute('aria-selected', String(!create));
    $('sgConfirmRow').hidden = !create;
    $('sgMore').hidden = !create || !$('sgMore').querySelector('select');
    $('sgPass').autocomplete = create ? 'new-password' : 'current-password';
    $('sgPass').placeholder = create ? 'At least 6 characters' : 'Your password';
    $('sgPass').enterKeyHint = create ? 'next' : 'go';
    $('sgGoLabel').textContent = create ? 'Create account' : 'Log in';
    hint('');
    if (opts && opts.onTab) opts.onTab(t);
  }
  function hint(text, warn) {
    $('sgHint').textContent = text || '';
    $('sgHint').classList.toggle('sg-warn', !!warn);
    for (const id of ['sgName', 'sgPass', 'sgPass2']) $(id).setAttribute('aria-invalid', 'false');
  }
  // what's wrong with one field: said under the form, the field marked and in focus
  function wrong(field, text) {
    hint(text);
    $(field).setAttribute('aria-invalid', 'true');
    $(field).focus();
  }
  // the way in: o = { tab: 'create'|'login', name, note, message, onSubmit({ tab, name, password }), onTab(tab) }
  function ask(o) {
    opts = o || {};
    busy = false;
    const el = box();
    el.hidden = false; el.classList.remove('sg-out');
    el.classList.add('sg-leaving');
    $('sgLoad').hidden = true; $('sgAuth').hidden = false;
    $('sgGo').disabled = false;
    if (opts.name && !$('sgName').value) $('sgName').value = opts.name;
    $('sgPass').value = ''; $('sgPass2').value = '';
    $('sgNote').textContent = opts.note || '';
    setTab(opts.tab || tab);
    if (opts.message) hint(opts.message);
    if (!touchScreen) ($('sgName').value ? $('sgPass') : $('sgName')).focus({ preventScroll: true });
  }
  // waiting for an answer (the server's): the button shut, saying so
  function wait(text) {
    busy = true;
    $('sgGo').disabled = true;
    $('sgGoLabel').textContent = text || 'One moment…';
  }
  // something went wrong after all: back to the form, saying what
  function refuse(message) {
    if (!opts) return ask({ message });
    busy = false;
    $('sgGo').disabled = false;
    $('sgGoLabel').textContent = tab === 'create' ? 'Create account' : 'Log in';
    hint(message || '');
    $('sgPass').value = ''; $('sgPass2').value = '';
  }
  function close() {
    const el = box();
    if (el.hidden) return;
    opts = null; busy = false;
    el.classList.add('sg-out');
    setTimeout(() => { if (el.classList.contains('sg-out')) { el.hidden = true; el.classList.remove('sg-out', 'sg-in', 'sg-leaving'); } }, 450);
  }
  function setup() {
    const el = box();
    if (!el) return;
    el.querySelector('.sg-logo').src = hashed('ui/loading/logo.png');
    $('sgTabCreate').onclick = () => setTab('create');
    $('sgTabLogin').onclick = () => setTab('login');
    for (const id of ['sgName', 'sgPass', 'sgPass2']) {
      $(id).addEventListener('input', () => { if ($('sgHint').textContent && !$('sgHint').classList.contains('sg-warn')) hint(''); });
      $(id).addEventListener('keydown', e => e.stopPropagation()); // (the game's keys don't fire while you type)
    }
    $('sgForm').addEventListener('submit', e => {
      e.preventDefault();
      if (busy || !opts) return;
      const name = $('sgName').value, password = $('sgPass').value;
      const problem = nameProblem(name);
      if (problem !== null) return wrong('sgName', problem || 'Enter a character name.');
      if (tab === 'create' && password.length < 6) return wrong('sgPass', 'Choose a password of at least 6 characters.');
      if (tab === 'login' && !password) return wrong('sgPass', 'Enter your password.');
      if (tab === 'create' && $('sgPass2').value !== password) return wrong('sgPass2', 'The two passwords aren\'t the same.');
      if (opts.onSubmit) opts.onSubmit({ tab, name: capitalize(name.trim().replace(/[^\w '-]/g, '').slice(0, 20)), password });
    });
  }
  return { load, ask, wait, refuse, hint, close, setup, setTab, isOpen: () => !box().hidden, tab: () => tab };
})();

// A new character, offline: the story, the temple and Sister Ama, your name, your path; your outfit in the world.
function showCharacterCreation(onDone, name) { // (name: already chosen, with the account; then the opening doesn't ask it)
  const dialog = $('create');
  welcome(true);
  const input = $('createName'), go = $('createStart');
  nameSheet(dialog);
  go.textContent = 'Continue';
  const start = $('createTest') || testStarts(); // (made already when the account was: chosen there)
  if (!name) { $('createMore').append(start); $('createMore').hidden = false; }
  watchName(input, go);
  keepAboveKeyboard(input);
  // the opening (Intro), your name in it; then your path. Browser tests without ?story: the plain name window, as before.
  const quick = navigator.webdriver && !/[?&](story|gate)\b/.test(location.search);
  if (quick) {
    templeScene(true);
    $('createAma').hidden = false;
    amaSays($('createAma'), AMA_WAKE);
    dialog.hidden = false;
    if (!touchScreen) input.focus();
  } else {
    if (name) { input.value = name; Intro.show({ name, onDone: () => done() }); } else {
      const more = $('siMore'); more.append(start); more.hidden = false; // (the test starts, under the name there)
      Intro.show({ askName: true, onName: n => { input.value = n; }, onDone: () => done() });
    }
  }
  let sent = false; // (once: a double tap makes one character)
  const done = () => {
    if (sent || nameProblem(input.value) !== null) return;
    sent = true;
    player.name = capitalize(input.value.trim().replace(/[^\w '-]/g, '').slice(0, 20));
    guideFolded = false; try { localStorage.setItem('tilequest.guideFolded', '0'); } catch (e) { /* no storage */ } // (a new character: the guide open)
    dialog.hidden = true;
    if (start.value) makeTestHero(start.value);
    newCharacterPath(() => { newCharacterInWorld(); if (onDone) onDone(); });
  };
  go.addEventListener('click', done);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') done();
    e.stopPropagation();
  });
}

// for testing: start as a level 100 character with the best gear (see makeTestHero), under "Other ways to start"
function testStarts() {
  const start = document.createElement('select');
  start.id = 'createTest';
  start.setAttribute('aria-label', 'How to start');
  start.add(new Option('Normal start (level 1, with the guide)', ''));
  for (const v of Object.keys(TEST_HERO_SKILLS).filter(v => !VOCATIONS[v].retired)) start.add(new Option(`Test: level ${TEST_HERO_LEVEL} ${vocName(v)}, best gear`, v));
  return start;
}

// A new character, online (made at the login): the story, the temple, Sister Ama knows your name; then your path
function greetNewCharacter(onDone) {
  templeScene(true);
  const win = ParchmentPanel.decorate($('amaGreet'), { scroll: true });
  amaSays(win.querySelector('.ob-speaker'), AMA_WAKE_ONLINE);
  win.hidden = false;
  let sent = false;
  $('amaGreetGo').onclick = () => { if (sent) return; sent = true; win.hidden = true; onDone(); };
}
