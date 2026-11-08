# Working on Tilequest

This is a guide for AI agents (and developers) who continue the project: how the code works, the rules that keep it working, and how to check a change. `README.md` is the player-facing reference (features, controls, rules of play). `HANDOVER.md` covers setup.

## What it is

- A 2D tile RPG in the style of Tibia: floors, a starter island, vocations, parties, guilds, PvP with skulls, houses, a forge and a main story.
- Plain HTML5 canvas and JavaScript. There's no build step, no framework and no runtime dependencies. Node is only needed for the server and the tests.
- It's played two ways:
  - **Alone**, by opening `index.html` in a browser. The save lives in `localStorage`.
  - **Together**, through `server/server.js`: one shared world on a LAN that browsers and phones connect to.
- Everything in it is original: names, art (all sprites are drawn in code), dialogue and story. Homages to Tibia are fine, but don't copy its names, quotes or art.

## Commands

| What | Command |
|---|---|
| Play alone | open `index.html` |
| Server | `node server/server.js [port=8080] [--test]` |
| Dev server: restarts on changes, pages reload themselves | `node server/dev.js 8090 --test` |
| Unit tests (about a minute) | `node tests/unit.test.js` |
| Tests kept for later (the old world's rules and content, which wait for the mainland or a test area; they fail for now) | `node tests/later.test.js` |
| Playthrough: a bot plays Oakvale from level 1 to 10 on the real world, careful or lazy | `node tests/playthrough.js [seed] [hours] [lazy]` |
| Soak test: random play on the real logic | `node tests/sim.test.js [minutes=30] [runs=4] [seed=1]`; `npm test` runs unit + sim |
| Online test (spawns its own server) | `node tests/online.test.js` |
| Browser soak test | `node tests/browser.test.js [seconds] [seed]` |
| Screenshot of the real page | `node tests/screenshot.js out.png [x y z] [--hour 22] [--mobile] [--view] [--eval "js"]` |
| Balance along the Oakvale route: fights with the real combat code | `node tests/balance.js [name]` |
| Pace: how long the Oakvale route takes to level 10, played with the real combat code (aim: about 150 minutes) | `node tests/pace.js [seed]` |
| World validator: size, coast, floor changes, reachability | `node tests/world.test.js [--verbose]` |
| Editor in a real browser, desktop and phone | `node tests/editor.test.js [screenshot-folder]` |
| Top-down picture of one floor | `node tests/world-map.js out.png [z] [--grid]` |
| Syntax check | `node --check js/<file>.js` |

- **Node 22 or newer**: the online test uses the built-in `WebSocket`.
- **It runs on Windows, macOS and Linux**, and so must every change:
  - build paths with `path.join`, and file URLs with `url.pathToFileURL`
  - no shell-specific commands in the scripts
  - stop the server through its `'stop'` IPC message, not a signal: on Windows a kill can't be caught, so the server couldn't save first. `dev.js` and the online test already do this.
  - the project's owner plays on Windows
- **Browser tests and screenshots** need `npm install` and `npx playwright install chromium`, or point `PLAYWRIGHT_CORE` at an existing playwright-core. They serve the pages over a tiny local http server (`tests/serve.js`): over `file://` the custom PNG sprites make canvases unreadable.
- **`--test` mode**: new characters start at level 20 in Valoria with gear, unless they pick "Start fresh on Brightwater Isle" at login.

## How the code is put together

### One game logic, three hosts

The **logic files** have no DOM code:
`defs, items, creatures, npcs, data, map, default-map, game-core, game-combat, game-npc, game-social, game-forge, game-guide, game-tales, game-update`.

The same files run in three places:
- **Browser**: `index.html` loads them as plain `<script>` tags, which share one global scope. After them come the browser-only files: `sprites, render, sound, fx, game-ui, net, game, touch`.
- **Server**: `server/server.js` loads them into one `vm` sandbox and calls `updateWorld()` every 50 ms.
- **Tests**: `tests/harness.js` loads them into a `vm` sandbox, with `Math.random` seeded.

> **The list of logic files is kept in four places.** Change all four together, in load order (definitions before anything that uses them at top level):
> `index.html` script tags · the load loop in `server/server.js` · the `LOGIC` regex in `server/dev.js` · `LOGIC_FILES` in `tests/harness.js`.

### The acting player

- All logic is written from the point of view of the global `player`.
  - Offline, that is you.
  - On the server, `asPlayer(p, fn)` (in `game-core.js`) swaps `player` for the duration of `fn`.
- `log()`, `logDialog()`, `playerEvent()` and `uiDirty()` all go to the current `player`.
- To affect others, loop over them: `for (const p of players) asPlayer(p, () => ...)`. `startRaid` and `taleTell` do this.
- Things others should see or hear go through **effects**, which are broadcast to nearby viewers: `addSound`, `addBurst`, `addSparkle`, `addSpeech`.

### Actions: the only way in

- `Actions` in `game-update.js` holds every player input, each taking plain-data arguments: ids, coordinates, item refs such as `{ root: 'bag', path: [...] }`.
- Online, `net.js` replaces each Action with a stub that sends `{ t: 'act', a: name, args }`. The server runs it as that player if `name` is in `Object.keys(G.Actions)`.
  - So a new Action works online automatically.
  - Never pass objects or creatures to an Action; pass ids.
- The UI (`game-ui.js`, `game.js`, `touch.js`) changes game state only through `Actions`. It may *read* state and call pure helpers, such as `guideTarget`, `partyView` and `itemInfo`.

### What a browser gets online (`server/server.js`)

Twenty times a second, `snapshot()` sends each connection:
- **`you`**:
  - the fields in `ALWAYS`, on every tick
  - the fields in `SOMETIMES` (equipment, quests and so on), when `p.dirty` (set by `uiDirty()`) or on every 20th tick
  - a few views computed per player (`partyView`, `guildInfo` and so on)
- **What's nearby**: other players (their own field list: add to it if others must see something new), monsters, walking NPCs, piles, fields and new effects
- **Changes**: changed tiles, queued log lines (`outbox`) and `events`

The client copies every key of `you` onto its local `player` (`net.js` `apply`).

> **A new player field the browser must see:**
> 1. a default in `newPlayer` (`game-core.js`)
> 2. `SAVED_FIELDS` if it should persist (think of old saves in `applySave`)
> 3. `ALWAYS` (small) or `SOMETIMES` (big) in `server/server.js`

Some details of the online client:
- **The map**: the browser builds its own copy of the world from `default-map.js`. `mapSignature()` must match the server's, or the page reloads to get the same version. Runtime tile changes come in the snapshots.
- **Updates**: when files in `js/`, `css/` or `sprites/` change, the server tells pages to reload, and they log straight back in with a token.

### Saving

- **A character**: `serializePlayer` / `applySave` over `SAVED_FIELDS`.
  - Offline it goes to `localStorage` (`tilequest.save.v3`).
  - Online it goes to `server/players.json`, which also holds the account: name and password hash.
  - `applySave` teleports a character home if their saved tile is no longer walkable, for example after the world changed.
- **Server files** (all gitignored):
  - `players.json`: accounts and characters
  - `world.json`: monsters, corpses and dropped things, kept over a restart of under 10 minutes
  - `guilds.json`
  - `map.json`: a map published from the editor, played instead of the built-in world

### The world

- **The built-in world is being rebuilt** as Oakvale Isle, a hand-designed starter island, phase by phase with the owner's approval. The plan, with every coordinate and what's still open, is in `docs/world-plan.md`.
- **`default-map.js`** draws the world from `ISLE_DESIGN`, plain data at its top: outlines (coast, lakes, forests, mountains, marshes) and lines (rivers, roads, paths).
  - It's deterministic: a fixed hash of the coordinates only roughens edges and scatters trees inside the drawn areas. Nothing is generated at random, and editing one feature never moves another.
  - Its size is `WORLD_SIZE`: 256×256 tiles, 16 floors. `loadStoredMap` only accepts an editor map of that size.
- **Coordinates**: `x, y, z`. `z` goes **up** with altitude, and `map.surfaceZ` is 8: floors 0–7 are underground, 9–15 above ground (mountain tops, upper storeys, roofs).
- **Floor changes** (`changeFloor` in `game-core.js`) move you exactly one floor, at the same x, y, or the first free tile next to it, and never onto another floor change. So every stair, ladder, hole and ramp needs free ground there on the other floor.
  - Mountains are `cliff`s with their top on the floor above, at the same x, y.
  - Paths up are a `ramp` with a `ramp_top` above it, on a south or east edge. Elsewhere the shifted top hides them.
- **`tidyWorld()`** (end of `createDefaultMap`) applies rules over the whole world at once (nothing hangs on a wall behind stairs, no lone grass tile in a trail). Put a rule there, and a check in `world.test.js`, instead of fixing one spot.
- **Check the world** with `node tests/world.test.js`. It runs every floor change through the game's own code, from every side, and checks that everything can be reached and walked back from. Run `node tests/editor.test.js` for the editor.
- **A tile**: `null`, or `{ ground, items: [ids] }`.
  - The ids come from `THINGS` in `defs.js`, whose flags are documented at its top.
  - Per-tile settings live in `map.meta["x,y,z"]`: `to, target, lock, quest, level, text, look, ore`.
- **Map lists**:
  - `map.spawns`, `map.npcs`
  - `map.temples` (home towns)
  - `map.zones` (protection zones; shelters, which monsters keep out of)
  - `map.houses`, `map.labels`
  - `map.isle`: the starter island's bounds
  - `map.start` and `map.mainStart`
- **Saved maps** (editor storage, exports, `server/map.json`) use a compact format, `tilequest-map-4`: a palette of distinct tiles plus run lengths, so the whole world is about 0.5 MB instead of 10. `GameMap.fromJSON` also reads the older `tilequest-map-3` tile lists.
- **Helpers** in `default-map.js`: `put, npc, spawn, sign, meta, building, shop, road, room, tunnel, blob`, and `afterCarving` for things that need the underground carved first. Named places are in `MAP_TOWNS` and `MAP_SIGHTS` at the top.

### Content is plain data

| What | Where |
|---|---|
| Map things | `THINGS` in `defs.js` |
| Items | `ITEMS` in `items.js` |
| Monsters, conditions, fields, vocations, skills, spells, XP curve | `creatures.js` |
| NPCs, quests, raids, lore | `npcs.js` |

- Each file documents its fields at the top. Read that before adding entries.
- The data editor (`data.html`) can override these per browser (see `data.js`). That's for playing around offline; the real content is the files.

### Drawing and feel (browser only)

| File | What it does |
|---|---|
| `sprites.js` | Procedural sprites, cached. `DRAW` (map things), `ITEM_DRAW` (items), `MONSTER_LOOKS`, the humanoid drawer (players and NPCs, from `look`), `VARIANTS`, `ANIMATED`. Helpers: `rect, ellipse, poly, line, diagonal, shadow, onWall, face`. |
| `render.js` | Fake-3D floors: upper floors are shifted up-left, and roofs hide when you're under them. |
| `fx.js` | Light, weather, seasons, particles, blood. Cosmetic only: it must never change game state. Weather follows the shared clock, seasons the real date. |
| `game.js` | Input, the frame loop and canvas overlays: names, bars, frames, the guide arrow, banners. |
| `game-ui.js` | DOM panels and windows, the log, minimap and world map. |
| `touch.js` | Phone controls. |
| `sound.js` | Synthesized sounds and music. Sound names are used by `addSound`. |

- **The art style** (camera, light, outline, shading, ground transitions, what stands upright) is in `docs/art-style.md`. Every new sprite follows it.
- **Every item needs an `ITEM_DRAW` entry, and every thing a `DRAW` entry.** A missing one crashes drawing. The browser soak test draws them all.
- **Custom PNGs** can replace any sprite: see `sprites/custom.js`.

### Time

- `now` is in ms:
  - offline, the animation-frame time
  - online, the server clock, `Date.now() - EPOCH`
- One in-game hour passes per real minute: `worldMinutes()` and `daylight()` in `game-update.js`.

## Rules and gotchas (each of these has bitten before)

**The vm sandboxes**
- Functions the server calls as `W.name` must be **top-level `function` declarations**. Those become properties of the sandbox; top-level `const` and `let` don't.
- For the same reason, tests reach top-level `const`/`let` through the getters on `state` in `tests/harness.js`. Add new ones there.
- **Comparing objects across vm realms**: `assert.deepStrictEqual` fails on objects from the sandbox. Compare `JSON.stringify` instead.
- **No browser APIs in logic files**: no `window`, `document`, `fetch`, `atob`/`btoa` or `performance`. Keep logic deterministic, apart from `Math.random`.

**Game rules that trip up tests**
- **Tests that give the test character a vocation** usually also set `home: 'main'` and teleport off Brightwater Isle. Vocation holders can't ride back to it (`isleBars` in `game-guide.js`), and their deaths take them to their home temple.
- **Secure mode** is on by default: area spells spare innocent players. PvP tests set `secure: false` and stand outside protection zones. Marble floors (temples, depots) and `map.zones` are protection zones: no attacks inside them or into them.
- **Monsters stay out of shelters** (shops, houses) and temples; `findFreeTile(..., forMonster)` knows this.

**Server and processes**
- **The online test** backs up and restores `server/players.json` and `world.json`. Don't run it while a dev server in the same folder is running: both write those files.
- **Localhost-only endpoints**: publishing a map (`POST`/`DELETE /map`) and `POST /admin/gold?atLeast=N` work only from localhost, with the header `X-Tilequest: editor`.
- **What the HTTP server serves**: top-level `*.html`, `manifest.json`, and `js/`, `css/` and `sprites/`. Nothing else, so the `server/` folder and anything else in the project folder stay private. A malformed address gets a 400 and doesn't crash the server.
- **The server must survive anything a page sends.** Every message handler is wrapped. Login fields are coerced to strings. Actions validate their arguments: ids, integer coordinates, whole counts, and things within reach (`rootContainer` only resolves piles next to you and the depot at a locker).
- **Stopping a server you started**: Ctrl+C in its terminal. From a script, find its PID by port and kill that PID: `ss -ltnp | grep :8090` on Linux, `netstat -ano | findstr :8090` then `taskkill /PID <pid>` on Windows. `pkill -f <pattern>` can match your own shell.

## The sealed tale (`js/game-tales.js`): leave it be

Brightwater Isle has a secret quest, a legend that players aren't supposed to be able to look up.
- Its steps and texts are encrypted in the `TALE` table: each step opens only from a fingerprint of the right deed.
- The plaintext and the tool that seals it are deliberately **not in this repository**; the previous owner keeps them.
- Without them, `tests/unit.test.js` only checks that deeds out of turn do nothing.

What to keep as it is:
- **Don't** try to decode or brute-force it, reformat `TALE`, or change `taleHash`, `taleStream`, `TALE_SEEDS` or the signature formats.
- **Keep the hooks**: the `taleDeed(...)` calls in `useTool` (shovel and pick), `say()`, `killMonster` and `blowWhistle`.
- **It depends on the starter island staying as it is**: the hand-placed things in the Brightwater Isle section of `default-map.js`, the island's monsters and items, and the world clock. If you have to move or change those, say so in the commit message: the tale may need resealing by whoever has its plaintext.

## Code style

- **Language**: plain `'use strict'` scripts, no modules. Two-space indent, single quotes, semicolons, lines up to about 150 characters. Small helpers are arrow functions; anything the server calls is a `function` declaration.
- **Comments**:
  - Each file starts with a comment saying what it holds.
  - Data files document every field at the top.
  - Elsewhere, short plain-English comments in the game's own terms, explaining what and why. Match the density of the code around you.
- **Naming** is in the game's terms: `player`, `monsters`, `piles` (corpses and dropped things), `fields`, `effects`, `THINGS`, `ITEMS`, `QUESTS`.
- **In-game text**: plain, friendly English; keywords in `{braces}` are clickable in dialogue; `$name` is the player's name.
- **README.md**: update it with every gameplay change. Short bullets, written for players.
- **Tests**: `test('what it checks, as a sentence', () => { ... })` in `tests/unit.test.js`, using `loadGame()` or `quietGame()` (no monsters), `tick(game, ms)`, `state.Actions`, and `bagRef(state, id)` for item refs.

## How to check a change

1. Run `node --check` on the files you touched, then `node tests/unit.test.js`. It must end with "all N passed".
2. Logic that runs every tick: run a short soak (`node tests/sim.test.js 5 2`), or `npm test`.
3. Anything online (snapshots, new player fields, actions, server code): run `node tests/online.test.js`, with no dev server running in this folder.
4. Anything visible: take a screenshot and look at it, e.g. `node tests/screenshot.js /tmp/shot.png 112 57 4 --view`. Use `--mobile` for the phone layout and `--hour 23` for night.
5. Add a unit test for new rules, and update `README.md`.

## Recipes

| To add | Do this |
|---|---|
| An item | an entry in `ITEMS` (fields at the top of `items.js`); a sprite in `ITEM_DRAW` (`sprites.js`); a way to get it: a loot table in `creatures.js`, a shop in `npcs.js`, a chest or a quest reward |
| A monster | `MONSTERS` in `creatures.js`; a look in `MONSTER_LOOKS` (`sprites.js`); spawns in `default-map.js`: `spawn('type', [[x, y], ...], z)` |
| An NPC | `NPCS` in `npcs.js`: `look`, `greet`, `keywords` (`'a\|b'` matches either word; services are listed at the top), optional `trade`, `chatter`, `wander`; then place it with `npc('id', x, y, z)` in `default-map.js` |
| A quest | `QUESTS` in `npcs.js` (`kill`, `fetch`, or `steps` across NPCs; `level`; `reward`; texts), offered through an NPC keyword `{ quest: ['id', ...] }`. One-time chests are `qchest_*` things with a `chest` setting in `defs.js` |
| A spell | `SPELLS` in `creatures.js` (the kinds are handled in `castSpell` in `game-combat.js`) |
| A map thing | `THINGS` in `defs.js`; `DRAW` in `sprites.js`; placed with `put(x, y, z, 'id')` |
| A player action | a method on `Actions` with plain-data arguments; the UI calls it |
| A player field | `newPlayer`, `SAVED_FIELDS` and `ALWAYS`/`SOMETIMES` (see above) |
| A logic file | the four load lists (see above) |
| A sound | an entry in `SOUNDS` in `sound.js`; play it with `addSound('name', x, y, z)` |

## Where things stand

The game is full-featured and stable. All unit tests pass. The old world's tests (33 of them: combat, PvP, doors, houses, the forge, rides, the mainland's story and more) wait in `tests/later.test.js`: they need places and NPCs the rebuilt world doesn't have yet. Bring them back into `unit.test.js` with a small test area of their own, or once the mainland is back.

**Asked for but not done yet**: Tibia-like levelling to 100 and a review of the equipment.
- The XP curve is quadratic now (`xpForLevel` in `creatures.js`). Tibia's is cubic.
- Monsters need a difficulty spread from level 1 to 100+, including new high-level monsters, with demons staying hard.
- Gear needs tiers up to level 100.
- Afterwards, retune `monsterTier` in `game-forge.js` and the story chapters' levels (`seal_1` to `seal_9` in `npcs.js`).

**Ideas the group liked**:
- from successful OT servers: hunting tasks with a task shop, autoloot, party dungeons, daily tasks, scheduled world bosses, automated events, pets, XP stages, a PvP arena
- from Tibia: a VIP list, safe trade, private messages, a market, a bestiary and charms, achievements and highscores

## Git

- Work on `main`, or on branches if you prefer.
- **Commit messages**: a plain-language summary line, then bullets for the details. Run the unit tests before committing.
