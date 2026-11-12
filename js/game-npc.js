'use strict';
// Talking to NPCs (keyword dialog and the services in npcs.js) and trading with them.

const TALK_RANGE = 3;

function spawnNpc(p) {
  const def = NPCS[p.type];
  return { id: newId(), type: 'npc', npcId: p.type, def, name: def.name, x: p.x, y: p.y, z: p.z, home: { x: p.x, y: p.y }, dir: 2, walk: null };
}

// Who answers your "hi": the nearest NPC, and of two as near, the one standing still
// (a trader behind their counter rather than someone passing by).
function nearestNpc() {
  const far = n => dist(n, player) + (n.def.wander ? 0.5 : 0);
  return npcs
    .filter(n => n.z === player.z && dist(n, player) <= TALK_RANGE)
    .sort((a, b) => far(a) - far(b))[0] || null;
}

// Townsfolk (NPCs with wander: n) stroll within n tiles of home - out on the streets,
// or indoors if they're indoor people - and stop for whoever talks to them. Anyone
// with chatter says one of its lines now and then, when someone is around to hear it.
const outdoors = (x, y, z) => !(map.get(x, y, z + 1) || {}).ground;
function updateNpcs() {
  for (const n of npcs) {
    const def = n.def;
    if (!def.wander && !def.chatter) continue;
    // A stationary NPC needs no movement work; cheap coordinate checks reject
    // distant players before the more expensive distance calculation.
    if (n.walk) finishWalk(n);
    const watched = players.some(p => !p.dead && p.z === n.z &&
      Math.abs(p.x - n.x) <= 10 && Math.abs(p.y - n.y) <= 10 &&
      dist(p, n) <= 10);
    if (!watched) continue;
    if (def.chatter && now >= (n.nextChat || 0)) {
      if (n.nextChat) addSpeech(n, def.chatter[Math.floor(Math.random() * def.chatter.length)], true);
      n.nextChat = now + 15000 + Math.random() * 35000;
    }
    if (!def.wander || n.walk || now < (n.nextMove || 0)) continue;
    n.nextMove = now + 600 + Math.random() * (def.idle || 3000);
    if (players.some(p => p.conversation && p.conversation.npc === n)) continue; // listening
    // mostly keep going the way they were going
    const ways = [[0, -1], [1, 0], [0, 1], [-1, 0]].sort(() => Math.random() - 0.5);
    if (Math.random() < 0.6) ways.unshift([DX[n.dir], DY[n.dir]]);
    for (const [dx, dy] of ways) {
      const x = n.x + dx, y = n.y + dy;
      if (Math.abs(x - n.home.x) > def.wander || Math.abs(y - n.home.y) > def.wander) continue;
      if (!isFreeNoStairs(x, y, n.z) || outdoors(x, y, n.z) === !!def.indoors) continue;
      if (map.get(x, y, n.z).items.some(id => THINGS[id].wall)) continue; // not in doorways
      if (step(n, dx, dy)) break;
    }
  }
}

function npcSay(npc, text) {
  text = text.replace(/\$name/g, player.name);
  logDialog(npc.name, text);
  addSpeech(npc, text.replace(/[{}]/g, ''), true, player.id); // what an NPC tells you is for you only
}

// Everything the player says goes through here: NPC talk, spell words, or chat to players nearby.
function say(text) {
  text = String(text).trim().slice(0, 200);
  if (!text) return;
  const channel = /^\/([pg])\s+(.*)$/i.exec(text); // "/p hello": to the party, "/g hello": to the guild
  if (channel) return channel[1].toLowerCase() === 'p' ? partySay(channel[2]) : guildSay(channel[2]);
  logDialog(player.name, text, true);
  const lower = text.toLowerCase();
  const spell = Object.keys(SPELLS).find(id => SPELLS[id].words === lower);
  if (spell) return castSpell(spell);
  addSpeech(player, text, true);
  taleDeed('say', `${taleWords(text)}|${player.x},${player.y},${player.z}`);
  for (const p of players) {
    if (p !== player && p.z === player.z && dist(p, player) <= 8) {
      const from = player.name;
      asPlayer(p, () => logDialog(from, text, true));
    }
  }
  if (!player.conversation) {
    if (/^(hi|hello|hey|greetings)\b/.test(lower)) {
      const npc = nearestNpc();
      if (npc) startConversation(npc);
    }
    return;
  }
  answer(lower);
}

// Who else knows a word you said (the NPC your quest goes on to first), and where they are: { name, where } or null
function otherToAsk(text, npcId) {
  const knows = id => Object.keys((NPCS[id] && NPCS[id].keywords) || {}).some(keys => mentions(text, keys.toLowerCase()));
  const next = Object.keys(player.quests).filter(id => QUESTS[id] && player.quests[id].status === 'active').map(id => questStep(id).npc || QUESTS[id].giver);
  const id = next.find(n => n !== npcId && knows(n)) || Object.keys(NPCS).find(n => n !== npcId && knows(n) && map.npcs.some(m => m.type === n));
  if (!id) return null;
  const where = map.npcs.find(m => m.type === id), label = where && (map.labels || []).find(l => l.z === where.z && Math.abs(l.x - where.x) < 12 && Math.abs(l.y - where.y) < 12);
  return { name: NPCS[id].name, where: label ? `You'll find them near ${label.text}.` : '' };
}

function startConversation(npc) {
  if (player.conversation && player.conversation.npc !== npc) endConversation();
  player.conversation = { npc, pending: null };
  npc.dir = dirTo(player.x - npc.x, player.y - npc.y);
  npcSay(npc, npc.def.greet);
  const hint = questHint(npc.npcId);
  if (hint) npcSay(npc, hint);
}

// ---- what an NPC has for you ------------------------------------------------------------
// Looks through the NPC's quest keywords ({ quest: [ids] }, a chain: the first unfinished quest counts) for
// what it has for the acting player: { mark, word, id, level }, the most pressing first:
//   report  you can hand in or finish a step here now
//   offer   a new quest, and you are strong enough for it
//   busy    a step of yours is reported here, but it isn't done yet
//   later   a new quest, once you reach `level`
// word: the keyword to say (the first of its alternatives, so put the plainest word first).
const NEWS_ORDER = { report: 0, offer: 1, busy: 2, later: 3 };
function questNews(npcId) {
  const def = NPCS[npcId];
  let best = null;
  for (const [keys, s] of Object.entries((def && def.keywords) || {})) {
    if (!s || !s.quest) continue;
    for (const id of s.quest) {
      const q = QUESTS[id], state = q ? questState(id) : 'done';
      if (state === 'done') continue;
      const word = questWord(npcId, id);
      let news = null;
      if (state === 'none') {
        if (questWaits(q)) break;
        if (q.giver === npcId || (q.offers && q.offers[npcId])) news = player.level >= (q.level || 0) ? { mark: 'offer', word, id } : { mark: 'later', word, id, level: q.level };
      } else if (!questStep(id).auto && (questStep(id).npc || q.giver) === npcId) news = { mark: stepReady(id) ? 'report' : 'busy', word, id };
      if (news && (!best || NEWS_ORDER[news.mark] < NEWS_ORDER[best.mark])) best = news;
      break;
    }
  }
  return best;
}

// The word to ask an NPC with about a quest (null if that NPC has nothing to say about it): the quest's (or its
// current step's) own word if the NPC knows it, else the first word of the NPC's keyword for it.
function questWord(npcId, id) {
  const q = QUESTS[id], st = q && player.quests[id] && player.quests[id].status === 'active' ? questStep(id) : null;
  const own = (st && st.word) || (q && q.word);
  for (const [keys, s] of Object.entries((NPCS[npcId] && NPCS[npcId].keywords) || {})) {
    if (!s || !s.quest || !s.quest.includes(id)) continue;
    return own && keys.split('|').includes(own) ? own : keys.split('|')[0];
  }
  return null;
}
// A quest that only opens once another is done (after), and that one isn't yet.
const questWaits = q => !!q.after && questState(q.after) !== 'done';

// What an NPC adds to its greeting when it has something for you, with the word to ask about in gold.
function questHint(npcId) {
  const n = questNews(npcId);
  if (!n) return null;
  return {
    report: `Have you brought me news? Tell me about the {${n.word}}.`,
    offer: `I could use your help, $name. Ask me about the {${n.word}}.`,
    busy: `Ask me about the {${n.word}} if you need a reminder of what to do.`,
    later: `Come back when you are level ${n.level}: I may need your help then.`,
  }[n.mark];
}

function endConversation(silent) {
  if (!player.conversation) return;
  if (!silent) npcSay(player.conversation.npc, 'Good bye, $name.');
  player.conversation = null;
  closeShop();
}

const mentions = (text, keys) => keys.split('|').some(k => new RegExp(`\\b${k}\\b`).test(text));

function answer(text) {
  const conv = player.conversation, npc = conv.npc, def = npc.def;
  const reply = r => r && player.conversation && npcSay(npc, r);
  if (mentions(text, 'bye|farewell')) return endConversation();
  if (conv.pending) {
    const p = conv.pending;
    conv.pending = null;
    if (mentions(text, 'yes')) return reply(p.yes());
    if (mentions(text, 'no')) return reply(p.no ? p.no() : 'As you wish.');
  }
  if (def.trade && mentions(text, 'trade|offer|buy|sell|wares')) {
    openShop(npc);
    return reply('Have a look at my wares.');
  }
  for (const [keys, response] of Object.entries(def.keywords || {})) {
    if (mentions(text, keys.toLowerCase())) return reply(typeof response === 'string' ? response : service(response, npc, text));
  }
  const landlord = Object.values(def.keywords || {}).some(r => r && r.houses);
  if (landlord && map.houses.some(h => text.includes(h.name.toLowerCase()))) return reply(houseTalk(text));
  if (mentions(text, 'name')) return reply(`I am ${npc.name}.`);
  // a word that's for someone else (one NPC sends you on to the next with it): say who to ask
  const other = otherToAsk(text, npc.npcId);
  if (other) return reply(`That's for ${other.name} to hear, $name, not me.${other.where ? ` ${other.where}` : ''} The Quests tab says where to go.`);
  reply("I'm not sure what you mean. Try one of the highlighted words.");
}

function ask(text, yes, no) {
  player.conversation.pending = { yes, no };
  return text;
}

// The services from npcs.js. Returns what the NPC says.
function service(s, npc, text) {
  if (s.quest) return questTalk(s.quest, npc, s.otherwise);
  if (s.heal) {
    if (player.hp >= player.maxHp && !Object.keys(player.conditions).some(k => CONDITIONS[k].interval)) return 'You are not hurt.';
    player.hp = player.maxHp;
    player.conditions = {};
    addSparkle(player, '#8fe0ff');
    return 'You are healed!';
  }
  if (s.destiny) return destinyTalk();
  if (s.vocation) return vocationTalk(s.vocation);
  if (s.bank) return bankTalk(text);
  if (s.travel) return travelTalk(s.travel);
  if (s.promote) return promoteTalk(s.promote);
  if (s.bless) return blessTalk(s.bless);
  if (s.houses) return houseTalk(text);
  if (s.cart) return cartTalk(s.cart);
  if (s.citizen) return citizenTalk(npc);
  if (s.forge) {
    playerEvent('forge', { npc: npc.id });
    return `Four ore in the fire, a little gold, and some luck: the better the ore, the better your chances. Ore one grade below what you're after barely helps; better ore never fails. Four ore of a kind I can also {fuse} into one better.`;
  }
  return '...';
}

// Becoming a citizen of a town, as in Tibia: you wake up in its temple when you die.
function citizenTalk(npc) {
  const t = map.temples.find(tp => tp.npc === npc.npcId);
  if (!t) return 'This temple keeps no register of citizens.';
  if (player.home === 'start') return 'First find your way to the mainland, young one. Then come back.';
  if (player.home === t.home) return `You are a citizen of ${t.town} already. When you fall, you wake up here.`;
  return ask(`Do you want to become a citizen of ${t.town}? When you die, you will wake up in this temple. ({yes}/{no})`, () => {
    player.home = t.home;
    uiDirty();
    return `Welcome, citizen of ${t.town}! From now on, when you fall, you wake up here.`;
  });
}

// Offers the first unfinished quest of a chain, tracks its steps and hands out rewards.
// otherwise: what the NPC says instead when the chain has nothing (more) for you here.
function questTalk(ids, npc, otherwise) {
  for (const id of ids) {
    const q = QUESTS[id];
    if (!q) continue;
    const t = q.text || {}, state = questState(id);
    if (state === 'done') continue;
    if (state === 'none') {
      const own = q.giver === npc.npcId ? t : q.offers && q.offers[npc.npcId]; // the giver, or someone who may offer it too
      if (!own) return otherwise || t.elsewhere || 'I know nothing about that. Maybe someone else does.';
      if (questWaits(q)) return otherwise || t.notYet || 'Not yet. Come back to me later.';
      if (q.level && player.level < q.level) return t.tooWeak;
      return ask(own.offer, () => {
        startQuest(id);
        return own.accept;
      }, () => 'Maybe another time then.');
    }
    const s = questStep(id), single = !q.steps;
    if ((s.npc || q.giver) !== npc.npcId) {
      const who = s.npc || q.giver, word = questWord(who, id);
      return `${otherwise ? `${otherwise} ` : ''}${NPCS[who].name} is waiting for you${word ? `: ask about the ${word}` : ''}. (${s.summary || q.summary})`;
    }
    if (!stepReady(id)) return (single ? t.progress : s.progress).replace('$progress', questProgress(id));
    const said = single ? t.reward : s.done;
    advanceQuest(id);
    return said;
  }
  const last = QUESTS[ids[ids.length - 1]];
  return otherwise || (last && last.text && last.text.done) || 'Thank you again for your help.';
}

function destinyTalk() {
  if (player.vocation !== 'none') return `You already walk the path of the ${player.vocation}.`;
  if (player.level < vocationLevel()) return `You are not ready yet. Come back when you are level ${vocationLevel()} (you are level ${player.level}).`;
  return 'Your path lies before you. Will you be a {knight}, a {paladin}, a {sorcerer} or a {druid}? Ask about each before you decide.';
}

function vocationTalk(v) {
  if (player.vocation !== 'none') return `You already walk the path of the ${player.vocation}.`;
  return ask(`${VOCATIONS[v].desc} Do you want to become a ${v}? This cannot be undone, and you will leave the starter island for good. ({yes}/{no})`, () => {
    if (player.level < vocationLevel()) return `You are not ready yet. Come back when you are level ${vocationLevel()}.`;
    chooseVocation(v);
    return `So be it, ${v}! I will now send you across the sea to the mainland. Farewell, $name - and if you have not heard my {dream} yet, Grandmaster Orin in Valoria will tell it to you.`;
  }, () => 'Take your time.');
}

function bankTalk(text) {
  const amount = /\ball\b/.test(text) ? null : +(text.match(/\d+/) || [0])[0];
  if (/\bdeposit\b/.test(text)) {
    const n = amount === null ? player.gold : Math.min(amount, player.gold);
    if (!n) return player.gold ? 'How much? Say "deposit 100" or "deposit all".' : 'You have no gold with you.';
    player.gold -= n;
    player.bank += n;
    addSound('coin', player.x, player.y, player.z);
    uiDirty();
    return `You deposited ${n} gold. Your balance is ${player.bank} gold.`;
  }
  if (/\bwithdraw\b/.test(text)) {
    const n = amount === null ? player.bank : Math.min(amount, player.bank);
    if (!n) return player.bank ? 'How much? Say "withdraw 100".' : 'Your account is empty.';
    player.bank -= n;
    player.gold += n;
    addSound('coin', player.x, player.y, player.z);
    uiDirty();
    return `Here you are, ${n} gold. Your balance is ${player.bank} gold.`;
  }
  return `Your balance is ${player.bank} gold. You can {deposit} or {withdraw} gold, for example "deposit all" or "withdraw 100".`;
}

function travelTalk(trip) {
  if (player.vocation === 'none') return 'I only take adventurers with a vocation.';
  return ask(`Do you want to sail to ${trip.name} for ${trip.cost} gold? ({yes}/{no})`, () => {
    if (player.gold < trip.cost) return 'You do not have enough gold.';
    if (player.target || Object.keys(player.conditions).some(k => CONDITIONS[k].interval)) return 'Not while you are fighting or hurt!';
    player.gold -= trip.cost;
    endConversation(true);
    teleport(trip.to);
    addSparkle(player, '#9cc0ee');
    log(`You sailed to ${trip.name}.`);
    uiDirty();
    return null;
  });
}

// A ride in a mine cart along a track (see TRACKS), there or back.
function cartTalk(cart) {
  if (player.ride) return null;
  if (!startCart(cart.track, cart.back)) return 'The cart is not here right now.';
  endConversation(true);
  return null;
}

function promoteTalk({ level, cost }) {
  if (player.vocation === 'none') return 'Choose a vocation first.';
  if (player.promoted) return `You are already a ${title(player)}.`;
  if (player.level < level) return `Come back at level ${level}.`;
  return ask(`I can promote you to ${VOCATIONS[player.vocation].promoted} for ${cost} gold. You will regenerate faster and learn mighty new spells. ({yes}/{no})`, () => {
    if (player.gold < cost) return 'You do not have enough gold.';
    player.gold -= cost;
    player.promoted = true;
    addSparkle(player, '#ffe080');
    addSound('level', player.x, player.y, player.z);
    uiDirty();
    return `Congratulations, ${VOCATIONS[player.vocation].promoted} $name!`;
  });
}

function blessTalk({ cost, perLevel }) {
  if (player.blessed) return 'You are already blessed.';
  const price = cost + perLevel * Math.max(0, player.level - 10);
  return ask(`A blessing keeps your things safe the next time you die, and halves the experience you lose. It costs ${price} gold. ({yes}/{no})`, () => {
    if (player.gold < price) return 'You do not have enough gold.';
    player.gold -= price;
    player.blessed = true;
    addSparkle(player, '#fff1a0');
    uiDirty();
    return 'You are blessed. Go in peace.';
  });
}

function houseTalk(text) {
  if (/\bleave\b/.test(text)) {
    if (!player.house) return 'You do not rent a house.';
    return ask('Do you really want to move out? Your furniture and things will go to your depot. ({yes}/{no})', () => {
      leaveHouse();
      return 'Done. Come back if you need a new home.';
    });
  }
  const house = map.houses.find(h => text.includes(h.name.toLowerCase()));
  if (house) {
    if (house.owner) return house.owner === player.name ? 'That is your house!' : 'Someone already rents that one.';
    if (player.house) return 'You already rent a house. Say {leave} to move out first.';
    return ask(`${house.name} costs ${house.rent} gold. Do you want to rent it? ({yes}/{no})`, () => {
      if (house.owner) return 'Oh dear, someone was quicker: it is taken.'; // asked by two at once
      if (player.house) return 'You already rent a house.';
      if (player.gold + player.bank < house.rent) return 'You do not have enough gold, not even in the bank.';
      const fromGold = Math.min(player.gold, house.rent);
      player.gold -= fromGold;
      player.bank -= house.rent - fromGold;
      rentHouse(house);
      return `Here is your key. ${house.name} is yours. Use furniture kits inside to make it a home.`;
    });
  }
  const free = map.houses.filter(h => !h.owner);
  if (!free.length) return 'Sorry, all my houses are taken.';
  return `These houses are free: ${free.map(h => `{${h.name}} (${h.rent} gold)`).join(', ')}. Say {leave} to give back your house.`;
}

// Walking away ends the conversation.
function updateConversation() {
  const c = player.conversation;
  if (c && (c.npc.z !== player.z || dist(c.npc, player) > TALK_RANGE + 1)) endConversation();
}

// ---- trade -------------------------------------------------------------------------------
function openShop(npc) {
  player.shopNpc = npc;
  uiDirty();
}

function closeShop() {
  player.shopNpc = null;
  uiDirty();
}

// Items in your bag this trader buys, as [itemId, price, count].
function sellableItems(npc) {
  const buys = npc.def.trade.buys.map(k => BUYS[k]).filter(Boolean);
  const counts = new Map();
  for (const it of bagItems()) {
    const d = ITEMS[it.id];
    if (d.value && !d.quest && !it.contents && !it.q && buys.some(test => test(d))) counts.set(it.id, (counts.get(it.id) || 0) + it.count); // forged gear isn't for sale
  }
  return [...counts].map(([id, count]) => [id, ITEMS[id].value, count]);
}

function buy(id, amount) {
  const npc = player.shopNpc, offer = npc && npc.def.trade.sells.find(s => s[0] === id);
  if (!offer || dist(npc, player) > TALK_RANGE + 1) return;
  const price = offer[1];
  amount = Math.max(1, Math.min(100, amount | 0));
  if (player.gold < price * amount) return log(`You need ${price * amount} gold, but you only have ${player.gold}.`);
  const bought = amount - addItem(id, amount);
  if (!bought) return log(freeCapacity() < (ITEMS[id].weight || 0) ? 'You cannot carry that much.' : 'Your bag is full.');
  player.gold -= price * bought;
  log(`You bought ${itemName(id, bought)} for ${price * bought} gold.`);
  addSound('coin', player.x, player.y, player.z);
  uiDirty();
}

function sell(id, amount) {
  const npc = player.shopNpc;
  if (!npc || dist(npc, player) > TALK_RANGE + 1) return;
  const offer = sellableItems(npc).find(s => s[0] === id);
  if (!offer) return;
  amount = Math.max(1, Math.min(amount | 0, offer[2]));
  if (!removeItem(id, amount)) return;
  player.gold += offer[1] * amount;
  log(`You sold ${itemName(id, amount)} for ${offer[1] * amount} gold.`);
  addSound('coin', player.x, player.y, player.z);
  uiDirty();
}
