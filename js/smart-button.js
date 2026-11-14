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
//   close   while the inventory drawer, the chat or an action button's chooser is open: closes it (inventory-drawer.js,
//           chat-line.js, touch.js)
// It only chooses: the game's own rules (protection zones, targeting, reach, paths) decide what happens. context() is
// plain game logic and needs no page (tests/smart-button.test.js); refresh and press are for the button.
const SmartButton = (() => {
  const USABLE = d => d && (d.toggle || d.lockDoor || d.questDoor || d.levelDoor || d.chest || d.lever || d.depot || d.readable || d.bookshelf || d.cache || d.trainer);

  function context() {
    const picker = document.getElementById && document.getElementById('favPicker');
    if (picker && !picker.hidden) return { kind: 'close', label: 'Close the choice' };
    if (typeof InventoryDrawer !== 'undefined' && InventoryDrawer.stage()) return { kind: 'close', label: 'Close your backpack' };
    if (document.body.classList.contains('chat-open')) return { kind: 'close', label: 'Close the chat' };
    if (!player || player.dead) return { kind: 'idle', label: 'Nothing to do' };
    const safe = inPZ();
    if (!safe && monsters.some(m => !m.dead && m.z === player.z && dist(m, player) <= 7 && canSee(m))) return { kind: 'attack', label: 'Attack' };
    const pile = piles.filter(p => p.z === player.z && p.items && p.items.length && dist(p, player) <= 7)
      .sort((a, b) => dist(a, player) - dist(b, player))[0];
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
      const picker = document.getElementById && document.getElementById('favPicker');
      if (picker && !picker.hidden) return closeFavPicker();
      return document.body.classList.contains('chat-open') ? setChat(false) : InventoryDrawer.close();
    }
    if (!player || paused) return;
    if (a.kind === 'attack') Actions.targetNext();
    else if (a.kind === 'loot') Actions.lootNearest(a.pile.id);
    else if (a.kind === 'talk' || a.kind === 'use') Actions.interact(a.kind, a.x, a.y, a.z);
  }

  // The button's face: its icon and colour by what a press would do now, or by a (only redrawn when that changes)
  function refresh(button, a = context()) {
    if (!button) return;
    if (button.dataset.action === a.kind && button.title === a.label) return;
    button.dataset.action = a.kind;
    button.replaceChildren(Icons.img(a.kind, 34));
    button.title = a.label;
    button.setAttribute('aria-label', a.label);
  }

  return { context, press, refresh };
})();
