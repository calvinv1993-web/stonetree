'use strict';
// The phone's inventory drawer (browser only): your equipment and backpack side by side, pulled up from the action bar.
//   closed    only the tab above the smart button shows
//   compact   swipe the tab up (or tap it): the drawer over the bottom ~42% of the map, equipment left, backpack right
//   expanded  swipe up again: up to the status bar, with your other open containers and your gear's numbers too
// Swipe down on its handle to go back a step; the action bar stays where it is and works, the chat line steps aside.
// The drawer holds the page's own equipment and container windows (game-ui.js draws them, with their dragging and
// stacks), moved in while it's open and put back after, so the Character sheet still finds them in their places.
// A swipe on the tab or the handle never walks: its pointer is caught here, not by the map.
const InventoryDrawer = (() => {
  const SWIPE = 28; // px up or down before a drag counts as a swipe
  let drawer = null, tab = null, stage = 0;
  const homes = new Map(); // what was moved in: where to put it back

  function borrow(el) {
    if (!el || homes.has(el)) return;
    homes.set(el, { parent: el.parentNode, next: el.nextSibling });
  }
  function giveBack() {
    for (const [el, { parent, next }] of homes) parent.insertBefore(el, next && next.parentNode === parent ? next : null);
    homes.clear();
  }

  function set(next) {
    stage = Math.max(0, Math.min(2, next));
    document.body.classList.toggle('drawer-open', stage > 0);
    document.body.classList.toggle('drawer-full', stage === 2);
    if (!drawer) return;
    if (stage) {
      // (the Character sheet, the floating bag and the chat make way: one place for your things at a time)
      if (typeof closeSheet === 'function' && document.body.classList.contains('panel-open')) closeSheet();
      document.body.classList.remove('bag-open');
      if (typeof setChat === 'function' && document.body.classList.contains('chat-open')) setChat(false);
      const eq = document.getElementById('equipment'), stats = document.getElementById('gearStats'), bags = document.getElementById('containers');
      for (const el of [eq, stats, bags]) borrow(el);
      drawer.querySelector('.drawer-gear').append(eq, stats);
      drawer.querySelector('.drawer-bags').append(bags);
      if (typeof uiDirty === 'function') uiDirty();
    } else giveBack();
    drawer.setAttribute('aria-hidden', String(!stage));
    tab.setAttribute('aria-expanded', String(stage > 0));
  }

  // A vertical swipe on el: up a step, or down a step; a tap (no move) does tap()
  function swipeable(el, tap) {
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      const y0 = e.clientY, x0 = e.clientX, id = e.pointerId;
      el.setPointerCapture(id);
      let done = false;
      const move = ev => {
        if (ev.pointerId !== id || done) return;
        const dy = ev.clientY - y0;
        if (Math.abs(dy) > SWIPE && Math.abs(dy) > Math.abs(ev.clientX - x0)) { done = true; set(stage + (dy < 0 ? 1 : -1)); }
      };
      const up = ev => {
        if (ev.pointerId !== id) return;
        el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
        if (!done && ev.type === 'pointerup' && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 10) tap();
      };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
  }

  function attach(dock) {
    if (!dock || drawer) return;
    tab = document.createElement('button');
    tab.id = 'drawerTab'; tab.className = 'drawer-tab'; tab.title = 'Your equipment and backpack (swipe up)';
    tab.setAttribute('aria-label', 'Equipment and backpack');
    tab.innerHTML = '<svg viewBox="0 0 24 12" class="drawer-chevrons"><path d="M5 10l7-5 7 5M5 6l7-5 7 5"/></svg>';
    dock.appendChild(tab);
    drawer = document.createElement('section');
    drawer.id = 'inventoryDrawer'; drawer.className = 'inventory-drawer'; drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML = '<div class="drawer-handle" title="Swipe up for more, down to close"><i></i></div>'
      + '<div class="drawer-body"><div class="drawer-col drawer-gear"><h3>Equipment</h3></div><div class="drawer-col drawer-bags"><h3>Backpack</h3></div></div>';
    dock.parentNode.insertBefore(drawer, dock);
    swipeable(tab, () => set(stage ? 0 : 1));
    swipeable(drawer.querySelector('.drawer-handle'), () => set(stage === 2 ? 1 : 0));
  }

  return { attach, open: s => set(s || 1), close: () => set(0), stage: () => stage };
})();
