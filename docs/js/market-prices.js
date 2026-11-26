/**
 * Precios de mercado automáticos.
 *
 * Usa solo APIs públicas y gratuitas, sin clave:
 *   - Pokémon  -> TCGdex (precio TCGplayer en USD, Cardmarket en EUR como respaldo)
 *   - Yu-Gi-Oh -> YGOPRODeck (TCGplayer por impresión, en USD)
 *   - Magic    -> Scryfall (TCGplayer en USD)
 *
 * Cada carta se "vincula" una sola vez a una impresión concreta; a partir de ahí
 * el precio se puede refrescar sin volver a buscarla. El precio se guarda aparte
 * (market_price) y el precio que el dueño usa en sus cálculos no se toca.
 */
(function () {
    'use strict';

    const CACHE_KEY = 'tcg_market_prices_cache_v1';
    const CACHE_TTL = 12 * 60 * 60 * 1000;
    const CANDIDATE_TTL = 6 * 60 * 60 * 1000;
    const CACHE_LIMIT = 250;

    const GAME_LABELS = {
        pokemon: 'Pokémon', yugioh: 'Yu-Gi-Oh!', magic: 'Magic',
        lorcana: 'Lorcana', onepiece: 'One Piece'
    };

    const VARIANT_LABELS = {
        normal: 'Normal',
        holofoil: 'Holo',
        'reverse-holofoil': 'Reverse Holo',
        '1stEditionHolofoil': '1st Edition Holo',
        '1stEditionNormal': '1st Edition',
        'unlimitedHolofoil': 'Unlimited Holo',
        'unlimited': 'Unlimited',
        usd: 'Normal',
        usd_foil: 'Foil',
        avg: 'Cardmarket promedio',
        default: 'TCGplayer'
    };

    const CURRENCY_SYMBOL = { USD: 'US$', EUR: '€', MXN: '$' };

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

    const esc = (s) => (s == null ? '' : String(s))
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    function readCache() {
        try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch (e) { return {}; }
    }

    function getCached(key) {
        const entry = readCache()[key];
        if (!entry || !entry.exp || entry.exp < Date.now()) return null;
        return entry.value;
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

    async function fetchJson(url, options = {}, timeoutMs = 9000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: { Accept: 'application/json', ...(options.headers || {}) }
            });
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

    async function cachedJson(cacheKey, loader, ttl) {
        const hit = getCached(cacheKey);
        if (hit) return hit;
        const value = await loader();
        // Un fallo momentáneo no debe dejar el "sin resultados" cacheado 6 h.
        const empty = Array.isArray(value) && value.length === 0;
        if (value !== undefined && value !== null && !empty) setCached(cacheKey, value, ttl);
        return value;
    }

    function money(price, currency) {
        const n = num(price);
        if (n === null) return '—';
        return `${CURRENCY_SYMBOL[currency] || ''}${n.toFixed(2)}`;
    }

    function variantLabel(variant) {
        return VARIANT_LABELS[variant] || (variant ? String(variant) : 'TCGplayer');
    }

    function ageLabel(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
        if (mins < 1) return 'hace un momento';
        if (mins < 60) return `hace ${mins} min`;
        const hours = Math.round(mins / 60);
        if (hours < 24) return `hace ${hours} h`;
        return `hace ${Math.round(hours / 24)} d`;
    }

    function bestRow(rows, preferred) {
        if (!rows || !rows.length) return null;
        if (preferred) {
            const exact = rows.find((r) => r.variant === preferred);
            if (exact) return exact;
        }
        const order = ['holofoil', 'usd', 'normal', 'reverse-holofoil', 'usd_foil', 'avg', 'default'];
        for (const key of order) {
            const row = rows.find((r) => r.variant === key);
            if (row) return row;
        }
        return rows[0];
    }

    // --- Proveedores ------------------------------------------------------

    const TCGDEX = 'https://api.tcgdex.net/v2/en';

    function tcgdexRows(detail) {
        const rows = [];
        const set = detail.set || {};
        (detail.variants_detailed || []).forEach((variant) => {
            const pricing = variant.pricing || {};
            const tp = pricing.tcgplayer;
            if (tp) {
                Object.keys(tp).forEach((key) => {
                    const sub = tp[key];
                    if (!sub || typeof sub !== 'object') return;
                    const price = num(sub.marketPrice);
                    if (price === null || price <= 0) return;
                    rows.push({
                        provider: 'tcgdex',
                        game: 'pokemon',
                        externalId: detail.id,
                        name: detail.name,
                        setName: set.name || '',
                        setNumber: detail.localId || '',
                        rarity: detail.rarity || '',
                        variant: key,
                        variantLabel: variantLabel(key),
                        price,
                        currency: tp.unit || 'USD',
                        source: 'TCGplayer',
                        updatedAt: tp.updated || null,
                        image: detail.image ? `${detail.image}/low.webp` : ''
                    });
                });
            }
            const cm = pricing.cardmarket;
            if (!tp && cm) {
                const price = num(cm.avg) ?? num(cm.trend);
                if (price !== null && price > 0) {
                    rows.push({
                        provider: 'tcgdex',
                        game: 'pokemon',
                        externalId: detail.id,
                        name: detail.name,
                        setName: set.name || '',
                        setNumber: detail.localId || '',
                        rarity: detail.rarity || '',
                        variant: 'avg',
                        variantLabel: variantLabel('avg'),
                        price,
                        currency: cm.unit || 'EUR',
                        source: 'Cardmarket',
                        updatedAt: cm.updated || null,
                        image: detail.image ? `${detail.image}/low.webp` : ''
                    });
                }
            }
        });
        const seen = new Set();
        return rows.filter((r) => {
            const key = `${r.externalId}|${r.variant}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    async function tcgdexDetail(id) {
        return cachedJson(`tcgdex:card:${id}`, () => fetchJson(`${TCGDEX}/cards/${encodeURIComponent(id)}`), CACHE_TTL);
    }

    async function tcgdexSearch(name, limit = 6) {
        const list = await cachedJson(
            `tcgdex:search:${norm(name)}`,
            () => fetchJson(`${TCGDEX}/cards?name=${encodeURIComponent(name)}`).catch(() => []),
            CANDIDATE_TTL
        );
        const wanted = norm(name);
        const items = (list || [])
            .filter((c) => c && c.id && norm(c.name).includes(wanted))
            .sort((a, b) => (norm(a.name) === wanted ? -1 : 0) - (norm(b.name) === wanted ? -1 : 0))
            .slice(0, limit);

        const rows = [];
        for (const item of items) {
            try {
                const detail = await tcgdexDetail(item.id);
                if (detail && detail.id) rows.push(...tcgdexRows(detail));
            } catch (e) { /* se omite la carta */ }
            await sleep(120);
        }
        return rows;
    }

    const YGO_API = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';

    function ygoRows(card, maxPrints = 12) {
        const rows = [];
        const sets = (card.card_sets || []).filter((s) => num(s.set_price) !== null && num(s.set_price) > 0);
        sets.slice(0, maxPrints).forEach((s) => {
            rows.push({
                provider: 'ygoprodeck',
                game: 'yugioh',
                externalId: String(card.id),
                name: card.name,
                setName: s.set_name || '',
                setNumber: s.set_code || '',
                rarity: s.set_rarity || '',
                variant: s.set_code || 'default',
                variantLabel: s.set_edition || '',
                price: num(s.set_price),
                currency: 'USD',
                source: 'TCGplayer',
                updatedAt: null,
                image: (card.card_images && card.card_images[0] && card.card_images[0].image_url_small) || ''
            });
        });
        if (!rows.length) {
            const price = num(card.card_prices && card.card_prices[0] && card.card_prices[0].tcgplayer_price);
            if (price !== null && price > 0) {
                rows.push({
                    provider: 'ygoprodeck',
                    game: 'yugioh',
                    externalId: String(card.id),
                    name: card.name,
                    setName: '',
                    setNumber: '',
                    rarity: '',
                    variant: 'default',
                    variantLabel: variantLabel('default'),
                    price,
                    currency: 'USD',
                    source: 'TCGplayer',
                    updatedAt: null,
                    image: (card.card_images && card.card_images[0] && card.card_images[0].image_url_small) || ''
                });
            }
        }
        return rows;
    }

    async function ygoSearch(name) {
        const data = await cachedJson(
            `ygo:search:${norm(name)}`,
            () => fetchJson(`${YGO_API}?fname=${encodeURIComponent(name)}`).catch(() => null),
            CANDIDATE_TTL
        );
        const cards = (data && data.data) || [];
        const wanted = norm(name);
        return cards
            .filter((c) => norm(c.name).includes(wanted))
            .sort((a, b) => (norm(a.name) === wanted ? -1 : 0) - (norm(b.name) === wanted ? -1 : 0))
            .flatMap((c) => ygoRows(c));
    }

    const SCRYFALL = 'https://api.scryfall.com';

    function scryfallRows(card) {
        const rows = [];
        const image = (card.image_uris && card.image_uris.small)
            || (card.card_faces && card.card_faces[0] && card.card_faces[0].image_uris && card.card_faces[0].image_uris.small)
            || '';
        const base = {
            provider: 'scryfall',
            game: 'magic',
            externalId: card.id,
            name: card.name,
            setName: card.set_name || '',
            setNumber: card.collector_number || '',
            rarity: card.rarity || '',
            currency: 'USD',
            source: 'TCGplayer',
            updatedAt: (card.prices && card.prices.updated_at) || null,
            image
        };
        const usd = num(card.prices && card.prices.usd);
        if (usd !== null && usd > 0) {
            rows.push({ ...base, variant: 'usd', variantLabel: variantLabel('usd'), price: usd });
        }
        const foil = num(card.prices && card.prices.usd_foil);
        if (foil !== null && foil > 0) {
            rows.push({ ...base, variant: 'usd_foil', variantLabel: variantLabel('usd_foil'), price: foil });
        }
        return rows;
    }

    async function scryfallSearch(name) {
        const clean = String(name || '').replace(/"/g, '').trim();
        if (!clean) return [];
        const q = encodeURIComponent(`!"${clean}"`);
        const data = await cachedJson(
            `scry:search:${norm(clean)}`,
            () => fetchJson(`${SCRYFALL}/cards/search?q=${q}&unique=prints&order=released`).catch(() => null),
            CANDIDATE_TTL
        );
        return ((data && data.data) || []).slice(0, 25).flatMap(scryfallRows);
    }

    const SEARCHERS = {
        pokemon: tcgdexSearch,
        yugioh: ygoSearch,
        magic: scryfallSearch
    };

    const PROVIDER_BY_GAME = { pokemon: 'tcgdex', yugioh: 'ygoprodeck', magic: 'scryfall' };

    function inferProvider(externalId, game) {
        if (!externalId) return null;
        if (PROVIDER_BY_GAME[game]) return PROVIDER_BY_GAME[game];
        const id = String(externalId);
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id)) return 'scryfall';
        if (/^\d+$/.test(id)) return 'ygoprodeck';
        if (/^[a-z0-9]+-[a-z0-9]+$/i.test(id)) return 'tcgdex';
        return null;
    }

    // Un código de impresión escrito dentro del nombre (CT2-EN004, swsh9-166)
    // se usa como filtro y se quita del texto que se busca por nombre.
    function splitNameCode(raw) {
        const text = String(raw == null ? '' : raw).trim();
        // CT2-EN004, MFC-000, swsh9-166, 2X2-334... (siempre con letras y dígitos)
        const match = text.match(/\b(?=[A-Za-z0-9-]*[A-Za-z])([A-Za-z0-9]{2,6}-[A-Za-z0-9]{0,4}\d{1,4})\b/);
        if (!match) return { name: text, code: '' };
        const name = text.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
        return { name: name || text, code: match[1].toUpperCase() };
    }

    const codeKey = (s) => String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');

    function matchesCode(row, code) {
        const needle = codeKey(code);
        if (!needle) return true;
        return [row.setNumber, row.variant, row.externalId].some((v) => codeKey(v).includes(needle));
    }

    // --- Búsqueda y precio ------------------------------------------------

    async function searchCards({ game = '', name = '', code = '', limit = 60 } = {}) {
        const split = splitNameCode(name);
        const query = split.name;
        const codeFilter = String(code || split.code || '').trim();
        if (!query) return [];

        const games = game ? [game] : Object.keys(SEARCHERS);
        const lists = await Promise.all(games.map(async (g) => {
            const searcher = SEARCHERS[g];
            if (!searcher) return [];
            try { return await searcher(query); } catch (e) { return []; }
        }));

        const wanted = norm(query);
        let rows = lists.flat();
        if (codeFilter) rows = rows.filter((row) => matchesCode(row, codeFilter));
        const seen = new Set();
        const unique = rows.filter((row) => {
            const key = `${row.provider}|${row.externalId}|${row.variant}|${row.setNumber}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        const gameOrder = { yugioh: 0, pokemon: 1, magic: 2 };
        unique.sort((a, b) => {
            const aExact = norm(a.name) === wanted ? 0 : 1;
            const bExact = norm(b.name) === wanted ? 0 : 1;
            if (aExact !== bExact) return aExact - bExact;
            return (gameOrder[a.game] ?? 9) - (gameOrder[b.game] ?? 9);
        });
        return unique.slice(0, limit);
    }

    async function linkedRow(card) {
        const provider = card.market_provider || inferProvider(card.external_id, card.tcg_game);
        const cardId = card.market_card_id || card.external_id;
        if (!provider || !cardId) {
            const err = new Error('Sin vincular');
            err.code = 'NOT_LINKED';
            throw err;
        }
        const variant = card.market_variant || null;

        if (provider === 'tcgdex') {
            const detail = await tcgdexDetail(cardId);
            const rows = tcgdexRows(detail);
            const row = bestRow(rows, variant);
            if (!row) throw new Error('La carta no tiene precio disponible');
            return row;
        }

        if (provider === 'ygoprodeck') {
            const data = await fetchJson(`${YGO_API}?id=${encodeURIComponent(cardId)}`);
            const ygoCard = (data && data.data && data.data[0]) || null;
            if (!ygoCard) throw new Error('Carta no encontrada');
            if (variant && variant !== 'default') {
                const print = (ygoCard.card_sets || []).find((s) => s.set_code === variant);
                const price = num(print && print.set_price);
                if (print && price !== null && price > 0) {
                    return {
                        ...ygoRows(ygoCard).find((r) => r.setNumber === variant),
                        price
                    };
                }
            }
            const fallback = bestRow(ygoRows(ygoCard));
            if (!fallback) throw new Error('Sin precio disponible');
            return fallback;
        }

        if (provider === 'scryfall') {
            const data = await fetchJson(`${SCRYFALL}/cards/${encodeURIComponent(cardId)}`);
            const rows = scryfallRows(data);
            const row = bestRow(rows, variant);
            if (!row) throw new Error('Sin precio disponible');
            return row;
        }

        throw new Error('Proveedor no soportado');
    }

    async function refreshLinked(cards, { onProgress } = {}) {
        const list = (cards || []).filter(Boolean);
        const results = [];
        let index = 0;
        const total = list.length;

        const worker = async () => {
            while (index < list.length) {
                const card = list[index++];
                try {
                    const row = await linkedRow(card);
                    results.push({ card, ok: true, row });
                } catch (e) {
                    results.push({ card, ok: false, error: e.message || String(e), code: e.code });
                }
                if (typeof onProgress === 'function') onProgress(results.length, total, card);
                await sleep(120);
            }
        };

        await Promise.all([worker(), worker(), worker()]);
        return results;
    }

    // --- Tipo de cambio ---------------------------------------------------

    const RATE_KEY = (currency) => `tcg_market_rate_${currency}`;

    function defaultRate(currency) {
        if (currency === 'USD') return 18.5;
        if (currency === 'EUR') return 20.5;
        return 1;
    }

    function getRate(currency) {
        const value = num(localStorage.getItem(RATE_KEY(currency)));
        return value && value > 0 ? value : defaultRate(currency);
    }

    function setRate(currency, value) {
        const n = num(value);
        if (n && n > 0) localStorage.setItem(RATE_KEY(currency), String(n));
    }

    function toMxn(price, currency) {
        const n = num(price);
        if (n === null) return null;
        return Math.round(n * getRate(currency) * 100) / 100;
    }

    async function askMxnPrice(choice) {
        if (!choice || num(choice.price) === null) return null;
        const currency = choice.currency || 'USD';
        const price = num(choice.price);
        if (currency === 'MXN') return price;

        const rate = getRate(currency);
        const converted = Math.round(price * rate * 100) / 100;
        const { value, isConfirmed } = await Swal.fire({
            title: 'PRECIO DE MERCADO',
            width: 460,
            html: `
                <div style="text-align:left; font-size:0.9rem; color:#333;">
                    <div style="margin-bottom:10px;"><b>${esc(choice.name)}</b><br>
                        <span style="color:#666; font-size:0.8rem;">${esc(choice.setName || '')}${choice.setNumber ? ' · ' + esc(choice.setNumber) : ''} · ${esc(choice.variantLabel || '')}</span></div>
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#f5f6fa; border-radius:6px; margin-bottom:12px;">
                        <span style="font-weight:800; font-size:0.72rem; letter-spacing:0.06em; color:#666;">PRECIO DE MERCADO</span>
                        <b style="font-size:1.05rem;">${money(price, currency)}</b>
                    </div>
                    <label style="font-size:0.72rem; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:#666;">Tipo de cambio (1 ${currency} = ? MXN)</label>
                    <input id="mp-rate-input" type="number" step="0.01" min="0.01" value="${rate}" style="width:100%; padding:10px; margin-top:6px; border:1px solid #ddd; border-radius:6px; font-size:1rem;">
                    <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:800; font-size:0.72rem; letter-spacing:0.06em; color:#666;">QUEDA EN</span>
                        <b id="mp-rate-result" style="font-size:1.15rem; color:#00875a;">$${converted.toFixed(2)}</b>
                    </div>
                </div>`,
            showCancelButton: true,
            confirmButtonText: 'USAR PRECIO',
            cancelButtonText: 'CANCELAR',
            customClass: { popup: 'inv-swal-popup' },
            didOpen: () => {
                const input = document.getElementById('mp-rate-input');
                const out = document.getElementById('mp-rate-result');
                if (input) {
                    input.addEventListener('input', () => {
                        const r = num(input.value) || 0;
                        out.textContent = `$${(price * r).toFixed(2)}`;
                    });
                }
            },
            preConfirm: () => {
                const input = document.getElementById('mp-rate-input');
                const r = num(input && input.value);
                if (!r || r <= 0) {
                    Swal.showValidationMessage('Escribe un tipo de cambio válido');
                    return false;
                }
                return r;
            }
        });

        if (!isConfirmed) return null;
        setRate(currency, value);
        return Math.round(price * value * 100) / 100;
    }

    // --- Selector de impresión (UI) ---------------------------------------

    function openPicker({ name = '', game = '', code = '', title = 'BUSCAR PRECIO DE MERCADO' } = {}) {
        return new Promise((resolve) => {
            let allRows = [];
            let results = [];
            let picked = null;

            const split = splitNameCode(name);
            const initialName = split.name;
            const initialCode = String(code || split.code || '').toUpperCase();

            const gamesOptions = [
                ['', 'Automático'],
                ['yugioh', 'Yu-Gi-Oh!'],
                ['pokemon', 'Pokémon'],
                ['magic', 'Magic'],
                ['lorcana', 'Lorcana'],
                ['onepiece', 'One Piece']
            ].map(([value, label]) => `<option value="${value}"${value === game ? ' selected' : ''}>${label}</option>`).join('');

            Swal.fire({
                title,
                width: 'min(880px, 94vw)',
                html: `
                    <div id="mp-picker" style="text-align:left;">
                        <div style="display:flex; gap:8px; flex-wrap:wrap;">
                            <input id="mp-query" class="swal2-input" style="flex:1 1 260px; margin:0; height:42px;" placeholder="Nombre de la carta" value="${esc(initialName)}">
                            <select id="mp-game" class="swal2-select" style="margin:0; height:42px; min-width:130px;">${gamesOptions}</select>
                            <button id="mp-search" type="button" class="swal2-confirm swal2-styled" style="margin:0; height:42px;">BUSCAR</button>
                        </div>
                        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:8px;">
                            <input id="mp-code" class="swal2-input" style="flex:0 1 240px; margin:0; height:38px;" placeholder="Código de la impresión (ej. CT2-EN004)" value="${esc(initialCode)}">
                            <span id="mp-count" style="font-size:0.72rem; color:#777;"></span>
                        </div>
                        <div style="font-size:0.72rem; color:#777; margin:8px 2px 0;">El código filtra las impresiones; si no lo tienes, compara la imagen, el set y el precio.</div>
                        <div id="mp-results" style="margin-top:12px; max-height:52vh; overflow-y:auto; border:1px solid #eee; border-radius:8px;">
                            <div style="padding:26px; text-align:center; color:#888; font-size:0.85rem;">Escribe el nombre y pulsa BUSCAR.</div>
                        </div>
                    </div>`,
                showConfirmButton: false,
                showCloseButton: true,
                customClass: { popup: 'inv-swal-popup' },
                didOpen: () => {
                    const root = document.getElementById('mp-picker');
                    if (!root) return;
                    const input = root.querySelector('#mp-query');
                    const gameSel = root.querySelector('#mp-game');
                    const codeInput = root.querySelector('#mp-code');
                    const count = root.querySelector('#mp-count');
                    const out = root.querySelector('#mp-results');
                    const btn = root.querySelector('#mp-search');

                    const render = () => {
                        const activeCode = codeInput.value.trim();
                        results = activeCode ? allRows.filter((row) => matchesCode(row, activeCode)) : allRows;
                        count.textContent = allRows.length ? `${results.length} de ${allRows.length} impresiones` : '';

                        if (!results.length) {
                            const msg = allRows.length
                                ? `Ninguna impresión coincide con «${esc(activeCode)}». Bórralo para ver las ${allRows.length}.`
                                : 'Sin resultados con precio disponible.';
                            out.innerHTML = `<div style="padding:26px; text-align:center; color:#888; font-size:0.85rem;">${msg}</div>`;
                            return;
                        }
                        out.innerHTML = results.map((row, i) => {
                            const mxn = row.price != null ? toMxn(row.price, row.currency) : null;
                            return `
                            <button type="button" class="mp-row" data-idx="${i}" style="display:flex; gap:10px; align-items:center; width:100%; text-align:left; background:#fff; border:0; border-bottom:1px solid #f1f2f6; padding:8px 10px; cursor:pointer;">
                                <img src="${esc(row.image)}" alt="" style="width:38px; height:52px; object-fit:contain; flex:0 0 auto;" onerror="this.style.visibility='hidden'">
                                <span style="flex:1; min-width:0;">
                                    <span style="display:block; font-weight:800; font-size:0.82rem; color:#111; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(row.name)}</span>
                                    <span style="display:block; font-size:0.7rem; color:#666;">${esc(GAME_LABELS[row.game] || row.game)} · ${esc(row.setName || 'Sin set')}${row.setNumber ? ' · ' + esc(row.setNumber) : ''}${row.rarity ? ' · ' + esc(row.rarity) : ''}</span>
                                    <span style="display:block; font-size:0.66rem; color:#999;">${esc(row.variantLabel || '')} · ${esc(row.source || '')}</span>
                                </span>
                                <span style="flex:0 0 auto; text-align:right;">
                                    <span style="display:block; font-weight:900; font-size:0.92rem; color:#00875a;">${money(row.price, row.currency)}</span>
                                    ${mxn != null ? `<span style="display:block; font-size:0.58rem; color:#999;">≈ ${money(mxn, 'MXN')}</span>` : ''}
                                </span>
                            </button>`;
                        }).join('');
                    };

                    const run = async () => {
                        const query = input.value.trim();
                        if (!query) return;
                        const parsed = splitNameCode(query);
                        if (parsed.code && !codeInput.value.trim()) codeInput.value = parsed.code;
                        btn.disabled = true;
                        out.innerHTML = '<div style="padding:26px; text-align:center; color:#888; font-size:0.85rem;">Buscando precios…</div>';
                        try {
                            allRows = await searchCards({ name: parsed.name, game: gameSel.value });
                        } catch (e) {
                            allRows = [];
                        }
                        btn.disabled = false;
                        render();
                    };

                    btn.addEventListener('click', run);
                    codeInput.addEventListener('input', render);
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') { e.preventDefault(); run(); }
                    });
                    out.addEventListener('click', (e) => {
                        const rowBtn = e.target.closest('.mp-row');
                        if (!rowBtn) return;
                        picked = results[parseInt(rowBtn.dataset.idx, 10)] || null;
                        Swal.close();
                    });
                    if (input.value.trim()) run();
                },
                willClose: () => resolve(picked)
            });
        });
    }

    // --- API pública ------------------------------------------------------

    window.MarketPrices = {
        games: GAME_LABELS,
        searchCards,
        openPicker,
        priceForLinked: linkedRow,
        refreshLinked,
        askMxnPrice,
        getRate,
        setRate,
        toMxn,
        money,
        ageLabel,
        variantLabel,
        clearCache: () => localStorage.removeItem(CACHE_KEY)
    };
})();
