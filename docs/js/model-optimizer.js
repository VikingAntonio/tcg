// Optimiza los modelos 3D antes de subirlos a Storage o al servidor alterno.
// Reduce la malla al 8 %, baja las texturas a 1024 px y comprime con Draco: el
// resultado es un único .glb (una petición en vez de .gltf + .bin + texturas).
//
// Si algo falla (navegador sin soporte, worker caído, timeout, modelo raro) se
// devuelven los archivos originales: la subida nunca se rompe por optimizar.
(function () {
    // El worker se resuelve contra la URL de este script, no la de la página:
    // así funciona igual desde la raíz que desde cualquier subcarpeta.
    const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';
    const WORKER_URL = SCRIPT_SRC
        ? new URL('model-optimizer.worker.js', SCRIPT_SRC).href
        : 'js/model-optimizer.worker.js';
    const MIN_BYTES = 1.2 * 1024 * 1024;
    const TIMEOUT_MS = 180000;

    const alreadyOptimized = new WeakSet();

    function canRun() {
        return typeof Worker !== 'undefined' && typeof URL !== 'undefined' && typeof Blob !== 'undefined';
    }

    function watchdog(worker, ms) {
        let timer = null;
        const promise = new Promise((_, reject) => {
            timer = setTimeout(() => {
                try { worker.terminate(); } catch (_) {}
                reject(new Error('La optimización tardó demasiado'));
            }, ms);
        });
        return { promise, clear: () => clearTimeout(timer) };
    }

    /**
     * @param {File[]} files  archivos elegidos por el usuario (.gltf/.glb + extras)
     * @param {(msg: string) => void} [onProgress]
     * @param {{ requestPreview?: boolean, nameHint?: string }} [options]
     * @returns {Promise<{files: File[], preview: File|null, stats: object|null, skipped?: string}>}
     */
    async function optimize(files, onProgress = () => {}, options = {}) {
        const list = Array.from(files || []).filter(Boolean);
        const main = list.find(f => /\.(gltf|glb)$/i.test(f.name || ''));
        const unchanged = (skipped) => ({ files: list, preview: null, stats: null, skipped });

        if (!main) return unchanged('No hay modelo 3D');
        if (alreadyOptimized.has(main)) return unchanged('Ya optimizado');
        if (!canRun()) return unchanged('Navegador sin soporte');

        const totalBytes = list.reduce((acc, f) => acc + (f.size || 0), 0);
        if (totalBytes < MIN_BYTES) return unchanged('El archivo ya es pequeño');

        const payload = [];
        for (const file of list) {
            payload.push({ name: file.name, buffer: await file.arrayBuffer() });
        }

        let worker;
        try {
            worker = new Worker(WORKER_URL, { type: 'module' });
        } catch (err) {
            console.warn('[ModelOptimizer] Sin worker, se sube el modelo original:', err);
            return unchanged('Navegador sin soporte');
        }
        const timeout = watchdog(worker, TIMEOUT_MS);

        try {
            const result = await Promise.race([new Promise((resolve, reject) => {
                worker.onmessage = (event) => {
                    const msg = event.data || {};
                    if (msg.type === 'progress') { onProgress(msg.message); return; }
                    if (msg.type === 'skip') { resolve({ type: 'skip', reason: msg.reason }); return; }
                    if (msg.type === 'error') { reject(new Error(msg.message)); return; }
                    if (msg.type === 'done') { resolve(msg); return; }
                };
                worker.onerror = (event) => reject(new Error((event && event.message) || 'El worker falló'));
                worker.postMessage({
                    files: payload,
                    requestPreview: !!options.requestPreview,
                    nameHint: options.nameHint || ''
                }, payload.map(p => p.buffer));
            }), timeout.promise]);

            if (result.type === 'skip') return unchanged(result.reason || 'No requiere optimización');

            const glbFile = new File([result.buffer], result.name, { type: 'model/gltf-binary' });
            alreadyOptimized.add(glbFile);
            const preview = result.preview
                ? new File([result.preview.buffer], result.name.replace(/\.glb$/i, '-preview.jpg'), { type: 'image/jpeg' })
                : null;

            return {
                files: [glbFile],
                preview,
                stats: {
                    originalBytes: totalBytes,
                    optimizedBytes: glbFile.size,
                    verticesBefore: result.stats?.verticesBefore || 0,
                    verticesAfter: result.stats?.verticesAfter || 0
                }
            };
        } catch (err) {
            console.warn('[ModelOptimizer] Se sube el modelo original:', err);
            return unchanged('No se pudo optimizar');
        } finally {
            timeout.clear();
            try { worker.terminate(); } catch (_) {}
        }
    }

    function formatStats(stats) {
        if (!stats) return '';
        const mb = (bytes) => (bytes / 1048576).toFixed(2) + ' MB';
        const pct = stats.originalBytes > 0
            ? Math.round((1 - stats.optimizedBytes / stats.originalBytes) * 100)
            : 0;
        return `${mb(stats.originalBytes)} → ${mb(stats.optimizedBytes)} (−${pct} %)`;
    }

    window.ModelOptimizer = { optimize, formatStats, isAvailable: canRun };
})();
