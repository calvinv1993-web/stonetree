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

### Phase 3: Oakvale

- **Walls and gates:** a wall with four gates.
- **Temple:** the temple (the protection zone where new characters wake up), with the priest.
- **Public buildings:**
  - a depot and mailbox
  - an inn, with an upper storey
  - a guard tower with stairs
  - a training yard with dummies
- **Shops:** weapons, armour, general goods, food, and a magic shop.
- **Houses:** 6 to 8 rentable houses, with real interiors and roofs.

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

| Danger | Hunting grounds |
|---|---|
| Easiest | the sewers, Sunny Fields, the lakeside |
| Easy | Frog Marsh, the edges of the Wolf Woods and Deer Woods |
| Middle | Stonefield, Old Tower, the Goblin Hill, deep in the woods |
| Hard | North Peaks, Bone Rocks, Hermit Rock |
| Hardest | the Spider Hills caves |

### Phase 5: underground

These caves are a design proposal, since there's no underground reference:
- **Town sewers** under Oakvale (z 7)
- **North Peaks caves** (z 7 and 6)
- **Bone Rocks crypt** (z 7 to 6)
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
