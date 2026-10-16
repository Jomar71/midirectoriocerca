/* public/sw.js — Service Worker básico para PWA (vista móvil tipo app) */
const CACHE = 'directoriocerca-v1';
const PRECACHE = ['/', '/css/styles.css', '/manifest.webmanifest', '/img/placeholder.jpg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;       // no cachea externos
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return; // nunca cachea datos/panel

  // Estrategia: red primero, caché como respaldo (para estáticos).
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (['style', 'script', 'image', 'font'].includes(request.destination)) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(request).then((r) => r || caches.match('/')))
  );
});
