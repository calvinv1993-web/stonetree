'use strict';
// The gate watch's tasks on Oakvale Isle (the gate quests in npcs.js; their places, GATE_SITES, in default-map.js):
//   west   Greyfang's paw prints lead to his den; his pelt is taken from him there (questTrophies)
//   south  a fisher stranded on a rock off Lighthouse Point: clear the crabs round him (a step's clear), talk to him,
//          and he rows home by himself for a while (goHome), then goes back out to fish
//   east   spider nests round the Spider Hills burn (burnable things: Torchlight cast next to one, or a torch)
//   north  the goblins of Goblin Hill sleep at night (a spawn's sleeps), unless you step right next to one or hit it
// And every task a gate guard hands out comes with a gift to take along (a quest's startGift).

// ---- a gift as you take a task on: { items: [[itemId, n]], say } (what the giver adds) ----------------------------
function questStartGift(id) {
  const gift = QUESTS[id] && QUESTS[id].startGift;
  if (!gift) return '';
  log(`You received ${gift.items.map(([item, n]) => itemName(item, n)).join(' and ')}.`, 'quest'); // (before "lying at your feet")
  for (const [item, n] of gift.items) giveItem(item, n);
  uiDirty();
  return gift.say || '';
}

// ---- a trophy: what a quest has you take from a monster you kill (trophy: { type, item, text }) ---------------------
// Only while the quest's current step still asks for it, and once.
function questTrophies(type) {
  for (const [id, s] of Object.entries(player.quests)) {
    const q = QUESTS[id], tr = q && q.trophy;
    if (!tr || tr.type !== type || s.status !== 'active' || questStep(id).fetch !== tr.item || countItem(tr.item)) continue;
    giveItem(tr.item, 1);
    log(tr.text || `You take ${itemName(tr.item)}.`, 'quest');
    addSparkle(player, '#ffe080');
    uiDirty();
  }
}

// ---- a step's clear: { types, at: [x, y, z], range }: none of them alive that close to the spot, nor any that lives
// there (one lured away still counts: it comes back) ---------------------------------------------------------------------
function areaClear(c) {
  const [x, y, z] = c.at, near = o => !!o && o.z === z && dist(o, { x, y }) <= c.range;
  return !monsters.some(m => !m.dead && c.types.includes(m.type) && (near(m) || near(m.spawn)));
}

// ---- fire: burnable things (spider nests) ---------------------------------------------------------------------------
const BURNT_FOR = 10 * 60000; // a burnt nest is spun again after this long
function burntCount(id) { return ((player.quests[id] && player.quests[id].burnt) || []).length; }

// Burn what burns on this tile (true if something did), and count it for the quests that ask for it (step.burn).
function burnThing(x, y, z) {
  const t = map.get(x, y, z), id = t && t.items.find(i => THINGS[i].burnable);
  if (!id) return false;
  changeTileFor(x, y, z, id, THINGS[id].burnable, BURNT_FOR);
  addSound('ignite', x, y, z);
  addBurst(x, y, z, '#ff7a1a');
  log(`The ${THINGS[id].name} catches fire, and crackles away to ash.`);
  for (const [qid, s] of Object.entries(player.quests)) {
    if (s.status !== 'active' || !QUESTS[qid] || !questStep(qid).burn) continue;
    const st = questStep(qid), key = `${x},${y},${z}`;
    s.burnt = s.burnt || [];
    if (s.burnt.includes(key)) continue;
    s.burnt.push(key);
    if (s.burnt.length < st.burn) log(`${QUESTS[qid].name}: ${s.burnt.length} of ${st.burn} nests burnt.`, 'quest');
    else if (s.burnt.length === st.burn) log(`${QUESTS[qid].name}: done! Report to ${NPCS[st.npc || QUESTS[qid].giver].name}.`, 'quest');
  }
  uiDirty();
  return true;
}

// Torchlight: whatever burns right next to you catches fire
function burnAround() {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) burnThing(player.x + dx, player.y + dy, player.z);
}

// The guide's arrow on the east task: the nearest nest you haven't burnt yet
function nextNest() {
  const burnt = (player.quests.gate_east && player.quests.gate_east.burnt) || [];
  return GATE_SITES.nests.map(([x, y]) => ({ x, y, z: map.surfaceZ })).filter(n => n.z === player.z && !burnt.includes(`${n.x},${n.y},${n.z}`))
    .sort((a, b) => dist(a, player) - dist(b, player))[0] || null;
}

// ---- someone rescued goes home by himself (NPC def goesHome: { x, y, z, ms }), and back out after a while ------------
function goHome(npc) {
  const h = npc.def.goesHome;
  if (!h || npc.away) return;
  const to = findFreeTile(h.x, h.y, h.z, 3) || h;
  npc.away = { until: now + h.ms, x: npc.home.x, y: npc.home.y, z: npc.z };
  addSparkle(npc, '#9cc0ee');
  Object.assign(npc, { x: to.x, y: to.y, z: h.z, home: { x: to.x, y: to.y }, walk: null });
  addSparkle(npc, '#9cc0ee');
}

function updateGates() {
  for (const n of npcs) {
    if (!n.away || now < n.away.until) continue;
    const seen = o => players.some(p => !p.dead && inView(p, o));
    if (seen(n) || seen(n.away)) continue; // (nobody sees him row off, or come back)
    const back = findFreeTile(n.away.x, n.away.y, n.away.z, 2) || n.away;
    Object.assign(n, { x: back.x, y: back.y, z: n.away.z, home: { x: back.x, y: back.y }, walk: null, away: null });
  }
}

// ---- sleepers: monsters of a spawn with sleeps lie still at night ----------------------------------------------------
const AWAKE_FOR = 3 * 60000; // woken, they stay up this long
function monsterAsleep(m) { return !!(m.spawn && m.spawn.sleeps) && daylight() < 0.5 && !(m.awakeUntil > now) && !(m.angryUntil > now); }

// Does something wake it now: someone right next to it, or a hit? Then it wakes the sleepers round it, with a shout.
function rouse(m) {
  if (!players.some(p => !p.dead && p.z === m.z && dist(p, m) <= 1) && !(m.angryUntil > now)) return false;
  for (const o of monsters) if (!o.dead && o.z === m.z && o.spawn && o.spawn.sleeps && dist(o, m) <= 4) o.awakeUntil = now + AWAKE_FOR;
  m.awakeUntil = now + AWAKE_FOR;
  m.asleep = false;
  addSpeech(m, m.def.proper ? 'WHO DARES?! Up, you lazy lot!' : 'Oi! Wake up! Thief!', true);
  return true;
}
