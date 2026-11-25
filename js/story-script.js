'use strict';
// The story told over the panorama (js/story-manifest.js; Intro in game-ui.js tells it, docs/story-panorama.md has the
// format). As many stops as wanted; the camera goes to each in turn (Continue, a swipe, the arrow keys), and the last stop
// is where Sister Ama talks: your name (offline), then her lines, ending in Choose Your Path.
//
// stops: each
//   title, text: its card (the last stop's title heads Sister Ama's talk; its text isn't shown)
//   at:    [x, y] the world point the camera centres on (world units; held so the view never shows past the world)
//   zoom:  1 shows the manifest's view height; above 1 closer
//   keep:  [x, y, w, h] (world units): what must be seen whole above the words (the camera centres it in the part of the
//          screen they leave free, coming a little closer if the frame allows no room)
//   below: how far (world units) the view may reach under the frame, where the words' shade covers the screen (a fill
//          plane in the manifest carries the picture on there)
//   frame: [x, y, w, h] (world units): a scene of its own, which the view must stay inside: the camera comes in close
//          enough for it to fill the screen, and at is held within it
//   snow, mist: the weather drawn in front at this stop (true / false); between stops it fades from one to the other
//   cut:   true: reached (and left) through black instead of a glide: the picture fades out, the camera and the scene
//          change unseen, the new one fades in (for a scene of its own across a hard edge)
// opening: the dramatic start: zoom (closer at first, settling back), ms, delay
// ama: Sister Ama's words: ask (for your name) and talk (her lines; $name is yours)
const STORY_SCRIPT = {
  opening: { zoom: 1.09, ms: 10000, delay: 1400 },
  stops: [
    // the seal, whole and then broken: one place, one camera (the opening block its frame), the picture fading from one
    // state to the other as the words change; the whole ring kept above the words
    { title: 'The Seal', at: [189.94, 362], frame: [0, 0, 1603.43, 724], keep: [27.15, 226.25, 307.7, 294.12], below: 200, snow: false, mist: false,
      text: 'Long ago, something beneath the northern mountains bent wolves and goblins to its will. The people of the north sealed the stairway. The stone closed the passage; the ring held its influence below.' },
    { title: 'The Broken Seal', at: [189.94, 362], frame: [0, 0, 1603.43, 724], keep: [27.15, 226.25, 307.7, 294.12], below: 200, snow: false, mist: false,
      text: 'For years, the river washed earth from beneath the seal. During the winter flood, its support gave way. The ring fractured and the heavy stone shifted. When the water fell, the stairway lay open.' },
    // (the mill at the opening's right end: its package camera x 2979 of a 1479 px wide view, centred at 3718.5 of its pixels)
    { title: 'The Hollow Host', at: [841.32, 362], frame: [0, 0, 1603.43, 724], snow: true, mist: true,
      text: 'Three nights later, a miller saw goblins and wolves coming down the road together. He’d seen them fight over the same prey. When he barred the bridge, two goblins stayed at the gate while the rest took the wolves upstream. As more villages fell, people fled south.' },
    // First night on the road: a separate scene, entered and left through black, on the same world position as the road.
    { title: 'Bastion Holds the Crossing', cut: true, at: [1379.56, 362], frame: [1144.373125, 0, 413.81125, 724], snow: true, mist: false,
      text: 'Your village fell before dusk. You escaped with a family from the mill, but wolves followed you into the forest. At a narrow bridge, a Bastion turned back to hold them off. You crossed behind his shield and followed the others south.' },
    // (the refugees on the road at the opening's right end, walking to Oakvale: its package camera x 5358, centred at 6097.5
    // of its pixels)
    { title: 'The Road to Oakvale', at: [1379.56, 362], frame: [0, 0, 1603.43, 724], snow: true, mist: true,
      text: 'By the time you reached Oakvale, you had walked through two nights with scarcely any sleep. Its gate still opened to refugees, and ships waited in the harbor. You joined the line at the bridge.' },
    // (the same place, the camera still: the rescue fading in over the walking refugees)
    { title: 'The Last Crossing', at: [1379.56, 362], frame: [0, 0, 1603.43, 724], snow: true, mist: true,
      text: 'Above the gate, a watchman raised his lantern once. A wounded man beside the road lifted his twice. Two guards crossed the bridge to help him.' },
    // (the same place again, the camera still: the false signal fading in over the rescue)
    { title: 'The False Signal', at: [1379.56, 362], frame: [0, 0, 1603.43, 724], snow: true, mist: true,
      text: 'After the guards brought the wounded man inside, the lantern above the gate went up again. From the reeds came the same reply. Two lifts. This time, the light fell on a goblin’s hand. A wolf waited behind him. You ran for the gate. Halfway across the bridge, your legs gave way.' },
    // (her temple room fills the screen, held at its top: Ama and the window above the words; reached through black, the
    // camera never gliding across the landscape's end: losing consciousness on the bridge, waking in the temple)
    { title: 'Sister Ama', cut: true, at: [1807.17, 0], frame: [1603.43, 0, 407.48, 724], snow: false, mist: false },
  ],
  ama: {
    ask: '“You’re awake. The watch brought you in last night. I’m Sister Ama. What should I call you?”',
    talk: [
      '“$name, the guards who carried you in saw the signal again. Last night they turned back to help you. Now they’ve gone to look for whoever’s still out there.”',
      'You tell Ama a goblin was holding the lantern.\n\n“They’re already across the bridge.” She turns to a temple attendant. “Run to the gate. Tell the watch it’s a trap.”',
      '“Oakvale’s watch trains three kinds of defenders. Bastions hold the crossings so people can reach safety. Hawks scout the roads and fight with the bow. Embers use magic against threats that steel can’t stop.\n\n“If you want to help Oakvale, the watch can train you. Which path will you take?”',
    ],
  },
};
