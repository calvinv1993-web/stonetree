'use strict';
// The HTML side of the game: status, equipment, bags, loot, trade, battle list,
// skills and quests, spell bar, hotkeys, outfit, world map, message log, minimap,
// and dragging items around. Player actions always go through Actions.

// A touch screen (a phone or tablet, or anywhere with ?mobile in the address): touch.js shows its controls.
const touchScreen = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('mobile');
// what the chat line says while empty: shorter on a phone, where there's no Enter key to press
const CHAT_HINT = touchScreen ? 'Say something, e.g. "hi"' : 'Press Enter to talk, e.g. "hi" - or say spell words like "lumen"';

const $ = id => document.getElementById(id);
let uiNeedsRender = true;
function uiDirty() { uiNeedsRender = true; }

// ---- message log -----------------------------------------------------------------------
function addLogLine(build, kind) {
  const el = $('log');
  const line = document.createElement('div');
  line.className = kind || 'server';
  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = new Date().toTimeString().slice(0, 5) + ' ';
  line.appendChild(time);
  build(line);
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
  el.appendChild(line);
  while (el.childElementCount > 200) el.firstElementChild.remove();
  if (atBottom) el.scrollTop = el.scrollHeight;
}

function log(text, kind) {
  addLogLine(line => line.append(text), kind);
  if (kind === 'look') showLook(text);
  else if (typeof toast === 'function' && kind !== 'xp') toast(text, kind);
}

// What you look at also shows over the game itself, near the top, for a while.
let lookTimer = null;
function showLook(text) {
  const el = $('lookText'), view = $('view');
  el.textContent = text;
  el.hidden = false;
  el.classList.remove('fade');
  el.style.top = `${view.offsetTop + Math.max(touchScreen ? 96 : 14, view.offsetHeight * 0.06)}px`;
  clearTimeout(lookTimer);
  lookTimer = setTimeout(() => {
    el.classList.add('fade');
    lookTimer = setTimeout(() => { el.hidden = true; }, 600);
  }, 2500 + text.length * 50);
}

// Dialog lines: {keyword} becomes a link that says the keyword when clicked.
function logDialog(speaker, text, isPlayer) {
  // On a phone what an NPC says to you comes up as a card, its keywords as buttons (the chat keeps it too).
  if (!isPlayer && touchScreen && typeof showTalk === 'function') showTalk(speaker, text);
  else if (!isPlayer) document.body.classList.add('chat-open');
  addLogLine(line => {
    const who = document.createElement('b');
    who.textContent = `${speaker}: `;
    line.appendChild(who);
    for (const part of String(text).split(/(\{[^}]+\})/)) {
      const m = /^\{(.+)\}$/.exec(part);
      if (!m) {
        line.append(part);
        continue;
      }
      const kw = document.createElement('a');
      kw.className = 'kw';
      kw.textContent = m[1];
      kw.addEventListener('click', () => Actions.say(m[1]));
      line.appendChild(kw);
    }
  }, isPlayer ? 'say' : 'npc');
}

// ---- status (updated a few times per second) --------------------------------------------
function setBar(id, value, max, text) {
  $(`${id}Fill`).style.width = `${Math.max(0, Math.min(100, (100 * value) / max))}%`;
  $(`${id}Text`).textContent = text;
}

// "27s", "2:05" or "3h 59m" for what's left of a timer.
function timeLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
}

const SKULL_COLORS = { white: '#f4f4f4', yellow: '#f0d020', red: '#e02020' };
const skullIcon = color => `<svg class="skull-icon" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="${SKULL_COLORS[color]}" stroke="#000"/>`
  + '<circle cx="5.5" cy="7.5" r="1.7"/><circle cx="10.5" cy="7.5" r="1.7"/><rect x="6.5" y="11" width="3" height="1.6"/></svg>';

// Icons for your conditions, with how long the timed ones last (haste, magic shield, skull...).
function statusIcons() {
  const icon = (sign, title, until) => `<span class="status" title="${title}">${sign}${until ? `<small>${timeLeft(until - now)}</small>` : ''}</span>`;
  const icons = Object.entries(player.conditions).map(([k, c]) => icon(CONDITIONS[k].icon, CONDITIONS[k].name, c.until));
  if (now < player.fedUntil) icons.push(icon('🍖', 'fed', 0));
  if (now < player.lightUntil) icons.push(icon('💡', 'torchlight', player.lightUntil));
  if (player.blessed) icons.push(icon('✝', 'blessed', 0));
  if (player.redSkullUntil > now) icons.push(icon(skullIcon('red'), 'red skull: you lose everything you carry when you die', player.redSkullUntil));
  else if (player.skullUntil > now) icons.push(icon(skullIcon('white'), 'white skull: no temples until it fades', player.skullUntil));
  if (player.pzLockUntil > now && !(player.skullUntil > now)) icons.push(icon('⚔', 'in a fight with a player: no temples', player.pzLockUntil));
  return icons.join(' ');
}

function updateBars() {
  setBar('hp', player.hp, player.maxHp, `${player.hp} / ${player.maxHp} HP`);
  setBar('mana', player.mana, player.maxMana, `${player.mana} / ${player.maxMana} mana`);
  const lo = xpForLevel(player.level), hi = xpForLevel(player.level + 1);
  setBar('xp', player.xp - lo, hi - lo, `${player.xp} / ${hi} XP`);
  $('charLine').textContent = `${player.name} · level ${player.level} ${title(player)}`;
  const status = statusIcons();
  $('conditions').innerHTML = status;
  $('tbStatus').innerHTML = status;
  const m = Math.floor(worldMinutes()), clock = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  $('pos').textContent = `${player.x}, ${player.y} · floor ${map.floorLabel(player.z)} · ${clock} · cap ${freeCapacity()} oz`;
  renderBattle();
  renderParty();
  renderGuide();
  if (!$('guild').hidden) renderGuild();
  if (!$('forge').hidden) renderForge();
}

// ---- the guide for new adventurers (see game-guide.js) ---------------------------------------
// The task you're on, of the quests this guide step is about: what to do, how far you are, and where to go then.
function guideNow(step) {
  const ids = ((step && step.target) || []).flatMap(t => [t.quest, ...(t.hunt || [])]).filter(Boolean);
  const id = ids.find(q => QUESTS[q] && questState(q) === 'active');
  if (!id) return '';
  const s = questStep(id), progress = questProgress(id), who = s.npc || QUESTS[id].giver, word = questWord(who, id);
  const summary = s.summary || QUESTS[id].summary;
  const then = s.auto || summary.includes(NPCS[who].name) ? '' : stepReady(id) ? ` Now go to ${NPCS[who].name}${word ? ` and say "${word}"` : ''}.` : ''; // (not twice)
  return `Now: ${summary}${progress ? ` (${progress})` : ''}${then}`;
}
let guideKey = '', guideFolded = false;
try { guideFolded = localStorage.getItem('tilequest.guideFolded') === '1'; } catch (e) { /* no storage: start unfolded */ }
function renderGuide() {
  const step = player.tutorial ? GUIDE[player.tutorial - 1] : null;
  // $progress: how far the task you're on has come (the first active quest still asking you to kill something)
  const hunting = Object.keys(player.quests).find(id => QUESTS[id] && player.quests[id].status === 'active' && questStep(id).kill && !stepReady(id));
  const progress = hunting ? questProgress(hunting) : 'done';
  const text = step ? ((touchScreen && step.touch) || step.text).replace('$progress', progress) : '';
  const now = guideNow(step);
  const key = `${player.tutorial}|${text}|${now}|${guideFolded}`;
  if (key === guideKey) return;
  const before = +guideKey.split('|')[0];
  if (step && before && before !== player.tutorial) Sound.play('coin'); // a step done
  guideKey = key;
  const box = $('guide'), view = $('view');
  box.hidden = !step;
  if (!step) return;
  box.classList.toggle('folded', guideFolded);
  $('guideFold').textContent = guideFolded ? '▸' : '▾';
  // top left over the game; on a phone just under the health bars, in the margin if there is one
  box.style.left = `${touchScreen ? 4 : view.offsetLeft + 8}px`;
  box.style.top = `${touchScreen ? 44 : Math.max(view.getBoundingClientRect().top, 0) + 8}px`; // (never above the window)
  $('guideStep').textContent = `${player.tutorial} / ${GUIDE.length}`;
  $('guideText').textContent = text;
  $('guideNow').textContent = now;
  $('guideNow').hidden = !now;
  $('guideDone').hidden = !!(step.done || step.on);
}

// ---- party and guild ----------------------------------------------------------------------
// Online the server tells us how things stand; playing alone, we ask the game ourselves.
const myPartyView = () => (Net.online ? player.partyView : partyView(player));
const myGuildView = () => (Net.online ? player.guildView : guildView(player));
const markOf = c => (c.partyMark !== undefined ? c.partyMark : partyMark(c, player));
const guildOfCreature = c => (c.guildInfo !== undefined ? c.guildInfo : guildInfo(c));

// A little DOM helper: h('button', { onclick }, 'Join').
function h(tag, props, ...kids) {
  const el = Object.assign(document.createElement(tag), props || {});
  el.append(...kids.filter(k => k !== null && k !== undefined && k !== false));
  return el;
}

let partyKey = '';
function renderParty() {
  const v = myPartyView() || null, key = JSON.stringify(v) + player.id;
  if (key === partyKey) return;
  partyKey = key;
  $('partyBox').hidden = !v;
  if (!v) return;
  const lead = v.leader === player.id, list = $('partyList');
  $('partyShare').hidden = !lead;
  $('partyShare').classList.toggle('on', !!v.shared);
  $('partyShare').textContent = v.shared ? 'Sharing XP' : 'Share XP';
  $('partyLeave').hidden = !v.members;
  $('partyStatus').textContent = v.members ? v.status : '';
  $('partyStatus').classList.toggle('on', !!v.active);
  list.replaceChildren();
  const bar = (value, max) => h('div', null, h('i', { style: `width:${Math.max(0, Math.min(100, (100 * value) / (max || 1)))}%` }));
  for (const m of v.members || []) {
    list.appendChild(h('div', { className: `party-row${m.dead ? ' dead' : ''}` },
      h('span', { className: 'party-icon', textContent: m.id === v.leader ? '👑' : '🛡', title: m.id === v.leader ? 'leader' : 'member' }),
      h('span', { className: 'who', textContent: `${m.name} · ${m.level} ${m.vocation === 'none' ? '' : m.vocation}` }),
      h('span', { className: 'bars' }, bar(m.hp, m.maxHp), bar(m.mana, m.maxMana))));
  }
  for (const i of v.invited || []) {
    list.appendChild(h('div', { className: 'party-row' }, h('span', { className: 'who muted', textContent: `${i.name} (invited)` }),
      lead && h('button', { textContent: 'Revoke', onclick: () => Actions.partyRevoke(i.id) })));
  }
  for (const inv of v.invites || []) {
    list.appendChild(h('div', { className: 'party-row' }, h('span', { className: 'who', textContent: `${inv.name} invited you` }),
      h('button', { textContent: 'Join', onclick: () => Actions.partyJoin(inv.id) })));
  }
}

let guildKey = '';
function toggleGuild(open = $('guild').hidden) {
  $('guild').hidden = !open;
  guildKey = '';
  if (open) renderGuild();
}

// The guild window: found one or answer invitations; or your guild, its members and ranks.
function renderGuild() {
  const v = myGuildView() || { invites: [] }, key = JSON.stringify(v);
  const body = $('guildBody');
  if (key === guildKey || body.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
  guildKey = key;
  body.replaceChildren();
  const button = (text, fn, title) => h('button', { textContent: text, title: title || '', onclick: fn });
  const field = (placeholder, max) => h('input', { placeholder, maxLength: max, autocomplete: 'off' });
  if (!v.name) {
    $('guildTitle').textContent = 'Guild';
    body.appendChild(h('h3', null, 'Invitations'));
    if (!v.invites.length) body.appendChild(h('div', { className: 'muted small' }, 'Nobody has invited you to a guild yet.'));
    for (const g of v.invites) body.appendChild(h('div', { className: 'row' }, h('b', { style: 'flex:1' }, g), button('Join', () => Actions.guildJoin(g)), button('Decline', () => Actions.guildDecline(g))));
    body.appendChild(h('h3', null, 'Found a guild'));
    const name = field('The name of your guild', 29);
    body.appendChild(h('div', { className: 'row' }, name, button('Found', () => { Actions.guildCreate(name.value); name.value = ''; name.blur(); })));
    body.appendChild(h('div', { className: 'muted small' }, 'Anyone with a vocation can found a guild and lead it. Your guild has its own chat (the Guild tab), ranks, nicks and a message of the day.'));
    return;
  }
  $('guildTitle').textContent = v.name;
  const me = player.name.toLowerCase(), leader = v.myRank === 0, officer = v.myRank <= 1;
  if (v.motd) body.appendChild(h('div', { className: 'motd' }, v.motd));
  if (officer) {
    const motd = field('Message of the day', 200);
    motd.value = v.motd;
    body.appendChild(h('div', { className: 'row' }, motd, button('Set', () => { Actions.guildMotd(motd.value); motd.blur(); })));
  }
  const table = h('table', { className: 'guild-members' });
  for (const m of v.members) {
    const self = m.name.toLowerCase() === me, acts = h('td');
    if (officer || self) acts.appendChild(button('Nick', () => { const n = prompt(`Nick for ${m.name}:`, m.nick); if (n !== null) Actions.guildNick(m.name, n); }));
    if (leader && !self) {
      acts.appendChild(button(m.rank === 1 ? `▼` : `▲`, () => Actions.guildSetRank(m.name, m.rank === 1 ? 2 : 1), m.rank === 1 ? `Make ${v.ranks[2]}` : `Make ${v.ranks[1]}`));
      acts.appendChild(button('👑', () => confirm(`Make ${m.name} the leader of ${v.name}?`) && Actions.guildPassLeader(m.name), 'Pass the leadership'));
    }
    if (!self && m.rank > v.myRank && officer) acts.appendChild(button('✕', () => confirm(`Remove ${m.name} from ${v.name}?`) && Actions.guildKick(m.name), 'Remove from the guild'));
    table.appendChild(h('tr', null,
      h('td', { className: m.online ? 'online' : 'offline', textContent: m.online ? '●' : '○', title: m.online ? 'online' : 'offline' }),
      h('td', null, h('b', null, m.name), m.nick ? ` (${m.nick})` : ''),
      h('td', { className: 'muted' }, v.ranks[m.rank]),
      h('td', { className: 'muted' }, `${m.level} ${m.vocation === 'none' ? '' : m.vocation}`),
      acts));
  }
  body.appendChild(table);
  if (officer) {
    body.appendChild(h('h3', null, 'Invite'));
    const who = field('Name of a player who is online', 20);
    body.appendChild(h('div', { className: 'row' }, who, button('Invite', () => { Actions.guildInvite(who.value); who.value = ''; who.blur(); })));
    for (const k of v.invited) body.appendChild(h('div', { className: 'row' }, h('span', { style: 'flex:1', className: 'muted' }, `${k} (invited)`), button('Revoke', () => Actions.guildRevoke(k))));
  }
  const foot = h('div', { className: 'dialog-buttons' });
  if (leader) {
    foot.appendChild(button('Rename ranks', () => {
      const t = prompt('The names of the three ranks, separated by commas:', v.ranks.join(', '));
      if (t !== null) Actions.guildRankTitles(t.split(',').map(s => s.trim()));
    }));
    foot.appendChild(button('Disband', () => confirm(`Disband ${v.name} for good?`) && Actions.guildDisband()));
  } else foot.appendChild(button('Leave guild', () => confirm(`Leave ${v.name}?`) && Actions.guildLeave()));
  body.appendChild(foot);
}

// ---- the forge --------------------------------------------------------------------------------
const forge = { npc: null, chosen: null, ores: [], key: '' };

function openForge(npcId) {
  Object.assign(forge, { npc: npcId, ores: [], key: '' });
  $('forge').hidden = false;
  renderForge();
}
function closeForge() {
  $('forge').hidden = true;
  forge.npc = null;
}

// Every piece of gear you could forge: what you wear, then what's in your bags.
function forgeableGear() {
  const out = [];
  for (const slot of SLOTS) {
    const it = player.equipment[slot];
    if (it && forgeable(it.id)) out.push({ ref: { root: 'equip', slot }, item: it });
  }
  const walk = (c, path) => c.contents.forEach((it, i) => {
    if (forgeable(it.id)) out.push({ ref: { root: 'bag', path: [...path, i] }, item: it });
    if (it.contents) walk(it, [...path, i]);
  });
  walk(bag(), []);
  return out;
}

function renderForge() {
  const npc = npcs.find(n => n.id === forge.npc);
  if (!npc || npc.z !== player.z || dist(npc, player) > TALK_RANGE + 2) return closeForge(); // walked away
  const gear = forgeableGear(), owned = ORES.map(countItem);
  const key = JSON.stringify([gear.map(g => [g.item.id, g.item.q || 0]), owned, forge.chosen, forge.ores, player.gold]);
  if (key === forge.key) return;
  forge.key = key;
  let chosen = gear.find(g => JSON.stringify(g.ref) === forge.chosen);
  if (!chosen && gear.length) { chosen = gear[0]; forge.chosen = JSON.stringify(chosen.ref); }
  const body = $('forgeBody');
  body.replaceChildren();
  if (!gear.length) return body.append(h('div', { className: 'muted' }, 'You have no weapons, armor or shields to forge.'));

  body.append(h('h3', null, 'Your gear'));
  const list = h('div', { className: 'forge-gear' });
  for (const g of gear) {
    const el = slotEl(g.item, { onClick: () => { forge.chosen = JSON.stringify(g.ref); forge.key = ''; renderForge(); } });
    if (g === chosen) el.classList.add('chosen');
    list.append(el);
  }
  body.append(list);

  const q = chosen.item.q || 0, target = q + 1, top = !QUALITIES[target];
  const main = h('div', { className: 'forge-main' });
  main.append(slotEl(chosen.item));
  const grade = n => h('b', { style: `color:${QUALITIES[n].color}` }, QUALITIES[n].name);
  main.append(h('div', { className: 'forge-arrow' }, grade(q), top ? 'can\'t get better' : '→', top ? null : grade(target)));
  if (!top) {
    const slots = h('div', { className: 'forge-ores' });
    for (let i = 0; i < FORGE_SLOTS; i++) {
      const g = forge.ores[i];
      slots.append(slotEl(g === undefined ? null : { id: ORES[g], count: 1 }, {
        label: 'ore', onClick: g === undefined ? null : () => { forge.ores.splice(i, 1); renderForge(); },
      }));
    }
    main.append(slots);
    const full = forge.ores.length === FORGE_SLOTS, chance = forgeChance(target, forge.ores);
    const color = chance >= 80 ? '#7ee07e' : chance >= 40 ? '#e8c060' : '#e07070';
    main.append(h('div', { className: 'forge-chance', style: `color:${full ? color : '#8a8070'}` }, `${chance}%`,
      h('small', null, full ? `fee ${FORGE_FEE[target - 1]} gold` : `${FORGE_SLOTS - forge.ores.length} more ore`)));
  }
  body.append(main);
  if (!top) {
    const supply = h('div', { className: 'forge-supply' });
    ORES.forEach((id, g) => {
      const left = owned[g] - forge.ores.filter(o => o === g).length;
      const el = slotEl(left > 0 ? { id, count: left } : null, {
        label: QUALITIES[g].name, hint: 'Click to put one in the forge.',
        onClick: left > 0 ? () => { if (forge.ores.length < FORGE_SLOTS) forge.ores.push(g); renderForge(); } : null,
      });
      supply.append(el);
    });
    const best = () => { // the best ore you have, from the top
      forge.ores = [];
      for (let g = ORES.length - 1; g >= 0 && forge.ores.length < FORGE_SLOTS; g--) {
        for (let n = 0; n < owned[g] && forge.ores.length < FORGE_SLOTS; n++) forge.ores.push(g);
      }
      renderForge();
    };
    body.append(h('h3', null, 'Your ore - each one adds to the chance: better ore 25%, the same grade 20%, a grade below 5%'), supply);
    body.append(h('div', { className: 'dialog-buttons' },
      h('button', { textContent: 'Best ore', onclick: best }),
      h('button', { textContent: 'Clear', onclick: () => { forge.ores = []; renderForge(); } }),
      h('button', { className: 'primary', textContent: 'Forge!', disabled: forge.ores.length < FORGE_SLOTS,
        onclick: () => { Actions.forgeItem(chosen.ref, forge.ores.slice()); forge.ores = []; } })));
  }
  body.append(h('h3', null, `Fuse ore: ${FUSE_COUNT} of a grade make one of the next`));
  for (let g = 0; g < ORES.length - 1; g++) {
    const n = Math.floor(owned[g] / FUSE_COUNT);
    body.append(h('div', { className: 'forge-row' },
      h('span', null, `${FUSE_COUNT} ${ITEMS[ORES[g]].name} → 1 ${ITEMS[ORES[g + 1]].name} (you have ${owned[g]})`),
      h('button', { textContent: 'Fuse', disabled: !n, onclick: () => Actions.fuseOre(g, 1) }),
      h('button', { textContent: `All (${n})`, disabled: n < 2, onclick: () => Actions.fuseOre(g, n) })));
  }
}

// The forge's verdict, over the game: in the colour of the new grade, or a sad grey.
function forgeResult(r) {
  showLook(r.ok ? `Success! ${capitalize(QUALITIES[r.q].name)} ${ITEMS[r.id].name}!` : `The forge failed (${r.chance}% chance).`);
  $('lookText').style.color = r.ok ? QUALITIES[r.q].color : '#c8b8b0';
  setTimeout(() => { $('lookText').style.color = ''; }, 4000);
}

// ---- dragging items ------------------------------------------------------------------------
// Slots have el.dragRef (the item there) and/or el.dropRef (where a dropped item goes).
// The map is a drop target too (the tile under the pointer), and a drag source for
// corpses, dropped items and movable things next to you.
const drag = { pending: null, active: false, ghost: null, suppressClick: false };

function startDrag(e, ref, icon, onClick) {
  if (e.button !== 0) return;
  drag.pending = { ref, icon, onClick, sx: e.clientX, sy: e.clientY, shift: e.shiftKey };
}

window.addEventListener('pointermove', e => {
  const d = drag.pending;
  if (!d) return;
  if (!drag.active && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) {
    drag.active = true;
    drag.ghost = new Image();
    drag.ghost.src = d.icon;
    drag.ghost.className = 'drag-ghost';
    document.body.appendChild(drag.ghost);
  }
  if (drag.active) {
    drag.ghost.style.left = `${e.clientX - 16}px`;
    drag.ghost.style.top = `${e.clientY - 16}px`;
  }
});

// A drag the browser took over (a scroll, an image drag of its own) just stops.
window.addEventListener('pointercancel', () => {
  if (drag.active) drag.ghost.remove();
  drag.active = false;
  drag.pending = null;
});

window.addEventListener('pointerup', e => {
  const d = drag.pending;
  drag.pending = null;
  if (!d) return;
  if (!drag.active) {
    if (d.onClick) d.onClick(e);
    return;
  }
  drag.active = false;
  drag.ghost.remove();
  drag.suppressClick = true;
  setTimeout(() => { drag.suppressClick = false; }, 0);
  let el = document.elementFromPoint(e.clientX, e.clientY), dst = null;
  if (el === canvas) dst = { root: 'ground', ...tileUnderPointer(e) };
  while (el && !dst) {
    if (el.dropRef) dst = el.dropRef;
    el = el.parentElement;
  }
  if (!dst) return;
  let count;
  const item = d.ref.root !== 'map' && resolveForUi(d.ref);
  if (item && item.count > 1 && (e.shiftKey || d.shift)) {
    count = parseInt(prompt(`How many? (1-${item.count})`, String(item.count)), 10);
    if (!(count > 0)) return;
  }
  Actions.moveItem(d.ref, dst, count);
});

const resolveForUi = ref => (resolve(ref) || {}).item || null;

function slotEl(item, { label, slot, dragRef, dropRef, onClick, onRight, hint } = {}) {
  const el = document.createElement('div');
  el.className = 'slot';
  if (item) {
    const img = new Image();
    img.src = Sprites.itemURL(item.id);
    img.draggable = false;
    el.appendChild(img);
    if (item.count > 1) {
      const c = document.createElement('span');
      c.className = 'count';
      c.textContent = item.count;
      el.appendChild(c);
    }
    el.title = itemInfo(item.id, item.q) + (item.time ? ` - ${Math.ceil(item.time / 60000)} min left` : '') + (hint ? `\n${hint}` : '');
    // gear glows in the colour of its grade (fine, rare, epic, legendary), and ore in its own
    const grade = item.q || (ITEMS[item.id] && ITEMS[item.id].ore) || 0;
    if (grade) el.dataset.rarity = ['', 'uncommon', 'rare', 'epic', 'legendary'][grade];
  } else {
    el.classList.add('empty');
    if (label) el.dataset.label = label;
    // an empty equipment slot shows a faint drawing of what goes there
    if (slot && typeof Icons !== 'undefined') el.appendChild(Icons.img(`slot-${slot}`, 22));
  }
  if (dropRef) el.dropRef = dropRef;
  if (item && dragRef) el.addEventListener('pointerdown', e => startDrag(e, dragRef, Sprites.itemURL(item.id), onClick));
  else if (onClick) el.addEventListener('click', e => { if (!drag.suppressClick) onClick(e); });
  if (onRight) el.addEventListener('contextmenu', e => {
    e.preventDefault();
    onRight(e);
  });
  return el;
}

// Left click on an item: shift = look, ctrl = drop; otherwise use it. Right click always uses.
function itemClick(ref) {
  return e => {
    const item = resolveForUi(ref);
    if (!item) return;
    if (e.shiftKey) log(`You see ${itemInfo(item.id, item.q)}.`, 'look');
    else if (e.ctrlKey || e.metaKey) Actions.moveItem(ref, { root: 'ground', x: player.x, y: player.y, z: player.z });
    else Actions.useItem(ref);
  };
}

// ---- equipment and containers -----------------------------------------------------------------
const EQUIP_LAYOUT = ['neck', 'head', 'backpack', 'weapon', 'body', 'shield', 'ring', 'legs', 'ammo', null, 'feet', null];

function renderEquipment() {
  const root = $('equipment');
  root.replaceChildren();
  for (const slot of EQUIP_LAYOUT) {
    if (!slot) {
      root.appendChild(document.createElement('div'));
      continue;
    }
    const ref = { root: 'equip', slot };
    root.appendChild(slotEl(player.equipment[slot], {
      label: SLOT_LABELS[slot], slot, dragRef: slot === 'backpack' ? null : ref, dropRef: ref,
      onClick: slot === 'backpack' ? null : () => Actions.unequip(slot), onRight: () => Actions.unequip(slot),
      hint: 'Click to take it off, or drag it.',
    }));
  }
  const w = playerWeapon();
  const attack = w.kind === 'magic' ? `${w.dmg[0]}-${w.dmg[1]} ${w.element}` : w.noAmmo ? `no ${w.noAmmo}s!` : `attack ${w.attack}`;
  $('gearStats').textContent = `${player.gold} gold${player.bank ? ` (+${player.bank} in bank)` : ''} · armor ${totalArmor()} · ${attack}`;
}

// Open container windows: the bag is always open; others open by using them.
let openContainers = [];

function openContainer(c) {
  if (c.root === 'bag' && !c.path.length) return;
  openContainers = openContainers.filter(o => !(o.root === c.root && String(o.path) === String(c.path)));
  openContainers.push({ root: c.root, path: c.path, title: c.title });
  uiDirty();
}

function containerWindow(root, path, heading, closable) {
  const ref = { root, path };
  const c = containerAt(ref);
  if (!c) return null;
  const box = document.createElement('section');
  box.className = 'container';
  const h = document.createElement('h2');
  h.textContent = `${heading} (${c.contents.length}/${capacityOf(c)})`;
  if (closable) {
    const x = document.createElement('button');
    x.textContent = '×';
    x.title = 'Close';
    x.addEventListener('click', () => {
      openContainers = openContainers.filter(o => !(o.root === root && String(o.path) === String(path)));
      uiDirty();
    });
    h.appendChild(x);
  }
  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.dropRef = { root, path: [...path, c.contents.length] };
  for (let i = 0; i < capacityOf(c); i++) {
    const item = c.contents[i], slotRef = { root, path: [...path, i] };
    grid.appendChild(slotEl(item, {
      dragRef: slotRef, dropRef: item ? slotRef : { root, path: [...path, c.contents.length] },
      onClick: itemClick(slotRef), onRight: () => item && Actions.useItem(slotRef),
      hint: 'Click: use · drag: move · Shift: look · Ctrl: drop',
    }));
  }
  if (touchScreen && root === 'bag' && !path.length) { // on a phone the bag floats over the map: a close button on it
    const x = document.createElement('button');
    x.className = 'bag-close'; x.textContent = '×'; x.title = 'Close';
    x.addEventListener('click', () => document.body.classList.remove('bag-open'));
    h.appendChild(x);
  }
  box.append(h, grid);
  // A bigger bag in your bag (a backpack): one tap to carry everything in it instead (the old one goes inside).
  // Dragging it onto the bag slot does the same, but on a phone that slot is rarely in sight.
  if (root === 'bag' && path.length === 1 && ITEMS[c.id].slot === 'backpack' && capacityOf(c) > capacityOf(bag())) {
    const swap = document.createElement('button');
    swap.className = 'bag-swap';
    swap.textContent = `Carry my things in this ${ITEMS[c.id].name}`;
    swap.addEventListener('click', () => {
      Actions.moveItem({ root, path }, { root: 'equip', slot: 'backpack' });
      openContainers = openContainers.filter(o => !(o.root === root && String(o.path) === String(path)));
      uiDirty();
    });
    box.insertBefore(swap, grid); // above its slots, where it's in sight
  }
  return box;
}

function renderContainers() {
  const root = $('containers');
  root.replaceChildren();
  const b = bag();
  if (b) root.appendChild(containerWindow('bag', [], capitalize(ITEMS[b.id].name), false));
  openContainers = openContainers.filter(o => containerAt(o));
  for (const o of openContainers) {
    const w = containerWindow(o.root, o.path, o.title, true);
    if (w) root.appendChild(w);
  }
}

function renderLoot() {
  const p = player.openPile;
  $('lootBox').hidden = !p;
  if (!p) return;
  $('lootTitle').textContent = capitalize(p.name || 'items on the ground');
  const root = $('loot');
  root.replaceChildren();
  root.dropRef = { root: 'pile', pileId: p.id, path: [p.items.length] };
  p.items.forEach((item, i) => {
    const ref = { root: 'pile', pileId: p.id, path: [i] };
    root.appendChild(slotEl(item, {
      dragRef: ref, dropRef: ref, onClick: () => Actions.takeFromPile(p.id, i), onRight: () => Actions.takeFromPile(p.id, i),
      hint: 'Click to take it, or drag it somewhere.',
    }));
  });
  if (!p.items.length) root.textContent = 'Nothing left.';
}

// ---- trade window ----------------------------------------------------------------------
let shopTab = 'buy';

function shopRow(id, info, buttons) {
  const row = document.createElement('div');
  row.className = 'shop-row';
  const icon = new Image();
  icon.src = Sprites.itemURL(id);
  const text = document.createElement('div');
  text.className = 'shop-name';
  text.textContent = capitalize(ITEMS[id].name);
  const small = document.createElement('small');
  small.textContent = info;
  text.appendChild(small);
  row.title = itemInfo(id);
  row.append(icon, text);
  if (ITEMS[id].slot && canWear(id)) row.classList.add('unusable');
  for (const [label, act] of buttons) {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', act);
    row.appendChild(b);
  }
  return row;
}

function renderShop() {
  const npc = player.shopNpc;
  $('shop').hidden = !npc;
  if (!npc) return;
  $('shopTitle').textContent = `Trade with ${npc.name}`;
  $('shopGold').textContent = `${player.gold} gold · cap ${freeCapacity()} oz`;
  document.querySelectorAll('[data-shoptab]').forEach(b => b.classList.toggle('active', b.dataset.shoptab === shopTab));
  const list = $('shopList');
  list.replaceChildren();
  if (shopTab === 'buy') {
    for (const [id, price] of npc.def.trade.sells) {
      if (!ITEMS[id]) continue;
      const amounts = ITEMS[id].stack ? [1, 10, 50] : [1];
      list.appendChild(shopRow(id, `${price} gold each`, amounts.map(n => [ITEMS[id].stack ? `×${n}` : 'Buy', () => Actions.buy(id, n)])));
    }
  } else {
    const items = sellableItems(npc);
    for (const [id, price, count] of items) {
      list.appendChild(shopRow(id, `${price} gold each · you have ${count}`, [['Sell 1', () => Actions.sell(id, 1)], ['Sell all', () => Actions.sell(id, count)]]));
    }
    if (!items.length) list.textContent = "You have nothing I'd buy.";
  }
}

// ---- battle list ------------------------------------------------------------------------
let battleKey = '';

// The creature whose battle list row the pointer is on; the game view frames it.
let battleHover = null;

function renderBattle() {
  const list = [...monsters, ...players].filter(c => c !== player && !c.dead && c.z === player.z
    && Math.abs(c.x - player.x) <= 7 && Math.abs(c.y - player.y) <= 5 && (c.type === 'player' || canSee(c)))
    .sort((a, b) => dist(a, player) - dist(b, player));
  const struck = new Set(effects.filter(fx => fx.kind === 'attacker' && forViewer(fx, player) && now < fx.start + fx.dur).map(fx => fx.cid));
  const key = list.map(c => `${c.id}:${Math.round((c.hp / c.maxHp) * 20)}${struck.has(c.id) ? '!' : ''}`).join(',')
    + `|${player.target && player.target.id}|${player.follow}|${player.fightMode}|${player.chase}|${player.secure}`;
  if (key === battleKey) return;
  battleKey = key;
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === player.fightMode));
  $('chaseMode').classList.toggle('active', player.chase);
  $('secureMode').classList.toggle('active', player.secure !== false);
  $('secureMode').textContent = player.secure !== false ? 'Secure' : 'PvP';
  const root = $('battle');
  root.replaceChildren();
  for (const c of list) {
    const row = document.createElement('div');
    row.className = `battle-row${player.target === c ? ' target' : player.follow === c.id ? ' followed' : ''}${struck.has(c.id) ? ' struck' : ''}`;
    const img = new Image();
    img.src = Sprites.creature(c.type === 'player' ? Sprites.playerKey(c.vocation, c.outfit) : c.type, 2, 0).toDataURL();
    const name = document.createElement('span');
    name.textContent = c.type === 'player' ? c.name : capitalize(c.name);
    const bar = document.createElement('div');
    bar.className = 'mini';
    bar.innerHTML = `<div style="width:${Math.round((100 * c.hp) / c.maxHp)}%"></div>`;
    name.appendChild(bar);
    row.append(img, name);
    row.addEventListener('click', () => Actions.setTarget(c.id));
    row.addEventListener('pointerenter', () => { battleHover = c.id; });
    root.appendChild(row);
  }
  if (!list.some(c => c.id === battleHover)) battleHover = null;
  if (!list.length) root.textContent = 'Nobody around.';
}

// ---- skills and quests tabs --------------------------------------------------------------
function skillRow(name, value, fraction) {
  const row = document.createElement('div');
  row.className = 'skill';
  row.innerHTML = '<span></span><b></b><div class="mini"><div></div></div>';
  row.children[0].textContent = name;
  row.children[1].textContent = value;
  row.querySelector('.mini div').style.width = `${Math.floor(Math.min(1, fraction) * 100)}%`;
  row.title = `${Math.floor(fraction * 100)}% to the next level`;
  return row;
}

function renderSkills() {
  const root = $('tab-skills');
  root.replaceChildren();
  const lo = xpForLevel(player.level), hi = xpForLevel(player.level + 1);
  root.appendChild(skillRow('Level', player.level, (player.xp - lo) / (hi - lo)));
  root.appendChild(skillRow('Home town', homeTown(), 1)); // where you wake up when you die: ask a priest about becoming a citizen
  for (const id of Object.keys(SKILLS)) {
    const s = player.skills[id];
    root.appendChild(skillRow(capitalize(SKILLS[id].name), s.level, s.tries / skillTries(id, s.level, player.vocation)));
  }
  root.appendChild(skillRow('Capacity', `${freeCapacity()} / ${capacity()} oz`, 1 - freeCapacity() / capacity()));
  const frags = (player.frags || []).filter(t => now - t < FRAG_LIMITS[0][1]).length;
  if (frags) root.appendChild(skillRow('Unjustified kills today', `${frags} / ${FRAG_LIMITS[0][0]}`, frags / FRAG_LIMITS[0][0]));
}

function renderQuests() {
  const root = $('tab-quests');
  root.replaceChildren();
  // Where to go now in an active quest, and what to say there.
  const goTo = id => {
    const s = questStep(id), who = s.npc || QUESTS[id].giver, word = questWord(who, id);
    if (s.auto) return '';
    return `${stepReady(id) ? 'Then go' : 'When it is done, go'} to ${NPCS[who].name}${word ? ` and say "${word}"` : ''}.`;
  };
  // The stories first (The Silent Bell on Oakvale Isle, The Ember Seal on the mainland): the chapters
  // behind you, the one you're on, and where the next begins.
  const stories = {};
  for (const id of Object.keys(QUESTS)) {
    const st = QUESTS[id].story;
    if (st) (stories[st === true ? 'The Ember Seal' : st] = stories[st === true ? 'The Ember Seal' : st] || []).push(id);
  }
  for (const [title, story] of Object.entries(stories)) {
    if ((title === 'The Ember Seal') === (player.vocation === 'none') && !story.some(id => questState(id) !== 'none')) continue; // the mainland's story waits for the mainland
    const box = document.createElement('div'), head = document.createElement('b');
    box.className = 'story';
    const done = story.filter(id => questState(id) === 'done').length;
    head.textContent = `${title} · ${done === story.length ? 'complete!' : `chapter ${Math.min(done + 1, story.length)} of ${story.length}`}`;
    box.appendChild(head);
    const chapter = id => QUESTS[id].name.replace(`${title} `, '');
    let next = true;
    for (const id of story) {
      const line = document.createElement('div'), state = questState(id);
      if (state === 'done') {
        line.className = 'done';
        line.textContent = `✓ ${chapter(id)}`;
      } else if (state === 'active') {
        const s = questStep(id), progress = questProgress(id);
        line.className = 'now';
        line.innerHTML = '<b></b><span></span><i></i>';
        line.children[0].textContent = chapter(id);
        line.children[1].textContent = `${s.summary || QUESTS[id].summary}${progress ? ` (${progress})` : ''}`;
        line.children[2].textContent = ` ${goTo(id)}`;
        next = false;
      } else if (next) {
        const q = QUESTS[id], who = q.offers && player.home !== 'start' ? Object.keys(q.offers)[0] : q.giver, word = questWord(who, id) || 'quest';
        line.className = 'next';
        line.textContent = `Next: ${chapter(id)} - say "${word}" to ${NPCS[who].name}${q.level > player.level ? ` (from level ${q.level})` : ''}.`;
        next = false;
      } else continue;
      box.appendChild(line);
    }
    root.appendChild(box);
  }
  const ids = Object.keys(player.quests).filter(id => QUESTS[id] && !QUESTS[id].story);
  if (!ids.length) root.append('No other quests yet. Talk to people (click them, or type "hi") to find some.');
  for (const id of ids.sort((a, b) => (questState(a) === 'done') - (questState(b) === 'done'))) {
    const q = QUESTS[id], done = questState(id) === 'done';
    const el = document.createElement('div');
    el.className = `quest${done ? ' done' : ''}`;
    const head = document.createElement('b');
    head.textContent = `${q.name}${done ? ' ✓' : ''}`;
    const text = document.createElement('div');
    if (done) text.textContent = q.chest ? q.summary : 'Completed.';
    else {
      const s = questStep(id), progress = questProgress(id);
      text.textContent = `${s.summary || q.summary}${progress ? ` (${progress})` : ''} ${goTo(id)}`;
    }
    el.append(head, text);
    root.appendChild(el);
  }
}

// ---- spell bar ---------------------------------------------------------------------------
// Everything the bar below the map offers: your vocation's spells, potions and food.
function hotbarEntries() {
  const list = spellsFor(player.vocation).filter(id => !SPELLS[id].hidden).map((id, i) => {
    const s = SPELLS[id], locked = player.level < s.level || (s.promoted && !player.promoted);
    const sub = locked ? (s.promoted && !player.promoted ? 'promotion' : `level ${s.level}`) : `${s.mana} mana`;
    return { id, key: i < 9 ? String(i + 1) : '', name: s.name, sub, tip: `${s.desc} Words: "${s.words}"`, act: () => Actions.castSpell(id), locked };
  });
  list.push(
    { id: 'h', key: 'H', name: 'Health potion', sub: `×${countItem('health_potion')}`, tip: 'Drink a health potion', act: () => Actions.hotkey('h') },
    { id: 'm', key: 'M', name: 'Mana potion', sub: `×${countItem('mana_potion')}`, tip: 'Drink a mana potion', act: () => Actions.hotkey('m') },
    { id: 'f', key: 'F', name: 'Eat', sub: '', tip: 'Eat something from your bag', act: () => Actions.hotkey('f') },
  );
  return list;
}

function renderHotbar() {
  const root = $('hotbar');
  root.replaceChildren();
  for (const e of hotbarEntries()) {
    const b = document.createElement('button');
    b.className = 'hot';
    b.disabled = !!e.locked;
    b.title = e.tip;
    b.innerHTML = '<kbd></kbd> <span></span><small></small>';
    b.querySelector('kbd').textContent = e.key;
    b.querySelector('span').textContent = e.name;
    b.querySelector('small').textContent = e.sub;
    b.addEventListener('click', e.act);
    root.appendChild(b);
  }
  if (typeof renderFavs === 'function') renderFavs();
}

function renderUI() {
  uiNeedsRender = false;
  renderEquipment();
  renderContainers();
  renderLoot();
  renderShop();
  renderSkills();
  renderQuests();
  renderHotbar();
  battleKey = '';
}

// ---- events from the game: reading, opening containers, use-with, raids ------------------
let useWith = null;   // { ref, name } while picking a target for a rune or tool
let raidBanner = null;

function handleEvents() {
  const events = player.events.splice(0);
  for (const { kind, data } of events) {
    if (kind === 'read') showWindow(data.title, data.text);
    else if (kind === 'openContainer') {
      openContainer(data);
      document.body.classList.add(touchScreen ? 'bag-open' : 'panel-open'); // on a phone, open bags show over the map
    } else if (kind === 'useWith') {
      document.body.classList.remove('panel-open'); // out of the way, to tap the target
      useWith = data;
      canvas.classList.add('targeting');
      log(`Click where to use the ${data.name}. (Right-click or Esc to cancel.)`);
    } else if (kind === 'raid') raidBanner = { text: data.message, until: now + 7000, color: '#ff6040' };
    else if (kind === 'banner') raidBanner = { text: data.message, until: now + 9000, color: '#ffd84a' };
    else if (kind === 'forge') openForge(data.npc);
    else if (kind === 'forged') forgeResult(data);
  }
}

function cancelUseWith() {
  useWith = null;
  canvas.classList.remove('targeting');
}

function showWindow(heading, body) {
  $('readTitle').textContent = heading;
  $('readText').textContent = body;
  $('read').hidden = false;
}

// ---- hotkeys (F1-F12) ------------------------------------------------------------------
function openHotkeys() {
  document.body.classList.remove('panel-open'); // on a phone: the drawer makes way
  const root = $('hotkeyList');
  root.replaceChildren();
  const options = [['', '(nothing)']];
  for (const id of spellsFor(player.vocation)) options.push([`spell:${id}`, `Spell: ${SPELLS[id].name}`]);
  for (const id of Object.keys(ITEMS)) {
    const d = ITEMS[id];
    if (d.use) options.push([`item:${id}`, `Use: ${d.name}`]);
    if (d.rune) options.push([`rune:${id}`, `Rune on target: ${d.name}`]);
  }
  options.push(['say', 'Say...']);
  for (let i = 1; i <= 12; i++) {
    const key = `F${i}`, h = player.hotkeys[key] || {};
    const row = document.createElement('div');
    row.className = 'hotkey-row';
    const label = document.createElement('kbd');
    label.textContent = key;
    const select = document.createElement('select');
    select.dataset.key = key;
    for (const [value, text] of options) select.add(new Option(text, value));
    select.value = h.type === 'say' ? 'say' : h.type ? `${h.type}:${h.id}` : '';
    const text = document.createElement('input');
    text.placeholder = 'text to say';
    text.value = h.text || '';
    text.hidden = select.value !== 'say';
    select.addEventListener('change', () => { text.hidden = select.value !== 'say'; });
    row.append(label, select, text);
    root.appendChild(row);
  }
  $('hotkeys').hidden = false;
}

function saveHotkeys() {
  const hotkeys = {};
  for (const row of $('hotkeyList').children) {
    const select = row.querySelector('select'), text = row.querySelector('input');
    if (!select.value) continue;
    if (select.value === 'say') hotkeys[select.dataset.key] = { type: 'say', text: text.value };
    else {
      const [type, id] = select.value.split(':');
      hotkeys[select.dataset.key] = { type, id };
    }
  }
  Actions.setHotkeys(hotkeys);
  $('hotkeys').hidden = true;
}

// ---- settings kept in this browser ---------------------------------------------------------
function loadSetting(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(`tilequest.${key}`));
    return v === null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}
function saveSetting(key, value) {
  try {
    localStorage.setItem(`tilequest.${key}`, JSON.stringify(value));
  } catch (e) { /* not remembered */ }
}
// Right-click on a monster or player: a menu (follow, attack, look...), or straight to
// the attack, as with Tibia's classic controls (Ctrl+click still opens the menu then).
let rightClickAttacks = loadSetting('rightClickAttacks', false);

// ---- outfit ------------------------------------------------------------------------------
// As in Tibia: pick an outfit and its cut, colour its four parts (head, primary,
// secondary, detail) from a palette of 133 colours, and wear the addons your level allows.
const OUTFIT_PARTS = [['hair', 'Head'], ['body', 'Primary'], ['legs', 'Secondary'], ['feet', 'Detail']];
const OUTFIT_COLORS = (() => {
  const hex = (r, g, b) => `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  const hsl = (h, s, l) => { // hue in degrees, saturation and lightness 0..1
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = n => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
    return hex(f(0), f(8), f(4));
  };
  const rows = [[0.3, 0.86], [0.55, 0.74], [0.8, 0.62], [0.95, 0.5], [0.85, 0.38], [0.7, 0.27], [0.55, 0.16]];
  const colors = [];
  rows.forEach(([sat, light], row) => {
    const v = 255 * (1 - row / 6);
    colors.push(hex(v, v, v));
    for (let i = 0; i < 18; i++) colors.push(hsl(i * 20, sat, light));
  });
  return colors;
})();
let outfitDraft = {}, outfitPart = 'body';

function openOutfit(onDone) {
  document.body.classList.remove('panel-open'); // on a phone: the drawer makes way
  outfitDraft = { ...player.outfit }; // no type chosen: you wear your vocation's outfit
  renderOutfit();
  $('outfitDone').onclick = () => {
    Actions.setOutfit(outfitDraft);
    $('outfit').hidden = true;
    if (onDone) onDone();
  };
  $('outfit').hidden = false;
}

function renderOutfit() {
  const types = Object.keys(OUTFITS), allowed = allowedAddons(player.level);
  const type = outfitDraft.type || VOCATION_OUTFIT[player.vocation] || 'citizen';
  const turn = d => {
    outfitDraft.type = types[(types.indexOf(type) + d + types.length) % types.length];
    renderOutfit();
  };
  const root = $('outfitParts');
  root.replaceChildren();
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  // outfit and cut
  const row = el('div', 'outfit-type');
  const prev = el('button', '', '◀'), next = el('button', '', '▶');
  prev.onclick = () => turn(-1);
  next.onclick = () => turn(1);
  row.append(prev, el('b', '', OUTFITS[type].name), next);
  for (const [female, label] of [[false, 'Male'], [true, 'Female']]) {
    const b = el('button', !!outfitDraft.female === female ? 'active' : '', label);
    b.onclick = () => { outfitDraft.female = female; renderOutfit(); };
    row.appendChild(b);
  }
  root.appendChild(row);
  // addons
  const addons = el('div', 'outfit-addons');
  OUTFITS[type].addons.forEach((name, i) => {
    const bit = 1 << i, label = el('label', allowed & bit ? '' : 'muted'), box = el('input');
    box.type = 'checkbox';
    box.disabled = !(allowed & bit);
    box.checked = !!(outfitDraft.addons & bit) && !box.disabled;
    box.onchange = () => { outfitDraft.addons = ((outfitDraft.addons | 0) & ~bit) | (box.checked ? bit : 0); drawOutfitPreview(); };
    label.append(box, ` Addon ${i + 1}: ${name}${allowed & bit ? '' : ` (level ${ADDON_LEVELS[i]})`}`);
    addons.appendChild(label);
  });
  root.appendChild(addons);
  // which part to colour, and the palette
  const parts = el('div', 'tabs outfit-parts');
  for (const [part, label] of OUTFIT_PARTS) {
    const b = el('button', part === outfitPart ? 'active' : '', label);
    b.style.borderBottom = `3px solid ${outfitDraft[part] || '#888'}`;
    b.onclick = () => { outfitPart = part; renderOutfit(); };
    parts.appendChild(b);
  }
  root.appendChild(parts);
  const palette = el('div', 'outfit-palette');
  for (const color of OUTFIT_COLORS) {
    const b = el('button', `swatch-color${outfitDraft[outfitPart] === color ? ' active' : ''}`);
    b.style.background = color;
    b.title = color;
    b.onclick = () => { outfitDraft[outfitPart] = color; renderOutfit(); };
    palette.appendChild(b);
  }
  root.appendChild(palette);
  drawOutfitPreview();
}

// The four directions, walking.
let outfitTimer = null;
function drawOutfitPreview() {
  const c = $('outfitPreview'), g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, c.width, c.height);
  const frame = [0, 1, 0, 2][Math.floor(performance.now() / 250) % 4];
  [2, 1, 0, 3].forEach((dir, i) => g.drawImage(Sprites.creature(Sprites.playerKey(player.vocation, outfitDraft), dir, frame), i * 64, 0, 64, 64));
  clearTimeout(outfitTimer);
  if (!$('outfit').hidden) outfitTimer = setTimeout(drawOutfitPreview, 250);
}

// ---- minimap and world map --------------------------------------------------------------------
const GROUND_COLORS = {
  grass: '#4a8a3c', dirt: '#8b6b42', sand: '#d8c690', cobble: '#8a8a8e', marble: '#d8d4cc', wood: '#9a6a3a',
  cave: '#6a5e52', swamp: '#4a5a30', roof: '#9e4436', water: '#2d63b5', mountain: '#857a6a', carpet: '#8a1a22',
  bridge_ns: '#8a5a2e', bridge_ew: '#8a5a2e', paving: '#a8a49a', brick: '#9a4a3a', tiles: '#c8b8a0', gravel: '#9a968e', farmland: '#6a4a2a',
  roof_slate: '#5c6476', roof_thatch: '#c4a056', roof_shingle: '#785232', roof_green: '#46785c', roof_flat: '#d6ba82',
  snow: '#e8eef4', ice: '#b8d6e8', jungle: '#2f6a2a', sandstone: '#c8a868', ash: '#4a4644', lava: '#d04a18',
  crypt: '#4a4c54', pit: '#0a0806', sewer: '#5e6458', sewer_water: '#2c4630', sewer_bridge_ns: '#8a5a2e', sewer_bridge_ew: '#8a5a2e',
};
const WALL_COLORS = {
  wall_stone: '#5a5a60', wall_temple: '#8a8478', wall_block: '#5a5a60', wall_secret: '#5a5a60', wall_wood: '#5e4026', wall_cave: '#3a322c', wall_sewer: '#3a3c36', wall_crypt: '#2e2e34', wall_sandstone: '#9a7a48',
  cliff: '#5e5446', tree: '#1f4f22', pine: '#1a4426', snow_pine: '#2a5a4a', jungle_tree: '#163a12', palm: '#3a7a2a', dead_tree: '#3a3028',
};

function minimapColor(t) {
  if (!t) return null;
  for (let i = t.items.length - 1; i >= 0; i--) {
    const id = t.items[i], def = THINGS[id];
    if (def.change || def.ropeSpot || def.teleport) return '#ffe040';
    if (WALL_COLORS[id]) return WALL_COLORS[id];
    if (def.block) return '#7a6a50';
  }
  return GROUND_COLORS[t.ground] || null;
}

// Testing phase: everyone knows the whole map. Set to false to explore it bit by bit again.
const REVEAL_MAP = true;
const minimap = { zoom: 2, viewZ: null, explored: [], layers: [], lastPos: '' }; // viewZ: floor looked at, or null for yours
// Start the explored map over, sized to the current map (also when the server plays another map).
function resetMinimap() {
  minimap.explored = Array.from({ length: map.depth }, () => new Uint8Array(map.width * map.height));
  minimap.layers = Array.from({ length: map.depth }, () => {
    const c = document.createElement('canvas');
    c.width = map.width;
    c.height = map.height;
    return c;
  });
  mapPlaces = null;
  if (REVEAL_MAP) repaintMinimap();
}

// The page plays another map now (the server's): start the explored map over if
// it's another size, else draw what was explored again from the new tiles.
function fitMinimap() {
  const layer = minimap.layers[0];
  if (minimap.layers.length !== map.depth || layer.width !== map.width || layer.height !== map.height) return resetMinimap();
  mapPlaces = null;
  repaintMinimap();
}

// Draw the explored map again, a floor at a time (all of it while REVEAL_MAP is on).
function repaintMinimap() {
  const rgb = new Map();
  for (let z = 0; z < map.depth; z++) {
    const floor = map.floors[z], seen = minimap.explored[z], g = minimap.layers[z].getContext('2d');
    if (REVEAL_MAP) seen.fill(1);
    if (!floor.some(Boolean)) {
      g.clearRect(0, 0, map.width, map.height);
      continue;
    }
    const img = g.createImageData(map.width, map.height), d = img.data;
    for (let i = 0; i < floor.length; i++) {
      const color = seen[i] && floor[i] && minimapColor(floor[i]);
      if (!color) continue;
      if (!rgb.has(color)) rgb.set(color, parseInt(color.slice(1), 16));
      const n = rgb.get(color);
      d[i * 4] = n >> 16;
      d[i * 4 + 1] = (n >> 8) & 255;
      d[i * 4 + 2] = n & 255;
      d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
}

// Useful places, from the map's people: temples, shops, banks, ships, quest givers, and the towns.
// They show on the maps once you have explored them.
const PLACE_ICONS = { temple: ['✚', '#8fe0ff'], shop: ['$', '#ffd84a'], bank: ['¤', '#ffd84a'], ship: ['⚓', '#a8d0ff'], quest: ['!', '#ff9a30'], cart: ['⛏', '#d0d0d0'] };
let mapPlaces = null, builtinWorld = !customMap; // builtinWorld: playing the world from default-map.js
function placesOnMap() {
  if (mapPlaces) return mapPlaces;
  mapPlaces = [];
  for (const n of map.npcs) {
    const def = NPCS[n.type];
    if (!def) continue;
    const services = Object.values(def.keywords || {}).filter(v => v && typeof v === 'object');
    const has = k => services.some(v => v[k]);
    const kind = has('travel') ? 'ship' : has('cart') ? 'cart' : has('bank') ? 'bank' : has('heal') ? 'temple' : def.trade ? 'shop' : has('quest') ? 'quest' : null;
    if (kind) mapPlaces.push({ x: n.x, y: n.y, z: n.z, kind, label: def.name });
  }
  if (!builtinWorld) return mapPlaces; // a map from the editor has its own towns
  for (const [label, x, y, z] of MAP_TOWNS) mapPlaces.push({ x, y, z, kind: 'town', label });
  for (const { name, x, y, z } of map.labels || []) mapPlaces.push({ x, y, z, kind: 'isle', label: name }); // the islands
  return mapPlaces;
}
resetMinimap();

function paintTile(x, y, z) {
  const g = minimap.layers[z].getContext('2d'), color = minimapColor(map.get(x, y, z));
  g.clearRect(x, y, 1, 1);
  if (color) {
    g.fillStyle = color;
    g.fillRect(x, y, 1, 1);
  }
}

let exploredExport = null; // exportExplored()'s answer, until something new is explored
function exploreTile(x, y, z) {
  const i = y * map.width + x;
  if (minimap.explored[z][i]) return;
  minimap.explored[z][i] = 1;
  exploredExport = null;
  paintTile(x, y, z);
}

// Mark everything on screen as explored when the player moves; repaint changed tiles.
function exploreAround() {
  for (const [x, y, z] of mapChanges.splice(0)) if (minimap.explored[z][y * map.width + x]) paintTile(x, y, z);
  const key = `${player.x},${player.y},${player.z}`;
  if (key === minimap.lastPos) return;
  minimap.lastPos = key;
  const rx = Math.ceil(VIEW_W / 2) + 1, ry = Math.ceil(VIEW_H / 2) + 1;
  for (let y = player.y - ry; y <= player.y + ry; y++) for (let x = player.x - rx; x <= player.x + rx; x++) {
    if (map.inBounds(x, y, player.z)) exploreTile(x, y, player.z);
  }
}

function drawMap(c, z, scale, cx, cy) {
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  const ox = c.width / 2 - (cx + 0.5) * scale, oy = c.height / 2 - (cy + 0.5) * scale;
  g.drawImage(minimap.layers[z], ox, oy, map.width * scale, map.height * scale);
  // places you have explored: icons, and the names of towns where there's room for them
  const seen = (x, y) => map.inBounds(x, y, z) && minimap.explored[z][y * map.width + x];
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const p of placesOnMap()) {
    if (p.z !== z || !seen(p.x, p.y)) continue;
    const px = ox + (p.x + 0.5) * scale, py = oy + (p.y + 0.5) * scale;
    if (px < -40 || py < -10 || px > c.width + 40 || py > c.height + 10) continue;
    if (p.kind === 'town' || p.kind === 'isle') {
      if (scale > 6 || (p.kind === 'isle' && scale < 2)) continue;
      g.font = p.kind === 'town' ? 'bold 12px sans-serif' : 'italic 11px sans-serif';
      g.lineWidth = 3;
      g.strokeStyle = '#000';
      g.strokeText(p.label, px, py - 8);
      g.fillStyle = p.kind === 'town' ? '#fff' : '#bfe4ff';
      g.fillText(p.label, px, py - 8);
      continue;
    }
    const [icon, color] = PLACE_ICONS[p.kind];
    const pulse = p.kind === 'quest' ? 1 + 0.25 * Math.sin(performance.now() / 260) : 1; // quests call out
    g.font = `bold ${Math.round(Math.max(10, Math.min(16, scale * 3)) * pulse)}px sans-serif`;
    g.fillStyle = '#000';
    g.fillText(icon, px + 1, py + 1);
    g.fillStyle = color;
    g.fillText(icon, px, py);
  }
  g.textAlign = 'start';
  g.textBaseline = 'alphabetic';
  // other players: green dots
  for (const o of players) {
    if (o === player || o.dead || o.z !== z) continue;
    g.fillStyle = '#30e060';
    g.fillRect(ox + o.x * scale - 1, oy + o.y * scale - 1, Math.max(3, scale), Math.max(3, scale));
  }
  // your marks: their icons, and at a close zoom their descriptions
  const size = Math.max(10, Math.min(16, scale * 3));
  for (const k of player.markers) {
    if (k.z !== z) continue;
    const kx = ox + (k.x + 0.5) * scale, ky = oy + (k.y + 0.5) * scale;
    drawMarkIcon(g, k.icon, kx, ky, size);
    if (scale >= 5 && k.label) {
      g.font = '11px sans-serif';
      g.lineWidth = 3;
      g.strokeStyle = '#000';
      g.strokeText(k.label, kx + size / 2 + 3, ky + 4);
      g.fillStyle = '#fff';
      g.fillText(k.label, kx + size / 2 + 3, ky + 4);
    }
  }
  if (z === player.z && Math.floor(now / 400) % 2 === 0) {
    g.fillStyle = '#fff';
    g.fillRect(ox + player.x * scale - 1, oy + player.y * scale - 1, Math.max(3, scale), Math.max(3, scale));
  }
  return { ox, oy };
}

// ---- map marks ---------------------------------------------------------------------------
const MARK_COLORS = {
  check: '#48d848', question: '#f0e040', exclamation: '#ff9a30', star: '#ffd840', crossmark: '#ff4040', cross: '#f4f4f4',
  mouth: '#e84868', spear: '#c8c8d0', sword: '#dcdce4', flag: '#e83030', lock: '#e0b030', bag: '#b07a40', skull: '#f0f0e8',
  dollar: '#ffd040', up: '#ff4040', down: '#ff4040', left: '#ff4040', right: '#ff4040', green_up: '#48d848', green_down: '#48d848',
};
// A mark's icon, s pixels across, centred on (cx, cy), with a black outline so it shows on any ground.
function drawMarkIcon(g, icon, cx, cy, s) {
  const c = MARK_COLORS[icon] || '#fff', h = s / 2;
  g.save();
  g.translate(cx, cy);
  g.lineJoin = g.lineCap = 'round';
  const path = points => { g.beginPath(); points.forEach(([x, y], i) => (i ? g.lineTo(x * h, y * h) : g.moveTo(x * h, y * h))); g.closePath(); };
  const solid = () => { g.lineWidth = 2; g.strokeStyle = '#000'; g.stroke(); g.fillStyle = c; g.fill(); };
  const stroke = w => { g.lineWidth = w + 2; g.strokeStyle = '#000'; g.stroke(); g.lineWidth = w; g.strokeStyle = c; g.stroke(); };
  const text = ch => {
    g.font = `bold ${Math.round(s * 1.15)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 3;
    g.strokeStyle = '#000';
    g.strokeText(ch, 0, 1);
    g.fillStyle = c;
    g.fillText(ch, 0, 1);
  };
  const lineOf = (x0, y0, x1, y1, w) => { g.beginPath(); g.moveTo(x0 * h, y0 * h); g.lineTo(x1 * h, y1 * h); stroke(w); };
  const ARROW = [[0, -1], [1, 0.1], [0.38, 0.1], [0.38, 1], [-0.38, 1], [-0.38, 0.1], [-1, 0.1]];
  const arrow = turn => { g.rotate(turn); path(ARROW); solid(); };
  switch (icon) {
    case 'check': g.beginPath(); g.moveTo(-0.8 * h, 0); g.lineTo(-0.2 * h, 0.65 * h); g.lineTo(0.85 * h, -0.65 * h); stroke(Math.max(2, s / 5)); break;
    case 'question': text('?'); break;
    case 'exclamation': text('!'); break;
    case 'dollar': text('$'); break;
    case 'star': path(Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, d = i % 2 ? 0.45 : 1; return [Math.cos(a) * d, Math.sin(a) * d]; })); solid(); break;
    case 'crossmark': lineOf(-0.7, -0.7, 0.7, 0.7, Math.max(2, s / 5)); lineOf(0.7, -0.7, -0.7, 0.7, Math.max(2, s / 5)); break;
    case 'cross': path([[-0.3, -1], [0.3, -1], [0.3, -0.3], [1, -0.3], [1, 0.3], [0.3, 0.3], [0.3, 1], [-0.3, 1], [-0.3, 0.3], [-1, 0.3], [-1, -0.3], [-0.3, -0.3]]); solid(); break;
    case 'mouth': g.beginPath(); g.ellipse(0, 0, h, h * 0.55, 0, 0, Math.PI * 2); solid(); g.fillStyle = '#5a0a14'; g.fillRect(-0.7 * h, -0.5, 1.4 * h, 1.2); break;
    case 'spear': lineOf(-0.9, 0.9, 0.4, -0.4, 2); path([[1, -1], [0.15, -0.6], [0.6, -0.15]]); solid(); break;
    case 'sword': lineOf(-0.7, 0.7, 0.95, -0.95, Math.max(2, s / 6)); lineOf(-0.85, 0.05, -0.05, 0.85, 2); break;
    case 'flag': lineOf(-0.6, 1, -0.6, -1, 2); path([[-0.6, -1], [1, -0.55], [-0.6, -0.05]]); solid(); break;
    case 'lock': g.beginPath(); g.arc(0, -0.15 * h, 0.45 * h, Math.PI, 0); stroke(2); path([[-0.75, -0.15], [0.75, -0.15], [0.75, 1], [-0.75, 1]]); solid(); break;
    case 'bag': g.beginPath(); g.ellipse(0, 0.2 * h, 0.8 * h, 0.78 * h, 0, 0, Math.PI * 2); solid(); path([[-0.3, -0.9], [0.3, -0.9], [0.2, -0.5], [-0.2, -0.5]]); solid(); break;
    case 'skull':
      g.beginPath(); g.arc(0, -0.15 * h, 0.8 * h, 0, Math.PI * 2); solid();
      path([[-0.45, 0.4], [0.45, 0.4], [0.4, 1], [-0.4, 1]]); solid();
      g.fillStyle = '#000';
      for (const ex of [-0.35, 0.35]) { g.beginPath(); g.arc(ex * h, -0.15 * h, 0.2 * h, 0, Math.PI * 2); g.fill(); }
      break;
    case 'up': case 'green_up': arrow(0); break;
    case 'right': arrow(Math.PI / 2); break;
    case 'down': case 'green_down': arrow(Math.PI); break;
    case 'left': arrow(-Math.PI / 2); break;
  }
  g.restore();
}

// Your mark on or right next to tile t (how near depends on the zoom), if any.
function markAt(t, scale) {
  const reach = Math.max(1, Math.round(6 / scale));
  return player.markers.find(k => k.z === t.z && Math.abs(k.x - t.x) <= reach && Math.abs(k.y - t.y) <= reach) || null;
}

// Create a mark on tile t, or edit (or delete) the one there.
let markDraft = null;
function openMark(t, scale) {
  const old = markAt(t, scale);
  markDraft = { old, x: old ? old.x : t.x, y: old ? old.y : t.y, z: t.z, icon: old ? old.icon : 'flag' };
  $('markTitle').textContent = old ? 'Edit mark' : 'Create mark';
  $('markLabel').value = old ? old.label : '';
  $('markDelete').hidden = !old;
  const list = $('markIcons');
  list.replaceChildren();
  for (const icon of MARK_ICONS) {
    const b = document.createElement('button'), c = document.createElement('canvas');
    c.width = c.height = 24;
    drawMarkIcon(c.getContext('2d'), icon, 12, 12, 16);
    b.title = icon.replace('_', ' ');
    b.classList.toggle('active', icon === markDraft.icon);
    b.appendChild(c);
    b.addEventListener('click', () => {
      markDraft.icon = icon;
      list.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    });
    list.appendChild(b);
  }
  $('markDialog').hidden = false;
  $('markLabel').focus();
}
function closeMark(save, remove) {
  const d = markDraft;
  $('markDialog').hidden = true;
  if (!d || !(save || remove)) return;
  // the mark by where it is (online, the list itself is renewed by the server all the time)
  const at = d.old ? player.markers.findIndex(k => k.x === d.old.x && k.y === d.old.y && k.z === d.old.z) : -1;
  const mark = { x: d.x, y: d.y, z: d.z, icon: d.icon, label: $('markLabel').value.trim() }, list = [...player.markers];
  if (remove) list.splice(at, at < 0 ? 0 : 1);
  else if (at >= 0) list[at] = mark;
  else if (list.length >= MAX_MARKS) return log(`You have ${MAX_MARKS} marks already: delete one first.`);
  else list.push(mark);
  Actions.setMarkers(list);
}
// Right-click (or, on a touch screen, hold) a map to mark a spot; hovering a mark shows what it says.
function markable(canvas, tileOf, scaleOf) {
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (player) openMark(tileOf(e), scaleOf());
  });
  canvas.addEventListener('mousemove', e => {
    const k = player && markAt(tileOf(e), scaleOf());
    canvas.title = k ? k.label || k.icon : '';
  });
  // Holding one finger still marks the spot; a second finger (a pinch) or moving away doesn't.
  let hold = null, fingers = 0, holdFrom = null;
  const cancel = () => { if (hold && hold !== 'done') clearTimeout(hold); if (hold !== 'done') hold = null; };
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    cancel();
    if (++fingers > 1) return;
    hold = null; // a click after the last hold's mark is long gone
    holdFrom = { x: e.clientX, y: e.clientY };
    const t = tileOf(e);
    hold = setTimeout(() => { hold = 'done'; openMark(t, scaleOf()); }, 600);
  });
  canvas.addEventListener('pointermove', e => { if (e.pointerType === 'touch' && holdFrom && Math.hypot(e.clientX - holdFrom.x, e.clientY - holdFrom.y) > 8) cancel(); });
  const lift = e => { if (e.pointerType === 'touch') fingers = Math.max(0, fingers - 1); cancel(); };
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);
  // the tap that ends a hold isn't a click
  canvas.addEventListener('click', e => { if (hold === 'done') { e.stopImmediatePropagation(); hold = null; } }, true);
}

function drawMinimap() {
  const z = minimap.viewZ ?? player.z;
  drawMap($('minimap'), z, minimap.zoom, player.x, player.y);
  $('minimapFloor').textContent = `floor ${map.floorLabel(z)}`;
  if (!$('worldmap').hidden) drawWorldMap();
}

// center: the tile in the middle of the world map (null: follow the player); drag to move it.
const worldMap = { z: null, scale: 5, offset: { ox: 0, oy: 0 }, center: null, ride: false };
function drawWorldMap() {
  const z = worldMap.z ?? player.z;
  const c = worldMap.center || player;
  worldMap.offset = drawMap($('worldCanvas'), z, worldMap.scale, c.x, c.y);
  $('worldFloor').textContent = worldMap.ride ? 'Ride: tap where to go' : `Floor ${map.floorLabel(z)}`;
}

function worldMapTile(e) {
  const c = $('worldCanvas'), r = c.getBoundingClientRect();
  return {
    x: Math.floor(((e.clientX - r.left) * (c.width / r.width) - worldMap.offset.ox) / worldMap.scale),
    y: Math.floor(((e.clientY - r.top) * (c.height / r.height) - worldMap.offset.oy) / worldMap.scale),
    z: worldMap.z ?? player.z,
  };
}

function exportExplored() {
  if (exploredExport) return exploredExport;
  return (exploredExport = minimap.explored.map(arr => {
    let s = '';
    for (let i = 0; i < arr.length; i += 8) {
      let b = 0;
      for (let k = 0; k < 8; k++) if (arr[i + k]) b |= 1 << k;
      s += String.fromCharCode(b);
    }
    return btoa(s);
  }));
}

function importExplored(list) {
  if (!Array.isArray(list) || list.length !== map.depth) return;
  list.forEach((b64, z) => {
    const s = atob(b64);
    if (s.length !== Math.ceil((map.width * map.height) / 8)) return; // saved on a different map
    for (let i = 0; i < map.width * map.height; i++) {
      if ((s.charCodeAt(i >> 3) >> (i & 7)) & 1) exploreTile(i % map.width, Math.floor(i / map.width), z);
    }
  });
}

function initMaps() {
  const c = $('minimap');
  const minimapTile = e => {
    const r = c.getBoundingClientRect();
    return {
      x: Math.floor(player.x + 0.5 + ((e.clientX - r.left) * (c.width / r.width) - c.width / 2) / minimap.zoom),
      y: Math.floor(player.y + 0.5 + ((e.clientY - r.top) * (c.height / r.height) - c.height / 2) / minimap.zoom),
      z: minimap.viewZ ?? player.z,
    };
  };
  c.addEventListener('click', e => {
    if ((minimap.viewZ ?? player.z) !== player.z || player.dead) return;
    const t = minimapTile(e);
    Actions.walkTo(t.x, t.y, 30000);
  });
  markable(c, minimapTile, () => minimap.zoom);
  // two fingers on the minimap zoom it in and out
  const mmFingers = new Map();
  let mmPinch = null;
  const mmSpread = () => { const [a, b] = [...mmFingers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  c.addEventListener('pointerdown', e => {
    mmFingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mmFingers.size === 2) mmPinch = { from: mmSpread(), zoom: minimap.zoom };
  });
  c.addEventListener('pointermove', e => {
    if (!mmFingers.has(e.pointerId)) return;
    mmFingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mmPinch && mmFingers.size >= 2) minimap.zoom = Math.max(1, Math.min(8, mmPinch.zoom * (mmSpread() / Math.max(1, mmPinch.from))));
  });
  for (const ev of ['pointerup', 'pointercancel']) c.addEventListener(ev, e => { mmFingers.delete(e.pointerId); if (mmFingers.size < 2) mmPinch = null; });
  c.addEventListener('click', e => { if (mmFingers.size || mmPinch) e.stopImmediatePropagation(); }, true);
  markable($('worldCanvas'), e => worldMapTile(e), () => worldMap.scale);
  $('markSave').addEventListener('click', () => closeMark(true));
  $('markCancel').addEventListener('click', () => closeMark(false));
  $('markDelete').addEventListener('click', () => closeMark(false, true));
  $('markLabel').addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') closeMark(true);
    if (e.key === 'Escape') closeMark(false);
  });
  $('mmZoomIn').addEventListener('click', () => { minimap.zoom = Math.min(8, minimap.zoom * 2); });
  $('mmZoomOut').addEventListener('click', () => { minimap.zoom = Math.max(1, minimap.zoom / 2); });
  const look = dz => {
    const z = Math.max(0, Math.min(map.depth - 1, (minimap.viewZ ?? player.z) + dz));
    minimap.viewZ = z === player.z ? null : z;
  };
  $('mmUp').addEventListener('click', () => look(1));
  $('mmDown').addEventListener('click', () => look(-1));
  $('mmWorld').addEventListener('click', () => toggleWorldMap());

  const wc = $('worldCanvas');
  $('worldRide').addEventListener('click', () => setRideMode(!worldMap.ride));
  $('rideCancel').addEventListener('click', () => { $('rideChoice').hidden = true; });
  // Drag the world map to look around (one finger, or the mouse), pinch it to zoom
  // (two fingers); a tap without either is a click.
  let pan = null;
  const fingers = new Map();
  let pinch = null;
  const spread = () => { const [a, b] = [...fingers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  wc.addEventListener('pointerdown', e => {
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const c = worldMap.center || player;
    if (fingers.size === 2) {
      pinch = { from: spread(), scale: worldMap.scale };
      if (pan) pan.moved = true; // a pinch is never a tap
    } else pan = { x: e.clientX, y: e.clientY, cx: c.x, cy: c.y, moved: false };
    try {
      wc.setPointerCapture(e.pointerId);
    } catch (err) { /* the pointer is already gone */ }
  });
  wc.addEventListener('pointermove', e => {
    if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && fingers.size >= 2) {
      worldMap.scale = Math.max(1, Math.min(12, pinch.scale * (spread() / Math.max(1, pinch.from))));
      return;
    }
    if (!pan) return;
    const r = wc.getBoundingClientRect(), k = wc.width / r.width / worldMap.scale;
    const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) < 8) return;
    pan.moved = true;
    worldMap.center = { x: Math.round(pan.cx - dx * k), y: Math.round(pan.cy - dy * k) };
  });
  const lift = e => {
    fingers.delete(e.pointerId);
    if (fingers.size < 2) pinch = null;
    if (fingers.size === 1 && pan) { // one finger stays: drag on from where it is
      const [f] = fingers.values(), c = worldMap.center || player;
      Object.assign(pan, { x: f.x, y: f.y, cx: c.x, cy: c.y });
    }
  };
  wc.addEventListener('pointercancel', lift);
  wc.addEventListener('pointerup', e => { lift(e); if (!fingers.size) setTimeout(() => { pan = null; }); });
  wc.addEventListener('click', e => {
    if (pan && pan.moved) return;
    const t = worldMapTile(e);
    if (worldMap.ride) {
      if (!map.inBounds(t.x, t.y, map.surfaceZ)) return;
      if (!minimap.explored[map.surfaceZ][t.y * map.width + t.x]) return log('A cab can only take you to places you have seen.');
      chooseRide(t);
    } else if (t.z === player.z) {
      Actions.walkTo(t.x, t.y, 30000);
      toggleWorldMap();
    }
  });
  wc.addEventListener('wheel', e => {
    e.preventDefault();
    worldMap.scale = Math.max(1, Math.min(12, worldMap.scale + (e.deltaY < 0 ? 1 : -1)));
  }, { passive: false });
  const zoom = d => { worldMap.scale = Math.max(1, Math.min(12, worldMap.scale + d)); };
  $('worldZoomIn').addEventListener('click', () => zoom(1));
  $('worldZoomOut').addEventListener('click', () => zoom(-1));
  $('worldUp').addEventListener('click', () => { worldMap.z = Math.min(map.depth - 1, (worldMap.z ?? player.z) + 1); });
  $('worldDown').addEventListener('click', () => { worldMap.z = Math.max(0, (worldMap.z ?? player.z) - 1); });
  $('worldClose').addEventListener('click', () => toggleWorldMap());
}

// Three ways to get there: by cab, by balloon (over water too), or with Dom (fast, and pricey).
const RIDE_CHOICES = [
  ['cab', '🐴 Hoofer cab', 'by land'],
  ['balloon', '🎈 Balloon', 'flies straight there, over water too'],
  ['dom', '🏎 Dom', 'by land, three times as fast'],
];
function chooseRide(t) {
  const list = $('rideOptions');
  list.replaceChildren();
  for (const [kind, name, how] of RIDE_CHOICES) {
    const cost = rideCost(kind, player, t);
    const b = document.createElement('button');
    b.className = 'hot';
    b.disabled = player.gold < cost;
    b.innerHTML = '<span></span><small></small>';
    b.querySelector('span').textContent = `${name} - ${cost} gold`;
    b.querySelector('small').textContent = b.disabled ? 'not enough gold' : how;
    b.addEventListener('click', () => {
      Actions.orderRide(t.x, t.y, kind);
      $('rideChoice').hidden = true;
      if (!$('worldmap').hidden) toggleWorldMap();
    });
    list.appendChild(b);
  }
  $('rideChoice').hidden = false;
}

function setRideMode(on) {
  worldMap.ride = on;
  $('worldRide').classList.toggle('active', on);
  $('worldCanvas').classList.toggle('targeting', on);
}

function toggleWorldMap(ride = false) {
  const w = $('worldmap');
  w.hidden = !w.hidden;
  // upstairs in a building (a temple, a tower), its own floor is mostly empty: open on the ground outside instead
  const indoors = player.z > map.surfaceZ && map.get(player.x, player.y, player.z + 1) && THINGS[(map.get(player.x, player.y, player.z + 1).ground) || 'grass'].roof;
  worldMap.z = indoors || map.isShelter(player.x, player.y, player.z) && player.z > map.surfaceZ ? map.surfaceZ : null;
  worldMap.center = null;
  setRideMode(!w.hidden && ride);
  document.body.classList.remove('panel-open'); // on a phone, the drawer would cover it
  if (!w.hidden) {
    const c = $('worldCanvas'), box = $('viewport').getBoundingClientRect();
    c.width = Math.max(320, Math.floor(box.width - 40));
    c.height = Math.max(240, Math.floor(box.height - 90));
  }
}

// ---- static UI wiring --------------------------------------------------------------------------
function initUI() {
  $('guideHead').addEventListener('click', () => {
    guideFolded = !guideFolded;
    try { localStorage.setItem('tilequest.guideFolded', guideFolded ? '1' : '0'); } catch (e) { /* no storage: only for now */ }
    renderGuide();
  });
  $('guideDone').addEventListener('click', () => Actions.endGuide());
  $('battle').addEventListener('pointerleave', () => { battleHover = null; });
  document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach(o => o.classList.toggle('active', o === b));
    document.querySelectorAll('.tab').forEach(t => { t.hidden = t.id !== `tab-${b.dataset.tab}`; });
  }));
  document.querySelector('[data-tab="skills"]').click();
  $('partyShare').addEventListener('click', () => { const v = myPartyView(); if (v) Actions.partyShareXp(!v.shared); });
  $('partyLeave').addEventListener('click', () => Actions.partyLeave());
  $('guildBtn').addEventListener('click', () => toggleGuild());
  $('guildClose').addEventListener('click', () => toggleGuild(false));
  $('forgeClose').addEventListener('click', closeForge);
  $('chat').placeholder = CHAT_HINT;
  document.querySelectorAll('[data-logtab]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('[data-logtab]').forEach(o => o.classList.toggle('active', o === b));
    $('log').dataset.filter = b.dataset.logtab;
    $('chat').placeholder = { party: 'Talk to your party', guild: 'Talk to your guild' }[b.dataset.logtab]
      || CHAT_HINT;
    $('log').scrollTop = $('log').scrollHeight;
  }));
  document.querySelectorAll('[data-shoptab]').forEach(b => b.addEventListener('click', () => {
    shopTab = b.dataset.shoptab;
    renderShop();
  }));
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => Actions.setFightMode(b.dataset.mode)));
  $('chaseMode').addEventListener('click', () => Actions.setChase(!player.chase));
  $('secureMode').addEventListener('click', () => Actions.setSecure(player.secure === false));
  $('shopClose').addEventListener('click', () => Actions.closeShop());
  $('lootClose').addEventListener('click', () => Actions.closePile());
  $('lootAll').addEventListener('click', () => player.openPile && Actions.takeAll(player.openPile.id));
  $('readClose').addEventListener('click', () => { $('read').hidden = true; });
  $('hotkeysBtn').addEventListener('click', openHotkeys);
  $('hotkeysSave').addEventListener('click', saveHotkeys);
  $('hotkeysCancel').addEventListener('click', () => { $('hotkeys').hidden = true; });
  $('outfitBtn').addEventListener('click', () => { if (!paused && $('outfit').hidden) openOutfit(); }); // not while making a character
  $('soundBtn').addEventListener('click', () => { Sound.toggle(); updateSoundButtons(); });
  $('musicBtn').addEventListener('click', () => { Sound.toggleMusic(); updateSoundButtons(); });
  $('rightBtn').addEventListener('click', () => { rightClickAttacks = !rightClickAttacks; saveSetting('rightClickAttacks', rightClickAttacks); updateSoundButtons(); });
  updateSoundButtons();
  $('mapSource').textContent = typeof Net !== 'undefined' && Net.online ? 'Playing online' : customMap ? 'Map: saved by the editor' : 'Map: built-in world';
  $('resetMap').addEventListener('click', () => {
    if (!confirm('Forget the map saved by the editor and play the built-in world?')) return;
    localStorage.removeItem(MAP_STORAGE_KEY);
    location.reload();
  });
  $('fullscreen').addEventListener('click', () => {
    toggleFullscreen(); // see touch.js: careful with browsers that can't
  });
  $('newChar').addEventListener('click', () => {
    if (online()) { // online: log out of this browser, so you can log in as someone else
      if (!confirm('Log out? You can log in again with your name and password.')) return;
      Net.forget();
      return location.reload();
    }
    if (!confirm('Delete your character and start over?')) return;
    localStorage.removeItem(SAVE_KEY);
    window.onbeforeunload = null;
    location.reload();
  });
  initMaps();
}

function updateSoundButtons() {
  $('soundBtn').textContent = Sound.enabled ? 'Sound: on' : 'Sound: off';
  $('musicBtn').textContent = Sound.musicOn ? 'Music: on' : 'Music: off';
  $('rightBtn').textContent = rightClickAttacks ? 'Right-click: attack' : 'Right-click: menu';
}

// First visit: ask for a name, then an outfit.
function showCharacterCreation(onDone) {
  const dialog = $('create');
  dialog.hidden = false;
  const input = $('createName');
  input.focus();
  const done = () => {
    player.name = capitalize(input.value.trim().replace(/[^\w '-]/g, '').slice(0, 20) || 'Adventurer');
    dialog.hidden = true;
    openOutfit(onDone);
  };
  $('createStart').addEventListener('click', done);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') done();
    e.stopPropagation();
  });
}
