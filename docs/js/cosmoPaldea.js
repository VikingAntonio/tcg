/**
 * Cosmo Holo Paldea Foil Effect Mask Generator & Initialization
 */

(function() {
    function initCosmoPaldea() {
        const maskImgSrc = 'img/cosmoV2.png';
        const img = new Image();
        img.src = maskImgSrc;
        img.crossOrigin = 'Anonymous';

        img.onload = function() {
            const width = img.width;
            const height = img.height;

            // Create canvas for processing
            const canvasMask = document.createElement('canvas');
            canvasMask.width = width;
            canvasMask.height = height;

            const ctxMask = canvasMask.getContext('2d');

            // Draw the original image to get pixels
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(img, 0, 0);

            const imgData = tempCtx.getImageData(0, 0, width, height);
            const data = imgData.data;

            // Create ImageData object for output
            const maskData = ctxMask.createImageData(width, height);

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i+1];
                const b = data[i+2];
                const a = data[i+3];

                // If it's dark background
                if (r < 50 && g < 50 && b < 50) {
                    maskData.data[i] = 0;
                    maskData.data[i+1] = 0;
                    maskData.data[i+2] = 0;
                    maskData.data[i+3] = 0;
                } else {
                    // It is a white/light area, apply mask
                    maskData.data[i] = 255;
                    maskData.data[i+1] = 255;
                    maskData.data[i+2] = 255;
                    maskData.data[i+3] = a;
                }
            }

            ctxMask.putImageData(maskData, 0, 0);

            const maskUrl = canvasMask.toDataURL('image/png');

            document.documentElement.style.setProperty('--cosmo-paldea-mask', 'url(' + maskUrl + ')');

            console.log('Cosmo Holo Paldea mask successfully generated and injected.');
        };

        img.onerror = function() {
            console.error('Failed to load Cosmo Holo Paldea mask image:', maskImgSrc);
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCosmoPaldea);
    } else {
        initCosmoPaldea();
    }
})();
