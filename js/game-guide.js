'use strict';
// The guide for new adventurers on Oakvale Isle: one thing at a time (renderGuide in game-ui.js), through The Silent
// Bell and the gate watch, to the oracle; through the basics an arrow points the way (drawGuideArrow in game.js), after
// them the map's circles (questAreas). You can put it away whenever you like.
// player.tutorial is the step you're on (1 is the first), 0 when the guide is done.

// text: what to do (touch: the same for a phone); target: what the arrow points at, the
// first of these that is there - an NPC, the nearest monster of a kind, the nearest
// corpse, a spot ([x, y, z]), or the first of some NPCs who has a quest or news for you (news) - see guideTarget (a target
// with active: 'quest' or 'quest@step' counts only while you're on it, with when: () => true only while that holds; lead: a spot until you're near it, then no arrow;
// nest: the nearest spider nest you haven't burnt); done: when the step is done (as the
// player), or on: the deed that does it (see guideDid). A step with neither just explains: it waits for "Next"
// (Actions.guideNext), and the last step for "Got it". ui / uiDesk: the parts of the screen it's about on a phone / a
// computer (CSS selectors): the first one in sight is lit while the rest of the screen dims, with a hand pointing
// at it (game-ui.js GuideSpot). art: a little picture in the guide's box (GUIDE_ART in game-ui.js). gift: things
// handed to you when the step comes up (once: its flag), with who gives them and what they say. client: a step the
// browser sees done (it calls Actions.guideNext; it has no Next button); touchOnly: only for a phone (passed at once
// on a computer). basicsEnd: the last step with an arrow (guideArrowOn): after it, the map's circles show the way.
const GUIDE = typeof KESTREL_PREVIEW !== 'undefined' && KESTREL_PREVIEW ? kestrelGuide() : [
  // ---- the basics, the first half hour: one thing at a time, each as it's needed (a step without done or on is read
  // and passed by itself): the world, walking, talking, a fight, healing after it, the loot, what dying means, gear,
  // trading, the locker; then Farmer Ned: down a grate, and a torch for the dark ----
  {
    text: 'Welcome to Oakvale Isle, a small island at the edge of a wide and dangerous world. Monsters roam its woods and caves, and across the sea waits the mainland, where the real adventures are. Here you learn the ropes - and you are not alone: other adventurers walk this isle with you, and together you are stronger.',
    touch: 'Welcome to Oakvale Isle, a small island at the edge of a wide and dangerous world. Monsters roam its woods and caves, and across the sea waits the mainland, where the real adventures are. Here you learn the ropes - and you are not alone: other adventurers walk this isle with you, and together you are stronger.',
  },
  {
    text: 'First, walking: go to the temple\'s door, where the yellow arrow points. Click where you want to go, or walk with W A S D or the arrow keys.',
    touch: 'First, walking: go to the temple\'s door, where the yellow arrow points. Tap where you want to go, or drag your thumb over the screen like a joystick.',
    target: [{ at: [map.start.x, map.start.y + 3, map.start.z] }], // (the temple's doorway, just south of where you wake)
    done: () => dist(player, map.start) >= 3 || player.z !== map.start.z || talkingTo('ama') || questState('bell_1') !== 'none', // (or found Ama already, or the guide started again)
  },
  {
    text: 'Now walk back to Sister Ama by the altar, and talk to her: click her (or type hi and press Enter). The gold words in what she says are things you can ask about: click one. Ask her about the bell, then say yes.',
    touch: 'Now walk back to Sister Ama by the altar, and talk to her: tap her. The gold words in what she says are things you can ask about: tap Bell, then Yes.',
    target: [{ npc: 'ama' }],
    ui: ['#talkWords'],
    done: () => questState('bell_1') !== 'none',
    art: 'words',
  },
  {
    text: 'Master Corwin teaches at the academy, south of the square (the yellow roof): follow the arrow. Lost? The Quests tab, in the panel on the right, always says what to do next. Talk to him, and ask him about the bell.',
    touch: 'Master Corwin teaches at the academy, south of the square (the yellow roof): follow the arrow. Lost? The backpack button, then Quests, says what to do next. Tap him, then tap Bell.',
    target: [{ npc: 'corwin' }],
    done: () => !!player.quests.bell_1 && (player.quests.bell_1.step > 0 || player.quests.bell_1.status === 'done'),
  },
  {
    text: 'A fight! Out of the south gate, rats run in Sunny Fields. Watch your health, the red bar: when it runs out, you die. Click a rat to attack it, or press Space to attack the nearest monster. Kill one.',
    touch: 'A fight! Out of the south gate, rats run in Sunny Fields. Watch your health, the red bar: when it runs out, you die. The big button does what the moment asks: red attacks the nearest monster. Tap it, or tap a rat. Kill one.',
    ui: ['#tAttack'], uiDesk: ['.sec-status'],
    target: [{ monster: 'rat' }, { at: [126, 153, 8] }],
    done: () => ratsDone(),
    art: 'smart',
  },
  {
    text: 'After a fight, heal first: the loot can wait. Eat an apple (right-click it in your bag, or press F): with a full stomach you heal much faster. Badly hurt? Drink a health potion (H).',
    touch: 'After a fight, heal first: the loot can wait. Open the backpack, tap an apple, then Use: with a full stomach you heal much faster. Badly hurt? Tap the red potion.',
    ui: ['#inventoryDrawer .slot[data-item="apple"]', '#hudBag'], uiDesk: ['#containers'],
    done: () => player.fedUntil > now || !!player.chests.guide_healed,
    art: 'eat',
  },
  {
    // (a phone's action buttons live in the browser, not in the game: touch.js sees Eat put on one and moves the guide on;
    // a computer has F for eating and passes this step at once)
    text: 'Press F to eat whenever you like.',
    touch: 'The buttons beside the big one: spells on the left, potions and food on the right (low on health? tap the red potion). Put Eat on your last one: tap the empty + on the far right, then choose Eat.',
    client: 'eatSlot', touchOnly: true, art: 'eatslot',
    ui: ['#favPicker:not([hidden]) [data-action="f"]', '#favs .fav:nth-child(6)'],
  },
  {
    text: 'Now the loot: the rat left a corpse. Right-click it to open it, then take what you want (Take all takes everything). Gold goes straight into your purse.',
    touch: 'Now the loot: the rat left a corpse. Press the big button when it turns amber (or hold the corpse) to open it, then take what you want: Take all takes everything. Gold goes straight into your purse.',
    target: [{ corpse: true }, { monster: 'rat' }, { at: [126, 153, 8] }],
    done: () => !!(player.openPile && player.openPile.corpse),
    art: 'loot',
  },
  {
    text: 'And if your health runs out? Here on Oakvale Isle it costs little: you wake up in the temple with everything you carry, a bit of experience gone but never a level. Once you have chosen a vocation and sail for the mainland, it costs more: a tenth of your experience (levels too), and some of what you carry can be lost. That is what the depot is for.',
    touch: 'And if your health runs out? Here on Oakvale Isle it costs little: you wake up in the temple with everything you carry, a bit of experience gone but never a level. Once you have chosen a vocation and sail for the mainland, it costs more: a tenth of your experience (levels too), and some of what you carry can be lost. That is what the depot is for.',
  },
  {
    text: 'Back to Master Corwin at the academy: tell him about the bell.',
    touch: 'Back to Master Corwin at the academy: tap him, then Bell.',
    target: [{ quest: 'bell_1' }],
    done: () => !!player.quests.bell_1 && (player.quests.bell_1.step > 1 || player.quests.bell_1.status === 'done'),
  },
  {
    text: 'Master Corwin gave you a leather cap! Put it on: drag it from your bag onto your head in the equipment (or right-click it). Your armour goes up.',
    touch: 'Master Corwin gave you a leather cap! Put it on: open the backpack, tap the cap, then Wear. Your armour goes up.',
    gift: { flag: 'guide_kit', items: [['leather_cap', 1]], from: 'Master Corwin',
      say: 'Nobody leaves my academy bare-headed. Take this cap, and put it on. A shield you will have to earn.' },
    art: 'gear', ui: ['#inventoryDrawer .slot[data-item="leather_cap"]', '#hudBag'], uiDesk: ['#containers', '.sec-equip'],
    done: () => !!player.equipment.head,
  },
  {
    text: 'Pip\'s Provisions, east of the square: give Pip the note (ask him about it), then trade. Sell him what you found, and buy something - a potion is never wasted.',
    touch: 'Pip\'s Provisions, east of the square: tap Pip, then Note; then Trade. Sell him what you found, and buy something - a potion is never wasted.',
    target: [{ quest: 'bell_1', active: 'bell_1@2' }, { npc: 'pip' }], // (after the note: still Pip, to trade)
    done: () => !!player.quests.bell_1 && (player.quests.bell_1.step > 2 || player.quests.bell_1.status === 'done') && !!player.chests.guide_bought && (!!player.chests.guide_sold || !bagItems().some(it => ITEMS[it.id] && BUYS.loot(ITEMS[it.id]))),
  },
  {
    text: 'The depot, by the canal south of the square: ask Postmaster Hobb about your locker, then open a locker and put something in it. What lies there is safe, whatever happens to you.',
    touch: 'The depot, by the canal south of the square: tap Postmaster Hobb, then Locker; then tap a locker and put something in it. What lies there is safe, whatever happens to you.',
    target: [{ quest: 'bell_1', active: 'bell_1@3' }, { npc: 'postmaster' }], // (after asking: still the depot, to fill a locker)
    done: () => !!player.quests.bell_1 && (player.quests.bell_1.step > 3 || player.quests.bell_1.status === 'done') && !!(player.depot && player.depot.contents.length),
  },
  {
    text: 'Back to Sister Ama in the temple: tell her about the bell.',
    touch: 'Back to Sister Ama in the temple: tap her, then Bell.',
    target: [{ quest: 'bell_1' }],
    done: () => questState('bell_1') === 'done',
  },
  {
    text: 'Farmer Ned, at the hay barn at the end of the academy lane (south-west of town), has rats in his grain. Ask him about the rats.',
    touch: 'Farmer Ned, at the hay barn at the end of the academy lane (south-west of town), has rats in his grain. Tap him, then Rats.',
    target: [{ npc: 'oak_farmer' }],
    done: () => questState('farm_rats') !== 'none',
  },
  {
    text: 'The rats come up out of the sewers. Stairs, ladders and grates take you a floor up or down: use the grate on the square (right-click it, or click it when you stand by it; walking over it does nothing) to climb down.',
    touch: 'The rats come up out of the sewers. Stairs, ladders and grates take you a floor up or down: tap the grate on the square when you stand by it (walking over it does nothing) to climb down.',
    target: [{ at: [...OAKVALE.grates[0], 8] }],
    done: () => player.z < map.surfaceZ || questState('farm_rats') === 'done',
    art: 'sewer',
  },
  {
    text: 'It\'s dark down here. Light Farmer Ned\'s torch: right-click it in your bag. Later you learn a spell for this.',
    touch: 'It\'s dark down here. Light Farmer Ned\'s torch: open the backpack, tap the torch, then Use. Later you learn a spell for this.',
    ui: ['#inventoryDrawer .slot[data-item="farm_torch"]', '#hudBag'], uiDesk: ['#containers'],
    done: () => player.lightUntil > now || questState('farm_rats') === 'done',
  },
  {
    text: 'Kill 5 rats ($progress), climb back up the ladder under the grate, and tell Farmer Ned.',
    touch: 'Kill 5 rats ($progress), climb back up the ladder under the grate, and tell Farmer Ned.',
    target: [{ hunt: ['farm_rats'] }, { at: [...OAKVALE.grates[0], 7], when: () => player.z < map.surfaceZ && stepReady('farm_rats') }, { quest: 'farm_rats', npc: 'oak_farmer' }],
    done: () => questState('farm_rats') === 'done',
  },
  {
    text: 'That was the basics! From here on there is no arrow: you find your own way. When you take on a task, the map marks roughly where it is with a gold circle, and its button gets a dot. The Quests tab always says what to do next.',
    touch: 'That was the basics! From here on there is no arrow: you find your own way. When you take on a task, the map marks roughly where it is with a gold circle, and the map button gets a dot. The Quests tab always says what to do next.',
    ui: ['#hudMap'], uiDesk: ['#mmWorld'], art: 'questmap', basicsEnd: true,
  },
  // ---- the story, a chapter at a time: the arrow follows it to the oracle ----
  {
    text: 'Level 2: your first spell, Torchlight (press 1, or say "lumen"). Master Corwin has a task under the town: a shield the rats stole. Down the grate on the square, kill 5 rats ($progress), take the shield from the old chest in the storeroom, and tell him.',
    touch: 'Level 2: your first spell, Torchlight (its button on the left). Master Corwin has a task under the town: a shield the rats stole. Down the grate on the square, kill 5 rats ($progress), take the shield from the old chest in the storeroom, and tell him.',
    art: 'sewer',
    // (the grate on the square; the rats; the storeroom's chest till it's open; the ladder back up; Corwin)
    target: [{ news: ['corwin'], when: () => questState('cellar_shield') === 'none' }, { at: [...OAKVALE.grates[0], 8], active: 'cellar_shield@0' }, { hunt: ['cellar_shield'] },
      { at: [105, 121, 7], when: () => !player.chests.oak_hoard }, { at: [...OAKVALE.grates[0], 7], active: 'cellar_shield@1' }, { quest: 'cellar_shield' }],
    done: () => questState('cellar_shield') === 'done',
  },
  {
    text: 'Sister Ama has lost her cat, Clang, in the bell cellar under the temple (down the grate on the square, then north): she thinks he knows where the bell\'s clapper went. Kill the rats there ($progress), move the fallen crate, and bring him home: he fights at your side from then on.',
    touch: 'Sister Ama has lost her cat, Clang, in the bell cellar under the temple (down the grate on the square, then north): she thinks he knows where the bell\'s clapper went. Kill the rats there ($progress), tap the fallen crate, and bring him home: he fights at your side from then on.',
    art: 'clang',
    // (the grate; the rats in the bell cellar; the fallen crate; the ladder back up; Ama)
    target: [{ news: ['ama'], when: () => questState('clang_rescue') === 'none' }, { at: [...OAKVALE.grates[0], 8], when: () => questOnStep('clang_rescue@0') || questOnStep('clang_rescue@1') }, { hunt: ['clang_rescue'] },
      { at: [148, 105, 7], active: 'clang_rescue@1' }, { at: [...OAKVALE.grates[0], 7], active: 'clang_rescue@2' }, { quest: 'clang_rescue' }],
    done: () => questState('clang_rescue') === 'done',
  },
  {
    text: 'Grow stronger before the dark places: the four gate guards each have a task and gear for you, one after the other. West (Greyfang, the grey wolf), south (a stranded fisher), east (spider nests), north (Chief Gnash\'s war plans).',
    touch: 'Grow stronger before the dark places: the four gate guards each have a task and gear for you, one after the other. West (Greyfang, the grey wolf), south (a stranded fisher), east (spider nests), north (Chief Gnash\'s war plans).',
    target: [{ news: ['gate_west', 'gate_south', 'gate_east', 'gate_north'] },
      { hunt: ['gate_west', 'gate_south', 'gate_east', 'gate_north'] },
      { monster: 'greyfang', active: 'gate_west' }, { lead: [69, 98, 8], near: 5, active: 'gate_west' },
      { at: [101, 220, 8], active: 'gate_south@0' }, { nest: true, active: 'gate_east@0' }, { at: [198, 70, 8], active: 'gate_north@0' },
      { quest: 'gate_west' }, { quest: 'gate_south' }, { quest: 'gate_east' }, { quest: 'gate_north' },
      // (the next guard who will have a task, once you're strong enough)
      ...[['gate_south', 3], ['gate_east', 4], ['gate_north', 5]].map(([id, level]) => ({ npc: id, level, when: () => questState(id) === 'none' }))],
    done: () => ['gate_west', 'gate_south', 'gate_east', 'gate_north'].every(id => questState(id) === 'done') || questState('bell_6') !== 'none',
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
    text: 'Sister Ama has said goodbye. Last of all: the oracle, upstairs in the academy. Ask her about your destiny, and choose your vocation: Bastion, Hawk, Ember or Grove (ask about each before you decide).',
    touch: 'Sister Ama has said goodbye. Last of all: the oracle, upstairs in the academy. Ask her about your destiny, and choose your vocation: Bastion, Hawk, Ember or Grove (ask about each before you decide).',
    target: [{ npc: 'oak_oracle', level: 10 }],
  },
];

// The guide on Kestrel Isle (the new world's preview): the basics in the temple, Clang under the town (your first
// fights, your first loot), then the Hall of Paths: the four paths explained, tried, and one chosen.
function kestrelGuide() {
  const K = KESTREL, at = (ax, ay, z) => [K.isleAt[0] + K.townAt[0] + ax, K.isleAt[1] + K.townAt[1] + ay, z], S = 8;
  const grate = at(...K.sewers.grates[0], S), cellar = at((K.sewers.rooms[0][0] + K.sewers.rooms[0][2]) >> 1, (K.sewers.rooms[0][1] + K.sewers.rooms[0][3]) >> 1, S - 1), crate = K.sewers.props.find(p => p[2] === 'clang_crate');
  const stamped = v => !!(player.paths || {})[v];
  return Object.assign([
    {
      text: 'Welcome to Kestrel Isle! In the panel on the right: red is your health (when it runs out, you die), blue your mana, for spells, and under them your experience: full, and you reach the next level. When this guide asks you to do something, do it and it moves on by itself.',
      touch: 'Welcome to Kestrel Isle! At the top: red is your health (when it runs out, you die), blue your mana, for spells, and under them your experience: full, and you reach the next level. When this guide asks you to do something, do it and it moves on by itself.',
      ui: ['#touch .hud'], uiDesk: ['.sec-status'], art: 'bars',
    },
    {
      text: 'Sister Ama stands by the altar: the yellow arrow points at her. Walk with W A S D or the arrow keys (or click where to go), then click her to talk.',
      touch: 'Sister Ama stands by the altar: the yellow arrow points at her. Tap where to go (or drag over the map), then tap her to talk.',
      target: [{ npc: 'ama' }],
      done: () => talkingTo('ama') || questState('clang_rescue') !== 'none',
    },
    {
      text: 'The gold words are things you can ask about: click one, or type it. Ask Sister Ama about Clang, then say yes.',
      touch: 'The gold words are things you can ask about: tap one. Ask Sister Ama about Clang, then tap yes.',
      target: [{ npc: 'ama' }], ui: ['#talkWords'], art: 'words',
      done: () => questState('clang_rescue') !== 'none',
    },
    {
      text: 'You have a quest! The Quests tab, in the panel on the right, always says where to go next, and the yellow arrow points the way. The minimap shows the land round you; G opens the map of the whole island.',
      touch: 'You have a quest! Lost? The yellow arrow points the way, and the backpack button (bottom right), then Quests, says what to do next. The map button (top left) shows the land round you.',
      ui: ['#inventoryDrawer .drawer-tabs [data-page="quests"]', '#hudBag'], uiDesk: ['[data-tab="quests"]'], art: 'lost',
    },
    {
      text: 'Down the steps to the square, and down the grate in the middle of it: click the grate (or use it) to climb down into the sewers.',
      touch: 'Down the steps to the square, and down the grate in the middle of it: tap the grate to climb down into the sewers.',
      target: [{ at: grate }],
      done: () => player.z < S || questState('clang_rescue') === 'done',
    },
    {
      text: 'The bell cellar lies north, under the temple, and it is full of rats. Space attacks the nearest monster (again for the next one), or click one. Kill 3 rats there ($progress).',
      touch: 'The bell cellar lies north, under the temple, and it is full of rats. The big button does what the moment asks: red attacks the nearest monster, amber opens a corpse. Kill 3 rats there ($progress).',
      ui: ['#tAttack'], uiDesk: ['#hotbar'], art: 'smart',
      target: [{ monster: 'rat' }, { at: cellar }],
      done: () => !questOnStep('clang_rescue@0'),
    },
    {
      text: 'Monsters leave a corpse with loot. Right-click it to open it, then take what you want (Take all takes everything). Gold goes straight into your purse.',
      touch: 'Monsters leave a corpse with loot. Press the big button when it turns amber (or hold the corpse) to open it, then take what you want: Take all takes everything.',
      target: [{ corpse: true }], art: 'loot',
      done: () => !!(player.openPile && player.openPile.corpse) || !questOnStep('clang_rescue@1'),
    },
    {
      text: 'A small mew, from behind the fallen crate at the east end of the cellar: use the crate to move it, and free Clang.',
      touch: 'A small mew, from behind the fallen crate at the east end of the cellar: tap the crate to move it, and free Clang.',
      target: [{ at: at(crate[0], crate[1], S - 1) }],
      done: () => !questOnStep('clang_rescue@1'),
    },
    {
      text: 'With a full stomach you heal much faster. Eat something: right-click it in your bag. The bar under the map: spells on 1 to 9, H for a health potion, M for mana, F to eat.',
      touch: 'With a full stomach you heal much faster. Open the backpack, tap something to eat, then Use.',
      ui: ['#hudBag'], uiDesk: ['#containers'], art: 'eat',
      done: () => player.fedUntil > now,
    },
    {
      text: 'Clang follows you now. Bring him home: up a ladder, and back to Sister Ama in the temple.',
      touch: 'Clang follows you now. Bring him home: up a ladder, and back to Sister Ama in the temple.',
      target: [{ quest: 'clang_rescue' }, { npc: 'ama' }],
      done: () => questState('clang_rescue') === 'done',
    },
    {
      text: 'Every adventurer walks one of four paths. Go to the Hall of Paths, on the square, and talk to Pathkeeper Ilse: ask her about the paths.',
      touch: 'Every adventurer walks one of four paths. Go to the Hall of Paths, on the square, and talk to Pathkeeper Ilse: ask her about the paths.',
      target: [{ npc: 'pathkeeper' }],
      done: () => countItem('book_of_paths') > 0 || player.vocation !== 'none',
    },
    {
      text: 'Try all four! Each teacher in the hall lets you be their path for a while, down in their practice room: you can\'t die there. Ask a teacher for a trial ($paths tried). The Book of Paths in your bag shows all four.',
      touch: 'Try all four! Each teacher in the hall lets you be their path for a while, down in their practice room: you can\'t die there. Ask a teacher for a trial ($paths tried). The Book of Paths in your bag shows all four.',
      target: [{ npc: 'holt', when: () => !stamped('knight') && !player.trial }, { npc: 'sill', when: () => !stamped('paladin') && !player.trial },
        { npc: 'vela', when: () => !stamped('sorcerer') && !player.trial }, { npc: 'fennick', when: () => !stamped('druid') && !player.trial }],
      done: () => pathStamps() === 4 || (player.vocation !== 'none' && !player.trial),
    },
    {
      text: 'Which one made you grin? Tell Pathkeeper Ilse: ask her about that path, and say yes. It can\'t be undone.',
      touch: 'Which one made you grin? Tell Pathkeeper Ilse: ask her about that path, and tap yes. It can\'t be undone.',
      target: [{ npc: 'pathkeeper' }],
      done: () => player.vocation !== 'none' && !player.trial,
    },
    {
      text: 'You walk your path now! Kestrel Isle is yours to explore: the wilds beyond the walls, and the caves below. More of it is still being built. Good luck, $name.',
      touch: 'You walk your path now! Kestrel Isle is yours to explore: the wilds beyond the walls, and the caves below. More of it is still being built.',
    },
  ], { kestrel: true });
}

const talkingTo = id => !!(player.conversation && player.conversation.npc.npcId === id);
// Corwin's five rats are dead (his kill step is ready, or the bell quest has gone past it)
const ratsDone = () => { const q = player.quests.bell_1; return !!q && (q.status === 'done' || q.step > 1 || (q.step === 1 && stepReady('bell_1'))); };

// Every tick: on to the next step when this one is done.
function updateGuide() {
  if (!player.tutorial) return;
  const step = GUIDE[player.tutorial - 1];
  // (a vocation ends the guide - not a trial's, and not on Kestrel Isle, whose guide goes on past choosing one)
  if (!step || (player.vocation !== 'none' && !player.trial && !GUIDE.kestrel)) player.tutorial = 0;
  else {
    if (step.gift && !player.chests[step.gift.flag]) guideGift(step.gift);
    player.guideSeen = Math.max(player.guideSeen || 0, player.tutorial);
    if ((step.done && step.done()) || (step.done && guideBeen(player.tutorial))) player.tutorial++;
    else if (guideExplains(step) && guideRead(step)) player.tutorial++; // (read: on by itself, no "Next" needed)
  }
}

// A step that only explains (no task to do): it passes by itself once it's had time to be read, or as soon as you've
// already done the task after it (you didn't stop to read: you played on). "Next" still passes it at once.
// The time to read it: a few seconds, and a little more for each word.
const guideExplains = step => !step.done && !step.on && !step.client && step !== GUIDE[GUIDE.length - 1];
function guideRead(step) {
  const shown = player.guideShown || (player.guideShown = { step: 0, at: 0 });
  if (shown.step !== player.tutorial) { shown.step = player.tutorial; shown.at = now; }
  const words = (step.touch || step.text).split(/\s+/).length;
  if (now - shown.at >= Math.min(16000, 5000 + words * 230)) return true;
  // played on: a task among the next few steps is done already
  for (let i = player.tutorial; i < Math.min(GUIDE.length, player.tutorial + 4); i++) {
    const next = GUIDE[i];
    if (next.done) return next.done();
    if (!guideExplains(next)) return false;
  }
  return false;
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
// ---- the guide's arrow: only through the basics (up to the step marked basicsEnd); after that you find your own way,
// with the map's circles (questAreas) ----
function guideArrowOn() {
  const end = GUIDE.findIndex(s => s.basicsEnd);
  return end < 0 || player.tutorial <= end + 1;
}

// ---- roughly where a quest's current step is done: a circle on the map, { x, y, z, r } ----
// Once what a step asks for is done, the one to tell; else the step's own where (npcs.js); a spot to clear; the nests
// to burn; the thing to use; the monsters to kill (their home nearest the one you report to, on their floor if they live
// there); or the one to talk to. Not for hidden quests: those are found.
const thingSpots = {}; // (where each thing a quest uses stands, found once)
function questArea(id) {
  const q = player.quests[id], def = QUESTS[id];
  if (!q || q.status !== 'active' || !def || def.hidden || def.chest) return null;
  const st = questStep(id), ready = stepReady(id);
  if (!st) return null;
  const npcAt = nid => { const n = map.npcs.find(c => c.type === nid); return n ? { x: n.x, y: n.y, z: n.z, r: 3 } : null; };
  const spread = list => {
    if (!list.length) return null;
    const x = Math.round(list.reduce((a, o) => a + o.x, 0) / list.length), y = Math.round(list.reduce((a, o) => a + o.y, 0) / list.length);
    return { x, y, z: list[0].z, r: Math.min(14, Math.max(4, Math.ceil(Math.max(...list.map(o => dist(o, { x, y })))) + 2)) };
  };
  if (ready && (st.kill || st.fetch || st.burn || st.clear || st.has)) return npcAt(st.npc || def.giver);
  const own = st.where !== undefined ? st.where : !def.steps ? def.where : undefined;
  const w = typeof own === 'function' ? own() : own;
  if (w) return { x: w[0], y: w[1], z: w[2], r: w[3] || 5 };
  if (st.clear) return { x: st.clear.at[0], y: st.clear.at[1], z: st.clear.at[2], r: st.clear.range + 3 };
  if (st.burn && typeof GATE_SITES !== 'undefined') return spread(GATE_SITES.nests.map(([x, y]) => ({ x, y, z: map.surfaceZ })));
  const giver = npcAt(st.npc || def.giver) || player; // (who sent you there: things and monsters nearest them)
  if (st.thing) {
    if (!thingSpots[st.thing]) {
      thingSpots[st.thing] = [];
      for (let z = 0; z < map.depth; z++) for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
        const t = map.get(x, y, z);
        if (t && t.items.some(i => i === st.thing || (THINGS[i] && THINGS[i][st.thing] === true))) thingSpots[st.thing].push({ x, y, z }); // (the bell: each of its parts)
      }
      for (const [key, m] of Object.entries(map.meta || {})) if (m && m.thing === st.thing) { const [x, y, z] = key.split(',').map(Number); thingSpots[st.thing].push({ x, y, z }); }
    }
    const t = thingSpots[st.thing].slice().sort((a, b) => dist(a, giver) - dist(b, giver))[0];
    if (t) return { ...t, r: 3 };
  }
  if (st.kill) {
    const types = Object.keys(st.kill), homes = map.spawns.filter(s => types.includes(s.type));
    const here = homes.filter(s => s.z === giver.z), pool = here.length ? here : homes;
    const first = pool.slice().sort((a, b) => dist(a, giver) - dist(b, giver))[0];
    if (first) return spread(pool.filter(s => s.z === first.z && dist(s, first) <= 10));
  }
  return npcAt(st.npc || def.giver);
}
// Every quest you're on that the map can show, with a key that changes when its step does (for the map's new-dot)
function questAreas() {
  const out = [];
  for (const id of Object.keys(player.quests)) {
    const a = questArea(id);
    if (a) out.push({ ...a, id, key: `${id}@${player.quests[id].step || 0}:${a.x},${a.y},${a.z}` });
  }
  return out;
}

function guideTarget(step) {
  // a step for a higher level than yours: the arrow to the nearest gate guard (a hunt there grows you)
  if (step.minLevel && player.level < step.minLevel) {
    return ['gate_west', 'gate_south', 'gate_east', 'gate_north'].map(id => npcs.find(c => c.npcId === id)).filter(Boolean)
      .sort((a, b) => dist(a, player) - dist(b, player))[0] || null;
  }
  for (const t of step.target || []) {
    if (t.level && player.level < t.level) continue;
    if (t.active && !questOnStep(t.active)) continue; // ('quest', or 'quest@step': only while on that one)
    if (t.when && !t.when()) continue; // (only while this holds)
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
      const m = near(monsters.filter(c => !c.dead && (wanted.includes(c.type) || wanted.includes(c.def && c.def.echoOf))));
      if (m) return m;
      const home = map.spawns.filter(s => s.z === player.z && wanted.includes(s.type)).sort((a, b) => dist(a, player) - dist(b, player))[0];
      if (home) return { x: home.x, y: home.y, z: home.z };
    }
    if (t.corpse) {
      const c = near(piles.filter(p => p.corpse));
      if (c) return c;
    }
    if (t.nest) { const n = nextNest(); if (n) return n; }
    // lead: to a spot until you're within `near` of it; from there on you find your own way (no arrow)
    if (t.lead) return t.lead[2] === player.z && dist(player, { x: t.lead[0], y: t.lead[1] }) > (t.near || 0) ? { x: t.lead[0], y: t.lead[1], z: t.lead[2] } : null;
    if (t.at && t.at[2] === player.z) return { x: t.at[0], y: t.at[1], z: t.at[2] };
  }
  return null;
}

// Is the quest active ('quest'), and on that step ('quest@step')?
function questOnStep(spec) {
  const [id, step] = spec.split('@'), q = player.quests[id];
  return !!q && q.status === 'active' && (step === undefined || (q.step || 0) === +step);
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
