# Story and retention plan

A plan for the story after The Silent Bell, and for the systems that make players come back. It's a proposal for the owner to approve phase by phase, like `docs/world-plan.md`. Nothing here is built yet.

## How it was made

Seven typical players played Oakvale Isle on the real game logic, through the test harness and the playthrough bot. Each wrote down what held them, what drove them away, and what they would want next:

| Player | Wants |
|---|---|
| The achiever | numbers going up, gear, a goal for every hour, day and week |
| The explorer | secrets, lore, a world with a history |
| The friends' group | things to do together, a place to meet, showing off |
| The competitor | rivalry, firsts, rankings, stakes |
| The casual phone player | 5 to 15 minute sessions, a clear next step, no setbacks |
| The Tibia veteran | the starter island feeling, rare drops, leaving the island |
| The newcomer | guidance, characters to love, no punishment, cute things |

Two bot runs gave the numbers:
- **The careful bot** reached level 10 after 188 minutes, with 39 deaths and 63 potions bought.
- **The careless bot** was still level 4 after 4 hours, with hundreds of deaths.
- In both runs the first deaths came between minutes 1.5 and 4: the wolves near the rats of the very first task.
- Most of the careless bot's deaths were in a spider pack at (152, 178), on the way to the beach.

## 1. What every player type agreed on

These came back from nearly all seven:

1. **The first minutes kill you.**
   - A wolf pack (95–98, 153) is about 13 tiles from the rats of the first task (110, 154).
   - Every run died there before minute 4.
2. **Dying costs levels, and there's no money to recover.**
   - Monsters on the island drop no gold. A wolf is worth about 7 gold to a trader, a health potion costs 25.
   - "You were downgraded from Level 3 to Level 2" was the quit moment for the newcomer and the casual player.
3. **The story disappears between chapters I and II.**
   - Four gate quests (levels 2–5, three to five sessions) have no story in them.
4. **Levels 8 to 10 are empty.**
   - After the Gravewaker there is nothing but bears and goblins: 30–70 minutes with no goal.
5. **The villain has no face.**
   - "G." is never named.
   - The Gravewaker never speaks, has no motive and comes back every 5 minutes.
   - Ringing the bell changes nothing in the world.
6. **The world promises more than it gives.**
   - The graveyard (Old Wim "went down the well for a bet", Sir Galen and "only rats", "the hills remember"), the well with a rat scratched on it, and "the year of the long winter" are all promises no NPC answers.
   - Lighthouse Point, Hermit Rock and the Old Tower are empty.
7. **Level 10 is a dead end.**
   - The oracle sends you to a mainland that isn't there.
   - `map.mainStart` is the start of Oakvale, so "leaving the island" puts you back in the temple.

## 2. Things that are simply broken (fix first)

| What | Where | Why it matters |
|---|---|---|
| Raids still point at the old world (Valoria, Ashport, Brightwater on floor 4) | `RAIDS` in `npcs.js` | Every 15–25 minutes everyone reads "An orc warband is marching on Valoria!" and nothing comes |
| "Oh my god, they killed Kenny!" | a monster's `comesBack` speech | A quote from a TV show: breaks the "everything original" rule |
| Townsfolk talk about the Webwood, the Glintvault Bank, cabs and balloons; academy shelves about Brightwater Isle | townsfolk chatter, `LORE` | Lore from a world that isn't there |
| Sister Ama sends you to Corwin about "the stone"; Corwin sends you back | `ama` and `corwin` keywords | A dead loop left over from the old island |
| The four Oakvale houses can't be rented | no landlord on the island | A home is the first thing a group of friends wants |
| A sand strip at (29, 95, 8) lies outside `map.isle` | `map.isle` | PvP is possible there once players have a vocation |
| The bot gives up walking to (149, 207, 8) and (144, 209, 8) | the beach | Possibly unreachable places a quest sends you to |
| The README mixes Oakvale with Brightwater Isle, Elder Maren and the Seer | `README.md` | Newcomers read it |

## 3. The story: The Silent Bell as chapter zero of the Ember Seal

The idea in one line: **G. was Sir Galen**. He is buried in the graveyard, "killed by only rats", but he isn't dead. He joined the **Ashen Choir**, Vharzul's old cult from the Ember Seal. He silenced the bell because it was cast around **a splinter of the seal's fire** that the founders brought to the island. Oakvale is where the Ember Seal story starts.

This uses what's already on the island (Galen's gravestone, the cut rope, the note, "when the bell is silent, the dead wake") and what's already in the mainland story (the Ashen Choir, the five embers, Vharzul).

### Prologue: The Silent Bell I (level 1, as it is, shorter)
- Ama's lines get shorter. The directions move to the Quests tab, and the NPC says one line that matters.
- **New:** Clang, the temple cat, misses the bell. After chapter I he follows you, purely for looks. He hides when your health is low and is happy when you level up.

### Interlude: the gate watch gets a story (levels 2 to 5)
The four gate quests stay, and each gives one clue. That way the mystery goes on between chapters I and II:

| Gate | Boss | Clue |
|---|---|---|
| West (Bram) | Greyfang | bits of the bell rope in the wolves' den: someone carried it out of town |
| South (Tilda) | Old Snapper | a soaked page from the founder's diary on the beach: the first page of the **Oakvale Chronicle** |
| East (Hilde) | Thornmother | a sign burnt into the web, the same as on the torn note |
| North (Osric) | Gnash | the goblins traded with "a hooded man who smelled of smoke" |

### The Silent Bell II and III (levels 5 and 6, as they are, plus)
- **Optional:** with a rope you can go down Old Wim's well. A flooded passage leads to the cistern, with Wim's bones and diary: a page of the chronicle, and a shortcut.

### The Silent Bell IV: The Gravewaker (level 8)
- **He speaks.** Before the fight he says one line. Afterwards it's clear he was Sir Galen in the Choir's hood.
- **Once only**, he drops a letter in ash script: "The isle's spark is ready. Send the ship."
- **The clapper is warm.** Moonpetal finds grey ash in the bronze. The founders fled the burning mountain with a splinter of the seal's fire, and cast the bell around it.
- **The bell becomes shared:**
  - Once someone rings it, it rings for everyone.
  - The names of the ringers go on a plaque in the tower ("rung by Ana, Ben and Cid").
  - The first one on the server is the **Bellringer**.
- **The town changes.**
  - The townsfolk talk about you.
  - Galen's gravestone gets a new line.
  - Every dawn the bell rings by itself.
- From then on the Gravewaker who returns is "the Gravewaker's echo", a hunting boss, no longer the villain.

### New: The Silent Bell V: The Choir's Shadow (levels 8 to 10)
This fills the empty stretch before the oracle:
- **Night landing.** At night, Choir cultists land at Lighthouse Point. **The lighthouse keeper** (a new NPC who lights the lamp at dusk, on the world clock) asks for help.
- **The chronicle.** The last pages of the founder's diary lie with the hermit of Hermit Rock (who only talks at night), and in the ruin of the Old Tower. The full chronicle names the founder and opens a reading desk in the academy.
- **Optional danger.** Under Spider Hills, a **Brood Queen** (around level 15) with a rare drop of her own. A reason to stay, and bragging rights.

### Farewell (level 10)
- The whole town gathers on the square. Each NPC you helped says one line, and you ring the bell yourself.
- The oracle gives you your vocation. **The ship lies in the harbour.** You confirm "you can never return", and the islanders wave you off.
- **On the mainland,** the first Choir cultist you defeat carries a drawing of Oakvale's bell tower and a line of a hymn: "five embers gutter, and the sixth sings." Only those who paid attention on Oakvale understand it.
- Then the Ember Seal begins as it is written (the Seer's dream). The Seer becomes Oakvale's oracle instead of "the Seer of Brightwater".

### Later, on the mainland
- **The Bell-Founders' Debt.** Oakvale's bell was cast from the same bronze as the cage of the seal under Cinderhold. The smiths need you for a bell for each people of an ember. This brings the forge into the main story.
- **The Cantor Returns** (around level 40). Galen, now a lich, raids Oakvale. Only those who saved the bell may sail back once to defend it. That makes "never return" mean something.

## 4. Systems that make players come back

Ordered by how many player types each one helps.

### A. A gentle start and fair dying
*(newcomer, casual player, achiever; the veteran too, as long as the risk comes back later)*
- **The first 10 minutes without dying:** the wolf pack moves away from the rats of the first task.
- **No lost levels before a vocation.** You do lose experience, but never drop below your level. After the oracle the old rules apply: risk is for later.
- **After a death,** Ama gives one tip based on what killed you ("Wolves hunt in threes: take them one at a time").
- **A little gold in loot** (a rat 0–2, a wolf 1–4, a bear 2–6), plus a rare item worth a lot to traders (about 1%). Hunting then pays for your potions.

### B. Daily and weekly tasks
*(achiever, casual player)*
- After their chain, the gate guards each hand out a small task every day ("kill 10 crabs").
- Once a week there's a boss rematch: Greyfang, Old Snapper, Thornmother, Gnash or the Gravewaker's echo.
- Tasks pay in **watch marks**. A task shop sells potions, colours for your outfit, a lantern, a title, and later a stat ring.
- On the phone the guide card shows "next: about 5 min", so every session ends with something done.

### C. Collections
*(explorer, achiever, newcomer, veteran)*
- **A bestiary.** At 25, 100 and 500 kills you see a monster's stats, then its loot, and then you get a small permanent bonus against it. Each monster has a playful line ("Rat: thinks your boots are cheese").
- **The Oakvale Chronicle.** The founder's diary pages, in a tab of their own.
- **Achievements and titles.** For example: each gate boss without dying, every hunting ground visited, the bell rung 100 times. A full set gives the title Champion of Oakvale and a cape you take to the mainland.

### D. Being first and on the board
*(competitor, achiever, friends)*
- **Server firsts.** The first to ring the bell or slay a boss is told to the whole server and earns a lasting title.
- **A notice board in the Sleepy Boar.** It ranks level, boss kills, fastest Gravewaker and **fewest deaths**. Half of it rewards care, not killing.
- **A weekly season.** The top three get a colour for their outfit.

### E. Playing together
*(friends, newcomer)*
- **A mentor bonus instead of the level wall.**
  - Today experience sharing stops when someone is too low ("everyone needs level 6").
  - Instead, a veteran gets a mentor mark for every step a newcomer finishes.
- **A fellowship at any level.**
  - The innkeeper of the Sleepy Boar registers a group: a name, a chat and an emblem.
  - It becomes a guild once you have vocations.
- **A landlord in Oakvale.**
  - Friends can share a house, with a shared chest and a trophy shelf (Greyfang's fang, Gnash's tooth).
- **Island raids.**
  - Goblins push at the north gate, and the dead stir at Bone Rocks at night.
  - They're stronger the more players are online.
  - Afterwards the town crier names the defenders.
- **Bosses that grow with the group,** so four friends together still have to fight.

### F. Competing safely
*(competitor; the friends don't have to)*
- **An arena in the academy's training yard.**
  - Duels you agree to, with no loss and no skull, and a ladder.
  - It works before vocations too.
- **Real PvP starts on the mainland.** Later a faction choice in the Ember Seal (the Order or, in secret, the Choir), with points for PvE deeds as well.

### G. A living world
*(explorer, veteran, newcomer)*
- **Every townsperson knows 2–3 words about the past.**
  - Brenna: "My great-grandmother forged the crypt gate".
  - Rolf, about the night the bell was cast.
  - "Ask X, she'd know" replaces "the Quests tab says where to go".
- **People with routines on the world clock:** the lighthouse keeper at dusk, the hermit at night, a fisher at Fisher's Rest.
- **Secret quests without an arrow** (a key, a lever behind a bookcase, a hidden cave), with a hint in the world, never a dead end.
- **NPCs understand a lost player.** "what", "where", "lost", "stuck", "help", "thanks" get the current step in one line, instead of "I'm not sure what you mean".

### H. Phone players
*(casual player)*
- **Quests in steps of about 5 minutes,** each with its own reward.
- **Coming back after a break:** "Last time: 5 of 8 wolves. Next: the west gate."
- **Safe interruptions:**
  - Logging out in a protection zone or out of a fight is instant.
  - A phone that loses its connection mid-fight drinks a potion, and monsters soon lose interest.

## 5. Order of work (each phase for approval)

| Phase | What | About |
|---|---|---|
| **1. Fixes and the first hour** | everything in section 2; a gentle start and dying (A); NPCs that understand "lost"; lore words for townsfolk; shorter quest texts | the biggest effect for the least work |
| **2. The story on Oakvale** | the gate clues; Galen as G.; the shared bell with its plaque; the town changing; chapter V with the lighthouse keeper, the hermit and the chronicle; Wim's well; the farewell | the island becomes chapter zero |
| **3. Coming back** | daily and weekly tasks with watch marks; bestiary; achievements and titles; server firsts; the Sleepy Boar board | reasons for tomorrow and next week |
| **4. Together** | mentor bonus; fellowship; landlord; island raids; bosses that grow with the group; arena | for the friends' group |
| **5. Out to sea** | the departure scene and the mainland, as soon as the mainland is built | the end of the island |

## 6. Decisions for the owner

1. **Galen as G.:** is that the villain you want, or do you want someone else?
2. **Dying before a vocation:** no lost levels at all, or no loss below level 5 only?
3. **Level 10 for now:**
   - Until the mainland exists, do players stay on the island with their vocation, or does the ship wait ("the ship sails when the mainland is ready")?
4. **Clang the cat:** a companion for everyone, or a reward?
5. **PvP:** an arena on the island, or only on the mainland?
6. **The sealed tale:** this plan moves none of the hand-placed things of the old starter island, and it changes no graves. It does give the graveyard a role in the story (Galen). If the owner of the tale used Oakvale's graves, a choice about Galen should be made with them.
