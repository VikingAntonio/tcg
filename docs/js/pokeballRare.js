/**
 * Pokeball Rare Effect Mask Generator & Initialization
 */

(function() {
    function initPokeballRare() {
        const maskImgSrc = 'img/mascaraPB.png';
        const img = new Image();
        img.src = maskImgSrc;
        img.crossOrigin = 'Anonymous';

        img.onload = function() {
            const width = img.width;
            const height = img.height;

            // Create canvases for processing
            const canvasWhite = document.createElement('canvas');
            const canvasRed = document.createElement('canvas');
            canvasWhite.width = width;
            canvasWhite.height = height;
            canvasRed.width = width;
            canvasRed.height = height;

            const ctxWhite = canvasWhite.getContext('2d');
            const ctxRed = canvasRed.getContext('2d');

            // Draw the original image to get pixels
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(img, 0, 0);

            const imgData = tempCtx.getImageData(0, 0, width, height);
            const data = imgData.data;

            // Create ImageData objects for output
            const whiteData = ctxWhite.createImageData(width, height);
            const redData = ctxRed.createImageData(width, height);

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i+1];
                const b = data[i+2];
                const a = data[i+3];

                // If it's background/black outline
                if (r < 40 && g < 40 && b < 40) {
                    whiteData.data[i] = 0;
                    whiteData.data[i+1] = 0;
                    whiteData.data[i+2] = 0;
                    whiteData.data[i+3] = 0;

                    redData.data[i] = 0;
                    redData.data[i+1] = 0;
                    redData.data[i+2] = 0;
                    redData.data[i+3] = 0;
                } else {
                    // Check if reddish: R is high, G and B are significantly smaller
                    const isRed = (r > 80 && r > g * 1.3 && r > b * 1.3);

                    if (isRed) {
                        // Put in Red Mask (solid white mask over red parts)
                        redData.data[i] = 255;
                        redData.data[i+1] = 255;
                        redData.data[i+2] = 255;
                        redData.data[i+3] = a;

                        // Transparent in White Mask
                        whiteData.data[i] = 0;
                        whiteData.data[i+1] = 0;
                        whiteData.data[i+2] = 0;
                        whiteData.data[i+3] = 0;
                    } else {
                        // Put in White Mask (solid white mask over white/gray parts)
                        whiteData.data[i] = 255;
                        whiteData.data[i+1] = 255;
                        whiteData.data[i+2] = 255;
                        whiteData.data[i+3] = a;

                        // Transparent in Red Mask
                        redData.data[i] = 0;
                        redData.data[i+1] = 0;
                        redData.data[i+2] = 0;
                        redData.data[i+3] = 0;
                    }
                }
            }

            ctxWhite.putImageData(whiteData, 0, 0);
            ctxRed.putImageData(redData, 0, 0);

            const whiteMaskUrl = canvasWhite.toDataURL('image/png');
            const redMaskUrl = canvasRed.toDataURL('image/png');

            document.documentElement.style.setProperty('--pokeball-white-mask', 'url(' + whiteMaskUrl + ')');
            document.documentElement.style.setProperty('--pokeball-red-mask', 'url(' + redMaskUrl + ')');

            console.log('Pokeball Rare masks successfully generated and injected.');
        };

        img.onerror = function() {
            console.error('Failed to load Pokeball Rare mask image:', maskImgSrc);
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPokeballRare);
    } else {
        initPokeballRare();
    }
})();
