'use strict';
// The story's pictures (js/story-panorama.js draws them; docs/story-panorama.md has the format and how to check a new
// set). This is the panorama the story shows now, the Oakvale night in its 2172 x 724 layers. The placeholders that show
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
//            or past / before them, fading in and out where it lies (the camera doesn't move for it)
//     drift: { x, y, stop, reach }: a small shift of its own, at most x and y world units, none at that stop (its index),
//            growing smoothly as the camera moves away and full from reach world units on (default: the nearest other
//            stop); never with reduced motion. Or { x, y, between: [a, b] }: none at stops a and b, most half way between
//            them (sin), none outside them: one shared drift for a block of scenes, so its joins stay closed. For a view through a window: the window's frame stays, the view behind moves
//   or a fill: { kind: 'fill', id, x, y, w, h, z, cover, fill: a css colour or gradient } (no picture)
//   or a light: { kind: 'glow', x, y (its middle), size (world units), delay (s, its flicker), tone: 'dim' | 'candle' }
const STORY_MANIFEST = {
  world: [2172, 724],
  view: 724,
  parallax: 'stops',
  layers: {
    background: { factor: 0.85, planes: [
      { id: 'mountains', src: 'ui/intro/layers/01-distant-sky-mountains.webp', x: 0, y: -170, w: 2172, h: 724, cover: true },
    ] },
    main: { factor: 1, planes: [
      // the cave, the river, Oakvale and its bridge, the temple room; its sky see-through (opaque below row 256)
      { id: 'scene', src: 'ui/intro/layers/02-scene.webp', x: 0, y: 0, w: 2172, h: 724, cover: [0, 256, 2172, 468] },
      // the opening: the seal (whole, then broken: the story's first two stops) and the mill (The Hollow Host) as one
      // joined block (sprites/ui/story/opening: the owner's package sortia-opening, 4458 x 3200 of its pixels placed at
      // 724 / 3200 = 0.22625 world units a pixel against the world's left edge, so x 0 to 1008.62). Three tiles meet edge to
      // edge (the seal, the way between, the mill), see-through only in their sky; behind them all one shared sky,
      // mountains and forest (its package place -64, -64, 4586 x 1228), drifting at most 32 x 24 of its pixels (7.24 x 5.43
      // world units) between the seal and the mill, none at either; over them, from the second stop on, the broken seal
      // fading in, both of its patches together
      { id: 'opening-sky', src: 'ui/story/opening/01-gedeelde-achtergrond.png', x: -14.48, y: -14.48, w: 1037.58, h: 277.84, z: 1,
        cover: true, drift: { x: 7.24, y: 5.43, between: [0, 2] } },
      { id: 'opening-seal', src: 'ui/story/opening/02-zegel-links.png', x: 0, y: 0, w: 269.01, h: 724, z: 2, cover: [0, 219.24, 269.01, 504.76] },
      { id: 'opening-way', src: 'ui/story/opening/04-overgang.png', x: 269.01, y: 0, w: 470.6, h: 724, z: 2, cover: [269.01, 248.42, 470.6, 475.58] },
      { id: 'opening-mill', src: 'ui/story/opening/06-molen-rechts.png', x: 739.61, y: 0, w: 269.01, h: 724, z: 2, cover: [739.61, 241.64, 269.01, 482.37] },
      { id: 'opening-seal-broken', src: 'ui/story/opening/03-zegel-breuk-links.png', x: 0, y: 226.25, w: 269.01, h: 294.12, z: 3, fromStop: 1 },
      { id: 'opening-way-broken', src: 'ui/story/opening/05-overgang-breuk.png', x: 269.01, y: 226.25, w: 144.8, h: 294.12, z: 3, fromStop: 1 },
      // (under the whole world, the seal's dark foot carried on: on screens where the ring sits above the words only with
      // the view a little lower than the picture, and on the way from there; there the words' shade covers it)
      { id: 'seal-foot', kind: 'fill', x: -60, y: 723, w: 2292, h: 200, z: -1, cover: true, fill: 'linear-gradient(#111a23, #0b1219 70%)' },
      { id: 'wolf', src: 'ui/intro/layers/11-wolf.webp', x: 1400, y: 200, w: 195, h: 200.44 },
      { id: 'goblin', src: 'ui/intro/layers/12-hidden-goblin.webp', x: 1450, y: 345, w: 285, h: 306.2 },
      { id: 'traveler', src: 'ui/intro/layers/10-traveler.webp', x: 850, y: 355, w: 350, h: 276.47 },
      // the lights: the gate's watchman, the traveler's and the goblin's lanterns
      { kind: 'glow', x: 1264, y: 140, size: 65, delay: -0.3 },
      { kind: 'glow', x: 1116, y: 434, size: 96, delay: -1.9 },
      { kind: 'glow', x: 1479, y: 443, size: 113, delay: -2.6 },
      // Sister Ama's temple room (sprites/ui/story/ama: the owner's package sortia-ama-parallax-v1, its own scene of
      // 1801 x 3200 placed at 724 / 3200 = 0.22625 world units a pixel against the world's right edge): the room with Ama,
      // her candles and the window's stone frame, see-through only in the window's panes; behind it the view through the
      // window (its package place: x 1251, y -60, 600 x 1320 in the scene's pixels), drifting at most 24 x 16 of the
      // scene's pixels (5.43 x 3.62 world units) as the camera leaves Ama's stop
      { id: 'ama-window-view', src: 'ui/story/ama/01-raamuitzicht.png', x: 2047.56, y: -13.58, w: 135.75, h: 298.65, z: 1,
        cover: true, drift: { x: 5.43, y: 3.62, stop: 5 } },
      { id: 'ama-temple', src: 'ui/story/ama/02-ama-tempel.png', x: 1764.52, y: 0, w: 407.48, h: 724, z: 2,
        cover: [[1764.52, 0, 343, 724], [2107.52, 246.61, 64.48, 477.39], [2107.52, 0, 64.48, 27.83]] },
    ] },
    foreground: { factor: 1.25, planes: [
      // the old tree close to the camera (blurred in its file), and the dark ground over the picture's foot
      { id: 'tree', src: 'ui/intro/layers/09-tree.webp', x: 1049, y: 0, w: 1002, h: 696 },
      { id: 'ground', src: 'ui/intro/layers/08-ground.webp', x: 0, y: 560, w: 2172, h: 164, clip: [1008.62, 560, 755.9, 164] }, // (not over the opening or Ama's room)
    ] },
  },
};
