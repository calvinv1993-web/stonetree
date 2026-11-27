# Performance results per phase

How to measure: [README.md](README.md). Each phase is compared with the baseline below (phase 0), on the same device
and with the same settings.

The rendering plan, in order (agreed with the owner):

| phase | what | state |
|---|---|---|
| 0 | baseline measurement (this file) | done: computer and iPhone (quality low) |
| 1 | baked ambient occlusion in the ground chunks | done on the branch; iPhone runs to add |
| 2 | contact shadows (figures, things on the ground) | on the branch; waiting for approval |
| 3 | colour grading | - |
| 4 | optimising the existing light engine | - |
| 5 | atmospheric lighting indoors | - |

## Phase 0: baseline (ui528, 2026-11-27)

### Computer: headless Chromium as an iPhone (390 x 844 @3x, canvas 1280 x 2048, sharp 4, quality high, 60 fps setting)

Three runs (`results/2026-11-27-ui528-headless-iphone-{1,2,3}.json`), the median of each measure:

| part | fps | work p50 ms | work p95 ms | stalls | load s | chunks made / ms | pictures MB |
|---|---|---|---|---|---|---|---|
| square-day | 30 | 2.0 | 4.5 | 0 | 0.1 | 14 / 140 | 413 |
| church-inside | 30 | 1.6 | 3.1 | 0 | 0.2 | 2 / 56 | 422 |
| tower-top | 28 | 13.6 | 22.2 | 7 | 15.1 (gave up) | 11 / 62 | 427 |
| walk-street-day | 48 | 1.9 | 21.3 | 5 | 15.1 (gave up) | 14 / 82 | 436 |
| outside-east | 31 | 1.6 | 2.3 | 0 | 0.4 | 12 / 109 | 439 |
| sewer | 39 | 3.3 | 5.8 | 4 | 15.1 (gave up) | 15 / 13 | 452 |
| square-night | 30 | 2.5 | 3.7 | 2 | 0.1 | 0 / 0 | 452 |
| walk-street-night | 33 | 3.1 | 22.3 | 51 | 0.1 | 0 / 0 | 452 |

In all: work p50 2.5 ms, worst p95 22.8 ms, 68 chunks made in 478 ms (the longest single go 303 ms, the first
chunk while sprites are still being made), pictures kept 452 MB at the end: ground chunks 64 MB (97), sprites 379 MB
(2287 pictures), the view's canvases 10 MB. Script heap 25 to 30 MB.

What stands out already, before any change (for later phases, not fixed now):

- **The sprites kept take most memory**: about 380 MB of pixels at sharpness 4 after this route, and growing with
  every new place (they aren't let go of). The ground chunks are capped (64 on a phone, 64 MB). On an iPhone the
  canvas memory has a hard limit, so any phase that keeps more pictures must be watched here first.
- **The tower top is 7x the work of other places** (13.6 ms against about 2 ms), at sharpness 4. At sharpness 3
  (a 2x screen) it was 1.9 ms: something there is drawn finely and expensively every frame (the tower's cap, the
  bell, or the church roof's hole), to look into in phase 4 or before.
- **Some jumps keep the loading screen up the full 15 s** (to the tower top, the start of the street walk, the
  sewer): its "ready" check never completes there and it gives up. Players see this after a long teleport.
- The night walk has the most stalls (8 to 69 across the three runs: noisy here); on the phone it's to be seen.

### iPhone: the baseline that counts (ui530, home-screen app)

The owner's iPhone (screen 428 x 926 points @3x, iOS 18.7, 4 cores), as a home-screen app, **quality low** (the
setting played on: canvas 704 x 1024, sharpness 2), 60 fps setting. Three runs
(`results/2026-11-27-ui530-iphone-{1,2,3}.json`; the third marked as the baseline in the phone itself), the median of
each measure. Every later phase is measured the same way: the same phone, quality low, three runs.

| part | fps | work p50 ms | work p95 ms | stalls | load s | chunks made / ms | pictures MB |
|---|---|---|---|---|---|---|---|
| square-day | 41 | 2 | 6 | 3 | 0.1 | 14 / 315 | 181 |
| church-inside | 31 | 1 | 2 | 0 | 0.3 | 4 / 143 | 188 |
| tower-top | 31 | 1 | 2 | 0 | 0.2 | 14 / 36 | 191 |
| walk-street-day | 60 | 2 | 3 | 1 | 0.2 | 17 / 15 | 193 |
| outside-east | 31 | 3 | 4 | 0 | 0.2 | 16 / 85 | 195 |
| sewer | 30 | 3 | 3 | 0 | 0.3 | 15 / 22 | 201 |
| square-night | 30 | 4 | 5 | 0 | 0.1 | 0 / 0 | 201 |
| walk-street-night | 60 | 2 | 3 | 0 | 0.1 | 0 / 0 | 201 |

In all: work p50 2 ms, worst p95 6 ms, 5 stalls (nearly all on the first part, while the first chunks are made: one
chunk took up to 124 ms), 84 chunks in 625 ms (the longest single go 79 ms), pictures 201 MB at the end: sprites 135 MB,
ground chunks 64 MB, the view 3 MB. (Safari doesn't tell the script heap.)

What it says, set against the computer's run:

- **The phone has room to spare at quality low**: 1 to 4 ms of work in a frame of 16.7 ms; walking holds 60 fps.
  Standing, the game draws 30 a second on purpose (nothing moving near you), so fps there isn't a measure.
- **The tower top is not heavy here** (1 ms, like everywhere else): the computer's 13.6 ms was the test browser's
  software drawing at sharpness 4, not the phone. (At quality high the phone draws at sharpness 4 too: not measured.)
- **No 15 s loading screens here**: every jump was ready in 0.3 s at most (the chunk memory fills more slowly at
  sharpness 2). The fault in the code is real (investigation-phase0.md) but doesn't show at quality low.
- **The memory is the one to watch**: 201 MB of pictures after two minutes, two thirds of it sprites that are never
  let go of, growing with every new place.
- **The night costs the most work** (the square at night 4 ms against 2 by day: the light layer). Between runs it
  varied from 2 to 5 ms.
- One run alone varies: the stalls 3 to 6, the night square 2 to 5 ms, fps standing 29 to 43 (the game's own choice).
  So three runs and their median, and `tests/bench-compare.js` counts a change as worse only past both a share and
  an amount (more than 1 ms of work: the phone's clock gives whole milliseconds).

### iPhone at quality high: drawn as coarse as at low (a finding)

A run at quality high (`results/2026-11-27-ui530-iphone-high-sharp2-1.json`) came out at the same canvas
(704 x 1024) and sharpness (2) as quality low, and so measured the same. The reason: on a phone the sharpness is
`p - sharpDrop - (quality)`, where `p` is 4 on this phone and `sharpDrop` is the automatic step down for a phone that
can't keep up (`checkKeepingUp` in `game.js`). It is **kept for good** in the browser (`tilequest.sharpDrop60`) and
nothing ever takes it back: once a few slow seconds (a loading moment, a hot phone) stepped it down twice, the phone
stays at sharpness 2 whatever the quality says. So the quality setting no longer changes the sharpness here, only the
parts left out (sky, weather, ripples, grass blades).

A true quality-high baseline needs `sharpDrop` back at 0 first (a change, not made yet).

## Phase 1: baked ambient occlusion (2026-11-27)

What: indoors (a floor above the tile), the floor darkens softly where it meets a building's walls, deepest in the
corners: the light from the north-west, so a north or west wall shades more than a south or east one; shades combine
by multiplying, never adding, so a corner never goes black (at most 50 %). `Sprites.ambientShadow(mask)` is one
picture per mask of the 8 walls round a tile (64 x 64, made once), drawn into the ground chunks with the cast shadows
(render.js, the ground's pass): nothing a frame. The masks themselves are worked out 8 x 8 tiles at a time as first
needed and kept per floor (`Render.aoMask`), so ground drawn live (moving water) only looks them up, and a changed tile
(map.dirty) updates only the masks round it. Thin walls only: rock and brickwork keep their own cast shadow (no double
shadows). Each tile looks only at its own neighbours and is drawn on its own tile: no seam at chunk edges. On every
quality, low included (`Render.skip('ao')` is only for the speed meter's test).

Screenshots, the same spots, hour and settings before and after: `phase1/` (temple, temple wall close up, temple on a
phone at quality low, academy, inn).

Computer (headless as an iPhone, sharpness 4), three runs each, before (`phase1-before-*`) and after (`phase1-*`) on
the same machine the same hour: nothing worse past the limits. Work p50 2.1 -> 2.2 ms, work p95 21.5 -> 23 ms (noise
range), chunk time 473 -> 417 ms, pictures 451.6 -> 451.9 MB (the masks: one 64 x 64 picture each, about 30 in use,
0.5 MB; the per-floor mask arrays 64 KB a floor).

iPhone at quality low: to add (three runs after it's live, compared with the ui530 baseline).

### Phase 1 checked before the iPhone runs (ui534)

- **The map editor**: a wall painted or erased with its brush now shades and unshades the floor beside it at once
  (measured in the real editor: the floor east of a painted wall 214.5 -> 186 brightness, erased back to 214.5; ui533
  stayed at 214.5, and so did its cast shadows). The editor's brush (`map.addItem`) and eraser changed a tile's things
  without telling the renderer; both now call `map.changed`, which marks the tile for the kept ground and its shades.
- **Bounded while exploring**: the whole isle explored at quality low (166 jumps over floors 4 to 12): the shade masks
  kept 585 kB (one byte a tile, only floors seen: at most 1 MB for all 16), 51 shade pictures of 16 kB (at most 256
  masks exist: 4 MB). The masks are kept with the map and put right tile by tile through `map.dirty`, never thrown away
  whole except for a new map or a change of more than 400 tiles at once.

## Phase 2: contact shadows (2026-11-27, on the branch, not live)

What was there (the inventory):

| what | its shadow before | phase 2 |
|---|---|---|
| players (sheet) | a generic oval baked into every frame (`groundShadow`, 10 px half width), slanted with the figure | taken out of the frames; a contact shadow drawn under the feet each frame |
| the player's strike | the same oval baked in | taken out; the same contact shadow at its feet |
| NPCs and monsters from a sheet | a soft shadow painted into each sheet by its artist | taken out of the picture as it's made (the PNG unchanged); the contact shadow alone |
| Clang grown up (clang_3) | an extra baked oval | taken out (the contact shadow replaces it) |
| code-drawn creatures | their own `shadow()` in their drawing | unchanged (not from a sheet: no contact shadow added, so none doubled) |
| statues, pillars, altar, depot (fill their tile) | `dropShadow`: their foot's shape, soft and wide plus tight, baked in the ground chunks | unchanged: already a true contact shadow of their own shape |
| furniture on legs: tables, chairs, benches, stalls, pews | `dropShadow` of the legs only (the floor between them stayed lit) | the floor between the legs shaded too (a third layer, wide and soft, made once), baked in the chunks |
| counters, crates, barrels, chests, bookshelves | `dropShadow` of their foot (solid to the floor) | unchanged |
| trees | crown shadow beside the trunk + their own picture's foot | unchanged (no double) |
| rocks, bushes, ferns | `dropShadow` | unchanged |
| walls | cast shadow outdoors, ambient occlusion indoors (phase 1) | unchanged |

How: a figure's feet are read once from its own picture when it's made (`feetOf`: the lowest solid rows, their
middle and width), stored on the picture. The renderer draws `Sprites.contactShadow(width)` there before the figure:
one kept picture per whole-pixel width (at most 48, about 1 kB each), made with gradients once, never a filter, flat
on the ground (not slanted, not lifted), a tight dark core under the feet and a softer spread a little to the
south-east. So it follows the figure as it walks, on any floor and through floor changes, with nothing worked out a
frame. The legged furniture's extra layer is made once per picture (`dropShadow(img, legged)`, a WeakMap like the
others) and baked into the ground chunks like every other thing's shadow, so map edits and moved furniture redraw it
through `map.dirty` (phase 1's fix).

Screenshots (`phase2/`, the same spots, hours and settings, the world paused): temple, temple feet close up, smithy
feet close up, square with NPCs, inn with furniture, woods, the square at night, the tower's belfry, the temple on a
phone at quality low.

Computer (headless as an iPhone), three runs before (`phase2-before-*`, ui534) and after (`phase2-*`): nothing worse
past the limits. Work p50 2.5 -> 2.5 ms, p95 25.6 -> 24.2 ms, chunks 514 -> 517 ms, pictures 454 -> 453 MB.

iPhone at quality low: three runs to add once it's live, against ui534.

### Phase 2 checked before going live (ui535)

- **Steady while walking and striking**: a figure's contact shadow now sits at its stand's feet point and takes the
  width of its standing picture of the same direction, so it doesn't jump or swell from step to step (it had: 3 px
  sideways and 8.5 to 19 px wide across the walk). Measured over every frame of every direction: the player's shadow
  stays at x 48, y 61; per direction one width (9 sideways, 12.5 front and back); a walking NPC the same; the strike
  (12 pictures) sits exactly where the walking figure's is, the same width.
- **No double darkening; the painted shadows out (the owner's choice)**: 38 of the 55 sheets have a shadow painted in
  round the feet. It is now taken out of each figure's picture as it's made (`stripPaintedShadow`: the faint pixels
  round the feet that touch no solid pixel of the figure; the PNG files stay byte for byte as they are), so every
  figure stands on the one contact shadow the game draws, the same for all, at the strength that was approved.
  Checked on all 55 figures (a gallery on a mid-tone floor): nothing of a figure lost, the see-through shade and the
  slimes included.
- **Floor changes**: up the church tower's stairs, floors 8 to 11: the contact shadow under the feet on each floor
  (it belongs to the figure, drawn on its floor, nothing kept per floor).
- **The editor test** expected the start floor one up (the old temple mount): it now asks for the start's own floor,
  wherever it stands. 11 of 11 pass; nothing in the game changed for it.

## Phase 3: colour grading (2026-11-27, on the branch, not live)

What the picture was (measured on the same spots, hours and settings: `cgstats`, the view's pixels; saturation 0 to 1,
temperature red minus blue):

| spot | brightness | saturation | shadows' temperature | lights' temperature |
|---|---|---|---|---|
| temple (12:00) | 0.540 | 0.432 | +0.215 | +0.122 |
| square (12:00) | 0.363 | 0.440 | +0.135 | +0.210 |
| woods (12:00) | 0.334 | **0.718** | +0.129 | +0.274 |
| sewer | 0.058 | 0.453 | -0.013 | +0.056 |
| high street, night (23:00) | 0.224 | 0.330 | -0.019 | +0.146 |
| high street, dusk (19:00) | 0.379 | 0.617 | +0.226 | +0.298 |

So: the grass far too saturated (the woods most), shadows as warm as the light everywhere (nothing told them apart),
the dusk a strong orange, and on quality low the whole sky layer was off, so low had no dawn, dusk or weather tint at
all.

The palette (one for the whole world, then a mood per kind of place):

- **The ground** a little less saturated (12 %), its shadows a touch cooler (towards a dark blue-grey, `rgb(24,30,46)`)
  and its lights a touch warmer (towards `rgb(255,248,234)`): `Render.GRADE`. Figures, items and effects aren't
  graded, so they keep their full colour and stand out more against the ground (readability on a phone).
- **A mood per place**, a thin tint over the view in the existing `#sky` layer, fading in and out over 2 s as you walk
  (`MOOD` in `fx.js`, the kind of place from `readClimate`):
  - temple (a roofed marble floor): warm stone, `rgb(255,210,160)` at 5 %
  - forest (more than 18 trees round you): deeper green, `rgb(24,64,44)` at 7 %
  - underground: cool blue, `rgb(24,44,86)` at 10 %
  - town and the wild: none (natural)
- **Night**: a cool blue `rgb(30,42,92)` up to 7 % over the darkness (mysterious, lights still warm); **dawn and dusk**
  gentler (dusk 0.12 instead of the strong orange).
- **The sky layer on every quality**: low and medium now get its tint, mood and edge (only the clouds stay off there).

How, and why not per frame: the first version graded the whole view every frame with three canvas composite fills
(saturation, lighten, darken). Measured: 1.8 + 0.7 + 0.7 ms a frame on the phone's canvas (6 + 2.3 + 2.3 ms at
1280 x 2048), and on the route fps 32 -> 26 and stalls 138 -> 491 (9 measures worse). So the same three fills are now
made **once per ground chunk**, as it is made (`Render.gradeChunk`: the chunk copied aside, the fills over it, its
transparency put back), and kept with it: nothing per frame, no extra canvas but one shared scratch the size of a chunk.
A chunk not yet made, drawn live for a frame, gets the same fills over its square (`gradeRect`), so nothing pops when
it's finished. The mood is one CSS colour on an element that was already there, its fade a CSS transition.

Phases 1 and 2 are kept: their shadows are baked in the chunks before the grading, so they take the cooler shade too.

After (the same spots):

| spot | brightness | saturation | shadows' temperature | lights' temperature |
|---|---|---|---|---|
| temple | 0.555 | 0.373 | +0.189 | +0.129 |
| square | 0.364 | 0.389 | +0.114 | +0.194 |
| woods | 0.325 | 0.617 | +0.094 | +0.229 |
| sewer | 0.066 | 0.465 | -0.034 | +0.022 |
| high street, night | 0.220 | 0.282 | -0.041 | +0.103 |
| high street, dusk | 0.379 | 0.506 | +0.149 | +0.234 |

Brightness stays where it was (no general dark filter); the shadows cool down everywhere more than the lights do.

Screenshots (`phase3/`, before left, after right): temple, square, woods, sewer, the high street at night and at
dusk, on a computer and on a phone at quality low (`*-phone-low.jpg`).

**Sprites to adjust later, on their own** (not graded here, as figures and things keep their colour):

- grass tufts, ferns, bushes and the round tree crowns: as saturated as the grass was (the woods' 0.72 is mostly them)
- the temple's white walls and marble: close to pure white in daylight, they flatten at noon
- the red rugs and the altar cloth: the most saturated red in town
- flower boxes and market awnings: fine in town, loud next to the graded ground
- the sewer's slime green: the one warm-green thing underground

Measured at **quality low** (the baseline that counts; `tests/bench.js --quality low`, new),
headless as an iPhone,
three runs of phase 2 (`phase3-before-headless-low-*`, ui535) and three of phase 3 (`phase3-headless-low-*`):
**nothing worse past the limits**.

| | phase 2 | phase 3 |
|---|---|---|
| fps (whole route) | 41.4 | 41.1 |
| work p50 / p95 | 2.1 / 7.4 ms | 2.1 / 8.1 ms |
| walking, day / night fps | 59.2 / 59.5 | 59.1 / 59.7 |
| stalls (whole route) | 2 | 4 |
| ground chunks made | 481 ms | 490 ms |
| pictures | 199.5 MB | 199.5 MB |

The grading costs a little when a chunk is made (+2 %, about 0.1 ms a chunk) and nothing a frame; the 2 more stalls are
within one run's spread (1 to 5 on either side). The per-frame version this replaced: fps 32 -> 26, stalls 138 -> 491.
Against the iPhone's own baseline (ui530, low): to be measured on the phone once it's live; the headless numbers can't
be compared with the phone's.
