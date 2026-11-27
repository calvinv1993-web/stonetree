# Sprites to repaint (after phase 3, colour grading)

These pictures were noted during phase 3 (colour grading). The grading leaves them alone or only softens them, and
they are next to be repainted, one at a time, outside the game (ChatGPT), then put back in `sprites/` under the same
name and size.

The numbers are measured on each PNG's solid pixels:
- **sat** is saturation, from 0 (grey) to 1 (pure colour).
- **bright** is brightness, from 0 (black) to 1 (white).

For comparison, the graded ground in daylight is about sat 0.50 to 0.60 (grass) and 0.37 (the square's stones).

## How to deliver a repaint

- **Same canvas.** Use the same pixel size, a transparent background, and the thing in the same place in its picture.
  Its feet must stand where they stood: the game reads the foot line for the shadows.
- **The art style** of `docs/art-style.md`:
  - light from the north-west
  - a dark, soft outline
  - shading by darker colour, not by black
  - the same slant as the walls (trunks and stalks lean up-left as they rise)
- **No shadow painted under it.** The game draws a thing's shadow from its own shape.
- **After putting it in `sprites/`:**
  - run `node tests/sprite-versions.js`
  - look at it in the game at noon, at night and on a phone at quality low
- **Once the plants are repainted calmer**, drop the half-strength grading they get in the game. That is
  `GROWING` in `js/render.js`: plants are graded at half strength so that they stay as far from the grass as before.

## The list

| what | file(s) | now | aim | why |
|---|---|---|---|---|
| round tree crowns | `tree@4x.png` | sat 0.79, bright 0.28 | sat ~0.60, crowns a touch lighter (~0.32) | the strongest green in the woods; dark crowns read as blots on a phone |
| pines | `pine@4x.png` | sat 0.85 (5 % at 1.0), bright 0.24 | sat ~0.60, bright ~0.28 | pure green needles; the darkest thing in daylight |
| bushes | `bush@4x.png` | sat 0.81 (5 % at 1.0) | sat ~0.60 | as the trees |
| ferns | `fern@4x.png` | sat 0.76 | sat ~0.60 | |
| tall grass | `tallgrass-0/1/2@4x.png` | sat 0.94 | sat ~0.60 | the most saturated thing on the island |
| grass tufts | `grass-tuft@4x.png` | sat 0.71 | sat ~0.58 (the grass's own) | should melt into the grass |
| the grass's blades over feet | `grass-fringe.png` | sat 0.94, bright 0.27 | the grass's own colours (sat ~0.58, bright ~0.33) | drawn over every foot in the grass: it must be the grass, not greener |
| crops | `crops@4x.png` | sat 0.91 | sat ~0.65 | |
| reeds | `reeds-0/1@4x.png` | sat 0.69 | sat ~0.58 | fine; with the others for one set |
| flowers | `flowers-0/1/2@2x.png`, `@4x.png` | sat 0.65 (5 % at 1.0), bright 0.55 | keep the colours, soften the purest petals (top ~0.85) | pin-pricks of pure colour across every meadow |
| the temple's marble | `marble-atlas.png`, `temple_marble_64.png` | sat 0.14, bright 0.86 (top 0.92) | bright ~0.78, a little more veining | close to pure white at noon: the floor flattens, and the AO and contact shadows hardly show on it |
| white pillars | `pillar_white@2x.png` | bright 0.64, top 0.90 | top ~0.82 | as the marble |
| the temple's white walls | drawn in code (`whitePlaster` in `js/sprites.js`) | near white | a warm off-white (~0.80) | they glare at noon; repaint as a PNG or soften in code |
| altar | `altar@2x.png` | bright 0.72, top 0.97 | top ~0.88 | the brightest thing in the temple, after the walls |
| red rugs and the altar cloth | `carpet-atlas.png` | **sat 0.95**, bright 0.15 | sat ~0.70, bright ~0.22, a deep wine red | the most saturated red in town; nearly black-red in shade |
| market stalls | `stall@4x.png` | sat 0.62, top 0.82 | the awning stripes ~0.65 | loud next to the calmer square |
| flower boxes | `window-box-s.png` (and `planter`, drawn in code) | sat 0.67 | ~0.60 | as the stalls |
| the sewer's slime | `monster-slime.png` | sat 0.80 (5 % at 0.98) | ~0.65, a colder green | the one warm, bright green underground, against its cool mood (`monster-cistern_slime.png`, 0.48, is right) |

Mushrooms (`mushrooms@4x.png`, sat 0.62) are fine as they are: their red caps are meant to catch the eye.
