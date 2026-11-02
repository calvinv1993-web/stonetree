'use strict';
// Data editor: edit the game's content (items, monsters, NPCs, quests, spells,
// vocations, raids) as JSON. Saved data is stored in the browser and used by
// the game and the map editor instead of the built-in definitions (see data.js).

(() => {
  const $ = id => document.getElementById(id);
  const HELP = {
    items: `<h3>Items</h3><p>id: { name, slot, weapon, armor, defense, weight, value, stack, use, ring, rune, tool, key, kit, text, level, vocations, quest }.</p>
      <p>Slots: head, neck, body, legs, feet, weapon, shield, ring, ammo, backpack. Weapons: { type: sword|axe|club|distance|wand, attack } (wands: dmg, mana, range, element).</p>
      <p>use: { food: seconds } or { heal: [min, max] } or { mana: [min, max] }.</p>`,
    monsters: `<h3>Monsters</h3><p>id: { name, hp, xp, dmg: [min, max], speed (ms per tile), attackSpeed, aggro, armor, corpse (blood|big|bones|slime|none), loot: { gold: [min, max], items: [[itemId, chance, min, max]] } }.</p>
      <p>Extras: ranged, spells, summon, flee, weak, immune, hitCondition, invisible, respawn, proper (a name like "Old Gnarl").</p>`,
    npcs: `<h3>NPCs</h3><p>id: { name, look, greet, keywords, trade }. In texts, {word} is a clickable keyword and $name the player's name.</p>
      <p>keywords: { "word|other word": "answer" } or a service: { quest: [ids] }, { heal: true }, { destiny: true }, { vocation: "knight" }, { bank: true }, { travel: { name, to: {x,y,z}, cost } }, { promote: { level, cost } }, { bless: { cost, perLevel } }, { houses: true }.</p>
      <p>trade: { sells: [[itemId, price]], buys: [gear|distance|magic|jewelry|loot|tools] }. Place NPCs on the map in the map editor.</p>`,
    quests: `<h3>Quests</h3><p>id: { name, giver (NPC id), level, summary, kill: { monster: n } or fetch: itemId, reward: { xp, gold, items }, text: { offer, accept, progress, reward, done, tooWeak } }.</p>
      <p>Longer quests have steps: [{ npc, summary, kill or fetch, progress, done }]. Chest quests are { name, chest: true, summary }.</p>`,
    spells: `<h3>Spells</h3><p>id: { name, words, vocs, level, mana, kind, power: { min: [perLevel, perMagicLevel, perDistance, base], max: [...] }, desc }.</p>
      <p>Kinds: heal, light, cure, haste, shield, bolt (range), area (radius), wave, beam (length), strike / whirl (mult), conjure (item, count, blank). promoted: true needs promotion.</p>`,
    vocations: `<h3>Vocations</h3><p>id: { name, hp, mana, cap (gained per level), regen: [hp, mana], rates: { melee, distance, shielding, magic } (lower trains faster), kit: [[itemId, count]], promoted (title), desc }.</p>`,
    raids: `<h3>Raids</h3><p>A list of { name, message, at: {x, y, z}, spawns: [[monsterId, count]] }. A random raid starts every 15-25 minutes.</p>`,
  };

  const drafts = {};
  let current = 'npcs';
  for (const key of Object.keys(DATA_SECTIONS)) drafts[key] = JSON.stringify(DATA_SECTIONS[key], null, 2);

  function show(key) {
    drafts[current] = $('json').value;
    current = key;
    $('json').value = drafts[key];
    $('help').innerHTML = HELP[key];
    document.querySelectorAll('[data-section]').forEach(b => b.classList.toggle('active', b.dataset.section === key));
    $('status').textContent = '';
  }

  for (const key of Object.keys(DATA_SECTIONS)) {
    const b = document.createElement('button');
    b.textContent = capitalize(key);
    b.dataset.section = key;
    b.addEventListener('click', () => show(key));
    $('sections').appendChild(b);
  }

  // Everything that refers to something else must exist, or the game breaks the moment it touches it.
  function validate(d) {
    const problems = [];
    const need = (ok, what) => { if (!ok) problems.push(what); };
    const item = (id, where) => need(d.items[id], `${where}: unknown item "${id}"`);
    for (const [id, m] of Object.entries(d.monsters)) {
      need(m.name && m.hp > 0 && Array.isArray(m.dmg), `monster ${id}: needs name, hp and dmg`);
      for (const [loot] of (m.loot && m.loot.items) || []) item(loot, `monster ${id} loot`);
      if (m.summon) need(d.monsters[m.summon.type], `monster ${id}: summons unknown "${m.summon.type}"`);
    }
    for (const [id, n] of Object.entries(d.npcs)) {
      need(n.name && n.greet && (n.look || n.creature), `npc ${id}: needs name, greet and look (or creature)`);
      if (n.trade) {
        for (const [sold] of n.trade.sells || []) item(sold, `npc ${id} sells`);
        for (const kind of n.trade.buys || []) need(BUYS[kind], `npc ${id}: buys unknown kind "${kind}"`);
      }
      for (const [k, answer] of Object.entries(n.keywords || {})) {
        if (answer && answer.quest) for (const q of answer.quest) need(d.quests[q], `npc ${id} "${k}": unknown quest "${q}"`);
        if (answer && answer.vocation) need(d.vocations[answer.vocation], `npc ${id} "${k}": unknown vocation`);
      }
    }
    for (const [id, q] of Object.entries(d.quests)) {
      if (q.giver) need(d.npcs[q.giver], `quest ${id}: unknown giver "${q.giver}"`);
      for (const s of q.steps || [q]) {
        for (const type of Object.keys(s.kill || {})) need(d.monsters[type], `quest ${id}: unknown monster "${type}"`);
        if (s.fetch) item(s.fetch, `quest ${id} fetch`);
        if (s.npc) need(d.npcs[s.npc], `quest ${id}: unknown step npc "${s.npc}"`);
      }
      for (const [reward] of (q.reward && q.reward.items) || []) item(reward, `quest ${id} reward`);
    }
    for (const [id, s] of Object.entries(d.spells)) {
      need(s.name && s.words && s.kind, `spell ${id}: needs name, words and kind`);
      for (const v of s.vocs || []) need(d.vocations[v], `spell ${id}: unknown vocation "${v}"`);
      if (s.item) item(s.item, `spell ${id} conjures`);
    }
    for (const [id, v] of Object.entries(d.vocations)) for (const [kit] of v.kit || []) item(kit, `vocation ${id} kit`);
    need(d.vocations.none, 'vocations: "none" (no vocation yet) must exist');
    for (const r of d.raids) for (const [type] of r.spawns || []) need(d.monsters[type], `raid "${r.name}": unknown monster "${type}"`);
    for (const t of Object.values(THINGS)) for (const [reward] of (t.chest && t.chest.items) || []) item(reward, `quest chest "${t.name}"`);
    return problems;
  }

  function parseAll() {
    drafts[current] = $('json').value;
    const data = {};
    for (const key of Object.keys(DATA_SECTIONS)) {
      try {
        data[key] = JSON.parse(drafts[key]);
      } catch (e) {
        show(key);
        throw new Error(`${capitalize(key)}: ${e.message}`);
      }
    }
    return data;
  }

  function save() {
    let data;
    try {
      data = parseAll();
    } catch (e) {
      $('status').textContent = `Not saved - invalid JSON. ${e.message}`;
      return;
    }
    const problems = validate(data);
    if (problems.length) {
      $('status').textContent = `Not saved - ${problems.length} problem(s): ${problems.slice(0, 4).join(' · ')}`;
      return;
    }
    // Only keep the sections that differ from the built-in ones.
    const changed = {};
    for (const key of Object.keys(data)) if (JSON.stringify(data[key]) !== JSON.stringify(DATA_DEFAULTS[key])) changed[key] = data[key];
    if (Object.keys(changed).length) localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(changed));
    else localStorage.removeItem(DATA_STORAGE_KEY);
    $('status').textContent = `Saved (${Object.keys(changed).join(', ') || 'no changes from the built-in data'}). Reload the game to use it.`;
  }

  $('saveData').addEventListener('click', save);
  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  });
  $('resetSection').addEventListener('click', () => {
    if (!confirm(`Put the built-in ${current} back? (Save to keep it.)`)) return;
    $('json').value = drafts[current] = JSON.stringify(DATA_DEFAULTS[current], null, 2);
  });
  $('resetAll').addEventListener('click', () => {
    if (!confirm('Forget all edited data and use the built-in content?')) return;
    localStorage.removeItem(DATA_STORAGE_KEY);
    location.reload();
  });
  $('exportData').addEventListener('click', () => {
    let data;
    try {
      data = parseAll();
    } catch (e) {
      $('status').textContent = `Fix the JSON first. ${e.message}`;
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'tilequest-data.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('importData').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      for (const key of Object.keys(DATA_SECTIONS)) if (data[key]) drafts[key] = JSON.stringify(data[key], null, 2);
      $('json').value = drafts[current];
      $('status').textContent = 'Imported. Check it, then Save.';
    } catch (err) {
      $('status').textContent = `Could not read that file: ${err.message}`;
    }
  });

  $('json').value = drafts[current]; // so the first show() keeps it, rather than the empty box
  show(current);
})();
