'use strict';
// Resize from the actual game container, including safe-inset changes on rotation.
// Do not subtract visualViewport height: keyboard and iOS standalone already inset it.
(() => {
  if (!touchScreen || typeof ResizeObserver === 'undefined') return;
  let pending = 0;
  const observer = new ResizeObserver(() => {
    if (pending) return;
    pending = requestAnimationFrame(() => { pending = 0; fitView(); });
  });
  observer.observe($('viewport'));
})();

// The phone's layout is in place now (this is the last script): show the page, hidden till now so the computer's
// layout doesn't flash up while the scripts load (see the top of index.html)
requestAnimationFrame(() => document.documentElement.classList.remove('booting'));
