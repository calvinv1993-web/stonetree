'use strict';
// What players can do (Actions) and the per-frame world update. No DOM here: the
// browser, the server and the tests all drive the game through these.

const DIR_KEYS = {
  arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1],
  arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0],
  q: [-1, -1], e: [1, -1], z: [-1, 1], c: [1, 1],
};

// One in-game hour passes per real minute; the world starts at 9:00.
const worldMinutes = () => ((now / 1000) + 9 * 60) % 1440;
function daylight() {
  const h = worldMinutes() / 60;
  if (h >= 7 && h < 19) return 1;
  if (h >= 21 || h < 5) return 0.25;
  return h < 7 ? 0.25 + ((h - 5) / 2) * 0.75 : 1 - ((h - 19) / 2) * 0.75;
}

// Every action a player can take, with plain-data arguments (ids, coordinates,
// item references) so the online client can send them to the server unchanged.
const Actions = {
  keyDown(key, repeat) {
    const inp = player.input;
    if (!DIR_KEYS[key]) return;
    player.follow = null; // walking yourself stops following
    if (player.target && !player.target.dead) player.chase = false; // manual movement stops automatic pursuit
    if (!inp.held.includes(key)) inp.held.push(key);
    if (!repeat) inp.queued = DIR_KEYS[key];
    player.path = [];
    player.action = null;
  },
  keyUp(key) {
    player.input.held = player.input.held.filter(k => k !== key);
  },
  releaseKeys,
  // Follow someone (a player, a monster or an NPC): one step behind them, wherever they go.
  follow(id) {
    if (player.ride) return;
    const c = creatureWithId(id);
    player.follow = c && c !== player ? c.id : null;
    player.path = [];
    player.action = null;
    if (c && c !== player) log(`You follow ${c.type === 'player' ? c.name : monsterRef(c)}.`);
  },
  walkTo(x, y, maxNodes) {
    if (player.ride || !Number.isInteger(x) || !Number.isInteger(y)) return;
    // A long way (clicked on the world map) costs the server a moment: not more than twice a second.
    if (maxNodes > 4000 && now < (player.longWalkAt || 0)) return;
    if (maxNodes > 4000) player.longWalkAt = now + 500;
    player.follow = null;
    if (player.target && !player.target.dead) player.chase = false; // tap-to-walk stops automatic pursuit
    walkTo(x, y, Math.min(maxNodes || 4000, 30000));
  },
  // kind: 'talk' (the NPC on that tile) or 'use' (whatever is there)
  interact(kind, x, y, z) {
    if (player.ride) return;
    const npc = kind === 'talk' && npcs.find(n => n.x === x && n.y === y && n.z === z);
    if (kind === 'talk' && !npc) return;
    interact({ kind, npc, x, y, z, range: kind === 'talk' ? TALK_RANGE : 1 });
  },
  setTarget(id) {
    const c = monsters.find(m => m.id === id && !m.dead) || players.find(p => p.id === id && p !== player && !p.dead);
    if (c && (inPZ() || inPZ(c))) { player.target = null; return log(NOT_IN_PZ); }
    const spared = c && c.type === 'player' && pvpAllowed(c) && !mayHurt(c);
    player.target = c && player.target !== c && !spared && (c.type !== 'player' || pvpAllowed(c)) ? c : null;
    if (spared) log(sameParty(player, c) ? 'They are in your party. Switch secure mode off to attack them anyway.' : 'Secure mode is on: switch it off to attack players without a skull.');
    else if (c && c.type === 'player' && !pvpAllowed(c)) log('You cannot attack this player here.');
  },
  targetNext,
  targetNearest,
  stop() {
    player.target = null;
    player.follow = null;
    player.path = [];
    player.openPile = null;
    player.action = null;
    closeShop();
  },
  say,
  castSpell,
  useItem,
  useItemOn,
  moveItem,
  unequip,
  takeFromPile,
  takeAll(pileId) {
    const pile = piles.find(p => p.id === pileId);
    if (pile) for (let i = pile.items.length - 1; i >= 0; i--) if (piles.includes(pile)) takeFromPile(pileId, i);
    if (pile && !pile.items.length && player.openPile === pile) { // all taken: close it
      player.openPile = null;
      uiDirty();
    }
  },
  closePile() {
    player.openPile = null;
    uiDirty();
  },
  buy,
  sell,
  closeShop,
  hotkey(k) {
    const pick = test => findInBag(it => test(ITEMS[it.id]));
    const ref = k === 'h' ? pick(d => d.use && d.use.heal) : k === 'm' ? pick(d => d.use && d.use.mana) : pick(d => d.use && d.use.food);
    if (ref) useItem(ref);
    else log(k === 'h' ? 'You have no health potions.' : k === 'm' ? 'You have no mana potions.' : 'You have nothing to eat.');
  },
  // F1-F12: { type: 'spell', id } | { type: 'item', id } | { type: 'rune', id } (on your target) | { type: 'say', text }
  useHotkey(key) {
    const h = player.hotkeys[key];
    if (!h) return log(`${key} has no hotkey yet. Set one up with the Hotkeys button.`);
    if (h.type === 'spell') return castSpell(h.id);
    if (h.type === 'say') return say(h.text);
    const ref = ITEMS[h.id] && findInBag(it => it.id === h.id);
    if (!ref) return log(`You have no ${ITEMS[h.id] ? ITEMS[h.id].name : 'such item'} left.`);
    if (h.type === 'rune') {
      const t = player.target;
      if (ITEMS[h.id].rune.kind === 'heal') return useItemOn(ref, player.x, player.y, player.z);
      if (!t) return log('You need a target for this rune.');
      return useItemOn(ref, t.x, t.y, t.z);
    }
    useItem(ref);
  },
  orderRide(x, y, kind) {
    orderRide(+x, +y, String(kind || 'cab'));
  },
  setFightMode(mode) {
    if (FIGHT_MODES[mode]) player.fightMode = mode;
    uiDirty();
  },
  setChase(on) {
    player.chase = !!on;
    uiDirty();
  },
  // Put the guide for new adventurers away (or, on its last step, finish it).
  endGuide() {
    player.tutorial = 0;
    uiDirty();
  },
  // Secure mode: on, you can't hurt players without a skull (nor your party); off, you can.
  setSecure(on) {
    player.secure = !!on;
    log(on ? 'Secure mode is on: you won\'t hurt players without a skull, nor your party.' : 'Secure mode is off: your attacks and area spells hurt any player around you (outside safe places).');
    uiDirty();
  },
  setOutfit(outfit) {
    const o = outfit || {};
    player.outfit = {};
    for (const part of ['hair', 'body', 'legs', 'feet']) if (/^#[0-9a-f]{6}$/i.test(o[part])) player.outfit[part] = o[part];
    if (OUTFITS[o.type]) player.outfit.type = o.type;
    if (o.female === true) player.outfit.female = true;
    const addons = (o.addons | 0) & allowedAddons(player.level); // addons come with levels
    if (addons) player.outfit.addons = addons;
    uiDirty();
  },
  // parties and guilds: see game-social.js
  partyInvite, partyRevoke, partyJoin, partyLeave, partyPassLeader, partyShareXp, partySay,
  guildCreate, guildInvite, guildRevoke, guildJoin, guildDecline, guildLeave, guildKick, guildSetRank,
  guildPassLeader, guildNick, guildRankTitles, guildMotd, guildDisband, guildSay,
  // the blacksmith's forge: see game-forge.js
  forgeItem, fuseOre,
  setHotkeys(hotkeys) {
    player.hotkeys = hotkeys || {};
  },
  setMarkers(markers) {
    player.markers = (Array.isArray(markers) ? markers : []).slice(0, MAX_MARKS)
      .filter(k => k && [k.x, k.y, k.z].every(Number.isInteger) && map.inBounds(k.x, k.y, k.z))
      .map(k => ({ x: k.x, y: k.y, z: k.z, icon: MARK_ICONS.includes(k.icon) ? k.icon : 'flag', label: String(k.label || '').slice(0, 60) }));
    uiDirty();
  },
};

function look(x, y, monster) {
  const z = player.z, c = monster || creatureAt(x, y, z);
  if (c && c.type === 'npc') return log(`You see ${c.name}.`, 'look');
  if (c && c.type === 'player') { // as in Tibia: name and level, vocation, guild, party
    const self = c === player, they = self ? 'You are' : 'They are', skull = skullOf(c, player);
    const guild = c.guildInfo !== undefined ? c.guildInfo : guildInfo(c), mark = c.partyMark !== undefined ? c.partyMark : partyMark(c, player);
    let text = `You see ${self ? 'yourself' : c.name} (Level ${c.level}). ${they} ${c.vocation === 'none' ? 'without a vocation' : withArticle(title(c))}.`;
    if (guild) text += ` ${they} ${guild.rank} of the ${guild.name}${guild.nick ? ` (${guild.nick})` : ''}.`;
    if (mark && /^(leader|member)/.test(mark)) text += self ? '' : mark.startsWith('leader') ? ' They lead your party.' : ' They are in your party.';
    if (skull) text += ` ${self ? 'You have' : 'They have'} a ${skull} skull.`;
    return log(text, 'look');
  }
  if (c) return log(`You see ${monsterRef(c)}. It has ${c.hp} of ${c.maxHp} hitpoints.`, 'look');
  const pile = pileAt(x, y, z);
  if (pile) return log(`You see ${pile.name ? withArticle(pile.name) : itemName(pile.items[0].id, pile.items[0].count)}.`, 'look');
  const f = fieldAt(x, y, z);
  if (f) return log(`You see ${withArticle(FIELDS[f.kind].name)}.`, 'look');
  const t = map.get(x, y, z);
  const id = t && (topItem(t) || t.ground);
  const house = map.houseAt(x, y, z), meta = map.getMeta(x, y, z);
  let extra = house && t && t.items.some(i => THINGS[i].houseDoor) ? ` It belongs to ${house.name}${house.owner ? `, rented by ${house.owner}` : ', which is for rent'}.` : '';
  if (meta && meta.look && id && !THINGS[id].ground) extra += ` ${meta.look}`; // an inscription, say
  log(id ? `You see ${withArticle(THINGS[id].name)}.${extra}` : 'You see nothing special.', 'look');
}

// ---- walking and interacting ------------------------------------------------------------
function playerPassable(goalX, goalY) {
  return (x, y) => {
    if (creatureAt(x, y, player.z) && !(x === player.x && y === player.y)) return false;
    if (!playerCanEnter(x, y, player.z)) return false;
    return (x === goalX && y === goalY) || !map.floorChange(x, y, player.z);
  };
}

// Walking somewhere takes the quickest way, not the shortest: roads over grass, round the swamp.
const quickGround = (x, y) => groundSlowness((map.get(x, y, player.z) || {}).ground);

function walkTo(x, y, maxNodes = 4000) {
  player.action = null;
  if (x === player.x && y === player.y) return;
  const passable = playerPassable(x, y);
  // Prefer cardinal-only routes for tap-to-walk; allow diagonals only when unavoidable.
  const path = playerCanEnter(x, y, player.z) && (
    findPath(passable, player.x, player.y, x, y, { maxNodes, stepCost: quickGround, orthogonalOnly: true }) ||
    findPath(passable, player.x, player.y, x, y, { maxNodes, stepCost: quickGround })
  );
  if (path) {
    player.path = path;
    player.pathGoal = { x, y, range: 0 };
  } else {
    player.path = [];
    log('There is no way.');
  }
}

// Walk until within `range` of the spot, then talk / use.
function interact(action) {
  player.action = action;
  player.path = [];
  if (dist(player, action) <= action.range) return;
  const path = findPath(playerPassable(action.x, action.y), player.x, player.y, action.x, action.y, { range: action.range, stepCost: quickGround });
  if (!path) {
    player.action = null;
    return log('There is no way.');
  }
  player.path = path;
  player.pathGoal = { x: action.x, y: action.y, range: action.range };
}

function performAction() {
  const a = player.action;
  player.action = null;
  player.path = [];
  if (a.kind === 'talk') {
    logDialog(player.name, 'hi', true);
    startConversation(a.npc);
  } else if (!useThing(a.x, a.y, a.z)) {
    log('You cannot use this.');
  }
}

function followPath() {
  const [nx, ny] = player.path[0];
  if (Math.max(Math.abs(nx - player.x), Math.abs(ny - player.y)) > 1) return void (player.path = []); // not from here
  if (step(player, nx - player.x, ny - player.y)) {
    player.path.shift();
    return;
  }
  // Something is in the way (or a door just opened): plan again.
  const g = player.pathGoal;
  player.path = (g && findPath(playerPassable(g.x, g.y), player.x, player.y, g.x, g.y, { range: g.range, stepCost: quickGround })) || [];
}

function chase() {
  if (now < player.nextChase) return;
  const t = player.target;
  const path = findPath((x, y) => isFreeNoStairs(x, y, player.z), player.x, player.y, t.x, t.y, { adjacent: true, maxNodes: 1500 });
  if (path && path.length) step(player, path[0][0] - player.x, path[0][1] - player.y);
  else player.nextChase = now + 400;
}

const creatureWithId = id => players.find(p => p.id === id) || monsters.find(m => m.id === id && !m.dead) || npcs.find(n => n.id === id) || null;

// Following: keep one step behind them. Lose them (another floor, too far, dead) and you stop.
function followCreature() {
  const c = creatureWithId(player.follow);
  if (!c || c.dead || c.z !== player.z || dist(c, player) > 12) {
    player.follow = null;
    return log('You lost track of them.');
  }
  if (dist(c, player) <= 1 || now < player.nextChase) return;
  const path = findPath((x, y) => isFreeNoStairs(x, y, player.z), player.x, player.y, c.x, c.y, { adjacent: true, maxNodes: 1500, stepCost: quickGround });
  if (path && path.length) step(player, path[0][0] - player.x, path[0][1] - player.y);
  else player.nextChase = now + 400;
}

// Attack the closest monster (never a player); again: the next closest.
function targetNearest() {
  if (inPZ()) return log(NOT_IN_PZ);
  const near = monsters
    .filter(m => !m.dead && m.z === player.z && dist(m, player) <= 7 && canSee(m))
    .sort((a, b) => dist(a, player) - dist(b, player));
  if (!near.length) return log('There is no monster nearby.');
  player.target = near[0] !== player.target ? near[0] : near[1] || near[0];
}

function targetNext() {
  if (inPZ()) return log(NOT_IN_PZ);
  const near = monsters
    .filter(m => !m.dead && m.z === player.z && dist(m, player) <= 7 && canSee(m))
    .sort((a, b) => dist(a, player) - dist(b, player));
  player.target = near.length ? near[(near.indexOf(player.target) + 1) % near.length] : null;
}

function updatePlayer() {
  if (player.dead) {
    if (now >= player.respawnAt) respawnPlayer();
    return;
  }
  if (player.teleportAt && now >= player.teleportAt) arriveOnMainland();
  updateGuide();
  tickConditions(player);
  if (player.dead) return;
  if (player.skullUntil && now >= player.skullUntil) {
    player.skullUntil = 0;
    log('Your white skull has faded. You can enter temples again.', 'quest');
  }
  if (player.redSkullUntil && now >= player.redSkullUntil) {
    player.redSkullUntil = 0;
    log('Your red skull has faded.', 'quest');
  }
  if (player.ride) return updateRide();

  const walked = finishWalk(player);
  if (walked) {
    const change = map.floorChange(player.x, player.y, player.z);
    const t = map.get(player.x, player.y, player.z), meta = map.getMeta(player.x, player.y, player.z);
    if (change) changeFloor(change, player.x - walked.fromX, player.y - walked.fromY);
    else if (t && meta && meta.to && t.items.some(id => THINGS[id].teleport)) {
      teleport(meta.to);
      addSparkle(player, '#c58cff');
      addSound('magic', player.x, player.y, player.z);
    }
  }

  if (!player.walk) {
    const inp = player.input, tapped = inp.queued;
    const dir = tapped || (inp.held.length ? DIR_KEYS[inp.held[inp.held.length - 1]] : null);
    inp.queued = null;
    const a = player.action;
    if (dir) {
      if (!step(player, dir[0], dir[1]) && tapped && now - player.lastNotPossible > 800) {
        player.lastNotPossible = now;
        log('Sorry, not possible.');
      }
    } else if (a && a.z === player.z && dist(player, a) <= a.range) {
      performAction();
    } else if (player.path.length) {
      followPath();
    } else if (a) {
      player.action = null; // couldn't get there
    } else if (player.target && player.chase && !inAttackRange(playerWeapon(), player.target)) {
      chase();
    } else if (player.follow) {
      followCreature();
    }
  }
  playerCombat();
  regenerate();
  updateConversation();
  const p = player.openPile;
  if (p && (!piles.includes(p) || p.z !== player.z || dist(p, player) > 1)) {
    player.openPile = null;
    uiDirty();
  }
}

// Easter egg: now and then, while someone is in the Webwood, an old flying car
// races through with two boys in it, screaming and shooting sparks back at the
// giant spiders chasing them.
const FLYBY_TIME = 7000;
let flybyAt = 0, flybyPending = 0;
function updateFlyby() {
  if (typeof WEBWOOD === 'undefined' || now < flybyAt) return;
  const inWood = p => !p.dead && p.z === WEBWOOD.z && p.x >= WEBWOOD.x0 && p.x <= WEBWOOD.x1 && p.y >= WEBWOOD.y0 && p.y <= WEBWOOD.y1;
  const p = players.find(inWood);
  if (!p) return void (flybyPending = 0);
  if (!flybyPending) return void (flybyPending = now + 3000 + Math.random() * 12000);
  if (now < flybyPending) return;
  flybyPending = 0;
  flybyAt = now + 4 * 60000 + Math.random() * 4 * 60000;
  const dir = Math.random() < 0.5 ? 1 : -1;
  effects.push({ kind: 'flyby', x: p.x, y: p.y - 2, z: p.z, fx: p.x - dir * 12, tx: p.x + dir * 12, start: now, dur: FLYBY_TIME });
  for (const o of players.filter(inWood)) asPlayer(o, () => log('What was that?! An old flying car just raced through the trees, chased by giant spiders!', 'quest'));
}

function updateWorld() {
  walkInsLeft = 2;
  for (const p of players) asPlayer(p, updatePlayer);
  monsters.forEach(updateMonster);
  monsters = monsters.filter(m => !m.remove);
  updateNpcs();
  updateParties();
  updateFields();
  updateReverts();
  updateRaids();
  updateFlyby();
  for (let i = piles.length - 1; i >= 0; i--) if (!piles[i].house && now >= piles[i].until) removePile(piles[i]);
  for (let i = effects.length - 1; i >= 0; i--) if (now > effects[i].start + effects[i].dur) effects.splice(i, 1);
}
