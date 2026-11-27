// Service Worker del modo sin conexión.
//
// Se registra solo para /offline/, así que no interfiere con el sw.js del
// sitio principal. Sirve dos cosas:
//   - el "caparazón" de la app (HTML, CSS, JS, fuentes) desde Cache Storage;
//   - las imágenes de las cartas, guardadas por la sincronización.
importScripts('/offline/js/offline-version.js');
const SHELL_VERSION = self.OFFLINE_SHELL_VERSION;
const META_CACHE = 'viking-offline-meta';
const SHELL_CACHE = 'viking-offline-shell-v1';
const IMAGE_CACHE = 'viking-offline-images-v1';
const CACHE_PREFIX = 'viking-offline-';

const PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420">
<rect width="300" height="420" rx="12" fill="#111827" stroke="#374151" stroke-width="3"/>
<rect x="24" y="24" width="252" height="372" rx="8" fill="#1f2937" stroke="#4b5563" stroke-width="2"/>
<text x="150" y="200" font-family="Arial, sans-serif" font-size="20" fill="#9ca3af" text-anchor="middle">Imagen no</text>
<text x="150" y="228" font-family="Arial, sans-serif" font-size="20" fill="#9ca3af" text-anchor="middle">descargada</text>
<text x="150" y="270" font-family="Arial, sans-serif" font-size="14" fill="#6b7280" text-anchor="middle">Sincroniza con internet</text>
</svg>`;

function placeholderResponse() {
    return new Response(PLACEHOLDER, {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' }
    });
}

// Debe coincidir con imageTarget() de offline-sync.js.
function imageCandidates(rawUrl) {
    const candidates = [rawUrl];
    try {
        const parsed = new URL(rawUrl);
        const host = parsed.hostname.toLowerCase();

        if (host === 'images.ygoprodeck.com') {
            const m = parsed.pathname.match(/\/images\/(cards(?:_small|_cropped)?)\/([^/]+)$/);
            if (m) {
                const file = m[2];
                candidates.unshift(
                    `https://images.ygoprodeck.com/images/cards/${file}`,
                    `https://images.ygoprodeck.com/images/cards_small/${file}`,
                    `https://images.ygoprodeck.com/images/cards_cropped/${file}`
                );
            }
        }

        if (host === 'assets.tcgdex.net') {
            const m = parsed.pathname.match(/^(.*\/)(high|low)\.(webp|png|jpg)$/);
            if (m) {
                candidates.unshift(
                    `${parsed.origin}${m[1]}low.${m[3]}`,
                    `${parsed.origin}${m[1]}high.${m[3]}`
                );
            }
        }

        if (host === 'res.cloudinary.com' && parsed.pathname.includes('/image/upload/')) {
            const uploadIdx = parsed.pathname.indexOf('/image/upload/');
            const cloudPath = parsed.pathname.slice(0, uploadIdx);
            const rest = parsed.pathname.slice(uploadIdx + '/image/upload/'.length);
            const segments = rest.split('/');
            const first = segments[0] || '';
            const isTransform = segments.length > 1 && (/^[a-z]{1,3}_/i.test(first) || first.includes(','));
            const publicId = (isTransform ? segments.slice(1).join('/') : rest).replace(/^v\d+\//, '');
            candidates.push(`${parsed.origin}${cloudPath}/image/upload/${publicId}`);
        }
    } catch (e) { /* URL inválida */ }
    return candidates;
}

const SHELL_PREFIXES = ['/offline/', '/js/', '/css/', '/img/', '/images/'];
const SHELL_FILES = ['/favi.png'];

function isShellRequest(url) {
    if (url.origin !== self.location.origin) return false;
    return SHELL_FILES.includes(url.pathname) || SHELL_PREFIXES.some(p => url.pathname.startsWith(p));
}

function isImageRequest(request, url) {
    if (request.destination === 'image') return true;
    if (/\.(jpe?g|png|webp|gif|avif|bmp|svg)(\?|$)/i.test(url.pathname)) return true;
    return ['images.ygoprodeck.com', 'assets.tcgdex.net', 'res.cloudinary.com', 'images.tcgplayer.com']
        .includes(url.hostname.toLowerCase());
}

// Las imágenes viven en IndexedDB (ver js/offline-db.js): el Service Worker del
// sitio borra las cachés que no conoce y se llevaría por delante la copia.
const MEDIA_DB = 'viking-offline';
const MEDIA_STORE = 'images';

function readImageBlob(key) {
    return new Promise(resolve => {
        let request;
        try {
            request = indexedDB.open(MEDIA_DB, 2);
        } catch (e) {
            resolve(null);
            return;
        }
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
            if (!db.objectStoreNames.contains('tables')) db.createObjectStore('tables');
            if (!db.objectStoreNames.contains(MEDIA_STORE)) db.createObjectStore(MEDIA_STORE);
        };
        request.onerror = () => resolve(null);
        request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(MEDIA_STORE)) {
                resolve(null);
                return;
            }
            let get;
            try {
                get = db.transaction(MEDIA_STORE, 'readonly').objectStore(MEDIA_STORE).get(key);
            } catch (e) {
                resolve(null);
                return;
            }
            get.onsuccess = () => resolve(get.result || null);
            get.onerror = () => resolve(null);
        };
    });
}

async function matchImage(cache, rawUrl) {
    for (const key of imageCandidates(rawUrl)) {
        const hit = await cache.match(key);
        if (hit) return hit;
        const blob = await readImageBlob(key);
        if (blob) {
            return new Response(blob, {
                headers: { 'Content-Type': blob.type || 'image/webp', 'Cache-Control': 'no-store' }
            });
        }
    }
    return null;
}

async function imageResponse(event, url) {
    const cache = await caches.open(IMAGE_CACHE);
    const cached = await matchImage(cache, event.request.url);
    if (cached) return cached;
    if (!self.navigator.onLine) return placeholderResponse();
    try {
        return await fetch(event.request);
    } catch (e) {
        return placeholderResponse();
    }
}

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(SHELL_CACHE);
        const core = ['/offline/', '/offline/index.html', '/offline/offline.css'];
        await Promise.all(core.map(async url => {
            try {
                const res = await fetch(url, { cache: 'no-cache' });
                if (res.ok) await cache.put(url, res);
            } catch (e) { /* se reintenta al sincronizar */ }
        }));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names
            .filter(name => name.startsWith(CACHE_PREFIX) && name !== SHELL_CACHE && name !== IMAGE_CACHE && name !== META_CACHE)
            .map(name => caches.delete(name)));

        const meta = await caches.open(META_CACHE);
        const stored = await meta.match('/shell-version');
        const storedVersion = stored ? await stored.text() : '';
        if (storedVersion !== SHELL_VERSION) {
            // Archivos nuevos de la app: se rellenan en la próxima sincronización.
            await caches.delete(SHELL_CACHE);
            await meta.put('/shell-version', new Response(SHELL_VERSION));
        }

        await self.clients.claim();
    })());
});

self.addEventListener('message', event => {
    if (!event.data) return;
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
        return;
    }
    if (event.data.type === 'PURGE_SHELL') {
        // La página detecta una versión nueva aunque este SW tenga en memoria
        // una copia vieja de offline-version.js.
        const port = event.ports && event.ports[0];
        caches.delete(SHELL_CACHE).then(() => {
            if (port) port.postMessage('ok');
        });
    }
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    let url;
    try { url = new URL(request.url); } catch (e) { return; }

    if (url.origin === self.location.origin && url.pathname.startsWith('/rest/v1')) return;

    // Las imágenes del propio sitio (reversos de carta, máscaras) viven en el
    // caparazón; solo las de fuera se buscan en la caché de imágenes.
    if (isImageRequest(request, url) && url.origin !== self.location.origin) {
        // respondWith debe llamarse en el mismo tick del evento.
        event.respondWith(imageResponse(event, url));
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            const cache = await caches.open(SHELL_CACHE);
            const cached = await cache.match(request, { ignoreSearch: true });
            if (cached) return cached;
            try {
                const response = await fetch(request);
                if (response.ok && url.origin === self.location.origin) cache.put(request, response.clone()).catch(() => {});
                return response;
            } catch (e) {
                const fallback = await cache.match('/offline/index.html');
                if (fallback) return fallback;
                return new Response('Sin conexión. Abre la app desde el acceso directo.', {
                    status: 503,
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                });
            }
        })());
        return;
    }

    if (isShellRequest(url)) {
        // La sincronización pide los archivos con cache:'reload' para traer la
        // versión nueva; si se contestara desde aquí nunca se actualizaría.
        const wantsFresh = request.cache === 'reload' || request.cache === 'no-store';
        event.respondWith((async () => {
            const cache = await caches.open(SHELL_CACHE);
            if (!wantsFresh) {
                const cached = await cache.match(request, { ignoreSearch: true });
                if (cached) return cached;
            }
            try {
                const response = await fetch(request);
                if (response.ok) cache.put(request, response.clone()).catch(() => {});
                return response;
            } catch (e) {
                return new Response('', { status: 504 });
            }
        })());
    }
});
