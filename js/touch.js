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
  if (open && focus) $('chat').focus();
  if (!open) {
    $('chat').blur();
    // Closing NPC chat also cancels the dialogue; walking away must not reopen it.
    if (player && player.conversation) endConversation(true);
    if (player && player.action && player.action.kind === 'talk') player.action = null;
  }
}

// ---- favourites: three pinned spells or potions -------------------------------------------
// Tap to use; hold for a moment (the button fills up) to choose what goes there.
const FAV_HOLD = 650;
const favKey = () => `tilequest.favs.${player.name.toLowerCase()}`;
let favPickSlot = null, favHold = null, favShown = '', favPageIndex = 0;
const FAV_SLOTS = 3, FAV_PAGES = 3, FAV_FIXED = 2;
const favIndex = slot => slot < FAV_SLOTS ? favPageIndex * FAV_SLOTS + slot : FAV_SLOTS * FAV_PAGES + slot - FAV_SLOTS;

function favourites() {
  const saved = touchStorage.get(favKey());
  if (Array.isArray(saved) && saved.length === FAV_SLOTS * FAV_PAGES + FAV_FIXED) return saved;
  const slots = Array(FAV_SLOTS * FAV_PAGES + FAV_FIXED).fill(null);
  if (Array.isArray(saved)) {
    // Migrate the old 4-slot pages without losing the user's pinned spells.
    for (let page = 0; page < FAV_PAGES; page++)
      for (let slot = 0; slot < FAV_SLOTS; slot++)
        slots[page * FAV_SLOTS + slot] = saved[page * 4 + slot] || null;
  } else {
    const known = hotbarEntries().filter(e => !e.locked).map(e => e.id);
    known.filter(id => !['h', 'm', 'f'].includes(id)).slice(0, 3)
      .forEach((id, i) => { slots[i] = id; });
  }
  slots[9] = 'h';
  slots[10] = 'm';
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
    b.className = `fav${e && e.locked ? ' locked' : ''}`;
    b.innerHTML = '<span></span><small></small>';
    const icon = e && { h: 'health_potion', m: 'mana_potion', f: 'bread' }[e.id]; // potions and food: their picture, not a cut-off name
    if (icon) b.querySelector('span').innerHTML = `<img src="${Sprites.itemURL(icon)}" alt="">`;
    else b.querySelector('span').textContent = e ? e.name : '+';
    b.querySelector('small').textContent = e ? e.sub : 'hold';
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
  const icon = { attack: '⚔', talk: '💬', loot: '▣', use: '✋', idle: '•' };
  if (button.dataset.action !== action.kind) {
    button.dataset.action = action.kind;
    button.textContent = icon[action.kind];
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
  tap('panelClose', () => document.body.classList.remove('panel-open'));
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
  }, 250);
}

initTouch();
