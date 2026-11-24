const STATIC_CACHE = 'viking-static-v265';
const IMAGE_CACHE = 'viking-images-v1';
const DATA_CACHE = 'viking-data-v1';

const URLS_TO_CACHE = [
  './',
  './accesorios.html',
  './js/tcg-purchase-anim.js',
  './custom.html',
  './js/custom.js',
  './index.html',
  './admin.html',
  './public.html',
  './learn.html',
  './widgets.html',
  './packages.html',
  './session-bridge.html',
  './js/viking-widget.js',
  './js/model-optimizer.js',
  './js/model-optimizer.worker.js',
  './wanted.html',
  './deseos.html',
  './preventas.html',
  './productoSellado.html',
  './binders.html',
  './inversiones.html',
  './carrito.html',
  './perfil.html',
  './mis-compras.html',
  './css/mis-compras.css',
  './js/mis-compras.js',
  './scanner.html',
  './play.html',
  './eventos.html',
  './claim.html',
  './clientes.html',
  './tracking.html',
  './toonstore.html',

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
  './css/public-inversiones.css',
  './css/public-binders.css',
  './css/barajaryg.css',
  './css/build.css',
  './css/global.css',
  './js/app.js',
  './js/public-binders.js',
  './js/admin.js',
  './js/utils.js',
  './js/supabase-config.js',
  './js/cart.js',
  './js/turn.js',
  './js/ztext.js',
  './js/michatbot.js',
  './js/michatbot-mobile3d.js',
  './js/notifications.js',
  './js/inversiones.js',
  './js/admin_deseos.js',
  './js/animacionesdeseos.js',
  './js/productoSellado.js',
  './js/preventas.js',
  './js/subastas_v2.js',
  './js/viking-data.js',
  './js/media-upload.js',
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
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js'
];

// Install Event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      console.log('[Service Worker] Caching all assets');
      // cache.addAll() rejects the whole install if ANY url 404s, which left the
      // service worker permanently uninstalled (and therefore nothing cached).
      // Add entries individually and tolerate the ones that fail.
      return Promise.all(URLS_TO_CACHE.map(url =>
        cache.add(url).catch(err => console.warn('[Service Worker] Skipped', url, err && err.message))
      ));
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
  // Includes the 3D model payloads: a .gltf references sibling .bin buffers and
  // textures, and those used to fall through to Supabase's network-first branch,
  // so the heavy assistant model re-downloaded on every navigation (very slow on
  // mobile). Caching them here keeps the companion instant after first load.
  const isModelAsset = /\.(jpg|jpeg|png|gif|webp|svg|glb|gltf|bin|ktx2|basis|drc)$/.test(url.pathname);
  // Los modelos del asistente viven en el bucket `spirits` y pesan ~2.7 MB
  // (.bin) + texturas. Sin cache-first se re-descargaban en cada navegación y
  // eso inflaba el "Cached Egress" de Storage en Supabase.
  const isSpiritModel = url.pathname.includes('/storage/v1/object/public/spirits/');
  if (
    url.hostname.includes('cloudinary.com') ||
    url.hostname.includes('tcgplayer-cdn.tcgplayer.com') ||
    url.hostname.includes('images.tcgplayer.com') ||
    url.hostname.includes('tcgdex.net') ||
    url.hostname.includes('github.io') ||
    url.hostname.includes('ajax.googleapis.com') ||
    isSpiritModel ||
    isModelAsset
  ) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(cache => {
        return cache.match(event.request).then(response => {
          if (response) return response;
          return fetch(event.request).then(networkResponse => {
            if (networkResponse.status === 200) {
              // Algunas respuestas cross-origin no son almacenables; que eso
              // no rompa la petición original.
              cache.put(event.request, networkResponse.clone()).catch(() => {});
            }
            return networkResponse;
          }).catch(() => {
              // Sin red y sin caché: deja que el visor muestre su error.
              return Response.error();
          });
        });
      })
    );
    return;
  }

  // 2. Strategy: Supabase Data Handling
  if (url.hostname.includes('supabase.co')) {
    // Auth responses and the profile row are never cached: serving a stale
    // token/profile from the SW is what kept an old `selected_spirit_id` alive
    // after a transient failure. The app has its own explicit offline fallbacks
    // (tcg_session / viking_cached_spirit).
    if (url.pathname.includes('/auth/v1/') || /\/rest\/v1\/usuarios$/.test(url.pathname)) {
      event.respondWith(fetch(event.request));
      return;
    }

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
