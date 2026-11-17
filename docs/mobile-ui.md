# The phone's interface

How Lickii Adventures looks and works on a phone, held upright, and which file does what. Built in eleven phases in
November 2026 (versions ui227 to ui236); the last version before it is commit `819e3cc` (ui227), to go back to if
ever needed.

## What the player sees

From top to bottom:

- **The status bar** (`css/phone/layout.css`, built in `js/mobile-hud.js`): health and mana (current / max) the
  whole width, a heart and a drop on their start; under them "EXP" with the percent, a thin experience bar, and the
  level. Nothing to tap up here.
- **The map**, as big as the space between the bars allows, with a map button in its top left corner (the drawer's
  Map page) and, while you have a target, a pill at its top with the target's name, health bar and percent.
- **The bottom bar** (`js/mobile-hud.js` puts it together), top to bottom: the chat line with a backpack button at its
  end (the drawer's Gear page), backpack places 44 px (pictures 38 px), action buttons 48 px where the phone is wide enough (pictures as much of them) and the smart button between them 60 px, and under each group of three a row of short bars
  saying which of its sets shows (gold):
  - three spells on the left, three spells, potions or food on the right (`js/action-slots.js`,
    `css/phone/action-slots.css`): each its picture, a spell's mana with a drop, a potion's count; a gold edge when it can be
    used, dimmed without the mana or with none left; a shade and the seconds while it cools down. Tap to use, hold to
    choose what goes there, swipe sideways for the next set of three (both groups apart, kept per player). A spell or food
    still working (haste, magic shield, torchlight, fed) shows its time left at the top of its button; the top of the
    view shows only what happens to you (poison, fire, energy, paralysis, skulls).
  - the smart button in the middle (`js/smart-button.js`, `css/phone/smart-button.css`): attack, loot, talk, use, or
    nothing, by what is about; its icon says which (no words), lit warm while you attack.
  - the drawer (`js/inventory-drawer.js`, `css/phone/inventory-drawer.css`), opened by the backpack or the map
    button: equipment and backpack side by side; swipe up on its tab for everything, with other opened bags; down on
    its handle to go back. The backpack button, a touch on the map or dragging a thing out over the map closes
    it; the smart button goes on acting meanwhile, and the map slides up so you stay in sight above the half-open drawer.
    With a companion, the Hero page has his card above your skills (`js/companion-card.js`,
    `css/phone/companion-card.css`): portrait, health, experience, damage, how he fights and what you can do for him;
    holding him on the map opens it there (a monster under the finger wins), and a small bar at the end of your health
    bar shows his health. Along its bottom, five tabs: Gear (only what you wear and carry), Hero (your companion and your skills), Map (the minimap as big as the drawer), Quests and Settings (what the Menu
    held, and the help); they borrow those parts from the side panel while shown, as the gear does.
- **The chat line** on top of the bar (`js/chat-line.js`, `css/phone/chat-line.css`): the newest message; tap it for the chat,
  which opens at the newest line above the action bar, with a send button; the tab on its edge closes it (the smart
  button goes on acting).

**One HUD, two states.** `MobileHud` in `js/mobile-hud.js` puts `body[data-hud]` on `normal` (no target) or `combat`
(a living target: the target pill shows, the smart button is lit). Everything is drawn with the HUD tokens at the end
of `css/phone/theme.css` (`--hud-bg`, `--hud-slot-top`, `--hud-edge`, `--hud-gold`, `--hud-hp`, `--hud-mp`,
`--hud-exp`, `--hud-target`, `--hud-font` and so on): a clean, nearly black look, grey slot edges, little gold, no glow,
no blur. The status bar, the map button and the bottom bar take every tap themselves, so none walks you to the map
behind them (`tests/mobile-ui.test.js` checks it).

Windows (the drawer, menu, character, chooser, talk, chat, shop, loot) share the HUD's look: charcoal panels, grey
edges, every place for a thing a slot, main buttons warm and dark with a thin gold edge, the chosen tab with a gold line
at its foot (`css/phone/theme.css`, its colours at the top, the windows' parts at the end).
The page fits the phone's screen and its safe areas (status bar, home indicator): `css/phone/layout.css`,
`js/mobile-viewport.js`, `manifest.json`.

## How it is built

- Each part is a module of its own: one script and one stylesheet, loaded after `touch.js` in `index.html`. They only
  show and ask: every rule (mana, cooldowns, targeting, protection zones, reach, paths) stays in the game's logic files,
  which decide and say why they refuse.
- They use what the page already has instead of copies: the action bar the favourites of `touch.js`, the drawer the
  equipment and container windows of `game-ui.js` (borrowed while it is open, given back after), the chat line the log.
- The stylesheets: `css/base.css` (every page), `css/game.css` (the game, on a computer and what a phone shares),
  then `css/phone/`: `layout.css` (the phone's layout), a file per module, and `theme.css` (colours) last.
  `tests/ui-snapshots.js` checks a change to them moves nothing that shouldn't: take a reference before, compare after.
- Upright only: on its side the phone keeps the earlier layout.

## Tests

| What | Command |
|---|---|
| The action buttons' gestures | `node tests/mobile-slots.test.cjs` |
| Their mana, cooldowns, potions and pictures | `node tests/action-slots.test.cjs` |
| The smart button's choice, in the real world | `node tests/smart-button.test.js` |
| Every control in reach and each gesture doing one thing, on an iPhone SE, 15 and 15 Pro Max | `node tests/mobile-ui.test.js [folder]` |
| The interface driving the game: walking, floors, talk, loot, spells, potions, the drawer, map, chat, turning | `node tests/mobile-regression.test.js` |

The last two need Playwright (see AGENTS.md). They emulate an installed iPhone (its safe insets) and drive it with a
mouse: a real phone, with real fingers, is the final check.

## Still open

- **Spell pictures**: the knight's eight spells, the potions and food have one; the paladin's, sorcerer's and druid's
  spells show their initials until there are pictures for them (`ART` in `js/action-slots.js`; the files go in
  `sprites/ui/actions/<spell id>.png`, 128 x 128, transparent).
- **Secure mode** comes back on the phone with the mainland's PvP and skulls (`docs/next-steps.md`).
- **On a real iPhone**: the standalone look, the swipes' feel and the speed are to be tried by hand.
