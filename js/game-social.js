'use strict';
// Parties and guilds, as in Tibia.
//
// A party: the leader invites players (right-click them), and they join from their side.
// The leader can share the experience: then what the members earn from monsters goes
// into one pot, with a bonus for the different vocations in the party, and is split
// evenly - as long as it's fair: the lowest level at least two thirds of the highest,
// everyone within 30 tiles of the leader (a floor up or down at most), and everyone has
// fought in the last two minutes. Party members can't hurt each other.
//
// A guild: anyone with a vocation can found one. The leader and vice-leaders invite
// players, who join from their guild window. Ranks: leader, vice-leader and member (the
// leader can rename them), a nick for each member, a message of the day, and a chat
// channel of its own. The server keeps the guilds; parties end when you log out.

const PARTY_RANGE = 30;
const PARTY_ACTIVE = 2 * 60000;
const PARTY_BONUS = [0.2, 0.2, 0.3, 0.6, 1]; // shared experience bonus, by the number of different vocations
const GUILD_RANKS = ['Leader', 'Vice-Leader', 'Member'];
const PARTY_XP_COLOR = '#7fd8ff'; // shared experience floats up in this colour over every member
let parties = []; // { id, leader, members: [ids], invited: [ids], shared }
let guilds = {};  // key (lower-case name) -> { name, motd, ranks, members: { key: { name, rank, nick, level, vocation } }, invited: [keys] }

const playerById = id => players.find(p => p.id === id) || null;
const playerNamed = name => players.find(p => p.name.toLowerCase() === String(name || '').trim().toLowerCase()) || null;
const partyOf = p => (p && p.party && parties.find(pt => pt.id === p.party)) || null;
const sameParty = (a, b) => !!a && !!b && a !== b && !!a.party && a.party === b.party;

// Tell everyone in the party (or one of them) something.
function partyTell(party, text, except) {
  for (const id of party.members) {
    const p = playerById(id);
    if (p && p !== except) asPlayer(p, () => { log(text, 'party'); uiDirty(); });
  }
}
function tell(p, text, kind) {
  if (p) asPlayer(p, () => { log(text, kind); uiDirty(); });
}

function disbandParty(party) {
  partyTell(party, 'Your party has been disbanded.');
  for (const id of party.members) { const p = playerById(id); if (p) p.party = null; }
  parties = parties.filter(pt => pt !== party);
}

// A party of one with nobody invited is no party.
function partyCheck(party) {
  if (!party.members.length || (party.members.length === 1 && !party.invited.length)) disbandParty(party);
}

function partyInvite(id) {
  const p = playerById(id);
  if (!p || p === player) return;
  let party = partyOf(player);
  if (party && party.leader !== player.id) return log('Only the leader of your party can invite players.');
  if (p.party) return log(`${p.name} is already in a party.`);
  if (party && party.invited.includes(p.id)) return log(`${p.name} has already been invited.`);
  if (!party) {
    party = { id: newId(), leader: player.id, members: [player.id], invited: [], shared: false };
    parties.push(party);
    player.party = party.id;
  }
  party.invited.push(p.id);
  log(`${p.name} has been invited. Talk to your companions in the Party tab of the chat.`, 'party');
  tell(p, `${player.name} has invited you to their party. Right-click (or hold) them to join.`, 'party');
  uiDirty();
}

function partyRevoke(id) {
  const party = partyOf(player), p = playerById(id);
  if (!party || party.leader !== player.id || !party.invited.includes(id)) return;
  party.invited = party.invited.filter(i => i !== id);
  log(`Your invitation for ${p ? p.name : 'them'} has been revoked.`, 'party');
  tell(p, `${player.name} has revoked their invitation.`, 'party');
  partyCheck(party);
  uiDirty();
}

function partyJoin(leaderId) {
  const leader = playerById(leaderId), party = partyOf(leader);
  if (!party || party.leader !== leaderId || !party.invited.includes(player.id)) return log('That invitation is no longer valid.');
  if (player.party) return log('You are already in a party. Leave it first.');
  party.invited = party.invited.filter(i => i !== player.id);
  partyTell(party, `${player.name} has joined the party.`);
  party.members.push(player.id);
  player.party = party.id;
  log(`You have joined ${leader.name}'s party. Talk to your companions in the Party tab of the chat.`, 'party');
  uiDirty();
}

function partyLeave() {
  const party = partyOf(player);
  if (!party) return;
  party.members = party.members.filter(i => i !== player.id);
  player.party = null;
  log('You have left the party.', 'party');
  if (party.leader === player.id && party.members.length) {
    party.leader = party.members[0];
    partyTell(party, `${player.name} has left the party. ${playerById(party.leader).name} leads it now.`);
  } else partyTell(party, `${player.name} has left the party.`);
  partyCheck(party);
  uiDirty();
}

function partyPassLeader(id) {
  const party = partyOf(player), p = playerById(id);
  if (!party || party.leader !== player.id || !p || !party.members.includes(id)) return;
  party.leader = id;
  partyTell(party, `${p.name} is the leader of the party now.`);
}

function partyShareXp(on) {
  const party = partyOf(player);
  if (!party || party.leader !== player.id) return log('Only the leader can share the experience.');
  party.shared = !!on;
  partyTell(party, on ? 'Shared experience has been activated.' : 'Shared experience has been deactivated.');
}

// Whether the party shares its experience right now, and if not, why not.
function partyShare(party) {
  const members = party.members.map(playerById).filter(Boolean);
  const vocations = new Set(members.map(p => p.vocation).filter(v => v !== 'none')).size;
  const bonus = PARTY_BONUS[Math.min(4, vocations)];
  const off = reason => ({ active: false, bonus, reason });
  if (!party.shared) return off('Shared experience is off.');
  if (members.length < 2) return off('Shared experience needs a second member.');
  const leader = playerById(party.leader), top = Math.max(...members.map(p => p.level));
  const low = members.find(p => p.level * 3 < top * 2);
  if (low) return off(`${low.name} is too low a level: everyone needs level ${Math.ceil((top * 2) / 3)} or more.`);
  const far = members.find(p => p !== leader && (Math.abs(p.z - leader.z) > 1 || dist(p, leader) > PARTY_RANGE));
  if (far) return off(`${far.name} is too far from the leader.`);
  const idle = members.find(p => !(now - (p.foughtAt || -Infinity) <= PARTY_ACTIVE));
  if (idle) return off(`${idle.name} has not fought in the last two minutes.`);
  return { active: true, bonus, reason: `Shared experience is active: +${Math.round(bonus * 100)}%.` };
}

// Tell the party when sharing starts to work, or stops (and why), so nobody wonders.
function updateParties() {
  for (const party of parties) {
    const share = partyShare(party), state = !party.shared ? 'off' : share.active ? 'on' : share.reason;
    if (party.shared && party.lastShare !== undefined && state !== party.lastShare) {
      partyTell(party, share.active ? `Shared experience is working: everyone gets an even share, +${Math.round(share.bonus * 100)}%.`
        : `Shared experience is not working: ${share.reason}`);
    }
    party.lastShare = state;
  }
}

// Logging out ends your part in parties: yours, and the invitations you had.
function partyGone(p) {
  asPlayer(p, partyLeave);
  for (const party of [...parties]) {
    if (!party.invited.includes(p.id)) continue;
    party.invited = party.invited.filter(i => i !== p.id);
    partyCheck(party);
  }
}

function partySay(text) {
  text = String(text || '').trim().slice(0, 200);
  const party = partyOf(player);
  if (!text) return;
  if (!party) return log('You are not in a party.');
  const from = player.name;
  for (const id of party.members) tell(playerById(id), `${from}: ${text}`, 'party');
}

// How someone looks to `viewer`: 'leader' or 'member' of the viewer's party, 'invited'
// (by the viewer), 'inviter' (they invited the viewer), 'other' (in another party) or null.
// Party members also show whether shared experience is on (':on') or failing (':idle').
function partyMark(c, viewer) {
  if (!c || c.type !== 'player' || !viewer) return null;
  const mine = partyOf(viewer), theirs = partyOf(c);
  if (mine && mine === theirs) {
    const share = mine.shared ? (partyShare(mine).active ? ':on' : ':idle') : '';
    return (mine.leader === c.id ? 'leader' : 'member') + share;
  }
  if (mine && mine.leader === viewer.id && mine.invited.includes(c.id)) return 'invited';
  if (theirs && theirs.leader === c.id && theirs.invited.includes(viewer.id)) return 'inviter';
  return theirs ? 'other' : null;
}

// What the party window shows.
function partyView(p) {
  const party = partyOf(p);
  const invites = parties.filter(pt => pt.invited.includes(p.id)).map(pt => ({ id: pt.leader, name: (playerById(pt.leader) || {}).name }));
  if (!party) return invites.length ? { invites } : null;
  const share = partyShare(party);
  return {
    leader: party.leader, shared: party.shared, active: share.active, bonus: share.bonus, status: share.reason, invites,
    members: party.members.map(playerById).filter(Boolean).map(m => ({
      id: m.id, name: m.name, level: m.level, vocation: m.vocation, hp: m.hp, maxHp: m.maxHp, mana: m.mana, maxMana: m.maxMana, dead: m.dead,
    })),
    invited: party.invited.map(playerById).filter(Boolean).map(i => ({ id: i.id, name: i.name })),
  };
}

// ---- guilds -------------------------------------------------------------------------------
const nameKey = name => String(name || '').trim().toLowerCase();
const guildOf = p => (p && Object.values(guilds).find(g => g.members[nameKey(p.name)])) || null;
const myRank = g => (g ? g.members[nameKey(player.name)].rank : 3);

function guildTell(g, text, kind = 'guild') {
  for (const key in g.members) tell(playerNamed(key), text, kind);
}

// "Vice-Leader of the Dawnguard (Bob)", for looking at someone.
function guildInfo(p) {
  const g = guildOf(p);
  if (!g) return null;
  const m = g.members[nameKey(p.name)];
  return { name: g.name, rank: g.ranks[m.rank], nick: m.nick || '' };
}

function guildCreate(name) {
  name = String(name || '').trim().replace(/\s+/g, ' ');
  if (!/^[A-Za-z][A-Za-z' -]{2,28}$/.test(name)) return log('A guild name has 3 to 29 letters (spaces, - and \' are fine too).');
  if (player.vocation === 'none') return log('Only adventurers with a vocation can found a guild.');
  if (guildOf(player)) return log('You are already in a guild.');
  if (guilds[nameKey(name)]) return log('There is already a guild with that name.');
  guilds[nameKey(name)] = {
    name, motd: '', ranks: [...GUILD_RANKS], invited: [],
    members: { [nameKey(player.name)]: { name: player.name, rank: 0, nick: '', level: player.level, vocation: player.vocation } },
  };
  log(`You founded the guild ${name}! Invite players from your guild window, or right-click them.`, 'guild');
  uiDirty();
}

function guildInvite(name) {
  const g = guildOf(player), p = playerNamed(name);
  if (!g || myRank(g) > 1) return log('Only the leader and vice-leaders can invite players.');
  if (!p) return log('There is nobody of that name online.');
  if (guildOf(p)) return log(`${p.name} is already in a guild.`);
  if (g.invited.includes(nameKey(p.name))) return log(`${p.name} has already been invited.`);
  g.invited.push(nameKey(p.name));
  log(`You invited ${p.name} to join ${g.name}.`, 'guild');
  tell(p, `${player.name} has invited you to join the guild ${g.name}. Open your guild window to join.`, 'guild');
  uiDirty();
}

function guildRevoke(name) {
  const g = guildOf(player);
  if (!g || myRank(g) > 1) return;
  g.invited = g.invited.filter(k => k !== nameKey(name));
  uiDirty();
}

function guildJoin(guildName) {
  const g = guilds[nameKey(guildName)], key = nameKey(player.name);
  if (!g || !g.invited.includes(key)) return log('That invitation is no longer valid.');
  if (guildOf(player)) return log('You are already in a guild. Leave it first.');
  g.invited = g.invited.filter(k => k !== key);
  g.members[key] = { name: player.name, rank: 2, nick: '', level: player.level, vocation: player.vocation };
  guildTell(g, `${player.name} has joined the guild.`);
  if (g.motd) log(`Message of the day: ${g.motd}`, 'guild');
}

function guildDecline(guildName) {
  const g = guilds[nameKey(guildName)];
  if (g) g.invited = g.invited.filter(k => k !== nameKey(player.name));
  uiDirty();
}

function guildLeave() {
  const g = guildOf(player);
  if (!g) return;
  if (myRank(g) === 0) return log('The leader can\'t leave: pass the leadership to someone first, or disband the guild.');
  guildTell(g, `${player.name} has left the guild.`);
  delete g.members[nameKey(player.name)];
}

function guildKick(name) {
  const g = guildOf(player), m = g && g.members[nameKey(name)];
  if (!m || m.rank <= myRank(g) || myRank(g) > 1) return log('You can only remove members of a lower rank.');
  guildTell(g, `${m.name} has been removed from the guild by ${player.name}.`);
  delete g.members[nameKey(name)];
}

// The leader makes members vice-leaders (rank 1) or plain members again (rank 2).
function guildSetRank(name, rank) {
  const g = guildOf(player), m = g && g.members[nameKey(name)];
  if (!m || myRank(g) !== 0 || m.rank === 0 || ![1, 2].includes(rank)) return;
  m.rank = rank;
  guildTell(g, `${m.name} is ${withArticle(g.ranks[rank])} of the guild now.`);
}

function guildPassLeader(name) {
  const g = guildOf(player), m = g && g.members[nameKey(name)];
  if (!m || myRank(g) !== 0 || m === g.members[nameKey(player.name)]) return;
  m.rank = 0;
  g.members[nameKey(player.name)].rank = 1;
  guildTell(g, `${m.name} leads the guild now.`);
}

// Leaders and vice-leaders give nicks; anyone may change their own.
function guildNick(name, nick) {
  const g = guildOf(player), m = g && g.members[nameKey(name)];
  if (!m || (myRank(g) > 1 && m.name !== player.name)) return;
  m.nick = String(nick || '').replace(/[^\w '-]/g, '').trim().slice(0, 20);
  uiDirty();
}

function guildRankTitles(titles) {
  const g = guildOf(player);
  if (!g || myRank(g) !== 0 || !Array.isArray(titles)) return;
  g.ranks = g.ranks.map((old, i) => String(titles[i] || '').replace(/[^\w '-]/g, '').trim().slice(0, 20) || old);
  guildTell(g, `The ranks are called ${g.ranks.join(', ')} now.`);
}

function guildMotd(text) {
  const g = guildOf(player);
  if (!g || myRank(g) > 1) return;
  g.motd = String(text || '').trim().slice(0, 200);
  if (g.motd) guildTell(g, `Message of the day: ${g.motd}`);
  else uiDirty();
}

function guildDisband() {
  const g = guildOf(player);
  if (!g || myRank(g) !== 0) return;
  guildTell(g, `${g.name} has been disbanded.`);
  delete guilds[nameKey(g.name)];
}

function guildSay(text) {
  text = String(text || '').trim().slice(0, 200);
  const g = guildOf(player);
  if (!text) return;
  if (!g) return log('You are not in a guild.');
  guildTell(g, `${player.name}: ${text}`);
}

// What the guild window shows: your guild, or the invitations you have.
function guildView(p) {
  const g = guildOf(p), key = nameKey(p.name);
  const invites = Object.values(guilds).filter(o => o.invited.includes(key)).map(o => o.name);
  if (!g) return { invites };
  const members = Object.entries(g.members).map(([k, m]) => {
    const online = playerNamed(k);
    if (online) Object.assign(m, { level: online.level, vocation: online.vocation });
    return { name: m.name, rank: m.rank, nick: m.nick, level: m.level, vocation: m.vocation, online: !!online };
  }).sort((a, b) => a.rank - b.rank || b.online - a.online || a.name.localeCompare(b.name));
  return { invites, name: g.name, motd: g.motd, ranks: g.ranks, myRank: g.members[key].rank, members, invited: g.invited };
}
