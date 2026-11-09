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

> **The world is being rebuilt.** The built-in world is now **Oakvale Isle**, a new starter island, built in stages. So far there's the land: Oakvale's town site with Willow River beside it, Mirror Lake, the North Peaks, Eagle Peak, Bone Rocks and the Spider Hills (rocky mountains in tiers), the Old Tower hill and Hermit Rock, Wolf Woods, Deer Woods and smaller woods, Frog Marsh, Stony Field, Goblin Hill, Sunny Fields and Lighthouse Point. Oakvale itself is built: a walled town in a ring of water, with Willow River running through the middle. The Temple of the Dawn, where you wake up, stands on a rocky mount above the town (you walk in through a great open archway with a golden sun over it; its white marble roof has gilded ridges and a lantern of coloured glass, crowned with a golden sun, that glows at night), with a terrace and broad stone steps down to the square; the depot is beside it in the north-east; over the bridge, the academy (the oracle is upstairs) and the magic shop; along the main street to the south, the smithy, the armourer, the general store, the bakery, the Sleepy Boar inn, the training yard and the graveyard. Shops hang out picture signs, signs explain what each place is for, and there's plenty to find: gravestones to read, sewer grates, and a chest someone forgot. Anyone who has something for you shows it above their head: a yellow **!** for a new quest (grey until you're strong enough), a yellow **?** where you can hand something in. When you greet them, they say which word to ask about (in gold), and the Quests tab tells you where to go next and what to say there. The townsfolk are there too, with shops, and the first story, "The Silent Bell": Sister Ama in the temple sends you to Master Corwin at the academy, to the rats of Sunny Fields, to the depot and to Pip's Provisions; at the end she gives you a **backpack** (20 places instead of the bag's 8: open it in your bag and tap "Carry my things in this backpack", or drag it onto the bag slot). While you're on a task, the guide shows it (what to kill, how many so far, and whom to tell), even folded away, and its arrow points to where those monsters live. Monsters notice you once they could be on your screen (or a few steps beyond its edge), and come for you. Each pack keeps to its own territory: it follows you out of it for a while, but lead it too far and it gives up and ambles back home (it still turns on you if you hit it, or come close inside its territory). One that strayed far comes back to its spawn when nobody sees it. Monsters never come into town. While you fight, small buttons by the left edge set how you fight (two swords: attack, sword and shield: balanced, shield: defend) and whether you follow your target (footsteps). Outside the walls the hunting gets harder the further you go from town, with monsters in packs of two or three, a little apart, so a careful hunter can take on one pack at a time: rats in Sunny Fields (level 1-2), wolves in Owl Grove and Fox Copse, crabs on the beaches and the shore of Mirror Lake, slimes in Frog Marsh, wolves in Wolf Woods and Deer Woods, spiders in Thorn Thicket and round the Spider Hills, goblins on Stony Field and Goblin Hill, skeletons on top of the Old Tower hill, and bears deep in Deer Woods and on Hermit Rock (level 8 and up). Under the town are the **sewers**: tap (or use) one of the four grates in the streets to climb down - walking over one does nothing, and up the ladder under it to come back. Brick tunnels with a murky channel down the middle run under the main streets, with rats everywhere, giant rats nesting where the walls have fallen in under the graveyard, an old storeroom, and a dead end under the temple mount. Bring light: it's dark down there (at level 2, say "lumen"). The story climbs in danger as you grow, and the gear comes on the way: **The gate watch** (level 2-5): a guard at each town gate has a task beyond it and a piece of gear for it, and sends you on to the next - Sergeant Bram at the west gate (8 wolves and their alpha **Greyfang**: a leather jerkin), Guard Tilda at the south gate (6 crabs and **Old Snapper**: leather legs), Guard Hilde at the east gate (8 spiders and the **Thornmother**: a chain helmet) and Captain Osric at the north gate (8 goblins and **Chief Gnash**: a studded shield). Each boss is tougher than its pack, calls it to help, and comes back five minutes after it falls. **The Silent Bell II** (level 5, from Master Corwin): down into the founders' crypt under **Bone Rocks** (steps at the foot of the crag, at the end of the bone trail). Clear the hall of coffins of six skeletons; only then do the three stone chests open (a longsword, a war axe or a mace, the best weapons on the isle - take one; Smith Dunstan's best is a spiked club) and can you pick up the torn note by the iron gate to the tomb. **The Silent Bell III** (level 6, from Sister Ama): the note says the rope went down the bell shaft. Through a trapdoor in the rats' nest under the graveyard to the **old drains** (clear eight giant rats), and on down to the **deep cistern**, where giant rats lurk in the dark (each only notices you when you come near, so you can fight your way through a few at a time) and a great cistern slime keeps the narrow way to the bottom of the shaft: the rope lies there, with boots in a rotting pack. **The Silent Bell IV** (level 8): the iron gate in the crypt opens, and below, in the founder's tomb, waits the hooded **Gravewaker**, who silenced the bell to wake the dead. Bring his bell's clapper back to Sister Ama and the bell rings out over the whole isle (after that anyone may climb the bell tower and ring it); she gives you chain armour. Chapters II-IV each have tasks along the way (kill so many of what lives there) that are done the moment they're done, and the chests and notes open only after them: you can't just run past. Before each dangerous place the townsfolk tell you to buy armour from Brenna and potions from Pip, and Sister Ama heals you for free. **Free gear in the sewers:** a leather cap in a chest in the old storeroom, and a wooden shield the rats dragged into their nest under the graveyard. The other caves come next. Until then, the places described below aren't in the built-in world.

- **Brightwater Isle** (starter island). You start in the temple next to Elder Maren. The island has:
  - a cellar full of rats
  - a forest with wolves, spiders and a hidden cache
  - a goblin camp
  - a swamp boss
  - a crypt with a pick-one weapon armory
- **The guide**: a new character gets one thing to do at a time, in a box at the top left, with a yellow arrow pointing the way, from the first word with Sister Ama to the oracle:
  - talk to Sister Ama and take The Silent Bell; Master Corwin, five rats, a corpse to open, something to eat, the depot, Pip
  - the gate watch, one guard after the other; then the crypt, the rope under the town and the Gravewaker
  - the arrow points to whoever has a task or news for you, to the monsters a task still wants, or to the way down
  - the box can be folded away (▾, or click its title) and out again, but not put away: it goes once you've followed it to the end ("Got it")
- **There is no way back.** Once you choose a vocation, the oracle sends you to the mainland and you never return to Oakvale Isle: no balloon flies back. Without a vocation, nobody takes you off the island either.
- **Legends**: the islanders tell of a captain whose sword was never found. Whether there is anything to it, nobody knows. Ask around, look closely at things, and remember that once you leave the island, you leave it for good.
- **The world** is generated the same for everyone: lands with ragged coasts, bays and capes, joined by winding necks of land, wooden bridges over the straits, and old portals (obelisks in stone rings) between far-apart regions. Rivers with bridges, lakes (frozen in the north) and mountains with paths up fill the lands, and so do around 30 kinds of places: castles and forts, mines, windmill farms, orchards, lumber camps, quarries, dragon nests, witch huts, shrines, battlefields, craters, fairy rings, ancient groves, caravans, igloos, totem camps, tombs, ghost villages, arenas and more.
- **Islands:** every island out at sea has its own name and story (they're on the map): a dragon's perch, a pirate keep, a wizard's folly, a castaway, treasure buried where three stones point, the Isle of Echoes with a portal home, and many more. Greenhollow's windmills feed half the world, the Shattered Isles are what's left of a drowned kingdom, and the Seawall still keeps watch. Fly there by balloon.
- **Walking** works as in Tibia: your speed is 240 at level 1 and grows by 2 each level; a step takes longer on grass, sand and rough ground than on roads and floors, and slowest through snow and swamp; and a diagonal step takes twice as long. Monsters have their own speed: a rat is slower than a new character, a wolf quicker. Clicking somewhere takes the quickest way, only north, east, south and west if it can: a diagonal step only where nothing else gets past. Pick a target while you walk, with chase on, and you stop walking and go for it. Rides keep their own pace.
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
- **Hitting, as in Tibia:** your weapon hits for at most 0.085 × attack × skill (× 1 on full attack, 0.75 balanced, 0.5 defensive) plus a fifth of your level, and at least a fifth of your level; most hits land round the middle. Your skill counts most, so it pays to train it. Monsters block part of every hit with their defense and armor: a weak hit is often blocked completely (a blue puff for defense, a grey spark for armor). On Oakvale Isle it takes about two and a half hours to reach level 10.
- **Hunting together:** everyone who hurts a monster gets a share of its experience (by the damage they did) and the kill for their quests.
- **Parties**, as in Tibia: right-click (or hold) a player to invite them; they join the same way. The leader can share the experience: then what the members earn goes into one pot, with a bonus for the different vocations in the party (20% for one, 30% for two, 60% for three, 100% for four), and everyone gets an even share. It works while the lowest level is at least two thirds of the highest, everyone is within 30 tiles of the leader (a floor up or down at most) and everyone has fought in the last two minutes; the party box says why when it doesn't. Shared experience floats up in blue over every member. Party members get a shield by their name (gold: the leader, with a tick while sharing works), can't hurt each other, and talk in the Party tab of the chat (or `/p` before a line).
- **Guilds:** the Guild button opens your guild window. Found a guild, invite players (or right-click them), join from your invitations; ranks (leader, vice-leaders, members; the leader can rename them), nicks, a message of the day, and the Guild tab of the chat (or `/g`). Fellow members get a green emblem by their name, and looking at a player shows their guild. The server keeps the guilds.
- **The forge**, after War and Order's: gear comes in five grades, common, fine (green), rare (blue), epic (purple) and legendary (orange), each with 12% better attack, armor or defense. Ore comes in the same grades: monsters drop it (the stronger, the better), and veins in cave walls glitter with it (mine them with a pick; the more dangerous the cave, the better the ore). At a smith (Bram, Armorer Dask in Valoria, Torvald, Gorm) say "forge": pick a piece of gear and put four ore in. Each ore adds to the chance of the next grade: better ore than that grade 25%, ore of that grade 20%, a grade below 5%. So a blue sword with two purple and two blue ore has a 50% chance to turn purple. When it fails, the ore and the fee are gone but the gear stays. Four ore of a grade fuse into one of the next. Monsters drop better graded gear now and then; traders don't buy graded gear.
- **Home town:** ask the priest of any town's temple (Valoria, Frosthold, Sylvaran, Kesh, Mirehaven, Port Verdant) about becoming a "citizen": from then on you wake up in that temple when you die. The Skills tab shows your home town.
- **Dying** costs a tenth of all your experience (a blessing spares 30% of that), as in Tibia, so it can cost you levels, and the health and mana they gave you.
- **Dying** costs a tenth of your experience, which can cost levels. Before you have a vocation it costs only half that, and your things stay with you; after that you drop your backpack (and sometimes gear) in your corpse, unless a blessing or an amulet keeps it. A health potion costs 25 gold.
- **Everything stands in the same slant** as the walls: furniture, statues, fences, and trees and plants too (trunks and stalks lean up-left as they rise, crowns hang over the tile up-left of their trunk).
- **Depth:** standing higher up (a mountain top, an upper storey, the bell tower), what lies below you is a little darker, a floor at a time (a quarter darker at most), and the edge you stand on casts a soft shadow down onto it.
- **Capacity:** you can carry 400 oz plus 10 per level (more per level as a knight or paladin), gear you wear included. What you can't carry lands at your feet.
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
- **Walking:** use the joystick at the bottom left, or swipe on the map. A short swipe walks one tile, diagonals too; keep your finger down to keep walking. Messages show near the top of the map, under the status bar and the guide, so they never cover you. Or tap a tile to walk there: a gold mark shows where you're going. Don't want the joystick? Turn it off under Menu, Game. There too: Close-up view (on by default) brings the camera closer; turn it off to see more of the world.
- **The map:** a tap walks, attacks, talks or opens a corpse. A long press uses something.
- **The layout on a phone:** a status bar on top (your level, health, mana, experience and gold), five buttons along the bottom (Character, Quests, Map, Chat and Menu; on a phone held sideways, a column on the right), the joystick bottom left and the big action button bottom right with four round quick buttons round it.
- **The big button** attacks the nearest monster, talks to someone next to you or opens a corpse. Its round quick buttons: your health and mana potions, and two of your own (spells or food): tap to use, hold one to choose what goes there.
- **Character** shows your equipment, bag and skills; **Quests** what you are doing and where to go; **Menu** how you fight (attack, balanced, defend), chase, secure mode, sound, outfit, party and guild, rides and fullscreen.
- **Talking:** what someone says comes up as a card with their face, the blue words as buttons, and Good bye to end it.
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


- The temple has a rounded embroidered rug above its marble floor, with one ornament across three by three tiles.


- The temple terrace uses detailed weathered limestone paving.
