'use strict';
// The new world, Kestrel Isle (played as a preview for now: index.html?world=kestrel, or Menu: "Preview: the new world";
// the built-in world stays Oakvale Isle until this is ready). Built the way Rookgaard is built, with places of its own:
// Bellhaven in the middle (drawn by hand, tile by tile, below), the wilds all round it with game spread over them, rock
// outcrops everywhere, a river and a lake; and (next) under the whole isle one great warren of caves, four layers deep,
// harder the deeper, with many ways in. The plan of every layer: docs/kestrel-isle.md.
//
// Bellhaven, one character a tile (100 x 90; the legend is below the art).
const KESTREL_TOWN_ART = [
  "RRRRRRRRRRRRRRRRRRrRRrrhhhhhhhhrrrRRRRrrRRRRRRRRRRR:::RRRRRR",
  "RRRRRRRRRRRRRRRRRRrrrrhhhhhhhhhhhrrrRRrrRRRRRRRRRRR:::RRRRRR",
  "RRRRRRRRRRRRRRRrrrrrhhhhhhhhhhhhhhrrrrrrrrRRRRRRRRR:::RRRRRR",
  "RRRRRRRRRRRRRRRrrrrrhhhhhhhhhhhhhhrrrrrr...........:::RRRRRR",
  "RRRRRRRRRRRRRr.rrxrrhhhhhhhhhhhhhhrrrrrrffffffffff.:::.RRRRR",
  "RRRRRRRRRRRRRRrrrrxrhhhhhhhhhhhhhhrrrrrrffffffffff.:::.RRRRR",
  "RRRRRRRRRRRRRR.rrxrrrhhhhhhhhhhhhhrrrrrrffffffffff.:::.RRRRR",
  "RRRRRRRRRRRRRR.rrrxrrhhhhhhhhhhhhhrrrrrrffffffffff.:::.RRRRR",
  "RRRRRRRRRRRRRR.rrxrrrhhhhhhhhhhhhhrrrrrrffffffffff.:::.RRRRR",
  "RRRRR..........rrrrrrrhhhhhhhhhhhrrrrrrrffffffffff.:::..RRRR",
  " RRRRR.........rrrrrrrrrrruuurrrrrrrrrrrffffffffff.:::..RRRR",
  " RRRRR.ffffffff...rrrrrrrrrrrrrrrrrrrrrrffffffffff.:::..RRRR",
  "   RRR.ffffffff...rrrrrrrrrrrrrrrrrr...=======.....:::..RRR ",
  "  RRR..ffffffff=====......sss..........=..fffffffff.....RRR ",
  "  RRR..ffffffff....=.__________._.._...=..fffffffff.....RRR ",
  "  RRR..ffffffff....________________._..===fffffffff.....RR  ",
  "   RR..ffffffff...____________________.=..fffffffff.....RRR ",
  "::::====..........____________________._..fffffffff.....RRR ",
  "::::====........._________===__________...fffffffff.....RR  ",
  "   RRRfffffffff.__________===___________.......ffffff..RR   ",
  "    RRfffffffff.__________===___________.......ffffff..RRR  ",
  "    RRfffffffff.._._______===_________.=fffffffffffff..RR   ",
  "   RRRfffffffff===__._____===________..=fffffffffffff..RR   ",
  "   RRRfffffffff=...._=____===_____=....=fffffffffffff.RR    ",
  "     Rfffffffff=ffffffff_.===..fffffff.=fffffffffffff.RRR   ",
  "    RRfffffffff=ffffffff..===..fffffff.=fffffff===...RRR    ",
  "    RRR..ffffff=ffffffff..===..fffffff.=fffffff=....RRR     ",
  "    RRRR.ffffff=ffffffff..===..fffffff.=========....RR      ",
  "      RR.ffffff=ffffffff..===..fffffff.............RRR      ",
  "      RRRffffff.ffffffff..===..fffffff.......t...RRR        ",
  "      RRRffffff.....=========ffffffffffffffff...RR          ",
  "      RRRR..fffffffffffff.===ffffffffffffffff.RRR           ",
  "        RRRRfffffffffffff.===ffffffffffffffffRRR            ",
  "          RRfffffffffffff.===ffffffffffffffff               ",
  "            fffffffffffff.===fffffff                        ",
  "            ==================================              ",
  "            ==================================              ",
  "~~~~~~~~~~~~~~~~~~~~~pp~~~~~~~~~~pp~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~pp~~~~~~~~~~pp~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~pp~~~~~~~~~~pp~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
];

// What the town's art means, tile by tile:
//   ' ' the wilds (grown by the island, below)   . town grass   ~ water   R rock (cliffs, a rugged top a floor up)
//   r the temple rock (cliffs, its top a floor up is grass: a terrace)   s the steps up it   h the higher rock the temple
//   stands on (two floors up)   u the steps up it from the terrace   = cobbles   : trodden earth   _ paving
//   # town wall   f a building's floor (the building itself: KESTREL.buildings)   p pier   x gravestone (on the rock)   t a tree
// The town's art sits on the island with its corner at TOWN_AT (island tiles); the island sits in the world at ISLE_AT.
const KESTREL = {
  isle: 210, isleAt: [23, 23], townAt: [72, 109],
  // in the town (town-art coordinates): the courtyard's middle (where the town is walked from), the ways out of it
  // (the west gate, the gorge north, the quay), and the first row of the harbour (the art's sea from there on is only
  // the harbour basin)
  square: [27, 18], gates: [[-26, 17], [52, -12], [27, 36]], harbourRow: 37,
  // the town's gates stand out on its roads, a little way off (half a minute's walk from the courtyard): a paved road
  // from the town out to a pair of watchtowers, and between them the way on (town-art coordinates: [x0, y0, x1, y1],
  // 3 wide or tall). The towers are buildings (below), with stairs up to a lookout.
  approaches: [[-26, 17, -1, 18], [-26, 19, -19, 19], [51, -12, 53, -1]],
  // the gates: from each tower a short stone wall out to an outcrop of rock, so the road through between the towers is the
  // only way in; lamps either side of it, banners on the towers, a pair of wardens on its town side, a signpost outside
  // (town-art coordinates: walls [x0, y0, x1, y1], rocks [cx, cy, rx, ry], lamps, banners on tower walls, wardens, signs)
  gatePasses: [
    { walls: [[-23, 7, -23, 11], [-23, 25, -23, 28]], rocks: [[-23, 4, 4, 3], [-23, 31, 4, 3]], lamps: [[-20, 16], [-20, 20], [-27, 16], [-27, 20]],
      arch: { at: [-24, 17, -22, 19], face: 'e' },
      banners: [[-21, 15], [-21, 21]], wardens: [[-19, 16], [-19, 20]], sign: [-28, 15, 'Bellhaven. Lay down your quarrels at the gate: inside it, you are safe.'] },
    { walls: [[41, -8, 45, -8], [59, -8, 63, -8]], rocks: [[38, -8, 3, 4], [66, -8, 3, 4]], lamps: [[50, -5], [54, -5], [50, -11], [54, -11]],
      arch: { at: [51, -9, 53, -7], face: 's' },
      banners: [[49, -6], [55, -6]], wardens: [[50, -4], [54, -4]], sign: [55, -13, 'Bellhaven, below. The temple bell can be heard from here at dawn.'] },
  ],
  // the courtyard's and the harbour's life: who's there, and what lies about (town-art coordinates)
  townsfolk: [['bell_market', 18, 17], ['townsman', 30, 21], ['cat', 33, 16], ['dog', 22, 22], ['bell_harbour', 31, 35], ['bell_fisher', 22, 39], ['fisher', 34, 39]],
  // the temple's hill is rock, not lawn: a paved walk over it (town-art coordinates, by floor: 1 the terrace, 2 the
  // temple's own rock) and grass only round the graves
  templeWalk: (x, y, k) => (k === 2 ? y === 9 && x >= 25 && x <= 29
    : (y === 11 && x >= 19 && x <= 37) || (y === 12 && x >= 25 && x <= 37) || (y === 10 && (x === 25 || x === 29 || x >= 35 && x <= 38))), // (two wide from the steps over to the bell tower)
  graveyard: (x, y) => x >= 15 && x <= 20 && y >= 3 && y <= 10,
  // the fountain: the courtyard's heart, in a square of light paving framed by cobbles, a lamp at each corner
  fountainRing: [27, 17, 2],
  // the way up to the temple: banners either side of the steps from the courtyard, lamps either side of its door
  templeWay: [[25, 13, 8, 'flagpole'], [29, 13, 8, 'flagpole'], [24, 9, 10, 'lamppost'], [30, 9, 10, 'lamppost']],
  // what stands outside each kind of building, either side of its door, so you can tell from the street what it is
  frontProps: { smithy: ['anvil', 'woodpile'], inn: ['barrel', 'bench'], store: ['crate', 'sack'], healer: ['planter', 'planter'], depot: ['crate', 'barrel'],
    hall: ['flagpole', 'flagpole'], fish: ['fish_rack', 'basket'], warehouse: ['crate', 'barrel'], office: ['barrel', 'crate'] },
  // the town's streets (town-art coordinates, [x0, y0, x1, y1], cobbled): the main street from the temple's steps down
  // to the quay; the cross street from the west gate through the courtyard to the east way out; a lane down each side
  // of the courtyard past the doors there, and short lanes to the doors further off. Every door opens onto one.
  streets: [
    [26, 13, 28, 35],                                  // main street: the temple's steps, the courtyard, the quay
    [0, 17, 59, 18],                                   // cross street: the west gate, the courtyard, the east way out
    [15, 12, 15, 30], [15, 23, 25, 23], [15, 30, 25, 30], // the west lane past the depot, inn and house; to the smithy and the warehouse
    [39, 12, 39, 29], [40, 15, 41, 15], [29, 23, 38, 23], // the east lane past the store and the house; to the healer
    [40, 12, 53, 12], [52, 12, 53, 16],                // from the north gate's road round to the east lane and down to the cross street
    [51, 0, 53, 11],                                   // the road up the gorge to the north gate
    [14, 27, 14, 27], [40, 34, 40, 34],                // the last steps to the house's and the fishmonger's doors
    [38, 19, 38, 29],                                  // the east lane two wide below the cross street
    [2, 35, 11, 36],                                   // the quay on west along the shore
  ],
  // ground cut out of the rock for a way through it (town-art coordinates): the east way out
  cuts: [[52, 17, 60, 18]],
  // the piers: what each is for, on a signpost at its foot (town-art coordinates)
  piers: [[20, 36, 'Fishing pier. Old Tam knows where the fish are.'], [35, 36, 'Ferry pier. The ship to the mainland ties up here, when it comes.']],
  // out of the west gate: the cobbles give way to earth as the road leaves the town, the wilds grow thicker the further
  // you go, and a short walk down the road lies the first hunting ground, the abandoned Farrow farm (island coordinates)
  westWild: { fade: 9, grow: 40 },
  crossroads: { off: 7, sign: 'North: the Old Wood (wolves - go in pairs). West: Old Farrow\'s farm (rats). South: the shore path to the fields.' },
  farrow: { yard: [24, 116, 38, 127], fields: [[9, 114, 21, 129]], gaps: [[38, 124], [38, 125], [24, 121], [21, 121], [15, 129]],
    path: [[27, 124], [28, 124], [29, 124], [30, 124], [31, 124], [32, 124], [33, 124], [34, 124], [35, 124], [36, 124], [37, 124], [22, 121], [23, 121]],
    barn: [32, 117, 37, 121], props: [[29, 126, 'well'], [26, 126, 'woodpile'], [31, 126, 'wagon'], [34, 126, 'haystack'], [35, 126, 'haystack'], [25, 117, 'barrel'], [15, 122, 'scarecrow']],
    sign: [39, 122, 'Old Farrow\'s farm. Abandoned since the rats moved in: rats in the barn and the fields, rabbits after the crops. Good practice, the wardens say.'],
    monsters: [['rat', 3, [33, 118, 34, 121]], ['rat', 4, [10, 115, 20, 128]], ['rabbit', 5, [10, 115, 20, 128]]] },
  terrace: [[24, 10, 'statue'], [30, 10, 'statue'], [23, 12, 'planter'], [31, 12, 'planter'], [20, 12, 'planter'], [34, 12, 'planter']],
  // the island's regions: centre, radii, what grows there and what lives there (spawns are the game's own monsters;
  // deer, snakes and sheep come once they have pictures)
  regions: {
    peaks: { c: [100, 30], r: [48, 16], kind: 'peaks', game: [['wolf', 3]] },
    oldwood: { c: [45, 70], r: [28, 26], kind: 'forest', game: [['wolf', 14], ['bear', 2], ['spider', 6]] },
    stones: { c: [160, 62], r: [30, 22], kind: 'moor', game: [['rabbit', 6]] },
    goblin: { c: [38, 128], r: [24, 26], kind: 'hills', game: [['rabbit', 4]] },
    mire: { c: [168, 115], r: [24, 20], kind: 'marsh', game: [['crab', 6]] },
    fields: { c: [55, 172], r: [24, 12], kind: 'fields', game: [['rabbit', 14]] },
    cape: { c: [178, 165], r: [18, 10], kind: 'cape', game: [['crab', 8]] },
  },
  // the town's buildings (town-art coordinates): boxes (outer walls), the door, what kind (it decides the furniture),
  // floors, and stairs up ([x, y] on each floor but the top, down again from the tile east of it)
  buildings: [ // (the harbour's three close the town's south side: no wall needed)
    { name: 'Temple', boxes: [[23, 3, 31, 8], [25, 1, 29, 3]], door: [27, 8], kind: 'temple', rock: 2, wall: 'wall_stone', floor: 'temple_paving', roof: 'roof_slate' },
    { name: 'Bell tower', boxes: [[35, 4, 39, 9]], door: [37, 9], kind: 'tower', rock: true, wall: 'wall_stone', floor: 'wood', roof: 'roof_slate', floors: 4, up: [[36, 5], [36, 7], [36, 5]] },
    { name: 'Hall of Paths', boxes: [[42, 4, 50, 11]], door: [46, 11], kind: 'hall', wall: 'wall_stone', floor: 'tiles', roof: 'roof_slate' },
    { name: 'Depot', keeper: 'bell_bank', boxes: [[7, 11, 14, 16]], door: [14, 13], kind: 'depot', wall: 'wall_stone', floor: 'marble', roof: 'roof_slate', floors: 2, up: [[8, 12]],
      upstairs: [['depot', 'depot', 'depot', 'depot', 'depot', 'plant']] }, // (more lockers upstairs)
    { name: 'General store', keeper: 'bell_store', boxes: [[42, 13, 50, 18]], door: [42, 15], kind: 'store', wall: 'wall_wood', floor: 'wood', roof: 'roof_shingle',
      cellar: { stairs: [48, 14], monsters: [['rat', 3]], props: [[43, 16, 'crate'], [44, 17, 'barrel'], [47, 17, 'sack'], [43, 14, 'crate']], torch: [45, 13] } }, // (its storeroom: rats in it)
    { name: 'Inn: The Cracked Bell', keeper: 'bell_inn', boxes: [[6, 19, 14, 24]], door: [14, 22], kind: 'inn', wall: 'wall_wood', floor: 'wood', roof: 'roof_shingle', floors: 2, up: [[7, 20]],
      upstairs: [['bed_head', 'bed_head', 'chest', 'bed_head', 'bed_head', 'plant']] }, // (rooms upstairs)
    { name: 'Smithy', keeper: 'bell_smith', boxes: [[16, 24, 23, 29]], door: [20, 24], kind: 'smithy', wall: 'wall_stone', floor: 'brick', roof: 'roof_slate' },
    { name: 'Healer', keeper: 'bell_healer', boxes: [[31, 24, 37, 28]], door: [34, 24], kind: 'healer', wall: 'wall_stone', floor: 'wood', roof: 'roof_slate', floors: 2, up: [[32, 25]],
      upstairs: [['bed_head', 'plant', 'bed_head', 'chest']] }, // (the sickroom upstairs)
    { name: 'House', boxes: [[8, 26, 13, 29]], door: [13, 27], kind: 'house', wall: 'wall_wood', floor: 'wood', roof: 'roof_thatch' },
    { name: 'House', boxes: [[40, 21, 46, 26]], door: [40, 23], kind: 'house', wall: 'wall_wood', floor: 'wood', roof: 'roof_thatch' },
    { name: 'Warehouse', boxes: [[12, 31, 24, 34]], door: [20, 31], kind: 'warehouse', wall: 'wall_wood', floor: 'wood', roof: 'roof_shingle' },
    { name: 'Harbour master', boxes: [[29, 30, 35, 34]], door: [32, 34], kind: 'office', wall: 'wall_stone', floor: 'wood', roof: 'roof_slate', floors: 3, up: [[30, 31], [30, 33]],
      upstairs: [['table', 'chest', 'bookshelf'], ['chest']] }, // (his rooms, and a lookout over the bay at the top)
    { name: 'Fishmonger', boxes: [[37, 30, 44, 33]], door: [40, 33], kind: 'fish', wall: 'wall_wood', floor: 'wood', roof: 'roof_shingle' },
    // the gates' watchtowers, out on the roads: two storeys and a lookout on top
    { name: 'West gate, north tower', boxes: [[-25, 12, -21, 16]], door: [-23, 16], kind: 'gatehouse', wall: 'wall_stone', floor: 'wood', roof: 'roof_slate', floors: 3, up: [[-24, 13], [-24, 15]] },
    { name: 'West gate, south tower', boxes: [[-25, 20, -21, 24]], door: [-23, 20], kind: 'gatehouse', wall: 'wall_stone', floor: 'wood', roof: 'roof_slate', floors: 2, up: [[-24, 22]] },
    { name: 'North gate, west tower', boxes: [[46, -10, 50, -6]], door: [50, -8], kind: 'gatehouse', wall: 'wall_stone', floor: 'wood', roof: 'roof_slate', floors: 3, up: [[47, -9], [47, -7]] },
    { name: 'North gate, east tower', boxes: [[54, -10, 58, -6]], door: [54, -8], kind: 'gatehouse', wall: 'wall_stone', floor: 'wood', roof: 'roof_slate', floors: 2, up: [[55, -9]] },
    // out in the wilds: Old Farrow's farmhouse, west of the west gate (its yard, fields and barn: farrow, below)
    { name: 'Farrow farmhouse', keeper: 'farrow', boxes: [[-47, 9, -42, 14]], door: [-45, 14], kind: 'farmhouse', wall: 'wall_wood', floor: 'wood', roof: 'roof_thatch' },
  ],
  // the sign beside each door (by kind), and what it says when you look at it
  signs: {
    temple: ['sign_temple', 'The Temple of the Bell. You wake here when you come to Kestrel Isle, and again whenever you die. Nobody can fight inside a temple.'],
    tower: ['sign_temple', 'The Bell Tower of Bellhaven, the highest point of the town. Climb it, and the whole isle lies below you.'],
    hall: ['sign_school', 'The Hall of Paths. Four paths, four teachers: come and try them all before you choose.'],
    depot: ['sign_depot', 'Depot. Put things in a locker to keep them safe: your locker is yours for good.'],
    smithy: ['sign_weapons', 'The smithy. Weapons made and mended.'], shop: ['sign_armour', 'Arms and armour, bought and sold.'],
    store: ['sign_tools', 'General store: rope, shovels, food, backpacks, all you need out there.'], bakery: ['sign_food', 'The bakery. Fresh bread every morning.'],
    healer: ['sign_magic', 'The healer. Potions, and a bed when you need one.'], gatehouse: ['sign_wall', 'A gate of Bellhaven. Up the stairs to the lookout.'], inn: ['sign_inn', 'The Cracked Bell: food, drink and a bed.'],
    fish: ['sign_food', 'Fresh fish, caught this morning in the bay.'], office: ['sign_wall', 'The harbour master. Ships to the mainland - when you are ready.'],
  },
  // what goes inside, by kind: things set along the walls (away from the door), in turn
  furnish: {
    temple: [], tower: [], hall: [], // (laid out by hand: see the Hall of Paths, below)
    depot: ['depot', 'depot', 'depot', 'depot', 'depot', 'depot', 'plant'], smithy: ['anvil', 'barrel', 'crate', 'firewood', 'anvil', 'woodpile', 'barrel'],
    shop: ['counter', 'counter', 'counter', 'crate', 'barrel'], store: ['counter', 'counter', 'counter', 'barrel', 'barrel', 'sack', 'basket', 'crate', 'sack'],
    bakery: ['counter', 'counter', 'sack', 'basket', 'barrel'], healer: ['bed_head', 'plant', 'bed_head', 'chest'],
    inn: ['counter', 'counter', 'counter', 'barrel', 'barrel', 'table', 'table', 'table', 'plant'], house: ['bed_head', 'chest', 'table', 'plant'],
    workshop: ['barrel', 'crate', 'woodpile', 'barrel', 'sack'], warehouse: ['crate', 'crate', 'barrel', 'barrel', 'crate', 'sack', 'barrel', 'crate'],
    fish: ['fish_rack', 'barrel', 'counter', 'counter', 'basket'], office: ['table', 'chest', 'bookshelf'], gatehouse: ['barrel'], farmhouse: ['bed_head', 'table', 'chest', 'barrel'],
  },
  // the Hall of Paths' four practice rooms, one floor down (town-art coordinates of the first room's corner, walls
  // included; the others follow it eastward): reached only through a teacher (game-paths.js), left by a forcefield
  trials: { at: [62, 2], size: 9, order: ['knight', 'paladin', 'sorcerer', 'druid'],
    pillar: { knight: 'pillar_amethyst', paladin: 'pillar_emerald', sorcerer: 'pillar_terracotta', druid: 'pillar_royalblue' },
    teacher: { knight: 'holt', paladin: 'sill', sorcerer: 'vela', druid: 'fennick' } }, // (as in PATHS, game-paths.js)
  // the sewers under Bellhaven (one floor down, town-art coordinates): the first hunt, as under every town worth the
  // name. Grates in the streets with ladders under them; brick walkways round a channel; the bell cellar under the
  // temple, where Clang is stuck behind a fallen crate (The Silent Bell's 'Clang'); the rats' nest east of Main Street.
  sewers: {
    rooms: [[19, 2, 35, 9, 'paving'], [23, 14, 31, 19, 'sewer']],                   // the bell cellar; the chamber under the courtyard
    nest: [43, 30, 5, 3],                                                           // the rats' nest, a cave they dug: centre, radii
    tunnels: [ // [points], width, a channel down the middle
      [[[27, 9], [27, 14]], 2], [[[27, 19], [27, 33]], 3, true],
      [[[23, 17], [10, 17]], 2], [[[31, 16], [40, 13]], 2], [[[28, 26], [39, 29]], 2], [[[27, 32], [18, 32]], 2]],
    grates: [[25, 19], [27, 30], [10, 17], [40, 13]],
    hatches: [[18, 32]], // (a trapdoor in the warehouse's floor)
    rats: 12, cellarRats: 3, bigRats: 2,
    props: [[34, 6, 'clang_crate'], [32, 6, 'crate'], [20, 3, 'web'], [30, 3, 'web'], [27, 8, 'rubble'], [22, 5, 'bones'], [45, 31, 'bones'], [41, 29, 'rubble'], [27, 33, 'bars']],
  },
  // out in the town (town-art coordinates)
  outside: [[27, 17, 'fountain_nw'], [28, 17, 'fountain_ne'], [27, 18, 'fountain_sw'], [28, 18, 'fountain_se'], [23, 17, 'bench'], [32, 17, 'bench'], [25, 15, 'lamppost'], [30, 15, 'lamppost'], [25, 20, 'lamppost'], [30, 20, 'lamppost'],
    [17, 16, 'stall'], [17, 18, 'basket'], [17, 20, 'stall'], [39, 17, 'stall'], [39, 19, 'basket'], [38, 21, 'stall'], [20, 15, 'planter'], [35, 15, 'planter'], [13, 35, 'barrel'], [14, 35, 'crate'], [13, 36, 'crate'], [14, 36, 'barrel'], [16, 36, 'sack'], [17, 36, 'sack'],
    [24, 36, 'fish_rack'], [37, 36, 'fish_rack'], [42, 35, 'crate'], [43, 35, 'crate'], [43, 36, 'barrel'], [42, 36, 'sack'], [45, 35, 'barrel'], [46, 36, 'crate'],
    [23, 38, 'boat'], [35, 39, 'boat'], [20, 40, 'boat'], [29, 36, 'crane']],
};

// (in the preview, Clang can be rescued from the start: on the old island he came after The Silent Bell I)
// In the preview, the start as Kestrel Isle has it: Clang is the first thing Sister Ama asks of you (no bell before it,
// no level to reach first), and she speaks of Bellhaven and the Hall of Paths, not of Oakvale and its oracle.
if (typeof WORLD_PREVIEW !== 'undefined' && WORLD_PREVIEW === 'kestrel' && typeof QUESTS !== 'undefined' && QUESTS.clang_rescue) {
  delete QUESTS.clang_rescue.after;
  QUESTS.clang_rescue.level = 1;
  QUESTS.clang_rescue.text.tooWeak = QUESTS.clang_rescue.text.accept;
  const ama = NPCS.ama;
  ama.greet = 'Peace be with you, $name. The sea brought you to Kestrel Isle, and you woke in our temple, in {Bellhaven}. Our cat {Clang} is lost under the town - would you help? And if you are hurt, I can {heal} you.';
  Object.assign(ama.keywords, {
    'bellhaven|town|kestrel|isle': 'Bellhaven is small, but it is home. The square is just below the temple steps; the Hall of Paths stands on it, and the shops line the streets round it. Beyond the walls: rabbits and rats first, then worse.',
    'oracle|vocation|mainland|path|paths|hall': 'Every adventurer walks one of four paths. Pathkeeper Ilse in the {Hall} of Paths, on the square, will show you all four - and let you try them.',
    'job': 'I keep the temple. Everyone who washes up on Kestrel Isle wakes here first - and again after each death.',
  });
  delete ama.keywords['happened|fight|quest|mission|task|help|farewell|goodbye']; delete ama.keywords['host|hollow|monsters|war|world'];
  ama.keywords['clang|cat|kitten|quest|mission|task|cellar'] = { quest: ['clang_rescue'] }; delete ama.keywords['clang|cat|kitten'];
  delete ama.keywords.oakvale; delete ama.keywords['academy|corwin|teacher']; delete ama.keywords.depot; delete ama.keywords['mirror|lake|shrine|water|flask'];
}

function createKestrelMap() {
  const { width: W, height: H, depth: D, surfaceZ: S } = WORLD_SIZE;
  const m = new GameMap(W, H, D, S);
  const K = KESTREL, N = K.isle, [OX, OY] = K.isleAt, [TX, TY] = K.townAt, TW = KESTREL_TOWN_ART[0].length, TH = KESTREL_TOWN_ART.length;
  const hash = (x, y, s) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const smooth = (x, y, sc, s) => {
    const fx = x / sc, fy = y / sc, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  // island coordinates: (x, y) on the island is (OX + x, OY + y) in the world
  const at = (x, y, z = S) => m.get(OX + x, OY + y, z);
  const set = (x, y, z, ground, items = []) => m.set(OX + x, OY + y, z, { ground, items: [...items] });
  const art = (x, y) => { const r = KESTREL_TOWN_ART[y - TY]; return r && x >= TX && x - TX < r.length ? r[x - TX] : ' '; };
  const inReg = (R, x, y) => Math.hypot((x - R.c[0]) / R.r[0], (y - R.c[1]) / R.r[1]) + (smooth(x, y, 6, 5) - 0.5) * 0.4 < 1;

  // ---- the island: a ragged shape, a wide harbour bay below the town, a cape to the south-east ----
  const land = (x, y) => {
    const r = Math.hypot((x - 105) / 92, (y - 100) / 90) + (smooth(x, y, 14, 1) - 0.5) * 0.35 + (smooth(x, y, 5, 2) - 0.5) * 0.08;
    const bay = Math.hypot((x - 100) / 25, (y - 164) / 18) < 1, cape = y > 150 && Math.hypot((x - 175) / 26, (y - 165) / 12) < 1;
    return (r < 1 || cape) && !bay;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m.set(x, y, S, { ground: 'water', items: [] });
  // rock formations: fewer and bigger than scattered slabs - each two to four lobes grown together with a ragged edge,
  // their hearts a floor higher still (rocky: tile -> 1 or 2 floors); none in or round the town, nor at the west gate
  const rocky = new Map(), [wgx, wgy] = [TX + K.gates[0][0], TY + K.gates[0][1]];
  for (let i = 0, k = 0; i < 26 && k < 4000; k++) {
    const x = 10 + Math.floor(hash(k, 1, 61) * (N - 20)), y = 10 + Math.floor(hash(k, 2, 61) * (N - 20));
    if (!land(x, y) || Math.hypot((x - TX - TW / 2) / 40, (y - TY - TH / 2) / 30) < 1.1 || Math.hypot(x - wgx, y - wgy) < 22) continue;
    i++;
    const big = inReg(K.regions.goblin, x, y) || inReg(K.regions.peaks, x, y) || y < 50, s0 = big ? 1.4 : 1;
    const lobes = [[x, y, (4 + hash(k, 3, 61) * 3) * s0, (3 + hash(k, 4, 61) * 2) * s0]];
    for (let j = 1, n = 2 + Math.floor(hash(k, 5, 61) * 3); j < n; j++) {
      const [px, py, prx, pry] = lobes[Math.floor(hash(k, j, 62) * lobes.length)], a = hash(k, j, 63) * 6.283;
      lobes.push([px + Math.cos(a) * prx * 0.9, py + Math.sin(a) * pry * 0.9, prx * (0.6 + hash(k, j, 64) * 0.3), pry * (0.6 + hash(k, j, 65) * 0.3)]);
    }
    for (const [lx, ly, rx, ry] of lobes) for (let yy = Math.floor(ly - ry - 2); yy <= ly + ry + 2; yy++) for (let xx = Math.floor(lx - rx - 2); xx <= lx + rx + 2; xx++) {
      const d = Math.hypot((xx - lx) / rx, (yy - ly) / ry) + (smooth(xx, yy, 2, 9) - 0.5) * 0.45 + (smooth(xx, yy, 5, 10) - 0.5) * 0.3;
      if (!land(xx, yy) || d >= 1) continue;
      rocky.set(`${xx},${yy}`, Math.max(rocky.get(`${xx},${yy}`) || 0, big && d < 0.45 ? 2 : 1));
    }
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!land(x, y)) continue;
    const R = K.regions, k = `${x},${y}`, tree = hash(x, y, 8);
    let ground = 'grass', item = null;
    if (inReg(R.peaks, x, y) && smooth(x, y, 5, 11) > 0.3) { set(x, y, S, 'mountain', ['cliff']); set(x, y, S + 1, smooth(x, y, 4, 12) > 0.55 ? 'mountain' : 'rock_top', smooth(x, y, 4, 12) > 0.55 ? ['cliff'] : []); if (smooth(x, y, 4, 12) > 0.55) set(x, y, S + 2, 'rock_top'); continue; }
    if (rocky.has(k)) { set(x, y, S, 'mountain', ['cliff']); const top = smooth(x, y, 4, 73) > 0.5 ? 'grass' : 'rock_top'; // (partly grown over: grass in patches on the tops)
      if (rocky.get(k) === 2) { set(x, y, S + 1, 'mountain', ['cliff']); set(x, y, S + 2, top); } else set(x, y, S + 1, top); continue; }
    if (inReg(R.mire, x, y)) { const w = smooth(x, y, 3, 4); ground = w < 0.35 ? 'water' : 'swamp'; item = ground === 'swamp' && tree < 0.15 ? 'reeds' : null; }
    else if (inReg(R.fields, x, y) && smooth(x, y, 4, 3) > 0.45) { ground = 'farmland'; item = (y % 2) && tree < 0.7 ? 'crops' : null; }
    else if (inReg(R.oldwood, x, y) && smooth(x, y, 2, 6) > 0.35) item = tree < 0.32 ? (tree < 0.08 ? 'pine' : 'tree') : tree < 0.5 ? 'bush' : null; // (a wood, not a wall of trees: every tree costs drawing)
    else if (inReg(R.cape, x, y)) { ground = smooth(x, y, 3, 14) > 0.5 ? 'sand' : 'grass'; item = tree < 0.04 ? 'bush' : null; }
    else { // woods, wood edges and open meadow, by a slow field: thicker to the north, open round the town and the west gate
      const open = Math.max(0, 1 - Math.hypot(x - wgx, y - wgy) / 18) + Math.max(0, 1.3 - Math.hypot((x - TX - TW / 2) / 40, (y - TY - TH / 2) / 30));
      const wood = smooth(x, y, 13, 7) + (y < 100 ? 0.12 : 0) - open * 0.6;
      if (wood > 0.66) item = tree < 0.34 ? (tree < 0.1 ? 'pine' : 'tree') : tree < 0.46 ? 'bush' : tree < 0.52 ? 'fern' : null;
      else if (wood > 0.55) item = tree < 0.1 ? 'tree' : tree < 0.18 ? 'bush' : tree < 0.24 ? 'tallgrass' : null;
      else item = tree < 0.012 ? 'tree' : tree < 0.04 ? 'bush' : tree < 0.09 ? 'tallgrass' : tree < 0.14 ? 'flowers' : tree < 0.17 ? 'grass_tuft' : null;
    }
    set(x, y, S, ground, item ? [item] : []);
  }
  // sand along the shore
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const t = at(x, y);
    if (t && t.ground === 'grass' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (at(x + dx, y + dy) || {}).ground === 'water' && !inReg(K.regions.mire, x + dx, y + dy)) && smooth(x, y, 4, 15) > 0.35) { t.ground = 'sand'; t.items = t.items.filter(id => id !== 'tree'); }
  }
  // the river from the peaks down to the town's west side; a lake in the north-east, and its brook down past the town
  const water = (pts, w, wob) => {
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2;
      for (let t = 0; t <= n; t++) {
        let x = ax + (bx - ax) * t / n, y = ay + (by - ay) * t / n;
        x += (smooth(x, y, 9, 21) - 0.5) * wob;
        for (let dx = -w; dx <= w; dx++) { const tt = at(Math.round(x + dx), Math.round(y)); if (tt && tt.ground !== 'water') { tt.ground = 'water'; tt.items = hash(x + dx | 0, y | 0, 23) < 0.06 ? ['reeds'] : []; } }
      }
    }
  };
  water([[84, 44], [78, 54], [66, 60], [56, 66]], 1, 5);
  for (let y = 86; y <= 98; y++) for (let x = 130; x <= 156; x++) if (Math.hypot((x - 142) / 10, (y - 92) / 6) + (smooth(x, y, 3, 25) - 0.5) * 0.3 < 1) set(x, y, S, 'water', hash(x, y, 26) < 0.06 ? ['lilypad'] : []);
  water([[141, 98], [141, 65]], 1, 2); water([[144, 143], [132, 150], [122, 154]], 1, 3);

  // ---- Bellhaven: the town's art, tile by tile ----
  const Z1 = S + 1, plateau = new Set();
  const rockOf = b => (b.rock === true ? 1 : b.rock || 0); // (how many floors up a building on the rock stands)
  const onRock = (ax, ay) => K.buildings.some(b => b.rock && b.boxes.some(([x0, y0, x1, y1]) => ax >= x0 && ax <= x1 && ay >= y0 && ay <= y1)); // (the temple and its tower stand on the rock)
  const onHigh = (ax, ay) => K.buildings.some(b => rockOf(b) === 2 && b.boxes.some(([x0, y0, x1, y1]) => ax >= x0 && ax <= x1 && ay >= y0 && ay <= y1));
  // (a tile of the temple rock that sticks out alone, joined to the rest by a side at most, is just grass)
  const artAt = (ax, ay) => (KESTREL_TOWN_ART[ay] || '')[ax] || ' ';
  const stub = (ax, ay) => artAt(ax, ay) === 'r' && !onRock(ax, ay) && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => 'rsxWf+'.includes(artAt(ax + dx, ay + dy))).length < 2;
  for (let ay = 0; ay < KESTREL_TOWN_ART.length; ay++) for (let ax = 0; ax < KESTREL_TOWN_ART[ay].length; ax++) {
    const inBuilding = K.buildings.some(b => b.boxes.some(([x0, y0, x1, y1]) => ax >= x0 && ax <= x1 && ay >= y0 && ay <= y1));
    const ch = stub(ax, ay) || (KESTREL_TOWN_ART[ay][ax] === 'f' && !inBuilding) ? '.' : KESTREL_TOWN_ART[ay][ax], x = TX + ax, y = TY + ay; // (a floor with no building on it any more: grass)
    if (ch === ' ') continue;
    // (the art's sea below the quay: only the harbour, a rounded basin opening into the bay; the rest is the island's)
    if (ch === '~' && ay >= K.harbourRow && Math.hypot((x - TX - TW / 2) / 31, (y - TY - K.harbourRow - 3) / 8) + (smooth(x, y, 4, 27) - 0.5) * 0.25 > 1) continue;
    const g = { '.': 'grass', '~': 'water', '=': 'cobble', ':': 'dirt', '_': 'paving', '#': 'grass', p: 'pier', f: 'wood', t: 'grass' }[ch];
    if (ch === 'R') { // rock: away from the town's ground, now and then a second step up (the hill rising, not a flat rim)
      set(x, y, S, 'mountain', ['cliff']);
      const byTown = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1], [2, 0], [-2, 0], [0, 2], [0, -2]].some(([dx, dy]) => '._=:f#tsrhux~p'.includes(artAt(ax + dx, ay + dy)) && artAt(ax + dx, ay + dy) !== ' ');
      // partly green: the higher knolls bare rock, the lower tops grass, with a few big bare patches (whole patches, not
      // tile by tile: a mix tile by tile draws a maze of edges)
      const far = ![...Array(9)].some((_, i) => [...Array(9)].some((__, j) => '._=:f#tsrhuxp'.includes(artAt(ax + i - 4, ay + j - 4)) && artAt(ax + i - 4, ay + j - 4) !== ' '));
      if (!byTown && smooth(x, y, 3, 77) > 0.45) {
        set(x, y, Z1, 'mountain', ['cliff']);
        if (far && smooth(x, y, 2, 78) > 0.55) { set(x, y, Z1 + 1, 'mountain', ['cliff']); set(x, y, Z1 + 2, 'rock_top'); } // (a crag a floor higher still, far from the streets)
        else set(x, y, Z1 + 1, smooth(x, y, 3, 84) > 0.5 ? 'grass' : 'rock_top');
      }
      else if (smooth(x, y, 6, 83) > 0.62) set(x, y, Z1, 'rock_top');
      else { set(x, y, Z1, 'grass'); const r = hash(x, y, 79); at(x, y, Z1).items = r < 0.06 ? ['bush'] : r < 0.11 ? ['flowers'] : r < 0.16 ? ['grass_tuft'] : []; }
      continue;
    }
    if (ch === 'h' || ch === 'u' || onHigh(ax, ay)) { // the higher rock: cliffs two floors tall, grass on top; its steps up from the terrace
      plateau.add(`${x},${y}`);
      set(x, y, S, 'mountain', ['cliff']);
      set(x, y, Z1, 'mountain', ch === 'u' ? ['steps'] : ['cliff']);
      set(x, y, Z1 + 1, ch === 'u' ? 'steps_top' : K.templeWalk(ax, ay, 2) ? 'paving' : 'grass'); // (green up there, a paved forecourt)
      continue;
    }
    if (ch === 'r' || ch === 'x' || ch === 's' || onRock(ax, ay)) {
      plateau.add(`${x},${y}`);
      set(x, y, S, 'mountain', ['cliff']);
      set(x, y, Z1, K.templeWalk(ax, ay, 1) ? 'paving' : 'grass', ch === 'x' ? ['gravestone'] : []); // (a green hill, only the walk down it paved)
      if (ch === 's') { set(x, y, S, 'mountain', ['steps']); set(x, y, Z1, 'steps_top'); }
      continue;
    }
    set(x, y, S, g || 'grass', ch === '#' ? ['wall_stone'] : ch === 't' ? ['tree'] : []);
    if (ch === '.' && hash(x, y, 31) < 0.06) at(x, y).items.push(hash(x, y, 32) < 0.5 ? 'flowers' : 'grass_tuft');
  }
  // (no trees scattered in the town: the few it has are in its art, t)

  // the roads out to the gates, paved, and the ground under the gates' towers cleared (no rock, no tree, nothing above)
  const clear = (x, y, ground) => { set(x, y, S, ground); for (let z = S + 1; z <= S + 3; z++) m.set(OX + x, OY + y, z, null); };
  for (const [x0, y0, x1, y1] of K.approaches) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) clear(TX + x, TY + y, 'cobble');
  for (const b of K.buildings.filter(o => o.kind === 'gatehouse')) for (const [x0, y0, x1, y1] of b.boxes) for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) {
    const t = at(TX + x, TY + y); if (!t || t.ground !== 'cobble') clear(TX + x, TY + y, 'grass');
  }

  // the gates' passes: rock outcrops, walls from the towers out to them (built before the towers: these are open ground)
  for (const g of K.gatePasses) {
    for (const [cx, cy, rx, ry] of g.rocks) for (let y = cy - ry - 1; y <= cy + ry + 1; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++)
      if (Math.hypot((x - cx) / rx, (y - cy) / ry) + (smooth(TX + x, TY + y, 2, 81) - 0.5) * 0.5 < 1) { set(TX + x, TY + y, S, 'mountain', ['cliff']); set(TX + x, TY + y, S + 1, 'rock_top'); }
    for (const [x0, y0, x1, y1] of g.walls) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { set(TX + x, TY + y, S, 'grass', ['wall_stone']); for (let z = S + 1; z <= S + 2; z++) m.set(OX + TX + x, OY + TY + y, z, null); }
  }

  // the streets, cut through the rock where they must, cobbled over grass and earth (not over the courtyard's paving,
  // nor into a building), whatever stood there cleared away
  const inAnyBuilding = (x, y) => K.buildings.some(b => !b.rock && b.boxes.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1));
  for (const [x0, y0, x1, y1] of K.cuts) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { set(TX + x, TY + y, S, 'grass'); for (let z = S + 1; z <= S + 3; z++) m.set(OX + TX + x, OY + TY + y, z, null); }
  const onStreet = (x, y) => K.streets.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
  for (const [x0, y0, x1, y1] of K.streets) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const t = at(TX + x, TY + y);
    if (!t || inAnyBuilding(x, y) || t.items.includes('cliff') || t.items.includes('steps') || ['paving', 'marble', 'water', 'pier'].includes(t.ground)) continue;
    t.ground = 'cobble'; t.items = t.items.filter(i => /^wall_/.test(i) ? false : !THINGS[i].block && !['bush', 'tree', 'flowers', 'grass_tuft', 'tallgrass'].includes(i));
  }

  // a tile of open grass all round every building (not its gates' towers, which their walls join): no rock or cliff
  // against its walls, and on the rock the plateau runs on round it
  for (const b of K.buildings) {
    if (b.kind === 'gatehouse') continue;
    const lv = rockOf(b), inB = (x, y) => b.boxes.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
    for (const [x0, y0, x1, y1] of b.boxes) for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) {
      if (inB(x, y)) continue;
      const X = TX + x, Y = TY + y, t = at(X, Y, S + lv);
      if (lv === 0 && t && t.items.includes('cliff')) { set(X, Y, S, 'grass'); for (let z = S + 1; z <= S + 3; z++) m.set(OX + X, OY + Y, z, null); }
      else if (lv > 0 && (!t || t.items.includes('cliff'))) { for (let z = S; z < S + lv; z++) set(X, Y, z, 'mountain', ['cliff']); set(X, Y, S + lv, 'grass'); }
    }
  }

  // the buildings: walls (windows on straight runs), floors, a door, upper floors and stairs, a roof, furniture
  const homes = [];
  for (const b of K.buildings) {
    const level = rockOf(b), Z = S + level, floors = b.floors || 1;
    const inB = (x, y) => b.boxes.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
    const rim = (x, y) => inB(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => !inB(x + dx, y + dy));
    const tiles = [];
    for (const [x0, y0, x1, y1] of b.boxes) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!tiles.some(([a, c]) => a === x && c === y)) tiles.push([x, y]);
    for (let k = 0; k < floors; k++) for (const [x, y] of tiles) {
      const z = Z + k, wx = TX + x, wy = TY + y;
      m.set(OX + wx, OY + wy, z, { ground: k ? 'wood' : b.floor, items: [] });
      if (!rim(x, y)) continue;
      const t = m.get(OX + wx, OY + wy, z);
      t.items.push(b.wall);
      const straight = (rim(x - 1, y) && rim(x + 1, y)) || (rim(x, y - 1) && rim(x, y + 1)), along = rim(x - 1, y) && rim(x + 1, y) ? x : y;
      if (straight && along % 3 === 0 && Math.abs(x - b.door[0]) + Math.abs(y - b.door[1]) > 1) t.items.push('window');
    }
    const T = (x, y, z) => m.get(OX + TX + x, OY + TY + y, z);
    T(b.door[0], b.door[1], Z).items = [b.kind === 'house' ? 'door_house' : 'door'];
    (b.up || []).forEach(([x, y], k) => { T(x, y, Z + k).items.push('stairs_up'); T(x + 1, y, Z + k + 1).items.push('stairs_down'); });
    for (const [x, y] of tiles) if (b.boxes.some(([x0, y0, x1, y1]) => x > x0 && y > y0 && x <= x1 && y <= y1) && inB(x, y - 1) && inB(x - 1, y)) m.set(OX + TX + x, OY + TY + y, Z + floors, { ground: b.roof, items: [] });
    // furniture: along the walls, not in front of the door, the middle kept free to walk
    const inner = tiles.filter(([x, y]) => !rim(x, y));
    const byWall = inner.filter(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => rim(x + dx, y + dy)) && Math.abs(x - b.door[0]) + Math.abs(y - b.door[1]) > 2 && !(b.up || []).some(([sx, sy]) => Math.abs(sx - x) <= 1 && Math.abs(sy - y) <= 1)
      && !(b.cellar && Math.abs(b.cellar.stairs[0] + 1 - x) <= 1 && Math.abs(b.cellar.stairs[1] - y) <= 1));
    // who keeps it (b.keeper): against the back wall, across from the door, behind a counter of three - the customer
    // stays on the door's side and talks over it (the smith has no counter: his hearth stands beside him; a farmer
    // at home has neither); the
    // tiles either side of the keeper stay free, and none of it in the way of the stairs
    if (b.keeper) {
      const [x0, y0, x1, y1] = b.boxes[0], [dx, dy] = b.door, ns = dy === y0 || dy === y1;
      const back = ns ? (dy === y0 ? y1 - 1 : y0 + 1) : (dx === x0 ? x1 - 1 : x0 + 1), front = back + (ns ? (dy === y0 ? -1 : 1) : (dx === x0 ? -1 : 1));
      const [a0, a1] = ns ? [x0 + 1, x1 - 1] : [y0 + 1, y1 - 1], mid = Math.round((a0 + a1) / 2), at2 = (k, a) => (ns ? [a, k] : [k, a]);
      const stairs = [...(b.up || []).slice(0, 1), ...(b.cellar ? [[b.cellar.stairs[0] + 1, b.cellar.stairs[1]]] : [])]; // (on this floor)
      const near = ([x, y], d) => stairs.some(([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) <= d);
      const along = [0, 1, -1, 2, -2].map(o => mid + o).find(a => a - 1 >= a0 && a + 1 <= a1 && !near(at2(back, a), 1) && ![-1, 1].some(o => near(at2(back, a + o), 0)) && ![-1, 0, 1].some(o => near(at2(front, a + o), 1)));
      if (along !== undefined) {
        const smith = b.kind === 'smithy', shop = b.kind !== 'farmhouse', spot = at2(back, along), keep = [spot, at2(back, along - 1), at2(back, along + 1)];
        const counters = smith || !shop ? [] : [-1, 0, 1].map(o => at2(front, along + o));
        for (const [x, y] of counters) T(x, y, Z).items = ['counter'];
        if (smith) T(...at2(back, along + 1), Z).items = ['smith_hearth'];
        m.npcs.push({ type: b.keeper, x: OX + TX + spot[0], y: OY + TY + spot[1], z: Z });
        const taken = [...keep, ...counters, ...(smith ? [at2(front, along), at2(front, along + 1)] : [])];
        for (let i = byWall.length - 1; i >= 0; i--) if (taken.some(([x, y]) => x === byWall[i][0] && y === byWall[i][1])) byWall.splice(i, 1);
      }
    }
    const list = K.furnish[b.kind] || [];
    byWall.sort((a, c) => (a[1] - c[1]) || (a[0] - c[0]));
    const furnish = (list, z, spots) => list.forEach((id, i) => { const p = spots[Math.floor(i * spots.length / Math.max(1, list.length))]; if (p) { const t = T(p[0], p[1], z); if (!t.items.length) t.items.push(id); if (id === 'bed_head') { const f = T(p[0], p[1] + 1, z); if (f && !f.items.length && inner.some(([a, c]) => a === p[0] && c === p[1] + 1)) f.items.push('bed_foot'); else t.items = ['chest']; } } });
    furnish(list, Z, byWall);
    // and the stairs on this floor can still be walked to from the door: whatever stands in the way (furniture first,
    // the end of a counter if it must) makes room
    {
      const stairs = [...(b.up || []).slice(0, 1), ...(b.cellar ? [[b.cellar.stairs[0] + 1, b.cellar.stairs[1]]] : [])], keeper = m.npcs.find(n => n.type === b.keeper && n.z === Z);
      const isK = (x, y) => keeper && keeper.x === OX + TX + x && keeper.y === OY + TY + y, inside = new Set(inner.map(p => p.join()));
      const blocked = (x, y) => isK(x, y) || T(x, y, Z).items.some(i => THINGS[i].block);
      for (let round = 0; round < 12; round++) {
        const seen = new Set([b.door.join()]), todo = [b.door];
        while (todo.length) { const [x, y] = todo.pop(); for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${x + ex},${y + ey}`; if (seen.has(k) || !inside.has(k) || blocked(x + ex, y + ey)) continue; seen.add(k); todo.push([x + ex, y + ey]); } }
        const lost = stairs.find(([x, y]) => ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ex, ey]) => seen.has(`${x + ex},${y + ey}`)));
        if (!lost) break;
        const way = inner.filter(([x, y]) => blocked(x, y) && !isK(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ex, ey]) => seen.has(`${x + ex},${y + ey}`)))
          .sort((p, q) => (T(...p, Z).items.includes('counter') - T(...q, Z).items.includes('counter')) || (Math.hypot(p[0] - lost[0], p[1] - lost[1]) - Math.hypot(q[0] - lost[0], q[1] - lost[1])))[0];
        if (!way) break;
        T(...way, Z).items = [];
      }
    }
    // the floors above: what they hold (b.upstairs, by floor), along the walls, away from the stairs
    (b.upstairs || []).forEach((ids, k) => {
      const z = Z + k + 1, clear = ([x, y]) => !(b.up || []).some(([sx, sy]) => Math.abs(sx - x) <= 1 && Math.abs(sy - y) <= 1) && !T(x, y, z).items.length;
      furnish(ids, z, inner.filter(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => rim(x + dx, y + dy))).filter(clear).sort((a, c) => (a[1] - c[1]) || (a[0] - c[0])));
    });
    // a cellar under it (b.cellar): the building's floor plan a floor down, old brick round it, stairs down by the given
    // spot (down from the tile east of it, up again from the tile itself), and what's kept - or lives - there
    if (b.cellar) {
      const C = b.cellar, Zc = Z - 1, [sx, sy] = C.stairs;
      for (const [x, y] of tiles) m.set(OX + TX + x, OY + TY + y, Zc, rim(x, y) ? { ground: 'sewer', items: ['wall_sewer'] } : { ground: C.floor || 'wood', items: [] });
      T(sx, sy, Zc).items.push('stairs_up'); T(sx + 1, sy, Z).items.push('stairs_down');
      for (const [x, y, id] of C.props || []) { const t = T(x, y, Zc); if (t && !t.items.length) t.items.push(id); }
      for (const [type, n] of C.monsters || []) for (let i = 0; i < n; i++) { const [x, y] = inner[Math.floor((i + 0.5) * inner.length / n)]; m.spawns.push({ type, x: OX + TX + x, y: OY + TY + y, z: Zc }); }
      if (C.torch) T(...C.torch, Zc).items.push('wall_torch');
    }
    // its sign on the wall beside the door; window boxes under the windows of the houses; banners either side of the temple's door
    const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [b.door[0] + dx, b.door[1] + dy]).filter(([x, y]) => rim(x, y) && T(x, y, Z).items.includes(b.wall));
    if (K.signs[b.kind] && beside.length) { const [x, y] = beside[0], [id, text] = K.signs[b.kind], t = T(x, y, Z); t.items = [b.wall, id]; m.setMeta(OX + TX + x, OY + TY + y, Z, { text }); }
    if (b.kind === 'temple') for (const [x, y] of beside) T(x, y, Z).items.push('banner');
    if (b.kind === 'house') for (const [x, y] of tiles) { const t = T(x, y, Z); if (t.items.includes('window')) t.items.push('window_box'); }
    if (b.kind === 'temple') { // the temple: an altar in its apse, saints, pews either side of a carpet up the aisle; you wake here
      const [x0, y0, x1, y1] = b.boxes[0], mid = b.door[0];
      T(mid, b.boxes[1][1] + 1, Z).items.push('altar');
      for (const [x, y, id] of [[mid - 1, b.boxes[1][1] + 1, 'temple_lantern_nw'], [mid + 1, b.boxes[1][1] + 1, 'temple_lantern_ne'], [x0 + 1, y0 + 1, 'saint'], [x1 - 1, y0 + 1, 'saint']]) T(x, y, Z).items.push(id);
      for (let y = y0 + 1; y < y1; y++) { T(mid, y, Z).items.push('carpet_rug'); if ((y - y0) % 2 === 0 && y < y1 - 1) for (const dx of [-5, -4, -3, -2, 2, 3, 4, 5]) if (mid + dx > x0 && mid + dx < x1) T(mid + dx, y, Z).items.push('pew'); }
      m.start = { x: OX + TX + mid, y: OY + TY + y1 - 2, z: Z };
      m.mainStart = { ...m.start };
      m.temples.push({ home: 'bellhaven', town: 'Bellhaven', npc: null, x: m.start.x, y: m.start.y, z: Z });
      for (const [a, c, e, f] of b.boxes) m.zones.push({ x0: OX + TX + a, y0: OY + TY + c, x1: OX + TX + e, y1: OY + TY + f, z: Z });
    }
    if (b.kind === 'hall') { // the Hall of Paths: the Pathkeeper before her books, a teacher by a coloured pillar in each corner
      const [x0, y0, x1, y1] = b.boxes[0], mid = b.door[0];
      for (const x of [mid - 2, mid - 1, mid + 1, mid + 2]) T(x, y0 + 1, Z).items.push('bookshelf');
      T(mid, y0 + 1, Z).items.push('plant');
      for (let y = y0 + 3; y <= b.door[1] - 1; y++) T(mid, y, Z).items.push('carpet_rug');
      m.npcs.push({ type: 'pathkeeper', x: OX + TX + mid, y: OY + TY + y0 + 2, z: Z });
      const corners = [[x0 + 1, y0 + 1, 1, 1, 'knight'], [x1 - 1, y0 + 1, -1, 1, 'paladin'], [x0 + 1, y1 - 1, 1, -1, 'sorcerer'], [x1 - 1, y1 - 1, -1, -1, 'druid']];
      for (const [x, y, dx, dy, v] of corners) {
        T(x, y, Z).items.push(K.trials.pillar[v]);
        m.npcs.push({ type: K.trials.teacher[v], x: OX + TX + x + dx, y: OY + TY + y + dy, z: Z });
      }
      m.hall = { x: OX + TX + mid, y: OY + TY + y0 + 4, z: Z }; // (where a trial sends you back to)
    }
    if (b.kind === 'tower') for (const [dx, dy, id] of [[1, 3, 'bell_nw'], [2, 3, 'bell_ne'], [1, 4, 'bell_sw'], [2, 4, 'bell_se']]) { const t = T(b.boxes[0][0] + dx, b.boxes[0][1] + dy, Z + floors - 1); if (t && !t.items.some(i => THINGS[i].change)) t.items.push(id); }
    homes.push(b);
  }
  for (const [x, y, id] of K.outside) { const t = at(TX + x, TY + y); if (THINGS[id].block && onStreet(x, y) && !/^(lamppost|fountain|bench)/.test(id) && (t || {}).ground === 'cobble') continue; if (t && (!THINGS[t.ground]?.block || (id === 'boat' && t.ground === 'water'))) t.items = [id]; } // (boats on the water; nothing in a street's way, though the courtyard keeps its fountain and benches)
  // outside each building, either side of the tile in front of its door: what tells you what it is
  const placed = [];
  for (const b of K.buildings) {
    const props = K.frontProps[b.kind]; if (!props || b.rock) continue;
    const inB = (x, y) => b.boxes.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
    const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([a, c]) => !inB(b.door[0] + a, b.door[1] + c)) || [0, 1];
    const [fx, fy] = [b.door[0] + dx, b.door[1] + dy];
    [[dy, dx], [-dy, -dx]].forEach(([sx, sy], i) => { // (the two tiles beside the door's front, along the wall)
      const x = fx + sx, y = fy + sy, t = at(TX + x, TY + y);
      if (t && !t.items.length && t.ground === 'grass') { t.items.push(props[i]); placed.push([b, t]); } // (on the grass beside the path, never on the path)
    });
  }
  { // (and none that shuts a door off: from the courtyard every door's front must still be reached, or its props go)
    const seen = new Set(), todo = [[TX + K.square[0], TY + K.square[1] + 2]];
    while (todo.length) { const [x, y] = todo.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${x + dx},${y + dy}`; if (seen.has(k) || x + dx < TX - 30 || x + dx > TX + TW + 10 || y + dy < TY - 30 || y + dy > TY + TH) continue; if (!m.isWalkable(OX + x + dx, OY + y + dy, S)) continue; seen.add(k); todo.push([x + dx, y + dy]); } }
    for (const b of K.buildings) {
      if (b.rock) continue;
      const inB = (x, y) => b.boxes.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
      const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([a2, c]) => !inB(b.door[0] + a2, b.door[1] + c)) || [0, 1];
      if (!seen.has(`${TX + b.door[0] + dx},${TY + b.door[1] + dy}`)) for (const [o, t] of placed) if (o === b) t.items = t.items.filter(i => !K.frontProps[o.kind].includes(i));
    }
  }
  for (const [x, y, text] of K.piers) { const t = at(TX + x, TY + y); if (t) { t.items = ['signpost']; m.setMeta(OX + TX + x, OY + TY + y, S, { text }); } }
  // the gates' lamps, banners, signposts and wardens; the town's folk
  for (const g of K.gatePasses) {
    for (const [x, y] of g.lamps) { const t = at(TX + x, TY + y); if (t) t.items = ['lamppost']; }
    for (const [x, y] of g.banners) { const t = at(TX + x, TY + y); if (t && t.items.includes('wall_stone')) t.items.push('banner'); }
    const [sx, sy, text] = g.sign, st = at(TX + sx, TY + sy); if (st) { st.items = ['signpost']; m.setMeta(OX + TX + sx, OY + TY + sy, S, { text }); }
    // the gateway: a vaulted passage between the towers, a walk with battlements over it, a great arch on the face you see
    if (g.arch) {
      const { at: [x0, y0, x1, y1], face } = g.arch;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const t = at(TX + x, TY + y); if (!t) continue;
        t.items = t.items.filter(i => !THINGS[i].block && i !== 'lamppost');
        t.items.push('vault_shadow');
        if (face === 's' && y === y1) t.items.push(`arch_gate_s${x - x0}`);
        if (face === 'e' && x === x1) t.items.push(`arch_gate_e${y - y0}`);
        m.set(OX + TX + x, OY + TY + y, S + 1, { ground: 'temple_paving', items: [] });
        const top = at(TX + x, TY + y, S + 1);
        if (face === 's') { if (y === y0) top.items.push('battlement_n'); if (y === y1) top.items.push('battlement_s'); }
        else { if (x === x0) top.items.push('battlement_w'); if (x === x1) top.items.push('battlement_e'); }
      }
    }
    for (const [x, y] of g.wardens) { const t = at(TX + x, TY + y); if (t) t.items = []; m.npcs.push({ type: 'bell_guard', x: OX + TX + x, y: OY + TY + y, z: S }); }
  }
  for (const [type, x, y] of K.townsfolk) { const t = at(TX + x, TY + y); if (t && t.ground !== 'water' && t.ground !== 'pier') t.items = t.items.filter(i => !THINGS[i].block); m.npcs.push({ type, x: OX + TX + x, y: OY + TY + y, z: S }); }

  // the fountain's square (before the things on it go down): light paving inside, a frame of cobbles
  { const [fx, fy, r] = K.fountainRing;
    for (let y = fy - r; y <= fy + 1 + r; y++) for (let x = fx - r; x <= fx + 1 + r; x++) {
      const t = at(TX + x, TY + y); if (!t) continue;
      const edge = x === fx - r || x === fx + 1 + r || y === fy - r || y === fy + 1 + r;
      t.ground = edge ? 'cobble' : 'marble';
    } }
  for (const [x, y, z, id] of K.templeWay) { const t = at(TX + x, TY + y, z); if (t && !t.items.length) t.items.push(id); }
  // the temple's terrace: statues either side of the steps up to it, flower boxes along its edge
  for (const [x, y, id] of K.terrace || []) { const t = at(TX + x, TY + y, S + 1); if (t && !t.items.length) t.items.push(id); }

  // ---- the sewers under the town ----
  {
    const Q = K.sewers, SZ = S - 1, key = (x, y) => `${x},${y}`, ways = new Set();
    const wx = x => OX + TX + x, wy = y => OY + TY + y;
    const dig = (x, y, ground = 'sewer') => { m.set(wx(x), wy(y), SZ, { ground, items: [] }); ways.add(key(x, y)); };
    for (const [x0, y0, x1, y1, g] of Q.rooms) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) dig(x, y, g);
    { const [cx, cy, rx, ry] = Q.nest; for (let y = cy - ry - 1; y <= cy + ry + 1; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) if (Math.hypot((x - cx) / rx, (y - cy) / ry) + (smooth(x, y, 2, 51) - 0.5) * 0.4 < 1) dig(x, y, 'cave'); }
    const channel = new Set();
    for (const [pts, w, wet] of Q.tunnels) for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
      for (let t = 0; t <= n; t++) {
        const x = Math.round(ax + (bx - ax) * t / n), y = Math.round(ay + (by - ay) * t / n), across = Math.abs(bx - ax) < Math.abs(by - ay);
        const bend = ax !== bx && ay !== by, ww = bend ? w + 2 : w; // (where a tunnel turns aside, it widens: no corner to squeeze past)
        for (let d = 0; d < ww; d++) dig(across ? x + d - (ww >> 1) : x, across ? y : y + d - (ww >> 1));
        if (wet && !bend && t % 9 !== 4) channel.add(key(x, y)); // (a plank bridge over it every so often; none where it turns)
      }
    }
    for (const k of channel) { const [x, y] = k.split(',').map(Number); if (!Q.grates.some(([gx, gy]) => Math.abs(gx - x) + Math.abs(gy - y) <= 1)) m.get(wx(x), wy(y), SZ).ground = 'sewer_water'; }
    // brick walls round every walkway; a torch here and there on them
    for (const k of [...ways]) { const [x, y] = k.split(',').map(Number); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) if (!ways.has(key(x + dx, y + dy)) && !m.get(wx(x + dx), wy(y + dy), SZ)) m.set(wx(x + dx), wy(y + dy), SZ, { ground: 'sewer', items: ['wall_sewer'] }); }
    let torch = 0;
    for (const k of ways) { const [x, y] = k.split(',').map(Number), n = m.get(wx(x), wy(y - 1), SZ); if (n && n.items.includes('wall_sewer') && hash(x, y, 52) < 0.12 && torch++ < 40) n.items.push('wall_torch'); }
    // the grates in the streets, a ladder under each
    // and trapdoors in a building's floor (Q.hatches), a ladder under each
    for (const [x, y] of Q.hatches || []) { const t = at(TX + x, TY + y); t.items = ['trapdoor']; if (!ways.has(key(x, y))) dig(x, y); m.get(wx(x), wy(y), SZ).items = ['sewer_ladder']; m.get(wx(x), wy(y), SZ).ground = 'sewer'; }
    for (const [x, y] of Q.grates) { const t = at(TX + x, TY + y); t.items = ['grate']; if (!ways.has(key(x, y))) dig(x, y); m.get(wx(x), wy(y), SZ).items = ['sewer_ladder']; m.get(wx(x), wy(y), SZ).ground = 'sewer'; }
    for (const [x, y, id] of Q.props) { const t = m.get(wx(x), wy(y), SZ); if (t && !t.items.length) t.items.push(id); }
    // the rats: three in the bell cellar (Clang's quest), the rest along the walkways, two big ones in their nest
    const open = [...ways].map(k => k.split(',').map(Number)).filter(([x, y]) => { const t = m.get(wx(x), wy(y), SZ); return t.ground !== 'sewer_water' && !t.items.length; });
    const inRoom = ([x, y], r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3], cellar = Q.rooms[0], [nx, ny, nrx, nry] = Q.nest;
    const pick = (list, n, seed) => list.filter((p, i) => hash(p[0], p[1], seed) < n / list.length * 1.3).slice(0, n);
    for (const [x, y] of pick(open.filter(p => inRoom(p, cellar)), Q.cellarRats, 53)) m.spawns.push({ type: 'rat', x: wx(x), y: wy(y), z: SZ });
    for (const [x, y] of pick(open.filter(p => !inRoom(p, cellar) && Math.hypot(p[0] - nx, p[1] - ny) > Math.max(nrx, nry) + 1 && !Q.grates.some(([gx, gy]) => Math.abs(gx - p[0]) + Math.abs(gy - p[1]) < 4)), Q.rats, 54)) m.spawns.push({ type: 'rat', x: wx(x), y: wy(y), z: SZ });
    for (const [x, y] of pick(open.filter(p => Math.hypot(p[0] - nx, p[1] - ny) < 3), Q.bigRats, 55)) m.spawns.push({ type: 'giant_rat', x: wx(x), y: wy(y), z: SZ });
  }
  // ---- the Hall of Paths' practice rooms, a floor under the town: a dummy in each corner of a ring, a sparring dummy,
  // the room's pillar, torches; in by a teacher, out by the forcefield by the entry ----
  {
    const Q = K.trials, Z = S - 1, n = Q.size;
    m.trialRooms = [];
    Q.order.forEach((v, k) => {
      const x0 = OX + TX + Q.at[0] + k * (n + 1), y0 = OY + TY + Q.at[1], x1 = x0 + n - 1, y1 = y0 + n - 1;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m.get(x, y, Z)) throw new Error(`the ${v} practice room runs into something at ${x},${y},${Z}`);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const rim = x === x0 || x === x1 || y === y0 || y === y1;
        m.set(x, y, Z, { ground: 'wood', items: rim ? ['wall_stone'] : [] });
      }
      const cx = x0 + (n >> 1), at = (dx, dy) => m.get(cx + dx, y0 + dy, Z);
      for (const dx of [-2, 2]) at(dx, 0).items.push('wall_torch');
      for (const dy of [3, 6]) { m.get(x0, y0 + dy, Z).items.push('wall_torch'); m.get(x1, y0 + dy, Z).items.push('wall_torch'); } // (well lit: a room to practise in, not a cave)
      at(-3, 1).items.push(Q.pillar[v]); at(3, 1).items.push(Q.pillar[v]);
      const entry = { x: cx, y: y1 - 1, z: Z }, exit = { x: cx + 2, y: y1 - 1 };
      m.get(exit.x, exit.y, Z).items.push('teleport');
      m.setMeta(exit.x, exit.y, Z, { to: { ...m.hall } });
      // three straw dummies in a row, in line with the entry (a Hawk's shot goes through all of them), one more beside
      // them (a circle throw, a flame burst: several at once), and the sparring dummy by the wall
      for (const [dx, dy] of [[0, 2], [0, 3], [0, 4], [-1, 3]]) m.spawns.push({ type: 'straw_dummy', x: cx + dx, y: y0 + dy, z: Z });
      m.spawns.push({ type: 'sparring_dummy', x: cx - 2, y: y1 - 2, z: Z });
      m.trialRooms.push({ voc: v, x0, y0, x1, y1, z: Z, entry, back: { ...m.hall } });
    });
  }
  // Sister Ama in the temple, by the altar (she sends you after Clang)
  { const t = K.buildings[0]; m.npcs.push({ type: 'ama', x: OX + TX + t.door[0] + 1, y: OY + TY + t.boxes[0][1] + 1, z: S + rockOf(t) }); }

  // ---- roads from the town's gates out to every part of the island, wandering a little ----
  const road = (pts) => { for (let i = 1; i < pts.length; i++) { let [x, y] = pts[i - 1]; const [bx, by] = pts[i]; let n = 0; while ((Math.abs(x - bx) + Math.abs(y - by) > 0) && n++ < 400) {
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) { const t = at(x + dx, y + dy); if (t && ['grass', 'sand', 'farmland', 'swamp'].includes(t.ground)) { t.ground = 'dirt'; t.items = []; } }
    if (hash(x, y, 41) < 0.6) x += Math.sign(bx - x); else y += Math.sign(by - y); if (hash(x, y, 42) < 0.15) x += hash(x, y, 43) < 0.5 ? -1 : 1; } } };
  { const G = ([ax, ay]) => [TX + ax, TY + ay], [wx, wy] = G(K.gates[0]), [nx, ny] = G(K.gates[1]), [qx, qy] = G([45, 35]);
    // (the west gate's tracks are laid with the farm, below: one unbroken track each)
    road([[nx, ny - 1], [116, 80], [100, 40]]); road([[nx, ny - 1], [132, 100], [158, 74], [160, 60]]);
    road([[qx + 1, qy], [150, 128], [166, 114]]); road([[qx + 1, qy + 1], [152, 140], [170, 158], [180, 164]]); }

  // ---- out of the west gate: from town to the wilds ----
  {
    const [gx, gy] = [TX + K.gates[0][0], TY + K.gates[0][1]], WW = K.westWild;
    // the road: cobbles fading out into earth over its first stretch past the gate
    for (let d = 1; d <= WW.fade; d++) for (const dy of [0, 1]) { const t = at(gx - d, gy + dy); if (t && ['dirt', 'grass', 'cobble'].includes(t.ground) && !t.items.some(i => THINGS[i].block)) { t.ground = hash(gx - d, gy + dy, 91) < 1 - d / WW.fade ? 'cobble' : 'dirt'; t.items = []; } }
    // a crossroads just past the gate: a trodden square, a signpost, and from it three tracks - north into the Old
    // Wood, west to Old Farrow's farm, south along the shore - wide by the crossroads, narrowing as they go
    const C = K.crossroads, [cx, cy] = [gx - C.off, gy];
    for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) { const t = at(x, y); if (t && !t.items.includes('cliff') && Math.hypot(x - cx, y - cy) < 2.8) { t.ground = 'dirt'; t.items = []; } }
    { const t = at(cx + 1, cy - 2); if (t) { t.items = ['signpost']; m.setMeta(OX + cx + 1, OY + cy - 2, S, { text: C.sign }); } }
    for (let x = gx - WW.fade; x > cx; x--) for (const dy of [0, 1]) { const t = at(x, gy + dy); if (t && !t.items.includes('cliff')) { t.ground = 'dirt'; t.items = []; } }
    const track = (pts, w0) => { let walked = 0, prev = null; for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let t = 0; t <= n; t++, walked++) {
        const w = walked < 10 ? w0 : Math.max(2, w0 - 1); // (narrowing as it leaves the crossroads)
        const fx = ax + (bx - ax) * t / n, fy = ay + (by - ay) * t / n;
        const x1 = Math.round(fx + (smooth(fx, fy, 6, 101) - 0.5) * 2.5), y1 = Math.round(fy + (smooth(fx, fy, 6, 102) - 0.5) * 2.5);
        // (step by step from the last tile, so a winding track never breaks into dashes)
        const [px, py] = prev || [x1, y1], k2 = Math.max(Math.abs(x1 - px), Math.abs(y1 - py), 1); prev = [x1, y1];
        for (let j = 1; j <= k2; j++) { const x = Math.round(px + (x1 - px) * j / k2), y = Math.round(py + (y1 - py) * j / k2);
        for (let dd = 0; dd < w; dd++) for (const [dx, dy] of Math.abs(bx - ax) > Math.abs(by - ay) ? [[0, dd]] : [[dd, 0]]) {
          const c = at(x + dx, y + dy); if (!c || c.ground === 'water' || c.ground === 'wood' || c.items.some(i2 => /^wall_|^door|fence/.test(i2))) continue;
          if (c.items.includes('cliff')) for (let z = S + 1; z <= S + 3; z++) m.set(OX + x + dx, OY + y + dy, z, null);
          if (c.ground !== 'farmland') c.ground = 'dirt'; c.items = [];
        } }
      } } };
    // Old Farrow's farm: a fenced yard (a gate in its fence where the track comes in), the farmhouse (a building, above),
    // the barn fallen in, a well, haystacks and a wagon in the yard, a path from the gate to the front door; west of the
    // yard the fields, gone to weeds, in their own fence
    const F = K.farrow, [y0x, y0y, y1x, y1y] = F.yard, free = t => t && !t.items.some(i => /^wall_|^door|window/.test(i)) && !['wood', 'water'].includes(t.ground) && !t.items.includes('cliff');
    for (let y = y0y - 1; y <= y1y + 1; y++) for (let x = y0x - 1; x <= y1x + 1; x++) { const t = at(x, y); if (free(t)) { if (t.items.includes('cliff')) continue; t.ground = 'grass'; t.items = []; for (let z = S + 1; z <= S + 3; z++) m.set(OX + x, OY + y, z, null); } }
    for (const [x0, y0, x1, y1] of F.fields) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = at(x, y); if (!free(t)) continue; for (let z = S + 1; z <= S + 3; z++) m.set(OX + x, OY + y, z, null);
      const edge = x === x0 || x === x1 || y === y0 || y === y1;
      if (edge) { t.ground = 'grass'; t.items = F.gaps.some(([gx2, gy2]) => gx2 === x && gy2 === y) ? [] : ['fence']; continue; }
      t.ground = 'farmland'; t.items = y % 2 ? (hash(x, y, 94) < 0.55 ? ['crops'] : []) : hash(x, y, 95) < 0.12 ? ['tallgrass'] : [];
    }
    for (let x = y0x; x <= y1x; x++) for (const y of [y0y, y1y]) { const t = at(x, y); if (free(t)) t.items = F.gaps.some(([a2, c]) => a2 === x && c === y) ? [] : ['fence']; }
    for (let y = y0y; y <= y1y; y++) for (const x of [y0x, y1x]) { const t = at(x, y); if (free(t)) t.items = F.gaps.some(([a2, c]) => a2 === x && c === y) ? [] : ['fence']; }
    for (const [x, y] of F.path) { const t = at(x, y); if (free(t)) { t.ground = 'dirt'; t.items = []; } }
    { const [bx0, by0, bx1, by1] = F.barn; for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) { const t = at(x, y); if (!t) continue; t.ground = 'wood'; t.items = (x === bx0 || x === bx1 || y === by0) && hash(x, y, 97) < 0.65 ? ['wall_wood'] : hash(x, y, 98) < 0.25 ? ['rubble'] : []; } }
    for (const [x, y, id] of F.props) { const t = at(x, y); if (free(t) && !t.items.length) t.items = [id]; }
    track([[cx - 2, cy], [F.gaps[0][0] + 1, F.gaps[0][1]]], 3);
    track([[cx, cy - 2], [cx - 2, cy - 14], [K.regions.oldwood.c[0] + 8, K.regions.oldwood.c[1] + 10]], 3);
    track([[cx, cy + 2], [cx - 4, cy + 14], [cx - 14, cy + 26], [K.regions.fields.c[0] + 4, K.regions.fields.c[1] - 12]], 2);
    const [sx, sy, text] = F.sign, st = at(sx, sy); if (st) { st.items = ['signpost']; m.setMeta(OX + sx, OY + sy, S, { text }); }
    let k = 0; for (const [type, n, [ax0, ay0, ax1, ay1]] of F.monsters) for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 60; tries++) { const x = ax0 + Math.floor(hash(k, tries, 99) * (ax1 - ax0 + 1)), y = ay0 + Math.floor(hash(tries, k, 100) * (ay1 - ay0 + 1)); if (m.isWalkable(OX + x, OY + y, S)) { m.spawns.push({ type, x: OX + x, y: OY + y, z: S }); break; } }
      k++;
    }
  }

  // ---- the last touches, checked over the whole town (tests/unit.test.js and an audit look for these) ----
  {
    const town = (x, y) => x >= TX && x < TX + TW && y >= TY && y < TY + TH;
    const road = t => t && ['cobble', 'dirt', 'paving', 'gravel', 'bridge_ew'].includes(t.ground);
    const walled = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => (at(x + dx, y + dy) || { items: [] }).items.some(i => /^wall_|^window|^door/.test(i)));
    for (let y = TY; y < TY + TH; y++) for (let x = TX; x < TX + TW; x++) {
      const t = at(x, y);
      if (!t) continue;
      // no tree or bush grows against a wall (its crown would grow into the wall or the roof)
      if (t.items.some(i => ['tree', 'pine', 'bush'].includes(i)) && walled(x, y)) t.items = [];
      // no lone tile of grass in the middle of a road: it's road too
      const decor = t.items.every(i => ['flowers', 'grass_tuft', 'tallgrass'].includes(i));
      if (t.ground === 'grass' && decor) { const r = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => at(x + dx, y + dy)).filter(road); if (r.length >= 3) { t.ground = (r.find(o => o.ground !== 'bridge_ew') || { ground: 'dirt' }).ground; t.items = []; } }
    }
    // ground in town nobody can walk to (hollows shut in by the ridge's rocks) grows over: a thicket
    let seen;
    const reach = () => { seen = new Set(); const todo = [[TX + K.square[0], TY + K.square[1] + 2]]; seen.add(todo[0].join());
    while (todo.length) { const [x, y] = todo.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${x + dx},${y + dy}`, t = at(x + dx, y + dy); if (seen.has(k) || !t || !town(x + dx, y + dy)) continue; if (!m.isWalkable(OX + x + dx, OY + y + dy, S) && !t.items.some(i => /^door|grate|steps/.test(i))) continue; seen.add(k); todo.push([x + dx, y + dy]); } }
    };
    reach();
    // street lamps along every street, so no stretch of it is dark at night: on the verge, never in a doorway
    const lamps = [];
    for (let y = TY; y < TY + TH; y++) for (let x = TX; x < TX + TW; x++) if ((at(x, y) || { items: [] }).items.includes('lamppost')) lamps.push([x, y]);
    for (let y = TY; y < TY + TH; y++) for (let x = TX; x < TX + TW; x++) {
      if (!road(at(x, y)) || !seen.has(`${x},${y}`) || lamps.some(([a, b]) => Math.hypot(a - x, b - y) <= 6)) continue;
      const spot = [[0, -1], [-1, 0], [1, 0], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy]) => [x + dx, y + dy]).find(([a, b]) => {
        const t = at(a, b); return t && t.ground === 'grass' && !t.items.length && !walled(a, b) && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (at(a + dx, b + dy) || { items: [] }).items.some(i => /^door|grate|steps/.test(i)));
      });
      if (spot) { at(...spot).items = ['lamppost']; lamps.push(spot); }
    }
    // (and if a lamp shut a corner in, that corner grows over too)
    reach();
    for (let y = TY; y < TY + TH; y++) for (let x = TX; x < TX + TW; x++) { const t = at(x, y); if (t && art(x, y) !== ' ' && ['grass', 'dirt'].includes(t.ground) && t.items.every(i => ['flowers', 'grass_tuft', 'tallgrass'].includes(i)) && !seen.has(`${x},${y}`) && m.isWalkable(OX + x, OY + y, S)) t.items = ['bush']; }
  }

  // ---- the game: animals out in the wilds, spread over each region ----
  for (const [key, R] of Object.entries(K.regions)) for (const [type, n] of R.game) for (let i = 0, k = 0; i < n && k < n * 40; k++) {
    const a = hash(k, i, key.length * 7 + 1) * 6.283, d = Math.sqrt(hash(i, k, key.length * 7 + 2)) * (type === 'bear' ? 0.45 : 1), x = Math.round(R.c[0] + Math.cos(a) * R.r[0] * d), y = Math.round(R.c[1] + Math.sin(a) * R.r[1] * d);
    if (!m.isWalkable(OX + x, OY + y, S) || art(x, y) !== ' ') continue;
    m.spawns.push({ type, x: OX + x, y: OY + y, z: S }); i++;
  }

  // ---- the tops of the rocks and the peaks: rugged, not bare slabs - crags, boulders, a bush in a crack, tufts ----
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // a rock only a tile across is a boulder lying in the grass, not a cliff
    const t = m.get(x, y, S);
    if (t && t.items.includes('cliff') && t.ground === 'mountain' && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (m.get(x + dx, y + dy, S) || { items: [] }).items.includes('cliff'))) {
      const top = m.get(x, y, S + 1); if (top && top.ground === 'rock_top') m.set(x, y, S + 1, null);
      m.set(x, y, S, { ground: 'grass', items: ['rock'] });
    }
  }
  for (const z of [S + 1, S + 2, S + 3]) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = m.get(x, y, z);
    if (!t || t.ground !== 'rock_top' || t.items.length) continue;
    // most of a top grown over (grass in its hollows, a bush, flowers), bare rock between; few loose stones
    const r = hash(x, y, 70 + z), patch = smooth(x, y, 3, 71 + z), green = smooth(x, y, 4, 72 + z);
    if (green > 0.42) { if (r < 0.14) t.items.push('bush'); else if (r < 0.34) t.items.push('fern'); else if (r < 0.6) t.items.push('grass_tuft'); continue; } // (green patches: not grass ground, whose edges would draw a maze of outlines)
    if (r < 0.03) t.items.push('crag');
    else if (r < 0.05) t.items.push('rock');
    else if (patch > 0.55 && r < 0.35) t.items.push(r < 0.2 ? 'fern' : 'grass_tuft');
    else if (r < 0.12) t.items.push('pebbles');
  }

  // ---- no rock top hangs in the air: a top a floor up stands only on a cliff (a river, a road or the town's touches
  // laid over a cliff later leave its top behind: it goes) ----
  for (let z = S + 1; z <= S + 3; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = m.get(x, y, z), under = m.get(x, y, z - 1);
    if (t && ['rock_top', 'mountain'].includes(t.ground) && !(under && under.items.includes('cliff'))) m.set(x, y, z, null);
  }

  // ---- under the ground nothing is empty, as in Tibia: wherever no tunnel or cave is dug, solid rock (never black) ----
  for (let z = S - 1; z >= S - 4; z--) {
    if (!m.floors[z].some(Boolean)) continue; // (a layer not dug yet stays as it is)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!m.get(x, y, z)) m.set(x, y, z, { ground: 'rock_top', items: [] });
  }

  m.isle = { x0: 0, y0: 0, x1: W - 1, y1: H - 1 };
  m.labels = [{ name: 'Kestrel Isle', x: OX + 105, y: OY + 20, z: S }];
  return m;
}
