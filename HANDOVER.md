# Taking over Tilequest

Welcome! Tilequest is a Tibia-style 2D RPG: a starter island, four vocations, a big world with towns, dungeons and islands, parties and guilds, PvP with skulls, houses, a forge and a main story. It runs in a browser on PCs and phones, alone or together on your local network. This page gets you set up and shows you around. After that:

- **`README.md`**: what's in the game and how to play it.
- **`AGENTS.md`**: how the code works and the rules that keep it working. Read it before you change much; an AI assistant reads it on its own.

## What you're getting

- **Included**: the whole game, with its full git history (`git log` shows how it grew, step by step), the tests and these docs.
- **Not included**:
  - the old server's saved characters and accounts (`server/players.json` and friends): you start with a fresh world
  - the solution to the island's secret (see below)

## Setting it up

Everything below works on Windows, macOS and Linux. The commands are the same in Windows' Command Prompt and PowerShell.

1. **Install [Node.js](https://nodejs.org)** (the LTS version, 22 or newer) and **[git](https://git-scm.com)** (on Windows: Git for Windows). There is nothing else to install to play.
2. **Unzip the folder** and open a terminal in it. On Windows: open the folder in File Explorer, click the address bar, type `cmd` and press Enter. Or right-click inside the folder and pick **Open in Terminal**.
3. **Play alone**: open `index.html` in a browser (double-click it). Your character is saved in the browser.
4. **Play together** on your network:
   ```sh
   node server/dev.js 8090 --test
   ```
   - On your own computer, open http://localhost:8090.
   - Everyone else on the same Wi-Fi opens `http://<your computer's IP>:8090`. Find the IP with `ipconfig` on Windows, `hostname -I` on Linux, or in System Settings › Network on a Mac.
   - If others can't connect, allow Node.js through your firewall. Windows asks the first time the server starts: tick **Private networks** and click Allow.
   - Phones work too: they get touch controls. On an iPhone, use Share › Add to Home Screen for fullscreen.
   - **`--test`** gives new characters level 20 and good gear in Valoria, which is handy for trying things out. At login you can instead pick **"Start fresh on Brightwater Isle"** to play it properly from level 1, with the guide. Leave out `--test` for a real server, where everyone starts on the island.
   - **`dev.js`** restarts the game server whenever you change the code. Everyone's page reloads by itself, and they keep playing on the new version within seconds.
   - **Stop the server** with Ctrl+C in its terminal. It saves everyone first.
   - The plain `node server/server.js` (port 8080) also works, without the restarting.
5. **For the browser tests and screenshots** (optional): run `npm install`, then `npx playwright install chromium`.
6. **Put it in your own git repository**:
   ```sh
   git remote add origin <your repository's URL>
   git push -u origin main
   ```

## Making changes

Keep `node server/dev.js 8090 --test` running and the game open in your browser. Edit a file, save, and the game reloads with your change.

| You want to change | Look in |
|---|---|
| Items (weapons, armor, potions, loot) | `js/items.js` |
| Monsters, spells, vocations, skills | `js/creatures.js` |
| NPCs, their dialogue and shops, quests, raids | `js/npcs.js` |
| Things on the map (walls, trees, doors, chests) | `js/defs.js` |
| The world itself: where towns, monsters and NPCs are | `js/default-map.js`, or draw your own map in the editor (`editor.html`) |
| How anything looks (everything is drawn in code) | `js/sprites.js` |
| Light, weather, particles | `js/fx.js` |
| The rules (combat, quests, trading...) | `js/game-*.js` |
| Windows and panels | `index.html`, `css/style.css`, `js/game-ui.js` |
| The server | `server/server.js` |

- Each data file explains its fields at the top.
- **Before you commit**, run `node tests/unit.test.js`; it should end with "all … passed".
- To see a change without playing to it: `node tests/screenshot.js shot.png 112 57 4` (x, y, floor) takes a picture of the game there.

## Running the server day to day

- **Characters** are saved in `server/players.json` and guilds in `server/guilds.json`. Copy both now and then as a backup.
- **To start the world over**: stop the server and delete `server/players.json`, `server/guilds.json` and `server/world.json`. That deletes everyone's character.
- **Gold for everyone online**, e.g. so they can travel. Run this on the server's computer (on Windows, keep the `.exe`):
  ```sh
  curl.exe -X POST -H "X-Tilequest: editor" "http://localhost:8090/admin/gold?atLeast=10000"
  ```
- **Your own map**: open `http://localhost:8090/editor.html` on the server's computer, draw, then click **Publish to server**. **Server: built-in world** switches back.

## Working with an AI

The project is set up for AI coding assistants:
- **Claude Code**: open a terminal in the folder and run `claude`. It reads `CLAUDE.md`, which points to `AGENTS.md`.
- **Codex, Cursor and the like**: they read `AGENTS.md`.

What works well:
- **Say what you want as a player would**, e.g. "add a fishing quest in Ashport" or "make the desert more dangerous at night". Let it work out the code.
- **Ask it to check its work**: run the unit tests, take a screenshot of anything visual, and update `README.md`.
- **Read what it changed** (`git diff`), try it in the game, then commit.
- **Big changes go better in steps**: one feature, tested and committed, then the next.

## The island's secret

Brightwater Isle has a legend that the islanders tell, and nobody knows whether it's true. Its quest is in `js/game-tales.js`, encrypted on purpose, so that not even the code gives it away. The solution and the tool that seals it are not in this folder.

- **To keep it working**:
  - leave `js/game-tales.js` alone
  - keep the starter island's hand-placed things where they are
  - keep Brightwater's monsters and items as they are
- If you do need to change those, the quest may need resealing. Ask whoever gave you this project.
- Or try to find it in the game yourself. Only characters without a vocation can.

## What's next

**Asked for, not done yet**: Tibia-like levelling to level 100, with harder monsters spread across the levels (demons should stay scary), and gear to match. The details are at the end of `AGENTS.md`.

**Ideas the group liked**:
- hunting tasks with a reward shop
- autoloot
- party dungeons
- daily tasks
- world bosses on a schedule
- automated events
- pets
- a PvP arena
- a friends list
- safe trading between players
- private messages
- a market
- a bestiary
- achievements and highscores

Have fun with it!
