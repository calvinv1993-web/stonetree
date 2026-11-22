(() => {
  const screen = document.querySelector('.screen');
  const hero = screen.querySelector('.hero');
  const light = hero.cloneNode();
  light.classList.add('hero-light');
  light.alt = '';
  light.setAttribute('aria-hidden', 'true');
  hero.after(light);
  const toggle = screen.querySelector('.motion-control');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let playing = !preference.matches;
  let finished = false;
  function sync() {
    screen.dataset.motion = playing && !document.hidden ? 'playing' : 'paused';
    toggle.textContent = finished ? 'Replay motion' : playing ? 'Pause motion' : 'Play motion';
  }
  function restart() {
    finished = false;
    playing = true;
    sync();
    for (const effect of screen.getAnimations({subtree: true})) {
      effect.currentTime = 0;
      effect.play();
    }
  }
  toggle.addEventListener('click', () => {
    if (finished) restart();
    else {
      playing = !playing;
      sync();
    }
  });
  screen.querySelector('.scene-depth').addEventListener('animationend', () => {
    finished = true;
    playing = false;
    sync();
  });
  preference.addEventListener('change', event => {
    playing = !event.matches;
    if (playing && finished) restart();
    else sync();
  });
  document.addEventListener('visibilitychange', sync);
  sync();
  window.captureMotionPreview = seconds => {
    screen.dataset.motion = 'playing';
    for (const effect of screen.getAnimations({subtree: true})) {
      effect.pause();
      effect.currentTime = seconds * 1000;
    }
  };
})();
