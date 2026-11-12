'use strict';
// Your own sprites. Put PNG files in this folder and list them here as
//   id: 'file.png'
// where id is a map thing (tree, wall_stone, grass...), an item (sword ids like
// short_sword, health_potion...), a monster (rat, orc...), 'npc:<id>' or 'player'.
// Map things and items are 32x32 (trees and walls may be 64x64, drawn with their
// tile in the bottom-right corner). Creatures are a 32x32 picture, or a 96x128
// sheet: 3 frames (standing, step, step) across and the directions north, east,
// south, west down. Run the game from a local web server to use your own PNGs.
// Things with height (trees, statues, furniture) are 96x96 with their tile in the bottom-right
// corner; a big thing of several tiles goes under its name (e.g. founder: the statue west of the
// temple) as one picture of the whole thing. sprites/templates/ (node tests/sprite-templates.js)
// shows each size in the game's camera: give it to PixelLab as a guide.
const CUSTOM_SPRITES = {
  water_texture: 'water-atlas.png',
  temple_paving: 'temple-paving-mock.png', // 4 x 4 tiles at two pixels a world pixel, from the owner's picture (temple-paving-atlas.png: the one before)
  cobble: 'cobble-mock.png',
  lip_rock: 'lip-quay.png', // the rim of stones along a mountain top's open edges, from the owner's picture (see Sprites.ownLip)
  flowers_0: 'flowers-0@2x.png', // the patches of flowers on the map, from the same flowers (three variants)
  flowers_1: 'flowers-1@2x.png',
  flowers_2: 'flowers-2@2x.png',
  grass_flowers: 'grass-flowers.png', // clumps of little flowers scattered over the grass (see Sprites.grassFlowers)
  grass_fringe: 'grass-fringe.png', // blades of grass over the foot of what stands beside grass (see Sprites.grassFringe)
  edge_grass_n: 'edge-grass-n.png', // the grass's border reaching into a tile from the north, east, south and west (see Sprites.ownEdge)
  edge_grass_e: 'edge-grass-e.png',
  edge_grass_s: 'edge-grass-s.png',
  edge_grass_w: 'edge-grass-w.png', // the square's cobbles, the same way
  carpet_texture: 'carpet-atlas.png',
  temple_wall_texture: 'temple-wall-atlas.png',
  grass: 'grass-atlas.png',
  marble: 'temple-marble-mock.png', // 4 x 4 slabs at two pixels a world pixel, from the owner's picture of the temple (temple_marble_64.png: the owner's own one tile)
  player_sheet: 'player-sheet.png', // the players: front, side (east) and back rows, standing and two steps, at 4 pixels a world pixel (see playerFromSheet)
  sheet_ama: 'npc-ama.png', // an NPC's own sheet: sheet_<npc id>, laid out as the player sheet (drawn as it is, no recolouring)
  sheet_oak_armourer: 'npc-oak_armourer.png', // Armourer Brenna
  sheet_postmaster: 'npc-postmaster.png', // Postmaster Hobb
  sheet_pip: 'npc-pip.png', // Pip
  sheet_corwin: 'npc-corwin.png', // Master Corwin
  sheet_oak_oracle: 'npc-oak_oracle.png', // The Oracle
  sheet_oak_smith: 'npc-oak_smith.png', // Smith Dunstan
  sheet_oak_mage: 'npc-oak_mage.png', // Moonpetal
  sheet_oak_baker: 'npc-oak_baker.png', // Baker Willa
  sheet_oak_innkeeper: 'npc-oak_innkeeper.png', // Innkeeper Rolf
  sheet_gate_north: 'npc-gate_north.png', // Captain Osric
  sheet_gate_east: 'npc-gate_east.png', // Guard Hilde
  sheet_gate_south: 'npc-gate_south.png', // Guard Tilda
  sheet_gate_west: 'npc-gate_west.png', // Sergeant Bram
  sheet_townsman: 'npc-townsman.png', // Townsman
  sheet_townswoman: 'npc-townswoman.png', // Townswoman
  sheet_child: 'npc-child.png', // Child
  sheet_old_man: 'npc-old_man.png', // Old Man
  wall_stone_post: 'wall-stone-post.png', // the stone houses' walls, from the owner's picture (as the wooden ones)
  wall_stone_n: 'wall-stone-n.png',
  wall_stone_w: 'wall-stone-w.png',
  wall_stone_corner_1100: 'wall-stone-corner-1100.png',
  wall_wood_post: 'wall-wood-post.png', // the wooden houses' walls: the post alone, its arm north, its arm west, the corner of both (the owner's picture)
  wall_wood_n: 'wall-wood-n.png',
  wall_wood_w: 'wall-wood-w.png',
  wall_wood_corner_1100: 'wall-wood-corner-1100.png',
  wall_temple_post: 'wall-temple-post.png', // the temple's walls: the post alone, with its arm north, with its arm west (see wallFromPictures)
  wall_temple_n: 'wall-temple-n.png',
  wall_temple_w: 'wall-temple-w.png',
  wall_temple_n_in: 'wall-temple-n-in.png', // the same, where the face looks into the temple (a roof in front of it)
  wall_temple_w_in: 'wall-temple-w-in.png',
  wall_temple_post_in: 'wall-temple-post-in.png',
  wall_temple_corner_0011: 'wall-temple-corner-0011.png', // the temple's four corners as they are (w n s e: where the wall goes on)
  wall_temple_corner_1010: 'wall-temple-corner-1010.png',
  wall_temple_corner_0101: 'wall-temple-corner-0101.png',
  wall_temple_corner_1100: 'wall-temple-corner-1100.png',
  saint: 'saint@2x.png', // a name ending in @2x: two pixels a world pixel (96 x 96 world pixels in 192 x 192)
  plant: 'plant@2x.png',
  pew: 'pew@2x.png',
  pillar: 'pillar_white@2x.png',
  pillar_amethyst: 'pillar_amethyst@2x.png',
  pillar_emerald: 'pillar_emerald@2x.png',
  pillar_royalblue: 'pillar_royalblue@2x.png',
  pillar_terracotta: 'pillar_terracotta@2x.png',
  roof_slate_tiles: 'roof-slate.png', // the other roofs, drawn the same way: slates, wooden shingles, copper gone green, thatch
  roof_shingle_tiles: 'roof-shingle.png',
  roof_green_tiles: 'roof-copper.png',
  roof_thatch_tiles: 'roof-thatch.png',
  roof_tiles: 'roof-tiles.png', // the clay roofs: one tile of pan tiles, four rows, seamless, from the owner's picture (see roofFromPicture)
  fence_post: 'fence-post.png', // the fences, from the owner's picture: the post, its rails west and north (see fenceFromPictures)
  fence_west: 'fence-west.png',
  fence_north: 'fence-north.png',
  counter: 'counter@4x.png', // the owner's counter, bookshelf, sack and training dummy, in the world's camera
  bookshelf: 'bookshelf@4x.png',
  sack: 'sack@4x.png',
  dummy: 'dummy@4x.png',
  shelf_s: 'shelf-s.png', // the owner's shelves with books, on a wall running east-west (its south face)
  bed: 'bed@4x.png', // the owner's bed (both its tiles, as one picture: see BIG.bed) and anvil
  anvil: 'anvil@4x.png',
  statue: 'statue@4x.png', // the owner's statue, woodpile, haystack, table, chair (facing south) and chest
  woodpile: 'woodpile@4x.png',
  haystack: 'haystack@4x.png',
  table: 'table@4x.png',
  chair: 'chair@4x.png',
  chest: 'chest@4x.png',
  apple_crate: 'apple_crate@4x.png', // the owner's apple crate and planter
  planter: 'planter@4x.png',
  crate: 'crate@4x.png', // the owner's crate, barrel, noticeboard and gravestone, in the world's camera
  barrel: 'barrel@4x.png',
  noticeboard: 'noticeboard@4x.png',
  gravestone: 'gravestone@4x.png',
  well: 'well@4x.png', // the owner's well, bench and signpost, in the world's camera
  bench: 'bench@4x.png',
  signpost: 'signpost@4x.png',
  pine: 'pine@4x.png', // the owner's pine, bush, street lamp and market stall, in the world's camera
  bush: 'bush@4x.png',
  lamppost: 'lamppost@4x.png',
  lamppost_off: 'lamppost-off@4x.png', // (by day: its glass dark)
  stall: 'stall@4x.png',
  tree: 'tree@4x.png', // the leafy trees, the owner's picture in the world's camera (its own shadow made from its shape)
  rampart_face: 'rampart-face.png', // the town wall's sides: dressed sandstone with moss and ivy, a seamless strip (see blockFromPicture)
  cliff_face: 'cliff-face.png', // the mountains' rock sides: a strip of faces, from the owner's picture (see blockFromPicture)
  steps_slope: 'steps-slope.png', // the temple's stone steps: their slope seen straight on, left end, middle, right end (see stepsFromPicture)
  window_stained_s: 'banner-temple-s.png', // the temple's blue banners with a golden star, from the owner's picture: on a wall
  window_stained_e: 'banner-temple-e.png', // running east-west (its south face) and north-south (its east face)
  banner_s: 'banner-temple-s.png',
  banner_e: 'banner-temple-e.png',
  altar: 'altar@2x.png', // the temple's altar, from the owner's picture
  torch: 'torch@2x.png', // the standing torches and the torches on walls running north-south, from the owner's picture
  wall_torch_e: 'wall-torch-e.png',
  bridge_post: 'bridge-post@4x.png', // the round posts at a bridge's corners, the owner's picture in the world's camera (rising up and left)
  bridge_deck: 'bridge-mock.png', // the wooden bridges, from the owner's picture of a pier (see bridgeFromPicture)
  quay_stones: 'quay-stones.png', // the round stones along a bank, from the owner's picture (see Sprites.quayStones)
  sun_mosaic: 'sun-mosaic.png', // the golden sun laid in the paving of Oakvale's square (5 tiles across), from the owner's picture
  grate: 'grate@2x.png', // the sewer grates in the streets
  founder: 'founder-statue.png', // the statue west of the temple: the owner's picture, leaning as things do (3 x 3 tiles, at 4 pixels a world pixel)
};




