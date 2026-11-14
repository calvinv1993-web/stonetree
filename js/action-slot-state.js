'use strict';
// Read-only presentation state; castSpell remains authoritative for all game rules.
function actionSlotState(id) {
  const spell = SPELLS[id];
  if (!spell) return null;
  return {
    mana: spell.mana,
    insufficientMana: player.mana < spell.mana,
    cooldown: Math.max(0, Math.ceil(((player.spellReady || 0) - now) / 1000)),
  };
}
