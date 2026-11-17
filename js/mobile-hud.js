'use strict';
// Mobile presentation reuses existing menu, map, action and inventory controls.
function showFloatingStick(x, y, dx, dy) {
  const p = $('joystick'), distance = Math.hypot(dx, dy), scale = Math.min(1, 35 / Math.max(1, distance));
  p.classList.add('floating'); p.style.left = `${x - 52}px`; p.style.top = `${y - 52}px`;
  p.querySelector('.knob').style.transform = `translate(${dx * scale}px,${dy * scale}px)`;
}
function hideFloatingStick() { $('joystick').classList.remove('floating'); }
// The phone's HUD, one component in two states, body[data-hud]:
//   normal  no target: talk, use, loot and the action buttons as they are
//   combat  a living target: its name, health and percent at the top of the view, the smart button lit
// It only shows and asks: every value comes from the player and the target (touch.js keeps the bars' numbers), every
// press goes to the game's own actions. css/phone/layout.css draws it with the HUD tokens in css/phone/theme.css.
const MobileHud = (() => {
  let target = null, shown = '';
  // the target worth showing: alive, with health to show
  const current = () => { const t = player && player.target; return t && !t.dead && t.maxHp > 0 ? t : null; };
  const state = () => (current() ? 'combat' : 'normal');
  // Every frame: the state on the page, and the target's name and health (written only when they change)
  function update() {
    requestAnimationFrame(update);
    if (!target) return;
    const t = current(), mode = t ? 'combat' : 'normal';
    if (document.body.dataset.hud !== mode) document.body.dataset.hud = mode;
    const pct = t ? Math.max(0, Math.min(100, Math.round((100 * t.hp) / t.maxHp))) : 0;
    const raw = t ? t.name || (MONSTERS[t.type] || {}).name || '' : '', name = raw.charAt(0).toUpperCase() + raw.slice(1);
    const key = t ? `${name}|${pct}` : '';
    if (key === shown) return;
    shown = key; target.hidden = !t;
    if (!t) return;
    target.querySelector('b').textContent = name;
    target.querySelector('i').style.width = `${pct}%`;
    target.querySelector('small').textContent = `${pct}%`;
    target.setAttribute('aria-label', `Target: ${name}, ${pct}% health`);
  }
  function attach() {
    target = document.createElement('div'); target.id = 'hudTarget'; target.className = 'hud-target'; target.hidden = true;
    target.setAttribute('role', 'status');
    target.innerHTML = '<b></b><span class="hud-target-bar"><i></i></span><small></small>';
    // (it takes taps itself, so none reach the map behind it)
    target.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); });
    target.addEventListener('pointerup', e => { e.stopPropagation(); if (player && player.target) Actions.untarget(); }); // (a tap on it: stop attacking)
    target.title = 'Tap to stop attacking';
    $('touch').appendChild(target);
    requestAnimationFrame(update);
  }
  return { attach, state, current };
})();

(() => {
  if (!touchScreen) return;
  const hud = document.querySelector('.hud');
  // a heart before the health bar and a drop before the mana
  // (flat, laid half over the start of their bar, edged in the status bar's own colour: cut out of the bar)
  const SHAPES = {
    hp: '<path fill="#c9373d" stroke="#191a1b" stroke-width="7.4" stroke-linejoin="round" paint-order="stroke" d="M12 21.2 3.6 13.1A5.3 5.3 0 0 1 12 6.3a5.3 5.3 0 0 1 8.4 6.8z"/>',
    mana: '<path fill="#2f7fdc" stroke="#191a1b" stroke-width="7.4" stroke-linejoin="round" paint-order="stroke" d="M12 2.6c-3.4 4.7-6.3 8.3-6.3 12a6.3 6.3 0 0 0 12.6 0c0-3.7-2.9-7.3-6.3-12z"/>',
  };
  for (const bar of ['hp', 'mana']) hud.insertAdjacentHTML('beforeend', `<svg class="icon hud-icon-${bar}" viewBox="-3 -3 30 30" aria-hidden="true">${SHAPES[bar]}</svg>`);
  // under them one row: "EXP 12%", one thin experience bar, the level
  const row = document.createElement('div'); row.className = 'hud-exp-row';
  const expLabel = document.createElement('span'); expLabel.className = 'hud-exp-label'; expLabel.textContent = 'EXP ';
  const xp = document.createElement('span'); xp.id = 'hudXpText'; expLabel.appendChild(xp);
  const level = document.createElement('span'); level.className = 'hud-level'; level.append('Lv. ', $('hudLvl'));
  row.append(expLabel, hud.querySelector('.hud-xp'), level); hud.appendChild(row);
  // the map, a button in the top left corner of the view: the drawer's map page (inventory-drawer.js)
  const mapButton = document.createElement('button'); mapButton.id = 'hudMap'; mapButton.className = 'hud-map-button';
  mapButton.title = 'Map'; mapButton.setAttribute('aria-label', 'Map');
  mapButton.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="#f2ebdd" d="M3 6.2 8.4 4v13.6L3 19.8z"/>'
    + '<path fill="#c9c2b2" d="M9.4 4l5.2 2.2v13.6L9.4 17.6z"/><path fill="#f2ebdd" d="M15.6 6.2 21 4v13.6l-5.4 2.2z"/></svg>'; // (a folded map)
  mapButton.addEventListener('click', () => (InventoryDrawer.stage() && InventoryDrawer.page() === 'map' ? InventoryDrawer.close() : InventoryDrawer.show('map')));
  $('touch').appendChild(mapButton);
  MobileHud.attach(); // (what you're fighting, and the HUD's state)
  // the bottom bar, top to bottom: the chat line with the backpack at its end, the action buttons, which set they show
  const bar = document.createElement('div'); bar.id = 'actionDock'; $('touch').appendChild(bar);
  ChatLine.attach(bar); // (the newest message: chat-line.js)
  const bag = document.createElement('button'); bag.id = 'hudBag'; bag.className = 'hud-bag-button';
  bag.title = 'Equipment and backpack'; bag.setAttribute('aria-label', 'Equipment and backpack'); bag.appendChild(Icons.img('slot-backpack', 20));
  bag.addEventListener('click', () => (InventoryDrawer.stage() && InventoryDrawer.page() === 'gear' ? InventoryDrawer.close() : InventoryDrawer.show('gear')));
  bar.appendChild(bag);
  bar.appendChild($('radialControls')); bar.appendChild($('tAttack'));
  InventoryDrawer.attach(bar); // (equipment and backpack, opened by the backpack button or swiped up: inventory-drawer.js)
  // Existing navigation remains accessible from the menu drawer.
  const nav = $('tabbar'); $('panel').prepend(nav);
  const saved = player && touchStorage.get(favKey() + '.pages');
  if (Array.isArray(saved)) { favPageIndex = Math.max(0, Math.min(2, +saved[0] || 0)); favItemPage = Math.max(0, Math.min(2, +saved[1] || 0)); }
  if (typeof ActionSlots !== 'undefined') { ActionSlots.showSet(false, favPageIndex, 3); ActionSlots.showSet(true, favItemPage, 3); }
  window.addEventListener('blur', () => { hideFloatingStick(); endFavPress(false); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { hideFloatingStick(); endFavPress(false); } });
  fitView();
})();
