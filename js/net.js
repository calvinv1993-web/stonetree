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

  // Logging in: SORTIA's gate (game-ui.js Gate), Create account or Log in to an account, then its character select
  // (the server's t: 'account'): play one, or make a new one. The server says what's wrong (a name taken, a wrong
  // password), and that's said on the form. The account's token is kept (LOGIN_KEY), so a page opened again goes straight
  // to the characters; the character played is kept for this tab (PLAYING_KEY), so a reload (an update, a lost
  // connection) goes straight back into the world. A test server also offers its level 20 starts.
  const PLAYING_KEY = 'tilequest.playing.online';
  const playingNow = value => storage(() => { if (value === undefined) return sessionStorage.getItem(PLAYING_KEY); if (value === null) sessionStorage.removeItem(PLAYING_KEY); else sessionStorage.setItem(PLAYING_KEY, value); return null; });
  // this browser's id, kept: the server lets one character play from a browser at a time
  const device = storage(() => { let id = localStorage.getItem('tilequest.device'); if (!id) { id = [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem('tilequest.device', id); } return id; }) || '';
  function showLogin(message) {
    if (Gate.asking()) return Gate.refuse(message); // (the form is up: what went wrong said on it, as it was)
    Gate.ask({
      tab: 'create', message,
      note: 'One account for every device you play on.',
      onSubmit: ({ tab, name, password }) => {
        Gate.wait(tab === 'create' ? 'Creating your account…' : 'Logging in…');
        connect({ account: name, password, create: tab === 'create' });
      },
    });
  }
  // logged in: the character played before on this tab (a reload, a reconnect) straight away, else the character select
  function showCharacters(msg) {
    storage(() => localStorage.setItem(LOGIN_KEY, JSON.stringify({ account: msg.name, token: msg.token })));
    const again = playingNow();
    if (again && msg.characters.some(c => c.name.toLowerCase() === again.toLowerCase())) return send({ t: 'play', name: again, device });
    if (Net.online) return; // (a reconnect whose character is gone: nothing to show over the world)
    Gate.chooseCharacter({
      account: msg.name, characters: msg.characters, max: msg.max,
      onPlay: name => send({ t: 'play', name, device }),
      onCreate: name => send({ t: 'newchar', name, device }),
      onLogout: () => { forget(); playingNow(null); if (ws) { ws.onclose = null; ws.close(); } showLogin(); },
      onDelete: name => send({ t: 'delchar', name }),
    });
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
      if (!Net.online && !Gate.isOpen()) Gate.load('Connecting to the server…');
      Net.reconnecting = true;
      retry = setTimeout(() => connect(loginWith(saved)), 1000);
    };
  }
  // what's kept of a login, sent again (an older page kept a character's name: its account has that name)
  const loginWith = saved => ({ account: saved.account || saved.name, token: saved.token });

  function handle(msg) {
    if (msg.t === 'error' && msg.keep) return Gate.refuseCharacter(msg.message); // (at the character select: still logged in)
    if (msg.t === 'account') return showCharacters(msg);
    if (msg.t === 'error') {
      if (msg.relogin) playingNow(null);
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
    playingNow(msg.name);
    if (version && msg.version !== version) showUpdate();
    version = version || msg.version;
    // From now on, every action goes to the server.
    for (const name of Object.keys(Actions)) Actions[name] = (...args) => send({ t: 'act', a: name, args });
    $('create').hidden = true;
    Gate.close();
    $('mapSource').textContent = 'Playing online';
    $('newChar').textContent = 'Log out';
    if (msg.isNew) Intro.show({ name: player.name, onDone: () => newCharacterPath(newCharacterInWorld), skip: () => greetNewCharacter(() => newCharacterPath(newCharacterInWorld)) }); // (a new character: the opening and Sister Ama (who knows the name), its path; its outfit in the world)
    else welcome(false);
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

    monsters = s.monsters.map(m => ({ ...m, def: (m.rare && rareDef(m.type)) || MONSTERS[m.type], conditions: {}, dead: false })); // (rare kin: RARE_KIN)
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
    saveExplored, // (before a reload: see reloadForView in game.js)
    online: false,
    reconnecting: false,
    wanted,
    forget,
    leave: () => playingNow(null), // (logging out of a character: back to the character select)
    start(onReady) {
      ready = onReady;
      const saved = savedLogin();
      Gate.load().then(() => { if (saved) connect(loginWith(saved)); else showLogin(); }); // (logged in on this browser before: its characters)
    },
    clock: () => performance.now() + offset,
  };
})();
