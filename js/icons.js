'use strict';
// Tilequest's own icons for the buttons: drawn as vectors (SVG), with the game's materials - stitched leather, old
// parchment, polished bronze and steel - shaded and lit from the top left, a dark outline round each. Sharp at any size.
//   Icons.url(name, size = 48): a data URL of the icon, for an <img> or a background
//   Icons.img(name, size): an <img> of it

const Icons = (() => {
  const INK = '#1a1008';
  // shared gradients, each icon declares the ones it uses
  const GRAD = {
    leather: '<linearGradient id="leather" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4904c"/><stop offset=".55" stop-color="#9a5624"/><stop offset="1" stop-color="#5e3010"/></linearGradient>',
    leatherHi: '<linearGradient id="leatherHi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eaaa66"/><stop offset="1" stop-color="#a8622a"/></linearGradient>',
    leatherLo: '<linearGradient id="leatherLo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a4c1e"/><stop offset="1" stop-color="#4a260c"/></linearGradient>',
    gold: '<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2b0"/><stop offset=".35" stop-color="#f0c450"/><stop offset=".7" stop-color="#c08a20"/><stop offset="1" stop-color="#7a5208"/></linearGradient>',
    bronze: '<linearGradient id="bronze" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe2a0"/><stop offset=".3" stop-color="#d8a04a"/><stop offset=".7" stop-color="#9a6422"/><stop offset="1" stop-color="#5a3608"/></linearGradient>',
    steel: '<linearGradient id="steel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#d4dae4"/><stop offset=".55" stop-color="#9aa4b4"/><stop offset="1" stop-color="#5a6474"/></linearGradient>',
    iron: '<linearGradient id="iron" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c8ccd4"/><stop offset=".5" stop-color="#7a808c"/><stop offset="1" stop-color="#3a3e46"/></linearGradient>',
    parch: '<linearGradient id="parch" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbf0cc"/><stop offset=".6" stop-color="#e8d098"/><stop offset="1" stop-color="#c4a466"/></linearGradient>',
    roll: '<linearGradient id="roll" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4d4"/><stop offset=".5" stop-color="#d8bc80"/><stop offset="1" stop-color="#8a6a36"/></linearGradient>',
    wood: '<linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b47a42"/><stop offset=".6" stop-color="#7a4a1e"/><stop offset="1" stop-color="#4a2a0c"/></linearGradient>',
    wax: '<radialGradient id="wax" cx=".38" cy=".32" r=".7"><stop offset="0" stop-color="#ff8a6a"/><stop offset=".5" stop-color="#c0302a"/><stop offset="1" stop-color="#6a0e0a"/></radialGradient>',
    coin: '<radialGradient id="coin" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff8c0"/><stop offset=".45" stop-color="#ffd040"/><stop offset="1" stop-color="#a87010"/></radialGradient>',
    glow: '<radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6c0" stop-opacity=".9"/><stop offset="1" stop-color="#fff6c0" stop-opacity="0"/></radialGradient>',
    water: '<linearGradient id="water" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7ac0ff"/><stop offset="1" stop-color="#2a6ab0"/></linearGradient>',
  };
  const shine = (x, y, rx, ry, o = 0.55) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${o}"/>`;
  // a cog with n teeth round (cx, cy): its outline path
  const cog = (cx, cy, r0, r1, n) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, w = Math.PI / n * 0.55;
      for (const [ang, r] of [[a - w * 1.25, r0], [a - w * 0.7, r1], [a + w * 0.7, r1], [a + w * 1.25, r0]]) pts.push(`${(cx + Math.cos(ang) * r).toFixed(2)},${(cy + Math.sin(ang) * r).toFixed(2)}`);
    }
    return `M${pts.join('L')}Z`;
  };
  // a potion: its liquid's light, middle and dark colours
  const potion = (hi, mid, lo) => `
      <defs><radialGradient id="liq" cx=".38" cy=".4" r=".7"><stop offset="0" stop-color="${hi}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></radialGradient></defs>
      <rect x="25" y="5" width="14" height="9" rx="2.5" fill="url(#wood)" stroke="${INK}" stroke-width="2.4"/>
      <path d="M24 14h16v6c9 3 15 11 15 20 0 12-10 20-23 20S9 52 9 40c0-9 6-17 15-20z" fill="#d8eef8" fill-opacity=".35" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>
      <path d="M12.5 38c5-3 11-3 19.5 0s14.5 3 19.5 0c.5 1 .5 1.5.5 2.5 0 10-8.5 16.5-20 16.5S12 50.5 12 40.5c0-1 0-1.5.5-2.5z" fill="url(#liq)"/>
      <path d="M24 14h16" stroke="${INK}" stroke-width="2.8"/>
      <rect x="23" y="13" width="18" height="4" rx="2" fill="#d8c8a0" stroke="${INK}" stroke-width="1.8"/>
      <path d="M16 31c3-4 6-6 9-7" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>
      <ellipse cx="20" cy="46" rx="2.5" ry="4" fill="#fff" opacity=".35"/>
      <g fill="#fff" opacity=".6"><circle cx="38" cy="45" r="1.6"/><circle cx="42" cy="41" r="1"/><circle cx="34" cy="49" r="1.1"/></g>`;
  const ICONS = {
    // Character: a stitched leather backpack, its flap buckled in gold, a pocket in front, a strap to carry it by
    character: [['leather', 'leatherHi', 'leatherLo', 'gold'], `
      <path d="M23 15c0-8 18-8 18 0" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
      <path d="M23 15c0-8 18-8 18 0" fill="none" stroke="#8a4c1e" stroke-width="3" stroke-linecap="round"/>
      <rect x="6" y="30" width="10" height="20" rx="4" fill="url(#leatherLo)" stroke="${INK}" stroke-width="2.5"/>
      <rect x="48" y="30" width="10" height="20" rx="4" fill="url(#leatherLo)" stroke="${INK}" stroke-width="2.5"/>
      <rect x="13" y="15" width="38" height="44" rx="9" fill="url(#leather)" stroke="${INK}" stroke-width="2.8"/>
      <path d="M17 19h30" stroke="#f0b878" stroke-width="2" stroke-linecap="round" opacity=".7"/>
      <rect x="19" y="42" width="26" height="13" rx="4" fill="url(#leatherLo)" stroke="${INK}" stroke-width="2"/>
      <rect x="21.5" y="44.5" width="21" height="8" rx="2.5" fill="none" stroke="#e8b070" stroke-width="1" stroke-dasharray="2 1.6" opacity=".7"/>
      <path d="M13 23q19-11 38 0v12q-19 8-38 0z" fill="url(#leatherHi)" stroke="${INK}" stroke-width="2.6"/>
      <path d="M16.5 26q15.5-8.5 31 0v7q-15.5 6-31 0z" fill="none" stroke="#5a2e0c" stroke-width="1" stroke-dasharray="2.2 1.6" opacity=".75"/>
      <rect x="28" y="31" width="8" height="14" rx="1.5" fill="url(#leatherLo)" stroke="${INK}" stroke-width="1.8"/>
      <rect x="26.5" y="34" width="11" height="9" rx="2" fill="url(#gold)" stroke="${INK}" stroke-width="2"/>
      <rect x="29.5" y="36.5" width="5" height="4" rx="1" fill="#5a3a08"/>
      ${shine(22, 21, 5, 1.6, 0.35)}${shine(30.5, 35.5, 2.5, 1, 0.8)}`],
    // Quests: a parchment scroll between two rolled ends, lines of writing, sealed with red wax on a ribbon
    quests: [['parch', 'roll', 'wax'], `
      <rect x="13" y="13" width="38" height="38" fill="url(#parch)" stroke="${INK}" stroke-width="2.6"/>
      <path d="M18 21h24M18 27h28M18 33h22M18 39h26" stroke="#7a5a32" stroke-width="2" stroke-linecap="round" opacity=".75"/>
      <path d="M17 45l12 0" stroke="#7a5a32" stroke-width="2" stroke-linecap="round" opacity=".55"/>
      <rect x="9" y="7" width="46" height="9" rx="4.5" fill="url(#roll)" stroke="${INK}" stroke-width="2.6"/>
      <rect x="9" y="48" width="46" height="9" rx="4.5" fill="url(#roll)" stroke="${INK}" stroke-width="2.6"/>
      <ellipse cx="9" cy="11.5" rx="2.4" ry="4.2" fill="#a8844a" stroke="${INK}" stroke-width="1.6"/>
      <ellipse cx="9" cy="52.5" rx="2.4" ry="4.2" fill="#a8844a" stroke="${INK}" stroke-width="1.6"/>
      <path d="M42 46l-3 13 5-3 4 4 0-13z" fill="#a82a22" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
      <circle cx="45" cy="44" r="7.5" fill="url(#wax)" stroke="${INK}" stroke-width="2.2"/>
      <path d="M45 39.5l1.6 3.2 3.4.5-2.5 2.4.6 3.4-3.1-1.6-3.1 1.6.6-3.4-2.5-2.4 3.4-.5z" fill="#7a1410" opacity=".85"/>
      ${shine(22, 10, 9, 1.4, 0.6)}${shine(42.5, 41.5, 2.2, 1.4, 0.7)}`],
    // Map: a parchment map folded in three, a river, woods and hills, a dotted path to a red cross
    map: [['parch', 'water'], `
      <path d="M6 14l17-5 18 5 17-5v41l-17 5-18-5-17 5z" fill="url(#parch)" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M23 9v41l18 5V14z" fill="#000" opacity=".1"/>
      <path d="M41 14v41l17-5V9z" fill="#000" opacity=".04"/>
      <path d="M10 22c8 2 9 10 16 12s10 8 16 6 9 4 13 2" fill="none" stroke="url(#water)" stroke-width="4.2" stroke-linecap="round"/>
      <path d="M10 22c8 2 9 10 16 12s10 8 16 6 9 4 13 2" fill="none" stroke="#bfe4ff" stroke-width="1" stroke-linecap="round" opacity=".7"/>
      <g fill="#3e7a2c" stroke="${INK}" stroke-width="1"><circle cx="13" cy="40" r="3.4"/><circle cx="18" cy="43" r="3"/><circle cx="14" cy="46" r="2.6"/><circle cx="48" cy="20" r="3"/><circle cx="52" cy="24" r="2.6"/></g>
      <path d="M28 22l4-6 4 6z" fill="#9a8a6a" stroke="${INK}" stroke-width="1.2"/><path d="M33 22l3-4.5 3 4.5z" fill="#8a7a5a" stroke="${INK}" stroke-width="1.1"/>
      <path d="M21 46c4-3 8-1 12-5s7-1 10-4" fill="none" stroke="#a83a2a" stroke-width="1.8" stroke-dasharray="2.4 2.2" stroke-linecap="round"/>
      <path d="M44 33l6 6M50 33l-6 6" stroke="#c0281e" stroke-width="3" stroke-linecap="round"/>
      <path d="M44 33l6 6M50 33l-6 6" stroke="#ff8a6a" stroke-width="1" stroke-linecap="round" opacity=".8"/>
      ${shine(14, 15, 5, 1.2, 0.6)}`],
    // Chat: a parchment speech bubble with three dots
    chat: [['parch'], `
      <path d="M32 9C17 9 7 17 7 28c0 7 4 13 11 16l-3 10 11-8c2 .3 4 .5 6 .5 15 0 25-8 25-18.5S47 9 32 9z" fill="url(#parch)" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>
      <path d="M16 18c4-3 9-4 14-4" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".75"/>
      <g fill="#5a3e1e"><circle cx="21" cy="28.5" r="3.6"/><circle cx="32" cy="28.5" r="3.6"/><circle cx="43" cy="28.5" r="3.6"/></g>
      <g fill="#fff" opacity=".45"><circle cx="20" cy="27.3" r="1.1"/><circle cx="31" cy="27.3" r="1.1"/><circle cx="42" cy="27.3" r="1.1"/></g>`],
    // Menu: a polished bronze cog with a steel bolt in its middle
    menu: [['bronze', 'iron'], `
      <path d="${cog(32, 32, 21, 28, 8)}" fill="url(#bronze)" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
      <circle cx="32" cy="32" r="15" fill="none" stroke="#5a3608" stroke-width="1.6" opacity=".6"/>
      <circle cx="32" cy="32" r="9" fill="#2a1a08" stroke="${INK}" stroke-width="2"/>
      <circle cx="32" cy="32" r="6" fill="url(#iron)" stroke="${INK}" stroke-width="1.5"/>
      <path d="M29 32h6M32 29v6" stroke="#2a2e36" stroke-width="1.4"/>
      <path d="M17 22a18 18 0 0 1 12-9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>`],
    // Attack: two crossed swords, bright steel with a fuller down each blade, gold guards, wrapped grips, gold pommels
    attack: [['steel', 'gold', 'leatherLo'], [-1, 1].map(s => `
      <g transform="translate(32 32) scale(${s} 1) rotate(-45) translate(-32 -32)">
        <path d="M32 2l6 7v31H26V9z" fill="url(#steel)" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M32 8v30" stroke="#7a8494" stroke-width="1.8"/>
        <rect x="21" y="39" width="22" height="5.5" rx="2.7" fill="url(#gold)" stroke="${INK}" stroke-width="2.2"/>
        <rect x="29" y="44" width="6" height="11" rx="1.5" fill="url(#leatherLo)" stroke="${INK}" stroke-width="2"/>
        <path d="M29.5 47l5 2M29.5 51l5 2" stroke="#c88a4a" stroke-width="1" opacity=".8"/>
        <circle cx="32" cy="58" r="3.8" fill="url(#gold)" stroke="${INK}" stroke-width="2"/>
      </g>`).join('') + shine(22, 15, 1.4, 4, 0.7)],
    // Talk: a speech bubble with lines of words in it
    talk: [['parch'], `
      <path d="M32 8C17 8 7 16 7 27c0 7 4 13 11 16l-3 11 11-8.5c2 .3 4 .5 6 .5 15 0 25-8 25-19S47 8 32 8z" fill="url(#parch)" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>
      <path d="M17 21h30M17 28h26M17 35h18" stroke="#5a3e1e" stroke-width="3" stroke-linecap="round"/>
      <path d="M16 15c4-3 9-4 14-4" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".75"/>`],
    // Loot: an open wooden chest bound in iron, heaped with gold coins that catch the light
    loot: [['wood', 'iron', 'coin', 'glow', 'gold'], `
      <circle cx="32" cy="28" r="22" fill="url(#glow)"/>
      <path d="M10 26l6-15h32l6 15z" fill="url(#wood)" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M14 23l4-9h28l4 9" fill="#2a1406" opacity=".55"/>
      <g stroke="${INK}" stroke-width="1.4"><circle cx="22" cy="27" r="6" fill="url(#coin)"/><circle cx="32" cy="24" r="6.5" fill="url(#coin)"/><circle cx="42" cy="27" r="6" fill="url(#coin)"/><circle cx="27" cy="30" r="5.5" fill="url(#coin)"/><circle cx="37" cy="30" r="5.5" fill="url(#coin)"/></g>
      <path d="M30 21l1.5 1.5M32 19.5v3" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>
      <rect x="9" y="31" width="46" height="26" rx="3" fill="url(#wood)" stroke="${INK}" stroke-width="2.6"/>
      <path d="M12 39h40M12 48h40" stroke="#3a1e08" stroke-width="1" opacity=".55"/>
      <rect x="9" y="31" width="7" height="26" fill="url(#iron)" stroke="${INK}" stroke-width="2"/>
      <rect x="48" y="31" width="7" height="26" fill="url(#iron)" stroke="${INK}" stroke-width="2"/>
      <rect x="26.5" y="37" width="11" height="12" rx="2" fill="url(#gold)" stroke="${INK}" stroke-width="2"/>
      <path d="M32 41.5v4" stroke="#3a2404" stroke-width="2.2" stroke-linecap="round"/>
      <g fill="#ffe9a0"><circle cx="12.5" cy="35" r="1"/><circle cx="12.5" cy="53" r="1"/><circle cx="51.5" cy="35" r="1"/><circle cx="51.5" cy="53" r="1"/></g>`],
    // Use: an open hand in a leather glove, reaching out
    use: [['leatherHi', 'leatherLo'], `
      <path d="M20 58c-6-6-11-14-12-20-.6-3 2.4-4.6 4.6-2.6L19 41V15c0-2.8 4.6-2.8 4.6 0v17V10c0-2.8 4.8-2.8 4.8 0v22V12c0-2.8 4.8-2.8 4.8 0v20V16c0-2.8 4.8-2.8 4.8 0v28c0 7-3.5 14-8 14z" fill="url(#leatherHi)" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M19 49h18" stroke="#6a3a14" stroke-width="2"/>
      <rect x="17" y="53" width="22" height="7" rx="2" fill="url(#leatherLo)" stroke="${INK}" stroke-width="2.2"/>
      <path d="M21.3 14v13M26 11v16M30.8 13v15M35.6 17v13" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".45"/>`],
    // Idle: a sword resting in its leather sheath, a gold guard and pommel
    idle: [['leather', 'gold', 'iron'], `
      <g transform="rotate(-35 32 32)">
        <circle cx="32" cy="7" r="4" fill="url(#gold)" stroke="${INK}" stroke-width="2"/>
        <rect x="29" y="10" width="6" height="11" rx="1.5" fill="#5a3214" stroke="${INK}" stroke-width="2"/>
        <rect x="20" y="20" width="24" height="5.5" rx="2.7" fill="url(#gold)" stroke="${INK}" stroke-width="2.2"/>
        <path d="M27 25.5h10v29l-5 6-5-6z" fill="url(#leather)" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
        <rect x="27" y="31" width="10" height="3.5" fill="url(#iron)" stroke="${INK}" stroke-width="1.4"/>
        <rect x="27" y="45" width="10" height="3.5" fill="url(#iron)" stroke="${INK}" stroke-width="1.4"/>
        <path d="M29.3 27v24" stroke="#f0b878" stroke-width="1.2" opacity=".6"/>
      </g>`],
    // Potions: a round glass flask with a cork and a wax seal, the liquid glowing inside, light on the glass
    health: [['wood'], potion('#ff6a5a', '#c41e18', '#5a0806')],
    mana: [['wood'], potion('#8ab8ff', '#2a58d0', '#0e1e6a')],
    food: [['wood'], `
      <ellipse cx="32" cy="40" rx="24" ry="15" fill="#c8843a" stroke="${INK}" stroke-width="2.6"/>
      <path d="M10 38c2-12 13-20 22-20s20 8 22 20c-6 5-14 7-22 7s-16-2-22-7z" fill="#e8a858" stroke="${INK}" stroke-width="2.6"/>
      <path d="M18 30c3 2 6 2 9 0M30 26c3 2 6 2 9 0M37 33c3 2 6 2 9 0" fill="none" stroke="#a86a2a" stroke-width="2" stroke-linecap="round"/>
      <path d="M16 28c3-4 8-7 13-8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".55"/>`],
    // Close: a cross of forged iron with bevelled edges
    close: [['iron'], `
      <g stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" fill="url(#iron)">
        <path d="M14 20l6-6 12 12 12-12 6 6-12 12 12 12-6 6-12-12-12 12-6-6 12-12z"/>
      </g>
      <path d="M17 20l3-3 12 12" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>`],
    // Plus: a bronze plus, for an empty quick button
    plus: [['bronze'], `
      <path d="M27 12h10v15h15v10H37v15H27V37H12V27h15z" fill="url(#bronze)" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M29 15v13H15" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>`],
  };
  const urls = new Map();
  const svg = name => {
    const [grads, body] = ICONS[name];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${grads.map(g => GRAD[g]).join('')}</defs>`
      + `<g filter="none">${body}</g></svg>`;
  };
  return {
    names: () => Object.keys(ICONS),
    svg,
    url(name, size = 48) {
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
