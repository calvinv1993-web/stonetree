# ChatGPT prompts: monsters and people on two legs, and sheet 8 of items

The testers' biggest visual note: skeletons, goblins and the Choir are plain "dolls" next to the painted people. Every
character below gets a sheet laid out exactly like Sister Ama's (`sprites/npc-ama.png`), so the game draws it walking
in four directions (west is the side row mirrored).

**Each time:** attach `sprites/npc-ama.png` (the layout and the style), paste the **common part**, then **one character**
from the list. One character per picture works best. Send the sheet back as it comes out: it is cut up and put in the game.

## The common part (the same for every character)

```
Create a character sprite sheet for a top-down fantasy RPG, in exactly the same style, size and layout as the attached sheet (Sister Ama), on a fully TRANSPARENT background (PNG with alpha, no checkerboard, no paper, no frame, no labels, no grid lines).
Layout: 3 columns × 3 rows, each figure centred in its own equal cell, the same scale in every cell, feet on the same line in every row.
Row 1: facing the viewer (south). Row 2: side view, facing RIGHT (east). Row 3: back view (north).
Column 1: standing still. Column 2: walking, left foot forward. Column 3: walking, right foot forward.
Style: like the attached sheet: chunky pixel-art proportions (big head, small body), a dark outline, soft shading lit from the top left, muted natural colours, no glow, no text.
The character:
```

## Monsters (the most important first)

1. **Skeleton** (`skeleton`): `a skeleton warrior: yellowed old bones, empty dark eye sockets, a rusty iron helmet with a dent, a cracked round wooden shield on one arm and a short rusty sword, a few rags of a grey tunic`
2. **Goblin** (`goblin`): `a small goblin: green skin, long pointed ears, a big nose and a wide grin with crooked teeth, a ragged brown leather vest and a loincloth, bare feet, a crude wooden club`
3. **Goblin archer** (`goblin_archer`): `a goblin archer: green skin, pointed ears, a hood of patched brown cloth, a short bow in one hand and a quiver of crooked arrows on the back, ragged leather`
4. **Chief Gnash** (`gnash`): `a goblin chief, a head taller than other goblins: green skin with war paint, a crown of bones and feathers, a necklace of teeth, a fur cloak, a big spiked club`
5. **The hoardkeeper** (`goblin_hoardkeeper`): `a fat greedy goblin: green skin, a sack of stolen coins over one shoulder, a brass key on a string round his neck, a dented pot as a helmet, a short knife`
6. **Choir singer** (`choir_cultist`): `a cultist in a long ash-grey hooded robe, the face hidden in shadow under the hood, a small flame-inside-a-ring sign stitched on the chest in dull orange, hands holding a tiny glowing ember`
7. **Choir Cantor** (`choir_cantor`): `the leader of the ash-grey cult: a taller figure in a long dark-grey hooded robe with orange-red trim, a flame-inside-a-ring sign in gold on the chest, a staff topped with a smouldering ember, a satchel at the hip`
8. **The Gravewaker** (`gravewaker`): `a tall undead knight in an ash-grey hood over old plate armour gone dull and dark, a pale grey face, a long sword, ash drifting from the sleeves; once a proud knight, now grim`
9. **The watchman's shade** (`watchman_shade`): `the ghost of an old town watchman: pale blue-grey and half see-through, an old watchman's helmet and a long coat, holding a lantern and a spear, sad and stern`

## People without their own sheet yet

10. **Landlady Hettie** (`oak_landlady`): `an older landlady: grey hair in a bun, a green dress with a cream apron, a ring of keys at her belt, friendly round face`
11. **Keeper Tamsin** (`oak_keeper`): `an old lighthouse keeper woman: grey hair, a dark blue oilskin coat, sturdy boots, a lantern in one hand, weathered face`
12. **Hermit Brannoc** (`oak_hermit`): `an old hermit: long white hair and a long white beard, a patched brown robe tied with rope, a gnarled walking staff, barefoot`

(More people come with the new quests: their descriptions are added here when they're in the game.)

## Sheet 8 of items: the new quests' finds

Paste the common part of `docs/chatgpt-items-sheets.md`, then:

```
1 watchman's greaves (old steel leg armour with a town crest),
2 bronze ward (a round bronze shield with a raised boss, a little green with age),
3 lucky ring (a plain worn silver ring with a tiny four-leaf clover),
4 tail of Whiskerjack (a long white rat tail),
5 hide of Old Scarjaw (a black wolf hide with a scar across it),
6 shell plate of Ironclaw (a blue-steel crab shell plate),
7 spinneret of Silkwidow (a red-marked spider gland with silk threads),
8 whetstone of Grubnose (a small grey sharpening stone, stained),
9 dented helm of Sir Clatterbones (a dented old iron helmet),
10 glimmering core (a golden glowing slime core, like amber),
11 claw of Mossback (a big bear claw with a bit of moss on it)
```
