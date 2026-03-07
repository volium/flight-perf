const CACHE_VERSION = 'flightperf-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/variables.css',
  './css/main.css',
  './css/responsive.css',
  './js/app.js',
  './js/ui/tabs.js',
  './js/ui/settings.js',
  './js/ui/density-altitude.js',
  './js/calc/density-altitude.js',
  './js/engine/units.js',
  './js/data/fuel-types.js',
  './js/data/profile-loader.js',
  './js/data/storage.js',
  './profiles/sling-lsa.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((cached) => cached || fetch(event.request)),
  );
});
