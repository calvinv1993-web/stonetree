# Investigation after the baseline (ui529): three problems, measured, not yet fixed

Measured on the computer (headless Chromium as an iPhone: 390 x 844 @3x, canvas 1280 x 2048, sharpness 4), with
temporary probes that are not in the code. The iPhone's own baseline (docs/perf/results.md) still decides what matters
there: a software-drawing browser can exaggerate or hide what a phone's graphics chip does.

## 1. The sprites kept: about 380 MB of pixels

The sprite cache (`cached` in `sprites.js`) keeps every picture it ever made, for good. By kind, after the route:

| kind | pictures | MB | made when | what |
|---|---|---|---|---|
| `npcsheet` | 678 | 168 | before play | every person and creature of the isle with a picture sheet: 4 directions x 3 steps, each 256 x 256 at sharpness 4 |
| `ownfine` | 174 | 66 | before play | the owner's own pictures (PNG) of things, kept as fine as the screen |
| `part` | 120 | 42 | before play | parts of big things; the founder's statue alone is 9 parts of 768 x 768 (20 MB) |
| `wallstrip` | 150 | 34 | as you go | walls' faces |
| `ownblock` | 62 | 13 | as you go | |
| `raisedroof`, `big`, `water`, the rest | | ~60 | | the moving water alone is one 1024 x 1024 picture (4 MB) |

- **340 MB of it is made before you play** (the loading screen's preload: `preloadJobs` in `game.js` draws every map
  thing, item and creature of the isle ahead, so the first steps don't stall). The route only added 40 MB.
- **Nothing is ever let go of**, unlike the ground chunks (capped at 64, 64 MB on a phone).
- The total that counts on an iPhone: these 380 MB, the chunks' 64 MB, the view's 10 MB, and the decoded PNGs
  (not counted here). iOS Safari has a hard limit on the memory of all canvases together; past it, canvases come out
  empty. The iPhone baseline will show where the app stands.
- The size goes with the square of the sharpness: at sharpness 3 (a 2x screen) the same pictures were about 306 MB in all.

What to consider later (not done): make only the people and creatures near you ahead instead of the whole isle;
let pictures not drawn for a while go (as the chunks are); keep the steps of a person's walk in one sheet rather than
twelve separate canvases; draw the big statue's parts at the sharpness the screen shows.

## 2. The loading screen staying the full 15 s

After a long jump (a teleport, a death, a ride) the loading screen waits until the ground round you is made
(`preloadFrame` in `game.js`): until `Render.ahead()` says the ring round the view is made and `Render.later` (chunks in
view that weren't made in their own frame) is empty. Measured after jumping:

| to | gave up after | what was waiting |
|---|---|---|
| the tower top (137, 106, 11) | 1.2 s in one test, 15 s in the route | chunks of floors 10 and 11 in `Render.later` |
| the north end of the high street (126, 100, 8) | **15.3 s** | 7 chunks in `Render.later` (floors 9, 10 and 12 over the church), the chunk memory full: 63 of 64 |
| the sewer (131, 115, 7) | 0.4 s here, 15 s in the route | |

The cause, as far as measured: where several floors are seen over each other (the church, its tower, the town
wall), more chunks are in view than fit; a chunk in view that wasn't made in its own frame is made later as one
"ahead", and one ahead is never made while the chunk memory is full (`Render.ground`: `if (ahead && Render.pictures +
1 > Render.CHUNKS_KEPT) return null`). So `Render.later` never empties, and the loading screen waits until it gives up
at 15 s. While playing it's harmless (those chunks are drawn live meanwhile); on a jump it costs 15 s of loading screen.

What to consider later (not done): let a chunk from `Render.later` (one in view) push out one not in view, as a
chunk in view does; or don't wait for `later` once only chunks that can't be kept are left.

## 3. The tower top: 7x the work of elsewhere

The work per frame at the tower top was 13.6 ms against about 2 ms elsewhere (sharpness 4). A profile of the frame:
46 % busy against 7 % on the square, nearly all of it in `drawImage` inside `Render.ground`; timed per floor: floor 9
takes **15 ms a frame**, the others under 0.1 ms. Within floor 9 it is **one ground chunk**, `9:17:14` (the roof
tiles at x 140 to 143, y 113 to 119: the house east of the church walk), whose `drawImage` takes 10 to 15 ms each
frame.

Not the chunk's own picture: the same picture drawn on its own takes 0.01 ms, and a fresh copy of it is just as slow
in the frame. So it's the circumstances of that one draw in the frame (where it lands, the canvas's state at that
moment). At sharpness 3 (a 2x screen) the same place costs 0.02 ms, and the chunk is drawn just as fast.

**Not yet known** whether this happens on the iPhone (a graphics chip draws pictures very differently from this
software drawing) or only here. The iPhone baseline's `tower-top` row decides: if its work there is close to the other
parts, this is an artefact of the test browser; if it's high there too, the next step is to find what that draw's
circumstances are (the clip and the transform at that moment).

## The measurements behind this

Temporary scripts, run against ui529 (not kept in the repository): the sprite cache dumped by key at the start and
the end of the route; the loading screen's conditions polled every 0.4 s after each jump; a CPU profile (Chrome
DevTools protocol) of 3.5 s at each place; `Render.ground` timed per floor, and each `drawImage` in floor 9 timed.
