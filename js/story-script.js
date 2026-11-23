'use strict';
// The story told over the panorama (js/story-manifest.js; Intro in game-ui.js tells it, docs/story-panorama.md has the
// format). As many stops as wanted; the camera goes to each in turn (Continue, a swipe, the arrow keys), and the last stop
// is where Sister Ama talks: your name (offline), then her lines, ending in Choose Your Path.
//
// stops: each
//   title, text: its card (the last stop's title heads Sister Ama's talk; its text isn't shown)
//   at:    [x, y] the world point the camera centres on (world units; held so the view never shows past the world)
//   zoom:  1 shows the manifest's view height; above 1 closer
//   snow, mist: the weather drawn in front at this stop (true / false); between stops it fades from one to the other
// opening: the dramatic start: zoom (closer at first, settling back), ms, delay
// ama: Sister Ama's words: ask (for your name) and talk (her lines; $name is yours)
const STORY_SCRIPT = {
  opening: { zoom: 1.09, ms: 10000, delay: 1400 },
  stops: [
    { title: 'The Broken Seal', at: [217, 362], snow: false, mist: true,
      text: 'Long ago, something beneath the northern mountain made the creatures above obey its commands. The people of the north sealed the stairway so no creature would hear those commands again. Then the river flooded. When the water receded, the seal lay broken.' },
    { title: 'The Hollow Host', at: [717, 362], snow: true, mist: true,
      text: 'Three nights later, a miller saw goblins and wolves coming down the road together. He’d seen them fight over the same prey. When he barred the bridge, two goblins stayed at the gate while the rest took the wolves upstream. As more villages fell, people fled south.' },
    { title: 'The Last Crossing', at: [1097, 362], snow: true, mist: true,
      text: 'You followed the survivors to Oakvale. Its gate still opened to refugees, and ships waited in the harbor. Just before the bridge, a watchman raised his lantern once. A wounded man by the road lifted his twice. Two guards came across to help him.' },
    { title: 'The False Signal', at: [1444, 362], snow: true, mist: true,
      text: 'After the guards brought the man inside, the lantern above the gate went up again. From the ditch came the same reply. Two lifts. This time, the light fell on a goblin’s hand. A wolf waited behind him. You ran. Halfway across the bridge, your legs gave way.' },
    { title: 'Sister Ama', at: [1955, 362], snow: false, mist: false },
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
