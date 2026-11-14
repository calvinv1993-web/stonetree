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
  const expLabel = document.createElement('span'); expLabel.className = 'hud-exp-label'; expLabel.textContent = 'EXP'; hud.appendChild(expLabel);
  const xp = document.createElement('span'); xp.id = 'hudXpText'; hud.appendChild(xp);
  // (no map or menu up here: both are tabs of the drawer, in reach of the thumb: inventory-drawer.js)
  const bar = document.createElement('div'); bar.id = 'actionDock'; $('touch').appendChild(bar);
  bar.appendChild($('radialControls')); bar.appendChild($('tAttack'));
  ChatLine.attach(bar); // (the newest message, under the buttons: chat-line.js)
  InventoryDrawer.attach(bar); // (equipment and backpack, swiped up from the bar: inventory-drawer.js)
  // Existing navigation remains accessible from the menu drawer.
  const nav = $('tabbar'); $('panel').prepend(nav);
  const saved = player && touchStorage.get(favKey() + '.pages');
  if (Array.isArray(saved)) { favPageIndex = Math.max(0, Math.min(2, +saved[0] || 0)); favItemPage = Math.max(0, Math.min(2, +saved[1] || 0)); }
  window.addEventListener('blur', () => { hideFloatingStick(); endFavPress(false); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { hideFloatingStick(); endFavPress(false); } });
  fitView();
})();
