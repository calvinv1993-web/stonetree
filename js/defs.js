'use strict';
// Static definitions shared by the game, the editor and the server: map tiles and small helpers.

const TILE = 32;
const DX = [0, 1, 0, -1]; // directions: 0 north, 1 east, 2 south, 3 west
const DY = [-1, 0, 1, 0];

// Everything that can be placed on a map tile. A tile has one ground and a
// stack of things drawn on top of it in placement order.
//   ground:   goes in the ground slot instead of the stack
//   block:    creatures cannot walk here
//   low:      blocks walking but not missiles/spells (tables, fences...)
//   change:   stepping here moves you one floor up (+1) or down (-1)
//   useToClimb: a floor change you go through only by using it (tapping it); stepping onto it does nothing (grates)
//   light:    light radius in tiles (in the dark: underground and at night)
//   chest:    a quest chest that gives its reward once per character:
//             { flag, quest?, requires? ('quest', or 'quest@step': only from that step on), gold?, items: [[itemId, count]],
//               locked?, empty? (what it says once taken), choice? (one of several chests sharing a flag) }
//   bell:     the temple bell: use it to ring it, once it has its clapper back (ringBell)
//   trainer:  a training dummy: use it to hit it with your weapon, again and again, until you walk away (trainTick)
//             Chests sharing a flag are a "pick one" choice.
//   sprite:   draw with another thing's sprite
//   toggle:   using it turns it into this thing (doors)
//   fireSwap: using it puts the fire out (or lights it again): it turns into this thing
//   wall:     drawn one floor tall: 'thin' (building walls, shaped by their
//             neighbours) or 'block' (solid rock and dungeon stone)
//   onWall:   decoration drawn on the face of the wall on the same tile
//   tall:     a 64x64 sprite that rises up-left from its tile (trees)
//   mosaic:   a flat picture laid in the floor, this many tiles across, centred on its tile and drawn with the ground
//             (you walk over it); its picture is sprites/custom.js <id>, at 2 pixels a world pixel, with room round it
//             for its joint and shadow (up to half a tile)
//   roof:     a roof (a ground on the floor above a building), shaped by the
//             building under it: slopes, ridges, hips and eaves
//   movable:  can be dragged to another tile
//   meta:     per-tile setting the editor asks for, stored in map.meta:
//             to (teleport destination), target (lever target tile), lock (key name),
//             quest (quest id), level (minimum level), text (sign text);
//             and look: what you read when you look at it (a gravestone's inscription)
//   ...and flags for things you can use: lever, teleport, ropeSpot, digSpot,
//   breakable, depot, readable, houseDoor, questDoor, levelDoor, lockDoor, bookshelf, oreVein (mine it with a pick)
const THINGS = {
  grass:       { name: 'grass', cat: 'Ground', ground: true },
  dirt:        { name: 'dirt', cat: 'Ground', ground: true },
  sand:        { name: 'sand', cat: 'Ground', ground: true },
  cobble:      { name: 'cobblestone', cat: 'Ground', ground: true },
  marble:      { name: 'marble floor', cat: 'Ground', ground: true },
  wood:        { name: 'wooden floor', cat: 'Ground', ground: true },
  cave:        { name: 'cave floor', cat: 'Ground', ground: true },
  sewer:       { name: 'damp flagstones', cat: 'Ground', ground: true },             // the walkways of a sewer
  sewer_water: { name: 'sewer water', cat: 'Ground', ground: true, block: true },  // the channel between them
  crypt:       { name: 'worn grave slabs', cat: 'Ground', ground: true },          // the floor of a crypt
  pit:         { name: 'deep shaft', cat: 'Ground', ground: true, block: true },   // a drop into the dark, through rock
  swamp:       { name: 'swamp', cat: 'Ground', ground: true },
  temple_paving: { name: 'temple limestone paving', cat: 'Ground', ground: true },
  paving:      { name: 'paving stones', cat: 'Ground', ground: true },
  brick:       { name: 'brick road', cat: 'Ground', ground: true },
  tiles:       { name: 'tiled floor', cat: 'Ground', ground: true },
  gravel:      { name: 'gravel', cat: 'Ground', ground: true },
  farmland:    { name: 'farmland', cat: 'Ground', ground: true },
  mountain:    { name: 'rocky ground', cat: 'Ground', ground: true },
  rock_top:    { name: 'rugged rock', cat: 'Ground', ground: true, block: true }, // a mountain top you can't walk on
  snow:        { name: 'snow', cat: 'Ground', ground: true },
  ice:         { name: 'ice', cat: 'Ground', ground: true },
  jungle:      { name: 'jungle floor', cat: 'Ground', ground: true },
  sandstone:   { name: 'sandstone floor', cat: 'Ground', ground: true },
  ash:         { name: 'ash', cat: 'Ground', ground: true },
  lava:        { name: 'lava', cat: 'Ground', ground: true, block: true, light: 3 },
  carpet:      { name: 'carpet (legacy floor)', cat: 'Ground', ground: true },
  carpet_rug:  { name: 'carpet', cat: 'Decoration', low: true },
  water:       { name: 'water', cat: 'Ground', ground: true, block: true },
  bridge_ns:   { name: 'wooden bridge', cat: 'Ground', ground: true }, // crossing north-south
  bridge_ew:   { name: 'wooden bridge', cat: 'Ground', ground: true }, // crossing east-west
  sewer_bridge_ns: { name: 'wooden planks', cat: 'Ground', ground: true }, // over a sewer channel, crossing north-south
  sewer_bridge_ew: { name: 'wooden planks', cat: 'Ground', ground: true }, // ...and east-west

  roof:        { name: 'roof', cat: 'Roofs', ground: true, roof: true },
  roof_slate:  { name: 'slate roof', cat: 'Roofs', ground: true, roof: true },
  roof_thatch: { name: 'thatched roof', cat: 'Roofs', ground: true, roof: true },
  roof_shingle:{ name: 'shingle roof', cat: 'Roofs', ground: true, roof: true },
  roof_green:  { name: 'copper roof', cat: 'Roofs', ground: true, roof: true },
  roof_marble: { name: 'marble roof', cat: 'Roofs', ground: true, roof: true },
  roof_flat:   { name: 'flat roof', cat: 'Roofs', ground: true, roof: true },

  wall_stone:  { name: 'stone wall', cat: 'Walls', block: true, wall: 'thin' },
  wall_wood:   { name: 'wooden wall', cat: 'Walls', block: true, wall: 'thin' },
  wall_temple: { name: 'carved stone wall', cat: 'Walls', block: true, wall: 'thin' },
  wall_sandstone: { name: 'sandstone wall', cat: 'Walls', block: true, wall: 'thin' },
  wall_secret: { name: 'stone wall', cat: 'Walls', block: true, wall: 'thin', sprite: 'wall_stone' },
  wall_block:  { name: 'stone block', cat: 'Walls', block: true, wall: 'block' },
  wall_cave:   { name: 'rock wall', cat: 'Walls', block: true, wall: 'block' },
  wall_sewer:  { name: 'old brickwork', cat: 'Walls', block: true, wall: 'block' },
  wall_crypt:  { name: 'carved crypt stone', cat: 'Walls', block: true, wall: 'block' },
  ore_vein:    { name: 'ore vein', cat: 'Walls', block: true, wall: 'block', oreVein: true },
  cliff:       { name: 'mountain', cat: 'Walls', block: true, wall: 'block' },
  rampart:     { name: 'town wall', cat: 'Walls', block: true, wall: 'block' },       // the town wall: solid masonry, its walkway on the floor above
  // the parapet along the outer edge of a wall's walkway (on the n, e, s or w edge of its tile), merlons and crenels
  battlement_n: { name: 'battlements', cat: 'Walls', tall: true },
  battlement_e: { name: 'battlements', cat: 'Walls', tall: true },
  battlement_s: { name: 'battlements', cat: 'Walls', tall: true },
  battlement_w: { name: 'battlements', cat: 'Walls', tall: true },
  // the top of an archway under a walkway (over a gate or water), on the face you see: south or east
  arch_span_s: { name: 'archway', cat: 'Walls', tall: true },
  arch_span_e: { name: 'archway', cat: 'Walls', tall: true },
  // a great arch over a passage three tiles wide (a gate, the river), in three parts, on the face you see
  arch_gate_s0: { name: 'archway', cat: 'Walls', tall: true }, arch_gate_s1: { name: 'archway', cat: 'Walls', tall: true }, arch_gate_s2: { name: 'archway', cat: 'Walls', tall: true },
  // the shade under the vault of a passage through the town wall (on the ground, over water too)
  vault_shadow: { name: 'shadow', cat: 'Walls' },
  // a gate's portcullis, drawn up into its arch (in three parts like it), its spikes showing under the stones
  portcullis_s0: { name: 'portcullis', cat: 'Walls', tall: true }, portcullis_s1: { name: 'portcullis', cat: 'Walls', tall: true }, portcullis_s2: { name: 'portcullis', cat: 'Walls', tall: true },
  portcullis_e0: { name: 'portcullis', cat: 'Walls', tall: true }, portcullis_e1: { name: 'portcullis', cat: 'Walls', tall: true }, portcullis_e2: { name: 'portcullis', cat: 'Walls', tall: true },
  arch_gate_e0: { name: 'archway', cat: 'Walls', tall: true }, arch_gate_e1: { name: 'archway', cat: 'Walls', tall: true }, arch_gate_e2: { name: 'archway', cat: 'Walls', tall: true },
  door:        { name: 'open door', cat: 'Walls', toggle: 'door_closed', wall: 'thin' },
  door_closed: { name: 'closed door', cat: 'Walls', block: true, toggle: 'door', wall: 'thin' },
  door_locked: { name: 'locked door', cat: 'Walls', block: true, wall: 'thin', sprite: 'door_sealed', lockDoor: true, meta: 'lock' },
  door_house:  { name: 'house door', cat: 'Walls', block: true, wall: 'thin', sprite: 'door_closed', houseDoor: true, toggle: 'door_house_open' },
  door_house_open: { name: 'open house door', cat: 'Walls', wall: 'thin', sprite: 'door', houseDoor: true, toggle: 'door_house' },
  door_quest:  { name: 'sealed door', cat: 'Walls', block: true, wall: 'thin', sprite: 'door_sealed', questDoor: true, meta: 'quest' },
  door_level:  { name: 'gate of expertise', cat: 'Walls', block: true, wall: 'thin', sprite: 'door_sealed', levelDoor: true, meta: 'level' },
  fence:       { name: 'fence', cat: 'Walls', block: true, low: true },

  window:      { name: 'window', cat: 'Wall decor', onWall: true },
  window_stained: { name: 'stained-glass window', cat: 'Wall decor', onWall: true },
  wall_torch:  { name: 'wall torch', cat: 'Wall decor', onWall: true, light: 3, fireSwap: 'wall_torch_out' },
  wall_torch_out: { name: 'unlit wall torch', cat: 'Wall decor', onWall: true, fireSwap: 'wall_torch' },
  painting:    { name: 'painting', cat: 'Wall decor', onWall: true },
  painting_ship: { name: 'painting of a ship', cat: 'Wall decor', onWall: true },
  damp_wall:   { name: 'damp stone', cat: 'Wall decor', onWall: true },
  banner:      { name: 'banner', cat: 'Wall decor', onWall: true },
  sign_wall:   { name: 'sign', cat: 'Wall decor', onWall: true, readable: true, meta: 'text' },
  // Shop signs hanging from an iron arm, with a picture of the trade: you know what's inside before you read it.
  sign_weapons:{ name: 'smithy sign', cat: 'Wall decor', onWall: true, readable: true, meta: 'text' },
  sign_armour: { name: 'armourer\'s sign', cat: 'Wall decor', onWall: true, readable: true, meta: 'text' },
  sign_magic:  { name: 'magic shop sign', cat: 'Wall decor', onWall: true, readable: true, meta: 'text' },
  sign_food:   { name: 'bakery sign', cat: 'Wall decor', onWall: true, readable: true, meta: 'text' },
  sign_tools:  { name: 'general store sign', cat: 'Wall decor', onWall: true, readable: true, meta: 'text' },
  sign_inn:    { name: 'inn sign', cat: 'Wall decor', onWall: true, readable: true, meta: 'text' },
  sign_depot:  { name: 'depot sign', cat: 'Wall decor', onWall: true, readable: true, meta: 'text' },
  sign_temple: { name: 'temple sign', cat: 'Wall decor', onWall: true, readable: true, meta: 'text' },
  sign_school: { name: 'academy sign', cat: 'Wall decor', onWall: true, readable: true, meta: 'text' },
  window_box:  { name: 'window box', cat: 'Wall decor', onWall: true },
  lantern:     { name: 'lantern', cat: 'Wall decor', onWall: true, light: 3 },
  shelf:       { name: 'shelf', cat: 'Wall decor', onWall: true },
  weapon_rack: { name: 'weapon rack', cat: 'Wall decor', onWall: true },

  tree:        { name: 'tree', cat: 'Nature', block: true, tall: true },
  pine:        { name: 'fir tree', cat: 'Nature', block: true, tall: true },
  bush:        { name: 'bush', cat: 'Nature', block: true, low: true },
  palm:        { name: 'palm tree', cat: 'Nature', block: true, tall: true },
  cactus:      { name: 'cactus', cat: 'Nature', block: true, low: true },
  snow_pine:   { name: 'snowy fir tree', cat: 'Nature', block: true, tall: true },
  jungle_tree: { name: 'jungle tree', cat: 'Nature', block: true, tall: true },
  dead_tree:   { name: 'dead tree', cat: 'Nature', block: true, tall: true },
  fern:        { name: 'fern', cat: 'Nature' },
  crops:       { name: 'crops', cat: 'Nature' },
  rock:        { name: 'boulder', cat: 'Nature', block: true, low: true },
  crag:        { name: 'crag', cat: 'Nature', block: true, tall: true }, // rugged rock on a mountain top
  flowers:     { name: 'flowers', cat: 'Nature' },
  reeds:       { name: 'reeds', cat: 'Nature' },
  mushrooms:   { name: 'mushrooms', cat: 'Nature' },
  web:         { name: 'spider web', cat: 'Nature' },
  bones:       { name: 'old bones', cat: 'Nature' },
  tallgrass:   { name: 'tall grass', cat: 'Nature' },
  stump:       { name: 'tree stump', cat: 'Nature', block: true, low: true },
  log:         { name: 'fallen log', cat: 'Nature', block: true, low: true },
  dry_bush:    { name: 'dry bush', cat: 'Nature' },
  lilypad:     { name: 'water lilies', cat: 'Nature' },
  stalagmite:  { name: 'stalagmite', cat: 'Nature', block: true, low: true },
  rubble:      { name: 'rubble', cat: 'Nature' },
  crystal:     { name: 'glowing crystal', cat: 'Nature', block: true, low: true, light: 3 },
  puddle:      { name: 'puddle', cat: 'Nature' },
  grate:       { name: 'sewer grate', cat: 'Floor change', change: -1, useToClimb: true }, // climb down into the sewers
  apple_crate: { name: 'crate of apples', cat: 'Town', block: true, low: true },
  fish_rack:   { name: 'fish drying rack', cat: 'Town', block: true, low: true },
  pier:        { name: 'wooden pier', cat: 'Ground', ground: true },
  firewood:    { name: 'chopping block', cat: 'Town', block: true, low: true },
  pebbles:     { name: 'pebbles', cat: 'Nature' },
  shells:      { name: 'seashells', cat: 'Nature' },
  leaves:      { name: 'fallen leaves', cat: 'Nature' },
  grass_tuft:  { name: 'tuft of grass', cat: 'Nature' },
  driftwood:   { name: 'driftwood', cat: 'Nature' },

  table:       { name: 'table', cat: 'Furniture', block: true, low: true, movable: true },
  chair:       { name: 'chair', cat: 'Furniture', movable: true },
  chair_east:  { name: 'chair', cat: 'Furniture', movable: true }, // facing east
  chair_west:  { name: 'chair', cat: 'Furniture', movable: true }, // facing west
  chair_north: { name: 'chair', cat: 'Furniture', movable: true }, // facing north
  plant:       { name: 'potted plant', cat: 'Furniture', block: true, low: true, movable: true },
  bed:         { name: 'bed', cat: 'Furniture', block: true, low: true },
  bed_head:    { name: 'bed', cat: 'Furniture', block: true, low: true }, // a bed two tiles long: its head (north)...
  bed_foot:    { name: 'bed', cat: 'Furniture', block: true, low: true }, // ...and its foot, the tile south of it
  counter:     { name: 'counter', cat: 'Furniture', block: true, low: true },
  chest:       { name: 'chest', cat: 'Furniture', block: true, low: true, movable: true },
  barrel:      { name: 'barrel', cat: 'Furniture', block: true, low: true, movable: true },
  crate:       { name: 'crate', cat: 'Furniture', block: true, low: true, movable: true },
  bookshelf:   { name: 'bookshelf', cat: 'Furniture', block: true, bookshelf: true },
  altar:       { name: 'altar', cat: 'Furniture', block: true, low: true },
  gravestone:  { name: 'gravestone', cat: 'Furniture', block: true, low: true },
  tent:        { name: 'tent', cat: 'Furniture', block: true },
  torch:       { name: 'torch', cat: 'Furniture', light: 3, fireSwap: 'torch_out' },
  torch_out:   { name: 'unlit torch', cat: 'Furniture', fireSwap: 'torch' },
  campfire:    { name: 'campfire', cat: 'Furniture', block: true, low: true, light: 4, fireSwap: 'campfire_out' },
  campfire_out:{ name: 'cold campfire', cat: 'Furniture', block: true, low: true, fireSwap: 'campfire' },
  signpost:    { name: 'signpost', cat: 'Furniture', block: true, low: true, readable: true, meta: 'text' },
  depot:       { name: 'depot locker', cat: 'Furniture', block: true, low: true, depot: true },
  throne:      { name: 'throne', cat: 'Furniture', block: true, low: true },
  statue:      { name: 'old statue', cat: 'Furniture', block: true, tall: true },
  well:        { name: 'well', cat: 'Furniture', block: true, low: true },
  // The bell of Oakvale, high in the bell tower over the temple: 2x2 tiles, each showing its part of the one big bell.
  // A wide archway in a wall, three tiles across, with no door: you walk straight through (drawn as one, see BIG.arch).
  arch_w:      { name: 'archway', cat: 'Walls', wall: 'thin' },
  arch_m:      { name: 'archway', cat: 'Walls', wall: 'thin' },
  arch_e:      { name: 'archway', cat: 'Walls', wall: 'thin' },
  bell_nw:     { name: 'the bell of Oakvale', cat: 'Town', block: true, low: true, bell: true },
  bell_ne:     { name: 'the bell of Oakvale', cat: 'Town', block: true, low: true, bell: true },
  bell_sw:     { name: 'the bell of Oakvale', cat: 'Town', block: true, low: true, bell: true },
  bell_se:     { name: 'the bell of Oakvale', cat: 'Town', block: true, low: true, bell: true },
  anvil:       { name: 'anvil', cat: 'Furniture', block: true, low: true },

  // In and around towns. A fountain takes 2x2 tiles: the fountain on the bottom-right one, its rim on the others.
  fountain:    { name: 'fountain', cat: 'Town', block: true, low: true, tall: true },
  fountain_rim:{ name: 'fountain', cat: 'Town', block: true, low: true },
  // Big things built from several tiles that join up: each tile shows its own part of one drawing.
  fountain_nw: { name: 'fountain', cat: 'Town', block: true, low: true },
  fountain_ne: { name: 'fountain', cat: 'Town', block: true, low: true },
  fountain_sw: { name: 'fountain', cat: 'Town', block: true, low: true },
  fountain_se: { name: 'fountain', cat: 'Town', block: true, low: true },
  sun_mosaic:  { name: 'sun mosaic', cat: 'Town', mosaic: 5 }, // a golden sun set in the paving of a square
  lamppost:    { name: 'street lamp', cat: 'Town', block: true, low: true, tall: true, light: 4, fireSwap: 'lamppost_off' },
  lamppost_off:{ name: 'street lamp (out)', cat: 'Town', block: true, low: true, tall: true, fireSwap: 'lamppost' },
  bench:       { name: 'bench', cat: 'Town', block: true, low: true },
  stall:       { name: 'market stall', cat: 'Town', block: true, low: true, tall: true },
  hedge:       { name: 'hedge', cat: 'Town', block: true, low: true },
  planter:     { name: 'flower box', cat: 'Town', block: true, low: true },
  haystack:    { name: 'haystack', cat: 'Town', block: true, low: true },
  wagon:       { name: 'wagon', cat: 'Town', block: true, low: true, tall: true },
  woodpile:    { name: 'woodpile', cat: 'Town', block: true, low: true },
  chimney:     { name: 'chimney', cat: 'Town', block: true, tall: true },
  founder_00: { name: 'the statue of the founder', cat: 'Town', block: true, tall: true },
  founder_10: { name: 'the statue of the founder', cat: 'Town', block: true, tall: true },
  founder_20: { name: 'the statue of the founder', cat: 'Town', block: true, tall: true },
  founder_01: { name: 'the statue of the founder', cat: 'Town', block: true, tall: true },
  founder_11: { name: 'the statue of the founder', cat: 'Town', block: true, tall: true },
  founder_21: { name: 'the statue of the founder', cat: 'Town', block: true, tall: true },
  founder_02: { name: 'the statue of the founder', cat: 'Town', block: true, tall: true },
  founder_12: { name: 'the statue of the founder', cat: 'Town', block: true, tall: true },
  founder_22: { name: 'the statue of the founder', cat: 'Town', block: true, tall: true },
  saint:       { name: 'statue of a saint', cat: 'Town', block: true, tall: true },
  pew:         { name: 'pew', cat: 'Furniture', block: true, low: true },
  temple_lantern_nw: { name: 'the temple\'s lantern', cat: 'Town', block: true, tall: true },
  temple_lantern_ne: { name: 'the temple\'s lantern', cat: 'Town', block: true, tall: true },
  temple_lantern_sw: { name: 'the temple\'s lantern', cat: 'Town', block: true, tall: true },
  temple_lantern_se: { name: 'the temple\'s lantern', cat: 'Town', block: true, tall: true, light: 5 },
  basket:      { name: 'basket of goods', cat: 'Town', block: true, low: true },
  sack:        { name: 'sack', cat: 'Town', block: true, low: true, movable: true },
  boat:        { name: 'rowing boat', cat: 'Town', block: true, low: true, tall: true },
  wreck:       { name: 'old shipwreck', cat: 'Nature', block: true, low: true },
  scarecrow:   { name: 'scarecrow', cat: 'Town', block: true, low: true, tall: true },
  dummy:       { name: 'training dummy', cat: 'Town', block: true, low: true, tall: true, trainer: true },
  pillar:      { name: 'pillar', cat: 'Town', block: true, tall: true },
  pillar_amethyst: { name: 'amethyst pillar', cat: 'Town', block: true, tall: true },
  pillar_emerald: { name: 'emerald pillar', cat: 'Town', block: true, tall: true },
  pillar_royalblue: { name: 'royal blue pillar', cat: 'Town', block: true, tall: true },
  pillar_terracotta: { name: 'terracotta pillar', cat: 'Town', block: true, tall: true },
  // Out in the wilds
  windmill:    { name: 'windmill', cat: 'Wilds', block: true, tall: true },
  igloo:       { name: 'igloo', cat: 'Wilds', block: true, low: true },
  totem:       { name: 'totem pole', cat: 'Wilds', block: true, low: true, tall: true },
  beehive:     { name: 'beehive', cat: 'Wilds', block: true, low: true },
  eggs:        { name: 'nest of eggs', cat: 'Wilds', block: true, low: true },
  obelisk:     { name: 'obelisk', cat: 'Wilds', block: true, tall: true, light: 2 },
  cauldron:    { name: 'cauldron', cat: 'Wilds', block: true, low: true, light: 2 },
  sword_grave: { name: 'a sword in the ground', cat: 'Wilds' },
  flagpole:    { name: 'banner', cat: 'Wilds', block: true, low: true, tall: true },
  tower_flag:  { name: 'the flag of Oakvale', cat: 'Town', block: true, low: true, tall: true },
  // a cannon on the town wall, on its wooden carriage, its muzzle pointing out (n, e, s or w); and a pile of its balls
  cannon_n:    { name: 'cannon', cat: 'Town', block: true, low: true, tall: true },
  cannon_e:    { name: 'cannon', cat: 'Town', block: true, low: true, tall: true },
  cannon_s:    { name: 'cannon', cat: 'Town', block: true, low: true, tall: true },
  cannon_w:    { name: 'cannon', cat: 'Town', block: true, low: true, tall: true },
  cannonballs: { name: 'cannonballs', cat: 'Town', block: true, low: true },
  // Oakvale's banner hanging down the outer face of the town wall (the south or east face, the ones you see)
  wall_banner_s: { name: 'banner of Oakvale', cat: 'Walls', tall: true },
  wall_banner_e: { name: 'banner of Oakvale', cat: 'Walls', tall: true },
  ancient_tree:{ name: 'ancient tree', cat: 'Wilds', block: true, tall: true },
  ice_spike:   { name: 'ice crystals', cat: 'Wilds', block: true, low: true },
  fallen_pillar:{ name: 'fallen pillar', cat: 'Wilds', block: true, low: true },
  noticeboard: { name: 'notice board', cat: 'Town', block: true, low: true, tall: true, readable: true, meta: 'text' },

  stairs_up:   { name: 'stairs leading up', cat: 'Floor change', change: 1 },
  ladder:      { name: 'ladder', cat: 'Floor change', change: 1 },
  stairs_down: { name: 'stairs leading down', cat: 'Floor change', change: -1 },
  hole:        { name: 'hole', cat: 'Floor change', change: -1 },
  trapdoor:    { name: 'trapdoor', cat: 'Floor change', change: -1 }, // the top of a ladder
  sewer_ladder:{ name: 'ladder', cat: 'Floor change', change: 1, light: 2 }, // up to a grate, in the daylight falling through it
  cave_ladder: { name: 'ladder', cat: 'Floor change', change: 1 },           // up through a hole in the ceiling (under a trapdoor)
  // A path up a mountain side, in place of a cliff. The floor above gets ramp_top
  // (an invisible ground) right over it: step on it from above to walk down.
  ramp:        { name: 'mountain path', cat: 'Floor change', change: 1, tall: true },
  ramp_top:    { name: 'mountain path', cat: 'Floor change', ground: true, change: -1 },
  steps:       { name: 'stone steps', cat: 'Floor change', change: 1, tall: true },       // a grand stair up a rock face...
  steps_top:   { name: 'stone steps', cat: 'Floor change', ground: true, change: -1 },  // ...and its top, the floor above
  wall_stairs: { name: 'stairs up the wall', cat: 'Floor change', change: 1, wall: 'block' }, // an arched doorway in a town wall, steps up inside it
  rope_spot:   { name: 'rope spot', cat: 'Floor change', ropeSpot: true },
  rails:       { name: 'cart rails', cat: 'Mechanisms' },
  treasure:    { name: 'heap of treasure', cat: 'Furniture', block: true, low: true },
  bars:        { name: 'iron bars', cat: 'Walls', block: true, low: true },

  lever:       { name: 'lever', cat: 'Mechanisms', block: true, low: true, lever: true, meta: 'target' },
  lever_on:    { name: 'lever', cat: 'Mechanisms', block: true, low: true, lever: true, meta: 'target' },
  teleport:    { name: 'magic forcefield', cat: 'Mechanisms', teleport: true, light: 2, meta: 'to' },
  loose_sand:  { name: 'loose sand', cat: 'Mechanisms', digSpot: true },
  cracked_rock:{ name: 'cracked rock', cat: 'Mechanisms', block: true, breakable: true },

  // The bell shaft: one column of holes through every floor under the bell, where its rope runs down.
  shaft_rope_top: { name: 'bell rope', cat: 'Town', block: true, low: true },   // beside the bell: the rope over its wheel, down a hole
  shaft_rope:  { name: 'bell rope', cat: 'Town', block: true, low: true },        // the ringers' room: the rope and its woollen grip
  shaft_rope_cut: { name: 'cut bell rope', cat: 'Town', block: true, low: true }, // the temple hall: its end hangs cut, over the hole
  shaft_hole:  { name: 'bell shaft', cat: 'Town', block: true, low: true },       // a floor further down: holes in ceiling and floor
  // The Silent Bell: what fell down the bell shaft, at the bottom of it, cut and gnawed.
  bell_rope: {
    name: 'bell rope', cat: 'Quest chests',
    chest: { flag: 'bell_rope', requires: 'bell_3@2', items: [['chewed_rope', 1]],
      locked: 'A rope hangs down through a hole in the ceiling. Its end is gnawed to shreds. Rats, probably.',
      empty: 'The rest of the bell rope hangs from the hole in the ceiling, out of reach.' },
  },
  sarcophagus: { name: 'stone coffin', cat: 'Furniture', block: true, low: true },
  // The Silent Bell: the founder's tomb in the crypt under Bone Rocks, its lid pushed aside; the bell's clapper inside.
  founder_tomb: {
    name: 'tomb of the founder', cat: 'Quest chests', block: true, low: true,
    chest: { flag: 'bell_clapper', requires: 'bell_4@1', items: [['bell_clapper', 1]],
      locked: 'The lid of the great tomb has been pushed aside. Something glints inside, but a cold dread holds you back. Not yet.',
      empty: 'Only the founder\'s old bones lie in the tomb now. Let them sleep.' },
  },
  // Oakvale Isle: gear for those who dare go deep, once per character. Further down, better gear.
  qchest_oak_cap: {
    name: 'old chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'oak_cap', items: [['leather_cap', 1]] },
  },
  qchest_oak_shield: {
    name: 'old chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'oak_shield', items: [['wooden_shield', 1]] },
  },
  qchest_oak_armor: {
    name: 'rotting pack', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'oak_boots', requires: 'bell_3@2', gold: 40, items: [['leather_boots', 1]],
      locked: 'Something big moves in the dark. This is no time to rummage through old packs.' },
  },
  // The crypt under Bone Rocks: the gate to the founder's tomb opens on The Silent Bell IV (meta quest: 'bell_4'),
  // and the torn note by it can be picked up once the hall of coffins is cleared (The Silent Bell II).
  crypt_gate:  { name: 'iron gate', cat: 'Mechanisms', block: true, questDoor: true, meta: 'quest' },
  torn_note:   { name: 'torn note', cat: 'Quest chests',
    chest: { flag: 'crypt_note', requires: 'bell_2@1', items: [['torn_note', 1]],
      locked: 'A scrap of paper lies by the gate. Skeletons are still walking the hall: clear it first.' } },
  // The crypt under Bone Rocks: three weapon chests, and you may take from only one: the founders' arms, the best on the isle.
  qchest_crypt_sword: {
    name: 'stone chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'oak_crypt_arms', choice: true, requires: 'bell_2@1', locked: 'The lid will not move while the dead still walk the hall.', items: [['longsword', 1]] },
  },
  qchest_crypt_axe: {
    name: 'stone chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'oak_crypt_arms', choice: true, requires: 'bell_2@1', locked: 'The lid will not move while the dead still walk the hall.', items: [['war_axe', 1]] },
  },
  qchest_crypt_club: {
    name: 'stone chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'oak_crypt_arms', choice: true, requires: 'bell_2@1', locked: 'The lid will not move while the dead still walk the hall.', items: [['mace', 1]] },
  },
  qchest_parcel: {
    name: 'crate', cat: 'Quest chests', block: true, low: true, sprite: 'crate',
    chest: { flag: 'parcel', requires: 'lost_parcel', items: [['parcel', 1]], locked: 'The crate is nailed shut. Maybe someone is looking for it?' },
  },
  qchest_hunter: {
    name: 'chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'hunters_cache', quest: 'hunters_cache', items: [['bow', 1], ['arrow', 40]] },
  },
  qchest_longsword: {
    name: 'chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'crypt_armory', quest: 'crypt_armory', items: [['longsword', 1]] },
  },
  qchest_mace: {
    name: 'chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'crypt_armory', quest: 'crypt_armory', items: [['mace', 1]] },
  },
  qchest_war_axe: {
    name: 'chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'crypt_armory', quest: 'crypt_armory', items: [['war_axe', 1]] },
  },
  qchest_crypt_secret: {
    name: 'chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'crypt_secret', quest: 'crypt_secret', gold: 150, items: [['ring_life', 1]] },
  },
  qchest_sand: {
    name: 'chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'sand_cache', quest: 'sand_cache', gold: 100, items: [['amulet_guard', 1]] },
  },
  qchest_hoard: {
    name: 'treasure chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'ogre_hoard', quest: 'ogre_hoard', gold: 400, items: [['steel_helmet', 1], ['health_potion', 5]] },
  },
  qchest_tower: {
    name: 'chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'tower_secrets', quest: 'tower_secrets', gold: 300, items: [['iron_boots', 1], ['mana_potion', 5]] },
  },
  qchest_key: {
    name: 'chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'pirate_key', items: [['key_bronze', 1]] },
  },
  qchest_chart: {
    name: 'chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'sea_chart', requires: 'drowned_king', items: [['sea_chart', 1]], locked: 'The chest is locked tight. Someone must know what is inside.' },
  },
  qchest_pirate_gold: {
    name: 'treasure chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'pirate_gold', quest: 'pirate_gold', gold: 600, items: [['ring_swift', 1]] },
  },
  qchest_trunk: {
    name: 'battered trunk', cat: 'Quest chests', block: true, low: true, sprite: 'trunk',
    chest: { flag: 'sky_trunk', requires: 'free_elf', items: [['old_sock', 1]], locked: 'A battered school trunk, fallen from the sky by the look of it. The lock is stuck.' },
  },
  qchest_webs: {
    name: 'chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'webbed_cache', quest: 'webbed_cache', gold: 800, items: [['ring_life', 1], ['health_potion', 5]] },
  },
  qchest_summit: {
    name: 'chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'cyclops_summit', quest: 'cyclops_summit', gold: 500, items: [['war_hammer', 1]] },
  },
  qchest_dragon_hoard: {
    name: 'treasure chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'dragon_hoard', quest: 'dragon_hoard', gold: 2500, items: [['plate_armor', 1], ['health_potion', 10]] },
  },
  // A chest out in the wilds: what's in it is set per tile (map meta { gold, items }); everyone can open each one once.
  cache:       { name: 'old chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest', cache: true },
  qchest_frost: {
    name: 'treasure chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'frost_hoard', quest: 'frost_hoard', gold: 3000, items: [['rod_glacier', 1], ['frost_scale', 3]] },
  },
  qchest_maze: {
    name: 'chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'labyrinth_prize', quest: 'labyrinth_prize', gold: 1200, items: [['minotaur_horn', 3], ['steel_helmet', 1]] },
  },
  qchest_pyramid: {
    name: 'treasure chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'pyramid_tomb', quest: 'pyramid_tomb', gold: 4000, items: [['ring_life', 1], ['crown_helmet', 1]] },
  },
  qchest_idol: {
    name: 'chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'jungle_idol', quest: 'jungle_idol', gold: 2500, items: [['elven_bow', 1], ['lizard_scale', 5]] },
  },
  qchest_demon: {
    name: 'treasure chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'demon_hoard', quest: 'demon_hoard', gold: 15000, items: [['golden_armor', 1], ['amulet_keeping', 1], ['demon_horn', 2]] },
  },
  qchest_tide: {
    name: 'treasure chest', cat: 'Quest chests', block: true, low: true, sprite: 'chest',
    chest: { flag: 'tide_hoard', quest: 'tide_hoard', gold: 1000, items: [['amulet_keeping', 1], ['ring_life', 1]] },
  },
};

// Each ground's speed, as in Tibia: a step takes 1000 x this / your speed (in ms). Roads, paving and floors are
// quickest (100), grass, sand and rough ground slower, deep snow and swamp slowest.
const GROUND_SPEED = { grass: 150, farmland: 150, dirt: 120, sand: 160, mountain: 160, rock_top: 160, cave: 130, jungle: 170, ash: 150, snow: 180, ice: 120, swamp: 220 };
const groundSpeed = id => GROUND_SPEED[id] || 100;
const groundSlowness = id => groundSpeed(id) / 100; // against a road: what walking there costs, for finding the quickest way

// Outfits, as in the outfit window: each comes in a male and a female cut, in four
// colours of your choice (head, primary, secondary, detail), with two addons that
// unlock as you level. Your vocation picks the outfit you start in.
const OUTFITS = {
  citizen: { name: 'Citizen', addons: ['feathered cap', 'backpack'] },
  hunter: { name: 'Hunter', addons: ['hunting hat', 'crossbow'] },
  mage: { name: 'Mage', addons: ['wizard hat', 'staff'] },
  knight: { name: 'Knight', addons: ['plumed helmet', 'sword and shield'] },
  noble: { name: 'Noble', addons: ['grand hat', 'cape'] },
  barbarian: { name: 'Barbarian', addons: ['horned helmet', 'great axe'] },
  druid: { name: 'Druid', addons: ['antler crown', 'leaf staff'] },
  pirate: { name: 'Pirate', addons: ['tricorn', 'sabre'] },
};
const ADDON_LEVELS = [20, 40];
const VOCATION_OUTFIT = { none: 'citizen', knight: 'knight', paladin: 'hunter', sorcerer: 'mage', druid: 'druid' };
// The addons (bit 1: first, bit 2: second) a character of this level may wear.
const allowedAddons = level => (level >= ADDON_LEVELS[0] ? 1 : 0) | (level >= ADDON_LEVELS[1] ? 2 : 0);

// Map marks, as in Tibia: one of these icons, with a description of your own, on any spot of the map.
const MAX_MARKS = 200;
const MARK_ICONS = ['check', 'question', 'exclamation', 'star', 'crossmark', 'cross', 'mouth', 'spear', 'sword', 'flag',
  'lock', 'bag', 'skull', 'dollar', 'up', 'down', 'left', 'right', 'green_up', 'green_down'];

const ELEMENT_COLORS = {
  physical: '#d83030', fire: '#ff7a1a', ice: '#8fe0ff', energy: '#c58cff', earth: '#6fcf3f', holy: '#fff1a0', poison: '#7ad040',
};

const capitalize = s => s[0].toUpperCase() + s.slice(1);

function withArticle(name) {
  if (/s$/.test(name)) return name;
  return (/^[aeiou]/i.test(name) ? 'an ' : 'a ') + name;
}

// Small deterministic RNG (mulberry32) so sprites and the default map look the same every time.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


