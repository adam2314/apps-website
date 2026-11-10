/* Offline support: cache the app shell, serve cache-first, refresh in the background. */
const VERSION = 'shine-time-v4';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './vendor/three.module.min.js',
  './js/main.js',
  './js/game.js',
  './js/ui.js',
  './js/input.js',
  './js/world.js',
  './js/carModel.js',
  './js/merge.js',
  './js/washSurface.js',
  './js/tools3d.js',
  './js/fx.js',
  './js/textures.js',
  './js/audio.js',
  './js/icons.js',
  './js/data.js',
  './js/util.js',
  './js/i18n.js',
  './js/offline.js',
  './fonts/fredoka-hebrew.woff2',
  './fonts/fredoka-latin.woff2',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
