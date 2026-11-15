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
  wood: 'wood-own.png', // the owner's plank floor, from above (ground template: cut from joint to joint, see tests/install-ground-border.py)
  paving: 'paving-own.png', // the owner's paving, from above (ground + border template)
  cobble: 'cobble-own.png', // the owner's cobble, from above (ground + border template)
  edge_sand_w: 'edge-sand-w.png', // the owner's sand border (ground + border template)
  edge_sand_s: 'edge-sand-s.png', // the owner's sand border (ground + border template)
  edge_sand_e: 'edge-sand-e.png', // the owner's sand border (ground + border template)
  edge_sand_n: 'edge-sand-n.png', // the owner's sand border (ground + border template)
  sand: 'sand-own.png', // the owner's sand, from above (ground + border template)
  edge_dirt_w: 'edge-dirt-w.png', // the owner's dirt border (ground + border template)
  edge_dirt_s: 'edge-dirt-s.png', // the owner's dirt border (ground + border template)
  edge_dirt_e: 'edge-dirt-e.png', // the owner's dirt border (ground + border template)
  edge_dirt_n: 'edge-dirt-n.png', // the owner's dirt border (ground + border template)
  dirt: 'dirt-own.png', // the owner's dirt, from above (ground + border template)
  edge_grass_w: 'edge-grass-w.png', // the owner's grass border (ground + border template)
  edge_grass_s: 'edge-grass-s.png', // the owner's grass border (ground + border template)
  edge_grass_e: 'edge-grass-e.png', // the owner's grass border (ground + border template)
  edge_grass_n: 'edge-grass-n.png', // the owner's grass border (ground + border template)
  grass: 'grass-own.png', // the owner's grass, from above (ground + border template)
  wall_temple_top: 'wall-temple-top.png', // the owner's wall_temple strip, straight on (see wallFromStrip)
  wall_temple_face: 'wall-temple-face.png', // the owner's wall_temple strip, straight on (see wallFromStrip)
  wall_stone_top: 'wall-stone-top.png', // the owner's wall_stone strip, straight on (see wallFromStrip)
  wall_stone_face: 'wall-stone-face.png', // the owner's wall_stone strip, straight on (see wallFromStrip)
  wall_crypt_top: 'wall-crypt-top.png', // the crypt walls' top, from above (the owner's slabs, laid in rows)
  wall_crypt_face: 'wall-crypt-face.png', // the owner's wall_crypt strip, straight on (see wallFromStrip)
  wall_cave_top: 'wall-cave-top.png', // the cave walls' top, from above (the owner's top strip, stacked)
  wall_cave_face: 'wall-cave-face.png', // the owner's wall_cave strip, straight on (see wallFromStrip)
  wall_sewer_top: 'wall-sewer-top.png', // the sewer walls' top, from above (the owner's top strip, stacked)
  wall_sewer_face: 'wall-sewer-face.png', // the owner's wall_sewer strip, straight on (see wallFromStrip)
  cliff_face: 'cliff-face.png', // the owner's cliff strip, straight on (see wallFromStrip)
  wall_rampart_top: 'wall-rampart-top.png', // the owner's wall_rampart strip, straight on (see wallFromStrip)
  wall_rampart_face: 'wall-rampart-face.png', // the owner's wall_rampart strip, straight on (see wallFromStrip)
  wall_wood_top: 'wall-wood-top.png', // the owner's wall_wood strip, straight on (see wallFromStrip)
  wall_wood_face: 'wall-wood-face.png', // the owner's wall_wood strip, straight on (see wallFromStrip)
  window_front: 'window-front.png', // the owner's window, painted straight on: laid onto the wall in its slant (both directions)
  stairs_up_stone: 'stairs-stone@4x.png', // the owner's stairs up, by the floor they stand on: stone (the wall's towers, the
  stairs_up_wood: 'stairs-wood@4x.png',   // crypt) and wood (houses, the bell tower); render.js picks by the tile's ground. The stone one also makes the temple
                                          // mount's wide flight of steps, a tile of treads each (stepsFromStairs)
  stairs_down_wood: 'stairs-down-wood@4x.png', // the owner's ways down through a wooden floor and a stone one
  stairs_down_stone: 'stairs-down-stone@4x.png',
  battlement_n: 'battlement-n@4x.png', // the owner's battlements along the town wall's walkway: its north, south, west and
  battlement_s: 'battlement-s@4x.png', // east edges, each placed as the drawn ones were (96 x 96 world px, their tile bottom right)
  battlement_w: 'battlement-w@4x.png',
  battlement_e: 'battlement-e@4x.png',
  health_potion: 'items/health-potion@4x.png', // the owner's painted potions, lying on the ground (the bag and the action
  mana_potion: 'items/mana-potion@4x.png',     // buttons show the same: sprites/ui/actions/h.png and m.png)
  water_texture: 'water-atlas.png',
  temple_paving: 'temple-paving-mock.png', // 4 x 4 tiles at two pixels a world pixel, from the owner's picture (temple-paving-atlas.png: the one before)
  rim_kit_n: 'rim-kit-n.png', // the owner's border kit of stones: beside an edge by where the inside lies (n e s w), and
  rim_kit_e: 'rim-kit-e.png', // round an outside corner by which diagonal is the inside (ne se sw nw); a mountain top's rim
  rim_kit_s: 'rim-kit-s.png', // and the bank along water in town are laid from them (see kitTile)
  rim_kit_w: 'rim-kit-w.png',
  rim_kit_ne: 'rim-kit-ne.png',
  rim_kit_se: 'rim-kit-se.png',
  rim_kit_sw: 'rim-kit-sw.png',
  rim_kit_nw: 'rim-kit-nw.png',
  lip_rock: 'lip-quay.png', // the rim of stones along a mountain top's open edges, from the owner's picture (see Sprites.ownLip)
  flowers_0: 'flowers-0@2x.png', // the patches of flowers on the map, from the same flowers (three variants)
  flowers_1: 'flowers-1@2x.png',
  flowers_2: 'flowers-2@2x.png',
  grass_flowers: 'grass-flowers.png', // clumps of little flowers scattered over the grass (see Sprites.grassFlowers)
  grass_fringe: 'grass-fringe.png', // blades of grass over the foot of what stands beside grass (see Sprites.grassFringe)
  carpet_texture: 'carpet-atlas.png',
  temple_wall_texture: 'temple-wall-atlas.png',
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
  wall_wood_post: 'wall-wood-post.png', // the wooden houses' walls: the post alone, its arm north, its arm west, the corner of both (the owner's picture)
  wall_wood_n: 'wall-wood-n.png',
  wall_wood_w: 'wall-wood-w.png',
  wall_temple_post: 'wall-temple-post.png', // the temple's walls: the post alone, with its arm north, with its arm west (see wallFromPictures)
  wall_temple_n: 'wall-temple-n.png',
  wall_temple_w: 'wall-temple-w.png',
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
  grass_tuft: 'grass-tuft@4x.png', // the owner's tuft of grass, crag, chairs facing east and west, and depot locker
  crag: 'crag@4x.png',
  chair_east: 'chair-east@4x.png',
  chair_west: 'chair-west@4x.png',
  depot: 'depot@4x.png',
  leaves_0: 'leaves-0@4x.png', // the owner's fallen leaves (all of them, the western drift, the eastern), puddle and driftwood
  leaves_1: 'leaves-1@4x.png',
  leaves_2: 'leaves-2@4x.png',
  puddle: 'puddle@4x.png',
  driftwood: 'driftwood@4x.png',
  dead_tree: 'dead_tree@4x.png', // the owner's dead tree, rubble, seashells and spider web
  rubble: 'rubble@4x.png',
  shells: 'shells@4x.png',
  web: 'web@4x.png',
  wall_torch_s: 'wall-torch-s.png', // the owner's wall torch on a wall running east-west, lit and burnt out
  wall_torch_out_s: 'wall-torch-out-s.png',
  chimney: 'chimney@4x.png', // the owner's chimney, cannonballs, stone coffin and bones, in the world's camera
  cannonballs: 'cannonballs@4x.png',
  cannon_n: 'cannon-n@4x.png', cannon_e: 'cannon-e@4x.png', // the owner's cannon on its carriage, by the way its muzzle points
  cannon_s: 'cannon-s@4x.png', cannon_w: 'cannon-w@4x.png',
  tower_flag: 'tower-flag@4x.png', // the owner's flag of Oakvale on the lookout tower
  crops: 'crops@4x.png', // the owner's wheat: one tile of a field
  firewood: 'firewood@4x.png', // the owner's chopping block, with its axe and split logs
  campfire_out: 'campfire-out@4x.png', // the owner's campfire burnt out
  founder_tomb: 'founder-tomb@4x.png', // the owner's tomb of Oakvale's founder in the crypt
  torn_note: 'torn-note@4x.png', // the owner's torn note on the floor
  gate_arch_front: 'gate-arch-front.png', portcullis_front: 'portcullis-front.png', // the owner's town gate arch and portcullis, straight on
  wall_banner_front: 'wall-banner-front.png', sign_weapons_front: 'sign-weapons-front.png', // the owner's banner and weapon shop sign, straight on
  sign_depot_front: 'sign-depot-front.png', sign_inn_front: 'sign-inn-front.png', sign_tools_front: 'sign-tools-front.png', // the owner's boards with
  sign_magic_front: 'sign-magic-front.png', sign_temple_front: 'sign-temple-front.png', sign_armour_front: 'sign-armour-front.png',
  sign_food_front: 'sign-food-front.png', sign_school_front: 'sign-school-front.png', // their own emblems (cut from the owner's sheet)
  sign_blank_front: 'sign-blank-front.png', // the same board without its emblem: the other shops' signs, their emblem carved in
  lantern_side: 'lantern-side.png', // the owner's wall lantern, seen from the side (the wall on its left)
  crypt_gate: 'crypt-gate@4x.png', // the owner's locked iron gate in the crypt
  bell_rope: 'bell-rope@4x.png', // the owner's coil of rope, picked up to ring the bell
  shaft_hatch: 'shaft-hatch.png', // the owner's hatch over the bell shaft (with the rope through it, or the dark shaft below)
  trapdoor: 'trapdoor@4x.png', // the owner's open trapdoor
  door_closed_front: 'door-closed-front.png', door_open_front: 'door-open-front.png', // the owner's door in its frame, straight on, shut and open
  temple_wall_out: 'temple-wall-out.png', temple_wall_in: 'temple-wall-in.png', temple_wall_top: 'temple-wall-top.png', // the owner's temple wall: strips, straight on (templeFromStrips)
  temple_arch_front: 'temple-arch-front.png', // the owner's temple archway, straight on (see BIG.arch)
  ramp_front: 'ramp-front.png', // the owner's mountain path up a cliff, the slope seen straight on
  ladder_front: 'ladder-front.png', // the owner's ladder, painted straight on: every ladder (stood up in the world's slant, see ownLadder)
  campfire: 'campfire@4x.png', wagon: 'wagon@4x.png', obelisk: 'obelisk@4x.png', // the owner's campfire (lit), farm wagon and rune stone
  weapon_rack_s: 'weapon-rack-s.png', // the owner's weapon rack on a wall running east-west (one running north-south keeps the drawn one)
  sarcophagus: 'sarcophagus@4x.png',
  bones: 'bones@4x.png',
  window_box_s: 'window-box-s.png', // the owner's window box, on a wall running east-west (its south face)
  tallgrass_0: 'tallgrass-0@4x.png', // the owner's tall grass (a tuft for each variant), mushrooms and pebbles
  tallgrass_1: 'tallgrass-1@4x.png',
  tallgrass_2: 'tallgrass-2@4x.png',
  mushrooms: 'mushrooms@4x.png',
  pebbles_0: 'pebbles-0@4x.png',
  pebbles_1: 'pebbles-1@4x.png',
  pebbles_2: 'pebbles-2@4x.png',
  rock: 'rock@4x.png', // the owner's boulders, wild flowers, fern and reeds (flowers and reeds: a picture for each variant)
  flowers_0: 'flowers-0@4x.png',
  flowers_1: 'flowers-1@4x.png',
  flowers_2: 'flowers-2@4x.png',
  fern: 'fern@4x.png',
  reeds_0: 'reeds-0@4x.png',
  reeds_1: 'reeds-1@4x.png',
  counter: 'counter@4x.png', // the owner's counter, bookshelf, sack and training dummy, in the world's camera
  bookshelf: 'bookshelf@4x.png',
  sack: 'sack@4x.png',
  dummy: 'dummy@4x.png',
  shelf_s: 'shelf-s.png', // the owner's shelves with books, on a wall running east-west (its south face)
  bell: 'bell@4x.png', // the owner's bell in its oak frame, both by two tiles as one picture (see BIG.bell)
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




