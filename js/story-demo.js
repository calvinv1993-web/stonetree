'use strict';
// A demonstration of the story panorama with placeholder pictures (the story with ?storydemo; add &storydev for the
// development view). It uses every feature: three depths; planes that meet side by side and one above another, and
// overlap; see-through PNGs (the skyline over the far hills) and cut-out objects in front; a lamp's glow; stops at
// different heights and one closer in; more stops than the real story. The pictures come from tests/story-placeholders.py:
// each is labelled with its name, its place and its size, and carries a grid in world units. The format: js/story-manifest.js.
const STORY_DEMO = {
  manifest: {
    world: [3000, 1000],
    view: 900,
    parallax: 'stops',
    layers: {
      background: { factor: 0.55, planes: [
        { id: 'bg-1', src: 'ui/story/demo/bg-1.png', x: -200, y: -100, w: 1760, h: 1200, cover: true },
        { id: 'bg-2', src: 'ui/story/demo/bg-2.png', x: 1500, y: -100, w: 1700, h: 1200, cover: true },
      ] },
      main: { factor: 1, planes: [
        // three columns, each a see-through top (a skyline) over solid land; they overlap 40 units across and down
        { id: 'main-1-top', src: 'ui/story/demo/main-1-top.png', x: 0, y: 0, w: 1040, h: 440 },
        { id: 'main-2-top', src: 'ui/story/demo/main-2-top.png', x: 1000, y: 0, w: 1040, h: 440 },
        { id: 'main-3-top', src: 'ui/story/demo/main-3-top.png', x: 2000, y: 0, w: 1000, h: 440 },
        { id: 'main-1-low', src: 'ui/story/demo/main-1-low.png', x: 0, y: 400, w: 1040, h: 600, cover: true },
        { id: 'main-2-low', src: 'ui/story/demo/main-2-low.png', x: 1000, y: 400, w: 1040, h: 600, cover: true },
        { id: 'main-3-low', src: 'ui/story/demo/main-3-low.png', x: 2000, y: 400, w: 1000, h: 600, cover: true },
        { kind: 'glow', x: 1780, y: 600, size: 90, delay: -0.8 },
      ] },
      foreground: { factor: 1.3, planes: [
        // the ground strip in two pieces, reaching past the world's ends (room for running ahead), and three objects
        { id: 'fg-ground-1', src: 'ui/story/demo/fg-ground-1.png', x: -400, y: 860, w: 1880, h: 160, z: 1 },
        { id: 'fg-ground-2', src: 'ui/story/demo/fg-ground-2.png', x: 1440, y: 860, w: 2060, h: 160, z: 1 },
        { id: 'fg-tree', src: 'ui/story/demo/fg-tree.png', x: 560, y: 80, w: 360, h: 900, z: 2 },
        { id: 'fg-post', src: 'ui/story/demo/fg-post.png', x: 1720, y: 560, w: 120, h: 420, z: 2 },
        { id: 'fg-banner', src: 'ui/story/demo/fg-banner.png', x: 2460, y: 120, w: 300, h: 820, z: 2 },
      ] },
    },
  },
  script: {
    opening: { zoom: 1.09, ms: 10000, delay: 1400 },
    stops: [
      { title: 'Placeholder 1', at: [380, 520], snow: false, mist: true, text: 'The first stop. Three depths: the far hills (background), the town and its land (main) and the tree and ground in front (foreground). Swipe or press Continue.' },
      { title: 'Placeholder 2', at: [900, 470], snow: true, mist: true, text: 'Where main-1 meets main-2, side by side, and the skyline meets the land below it: the planes overlap by 40 units, and nothing shows between them.' },
      { title: 'Placeholder 3', at: [1500, 450], zoom: 1.15, snow: true, mist: false, text: 'A stop closer in (zoom 1.15) and higher up: the camera moves, rises and zooms in one glide; the background follows at 0.55, the foreground at 1.3.' },
      { title: 'Placeholder 4', at: [1950, 540], snow: true, mist: true, text: 'Behind the lamp post, where the two background planes overlap and the foreground ground strip changes pieces.' },
      { title: 'Placeholder 5', at: [2350, 500], snow: false, mist: true, text: 'Any number of stops: this demonstration has six. The last one is where Sister Ama talks.' },
      { title: 'Sister Ama', at: [2750, 500], snow: false, mist: false },
    ],
    ama: STORY_SCRIPT.ama,
  },
};
