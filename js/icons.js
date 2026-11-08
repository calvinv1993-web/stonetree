'use strict';
// Tilequest's own icons for the buttons: pixel art, drawn in code like every sprite, in the game's palette
// (leather, parchment, bronze and steel, a dark outline, lit from the top left). Each is a 16x16 grid of letters, a
// letter a colour (see PALETTE; '.' is see-through), turned into a crisp picture at any size.
//   Icons.url(name, scale = 3): a data URL of the icon, for an <img> or a background
//   Icons.img(name, scale): an <img> of it

const Icons = (() => {
  const PALETTE = {
    k: '#1a1008', // outline
    // leather
    L: '#c07a3a', M: '#9a5a26', D: '#5a3214',
    // parchment and ink
    P: '#ecd9a8', p: '#c9b07a', l: '#7a5a32', R: '#a83a2a', r: '#d85a3a',
    // bronze and gold
    G: '#c8943a', H: '#f0c868', g: '#8a6420', Y: '#ffd84a', y: '#c89a28',
    // steel
    S: '#dfe3ea', s: '#9aa2ae', t: '#5a6270',
    // wood
    B: '#8a5a2e', b: '#5e3a18', W: '#b07a42',
    // map colours
    a: '#4a8a3a', c: '#3a78c0', e: '#7ab05a',
    // speech
    w: '#f4ead0', v: '#c8b890',
    // gems and glow
    q: '#6ad0ff', Q: '#2a7ab0', o: '#ff8a3a',
  };
  const ICONS = {
    // Character: a leather backpack with a gold buckle
    character: [
      '......kkkk......',
      '.....kDDDDk.....',
      '....kDk..kDk....',
      '...kkkkkkkkkk...',
      '..kLLLLLLLLLLk..',
      '..kLMMMMMMMMDk..',
      '..kLMkkkkkkMDk..',
      '..kLMkYYYykMDk..',
      '..kLMkkYykkMDk..',
      '..kLMMMMMMMMDk..',
      '.kkLMMMMMMMMDkk.',
      '.kDkLMMMMMMDkDk.',
      '.kDkLMMMMMMDkDk.',
      '.kkkDDDDDDDDkkk.',
      '...kkkkkkkkkk...',
      '................',
    ],
    // Quests: a scroll, sealed in red
    quests: [
      '................',
      '..kkkkkkkkkkkk..',
      '.kpPPPPPPPPPPpk.',
      '.kpkkkkkkkkkkpk.',
      '..kPPPPPPPPPPk..',
      '..kPllllllllPk..',
      '..kPPPPPPPPPPk..',
      '..kPllllllPPPk..',
      '..kPPPPPPPPPPk..',
      '..kPlllllllPPk..',
      '..kPPPPPPPkkPk..',
      '..kPllllPkRrkk..',
      '.kkkkkkkkkRRkk..',
      '.kpPPPPPPPkkPpk.',
      '..kkkkkkkkkkkk..',
      '................',
    ],
    // Map: a folded map with a river, woods, a dotted path and a red cross
    map: [
      '................',
      '.kkkkkkkkkkkkkk.',
      '.kPPPPkpppkPPPk.',
      '.kPaaPkpcckPPPk.',
      '.kPaePkpcpkPaPk.',
      '.kPPPPkpccrPaak.',
      '.klPPPkpprpPPPk.',
      '.kPlPPkprppPPPk.',
      '.kPPlPkrppkPRPk.',
      '.kPPPlrpppkRPRk.',
      '.kPPPPkpppkPRPk.',
      '.kPaaPkpcpkPPPk.',
      '.kPPPPkpccpPPPk.',
      '.kkkkkkkkkkkkkk.',
      '................',
      '................',
    ],
    // Chat: a parchment speech bubble with three dots
    chat: [
      '................',
      '...kkkkkkkkkk...',
      '..kwwwwwwwwwwk..',
      '.kwwwwwwwwwwwwk.',
      '.kwwwwwwwwwwwvk.',
      '.kwwkkwkkwkkwvk.',
      '.kwwkkwkkwkkwvk.',
      '.kwwwwwwwwwwwvk.',
      '.kwwwwwwwwwwvvk.',
      '..kvvvwwvvvvvk..',
      '...kkkvvkkkkk...',
      '.....kvvk.......',
      '.....kvk........',
      '.....kk.........',
      '................',
      '................',
    ],
    // Menu: a bronze cog
    menu: [
      '................',
      '......kkkk......',
      '...kk.kHGk.kk...',
      '..kHGkkHGkkGgk..',
      '..kGHHGGGGGGgk..',
      '...kGGGkkGGgk...',
      '.kkHGGk..kGggkk.',
      '.kHGGk....kGggk.',
      '.kGGgk....kgggk.',
      '.kkGgGk..kgggkk.',
      '...kGggkkgggk...',
      '..kGggggggggkk..',
      '..kggkkggkkggk..',
      '...kk.kggk.kk...',
      '......kkkk......',
      '................',
    ],
    // Attack: two crossed swords, gold guards, leather grips
    attack: [
      'kk............kk',
      'kSk..........kSk',
      '.kSk........kSk.',
      '..kSk......kSk..',
      '...kSs....kSs...',
      '....kSs..kSs....',
      '.....kSskSs.....',
      '......kSSk......',
      '......kSsk......',
      '.....kSkksk.....',
      '..kkkSk..kskkk..',
      '..kYYk....kYyk..',
      '...kBk....kBk...',
      '..kBk......kBk..',
      '.kYk........kyk.',
      '.kk..........kk.',
    ],
    // Talk: a bubble with an ear of gold, someone to listen to
    talk: [
      '................',
      '..kkkkkkkkkkkk..',
      '.kwwwwwwwwwwwwk.',
      '.kwkkkkkkkkwwvk.',
      '.kwwwwwwwwwwwvk.',
      '.kwkkkkkkwwwwvk.',
      '.kwwwwwwwwwwwvk.',
      '.kwkkkkkkkkwwvk.',
      '.kwwwwwwwwwwvvk.',
      '..kvvvvwwvvvvk..',
      '...kkkkvvkkkk...',
      '......kvvk......',
      '......kvk.......',
      '......kk........',
      '................',
      '................',
    ],
    // Loot: an open chest with gold heaped in it
    loot: [
      '................',
      '..kkkkkkkkkkkk..',
      '.kbBBBBBBBBBBbk.',
      '.kBkkkkkkkkkkBk.',
      '.kbkYHYYHYYykbk.',
      '.kkYYyYHYyYYykk.',
      '.kBkkkkkkkkkkBk.',
      '.kBBBBBkkBBBBBk.',
      '.kBGBBkHYkBBGBk.',
      '.kBBBBkYykBBBBk.',
      '.kBBBBBkkBBBBBk.',
      '.kBGBBBBBBBBGBk.',
      '.kbbbbbbbbbbbbk.',
      '.kkkkkkkkkkkkkk.',
      '................',
      '................',
    ],
    // Use: a hand reaching out
    use: [
      '................',
      '.......kk.......',
      '......kwwk.kk...',
      '...kk.kwwkkwwk..',
      '..kwwkkwwkkwwk..',
      '..kwwkkwwkkwwk..',
      '..kwwkkwwkkwwkk.',
      '..kwwkkwwkkwwkwk',
      '..kwwwwwwwwwwkwk',
      '.kkwwwwwwwwwwwwk',
      'kwkwwwwwwwwwwwvk',
      'kwwwwwwwwwwwwvk.',
      '.kwwwwwwwwwwvvk.',
      '..kvwwwwwwwvvk..',
      '...kvvvvvvvvk...',
      '....kkkkkkkk....',
    ],
    // Idle: a sheathed sword, nothing to do
    idle: [
      '................',
      '.......kk.......',
      '......kYYk......',
      '.....kkYykk.....',
      '....kYYyyYYk....',
      '.....kkBBkk.....',
      '......kBbk......',
      '......kBbk......',
      '.....kgggGk.....',
      '.....kgGgGk.....',
      '.....kgggGk.....',
      '.....kgGgGk.....',
      '.....kgggGk.....',
      '.....kgGgGk.....',
      '......kggk......',
      '.......kk.......',
    ],
    // Close: a cross of iron
    close: [
      '................',
      '..kk........kk..',
      '.kSSk......kSsk.',
      '.kSSSk....kSssk.',
      '..kSSSk..kSssk..',
      '...kSSSkkSssk...',
      '....kSSSSssk....',
      '.....kSSssk.....',
      '.....kSsssk.....',
      '....kSssSssk....',
      '...kSsskkSssk...',
      '..kSssk..ksstk..',
      '.kSssk....ksstk.',
      '.ksstk.....kttk.',
      '..kk........kk..',
      '................',
    ],
    // A plus, for an empty quick button
    plus: [
      '................',
      '................',
      '................',
      '......kkkk......',
      '......kHGk......',
      '......kGgk......',
      '...kkkkGgkkkk...',
      '...kHGGGGGGgk...',
      '...kGgggggggk...',
      '...kkkkGgkkkk...',
      '......kGgk......',
      '......kggk......',
      '......kkkk......',
      '................',
      '................',
      '................',
    ],
  };
  const urls = new Map();
  function draw(name, scale) {
    const grid = ICONS[name], c = document.createElement('canvas');
    c.width = c.height = 16 * scale;
    const g = c.getContext('2d');
    grid.forEach((row, y) => [...row].forEach((ch, x) => {
      const colour = PALETTE[ch];
      if (!colour) return;
      g.fillStyle = colour;
      g.fillRect(x * scale, y * scale, scale, scale);
    }));
    return c;
  }
  return {
    names: () => Object.keys(ICONS),
    url(name, scale = 3) {
      const key = `${name}:${scale}`;
      if (!urls.has(key)) urls.set(key, draw(name, scale).toDataURL());
      return urls.get(key);
    },
    img(name, scale = 3) {
      const i = new Image();
      i.src = this.url(name, scale);
      i.alt = '';
      i.className = 'icon';
      return i;
    },
  };
})();
