'use strict';
// How the world looks and feels around the game. Nothing here changes the game itself;
// it only draws (and listens). Online, everyone sees the same light, weather and seasons:
// they follow the shared clock and the real date.
//  - light: dawn, day, dusk and a deep blue night; warm pools of light round fires,
//    lamps and windows, cold glows of crystals and portals; clouds drifting over the land
//  - weather by region: snow and blizzards in the north, rain and thunder in the fen and
//    the jungle, sandstorms in the desert, ash and embers by the volcano
//  - the seasons: blossom in spring, fireflies in summer, falling leaves in autumn, snow in winter
//  - life: butterflies, birds that take off as you come close, jumping fish, gulls over the
//    sea; trees and grass swaying in the wind (render.js)
//  - fights: hits flash and knock back, big hits shake the screen, spells leave sparks,
//    and whatever dies bursts and fades
//  - footprints in snow and sand, dust on the roads, splashes in the fen
//  - the name of a place, large across the screen, as you arrive

const Fx = (() => {
  const MAX = 480;
  const parts = [];  // particles, in world pixels: { x, y, z, vx, vy, age, life, size, color, glow, kind }
  const prints = []; // footprints: { x, y, z, dir, at }
  const stains = []; // blood where someone was hit: { x, y, z, at, kind, v }
  const STAIN_TIME = 20000;
  const BLOOD = { red: ['#6a0a0a', '#9a1212', '#c82222'], green: ['#345e12', '#4f8a1a', '#79b232'] };
  const seen = new WeakSet(); // effects that have had their particles
  const known = new Map(); // creature id -> { hp, flash, kx, ky, x, y, z, img, dead }
  const ghosts = []; // what just died, fading: { x, y, z, img, at }
  const birds = [];  // { x, y, z, vx, vy, flying, at }
  const steps = new Map(); // creature id -> the tile it was last on
  let shake = 0, shakeAt = 0, thunderAt = -1e9, nextThunder = 0, banner = null, place = '', placeCheck = 0;
  let climate = { kind: 'green', water: 0, flowers: [], waters: [], grass: [], underground: false }, climateAt = -1e9;

  const add = p => { if (parts.length < MAX) parts.push({ age: 0, glow: false, size: 1.5, vx: 0, vy: 0, ...p }); };
  const tileAt = (x, y, z) => map.get(x, y, z);
  const groundAt = (x, y, z) => (tileAt(x, y, z) || {}).ground;

  // ---- where we are: the climate around you, the season, the weather ------------------------
  function readClimate() {
    const z = player.z, counts = {}, flowers = [], waters = [], grass = [];
    let n = 0;
    for (let y = player.y - 9; y <= player.y + 9; y += 1) for (let x = player.x - 12; x <= player.x + 12; x += 1) {
      const t = tileAt(x, y, z);
      if (!t || !t.ground) continue;
      n++;
      counts[t.ground] = (counts[t.ground] || 0) + 1;
      if (t.ground === 'water') waters.push([x, y]);
      if (t.items.includes('flowers')) flowers.push([x, y]);
      if ((t.ground === 'grass' || t.ground === 'jungle') && !t.items.length) grass.push([x, y]);
    }
    const share = id => (counts[id] || 0) / Math.max(1, n);
    // hot ground anywhere near (sand, sandstone, ash, lava, jungle): never any snow here
    const hot = share('sand') + share('sandstone') + share('ash') + share('lava') + share('jungle'), cold = share('snow') + share('ice');
    const kind = cold > 0.25 && cold > hot ? 'frost' : share('ash') + share('lava') > 0.25 ? 'volcano' : share('sand') + share('sandstone') > 0.25 ? 'desert'
      : share('swamp') > 0.2 ? 'swamp' : share('jungle') > 0.25 ? 'jungle' : 'green';
    return { kind, hot, water: share('water'), flowers, waters, grass, underground: z < map.surfaceZ, town: nearTown() };
  }
  const nearTown = () => typeof MAP_TOWNS !== 'undefined' && MAP_TOWNS.some(([, x, y, z]) => z === map.surfaceZ && Math.abs(x - player.x) < 26 && Math.abs(y - player.y) < 22);

  // By the real date, so it's the same season for everyone.
  function season() {
    const m = new Date().getMonth();
    return m === 11 || m < 2 ? 'winter' : m < 5 ? 'spring' : m < 8 ? 'summer' : 'autumn';
  }
  // Here and now: it follows the shared clock, so everyone in the region sees the same.
  function weather() {
    if (climate.underground) return null;
    const t = now / 60000, wave = k => (Math.sin(t / 6.1 + k) + Math.sin(t / 2.7 + k * 2.3)) / 2;
    const k = climate.kind;
    if (k === 'volcano') return { kind: 'ash', strength: 0.6 + 0.4 * wave(1) };
    if (k === 'frost') return { kind: 'snow', strength: wave(2) > 0.55 ? 1 : 0.35 };
    if (k === 'desert') { const w = wave(3); return w > 0.5 ? { kind: 'sand', strength: Math.min(1, (w - 0.5) * 2.5) } : null; }
    if (k === 'swamp' || k === 'jungle') { const w = wave(4); return w > 0 ? { kind: 'rain', strength: Math.min(1, w * 1.6), thunder: w > 0.55 } : null; }
    const w = wave(5), winter = season() === 'winter' && climate.hot < 0.05; // no snow anywhere near sand or jungle
    if (w < 0.45) return winter ? { kind: 'snow', strength: 0.25 } : null;
    return { kind: winter ? 'snow' : 'rain', strength: Math.min(1, (w - 0.45) * 2.2), thunder: w > 0.85 };
  }
  // How hard the wind blows trees and grass about.
  // How much snow lies on the roofs: it settles while it snows, and melts slowly after.
  // In the frozen north the roofs are always white.
  let snowCover = 0, snowAt = 0;
  function roofSnow() {
    const dt = Math.max(0, Math.min(1000, now - snowAt)), w = weather();
    snowAt = now;
    if (climate.underground) return snowCover;
    if (climate.kind === 'frost') snowCover = Math.min(1, snowCover + dt / 4000);
    else if (w && w.kind === 'snow') snowCover = Math.min(1, snowCover + (dt * w.strength) / 40000);
    else if (climate.hot > 0.05 || climate.kind !== 'green') snowCover = 0; // somewhere warm: no snow on the roofs, not even what you brought
    else snowCover = Math.max(0, snowCover - dt / 150000);
    return snowCover;
  }
  function wind() {
    const w = weather();
    return climate.underground ? 0 : 1 + (w ? w.strength * (w.kind === 'sand' || w.kind === 'snow' ? 2 : 1.5) : 0);
  }

  // ---- every frame: weather, life, footprints, the punch of fights ---------------------------
  let last = 0;
  function frame(view) {
    const dt = Math.min(100, Math.max(0, now - last));
    last = now;
    if (now - climateAt > 600) { climate = readClimate(); climateAt = now; }
    const z = player.z, W0 = view.cx - view.w / 2, H0 = view.cy - view.h / 2;
    const inView = () => [W0 + Math.random() * view.w, H0 + Math.random() * view.h];
    const day = daylight(), sea = season(), w = weather();

    // the weather
    if (w) {
      const n = Math.round(w.strength * (w.kind === 'rain' ? 11 : w.kind === 'sand' ? 6 : 3) * (dt / 16));
      for (let i = 0; i < n && parts.length < MAX - 140; i++) { // leave room for the fighting
        const [x, y] = inView();
        if (w.kind === 'rain') add({ kind: 'rain', x: x + 40, y: y - 90, z, vx: -2.4, vy: 12 + Math.random() * 3, life: 160 + Math.random() * 200, len: 7 + Math.random() * 8, color: `rgba(200,220,250,${0.45 + Math.random() * 0.4})`, splash: true });
        else if (w.kind === 'snow') add({ kind: 'snow', x, y: y - 40, z, vx: w.strength > 0.8 ? -2.6 : -0.3, vy: 0.45 + Math.random() * 0.6, life: 3400, size: 1 + Math.random() * 2.2, seed: Math.random() * 10, color: '#ffffff' });
        else if (w.kind === 'sand') add({ kind: 'sand', x: W0 + view.w + 10, y, z, vx: -7 - Math.random() * 5, vy: (Math.random() - 0.5) * 0.6, life: 1100, len: 4 + Math.random() * 9, color: `rgba(228,198,140,${0.35 + Math.random() * 0.4})` });
        else if (w.kind === 'ash') {
          if (Math.random() < 0.3) add({ kind: 'ember', x, y: y + 60, z, vx: (Math.random() - 0.5) * 0.5, vy: -0.6 - Math.random() * 0.8, life: 2600, size: 1.4, seed: Math.random() * 10, color: Math.random() < 0.5 ? '#ff8a20' : '#ffc850', glow: true });
          else add({ kind: 'snow', x, y: y - 30, z, vx: 0.3, vy: 0.3 + Math.random() * 0.3, life: 3200, size: 1 + Math.random(), seed: Math.random() * 10, color: '#6e6864' });
        }
      }
      if (w.thunder && now > nextThunder) {
        thunderAt = now;
        nextThunder = now + 9000 + Math.random() * 14000;
        if (typeof Sound !== 'undefined') Sound.play('thunder');
      }
    }
    // deep underground: dust drifting through your light, and water dripping now and then
    if (climate.underground) {
      if (Math.random() < dt / 160 && parts.filter(p => p.kind === 'mote').length < 24) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * 3 * TILE;
        add({ kind: 'mote', x: player.x * TILE + 16 + Math.cos(a) * d, y: player.y * TILE + 16 + Math.sin(a) * d, z, vx: (Math.random() - 0.5) * 0.15, vy: -0.05 - Math.random() * 0.1, life: 4000, size: 1, seed: Math.random() * 10, color: 'rgba(255,240,210,0.5)', glow: true });
      }
      if (Math.random() < dt / 2500) { const [x, y] = inView(); add({ kind: 'drip', x, y: y - 60, z, vx: 0, vy: 5, life: 220, size: 1, color: 'rgba(160,200,240,0.8)', splash: true }); }
    }
    // the season
    if (!climate.underground && climate.kind === 'green' && Math.random() < dt / 260) {
      const [x, y] = inView();
      if (sea === 'autumn') add({ kind: 'leaf', x, y: y - 40, z, vx: -0.4, vy: 0.5, life: 4000, size: 2, color: ['#c8642a', '#e0a030', '#a83a20', '#d8b040'][Math.floor(Math.random() * 4)] });
      if (sea === 'spring') add({ kind: 'leaf', x, y: y - 40, z, vx: -0.3, vy: 0.4, life: 4000, size: 1.6, color: ['#f8c8d8', '#ffe0ea', '#f0a8c0'][Math.floor(Math.random() * 3)] });
    }
    // life: butterflies by the flowers, fireflies at night, fish in the water, gulls over the sea
    if (!climate.underground) {
      if (day > 0.7 && sea !== 'winter' && climate.flowers.length && Math.random() < dt / 900 && parts.filter(p => p.kind === 'butterfly').length < 5) {
        const [fx, fy] = climate.flowers[Math.floor(Math.random() * climate.flowers.length)];
        add({ kind: 'butterfly', x: fx * TILE + 16, y: fy * TILE + 12, z, life: 9000, size: 2, color: ['#f0e040', '#f08ad0', '#80c8ff', '#ffffff'][Math.floor(Math.random() * 4)], seed: Math.random() * 100 });
      }
      if (day < 0.5 && ['green', 'swamp', 'jungle'].includes(climate.kind) && Math.random() < dt / (sea === 'summer' ? 120 : 260) && parts.filter(p => p.kind === 'firefly').length < 30) {
        const [x, y] = inView();
        add({ kind: 'firefly', x, y, z, life: 6000, size: 1.5, color: '#e8ff80', glow: true, seed: Math.random() * 100 });
      }
      if (climate.waters.length > 4 && Math.random() < dt / 1800) {
        const [fx, fy] = climate.waters[Math.floor(Math.random() * climate.waters.length)];
        add({ kind: 'fish', x: fx * TILE + 16, y: fy * TILE + 18, z, vx: (Math.random() < 0.5 ? -1 : 1) * 0.5, life: 700, size: 3, color: '#c0d0e0' });
      }
      if (climate.water > 0.25 && day > 0.6 && parts.filter(p => p.kind === 'gull').length < 2 && Math.random() < dt / 3000) {
        const [x, y] = inView();
        add({ kind: 'gull', x, y, z, life: 14000, size: 3, color: '#f4f4f4', seed: Math.random() * 100, cx: x, cy: y });
      }
      // birds resting in the grass, until somebody comes close
      if (day > 0.6 && climate.grass.length && birds.filter(b => !b.flying).length < 4 && Math.random() < dt / 2500) {
        const [bx, by] = climate.grass[Math.floor(Math.random() * climate.grass.length)];
        if (Math.abs(bx - player.x) > 4 || Math.abs(by - player.y) > 4) birds.push({ x: bx * TILE + 8 + Math.random() * 16, y: by * TILE + 10 + Math.random() * 14, z, flying: false, vx: 0, vy: 0, at: now });
      }
    }
    for (let i = birds.length - 1; i >= 0; i--) {
      const b = birds[i];
      const people = players.filter(p => !p.dead && p.z === b.z);
      if (!b.flying && people.some(p => Math.hypot(p.x * TILE + 16 - b.x, p.y * TILE + 16 - b.y) < 3 * TILE)) {
        b.flying = true;
        b.vx = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 2);
        b.vy = -2 - Math.random() * 1.5;
        if (typeof Sound !== 'undefined') Sound.play('flutter');
      }
      if (b.flying) { b.x += b.vx * dt / 16; b.y += b.vy * dt / 16; b.vy *= 0.995; }
      if ((b.flying && now - b.at > 9000) || Math.abs(b.x / TILE - player.x) > 20 || Math.abs(b.y / TILE - player.y) > 16 || b.z !== player.z) birds.splice(i, 1);
      if (b.flying && b.at < now - 4000) b.at = now - 4000;
    }

    // spells and hits: each element its own particles along a missile's way, and a burst
    // with a shockwave where it lands; a sparkle of light rising
    for (const fx of effects) {
      if (fx.z !== z) continue;
      const t = (now - fx.start) / fx.dur;
      if (fx.kind === 'missile' && t >= 0 && t < 1 && fx.style !== 'arrow' && fx.style !== 'bolt') {
        const x = (fx.fx + (fx.tx - fx.fx) * t) * TILE + 16, y = (fx.fy + (fx.ty - fx.fy) * t) * TILE + 16, el = ELEMENTS[fx.style] || ELEMENTS.holy;
        for (let i = 0; i < 3; i++) element(el, x + (Math.random() - 0.5) * 5, y + (Math.random() - 0.5) * 5, z, 0.4);
      }
      if (seen.has(fx)) continue;
      if (fx.kind === 'burst') {
        seen.add(fx);
        const el = ELEMENTS[elementOf(fx.color)], x = fx.x * TILE + 16, y = fx.y * TILE + 16;
        if (fx.color === '#9cf') { // missed, blocked or shrugged off: a grey puff, no blood
          for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2, v = 0.4 + Math.random() * 0.8; add({ kind: 'dust', x, y: y + 2, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 0.5, life: 380, size: 2.4, color: 'rgba(200,215,230,0.75)' }); }
        } else if (!el) { // a plain blow: blood flies, and splashes on the ground (as in Tibia)
          const blood = bloodOf(fx.x, fx.y, z);
          if (blood === undefined) { // nobody there: just the swish of the blow in the dust
            for (let i = 0; i < 4; i++) { const a = Math.random() * Math.PI * 2, v = 0.3 + Math.random() * 0.6; add({ kind: 'dust', x, y: y + 6, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - 0.3, life: 360, size: 2.2, color: 'rgba(190,180,160,0.55)' }); }
          } else {
            const colors = blood ? BLOOD[blood] : ['#d8d0c0', '#a8a090', '#f0e8d8']; // bones chip instead
            for (let i = 0; i < 7; i++) { const a = Math.random() * Math.PI * 2, v = 0.6 + Math.random() * 1.4; add({ kind: blood ? 'drop' : 'shard', x, y: y + 2, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 420, size: 1.6, color: colors[1 + (i % 2)] }); }
            if (blood) stain(fx.x, fx.y, z, blood);
          }
          add({ kind: 'ring', x, y: y + 4, z, life: 260, size: 4, grow: 14, color: 'rgba(255,255,255,0.5)' });
        } else {
          for (let i = 0; i < 14; i++) element(el, x, y, z, 1.6);
          add({ kind: 'ring', x, y: y + 4, z, life: 380, size: 4, grow: 22, color: el.colors[0] });
        }
      } else if (fx.kind === 'sparkle') {
        seen.add(fx);
        for (let i = 0; i < 10; i++) add({ kind: 'mote', x: fx.x * TILE + 6 + Math.random() * 20, y: fx.y * TILE + 22, z, vx: (Math.random() - 0.5) * 0.3, vy: -0.7 - Math.random() * 0.8, life: 900, size: 1.5, seed: Math.random() * 10, color: fx.color || '#fff6a0', glow: true });
      }
    }

    // a level up: a column of golden light, a ring, and the news across the screen
    if (lastLevel && player.level > lastLevel && player.level <= lastLevel + 2 && !player.dead) { // (not the jump to your level when you log in)
      const x = player.x * TILE + 16, y = player.y * TILE + 24;
      for (let i = 0; i < 40; i++) add({ kind: 'mote', x: x + (Math.random() - 0.5) * 22, y: y - Math.random() * 10, z, vx: (Math.random() - 0.5) * 0.3, vy: -1 - Math.random() * 1.8, life: 1400, size: 2, seed: Math.random() * 10, color: Math.random() < 0.5 ? '#ffe070' : '#fff6c0', glow: true });
      add({ kind: 'ring', x, y, z, life: 700, size: 6, grow: 40, color: '#ffe070' });
      add({ kind: 'column', x, y, z, life: 1300, size: 14, color: '#ffe8a0' });
      levelBanner = { text: `Level ${player.level}!`, at: now };
    }
    lastLevel = player.level;

    // particles move and grow old; raindrops and drips leave a ring where they land
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.age > p.life || p.z !== z) {
        if (p.splash && p.z === z && parts.length < MAX - 20) add({ kind: 'ring', x: p.x, y: p.y, z, life: 280, size: 1, grow: 5, color: 'rgba(200,225,255,0.6)', flat: true });
        parts.splice(i, 1);
        continue;
      }
      const k = dt / 16;
      if (p.kind === 'butterfly') { p.x += Math.sin(p.age / 300 + p.seed) * 0.8 * k; p.y += Math.cos(p.age / 210 + p.seed * 2) * 0.6 * k - 0.05 * k; }
      else if (p.kind === 'firefly') { p.x += Math.sin(p.age / 700 + p.seed) * 0.3 * k; p.y += Math.cos(p.age / 900 + p.seed) * 0.25 * k; }
      else if (p.kind === 'gull') { p.x = p.cx + Math.cos(p.age / 1400 + p.seed) * 70; p.y = p.cy + Math.sin(p.age / 1400 + p.seed) * 30; }
      else if (p.kind === 'leaf') { p.x += (p.vx + Math.sin(p.age / 400) * 0.6) * k; p.y += p.vy * k; }
      else if (p.kind === 'fish' || p.kind === 'ring' || p.kind === 'column') { p.x += (p.vx || 0) * k; }
      else if (p.kind === 'snow' || p.kind === 'mote' || p.kind === 'ember' || p.kind === 'wisp') { p.x += (p.vx + Math.sin(p.age / 500 + p.seed) * 0.25) * k; p.y += p.vy * k; }
      else if (p.kind === 'flame') { p.x += p.vx * k; p.y += p.vy * k; p.vy -= 0.02 * k; p.size *= 0.985; }
      else if (p.kind === 'bubble') { p.x += Math.sin(p.age / 120 + p.seed) * 0.3 * k; p.y += p.vy * k; }
      else {
        p.x += p.vx * k;
        p.y += p.vy * k;
        if (p.kind === 'spark' || p.kind === 'dust' || p.kind === 'drop' || p.kind === 'shard') p.vy += 0.05 * k;
      }
    }
    for (let i = prints.length - 1; i >= 0; i--) if (now - prints[i].at > 12000) prints.splice(i, 1);
    while (stains.length && now - stains[0].at > STAIN_TIME) stains.shift();
    for (let i = ghosts.length - 1; i >= 0; i--) if (now - ghosts[i].at > 600) ghosts.splice(i, 1);

    // footprints, dust and splashes where people walk
    for (const c of [...players, ...monsters]) {
      if (c.dead || c.z !== z || Math.abs(c.x - player.x) > 14 || Math.abs(c.y - player.y) > 11) continue;
      const key = `${c.x},${c.y}`, was = steps.get(c.id);
      steps.set(c.id, key);
      if (!was || was === key) continue;
      const g = groundAt(c.x, c.y, z), x = c.x * TILE + 16, y = c.y * TILE + 26;
      if (['snow', 'sand', 'ash'].includes(g)) prints.push({ x, y, z, dir: c.dir, at: now, color: g === 'snow' ? 'rgba(150,170,200,0.55)' : g === 'ash' ? 'rgba(20,18,16,0.5)' : 'rgba(150,120,70,0.45)' });
      if (['dirt', 'gravel', 'sandstone', 'sand'].includes(g)) for (let i = 0; i < 3; i++) add({ kind: 'dust', x: x + (Math.random() - 0.5) * 10, y, z, vx: (Math.random() - 0.5) * 0.5, vy: -0.3 - Math.random() * 0.3, life: 500, size: 2, color: g === 'gravel' ? 'rgba(170,165,155,0.6)' : 'rgba(170,140,90,0.5)' });
      if (g === 'swamp') for (let i = 0; i < 4; i++) add({ kind: 'drop', x, y, z, vx: (Math.random() - 0.5) * 1.6, vy: -1.2 - Math.random(), life: 450, size: 1.4, color: 'rgba(120,150,110,0.8)' });
    }
    if (prints.length > 200) prints.splice(0, prints.length - 200);
    if (steps.size > 3000) steps.clear(); // monsters get new ids as they respawn: forget the old ones

    // where you are: the name across the screen as you arrive somewhere new
    if (now - placeCheck > 500) {
      placeCheck = now;
      const here = placeName();
      if (here && here !== place) banner = { name: here, at: now };
      if (here) place = here;
      else if (!placeNear()) place = '';
    }
  }
  // How each element looks flying and bursting: flames rise, ice shards fall, energy
  // crackles, earth and poison bubble up, holy light drifts, death trails wisps.
  const ELEMENTS = {
    fire: { colors: ['#ff7a20', '#ffb040', '#ff4a10'], kind: 'flame' },
    ice: { colors: ['#e8faff', '#a8e0ff', '#ffffff'], kind: 'shard' },
    energy: { colors: ['#e0b0ff', '#b070ff', '#ffffff'], kind: 'zap' },
    earth: { colors: ['#98e058', '#60c030', '#c8ff90'], kind: 'bubble' },
    poison: { colors: ['#98e058', '#60c030', '#c8ff90'], kind: 'bubble' },
    holy: { colors: ['#fff6b0', '#ffe070', '#ffffff'], kind: 'mote' },
    death: { colors: ['#b070d0', '#7040a0', '#e0b0ff'], kind: 'wisp' },
    magic: { colors: ['#a0c8ff', '#d0e4ff', '#ffffff'], kind: 'mote' },
    boulder: { colors: ['#9a9aa0', '#7a7a80', '#b0b0b8'], kind: 'dust' },
  };
  const elementOf = color => Object.keys(ELEMENT_COLORS).find(k => ELEMENT_COLORS[k] === color);
  function element(el, x, y, z, force) {
    const a = Math.random() * Math.PI * 2, v = (0.3 + Math.random()) * force, color = el.colors[Math.floor(Math.random() * el.colors.length)];
    const base = { x, y, z, color, seed: Math.random() * 10, glow: el.kind !== 'dust' };
    if (el.kind === 'flame') add({ ...base, kind: 'flame', vx: Math.cos(a) * v * 0.6, vy: -0.4 - Math.random() * force * 0.6, life: 520, size: 2.6 });
    else if (el.kind === 'shard') add({ ...base, kind: 'shard', vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6, life: 560, size: 2 });
    else if (el.kind === 'zap') add({ ...base, kind: 'zap', vx: Math.cos(a) * v * 1.4, vy: Math.sin(a) * v * 1.4, life: 240, size: 1.5 });
    else if (el.kind === 'bubble') add({ ...base, kind: 'bubble', vx: 0, vy: -0.3 - Math.random() * 0.6, life: 800, size: 1.5 + Math.random() * 1.5, glow: false });
    else if (el.kind === 'wisp') add({ ...base, kind: 'wisp', vx: Math.cos(a) * v * 0.5, vy: -0.3 - Math.random() * 0.5, life: 900, size: 2 });
    else if (el.kind === 'dust') add({ ...base, kind: 'dust', vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.4, life: 500, size: 2.5 });
    else add({ ...base, kind: 'mote', vx: Math.cos(a) * v * 0.5, vy: -0.4 - Math.random() * force * 0.5, life: 800, size: 1.8 });
  }
  let lastLevel = 0, levelBanner = null;

  // The named place you're in: a town, a sight, an island.
  function places() {
    const list = [];
    if (typeof MAP_TOWNS !== 'undefined' && (typeof builtinWorld === 'undefined' || builtinWorld)) {
      for (const [name, x, y, z] of MAP_TOWNS) list.push([name, x, y, z, name === 'Glintvault Bank' ? 8 : 24]);
      for (const [name, x, y, z] of MAP_SIGHTS) list.push([name, x, y, z, 14]);
      for (const l of map.labels || []) list.push([l.name, l.x, l.y, l.z, 12]);
    }
    return list;
  }
  // (On the starter island you're on the starter island, whatever lies close across the water.)
  const placeName = () => (places().find(([, x, y, z, r]) => z === player.z && Math.abs(x - player.x) <= r && Math.abs(y - player.y) <= r && onIsle({ x, y }) === onIsle(player)) || [])[0];
  const placeNear = () => places().some(([, x, y, z, r]) => z === player.z && Math.abs(x - player.x) <= r + 6 && Math.abs(y - player.y) <= r + 6);

  // ---- creatures: a white flash and a knock when hit; a burst and a fade when they die -------
  function creature(c, img) {
    let k = known.get(c.id);
    if (!k) { k = { hp: c.hp, flash: 0, kx: 0, ky: 0 }; known.set(c.id, k); }
    if (c.hp < k.hp && c.hp >= 0) {
      const lost = k.hp - c.hp;
      k.flash = 1;
      const dx = c === player ? 0 : Math.sign(c.x - player.x), dy = c === player ? 0 : Math.sign(c.y - player.y);
      k.kx = dx * 0.09; k.ky = dy * 0.09;
      if (c === player && lost > c.maxHp * 0.12) { shake = Math.min(7, 2 + (lost / c.maxHp) * 18); shakeAt = now; }
      else if (c !== player && lost > c.maxHp * 0.3) { shake = 2.5; shakeAt = now; }
    }
    if (c.hp > k.hp && c.type === 'player' && c.hp - k.hp >= c.maxHp * 0.06 && c.z === player.z) { // healed: green light rising
      for (let i = 0; i < 12; i++) add({ kind: 'mote', x: c.x * TILE + 6 + Math.random() * 20, y: c.y * TILE + 26 - Math.random() * 8, z: c.z, vx: (Math.random() - 0.5) * 0.2, vy: -0.6 - Math.random() * 0.9, life: 900, size: 1.8, seed: Math.random() * 10, color: Math.random() < 0.5 ? '#80ff90' : '#d0ffd0', glow: true });
    }
    k.hp = c.hp;
    Object.assign(k, { x: c.x, y: c.y, z: c.z, img, at: now, monster: c.type !== 'player' && c.type !== 'npc', blood: bloodKind(c) });
    k.flash = Math.max(0, k.flash - 0.09);
    k.kx *= 0.8; k.ky *= 0.8;
    return { flash: k.flash, dx: k.kx, dy: k.ky };
  }
  // after the creatures were drawn: whoever we knew that is gone (or dead) burst and fade
  function settle(alive) {
    for (const [id, k] of known) {
      if (alive.has(id)) continue;
      known.delete(id);
      if (!k.monster || k.z !== player.z || now - k.at > 300 || Math.abs(k.x - player.x) > 12 || Math.abs(k.y - player.y) > 10) continue;
      ghosts.push({ x: k.x, y: k.y, z: k.z, img: k.img, at: now });
      add({ kind: 'wisp', x: k.x * TILE + 16, y: k.y * TILE + 12, z: k.z, vx: 0, vy: -0.55, life: 1300, size: 3, seed: Math.random() * 10, color: '#dceaff', glow: true }); // a soul rising
      for (let i = 0; i < 14; i++) { const a = Math.random() * Math.PI * 2, v = 0.6 + Math.random() * 1.6; add({ kind: 'spark', x: k.x * TILE + 16, y: k.y * TILE + 18, z: k.z, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6, life: 520, size: 2, color: Math.random() < 0.5 ? '#c03030' : '#f0e0d0' }); }
    }
  }
  function offset() { // the screen shaking, in world pixels
    const t = (now - shakeAt) / 280;
    if (t > 1) return [0, 0];
    const a = shake * (1 - t);
    return [(Math.random() - 0.5) * 2 * a, (Math.random() - 0.5) * 2 * a];
  }

  // ---- drawing --------------------------------------------------------------------------------
  // A soft round glow of a colour, and a soft snowflake: made once, drawn at any size.
  const sprites = new Map();
  const soft = (key, color, core) => {
    if (sprites.has(key)) return sprites.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d'), grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, color);
    grad.addColorStop(core, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = core > 0.3 ? 1 : 0.55;
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    sprites.set(key, c);
    return c;
  };
  const glowSprite = color => soft(`glow:${color}`, color, 0.05);
  const flakeSprite = color => soft(`flake:${color}`, color, 0.45);
  // A splash of blood in pixels: a blob and a few drops around it (a dozen of each kind).
  const splashSprite = (kind, v) => {
    const key = `splash:${kind}:${v}`;
    if (sprites.has(key)) return sprites.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = 24;
    const g = c.getContext('2d'), cols = BLOOD[kind];
    let s = v * 7919 + 13;
    const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2, d = r() * 4.5;
      g.fillStyle = cols[i % 4 === 0 ? 0 : 1];
      g.fillRect(Math.round(12 + Math.cos(a) * d) - 1, Math.round(12 + Math.sin(a) * d * 0.7) - 1, 2 + Math.round(r()), 2);
    }
    for (let i = 0, n = 3 + Math.floor(r() * 4); i < n; i++) {
      const a = r() * Math.PI * 2, d = 5 + r() * 6;
      g.fillStyle = cols[Math.floor(r() * 3)];
      g.fillRect(Math.round(12 + Math.cos(a) * d), Math.round(12 + Math.sin(a) * d * 0.7), r() < 0.5 ? 2 : 1, r() < 0.5 ? 2 : 1);
    }
    g.fillStyle = cols[2];
    g.fillRect(11, 10, 2, 1); // still wet
    sprites.set(key, c);
    return c;
  };
  // Whose blood: red for players and most beasts, green for slimy things, null for bones and
  // spirits - and undefined when nobody is there (an area attack sweeping empty ground).
  const bloodKind = c => {
    const corpse = c.type === 'player' ? 'blood' : c.def && c.def.corpse;
    return corpse === 'slime' ? 'green' : corpse === 'bones' || corpse === 'none' ? null : 'red';
  };
  function bloodOf(x, y, z) {
    const at = o => !o.dead && o.x === x && o.y === y && o.z === z;
    const c = players.find(at) || monsters.find(at);
    if (c) return bloodKind(c);
    for (const k of known.values()) if (k.x === x && k.y === y && k.z === z && now - k.at < 500) return k.blood; // the blow that killed it
    return undefined;
  }
  function stain(x, y, z, kind) {
    const g = groundAt(x, y, z);
    if (!g || g === 'water' || g === 'lava' || g === 'swamp') return;
    stains.push({ x: x * TILE + 16 + (Math.random() - 0.5) * 12, y: y * TILE + 20 + (Math.random() - 0.5) * 8, z, at: now, kind, v: Math.floor(Math.random() * 12) });
    if (stains.length > 90) stains.shift();
  }
  // On the ground, under what stands on it: footprints, and deep water darker with glints of sun.
  function ground(g, ox, oy, z, x0, x1, y0, y1, groundOf = (x, y) => groundAt(x, y, z)) {
    for (const s of stains) { // blood soaks in and fades
      if (s.z !== z) continue;
      const left = STAIN_TIME - (now - s.at);
      g.globalAlpha = Math.max(0, Math.min(0.92, left / (STAIN_TIME * 0.35)));
      g.drawImage(splashSprite(s.kind, s.v), Math.round(ox + s.x - 12), Math.round(oy + s.y - 12));
    }
    g.globalAlpha = 1;
    for (const p of prints) {
      if (p.z !== z) continue;
      const fade = 1 - (now - p.at) / 12000, side = (Math.floor(p.at / 120) % 2) * 2 - 1, across = p.dir === 1 || p.dir === 3;
      g.globalAlpha = Math.max(0, fade);
      g.fillStyle = p.color;
      g.fillRect(ox + p.x - 2 + (across ? 0 : side * 3), oy + p.y - 2 + (across ? side * 2 : 0), across ? 4 : 2, across ? 2 : 4);
    }
    g.globalAlpha = 1;
    const wet = (x, y) => groundOf(x, y) === 'water';
    const day = daylight();
    // Deeper the further from land (up to 4 tiles out). The shade is blended between the middles of the
    // tiles in 8-pixel steps, so it fades smoothly instead of showing each tile as a square.
    const depths = new Map(), SHADE = [0, 0.02, 0.08, 0.17, 0.26];
    const depthAt = (x, y) => {
      const k = x * 65536 + y;
      if (depths.has(k)) return depths.get(k);
      let depth = 0;
      if (wet(x, y)) while (depth < 4) {
        const d = depth + 1;
        let open = true;
        for (let i = -d; i <= d && open; i++) open = wet(x + i, y - d) && wet(x + i, y + d) && wet(x - d, y + i) && wet(x + d, y + i);
        if (!open) break;
        depth = d;
      }
      depths.set(k, SHADE[depth]);
      return SHADE[depth];
    };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!wet(x, y)) continue;
      const a = depthAt(x, y), aw = depthAt(x - 1, y), ae = depthAt(x + 1, y), an = depthAt(x, y - 1), as = depthAt(x, y + 1);
      if (a + aw + ae + an + as > 0) {
        const corner = (dx, dy) => (a + depthAt(x + dx, y) + depthAt(x, y + dy) + depthAt(x + dx, y + dy)) / 4;
        const c = [[corner(-1, -1), corner(1, -1)], [corner(-1, 1), corner(1, 1)]]; // the shade at the tile's corners
        for (let by = 0; by < 4; by++) for (let bx = 0; bx < 4; bx++) {
          const u = (bx + 0.5) / 4, v = (by + 0.5) / 4;
          // from the corners to the middle (where it is exactly this tile's shade)
          const edge = (c[0][0] * (1 - u) + c[0][1] * u) * (1 - v) + (c[1][0] * (1 - u) + c[1][1] * u) * v;
          const mid = 1 - Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) * 2;
          const alpha = a * mid + edge * (1 - mid);
          if (alpha > 0.004) { g.fillStyle = `rgba(8,24,70,${alpha.toFixed(3)})`; g.fillRect(ox + x * TILE + bx * 8, oy + y * TILE + by * 8, 8, 8); }
        }
      }
      if (day > 0.6) { // the sun glinting on the water
        const h = ((x * 73856093) ^ (y * 19349663)) >>> 0, phase = ((now / 900 + (h % 1000) / 100) % 6);
        if (phase < 0.6) {
          const a = Math.sin((phase / 0.6) * Math.PI) * 0.85, gx = ox + x * TILE + (h % 26) + 3, gy = oy + y * TILE + ((h >> 8) % 26) + 3;
          g.fillStyle = `rgba(255,255,255,${a})`;
          g.fillRect(gx - 2, gy, 5, 1);
          g.fillRect(gx, gy - 2, 1, 5);
        }
      }
    }
  }

  // Above the world: particles, birds, fading dead (in world pixels, with ox/oy).
  function world(g, ox, oy, z) {
    for (const k of ghosts) {
      if (k.z !== z || !k.img) continue;
      const w = Sprites.w(k.img), h = Sprites.h(k.img), t = (now - k.at) / 600, lift = w - TILE + 6;
      g.globalAlpha = Math.max(0, 1 - t);
      g.drawImage(k.img, ox + k.x * TILE - lift, oy + k.y * TILE - lift - t * 10, w, h);
    }
    g.globalAlpha = 1;
    for (const b of birds) {
      if (b.z !== z) continue;
      const x = ox + b.x, y = oy + b.y, flap = b.flying ? Math.sin(now / 60) * 2 : 0;
      g.fillStyle = '#3a3028';
      if (b.flying) { g.fillRect(x - 3, y - flap, 3, 1); g.fillRect(x + 1, y - flap, 3, 1); g.fillRect(x - 1, y, 2, 2); }
      else { g.fillRect(x - 2, y, 4, 2); g.fillRect(x + (Math.floor(now / 700 + b.x) % 2 ? 1 : 2), y - 1 - (Math.floor(now / 500 + b.y) % 3 === 0 ? 0 : 1), 2, 2); }
    }
    for (const p of parts) {
      if (p.z !== z) continue;
      const fade = p.kind === 'rain' ? Math.min(1, p.age / 40, (p.life - p.age) / 40) : Math.max(0, Math.min(1, (p.life - p.age) / 300, p.age / 120)), x = ox + p.x, y = oy + p.y, t = p.age / p.life;
      g.globalAlpha = fade;
      if (p.glow) { // a soft halo first, then the bright core
        g.globalCompositeOperation = 'lighter';
        const halo = p.kind === 'firefly' ? 9 : p.kind === 'column' ? 0 : p.size * 3.2;
        if (halo) g.drawImage(glowSprite(p.color), x - halo, y - halo, halo * 2, halo * 2);
      }
      g.fillStyle = p.color;
      g.strokeStyle = p.color;
      if (p.kind === 'rain') { g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x - p.vx * p.len / p.vy, y - p.len); g.stroke(); }
      else if (p.kind === 'sand') g.fillRect(x, y, p.len, 1);
      else if (p.kind === 'drip') g.fillRect(x, y, 1, 3);
      else if (p.kind === 'snow') { const r = p.size; g.drawImage(flakeSprite(p.color), x - r, y - r, r * 2, r * 2); }
      else if (p.kind === 'ring') {
        const r = p.size + p.grow * Math.sqrt(t);
        g.globalAlpha = fade * (1 - t);
        g.lineWidth = p.flat ? 1 : 2;
        g.beginPath();
        g.ellipse(x, y, r, r * (p.flat ? 0.4 : 0.55), 0, 0, Math.PI * 2);
        g.stroke();
      } else if (p.kind === 'column') { // a pillar of light going up
        const h = 70 * Math.min(1, t * 3), grad = g.createLinearGradient(x, y - h, x, y);
        grad.addColorStop(0, 'rgba(255,240,180,0)');
        grad.addColorStop(1, `rgba(255,240,180,${0.6 * (1 - t)})`);
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = grad;
        g.fillRect(x - p.size / 2, y - h, p.size, h);
      } else if (p.kind === 'butterfly') {
        const f = Math.abs(Math.sin(p.age / 60)) * 3 + 0.5;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - f, y - 2); g.lineTo(x - f, y + 2); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(x + 1, y); g.lineTo(x + 1 + f, y - 2); g.lineTo(x + 1 + f, y + 2); g.closePath(); g.fill();
        g.fillStyle = '#2a2a2a'; g.fillRect(x, y - 1, 1, 3);
      } else if (p.kind === 'firefly') { g.globalAlpha = (0.45 + 0.55 * Math.sin(p.age / 300 + p.seed)) * fade; g.fillRect(x - 1, y - 1, 2, 2); }
      else if (p.kind === 'gull') { const f = Math.sin(p.age / 120) * 2; g.fillRect(x - 4, y - f, 4, 1); g.fillRect(x + 1, y - f, 4, 1); g.fillRect(x - 1, y, 2, 1); }
      else if (p.kind === 'fish') { const hy = y - Math.sin(t * Math.PI) * 10; g.fillRect(x - 2, hy - 1, 5, 2); g.fillStyle = 'rgba(255,255,255,0.6)'; if (t > 0.85 || t < 0.15) g.fillRect(x - 3, y, 7, 1); }
      else if (p.kind === 'leaf') { g.save(); g.translate(x, y); g.rotate(Math.sin(p.age / 300) * 1.2); g.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66); g.restore(); }
      else if (p.kind === 'flame') { const r = Math.max(0.6, p.size * (1 - t * 0.7)); g.fillStyle = t < 0.3 ? '#fff0a0' : p.color; g.fillRect(x - r / 2, y - r, r, r * 1.6); }
      else if (p.kind === 'shard') { g.beginPath(); g.moveTo(x, y - 2); g.lineTo(x + 1.2, y); g.lineTo(x, y + 2); g.lineTo(x - 1.2, y); g.closePath(); g.fill(); }
      else if (p.kind === 'zap') { g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 6); g.lineTo(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8); g.stroke(); }
      else if (p.kind === 'bubble') { g.lineWidth = 1; g.beginPath(); g.arc(x, y, p.size, 0, Math.PI * 2); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x - p.size / 2, y - p.size / 2, 1, 1); }
      else if (p.kind === 'wisp') { g.globalAlpha = fade * 0.8; g.beginPath(); g.ellipse(x, y, p.size * 0.7, p.size * 1.3, 0, 0, Math.PI * 2); g.fill(); }
      else g.fillRect(x - p.size / 2, y - p.size / 2, p.size, p.size);
      g.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = 1;
  }

  // Light and dark, in canvas pixels: the night, holes of light, and coloured glows on top.
  const LIGHT_COLORS = {
    temple_lantern_se: '255,214,140', torch: '255,170,80', wall_torch: '255,170,80', campfire: '255,150,60', lamppost: '255,210,130', crystal: '120,210,255', obelisk: '120,220,255',
    cauldron: '130,255,110', teleport: '190,130,255', lava: '255,90,30', window: '255,200,120', you: '255,230,190', fire: '255,120,40', energy: '200,140,255', poison: '140,255,100',
  };
  function light(view, screen, pv, amount, underground) {
    const lights = [{ x: pv.x, y: pv.y, r: now < player.lightUntil ? 6.5 : 3.5, color: LIGHT_COLORS.you, flicker: false }];
    // other players' torchlight lights up the night for everyone, as in Tibia
    for (const c of players) {
      if (c === player || c.dead || c.z !== player.z || !(now < c.lightUntil)) continue;
      const v = visual(c);
      lights.push({ x: v.x, y: v.y, r: 6.5, color: LIGHT_COLORS.you, flicker: false, carried: true });
    }
    for (let z = view.minZ; z <= view.maxZ; z++) {
      const d = z - view.z;
      for (let y = player.y - 11; y <= player.y + 11; y++) for (let x = player.x - 14; x <= player.x + 14; x++) {
        const t = map.get(x, y, z);
        if (!t) continue;
        if (t.ground && THINGS[t.ground].light) lights.push({ x: x - d, y: y - d, r: 1.6, color: LIGHT_COLORS[t.ground], flicker: true });
        for (const id of t.items) {
          if (THINGS[id].light) lights.push({ x: x - d, y: y - d, r: THINGS[id].light, color: LIGHT_COLORS[id] || '255,190,110', flicker: id !== 'crystal' && id !== 'obelisk' && !id.startsWith('temple_lantern') });
          else if (id === 'window' && !underground && amount > 0.25) lights.push({ x: x - d, y: y - d, r: 1.4, color: LIGHT_COLORS.window, flicker: true, soft: true });
        }
      }
    }
    for (const f of fields) if (f.z === player.z && f.kind !== 'magic_wall') lights.push({ x: f.x, y: f.y, r: 1.6, color: LIGHT_COLORS[f.kind] || '255,150,60', flicker: true });
    // fire breathes: a slow swell, a quick flutter and a sputter now and then, never in step
    const flick = l => 1 + 0.05 * Math.sin(now / 160 + l.x * 7 + l.y * 3) + 0.035 * Math.sin(now / 47 + l.x * 13) + 0.025 * Math.sin(now / 19 + l.y * 5);
    const rad = l => l.r * TILE * SCALE * (l.flicker ? flick(l) : 1);
    if (amount > 0.02) {
      dctx.globalCompositeOperation = 'source-over';
      dctx.clearRect(0, 0, dark.width, dark.height);
      dctx.fillStyle = underground ? `rgba(4,3,10,${amount})` : `rgba(6,12,40,${Math.min(0.92, amount * 1.3)})`;
      dctx.fillRect(0, 0, dark.width, dark.height);
      dctx.globalCompositeOperation = 'destination-out';
      for (const l of lights) { // pools of light: yours clear, the others leave a little of the night
        const yours = l === lights[0] || l.carried, [sx, sy] = screen(l.x + 0.5, l.y + 0.5), r = rad(l) * (yours ? 1 : l.soft ? 0.7 : 0.75);
        const grad = dctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        grad.addColorStop(0, `rgba(0,0,0,${yours ? 1 : l.soft ? 0.5 : 0.85})`);
        grad.addColorStop(0.45, `rgba(0,0,0,${yours ? 0.85 : l.soft ? 0.25 : 0.55})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        dctx.fillStyle = grad;
        dctx.fillRect(sx - r, sy - r, r * 2, r * 2);
      }
      ctx.imageSmoothingEnabled = true; // (the night is soft: no blocks when it's spread over a finer canvas)
      ctx.drawImage(dark, 0, 0);
      ctx.imageSmoothingEnabled = false;
    }
    // warm and cold glows, stronger the darker it is
    const glow = Math.max(0.12, amount);
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      if (l === lights[0]) continue;
      const [sx, sy] = screen(l.x + 0.5, l.y + 0.5), r = rad(l) * 0.8;
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      grad.addColorStop(0, `rgba(${l.color},${0.34 * glow * (l.flicker ? 0.8 + 3 * (flick(l) - 1) + 0.2 : 1)})`);
      grad.addColorStop(1, `rgba(${l.color},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // Over everything, in canvas pixels: clouds, the colours of dawn and dusk and of the
  // season, the weather's tint, lightning, and the name of the place you arrive at.
  function overlay(screen) {
    const W = viewPxW(), H = viewPxH(), w = weather(), h = worldMinutes() / 60;
    if (!climate.underground) {
      // clouds drifting over the land (the sky is the same for everyone: it follows the clock)
      if (daylight() > 0.5) for (let i = 0; i < 4; i++) {
        const span = 3000, wx = ((i * 977 + now * 0.012) % span) - span / 2 + player.x * TILE * 0.0, wy = ((i * 613) % 1200) - 600;
        const [px] = screen(player.x, player.y);
        const cx = (wx - (player.x * TILE) % span) * SCALE + px, cy = H / 2 + wy * SCALE * 0.5;
        const r = (180 + (i * 53) % 120) * SCALE;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, `rgba(0,0,20,${0.1 + (w ? 0.08 : 0)})`);
        grad.addColorStop(1, 'rgba(0,0,20,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      let tint = null;
      if (h >= 5 && h < 8) tint = [`255,150,110`, 0.15 * (1 - Math.abs(h - 6.4) / 1.6)];
      else if (h >= 18 && h < 21.2) tint = [`255,110,40`, 0.2 * (1 - Math.abs(h - 19.6) / 1.6)];
      if (tint && tint[1] > 0) { ctx.fillStyle = `rgba(${tint[0]},${tint[1]})`; ctx.fillRect(0, 0, W, H); }
      const sea = season();
      if (sea === 'autumn') { ctx.fillStyle = 'rgba(255,160,70,0.05)'; ctx.fillRect(0, 0, W, H); }
      if (sea === 'winter') { ctx.fillStyle = 'rgba(170,200,255,0.06)'; ctx.fillRect(0, 0, W, H); }
      if (w && w.kind === 'rain') { ctx.fillStyle = `rgba(24,34,56,${0.26 * w.strength})`; ctx.fillRect(0, 0, W, H); }
      if (w && w.kind === 'sand') {
        ctx.fillStyle = `rgba(210,170,100,${0.22 * w.strength})`;
        ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 4; i++) { // bands of dust blowing through
          const by = ((i * 211 + now * 0.02) % (H + 200)) - 100, bx = W - ((now * (0.35 + i * 0.07) + i * 400) % (W + 600));
          const grad = ctx.createLinearGradient(0, by - 40, 0, by + 40);
          grad.addColorStop(0, 'rgba(225,190,130,0)');
          grad.addColorStop(0.5, `rgba(225,190,130,${0.22 * w.strength})`);
          grad.addColorStop(1, 'rgba(225,190,130,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(bx - 300, by - 40, W + 300, 80);
        }
      }
      if (w && w.kind === 'snow' && w.strength > 0.8) { ctx.fillStyle = 'rgba(230,240,255,0.16)'; ctx.fillRect(0, 0, W, H); }
      const flash = now - thunderAt;
      if (flash < 400) { ctx.fillStyle = `rgba(230,240,255,${0.5 * (1 - flash / 400) * (flash < 80 || flash > 160 ? 1 : 0.3)})`; ctx.fillRect(0, 0, W, H); }
    }
    // a soft dark edge round the view, deeper at night and below ground
    const edge = climate.underground ? 0.5 : 0.18 + (1 - daylight()) * 0.3;
    const vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, `rgba(0,0,0,${edge})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
    if (levelBanner) {
      const t = (now - levelBanner.at) / 3000;
      if (t > 1) levelBanner = null;
      else {
        const a = t < 0.1 ? t / 0.1 : t > 0.7 ? (1 - t) / 0.3 : 1, pop = t < 0.1 ? 1.4 - t * 4 : 1, size = Math.round(Math.min(52, W / 12) * pop);
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.font = `800 ${size}px Inter, system-ui, sans-serif`;
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 2;
        const gold = ctx.createLinearGradient(0, H * 0.4 - size, 0, H * 0.4);
        gold.addColorStop(0, '#fff3cf');
        gold.addColorStop(1, '#e8b54a');
        ctx.fillStyle = gold;
        ctx.fillText(levelBanner.text, W / 2, H * 0.4);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.globalAlpha = 1;
      }
    }
    if (banner) {
      const t = (now - banner.at) / 3800;
      if (t > 1) banner = null;
      else {
        const a = t < 0.15 ? t / 0.15 : t > 0.75 ? (1 - t) / 0.25 : 1;
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        // the place's name in spaced capitals, a short gold line either side, a soft shadow to read over any ground
        const size = Math.round(Math.min(30, W / 20)), y = H * 0.22, name = banner.name.toUpperCase();
        ctx.font = `600 ${size}px Inter, system-ui, sans-serif`;
        if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.18)}px`;
        ctx.shadowColor = 'rgba(0,0,0,0.75)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = '#f3eee6';
        ctx.fillText(name, W / 2, y);
        const half = ctx.measureText(name).width / 2 + 18;
        ctx.fillStyle = '#e8b54a';
        ctx.fillRect(W / 2 - half - 36, y - size * 0.36, 36, 2);
        ctx.fillRect(W / 2 + half, y - size * 0.36, 36, 2);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        ctx.globalAlpha = 1;
      }
    }
  }

  // What the sound should be like here: the music's mood, and the sounds around you.
  function ambience() {
    if (typeof Sound === 'undefined' || now - lastAmbienceAt < 700) return;
    lastAmbienceAt = now;
    const w = weather(), night = daylight() < 0.5, k = climate.kind;
    let fire = 0;
    for (let y = player.y - 4; y <= player.y + 4; y++) for (let x = player.x - 4; x <= player.x + 4; x++) { const t = tileAt(x, y, player.z); if (t && (t.ground === 'lava' || t.items.some(id => id === 'campfire' || id === 'torch'))) fire = 1; }
    const mood = climate.underground ? 'cave' : climate.town ? (night ? 'night' : 'town') : k === 'frost' ? 'frost' : k === 'desert' ? 'desert' : k === 'swamp' ? 'swamp' : k === 'jungle' ? 'jungle' : k === 'volcano' ? 'volcano' : climate.water > 0.4 ? 'sea' : night ? 'night' : 'wilds';
    Sound.setMood(mood);
    Sound.setAmbience({
      wind: climate.underground ? 0.15 : k === 'frost' || k === 'desert' ? 0.6 + (w ? w.strength * 0.4 : 0) : 0.15 + (w ? w.strength * 0.3 : 0),
      waves: climate.underground ? 0 : Math.min(1, climate.water * 2),
      rain: w && w.kind === 'rain' ? w.strength : 0,
      crickets: !climate.underground && night && ['green', 'swamp', 'jungle'].includes(k) ? 0.7 : 0,
      crowd: climate.town && !night && !climate.underground ? 0.5 : 0,
      fire,
    });
  }
  let lastAmbienceAt = 0;

  return { frame, creature, settle, offset, ground, world, light, overlay, ambience, wind: () => wind(), roofSnow };
})();
