// Cliente de datos para el modo sin conexión.
//
// Sustituye a js/supabase-config.js en las vistas offline. Expone un objeto
// compatible con el cliente de Supabase (`_supabase`) que en lugar de hablar
// por red responde desde la copia local guardada en IndexedDB. Así el código
// de las vistas (js/app.js, js/duel.js, js/magic.js...) funciona sin cambios.
(function () {
    // Se mantienen porque market-prices.js y algunas vistas leen estas constantes.
    const SUPABASE_URL = 'https://ehszvqwftqgxjggnbcmt.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoc3p2cXdmdHFneGpnZ25iY210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NDI5MjAsImV4cCI6MjA4NTMxODkyMH0.wh8_Xy4_w9roFxMgbJ-J9A3r5V7duUjnStl4ZsZ0804';

    window.SUPABASE_URL = SUPABASE_URL;
    window.SUPABASE_KEY = SUPABASE_KEY;
    window.OFFLINE_MODE = true;

    const RELATION_FK = {
        deck_cards: 'deck_id',
        binder_pages: 'binder_id',
        binder_card_slots: 'page_id',
        pages: 'album_id',
        card_slots: 'page_id',
        build_assets: 'assignment_id'
    };

    function singular(name) {
        return String(name || '').replace(/s$/, '');
    }

    // ---------------------------------------------------------------- datos
    const OfflineData = {
        tables: {},
        meta: {},
        readyPromise: null,

        async ready() {
            if (!this.readyPromise) {
                this.readyPromise = this.load().catch(err => {
                    console.error('OfflineData: no se pudo leer el almacén local', err);
                    this.tables = {};
                    this.meta = {};
                });
            }
            return this.readyPromise;
        },

        async load() {
            await OfflineDB.open();
            this.tables = await OfflineDB.getTables();
            this.meta = (await OfflineDB.getMeta('snapshot')) || {};
            return this.tables;
        },

        async reload() {
            this.readyPromise = null;
            return this.ready();
        },

        session() {
            if (!this.meta || !this.meta.ownerId) return null;
            return {
                access_token: 'offline',
                token_type: 'bearer',
                user: { id: this.meta.ownerId, email: 'offline@local' }
            };
        }
    };

    window.OfflineData = OfflineData;

    // -------------------------------------------------------------- utilería
    function looseEqual(a, b) {
        if (a === b) return true;
        if (a === null || a === undefined || b === null || b === undefined) return false;
        if (typeof a === 'object' || typeof b === 'object') {
            try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; }
        }
        return String(a) === String(b);
    }

    function splitTopLevel(str, sep) {
        const out = [];
        let depth = 0, quote = null, current = '';
        for (let i = 0; i < str.length; i++) {
            const ch = str[i];
            if (quote) {
                current += ch;
                if (ch === quote) quote = null;
                continue;
            }
            if (ch === '"' || ch === "'") { quote = ch; current += ch; continue; }
            if (ch === '(' || ch === '[') depth++;
            if (ch === ')' || ch === ']') depth--;
            if (ch === sep && depth === 0) { out.push(current); current = ''; continue; }
            current += ch;
        }
        if (current.trim() !== '') out.push(current);
        return out;
    }

    function unquote(value) {
        let v = String(value == null ? '' : value).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
        }
        return v;
    }

    function parseInList(value) {
        if (Array.isArray(value)) return value;
        let v = String(value == null ? '' : value).trim();
        if (v.startsWith('(') && v.endsWith(')')) v = v.slice(1, -1);
        if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1);
        return splitTopLevel(v, ',').map(unquote);
    }

    function likeToRegex(pattern, caseInsensitive) {
        const escaped = String(pattern)
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/%/g, '.*')
            .replace(/_/g, '.');
        return new RegExp('^' + escaped + '$', caseInsensitive ? 'i' : '');
    }

    function compareValues(a, b) {
        const aNull = a === null || a === undefined;
        const bNull = b === null || b === undefined;
        if (aNull && bNull) return 0;
        if (aNull) return 1;
        if (bNull) return -1;
        if (typeof a === 'number' && typeof b === 'number') return a - b;
        const an = Number(a), bn = Number(b);
        if (!isNaN(an) && !isNaN(bn) && String(a).trim() !== '' && String(b).trim() !== '') return an - bn;
        return String(a).localeCompare(String(b), 'es');
    }

    function matchOne(row, col, op, value) {
        const current = row ? row[col] : undefined;
        switch (op) {
            case 'eq': return looseEqual(current, value);
            case 'neq': return !looseEqual(current, value);
            case 'gt': return compareValues(current, value) > 0;
            case 'gte': return compareValues(current, value) >= 0;
            case 'lt': return compareValues(current, value) < 0;
            case 'lte': return compareValues(current, value) <= 0;
            case 'is': {
                const v = String(value).toLowerCase();
                if (v === 'null') return current === null || current === undefined;
                if (v === 'true') return current === true;
                if (v === 'false') return current === false;
                return looseEqual(current, value);
            }
            case 'in': {
                const list = parseInList(value);
                return list.some(item => looseEqual(current, item));
            }
            case 'like': return likeToRegex(value, false).test(String(current == null ? '' : current));
            case 'ilike': return likeToRegex(value, true).test(String(current == null ? '' : current));
            case 'contains': {
                if (Array.isArray(current)) {
                    const wanted = Array.isArray(value) ? value : parseInList(value);
                    return wanted.every(w => current.some(c => looseEqual(c, w)));
                }
                if (current && typeof current === 'object') {
                    try {
                        const wanted = typeof value === 'string' ? JSON.parse(value) : value;
                        return Object.keys(wanted || {}).every(k => looseEqual(current[k], wanted[k]));
                    } catch (e) { return false; }
                }
                return String(current == null ? '' : current).includes(String(value));
            }
            default: return true;
        }
    }

    function applyOrFilter(row, expression) {
        let expr = String(expression || '').trim();
        const wrapped = expr.match(/^(and|or)\((.*)\)$/i);
        if (wrapped) expr = wrapped[2];
        const parts = splitTopLevel(expr, ',');
        return parts.some(part => {
            const m = String(part).trim().match(/^([A-Za-z0-9_]+)\.([a-z]+)\.(.*)$/);
            if (!m) return false;
            return matchOne(row, m[1], m[2], unquote(m[3]));
        });
    }

    function projectRow(row, selectStr) {
        if (!selectStr || selectStr.trim() === '*' || selectStr.indexOf('*') !== -1) return row;
        const cols = splitTopLevel(selectStr, ',').map(s => s.trim()).filter(s => s && !s.includes('('));
        if (!cols.length) return row;
        const out = {};
        cols.forEach(c => { out[c] = row[c]; });
        return out;
    }

    // Convierte `select('*, deck_cards(section)')` en [{name:'deck_cards', cols:'section'}]
    function parseRelations(selectStr) {
        const rels = [];
        let i = 0;
        const s = String(selectStr || '');
        while (i < s.length) {
            const open = s.indexOf('(', i);
            if (open === -1) break;
            let depth = 0, close = -1;
            for (let j = open; j < s.length; j++) {
                if (s[j] === '(') depth++;
                else if (s[j] === ')') { depth--; if (depth === 0) { close = j; break; } }
            }
            if (close === -1) break;
            const before = s.slice(0, open);
            const nameMatch = before.match(/([A-Za-z0-9_]+)\s*$/);
            if (nameMatch) {
                rels.push({ name: nameMatch[1], cols: s.slice(open + 1, close) });
            }
            i = close + 1;
        }
        return rels;
    }

    function attachRelations(rows, table, selectStr) {
        const rels = parseRelations(selectStr);
        if (!rels.length) return rows;
        return rows.map(row => {
            const copy = Object.assign({}, row);
            rels.forEach(rel => {
                const childTable = rel.name;
                const fk = RELATION_FK[childTable] || (singular(table) + '_id');
                const children = (OfflineData.tables[childTable] || [])
                    .filter(child => looseEqual(child[fk], row.id))
                    .map(child => projectRow(child, rel.cols));
                copy[childTable] = children;
            });
            return copy;
        });
    }

    // ------------------------------------------------------------- builder
    class OfflineQuery {
        constructor(table) {
            this.table = table;
            this.filters = [];
            this.orFilters = [];
            this.orders = [];
            this.limitN = null;
            this.rangeN = null;
            this.singleMode = null;
            this.selectStr = '*';
            this.op = 'select';
            this.payload = null;
            this.wantCount = false;
            this.headOnly = false;
        }

        select(str, opts) {
            if (this.op === 'select') this.selectStr = str || '*';
            if (opts && opts.count === 'exact') this.wantCount = true;
            if (opts && opts.head) this.headOnly = true;
            return this;
        }

        eq(col, value) { this.filters.push(['eq', col, value]); return this; }
        neq(col, value) { this.filters.push(['neq', col, value]); return this; }
        gt(col, value) { this.filters.push(['gt', col, value]); return this; }
        gte(col, value) { this.filters.push(['gte', col, value]); return this; }
        lt(col, value) { this.filters.push(['lt', col, value]); return this; }
        lte(col, value) { this.filters.push(['lte', col, value]); return this; }
        is(col, value) { this.filters.push(['is', col, value]); return this; }
        in(col, value) { this.filters.push(['in', col, value]); return this; }
        like(col, value) { this.filters.push(['like', col, value]); return this; }
        ilike(col, value) { this.filters.push(['ilike', col, value]); return this; }
        contains(col, value) { this.filters.push(['contains', col, value]); return this; }
        filter(col, op, value) { this.filters.push([op, col, value]); return this; }
        match(obj) {
            Object.keys(obj || {}).forEach(k => this.filters.push(['eq', k, obj[k]]));
            return this;
        }
        or(expression) { this.orFilters.push(expression); return this; }
        order(col, opts) {
            this.orders.push([col, opts && opts.ascending === false ? -1 : 1]);
            return this;
        }
        limit(n) { this.limitN = n; return this; }
        range(from, to) { this.rangeN = [from, to]; return this; }
        single() { this.singleMode = 'single'; return this; }
        maybeSingle() { this.singleMode = 'maybe'; return this; }

        insert(rows) { this.op = 'insert'; this.payload = rows; return this; }
        update(values) { this.op = 'update'; this.payload = values; return this; }
        upsert(rows) { this.op = 'upsert'; this.payload = rows; return this; }
        delete() { this.op = 'delete'; return this; }

        then(onFulfilled, onRejected) {
            return this.run().then(onFulfilled, onRejected);
        }

        catch(onRejected) {
            return this.run().catch(onRejected);
        }

        async run() {
            await OfflineData.ready();

            if (this.op !== 'select') {
                return {
                    data: null,
                    error: {
                        code: 'OFFLINE_READONLY',
                        message: 'Modo sin conexión: la vista es de solo lectura.'
                    }
                };
            }

            let rows = (OfflineData.tables[this.table] || []).slice();

            rows = rows.filter(row => this.filters.every(f => matchOne(row, f[1], f[0], f[2])));
            if (this.orFilters.length) {
                rows = rows.filter(row => this.orFilters.every(expr => applyOrFilter(row, expr)));
            }

            if (this.orders.length) {
                rows.sort((a, b) => {
                    for (const [col, dir] of this.orders) {
                        const cmp = compareValues(a[col], b[col]);
                        if (cmp !== 0) return cmp * dir;
                    }
                    return 0;
                });
            }

            const total = rows.length;

            if (this.rangeN) rows = rows.slice(this.rangeN[0], this.rangeN[1] + 1);
            else if (this.limitN !== null) rows = rows.slice(0, this.limitN);

            if (this.headOnly) {
                return { data: null, count: this.wantCount ? total : null, error: null, status: 200 };
            }

            rows = rows.map(row => projectRow(row, this.selectStr));
            rows = attachRelations(rows, this.table, this.selectStr);

            if (this.singleMode) {
                if (!rows.length) {
                    if (this.singleMode === 'maybe') return { data: null, error: null, count: this.wantCount ? total : null, status: 200 };
                    return {
                        data: null,
                        error: { code: 'PGRST116', message: 'No se encontraron filas', details: '0 rows' },
                        count: 0,
                        status: 406
                    };
                }
                return { data: rows[0], error: null, count: this.wantCount ? total : null, status: 200 };
            }

            return { data: rows, error: null, count: this.wantCount ? total : null, status: 200 };
        }
    }

    // ------------------------------------------------------------- cliente
    function makeChannel() {
        const channel = {
            on() { return channel; },
            off() { return channel; },
            subscribe(cb) {
                if (typeof cb === 'function') setTimeout(() => cb('SUBSCRIBED'), 0);
                return channel;
            },
            unsubscribe() { return Promise.resolve('ok'); },
            send() { return Promise.resolve('ok'); },
            track() { return Promise.resolve('ok'); },
            untrack() { return Promise.resolve('ok'); },
            presenceState() { return {}; }
        };
        return channel;
    }

    const offlineClient = {
        from(table) { return new OfflineQuery(table); },

        rpc(name, params) {
            // get_login_email y similares no tienen sentido sin conexión.
            return Promise.resolve({ data: null, error: null });
        },

        channel() { return makeChannel(); },
        removeChannel() { return Promise.resolve('ok'); },
        removeAllChannels() { return Promise.resolve([]); },
        getChannels() { return []; },

        auth: {
            async getSession() {
                await OfflineData.ready();
                return { data: { session: OfflineData.session() }, error: null };
            },
            async getUser() {
                await OfflineData.ready();
                const session = OfflineData.session();
                return { data: { user: session ? session.user : null }, error: null };
            },
            onAuthStateChange(cb) {
                OfflineData.ready().then(() => {
                    if (typeof cb === 'function') setTimeout(() => cb('SIGNED_IN', OfflineData.session()), 0);
                });
                return { data: { subscription: { unsubscribe() {} } } };
            },
            async signOut() { return { error: null }; },
            async signInWithPassword() {
                return { data: null, error: { message: 'Sin conexión: no se puede iniciar sesión.' } };
            },
            async signUp() {
                return { data: null, error: { message: 'Sin conexión: no se puede registrar.' } };
            },
            async resetPasswordForEmail() {
                return { data: null, error: { message: 'Sin conexión.' } };
            }
        },

        storage: {
            from() {
                return {
                    async upload() { return { data: null, error: { message: 'Sin conexión.' } }; },
                    async remove() { return { data: null, error: { message: 'Sin conexión.' } }; },
                    getPublicUrl(path) {
                        return { data: { publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${path}` } };
                    }
                };
            }
        },

        functions: {
            async invoke() { return { data: null, error: { message: 'Sin conexión.' } }; }
        }
    };

    window._supabase = offlineClient;
    // Algunas vistas crean su propio cliente con window.supabase.createClient().
    window.supabase = {
        createClient() { return offlineClient; }
    };

    // Igual que en supabase-config.js, pero sin registrar el Service Worker del
    // sitio: el modo offline usa su propio worker en /offline/offline-sw.js.
    if (typeof Swal !== 'undefined') {
        window.Swal = Swal.mixin({ position: 'top', showConfirmButton: true });
    }
})();
