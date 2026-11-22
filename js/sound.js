'use strict';
// The game's sound: SORTIA's title music (sprites/music/: Sound.title): The Shadowed Gate at the gate, then The Broken
// Seal from the opening's story through choosing your path; and a wooden knock when a button is tapped
// (sprites/sounds/button-wood.wav: Sound: on/off in the menu). The game's own synthesized sounds and tunes (hits,
// spells, the music of each place, wind and waves) were taken out: on an iPhone they played at odd moments and badly.
// Sound.play, setMood and setAmbience stay, doing nothing, so the game can still say what it would sound like.

const Sound = (() => {
  let ctx = null;
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem('tilequest.sound')) || {};
  } catch (e) { /* defaults */ }
  const state = { musicOn: saved.musicOn !== false, enabled: saved.enabled !== false };
  const persist = () => {
    try {
      localStorage.setItem('tilequest.sound', JSON.stringify(state));
    } catch (e) { /* not important */ }
  };
  // (Web Audio, for the title music's fades)
  function audio() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  // The title music: a track (TITLE_TRACKS) from the gate (game-ui.js Gate: The Shadowed Gate), another from the
  // opening's story (Intro: The Broken Seal), each over and over; one crossfades into the next (the new one rising as the
  // old one falls, over CROSSFADE ms, on an equal-power curve so it never dips), and it fades out once you're in the
  // world (welcome(false)). A browser lets sound start only from a tap or key: the gate asks for one once it has loaded
  // ("Tap to begin"), and the music is fetched while it loads, so it starts at once. Through Web Audio where it can be,
  // so the fades work on an iPhone too (which won't change an audio element's volume), told to play like music, ring
  // switch on silent or not (navigator.audioSession); a page opened from a file plays the elements as they are.
  const TITLE_TRACKS = { gate: 'the-shadowed-gate', story: 'the-broken-seal' };
  const TITLE_LOUD = 0.6, CROSSFADE = 3000;
  const title = { track: null, wanted: false, tracks: {} };
  function titleFile(name) {
    const file = `music/${TITLE_TRACKS[name]}.mp3`, h = typeof SPRITE_HASHES !== 'undefined' && SPRITE_HASHES[file];
    return `sprites/${file}${h ? `?h=${h}` : ''}`;
  }
  // a track: its audio element, and (with Web Audio) the gain it plays through; made once, fetched at once
  function titleTrack(name) {
    if (title.tracks[name]) return title.tracks[name];
    const el = new Audio(titleFile(name));
    el.loop = true;
    el.preload = 'auto';
    const t = { el, gain: null, timer: 0, level: 0 };
    if (location.protocol !== 'file:') try {
      audio();
      t.gain = ctx.createGain();
      t.gain.gain.value = 0;
      ctx.createMediaElementSource(el).connect(t.gain).connect(ctx.destination);
    } catch (e) { t.gain = null; }
    if (!t.gain) el.volume = 0;
    el.load();
    return (title.tracks[name] = t);
  }
  // a track's loudness from where it is to `to` over ms, rising on a sine or falling on a cosine (equal power together);
  // done() at the end
  function titleRamp(t, to, ms, done) {
    clearInterval(t.timer);
    const from = t.level, t0 = performance.now();
    const set = v => { t.level = v; if (t.gain) t.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.015); else t.el.volume = Math.max(0, Math.min(1, v)); };
    if (ms <= 0) { set(to); if (done) done(); return; }
    t.timer = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      const curve = to > from ? Math.sin(k * Math.PI / 2) : 1 - Math.cos(k * Math.PI / 2);
      set(from + (to - from) * curve);
      if (k >= 1) { clearInterval(t.timer); if (done) done(); }
    }, 30);
  }
  function titlePlay(ms = 1200) {
    if (!title.wanted || !state.musicOn || !title.track) return;
    const t = titleTrack(title.track);
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    const tried = t.el.play();
    if (tried && tried.catch) tried.catch(() => { /* not yet: after the first tap or key */ });
    titleRamp(t, TITLE_LOUD, ms);
  }
  // a track falls silent over ms and stops (and starts from its beginning next time), unless it's wanted again meanwhile
  function titleFade(name, ms) {
    const t = title.tracks[name];
    if (!t || t.el.paused) return;
    titleRamp(t, 0, ms, () => { if (!(title.wanted && title.track === name)) { t.el.pause(); t.el.currentTime = 0; } });
  }
  function titleStart(name = 'gate') {
    if (navigator.webdriver && !/[?&]music\b/.test(location.search)) return;
    if (!Object.hasOwn(TITLE_TRACKS, name)) return;
    const before = title.track, crossing = before && before !== name && title.tracks[before] && !title.tracks[before].el.paused;
    title.wanted = true; title.track = name;
    if (crossing) titleFade(before, CROSSFADE);
    titlePlay(crossing ? CROSSFADE : 1200);
  }
  function titleStop(ms = 2500) {
    title.wanted = false;
    for (const name of Object.keys(title.tracks)) titleFade(name, ms);
  }
  // fetched ahead (the gate waits for it while it loads): done once it can play through, or couldn't be
  function titlePreload(name) {
    if (navigator.webdriver && !/[?&]music\b/.test(location.search)) return Promise.resolve();
    if (!state.musicOn) return Promise.resolve();
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* older browsers */ }
    const el = titleTrack(name).el;
    if (el.readyState >= 4) return Promise.resolve();
    return new Promise(done => { el.addEventListener('canplaythrough', done, { once: true }); el.addEventListener('error', done, { once: true }); });
  }
  const titleNow = () => title.track && title.tracks[title.track] && title.tracks[title.track].el;
  for (const kind of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
    window.addEventListener(kind, () => { if (title.wanted && (!titleNow() || titleNow().paused)) titlePlay(); }, { capture: true, passive: true });
  }

  // The button knock: fetched and decoded once, played through Web Audio (at once, and over itself when tapped fast);
  // from a page opened as a file (where it can't be fetched), an audio element instead. On the press itself (a finger
  // down, a mouse down, Enter or Space on a button in focus), not its release, so it sounds with the touch.
  const KNOCK = (() => { const h = typeof SPRITE_HASHES !== 'undefined' && SPRITE_HASHES['sounds/button-wood.wav']; return `sprites/sounds/button-wood.wav${h ? `?h=${h}` : ''}`; })();
  let knock = null, knockEl = null;
  function loadKnock() {
    if (knock || knockEl) return;
    if (location.protocol === 'file:' || !window.fetch) { knockEl = new Audio(KNOCK); knockEl.preload = 'auto'; return; }
    knock = 'loading';
    fetch(KNOCK).then(r => r.arrayBuffer()).then(data => new Promise((done, fail) => audio().decodeAudioData(data, done, fail)))
      .then(buffer => { knock = buffer; }, () => { knock = null; knockEl = new Audio(KNOCK); });
  }
  function playKnock() {
    if (!state.enabled) return;
    try {
      if (knock && knock !== 'loading') {
        const c = audio(), src = c.createBufferSource(), gain = c.createGain();
        src.buffer = knock; gain.gain.value = 0.8;
        src.connect(gain).connect(c.destination);
        src.start();
      } else if (knockEl) {
        const el = knockEl.cloneNode(); el.volume = 0.8;
        const tried = el.play(); if (tried && tried.catch) tried.catch(() => {});
      }
    } catch (e) { /* no sound this time */ }
  }
  const pressable = el => el && el.closest && el.closest('button:not(:disabled), [role="button"]:not([aria-disabled="true"]), summary');
  window.addEventListener('pointerdown', e => { if (e.button === 0 && pressable(e.target)) playKnock(); }, { capture: true, passive: true });
  window.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat && pressable(document.activeElement)) playKnock(); }, true);
  if (!(navigator.webdriver && !/[?&]music\b/.test(location.search))) setTimeout(loadKnock, 0);

  return {
    get enabled() { return state.enabled; },
    get musicOn() { return state.musicOn; },
    // the title music: preload(track) while the gate loads, start('gate') at its first tap, start('story') from the
    // opening's story (crossfading), stop() in the world (fading)
    title: {
      start: titleStart,
      stop: titleStop,
      preload: titlePreload,
      get levels() { return Object.fromEntries(Object.entries(title.tracks).map(([n, t]) => [n, t.el.paused ? 0 : +t.level.toFixed(2)])); }, // (for tests)
      get playing() { return !!titleNow() && !titleNow().paused ? title.track : ''; },
    },
    play() { /* no game sounds */ },
    knock: playKnock, // (the button knock, for a press that isn't a button)
    toggle() {
      state.enabled = !state.enabled;
      if (state.enabled) loadKnock();
      persist();
    },
    toggleMusic() {
      state.musicOn = !state.musicOn;
      if (!state.musicOn) for (const t of Object.values(title.tracks)) t.el.pause(); else titlePlay();
      persist();
    },
    setMood() { /* no tunes of the places */ },
    setAmbience() { /* no sounds around you */ },
    stop() { titleStop(0); },
  };
})();
