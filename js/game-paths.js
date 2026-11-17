'use strict';
// The Hall of Paths (Kestrel Isle): the four paths - Bastion, Hawk, Ember and Grove - explained, tried and chosen.
//
// The Pathkeeper explains them (and opens the Book of Paths: four cards side by side). Each of the four teachers
// lets you try their path in a practice room under the hall: a trial. For as long as you're in the room you ARE that
// vocation - borrowed gear in your hands, its spells, a deep well of mana - but you can't die there and earn nothing
// (no experience, no skills, no quest kills). Do what the teacher asks (cast the path's two spells, knock three dummies
// down) and your Book of Paths gets that path's stamp. Leave the room, by its forcefield or any other way, and all of
// it goes back: your own vocation, gear, health and mana. With all four stamps, the Pathkeeper lets you choose.
//
// player.paths: the stamps, { knight: true, ... } (saved); player.trial: the trial you're in, or null (never saved:
// a save made during one is the player as they were before it, back in the hall).
// map.trialRooms: [{ voc, x0, y0, x1, y1, z, entry: {x, y, z}, back: {x, y, z} }] (world-kestrel.js builds them).

// Per path (by vocation id): its teacher, the spells the trial teaches (cast each once), what you borrow
// (slot: [item, count]), how many dummies to knock down, and the card in the Book of Paths.
const PATHS = {
  knight: {
    teacher: 'holt', spells: ['circle_throw', 'power_strike'], kit: { weapon: ['war_spear', 1], body: ['chain_armor', 1] }, downs: 3,
    colour: '#9a7ad0', weapons: 'spears, swords, axes and clubs, and a shield',
    forYou: 'You like to stand in front and take the blows, so your friends don\'t have to. Steel, a shield, and the ground shaking under you.',
    strong: 'the most health; heavy blows up close; Circle Throw hits everything in front of you', weak: 'little mana; slow to reach what stays away',
  },
  paladin: {
    teacher: 'sill', spells: ['power_shot', 'triple_shot'], kit: { weapon: ['hawkeye_bow', 1], ammo: ['arrow', 100] }, downs: 3,
    colour: '#4a9a4a', weapons: 'bows, crossbows and spears',
    forYou: 'You like to strike from afar and never be where the enemy is. A bow, a sharp eye, and the shot that ends a fight.',
    strong: 'Power Shot through a whole row, Triple Shot, critical hits; quick on your feet', weak: 'less health than a Bastion; needs arrows',
  },
  sorcerer: {
    teacher: 'vela', spells: ['fire_bolt', 'flame_burst'], kit: { weapon: ['wand_sparks', 1] }, downs: 3,
    colour: '#d8742a', weapons: 'wands, and runes',
    forYou: 'You like big, bright, loud magic that melts whole packs at once, and you don\'t mind being fragile.',
    strong: 'the most damage of all, to whole groups at once: fire and energy', weak: 'little health; done when the mana runs out',
  },
  druid: {
    teacher: 'fennick', spells: ['ice_bolt', 'greater_heal'], kit: { weapon: ['rod_frost', 1] }, downs: 3,
    colour: '#3a8ab0', weapons: 'rods, and runes',
    forYou: 'You like keeping everyone alive and bending nature: ice, earth and healing. Strongest with friends.',
    strong: 'the best healing, for yourself and your friends; ice and earth', weak: 'less damage alone; little health',
  },
};
const PATH_IDS = Object.keys(PATHS);
const TRIAL_MANA = 400; // (the trial's deep well of mana: enough to try every spell many times)

const trialRoomOf = (c) => (map.trialRooms || []).find(r => c.z === r.z && c.x >= r.x0 && c.x <= r.x1 && c.y >= r.y0 && c.y <= r.y1);
const pathStamps = (p = player) => PATH_IDS.filter(v => p.paths && p.paths[v]).length;

// Take every borrowed thing out of a list of items (and the bags in it).
function dropBorrowed(items) {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].borrowed) items.splice(i, 1);
    else if (items[i].contents) dropBorrowed(items[i].contents);
  }
}

// Into a teacher's practice room: become that path for a while.
function startTrial(v) {
  const room = (map.trialRooms || []).find(r => r.voc === v);
  if (!room || player.trial || player.dead) return false;
  const eq = player.equipment, slots = {};
  for (const slot of Object.keys(PATHS[v].kit)) slots[slot] = eq[slot] || null;
  // (a two-handed bow or spear: the shield waits too)
  if (eq.shield) slots.shield = eq.shield;
  player.trial = {
    voc: v, spells: {}, downs: 0,
    was: { vocation: player.vocation, lightUntil: player.lightUntil, hp: player.hp, maxHp: player.maxHp, mana: player.mana, maxMana: player.maxMana, slots, back: room.back },
  };
  for (const slot of Object.keys(slots)) eq[slot] = null;
  for (const [slot, [id, count]] of Object.entries(PATHS[v].kit)) eq[slot] = { id, ...(ITEMS[id].stack ? { count } : {}), borrowed: true };
  Object.assign(player, { vocation: v, maxMana: Math.max(player.maxMana, TRIAL_MANA), target: null, spellCooldowns: {}, lightUntil: now + 3600000 }); // (and a light: the dummies want seeing)
  player.mana = player.maxMana;
  teleport(room.entry);
  addSparkle(player, PATHS[v].colour);
  addSound('teleport', player.x, player.y, player.z);
  uiDirty();
  return true;
}

// Out of the room (by its forcefield, or any other way): everything back as it was. done: the stamp, if earned.
function endTrial() {
  const t = player.trial;
  if (!t) return;
  const eq = player.equipment;
  for (const slot of Object.keys(t.was.slots)) {
    const worn = eq[slot];
    eq[slot] = t.was.slots[slot];
    if (worn && !worn.borrowed) stash(worn); // (something of your own you put on in the room: back in your bag)
  }
  for (const slot of SLOTS) if (eq[slot] && eq[slot].borrowed) eq[slot] = null;
  if (eq.backpack && eq.backpack.contents) dropBorrowed(eq.backpack.contents);
  for (const pile of piles) if (pile.items.some(i => i.borrowed)) dropBorrowed(pile.items); // (dropped in the room: the teacher takes them back)
  Object.assign(player, { vocation: t.was.vocation, maxHp: t.was.maxHp, hp: Math.min(t.was.maxHp, Math.max(t.was.hp, 1)), maxMana: t.was.maxMana,
    mana: Math.min(t.was.mana, t.was.maxMana), target: null, spellCooldowns: {}, lightUntil: t.was.lightUntil, trial: null });
  player.conditions = {};
  if (trialRoomOf(player)) teleport(t.was.back);
  log(trialDone(t) ? `Your trial as ${aVoc(t.voc)} is over. The borrowed gear goes back to its rack.`
    : `You leave the practice room. The borrowed gear goes back to its rack: come back whenever you like to finish your trial as ${aVoc(t.voc)}.`);
  uiDirty();
}

const trialDone = t => PATHS[t.voc].spells.every(id => t.spells[id]) && t.downs >= PATHS[t.voc].downs;

// What's left to do in the trial, as a short line (the log, the guide).
function trialTodo(t = player.trial) {
  if (!t) return '';
  const P = PATHS[t.voc], left = P.spells.filter(id => !t.spells[id]).map(id => `cast ${SPELLS[id].name} ("${SPELLS[id].words}")`);
  if (t.downs < P.downs) left.push(`knock down ${P.downs - t.downs} more dumm${P.downs - t.downs === 1 ? 'y' : 'ies'}`);
  return left.length ? `Still to do: ${left.join(', ')}.` : 'All done: step into the forcefield to go back up.';
}

// The trial's progress: a spell of the path cast (castSpell), a dummy knocked down (killMonster).
function trialProgress(kind, id) {
  const t = player.trial;
  if (!t) return;
  const before = trialDone(t);
  if (kind === 'cast' && PATHS[t.voc].spells.includes(id) && !t.spells[id]) t.spells[id] = true;
  else if (kind === 'down') t.downs++;
  else return;
  if (!before && trialDone(t)) {
    player.paths = { ...(player.paths || {}), [t.voc]: true };
    addSparkle(player, '#ffe080');
    addSound('quest', player.x, player.y, player.z);
    log(`Your Book of Paths gets a new stamp: ${vocName(t.voc)}! (${pathStamps()} of 4)${pathStamps() === 4 ? ' All four: go and tell the Pathkeeper which one made you grin.' : ''}`, 'quest');
    playerEvent('banner', { message: `Trial passed: ${vocName(t.voc)}` });
  } else if (!trialDone(t)) log(trialTodo(t));
  uiDirty();
}

// Every tick, for the acting player: out of the room means out of the trial.
function trialTick() {
  if (player.trial && !trialRoomOf(player)) endTrial();
}

// The same player, as a save: never mid-trial (their own vocation and gear, back in the hall).
function trialSave(p, data) {
  const t = p.trial;
  if (!t) return data;
  Object.assign(data, { vocation: t.was.vocation, hp: Math.max(1, t.was.hp), maxHp: t.was.maxHp, mana: t.was.mana, maxMana: t.was.maxMana, ...t.was.back });
  const eq = data.equipment = JSON.parse(JSON.stringify(data.equipment)); // (a copy: the player in the room keeps theirs)
  for (const slot of Object.keys(t.was.slots)) {
    if (eq[slot] && !eq[slot].borrowed && eq.backpack && eq.backpack.contents) eq.backpack.contents.push(eq[slot]);
    eq[slot] = t.was.slots[slot] ? JSON.parse(JSON.stringify(t.was.slots[slot])) : null;
  }
  for (const slot of SLOTS) if (eq[slot] && eq[slot].borrowed) eq[slot] = null;
  if (eq.backpack && eq.backpack.contents) dropBorrowed(eq.backpack.contents);
  return data;
}

// ---- the NPCs' side ------------------------------------------------------------------------------------------------

// The Pathkeeper: the four paths, side by side (and the Book of Paths, if you haven't one yet).
function pathsTalk() {
  playerEvent('paths', {});
  if (!countItem('book_of_paths') && player.vocation === 'none') giveItem('book_of_paths', 1);
  if (player.vocation !== 'none') return `You walk the path of the ${vocName(player.vocation)} now. But the teachers will always let you try the others again, just for fun.`;
  const n = pathStamps();
  return n === 4 ? 'Four stamps! So: which one made you grin? {Bastion}, {Hawk}, {Ember} or {Grove}? Choose with your heart.'
    : `Four paths: the {Bastion} stands in front, the {Hawk} strikes from afar, the {Ember} burns, the {Grove} heals. Read the Book of Paths, then try each one with its teacher, in the four corners of this hall.${n ? ` You have ${n} stamp${n === 1 ? '' : 's'} of 4.` : ''}`;
}

// The Pathkeeper, asked about a path: what it is, and once you've tried all four, choosing it.
function choosePathTalk(v) {
  const P = PATHS[v], name = vocName(v);
  const about = `${VOCATIONS[v].desc} Its teacher is ${NPCS[P.teacher].name}.`;
  if (player.vocation !== 'none' || player.trial) return about;
  if (pathStamps() < 4) return `${about} Try all four paths before you choose: ${PATH_IDS.filter(o => !(player.paths || {})[o]).map(vocName).join(', ')} still wait${pathStamps() === 3 ? 's' : ''} for you.`;
  return ask(`${about} Do you want to become ${aVoc(v)}? This cannot be undone. ({yes}/{no})`, () => {
    chooseVocation(v);
    ringTownBell(`Dong... dong... dong... The bell rings for ${player.name}, the new ${name}.`);
    return `So be it: ${name}! Walk your path well, $name. Your teacher has a gift for you - it's in your bag.`;
  }, () => 'Take your time. The paths aren\'t going anywhere.');
}

// A teacher: the trial (once Clang is safe - Sister Ama asks that first), and what still has to be done in it.
function trialTalk(v) {
  const P = PATHS[v], name = vocName(v);
  if (player.trial) return player.trial.voc === v ? trialTodo() : 'Finish the trial you are in first.';
  if (!(map.trialRooms || []).some(r => r.voc === v)) return 'My practice room is not ready yet.';
  if (QUESTS.clang_rescue && questState('clang_rescue') !== 'done') return 'First things first: Sister Ama in the temple needs a hand. Come back once that\'s done, and I\'ll show you how a ' + name + ' fights.';
  const again = player.paths && player.paths[v];
  return ask(`${again ? 'Again? Gladly.' : `Want to try being ${aVoc(v)}?`} Down in my practice room you are one: my gear in your hands, the ${name}'s spells, plenty of mana. You can't die there, and you earn nothing - it's only practice. ${P.spells.map(id => `${SPELLS[id].name} ("${SPELLS[id].words}")`).join(' and ')}, and knock down ${P.downs} dummies. Ready? ({yes}/{no})`, () => {
    startTrial(v);
    return `Off you go! ${trialTodo()}`;
  }, () => 'Whenever you\'re ready.');
}
