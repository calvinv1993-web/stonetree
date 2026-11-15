// A regression run of the phone's interface in the real page, on an iPhone 15 (the owner's list for the new mobile
// interface): walking and paths, floors, talking, protection zones, loot, spells and cooldowns, potions, equipment and
// dragging through the inventory drawer, the map, the chat, the windows' order and turning the phone. The rules
// themselves are in unit.test.js; this checks the page drives them. Needs Playwright (see AGENTS.md).
// Run: node tests/mobile-regression.test.js
const { serve } = require('./serve');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright');
(async () => {
  const b = await chromium.launch(); let fail = 0, pass = 0, r7 = '';
  const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${n}${ok ? '' : '  ' + info}`); };
  const p = await b.newPage({ viewport: { width: 393, height: 793 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, bottom: 34, left: 0, right: 0 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(`${await serve()}/index.html`);
  await p.fill('#createName', 'Tester'); await p.click('#createStart'); await p.click('#outfitDone', { timeout: 3000 }).catch(() => {});
  await p.waitForFunction(() => Preload.ready, null, { timeout: 60000 });
  await p.evaluate(() => { $('guide').hidden = true; });
  const E = (f, a) => p.evaluate(f, a);
  // 1, 2: tap-to-move with pathfinding, around what blocks
  const goal = await E(() => { for (let r = 3; r < 8; r++) for (let dx = -r; dx <= r; dx++) { const x = player.x + dx, y = player.y + r; if (isFree(x, y, player.z) && findPath(playerPassable(x, y), player.x, player.y, x, y, {})) return { x, y }; } return null; });
  await E(g => Actions.walkTo(g.x, g.y), goal); await p.waitForTimeout(4000);
  check('1-2 a walk to a tile finds its way round what blocks, and gets there', await E(g => player.x === g.x && player.y === g.y, goal), JSON.stringify(goal));
  check('2  no walking through a wall', await E(() => { for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) { const t = map.get(player.x + dx, player.y + dy, player.z); if (t && t.items.some(id => THINGS[id].block && THINGS[id].wall)) return !isFree(player.x + dx, player.y + dy, player.z); } return true; }));
  // 3: floors: walk onto the nearest stair or ladder down from the start, and land one floor lower
  const stair = await E(() => { const s = map.start; for (let r = 1; r < 30; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = s.x + dx, y = s.y + dy; if (map.floorChange(x, y, s.z) < 0) return { x, y, z: s.z }; } return null; });
  await E(() => teleport(map.start));
  await E(s => Actions.walkTo(s.x, s.y), stair); await p.waitForTimeout(6000);
  check('3  walking onto a way down takes you one floor down', await E(s => player.z === s.z - 1, stair), JSON.stringify(stair) + ' ' + await E(() => `${player.x},${player.y},${player.z}`));
  // 6: talk to an NPC through the smart button
  await E(() => teleport(map.start)); await p.waitForTimeout(300);
  await E(() => SmartButton.press()); await p.waitForTimeout(1500);
  check('6  the smart button talks to Sister Ama: her card shows with its words', await E(() => !$('talk').hidden && $('talkWords').children.length > 1));
  await E(() => { Actions.say('bye'); hideTalk(); });
  // 4, 5: protection zone: no attack offered in the temple
  check('4-5 in the temple (a protection zone) the smart button offers no attack', await E(() => inPZ() && SmartButton.context().kind !== 'attack'));
  // 7: loot a corpse: a pile next to the player, the smart button opens it
  await E(() => { teleport({ x: map.start.x, y: map.start.y + 6, z: map.start.z }); piles.push({ id: 7777, x: player.x + 1, y: player.y, z: player.z, items: [{ id: 'gold', count: 5 }, { id: 'apple', count: 2 }], corpse: 'rat', until: now + 60000, name: 'a dead rat' }); monsters = []; });
  const gold0 = await E(() => player.gold), apples0 = await E(() => countItem('apple'));
  await E(() => SmartButton.press()); await p.waitForTimeout(1200);
  check('7  the smart button opens a corpse beside you, its window shows', await E(() => player.openPile && player.openPile.id === 7777 && !$('lootBox').hidden));
  r7 = await E(() => JSON.stringify((piles.find(q => q.id === 7777) || {}).items));
  await p.locator('#loot .slot').first().click(); await p.waitForTimeout(300);
  check('7  its gold comes to you at once; a tap on what is left takes it, the corpse empties', await E(([g, a]) => player.gold === g + 5 && countItem('apple') === a + 2 && !piles.find(q => q.id === 7777 && q.items.length), [gold0, apples0]), r7);
  await E(() => { player.openPile = null; uiDirty(); });
  // 8: a spell and its cooldown
  await E(() => { player.level = 5; player.mana = player.maxMana; player.hp = 10; player.spellReady = 0; });
  await E(() => Actions.castSpell('light_heal'));
  check('8  a spell heals, spends its mana and starts the cooldown', await E(() => player.hp > 10 && player.mana === player.maxMana - SPELLS.light_heal.mana && player.spellReady > now));
  // (no mana spent: the spell wasn't cast; health may tick up by itself meanwhile, so that isn't what's checked)
  const mana1 = await E(() => player.mana); await E(() => Actions.castSpell('light_heal'));
  check('8  cast again at once: "exhausted", nothing happens', await E(m => player.mana === m, mana1));
  // 9: a potion and its count
  await p.waitForTimeout(1100);
  const n0 = await E(() => countItem('health_potion')); await E(() => { player.hp = 10; Actions.hotkey('h'); });
  check('9  a health potion heals and its count goes down, on its button too', await E(n => countItem('health_potion') === n - 1 && player.hp > 10, n0));
  // 10: equipment and drag-and-drop through the drawer
  await E(() => InventoryDrawer.open(1)); await p.waitForTimeout(400);
  const from = await p.locator('#inventoryDrawer .equipment .slot').nth(3).boundingBox(), to = await p.locator('#inventoryDrawer #containers .slot').last().boundingBox();
  await p.mouse.move(from.x + 20, from.y + 20); await p.mouse.down(); for (let i = 1; i <= 8; i++) await p.mouse.move(from.x + 20 + (to.x - from.x) * i / 8, from.y + 20 + (to.y - from.y) * i / 8); await p.mouse.up(); await p.waitForTimeout(400);
  check('10 drag the weapon from the equipment into the backpack', await E(() => !player.equipment.weapon && bag().contents.some(i => i.id === 'wooden_club')));
  const club = await p.locator('#inventoryDrawer #containers .slot img[src]').last().boundingBox();
  await E(() => {}); const slot = await p.locator('#inventoryDrawer .equipment .slot').nth(3).boundingBox();
  await p.mouse.move(club.x + 16, club.y + 16); await p.mouse.down(); for (let i = 1; i <= 8; i++) await p.mouse.move(club.x + 16 + (slot.x - club.x) * i / 8, club.y + 16 + (slot.y - club.y) * i / 8); await p.mouse.up(); await p.waitForTimeout(400);
  check('10 and back onto the weapon slot: worn again', await E(() => player.equipment.weapon && player.equipment.weapon.id === 'wooden_club'));
  // 13: the drawer opens and closes
  await E(() => InventoryDrawer.close()); await p.waitForTimeout(300);
  check('13 the drawer closes, its things go home (the Character sheet has them)', await E(() => InventoryDrawer.stage() === 0 && !!$('panel').querySelector('#equipment')));
  // 11: minimap
  await p.tap('#hudMap'); await p.waitForTimeout(500);
  check('11 the map button shows the minimap, the drawer half way open', await E(() => $('inventoryDrawer').contains($('minimap')) && InventoryDrawer.stage() === 1 && $('minimap').width > 300 && !minimap.whole));
  await p.tap('#mmWorld'); await p.waitForTimeout(500);
  check('11 Full map: the drawer all the way open on the whole world, no window', await E(() => minimap.whole && InventoryDrawer.stage() === 2 && $('worldmap').hidden && $('minimap').height > 300));
  await p.tap('#mmWorld'); await p.waitForTimeout(500);
  check('11 and again: half way, round you', await E(() => !minimap.whole && InventoryDrawer.stage() === 1));
  const mm = await p.locator('#minimap').boundingBox();
  await p.tap('#minimap', { position: { x: mm.width / 2, y: mm.height / 2 + 12 } }); await p.waitForTimeout(400);
  check('11 a tap on the half-open map walks there, the drawer stays', await E(() => InventoryDrawer.stage() === 1));
  await p.tap('#mmWorld'); await p.waitForTimeout(500);
  const whole = await p.locator('#minimap').boundingBox();
  await p.tap('#minimap', { position: { x: whole.width / 2, y: whole.height / 2 } }); await p.waitForTimeout(400);
  check('11 a tap on the full map walks there and folds the drawer away', await E(() => InventoryDrawer.stage() === 0));
  check('11 closed, the minimap goes home at its own size', await E(() => !!$('panel').querySelector('#minimap') && $('minimap').width === 236));
  // 12: chat
  await p.tap('#chatLine'); await p.waitForTimeout(300);
  check('12 the chat opens from its line, at the newest message', await E(() => document.body.classList.contains('chat-open') && Math.abs($('log').scrollTop + $('log').clientHeight - $('log').scrollHeight) < 4));
  await E(() => { $('chat').value = 'hello'; }); await p.press('#chat', 'Enter'); await p.waitForTimeout(300);
  check('12 what you type is said (the log has it)', await E(() => /hello/.test($('log').textContent)));
  await E(() => setChat(false));
  // windows above each other: the picker over the bar, the world map over all, the drawer under the bar
  const z = await E(() => { const zi = el => +getComputedStyle(el).zIndex || 0; openFavPicker(0); const r = { picker: zi($('favPicker')), dock: zi($('actionDock')), drawer: zi($('inventoryDrawer')) }; $('favPicker').hidden = true; toggleWorldMap(); r.map = zi($('worldmap')); toggleWorldMap(); return r; });
  check('windows lie in order: drawer under the bar, the chooser and the world map over it', z.drawer < z.dock && z.picker > z.dock && z.map > z.dock, JSON.stringify(z));
  // 15: turned on its side and back: nothing breaks
  await p.setViewportSize({ width: 793, height: 393 }); await p.waitForTimeout(500);
  const side = await E(() => ({ canvas: $('view').getBoundingClientRect().width > 300, dock: !!$('actionDock') }));
  await p.setViewportSize({ width: 393, height: 793 }); await p.waitForTimeout(500);
  check('15 turned on its side and back: the map and bar fit again', side.canvas && await E(() => $('actionDock').getBoundingClientRect().bottom === innerHeight));
  check('no errors on the page', !errors.length, errors.join(' | '));
  console.log(fail ? `${fail} failed, ${pass} passed` : `all ${pass} passed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
