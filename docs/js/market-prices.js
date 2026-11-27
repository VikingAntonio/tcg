/**
 * Precio de mercado por código de impresión.
 *
 * Se escribe el código (RA03-EN123) y se obtiene el precio de TCGplayer:
 *   1) Edge Function `market-price` (TCGCSV, incluye rarezas que las bases
 *      gratuitas no pricean). Es la fuente exacta por impresión.
 *   2) Respaldo Yu-Gi-Oh!: YGOPRODeck (`cardsets.php` -> set -> carta).
 *   3) Respaldo Pokémon: TCGdex por id (`swsh9-166`).
 *
 * Todo llega en USD: la conversión a MXN la decide el dueño.
 */
(function () {
    'use strict';

    const CACHE_KEY = 'tcg_market_prices_cache_v2';
    const CACHE_TTL = 6 * 60 * 60 * 1000;
    const CACHE_LIMIT = 120;

    const YGO_API = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
    const YGO_SETS = 'https://db.ygoprodeck.com/api/v7/cardsets.php';
    const TCGDEX = 'https://api.tcgdex.net/v2/en';

    // --- Utilidades -------------------------------------------------------

    const num = (v) => {
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : null;
    };

    const norm = (s) => (s == null ? '' : String(s))
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    const codeKey = (s) => String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');

    const CODE_IN_TEXT_RE = /([A-Za-z0-9]{2,6}-[A-Za-z0-9]{0,4}\d{1,4})/;

    // "RA03-EN123 PLATINUM" -> { code: 'RA03-EN123', rarity: 'PLATINUM' }
    function parse(text) {
        const raw = String(text == null ? '' : text).trim();
        const match = raw.match(CODE_IN_TEXT_RE);
        if (!match) return null;
        const rarity = raw.replace(match[1], ' ').replace(/\s+/g, ' ').trim();
        return { code: match[1].toUpperCase(), rarity };
    }

    function money(price, currency) {
        const n = num(price);
        if (n === null) return '—';
        const symbol = { USD: 'US$', EUR: '€', MXN: '$' }[String(currency || '').toUpperCase()] || '';
        return `${symbol}${n.toFixed(2)}`;
    }

    // --- Caché ------------------------------------------------------------

    function readCache() {
        try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch (e) { return {}; }
    }

    function setCached(key, value, ttl) {
        try {
            const all = readCache();
            all[key] = { value, exp: Date.now() + ttl };
            const keys = Object.keys(all);
            if (keys.length > CACHE_LIMIT) {
                keys.slice(0, keys.length - CACHE_LIMIT).forEach((k) => delete all[k]);
            }
            localStorage.setItem(CACHE_KEY, JSON.stringify(all));
        } catch (e) { /* almacenamiento lleno: se ignora */ }
    }

    async function fetchJson(url, timeoutMs = 12000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
            if (!res.ok) {
                const err = new Error(`HTTP ${res.status}`);
                err.status = res.status;
                throw err;
            }
            return await res.json();
        } finally {
            clearTimeout(timer);
        }
    }

    async function cachedJson(key, loader, ttl) {
        const entry = readCache()[key];
        if (entry && entry.exp > Date.now()) return entry.value;
        const value = await loader();
        // Un fallo momentáneo no debe quedar cacheado como "sin precio".
        if (value !== undefined && value !== null) setCached(key, value, ttl);
        return value;
    }

    // --- Fuente 1: Edge Function (TCGCSV) ---------------------------------

    function supabaseBase() {
        if (window._supabase && window._supabase.supabaseUrl) return window._supabase.supabaseUrl;
        if (typeof SUPABASE_URL !== 'undefined') return SUPABASE_URL;
        return '';
    }

    async function serverLookup(code, rarity) {
        const base = supabaseBase();
        if (!base) return null;
        const query = `code=${encodeURIComponent(code)}${rarity ? `&rarity=${encodeURIComponent(rarity)}` : ''}`;
        const url = `${base}/functions/v1/market-price?${query}`;
        const data = await cachedJson(`srv:${codeKey(code)}:${norm(rarity || '')}`, async () => {
            try { return await fetchJson(url); } catch (e) { return null; }
        }, CACHE_TTL);
        if (!data || !data.found || num(data.price) === null) return null;
        const art = String(data.name || '').match(/\(([A-Z])\)\s*$/);
        return {
            name: data.name || '',
            setName: data.setName || '',
            setNumber: data.code || code,
            rarity: data.rarity || '',
            art: art ? art[1] : '',
            variantLabel: data.variant || '',
            price: num(data.price),
            currency: data.currency || 'USD',
            source: data.source || 'TCGplayer',
            updatedAt: data.updatedAt || null
        };
    }

    // --- Fuente 2: YGOPRODeck ---------------------------------------------

    async function ygoSetMap() {
        return cachedJson('ygo:setmap', async () => {
            const sets = await fetchJson(YGO_SETS, 15000);
            const map = {};
            (sets || []).forEach((s) => {
                const code = String(s.set_code || '').toUpperCase();
                if (code && !map[code]) map[code] = s.set_name;
            });
            return map;
        }, 7 * 24 * 60 * 60 * 1000);
    }

    async function ygoLookup(code) {
        const prefix = String(code).toUpperCase().split('-')[0];
        const map = (await ygoSetMap().catch(() => null)) || {};
        const setName = map[prefix];
        if (!setName) return null;

        const data = await cachedJson(
            `ygo:set:${norm(setName)}`,
            () => fetchJson(`${YGO_API}?cardset=${encodeURIComponent(setName)}`, 15000).catch(() => null),
            CACHE_TTL
        );
        const wanted = codeKey(code);
        const card = ((data && data.data) || []).find((c) => (c.card_sets || []).some((s) => codeKey(s.set_code) === wanted));
        if (!card) return null;

        const print = (card.card_sets || []).find((s) => codeKey(s.set_code) === wanted);
        const price = num(print.set_price);
        return {
            name: card.name,
            setName: print.set_name || '',
            setNumber: print.set_code || code,
            rarity: print.set_rarity || '',
            variantLabel: print.set_edition || '',
            price: price !== null && price > 0 ? price : null,
            currency: 'USD',
            source: 'TCGplayer',
            updatedAt: null
        };
    }

    // --- Fuente 3: TCGdex (Pokémon) ---------------------------------------

    async function tcgdexLookup(code) {
        const id = String(code).toLowerCase();
        if (!/^[a-z0-9]+-[a-z0-9]+$/.test(id)) return null;
        const detail = await cachedJson(
            `tcgdex:${id}`,
            () => fetchJson(`${TCGDEX}/cards/${encodeURIComponent(id)}`).catch(() => null),
            CACHE_TTL
        );
        if (!detail) return null;

        let best = null;
        (detail.variants_detailed || []).forEach((variant) => {
            const tp = (variant.pricing || {}).tcgplayer;
            if (!tp) return;
            Object.keys(tp).forEach((finish) => {
                const price = num((tp[finish] || {}).marketPrice);
                if (price !== null && price > 0 && (!best || price > best.price)) {
                    best = { price, finish };
                }
            });
        });
        if (!best) return null;

        const set = detail.set || {};
        return {
            name: detail.name || '',
            setName: set.name || '',
            setNumber: `${set.id || ''}-${detail.localId || ''}`.replace(/^-|-$/g, ''),
            rarity: detail.rarity || '',
            variantLabel: best.finish || '',
            price: best.price,
            currency: 'USD',
            source: 'TCGplayer',
            updatedAt: null
        };
    }

    // --- API pública ------------------------------------------------------

    async function lookupCode(text, { game = '' } = {}) {
        const parsed = parse(text);
        if (!parsed) return null;
        const clean = parsed.code;

        const fromServer = await serverLookup(clean, parsed.rarity).catch(() => null);
        if (fromServer) return fromServer;

        if (!game || game === 'yugioh') {
            const fromYgo = await ygoLookup(clean).catch(() => null);
            if (fromYgo) return fromYgo;
        }
        if (!game || game === 'pokemon') {
            const fromTcgdex = await tcgdexLookup(clean).catch(() => null);
            if (fromTcgdex) return fromTcgdex;
        }
        return null;
    }

    window.MarketPrices = {
        lookupCode,
        parse,
        money,
        clearCache: () => localStorage.removeItem(CACHE_KEY)
    };
})();
