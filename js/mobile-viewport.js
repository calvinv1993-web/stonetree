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
