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
  mapButton.title = 'Map'; mapButton.setAttribute('aria-label', 'Map'); mapButton.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><path fill="#e8e0cc" d="M3 6.2 8.4 4v13.6L3 19.8z"/>'
    + '<path fill="#bdb6a4" d="M9.4 4l5.2 2.2v13.6L9.4 17.6z"/><path fill="#e8e0cc" d="M15.6 6.2 21 4v13.6l-5.4 2.2z"/></svg>'; // (a folded map)
  mapButton.addEventListener('click', () => (InventoryDrawer.stage() && InventoryDrawer.page() === 'map' ? InventoryDrawer.close() : InventoryDrawer.show('map')));
  $('touch').appendChild(mapButton);
  // what you're fighting, at the top of the view: its name, its health as a bar and a percent
  const target = document.createElement('div'); target.id = 'hudTarget'; target.className = 'hud-target'; target.hidden = true;
  target.innerHTML = '<b></b><span class="hud-target-bar"><i></i></span><small></small>';
  $('touch').appendChild(target);
  let shownTarget = '';
  const followTarget = () => {
    requestAnimationFrame(followTarget);
    const t = player && player.target, alive = t && !t.dead && t.maxHp;
    const pct = alive ? Math.max(0, Math.min(100, Math.round(100 * t.hp / t.maxHp))) : 0;
    const raw = alive ? t.name || (MONSTERS[t.type] || {}).name || '' : '', name = raw.charAt(0).toUpperCase() + raw.slice(1), key = alive ? `${name}|${pct}` : '';
    if (key === shownTarget) return;
    shownTarget = key; target.hidden = !alive;
    if (!alive) return;
    target.querySelector('b').textContent = name;
    target.querySelector('i').style.width = `${pct}%`;
    target.querySelector('small').textContent = `${pct}%`;
  };
  requestAnimationFrame(followTarget);
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
