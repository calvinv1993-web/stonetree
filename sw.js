'use strict';
// The app's service worker: what lets a phone's browser offer "Install SORTIA" (Android's own install button,
// js/install-gate.js). It keeps nothing: every request goes to the network as before (the server's ETags and the
// pictures' versions still decide what is fetched again).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request));
});
