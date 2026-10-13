/* CribSheet service worker: caches the app shell so it opens offline. */
importScripts('version.js');
const VERSION = 'cribsheet-' + self.CRIBSHEET_VERSION.version;
const SHELL = ['./', './index.html', './app.js', './firebase-config.js', './growth-data.js', './version.js', './site.webmanifest', './brand/cribsheet-symbol-ivory.svg', './brand/fonts/cribsheet-nunito-bold.woff2', './brand/cardone-horizontal-white.svg', './favicon.ico', './favicon.svg', './favicon-192.png', './favicon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', ev => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== 'GET') return;
  const sameOrigin = url.origin === location.origin;
  const firebaseSdk = url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
  if (!sameOrigin && !firebaseSdk) return; // let Firestore and auth traffic through untouched
  if (sameOrigin) {
    // network first so updates land quickly, cache as the offline fallback
    ev.respondWith(fetch(ev.request, { cache: 'no-cache' }).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(ev.request, copy)); return res; })
      .catch(() => caches.match(ev.request).then(r => r || (ev.request.mode === 'navigate' ? caches.match('./index.html') : undefined))));
  } else {
    // SDK files are versioned, so cache first
    ev.respondWith(caches.match(ev.request).then(r => r || fetch(ev.request).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(ev.request, copy)); return res; })));
  }
});
