'use strict';
// Input, drawing and the main loop (offline, or online through net.js).

const canvas = $('view');
canvas.width = VIEW_W * TILE * SCALE;
canvas.height = VIEW_H * TILE * SCALE;
const ctx = canvas.getContext('2d', { alpha: false }); // (painted opaque every frame: cheaper to put on the screen)
// The night is soft, so it's drawn at a quarter of the overlay's pixels each way (LIGHT_RES) and spread out.
const LIGHT_RES = 0.25;
const dark = document.createElement('canvas');
dark.width = canvas.width * LIGHT_RES;
dark.height = canvas.height * LIGHT_RES;
const dctx = dark.getContext('2d');
const LIFT = 4; // creatures stand a little raised, like on a 3D floor
// Creatures lean into the walls' slant (see Render.slanted): their heads are this far left of their feet, so
// what hangs over a head (a name, a health bar, words) moves along; a frame round them sits half way.
const HEAD_LEAN = 26; // (times Render.CREATURE_LEAN)
// Where every monster's (and a companion's) health bar sits, in world pixels below the top of its tile: one height for
// all, whatever the size of its picture, so a rat's name doesn't float a tile above it and a big beast's isn't elsewhere.
const MONSTER_BAR_Y = 2;
let paused = false;
const online = () => typeof Net !== 'undefined' && Net.online;

// ZOOM: canvas pixels per overlay pixel. Everything over the map (names, bars, words, the light) is laid out as if
// the canvas had SCALE pixels per world pixel; on a phone the canvas has the screen's own pixels (SCALE * ZOOM per
// world pixel), so nothing is blown up afterwards and the map is as sharp as the screen.
let ZOOM = 1;
const viewPxW = () => canvas.width / ZOOM, viewPxH = () => canvas.height / ZOOM; // the canvas in overlay pixels
function setViewSize(w, h, zoom = ZOOM) {
  if (w === VIEW_W && h === VIEW_H && zoom === ZOOM) return;
  VIEW_W = w;
  VIEW_H = h;
  ZOOM = zoom;
  canvas.width = VIEW_W * TILE * SCALE * ZOOM;
  canvas.height = VIEW_H * TILE * SCALE * ZOOM;
  dark.width = VIEW_W * TILE * SCALE * LIGHT_RES;
  dark.height = VIEW_H * TILE * SCALE * LIGHT_RES;
}

// The quality (Menu, Game), remembered per browser: high - everything; medium - no clouds or weather drifting over
// the view, and the map a step less sharp on a phone; low - also no ripples on the water and no blades of grass over
// things' feet, and the map as coarse as a phone may draw it. (The speed meter's test shows what each part costs.)
const QUALITY = { high: [], medium: ['sky', 'fx'], low: ['sky', 'fx', 'water', 'fringe'] };
let quality = (() => { try { const q = localStorage.getItem('tilequest.quality'); return QUALITY[q] ? q : 'high'; } catch (e) { return 'high'; } })();
function setQuality(q) {
  quality = QUALITY[q] ? q : 'high';
  // (a quality chosen starts from the screen's own sharpness again: the steps down for a phone that couldn't keep up
  // were kept for good, so a phone once slow stayed coarse whatever was chosen; it steps down again only if it must)
  sharpDrop = 0;
  try { localStorage.removeItem('tilequest.sharpDrop60'); } catch (e) { /* not remembered */ }
  Render.quality.clear();
  for (const part of QUALITY[quality]) Render.quality.add(part);
try { localStorage.removeItem('tilequest.zoom'); } catch (e) { /* (the camera's setting, gone: always close-up now) */ }
  try { localStorage.setItem('tilequest.quality', quality); } catch (e) { /* not remembered */ }
  if (document.body.classList.contains('touch-ui')) reloadForView(); // (a phone draws the map at another sharpness: see reloadForView)
  else fitView();
}
for (const part of QUALITY[quality]) Render.quality.add(part);
// A new view (the quality) means pictures of another size: on a phone the old ones stayed in its memory
// beside the new ones, and the game crawled until the page was loaded again. So it's loaded again at once, behind the
// loading screen, the game saved first (online, it logs straight back in).
// A new version put live: played from a plain web host (GitHub Pages), nobody tells the page, and a browser or an app on
// a phone's home screen keeps showing the old one. So the page looks now and then (on opening, on coming back to it,
// and every ten minutes) at the live index.html, never from a cache, and if it names a newer version (?v=uiNNN) it
// saves the game and loads again, behind the loading screen. (Online, the server says so itself: net.js.)
const PAGE_VERSION = (/[?&]v=([\w.-]+)/.exec([...document.scripts].map(s => s.src).find(s => /js\/game\.js/.test(s)) || '') || [])[1] || '';
let versionLookedAt = -Infinity;
function lookForNewVersion() {
  if (!PAGE_VERSION || typeof online === 'function' && online() || location.protocol === 'file:' || document.hidden) return;
  if (performance.now() - versionLookedAt < 60000) return; // (not more than once a minute)
  versionLookedAt = performance.now();
  fetch(`index.html?look=${Date.now()}`, { cache: 'no-store' }).then(r => (r.ok ? r.text() : '')).then(html => {
    const live = (/js\/game\.js\?v=([\w.-]+)/.exec(html) || [])[1];
    if (!live || live === PAGE_VERSION) return;
    const el = $('loading');
    if (el) { el.hidden = false; $('loadingText').textContent = 'Updating the game...'; $('loadingBar').style.width = '100%'; }
    try { if (player && !online()) saveGame(); } catch (e) { /* loaded again all the same */ }
    setTimeout(() => location.reload(), 60);
  }).catch(() => { /* offline: try again later */ });
}
document.addEventListener('visibilitychange', lookForNewVersion);
setInterval(lookForNewVersion, 10 * 60000);
setTimeout(lookForNewVersion, 5000);

function reloadForView() {
  if (!player || typeof Preload === 'undefined' || !Preload.since) return fitView(); // (not playing yet: nothing to clear)
  const el = $('loading');
  if (el) { el.hidden = false; $('loadingText').textContent = 'Setting up the view...'; $('loadingBar').style.width = '100%'; }
  try { if (!online()) saveGame(); else Net.saveExplored(); } catch (e) { /* reloaded all the same */ }
  setTimeout(() => location.reload(), 60);
}

// On a phone that can't keep up, the map is drawn with fewer pixels: sharpDrop steps below the screen's own (at most
// down to 2 per world pixel). It goes down a step when frames come too slowly for a few seconds running, and is
// remembered per browser, so a slow phone starts where it ended.
let sharpDrop = (() => { try { return Math.max(0, +localStorage.getItem('tilequest.sharpDrop60') || 0); } catch (e) { return 0; } })();
const keepUp = { from: 0, frames: 0 };
function checkKeepingUp(t) {
  if (!document.body.classList.contains('touch-ui') || document.hidden) { keepUp.from = 0; return; }
  if (!keepUp.from || t - keepUp.last > 500) { Object.assign(keepUp, { from: t, last: t, frames: 0 }); return; } // (after a pause: start over)
  keepUp.frames++;
  keepUp.last = t;
  if (t - keepUp.from < 4000) return;
  const fps = (keepUp.frames * 1000) / (t - keepUp.from);
  keepUp.from = 0;
  if (fps >= 0.75 * (1000 / FRAME_INTERVAL) || Sprites.CREATURE_RES <= 2) return; // (a step coarser when it can't keep up with the frame rate asked for)
  sharpDrop++;
  try { localStorage.setItem('tilequest.sharpDrop60', sharpDrop); } catch (e) { /* not remembered */ }
  fitView();
}

// Scale the map to the largest rectangle that fits the space left for it. On a phone the view itself adapts to
// the screen (see below).
function fitView() {
  // (on a phone the status bar and the bottom buttons sit in the viewport's padding: the map goes between them)
  const vp = $('viewport'), r = vp.getBoundingClientRect(), pad = getComputedStyle(vp), px = k => parseFloat(pad[k]) || 0;
  const box = { width: r.width - px('paddingLeft') - px('paddingRight'), height: r.height - px('paddingTop') - px('paddingBottom') };
  if (document.body.classList.contains('touch-ui') && box.width > 0 && box.height > 0) {
    // A whole number of screen pixels per world pixel (p: 3 on most iPhones), so every pixel of a tile is as big as
    // the next: as many tiles as cover the space (the last ones may be cut a little at the edges), up to what the
    // server sends round you (25 across, 21 down); fewer, bigger pixels if that's not enough.
    const dpr = window.devicePixelRatio || 1, W = box.width * dpr, H = box.height * dpr;
    // A step closer than the screen's own: 4 screen pixels per world pixel on most iPhones, still whole pixels (a camera
    // further out was tried: it drew nearly twice as much for little more to see, and a phone couldn't keep up).
    let p = Math.max(2, Math.round(dpr) + 1), cols, rows;
    for (;; p++) {
      cols = Math.ceil(W / (TILE * p));
      rows = Math.ceil(H / (TILE * p));
      if (cols <= 25 && rows <= 21) break;
    }
    // The canvas is drawn r pixels per world pixel: p, or fewer on a phone too slow for that (see keepUp); the
    // browser then blows it up to p, which costs next to nothing.
    const r = Math.max(2, p - sharpDrop - (quality === 'low' ? 9 : quality === 'medium' ? 1 : 0)); // (low: as coarse as it goes)
    Sprites.CREATURE_RES = r; // (figures drawn just as finely)
    setViewSize(Math.max(7, cols), Math.max(7, rows), r / SCALE);
    const w = (VIEW_W * TILE * p) / dpr, h = (VIEW_H * TILE * p) / dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    // The tiles that don't quite fit stick out past the map's space, over the status bar and under the action bar:
    // cut the map at the space's edges (it lies in the middle of it, so as much on each side)
    const cx = Math.max(0, (w - box.width) / 2), cy = Math.max(0, (h - box.height) / 2);
    canvas.style.clipPath = cx || cy ? `inset(${cy}px ${cx}px)` : '';
    return;
  }
  setViewSize(VIEW_W, VIEW_H, 1);
  canvas.style.clipPath = '';
  const s = Math.max(1, Math.min((box.width - 4) / VIEW_W, (box.height - 4) / VIEW_H));
  canvas.style.width = `${Math.floor(VIEW_W * s)}px`;
  canvas.style.height = `${Math.floor(VIEW_H * s)}px`;
}
window.addEventListener('resize', fitView);
// ...and its box, which shrinks when the spell bar below grows a row
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fitView).observe($('viewport'));
fitView();

// ---- keyboard --------------------------------------------------------------------------
// A clicked button keeps the keyboard's focus, so Space (target the next monster) would press it again: let go of it.
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button'); if (b && !b.closest('.dialog')) b.blur(); });
window.addEventListener('keydown', e => {
  if (paused || !player || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  const k = e.key.toLowerCase();
  if (/^f([1-9]|1[0-2])$/.test(k)) {
    e.preventDefault();
    Actions.useHotkey(e.key.toUpperCase());
    return;
  }
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  if (DIR_KEYS[k]) {
    Actions.keyDown(k, e.repeat);
  } else if (k === ' ') {
    Actions.targetNext();
  } else if (k === 'escape') {
    if (useWith) cancelUseWith();
    else if (!$('worldmap').hidden) toggleWorldMap();
    else {
      for (const id of ['read', 'paths', 'hotkeys', 'guild', 'skillTree']) $(id).hidden = true;
      closeForge();
      Actions.stop();
    }
  } else if (k === 'enter') {
    $('chat').focus();
  } else if (/^[1-9]$/.test(k)) {
    const e = hotbarEntries()[+k - 1]; // (as the bar below the map numbers them: a skill tree's line is one)
    if (e && SPELLS[e.id] && !e.locked) e.act();
  } else if (k === 'k' && TREES[player.vocation]) {
    if ($('skillTree').hidden) openSkillTree(); else $('skillTree').hidden = true;
  } else if ('hmf'.includes(k)) {
    Actions.hotkey(k);
  } else if (k === 'g') {
    toggleWorldMap();
  } else {
    return;
  }
  e.preventDefault();
});
window.addEventListener('keyup', e => {
  if (player && DIR_KEYS[e.key.toLowerCase()]) Actions.keyUp(e.key.toLowerCase());
});
window.addEventListener('blur', () => player && Actions.releaseKeys());

// Say what's typed in the chat line (Enter, or the phone's send button: chat-line.js); keep: stay in the line to go on
function sendChat(keep) {
  const input = $('chat'), tab = $('log').dataset.filter, text = input.value; // the Party and Guild tabs talk on their channel
  if (!text.trim()) return;
  if (tab === 'party' && !text.startsWith('/')) Actions.partySay(text);
  else if (tab === 'guild' && !text.startsWith('/')) Actions.guildSay(text);
  else Actions.say(text);
  input.value = '';
  if (!keep) input.blur();
}
$('chat').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendChat(touchScreen); // (on a phone the keyboard stays up, to say the next thing)
  } else if (e.key === 'Escape') {
    e.target.blur();
  }
});

// ---- mouse --------------------------------------------------------------------------------
// World pixel under the pointer, on the player's floor.
function eventToWorld(e) {
  const r = canvas.getBoundingClientRect(), pv = visual(player);
  const w = VIEW_W * TILE, h = VIEW_H * TILE;
  return {
    wx: ((e.clientX - r.left) / r.width) * w - Math.round(w / 2 - (pv.x * TILE + TILE / 2)),
    wy: ((e.clientY - r.top) / r.height) * h - Math.round(h / 2 - (pv.y * TILE + TILE / 2 - siegeLook * siegeLookTiles() * TILE)), // (the view slid north on the wall: draw)
  };
}
function tileUnderPointer(e) {
  const { wx, wy } = eventToWorld(e);
  return { x: Math.floor(wx / TILE), y: Math.floor(wy / TILE), z: player.z };
}

// The creature drawn under the pointer (they stand a little raised).
// Your companion under the pointer (it isn't a creature anyone can target)
function petUnder(wx, wy) {
  const b = player.petBody;
  if (!b || b.z !== player.z) return null;
  const v = visual(b), x = v.x * TILE - LIFT, y = v.y * TILE - LIFT;
  return wx >= x && wx < x + TILE && wy >= y && wy < y + TILE ? b : null;
}

// What you can do with your companion (a right-click on him on a computer): his card first (nothing happens to him by
// a slip of the finger), then feed him, give him a potion, name him, send him home
function openPetMenu(e) {
  const pet = player.pet, menu = $('ctxMenu');
  if (!pet) return;
  menu.replaceChildren();
  const item = (label, fn, cls) => {
    const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls;
    b.addEventListener('click', () => { closeCreatureMenu(); fn(); }); menu.appendChild(b);
  };
  const head = document.createElement('div'); head.className = 'ctx-head';
  head.textContent = `${pet.name} · level ${pet.level} · health ${pet.hp}/${PETS[pet.kind].hp(pet.level)}`;
  menu.appendChild(head);
  item('Companion card', () => CompanionCard.open(), 'ctx-default');
  item('Feed (from your bag)', () => Actions.petFeed());
  item('Give a health potion', () => Actions.petPotion());
  item('Rename', () => askPetName(pet.name));
  item('Send home', () => Actions.petHome());
  menu.hidden = false;
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(e.clientX, innerWidth - r.width - 4)}px`;
  menu.style.top = `${Math.min(e.clientY, innerHeight - r.height - 4)}px`;
  menu.querySelector('.ctx-default').focus({ preventScroll: true }); // (the harmless one is the one ready)
}

// Name your companion: a small window with a box to type in
function askPetName(current) {
  const dlg = document.createElement('div');
  dlg.className = 'window dialog pet-name';
  dlg.innerHTML = '<header><b>Your companion</b></header><p class="muted small">The temple calls him Clang, for the bell on his collar. Keep it, or give him a name of your own?</p>';
  const input = Object.assign(document.createElement('input'), { value: current || '', maxLength: 14, placeholder: 'Clang' });
  const ok = Object.assign(document.createElement('button'), { textContent: 'Done' });
  const done = () => { Actions.petName(input.value || current || 'Clang'); dlg.remove(); paused = false; };
  ok.addEventListener('click', done);
  input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') done(); });
  dlg.append(input, ok);
  $('viewport').appendChild(dlg);
  setTimeout(() => { input.focus(); input.select(); }, 50);
}

function creatureUnder(wx, wy) {
  return [...monsters, ...players].find(c => {
    if (c.dead || c === player || c.z !== player.z || (c.def && !canSee(c))) return false;
    const v = visual(c), x = v.x * TILE - LIFT, y = v.y * TILE - LIFT;
    return wx >= x && wx < x + TILE && wy >= y && wy < y + TILE;
  });
}

// Corpses, dropped items, movable things and other players next to you can be dragged.
function dragSourceAt(t) {
  if (t.z !== player.z || dist(player, t) > 1) return null;
  const other = players.find(p => p !== player && !p.dead && p.x === t.x && p.y === t.y && p.z === t.z);
  if (other) return { ref: { root: 'map', ...t }, icon: Sprites.creature(creatureKey(other), other.dir, 0).toDataURL() };
  const pile = pileAt(t.x, t.y, t.z);
  if (pile && pile.items.length) {
    const i = pile.items.length - 1;
    return { ref: { root: 'pile', pileId: pile.id, path: [i] }, icon: Sprites.itemURL(pile.items[i].id) };
  }
  const id = topItem(map.get(t.x, t.y, t.z));
  if (id && THINGS[id].movable) return { ref: { root: 'map', ...t }, icon: Sprites.thing(id, t.x, t.y).toDataURL() };
  return null;
}

// What you can do with someone, as a little menu where you right-clicked (Ctrl+click,
// or hold them on a phone): follow, attack, talk, look, and with players: party and guild.
function openCreatureMenu(e, c, t) {
  const menu = $('ctxMenu');
  menu.replaceChildren();
  const item = (label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', () => { closeCreatureMenu(); fn(); });
    menu.appendChild(b);
  };
  const name = c.type === 'player' ? c.name : c.type === 'npc' ? c.name : monsterRef(c);
  const companion = c.type === 'player' && player.secure !== false && /^(leader|member)/.test(markOf(c) || '');
  if (c !== player) {
    if (player.follow === c.id) item('Stop following', () => Actions.unfollow());
    else item(`Follow ${name}`, () => Actions.follow(c.id));
    if (c.type === 'npc') item('Talk', () => Actions.interact('talk', t.x, t.y, t.z));
    else if (!companion && player.target === c) item('Stop attacking', () => Actions.untarget());
    else if (!companion) item(c.type === 'player' ? `Attack ${name}` : 'Attack', () => Actions.setTarget(c.id));
  }
  if (c.type === 'player') socialItems(c, item);
  item('Look', () => lookHere(t.x, t.y, c));
  // a corpse (or anything dropped) under them: open it from here too
  const pile = piles.find(p => p.x === t.x && p.y === t.y && p.z === t.z && p.items.length);
  if (pile) item(`Open ${pile.name || 'what lies here'}`, () => Actions.lootNearest(pile.id));
  item('Use what is here', () => Actions.interact('use', t.x, t.y, t.z));
  menu.hidden = false;
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(e.clientX, innerWidth - r.width - 4)}px`;
  menu.style.top = `${Math.min(e.clientY, innerHeight - r.height - 4)}px`;
}
function closeCreatureMenu() { $('ctxMenu').hidden = true; }

// Party and guild, as in Tibia's menu: invite, join, pass the lead, share experience, leave.
function socialItems(c, item) {
  const mark = markOf(c), mine = myPartyView(), lead = !!(mine && mine.members && mine.leader === player.id);
  if (c === player) {
    if (lead) item(mine.shared ? 'Disable shared experience' : 'Enable shared experience', () => Actions.partyShareXp(!mine.shared));
    if (mine && mine.members) item('Leave party', () => Actions.partyLeave());
    return;
  }
  if (mark === 'inviter') item(`Join ${c.name}'s party`, () => Actions.partyJoin(c.id));
  else if (mark === 'invited') item('Revoke party invitation', () => Actions.partyRevoke(c.id));
  else if (lead && mark && mark.startsWith('member')) item(`Pass leadership to ${c.name}`, () => Actions.partyPassLeader(c.id));
  else if (!mark && (!mine || !mine.members || lead)) item('Invite to party', () => Actions.partyInvite(c.id));
  const g = myGuildView();
  if (g && g.name && g.myRank <= 1 && !guildOfCreature(c) && !(g.invited || []).includes(c.name.toLowerCase())) {
    item(`Invite to ${g.name}`, () => Actions.guildInvite(c.name));
  }
}
document.addEventListener('pointerdown', e => { if (!$('ctxMenu').hidden && !$('ctxMenu').contains(e.target)) closeCreatureMenu(); }, true);

function clickTile(e, t, wx, wy) {
  const creature = creatureUnder(wx, wy);
  const npc = npcs.find(n => n.x === t.x && n.y === t.y && n.z === t.z);
  const someone = creature || npc;
  if (creature && creature !== player && e.button === 2 && !e.ctrlKey && rightClickAttacks) return Actions.setTarget(creature.id); // classic controls
  if (someone && someone !== player && (e.button === 2 || e.ctrlKey)) return openCreatureMenu(e, someone, t);
  if ((e.button === 2 || e.ctrlKey) && petUnder(wx, wy)) return openPetMenu(e); // (your companion: a click walks there)
  if (e.shiftKey) return lookHere(t.x, t.y, creature);
  if (creature) return Actions.setTarget(creature.id);
  if (npc) return Actions.interact('talk', t.x, t.y, t.z);
  // Left click walks, unless there's something to open there; right click always uses.
  const usable = tileUsable(t);
  if (e.button === 2 || usable) markWalk(t), Actions.interact('use', t.x, t.y, t.z);
  else if (e.button === 0) markWalk(t), Actions.walkTo(t.x, t.y);
}

// Something to open or use on this tile (a click uses it rather than walking there; holding it on a phone uses it
// rather than looking at it)
function tileUsable(t, hold = false) {
  const tile = map.get(t.x, t.y, t.z);
  return !!pileAt(t.x, t.y, t.z) || !!(tile && tile.items.some(id => {
    const d = THINGS[id];
    if (d.chest || d.lever || d.depot || d.readable || d.bookshelf || d.useToClimb || d.trainer || d.cannon || d.rescue) return true;
    return hold && !!(d.toggle || d.change || d.lockDoor || d.questDoor || d.levelDoor || d.houseDoor || d.cache || d.deed || d.bell); // (held: doors, ways down)
  }));
}
// Looking at a tile (Shift+click, the menu's Look, or holding it on a phone): what's there, and the guide's look step
let guideLooked = false;
function lookHere(x, y, c) { look(x, y, c); guideLooked = true; }

// Where you tapped (or clicked) to go: a gold mark on that tile until you're there, or stop walking, or go elsewhere.
let walkMark = null;
const markWalk = t => { walkMark = { x: t.x, y: t.y, z: t.z, at: now, moved: now }; };
// Drawn on the floor itself (Render's onFloor, in world pixels), so walls, things, roofs and creatures stand over it.
// The guide's ring: gold on the ground round the feet of what the arrow points at (or round the spot), growing and
// fading, so the eye finds it at once; drawn with the floor, under the figures standing on it
// On the ground under the figures: a power shot's ring of runes while the bow is drawn (turning, growing), and the
// shock ring that bursts out round the hero as it's loosed.
function drawPowerGround(g, ox, oy, z) {
  for (const fx of effects) {
    if (fx.kind !== 'shot' || fx.z !== z) continue;
    const e = now - fx.start, cx = ox + fx.x * TILE + 16 - LIFT, cy = oy + fx.y * TILE + 29 - LIFT; // (under the hero's feet)
    g.save();
    g.globalCompositeOperation = 'lighter';
    if (e < fx.charge) {
      const k = e / fx.charge, R = 13 + 11 * k * k;
      g.translate(cx, cy); g.scale(1, 0.45); // (seen from above at a slant)
      // the ring itself a band of light: white on its inside edge, through the shot's gold to amber on its outside,
      // softened a hair so no pixels show: both its edges fade out over a pixel or two (a soft edge in the gradient,
      // not a blur filter: a filter on the canvas costs far too much on a phone)
      const w = 2.5 + 1 * k, inner = R - w - 0.6, outer = R + 0.6, at = v => (v - inner) / (outer - inner); // (a narrow band, crisp)
      const band = g.createRadialGradient(0, 0, inner, 0, 0, outer);
      band.addColorStop(0, 'rgba(255,255,255,0)'); band.addColorStop(at(R - w), `rgba(255,255,255,${0.55 + 0.4 * k})`);
      band.addColorStop(at(R - w * 0.65), `rgba(${PS_CORE},${0.5 + 0.4 * k})`); band.addColorStop(at(R - w * 0.3), `rgba(${PS_GOLD},${0.45 + 0.4 * k})`);
      band.addColorStop(at(R), `rgba(${PS_AMBER},${0.35 + 0.4 * k})`); band.addColorStop(1, `rgba(${PS_AMBER},0)`);
      g.fillStyle = band; g.beginPath(); g.arc(0, 0, outer, 0, Math.PI * 2); g.arc(0, 0, inner, 0, Math.PI * 2, true); g.fill('evenodd');
      g.globalCompositeOperation = 'source-over'; // (a fine amber line round its outside: a clean edge on any ground)
      g.strokeStyle = `rgba(${PS_AMBER},${0.35 + 0.5 * k})`; g.lineWidth = 0.9;
      g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke();
      g.globalCompositeOperation = 'lighter';
      g.save(); g.rotate(e / 380); // (eight fine marks turning just inside it)
      g.strokeStyle = `rgba(${PS_CORE},${0.3 + 0.6 * k})`; g.lineWidth = 1.1;
      g.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.moveTo(Math.cos(a) * (R - w - 2.5), Math.sin(a) * (R - w - 2.5)); g.arc(0, 0, R - w - 2.5, a, a + 0.32); }
      g.stroke();
      g.restore();
    } else if (e - fx.charge < 320) {
      const f = (e - fx.charge) / 320;
      g.strokeStyle = `rgba(${PS_GOLD},${0.8 * (1 - f)})`; g.lineWidth = 1.6 * (1 - f) + 0.5;
      g.beginPath(); g.ellipse(cx, cy, 10 + 40 * f, (10 + 40 * f) * 0.45, 0, 0, Math.PI * 2); g.stroke();
    }
    g.restore();
  }
}

function drawGuideRing(g, ox, oy, z) {
  const step = player.tutorial && !player.dead && guideArrowOn() && GUIDE[player.tutorial - 1], t = step && guideTarget(step);
  if (!t || t.z !== z || t.z !== player.z) return;
  const v = visual(t), k = (now % 1200) / 1200, rx = TILE * (0.3 + 0.3 * k);
  const fx = ox + v.x * TILE + 16 - (t.type ? LIFT : 0), fy = oy + v.y * TILE + (t.type ? 29 - LIFT : 16);
  g.save();
  g.globalAlpha = 1 - k;
  g.lineWidth = 1.6;
  g.strokeStyle = '#ffd84a';
  g.beginPath();
  g.ellipse(fx, fy, rx, rx * 0.42, 0, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}
function drawWalkMark(g, ox, oy, z) {
  const m = walkMark;
  if (!m || m.z !== z) return;
  if (player.walk) m.moved = now;
  if (player.z !== m.z || (player.x === m.x && player.y === m.y) || now - m.at > 20000 || now - m.moved > 700) return void (walkMark = null);
  const sx = ox + m.x * TILE, sy = oy + m.y * TILE, size = TILE, pulse = (Math.sin(now / 160) + 1) / 2, inset = 1.5 + pulse * 1.5, arm = size * 0.28;
  g.fillStyle = `rgba(232, 181, 74, ${0.12 + pulse * 0.1})`;
  g.fillRect(sx + 1, sy + 1, size - 2, size - 2);
  g.strokeStyle = '#e8b54a';
  g.lineWidth = 1.25;
  g.lineCap = 'round';
  g.beginPath();
  for (const [cx, cy, dx, dy] of [[0, 0, 1, 1], [1, 0, -1, 1], [0, 1, 1, -1], [1, 1, -1, -1]]) { // the four corners, pointing in
    const x = sx + cx * size + dx * inset, y = sy + cy * size + dy * inset;
    g.moveTo(x, y + dy * arm);
    g.lineTo(x, y);
    g.lineTo(x + dx * arm, y);
  }
  g.stroke();
  g.lineCap = 'butt';
}

canvas.addEventListener('contextmenu', e => e.preventDefault());

// A finger on the map: a tap clicks, a long press uses, and a swipe walks - one
// tile for a quick swipe, and on and on while the finger stays down, steering
// like an invisible joystick (eight directions).
const SWIPE = 22; // px before a touch counts as a swipe
const SWIPE_KEYS = ['d', 'c', 's', 'z', 'a', 'q', 'w', 'e']; // by angle: east, south-east, south... (screen y is down)
const swipeKey = (dx, dy) => SWIPE_KEYS[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
function touchGesture(down, t, wx, wy) {
  let pressed = false, key = null, moved = false;
  canvas.setPointerCapture(down.pointerId);
  const timer = setTimeout(() => {
    pressed = true;
    if (navigator.vibrate) navigator.vibrate(15);
    const someone = creatureUnder(wx, wy) || npcs.find(n => n.x === t.x && n.y === t.y && n.z === t.z);
    if (someone && someone !== player) openCreatureMenu(down, someone, t); // hold someone: what to do with them
    else if (petUnder(wx, wy)) CompanionCard.open(); // hold your companion: his card (monsters first: he may be in front of one)
    else if (tileUsable(t, true)) Actions.interact('use', t.x, t.y, t.z); // hold something to use: use it
    else lookHere(t.x, t.y); // anything else: what is it?
  }, LONG_PRESS);
  const move = e => {
    if (e.pointerId !== down.pointerId) return;
    if (pressed) return;
    const dx = e.clientX - down.clientX, dy = e.clientY - down.clientY;
    if (!key && Math.hypot(dx, dy) < SWIPE) return;
    moved = true;
    clearTimeout(timer);
    if (typeof showFloatingStick === 'function') showFloatingStick(down.clientX, down.clientY, dx, dy);
    const k = swipeKey(dx, dy);
    if (k === key) return;
    if (key) Actions.keyUp(key);
    key = k;
    Actions.keyDown(k, false);
  };
  const up = e => {
    if (e.pointerId !== down.pointerId) return;
    window.removeEventListener('blur', cancelGesture);
    clearTimeout(timer);
    if (typeof hideFloatingStick === 'function') hideFloatingStick();
    for (const [ev, fn] of [['pointermove', move], ['pointerup', up], ['pointercancel', up], ['lostpointercapture', up]]) canvas.removeEventListener(ev, fn);
    if (key) Actions.keyUp(key);
    else if (!pressed && !moved && e.type === 'pointerup') clickTile(e, t, wx, wy);
  };
  const cancelGesture = () => up({ pointerId: down.pointerId, type: 'pointercancel' });
  window.addEventListener('blur', cancelGesture);
  for (const [ev, fn] of [['pointermove', move], ['pointerup', up], ['pointercancel', up], ['lostpointercapture', up]]) canvas.addEventListener(ev, fn);
}
// On a touch screen, a long press is the right click (use). The touch buttons can
// also make the next tap a use or a look.
let touchMode = null; // null, 'use' or 'look'
const LONG_PRESS = 450;
canvas.addEventListener('pointerdown', e => {
  if (paused || !player || player.dead) return;
  const t = tileUnderPointer(e), { wx, wy } = eventToWorld(e);
  if (useWith) {
    if (e.button === 0) Actions.useItemOn(useWith.ref, t.x, t.y, t.z);
    cancelUseWith();
    return;
  }
  if (e.pointerType === 'touch') {
    const mode = touchMode;
    if (mode) {
      setTouchMode(null);
      return mode === 'use' ? Actions.interact('use', t.x, t.y, t.z) : lookHere(t.x, t.y, creatureUnder(wx, wy));
    }
    const source = dragSourceAt(t);
    if (source) {
      startDrag(e, source.ref, source.icon, up => clickTile(up, t, wx, wy));
      return;
    }
    return touchGesture(e, t, wx, wy);
  }
  const source = e.button === 0 && !e.shiftKey && dragSourceAt(t);
  if (source) startDrag(e, source.ref, source.icon, up => clickTile(up, t, wx, wy));
  else clickTile(e, t, wx, wy);
});

// ---- drawing --------------------------------------------------------------------------------
function creatureKey(c) {
  if (c.type === 'player') return Sprites.playerKey(c.vocation, c.outfit);
  if (c.type === 'npc') return NPCS[c.npcId].creature || `npc:${c.npcId}`;
  if (c.pet === true) return Sprites.petKey(c.type, c.level); // (a companion: Clang wears his bell, and grows up)
  return c.rare ? `rare:${c.type}` : c.type; // (rare named kin: their own look)
}

// The highest floor you see from here: what's above you hides the floors over it (a roof, the storey above). And
// standing at a window or a door you look in: the roof of the building beyond lifts, that building's alone (peekLift:
// the town wall's walkway, the towers and the houses round it stay).
// Open ground of a floor above that only falls over you as it's drawn (it lies a tile down-right: the top of a wall
// you stand just north of, a mountain's top behind you) hides nothing: the floors stay, and you (and who's beside
// you) show through as a silhouette (coveredBy). Only a roof drawn over you lifts, to see behind the house; and what
// stands two floors or more above you and falls over you (a tower's upper floors, a spire, a taller house's roof, a high
// hilltop) hides, from there up, so you're never lost behind something tall.
const OPENING = id => id === 'window' || id === 'window_stained' || id.startsWith('door');
let coveredBy = false; // (this frame: open ground of a floor above drawn over you; see draw)
let peekLift = null; // (this frame: the box of the building you look into at its window or door; see Render's lift)
// A short covered way through (under a gatehouse, a wall, a bridge): open sky a few steps on two opposite sides,
// along walkable ground. Not a house: under a passage the floors above stay, as under the open ground beside one.
const sky = (x, y, z) => !map.get(x, y, z + 1);
function passage(x, y, z) {
  for (const [dx, dy] of [[0, 1], [1, 0]]) {
    const out = s => { for (let k = 1; k <= 3; k++) { const tx = x + dx * k * s, ty = y + dy * k * s; if (!map.isWalkable(tx, ty, z)) return false; if (sky(tx, ty, z)) return true; } return false; };
    if (out(1) && out(-1)) return true;
  }
  return false;
}
function seenTop(x, y, z) {
  const through = !sky(x, y, z) && passage(x, y, z);
  for (let up = z + 1; up < map.depth; up++) {
    const d = up - z, right = map.get(x, y, up), drawn = map.get(x + d, y + d, up);
    // (on the foot of steps or a mountain path its own top is right over you: no roof, look past it)
    if (right && through) { coveredBy = true; continue; }
    if (right && !(d === 1 && THINGS[right.ground] && THINGS[right.ground].change === -1)) return up - 1;
    // (two floors up or more, what stands just beside that spot rises over you too, a tall thing's picture reaching up-left:
    // a bell, a spire, a tower's wall; anything standing there hides those floors as well)
    if (!drawn && d >= 2) for (const [a, b] of [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [2, 2]]) {
      const n = map.get(x + d + a, y + d + b, up);
      if (n && n.items.length) return up - 1;
    }
    if (drawn) {
      // (a one-storey house's roof drawn over you lifts, to see behind the house; a taller one's storey right over you
      // stays, you showing through it as a silhouette, but its roof and all above lift)
      const roof = (THINGS[drawn.ground] && THINGS[drawn.ground].roof) || drawn.items.some(id => THINGS[id].roof);
      if (d === 1 && roof) return up - 1;
      if (d >= 2) return up - 1; // (something tall over you, two floors up or more, a high roof too: hidden from there up)
      coveredBy = true;
    }
  }
  return map.depth - 1;
}
function peekMaxZ(x, y, z) {
  coveredBy = false;
  peekLift = null;
  const top = seenTop(x, y, z);
  // beside a window or a door, outside: the building past it, which lifts its roof (only its own: peekLift)
  const opening = (tx, ty) => { const t = map.get(tx, ty, z); return !!t && t.items.some(OPENING); };
  if (top > z) for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    if (!opening(x + dx, y + dy) || !map.get(x + 2 * dx, y + 2 * dy, z + 1)) continue;
    const room = roomUnder(x + 2 * dx, y + 2 * dy, z);
    if (room) { peekLift = room; break; }
  }
  return top;
}
// The tiles under a floor above (a building's) joined to (x, y): their box, or null if too big to be one building
function roomUnder(x, y, z) {
  const seen = new Set([`${x},${y}`]), todo = [[x, y]], box = { x0: x, y0: y, x1: x, y1: y };
  while (todo.length) {
    const [a, b] = todo.pop();
    if (seen.size > 400) return null;
    box.x0 = Math.min(box.x0, a); box.x1 = Math.max(box.x1, a); box.y0 = Math.min(box.y0, b); box.y1 = Math.max(box.y1, b);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${a + dx},${b + dy}`;
      if (!seen.has(k) && map.get(a + dx, b + dy, z + 1) && map.get(a + dx, b + dy, z)) { seen.add(k); todo.push([a + dx, b + dy]); }
    }
  }
  return box;
}

function draw() {
  const pv = visual(player);
  const z = player.z;
  // on the north wall while the Host attacks, you look out over the battlements: the view slides a few tiles north
  siegeLook += ((siegeScene() && z > map.surfaceZ && player.y <= 97 ? 1 : 0) - siegeLook) * 0.05;
  const view = {
    cx: pv.x * TILE + TILE / 2, cy: pv.y * TILE + TILE / 2 - siegeLook * siegeLookTiles() * TILE, z,
    // Above ground you see down to the surface; underground only two floors deep.
    minZ: z >= map.surfaceZ ? map.surfaceZ : Math.max(0, z - 2),
    maxZ: z < map.surfaceZ || Render.off.has('floors') ? z : peekMaxZ(player.x, player.y, z), // underground there's rock above you
    w: VIEW_W * TILE, h: VIEW_H * TILE, time: now, objects: [],
    depth: 0.15, // what lies below you is darker
  };
  // the floors above with nothing anywhere near the view (most of them above open ground) aren't walked through at all
  // (a floor d up is drawn d tiles up-left of where it lies, so it's looked for that much further down-right too)
  // (only under the open sky: under a roof the floor above it is kept ready for when you step out: see Render.world)
  const hx = (VIEW_W >> 1) + 2, hy = (VIEW_H >> 1) + 2;
  if (view.maxZ === map.depth - 1) {
    while (view.maxZ > z && !map.floorNear(view.maxZ, player.x - hx, player.y - hy, player.x + hx + view.maxZ - z, player.y + hy + view.maxZ - z)) view.maxZ--;
  }
  Fx.frame(view);
  const [shakeX, shakeY] = Fx.offset(); // a big hit shakes the screen
  view.cx += shakeX;
  view.cy += shakeY;
  Object.assign(view, { onFloor: (g, ox, oy, z) => { drawWalkMark(g, ox, oy, z); drawGuideRing(g, ox, oy, z); drawPowerGround(g, ox, oy, z); }, afterGround: Fx.ground, wind: Render.skip('wind') ? 0 : Fx.wind(), roofSnow: Fx.roofSnow(), lift: z < map.surfaceZ || Render.off.has('floors') ? null : peekLift, beyond: f => (f === map.surfaceZ ? 'water' : null) });
  for (const p of piles) {
    const img = p.corpse ? Sprites.corpse(p.corpse) : p.items.length ? Sprites.groundItem(p.items[p.items.length - 1].id) : null;
    if (img) view.objects.push({ x: p.x, y: p.y, z: p.z, img });
  }
  for (const f of fields) view.objects.push({ x: f.x, y: f.y, z: f.z, img: Sprites.field(f.kind, now) });
  const riding = p => p.ride && p.ride.boarded; // in a cab, out of sight
  // (companions too: yours, and those of the players round you)
  const pets = [...new Set([player, ...players])].filter(p => p.petBody && !p.dead && !riding(p)).map(p => p.petBody);
  const creatures = [...npcs, ...monsters.filter(m => !m.dead), ...players.filter(p => !p.dead && !riding(p)), ...pets];
  // Only those on screen (or just off it) are drawn: the other thousand can wait.
  const shown = creatures.filter(c => Math.abs(c.x - player.x) <= VIEW_W / 2 + 3 && Math.abs(c.y - player.y) <= VIEW_H / 2 + 3);
  for (const c of shown) {
    const v = visual(c);
    const alpha = c.def && c.def.invisible ? (canSee(c) ? 0.6 : 0.15) : undefined;
    const img = strikeOf(c) || Sprites.creature(creatureKey(c), c.dir, v.frame), hit = Fx.creature(c, img); // a hit flashes and knocks it back
    view.objects.push({ x: c.x, y: c.y, z: c.z, vx: v.x + hit.dx, vy: v.y + hit.dy, lift: LIFT, alpha, flash: hit.flash, img, slant: true });
  }
  Fx.settle(new Set(creatures.map(c => c.id)));
  siegeObjects(view.objects); // (the Host at the north wall, for you alone: The Last Town)

  ctx.setTransform(SCALE * ZOOM, 0, 0, SCALE * ZOOM, 0, 0);
  ctx.imageSmoothingEnabled = false;
  Render.world(ctx, map, view);
  // a creature come into view: its pictures for every way it can face and every step, made between frames, so it doesn't
  // stop the game the first time it turns or walks
  for (const c of creatures) {
    const key = creatureKey(c);
    if (warmed.has(key)) continue;
    warmed.add(key);
    for (const d of [0, 1, 2, 3]) for (const f of [0, 1, 2]) Render.chores.push(() => Sprites.creature(key, d, f));
  }
  if (!waterWarmed && Sprites.WATER_MOVES) { waterWarmed = true; Render.chores.push(...Sprites.warmWater()); }
  Render.idle(); // (the ground ahead, and those pictures, made between frames)
  const ox = Math.round(view.w / 2 - view.cx), oy = Math.round(view.h / 2 - view.cy);
  // Walls can hide you; a faint silhouette on top keeps you visible behind them (and, under open ground of a floor
  // above drawn over you, who's right beside you too: coveredBy in peekMaxZ)
  const ghost = (c, v) => {
    const img = strikeOf(c) || Sprites.creature(creatureKey(c), c.dir, v.frame); // (a big picture has its tile in its bottom right)
    const px = Math.round(ox + v.x * TILE - LIFT - (Sprites.w(img) - TILE - (img.rx || 0))), py = Math.round(oy + v.y * TILE - LIFT - (Sprites.h(img) - TILE));
    Render.slanted(ctx, img, px, py, () => ctx.drawImage(img, px, py, Sprites.w(img), Sprites.h(img)));
  };
  ctx.globalAlpha = 0.35;
  if (coveredBy) for (const c of shown) if (c !== player && c.z === z && Math.max(Math.abs(c.x - player.x), Math.abs(c.y - player.y)) <= 2) ghost(c, visual(c));
  if (!player.dead && !riding(player)) ghost(player, pv);
  ctx.globalAlpha = 1;
  for (const p of players) if (riding(p) && p.z === z) {
    const v = visual(p);
    drawVehicle(p.ride.kind, ox + v.x * TILE, oy + v.y * TILE, true, p.dir === 3, p.ride.start);
  }
  drawEffects(ox, oy, z);
  drawSiege(ox, oy, z);
  if (!Render.skip('fx')) Fx.world(ctx, ox, oy, z);

  // Overlays are drawn in canvas pixels so text stays crisp.
  ctx.setTransform(ZOOM, 0, 0, ZOOM, 0, 0);
  const screen = (tx, ty) => [(ox + tx * TILE) * SCALE, (oy + ty * TILE) * SCALE];
  const darkness = z < map.surfaceZ ? 0.92 : Math.max((1 - daylight()) * 0.8, 0.35 * siegeLook); // (the Host brings a darkness with it)
  Fx.light(view, screen, pv, darkness, z < map.surfaceZ);
  if (!Render.skip('sky')) Fx.overlay(screen);
  // Who just hit you: 1 right after the hit, fading to 0.
  const struck = new Map();
  for (const fx of effects) if (fx.kind === 'attacker' && forViewer(fx, player) && now < fx.start + fx.dur) struck.set(fx.cid, 1 - (now - fx.start) / fx.dur);
  if (!Render.off.has('names')) {
    // (everyone you can see, on any floor in view: a floor d up is drawn d tiles up-left, so their name goes with them)
    for (const c of shown) if (c.z >= view.minZ && c.z <= view.maxZ && (c === player || !coveredFrom(c, view.maxZ)) && (!c.def || !c.def.invisible || canSee(c))) {
      const d = c.z - z;
      drawCreatureInfo(c, d ? (tx, ty) => screen(tx - d, ty - d) : screen, struck.get(c.id));
    }
    drawTexts(screen, z);
  }
  drawGuideArrow(screen);
  if (useWith) outlinedText(`Use ${useWith.name} on...`, viewPxW() / 2, 24, '#ffe080', 'bold 14px sans-serif');
  if (raidBanner && now < raidBanner.until) {
    wrapText(raidBanner.text, Math.floor(viewPxW() / 13)).forEach((line, i) => outlinedText(line, viewPxW() / 2, 60 + i * 28, raidBanner.color, '700 22px Inter, system-ui, sans-serif'));
  }

  if (player.dead) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, viewPxW(), viewPxH());
    outlinedText('You are dead', viewPxW() / 2, viewPxH() / 2, '#e5484d', '800 40px Inter, system-ui, sans-serif');
  }
  Fx.ambience();
}

// A soft round glow at (x, y), radius r: rgba is the colour's 'rgba(r,g,b,' start, a its strength at the middle.
// ---- the power shot (the effect 'shot', castPierce in game-combat.js): only how it looks; its hits are the game's -----
// Gold #FFD54A, amber #FFAA00, a near-white core #FFF4B0. Drawn in the shot's own frame (turned to its direction, so
// every one of the eight works the same), from the bow out:
//   charge  sparks drift in to the bow, a faint arc forms round it, the light at the nock grows
//   release a bright flash and a half circle of light at the bow; the arrow's beam stretched behind it for its speed
//   flight  a sharp golden arrowhead with a near-white core, a narrow beam behind it, thin ribbons curving round the
//           beam, sparks coming off and fading
//   impact  where it ends, a short burst and sparks flying out, gone in 200 ms
// Sparks are one small soft dot picture, made once and stamped (no gradient per spark per frame: smooth on a phone).
const PS_GOLD = '255,213,74', PS_AMBER = '255,170,0', PS_CORE = '255,244,176';
let psSpark = null;
function powerSpark(x, y, r, alpha) {
  if (!psSpark) {
    psSpark = document.createElement('canvas'); psSpark.width = psSpark.height = 16;
    const g = psSpark.getContext('2d'), grad = g.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, `rgba(${PS_CORE},1)`); grad.addColorStop(0.35, `rgba(${PS_GOLD},0.85)`); grad.addColorStop(1, `rgba(${PS_AMBER},0)`);
    g.fillStyle = grad; g.fillRect(0, 0, 16, 16);
  }
  if (alpha <= 0.01) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(psSpark, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}
function powerHead(x, len, half) { // a sharp triangle with a slight notch at its back, pointing along +x
  ctx.beginPath(); ctx.moveTo(x + len * 0.62, 0); ctx.lineTo(x - len * 0.38, -half); ctx.lineTo(x - len * 0.24, 0); ctx.lineTo(x - len * 0.38, half); ctx.closePath();
}
function drawPowerShot(fx, ox, oy) {
  const e = now - fx.start, sx = ox + fx.x * TILE + 16, sy = oy + fx.y * TILE + 12, ex = ox + fx.tx * TILE + 16, ey = oy + fx.ty * TILE + 12;
  const a = Math.atan2(ey - sy, ex - sx), D = Math.max(12, Math.hypot(ex - sx, ey - sy) - 10); // (D: from the bow to where it ends)
  ctx.save();
  ctx.translate(sx + Math.cos(a) * 10, sy + Math.sin(a) * 10); ctx.rotate(a); // (the bow, a little in front of the archer)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (e < fx.charge) { // ---- charge: drawn in, a faint arc, the nock brightening
    const k = e / fx.charge;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 10; i++) {
      const ph = (e / 650 + i / 10) % 1, ang = i * 2.4 + e / 900, rad = 26 * (1 - ph) + 3;
      powerSpark(Math.cos(ang) * rad, Math.sin(ang) * rad * 0.85, 1.6 + 0.8 * ph, ph * (0.25 + 0.65 * k));
    }
    powerSpark(4, 0, 3 + 6 * k, 0.35 + 0.6 * k);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgba(${PS_GOLD},${0.12 + 0.45 * k})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(-4, 0, 14, -1.3, 1.3); ctx.stroke();
    if (k > 0.6) { ctx.globalAlpha = (k - 0.6) / 0.4; ctx.fillStyle = `rgb(${PS_GOLD})`; powerHead(12, 10, 4); ctx.fill(); ctx.globalAlpha = 1; } // (the arrow taking shape)
    ctx.restore();
    return;
  }
  const r = e - fx.charge;
  if (r < fx.flight) { // ---- release and flight
    const p = r / Math.max(1, fx.flight), hx = D * p, rel = Math.max(0, 1 - r / 110); // (rel: the release, its first 110 ms)
    const tail = Math.min(hx, TILE * 2.6 + 40 * rel), t0 = hx - tail; // (the beam: stretched just after release)
    // the beam: amber edge, gold body (both painted), a near-white core (light)
    const beam = (w, col, o) => {
      const g = ctx.createLinearGradient(t0, 0, hx, 0);
      g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${o})`);
      ctx.strokeStyle = g; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(t0, 0); ctx.lineTo(hx - 6, 0); ctx.stroke();
    };
    beam(3.2, PS_AMBER, 0.5); beam(1.8, PS_GOLD, 1); // (narrow: a line, not a glow)
    // round the head, a crescent of light bowed out just ahead of its tip (the air it parts), and from its two horns
    // thin ribbons sweeping back along the beam, waving a little
    const CR = 15, cx0 = hx - 1, horn = 1.1, hxh = cx0 + Math.cos(horn) * CR, hyh = Math.sin(horn) * CR;
    ctx.strokeStyle = `rgba(${PS_GOLD},0.9)`; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx0, 0, CR, -horn, horn); ctx.stroke();
    for (const side of [-1, 1]) for (const [lift, back, w, o] of [[20, 48, 1, 0.8], [11, 60, 0.7, 0.55]]) {
      const ex2 = hx - back, wave = side * lift * (0.88 + 0.12 * Math.sin(r / 60 + lift));
      const g = ctx.createLinearGradient(hxh, 0, ex2, 0);
      g.addColorStop(0, `rgba(${PS_GOLD},${o})`); g.addColorStop(1, `rgba(${PS_GOLD},0)`);
      ctx.strokeStyle = g; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(hxh, side * hyh); ctx.quadraticCurveTo(hx - back * 0.3, wave, ex2, side * lift * 0.3); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    beam(0.9, PS_CORE, 1);
    // the shine: white light running up the beam to the head, again and again
    for (const off of [0, 0.5]) {
      const u = ((r / 170) + off) % 1, at = t0 + (hx - t0) * u, len = 12;
      const g = ctx.createLinearGradient(at - len, 0, at + len, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${0.9 * Math.sin(u * Math.PI)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(Math.max(t0, at - len), 0); ctx.lineTo(Math.min(hx - 4, at + len), 0); ctx.stroke();
    }
    // sparks coming off behind the head, drifting out and fading
    for (let i = 0; i < 6; i++) {
      const ph = (r / 420 + i / 6) % 1, back = ph * tail * 0.9;
      if (back > hx) continue;
      powerSpark(hx - 6 - back, Math.sin(i * 1.9) * (2 + ph * 7), 1.3 - ph * 0.6, (1 - ph) * 0.8);
    }
    // the release: a bright flash and a half circle of light round the bow
    if (rel > 0) {
      powerSpark(0, 0, 8 + 10 * rel, rel);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `rgba(${PS_GOLD},${rel})`; ctx.lineWidth = 2.6 * rel + 0.6;
      ctx.beginPath(); ctx.arc(-2, 0, 22 - 6 * rel, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    }
    // the arrowhead: amber at its back, gold, a near-white core; a thin gold edge so it holds on any ground
    ctx.globalCompositeOperation = 'source-over';
    const L = 25 * (1 + 0.15 * rel), H = 8; // (long and narrow: sharp) // (a little longer just after release: speed)
    const g = ctx.createLinearGradient(hx - L * 0.4, 0, hx + L * 0.62, 0);
    g.addColorStop(0, `rgb(${PS_AMBER})`); g.addColorStop(0.55, `rgb(${PS_GOLD})`); g.addColorStop(1, `rgb(${PS_CORE})`);
    powerHead(hx, L, H); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(150,84,0,0.85)'; ctx.lineWidth = 0.8; ctx.stroke(); // (a dark rim: clear on grass, water, dirt and stone)
    ctx.globalCompositeOperation = 'lighter';
    powerHead(hx + 3, L * 0.5, H * 0.35); ctx.fillStyle = `rgba(${PS_CORE},0.95)`; ctx.fill();
    { // the shine running over the arrowhead: a white band sweeping from its back to its tip, where it flares
      const u = (r / 170) % 1, bx0 = hx - L * 0.4, sweep = bx0 + (L * 1.02) * u, w = 4;
      ctx.save(); powerHead(hx, L, H); ctx.clip();
      const g = ctx.createLinearGradient(sweep - w, 0, sweep + w, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(sweep - w, -H, w * 2, H * 2);
      ctx.restore();
      if (u > 0.8) powerSpark(hx + L * 0.6, 0, 2.5 + 4 * (u - 0.8) / 0.2, (u - 0.8) / 0.2); // (and a glint at the tip)
    }
    powerSpark(hx + L * 0.6, 0, 3.5, 0.6); // (a little warm light at its tip)
  } else { // ---- impact: a short burst and sparks flying out where it ends
    const f = Math.min(1, (r - fx.flight) / 200);
    ctx.globalCompositeOperation = 'lighter';
    powerSpark(D, 0, 6 + 10 * f, 0.9 * (1 - f));
    ctx.strokeStyle = `rgba(${PS_GOLD},${0.9 * (1 - f)})`; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4 + 0.3; ctx.moveTo(D + Math.cos(an) * (4 + 12 * f), Math.sin(an) * (4 + 12 * f)); ctx.lineTo(D + Math.cos(an) * (8 + 20 * f), Math.sin(an) * (8 + 20 * f)); }
    ctx.stroke();
  }
  ctx.restore();
}

// The lightning bolt (the effect 'chain', castChain in game-combat.js): each leap shows as its strike lands (fx.step ms
// apart), a jagged bolt - a wide violet glow, a pale blue body, a white core - that crackles (its zigzag changes every
// few hundredths of a second) and fades in a quarter of a second, with a flash where it strikes.
function drawLightningChain(fx, ox, oy) {
  const e = now - fx.start, pts = fx.points;
  const P = (p, i) => { // (where it is now, if still about: the bolt follows what it struck as it moves)
    const c = fx.ids && creatureById(fx.ids[i]), v = c && c.z === fx.z ? visual(c) : p;
    return [ox + v.x * TILE + 16, oy + v.y * TILE + 12];
  };
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i + 1 < pts.length; i++) {
    const t = e - i * fx.step; // (this leap's own time: it shows from its start)
    if (t < 0 || t > 260) continue;
    const fade = t < 40 ? 1 : 1 - (t - 40) / 220, [x0, y0] = P(pts[i], i), [x1, y1] = P(pts[i + 1], i + 1);
    const len = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / len, ny = (x1 - x0) / len, n = Math.max(3, Math.round(len / 9));
    const seed = Math.floor(now / 45) * 31 + i * 7; // (a new zigzag every 45 ms: it crackles)
    const zig = [[x0, y0]];
    for (let k = 1; k < n; k++) { const f = k / n, off = (Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453 % 1) * 9 * Math.sin(Math.PI * f); zig.push([x0 + (x1 - x0) * f + nx * off, y0 + (y1 - y0) * f + ny * off]); }
    zig.push([x1, y1]);
    const path = () => { ctx.beginPath(); ctx.moveTo(zig[0][0], zig[0][1]); for (let k = 1; k < zig.length; k++) ctx.lineTo(zig[k][0], zig[k][1]); };
    for (const [w, col] of [[7, `rgba(150,110,255,${0.35 * fade})`], [3.2, `rgba(150,215,255,${0.8 * fade})`], [1.3, `rgba(255,255,255,${fade})`]]) {
      path(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
    }
    if (t < 160) { // a thin fork off the middle of it, now and then
      const m = zig[Math.floor(zig.length / 2)], fa = Math.atan2(y1 - y0, x1 - x0) + (seed % 2 ? 0.9 : -0.9);
      ctx.strokeStyle = `rgba(170,220,255,${0.6 * fade})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(m[0], m[1]); ctx.lineTo(m[0] + Math.cos(fa) * 8, m[1] + Math.sin(fa) * 8); ctx.lineTo(m[0] + Math.cos(fa + 0.5) * 14, m[1] + Math.sin(fa + 0.5) * 14); ctx.stroke();
    }
    glowDot(x1, y1, 10 * fade + 4, 'rgba(190,225,255,', 0.8 * fade); // (the flash where it strikes)
  }
  ctx.restore();
}

// A falcon in flight, seen from above (x, y its middle, a its heading, flap 0..1 how far its wings are swept back)
function drawFalcon(x, y, a, flap, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(scale, scale);
  const sweep = 0.35 + 0.5 * flap;
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(3, 7, 7, 3, 0, 0, Math.PI * 2); ctx.fill(); // (its shadow below)
  for (const side of [-1, 1]) { // the wings: long and pointed, out to the sides, their tips swept back as it flaps
    const tx = -1 - 4 * sweep, ty = side * (12 - 3 * sweep);
    ctx.fillStyle = '#4e3420';
    ctx.beginPath(); ctx.moveTo(2, side * 1.2); ctx.quadraticCurveTo(2, side * 8, tx, ty); ctx.quadraticCurveTo(-3, side * 6, -4, side * 1.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a07a52';
    ctx.beginPath(); ctx.moveTo(1.6, side * 1.4); ctx.quadraticCurveTo(1.4, side * 6.5, tx + 0.6, ty - side * 1.2); ctx.quadraticCurveTo(-1, side * 4, -2, side * 1.6); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#5a3c22'; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-10, -2.5); ctx.lineTo(-10, 2.5); ctx.closePath(); ctx.fill(); // its tail
  ctx.fillStyle = '#8a6440'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.4, 0, 0, Math.PI * 2); ctx.fill();                       // its body
  ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.arc(4, 0, 1.9, 0, Math.PI * 2); ctx.fill();                                    // its head
  ctx.fillStyle = '#e8b030'; ctx.beginPath(); ctx.moveTo(5.6, -0.6); ctx.lineTo(7.2, 0); ctx.lineTo(5.6, 0.6); ctx.closePath(); ctx.fill(); // its beak
  ctx.restore();
}

function glowDot(x, y, r, rgba, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `${rgba}${a})`); g.addColorStop(0.4, `${rgba}${a * 0.5})`); g.addColorStop(1, `${rgba}0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

const creatureById = id => players.find(p => p.id === id) || monsters.find(m => m.id === id) || npcs.find(n => n.id === id);
// A player in the middle of a sweeping strike (the circle throw's arc): their strike's picture for now - the wind-up, the
// middle or the follow-through, as far as the swing has come - or null (no strike going on, or no picture for it).
// (a power shot likewise: drawing the bow, at full draw, loosed; and every plain shot from a bow: full draw, then loosed)
const swingOf = c => c.type === 'player' && effects.find(fx => (fx.kind === 'arc' || fx.kind === 'shot' || fx.kind === 'loose' || fx.kind === 'volley') && fx.cid === c.id && now >= fx.start && now < fx.start + fx.dur);
function strikeOf(c) {
  const fx = swingOf(c);
  if (!fx) return null;
  if (fx.kind === 'loose') { // a plain blow or shot: a bow at full draw, then loosed; a spear wound up, swung, followed through
    if (c.walk) return null;
    const e = now - fx.start;
    return fx.weapon === 'spear' ? Sprites.playerAttack(creatureKey(c), c.dir, e < 90 ? 0 : e < 200 ? 1 : 2)
      : Sprites.playerAttack(creatureKey(c), c.dir, e < 110 ? 1 : 2, 'bow');
  }
  if (fx.kind === 'volley') { // drawn quickly, then loosed, drawn again, loosed... (gone from the picture after its last arrow)
    const e = now - fx.start - fx.lead;
    if (e < 0) return Sprites.playerAttack(creatureKey(c), c.dir, e < -fx.lead / 2 ? 0 : 1, 'bow');
    const i = Math.floor(e / fx.gap), r = e - i * fx.gap;
    if (i >= fx.shots - 1) return e - (fx.shots - 1) * fx.gap < 260 ? Sprites.playerAttack(creatureKey(c), c.dir, 2, 'bow') : null;
    return Sprites.playerAttack(creatureKey(c), c.dir, r < fx.gap * 0.5 ? 2 : 1, 'bow');
  }
  if (fx.kind === 'shot') {
    const e = now - fx.start;
    return Sprites.playerAttack(creatureKey(c), c.dir, e < fx.charge * 0.55 ? 0 : e < fx.charge ? 1 : 2, 'bow');
  }
  const t = (now - fx.start) / fx.dur;
  return Sprites.playerAttack(creatureKey(c), c.dir, t < 0.28 ? 0 : t < 0.62 ? 1 : 2);
}

// Missiles, hit bursts and sparkles, in world pixels; sounds are played once.
// ---- The Last Town's siege (game-siege.js): the Hollow Host comes out of the dark north of the moat, mills there,
// and when the cannons fire, those struck vanish in fire and the rest run. Only you see it: drawn from your quest,
// never part of the world. The figures are the monsters' own pictures. ----
const SIEGE_KINDS = ['goblin', 'wolf', 'skeleton', 'goblin', 'spider', 'skeleton', 'wolf'];
// how far north the view slides on the wall: enough to see the Host's front rows (row 84 on), whatever the view's size
const siegeLookTiles = () => Math.max(0, Math.min(4, VIEW_H / 2 - 3, player.y - 84 - VIEW_H / 2)); // (and always 3 rows below you in sight: the steps down)
let siegeLook = 0; // (0 to 1, eased)
let siegeFigures = null;
function siegeHost() { // where each figure ends up at the moat (worked out once): land north of it, between the towers
  if (siegeFigures) return siegeFigures;
  siegeFigures = [];
  const taken = new Set(); // (one to a tile: no twins side by side)
  for (let i = 0; i < 400 && siegeFigures.length < 70; i++) {
    const x = 100 + ((i * 37) % 53), y = 85 + ((i * 7 + (i >> 3)) % 5), key = `${x},${y}`;
    if (taken.has(key) || !map.isWalkable(x, y, map.surfaceZ)) continue;
    taken.add(key);
    siegeFigures.push({ i, x, y, type: SIEGE_KINDS[(i * 5 + (i >> 2)) % SIEGE_KINDS.length], struck: i % 3 === 0 });
  }
  return siegeFigures;
}
// A figure now: where it is, which way it faces, whether it walks, how much of it is left (null: gone)
function siegeFigure(f, sc) {
  const t = now - sc.at - f.i * 140;
  if (t < 0) return null;
  const march = Math.min(1, t / 9000), sway = 0.4 * Math.sin((now + f.i * 410) / 1100);
  let x = f.x + sway, y = f.y - 14 * (1 - march), dir = 2, walk = march < 1 || Math.sin((now + f.i * 300) / 600) > 0.4, alpha = Math.min(1, t / 800);
  if (sc.fired) {
    const r = now - sc.fired - (f.i % 4) * SIEGE_VOLLEY_MS - 300;
    if (r > 0 && f.struck) { if (r > 700) return null; alpha = 1 - r / 700; walk = false; }
    else if (r > 0) { y -= r / 700; dir = 0; walk = true; alpha = Math.max(0, 1 - r / (SIEGE_RETREAT_MS - 3000)); if (!alpha) return null; }
  }
  return { x, y, dir, walk, alpha };
}
function siegeObjects(objects) {
  const sc = siegeScene();
  if (!sc) return;
  for (const f of siegeHost()) {
    const o = siegeFigure(f, sc);
    if (!o || Math.abs(o.x - player.x) > VIEW_W / 2 + 3 || Math.abs(o.y - player.y) > VIEW_H / 2 + 3) continue;
    const img = Sprites.creature(f.type, o.dir, o.walk ? 1 + (Math.floor((now + f.i * 170) / 200) % 2) : 0);
    objects.push({ x: Math.round(o.x), y: Math.round(o.y), z: map.surfaceZ, vx: o.x, vy: o.y, lift: LIFT, alpha: o.alpha, img, slant: true });
  }
}
// Its fire and smoke, in world pixels: torches among the Host; when the cannons fire, each in turn along the wall a
// flash and a cloud at its muzzle, and fire where its ball lands among them
function drawSiege(ox, oy, z) {
  const sc = siegeScene();
  if (!sc) return;
  const at = (x, y, fz) => [ox + (x - (fz - z) + 0.5) * TILE, oy + (y - (fz - z) + 0.5) * TILE];
  const blob = (x, y, r, color, a) => { if (a <= 0) return; ctx.globalAlpha = a; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  ctx.save();
  for (const f of siegeHost()) { // (every fourth carries a torch)
    if (f.i % 4) continue;
    const o = siegeFigure(f, sc);
    if (!o) continue;
    const [x, y] = at(o.x, o.y, map.surfaceZ), fl = 0.8 + 0.2 * Math.sin(now / 70 + f.i);
    blob(x + 6, y - 22, 9 * fl, '#ff8a2a', 0.18 * o.alpha); blob(x + 6, y - 22, 3.5 * fl, '#ffd27a', 0.9 * o.alpha);
  }
  if (sc.fired) {
    const loaded = ((player.quests.last_town || {}).loaded || []).map(k => k.split(',').map(Number));
    loaded.forEach(([cx, cy, cz], k) => {
      const t = now - sc.fired - k * SIEGE_VOLLEY_MS;
      if (t < 0 || t > 2600) return;
      const [mx, my] = at(cx, cy - 0.6, cz);
      if (t < 160) blob(mx, my, 12, '#fff2b0', 1 - t / 160);
      for (let p = 0; p < 4; p++) blob(mx + (p - 1.5) * 5 + t / 120, my - t / 60 - p * 3, 6 + t / 110 + p * 2, '#9a968e', 0.55 * (1 - t / 2600));
      const land = t - 260; // (the ball lands among them)
      if (land > 0 && land < 1300) {
        const [bx, by] = at(cx + ((k * 3) % 5) - 2, 86 + (k % 3), map.surfaceZ);
        blob(bx, by, 6 + land / 40, '#ff7a1a', 0.85 * (1 - land / 1300));
        blob(bx, by, 3 + land / 90, '#ffe08a', 1 - land / 700);
        blob(bx + 4, by - 6 - land / 50, 8 + land / 60, '#3a3632', 0.5 * (1 - land / 1300));
      }
    });
  }
  ctx.restore();
}

function drawEffects(ox, oy, z) {
  for (const fx of effects) {
    if (fx.kind === 'sound') {
      if (!fx.played && fx.z === player.z && dist(fx, player) <= 10) Sound.play(fx.name);
      fx.played = true;
      continue;
    }
    if (fx.z !== z) continue;
    const t = Math.max(0, Math.min(1, (now - fx.start) / fx.dur));
    if (fx.kind === 'missile') {
      const x = ox + (fx.fx + (fx.tx - fx.fx) * t) * TILE + 16, y = oy + (fx.fy + (fx.ty - fx.fy) * t) * TILE + 16;
      if (['arrow', 'bolt', 'spear'].includes(fx.style)) {
        const a = Math.atan2(fx.ty - fx.fy, fx.tx - fx.fx), len = fx.style === 'spear' ? 9 : 6;
        ctx.strokeStyle = '#8a5a2a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(a) * len, y - Math.sin(a) * len);
        ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.stroke();
        ctx.fillStyle = '#ddd';
        ctx.fillRect(x + Math.cos(a) * len - 1, y + Math.sin(a) * len - 1, 2, 2);
      } else if (fx.style === 'boulder') {
        ctx.fillStyle = '#6a6a70';
        ctx.beginPath();
        ctx.arc(x, y - Math.sin(t * Math.PI) * 10, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9a9aa0';
        ctx.fillRect(x - 2, y - Math.sin(t * Math.PI) * 10 - 3, 3, 2);
      } else {
        ctx.fillStyle = ELEMENT_COLORS[fx.style] || '#fff';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    } else if (fx.kind === 'arc') { // the circle throw: a war spear swung round from the player's middle, a pale crescent behind its blade
      const who = fx.cid && creatureById(fx.cid), v = who && who.x === fx.x && who.y === fx.y ? visual(who) : fx; // (following the swinger's step)
      const cx = ox + v.x * TILE + 16, cy = oy + v.y * TILE + 10, r = fx.radius * TILE + 6, ease = 1 - (1 - t) * (1 - t), a = fx.a0 + fx.sweep * ease;
      ctx.save();
      const sg = Math.sign(fx.sweep) || 1, trail = Math.min(1.2, Math.abs(fx.sweep) * ease); // (the crescent: the blade's last part of the way, fading towards its start)
      ctx.globalCompositeOperation = 'lighter'; // (the crescent glows: light adds up)
      for (let k = 0; k < 6; k++) {
        const a1 = a - sg * trail * (k / 6), a2 = a - sg * trail * ((k + 1) / 6), lo = Math.min(a1, a2), hi = Math.max(a1, a2);
        ctx.globalAlpha = (0.5 - k * 0.075) * (1 - t * 0.4);
        ctx.fillStyle = k < 2 ? '#f4ffb0' : '#c8f060';
        ctx.beginPath(); ctx.arc(cx, cy, r, lo, hi); ctx.arc(cx, cy, r * (0.62 + k * 0.03), hi, lo, true); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 0.8 * (1 - t * 0.5); ctx.strokeStyle = '#fbffd8'; ctx.lineWidth = 2; // (its bright leading edge)
      ctx.beginPath(); ctx.arc(cx, cy, r, Math.min(a, a - sg * Math.min(0.5, trail)), Math.max(a, a - sg * Math.min(0.5, trail))); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      if (who && strikeOf(who)) { ctx.restore(); continue; } // (the spear is in the strike's picture: only the crescent here)
      ctx.translate(cx, cy); ctx.rotate(a);
      ctx.strokeStyle = '#6e4a22'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(r - 8, 0); ctx.stroke();       // the shaft, from the hands outwards
      ctx.fillStyle = '#dfe4ea'; ctx.strokeStyle = '#8a9098'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(r - 9, -3.5); ctx.lineTo(r + 3, 0); ctx.lineTo(r - 9, 3.5); ctx.closePath(); ctx.fill(); ctx.stroke(); // the blade
      ctx.restore();
    } else if (fx.kind === 'shot') { // the power shot: charged at the bow, loosed with a flash, a golden arrow in flight, a burst where it ends
      drawPowerShot(fx, ox, oy);
    } else if (fx.kind === 'chain') { // lightning bolt: a jagged bolt from the caster to the target, then leaping on from one to the next
      drawLightningChain(fx, ox, oy);
    } else if (fx.kind === 'volley') { // quick arrows at the target (the Volley line), each a short streak with a flash at the bow
      // (look 0: pale light, a trial's Triple Shot; 1: a red trail following each arrow; 2: blood-red, a dark core and a
      // glow; 3: darker still, a smoking trail, sparks thrown off and a shudder of light at the bow)
      const e = now - fx.start, look = fx.look || 0, sx = ox + fx.x * TILE + 16, sy = oy + fx.y * TILE + 12, ex = ox + fx.tx * TILE + 16, ey = oy + fx.ty * TILE + 12;
      const a = Math.atan2(ey - sy, ex - sx), bx = sx + Math.cos(a) * 10, by = sy + Math.sin(a) * 10, nx = -Math.sin(a), ny = Math.cos(a);
      const C = look === 0 ? { glow: 'rgba(210,236,255,', ray: '200,232,255', tail: '150,200,255', head: '225,242,255', dot: 'rgba(235,248,255,' }
        : look === 1 ? { glow: 'rgba(255,90,70,', ray: '255,90,70', tail: '235,20,10', head: '255,80,60', dot: 'rgba(255,200,180,' }
          : look === 2 ? { glow: 'rgba(255,40,30,', ray: '255,70,50', tail: '200,0,0', head: '255,90,70', dot: 'rgba(255,170,150,' }
            : { glow: 'rgba(255,30,20,', ray: '255,60,30', tail: '140,0,0', head: '255,60,40', dot: 'rgba(255,200,120,' };
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      if (look >= 3 && e < fx.lead + (fx.shots - 1) * fx.gap + 120) glowDot(bx, by, 9 + 3 * Math.sin(e / 30), 'rgba(255,40,20,', 0.35); // (the bow smoulders while it looses)
      for (let i = 0; i < fx.shots; i++) {
        const r = e - fx.lead - i * fx.gap;
        if (r < 0) continue;
        if (i && !(fx.twang & (1 << i))) { fx.twang = (fx.twang || 0) | (1 << i); if (fx.z === player.z && dist(fx, player) <= 10) Sound.play('shoot'); }
        if (r < 120) { // loosed: a quick flash and short rays
          const f = 1 - r / 120;
          glowDot(bx, by, (4 + 6 * f) * (1 + look * 0.2), C.glow, 0.75 * f);
          for (let k = -1; k <= 1; k++) {
            const ra = a + k * 0.22, len = (14 + (1 - Math.abs(k)) * 8) * (1 + look * 0.15);
            ctx.strokeStyle = `rgba(${C.ray},${0.5 * f})`; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(bx + Math.cos(ra) * 3, by + Math.sin(ra) * 3); ctx.lineTo(bx + Math.cos(ra) * len, by + Math.sin(ra) * len); ctx.stroke();
          }
        }
        const p = Math.min(1, r / Math.max(1, fx.flight)), fade = r > fx.flight ? Math.max(0, 1 - (r - fx.flight) / (look ? 220 : 120)) : 1;
        if (fade <= 0) continue;
        const off = (i - (fx.shots - 1) / 2) * 2.5, x = sx + (ex - sx) * p + nx * off, y = sy + (ey - sy) * p + ny * off; // (each arrow a little beside the last)
        // its trail: following it all the way from the bow (a red line, hanging a moment after it lands), longer the meaner
        const tail = look ? Math.hypot(ex - sx, ey - sy) * p : Math.min(TILE * 1.3, Math.hypot(ex - sx, ey - sy) * p), tx = x - Math.cos(a) * tail, ty = y - Math.sin(a) * tail;
        for (const [w, al] of look >= 2 ? [[7, 0.28], [3, 0.7], [1.2, 0.9]] : look ? [[5, 0.35], [2, 1]] : [[5, 0.22], [1.8, 0.85]]) {
          const grad = ctx.createLinearGradient(tx, ty, x, y);
          grad.addColorStop(0, `rgba(${C.tail},0)`); grad.addColorStop(0.6, `rgba(${C.tail},${al * 0.5 * fade})`); grad.addColorStop(1, `rgba(${C.head},${al * fade})`);
          ctx.strokeStyle = grad; ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
        }
        if (look >= 2 && p < 1) { // a dark core down its middle, so it reads as an arrow of blood, not of light
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = `rgba(60,0,0,${0.75 * fade})`; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * 9, y - Math.sin(a) * 9); ctx.lineTo(x, y); ctx.stroke();
          ctx.globalCompositeOperation = 'lighter';
        }
        if (look >= 3 && p < 1) for (let k = 0; k < 3; k++) { // sparks thrown off behind it
          const q = ((r * 7 + k * 53 + i * 31) % 100) / 100, d = 6 + q * 22, s2 = (k - 1) * (2 + q * 4);
          glowDot(x - Math.cos(a) * d + nx * s2, y - Math.sin(a) * d + ny * s2, 1.6, 'rgba(255,170,60,', 0.8 * (1 - q));
        }
        if (p < 1) glowDot(x, y, 4 + look, C.dot, 0.85);
        else if (look >= 3 && r - fx.flight < 200) glowDot(x, y, 6 + 10 * (r - fx.flight) / 200, 'rgba(255,40,20,', 0.6 * (1 - (r - fx.flight) / 200)); // (a burst where it strikes)
      }
      ctx.restore();
    } else if (fx.kind === 'falcon_aloft') { // a hunting falcon circling over its Hawk (not while it dives: see falcon_dive)
      const who = creatureById(fx.cid);
      if (!who || who.z !== fx.z || effects.some(d => d.kind === 'falcon_dive' && d.cid === fx.cid && d.turn === fx.turn && !d.mark && now >= d.start && now < d.start + d.dur)) continue;
      const v = visual(who), a = (now - fx.start) / 900 + fx.turn * Math.PI * 2 / fx.of, fade = Math.min(1, (now - fx.start) / 300, (fx.start + fx.dur - now) / 300);
      const cx = ox + v.x * TILE + 16 + Math.cos(a) * 18, cy = oy + v.y * TILE - 22 + Math.sin(a) * 9;
      ctx.globalAlpha = Math.max(0, fade);
      drawFalcon(cx, cy, a + Math.PI / 2, 0.5 + 0.5 * Math.sin(now / 90 + fx.turn), 1);
      ctx.globalAlpha = 1;
    } else if (fx.kind === 'falcon_dive') { // the falcon stooping on the target and climbing back (a mark: it flies off after)
      const who = creatureById(fx.cid), tgt = creatureById(fx.tid), e = now - fx.start;
      const v = who && who.z === fx.z ? visual(who) : fx, tv = tgt && tgt.z === fx.z && !tgt.dead ? visual(tgt) : { x: fx.tx, y: fx.ty };
      const hx = ox + v.x * TILE + 16, hy = oy + v.y * TILE - 22, tx = ox + tv.x * TILE + 16, ty = oy + tv.y * TILE + 4;
      const out = e < fx.dive, p = out ? e / fx.dive : Math.min(1, (e - fx.dive) / (fx.dive + 120)), ease = out ? p * p : p;
      const [ax, ay, bx, by] = out ? [hx, hy, tx, ty] : fx.mark ? [tx, ty, tx + 60, ty - 90] : [tx, ty, hx, hy];
      const x = ax + (bx - ax) * ease, y = ay + (by - ay) * ease - (out ? 0 : Math.sin(p * Math.PI) * 18), a = Math.atan2(by - ay, bx - ax);
      ctx.globalAlpha = fx.mark && !out ? 1 - p : 1;
      drawFalcon(x, y, a, out ? 0.95 : 0.4 + 0.5 * Math.sin(now / 70), out ? 1.1 : 1);
      ctx.globalAlpha = 1;
      if (!out && e - fx.dive < 160) glowDot(tx, ty, 6, 'rgba(255,233,176,', 0.6 * (1 - (e - fx.dive) / 160));
    } else if (fx.kind === 'impact') { // where a strike lands: a flash, and rays of light shooting out every way
      if (now < fx.start) continue; // (a Sky Lance's burst: when its arrow gets there)
      const cx = ox + fx.x * TILE + 16, cy = oy + fx.y * TILE + 10, f = 1 - t, [r, g, b] = [1, 3, 5].map(k => parseInt(fx.glow.slice(k, k + 2), 16));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const sz = fx.small ? 0.55 : 1, n = fx.small ? 6 : 10; // (a triple shot's arrows: smaller bursts)
      glowDot(cx, cy, (6 + 12 * t) * sz, `rgba(${r},${g},${b},`, 0.8 * f);
      ctx.lineCap = 'round';
      for (let k = 0; k < n; k++) {
        const ra = k * Math.PI * 2 / n + (fx.x * 7 + fx.y * 3) % 5 * 0.2, len = (10 + (k % 3) * 6) * (0.4 + t) * sz;
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.7 * f})`; ctx.lineWidth = 2 * f + 0.5;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(ra) * len * 0.35, cy + Math.sin(ra) * len * 0.35); ctx.lineTo(cx + Math.cos(ra) * len, cy + Math.sin(ra) * len); ctx.stroke();
      }
      ctx.restore();
    } else if (fx.kind === 'vehicle') { // a ride arriving to pick someone up (and waiting), or leaving
      const p = fx.travel ? Math.min(1, (now - fx.start) / fx.travel) : t, s = p * p * (3 - 2 * p), off = fx.from + (fx.to - fx.from) * s;
      if (fx.vehicle === 'balloon') drawVehicle('balloon', ox + fx.x * TILE, oy + fx.y * TILE - Math.abs(off) * 6 * TILE, false, false);
      else drawVehicle(fx.vehicle, ox + (fx.x + off * 8) * TILE, oy + fx.y * TILE, false, false);
    } else if (fx.kind === 'flyby') {
      drawFlyby(fx, ox, oy);
    } else if (fx.kind === 'burst') {
      const x = ox + fx.x * TILE + 16, y = oy + fx.y * TILE + 16, r = 4 + t * 10;
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = fx.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.moveTo(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4);
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (fx.kind === 'sparkle') {
      const c = creatureById(fx.cid), v = c ? visual(c) : fx;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = fx.color;
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + t * 3;
        ctx.fillRect(ox + v.x * TILE + 16 + Math.cos(a) * 10, oy + v.y * TILE + 20 - t * 18 + Math.sin(a) * 4, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
  }
}

// A ride at tile position (x, y) in world pixels: a cab, a balloon or Dom's car,
// facing west if `left`. Dom pulls a wheelie for the first moments after `start`.
function drawVehicle(kind, x, y, passenger, left, start = 0) {
  const frame = Math.floor(now / 90) % 4;
  ctx.save();
  if (left) { // mirror around the tile's center
    ctx.translate(2 * x + TILE, 0);
    ctx.scale(-1, 1);
  }
  if (kind === 'balloon') {
    const bob = Math.sin(now / 400) * 3;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x + 16, y + 28, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(Sprites.balloon(passenger), x - 32, y - 112 + bob);
  } else if (kind === 'dom') {
    const w = now - start, lift = start && w < 900 ? Math.sin((Math.PI * w) / 900) * 0.45 : 0;
    if (start && w < 1300) { // burnout: tyre smoke behind the rear wheel
      for (let i = 0; i < 5; i++) {
        const age = ((w / 220 + i / 5) % 1);
        ctx.fillStyle = `rgba(210,210,215,${0.6 * (1 - age)})`;
        ctx.beginPath();
        ctx.arc(x - 6 - age * 22, y + 20 - age * 14, 4 + age * 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.translate(x - 16 + 15, y - 25 + 47); // turn around the rear wheel
    ctx.rotate(-lift);
    ctx.drawImage(Sprites.domCar(frame), -15, -47);
  } else if (kind === 'cart') {
    ctx.drawImage(Sprites.mineCart(passenger), x - 16 + (frame % 2), y - 24);
  } else {
    ctx.drawImage(Sprites.cab(passenger, frame % 2), x - 9, y - 30); // the door on the tile
  }
  ctx.restore();
}

// The Webwood easter egg: the car, the giant spiders chasing it, and the sparks
// the boys fire back at them. All of it follows from the effect's clock.
const flybyX = (fx, lag) => fx.fx + (fx.tx - fx.fx) * ((now - fx.start) / fx.dur - lag);
function drawFlyby(fx, ox, oy) {
  const dir = Math.sign(fx.tx - fx.fx), carX = ox + flybyX(fx, 0) * TILE, rowY = oy + fx.y * TILE;
  const spiders = [[0.09, 1], [0.15, 0], [0.21, 2]].map(([lag, dy]) => ({ x: ox + flybyX(fx, lag) * TILE, y: rowY + dy * TILE }));
  for (const s of spiders) {
    const img = Sprites.creature('giant_spider', dir > 0 ? 1 : 3, Math.floor(now / 120) % 3);
    const w = Sprites.w(img), h = Sprites.h(img);
    ctx.drawImage(img, s.x - (w - TILE), s.y - (h - TILE), w, h);
  }
  const bob = Math.sin(now / 110) * 3, carY = rowY - 22 + bob;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(carX + 16, rowY + 28, 20, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(carX + 16, carY);
  ctx.scale(dir, 1);
  ctx.drawImage(Sprites.flyingCar(), -24, 0);
  ctx.restore();
  // a spark every 350 ms, from the back of the car to one of the spiders
  const t = now - fx.start, k = Math.floor(t / 350), p = (t % 350) / 250, target = spiders[k % spiders.length];
  if (p < 1 && t < fx.dur * 0.85) {
    const sx = carX + 16 - dir * 20, sy = carY + 12;
    const x = sx + (target.x + 16 - sx) * p, y = sy + (target.y + 14 - sy) * p;
    ctx.fillStyle = k % 2 ? '#ff5040' : '#60ff70';
    ctx.globalAlpha = 0.4;
    ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.globalAlpha = 1;
    ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
}
// What they shout, as the car goes by.
const FLYBY_LINES = [['Ron', 'AAAAAAH! SPIDERS!!'], ['Harry', 'Faster! They are right behind us!'], ['Ron', 'Take THAT, you hairy horrors!'], ['Harry', 'Hold on tight!!']];

function outlinedText(text, x, y, color, font) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// Something drawn over a creature, so you can't see it (a roof, the floor of a storey above, up to the highest floor in
// view): a floor k up is drawn k tiles up-left, so what lies over it is at (x + k, y + k), or right over it
const coveredFrom = (o, maxZ) => {
  for (let k = 1; o.z + k <= maxZ; k++) for (const j of [k, k - 1]) { const t = map.get(o.x + j, o.y + j, o.z + k); if (t && t.ground) return true; }
  return false;
};

// Name, health bar and frames: red around your target, green around whoever you
// follow, white around the one hovered in the battle list, and a widening orange
// flash around whoever just hit you.
function drawCreatureInfo(c, screen, struck) {
  const v = visual(c);
  const [sx0, sy0] = screen(v.x, v.y), sx = sx0 - (LIFT + HEAD_LEAN * Render.CREATURE_LEAN) * SCALE, sy = sy0 - LIFT * SCALE;
  const companion = c.pet === true; // (a companion's body; a player's own pet field is the companion's record, not this)
  // (monsters and companions: one height for all; a monster drawn from a sheet, like a person, above its head)
  const fixed = companion || (c.type !== 'player' && c.type !== 'npc' && !Sprites.headroom(c));
  const ty = fixed ? sy0 + (MONSTER_BAR_Y - Sprites.bigLift(creatureKey(c))) * SCALE : sy - (Sprites.headroom(c) + Sprites.bigLift(creatureKey(c))) * SCALE; // (players' and NPCs' above the head of a tall figure, a big boss's too)
  const size = TILE * SCALE, fx = sx + (HEAD_LEAN * Render.CREATURE_LEAN / 2) * SCALE; // (the frame half way between feet and head)
  const frame = (color, inset, alpha = 1) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(fx + inset, sy + inset, size - 2 * inset, size - 2 * inset);
    ctx.globalAlpha = 1;
  };
  if (player.follow === c.id && c !== player.target) frame('#30e040', 1);
  if (companion) { // a companion: its name and level, warm, and a thin health bar
    const f = Math.max(0, Math.min(1, (c.hp || 0) / (c.maxHp || 1)));
    // (as high as a monster's: his name and numbers don't sit on yours or theirs)
    ctx.fillStyle = '#000'; ctx.fillRect(sx + 9, ty - 6, size - 18, 5);
    ctx.fillStyle = f > 0.6 ? '#30c030' : f > 0.3 ? '#e0c020' : '#e03030'; ctx.fillRect(sx + 10, ty - 5, Math.ceil((size - 20) * f), 3);
    outlinedText(`${c.name} (${c.level})`, sx + size / 2, ty - 10, '#ffd98a', 'bold 11px sans-serif');
    return;
  }
  if (c.type === 'npc') {
    outlinedText(c.name, sx + size / 2, ty - 4, '#8fd0ff', 'bold 12px sans-serif');
    // Above anyone who has something for you: ! a new quest (grey until you're strong enough), ? news to hand in.
    const news = questNews(c.npcId, true), mark = news && { offer: ['!', '#ffd84a'], report: ['?', '#ffd84a'], later: ['!', '#a0a0a0'] }[news.mark];
    if (mark) { // right of the name, clear of the guide's arrow above
      ctx.font = 'bold 12px sans-serif';
      outlinedText(mark[0], sx + size / 2 + ctx.measureText(c.name).width / 2 + 9, ty - 1 - Math.round(Math.sin(now / 300) * 2), mark[1], 'bold 20px Georgia, serif');
    }
    return;
  }
  if (c === player.target) frame('#e64a4a', 1); // (the phone's HUD shows the same target: its --hud-target)
  if (c.id === battleHover) frame('#ffffff', c === player.target ? 5 : 1);
  if (struck) frame('#ffa030', -2 - (1 - struck) * 8, struck);
  const frac = Math.max(0, Math.min(1, c.hp / c.maxHp));
  const color = frac > 0.6 ? '#30c030' : frac > 0.3 ? '#e0c020' : '#e03030';
  ctx.fillStyle = '#000';
  ctx.fillRect(sx + 5, ty - 7, size - 10, 7);
  ctx.fillStyle = color;
  ctx.fillRect(sx + 6, ty - 6, Math.ceil((size - 12) * frac), 5);
  const name = c.type === 'player' ? c.name : capitalize(c.name);
  outlinedText(name, sx + size / 2, ty - 11, color, 'bold 12px sans-serif');
  if (c.asleep) { // a monster asleep (goblins at night): a drowsy z drifting up over its head
    const k = (now / 1400) % 1;
    ctx.globalAlpha = 1 - k;
    outlinedText('z', sx + size / 2 + 12 + k * 8, ty - 22 - k * 12, '#cfe0ff', `bold ${10 + Math.round(k * 5)}px sans-serif`);
    ctx.globalAlpha = 1;
  }
  if (c.dazed) { // dazed by Clang's bell: little gold stars circling over its head
    for (let i = 0; i < 3; i++) {
      const a = now / 260 + (i * 2 * Math.PI) / 3;
      outlinedText('\u2605', sx + size / 2 + Math.cos(a) * 11, ty - 20 + Math.sin(a) * 3, '#ffd860', 'bold 10px sans-serif');
    }
  }
  if (c.type === 'player') {
    ctx.font = 'bold 12px sans-serif';
    drawSocialIcons(c, sx + size / 2 + ctx.measureText(name).width / 2 + 4, ty - 15);
  }
  const skull = c.type === 'player' && skullOf(c, player);
  if (skull) { // a white, yellow or red skull before the name
    ctx.font = 'bold 12px sans-serif';
    const x = sx + size / 2 - ctx.measureText(name).width / 2 - 10, y = ty - 15;
    ctx.fillStyle = SKULL_COLORS[skull];
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 3.5, y - 2, 2.5, 2.5);
    ctx.fillRect(x + 1, y - 2, 2.5, 2.5);
    ctx.fillRect(x - 1, y + 2.5, 2, 1.5);
  }
}

// After the name: a party shield (gold: the leader, blue: a member, white: invited by you,
// blinking gold: they invited you) with a tick while the experience is shared (red while
// sharing fails), and a green emblem on members of your guild.
const PARTY_COLORS = { leader: '#f0c040', member: '#4a8cff', invited: '#f4f4f4', inviter: '#f0c040' };
function drawSocialIcons(c, x, y) {
  const [rel, share] = (markOf(c) || '').split(':');
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  if (PARTY_COLORS[rel] && !(rel === 'inviter' && Math.floor(now / 400) % 2)) {
    ctx.fillStyle = PARTY_COLORS[rel];
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x + 10, y - 6);
    ctx.lineTo(x + 10, y);
    ctx.quadraticCurveTo(x + 10, y + 5, x + 5, y + 7);
    ctx.quadraticCurveTo(x, y + 5, x, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (share && !(share === 'idle' && Math.floor(now / 500) % 2)) {
      ctx.strokeStyle = share === 'on' ? '#fff' : '#e02020';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 2.5, y - 1);
      ctx.lineTo(x + 4.5, y + 2);
      ctx.lineTo(x + 8, y - 3.5);
      ctx.stroke();
    }
    x += 14;
  }
  const g = guildOfCreature(c), mine = myGuildView();
  if (g && mine && mine.name === g.name) {
    ctx.fillStyle = '#30b040';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + 5, y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d8ffd0';
    ctx.fillRect(x + 4, y - 3.5, 2, 7);
    ctx.fillRect(x + 1.5, y - 1, 7, 2);
  }
}

// The guide's arrow (through the basics: guideArrowOn): bobbing over what it points at, or at the edge of the screen
// pointing its way when that is out of sight (or on another floor).
function drawGuideArrow(screen) {
  const step = player.tutorial && !player.dead && guideArrowOn() && GUIDE[player.tutorial - 1], t = step && guideTarget(step); // (only through the basics)
  if (!t) return;
  const v = visual(t), [sx, sy] = screen(v.x + 0.5, v.y), bob = Math.sin(now / 180) * 5, m = 40;
  ctx.save();
  if (t.z === player.z && sx > m && sy > m + 30 && sx < viewPxW() - m && sy < viewPxH() - m) {
    // (its ring on the ground: drawGuideRing, under the figures)
    ctx.translate(sx - (LIFT + (t.type ? HEAD_LEAN * Render.CREATURE_LEAN : 0)) * SCALE, sy - 38 - (t.type ? Sprites.headroom(t) * SCALE : 0) + bob); // above the name (and a creature's head)
    ctx.rotate(Math.PI / 2);
  } else {
    const cx = viewPxW() / 2, cy = viewPxH() / 2, a = Math.atan2(sy - cy, sx - cx);
    const reach = Math.min((cx - m) / Math.max(1e-6, Math.abs(Math.cos(a))), (cy - m) / Math.max(1e-6, Math.abs(Math.sin(a)))) + bob;
    let ax = cx + Math.cos(a) * reach, ay = cy + Math.sin(a) * reach;
    // (never under the guide's own box: slid down to just below it, still pointing the same way)
    const box = document.getElementById('guide');
    if (box && !box.hidden && box.offsetWidth) {
      const cr = canvas.getBoundingClientRect(), br = box.getBoundingClientRect(), k = viewPxW() / (cr.width || 1);
      const l = (br.left - cr.left) * k - 18, r = (br.right - cr.left) * k + 18, t = (br.top - cr.top) * k - 18, b = (br.bottom - cr.top) * k + 18;
      if (ax > l && ax < r && ay > t && ay < b) {
        if (b + 20 < viewPxH() - m) ay = b; else ax = ax < (l + r) / 2 ? Math.max(m, l) : Math.min(viewPxW() - m, r);
      }
    }
    ctx.translate(ax, ay);
    ctx.rotate(a);
  }
  ctx.beginPath();
  for (const [x, y] of [[14, 0], [-2, -13], [-2, -5], [-16, -5], [-16, 5], [-2, 5], [-2, 13]]) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#000';
  ctx.stroke();
  ctx.fillStyle = '#ffd84a';
  ctx.fill();
  ctx.restore();
}

function wrapText(text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && line.length + word.length >= width) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

// (what the one you're talking to says is in the talk card on a phone: not over their head as well)
const talkCardShows = fx => touchScreen && fx.name && typeof talkSpeaker !== 'undefined' && fx.name === talkSpeaker && !document.getElementById('talk').hidden;

// Damage numbers rise and fade; speech stays above the speaker's head (their latest line only).
function drawTexts(screen, z) {
  const latest = new Map();
  for (const fx of effects) if (fx.kind === 'speech' && forViewer(fx, player)) latest.set(fx.cid, fx);
  const half = (TILE * SCALE) / 2;
  for (const fx of effects) {
    if (fx.z !== z) continue;
    const age = (now - fx.start) / fx.dur;
    if (fx.kind === 'text') { // numbers pop out, arc up and drift aside; the bigger the hit, the bigger the number
      const [sx, sy] = screen(fx.x, fx.y);
      const n = Math.abs(parseInt(fx.text, 10)) || 0, size = (n >= 100 ? 22 : n >= 40 ? 18 : 15) * (fx.crit ? 1.6 : 1), pop = age < 0.12 ? 1 + (1 - age / 0.12) * (fx.crit ? 1 : 0.6) : 1;
      const drift = fx.crit ? 0 : ((Math.floor(fx.start) % 7) - 3) * 6 * age; // (a critical hit rises straight up)
      ctx.globalAlpha = age > 0.7 ? Math.max(0, (1 - age) / 0.3) : 1;
      const ty = sy + half - Math.sin(Math.min(1, age * 1.4) * Math.PI / 2) * 48;
      if (fx.crit) outlinedText('CRITICAL!', sx + half, ty - size * pop * 0.95, '#ffe066', `bold italic ${Math.round(13 * pop)}px sans-serif`);
      outlinedText(fx.text, sx + half + drift, ty, fx.color, `bold ${Math.round(size * pop)}px sans-serif`);
      ctx.globalAlpha = 1;
    } else if (fx.kind === 'flyby' && age < 1) {
      const [who, line] = FLYBY_LINES[Math.min(FLYBY_LINES.length - 1, Math.floor(age * FLYBY_LINES.length))];
      const [sx, sy] = screen(flybyX(fx, 0), fx.y);
      outlinedText(`${who}: ${line}`, Math.max(140, Math.min(viewPxW() - 140, sx + half)), sy - 40, '#ffd84a', 'bold 14px sans-serif');
    } else if (fx.kind === 'speech' && latest.get(fx.cid) === fx && age < 1 && !talkCardShows(fx)) {
      const c = creatureById(fx.cid), v = c ? visual(c) : fx;
      const [sx, sy] = screen(v.x, v.y);
      const lines = wrapText(fx.text, 30);
      if (fx.name) lines.unshift(`${fx.name} says:`);
      const x = Math.max(110, Math.min(viewPxW() - 110, sx + half - HEAD_LEAN * Render.CREATURE_LEAN * SCALE)), color = fx.name ? '#ffd84a' : '#ff9a30';
      // straight above the speaker, over their name and health bar (which sit LIFT higher than their tile)
      const top = sy - LIFT * SCALE - 30;
      lines.forEach((line, i) => outlinedText(line, x, top - (lines.length - 1 - i) * 15, color, 'bold 13px sans-serif'));
    }
  }
}

// ---- main loop ----------------------------------------------------------------------------
let lastBars = 0, lastSave = 0, lastError = '';
// Map canvases are independent of the world canvas; 10 refreshes/sec is sufficient.
let lastMapDraw = -Infinity;
const warmed = new Set(); // creatures whose pictures are made (or asked for) between frames
let waterWarmed = false; // (the water's ripples, made between frames once the game runs)
const MAP_DRAW_INTERVAL = 100;
// The game runs at the screen's own rate, 60 frames a second (a phone too: the ground is kept in chunks now, see
// Render.ground). FRAME_INTERVAL is the shortest time between two frames: a 120 Hz screen still draws 60.
// A slower phone can choose 30 (Menu, Game: Frame rate): cooler and kinder to the battery. Remembered per browser.
let FRAME_INTERVAL = 1000 / ((() => { try { return +localStorage.getItem('tilequest.fps') === 30 ? 30 : 60; } catch (e) { return 60; } })());
function setFrameRate(fps) {
  FRAME_INTERVAL = 1000 / fps;
  try { localStorage.setItem('tilequest.fps', fps); } catch (e) { /* not remembered */ }
}
let lastFrameAt = -Infinity;

// ---- the speed meter (Menu, Game; Speed on a computer): frames a second, the work in a frame, and the stalls --------
// For finding out where the game isn't smooth on a real phone: it shows, a few times a second, how many frames the last
// second had, how long the work in a frame took (the middle one), and the stalls of the last 10 seconds (frames that
// came 50 ms or more after the one before), with the worst. Remembered per browser.
const speedMeter = { on: (() => { try { return localStorage.getItem('tilequest.meter') === '1'; } catch (e) { return false; } })(), frames: [], shownAt: 0 };
function setSpeedMeter(on) {
  speedMeter.on = !!on;
  speedMeter.frames.length = 0;
  try { localStorage.setItem('tilequest.meter', on ? '1' : '0'); } catch (e) { /* not remembered */ }
  $('speedMeter').hidden = !on;
}
if (speedMeter.on) $('speedMeter').hidden = false;
// Tap the meter for a test: the game leaves out one part at a time for a few seconds (the floors above you, the sky's
// clouds and shading, the water's ripples, the trees swaying, the weather and footprints, the names over heads) and shows the frames a
// second each time, so a screenshot of it says what costs a phone the most. Stand still while it runs (about 20 s).
const PERF_PARTS = [['all', null], ['no floors above', 'floors'], ['no sky', 'sky'], ['no ripples', 'water'], ['no swaying trees', 'wind'], ['no weather', 'fx'], ['no names', 'names']];
let perfTest = null;
function startPerfTest() {
  if (perfTest) return;
  perfTest = { i: 0, from: performance.now(), frames: 0, results: [] };
}
function perfTestFrame(t) {
  const p = perfTest, settle = 600, span = 2400;
  const part = PERF_PARTS[p.i];
  Render.off.clear(); if (part[1]) Render.off.add(part[1]);
  if (t - p.from > settle) p.frames++;
  if (t - p.from < settle + span) return `testing: ${part[0]} (${p.i + 1}/${PERF_PARTS.length})`;
  p.results.push(`${part[0]}: ${Math.round(p.frames * 1000 / span)} fps`);
  Object.assign(p, { i: p.i + 1, from: t, frames: 0 });
  if (p.i >= PERF_PARTS.length) { Render.off.clear(); speedMeter.result = `at ${player.x},${player.y},${player.z}\n${p.results.join('\n')}`; perfTest = null; }
  return 'testing...';
}
$('speedMeter').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); speedMeter.result = null; startPerfTest(); });
for (const type of ['touchstart', 'mousedown', 'click']) $('speedMeter').addEventListener(type, e => e.stopPropagation());
// Each frame also notes what it had to do (ground drawn live, chunks made, a floor change) and where you were, so the
// worst stall of the last 10 seconds says where and why: what to send us from a slow phone.
function meterFrame(t, dt, work, did) {
  const f = speedMeter.frames;
  if (dt < 1000) f.push([t, dt, work, did]); // (not the first frame after a pause)
  while (f.length && f[0][0] < t - 10000) f.shift();
  if (perfTest) { // (counted every frame, shown a few times a second)
    const s = perfTestFrame(t);
    if (t - speedMeter.shownAt >= 250) { speedMeter.shownAt = t; $('speedMeter').textContent = s; }
    return;
  }
  if (t - speedMeter.shownAt < 250) return;
  speedMeter.shownAt = t;
  const second = f.filter(([ft]) => ft > t - 1000), works = second.map(x => x[2]).sort((a, b) => a - b);
  const stalls = f.filter(x => x[1] >= 50), wi = f.reduce((a, b, i) => (b[1] > (f[a] || [0, 0])[1] ? i : a), -1), worst = f[wi] || [0, 0];
  // (a long gap comes after the frame that took long: what that one did)
  if (speedMeter.result) { $('speedMeter').textContent = `test (tap to run again)\n${speedMeter.result}`; return; }
  const el = $('speedMeter'), w = wi > 0 && worst[1] >= 50 ? f[wi - 1][3] : null;
  const why = w ? [w.live && `${w.live} ground live`, w.made && `${w.made} chunks made`, w.floor && 'floor change', w.work > 30 && `${Math.round(w.work)} ms work`].filter(Boolean).join(', ') : '';
  el.textContent = `${second.length} fps · ${(works[works.length >> 1] || 0).toFixed(1)} ms work\n${stalls.length} stalls in 10 s · worst ${Math.round(worst[1])} ms`
    + (w ? `\nat ${w.x},${w.y},${w.z}${why ? `: ${why}` : ''}` : '')
    + `\nscreen ${canvas.width}x${canvas.height} · sharp ${Sprites.CREATURE_RES} · ${Render.pictures}/${Render.CHUNKS_KEPT} kept`;
  el.classList.toggle('bad', stalls.length > 0 || second.length < 50);
}

// A bug must never stop the game loop: report it in the log and keep going.
// Each different error is told once (the first is often the cause of the rest, so it stays in the log), with where it
// happened (file and line), so a screenshot of a phone that has no console still says enough to find it.
const errorsTold = new Set();
function reportError(err, where = '') {
  console.error(err);
  const message = String((err && err.message) || err);
  if (message === lastError || errorsTold.has(message) || errorsTold.size >= 6) return;
  lastError = message;
  errorsTold.add(message);
  const at = where || ((err && err.stack) || '').split('\n').map(l => (l.match(/([\w.-]+\.js)(?:\?[^:]*)?:(\d+)/) || [])).find(m => m[1]) || null;
  const spot = typeof at === 'string' ? at : at ? `${at[1]}:${at[2]}` : '';
  log(`Internal error: ${message}${spot ? ` (${spot})` : ''} (details in the browser console)`, 'damage');
}
window.addEventListener('error', e => reportError(e.error || e.message, e.filename ? `${e.filename.split('/').pop().split('?')[0]}:${e.lineno}` : ''));
// (and what went wrong while the scripts were loading, before this could listen: index.html kept it)
for (const m of window.bootErrors || []) setTimeout(() => log(`Internal error while loading: ${m}`, 'damage'), 0);
window.bootErrors = null;

// Calm: you stand still, with no target, no monster near, and haven't touched the screen or a key for a moment. Then
// the game draws 30 frames a second instead of 60 (only the small movements round you, water, leaves, torches, are a
// little less smooth): half the work, a cooler phone and a longer battery. Anything happening brings 60 back at once,
// a shot or a swing on its way too (a power shot is drawn for 1.5 s with no key touched: it flew at 30, and stuttered).
let lastInputAt = 0, calmCheckedAt = 0, calmNow = false;
const FAST_EFFECTS = new Set(['shot', 'volley', 'arc', 'loose', 'chain']); // (quick movements that need every frame)
for (const kind of ['pointerdown', 'pointermove', 'keydown', 'wheel']) window.addEventListener(kind, () => { lastInputAt = performance.now(); calmNow = false; }, { passive: true, capture: true });
function calm(t) {
  if (t - calmCheckedAt < 250 && t >= calmCheckedAt) return calmNow;
  calmCheckedAt = t;
  const p = player;
  calmNow = !!p && Preload.ready && !p.dead && t - lastInputAt > 1500 && !(p.path && p.path.length) && !p.target && !p.follow
    && !(p.walk && now < p.walk.start + p.walk.dur + 300) && !document.body.classList.contains('fighting')
    && !monsters.some(m => !m.dead && m.z === p.z && Math.abs(m.x - p.x) <= 8 && Math.abs(m.y - p.y) <= 8)
    && !effects.some(e => FAST_EFFECTS.has(e.kind) && e.z === p.z && now < e.start + e.dur); // (a power shot flying, a swing: never at 30)
  return calmNow;
}

function frame(t) {
  requestAnimationFrame(frame); // first, so an exception below can't freeze the game
  if (t - lastFrameAt < (calm(t) ? Math.max(FRAME_INTERVAL, 1000 / 30) : FRAME_INTERVAL) - 2) return;
  const dt = t - lastFrameAt, started = performance.now(), live0 = Render.stats.live, made0 = Render.stats.finished, z0 = player && player.z;
  lastFrameAt = t;
  if (calmNow || (typeof Bench !== 'undefined' && Bench.running)) keepUp.from = 0; // (30 a second on purpose while calm: not a phone that can't keep up, so not measured; nor during the performance test, which keeps the sharpness it started with)
  else checkKeepingUp(t);
  try {
    if (online()) {
      now = Net.clock();
    } else {
      now = t + (typeof Bench !== 'undefined' ? Bench.shift : 0); // (the performance test sets the hour it measures at: bench.js)
      if (!paused) updateWorld();
    }
    handleEvents();
    preloadJump();
    Render.noLive = !Preload.ready;
    draw();
    preloadFrame();
    exploreAround();
    if (now - lastMapDraw >= MAP_DRAW_INTERVAL || now < lastMapDraw) {
      drawMinimap();
      lastMapDraw = now;
    }
    if (uiNeedsRender) renderUI();
    if (now - lastBars > 100 || lastBars > now) {
      updateBars();
      lastBars = now;
    }
    if (!online() && !paused && now - lastSave > 5000) {
      saveGame();
      lastSave = now;
    }
  } catch (err) {
    reportError(err);
  }
  if (typeof Bench !== 'undefined' && Bench.running) Bench.frame(t, dt, performance.now() - started);
  if (speedMeter.on) {
    const work = performance.now() - started;
    meterFrame(t, dt, work, { x: player.x, y: player.y, z: player.z, live: Render.stats.live - live0, made: Render.stats.finished - made0, floor: player.z !== z0, work });
  }
}

function startWorld() {
  spawnAll(map.spawns);
  window.onbeforeunload = saveGame;
  // Phones don't always fire beforeunload; pagehide also covers switching apps.
  window.addEventListener('pagehide', () => window.onbeforeunload && saveGame());
  requestAnimationFrame(frame);
}

// Draw the world behind the character creation dialog.
function startWorldPreview() {
  let lastPreviewAt = -Infinity;
  const preview = t => {
    if (!paused) return;
    requestAnimationFrame(preview);
    if (t - lastPreviewAt < FRAME_INTERVAL - 2) return;
    lastPreviewAt = t;
    now = t;
    draw();
  };
  requestAnimationFrame(preview);
}

// Playing alone: the gate first (game-ui.js Gate). An account here is this browser's: a name and a password (kept as a
// salted hash) holding up to MAX_CHARACTERS characters, each its own save (saveKey in game-core.js), until the game has
// a server of its own. After logging in, the character select: play one, or make a new one (its story begins). Logged
// in once, a page opens on the character select without the password (tilequest.session) until you log out there; a
// page reloaded while playing (sessionStorage tilequest.playing) goes straight back into the world. Browser tests
// without ?story or ?gate go straight on, as before.
const ACCOUNT_KEY = 'tilequest.account', SESSION_KEY = 'tilequest.session', PLAYING_KEY = 'tilequest.playing', MAX_CHARACTERS = 10;
const stored = (key, value) => { try { if (value === undefined) return JSON.parse(localStorage.getItem(key)); if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* no storage */ } return null; };
const playing = value => { try { if (value === undefined) return sessionStorage.getItem(PLAYING_KEY); if (value === null) sessionStorage.removeItem(PLAYING_KEY); else sessionStorage.setItem(PLAYING_KEY, value); } catch (e) { /* no storage */ } return null; };
async function passwordHash(password, salt) {
  const text = `sortia:${salt}:${password}`;
  if (window.crypto && crypto.subtle) {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
    return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 2166136261; // (no crypto.subtle: an old browser or a page not served safely; still not the password itself)
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return `f${(h >>> 0).toString(16)}`;
}
async function saveAccount(name, password, characters) {
  const salt = [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('');
  const account = { name, salt, hash: await passwordHash(password, salt), characters };
  stored(ACCOUNT_KEY, account);
  stored(SESSION_KEY, name);
  return account;
}
const sameName = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const characterSaveKey = name => `${SAVE_KEY}.c.${name.toLowerCase()}`;
// the one save of before accounts held characters: moved to its character's own place (once)
function moveOldSave() {
  const save = stored(SAVE_KEY);
  if (!save || typeof save.name !== 'string') return null;
  if (!stored(characterSaveKey(save.name))) stored(characterSaveKey(save.name), save);
  stored(SAVE_KEY, null);
  return save.name;
}
// The test account: Lickii, with a level 100 character of each path (makeTestHero: the best gear, Clang at its level),
// there in every browser (and on the server: server.js TEST_ACCOUNT). Its password is kept only as a hash. Its
// characters are made the first time it logs in here, and then play on and are saved like any others.
const TEST_ACCOUNT = { name: 'Lickii', salt: '261063dc8c937e7b', hash: 'e14d0cd499be2aa9f99871fa03b4d4c49ab4ffae86d6de172b53fee14cdd2700', builtin: true,
  heroes: [['Lickii Bastion', 'knight'], ['Lickii Hawk', 'paladin'], ['Lickii Ember', 'sorcerer']] };
const TEST_ACCOUNT_KEY = 'tilequest.account.lickii', TEST_SESSION = '#lickii';
function testAccount() {
  let account = stored(TEST_ACCOUNT_KEY);
  if (account && !stored(TEST_ACCOUNT_KEY + '.tidied')) { // (once, as the owner asked: only its level 100 characters stay)
    const heroes = TEST_ACCOUNT.heroes.map(([n]) => n.toLowerCase());
    for (const c of account.characters) if (!heroes.includes(c.toLowerCase())) stored(characterSaveKey(c), null);
    account.characters = account.characters.filter(c => heroes.includes(c.toLowerCase()));
    stored(TEST_ACCOUNT_KEY, account);
    stored(TEST_ACCOUNT_KEY + '.tidied', 1);
  }
  if (account) return account;
  account = { name: TEST_ACCOUNT.name, salt: TEST_ACCOUNT.salt, hash: TEST_ACCOUNT.hash, builtin: true, characters: [] };
  const keep = player;
  for (const [name, vocation] of TEST_ACCOUNT.heroes) {
    if (!stored(characterSaveKey(name))) {
      player = newPlayer(name);
      teleport(map.start);
      makeTestHero(vocation);
      const slot = saveSlot; saveSlot = name.toLowerCase(); saveGame(); saveSlot = slot;
    }
    account.characters.push(name);
  }
  player = keep;
  stored(TEST_ACCOUNT_KEY, account);
  return account;
}
const accountKeyOf = account => (account.builtin ? TEST_ACCOUNT_KEY : ACCOUNT_KEY);

// this browser's account, as it is now (an account of before, with one character and no list, given its list)
function offlineAccount() {
  const account = stored(ACCOUNT_KEY);
  if (!account || Array.isArray(account.characters)) return account;
  const moved = moveOldSave();
  account.characters = moved ? [moved] : [];
  stored(ACCOUNT_KEY, account);
  return account;
}
// what the character select shows of each
const characterSummary = name => { const save = stored(characterSaveKey(name)) || {}; return { name, level: save.level || 1, vocation: save.vocation || 'none' }; };

function startOffline() {
  now = performance.now();
  player = newPlayer('Adventurer');
  players.push(player);
  npcs = map.npcs.map(spawnNpc); // so the start position search avoids them
  if (typeof Bench !== 'undefined' && Bench.wanted()) return Bench.start(); // (the performance test: a character of its own, see bench.js)
  if (navigator.webdriver && !/[?&](story|gate)\b/.test(location.search)) return enterOffline();
  Gate.load().then(() => {
    const session = stored(SESSION_KEY), account = session === TEST_SESSION ? testAccount() : offlineAccount();
    if (account && (session === TEST_SESSION || (!account.builtin && sameName(session, account.name)))) {
      const again = playing();
      if (again && account.characters.some(c => sameName(c, again)) && !busyElsewhere()) { Gate.close(); return playOffline(again); }
      return chooseOffline(account);
    }
    askOffline(account && account.builtin ? offlineAccount() : account);
  });
}
// the login form: an account made, or logged into; then the character select
function askOffline(account, message) {
  const old = account ? null : (stored(SAVE_KEY) || {}).name; // (a character from before accounts)
  let replacing = false; // (making an account over the one already here: said once, then done)
  Gate.ask({
    tab: account || old ? 'login' : 'create',
    name: (account && account.name) || old || '',
    message,
    note: 'Your account and characters are kept in this browser.',
    onTab: () => { replacing = false; },
    onSubmit: async ({ tab, name, password }) => {
      if (sameName(name, TEST_ACCOUNT.name)) { // (the test account: its own password, whatever this browser holds)
        if (tab === 'create') return Gate.refuse('That name is taken: choose another, or log in.');
        if (await passwordHash(password, TEST_ACCOUNT.salt) === TEST_ACCOUNT.hash) { stored(SESSION_KEY, TEST_SESSION); return chooseOffline(testAccount()); }
        if (!account || !sameName(account.name, TEST_ACCOUNT.name)) return Gate.refuse('Wrong password.');
      }
      if (tab === 'create') {
        const held = account ? account.name : old;
        if (held && !replacing) {
          replacing = true;
          const many = account && account.characters.length > 1 ? `${held}'s ${account.characters.length} characters` : held;
          return Gate.hint(`This browser already holds ${account ? `the account ${held}` : held}. A new account replaces ${many}: press Create account again to go on.`, true);
        }
        if (account) for (const c of account.characters) stored(characterSaveKey(c), null);
        stored(SAVE_KEY, null);
        return chooseOffline(await saveAccount(name, password, []));
      }
      if (!account) { // a character from before accounts: its name, and the password chosen now is its from here on
        if (!sameName(name, old)) return Gate.refuse(old ? 'No account with that name in this browser.' : 'No account in this browser yet: create one.');
        const moved = moveOldSave();
        return chooseOffline(await saveAccount(moved, password, [moved]));
      }
      if (!sameName(name, account.name)) return Gate.refuse('No account with that name in this browser.');
      if (await passwordHash(password, account.salt) !== account.hash) return Gate.refuse('Wrong password.');
      stored(SESSION_KEY, account.name);
      chooseOffline(account);
    },
  });
}
// the character select: one played, or a new one made (named here: its story begins)
function chooseOffline(account, message) {
  Gate.chooseCharacter({
    account: account.name, characters: account.characters.map(characterSummary), max: MAX_CHARACTERS, message,
    onPlay: name => { const busy = busyElsewhere(); if (busy) return Gate.refuseCharacter(busy); Gate.close(); playOffline(name); },
    onCreate: name => {
      if (stored(characterSaveKey(name))) return Gate.refuseCharacter('A character of that name is kept in this browser already.');
      const busy = busyElsewhere();
      if (busy) return Gate.refuseCharacter(busy);
      account.characters.push(name);
      stored(accountKeyOf(account), account);
      Gate.close();
      playOffline(name);
    },
    onLogout: () => { stored(SESSION_KEY, null); askOffline(account.builtin ? offlineAccount() : account); },
    onDelete: name => {
      stored(characterSaveKey(name), null);
      account.characters = account.characters.filter(c => !sameName(c, name));
      stored(accountKeyOf(account), account);
      chooseOffline(account, `${name} was deleted.`);
    },
  });
}
// one character of the account in the world at a time, in this browser too: a tab playing marks it (IN_WORLD_KEY, its
// tab and when, renewed every few seconds while it plays); another tab may not play then (busyElsewhere says who)
const IN_WORLD_KEY = 'tilequest.inWorld';
const tabId = (() => { try { let id = sessionStorage.getItem('tilequest.tab'); if (!id) { id = Math.random().toString(36).slice(2); sessionStorage.setItem('tilequest.tab', id); } return id; } catch (e) { return 'tab'; } })();
function busyElsewhere() {
  const mark = stored(IN_WORLD_KEY);
  return mark && mark.tab !== tabId && Date.now() - mark.at < 12000 ? `${mark.name} is in the world in another tab: one character at a time. Close that tab first.` : null;
}
let inWorldTimer = 0;
function markInWorld(name) {
  const mark = () => stored(IN_WORLD_KEY, { tab: tabId, name, at: Date.now() });
  mark();
  clearInterval(inWorldTimer);
  inWorldTimer = setInterval(mark, 4000);
  addEventListener('pagehide', () => { const m = stored(IN_WORLD_KEY); if (m && m.tab === tabId) stored(IN_WORLD_KEY, null); });
}
function playOffline(name) {
  markInWorld(name);
  saveSlot = name.toLowerCase();
  playing(name);
  $('newChar').textContent = 'Log out';
  enterOffline(name);
}

// into the world: the character in this browser, or a new one (named already with its account, or named in the opening)
function enterOffline(name) {
  if (loadGame()) {
    log(`Welcome back, ${player.name}!`);
    Sound.title.stop();
    startWorld();
    return;
  }
  if (name) player.name = name; // (named already: so even a save made during its story is under its name)
  teleport(map.start);
  paused = true;
  startWorldPreview();
  showCharacterCreation(() => {
    paused = false;
    saveGame();
    log(`Welcome to ${typeof KESTREL_PREVIEW !== 'undefined' && KESTREL_PREVIEW ? 'Kestrel Isle' : 'Oakvale Isle'}, ${player.name}!`, 'welcome'); // (in the log and the chat line; it doesn't pop up over the guide)
    startWorld();
  }, name);
}

// ---- getting ready to play ------------------------------------------------------------------------------------
// The first time something comes into view its pictures are made, and that's what makes the game stop for a moment.
// So from the moment the page opens (while you log in or make your character) everything that can be is made ahead:
// the custom pictures loaded, every map thing, item and creature of the isle drawn, the mountain rim's shapes worked
// out. Once you're in the world, the ground round you is made too (behind a loading screen, a few frames at most)
// before you play, so the first steps are smooth. The whole map isn't: its pictures wouldn't fit in a phone's memory.
const Preload = { jobs: [], total: 0, ready: false, settled: 0, since: 0 };
function preloadJobs() {
  const jobs = [() => Sprites.picturesLoading() === 0]; // (false: not yet, try again in a moment)
  const safely = f => () => { try { f(); } catch (e) { /* drawn when it's needed instead */ } };
  for (const id of Object.keys(THINGS)) {
    const d = THINGS[id];
    if (d.ground || d.roof || d.wall === 'thin' || d.onWall || d.mosaic) continue; // (the ground's are in the chunks; walls by their shape)
    for (let x = 0; x < 3; x++) jobs.push(safely(() => Sprites.thing(id, x, 0, 0)));
  }
  for (const id of Object.keys(ITEMS)) jobs.push(safely(() => Sprites.item(id)));
  const types = new Set((map.spawns || []).map(s => s.type));
  for (const n of map.npcs || []) types.add(NPCS[n.type] ? NPCS[n.type].creature || `npc:${n.type}` : null);
  for (const key of types) if (key) for (const d of [0, 1, 2, 3]) for (const f of [0, 1, 2]) jobs.push(safely(() => { warmed.add(key); Sprites.creature(key, d, f); }));
  jobs.push(...Sprites.warmRim().map(safely));
  return jobs;
}
function startPreload() {
  Preload.jobs = preloadJobs();
  Preload.total = Preload.jobs.length;
  const run = () => {
    const end = performance.now() + 10;
    while (Preload.jobs.length && performance.now() < end) {
      if (Preload.jobs[0]() === false) break; // (waiting for the pictures to load)
      Preload.jobs.shift();
    }
    showPreload();
    if (Preload.jobs.length) setTimeout(run, Preload.jobs.length && Preload.total - Preload.jobs.length === 0 ? 50 : 0);
  };
  setTimeout(run, 0);
}
// A jump to somewhere far (death, a boat, a teleport): the loading screen again while the ground there is made, so the
// first frame there doesn't draw it all at once.
const lastSpot = { x: 0, y: 0, z: 0, set: false };
function preloadJump() {
  const far = lastSpot.set && (Math.abs(player.x - lastSpot.x) + Math.abs(player.y - lastSpot.y) > 12 || Math.abs(player.z - lastSpot.z) > 1);
  Object.assign(lastSpot, { x: player.x, y: player.y, z: player.z, set: true });
  if (far && Preload.ready) Object.assign(Preload, { ready: false, settled: 0, since: 0 });
}
// Each frame until ready: the loading screen over the world, and the ground round you made in big steps behind it.
function preloadFrame() {
  if (Preload.ready) return;
  if (!Preload.since) Preload.since = performance.now();
  Render.CHUNK_MS = 40;
  Render.budget = performance.now() + 40;
  const ground = (!Render.ahead || Render.ahead()) && !Render.later.size;
  if (ground) while (Render.chores.length && performance.now() < Render.budget) Render.chores.shift()();
  const done = !Preload.jobs.length && ground && !Render.chores.length;
  Preload.settled = done ? Preload.settled + 1 : 0;
  if (Preload.settled >= 3 || performance.now() - Preload.since > 15000) { // (never kept waiting long)
    Preload.ready = true;
    Render.CHUNK_MS = 4;
  }
  showPreload();
}
function showPreload() {
  const el = $('loading');
  if (!el) return;
  const inWorld = !!Preload.since, show = inWorld && !Preload.ready;
  el.hidden = !show;
  if (!show) return;
  const pictures = Preload.total ? (Preload.total - Preload.jobs.length) / Preload.total : 1;
  const percent = Math.round(100 * (0.8 * pictures + (Preload.jobs.length ? 0 : 0.2 * Math.min(1, Preload.settled / 3))));
  $('loadingBar').style.width = `${percent}%`;
  $('loadingPercent').textContent = `${percent}%`;
  $('loadingText').textContent = Preload.jobs.length ? 'Getting the world ready...' : 'Almost there...';
}

initUI();
startPreload();
if (typeof Net !== 'undefined' && Net.wanted()) Net.start(() => requestAnimationFrame(frame));
else startOffline();
