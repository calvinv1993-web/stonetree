'use strict';
// Map editor: paint grounds/items/spawns/NPCs on any floor, set up teleports,
// levers, signs and special doors, mark houses, and copy/paste areas. Changes
// are saved to browser storage automatically, which is where the game loads the map from.

(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3];
  const MAIN_START_COLOR = '#60a0ff';

  const storedMap = loadStoredMap();
  let map = storedMap || createDefaultMap();
  const ed = {
    tool: 'brush', size: 1, zoom: 1.5, z: 0, camX: 0, camY: 0,
    selected: { kind: 'thing', id: 'grass' }, // kind: thing | scatter | spawn | npc | start | mainStart
    selection: null, // { x0, y0, x1, y1 } on the current floor (select tool)
    showLower: true, grid: true,
    hover: null, // tile under the mouse
    drag: null,  // current mouse drag: { mode: paint | erase | rect | pan, ... }
    space: false,
  };
  let undoStack = [], redoStack = [], stroke = null, saveTimer = 0, dpr = 1, clipboard = null;

  // Scatter brushes put a random one of these on some of the free tiles they touch.
  const SCATTER = {
    forest: { name: 'forest', things: ['tree', 'tree', 'pine', 'bush'], density: 0.35 },
    flowers: { name: 'flowers and bushes', things: ['flowers', 'flowers', 'bush'], density: 0.3 },
    rocks: { name: 'rocks', things: ['rock'], density: 0.2 },
    swamp: { name: 'swamp plants', things: ['reeds', 'reeds', 'mushrooms'], density: 0.35 },
  };

  // What the editor asks when you place a thing that needs a setting (see THINGS meta).
  const META_PROMPTS = {
    to: 'Where does this teleport lead? (x, y, z)',
    target: 'Which tile does this lever open and close? Put a "secret stone wall" there. (x, y, z)',
    lock: 'Lock name: a key with the same name opens it (bronze or silver).',
    quest: 'Quest needed to pass: a quest id, or id@step (e.g. drowned_king@2).',
    level: 'Minimum level to pass:',
    text: 'What does it say?',
  };
  function askMeta(kind, x, y) {
    const defaults = { to: `${x}, ${y}, ${ed.z}`, target: `${x}, ${y}, ${ed.z}`, lock: 'bronze', quest: '', level: '20', text: '' };
    const answer = prompt(META_PROMPTS[kind], defaults[kind]);
    if (answer === null) return undefined;
    if (kind === 'to' || kind === 'target') {
      const [tx, ty, tz] = answer.split(/[^0-9]+/).filter(Boolean).map(Number);
      return map.inBounds(tx, ty, tz) ? { x: tx, y: ty, z: tz } : undefined;
    }
    return kind === 'level' ? +answer || 1 : answer;
  }
  const panKeys = new Set();

  // ---- view ----------------------------------------------------------------------
  function resize() {
    dpr = window.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
  }

  function centerOn(x, y) {
    ed.camX = (x + 0.5) * TILE;
    ed.camY = (y + 0.5) * TILE;
  }

  function eventTile(e) {
    const r = canvas.getBoundingClientRect();
    const wx = (e.clientX - r.left - r.width / 2) / ed.zoom + ed.camX;
    const wy = (e.clientY - r.top - r.height / 2) / ed.zoom + ed.camY;
    return { x: Math.floor(wx / TILE), y: Math.floor(wy / TILE) };
  }

  // "Go to": the towns, dungeons and islands of the built-in world.
  const isles = (map.labels || []).map(({ name, x, y, z }) => [name, x, y, z]).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [group, list] of [['Towns', MAP_TOWNS], ['Dungeons and sights', MAP_SIGHTS], ['Islands', isles]]) {
    const og = document.createElement('optgroup');
    og.label = group;
    for (const [name, x, y, z] of list) og.appendChild(new Option(name, `${x},${y},${z}`));
    $('goTo').appendChild(og);
  }
  $('goTo').addEventListener('change', e => {
    if (!e.target.value) return;
    const [x, y, z] = e.target.value.split(',').map(Number);
    setFloor(z);
    centerOn(x + (z - map.surfaceZ), y + (z - map.surfaceZ));
    e.target.value = '';
    e.target.blur();
  });

  function setFloor(z) {
    z = Math.max(0, Math.min(map.depth - 1, z));
    // Floors are drawn shifted one tile per level, so move the camera along to
    // keep the floor below in place on screen.
    ed.camX += (z - ed.z) * TILE;
    ed.camY += (z - ed.z) * TILE;
    ed.z = z;
    $('floorLabel').textContent = map.floorLabel(z);
    updateStatus();
  }

  function draw(now) {
    const s = ed.zoom * dpr, w = canvas.width / s, h = canvas.height / s;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const objects = [
      ...map.spawns.map(sp => ({ x: sp.x, y: sp.y, z: sp.z, img: Sprites.creature(sp.type, 2, 0) })),
      ...map.npcs.map(n => ({ x: n.x, y: n.y, z: n.z, img: Sprites.creature(`npc:${n.type}`, 2, 0) })),
      { ...map.start, img: Sprites.startMarker() },
      { ...map.mainStart, img: Sprites.startMarker(MAIN_START_COLOR) },
    ];
    Render.world(ctx, map, {
      cx: ed.camX, cy: ed.camY, z: ed.z, w, h, time: now, objects, dimLower: true,
      minZ: ed.showLower ? Math.max(0, ed.z - 2) : ed.z, maxZ: ed.z,
    });

    const ox = Math.round(w / 2 - ed.camX), oy = Math.round(h / 2 - ed.camY);
    ctx.lineWidth = 1 / s;
    if (ed.grid) {
      const x0 = Math.max(0, Math.floor(-ox / TILE)), x1 = Math.min(map.width, Math.ceil((w - ox) / TILE));
      const y0 = Math.max(0, Math.floor(-oy / TILE)), y1 = Math.min(map.height, Math.ceil((h - oy) / TILE));
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      for (let x = x0; x <= x1; x++) { ctx.moveTo(ox + x * TILE, oy + y0 * TILE); ctx.lineTo(ox + x * TILE, oy + y1 * TILE); }
      for (let y = y0; y <= y1; y++) { ctx.moveTo(ox + x0 * TILE, oy + y * TILE); ctx.lineTo(ox + x1 * TILE, oy + y * TILE); }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(240,192,64,0.7)';
    ctx.strokeRect(ox, oy, map.width * TILE, map.height * TILE);

    // Rings: red for monster spawns, blue for NPCs.
    for (const [list, color] of [[map.spawns, 'rgba(255,60,60,0.9)'], [map.npcs, 'rgba(90,170,255,0.9)']]) {
      ctx.strokeStyle = color;
      for (const p of list) {
        if (p.z !== ed.z) continue;
        ctx.beginPath();
        ctx.arc(ox + (p.x + 0.5) * TILE, oy + (p.y + 0.5) * TILE, TILE * 0.55, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Houses (green outline), tiles with settings (cyan dot, a line to where they lead), the selection.
    ctx.font = `${12 / ed.zoom}px sans-serif`;
    for (const house of map.houses.filter(hs => hs.z === ed.z)) {
      ctx.strokeStyle = 'rgba(80,220,120,0.9)';
      ctx.strokeRect(ox + house.x0 * TILE, oy + house.y0 * TILE, (house.x1 - house.x0 + 1) * TILE, (house.y1 - house.y0 + 1) * TILE);
      ctx.fillStyle = 'rgba(80,220,120,0.95)';
      ctx.fillText(`${house.name} (${house.rent})`, ox + house.x0 * TILE + 3, oy + house.y0 * TILE + 12 / ed.zoom);
    }
    for (const [key, meta] of Object.entries(map.meta)) {
      const [x, y, z] = key.split(',').map(Number);
      if (z !== ed.z) continue;
      const cx = ox + (x + 0.5) * TILE, cy = oy + (y + 0.5) * TILE, dest = meta.to || meta.target;
      ctx.fillStyle = '#40e0ff';
      ctx.beginPath();
      ctx.arc(cx, cy, 3 / ed.zoom + 2, 0, Math.PI * 2);
      ctx.fill();
      if (dest && dest.z === ed.z) {
        ctx.strokeStyle = 'rgba(64,224,255,0.7)';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ox + (dest.x + 0.5) * TILE, oy + (dest.y + 0.5) * TILE);
        ctx.stroke();
      }
    }
    if (ed.selection) {
      const r = ed.selection;
      ctx.setLineDash([6 / ed.zoom, 4 / ed.zoom]);
      ctx.strokeStyle = '#ffe080';
      ctx.strokeRect(ox + r.x0 * TILE, oy + r.y0 * TILE, (r.x1 - r.x0 + 1) * TILE, (r.y1 - r.y0 + 1) * TILE);
      ctx.setLineDash([]);
    }
    if (clipboard && ed.tool === 'select' && ed.hover && !ed.drag) {
      ctx.strokeStyle = 'rgba(255,224,128,0.5)';
      ctx.strokeRect(ox + ed.hover.x * TILE, oy + ed.hover.y * TILE, clipboard.w * TILE, clipboard.h * TILE);
    }

    const a = previewArea();
    if (a) {
      const x = ox + a.x0 * TILE, y = oy + a.y0 * TILE, rw = (a.x1 - a.x0 + 1) * TILE, rh = (a.y1 - a.y0 + 1) * TILE;
      ctx.fillStyle = ed.drag?.mode === 'erase' || ed.tool === 'eraser' ? 'rgba(255,80,80,0.18)' : 'rgba(255,255,255,0.15)';
      ctx.fillRect(x, y, rw, rh);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(x, y, rw, rh);
    }
  }

  const brushRadius = () => (ed.tool === 'eraser' || ed.selected.kind === 'thing' || ed.selected.kind === 'scatter' ? (ed.size - 1) / 2 : 0);

  function previewArea() {
    const d = ed.drag;
    if (d && d.mode === 'rect') {
      return { x0: Math.min(d.from.x, d.to.x), y0: Math.min(d.from.y, d.to.y), x1: Math.max(d.from.x, d.to.x), y1: Math.max(d.from.y, d.to.y) };
    }
    if (!ed.hover || (d && d.mode === 'pan')) return null;
    const r = ed.tool === 'picker' ? 0 : brushRadius();
    return { x0: ed.hover.x - r, y0: ed.hover.y - r, x1: ed.hover.x + r, y1: ed.hover.y + r };
  }

  // ---- editing (every change happens inside a stroke so it can be undone) --------
  const cloneTile = t => (t ? { ground: t.ground, items: [...t.items] } : null);

  // Spawns, NPCs, start points, tile settings and houses, saved and restored as one unit.
  const snapshotExtras = () => JSON.parse(JSON.stringify({
    spawns: map.spawns, npcs: map.npcs, start: map.start, mainStart: map.mainStart, meta: map.meta, houses: map.houses,
  }));
  const restoreExtras = e => Object.assign(map, JSON.parse(JSON.stringify(e)));

  function beginStroke() {
    stroke = { tiles: new Map(), extras: snapshotExtras(), erased: new Set() };
  }

  // Remember a tile's state before the stroke first changes it.
  function touch(x, y, z) {
    const k = `${x},${y},${z}`;
    if (!stroke.tiles.has(k)) stroke.tiles.set(k, cloneTile(map.get(x, y, z)));
  }

  function endStroke() {
    if (!stroke) return;
    const s = stroke;
    stroke = null;
    const changed = s.tiles.size || JSON.stringify(s.extras) !== JSON.stringify(snapshotExtras());
    if (!changed) return;
    delete s.erased;
    undoStack.push(s);
    if (undoStack.length > 200) undoStack.shift();
    redoStack = [];
    scheduleSave();
  }

  // Restore a recorded state and return the state it replaced (for redo/undo).
  function swapState(s) {
    const inverse = { tiles: new Map(), extras: snapshotExtras() };
    for (const [k, tile] of s.tiles) {
      const [x, y, z] = k.split(',').map(Number);
      inverse.tiles.set(k, cloneTile(map.get(x, y, z)));
      map.set(x, y, z, cloneTile(tile));
    }
    restoreExtras(s.extras);
    return inverse;
  }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push(swapState(undoStack.pop()));
    scheduleSave();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(swapState(redoStack.pop()));
    scheduleSave();
  }

  function placeTile(x, y) {
    const z = ed.z, sel = ed.selected;
    if (!map.inBounds(x, y, z)) return;
    const elsewhere = p => !(p.x === x && p.y === y && p.z === z);
    if (sel.kind === 'start' || sel.kind === 'mainStart') {
      map[sel.kind] = { x, y, z };
    } else if (sel.kind === 'spawn' || sel.kind === 'npc') {
      map.spawns = map.spawns.filter(elsewhere);
      map.npcs = map.npcs.filter(elsewhere);
      (sel.kind === 'spawn' ? map.spawns : map.npcs).push({ x, y, z, type: sel.id });
    } else if (sel.kind === 'scatter') {
      const b = SCATTER[sel.id], t = map.get(x, y, z);
      if (!t || !t.ground || t.items.length || THINGS[t.ground].block || Math.random() > b.density) return;
      touch(x, y, z);
      map.addItem(x, y, z, b.things[Math.floor(Math.random() * b.things.length)]);
    } else {
      const def = THINGS[sel.id];
      if (def.meta) {
        if (stroke.meta === undefined) stroke.meta = askMeta(def.meta, x, y) ?? null;
        if (stroke.meta === null) return;
        map.setMeta(x, y, z, { ...(map.getMeta(x, y, z) || {}), [def.meta]: stroke.meta });
      }
      touch(x, y, z);
      if (def.ground) map.setGround(x, y, z, sel.id);
      else map.addItem(x, y, z, sel.id);
    }
  }

  // Removes the top-most thing: a spawn or NPC, then items from the top, then the ground.
  function eraseTile(x, y) {
    const z = ed.z, k = `${x},${y},${z}`;
    if (!map.inBounds(x, y, z) || stroke.erased.has(k)) return; // once per tile per stroke
    stroke.erased.add(k);
    for (const list of [map.spawns, map.npcs]) {
      const i = list.findIndex(p => p.x === x && p.y === y && p.z === z);
      if (i >= 0) {
        list.splice(i, 1);
        return;
      }
    }
    const t = map.get(x, y, z);
    if (!t) return;
    touch(x, y, z);
    if (t.items.length) t.items.pop();
    else map.set(x, y, z, null);
    if (!(map.get(x, y, z) || { items: [] }).items.some(id => THINGS[id].meta)) map.setMeta(x, y, z, null);
  }

  function brushAt(x, y, erase) {
    const r = erase ? (ed.size - 1) / 2 : brushRadius();
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (erase) eraseTile(x + dx, y + dy);
      else placeTile(x + dx, y + dy);
    }
  }

  function fillArea(a, b, outlineOnly) {
    if (ed.selected.kind !== 'thing' && ed.selected.kind !== 'scatter') return placeTile(b.x, b.y);
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!outlineOnly || x === x0 || x === x1 || y === y0 || y === y1) placeTile(x, y);
    }
  }

  const rectOf = (a, b) => ({ x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) });
  const inRect = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

  // House tool: drag out a house (include its walls), right-click one to remove it.
  function addHouse(r) {
    const name = prompt('House name:', 'New House');
    if (!name) return;
    const rent = +prompt('Rent in gold:', '1000') || 1000;
    beginStroke();
    map.houses.push({ id: `h${Date.now().toString(36)}`, name, rent, ...r, z: ed.z });
    endStroke();
    alert('Now put a "house door" on its wall. Players rent houses from a landlord NPC.');
  }
  function removeHouseAt(x, y) {
    const h = map.houseAt(x, y, ed.z);
    if (!h || !confirm(`Remove the house "${h.name}"?`)) return;
    beginStroke();
    map.houses = map.houses.filter(o => o !== h);
    endStroke();
  }

  // Copy, paste and delete the selected area (tiles, spawns, NPCs and tile settings).
  function copySelection() {
    const r = ed.selection;
    if (!r) return;
    const at = (list, x, y) => list.filter(p => p.z === ed.z && p.x === x && p.y === y);
    clipboard = { w: r.x1 - r.x0 + 1, h: r.y1 - r.y0 + 1, cells: [] };
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
      clipboard.cells.push({
        dx: x - r.x0, dy: y - r.y0, tile: cloneTile(map.get(x, y, ed.z)), meta: map.getMeta(x, y, ed.z),
        spawns: at(map.spawns, x, y).map(s => s.type), npcs: at(map.npcs, x, y).map(n => n.type),
      });
    }
    $('saveState').textContent = `Copied ${clipboard.w}×${clipboard.h} tiles`;
  }
  function clearArea(r, z) {
    const outside = p => !(p.z === z && inRect(r, p.x, p.y));
    map.spawns = map.spawns.filter(outside);
    map.npcs = map.npcs.filter(outside);
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
      if (!map.inBounds(x, y, z)) continue;
      touch(x, y, z);
      map.set(x, y, z, null);
      map.setMeta(x, y, z, null);
    }
  }
  function paste() {
    if (!clipboard || !ed.hover) return;
    const { x: ox, y: oy } = ed.hover, z = ed.z;
    beginStroke();
    clearArea({ x0: ox, y0: oy, x1: ox + clipboard.w - 1, y1: oy + clipboard.h - 1 }, z);
    for (const c of clipboard.cells) {
      const x = ox + c.dx, y = oy + c.dy;
      if (!map.inBounds(x, y, z)) continue;
      map.set(x, y, z, cloneTile(c.tile));
      if (c.meta) map.setMeta(x, y, z, JSON.parse(JSON.stringify(c.meta)));
      for (const type of c.spawns) map.spawns.push({ x, y, z, type });
      for (const type of c.npcs) map.npcs.push({ x, y, z, type });
    }
    endStroke();
    ed.selection = { x0: ox, y0: oy, x1: ox + clipboard.w - 1, y1: oy + clipboard.h - 1 };
  }
  function deleteSelection() {
    if (!ed.selection) return;
    beginStroke();
    clearArea(ed.selection, ed.z);
    endStroke();
  }

  // Calls fn for every tile on the line from a (exclusive) to b, so fast drags leave no gaps.
  function line(a, b, fn) {
    const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    for (let i = 1; i <= n; i++) fn(Math.round(a.x + ((b.x - a.x) * i) / n), Math.round(a.y + ((b.y - a.y) * i) / n));
  }

  function pick(x, y) {
    const z = ed.z;
    const at = p => p.x === x && p.y === y && p.z === z;
    const sp = map.spawns.find(at), npc = map.npcs.find(at);
    const t = map.get(x, y, z);
    const id = t && (t.items[t.items.length - 1] || t.ground);
    if (sp) select({ kind: 'spawn', id: sp.type });
    else if (npc) select({ kind: 'npc', id: npc.type });
    else if (id) select({ kind: 'thing', id });
  }

  // ---- palette and toolbar ---------------------------------------------------------
  const keyOf = sel => `${sel.kind}:${sel.id}`;
  function nameOf(sel) {
    if (sel.kind === 'spawn') return `${MONSTERS[sel.id].name} spawn`;
    if (sel.kind === 'npc') return `${NPCS[sel.id].name} (NPC)`;
    if (sel.kind === 'start') return 'player start (new characters)';
    if (sel.kind === 'mainStart') return 'vocation start (arrival on the mainland)';
    if (sel.kind === 'scatter') return `${SCATTER[sel.id].name} (scatter brush)`;
    const def = THINGS[sel.id];
    if (def.meta) return `${def.name} (asks for its ${{ to: 'destination', target: 'target tile', lock: 'lock', quest: 'quest', level: 'level', text: 'text' }[def.meta]})`;
    if (!def.chest) return def.name;
    const loot = (def.chest.items || []).map(([id, n]) => itemName(id, n));
    if (def.chest.gold) loot.push(`${def.chest.gold} gold`);
    return `quest ${def.name}: ${loot.join(', ')}`;
  }

  function buildPalette() {
    const groups = new Map();
    const add = (cat, entry, img) => {
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push({ entry, img });
    };
    for (const [id, def] of Object.entries(THINGS)) add(def.cat, { kind: 'thing', id }, Sprites.thing(id));
    for (const [id, b] of Object.entries(SCATTER)) add('Scatter brushes', { kind: 'scatter', id }, Sprites.thing(b.things[0]));
    for (const id of Object.keys(MONSTERS)) add('Monster spawns', { kind: 'spawn', id }, Sprites.creature(id, 2, 0));
    for (const id of Object.keys(NPCS)) add('NPCs', { kind: 'npc', id }, Sprites.creature(`npc:${id}`, 2, 0));
    add('Start points', { kind: 'start', id: 'start' }, Sprites.startMarker());
    add('Start points', { kind: 'mainStart', id: 'mainStart' }, Sprites.startMarker(MAIN_START_COLOR));

    const root = $('palette');
    for (const [cat, list] of groups) {
      const h = document.createElement('h3');
      h.textContent = cat;
      const grid = document.createElement('div');
      grid.className = 'swatches';
      for (const { entry, img } of list) {
        const b = document.createElement('button');
        b.className = 'swatch';
        b.title = nameOf(entry);
        b.dataset.key = keyOf(entry);
        const im = new Image();
        im.src = img.toDataURL();
        b.appendChild(im);
        b.addEventListener('click', () => select(entry));
        grid.appendChild(b);
      }
      root.append(h, grid);
    }
  }

  function select(sel) {
    ed.selected = sel;
    if (ed.tool === 'eraser' || ed.tool === 'picker') setTool('brush');
    document.querySelectorAll('.swatch').forEach(b => b.classList.toggle('active', b.dataset.key === keyOf(sel)));
    $('selectedName').textContent = `Selected: ${nameOf(sel)}`;
  }

  function setTool(tool) {
    ed.tool = tool;
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  }

  function setSize(size) {
    ed.size = size;
    document.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('active', +b.dataset.size === size));
  }

  function updateStatus() {
    let text = `Floor ${map.floorLabel(ed.z)} · zoom ${ed.zoom}x · map ${map.width}×${map.height}, ${map.depth} floors`;
    const h = ed.hover;
    if (h && map.inBounds(h.x, h.y, ed.z)) {
      const t = map.get(h.x, h.y, ed.z);
      const parts = t ? [t.ground, ...t.items].filter(Boolean).map(id => THINGS[id].name) : [];
      const at = p => p.x === h.x && p.y === h.y && p.z === ed.z;
      const sp = map.spawns.find(at), npc = map.npcs.find(at);
      if (sp) parts.push(`${sp.type} spawn`);
      if (npc) parts.push(NPCS[npc.type].name);
      if (at(map.start)) parts.push('player start');
      if (at(map.mainStart)) parts.push('vocation start');
      const meta = map.getMeta(h.x, h.y, ed.z), house = map.houseAt(h.x, h.y, ed.z);
      if (meta) parts.push(Object.entries(meta).map(([k, v]) => `${k}: ${typeof v === 'object' ? `${v.x},${v.y},${v.z}` : v}`).join(', '));
      if (house) parts.push(`house "${house.name}" (${house.rent} gold)`);
      text = `${h.x}, ${h.y}, ${ed.z}: ${parts.join(', ') || 'empty'}   ·   ${text}`;
    }
    $('status').textContent = text;
  }

  // ---- saving / loading ------------------------------------------------------------
  function save() {
    clearTimeout(saveTimer);
    $('saveState').textContent = storeMap(map) ? 'Saved' : 'Could not save to browser storage!';
  }
  function scheduleSave() {
    $('saveState').textContent = 'Saving…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 400);
  }

  function loadMap(m) {
    map = m;
    undoStack = [];
    redoStack = [];
    ed.z = map.start.z;
    centerOn(map.start.x, map.start.y);
    setFloor(map.start.z);
    save();
  }

  const confirmReplace = () => confirm('Replace the current map? Use Export first if you want to keep it.');

  $('newMap').addEventListener('click', () => {
    const answer = prompt('New map size (width x height x floors):', `${map.width}x${map.height}x${map.depth}`);
    if (!answer) return;
    const [w, h, d] = answer.split(/[^0-9]+/).filter(Boolean).map(Number);
    if (![w, h, d].every(n => Number.isInteger(n) && n > 0) || w > 512 || h > 512 || d > 16) {
      alert('Please enter a size like 64x64x8 (at most 512x512x16).');
      return;
    }
    if (!confirmReplace()) return;
    const m = new GameMap(w, h, d, Math.floor(d / 2));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m.setGround(x, y, m.surfaceZ, 'grass');
    loadMap(m);
  });

  $('defaultMap').addEventListener('click', () => {
    if (confirmReplace()) loadMap(createDefaultMap());
  });

  $('exportMap').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(map)], { type: 'application/json' }));
    a.download = 'map.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  // Opened from the game server (not as a file): the map can be published to it for everyone.
  if (location.protocol.startsWith('http')) {
    $('publishMap').hidden = $('unpublishMap').hidden = false;
    const send = async (method, body, ask) => {
      if (!confirm(ask)) return;
      $('saveState').textContent = 'Publishing…';
      try {
        const res = await fetch('/map', { method, body, headers: { 'X-Tilequest': 'editor', ...(body ? { 'Content-Type': 'application/json' } : {}) } });
        const answer = await res.json();
        $('saveState').textContent = answer.message;
        if (!answer.ok) alert(answer.message);
      } catch (e) {
        $('saveState').textContent = 'Could not reach the server.';
      }
    };
    $('publishMap').addEventListener('click', () => send('POST', JSON.stringify(map),
      'Publish this map to the game server? Everyone plays on it from the next server start (players are moved to the temple if they stand somewhere that no longer exists).'));
    $('unpublishMap').addEventListener('click', () => send('DELETE', null, 'Let the game server play the built-in world again?'));
  }

  $('importMap').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !confirmReplace()) return;
    try {
      loadMap(GameMap.fromJSON(JSON.parse(await file.text())));
    } catch (err) {
      alert(`Could not read that map: ${err.message}`);
    }
  });

  $('playMap').addEventListener('click', () => {
    save();
    if (!storeMap(map)) return alert('The map is too big for this browser\'s storage, so the game would not get your changes. Export it instead, or publish it to a server.');
    window.open('index.html', 'tilequest-game');
  });

  // ---- input -----------------------------------------------------------------------
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('mousedown', e => {
    e.preventDefault();
    if (ed.drag) return;
    const t = eventTile(e);
    if (e.button === 1 || (e.button === 0 && ed.space)) {
      ed.drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, camX: ed.camX, camY: ed.camY };
    } else if (e.button === 2 && ed.tool === 'house') {
      removeHouseAt(t.x, t.y);
    } else if (e.button === 2 || (e.button === 0 && ed.tool === 'eraser')) {
      beginStroke();
      ed.drag = { mode: 'erase', last: t };
      brushAt(t.x, t.y, true);
    } else if (e.button === 0 && ed.tool === 'picker') {
      pick(t.x, t.y);
    } else if (e.button === 0 && ['rect', 'outline', 'house', 'select'].includes(ed.tool)) {
      ed.drag = { mode: 'rect', from: t, to: t };
    } else if (e.button === 0 && ed.selected.kind === 'thing' && THINGS[ed.selected.id].meta) {
      beginStroke(); // asks for a setting, so one at a time
      placeTile(t.x, t.y);
      endStroke();
    } else if (e.button === 0) {
      beginStroke();
      ed.drag = { mode: 'paint', last: t };
      brushAt(t.x, t.y, false);
    }
  });

  window.addEventListener('mousemove', e => {
    const t = eventTile(e);
    ed.hover = e.target === canvas ? t : null;
    updateStatus();
    const d = ed.drag;
    if (!d) return;
    if (d.mode === 'pan') {
      ed.camX = d.camX - (e.clientX - d.sx) / ed.zoom;
      ed.camY = d.camY - (e.clientY - d.sy) / ed.zoom;
    } else if (d.mode === 'rect') {
      d.to = t;
    } else if (t.x !== d.last.x || t.y !== d.last.y) {
      line(d.last, t, (x, y) => brushAt(x, y, d.mode === 'erase'));
      d.last = t;
    }
  });

  window.addEventListener('mouseup', () => {
    const d = ed.drag;
    if (!d) return;
    ed.drag = null;
    if (d.mode === 'rect' && ed.tool === 'select') ed.selection = rectOf(d.from, d.to);
    else if (d.mode === 'rect' && ed.tool === 'house') addHouse(rectOf(d.from, d.to));
    else if (d.mode === 'rect') {
      beginStroke();
      fillArea(d.from, d.to, ed.tool === 'outline');
    }
    endStroke();
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const i = ZOOMS.indexOf(ed.zoom);
    const ni = Math.max(0, Math.min(ZOOMS.length - 1, i + (e.deltaY < 0 ? 1 : -1)));
    if (ni === i) return;
    // Zoom around the mouse cursor.
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left - r.width / 2, my = e.clientY - r.top - r.height / 2;
    const wx = mx / ed.zoom + ed.camX, wy = my / ed.zoom + ed.camY;
    ed.zoom = ZOOMS[ni];
    ed.camX = wx - mx / ed.zoom;
    ed.camY = wy - my / ed.zoom;
    updateStatus();
  }, { passive: false });

  const PAN_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'];
  const TOOL_KEYS = { b: 'brush', r: 'rect', o: 'outline', e: 'eraser', i: 'picker', h: 'house', v: 'select' };

  window.addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement) return;
    const k = e.key.toLowerCase();
    if (e.ctrlKey || e.metaKey) {
      if (k === 'z') e.shiftKey ? redo() : undo();
      else if (k === 'y') redo();
      else if (k === 's') save();
      else if (k === 'c') copySelection();
      else if (k === 'v') paste();
      else if (k === 'x') { copySelection(); deleteSelection(); }
      else return;
      e.preventDefault();
      return;
    }
    if (PAN_KEYS.includes(k)) panKeys.add(k);
    else if (TOOL_KEYS[k]) setTool(TOOL_KEYS[k]);
    else if (k === 'pageup') setFloor(ed.z + 1);
    else if (k === 'pagedown') setFloor(ed.z - 1);
    else if (k === '1' || k === '2' || k === '3') setSize([1, 3, 5][+k - 1]);
    else if (k === 'g') $('showGrid').click();
    else if (k === 'l') $('showLower').click();
    else if (k === ' ') ed.space = true;
    else if (k === 'delete') deleteSelection();
    else if (k === 'escape') ed.selection = null;
    else return;
    e.preventDefault();
  });
  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    panKeys.delete(k);
    if (k === ' ') ed.space = false;
  });
  window.addEventListener('blur', () => {
    panKeys.clear();
    ed.space = false;
  });

  document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
  document.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', () => setSize(+b.dataset.size)));
  $('floorUp').addEventListener('click', () => setFloor(ed.z + 1));
  $('floorDown').addEventListener('click', () => setFloor(ed.z - 1));
  $('undo').addEventListener('click', undo);
  $('redo').addEventListener('click', redo);
  $('showLower').addEventListener('change', e => { ed.showLower = e.target.checked; });
  $('showGrid').addEventListener('change', e => { ed.grid = e.target.checked; });
  window.addEventListener('resize', resize);

  // ---- main loop -------------------------------------------------------------------
  let last = performance.now();
  function frame(now) {
    const speed = (0.5 * Math.min(50, now - last)) / ed.zoom; // world px this frame
    last = now;
    if (panKeys.has('arrowleft') || panKeys.has('a')) ed.camX -= speed;
    if (panKeys.has('arrowright') || panKeys.has('d')) ed.camX += speed;
    if (panKeys.has('arrowup') || panKeys.has('w')) ed.camY -= speed;
    if (panKeys.has('arrowdown') || panKeys.has('s')) ed.camY += speed;
    draw(now);
    requestAnimationFrame(frame);
  }

  resize();
  buildPalette();
  select(ed.selected);
  setTool('brush');
  setSize(1);
  ed.z = map.start.z;
  centerOn(map.start.x, map.start.y);
  setFloor(map.start.z);
  $('saveState').textContent = storedMap ? 'Saved' : 'Demo map (saved on first edit)';
  requestAnimationFrame(frame);
})();
