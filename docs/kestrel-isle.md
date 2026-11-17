# Kestrel Isle: the plan

The new world (played as a preview for now: Menu, "Preview: the new world"). Built the way Rookgaard is built, with
places of its own. The picture of every layer is `kestrel-isle-layers.png` beside this file.

## The layers

- **+1, above ground**: rock outcrops all over the isle, their tops walkable; the ridge of the Kestrel Peaks with the
  eyrie (+2, +3); the ruined watchtower, the lighthouse, the temple rock with the bell tower.
- **The surface**: Bellhaven in the middle, drawn by hand tile by tile (`KESTREL_TOWN_ART` in `js/world-kestrel.js`),
  its edge closed by rock, short pieces of wall and the backs of houses, as Rookgaard's is; the harbour in a bay to the
  south. Round it the wilds, with game spread over them: Old Wood (wolves, bears, spiders), the Standing Stones moor
  (deer, snakes), the Goblin Hills, Saltmire (snakes, crabs), the Farmsteads (rabbits, sheep), Lighthouse Cape (crabs),
  the Kestrel Peaks (wolves). A river from the peaks to the town, a lake in the north-east and its brook to the bay.
- **Under the whole isle, four layers of caves**, harder the deeper, each a few large named caves and many small ones,
  joined by winding tunnels with loops:
  - -1: the sewers under Bellhaven (rats, a grate beside the temple), wolf dens, a snake pit, the mire cellar, the
    smugglers' cave, farm cellars, the peak tunnels
  - -2: the goblin warrens, the spider halls, the old cistern, root caves, salt caves
  - -3: the sunken crypt (skeletons), the deep webs (the Brood Queen), the goblin mine (Gnash), the drowned hall
  - -4: the Deep Hall (King Mogg), the crypt vault (the Gravewaker), the mine floor
- **Ways in**: about ten from the surface (grates in town, a hole under the great dead tree, cave mouths, cellars), and
  stairs and shafts on down.

## Building it, step by step

1. The isle and Bellhaven (done: the surface; rebuilt small round a courtyard - the temple on its rock at the head of
   it, the depot, store, Hall of Paths, inn, smithy and healer round it, rock arms of the hill as the town's sides, a short
   harbour wall and quay to the south; few trees).
2. The sewers under the town, with the rats and Clang (done: five grates, the bell cellar under the temple with
   Clang's crate, a channel down Main Street to the harbour, the rats' nest; Sister Ama in the temple).
3. The Hall of Paths (done: the Pathkeeper and four teachers in the hall on the square; four practice rooms a floor
   down, reached by a teacher and left by a forcefield, with straw and sparring dummies; trials as each path, safe and
   earning nothing; choosing once all four are tried; the vocations renamed Bastion, Hawk, Ember and Grove).
4. The guide rewritten for Kestrel Isle (done: the basics with Sister Ama, Clang in the bell cellar, the Hall of Paths,
   the four trials, choosing; Sister Ama speaks of Bellhaven); then the easy quests round the town.
5. Layer -1 and its ways in.
6. Layers -2 to -4.
7. New monsters (deer, snakes, sheep, poison spiders, smugglers), once they have pictures.

## How far things are (walking at level 1, from the courtyard)

A step takes 400 ms on a road, 450 on dirt and 550 on grass at level 1 (speed 278). The unit test "how far things are
from the courtyard" checks the first three rows on the real map.

| Place | Aim | Now |
|---|---|---|
| Shops and temple | 10-30 s | 5-12 s (the town is kept small) |
| The town's gates (watchtowers out on the roads) | 20-45 s | west 23 s, north 28 s |
| First monsters out in the open | 30-60 s | rabbits 34 s, crabs 42 s (rats in the store's cellar, in town) |
| Beginner hunting ground | 1-2 min | wolves and spiders of the Old Wood, about 70 s |
| Middling caves | 2-4 min | still to build: their mouths that far out |
| Dangerous wilds | 4-6 min | still to build: the island is 210 tiles across, so its far corners are about 2 min away; 4-6 min needs the mainland, long winding ways (mountain paths, swamps) or a slower walk |

## The town's buildings, and what each is for

- Temple and bell tower (on the rock): you wake there; the tower has four storeys up to the bell.
- Depot: lockers on both floors. General store: its storeroom cellar, down the stairs, has rats.
- Inn: the tavern below, rooms with beds upstairs. Healer: the shop below, a sickroom upstairs.
- Harbour master: three storeys, a lookout over the bay at the top. Warehouse: a trapdoor down into the sewers.
- Hall of Paths: the Pathkeeper and the four teachers (their practice rooms are reached through them).
- The gates: a pair of watchtowers on each road, with stairs up to a lookout.
