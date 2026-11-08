'use strict';
// Touch controls for phones and tablets. The map itself is the controller: tap
// to click, long-press to use, swipe or hold-and-steer to walk (see game.js).
// Around it: a joystick bottom left; the favourites (spells, potions), attack and
// backpack buttons bottom right; fight mode and chase top right; the chat behind a
// button and the side panel as a drawer.
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
  $('tUse').classList.toggle('active', mode === 'use');
  $('tLook').classList.toggle('active', mode === 'look');
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
  document.body.classList.toggle('chat-open', open);
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
const favKey = () => `tilequest.favs.${player.name.toLowerCase()}`;
let favPickSlot = null, favHold = null, favShown = '', favPageIndex = 0;
const FAV_SLOTS = 2, FAV_PAGES = 1, FAV_FIXED = 2; // two of your own (spells), and the two potions
const favIndex = slot => slot < FAV_SLOTS ? favPageIndex * FAV_SLOTS + slot : FAV_SLOTS * FAV_PAGES + slot - FAV_SLOTS;

function favourites() {
  const saved = touchStorage.get(favKey());
  if (Array.isArray(saved) && saved.length === FAV_SLOTS * FAV_PAGES + FAV_FIXED) return saved;
  const slots = Array(FAV_SLOTS * FAV_PAGES + FAV_FIXED).fill(null);
  if (Array.isArray(saved)) {
    // From an older layout (more pages, more slots): keep the first spells the player pinned.
    saved.filter(id => id && !['h', 'm'].includes(id)).slice(0, FAV_SLOTS).forEach((id, i) => { slots[i] = id; });
  } else {
    const known = hotbarEntries().filter(e => !e.locked).map(e => e.id);
    known.filter(id => !['h', 'm', 'f'].includes(id)).slice(0, 3)
      .forEach((id, i) => { slots[i] = id; });
  }
  slots[FAV_SLOTS * FAV_PAGES] = 'h';
  slots[FAV_SLOTS * FAV_PAGES + 1] = 'm';
  return slots;
}
function changeFavPage(delta) {
  endFavPress(false);
  favPageIndex = (favPageIndex + delta + FAV_PAGES) % FAV_PAGES;
  $('favPage').textContent = `${favPageIndex + 1} / ${FAV_PAGES}`;
  favShown = '';
  renderFavs();
}

function useFav(slot) {
  const e = hotbarEntries().find(x => x.id === favourites()[favIndex(slot)]);
  if (!e) openFavPicker(slot);
  else if (!e.locked && player && !paused) e.act();
}

function renderFavs() {
  if (!touchScreen || !player) return;
  const entries = hotbarEntries();
  const favs = favourites();
  const current = [...favs.slice(favPageIndex * FAV_SLOTS, (favPageIndex + 1) * FAV_SLOTS), ...favs.slice(FAV_SLOTS * FAV_PAGES)];
  const shown = current.map(id => entries.find(x => x.id === id)).map(e => (e ? `${e.name}|${e.sub}|${e.locked}` : '-'));
  if (shown.join() === favShown) return; // redrawing mid-press would lose the press
  favShown = shown.join();
  const root = $('favs');
  root.replaceChildren();
  current.forEach((id, slot) => {
    const e = entries.find(x => x.id === id);
    const b = document.createElement('button');
    b.className = `fav${e && e.locked ? ' locked' : ''}${e ? '' : ' empty'}`;
    b.innerHTML = '<span></span><small></small>';
    const icon = e && { h: 'health_potion', m: 'mana_potion', f: 'bread' }[e.id]; // potions and food: their picture, not a cut-off name
    if (icon) b.querySelector('span').replaceChildren(Icons.img({ h: 'health', m: 'mana', f: 'food' }[e.id], 28));
    else if (!e) b.querySelector('span').replaceChildren(Icons.img('plus', 20));
    else b.querySelector('span').textContent = e.name;
    b.querySelector('small').textContent = e ? e.sub : ''; // (an empty one: just a +; hold it to choose)
    b.title = e ? e.name : 'Hold to choose a spell or potion for this button';
    b.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      if (favHold) clearTimeout(favHold.timer);
      b.classList.add('holding');
      favHold = { slot, el: b, held: false };
      favHold.timer = setTimeout(() => {
        favHold.held = true;
        b.classList.remove('holding');
        if (navigator.vibrate) navigator.vibrate(30);
        openFavPicker(slot);
      }, FAV_HOLD);
    });
    root.appendChild(b);
  });
}

function endFavPress(use) {
  if (!favHold) return;
  clearTimeout(favHold.timer);
  favHold.el.classList.remove('holding');
  if (use && !favHold.held) useFav(favHold.slot);
  favHold = null;
}

function openFavPicker(slot) {
  favPickSlot = slot;
  const list = $('favList');
  list.replaceChildren();
  for (const e of hotbarEntries()) {
    const b = document.createElement('button');
    b.className = 'hot';
    b.disabled = !!e.locked;
    b.innerHTML = '<span></span> <small></small>';
    b.querySelector('span').textContent = e.name;
    b.querySelector('small').textContent = e.sub;
    b.addEventListener('click', () => {
      const favs = favourites();
      favs[favIndex(favPickSlot)] = e.id;
      touchStorage.set(favKey(), favs);
      $('favPicker').hidden = true;
      favShown = '';
      renderFavs();
    });
    list.appendChild(b);
  }
  $('favPicker').hidden = false;
}

// The joystick, bottom left: steer with your thumb; a flick walks one tile.
function initJoystick() {
  const pad = $('joystick'), knob = pad.querySelector('.knob');
  let id = null, key = null;
  const release = () => {
    if (key) Actions.keyUp(key);
    key = id = null;
    knob.style.transform = '';
  };
  pad.addEventListener('pointerdown', e => {
    e.preventDefault();
    id = e.pointerId;
    pad.setPointerCapture(id);
  });
  pad.addEventListener('pointermove', e => {
    if (e.pointerId !== id || !player || paused) return;
    const r = pad.getBoundingClientRect(), max = r.width / 2 - 14;
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > max) {
      dx *= max / d;
      dy *= max / d;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const k = d > 12 ? swipeKey(dx, dy) : null;
    if (k === key) return;
    if (key) Actions.keyUp(key);
    key = k;
    if (k) Actions.keyDown(k, false);
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(ev, release);
}

// Messages pop up at the top for a few seconds, as the log is put away on a phone.
function toast(text, kind) {
  if (!touchScreen || document.body.classList.contains('chat-open')) return;
  const box = $('toasts'), line = document.createElement('div');
  line.className = `toast ${kind || ''}`;
  line.textContent = text;
  box.appendChild(line);
  while (box.children.length > 2) box.firstChild.remove(); // the two newest
  setTimeout(() => line.remove(), 3500);
}

// Mobile action priority is independent from the button layout.
function smartActionContext() {
  if (!player || player.dead) return { kind: 'idle', label: 'Action' };
  const protectedZone = inPZ();
  const nearbyMonsters = !protectedZone && monsters.some(m =>
    !m.dead && m.z === player.z && dist(m, player) <= 7 && canSee(m));
  if (nearbyMonsters) return { kind: 'attack', label: 'Attack' };

  // Corpses and ground piles can be reached by pathfinding, even when covered by controls.
  const nearbyPiles = piles.filter(p => p.z === player.z && p.items && p.items.length &&
    dist(p, player) <= 7).sort((a, b) => dist(a, player) - dist(b, player));
  if (nearbyPiles.length) return { kind: 'loot', label: 'Loot', pile: nearbyPiles[0] };

  const npc = npcs.filter(n => n.z === player.z && dist(n, player) <= TALK_RANGE)
    .sort((a, b) => dist(a, player) - dist(b, player))[0];
  if (npc) return { kind: 'talk', label: 'Talk', x: npc.x, y: npc.y, z: npc.z };

  const nearby = [{ x: player.x, y: player.y, z: player.z }];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++)
    if (dx || dy) nearby.push({ x: player.x + dx, y: player.y + dy, z: player.z });
  for (const t of nearby) {
    const tile = map.get(t.x, t.y, t.z);
    if (tile && tile.items && tile.items.some(id => {
      const d = THINGS[id];
      return d && (d.toggle || d.lockDoor || d.questDoor || d.levelDoor ||
        d.chest || d.lever || d.depot || d.readable || d.bookshelf || d.cache);
    })) return { kind: 'use', label: 'Use', ...t };
  }
  return { kind: protectedZone ? 'idle' : 'attack', label: protectedZone ? 'Action' : 'Attack' };
}
function pressSmartAction() {
  const action = smartActionContext();
  if (action.kind === 'attack') Actions.targetNext();
  else if (action.kind === 'loot') Actions.lootNearest(action.pile.id);
  else if (action.kind === 'talk' || action.kind === 'use')
    Actions.interact(action.kind, action.x, action.y, action.z);
}
function updateSmartAction() {
  const action = smartActionContext(), button = $('tAttack');
  if (button.dataset.action !== action.kind) {
    button.dataset.action = action.kind;
    button.replaceChildren(Icons.img(action.kind in { attack: 1, talk: 1, loot: 1, use: 1 } ? action.kind : 'idle', 34));
    button.title = action.label;
    button.setAttribute('aria-label', action.label);
  }
}

function initTouch() {
  if (!touchScreen) return;
  document.body.classList.add('touch-ui');
  $('touch').hidden = false;
  // The loot window and the backpack float over the map, so you needn't open the drawer for them.
  $('viewport').appendChild($('lootBox'));
  $('viewport').appendChild($('containers'));
  // the game's own icons on the bottom buttons and the close buttons
  for (const [id, icon] of [['tabChar', 'character'], ['tabQuests', 'quests'], ['tabMap', 'map'], ['tabChat', 'chat'], ['tabMenu', 'menu']]) $(id).querySelector('span').replaceChildren(Icons.img(icon, 24));
  // the map starts under the status bar: keep its height in --hud-h for the viewport's padding (style.css)
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
    <li><b>Walk</b>: the joystick, bottom left, or tap where to go.</li>
    <li><b>The big button</b>: attacks the nearest monster, talks to someone next to you, or opens a corpse.</li>
    <li><b>Tap</b> a monster to attack it, someone to talk to them. <b>Hold</b> them for more (follow, look, open a corpse under them).</li>
    <li><b>Round buttons</b> by the big one: your potions and two spells or foods. Hold one to choose what goes there.</li>
    <li><b>Talking</b>: tap the blue words, or Chat to type. Say "hi" to someone to start.</li>
    <li><b>Character</b>: your equipment, bag and skills. Drag things between them.</li>
    <li><b>Quests</b>: what you are doing and where to go. <b>Map</b>: tap a spot to walk there.</li>
    <li><b>Menu</b>: how you fight (attack, balanced, defend), chase, secure mode, sound and more.</li>
  </ul>`;

  const tap = (id, fn) => $(id).addEventListener('click', e => {
    e.preventDefault();
    if (player && !paused) fn();
  });
  tap('tAttack', pressSmartAction);
  tap('tMore', () => $('touch').classList.toggle('more-open'));
  tap('tStop', () => {
    setTouchMode(null);
    if (useWith) cancelUseWith();
    Actions.stop();
  });
  tap('tUse', () => setTouchMode(touchMode === 'use' ? null : 'use'));
  tap('tLook', () => setTouchMode(touchMode === 'look' ? null : 'look'));
  tap('tHeal', () => Actions.hotkey('h'));
  tap('tMana', () => Actions.hotkey('m'));
  tap('tChat', () => setChat(!document.body.classList.contains('chat-open'), true));
  tap('tMap', () => toggleWorldMap());
  tap('tRide', () => {
    if ($('worldmap').hidden) toggleWorldMap(true);
    else setRideMode(true);
  });
  tap('tPanel', () => document.body.classList.toggle('panel-open'));
  tap('panelClose', () => closeSheet());
  for (const id of ['tabChar', 'tabQuests', 'tabMenu']) tap(id, () => toggleSheet($(id).dataset.sheet));
  tap('tabMap', () => { closeSheet(); toggleWorldMap(); });
  tap('tabChat', () => { closeSheet(); setChat(!document.body.classList.contains('chat-open'), true); });
  tap('talkClose', () => { if (player.conversation) Actions.say('bye'); hideTalk(); });
  tap('tBag', () => document.body.classList.toggle('bag-open'));
  const MODES = ['offensive', 'balanced', 'defensive'];
  tap('tFight', () => Actions.setFightMode(MODES[(MODES.indexOf(player.fightMode) + 1) % MODES.length]));
  tap('tChase', () => Actions.setChase(!player.chase));
  tap('tSecure', () => Actions.setSecure(player.secure === false));
  $('tFull').addEventListener('click', toggleFullscreen);
  tap('favPrev', () => changeFavPage(-1));
  tap('favNext', () => changeFavPage(1));
  initJoystick();
  $('chatClose').addEventListener('click', () => setChat(false));
  $('favPickerClose').addEventListener('click', () => { $('favPicker').hidden = true; });
  document.addEventListener('pointerup', () => endFavPress(true));
  document.addEventListener('pointercancel', () => endFavPress(false));
  // Touching the map puts the drawer away.
  canvas.addEventListener('pointerdown', () => document.body.classList.remove('panel-open'));
  window.addEventListener('resize', fitView);
  fitView();
  // Health and mana stay in sight while the panel is put away, and so do the fight settings.
  const FIGHT_ICONS = { offensive: ['&#9876;', 'Attack'], balanced: ['&#9878;', 'Balanced'], defensive: ['&#128737;', 'Defend'] };
  let fightShown = '';
  setInterval(() => {
    if (!player) return;
    updateSmartAction();
    const fight = `${player.fightMode}|${player.chase}|${player.secure}`;
    if (fight !== fightShown) {
      fightShown = fight;
      const [icon, label] = FIGHT_ICONS[player.fightMode] || FIGHT_ICONS.balanced;
      $('tFight').innerHTML = `${icon}<small>${label}</small>`;
      $('tChase').innerHTML = player.chase ? '&#127939;<small>Chase</small>' : '&#9995;<small>Stand</small>';
      $('tChase').classList.toggle('active', player.chase);
      $('tSecure').innerHTML = player.secure !== false ? '&#128330;<small>Secure</small>' : '&#9760;<small>PvP</small>';
      $('tSecure').classList.toggle('active', player.secure !== false);
    }
    for (const [bar, v, max] of [['Hp', player.hp, player.maxHp], ['Mana', player.mana, player.maxMana]]) {
      $(`tb${bar}`).style.width = `${(100 * v) / max}%`;
      $(`tb${bar}Text`).textContent = `${v} / ${max}`;
    }
    // the status bar: level, experience to the next one, gold, and a red edge when you're nearly dead
    $('hudLvl').textContent = player.level;
    $('hudName').textContent = player.name;
    $('hudTitle').textContent = `Level ${player.level} · ${player.vocation === 'none' ? 'Adventurer' : capitalize(player.vocation)}`;
    const faceKey = creatureKey(player) + player.dir;
    if (faceKey !== hudFaceKey) { // the portrait: your own head and shoulders, big
      hudFaceKey = faceKey;
      const img = Sprites.creature(creatureKey(player), 2, 0), big = img.width > TILE, f = $('hudFace').getContext('2d');
      f.clearRect(0, 0, 64, 64);
      f.imageSmoothingEnabled = false;
      f.drawImage(img, big ? TILE + 5 : 5, big ? TILE - 6 : -6, 22, 22, 0, 0, 64, 64);
    }
    const lo = xpForLevel(player.level), hi = xpForLevel(player.level + 1);
    $('hudXp').style.width = `${Math.max(0, Math.min(100, (100 * (player.xp - lo)) / (hi - lo)))}%`;
    $('hudGold').innerHTML = `<img src="${Icons.url('coins')}" alt="">${player.gold.toLocaleString('en')}`;
    document.body.classList.toggle('low-hp', player.hp > 0 && player.hp < player.maxHp * 0.25);
    if (document.body.dataset.sheet === 'menu') renderMenu();
    if (!$('talk').hidden && ((!player.conversation && now > talkShownAt + 1500) || player.shopNpc)) hideTalk(); // the talk is over, or a shop opened
  }, 250);
}

// ---- sheets: Character, Quests and Menu come up from the bottom, over the map ----------------------------------
// They are the side panel, showing only what belongs to them (body[data-sheet], body[data-seg]; see style.css).
const SHEETS = {
  character: { title: () => `${player.name} · level ${player.level}`, segs: [['equipment', 'Equipment'], ['bag', 'Bag'], ['skills', 'Skills']] },
  quests: { title: () => 'Quests' },
  menu: { title: () => 'Menu', segs: [['settings', 'Settings'], ['help', 'Help']] },
};
function openSheet(kind, seg) {
  const sheet = SHEETS[kind];
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
  const key = `${player.fightMode}|${player.chase}|${player.secure}|${sound}|${music}`;
  if (key === menuShown) return;
  menuShown = key;
  const root = $('menuSec'), h = (tag, props, ...kids) => { const el = Object.assign(document.createElement(tag), props || {}); el.append(...kids); return el; };
  const row = (label, right, onTap, extra) => {
    const r = h('button', { className: `menu-row${extra ? ` ${extra}` : ''}` }, h('span', {}, ...[].concat(label)), right);
    if (onTap) r.addEventListener('click', onTap);
    return r;
  };
  const toggle = on => h('span', { className: `toggle${on ? ' on' : ''}` });
  const modes = h('div', { className: 'seg' }, ...[['offensive', 'Attack'], ['balanced', 'Balanced'], ['defensive', 'Defend']].map(([m, label]) => {
    const b = h('button', { className: player.fightMode === m ? 'active' : '' }, label);
    b.addEventListener('click', () => Actions.setFightMode(m));
    return b;
  }));
  const secureOn = player.secure !== false;
  root.replaceChildren(
    h('div', { className: 'menu-head' }, 'Fighting'), modes,
    row('Chase your target', toggle(player.chase), () => Actions.setChase(!player.chase)),
    row(['Secure mode', h('small', { className: secureOn ? '' : 'warn' }, secureOn ? 'On: you can\'t hurt players without a skull' : 'Off: your attacks can hurt other players')],
      toggle(secureOn), () => Actions.setSecure(!secureOn)),
    h('div', { className: 'menu-head' }, 'Game'),
    row('Sound', toggle(/on/i.test(sound)), () => $('soundBtn').click()),
    row('Music', toggle(/on/i.test(music)), () => $('musicBtn').click()),
    row('Outfit', h('span', {}, '›'), () => { closeSheet(); openOutfit(); }),
    row('Party & guild', h('span', {}, '›'), () => { closeSheet(); $('guildBtn').click(); }),
    row('Order a ride', h('span', {}, '›'), () => { closeSheet(); if ($('worldmap').hidden) toggleWorldMap(true); else setRideMode(true); }),
    row('Fullscreen', h('span', {}, '›'), () => toggleFullscreen()),
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
  words.replaceChildren(...seen.map(w => {
    const b = document.createElement('button');
    b.textContent = w;
    b.addEventListener('click', () => Actions.say(w));
    return b;
  }), Object.assign(document.createElement('button'), { className: 'bye', textContent: 'Good bye', onclick: () => { Actions.say('bye'); hideTalk(); } }));
  const face = $('talkFace').getContext('2d');
  face.clearRect(0, 0, 56, 56);
  if (npc) { // its head and shoulders, big
    const img = Sprites.creature(creatureKey(npc), 2, 0), big = img.width > TILE;
    face.imageSmoothingEnabled = false;
    face.drawImage(img, big ? TILE + 4 : 4, big ? TILE - 4 : -4, 24, 24, 0, 0, 56, 56);
  }
  $('talk').hidden = !!player.shopNpc; // (trading: the shop is open, the card would cover it)
  talkShownAt = now;
}
function hideTalk() { $('talk').hidden = true; }

initTouch();
