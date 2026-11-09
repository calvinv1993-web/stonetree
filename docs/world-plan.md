# Oakvale Isle: the world plan

A new starter island for Tilequest, built from a blank map. It's in the classic style (a small
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
- **A ring of water and a wall:** a moat all round with a stone wall inside it, and gates with bridges north, south, east and west.
- **The river runs through the middle:** Willow River comes in from Mirror Lake in the north, runs south through the town, then turns west and out. That splits the town into three quarters joined by bridges.
- **Two rocky hills inside the walls,** and small rock patches scattered over the whole island.

| Quarter | What's there |
|---|---|
| North-east | **The temple mount:** a knoll of rock north of the square (inside 128–150, 99–109), its foot following a roughened outline (`OAKVALE.mount`), its top one floor up: grass with bare rock and crags along the edge. On it: the Temple of the Dawn (133–141, 101–106; marble roof with a stained-glass lantern, stained-glass windows, a hall with the altar on a rug, statues and benches), with a limestone path round it. **New characters wake at (137, 104, 9)**. The bell tower, the highest tower in town, stands on the mount's east shoulder (tower 146–150, 100–104, door at 148,104 on floor 9), reached by a wide limestone way from the temple's path: the ringers' room, four floors of stairs, the bell (2×2, at 147,102) open to the sky on floor 13; the rope's shaft of open hatches runs down at (149,102) to the bottom of the sewers. The depot stands on its own east of the square, below the mount (145–149, 108–113, door at 147,113 onto the east street). Out of the temple: a terrace with statues and pillars, a broad flight of stone steps down to the square (the welcome sign stands at the foot of the steps) with its fountain, stalls and well.  Every building stands at least two tiles clear of the town wall |
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
