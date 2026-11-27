# Performance results per phase

How to measure: [README.md](README.md). Each phase is compared with the baseline below (phase 0), on the same device
and with the same settings.

The rendering plan, in order (agreed with the owner):

| phase | what | state |
|---|---|---|
| 0 | baseline measurement (this file) | done: computer; iPhone runs to add |
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

### iPhone (home-screen app)

To add: three runs from the game (Menu, Game: Performance test), copied into `results/` as
`<date>-ui<version>-iphone-<model>-{1,2,3}.json`, and the table above for them.
