'use strict';
// Touch controls for phones and tablets. The map itself is the controller: tap
// to click, long-press to use, swipe or hold-and-steer to walk (see game.js).
// Around it: the status bar on top (round map, health, mana, experience, menu); the action bar at the bottom (spells
// left, potions and food right, the smart button between); fight mode and chase while fighting; the chat and the side
// panel as drawers. (A stick shows under your thumb only while you drag over the map: mobile-hud.js.)
// Shown on touch screens, or anywhere with ?mobile in the address.

// (touchScreen: whether this is a touch screen, is defined in game-ui.js, which loads first and needs it from the first frame)

// Browser storage can be missing (private mode): then favourites just aren't remembered.
const touchStorage = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch (e) {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* not remembered */ }
  },
};

function setTouchMode(mode) {
  touchMode = mode;
  canvas.classList.toggle('targeting', !!mode);
}

// Fullscreen where the browser can (Safari on an iPad only knows its webkit version; an
// iPhone can't at all, except for a page opened from the home screen).
function toggleFullscreen() {
  const root = document.documentElement, doc = document;
  if (doc.fullscreenElement || doc.webkitFullscreenElement) return (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
  const enter = root.requestFullscreen || root.webkitRequestFullscreen;
  if (!enter) return log('Fullscreen: add this page to your home screen (Share > Add to Home Screen), then open it from there.');
  Promise.resolve(enter.call(root, { navigationUI: 'hide' }))
    .then(() => touchScreen && screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}))
    .catch(() => log('Your browser did not allow fullscreen.'));
}

function setChat(open, focus) {
  if (open && typeof InventoryDrawer !== 'undefined') InventoryDrawer.close();
  document.body.classList.toggle('chat-open', open);
  // opened, it shows the newest messages: scrolled to the bottom (while it was shut the log couldn't follow them)
  if (open) requestAnimationFrame(() => { const l = $('log'); l.scrollTop = l.scrollHeight; });
  if (open && typeof hideTalk === 'function') hideTalk(); // (the chat shows the talk too)
  if (open && focus) $('chat').focus();
  if (!open) {
    $('chat').blur();
    // Closing NPC chat also cancels the dialogue; walking away must not reopen it.
    if (player && player.conversation) endConversation(true);
    if (player && player.action && player.action.kind === 'talk') player.action = null;
  }
}

// ---- favourites: round the action button, two pinned spells (or potions, or food) and the two potions ------------
// Tap to use; hold for a moment (the button fills up) to choose what goes there.
const FAV_HOLD = 650;
// (by name and the character's own mark: a new character of the same name starts with empty buttons; an old one,
// from before the mark, keeps what it had under its name)
const favKey = () => `tilequest.favs.${player.name.toLowerCase()}${player.born ? `.${player.born}` : ''}`;
let favPickSlot = null, favHold = null, favShown = '', favPageIndex = 0;
const FAV_SLOTS = 3, FAV_PAGES = 3, FAV_FIXED = 9; // two of your own (spells), and the two potions
let favItemPage = 0;
const favIndex = slot => slot < FAV_SLOTS ? favPageIndex * FAV_SLOTS + slot : FAV_SLOTS * FAV_PAGES + favItemPage * 3 + slot - FAV_SLOTS;

function favourites() {
  const saved = touchStorage.get(favKey());
  if (Array.isArray(saved) && saved.length === FAV_SLOTS * FAV_PAGES + FAV_FIXED) return saved;
  const slots = Array(FAV_SLOTS * FAV_PAGES + FAV_FIXED).fill(null);
  if (Array.isArray(saved)) {
    // From an older layout (more pages, more slots): keep the first spells the player pinned.
    saved.filter(id => id && !['h', 'm'].includes(id)).slice(0, FAV_SLOTS).forEach((id, i) => { slots[i] = id; });
  } // (a new character: every button empty but the two potions; the guide shows how to fill them)
  slots[FAV_SLOTS * FAV_PAGES] = 'h';
  slots[FAV_SLOTS * FAV_PAGES + 1] = 'm';
  return slots;
}

// A spell just learned goes on the first free spell button by itself, so it's there to tap (a phone has no keys).
// Torchlight waits while the guide still has to show how to put it there.
function pinNewSpells(entries) {
  const known = touchStorage.get(favKey() + '.known'), now = entries.filter(e => SPELLS[e.id] && !e.locked).map(e => e.id);
  if (!Array.isArray(known)) { touchStorage.set(favKey() + '.known', now); return; } // (first time: what's known already stays as it is)
  const fresh = now.filter(id => !known.includes(id));
  if (!fresh.length) return;
  const torchStep = GUIDE.findIndex(st => st.art === 'torch'), favs = favourites();
  for (const id of fresh) {
    if (id === 'light' && player.tutorial && player.tutorial - 1 <= torchStep) continue;
    known.push(id);
    const free = favs.slice(0, FAV_SLOTS * FAV_PAGES).indexOf(null);
    if (!favs.includes(id) && free >= 0) favs[free] = id;
  }
  touchStorage.set(favKey(), favs);
  touchStorage.set(favKey() + '.known', known);
}

function useFav(slot) {
  const e = hotbarEntries().find(x => x.id === favourites()[favIndex(slot)]);
  if (!e) openFavPicker(slot);
  else if (!e.locked && player && !paused) e.act();
}

let favPageOwner = '';
function renderFavs() {
  if (!touchScreen || !player) return;
  if (favPageOwner !== favKey()) {
    favPageOwner = favKey();
    const saved = touchStorage.get(favKey() + '.pages') || [0, 0];
    favPageIndex = Math.max(0, Math.min(2, Number(saved[0]) || 0));
    favItemPage = Math.max(0, Math.min(2, Number(saved[1]) || 0));
    favShown = '';
    if (typeof ActionSlots !== 'undefined') { ActionSlots.showSet(false, favPageIndex, 3); ActionSlots.showSet(true, favItemPage, 3); }
  }
  const entries = hotbarEntries();
  pinNewSpells(entries);
  const favs = favourites();
  const current = [...favs.slice(favPageIndex * FAV_SLOTS, (favPageIndex + 1) * FAV_SLOTS), ...favs.slice(9 + favItemPage * 3, 12 + favItemPage * 3)];
  const shown = current.map(id => entries.find(x => x.id === id)).map(e => (e ? `${e.name}|${e.sub}|${e.locked}` : '-'));
  shown.push(JSON.stringify(player.autoHeal || {})); // (a potion's auto-heal mark)
  if (favHold || shown.join() === favShown) return; // redrawing mid-press would lose the press
  favShown = shown.join();
  const root = $('favs');
  root.replaceChildren();
  current.forEach((id, slot) => {
    const e = entries.find(x => x.id === id);
    const b = document.createElement('button');
    b.className = `fav${e && e.locked ? ' locked' : ''}${e ? '' : ' empty'}`;
    ActionSlots.paint(b, e); // (its picture, cost and cooldown: see action-slots.js; an empty one is a +, hold it to choose)
    b.title = e ? e.name : 'Hold to choose a spell or potion for this button';
    b.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      if (favHold) { clearTimeout(favHold.timer); favHold.el.classList.remove('holding'); }
      b.classList.add('holding');
      favHold = { slot, el: b, held: false, id: ev.pointerId, x: ev.clientX, y: ev.clientY };
      b.setPointerCapture(ev.pointerId);
      favHold.timer = setTimeout(() => {
        favHold.held = true;
        b.classList.remove('holding');
        if (navigator.vibrate) navigator.vibrate(30);
        openFavPicker(slot);
      }, FAV_HOLD);
    });
    b.addEventListener('pointermove', ev => {
      if (!favHold || favHold.id !== ev.pointerId || favHold.held) return;
      const dx = ev.clientX - favHold.x, dy = ev.clientY - favHold.y;
      if (Math.hypot(dx, dy) > 12) { clearTimeout(favHold.timer); favHold.moved = true; b.classList.remove('holding'); }
      favHold.dx = dx; favHold.dy = dy;
    });
    b.addEventListener('contextmenu', ev => ev.preventDefault());
    root.appendChild(b);
  });
}

function endFavPress(use) {
  if (!favHold) return;
  clearTimeout(favHold.timer);
  favHold.el.classList.remove('holding');
  const press = favHold; favHold = null;
  if (use && !press.held && press.moved && Math.abs(press.dx) > 35 && Math.abs(press.dx) > Math.abs(press.dy) * 1.3) {
    const delta = press.dx < 0 ? 1 : -1;
    if (press.slot < 3) favPageIndex = (favPageIndex + delta + 3) % 3;
    else favItemPage = (favItemPage + delta + 3) % 3;
    touchStorage.set(favKey() + '.pages', [favPageIndex, favItemPage]);
    favShown = ''; renderFavs();
    ActionSlots.showSet(press.slot >= 3, press.slot < 3 ? favPageIndex : favItemPage, 3);
    // the group's new set slides in a little from the side it was swiped from, and settles (the other group stays)
    const root = typeof document !== 'undefined' && document.getElementById ? document.getElementById('favs') : null;
    const group = root && root.children ? Array.from(root.children).slice(press.slot < 3 ? 0 : 3, press.slot < 3 ? 3 : 6) : [];
    for (const el of group) { el.classList.remove('snap-left', 'snap-right'); void el.offsetWidth; el.classList.add(delta > 0 ? 'snap-left' : 'snap-right'); }
  } else if (use && !press.held && !press.moved) useFav(press.slot);
}

function openFavPicker(slot) {
  favPickSlot = slot;
  const list = $('favList');
  list.replaceChildren();
  const clear = document.createElement('button'); clear.textContent = 'Empty slot'; clear.className = 'pick-clear';
  clear.onclick = () => { const favs = favourites(); favs[favIndex(slot)] = null; touchStorage.set(favKey(), favs); closeFavPicker(); favShown = ''; renderFavs(); };
  for (const e of hotbarEntries()) {
    const b = document.createElement('button');
    b.className = 'hot';
    b.dataset.action = e.id; // (the guide points at Eat here)
    b.disabled = !!e.locked;
    // its picture, its whole name with what it does under it, and what it costs (or the level it needs)
    b.innerHTML = '<span class="pick-main"><span class="pick-text"><b></b><em></em></span></span><small></small>';
    b.querySelector('b').textContent = e.name;
    b.querySelector('em').textContent = favWhat(e.id);
    const art = ActionSlots.art(e.id);
    if (art) b.querySelector('.pick-main').prepend(Object.assign(new Image(), { src: art, alt: '', className: 'pick-art' }));
    const cost = SPELLS[e.id] && !e.locked ? SPELLS[e.id].mana : null;
    if (cost !== null) b.querySelector('small').replaceChildren(Icons.img('drop', 12), ` ${cost}`);
    else b.querySelector('small').textContent = e.sub;
    b.addEventListener('click', () => {
      const favs = favourites();
      favs[favIndex(favPickSlot)] = e.id;
      touchStorage.set(favKey(), favs);
      closeFavPicker();
      favShown = '';
      renderFavs();
    });
    list.appendChild(b);
  }
  list.appendChild(clear); // (last: at the bottom, by the thumb)
  $('favPicker').hidden = false;
  list.scrollTop = list.scrollHeight; // (the list rises from the action bar: its end, by the thumb, in sight)
}
function closeFavPicker() {
  $('favPicker').hidden = true;
  if (typeof SmartButton !== 'undefined') SmartButton.refresh($('tAttack'));
}
// What a choice for an action button does, in a few words: a spell's own description, a potion's numbers
function favWhat(id) {
  if (SPELLS[id]) return SPELLS[id].desc || '';
  const use = id => (ITEMS[id] && ITEMS[id].use) || {};
  if (id === 'h') { const h = use('health_potion').heal; return h ? `Heals ${h[0]}-${h[1]} hitpoints. From your backpack.` : 'Drink a health potion.'; }
  if (id === 'm') { const m = use('mana_potion').mana; return m ? `Restores ${m[0]}-${m[1]} mana. From your backpack.` : 'Drink a mana potion.'; }
  if (id === 'f') return 'Eats something from your backpack: you heal slowly while fed.';
  return '';
}

// Messages pop up near the top of the map (under the status bar and the guide) for a few seconds, as the log is put away on a phone.
// With the chat line under the action bar (chat-line.js) every message shows there: only what matters most pops up
// as well (a new level, a quest, a raid), so the map isn't covered for every word.
const TOAST_KINDS = new Set(['level', 'quest', 'raid']);
function toast(text, kind) {
  if (!touchScreen || document.body.classList.contains('chat-open')) return;
  if (kind === 'damage') return; // (the numbers over your head say it already)
  if (document.getElementById('chatLine') && !TOAST_KINDS.has(kind)) return;
  const box = $('toasts'), line = document.createElement('div');
  // just under the status bar, or under the guide or a corpse's window when they show: clear of you in the middle of the map
  const shown = id => { const el = $(id); return el && !el.hidden && el.offsetParent && getComputedStyle(el).display !== 'none' ? el.getBoundingClientRect().bottom : 0; };
  const under = Math.max($('touch').querySelector('.hud').getBoundingClientRect().bottom, shown('guide'), shown('lootBox')) - $('touch').getBoundingClientRect().top;
  box.style.top = `${Math.round(under + 6)}px`;
  line.className = `toast ${kind || ''}`;
  line.textContent = text;
  box.appendChild(line);
  while (box.children.length > 2) box.firstChild.remove(); // the two newest
  setTimeout(() => line.remove(), 3500);
}

function initTouch() {
  if (!touchScreen) return;
  document.body.classList.add('touch-ui');
  $('touch').hidden = false;
  // The loot window and the backpack float over the map, so you needn't open the drawer for them.
  $('viewport').appendChild($('lootBox'));
  $('viewport').appendChild($('containers'));
  // the game's own icons on the bottom buttons and the close buttons
  for (const [id, icon] of [['tabChar', 'character'], ['tabQuests', 'quests']]) $(id).querySelector('span').replaceChildren(Icons.img(icon, 24));
  // the map starts under the status bar: keep its height in --hud-h for the viewport's padding (css/phone/layout.css)
  const hud = document.querySelector('#touch .hud');
  let hudH = -1;
  const hudHeight = () => requestAnimationFrame(() => { // (after the layout, so the observer doesn't loop)
    const h = Math.max(0, Math.ceil(hud.getBoundingClientRect().bottom - $('viewport').getBoundingClientRect().top));
    if (h === hudH) return;
    hudH = h;
    document.body.style.setProperty('--hud-h', `${h}px`);
    fitView();
  });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(hudHeight).observe(hud);
  window.addEventListener('resize', hudHeight);
  for (const id of ['panelClose', 'talkClose']) $(id).replaceChildren(Icons.img('close', 20));
  // Help for a phone, not for a keyboard
  $('tab-help').innerHTML = `<ul class="help">
    <li><b>Walk</b>: tap where to go, or drag over the map.</li>
    <li><b>The big button</b>: attacks the nearest monster, talks to someone next to you, opens a corpse or uses a door; its colour says which. It keeps working while your backpack or the chat is open.</li>
    <li><b>Tap</b> a monster to attack it, someone to talk to them. <b>Hold</b> them for more (follow, look, open a corpse under them).</li>
    <li><b>Action buttons</b> either side of the big one: spells on the left, potions and food on the right. Tap to use, hold to choose what goes there, swipe sideways for the next set.</li>
    <li><b>Talking</b>: tap the gold words, or tap the chat line above the buttons to type. Say "hi" to someone to start.</li>
    <li><b>The backpack</b> at the end of the chat line: your gear, its attack, defense and armor, and your bag (<b>Skills ›</b> for your skills; swipe its tab up for more, down to close, or touch the map). Along its bottom the tabs <b>Map</b> (tap a spot to walk there), <b>Quests</b> and <b>Settings</b> (sound, quality, outfit and more).</li>
    <li><b>The map button</b> in the top left corner: the map round you; Full map for the whole world.</li>
    <li>While fighting, buttons by the map set how you fight and whether you chase.</li>
  </ul>`;

  const tap = (id, fn) => (typeof id === 'string' ? $(id) : id).addEventListener('click', e => {
    e.preventDefault();
    if (player && !paused) fn();
  });
  tap('tAttack', () => SmartButton.press());
  tap('panelClose', () => closeSheet());
  for (const id of ['tabChar', 'tabQuests']) tap(id, () => toggleSheet($(id).dataset.sheet));
  tap('talkClose', () => { if (player.conversation) Actions.say('bye'); hideTalk(); });
  for (const b of document.querySelectorAll('#fightModes button')) {
    b.replaceChildren(Icons.img({ offensive: 'mode-attack', balanced: 'mode-balanced', defensive: 'mode-defend' }[b.dataset.mode], 24));
    tap(b, () => Actions.setFightMode(b.dataset.mode));
  }
  $('fightFollow').replaceChildren(Icons.img('mode-follow', 24));
  tap('fightFollow', () => Actions.setChase(!player.chase));
  $('chatClose').addEventListener('click', () => setChat(false));
  $('favPickerClose').addEventListener('click', closeFavPicker);
  document.addEventListener('pointerup', e => { if (favHold && favHold.id === e.pointerId) endFavPress(true); });
  document.addEventListener('pointercancel', () => endFavPress(false));
  // Touching the map puts the drawer away.
  canvas.addEventListener('pointerdown', () => { document.body.classList.remove('panel-open'); if (InventoryDrawer.stage()) InventoryDrawer.close(); });
  window.addEventListener('resize', fitView);
  fitView();
  // Health and mana stay in sight while the panel is put away, and so do the fight settings.
  let fightShown = '', fightingUntil = 0, lastHp = 0;
  setInterval(() => {
    if (!player) return;
    SmartButton.refresh($('tAttack'));
    const fight = `${player.fightMode}|${player.chase}|${player.secure}`;
    if (fight !== fightShown) {
      fightShown = fight;
      for (const b of document.querySelectorAll('#fightModes button')) b.classList.toggle('active', b.dataset.mode === player.fightMode);
      $('fightFollow').classList.toggle('active', !!player.chase);
    }
    // the fight bar shows while you fight: with a target, or for a while after something hit you
    // (not after a death, nor in the temple, a shop or the depot: nothing to fight there)
    if (player.dead) fightingUntil = 0;
    else if (player.target || player.hp < lastHp) fightingUntil = now + 6000;
    lastHp = player.hp;
    document.body.classList.toggle('fighting', now < fightingUntil && !player.dead && !inPZ(player));
    for (const [bar, v, max] of [['Hp', player.hp, player.maxHp], ['Mana', player.mana, player.maxMana]]) {
      setWidth($(`tb${bar}`), `${(100 * v) / max}%`);
      setText($(`tb${bar}Text`), `${v} / ${max}`);
    }
    // the status bar: level, experience to the next one, gold, and a red edge when you're nearly dead
    setText($('hudLvl'), player.level);
    setText($('hudName'), player.name);
    setText($('hudTitle'), `Level ${player.level} · ${player.vocation === 'none' ? 'Adventurer' : capitalize(player.vocation)}`);
    const faceKey = creatureKey(player) + player.dir;
    if (faceKey !== hudFaceKey) { // the portrait: your own head and shoulders, big
      hudFaceKey = faceKey;
      const img = Sprites.creature(creatureKey(player), 2, 0), big = Sprites.w(img) > TILE, r = img.res || 1, f = $('hudFace').getContext('2d');
      f.clearRect(0, 0, 128, 128);
      f.imageSmoothingEnabled = r > 1;
      const tall = Sprites.headroom(player), box = Sprites.faceBox(player); // (a tall or tilted figure's head is elsewhere on its picture)
      if (box) f.drawImage(img, box[0] * r, box[1] * r, box[2] * r, box[3] * r, 0, 0, 128, 128);
      else if (tall) f.drawImage(img, (TILE + 8) * r, (TILE - tall - 2) * r, 16 * r, 16 * r, 0, 0, 128, 128);
      else f.drawImage(img, (big ? TILE + 5 : 5) * r, (big ? TILE - 6 : -6) * r, 22 * r, 22 * r, 0, 0, 128, 128);
    }
    const lo = xpForLevel(player.level), hi = xpForLevel(player.level + 1);
    const xpProgress = Math.max(0, Math.min(100, (100 * (player.xp - lo)) / (hi - lo)));
    setWidth($('hudXp'), `${xpProgress}%`);
    setText($('hudXpText'), `${Math.floor(xpProgress)}%`);
    setHTML($('hudGold'), `<img src="${Icons.url('coins')}" alt="">${player.gold.toLocaleString('en')}`);
    document.body.classList.toggle('low-hp', player.hp > 0 && player.hp < player.maxHp * 0.25);
    if (document.body.dataset.sheet === 'menu') renderMenu();
    if (!$('talk').hidden && ((!player.conversation && now > talkShownAt + 1500) || player.shopNpc)) hideTalk(); // the talk is over, or a shop opened
  }, 250);
}

// ---- sheets: Character, Quests and Menu come up from the bottom, over the map ----------------------------------
// They are the side panel, showing only what belongs to them (body[data-sheet], body[data-seg]; see css/phone/layout.css).
const SHEETS = {
  character: { title: () => `${player.name} · level ${player.level}`, segs: [['equipment', 'Equipment'], ['bag', 'Bag'], ['skills', 'Skills']] },
  quests: { title: () => 'Quests' },
  menu: { title: () => 'Menu', segs: [['settings', 'Settings'], ['help', 'Help']] },
};
function openSheet(kind, seg) {
  // on a phone the drawer has them all now, as tabs in reach of the thumb (inventory-drawer.js)
  if (typeof InventoryDrawer !== 'undefined' && $('inventoryDrawer')) {
    if (kind === 'character' && seg === 'skills') return InventoryDrawer.skills();
    if (kind === 'menu' && seg === 'help') return InventoryDrawer.show('settings', 2, 'tab-help');
    return InventoryDrawer.show(kind === 'quests' ? 'quests' : kind === 'menu' ? 'settings' : 'gear');
  }
  const sheet = SHEETS[kind];
  if (typeof InventoryDrawer !== 'undefined') InventoryDrawer.close(); // (it holds the equipment and bags: they go home first)
  setChat(false);
  document.body.classList.add('panel-open');
  document.body.classList.remove('bag-open');
  document.body.dataset.sheet = kind;
  // the bag shows in the Character sheet; otherwise it floats over the map (bag-open)
  if (kind === 'character') $('panel').insertBefore($('containers'), document.querySelector('.panel .sec-tabs'));
  else $('viewport').appendChild($('containers'));
  $('sheetTitle').textContent = sheet.title();
  const seg0 = seg || (sheet.segs ? sheet.segs[0][0] : '');
  document.body.dataset.seg = seg0;
  $('sheetSeg').replaceChildren(...(sheet.segs || []).map(([id, label]) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.classList.toggle('active', id === seg0);
    b.addEventListener('click', () => openSheet(kind, id));
    return b;
  }));
  const tab = kind === 'quests' ? 'quests' : document.body.dataset.seg === 'skills' ? 'skills' : document.body.dataset.seg === 'help' ? 'help' : null;
  if (tab) { const b = document.querySelector(`[data-tab="${tab}"]`); if (b) b.click(); }
  if (kind === 'menu') { menuShown = ''; renderMenu(); }
  for (const b of document.querySelectorAll('.tabbar button')) b.classList.toggle('active', b.dataset.sheet === kind);
  $('panel').scrollTop = 0;
}
function closeSheet() {
  document.body.classList.remove('panel-open');
  $('viewport').appendChild($('containers'));
  delete document.body.dataset.sheet;
  for (const b of document.querySelectorAll('.tabbar button')) b.classList.remove('active');
}
function toggleSheet(kind) {
  if (document.body.classList.contains('panel-open') && document.body.dataset.sheet === kind) closeSheet();
  else openSheet(kind);
}

// The Menu: how you fight, and the settings.
let menuShown = '';
function renderMenu() {
  if (document.body.dataset.seg !== 'settings') return;
  const sound = $('soundBtn').textContent, music = $('musicBtn').textContent;
  const pet = player.pet, petState = pet ? `${pet.name}:${pet.home}:${!!pet.downUntil}` : ''; // (its row says where your companion is)
  const key = `${sound}|${music}|${speedMeter.on}|${quality}|${FRAME_INTERVAL}|${petState}|${pet ? pet.level : 0}|${player.level}|${JSON.stringify(player.autoHeal || {})}`;
  if (key === menuShown) return;
  menuShown = key;
  const root = $('menuSec'), h = (tag, props, ...kids) => { const el = Object.assign(document.createElement(tag), props || {}); el.append(...kids); return el; };
  const row = (label, right, onTap, extra) => {
    const r = h('button', { className: `menu-row${extra ? ` ${extra}` : ''}` }, h('span', {}, ...[].concat(label)), right);
    if (onTap) r.addEventListener('click', onTap);
    return r;
  };
  const toggle = on => h('span', { className: `toggle${on ? ' on' : ''}` });
  root.replaceChildren(
    h('div', { className: 'menu-head' }, 'Game'),
    row('Sound', toggle(/on/i.test(sound)), () => $('soundBtn').click()),
    row('Music', toggle(/on/i.test(music)), () => $('musicBtn').click()),
    h('div', { className: 'menu-sub' }, h('span', {}, 'Quality ', h('small', {}, { high: 'everything', medium: 'no drifting clouds or weather, a little less sharp', low: 'the smoothest: also no ripples, coarser' }[quality]))),
    h('div', { className: 'seg' }, ...['low', 'medium', 'high'].map(q => {
      const b = h('button', { className: quality === q ? 'active' : '' }, q[0].toUpperCase() + q.slice(1));
      b.addEventListener('click', () => { setQuality(q); const l = $('qualityBtn'); if (l) l.textContent = `Quality: ${quality}`; renderMenu(); });
      return b;
    })),
    row(['60 frames a second', h('small', {}, FRAME_INTERVAL < 20 ? 'On: the smoothest' : 'Off: 30, a cooler phone and a longer battery')], toggle(FRAME_INTERVAL < 20), () => { setFrameRate(FRAME_INTERVAL < 20 ? 30 : 60); const b = $('fpsBtn'); if (b) b.textContent = `${Math.round(1000 / FRAME_INTERVAL)} fps`; renderMenu(); }),
    row(['Speed meter', h('small', {}, speedMeter.on ? 'On: frames a second and stalls, top left' : 'Off: for finding out where the game stalls')], toggle(speedMeter.on), () => { setSpeedMeter(!speedMeter.on); renderMenu(); }),
    row('Chat', h('span', {}, '›'), () => { closeSheet(); setChat(true, true); }),
    h('div', { className: 'menu-head' }, 'Auto-heal'),
    h('div', { className: 'menu-sub' }, h('span', {}, 'Drink a potion by itself ', h('small', {}, 'below this much health or mana, from your backpack'))),
    autoHealControls(),
    ...(player.pet ? [row([player.pet.name, h('small', {}, player.pet.downUntil ? 'Resting at the temple' : player.pet.home ? 'Waiting at the temple: tap to call' : 'With you: tap to send home')], h('span', {}, '›'), player.pet.downUntil ? null : () => { (player.pet.home ? Actions.petCall() : Actions.petHome()); menuShown = ''; renderMenu(); })] : []), // (resting: nothing to tap)
    row(['The guide', h('small', {}, player.vocation === 'none' ? 'From the start: how everything works' : 'For the starter island')], h('span', {}, '›'), () => { Actions.restartGuide(); InventoryDrawer.close(); }),
    row('Outfit', h('span', {}, '›'), () => { closeSheet(); InventoryDrawer.close(); openOutfit(); }),
    row('Party & guild', h('span', {}, '›'), () => { closeSheet(); InventoryDrawer.close(); $('guildBtn').click(); }),
    row('Fullscreen', h('span', {}, '›'), () => toggleFullscreen()),
    h('div', { className: 'menu-head' }, 'Make'),
    row(['Map editor', h('small', {}, 'Draw and change the world')], h('span', {}, '›'), () => { location.href = 'editor.html'; }),
    row(['Data editor', h('small', {}, 'Items, monsters and NPCs, in this browser')], h('span', {}, '›'), () => { location.href = 'data.html'; }),
    // (a test character playing alone: Clang at its level, if it was made before test characters got him)
    ...(!Net.online && isTestHero() && !(pet && pet.level >= player.level) ? [row(['Test: Clang at level ' + player.level, h('small', {}, 'For trying things out')], h('span', {}, '›'),
      () => { giveTestClang(); log(`${player.pet.name} is at your side, at level ${player.level}.`, 'quest'); menuShown = ''; renderMenu(); })] : []),
    ...(!Net.online && wantsTestSpear() ? [row(['Test: spears (circle throw)', h('small', {}, 'Hold one, say "hasta orbis"')], h('span', {}, '›'),
      () => { giveTestSpear(); menuShown = ''; renderMenu(); })] : []),
    row('New character', h('span', {}, '›'), () => $('newChar').click(), 'danger'),
  );
}

// ---- the talk card: what an NPC says to you, its keywords as buttons -------------------------------------------
let talkShownAt = 0, hudFaceKey = '';
let talkSpeaker = '', talkLines = [];
function showTalk(speaker, text) {
  // lines that come together (a greeting, then what they have for you) show together
  talkLines = speaker === talkSpeaker && !$('talk').hidden && now - talkShownAt < 800 ? [...talkLines, text] : [text];
  talkSpeaker = speaker;
  text = talkLines.join(' ');
  const npc = npcs.find(n => n.name === speaker);
  $('talkName').textContent = speaker;
  $('talkWhere').textContent = npc && map.labels ? (map.labels.find(l => l.z === npc.z && Math.abs(l.x - npc.x) < 25 && Math.abs(l.y - npc.y) < 25) || {}).text || '' : '';
  const p = $('talkText'), words = $('talkWords');
  p.replaceChildren();
  const seen = [];
  for (const part of String(text).split(/(\{[^}]+\})/)) {
    const m = /^\{(.+)\}$/.exec(part);
    if (!m) { p.append(part); continue; }
    const u = document.createElement('u');
    u.textContent = m[1];
    p.appendChild(u);
    if (!seen.includes(m[1].toLowerCase())) seen.push(m[1].toLowerCase());
  }
  // the word for a quest (what this NPC has for you, or what you're to tell them) stands out
  const questWords = new Set(), reportWords = new Set();
  if (npc) {
    const news = questNews(npc.npcId);
    if (news && news.word) (news.mark === 'report' ? reportWords : questWords).add(news.word.toLowerCase());
    for (const id of Object.keys(player.quests || {})) {
      if (!QUESTS[id] || player.quests[id].status !== 'active' || (questStep(id).npc || QUESTS[id].giver) !== npc.npcId) continue;
      const w = questWord(npc.npcId, id);
      if (w) questWords.add(w.toLowerCase());
    }
  }
  // (once they've asked you something about it, the answer they wait for is the one that shines: yes)
  if (seen.includes('yes') && (questWords.size || reportWords.size)) { questWords.clear(); reportWords.clear(); questWords.add('yes'); }
  // (a quest's word first: what they have for you, or what you've come to tell them)
  const first = w => (reportWords.has(w) ? 0 : questWords.has(w) ? 1 : 2);
  seen.sort((a, b) => first(a) - first(b));
  words.replaceChildren(...seen.map(w => {
    const b = document.createElement('button');
    if (reportWords.has(w)) b.className = 'quest report';
    else if (questWords.has(w)) b.className = 'quest';
    b.textContent = w;
    b.addEventListener('click', () => Actions.say(w));
    return b;
  }), Object.assign(document.createElement('button'), { className: 'bye', textContent: 'Good bye', onclick: () => { Actions.say('bye'); hideTalk(); } }));
  const face = $('talkFace').getContext('2d');
  face.clearRect(0, 0, 112, 112);
  if (npc) { // its head and shoulders, big
    const img = Sprites.creature(creatureKey(npc), 2, 0), big = Sprites.w(img) > TILE, r = img.res || 1;
    face.imageSmoothingEnabled = r > 1;
    const tall = Sprites.headroom(npc), box = Sprites.faceBox(npc);
    if (box) face.drawImage(img, box[0] * r, box[1] * r, box[2] * r, box[3] * r, 0, 0, 112, 112);
    else if (tall) face.drawImage(img, (TILE + 7) * r, (TILE - tall - 2) * r, 18 * r, 18 * r, 0, 0, 112, 112);
    else face.drawImage(img, (big ? TILE + 4 : 4) * r, (big ? TILE - 4 : -4) * r, 24 * r, 24 * r, 0, 0, 112, 112);
  }
  $('talk').hidden = !!player.shopNpc; // (trading: the shop is open, the card would cover it)
  talkShownAt = now;
}
function hideTalk() { $('talk').hidden = true; }

initTouch();
