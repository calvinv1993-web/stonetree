# Research: classic starter islands and the Tibia way of mapping

Notes behind the Oakvale Isle design, which is our own island in that style.
- The wiki and mapping-forum pages (tibia.fandom.com, otland.net) couldn't be opened from the build environment. Only search summaries came through.
- The rest is general knowledge of how the genre's maps are built, and a study of map A (the imported map, kept on the `backup-before-rookgaard-world-2026-11-04` and `backup-before-new-island-2026-11-04` branches).

## What makes a classic starter island work

**The town is the hub.**
- It sits in the middle of the island, and every road starts at it.
- Inside it: the temple where you wake up (a protection zone), a depot, shops (weapons, armour, general goods, food, magic), a training area, an academy-style hall with the oracle upstairs, and a few houses.
- A wall with gates marks where safety ends. The hunting grounds are outside the walls.

**There's water at the town.** A river or channel runs past it with bridges into town. That gives the town a shape and natural chokepoints.

**Hunting gets harder with distance and depth:**

| | Where | What lives there |
|---|---|---|
| Easiest | under the town (sewers) and the fields just outside the gates | rats, bugs |
| Easy | the woods and the swamp | snakes, spiders, wolves |
| Middle | the hills and caves further out | goblin and troll types, bears, skeletons |
| Hardest | the far corners and the deepest caves | a strong beast and poison spiders |

**There's lots to find.** Many small quests (chests in houses and caves, keys and locked doors, an NPC errand chain) reward exploring every corner.

**Players leave from the town's high point** (the oracle), at a level requirement, once they've chosen a vocation. They never come back.

**The numbers we're aiming for** (sources differ on the exact counts):

| | Target |
|---|---|
| NPCs | about 20–26 |
| Quests | about 10–12 |
| Hunting grounds | about 15 |

## How the classic maps are built

**Ground layers and borders.**
- Grounds are layered: water, then sand, then dirt, then grass, then rock.
- The higher ground's border lies over the lower ground, with straight pieces and inner and outer corners.
- Borders are what make a map look finished. Bare tile-to-tile edges look unfinished.
- *Here:* `Sprites.border` draws them, now with three shapes per side, a rim, a shadow and grass tufts or pebbles along the edge. Cave floor and marble have borders now too.

**Mountains.**
- They're drawn as walls with the ground continuing one floor up.
- The edge gets a mountain border so the height reads clearly.
- Paths up are on the visible (south or east) faces.
- *Here:* `cliff` with the top one floor up, and a new rocky `lip` along the open edges of raised ground.

**Nature comes in clumps.**
- Trees stand in groups with bushes and ferns at the edges of the groups.
- Flowers grow in patches, and stones gather by mountains and on stony ground.
- Shorelines are irregular, with boulders in the shallows off rocky coasts.
- Avoid an even random scatter, straight lines and perfect circles.
- *Here:* noise-driven clumps and glades. There are also new small details: `pebbles`, `shells`, `leaves`, `grass_tuft`, `driftwood`.

**Paths meander.** They're worn dirt, one or two tiles wide, and never ruler-straight. Roads into town are wider.

**Caves** (phase 5).
- Rock walls one or two tiles thick enclose everything.
- Tunnels are two to four wide, opening into rooms.
- Stairs and ladders stand against a wall, with a free tile in front of them on both floors.
- Every way down has a way back up.
- Cave floors get details: stones, bones, puddles.
- *Here:* `tests/world.test.js` enforces most of these rules.

**Towns** (phase 3).
- Streets two or three wide, with buildings one or two tiles apart and doors facing the street.
- The depot and temple sit near the centre.
- Shops have counters.
- Signs at the gates and junctions.

## What map A got right, and what to fix

**Right:**
- A dense, central town.
- A river with bridges at the town.
- Many separate places all over the island.
- Lots of underground.
- Thick fir forests.
- Rocky patches.
- Buildings out in the countryside.

**To fix:**
- 214 floor changes, many without a proper way back.
- Cave floors painted solid "cave" across whole floors (tens of thousands of tiles) with almost no walls.
- Blocky dirt patches.
- Hard edges between grounds.
- Boulders standing in open water away from the shore.
