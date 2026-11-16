'use strict';
// Your companion's card (browser only): who Clang is and how he's doing, and what you can do for him.
//   his portrait (his own sprite, enlarged), his name and level; Health and XP ("to level N") as bars; his damage a
//   blow; a line on how he is (hurt, resting, ready to grow...); how he fights (Follow, Assist, Stay close); and
//   Feed (saying what he'd eat), Potion, Call, Rename and Send home.
// On a computer it sits in the side panel under the equipment (#petBox in index.html); on a phone the drawer's Gear page
// borrows it (inventory-drawer.js), and holding him on the map opens it there (game.js). On a phone a small bar at
// the end of your health bar shows his health too.
// It only shows and asks: every change goes through Actions (petFeed, petPotion, petCall, petHome, petMode, petName).
const CompanionCard = (() => {
  const MODES = [['follow', 'Follow'], ['assist', 'Assist'], ['close', 'Stay close']];
  let box = null, pip = null, shown = '', pipShown = '';
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

  // what he is up to, in a line
  function hint(pet, max, body) {
    const kind = PETS[pet.kind];
    if (pet.downUntil) return `Resting at the temple: back in about ${Math.max(1, Math.ceil((pet.downUntil - now) / 60000))} min, or ask Sister Ama.`;
    if (pet.home) return 'Waiting at the temple. Call him back whenever you like.';
    if (pet.hp < max * 0.3) return 'Badly hurt: he keeps behind you. Feed him or give him a potion.';
    if (body && body.fighting) return 'Fighting at your side.';
    if (pet.level >= kind.maxLevel) return 'Fully grown: as strong as a cat can be.';
    if (pet.level >= player.level && pet.xp >= kind.xpFor(pet.level)) return 'Ready to grow, as soon as you do.';
    if (pet.level >= kind.dummyLevel) return 'He grows from the monsters he helps you fight.';
    return `He grows as he fights and trains with you (a dummy teaches him up to level ${kind.dummyLevel}).`;
  }

  // his picture, his own sprite drawn big and sharp
  function portrait(canvas) {
    const g = canvas.getContext('2d'), img = Sprites.creature(Sprites.petKey(PETS[player.pet.kind].look, player.pet.level), 2, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.imageSmoothingEnabled = false;
    // (a cat stands small in the lower middle of its tile: the part round it, filling the frame)
    if (img) g.drawImage(img, img.width * 0.15, img.height * 0.25, img.width * 0.7, img.height * 0.7, 0, 0, canvas.width, canvas.height);
  }

  function bar(cls, frac, text) {
    const b = el('div', `pet-bar ${cls}`), fill = el('i');
    fill.style.width = `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`;
    b.append(fill, el('span', '', text));
    return b;
  }
  function button(label, sub, fn, disabled) {
    const b = el('button', 'pet-btn');
    b.type = 'button'; b.disabled = !!disabled;
    b.append(el('b', '', label));
    if (sub) b.append(el('small', '', sub));
    b.addEventListener('click', fn);
    return b;
  }

  function render() {
    const pet = player && player.pet, kind = pet && PETS[pet.kind];
    if (!box) return;
    if (!kind) { if (!box.hidden) box.hidden = true; shown = ''; return; }
    const max = kind.hp(pet.level), need = kind.xpFor(pet.level), body = player.petBody, away = pet.home || pet.downUntil;
    const food = typeof petFood === 'function' ? petFood() : null, foods = food ? countItem(food) : 0, potions = countItem('health_potion');
    const [lo, hi] = kind.dmg(pet.level), line = hint(pet, max, body), mode = pet.mode || 'assist';
    const key = JSON.stringify([pet.name, pet.level, pet.hp, pet.xp, pet.home, !!pet.downUntil, mode, food, foods, potions, line, player.level]);
    box.hidden = false;
    if (key === shown) return;
    shown = key;
    const head = el('h2', '', 'Companion');
    const top = el('div', 'pet-top'), pic = el('canvas', 'pet-portrait');
    pic.width = pic.height = 128; pic.title = 'Hold him on the map for this card';
    portrait(pic);
    const info = el('div', 'pet-info'), name = el('div', 'pet-title');
    name.append(el('b', '', pet.name), el('small', '', `level ${pet.level}`));
    const full = pet.level >= kind.maxLevel;
    info.append(name,
      bar(`hp ${pet.hp < max * 0.3 ? 'low' : ''}`, pet.hp / max, `Health ${pet.hp}/${max}`),
      bar('xp', full ? 1 : pet.xp / need, full ? 'Fully grown' : `XP ${pet.xp}/${need} to level ${pet.level + 1}`),
      el('div', 'pet-dmg', `Damage ${lo}-${hi} a blow`));
    top.append(pic, info);
    const modes = el('div', 'seg pet-modes');
    for (const [id, label] of MODES) {
      const b = el('button', mode === id ? 'active' : '', label);
      b.type = 'button'; b.title = `${pet.name} ${PET_MODES[id]}`;
      b.addEventListener('click', () => Actions.petMode(id));
      modes.append(b);
    }
    const buttons = el('div', 'pet-buttons');
    const hurt = pet.hp < max;
    buttons.append(
      button('Feed', food ? `${ITEMS[food].name} ×${foods}` : 'no food', () => Actions.petFeed(), away || !food || !hurt),
      button('Potion', `×${potions}`, () => Actions.petPotion(), away || !potions || !hurt),
      button('Call', pet.downUntil ? 'resting' : pet.home ? 'back to you' : 'with you', () => Actions.petCall(), !pet.home || pet.downUntil),
      button('Rename', '', () => askPetName(pet.name)),
      button('Send home', '', () => Actions.petHome(), away));
    box.replaceChildren(head, top, el('p', 'pet-hint', line), modes, buttons);
  }

  // on a phone: a small bar for his health at the end of yours
  function renderPip() {
    if (!pip) return;
    const pet = player && player.pet, kind = pet && PETS[pet.kind], here = kind && !pet.home && !pet.downUntil;
    const frac = here ? Math.max(0, Math.min(1, pet.hp / kind.hp(pet.level))) : 0;
    const key = here ? `${pet.name}|${Math.round(frac * 100)}` : '';
    if (key === pipShown) return;
    pipShown = key; pip.hidden = !here;
    if (!here) return;
    pip.firstChild.style.width = `${Math.round(frac * 100)}%`;
    pip.classList.toggle('low', frac < 0.3);
    pip.title = `${pet.name}: ${Math.round(frac * 100)}% health`;
  }

  function attach() {
    box = document.getElementById('petBox');
    const hp = typeof touchScreen !== 'undefined' && touchScreen && document.querySelector('.hud .tbar.hp');
    if (hp) {
      pip = el('b', 'hud-pet-pip'); pip.hidden = true; pip.setAttribute('aria-hidden', 'true');
      pip.append(el('i'));
      hp.append(pip);
    }
    // a few times a second is plenty: he heals and gets hurt between your own changes
    setInterval(() => { try { render(); renderPip(); } catch (e) { /* (not logged in yet) */ } }, 250);
  }
  // Show the card: on a phone the drawer's Gear page all the way open, scrolled to it; on a computer the side panel
  function open() {
    shown = ''; render();
    if (!box || box.hidden) return;
    if (typeof InventoryDrawer !== 'undefined' && document.getElementById('inventoryDrawer') && touchScreen) return InventoryDrawer.show('gear', 2, 'petBox');
    if (typeof touchScreen !== 'undefined' && touchScreen) document.body.classList.add('panel-open');
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach); else attach();
  return { open, render };
})();
