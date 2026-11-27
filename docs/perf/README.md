# Measuring the game's performance

Every step of the rendering work (see the plan below) is measured before and after, so we can tell objectively
whether the game got heavier. The measuring is the **performance test** (`js/bench.js`): a fixed route through the
world, the same every time, measured as the game really runs on the device.

## What it measures

The route (`ROUTE` in `js/bench.js`, about two minutes):

| part | where | hour |
|---|---|---|
| square-day | the square, standing (126, 121, 8) | 12:00 |
| church-inside | in the church, before the altar (137, 103, 8) | 12:00 |
| tower-top | the church tower's belfry (137, 106, 11) | 12:00 |
| walk-street-day | walking the high street, north to south (126, 100 to 126, 140) | 12:00 |
| outside-east | outside the walls, east (175, 121, 8) | 12:00 |
| sewer | in the sewers, underground (131, 115, 7) | 12:00 |
| square-night | the square at night: the light layer on | 23:00 |
| walk-street-night | walking the high street at night, south to north | 23:00 |

For each part:

- **work** (ms): the game's own time per frame (update, drawing, interface), its median (p50), 95th and 99th
  percentile. **The measure to compare**: it doesn't depend on the frame rate the game chooses.
- **fps** and **gap** (ms between frames, p50/p95/p99), and **stalls** (gaps of 50 ms or more). The game draws 30
  frames a second on purpose while nothing moves near you (`calm` in `game.js`), so standing still usually shows 30.
- **load s**: how long the loading screen after the jump to that part lasted (`!`: it gave up at 15 s).
- **chunks**: the ground chunks made (in view and ahead), the time it took, and the longest single go.
- **memory**: the pictures kept, in MB of pixels (4 bytes a pixel): ground chunks, sprites (`Sprites.cacheStats`)
  and the view's canvases; and the script heap where the browser tells it (Chrome only, not Safari).

It plays a character of its own (saved under its own key and removed afterwards), keeps it alive, and draws at the
sharpness of the quality chosen: the automatic step down a slow moment made earlier is set aside for the test (noted as
`sharpDropBefore`) and paused while it runs, so every run of a quality draws the same pixels. Your own character is
saved first and comes back afterwards.

## On the iPhone, as an app on the home screen (PWA)

1. Make sure the version to measure is live (close the app and open it again until it has updated).
2. Open the app from the home screen, log in and play your character as usual.
3. Menu, Game: **Performance test**. Confirm. The game saves, loads again into the test and runs the route
   (about two minutes): keep the screen on, don't touch it, keep the phone at room temperature and on the same power
   state (preferably charging or above 50 %, Low Power Mode off), the same quality and frame rate settings as before.
4. The results appear. **Run again** twice more (three runs: one run alone varies). Then **Copy results** (or
   **Share**) for each, and paste them in the chat: they are kept in `docs/perf/results/` as JSON.
5. **Mark as baseline** on a run of the current version: later runs on this phone are compared with it right there
   (green better, red worse, only past both a share and an amount).
6. **Back to the game** returns to your own character.

The last 20 runs are kept in that browser (`tilequest.bench.runs`): running from Safari and from the home-screen app
are different browsers to iOS, each with its own runs. The result says which (`standalone`).

## On a computer

```
node tests/bench.js docs/perf/results/<date>-<version>-headless-iphone.json --runs 3
node tests/bench-compare.js <baseline runs...> -- <new runs...>
```

`tests/bench.js` runs the same test in headless Chromium as an iPhone shows the game (390 x 844 points, 3 pixels a
point, touch). Options: `--runs 3`, `--cpu 4` (the processor four times slower), `--desktop`. It has no graphics
card (software drawing), so its numbers are this computer's own: compare only runs made the same way, on the same
machine. It's no substitute for the iPhone, but it catches more work per frame, more memory and slower chunks.

`tests/bench-compare.js` takes the median of each side's runs and marks a measure worse only past both a share and an
amount (work p50 +10 % and more than +1 ms (an iPhone's clock gives whole milliseconds), work p95 +15 % and +2 ms, fps -5 % and -2 on the walks only (standing still the game picks 30 or 60 itself), pictures +10 % and +10 MB, chunk time
+15 % and +40 ms, stalls +50 % and +5); it ends with code 1 if anything is worse.

On a shared machine one run's work can differ from the next by a quarter (three runs of the same code: work p50
2.0 to 2.5 ms, night-walk stalls 8 to 69). Hence three runs and the median.

## Results

[results.md](results.md) keeps the measurements after each phase. The JSON of every run is in `results/`. [investigation-phase0.md](investigation-phase0.md): the three problems the baseline showed (sprite memory, 15 s loading screens, the tower top), measured.
