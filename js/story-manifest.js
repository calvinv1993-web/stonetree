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
//     cover: true if it's opaque all over, or [x, y, w, h], the part of it that is (world units): the gap check uses these
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
      { id: 'seal', src: 'ui/intro/layers/03-seal.webp', x: -48, y: 109, w: 643, h: 538 },
      { id: 'mill', src: 'ui/intro/layers/04-mill.webp', x: 413.7, y: 135.1, w: 562, h: 470.2 },
      { id: 'sister-ama', src: 'ui/intro/layers/05-sister-ama.webp', x: 1800, y: 214, w: 370, h: 509.6 },
      { id: 'wolf', src: 'ui/intro/layers/11-wolf.webp', x: 1400, y: 200, w: 195, h: 200.44 },
      { id: 'goblin', src: 'ui/intro/layers/12-hidden-goblin.webp', x: 1450, y: 345, w: 285, h: 306.2 },
      { id: 'traveler', src: 'ui/intro/layers/10-traveler.webp', x: 850, y: 355, w: 350, h: 276.47 },
      // the lights: the mill's windows, the gate's watchman, Sister Ama's candle, the traveler's and the goblin's lanterns
      { kind: 'glow', x: 630, y: 305, size: 52, delay: -0.7, tone: 'dim' },
      { kind: 'glow', x: 699, y: 325, size: 56, delay: -1.4, tone: 'dim' },
      { kind: 'glow', x: 1264, y: 140, size: 65, delay: -0.3 },
      { kind: 'glow', x: 1835, y: 215, size: 65, delay: -1.2, tone: 'candle' },
      { kind: 'glow', x: 1116, y: 434, size: 96, delay: -1.9 },
      { kind: 'glow', x: 1479, y: 443, size: 113, delay: -2.6 },
    ] },
    foreground: { factor: 1.25, planes: [
      // the old tree close to the camera (blurred in its file), and the dark ground over the picture's foot
      { id: 'tree', src: 'ui/intro/layers/09-tree.webp', x: 1049, y: 0, w: 1002, h: 696 },
      { id: 'ground', src: 'ui/intro/layers/08-ground.webp', x: 0, y: 560, w: 2172, h: 164 },
    ] },
  },
};
