# The welcome's pictures

Seven upright paintings (941 × 1672, 9:16), one per screen of a new character's welcome. The game uses the WebP files in
`sprites/ui/story/` (by their own version, `sprites/versions.js`); the PNGs they were made from are kept here, in
`docs/onboarding-art/` (not served by the game's server). No picture has text, buttons or other UI painted in.

| Screen | Picture |
|---|---|
| Story: The Beginning | `01_the_beginning.webp` |
| Story: The Hollow Host | `02_the_hollow_host.webp` |
| Story: The Last Town | `03_the_last_town.webp` |
| Story: And You | `04_and_you.webp` |
| Story: Your Road | `05_your_road.webp` |
| Your name, your appearance (Oakvale's temple) | `06_character_creation.webp` |
| Choosing your path (the hall of paths) | `07_choose_your_path.webp` |

- **The story's chapters** are `STORY_PAGES` in `js/game-ui.js`: each names its picture (`image`) and the spot it's
  cropped to and drifts in on (`focus`: x %, y %, how far in), so a picture can be moved per chapter for every shape of screen.
- **The temple and the hall** are `SCENES` in `js/game-ui.js`, shown behind the windows by `welcomeScene()`.
- **To change one:** replace its WebP (and its PNG here), then run `node tests/sprite-versions.js`.
