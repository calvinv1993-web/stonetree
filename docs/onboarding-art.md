# The story book's pictures

A new character's story (`STORY_PAGES` in `js/game-ui.js`) has five chapters, each with a scene of its own. Until a
scene's picture is in `sprites/ui/story/`, its page shows a stand-in: the one picture there is (`story-1.jpg`), looking
at the part of it closest to the scene. Put a picture in, run `node tests/sprite-versions.js`, and its page uses it.

## What each picture must be

- **File:** `sprites/ui/story/<name>.jpg`, JPEG at about quality 85, under 400 KB.
- **Size:** 1600 × 1600 (square). An upright phone shows its middle as a tall strip; a computer shows nearly all of it.
  Keep what matters in the middle 60%, and nothing important at the very top (the logo) or bottom (the page of words).
- **No text, no logo, no frame, no buttons.**
- **One look for all five:** painterly pixel-art fantasy, as in `story-1.jpg`: rich warm and cool light, dramatic skies,
  crisp detail. The same world: Oakvale is a small walled town of sandstone with red roofs, a temple and a tall bell tower,
  on an island in a river; the Hollow Host's fortress is a black castle on a mountain in the north, under a red sky.
- **Where it looks:** each page's `focus` in `STORY_PAGES` (x %, y %, how far in) is the spot its picture drifts in on.
  With a page's own picture it is the middle (50, 50, 1) unless the picture asks for another.

## The five scenes

Each prompt starts with the shared style line:

> *Detailed painterly pixel-art fantasy illustration in the style of a 16-bit RPG title screen: rich colours, soft glowing
> light, dramatic sky, crisp pixel details. Square image. No text, no letters, no logo, no border, no frame, no UI. The
> main subject in the middle of the image.*

| File | Chapter | Scene |
|---|---|---|
| `story-beginning.jpg` | The Beginning | *A prosperous fantasy kingdom at sunset seen from a hill: green valleys, rivers, roads linking many small towns and villages with warm lights in their windows, farms and windmills, a golden sky. The world feels alive and at peace. Far on the northern horizon, the faintest red glow in the clouds.* |
| `story-host.jpg` | The Hollow Host | *Darkness arrives: a black fortress on a northern mountain glows red under unnatural, swirling storm clouds. Below it a vast army of monsters marches together through a burning valley: goblins, skeletons, wolves and dark beasts with empty, glowing eyes, ragged banners with a hollow ring. A town burns in the distance.* |
| `story-last-town.jpg` | The Last Town | *Oakvale at dusk, the last sanctuary: a small walled town of sandstone with red roofs, a temple and a tall bell tower, on an island in a dark river. Its walls, torches and temple glow warm. All around, the lands are dark; across the water, hundreds of small enemy campfires on the far shore.* |
| `story-you.jpg` | And You | *A lone, wounded traveller in a torn red cloak stumbling along a frozen road through the snow at dawn, towards the distant gate and walls of a small town. Cold blue light, frost, breath in the air, footprints behind. Vulnerable and mysterious; the face hidden by the hood.* |
| `story-road.jpg` | Your Road | *The same traveller, now standing tall on the town's wall at sunrise, seen from behind, a sword at their side, looking out over a vast and dangerous world: mountains, forests, ruins, a far sea, and the dark fortress very far away. Determined, hopeful, epic.* |
