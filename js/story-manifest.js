'use strict';
// The story's pictures (js/story-panorama.js draws them; docs/story-panorama.md has the format and how to check a new
// set). This is the panorama the story shows now: one landscape, the seal, the mill, the refugees and Oakvale, then Sister Ama's room. The placeholders that show
// every feature are in js/story-demo.js (the story with ?storydemo).
//
// world:    [width, height] of the world, in world units: the one coordinate system of every plane and camera stop.
//           Planes may reach past it (room for parallax and the edges); that never makes the world larger.
// view:     how many world units of height the column shows at zoom 1 (at most the world's height)
// parallax: 'stops' (default: at each stop every depth shows its planes exactly as placed; between stops they drift
//           apart by their factor) or 'anchor' (classic parallax around anchor: [x, y], default the world's middle)
// layers:   up to three depths, drawn back to front: background, main, foreground. Each:
//   factor: how it follows the camera (1: with the main depth; below 1 falls behind, as far away; above 1 runs ahead)
//   planes: its pictures and objects, each
//     id:    a name (the development view shows it)
//     src:   the file under sprites/ (PNG with transparency, WebP or JPEG), shown at its own resolution
//     x, y, w, h: where it lies and how big, in world units (in its depth's own place: see parallax)
//     z:     order among the depth's planes (higher in front; default: the order here)
//     cover: true if it's opaque all over, or [x, y, w, h] (or a list of those), the parts that are (world units): the
//            gap check uses these
//     clip:  [x, y, w, h], the part of it shown (world units): cut away where a scene of its own lies over it
//     fromStop, untilStop: a plane of one state of a scene (stop indices): shown only while the story is at those stops
//            or past / before them, fading in and out where it lies (the camera doesn't move for it); after: true fades
//            it in only once the camera has landed at its stop, the camera holding still for it
//     drift: { x, y, stop, reach }: a small shift of its own, at most x and y world units, none at that stop (its index),
//            growing smoothly as the camera moves away and full from reach world units on (default: the nearest other
//            stop); never with reduced motion. Or { x, y, between: [a, b, ...] }: none at each of those stops, most half way
//            between two of them (sin), none outside them: one shared drift for a block of scenes, so its joins stay closed. For a view through a window: the window's frame stays, the view behind moves
//   or a fill: { kind: 'fill', id, x, y, w, h, z, cover, fill: a css colour or gradient } (no picture)
//   or a light: { kind: 'glow', x, y (its middle), size (world units), delay (s, its flicker), tone: 'dim' | 'candle' }
const STORY_MANIFEST = {
  world: [2010.91, 724],
  view: 724,
  parallax: 'stops',
  layers: {
    // the far mountains and sky behind the opening (the owner's far-background: one continuous picture in four tiles,
    // its package place -64, -64, 7215 x 1228 of its pixels): a depth of its own, keeping the main camera's pace and
    // scale (factor 1, as the package asks: no speed of its own), moving apart from the main depth only by one offset
    // shared by all four tiles, at most 32 x 24 of its pixels (7.24 x 5.43 world units): none at the seal, the mill or
    // the refugees (and so none at The Last Crossing and The False Signal, at the refugees' place), most half way between
    background: { factor: 1, planes: [
      { id: 'opening-sky-a', src: 'ui/story/opening/12-achtergrond-a.png', x: -14.48, y: -14.48, w: 442.77, h: 277.84, z: 1,
        cover: true, drift: { x: 7.24, y: 5.43, between: [0, 2, 3] } },
      { id: 'opening-sky-b', src: 'ui/story/opening/13-achtergrond-b.png', x: 428.29, y: -14.48, w: 435.53, h: 277.84, z: 1,
        cover: true, drift: { x: 7.24, y: 5.43, between: [0, 2, 3] } },
      { id: 'opening-sky-c', src: 'ui/story/opening/14-achtergrond-c.png', x: 863.82, y: -14.48, w: 470.6, h: 277.84, z: 1,
        cover: true, drift: { x: 7.24, y: 5.43, between: [0, 2, 3] } },
      { id: 'opening-sky-d', src: 'ui/story/opening/15-achtergrond-d.png', x: 1334.42, y: -14.48, w: 283.49, h: 277.84, z: 1,
        cover: true, drift: { x: 7.24, y: 5.43, between: [0, 2, 3] } },
    ] },
    main: { factor: 1, planes: [
      // the opening: the seal (whole, then broken: the story's first two stops), the mill (The Hollow Host) and the
      // refugees on the road to Oakvale (The Last Crossing) as one joined block (sprites/ui/story/opening: the owner's
      // packages sortia-opening and sortia-oakvale-aanvulling, 7087 x 3200 of their pixels placed at 724 / 3200 = 0.22625
      // world units a pixel against the world's left edge, so x 0 to 1603.43). Five tiles meet edge to edge (the seal, the way
      // between, the mill, the road on, the refugees), see-through only in their sky, where the background depth's
      // mountains show through; over them, from the second stop on, the broken seal fading in, both of its patches together
      { id: 'opening-seal', src: 'ui/story/opening/02-zegel-links.png', x: 0.0, y: 0, w: 269.01, h: 724, z: 2, cover: [0.0, 248.42, 269.01, 475.58] },
      { id: 'opening-way', src: 'ui/story/opening/04-overgang.png', x: 269.01, y: 0, w: 470.6, h: 724, z: 2, cover: [269.01, 248.42, 470.6, 475.58] },
      { id: 'opening-mill', src: 'ui/story/opening/09-molen-midden.png', x: 739.61, y: 0, w: 124.21, h: 724, z: 2, cover: [739.61, 248.42, 124.21, 475.58] },
      { id: 'opening-road', src: 'ui/story/opening/10-overgang-molen-vluchtelingen.png', x: 863.82, y: 0, w: 470.6, h: 724, z: 2, cover: [863.82, 248.42, 470.6, 475.58] },
      { id: 'opening-refugees', src: 'ui/story/opening/11-vluchtelingen-rechts.png', x: 1334.42, y: 0, w: 269.01, h: 724, z: 2, cover: [1334.42, 248.42, 269.01, 475.58] },
      { id: 'opening-seal-broken', src: 'ui/story/opening/03-zegel-breuk-links.png', x: 0, y: 226.25, w: 269.01, h: 294.12, z: 3, fromStop: 1 },
      { id: 'opening-way-broken', src: 'ui/story/opening/05-overgang-breuk.png', x: 269.01, y: 226.25, w: 144.8, h: 294.12, z: 3, fromStop: 1 },
      // the rescue at the refugees' place (the owner's sortia-last-crossing-aanvulling, its PNGs unchanged): the wounded
      // man by the road, the two guards crossing the bridge to him (over the walking refugees, which it hides) and, far off
      // behind the battlements, the watchman with his lantern raised; both in the main depth, fading in together once the
      // camera has landed at The Last Crossing (after: the camera holds still for it), and out again going back
      { id: 'opening-rescue', src: 'ui/story/opening/01-reddingsmoment.png', x: 1160.66, y: 181.0, w: 442.77, h: 339.38, z: 4, fromStop: 3, after: true },
      { id: 'opening-watchman', src: 'ui/story/opening/02-wachter.png', x: 1495.06, y: 129.87, w: 10.86, h: 9.73, z: 5, fromStop: 3, after: true },
      // the false signal at the same place (the owner's sortia-false-signal-aanvulling, its PNG unchanged): the goblin with
      // the lantern raised and the wolf behind him, where the rescue was; over the rescue, which stays shown beneath it (so
      // the walking refugees never show through), fading in as The False Signal's words come, the camera still
      { id: 'opening-false-signal', src: 'ui/story/opening/01-vals-signaal.png', x: 1160.66, y: 181.0, w: 442.77, h: 339.38, z: 6, fromStop: 4 },
      // (under the whole world, the seal's dark foot carried on: on screens where the ring sits above the words only with
      // the view a little lower than the picture, and on the way from there; there the words' shade covers it)
      { id: 'seal-foot', kind: 'fill', x: -60, y: 723, w: 2130.91, h: 200, z: -1, cover: true, fill: 'linear-gradient(#111a23, #0b1219 70%)' },
      // Sister Ama's temple room (sprites/ui/story/ama: the owner's package sortia-ama-parallax-v1, its own scene of
      // 1801 x 3200 placed at 724 / 3200 = 0.22625 world units a pixel against the world's right edge, straight after
      // Oakvale, reached through black (its stop's cut)): the room with Ama, her candles and the window's stone frame, see-through only in the window's panes; behind it the view through the
      // window (its package place: x 1251, y -60, 600 x 1320 in the scene's pixels), drifting at most 24 x 16 of the
      // scene's pixels (5.43 x 3.62 world units) as the camera leaves Ama's stop
      { id: 'ama-window-view', src: 'ui/story/ama/01-raamuitzicht.png', x: 1886.47, y: -13.58, w: 135.75, h: 298.65, z: 1,
        cover: true, drift: { x: 5.43, y: 3.62, stop: 5 } },
      { id: 'ama-temple', src: 'ui/story/ama/02-ama-tempel.png', x: 1603.43, y: 0, w: 407.48, h: 724, z: 2,
        cover: [[1603.43, 0, 343, 724], [1946.43, 246.61, 64.48, 477.39], [1946.43, 0, 64.48, 27.83]] },
    ] },
  },
};
