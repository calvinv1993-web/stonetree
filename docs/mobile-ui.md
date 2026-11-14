# The phone's interface

How Lickii Adventures looks and works on a phone, held upright, and which file does what. Built in eleven phases in
November 2026 (versions ui227 to ui236); the last version before it is commit `819e3cc` (ui227), to go back to if
ever needed.

## What the player sees

From top to bottom:

- **The status bar** (`css/phone/layout.css`, built in `js/mobile-hud.js`): the level, health with a heart and mana
  with a drop (current / max), and a thin experience bar with its percent. Nothing to tap up here: one hand reaches
  everything at the bottom.
- **The map**, as big as the space between the bars allows.
- **The action bar** (`js/mobile-hud.js` puts it together):
  - three spells on the left, three spells, potions or food on the right (`js/action-slots.js`,
    `css/phone/action-slots.css`): each its picture, a spell's mana with a drop, a potion's count; a gold edge when it can be
    used, dimmed without the mana or with none left; a shade and the seconds while it cools down. Tap to use, hold to
    choose what goes there, swipe sideways for the next set of three (both groups apart, kept per player).
  - the smart button in the middle (`js/smart-button.js`, `css/phone/smart-button.css`): attack, loot, talk, use, or
    nothing, by what is about; its colour says which.
  - the drawer tab above it (`js/inventory-drawer.js`, `css/phone/inventory-drawer.css`): swipe up for equipment and
    backpack side by side, up again for everything, with other opened bags and the skills; down on its handle to go
    back. Dragging a thing out over the map closes it.
    Along its bottom, four tabs: Gear, Map (the minimap as big as the drawer), Quests and Settings (what the Menu
    held, and the help); they borrow those parts from the side panel while shown, as the gear does.
- **The chat line** under the bar (`js/chat-line.js`, `css/phone/chat-line.css`): the newest message; tap it for the chat,
  which opens at the newest line above the action bar, with a send button; the smart button or the tab on its edge
  closes it.

Windows (menu, character, chooser, talk, chat, shop) share one dark and gold look: `css/phone/theme.css`.
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
