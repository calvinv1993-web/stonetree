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

## 3. The island (phase 2: geography, done)

| Place | Where (x, y) | What |
|---|---|---|
| Thistlewick | 98–140, 112–146 | Town site: kept clear for walls, streets and buildings (phase 3) |
| Glassmere | 116–148, 46–70 | The lake in the north, source of the river |
| The Wick | lake → 185, 212 | A river 3 tiles wide, east of town, out to the south coast |
| Highmoor | 74–108, 48–84 | Mountain in the north-west, with a summit two floors up. Path up at (90, 81) |
| Old Pinewood | 44–84, 86–128 | Dense fir forest in the west |
| Northwood | 150–178, 36–64 | Mixed wood east of the lake |
| Seal Bay | 172–216, 52–78 | Bay on the north-east coast |
| Eastwood | 162–212, 88–152 | Large oak forest east of the river, with a pond |
| Watch Hill | 188–206, 100–118 | Hill in Eastwood. Path up at (196, 117). For a ruined watchtower (phase 4) |
| Cragend | 190–210, 170–192 | Rocky headland in the south-east. Path up at (199, 190). Cave entrance planned (phase 5) |
| Southfields | 104–142, 156–186 | Flowery meadows south of town. Farm planned (phase 4) |
| Bramble Marsh | 80–104, 178–210 | Swamp with pools, and Bramble Creek running to Gull Cove |
| Gull Point | 50–92, 200–238 | Peninsula in the south-west |
| Saltreed | 46–60, 142–158 | Site of the fishing hamlet on the west coast (phase 4) |
| Hollow Copse, Riverside thicket, Southfield grove | see `ISLE_DESIGN` | Small woods |
| Gannet Rock | 222–244, 202–224 | An islet off Cragend. There's no way there yet (see open questions) |

Roads (2 tiles wide) leave the town site north, east, south and west, and go on to Cragend. Paths
(1 tile wide) lead to Highmoor, Northwood, Seal Bay, the marsh, Gull Point, the Pinewood and the
Copse. There are three bridges over the Wick: the east road, the Cragend road and the Northwood path.

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
- a hermit's hut on Gull Point
- signposts
- camps
- the hunting grounds, from easy (near town) to hard (far out):

| Danger | Hunting grounds |
|---|---|
| Easiest | Southfields, Lakeside |
| Easy | Pinewood, Hollow Copse, Bramble Marsh |
| Middle | Northwood, Eastwood |
| Harder | Watch Hill, Highmoor, Cragend, Gull Point |

### Phase 5: underground

These caves are a design proposal, since there's no underground reference:
- **Town sewers** under Thistlewick (z 7)
- **Highmoor caves** (z 7 and 6)
- **Cragend caves** (z 7 to 5): the hardest beginner area
- **Marsh hollow** (z 7)

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

1. **Gannet Rock:** should it be reached by a boat (an NPC ride), a sandbar at low tide, or not at all?
2. **Leaving the island:** today the game sends level-8 players to the mainland (Valoria), but the old mainland is no longer in the built-in world. Should Thistlewick be the whole world for now?
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
