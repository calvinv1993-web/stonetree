'use strict';
// Tilequest's own icons for the buttons: drawn as vectors (SVG) in dark, worn metals - old gold, bronze, iron and steel -
// engraved and lit from the top left, a near-black outline round each, so they sit in the dark, gold-lined frames of
// the interface. Potions keep their glowing colours: they're what you look for in a fight. Sharp at any size.
//   Icons.url(name): a data URL of the icon, for an <img> or a background
//   Icons.img(name, size = 48): an <img> of it

const Icons = (() => {
  const INK = '#0c0906';
  const GRAD = {
    gold: '<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e2a8"/><stop offset=".35" stop-color="#c9a259"/><stop offset=".7" stop-color="#8a6630"/><stop offset="1" stop-color="#3e2a10"/></linearGradient>',
    goldV: '<linearGradient id="goldV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0dca0"/><stop offset=".5" stop-color="#b48c48"/><stop offset="1" stop-color="#4a3416"/></linearGradient>',
    iron: '<linearGradient id="iron" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d6d9de"/><stop offset=".4" stop-color="#8d939c"/><stop offset=".75" stop-color="#4e535b"/><stop offset="1" stop-color="#22252a"/></linearGradient>',
    ironV: '<linearGradient id="ironV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c4c8cf"/><stop offset=".55" stop-color="#6c727b"/><stop offset="1" stop-color="#2a2d32"/></linearGradient>',
    steel: '<linearGradient id="steel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f4f6f8"/><stop offset=".45" stop-color="#b8bec8"/><stop offset=".55" stop-color="#7c8490"/><stop offset="1" stop-color="#3c424c"/></linearGradient>',
    leather: '<linearGradient id="leather" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a6a3c"/><stop offset=".6" stop-color="#5e3c1c"/><stop offset="1" stop-color="#2e1c0c"/></linearGradient>',
    parch: '<linearGradient id="parch" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6d4a4"/><stop offset=".6" stop-color="#b89c62"/><stop offset="1" stop-color="#6e5428"/></linearGradient>',
    wood: '<linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5e34"/><stop offset=".6" stop-color="#553418"/><stop offset="1" stop-color="#2a1808"/></linearGradient>',
    coin: '<radialGradient id="coin" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff2b8"/><stop offset=".45" stop-color="#d8aa40"/><stop offset="1" stop-color="#6e4a0c"/></radialGradient>',
    glow: '<radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd880" stop-opacity=".55"/><stop offset="1" stop-color="#ffd880" stop-opacity="0"/></radialGradient>',
  };
  const hi = (d, w = 1.6, o = 0.5) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" opacity="${o}"/>`;
  const cog = (cx, cy, r0, r1, n) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, w = (Math.PI / n) * 0.55;
      for (const [ang, r] of [[a - w * 1.25, r0], [a - w * 0.7, r1], [a + w * 0.7, r1], [a + w * 1.25, r0]]) pts.push(`${(cx + Math.cos(ang) * r).toFixed(2)},${(cy + Math.sin(ang) * r).toFixed(2)}`);
    }
    return `M${pts.join('L')}Z`;
  };
  // a star of n points round (cx, cy), from r0 to r1: a compass rose's points
  const star = (cx, cy, r0, r1, n, turn = 0) => {
    const pts = [];
    for (let i = 0; i < n * 2; i++) { const a = turn + (i / (n * 2)) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? r0 : r1; pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`); }
    return `M${pts.join('L')}Z`;
  };
  const potion = (light, mid, dark) => `
      <defs><radialGradient id="liq" cx=".38" cy=".4" r=".7"><stop offset="0" stop-color="${light}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></radialGradient>
      <radialGradient id="aura" cx=".5" cy=".62" r=".5"><stop offset="0" stop-color="${mid}" stop-opacity=".55"/><stop offset="1" stop-color="${mid}" stop-opacity="0"/></radialGradient></defs>
      <circle cx="32" cy="40" r="26" fill="url(#aura)"/>
      <rect x="25" y="5" width="14" height="9" rx="2.5" fill="url(#wood)" stroke="${INK}" stroke-width="2.2"/>
      <path d="M24 14h16v6c9 3 15 11 15 20 0 12-10 20-23 20S9 52 9 40c0-9 6-17 15-20z" fill="#cfe4ee" fill-opacity=".18" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M12.5 37c5-3 11-3 19.5 0s14.5 3 19.5 0c.5 1 .5 2 .5 3 0 10-8.5 17-20 17S12 50 12 40c0-1 0-2 .5-3z" fill="url(#liq)"/>
      <rect x="22.5" y="13" width="19" height="4.5" rx="2" fill="url(#gold)" stroke="${INK}" stroke-width="1.6"/>
      ${hi('M16 31c3-4 6-6 9-7', 2.6, 0.75)}
      <ellipse cx="20" cy="46" rx="2.2" ry="4" fill="#fff" opacity=".3"/>
      <g fill="#fff" opacity=".55"><circle cx="38" cy="45" r="1.5"/><circle cx="42" cy="41" r="1"/><circle cx="34" cy="49" r="1"/></g>`;
  const ICONS = {
    // Character: a knight's helm, a nasal guard and eye slits, a gold crest along its top, rivets round its rim
    character: [['ironV', 'iron', 'gold'], `
      <path d="M32 6c-13 0-21 10-21 24v20c0 3 2 5 5 6l8 2V40h16v18l8-2c3-1 5-3 5-6V30C53 16 45 6 32 6z" fill="url(#ironV)" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M32 6c-2 0-3 1-3 3v19h6V9c0-2-1-3-3-3z" fill="url(#gold)" stroke="${INK}" stroke-width="1.8"/>
      <path d="M14 29h17M33 29h17" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
      <path d="M15 29h15M34 29h15" stroke="#0a0806" stroke-width="3" stroke-linecap="round"/>
      <path d="M29.5 28h5v14h-5z" fill="url(#iron)" stroke="${INK}" stroke-width="1.6"/>
      <path d="M16 36v13M48 36v13" stroke="#2a2d32" stroke-width="1.4" opacity=".8"/>
      <g fill="#e8d098" stroke="${INK}" stroke-width=".8"><circle cx="17" cy="20" r="1.4"/><circle cx="47" cy="20" r="1.4"/><circle cx="14" cy="38" r="1.3"/><circle cx="50" cy="38" r="1.3"/></g>
      ${hi('M17 15c3-4 7-6 11-7', 2.2, 0.55)}`],
    // Quests: a rolled scroll, its ends capped in gold, a wax seal hanging from it on a cord
    quests: [['parch', 'gold'], `
      <rect x="14" y="14" width="36" height="36" fill="url(#parch)" stroke="${INK}" stroke-width="2.4"/>
      <path d="M19 22h24M19 28h26M19 34h20M19 40h24" stroke="#4a3418" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>
      <rect x="9" y="8" width="46" height="9" rx="4.5" fill="url(#parch)" stroke="${INK}" stroke-width="2.4"/>
      <rect x="9" y="47" width="46" height="9" rx="4.5" fill="url(#parch)" stroke="${INK}" stroke-width="2.4"/>
      <g fill="url(#gold)" stroke="${INK}" stroke-width="1.6"><rect x="5" y="9" width="5" height="7" rx="1.5"/><rect x="54" y="9" width="5" height="7" rx="1.5"/><rect x="5" y="48" width="5" height="7" rx="1.5"/><rect x="54" y="48" width="5" height="7" rx="1.5"/></g>
      <path d="M42 50l-1 9M46 50l2 9" stroke="#6a1a12" stroke-width="2"/>
      <circle cx="44" cy="47" r="6.5" fill="#7a1a14" stroke="${INK}" stroke-width="2"/>
      <path d="M44 43l1.3 2.6 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4z" fill="#c8a058" opacity=".85"/>
      ${hi('M13 11h22', 1.6, 0.45)}`],
    // Map: a compass rose in old gold, eight points over a ring, an iron boss at its heart
    map: [['gold', 'goldV', 'iron'], `
      <circle cx="32" cy="32" r="19" fill="none" stroke="${INK}" stroke-width="5"/>
      <circle cx="32" cy="32" r="19" fill="none" stroke="url(#gold)" stroke-width="2.6"/>
      <circle cx="32" cy="32" r="15" fill="none" stroke="#8a6630" stroke-width="1" stroke-dasharray="1.5 2.4"/>
      <path d="${star(32, 32, 6, 22, 4, Math.PI / 4)}" fill="#5a4220" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="${star(32, 32, 5.5, 29, 4)}" fill="url(#goldV)" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M32 3l3 26h-6zM32 61l-3-26h6zM3 32l26-3v6zM61 32l-26 3v-6z" fill="#000" opacity=".22"/>
      <circle cx="32" cy="32" r="4.5" fill="url(#iron)" stroke="${INK}" stroke-width="1.6"/>
      ${hi('M32 6l2 18', 1.4, 0.7)}`],
    // Chat: a speech bubble of dark steel, gold-rimmed, three gold dots
    chat: [['ironV', 'gold'], `
      <path d="M32 9C17 9 7 17 7 28c0 7 4 13 11 16l-3 10 11-8c2 .3 4 .5 6 .5 15 0 25-8 25-18.5S47 9 32 9z" fill="url(#ironV)" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M32 12.5C19 12.5 11 19 11 28c0 6 3.5 11 10 14l-1.5 5 6-4.5c2 .4 4.3.6 6.5.6 13 0 21-6.5 21-15.5S45 12.5 32 12.5z" fill="none" stroke="url(#gold)" stroke-width="1.4" opacity=".85"/>
      <g fill="url(#gold)" stroke="${INK}" stroke-width="1"><circle cx="21" cy="28.5" r="3.4"/><circle cx="32" cy="28.5" r="3.4"/><circle cx="43" cy="28.5" r="3.4"/></g>
      ${hi('M16 18c4-3 9-4 14-4', 2, 0.45)}`],
    // Menu: a cog of old gold round an iron boss
    menu: [['gold', 'iron'], `
      <path d="${cog(32, 32, 20, 27, 10)}" fill="url(#gold)" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <circle cx="32" cy="32" r="14" fill="#3e2a10" stroke="${INK}" stroke-width="1.6" opacity=".55"/>
      <circle cx="32" cy="32" r="9" fill="url(#iron)" stroke="${INK}" stroke-width="2"/>
      <circle cx="32" cy="32" r="3.2" fill="#14110d"/>
      ${hi('M17 21a18 18 0 0 1 12-9', 2.2, 0.5)}`],
    // Attack: two crossed swords of bright steel, fullers down the blades, gold guards and pommels, leather grips
    attack: [['steel', 'gold', 'leather'], [-1, 1].map(s => `
      <g transform="translate(32 32) scale(${s} 1) rotate(-45) translate(-32 -32)">
        <path d="M32 2l6 7v31H26V9z" fill="url(#steel)" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round"/>
        <path d="M32 8v30" stroke="#6c7480" stroke-width="1.7"/>
        <path d="M20 39h24l-3 5H23z" fill="url(#gold)" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
        <rect x="29" y="44" width="6" height="11" rx="1.5" fill="url(#leather)" stroke="${INK}" stroke-width="1.8"/>
        <path d="M29.5 47l5 2M29.5 51l5 2" stroke="#b88a5a" stroke-width="1" opacity=".7"/>
        <path d="M32 55l4 3.5-4 3.5-4-3.5z" fill="url(#gold)" stroke="${INK}" stroke-width="1.8"/>
      </g>`).join('')],
    // Talk: two speech bubbles, one behind the other
    talk: [['ironV', 'gold'], `
      <path d="M40 18c10 0 18 6 18 14 0 5-3 9-8 11l2 7-8-5.5c-1.4.3-2.8.4-4 .4" fill="url(#ironV)" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" opacity=".85"/>
      <path d="M27 10C15 10 7 17 7 26c0 6 3.5 10.5 9 13l-2.5 8.5 9.5-6.5c1.3.2 2.7.3 4 .3 12 0 20-7 20-15.5S39 10 27 10z" fill="url(#ironV)" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M16 21h22M16 27h18M16 33h12" stroke="url(#gold)" stroke-width="2.6" stroke-linecap="round"/>
      ${hi('M13 16c3-2 7-3 11-3', 2, 0.45)}`],
    // Loot: an open chest of dark wood bound in iron, gold heaped in it and glowing
    loot: [['wood', 'iron', 'coin', 'glow', 'gold'], `
      <circle cx="32" cy="28" r="24" fill="url(#glow)"/>
      <path d="M10 26l6-15h32l6 15z" fill="url(#wood)" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round"/>
      <path d="M14 23l4-9h28l4 9" fill="#120a04" opacity=".6"/>
      <g stroke="${INK}" stroke-width="1.3"><circle cx="22" cy="27" r="6" fill="url(#coin)"/><circle cx="32" cy="24" r="6.5" fill="url(#coin)"/><circle cx="42" cy="27" r="6" fill="url(#coin)"/><circle cx="27" cy="30" r="5.5" fill="url(#coin)"/><circle cx="37" cy="30" r="5.5" fill="url(#coin)"/></g>
      ${hi('M30 21l1.5 1.5', 1.4, 0.9)}
      <rect x="9" y="31" width="46" height="26" rx="2.5" fill="url(#wood)" stroke="${INK}" stroke-width="2.5"/>
      <path d="M12 39h40M12 48h40" stroke="#120a04" stroke-width="1" opacity=".6"/>
      <rect x="9" y="31" width="7" height="26" fill="url(#iron)" stroke="${INK}" stroke-width="1.8"/>
      <rect x="48" y="31" width="7" height="26" fill="url(#iron)" stroke="${INK}" stroke-width="1.8"/>
      <path d="M27 37h10v8l-5 4-5-4z" fill="url(#gold)" stroke="${INK}" stroke-width="1.8"/>
      <circle cx="32" cy="41.5" r="1.5" fill="#2a1a04"/>`],
    // Use: a gauntlet of iron plates, reaching out
    use: [['ironV', 'iron', 'leather', 'gold'], `
      <path d="M18 60l-1-14c-4-3-8-8-9-12-.6-3 2.4-4.6 4.6-2.6L18 37V15c0-2.8 4.6-2.8 4.6 0v15V11c0-2.8 4.8-2.8 4.8 0v19V13c0-2.8 4.8-2.8 4.8 0v18V17c0-2.8 4.8-2.8 4.8 0v28c0 6-2.5 11-5 15z" fill="url(#ironV)" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M18.5 21h4M23.6 18h4.4M28.6 19h4.4M33.6 23h4.4M18.5 28h4M23.6 26h4.4M28.6 27h4.4M33.6 30h4.4" stroke="${INK}" stroke-width="1.3"/>
      <path d="M18 41h20" stroke="url(#gold)" stroke-width="2.4"/>
      <rect x="16" y="50" width="22" height="10" rx="2" fill="url(#leather)" stroke="${INK}" stroke-width="2"/>
      ${hi('M20.3 16v12M25 13v14M29.8 15v14', 1.1, 0.5)}`],
    // Idle: a sword in its sheath, at rest
    idle: [['leather', 'gold', 'iron'], `
      <g transform="rotate(-35 32 32)">
        <path d="M32 3l4 4-4 4-4-4z" fill="url(#gold)" stroke="${INK}" stroke-width="1.8"/>
        <rect x="29" y="10" width="6" height="11" rx="1.5" fill="url(#leather)" stroke="${INK}" stroke-width="1.8"/>
        <path d="M20 20h24l-3 5H23z" fill="url(#gold)" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
        <path d="M27 25h10v29l-5 6-5-6z" fill="url(#leather)" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
        <rect x="27" y="31" width="10" height="3.5" fill="url(#iron)" stroke="${INK}" stroke-width="1.3"/>
        <rect x="27" y="45" width="10" height="3.5" fill="url(#iron)" stroke="${INK}" stroke-width="1.3"/>
      </g>`],
    // Close: a cross of dark iron, bevelled
    close: [['iron'], `
      <path d="M14 20l6-6 12 12 12-12 6 6-12 12 12 12-6 6-12-12-12 12-6-6 12-12z" fill="url(#iron)" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      ${hi('M17 20l3-3 12 12', 1.4, 0.45)}`],
    // Plus: an old-gold plus, for an empty quick button
    plus: [['gold'], `
      <path d="M28 13h8v15h15v8H36v15h-8V36H13v-8h15z" fill="url(#gold)" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      ${hi('M30 16v13H16', 1.3, 0.45)}`],
    // Potions and food
    health: [['wood', 'gold'], potion('#ff7a6a', '#b01c16', '#3e0604')],
    mana: [['wood', 'gold'], potion('#9ac4ff', '#2450c0', '#0a1650')],
    food: [['wood'], `
      <ellipse cx="32" cy="40" rx="24" ry="15" fill="#7a4a1c" stroke="${INK}" stroke-width="2.4"/>
      <path d="M10 38c2-12 13-20 22-20s20 8 22 20c-6 5-14 7-22 7s-16-2-22-7z" fill="#b8803e" stroke="${INK}" stroke-width="2.4"/>
      <path d="M18 30c3 2 6 2 9 0M30 26c3 2 6 2 9 0M37 33c3 2 6 2 9 0" fill="none" stroke="#6a4218" stroke-width="2" stroke-linecap="round"/>
      ${hi('M16 28c3-4 8-7 13-8', 2, 0.4)}`],
    // Gold: a stack of coins
    coins: [['coin', 'gold'], `
      <g stroke="${INK}" stroke-width="2"><ellipse cx="32" cy="48" rx="18" ry="7" fill="#6e4a0c"/><ellipse cx="32" cy="44" rx="18" ry="7" fill="url(#coin)"/>
      <ellipse cx="32" cy="36" rx="18" ry="7" fill="#6e4a0c"/><ellipse cx="32" cy="32" rx="18" ry="7" fill="url(#coin)"/>
      <ellipse cx="32" cy="24" rx="18" ry="7" fill="#6e4a0c"/><ellipse cx="32" cy="20" rx="18" ry="7" fill="url(#coin)"/></g>
      <path d="M32 16l1.5 3 3.3.4-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.4z" fill="#8a5e10" opacity=".8"/>
      ${hi('M20 18c3-2 7-3 11-3', 1.8, 0.6)}`],
  };
  const urls = new Map();
  const svg = name => {
    const [grads, body] = ICONS[name];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${grads.map(g => GRAD[g]).join('')}</defs>${body}</svg>`;
  };
  return {
    names: () => Object.keys(ICONS),
    svg,
    url(name) {
      if (!urls.has(name)) urls.set(name, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg(name))}`);
      return urls.get(name);
    },
    img(name, size = 48) {
      const i = new Image(size, size);
      i.src = this.url(name);
      i.alt = '';
      i.className = 'icon';
      i.draggable = false;
      return i;
    },
  };
})();
