'use strict';
// Offline support: serve the app from the network when online (so updates show up
// right away) and fall back to the cached copy when offline.
const CACHE = 'clarity-app';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'js/util.js', 'js/store.js', 'js/ui.js', 'js/charts.js', 'js/forms.js', 'js/demo.js', 'js/app.js',
  'js/views/dashboard.js', 'js/views/transactions.js', 'js/views/accounts.js', 'js/views/budgets.js',
  'js/views/investments.js', 'js/views/recurring.js', 'js/views/categories.js', 'js/views/data.js', 'js/views/settings.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html')))
  );
});
