# Oakvale Isle: where we are, and what's next

A handover for whoever continues the starter island. Read `docs/world-plan.md` first for the layout.

## What the owner cares about (keep these)

**Perspective**
- One perspective for everything that stands on a tile: height goes up and left, as walls and roofs do. Furniture uses `prism`, `column`, `drum` and `onSouth` in `sprites.js`.
- Figures (statues, dummies, the scarecrow) stand upright on a base drawn in that slant.

**Drawing**
- Nothing may be cut off. Raised things are drawn on a 96×96 canvas.
- Shadows lie under the foot of a thing, so nothing floats.
- Big things span several tiles and join up seamlessly. See `BIG` and `PARTS` in `sprites.js`: the bed is 1×2, the fountain is 2×2.
- Mountains have a clean, even grey top with a rim of boulders along the edge.

**Placement**
- Buildings stand at least two tiles clear of the town wall.
- Nothing stands in a doorway or straight in front of a door.
- No two things overlap or lean into each other. A lamp next to a wall, for example, leans over it.

**Feel and process**
- The island should feel like the classic starter island (the owner's Rookgaard screenshots), in our own style and with our own names.
- Fix what the owner circles. Don't redo everything at once.
- Show the work at 2× zoom before going live.
- Go live only when the owner says "zet live".

`tests/world.test.js` checks the placement rules. Run it after every map change, together with `node tests/editor.test.js` and `node tests/browser.test.js 20`.

## Advice 1: making the sprites come alive

The game's sprites are drawn by code (`sprites.js`). That got us far, but it has a ceiling: hand-made pixel art looks better. Three steps, in order of payoff:

1. **A sprite sheet per category, drawn by hand or with a tool, loaded as PNGs.**
   - The game can already replace any sprite with a PNG (`sprites/custom.js`).
   - Extend that to sheets: one PNG per category (ground, nature, furniture, walls), each a grid of 32×32 cells (96×96 for raised things).
   - Add a small table that maps each thing id to its cell.
   - Drawing tools: Aseprite (paid, the standard) or LibreSprite and Piskel (free).
   - Use one fixed palette of about 32–48 colours for the whole game. A shared palette is what makes a game look like one piece.
2. **Animation brings it to life.** Cheap wins:
   - water that moves at the shore
   - flags and banners that wave
   - smoke from chimneys (already there)
   - flickering torches (already there)
   - birds and butterflies on the meadows
   - fish jumping in the lake
   - leaves falling in the woods

   Each is a few frames in the same sheet, listed in `ANIMATED`.
3. **Variety per tile.**
   - Every common ground and plant needs 3–4 variants, so nothing repeats in a grid. `VARIANTS` already supports this.
   - Small details make the difference: cracks in the cobbles, weeds along walls, moss on the north side of rocks, puddles after rain.

## Advice 2: NPCs and the story

**What's usable now.** `npcs.js` holds the NPCs, quests and story of the old world: Brightwater Isle, Valoria and the main story "the Ember Seal". The *systems* are good and can be reused as they are:
- dialogue with clickable keywords
- shops
- kill, fetch and step quests
- quest chests
- the guide with its arrow

The *content* belongs to the old island. On Oakvale none of those NPCs are placed, and the guide still talks about Brightwater Isle. Keep the main story for the mainland (it starts at level 8–10). Give Oakvale its own people and its own beginner story.

**A beginner story for Oakvale: "The Silent Bell".** It is planned as a route that teaches the game:

1. **Temple.** Sister Ama (the priestess) welcomes you. The town's bell has stopped ringing, and people say rats chewed the rope in the cellar. She sends you to the academy. *Teaches: talking and keywords.*
2. **Academy.** Master Orin (the teacher) gives you a club and a coat. He asks you to show your training on the dummies in the yard. *Teaches: equipment and fighting.*
3. **Depot.** The postmaster gives you a letter for Pip and explains your locker. *Teaches: the depot and items.*
4. **Pip's Provisions.** Pip buys the rat tails you bring and sells you a rope and a shovel. *Teaches: trading.*
5. **The sewers** (under the grates). You clear the rats, find the chewed bell rope and a strange carved stone. *Teaches: dungeons, loot and levels 1–4.*
6. **Outside the walls.** Wolves in Wolf Woods and the frogs of the marsh. The hunter at Fisher's Rest gives a small hunting task. *Levels 4–6.*
7. **The stone.** The carved stone points to Bone Rocks and the crypt below. Old Wim's gravestone ("went down the well for a bet") is a hint to the well. *Exploration and secrets, levels 6–8.*
8. **The bell rings again.** The oracle upstairs in the academy, now open at level 8–10, asks you to choose a vocation. Then you sail to the mainland, where the Ember Seal begins.

**About 12 NPCs, each with a job:**
- Sister Ama, the priestess
- Master Orin, the teacher
- the oracle
- the postmaster at the depot
- Pip (general goods)
- the smith (weapons)
- the armourer
- the magic seller
- the baker
- the innkeeper
- a guard at each gate, with tips about the dangers outside
- a fisher at Fisher's Rest
- a hermit on Hermit Rock

Two or three townsfolk wander about with gossip that points to secrets.

**Monsters, harder the further you go from town:**

| Where | Monsters |
|---|---|
| Sewers | rats |
| Sunny Fields | rabbits, snakes |
| Wolf Woods | wolves |
| Frog Marsh | frogs, slimes |
| Goblin Hill | goblins |
| Spider Hills | spiders |
| Bone Rocks | skeletons in the crypt |
| Deer Woods | deer, bears |

## Advice 3: the map feels bare. How to make it rich

**What's missing is life and places with a story, not more trees.**

1. **Small places outside town, each with a reason to go there:**
   - a fishing hamlet at Fisher's Rest with a pier and boats
   - the lighthouse
   - a farm with fields and a windmill in Sunny Fields
   - a ruined tower on the Old Tower hill
   - a goblin camp with tents and a fire
   - the hermit's hut
   - a stone circle
   - an abandoned mine at the North Peaks

   The clearings for most of these already exist in the map data.
2. **Caves and dungeons under the rocks:**
   - the rat sewers under town
   - a cave under the North Peaks
   - the crypt under Bone Rocks
   - spider caves under the Spider Hills

   This is phase 5 in `world-plan.md`. The floor-change checks are ready.
3. **Paths that invite you in:**
   - signposts at every fork
   - a bridge you have to find
   - a locked gate with a key somewhere else
   - a cave you only see once you're standing next to it
4. **Details:**
   - fences along fields
   - haystacks and carts on the farm
   - crates and nets at the pier
   - camp sites
   - mushroom rings in the woods
   - bones near the dangerous places
   - flowers along the paths near town, and fewer further out

**Suggested order:**
1. NPCs and the beginner story in town, with the rat sewers.
2. The places outside town, one at a time.
3. The caves.
4. The sprite sheets, in parallel, whenever there's art.
