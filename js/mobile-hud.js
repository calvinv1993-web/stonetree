'use strict';
// Mobile presentation reuses existing menu, map, action and inventory controls.
function showFloatingStick(x, y, dx, dy) {
  const p = $('joystick'), distance = Math.hypot(dx, dy), scale = Math.min(1, 35 / Math.max(1, distance));
  p.classList.add('floating'); p.style.left = `${x - 52}px`; p.style.top = `${y - 52}px`;
  p.querySelector('.knob').style.transform = `translate(${dx * scale}px,${dy * scale}px)`;
}
function hideFloatingStick() { $('joystick').classList.remove('floating'); }
(() => {
  if (!touchScreen) return;
  const hud = document.querySelector('.hud');
  const level = document.createElement('div'); level.className = 'hud-level';
  level.append('Lv. ', $('hudLvl')); hud.appendChild(level);
  // a heart before the health bar and a drop before the mana; experience as a thin bar, its label left, its percent right
  for (const [bar, icon] of [['hp', 'heart'], ['mana', 'drop']]) { const i = Icons.img(icon, 18); i.classList.add(`hud-icon-${bar}`); hud.appendChild(i); }
  // "EXP 12%" before a thin experience bar, the level after it
  const expLabel = document.createElement('span'); expLabel.className = 'hud-exp-label'; expLabel.textContent = 'EXP ';
  const xp = document.createElement('span'); xp.id = 'hudXpText'; expLabel.appendChild(xp); hud.appendChild(expLabel);
  // the map, a button in the top left corner of the view: the drawer's map page (inventory-drawer.js)
  const mapButton = document.createElement('button'); mapButton.id = 'hudMap'; mapButton.className = 'hud-map-button';
  mapButton.title = 'Map'; mapButton.setAttribute('aria-label', 'Map'); mapButton.appendChild(Icons.img('map', 26));
  mapButton.addEventListener('click', () => (InventoryDrawer.stage() && InventoryDrawer.page() === 'map' ? InventoryDrawer.close() : InventoryDrawer.show('map')));
  $('touch').appendChild(mapButton);
  // the bottom bar, top to bottom: the chat line with the backpack at its end, the action buttons, which set they show
  const bar = document.createElement('div'); bar.id = 'actionDock'; $('touch').appendChild(bar);
  ChatLine.attach(bar); // (the newest message: chat-line.js)
  const bag = document.createElement('button'); bag.id = 'hudBag'; bag.className = 'hud-bag-button';
  bag.title = 'Equipment and backpack'; bag.setAttribute('aria-label', 'Equipment and backpack'); bag.appendChild(Icons.img('slot-backpack', 24));
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
