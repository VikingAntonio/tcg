const CACHE_NAME = 'viking-tcg-v1';
const STATIC_CACHE = 'viking-static-v1';
const IMAGE_CACHE = 'viking-images-v1';
const DATA_CACHE = 'viking-data-v1';

const URLS_TO_CACHE = [
  './',
  './index.html',
  './admin.html',
  './public.html',
  './deseos.html',
  './preventas.html',
  './productoSellado.html',
  './css/style.css',
  './css/style2.css',
  './js/app.js',
  './js/admin.js',
  './js/utils.js',
  './js/supabase-config.js',
  './favi.png',
  'https://code.jquery.com/jquery-3.6.0.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Install Event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (![STATIC_CACHE, IMAGE_CACHE, DATA_CACHE].includes(cache)) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Strategy: Cache-First for Images & Models
  if (
    url.hostname.includes('cloudinary.com') ||
    url.hostname.includes('tcgplayer-cdn.tcgplayer.com') ||
    url.hostname.includes('images.tcgplayer.com') ||
    url.hostname.includes('tcgdex.net') ||
    url.hostname.includes('github.io') ||
    url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|glb|gltf)$/)
  ) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(cache => {
        return cache.match(event.request).then(response => {
          return response || fetch(event.request).then(networkResponse => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // 2. Strategy: Stale-While-Revalidate for Supabase Data
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      caches.open(DATA_CACHE).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          const fetchPromise = fetch(event.request).then(networkResponse => {
            if (event.request.method === 'GET') {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // 3. Strategy: Stale-While-Revalidate for local assets
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        // Only cache valid responses from our own origin
        if (networkResponse && networkResponse.status === 200 && url.origin === self.location.origin) {
            const responseClone = networkResponse.clone();
            caches.open(STATIC_CACHE).then(cache => {
                cache.put(event.request, responseClone);
            });
        }
        return networkResponse;
      }).catch(() => {
          // If offline and not in cache, we could return a fallback page here
      });

      return cachedResponse || fetchPromise;
    })
  );
});
