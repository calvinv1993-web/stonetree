# Tilequest

A small top-down 2D RPG with floors, a starter island, vocations, multiplayer, a map editor and a data editor. It's plain HTML5 canvas and JavaScript, with no build step and no dependencies.

Taking over the project? Start with [HANDOVER.md](HANDOVER.md) (setup and a tour). [AGENTS.md](AGENTS.md) explains how the code works, for developers and AI assistants alike.

## Run

**On your own:** open `index.html` in a browser. Your character is saved in the browser automatically. **New character** starts over.

**Together on your local network:**

```sh
node server/server.js          # port 8080; or: node server/server.js 9000
node server/dev.js 8090        # the same, restarting itself whenever the game changes (see below)
```

- On the computer running it, open http://localhost:8080.
- Everyone else on the same network opens `http://<that computer's IP>:8080`. To find the IP, run `hostname -I` on Linux, `ipconfig` on Windows, or check System Settings › Network on a Mac.
- Pick a name and an optional password. Logging in with the same name and password later gets the same character back.
- If others can't connect, allow the port through the firewall: Windows asks the first time the server starts (allow it on private networks); on Linux, e.g. `sudo ufw allow 8080/tcp`.
- The server keeps characters in `server/players.json`. To play on a map made in the editor, open the editor from the server (`http://localhost:8090/editor.html` on the server's computer) and click **Publish to server**: it's saved as `server/map.json`, and `server/dev.js` restarts the server on it. **Server: built-in world** switches back. (Or export it and save it as `server/map.json` yourself.)
- **Keep playing while it's being changed**: run `server/dev.js` instead of `server/server.js`.
  - It restarts the game server whenever the game logic or the server code changes.
  - Before each restart the server saves every character (including skulls and rides in progress) and the world (monsters, corpses, things on the ground).
  - Pages reconnect within a second. They reload by themselves when the game files changed and log straight back in, so everyone gets the new version within a few seconds.
  - A plain page reload also keeps you logged in.
- **Test mode**: add `--test`, e.g. `node server/dev.js 8090 --test`. Every new character becomes level 20 in Valoria. The login screen asks for a vocation, and you get good gear, potions, runes and gold. Or choose **Start fresh on Brightwater Isle** to begin at level 1 with the guide, as on a real server.

**On a phone:** open the same address. Touch screens get on-screen controls automatically.
- Upright, the map fills the screen and the controls sit over its bottom corners. Sideways, the controls are on both sides of the map.
- ⛶ goes fullscreen on Android.
- On an iPhone, use Share › Add to Home Screen and open the game from there; that is the only way iPhones run it fullscreen.
- Add `?mobile` to the address to try the touch controls on a PC.

**Gold for everyone online** (from the computer the server runs on): `curl -X POST -H "X-Tilequest: editor" "http://localhost:8080/admin/gold?atLeast=10000"` tops up every online player's gold to at least that much (handy for travelling), and tells them. On Windows, type `curl.exe` instead of `curl`.

## The game

> **The world is being rebuilt.** The built-in world is now **Oakvale Isle**, a new starter island, built in stages. So far there's the land: Oakvale's town site with Willow River beside it, Mirror Lake, the North Peaks, Eagle Peak, Bone Rocks and the Spider Hills (rocky mountains in tiers), the Old Tower hill and Hermit Rock, Wolf Woods, Deer Woods and smaller woods, Frog Marsh, Stony Field, Goblin Hill, Sunny Fields and Lighthouse Point. Oakvale itself is built: a walled town in a ring of water, with Willow River running through the middle. The Temple of the Dawn, where you wake up, stands on a rocky mount above the town, with a terrace and broad stone steps down to the square; the depot is beside it in the north-east; over the bridge, the academy (the oracle is upstairs) and the magic shop; along the main street to the south, the smithy, the armourer, the general store, the bakery, the Sleepy Boar inn, the training yard and the graveyard. Shops hang out picture signs, signs explain what each place is for, and there's plenty to find: gravestones to read, sewer grates, and a chest someone forgot. Anyone who has something for you shows it above their head: a yellow **!** for a new quest (grey until you're strong enough), a yellow **?** where you can hand something in. When you greet them, they say which word to ask about (in blue), and the Quests tab tells you where to go next and what to say there. The townsfolk are there too, with shops, and the first story, "The Silent Bell": Sister Ama in the temple sends you to Master Corwin at the academy, to the rats of Sunny Fields, to the depot and to Pip's Provisions. Rats, wolves and goblins live outside the walls. Under the town are the **sewers**: step onto one of the four grates in the streets to climb down, and up the ladder under it to come back. Brick tunnels with a murky channel down the middle run under the main streets, with rats everywhere, giant rats nesting where the walls have fallen in under the graveyard, an old storeroom, and a dead end under the temple mount. Bring light: it's dark down there (at level 2, say "lumen"). The story goes on below: in **The Silent Bell II** (level 2), Sister Ama sends you down to the old bell cellar under the temple, where the bell's rope hangs cut and gnawed, with a strange carved stone beside it. Master Corwin knows the stone: a seal from the crypt under Bone Rocks. The bell of Oakvale hangs high in its own **bell tower** over the temple: steps at the back of the hall lead up to the ringers' room and on up to the bell, open to the sky between pillars under copper eaves. The great bell is silent until its clapper is found. In **The Silent Bell III** (level 6), Corwin sends you to the founders' crypt under **Bone Rocks**: steps cut into the foot of the crag, at the end of the bone trail, lead down to a hall of stone coffins and, a floor deeper, the founder's tomb. Skeletons walk there, and the hooded **Gravewaker**, who silenced the bell to wake the dead. Bring the bell's clapper back to Sister Ama and the bell rings out over the whole isle (after that anyone may climb the tower and ring it, and everyone on the isle hears it), and the oracle lets you choose a vocation from **level 8** instead of 10. The other caves come next. Until then, the places described below aren't in the built-in world.

- **Brightwater Isle** (starter island). You start in the temple next to Elder Maren. The island has:
  - a cellar full of rats
  - a forest with wolves, spiders and a hidden cache
  - a goblin camp
  - a swamp boss
  - a crypt with a pick-one weapon armory
- **The guide**: a new character gets one thing to do at a time, in a box at the top left, with a yellow arrow pointing the way:
  - talk to Maren, then take her quest
  - fight a rat, open its corpse and eat
  - finish the quest and put on the cap it pays
  - trade with Hilda, then meet Guard Tomas
  - the last step: what the island holds, and the Seer
  - click the box's title to fold it away; × puts it away for good
- **There is no way back.** Once you choose a vocation, the Seer sends you to the mainland and you never return to Brightwater Isle: no balloon flies back. Without a vocation, nobody takes you off the island either.
- **Legends**: the islanders tell of a captain whose sword was never found. Whether there is anything to it, nobody knows. Ask around, look closely at things, and remember that once you leave the island, you leave it for good.
- **The world** is generated the same for everyone: lands with ragged coasts, bays and capes, joined by winding necks of land, wooden bridges over the straits, and old portals (obelisks in stone rings) between far-apart regions. Rivers with bridges, lakes (frozen in the north) and mountains with paths up fill the lands, and so do around 30 kinds of places: castles and forts, mines, windmill farms, orchards, lumber camps, quarries, dragon nests, witch huts, shrines, battlefields, craters, fairy rings, ancient groves, caravans, igloos, totem camps, tombs, ghost villages, arenas and more.
- **Islands:** every island out at sea has its own name and story (they're on the map): a dragon's perch, a pirate keep, a wizard's folly, a castaway, treasure buried where three stones point, the Isle of Echoes with a portal home, and many more. Greenhollow's windmills feed half the world, the Shattered Isles are what's left of a drowned kingdom, and the Seawall still keeps watch. Fly there by balloon.
- **Walking** is quicker on roads, paving and floors than on grass and sand, and slowest through snow and swamp, as in Tibia. Clicking somewhere takes the quickest way, not the shortest. Rides keep their own pace.
- **Towns** grow around a square with a fountain and market stalls, the temple on its north side, and streets with pavements, lamps and trees. Along the streets stand shops, halls, an inn and houses, each with its own roof (clay, slate, shingle, thatch, copper or flat, shaped into hips and ridges). Townsfolk stroll the streets and chat: guards, criers, bards, children, cats, dogs and chickens. Talk to them: they know the news. Inns stand halfway along the long roads between towns.
- **Outfits**, as in Tibia (the Outfit button): 8 outfits (citizen, hunter, mage, knight, noble, barbarian, druid, pirate), each in a male and a female cut. Colour the head, primary, secondary and detail parts from 133 colours. Each outfit has two addons, a hat and a piece of gear, that unlock at levels 20 and 40.
- **Vocations**: at level 10, the Seer (upstairs in the tower south of the square) lets you become a knight, paladin, sorcerer or druid, and sends you to the mainland.
- **Valoria** (mainland) has a temple, depot, bank, shops, houses for rent and quest givers. Around it:
  - an orc fortress
  - a bandit camp
  - ogre caves
  - a dark mage tower
  - a pier with ships to **Ashport** and its pirate caves
- **The Highlands**, east over a land bridge, or by ship to the Greymoor harbour:
  - **Castle Greymoor** has a moat, corner towers, King Odran's keep, a chapel, a smithy and a treasury. Below it are cellars overrun by giant spiders.
  - **The cyclops mountain** has a camp and a summit. Climb it by the mountain paths.
  - **The dragon lair** lies under the mountain; the way down is at its east foot.
  - **The Webwood** is a dark forest full of webs and giant spiders. Keep your eyes open there.
- **The southlands**: an orc war camp, a lake, bandits and wolves.
- **Rides**: in the world map (`G`, or 🐴 on a phone), press 🐴 Ride, click any place you have seen and pick a ride. Drag the map to look around.
  - **Hoofer cab**: a horse cab. It goes by land, faster than walking, for 1 gold per tile.
  - **Balloon**: flies straight there, over water too, for 2 gold per tile.
  - **Dom**: three times as fast as the cab, for three times the gold. He pulls up, says his thing, pops a wheelie and races you there by land.
  - You can't do anything else while riding, but everyone sees you pass by.
  - You can't order a ride while fighting or with a white skull (a red skull alone is fine).
- **The main story, the Ember Seal** (levels 8 to 70, nine chapters): long ago the demon lord Vharzul the Ashen was sealed beneath the volcano of Cinderhold, and the seal's fire was split into five embers for five peoples to keep. The seal is failing and the Ashen Choir hunts the embers. It starts with the Seer's dream on Brightwater (or ask Grandmaster Orin in Valoria about the "seal"), and takes you to Ashport, Frosthold, Deepforge, Kesh and Port Verdant for the embers, to the dwarves to reforge the seal (the Ember Seal amulet), and down into the demon pit to face Vharzul. The Quests tab always shows where you are in it and where the next chapter starts.
- **Quests** come from NPCs (kill, fetch, or several steps) or are one-time quest chests. Progress is in the Quests tab.
- **Skills, equipment, loot, conditions, runes, fields, houses, blessings, raids, a day/night cycle and PvP** (outside towns and the starter island).
- **Hunting together:** everyone who hurts a monster gets a share of its experience (by the damage they did) and the kill for their quests.
- **Parties**, as in Tibia: right-click (or hold) a player to invite them; they join the same way. The leader can share the experience: then what the members earn goes into one pot, with a bonus for the different vocations in the party (20% for one, 30% for two, 60% for three, 100% for four), and everyone gets an even share. It works while the lowest level is at least two thirds of the highest, everyone is within 30 tiles of the leader (a floor up or down at most) and everyone has fought in the last two minutes; the party box says why when it doesn't. Shared experience floats up in blue over every member. Party members get a shield by their name (gold: the leader, with a tick while sharing works), can't hurt each other, and talk in the Party tab of the chat (or `/p` before a line).
- **Guilds:** the Guild button opens your guild window. Found a guild, invite players (or right-click them), join from your invitations; ranks (leader, vice-leaders, members; the leader can rename them), nicks, a message of the day, and the Guild tab of the chat (or `/g`). Fellow members get a green emblem by their name, and looking at a player shows their guild. The server keeps the guilds.
- **The forge**, after War and Order's: gear comes in five grades, common, fine (green), rare (blue), epic (purple) and legendary (orange), each with 12% better attack, armor or defense. Ore comes in the same grades: monsters drop it (the stronger, the better), and veins in cave walls glitter with it (mine them with a pick; the more dangerous the cave, the better the ore). At a smith (Bram, Armorer Dask in Valoria, Torvald, Gorm) say "forge": pick a piece of gear and put four ore in. Each ore adds to the chance of the next grade: better ore than that grade 25%, ore of that grade 20%, a grade below 5%. So a blue sword with two purple and two blue ore has a 50% chance to turn purple. When it fails, the ore and the fee are gone but the gear stays. Four ore of a grade fuse into one of the next. Monsters drop better graded gear now and then; traders don't buy graded gear.
- **Home town:** ask the priest of any town's temple (Valoria, Frosthold, Sylvaran, Kesh, Mirehaven, Port Verdant) about becoming a "citizen": from then on you wake up in that temple when you die. The Skills tab shows your home town.
- **Dying** costs a tenth of all your experience (a blessing spares 30% of that), as in Tibia, so it can cost you levels, and the health and mana they gave you.
- Monsters respawn about a minute after they die (faster when several players hunt together: with three, twice as fast), where no player can see it happen. If someone stands in sight of a spawn, its monster walks in from beyond the edge of their screen instead, so a hunting ground never runs dry.
- You walk faster as you level, quickly at first and then less and less (230 ms per tile at level 1, about 160 at level 50, 120 at level 100). Haste and the like are on top of that.
- **"allahu akbar"** (level 15+, any vocation): you blow yourself up, with heavy fire damage to everyone within 2 tiles. It isn't on the spell bar, so you have to say it, and it doesn't work in protection zones.
- **Secure mode** (the Secure button next to Chase; 🕊 on a phone), as in Tibia: on, which it is unless you switch it off, your attacks and area spells only hurt players who have a skull, and never your party. Off (it says PvP then), whirlwinds, waves, area runes and the like hit every player around you outside safe places, party members too, and attacking an innocent gives you a white skull.
- **Skulls**, as in Tibia:
  - **White:** attacking an innocent player (no skull) gives you a white skull for 3 minutes after your last such attack. Attacking any player also locks you out of temples for a minute.
  - **Yellow:** attacking someone who has a skull gives you a yellow skull that only they see. They may fight you back without getting a skull themselves.
  - **Red:** killing an innocent player is an unjustified kill. 3 in a day or 6 in a week earn a red skull for 6 hours: anyone may attack you, and dying with it costs everything you carry, blessing or not.
  - **Safe places:** temples and depots (marble floors) are protection zones. Nobody fights inside them (no attacks, attack spells or attack runes from inside, nor into them; healing is fine), and a player with a white skull (or in a fight) can't get in, so their victims can flee there. With a white skull the town's buildings stay shut too: shops, inns, halls and houses (towers, crypts and other places in the wilds stay open; a red skull shuts nothing). Monsters never come into the town's buildings. Dying clears a white skull.

### Look and feel

- **Light:** dawn and dusk colour the land, nights are deep blue, and torches, lamp posts, campfires and windows throw warm pools of light; crystals, portals and lava glow. Clouds drift over the land by day.
- **Weather by region**, the same for everyone online: snow and blizzards in the north, rain and thunder in the fen and the jungle, sandstorms in the desert, ash and embers by the volcano.
- **Seasons**, by the real date: blossom in spring, fireflies in summer, falling leaves in autumn, snow in winter.
- **Snow on the roofs:** while it snows, snow settles on the roofs in patches that grow until they're white, and melts slowly after. In the frozen north the roofs are always white.
- **Life:** butterflies by the flowers, birds that take off as you come close, fireflies at night, jumping fish, gulls over the sea; trees and grass sway in the wind, and turn see-through when you stand behind them.
- **Fights:** hits flash and knock back, big hits shake the screen, spells leave sparks, the dead burst and fade, damage numbers pop, and experience floats up in gold. Whoever gets hit bleeds onto the ground (red, green for slimy things, none for bones and ghosts); a blocked hit just puffs.
- **Fire** flickers and dances, and so does its light. Right-click a torch, campfire or street lamp to put it out (or light it again); one that was put out lights itself again after ten minutes.
- **Torchlight** (the Torchlight spell) lights up the night for everyone around you, not just you.
- **Footprints** in snow and sand, dust on the roads, splashes in the fen; deep water is darker, and the sun glints on it.
- **Arriving** somewhere, its name appears across the screen: towns, landmarks, islands.
- **Sound:** music for each kind of place (towns, wilds, snow, desert, fen, jungle, volcano, caves, the sea, the night) and the sounds around you: wind, waves, rain, crickets, a busy square, a crackling fire, thunder. Switch them under the panel.
- **The interface:** carved stone and wood, gold lettering, and gear and ore glow in the colour of their grade. What you look at shows in green over the game.

### Controls

| Input | Action |
|---|---|
| WASD / arrows, Q E Z C | Walk, walk diagonally |
| Click | Walk there, attack a monster, talk to an NPC, open a corpse or chest |
| Right-click | **Use**: doors, levers, ladders, signs, depots. On a monster or player: a menu to follow, attack, talk or look (or attack straight away: set "Right-click: attack" under the panel, as with Tibia's classic controls) |
| Ctrl+click | The menu for whoever you click: follow, attack, talk, look |
| Shift+click | Look |
| Space / Esc | Next target / stop |
| 1–9, F1–F12 | Spells / your hotkeys |
| H / M / F | Health potion / mana potion / eat |
| Enter | Chat. Say "hi" to an NPC, then click the highlighted keywords |
| G | World map: click to walk, 🐴 Ride to order a cab |
| Right-click the minimap or world map | **Mark** a spot, as in Tibia: pick one of 20 icons and write a description. Hover a mark to read it; right-click it to edit or delete it. Marks are saved with your character. |
| Drag | Move items between bags, equipment, corpses and the map |

On a touch screen:
- **Walking:** use the joystick at the bottom left, or swipe on the map. A short swipe walks one tile, diagonals too; keep your finger down to keep walking.
- **The map:** a tap walks, attacks, talks or opens a corpse. A long press uses something.
- **Bottom right:** the big ⚔ attacks the closest monster (again: the next one), and 🎒 left of it opens your backpack over the map. Next to them are 3 favourites: tap one to cast it, hold one for 5 seconds (it fills up) to choose which spell or potion goes there.
- **The top strip:** health and mana, countdowns for haste, skull and the like, plus ✖ stop, ✋ use and 👁 look (then tap the thing), potions, 💬 chat, 🗺 map, 🐴 ride, ☰ character panel and fullscreen.
- **Top right:** the fight mode (attack, balanced or defend: tap to switch) and chase or stand.
- **Map marks:** hold a spot on the world map to mark it.
- **Maps:** drag the world map with one finger, pinch it (or the minimap) with two to zoom.
- **Someone on the map:** hold them for the menu: follow, attack, talk, look.
- **Chat:** put away until you open it with 💬. It also opens by itself when an NPC talks to you, so you can tap the keywords. Other messages pop up at the top for a few seconds ("Your bag is full."). Loot opens in a window over the map.

In combat:
- **Your target** gets a red frame.
- **A monster that hits you** flashes orange, in the game view and in the battle list.
- **Hovering a battle list row** frames that creature white.

What people say floats above their heads.

## World model

- The map is a grid of `x, y, z` tiles, each 32×32 pixels. Floor numbers go up with altitude, and `surfaceZ` (8) is ground level.
- A tile has one **ground** plus a stack of things (walls, trees, stairs, quest chests…), defined in `THINGS` in `js/defs.js`.
- Floors are drawn bottom-up, and each floor above is shifted one tile up-left. Walls are blocks one floor tall in the same projection, so roofs rest on the wall tops. When something is above you, that floor and everything higher is hidden; that's how roofs disappear when you walk into a house.
- **Mountains** are `cliff` blocks with ground on the floor above. A `ramp` in place of a cliff is the path up, and the invisible `ramp_top` ground above it is the way back down.
- Floor changes: stairs, ladders and ramps go up; holes, stairs down and ramp tops go down.

## Editors

- **Map editor** (`editor.html`):
  - **Getting around**: "Go to..." jumps to any town or dungeon of the built-in world; PgUp/PgDn change floor, the wheel zooms, middle-drag or WASD pans.
  - **Tools**: brush, rect, outline, eraser, picker, select (copy, cut, paste, delete) and houses. Scatter brushes paint forests, flowers, rocks and swamp.
  - **Placing things**: spawns, NPCs, quest chests and the start flags. Things with settings (sign texts, teleport targets, lever targets, door levels) ask for them when placed.
  - **Saving**: undo/redo with Ctrl+Z / Ctrl+Y. Changes autosave to the browser, and the game plays that map. **Use built-in map** in the game, or **Demo map** in the editor, goes back to the built-in world.
- **Data editor** (`data.html`): edit items, monsters, NPCs, quests, spells, vocations and raids as JSON, with reference checks. Saved changes apply to the game in this browser.
- **Custom sprites**: see `sprites/custom.js`.

## Files

| File | Purpose |
|---|---|
| `js/defs.js` | Map things (grounds, walls, furniture, mechanisms, quest chests) |
| `js/items.js` | Items: weapons, armor, potions, runes, tools, loot |
| `js/creatures.js` | Monsters, conditions, fields, vocations, skills, spells |
| `js/npcs.js` | NPC dialogs, shops and services, quests, raids |
| `js/sprites.js` | Procedurally drawn sprites |
| `js/map.js` | Map data, save format, A* pathfinding |
| `js/default-map.js` | The built-in world: Oakvale Isle (256×256 tiles, 16 floors). Being rebuilt; see `docs/world-plan.md` |
| `js/render.js` | Floor-aware renderer (shared by game and editor) |
| `js/game-core.js` | State, movement, inventory, quests, houses, cabs, saving |
| `js/game-combat.js` | Combat, spells, runes, monster AI, loot, effects, raids |
| `js/game-npc.js` | Dialog, NPC services and trading |
| `js/game-social.js` | Parties (shared experience) and guilds |
| `js/game-forge.js` | The blacksmith's forge: grades, ore, fusing, mining |
| `js/game-guide.js` | The guide for new characters, and the one-way starter island |
| `js/game-tales.js` | The starter island's tale. It is sealed: what it asks for and what it gives are encrypted, and only doing the right thing in the right place opens a step. |
| `js/game-update.js` | Player actions (`Actions`) and the world update |
| `js/game-ui.js` | Sidebar, windows, log, minimap, world map |
| `js/game.js` | Input, drawing, main loop |
| `js/touch.js` | Touch controls |
| `js/net.js` | Online play: shows the server's world and sends actions to it |
| `server/` | The multiplayer server (`server.js`), its WebSocket code (`ws.js`) and the restarting dev server (`dev.js`) |
| `js/editor.js`, `js/data-editor.js` | Map editor, data editor |
| `tests/` | Unit, simulation, browser and online tests |

The files `game-core`, `game-combat`, `game-npc`, `game-social`, `game-forge`, `game-guide`, `game-tales` and `game-update` don't touch the page. The browser, the tests and the server all run the same code.

## Tests

```sh
npm test                    # unit tests + 4 × 30 minutes of simulated random play (about a minute)
npm run test:soak           # 8 × 60 minutes of simulated play
npm run test:browser        # random play in headless Chromium (needs: npm install && npx playwright install chromium)
node tests/online.test.js   # starts the server, connects players over WebSocket, restarts it
node tests/screenshot.js shot.png 112 57 4 --view   # a picture of the game there (also --hour 22, --mobile)
```

- **Unit tests** check the data and the core rules. Every id in the map and every cross-reference between the data files must exist.
- **The simulated soak test** runs the real game logic with a random player and checks for exceptions, slow updates and broken state after every update. A failure prints the seed and the last actions so it can be replayed.
- **The browser soak test** clicks, types and trades randomly in the real page. It fails on any JavaScript error, a stalled game loop or a frame over 250 ms.
- **The online test** checks that two players see each other, chat and get their own NPC answers. It also checks that reloads keep you logged in and that a restarted server keeps characters, logins and the world.
