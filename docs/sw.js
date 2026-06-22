const CACHE_NAME = 'viking-v2';
const DATA_CACHE = 'viking-data-v2';
const IMAGE_CACHE = 'viking-images-v1';

const URLS_TO_CACHE = [
  './',
  './index.html',
  './admin.html',
  './public.html',
  './deseos.html',
  './binders.html',
  './inversiones.html',
  './carrito.html',
  './css/style.css',
  './css/style2.css',
  './js/app.js',
  './js/admin.js',
  './js/utils.js',
  './js/supabase-config.js',
  './favi.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME && key !== DATA_CACHE && key !== IMAGE_CACHE) {
          return caches.delete(key);
        }
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Supabase Data (Network-First)
  if (url.hostname.includes('supabase.co')) {
    // Mutations: Network Only + Clear Cache
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(event.request.method)) {
      event.respondWith(
        fetch(event.request).then(async response => {
          if (response.ok) {
            await caches.delete(DATA_CACHE);
          }
          return response;
        })
      );
      return;
    }

    // GET requests: Network First
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(DATA_CACHE).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. External Images (Cache-First)
  if (
    url.hostname.includes('cloudinary.com') ||
    url.hostname.includes('tcgplayer') ||
    url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(IMAGE_CACHE).then(cache => cache.put(event.request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // 3. Local Assets (Stale-While-Revalidate)
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networked = fetch(event.request).then(response => {
        if (response.status === 200 && url.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => {
          // Silent fail
      });
      return cached || networked;
    })
  );
});
