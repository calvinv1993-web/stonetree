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
  const xp = document.createElement('span'); xp.id = 'hudXpText';
  document.querySelector('.hud-xp').appendChild(xp);
  const mapButton = document.createElement('button'); mapButton.id = 'hudMap'; mapButton.title = 'Open map';
  mapButton.innerHTML = '<canvas width="96" height="96"></canvas>'; mapButton.onclick = () => { closeSheet(); toggleWorldMap(); }; hud.appendChild(mapButton);
  const menu = document.createElement('button'); menu.id = 'hudMenu'; menu.textContent = '☰'; menu.title = 'Menu'; menu.onclick = () => toggleSheet('menu'); hud.appendChild(menu);
  const bar = document.createElement('div'); bar.id = 'actionDock'; $('touch').appendChild(bar);
  bar.appendChild($('radialControls')); bar.appendChild($('tAttack'));
  const pages = document.createElement('div'); pages.id = 'slotPages'; pages.textContent = '1/3                                      1/3'; bar.appendChild(pages);
  // Existing navigation remains accessible from the menu drawer.
  const nav = $('tabbar'); $('panel').prepend(nav);
  const saved = player && touchStorage.get(favKey() + '.pages');
  if (Array.isArray(saved)) { favPageIndex = Math.max(0, Math.min(2, +saved[0] || 0)); favItemPage = Math.max(0, Math.min(2, +saved[1] || 0)); }
  window.addEventListener('blur', () => { hideFloatingStick(); endFavPress(false); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { hideFloatingStick(); endFavPress(false); } });
  setInterval(() => {
    if (!touchScreen || !player || document.hidden) return;
    const source = minimap.layers[player.z];
    if (source && source.width) { const c = mapButton.firstChild, g = c.getContext('2d'); g.fillStyle = '#132018'; g.fillRect(0, 0, 96, 96); g.imageSmoothingEnabled = false; g.drawImage(source, player.x - 24, player.y - 24, 48, 48, 0, 0, 96, 96); g.fillStyle = '#ffe49b'; g.fillRect(46, 46, 4, 4); }
  }, 500);
  fitView();
})();
