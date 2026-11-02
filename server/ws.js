'use strict';
// A minimal WebSocket server side (RFC 6455): text messages, ping/pong and close.
// Enough for the game, without any dependencies.

const crypto = require('crypto');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_MESSAGE = 1 << 20;

// Upgrade an HTTP request to a WebSocket. Returns { send(text), close(), onmessage, onclose }.
function acceptWebSocket(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return null;
  }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept}`, '', ''].join('\r\n'));
  socket.setNoDelay(true);

  const ws = { open: true, onmessage: null, onclose: null, send, close };
  let buffer = Buffer.alloc(0), fragments = [], fragmentBytes = 0;

  function frame(opcode, payload) {
    let header;
    if (payload.length < 126) header = Buffer.from([0x80 | opcode, payload.length]);
    else if (payload.length < 65536) {
      header = Buffer.alloc(4);
      header[1] = 126;
      header.writeUInt16BE(payload.length, 2);
    } else {
      header = Buffer.alloc(10);
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(payload.length), 2);
    }
    header[0] = 0x80 | opcode;
    return Buffer.concat([header, payload]);
  }
  function send(text) {
    if (ws.open) socket.write(frame(1, Buffer.from(text)));
  }
  function close() {
    if (!ws.open) return;
    ws.open = false;
    try {
      socket.end(frame(8, Buffer.alloc(0)));
    } catch (e) { /* already gone */ }
  }

  socket.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const fin = buffer[0] & 0x80, opcode = buffer[0] & 0x0f, masked = buffer[1] & 0x80;
      let len = buffer[1] & 0x7f, offset = 2;
      if (len === 126) {
        if (buffer.length < 4) return;
        len = buffer.readUInt16BE(2);
        offset = 4;
      } else if (len === 127) {
        if (buffer.length < 10) return;
        len = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }
      if (len > MAX_MESSAGE) return close();
      const maskLen = masked ? 4 : 0;
      if (buffer.length < offset + maskLen + len) return;
      const payload = Buffer.from(buffer.subarray(offset + maskLen, offset + maskLen + len));
      if (masked) for (let i = 0; i < payload.length; i++) payload[i] ^= buffer[offset + (i & 3)];
      buffer = buffer.subarray(offset + maskLen + len);
      if (opcode === 8) return close();
      if (opcode === 9) socket.write(frame(10, payload)); // ping -> pong
      else if (opcode === 0 || opcode === 1) {
        fragments.push(payload);
        fragmentBytes += payload.length;
        if (fragmentBytes > MAX_MESSAGE) return close(); // a message in many pieces is still one message
        if (fin) {
          const text = Buffer.concat(fragments).toString('utf8');
          fragments = [];
          fragmentBytes = 0;
          if (ws.onmessage) ws.onmessage(text);
        }
      }
    }
  });
  const gone = () => {
    ws.open = false;
    const cb = ws.onclose;
    ws.onclose = null;
    if (cb) cb();
  };
  socket.on('close', gone);
  socket.on('error', gone);
  return ws;
}

module.exports = { acceptWebSocket };
