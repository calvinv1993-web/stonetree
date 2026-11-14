'use strict';
// The faces of the phone's action buttons (browser only): each spell, potion or food shows its own picture
// (sprites/ui/actions/<id>.png), what it costs or how many are left, and what keeps it from being used right now:
// too little mana (dimmed, its cost red), a level or promotion still to reach (dimmed, the level shown), or the spell or
// potion still cooling down (a shade sweeping off it). It only shows: the game's rules (castSpell, drink) decide, and
// say why when they refuse. touch.js builds the buttons and calls paint; the cooldowns and mana keep themselves up to
// date (see tick), without rebuilding a button, so a press in progress is never lost.
const ActionSlots = (() => {
  // the actions with a picture of their own; the others show their initials until they have one
  const ART = new Set(['light', 'light_heal', 'cure_poison', 'power_strike', 'haste', 'whirlwind', 'shield_bash', 'earthshaker', 'h', 'm', 'f']);
  const art = id => (ART.has(id) ? `sprites/ui/actions/${id}.png` : null);

  // What stands in the way of an action right now: wait (ms of cooldown left, out of total), short (too little mana)
  function state(id) {
    if (!player) return {};
    const spell = SPELLS[id];
    if (spell) return { mana: spell.mana, short: player.mana < spell.mana, wait: Math.max(0, (player.spellReady || 0) - now), total: SPELL_COOLDOWN };
    if (id === 'h' || id === 'm') return { wait: Math.max(0, (player.potionReady || 0) - now), total: POTION_COOLDOWN };
    return {};
  }

  // A button's face for a hotbar entry (or an empty slot: a +, hold it to choose)
  function paint(button, entry) {
    const face = document.createElement('span'), badge = document.createElement('small');
    face.className = 'slot-face';
    badge.className = 'slot-badge';
    const src = entry && art(entry.id);
    if (src) {
      const img = new Image();
      img.className = 'slot-art'; img.src = src; img.alt = ''; img.draggable = false;
      face.appendChild(img);
    } else if (entry) {
      face.classList.add('slot-initials');
      face.textContent = entry.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    } else face.appendChild(Icons.img('plus', 20));
    const spell = entry && SPELLS[entry.id];
    if (entry && entry.locked) badge.textContent = spell && spell.promoted && !player.promoted ? 'promo' : `lv ${spell ? spell.level : ''}`;
    else if (spell) { badge.textContent = String(spell.mana); badge.classList.add('mana'); }
    else if (entry && entry.id !== 'f') badge.textContent = entry.sub.replace('×', '');
    const cool = document.createElement('i');
    cool.className = 'slot-cool';
    button.replaceChildren(face, badge, cool);
    button.dataset.action = entry ? entry.id : '';
    button.setAttribute('aria-label', entry ? `${entry.name}${spell ? `, ${spell.mana} mana` : entry.sub ? `, ${entry.sub}` : ''}` : 'Empty: hold to choose');
    refresh(button);
  }

  // Bring a button's mana and cooldown up to date (only what changed is written)
  function refresh(button) {
    const id = button.dataset.action;
    if (!id) return;
    const s = state(id), p = s.wait && s.total ? Math.min(1, s.wait / s.total) : 0;
    button.classList.toggle('short', !!s.short);
    const cool = button.lastElementChild, shown = p ? p.toFixed(2) : '';
    if (cool && cool.dataset.p !== shown) { cool.dataset.p = shown; cool.style.setProperty('--p', shown || '0'); }
  }

  // Every frame while the buttons are on screen: their cooldowns sweep and their mana follows the player's
  function tick() {
    requestAnimationFrame(tick);
    if (typeof touchScreen === 'undefined' || !touchScreen || !player || document.hidden) return;
    const root = document.getElementById('favs');
    if (root) for (const b of root.children) refresh(b);
  }
  requestAnimationFrame(tick);

  return { art, state, paint, refresh };
})();
