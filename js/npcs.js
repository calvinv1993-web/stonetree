'use strict';
// NPCs (dialog, trade, services), quests, raids and lore. All plain data, so it
// can be changed in the data editor (data.html).
//
// Dialog: an NPC answers keywords ('quest|mission' matches either word).
// {word} in a reply is a clickable keyword and $name is the player's name.
// A keyword's answer is a text, or a service:
//   { quest: [ids] }         offer / track / reward the first unfinished quest of the chain
//   { heal: true }           heal the player
//   { destiny: true }        the Seer's vocation talk; { vocation: 'knight' } chooses one
//   { bank: true }           deposit <amount|all>, withdraw <amount>, balance
//   { travel: { name, to: {x, y, z}, cost } }
//   { promote: { level, cost } }
//   { bless: { cost, perLevel } }   protects your things the next time you die
//   { houses: true }         rent a house (say its name), "leave" gives it back
//   { forge: true }          open the forge (the NPC needs forge: true as well; see game-forge.js)
//   { citizen: true }        become a citizen of the NPC's town (its home): you wake up in its temple when you die

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
// word: the word to ask about it (or a step's own word), when the NPC's keyword has several.
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
const RAIDS = [
  { name: 'orc warband', message: 'An orc warband is marching on Valoria from the north-east!', at: { x: 121, y: 37, z: 4 }, spawns: [['orc', 6], ['orc_archer', 3], ['orc_shaman', 2]] },
  { name: 'pirate landing', message: 'Pirates are landing on the beaches of Ashport!', at: { x: 42, y: 101, z: 4 }, spawns: [['pirate', 5], ['crab', 4]] },
  { name: 'restless dead', message: 'The dead are stirring in the graveyard of Brightwater!', at: { x: 20, y: 50, z: 4 }, spawns: [['skeleton', 5]] },
];
const RAID_INTERVAL = [15 * 60000, 25 * 60000];

// What you read on the bookshelves of the world.
const LORE = [
  'A chronicle: "And the first Grandmaster bound Vharzul the Ashen beneath the burning mountain, and broke the seal\'s fire into five embers, that no one hand might hold it."',
  'A hymnal, its pages grey with ash: "Five embers shall gutter, and He shall wake." Someone has scratched out the last page.',
  'A sailor\'s log: "Saw a light under the waves off Ashport, burning. The crew says it is the drowned king\'s crown."',
  'A dwarven ledger: "Vault of the Stone Ember: inspected. Golems at their posts. All is well." The pages after it are torn out.',
  'A dusty book: "The four paths - steel, arrow, flame and leaf - all begin on Brightwater Isle."',
  'A ledger: "Paid the pirates 300 gold for safe passage. Again."',
  'A book of maps. Someone has drawn a skull on the sea west of Ashport.',
  'A treatise on runes: "A blank rune holds nothing until a mage speaks its form into it."',
  'A cookbook. Most recipes involve fish.',
  'A sailor\'s almanac: "Gull\'s Wake, lost off Brightwater Isle with all hands. Her captain\'s sword was never recovered."',
];

const ASHPORT = { x: 53, y: 93, z: 4 }, VALORIA_PIER = { x: 79, y: 72, z: 4 }, GREYMOOR_PIER = { x: 226, y: 13, z: 4 };

// Every port's captain sails to every other port; the fare goes by distance.
// key: what you say ({...} is the clickable word in the captain's greeting).
// Where a ship from elsewhere puts you ashore: the town square, beside the fountain.
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
      knight: { vocation: 'knight' },
      paladin: { vocation: 'paladin' },
      sorcerer: { vocation: 'sorcerer' },
      druid: { vocation: 'druid' },
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
    keywords: { job: 'I make bows and arrows. Paladins are my best customers.' },
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
      'wand|wands|rod|rods': 'Wands are for sorcerers, rods for druids. Each shot costs a little mana.',
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
      'adventure|news|rumours|rumors': 'My cousin swears he saw a flying carriage over the Webwood, with two boys in it screaming. Spiders everywhere. He has stopped drinking since.',
    },
    chatter: ['Morning!', 'Have you seen the prices at the market?', 'My back is killing me.', 'Fine day, fine day.', 'I could have been an adventurer, you know.', 'Where did I leave my keys?'],
  },
  townswoman: {
    name: 'Townswoman', wander: 6,
    look: { skin: '#f0c8a0', hair: '#8a4a2a', hairStyle: 'long', female: true, body: '#7a3a6a', arms: '#7a3a6a', legs: '#4a3a5a', feet: '#3a2a1a', belt: '#e8d8b0', robe: true, trim: '#e8d8b0' },
    greet: 'Oh, hello there, $name. Are you new in {town}?',
    keywords: {
      job: 'I keep house, and an eye on the neighbours. Somebody has to.',
      'town|news|rumours|rumors': 'They say the goblins at the Glintvault Bank count every coin twice, and the dragon in the vault counts the goblins.',
    },
    chatter: ['Such a nice day for washing.', 'Have you heard the latest?', 'Children! Supper!', 'The baker burnt the bread again.', 'Those adventurers track mud everywhere.'],
  },
  child: {
    name: 'Child', wander: 5, idle: 1200,
    look: { scale: 0.72, skin: '#f0c8a0', hair: '#c88a3a', hairStyle: 'short', body: '#3a6ab0', arms: '#3a6ab0', legs: '#5a4a3a', feet: '#3a2a1a', belt: '#3a2a1a' },
    greet: 'Are you a real adventurer? Have you killed a {dragon}?',
    keywords: {
      dragon: 'Wooow. When I grow up I am going to fight a hundred dragons. Or maybe be a baker.',
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
      story: 'In my day we had no cabs or balloons. We walked! Uphill! Both ways! And the rats were the size of ogres.',
      'kenny|orange': 'The lad in the orange hood? Do not bother. I have seen him killed nine times this week. He always comes back.',
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
      [`${word}|task|quest|mission|help`]: { quest: [quest] },
      job: 'I keep this gate, and what comes through it.',
      'directions|gate|road': gate,
      'dangers|monsters|news': 'The further from town, the worse it gets: rats in the fields, wolves and slimes beyond, then spiders and goblins. Bears in the deep woods. Know when to run.',
    },
    chatter: ['All quiet at the gate.', 'Keep your weapon ready out there.', 'Wolves again last night.', 'Mind the road.'],
  };
}

// ---- Oakvale Isle: the people of the starter town, and its beginner story --------------------------
// "The Silent Bell": the bell of Oakvale has stopped ringing. Its chapters climb in danger with the player:
//   I (level 1)   a newcomer learns the town and the game: the priestess, the academy, rats, the depot, Pip
//   (the gate watch, level 2-5, gives the gear for what comes next: see below)
//   II (level 5)  the crypt under Bone Rocks: clear the hall of coffins, take one of the founders' weapons,
//                 and find a note: someone cut the bell's rope, threw it down the shaft, and keeps its clapper
//   III (level 6) after the rope, deep under the town: the drains full of giant rats, the cistern slime
//   IV (level 8)  the Gravewaker, in the founder's tomb below the crypt: the clapper, and the bell rings again
// Kill steps out in the wilds are done as soon as they're done (auto), and the chests along the way only open
// once you've done them (requires 'quest@step'): nobody gets the gear by running past the monsters.
Object.assign(QUESTS, {
  bell_1: {
    name: 'The Silent Bell I: A Stranger in Oakvale', story: 'The Silent Bell', giver: 'ama', level: 1, word: 'bell',
    reward: { xp: 120, gold: 40, items: [['backpack', 1], ['rope', 1]] }, // a backpack: 20 places instead of the bag's 8
    summary: 'Sister Ama in the Temple of the Dawn wants you to learn the ways of Oakvale. Go to Master Corwin at the academy.',
    steps: [
      { npc: 'corwin', summary: 'Visit Master Corwin at the academy, over the bridge west of the square.',
        progress: 'Master Corwin teaches at the academy, over the bridge west of the square.',
        done: 'Sister Ama sent you? Good. Before I teach you anything, show me you can hold a weapon. Rats have been running wild in {Sunny Fields}, out of the south gate. Kill five of them, then come back and tell me about the {bell} again.' },
      { npc: 'corwin', kill: { rat: 5 }, summary: 'Kill 5 rats in Sunny Fields, out of the south gate, and report to Master Corwin.',
        progress: 'So far you have killed $progress. The rats are in the fields south of town.',
        done: 'Five rats! You will do. Now: everything you carry can be lost when you die. Go to the depot east of the temple and ask Postmaster Hobb about your {locker}.' },
      { npc: 'postmaster', summary: 'Ask Postmaster Hobb in the depot, east of the temple, about your locker.',
        progress: 'The depot is the slate-roofed house at the east end of the square, south of the bell tower.',
        done: 'Your locker? Open any locker here and it is yours - and it is the same locker in every town. Put what you treasure in it. Now, would you take a letter to Pip at the provisions shop on the main street? Give him the {letter} and he will know it is from me.' },
      { npc: 'pip', summary: 'Bring the postmaster\'s letter to Pip at Pip\'s Provisions, on the main street.',
        progress: 'Pip\'s Provisions is on the main street, south of the square, with a rope on its sign.',
        done: 'A letter for me? Thank you! Here is a tip, newcomer: I {trade} anything you find on monsters, and no adventurer should leave town without a rope and a shovel. Now go back to Sister Ama in the temple and tell her about the {bell} - she was worried about something.' },
      { npc: 'ama', summary: 'Go back to Sister Ama in the temple.',
        progress: 'Sister Ama waits in the Temple of the Dawn, on the mount north of the square.' },
    ],
    text: {
      offer: 'Welcome to Oakvale, $name. You woke here, as everyone new to this isle does. But listen... our temple {bell} has not rung for three days. Before you can help with that, you must learn our ways. Will you? ({yes}/{no})',
      accept: 'Good. Go down the steps, cross the square to the west and over the bridge to the academy. Master Corwin teaches there: tell him about the {bell}, and that I sent you.',
      reward: 'You have met half the town already, $name - and you are still alive. Take this rope; you will need it. As for the bell... I fear something is down in the dark beneath us, and you are not ready for it yet. Grow stronger first: the guards at the town gates have work for you, and good gear to give. Start with Sergeant Bram at the west gate, and ask him about the {wolves}.',
      done: 'The bell is still silent, $name. Grow stronger at the town gates; Master Corwin will send for you when you are ready.',
    },
  },
  bell_2: {
    name: 'The Silent Bell II: Under Bone Rocks', story: 'The Silent Bell', giver: 'corwin', level: 5, word: 'crypt',
    reward: { xp: 300, gold: 60, items: [['health_potion', 3]] },
    summary: 'Go down into the founders\' crypt under Bone Rocks and find out who broke in.',
    steps: [
      { auto: true, kill: { skeleton: 6 }, summary: 'Go down into the founders\' crypt under Bone Rocks (south-west, at the end of the bone trail) and clear the hall of coffins: kill 6 skeletons.',
        progress: 'The crypt lies under Bone Rocks, south-west of town: steps lead down at the foot of the crag. So far: $progress.',
        done: 'The hall of coffins falls quiet. By its north wall stand three stone chests - the founders\' arms, one for each who dares - and by the iron gate to the tomb stairs lies a torn scrap of paper.' },
      { npc: 'corwin', fetch: 'torn_note', word: 'note', summary: 'Take one weapon from the stone chests in the hall of coffins, pick up the torn note by the iron gate, and bring the note to Master Corwin.',
        progress: 'A note, by the gate to the tomb? Bring it to me. And take a weapon from the founders\' chests while you are down there: they would want it used.',
        done: '"...the rope is cut, and down the shaft it went, to the rats. The clapper stays with me, below. When the bell is silent, the dead wake. - G." So it was no accident, $name. Someone silenced our bell to wake the dead of the crypt. Sister Ama must hear this: tell her about the {rope}.' },
    ],
    text: {
      offer: 'You have grown strong at the gates, $name. Now listen: lights have been seen at Bone Rocks at night, and the seal of the founders\' crypt beneath it is broken. Someone went down there - and our bell fell silent the same night. Will you go and see? ({yes}/{no})',
      accept: 'Follow the bone trail from the south road, south-west to Bone Rocks; steps at the foot of the crag lead down. Skeletons walk the hall of coffins. Before you go: Armourer Brenna at Hide and Iron sells armour, Pip sells health potions - take five at least - and Sister Ama heals anyone who comes back hurt. When you have something to show me, tell me about the {crypt}.',
      tooWeak: 'The crypt is no place for you yet, $name. Grow stronger at the town gates - the guards have work for you - and come back at level 5.',
      elsewhere: 'Master Corwin at the academy wants to see you about the crypt under Bone Rocks.',
      done: 'The note named the rope and the clapper. Sister Ama will know what to do.',
    },
  },
  bell_3: {
    name: 'The Silent Bell III: Teeth in the Dark', story: 'The Silent Bell', giver: 'ama', level: 6, word: 'rope',
    reward: { xp: 300, gold: 80, items: [['health_potion', 3]] },
    summary: 'Find the bell\'s rope, at the bottom of the bell shaft deep under the town.',
    steps: [
      { auto: true, kill: { giant_rat: 8 }, summary: 'Climb down a sewer grate, find the rats\' nest under the graveyard and its trapdoor down, and clear the old drains below: kill 8 giant rats.',
        progress: 'The rats\' nest is under the graveyard, at the east end of the sewers; a trapdoor in it leads down to the old drains. So far: $progress.',
        done: 'The old drains fall quiet. A trapdoor leads on down, and from the dark below comes the sound of something big moving in water.' },
      { auto: true, kill: { cistern_slime: 1 }, summary: 'Go down the trapdoor in the old drains to the deep cistern, and kill the great slime that keeps the narrow way east.',
        progress: 'The cistern slime keeps the narrow way east, at the bottom of the sewers. It poisons: take potions.',
        done: 'The great slime bursts and seeps away into the cracks. The narrow way east is open: beyond it lies the bottom of the bell shaft.' },
      { npc: 'ama', fetch: 'chewed_rope', summary: 'At the bottom of the bell shaft, east of the cistern, find the bell\'s rope and bring it to Sister Ama.',
        progress: 'The rope lies at the bottom of the bell shaft, east of the deep cistern.',
        done: 'Our rope... cut clean with a blade, then gnawed by the rats. So the note spoke true. And the clapper "stays with me, below": below the crypt, $name, in the founder\'s tomb itself. Whoever this G is, he waits down there for the dead to wake. He will be stronger than anything you have faced. When you are level 8, ask me about the {gravewaker}.' },
    ],
    text: {
      offer: 'Master Corwin told me about the note. So our rope lies at the bottom of the bell shaft, under the town... The rats have dug their way down there, $name, and worse lives in the deep cistern. Will you bring our rope home? ({yes}/{no})',
      accept: 'Go down a grate into the sewers and east to the rats\' nest under the graveyard: a trapdoor there leads down to the old drains, and another to the cistern. This is the most dangerous place on the isle for one of your strength. Eat well, carry health potions from Pip, get the best armour Brenna has, and come back to me if you are hurt: I will {heal} you. Bring me the {rope}.',
      tooWeak: 'Under the town is no place for you yet, $name. Come back at level 6.',
      elsewhere: 'Sister Ama in the temple wants to know what you found in the crypt.',
      done: 'We have our rope again. But the bell is still silent without its clapper.',
    },
  },
  bell_4: {
    name: 'The Silent Bell IV: The Gravewaker', story: 'The Silent Bell', giver: 'ama', level: 8, word: 'gravewaker',
    reward: { xp: 400, gold: 150, items: [['chain_armor', 1], ['health_potion', 3]], bell: true },
    summary: 'Go down to the founder\'s tomb under Bone Rocks, defeat the one who silenced the bell, and bring its clapper home.',
    steps: [
      { auto: true, kill: { gravewaker: 1 }, summary: 'Go back down into the crypt under Bone Rocks: the iron gate to the tomb stairs will open for you now. In the founder\'s tomb below, defeat the Gravewaker.',
        progress: 'The tomb lies below the hall of coffins, past the iron gate. The Gravewaker waits there with the dead he woke.',
        done: 'The Gravewaker falls, and the tomb grows still. In the open coffin of the founder, something of bronze glints.' },
      { npc: 'ama', fetch: 'bell_clapper', word: 'clapper', summary: 'Take the bell\'s clapper from the founder\'s tomb and bring it to Sister Ama.',
        progress: 'The clapper lies in the founder\'s open tomb.',
        done: 'The clapper of our bell! Cold as the grave... The founders cast this bell to keep their dead asleep, and while it was silent, they woke. Help me hang it again... There. Listen! The bell of Oakvale rings again, and the dead under Bone Rocks will sleep. Take this armour, $name: you have earned it. Once you are level 10, the {oracle} upstairs in the academy will send you on to what lies beyond this isle.' },
    ],
    text: {
      offer: 'The rope is home, $name, but the bell is dumb without its clapper - and the one who took it waits in the founder\'s tomb. The Gravewaker, the old stories call such a one. Will you face him? ({yes}/{no})',
      accept: 'The iron gate to the tomb stairs, in the crypt, will open for you now. He throws poison and raises the dead around him: fight the dead first, keep your health high, and bring many potions - ten would not be too many. Brenna\'s best armour, and food. Then bring me the {clapper}.',
      tooWeak: 'The Gravewaker would kill you, $name. Grow stronger - come back at level 8.',
      elsewhere: 'Sister Ama in the temple wants to see you about the bell.',
      done: 'The bell rings again, thanks to you. At level 10, go and see the oracle upstairs, $name.',
    },
  },
});

// The gate watch of Oakvale: each guard has a task out in the wilds beyond his gate, a piece of gear for it, and
// sends you on to the next gate. Together they lead a newcomer from level 2 to the crypt at level 5.
Object.assign(QUESTS, {
  gate_west: {
    name: 'The Gate Watch: Wolves at the West Gate', giver: 'gate_west', level: 2, kill: { wolf: 8 },
    reward: { xp: 250, gold: 30, items: [['leather_armor', 1]] },
    summary: 'Kill 8 wolves in Wolf Woods, out of the west gate and north-west, and report to Sergeant Bram at the west gate.',
    text: {
      offer: 'You look like you can swing that thing, $name. The wolves of Wolf Woods have grown bold - they come right up to the west road at night. Thin them out for me? Eight will do. ({yes}/{no})',
      accept: 'Good. Out of the west gate, over the bridge, then north-west into the pines. They hunt in packs: never fight three at once if you can help it, and carry a health potion or two from Pip. Come back and tell me about the {wolves}.',
      progress: 'So far: $progress. Wolf Woods lies north-west of the west gate.',
      reward: 'Eight wolves! The road will be quieter tonight. Here - a leather jerkin; it has kept better men than me alive. Now, Guard Tilda at the south gate has been grumbling about {crabs}. Ask her about them.',
      tooWeak: 'Wolves would tear you apart, friend. Come back at level 2.',
      done: 'The road is quieter since you came. Guard Tilda at the south gate could use a hand with the {crabs}.',
    },
  },
  gate_south: {
    name: 'The Gate Watch: Crabs on the Beach', giver: 'gate_south', level: 3, after: 'gate_west', kill: { crab: 6 },
    reward: { xp: 300, gold: 30, items: [['leather_legs', 1]] },
    summary: 'Kill 6 crabs on the beaches of Lighthouse Point (down the south road) or by Fisher\'s Rest, and report to Guard Tilda at the south gate.',
    text: {
      offer: 'Crabs, $name. Big ones, snapping at the fishermen\'s nets on the beaches. I can\'t leave my gate. Would you kill six of them for me? ({yes}/{no})',
      accept: 'Down the south road, all the way to Lighthouse Point: the beaches there are crawling with them. Their shells are hard - hit them, and keep hitting. Then come back and tell me about the {crabs}.',
      progress: 'So far: $progress. The beaches are at the end of the south road.',
      reward: 'Six crabs, and you still have all your fingers! These leggings will keep the pincers off. Guard Hilde at the east gate keeps talking about {spiders} - see her next.',
      tooWeak: 'Those pincers would snap you in two. Come back at level 3.',
      notYet: 'One thing at a time, friend. Sergeant Bram at the west gate has work for you first.',
      done: 'The nets are safe again. Guard Hilde at the east gate has trouble with {spiders}.',
    },
  },
  gate_east: {
    name: 'The Gate Watch: Spiders in the East', giver: 'gate_east', level: 4, after: 'gate_south', kill: { spider: 8 },
    reward: { xp: 450, gold: 40, items: [['chain_helmet', 1]] },
    summary: 'Kill 8 spiders in Thorn Thicket or round the Spider Hills (south-east), and report to Guard Hilde at the east gate.',
    text: {
      offer: 'Spiders, $name. They spin their webs over the trails in the south-east, and their bite burns. Kill eight for me and you shall have a proper helmet. ({yes}/{no})',
      accept: 'Take the spider trail south from the east road, or go through Thorn Thicket south of Sunny Fields. Their poison burns: carry potions. Then come back and tell me about the {spiders}.',
      progress: 'So far: $progress. Thorn Thicket and the Spider Hills are south-east of town.',
      reward: 'Eight! You fight like a guard already. Take this helmet - it was mine, when I was younger. Captain Osric at the north gate has a harder task, about {goblins}. He only asks the best.',
      tooWeak: 'Their poison would finish you. Come back at level 4.',
      notYet: 'One thing at a time, friend. Guard Tilda at the south gate has work for you first.',
      done: 'The trails are clearer now. Captain Osric at the north gate wants to talk to you about {goblins}.',
    },
  },
  gate_north: {
    name: 'The Gate Watch: Goblins in the North', giver: 'gate_north', level: 5, after: 'gate_east', kill: { goblin: 8 },
    reward: { xp: 700, gold: 60, items: [['studded_shield', 1], ['health_potion', 2]] },
    summary: 'Kill 8 goblins on Stony Field (up the north road) or on Goblin Hill (north-east), and report to Captain Osric at the north gate.',
    text: {
      offer: 'So you are the one the gate watch keeps talking about. Goblins, $name: scouts on Stony Field, and a whole camp on Goblin Hill. They grow bolder. Kill eight of them. ({yes}/{no})',
      accept: 'Stony Field is up the north road, below the North Peaks. Goblin Hill lies north-east, past Mirror Lake. They hit hard and they fight together. Then come back and tell me about the {goblins}.',
      progress: 'So far: $progress. Stony Field is up the north road; Goblin Hill is north-east.',
      reward: 'Eight goblins. You have earned this shield, and my respect. You are ready for worse things now: Master Corwin at the academy has been asking for someone who dares go down into the {crypt} under Bone Rocks.',
      tooWeak: 'Goblins are no rats, friend. Come back at level 5.',
      notYet: 'One thing at a time, friend. Guard Hilde at the east gate has work for you first.',
      done: 'Master Corwin at the academy needs someone brave enough for the crypt under Bone Rocks.',
    },
  },
});

Object.assign(NPCS, {
  ama: {
    name: 'Sister Ama',
    look: { skin: '#e8c4a0', hair: '#8a5a2a', body: '#f0ead8', arms: '#f0ead8', legs: '#f0ead8', belt: '#d8a830', robe: true, hat: { style: 'hood', color: '#e8e0c8' } },
    greet: 'Peace be with you, $name, and welcome to {Oakvale}. I tend this temple. Ask me about the {bell}, or if you are hurt I can {heal} you.',
    keywords: {
      job: 'I keep the Temple of the Dawn. Everyone who comes to this isle wakes here first - and again after each death.',
      oakvale: 'A small town, but a good one. The {academy} is west over the bridge, the {depot} is east of this mount, and the shops line the main street to the south.',
      'bell|quest|mission|task|help|rope|cellar|clapper|gravewaker': { quest: ['bell_1', 'bell_2', 'bell_3', 'bell_4'] },
      'stone|seal': 'Show the stone to Master Corwin at the academy. He knows old things.',
      'oracle|vocation|mainland': 'The oracle lives upstairs in the academy. She lets you choose a vocation at level 10.',
      sewers: 'Under the grates in the streets. The old bell cellar under this temple can only be reached through them now.',
      'academy|corwin|teacher': 'Master Corwin teaches newcomers at the academy, over the bridge west of the square.',
      depot: 'The depot is the slate-roofed house at the east end of the square, below the bell tower. The postmaster will explain your locker.',
      heal: { heal: true },
    },
  },
  corwin: {
    name: 'Master Corwin',
    look: { skin: '#e0b088', hair: '#9a9aa0', beard: '#9a9aa0', body: '#2a4a6a', arms: '#2a4a6a', legs: '#2a2a3a', belt: '#8a6a3a', robe: true },
    greet: 'Ah, a new face. I am Master Corwin, and this is the academy. Ask me about {fighting}, {loot}, {skills}, {spells}, {tools} or {food} - or about the {oracle} upstairs.',
    keywords: {
      job: 'I teach newcomers how to stay alive on this isle.',
      'bell|quest|mission|task|ama|crypt|note': { quest: ['bell_1', 'bell_2', 'bell_3', 'bell_4'] },
      'torchlight|light|dark': 'At level 2 you can light your way: say "lumen" (or use the spell button), and you glow like a torch for three minutes. It costs 15 mana.',
      'bone|rocks': 'Bone Rocks is the crag south-west of town, at the end of the bone trail. The founders\' crypt lies beneath it, sealed for a hundred years. Nobody goes there.',
      'sewers|grate|grates': 'The grates in the streets lead down into the sewers. Rats, mostly - and some big ones where the walls have fallen in, under the graveyard.',
      'fighting|fight': 'Tap or click a monster to attack it. Put on what you find: drag weapons and armour onto your equipment. Drink a potion or eat when you are hurt, and run if you must - there is no shame in it.',
      'loot|corpse': 'When a monster dies, open its corpse and take what you need. Sell the rest at Pip\'s or the smithy.',
      skills: 'Every weapon trains its skill as you use it, and a shield trains when you are hit. Spending mana trains your magic.',
      spells: 'You learn your first spells as you grow: Torchlight at level 2, Light Heal at level 3. Your {vocation} teaches you more.',
      tools: 'A rope gets you up through holes, a shovel digs loose sand, a pick breaks cracked rock. Pip sells them.',
      'food|eat|hungry': 'Eat, and you get your health and mana back much faster. The Warm Loaf sells bread.',
      'oracle|vocation|mainland': 'The oracle lives upstairs. At level 10 she lets you choose a vocation and sends you to the mainland - and you never come back.',
      'sunny|fields|rats': 'Sunny Fields lie south of town, out of the south gate. The rats there are a good first fight.',
    },
  },
  oak_oracle: {
    name: 'The Oracle',
    look: { skin: '#e8d0b8', body: '#4a2a6a', arms: '#4a2a6a', legs: '#4a2a6a', belt: '#d0b040', robe: true, hat: { style: 'hood', color: '#3a1e5a' } },
    greet: 'I have been waiting for you, $name. Shall I reveal your {destiny}?',
    keywords: {
      job: 'I see the paths that lie before those who come here.',
      'destiny|vocation': { destiny: true },
      knight: { vocation: 'knight' }, paladin: { vocation: 'paladin' }, sorcerer: { vocation: 'sorcerer' }, druid: { vocation: 'druid' },
    },
  },
  postmaster: {
    name: 'Postmaster Hobb',
    look: { skin: '#f0c8a0', hair: '#5a3a1a', body: '#3a5a8a', arms: '#3a5a8a', legs: '#2a2a3a', belt: '#c0a040', hat: { style: 'wide', color: '#2a3a5a' } },
    greet: 'Good day, $name! Letters, parcels, and your {locker}. What can I do for you?',
    keywords: {
      job: 'I run the depot and the post.',
      'locker|letter|quest|mission|task': { quest: ['bell_1'], otherwise: 'Open any locker here and it is yours. What you put in it is safe - and you find the same locker in every town\'s depot.' },
      depot: 'Open any locker here and it is yours. What you put in it is safe - and you find the same locker in every town\'s depot.',
    },
  },
  pip: {
    name: 'Pip',
    look: { skin: '#f0c090', hair: '#c87a2a', body: '#4a7a3a', arms: '#f0c090', legs: '#6a4a2a', belt: '#3a2a1a' },
    greet: 'Hello $name, welcome to Pip\'s Provisions! Food, potions, rope and shovels - just ask to {trade}. I buy what you find on monsters, too.',
    keywords: {
      job: 'I sell everything an adventurer needs, and buy what they bring back.',
      'letter|quest|mission|task': { quest: ['bell_1'] },
      'tip|tips': 'Never leave town without a rope and a shovel. And sell your loot before your bag gets too heavy.',
    },
    trade: {
      sells: [['apple', 3], ['bread', 5], ['meat', 8], ['health_potion', 25], ['mana_potion', 50], ['backpack', 60], ['rope', 50], ['shovel', 50],
        ['pick', 50], ['fishing_rod', 120]],
      buys: ['loot', 'tools'],
    },
  },
  oak_smith: {
    name: 'Smith Dunstan',
    look: { skin: '#d89868', hair: '#2a1a0a', beard: '#2a1a0a', body: '#5a3a1a', arms: '#d89868', legs: '#3a3a40', belt: '#2a1a0a' },
    greet: 'Welcome to the Dented Shield, $name. Weapons, bought and sold - want to {trade}?',
    keywords: { job: 'I make weapons, and I buy the ones you find.', 'mace|best': 'My mace is the best weapon on the isle: heavy, honest iron. Four hundred and fifty gold, and worth every coin if you mean to go down into the crypt.' },
    trade: { sells: [['wooden_club', 10], ['dagger', 18], ['hatchet', 30], ['short_sword', 45], ['spear', 8], ['mace', 450]], buys: ['gear', 'distance'] }, // the mace: for those who save up
  },
  oak_armourer: {
    name: 'Armourer Brenna',
    look: { skin: '#e8b890', hair: '#a83a1a', body: '#6a6a72', arms: '#e8b890', legs: '#4a4a52', belt: '#2a1a0a' },
    greet: 'Hide and Iron, at your service, $name. Helmets, armour and shields - shall we {trade}?',
    keywords: { job: 'I make armour that keeps young adventurers in one piece.' },
    trade: { sells: [['wooden_shield', 15], ['leather_cap', 12], ['leather_armor', 35], ['leather_legs', 25], ['leather_boots', 15], ['chain_helmet', 180], ['chain_legs', 300], ['chain_armor', 500]], buys: ['gear'] },
  },
  oak_mage: {
    name: 'Moonpetal',
    look: { skin: '#f0d8c0', hair: '#d8d8f0', body: '#5a3a8a', arms: '#5a3a8a', legs: '#5a3a8a', belt: '#c0a0e0', robe: true, hat: { style: 'pointy', color: '#4a2a7a' } },
    greet: 'Welcome to my little shop, $name. Potions, runes and wands - would you like to {trade}?',
    keywords: { job: 'I sell magic to those who are ready for it. Most of it is for after you choose a vocation.' },
    trade: { sells: [['health_potion', 25], ['mana_potion', 50], ['blank_rune', 10], ['rune_heal', 40]], buys: ['magic', 'jewelry'] },
  },
  // The gate watch: a guard at each of Oakvale's gates, each with a task beyond it (see the gate quests).
  gate_west: gateGuard('gate_west', 'Sergeant Bram', '#5a3a1a', 'wolves', 'The west gate: out over the bridge to Frog Marsh and Wolf Woods.'),
  gate_south: gateGuard('gate_south', 'Guard Tilda', '#a8582a', 'crabs', 'The south gate: Sunny Fields, then the south road to Lighthouse Point. The bone trail branches off west to Bone Rocks.'),
  gate_east: gateGuard('gate_east', 'Guard Hilde', '#d8c070', 'spiders', 'The east gate: Deer Woods, the Old Tower, and the spider trail south to the Spider Hills.'),
  gate_north: gateGuard('gate_north', 'Captain Osric', '#3a3a3a', 'goblins', 'The north gate: Mirror Lake, Stony Field and the North Peaks. Goblin Hill is north-east, past the lake.', true),
  oak_baker: {
    name: 'Baker Willa',
    look: { skin: '#f0c8a0', hair: '#e0c070', body: '#f0e8d8', arms: '#f0c8a0', legs: '#8a5a3a', belt: '#f0e8d8' },
    greet: 'Fresh bread, $name! Eat well, heal fast. Want to {trade}?',
    keywords: { job: 'I bake for the whole town. Eating makes you heal much faster, you know.' },
    trade: { sells: [['bread', 4], ['cheese', 3], ['apple', 2], ['meat', 7]], buys: ['loot'] },
  },
  oak_innkeeper: {
    name: 'Innkeeper Rolf',
    look: { skin: '#e0a878', hair: '#6a4a2a', beard: '#6a4a2a', body: '#8a5a2a', arms: '#e0a878', legs: '#4a3a2a', belt: '#2a1a0a' },
    greet: 'Welcome to the Sleepy Boar, $name! A meal, a drink, and the best {rumours} on the isle. Want to {trade}?',
    keywords: {
      job: 'I keep the Sleepy Boar.',
      'rumours|rumors|news|bell': 'They say the temple bell went quiet the night the rats came up through the grates. And old Wim\'s gravestone says he went down the well for a bet... nobody knows what he found.',
      'graveyard|gravestone|grave': 'The old graveyard is behind my inn. Read the stones - some say more than they seem to.',
    },
    trade: { sells: [['bread', 4], ['cheese', 3], ['meat', 7], ['fish', 5], ['health_potion', 45]], buys: ['loot'] },
  },
});
