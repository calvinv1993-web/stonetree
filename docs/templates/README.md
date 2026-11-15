# Fill-in templates

Five sheets, one per kind of picture. Fill in only the white frames, keep the pink corner marks, and send the sheet
back; `python3 tests/cut-template.py <filled.png> <kind> <folder>` cuts each frame out at its exact size, even when the
sheet came back scaled. Every sheet carries the style card (the founder's statue: `docs/style-reference.png`).

| Sheet | For | Drawn |
|---|---|---|
| `wall.png` | every wall: houses, the town wall, the temple, caves, sewers | its face straight on (4 tiles, seamless) and its top from above; the game builds posts, corners and both directions |
| `ground.png` | grounds and roofs | one square from straight above, seamless both ways |
| `on-wall.png` | doors, windows, signs, lanterns, banners | straight on; the game lays it into the wall and gives it depth |
| `thing.png` | anything standing: statues, trees, furniture, stalls | in the world's camera, on its tiles (1, 2 x 2 or 3 x 3), height up-left |
| `front.png` | anything standing, from its front only | straight on; `tests/front-to-thing.py` stands it up and builds its top and east side from it, as a block |
| `item.png` | items | the item alone |

`tests/make-templates.py` draws the sheets again (after the style card changes).
