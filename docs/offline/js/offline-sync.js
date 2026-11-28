// Descarga y actualización de la copia sin conexión.
//
// 1. Lee de la base de datos (API REST) las tablas que usan las vistas
//    públicas: decks, binders e inversiones.
// 2. Guarda esas filas en IndexedDB (las consulta offline-supabase.js).
// 3. Descarga las imágenes en Cache Storage, en su versión ligera.
// 4. Deja precargados el HTML, CSS, JS y fuentes de la propia app.
(function () {
    const REST = SUPABASE_URL + '/rest/v1';
    const CACHE_IMAGES = 'viking-offline-images-v1';
    const CACHE_SHELL = 'viking-offline-shell-v1';
    const SHELL_VERSION = self.OFFLINE_SHELL_VERSION || 'v1';
    const PAGE_SIZE = 1000;
    const ID_CHUNK = 45;

    const HEADERS = {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY
    };

    // Columnas legibles con la clave pública. `email` y `subscription_status`
    // no están concedidas a anon, así que no se piden.
    const STORE_COLUMNS = [
        'id', 'username', 'store_name', 'store_logo', 'is_store', 'role',
        'whatsapp_link', 'messenger_link', 'selected_spirit_id', 'max_albums',
        'auction_reset_date', 'monthly_created_count', 'monthly_bid_count',
        'allowed_spirit_ids'
    ];

    const MINIMAL_STORE_COLUMNS = ['id', 'username', 'store_name', 'store_logo', 'is_store'];

    const IMAGE_HOSTS = [
        'res.cloudinary.com', 'images.ygoprodeck.com', 'db.ygoprodeck.com',
        'assets.tcgdex.net', 'images.tcgplayer.com', 'api.pokemontcg.io',
        'images.unsplash.com', 'ms.yugipedia.com', 'cdn.jsdelivr.net',
        'i.imgur.com', 'raw.githubusercontent.com'
    ];

    const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|bmp|svg)(\?|$)/i;

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    async function restGet(path, options) {
        const opts = options || {};
        const headers = Object.assign({}, HEADERS, opts.headers || {});

        let lastError = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const res = await fetch(`${REST}/${path}`, { headers });
                if (!res.ok) {
                    let body = null;
                    try { body = await res.json(); } catch (e) { /* respuesta sin JSON */ }
                    const err = new Error((body && body.message) || `HTTP ${res.status}`);
                    err.status = res.status;
                    err.body = body;
                    throw err;
                }
                const data = await res.json();
                return { data };
            } catch (e) {
                lastError = e;
                if (e.status === 401 || e.status === 403 || e.status === 400) break;
                await sleep(400 * (attempt + 1));
            }
        }
        throw lastError;
    }

    // Descarga TODAS las filas: la API devuelve como máximo 1000 por petición.
    async function fetchAll(path, query) {
        const rows = [];
        let offset = 0;
        for (;;) {
            const q = [query, `limit=${PAGE_SIZE}`, `offset=${offset}`].filter(Boolean).join('&');
            const { data } = await restGet(`${path}?${q}`);
            if (!Array.isArray(data) || data.length === 0) break;
            rows.push(...data);
            offset += data.length;
            if (data.length < PAGE_SIZE) break;
        }
        return rows;
    }

    async function fetchByIn(table, column, ids, select) {
        if (!ids || !ids.length) return [];
        const out = [];
        for (let i = 0; i < ids.length; i += ID_CHUNK) {
            const chunk = ids.slice(i, i + ID_CHUNK);
            const list = chunk.map(v => String(v)).join(',');
            const rows = await fetchAll(table, `select=${select || '*'}&${column}=in.(${list})`);
            out.push(...rows);
        }
        return out;
    }

    // ------------------------------------------------------------ tienda
    async function resolveStore(identifier) {
        const value = String(identifier || '').trim().replace(/["']/g, '');
        if (!value) throw new Error('Falta el usuario o nombre de tienda.');

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
        const filter = isUuid
            ? `or=(id.eq."${value}",username.eq."${value}",store_name.eq."${value}")`
            : `or=(username.eq."${value}",store_name.eq."${value}")`;

        const attempts = [
            STORE_COLUMNS.join(','),
            'id,username,store_name,store_logo,is_store,role,whatsapp_link,messenger_link,selected_spirit_id,max_albums',
            MINIMAL_STORE_COLUMNS.join(',')
        ];

        let lastError = null;
        for (const cols of attempts) {
            try {
                const { data } = await restGet(`usuarios?select=${cols}&${filter}&limit=1`);
                if (data && data.length) return data[0];
                throw new Error('Tienda o usuario no encontrado.');
            } catch (e) {
                lastError = e;
            }
        }
        throw lastError || new Error('Tienda o usuario no encontrado.');
    }

    // ----------------------------------------------------------- imágenes
    function looksLikeImage(url) {
        if (typeof url !== 'string') return false;
        if (!/^https?:\/\//i.test(url)) return false;
        let host;
        try { host = new URL(url).hostname.toLowerCase(); } catch (e) { return false; }
        if (/(^|\.)supabase\.co$/.test(host)) return IMAGE_EXT.test(url) || host === 'images.tcgdex.net';
        if (IMAGE_EXT.test(url)) return true;
        return IMAGE_HOSTS.includes(host);
    }

    function collectImages(tables) {
        const urls = new Set();
        const visit = (value, depth) => {
            if (depth > 6 || value == null) return;
            if (typeof value === 'string') {
                const text = value.trim();
                if (looksLikeImage(text)) { urls.add(text); return; }
                if ((text.startsWith('{') || text.startsWith('[')) && text.length < 20000) {
                    try { visit(JSON.parse(text), depth + 1); } catch (e) { /* no era JSON */ }
                }
                return;
            }
            if (Array.isArray(value)) { value.forEach(v => visit(v, depth + 1)); return; }
            if (typeof value === 'object') {
                Object.keys(value).forEach(k => {
                    if (/gltf|model|\.bin$/i.test(k)) return;
                    visit(value[k], depth + 1);
                });
            }
        };
        Object.keys(tables).forEach(table => {
            if (table === 'spirits') return;
            (tables[table] || []).forEach(row => visit(row, 0));
        });
        return Array.from(urls);
    }

    // Devuelve la URL que conviene descargar y la clave con la que se guarda.
    // La clave es "canónica": cualquier variante que pida la app (otro ancho,
    // otra calidad) acaba sirviéndose desde la misma copia.
    //
    // `directUrl` se pide tal cual (solo funciona en servidores con CORS).
    // `sourceUrl` es la imagen original; si el servidor no permite leerla
    // desde el navegador se pide a través del proxy de imágenes, que además
    // la convierte a WebP para que ocupe menos en la tablet.
    function imageTarget(url, quality) {
        const hq = quality === 'high';
        try {
            const parsed = new URL(url);
            const host = parsed.hostname.toLowerCase();

            if (host === 'images.ygoprodeck.com') {
                const m = parsed.pathname.match(/\/images\/(cards(?:_small|_cropped)?)\/([^/]+)$/);
                if (m) {
                    const file = m[2];
                    const full = `${parsed.origin}/images/cards/${file}`;
                    return { key: full, directUrl: null, sourceUrl: full };
                }
            }

            if (host === 'assets.tcgdex.net') {
                const m = parsed.pathname.match(/^(.*\/)(high|low)\.(webp|png|jpg)$/);
                if (m) {
                    const variant = hq ? 'high' : 'low';
                    const target = `${parsed.origin}${m[1]}${variant}.${m[3]}`;
                    return { key: target, directUrl: target, sourceUrl: target };
                }
            }

            if (host === 'res.cloudinary.com' && parsed.pathname.includes('/image/upload/')) {
                const uploadIdx = parsed.pathname.indexOf('/image/upload/');
                const cloudPath = parsed.pathname.slice(0, uploadIdx);
                const rest = parsed.pathname.slice(uploadIdx + '/image/upload/'.length);
                const segments = rest.split('/');
                const first = segments[0] || '';
                const isTransform = segments.length > 1 && (/^[a-z]{1,3}_/i.test(first) || first.includes(','));
                const publicId = isTransform ? segments.slice(1).join('/') : rest;
                const cleanPublicId = publicId.replace(/^v\d+\//, '');
                const transform = hq ? 'q_auto,f_auto,w_900,c_limit' : 'f_auto,q_auto,w_450,c_limit';
                const direct = `${parsed.origin}${cloudPath}/image/upload/${transform}/${publicId}${parsed.search}`;
                return {
                    key: `${parsed.origin}${cloudPath}/image/upload/${cleanPublicId}`,
                    directUrl: direct,
                    sourceUrl: direct
                };
            }
        } catch (e) { /* URL rara: se descarga tal cual */ }

        return { key: url, directUrl: url, sourceUrl: url };
    }

    function proxyUrl(sourceUrl, quality) {
        const width = quality === 'high' ? 800 : 400;
        const q = quality === 'high' ? 80 : 72;
        return `https://wsrv.nl/?url=${encodeURIComponent(sourceUrl)}&w=${width}&output=webp&q=${q}&fit=inside`;
    }

    async function fetchReadable(target, quality) {
        if (target.directUrl) {
            try {
                const res = await fetch(target.directUrl, { mode: 'cors', credentials: 'omit' });
                if (res.ok && res.type !== 'opaque') return res;
            } catch (e) { /* sin CORS: se prueba el proxy */ }
        }
        try {
            const res = await fetch(proxyUrl(target.sourceUrl, quality), { mode: 'cors', credentials: 'omit' });
            if (res.ok && res.type !== 'opaque') return res;
        } catch (e) { /* proxy no disponible */ }
        return null;
    }

    async function downloadImages(urls, options) {
        const opts = options || {};
        const cache = await caches.open(CACHE_IMAGES);
        const force = !!opts.force;
        const quality = opts.quality || 'optimized';
        const onProgress = opts.onProgress || function () {};
        const signal = opts.signal;

        const targets = [];
        const seen = new Set();
        urls.forEach(url => {
            const target = imageTarget(url, quality);
            if (seen.has(target.key)) return;
            seen.add(target.key);
            targets.push(target);
        });

        let done = 0;
        let skipped = 0;
        let failed = 0;
        const failedUrls = [];
        const total = targets.length;

        onProgress({ phase: 'images', done: 0, total, skipped: 0, failed: 0 });

        let cursor = 0;
        let quotaError = null;
        async function worker() {
            for (;;) {
                if ((signal && signal.aborted) || quotaError) return;
                const index = cursor++;
                if (index >= targets.length) return;
                const target = targets[index];

                try {
                    if (!force) {
                        const cached = (await cache.match(target.key)) || (await OfflineDB.hasImage(target.key));
                        if (cached) {
                            skipped++;
                            done++;
                            onProgress({ phase: 'images', done, total, skipped, failed });
                            continue;
                        }
                    }

                    let response = null;
                    for (let attempt = 0; attempt < 2; attempt++) {
                        response = await fetchReadable(target, quality);
                        if (response) break;
                        await sleep(400 * (attempt + 1));
                    }

                    if (!response) throw new Error('No se pudo descargar');

                    // Solo se guardan respuestas legibles: las opacas las cuenta
                    // el navegador como ~7 MB cada una y agotan la cuota.
                    // IndexedDB y no Cache Storage: el Service Worker del sitio
                    // borra las cachés que no conoce.
                    const blob = await response.blob();
                    await OfflineDB.putImage(target.key, blob);
                } catch (e) {
                    if (e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || ''))) {
                        quotaError = e;
                    } else {
                        failed++;
                        failedUrls.push(target.sourceUrl);
                    }
                }

                done++;
                onProgress({ phase: 'images', done, total, skipped, failed });
            }
        }

        const workers = [];
        const parallel = Math.max(2, Math.min(8, opts.concurrency || 4));
        for (let i = 0; i < parallel; i++) workers.push(worker());
        await Promise.all(workers);

        if (quotaError) {
            const err = new Error('El dispositivo no tiene espacio para guardar todas las imágenes. Prueba la calidad «Optimizada» o libera espacio y vuelve a sincronizar.');
            err.code = 'QUOTA';
            err.partial = { total, skipped, failed };
            throw err;
        }

        return { total, skipped, failed, failedUrls };
    }

    // ------------------------------------------------------------- shell
    function shellAssets() {
        return [
            '/offline/',
            '/offline/index.html',
            '/offline/duel.html',
            '/offline/duelmobile.html',
            '/offline/configDuel.html',
            '/offline/configDuelMobile.html',
            '/offline/magic.html',
            '/offline/magicMobile.html',
            '/offline/configMagic.html',
            '/offline/offline.css',
            '/offline/manifest.webmanifest',
            '/offline/js/offline-version.js',
            '/offline/js/offline-db.js',
            '/offline/js/offline-supabase.js',
            '/offline/js/offline-sync.js',
            '/offline/js/offline-ui.js',
            '/offline/js/notifications.js',
            '/offline/vendor/jquery.min.js',
            '/offline/vendor/swiper-bundle.min.js',
            '/offline/vendor/swiper-bundle.min.css',
            '/offline/vendor/sweetalert2.all.min.js',
            '/offline/vendor/qrcode.min.js',
            '/offline/vendor/fonts.css',
            '/offline/vendor/fa/all.min.css',
            '/offline/vendor/fa/webfonts/fa-solid-900.woff2',
            '/offline/vendor/fa/webfonts/fa-regular-400.woff2',
            '/offline/vendor/fa/webfonts/fa-brands-400.woff2',
            '/offline/img/bocabajo.jpg',
            '/offline/img/pokeBocaAbajo.jpg',
            '/offline/img/Equip.webp',
            '/offline/img/token.png',
            '/offline/img/cosmoV2.png',
            '/offline/img/duelTerminal.png',
            '/offline/img/mascaraPB.png',
            '/offline/images/guiaPoke.png',
            '/offline/images/guiaYugi.png',
            '/offline/images/CardPokemonMask.png',
            '/offline/images/CardYugiohMask.png',
            '/favi.png',
            '/js/turn.js',
            '/js/app.js',
            '/js/utils.js',
            '/js/cart.js',
            '/js/public-binders.js',
            '/js/multiFoils.js',
            '/js/pokeballRare.js',
            '/js/duelTerminal.js',
            '/js/cosmoPaldea.js',
            '/js/market-rate.js',
            '/js/ztext.js',
            '/js/animacionesdeseos.js',
            '/js/duel.js',
            '/js/duelmobile.js',
            '/js/magic.js',
            '/css/style.css',
            '/css/cards.css',
            '/css/multiFoils.css',
            '/css/pokeballRare.css',
            '/css/duelTerminal.css',
            '/css/cosmoPaldea.css',
            '/css/barajaryg.css',
            '/css/public-inversiones.css',
            '/css/public-binders.css',
            '/css/claim.css',
            '/css/animacionesdeseos.css',
            '/css/subastas_v2.css',
            '/css/duel.css',
            '/css/duelmobile.css',
            '/css/magic.css'
        ];
    }

    // Completa la lista con lo que declaren las propias páginas (por si se
    // añaden scripts nuevos) y con las fuentes de los CSS locales.
    async function discoverShellAssets() {
        const base = shellAssets();
        const found = new Set(base);

        const pages = base.filter(u => u.startsWith('/offline/') && u.endsWith('.html'));
        for (const page of pages) {
            try {
                const res = await fetch(page, { cache: 'no-cache' });
                if (!res.ok) continue;
                const html = await res.text();
                const doc = new DOMParser().parseFromString(html, 'text/html');
                doc.querySelectorAll('script[src], link[rel="stylesheet"]').forEach(el => {
                    const raw = el.getAttribute('src') || el.getAttribute('href');
                    if (!raw || /^https?:/i.test(raw)) return;
                    try { found.add(new URL(raw, location.origin + page).pathname); } catch (e) { /* ignore */ }
                });
            } catch (e) { /* página opcional */ }
        }

        const fontCss = ['/offline/vendor/fonts.css', '/offline/vendor/fa/all.min.css'];
        for (const cssUrl of fontCss) {
            try {
                const res = await fetch(cssUrl, { cache: 'no-cache' });
                if (!res.ok) continue;
                const text = await res.text();
                const re = /url\((['"]?)([^'")]+)\1\)/g;
                let m;
                while ((m = re.exec(text))) {
                    const ref = m[2];
                    if (!ref || ref.startsWith('data:') || /^https?:/i.test(ref)) continue;
                    try { found.add(new URL(ref, location.origin + cssUrl).pathname); } catch (e) { /* ignore */ }
                }
            } catch (e) { /* ignore */ }
        }

        return Array.from(found);
    }

    async function precacheShell(onProgress) {
        const cache = await caches.open(CACHE_SHELL);
        const assets = await discoverShellAssets();
        let done = 0;
        let failed = 0;

        onProgress({ phase: 'shell', done: 0, total: assets.length, failed: 0 });

        for (const asset of assets) {
            try {
                // Se refresca siempre: así una actualización de la app llega a
                // la tablet sin esperar a que caduque nada.
                const response = await fetch(asset, { cache: 'reload' });
                if (response.ok) await cache.put(asset, response);
                else failed++;
            } catch (e) {
                failed++;
            }
            done++;
            if (done % 5 === 0 || done === assets.length) {
                onProgress({ phase: 'shell', done, total: assets.length, failed });
            }
        }

        await OfflineDB.setMeta('shell', {
            version: SHELL_VERSION,
            at: new Date().toISOString(),
            total: assets.length,
            failed
        });

        return { total: assets.length, failed };
    }

    // -------------------------------------------------------------- sync
    async function run(options) {
        const opts = options || {};
        const onProgress = opts.onProgress || function () {};
        const quality = opts.quality || 'optimized';
        const forceImages = !!opts.forceImages;

        const started = Date.now();

        onProgress({ phase: 'store', message: 'Buscando la tienda…' });
        const store = await resolveStore(opts.store);
        const ownerId = store.id;

        const tables = {};

        onProgress({ phase: 'data', message: 'Descargando decks…' });
        const decks = await fetchAll('decks', `select=*&user_id=eq.${ownerId}&order=position.asc,id.asc`);
        const deckIds = decks.map(d => d.id);
        onProgress({ phase: 'data', message: `Descargando cartas de ${decks.length} decks…` });
        const deckCards = await fetchByIn('deck_cards', 'deck_id', deckIds);
        tables.decks = decks;
        tables.deck_cards = deckCards;

        onProgress({ phase: 'data', message: 'Descargando binders…' });
        const binders = await fetchAll('binders', `select=*&user_id=eq.${ownerId}&order=position.asc,id.asc`);
        const binderIds = binders.map(b => b.id);
        const binderPages = await fetchByIn('binder_pages', 'binder_id', binderIds);
        const pageIds = binderPages.map(p => p.id);
        const binderSlots = await fetchByIn('binder_card_slots', 'page_id', pageIds);
        tables.binders = binders;
        tables.binder_pages = binderPages;
        tables.binder_card_slots = binderSlots;

        onProgress({ phase: 'data', message: 'Descargando inversiones…' });
        const categories = await fetchAll('investment_categories', `select=*&user_id=eq.${ownerId}&order=position.asc,id.asc`);
        const investmentCards = await fetchAll('investment_cards', `select=*&user_id=eq.${ownerId}&order=position.asc,id.asc`);
        tables.investment_categories = categories;
        tables.investment_cards = investmentCards;

        // Álbumes (carpetas): portada, páginas y las cartas de cada slot.
        let albums = [];
        let albumPages = [];
        let albumSlots = [];
        try {
            onProgress({ phase: 'data', message: 'Descargando álbumes…' });
            albums = await fetchAll('albums', `select=*&user_id=eq.${ownerId}&order=position.asc,id.asc`);
            albumPages = await fetchByIn('pages', 'album_id', albums.map(a => a.id));
            albumSlots = await fetchByIn('card_slots', 'page_id', albumPages.map(p => p.id));
        } catch (e) {
            console.warn('Álbumes no disponibles para la copia:', e && e.message);
        }
        tables.albums = albums;
        tables.pages = albumPages;
        tables.card_slots = albumSlots;

        // Wanted (lista de deseos), todas las listas del dueño.
        let wishlist = [];
        try {
            onProgress({ phase: 'data', message: 'Descargando Wanted…' });
            wishlist = await fetchAll('wishlist', `select=*&user_id=eq.${ownerId}&order=list_index.asc,created_at.desc`);
        } catch (e) {
            console.warn('Wanted no disponible para la copia:', e && e.message);
        }
        tables.wishlist = wishlist;

        // Opcionales: si la tabla no existe o no hay permisos, se ignora.
        try {
            tables.store_customizations = await fetchAll('store_customizations', `select=*&user_id=eq.${ownerId}`);
        } catch (e) { tables.store_customizations = []; }
        tables.system_settings = [];

        tables.usuarios = [store];
        // Sin modelos 3D: el asistente y los espíritus no se usan en esta vista.
        tables.spirits = [];

        onProgress({ phase: 'data', message: 'Guardando copia local…' });
        for (const name of Object.keys(tables)) {
            await OfflineDB.putTable(name, tables[name]);
        }

        const counts = {
            decks: decks.length,
            deckCards: deckCards.length,
            binders: binders.length,
            binderPages: binderPages.length,
            binderCards: binderSlots.length,
            investmentCategories: categories.length,
            investmentCards: investmentCards.length,
            albums: albums.length,
            albumCards: albumSlots.length,
            wishlist: wishlist.length
        };

        const previous = (await OfflineDB.getMeta('snapshot')) || {};

        const meta = {
            version: 1,
            ownerId,
            storeIdentifier: opts.store,
            storeName: store.store_name || store.username || '',
            storeUsername: store.username || '',
            syncedAt: new Date().toISOString(),
            quality,
            counts,
            images: previous.images || { total: 0, skipped: 0, failed: 0 }
        };
        await OfflineDB.setMeta('snapshot', meta);

        // Deja los datos disponibles en memoria sin recargar la página.
        await OfflineData.reload();

        let images = { total: 0, skipped: 0, failed: 0 };
        if (opts.skipImages !== true) {
            const urls = collectImages(tables);
            images = await downloadImages(urls, {
                quality,
                force: forceImages || (previous.quality && previous.quality !== quality),
                signal: opts.signal,
                onProgress
            });
            meta.images = { total: images.total, skipped: images.skipped, failed: images.failed };
            meta.syncedAt = new Date().toISOString();
            await OfflineDB.setMeta('snapshot', meta);
        }

        if (opts.skipShell !== true) {
            await precacheShell(onProgress);
        }

        // Guarda el último tipo de cambio USD→MXN para que los precios en
        // pesos se vean igual que con internet.
        try {
            const rateRes = await fetch('https://open.er-api.com/v6/latest/USD');
            const rateJson = await rateRes.json();
            const rate = rateJson && rateJson.rates && rateJson.rates.MXN;
            if (rate) {
                localStorage.setItem('tcg_usd_mxn_rate', JSON.stringify({ rate, ts: Date.now() }));
                meta.rate = rate;
                await OfflineDB.setMeta('snapshot', meta);
            }
        } catch (e) { /* opcional */ }

        const estimate = await OfflineDB.estimate();

        onProgress({ phase: 'done', message: 'Copia sin conexión lista.' });

        return {
            store,
            counts,
            images,
            quality,
            syncedAt: meta.syncedAt,
            durationMs: Date.now() - started,
            usage: estimate && estimate.usage ? estimate.usage : null
        };
    }

    async function getStatus() {
        await OfflineDB.open();
        const meta = (await OfflineDB.getMeta('snapshot')) || null;
        const shell = (await OfflineDB.getMeta('shell')) || null;
        const estimate = await OfflineDB.estimate();
        let imageCount = 0;
        try {
            imageCount = await OfflineDB.countImages();
        } catch (e) { /* sin base todavía */ }
        try {
            // Copias antiguas guardadas en Cache Storage antes de usar IndexedDB.
            const cache = await caches.open(CACHE_IMAGES);
            imageCount += (await cache.keys()).length;
        } catch (e) { /* sin caché todavía */ }
        return { meta, shell, shellVersion: SHELL_VERSION, imageCount, estimate };
    }

    async function clear() {
        await OfflineDB.clearAll();
        await caches.delete(CACHE_IMAGES);
        try { await OfflineData.reload(); } catch (e) { /* ignore */ }
    }

    window.OfflineSync = {
        run,
        getStatus,
        clear,
        collectImages,
        imageTarget,
        shellAssets,
        CACHE_IMAGES,
        CACHE_SHELL
    };
})();
