const CACHE_NAME = 'kostky-cache-v1.6';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  './style-dark.css',
  './style-light.css',
  './script.js',
  './rules.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
