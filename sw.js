// Nova Browser — service worker
// Caches the app shell so Nova itself still opens offline / on a flaky
// connection. Does NOT cache anything fetched from other websites (page
// navigations inside the app's own iframes/videos, CORS-proxy requests,
// video streams, etc.) — only this app's own files.
const CACHE_NAME = 'nova-browser-v1.8';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only handle GET requests for this app's own origin — everything else
  // (video streams, CORS-proxy calls, other sites loaded in a tab) passes
  // straight through to the network untouched.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      // Serve cache immediately if we have it (fast repeat opens), refresh
      // it in the background — falls back to network-only on a first visit.
      return cached || network;
    })
  );
});
