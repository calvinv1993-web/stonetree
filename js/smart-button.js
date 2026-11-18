'use strict';
// The phone's smart button, in the middle of the action bar: one press does what the moment asks, in this order.
//   attack  outside a protection zone, with a monster in sight within 7 tiles: the next one (pressing again switches
//           target, nearest first: targetNext)
//   loot    no monster to fight, and a pile with something in it within 7 tiles: walk to the nearest you can reach and
//           open it (lootNearest)
//   talk    someone to talk to within talking range: say hi (interact)
//   use     a door, chest, lever, depot, sign, bookshelf or training dummy next to you: use it (interact; "train" for a
//           dummy)
//   idle    nothing to do: the button rests, dark
//   close   while an action button's chooser is open (it lies over the action bar): closes it (touch.js). The drawer
//           and the chat don't take the button: it goes on attacking, looting and talking while they're open (they close
//           with their own buttons, the drawer also with a swipe down or a touch on the map)
// It only chooses: the game's own rules (protection zones, targeting, reach, paths) decide what happens. context() is
// plain game logic and needs no page (tests/smart-button.test.js); refresh and press are for the button.
const SmartButton = (() => {
  const USABLE = d => d && (d.toggle || d.lockDoor || d.questDoor || d.levelDoor || d.chest || d.lever || d.depot || d.readable || d.bookshelf || d.cache || d.trainer
    || (d.cannon && questState('last_town') === 'active') || (d.rescue && questState(d.rescue) === 'active')); // (the north wall's cannons and kegs: The Last Town)

  function context() {
    const picker = document.getElementById && document.getElementById('favPicker');
    if (picker && !picker.hidden) return { kind: 'close', label: 'Close the choice' };
    if (!player || player.dead) return { kind: 'idle', label: 'Nothing to do' };
    const safe = inPZ();
    const pile = piles.filter(p => p.z === player.z && p.items && p.items.length && dist(p, player) <= 7)
      .sort((a, b) => dist(a, player) - dist(b, player))[0];
    // a corpse right beside you, with nothing hitting you yet: loot it (a rat coming up the tunnel doesn't turn the
    // button red under your thumb as you press it)
    const beside = !safe && monsters.some(m => !m.dead && m.z === player.z && dist(m, player) <= 1 && canSee(m));
    if (pile && dist(pile, player) <= 1 && !beside) return { kind: 'loot', label: 'Loot', pile };
    if (!safe && monsters.some(m => !m.dead && m.z === player.z && dist(m, player) <= 7 && canSee(m))) return { kind: 'attack', label: 'Attack' };
    if (pile) return { kind: 'loot', label: 'Loot', pile };
    const npc = npcs.filter(n => n.z === player.z && dist(n, player) <= TALK_RANGE).sort((a, b) => dist(a, player) - dist(b, player))[0];
    if (npc) return { kind: 'talk', label: `Talk to ${npc.name}`, x: npc.x, y: npc.y, z: npc.z };
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const t = { x: player.x + dx, y: player.y + dy, z: player.z }, tile = map.get(t.x, t.y, t.z);
      if (tile && tile.items && tile.items.some(id => USABLE(THINGS[id])))
        return { kind: 'use', label: tile.items.some(id => THINGS[id].trainer) ? 'Train' : 'Use', ...t };
    }
    return { kind: 'idle', label: 'Nothing to do' };
  }

  function press() {
    const a = context();
    if (a.kind === 'close') {
      return closeFavPicker();
    }
    if (!player || paused) return;
    if (a.kind === 'attack') Actions.targetNext();
    else if (a.kind === 'loot') Actions.lootNearest(a.pile.id);
    else if (a.kind === 'talk' || a.kind === 'use') Actions.interact(a.kind, a.x, a.y, a.z);
  }

  // The button's face: its icon and colour by what a press would do now, or by a (only redrawn when that changes)
  function refresh(button, a = context()) {
    if (!button) return;
    const engaged = a.kind === 'attack' && !!(player && player.target && !player.target.dead);
    if (button.dataset.action === a.kind && button.title === a.label && button.classList.contains('engaged') === engaged) return;
    button.dataset.action = a.kind;
    // only its icon; attacking now, it is lit from within
    button.classList.toggle('engaged', engaged);
    button.replaceChildren(Icons.img(a.kind, 34));
    button.title = a.label;
    // (no words on it: its name and state are for screen readers)
    button.setAttribute('aria-label', engaged ? 'Attacking (press for the next target)' : a.label);
    button.setAttribute('aria-pressed', String(engaged));
  }

  return { context, press, refresh };
})();
