'use strict';
// The Last Town's first night (QUESTS.last_town in npcs.js): the Hollow Host attacks the north wall, and a newcomer
// loads its cannons, finds Clang behind the powder kegs and fires them. The siege is each player's own: nobody else
// sees or hears it. Its state is the quest's: loaded (the cannons loaded, "x,y,z"), siegeAt (when the horns blew)
// and firedAt (when the cannons fired); the browser draws the Host from that (siegeScene; drawn in game.js).

const SIEGE_RETREAT_MS = 20000; // after the cannons fire, the Host is seen running for this long
const SIEGE_VOLLEY_MS = 380; // between one cannon's roar and the next, along the wall

// Where the siege stands for you: null, or { at: the horns, fired: the cannons (0 before) }
function siegeScene() {
  const q = player.quests && player.quests.last_town;
  if (!q || !q.siegeAt) return null;
  if (q.firedAt && now - q.firedAt > SIEGE_RETREAT_MS) return null;
  if (!q.firedAt && q.status !== 'active') return null;
  return { at: q.siegeAt, fired: q.firedAt || 0 };
}

// A step's scene, as it's done (step.scene): the horns blow, and the Host comes out of the dark
function startScene(name) {
  if (name !== 'siege' || !player.quests.last_town) return;
  player.quests.last_town.siegeAt = now;
  player.quests.last_town.loaded = [];
  playerEvent('siege', { at: now }); // (horns and a banner, for you alone: game.js)
  uiDirty();
}

// Using a cannon on the wall: on the quest, load one on the north wall (powder, then a ball), and once Clang is safe,
// light the fuse at one that's loaded: they all fire. Otherwise it's a cold cannon.
function useCannon(x, y, z) {
  const id = (map.get(x, y, z) || { items: [] }).items.find(i => THINGS[i] && THINGS[i].cannon);
  const q = player.quests.last_town, st = questState('last_town') === 'active' && questStep('last_town'), key = `${x},${y},${z}`;
  if (st && st.load) {
    if (id !== 'cannon_n') return log('This one points the wrong way: the Host is at the north wall!');
    q.loaded = q.loaded || [];
    if (q.loaded.includes(key)) return log('This one is loaded. The next one!');
    q.loaded.push(key);
    addBurst(x, y, z, '#9a9a9a');
    log(`You pour in the powder and ram a ball home. (${q.loaded.length} of ${st.load} cannons loaded)`, 'quest');
    if (q.loaded.length >= st.load) {
      if (st.done) log(storyText(st, 'done'), 'quest');
      advanceQuest('last_town');
    }
    return uiDirty();
  }
  if (st && st.thing) return log('Wait: that mewing, behind the powder kegs. Find it first!');
  if (st && st.fire) {
    if (!(q.loaded || []).includes(key)) return log('This one is not loaded. Light the fuse at one that is!');
    q.firedAt = now;
    playerEvent('cannons', { at: now, cannons: q.loaded.slice() }); // (the roar, the smoke: game.js)
    if (st.done) log(storyText(st, 'done'), 'quest');
    addSparkle(player, '#ffe080');
    return advanceQuest('last_town');
  }
  log('An old bronze cannon on an oak carriage, cold, pointing out over the battlements.');
}
