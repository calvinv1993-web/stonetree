# The story panorama

The story before a new character (the cards, Sister Ama, then Choose Your Path) is told over one panorama. The engine is
`js/story-panorama.js`. What it shows lives in two plain files, so new pictures and a new story need no code:

| File | What it holds |
|---|---|
| `js/story-manifest.js` | `STORY_MANIFEST`: the pictures (the world, its depths and their planes) |
| `js/story-script.js` | `STORY_SCRIPT`: the camera stops with their titles and words, the opening, Sister Ama's lines |
| `js/story-demo.js` | `STORY_DEMO`: a complete placeholder manifest and script that use every feature |
| `tests/story-placeholders.py` | draws the demo's placeholder PNGs into `sprites/ui/story/demo/` |
| `tests/story-panorama.test.js` | the browser test (both panoramas, four screens) |

`Intro` in `js/game-ui.js` tells the story and drives the camera; the login before it and Choose Your Path after it are
unchanged.

## Looking at it

- `index.html?story`: the story as it is (in browser tests the story is skipped unless `?story` is given)
- `index.html?story&storydemo`: the placeholder demonstration
- add `&storydev`, or press **Shift+D** while the story is open: the development view

## The world and the camera

- **One coordinate system.** Every plane and every camera stop is in world units. `world: [width, height]` is the
  world's size; it never grows: planes may reach past it (room for parallax and overscroll), and overlapping planes
  don't change it.
- **Scale.** The column shows `view` world units of height at zoom 1. The scale (css px per world unit) is the column's
  height divided by `view`, times the stop's zoom. The width follows from the screen.
- **Camera stops.** `at: [x, y]` is the world point the camera centres on, `zoom` how close (1: `view` high). A stop is
  held so the view never shows past the world's edges, so a stop near an end settles where the world allows.
- **Depths.** At most three, back to front: `background`, `main`, `foreground`. They all follow the one camera; `factor`
  sets the pace (1 with the main depth, below 1 falls behind as if far away, above 1 runs ahead as if near).
- **Parallax** (`parallax` in the manifest):
  - `'stops'` (the default): at every stop each depth shows its planes exactly where they're placed, so the composition
    at a stop is as painted. Between two stops the depths drift apart and meet again: a depth's camera is
    `x + (factor − 1) · (b − a) · sin(π t) / π`, where `a` and `b` are the stops' positions and `t` runs from 0 to 1
    between them (the same for y).
  - `'anchor'`: classic parallax around `anchor` (default: the world's middle): a depth's camera is
    `anchor + (camera − anchor) · factor`. Pictures line up only at the anchor; every depth needs room for its whole way.
- **Moving.** Continue, the arrow keys and a swipe all move the same camera: a swipe follows the finger (stiff past the
  ends, at most 48 css px, never past the world), and lands on the next stop or glides back. The text and controls stay
  where they are. With reduced motion the camera goes straight to a stop, and there's no opening zoom and no snow.
- **The opening** (`opening` in the script): the camera starts `zoom` times closer and settles back over `ms`, after
  `delay`. Anything you do settles it at once.

## The manifest

```js
const STORY_MANIFEST = {
  world: [3000, 1000],          // world units
  view: 900,                    // world units of height shown at zoom 1
  parallax: 'stops',            // or 'anchor' (with anchor: [x, y])
  layers: {
    background: { factor: 0.55, planes: [ /* ... */ ] },
    main:       { factor: 1,    planes: [ /* ... */ ] },
    foreground: { factor: 1.3,  planes: [ /* ... */ ] },
  },
};
```

A plane:

| Field | Meaning |
|---|---|
| `id` | its name (the development view shows it) |
| `src` | the file under `sprites/` (PNG with transparency, WebP or JPEG) |
| `x, y, w, h` | where it lies and how big, in world units, in its depth's own place |
| `z` | order among the depth's planes (higher in front; default: the order listed) |
| `cover` | `true` if it's opaque all over, or `[x, y, w, h]` (or a list of those) for the parts that are (world units); the gap check uses these |
| `clip` | `[x, y, w, h]`: only this part of the plane is shown (world units), e.g. where a scene of its own lies over it |
| `drift` | `{ x, y, stop, reach }`: a small shift of its own, at most `x` and `y` world units: none at that stop (its index), growing smoothly as the camera moves away, full from `reach` units on (default: the nearest other stop), never more wherever the camera goes; none with reduced motion. For a view through a window: the frame stays, the view behind moves |

A light: `{ kind: 'glow', x, y, size, delay, tone }` (x, y its middle; `tone`: `'dim'` or `'candle'`, or none).

**Planes that meet.** Planes can meet side by side and one above another, and can overlap. Lay them out from one
master picture cut into pieces, and let neighbours overlap by a few units (the demo uses 40): the engine snaps every
plane's edges outwards to whole device pixels, and an overlap of identical pixels never shows.

**Sharpness.** Every picture is drawn from its own file at its own resolution: the engine never shrinks, re-encodes or
redraws a picture. A plane looks sharp when its file has at least `w × scale × devicePixelRatio` pixels across. On an
iPhone in Safari (746 css px high, 3x) with `view: 724` that's about 3.1 file pixels per world unit, or 3.9 in the
installed app (926 px high). The development view shows every plane's magnification; above 1.05x it's stretched.

## The story script

```js
const STORY_SCRIPT = {
  opening: { zoom: 1.09, ms: 10000, delay: 1400 },
  stops: [
    { title: 'The Broken Seal', text: '…', at: [217, 362], zoom: 1, snow: false, mist: true },
    // ... as many as wanted; the last stop is where Sister Ama talks (its text isn't shown)
    { title: 'Sister Ama', at: [1955, 362], snow: false, mist: false },
  ],
  ama: { ask: '…your name?', talk: ['“$name, …”', '…'] },
};
```

A stop can have a `frame: [x, y, w, h]` (world units): a scene of its own that the view must stay inside. The camera
comes in just close enough for it to fill the screen on any shape of screen, and `at` is held within it (Sister Ama's
room uses this, held at its top so she stands above the words).

Every stop but the last is a card (a dot each in the progress row). `snow` and `mist` say what weather is drawn in front
at that stop; between stops it fades from one to the other.

## A scene of its own: Sister Ama's room

`sprites/ui/story/ama/` holds the owner's two-layer package (sortia-ama-parallax-v1): `02-ama-tempel.png` (1801 x 3200,
see-through only in the window's panes) and `01-raamuitzicht.png` (the view through the window, 846 x 1860, placed in
the package at x 1251, y -60, 600 x 1320 of the room's pixels). In the world the room is scaled to the panorama's
height (724 / 3200 = 0.22625 world units a pixel) against its right edge, so: room x 1764.52, y 0, 407.48 x 724; view
x 2047.56, y -13.58, 135.75 x 298.65, behind the room (z), drifting at most 24 x 16 of the room's pixels (5.43 x 3.62
world units). Both are kept as the package's PNGs (no recompression). The room's `cover` lists its opaque parts (all but
the window), the ground strip in front is clipped where the room begins, and Ama's stop has the room as its `frame`.

## Pictures fetched ahead

Planes are fetched only when needed: those of the stop being shown and the stops either side, and before every move
the pictures along the way are fetched and decoded (for at most 0.9 s), so the camera never glides onto a blank. The
gate's loading screen fetches the first two stops' pictures. Pictures get their own versions (`sprites/versions.js`):
run `node tests/sprite-versions.js` after adding or changing them.

## The development view

- every plane's edges, coloured by depth (background blue, main yellow, foreground pink; solid: `cover`, dashed: not)
- its file's size and its magnification now (green ≤ 1.05x, orange up to 1.5x, red above, or "missing")
- where planes of one depth overlap (shaded)
- the camera's frame at every stop (white, dashed) and the world's edge
- where the screen shows nothing right now (red cells)
- a panel: the column, the device pixel ratio, the camera, the scale, the depths, the planes in view, and whether
  anywhere along the camera's whole way (every stop, between them, overscroll, the opening) would show a gap

## Filling it in

1. Put the pictures in `sprites/` and run `node tests/sprite-versions.js`.
2. Describe them in `js/story-manifest.js`: the world, the view height, each depth's factor and planes (mark the opaque
   ones `cover`).
3. Put the stops, titles and words in `js/story-script.js`.
4. Open `index.html?story&storydev`, go through every stop: no red cells, "gaps on the way: none", every plane in view
   at or below 1.05x on the phone you care about.
5. Run `node tests/story-panorama.test.js`, then `node tests/onboarding.test.js`.
