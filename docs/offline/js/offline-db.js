// Almacenamiento local del modo sin conexión.
// Guarda una copia de las tablas (decks, binders, inversiones...), los metadatos
// de la última sincronización y los blobs de las imágenes. Todo en IndexedDB:
// el Service Worker del sitio borra las cachés que no conoce, así que Cache
// Storage no sirve para guardar nada permanente.
(function () {
    const DB_NAME = 'viking-offline';
    const DB_VERSION = 2;
    const STORE_META = 'meta';
    const STORE_TABLES = 'tables';
    const STORE_IMAGES = 'images';

    let dbPromise = null;

    function open() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
                if (!db.objectStoreNames.contains(STORE_TABLES)) db.createObjectStore(STORE_TABLES);
                if (!db.objectStoreNames.contains(STORE_IMAGES)) db.createObjectStore(STORE_IMAGES);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return dbPromise;
    }

    function tx(store, mode, fn) {
        return open().then(db => new Promise((resolve, reject) => {
            const transaction = db.transaction(store, mode);
            const os = transaction.objectStore(store);
            let result;
            try {
                result = fn(os);
            } catch (e) {
                reject(e);
                return;
            }
            transaction.oncomplete = () => resolve(result);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        }));
    }

    const OfflineDB = {
        open,

        async getMeta(key) {
            const db = await open();
            return new Promise((resolve, reject) => {
                const req = db.transaction(STORE_META, 'readonly').objectStore(STORE_META).get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        },

        async setMeta(key, value) {
            const db = await open();
            return new Promise((resolve, reject) => {
                const req = db.transaction(STORE_META, 'readwrite').objectStore(STORE_META).put(value, key);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        },

        async getTable(name) {
            const db = await open();
            return new Promise((resolve, reject) => {
                const req = db.transaction(STORE_TABLES, 'readonly').objectStore(STORE_TABLES).get(name);
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });
        },

        async putTable(name, rows) {
            const db = await open();
            return new Promise((resolve, reject) => {
                const req = db.transaction(STORE_TABLES, 'readwrite').objectStore(STORE_TABLES).put(rows, name);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        },

        async getTables() {
            const db = await open();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_TABLES, 'readonly');
                const os = transaction.objectStore(STORE_TABLES);
                const out = {};
                const cursorReq = os.openCursor();
                cursorReq.onsuccess = () => {
                    const cursor = cursorReq.result;
                    if (cursor) {
                        out[cursor.key] = cursor.value;
                        cursor.continue();
                    }
                };
                transaction.oncomplete = () => resolve(out);
                transaction.onerror = () => reject(transaction.error);
            });
        },

        async hasImage(key) {
            const db = await open();
            return new Promise((resolve, reject) => {
                const req = db.transaction(STORE_IMAGES, 'readonly').objectStore(STORE_IMAGES).count(key);
                req.onsuccess = () => resolve(req.result > 0);
                req.onerror = () => reject(req.error);
            });
        },

        async putImage(key, blob) {
            const db = await open();
            return new Promise((resolve, reject) => {
                const req = db.transaction(STORE_IMAGES, 'readwrite').objectStore(STORE_IMAGES).put(blob, key);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        },

        async getImage(key) {
            const db = await open();
            return new Promise((resolve, reject) => {
                const req = db.transaction(STORE_IMAGES, 'readonly').objectStore(STORE_IMAGES).get(key);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error);
            });
        },

        async countImages() {
            const db = await open();
            return new Promise((resolve, reject) => {
                const req = db.transaction(STORE_IMAGES, 'readonly').objectStore(STORE_IMAGES).count();
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        },

        async clearImages() {
            return tx(STORE_IMAGES, 'readwrite', os => os.clear());
        },

        async clearAll() {
            await tx(STORE_META, 'readwrite', os => os.clear());
            await tx(STORE_TABLES, 'readwrite', os => os.clear());
            await tx(STORE_IMAGES, 'readwrite', os => os.clear());
        },

        async estimate() {
            if (!navigator.storage || !navigator.storage.estimate) return null;
            try { return await navigator.storage.estimate(); } catch (e) { return null; }
        }
    };

    window.OfflineDB = OfflineDB;
})();
