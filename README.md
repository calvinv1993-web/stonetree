# SORTIA: The Broken Seal

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
- **Create account** with a name and a password (6 characters at least, typed twice); a name that's taken is refused. Then choose a character, or make a new one (up to 10 an account; a character's name is taken for everyone). Only one character of an account can be in the world at a time, one character from a browser at a time, and at most 4 characters from one internet connection (the server's own computer isn't counted). Later, **Log in** with the same name and password, on any device, to get your characters back. A browser that has logged in once opens on your characters (**Log out** there to switch accounts); a reload while playing (an update, a lost connection) goes straight back in.
- If others can't connect, allow the port through the firewall: Windows asks the first time the server starts (allow it on private networks); on Linux, e.g. `sudo ufw allow 8080/tcp`.
- The server keeps characters in `server/players.json`. To play on a map made in the editor, open the editor from the server (`http://localhost:8090/editor.html` on the server's computer) and click **Publish to server**: it's saved as `server/map.json`, and `server/dev.js` restarts the server on it. **Server: built-in world** switches back. (Or export it and save it as `server/map.json` yourself.)
- **Keep playing while it's being changed**: run `server/dev.js` instead of `server/server.js`.
  - It restarts the game server whenever the game logic or the server code changes.
  - Before each restart the server saves every character (including skulls and rides in progress) and the world (monsters, corpses, things on the ground).
  - Pages reconnect within a second. They reload by themselves when the game files changed and log straight back in, so everyone gets the new version within a few seconds.
  - A plain page reload also keeps you logged in.
- **Test mode**: add `--test`, e.g. `node server/dev.js 8090 --test`. Every new character becomes a level 20 Bastion with good gear, potions, runes and gold.
- **Practice room (playing alone)**: Menu (on a phone: Settings), **Test: practice room**. A lit stone hall with eight practice golems: one alone, a row of three, a knot of four. They never move or hit back, have 30000 health, heal 1% a second, and stand up again a second after they fall; each tells you every 5 seconds how much damage you did and how much a second. They give nothing. The forcefield in the corner takes you back to the temple.
- **The test account**: log in as **Lickii** (its password is the owner's), alone or on a server: three characters at level 100, **Lickii Bastion**, **Lickii Hawk** and **Lickii Ember**, promoted, with high skills, the best gear their path can wear (legendary grade), potions, 100000 gold, a million in the bank, and Clang at level 100 beside them. They're made the first time the account is used (in a browser, or when a server starts without it), then play on and are saved like any characters. For trying things out only.

**On a phone:** open the same address. Touch screens get on-screen controls automatically.
- Upright, the map fills the screen and the controls sit over its bottom corners. Sideways, the controls are on both sides of the map.
- ⛶ goes fullscreen on Android.
- On a phone or tablet the game is played as an app from your home screen; opened in a browser, it shows how to add it (iPhone: Share › Add to Home Screen; Android: the menu › Install app). Computers play in the browser.
- Add `?mobile` to the address to try the touch controls on a PC.

**Gold for everyone online** (from the computer the server runs on): `curl -X POST -H "X-Tilequest: editor" "http://localhost:8080/admin/gold?atLeast=10000"` tops up every online player's gold to at least that much (handy for travelling), and tells them. On Windows, type `curl.exe` instead of `curl`.

## The game

### Oakvale Isle

The built-in world is **Oakvale Isle**, a hand-built starter island, and for now the whole world: the beginners' island comes first, the mainland after it.

- **The land:** Oakvale's town in the middle, in a ring of water, with a canal through it; Mirror Lake, the North Peaks, Bone Rocks and the Spider Hills (rocky mountains in tiers), the Old Tower hill and Hermit Rock, Wolf Woods, Deer Woods and smaller woods, Frog Marsh, Stony Field, Goblin Hill, Sunny Fields and Lighthouse Point.
- **The town:** a walled town in a ring of water.
  - The wall is thick enough to walk on: go up through a corner tower, or the arched doorway beside the north gate, and walk all the way round, over the gates and the canal. Climb a tower to its lookout, under Oakvale's blue flag with the golden sun.
  - Old bronze cannons stand on the battlements (look at one), and banners hang down the outside of the wall. Each gate has a gatehouse with a slate roof. The moat round the wall is a natural one, with reeds and water lilies; only the four gates have bridges over it.
  - The **Temple of the Dawn**, where you wake up, is a long white church under a slate roof just north of the square, tall round-headed windows down its sides, its tower with the clock and the bell built into the middle of its front (the door is in the tower's foot) and the statue of the founder in the churchyard; a walk leads from the tower's door down to the square. The square, with its compass, lies in the very middle of town: the high street runs across it from the north gate to the south gate, the cross street from the west gate to the east gate, and a straight walk comes down to it from the temple's steps. East of the square: Pip's Provisions; west, by the canal: Moonpetal Magic, the Warm Loaf bakery (Baker Willa) and the Fisher's Hut (Old Maren sells rods and buys fish; fish from the jetty behind it); in the south-west, at the end of the academy lane, the wide hay barn of the town farm (Farmer Ned, whose grain the sewer rats are after), open on its south side on to the big grain field with its scarecrows, and the water mill beside it, its wheel turning in the canal; east of the square, beside Pip's, the Watch House (Quartermaster Wynn trades watch marks, as Captain Osric does); south of it, the academy (yellow roof, the oracle upstairs) and the depot; north-west, the Sleepy Boar inn and the cottages; south-east, the smithy, the armourer and the training yard. The graveyard lies outside the walls, north-west of the north gate.
  - Shops hang out picture signs, signs explain each place, and there's plenty to find: gravestones to read, bookshelves, sewer grates and a chest someone forgot.
- **Who has something for you** shows it above their head: a yellow **!** for a new quest (grey until you're strong enough), a yellow **?** where you can hand something in. When you greet them, they say which word to ask about (in gold), and the Quests tab tells you where to go next.
- **Monsters** notice you once they could be on your screen (or a few steps beyond its edge). Each pack keeps to its own territory: it follows you a while, then ambles back home. Monsters never come into town. They are tough: every monster has five times the health it used to (the practice dummies excepted), for the same experience, so fights take a good deal longer.
- **Hunting grounds**, harder the further from town, in packs of two or three: rats in Sunny Fields (level 1-2), wolves in Owl Grove and Fox Copse, crabs on the beaches and round Mirror Lake, slimes in Frog Marsh, wolves in Wolf Woods and Deer Woods, spiders in Thorn Thicket and round the Spider Hills, goblins on Stony Field and Goblin Hill, skeletons on the Old Tower hill, and bears in Deer Woods and on Hermit Rock (level 8 and up).
- **Where the packs are:** rats in twos spread over Sunny Fields; spiders round the Spider Hills, well off the trail south (nothing tougher than a wolf lives near the main roads); crabs in twos along the south beaches, with Old Snapper on his own at the east end of the long south beach (and two more crabs round Wendel's rock off the west beach); a pair of goblin scouts on Stony Field and small bands on Goblin Hill (Chief Gnash in his camp at the top of the goblin trail, where they sleep at night); skeletons in twos on the Old Tower hill; bears deep in Deer Woods and on Hermit Rock (they carry a few coins).
- **Sergeant Bram's** reward for the wolves now includes three health potions, and he tells you about watch marks (two buy five potions at Captain Osric's).
- **How you fight:** small buttons by the left edge set it (two swords: attack; sword and shield: balanced; shield: defend) and whether you follow your target (footsteps).
- **The sewers:** tap (or use) one of the four grates in the streets to climb down (walking over one does nothing), and the ladder under it to come back. Brick tunnels with rats, giant rats where the walls fell in under the training yard, an old storeroom, and a dead end under the temple mount. Bring light (at level 2, say "lumen").
  - **Finds in the sewers:** an old chest in the storeroom at the west end (potions and a little gold), and a chest in the rats' nest under the training yard (20 gold and three potions).
- **The watch's hunts** (from level 3, after a gate's own task): each gate guard has a hunt again and again (10 wolves, 8 crabs, 10 spiders or 10 goblins), a new one 20 minutes after the last, paid in experience, 20 gold and two **watch marks**.
  - **Watch marks** are the gate watch's own coin: you can't sell them or buy them, only earn them on the watch's hunts.
  - **First hunt of the day:** the first watch hunt you finish each real day pays three more marks (five in all); the guard says so when he pays you.
  - Spend them at Captain Osric's at the north gate (ask about his marks): 5 health or 5 mana potions for 2, a ring of life for 5, an amulet of keeping for 8.
- **Rare named beasts:** now and then a rat, wolf, crab, spider, goblin, skeleton, slime or bear comes back as one with a name (Old Scarjaw, Whiskerjack, Ironclaw, Silkwidow, Grubnose the Sly, Sir Clatterbones, Glimmerglob, Mossback): bigger, a colour or a mark of its own, tougher, and worth more. Whoever is near hears of it. It drops its trophy: Armourer Brenna or Smith Dunstan turns that into a piece of rare or fine gear for free (ask them about a **trophy**; looking at the trophy tells you who).
- **The bestiary** (under your quests: the Quests tab, or the Quests page of the phone's drawer): every monster you slay is counted by its kind. At 25, 100 and 250 of a kind you know them better, for good: +3%, +6% and +10% damage against that kind.
- **The spiders' den** (optional, level 12 and up, better with friends): steps in the Spider Hills' south face lead down to the **Brood Queen** among her eggs: poison, more spiders at her call, and now and then the Brood Queen's fang, the best blade on the island. She comes back a quarter of an hour after she falls; the first to slay her is told to everyone. Guard Hilde at the east gate knows of it.
- **Houses:** Landlady Hettie, at a table in the Sleepy Boar, lets Bell Cottage, the one house for rent in Oakvale, by the inn: ask her about the houses.
- **Raids:** now and then something comes for the town, and everyone online hears it: a goblin warband at the north gate, a wolf pack at the west gate, or the dead stirring at Bone Rocks.

### The story of Oakvale Isle: The Last Town

The **Hollow Host**, an army of monsters, has swallowed every town and kingdom of the world. Oakvale is the last town standing; most of its fighters lie dead beyond the wall, and outside it is death for anyone untrained. You wake in its temple with nothing. Before each fight the townsfolk tell you to buy armour from Brenna and potions from Pip; Sister Ama heals you for free.

- **The gate:** the game opens on the painted valley at dusk, SORTIA's logo in the sky and a thin gold line filling while it gets ready, then the way in, SORTIA's account page: Oakvale by night with the SORTIA wordmark and *The Broken Seal* above the form on a phone, beside it on a computer. **Create account** (an account name, a password of 6 characters or more, typed twice) or **Log in**, switched under the form (Already have an account? / New to SORTIA?); **Show** shows the password; what's wrong is said above the button, which waits, saying so, while an answer comes. Then **Choose your character**: your characters, each with its path's emblem, level and path (tap one to play it), and **+ Create new character** (up to 10 an account): name it, **Begin the story**, and its story starts (or **Cancel**, or Escape, to go back to your characters without making one). **×** beside a character deletes it, after asking once more (not one that's in the world). One character of an account is in the world at a time (another device or tab is told which one is playing). An account of before is the account of its character, with the same name and password. Playing alone, the account and its characters are this browser's: making a new account replaces the one kept here (it says so first, and asks you to press again). Logged in once, the game opens on your characters without the password (**Log out** there for another account); a reload while playing goes straight back into the world; Menu, **Log out** takes you back to your characters. Once it has loaded (the music too), **Tap to begin** (or click, or press a key): that first tap is what lets a browser play sound, so **The Shadowed Gate**, SORTIA's title music, starts with it. When a new character's story begins it crossfades into **The Broken Seal** (the one rising as the other falls, over three seconds), which plays through the opening and choosing your path and fades out as you step into the world (Menu, Music off silences it).
- **The opening:** a new character follows seven story cards: The Seal, The Broken Seal, The Hollow Host, Bastion Holds the Crossing, The Road to Oakvale, The Last Crossing and The False Signal. A Bastion holds a forest bridge while your group escapes; the sleepless journey explains your exhaustion at Oakvale. The night crossing and Sister Ama's room use a fade through black. The pictures keep their original resolution and subtle depth movement, with no motion when reduced motion is enabled. Continue, back, swipe, arrow keys and Skip intro control the story; automatic playback continues across the separate scenes. Sister Ama asks your name, then leads to Choose Your Path.
- **The North Wall** (level 1, Sister Ama in the temple; the first chapter of The Last Town): tell her you want to fight, and she sends you to **Captain Osric** at the north gate, who turns you away. Then the war horns blow: the Host is at the north wall, and its gunners are down.
  - Climb the stone steps beside the gate onto the wall, and **load four cannons** along it (click or tap each one).
  - Behind the powder kegs by the steps something mews: **Clang**, the temple's grey kitten, who sleeps up there (Sister Ama and Gunner Hale, hurt in the temple, know it). Use the kegs: he hides in your coat, and from then on he's your companion. Once the Host has run, you may give him a name of your own.
  - Light the fuse at a loaded cannon: they fire one after the other along the wall, and the Host runs. Osric was wrong about you: he sends you to Master Corwin.
  - **The siege is yours alone:** only you see the Host beyond the moat, the fire and the smoke, and only you hear the horns and the cannons. Others on the wall see a quiet wall.
- **The Recruit** (level 1, Master Corwin at the academy): ten hits on a training dummy in the yard (your skills), a leather cap, then **Farmer Ned's** rats: down the grate outside his barn into the sewers, with his torch, five rats (and your first level). Then sell something you found to Pip and buy something, put something in a locker at the depot (drag it in, or "Put in locker"), and back to Corwin for a **wooden shield**, a **backpack** (20 places instead of the bag's 8: open it in your bag and tap "Carry my things in this backpack") and a rope.
- **The town gates stay shut to you until Corwin has trained you** (The Recruit done, or level 3): outside is death for the untrained, and while the Host is at the walls nobody goes out at all. The guard at the gate stops you and says why.
- **The gate watch** (level 2-5): a guard at each gate has a task beyond it and a piece of gear, and sends you on to the next.
  - **Sergeant Bram, west gate** (a leather jerkin): **Greyfang** leads the wolves, and nobody knows where he lairs. Look for his huge paw prints in Wolf Woods, follow them (look at each one), and bring back his pelt. His pack gets in the way.
  - **Guard Tilda, south gate** (leather legs): **Wendel the fisher** is stranded on a rock off Lighthouse Point, with crabs all round him. Clear them, talk to him, and he paddles home to Fisher's Rest by himself.
  - **Guard Hilde, east gate** (a chain helmet): burn four **spider nests** round the Spider Hills. Use the torch she gives you on a nest, or cast **Torchlight** ("lumen") right next to one. Burnt nests are spun again after a while.
  - **Captain Osric, north gate** (a studded shield): steal **Chief Gnash's war plans** from the war chest in his camp on Goblin Hill. The goblins there **sleep at night**: sneak past, but step right next to one or hit one and the camp wakes up.
  - **Every task from a gate guard** (their own, and the hunts after) comes with **two health potions** as you set out. If your bag is full, they lie at your feet.
- **Farewell** (level 10, Sister Ama): farewell to your recruit days. Climb the bell tower and ring the bell yourself (the town looks up and cheers), say farewell to Master Corwin, Pip and Captain Osric, and come back to Sister Ama for her blessing.
- **The oracle** (level 10, upstairs in the academy): she names you before the town on the path you walk: the bell rings for you over the whole isle, she has a gift for your path (a Hawk: three skill points too), and you are a newcomer no more (until then, dying costs little and no player may fight you). A character made before paths were chosen at the start chooses theirs here. **The front isn't built yet:** so you stay in Oakvale as one of its defenders, and you still wake in Oakvale's temple.
- **The Carrot Bandit** (level 2, Farmer Odo in Sunny Fields): wild rabbits (harmless: they never bite, and run when chased) are digging up Odo's carrots, led by **One-Eye Patch**, a big buck with an eye patch who throws things and calls his lads. Chase off 4 rabbits, find Patch in his den south-east of the farm past the pond (dug-up earth and Odo's stolen sacks), and Odo gives you Patch's **lucky paw** (a ring: you run faster for half an hour) and carrots (food). Rabbits drop carrots and now and then a rabbit's foot.
- **Up the hills:** the paths up Bone Rocks and the Spider Hills lead somewhere now: the founders' lookout (a cairn with a find, two skeletons on watch) and the spiders' hatchery (an old pack in the webs with silk, two spiders); on Hermit Rock the hermit keeps bees in the heather.
- **Hidden quests:** nobody hands these out and the guide's arrow never points at them. Ask Innkeeper Rolf at the Sleepy Boar, and the townsfolk, for **rumours**, read the gravestones, and bring Pip's tools. Each ends at a chest with gear better than the shops sell, and experience for the finding (once per character; the Quests tab lists those you've found).
  - **Down the Well** (about level 6): Old Wim went down the town well for a bet and never came back up.
  - **Under Goblin Hill** (about level 6 to 7, the deepest): Armourer Brenna misses her grandmother's bronze shield, which Gnash's goblins keep in their hoard under Goblin Hill; and goblins say their hill was a kingdom once, its worst king buried under it with his sabre. Push through the goblins' tunnels to the hoard for Brenna's shield, then go four floors down: dig through to the goblins' old diggings, drop into the bone halls (no way back up the way you came: find the rope spot), pass the old goblin gate (level 7 and up) and face King Mogg on his throne. Bring a shovel, a rope and plenty of potions. His sabre beats every other blade on the isle. Behind his throne, the goblins' old steps climb all the way up to a hollow in the Deer Woods: a way out, never a way in.
  - **The Old Tower** (about level 5 to 8): the tower's door fell in long ago, and its last watch lies in Oakvale's graveyard: their graves tell the order of the levers that open the cellar, where the last watchman's shade keeps his greaves. And the night the stair fell, Captain Harrow was up top with the watch's pay, and a lantern still burns there on dark nights. Above the tower's broken top three storeys still stand: climb up with a rope, get past the officers' grille (level 8 and up), and up two stairs to the lookout on the roof, where the captain keeps his post. His mail (armour 8) is the best armour on the isle.
  - **The Smugglers' Shield** (level 7): smugglers once landed at Lighthouse Point, until the old keeper walled up their hole in the rocks east of the point. Break his stones with a pick and drop into their sea grotto (no climbing back out the way you came), go down to their drowned hall past the rusted grille (level 7 and up), and take their copper shield from Saltjaw, the great crab. Their way out still comes up under the lighthouse's floor. The shield (defense 19) is the best on the isle.
  - **The Weaver's Helm** (level 8): an adventurer went past the Brood Queen, further down, and never came out; something pale weaves in the deep. Behind her egg chamber a wall of old web fills a crack in the rock: burn it (a torch, or Torchlight). Down through the deep webs, full of spiders, past an old grate (level 8 and up), to the Old Weaver's larder and the lost adventurer's helm, bound in silk (armour 4, the best helmet on the isle). Her ladders lead back up into the den.
  - One quest to a place: what you find at each is yours once, and never twice the same kind of gear.
- **Levers and boulders:** some levers only work pulled in the right order (a wrong one makes them all spring back with a clank). Walk straight into a boulder to push it a tile on; pushed boulders roll back after a while.
- **Fisher's Rest** has a hut and a jetty now, with Old Maddock, who sells fishing rods. The **Sunny Fields** farm has a farmhouse and a mill, and Farmer Odo sells food.
- **Digging and fishing:** loose sand lies here and there on the beaches: dig it with a shovel for shells, old coins, now and then a potion or a pearl; the tides fill it in again. Fishing brings up a pearl now and then, or a bottle with a letter in it.
- **The bell** in the church tower: anyone may climb up and ring it, and the whole isle hears it.
- **A town under siege:** the watch's braziers burn on the north wall, on the square and in the training yard; sandbags flank the north gate; refugees from fallen towns camp by the academy (Mara of Ferndeep waits by her wagon on the square); the names of those who held the wall are scratched into its stones by the steps; the watch's notice board hangs by Pip's door.
- **Looking** at anything: Shift+click it (or right-click someone, then Look); on a phone, hold it (holding something you can use, uses it).
- **The crypt under Bone Rocks** (from about level 5): skeletons in the hall of coffins and the founders' arms (take one weapon). Behind the iron gate (level 7) the founder's tomb, where **the Gravewaker** wakes the dead.
- **Mirror Lake's shrine:** the founders' little shrine on the south shore gives you blessed water once (it heals better than a potion).

### How it plays

- **The guide**: a new character gets one thing to do at a time, in a box at the top left, from the first word with Sister Ama to the oracle; through the basics a yellow arrow points the way:
  - it shows, not only tells: the rest of the screen dims around the part a step is about, a hand taps at it, the guide's box has a little picture of what it means (the four colours of the big button, the gold words, the bars), a thin gold line shows how far you've come, a step done glows "well done!", and a gold ring pulses on the ground round whoever the arrow points at
  - **people understand you** even without the gold words: say hi again, thanks, or "what do I do?" / "where?" / "help" and they tell you your next step. And the townsfolk know Oakvale's past: ask Sister Ama about the founders or the long winter, Master Corwin about the Old Tower, Pip about the lighthouse, Postmaster Hobb about the founders' ship, Brenna about the crypt gate, Willa about the hermit, Moonpetal or Corwin about the Hollow Host
  - **Clang, a companion**: the temple's grey kitten, found shaking behind the powder kegs on the north wall on The Last Town: from then on he follows you everywhere, scratches whatever you fight (the kill and its loot are yours), and grows stronger, up to level 10, but never past your own level. He learns half the experience of every monster he helped you kill; a training dummy teaches him only up to level 4. When you get him you choose his name (it needs a letter, and can't be an NPC's). He has his own health bar: monsters next to him hit him now and then instead of you (more often while he fights), badly hurt he keeps behind you (you're warned when he drops under 30%), and whenever nothing is next to him he heals by himself. He never stands on your tile or a monster's: he steps aside. He never fights players, and never from or into a protection zone. Nothing targeted, he still goes for whatever attacks you or him. Badly hurt (under 30%) he keeps back beside you, away from the monsters, and heals twice as fast till he's at 60%. A **pet tonic** (8 gold at Pip's) heals him by half: use it from your bag, his card's potion button (it takes a tonic before a health potion), or set **auto-heal**'s Clang slider (Settings / Battle panel) and he's tended for you with tonics, or food when you have none (never your own potions).
  - **The Guardian's Toll**: fully grown (level 8) Clang is twice the size, and has a special attack. About every 15 seconds in a fight he rings his bell (*CLANG!*): every monster around him takes a hard blow and stands dazed for 2 seconds, stars circling over its head (a boss shakes it off in 1).
    - **How he fights**: Follow (at your heel, out of fights), Assist (whatever you fight, the default) or Stay close (only what comes right up to you).
    - **His card** (Companion): under your equipment on a computer, on the Hero page of the drawer on a phone (above your skills), or hold him on the map: his portrait, health, experience to the next level, damage, how he's doing, how he fights, and Feed (it says what he'll eat), Potion, Call, Rename and Send home. Food and potions are kept while he isn't hurt. On a computer a right-click on him opens a short menu too; a click on him just walks there. On a phone a small bar at the end of your health bar shows his health.
    - Knocked out, he runs home to the temple and comes back after three minutes, or at once if you ask Sister Ama (sending him home then does nothing). Call him back from his card, under Settings, or from Sister Ama. While you're dead he waits at the temple. Others see him too, with his name, level and health
  - **dying before a vocation** costs a little experience but never a level, and Sister Ama tells you what to do differently next time (wolves hunt in threes: take them one at a time...)
  - **starter gear**: Master Corwin gives you a leather cap after your ten hits on a dummy, and the guide shows you how to put it on; the shield comes at the end of your training
  - first the basics, as the story needs them: what kind of world this is; walking (click or keys; on a phone tap, or drag like a joystick); looking at things; talking to Sister Ama (the gold words); Captain Osric and the Quests tab; the steps up the wall; using things (the cannons, the powder kegs); experience; Master Corwin and skills (the dummy); the cap; a grate down into the sewers and Ned's torch for the dark; your first fight; healing after it (eat, or a potion); the loot; back to Ned; what dying costs (only explained, in town: little here, more once you've chosen a vocation); trading at Pip's; the depot; the shield
  - after the basics the arrow goes: you find your own way. **The map shows roughly where each quest you're on is done**: a gold circle on the minimap and the world map (dashed, with ▼ or ▲, when it's on another floor; off the edge of the minimap, a gold point at its edge shows the way), moving on as the quest does (the rats, then the one to tell). Something new there puts a red dot on the map's buttons (on a phone the map button top left and the drawer's Map tab; on a computer Map under the minimap) until you look
  - then the story leads, one chapter a step: the gate watch (the four guards one after the other; Torchlight at level 2), the farewell and the oracle
  - during the basics the arrow points to whoever has a task or news for you, to the monsters a task still wants, or to the way down
  - the box can be folded away (▾, or click its title) and out again; it goes once you've followed it to the end ("Got it"), or when you **Skip** it (tap Skip, then again to be sure)
  - **Guide** in the menu (on a phone: Settings, The guide) starts it again from the first step, as long as you're on the starter island: what you've done already passes by itself
- **The front isn't built yet.** At level 10 the oracle lets you choose a vocation. The world beyond the isle isn't built yet, so you stay in Oakvale as its defender. PvP waits for the mainland: nobody can attack another player on Oakvale Isle.
- **Walking** works as in Tibia: your speed is 278 at level 1 and grows by 2 each level; a step takes longer on grass, sand and rough ground than on roads and floors, and slowest through snow and swamp; and a diagonal step takes twice as long. Monsters have their own speed: a rat is slower than a new character. Clicking somewhere takes the quickest way, only north, east, south and west if it can: a diagonal step only where nothing else gets past. Pick a target while you walk, with chase on, and you stop walking and go for it. Rides keep their own pace.
- **Towns** grow around a square with market stalls (Oakvale’s has a golden sun mosaic in its paving), the temple on its north side, and streets with pavements, lamps and trees. Along the streets stand shops, halls, an inn and houses, each with its own roof (clay, slate, shingle, thatch, copper or flat, shaped into hips and ridges). Townsfolk stroll the streets and chat: guards, criers, bards, children, cats, dogs and chickens. Talk to them: they know the news. Inns stand halfway along the long roads between towns.
- **Outfits**, as in Tibia (the Outfit button): 8 outfits (citizen, hunter, mage, knight, noble, barbarian, druid, pirate), each in a male and a female cut. Colour the head, primary, secondary and detail parts from 133 colours. Each outfit has two addons, a hat and a piece of gear, that unlock at levels 20 and 40.
- **Vocations**: three paths, chosen as you make your character (after your name). The **Bastion** stands in front and takes the blows, the **Hawk** strikes from afar (and starts with a bow and arrows), the **Ember** burns whole packs with fire and energy. (They used to be called knight, paladin and sorcerer; old characters keep theirs.) The **Grove** is no more: a Grove from before walks the path of the Ember now, rods and all. At level 10 the oracle names you; once there is a mainland, she will send you on to it.
- **The Hall of Paths** (Kestrel Isle, the new world's preview: Menu, **Preview: the new world**): on Bellhaven's square.
  - **Pathkeeper Ilse** tells you about the four paths and gives you the **Book of Paths**: the four side by side, what each is for, what it fights with, where it's strong and weak, and who teaches it.
  - **Four teachers**, one by each coloured pillar: Sergeant Holt (Bastion), Ranger Sill (Hawk), Mistress Vela (Ember) and Old Fennick (Grove). Once you've rescued Clang for Sister Ama, ask them for a **trial**.
  - **A trial**: down in the teacher's practice room you *are* that path for a while, with their gear in your hands, its two spells at any level, and plenty of mana. Cast both spells and knock down three dummies (a sparring dummy hits back, to block or to heal). You can't die there and earn nothing: no experience, no skills. Leave by the forcefield and everything is yours again, as it was. Each trial passed puts a stamp in your Book of Paths.
  - **Choosing**: with all four stamps, tell the Pathkeeper which path made you grin. It can't be undone, and your teacher has a gift in your bag.
  - **Bellhaven**, its town: a small town in the lap of a hill. The temple stands high on its own rock: down a flight of steps to a terrace with statues and the graves, and down another to the courtyard, with its fountain, market stalls and Marta the grocer. The depot, the general store (rats in its cellar), the Hall of Paths, the inn (rooms upstairs), the smithy and the healer stand round it. Down the main street lies the harbour: Harbour Master Quill, fishermen on the piers, boats and cargo. The town's ways in are its two gates out on the roads, each a pair of watchtowers with a wall out to the rocks, lamps, banners and two wardens: inside them you're safe.
  - **The guide** on Kestrel Isle leads a newcomer through it all: Sister Ama, down the grate to the bell cellar for Clang (your first rats and loot), back to the temple, then the Hall of Paths, the four trials and choosing. Bellhaven is your home town there.
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
- **Capacity:** you can carry 400 oz plus 10 per level (more per level as a Bastion or Hawk), gear you wear included. What you can't carry lands at your feet.
- Monsters respawn about a minute after they die (faster when several players hunt together: with three, twice as fast), where no player can see it happen. If someone stands in sight of a spawn, its monster walks in from beyond the edge of their screen instead, so a hunting ground never runs dry.
- You walk faster as you level, quickly at first and then less and less (230 ms per tile at level 1, about 160 at level 50, 120 at level 100). Haste and the like are on top of that.
- **The version** you are playing shows on the loading screen and at the bottom of the settings (Menu): after an update it goes up by one.
- **Your hero's strikes are in your own colours** (hair, shirt, trousers, boots), the same as walking.
- **Arrows for a Hawk**: Smith Dunstan sells arrows (2 gold each). From level 3 a Hawk can also whittle **rough arrows** for free: Fletch Arrows ("forma virga", 20 mana) makes 10, straight into your quiver. They hit a good deal softer than bought ones (13 against 20). When your quiver runs empty it fills itself from your bag: the same arrows first, else any arrows you carry.
- **Shooting with a bow**: every arrow you shoot shows your hero at full draw and then loosing it (a crossbow doesn't, for now). With a war spear, every blow shows your hero winding up and swinging it.
- **The hawkeye bow** (level 8, from Smith Dunstan in Oakvale for 1200 gold): a bow with a sharp eye. About one shot in seven (15%) is a **critical hit**, twice as hard, a big orange number with a ! and CRITICAL! over it, and a burst of orange light. It counts for plain shots, Triple Shot and Power Shot alike.
- **The Hawk's skill tree** (Skills, then **Skill tree**; on a phone the Hero tab; key **K**): a Hawk learns their attacks with points instead of by level. **One point a level from level 1**, and three more when the oracle names you. Four lines, each a row of tiers that open at levels 1, 10, 25 (and 45): **Shot** (Power Shot, Gale Shot, Sky Lance), **Volley** (Double Shot, Triple Shot, Quad Shot at 25, Penta Shot at 45), **Falcon** (Falcon's Mark, Hunting Falcon, Twin Falcons) and **Holy** (Holy Bolt, Holy Wave, Holy Storm), and two passives, **Sharp Eye** (more critical hits) and **Light Feet** (faster walking).
  - Each tier has **3 ranks**, each 15% stronger; a rank costs its tier's number in points (1, 2 or 3). The next tier opens once the one before is at rank 3 and you're of its level. You can't have it all: choose.
  - **One button a line:** a line's button (and its words) casts the highest tier you've learned of it, and grows with it. A line with nothing learned waits on the bar, locked.
  - **The Volley:** two, three, four or five quick arrows at your target, each hit on its own and costing an arrow, each with a red line following it; Quad and Penta Shot are blood-red with a dark core, and Penta Shot throws off sparks and bursts where it strikes. **Falcon's Mark:** your target takes 15% more damage from everyone for 10 s. **Hunting Falcon / Twin Falcons:** one or two falcons circle over you for 20 s and dive at your target in turn, marking it. **Sky Lance** bursts where it stops.
  - **Start over** in the tree: all your points back, free the first time, then your level x 50 gold. A Hawk from before the tree has all the points of their levels to spend.
- **Triple Shot** ("sagitta trina", the Volley's second tier, level 10+, Hawks, a bow or crossbow and its ammunition, a target within 6 tiles): three quick arrows at your target, one right after the other (you stand still while you shoot them), each a streak of pale light that bursts small where it hits; each does less than a Power Shot. It costs three arrows, and can be shot again 3 seconds later.
- **Power Shot** ("sagitta vis", the Shot line's first tier, level 1+, Hawks, a bow or crossbow and its ammunition): you draw to the full for a moment and a half, rooted to the spot (a ring of light on the ground under you, white inside to gold and amber outside, and sparks drawn into your bow) and loose one arrow at your target, or straight ahead if you have none, up to 6 tiles; it flies on through every monster in its way, and each is hit as the arrow gets there, one after the other, three times as hard as a plain shot (Gale Shot about 3.6 times, Sky Lance about 4 times). A monster of your level takes about four of your attacks. It costs one arrow, and can be shot again 5 seconds later. The arrow flies as a sharp golden arrow of light with a near-white core, white light running over it, a crescent of light round its head with ribbons sweeping back, and a golden burst where it ends; at night it lights its way.
- **Lightning Bolt** ("fulmen saltus", level 13+, Embers, a target within 5 tiles): lightning strikes your target, then leaps to the nearest monster within 3 tiles of it (in sight), and on from that one, up to 6 monsters; it never leaps back to one it already struck. Each is struck a moment after the one before, as the bolt gets there, for energy damage. 55 mana; it can be cast again 2 seconds later.
- **The war spear** (a first try of the spear, level 15): held in both hands (no shield), it strikes a monster next to you, like a sword; for now it trains the axe skill. **Circle Throw** ("hasta orbis", level 10+, Bastions and Hawks, a war spear in your hands): a sweeping blow round you in a half circle in front of you, from your right to your left: your hero winds up, swings and follows through (a man's body: a woman's strikes are still to come), and each monster within its reach is hit as the blade gets there, one after the other, under a glowing green-gold crescent; each hit bursts in light. It can be swung again 3 seconds later. A level 100 test Bastion or Hawk gets a war spear, and a test Hawk holds the hawkeye bow (Menu: "Test: spears" or "Test: hawkeye bow and spear" for one made before).
- **"ignis ultima"** (level 15+, any vocation): you blow yourself up, with heavy fire damage to everyone within 2 tiles. It isn't on the spell bar, so you have to say it, and it doesn't work in protection zones.
- **Secure mode** (the Secure button next to Chase; 🕊 on a phone), as in Tibia: on, which it is unless you switch it off, your attacks and area spells only hurt players who have a skull, and never your party. Off (it says PvP then), whirlwinds, waves, area runes and the like hit every player around you outside safe places, party members too, and attacking an innocent gives you a white skull.
- **Use from afar**: use a tool, key or furniture on a spot further off (a shovel on a beach, a pick on a rock, a torch on a web) and you walk there and use it; a fishing rod reaches 5 tiles. Walking somewhere yourself on the way calls it off.
- **Chase**: attacking a monster while you walk somewhere ends the walk and, with Chase on, you go for it. Walk away yourself (keys, stick, a tap on the map or on something to use) and Chase switches off, as in Tibia: switch it on again to chase. Walking off also ends following someone. On a phone, a tap on your target's bar at the top stops attacking it.
- **Auto-heal**: sliders (Settings on a phone, the Battle panel on a computer) make you drink a health or mana potion by yourself when you drop below the part you choose, 10% to 80% (off by default). It uses your own potions, one a second like a tap would, health first; not while you trade. Your last potion is warned of, and running out is said once. On a phone the potion button shows it: A40 for below 40%.
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
- **Sound:** SORTIA's title music (at the gate, in the opening and while you choose your path), and a wooden knock whenever you tap or click a button. The game's own sounds and tunes were taken out for now. Menu: **Sound** (the knock) and **Music** on or off.
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
| K | A Hawk's skill tree |
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
- **The guide's arrow** (through the basics) points to what a task still needs; after that, the gold circles on the map, and a red dot on the map button when there's something new.
- **Walking:** use the joystick at the bottom left, or swipe on the map. A short swipe walks one tile, diagonals too; keep your finger down to keep walking. Messages show near the top of the map, under the status bar and the guide, so they never cover you. Or tap a tile to walk there: a gold mark shows where you're going. Don't want the joystick? Turn it off under Menu, Game.
- **The map:** a tap walks, attacks, talks or opens a corpse. A long press uses something.
- **Training:** in the training yard, south-east of town, click (or tap) a dummy and you keep hitting it, as long as you like, until you walk away. Every hit raises your weapon's skill (club, sword, axe, or distance with a bow), as hitting a monster does; a higher skill hits harder. Wands and rods train nothing there: magic grows by casting.
- **The welcome:** naming your character and logging in happen on the loading screen's picture, with the logo; the game's buttons and bars come once you're in.
- **Always the newest version:** played from the web, the game looks now and then (on opening it, on coming back to it, and every ten minutes) whether a new version is live; if so it saves and loads it, behind the loading screen.
- **The loading screen:** the SORTIA logo ("The Broken Seal" under it) over a valley at dusk (a picture made for phones, tablets and wide screens), with a gold bar while the world gets ready.
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
- **Maps:** drag the world map or the minimap with one finger (or the mouse) to look round; a tap still walks there. Pinch with two fingers to zoom. Opening the map again, or the zoom buttons, centre it on you. The maps are painted in the world's own colours, seen from the sky: roofs, the temple on its mount, the town wall's walkway, trees as crowns, shadows down-right; shops, quests and the temple as gold-rimmed medallions.
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
- Floors are drawn bottom-up, and each floor above is shifted one tile up-left. Walls are blocks one floor tall in the same projection, so roofs rest on the wall tops. When something is above you, that floor and everything higher is hidden; that's how roofs disappear when you walk into a house. Standing at a window or a door, or in a doorway, you look in: the roof of the building beyond lifts too.
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

Phone: up top, over the map, only what happens to you shows with its time (poisoned, burning, electrified, paralyzed, a skull, a fight with a player). What you gave yourself shows on its own action button instead: Haste, Magic Shield and Torchlight show their time left at the top of their button (with a thin gold line), food how long you stay fed. The Eat button shows the food it would eat (the first in your backpack), dimmed when you have none.

Phone: nothing to tap up top. The status bar shows your health and mana, and under them EXP with its percent, a thin experience bar and your level. A map button sits in the top left corner of the view, the guide's card beside it; while you fight, what you're fighting shows at the top with its health; the middle button lights up warm, a spell cooling down shows its seconds and tenths (2.4s), and a message about mana shows a drop; the drawer has five tabs along its bottom: Gear (what you wear and carry), Hero (your companion and skills), Map, Quests and Settings.

Mobile viewport: as an app on the home screen the phone's status bar (the clock and battery) stays opaque: a see-through one let iOS soften what lies under it, the health and mana bars among it. The layout reserves the top and side safe areas once; the action dock includes the home-indicator inset. Rotation resizes the canvas through its existing sizing function. Actual iPhone standalone appearance still needs device verification.

The compact phone HUD shows level, current/max HP and mana, and progress to the next level. The map editor keeps an opaque iOS status bar; device verification is still required.

- Phone action bar: three spells on the left, the big button in the middle, three spells, potions or food on the right. A new character starts with every button empty but the health and mana potions (the guide shows you how to fill them); a new character with an old name starts fresh too. Each shows its picture: a spell its mana under it with a little drop (red when you have too little), a potion how many are left. A gold edge means you can use it now; dimmed means not enough mana or none left. While a spell or potion cools down a shade sweeps off it and the seconds count down. An empty button shows a + and "add": tap it to choose what goes there. Held sideways the buttons stay square, together in the middle. A potion with none left is greyed out, its count red. Low on health (under a third), your health potion glows red.
- The button in the middle, square like the others with a gold edge, shows only an icon for what it does, and what the moment asks: attack a monster in sight (press again for the next one; never in a protection zone), loot a nearby corpse when there's nothing to fight, talk to someone in reach, or use a door, chest or dummy next to you, also while the drawer, the chat or someone's talk is open. Its colour says which: red, amber, blue, green; dark when there's nothing to do.
- Over the action bar, one line shows the newest message as it comes, then dims after a few quiet seconds. Tap it for the whole chat: it opens above the action bar, as tall as its messages need (up to 40% of the screen), with a send button beside the line you type in (the keyboard's Enter sends too, and stays up for the next line). Close it with the tab on its top edge; the big button keeps doing its work meanwhile. Only a new level, a quest or a raid also pops up over the map.
- A corpse you open shows its things low on the screen, just over the action bar, in reach of your thumb (Take all, or tap a thing).
- Your equipment and backpack: tap the backpack at the end of the chat line. They open side by side over the bottom of the map, all your equipment in sight with what it adds up to (attack, defense and armor) on one line above it; the map slides up so you stay in view. Skills › at the end of that line opens them up to your skills. Swipe up on the drawer's tab to open them up to the status bar, with any other bag you opened and your skills across the bottom. Your gold shows under your backpack's places; gear of a better grade has its colour on its place (green fine, blue rare, purple epic, orange legendary). The tab rides up on the drawer's edge (pointing up while there's more, down when it's all open); swipe it down to go back a step, or tap the backpack again or the map to close it. The big button keeps attacking, looting and talking meanwhile. Tap a piece of gear to see its numbers: in your backpack also how much more (green) or less (red) it gives than what you wear there now (Wear or Drop); on you, Take off. In a shop, tap a ware's picture or name to see the same before you buy. Drag things between them as before; the action bar keeps working. Drag something out of the drawer onto the map and the drawer closes as you leave it, so you can drop it where the drawer was.
- Along the bottom of the drawer, four tabs: **Gear** (equipment, backpack, skills), **Map** (the minimap, as big as the drawer: tap a spot to walk there (half open the drawer stays, on the full map it folds away so you see where you walk), pinch or + and − to zoom, the arrows for the floor above or below; it opens half way, and Full map opens the drawer all the way on the whole world, again goes back), **Quests** and **Settings** (sound, quality, frame rate, outfit, party and guild, and the help). They sit just above the action bar, so one thumb reaches everything.
- Swipe sideways over either group for its next set (three each); short bars under each group show which set (gold). Hold a button to choose what goes there or to empty it: the choices rise from the action bar, in reach of your thumb, each with its picture, its mana and a line on what it does; the big button closes it. Spells without a picture yet show their initials.
