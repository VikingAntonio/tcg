// Interfaz del modo sin conexión: registro del Service Worker, panel de
// descarga/actualización y ajustes de la vista (sin carrito ni tienda).
(function () {
    const LS_STORE = 'tcg_offline_store';
    const LS_LAST_AUTO = 'tcg_offline_last_auto';
    const AUTO_SYNC_MS = 6 * 60 * 60 * 1000;

    const state = {
        syncing: false,
        repairingShell: false,
        abort: null,
        status: null,
        badgeTimer: null
    };

    function qs(sel) { return document.querySelector(sel); }

    function getStoreIdentifier() {
        const params = new URLSearchParams(location.search);
        return params.get('store') || params.get('id') || params.get('user') ||
            localStorage.getItem(LS_STORE) || '';
    }

    function saveStoreIdentifier(value) {
        if (!value) return;
        try { localStorage.setItem(LS_STORE, value); } catch (e) { /* ignore */ }
    }

    function formatDate(iso) {
        if (!iso) return 'nunca';
        try {
            return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
        } catch (e) { return iso; }
    }

    function formatBytes(bytes) {
        if (!bytes && bytes !== 0) return '—';
        const units = ['B', 'KB', 'MB', 'GB'];
        let value = bytes;
        let unit = 0;
        while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
        return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
    }

    // --------------------------------------------------------------- panel
    function buildPanel() {
        if (qs('#offline-panel')) return;

        const fab = document.createElement('button');
        fab.id = 'offline-fab';
        fab.type = 'button';
        fab.title = 'Copia sin conexión';
        fab.innerHTML = '<i class="fas fa-download"></i><span id="offline-fab-dot"></span>';
        document.body.appendChild(fab);

        const overlay = document.createElement('div');
        overlay.id = 'offline-panel';
        overlay.className = 'offline-overlay';
        overlay.innerHTML = `
            <div class="offline-card" role="dialog" aria-modal="true" aria-labelledby="offline-title">
                <button type="button" class="offline-close" id="offline-close" aria-label="Cerrar">&times;</button>
                <h2 id="offline-title"><i class="fas fa-wifi"></i> Modo sin conexión</h2>
                <p class="offline-lead">Descarga tus decks, binders e inversiones (datos e imágenes) para verlos en la tablet sin internet.</p>

                <label class="offline-field">
                    <span>Tienda o usuario</span>
                    <input type="text" id="offline-store-input" placeholder="ej. toonShop" autocomplete="off" spellcheck="false">
                </label>

                <label class="offline-field">
                    <span>Calidad de las imágenes</span>
                    <select id="offline-quality">
                        <option value="optimized">Optimizada (recomendada)</option>
                        <option value="high">Alta (más espacio)</option>
                    </select>
                </label>

                <div class="offline-actions">
                    <button type="button" class="offline-btn primary" id="offline-sync-btn">
                        <i class="fas fa-cloud-download-alt"></i> <span>Descargar / actualizar</span>
                    </button>
                    <button type="button" class="offline-btn" id="offline-clear-btn" title="Borrar la copia local">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>

                <div class="offline-progress" id="offline-progress" hidden>
                    <div class="offline-progress-track"><div class="offline-progress-bar" id="offline-progress-bar"></div></div>
                    <div class="offline-progress-text" id="offline-progress-text">Preparando…</div>
                </div>

                <div class="offline-status" id="offline-status"></div>
                <p class="offline-hint">Consejo: en la tablet usa «Añadir a pantalla de inicio» para abrirla como una app.</p>
            </div>
        `;
        document.body.appendChild(overlay);

        qs('#offline-fab').addEventListener('click', () => openPanel());
        qs('#offline-close').addEventListener('click', () => closePanel());
        overlay.addEventListener('click', e => { if (e.target === overlay) closePanel(); });

        qs('#offline-sync-btn').addEventListener('click', () => startSync({ interactive: true }));
        qs('#offline-clear-btn').addEventListener('click', clearData);

        const input = qs('#offline-store-input');
        input.value = getStoreIdentifier();
        input.addEventListener('change', () => saveStoreIdentifier(input.value.trim()));
    }

    function openPanel() {
        buildPanel();
        const overlay = qs('#offline-panel');
        overlay.classList.add('active');
        renderStatus();
    }

    function closePanel() {
        const overlay = qs('#offline-panel');
        if (overlay) overlay.classList.remove('active');
    }

    async function renderStatus() {
        const box = qs('#offline-status');
        if (!box) return;
        const status = await OfflineSync.getStatus();
        state.status = status;
        const meta = status.meta;

        if (!meta) {
            box.innerHTML = `
                <div class="offline-status-row"><span>Estado</span><strong>Sin copia descargada</strong></div>
                <div class="offline-status-note">Conéctate a internet y pulsa «Descargar / actualizar».</div>`;
        } else {
            const c = meta.counts || {};
            const usage = status.estimate && status.estimate.usage ? formatBytes(status.estimate.usage) : '—';
            box.innerHTML = `
                <div class="offline-status-row"><span>Tienda</span><strong>${escapeHtml(meta.storeName || meta.storeIdentifier || '—')}</strong></div>
                <div class="offline-status-row"><span>Última actualización</span><strong>${formatDate(meta.syncedAt)}</strong></div>
                <div class="offline-status-row"><span>Decks / cartas</span><strong>${c.decks || 0} / ${c.deckCards || 0}</strong></div>
                <div class="offline-status-row"><span>Binders / cartas</span><strong>${c.binders || 0} / ${c.binderCards || 0}</strong></div>
                <div class="offline-status-row"><span>Colecciones / cartas</span><strong>${c.investmentCategories || 0} / ${c.investmentCards || 0}</strong></div>
                <div class="offline-status-row"><span>Imágenes guardadas</span><strong>${status.imageCount}</strong></div>
                <div class="offline-status-row"><span>Espacio usado</span><strong>${usage}</strong></div>
                ${meta.images && meta.images.failed ? `<div class="offline-status-note warn">${meta.images.failed} imágenes no se pudieron descargar; vuelve a sincronizar con internet.</div>` : ''}
            `;
        }
        updateFab(meta);
        updateQualitySelect(meta);
    }

    function updateQualitySelect(meta) {
        const select = qs('#offline-quality');
        if (select && meta && meta.quality) select.value = meta.quality;
    }

    function updateFab(meta) {
        const dot = qs('#offline-fab-dot');
        if (!dot) return;
        dot.className = meta ? 'ok' : 'empty';
        dot.title = meta ? `Copia del ${formatDate(meta.syncedAt)}` : 'Sin copia';
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    // -------------------------------------------------------------- sync
    function setProgress(percent, text) {
        const box = qs('#offline-progress');
        const bar = qs('#offline-progress-bar');
        const label = qs('#offline-progress-text');
        if (!box) return;
        box.hidden = false;
        if (bar) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
        if (label) label.textContent = text;
    }

    function handleProgress(info) {
        if (!info) return;
        if (info.phase === 'store' || info.phase === 'data') {
            setProgress(12, info.message || 'Descargando datos…');
        } else if (info.phase === 'images') {
            const pct = info.total ? 15 + (info.done / info.total) * 70 : 30;
            setProgress(pct, `Imágenes ${info.done} / ${info.total}${info.failed ? ` · ${info.failed} con error` : ''}`);
        } else if (info.phase === 'shell') {
            const pct = 85 + (info.total ? (info.done / info.total) * 14 : 0);
            setProgress(pct, `Preparando la app ${info.done} / ${info.total}`);
        } else if (info.phase === 'done') {
            setProgress(100, info.message || 'Listo');
        }
    }

    async function startSync(options) {
        const opts = options || {};
        if (state.syncing) return;
        if (!navigator.onLine) {
            if (opts.interactive) alert('Necesitas internet para descargar o actualizar la copia.');
            return;
        }

        buildPanel();
        const input = qs('#offline-store-input');
        const identifier = (input && input.value.trim()) || getStoreIdentifier();
        if (!identifier) {
            openPanel();
            if (input) input.focus();
            return;
        }
        saveStoreIdentifier(identifier);

        const quality = (qs('#offline-quality') && qs('#offline-quality').value) || 'optimized';
        const syncBtn = qs('#offline-sync-btn');

        state.syncing = true;
        state.abort = new AbortController();
        if (syncBtn) { syncBtn.disabled = true; syncBtn.classList.add('loading'); }
        setProgress(2, 'Iniciando…');

        try {
            if (navigator.storage && navigator.storage.persist) {
                try { await navigator.storage.persist(); } catch (e) { /* opcional */ }
            }

            const result = await OfflineSync.run({
                store: identifier,
                quality,
                forceImages: false,
                onProgress: handleProgress,
                signal: state.abort.signal
            });

            setProgress(100, 'Copia sin conexión lista');
            if (opts.interactive) {
                setTimeout(() => {
                    if (window.Swal) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Listo',
                            html: `<div style="text-align:left;font-size:.9rem">
                                <div>Decks: <b>${result.counts.decks}</b> (${result.counts.deckCards} cartas)</div>
                                <div>Binders: <b>${result.counts.binders}</b> (${result.counts.binderCards} cartas)</div>
                                <div>Colecciones: <b>${result.counts.investmentCategories}</b> (${result.counts.investmentCards} cartas)</div>
                                <div>Imágenes: <b>${result.images.total - result.images.failed}</b> de ${result.images.total}</div>
                                <div style="margin-top:8px">Ya puedes usar la tablet sin internet.</div>
                            </div>`,
                            confirmButtonText: 'Ver ahora'
                        }).then(() => location.reload());
                    } else {
                        location.reload();
                    }
                }, 350);
            }
        } catch (err) {
            console.error('Error en la sincronización offline:', err);
            setProgress(0, 'Error: ' + (err && err.message ? err.message : 'no se pudo descargar'));
            if (opts.interactive) {
                if (window.Swal) {
                    Swal.fire({ icon: 'error', title: 'No se pudo descargar', text: (err && err.message) || 'Revisa tu conexión.' });
                } else {
                    alert('No se pudo descargar: ' + ((err && err.message) || ''));
                }
            }
        } finally {
            state.syncing = false;
            state.abort = null;
            if (syncBtn) { syncBtn.disabled = false; syncBtn.classList.remove('loading'); }
            renderStatus();
        }
    }

    async function clearData() {
        const confirmed = window.Swal
            ? (await Swal.fire({
                icon: 'warning',
                title: '¿Borrar la copia sin conexión?',
                text: 'Se eliminarán los datos y las imágenes descargadas.',
                showCancelButton: true,
                confirmButtonText: 'Sí, borrar',
                cancelButtonText: 'Cancelar'
            })).isConfirmed
            : confirm('¿Borrar la copia sin conexión?');

        if (!confirmed) return;
        await OfflineSync.clear();
        await renderStatus();
        if (window.Swal) Swal.fire({ icon: 'success', title: 'Copia borrada', timer: 1200, showConfirmButton: false });
    }

    // -------------------------------------------------------------- vista
    function tweakHomeMenu() {
        const grid = qs('#home-view .home-menu-grid');
        if (!grid) return;

        const allowed = ['binders', 'decks', 'investments'];
        Array.from(grid.querySelectorAll('.home-menu-item')).forEach(item => {
            if (!allowed.includes(item.dataset.view)) item.remove();
        });

        if (!qs('#offline-duel-tile')) {
            const duel = document.createElement('div');
            duel.className = 'home-menu-item tile-cyan';
            duel.id = 'offline-duel-tile';
            duel.innerHTML = '<span>Duelo 1 Jugador</span>';
            duel.addEventListener('click', () => { location.href = '/offline/configDuel.html'; });
            grid.appendChild(duel);
        }

        if (!qs('#offline-magic-tile')) {
            const magic = document.createElement('div');
            magic.className = 'home-menu-item tile-purple';
            magic.id = 'offline-magic-tile';
            magic.innerHTML = '<span>Magic</span>';
            magic.addEventListener('click', () => { location.href = '/offline/configMagic.html'; });
            grid.appendChild(magic);
        }
    }

    function updateConnectionBadge() {
        let badge = qs('#offline-connection-badge');
        if (!navigator.onLine) {
            if (!badge) {
                badge = document.createElement('div');
                badge.id = 'offline-connection-badge';
                badge.innerHTML = '<i class="fas fa-plane"></i> Sin conexión';
                document.body.appendChild(badge);
            }
            badge.style.display = '';
            badge.classList.remove('is-hidden');
            clearTimeout(state.badgeTimer);
            state.badgeTimer = setTimeout(() => badge.classList.add('is-hidden'), 6000);
        } else if (badge) {
            badge.style.display = 'none';
        }
    }

    function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        const hadController = !!navigator.serviceWorker.controller;

        navigator.serviceWorker.register('/offline/offline-sw.js', { scope: '/offline/' })
            .then(reg => {
                if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            })
            .catch(err => console.warn('Service Worker offline no registrado:', err && err.message));

        // Cuando el SW se actualiza y borra el caparazón viejo, se recarga una
        // sola vez para tomar los archivos nuevos.
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!hadController) return;
            if (sessionStorage.getItem('offline_sw_reloaded')) return;
            sessionStorage.setItem('offline_sw_reloaded', '1');
            location.reload();
        });
    }

    // En los configuradores de duelo, si el enlace trae ?deckId= se elige ese
    // deck automáticamente (la app solo lo agrega a la lista).
    async function preselectDeckFromUrl() {
        const params = new URLSearchParams(location.search);
        const deckId = params.get('deckId') || params.get('deck1');
        if (!deckId) return;
        if (!/configDuel/i.test(location.pathname)) return;

        for (let attempt = 0; attempt < 24; attempt++) {
            let applied = false;
            ['#practice-deck1', '#practice-deck2', '#host-deck'].forEach(selector => {
                const select = document.querySelector(selector);
                if (!select || !select.options.length) return;
                const option = Array.from(select.options).find(o => String(o.value) === String(deckId));
                if (!option) return;
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                const label = document.getElementById(selector.slice(1).replace(/^/, 'label-'));
                if (label) label.textContent = option.textContent;
                applied = true;
            });
            if (applied) return;
            await new Promise(resolve => setTimeout(resolve, 250));
        }
    }

    // Si el Service Worker borró el caparazón (versión nueva), se vuelve a
    // llenar en segundo plano sin volver a bajar imágenes.
    function purgeShellCache() {
        return new Promise(resolve => {
            const controller = navigator.serviceWorker && navigator.serviceWorker.controller;
            if (!controller) { resolve(); return; }
            try {
                const channel = new MessageChannel();
                channel.port1.onmessage = () => resolve();
                controller.postMessage({ type: 'PURGE_SHELL' }, [channel.port2]);
                setTimeout(resolve, 2000);
            } catch (e) { resolve(); }
        });
    }

    async function ensureShell() {
        if (!navigator.onLine || state.repairingShell) return;
        try {
            const status = await OfflineSync.getStatus();
            if (status.shell && status.shell.version === status.shellVersion) return;
            state.repairingShell = true;
            if (status.shell) await purgeShellCache();
            await OfflineSync.run({ store: getStoreIdentifier(), skipImages: true, onProgress: () => {} });
        } catch (e) {
            /* se reintenta en la próxima carga */
        } finally {
            state.repairingShell = false;
        }
    }

    function maybeAutoSync() {
        if (!navigator.onLine) return;
        const last = parseInt(localStorage.getItem(LS_LAST_AUTO) || '0', 10);
        if (Date.now() - last < AUTO_SYNC_MS) return;

        OfflineSync.getStatus().then(status => {
            const meta = status.meta;
            if (!meta) return;
            const age = Date.now() - new Date(meta.syncedAt).getTime();
            if (age < AUTO_SYNC_MS) return;
            localStorage.setItem(LS_LAST_AUTO, String(Date.now()));
            // Silencioso: si falla, la copia anterior sigue disponible.
            startSync({ interactive: false });
        });
    }

    function init() {
        document.body.classList.add('offline-app');
        buildPanel();
        tweakHomeMenu();
        updateConnectionBadge();
        registerServiceWorker();
        renderStatus();

        window.addEventListener('online', () => { updateConnectionBadge(); maybeAutoSync(); });
        window.addEventListener('offline', updateConnectionBadge);

        // Sin copia y sin tienda configurada: abrir el panel para guiar.
        preselectDeckFromUrl();

        OfflineSync.getStatus().then(status => {
            if (!status.meta) openPanel();
            else {
                ensureShell();
                // El Service Worker puede borrar el caparazón un instante
                // después de cargar la página; se revisa de nuevo.
                setTimeout(ensureShell, 5000);
                maybeAutoSync();
            }
        });
    }

    window.OfflineApp = {
        openPanel,
        closePanel,
        startSync,
        renderStatus,
        getStoreIdentifier,
        saveStoreIdentifier
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
