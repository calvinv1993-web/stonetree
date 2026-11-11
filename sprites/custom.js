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
  cliff_face: 'cliff-face.png', // the mountains' rock sides: a strip of faces, from the owner's picture (see blockFromPicture)
  steps_slope: 'steps-slope.png', // the temple's stone steps: their slope seen straight on, left end, middle, right end (see stepsFromPicture)
  window_stained_s: 'banner-temple-s.png', // the temple's blue banners with a golden star, from the owner's picture: on a wall
  window_stained_e: 'banner-temple-e.png', // running east-west (its south face) and north-south (its east face)
  banner_s: 'banner-temple-s.png',
  banner_e: 'banner-temple-e.png',
  altar: 'altar@2x.png', // the temple's altar, from the owner's picture
  torch: 'torch@2x.png', // the standing torches and the torches on walls running north-south, from the owner's picture
  wall_torch_e: 'wall-torch-e.png',
  bridge_post: 'bridge-post@4x.png', // the round posts at a bridge's corners, drawn in the world's camera (rising up and left)
  bridge_deck: 'bridge-mock.png', // the wooden bridges, from the owner's picture of a pier (see bridgeFromPicture)
  quay_stones: 'quay-stones.png', // the round stones along a bank, from the owner's picture (see Sprites.quayStones)
  sun_mosaic: 'sun-mosaic.png', // the golden sun laid in the paving of Oakvale's square (5 tiles across), from the owner's picture
  grate: 'grate@2x.png', // the sewer grates in the streets
  founder: 'founder-statue.png', // the statue of the founder, west of the temple (3 x 3 tiles, at 4 pixels a world pixel)
};




