'use strict';
// Approved reference artwork is clipped at display time, without changing world sprites.
const ACTION_ART = {light:[0,0],light_heal:[1,0],cure_poison:[2,0],power_strike:[3,0],haste:[0,1],whirlwind:[1,1],shield_bash:[2,1],earthshaker:[3,1],h:[0.5,2],m:[1.5,2],f:[2.7,2]};
function renderActionSlot(button, entry) {
  const face = button.querySelector('span'), badge = button.querySelector('small');
  const spell = entry && SPELLS[entry.id], state = entry && actionSlotState(entry.id);
  const art = entry && ACTION_ART[entry.id];
  if (art) {
    face.className = 'action-art';
    face.style.backgroundPosition = `${art[0] * 100 / 3}% ${art[1] * 50}%`;
  } else if (entry) {
    face.textContent = entry.name.split(/\s+/).map(w => w[0]).slice(0,3).join('');
  } else face.replaceChildren(Icons.img('plus',20));
  badge.textContent = spell ? `💧 ${spell.mana}` : entry ? entry.sub : '';
  badge.classList.toggle('mana-cost', !!spell);
  button.classList.toggle('no-mana', !!state?.insufficientMana);
  button.setAttribute('aria-label', entry ? `${entry.name}${spell ? `, ${spell.mana} mana` : ` ${entry.sub}`}` : 'Hold to configure');
  button.setAttribute('aria-disabled', String(!!entry?.locked || !!state?.insufficientMana || !!state?.cooldown));
  if (state?.cooldown) {
    const overlay = document.createElement('i'); overlay.className = 'action-cooldown';
    overlay.textContent = `${state.cooldown}s`; button.appendChild(overlay);
  }
}
