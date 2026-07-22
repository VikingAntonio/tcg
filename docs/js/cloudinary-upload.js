const CloudinaryUpload = {
    cloudName: "de3n9pg8x",
    uploadPreset: "vikingdevBdd",

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
                    console.error('Error saving Cloudinary delete token to localStorage:', e);
                }
            }
            return data.secure_url;
        } catch (error) {
            console.error('Upload Error:', error);
            throw error;
        }
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
                console.log('Image deleted from Cloudinary successfully using delete token');
            } else {
                console.warn('Could not delete image from Cloudinary (token might have expired):', await response.text());
            }
        } catch (error) {
            console.error('Error in Cloudinary deleteImage:', error);
        }
    }
};
