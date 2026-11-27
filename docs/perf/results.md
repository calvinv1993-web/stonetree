# Performance results per phase

How to measure: [README.md](README.md). Each phase is compared with the baseline below (phase 0), on the same device
and with the same settings.

The rendering plan, in order (agreed with the owner):

| phase | what | state |
|---|---|---|
| 0 | baseline measurement (this file) | done: computer and iPhone (quality low) |
| 1 | baked ambient occlusion in the ground chunks | waiting for approval |
| 2 | contact shadows (figures, things on the ground) | - |
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
