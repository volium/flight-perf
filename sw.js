const CACHE_VERSION = 'flightperf-v2';

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
  './js/ui/fleet.js',
  './js/ui/density-altitude.js',
  './js/ui/crosswind.js',
  './js/ui/takeoff.js',
  './js/ui/landing.js',
  './js/ui/climb.js',
  './js/ui/cruise.js',
  './js/ui/weight-balance.js',
  './js/ui/fuel.js',
  './js/ui/perf-ui-common.js',
  './js/calc/density-altitude.js',
  './js/calc/crosswind.js',
  './js/calc/takeoff.js',
  './js/calc/landing.js',
  './js/calc/climb.js',
  './js/calc/cruise.js',
  './js/calc/weight-balance.js',
  './js/calc/fuel.js',
  './js/engine/units.js',
  './js/engine/margins.js',
  './js/engine/perf-common.js',
  './js/engine/interpolation.js',
  './js/data/fuel-types.js',
  './js/data/profile-loader.js',
  './js/data/profile-validator.js',
  './js/data/profile-merger.js',
  './js/data/profile-migrator.js',
  './js/data/db.js',
  './js/data/storage.js',
  './js/data/unit-preferences.js',
  './profiles/sling-lsa.json',
  './profiles/types/sling-lsa.json',
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
