'use strict';
// The phone's chat line (browser only): one line under the action bar showing the newest message of the log, as it
// comes. After a few quiet seconds it fades back (it stays readable, only dimmer); tap it to open the whole chat with
// its history. It only reads the log (#log, filled by game-ui.js), so the chat itself and what it keeps are unchanged.
// mobile-hud.js puts it in the action bar; the bar is a line taller for it, so a message never pushes anything up.
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
    if (log.lastElementChild) show(log.lastElementChild);
    // every new line of the log, as it comes
    new MutationObserver(list => {
      for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1) show(n);
    }).observe(log, { childList: true });
  }

  return { attach, show };
})();
