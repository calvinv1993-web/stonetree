'use strict';
// A tiny static web server for the browser tests: the game's pages over http://127.0.0.1, so the custom PNG
// sprites load as the game's own (over file:// the browser treats them as foreign and canvases that use
// them can't be read back). Serves only files inside the project folder.
//   const { serve } = require('./serve'); const base = await serve(); ... page.goto(`${base}/index.html`)

const http = require('http');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./harness');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };

function serve() {
  const server = http.createServer((req, res) => {
    let file;
    try { file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)); } catch (e) { res.writeHead(400); return res.end(); }
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  server.unref(); // (it never keeps a test running)
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
}

module.exports = { serve };
