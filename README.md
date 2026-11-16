# Lickii Adventures

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
- **Test character (playing alone)**: when you make a new character (Menu, **New character**), pick **Test: level 100 knight** (or paladin, sorcerer, druid) under your name. You start promoted at level 100 with high skills, the best gear your vocation can wear (legendary grade), potions, 100000 gold and a million in the bank. For trying things out only.

**On a phone:** open the same address. Touch screens get on-screen controls automatically.
- Upright, the map fills the screen and the controls sit over its bottom corners. Sideways, the controls are on both sides of the map.
- ⛶ goes fullscreen on Android.
- On an iPhone, use Share › Add to Home Screen and open the game from there; that is the only way iPhones run it fullscreen.
- Add `?mobile` to the address to try the touch controls on a PC.

**Gold for everyone online** (from the computer the server runs on): `curl -X POST -H "X-Tilequest: editor" "http://localhost:8080/admin/gold?atLeast=10000"` tops up every online player's gold to at least that much (handy for travelling), and tells them. On Windows, type `curl.exe` instead of `curl`.

## The game

### Oakvale Isle

The built-in world is **Oakvale Isle**, a hand-built starter island, and for now the whole world: the beginners' island comes first, the mainland after it.

- **The land:** Oakvale's town in the middle, with Willow River through it; Mirror Lake, the North Peaks and Eagle Peak, Bone Rocks and the Spider Hills (rocky mountains in tiers), the Old Tower hill and Hermit Rock, Wolf Woods, Deer Woods and smaller woods, Frog Marsh, Stony Field, Goblin Hill, Sunny Fields and Lighthouse Point.
- **The town:** a walled town in a ring of water.
  - The wall is thick enough to walk on: go up through a corner tower, or the arched doorway beside the north gate, and walk all the way round, over the gates and the river. Climb a tower to its lookout, under Oakvale's blue flag with the golden sun.
  - Old bronze cannons stand on the battlements (look at one), and banners hang down the outside of the wall. Each gate has a gatehouse with a slate roof, and each corner tower a door out, over a footbridge, towards the hunting grounds.
  - The **Temple of the Dawn**, where you wake up, stands on a rocky mount above the square, with a terrace, broad steps down and the statue of the founder beside it. The depot is in the north-east; over the bridge, the academy (the oracle is upstairs) and the magic shop; along the main street, the smithy, the armourer, the general store, the bakery, the Sleepy Boar inn, the training yard and the graveyard.
  - Shops hang out picture signs, signs explain each place, and there's plenty to find: gravestones to read, bookshelves, sewer grates and a chest someone forgot.
- **Who has something for you** shows it above their head: a yellow **!** for a new quest (grey until you're strong enough), a yellow **?** where you can hand something in. When you greet them, they say which word to ask about (in gold), and the Quests tab tells you where to go next.
- **Monsters** notice you once they could be on your screen (or a few steps beyond its edge). Each pack keeps to its own territory: it follows you a while, then ambles back home. Monsters never come into town.
- **Hunting grounds**, harder the further from town, in packs of two or three: rats in Sunny Fields (level 1-2), wolves in Owl Grove and Fox Copse, crabs on the beaches and round Mirror Lake, slimes in Frog Marsh, wolves in Wolf Woods and Deer Woods, spiders in Thorn Thicket and round the Spider Hills, goblins on Stony Field and Goblin Hill, skeletons on the Old Tower hill, and bears in Deer Woods and on Hermit Rock (level 8 and up).
- **Where the packs are:** rats in twos spread over Sunny Fields; spiders round the Spider Hills, well off the trail south (nothing tougher than a wolf lives near the main roads); crabs in twos along the south beaches, with Old Snapper on his own a little west (and two more round Wendel's rock off that beach); a pair of goblin scouts on Stony Field and small bands on Goblin Hill (Chief Gnash in his camp at the top of the goblin trail, where they sleep at night); skeletons in twos on the Old Tower hill; bears deep in Deer Woods and on Hermit Rock (they carry a few coins).
- **The Ashen Choir** comes ashore near Lighthouse Point only at night once the bell has been rung home, or while someone nearby is on The Choir's Shadow; it doesn't follow you far from its camp.
- **Sergeant Bram's** reward for the wolves now includes three health potions, and he tells you about watch marks (two buy five potions at Captain Osric's).
- **How you fight:** small buttons by the left edge set it (two swords: attack; sword and shield: balanced; shield: defend) and whether you follow your target (footsteps).
- **The sewers:** tap (or use) one of the four grates in the streets to climb down (walking over one does nothing), and the ladder under it to come back. Brick tunnels with rats, giant rats where the walls fell in under the graveyard, an old storeroom, and a dead end under the temple mount. Bring light (at level 2, say "lumen").
  - **Finds in the sewers:** the rats' hoard in the old storeroom (a wooden shield, for The Rats' Hoard: it opens once you've killed five rats down there), and a chest in the rats' nest under the graveyard (20 gold and three potions).
- **The watch's hunts** (after a gate's own task): each gate guard has a hunt again and again (10 wolves, 8 crabs, 10 spiders or 10 goblins), a new one 20 minutes after the last, paid in **watch marks**. Spend them at Captain Osric's at the north gate: 5 health or 5 mana potions for 2, a ring of life for 5, an amulet of keeping for 8.
- **The spiders' den** (optional, level 12 and up, better with friends): steps in the Spider Hills' south face lead down to the **Brood Queen** among her eggs: poison, more spiders at her call, and now and then the Brood Queen's fang, the best blade on the island. She comes back a quarter of an hour after she falls; the first to slay her is told to everyone. Guard Hilde at the east gate knows of it.
- **Houses:** Landlady Hettie, at a table in the Sleepy Boar, lets Oakvale's four cottages (Riverside Cottage, Mill Lane House, Ivy Cottage and Bell Cottage): ask her about the houses.
- **Raids:** now and then something comes for the town, and everyone online hears it: a goblin warband at the north gate, a wolf pack at the west gate, or the dead stirring at Bone Rocks.

### The story of Oakvale Isle: The Silent Bell

The bell of Oakvale has stopped ringing. The story climbs in danger as you grow, and the gear comes on the way. Tasks out in the wilds (kill so many) are done the moment they're done, and the chests and notes along the way open only after them. Before each dangerous place the townsfolk tell you to buy armour from Brenna and potions from Pip; Sister Ama heals you for free.

- **I: A Stranger in Oakvale** (level 1, Sister Ama in the temple): Master Corwin at the academy (and his five rats in Sunny Fields), Postmaster Hobb and your locker, a letter to Pip. Ama gives you a **backpack** (20 places instead of the bag's 8: open it in your bag and tap "Carry my things in this backpack") and a rope.
- **The Rats' Hoard** (level 2, Master Corwin): down into the sewers, five rats, and a wooden shield from the storeroom.
- **Clang** (level 2, Sister Ama): the temple cat chased the rats into the bell cellar under the temple. Free him, and he's your companion (see the guide below).
- **The gate watch** (level 2-5): a guard at each gate has a task beyond it and a piece of gear, and sends you on to the next. Each also finds a sign of whoever silenced the bell.
  - **Sergeant Bram, west gate** (a leather jerkin): **Greyfang** leads the wolves, and nobody knows where he lairs. Look for his huge paw prints in Wolf Woods, follow them (look at each one), and bring back his pelt. His pack gets in the way.
  - **Guard Tilda, south gate** (leather legs): **Wendel the fisher** is stranded on a rock off Lighthouse Point, with crabs all round him. Clear them, talk to him, and he paddles home to Fisher's Rest by himself.
  - **Guard Hilde, east gate** (a chain helmet): burn four **spider nests** round the Spider Hills. Use the torch she gives you on a nest, or cast **Torchlight** ("lumen") right next to one. Burnt nests are spun again after a while.
  - **Captain Osric, north gate** (a studded shield): steal **Chief Gnash's war plans** from the war chest in his camp on Goblin Hill. The goblins there **sleep at night**: sneak past, but step right next to one or hit one and the camp wakes up.
  - **Every task from a gate guard** (their own, and the hunts after) comes with **two health potions** as you set out. If your bag is full, they lie at your feet.
- **II: Under Bone Rocks** (level 5, Master Corwin): the founders' crypt under **Bone Rocks** (steps at the foot of the crag, at the end of the bone trail). Clear the hall of coffins of six skeletons; then take one of the founders' weapons (a longsword, a war axe or a mace, the best on the isle) and the torn note by the iron gate.
- **III: Teeth in the Dark** (level 6, Sister Ama): the note says the bell's rope went down the bell shaft. Through the rats' nest to the **old drains** (eight giant rats), and down to the **deep cistern**, where giant rats lurk in the dark and a great cistern slime keeps the way to the bottom of the shaft: the rope lies there.
- **IV: The Gravewaker** (level 8, Sister Ama; Armourer Brenna lends her the key to the iron gate): in the founder's tomb below the crypt waits the hooded **Gravewaker**. When he falls his hood slips back: **Sir Galen**, whose gravestone says the rats killed him, now a singer of the **Ashen Choir**. Bring the bell's clapper home to Sister Ama (warm, with ash in its seams), and the bell rings out over the whole isle. She gives you chain armour.
- **V: The Choir's Shadow** (level 8, Master Corwin, after IV): his old books speak of the Ashen Choir, who sing to something under a burning mountain across the sea. At **Lighthouse Point**, Keeper Tamsin keeps a fire where the lighthouse stood; at the tip of the point the Choir comes ashore: four grey-robed singers who throw fire, and their **Choir Cantor**. In his satchel, Galen's ring of swiftness and the last page of the founder's diary. Corwin reads it to you, and gives you the ring.
- **VI: Farewell** (level 10, Sister Ama): farewell to your newcomer days. Climb the bell tower and ring the bell yourself (the town looks up and cheers), say farewell to Master Corwin, Pip and Sergeant Bram, and come back to Sister Ama for her blessing and supplies.
- **The oracle** (level 10, upstairs in the academy): choose your vocation, knight, paladin, sorcerer or druid, and the bell rings for you over the whole isle. **No ship has come yet:** the mainland isn't built, so you stay on Oakvale Isle as one of its own, its defender, and you still wake in Oakvale's temple.
- **The Oakvale Chronicle**: six pages of the founder's diary lie scattered over the island: on the beach at Fisher's Rest, on the Old Tower hill among the skeletons, in the crypt's hall of coffins, in Chief Gnash's camp; **Hermit Brannoc** on Hermit Rock has one (he only talks at night, among the bears), and the Choir Cantor carries the last. Tap a page to read it; the Quests tab keeps the ones you've found. Bring all six to Master Corwin: the founder gets her name back (on her statue too), and you 500 experience and 120 gold.
- **The bell is everyone's:** once anyone brings its clapper home it rings for the whole world, and anyone may climb the tower and ring it.
  - The first to bring it home is the **Bellringer**, told to everyone online; the plaque by the bell names them and those who rang it home after. Characters who rang it before the plaque existed are added when they log in.
  - Every dawn, at six on the world's clock, it rings by itself.
  - For those who come later, the story starts over: its clapper was stolen again, and Sister Ama tells you who rang it home before.

### How it plays

- **The guide**: a new character gets one thing to do at a time, in a box at the top left, with a yellow arrow pointing the way, from the first word with Sister Ama to the oracle:
  - it shows, not only tells: the rest of the screen dims around the part a step is about, a hand taps at it, the guide's box has a little picture of what it means (the four colours of the big button, the gold words, the bars), a thin gold line shows how far you've come, a step done glows "well done!", and a gold ring pulses on the ground round whoever the arrow points at
  - **people understand you** even without the gold words: say hi again, thanks, or "what do I do?" / "where?" / "help" and they tell you your next step. And the townsfolk know Oakvale's past: ask Sister Ama about the founders or the long winter, Master Corwin about the Old Tower, Pip about the lighthouse, Postmaster Hobb about the founders' ship, Brenna about the crypt gate, Willa about the hermit, Moonpetal about the bell
  - **Clang, a companion**: after the shield, Sister Ama asks you to find Clang, the temple's grey cat, who chased the rats into the bell cellar under the temple (down the grate on the square and north). Kill the rats there, move the fallen crate, and bring him home: from then on he follows you everywhere, scratches whatever you fight (the kill and its loot are yours), and grows stronger, up to level 10, but never past your own level. He learns half the experience of every monster he helped you kill; a training dummy teaches him only up to level 4. When you get him you choose his name (it needs a letter, and can't be an NPC's). He has his own health bar: monsters next to him hit him now and then instead of you (more often while he fights), badly hurt he keeps behind you (you're warned when he drops under 30%), and whenever nothing is next to him he heals by himself. He never stands on your tile or a monster's: he steps aside. He never fights players, and never from or into a protection zone.
    - **How he fights**: Follow (at your heel, out of fights), Assist (whatever you fight, the default) or Stay close (only what comes right up to you).
    - **His card** (Companion): under your equipment on a computer, on the Gear page of the drawer on a phone, or hold him on the map: his portrait, health, experience to the next level, damage, how he's doing, how he fights, and Feed (it says what he'll eat), Potion, Call, Rename and Send home. Food and potions are kept while he isn't hurt. On a computer a right-click on him opens a short menu too; a click on him just walks there. On a phone a small bar at the end of your health bar shows his health.
    - Knocked out, he runs home to the temple and comes back after three minutes, or at once if you ask Sister Ama (sending him home then does nothing). Call him back from his card, under Settings, or from Sister Ama. While you're dead he waits at the temple. Others see him too, with his name, level and health
  - **dying before a vocation** costs a little experience but never a level, and Sister Ama tells you what to do differently next time (wolves hunt in threes: take them one at a time...)
  - **starter gear**: when you first meet Master Corwin he gives you a leather cap, and the guide shows you how to put it on. A shield you earn: at level 2 the guide has you cast your first spell, **Torchlight**, and Master Corwin sends you down into the sewers (**The Rats' Hoard**): kill five rats in the tunnels, then the old chest in the storeroom at the west end gives you a wooden shield to wear. Then on to the gate watch
  - first the basics, each in a few words, with a gold ring round the part of the screen it's about: your health, mana and experience; walking and talking (the gold words); where to look when you're lost (the arrow and the Quests tab); training; the big button and its colours; what dying costs; the first rats (and keeping away from wolves); opening a corpse; the backpack; eating; the action buttons and potions, and then (on a phone) putting Eat on your last action button yourself, so you know what those buttons are for; the map. A step that only explains waits for **Next**; one that asks you to do something moves on by itself
  - talk to Sister Ama and take The Silent Bell; Master Corwin, five rats, a corpse to open, something to eat, the depot, Pip
  - the gate watch, one guard after the other; then the crypt, the rope under the town and the Gravewaker
  - the arrow points to whoever has a task or news for you, to the monsters a task still wants, or to the way down
  - the box can be folded away (▾, or click its title) and out again; it goes once you've followed it to the end ("Got it"), or when you **Skip** it (tap Skip, then again to be sure): Master Corwin's cap still comes to you
  - **Guide** in the menu (on a phone: Settings, The guide) starts it again from the first step, as long as you're on the starter island: what you've done already passes by itself
- **No ship yet.** At level 10 the oracle lets you choose a vocation. The mainland isn't built yet (the beginners' island comes first), so you stay on Oakvale Isle as its defender. PvP waits for the mainland: nobody can attack another player on Oakvale Isle.
- **Walking** works as in Tibia: your speed is 278 at level 1 and grows by 2 each level; a step takes longer on grass, sand and rough ground than on roads and floors, and slowest through snow and swamp; and a diagonal step takes twice as long. Monsters have their own speed: a rat is slower than a new character. Clicking somewhere takes the quickest way, only north, east, south and west if it can: a diagonal step only where nothing else gets past. Pick a target while you walk, with chase on, and you stop walking and go for it. Rides keep their own pace.
- **Towns** grow around a square with market stalls (Oakvale’s has a golden sun mosaic in its paving), the temple on its north side, and streets with pavements, lamps and trees. Along the streets stand shops, halls, an inn and houses, each with its own roof (clay, slate, shingle, thatch, copper or flat, shaped into hips and ridges). Townsfolk stroll the streets and chat: guards, criers, bards, children, cats, dogs and chickens. Talk to them: they know the news. Inns stand halfway along the long roads between towns.
- **Outfits**, as in Tibia (the Outfit button): 8 outfits (citizen, hunter, mage, knight, noble, barbarian, druid, pirate), each in a male and a female cut. Colour the head, primary, secondary and detail parts from 133 colours. Each outfit has two addons, a hat and a piece of gear, that unlock at levels 20 and 40.
- **Vocations**: at level 10, the oracle (upstairs in Oakvale's academy) lets you become a knight, paladin, sorcerer or druid. Once there is a mainland, she will send you on to it.
- **Quests** come from NPCs (kill, fetch, or several steps) or are one-time quest chests. Progress is in the Quests tab.
- **Skills, equipment, loot, conditions, runes, fields, houses, blessings, raids, a day/night cycle and PvP** (outside towns and the starter island).
- **Hitting, as in Tibia:** your weapon hits for at most 0.085 × attack × skill (× 1 on full attack, 0.75 balanced, 0.5 defensive) plus a fifth of your level, and at least a fifth of your level; most hits land round the middle. Your skill counts most, so it pays to train it. Monsters block part of every hit with their defense and armor: a weak hit is often blocked completely (a blue puff for defense, a grey spark for armor). On Oakvale Isle it takes about two and a half hours to reach level 10.
- **Hunting together:** everyone who hurts a monster gets a share of its experience (by the damage they did) and the kill for their quests.
- **Parties**, as in Tibia: right-click (or hold) a player to invite them; they join the same way. The leader can share the experience: then what the members earn goes into one pot, with a bonus for the different vocations in the party (20% for one, 30% for two, 60% for three, 100% for four), and everyone gets an even share. It works while the lowest level is at least two thirds of the highest, everyone is within 30 tiles of the leader (a floor up or down at most) and everyone has fought in the last two minutes; the party box says why when it doesn't. Shared experience floats up in blue over every member. Party members get a shield by their name (gold: the leader, with a tick while sharing works), can't hurt each other, and talk in the Party tab of the chat (or `/p` before a line).
- **Guilds:** the Guild button opens your guild window. Found a guild, invite players (or right-click them), join from your invitations; ranks (leader, vice-leaders, members; the leader can rename them), nicks, a message of the day, and the Guild tab of the chat (or `/g`). Fellow members get a green emblem by their name, and looking at a player shows their guild. The server keeps the guilds.
- **What you wear:** the equipment window adds up your gear: **attack** (your weapon), **defense** (your shield, or without one your weapon: blocks part of each blow) and **armor** (everything you wear: takes something off every hit). In a shop, hold the mouse over a ware (on a phone, tap it) to see its numbers beside what you wear now: how much more or less each would be.
- **The forge**, after War and Order's: gear comes in five grades, common, fine (green), rare (blue), epic (purple) and legendary (orange), each with 12% better attack, armor or defense. Ore comes in the same grades: monsters drop it (the stronger, the better), and veins in cave walls glitter with it (mine them with a pick; the more dangerous the cave, the better the ore). At a smith (Bram, Armorer Dask in Valoria, Torvald, Gorm) say "forge": pick a piece of gear and put four ore in. Each ore adds to the chance of the next grade: better ore than that grade 25%, ore of that grade 20%, a grade below 5%. So a blue sword with two purple and two blue ore has a 50% chance to turn purple. When it fails, the ore and the fee are gone but the gear stays. Four ore of a grade fuse into one of the next. Monsters drop better graded gear now and then; traders don't buy graded gear.
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

### Not in the current world

The old world, kept for when the mainland is built: these places and stories are in the code and data, but not on Oakvale Isle.

- **Brightwater Isle** (the old starter island). You started in the temple next to Elder Maren. The island had:
  - a cellar full of rats
  - a forest with wolves, spiders and a hidden cache
  - a goblin camp
  - a swamp boss
  - a crypt with a pick-one weapon armory
- **Legends**: the islanders tell of a captain whose sword was never found. Whether there is anything to it, nobody knows. Ask around, look closely at things, and remember that once you leave the island, you leave it for good.
- **The world** is generated the same for everyone: lands with ragged coasts, bays and capes, joined by winding necks of land, wooden bridges over the straits, and old portals (obelisks in stone rings) between far-apart regions. Rivers with bridges, lakes (frozen in the north) and mountains with paths up fill the lands, and so do around 30 kinds of places: castles and forts, mines, windmill farms, orchards, lumber camps, quarries, dragon nests, witch huts, shrines, battlefields, craters, fairy rings, ancient groves, caravans, igloos, totem camps, tombs, ghost villages, arenas and more.
- **Islands:** every island out at sea has its own name and story (they're on the map): a dragon's perch, a pirate keep, a wizard's folly, a castaway, treasure buried where three stones point, the Isle of Echoes with a portal home, and many more. Greenhollow's windmills feed half the world, the Shattered Isles are what's left of a drowned kingdom, and the Seawall still keeps watch. Fly there by balloon.
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
- **Home town:** ask the priest of any town's temple (Valoria, Frosthold, Sylvaran, Kesh, Mirehaven, Port Verdant) about becoming a "citizen": from then on you wake up in that temple when you die. The Skills tab shows your home town.

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
- **The guide** folds away to a small tab: tap its header. Its step in full stays at the top of the Quests tab, with a button to show it over the map again.
- **Your things on a phone:** tap one to see what it is, and to use it or drop it (all, or one) at your feet: handy when you carry too much.
- **Quest words** an NPC gives you stand out in gold with a "!". Say a word meant for someone else and they tell you who to ask.
- **Choosing a chest** (the crypt's weapons): look at a chest first to see what's in it (attack, defense, weight); you may take from only one.
- **The guide's arrow** points to what a task still needs: once a pack is done, to its leader.
- **Walking:** use the joystick at the bottom left, or swipe on the map. A short swipe walks one tile, diagonals too; keep your finger down to keep walking. Messages show near the top of the map, under the status bar and the guide, so they never cover you. Or tap a tile to walk there: a gold mark shows where you're going. Don't want the joystick? Turn it off under Menu, Game.
- **The map:** a tap walks, attacks, talks or opens a corpse. A long press uses something.
- **Training:** in the training yard, south-west of town, click (or tap) a dummy and you keep hitting it, as long as you like, until you walk away. Every hit raises your weapon's skill (club, sword, axe, or distance with a bow), as hitting a monster does; a higher skill hits harder. Wands and rods train nothing there: magic grows by casting. The guide sends you there first.
- **The welcome:** naming your character, choosing its outfit and logging in happen on the loading screen's picture, with the logo; the game's buttons and bars come once you're in.
- **Always the newest version:** played from the web, the game looks now and then (on opening it, on coming back to it, and every ten minutes) whether a new version is live; if so it saves and loads it, behind the loading screen.
- **The loading screen:** the Lickii Adventures logo over a valley at dusk (a picture made for phones, tablets and wide screens), with a gold bar while the world gets ready.
- **Smooth from the start:** while you log in or make your character, the game gets the world's pictures ready; once you're in, a short loading screen makes the ground round you, so the first steps never stutter. Jumping somewhere far (a death, a boat, a teleport) shows it again for a moment.
- **Quality:** Menu, Game (on a phone: the drawer's Settings tab, Quality): high (everything), medium (no drifting clouds or weather, a little less sharp on a phone) or low (also no ripples on the water and the map as coarse as a phone draws it: the smoothest). Remembered per browser.
- **Frame rate:** Menu, Game, the fps button (on a phone: the drawer's Settings tab, 60 frames a second) switches between 60 frames a second (smoothest) and 30 (a cooler phone, a longer battery). Remembered per browser.
- **Speed meter:** Menu, Game, Speed meter (Speed under Sound on a computer) shows how smoothly the game runs: frames a second, the work in a frame, and the stalls of the last 10 seconds. Amber means it isn't smooth. It also says where the worst stall was and what the game was doing then (ground drawn live, chunks made, a floor change), and how big the screen is drawn: a screenshot of it tells us where to look. Tap the meter for a test (stand still, about 20 seconds): it leaves out one part at a time (the floors above you, the sky, the water's ripples, the weather, the names) and shows the frames a second each time.
- **Calm saves power:** standing still, with no target and no monster near, the game draws 30 frames a second instead of 60 (only water, leaves and torches move a little less smoothly); walking, a tap or a fight brings 60 back at once.
- **Slow phone?** If the game can't keep up, it draws the map with fewer pixels by itself, a step at a time: a little softer, much smoother. Your phone remembers it.
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


- Water has smoother blue ripples, more visible wave motion and a clear animated shoreline.


- Mobile HUD preview: swipe either group of three action slots to switch its page; hold a slot to edit or clear it. Tap the map to walk, or drag to show a temporary joystick. The map and menu are in the top bar.

Phone: up top, over the map, only what happens to you shows with its time (poisoned, burning, electrified, paralyzed, a skull, a fight with a player). What you gave yourself shows on its own action button instead: Haste, Magic Shield and Torchlight show their time left at the top of their button (with a thin gold line), food how long you stay fed.

Phone: nothing to tap up top. The status bar shows your health and mana, and under them EXP with its percent, a thin experience bar and your level. A map button sits in the top left corner of the view, the guide's card beside it; while you fight, what you're fighting shows at the top with its health; the middle button lights up warm, a spell cooling down shows its seconds and tenths (2.4s), and a message about mana shows a drop; quests and settings are tabs of the drawer, along its bottom.

Mobile viewport: as an app on the home screen the phone's status bar (the clock and battery) stays opaque: a see-through one let iOS soften what lies under it, the health and mana bars among it. The layout reserves the top and side safe areas once; the action dock includes the home-indicator inset. Rotation resizes the canvas through its existing sizing function. Actual iPhone standalone appearance still needs device verification.

The compact phone HUD shows level, current/max HP and mana, and progress to the next level. The map editor keeps an opaque iOS status bar; device verification is still required.

- Phone action bar: three spells on the left, the big button in the middle, three spells, potions or food on the right. A new character starts with every button empty but the health and mana potions (the guide shows you how to fill them); a new character with an old name starts fresh too. Each shows its picture: a spell its mana under it with a little drop (red when you have too little), a potion how many are left. A gold edge means you can use it now; dimmed means not enough mana or none left. While a spell or potion cools down a shade sweeps off it and the seconds count down. An empty button shows a + and "add": tap it to choose what goes there. Held sideways the buttons stay square, together in the middle. A potion with none left is greyed out, its count red. Low on health (under a third), your health potion glows red.
- The button in the middle, square like the others with a gold edge, shows only an icon for what it does, and what the moment asks: attack a monster in sight (press again for the next one; never in a protection zone), loot a nearby corpse when there's nothing to fight, talk to someone in reach, or use a door, chest or dummy next to you, also while the drawer, the chat or someone's talk is open. Its colour says which: red, amber, blue, green; dark when there's nothing to do.
- Over the action bar, one line shows the newest message as it comes, then dims after a few quiet seconds. Tap it for the whole chat: it opens above the action bar, as tall as its messages need (up to 40% of the screen), with a send button beside the line you type in (the keyboard's Enter sends too, and stays up for the next line). Close it with the tab on its top edge; the big button keeps doing its work meanwhile. Only a new level, a quest or a raid also pops up over the map.
- A corpse you open shows its things low on the screen, just over the action bar, in reach of your thumb (Take all, or tap a thing).
- Your equipment and backpack: tap the backpack at the end of the chat line. They open side by side over the bottom of the map, all your equipment in sight with what it adds up to (attack, defense and armor) on one line above it; the map slides up so you stay in view. Skills › at the end of that line opens them up to your skills. Swipe up on the drawer's tab to open them up to the status bar, with any other bag you opened and your skills across the bottom. Your gold shows under your backpack's places; gear of a better grade has its colour on its place (green fine, blue rare, purple epic, orange legendary). The tab rides up on the drawer's edge (pointing up while there's more, down when it's all open); swipe it down to go back a step, or tap the backpack again or the map to close it. The big button keeps attacking, looting and talking meanwhile. Tap a piece of gear to see its numbers: in your backpack also how much more (green) or less (red) it gives than what you wear there now (Wear or Drop); on you, Take off. In a shop, tap a ware's picture or name to see the same before you buy. Drag things between them as before; the action bar keeps working. Drag something out of the drawer onto the map and the drawer closes as you leave it, so you can drop it where the drawer was.
- Along the bottom of the drawer, four tabs: **Gear** (equipment, backpack, skills), **Map** (the minimap, as big as the drawer: tap a spot to walk there (half open the drawer stays, on the full map it folds away so you see where you walk), pinch or + and − to zoom, the arrows for the floor above or below; it opens half way, and Full map opens the drawer all the way on the whole world, again goes back), **Quests** and **Settings** (sound, quality, frame rate, outfit, party and guild, and the help). They sit just above the action bar, so one thumb reaches everything.
- Swipe sideways over either group for its next set (three each); short bars under each group show which set (gold). Hold a button to choose what goes there or to empty it: the choices rise from the action bar, in reach of your thumb, each with its picture, its mana and a line on what it does; the big button closes it. Spells without a picture yet show their initials.
