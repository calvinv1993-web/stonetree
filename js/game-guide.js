'use strict';
// The guide for new adventurers on Brightwater Isle: one thing at a time, with an arrow
// pointing the way (drawGuideArrow in game.js, renderGuide in game-ui.js), from a first
// word with Elder Maren to the Seer's tower. You can put it away whenever you like.
// player.tutorial is the step you're on (1 is the first), 0 when the guide is done.

// text: what to do (touch: the same for a phone); target: what the arrow points at, the
// first of these that is there - an NPC, the nearest monster of a kind, the nearest
// corpse, or a spot ([x, y, z]) - see guideTarget; done: when the step is done (as the
// player), or on: the deed that does it (see guideDid). The last step waits for "Got it".
const GUIDE = [
  {
    text: 'Welcome to Brightwater Isle! Elder Maren stands by the altar, just north of you. Walk to her with W A S D or the arrow keys (or click where to go), then click her to talk.',
    touch: 'Welcome to Brightwater Isle! Elder Maren stands by the altar, just north of you. Walk with the joystick (or tap where to go), then tap her to talk.',
    target: [{ npc: 'maren' }],
    done: () => talkingTo('maren'),
  },
  {
    text: 'Words in blue are things you can ask about: click them, or type them. Ask Maren for a quest, and say yes.',
    touch: 'Words in blue are things you can ask about: tap them. Ask Maren for a quest, and say yes.',
    target: [{ npc: 'maren' }],
    done: () => questState('rat_problem') !== 'none',
  },
  {
    text: 'Rats have overrun the cellar under the square: its stairs are in the south-east corner. Click a rat to attack it, or press Space to attack the nearest monster.',
    touch: 'Rats have overrun the cellar under the square: its stairs are in the south-east corner. Tap a rat to attack it, or press the sword button for the nearest monster.',
    target: [{ monster: 'rat' }, { at: [36, 42, 4] }],
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
    text: 'Kill 5 rats for Maren ($progress), then go back up and tell her: say hi, then quest. Getting hurt? Drink a health potion with H.',
    touch: 'Kill 5 rats for Maren ($progress), then go back up and tell her: tap her, then quest. Getting hurt? Tap the heart for a health potion.',
    target: [{ quest: 'rat_problem', npc: 'maren' }, { monster: 'rat' }, { at: [36, 42, 4] }],
    done: () => questState('rat_problem') === 'done',
  },
  {
    text: 'Maren gave you a leather cap. Put it on: click it in your bag, or drag it onto your head.',
    touch: 'Maren gave you a leather cap. Put it on: open your backpack and tap it.',
    target: [],
    done: () => !!player.equipment.head || !findInBag(it => ITEMS[it.id].slot === 'head'),
  },
  {
    text: 'Hilda, east of the square, sells food, potions and tools, and buys what you loot. Bram the smith, west, sells weapons and armor. Talk to Hilda and ask to trade.',
    touch: 'Hilda, east of the square, sells food, potions and tools, and buys what you loot. Bram the smith, west, sells weapons and armor. Talk to Hilda and ask to trade.',
    target: [{ npc: 'hilda' }],
    done: () => !!player.shopNpc,
  },
  {
    text: 'Guard Tomas, at the south-east corner of the square, needs help against the goblins. Ask him for a mission.',
    touch: 'Guard Tomas, at the south-east corner of the square, needs help against the goblins. Ask him for a mission.',
    target: [{ npc: 'tomas' }],
    done: () => talkingTo('tomas'),
  },
  {
    text: 'That is all you need to know. Explore the island: the goblin camp to the east, the forest to the north, Old Gnarl\'s swamp to the north-west and the old crypt to the south. At level 10 the Seer, in the tower south of the square, lets you choose a vocation and sends you to the mainland - for good: nobody ever comes back to Brightwater. So take your time. They say the island still keeps an old secret...',
    target: [{ npc: 'seer', level: 10 }],
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
  if (player.vocation !== 'none' && there && !here) return 'Nobody takes you back to Brightwater Isle. Once you have chosen your path, the island is behind you for good.';
  if (player.vocation === 'none' && here && !there) return 'Nobody leaves Brightwater Isle without a vocation. The Seer, in the tower south of the square, sends you to the mainland once you are level 10.';
  return null;
}
