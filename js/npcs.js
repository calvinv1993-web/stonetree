'use strict';
// NPCs (dialog, trade, services), quests, raids and lore. All plain data, so it
// can be changed in the data editor (data.html).
//
// Dialog: an NPC answers keywords ('quest|mission' matches either word).
// {word} in a reply is a clickable keyword and $name is the player's name.
// A keyword's answer is a text, or a service:
//   { quest: [ids] }         offer / track / reward the first unfinished quest of the chain
//   { heal: true }           heal the player
//   { destiny: true }        the Seer's vocation talk; { vocation: 'knight' } chooses one (by id: knight is the Bastion)
//   { bank: true }           deposit <amount|all>, withdraw <amount>, balance
//   { travel: { name, to: {x, y, z}, cost } }
//   { promote: { level, cost } }
//   { bless: { cost, perLevel } }   protects your things the next time you die
//   { houses: true }         rent a house (say its name), "leave" gives it back
//   { forge: true }          open the forge (the NPC needs forge: true as well; see game-forge.js)
//   { chronicle: true }      Corwin pieces the founder's diary together (CHRONICLE)
//   { marks: [[word, cost, [[itemId, n]], label]] }  trade watch marks (the gate watch's hunts) for things: say the word
//                            (instead of items, { cosmetic: id }: something to wear over your outfit, COSMETICS in defs.js)
//   { trophy: true }         a smith turns a rare named beast's trophy into gear (trophy in items.js)
//   { pet: true }            look after the player's companion (fetch it back, heal it)
//   { rumours: [texts] }     tell one rumour, and the next one each time you ask again (RUMOURS)
//   { paths: true }          the Pathkeeper: the four paths side by side (the Book of Paths; game-paths.js)
//   { trial: 'knight' }      a teacher's trial: be that vocation for a while in their practice room
//   { choosePath: 'knight' } the Pathkeeper about a path, and choosing it once all four trials are done
//   { citizen: true }        become a citizen of the NPC's town (its home): you wake up in its temple when you die
// Or { after: 'questId', text, before }: the text once that quest is done (before it: `before`, or the next
// keyword that matches): what people say changes as the story goes on.

// What kind of items a trader buys (at the item's value).
const BUYS = {
  gear: d => ['head', 'body', 'legs', 'feet', 'weapon', 'shield'].includes(d.slot)
    && !(d.weapon && ['wand', 'distance'].includes(d.weapon.type))
    && !(d.vocations && d.vocations.every(v => MAGES.includes(v))),
  distance: d => (d.weapon && d.weapon.type === 'distance') || d.slot === 'ammo',
  magic: d => (d.weapon && d.weapon.type === 'wand') || !!d.rune || (d.vocations && d.vocations.every(v => MAGES.includes(v))),
  jewelry: d => d.slot === 'ring' || d.slot === 'neck' || d.name === 'pearl',
  loot: d => !d.slot && !d.quest && !d.rune && !d.tool && !d.kit && !!d.value,
  tools: d => !!d.tool || !!d.kit,
};

// Steps: each has the NPC you report to (npc, default the giver) and what to do
// first: kill { type: n }, fetch an item (taken when you report), or nothing (just talk).
// A quest without steps is a single step made from its own kill/fetch.
// auto: a kill step out in the wilds that is done the moment the last one falls (its done text is shown then),
// with no NPC to report to; chests can wait for a step (requires 'quest@step' in defs.js).
// story: a chapter of a story (true: the Ember Seal; or the story's name), shown first in the Quests tab.
// offers: { npc: { offer, accept } }: others who can offer it too, in their own words.
// text.elsewhere: what anyone else in the chain says when asked before it is offered.
// after: a quest that must be done before this one is offered (text.notYet: what the giver says till then).
// reward.daily: [[itemId, n]] more for the first quest with one that you finish each real day (the watch's hunts), and
// text.daily what the giver adds then.
// word: the word to ask about it (or a step's own word), when the NPC's keyword has several.
// where: [x, y, z, r] (or a function giving one, or null): roughly where a step (or a quest without steps) is done, for
// the circle on the map; without it the map works it out (questArea in game-guide.js).
const QUESTS = {
  // ---- The Ember Seal: the main story, from the Seer's dream to the bottom of the demon pit ----
  // Long ago the first Grandmaster of the Order of the Seal bound Vharzul the Ashen beneath the
  // volcano of Cinderhold, and broke the seal's fire into five embers for five peoples to keep:
  // the Tide (Ashport), the Frost (Frosthold), the Stone (Deepforge), the Sun (Kesh) and the Jade
  // (the Tazal jungle). The keepers are dust; the Ashen Choir, his old cult, hunts the embers and
  // has woken monsters with them. Gather them, have the dwarves reforge the seal, and end it.
  seal_1: {
    name: 'The Ember Seal I: The Seer\'s Dream', story: true, giver: 'seer', level: 8,
    reward: { xp: 400, gold: 150, items: [['ore_iron', 2]] },
    summary: 'Tell Grandmaster Orin, in the temple of Valoria, about the Seer\'s dream.',
    steps: [{
      npc: 'orin', summary: 'Tell Grandmaster Orin, in the temple of Valoria, about the Seer\'s dream.',
      progress: 'Grandmaster Orin waits in the temple of Valoria. Tell him what I saw.',
      done: 'A seal of five embers, cracking... So it has begun. Long ago the first Grandmaster of my Order bound Vharzul the Ashen beneath the volcano of Cinderhold, and broke the seal\'s fire into five embers - the Tide, the Frost, the Stone, the Sun and the Jade - for five peoples to keep. The keepers are dust now, and something hunts the embers. I am the last of the Order, $name. Help me. Ask me about the {seal} again.',
    }],
    offers: {
      orin: {
        offer: 'The Seer of Brightwater has written to me. Every night she dreams of a mountain of fire, and a seal of five embers cracking one by one - and of a stranger from the sea who holds the last ember in their hand. I believe that stranger is you. Will you hear me out? ({yes}/{no})',
        accept: 'Good. Then listen well - ask me about the {seal} again.',
      },
    },
    text: {
      offer: 'Every night the same dream, $name: a mountain of fire, and a seal of five embers, cracking one by one. And a stranger from the sea holds the last ember in their hand. That stranger is you. Will you carry my words to the mainland? ({yes}/{no})',
      accept: 'When you reach the mainland, find Grandmaster Orin in the temple of Valoria, the last of the Order of the Seal. Tell him what I saw.',
      done: 'The embers are counting on you, $name.',
      tooWeak: 'Not yet, little one. Grow a little stronger - come back at level 8 - and I will tell you my dream.',
      elsewhere: 'The seal? Old business, best left to old men... unless someone has sent you. The Seer of Brightwater, perhaps?',
    },
  },
  seal_2: {
    name: 'The Ember Seal II: The Ashen Choir', story: true, giver: 'orin', level: 12,
    reward: { xp: 1500, gold: 300, items: [['ore_iron', 4]] },
    summary: 'Defeat 6 dark mages in the tower east of Valoria, then report to Grandmaster Orin.',
    steps: [{
      npc: 'orin', kill: { dark_mage: 6 }, summary: 'Defeat 6 dark mages in the tower east of Valoria, then report to Grandmaster Orin.',
      progress: 'The Choir still sings in the tower east of the city. Dark mages defeated: $progress.',
      done: 'On one of them you found orders, written in ash: "Find the five embers - the Tide, the Frost, the Stone, the Sun and the Jade. When the last one gutters, He wakes." So the Ashen Choir is back. We must reach the embers before they do. Grow stronger, and ask me about the {seal} again.',
    }],
    text: {
      offer: 'Before we chase the embers, we must know who else chases them. The dark mages in the tower east of the city chant in the old tongue - the hymns of the Ashen Choir, the cult that once served Vharzul. Break them: defeat 6 of their mages. ({yes}/{no})',
      accept: 'The tower stands east of the city. Be careful: they summon the dead.',
      done: 'The Choir is scattered, but not gone.',
      tooWeak: 'The Choir\'s mages would burn you to ash. Come back at level 12.',
    },
  },
  seal_3: {
    name: 'The Ember Seal III: The Tide Ember', story: true, giver: 'orin', level: 20,
    reward: { xp: 4000, gold: 800, items: [['ore_mithril', 3]] },
    summary: 'Find the Tide Ember, which the people of Ashport once kept.',
    steps: [
      {
        npc: 'ida', summary: 'Sail to Ashport (from the pier west of Valoria) and ask Harbormaster Ida about the {ember}.',
        progress: 'Harbormaster Ida of Ashport knows more. Ships leave from the pier west of the city.',
        done: 'A crown that burns under water? That\'s the Drowned King! The Choir must have given him the ember - it keeps him walking. Help me with my own {mission} to find the way into his tomb, then slay him and take it.',
      },
      {
        npc: 'orin', kill: { drowned_king: 1 }, summary: 'Slay the Drowned King (Harbormaster Ida\'s mission shows the way into his tomb), and bring the Tide Ember to Grandmaster Orin.',
        progress: 'The Drowned King still wears the Tide Ember. Ida\'s mission leads to his tomb.',
        done: 'The Tide Ember - cold as the deep, and still burning. One of five. Keep growing stronger, $name, and ask me about the {seal} again.',
      },
    ],
    text: {
      offer: 'The first ember, the Tide Ember, was given to the sea-folk of Ashport. Now the sailors speak of a drowned king who rises from the deep, wearing a crown that burns under water. Go to Harbormaster Ida in Ashport and take the ember back. ({yes}/{no})',
      accept: 'A ship sails to Ashport from the pier west of the city. Ask Ida about the {ember}.',
      done: 'The sea is calm again.',
      tooWeak: 'The sea would swallow you. Come back at level 20.',
      elsewhere: 'Embers? The sea has been restless lately... Grandmaster Orin in Valoria studies such things.',
    },
  },
  seal_4: {
    name: 'The Ember Seal IV: The Frost Ember', story: true, giver: 'orin', level: 25,
    reward: { xp: 6000, gold: 1200, items: [['ore_mithril', 4]] },
    summary: 'Find the Frost Ember, which the northmen of Frosthold once kept.',
    steps: [
      {
        npc: 'jarl', summary: 'Sail to Frosthold, far in the north, and ask Jarl Hakon about the {ember}.',
        progress: 'Jarl Hakon waits in his hall in Frosthold. Ships sail there from Valoria.',
        done: 'Ha! So the old songs were true. My grandfather\'s grandfather kept that ember in this very hall - until the yetis came for it. Their elder lairs high on the Yeti Peaks, north-east of town. Bring him down, and the ember with him.',
      },
      {
        npc: 'orin', kill: { yeti_elder: 1 }, summary: 'Slay the Yeti Elder on the Yeti Peaks north-east of Frosthold, and bring the Frost Ember to Grandmaster Orin.',
        progress: 'The Yeti Elder still holds the Frost Ember, high on the Yeti Peaks.',
        done: 'The Frost Ember. Two of five! But the Choir will not let us gather them so easily. Ask me about the {seal} when you are ready for the deep places.',
      },
    ],
    text: {
      offer: 'The Frost Ember was given to the northmen of Frosthold. Jarl Hakon writes that the yetis have a new elder, huge and cruel, whose breath burns with cold. Go north, $name. ({yes}/{no})',
      accept: 'Ships sail to Frosthold from the pier west of the city. Dress warmly.',
      done: 'The north remembers you.',
      tooWeak: 'The north would freeze you solid. Come back at level 25.',
      elsewhere: 'Embers? The skalds sing of one... Ask the Grandmaster in Valoria - he collects old stories.',
    },
  },
  seal_5: {
    name: 'The Ember Seal V: The Stone Ember', story: true, giver: 'orin', level: 30,
    reward: { xp: 9000, gold: 1500, items: [['ore_starsteel', 2]] },
    summary: 'Find the Stone Ember, which the dwarves of Deepforge keep.',
    steps: [
      {
        npc: 'durgan', summary: 'Find Foreman Durgan in Deepforge, below the Ironpeak mountains, and ask him about the {ember}.',
        progress: 'Foreman Durgan of Deepforge keeps the Stone Ember. Find him below the Ironpeak mountains.',
        done: 'The Stone Ember is safe - for now. But the golems that guard its vault have turned on us. Something whispers to them through the rock. Smash 8 of them in the mines east of town, and I\'ll trust you with it.',
      },
      {
        npc: 'durgan', kill: { stone_golem: 8 }, summary: 'Smash 8 stone golems in the mines east of Deepforge, then report to Foreman Durgan.',
        progress: 'Golems smashed: $progress. The mines are east of town.',
        done: 'The whispering\'s stopped. Here - the Stone Ember. Heavy, isn\'t it? When you have all five, bring them to me: only a dwarven forge can make a seal whole again. Now go and tell your Grandmaster.',
      },
      {
        npc: 'orin', summary: 'Bring the Stone Ember to Grandmaster Orin in Valoria.',
        done: 'Three of five, and the dwarves will reforge the seal! The last two lie in the south, where the sun burns and the jungle breathes. Ask me about the {seal} when you are ready.',
      },
    ],
    text: {
      offer: 'The dwarves of Deepforge keep the Stone Ember in their deepest vault. If the Choir has reached it... Foreman Durgan will know. Go to Deepforge, below the Ironpeak mountains. ({yes}/{no})',
      accept: 'Deepforge lies below the Ironpeak mountains. Ask Durgan about the {ember}.',
      done: 'The dwarves are with us.',
      tooWeak: 'The deep places are no place for you yet. Come back at level 30.',
      elsewhere: 'Embers? We dwarves keep our mouths shut about our vaults. Ask the old man in Valoria.',
    },
  },
  seal_6: {
    name: 'The Ember Seal VI: The Sun Ember', story: true, giver: 'orin', level: 40,
    reward: { xp: 16000, gold: 2500, items: [['ore_starsteel', 3]] },
    summary: 'Find the Sun Ember, which the desert kings of Kesh once kept.',
    steps: [
      {
        npc: 'amal', summary: 'Sail to Kesh, in the Sunreach desert, and ask Vizier Amal about the {ember}.',
        progress: 'Vizier Amal waits in Kesh. Ships sail there from Valoria.',
        done: 'The ember! It burns in his chest, where his heart used to be - the Choir woke him with it. He lies at the bottom of the pyramid east of the city. End him.',
      },
      {
        npc: 'orin', kill: { sand_king: 1 }, summary: 'Destroy the Sand King at the bottom of the pyramid east of Kesh, and bring the Sun Ember to Grandmaster Orin.',
        progress: 'The Sand King still burns with the Sun Ember, at the bottom of the pyramid east of Kesh.',
        done: 'The Sun Ember, warm as noon. Four of five. One more, $name - ask me about the {seal}.',
      },
    ],
    text: {
      offer: 'The Sun Ember went to the desert kings of Kesh. Their last king is long dead - and yet the Vizier writes that the Sand King has risen in his pyramid, with a fire in his chest. ({yes}/{no})',
      accept: 'Ships sail to Kesh from the pier west of the city. Take water.',
      done: 'The desert sleeps again.',
      tooWeak: 'The Sand King would bury you. Come back at level 40.',
      elsewhere: 'The sun has many secrets. The Grandmaster in Valoria might know which one you mean.',
    },
  },
  seal_7: {
    name: 'The Ember Seal VII: The Jade Ember', story: true, giver: 'orin', level: 45,
    reward: { xp: 22000, gold: 3000, items: [['ore_starsteel', 4]] },
    summary: 'Find the Jade Ember, hidden long ago in the jungle temple of Tazal.',
    steps: [
      {
        npc: 'vance', summary: 'Sail to Port Verdant, in the Tazal jungle, and ask Governor Vance about the {ember}.',
        progress: 'Governor Vance waits in Port Verdant. Ships sail there from Valoria.',
        done: 'Glowing green, yes - that\'s your ember, swallowed whole. The Serpent Lord lies deep below the jungle temple east of town. Good luck. You\'ll need it.',
      },
      {
        npc: 'orin', kill: { serpent_lord: 1 }, summary: 'Slay the Serpent Lord deep below the jungle temple east of Port Verdant, and bring the Jade Ember to Grandmaster Orin.',
        progress: 'The Serpent Lord still keeps the Jade Ember, deep below the jungle temple.',
        done: 'All five embers... I never thought I would see them together. Now: to the forge. Ask me about the {seal}.',
      },
    ],
    text: {
      offer: 'The last ember, the Jade Ember, was hidden in the jungle temple of Tazal. Governor Vance of Port Verdant reports that the lizards worship a serpent lord who glows green in the dark. ({yes}/{no})',
      accept: 'Ships sail to Port Verdant from the pier west of the city. Mind the vipers.',
      done: 'The jungle breathes easier.',
      tooWeak: 'The Serpent Lord would swallow you whole. Come back at level 45.',
      elsewhere: 'Embers? In this heat? Ask the Grandmaster in Valoria.',
    },
  },
  seal_8: {
    name: 'The Ember Seal VIII: The Reforging', story: true, giver: 'orin', level: 50,
    reward: { xp: 12000, gold: 2000, items: [['ember_seal', 1]] },
    summary: 'Bring the five embers to Foreman Durgan in Deepforge, to reforge the seal.',
    steps: [
      {
        npc: 'durgan', summary: 'Bring the five embers to Foreman Durgan in Deepforge, to reforge the seal.',
        progress: 'Foreman Durgan waits at his forge in Deepforge.',
        done: 'Five embers... Stand back. (The forge roars for an hour. When it falls quiet, a seal lies on the anvil, glowing like a sunset.) There: the Ember Seal, whole again. It knows you now - wear it. Take it to your Grandmaster.',
      },
      {
        npc: 'orin', summary: 'Show the Ember Seal to Grandmaster Orin in Valoria.',
        done: 'The Ember Seal... whole. But a seal is only a lock, $name. Vharzul is half awake already: the seal must be pressed into the stone of his prison at the bottom of the demon pit of Cinderhold - and he will not let you. When you are mighty enough, ask me about the {seal} one last time.',
      },
    ],
    text: {
      offer: 'Take the five embers to Foreman Durgan in Deepforge. He swore to reforge the seal. Will you carry them? ({yes}/{no})',
      accept: 'Guard them with your life. Deepforge lies below the Ironpeak mountains.',
      done: 'The Ember Seal is yours to wear.',
      tooWeak: 'You are not ready to carry them. Come back at level 50.',
      elsewhere: 'When you have all five embers, the Grandmaster will send you to me.',
    },
  },
  seal_9: {
    name: 'The Ember Seal IX: The Ashen Lord', story: true, giver: 'orin', level: 70,
    reward: { xp: 60000, gold: 20000, items: [['ore_sunsteel', 4], ['demon_shield', 1]] },
    summary: 'Defeat Vharzul the Ashen at the bottom of the demon pit of Cinderhold.',
    steps: [
      {
        npc: 'kael', summary: 'Sail to Cinderhold and tell Warden Kael that you bring the Ember {Seal}.',
        progress: 'Warden Kael watches the volcano of Cinderhold. Ships sail there from Valoria.',
        done: 'The Ember Seal. I\'ve guarded this hole for twenty years, waiting for someone to bring that. The pit is at the foot of the volcano: down through the fire, and down again. He waits at the very bottom. Go - and come back.',
      },
      {
        npc: 'kael', kill: { ashen_lord: 1 }, summary: 'Defeat Vharzul the Ashen at the bottom of the demon pit of Cinderhold, then tell Warden Kael.',
        progress: 'Vharzul still stirs at the bottom of the pit.',
        done: 'The mountain\'s gone quiet. Quieter than I have ever heard it. Go home, $name. Tell the Grandmaster.',
      },
      {
        npc: 'orin', summary: 'Return to Grandmaster Orin in Valoria.',
        done: 'The Seer\'s dream has ended, and the world sleeps safely again - because of you. The Order of the Seal is no longer one old man, $name: it is you. Take these, with the thanks of everyone who will never know your name.',
      },
    ],
    text: {
      offer: 'This is the end of the road. Warden Kael watches the volcano of Cinderhold. Go to him, go down into the fire, and face Vharzul the Ashen. Defeat him, and press the seal into the stone. Will you go? ({yes}/{no})',
      accept: 'Ships sail to Cinderhold from the pier west of the city. Go with the light, $name.',
      done: 'The Ember Seal holds. Rest, hero.',
      tooWeak: 'Vharzul would end you with a look. Come back at level 70.',
      elsewhere: 'The seal? So the Grandmaster has sent you at last. Ask me again when he does.',
    },
  },

  rat_problem: {
    name: 'Rat Problem', giver: 'maren', kill: { rat: 5 },
    reward: { xp: 60, gold: 30, items: [['leather_cap', 1]] },
    summary: 'Kill 5 rats for Elder Maren. They infest the cellar below the village square (stairs in the south-east corner).',
    text: {
      offer: 'Rats have overrun the cellar below the square. Will you kill 5 of them for me? ({yes}/{no})',
      accept: 'Thank you! The cellar stairs are in the south-east corner of the square. Come back when you are done.',
      progress: 'So far you have killed $progress. Keep going!',
      reward: 'Well done! Take this cap and some gold. Guard {Tomas} might need help too.',
      done: 'The village is grateful for your help with the rats.',
    },
  },
  farrow_rats: {
    name: 'Rats in the Barn', giver: 'farrow', kill: { rat: 6 },
    reward: { xp: 60, gold: 25, items: [['health_potion', 2]] },
    summary: 'Kill 6 rats for Old Farrow. They live in his fallen barn and in his fields, west of Bellhaven\'s west gate.',
    text: {
      offer: 'The rats in my barn eat everything I sow. Would you kill 6 of them for an old man? ({yes}/{no})',
      accept: 'Bless you. The barn is right there in the yard, and they run about the fields too.',
      progress: 'So far you have killed $progress. Keep at it!',
      reward: 'Ha! That will teach them. Here, some coin and two potions for your trouble.',
      done: 'My seed is safe, thanks to you. Come by any time.',
    },
  },
  lost_parcel: {
    name: 'The Lost Parcel', giver: 'hilda', fetch: 'parcel',
    reward: { xp: 80, gold: 20, items: [['health_potion', 3]] },
    summary: "Find Hilda's parcel. It was left in a crate in the cellar below the village square.",
    text: {
      offer: "A delivery for me was left in a crate down in the cellar, but it's crawling with rats! Could you fetch my parcel? ({yes}/{no})",
      accept: 'Oh, thank you! The crate should be in the far corner of the cellar.',
      progress: "Did you find my parcel yet? It's in a crate in the cellar.",
      reward: 'My parcel! Thank you so much. Here, take these potions.',
      done: 'Thanks again for finding my parcel!',
    },
  },
  goblin_raid: {
    name: 'Goblin Raiders', giver: 'tomas', kill: { goblin: 6 }, level: 3,
    reward: { xp: 150, gold: 50, items: [['studded_shield', 1]] },
    summary: 'Kill 6 goblins in their camp east of the village, then report to Guard Tomas.',
    text: {
      offer: 'Goblins from the camp east of the village keep raiding our farms. Will you thin them out - say, 6 of them? ({yes}/{no})',
      accept: 'Good. Follow the road east from the square. Careful, they hit harder than rats.',
      progress: 'You have killed $progress. The camp is east of the village.',
      reward: 'Excellent work! Take this shield, you have earned it. I have another {mission} when you are ready.',
      tooWeak: 'You look a bit green. Come back when you are at least level 3.',
    },
  },
  old_gnarl: {
    name: 'Old Gnarl', giver: 'tomas', kill: { gnarl: 1 }, level: 6,
    reward: { xp: 300, gold: 100, items: [['backpack', 1]] },
    summary: 'Slay Old Gnarl, the troll in the swamp north-west of the village.',
    text: {
      offer: 'A huge troll called Old Gnarl lives in the swamp north-west of the village. Can you slay him? ({yes}/{no})',
      accept: 'Brave! Bring potions, he is strong.',
      progress: 'Old Gnarl still lives. The swamp is north-west of the village.',
      reward: 'You slew Old Gnarl! Take this backpack, you will need the room. Soon you will be ready to see the {Seer}.',
      done: 'The island is safer thanks to you.',
      tooWeak: 'Old Gnarl would crush you. Come back at level 6.',
    },
  },
  hunters_cache: { name: "The Hunter's Cache", chest: true, summary: 'You found a hidden bow and arrows in the northern forest.' },
  crypt_armory: { name: 'The Crypt Armory', chest: true, summary: 'You claimed a weapon from the armory deep in the crypt.' },
  crypt_secret: { name: 'Behind the Cracked Rock', chest: true, summary: 'You broke through a cracked rock in the crypt and found a hidden chest.' },
  sand_cache: { name: 'Buried Treasure', chest: true, summary: 'You dug up a buried cache on the eastern beach of Brightwater Isle.' },
  orc_menace: {
    name: 'Orc Menace', giver: 'rhea', kill: { orc: 10, orc_archer: 5 },
    reward: { xp: 900, gold: 300, items: [['health_potion', 10]] },
    summary: 'Kill 10 orcs and 5 orc archers in the fortress north-east of the city.',
    text: {
      offer: 'Orcs from the fortress north-east of here attack our caravans. Kill 10 orcs and 5 of their archers. Will you do it? ({yes}/{no})',
      accept: 'Take the road north from the square, then east. Watch out for the archers.',
      progress: 'So far: $progress.',
      reward: 'The caravans are safe again. Here is your pay. I have another {mission} for you.',
    },
  },
  highway_robbers: {
    name: 'Highway Robbers', giver: 'rhea', kill: { bandit: 8 }, level: 15,
    reward: { xp: 1500, gold: 500, items: [['mana_potion', 10]] },
    summary: 'Kill 8 bandits in the camp south of the city.',
    text: {
      offer: 'Bandits camp south of the city and rob travelers. Kill 8 of them. Are you up to it? ({yes}/{no})',
      accept: 'Follow the south road. They fight dirty.',
      progress: 'So far: $progress.',
      reward: 'The roads are safe again. Well done, and take this.',
      done: 'Valoria owes you. Perhaps try the {ogres} or the {tower} next.',
      tooWeak: 'The bandits are tough. Come back at level 15.',
    },
  },
  ogre_hoard: { name: "The Ogres' Hoard", chest: true, summary: 'You found the treasure deep in the ogre caves.' },
  tower_secrets: { name: 'Secrets of the Tower', chest: true, summary: "You reached the top of the dark mages' tower." },
  pirate_gold: { name: "The Pirates' Gold", chest: true, summary: 'You pulled the lever in the pirate caves and found their gold.' },
  tide_hoard: { name: 'The Tide Hoard', chest: true, summary: "You claimed the Drowned King's treasure." },
  drowned_king: {
    name: 'The Drowned King', giver: 'ida', level: 20,
    reward: { xp: 2500, gold: 800, items: [['amulet_guard', 1]] },
    summary: 'Help Harbormaster Ida of Ashport get rid of the Drowned King.',
    steps: [
      {
        npc: 'keeper', summary: 'Ask the lighthouse keeper, on the west tip of the island, about the Drowned King.',
        progress: 'Go and see the lighthouse keeper on the west tip of the island first.',
        done: 'The Drowned King? The pirates found a sea chart of his tomb and locked it in a chest in their caves below the island. Get it and bring it to Ida.',
      },
      {
        npc: 'ida', fetch: 'sea_chart', summary: 'Find the sea chart in the pirate caves below Ashport and bring it to Harbormaster Ida.',
        progress: 'Bring me the sea chart from the pirate caves. The entrance is in the ruin south-east of town.',
        done: 'This chart shows the way into his tomb! The sealed door in the caves will open for you now. Go and slay him!',
      },
      {
        npc: 'ida', kill: { drowned_king: 1 }, summary: 'Slay the Drowned King in his tomb, behind the sealed door in the pirate caves.',
        progress: 'The Drowned King still walks. His tomb is behind the sealed door in the pirate caves.',
        done: 'The tides are calm again. You have the thanks of all Ashport - take this, and know that his treasure is yours too.',
      },
    ],
    text: {
      offer: 'Ships are vanishing near Ashport, and the sailors whisper about the Drowned King. Will you help us? ({yes}/{no})',
      accept: 'Thank you! Talk to the lighthouse keeper first, on the west tip of the island. He knows the old stories.',
      done: 'Ashport is safe thanks to you.',
      tooWeak: 'This is too dangerous for you. Come back at level 20.',
    },
  },

  // ---- the Highlands and Castle Greymoor ----------------------------------------
  cyclops_threat: {
    name: 'The Cyclops Threat', giver: 'brenna', kill: { cyclops: 10 }, level: 20,
    reward: { xp: 3500, gold: 700, items: [['iron_boots', 1]] },
    summary: 'Kill 10 cyclopes on the mountain south-east of Castle Greymoor, then report to Captain Brenna.',
    text: {
      offer: 'Cyclopes come down from their mountain and smash our patrols. Thin their numbers: kill 10 of them. ({yes}/{no})',
      accept: 'The mountain is south-east of the castle. Stairs on its south side lead up to their camp. Mind the boulders they throw.',
      progress: 'So far: $progress.',
      reward: 'Ha! That will teach them. Take these boots, soldier.',
      done: 'The patrols are safe again. The {king} may have harder work for you.',
      tooWeak: 'A cyclops would flatten you. Come back at level 20.',
    },
  },
  cellar_webs: {
    name: 'Webs in the Cellar', giver: 'odran', kill: { giant_spider: 6 }, level: 25,
    reward: { xp: 5000, gold: 1200, items: [['plate_legs', 1]] },
    summary: 'Kill 6 giant spiders in the cellars below Castle Greymoor (stairs in the south-east corner of the courtyard), then report to King Odran.',
    text: {
      offer: 'Giant spiders have nested in the cellars below my own castle! Kill 6 of them and you will be rewarded. ({yes}/{no})',
      accept: 'The cellar stairs are in the south-east corner of the courtyard. Take antidotes - their bite is venomous.',
      progress: 'My cellars still crawl with them. So far: $progress.',
      reward: 'The cellars are ours again. Greymoor thanks you - take these legs, forged for my own guard.',
      done: 'My wine is safe once more. Now, about those {dragons}...',
      tooWeak: 'Those spiders would eat you alive. Come back at level 25.',
    },
  },
  dragon_bane: {
    name: 'Dragon Bane', giver: 'odran', kill: { dragon: 5 }, level: 35,
    reward: { xp: 12000, gold: 3000, items: [['dragon_shield', 1]] },
    summary: 'Slay 5 dragons in the lair below the cyclops mountain (the way down is at the mountain\'s east foot), then report to King Odran.',
    text: {
      offer: 'Dragons nest beneath the cyclops mountain and burn our villages. Slay 5 of them, and I will give you a shield fit for a hero. ({yes}/{no})',
      accept: 'The way down to their lair is at the east foot of the mountain. May your armour hold against their fire.',
      progress: 'The dragons still fly. So far: $progress.',
      reward: 'Five dragons! The bards will sing of you. Take this dragon shield - you have earned it.',
      done: 'You are a true hero of Greymoor, $name.',
      tooWeak: 'A dragon would burn you to ash. Come back at level 35.',
    },
  },
  free_elf: {
    name: 'A Sock for Dobby', giver: 'dobby', fetch: 'old_sock', level: 20,
    reward: { xp: 2500, gold: 300, items: [['ring_swift', 1], ['health_potion', 5]] },
    summary: 'Dobby, the house-elf upstairs in the keep of Castle Greymoor, can only be set free with a piece of clothing. Find him a sock. He saw a flying carriage drop luggage into the Webwood...',
    text: {
      offer: 'Dobby may only leave if someone hands him a piece of clothing, but every sock in this castle is counted and locked away! Would you find a sock for Dobby? ({yes}/{no})',
      accept: 'Oh! Oh, thank you! Dobby once saw a flying carriage crash through the Webwood, south of the mountain, with trunks tumbling out of it. Perhaps there is a sock in one of them? Mind the spiders!',
      progress: 'No sock yet? The Webwood, south of the mountain. A trunk from the flying carriage!',
      reward: 'A sock! A real, smelly, wonderful sock! Dobby is his own elf now! Take these, kind $name - Dobby found them under the king\'s bed. He will not miss them.',
      done: 'Dobby is free! Dobby goes where Dobby likes, and today Dobby likes it here. Thank you, $name!',
      tooWeak: 'The Webwood is full of giant spiders, sir! Come back when you are stronger - level 20, perhaps.',
    },
  },
  webbed_cache: { name: 'The Webbed Cache', chest: true, summary: 'You found a cache deep in the spider-infested cellars of Castle Greymoor.' },
  cyclops_summit: { name: 'The Cyclops Summit', chest: true, summary: "You climbed to the top of the cyclops mountain and took the cyclopes' loot." },
  dragon_hoard: { name: "The Dragons' Hoard", chest: true, summary: 'You found the hoard at the far end of the dragon lair.' },
  // ---- the wider world ----------------------------------------------------------------
  yeti_hunt: {
    name: 'Yeti Hunt', giver: 'jarl', kill: { yeti: 8 }, level: 25,
    reward: { xp: 5000, gold: 800, items: [['crown_helmet', 1]] },
    summary: 'Kill 8 yetis on the Yeti Peaks, north-east of Frosthold, for Jarl Hakon.',
    text: {
      offer: 'Yetis raid our hunters on the peaks. Kill 8 of them and I will give you a helmet fit for a jarl. ({yes}/{no})',
      accept: 'The peaks are north-east of town; the path up is on their south side. Bring furs if you can!',
      progress: 'Yetis slain so far: $progress.',
      reward: 'Ha! The hunters can breathe again. Wear this with pride.',
      done: 'The skalds sing of you already. The ice caves hold worse, though: ask me about the {dragons}.',
      tooWeak: 'A yeti would snap you like a twig. Come back at level 25.',
    },
  },
  frost_dragons: {
    name: 'Frost and Fire', giver: 'jarl', kill: { frost_dragon: 4 }, level: 45,
    reward: { xp: 15000, gold: 2500, items: [['frost_blade', 1]] },
    summary: 'Slay 4 frost dragons in the deepest ice caves below the Yeti Peaks.',
    text: {
      offer: 'Frost dragons nest in the deepest ice caves. Slay 4 and the blade of my fathers is yours. ({yes}/{no})',
      accept: 'The caves open east of the peaks. Go down, and down again.',
      progress: 'Frost dragons slain: $progress.',
      reward: 'You have the heart of a northerner. Take the frost blade.',
      done: 'Frosthold will remember your name.',
      tooWeak: 'Come back at level 45, or the dragons will freeze you solid.',
    },
  },
  bear_trouble: {
    name: 'Bear Trouble', giver: 'lirael', kill: { bear: 10 }, level: 12,
    reward: { xp: 1500, gold: 300, items: [['health_potion', 10]] },
    summary: 'Drive back the bears of the Elderwood: kill 10 of them for Elder Lirael in Sylvaran.',
    text: {
      offer: 'The bears have grown bold and attack our gatherers. Will you drive them back - 10 of them? ({yes}/{no})',
      accept: 'They roam the north of the Elderwood. Take care.',
      progress: 'Bears: $progress.',
      reward: 'The paths are safe again. Take these, with our thanks.',
      done: 'The forest is grateful. The {shadowglen} is another matter...',
      tooWeak: 'You are too young for this. Come back at level 12.',
    },
  },
  shadowglen: {
    name: 'The Shadowglen', giver: 'lirael', kill: { giant_spider: 6 }, level: 25,
    reward: { xp: 6000, gold: 1000, items: [['elven_bow', 1]] },
    summary: 'Kill 6 giant spiders in the Shadowglen, in the south of the Elderwood.',
    text: {
      offer: 'Giant spiders have taken the Shadowglen. Kill 6 of them, and an elven bow is yours. ({yes}/{no})',
      accept: 'The glen is in the south of the forest. Their poison is strong.',
      progress: 'Spiders: $progress.',
      reward: 'The glen breathes again. Take this bow, friend of the elves.',
      done: 'You are always welcome in Sylvaran.',
      tooWeak: 'They would eat you. Come back at level 25.',
    },
  },
  golem_menace: {
    name: 'The Waking Stone', giver: 'durgan', kill: { stone_golem: 8 }, level: 30,
    reward: { xp: 8000, gold: 1500, items: [['tower_shield', 1]] },
    summary: 'Smash 8 stone golems in the mines east of Deepforge for Foreman Durgan.',
    text: {
      offer: 'The stone in the east mines woke up and walks around. Smash 8 golems and I will reward you. ({yes}/{no})',
      accept: 'Go east from the great hall. Bring a big hammer.',
      progress: 'Golems smashed: $progress.',
      reward: 'Ha! Back to work, lads! This shield is yours.',
      done: 'The mines run again, and the labyrinth is quiet. Deepforge owes you.',
      tooWeak: 'Golems would crush you. Come back at level 30.',
    },
  },
  labyrinth: {
    name: 'The Labyrinth', giver: 'durgan', kill: { minotaur: 10 }, level: 20,
    reward: { xp: 4000, gold: 800, items: [['plate_legs', 1]] },
    summary: 'Kill 10 minotaurs in the labyrinth west of Deepforge.',
    text: {
      offer: 'Minotaurs moved into the old labyrinth west of the city. Kill 10 of them? ({yes}/{no})',
      accept: 'Take the western tunnel. Mark your way, it is a maze.',
      progress: 'Minotaurs: $progress.',
      reward: 'Good work! Take these legs - dwarven made, so they will fit you badly. Still good. When you are stronger, I have a {mission} in the mines.',
      done: 'Deepforge thanks you.',
      tooWeak: 'Come back at level 20.',
    },
  },
  scorpion_plague: {
    name: 'Scorpion Plague', giver: 'amal', kill: { scorpion: 12 }, level: 15,
    reward: { xp: 2500, gold: 500, items: [['mana_potion', 10]] },
    summary: 'Kill 12 scorpions in the dunes around Kesh for Vizier Amal.',
    text: {
      offer: 'Scorpions sting our caravans. Kill 12 of them, will you? ({yes}/{no})',
      accept: 'They hide in the dunes around the city.',
      progress: 'Scorpions: $progress.',
      reward: 'The caravans thank you. Here is your reward.',
      done: 'Kesh is grateful. But the {king} in the pyramid...',
      tooWeak: 'Come back at level 15.',
    },
  },
  sand_king: {
    name: 'The Sand King', giver: 'amal', kill: { sand_king: 1 }, level: 40,
    reward: { xp: 12000, gold: 3000, items: [['golden_armor', 1]] },
    summary: 'Destroy the Sand King, at the bottom of the pyramid east of Kesh.',
    text: {
      offer: 'The Sand King stirs in his pyramid and sends his dead against us. End him. ({yes}/{no})',
      accept: 'The pyramid stands east of the city. His tomb is at the very bottom.',
      progress: 'Is the Sand King still walking?',
      reward: 'You did it! The treasury of Kesh is yours to thank you - well, this armour is.',
      done: 'Your name is carved in the city gate.',
      tooWeak: 'Come back at level 40. He is no ordinary mummy.',
    },
  },
  troll_raid: {
    name: 'Troll Raid', giver: 'marsh', kill: { swamp_troll: 10 }, level: 10,
    reward: { xp: 1200, gold: 250, items: [['health_potion', 8]] },
    summary: 'Kill 10 swamp trolls around Mirehaven for Old Marsh.',
    text: {
      offer: 'Swamp trolls steal our fish and our boats. Thin them out - 10 should do. ({yes}/{no})',
      accept: 'They live north of town, in the deeper fen.',
      progress: 'Trolls: $progress.',
      reward: 'Haha! They will think twice. Here you go.',
      done: 'Thanks again. The {coven} though...',
      tooWeak: 'Come back at level 10.',
    },
  },
  witch_coven: {
    name: 'The Coven', giver: 'marsh', kill: { witch: 6 }, level: 25,
    reward: { xp: 5000, gold: 900, items: [['witch_hat', 1]] },
    summary: 'Break the witch coven in the west of the Mirefen: kill 6 witches.',
    text: {
      offer: 'Witches gather in the west of the fen, and our children have nightmares. Kill 6 of them. ({yes}/{no})',
      accept: 'West of town, where the dead trees stand.',
      progress: 'Witches: $progress.',
      reward: 'The nightmares are gone. Take one of their hats, if you dare to wear it.',
      done: 'Mirehaven sleeps well again.',
      tooWeak: 'Come back at level 25.',
    },
  },
  lizard_threat: {
    name: 'Lizard Threat', giver: 'vance', kill: { lizard_warrior: 10 }, level: 30,
    reward: { xp: 8000, gold: 1500, items: [['lizard_mail', 1]] },
    summary: 'Kill 10 lizard warriors around the jungle temple east of Port Verdant.',
    text: {
      offer: 'Lizard warriors attack our loggers. Kill 10 of them, and you get one of their own scale mails. ({yes}/{no})',
      accept: 'They guard their temple, east of town in the jungle.',
      progress: 'Lizards: $progress.',
      reward: 'Splendid! Here, made from their own scales.',
      done: 'The loggers thank you. The {serpent} in the temple, however...',
      tooWeak: 'Come back at level 30.',
    },
  },
  serpent_hunt: {
    name: 'The Serpent Lord', giver: 'vance', kill: { serpent_lord: 1 }, level: 45,
    reward: { xp: 14000, gold: 3500, items: [['wand_storm', 1], ['rod_glacier', 1]] },
    summary: 'Slay the Serpent Lord, deep below the jungle temple.',
    text: {
      offer: 'The lizards follow the Serpent Lord, deep below their temple. Kill him and they will scatter. ({yes}/{no})',
      accept: 'Go down into the temple, and down again. Bring antidotes.',
      progress: 'Is the serpent dead yet?',
      reward: 'The jungle is quiet! Take these - one of them will suit you.',
      done: 'Port Verdant is in your debt.',
      tooWeak: 'Come back at level 45.',
    },
  },
  demon_slayer: {
    name: 'Demon Slayer', giver: 'kael', kill: { demon: 3 }, level: 70,
    reward: { xp: 40000, gold: 10000, items: [['demon_shield', 1]] },
    summary: 'Kill 3 demons in the deepest pit below the volcano of Cinderhold.',
    text: {
      offer: 'Demons are gathering below the volcano. Kill 3 of them before they break out. Only legends survive this. ({yes}/{no})',
      accept: 'The cave is at the foot of the volcano. Go down through the fire, and down again.',
      progress: 'Demons slain: $progress.',
      reward: 'You... actually did it. Take this shield. You are a legend.',
      done: 'The fire sleeps. For now.',
      tooWeak: 'You would not last a breath down there. Come back at level 70.',
    },
  },
  frost_hoard: { name: 'The Frost Hoard', chest: true, summary: 'You found the treasure of the frost dragons.' },
  labyrinth_prize: { name: 'The Heart of the Maze', chest: true, summary: 'You found the prize at the heart of the labyrinth.' },
  pyramid_tomb: { name: 'The Tomb Treasure', chest: true, summary: "You opened the Sand King's treasure chamber." },
  jungle_idol: { name: 'The Jade Idol', chest: true, summary: 'You found the idol in the jungle temple.' },
  demon_hoard: { name: "The Demons' Hoard", chest: true, summary: 'You found the hoard at the bottom of the demon pit.' },
};

// Timed invasions, announced to everyone. Raid monsters don't respawn.
// Raids on Oakvale Isle: now and then something comes for the town, and everyone online hears of it. They come to
// the gates, never in (monsters keep out of town), and leave after a while.
const RAIDS = [
  // (minLevel: only once someone about is that strong; how many come grows with the strongest of them: startRaid)
  { name: 'goblin warband', minLevel: 5, message: 'A goblin warband from Goblin Hill is marching on the north gate!', at: { x: 127, y: 86, z: 8 }, spawns: [['goblin', 6]] },
  { name: 'wolf pack', minLevel: 3, message: 'A pack of wolves has come out of Wolf Woods, howling at the west gate!', at: { x: 90, y: 121, z: 8 }, spawns: [['wolf', 5]] },
  { name: 'restless dead', minLevel: 6, message: 'The dead are stirring at Bone Rocks: skeletons walk the bone trail!', at: { x: 82, y: 201, z: 8 }, spawns: [['skeleton', 4]] },
];
const RAID_INTERVAL = [15 * 60000, 25 * 60000];

// The Oakvale Chronicle: six pages of the founder's diary, scattered over the island (chronicle_page things in
// default-map.js, meta page: n; page 5 from the hermit, page 6 from the Choir Cantor). Each one read is kept
// (player.chests chronicle_n); Master Corwin pieces them together.
const CHRONICLE = [
  'Day one ashore. The sea froze behind the Dawn, as if to tell us: stay. We carried the spark up the beach wrapped in sailcloth. It is warm still. - E.M.',
  'On the hill east of our camp stands a tower, older than any of us, roofless, empty. Someone kept watch here before we came. Watch for what, I wonder. - E.M.',
  'The long winter takes the old and the small. We bury them under the crag and pray they sleep. The spark keeps the hold warm. Perhaps it can keep them asleep as well. - E.M.',
  'The green folk of the hill came at night for our grain. We left them sacks by the river, and they left us in peace. Better a fed neighbour than a hungry foe. - E.M.',
  'At night I hear it: the spark sings, low, the way the mountain did. It wants to go home, and something there wants it back. We will cast it into bronze, and ring it every dawn, so that it never sleeps and never calls. - E.M.',
  'The bell is cast, and its bronze holds the spark. Let no one ever silence it. If the singers of ash come, they will come for the bell. - Edda Marrowind, first of Oakvale',
];

// What you read on the bookshelves of the world.
const LORE = [
  'A chronicle: "And the first Grandmaster bound Vharzul the Ashen beneath the burning mountain, and broke the seal\'s fire into five embers, that no one hand might hold it."',
  'A hymnal, its pages grey with ash: "Five embers shall gutter, and He shall wake." Someone has scratched out the last page.',
  'A sailor\'s log: "Saw a light under the waves off Ashport, burning. The crew says it is the drowned king\'s crown."',
  'A dwarven ledger: "Vault of the Stone Ember: inspected. Golems at their posts. All is well." The pages after it are torn out.',
  'A dusty book: "The four paths - steel, arrow, flame and leaf - all begin on the starter isle, at the oracle\'s word."',
  'A ledger: "Paid the pirates 300 gold for safe passage. Again."',
  'A book of maps. Someone has drawn a skull on the sea west of Ashport.',
  'A treatise on runes: "A blank rune holds nothing until a mage speaks its form into it."',
  'A cookbook. Most recipes involve fish.',
  'A sailor\'s almanac: "Gull\'s Wake, lost off Brightwater Isle with all hands. Her captain\'s sword was never recovered."',
];

// What you read on the bookshelves of Oakvale Isle (the starter island: map.isle).
const OAKVALE_LORE = [
  'A weather almanac, kept by the fishers of Oakvale: "Gulls inland by noon: a storm by night. Frost on the Willow: a hard winter. The bell sounds dull: rain tomorrow."',
  'An almanac of the long winter, in a shaky hand: "Day forty. The sea is ice as far as the eye can see. We burn the Dawn\'s chairs to keep warm, and sing to keep awake."',
  'The lighthouse log of Lighthouse Point: "The great storm. Waves over the point all night. At dawn the lamp was gone, and the tower with it. The boats came home by the light of our bonfire." The last pages are in Keeper Tamsin\'s hand.',
  'A founder\'s notes on bell-founding: "Copper and tin, four parts to one. Pour it hot and all at once, and never let the mould crack. A bell cast in anger rings sour."',
  'A hymnal, its pages grey with ash: "Sing the spark home, sing it under the mountain, sing till the bronze breaks." Someone has scratched out the last page.',
  'A herbal: "Marsh-mint for a sore belly, willow bark for an aching head, and for a wolf bite: run faster next time."',
  'A ledger of the Sleepy Boar, the year the bridge was built: "Forty pints for the bridge-builders. Paid in planks."',
  'A primer of the academy: "The four paths - steel, arrow, flame and leaf - begin at the oracle\'s word, upstairs. Choose with care: there is no unchoosing."',
  'A treatise on runes: "A blank rune holds nothing until a mage speaks its form into it."',
  'A book of tides for Lighthouse Point: "Low water at the tip: crabs. High water: more crabs."',
  'A cookbook. Most recipes involve fish.',
];

const ASHPORT = { x: 53, y: 93, z: 4 }, VALORIA_PIER = { x: 79, y: 72, z: 4 }, GREYMOOR_PIER = { x: 226, y: 13, z: 4 };

// Every port's captain sails to every other port; the fare goes by distance.
// key: what you say ({...} is the clickable word in the captain's greeting).
// Where a ship from elsewhere puts you ashore: the town square, beside the sun mosaic.
const PORTS = {
  valoria: { name: 'Valoria', key: '{Valoria}', at: VALORIA_PIER },
  ashport: { name: 'Ashport', key: '{Ashport}', at: ASHPORT },
  greymoor: { name: 'Greymoor', key: '{Greymoor} (Highlands)', at: GREYMOOR_PIER },
  frosthold: { name: 'Frosthold', key: '{Frosthold} (Frost Reach)', at: { x: 432, y: 102, z: 4 } },
  sylvaran: { name: 'Sylvaran', key: '{Sylvaran} (Elderwood)', at: { x: 642, y: 112, z: 4 } },
  kesh: { name: 'Kesh', key: '{Kesh} (Sunreach)', at: { x: 592, y: 362, z: 4 } },
  mirehaven: { name: 'Mirehaven', key: '{Mirehaven} (Mirefen)', at: { x: 122, y: 332, z: 4 } },
  verdant: { name: 'Port Verdant', key: 'Port {Verdant} (Tazal)', at: { x: 332, y: 402, z: 4 } },
  cinderhold: { name: 'Cinderhold', key: '{Cinderhold} (the volcano)', at: { x: 160, y: 455, z: 4 } },
};
// A town's priest: heals and blesses.
function priest(name, look, town) {
  return {
    name, look, home: town, greet: `Welcome to the temple of ${town}, $name. I can {heal} or {bless} you, or make you a {citizen} of ${town}.`,
    keywords: {
      heal: { heal: true }, 'bless|blessing': { bless: { cost: 500, perLevel: 50 } }, job: `I look after the temple of ${town}.`,
      'citizen|citizenship|home|hometown': { citizen: true },
    },
  };
}
function captain(name, home, look, job) {
  const keywords = { job, 'ship|sail|travel|destinations': `I sail to ${Object.keys(PORTS).filter(id => id !== home).map(id => PORTS[id].key).join(', ')}.` };
  for (const [id, port] of Object.entries(PORTS)) {
    if (id === home) continue;
    const from = PORTS[home].at, cost = Math.round(30 + Math.hypot(port.at.x - from.x, port.at.y - from.y) / 4);
    keywords[id] = { travel: { name: port.name, to: port.at, cost } };
  }
  return { name, look, greet: `Ahoy, $name! Where to? I sail to ${Object.keys(PORTS).filter(id => id !== home).map(id => PORTS[id].key).join(', ')}.`, keywords };
}

// The Glintvault cart track: from the bank down to the vaults, two floors below.
// Waypoints [x, y, z]; the cart rolls from one to the next in straight lines.
const VAULT_TRACK = [
  [146, 42, 4], [148, 42, 4], [148, 45, 3], [155, 45, 3], [155, 53, 3], [149, 53, 3], [149, 59, 3], [159, 59, 3],
  [159, 49, 2], [153, 49, 2], [153, 41, 2], [163, 41, 2], [163, 55, 2], [157, 61, 2], [150, 61, 2],
];
// The tiles of a track, in order: straight steps between waypoints, dropping a floor where the next one is lower.
function trackTiles(track) {
  const tiles = [];
  for (let i = 1; i < track.length; i++) {
    const [x0, y0] = track[i - 1], [x1, y1, z] = track[i], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 1; k <= n; k++) tiles.push([Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), z]);
  }
  return tiles;
}
// The forest where giant spiders live, and where something odd flies by now and then.
const WEBWOOD = { x0: 196, y0: 124, x1: 246, y1: 156, z: 4 };

// What Oakvale talks about over its ale: a hint at each of the isle's hidden quests (see QUESTS: watchman_greaves...),
// never the whole way. Townsfolk tell them when asked for {rumours} (the service { rumours: [texts] }, one at a time).
const RUMOURS = {
  well: 'Old Wim went down the town well for a bet, years ago, and never came back up. Did he win? Nobody has been down to ask. You would need a rope, and a strong stomach for rats.',
  tower: 'The Old Tower out in Deer Woods was a watchtower once. Its last three watchmen lie in our graveyard, side by side. They say the tower\'s cellar opens only for those who know the order of the watch... and that the watch wrote it on their graves, the old show-offs. Mind, nobody gets in at the door: it fell in years ago. And the tower\'s top storeys still stand, all crooked on the old beams: Captain Harrow went up there with the watch\'s pay the night the stair fell, and never came down. A lantern burns up there on dark nights.',
  ward: 'Brenna the armourer has been sour ever since Gnash\'s goblins took her grandmother\'s bronze shield. Goblins dig like moles, and they keep what they steal down in their holes under Goblin Hill. Bring her news of it and she might cheer up. And they say Gnash\'s lot dug deeper still, after King Mogg, the old goblin king buried under the hill with his sabre, and then stopped all at once and filled the hole in. Goblins are not easily frightened. Bring a shovel.',
  tidecutter: 'The fishers at Fisher\'s Rest talk of a drowned blade, the Tidecutter, lost with a boat off the west shore in the founders\' day. One old fisher swears he has its sea chart still, and cannot make head or tail of it.',
  lighthouse: 'The lighthouse on the point has been dark since the great storm. Keeper Tamsin says that whoever lights the old lamp again shall have the last keeper\'s lantern. Oil, a wick and a spark, she says: as if that were easy, out there.',
  chapel: 'Grave robbers in the founders\' crypt under Bone Rocks, years ago, swore they felt cold air through the east wall of the hall of coffins, and heard someone counting behind it. Counting bones, they said. They ran. A pick would tell you more than I can.',
  weaver: 'An adventurer went into the spiders\' den under the Spider Hills, years back, past the big queen and further down, and never came out. His friends say the queen is not the oldest thing down there: something pale, they say, that weaves in the deep. Bring fire. Webs burn.',
  smugglers: 'Before the great storm, smugglers landed at Lighthouse Point, right under the old keeper\'s nose. When he caught on he walled up their hole in the rocks east of the point, with them still down there, some say. Their copper shield went down with them. Crabs live there now, and big ones. Bring a pick for the old keeper\'s stones.',
  eagle: 'The eagles of the North Peaks nest where nobody can climb. The night hermit on Hermit Rock would give a lot for one of their feathers, they say, and there is a cave in the North Peaks that climbs right up inside the mountain. I would not go in. Ghosts.',
};

// look: palette for the humanoid sprite (see Sprites). trade: { sells: [[itemId, price]], buys: [BUYS keys] }
const NPCS = {
  // ---- Brightwater Isle --------------------------------------------------------
  maren: {
    name: 'Elder Maren',
    look: { skin: '#f0c8a0', hair: '#d8d8d8', body: '#ece4cc', arms: '#ece4cc', legs: '#ece4cc', belt: '#b89a50', robe: true },
    greet: 'Welcome, $name! I am Elder Maren. Brightwater Isle is where young adventurers learn the ropes. Ask me about {fighting}, {loot}, {skills}, {spells}, {tools}, {food} or the {Seer}. I also have a {quest} for you.',
    keywords: {
      'job|elder': 'I watch over this village and its young adventurers.',
      'fighting|fight': 'Click a monster, or press Space, to attack it. Choose offensive or defensive fighting at the battle list. Better weapons and armor help a lot: drag them from your bag onto your equipment. Drink a {potion} when you are hurt.',
      'loot|corpse': 'When a monster dies, right-click its corpse to open it, then drag or click the items to take them. Sell what you do not need to {Bram} or {Hilda}. Watch your capacity: you can only carry so much.',
      skills: 'Every weapon you use trains its skill: sword, axe, club, distance or fist fighting. A shield trains shielding when you are hit, and spending mana trains your magic level. See the Skills tab.',
      spells: 'You learn Torchlight at level 2 and Light Heal at level 3. Cast spells with the number keys, the buttons under the map, or by saying their words: "lumen" lights the dark. Your {vocation} will teach you more.',
      tools: 'A rope gets you up through rope spots, a shovel digs up loose sand, a pick breaks cracked rocks and a fishing rod catches fish. Hilda sells them. Use a tool, then click where to use it.',
      'food|eat|hungry': 'Eat food (press F, or right-click it in your bag) and you regain health and mana much faster.',
      'potion|potions': 'Hilda sells health and mana potions. Press H or M to drink one.',
      'map|minimap': 'The map in the corner shows where you have been. Click on it to walk there, or open the big world map with G.',
      'seer|vocation|mainland': 'When you reach level 10, visit the Seer in the tower south of the square. She lets you choose a vocation and sends you to the mainland. Nobody ever comes back from there, so do not hurry.',
      'sword|captain|varrow|legend|legends|secret|secrets|myth': 'Captain Varrow\'s sword? Every child on this island has looked for it, and so did I. Nobody has ever found it. The sea keeps what it takes - or so we tell the children, to keep them out of the graveyard at night.',
      bram: 'Bram the smith has his shop west of the square. He sells weapons and armor.',
      hilda: "Hilda's shop is east of the square: food, potions, tools and backpacks.",
      tomas: 'Guard Tomas stands at the south-east corner of the square. He always needs help with the goblins.',
      heal: { heal: true },
      'quest|mission|task': { quest: ['rat_problem'] },
    },
  },
  bram: {
    name: 'Bram the Smith',
    look: { skin: '#e0a878', hair: '#3a2a1a', beard: '#3a2a1a', body: '#6b4a2a', arms: '#e0a878', legs: '#3a3a40', belt: '#2a1a0a' },
    greet: 'Hello $name, welcome to my smithy! Want to {trade}? I also buy the weapons and armor you find - or bring me ore, and I {forge} your gear better.',
    forge: true,
    keywords: {
      job: 'I forge weapons and armor.',
      'forge|fuse|ore|grade|upgrade|quality': { forge: true },
      'weapon|weapons': 'Swords, axes and clubs each train their own skill. Pick one and stick with it.',
      crypt: 'They say the old crypt south of the village hides an armory. Only one weapon can be claimed, so choose wisely. And there is a cracked wall down there - a pick might help.',
      'sword|broadsword|captain|varrow|legend': 'A mainland broadsword, on this island? I could not forge one, and nobody here can. If there is one, the sea brought it. And the sea gives nothing back for free.',
    },
    trade: {
      sells: [['wooden_club', 10], ['dagger', 18], ['hatchet', 30], ['short_sword', 45], ['spear', 8], ['wooden_shield', 15],
        ['leather_cap', 12], ['leather_armor', 35], ['leather_legs', 15], ['leather_boots', 15]],
      buys: ['gear', 'distance'],
    },
  },
  hilda: {
    name: 'Hilda',
    look: { skin: '#f0c090', hair: '#d8a040', body: '#b04a5a', arms: '#f0c090', legs: '#b04a5a', belt: '#f0e0c0', robe: true },
    greet: "Hi $name! Food, potions and tools, just ask to {trade}. Oh... and I lost a {parcel}.",
    keywords: {
      job: 'I sell provisions and tools, and I buy pelts, silk and other things you find on monsters.',
      'parcel|quest|mission': { quest: ['lost_parcel'] },
      'beach|treasure|shovel': 'Fishermen say something is buried in the loose sand on the eastern beach. Bring a shovel!',
      'sword|captain|varrow|legend|bell|well': 'Old Pim swore he once heard a bell ringing down in the village well, on a still night, after someone said something into it. Pim had had a few, mind you.',
    },
    trade: {
      sells: [['apple', 3], ['bread', 5], ['meat', 8], ['health_potion', 25], ['mana_potion', 50], ['backpack', 60],
        ['rope', 50], ['shovel', 50], ['pick', 50], ['fishing_rod', 120], ['book_guide', 20]],
      buys: ['loot'],
    },
  },
  tomas: {
    name: 'Guard Tomas',
    look: { skin: '#e0b088', hair: '#5a3a1a', body: '#8a8f99', arms: '#8a8f99', legs: '#5a5f6a', belt: '#4a3a2a', hat: { style: 'helmet', color: '#a0a6b0' } },
    greet: 'Halt! Oh, an adventurer. The {goblins} keep raiding us. I could use your help, ask me for a {mission}.',
    keywords: {
      job: 'I guard the village.',
      goblins: 'Their camp is east of the village. Follow the road.',
      'gnarl|troll': 'Old Gnarl is a huge troll who lives in the swamp north-west of the village. He hoards whatever washes ashore.',
      'sword|captain|varrow|legend|secret': 'The captain\'s sword? Ha! My grandfather dug up half the graveyard looking for it, in broad daylight. All he found was worms, and the Elder\'s temper.',
      crypt: 'The crypt south of the village is full of skeletons. Do not go there before level 4 or so.',
      forest: 'Wolves and spiders roam the forest north of the village. A hunter once hid his gear somewhere up there.',
      'seer|vocation|mainland': 'The Seer lives in the tower south of the square. At level 10 she lets you choose your path, and sends you to the mainland.',
      'mission|quest|task': { quest: ['goblin_raid', 'old_gnarl'] },
    },
  },
  seer: {
    name: 'Seer Ysolde',
    look: { skin: '#e8c8a8', body: '#3a3a7a', arms: '#3a3a7a', legs: '#3a3a7a', belt: '#c0a040', robe: true, hat: { style: 'hood', color: '#2e2e66' } },
    greet: 'I have been expecting you, $name. Shall I reveal your {destiny}? And I must tell you of my {dream}.',
    keywords: {
      job: 'I see what others cannot.',
      'dream|prophecy|seal|ember': { quest: ['seal_1'] },
      'destiny|vocation|vocations': { destiny: true },
      'bastion|knight': { vocation: 'knight' },
      'hawk|paladin': { vocation: 'paladin' },
      'ember|sorcerer': { vocation: 'sorcerer' },
      'grove|druid': { vocation: 'druid' },
      mainland: 'The mainland is wide and dangerous. Only those who have chosen a vocation may travel there - and nobody who goes ever comes back to this island.',
      'sword|captain|varrow|legend|gull|bell|whistle|wreck|secret': 'I see a blade under a stone that weeps, a bell that rings for nobody, and a whistle nobody blows. Beyond that the sea is silent... or it is laughing at me.',
    },
  },

  // ---- Mainland: the city of Valoria ----------------------------------------------
  ilsa: {
    name: 'Priestess Ilsa',
    look: { skin: '#f0c8a0', hair: '#f0d080', body: '#f4f4ff', arms: '#f4f4ff', legs: '#f4f4ff', belt: '#d0a030', robe: true },
    home: 'Valoria',
    greet: 'Welcome to Valoria, $name. I can {heal} you, or {bless} you against losing your things when you die. Ask me about the {city} or its {dangers} - or, if you live elsewhere now, become a {citizen} of Valoria again.',
    keywords: {
      job: 'I tend to the temple and heal the wounded.',
      'citizen|citizenship|home|hometown': { citizen: true },
      heal: { heal: true },
      'bless|blessing': { bless: { cost: 500, perLevel: 50 } },
      'city|shops': 'Dask sells armor and blades, Wynn bows and arrows, Velan wands, rods and runes, and Orla provisions and furniture. Ostrom runs the {bank} and Captain Bree sails to {Ashport}. Captain {Rhea} on the square has {missions}.',
      dangers: 'Orcs hold a fortress to the north-east, bandits camp to the south, ogres dwell in caves to the north-west, and dark mages guard a tower to the east.',
      'missions|rhea|captain': 'Captain Rhea, on the square, pays well for help.',
      'bank|depot': 'Your depot locker is here in the temple. The bank is Ostrom, on the square.',
      ashport: 'Ashport is a harbour town on an island to the south-west. Captain Bree sails there from the pier west of the city.',
      'promotion|orin': 'Grandmaster Orin, here in the temple, promotes experienced adventurers.',
      spells: 'You learn new spells as you gain levels. The buttons under the map show them all, with their words.',
    },
  },
  orin: {
    name: 'Grandmaster Orin',
    look: { skin: '#e0c0a0', hair: '#eeeeee', beard: '#eeeeee', body: '#5a1a2a', arms: '#5a1a2a', legs: '#5a1a2a', belt: '#d0a030', robe: true },
    greet: 'Greetings, $name. Have you come for your {promotion}? Or... about the {seal}?',
    keywords: {
      job: 'I promote those who have proven themselves - and I am the last of the Order of the Seal.',
      'seal|ember|embers|choir|story|dream|vharzul|order': { quest: ['seal_1', 'seal_2', 'seal_3', 'seal_4', 'seal_5', 'seal_6', 'seal_7', 'seal_8', 'seal_9'] },
      promotion: { promote: { level: 20, cost: 2000 } },
    },
  },
  dask: {
    name: 'Armorer Dask',
    look: { skin: '#e0a878', hair: '#8a3a1a', beard: '#8a3a1a', body: '#7a7f89', arms: '#7a7f89', legs: '#4a4f5a', belt: '#3a2a1a' },
    greet: "Need better steel, $name? Let's {trade} - or bring me ore and I'll {forge} what you have.",
    forge: true,
    keywords: { job: 'I sell the finest blades and armor in Valoria.', 'forge|fuse|ore|grade|upgrade|quality': { forge: true } },
    trade: {
      sells: [['broadsword', 400], ['battle_axe', 450], ['war_hammer', 450], ['knight_blade', 1200], ['iron_shield', 250], ['tower_shield', 900],
        ['chain_helmet', 80], ['steel_helmet', 450], ['chain_armor', 200], ['plate_armor', 900], ['chain_legs', 100], ['plate_legs', 600], ['iron_boots', 200]],
      buys: ['gear'],
    },
  },
  wynn: {
    name: 'Fletcher Wynn',
    look: { skin: '#f0c090', body: '#3f6a32', arms: '#3f6a32', legs: '#5a4428', belt: '#2a1a0a', hat: { style: 'hood', color: '#355a2a' } },
    greet: 'Bows, arrows, spears - want to {trade}, $name?',
    keywords: { job: 'I make bows and arrows. Hawks are my best customers.' },
    trade: {
      sells: [['spear', 8], ['bow', 150], ['crossbow', 500], ['arrow', 3], ['bolt', 4], ['ranger_cloak', 450], ['leather_boots', 15]],
      buys: ['distance'],
    },
  },
  velan: {
    name: 'Arcanist Velan',
    look: { skin: '#e8c8a8', beard: '#cccccc', body: '#2a4a8a', arms: '#2a4a8a', legs: '#2a4a8a', belt: '#c0a040', robe: true, hat: { style: 'pointy', color: '#2a4a8a' } },
    greet: 'Ah, $name. Wands, rods, runes and robes - shall we {trade}?',
    keywords: {
      job: 'I study the arcane and sell tools to those who practice it.',
      'wand|wands|rod|rods': 'Wands are for Embers, rods for Groves. Each shot costs a little mana.',
      'rune|runes': 'Runes are spells you can carry. Use one, then click a target. Mages can make their own from blank runes - anyone can buy them from me.',
    },
    trade: {
      sells: [['wand_sparks', 300], ['wand_flames', 800], ['rod_frost', 300], ['rod_thorns', 800], ['spellbook', 300],
        ['wizard_hat', 180], ['mage_robe', 450], ['mana_potion', 50], ['blank_rune', 10], ['rune_missile', 12], ['rune_fireball', 30],
        ['rune_heal', 40], ['rune_fire_field', 20], ['rune_poison_field', 15], ['rune_energy_field', 25], ['rune_magic_wall', 60], ['rune_paralyze', 120]],
      buys: ['magic'],
    },
  },
  orla: {
    name: 'Orla',
    look: { skin: '#f0c090', hair: '#3a2a1a', body: '#8a5a9a', arms: '#f0c090', legs: '#8a5a9a', belt: '#e0d0b0', robe: true },
    greet: "Hello $name! Food, potions, tools and furniture, let's {trade}. I also buy pelts, teeth and such.",
    keywords: {
      job: 'I run the provisions store.',
      furniture: 'Furniture kits are for your house. Use one, then click a tile inside your house.',
    },
    trade: {
      sells: [['apple', 3], ['bread', 5], ['meat', 8], ['health_potion', 25], ['mana_potion', 50], ['backpack', 60],
        ['rope', 50], ['shovel', 50], ['pick', 50], ['fishing_rod', 120], ['kit_table', 60], ['kit_chair', 30], ['kit_plant', 45], ['kit_bed', 120]],
      buys: ['loot', 'jewelry', 'tools'],
    },
  },
  rhea: {
    name: 'Captain Rhea',
    look: { skin: '#e0b088', hair: '#2a1a0a', body: '#8a2a2a', arms: '#8a2a2a', legs: '#4a4a52', belt: '#d0a030', hat: { style: 'helmet', color: '#c0c4cc' } },
    greet: 'At ease, $name. The city needs fighters. Ask me for a {mission}.',
    keywords: {
      job: 'I command the city guard.',
      'mission|quest|task': { quest: ['orc_menace', 'highway_robbers'] },
      'orcs|orc': 'Their fortress lies north-east. Take the road north from the square, then east. Sometimes they march on the city itself.',
      'bandits|bandit': 'Bandits camp south of the city, along the south road.',
      'ogres|ogre': 'Ogres live in caves north-west of the city. Rumour says they hoard treasure.',
      'tower|mages': 'Dark mages hold the tower to the east. Nobody who climbed it came back.',
    },
  },
  ostrom: {
    name: 'Banker Ostrom',
    look: { skin: '#f0c8a0', hair: '#5a4a3a', body: '#2a3a5a', arms: '#2a3a5a', legs: '#2a2a3a', belt: '#d0a030' },
    greet: 'Welcome to the bank of Valoria, $name. You can {deposit}, {withdraw} or check your {balance}.',
    keywords: { 'deposit|withdraw|balance': { bank: true }, job: 'I keep your gold safe.' },
  },
  bree: captain('Captain Bree', 'valoria',
    { skin: '#d8a070', hair: '#c04020', body: '#2a4a6a', arms: '#d8a070', legs: '#3a2a1a', belt: '#5a3a1a', hat: { style: 'hood', color: '#7a1a1a' } },
    'I am the captain of the Gull.'),
  mira: {
    name: 'Landlady Mira',
    look: { skin: '#f0c090', hair: '#8a5a2a', body: '#4a6a4a', arms: '#f0c090', legs: '#4a6a4a', belt: '#e0d0b0', robe: true },
    greet: 'Looking for a home, $name? I have {houses} for rent.',
    keywords: { 'houses|house|rent|leave': { houses: true }, job: 'I rent out houses in Valoria and Ashport.' },
  },

  // ---- Ashport ------------------------------------------------------------------
  aldo: {
    name: 'Father Aldo',
    look: { skin: '#e0b088', hair: '#5a5a5a', body: '#f0f0f0', arms: '#f0f0f0', legs: '#f0f0f0', belt: '#4a6aa0', robe: true },
    greet: 'Peace, $name. I can {heal} or {bless} you.',
    keywords: { heal: { heal: true }, 'bless|blessing': { bless: { cost: 500, perLevel: 50 } }, job: 'I watch over the souls of Ashport.' },
  },
  marla: {
    name: 'Banker Marla',
    look: { skin: '#f0c8a0', hair: '#2a1a0a', body: '#2a3a5a', arms: '#2a3a5a', legs: '#2a2a3a', belt: '#d0a030', robe: true },
    greet: 'Bank of Ashport. You can {deposit}, {withdraw} or check your {balance}, $name.',
    keywords: { 'deposit|withdraw|balance': { bank: true }, job: 'I keep your gold safe.' },
  },
  gus: {
    name: 'Gus',
    look: { skin: '#d8a070', hair: '#6a6a6a', beard: '#6a6a6a', body: '#6a5a3a', arms: '#d8a070', legs: '#3a3a3a', belt: '#2a1a0a' },
    greet: "Ahoy $name. Fish, tools, runes, whatever you need. Let's {trade}.",
    keywords: { job: 'I sell everything a sailor needs.' },
    trade: {
      sells: [['fish', 6], ['bread', 5], ['health_potion', 25], ['mana_potion', 50], ['rope', 50], ['shovel', 50], ['pick', 50],
        ['fishing_rod', 120], ['blank_rune', 10], ['rune_missile', 12], ['rune_heal', 40], ['arrow', 3], ['kit_chair', 30], ['kit_plant', 45]],
      buys: ['loot', 'jewelry'],
    },
  },
  finn: {
    name: 'Landlord Finn',
    look: { skin: '#f0c090', hair: '#c0a040', body: '#5a4a6a', arms: '#f0c090', legs: '#3a3a3a', belt: '#2a1a0a' },
    greet: 'Need a roof over your head, $name? I have {houses} for rent.',
    keywords: { 'houses|house|rent|leave': { houses: true }, job: 'I rent out houses in Ashport and Valoria.' },
  },
  hal: captain('Captain Hal', 'ashport',
    { skin: '#c89060', hair: '#2a2a2a', beard: '#2a2a2a', body: '#1a2a4a', arms: '#c89060', legs: '#2a2a2a', belt: '#5a3a1a' },
    'I am the captain of the Tern, out of Ashport.'),
  ida: {
    name: 'Harbormaster Ida',
    look: { skin: '#e0b088', hair: '#3a2a1a', body: '#2a5a6a', arms: '#2a5a6a', legs: '#2a2a3a', belt: '#d0a030', hat: { style: 'hood', color: '#1a3a4a' } },
    greet: 'Welcome to Ashport, $name. Ships are going missing - ask me about the {Drowned King}.',
    keywords: { 'ember|embers|seal': { quest: ['seal_3'] },
      'drowned|king|quest|mission|chart': { quest: ['drowned_king'] },
      job: 'I run the harbour of Ashport.',
      'pirates|caves': 'Pirates hide in caves below the ruin south-east of town.',
    },
  },
  keeper: {
    name: 'Lighthouse Keeper',
    look: { skin: '#e0b088', hair: '#dddddd', beard: '#dddddd', body: '#8a6a3a', arms: '#8a6a3a', legs: '#3a3a3a', belt: '#2a1a0a', hat: { style: 'hood', color: '#4a3a2a' } },
    greet: 'Hm? A visitor. What brings you to my lighthouse, $name? The {Drowned King}, perhaps?',
    keywords: { 'drowned|king|quest|mission': { quest: ['drowned_king'] }, job: 'I keep the light burning so ships find their way.' },
  },

  // ---- Castle Greymoor ----------------------------------------------------------
  odran: {
    name: 'King Odran',
    look: { skin: '#f0c8a0', hair: '#d8d8d8', beard: '#d8d8d8', body: '#8a1a22', arms: '#8a1a22', legs: '#8a1a22', belt: '#d0a030', robe: true, hat: { style: 'crown', color: '#e0c040' } },
    greet: 'Kneel before the throne of Greymoor, $name. My realm is beset by {dragons}, {cyclopes} and worse - {spiders} in my own cellars! I have a {mission} for the brave.',
    keywords: {
      'mission|quest|task': { quest: ['cellar_webs', 'dragon_bane'] },
      'dragons|dragon': 'They nest in a lair below the cyclops mountain, south-east of here. Only the strongest return from it.',
      'cyclopes|cyclops|mountain': 'The one-eyed brutes hold the mountain south-east of the castle. Captain {Brenna} deals with them.',
      'spiders|spider|cellar|cellars': 'Giant spiders crawled up from the Webwood, south of the mountain, into my cellars.',
      'webwood|forest': 'A dark forest south of the mountain, thick with webs. Strange things are seen there... flying things.',
      brenna: 'My captain. She keeps the gate.',
      'elf|dobby': 'My house-elf. He scrubs the chambers upstairs. Odd little fellow, always staring at the laundry.',
      job: 'I rule the Highlands from this castle, as my fathers did.',
    },
  },
  brenna: {
    name: 'Captain Brenna',
    look: { skin: '#e0b088', hair: '#8a4a1a', body: '#8a8f99', arms: '#8a8f99', legs: '#4a4a52', belt: '#8a1a22', hat: { style: 'helmet', color: '#a8aeb8' }, held: 'sword' },
    greet: 'Halt! Ah, an adventurer. Welcome to Greymoor, $name. If you can swing a weapon, I have a {mission} for you.',
    keywords: {
      'mission|quest|task|cyclops|cyclopes': { quest: ['cyclops_threat'] },
      king: 'King {Odran} holds court in the keep, north of the courtyard.',
      odran: 'Our king. You will find him on his throne in the keep.',
      'castle|greymoor': 'The chapel is west, the smith east, the treasury north-east. The cellars... are best avoided.',
      job: 'I command the guard of Castle Greymoor.',
    },
  },
  torvald: {
    name: 'Smith Torvald',
    look: { skin: '#d8a070', hair: '#2a2a2a', beard: '#5a3a1a', body: '#5a4a3a', arms: '#d8a070', legs: '#3a3a3a', belt: '#2a1a0a', held: 'axe' },
    greet: 'Heavy steel for heavy foes, $name. Let\'s {trade}, or bring ore to my {forge}. I also buy dragon scales and the like.',
    forge: true,
    keywords: { job: 'I forge armour for the castle guard.', 'forge|fuse|ore|grade|upgrade|quality': { forge: true } },
    trade: {
      sells: [['plate_armor', 1000], ['plate_legs', 700], ['steel_helmet', 500], ['iron_shield', 280], ['iron_boots', 220], ['war_hammer', 500], ['broadsword', 450], ['crossbow', 550], ['bolt', 4]],
      buys: ['gear', 'loot'],
    },
  },
  elin: {
    name: 'Sister Elin',
    look: { skin: '#f0c8a0', hair: '#c0a060', body: '#f0f0f0', arms: '#f0f0f0', legs: '#f0f0f0', belt: '#8a1a22', robe: true, hat: { style: 'hood', color: '#e0e0e8' } },
    greet: 'The light keep you, $name. I can {heal} or {bless} you.',
    keywords: { heal: { heal: true }, 'bless|blessing': { bless: { cost: 500, perLevel: 50 } }, job: 'I tend the chapel of Greymoor.' },
  },
  pell: {
    name: 'Treasurer Pell',
    look: { skin: '#f0c8a0', hair: '#6a6a6a', body: '#2a3a5a', arms: '#2a3a5a', legs: '#2a2a3a', belt: '#d0a030', robe: true },
    greet: 'The royal treasury. You can {deposit}, {withdraw} or check your {balance}, $name.',
    keywords: { 'deposit|withdraw|balance': { bank: true }, job: 'I count the king\'s gold. And yours.' },
  },
  rook: captain('Captain Rook', 'greymoor',
    { skin: '#c89060', hair: '#3a3a3a', beard: '#3a3a3a', body: '#3a2a1a', arms: '#c89060', legs: '#2a2a2a', belt: '#8a6a3a', hat: { style: 'bandana', color: '#2a4a6a' } },
    'I sail out of Greymoor harbour.'),
  dobby: {
    name: 'Dobby',
    look: { scale: 0.7, skin: '#d8c8a8', hair: '#d8c8a8', eye: '#3aa040', bigEyes: true, ears: true, body: '#ddd5c2', arms: '#d8c8a8', legs: '#d8c8a8', belt: '#b0a890' },
    greet: 'Oh! A visitor! Dobby is not supposed to talk to visitors, sir. Dobby must keep cleaning... unless you could help Dobby be {free}?',
    keywords: {
      'free|freedom|sock|socks|quest|mission|help': { quest: ['free_elf'] },
      'master|king': 'The king is not cruel, sir, but Dobby has polished the same silver for ninety years. Dobby would like to see the sea.',
      'elf|house-elf': 'A house-elf serves a household until they are given clothes. Only clothes! Even one sock would do.',
      job: 'Dobby cleans, sir. Dobby cleans everything. Always.',
    },
  },
  greymoor_guard: {
    name: 'Castle Guard',
    look: { skin: '#e0b088', hair: '#3a2a1a', body: '#8a8f99', arms: '#8a8f99', legs: '#4a4a52', belt: '#8a1a22', hat: { style: 'helmet', color: '#a8aeb8' }, held: 'sword' },
    greet: 'Move along, $name. Speak to Captain {Brenna} inside if you want work.',
    keywords: { brenna: 'She is just inside the gate.', job: 'I guard the gate of Greymoor.' },
  },
  // ---- Frosthold, in the Frost Reach --------------------------------------------
  jarl: {
    name: 'Jarl Hakon',
    look: { skin: '#f0c8a0', hair: '#d8b060', beard: '#d8b060', body: '#6a4a32', arms: '#8a8a90', legs: '#3a2a1a', belt: '#8a6a3a', hat: { style: 'helmet', color: '#a8aeb8' }, held: 'axe' },
    greet: 'Hail, $name! Frosthold welcomes those who can swing an axe. I have a {mission} for the bold.',
    keywords: { 'ember|embers|seal': { quest: ['seal_4'] },
      'mission|quest|task|yeti|yetis|dragons': { quest: ['yeti_hunt', 'frost_dragons'] },
      peaks: 'Yetis roam the Yeti Peaks, north-east of town. The path up is on their south side.',
      'caves|ice': 'Below the peaks lie the ice caves, and deeper still, frost dragons.',
      job: 'I am the jarl of Frosthold.',
    },
  },
  sigrun: priest('Sigrun', { skin: '#f4d8c0', hair: '#e8e0c0', body: '#e8eef4', arms: '#e8eef4', legs: '#e8eef4', belt: '#4a7ab0', robe: true }, 'Frosthold'),
  bjorn: {
    name: 'Bjorn',
    look: { skin: '#f0c8a0', hair: '#8a4a1a', beard: '#8a4a1a', body: '#5a4a3a', arms: '#f0c8a0', legs: '#3a3a3a', belt: '#2a1a0a', held: 'axe' },
    greet: 'Cold out there, $name? Let\'s {trade}. Good steel and warm meat.',
    keywords: { job: 'I trade in everything a northerner needs.' },
    trade: {
      sells: [['meat', 8], ['health_potion', 25], ['mana_potion', 50], ['rope', 50], ['shovel', 50], ['steel_helmet', 500], ['plate_armor', 1000], ['plate_legs', 700], ['battle_axe', 450], ['iron_shield', 280]],
      buys: ['gear', 'loot'],
    },
  },
  halvard: captain('Captain Halvard', 'frosthold', { skin: '#f0c8a0', hair: '#c0c0c0', beard: '#c0c0c0', body: '#3a4a5a', arms: '#3a4a5a', legs: '#2a2a2a', belt: '#5a3a1a' }, 'My longship braves the ice.'),

  // ---- Sylvaran, the elf town in the Elderwood ----------------------------------
  lirael: {
    name: 'Elder Lirael',
    look: { skin: '#f4dcc0', hair: '#f0e8b0', ears: true, body: '#3a6a3a', arms: '#3a6a3a', legs: '#3a6a3a', belt: '#c0a040', robe: true },
    greet: 'The forest greets you, $name. The Elderwood is troubled - perhaps you have come to help? Ask me for a {mission}.',
    keywords: {
      'mission|quest|task|bears|spiders': { quest: ['bear_trouble', 'shadowglen'] },
      shadowglen: 'A dark hollow in the south of the Elderwood, full of webs.',
      job: 'I am the eldest of Sylvaran.',
    },
  },
  elowen: priest('Elowen', { skin: '#f4dcc0', hair: '#c0a060', ears: true, body: '#e8f0e0', arms: '#e8f0e0', legs: '#e8f0e0', belt: '#5aa04a', robe: true }, 'Sylvaran'),
  faelan: {
    name: 'Faelan',
    look: { skin: '#f4dcc0', hair: '#4a2a1a', ears: true, body: '#4a6a2a', arms: '#4a6a2a', legs: '#3a4a2a', belt: '#8a6a3a', hat: { style: 'hood', color: '#3a5a2a' }, held: 'bow' },
    greet: 'Well met, $name. Elven bows, arrows and runes. Let\'s {trade}.',
    keywords: { job: 'I sell what the forest gives.' },
    trade: {
      sells: [['bow', 150], ['elven_bow', 2400], ['arrow', 3], ['spear', 8], ['ranger_cloak', 450], ['health_potion', 25], ['mana_potion', 50], ['blank_rune', 10], ['rune_heal', 40], ['apple', 3]],
      buys: ['distance', 'magic', 'loot'],
    },
  },
  thalion: captain('Thalion', 'sylvaran', { skin: '#f4dcc0', hair: '#d0d0d0', ears: true, body: '#2a4a6a', arms: '#2a4a6a', legs: '#2a3a4a', belt: '#c0a040' }, 'I steer the white ships of Sylvaran.'),

  // ---- Deepforge, the dwarf city below the Ironpeak mountains --------------------
  durgan: {
    name: 'Foreman Durgan',
    look: { scale: 0.85, skin: '#e0a880', hair: '#8a3a1a', beard: '#8a3a1a', body: '#6a5a4a', arms: '#e0a880', legs: '#4a3a2a', belt: '#c0a040', hat: { style: 'helmet', color: '#9a9aa2' }, held: 'axe' },
    greet: 'Mind your head, $name - Deepforge was not built for tall folk. Looking for a {mission}?',
    keywords: { 'ember|embers|seal': { quest: ['seal_5', 'seal_8'] },
      'mission|quest|task|golems|minotaurs': { quest: ['labyrinth', 'golem_menace'] },
      mines: 'East of the city. The stone woke up down there - golems everywhere.',
      labyrinth: 'West of the city lies an old maze. Minotaurs moved in.',
      job: 'I run the mines of Deepforge.',
    },
  },
  hilde: priest('Hilde', { scale: 0.85, skin: '#e8b890', hair: '#c0c0c0', body: '#e8e0d0', arms: '#e8e0d0', legs: '#e8e0d0', belt: '#c0a040', robe: true }, 'Deepforge'),
  gorm: {
    name: 'Gorm the Smith',
    look: { scale: 0.85, skin: '#d89870', hair: '#2a2a2a', beard: '#2a2a2a', body: '#4a3a2a', arms: '#d89870', legs: '#3a3a3a', belt: '#2a1a0a', held: 'axe' },
    greet: 'Dwarven steel, $name. Nothing better. Let\'s {trade} - and the best {forge} under the mountains is mine. We mine the ore right here.',
    forge: true,
    keywords: { job: 'I forge the finest armour under the mountains.', 'forge|fuse|ore|grade|upgrade|quality': { forge: true } },
    trade: {
      sells: [['plate_armor', 900], ['plate_legs', 650], ['steel_helmet', 450], ['tower_shield', 900], ['war_hammer', 450], ['battle_axe', 420], ['knight_blade', 1100], ['iron_boots', 200], ['pick', 50]],
      buys: ['gear', 'loot'],
    },
  },
  brunn: {
    name: 'Banker Brunn',
    look: { scale: 0.85, skin: '#e0a880', hair: '#e0d0a0', beard: '#e0d0a0', body: '#2a3a5a', arms: '#2a3a5a', legs: '#2a2a3a', belt: '#d0a030' },
    greet: 'Gold is safe under a mountain, $name. {deposit}, {withdraw} or {balance}?',
    keywords: { 'deposit|withdraw|balance': { bank: true }, job: 'I keep the gold of Deepforge.' },
  },

  // ---- Kesh, the oasis city of the Sunreach desert --------------------------------
  amal: {
    name: 'Vizier Amal',
    look: { skin: '#b07850', hair: '#1a1a1a', beard: '#1a1a1a', body: '#e8dcc0', arms: '#e8dcc0', legs: '#e8dcc0', belt: '#d0a030', robe: true, hat: { style: 'hood', color: '#8a2a2a' } },
    greet: 'Peace upon you, $name. Kesh has troubles only a stranger can solve. Ask me for a {mission}.',
    keywords: { 'ember|embers|seal': { quest: ['seal_6'] },
      'mission|quest|task|scorpions|king': { quest: ['scorpion_plague', 'sand_king'] },
      pyramid: 'East of the city stands the pyramid of the Sand King. He does not rest.',
      job: 'I serve the city of Kesh.',
    },
  },
  nadira: priest('Nadira', { skin: '#b07850', hair: '#2a1a0a', body: '#f0f0e8', arms: '#f0f0e8', legs: '#f0f0e8', belt: '#3a8ab0', robe: true }, 'Kesh'),
  rashid: {
    name: 'Rashid',
    look: { skin: '#a87048', hair: '#1a1a1a', beard: '#1a1a1a', body: '#4a6a9a', arms: '#a87048', legs: '#e8dcc0', belt: '#d0a030', hat: { style: 'bandana', color: '#e8dcc0' } },
    greet: 'Welcome to my stall, $name! Everything a traveller needs. Let\'s {trade}.',
    keywords: { job: 'I am the best merchant in all of Kesh.' },
    trade: {
      sells: [['health_potion', 25], ['mana_potion', 50], ['bread', 5], ['fish', 6], ['rope', 50], ['shovel', 50], ['blank_rune', 10], ['rune_fireball', 30], ['rune_heal', 40], ['rune_missile', 12], ['wand_flames', 800], ['rod_thorns', 800]],
      buys: ['loot', 'jewelry', 'magic'],
    },
  },
  saba: captain('Captain Saba', 'kesh', { skin: '#a87048', hair: '#1a1a1a', body: '#e8dcc0', arms: '#a87048', legs: '#3a3a3a', belt: '#8a2a2a', hat: { style: 'bandana', color: '#3a6a9a' } }, 'My dhow sails all the seas.'),
  omar: {
    name: 'Omar the Moneychanger',
    look: { skin: '#b07850', hair: '#5a5a5a', beard: '#5a5a5a', body: '#2a3a5a', arms: '#2a3a5a', legs: '#2a2a3a', belt: '#d0a030', robe: true },
    greet: 'Your gold, $name? {deposit}, {withdraw} or {balance}.',
    keywords: { 'deposit|withdraw|balance': { bank: true }, job: 'I keep gold for the travellers of Kesh.' },
  },

  // ---- Mirehaven, the stilt town of the Mirefen ------------------------------------
  marsh: {
    name: 'Old Marsh',
    look: { skin: '#d8b090', hair: '#8a8a7a', beard: '#8a8a7a', body: '#4a5a3a', arms: '#4a5a3a', legs: '#3a3a2a', belt: '#2a1a0a', hat: { style: 'hood', color: '#3a4a2a' } },
    greet: 'Mind the mud, $name. Mirehaven needs a hand - ask me for a {mission}.',
    keywords: {
      'mission|quest|task|trolls|witches': { quest: ['troll_raid', 'witch_coven'] },
      coven: 'Witches gather in the west of the fen. Bad business.',
      job: 'I am the oldest in Mirehaven. That makes me the mayor.',
    },
  },
  reed: priest('Mother Reed', { skin: '#d8b090', hair: '#e0e0d0', body: '#a8b890', arms: '#a8b890', legs: '#a8b890', belt: '#5a7a3a', robe: true }, 'Mirehaven'),
  grub: {
    name: 'Grub',
    look: { skin: '#c8a080', hair: '#3a2a1a', body: '#6a5a3a', arms: '#c8a080', legs: '#4a3a2a', belt: '#2a1a0a', hat: { style: 'bandana', color: '#4a6a3a' } },
    greet: 'Fish, potions, rope! What\'ll it be, $name? Let\'s {trade}.',
    keywords: { job: 'I sell and I buy. Mostly fish.' },
    trade: {
      sells: [['fish', 5], ['health_potion', 25], ['mana_potion', 50], ['rope', 50], ['fishing_rod', 120], ['spear', 8], ['leather_armor', 35], ['leather_boots', 15]],
      buys: ['loot', 'tools'],
    },
  },
  moss: captain('Skipper Moss', 'mirehaven', { skin: '#c8a080', hair: '#5a5a3a', beard: '#5a5a3a', body: '#3a4a3a', arms: '#c8a080', legs: '#2a2a2a', belt: '#5a3a1a' }, 'My barge knows every channel. And the sea.'),

  // ---- Port Verdant, in the Tazal jungle ---------------------------------------------
  vance: {
    name: 'Governor Vance',
    look: { skin: '#f0c8a0', hair: '#e8e8e8', body: '#e8e0d0', arms: '#e8e0d0', legs: '#3a3a5a', belt: '#c0a040', hat: { style: 'pointy', color: '#2a2a2a' } },
    greet: 'Ah, a capable sort! Welcome to Port Verdant, $name. I have a {mission} for you.',
    keywords: { 'ember|embers|seal': { quest: ['seal_7'] },
      'mission|quest|task|lizards|serpent': { quest: ['lizard_threat', 'serpent_hunt'] },
      temple: 'The lizards worship in an old temple, deep in the jungle east of town.',
      job: 'I govern this outpost, for what it is worth.',
    },
  },
  ivo: priest('Brother Ivo', { skin: '#c89060', hair: '#2a1a0a', body: '#8a6a4a', arms: '#8a6a4a', legs: '#8a6a4a', belt: '#e8dcc0', robe: true }, 'Port Verdant'),
  kiri: {
    name: 'Kiri',
    look: { skin: '#a87048', hair: '#1a1a1a', body: '#d85a2a', arms: '#a87048', legs: '#4a3a2a', belt: '#e0c040' },
    greet: 'Potions! Rope! Runes! You\'ll need them out there, $name. Let\'s {trade}.',
    keywords: { job: 'I sell what keeps you alive in the jungle.' },
    trade: {
      sells: [['health_potion', 25], ['mana_potion', 50], ['rope', 50], ['shovel', 50], ['apple', 3], ['bread', 5], ['blank_rune', 10], ['rune_heal', 40], ['bolt', 4], ['arrow', 3]],
      buys: ['loot', 'jewelry'],
    },
  },
  reyes: captain('Captain Reyes', 'verdant', { skin: '#c89060', hair: '#1a1a1a', beard: '#1a1a1a', body: '#8a2a2a', arms: '#c89060', legs: '#2a2a2a', belt: '#5a3a1a', hat: { style: 'bandana', color: '#2a2a2a' } }, 'I run the jungle route.'),

  // ---- Cinderhold, the volcano isle -----------------------------------------------
  kael: {
    name: 'Warden Kael',
    look: { skin: '#c89060', hair: '#2a2a2a', body: '#4a2a1a', arms: '#8a8a90', legs: '#3a2a1a', belt: '#c03020', hat: { style: 'helmet', color: '#5a5a60' }, held: 'sword' },
    greet: 'Few come here willingly, $name. I can {heal} you, and I have a {mission} for the very brave.',
    keywords: {
      heal: { heal: true },
      'mission|quest|task|demons': { quest: ['demon_slayer'] },
      'seal|ember|vharzul': { quest: ['seal_9'] },
      pit: 'At the foot of the volcano a cave leads down into the fire, and further down the demons wait.',
      job: 'I watch the volcano, so the demons stay below it.',
    },
  },
  brand: captain('Captain Brand', 'cinderhold', { skin: '#a87048', hair: '#3a3a3a', body: '#2a2a2a', arms: '#a87048', legs: '#2a2a2a', belt: '#c03020' }, 'Only a fool sails here. Here I am.'),

  // ---- the Glintvault Bank, east of Valoria, run by goblins -----------------------------
  vexlin: {
    name: 'Head Clerk Vexlin',
    look: { scale: 0.75, skin: '#a8b890', hair: '#4a4a4a', ears: true, eye: '#1a1a1a', body: '#2a2a3a', arms: '#2a2a3a', legs: '#2a2a3a', belt: '#d0a030' },
    greet: 'Glintvault Bank. State your business, $name: {deposit}, {withdraw}, {balance}... or a cart ride down to your {vault}.',
    keywords: {
      'deposit|withdraw|balance': { bank: true },
      'vault|vaults|cart|ride': { cart: { name: 'your vault', track: 'vault' } },
      'dragon|guard': 'The deepest vaults have a guard. A big one. With teeth.',
      job: 'I run the Glintvault Bank. Nothing leaves our vaults unless we say so.',
    },
  },
  snagg: {
    name: 'Teller Snagg',
    look: { scale: 0.72, skin: '#a0b088', hair: '#2a2a2a', ears: true, eye: '#1a1a1a', body: '#3a2a2a', arms: '#3a2a2a', legs: '#3a2a2a', belt: '#d0a030' },
    greet: 'Yes? {deposit}, {withdraw} or {balance}. Quickly now.',
    keywords: { 'deposit|withdraw|balance': { bank: true }, job: 'I count coins. Yours too, unfortunately.' },
  },
  krook: {
    name: 'Cart Master Krook',
    look: { scale: 0.75, skin: '#98a880', hair: '#5a5a5a', ears: true, eye: '#1a1a1a', body: '#5a4a3a', arms: '#5a4a3a', legs: '#3a3a3a', belt: '#8a6a3a' },
    greet: 'Your vault is through there, $name. When you are done, I take you back {up}.',
    keywords: { 'up|back|return|cart|ride': { cart: { name: 'the bank', track: 'vault', back: true } }, job: 'I drive the carts. Fast.' },
  },
  farmer: {
    name: 'Farmer',
    look: { skin: '#e8b890', hair: '#8a6a3a', body: '#8a6a3a', arms: '#e8b890', legs: '#4a5a8a', belt: '#5a3a1a', hat: { style: 'hood', color: '#d8c890' } },
    greet: 'Oh, a traveller! Fresh food for the road, $name? Let\'s {trade}. Or ask me for {news}.',
    keywords: {
      'news|rumours|rumors': 'They say every old chest in the wilds holds something - if you get there first. Camps have chiefs, too. Nasty ones.',
      job: 'I grow things. Mostly worries.',
    },
    trade: { sells: [['bread', 4], ['apple', 2], ['cheese', 3], ['meat', 7], ['fish', 5]], buys: ['loot'] },
  },
  vault_dragon: {
    name: 'the Vault Dragon', creature: 'dragon',
    greet: 'GRRRRAAAWR. (It looks at you, at its chain, and at you again.)',
    keywords: { job: 'GRRR. (It guards the deepest vaults.)' },
  },

  // ---- the islands' people: one of each, each with a story --------------------------
  ezra: {
    name: 'Ezra the Hermit',
    look: { skin: '#e0b088', hair: '#d8d8d8', beard: '#d8d8d8', hairStyle: 'long', body: '#6a5a3a', arms: '#6a5a3a', legs: '#4a3a2a', feet: '#3a2a1a', robe: true, trim: '#4a3a2a', belt: '#8a6a3a' },
    greet: 'Visitors. Wonderful. Terrible. Ask me about the {islands} if you must, or the {world}.',
    keywords: {
      islands: 'Every rock in this sea has its story. A dragon sits on one, a wizard ruined another, and somebody buried something where three stones point. Fly over them in a balloon and see.',
      world: 'Seven lands, joined by necks of earth, by bridges, and by older ways: stones that hum and doors that open elsewhere. Look for the obelisks.',
      job: 'I sit on this rock and think. Mostly about why I came here.',
    },
    chatter: ['Peace and quiet. Finally.', 'The gulls are the only ones who listen.'],
  },
  wren: {
    name: 'Wren the Castaway',
    look: { skin: '#e8b890', hair: '#a85a2a', hairStyle: 'ponytail', female: true, body: '#e0d8c0', arms: '#e0d8c0', legs: '#5a6a8a', feet: '#e8b890', belt: '#6a4422' },
    greet: 'A person! A real person! Tell me you have a {ship}... no? Then sit and hear about the {treasure}.',
    keywords: {
      ship: 'My ship broke on the reef weeks ago. I made a raft. The raft made a hole. A balloon would do, I suppose, if they let you take passengers.',
      treasure: 'Before the wreck, the captain spoke of an island where three stones point at the same patch of sand. Dig there, he said, if you have a shovel.',
      job: 'I count waves. I am up to four million.',
    },
    chatter: ['Ship ahoy! ...no. Just a wave.', 'Four million and one, four million and two...'],
  },
  hesk: {
    name: 'Old Hesk the Lamplighter', idle: 6000,
    look: { skin: '#d8a070', hair: '#e8e8e8', beard: '#e8e8e8', hairStyle: 'bald', body: '#2a3a5a', arms: '#2a3a5a', legs: '#2a2a3a', feet: '#1a1a1a', belt: '#d0a030', coat: true, buttons: '#e0b840' },
    greet: 'Mind the stairs, they bite. I keep the light so ships find the {way}.',
    keywords: {
      way: 'The reef to the west took a whole ship last year. The wreck is still there; nobody goes near it - the crew never left.',
      job: 'Forty years of keeping the light. Not one ship lost. Well. One. But it was foggy.',
    },
  },
  aurin: {
    name: 'Brother Aurin',
    look: { skin: '#e8c8a8', hair: '#8a6a3a', hairStyle: 'bald', body: '#7a5a3a', arms: '#7a5a3a', legs: '#7a5a3a', feet: '#4a3a2a', robe: true, trim: '#5a4028', belt: '#e8d8a0', hat: { style: 'hood', color: '#6a4a2a' } },
    greet: 'Peace be with you, traveller. Shall I {heal} you? Our garden is open to all.',
    keywords: {
      heal: { heal: true },
      job: 'We pray, we garden, we heal whoever the sea brings us.',
      'monastery|monks': 'There were twelve of us once. The others went to the mainland to teach. I stayed for the quiet.',
    },
    chatter: ['Peace.', 'The bees are busy today.'],
  },
  melli: {
    name: 'Melli the Beekeeper',
    look: { skin: '#f0c8a0', hair: '#e8c040', hairStyle: 'long', female: true, body: '#e8d070', arms: '#e8d070', legs: '#6a8a3a', feet: '#4a3a2a', belt: '#6a4422', robe: true, trim: '#6a8a3a', hat: { style: 'wide', color: '#d8c890', accent: '#f0f0e8' } },
    greet: 'Careful, you are standing on a bee. Just kidding. Want to {trade}? Fresh from the {hives}.',
    keywords: {
      hives: 'The bees came on a log, washed ashore. Now the island hums from dawn to dusk.',
      job: 'I keep bees. Or they keep me. It is not always clear.',
    },
    trade: { sells: [['apple', 2], ['bread', 4], ['cheese', 3]], buys: ['loot'] },
    chatter: ['Bzzz. Sorry, habit.', 'Mind the hives!'],
  },
  oakheart: {
    name: 'Old Oakheart',
    look: { skin: '#c8a878', hair: '#6a8a3a', beard: '#6a8a3a', hairStyle: 'long', ears: true, body: '#3a6a2a', arms: '#3a6a2a', legs: '#3a5a2a', feet: '#3a2a1a', robe: true, trim: '#6a4a2a', belt: '#8a6a3a', hat: { style: 'antlers', color: '#d8c4a0', accent: '#4a9a3a' } },
    greet: 'Hush. The tree is sleeping. It has been sleeping for {a thousand years}.',
    keywords: {
      'a thousand years|tree': 'It was a seed when the first ships came. When it wakes, they say, the sea will part. I think it just likes to sleep.',
      job: 'I listen to the tree. It says very little, very slowly.',
    },
  },
  quill: {
    name: 'Magister Quill',
    look: { skin: '#e8c8a8', hair: '#c0c0d0', beard: '#c0c0d0', hairStyle: 'long', body: '#4a2a7a', arms: '#4a2a7a', legs: '#4a2a7a', feet: '#2a2a2a', robe: true, trim: '#d0a030', belt: '#d0a030', hat: { style: 'pointy', color: '#3a1a6a', accent: '#d0a030' }, held: 'staff' },
    greet: 'Ah, a visitor who got past my {apprentices}. Impressive. Or they are asleep.',
    keywords: {
      apprentices: 'I taught them fire. They learned arson. I taught them to summon. They summoned each other. Now they lurk downstairs and I hide up here.',
      job: 'Wizard. Retired. Mostly from my own tower.',
      folly: 'They call this place my folly. I call it a learning experience. Mostly for the furniture.',
    },
  },
  gil: {
    name: 'Gil the Fisherman', idle: 6000,
    look: { skin: '#d8a070', hair: '#3a2a1a', beard: '#3a2a1a', body: '#4a6a3a', arms: '#4a6a3a', legs: '#3a3a4a', feet: '#2a2a2a', belt: '#6a4422', hat: { style: 'hood', color: '#c8b070' } },
    greet: 'Catch of the day, $name? Let\'s {trade}. Or ask about the {sea}.',
    keywords: {
      sea: 'Fish go where it is quiet. That is why I came here. Then the gulls followed. And now you.',
      job: 'Fishing. Mending nets. Complaining about the gulls.',
    },
    trade: { sells: [['fish', 4], ['bread', 4]], buys: ['loot'] },
  },
  farmer_tobben: {
    name: 'Tobben the Miller',
    look: { skin: '#e8b890', hair: '#c8a060', beard: '#c8a060', body: '#e8e0c8', arms: '#e8e0c8', legs: '#6a5a3a', feet: '#3a2a1a', belt: '#6a4422', hat: { style: 'feather', color: '#8a6a3a', accent: '#f0f0e8' } },
    greet: 'Welcome to Greenhollow, $name! Flour, bread, the finest {fields} on the sea. Want to {trade}?',
    keywords: {
      fields: 'The windmills grind for half the world. When the wind stops, so does Greenhollow. So pray for wind.',
      job: 'I mill. My father milled. His father had a very strong arm.',
    },
    trade: { sells: [['bread', 3], ['apple', 2], ['cheese', 3], ['meat', 6]], buys: ['loot'] },
  },
  watch_captain: {
    name: 'Watch Captain Sela',
    look: { skin: '#e0b088', hair: '#2a1a0a', hairStyle: 'ponytail', female: true, body: '#3a4a6a', arms: '#a8aeb8', armor: '#a8aeb8', tabard: '#3a4a6a', legs: '#3a3a42', feet: '#2a2a2a', belt: '#4a3a2a', hat: { style: 'helmet', color: '#a8aeb8' }, held: 'sword' },
    greet: 'Halt. This is the Seawall, the first watch against what comes from the {west}.',
    keywords: {
      west: 'Nothing has come from the west in a hundred years. We watch anyway. That is what a watch is for.',
      job: 'I keep the towers manned. Well, one tower. Well, me.',
    },
  },
  ruin_ghost: {
    name: 'King Aldric\'s Shade', look: { skin: '#c8d8e8', hair: '#e8f0f8', beard: '#e8f0f8', body: '#a8b8c8', arms: '#a8b8c8', legs: '#a8b8c8', feet: '#a8b8c8', robe: true, trim: '#d0d8e0', belt: '#d0d8e0', hat: { style: 'crown', color: '#d0d8e0' } },
    greet: 'You walk among the stones of my {kingdom}, living one.',
    keywords: {
      kingdom: 'These isles were one land once, and mine. The sea took it in a single night. My knights still stand guard - what is left of them.',
      job: 'I was a king. Now I am a draught.',
    },
  },

  // ---- townsfolk: people (and animals) out on the streets -------------------------
  // wander: how far from home they stroll; indoors: they stay under a roof;
  // idle: how long they may stand around (ms); chatter: what they say now and then.
  guard: {
    name: 'Town Guard', wander: 7, idle: 2500,
    look: { skin: '#e0b088', hair: '#5a3a1a', body: '#8a2a2a', arms: '#a8aeb8', armor: '#a8aeb8', tabard: '#8a2a2a', legs: '#4a4a52', feet: '#2a2a2a', belt: '#3a2a1a', hat: { style: 'helmet', color: '#a8aeb8' }, held: 'sword' },
    greet: 'Keep the peace, $name. Need {directions}? Or are you here about the {dangers}?',
    keywords: {
      job: 'I walk the streets and keep the riff-raff out. Monsters too, mostly.',
      'directions|temple|depot': 'The temple is north of the square; your depot is inside. The shops are along the main streets, and the pier is never far from the water.',
      'dangers|monsters|news': 'Stay on the roads. Wherever there are tents in the wilds, there is a camp - and every camp has a chief.',
    },
    chatter: ['Move along.', 'All quiet. Too quiet.', 'Someone stole my lunch again.', 'No running in the square!', 'Mind the cobbles, they are slippery.', 'The night watch never sleeps. Well, rarely.'],
  },
  townsman: {
    name: 'Townsman', wander: 6,
    look: { skin: '#e8b890', hair: '#3a2a1a', hairStyle: 'short', body: '#5a7a3a', collar: '#e8e0c8', arms: '#5a7a3a', legs: '#5a4a3a', feet: '#3a2a1a', belt: '#3a2a1a' },
    greet: 'Good day, $name! Lovely weather for {adventure}, is it not?',
    keywords: {
      job: 'Oh, a bit of this, a bit of that. Mostly that.',
      'adventure|news|rumours|rumors': { rumours: [
        'My cousin swears the hermit out on Hermit Rock talks to the bears. And that the bears talk back. He has stopped drinking since.',
        RUMOURS.eagle, RUMOURS.tower, RUMOURS.chapel,
      ] },
    },
    chatter: ['Morning!', 'Have you seen the prices at the market?', 'My back is killing me.', 'Fine day, fine day.', 'I could have been an adventurer, you know.', 'Where did I leave my keys?'],
  },
  townswoman: {
    name: 'Townswoman', wander: 6,
    look: { skin: '#f0c8a0', hair: '#8a4a2a', hairStyle: 'long', female: true, body: '#7a3a6a', arms: '#7a3a6a', legs: '#4a3a5a', feet: '#3a2a1a', belt: '#e8d8b0', robe: true, trim: '#e8d8b0' },
    greet: 'Oh, hello there, $name. Are you new in {town}?',
    keywords: {
      job: 'I keep house, and an eye on the neighbours. Somebody has to.',
      'town|news|rumours|rumors': { rumours: [
        'They say old Wim went down the town well for a bet, years and years ago, and never came up. On still nights my mother says you can hear him whistling down there. Nobody has been down with a rope to look.',
        RUMOURS.lighthouse,
      ] },
    },
    chatter: ['Such a nice day for washing.', 'Have you heard the latest?', 'Children! Supper!', 'The baker burnt the bread again.', 'Those adventurers track mud everywhere.'],
  },
  child: {
    name: 'Child', wander: 5, idle: 1200,
    look: { scale: 0.72, skin: '#f0c8a0', hair: '#c88a3a', hairStyle: 'short', body: '#3a6ab0', arms: '#3a6ab0', legs: '#5a4a3a', feet: '#3a2a1a', belt: '#3a2a1a' },
    greet: 'Are you a real adventurer? Have you killed a {dragon}?',
    keywords: {
      dragon: 'Wooow. When I grow up I am going to fight a hundred dragons. Or maybe be a baker.',
      'rumours|rumors|secret|goblins': 'I know a secret! The goblins on Goblin Hill dig holes like rabbits, and their holes go right under the hill. My friend saw one on the east side. He ran away. I would not have run away.',
      job: 'I am six! Six does not have a job.',
    },
    chatter: ['Tag! You are it!', 'Catch me if you can!', 'I am a fearsome knight! Rawr!', 'Mum says adventurers smell funny.', 'I found a shiny stone!', 'Can I hold your sword?'],
  },
  girl: {
    name: 'Little Girl', wander: 5, idle: 1200,
    look: { scale: 0.72, skin: '#f0c8a0', hair: '#e0c060', hairStyle: 'braids', female: true, body: '#c04a6a', arms: '#c04a6a', legs: '#c04a6a', feet: '#3a2a1a', belt: '#f4f0e8', skirt: '#c04a6a' },
    greet: 'Hello! I have a {cat}. Well, the cat has me.',
    keywords: { cat: 'She is called Princess Fluffington the Third. She hates everyone. I love her.', job: 'I chase the chickens. They never learn.' },
    chatter: ['Here, kitty kitty!', 'La la la...', 'One, two, three... ready or not!', 'I am the queen of the square!'],
  },
  old_man: {
    name: 'Old Man', idle: 8000,
    look: { skin: '#e8c0a0', hair: '#e8e8e8', beard: '#e8e8e8', hairStyle: 'bald', body: '#5a5a6a', arms: '#5a5a6a', legs: '#4a4a52', feet: '#2a2a2a', belt: '#3a2a1a', coat: true },
    greet: 'Eh? Speak up, youngster! Do you want to hear a {story}?',
    keywords: {
      story: 'In my day there was no bridge to the academy. We waded the Willow! Both ways! And the rats in the sewers were the size of sheep.',
      'rumours|rumors|news|tower|watch|watchman': 'Rumours? I knew the last watch of the Old Tower, youngster! Oswin, Marrow and Tobin. Always in the same order up the stair, those three, like ducks. They lie in the graveyard now, side by side, and the tower lies in ruins. Tobin swore nobody would get into his cellar while he had a say in it.',
      job: 'I sit. I have earned it.',
    },
    chatter: ['In my day...', 'Kids these days.', 'My knee says rain is coming.', 'Zzz... eh? I was not sleeping!', 'I once punched a troll. Well, near a troll.'],
  },
  crier: {
    name: 'Town Crier', wander: 3, idle: 4000,
    look: { skin: '#e8b890', hair: '#5a3a1a', body: '#2a4a8a', arms: '#2a4a8a', legs: '#e8e0c8', feet: '#2a2a2a', belt: '#d0a030', collar: '#f4f0e8', buttons: '#e0b840', hat: { style: 'wide', color: '#2a4a8a', accent: '#f4f0e8' } },
    greet: 'Hear ye, $name! Ask me for the {news}!',
    keywords: {
      news: 'The Glintvault Bank in Valoria takes you down to your vault by mine cart. Dragons under the cyclops mountain. Frost dragons in the Frost Reach. And somewhere in Greymoor, a house elf wants a sock. Oh - and they say old Grandmaster Orin in Valoria is looking for heroes. Something about a {seal}.',
      'seal|ember': 'Ask Grandmaster Orin, in the temple of Valoria. He won\'t stop talking about it.',
      job: 'I cry the news. Loudly. For a living.',
    },
    chatter: [
      'Hear ye! Ships sail daily from every harbour!',
      'Hear ye! Cabs and balloons take you to any place you have seen - order one from the world map!',
      'Hear ye! Dragons sighted beneath the cyclops mountain! Bring potions!',
      'Hear ye! The Glintvault Bank: what is yours is safe. Mostly.',
      'Hear ye! A reward for anyone who finds the Sand King. Or rather, for anyone who comes back.',
      'Hear ye! Lost: one goblin. Answers to "oi".',
    ],
  },
  bard: {
    name: 'Bard', wander: 2, idle: 5000,
    look: { skin: '#f0c8a0', hair: '#a85a2a', hairStyle: 'long', body: '#2a7a6a', arms: '#2a7a6a', legs: '#6a2a5a', feet: '#3a2a1a', belt: '#d0a030', collar: '#f0d050', hat: { style: 'feather', color: '#6a2a5a', accent: '#f0d050' } },
    greet: 'A traveller! Shall I sing you a {song}?',
    keywords: {
      song: 'Oh, the knight went down to the dragon\'s lair, with a shield of oak and a head of air... the rest is mostly screaming.',
      job: 'I sing for coins. Sometimes they throw them hard.',
      'sword|captain|varrow|brightwater|legend': 'Ah, the ballad of Captain Varrow\'s sword! Everyone on Brightwater looks for it, nobody finds it, and then they choose a vocation and the island is behind them forever. It is a very short ballad.',
    },
    chatter: ['La la laaa!', 'Oh, the rats of Brightwater, so many and so bold...', 'A copper for a song?', 'Tra la la, tra la lee!', 'Who wants a ballad about a very brave squirrel?'],
  },
  vendor: {
    name: 'Market Trader', idle: 6000,
    look: { skin: '#e8b890', hair: '#3a2a1a', beard: '#3a2a1a', body: '#a85a2a', arms: '#a85a2a', legs: '#4a3a2a', feet: '#2a2a2a', belt: '#3a2a1a', tabard: '#e8e0c8' },
    greet: 'Fresh food, fresh fish, fresh everything! Want to {trade}, $name?',
    keywords: { job: 'Best prices on the square. Ask anyone. Except the other traders.' },
    trade: { sells: [['apple', 2], ['bread', 4], ['cheese', 3], ['fish', 5], ['meat', 7]], buys: ['loot'] },
    chatter: ['Apples! Crisp apples!', 'Fresh fish, caught this morning!', 'Bread, still warm!', 'Two for one! Well, one for one. But cheap!'],
  },
  innkeeper: {
    name: 'Innkeeper', idle: 6000,
    look: { skin: '#e8b890', hair: '#6a4a2a', hairStyle: 'bald', beard: '#6a4a2a', body: '#e8e0c8', arms: '#e8e0c8', legs: '#4a3a2a', feet: '#2a2a2a', belt: '#5a3a1a', tabard: '#f4f0e8' },
    greet: 'Welcome to my inn, $name! Something to eat? Let\'s {trade}. Or are you after {rumours}?',
    keywords: {
      'rumours|rumors|news': 'Travellers talk. Old chests lie in the wild ruins, towers and caves - first come, first served. And the camps all have a chief, nasty ones, with better loot.',
      job: 'I feed the hungry and listen to the boastful.',
    },
    trade: { sells: [['bread', 4], ['cheese', 3], ['meat', 7], ['fish', 5], ['apple', 2], ['health_potion', 45]], buys: ['loot'] },
    chatter: ['Who wants another round?', 'Mind the stew, it bites.', 'No fighting in my inn!'],
  },
  guest: {
    name: 'Tavern Guest', wander: 2, indoors: true, idle: 5000,
    look: { skin: '#e0b088', hair: '#2a1a0a', beard: '#2a1a0a', body: '#6a5a3a', arms: '#6a5a3a', legs: '#3a3a3a', feet: '#2a2a2a', belt: '#3a2a1a' },
    greet: 'Hic! Sit down, sit down! Have you heard about the {treasure}?',
    keywords: { treasure: 'There is a chest on top of the cyclops mountain. Or under it. Or next to it. Definitely near it.', job: 'Professional sitter.' },
    chatter: ['Another one!', 'I could take a dragon. A small one.', 'Hic!', 'This is the best inn in the world. Or the only one I remember.'],
  },
  fisher: {
    name: 'Fisherman', idle: 7000,
    look: { skin: '#d8a070', hair: '#6a6a6a', beard: '#6a6a6a', body: '#3a5a7a', arms: '#3a5a7a', legs: '#4a4a3a', feet: '#2a2a2a', belt: '#5a3a1a', hat: { style: 'hood', color: '#d8c070' } },
    greet: 'Ahoy, $name. Fish? Let\'s {trade}.',
    keywords: { job: 'I fish. The fish disagree.', 'sea|ship|ships': 'The captains on the pier sail you to the other harbours, for a fee.' },
    trade: { sells: [['fish', 4]], buys: ['loot'] },
    chatter: ['Biting today, they are.', 'Smell that sea air.', 'This one was THIS big!'],
  },
  cat: { name: 'Cat', creature: 'cat', wander: 4, idle: 4000, greet: 'Mrrrow? (It looks at you, unimpressed.)', keywords: {}, chatter: ['Mrrrow.', 'Purrr...', 'Mew!'] },
  dog: { name: 'Dog', creature: 'dog', wander: 6, idle: 1800, greet: 'Woof! (It wags its tail.)', keywords: {}, chatter: ['Woof!', 'Arf arf!', '*sniffs around*'] },
  chicken: { name: 'Chicken', creature: 'chicken', wander: 3, idle: 1500, greet: 'Bok? (It pecks at your boot.)', keywords: {}, chatter: ['Bok bok.', 'Bkaw!', 'Bok?'] },

  // ...with a name, a home town and something to say about it
  bertram: {
    name: 'Crier Bertram', wander: 4, idle: 3500,
    look: { skin: '#e8b890', hair: '#8a6a3a', body: '#8a2a2a', arms: '#8a2a2a', legs: '#e8e0c8', feet: '#2a2a2a', belt: '#d0a030', collar: '#f4f0e8', buttons: '#e0b840', hat: { style: 'wide', color: '#8a2a2a', accent: '#f0d050' } },
    greet: 'Hear ye, hear ye, $name! Want the {news} of Valoria?',
    keywords: {
      news: 'The Glintvault goblins have a new cart! The orcs to the north-east have a new chief! And Captain Rhea has a new hat! Huge news, all of it.',
      job: 'Town crier of Valoria. The loudest man in the realm, three years running.',
    },
    chatter: ['Hear ye! The bank is east of the square, past the goblin with the frown!', 'Hear ye! Orcs in the north-east! Bandits in the south!', 'Hear ye! Captain Rhea sails to Ashport from the western pier!', 'Hear ye! The mage tower east of town is NOT open for visitors!'],
  },
  lysa: {
    name: 'Lysa the Flower Girl', wander: 4,
    look: { skin: '#f0c8a0', hair: '#e8c040', hairStyle: 'braids', female: true, body: '#e8e0c8', arms: '#e8e0c8', legs: '#5a8a3a', feet: '#3a2a1a', belt: '#5a8a3a', skirt: '#5a8a3a', collar: '#f0a0b0' },
    greet: 'Flowers, $name? They are free to smell. Ask me about the {garden}.',
    keywords: { garden: 'I grow them behind the temple. Do not tell the priestess, she thinks they grow by themselves.', job: 'I sell flowers. Adventurers never buy any. You smell like you should.' },
    chatter: ['Flowers! Fresh flowers!', 'A rose for your sweetheart?', 'Roses are red, goblins are green...'],
  },
  nella: {
    name: 'Nella the Fishwife', wander: 4,
    look: { skin: '#e8b890', hair: '#a85a2a', hairStyle: 'long', female: true, body: '#3a6a8a', arms: '#3a6a8a', legs: '#3a3a4a', feet: '#2a2a2a', belt: '#e8e0c8', robe: true, trim: '#e8e0c8' },
    greet: 'Ah, a newcomer! The rats in the {cellar} will keep you busy, love.',
    keywords: { cellar: 'Below the square, the south-east corner. Elder Maren pays well for every rat. Well. She pays.', job: 'I sell the fish my husband catches. When he catches any.' },
    chatter: ['Fresh fish!', 'Watch your step, love.', 'That husband of mine...', 'My gran says the drowned captain walks the southern cape at first light. My gran says a lot of things.'],
  },
  salty: {
    name: 'Old Salty', idle: 6000,
    look: { skin: '#c89060', hair: '#d8d8d8', beard: '#d8d8d8', hairStyle: 'bald', body: '#f0ece0', arms: '#f0ece0', stripes: '#2a4a8a', legs: '#2a2a3a', feet: '#2a2a2a', belt: '#5a3a1a', hat: { style: 'tricorn', color: '#2a2422', accent: '#e0b840' } },
    greet: 'Arr, sit a while, $name. Want to hear about the {drowned} king?',
    keywords: { drowned: 'Down in the caves below the ruin he waits, the Drowned King, with his treasure. Bring a bronze key and a good reason.', job: 'I was a pirate. Now I am a retired pirate. The hours are better.' },
    chatter: ['Arr.', 'The sea gives, and the sea takes.', 'I had a parrot once. It knew too much.'],
  },
  torunn: {
    name: 'Torunn the Woodcutter', wander: 6,
    look: { skin: '#f0c8a0', hair: '#d8a040', hairStyle: 'braids', female: true, body: '#8a2a2a', arms: '#8a2a2a', legs: '#4a3a2a', feet: '#3a2a1a', belt: '#3a2a1a', fur: true, held: 'axe' },
    greet: 'Cold enough for you, $name? Stay clear of the {yeti}.',
    keywords: { yeti: 'They live up on the peaks, north-east. Big, white and not friendly. The frost dragons below are worse.', job: 'I cut wood. Frosthold burns a lot of it.' },
    chatter: ['Brr.', 'Another log for the fire.', 'The winters get longer every year.'],
  },
  elandra: {
    name: 'Elandra', wander: 5,
    look: { skin: '#f4dcc0', hair: '#f0f0e0', hairStyle: 'long', female: true, ears: true, body: '#4a8a5a', arms: '#4a8a5a', legs: '#4a8a5a', feet: '#3a5a2a', belt: '#d0c060', robe: true, trim: '#d0c060' },
    greet: 'Be welcome under the leaves, $name. Walk softly near the {Shadowglen}.',
    keywords: { shadowglen: 'South of here the forest grows dark, and the giant spiders spin their webs. Even we do not go there.', job: 'I tend the trees. They tend me.' },
    chatter: ['The trees are whispering today.', 'Mind the flowers, please.', 'Such a lovely morning.'],
  },
  zahir: {
    name: 'Zahir the Spice Seller', wander: 3, idle: 4000,
    look: { skin: '#b07850', hair: '#1a1a1a', beard: '#1a1a1a', body: '#c89030', arms: '#c89030', legs: '#e8dcc0', feet: '#5a3a1a', belt: '#8a2a2a', robe: true, trim: '#8a2a2a', hat: { style: 'hood', color: '#e8dcc0' } },
    greet: 'Peace upon you, $name! Spices from all over the Sunreach. And {stories}, if you buy nothing.',
    keywords: { stories: 'The Sand King sleeps in his pyramid to the south-east. Those who wake him do not come back to complain.', job: 'I sell spices. And sand. Mostly sand.' },
    chatter: ['Saffron! Cinnamon! Finest pepper!', 'Shade is free, my friend.', 'A bargain, a bargain!'],
  },
  bogsby: {
    name: 'Bogsby the Frog Catcher', wander: 5,
    look: { skin: '#d8b890', hair: '#5a6a3a', body: '#5a6a3a', arms: '#5a6a3a', legs: '#3a4a2a', feet: '#3a3a2a', belt: '#3a2a1a', hat: { style: 'hood', color: '#4a5a2a' } },
    greet: 'Shh! You will scare the {frogs}, $name.',
    keywords: { frogs: 'The fat ones are in the pools south of here. The witches to the west eat them. Well. Use them.', job: 'I catch frogs. Do not ask what for.' },
    chatter: ['Ribbit. No, that was me.', 'Shh!', 'Got one! No. Lost it.'],
  },
  tico: {
    name: 'Tico the Parrot Man', wander: 4,
    look: { skin: '#b07850', hair: '#1a1a1a', body: '#e85a3a', arms: '#e85a3a', legs: '#e8dcc0', feet: '#5a3a1a', belt: '#3a8a3a', vest: '#3a8a3a', hat: { style: 'feather', color: '#3a8a3a', accent: '#e8c030' } },
    greet: 'Hola, $name! My parrot knows the way to the {temple}. Probably.',
    keywords: { temple: 'East through the jungle stands the lizards\' temple. Their priest has a serpent for a boss. Squawk. That was the parrot.', job: 'I sell parrots. They talk back.' },
    chatter: ['Squawk! Pretty bird!', 'Parrots! Talking parrots!', 'He said WHAT?'],
  },
  dwarf: {
    name: 'Dwarf Miner', wander: 6, indoors: true,
    look: { scale: 0.82, skin: '#e0a878', hair: '#8a3a1a', beard: '#8a3a1a', body: '#5a5a62', arms: '#5a5a62', legs: '#3a3a42', feet: '#2a2a2a', belt: '#8a6a3a', hat: { style: 'helmet', color: '#c0a040' }, held: 'axe' },
    greet: 'Mind your head, tall one. Down here we dig, we {drink} and we dig some more.',
    keywords: { drink: 'Ale, mostly. The golems in the east mines do not drink. That is why they are so grumpy.', job: 'Mining. What else is there?' },
    chatter: ['Dig, dig, dig.', 'Stone and steel!', 'Where is my pick?', 'Too much sky up there.'],
  },
};

// A guard at one of Oakvale's gates: the quest he gives (word: the plainest word for it), where his gate leads,
// and his rank.
function gateGuard(quest, name, hair, word, gate, captain) {
  return {
    name, wander: 2, idle: 3000,
    look: { skin: '#e0b088', hair, body: '#8a2a2a', arms: '#a8aeb8', armor: '#a8aeb8', tabard: captain ? '#2a4a8a' : '#8a2a2a', legs: '#4a4a52', feet: '#2a2a2a', belt: '#3a2a1a', hat: { style: 'helmet', color: captain ? '#d0b040' : '#a8aeb8' }, held: 'sword' },
    greet: `Halt, $name. ${captain ? 'Captain' : 'Guard'} of this gate. Need {directions}, or are you here about the {dangers}?`,
    keywords: {
      [`${word}|task|quest|mission|help|hunt|work`]: { quest: [quest, `task_${quest.slice(5)}`] }, // (the gate's task; done, a hunt again and again)
      job: 'I keep this gate, and what comes through it.',
      'directions|gate|road': gate,
      'dangers|monsters|news': 'The Host\'s stragglers roam the isle: rats in the fields, wolves and slimes beyond, then spiders and goblins. Bears in the deep woods. The further from the wall, the worse it gets. Know when to run.',
    },
    chatter: ['Quiet. Too quiet.', 'Keep your weapon ready out there.', 'Wolves again last night.', 'Eyes on the dark.'],
  };
}

// ---- Oakvale Isle: the people of the starter town, and its beginner story --------------------------
// "The Last Town": the Hollow Host, an army of monsters, has swallowed every town and kingdom; Oakvale is the last
// one standing, most of its fighters lie dead beyond the wall, and outside it is death for anyone untrained.
//   The Last Town (level 1)  a newcomer asks to fight and is turned away, then the Host attacks the north wall: you
//                            load its cannons, save a frightened kitten (Clang, your companion from then on) and
//                            fire them (the siege only you see: game-siege.js)
//   The Recruit (level 1)    Master Corwin trains you: the dummy, a cap, Farmer Ned's rats in the sewers (his torch),
//                            trading with Pip, a locker with Hobb, and a shield
//   (the gate watch, level 2-5, sends you out beyond the wall: see below)
//   Farewell (level 10)      ring the bell, say farewell, and the oracle names your path to the front
Object.assign(QUESTS, {
  last_town: {
    name: 'The Last Town', story: 'The Last Town', giver: 'ama', level: 1, word: 'fight',
    reward: { xp: 60, gold: 20 },
    summary: 'The Hollow Host has swallowed the world, and Oakvale is the last town standing. You want to fight.',
    steps: [
      { npc: 'gate_north', word: 'fight', scene: 'siege', summary: 'Ask Captain Osric, at the north gate, to let you fight.',
        progress: 'Captain Osric keeps the north gate: up the high street, north of the square.',
        done: 'You? No armour, no training, not even a proper weapon. I have buried better fighters than you this month. Go back to the temple, where it is... *A horn blows on the wall. Then another, and another.* No. Not now. They are at the walls! The gunners on the north wall are down. You wanted to fight? Then up the north-west tower, to the wall, and load the {cannons}: four of them. GO!' },
      { load: 4, auto: true, summary: 'Up the north-west tower to the wall: load four cannons on the north wall (use each one).',
        progress: 'The north-west tower stands in the corner of the wall, west of the north gate: its stairs take you up. Cannons loaded: $progress.',
        done: 'You ram the last ball home. Then, under the roar of the Host, a tiny frightened mew: from behind the powder kegs on the wall.' },
      { thing: 'powder_kegs', pet: { name: 'Clang', kind: 'cat' }, summary: 'Something is mewing behind the powder kegs on the north wall. Find it.',
        progress: 'Behind the powder kegs on the north wall, something mews.',
        done: 'A grey kitten with a little bell on his collar, shaking all over. The temple cat, Clang, lost on the wall! You tuck him into your coat, and he hides his face. He will not leave your side now.' },
      { fire: true, summary: 'Light the fuse at a loaded cannon on the north wall, and fire!',
        progress: 'The cannons are loaded. Light the fuse at one of them!',
        done: 'FIRE! One after the other the cannons roar along the wall. Smoke rolls over the battlements, and when it clears, the Host is running for the dark.' },
      { npc: 'gate_north', word: 'fight', summary: 'Go back down to Captain Osric at the north gate.',
        progress: 'Captain Osric waits at the north gate.',
        done: 'I saw it from the gate. Untrained, unarmed, and you held the north wall. I was wrong about you, $name. Go to Master Corwin at the academy, south of the square, and tell him I sent you: he will make a {fighter} of you.' },
    ],
    text: {
      offer: 'You are awake, thank the Dawn. You have heard what has happened? The {Hollow Host} has swallowed every town and kingdom we knew. Oakvale is the last town standing, and most of our fighters lie dead beyond the wall. Outside it is death for anyone untrained. Stay here, where it is safe... You want to fight? Then I cannot stop you. Captain Osric at the north gate decides who goes on the wall. Will you go to him? ({yes}/{no})',
      accept: 'Then go with the Dawn, $name. Down the temple steps, and north up the high street to the north gate.',
      elsewhere: 'Sister Ama in the temple looks after everyone who comes to Oakvale. Go to her first.',
      done: 'They still talk about the newcomer who fired the north wall. Master Corwin is training you, I hear.',
    },
  },
  recruit: {
    name: 'The Recruit', story: 'The Last Town', giver: 'corwin', level: 1, word: 'fighter', after: 'last_town',
    reward: { xp: 150, gold: 30, items: [['wooden_shield', 1], ['backpack', 1], ['rope', 1]] }, // a backpack: 20 places instead of the bag's 8
    summary: 'Master Corwin turns you into a fighter: skills, a real fight, trading and the depot.',
    steps: [
      { npc: 'corwin', train: 10, where: [145, 138, 8, 4], summary: 'Hit a training dummy in the yard, east of the academy, 10 times; then tell Master Corwin.',
        progress: 'Ten good hits on a dummy in the training yard, east of here. Then come back to me.',
        give: [['leather_cap', 1]],
        done: 'Feel that? Every hit trains your skill: club, sword, axe, or distance with a bow. The more you use a weapon, the harder you hit with it. Here, put this cap on: it is not much, but every bit counts. Now a real fight: Farmer Ned\'s grain is overrun by rats from the sewers. Go to him at the hay barn, at the end of the academy lane, and ask about the {rats}.' },
      { npc: 'oak_farmer', word: 'rats', summary: 'Ask Farmer Ned at the hay barn, at the end of the academy lane, about his rats.',
        progress: 'Farmer Ned is at the hay barn, at the end of the academy lane.', give: [['farm_torch', 1]],
        done: 'Corwin sent you? Bless him. They come up out of the sewers under my barn. Take my torch: it is black as pitch down there. Use it, and it lights your way. Down the grate on the square, kill five, and come back.' },
      { npc: 'oak_farmer', kill: { rat: 5 }, where: [110, 130, 7, 7], summary: 'Down a grate into the sewers: light Ned\'s torch, kill 5 rats, and tell Farmer Ned.',
        progress: 'Five rats, down in the sewers: $progress.',
        done: 'Five! My grain is safe for a while. Whatever they had on them, Pip buys: his shop is east of the square. Go and see him about {supplies}.' },
      { npc: 'pip', word: 'supplies', ready: () => !!player.chests.guide_bought && (!!player.chests.guide_sold || !bagItems().some(it => ITEMS[it.id] && BUYS.loot(ITEMS[it.id]))),
        summary: 'Trade with Pip, east of the square: sell what you found and buy something you need, then tell him.',
        progress: 'Go on, {trade}! Sell me what you found, and buy something you need: a potion is never wasted. Then tell me about the {supplies} again.',
        done: 'A proper customer! Now, what you cannot carry, leave with Postmaster Hobb at the depot, by the canal south of the square. Ask him about your {locker}.' },
      { npc: 'postmaster', word: 'locker', ready: () => !!(player.depot && player.depot.contents.length),
        summary: 'Put something in a locker at the depot, by the canal south of the square, and tell Postmaster Hobb.',
        progress: 'Open any locker here and it is yours. Put something in it, then tell me about your {locker} again.',
        done: 'There. Whatever happens to you out there, what lies in your locker stays safe. Master Corwin will want to hear that you are ready.' },
      { npc: 'corwin', word: 'fighter', summary: 'Go back to Master Corwin at the academy.', progress: 'Master Corwin waits at the academy.',
        done: 'A fight, a trade and a locker: you are ready for the gates. Take this shield, and this backpack. Remember: the Host does not tire, but you can rest. The gate guards need everyone they can get: start with Sergeant Bram at the west gate.' },
    ],
    text: {
      offer: 'Osric sent you? Then you are the one who fired the north wall. Bravery is a start, $name, but the Host does not die of bravery. Will you train with me? ({yes}/{no})',
      accept: 'Good. The training yard is east of the academy: hit a dummy there, ten good hits, and come back to me.',
      tooWeak: 'Come back when you are stronger.',
      notYet: 'Training? The north wall needs every pair of hands first. Sister Ama in the temple will tell you.',
      elsewhere: 'Master Corwin at the academy trains the recruits.',
      done: 'Train every day, $name. The gate guards have work for you.',
    },
  },
  // (Kestrel Isle's preview: world-kestrel.js) Clang, the temple's cat, chased the rats down into the bell cellar and got stuck: get him back, and he's yours
  // (a companion that fights at your side and grows: PETS in creatures.js, updatePet in game-update.js)
  clang_rescue: {
    name: 'Clang and the Clapper', giver: 'ama', level: 2, word: 'clang',
    reward: { xp: 150, gold: 60, items: [['health_potion', 3]], pet: { name: 'Clang', kind: 'cat' } },
    summary: 'Find Clang, the temple cat, in the bell cellar under the temple, and bring him home - and the bell\'s clapper with him.',
    steps: [
      { auto: true, kill: { rat: 3 }, where: [140, 104, 7, 6], summary: 'Down the grate on the square and north under it to the bell cellar, below the temple: kill 3 rats there.',
        progress: 'The bell cellar lies at the north end of the sewers, under the temple. Rats killed: $progress.',
        done: 'The rats scatter. From behind a fallen crate at the far end of the cellar comes a small, offended mew.' },
      { thing: 'clang_crate', summary: 'Move the fallen crate at the east end of the bell cellar and free Clang.',
        progress: 'Clang is behind the fallen crate at the east end of the bell cellar.',
        done: 'You heave the crate aside. A grey cat with a bell on his collar shoots out, looks at you, and decides you will do. Clang! And where he was curled up, something heavy and bronze: the bell\'s clapper. The rats dragged it down here, and Clang has been guarding it.' },
      { npc: 'ama', word: 'clang', summary: 'Bring Clang, and the bell\'s clapper, back to Sister Ama in the temple.',
        progress: 'Sister Ama waits in the temple.',
        done: 'Clang! You silly thing - and our clapper with you! So that is where it went. Help me hang it again... There. Listen! The bell of Oakvale rings again. And Clang has not left your side, has he, $name? Then he has chosen. Keep him: he is braver than he looks, and he will grow braver still at your side.' },
    ],
    text: {
      offer: 'Our cat, Clang, has not come home since the bell went quiet. I hear him at night, under the floor: he must have chased the rats down into the bell cellar - and I think he knows where our clapper went. Would you bring him back? ({yes}/{no})',
      accept: 'Bless you. Go down the grate on the square, and north under it: the bell cellar is right below us. Take a light.',
      tooWeak: 'The cellar is dark and full of rats, $name. Come back at level 2, with a light.',
      elsewhere: 'Sister Ama in the temple is waiting for her cat.',
      done: 'Clang looks well, and the bell rings every dawn. You are good for each other.',
    },
  },
  // Farewell: level 10, the end of your newcomer days: ring the bell yourself, and the town cheers, before the oracle
  // names your path to the front (no ship has come yet: you stay, as Oakvale's own)
  bell_6: {
    name: 'Farewell', story: 'The Last Town', giver: 'ama', level: 10, word: 'farewell', after: 'recruit',
    reward: { xp: 500, gold: 200, items: [['health_potion', 5], ['mana_potion', 5]] },
    summary: 'Before the oracle names your path, ring the bell of Oakvale yourself, and say farewell to those who made a fighter of you.',
    steps: [
      { thing: 'bell', summary: 'Climb the bell tower, east of the temple, and ring the bell of Oakvale yourself.',
        progress: 'The bell tower stands east of the temple. Climb to the top and ring the bell.',
        done: 'You ring the bell, and the last town stops to listen. Down in the streets, people look up at the tower, and wave.' },
      { npc: 'corwin', word: 'farewell', summary: 'Say farewell to Master Corwin at the academy.',
        progress: 'Master Corwin is at the academy.',
        done: 'The recruit who fired the north wall, a fighter now. I taught you to hold a weapon; the rest you did yourself. Go well to the oracle, $name, and come back from the front.' },
      { npc: 'pip', word: 'farewell', summary: 'Say farewell to Pip at Pip\'s Provisions.',
        progress: 'Pip\'s Provisions is east of the square.',
        done: 'Off to the oracle? Then take a tip from your first shopkeeper: never leave town without a rope. Or a shovel. Or both! You were my best customer, $name. Come back in one piece!' },
      { npc: 'gate_north', word: 'farewell', summary: 'Say farewell to Captain Osric at the north gate.',
        progress: 'Captain Osric keeps the north gate.',
        done: 'At ease, $name. I turned you away once, and the same night you held my wall. I have not made that mistake since. When the oracle has named your path, the front will be glad of you. Salute! Now go and see Sister Ama.' },
      { npc: 'ama', word: 'farewell', summary: 'Go back to Sister Ama in the temple.',
        progress: 'Sister Ama waits in the temple.' },
    ],
    text: {
      offer: 'You have grown, $name. Level ten: the oracle upstairs in the academy will name your path, and you will be a recruit no more. Before you go to her, will you ring our bell yourself, and say farewell to those who made a fighter of you? ({yes}/{no})',
      accept: 'Climb the bell tower and ring it yourself. Then go round: Master Corwin, Pip, Captain Osric. And come back to me last.',
      tooWeak: 'It is not time to say goodbye yet, $name. Come back at level 10.',
      notYet: 'Master Corwin has not finished with you yet.',
      elsewhere: 'Sister Ama in the temple wants to say farewell.',
      reward: 'Then this is farewell to the recruit. You woke in this temple with nothing, and now the last town rings its bell for you. Take these, for whatever waits at the front. Now go to the {oracle}, $name, and may the Dawn keep you.',
      done: 'Go with the Dawn, $name. The oracle upstairs in the academy is waiting.',
    },
  },
});

// Farmer Odo's carrots (Sunny Fields): the rabbits, and the one with the eye patch who leads them.
Object.assign(QUESTS, {
  carrot_bandit: {
    name: 'The Carrot Bandit', giver: 'fields_farmer', level: 2, kill: { rabbit: 4, one_eye_patch: 1 },
    reward: { xp: 180, gold: 25, items: [['lucky_paw', 1], ['carrot', 5]] },
    summary: 'The rabbits of Sunny Fields are stealing Farmer Odo\'s carrots, led by a big one with an eye patch: One-Eye Patch, who keeps his loot in a den in the meadow south-east of the farm, past the pond. Chase off 4 rabbits and deal with Patch, then go back to Odo.',
    text: {
      offer: 'Rabbits! Bold as brass, they come in the night and dig up my carrots, row after row. And they have a leader: a great big buck with a patch over one eye, if you can believe it. He keeps my sacks in his den out past the pond. Will you sort them out for me? ({yes}/{no})',
      accept: 'Bless you. Chase off a few of the little thieves, 4 should teach them, and then find old One-Eye. South-east, past the pond, where the grass is all dug up. Mind him: he throws.',
      progress: 'How goes the war on the rabbits? $progress so far.',
      reward: 'You got old One-Eye? Ha! My carrots are safe at last. Here: he dropped this the first time he raided me, his lucky paw. Wear it, and you\'ll run like a rabbit yourself. And some carrots, of course!',
      done: 'Not a rabbit has dared touch my carrots since. Well, hardly any.',
    },
  },
});

// Oakvale Isle's hidden quests: nobody hands them out and the guide's arrow never points at them. Rumours at the Sleepy
// Boar and in the streets ({rumours}), gravestones and old books tell of them; each ends at a chest (defs.js) that marks
// it done. The plan, with every coordinate: docs/world-plan.md, phase 7.
Object.assign(QUESTS, {
  weaver_helm: { name: 'The Weaver\'s Helm', chest: true, summary: 'You burnt through the wall of web behind the Brood Queen\'s den, went down through the deep webs, heaved the old grate aside, and took a lost adventurer\'s helm from the Old Weaver\'s larder.' },
  smuggler_shield: { name: 'The Smugglers\' Shield', chest: true, summary: 'You broke into the smugglers\' walled-up crevice on Lighthouse Point, went down through their sea grotto to the drowned hall, and took their copper shield from Saltjaw, the great crab. Their way out still comes up under the lighthouse.' },
  watch_mail: { name: 'The Old Tower', chest: true, summary: 'You pulled the Old Tower\'s levers in the order of the watch, laid the last watchman\'s shade to rest in the cellar for his greaves, then climbed past the tower\'s broken top into the storeys that still stand, through the officers\' grille, and took the watch captain\'s mail from Captain Harrow at the lookout.' },
  mogg_sabre: { name: 'Under Goblin Hill', chest: true, summary: 'You pushed through the goblins\' tunnels and took Brenna\'s bronze shield back from Gnash\'s hoard, then dug through its floor into the goblins\' old diggings, dropped into the bone halls of the goblin kings, and took King Mogg\'s sabre from his throne hall, four floors under Goblin Hill.' },
  old_wim: { name: 'Down the Well', chest: true, summary: 'You climbed down the town well and found Old Wim, and his ring, at the bottom of it.' },
});

// The gate watch of Oakvale: each guard has a task out in the wilds beyond his gate, a piece of gear for it, and
// sends you on to the next gate. Together they lead a newcomer from level 2 to the crypt at level 5.
Object.assign(QUESTS, {
  // west: Greyfang's paw prints by the lumber trail lead to his den in the pines (GATE_SITES in default-map.js); his pelt
  // is taken from him there (trophy: game-gates.js), and a few of his wolves stand in the way
  gate_west: {
    name: 'The Gate Watch: Greyfang\'s Den', giver: 'gate_west', level: 2, kill: { wolf: 4 }, fetch: 'greyfang_pelt',
    where: [68, 85, 8, 14], // (the paw prints by the lumber trail, up to his den)
    trophy: { type: 'greyfang', item: 'greyfang_pelt', text: 'Greyfang lies still at last. You cut his great grey pelt from him: Sergeant Bram will want to see it.' },
    reward: { xp: 250, gold: 30, items: [['leather_armor', 1], ['health_potion', 3]] },
    summary: 'Find Greyfang\'s paw prints by the lumber trail in Wolf Woods (out of the west gate and north-west), follow them to his den, and bring his pelt to Sergeant Bram at the west gate. His wolves will be in the way: 4 of them, at least.',
    text: {
      offer: 'You look like you can swing that thing, $name. The wolves of Wolf Woods have grown bold, and it is Greyfang who makes them so: a big grey brute who leads the pack right up to the west road at night. Nobody knows where he lairs. Will you track him down, and bring me his pelt? ({yes}/{no})',
      accept: 'Good. Out of the west gate, over the bridge, and up the lumber trail into Wolf Woods. The woodcutters have seen his paw prints by the trail, where it bends west: twice the size of any other wolf\'s. Look at them closely, and follow where they lead. His pack runs round him: thin it out on the way, and never fight three at once if you can help it. Then come back and tell me about the {wolves}.',
      progress: 'So far: $progress. Look for the big paw prints by the lumber trail, north-west of the west gate, and follow them.',
      reward: 'Greyfang\'s pelt! The road will be quieter tonight. Here - a leather jerkin; it has kept better men than me alive. One more thing: you say there was a grey hood in his den, singed, that stank of smoke? Not a hunter\'s. Someone has been walking the woods at night. And take three potions from the watch\'s stores. Once the woods are yours, I will have hunts for you again and again, paid in watch marks: two buy five more potions at Captain Osric\'s, at the north gate. Now, Guard Tilda at the south gate has been grumbling about {crabs}. Ask her about them.',
      tooWeak: 'Greyfang\'s pack would tear you apart, friend. Come back at level 2.',
      done: 'The road is quieter since you came. Guard Tilda at the south gate could use a hand with the {crabs}.',
    },
  },
  // south: Wendel the fisher is stranded on a rock off Lighthouse Point, ringed by crabs: clear them (a step's clear: none
  // left near him), talk to him, and he makes his own way home (goesHome); then tell Tilda
  gate_south: {
    name: 'The Gate Watch: Stranded', giver: 'gate_south', level: 3, after: 'gate_west',
    reward: { xp: 300, gold: 30, items: [['leather_legs', 1]] },
    summary: 'Wendel the fisher is stranded on a rock off the west beach of Lighthouse Point, ringed by crabs. Get him off it, and tell Guard Tilda at the south gate.',
    steps: [
      { npc: 'oak_stranded', word: 'help', clear: { types: ['crab'], at: [101, 220, 8], range: 3 }, goesHome: true,
        summary: 'Wendel is stranded on a rock off the west beach of Lighthouse Point (down the south road): a sand spit runs out to it, and Old Snapper, the biggest crab of all, suns himself where it starts. Kill the crabs round Wendel, and talk to him.',
        progress: 'Crabs! They are still all round me, $name! Get rid of them, or I will never get off this rock!',
        done: 'They are gone! Bless you, $name. With them gone I can lash a raft together from what is left of my boat, and paddle home to Fisher\'s Rest. Tell Guard Tilda that Wendel is safe - and that I owe her a fish supper. Oh, and take this to her: I found it in the wreck. It is no use to me.' },
      { summary: 'Tell Guard Tilda at the south gate that Wendel is safe.', progress: 'Well? Did you find Wendel?',
        done: 'Wendel is safe? Ha! That old fool will be out on that rock again by tomorrow. These leggings will keep the pincers off you, $name. And what is this he sent... a page, soaked through. "...the year of the long winter we came ashore, the spark wrapped in sailcloth, and the sea froze behind us..." The rest has washed away. Sister Ama would want to see the words, if not the page. Guard Hilde at the east gate keeps talking about {spiders} - see her next.' },
    ],
    text: {
      offer: 'Crabs, $name. Big ones. Wendel went out fishing off Lighthouse Point, a wave threw his boat on a rock, and now the crabs have him penned in on it. I can\'t leave my gate. Will you get him off? ({yes}/{no})',
      accept: 'Down the south road, all the way to Lighthouse Point; the rock is off its west beach, and a sand spit runs out to it at low tide. Their shells are hard - hit them, and keep hitting. Talk to Wendel once they are gone, then come back and tell me.',
      elsewhere: 'Help! The crabs have me trapped on this rock, and my boat is matchwood! Will nobody tell Guard Tilda at the south gate?',
      tooWeak: 'Those pincers would snap you in two. Come back at level 3.',
      notYet: 'One thing at a time, friend. Sergeant Bram at the west gate has work for you first.',
      done: 'Wendel is fishing again. Guard Hilde at the east gate has trouble with {spiders}.',
    },
  },
  // east: four spider nests round the Spider Hills burn (burnable things: Torchlight cast next to one, or a torch, which
  // Hilde gives you as you set out)
  gate_east: {
    name: 'The Gate Watch: Nests in the Hills', giver: 'gate_east', level: 4, after: 'gate_south',
    reward: { xp: 450, gold: 40, items: [['chain_helmet', 1]] },
    summary: 'Burn four spider nests round the Spider Hills (south-east) with a torch or the Torchlight spell, and report to Guard Hilde at the east gate.',
    steps: [
      { burn: 4, summary: 'Burn four spider nests round the foot of the Spider Hills, south-east of town: use the torch on one, or cast Torchlight ("lumen") next to it. Then report to Guard Hilde at the east gate.',
        progress: 'So far: $progress. The nests are round the foot of the Spider Hills, south-east of town. Use the torch on them, or say "lumen" next to one.',
        done: 'Four nests, burnt to ash! That will keep the trails clear for a season. Take this helmet - it was mine, when I was younger. One thing troubles me: you say there was a sign burnt into the biggest nest, a flame inside a ring? Spiders do not burn signs. I do not like it. Captain Osric at the north gate has a harder task, about {goblins}. He only asks the best.' },
    ],
    text: {
      offer: 'Spiders, $name. They spin their nests over the trails round the Spider Hills, and every nest is a hundred more spiders by summer. Killing them is no use: burn the nests. Four of them, and you shall have a proper helmet. ({yes}/{no})',
      accept: 'Take the spider trail south from the east road. The nests are round the foot of the hills: use a torch on them, or cast Torchlight right next to one - fire is fire. The spiders will not thank you: their poison burns, so carry potions. Then come back and tell me about the {spiders}.',
      tooWeak: 'Their poison would finish you. Come back at level 4.',
      notYet: 'One thing at a time, friend. Guard Tilda at the south gate has work for you first.',
      done: 'The trails are clearer now. Captain Osric at the north gate wants to talk to you about {goblins}.',
    },
  },
  // north: Gnash's war plans lie in the war chest in his camp on Goblin Hill; the goblins there sleep at night (sleeps),
  // unless you step right next to one, or hit one
  gate_north: {
    name: 'The Gate Watch: Gnash\'s War Plans', giver: 'gate_north', level: 5, after: 'gate_east',
    reward: { xp: 700, gold: 60, items: [['studded_shield', 1], ['health_potion', 2]] },
    summary: 'Steal Gnash\'s war plans from the war chest in his camp on Goblin Hill (north-east, past Mirror Lake), and bring them to Captain Osric at the north gate.',
    steps: [
      { fetch: 'gnash_plans', where: [198, 70, 8, 6], summary: 'Steal Gnash\'s war plans from the war chest in his camp on Goblin Hill (north-east, past Mirror Lake), and bring them to Captain Osric at the north gate. Go at night, when the goblins sleep, and never step right next to one.',
        progress: 'No plans yet? Goblin Hill is north-east, past Mirror Lake; the camp is at the top of the goblin trail. Go at night, and tread softly.',
        done: 'Gnash\'s war plans! Three arrows on my gate, and a moon... they meant to come at night. And this, in a neat human hand: "When the bell is silent, they may take what they like. - G." So the hooded man the goblins trade with is behind this too. You have earned this shield, $name, and my respect. You are ready for worse things now: Master Corwin at the academy has been asking for someone who dares go down into the {crypt} under Bone Rocks.' },
    ],
    text: {
      offer: 'So you are the one the gate watch keeps talking about. Goblins, $name: their chief, Gnash, has a whole camp on Goblin Hill, and he is planning something. Fight your way in and you will be fighting all night. But goblins sleep like the dead after dark... Will you sneak into his camp and steal his war plans? ({yes}/{no})',
      accept: 'Goblin Hill lies north-east, past Mirror Lake: follow the goblin trail to the top, and the camp is right there, round its fire. His war chest stands by his tent. Go at night: they sleep then, and a careful thief walks past them. Step right next to one, or hit one, and the whole camp wakes - and they hit hard. Then come back and tell me about the {goblins}.',
      tooWeak: 'Goblins are no rats, friend. Come back at level 5.',
      notYet: 'One thing at a time, friend. Guard Hilde at the east gate has work for you first.',
      done: 'Master Corwin at the academy needs someone brave enough for the crypt under Bone Rocks.',
    },
  },
  // ---- the gate watch's hunts: once a gate's own task is done, its guard has a hunt for you again and again (repeat:
  // ms after one is done before the next), paid in watch marks, spent on the watch's stores at Captain Osric's ----
  task_west: {
    name: 'The Watch\'s Hunt: Wolves', giver: 'gate_west', level: 3, after: 'gate_west', repeat: 20 * 60000, kill: { wolf: 10 },
    reward: { xp: 120, gold: 20, items: [['watch_mark', 2]], daily: [['watch_mark', 3]] },
    summary: 'Hunt 10 wolves for Sergeant Bram, Wolf Woods or the copses near town.',
    text: {
      offer: 'The wolves are back, $name. They always come back. Hunt 10 for the watch, and you will have two watch marks for it: Captain Osric at the north gate trades them for things from our stores. ({yes}/{no})',
      accept: 'Good hunting. Wolf woods or the copses near town.',
      progress: 'So far: $progress.',
      reward: 'Well hunted! Two watch marks: take them to the quartermaster in the Watch House, east of the square, or to Captain Osric at the north gate. Come back in a while, there will be more.',
      daily: 'And your first hunt for the watch today: three more marks on top, from the captain\'s own purse.',
      later: 'Nothing for now, $name. Come back in a while: there is always more work at the gate.',
    },
  },
  task_south: {
    name: 'The Watch\'s Hunt: Crabs', giver: 'gate_south', level: 3, after: 'gate_south', repeat: 20 * 60000, kill: { crab: 8 },
    reward: { xp: 120, gold: 20, items: [['watch_mark', 2]], daily: [['watch_mark', 3]] },
    summary: 'Hunt 8 crabs for Guard Tilda, the beaches.',
    text: {
      offer: 'The crabs are back, $name. They always come back. Hunt 8 for the watch, and you will have two watch marks for it: Captain Osric at the north gate trades them for things from our stores. ({yes}/{no})',
      accept: 'Good hunting. The beaches.',
      progress: 'So far: $progress.',
      reward: 'Well hunted! Two watch marks: take them to the quartermaster in the Watch House, east of the square, or to Captain Osric at the north gate. Come back in a while, there will be more.',
      daily: 'And your first hunt for the watch today: three more marks on top, from the captain\'s own purse.',
      later: 'Nothing for now, $name. Come back in a while: there is always more work at the gate.',
    },
  },
  task_east: {
    name: 'The Watch\'s Hunt: Spiders', giver: 'gate_east', level: 3, after: 'gate_east', repeat: 20 * 60000, kill: { spider: 10 },
    reward: { xp: 180, gold: 20, items: [['watch_mark', 2]], daily: [['watch_mark', 3]] },
    summary: 'Hunt 10 spiders for Guard Hilde, round the Spider Hills.',
    text: {
      offer: 'The spiders are back, $name. They always come back. Hunt 10 for the watch, and you will have two watch marks for it: Captain Osric at the north gate trades them for things from our stores. ({yes}/{no})',
      accept: 'Good hunting. Round the spider hills.',
      progress: 'So far: $progress.',
      reward: 'Well hunted! Two watch marks: take them to the quartermaster in the Watch House, east of the square, or to Captain Osric at the north gate. Come back in a while, there will be more.',
      daily: 'And your first hunt for the watch today: three more marks on top, from the captain\'s own purse.',
      later: 'Nothing for now, $name. Come back in a while: there is always more work at the gate.',
    },
  },
  task_north: {
    name: 'The Watch\'s Hunt: Goblins', giver: 'gate_north', level: 3, after: 'gate_north', repeat: 20 * 60000, kill: { goblin: 10 },
    reward: { xp: 180, gold: 20, items: [['watch_mark', 2]], daily: [['watch_mark', 3]] },
    summary: 'Hunt 10 goblins for Captain Osric, Stony Field or Goblin Hill.',
    text: {
      offer: 'The goblins are back, $name. They always come back. Hunt 10 for the watch, and you will have two watch marks for it: Captain Osric at the north gate trades them for things from our stores. ({yes}/{no})',
      accept: 'Good hunting. Stony field or goblin hill.',
      progress: 'So far: $progress.',
      reward: 'Well hunted! Two watch marks: take them to the quartermaster in the Watch House, east of the square, or to Captain Osric at the north gate. Come back in a while, there will be more.',
      daily: 'And your first hunt for the watch today: three more marks on top, from the captain\'s own purse.',
      later: 'Nothing for now, $name. Come back in a while: there is always more work at the gate.',
    },
  },
});

// Every task a gate guard hands out (the gate's own task, and its hunts) comes with two health potions from the watch's
// stores, given as you take it on (startGift: { items, say }, game-gates.js). Hilde adds a torch for the nests.
for (const [id, say, more] of [
  ['gate_west', 'Take these two potions: Greyfang does not fight fair, and neither should you.'],
  ['gate_south', 'Here, two potions from the watch\'s stores. Crabs pinch harder than you think.'],
  ['gate_east', 'Two potions for the poison, and a torch for the nests. Mind your eyebrows.', [['hand_torch', 1]]],
  ['gate_north', 'Take two potions. If the camp wakes up, you will need them.'],
  ['task_west', 'Two potions to take along: you will need them out there.'],
  ['task_south', 'Take these two potions: those pincers draw blood.'],
  ['task_east', 'Here, two potions. Spider bites burn for hours.'],
  ['task_north', 'Two potions from the stores, soldier. Goblins hit hard.'],
]) QUESTS[id].startGift = { items: [['health_potion', 2], ...(more || [])], say };

Object.assign(NPCS, {
  // Wendel the fisher, stranded on a rock off Lighthouse Point (The Gate Watch: south): once the crabs round him are gone
  // he paddles home to Fisher's Rest by himself (goesHome), and after a while goes back out to fish there
  oak_stranded: {
    name: 'Wendel the fisher', wander: 1, idle: 6000,
    look: { skin: '#d8a070', hair: '#8a6a4a', beard: '#8a6a4a', body: '#3a5a7a', arms: '#d8a070', legs: '#4a4a3a', feet: '#2a2a2a', belt: '#5a3a1a', hat: { style: 'hood', color: '#d8c070' } },
    goesHome: { x: 41, y: 176, z: 8, ms: 3 * 60000 },
    greet: 'Ahoy, $name! Wendel\'s the name. Mind the {crabs}: they have it in for me.',
    keywords: {
      'help|rescue|crabs|raft': { after: 'gate_south', text: 'You got me off that rock once, $name, and I came straight back out: the fish bite best round it. I keep an eye on the crabs now. Mostly.' },
      'rescue|help|crabs|raft|home': { quest: ['gate_south'] },
      job: 'I fish. Or I did, until the crabs took a liking to me.',
      'boat|wreck': 'That was my boat. A wave threw her on the rocks, and the crabs came up out of the sea before I could get away.',
    },
    chatter: ['Shoo! Shoo, you brutes!', 'Is that someone over there? Ahoy!', 'Nothing biting but crabs today.'],
  },
  // ---- Bellhaven (Kestrel Isle): the gates' watch, the market, the harbour ----
  bell_guard: {
    name: 'Gate Warden', idle: 3000,
    look: { skin: '#d8a878', hair: '#4a3020', body: '#2a4a7a', arms: '#a8aeb8', armor: '#a8aeb8', tabard: '#2a4a7a', legs: '#3a3a42', feet: '#2a2a2a', belt: '#5a3a1a', hat: { style: 'helmet', color: '#9aa0aa' }, held: 'sword', shield: '#2a4a7a' },
    greet: 'Halt - ah, one of ours. Welcome back to Bellhaven, $name. You are safe inside the gates. Need {directions}, or news of the {wilds}?',
    keywords: {
      job: 'I keep the gate. Whatever comes down this road meets me first.',
      'directions|town|temple|depot|shop|square': 'Straight on to the courtyard: the temple stands on its rock above it, the depot and the shops all round it. The harbour is down the main street, past the fountain.',
      'wilds|dangers|monsters|hunt|hunting': 'Rabbits and the odd rat close to the walls - easy pickings. Wolves and spiders in the Old Wood to the west: go in pairs. And keep away from the peaks for now.',
      'safe|safety': 'Nothing gets past us. Inside the gates you can rest easy.',
    },
    chatter: ['All quiet on the road.', 'Mind the wolves out there.', 'Welcome home.', 'Gate\'s open. Move along.'],
  },
  bell_market: {
    name: 'Marta the Grocer', idle: 4000,
    look: { skin: '#f0c8a0', hair: '#8a4a2a', hairStyle: 'long', female: true, body: '#b05a3a', arms: '#b05a3a', legs: '#6a4a2a', feet: '#3a2a1a', belt: '#e8d8a0', robe: true, trim: '#e8d8a0', hat: { style: 'wide', color: '#d8c890', accent: '#b05a3a' } },
    greet: 'Fresh from the fields this morning, $name! Have a look: let\'s {trade}.',
    keywords: { job: 'I sell what the farms grow and the boats bring in. Food for the road, mostly.', 'food|apple|bread': 'Eat before you go out. A full stomach heals you twice as fast.' },
    trade: { sells: [['apple', 2], ['bread', 4], ['fish', 4], ['cheese', 5]], buys: ['loot'] },
    chatter: ['Apples! Crisp apples!', 'Fresh bread, still warm!', 'Fish from the bay, caught this morning!'],
  },
  bell_harbour: {
    name: 'Harbour Master Quill', idle: 6000,
    look: { skin: '#d8a070', hair: '#c8c8c8', beard: '#c8c8c8', body: '#2a3a5a', arms: '#2a3a5a', legs: '#2a2a3a', feet: '#1a1a1a', belt: '#c8a040', hat: { style: 'tricorn', color: '#1a2030' } },
    greet: 'Ahoy, $name. This is my harbour. Ask me about the {ship}, or the {bay}.',
    keywords: {
      job: 'I keep the harbour: who comes, who goes, what they carry, and what they owe.',
      'ship|mainland|sail|boat': 'The ship to the mainland comes for those who are ready - when you have walked your path a while. Not before.',
      'bay|fish|sea': 'The bay keeps the town fed. The fishermen go out at dawn and come back with the gulls.',
      'tower|lookout|upstairs': 'Climb my tower if you like: from the top you see the whole bay, and the ship long before she docks.',
    },
    chatter: ['Ropes coiled, crates stacked. Good.', 'Wind\'s from the west today.', 'No ship yet.'],
  },
  bell_fisher: {
    name: 'Old Tam', idle: 7000,
    look: { skin: '#d8a070', hair: '#6a6a6a', beard: '#6a6a6a', body: '#3a5a7a', arms: '#3a5a7a', legs: '#4a4a3a', feet: '#2a2a2a', belt: '#5a3a1a', hat: { style: 'hood', color: '#d8c070' } },
    greet: 'Shh, the fish are listening. Fish for sale, though. Let\'s {trade}.',
    keywords: { job: 'Fishing. Fifty years of it.', 'sea|bay': 'The bay is kind. Out past the point it isn\'t.' },
    trade: { sells: [['fish', 4]], buys: ['loot'] },
    chatter: ['Biting today, they are.', 'This one was THIS big!', 'Smell that sea air.'],
  },
  // ---- Bellhaven's shopkeepers (Kestrel Isle): one in each shop, one job each ----
  bell_store: {
    name: 'Wenna', idle: 5000,
    look: { skin: '#f0c090', hair: '#6a3a1a', hairStyle: 'long', female: true, body: '#4a7a5a', arms: '#4a7a5a', legs: '#4a7a5a', feet: '#3a2a1a', belt: '#e8d8a0', robe: true, trim: '#e8d8a0' },
    greet: 'Welcome to the general store, $name! Rope, shovels, potions, a backpack - everything for the road. Let\'s {trade}.',
    keywords: {
      job: 'I sell what you need out there, and buy what you bring back from it.',
      'tools|rope|shovel|pick': 'A rope gets you up out of holes, a shovel digs up loose earth, a pick breaks cracked rock. Use the tool, then click where.',
      'potion|potions': 'Health potions keep you standing. Take a few before you leave the gate.',
      'farm|farrow|rats': 'Old Farrow\'s farm is out past the west gate. His barn is crawling with rats, poor man.',
    },
    trade: { sells: [['health_potion', 25], ['mana_potion', 50], ['bread', 5], ['meat', 8], ['backpack', 60], ['rope', 50], ['shovel', 50], ['pick', 50], ['fishing_rod', 120]], buys: ['loot', 'tools'] },
    chatter: ['Rope! Good strong rope!', 'Potions, fresh today.', 'Don\'t go out without a potion.'],
  },
  bell_smith: {
    name: 'Brask the Smith', idle: 4000,
    look: { skin: '#d89868', hair: '#2a1a0a', beard: '#2a1a0a', body: '#5a3a2a', arms: '#d89868', legs: '#3a3a40', feet: '#2a2a2a', belt: '#2a1a0a' },
    greet: 'Mind the sparks, $name. Weapons and armour, made here. Want to {trade}? I buy what you find out there, too.',
    keywords: {
      job: 'I forge weapons and armour, and buy the old ones back.',
      'weapon|weapons': 'Swords, axes and clubs each train their own skill. Pick one and stick with it.',
      'armor|armour|shield': 'A shield and a leather jerkin will keep a wolf\'s teeth off you. Mostly.',
      'wolf|wolves|wood': 'Wolves in the Old Wood, north-west of the gate. Bring a shield, and a friend.',
    },
    trade: {
      sells: [['wooden_club', 10], ['dagger', 18], ['hatchet', 30], ['short_sword', 45], ['spear', 8], ['wooden_shield', 15],
        ['leather_cap', 12], ['leather_armor', 35], ['leather_legs', 15], ['leather_boots', 15]],
      buys: ['gear', 'distance'],
    },
    chatter: ['*clang* *clang*', 'Good steel takes time.', 'Hot work, this.'],
  },
  bell_healer: {
    name: 'Healer Orla', idle: 6000,
    look: { skin: '#f0d0b0', hair: '#c8b890', hairStyle: 'long', female: true, body: '#e8e4d8', arms: '#e8e4d8', legs: '#e8e4d8', belt: '#5a8a5a', robe: true, trim: '#5a8a5a' },
    greet: 'Come in, $name, sit down. Hurt? I can {heal} you. I also sell {potions}: let\'s {trade}.',
    keywords: {
      job: 'I mend what the wilds break. Bites, scratches, the odd broken pride.',
      heal: { heal: true },
      'potion|potions': 'Health for the body, mana for the mind. Drink one before it gets bad, not after.',
      'spider|spiders|poison': 'Spiders in the Old Wood bite, and the bite burns. Rest it off, or come to me.',
    },
    trade: { sells: [['health_potion', 25], ['mana_potion', 50]], buys: ['loot'] },
    chatter: ['Rest is the best medicine.', 'Drink plenty of water.', 'Next, please.'],
  },
  bell_inn: {
    name: 'Innkeeper Doss', idle: 4000,
    look: { skin: '#e0a878', hair: '#8a5a2a', beard: '#8a5a2a', body: '#7a3a2a', arms: '#e0a878', legs: '#4a3a2a', feet: '#2a1a0a', belt: '#2a1a0a' },
    greet: 'Welcome to the Cracked Bell, $name! A hot meal and the town\'s {news}. Let\'s {trade}.',
    keywords: {
      job: 'I keep the Cracked Bell: food, drink, a bed upstairs, and all the talk in town.',
      'bell|cracked|name': 'The bell in the temple tower cracked the winter my father built this place. He named it after the noise.',
      'news|rumours|rumors|adventure': { rumours: [
        'Old Farrow at the farm west of the gate wants help with the rats in his barn. Pays in coin, too.',
        'The gate wardens say wolves come out of the Old Wood at dusk. Go in pairs.',
        'A fisherman swears there\'s a cave down the south-west shore. Nobody he knows has been in.',
      ] },
    },
    trade: { sells: [['bread', 5], ['meat', 8], ['cheese', 6], ['fish', 5]], buys: ['loot'] },
    chatter: ['Hot stew! Hot stew!', 'Another round?', 'Wipe your boots.'],
  },
  bell_bank: {
    name: 'Banker Pell', idle: 8000,
    look: { skin: '#f0c8a0', hair: '#3a3a3a', body: '#2a3a5a', arms: '#2a3a5a', legs: '#2a2a3a', feet: '#1a1a1a', belt: '#d0a030' },
    greet: 'Good day, $name. Your gold is safe with me: you can {deposit}, {withdraw} or check your {balance}.',
    keywords: { 'deposit|withdraw|balance': { bank: true }, job: 'I keep the town\'s gold. Yours too, if you like.', 'depot|locker': 'Your locker is right here: whatever you put in it waits for you.' },
    chatter: ['Counting, counting.', 'Every coin in its place.'],
  },
  farrow: {
    name: 'Old Farrow', idle: 5000,
    look: { skin: '#d8a070', hair: '#b8b8b0', beard: '#b8b8b0', body: '#6a5a3a', arms: '#6a5a3a', legs: '#4a4a3a', feet: '#3a2a1a', belt: '#3a2a1a', hat: { style: 'wide', color: '#c8a860' } },
    greet: 'Eh? A visitor! Welcome to my farm, $name. Mind the {rats}.',
    keywords: {
      job: 'Farmer. Was, anyway. The fields have gone to weeds since my back gave out.',
      'rats|quest|mission|task|help': { quest: ['farrow_rats'] },
      'barn': 'Fell in two winters ago. Now the rats live there, and they eat my seed.',
      'wood|wolves': 'North of the crossroads is the Old Wood. I don\'t go there any more.',
    },
    chatter: ['Blasted rats.', 'Oh, my back.', 'The crops won\'t plant themselves.'],
  },
  // ---- the Hall of Paths (Kestrel Isle): the Pathkeeper, and a teacher for each path (game-paths.js) ----
  pathkeeper: {
    name: 'Pathkeeper Ilse',
    look: { skin: '#e8c0a0', hair: '#c8c8c8', body: '#4a3a6a', arms: '#4a3a6a', legs: '#3a2a4a', belt: '#d8b040', robe: true, trim: '#d8b040', hat: { style: 'hood', color: '#3a2a5a' }, held: 'staff' },
    greet: 'Welcome to the Hall of Paths, $name. Every adventurer walks one of four {paths}. I can tell you about them, and the four teachers here let you try each one.',
    keywords: {
      'paths|path|book|vocation|vocations|choose|destiny': { paths: true },
      'bastion|knight': { choosePath: 'knight' },
      'hawk|paladin': { choosePath: 'paladin' },
      'ember|sorcerer': { choosePath: 'sorcerer' },
      'grove|druid': { choosePath: 'druid' },
      'teacher|teachers|trial|trials|try': 'Sergeant {Holt} teaches the Bastion, Ranger {Sill} the Hawk, Mistress {Vela} the Ember and Old {Fennick} the Grove. Each one has a practice room below this hall.',
      holt: 'Sergeant Holt, in the corner by the violet pillar. Loud, but kind.',
      sill: 'Ranger Sill, by the green pillar. She hardly ever speaks, and never misses.',
      vela: 'Mistress Vela, by the orange pillar. Don\'t touch her hair. It was singed once.',
      fennick: 'Old Fennick, by the blue pillar. He has kept this town alive through three winters of fever.',
      job: 'I keep this hall, and the Book of Paths. Everyone who comes to Kestrel Isle chooses here, sooner or later.',
    },
  },
  holt: {
    name: 'Sergeant Holt',
    look: { skin: '#d8a070', hair: '#5a3a1a', beard: '#5a3a1a', body: '#8a8a90', arms: '#d8a070', legs: '#4a3a2a', belt: '#6a2a1a', hat: { style: 'helmet', color: '#9a9aa0' }, held: 'sword', shield: '#8a3a2a' },
    greet: 'Ha! Fresh blood. I teach the {Bastion}: the one who stands in front. Want a {trial}?',
    keywords: {
      'trial|try|practice|bastion|knight': { trial: 'knight' },
      'circle|throw|spear': 'The Circle Throw: a war spear swung round in front of you, and everything within two tiles feels it. Say "hasta orbis".',
      job: 'I train the town watch, and anyone with the nerve to stand in front.',
    },
  },
  sill: {
    name: 'Ranger Sill',
    look: { skin: '#e8c098', hair: '#8a5a2a', body: '#4a6a3a', arms: '#4a6a3a', legs: '#3a4a2a', belt: '#6a4a2a', hat: { style: 'hood', color: '#3a5a2a' }, held: 'bow' },
    greet: 'Hm. The {Hawk}. From afar. A {trial}?',
    keywords: {
      'trial|try|practice|hawk|paladin': { trial: 'paladin' },
      'power|shot|triple': 'Power Shot: draw it full, loose it through a whole row. Triple Shot: three, quick. The bow I lend you sees weak spots too.',
      job: 'Ranger. Arrows. Few words.',
    },
  },
  vela: {
    name: 'Mistress Vela',
    look: { skin: '#f0c8a8', hair: '#b03020', body: '#8a2a1a', arms: '#8a2a1a', legs: '#5a1a10', belt: '#e09030', robe: true, trim: '#e09030', held: 'staff' },
    greet: 'Oh, a new spark! I teach the {Ember}: fire, and lots of it. Shall we have a {trial}?',
    keywords: {
      'trial|try|practice|ember|sorcerer': { trial: 'sorcerer' },
      'fire|bolt|burst|flame': 'Fire Bolt ("ignis") for one, Flame Burst ("ignis orbis") for everyone around you. Mind your mana: it goes quickly.',
      job: 'I teach young Embers not to burn the town down. Mostly it works.',
    },
  },
  fennick: {
    name: 'Old Fennick',
    look: { skin: '#d8b090', hair: '#e0e0d8', beard: '#e0e0d8', body: '#3a6a5a', arms: '#3a6a5a', legs: '#2a4a3a', belt: '#8a6a3a', robe: true, held: 'staff' },
    greet: 'Ah, welcome, welcome. I teach the {Grove}: ice, earth, and keeping people alive. Would you like a {trial}?',
    keywords: {
      'trial|try|practice|grove|druid': { trial: 'druid' },
      'heal|ice|frost': 'Ice Bolt ("glacies") slows nothing down but your enemy\'s hopes. Greater Heal ("vita major") is the one that matters. Let the sparring dummy hit you, then heal.',
      job: 'Healer, teacher, and gardener when my knees allow it.',
    },
  },
  ama: {
    name: 'Sister Ama',
    look: { skin: '#e8c4a0', hair: '#8a5a2a', body: '#f0ead8', arms: '#f0ead8', legs: '#f0ead8', belt: '#d8a830', robe: true, hat: { style: 'hood', color: '#e8e0c8' } },
    greet: 'Peace be with you, $name. You are safe here, in the last town under the Dawn. Ask me what has {happened}, or if you are hurt I can {heal} you.',
    keywords: {
      'clang|cat|kitten': 'Clang! The temple cat. He ran off when the horns blew, the poor thing. If you find him, keep him close: he will be braver with you than he ever was with me.',
      'pet|companion': { pet: true },
      job: 'I keep the Temple of the Dawn. Everyone who comes to Oakvale wakes here first - and again after each death.',
      'founder|founders|history|past': 'The founders came over the sea in the year of the long winter, a hundred and more years ago, on a ship called the Dawn. They built this temple first, and named it after her.',
      'winter|long': 'The long winter, the year the founders came. The sea froze at the shore, and they lived in the hull of their ship until spring. Many are buried under Bone Rocks from that winter.',
      oakvale: 'A small town, but a good one. The {academy} is south of the square, with the yellow roof, the {depot} across the high street from it, and the shops east of the square.',
      'happened|fight|quest|mission|task|help|farewell|goodbye': { quest: ['last_town', 'bell_6'] },
      'host|hollow|monsters|war|world': 'The Hollow Host. Nobody knows where it came from: one winter the monsters stopped fighting each other and started marching together. Town after town went dark. Oakvale is the last. Our wall still stands, and as long as it does, there is hope.',
      bell: 'The bell in the tower east of the temple. We ring it when someone leaves for the front.',
      'stone|seal': 'Show the stone to Master Corwin at the academy. He knows old things.',
      'oracle|vocation|mainland': 'The oracle lives upstairs in the academy. She lets you choose a vocation at level 10, and names the path you will fight on at the front.',
      sewers: 'Under the grates in the streets. Rats, mostly. Farmer Ned curses them every day.',
      'mirror|lake|shrine|water|flask': 'Mirror Lake, north of town, past the river. On its south shore the founders built a little shrine, and Edda blessed its water. The dead fear it. Drink it when you are hurt: it heals better than a potion.',
      'academy|corwin|teacher': 'Master Corwin teaches newcomers at the academy, south of the square: the big house with the yellow roof.',
      depot: 'The depot is south-west of the square, by the lane of shops, across the high street from the academy. The postmaster will explain your locker.',
      heal: { heal: true },
    },
  },
  corwin: {
    name: 'Master Corwin',
    look: { skin: '#e0b088', hair: '#9a9aa0', beard: '#9a9aa0', body: '#2a4a6a', arms: '#2a4a6a', legs: '#2a2a3a', belt: '#8a6a3a', robe: true },
    greet: 'Ah, a new face. I am Master Corwin: I make a {fighter} of anyone who wants to stand on the wall. Ask me about {fighting}, {loot}, {skills}, {spells}, {tools} or {food} - or about the {oracle} upstairs.',
    keywords: {
      'farewell|goodbye': { quest: ['bell_6'] },
      'fighter|train|training|recruit|quest|mission|task': { quest: ['recruit'] },
      job: 'I train the recruits of the last town. Fewer every year, and younger.',
      'host|hollow|war|front': 'The Hollow Host does not tire and does not fear. What it lacks is cunning: hold a line, use the walls, and it breaks on them. That is what I teach.',
      'history|past|founder|founders': 'Oakvale is young, as towns go. The founders built the wall, the temple and this academy within twenty years. What they fled from, they never wrote down - or if they did, nobody has found it.',
      'tower|old': 'The Old Tower on its hill east of town is older than Oakvale. The founders found it standing, roofless, when they came, and Oakvale kept a watch in it until its floors fell in. The dead walk its top now. I would not go there before level 6.',
      'torchlight|light|dark': 'At level 2 you can light your way: say "lumen" (or use the spell button), and you glow like a torch for three minutes. It costs 15 mana.',
      'bone|rocks': 'Bone Rocks is the crag south-west of town, at the end of the bone trail. The founders\' crypt lies beneath it, sealed for a hundred years. Nobody goes there.',
      'sewers|grate|grates': 'The grates in the streets lead down into the sewers. Rats, mostly - and some big ones where the walls have fallen in, under the training yard.',
      'fighting|fight': 'Tap or click a monster to attack it. Put on what you find: drag weapons and armour onto your equipment. Drink a potion or eat when you are hurt, and run if you must - there is no shame in it.',
      'loot|corpse': 'When a monster dies, open its corpse and take what you need. Sell the rest at Pip\'s or the smithy.',
      skills: 'Every weapon trains its skill as you use it, and a shield trains when you are hit. Spending mana trains your magic.',
      spells: 'You learn your first spells as you grow: Torchlight at level 2, Light Heal at level 3. Your {vocation} teaches you more.',
      tools: 'A rope gets you up through holes, a shovel digs loose sand, a pick breaks cracked rock. Pip sells them.',
      'food|eat|hungry': 'Eat, and you get your health and mana back much faster. The Warm Loaf sells bread.',
      'oracle|vocation|mainland': 'The oracle lives upstairs. At level 10 she lets you choose a vocation: Bastion, Hawk, Ember or Grove. Choose with care: it cannot be undone. The mainland? No ship has come for anyone yet. Until one does, Oakvale needs its own.',
      'sunny|fields|rats': 'Sunny Fields lie south of town, out of the south gate: rats, close to the wall. The sewers under town have plenty too.',
    },
  },
  oak_oracle: {
    name: 'The Oracle',
    look: { skin: '#e8d0b8', body: '#4a2a6a', arms: '#4a2a6a', legs: '#4a2a6a', belt: '#d0b040', robe: true, hat: { style: 'hood', color: '#3a1e5a' } },
    greet: 'I have been waiting for you, $name. Shall I reveal your {destiny}?',
    keywords: {
      job: 'I see the paths that lie before those who come here.',
      'destiny|vocation': { destiny: true },
      'bastion|knight': { vocation: 'knight' }, 'hawk|paladin': { vocation: 'paladin' }, 'ember|sorcerer': { vocation: 'sorcerer' }, 'grove|druid': { vocation: 'druid' },
    },
  },
  postmaster: {
    name: 'Postmaster Hobb',
    look: { skin: '#f0c8a0', hair: '#5a3a1a', body: '#3a5a8a', arms: '#3a5a8a', legs: '#2a2a3a', belt: '#c0a040', hat: { style: 'wide', color: '#2a3a5a' } },
    greet: 'Good day, $name! Letters, parcels, and your {locker}. What can I do for you?',
    keywords: {
      job: 'I run the depot and the post.',
      'ship|dawn|sea': 'The founders\' ship, the Dawn? Her bronze fittings went into our bell, they say, and her timbers into the depot\'s roof. Look up when you are in here: those beams have crossed an ocean.',
      'locker|quest|mission|task': { quest: ['recruit'], otherwise: 'Open any locker here and it is yours. What you put in it is safe, whatever happens to you out there.' },
      depot: 'Open any locker here and it is yours. What you put in it is safe, whatever happens to you out there.',
    },
  },
  pip: {
    name: 'Pip',
    look: { skin: '#f0c090', hair: '#c87a2a', body: '#4a7a3a', arms: '#f0c090', legs: '#6a4a2a', belt: '#3a2a1a' },
    greet: 'Hello $name, welcome to Pip\'s Provisions! Food, potions, rope and shovels - just ask to {trade}. I buy what you find on monsters, too.',
    keywords: {
      'farewell|goodbye': { quest: ['bell_6'] },
      job: 'I sell everything an adventurer needs, and buy what they bring back.',
      'lighthouse|point': 'Lighthouse Point, south of the fields? There was a lighthouse once. A storm took it the year I was born. Only the crabs live there now.',
      'fish|fisher|fishing': 'Fisher\'s Rest is on the west shore. Buy a fishing rod and use it on the water: fish heal you as well as bread does, and cost nothing but patience.',
      'supplies|quest|mission|task': { quest: ['recruit'], otherwise: 'Supplies? Just ask to {trade}.' },
      'tip|tips': 'Never leave town without a rope and a shovel. And sell your loot before your bag gets too heavy.',
    },
    trade: {
      sells: [['apple', 3], ['bread', 5], ['meat', 8], ['health_potion', 25], ['mana_potion', 50], ['pet_tonic', 8], ['backpack', 60], ['rope', 50], ['shovel', 50],
        ['pick', 50], ['fishing_rod', 120]],
      buys: ['loot', 'tools'],
    },
  },
  oak_smith: {
    name: 'Smith Dunstan',
    look: { skin: '#d89868', hair: '#2a1a0a', beard: '#2a1a0a', body: '#5a3a1a', arms: '#d89868', legs: '#3a3a40', belt: '#2a1a0a' },
    greet: 'Welcome to the Dented Shield, $name. Weapons, bought and sold - want to {trade}?',
    keywords: { job: 'I make weapons, and I buy the ones you find.', 'trophy|trophies|whetstone|core': { trophy: true }, 'spiked|club|best': 'A spiked club is the best I can make, and it is not cheap. They say the founders were buried with better arms - a longsword, a war axe and a mace - down in the crypt under Bone Rocks. Nobody who went to look came back with one.' },
    trade: { sells: [['wooden_club', 10], ['dagger', 18], ['hatchet', 30], ['short_sword', 45], ['spear', 8], ['spiked_club', 120], ['hawkeye_bow', 1200]], buys: ['gear', 'distance'] },
  },
  oak_armourer: {
    name: 'Armourer Brenna',
    look: { skin: '#e8b890', hair: '#a83a1a', body: '#6a6a72', arms: '#e8b890', legs: '#4a4a52', belt: '#2a1a0a' },
    greet: 'Hide and Iron, at your service, $name. Helmets, armour and shields - shall we {trade}?',
    keywords: {
      job: 'I make armour that keeps young adventurers in one piece.',
      'trophy|trophies|tail|hide|plate|spinneret|helm|claw': { trophy: true },
      'crypt|gate|family': 'My great-grandmother forged the iron gate in the founders\' crypt. She said it was the only gate she ever made to keep something IN.',
      'bronze|ward|grandmother': 'The Bronze Ward... my grandmother\'s shield, the best she ever made. It hung in my window till Gnash\'s goblins took it, two winters ago. They hoard what they steal down in holes under their hill, the hunters say. Whoever brings it out of there may keep it, and welcome: better a brave arm carries it than a goblin sits on it.',
    },
    trade: { sells: [['wooden_shield', 15], ['leather_cap', 12], ['leather_armor', 35], ['leather_legs', 25], ['leather_boots', 15], ['chain_helmet', 180], ['chain_legs', 300], ['chain_armor', 500]], buys: ['gear'] },
  },
  oak_mage: {
    name: 'Moonpetal',
    look: { skin: '#f0d8c0', hair: '#d8d8f0', body: '#5a3a8a', arms: '#5a3a8a', legs: '#5a3a8a', belt: '#c0a0e0', robe: true, hat: { style: 'pointy', color: '#4a2a7a' } },
    greet: 'Welcome to my little shop, $name. Potions, runes and wands - would you like to {trade}?',
    keywords: {
      job: 'I sell magic to those who are ready for it. Most of it is for after you choose a vocation.',
      'host|hollow|magic': 'The Hollow Host has no magic of its own, $name. It has numbers. Learn your spells well: one good spell is worth ten swords on a wall.',
    },
    trade: { sells: [['health_potion', 25], ['mana_potion', 50], ['blank_rune', 10], ['rune_heal', 40]], buys: ['magic', 'jewelry'] },
  },
  // The gate watch: a guard at each of Oakvale's gates, each with a task beyond it (see the gate quests).
  gate_west: gateGuard('gate_west', 'Sergeant Bram', '#5a3a1a', 'wolves', 'The west gate: out over the bridge to Frog Marsh and Wolf Woods.'),
  gate_south: gateGuard('gate_south', 'Guard Tilda', '#a8582a', 'crabs', 'The south gate: Sunny Fields, then the south road to Lighthouse Point. The bone trail branches off west to Bone Rocks.'),
  gate_east: (() => { // (Hilde also knows of the spiders' den, and its queen)
    const g = gateGuard('gate_east', 'Guard Hilde', '#d8c070', 'spiders', 'The east gate: Deer Woods, the Old Tower, and the spider trail south to the Spider Hills.');
    g.keywords['queen|brood|den|cave'] = 'Under the Spider Hills there is a den: steps cut into their south face. The spiders in there serve something big. The Brood Queen, we call her. I went in once, at your age. Once. Go much stronger than the Thornmother asks, $name: level twelve, with friends and potions.';
    g.greet = g.greet.replace('{dangers}?', '{dangers}? Or the spiders\' {den}?');
    return g;
  })(),
  gate_north: (() => { // (the captain keeps the watch's stores: watch marks buy from them)
    const g = gateGuard('gate_north', 'Captain Osric', '#3a3a3a', 'goblins', 'The north gate: Mirror Lake, Stony Field and the North Peaks. Goblin Hill is north-east, past the lake.', true);
    g.keywords['marks|mark|stores|shop|reward|potions|mana|life|keeping|feather|gull|jay|cloak|ember|moss'] = { marks: [
      ['potions', 2, [['health_potion', 5]], '5 health potions'], ['mana', 2, [['mana_potion', 5]], '5 mana potions'],
      ['life', 5, [['ring_life', 1]], 'a ring of life'], ['keeping', 8, [['amulet_keeping', 1]], 'an amulet of keeping'],
      // (to wear: seen by everyone, worn over any outfit)
      ['gull', 5, { cosmetic: 'gull_feather' }, 'a gull feather for your hair'], ['jay', 5, { cosmetic: 'jay_feather' }, 'a blue jay feather'],
      ['ember', 5, { cosmetic: 'ember_cloak' }, 'an ember-red cloak'], ['moss', 5, { cosmetic: 'moss_cloak' }, 'a moss-green cloak'],
      ['cloak', 5, { cosmetic: 'watch_cloak' }, 'a watch-blue cloak'],
    ] };
    g.greet = g.greet.replace('{dangers}?', '{dangers}? Watch {marks} to spend?');
    g.keywords['fight|volunteer|cannons|wall'] = { quest: ['last_town'] };
    g.keywords['farewell|goodbye'] = { quest: ['bell_6'] };
    return g;
  })(),
  oak_baker: {
    name: 'Baker Willa',
    look: { skin: '#f0c8a0', hair: '#e0c070', body: '#f0e8d8', arms: '#f0c8a0', legs: '#8a5a3a', belt: '#f0e8d8' },
    greet: 'Fresh bread, $name! Eat well, heal fast. Want to {trade}?',
    keywords: {
      job: 'I bake for the whole town, from the grain of our own field by the farmhouse. Eating makes you heal much faster, you know.',
      'hermit|rock': 'The hermit on Hermit Rock buys a sack of flour from me every spring, and pays in honey. He only comes at night. Strange man. Kind, though.',
    },
    trade: { sells: [['bread', 4], ['cheese', 3], ['apple', 2], ['meat', 7]], buys: ['loot'] },
  },
  // ---- Oakvale's fisher by the canal, the quartermaster of the watch, the farmer ----
  oak_fisher: {
    name: 'Old Maren the Fisher', idle: 6000,
    look: { skin: '#d8a070', hair: '#8a8a8a', beard: '#8a8a8a', body: '#3a5a7a', arms: '#3a5a7a', legs: '#4a4a3a', feet: '#2a2a2a', belt: '#5a3a1a', hat: { style: 'hood', color: '#d8c070' } },
    greet: 'Ahoy, $name. Want to learn to {fish}? I sell rods, and I buy what you catch. Let\'s {trade}.',
    keywords: {
      job: 'I fish the canal and the moat, and teach the young ones.',
      'fish|fishing|rod|jetty': 'Use the rod, then click the water. The jetty out back is the best spot in town. Fish heal you well when you eat them.',
    },
    trade: { sells: [['fishing_rod', 120], ['fish', 5]], buys: ['loot'] },
    chatter: ['Biting today, they are.', 'Quiet water, fat fish.', 'This one was THIS big!'],
  },
  oak_quartermaster: {
    name: 'Quartermaster Wynn', idle: 6000,
    look: { skin: '#e0a878', hair: '#5a3a1a', body: '#2a4a7a', arms: '#a8aeb8', armor: '#a8aeb8', tabard: '#2a4a7a', legs: '#3a3a42', feet: '#2a2a2a', belt: '#5a3a1a' },
    greet: 'The Watch House, $name. Hunted for the gate guards? Then you have watch {marks}: I keep the watch\'s stores.',
    keywords: { job: 'I keep the watch\'s stores, and pay out for the hunts.', 'hunt|hunts|task|tasks': 'The four gate guards give the hunts. Two marks for each, and the stores are here.' },
    chatter: ['Marks for stores, stores for marks.', 'Every potion counted.', 'The watch thanks you.'],
  },
  oak_farmer: {
    name: 'Farmer Ned', idle: 5000,
    look: { skin: '#d8a070', hair: '#a07040', body: '#6a5a3a', arms: '#6a5a3a', legs: '#4a4a3a', feet: '#3a2a1a', belt: '#3a2a1a', hat: { style: 'wide', color: '#c8a860' } },
    greet: 'Morning, $name! This is the town farm: the last grain field there is. The {rats} are at it again. Fancy some {trade}?',
    keywords: {
      job: 'I grow the town\'s grain. Willa bakes it, the town eats it, and the rats try to.',
      'rats|quest|mission|task|help|grain': { quest: ['recruit'], otherwise: 'Blasted rats. Master Corwin sends his recruits to me for them: ask him.' },
      'hay|loft|upstairs': 'The loft is full of hay for the winter. Mind the stairs.',
    },
    trade: { sells: [['carrot', 2], ['apple', 2]], buys: ['loot'] },
    chatter: ['Good weather for the grain.', 'Blasted rats.', 'Hay\'s in, thank the Dawn.'],
  },
  // The hermit of Hermit Rock: he sleeps by day and talks only at night (nightOnly), and keeps a page of the founder's
  // diary he found in a gull's nest
  oak_hermit: {
    name: 'Hermit Brannoc', nightOnly: true,
    look: { skin: '#c89a70', hair: '#d8d4cc', beard: '#d8d4cc', hairStyle: 'long', body: '#5a4a32', arms: '#5a4a32', legs: '#4a3a28', feet: '#2a1a0a', belt: '#3a2a1a', robe: true },
    asleep: 'Zzz... (The hermit is fast asleep by his cold fire. He wakes when the stars come out.)',
    greet: 'Shh. Listen... the bears are snoring. Sit, $name, if you came up all this way. Some {honey}?',
    keywords: {
      job: 'I watch the sea and the stars, and the bears watch me. We get on.',
      honey: 'Willa\'s flour for my honey, every spring. The bees up here feed on the heather. Best honey on the isle. The bears agree.',
      'page|diary|chronicle': { text: 'A gull brought this up to its nest, years ago. Old writing: the founder\'s, I think. I have read it a hundred times. Take it to someone who can make sense of it. Corwin, maybe.' },
      'stars|night|sea': 'At night you can see the boats without lamps, far out. Singing. I do not go down when they sing.',
      'eagle|eagles|eyrie|peaks': 'The eagles nest high on the North Peaks. Leave them be, and they leave you be.',
      'bears|bear': 'They let me be. Do not try their patience, $name: they hit like falling trees.',
    },
    chatter: ['The stars are clear tonight.', 'Shh. Bears sleeping.', 'Another boat with no lamp...'],
  },
  // Brother Ossian, the ghost of the half-blind gravedigger who laid the island's dead to rest in patterns of bone in a
  // chapel behind the crypt (The Bone Chapel): he wants the crest of Oakvale made whole again
  oak_ossian: {
    name: 'Brother Ossian',
    look: { skin: '#c8d0d8', hair: '#e0e4ea', beard: '#e0e4ea', body: '#8a8e96', arms: '#8a8e96', legs: '#6a6e76', feet: '#4a4e56', belt: '#5a5e66', robe: true, hat: { style: 'hood', color: '#7a7e86' } },
    greet: 'Ah... footsteps. Real ones. Mind the {bones}, friend: every one of them was somebody. I am Ossian. I {counted} them all.',
    keywords: {
      job: 'I was the gravedigger, when the graveyard grew full. I brought the old bones down here, and laid them out so that none would be forgotten. I am still at it, it seems.',
      'bones|chapel|counted|count': 'Four thousand, two hundred and eleven. I counted them twice. The skulls in the corners, the long bones in the ring above you, and the {crest} on the wall: the crest of Oakvale, the bell in its ring.',
      'founder|founders': 'The founders sleep next door, in their hall. I never moved them. Some things you leave be.',
    },
    chatter: ['...four thousand, two hundred and nine... ten... eleven.', 'Mind the bones.', 'Every one was somebody.'],
  },
  // Keeper Tamsin, by her fire at Lighthouse Point, where the lighthouse stood: she sees the Choir's boats at night
  oak_keeper: {
    name: 'Keeper Tamsin',
    look: { skin: '#d8a880', hair: '#c8c0b8', hairStyle: 'long', female: true, body: '#3a4a5a', arms: '#3a4a5a', legs: '#2a2a32', feet: '#2a1a0a', belt: '#8a6a3a', coat: true },
    greet: 'A visitor, out here? Sit by the fire, $name. Mind the wind. Ask me about the {lighthouse}, if you like.',
    keywords: {
      job: 'I keep the light. The new tower has never burned, so I keep a fire at its foot, and that will have to do.',
      'lighthouse|lamp|tower|coat|oil|wick|flint': 'The great storm took the old lighthouse, the year Pip was born: the sea threw it right over the point. The town built this one after, stone by stone, but its lamp has never burned.',
      storm: 'The great storm took the old lighthouse, the year Pip was born. The sea threw the lamp right over the point - its stump is still out there. I keep a fire, so the fishing boats find their way home.',
      'eagle|eagles|peaks|hermit|cave|shades': { after: 'keeper_coat', text: 'That cave under the North Peaks goes further than the flint, they say: up inside the mountain, to where the great eagles nested. The hermit on Hermit Rock climbed it, when he was young. Ask him about the {eagles} - at night: he sleeps by day.',
        before: 'The North Peaks? A cave runs in under their south face. The old keepers went there for their flint. Nobody goes now: the dead walk in there.' },
    },
    chatter: ['The wind is turning.', 'A boat out there, without a lamp. Again.', 'Who sings out at sea at night?'],
  },
  // Oakvale's landlady, at a table in the Sleepy Boar: the town's one house to let is hers
  oak_landlady: {
    name: 'Landlady Hettie',
    look: { skin: '#f0c8a0', hair: '#b8b0a8', hairStyle: 'long', female: true, body: '#4a6a5a', arms: '#4a6a5a', legs: '#3a3a4a', feet: '#2a2a2a', belt: '#c8a060', robe: true, trim: '#c8a060' },
    greet: 'A roof of your own, $name? I let Bell Cottage, the house just by the inn. Ask me about the {houses}.',
    keywords: {
      'houses|house|rent|leave|home': { houses: true },
      job: 'I let houses, and I collect the rent, and I remember who paid it late.',
      'friends|share': 'Rent a house, and your friends may visit you there. A home is a fine place to keep what you find.',
    },
    chatter: ['Rent is due at the end of the week!', 'Bell Cottage is lovely in spring.', 'One house, and a long list of people who want it.'],
  },
  oak_innkeeper: {
    name: 'Innkeeper Rolf',
    look: { skin: '#e0a878', hair: '#6a4a2a', beard: '#6a4a2a', body: '#8a5a2a', arms: '#e0a878', legs: '#4a3a2a', belt: '#2a1a0a' },
    greet: 'Welcome to the Sleepy Boar, $name! A meal, a drink, and the best {rumours} on the isle. Want to {trade}?',
    keywords: {
      job: 'I keep the Sleepy Boar.',
      'history|founder|founders|winter': 'Ask Sister Ama about the founders: she knows the old stories. All I know is that the Boar was the second building in Oakvale, after the temple. Priorities!',
      'rumours|rumors|news': { rumours: [RUMOURS.well, RUMOURS.tower, RUMOURS.ward, RUMOURS.tidecutter, RUMOURS.lighthouse, RUMOURS.eagle, RUMOURS.chapel, RUMOURS.smugglers, RUMOURS.weaver] },
      bell: 'They say the temple bell went quiet the night the rats came up through the grates.',
      'graveyard|gravestone|grave': 'The old graveyard is behind my inn. Read the stones - some say more than they seem to.',
    },
    trade: { sells: [['bread', 4], ['cheese', 3], ['meat', 7], ['fish', 5], ['health_potion', 45]], buys: ['loot'] },
  },
});

// Oakvale Isle's hidden quests (docs/world-plan.md, Phase 7): nobody's guide points at them (hidden). They are found
// by listening: rumours in town, a bottle from the sea, and each giver's own words, which carry the clue to the next.
// Each needs a tool, a fight and a find.
// (step.thing: done at that thing in the world (questDeed in game-core.js), needs: what it takes there, give: what you
// get there; step.has: you only show it, and keep it)
Object.assign(QUESTS, {
  // Old Maddock's tale: the Gull went down in the great storm, in the sea cave south of Fisher's Rest, with his sister's
  // sword aboard. His chart has a rhyme for where she buried the cave's key; Old Snapper's mate keeps the wreck.
  tidecutter: {
    name: 'Tidecutter', giver: 'rest_fisher', level: 7, hidden: true, word: 'tale',
    reward: { xp: 300, gold: 60, items: [['tide_ring', 1], ['health_potion', 3]] },
    summary: 'Find Tidecutter, the blade that went down with the Gull, in the sea cave south of Fisher\'s Rest.',
    steps: [
      { thing: 'tide_dig', give: [['sea_key', 1]], summary: 'Take the sea chart from Old Maddock\'s sea chest in his hut, read its rhyme, and dig where it says with a shovel.',
        progress: 'The chart is in my sea chest, in the hut. Read the rhyme on it, then dig where it points. You have a shovel?',
        done: 'Your shovel strikes wood: a little box, tarred shut. Inside, wrapped in oilcloth, lies a heavy key crusted with barnacles. Maddock\'s chart marks the sea cave, south along the rocks.' },
      { npc: 'rest_fisher', fetch: 'tidecutter', summary: 'Open the gate of the sea cave in the rocks south of Fisher\'s Rest with the barnacled key, take Tidecutter from the wreck of the Gull, and bring it to Old Maddock.',
        progress: 'The cave opens in the rocks south of the beach, and the key opens its gate. Mind the crabs in there, and the big one: Old Snapper\'s mate, they call her Brineshell.',
        done: 'Tidecutter... Wenna\'s blade. Look at the edge: fifty years under the sea, and not a spot of rust. It goes over my door, where she can see it from wherever she is. Take her ring, $name: she wore it at sea, and the sea was kind to her. And these, for the cuts you got fetching it. If you have the luck of the sea, use it: the new {lighthouse} on the point has never been lit. Ask Keeper Tamsin.' },
    ],
    text: {
      offer: 'A tale, then. My sister Wenna sailed the Gull, and she wore a sword called Tidecutter - forged from the anchor chain of the founders\' ship, they said. In the great storm she ran for the sea cave south of here, and the Gull went down inside it. Wenna swam out. The sword did not. She locked the cave behind her and buried the key, and wrote where on my chart, in a rhyme, as she always did. She never went back. Will you? ({yes}/{no})',
      accept: 'The chart is in my sea chest, in the hut: take it. Read the rhyme, take a shovel, and dig where it says. And mind: the crabs have the cave now, and the biggest of them all - Old Snapper\'s mate. Ask me about the {tale} when you have the blade.',
      tooWeak: 'That tale is not for you yet, $name. The cave would eat you. Come back at level 7.',
      done: 'Wenna\'s blade, back over my door. Wear her ring well, $name.',
    },
  },
  // Keeper Tamsin's dark lighthouse: oil from the farm's cellar (rats), silk from the spiders (a wick), flint from the
  // cave under the North Peaks (shades, a pick); then the lamp at the top of the tower.
  keeper_coat: {
    name: 'The Keeper\'s Light', giver: 'oak_keeper', level: 8, hidden: true, word: 'lighthouse',
    reward: { xp: 375, gold: 80, items: [['keeper_lantern', 1]] },
    summary: 'Light the lamp of the lighthouse at Lighthouse Point. It needs lamp oil, a wick and a flint.',
    steps: [
      { thing: 'lighthouse_lamp', needs: [['lamp_oil', 1], ['spider_silk', 3], ['flint', 1]],
        summary: 'Bring a jar of lamp oil (Farmer Odo keeps them in his cellar, at the farm in Sunny Fields), 3 spider silk for a wick, and a piece of flint (in the cave under the North Peaks\' south face: a pick breaks it off), and light the great lamp at the top of the lighthouse.',
        progress: 'Lamp oil from Farmer Odo\'s cellar, at the farm in Sunny Fields. Three spider silk, from the spiders of the hills. And flint from the cave under the North Peaks: bring a pick. Then climb the tower and light the lamp.',
        missing: 'The lamp is dry, it has no wick, and there is nothing to strike a light with.',
        done: 'Oil in the bowl, a wick twisted from spider silk... the flint sparks once, twice - and the great lamp catches! Its light sweeps out over the sea, for the first time since the storm.' },
      { npc: 'oak_keeper', summary: 'Tell Keeper Tamsin that the lamp burns.',
        progress: 'I saw it from down here. Come and tell me, $name!',
        done: 'I saw it from down here - the light, sweeping the water! The boats will find their way home. Here: the keeper\'s lantern, the little brother of the great lamp. Light it in the dark places, and it burns as long as you need. It was always meant for whoever lit that lamp. And while you were in that cave... the hermit on Hermit Rock climbed those peaks, when he was young. Ask him about the {eagles}, at night.' },
    ],
    text: {
      offer: 'The tower behind me? The town built it again after the storm, stone by stone. But the lamp at the top has never burned: no oil, no wick, and the old keepers\' flint went into the sea with the old tower. Every winter a boat goes on the rocks for want of it. Will you light it for me? ({yes}/{no})',
      accept: 'Bless you. Three things. A jar of lamp oil: Farmer Odo presses it, at the farm in Sunny Fields, and keeps it in his cellar. Spider silk for the wick: three good threads, from the spiders of the hills. And a flint: the old keepers struck their light with flint from a cave under the North Peaks\' south face. Bring a pick - and potions: the dead walk in that cave. Then climb the tower and light the {lamp}.',
      tooWeak: 'The lamp needs things from dangerous places, $name. Come back at level 8, and I will tell you.',
      done: 'The lamp burns every night now. The boats come home by it. Thank you, $name.',
    },
  },
  // Hermit Brannoc climbed the North Peaks when he was young: up through the cave and the old climbers' chimney inside
  // the mountain, to the eyrie of the great eagles. A feather from it, and he makes boots that walk like the wind.
  bone_chapel: {
    name: 'The Bone Chapel', giver: 'oak_ossian', level: 6, hidden: true, word: 'crest',
    reward: { xp: 350, gold: 60, items: [['bone_amulet', 1]] },
    summary: 'Help Brother Ossian, the ghost in the chapel of bones behind the crypt, make the crest of Oakvale whole again: three carved bones were lost.',
    steps: [
      { npc: 'oak_ossian', fetch: 'crest_jaw', word: 'jaw',
        summary: 'Find the carved jawbone of the crest: the rats dragged it off to their nest under the training yard (the sewers, at the east end of the tunnel under the main street).',
        progress: 'The jawbone, friend. The rats took it to their nest, under the training yard. Look in their heap of bones.',
        done: 'My jawbone! Gnawed, but whole. (He sets it into the crest with fingers you can see through.) Now the {knucklebone}: it was buried with the one who carved it, in the graveyard above. No stone on her grave: between Bertha Oakhart\'s and Sir Galen\'s. A {shovel} will find her.' },
      { thing: 'ossian_grave', give: [['crest_knuckle', 1]],
        summary: 'Dig with a shovel at the grave with no stone in the old graveyard, between Bertha Oakhart\'s stone and Sir Galen\'s.',
        done: 'Under the turf, in a little box of oak: a knucklebone, carved with a bell. Somebody loved this work.' },
      { thing: 'bone_crest', needs: [['crest_knuckle', 1], ['crest_skull', 1]], missing: 'The crest still has two holes in it.',
        summary: 'Take the carved skull from the cracked coffin in the hall of coffins (the skeletons will not like it), and set it and the knucklebone into the crest in the Bone Chapel.',
        done: 'The last pieces click into place. For a moment every candle in the chapel burns taller, and somewhere above you, faint as a memory, a bell rings once.' },
      { npc: 'oak_ossian', word: 'crest', summary: 'Tell Brother Ossian the crest is whole.' },
    ],
    text: {
      offer: 'You see the crest? Three of its bones are gone: the {jaw}, a knuckle and the skull at its heart. The rats, the grave, and the founders\' hall. My hands go through things now, friend. Would you find them for me? ({yes}/{no})',
      accept: 'Bless you. The jawbone first: the rats took it to their nest, under the training yard. Come back to me with it.',
      reward: 'Whole. Whole again, after all these years. (Ossian bows his head, and the candles bow with him.) Take this: I carved it the night the bell first rang, from a bone nobody claimed. It keeps the cold out. And friend... remember them.',
      tooWeak: 'The way here is guarded by the restless dead, friend. Grow a little stronger first: level 6, I would say.',
      done: 'Four thousand, two hundred and eleven... and a crest, whole. Go well, friend.',
    },
  },
  eagle_eyrie: {
    name: 'The Eagle\'s Eyrie', giver: 'oak_hermit', level: 9, hidden: true, word: 'eagle', fetch: 'eagle_feather',
    reward: { xp: 450, gold: 50, items: [['featherstep_boots', 1]] },
    summary: 'Bring Hermit Brannoc a feather from the old eagles\' eyrie, high on the North Peaks: through the cave under their south face, and up the chimney inside the mountain.',
    text: {
      offer: 'The eagles... When I was young I climbed the North Peaks, all the way to the eyrie, where the great eagles nested. They are gone now. But their feathers keep - and a feather of theirs, sewn into a boot, and you walk like the wind. Bring me one, and I will make you a pair. ({yes}/{no})',
      accept: 'There is no way up the outside. The way is through the cave under the south face, where the shades walk: fallen rock blocks it, so bring a pick. At its end the old climbers cut a chimney up inside the mountain, with ladders. The nest is on the shoulder of the highest peak. Bring me a {feather} - and come at night.',
      progress: 'A feather from the eyrie, $name. Through the cave under the south face of the North Peaks, a pick for the fallen rock, and up the climbers\' chimney.',
      reward: 'A feather of the great eagles... I had almost forgotten how grey they are. Sit, sit. (The hermit works by the fire, needle and sinew, and before long hands you a pair of boots, light as nothing.) Featherstep boots. You will walk quicker in them. Walk softly near my bears.',
      tooWeak: 'The peaks would kill you, $name. Come back at level 9, and we will talk of eagles.',
      done: 'Do the boots fit? They will. The eagles\' feathers know the wind.',
    },
  },
});

Object.assign(NPCS, {
  // Old Maddock of Fisher's Rest: he fishes off his jetty, sells rods, and tells his sister's tale (Tidecutter)
  rest_fisher: {
    name: 'Old Maddock',
    look: { skin: '#c89a70', hair: '#d8d4cc', beard: '#d8d4cc', body: '#3a5a6a', arms: '#3a5a6a', legs: '#4a3a28', feet: '#2a1a0a', belt: '#5a3a1a', hat: { style: 'wide', color: '#4a5a3a' } },
    greet: 'Mind the nets, $name. Old Maddock, of Fisher\'s Rest. Sit a while, if you like a {tale}. Or do you {fish}?',
    keywords: {
      job: 'I fish. Fifty years now. The sea gives and the sea takes, and I let her.',
      'fish|fishing|rod': 'Use a rod on the water, any water. Mostly fish. Now and then an old boot - or a pearl, or a bottle with a letter in it. The sea keeps odd things. I sell rods, if you want to {trade}.',
      'bottle|message|letter': 'A letter in a bottle? Read it, then. The sea only gives those to the ones it means them for.',
      'beach|dig|sand|shovel': 'The tide buries things on the beaches. Where the sand lies loose, dig: shells, a few coins, now and then better. The next tides fill it in again.',
      'lighthouse|tamsin|light|lamp': { after: 'tidecutter', text: 'You have the luck of the sea, $name. Use it: the new lighthouse on the point has never been lit, and every winter a boat goes on the rocks for want of it. Ask Keeper Tamsin about the {lighthouse}.',
        before: 'Tamsin keeps a fire at Lighthouse Point, south of the fields. The new tower there has never shown a light. Shame.' },
    },
    trade: { sells: [['fishing_rod', 110], ['fish', 4]], buys: ['jewelry'] },
    chatter: ['The tide is turning.', 'Fish are biting today.', 'The sea keeps what she takes.'],
  },
  // Farmer Odo of the Sunny Fields farm: wheat, the mill, and lamp oil, kept in a cellar the rats have taken (The Keeper's Light)
  fields_farmer: {
    name: 'Farmer Odo',
    look: { skin: '#e0a878', hair: '#8a6a3a', beard: '#8a6a3a', body: '#6a7a3a', arms: '#e0a878', legs: '#5a4a2a', feet: '#3a2a1a', belt: '#3a2a1a', hat: { style: 'wide', color: '#c8a858' } },
    greet: 'Morning, $name! Odo\'s the name, and this is my farm. Mind the {rats}: they are everywhere this year. And somebody\'s been at my {carrots}! Want some fresh food? Just ask to {trade}.',
    keywords: {
      job: 'I grow wheat, I press oil, and the rats eat half of both.',
      'carrots|carrot|rabbits|rabbit|bandit|patch|quest|mission|task': { quest: ['carrot_bandit'] },
      'rats|rat|cellar|trapdoor': 'Rats in the fields, and worse in my cellar: big ones, as long as your arm. They came up from somewhere and moved in under my floor. The trapdoor is inside the house, if you are brave.',
      'oil|lamp|jar|jars': 'Lamp oil? I press it from the seed, and the jars are in my cellar, under the trapdoor in the house. If Tamsin sent you for her lighthouse, take a jar and welcome - if the rats down there let you.',
      'mill|windmill|wheat|flour': 'The mill grinds my wheat, and Baker Willa buys the flour. When the wind blows, that is.',
      'lighthouse|tamsin': 'Tamsin? A good woman. She keeps a fire out on the point, for the boats, since the new tower has never been lit.',
    },
    trade: { sells: [['apple', 2], ['bread', 4], ['cheese', 3]], buys: [] },
    chatter: ['Shoo, rats!', 'Good weather for the wheat.', 'The mill wants wind.'],
  },
});
// The quartermaster in Oakvale's Watch House keeps the same stores as the captain at the north gate (watch marks)
NPCS.oak_quartermaster.keywords['marks|mark|stores|shop|reward|potions|mana|life|keeping|feather|gull|jay|cloak|ember|moss'] =
  NPCS.gate_north.keywords['marks|mark|stores|shop|reward|potions|mana|life|keeping|feather|gull|jay|cloak|ember|moss'];
