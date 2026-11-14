'use strict';
// The phone's inventory drawer (browser only): your equipment and backpack side by side, pulled up from the action bar.
//   closed    only the tab above the smart button shows
//   compact   swipe the tab up (or tap it): the drawer over the bottom ~42% of the map, equipment left, backpack right;
//             the tab rides up on its top edge, pointing up: there's more
//   expanded  swipe up again (or tap the tab): up to the status bar, with your other open containers, your gear's
//             numbers, and your skills across the whole width under both; the tab points down
// Swipe down on the tab or the top edge to go back a step; while it's open the smart button closes it (smart-button.js).
// The action bar stays where it is and works; the chat line steps aside.
// Along its bottom, in reach of the thumb, four tabs say what it shows: Gear (the above), Map (the minimap, as big as
// the drawer, with its floors and zoom; it opens half way, and Full map opens the drawer all the way on the whole world), Quests and Settings (what the Menu held, and the help). So the
// phone needs no menu or map up top, and everything is a thumb's reach from the action bar.
// The drawer holds the page's own equipment and container windows (game-ui.js draws them, with their dragging and
// stacks), moved in while it's open and put back after, so the Character sheet still finds them in their places.
// A swipe on the tab or the handle never walks: its pointer is caught here, not by the map. Drag a thing out of it onto
// the map and it closes as you leave it, so you can drop it where it was.
const InventoryDrawer = (() => {
  const SWIPE = 28; // px up or down before a drag counts as a swipe
  let drawer = null, tab = null, dock = null, stage = 0, page = 'gear', seg = null, zoomed = false;
  const homes = new Map(); // what was moved in: where to put it back
  const PAGES = [['gear', 'Gear', 'character'], ['map', 'Map', 'map'], ['quests', 'Quests', 'quests'], ['settings', 'Settings', 'menu']];

  function borrow(el) {
    if (!el || homes.has(el)) return;
    homes.set(el, { parent: el.parentNode, next: el.nextSibling });
  }
  function giveBack() {
    for (const [el, { parent, next }] of homes) parent.insertBefore(el, next && next.parentNode === parent ? next : null);
    homes.clear();
    const mm = document.getElementById('minimap');
    if (mm && mm.width !== 236) Object.assign(mm, { width: 236, height: 130 }); // (its size in the side panel)
    const world = document.getElementById('mmWorld');
    if (world) world.textContent = 'Map';
    if (seg !== null) { if (seg) document.body.dataset.seg = seg; else delete document.body.dataset.seg; seg = null; }
  }

  // What the page shown needs, moved in from where the side panel keeps it
  function fill() {
    const byId = id => document.getElementById(id);
    const put = (where, ...els) => { for (const el of els) if (el) { borrow(el); drawer.querySelector(where).append(el); } };
    if (page === 'gear') {
      put('.drawer-gear', byId('equipment'), byId('gearStats'));
      put('.drawer-bags', byId('containers'));
      put('.drawer-skills', byId('tab-skills')); // (your skills, under both columns: shown only expanded)
    } else if (page === 'map') {
      put('.drawer-map', document.querySelector('.minimap-box'));
      document.getElementById('mmWorld').textContent = 'Full map'; // ("Map" again in the side panel)
      if (!zoomed && typeof minimap !== 'undefined') { zoomed = true; minimap.zoom = Math.max(minimap.zoom, 4); } // (closer on a phone, the first time)
    } else if (page === 'quests') put('.drawer-quests', byId('tab-quests'));
    else if (page === 'settings') {
      // (the Menu's settings draw only while its "settings" part is chosen: touch.js renderMenu)
      seg = document.body.dataset.seg || '';
      document.body.dataset.seg = 'settings';
      put('.drawer-settings', byId('menuSec'), byId('tab-help'));
      if (typeof renderMenu === 'function') { menuShown = ''; renderMenu(); }
    }
  }
  // The minimap fills its page at once (the stylesheet stretches it); here its picture follows, one pixel a screen
  // pixel, so tiles stay the size its zoom says. A ResizeObserver calls it whenever the page changes size (opening,
  // sliding open further, turning the phone), so it is sharp again within a frame, never left waiting.
  let fitting = 0;
  function fitMap() {
    fitting = 0;
    const mm = document.getElementById('minimap');
    if (!mm || page !== 'map' || !stage || !drawer.contains(mm)) return;
    const w = Math.round(mm.clientWidth), h = Math.round(mm.clientHeight);
    if (w > 50 && h > 50 && (mm.width !== w || mm.height !== h)) Object.assign(mm, { width: w, height: h });
    if (typeof drawMinimap === 'function') drawMinimap();
  }
  const refit = () => { if (!fitting) fitting = requestAnimationFrame(fitMap); };

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
      giveBack();
      fill();
      drawer.dataset.page = page;
      for (const b of drawer.querySelectorAll('.drawer-tabs button')) b.classList.toggle('active', b.dataset.page === page);
      drawer.prepend(tab); // (the tab on the drawer's top edge)
      if (page === 'map') fitMap(); // (at once: drawn at its size before the drawer is even seen)
      if (typeof uiDirty === 'function') uiDirty();
    } else { giveBack(); dock.appendChild(tab); }
    // the minimap round you again (not the whole world) once the Map page is left or the drawer shut
    if ((stage !== 2 || page !== 'map') && typeof minimap !== 'undefined' && minimap.whole) wholeMap(false); // (the whole world: only all the way open)
    drawer.setAttribute('aria-hidden', String(!stage));
    tab.setAttribute('aria-expanded', String(stage > 0));
    tab.title = ['Your equipment and backpack (swipe up)', 'Swipe up for more, down to close', 'Swipe down for less'][stage];
    // (the smart button turns into a close button and back at once, not at its next look round)
    if (typeof SmartButton !== 'undefined') SmartButton.refresh(document.getElementById('tAttack'));
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

  function attach(bar) {
    if (!bar || drawer) return;
    dock = bar;
    tab = document.createElement('button');
    tab.id = 'drawerTab'; tab.className = 'drawer-tab'; tab.title = 'Your equipment and backpack (swipe up)';
    tab.setAttribute('aria-label', 'Equipment and backpack');
    tab.innerHTML = '<svg viewBox="0 0 24 12" class="drawer-chevrons"><path d="M5 10l7-5 7 5M5 6l7-5 7 5"/></svg>';
    dock.appendChild(tab);
    drawer = document.createElement('section');
    drawer.id = 'inventoryDrawer'; drawer.className = 'inventory-drawer'; drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML = '<div class="drawer-handle" title="Swipe up for more, down to close"><i></i></div>'
      + '<div class="drawer-body"><div class="drawer-col drawer-gear"><h3>Equipment</h3></div><div class="drawer-col drawer-bags"><h3>Backpack</h3></div>'
      + '<div class="drawer-col drawer-skills"><h3>Skills</h3></div></div>'
      + '<div class="drawer-page drawer-map"></div><div class="drawer-page drawer-quests"></div><div class="drawer-page drawer-settings"></div>';
    drawer.dataset.page = page;
    const tabs = document.createElement('nav');
    tabs.className = 'drawer-tabs';
    for (const [id, label, icon] of PAGES) {
      const b = document.createElement('button');
      b.dataset.page = id;
      b.classList.toggle('active', id === page);
      b.append(Icons.img(icon, 20), Object.assign(document.createElement('span'), { textContent: label }));
      b.addEventListener('click', () => show(id));
      tabs.appendChild(b);
    }
    drawer.appendChild(tabs);
    dock.parentNode.insertBefore(drawer, dock);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(refit).observe(drawer.querySelector('.drawer-map'));
    else window.addEventListener('resize', refit);
    swipeable(tab, () => set(stage === 1 ? 2 : stage === 2 ? 1 : 1)); // (a tap: open, or the other open stage)
    swipeable(drawer.querySelector('.drawer-handle'), () => set(stage === 2 ? 1 : 0));
  }

  // Dragging something out of the drawer onto the map: as soon as it leaves the drawer (and the action bar), the drawer
  // closes, so it can be dropped on the tiles the drawer covered too (game-ui.js's drag goes on, and drops it there).
  window.addEventListener('pointermove', e => {
    if (!stage || !drawer || typeof drag === 'undefined' || !drag.active) return;
    const inside = el => { const r = el && el.getBoundingClientRect(); return r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };
    if (!inside(drawer) && !inside(document.getElementById('actionDock'))) set(0);
  });

  // Show a page of the drawer, opening it if it was shut: gear, map, quests or settings
  function show(id, s) {
    if (!PAGES.some(([p]) => p === id)) return;
    page = id;
    set(s || (id === 'gear' || id === 'map' ? stage || 1 : 2)); // (quests and settings need the room: the whole drawer; the map
    // opens half way, and its Full map button opens it all the way: game-ui.js)
  }

  return { attach, open: s => set(s || 1), close: () => set(0), stage: () => stage, show, page: () => page };
})();
