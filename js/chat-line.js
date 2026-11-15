'use strict';
// The phone's chat line (browser only): one line under the action bar showing the newest message of the log, as it
// comes. After a few quiet seconds it fades back (it stays readable, only dimmer); tap it to open the whole chat with
// its history. It only reads the log (#log, filled by game-ui.js), so the chat itself and what it keeps are unchanged.
// mobile-hud.js puts it in the action bar; the bar is a line taller for it, so a message never pushes anything up.
// The open chat lies above the action bar (which stays, its smart button closing the chat: smart-button.js), with a tab
// on its top edge (tap it or swipe it down to close) and a send button beside the line you type in.
const ChatLine = (() => {
  const QUIET = 6000; // ms after the newest message before the line fades back
  let el = null, text = null, timer = 0;

  // A log line as one line of text: its time, then what was said (a speaker's name in bold stays in front)
  function show(line) {
    if (!el || !line || !line.textContent) return;
    const time = line.querySelector('.time');
    text.replaceChildren();
    if (time) text.append(Object.assign(document.createElement('span'), { className: 'chat-line-time', textContent: time.textContent.trim() }), ' ');
    for (const node of line.childNodes) if (node !== time) text.append(node.cloneNode(true));
    el.className = `chat-line ${line.className || ''}`;
    // its icon: a drop for a word about mana, else a speech bubble
    const icon = /\bmana\b/i.test(line.textContent) ? 'drop' : 'chat';
    if (el.dataset.icon !== icon) { el.dataset.icon = icon; el.firstChild.replaceWith(Icons.img(icon, 18)); }
    el.classList.add('fresh');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('fresh'), QUIET);
  }

  function attach(parent) {
    const log = document.getElementById('log');
    if (!parent || !log || el) return;
    el = document.createElement('button');
    el.id = 'chatLine';
    el.className = 'chat-line';
    el.title = 'Open the chat';
    text = document.createElement('span');
    text.className = 'chat-line-text';
    el.append(Icons.img('chat', 18), text);
    el.addEventListener('click', () => { if (typeof closeSheet === 'function') closeSheet(); setChat(true); });
    parent.appendChild(el);
    dress();
    if (log.lastElementChild) show(log.lastElementChild);
    // every new line of the log, as it comes
    new MutationObserver(list => {
      for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1) show(n);
    }).observe(log, { childList: true });
  }

  // The open chat's tab on its top edge, and a send button by its input
  function dress() {
    const consoleEl = document.querySelector('.console'), input = document.getElementById('chat');
    if (!consoleEl || !input || document.getElementById('chatTab')) return;
    const tab = document.createElement('button');
    tab.id = 'chatTab'; tab.className = 'drawer-tab chat-tab'; tab.title = 'Close the chat (or swipe down)'; tab.setAttribute('aria-label', 'Close the chat');
    tab.innerHTML = '<svg viewBox="0 0 24 12" class="drawer-chevrons"><path d="M5 2l7 5 7-5M5 6l7 5 7-5"/></svg>';
    let y0 = null;
    tab.addEventListener('pointerdown', e => { e.preventDefault(); y0 = e.clientY; tab.setPointerCapture(e.pointerId); });
    tab.addEventListener('pointerup', e => { if (y0 !== null && (e.clientY - y0 > 20 || Math.abs(e.clientY - y0) < 10)) setChat(false); y0 = null; });
    consoleEl.prepend(tab);
    const row = document.createElement('div'), send = document.createElement('button');
    row.className = 'chat-input-row';
    send.id = 'chatSend'; send.className = 'chat-send'; send.title = 'Say it'; send.setAttribute('aria-label', 'Send');
    send.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg>'; // an arrow up, as in a chat app
    send.addEventListener('pointerdown', e => e.preventDefault()); // (the keyboard stays up)
    send.addEventListener('click', () => sendChat(true));
    input.replaceWith(row); row.append(input, send);
  }

  return { attach, show, dress };
})();
