'use strict';
// Sound effects, background music for each kind of place, and the sounds around you
// (wind, waves, rain, crickets, a busy square, a fire), all synthesized with the Web
// Audio API: no files.

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
    equip: () => noise(0.06, 0.25, 2500),
    thunder: () => { noise(2.2, 0.7, 220); noise(0.4, 0.4, 900); tone(45, 1.6, 'sine', 0.25, -15); },
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
  function musicTick() {
    if (!state.musicOn || !ctx) return;
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

  window.addEventListener('pointerdown', () => { if (state.musicOn || state.enabled) audio(); }, { once: true });
  window.addEventListener('keydown', () => { if (state.musicOn || state.enabled) audio(); }, { once: true });
  musicTimer = setInterval(musicTick, 600);
  ambienceTimer = setInterval(ambienceTick, 250);

  return {
    get enabled() { return state.enabled; },
    get musicOn() { return state.musicOn; },
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
