'use strict';
// Input, drawing and the main loop (offline, or online through net.js).

const canvas = $('view');
canvas.width = VIEW_W * TILE * SCALE;
canvas.height = VIEW_H * TILE * SCALE;
const ctx = canvas.getContext('2d');
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
  Render.quality.clear();
  for (const part of QUALITY[quality]) Render.quality.add(part);
  try { localStorage.setItem('tilequest.quality', quality); } catch (e) { /* not remembered */ }
  fitView();
}
for (const part of QUALITY[quality]) Render.quality.add(part);
// How close the camera is on a phone: 'near' (default) or 'far' (Menu, Game), remembered per browser.
const mapZoomNear = () => { try { return localStorage.getItem('tilequest.zoom') !== 'far'; } catch (e) { return true; } };
function setMapZoom(near) {
  try { localStorage.setItem('tilequest.zoom', near ? 'near' : 'far'); } catch (e) { /* not remembered */ }
  fitView();
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
    // Near (the default) is one step closer: 4 screen pixels per world pixel on most iPhones, still whole pixels.
    let p = Math.max(2, Math.round(dpr) + (mapZoomNear() ? 1 : 0)), cols, rows;
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
    canvas.style.width = `${(VIEW_W * TILE * p) / dpr}px`;
    canvas.style.height = `${(VIEW_H * TILE * p) / dpr}px`;
    return;
  }
  setViewSize(VIEW_W, VIEW_H, 1);
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
      for (const id of ['read', 'hotkeys', 'guild']) $(id).hidden = true;
      closeForge();
      Actions.stop();
    }
  } else if (k === 'enter') {
    $('chat').focus();
  } else if (/^[1-9]$/.test(k)) {
    const id = spellsFor(player.vocation)[+k - 1];
    if (id) Actions.castSpell(id);
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

$('chat').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const tab = $('log').dataset.filter, text = e.target.value; // the Party and Guild tabs talk on their channel
    if (tab === 'party' && !text.startsWith('/')) Actions.partySay(text);
    else if (tab === 'guild' && !text.startsWith('/')) Actions.guildSay(text);
    else Actions.say(text);
    e.target.value = '';
    e.target.blur();
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
    wy: ((e.clientY - r.top) / r.height) * h - Math.round(h / 2 - (pv.y * TILE + TILE / 2)),
  };
}
function tileUnderPointer(e) {
  const { wx, wy } = eventToWorld(e);
  return { x: Math.floor(wx / TILE), y: Math.floor(wy / TILE), z: player.z };
}

// The creature drawn under the pointer (they stand a little raised).
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
    if (player.follow === c.id) item('Stop following', () => Actions.stop());
    else item(`Follow ${name}`, () => Actions.follow(c.id));
    if (c.type === 'npc') item('Talk', () => Actions.interact('talk', t.x, t.y, t.z));
    else if (!companion) item(c.type === 'player' ? `Attack ${name}` : 'Attack', () => Actions.setTarget(c.id));
  }
  if (c.type === 'player') socialItems(c, item);
  item('Look', () => look(t.x, t.y, c));
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
  if (e.shiftKey) return look(t.x, t.y, creature);
  if (creature) return Actions.setTarget(creature.id);
  if (npc) return Actions.interact('talk', t.x, t.y, t.z);
  // Left click walks, unless there's something to open there; right click always uses.
  const tile = map.get(t.x, t.y, t.z);
  const usable = pileAt(t.x, t.y, t.z) || (tile && tile.items.some(id => {
    const d = THINGS[id];
    return d.chest || d.lever || d.depot || d.readable || d.bookshelf || d.useToClimb || d.trainer;
  }));
  if (e.button === 2 || usable) markWalk(t), Actions.interact('use', t.x, t.y, t.z);
  else if (e.button === 0) markWalk(t), Actions.walkTo(t.x, t.y);
}

// Where you tapped (or clicked) to go: a gold mark on that tile until you're there, or stop walking, or go elsewhere.
let walkMark = null;
const markWalk = t => { walkMark = { x: t.x, y: t.y, z: t.z, at: now, moved: now }; };
// Drawn on the floor itself (Render's onFloor, in world pixels), so walls, things, roofs and creatures stand over it.
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
  let pressed = false, key = null;
  const timer = setTimeout(() => {
    pressed = true;
    if (navigator.vibrate) navigator.vibrate(15);
    const someone = creatureUnder(wx, wy) || npcs.find(n => n.x === t.x && n.y === t.y && n.z === t.z);
    if (someone && someone !== player) openCreatureMenu(down, someone, t); // hold someone: what to do with them
    else Actions.interact('use', t.x, t.y, t.z);
  }, LONG_PRESS);
  const move = e => {
    if (e.pointerId !== down.pointerId) return;
    const dx = e.clientX - down.clientX, dy = e.clientY - down.clientY;
    if (!key && Math.hypot(dx, dy) < SWIPE) return;
    clearTimeout(timer);
    const k = swipeKey(dx, dy);
    if (k === key) return;
    if (key) Actions.keyUp(key);
    key = k;
    Actions.keyDown(k, false);
  };
  const up = e => {
    if (e.pointerId !== down.pointerId) return;
    clearTimeout(timer);
    for (const [ev, fn] of [['pointermove', move], ['pointerup', up], ['pointercancel', up]]) canvas.removeEventListener(ev, fn);
    if (key) Actions.keyUp(key);
    else if (!pressed && e.type === 'pointerup') clickTile(e, t, wx, wy);
  };
  for (const [ev, fn] of [['pointermove', move], ['pointerup', up], ['pointercancel', up]]) canvas.addEventListener(ev, fn);
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
      return mode === 'use' ? Actions.interact('use', t.x, t.y, t.z) : look(t.x, t.y, creatureUnder(wx, wy));
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
  return c.type;
}

function draw() {
  const pv = visual(player);
  const z = player.z;
  const view = {
    cx: pv.x * TILE + TILE / 2, cy: pv.y * TILE + TILE / 2, z,
    // Above ground you see down to the surface; underground only two floors deep.
    minZ: z >= map.surfaceZ ? map.surfaceZ : Math.max(0, z - 2),
    maxZ: z < map.surfaceZ || Render.off.has('floors') ? z : map.visibleMaxZ(player.x, player.y, z), // underground there's rock above you
    w: VIEW_W * TILE, h: VIEW_H * TILE, time: now, objects: [],
    depth: 0.15, // what lies below you is darker
  };
  Fx.frame(view);
  const [shakeX, shakeY] = Fx.offset(); // a big hit shakes the screen
  view.cx += shakeX;
  view.cy += shakeY;
  Object.assign(view, { onFloor: drawWalkMark, afterGround: Fx.ground, wind: Fx.wind(), roofSnow: Fx.roofSnow(), seeThrough: { x: player.x, y: player.y, z }, beyond: f => (f === map.surfaceZ ? 'water' : null) });
  for (const p of piles) {
    const img = p.corpse ? Sprites.corpse(p.corpse) : p.items.length ? Sprites.item(p.items[p.items.length - 1].id) : null;
    if (img) view.objects.push({ x: p.x, y: p.y, z: p.z, img });
  }
  for (const f of fields) view.objects.push({ x: f.x, y: f.y, z: f.z, img: Sprites.field(f.kind, now) });
  const riding = p => p.ride && p.ride.boarded; // in a cab, out of sight
  const creatures = [...npcs, ...monsters.filter(m => !m.dead), ...players.filter(p => !p.dead && !riding(p))];
  // Only those on screen (or just off it) are drawn: the other thousand can wait.
  const shown = creatures.filter(c => Math.abs(c.x - player.x) <= VIEW_W / 2 + 3 && Math.abs(c.y - player.y) <= VIEW_H / 2 + 3);
  for (const c of shown) {
    const v = visual(c);
    const alpha = c.def && c.def.invisible ? (canSee(c) ? 0.6 : 0.15) : undefined;
    const img = Sprites.creature(creatureKey(c), c.dir, v.frame), hit = Fx.creature(c, img); // a hit flashes and knocks it back
    view.objects.push({ x: c.x, y: c.y, z: c.z, vx: v.x + hit.dx, vy: v.y + hit.dy, lift: LIFT, alpha, flash: hit.flash, img, slant: true });
  }
  Fx.settle(new Set(creatures.map(c => c.id)));

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
  if (!player.dead && !riding(player)) {
    // Walls can hide you; a faint silhouette on top keeps you visible behind them.
    ctx.globalAlpha = 0.35;
    const img = Sprites.creature(creatureKey(player), player.dir, pv.frame); // (a big picture has its tile in its bottom right)
    const px = Math.round(ox + pv.x * TILE - LIFT - (Sprites.w(img) - TILE)), py = Math.round(oy + pv.y * TILE - LIFT - (Sprites.h(img) - TILE));
    Render.slanted(ctx, img, px, py, () => ctx.drawImage(img, px, py, Sprites.w(img), Sprites.h(img)));
    ctx.globalAlpha = 1;
  }
  for (const p of players) if (riding(p) && p.z === z) {
    const v = visual(p);
    drawVehicle(p.ride.kind, ox + v.x * TILE, oy + v.y * TILE, true, p.dir === 3, p.ride.start);
  }
  drawEffects(ox, oy, z);
  if (!Render.skip('fx')) Fx.world(ctx, ox, oy, z);

  // Overlays are drawn in canvas pixels so text stays crisp.
  ctx.setTransform(ZOOM, 0, 0, ZOOM, 0, 0);
  const screen = (tx, ty) => [(ox + tx * TILE) * SCALE, (oy + ty * TILE) * SCALE];
  const darkness = z < map.surfaceZ ? 0.92 : (1 - daylight()) * 0.8;
  Fx.light(view, screen, pv, darkness, z < map.surfaceZ);
  if (!Render.skip('sky')) Fx.overlay(screen);
  // Who just hit you: 1 right after the hit, fading to 0.
  const struck = new Map();
  for (const fx of effects) if (fx.kind === 'attacker' && forViewer(fx, player) && now < fx.start + fx.dur) struck.set(fx.cid, 1 - (now - fx.start) / fx.dur);
  if (!Render.off.has('names')) {
    for (const c of shown) if (c.z === z && (!c.def || !c.def.invisible || canSee(c))) drawCreatureInfo(c, screen, struck.get(c.id));
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

const creatureById = id => players.find(p => p.id === id) || monsters.find(m => m.id === id) || npcs.find(n => n.id === id);

// Missiles, hit bursts and sparkles, in world pixels; sounds are played once.
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

// Name, health bar and frames: red around your target, green around whoever you
// follow, white around the one hovered in the battle list, and a widening orange
// flash around whoever just hit you.
function drawCreatureInfo(c, screen, struck) {
  const v = visual(c);
  const [sx0, sy0] = screen(v.x, v.y), sx = sx0 - (LIFT + HEAD_LEAN * Render.CREATURE_LEAN) * SCALE, sy = sy0 - LIFT * SCALE;
  const ty = sy - Sprites.headroom(c) * SCALE; // (names and bars above the head of a tall figure)
  const size = TILE * SCALE, fx = sx + (HEAD_LEAN * Render.CREATURE_LEAN / 2) * SCALE; // (the frame half way between feet and head)
  const frame = (color, inset, alpha = 1) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(fx + inset, sy + inset, size - 2 * inset, size - 2 * inset);
    ctx.globalAlpha = 1;
  };
  if (player.follow === c.id && c !== player.target) frame('#30e040', 1);
  if (c.type === 'npc') {
    outlinedText(c.name, sx + size / 2, ty - 4, '#8fd0ff', 'bold 12px sans-serif');
    // Above anyone who has something for you: ! a new quest (grey until you're strong enough), ? news to hand in.
    const news = questNews(c.npcId), mark = news && { offer: ['!', '#ffd84a'], report: ['?', '#ffd84a'], later: ['!', '#a0a0a0'] }[news.mark];
    if (mark) { // right of the name, clear of the guide's arrow above
      ctx.font = 'bold 12px sans-serif';
      outlinedText(mark[0], sx + size / 2 + ctx.measureText(c.name).width / 2 + 9, ty - 1 - Math.round(Math.sin(now / 300) * 2), mark[1], 'bold 20px Georgia, serif');
    }
    return;
  }
  if (c === player.target) frame('#ff3030', 1);
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

// The guide's arrow: bobbing over what it points at, or at the edge of the screen
// pointing its way when that is out of sight (or on another floor).
function drawGuideArrow(screen) {
  const step = player.tutorial && !player.dead && GUIDE[player.tutorial - 1], t = step && guideTarget(step);
  if (!t) return;
  const v = visual(t), [sx, sy] = screen(v.x + 0.5, v.y), bob = Math.sin(now / 180) * 5, m = 40;
  ctx.save();
  if (t.z === player.z && sx > m && sy > m + 30 && sx < viewPxW() - m && sy < viewPxH() - m) {
    ctx.translate(sx - (LIFT + (t.type ? HEAD_LEAN * Render.CREATURE_LEAN : 0)) * SCALE, sy - 38 - (t.type ? Sprites.headroom(t) * SCALE : 0) + bob); // above the name (and a creature's head)
    ctx.rotate(Math.PI / 2);
  } else {
    const cx = viewPxW() / 2, cy = viewPxH() / 2, a = Math.atan2(sy - cy, sx - cx);
    const reach = Math.min((cx - m) / Math.max(1e-6, Math.abs(Math.cos(a))), (cy - m) / Math.max(1e-6, Math.abs(Math.sin(a)))) + bob;
    ctx.translate(cx + Math.cos(a) * reach, cy + Math.sin(a) * reach);
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
      const n = Math.abs(parseInt(fx.text, 10)) || 0, size = n >= 100 ? 22 : n >= 40 ? 18 : 15, pop = age < 0.12 ? 1 + (1 - age / 0.12) * 0.6 : 1;
      const drift = ((Math.floor(fx.start) % 7) - 3) * 6 * age;
      ctx.globalAlpha = age > 0.7 ? Math.max(0, (1 - age) / 0.3) : 1;
      outlinedText(fx.text, sx + half + drift, sy + half - Math.sin(Math.min(1, age * 1.4) * Math.PI / 2) * 48, fx.color, `bold ${Math.round(size * pop)}px sans-serif`);
      ctx.globalAlpha = 1;
    } else if (fx.kind === 'flyby' && age < 1) {
      const [who, line] = FLYBY_LINES[Math.min(FLYBY_LINES.length - 1, Math.floor(age * FLYBY_LINES.length))];
      const [sx, sy] = screen(flybyX(fx, 0), fx.y);
      outlinedText(`${who}: ${line}`, Math.max(140, Math.min(viewPxW() - 140, sx + half)), sy - 40, '#ffd84a', 'bold 14px sans-serif');
    } else if (fx.kind === 'speech' && latest.get(fx.cid) === fx && age < 1) {
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
// clouds and shading, the water's ripples, the weather and footprints, the names over heads) and shows the frames a
// second each time, so a screenshot of it says what costs a phone the most. Stand still while it runs (about 20 s).
const PERF_PARTS = [['all', null], ['no floors above', 'floors'], ['no sky', 'sky'], ['no ripples', 'water'], ['no weather', 'fx'], ['no names', 'names']];
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
function reportError(err) {
  console.error(err);
  const message = String((err && err.message) || err);
  if (message === lastError) return;
  lastError = message;
  log(`Internal error: ${message} (details in the browser console)`, 'damage');
}
window.addEventListener('error', e => reportError(e.error || e.message));

function frame(t) {
  requestAnimationFrame(frame); // first, so an exception below can't freeze the game
  if (t - lastFrameAt < FRAME_INTERVAL - 2) return;
  const dt = t - lastFrameAt, started = performance.now(), live0 = Render.stats.live, made0 = Render.stats.finished, z0 = player && player.z;
  lastFrameAt = t;
  checkKeepingUp(t);
  try {
    if (online()) {
      now = Net.clock();
    } else {
      now = t;
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

function startOffline() {
  now = performance.now();
  player = newPlayer('Adventurer');
  players.push(player);
  npcs = map.npcs.map(spawnNpc); // so the start position search avoids them
  if (loadGame()) {
    log(`Welcome back, ${player.name}!`);
    startWorld();
    return;
  }
  teleport(map.start);
  paused = true;
  startWorldPreview();
  showCharacterCreation(() => {
    paused = false;
    saveGame();
    log(`Welcome to Oakvale Isle, ${player.name}!`, 'quest');
    startWorld();
  });
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
  $('loadingBar').style.width = `${Math.round(100 * (0.8 * pictures + (Preload.jobs.length ? 0 : 0.2 * Math.min(1, Preload.settled / 3))))}%`;
  $('loadingText').textContent = Preload.jobs.length ? 'Getting the world ready...' : 'Almost there...';
}

initUI();
startPreload();
if (typeof Net !== 'undefined' && Net.wanted()) Net.start(() => requestAnimationFrame(frame));
else startOffline();
