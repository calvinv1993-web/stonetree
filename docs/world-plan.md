# Thistlewick Isle: the world plan

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
| Start | (119, 129, 8): the middle of Thistlewick. The temple goes here in phase 3 |

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

## 3. The island (phase 2: geography, second version)

Built after studying map A (the imported map) and classic starter islands: see `docs/world-research.md`.

| Place | Where (x, y) | What | Hunting (planned) |
|---|---|---|---|
| Thistlewick | 112–152, 98–140 | Town site in the middle, kept clear for walls, streets and buildings (phase 3). Start at (132, 119) | Sewers below: easiest |
| The Wick | Glassmere → west coast | River 3 tiles wide, past the town's west side, out through an estuary in the west. Bridges on the north road, the west road and the lake path | |
| Glassmere | 148–178, 56–86 | Lake in the north-east, source of the Wick | Lakeside: easiest |
| Southfields | 98–154, 150–190 | Meadows south of town, with a pond and a farm clearing | Easiest |
| Highmoor | 58–150, 28–64 | Mountain range across the north, with a summit two floors up. Paths up at x 80 and 108 (summit at 104) | Hard, with caves (phase 5) |
| Stonefield | 74–96, 68–86 | Stony ground at Highmoor's foot | Middle |
| Old Pinewood | 24–72, 46–114 | Dense fir forest in the north-west, with a lumber camp clearing | Easy to middle |
| Bramble Marsh | 28–62, 118–162 | Swamp on the west coast | Easy |
| Saltreed | 34–48, 174–190 | Fishing hamlet clearing at the Wick's mouth | |
| Cragend | 50–88, 180–216 | Rocky crag in the south-west. Path up at x 70 | Hard, with caves (phase 5) |
| Gull Cove, Cove wood | 60–118, 206–234 | A bay on the south coast, with a small fir wood | |
| Lantern Cape | 118–150, 222–246 | Rocky cape in the south, with a lighthouse clearing | |
| Webbed Hills | 176–214, 166–204 | Hills in the south-east. Path up at x 192 | Hardest: spider caves (phase 5) |
| Eastwood | 160–228, 90–164 | Big oak forest east of town, with a pond and Hollow Brook | Easy to middle |
| Watch Hill | 204–224, 108–128 | Hill in Eastwood, for a ruined watchtower. Path up at x 214 | Middle |
| Redcap Hills | 182–218, 60–92 | Stony hills with a goblin camp clearing | Middle |
| Hermit's Crag | 200–228, 36–62 | Rocky headland in the north-east. Path up at x 212 | Hard |
| Kittiwake Bay | 156–186, 22–50 | Bay on the north coast | |
| Small woods | Thornbrake, Riverside thicket, Willow Bend, Webfoot copse, Lakewood, Southfield grove | Between the big areas | |

Roads (2 tiles wide) leave the town north (to Highmoor), west (over the Wick to the Pinewood and the marsh), south
(to Lantern Cape) and east (to Watch Hill). Paths (1 to 2 tiles wide) lead to Stonefield, the marsh, the lake,
the Redcap Hills and Hermit's Crag, the Webbed Hills, Cragend and Saltreed.

## 4. Later phases: what's planned

These are targets for you to approve phase by phase. They're not built yet.

### Phase 3: Thistlewick

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
- the Southfields farm and mill
- the ruined watchtower on Watch Hill
- a hermit's hut on Hermit's Crag
- a goblin camp in the Redcap Hills
- a lumber camp in the Pinewood
- a lighthouse on Lantern Cape
- signposts
- camps
- the hunting grounds, from easy (near town) to hard (far out):

| Danger | Hunting grounds |
|---|---|
| Easiest | the sewers, Southfields, the lakeside |
| Easy | Bramble Marsh, the edges of the Pinewood and Eastwood |
| Middle | Stonefield, Watch Hill, the Redcap Hills, deep in the woods |
| Hard | Highmoor, Cragend, Hermit's Crag |
| Hardest | the Webbed Hills caves |

### Phase 5: underground

These caves are a design proposal, since there's no underground reference:
- **Town sewers** under Thistlewick (z 7)
- **Highmoor caves** (z 7 and 6)
- **Cragend crypt** (z 7 to 6)
- **Webbed Hills spider caves** (z 7 to 5): the hardest beginner area

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
