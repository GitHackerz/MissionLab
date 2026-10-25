/**
 * MissionLab Service Worker
 * Provides offline capabilities for the Mars Astronaut Mission Trainer.
 */

const CACHE_VERSION = 'missionlab-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const PRECACHE_ASSETS = [
  '/',
  '/mission',
  '/models/astronaut.glb',
  '/brand/logo-full.png',
  '/brand/logo-mark.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Precache error (non-fatal):', err);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('missionlab-') && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET requests and browser extensions / internal schemes
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // Do not intercept development hot reload or API routes that require server actions
  if (url.pathname.includes('/_next/webpack-hmr') || url.pathname.startsWith('/api/')) {
    return;
  }

  // 1. Navigation requests (HTML documents, e.g. /mission, /)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          // Offline fallback for navigation: try cached page, then fallback to cached /mission
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match('/mission');
          if (fallback) return fallback;
          return caches.match('/');
        })
    );
    return;
  }

  // 2. 3D models and static assets (Cache-first)
  if (
    url.pathname.startsWith('/models/') ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/brand/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 3. Other requests (Stale-while-revalidate)
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
