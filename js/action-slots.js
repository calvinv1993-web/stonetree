'use strict';
// The faces of the phone's action buttons (browser only): each spell, potion or food shows its own picture
// (sprites/ui/actions/<id>.png), what it costs or how many are left, and what keeps it from being used right now:
// too little mana (dimmed, its cost red), a level or promotion still to reach (dimmed, the level shown), or the spell or
// potion still cooling down (a shade sweeping off it, and the seconds left). Ready, its edge is gold. It only shows: the
// game's rules (castSpell, drink) decide, and say why when they refuse. touch.js builds the buttons and calls paint; the cooldowns and mana keep themselves up to
// date (see tick), without rebuilding a button, so a press in progress is never lost.
const ActionSlots = (() => {
  // the actions with a picture of their own; the others show their initials until they have one
  const ART = new Set(['light', 'light_heal', 'cure_poison', 'power_strike', 'haste', 'whirlwind', 'shield_bash', 'earthshaker', 'h', 'm', 'f',
    // sorcerer and druid
    'fire_bolt', 'conjure_missile', 'conjure_fire_field', 'conjure_fireball', 'flame_burst', 'magic_shield', 'conjure_energy_field',
    'conjure_magic_wall', 'energy_beam', 'inferno', 'ice_bolt', 'conjure_heal', 'conjure_poison_field', 'thorn_burst', 'conjure_paralyze',
    'frost_wave', 'blizzard',
    // paladin (Greater Heal for the druid too)
    'holy_bolt', 'conjure_arrows', 'greater_heal', 'conjure_bolts', 'holy_wave', 'holy_storm']);
  const art = id => (ART.has(id) ? `sprites/ui/actions/${id}.png${typeof Sprites !== 'undefined' && Sprites.versionOf ? Sprites.versionOf(`ui/actions/${id}.png`) : ''}` : null);

  // What stands in the way of an action right now: wait (ms of cooldown left, out of total), short (too little mana)
  function state(id) {
    if (!player) return {};
    const spell = SPELLS[id];
    if (spell) return { mana: spell.mana, short: player.mana < spell.mana, wait: Math.max(0, (player.spellReady || 0) - now), total: SPELL_COOLDOWN };
    if (id === 'h' || id === 'm') // (none left: dimmed as a spell without the mana for it)
      return { wait: Math.max(0, (player.potionReady || 0) - now), total: POTION_COOLDOWN, short: countItem(id === 'h' ? 'health_potion' : 'mana_potion') === 0 };
    return {};
  }

  // What an action still gives you, cast or eaten earlier: ms left (haste, magic shield, torchlight, being fed)
  function lasting(id) {
    if (!player) return 0;
    const kind = SPELLS[id] && SPELLS[id].kind, c = player.conditions || {};
    const until = kind === 'haste' ? c.haste && c.haste.until : kind === 'shield' ? c.shield && c.shield.until
      : kind === 'light' ? player.lightUntil : id === 'f' ? player.fedUntil : 0;
    return Math.max(0, (until || 0) - now);
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
    else if (spell) { badge.replaceChildren(Icons.img('drop', 11), String(spell.mana)); badge.classList.add('mana'); } // (a drop and its mana, under it)
    else if (entry && entry.id !== 'f') { badge.textContent = entry.sub.replace('×', ''); badge.classList.add('count'); } // (how many are left)
    const cool = document.createElement('i'), left = document.createElement('b'), lasts = document.createElement('em');
    cool.className = 'slot-cool';
    left.className = 'slot-left'; // (the seconds of cooldown left)
    lasts.className = 'slot-lasts'; // (how long what it gave you still lasts)
    button.replaceChildren(face, badge, cool, left, lasts);
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
    button.classList.toggle('cooling', p > 0);
    button.classList.toggle('ready', !s.short && !p && !button.classList.contains('locked'));
    const cool = button.querySelector('.slot-cool'), left = button.querySelector('.slot-left'), shown = p ? p.toFixed(2) : '';
    if (cool && cool.dataset.p !== shown) { cool.dataset.p = shown; cool.style.setProperty('--p', shown || '0'); }
    // its countdown, in seconds and tenths ("2.4s")
    const text = !p ? '' : `${(s.wait / 1000).toFixed(1)}s`;
    if (left && left.textContent !== text) left.textContent = text;
    // still working (hasted, shielded, lit, fed): its time left at the top of the button
    const ms = lasting(id), lasts = button.querySelector('.slot-lasts'), until = ms > 0 && typeof timeLeft === 'function' ? timeLeft(ms) : '';
    button.classList.toggle('lasting', !!until);
    if (lasts && lasts.textContent !== until) lasts.textContent = until;
  }

  // Every frame while the buttons are on screen: their cooldowns sweep and their mana follows the player's
  function tick() {
    requestAnimationFrame(tick);
    if (typeof touchScreen === 'undefined' || !touchScreen || !player || document.hidden) return;
    const root = document.getElementById('favs');
    if (root) for (const b of root.children) refresh(b);
  }
  requestAnimationFrame(tick);

  // Which set each group shows: a row of short bars under it, the one shown gold (always there, so a swipe has a
  // reason you can see; touch.js calls this after a swipe, mobile-hud.js once at the start)
  const hints = {};
  function showSet(right, index, count) {
    const dock = document.getElementById('actionDock');
    if (!dock) return;
    const side = right ? 'right' : 'left';
    let el = hints[side];
    if (!el) { el = hints[side] = document.createElement('div'); el.className = `slot-set-hint ${side}`; dock.appendChild(el); }
    el.replaceChildren(...Array.from({ length: count }, (_, i) => Object.assign(document.createElement('i'), { className: i === index ? 'on' : '' })));
  }

  return { art, state, lasting, paint, refresh, showSet };
})();
