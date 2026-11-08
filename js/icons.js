'use strict';
// Tilequest's interface icons: one consistent set of line icons on a 24-unit grid, drawn as vectors (SVG) with rounded
// strokes, so they're sharp at any size. They take the colour of the text around them (currentColor): grey when idle,
// gold when chosen, set in style.css. Potions, food and gold keep a fill of their own colour: you look for those in a fight.
//   Icons.svg(name): the icon's SVG text
//   Icons.img(name, size = 24): an <svg> element of it (class "icon")
//   Icons.url(name, colour = '#e9e4da'): a data URL of it, for an <img> or a CSS background

const Icons = (() => {
  const RED = '#e5484d', BLUE = '#3e8ef7', GOLD = '#e8b54a', FOOD = '#d9894a';
  // a cog's outline round (12, 12): the settings icon
  const cog = (() => {
    const pts = [], n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, w = Math.PI / n;
      for (const [ang, r] of [[a - w * 0.62, 7.4], [a - w * 0.34, 9.6], [a + w * 0.34, 9.6], [a + w * 0.62, 7.4]]) {
        pts.push(`${(12 + Math.cos(ang) * r).toFixed(2)},${(12 + Math.sin(ang) * r).toFixed(2)}`);
      }
    }
    return `M${pts.join('L')}Z`;
  })();
  // a round flask, its lower half filled with a colour: health and mana potions
  const flask = colour => `
      <path d="M7.1 14.2h9.8l.8 1.4a4.3 4.3 0 0 1-3.8 5.9h-3.8a4.3 4.3 0 0 1-3.8-5.9z" fill="${colour}" stroke="none"/>
      <path d="M9.5 3h5M10.3 3v5.2L5.6 15.3a4.6 4.6 0 0 0 4 6.7h4.8a4.6 4.6 0 0 0 4-6.7l-4.7-7.1V3"/>`;

  // a sword pointing up-right (or up-left, mirrored), filled: blade, guard, grip, pommel
  const sword = mirror => `<g${mirror ? ' transform="matrix(-1 0 0 1 24 0)"' : ''} stroke="none" fill="currentColor">
      <path d="M8.25 14.25 18.85 3.65 21 3 20.35 5.15 9.75 15.75z"/><path d="M5.9 12.7 11.3 18.1 10.3 19.1 4.9 13.7z"/>
      <path d="M8.6 16.6 6.2 19 5 17.8 7.4 15.4z"/><circle cx="4.9" cy="19.1" r="1.7"/></g>`;
  // a footprint: a sole and a heel, turned by `turn` degrees
  const foot = (x, y, turn) => `<g transform="translate(${x} ${y}) rotate(${turn})" stroke="none" fill="currentColor">
      <ellipse cx="0" cy="2.6" rx="2.7" ry="3.6"/><ellipse cx="0" cy="8.3" rx="2" ry="1.7"/></g>`;

  // each icon: SVG paths on a 24×24 grid, stroked with currentColor unless they say otherwise
  const ICONS = {
    // the five tabs
    character: `<path d="M5.5 20.5V12a6.5 6.5 0 0 1 13 0v8.5"/><path d="M5.5 13.2h13"/><path d="M12 13.2v6.3"/><path d="M12 5.5V2.8"/>`,
    quests: `<path d="M5 19.5V4.6A1.6 1.6 0 0 1 6.6 3H19v15.5H6.5A1.5 1.5 0 0 0 5 20a1.5 1.5 0 0 0 1.5 1.5H19"/><path d="M13.5 3v6.5l-1.75-1.3L10 9.5V3"/>`,
    map: `<path d="M3.5 6.6 9 4.2l6 2.4 5.5-2.4v13.2L15 19.8l-6-2.4-5.5 2.4z"/><path d="M9 4.2v13.2M15 6.6v13.2"/>`,
    chat: `<path d="M5.6 4h12.8A1.6 1.6 0 0 1 20 5.6v8.8a1.6 1.6 0 0 1-1.6 1.6H10.5L6 20v-4h-.4A1.6 1.6 0 0 1 4 14.4V5.6A1.6 1.6 0 0 1 5.6 4z"/><path d="M8 8.8h8M8 11.8h5"/>`,
    menu: `<path d="${cog}"/><circle cx="12" cy="12" r="2.9"/>`,
    // the big button
    attack: `<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6M16 16l4 4M19 21l2-2"/>
      <path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="M5 14l4 4M7 17l-3 3M3 19l2 2"/>`,
    talk: `<path d="M4.6 4h9.8A1.6 1.6 0 0 1 16 5.6v6.8a1.6 1.6 0 0 1-1.6 1.6H9L5.5 17v-3h-.9A1.6 1.6 0 0 1 3 12.4V5.6A1.6 1.6 0 0 1 4.6 4z"/>
      <path d="M18.5 9h.9A1.6 1.6 0 0 1 21 10.6v6.8a1.6 1.6 0 0 1-1.6 1.6h-.9v3L15 19h-3.4A1.6 1.6 0 0 1 10 17.4V16.5"/>`,
    loot: `<path d="M9.2 3.5h5.6l-1.3 3.2h-3z"/><path d="M10.5 6.7C6.8 9.2 4.5 12.6 4.5 16a4.5 4.5 0 0 0 4.5 4.5h6a4.5 4.5 0 0 0 4.5-4.5c0-3.4-2.3-6.8-6-9.3"/>
      <circle cx="12" cy="14.6" r="2.6"/>`,
    use: `<path d="M9 12V5.2a1.6 1.6 0 0 1 3.2 0V11"/><path d="M12.2 10.5V3.9a1.6 1.6 0 0 1 3.2 0v6.6"/>
      <path d="M15.4 10.5V5.6a1.6 1.6 0 0 1 3.2 0v8.2a7.4 7.4 0 0 1-7.4 7.4h-.6a6 6 0 0 1-5-2.7l-2.6-4a1.6 1.6 0 0 1 2.6-1.8L9 15.6"/>`,
    idle: `<path d="M20 4l-.6 3.8L10 17.2 6.8 14l9.4-9.4z"/><path d="M5.5 12.7l5.8 5.8M7.6 16.4 4 20"/>`,
    // the fight modes and following: solid shapes, so they read at a glance (fill and stroke in the text's colour)
    'mode-attack': `${sword(false)}${sword(true)}`,
    'mode-balanced': `${sword(false)}<path d="M10.4 9.6 16.2 11.5v3c0 3-2.4 5-5.8 6.2-3.4-1.2-5.8-3.2-5.8-6.2v-3z" fill="#1d1c19" stroke-width="2"/>
      <path d="M10.4 9.6 16.2 11.5v3c0 3-2.4 5-5.8 6.2-3.4-1.2-5.8-3.2-5.8-6.2v-3z" fill="currentColor" fill-opacity=".3" stroke="none"/>`,
    'mode-defend': `<path d="M12 2.6 20.5 5.6v5.8c0 5.2-3.5 8.8-8.5 10.6-5-1.8-8.5-5.4-8.5-10.6V5.6z" fill="currentColor" fill-opacity=".35" stroke-width="2"/>
      <path d="M12 6.2v12.4" stroke-width="2"/>`,
    'mode-follow': `${foot(7.2, 4.5, -8)}${foot(16.4, 10.5, 8)}`,
    // small buttons
    close: `<path d="M6 6l12 12M18 6 6 18"/>`,
    plus: `<path d="M12 5.5v13M5.5 12h13"/>`,
    // things you carry: line drawings with a fill of their own colour
    health: flask(RED),
    mana: flask(BLUE),
    food: `<path d="M12 7.2c-1.7-1.3-7-1.6-7 4.6 0 4.6 2.8 9.2 5 9.2 1 0 1.3-.5 2-.5s1 .5 2 .5c2.2 0 5-4.6 5-9.2 0-6.2-5.3-5.9-7-4.6z" fill="${FOOD}"/>
      <path d="M12 7.2c0-1.9.9-3.4 2.8-4.2"/><path d="M12.4 5.4c1.2-1.3 3-1.6 4.4-1-.4 1.6-2.3 2.6-4.4 1z" fill="#6aa84f" stroke="none"/>`,
    coins: `<circle cx="12" cy="12" r="8.5" fill="${GOLD}" stroke="#7a5414"/><circle cx="12" cy="12" r="5.6" stroke="#a87420" stroke-width="1.3"/>
      <path d="M12 8.8l.95 1.95 2.15.3-1.55 1.5.37 2.13L12 13.67l-1.92 1.01.37-2.13-1.55-1.5 2.15-.3z" fill="#fff3c4" stroke="none"/>`,
    // the empty equipment slots: what goes there
    'slot-neck': `<path d="M6 3.5c0 5 2.7 9 6 9s6-4 6-9"/><path d="M12 12.5l3 3.5-3 4.5-3-4.5z"/>`,
    'slot-head': `<path d="M5.5 20V12a6.5 6.5 0 0 1 13 0v8"/><path d="M5.5 13.2h13M12 13.2V19"/>`,
    'slot-backpack': `<path d="M8 6.5V5a4 4 0 0 1 8 0v1.5"/><rect x="4.5" y="6.5" width="15" height="14.5" rx="3.5"/><path d="M8 13h8v4H8z"/>`,
    'slot-weapon': `<path d="M20 4l-.6 3.8L10 17.2 6.8 14l9.4-9.4z"/><path d="M5.5 12.7l5.8 5.8M7.6 16.4 4 20"/>`,
    'slot-body': `<path d="M8.5 3.5 4 6v6l2.5 1v7.5h11V13l2.5-1V6l-4.5-2.5c-.5 1.6-1.8 2.5-3.5 2.5s-3-.9-3.5-2.5z"/>`,
    'slot-shield': `<path d="M12 3 19.5 5.5V11c0 4.8-3.2 8.3-7.5 10-4.3-1.7-7.5-5.2-7.5-10V5.5z"/><path d="M12 3v18M4.8 11h14.4"/>`,
    'slot-ring': `<circle cx="12" cy="14.5" r="6"/><path d="M9.5 6.5l1-2.5h3l1 2.5L12 9z"/>`,
    'slot-legs': `<path d="M6.5 3.5h11L19 20.5h-4.5L12 10l-2.5 10.5H5z"/>`,
    'slot-ammo': `<path d="M4.5 19.5 19 5"/><path d="M19.5 4.5l-.7 4.2-3.5-3.5z"/><path d="M4.5 19.5h3.2M4.5 19.5v-3.2M6.7 17.3h3M6.7 17.3v-3"/>`,
    'slot-feet': `<path d="M7.5 3.5h6v9.5l5.2 2.6a2.6 2.6 0 0 1 1.3 2.3v1.6H4.5v-3.5c0-1.4.6-2.4 1.5-3.2l1.5-1.3z"/><path d="M4.5 17.5H20"/>`,
  };

  const svg = (name, colour) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${colour || 'currentColor'}" `
    + `stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.plus}</svg>`;
  return {
    names: () => Object.keys(ICONS),
    svg: name => svg(name),
    url: (name, colour = '#e9e4da') => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg(name, colour))}`,
    img(name, size = 24) {
      const wrap = document.createElement('span');
      wrap.innerHTML = svg(name);
      const el = wrap.firstChild;
      el.setAttribute('class', `icon icon-${name}`);
      el.setAttribute('width', size);
      el.setAttribute('height', size);
      el.setAttribute('aria-hidden', 'true');
      return el;
    },
  };
})();
