# ChatGPT prompt: world sheet 1 (small things on the ground, and a few that stand on their own)

Things in the world, not in the bag, so they're seen in the game's own camera. Attach two pictures:
1. `sprites/founder-statue.png` (the style everything follows: the statue west of the temple)
2. one painted ground you like (the grass or the cobbles), so the ground things match it

and paste:

```
Create a sprite sheet of 10 objects for a top-down fantasy RPG, on a fully TRANSPARENT background (PNG with alpha, no checkerboard, no paper, no frame, no labels, no numbers, no grid lines).
Layout: 5 columns × 2 rows, each object centred in its own equal square cell with clear empty space around it.
Style: exactly like the attached statue: painterly, solid chunky shapes with crisp bevelled edges, each surface painted with its material, muted natural colours, a thin darker edge (not black), no glow, no shine.
Camera (important): the ground is seen from straight above. Anything with height leans UP and to the LEFT (its top is drawn up-left of its foot), like the statue. Light from the top left: tops lightest, front faces mid, right faces darkest; a soft shadow on the ground to the lower right.
Size: every object stands on one square floor tile; flat things lie inside that square; tall things rise above it, up-left.
Order, left to right, top to bottom:
1 a few wild flowers in the grass (small white, yellow and violet blossoms, flat, from above, no ground under them),
2 a tuft of tall wild grass (a few long blades leaning up-left),
3 a clump of reeds with brown cattails (for a marsh edge),
4 a scatter of fallen autumn leaves (flat on the ground, from above),
5 a scatter of small grey pebbles (flat on the ground, from above),
6 a small woven rug in faded red and gold (flat on the floor, from above, a square),
7 a wooden hand cart with two wheels and a few sacks in it,
8 an old bronze cannon on a wooden carriage, its barrel pointing LEFT (west),
9 the same cannon with its barrel pointing RIGHT (east),
10 a tall weathered stone obelisk with faint glowing blue runes, leaning up-left like the statue
```

Send the sheet back as it comes out: it is cut up and put in the world.

## Done

In the game (tests/install-world.py): flowers, tall grass, reeds, fallen leaves, pebbles, the hand cart (wagon), the cannon both ways, the obelisk. The rug was left out: rugs join up into one carpet across tiles, so they keep the carpet texture.
