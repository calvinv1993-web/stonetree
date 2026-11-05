'use strict';
// Fighting: weapons, spells, runes, conditions, fields, monster AI, loot, death and raids.

const ATTACK_SPEED = 1000;        // ms between the player's weapon attacks
const SPELL_COOLDOWN = 1000;
const CORPSE_TIME = 90000;
const RESPAWN_TIME = 60000;
const DEATH_XP_LOSS = 0.1; // of all your experience
// Skulls, as in Tibia (see markAggression)
const SKULL_TIME = 3 * 60000;     // a white skull fades this long after you last attacked an innocent player
const PZ_LOCK = 60000;            // after attacking any player, no temples for a minute
const RED_SKULL_TIME = 6 * 3600000;
const FRAG_LIMITS = [[3, 24 * 3600000], [6, 7 * 24 * 3600000]]; // unjustified kills within a day, a week -> red skull       // ms before a killed monster can come back (unless it says otherwise)
// How hard you hit and how well you block in each fight mode, as in Tibia (full attack 1, balanced 0.75, defensive 0.5).
const FIGHT_MODES = { offensive: { attack: 1, defense: 0.6 }, balanced: { attack: 0.75, defense: 1 }, defensive: { attack: 0.5, defense: 1.4 } };
let nextRaidAt = 0;

// ---- visual effects and sounds (drawn and played by the browser) ---------------------
function addText(c, text, color) {
  const v = visual(c);
  effects.push({ kind: 'text', x: v.x, y: v.y, z: c.z, text, color, start: now, dur: 1000 });
}
// Text above a creature's head. With `says` it reads "Name says:" in yellow, like
// talk; without, it's orange, like spell words. `viewer`: only that player sees it.
function addSpeech(c, text, says, viewer) {
  effects.push({ kind: 'speech', cid: c.id, x: c.x, y: c.y, z: c.z, text, name: says ? c.name : undefined, viewer, start: now, dur: 2500 + text.length * 50 });
}
// A flash around whoever just attacked the current player, so they see where a hit came from.
function addAttacker(c) {
  effects.push({ kind: 'attacker', cid: c.id, x: c.x, y: c.y, z: c.z, viewer: player.id, start: now, dur: 700 });
}
// Whether player p gets to see an effect (some are meant for one player only).
function forViewer(fx, p) {
  return !fx.viewer || fx.viewer === p.id;
}
function addBurst(x, y, z, color) {
  effects.push({ kind: 'burst', x, y, z, color, start: now, dur: 350 });
}
function addSparkle(c, color) {
  effects.push({ kind: 'sparkle', cid: c.id, x: c.x, y: c.y, z: c.z, color, start: now, dur: 700 });
}
function addMissile(from, to, style) {
  effects.push({ kind: 'missile', fx: from.x, fy: from.y, tx: to.x, ty: to.y, z: from.z, style, start: now, dur: 80 + dist(from, to) * 45 });
  addSound(['arrow', 'bolt', 'spear', 'boulder'].includes(style) ? 'shoot' : 'magic', from.x, from.y, from.z);
}
function addSound(name, x, y, z) {
  effects.push({ kind: 'sound', name, x, y, z, start: now, dur: 300 });
}

// ---- the player's weapon ---------------------------------------------------------------
// What the player attacks with right now: melee, distance (bow/spear) or magic (wand/rod).
function playerWeapon() {
  const eq = player.equipment, item = eq.weapon, w = item && ITEMS[item.id].weapon;
  if (!w) return { kind: 'melee', skill: 'fist', attack: 6 };
  const q = item.q || 0; // a forged weapon hits harder
  if (w.type === 'wand') return { kind: 'magic', range: w.range, dmg: wandDamage(w, q), mana: w.mana, element: w.element };
  if (w.type === 'distance') {
    if (w.thrown) return { kind: 'distance', skill: 'distance', attack: qualityStat(w.attack, q), range: w.range, thrown: w, missile: 'spear' };
    const ammo = eq.ammo && ITEMS[eq.ammo.id].ammo;
    if (!ammo || ammo.type !== w.ammo) return { kind: 'distance', range: w.range, noAmmo: w.ammo };
    return { kind: 'distance', skill: 'distance', attack: qualityStat(w.attack, q) + ammo.attack, range: w.range, missile: w.ammo };
  }
  return { kind: 'melee', skill: w.type, attack: qualityStat(w.attack, q) };
}

const fightMode = () => FIGHT_MODES[player.fightMode] || FIGHT_MODES.balanced;
// A weapon hit, as in Tibia: at most 0.085 x fight mode x attack x skill + level / 5, at least level / 5, most hits
// round the middle (the mean of two rolls), so the big ones are rare. The skill counts most; the level only a little.
const physicalMax = w => Math.floor(0.085 * fightMode().attack * w.attack * player.skills[w.skill].level + player.level / 5);
const physicalHit = w => {
  const min = Math.floor(player.level / 5), max = Math.max(min, physicalMax(w));
  return Math.round(min + (max - min) * (Math.random() + Math.random()) / 2);
};
// What a monster's defense blocks of a weapon hit (half its defense to all of it), as in Tibia: with its armor
// (in damageMonster) this can block a hit completely, and a weak hit often is.
const blocked = t => (t.def && t.def.defense ? randInt(Math.floor(t.def.defense / 2), t.def.defense) : 0);
const inAttackRange = (w, t) => (w.kind === 'melee' ? inMelee(player, t) : t.z === player.z && dist(player, t) <= w.range && sightClear(player, t));
const canSee = c => !(c.def && c.def.invisible) || dist(c, player) <= 1;

function warn(text) {
  if (now - player.lastWarning < 2000) return;
  player.lastWarning = now;
  log(text);
}

// No fighting between players on the starter island, in temples, or with players without a vocation.
function pvpAllowed(victim) {
  if (victim.dead || player.vocation === 'none' || victim.vocation === 'none') return false;
  const safe = p => onIsle(p) || map.isProtected(p.x, p.y, p.z);
  return !safe(player) && !safe(victim);
}

// Damage a creature: a monster, or (player versus player) another player.
// ---- skulls -----------------------------------------------------------------------------
// Attacking an innocent player (no skull, and not someone who attacked you while
// you had one) gives you a white skull. Attacking someone who has a skull gives
// you a yellow skull, which only they see: they may fight you back. Killing an
// innocent is an unjustified kill; too many of those earn a red skull, and dying
// with a red skull costs you everything you carry. Anyone may attack a skull.
const hasSkull = p => p.skullUntil > now || p.redSkullUntil > now;
const innocentTo = (victim, attacker) => !hasSkull(victim) && !((victim.yellowTo || {})[attacker.id] > now);

// The skull `viewer` sees on c: 'red', 'white', 'yellow' (only to the one they attacked) or null.
function skullOf(c, viewer) {
  if (c.redSkullUntil > now) return 'red';
  if (c.skullUntil > now) return 'white';
  if (viewer && c !== viewer && (c.yellow || (c.yellowTo && c.yellowTo[viewer.id] > now))) return 'yellow';
  return null;
}

function markAggression(attacker, victim) {
  attacker.pzLockUntil = now + PZ_LOCK;
  if (innocentTo(victim, attacker)) attacker.skullUntil = now + SKULL_TIME;
  else if (hasSkull(victim) && !hasSkull(attacker)) (attacker.yellowTo = attacker.yellowTo || {})[victim.id] = now + SKULL_TIME;
}

function unjustifiedKill(killer) {
  killer.frags = (killer.frags || []).filter(t => now - t < FRAG_LIMITS[FRAG_LIMITS.length - 1][1]);
  killer.frags.push(now);
  const red = FRAG_LIMITS.some(([n, ms]) => killer.frags.filter(t => now - t < ms).length >= n);
  if (red) killer.redSkullUntil = now + RED_SKULL_TIME;
  asPlayer(killer, () => log(red
    ? 'You killed too many innocent players: you have a RED SKULL now. Anyone may kill you, and you will lose everything you carry when you die.'
    : `That was an unjustified kill (${killer.frags.filter(t => now - t < FRAG_LIMITS[0][1]).length} today; ${FRAG_LIMITS[0][0]} in a day gives a red skull).`, 'damage'));
}

// Secure mode (on unless you switch it off, as in Tibia): your attacks, area spells
// too, only hurt players with a skull - and never your party. Off, they hurt anyone.
const mayHurt = c => !player.secure || (!innocentTo(c, player) && !sameParty(player, c));

// Protection zones (temples, depots), as in Tibia: no fighting in them at all - no attacks,
// no attack spells or runes from inside, and none thrown in from outside.
const inPZ = (o = player) => map.isProtected(o.x, o.y, o.z);
const NOT_IN_PZ = 'This action is not permitted in a protection zone.';
const AGGRESSIVE = ['bolt', 'strike', 'wave', 'beam', 'area', 'whirl', 'selfdestruct'];

function hurt(target, dmg, element) {
  if (target.type === 'player') {
    if (!pvpAllowed(target) || !mayHurt(target)) return;
    markAggression(player, target);
    const attacker = player;
    asPlayer(target, () => damagePlayer(attacker, dmg, element));
  } else {
    damageMonster(target, dmg, element);
  }
}

function playerCombat() {
  const t = player.target;
  if (!t) return;
  if (t.dead || t.z !== player.z || dist(t, player) > 9 || (t.type === 'player' && (!pvpAllowed(t) || !mayHurt(t)))) {
    player.target = null;
    if (!t.dead) log('Target lost.');
    return;
  }
  if (now - player.lastAttack < ATTACK_SPEED) return;
  if (inPZ() || inPZ(t)) return; // nobody fights in a protection zone
  const w = playerWeapon();
  if (!inAttackRange(w, t)) return;
  if (w.noAmmo) return warn(`You need ${w.noAmmo}s in your ammo slot.`);
  if (w.kind === 'magic' && player.mana < w.mana) return warn('You do not have enough mana.');
  player.lastAttack = now;
  if (!player.walk) player.dir = dirTo(t.x - player.x, t.y - player.y);

  if (w.kind === 'melee') {
    addSkillTries(w.skill);
    addSound('hit', t.x, t.y, t.z);
    hurt(t, physicalHit(w) - blocked(t), 'physical');
  } else if (w.kind === 'distance') {
    useAmmo(w);
    addMissile(player, t, w.missile);
    addSkillTries('distance');
    const hitChance = Math.min(0.95, 0.6 + player.skills.distance.level / 150);
    if (Math.random() < hitChance) hurt(t, physicalHit(w) - blocked(t), 'physical');
    else addBurst(t.x, t.y, t.z, '#9cf');
  } else {
    player.mana -= w.mana;
    addSkillTries('magic', w.mana);
    addMissile(player, t, w.element);
    hurt(t, Math.round(randInt(...w.dmg) * (1 + player.skills.magic.level * 0.03) * fightMode().attack / FIGHT_MODES.balanced.attack), w.element);
  }
}

function useAmmo(w) {
  const eq = player.equipment;
  if (w.thrown) {
    if (Math.random() >= w.thrown.breakChance) return;
    if (--eq.weapon.count <= 0) eq.weapon = null;
  } else if (--eq.ammo.count <= 0) {
    eq.ammo = null;
  }
  uiDirty();
}

// ---- damage ----------------------------------------------------------------------------
// The current player hurts a monster (also used for conditions and fields the player caused).
function damageMonster(m, dmg, element) {
  if (m.dead) return;
  const immune = m.def.immune || [];
  if (immune.includes(element)) {
    addBurst(m.x, m.y, m.z, '#9cf');
    return;
  }
  const before = dmg; // what got past its defense (see blocked)
  if (element === 'physical' && m.def.armor) dmg -= randInt(Math.floor(m.def.armor * 0.475), Math.floor(m.def.armor * 0.95)); // armor, as in Tibia
  dmg = Math.round(dmg * ((m.def.weak && m.def.weak[element]) || 1));
  m.angryAt = player.id;
  m.angryUntil = now + 15000; // whatever hits a monster gets hunted, even from afar
  player.foughtAt = now; // for the party's shared experience
  if (dmg <= 0) { // blocked: a blue puff where its defense stopped it, a grey spark where its armor did
    addBurst(m.x, m.y, m.z, before > 0 ? '#b8b8b8' : '#9cf');
    return;
  }
  m.hits = m.hits || {}; // who did how much, and when, to share the experience
  const hit = m.hits[player.id] || (m.hits[player.id] = { dmg: 0, at: 0 });
  hit.dmg += Math.min(dmg, m.hp);
  hit.at = now;
  m.hp = Math.max(0, m.hp - dmg);
  addText(m, String(dmg), '#ffffff');
  addBurst(m.x, m.y, m.z, ELEMENT_COLORS[element]);
  if (m.hp === 0) killMonster(m);
}

// The current player is hurt by attacker (a monster, a player, or null for a condition).
// source: who is to blame if this kills (the player whose field or spell it was, for a condition).
function damagePlayer(attacker, dmg, element, cause, source = attacker) {
  if (player.dead) return;
  if (attacker && attacker.type !== 'player' && map.isShelter(player.x, player.y, player.z)) return; // monsters can't reach you in there
  if (attacker && attacker !== player) addAttacker(attacker);
  if (attacker && attacker.type !== 'player') player.foughtAt = now; // blocking counts as fighting
  const eq = player.equipment;
  if (element === 'physical' && attacker) {
    // A shield (or a melee weapon, without a shield) blocks part of physical hits.
    const shield = eq.shield && ITEMS[eq.shield.id];
    const defense = (shield ? qualityStat(shield.defense, eq.shield.q) : (eq.weapon && qualityStat(ITEMS[eq.weapon.id].defense, eq.weapon.q)) || 0) * fightMode().defense;
    if (shield) addSkillTries('shielding');
    dmg -= randInt(0, Math.floor((defense * (player.skills.shielding.level + 10)) / 80));
  }
  if (attacker) {
    const armor = totalArmor();
    dmg -= randInt(Math.floor(armor / 4), Math.floor(armor / 2));
  }
  if (dmg <= 0) {
    addBurst(player.x, player.y, player.z, '#9cf');
    return;
  }
  if (player.conditions.shield) { // magic shield: mana takes the hit first
    const absorbed = Math.min(player.mana, dmg);
    player.mana -= absorbed;
    dmg -= absorbed;
    if (absorbed) addText(player, String(absorbed), '#6080ff');
    if (!dmg) return;
  }
  player.hp = Math.max(0, player.hp - dmg);
  addText(player, String(dmg), '#ff5050');
  addBurst(player.x, player.y, player.z, ELEMENT_COLORS[element] || '#d83030');
  addSound('hurt', player.x, player.y, player.z);
  const by = attacker ? `an attack by ${monsterRef(attacker)}` : CONDITIONS[cause] ? `being ${CONDITIONS[cause].name}` : element;
  log(`You lose ${dmg} hitpoint${dmg === 1 ? '' : 's'} due to ${by}.`, 'damage');
  if (player.hp === 0) playerDies(source);
}

// Take the quest items out of a list of items (and the bags in it), and return them.
function takeQuestItems(items) {
  const kept = [];
  for (let i = items.length - 1; i >= 0; i--) {
    if (ITEMS[items[i].id].quest) kept.push(...items.splice(i, 1));
    else if (items[i].contents) kept.push(...takeQuestItems(items[i].contents));
  }
  return kept;
}

function rollLoot(loot) {
  const items = [];
  if (loot.gold) {
    const n = randInt(...loot.gold);
    if (n) items.push(makeItem('gold', n));
  }
  for (const [id, chance, min = 1, max = min] of loot.items || []) {
    if (ITEMS[id] && Math.random() < chance) items.push(makeItem(id, randInt(min, max)));
  }
  return items;
}

// Hunting together: the more players around, the sooner monsters come back (with three, twice as fast).
function respawnDelay(m) {
  const hunters = players.filter(p => !p.dead && p.z === m.z && dist(p, m) <= 15).length;
  return (m.def.respawn || RESPAWN_TIME) / (1 + 0.5 * Math.max(0, hunters - 1));
}

function killMonster(m) {
  Object.assign(m, { dead: true, respawnAt: now + respawnDelay(m), due: 0, walk: null, conditions: {} });
  if (m.def.comesBack) {
    effects.push({ kind: 'speech', x: m.x, y: m.y, z: m.z, name: 'Someone', text: 'Oh my god, they killed Kenny!', start: now, dur: 3500 });
    m.diedAt = { x: m.x, y: m.y, z: m.z, by: player.id };
  }
  const items = rollLoot(m.def.loot || {});
  forgeLoot(m.def, items); // better gear now and then, and ore for the smith
  const old = pileAt(m.x, m.y, m.z);
  if (old && !old.corpse) { // dropped items end up in the corpse
    items.push(...old.items);
    removePile(old);
  }
  const corpse = m.def.corpse === 'none' ? null : m.def.corpse || 'blood';
  if (corpse || items.length) piles.push({ id: newId(), x: m.x, y: m.y, z: m.z, items, corpse, name: `dead ${m.name}`, until: now + CORPSE_TIME });
  for (const p of players) if (p.target === m) p.target = null;
  addSound('death', m.x, m.y, m.z);
  const loot = items.map(i => (i.id === 'gold' ? `${i.count} gold` : itemName(i.id, i.count, i.q)));
  log(`Loot of ${monsterRef(m)}: ${loot.join(', ') || 'nothing'}.`);
  // Everyone who hurt it - lately, and still around - gets experience by the damage they
  // did, and the kill for their quests. A party sharing its experience puts what its
  // members earned in one pot, adds its bonus, and splits it evenly among all of them.
  const hunters = Object.entries(m.hits || {})
    .map(([id, h]) => [players.find(p => String(p.id) === id), h.dmg])
    .filter(([p]) => p && !p.dead && p.z === m.z && dist(p, m) <= 15 && now - m.hits[p.id].at < 60000);
  if (!hunters.some(([p]) => p === player)) hunters.push([player, 0]);
  const total = hunters.reduce((sum, [, d]) => sum + d, 0) || 1;
  const gains = new Map(), pots = new Map(), shared = new Set();
  for (const [p, d] of hunters) {
    const xp = hunters.length === 1 ? m.def.xp : (m.def.xp * d) / total, party = partyOf(p);
    if (party && partyShare(party).active) pots.set(party, (pots.get(party) || 0) + xp);
    else gains.set(p, (gains.get(p) || 0) + xp);
  }
  for (const [party, xp] of pots) {
    const members = party.members.map(playerById).filter(p => p && !p.dead);
    for (const p of members) {
      gains.set(p, (gains.get(p) || 0) + (xp * (1 + partyShare(party).bonus)) / members.length);
      shared.add(p);
    }
  }
  for (const [p, xp] of gains) {
    asPlayer(p, () => {
      if (Math.round(xp) > 0) gainXp(Math.round(xp), shared.has(p));
      onMonsterKilled(m.type);
      guideDid('kill');
      taleDeed('kill', m.type);
    });
  }
  m.hits = null;
}

function playerDies(killer) {
  if (killer && killer.type === 'player' && killer !== player && innocentTo(player, killer)) unjustifiedKill(killer);
  const red = player.redSkullUntil > now; // nothing protects you then
  Object.assign(player, { skullUntil: 0, pzLockUntil: 0, yellowTo: {} }); // death wipes the white slate clean, and ends the fight (not a red skull)
  const eq = player.equipment;
  const protection = red ? null : player.vocation === 'none' ? 'starter' : player.blessed ? 'blessing'
    : eq.neck && ITEMS[eq.neck.id].keeping ? 'amulet' : null;
  // As in Tibia, death costs a tenth of all your experience (a blessing spares 30% of that, and before a vocation
  // you lose only half), so it can cost levels too - and the health and mana they gave you.
  player.xp = Math.max(player.xp, xpForLevel(player.level));
  const lost = Math.floor(player.xp * DEATH_XP_LOSS * (protection === 'blessing' ? 0.7 : protection === 'starter' ? 0.5 : 1));
  const xpBefore = player.xp, levelBefore = player.level;
  player.xp = Math.max(0, player.xp - lost);
  while (player.level > 1 && player.xp < xpForLevel(player.level)) {
    const v = VOCATIONS[player.level <= 10 ? 'none' : player.vocation] || VOCATIONS.none; // levels up to 10 come before a vocation
    player.maxHp = Math.max(1, player.maxHp - v.hp);
    player.maxMana = Math.max(0, player.maxMana - v.mana);
    player.level--;
  }
  player.mana = Math.min(player.mana, player.maxMana);
  player.hp = Math.min(player.hp, player.maxHp);
  const dropped = [];
  if (!protection) {
    dropped.push(...bag().contents.splice(0));
    bag().contents.push(...takeQuestItems(dropped)); // what a quest needs is never lost
    for (const slot of SLOTS) if (slot !== 'backpack' && eq[slot] && !ITEMS[eq[slot].id].quest && (red || Math.random() < 0.1)) { dropped.push(eq[slot]); eq[slot] = null; }
  }
  if (protection === 'blessing') player.blessed = false;
  if (protection === 'amulet') eq.neck = null;
  piles.push({ id: newId(), x: player.x, y: player.y, z: player.z, items: dropped, corpse: 'blood', name: `dead ${player.name}`, until: now + 10 * 60000 });
  Object.assign(player, { dead: true, respawnAt: now + 3000, walk: null, path: [], action: null, target: null, openPile: null, conditions: {}, ride: null });
  for (const p of players) if (p.target === player) p.target = null;
  endConversation(true);
  log(`You are dead${killer ? `, killed by ${monsterRef(killer)}` : ''}. You lost ${xpBefore - player.xp} experience.`, 'damage');
  if (player.level < levelBefore) log(`You were downgraded from Level ${levelBefore} to Level ${player.level}.`, 'damage');
  if (protection === 'blessing') log('Your blessing protected your things.', 'quest');
  else if (protection === 'amulet') log('Your amulet of keeping crumbled, but saved your things.', 'quest');
  else if (red) log('With your red skull, everything you carried is lying in your corpse.', 'damage');
  else if (dropped.length) log('Your things are lying in your corpse. Hurry back to get them!', 'damage');
  addSound('death', player.x, player.y, player.z);
  uiDirty();
}

function respawnPlayer() {
  teleport(homePos());
  Object.assign(player, { dead: false, hp: player.maxHp, mana: player.maxMana });
  log(`You wake up in the temple of ${homeTown()}.`);
  uiDirty();
}

function regenerate() {
  const ring = player.equipment.ring, ringDef = ring && ITEMS[ring.id].ring;
  if (ringDef) {
    ring.time -= now - (player.ringTick || now);
    if (ring.time <= 0) {
      player.equipment.ring = null;
      log(`Your ${ITEMS[ring.id].name} has run out.`);
      uiDirty();
    }
  }
  player.ringTick = now;
  if (now < player.nextRegen) return;
  const fed = now < player.fedUntil;
  player.nextRegen = now + (fed ? 1000 : 4000);
  const [hp, mana] = VOCATIONS[player.vocation].regen;
  const bonus = Math.floor(player.level / 10), promo = player.promoted ? 1.5 : 1;
  const extra = ringDef && ringDef.regen && ring.time > 0 ? ringDef.regen : [0, 0];
  player.hp = Math.min(player.maxHp, player.hp + (fed ? Math.ceil((hp + bonus) * promo) : 1) + extra[0]);
  player.mana = Math.min(player.maxMana, player.mana + (fed ? Math.ceil((mana + bonus) * promo) : 1) + extra[1]);
}

// ---- conditions and fields --------------------------------------------------------------
function applyCondition(c, kind, power = 1, cause = null) {
  if (c.dead || (c.def && (c.def.immune || []).includes(kind))) return;
  const def = CONDITIONS[kind];
  const cur = c.conditions[kind] || {};
  if (def.interval) {
    c.conditions[kind] = { power: Math.max(cur.power || 0, power), ticks: def.ticks || null, next: cur.next || now + def.interval, by: cause };
  } else {
    c.conditions[kind] = { until: now + def.duration * power };
  }
  if (c.type === 'player') {
    asPlayer(c, () => uiDirty());
    if (kind !== 'haste' && kind !== 'shield') asPlayer(c, () => log(`You are ${def.name}.`));
  }
}

function tickConditions(c) {
  for (const [kind, st] of Object.entries(c.conditions || {})) {
    const def = CONDITIONS[kind];
    if (st.until !== undefined) {
      if (now >= st.until) {
        delete c.conditions[kind];
        if (c.type === 'player') asPlayer(c, () => uiDirty());
      }
      continue;
    }
    if (now < st.next) continue;
    st.next = now + def.interval;
    const power = st.power, by = playerById(st.by);
    if (def.decay) st.power--;
    if (st.ticks !== null && --st.ticks <= 0) st.power = 0;
    if (c.type === 'player') asPlayer(c, () => damagePlayer(null, power, def.element, kind, by));
    else if (by) asPlayer(by, () => damageMonster(c, power, def.element)); // whoever did it gets the credit
    else st.power = 0; // they are gone: it burns out
    if (st.power <= 0 && c.conditions[kind] === st) {
      delete c.conditions[kind];
      if (c.type === 'player') asPlayer(c, () => uiDirty());
    }
  }
}

function createField(kind, x, y, z, owner) {
  const old = fields.findIndex(f => f.x === x && f.y === y && f.z === z);
  if (old >= 0) fields.splice(old, 1);
  fields.push({ x, y, z, kind, until: now + FIELDS[kind].duration, owner });
}

// Whoever stands in a field gets its condition, at most once a second.
function updateFields() {
  for (let i = fields.length - 1; i >= 0; i--) if (now >= fields[i].until) fields.splice(i, 1);
  const creatures = [...players.filter(p => !p.dead), ...monsters.filter(m => !m.dead)];
  for (const c of creatures) {
    const f = fieldAt(c.x, c.y, c.z), def = f && FIELDS[f.kind];
    if (!def || !def.condition || now < (c.fieldHitAt || 0)) continue;
    const owner = c.type === 'player' && playerById(f.owner);
    if (owner && owner !== c) { // another player's field: only where, and whom, they may hurt
      if (!asPlayer(owner, () => pvpAllowed(c) && mayHurt(c))) continue;
      markAggression(owner, c);
    }
    c.fieldHitAt = now + 1000;
    applyCondition(c, def.condition, def.power, f.owner);
  }
}

// ---- spells and runes -------------------------------------------------------------------
const knowsSpell = id => spellsFor(player.vocation).includes(id) && player.level >= SPELLS[id].level && (!SPELLS[id].promoted || player.promoted);

// Tiles in front of the player: a cone (wave) or a straight line (beam).
function shapeTiles(kind, length = 5) {
  const dx = DX[player.dir], dy = DY[player.dir], tiles = [];
  if (kind === 'beam') for (let i = 1; i <= length; i++) tiles.push([player.x + dx * i, player.y + dy * i]);
  else [0, 1, 1, 2].forEach((half, i) => {
    for (let w = -half; w <= half; w++) tiles.push([player.x + dx * (i + 1) - dy * w, player.y + dy * (i + 1) + dx * w]);
  });
  return tiles;
}

// An area attack: every monster on these tiles is hit - and every player, where players
// may fight and your secure mode lets you.
function hitTiles(tiles, element, roll, z = player.z) {
  for (const [x, y] of tiles) {
    addBurst(x, y, z, ELEMENT_COLORS[element]);
    const m = monsters.find(mm => !mm.dead && mm.x === x && mm.y === y && mm.z === z);
    if (m) damageMonster(m, roll(), element);
    for (const p of players) if (p !== player && !p.dead && p.x === x && p.y === y && p.z === z && pvpAllowed(p) && mayHurt(p)) hurt(p, roll(), element);
  }
}

function castSpell(id) {
  const s = SPELLS[id];
  if (player.dead || !s) return;
  if (!spellsFor(player.vocation).includes(id)) return log(`Only ${s.vocs.join('s and ')}s can cast ${s.name}.`);
  if (player.level < s.level) return log(`You need level ${s.level} to cast ${s.name}.`);
  if (s.promoted && !player.promoted) return log(`You need to be promoted to cast ${s.name}.`);
  if (player.mana < s.mana) return log('You do not have enough mana.');
  if (now < player.spellReady) return log('You are exhausted.');

  const t = player.target;
  if (s.kind === 'bolt' || s.kind === 'strike') {
    if (!t) return log('You need a target for this spell. Click a monster first.');
    const ok = s.kind === 'bolt' ? dist(player, t) <= s.range && sightClear(player, t) : inMelee(player, t);
    if (!ok) return log(s.kind === 'bolt' ? 'Your target is out of range.' : 'You need to stand next to your target.');
  }
  if (s.kind === 'conjure' && s.blank && !countItem('blank_rune')) return log('You need a blank rune.');
  if (AGGRESSIVE.includes(s.kind) && inPZ()) return log(NOT_IN_PZ);

  player.mana -= s.mana;
  player.spellReady = now + SPELL_COOLDOWN;
  addSkillTries('magic', s.mana);
  addSpeech(player, s.words);
  addSound('magic', player.x, player.y, player.z);
  const roll = () => randInt(...powerRange(player, s.power));
  const melee = () => {
    const w = playerWeapon();
    const max = physicalMax(w.kind === 'melee' ? w : { skill: 'fist', attack: 6 });
    return Math.round(max * (s.mult[0] + Math.random() * (s.mult[1] - s.mult[0])));
  };

  if (s.kind === 'heal') {
    const n = roll();
    player.hp = Math.min(player.maxHp, player.hp + n);
    addSparkle(player, '#8fe0ff');
    addText(player, `+${n}`, '#60ff60');
  } else if (s.kind === 'light') {
    player.lightUntil = now + 180000;
    addSparkle(player, '#ffe080');
  } else if (s.kind === 'cure') {
    delete player.conditions.poison;
    addSparkle(player, '#7ad040');
  } else if (s.kind === 'haste') {
    applyCondition(player, 'haste');
    addSparkle(player, '#ffffff');
  } else if (s.kind === 'shield') {
    applyCondition(player, 'shield');
    addSparkle(player, '#6080ff');
  } else if (s.kind === 'conjure') {
    if (s.blank) removeItem('blank_rune', 1);
    giveItem(s.item, s.count);
    addSparkle(player, '#c58cff');
  } else if (s.kind === 'bolt') {
    addMissile(player, t, s.element);
    hurt(t, roll(), s.element);
  } else if (s.kind === 'strike') {
    hurt(t, melee(), 'physical');
    if (s.condition && t.type !== 'player') applyCondition(t, s.condition, 1, player.id);
  } else if (s.kind === 'wave' || s.kind === 'beam') {
    hitTiles(shapeTiles(s.kind, s.length).filter(([x, y]) => sightClear(player, { x, y, z: player.z })), s.element, roll);
  } else if (s.kind === 'area' || s.kind === 'whirl') {
    const radius = s.radius || 1, element = s.element || 'physical';
    const tiles = [];
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if ((dx || dy) && sightClear(player, { x: player.x + dx, y: player.y + dy, z: player.z })) tiles.push([player.x + dx, player.y + dy]);
    }
    hitTiles(tiles, element, s.kind === 'area' ? roll : melee);
  } else if (s.kind === 'selfdestruct') { // everything around you burns, and so do you
    for (let dy = -s.radius; dy <= s.radius; dy++) for (let dx = -s.radius; dx <= s.radius; dx++) {
      const x = player.x + dx, y = player.y + dy;
      if (!sightClear(player, { x, y, z: player.z })) continue;
      addBurst(x, y, player.z, ELEMENT_COLORS.fire);
      const c = creatureAt(x, y, player.z);
      if (c && c !== player && c.type !== 'npc') hurt(c, roll(), 'fire');
    }
    addSound('death', player.x, player.y, player.z);
    log('You blow yourself up!', 'damage');
    player.hp = 0;
    playerDies(null);
  }
  uiDirty();
}

// Use a rune from your things on the tile x, y, z (or the creature on it).
function castRune(ref, x, y, z) {
  const found = resolve(ref);
  if (player.dead || !found || !found.item || !['bag', 'equip'].includes(ref.root)) return;
  const r = ITEMS[found.item.id].rune;
  if (player.skills.magic.level < r.ml) return log(`You need magic level ${r.ml} to use this rune.`);
  if (now < player.spellReady) return log('You are exhausted.');
  const pos = { x, y, z };
  if (dist(player, pos) > r.range || !sightClear(player, pos)) return log('That is out of range.');
  if (r.kind !== 'heal' && (inPZ() || inPZ(pos))) return log(NOT_IN_PZ);
  const target = creatureAt(x, y, z);
  const roll = () => randInt(...powerRange(player, r.power));
  if (r.kind === 'bolt' || r.kind === 'condition') {
    if (!target || target.type === 'npc' || target === player) return log('You need to use this rune on a creature.');
    addMissile(player, pos, r.element || 'energy');
    if (r.kind === 'bolt') hurt(target, roll(), r.element);
    else if (target.type !== 'player') applyCondition(target, r.condition, 1, player.id);
  } else if (r.kind === 'heal') {
    if (!target || target.type !== 'player') return log('You can only heal people with this rune.');
    const n = roll();
    target.hp = Math.min(target.maxHp, target.hp + n);
    addSparkle(target, '#8fe0ff');
    addText(target, `+${n}`, '#60ff60');
  } else if (r.kind === 'area') {
    addMissile(player, pos, r.element);
    const tiles = [];
    for (let dy = -r.radius; dy <= r.radius; dy++) for (let dx = -r.radius; dx <= r.radius; dx++) {
      if (sightClear(pos, { x: x + dx, y: y + dy, z })) tiles.push([x + dx, y + dy]);
    }
    hitTiles(tiles, r.element, roll, z);
  } else if (r.kind === 'field') {
    const t = map.get(x, y, z);
    if (!t || !map.isWalkable(x, y, z) || (r.field === 'magic_wall' && target)) return log('There is no room there.');
    createField(r.field, x, y, z, player.id);
    addSound('magic', x, y, z);
  }
  player.spellReady = now + SPELL_COOLDOWN;
  takeFrom(ref, 1);
}

// ---- monsters -------------------------------------------------------------------------------
function spawnMonster(spawn, extra = {}) {
  const def = MONSTERS[spawn.type];
  const pos = def && findFreeTile(spawn.x, spawn.y, spawn.z, 4, true);
  if (!pos) return null;
  return {
    id: newId(), type: spawn.type, name: def.name, def, spawn, x: pos.x, y: pos.y, z: spawn.z, dir: 2, walk: null,
    hp: def.hp, maxHp: def.hp, lastAttack: 0, nextMove: now + Math.random() * 1000, angryUntil: 0, angryAt: null,
    conditions: {}, dead: false, respawnAt: 0, ...extra,
  };
}

// A monster for every spawn, each on a tile of its own: placed one at a time, so a
// monster looking for a free tile near its spawn sees the ones placed before it.
// each(monster, spawn index) may adjust a monster before the next is placed.
function spawnAll(spawns, each = m => m) {
  monsters = [];
  spawns.forEach((s, i) => {
    const m = spawnMonster(s);
    if (m) monsters.push(each(m, i));
  });
  return monsters;
}

// The player a monster goes after: the one it's angry at, or the nearest one it can see.
// An aggressive monster notices you once you could see it on your screen, or 2-3 tiles beyond its edge
// (inView): it comes for you then, not only when you're right next to it. Peaceful ones (aggro 0) never do.
function monsterTarget(m) {
  let best = null, bestD = Infinity;
  for (const p of players) {
    if (p.dead || p.z !== m.z || p.ride) continue; // nobody attacks someone being picked up or on a ride
    if (map.isShelter(p.x, p.y, p.z)) continue; // nor anyone in a temple, a shop or an inn
    const d = dist(m, p), angry = m.angryAt === p.id && now < m.angryUntil;
    const sees = m.def.aggro > 0 && (d <= m.def.aggro || (!(m.spawn && m.spawn.lurk) && inView(p, m))); // lurkers only see what's near
    if ((sees || (angry && d <= 12)) && (d < bestD || angry)) {
      best = p;
      bestD = angry ? -1 : d;
    }
  }
  return best;
}

// Whether player p has position o on their screen (or close to its edge).
const inView = (p, o) => o.z === p.z && Math.abs(o.x - p.x) <= 10 && Math.abs(o.y - p.y) <= 8;

function updateMonster(m, i) {
  if (m.dead) {
    if (!m.spawn || m.raid) {
      m.remove = true; // summons and raiders don't come back
    } else if (now >= m.respawnAt && m.def.comesBack && m.diedAt) {
      comeBack(m, i);
    } else if (now >= m.respawnAt) {
      // Monsters come back where nobody can see it happen: at their spawn - or, when
      // someone has stood in sight of it for a while, walking in from beyond the edge
      // of their screen. So a hunting ground never runs dry, however long you stay.
      const fresh = spawnMonster(m.spawn);
      m.due = m.due || now;
      if (fresh && !players.some(p => inView(p, fresh) || inView(p, m.spawn))) monsters[i] = fresh;
      else if (!(now - m.due > 15000 && walkIn(m, i))) m.respawnAt = now + 4000;
    }
    return;
  }
  tickConditions(m);
  if (m.dead) return;
  const unseen = () => !players.some(p => inView(p, m));
  if ((m.until && now >= m.until && unseen()) || (m.summoner && !monsters.some(o => o.id === m.summoner && !o.dead))) {
    if (m.summoner) addSparkle(m, '#a060ff');
    m.remove = true; // a raider goes home once nobody is watching; a summon goes with its summoner
    return;
  }
  finishWalk(m);
  if (m.walk) return;
  const target = monsterTarget(m);
  if (m.goal && (m.def.comesBack || !target)) return walkToGoal(m); // walking back home; Kenny minds nobody on the way
  m.goal = null;
  if (!target) return wander(m);
  asPlayer(target, () => monsterAct(m));
}

// Kenny comes back: in from the side of the screen of whoever killed him, walking
// back to where he fell, as if nothing happened.
function comeBack(m, i) {
  const at = m.diedAt, killer = players.find(p => p.id === at.by) || at, side = Math.random() < 0.5 ? -1 : 1;
  const edge = findFreeTile(killer.x + side * 9, killer.y + randInt(-2, 2), at.z, 3, true) || findFreeTile(at.x, at.y, at.z, 6, true);
  const fresh = edge && spawnMonster({ ...m.spawn, x: edge.x, y: edge.y, z: at.z });
  if (!fresh) return void (m.respawnAt = now + 2000);
  Object.assign(fresh, { x: edge.x, y: edge.y, spawn: m.spawn, goal: { x: at.x, y: at.y } });
  monsters[i] = fresh;
}

// A monster whose spawn is in sight comes from out of sight: a free tile just past
// the edge of the screen on the spawn's side, from where it walks to its spawn.
let walkInsLeft = 2; // per tick: finding a way in costs, and the others can come a moment later
function walkIn(m, i) {
  const s = m.spawn, watcher = players.find(p => !p.dead && inView(p, s));
  if (!watcher || walkInsLeft <= 0) return false;
  walkInsLeft--;
  const toward = Math.atan2(s.y - watcher.y, s.x - watcher.x);
  for (let tries = 0; tries < 8; tries++) {
    const a = toward + (Math.random() - 0.5) * 2.4;
    const edge = findFreeTile(Math.round(watcher.x + Math.cos(a) * 12), Math.round(watcher.y + Math.sin(a) * 10), s.z, 2, true);
    if (!edge || dist(edge, s) > 20 || map.isShelter(edge.x, edge.y, s.z) || players.some(p => inView(p, { ...edge, z: s.z }))) continue;
    if (!findPath((x, y) => isFreeNoStairs(x, y, s.z), edge.x, edge.y, s.x, s.y, { range: 2, maxNodes: 800 })) continue;
    const fresh = spawnMonster({ ...s, x: edge.x, y: edge.y });
    if (!fresh) continue;
    Object.assign(fresh, { spawn: s, goal: { x: s.x, y: s.y } });
    monsters[i] = fresh;
    return true;
  }
  return false;
}

function walkToGoal(m) {
  if (now < m.nextMove) return;
  m.nextMove = now + 100;
  const path = findPath(freeAround(m, 45), m.x, m.y, m.goal.x, m.goal.y, { range: 1, maxNodes: 3000 }); // round a town's houses too
  if (!path || !path.length) return void (m.goal = null);
  step(m, path[0][0] - m.x, path[0][1] - m.y);
}

// One step of a monster's fight against `player`.
function monsterAct(m) {
  const d = dist(m, player), r = m.def.ranged;
  if (m.def.flee && m.hp < m.maxHp * m.def.flee) {
    if (now >= m.nextMove) stepAway(m);
    return;
  }
  if (now - m.lastAttack >= m.def.attackSpeed) {
    const spell = (m.def.spells || []).find(s => Math.random() < s.chance && spellUsable(m, s, d));
    if (spell) {
      m.lastAttack = now;
      monsterSpell(m, spell);
    } else if (d <= 1) {
      m.lastAttack = now;
      m.dir = dirTo(player.x - m.x, player.y - m.y);
      addSound('hit', player.x, player.y, player.z);
      damagePlayer(m, randInt(...m.def.dmg), 'physical');
      const hc = m.def.hitCondition;
      if (hc && Math.random() < hc.chance) applyCondition(player, hc.kind, hc.power);
    } else if (r && d <= r.range && sightClear(m, player)) {
      m.lastAttack = now;
      if (Math.random() < r.chance) {
        m.dir = dirTo(player.x - m.x, player.y - m.y);
        addMissile(m, player, r.missile);
        damagePlayer(m, randInt(...r.dmg), r.element);
      }
    }
    const sm = m.def.summon;
    if (sm && Math.random() < sm.chance && monsters.filter(o => o.summoner === m.id && !o.dead).length < sm.max) {
      const minion = spawnMonster({ type: sm.type, x: m.x, y: m.y, z: m.z }, { summoner: m.id });
      if (minion) {
        minion.spawn = null;
        monsters.push(minion);
        addSparkle(minion, '#a060ff');
      }
    }
  }
  if (now < m.nextMove) return;
  // Shooters keep their distance, like archers in Tibia: they back off when you
  // come closer, and stay put while they can hit you.
  if (r && r.keepDistance) {
    if (d < Math.min(r.keep || 4, r.range) && stepAway(m, true)) return;
    if (d <= r.range && sightClear(m, player)) return;
  } else if (d <= 1) return;
  const free = freeAround(m, 20);
  const pass = (x, y) => free(x, y) && (!fieldAt(x, y, m.z) || (m.def.immune || []).includes(FIELDS[fieldAt(x, y, m.z).kind].condition));
  const path = findPath(pass, m.x, m.y, player.x, player.y, { adjacent: true, maxNodes: 900 }); // from the edge of your screen, round trees
  if (path && path.length) step(m, path[0][0] - m.x, path[0][1] - m.y);
  else m.nextMove = now + 1200 + Math.random() * 800; // no way through: try again in a while
}

function spellUsable(m, s, d) {
  if (s.kind === 'heal') return m.hp < m.maxHp * 0.6;
  if (s.kind === 'area') return d <= s.radius && sightClear(m, player);
  return d <= (s.range || 5) && sightClear(m, player);
}

function monsterSpell(m, s) {
  if (s.kind === 'heal') {
    const n = randInt(...s.dmg);
    m.hp = Math.min(m.maxHp, m.hp + n);
    addSparkle(m, '#8fe0ff');
  } else if (s.kind === 'bolt') {
    addMissile(m, player, s.missile || s.element);
    damagePlayer(m, randInt(...s.dmg), s.element);
  } else if (s.kind === 'condition') {
    addMissile(m, player, 'energy');
    applyCondition(player, s.condition, s.power);
  } else if (s.kind === 'area') {
    for (let dy = -s.radius; dy <= s.radius; dy++) for (let dx = -s.radius; dx <= s.radius; dx++) {
      if (dx || dy) addBurst(m.x + dx, m.y + dy, m.z, ELEMENT_COLORS[s.element]);
    }
    for (const p of players) {
      if (!p.dead && p.z === m.z && dist(p, m) <= s.radius && sightClear(m, p)) asPlayer(p, () => damagePlayer(m, randInt(...s.dmg), s.element));
    }
  }
}

// One step away from the player (diagonals too); false if there's nowhere to go.
// Shooters (keepSight) prefer a spot from which they can still hit you.
function stepAway(m, keepSight = false) {
  m.nextMove = now + 200;
  const d0 = dist(m, player);
  let best = null, bestScore = -Infinity;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const n = { x: m.x + dx, y: m.y + dy, z: m.z };
    if ((!dx && !dy) || dist(n, player) <= d0 || !isFreeNoStairs(n.x, n.y, m.z) || fieldAt(n.x, n.y, m.z)) continue;
    const score = dist(n, player) + (keepSight && sightClear(n, player) ? 0.5 : 0) - (dx && dy ? 0.1 : 0);
    if (score > bestScore) {
      best = [dx, dy];
      bestScore = score;
    }
  }
  return !!best && step(m, best[0], best[1]);
}

function wander(m) {
  if (now < m.nextMove) return;
  m.nextMove = now + 1000 + Math.random() * 2500;
  const d = randInt(0, 3), nx = m.x + DX[d], ny = m.y + DY[d];
  const home = m.spawn || m;
  if (Math.abs(nx - home.x) <= 5 && Math.abs(ny - home.y) <= 5 && !map.floorChange(nx, ny, m.z)) step(m, DX[d], DY[d]);
}

// ---- raids -------------------------------------------------------------------------------
function updateRaids() {
  if (!RAIDS.length) return;
  if (!nextRaidAt) nextRaidAt = now + randInt(...RAID_INTERVAL);
  if (now < nextRaidAt) return;
  nextRaidAt = now + randInt(...RAID_INTERVAL);
  startRaid(RAIDS[randInt(0, RAIDS.length - 1)]);
}

const RAID_STAY = 20 * 60000; // raiders leave after this, once nobody sees them go

function startRaid(raid) {
  for (const p of players) {
    asPlayer(p, () => {
      log(`Raid: ${raid.message}`, 'raid');
      playerEvent('raid', { message: raid.message });
    });
  }
  for (const [type, n] of raid.spawns) {
    for (let i = 0; i < n; i++) {
      const m = spawnMonster({ type, x: raid.at.x + randInt(-3, 3), y: raid.at.y + randInt(-3, 3), z: raid.at.z }, { raid: true, until: now + RAID_STAY });
      if (m) {
        m.def = { ...m.def, aggro: 9 };
        monsters.push(m);
      }
    }
  }
}
