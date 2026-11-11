# Tilequest's art style

The rules every sprite follows, so the world looks like one piece. They borrow the way PixelLab works (one camera
for everything, one light, one kind of outline, one shading level, terrain transitions with a layer and a height of
their own), applied to our own camera. Everything is still drawn in code (`js/sprites.js`) or a PNG in `sprites/`.

## Camera

- **One camera for everything**: the ground is seen from straight above; height goes **up and to the left**, 0.6 pixel
  up and 0.6 left per unit (`P(u, v, z)` in `sprites.js`; a floor is 32 pixels high). Walls, roofs, furniture, statues,
  poles and upper floors all follow it. Nothing is drawn in another perspective.
- **Things on walls** hang against the wall's face, in the face's own slant, and have real depth in it
  (`wallSpot`, `wallBox`, `wallPoly`, `onWallPlane`): a window is a recess with its glass at the back and a frame and
  sill standing out; a torch, a lantern or a sign is an object on an iron bracket standing out from the face; a banner
  hangs flat against it, with its shadow on the wall.
- Only flames rise straight up the screen (fire goes up), and the figures: people, and the figures of statues (`stoneFigure()`: a person's figure in marble or bronze, upright on a plinth that leans as things do).
- **Players** are drawn from the owner's own picture, `sprites/player-sheet.png` (`playerFromSheet()`): front, side and back, standing and two steps, at 4 pixels a world pixel; their hair, shirt, trousers and boots take the outfit's colours. A new sheet for other outfits follows the same layout (cells of 32 x 48 world pixels, feet at 16, 46).
- **An NPC with its own sheet** (`sprites/custom.js`: `sheet_<npc id>`, laid out as the player sheet, e.g. Sister Ama: `npc-ama.png`) is drawn from it as it is (`npcFromSheet()`).
- **Other people** stand upright (`tiltPerson()`, `Sprites.PEOPLE = 'tilt'`, `Sprites.TILT = 0`): a plain figure seen from the front, back or side, big simple shapes (head with hair and a face, body, belt, arms and hands, legs and boots) in two or three tones, lit from the top left, at a pixel per world pixel with a black edge. `TILT` can lean them along the world's slant (degrees); the owner chose upright. Looks it can't draw (bones, wings, tails...) and the beasts are dolls (`doll()`). Tried before and not used: `'art'`, `'hd'`, `'pixel'`, `'lean'`.
- Nothing with thickness is a flat picture: give it its sides and its shadow in this camera.

## Light

- From the **north-west**, high up. Lit: tops, north and west edges. In shade: south faces a little, **east faces
  most**. Shadows fall **south-east**, soft, on the ground below.
- Every raised thing touches the ground with a contact shadow (a dark line or soft patch on its south-east side).
- Shadows follow things' shapes, not the tiles: walls, statues, furniture and big things cast a soft shadow of their foot's
  shape, a few pixels south-east, with a tight dark one where they touch the floor (`Sprites.dropShadow`). Only blocks that
  fill their tile to the edge (rock sides, the town wall) shade the ground of the tiles south and east of them
  (`Sprites.castShadow`), drawn with the ground's chunks.

## Outline

- **Selective outline**: an edge is a darker shade of its own colour, not black. Edges against the light (north-west)
  may be lighter instead. Black is only for gaps and deep shadow.
- People and monsters keep their soft dark outline (they must stand out from the ground).

## Shading and colour

- **Medium shading**: three or four tones per material (light, base, shade, deep shade), plus a highlight where the
  light catches an edge. No gradients on small things; small bands of tone instead.
- Few colours per material; neighbouring materials share their shadow tones, so they sit in the same light.

## Ground and transitions

- Each kind of ground has a **height**: paving and water lowest, then sand, dirt, grass, snow. Where a higher ground
  meets a lower one, it spills over the edge (the dual-grid idea: the edge depends on the neighbours on all sides and
  corners, so straight edges, outer corners and inner corners are one smooth line).
- A transition is a **layer of its own**, not a line: a higher ground shows its **side** (turf over soil, a sand bank,
  a crust of snow) on its south and east edges, as a box would, with its top edge lit on the north-west and a shadow
  on the lower ground.
- **Border jitter**: the edge wanders a little, never in a repeating zigzag; tufts and pebbles break it here and there.

## Checking

- Look at it in the game, at 2x, on a phone: `node tests/screenshot.js` or the browser tests.
- Compare it with what's next to it: same light, same outline, same shading.
