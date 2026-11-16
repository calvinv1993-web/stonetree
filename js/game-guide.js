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
// computer (CSS selectors): the first one in sight is lit while the rest of the screen dims, with a hand pointing
// at it (game-ui.js GuideSpot). art: a little picture in the guide's box (GUIDE_ART in game-ui.js). gift: things
// handed to you when the step comes up (once: its flag), with who gives them and what they say. client: a step the
// browser sees done (it calls Actions.guideNext; it has no Next button); touchOnly: only for a phone (passed at once
// on a computer).
const GUIDE = [
  // ---- the basics, one thing at a time (a step without done or on is read and passed with "Next") ----
  {
    text: 'Welcome to Oakvale Isle! This guide shows you how everything works, one thing at a time. When it asks you to do something, do it and it moves on by itself. Press Next to begin.',
    touch: 'Welcome to Oakvale Isle! This guide shows you how everything works, one thing at a time. When it asks you to do something, do it and it moves on by itself. Tap Next to begin.',
    art: 'welcome',
  },
  {
    text: 'Your health and mana are in the panel on the right. Red is your health: when it runs out, you die. Blue is your mana, for spells. Under them, your experience: when it is full you reach the next level.',
    touch: 'At the top: red is your health (when it runs out, you die), blue is your mana (for spells). Under them, your experience: when the bar is full you reach the next level.',
    ui: ['#touch .hud'], uiDesk: ['.sec-status'],
    art: 'bars',
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
    art: 'words',
  },
  {
    text: 'You have a quest! The Quests tab, in the panel on the right, always says where to go next, and the yellow arrow points the way. Lost? Look there.',
    touch: 'You have a quest! Whenever you are lost: the yellow arrow points the way, and the backpack button (bottom right), then Quests, says what to do next.',
    ui: ['#inventoryDrawer .drawer-tabs [data-page="quests"]', '#hudBag'], uiDesk: ['[data-tab="quests"]'],
    art: 'lost',
  },
  {
    text: 'Space attacks the nearest monster (press it again for the next one). A monster you click is attacked too, someone you click is talked to.',
    touch: 'The big button in the middle does what the moment asks, and its colour says what: red attacks the nearest monster, blue talks to someone near, amber opens a corpse, green uses a door or chest. Grey: nothing to do here. You will use it a lot.',
    ui: ['#tAttack'], uiDesk: ['#hotbar'],
    art: 'smart',
  },
  {
    text: 'Master Corwin teaches at the academy, west of the temple over the bridge: follow the arrow. Talk to him, and ask him about the bell.',
    touch: 'Master Corwin teaches at the academy, west of the temple over the bridge: follow the arrow. Tap him, then tap Bell.',
    target: [{ npc: 'corwin' }],
    // (done once he has heard about the bell: then the rats he asks for count)
    done: () => !!player.quests.bell_1 && (player.quests.bell_1.step > 0 || player.quests.bell_1.status === 'done'),
  },
  {
    text: 'Master Corwin gave you a leather cap! Put it on: drag it from your bag onto your head in the equipment (or right-click it). Your armour goes up.',
    touch: 'Master Corwin gave you a leather cap! Put it on: open the backpack, tap the cap, then Wear. Your armour goes up.',
    gift: { flag: 'guide_kit', items: [['leather_cap', 1]], from: 'Master Corwin',
      say: 'Nobody leaves my academy bare-headed. Take this cap, and put it on before you go out. A shield you will have to earn.' },
    art: 'gear', ui: ['#inventoryDrawer .slot[data-item="leather_cap"]', '#hudBag'], uiDesk: ['#containers', '.sec-equip'],
    done: () => !!player.equipment.head,
  },
  {
    text: 'Before you go out of town: if you die, you wake in the temple. Until you choose a vocation you keep all your things, and your level: you only lose a little experience. In the temple, the depot and the shops nothing can hurt you: rest there to heal.',
    touch: 'Before you go out of town: if you die, you wake in the temple. Until you choose a vocation you keep all your things, and your level: you only lose a little experience. In the temple, the depot and the shops nothing can hurt you: rest there to heal.',
    art: 'death',
  },
  {
    text: 'On your way to the rats: train! The training yard is in the south-west of town, by the south gate. Click a dummy and you keep hitting it until you walk away. Every hit raises your weapon skill, and a higher skill hits harder. Hit it 5 times ($trained).',
    touch: 'On your way to the rats, train: tap a dummy in the training yard (south-west of town, by the south gate) and you keep hitting it until you walk away. Every hit raises your weapon skill, and a higher skill hits harder. Hit it 5 times ($trained).',
    target: [{ at: [110, 141, 8] }],
    done: () => player.trainHits >= 5,
    art: 'train',
  },
  {
    text: 'Rats run in Sunny Fields, out of the south gate. Click a rat, or press Space. Rats are easy; grey wolves come in packs and are not: keep away from them for now. Kill 5 rats ($progress).',
    touch: 'Rats run in Sunny Fields, out of the south gate. Press the big red button near a rat, or tap the rat. Rats are easy; grey wolves come in packs and are not: keep away from them for now. Kill 5 rats ($progress).',
    target: [{ monster: 'rat' }, { at: [128, 150, 8] }],
    done: () => ratsDone(), // (the five for Corwin: also if they fell while an earlier step was still being read)
    art: 'rats',
  },
  {
    text: 'Monsters leave a corpse with loot. Right-click it to open it, then take what you want (Take all takes everything). Gold goes straight into your purse.',
    touch: 'Monsters leave a corpse with loot. Press the big button when it turns amber (or hold the corpse) to open it, then take what you want: Take all takes everything. Gold goes straight into your purse.',
    target: [{ corpse: true }],
    done: () => !!(player.openPile && player.openPile.corpse),
    art: 'loot',
  },
  {
    text: 'With a full stomach you heal much faster. Eat an apple: right-click it in your bag.',
    touch: 'With a full stomach you heal much faster. Open the backpack, tap an apple, then Use to eat it.',
    ui: ['#inventoryDrawer .slot[data-item="apple"]', '#hudBag'], uiDesk: ['#containers'],
    done: () => player.fedUntil > now,
    art: 'eat',
  },
  {
    text: 'The bar under the map: your spells on 1 to 9 (they come with levels), H for a health potion, M for mana, F to eat. Low on health? Press H.',
    touch: 'The buttons beside the big one: spells on the left, potions and food on the right. Low on health? Tap the red potion. Hold a button to choose what goes there; swipe sideways for more.',
    ui: ['#favs'], uiDesk: ['#hotbar'],
    art: 'actions',
  },
  {
    // (a phone's action buttons live in the browser, not in the game: touch.js sees Eat put on one and moves the guide on;
    // a computer has F for eating and passes this step at once)
    text: 'Press F to eat whenever you like.',
    touch: 'Now try it: put Eat on your last action button. Tap the empty + on the far right, then choose Eat. From then on one tap eats, wherever you are.',
    client: 'eatSlot', touchOnly: true, art: 'eatslot',
    ui: ['#favPicker:not([hidden]) [data-action="f"]', '#favs .fav:nth-child(6)'],
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
    art: 'map',
  },
  // ---- level 2: a light, and the first way under the town ----
  {
    text: 'Level 2 brings your first spell: Torchlight. Press 1 (or say "lumen") to glow like a torch for three minutes. The sewers are dark: try it now.',
    touch: 'Level 2 brings your first spell: Torchlight! Tap its button on the left (still an empty +? Tap it and choose Torchlight first): you glow like a torch for three minutes. The sewers are dark: try it now.',
    art: 'torch', ui: ['#favPicker:not([hidden]) [data-action="light"]', '#favs .fav:nth-child(1)'], uiDesk: ['#hotbar'],
    target: [{ monster: 'rat' }, { at: [128, 150, 8] }],
    done: () => player.level >= 2 && player.lightUntil > now,
  },
  {
    text: 'Master Corwin has a task for you under the town: a shield the rats stole. Talk to him and ask about the shield.',
    touch: 'Master Corwin has a task for you under the town: a shield the rats stole. Talk to him and ask about the shield.',
    target: [{ news: ['corwin'] }, { npc: 'corwin' }],
    done: () => questState('cellar_shield') !== 'none',
  },
  {
    text: 'Down the grate on the square into the sewers (the arrow). Kill 5 rats ($progress), then open the old chest in the storeroom at the west end and put on the shield.',
    touch: 'Down the grate on the square into the sewers (the arrow): tap the grate to climb down. Kill 5 rats ($progress), then open the old chest in the storeroom at the west end and put on the shield.',
    art: 'sewer',
    target: [{ at: [131, 111, 8] }, { hunt: ['cellar_shield'] }, { at: [105, 121, 7] }],
    done: () => !!player.equipment.shield,
  },
  {
    text: 'A shield! Blows glance off it now. Climb back up the ladder and tell Master Corwin.',
    touch: 'A shield! Blows glance off it now. Climb back up the ladder and tell Master Corwin.',
    target: [{ at: [131, 111, 7] }, { quest: 'cellar_shield' }, { npc: 'corwin' }],
    done: () => questState('cellar_shield') === 'done',
  },
  // ---- Clang: the temple's cat, a companion for the road ----
  {
    text: 'Sister Ama has lost her cat, Clang: he chased the rats down into the bell cellar under the temple. Ask her about Clang.',
    touch: 'Sister Ama has lost her cat, Clang: he chased the rats down into the bell cellar under the temple. Ask her about Clang.',
    target: [{ news: ['ama'] }, { npc: 'ama' }],
    done: () => questState('clang_rescue') !== 'none',
  },
  {
    text: 'Down the grate on the square, then north under it to the bell cellar. Kill the rats there ($progress), then move the fallen crate at its east end.',
    touch: 'Down the grate on the square, then north under it to the bell cellar. Kill the rats there ($progress), then tap the fallen crate at its east end.',
    art: 'clang',
    target: [{ at: [131, 111, 8] }, { hunt: ['clang_rescue'] }, { at: [148, 105, 7] }],
    done: () => questState('clang_rescue') === 'done' || (!!player.quests.clang_rescue && player.quests.clang_rescue.step >= 2),
  },
  {
    text: 'Clang is free! Bring him home to Sister Ama: he will follow you. From then on he fights at your side, and grows stronger as he fights and trains with you.',
    touch: 'Clang is free! Bring him home to Sister Ama: he will follow you. From then on he fights at your side, and grows stronger as he fights and trains with you.',
    art: 'clang',
    target: [{ at: [131, 111, 7] }, { quest: 'clang_rescue' }, { npc: 'ama' }],
    done: () => questState('clang_rescue') === 'done',
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
    minLevel: 5, // (till then: hunt at the gates)
  },
  {
    text: 'Sister Ama must hear about the note. Then, at level 6: down a sewer grate, east to the rats\' nest under the graveyard, and down its trapdoors to the old drains and the deep cistern. The rope lies past the great slime. Take many potions, and say "lumen" for light.',
    touch: 'Sister Ama must hear about the note. Then, at level 6: down a sewer grate, east to the rats\' nest under the graveyard, and down its trapdoors to the old drains and the deep cistern. The rope lies past the great slime. Take many potions, and say "lumen" for light.',
    target: [{ quest: 'bell_3' }, { news: ['ama'] }, { hunt: ['bell_3'] }, { at: [147, 102, 5] }, { at: [128, 111, 6] }, { at: [147, 139, 7] }, { at: [131, 111, 8] }],
    done: () => questState('bell_3') === 'done',
    minLevel: 6, // (till then: hunt at the gates)
  },
  {
    text: 'Last of all, at level 8: the Gravewaker, in the founder\'s tomb below the crypt. Ask Sister Ama about him; the iron gate in the crypt will open then. Bring ten potions and your best armour.',
    touch: 'Last of all, at level 8: the Gravewaker, in the founder\'s tomb below the crypt. Ask Sister Ama about him; the iron gate in the crypt will open then. Bring ten potions and your best armour.',
    target: [{ quest: 'bell_4' }, { news: ['ama'] }, { hunt: ['bell_4'] }, { at: [69, 176, 6] }, { at: [66, 181, 7] }, { at: [81, 198, 8] }],
    done: () => questState('bell_4') === 'done',
    minLevel: 8, // (till then: hunt at the gates)
  },
  {
    text: 'The bell rings, but the Choir is not done: at level 8, Master Corwin has news of lights at Lighthouse Point. Ask him about the choir, then go and see Keeper Tamsin.',
    touch: 'The bell rings, but the Choir is not done: at level 8, Master Corwin has news of lights at Lighthouse Point. Ask him about the choir, then go and see Keeper Tamsin.',
    target: [{ quest: 'bell_5' }, { news: ['corwin', 'oak_keeper'] }, { hunt: ['bell_5'] }, { npc: 'oak_keeper' }],
    done: () => questState('bell_5') === 'done',
    minLevel: 8, // (till then: hunt at the gates)
  },
  {
    text: 'Level 10! Before you choose your vocation, Sister Ama has one last thing for you: ring the bell yourself, then say farewell to Corwin, Pip and Sergeant Bram, and come back to her.',
    touch: 'Level 10! Before you choose your vocation, Sister Ama has one last thing for you: ring the bell yourself, then say farewell to Corwin, Pip and Sergeant Bram, and come back to her.',
    // (the bell: the stairs up on each floor of the tower, then the bell at the top)
    target: [{ quest: 'bell_6' }, { news: ['ama'] }, { at: [145, 102, 13] }, { at: [145, 101, 12] }, { at: [147, 101, 11] }, { at: [145, 101, 10] }, { at: [147, 101, 9] }, { at: [145, 101, 8] }],
    done: () => questState('bell_6') === 'done',
    minLevel: 10, // (till then: hunt at the gates)
  },
  {
    text: 'Sister Ama has said goodbye. Last of all: the oracle, upstairs in the academy. Ask her about your destiny, and choose your vocation: knight, paladin, sorcerer or druid (ask about each before you decide).',
    touch: 'Sister Ama has said goodbye. Last of all: the oracle, upstairs in the academy. Ask her about your destiny, and choose your vocation: knight, paladin, sorcerer or druid (ask about each before you decide).',
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
  else {
    if (step.gift && !player.chests[step.gift.flag]) guideGift(step.gift);
    player.guideSeen = Math.max(player.guideSeen || 0, player.tutorial);
    if ((step.done && step.done()) || (step.done && guideBeen(player.tutorial))) player.tutorial++;
  }
}

// A step to do that was done before the guide was started again: it passes by itself (opening a corpse or eating
// can't be asked of you twice). A step you'd reached before, or one of the basics once the first quest is done.
const GUIDE_BASICS = GUIDE.findIndex(s => (s.target || []).some(t => t.quest === 'bell_1')) + 1;
const guideBeen = step => step < (player.guideSeen || 0) || (step < GUIDE_BASICS && questState('bell_1') === 'done');

// The guide's present for a step (once): into the bag, with a word from whoever gives it
function guideGift(gift) {
  player.chests[gift.flag] = true;
  for (const [id, n] of gift.items) giveItem(id, n);
  logDialog(gift.from, gift.say);
  log(`${gift.from} gives you ${gift.items.map(([id, n]) => itemName(id, n)).join(' and ')}.`, 'level');
  addSparkle(player, '#ffe080');
  uiDirty();
}

// A deed the guide may be waiting for ('kill').
function guideDid(deed) {
  const step = GUIDE[player.tutorial - 1];
  if (step && step.on === deed) player.tutorial++;
}

// What the arrow points at now: { x, y, z }, or null.
function guideTarget(step) {
  // a step for a higher level than yours: the arrow to the nearest gate guard (a hunt there grows you)
  if (step.minLevel && player.level < step.minLevel) {
    return ['gate_west', 'gate_south', 'gate_east', 'gate_north'].map(id => npcs.find(c => c.npcId === id)).filter(Boolean)
      .sort((a, b) => dist(a, player) - dist(b, player))[0] || null;
  }
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
      // (not for a hunt that comes again and again: the guide follows the story; nor a hidden quest: those are found)
      const n = t.news.map(id => npcs.find(c => c.npcId === id)).find(c => { const news = c && questNews(c.npcId, true); return news && ['offer', 'report'].includes(news.mark) && !(QUESTS[news.id] || {}).repeat && !(QUESTS[news.id] || {}).hidden; });
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
