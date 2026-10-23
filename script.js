const CACHE = 'siagakita-v1';
const FILES = ['./', './index.html', './css/style.css', './js/app.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const salin = r.clone(); caches.open(CACHE).then(c => c.put(e.request, salin)); return r; })
      .catch(() => caches.match(e.request))
  );
});
