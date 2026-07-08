// ============================================================
// sw.js – Service Worker
// Network-first per file same-origin; mai cachat le API esterne
// ============================================================

const CACHE_NAME = 'pantrypost-v3';

const PRECACHE_URLS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/dispensa.js',
  './js/lista-spesa.js',
  './js/consumati.js',
  './js/ricette.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Install: pre-cacha le risorse statiche
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: rimuovi cache vecchie
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first solo per risorse same-origin
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Lascia passare senza intercettare le chiamate API esterne
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Aggiorna cache con la risposta fresca
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline: servi dalla cache
        return caches.match(event.request);
      })
  );
});
