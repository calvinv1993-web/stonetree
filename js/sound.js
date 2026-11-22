'use strict';
// Sound effects, background music for each kind of place, and the sounds around you
// (wind, waves, rain, crickets, a busy square, a fire), all synthesized with the Web
// Audio API: no files. Except the title music (sprites/music/: Sound.title): The Shadowed Gate at the gate, then The
// Broken Seal from the opening's story through choosing your path.

const Sound = (() => {
  let ctx = null, master = null, musicTimer = 0, mood = 'day', step = 0;
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem('tilequest.sound')) || {};
  } catch (e) { /* defaults */ }
  const state = { enabled: saved.enabled !== false, musicOn: saved.musicOn !== false };
  const persist = () => {
    try {
      localStorage.setItem('tilequest.sound', JSON.stringify(state));
    } catch (e) { /* not important */ }
  };

  // Browsers only allow audio after the player clicked or pressed a key.
  function audio() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type = 'square', vol = 0.3, slide = 0, delay = 0) {
    const t = ctx.currentTime + delay, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, cutoff) {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    src.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(master);
    src.start();
  }

  const SOUNDS = {
    hit: () => { noise(0.08, 0.5, 1200); tone(120, 0.08, 'square', 0.12, -40); },
    hurt: () => tone(220, 0.15, 'sawtooth', 0.15, -100),
    shoot: () => noise(0.12, 0.25, 3000),
    magic: () => { tone(600, 0.2, 'sine', 0.18, 600); tone(900, 0.2, 'triangle', 0.08, 300, 0.05); },
    death: () => tone(300, 0.45, 'sawtooth', 0.15, -250),
    coin: () => { tone(988, 0.08, 'square', 0.1); tone(1319, 0.15, 'square', 0.1, 0, 0.08); },
    level: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.18, 0, i * 0.1)),
    potion: () => tone(400, 0.25, 'sine', 0.18, 300),
    door: () => noise(0.15, 0.35, 500),
    bell: () => { for (let i = 0; i < 3; i++) for (const [f, v] of [[196, 0.2], [392, 0.1], [470, 0.06], [588, 0.05]]) tone(f, 2.4, 'sine', v, 0, i * 1.2); }, // dong, dong, dong
    equip: () => noise(0.06, 0.25, 2500),
    thunder: () => { noise(2.2, 0.7, 220); noise(0.4, 0.4, 900); tone(45, 1.6, 'sine', 0.25, -15); },
    // the siege of the north wall (The Last Town, game-siege.js): a war horn, low and long; a cannon's roar
    horn: () => { tone(98, 1.6, 'sawtooth', 0.12, 8); tone(147, 1.4, 'sawtooth', 0.06, 6, 0.08); tone(49, 1.7, 'sine', 0.2, 0); },
    cannon: () => { noise(1.1, 0.9, 300); noise(0.25, 0.6, 1600); tone(55, 0.6, 'sine', 0.35, -30); },
    flutter: () => { for (let i = 0; i < 4; i++) setTimeout(() => noise(0.05, 0.12, 2200), i * 60); },
    ignite: () => { noise(0.35, 0.25, 700); tone(180, 0.3, 'sawtooth', 0.04, 120); },
    douse: () => noise(0.6, 0.22, 4200),
    anvil: () => { tone(1250, 0.35, 'square', 0.07, -60); tone(1870, 0.25, 'triangle', 0.06, -90); noise(0.05, 0.3, 3500); },
    whistle: () => { tone(1760, 0.5, 'sine', 0.16, 140); tone(1760, 0.9, 'sine', 0.05, -220, 0.45); },
    bell: () => [0, 1.1].forEach(d => { tone(392, 2.2, 'sine', 0.2, -6, d); tone(988, 1.4, 'sine', 0.06, -10, d); }),
  };

  // Music: a slow melody over a bass note, in the scale and voice of the place you're in.
  const MOODS = {
    town: { scale: [262, 294, 330, 392, 440, 523, 587], voice: 'triangle', notes: 0.75, length: 0.9 },
    wilds: { scale: [262, 294, 311, 349, 392, 440, 466], voice: 'sine', notes: 0.55, length: 1.4 },
    night: { scale: [220, 262, 294, 330, 392, 440], voice: 'sine', notes: 0.45, length: 1.6 },
    frost: { scale: [523, 587, 659, 784, 880, 1047], voice: 'sine', notes: 0.4, length: 2.4 },
    desert: { scale: [294, 311, 370, 392, 440, 466, 523], voice: 'triangle', notes: 0.6, length: 0.8 },
    swamp: { scale: [147, 175, 196, 208, 262, 294], voice: 'sine', notes: 0.35, length: 2 },
    jungle: { scale: [330, 392, 440, 494, 587, 659], voice: 'square', notes: 0.7, length: 0.25 },
    volcano: { scale: [110, 117, 147, 156, 165, 220], voice: 'sawtooth', notes: 0.3, length: 1.8 },
    cave: { scale: [196, 208, 247, 262, 311, 330], voice: 'sine', notes: 0.3, length: 2.2 },
    sea: { scale: [294, 330, 370, 440, 494, 587], voice: 'triangle', notes: 0.55, length: 1.2 },
  };
  // The title music: a track (TITLE_TRACKS) from the gate (game-ui.js Gate: The Shadowed Gate), another from the
  // opening's story (Intro: The Broken Seal), each over and over, one fading into the next; it fades out once you're in
  // the world (welcome(false)). A browser lets it start only once you've touched the page: tried at once, else at the
  // first tap, click or key (on a phone the end of a touch is what counts, not its start). Plain audio elements: they
  // play with a phone's ring switch on silent too (Web Audio wouldn't); an iPhone won't fade them, so there one stops
  // at the end of its fade instead.
  const TITLE_TRACKS = { gate: 'the-shadowed-gate', story: 'the-broken-seal' };
  const title = { track: null, wanted: false, els: {}, fades: {} };
  function titleFile(name) {
    const file = `music/${TITLE_TRACKS[name]}.mp3`, h = typeof SPRITE_HASHES !== 'undefined' && SPRITE_HASHES[file];
    return `sprites/${file}${h ? `?h=${h}` : ''}`;
  }
  const titleEl = name => {
    if (!title.els[name]) { const el = new Audio(titleFile(name)); el.loop = true; el.preload = 'auto'; title.els[name] = el; }
    return title.els[name];
  };
  function titlePlay() {
    if (!title.wanted || !state.musicOn || !title.track) return;
    const el = titleEl(title.track);
    clearInterval(title.fades[title.track]);
    el.volume = 0.6;
    const tried = el.play();
    if (tried && tried.catch) tried.catch(() => { /* not yet: after the first tap or key */ });
  }
  // a track fades out (ms) and stops, unless it's wanted again meanwhile
  function titleFade(name, ms) {
    const el = title.els[name];
    if (!el || el.paused) return;
    clearInterval(title.fades[name]);
    const from = el.volume, t0 = performance.now();
    title.fades[name] = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      el.volume = from * (1 - k);
      if (k >= 1) { clearInterval(title.fades[name]); if (!(title.wanted && title.track === name)) { el.pause(); el.currentTime = 0; } }
    }, 50);
  }
  function titleStart(name = 'gate') {
    if (navigator.webdriver && !/[?&]music\b/.test(location.search)) return;
    if (!Object.hasOwn(TITLE_TRACKS, name)) return;
    const before = title.track;
    title.wanted = true; title.track = name;
    if (before && before !== name) titleFade(before, 1800);
    titlePlay();
  }
  function titleStop(ms = 2500) {
    title.wanted = false;
    for (const name of Object.keys(title.els)) titleFade(name, ms);
  }
  const titleNow = () => title.track && title.els[title.track];
  for (const kind of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
    window.addEventListener(kind, () => { if (title.wanted && (!titleNow() || titleNow().paused)) titlePlay(); }, { capture: true, passive: true });
  }

  function musicTick() {
    if (!state.musicOn || !ctx || title.wanted) return; // (the title music plays: no tunes of the places over it)
    const m = MOODS[mood] || MOODS.wilds;
    if (step % 4 === 0) tone(m.scale[0] / 2, 2.2, 'sine', 0.05);
    if (mood === 'jungle' && step % 2 === 0) noise(0.05, 0.08, 1800); // a drum
    if (Math.random() < m.notes) tone(m.scale[Math.floor(Math.random() * m.scale.length)], m.length, m.voice, m.voice === 'square' || m.voice === 'sawtooth' ? 0.015 : 0.04);
    step++;
  }

  // The sounds around you: endless filtered noise for wind, waves, rain and a busy
  // square; chirps for crickets and crackles for fire. setAmbience() says how loud each is.
  const beds = {};
  let ambience = {}, ambienceTimer = 0;
  function loopNoise() {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  }
  function bed(name, type, freq, q) {
    if (beds[name]) return beds[name];
    const src = loopNoise(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(master);
    src.start();
    return (beds[name] = { filter, gain });
  }
  const BEDS = { wind: ['bandpass', 420, 0.6, 0.35], waves: ['lowpass', 520, 0.7, 0.4], rain: ['highpass', 1800, 0.5, 0.18], crowd: ['bandpass', 900, 1.8, 0.12] };
  function ambienceTick() {
    if (!ctx || !state.enabled) return;
    const t = ctx.currentTime;
    for (const [name, [type, freq, q, loud]] of Object.entries(BEDS)) {
      const level = ambience[name] || 0;
      if (!level && !beds[name]) continue;
      const b = bed(name, type, freq, q);
      let target = level * loud;
      if (name === 'waves') target *= 0.55 + 0.45 * Math.sin(t / 2.3); // waves come and go
      if (name === 'wind') b.filter.frequency.setTargetAtTime(300 + 250 * (1 + Math.sin(t / 3.7)), t, 1);
      if (name === 'crowd') target *= 0.7 + 0.3 * Math.random();
      b.gain.gain.setTargetAtTime(target, t, 0.6);
    }
    if (ambience.crickets && Math.random() < 0.5) for (let i = 0; i < 3; i++) tone(4200 + Math.random() * 300, 0.04, 'sine', 0.02 * ambience.crickets, 0, i * 0.07);
    if (ambience.fire && Math.random() < 0.6) noise(0.03, 0.12 * ambience.fire, 2500);
  }

  // (until the sound has started: on a phone only the end of a touch lets it, so every kind of tap tries)
  for (const kind of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
    window.addEventListener(kind, () => { if ((state.musicOn || state.enabled) && (!ctx || ctx.state !== 'running')) audio(); }, { capture: true, passive: true });
  }
  musicTimer = setInterval(musicTick, 600);
  ambienceTimer = setInterval(ambienceTick, 250);

  return {
    get enabled() { return state.enabled; },
    get musicOn() { return state.musicOn; },
    // the title music: start('gate') at the gate, start('story') from the opening's story, stop() in the world (fading)
    title: {
      start: titleStart,
      stop: titleStop,
      get playing() { return !!titleNow() && !titleNow().paused ? title.track : ''; },
    },
    play(name) {
      if (!state.enabled || !SOUNDS[name]) return;
      try {
        audio();
        SOUNDS[name]();
      } catch (e) { /* audio not available */ }
    },
    toggle() {
      state.enabled = !state.enabled;
      if (!state.enabled) for (const b of Object.values(beds)) b.gain.gain.value = 0; // and the sounds around you fall silent
      persist();
    },
    toggleMusic() {
      state.musicOn = !state.musicOn;
      if (state.musicOn) audio();
      if (!state.musicOn) for (const el of Object.values(title.els)) el.pause(); else titlePlay();
      persist();
    },
    setMood(m) {
      mood = m;
    },
    // levels 0..1: { wind, waves, rain, crickets, crowd, fire }
    setAmbience(levels) {
      ambience = state.enabled ? levels : {};
    },
    stop() {
      clearInterval(musicTimer);
      clearInterval(ambienceTimer);
    },
  };
})();
