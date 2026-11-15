# Fill-in templates

Sheets, one per kind of picture. Fill in the white frames and run on into the pale blue bleed round them (as print
does: the cut is on the red dashed line, so the picture always goes on past it), keep the pink corner marks, and send the sheet
back; `python3 tests/cut-template.py <filled.png> <kind> <folder>` cuts each frame out at its exact size, even when the
sheet came back scaled. Every sheet carries the style card (the founder's statue: `docs/style-reference.png`).

| Sheet | For | Drawn |
|---|---|---|
| `wall.png` | every wall: houses, the town wall, the temple, caves, sewers | its face straight on (4 tiles, seamless) and its top from above; the game builds posts, corners and both directions |
| `ground.png` | grounds and roofs | one square from straight above, seamless both ways |
| `on-wall.png` | doors, windows, signs, lanterns, banners | straight on; the game lays it into the wall and gives it depth |
| `thing.png` | anything standing: statues, trees, furniture, stalls | in the world's camera, on its tiles (1, 2 x 2 or 3 x 3), height up-left |
| `front.png` | anything standing, from its front only | straight on; `tests/front-to-thing.py` stands it up and builds its top and east side from it, as a block |
| `ground-border.png` | a ground and its ragged edge, painted as one | the square from above and its edge strip; `tests/install-ground-border.py <filled> <id>` puts in both |
| `item.png` | items | the item alone |

`tests/make-templates.py` draws the sheets again (after the style card changes).

## A wall, start to finish

1. Fill in `wall.png` (the face straight on, 4 tiles, seamless; the top from above).
2. `python3 tests/install-wall.py <filled.png> wall_stone` (or `wall_wood`, `wall_rampart`, `wall_temple`; `--inside`
   with a second sheet for the face inside a building).
3. Every wall of that kind is built from it (`wallFromStrip`): posts, corners and both directions all cut from the one strip.

## Seams

A strip ChatGPT draws is never quite seamless, and a cut taken right at the frame's edge brings the frame's outline
along. So `tests/cut-template.py` cuts a couple of pixels inside each frame and blends every strip's ends into each other
(a square's both ways). `python3 tests/check-seams.py` checks every wall strip and top in `sprites/` and fails on a seam.
