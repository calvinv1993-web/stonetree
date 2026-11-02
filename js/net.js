'use strict';
// Online play: the server (server/server.js) runs the world; this shows it and
// sends the player's actions there. Used when the game is opened from the server
// (http://<server>:8080, which opens index.html?online).
//
// After the first login the browser keeps a login token, so reloading the page
// (or losing the connection while the server restarts) logs straight back in.
// When the game is updated, pages reload themselves to get the new version.

const Net = (() => {
  let ws = null, offset = 0, ready = null, started = false, kicked = false, retry = null, version = null;
  const others = new Map(); // id -> other player objects, kept between updates
  const LOGIN_KEY = 'tilequest.online';
  const exploredKey = () => `tilequest.explored.${player.name.toLowerCase()}`;

  const wanted = () => location.protocol.startsWith('http') && new URLSearchParams(location.search).has('online');
  const send = msg => ws && ws.readyState === 1 && ws.send(JSON.stringify(msg));
  // Browser storage can be missing or full (private mode): then we just don't remember.
  const storage = (fn, fallback = null) => {
    try {
      return fn();
    } catch (e) {
      return fallback;
    }
  };
  const savedLogin = () => storage(() => JSON.parse(localStorage.getItem(LOGIN_KEY)));
  const forget = () => storage(() => localStorage.removeItem(LOGIN_KEY));

  // The login dialog is the character creation dialog plus a password.
  function showLogin(message) {
    const dialog = $('create');
    dialog.hidden = false;
    dialog.querySelector('p').textContent = message || 'Log in or create a character';
    let pw = $('createPassword');
    if (!pw) {
      pw = document.createElement('input');
      pw.id = 'createPassword';
      pw.type = 'password';
      pw.placeholder = 'Password (optional)';
      $('createName').after(pw);
      $('createStart').textContent = 'Play';
      const go = () => connect({ name: $('createName').value, password: pw.value, vocation: $('createVocation') && $('createVocation').value });
      $('createStart').addEventListener('click', go);
      for (const input of [$('createName'), pw]) input.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Enter') go();
      });
      // A test server starts characters at level 20: let them pick a vocation - or start
      // fresh on Brightwater Isle, with the guide, like on a real server.
      fetch('/status').then(r => r.json()).then(status => {
        if (!status.test) return;
        const voc = document.createElement('select');
        voc.id = 'createVocation';
        voc.add(new Option('Start fresh on Brightwater Isle (level 1, with the guide)', 'none'));
        for (const v of ['knight', 'paladin', 'sorcerer', 'druid']) voc.add(new Option(`Test server: level 20 ${v}`, v));
        pw.after(voc);
      }).catch(() => {});
    }
    $('createName').focus();
  }

  function connect(login) {
    clearTimeout(retry);
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    ws.onopen = () => send({ t: 'login', ...login });
    ws.onmessage = e => handle(JSON.parse(e.data));
    ws.onclose = () => {
      if (kicked) return;
      const saved = savedLogin();
      if (!saved) return Net.online ? log('Disconnected from the server. Reload the page to reconnect.', 'damage') : showLogin('Could not connect to the server.');
      // The server is probably restarting: keep trying with the saved login.
      if (Net.online && !Net.reconnecting) log('Lost the connection to the server. Reconnecting...', 'damage');
      if (!Net.online) showLogin('Connecting to the server...');
      Net.reconnecting = true;
      retry = setTimeout(() => connect(saved), 1000);
    };
  }

  function handle(msg) {
    if (msg.t === 'error') {
      ws.onclose = null;
      ws.close();
      if (msg.relogin) forget();
      return showLogin(msg.message);
    }
    if (msg.t === 'kicked') { // this character logged in on another page or device
      kicked = true;
      return log(msg.message, 'damage');
    }
    if (msg.t === 'updated') return showUpdate();
    if (msg.t === 'welcome') return welcome(msg);
    if (msg.t === 'state' && player) apply(msg);
  }

  // The game files changed on the server: reload (which logs right back in), but
  // not in the middle of typing a message - then wait until it's sent.
  function showUpdate() {
    if (Net.updating) return;
    Net.updating = true;
    const typing = () => document.activeElement === $('chat') && $('chat').value;
    const reload = () => {
      if (typing()) return setTimeout(reload, 1000);
      saveExplored();
      location.reload();
    };
    log('The game was updated: loading the new version...', 'quest');
    setTimeout(reload, 400);
  }

  function saveExplored() {
    if (player) storage(() => localStorage.setItem(exploredKey(), JSON.stringify(exportExplored())));
  }

  // The built-in world: make sure ours is the same as the server's (it isn't if
  // this browser plays a map from the editor), then bring it up to date.
  let builtinOk = false, server = null;
  function useBuiltinMap(msg) {
    if (server && msg.server !== server) { // a restarted server: start from the untouched world again
      Object.assign(map, createDefaultMap());
      builtinOk = false;
    }
    server = msg.server;
    if (!builtinOk) {
      if (customMap || mapSignature(map) !== msg.builtin) Object.assign(map, createDefaultMap());
      if (mapSignature(map) !== msg.builtin) return false; // the server runs another version of the world
      builtinOk = true;
    }
    for (const [x, y, z, ground, items] of msg.changes) map.set(x, y, z, ground || items.length ? { ground, items } : null);
    return true;
  }

  function welcome(msg) {
    if (msg.map) Object.assign(map, GameMap.fromJSON(msg.map));
    else if (!useBuiltinMap(msg)) return showUpdate();
    builtinWorld = !msg.map;
    fitMinimap(); // the server's map: maybe not the size of the one the page started with, and changed since
    player = newPlayer(msg.name);
    player.id = msg.id;
    players.length = 0;
    players.push(player);
    npcs = msg.npcs.map(n => ({ ...n, type: 'npc', def: NPCS[n.npcId], walk: null }));
    offset = msg.now - performance.now();
    Net.online = true;
    if (Net.reconnecting) log('Reconnected.', 'quest');
    Net.reconnecting = false;
    storage(() => localStorage.setItem(LOGIN_KEY, JSON.stringify({ name: msg.name, token: msg.token })));
    if (version && msg.version !== version) showUpdate();
    version = version || msg.version;
    // From now on, every action goes to the server.
    for (const name of Object.keys(Actions)) Actions[name] = (...args) => send({ t: 'act', a: name, args });
    $('create').hidden = true;
    $('mapSource').textContent = 'Playing online';
    $('newChar').textContent = 'Log out';
    if (msg.isNew) openOutfit();
    importExplored(storage(() => JSON.parse(localStorage.getItem(exploredKey()))));
    uiDirty();
    if (!started) {
      started = true;
      setInterval(saveExplored, 10000);
      window.addEventListener('pagehide', saveExplored);
      ready();
    }
  }

  const PANEL_FIELDS = ['equipment', 'depot', 'skills', 'quests', 'chests', 'hotkeys', 'markers', 'furniture'];
  let panelState = {}, panelKey = '';

  function apply(s) {
    // Keep a smooth clock: follow the server time, but never jump backwards much.
    offset += (s.now - performance.now() - offset) * 0.1;
    const you = s.you;
    for (const [k, v] of Object.entries(you)) if (!['target', 'openPile', 'shopNpc'].includes(k)) player[k] = v;

    monsters = s.monsters.map(m => ({ ...m, def: MONSTERS[m.type], conditions: {}, dead: false }));
    for (const o of s.npcs || []) { // townsfolk walking about
      const n = npcs.find(x => x.id === o.id);
      if (n) Object.assign(n, o);
    }
    const seen = new Set();
    for (const o of s.players) {
      const p = others.get(o.id) || { type: 'player', conditions: {}, events: [] };
      Object.assign(p, o);
      others.set(o.id, p);
      seen.add(o.id);
    }
    for (const id of others.keys()) if (!seen.has(id)) others.delete(id);
    players.length = 0;
    players.push(player, ...others.values());
    piles.length = 0;
    piles.push(...s.piles);
    fields.length = 0;
    fields.push(...s.fields);
    effects.push(...s.effects);
    for (let i = effects.length - 1; i >= 0; i--) if (effects[i].start + effects[i].dur < s.now - 200) effects.splice(i, 1);
    for (const [x, y, z, ground, items] of s.tiles) {
      map.set(x, y, z, ground || items.length ? { ground, items } : null);
      mapChanges.push([x, y, z]);
    }

    const byId = id => id && (monsters.find(m => m.id === id) || others.get(id));
    player.target = byId(you.target) || null;
    player.openPile = piles.find(p => p.id === you.openPile) || null;
    const shop = npcs.find(n => n.id === you.shopNpc) || null;
    player.shopNpc = shop;
    // Rebuild the panels only when what they show has changed: rebuilt 20 times a second,
    // their buttons would lose the clicks made on them.
    for (const k of PANEL_FIELDS) if (you[k] !== undefined) panelState[k] = you[k];
    const key = JSON.stringify([panelState, you.gold, you.bank, you.level, you.vocation, you.promoted, you.home, you.house, you.secure,
      you.fightMode, you.chase, you.shopNpc, player.openPile && player.openPile.items]);
    if (key !== panelKey) {
      panelKey = key;
      uiDirty();
    }

    for (const line of s.out) {
      if (line[0] === 'log') log(line[1], line[2]);
      else logDialog(line[1], line[2], line[3]);
    }
    player.events.push(...s.events);
  }

  return {
    online: false,
    reconnecting: false,
    wanted,
    forget,
    start(onReady) {
      ready = onReady;
      const saved = savedLogin();
      if (saved) connect(saved);
      else showLogin();
    },
    clock: () => performance.now() + offset,
  };
})();
