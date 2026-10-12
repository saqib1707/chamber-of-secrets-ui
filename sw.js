// sw.js
// Caches ONLY the app shell (the HTML/CSS/JS that make up the UI) so the app
// still opens with no signal. It never caches or intercepts calls to
// api.github.com — those always go straight to the network, since the vault
// data itself genuinely needs connectivity to fetch or save.

const CACHE_NAME = 'vault-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only ever handle same-origin GET requests for the shell. Everything else
  // (in particular all api.github.com calls, which are cross-origin) is left
  // completely untouched — no respondWith means the browser does its normal thing.
  if (req.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Network-first for the HTML shell itself, so a reconnect always picks up
  // the latest version of the app; falls back to the cached copy when offline.
  if (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for static assets (manifest, icons) — they rarely change.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
