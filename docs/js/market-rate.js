/**
 * Tipo de cambio USD -> MXN para mostrar el precio de mercado en pesos.
 *
 * Fuentes gratuitas, sin clave y con CORS abierto (probadas en navegador):
 *   1) exchangerate-api (open.er-api.com), actualización diaria.
 *   2) fawazahmed0/currency-api por jsDelivr, actualización diaria.
 * Si ambas fallan se usa 20 MXN por dólar.
 *
 * Se cachea 24 h en localStorage; el servidor (create-checkout-session) usa la
 * misma regla para cobrar exactamente lo que se muestra.
 */
(function () {
    'use strict';

    const CACHE_KEY = 'tcg_usd_mxn_rate';
    const CACHE_TTL = 24 * 60 * 60 * 1000;
    const FALLBACK_TTL = 10 * 60 * 1000;
    const FALLBACK = 20;

    let memory = null;

    const sane = (rate) => Number.isFinite(rate) && rate > 5 && rate < 100;

    function readCache() {
        try {
            const data = JSON.parse(localStorage.getItem(CACHE_KEY));
            return data && sane(Number(data.rate)) ? { rate: Number(data.rate), at: Number(data.at) || 0, source: data.source || '' } : null;
        } catch (e) {
            return null;
        }
    }

    function writeCache(entry) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(entry)); } catch (e) { /* se ignora */ }
    }

    async function fetchJson(url, timeoutMs = 8000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } finally {
            clearTimeout(timer);
        }
    }

    // El respaldo fijo no se guarda 24 h: se reintenta a los 10 minutos.
    const ttlFor = (entry) => (entry && entry.source === 'fixed' ? FALLBACK_TTL : CACHE_TTL);

    function fresh() {
        const cached = readCache();
        if (cached && Date.now() - cached.at < CACHE_TTL) return cached;
        if (memory && Date.now() - memory.at < ttlFor(memory)) return memory;
        return null;
    }

    function current() {
        return fresh() || (memory && sane(memory.rate) ? memory : { rate: FALLBACK, at: 0, source: 'fixed' });
    }

    async function get(force) {
        if (!force) {
            const hit = fresh();
            if (hit) return hit;
        }

        let rate = null;
        let source = '';
        try {
            const data = await fetchJson('https://open.er-api.com/v6/latest/USD');
            rate = parseFloat(data && data.rates && data.rates.MXN);
            source = 'exchangerate-api';
        } catch (e) { /* siguiente fuente */ }

        if (!sane(rate)) {
            try {
                const data = await fetchJson('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
                rate = parseFloat(data && data.usd && data.usd.mxn);
                source = 'fawazahmed0';
            } catch (e) { /* queda el respaldo */ }
        }

        if (!sane(rate)) {
            rate = FALLBACK;
            source = 'fixed';
        }

        memory = { rate, at: Date.now(), source };
        if (source !== 'fixed') writeCache(memory);
        return memory;
    }

    function rate() {
        return current().rate;
    }

    function convert(usd) {
        const value = parseFloat(usd);
        if (!Number.isFinite(value) || value <= 0) return 0;
        return Math.round(value * rate() * 100) / 100;
    }

    window.MarketRate = { get, convert, rate, FALLBACK };
})();
