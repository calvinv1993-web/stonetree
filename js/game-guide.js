'use strict';
// The guide for new adventurers on Oakvale Isle: one thing at a time, with an arrow
// pointing the way (drawGuideArrow in game.js, renderGuide in game-ui.js), through The Silent Bell
// and the gate watch, to the oracle. You can put it away whenever you like.
// player.tutorial is the step you're on (1 is the first), 0 when the guide is done.

// text: what to do (touch: the same for a phone); target: what the arrow points at, the
// first of these that is there - an NPC, the nearest monster of a kind, the nearest
// corpse, a spot ([x, y, z]), or the first of some NPCs who has a quest or news for you (news) - see guideTarget; done: when the step is done (as the
// player), or on: the deed that does it (see guideDid). A step with neither just explains: it waits for "Next"
// (Actions.guideNext), and the last step for "Got it". ui / uiDesk: the parts of the screen it's about on a phone / a
// computer (CSS selectors): they glow while the step shows (game-ui.js renderGuide).
const GUIDE = [
  // ---- the basics, one thing at a time (a step without done or on is read and passed with "Next") ----
  {
    text: 'Welcome to Oakvale Isle! This guide shows you how everything works, one thing at a time. When it asks you to do something, do it and it moves on by itself. Press Next to begin.',
    touch: 'Welcome to Oakvale Isle! This guide shows you how everything works, one thing at a time. When it asks you to do something, do it and it moves on by itself. Tap Next to begin.',
  },
  {
    text: 'Your health and mana are in the panel on the right. Red is your health: when it runs out, you die. Blue is your mana, for spells. Under them, your experience: when it is full you reach the next level.',
    touch: 'At the top: red is your health (when it runs out, you die), blue is your mana (for spells). Under them, your experience: when the bar is full you reach the next level.',
    ui: ['#touch .hud'], uiDesk: ['.sec-status'],
  },
  {
    text: 'Sister Ama stands by the altar, just north of you: the yellow arrow points at her. Walk with W A S D or the arrow keys (or click where to go), then click her to talk.',
    touch: 'Sister Ama stands by the altar, just north of you: the yellow arrow points at her. Tap where to go (or drag over the map), then tap her to talk.',
    target: [{ npc: 'ama' }],
    done: () => talkingTo('ama') || questState('bell_1') !== 'none', // (or met her already: the guide started again)
  },
  {
    text: 'The gold words are things you can ask about: click one, or type it. Ask Sister Ama about the bell, then say yes.',
    touch: 'The gold words are things you can ask about: tap one. Ask Sister Ama about the bell, then tap yes.',
    target: [{ npc: 'ama' }],
    ui: ['#talkWords'],
    done: () => questState('bell_1') !== 'none',
  },
  {
    text: 'You have a quest! The Quests tab, in the panel on the right, always says where to go next, and the yellow arrow points the way. Lost? Look there.',
    touch: 'You have a quest! Whenever you are lost: the yellow arrow points the way, and the backpack button (bottom right), then Quests, says what to do next.',
    ui: ['#hudBag'], uiDesk: ['[data-tab="quests"]'],
  },
  {
    text: 'Before you fight: train! The training yard is in the south-west of town, off the main street. Click a dummy and you keep hitting it until you walk away. Every hit raises your weapon skill, and a higher skill hits harder. Hit it 5 times ($trained).',
    touch: 'Before you fight: train! Tap a dummy in the training yard (south-west of town) and you keep hitting it until you walk away. Every hit raises your weapon skill, and a higher skill hits harder. Hit it 5 times ($trained).',
    target: [{ at: [110, 141, 8] }, { at: [137, 109, 9] }], // (from the temple: to the steps down)
    done: () => player.trainHits >= 5,
  },
  {
    text: 'Space attacks the nearest monster (press it again for the next one). A monster you click is attacked too, someone you click is talked to.',
    touch: 'The big button in the middle does what the moment asks, and its colour says what: red attacks the nearest monster, blue talks to someone near, amber opens a corpse, green uses a door or chest. You will use it a lot.',
    ui: ['#tAttack'], uiDesk: ['#hotbar'],
  },
  {
    text: 'Now leave the temple yard, west over the bridge to the academy. Master Corwin teaches there: talk to him.',
    touch: 'Now go west over the bridge to the academy (follow the arrow). Master Corwin teaches there: tap him to talk.',
    target: [{ npc: 'corwin' }],
    done: () => talkingTo('corwin') || (!!player.quests.bell_1 && (player.quests.bell_1.step > 0 || player.quests.bell_1.status === 'done')),
  },
  {
    text: 'Before you go out of town: if you die, you wake in the temple. Until you choose a vocation you keep all your things, but you lose a little experience. In the temple, the depot and the shops nothing can hurt you: rest there to heal.',
    touch: 'Before you go out of town: if you die, you wake in the temple. Until you choose a vocation you keep all your things, but you lose a little experience. In the temple, the depot and the shops nothing can hurt you: rest there to heal.',
  },
  {
    text: 'Rats run in Sunny Fields, out of the south gate. Click a rat, or press Space. Rats are easy; grey wolves come in packs and are not: keep away from them for now. Kill 5 rats ($progress).',
    touch: 'Rats run in Sunny Fields, out of the south gate. Press the big red button near a rat, or tap the rat. Rats are easy; grey wolves come in packs and are not: keep away from them for now. Kill 5 rats ($progress).',
    target: [{ monster: 'rat' }, { at: [128, 150, 8] }],
    done: () => ratsDone(), // (the five for Corwin: also if they fell while an earlier step was still being read)
  },
  {
    text: 'Monsters leave a corpse with loot. Right-click it to open it, then take what you want (Take all takes everything). Gold goes straight into your purse.',
    touch: 'Monsters leave a corpse with loot. Press the big button when it turns amber (or hold the corpse) to open it, then take what you want: Take all takes everything. Gold goes straight into your purse.',
    target: [{ corpse: true }],
    done: () => !!(player.openPile && player.openPile.corpse),
  },
  {
    text: 'Your equipment and your bag are in the panels on the right. Right-click a thing to use it; drag it to wear it, move it or drop it on the map.',
    touch: 'This backpack button opens your equipment and your bag. Tap a thing to see what it is and to use it, wear it or drop it; drag it to move it. Close the bag with this button again, or touch the map.',
    ui: ['#hudBag'], uiDesk: ['.sec-equip', '#containers'],
  },
  {
    text: 'With a full stomach you heal much faster. Eat an apple: right-click it in your bag.',
    touch: 'With a full stomach you heal much faster. Open the backpack, tap an apple, then Use to eat it.',
    ui: ['#hudBag'], uiDesk: ['#containers'],
    done: () => player.fedUntil > now,
  },
  {
    text: 'The bar under the map: your spells on 1 to 9 (they come with levels), H for a health potion, M for mana, F to eat. Low on health? Press H.',
    touch: 'The buttons beside the big one: spells on the left, potions and food on the right. Low on health? Tap the red potion. Hold a button to choose what goes there; swipe sideways for more.',
    ui: ['#favs'], uiDesk: ['#hotbar'],
  },
  {
    text: 'Now finish the bell quest: Master Corwin, then the depot, then Pip. The Quests tab says where; the arrow points the way.',
    touch: 'Now finish the bell quest: Master Corwin, then the depot, then Pip. The arrow points the way; the Quests tab (backpack button, Quests) says what to do.',
    target: [{ quest: 'bell_1' }, { monster: 'rat' }],
    done: () => questState('bell_1') === 'done',
  },
  {
    text: 'Pip, on the main street south of the square, sells food, potions and tools, and buys what you loot. Hide and Iron sells armour, the Dented Shield weapons. Talk to Pip and ask to trade.',
    touch: 'Pip, on the main street south of the square, sells food, potions and tools, and buys what you loot. Hide and Iron sells armour, the Dented Shield weapons. Talk to Pip and ask to trade.',
    target: [{ npc: 'pip' }],
    done: () => !!player.shopNpc,
  },
  {
    text: 'The minimap in the panel shows the land round you: click a spot to walk there. G opens the map of the whole island.',
    touch: 'The map button (top left) shows the land round you: tap a spot to walk there. Full map shows the whole island.',
    ui: ['#hudMap'], uiDesk: ['.minimap-box'],
  },
  {
    text: 'Grow stronger before the dark places. The guards at the four town gates each have a task and gear for you: start with Sergeant Bram at the west gate (level 2), and he will send you on. Brenna at Hide and Iron sells armour; Pip sells health potions.',
    touch: 'Grow stronger before the dark places. The guards at the four town gates each have a task and gear for you: start with Sergeant Bram at the west gate (level 2), and he will send you on. Brenna at Hide and Iron sells armour; Pip sells health potions.',
    target: [{ news: ['gate_west', 'gate_south', 'gate_east', 'gate_north'] }, { hunt: ['gate_west', 'gate_south', 'gate_east', 'gate_north'] }, { npc: 'gate_west', level: 2 }],
    done: () => questState('gate_north') === 'done' || questState('bell_2') !== 'none',
  },
  {
    text: 'At level 5, Master Corwin at the academy has a task about the crypt under Bone Rocks. Talk to him and ask about the crypt.',
    touch: 'At level 5, Master Corwin at the academy has a task about the crypt under Bone Rocks. Talk to him and ask about the crypt.',
    target: [{ news: ['corwin'] }],
    done: () => questState('bell_2') !== 'none',
  },
  {
    text: 'Take the bone trail from the south road to Bone Rocks, south-west of town; steps at the foot of the crag lead down into the crypt. Clear the hall of coffins, take a weapon from the stone chests and the note by the iron gate, and bring the note to Corwin. Take potions!',
    touch: 'Take the bone trail from the south road to Bone Rocks, south-west of town; steps at the foot of the crag lead down into the crypt. Clear the hall of coffins, take a weapon from the stone chests and the note by the iron gate, and bring the note to Corwin. Take potions!',
    target: [{ quest: 'bell_2' }, { hunt: ['bell_2'] }, { at: [71, 181, 7] }, { at: [81, 198, 8] }],
    done: () => questState('bell_2') === 'done',
  },
  {
    text: 'Sister Ama must hear about the note. Then, at level 6: down a sewer grate, east to the rats\' nest under the graveyard, and down its trapdoors to the old drains and the deep cistern. The rope lies past the great slime. Take many potions, and say "lumen" for light.',
    touch: 'Sister Ama must hear about the note. Then, at level 6: down a sewer grate, east to the rats\' nest under the graveyard, and down its trapdoors to the old drains and the deep cistern. The rope lies past the great slime. Take many potions, and say "lumen" for light.',
    target: [{ quest: 'bell_3' }, { news: ['ama'] }, { hunt: ['bell_3'] }, { at: [147, 102, 5] }, { at: [128, 111, 6] }, { at: [147, 139, 7] }, { at: [131, 111, 8] }],
    done: () => questState('bell_3') === 'done',
  },
  {
    text: 'Last of all, at level 8: the Gravewaker, in the founder\'s tomb below the crypt. Ask Sister Ama about him; the iron gate in the crypt will open then. Bring ten potions and your best armour.',
    touch: 'Last of all, at level 8: the Gravewaker, in the founder\'s tomb below the crypt. Ask Sister Ama about him; the iron gate in the crypt will open then. Bring ten potions and your best armour.',
    target: [{ quest: 'bell_4' }, { news: ['ama'] }, { hunt: ['bell_4'] }, { at: [69, 176, 6] }, { at: [66, 181, 7] }, { at: [81, 198, 8] }],
    done: () => questState('bell_4') === 'done',
  },
  {
    text: 'The bell rings again! The oracle, upstairs in the academy, lets you choose a vocation at level 10, and sends you on to the mainland. Until then, explore the island: many things have a story.',
    touch: 'The bell rings again! The oracle, upstairs in the academy, lets you choose a vocation at level 10, and sends you on to the mainland. Until then, explore the island: many things have a story.',
    target: [{ npc: 'oak_oracle', level: 10 }],
  },
];

const talkingTo = id => !!(player.conversation && player.conversation.npc.npcId === id);
// Corwin's five rats are dead (his kill step is ready, or the bell quest has gone past it)
const ratsDone = () => { const q = player.quests.bell_1; return !!q && (q.status === 'done' || q.step > 1 || (q.step === 1 && stepReady('bell_1'))); };

// Every tick: on to the next step when this one is done.
function updateGuide() {
  if (!player.tutorial) return;
  const step = GUIDE[player.tutorial - 1];
  if (!step || player.vocation !== 'none') player.tutorial = 0;
  else if (step.done && step.done()) player.tutorial++;
}

// A deed the guide may be waiting for ('kill').
function guideDid(deed) {
  const step = GUIDE[player.tutorial - 1];
  if (step && step.on === deed) player.tutorial++;
}

// What the arrow points at now: { x, y, z }, or null.
function guideTarget(step) {
  for (const t of step.target || []) {
    if (t.level && player.level < t.level) continue;
    if (t.quest && (questState(t.quest) !== 'active' || !stepReady(t.quest))) continue; // only a step that's ready to hand in
    if (t.quest && !t.npc) { // the NPC this quest's current step is reported to
      const q = player.quests[t.quest], def = QUESTS[t.quest];
      const st = q && q.status === 'active' && (def.steps || [])[q.step];
      const n = st !== undefined && npcs.find(c => c.npcId === ((st && st.npc) || def.giver));
      if (n) return n;
      continue;
    }
    if (t.npc) {
      const n = npcs.find(c => c.npcId === t.npc);
      if (n) return n;
    }
    if (t.news) { // the first of these NPCs who has a quest for you, or news to hear
      const n = t.news.map(id => npcs.find(c => c.npcId === id)).find(c => c && ['offer', 'report'].includes((questNews(c.npcId) || {}).mark));
      if (n) return n;
    }
    const near = list => list.filter(c => c.z === player.z && dist(c, player) <= 12).sort((a, b) => dist(a, player) - dist(b, player))[0];
    if (t.monster) {
      const m = near(monsters.filter(c => !c.dead && c.type === t.monster));
      if (m) return m;
    }
    if (t.hunt) { // the nearest monster that one of these quests still asks you to kill, or else where they live
      // (only those still short: once the pack is done, the arrow goes to its leader, the boss)
      const wanted = t.hunt.filter(id => questState(id) === 'active' && !stepReady(id))
        .flatMap(id => Object.entries(questStep(id).kill || {}).filter(([type, n]) => ((player.quests[id].kills || {})[type] || 0) < n).map(([type]) => type));
      const m = near(monsters.filter(c => !c.dead && wanted.includes(c.type)));
      if (m) return m;
      const home = map.spawns.filter(s => s.z === player.z && wanted.includes(s.type)).sort((a, b) => dist(a, player) - dist(b, player))[0];
      if (home) return { x: home.x, y: home.y, z: home.z };
    }
    if (t.corpse) {
      const c = near(piles.filter(p => p.corpse));
      if (c) return c;
    }
    if (t.at && t.at[2] === player.z) return { x: t.at[0], y: t.at[1], z: t.at[2] };
  }
  return null;
}

// ---- the island is one way ----------------------------------------------------------------
// Brightwater Isle (map.isle) is where everyone starts, and the Seer sends you on from
// there once you choose a vocation. Nobody sails or flies back: what you didn't find on
// the island, you never will.
const onIsle = p => !!map.isle && p.x >= map.isle.x0 && p.x <= map.isle.x1 && p.y >= map.isle.y0 && p.y <= map.isle.y1;

// Why a ride from here to there can't go, or null if it can.
function isleBars(to) {
  if (!map.isle) return null;
  const there = onIsle(to), here = onIsle(player);
  if (player.vocation !== 'none' && there && !here) return 'Nobody takes you back to the starter island. Once you have chosen your path, the island is behind you for good.';
  if (player.vocation === 'none' && here && !there) return 'Nobody leaves Oakvale Isle without a vocation. The oracle, upstairs in the academy, sends you to the mainland once you are level 10.';
  return null;
}
