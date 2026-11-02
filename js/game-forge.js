'use strict';
// The blacksmith's forge, after the forges of War and Order. Gear comes in five grades
// (common, fine, rare, epic, legendary), and so does ore. Bring a piece of gear and four
// ore to a smith and try for the next grade: each ore adds to the chance by its grade
// against the grade you're after - better ore makes it certain, ore of that very grade
// gives a good chance, ore one grade below only a small one. When it fails, the ore and
// the fee are gone and the gear stays as it was. Four ore of one grade fuse into one of
// the next. Ore drops from monsters (the stronger, the better) and is mined from veins
// in the cave walls (the deeper, the better); monsters also drop gear of a better grade now
// and then.

const FORGE_SLOTS = 4;
const FUSE_COUNT = 4;
const FORGE_FEE = [100, 300, 1000, 3000]; // gold, to reach fine, rare, epic, legendary
// what one ore adds to the chance (in %): better than the grade you're after, that grade, one below
const ORE_CHANCE = { better: 25, same: 20, below: 5 };

function forgeChance(target, ores) {
  const each = g => (g > target ? ORE_CHANCE.better : g === target ? ORE_CHANCE.same : g === target - 1 ? ORE_CHANCE.below : 0);
  return Math.min(100, ores.reduce((sum, g) => sum + each(g), 0));
}

const nearSmith = () => npcs.some(n => n.def && n.def.forge && n.z === player.z && dist(n, player) <= TALK_RANGE + 1);

// Try to bring an item (equipped or in your bags) up a grade with four ore: [grade, ...].
function forgeItem(ref, ores) {
  if (!nearSmith()) return log('You need to stand at a blacksmith\'s forge for that.');
  if (!ref || !['bag', 'equip'].includes(ref.root)) return;
  const found = resolve(ref), item = found && found.item;
  if (!item || !forgeable(item.id)) return log('Only weapons, armor and shields can be forged.');
  const q = item.q || 0, target = q + 1, name = ITEMS[item.id].name;
  if (!QUALITIES[target]) return log(`Your ${name} is legendary already: it can't get any better.`);
  if (!Array.isArray(ores) || ores.length !== FORGE_SLOTS || !ores.every(g => Number.isInteger(g) && ORES[g])) {
    return log(`Put ${FORGE_SLOTS} ore in the forge.`);
  }
  const need = {};
  for (const g of ores) need[g] = (need[g] || 0) + 1;
  for (const g in need) if (countItem(ORES[g]) < need[g]) return log(`You don't have ${need[g]} ${ITEMS[ORES[g]].name}.`);
  const fee = FORGE_FEE[target - 1];
  if (player.gold < fee) return log(`Forging it ${QUALITIES[target].name} costs ${fee} gold, but you only have ${player.gold}.`);
  player.gold -= fee;
  for (const g in need) removeItem(ORES[g], need[g]);
  const chance = forgeChance(target, ores), ok = Math.random() * 100 < chance;
  if (ok) {
    item.q = target;
    log(`The forge glows... success! Your ${name} is ${QUALITIES[target].name} now.`, 'quest');
    addSparkle(player, QUALITIES[target].color);
    addSound('level', player.x, player.y, player.z);
  } else {
    log(`The forge sputters... it failed (${chance}% chance). The ore is spent; your ${name} is as it was.`, 'damage');
    addBurst(player.x, player.y, player.z, '#9cf');
    addSound('anvil', player.x, player.y, player.z);
  }
  playerEvent('forged', { ok, id: item.id, q: item.q || 0, chance });
  uiDirty();
}

// Four ore of one grade become one of the next (as many times as you ask, and have ore for).
function fuseOre(grade, times = 1) {
  if (!nearSmith()) return log('You need to stand at a blacksmith\'s forge for that.');
  if (!ORES[grade] || !ORES[grade + 1]) return;
  const can = Math.floor(countItem(ORES[grade]) / FUSE_COUNT);
  if (!can) return log(`You need ${FUSE_COUNT} ${ITEMS[ORES[grade]].name} to fuse them.`);
  times = Math.max(1, Math.min(can, times | 0));
  removeItem(ORES[grade], FUSE_COUNT * times);
  giveItem(ORES[grade + 1], times);
  addSound('anvil', player.x, player.y, player.z);
  log(`The smith fuses ${FUSE_COUNT * times} ${ITEMS[ORES[grade]].name} into ${times} ${ITEMS[ORES[grade + 1]].name}.`);
  uiDirty();
}

// ---- finding ore and good gear ---------------------------------------------------------
// How strong a monster is, 0-4, which decides the ore and the grade of the gear it drops.
const monsterTier = def => (def.xp >= 2000 ? 4 : def.xp >= 600 ? 3 : def.xp >= 150 ? 2 : def.xp >= 40 ? 1 : 0);

// The grade of a piece of gear a monster of this tier drops: mostly common, now and then better.
function lootQuality(tier) {
  let q = 0;
  for (const chance of [0.2, 0.1, 0.05, 0.02]) {
    if (q > tier || Math.random() >= chance * (1 + 0.3 * (tier - q))) break;
    q++;
  }
  return q;
}

// What a kill adds to the loot: a better grade for the gear in it, and maybe some ore.
function forgeLoot(def, items) {
  const tier = monsterTier(def), boss = !!def.proper;
  for (const it of items) if (forgeable(it.id)) { const q = lootQuality(tier + (boss ? 1 : 0)); if (q) it.q = q; }
  if (boss || Math.random() < 0.1 + 0.04 * tier) {
    let g = tier;
    if (Math.random() < 0.35) g--;
    else if (Math.random() < 0.12) g++;
    g = Math.max(0, Math.min(ORES.length - 1, g));
    items.push(makeItem(ORES[g], boss ? 2 + Math.floor(Math.random() * 2) : 1));
  }
}

// Mining a vein in a cave wall with a pick: its grade (set by the map: the more dangerous
// the cave, the better), sometimes one better or worse.
function mineVein(x, y, z) {
  const meta = map.getMeta(x, y, z) || {}, base = meta.ore !== undefined ? meta.ore : Math.max(0, map.surfaceZ - 1 - z);
  let g = base + (Math.random() < 0.15 ? 1 : 0) - (Math.random() < 0.3 ? 1 : 0);
  g = Math.max(0, Math.min(ORES.length - 1, g));
  const n = Math.random() < 0.25 ? 2 : 1;
  changeTileFor(x, y, z, 'ore_vein', 'wall_cave', 10 * 60000);
  addBurst(x, y, z, '#9a9aa0');
  addSound('anvil', x, y, z);
  giveItem(ORES[g], n);
  log(`You mine ${itemName(ORES[g], n)}. The vein is spent for now.`);
}
