'use strict';
// On a phone or tablet the game is played as an app from the home screen, not in the browser: there it has the whole
// screen, keeps upright (Android; on an iPhone the "turn it upright" note in css/phone/theme.css does it) and isn't
// lost among the browser's tabs. Opened in a browser, this page shows how to add it instead of the game.
// (Computers play in the browser as always. Browser tests are let through: navigator.webdriver.)
(() => {
  // the app's service worker (sw.js): with it a phone's browser offers to install the game (Android's Install button)
  if ('serviceWorker' in navigator && isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => { /* not this time */ });
  const ua = navigator.userAgent;
  // a phone or tablet: by its name, or by having only a finger to point with. (Samsung's browser was let through: a Galaxy
  // with a pen says it has a fine pointer, and in its desktop mode it calls itself a Linux computer, but with a touch screen.)
  const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
  const handheld = /Android|iPhone|iPad|iPod|Mobile|SamsungBrowser/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) || (/Linux/.test(ua) && !/Windows/.test(ua) && navigator.maxTouchPoints > 1);
  const app = navigator.standalone === true || ['standalone', 'fullscreen', 'minimal-ui'].some(m => matchMedia(`(display-mode: ${m})`).matches);
  if (!(touchOnly || handheld) || app || navigator.webdriver) return;
  const samsung = /SamsungBrowser/.test(ua);
  const ios = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const inApp = /FBAN|FBAV|Instagram|Line\/|WhatsApp|Snapchat|GSA\//.test(ua); // (a link opened inside another app)
  document.documentElement.classList.remove('booting'); // (the page is shown: this is all it shows)
  document.documentElement.classList.add('install-gate');
  const share = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 15V3m0 0L8 7m4-4 4 4M7 10H5v11h14V10h-2"/></svg>';
  const plus = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const steps = inApp
    ? ['Open this page in <b>Safari</b> (or Chrome) first: tap the menu of this app and choose <b>Open in browser</b>.', 'Then add it to your home screen from there.']
    : ios
      ? [`In <b>Safari</b>, tap <b>Share</b> ${share} in the bar at the bottom (on newer iPhones: <b>⋯</b>, then <b>Share</b>). Opened from a link in another app? Choose <b>Open in Safari</b> first.`,
        `Choose <b>Add to Home Screen</b> ${plus} (scroll down the list, or tap <b>More</b>, if you don't see it).`, 'Open <b>Lickii</b> from your home screen.']
      : samsung
        ? ['Tap the menu <b>≡</b> (bottom right).', 'Choose <b>Add page to</b>, then <b>Home screen</b> (or tap <b>Install</b> if it\'s offered).', 'Open <b>Lickii</b> from your home screen.']
        : ['Tap the browser\'s menu <b>⋮</b> (top right).', 'Choose <b>Install app</b> or <b>Add to Home screen</b>.', 'Open <b>Lickii</b> from your home screen.'];
  const gate = document.createElement('div');
  gate.id = 'installGate';
  gate.innerHTML = `
    <style>
      html.install-gate, html.install-gate body { overflow: hidden; background: #0d0c0b; }
      #installGate { position: fixed; inset: 0; z-index: 2147483647; display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 14px; padding: max(20px, env(safe-area-inset-top)) 20px calc(52px + env(safe-area-inset-bottom)); box-sizing: border-box; overflow: auto;
        background: radial-gradient(ellipse at 50% 30%, #2a2418 0%, #0d0c0b 70%); color: #efe6d2; font: 16px/1.5 Inter, system-ui, sans-serif; text-align: center; }
      #installGate img { width: min(52vw, 220px); height: auto; }
      #installGate h1 { margin: 0; font-size: 21px; font-weight: 700; color: #e8c46a; }
      #installGate p { margin: 0; max-width: 340px; color: #cbbfa6; }
      #installGate ol { margin: 0; padding: 0; list-style: none; counter-reset: step; max-width: 340px; width: 100%; }
      #installGate li { counter-increment: step; display: flex; gap: 12px; align-items: center; text-align: left; padding: 10px 12px; margin: 0 0 8px; font-size: 15px;
        border-radius: 12px; background: #1f1c16; box-shadow: inset 0 0 0 1px #3a3222; }
      #installGate li::before { content: counter(step); flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
        background: #e8c46a; color: #1b1a17; font-weight: 700; }
      #installGate li svg { vertical-align: -5px; color: #6fb2ff; }
      #installGate button { min-height: 48px; padding: 0 28px; border: 0; border-radius: 12px; background: linear-gradient(#f0cf78, #c9a24a); color: #1b1a17;
        font: 700 17px Inter, system-ui, sans-serif; }
      #installGate .down { position: fixed; bottom: max(6px, env(safe-area-inset-bottom)); left: 50%; margin-left: -18px; width: 36px; height: 36px; color: #e8c46a;
        animation: gate-bob 1s ease-in-out infinite; pointer-events: none; }
      @keyframes gate-bob { 50% { transform: translateY(8px); } }
    </style>
    <img src="sprites/ui/loading/logo.png" alt="Lickii Adventures">
    <h1>Play Lickii Adventures as an app</h1>
    <p>On a phone the game is played from your home screen: the whole screen for the game, and it stays upright.</p>
    <button id="installNow" hidden>Install Lickii</button>
    <ol>${steps.map(s => `<li><span>${s}</span></li>`).join('')}</ol>
    ${ios && !inApp ? '<svg class="down" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v16m0 0-6-6m6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}`;
  document.body.prepend(gate);
  // Android's own install button, where the browser offers one
  addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    const b = document.getElementById('installNow');
    b.hidden = false;
    b.onclick = () => { e.prompt(); };
  });
  // (installed and opened from the home screen in this same tab, as Android can: on with the game)
  matchMedia('(display-mode: standalone)').addEventListener('change', m => { if (m.matches) location.reload(); });
})();
