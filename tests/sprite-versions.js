'use strict';
// Writes sprites/versions.js: a short fingerprint of every picture in sprites/ (its contents), so the game asks for
// each picture by its own version (sprites/x.png?h=...) instead of the page's. An update then fetches only the pictures
// that really changed; the others stay in the browser's cache.
//   node tests/sprite-versions.js          (after adding or changing pictures; the unit tests check it's up to date)
// versions() is also used by tests/unit.test.js to compare.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SPRITES = path.join(__dirname, '..', 'sprites');
const OUT = path.join(SPRITES, 'versions.js');

// every picture (and piece of music) under sprites/, by its path from there with forward slashes (as the game names them)
function versions() {
  const out = {};
  for (const rel of fs.readdirSync(SPRITES, { recursive: true }).map(String).sort()) {
    if (!/\.(png|webp|jpe?g|mp3)$/i.test(rel)) continue; // (and the music)
    const name = rel.split(path.sep).join('/');
    if (name.startsWith('templates/') || name === 'baked-ground.png') continue; // (guides for drawing; the baked ground has its own)
    out[name] = crypto.createHash('sha1').update(fs.readFileSync(path.join(SPRITES, rel))).digest('hex').slice(0, 10);
  }
  return out;
}

const text = v => "'use strict';\n// Made by tests/sprite-versions.js: each picture's own version (a fingerprint of its contents). Don't edit.\n"
  + `const SPRITE_HASHES = ${JSON.stringify(v, null, 0).replace(/,"/g, ',\n  "').replace(/^\{/, '{\n  ').replace(/\}$/, ',\n}')};\n`;

if (require.main === module) {
  const v = versions();
  fs.writeFileSync(OUT, text(v));
  console.log(`Wrote ${path.relative(process.cwd(), OUT)}: ${Object.keys(v).length} pictures.`);
}

module.exports = { versions, OUT };
