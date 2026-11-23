const MediaUpload = {
    cloudName: "de3n9pg8x",
    uploadPreset: "vikingdevBdd",
    // El servidor rechaza archivos raw de más de 10 MiB
    // ("File size too large. Got 13000000. Maximum is 10485760."). Se comprueba
    // antes de subir nada para no dejar archivos sueltos si uno es demasiado
    // grande. Subir este valor si se pasa a un plan de pago.
    maxRawBytes: 10 * 1024 * 1024,

    async uploadImage(file) {
        const url = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', this.uploadPreset);

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Error al subir la imagen');
            }

            const data = await response.json();
            if (data.delete_token && data.secure_url) {
                try {
                    const savedTokens = JSON.parse(localStorage.getItem('cloudinary_delete_tokens') || '{}');
                    savedTokens[data.secure_url] = data.delete_token;
                    localStorage.setItem('cloudinary_delete_tokens', JSON.stringify(savedTokens));
                } catch (e) {
                    console.error('Error saving delete token to localStorage:', e);
                }
            }
            return data.secure_url;
        } catch (error) {
            console.error('Upload Error:', error);
            throw error;
        }
    },

    async uploadRaw(file, publicId) {
        const url = `https://api.cloudinary.com/v1_1/${this.cloudName}/raw/upload`;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', this.uploadPreset);
        if (publicId) formData.append('public_id', publicId);

        const response = await fetch(url, { method: 'POST', body: formData });
        if (!response.ok) {
            let message = 'Error al subir el archivo';
            try {
                const error = await response.json();
                message = error?.error?.message || message;
            } catch (e) {}
            throw new Error(message);
        }
        return response.json();
    },

    // Sube un modelo 3D completo (raw) y devuelve la URL del
    // .gltf/.glb principal. El servidor rechaza la extensión .bin, así que los
    // buffers se suben como .glbin y se reescribe la referencia dentro del
    // .gltf. Todo va a una carpeta única para que las rutas relativas sigan
    // funcionando y la URL sea inmutable (se sirve con max-age=30d).
    async uploadModelFiles(files) {
        const list = Array.from(files || []);
        const main = list.find(f => /\.(gltf|glb)$/i.test(f.name || ''));
        if (!main) throw new Error('Falta el archivo principal .gltf o .glb');

        const tooBig = list.find(f => (f.size || 0) > this.maxRawBytes);
        if (tooBig) {
            const mb = ((tooBig.size || 0) / 1048576).toFixed(1);
            throw new Error(`"${tooBig.name}" pesa ${mb} MB y el servidor acepta hasta ${(this.maxRawBytes / 1048576).toFixed(0)} MB`);
        }

        const folder = `spirits/models/${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const renamed = new Map();
        const uploaded = [];

        for (const file of list) {
            if (file === main) continue;
            let name = file.name;
            let body = file;
            if (/\.bin$/i.test(name)) {
                name = name.replace(/\.bin$/i, '.glbin');
                body = new File([file], name, { type: 'application/octet-stream' });
                renamed.set(file.name, name);
                try { renamed.set(decodeURIComponent(file.name), name); } catch (e) {}
            }
            const data = await this.uploadRaw(body, `${folder}/${name}`);
            uploaded.push({ original: file.name, name, url: data.secure_url });
        }

        let mainBody = main;
        if (/\.gltf$/i.test(main.name) && renamed.size > 0) {
            const json = JSON.parse(await main.text());
            (json.buffers || []).forEach(buffer => {
                if (!buffer.uri || buffer.uri.startsWith('data:')) return;
                if (renamed.has(buffer.uri)) {
                    buffer.uri = renamed.get(buffer.uri);
                    return;
                }
                const base = decodeURIComponent(buffer.uri.split('/').pop());
                if (renamed.has(base)) buffer.uri = buffer.uri.replace(base, renamed.get(base));
            });
            mainBody = new File([JSON.stringify(json)], main.name, { type: 'model/gltf+json' });
        }

        const data = await this.uploadRaw(mainBody, `${folder}/${main.name}`);
        return { url: data.secure_url, folder, files: uploaded };
    },

    async deleteImage(secureUrl) {
        if (!secureUrl || typeof secureUrl !== 'string' || !secureUrl.includes('cloudinary.com')) return;

        try {
            const savedTokens = JSON.parse(localStorage.getItem('cloudinary_delete_tokens') || '{}');
            const token = savedTokens[secureUrl];
            if (!token) return;

            const deleteUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/delete_by_token`;
            const response = await fetch(deleteUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
            });

            if (response.ok) {
                delete savedTokens[secureUrl];
                localStorage.setItem('cloudinary_delete_tokens', JSON.stringify(savedTokens));
                console.log('Image deleted successfully using delete token');
            } else {
                console.warn('Could not delete image (token might have expired):', await response.text());
            }
        } catch (error) {
            console.error('Error in deleteImage:', error);
        }
    }
};

// Expose on window too: `const` creates a lexical global, not a window property,
// so `window.MediaUpload` was undefined in code that guards on it.
window.MediaUpload = MediaUpload;
