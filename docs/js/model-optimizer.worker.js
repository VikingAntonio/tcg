// Worker del optimizador de modelos 3D.
// Reproduce el pipeline de `gltf-transform optimize` que se aplicó a mano a los
// asistentes: soldar/deduplicar, simplificar la malla al 8 %, reducir texturas a
// 1024 px y comprimir la geometría con Draco. Devuelve un único .glb.
//
// Corre en un Worker a propósito: un modelo de 13 MB bloquea el hilo principal
// varios segundos, y si se queda sin memoria se cae el worker, no la pestaña.

const CDN = 'https://esm.sh';
const VERSION = '4.5.1';
const DRACO_BASE = 'https://cdn.jsdelivr.net/npm/draco3d@1.5.7/';
const SIMPLIFY_RATIO = 0.08;
const SIMPLIFY_ERROR = 0.001;
const MAX_VERTICES = 800000;
const MAX_TEXTURE = 1024;
const PREVIEW_SIZE = 512;

const post = (msg, transfer) => self.postMessage(msg, transfer || []);
const progress = (message) => post({ type: 'progress', message });

self.onmessage = async (event) => {
    try {
        await run(event.data || {});
    } catch (err) {
        post({ type: 'error', message: String((err && err.message) || err) });
    }
};

function countVertices(doc) {
    let total = 0;
    for (const mesh of doc.getRoot().listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
            const position = prim.getAttribute('POSITION');
            total += position ? position.getCount() : 0;
        }
    }
    return total;
}

function textureToBlob(bytes, mime) {
    return new Blob([bytes], { type: mime || 'image/png' });
}

// Redimensiona en el propio worker con OffscreenCanvas; si el navegador no lo
// trae (Safari antiguo) se dejan las texturas como estaban.
async function shrinkTextures(doc) {
    if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return;
    for (const texture of doc.getRoot().listTextures()) {
        const bytes = texture.getImage();
        const mime = texture.getMimeType() || 'image/png';
        if (!bytes || !/^image\//.test(mime) || bytes.byteLength < 40000) continue;
        try {
            const bitmap = await createImageBitmap(textureToBlob(bytes, mime));
            const side = Math.max(bitmap.width, bitmap.height);
            if (side <= MAX_TEXTURE) { bitmap.close && bitmap.close(); continue; }
            const scale = MAX_TEXTURE / side;
            const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            bitmap.close && bitmap.close();
            // PNG conserva el alpha (algunos materiales lo usan); JPEG para el resto.
            const type = /png|webp/i.test(mime) ? 'image/png' : 'image/jpeg';
            const blob = await canvas.convertToBlob({ type, quality: 0.85 });
            texture.setImage(new Uint8Array(await blob.arrayBuffer()));
            texture.setMimeType(type);
        } catch (err) {
            // Una textura rara no debe tumbar la optimización completa.
        }
    }
}

async function buildPreview(doc) {
    if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return null;
    const textures = doc.getRoot().listTextures()
        .filter(t => t.getImage() && /^image\//.test(t.getMimeType() || 'image/png'))
        .sort((a, b) => b.getImage().byteLength - a.getImage().byteLength);
    if (!textures.length) return null;
    const source = textures[0];
    try {
        const bitmap = await createImageBitmap(textureToBlob(source.getImage(), source.getMimeType()));
        const side = Math.max(bitmap.width, bitmap.height);
        const scale = side > PREVIEW_SIZE ? PREVIEW_SIZE / side : 1;
        const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close && bitmap.close();
        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
        return { buffer: await blob.arrayBuffer(), type: 'image/jpeg' };
    } catch (err) {
        return null;
    }
}

async function run({ files = [], requestPreview = false, nameHint = '' } = {}) {
    const main = files.find(f => /\.(gltf|glb)$/i.test(f.name || ''));
    if (!main) { post({ type: 'skip', reason: 'No hay archivo .gltf o .glb' }); return; }

    progress('Cargando compresor…');
    const [{ WebIO }, fns, ext, meshopt, draco] = await Promise.all([
        import(`${CDN}/@gltf-transform/core@${VERSION}`),
        import(`${CDN}/@gltf-transform/functions@${VERSION}`),
        import(`${CDN}/@gltf-transform/extensions@${VERSION}`),
        import(`${CDN}/meshoptimizer@0.22.0`),
        import(`${CDN}/draco3d@1.5.7`)
    ]);

    const dracoModule = draco.default || draco;
    const locateFile = (path) => DRACO_BASE + String(path).split('/').pop();
    const encoder = await dracoModule.createEncoderModule({ locateFile });
    const decoder = await dracoModule.createDecoderModule({ locateFile });
    await meshopt.MeshoptSimplifier.ready;

    const io = new WebIO()
        .registerExtensions(ext.ALL_EXTENSIONS)
        .registerDependencies({ 'draco3d.encoder': encoder, 'draco3d.decoder': decoder });

    progress('Leyendo modelo…');
    const resources = {};
    for (const file of files) {
        if (file === main) continue;
        const data = new Uint8Array(file.buffer);
        resources[file.name] = data;
        try { resources[decodeURIComponent(file.name)] = data; } catch (_) {}
        const base = file.name.split('/').pop();
        if (base && !resources[base]) resources[base] = data;
    }

    let doc;
    if (/\.glb$/i.test(main.name)) {
        doc = await io.readBinary(new Uint8Array(main.buffer), resources);
    } else {
        const json = JSON.parse(new TextDecoder().decode(new Uint8Array(main.buffer)));
        doc = await io.readJSON({ json, resources });
    }

    const verticesBefore = countVertices(doc);
    if (!verticesBefore || verticesBefore <= MAX_VERTICES) {
        post({ type: 'skip', reason: `El modelo ya es ligero (${verticesBefore.toLocaleString('es-MX')} vértices)` });
        return;
    }

    progress(`Simplificando ${verticesBefore.toLocaleString('es-MX')} vértices…`);
    try { await doc.transform(fns.weld(), fns.dedup()); } catch (err) {}
    try {
        await doc.transform(fns.simplify({
            simplifier: meshopt.MeshoptSimplifier,
            ratio: SIMPLIFY_RATIO,
            error: SIMPLIFY_ERROR
        }));
    } catch (err) {
        try { await doc.transform(fns.simplify({ ratio: SIMPLIFY_RATIO })); } catch (err2) {}
    }
    try { await doc.transform(fns.prune()); } catch (err) {}

    progress('Reduciendo texturas…');
    await shrinkTextures(doc);

    progress('Comprimiendo geometría…');
    try { await doc.transform(fns.draco({ method: 'edgebreaker' })); } catch (err) {}

    const preview = requestPreview ? await buildPreview(doc) : null;

    progress('Empaquetando…');
    const glb = await io.writeBinary(doc);
    const verticesAfter = countVertices(doc);

    const outName = ((nameHint || main.name).replace(/\.(gltf|glb)$/i, '') || 'modelo') + '.glb';
    const outBuffer = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);

    const transfer = [outBuffer];
    if (preview) transfer.push(preview.buffer);

    post({
        type: 'done',
        name: outName,
        buffer: outBuffer,
        preview,
        stats: { verticesBefore, verticesAfter }
    }, transfer);
}
