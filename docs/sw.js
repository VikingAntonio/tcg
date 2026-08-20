const STATIC_CACHE = 'viking-static-v23';
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
  './binders.html',
  './inversiones.html',
  './carrito.html',
  './perfil.html',
  './scanner.html',
  './play.html',
  './eventos.html',
  './claim.html',
  './clientes.html',
  './tracking.html',
  './toonstore.html',
  './build.html',
  './adminClaim.html',
  './subastas.html',
  './users.html',
  './reset-password.html',
  './codigo.html',
  './404.html',
  './cerezo.png',
  './vikingdev.png',
  './favi.png',
  './css/style.css',
  './css/style2.css',
  './css/claim.css',
  './css/animacionesdeseos.css',
  './css/subastas_v2.css',
  './css/cards.css',
  './css/inversiones.css',
  './css/barajaryg.css',
  './css/build.css',
  './css/global.css',
  './js/app.js',
  './js/admin.js',
  './js/utils.js',
  './js/supabase-config.js',
  './js/cart.js',
  './js/turn.js',
  './js/ztext.js',
  './js/michatbot.js',
  './js/inversiones.js',
  './js/admin_deseos.js',
  './js/animacionesdeseos.js',
  './js/productoSellado.js',
  './js/preventas.js',
  './js/subastas_v2.js',
  './js/viking-data.js',
  './js/cloudinary-upload.js',
  './js/loading3d.js',
  './js/landing2.js',
  './js/adminClaim.js',
  './js/binders.js',
  './js/build.js',
  './js/claim.js',
  './js/clientes.js',
  './js/deseos.js',
  './js/eventos.js',
  './js/expansiones.js',
  './js/fast-mode.js',
  './js/perfil.js',
  './js/scanner.js',
  './js/subastas.js',
  './js/tracking.js',
  'https://code.jquery.com/jquery-3.6.0.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css',
  'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js',
  'https://cdn.jsdelivr.net/npm/swiper@9/swiper-bundle.min.css',
  'https://cdn.jsdelivr.net/npm/swiper@9/swiper-bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.6/Sortable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install Event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      console.log('[Service Worker] Caching all assets');
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
            if (networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
              // Fail silently for images
          });
        });
      })
    );
    return;
  }

  // 2. Strategy: Supabase Data Handling
  if (url.hostname.includes('supabase.co')) {
    // If it's a mutation (POST, PUT, DELETE, PATCH), fetch from network.
    // We no longer clear DATA_CACHE here to ensure offline availability of previously fetched data.
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(event.request.method)) {
      event.respondWith(fetch(event.request));
      return;
    }

    // Network-First for GET requests to ensure latest data when online
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(DATA_CACHE).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // 3. Navigation Fallback for store IDs (e.g., /toonShop)
  if (event.request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Priority for admin.html to support PWA offline admin usage
        return caches.match('./admin.html') || caches.match('./public.html') || caches.match('./index.html');
      })
    );
    return;
  }

  // 4. Strategy: Network-First for local assets (HTML, JS, CSS)
  // This ensures that when online, the user always sees the latest UI.
  // When offline, it falls back to the static cache.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(STATIC_CACHE).then(cache => {
                  cache.put(event.request, responseClone);
              });
          }
          return networkResponse;
        })
        .catch(() => {
            return caches.match(event.request);
        })
    );
    return;
  }
});
