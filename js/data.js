'use strict';
// Content edited in the data editor (data.html) is stored in the browser and
// replaces the built-in definitions here, before anything else uses them.

const DATA_STORAGE_KEY = 'tilequest.data';
const DATA_SECTIONS = { items: ITEMS, monsters: MONSTERS, npcs: NPCS, quests: QUESTS, spells: SPELLS, vocations: VOCATIONS, raids: RAIDS };
const DATA_DEFAULTS = JSON.parse(JSON.stringify(DATA_SECTIONS)); // for "reset" in the data editor

function applyDataOverrides(overrides) {
  for (const [key, target] of Object.entries(DATA_SECTIONS)) {
    const replacement = overrides && overrides[key];
    if (!replacement) continue;
    if (Array.isArray(target)) {
      target.length = 0;
      target.push(...replacement);
    } else {
      for (const k of Object.keys(target)) delete target[k];
      Object.assign(target, replacement);
    }
  }
}

try {
  const saved = typeof localStorage !== 'undefined' && localStorage.getItem(DATA_STORAGE_KEY);
  if (saved) applyDataOverrides(JSON.parse(saved));
} catch (e) {
  console.warn('Could not load the edited game data:', e);
}
