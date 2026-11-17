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

1. The isle and Bellhaven (done: the surface).
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
