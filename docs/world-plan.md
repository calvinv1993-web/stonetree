# Oakvale Isle: the world plan

A new starter island for SORTIA, built from a blank map. It's in the classic style (a small
walled town, a temple, a river, beginner hunting grounds that get harder further out, caves
below), with a layout, names, people and story of its own. It's **not** a copy of any existing
game's map.

Its scale and contents are those of a classic starter island:
- about 20 NPCs
- about 12 quests
- about 16 hunting grounds
- a sewer and three cave systems underground

## 1. Size and coordinates

| | |
|---|---|
| Map | 256 × 256 tiles, 16 floors (z 0–15) |
| Surface | z = 8. Floors 0–7 are underground, 9–15 above ground |
| Axes | x goes east, y south, z **up** (the engine's own rule) |
| Scale | 1 tile = 1 sqm. The island is about 190 × 215 tiles, in open sea with at least 20 tiles of water around it |
| Start | (119, 129, 8): the middle of Oakvale. The temple goes here in phase 3 |

This is all in `WORLD_SIZE` and `ISLE_DESIGN` at the top of `js/default-map.js`.

## 2. Floors and floor changes (the engine's rules)

- **Stairs, ladders and holes** move you exactly one floor, up or down, at the same x, y.
  - If that tile isn't free, you land on the first free tile of: the direction you were walking, then W, E, N, S, then the diagonals (`changeFloor` in `game-core.js`).
  - You never land on another floor change, so you can't bounce back and forth.
  - **Every floor change therefore needs a walkable tile at its x, y (or next to it) on the floor it leads to.**
- **Mountains** are cliff tiles on one floor, with their top one floor up at the same x, y. Each floor up is drawn one tile up-left, so the top sits on the cliffs.
  - A *mountain path* is a `ramp` on the lowest cliff, with a `ramp_top` above it.
  - Paths go up the **south** (or east) side, where the cliff face can be seen. On the north and west sides the shifted top would cover them.
- **Underground**, every cave floor is enclosed by rock walls. Tiles that haven't been dug out are empty (`null`), and nobody can walk on them. The validator also requires a wall between any cave floor and the void.
- **Upper floors** exist only where there's something there: mountain tops, upper storeys, roofs.

## 3. The island (phase 2: geography, third version)

The island is the same size as map A's (about 25,000 walkable tiles). It's built the way the classic maps are, after studying map A and Tibia's style (see `docs/world-research.md`):
- **Roads and rivers** run straight, north-south or east-west, with right-angle turns and jogs.
- **The river's banks** step in and out, and its width changes along the way.
- **Mountains** are rock walls rising in two or three tiers. Their tops are rugged rock with boulder piles, and you can only walk on a ledge where a path leads up.
- **Firs and bushes** are spread across the open land, with dense woods in places.

| Place | Where (x, y) | What | Hunting (planned) |
|---|---|---|---|
| Oakvale | 110–148, 106–142 | The town site in the middle, kept clear for walls, streets and buildings (phase 3). Start at (129, 124) | Sewers below: easiest |
| Willow River | Mirror Lake → west coast | Past the town's west side, out to the west coast. Bridges on the north and west roads | |
| Mirror Lake | 148–176, 58–84 | Lake in the north-east, source of the river | Lakeside: easiest |
| Sunny Fields | 108–152, 146–186 | Meadows south of town, with a pond and a farm clearing | Easiest |
| North Peaks | 62–106, 40–62 | Three-tier mountain. Path up at x 99 to a ledge | Hard, with a cave (phase 5) |
| Eagle Peak | 114–136, 34–52 | Two-tier mountain with no way up | |
| Stony Field | 86–108, 64–82 | Stony ground below the North Peaks | Middle |
| Wolf Woods | 40–84, 58–112 | Dense fir forest in the north-west, with a lumber camp clearing | Easy to middle |
| Frog Marsh | 42–72, 112–146 | Swamp with pools, crossed by a causeway trail | Easy |
| Fisher's Rest | 42–56, 170–182 | Fishing hamlet clearing south of the river's mouth | |
| Bone Rocks | 62–92, 174–202 | Two-tier crag in the south-west. Path up at x 76 | Hard, with a crypt (phase 5) |
| Lighthouse Point | 116–150, 196–224 | Rocky cape in the south, with a lighthouse clearing | |
| Spider Hills | 164–194, 166–200 | Three-tier hills in the south-east. Path up at x 178 | Hardest: spider caves (phase 5) |
| Deer Woods | 152–214, 88–160 | Big oak wood east of town, with a pond and Deer Brook | Easy to middle |
| Old Tower | 186–204, 110–126 | Hill in Deer Woods; its top is walkable, for a ruined tower | Middle |
| Goblin Hill | 174–208, 58–88 | Stony hill with a goblin camp clearing | Middle |
| Hermit Rock | 192–212, 40–56 | Rock in the north-east; its top is walkable | Hard |
| Small woods | Owl Grove, Fox Copse, Thorn Thicket | Between the big areas | |

**Roads** (3 tiles wide) leave the town:
- north, over the river, to the North Peaks
- west, over the river, to Frog Marsh and Wolf Woods
- south, to Lighthouse Point
- east, to the Old Tower

**Trails** (2 tiles wide) lead to:
- Mirror Lake
- Goblin Hill and Hermit Rock
- the Spider Hills
- Bone Rocks
- Fisher's Rest
- the lumber camp
- the marsh

## 4. Later phases: what's planned

These are targets for you to approve phase by phase. They're not built yet.

### Phase 3: Oakvale (fourth version)

The town is the `OAKVALE` data in `js/default-map.js`, built by `buildTown`. It's laid out after the reference screenshots and the Rookgaard overview the owner sent:
- **A ring of water and a wall:** a moat all round (three tiles wide) with a town wall inside it, three tiles thick (99–154, 94–148, `OAKVALE.ramparts`): solid sandstone masonry (its towers and gatehouses of the same stone) with a walkway on top (floor 9) all the way round, battlements on its outer edge and torches along its inner edge; bronze cannons along the battlements every eleven tiles (with a pile of balls, and every other one a keg of powder) and two on each tower's lookout; Oakvale's blue banners with the golden sun down its outer south and east faces. Gates with bridges north, south, east and west, each under a gatehouse on the walkway (a room a tile wider than the gate, a terracotta roof, a banner on its town side; the walkway goes through it); the walkway goes on over the gates and over Willow River (where it comes in at the north and goes out at the west) on lintels. The ways up: a flight of stone steps three wide up the north wall's inner face at (129–131, 96), as the temple mount's, coming out on the walkway, and the four corner towers. A tower (5×5) takes the wall's corner and two tiles more into town: on the ground a room with a door into town, stairs up to the walkway's floor (doorways where the walkway comes in) and on to a lookout with battlements and Oakvale's flag, blue with the golden sun (floor 10), and a door out over a footbridge across the moat towards the hunting grounds: NW and NE to the north (Stony Field's goblins, the goblin trail), SW and SE to the south (the wolves of the south-west, the spider trail). Everything inside (buildings, the mount, gardens, the yard, the graveyard) stands at least two tiles clear of the wall.
- **The river runs through the middle:** Willow River comes in from Mirror Lake in the north, runs south through the town, then turns west and out. That splits the town into three quarters joined by bridges.
- **Small rock patches** scattered over the whole island.

| Quarter | What's there |
|---|---|
| North-east | **The temple mount:** a knoll of rock north of the square (inside 128–149, 99–109, two tiles clear of the town wall; a rim of it round the bell tower), its foot following a roughened outline (`OAKVALE.mount`), its top one floor up: grass, edged with a rim of stones. On it: the Temple of the Dawn, a cathedral of dark weathered sandstone (130–144, 100–107: its front a great pointed portal at 136–138,107 between two towers, 130–134 and 140–144, 104–107, the hall behind the portal 135–139, and the nave 132–142, 100–103 with the altar on a rug, marble saints, piers and pews; two floors high, tall pointed windows lit from within, slate and lead roofs). The towers rise four floors over it (to floor 13) and their spires above that (floor 14), eight-sided with crockets and the golden sun at the tip. The west tower holds a chapel; the east tower is the bell tower: the ringers' room (door at 140,106 from the hall), stairs up floor by floor, the bell (2×2, at 141,105) in the open belfry on floor 13 between four corner piers; the rope's shaft of open hatches runs down at (143,105) to the bottom of the sewers. A limestone path runs round the cathedral, and the statue of the founder (3×3, 146–148, 101–103: sprites/founder-statue.png) stands on the mount's east shoulder beside it. **New characters wake at (137, 103, 9)**. The depot stands on its own east of the square, below the mount (145–149, 108–113, door at 147,113 onto the east street). Out of the temple: a terrace with pillars, a broad flight of stone steps down to the square (the welcome sign stands at the foot of the steps) with the sun mosaic in its middle (5×5, centred on 134,115), stalls and well.  Every building stands at least two tiles clear of the town wall |
| North-west, over the bridge | Oakvale Academy (the oracle is upstairs), Moonpetal Magic, two houses, a vegetable garden, and a chest hidden behind the academy |
| South, along the main street | The Dented Shield, Hide and Iron, Pip's Provisions, The Warm Loaf, the Sleepy Boar inn, the training yard, the graveyard and two houses |

**The beginner's route through town:**
1. Out of the temple on the mount, onto the terrace and down the steps to the square.
2. The depot next door.
3. Over the bridge to the academy (the oracle is upstairs).
4. Back over the footbridge to the shops on the main street.
5. Out of a gate to the first hunting grounds.

The sewer grates are where the rat sewers will start (phase 5). The guide's texts and the townsfolk who send you along this route come with the NPCs in phase 6.

**Things to discover, and signs that teach the game:**
- Every shop hangs out a picture sign, so you can tell the trade at a glance: crossed swords for weapons, a shield for armour, a star for magic, bread for food, rope for the general store, an ale mug for the inn, a letter for the depot, a sun for the temple, a book for the academy.
- The signs say what each place is for: the temple (where you wake, no fighting inside), the depot (lockers), the academy (the oracle sends you on at level 10), and the shops (say hi, then ask to trade).
- A "first steps" signpost outside the temple door points the way.
- The old graveyard has seven gravestones with inscriptions, which you read by looking at them. Some are hints.
- Sewer grates in the streets: "something squeaks down there". These are the sewer entrances, for phase 5.
- The well and the founder's statue have stories when you look at them.
- A forgotten chest with 30 gold in the strip behind the academy.

Every building is a shelter (monsters keep out). All doors, stairs and ladders are checked by `tests/world.test.js`.

**Still to come in phase 6:** the priest and other townsfolk, the shopkeepers' wares, the house-rent NPC, and the starting guide's new texts. The guide still talks about Brightwater Isle and Elder Maren.

### Phase 4: the wilderness

- the Saltreed huts and a pier
- the Sunny Fields farm and mill
- the ruined watchtower on Old Tower
- a hermit's hut on Hermit Rock
- a goblin camp in the Goblin Hill
- a lumber camp in the Wolf Woods
- a lighthouse on Lighthouse Point
- signposts
- camps
- the hunting grounds, from easy (near town) to hard (far out):

**Built:** `huntingGrounds` in `js/default-map.js` places about 135 monsters on the surface in packs of up to three (20+ rats, 35 wolves, 21 goblins, 17 spiders, 13 crabs, 12 slimes, 6 skeletons, 7 bears), only on open ground (never in a pocket between trees).

| Danger | Hunting grounds |
|---|---|
| Easiest | the sewers, Sunny Fields, the lakeside |
| Easy | Frog Marsh, the edges of the Wolf Woods and Deer Woods |
| Middle | Stonefield, Old Tower, the Goblin Hill, deep in the woods |
| Hard | North Peaks, Bone Rocks, Hermit Rock |
| Hardest | the Spider Hills caves |

### Phase 5: underground

These caves are a design proposal, since there's no underground reference:
- **Town sewers** under Oakvale (z 7). **Built** (`SEWERS` and `buildSewers` in `js/default-map.js`):
  - Brick tunnels with a channel of water and a walkway on each side: under the main street (x 104–147, y 128–132), north under the square to the temple mount (x 130–134), and south towards the south gate (x 124–128).
  - The four street grates go down; a ladder under each one, at the same x, y, goes back up: (131,111), (140,129), (110,128), (127,141).
  - Rooms: the bell cellar under the temple (133–140, 101–106, a dead end for "The Silent Bell"), an old storeroom (103–108, 121–126), and a rats' nest where the walls have fallen in, under the graveyard (around 146, 139).
  - 12 rats, and 3 giant rats in the nest.
- **Under the sewers** (`DEEP_SEWERS` and `buildDeepSewers`), the way to the bottom of the bell shaft for The Silent Bell II:
  - The old bell cellar on floor 7 is choked with fallen stone; a trapdoor in the rats' nest (147,139) leads down.
  - Floor 6, the old drains: crumbling tunnels and fallen-in caves, 10 giant rats; a trapdoor at (128,111) leads on down.
  - Floor 5, the deep cistern: a flooded cave with 12 giant rats; a narrow passage east (135–138, 108) kept by a slime, to the bottom of the bell shaft (139–144, 103–109) where the bell rope lies.
- **North Peaks caves** (z 7 and 6)
- **Bone Rocks crypt** (z 7 to 6). **Built** (`CRYPT` and `buildCrypt` in `js/default-map.js`):
  - The way in: steps down cut into the south foot of the crag at (81,198), in a niche cleared of rock (also on the floor above, so the crag's rim doesn't hide them), with a short path from the bone trail and a warning sign.
  - Floor 7: an antechamber, a corridor north and the hall of coffins (72–88, 178–184), 4 skeletons; steps down at (66,181).
  - Floor 6: the founder's tomb (62–76, 175–187) with the bell's clapper in the open tomb at (69,176), 3 skeletons and the Gravewaker.
- **Spider Hills spider caves** (z 7 to 5): the hardest beginner area

Each entrance will be listed with its source and destination tiles, and checked by the validator.

### Phase 6: people, monsters, quests

About 20 new NPCs:
- traders
- the priest
- guards
- a fisher
- a farmer
- a hermit
- an oracle who sends players on when they're ready

About 12 quests, with an original story. The monsters come from the existing list, and the
levelling pace stays as it is.

### Phase 7: discovery quests: the comeback hooks

Things that bring a player back to the hunting grounds once the gate tasks are done:
- **Rare named kin** (`RARE_KIN` in `creatures.js`): 2% of the times a rat, wolf, crab, spider, goblin, skeleton, slime or
  bear of the isle comes back (never at the world's start), it comes back as its named kin: 2.5x the health, 1.25x the
  damage, 3x the experience, +2 defense, +1 armor, more gold, potions, and always its trophy. Players within 24 tiles are
  told. It still counts as its kind (quests, the bestiary). Looks: `rare:<type>` in `sprites.js` (tint, a size bigger, a
  mark; Grubnose and Sir Clatterbones have looks of their own in `MONSTER_LOOKS`).

  | Kind | Name | Trophy | Smith | Makes |
  |---|---|---|---|---|
  | rat | Whiskerjack | tail of Whiskerjack | Brenna | rare leather boots (armor 2) |
  | wolf | Old Scarjaw | hide of Old Scarjaw | Brenna | rare leather armor (armor 4) |
  | crab | Ironclaw | shell plate of Ironclaw | Brenna | rare wooden shield (defense 15) |
  | spider | Silkwidow | spinneret of Silkwidow | Brenna | rare leather legs (armor 2) |
  | goblin | Grubnose the Sly | whetstone of Grubnose | Dunstan | rare short sword (attack 14) |
  | skeleton | Sir Clatterbones | dented helm of Sir Clatterbones | Brenna | fine chain helmet (armor 4) |
  | slime | Glimmerglob | glimmering core | Dunstan | rare spiked club (attack 14) |
  | bear | Mossback | claw of Mossback | Brenna | fine chain legs (armor 4) |
- **The bestiary** (`bestiary` on the player; `BESTIARY_TIERS` in `game-combat.js`): kills per kind; at 25/100/250, +3/6/10%
  damage against that kind, announced. Shown under the quests (desktop Quests tab, the phone drawer's Quests page).
- **Cosmetics** (`COSMETICS` in `defs.js`, `cosmetics` on the player, worn as `outfit.feather` / `outfit.cloak`): 5 watch
  marks each at Captain Osric's: gull feather, jay feather, watch, ember and moss cloaks. Drawn over the player sheet
  (`sheetCosmetics` in `sprites.js`); others see them through the outfit in their snapshot.

### Phase 7: discovery quests

Hidden quests, for the long stretch from level 5 to 10: nobody hands them out, there are no guide steps for them, and
the guide's arrow never points at them. Clues come from rumours, gravestones and townsfolk. Each is a chest quest
(`QUESTS` with `chest: true`, ended by a `qchest_*` thing in `defs.js`): once per character, with experience for the
finding (`chest.xp`), and a chest stays shut while its guardian lives within 10 tiles (`chest.guard`).

**Rumours.** `RUMOURS` in `js/npcs.js` has a hint at each of the six hidden quests (Tidecutter, the lighthouse and the
eagle's feather are other helpers' quests; these are only their hints). Innkeeper Rolf tells all six, one each time you
ask for {rumours} (the service `{ rumours: [...] }`, `rumourTalk` in `game-npc.js`); the townsman, the townswoman, the
old man and the child know some of them. Armourer Brenna tells of her shield when asked about it ({bronze}).

**New mechanics** (`js/game-core.js`):
- *Lever puzzles* (`puzzleLever`): a lever with meta `{ puzzle, order, target }`. Pulled out of order, all of the
  puzzle's levers spring back with a clank; all in order, the `cellar_bars` over the target lift for 3 minutes, then the
  bars and the levers go back for the next one. The levers are the world's (shared online).
- *Boulders* (`boulder`, flag `push`; `pushBoulder`): walk straight into one and it rolls a tile on, if the tile beyond
  is empty, walkable and no floor change; your step is spent on it. Pushed boulders roll back home after 10 minutes,
  when nobody stands there.
- *Rope down* (meta `ropeDown`): use a rope on such a tile (the town well) to climb down; a rope spot at the bottom
  takes you back up.
- `tests/world.test.js` counts rope spots and ropes down as ways between floors, and boulders and cracked rocks as
  passable (each has a unit test of its own).

**1. The Watchman's Greaves** (level 5; `OLD_TOWER`, `buildOldTower`):
- The ruined watchtower on the Old Tower hill: walls 190–196, 114–120 on the hilltop (floor 9), a broken top on
  floor 10 (gaps in its battlements), and walls of the fallen storey above at its NW and NE corners (floor 11).
- The doorway (193,120,9) fell in: a rope spot under a hole in the floor above, with fallen stone behind it inside.
  Use a rope on it from outside: you come out on the top, where three skeletons keep the watch.
- Stairs down at (191,115) into the tower. Three levers against its north wall, (192,115) west, (193,115) middle,
  (194,115) east. The right order is on three new gravestones in the graveyard (143/145/147,142): Oswin, first, the
  east; Marrow, second, the west; Tobin, third, the middle.
- Then the rusted grate over the trapdoor (193,117,9) lifts: a ladder down into the cellar cut into the hill
  (191–195, 115–119, floor 8), where the watchman's shade (260 hp, 180 xp, lurks) keeps his chest (192,115,8).
- Reward: watchman's greaves (legs, armor 3 at 38 oz: chain legs' armor at half their weight), 40 gold,
  2 health potions, 600 experience.
- The founder's diary, page 2, moved out of the tower to the hilltop beside it (198,118,9).

**2. The Bronze Ward** (level 6; `GOBLIN_WARREN`, `buildGoblinWarren`):
- A burrow (a hole) on Goblin Hill's east side (202,71,8), well away from Gnash's camp on the surface, down to the
  goblins' tunnels on floor 7: the burrow (around 201,72), a tunnel west and north (x 194, y 65–72), a tunnel west
  to the archers' hall (around 182,68), a long tunnel south (x 182, y 70–81) and east to Gnash's hoard (around 193,81).
- Two boulders: (194,69) is pushed north past the turn into a niche (194,65); (182,73) a long way south to the end
  of its tunnel (182,81). Goblin archers (new: 40 hp, shoot arrows, keep their distance) shoot over them.
- Four goblin archers, three goblins and the hoardkeeper (240 hp, 170 xp), all lurking.
- Reward in Gnash's hoard (195,80,7): the bronze ward (shield, defense 18: between the studded shield's 15 and the
  mainland's level-12 iron shield's 20), 80 gold, 2 health potions, 700 experience.

**6. Down the Well** (level 6; `WELL_TUNNELS`, `buildWellTunnels`):
- The town well (124,110,8): use a rope on it to climb down. Floor 7, kept clear of the sewers (x 111–128,
  y 98–113): the pool at the bottom with a rope spot back up (124,110), a tunnel west to a cave (around 114,111),
  north (x 113) to a cave (around 115,100), and east to a cracked rock (122,100): a pick breaks through to where Old
  Wim lies (126,100).
- Four giant rats and a slime, lurking in the dark (bring light).
- Reward: Old Wim's lucky ring (regenerates 2 health and 1 mana, for 2 hours of wear), 25 gold, 450 experience.

### Phase 7: discovery quests

**The gate watch's tasks** (level 2-5, the guide leads to them; the places are `GATE_SITES` in `js/default-map.js`, the mechanics `js/game-gates.js`). Rewards and order are as before; each guard gives two health potions as you take a task (or one of the hunts) on.

| Gate | Task | Where | How |
|---|---|---|---|
| West, Sergeant Bram (2) | Greyfang's den: 4 wolves, and Greyfang's pelt | Paw prints from the lumber trail (69,98) north through the pines to (68,77); the den (65–70, 70–73) in a thicket of firs against the rocks, open only to the south; Greyfang at (67,71), a grey hood among the bones (66,71) | Look at the prints; the arrow leads only to the first one. His pelt is taken from him when he falls (quest `trophy`). |
| South, Guard Tilda (3) | Stranded: get Wendel the fisher off his rock | A sand spit (100,216–218) off the west beach of Lighthouse Point to an islet (98–104, 219–222) with rocks, a fish rack and his wreck (105,221); 2 crabs on it (Old Snapper on the beach) | No crab within 3 of (101,220) (a step's `clear`), then talk to him: he goes home to Fisher's Rest (41,176) for 3 minutes (`goesHome`), then back out. |
| East, Guard Hilde (4) | Nests in the Hills: burn four spider nests | (179,162), (195,163), (200,172: a flame in a ring burnt into it), (165,186), among the spider packs | A torch (Hilde gives one) used on a nest, or Torchlight cast next to it (`burnable` things); spun again after 10 minutes. Counted per character (step `burn`). |
| North, Captain Osric (5) | Gnash's war plans | The goblin camp at the top of the goblin trail: tents (194,67), (200,67) and Gnash's (197,70), a totem (199,65), the fire (197,66), the war chest (198,70); Gnash (197,68) and 3 goblins round him | The goblins of Goblin Hill (174–208, 56–90) sleep at night (`sleeps`), unless someone steps right next to one or hits one: then those within 4 wake too. |
### Phase 7: discovery quests

Hidden quests for the 7-10 stretch: no guide step, no arrow, no mark over the giver's head (`hidden` in `QUESTS`;
`questNews(id, true)`), only the giver's greeting hints at the word. Each giver's own words carry the clue to the next.
The places are `DISCOVERY` and `buildDiscoveries` in `js/default-map.js`; the mechanics `digUp` and `questDeed` in
`js/game-core.js`.

**Tidecutter** (level 7, Old Maddock at Fisher's Rest, `tidecutter`; 600 xp, 60 gold, 3 potions)
- Fisher's Rest: Old Maddock's hut (49–53, 176–179, door 51,179) with his sea chest (52,177), a jetty out over the sea
  (31–36, 174–175) with a rowing boat (32,173), nets drying on the beach, a sign at (55,170). Maddock stands on the jetty.
- His tale: his sister Wenna's sword went down with her boat, the Gull, in the sea cave south of here; she locked the cave
  and buried the key. The chart in his chest (`tide_chart`, readable) has her rhyme: south along the strand to where the beach
  grows thin, three grey stones in the sand, the key between them.
- The spot: (50,188), three boulders round it (49,187), (51,188), (49,189). Nothing shows there: dig it with a shovel while on
  the quest (map meta `dig`, `thing`) for the **barnacled key** (`sea_key`). Lost, it's there again while the quest needs it.
- The sea cave (z 7): steps down in the rocks at (51,196); a landing, a narrow way, the **gate** at (48,196) (`sea_gate`: the
  key opens it for a minute, then it shuts and locks again); a grotto with a pool (43,196) and crabs; the wreck of the Gull
  in the second grotto (41,202), its chest (43,202) holding **Tidecutter**; **Brineshell**, Old Snapper's mate (260 hp), by it.
- Show the blade to Maddock (he lets you keep it: step `has`): the reward, and the clue to the lighthouse.
- Tidecutter: sword, attack 17, defense 11, level 7: the best blade on the isle, below the broadsword (level 12).

**King Mogg's Sabre** (level 7, the first of the deep vaults: no giver at all, only Rolf's rumour; `mogg_sabre`; 900 xp, 120 gold)
- `GOBLIN_DEEP` and `buildGoblinDeep` in `js/default-map.js`. Four floors under Goblin Hill, each harder than the last.
- Floor 7: at the back of Gnash's hoard, a short tunnel east to loose earth (199,84): a shovel digs a hole (it fills in
  again after a minute); a rope spot under it leads back up.
- Floor 6, the Deep Diggings: the goblins' den (186,87) with archers, a boulder in the tunnel south (186,92: it rolls
  into a niche at the end), a store cave (190,97), the diggers' chest in a side cave (180,100), and the pit (205,96).
- Floor 5, the bone halls: the pit drops you here with no way back up it; skeletons and a shade in the hall (187,100); the
  rope spot (182,101) climbs back up into the side cave. South, the old goblin gate (186,106, level 7), then a hole down.
- Floor 4, the throne hall (193,115): King Mogg (340 hp, summons a skeleton now and then) with two skeletons and a shade,
  his throne and chest (193,112). Behind it a tunnel west to the king's way out: ladders up (178,117,4), (174,117,5),
  (171,117,6), (170,116,7) to a hollow in the Deer Woods (170,116,8). Only up: the caves join the woods, one way.
- King Mogg's sabre: sword, attack 18, defense 10, level 7: the best blade on the isle, below the broadsword (level 12).

**The Captain's Mail** (level 8, the second deep vault: only Rolf's rumour; `watch_mail`; 1000 xp, 150 gold)
- `TOWER_TOP` and `buildTowerTop` in `js/default-map.js`: three storeys on top of the Old Tower (190–196, 114–120).
- Floor 10 (the broken top): a rope spot (195,115) under a gap in the beams. Floor 11, the watch room: two skeletons and a
  shade; a wall across it (y 117) with the officers' grille (193,117, level 8); stairs up (191,119). Floor 12, the captain's
  quarters: a bed, a table, shelves, two shades and a skeleton; stairs up (195,119). Floor 13, the lookout roof:
  Captain Harrow (340 hp, summons a shade now and then) and a shade, the watch's pay chest (193,115).
- The watch captain's mail: armour 8, level 8: the best on the isle, below plate (10, level 15).

**The Smugglers' Shield** (level 7, the third deep vault: only Rolf's rumour; `smuggler_shield`; 800 xp, 110 gold)
- `SEA_CAVES` and `buildSeaCaves` in `js/default-map.js` (floors carved by `carveVault`, shared with the Deep Diggings).
- Floor 8: in the rocks east of Lighthouse Point a crevice (147,207, a hole) walled in by rocks, the way in through
  cracked rock (146,207: a pick; it falls back after a minute).
- Floor 7, the sea grotto: a landing cave, the big grotto with a pool (150,214), crabs and slimes; the smugglers' way west
  (y 215) to their store cave (132,214) with a hole down (131,215), and their tunnel north to a ladder (125,203) up under
  the lighthouse's floor: the way out, only up.
- Floor 6, the drowned hall: past the rusted grille (138,215, level 7), Saltjaw (300 hp, calls a crab now and then), a crab
  and a shade; the smugglers' chest (145,213).
- The smugglers' copper shield: defense 19, level 7: the best on the isle, below the iron shield (20, level 12).

**The Weaver's Helm** (level 8, the fourth deep vault: only Rolf's rumour; `weaver_helm`; 950 xp, 130 gold)
- `DEEP_WEBS` and `buildDeepWebs` in `js/default-map.js`, under the spiders' den (`SPIDER_DEN`, floor 7).
- Floor 7: at the back of the Brood Queen's chamber a wall of web (176,176: `web_wall`, burnable: a torch or Torchlight,
  spun again after 10 minutes), a short tunnel north and a hole (176,172).
- Floor 6, the deep webs: caves at (176,171), (187,170) and (189,181), six spiders, a hole down at (190,182).
- Floor 5, the larder: past an old grate (186,183, level 8) the Old Weaver (320 hp, poison, calls a spider) with two
  spiders, and the bundle (178,181). Her way out: ladders up at (176,187,5) and (173,190,6), into the den's second chamber.
- The silk-bound helmet: armour 4, level 8: the best on the isle, below the steel helmet (5, level 15).

**The Keeper's Coat** (level 8, Keeper Tamsin, `keeper_coat`; 750 xp, 80 gold)
- The lighthouse: a new stone tower in the Lighthouse clearing (122–126, 201–205, door 124,205), three floors, stairs at
  (123,202) and (125,202), the **great lamp** on the top floor (124,203,10), dark. The old one's stump stays on the point.
- It needs **lamp oil** (Farmer Odo's cellar), **3 spider silk** (a wick: the spiders' loot) and **flint** (the cave under the
  North Peaks, below). Use the lamp with all three: it burns for a quarter of an hour, for everyone to see.
- The Sunny Fields farm: Farmer Odo's farmhouse (117–122, 153–157, door 119,157), a windmill (124,153), a fenced field
  of crops (113–121, 159–163), a scarecrow and haystacks. A trapdoor in the house (121,154) goes down to his cellar (z 7,
  116–123, 152–157): four giant rats, and the jars of oil (117,153).
- Tamsin's reward: the **keeper's coat** (armor 7, level 8: better than chain armour, as good as the paladins' level-12
  cloak), and the clue to the hermit and the eagles.

**The Eagle's Eyrie** (level 9, Hermit Brannoc on Hermit Rock, at night, `eagle_eyrie`; 900 xp, 50 gold)
- The cave under the North Peaks (z 7): steps down cut into the foot of the south face at (83,61). Four chambers: the
  mouth (83,60); the flint hollow (79,56) with the **seam of flint** (78,54: a pick breaks a piece off, The Keeper's Coat);
  the moaning hall (87,55); the wind chamber (94,52). **Cracked rock** (a pick): (91,54) on the way on, and (85,58), a
  shortcut from the mouth to the moaning hall. Five **shades** (80 hp, weak to holy and fire).
- The climbers' chimney, cut up through the mountain: a ladder at (95,51,7); rooms of rock on floors 8 and 9 (94–96,
  49–51), ladder and trapdoor on each; a hole at (94,49,10) comes out on the **eyrie**: the second tier's top on the
  peak's east shoulder (about 91–100, 47–53, floor 10), walkable now, two more shades, and the **eagles' nest** (98,50)
  with a feather in it.
- The hermit makes **featherstep boots** from it: armor 2, level 9, and 15 speed while worn.

**Tools**
- **Loose sand** (`buried`) on about 35 beach tiles round the isle: a shovel turns up a seashell, a few coins, now and
  then a potion, a bottle with a letter or a pearl; the hole (`dug_sand`) fills in again after 20 minutes.
- **Fishing**: besides fish and old boots, now and then a pearl (1%) or a message in a bottle (0.7%: its letter sends you to
  Old Maddock).
- **A pick**: cracked rock in the North Peaks cave (one of them a shortcut), and the seam of flint.

## 5. Open questions

1. **Leaving the island:** at level 10, after choosing a vocation, players go to the mainland and can never come back (the game already works this way). The old mainland (Valoria and the rest) is no longer in the built-in world: bringing it back from the backup branch, beside this island, is proposed.
2. **NPC and place names** are placeholders until you approve them.
3. **The sealed tale** (`game-tales.js`) was tied to Brightwater Isle's hand-placed things. Those were removed with the earlier imported map (commit `ab17d3c`), before this work. The tale can't be completed until whoever holds its plaintext reseals it for the new island.
4. **Unit tests tied to the old world:** 37 of 49 fail because they use old-world coordinates (floor 4, Brightwater). They need new coordinates once the town and spawns exist (phases 3 and 6). 30 already failed on the imported map before this work.

## 6. How it's checked

| What | Command |
|---|---|
| The world validator | `node tests/world.test.js [--verbose]` |
| The editor, in a real browser (desktop and phone) | `node tests/editor.test.js [screenshot-folder]` |
| A top-down picture of a floor | `node tests/world-map.js out.png [z] --grid` |
| The real game | `node tests/screenshot.js out.png x y z --view` |

The world validator checks:
- the size
- the coast
- solid mountains
- that no cave opens onto the void
- every floor change, run through the game's own code from every side
- that everything can be reached and walked back from
- that no land is cut off
- that spawns are safe
- that saving and loading loses nothing

The editor test checks:
- that the editor isn't a blank canvas
- all 16 floors
- "Go to"
- zoom
- painting, erasing, and a reload
- export and import
- one-finger pan, pinch-zoom and Draw mode on a phone


## The Bone Chapel (hidden quest, level 6)

Inspired by the bone chapels of old Europe, all our own. Behind a crack in the east wall of the crypt's hall of coffins
(89,181,7; a pick breaks it) a passage (90,181,7) leads to the Bone Chapel (91-98, 177-184, z 7): skull pyramids in the
corners, a chandelier of bones over the middle (94,180), and the crest of Oakvale laid out in bones on the north wall
(94,177; the thing `bone_crest`). Brother Ossian, the ghost of the gravedigger who brought the old bones down when the
graveyard grew full, stands at (95,179) and counts them. Three bones of the crest are missing:
1. the carved jawbone, in the rats' nest under the graveyard (a heap of bones at 149,142,7), brought to Ossian;
2. the carved knucklebone, in the grave with no stone between Bertha Oakhart's and Sir Galen's (146,141,8), dug with a shovel;
3. the carved skull, in the cracked coffin in the hall of coffins (73,181,7), guarded by the skeletons; set into the
   crest with the knucklebone. Ossian gives a bone amulet (armour 3), 700 xp and 60 gold.
He also knows Sir Galen's coffin came down empty (a hint at the Gravewaker). The innkeeper's and townsfolk's rumours tell of
counting behind the crypt's east wall (RUMOURS.chapel).


## The Silent Bell's longer roads

The story now goes through the places it never went (STORY_SITES in default-map.js):
- **IV**: the founders' shrine on Mirror Lake's south shore (127,58,8): blessed water, three flasks once (heals 110-160),
  for the fight with the Gravewaker. Ama points there; her words "mirror", "lake", "shrine".
- **V, the ash trail** (three new steps between Tamsin and the landing): the singed hood in Greyfang's den (66,71,8),
  the Choir's altar of ash at the end of the Frog Marsh causeway (60,125,8; a singer on watch at night, 62,126), and their
  unlit signal fire on Stony Field (89,77,8; a singer on watch, 90,79), facing Lighthouse Point. The altar's map carries
  the "G." of Gnash's war plans. Then the landing: three singers and their cantor, fighting as one (band 'choir').
Still to give a story beat: Deer Woods.
