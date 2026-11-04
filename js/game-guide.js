'use strict';
// The guide for new adventurers on Oakvale Isle: one thing at a time, with an arrow
// pointing the way (drawGuideArrow in game.js, renderGuide in game-ui.js), from a first
// word with Elder Maren to the Seer's tower. You can put it away whenever you like.
// player.tutorial is the step you're on (1 is the first), 0 when the guide is done.

// text: what to do (touch: the same for a phone); target: what the arrow points at, the
// first of these that is there - an NPC, the nearest monster of a kind, the nearest
// corpse, or a spot ([x, y, z]) - see guideTarget; done: when the step is done (as the
// player), or on: the deed that does it (see guideDid). The last step waits for "Got it".
const GUIDE = [
  {
    text: 'Welcome to Oakvale Isle! Sister Ama stands by the altar of the temple, just north of you. Walk to her with W A S D or the arrow keys (or click where to go), then click her to talk.',
    touch: 'Welcome to Oakvale Isle! Sister Ama stands by the altar of the temple, just north of you. Walk with the joystick (or tap where to go), then tap her to talk.',
    target: [{ npc: 'ama' }],
    done: () => talkingTo('ama'),
  },
  {
    text: 'Words in blue are things you can ask about: click them, or type them. Ask Sister Ama about the bell, and say yes.',
    touch: 'Words in blue are things you can ask about: tap them. Ask Sister Ama about the bell, and say yes.',
    target: [{ npc: 'ama' }],
    done: () => questState('bell_1') !== 'none',
  },
  {
    text: 'Leave the temple, go down the steps to the square, and west over the bridge to the academy. Master Corwin teaches there: talk to him.',
    touch: 'Leave the temple, go down the steps to the square, and west over the bridge to the academy. Master Corwin teaches there: tap him to talk.',
    target: [{ npc: 'corwin' }],
    done: () => talkingTo('corwin'),
  },
  {
    text: 'Rats run wild in Sunny Fields, out of the south gate. Click a rat to attack it, or press Space to attack the nearest monster. Kill 5 ($progress).',
    touch: 'Rats run wild in Sunny Fields, out of the south gate. Tap a rat to attack it, or press the sword button for the nearest monster. Kill 5 ($progress).',
    target: [{ monster: 'rat' }, { at: [128, 150, 8] }],
    on: 'kill',
  },
  {
    text: 'Monsters leave a corpse. Right-click it to open it, then click what you want to take: gold goes straight into your purse.',
    touch: 'Monsters leave a corpse. Long-press it to open it, then tap what you want to take: gold goes straight into your purse.',
    target: [{ corpse: true }],
    done: () => !!(player.openPile && player.openPile.corpse),
  },
  {
    text: 'With a full stomach you heal much faster. Eat an apple: right-click it in your bag.',
    touch: 'With a full stomach you heal much faster. Open your backpack (bottom right) and tap an apple to eat it.',
    target: [],
    done: () => player.fedUntil > now,
  },
  {
    text: 'Follow the bell quest: see the Quests tab for where to go next. Getting hurt? Drink a health potion with H.',
    touch: 'Follow the bell quest: see the Quests tab for where to go next. Getting hurt? Tap the heart for a health potion.',
    target: [{ quest: 'bell_1' }, { monster: 'rat' }],
    done: () => questState('bell_1') === 'done',
  },
  {
    text: 'Pip, on the main street south of the square, sells food, potions and tools, and buys what you loot. The Dented Shield sells weapons, Hide and Iron armour. Talk to Pip and ask to trade.',
    touch: 'Pip, on the main street south of the square, sells food, potions and tools, and buys what you loot. The Dented Shield sells weapons, Hide and Iron armour. Talk to Pip and ask to trade.',
    target: [{ npc: 'pip' }],
    done: () => !!player.shopNpc,
  },
  {
    text: 'Sister Ama has more to ask about the silent bell. Once you are level 2, go back to her in the temple and ask about the bell.',
    touch: 'Sister Ama has more to ask about the silent bell. Once you are level 2, go back to her in the temple and ask about the bell.',
    target: [{ npc: 'ama' }],
    done: () => questState('bell_2') !== 'none',
  },
  {
    text: 'Climb down the grate on the square. In the sewers, go east to the rats\' nest under the graveyard and down its trapdoor; then on down, past the slime, to the bottom of the bell shaft. Right-click the rope there. Say "lumen" for light.',
    touch: 'Step onto the grate on the square. In the sewers, go east to the rats\' nest under the graveyard and down its trapdoor; then on down, past the slime, to the bottom of the bell shaft. Long-press the rope there. Say "lumen" for light.',
    target: [{ quest: 'bell_2' }, { at: [141, 104, 5] }, { at: [128, 111, 6] }, { at: [147, 139, 7] }, { at: [131, 111, 8] }],
    done: () => questState('bell_2') === 'done',
  },
  {
    text: 'Grow stronger outside the walls: wolves in Wolf Woods to the north-west, goblins on Goblin Hill to the north-east. At level 6, Master Corwin at the academy has a task about the crypt under Bone Rocks.',
    touch: 'Grow stronger outside the walls: wolves in Wolf Woods to the north-west, goblins on Goblin Hill to the north-east. At level 6, Master Corwin at the academy has a task about the crypt under Bone Rocks.',
    target: [{ npc: 'corwin', level: 6 }],
    done: () => questState('bell_3') !== 'none',
  },
  {
    text: 'Take the bone trail from the south road to Bone Rocks, south-west of town. Steps at the foot of the crag lead down into the crypt; the tomb is two floors down. Bring what you find to Sister Ama.',
    touch: 'Take the bone trail from the south road to Bone Rocks, south-west of town. Steps at the foot of the crag lead down into the crypt; the tomb is two floors down. Bring what you find to Sister Ama.',
    target: [{ quest: 'bell_3' }, { at: [81, 198, 8] }, { at: [66, 181, 7] }, { at: [69, 176, 6] }],
    done: () => questState('bell_3') === 'done',
  },
  {
    text: 'The bell rings again! The oracle, upstairs in the academy, now lets you choose a vocation from level 8, and sends you on to the mainland. Until then, explore the island: many things have a story.',
    touch: 'The bell rings again! The oracle, upstairs in the academy, now lets you choose a vocation from level 8, and sends you on to the mainland. Until then, explore the island: many things have a story.',
    target: [{ npc: 'oak_oracle', level: 8 }],
  },
];

const talkingTo = id => !!(player.conversation && player.conversation.npc.npcId === id);

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
    if (t.quest && !stepReady(t.quest)) continue;
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
    const near = list => list.filter(c => c.z === player.z && dist(c, player) <= 12).sort((a, b) => dist(a, player) - dist(b, player))[0];
    if (t.monster) {
      const m = near(monsters.filter(c => !c.dead && c.type === t.monster));
      if (m) return m;
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
  if (player.vocation === 'none' && here && !there) return 'Nobody leaves Oakvale Isle without a vocation. The oracle, upstairs in the academy, sends you to the mainland once you are level 10 (or 8, once the bell of Oakvale rings again).';
  return null;
}
