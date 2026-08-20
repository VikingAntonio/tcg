// --- TCGAPI.dev CONFIGURATION ---
window.TCG_API_KEY = 'tcg_live_830032ddb812433fc16a783454caaa5353708266';
window.TCG_API_BASE = 'https://api.tcgapi.dev/v1';

window.optimizeCloudinaryUrl = function(url, width = 500, height = 500) {
    if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return url;
    if (url.includes('/upload/w_') || url.includes('/upload/c_limit')) return url;

    return url.replace('/upload/', `/upload/w_${width},h_${height},c_limit,q_auto,f_auto/`);
};

// parseDateSafe.js - Shared date parsing utility
function parseDateSafe(dateStr) {
    if (!dateStr) return null;
    // Normalize "A" -> "AM", "P" -> "PM"
    let normalized = dateStr.replace(/ A$/, ' AM').replace(/ P$/, ' PM');

    let d = new Date(normalized);
    if (!isNaN(d.getTime())) return d;

    // Handle "YYYY-MM-DD hh:mm AM/PM"
    const regex = /^(\d{4})-(\d{2})-(\d{2}) (\d{1,2}):(\d{2}) (AM|PM)$/;
    const match = normalized.match(regex);
    if (match) {
        let [_, year, month, day, hours, minutes, meridiem] = match;
        year = parseInt(year);
        month = parseInt(month) - 1;
        day = parseInt(day);
        hours = parseInt(hours);
        minutes = parseInt(minutes);

        if (meridiem === 'PM' && hours < 12) hours += 12;
        if (meridiem === 'AM' && hours === 12) hours = 0;

        return new Date(year, month, day, hours, minutes);
    }

    // Try replacing space with T as fallback
    d = new Date(normalized.replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d;
}

window.parseDateSafe = parseDateSafe;

// --- Global Foil Application ---
window.POKEMON_FOILS = {
    'pk-rare-holo': 'rare holo', 'pk-rare-holo-cosmos': 'rare holo cosmos', 'pk-rare-holo-v': 'rare holo v',
    'pk-rare-holo-vmax': 'rare holo vmax', 'pk-rare-holo-vstar': 'rare holo vstar', 'pk-rare-rainbow': 'rare rainbow',
    'pk-rare-rainbow-alt': 'rare rainbow alt', 'pk-rare-secret': 'rare secret', 'pk-rare-shiny': 'rare shiny',
    'pk-rare-shiny-v': 'rare shiny v', 'pk-rare-shiny-vmax': 'rare shiny vmax', 'pk-amazing-rare': 'amazing rare',
    'pk-radiant-rare': 'radiant rare', 'pk-rare-ultra': 'rare ultra pokemon', 'pk-trainer-gallery': 'trainer gallery rare holo',
    'pk-trainer-gallery-secret-rare': 'trainer gallery rare secret', 'pk-trainer-gallery-v-max': 'trainer gallery rare holo vmax',
    'pk-trainer-gallery-v-regular': 'trainer gallery rare holo v', 'pk-trainer-full-art': 'rare ultra supporter',
    'pk-rare-holo-v-full-art': 'rare holo v full art', 'pk-reverse-holo': 'reverse holo'
};

window.getAlbumSize = function($albumContainer) {
    const isMobile = window.innerWidth <= 768;
    let width = 600;
    let height = 420;

    if (isMobile) {
        const containerWidth = $albumContainer.width() || $(window).width();
        // Return a smaller width for double-page display on mobile
        const availableWidth = Math.min(340, containerWidth - 10);
        width = availableWidth;
        height = Math.floor(width * (420 / 600));
    }
    return { width, height };
};

window.applyFoilToElement = function($el, holo, mask) {
    if (!holo) return;

    let firstHolo = holo;
    let secondHolo = null;
    let ignoreMaskForSecond = false;

    if (holo.includes(';')) {
        const parts = holo.split(';');
        firstHolo = parts[0];
        if (parts[1]) {
            secondHolo = parts[1];
        }
        if (parts[2] === 'ignoreMask') {
            ignoreMaskForSecond = true;
        }
    }

    // Set holo to firstHolo for the rest of the original logic
    holo = firstHolo;

    // Asynchronously resolve multiple masks if semicolon is present
    const masks = window.parseMultipleMasks(mask);
    if (masks.length > 1) {
        window.resolveMaskUrl(mask).then(resolvedMask => {
            window.applyFoilToElement($el, holo + (secondHolo ? ';' + secondHolo + (ignoreMaskForSecond ? ';ignoreMask' : '') : ''), resolvedMask);
        });
        return;
    }

    const POKEMON_FOILS = window.POKEMON_FOILS;

    // Strip metadata prefixes (L:, custom-foil|, custom-textures|)
    let baseHolo = holo;
    if (baseHolo.startsWith('L:')) baseHolo = baseHolo.substring(2);

    let isCustomFoil = false;
    if (baseHolo.startsWith('custom-foil|')) {
        isCustomFoil = true;
        baseHolo = baseHolo.split('|')[1] || 'foil';
    }
    if (baseHolo.startsWith('custom-textures|')) {
        baseHolo = 'custom-textures';
    }

    let isMultiFoils = false;
    let multiFoilsColor = '';
    if (baseHolo === 'multiFoils' || baseHolo.startsWith('multiFoils|')) {
        isMultiFoils = true;
        if (baseHolo.startsWith('multiFoils|')) {
            multiFoilsColor = baseHolo.split('|')[1] || '';
        }
        baseHolo = 'multiFoils';
    }

    if (POKEMON_FOILS[baseHolo]) {
        let rarityVal = POKEMON_FOILS[baseHolo];
        $el.addClass("card");
        if (rarityVal.includes('trainer gallery')) { $el.attr("data-trainer-gallery", "true"); rarityVal = rarityVal.replace('trainer gallery', ''); }
        if (rarityVal.includes('supporter')) { $el.attr("data-subtypes", "supporter"); rarityVal = rarityVal.replace('supporter', ''); }
        if (rarityVal.includes('pokemon')) { $el.attr("data-supertype", "pokémon"); rarityVal = rarityVal.replace('pokemon', ''); }
        $el.attr("data-rarity", rarityVal.trim());

        if (mask) {
            $el.addClass("masked").css({"--mask": `url(${mask})`, "--mask-url": `url(${mask})`});
        }
        if (!$el.hasClass('foil-effect-container')) {
            const rx = 0.5, ry = 0.5;
            $el.css({'--mx': rx, '--my': ry, '--seedx': rx, '--seedy': ry, '--cosmosbg': `${Math.floor(rx * 734)}px ${Math.floor(ry * 1280)}px`});
        }
    } else {
        if (isMultiFoils) {
            $el.addClass('multi-foils');
            if (multiFoilsColor) {
                $el.addClass(`multi-foils-${multiFoilsColor}`);
            }
            if (mask) {
                $el.addClass("masked").css({"--mask": `url(${mask})`, "--mask-url": `url(${mask})`});
            }
            if (!$el.hasClass('foil-effect-container')) {
                $el.css({'--mx': 0.5, '--my': 0.5});
            }
        } else {
            $el.addClass(baseHolo);
            if (mask) {
                $el.addClass("masked").css({"--mask": `url(${mask})`, "--mask-url": `url(${mask})`});
            }
            if (!$el.hasClass('foil-effect-container')) {
                $el.css({'--mx': 0.5, '--my': 0.5});
            }
        }
    }

    $el.css({
        '--angle': '135deg',
        '--card-opacity': 1,
        'will-change': 'transform, opacity'
    });

    if ($el.find('> .holo-layer').length === 0) {
        $el.append('<div class="holo-layer"></div>');
    }
    if ($el.find('> .card__shine').length === 0) {
        $el.append('<div class="card__shine"></div>');
    }
    if ($el.find('> .card__glare').length === 0) {
        $el.append('<div class="card__glare"></div>');
    }
    if (baseHolo === 'pokeball-rare' && $el.find('> .holo-layer-red').length === 0) {
        $el.append('<div class="holo-layer-red"></div>');
    }

    // Explicitly enforce 3D rendering context and backface-visibility on the appended layers to guarantee zero flickering
    $el.find('> .holo-layer, > .holo-layer-red, > .card__shine, > .card__glare').css({
        'will-change': 'transform, opacity',
        'backface-visibility': 'hidden',
        '-webkit-backface-visibility': 'hidden'
    });

    $el.addClass('active foil-loop');

    // Only apply the second holo if the current element is NOT a foil-effect-container itself
    if (!$el.hasClass('foil-effect-container')) {
        $el.find('> .foil-effect-container').remove();
        if (secondHolo) {
            const $container = $('<div class="foil-effect-container"></div>');
            $el.append($container);
            window.applyFoilToElement($container, secondHolo, ignoreMaskForSecond ? '' : mask);
        }
    }
};

// --- Global Navigation ---
// --- Mask Editor Logic ---
window.maskCanvas = null;
window.maskCtx = null;
window.isPainting = false;
window.currentBrushSize = 10;
window.currentTool = 'brush'; // 'brush', 'eraser' or 'move'
window.maskHistory = [];
const MAX_MASK_HISTORY = 20;

window.initMaskEditor = function() {
    window.maskCanvas = document.getElementById('mask-canvas');
    if (!window.maskCanvas) return;
    window.maskCtx = window.maskCanvas.getContext('2d');

    window.maskPanX = 0;
    window.maskPanY = 0;
    window.isDraggingMask = false;
    window.lastMaskX = 0;
    window.lastMaskY = 0;

    $(window.maskCanvas).off('mousedown touchstart').on('mousedown touchstart', function(e) {
        if (window.currentTool === 'move') {
            window.isDraggingMask = true;
            const pos = e.type.includes('touch') ? (e.originalEvent.touches[0] || e.originalEvent.changedTouches[0]) : e;
            window.lastMaskX = pos.clientX;
            window.lastMaskY = pos.clientY;
            return;
        }
        window.isPainting = true;
        window.saveMaskHistory();
        window.drawMask(e);
    });

    $(window).off('mousemove touchmove').on('mousemove touchmove', function(e) {
        if (window.currentTool === 'move' && window.isDraggingMask) {
            const pos = e.type.includes('touch') ? (e.originalEvent.touches[0] || e.originalEvent.changedTouches[0]) : e;
            const dx = pos.clientX - window.lastMaskX;
            const dy = pos.clientY - window.lastMaskY;
            window.maskPanX += dx;
            window.maskPanY += dy;
            window.lastMaskX = pos.clientX;
            window.lastMaskY = pos.clientY;
            window.updateMaskZoom();
            return;
        }
        if (window.isPainting) window.drawMask(e);
    });

    $(window).off('mouseup touchend').on('mouseup touchend', function() {
        window.isDraggingMask = false;
        window.isPainting = false;
        if (window.maskCtx) window.maskCtx.beginPath();
    });

    $('#brush-size').off('input').on('input', function() {
        window.currentBrushSize = $(this).val();
        $('#brush-size-val').text(window.currentBrushSize);
    });

    $('#tool-brush').off('click').on('click', function() {
        window.currentTool = 'brush';
        $('.editor-controls .btn-secondary').removeClass('active');
        $('.zoom-controls-lateral .btn-secondary').removeClass('active');
        $(this).addClass('active');
    });

    $('#tool-eraser').off('click').on('click', function() {
        window.currentTool = 'eraser';
        $('.editor-controls .btn-secondary').removeClass('active');
        $('.zoom-controls-lateral .btn-secondary').removeClass('active');
        $(this).addClass('active');
    });

    window.maskZoom = 1;
    window.updateMaskZoom = () => {
        const baseW = 168;
        const baseH = 244;
        $('#mask-canvas-wrapper').css({
            width: (baseW * window.maskZoom) + 'px',
            height: (baseH * window.maskZoom) + 'px',
            transform: `translate(${window.maskPanX}px, ${window.maskPanY}px)`
        });
        $('#mask-canvas').css({
            width: (baseW * window.maskZoom) + 'px',
            height: (baseH * window.maskZoom) + 'px'
        });
    };

    $('#btn-zoom-in').off('click').on('click', function() {
        if (window.maskZoom < 4) {
            window.maskZoom += 0.2;
            updateMaskZoom();
        }
    });

    $('#btn-zoom-out').off('click').on('click', function() {
        if (window.maskZoom > 1) {
            window.maskZoom -= 0.2;
            updateMaskZoom();
        }
    });

    $('#btn-reset-zoom').off('click').on('click', function() {
        if (window.maskTargetInput === '#slot-custom-mask') {
            window.currentTool = 'move';
            $('.zoom-controls-lateral .btn-secondary').removeClass('active');
            $(this).addClass('active');
            $('.editor-controls .btn-secondary').removeClass('active');
        } else {
            window.maskZoom = 1;
            window.maskPanX = 0;
            window.maskPanY = 0;
            window.updateMaskZoom();
        }
    });

    $('#btn-clear-mask').off('click').on('click', function() {
        Swal.fire({
            title: '¿Limpiar todo?',
            text: "Se borrará todo el dibujo de la máscara.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, limpiar'
        }).then((result) => {
            if (result.isConfirmed) {
                window.saveMaskHistory();
                window.maskCtx.fillStyle = 'black';
                window.maskCtx.fillRect(0, 0, window.maskCanvas.width, window.maskCanvas.height);
                // Also clear the input field in calling context if needed
                $('#slot-custom-mask, #modal-custom-mask').val('');
            }
        });
    });

    $('#btn-undo-mask').off('click').on('click', function() {
        if (window.maskHistory.length > 0) {
            const lastState = window.maskHistory.pop();
            const img = new Image();
            img.onload = function() {
                window.maskCtx.clearRect(0, 0, window.maskCanvas.width, window.maskCanvas.height);
                window.maskCtx.drawImage(img, 0, 0);
            };
            img.src = lastState;
        }
    });

    $('#btn-save-mask').off('click').on('click', async function() {
        let finalDataUrl = null;

        const activeGuide = window.activeMaskGuide;
        if (activeGuide && activeGuide !== 'none') {
            // Load and intersect with guide
            const guideImg = new Image();
            guideImg.src = activeGuide === 'poke' ? 'images/guiaPoke.png' : 'images/guiaYugi.png';

            await new Promise((resolve) => {
                guideImg.onload = resolve;
                guideImg.onerror = resolve;
            });

            if (guideImg.complete && guideImg.naturalWidth > 0) {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = window.maskCanvas.width;
                tempCanvas.height = window.maskCanvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(window.maskCanvas, 0, 0);

                const guideCanvas = document.createElement('canvas');
                guideCanvas.width = tempCanvas.width;
                guideCanvas.height = tempCanvas.height;
                const guideCtx = guideCanvas.getContext('2d');
                guideCtx.drawImage(guideImg, 0, 0, guideCanvas.width, guideCanvas.height);

                const userImgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                const guideImgData = guideCtx.getImageData(0, 0, guideCanvas.width, guideCanvas.height);

                const uData = userImgData.data;
                const gData = guideImgData.data;

                for (let i = 0; i < uData.length; i += 4) {
                    const gr = gData[i];
                    const gg = gData[i+1];
                    const gb = gData[i+2];

                    // If guide is black/dark (border area)
                    if (gr < 127 && gg < 127 && gb < 127) {
                        uData[i] = 0;     // R
                        uData[i+1] = 0;   // G
                        uData[i+2] = 0;   // B
                        uData[i+3] = 255; // A
                    }
                }
                tempCtx.putImageData(userImgData, 0, 0);
                finalDataUrl = tempCanvas.toDataURL('image/png');
            }
        }

        if (!finalDataUrl) {
            finalDataUrl = window.maskCanvas.toDataURL('image/png');
        }

        // Use explicit target if set, otherwise fallback to standard IDs
        if (window.maskTargetInput) {
            $(window.maskTargetInput).val(finalDataUrl).trigger('change');
        } else {
            $('#slot-custom-mask, #modal-custom-mask, #owner-card-mask, #bdd-custom-mask').val(finalDataUrl).trigger('change');
        }

        $('#mask-editor-overlay').removeClass('active');
        Swal.fire('Guardado', 'La máscara se ha generado correctamente.', 'success');
    });

    if (window.MultiFoils && typeof window.MultiFoils.initFloatingPalette === 'function') {
        window.MultiFoils.initFloatingPalette();
    }

    // Guide selection event listeners
    $(document).off('click', '#btn-guide-trigger').on('click', '#btn-guide-trigger', function(e) {
        e.stopPropagation();
        $('#guide-palette-dropdown').slideToggle(200);
    });

    $(document).off('click', '.btn-guide-option').on('click', '.btn-guide-option', function(e) {
        e.stopPropagation();
        const guideType = $(this).data('guide');
        window.activeMaskGuide = guideType;

        $('.btn-guide-option').removeClass('active');
        $(this).addClass('active');

        // Indicate active guide status by changing trigger border color, keeping canvas perfectly clean/clear
        if (guideType !== 'none') {
            $('#btn-guide-trigger').css('border-color', '#00d2ff');
        } else {
            $('#btn-guide-trigger').css('border-color', '#ffffff');
        }

        // Keep the visual guide overlay hidden to avoid obscuring card details
        $('#mask-guide-overlay-img').hide().css('background-image', '');

        $('#guide-palette-dropdown').slideUp(150);
    });

    // Hide guide dropdown when clicking outside
    $(document).on('click', function() {
        $('#guide-palette-dropdown').slideUp(150);
    });
};

window.initMaskCanvas = function() {
    // Supports all integrated form input IDs
    const currentMask = $('#slot-custom-mask, #modal-custom-mask, #owner-card-mask, #inv-card-custom-mask').val();

    window.maskZoom = 1;
    window.maskPanX = 0;
    window.maskPanY = 0;

    // Determine if multiFoils is active to show/hide palette
    let isMultiFoilsActive = false;
    let isCustomTextureActive = false;
    let isCustomFoilActive = false;

    const checkHoloVal = (val) => {
        if (!val) return;
        const low = val.toLowerCase();
        if (low.startsWith('multi-foils') || low.startsWith('multifoils')) {
            isMultiFoilsActive = true;
        }
        if (low.startsWith('custom-texture') || low.startsWith('custom-textures')) {
            isCustomTextureActive = true;
        }
        if (low.startsWith('custom-foil')) {
            isCustomFoilActive = true;
        }
    };

    const checkCompound = (val) => {
        if (!val) return;
        val.split(';').forEach(checkHoloVal);
    };

    // Check all possible primary and secondary select elements
    checkCompound($('#bdd-holo-effect').val());
    checkCompound($('#slot-holo-effect').val());
    checkCompound($('#slot-second-holo-effect').val());
    checkCompound($('#modal-wishlist-holo-effect').val());
    checkCompound($('#modal-wishlist-second-holo-effect').val());
    checkCompound($('#modal-holo-effect').val());
    checkCompound($('#modal-second-holo-effect').val());

    window.isMultiFoilsActive = isMultiFoilsActive;

    if (isMultiFoilsActive) {
        $('.multifoil-controls-lateral').show();
    } else {
        $('.multifoil-controls-lateral').hide();
        $('#multifoil-palette-dropdown').hide();
    }

    const isGuideEligible = isMultiFoilsActive || isCustomTextureActive || isCustomFoilActive;
    window.isGuideEligible = isGuideEligible;

    if (isGuideEligible) {
        $('.guide-controls-lateral').show();
    } else {
        $('.guide-controls-lateral').hide();
        $('#guide-palette-dropdown').hide();
    }

    // Reset guide status when opening
    window.activeMaskGuide = 'none';
    $('#mask-guide-overlay-img').hide().css('background-image', '');
    $('#btn-guide-trigger').css('border-color', '#ffffff');
    $('.btn-guide-option').removeClass('active');
    $('.btn-guide-option[data-guide="none"]').addClass('active');

    // Decks specific customizations
    if (window.maskTargetInput === '#slot-custom-mask') {
        $('#btn-reset-zoom').attr('title', 'Mover').find('i').attr('class', 'fas fa-hand-paper');
        $('#mask-viewport').css({
            'overflow': 'hidden',
            'padding': '20px'
        });
    } else {
        // Default behavior for other sections
        $('#btn-reset-zoom').attr('title', 'Reset Zoom').find('i').attr('class', 'fas fa-sync-alt');
        $('#mask-viewport').css({
            'overflow': 'auto',
            'padding': '20px'
        });
    }

    window.updateMaskZoom();

    window.maskCtx.fillStyle = 'black';
    window.maskCtx.fillRect(0, 0, window.maskCanvas.width, window.maskCanvas.height);

    if (currentMask) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = function() {
            window.maskCtx.drawImage(img, 0, 0, window.maskCanvas.width, window.maskCanvas.height);
        };
        img.src = currentMask;
    }
    window.maskHistory = [];
};

window.saveMaskHistory = function() {
    if (window.maskHistory.length >= MAX_MASK_HISTORY) window.maskHistory.shift();
    window.maskHistory.push(window.maskCanvas.toDataURL());
};

window.drawMask = function(e) {
    if (!window.isPainting) return;

    const rect = window.maskCanvas.getBoundingClientRect();
    let x, y;

    if (e.type.includes('touch')) {
        const touch = e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
        x = touch.clientX - rect.left;
        y = touch.clientY - rect.top;
        e.preventDefault();
    } else {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
    }

    x = x * (window.maskCanvas.width / rect.width);
    y = y * (window.maskCanvas.height / rect.height);

    window.maskCtx.lineWidth = window.currentBrushSize;
    window.maskCtx.lineCap = 'round';
    window.maskCtx.lineJoin = 'round';

    let strokeColor = 'black';
    if (window.currentTool === 'brush') {
        if (window.isMultiFoilsActive && window.MultiFoils && typeof window.MultiFoils.getBrushHex === 'function') {
            strokeColor = window.MultiFoils.getBrushHex();
        } else {
            strokeColor = 'white';
        }
    }
    window.maskCtx.strokeStyle = strokeColor;

    window.maskCtx.lineTo(x, y);
    window.maskCtx.stroke();
    window.maskCtx.beginPath();
    window.maskCtx.moveTo(x, y);
};

// --- GLOBAL SEARCH FUNCTIONS ---
window.md5 = function(string) {
    function RotateLeft(lValue, iShiftBits) {
        return (lValue<<iShiftBits) | (lValue>>>(32-iShiftBits));
    }
    function AddUnsigned(lX,lY) {
        var lX4,lY4,lX8,lY8,lResult;
        lX8 = (lX & 0x80000000);
        lY8 = (lY & 0x80000000);
        lX4 = (lX & 0x40000000);
        lY4 = (lY & 0x40000000);
        lResult = (lX & 0x3FFFFFFF)+(lY & 0x3FFFFFFF);
        if (lX4 & lY4) {
            return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
        }
        if (lX4 | lY4) {
            if (lResult & 0x40000000) {
                return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
            } else {
                return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
            }
        } else {
            return (lResult ^ lX8 ^ lY8);
        }
    }
    function F(x,y,z) { return (x & y) | ((~x) & z); }
    function G(x,y,z) { return (x & z) | (y & (~z)); }
    function H(x,y,z) { return (x ^ y ^ z); }
    function I(x,y,z) { return (y ^ (x | (~z))); }
    function FF(a,b,c,d,x,s,ac) {
        a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b,c,d), x), ac));
        return AddUnsigned(RotateLeft(a, s), b);
    }
    function GG(a,b,c,d,x,s,ac) {
        a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b,c,d), x), ac));
        return AddUnsigned(RotateLeft(a, s), b);
    }
    function HH(a,b,c,d,x,s,ac) {
        a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b,c,d), x), ac));
        return AddUnsigned(RotateLeft(a, s), b);
    }
    function II(a,b,c,d,x,s,ac) {
        a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b,c,d), x), ac));
        return AddUnsigned(RotateLeft(a, s), b);
    }
    function ConvertToWordArray(string) {
        var lWordCount;
        var lMessageLength = string.length;
        var lNumberOfWords_temp1=lMessageLength + 8;
        var lNumberOfWords_temp2=(lNumberOfWords_temp1-(lNumberOfWords_temp1 % 64))/64;
        var lNumberOfWords = (lNumberOfWords_temp2+1)*16;
        var lWordArray=Array(lNumberOfWords-1);
        var lBytePosition = 0;
        var lByteCount = 0;
        while ( lByteCount < lMessageLength ) {
            lWordCount = (lByteCount-(lByteCount % 4))/4;
            lBytePosition = (lByteCount % 4)*8;
            lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount)<<lBytePosition));
            lByteCount++;
        }
        lWordCount = (lByteCount-(lByteCount % 4))/4;
        lBytePosition = (lByteCount % 4)*8;
        lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80<<lBytePosition);
        lWordArray[lNumberOfWords-2] = lMessageLength<<3;
        lWordArray[lNumberOfWords-1] = lMessageLength>>>29;
        return lWordArray;
    }
    function WordToHex(lValue) {
        var WordToHexValue="",WordToHexValue_temp="",lByte,lCount;
        for (lCount = 0;lCount<=3;lCount++) {
            lByte = (lValue>>>(lCount*8)) & 255;
            WordToHexValue_temp = "0" + lByte.toString(16);
            WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length-2,2);
        }
        return WordToHexValue;
    }
    function Utf8Encode(string) {
        string = string.replace(/\r\n/g,"\n");
        var utftext = "";
        for (var n = 0; n < string.length; n++) {
            var c = string.charCodeAt(n);
            if (c < 128) {
                utftext += String.fromCharCode(c);
            }
            else if((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            }
            else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }
        }
        return utftext;
    }
    var x=Array();
    var k,AA,BB,CC,DD,a,b,c,d;
    var S11=7, S12=12, S13=17, S14=22;
    var S21=5, S22=9 , S23=14, S24=20;
    var S31=4, S32=11, S33=16, S34=23;
    var S41=6, S42=10, S43=15, S44=21;
    string = Utf8Encode(string);
    x = ConvertToWordArray(string);
    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
    for (k=0;k<x.length;k+=16) {
        AA=a; BB=b; CC=c; DD=d;
        a=FF(a,b,c,d,x[k+0], S11,0xD76AA478);
        d=FF(d,a,b,c,x[k+1], S12,0xE8C7B756);
        c=FF(c,d,a,b,x[k+2], S13,0x242070DB);
        b=FF(b,c,d,a,x[k+3], S14,0xC1BDCEEE);
        a=FF(a,b,c,d,x[k+4], S11,0xF57C0FAF);
        d=FF(d,a,b,c,x[k+5], S12,0x4787C62A);
        c=FF(c,d,a,b,x[k+6], S13,0xA8304613);
        b=FF(b,c,d,a,x[k+7], S14,0xFD469501);
        a=FF(a,b,c,d,x[k+8], S11,0x698098D8);
        d=FF(d,a,b,c,x[k+9], S12,0x8B44F7AF);
        c=FF(c,d,a,b,x[k+10],S13,0xFFFF5BB1);
        b=FF(b,c,d,a,x[k+11],S14,0x895CD7BE);
        a=FF(a,b,c,d,x[k+12],S11,0x6B901122);
        d=FF(d,a,b,c,x[k+13],S12,0xFD987193);
        c=FF(c,d,a,b,x[k+14],S13,0xA679438E);
        b=FF(b,c,d,a,x[k+15],S14,0x49B40821);
        a=GG(a,b,c,d,x[k+1], S21,0xF61E2562);
        d=GG(d,a,b,c,x[k+6], S22,0xC040B340);
        c=GG(c,d,a,b,x[k+11],S23,0x265E5A51);
        b=GG(b,c,d,a,x[k+0], S24,0xE9B6C7AA);
        a=GG(a,b,c,d,x[k+5], S21,0xD62F105D);
        d=GG(d,a,b,c,x[k+10],S22,0x2441453);
        c=GG(c,d,a,b,x[k+15],S23,0xD8A1E681);
        b=GG(b,c,d,a,x[k+4], S24,0xE7D3FBC8);
        a=GG(a,b,c,d,x[k+9], S21,0x21E1CDE6);
        d=GG(d,a,b,c,x[k+14],S22,0xC33707D6);
        c=GG(c,d,a,b,x[k+3], S23,0xF4D50D87);
        b=GG(b,c,d,a,x[k+8], S24,0x455A14ED);
        a=GG(a,b,c,d,x[k+13],S21,0xA9E3E905);
        d=GG(d,a,b,c,x[k+2], S22,0xFCEFA3F8);
        c=GG(c,d,a,b,x[k+7], S23,0x676F02D9);
        b=GG(b,c,d,a,x[k+12],S24,0x8D2A4C8A);
        a=HH(a,b,c,d,x[k+5], S31,0xFFFA3942);
        d=HH(d,a,b,c,x[k+8], S32,0x8771F681);
        c=HH(c,d,a,b,x[k+11],S33,0x6D9D6122);
        b=HH(b,c,d,a,x[k+14],S34,0xFDE5380C);
        a=HH(a,b,c,d,x[k+1], S31,0xA4BEEA44);
        d=HH(d,a,b,c,x[k+4], S32,0x4BDECFA9);
        c=HH(c,d,a,b,x[k+7], S33,0xF6BB4B60);
        b=HH(b,c,d,a,x[k+10],S34,0xBEBFBC70);
        a=HH(a,b,c,d,x[k+13],S31,0x289B7EC6);
        d=HH(d,a,b,c,x[k+0], S32,0xEAA127FA);
        c=HH(c,d,a,b,x[k+3], S33,0xD4EF3085);
        b=HH(b,c,d,a,x[k+6], S34,0x4881D05);
        a=HH(a,b,c,d,x[k+9], S31,0xD9D4D039);
        d=HH(d,a,b,c,x[k+12],S32,0xE6DB99E5);
        c=HH(c,d,a,b,x[k+15],S33,0x1FA27CF8);
        b=HH(b,c,d,a,x[k+2], S34,0xC4AC5665);
        a=II(a,b,c,d,x[k+0], S41,0xF4292244);
        d=II(d,a,b,c,x[k+7], S42,0x432AFF97);
        c=II(c,d,a,b,x[k+14],S43,0xAB9423A7);
        b=II(b,c,d,a,x[k+5], S44,0xFC93A039);
        a=II(a,b,c,d,x[k+12],S41,0x655B59C3);
        d=II(d,a,b,c,x[k+3], S42,0x8F0CCC92);
        c=II(c,d,a,b,x[k+10],S43,0xFFEFF47D);
        b=II(b,c,d,a,x[k+1], S44,0x85845DD1);
        a=II(a,b,c,d,x[k+8], S41,0x6FA87E4F);
        d=II(d,a,b,c,x[k+15],S42,0xFE2CE6E0);
        c=II(c,d,a,b,x[k+6], S43,0xA3014314);
        b=II(b,c,d,a,x[k+13],S44,0x4E0811A1);
        a=II(a,b,c,d,x[k+4], S41,0xF7537E82);
        d=II(d,a,b,c,x[k+11],S42,0xBD3AF235);
        c=II(c,d,a,b,x[k+2], S43,0x2AD7D2BB);
        b=II(b,c,d,a,x[k+9], S44,0xEB86D391);
        a=AddUnsigned(a,AA);
        b=AddUnsigned(b,BB);
        c=AddUnsigned(c,CC);
        d=AddUnsigned(d,DD);
    }
    var temp = WordToHex(a)+WordToHex(b)+WordToHex(c)+WordToHex(d);
    return temp.toLowerCase();
};

window.getYugipediaUrl = function(filename) {
    if (!filename) return "";
    var cleanFn = filename.replace(/ /g, "_");
    var hash = window.md5(cleanFn);
    var first = hash.charAt(0);
    var firstTwo = hash.substring(0, 2);
    return "https://ms.yugipedia.com//" + first + "/" + firstTwo + "/" + encodeURIComponent(cleanFn);
};

window.ygoSetsCache = window.ygoSetsCache || null;
window.getYgoSets = async function() {
    if (window.ygoSetsCache) return window.ygoSetsCache;
    try {
        const response = await fetch('https://db.ygoprodeck.com/api/v7/cardsets.php');
        window.ygoSetsCache = await response.json();
    } catch (e) {
        console.warn("Error fetching YGO sets:", e);
        window.ygoSetsCache = [];
    }
    return window.ygoSetsCache;
};

window.searchYamlYugiRush = async function(query, filters, signal) {
    if (!window.yamlYugiRushCache) {
        if (!window.yamlYugiRushPromise) {
            window.yamlYugiRushPromise = fetch("https://dawnbrandbots.github.io/yaml-yugi/rush.json?utm_source=chatgpt.com")
                .then(res => res.ok ? res.json() : [])
                .then(data => {
                    window.yamlYugiRushCache = data;
                    return data;
                })
                .catch(e => {
                    console.error("Error fetching YAML Yugi Rush Duel database:", e);
                    window.yamlYugiRushPromise = null;
                    return [];
                });
        }
        await window.yamlYugiRushPromise;
    }
    try {
        const q = query.toLowerCase();
        const matches = window.yamlYugiRushCache.filter(card => {
            // Text Match: name.en, name.es, or other languages
            let nameMatch = false;
            if (card.name) {
                for (let lang in card.name) {
                    if (card.name[lang] && typeof card.name[lang] === 'string' && card.name[lang].toLowerCase().includes(q)) {
                        nameMatch = true;
                        break;
                    }
                }
            }
            if (q && !nameMatch) return false;

            // cardType: monster, spell, trap
            if (filters.cardType) {
                const ct = filters.cardType.toLowerCase();
                if (!card.card_type || typeof card.card_type !== 'string') return false;
                const cardCt = card.card_type.toLowerCase();
                if (ct === "monster" && cardCt !== "monster") return false;
                if (ct === "spell" && cardCt !== "spell") return false;
                if (ct === "trap" && cardCt !== "trap") return false;
            }

            // attribute
            if (filters.attribute) {
                if (!card.attribute || typeof card.attribute !== 'string' || card.attribute.toUpperCase() !== filters.attribute.toUpperCase()) return false;
            }

            // level
            if (filters.level) {
                if (card.level === undefined || String(card.level) !== String(filters.level)) return false;
            }

            // monsterType
            if (filters.monsterType) {
                const mt = filters.monsterType.toLowerCase();
                if (!card.monster_type_line || typeof card.monster_type_line !== 'string' || !card.monster_type_line.toLowerCase().includes(mt)) return false;
            }

            return true;
        });

        return matches.map(card => {
            let imgUrl = "";
            if (card.images && card.images.length > 0) {
                imgUrl = window.getYugipediaUrl(card.images[0].image);
            }
            const displayName = (card.name && (card.name.en || card.name.es || Object.values(card.name).find(v => typeof v === 'string'))) || "";
            return {
                name: displayName,
                image: imgUrl,
                high_res: imgUrl
            };
        });
    } catch(err) {
        console.error("Error processing searchYamlYugiRush:", err);
        return [];
    }
};

window.searchAbortControllers = window.searchAbortControllers || {};

window.searchExternalCard = async function(inputSelector, resultsSelector, onSelectCallback, filters = {}) {
    const query = $(inputSelector).val().trim();

    // Abort previous request for this specific input
    if (window.searchAbortControllers[inputSelector]) {
        window.searchAbortControllers[inputSelector].abort();
    }
    const controller = new AbortController();
    window.searchAbortControllers[inputSelector] = controller;
    const signal = controller.signal;

    // Support search from 1 character as requested for Nexus-style real-time search
    if (query.length < 1 && !Object.values(filters).some(v => v !== '')) {
        // Only skip if no name AND no filters
        return;
    }

    $(resultsSelector).html('<div style="grid-column: 1/-1; text-align: center; padding: 10px; color: #666;">Buscando...</div>');

    try {
        // Build YGO URL with filters
        let ygoUrl = `https://db.ygoprodeck.com/api/v7/cardinfo.php?`;
        let ygoParams = [];
        if (query.length >= 1) ygoParams.push(`fname=${encodeURIComponent(query)}`);

        if (filters.cardType) {
            if (filters.cardType === 'monster') ygoParams.push(`type=Monster`);
            else if (filters.cardType === 'spell') ygoParams.push(`type=Spell Card`);
            else if (filters.cardType === 'trap') ygoParams.push(`type=Trap Card`);
        }
        if (filters.attribute) ygoParams.push(`attribute=${filters.attribute}`);
        if (filters.level) ygoParams.push(`level=${filters.level}`);
        if (filters.monsterType) ygoParams.push(`race=${filters.monsterType}`);
        if (filters.format) {
            let formatParam = filters.format;
            if (filters.format.toLowerCase() === 'speed duel') formatParam = 'Speed Duel';
            else if (filters.format.toLowerCase() === 'rush duel') formatParam = 'Rush Duel';
            ygoParams.push(`format=${encodeURIComponent(formatParam)}`);
        }

        const finalYgoUrl = ygoUrl + ygoParams.join('&');

        // Special YGO search logic for passcodes and set codes
        const ygoSpecialSearch = async () => {
            if (query.length < 1) return [];
            const q = query.toUpperCase();
            // Passcode (Numeric 5-10 digits)
            if (/^\d{5,10}$/.test(q)) {
                const formatUrl = filters.format ? `&format=${encodeURIComponent(filters.format.toLowerCase() === 'speed duel' ? 'Speed Duel' : 'Rush Duel')}` : '';
                const r = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${q}${formatUrl}`, { signal }).then(res => res.json()).catch(() => ({data:[]}));
                return r.data || [];
            }
            // Set Code (Format XXX-123 or XXX-EN123)
            const setMatch = q.match(/^([A-Z0-9]{3,6})-([A-Z0-9]{3,8})$/);
            if (setMatch) {
                const prefix = setMatch[1];
                const sets = await window.getYgoSets();
                const setObj = sets.find(s => s.set_code.toUpperCase() === prefix);
                if (setObj) {
                    const formatUrl = filters.format ? `&format=${encodeURIComponent(filters.format.toLowerCase() === 'speed duel' ? 'Speed Duel' : 'Rush Duel')}` : '';
                    const r = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(setObj.set_name)}${formatUrl}`, { signal }).then(res => res.json()).catch(() => ({data:[]}));
                    if (r.data) {
                        // Filter for the exact set code
                        return r.data.filter(c => c.card_sets && c.card_sets.some(s => s.set_code.toUpperCase() === q));
                    }
                }
            }
            return [];
        };

        // TCGAPI.dev Search (Multi-game)
        const searchTCGAPI = async (q, game) => {
            if (!window.TCG_API_KEY || q.length < 1) return [];
            try {
                const response = await fetch(`${window.TCG_API_BASE}/search?q=${encodeURIComponent(q)}&game=${game}`, {
                    headers: { 'X-API-Key': window.TCG_API_KEY },
                    signal
                });
                if (!response.ok) return [];
                const data = await response.json();
                return (data.data || []).map(c => ({
                    name: c.name,
                    image: c.image_url || `https://images.tcgplayer.com/product/${c.id}_200w.jpg`,
                    high_res: c.image_url || `https://images.tcgplayer.com/product/${c.id}_400w.jpg`,
                    set: c.set,
                    number: c.number,
                    rarity: c.rarity,
                    price: c.price || c.market_price || 0,
                    game: game,
                    external_id: c.id
                }));
            } catch(e) { return []; }
        };

        // Concurrent search across all databases
        const searchPromises = [
            // Yu-Gi-Oh! Name Search (Optimized with filters)
            ygoParams.length > 0 ? fetch(finalYgoUrl, { signal }).then(r => r.ok ? r.json() : {data:[]}).catch(() => ({data:[]})) : Promise.resolve({data:[]}),

            // Yu-Gi-Oh! Code/Set Search
            (query.length >= 1) ? fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(query)}${filters.format ? `&format=${encodeURIComponent(filters.format.toLowerCase() === 'speed duel' ? 'Speed Duel' : 'Rush Duel')}` : ''}`, { signal }).then(r => r.ok ? r.json() : {data:[]}).catch(() => ({data:[]})) : Promise.resolve({data:[]}),

            // Special YGO Search
            ygoSpecialSearch(),

            // Pokémon TCGdex - English
            (query.length >= 1 && !filters.format) ? fetch(`https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(query)}`, { signal }).then(r => r.ok ? r.json() : []).catch(() => []) : Promise.resolve([]),

            // Pokémon TCGdex - Spanish
            (query.length >= 1 && !filters.format) ? fetch(`https://api.tcgdex.net/v2/es/cards?name=${encodeURIComponent(query)}`, { signal }).then(r => r.ok ? r.json() : []).catch(() => []) : Promise.resolve([]),

            // Pokémon TCGdex - Japanese
            (query.length >= 1 && !filters.format) ? fetch(`https://api.tcgdex.net/v2/ja/cards?name=${encodeURIComponent(query)}`, { signal }).then(r => r.ok ? r.json() : []).catch(() => []) : Promise.resolve([]),

            // Lorcana Search
            (query.length >= 1 && !filters.format) ? fetch(`https://api.lorcana-api.com/cards/fetch?search=name~${encodeURIComponent(query)}&displayonly=name;image;cost;set_num`, { signal }).then(r => r.ok ? r.json() : []).catch(() => []) : Promise.resolve([]),

            // Viking Search
            (query.length >= 1 && !filters.format) ? (typeof VikingData !== 'undefined' ? VikingData.search(query) : Promise.resolve([])) : Promise.resolve([]),

            // TCGAPI.dev (Top games)
            (!filters.format) ? searchTCGAPI(query, 'pokemon') : Promise.resolve([]),
            (!filters.format) ? searchTCGAPI(query, 'yugioh') : Promise.resolve([]),
            (!filters.format) ? searchTCGAPI(query, 'magic') : Promise.resolve([]),
            (!filters.format) ? searchTCGAPI(query, 'onepiece') : Promise.resolve([]),
            (!filters.format) ? searchTCGAPI(query, 'lorcana') : Promise.resolve([]),

            // YAML Yugi Rush Duel
            (filters.format && filters.format.toLowerCase() === 'rush duel') ? window.searchYamlYugiRush(query, filters, signal) : Promise.resolve([])
        ];

        const [ygName, ygCode, ygSpecial, pkEn, pkEs, pkJa, lorResults, vikResults, tcgPk, tcgYgo, tcgMg, tcgOp, tcgLor, rushResults] = await Promise.all(searchPromises);

        let combinedResults = [];

        // Process YAML Yugi Rush Duel results
        if (Array.isArray(rushResults)) {
            combinedResults.push(...rushResults);
        }

        // Process VikingData
        if (Array.isArray(vikResults)) {
            combinedResults.push(...vikResults);
        }

        // Process TCGAPI Results
        [tcgPk, tcgYgo, tcgMg, tcgOp, tcgLor].forEach(list => {
            combinedResults.push(...list);
        });

        // Process Lorcana Results
        const lorResultsSafe = Array.isArray(lorResults) ? lorResults : [];
        lorResultsSafe.forEach(c => {
            if (c.Image) {
                combinedResults.push({
                    name: c.Name,
                    image: c.Image,
                    high_res: c.Image
                });
            }
        });

        // Process Yu-Gi-Oh Results
        const ygoResults = [...(ygName.data || []), ...(ygCode.data || []), ...ygSpecial];
        ygoResults.forEach(c => {
            if (c.card_images && c.card_images.length > 0) {
                c.card_images.forEach(img => {
                    combinedResults.push({
                        name: c.name,
                        image: img.image_url_small,
                        high_res: img.image_url
                    });
                } );
            }
        });

        // Process Pokémon Results
        const pkResults = [...(pkEn || []), ...(pkEs || []), ...(pkJa || [])];
        pkResults.forEach(c => {
            if (c.image) {
                combinedResults.push({
                    name: c.name,
                    image: `${c.image}/low.webp`,
                    high_res: `${c.image}/high.webp`
                });
            }
        });

        // Deduplicate by Image URL
        const uniqueResults = [];
        const seenImages = new Set();
        combinedResults.forEach(card => {
            if (!seenImages.has(card.image)) {
                seenImages.add(card.image);
                uniqueResults.push(card);
            }
        });

        if (uniqueResults.length === 0) {
            $(resultsSelector).html('<div style="grid-column: 1/-1; text-align: center; padding: 10px; color: #ff4757;">No se encontraron cartas en ninguna base de datos.</div>');
        } else {
            const displayFn = filters.displayFn || window.displayExternalResults;
            displayFn(uniqueResults.slice(0, 50), resultsSelector, onSelectCallback);
        }

    } catch (err) {
        if (err.name === 'AbortError') return;
        console.error(err);
        $(resultsSelector).html('<div style="grid-column: 1/-1; text-align: center; padding: 10px; color: #ff4757;">Error al buscar. Inténtalo de nuevo.</div>');
    }
};

window.displayExternalResults = function(results, resultsSelector, onSelectCallback) {
    const $container = $(resultsSelector);
    $container.empty();

    if (results.length === 0) {
        $container.html('<div style="grid-column: 1/-1; text-align: center; padding: 10px; color: #666;">No se encontraron resultados.</div>');
        return;
    }

    results.forEach(card => {
        const $item = $(`
            <div class="external-card-result" title="${card.name}" style="cursor: pointer; transition: transform 0.2s;">
                <img src="${card.image}" style="width: 100%; border-radius: 4px; border: 1px solid #333;">
            </div>
        `);

        $item.hover(
            function() { $(this).css('transform', 'scale(1.1)'); },
            function() { $(this).css('transform', 'scale(1)'); }
        );

        $item.click(function() {
            onSelectCallback(card);
        });

        $container.append($item);
    });
};

$(document).ready(function() {
    window.initMaskEditor();

    // Isolated navigation for public.html if it's there
    if (window.location.pathname.includes('public.html')) {
         // handle deep links etc if needed
    }

    $(document).on('click', '#btn-nav-home', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const path = window.location.pathname;
        const isPublic = path.includes('public.html') || ($('#home-view').length > 0 && $('.public-body').length > 0);

        if (isPublic) {
            if (typeof switchView === 'function') {
                switchView('home');
            } else {
                const url = new URL(window.location.href);
                url.searchParams.set('view', 'home');
                window.location.href = url.toString();
            }
        } else if (path.includes('admin.html')) {
            if (typeof showView === 'function') {
                showView('main-dashboard');
            } else {
                window.location.href = 'admin.html';
            }
        } else {
            window.location.href = 'index.html';
        }
    });

    $(document).on('click', '#btn-nav-return', function() {
        // 1. Check for active overlays/popups
        // Added more selectors to ensure all popups are covered
        const $activeOverlay = $('.overlay.active, .business-overlay.active, #image-overlay.active, #shared-item-modal.active, #deck-list-overlay.active, #slot-modal.active, #auction-modal.active, #auction-detail-modal.active, #organize-modal.active, #mask-editor-overlay.active, .modal.active, .popup.active, #login-modal.active, #spirit-modal.active, #gltf-overlay.active, #event-details-overlay.active, #wishlist-search-modal.active, #auction-detail-modal.active, #wishlist-modal.active, #spirit-upload-modal.active, #fast-draw-modal.active');

        if ($activeOverlay.length > 0) {
            $activeOverlay.removeClass('active');
            $('body').removeClass('modal-open');

            // Specific cleanup for some modals
            if (window.card3dActive !== undefined) window.card3dActive = false;
            return;
        }

        // 2. If no overlay, go back
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = 'index.html';
        }
    });
});

// Dynamic Mask Editor Injection
$(document).ready(function() {
    if ($('#mask-editor-overlay').length === 0) {
        const maskEditorHTML = `
        <div id="mask-editor-overlay" class="overlay">
            <div class="overlay-content" style="max-width: 600px;">
                <span id="close-mask-editor" class="close-btn">&times;</span>
                <h2>Editor de Máscara</h2>
                <p style="font-size: 12px; color: #aaa; margin-bottom: 15px;">Dibuja en blanco donde quieras aplicar el efecto foil.</p>

                <div class="mask-editor-main-container" style="display: flex; flex-direction: column; align-items: center; margin-bottom: 20px; position: relative; width: 100%;">
                    <div id="mask-viewport" style="width: 100%; height: 350px; overflow: auto; border: 2px solid #333; border-radius: 12px; position: relative; background: #000; display: flex; align-items: center; justify-content: center; padding: 20px;">
                        <div id="mask-canvas-wrapper" style="position: relative; width: 168px; height: 244px; flex-shrink: 0; transition: width 0.1s, height 0.1s; background-size: cover; background-position: center;">
                            <canvas id="mask-canvas" width="168" height="244" style="cursor: crosshair; display: block; width: 100%; height: 100%;"></canvas>
                            <div id="mask-guide-overlay-img" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; opacity: 0.4; display: none; background-size: 100% 100%; z-index: 5;"></div>
                        </div>
                    </div>

                    <div class="multifoil-controls-lateral">
                        <button id="btn-multifoil-active-color" class="btn-multifoil-trigger" title="Color Foil" style="background: linear-gradient(135deg, #ff00ff, #00ffff);"></button>
                        <div id="multifoil-palette-dropdown" class="multifoil-palette-dropdown"></div>
                    </div>

                    <div class="guide-controls-lateral" style="display: none;">
                        <button id="btn-guide-trigger" class="btn btn-secondary" title="Guía de Tarjeta" style="width: 44px; height: 44px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; padding: 0; background: #252525; color: #fff; cursor: pointer; transition: transform 0.2s;">
                            <i class="fas fa-crop-alt" style="font-size: 18px;"></i>
                        </button>
                        <div id="guide-palette-dropdown" class="guide-palette-dropdown">
                            <button class="btn btn-sm btn-dark btn-guide-option active" data-guide="none">Ninguna</button>
                            <button class="btn btn-sm btn-dark btn-guide-option" data-guide="poke">Poke Guide</button>
                            <button class="btn btn-sm btn-dark btn-guide-option" data-guide="yugi">Yugi Guide</button>
                        </div>
                    </div>

                    <div class="zoom-controls-lateral" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 10px; z-index: 10;">
                        <button id="btn-zoom-in" class="btn btn-secondary btn-sm" title="Zoom In" style="padding: 10px;"><i class="fas fa-plus"></i></button>
                        <button id="btn-zoom-out" class="btn btn-secondary btn-sm" title="Zoom Out" style="padding: 10px;"><i class="fas fa-minus"></i></button>
                        <button id="btn-reset-zoom" class="btn btn-secondary btn-sm" title="Reset Zoom" style="padding: 10px;"><i class="fas fa-sync-alt"></i></button>
                    </div>
                </div>

                <div class="editor-controls" style="display: flex; flex-direction: column; gap: 15px; width: 100%;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <label style="font-size: 12px; text-transform: uppercase; color: #666; font-weight: 700;">Tamaño:</label>
                        <input type="range" id="brush-size" min="1" max="50" value="10" style="flex: 1;">
                        <span id="brush-size-val" style="font-size: 14px; width: 30px;">10</span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                        <button id="tool-brush" class="btn btn-secondary active"><i class="fas fa-paint-brush"></i> Pincel</button>
                        <button id="tool-eraser" class="btn btn-secondary"><i class="fas fa-eraser"></i> Borrador</button>
                        <button id="btn-undo-mask" class="btn btn-secondary"><i class="fas fa-undo"></i> Deshacer</button>
                        <button id="btn-clear-mask" class="btn btn-danger btn-sm"><i class="fas fa-trash"></i> Limpiar Todo</button>
                    </div>

                    <button id="btn-save-mask" class="btn" style="width: 100%;"><i class="fas fa-save"></i> Guardar Máscara</button>
                </div>
            </div>
        </div>`;
        $('body').append(maskEditorHTML);
        window.initMaskEditor(); // Re-init after injection
    }

    $(document).on('click', '#close-mask-editor', function() {
        $('#mask-editor-overlay').removeClass('active');
    });

    $(document).on('click', '#btn-open-mask-editor', function() {
        $('#mask-editor-overlay').addClass('active');
        window.initMaskCanvas();
    });
});

// --- Shared 3D Card Rotation Logic ---
window.sharedCard3D = {
    ztext: null,
    targetRX: 0,
    targetRY: 0,
    currentRX: 0,
    currentRY: 0,
    active: false,
    orientationHandler: null,
    touchHandler: null,
    cachedEl: null,

    updateRotation: function(cardId = 'card-3d', overlayId = 'image-overlay') {
        if (!window.sharedCard3D.active) return;

        const card3d = window.sharedCard3D.cachedEl || document.getElementById(cardId);
        if (!card3d) {
            window.sharedCard3D.active = false;
            return;
        }
        window.sharedCard3D.cachedEl = card3d;

        const overlay = document.getElementById(overlayId);
        if (overlay && !overlay.classList.contains('active')) {
            window.sharedCard3D.active = false;
            return;
        }

        const lerpFactor = window.innerWidth <= 768 ? 0.15 : 0.1;
        const diffX = window.sharedCard3D.targetRX - window.sharedCard3D.currentRX;
        const diffY = window.sharedCard3D.targetRY - window.sharedCard3D.currentRY;

        if (Math.abs(diffX) < 0.01 && Math.abs(diffY) < 0.01 && window.sharedCard3D.targetRX === 0 && window.sharedCard3D.targetRY === 0) {
            window.sharedCard3D.currentRX = 0;
            window.sharedCard3D.currentRY = 0;
        } else {
            window.sharedCard3D.currentRX += diffX * lerpFactor;
            window.sharedCard3D.currentRY += diffY * lerpFactor;
        }

        const mx = (window.sharedCard3D.currentRY + 20) / 40;
        const my = (window.sharedCard3D.currentRX + 20) / 40;
        const angle = (Math.atan2(window.sharedCard3D.currentRX, window.sharedCard3D.currentRY) * 180 / Math.PI) + 135;

        const px = mx * 100;
        const py = my * 100;
        const cx = (mx - 0.5) * 100;
        const cy = (my - 0.5) * 100;
        const pointerFromCenter = Math.min(Math.sqrt(cx * cx + cy * cy) / 50, 1);

        const s = card3d.style;
        s.transform = `translate3d(0,0,1px) rotateX(${window.sharedCard3D.currentRX.toFixed(2)}deg) rotateY(${window.sharedCard3D.currentRY.toFixed(2)}deg)`;
        s.setProperty('--mx', mx.toFixed(3));
        s.setProperty('--my', my.toFixed(3));
        s.setProperty('--angle', `${angle.toFixed(2)}deg`);
        s.setProperty('--pointer-x', `${px.toFixed(2)}%`);
        s.setProperty('--pointer-y', `${py.toFixed(2)}%`);
        s.setProperty('--background-x', `${px.toFixed(2)}%`);
        s.setProperty('--background-y', `${py.toFixed(2)}%`);
        s.setProperty('--pointer-from-center', pointerFromCenter.toFixed(3));
        s.setProperty('--pointer-from-top', my.toFixed(3));
        s.setProperty('--pointer-from-left', mx.toFixed(3));
        s.setProperty('--card-opacity', '1');

        requestAnimationFrame(() => window.sharedCard3D.updateRotation(cardId, overlayId));
    },

    init: function(containerId = 'card-3d-container', cardId = 'card-3d', zTextId = '#z-text-container', options = {}) {
        const $container = $(`#${containerId}`);
        const $card = $(`#${cardId}`);
        const $zContainer = $(zTextId);
        const useGyro = options.useGyro !== false;

        if (!$zContainer.length) return;

        $card.css('transform', '');
        window.sharedCard3D.currentRX = 0;
        window.sharedCard3D.currentRY = 0;
        window.sharedCard3D.targetRX = 0;
        window.sharedCard3D.targetRY = 0;
        window.sharedCard3D.cachedEl = $card[0];

        const isMobile = window.innerWidth <= 768;
        try {
            if (typeof Ztextify !== 'undefined') {
                window.sharedCard3D.ztext = new Ztextify(zTextId, {
                    depth: "10px",
                    layers: isMobile ? 6 : 10,
                    fade: true,
                    direction: "backwards",
                    event: "none",
                    perspective: "800px"
                });
            }
        } catch (e) {
            console.error("Ztext init error:", e);
        }

        $container.off('mousemove mouseleave touchend');
        if (window.sharedCard3D.touchHandler) {
            $container[0].removeEventListener('touchmove', window.sharedCard3D.touchHandler);
        }

        $container.on('mousemove', (e) => {
            const rect = $container[0].getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            window.sharedCard3D.targetRY = ((x / rect.width) - 0.5) * 40;
            window.sharedCard3D.targetRX = ((y / rect.height) - 0.5) * -40;
        });

        $container.on('mouseleave', () => {
            window.sharedCard3D.targetRX = 0;
            window.sharedCard3D.targetRY = 0;
        });

        window.sharedCard3D.touchHandler = (e) => {
            const rect = $container[0].getBoundingClientRect();
            const touch = e.touches[0];
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            window.sharedCard3D.targetRY = ((x / rect.width) - 0.5) * 40;
            window.sharedCard3D.targetRX = ((y / rect.height) - 0.5) * -40;
            if (e.cancelable) e.preventDefault();
        };

        $container[0].addEventListener('touchmove', window.sharedCard3D.touchHandler, { passive: false });

        $container.on('touchend', () => {
            window.sharedCard3D.targetRX = 0;
            window.sharedCard3D.targetRY = 0;
        });

        // Always cleanup existing listener before potentially starting a new one
        if (window.sharedCard3D.orientationHandler) {
            window.removeEventListener('deviceorientation', window.sharedCard3D.orientationHandler);
            window.sharedCard3D.orientationHandler = null;
        }

        if (useGyro && window.DeviceOrientationEvent) {
            window.sharedCard3D.orientationHandler = (e) => {
                if (!window.sharedCard3D.active) return;
                if (e.gamma !== null && e.beta !== null) {
                    let rawRY = Math.max(-25, Math.min(25, e.gamma)) * 1.2;
                    let rawRX = Math.max(-25, Math.min(25, e.beta - 45)) * 1.2;
                    window.sharedCard3D.targetRY = (window.sharedCard3D.targetRY * 0.95) + (rawRY * 0.05);
                    window.sharedCard3D.targetRX = (window.sharedCard3D.targetRX * 0.95) + (rawRX * 0.05);
                }
            };

            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                DeviceOrientationEvent.requestPermission()
                    .then(state => {
                        if (state === 'granted') {
                            window.addEventListener('deviceorientation', window.sharedCard3D.orientationHandler);
                        }
                    })
                    .catch(err => console.error("Gyroscope permission denied:", err));
            } else {
                window.addEventListener('deviceorientation', window.sharedCard3D.orientationHandler);
            }
        }

        if (!window.sharedCard3D.active) {
            window.sharedCard3D.active = true;
            requestAnimationFrame(() => window.sharedCard3D.updateRotation(cardId, containerId === 'inv-card-3d-container' ? 'investment-card-modal' : 'image-overlay'));
        }
    },

    stop: function() {
        window.sharedCard3D.active = false;
        window.sharedCard3D.cachedEl = null;
        if (window.sharedCard3D.orientationHandler) {
            window.removeEventListener('deviceorientation', window.sharedCard3D.orientationHandler);
            window.sharedCard3D.orientationHandler = null;
        }
    }
};

// --- MULTIPLE MASKS ENGINE & FIELD MANAGER ---

window.parseMultipleMasks = function(maskStr) {
    if (!maskStr) return [];
    const parts = maskStr.split(';');
    const result = [];
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i].trim();
        if (!p) continue;
        if (p.startsWith('data:') && i + 1 < parts.length && parts[i + 1].trim().startsWith('base64,')) {
            result.push(p + ';' + parts[i + 1].trim());
            i++; // skip next part
        } else {
            result.push(p);
        }
    }
    return result;
};

window.resolveMaskUrl = function(maskStr) {
    const masks = window.parseMultipleMasks(maskStr);
    if (masks.length === 0) return Promise.resolve('');
    if (masks.length === 1) return Promise.resolve(masks[0]);

    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = 168;
        canvas.height = 244;
        const ctx = canvas.getContext('2d');

        let loadedCount = 0;
        const images = [];

        const loadImage = (url, index) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                images[index] = img;
                loadedCount++;
                if (loadedCount === masks.length) {
                    drawAndResolve();
                }
            };
            img.onerror = () => {
                images[index] = null;
                loadedCount++;
                if (loadedCount === masks.length) {
                    drawAndResolve();
                }
            };
            img.src = url;
        };

        const drawAndResolve = () => {
            let firstDrawn = false;
            for (let i = 0; i < images.length; i++) {
                if (images[i]) {
                    if (!firstDrawn) {
                        ctx.drawImage(images[i], 0, 0, canvas.width, canvas.height);
                        firstDrawn = true;
                        ctx.globalCompositeOperation = 'multiply';
                    } else {
                        ctx.drawImage(images[i], 0, 0, canvas.width, canvas.height);
                    }
                }
            }
            if (!firstDrawn) {
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            ctx.globalCompositeOperation = 'source-over';
            resolve(canvas.toDataURL('image/png'));
        };

        masks.forEach((url, index) => {
            loadImage(url, index);
        });
    });
};

window.setupMultiMaskField = function(targetInputSelector, containerSelector, addBtnSelector) {
    console.log("setupMultiMaskField running", targetInputSelector, containerSelector, addBtnSelector);
    const $targetInput = $(targetInputSelector);
    const $container = $(containerSelector);
    const $addBtn = $(addBtnSelector);

    console.log("Elements lengths:", $targetInput.length, $container.length, $addBtn.length);
    if (!$targetInput.length || !$container.length) return;

    const updateTargetFromRows = () => {
        const values = [];
        $container.find('.multi-mask-row-input').each(function() {
            const val = $(this).val().trim();
            if (val && !val.startsWith('data:image/')) {
                values.push(val);
            }
        });

        // Keep any existing base64 painted mask as the first element of the field
        const currentVal = $targetInput.val() || '';
        const masks = window.parseMultipleMasks(currentVal);
        const base64Mask = masks.find(m => m.startsWith('data:image/'));

        if (base64Mask) {
            values.unshift(base64Mask);
        }

        $targetInput.val(values.join(';')).trigger('change');
    };

    const buildRowsFromTarget = () => {
        $container.empty();
        const value = $targetInput.val() || '';
        const masks = window.parseMultipleMasks(value);

        masks.forEach((maskUrl) => {
            // Only add rows for non-base64 custom uploaded/loaded mask URLs
            if (!maskUrl.startsWith('data:image/')) {
                addMaskRow(maskUrl);
            }
        });
    };

    const addMaskRow = (maskUrl = '') => {
        const rowId = 'mask-row-' + Math.random().toString(36).substr(2, 9);
        const fileInputId = 'file-' + rowId;

        const rowHTML = `
            <div class="multi-mask-row" id="${rowId}" style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center; background: rgba(255,255,255,0.02); padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                <input type="text" class="multi-mask-row-input" value="${maskUrl}" placeholder="URL de máscara (Cloudinary, etc.)" style="flex: 1; background: #252525; color: white; border: 1px solid rgba(255,255,255,0.1); padding: 8px; border-radius: 6px;">
                <input type="file" id="${fileInputId}" class="multi-mask-file-input" accept="image/*" style="display: none;">
                <button type="button" class="btn btn-secondary btn-sm btn-row-upload" onclick="$('#${fileInputId}').click()" style="white-space: nowrap; padding: 8px 12px; font-size: 12px; border-radius: 6px;">
                    <i class="fas fa-upload"></i> Subir
                </button>
                <button type="button" class="btn btn-danger btn-sm btn-row-delete" style="padding: 8px 12px; font-size: 12px; border-radius: 6px;">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        `;

        const $row = $(rowHTML);
        $container.append($row);

        $row.find('.multi-mask-row-input').on('input change', function() {
            updateTargetFromRows();
        });

        $row.find('.multi-mask-file-input').on('change', async function() {
            if (this.files.length === 0) return;
            const file = this.files[0];
            Swal.fire({ title: 'Subiendo máscara...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            try {
                const secureUrl = await CloudinaryUpload.uploadImage(file);
                $row.find('.multi-mask-row-input').val(secureUrl).trigger('change');
                Swal.fire({ icon: 'success', title: '¡Subido con éxito!', timer: 1000, showConfirmButton: false });
            } catch (err) {
                Swal.fire('Error', 'No se pudo subir la imagen a Cloudinary.', 'error');
            }
        });

        $row.find('.btn-row-delete').on('click', function() {
            $row.remove();
            updateTargetFromRows();
        });
    };

    $targetInput.off('change.multiMask').on('change.multiMask', function() {
        if (!$(document.activeElement).hasClass('multi-mask-row-input')) {
            buildRowsFromTarget();
        }
    });

    $addBtn.off('click').on('click', function() {
        addMaskRow();
    });

    buildRowsFromTarget();
};

// Wrap jQuery val() to automatically trigger 'change' event on target inputs programmatically updated
const originalVal = $.fn.val;
$.fn.val = function(value) {
    if (value !== undefined) {
        const result = originalVal.apply(this, arguments);
        const ids = ['#slot-custom-mask', '#bdd-custom-mask', '#modal-wishlist-custom-mask', '#modal-custom-mask', '#owner-card-mask'];
        this.each(function() {
            const id = $(this).attr('id');
            if (id && ids.includes('#' + id)) {
                $(this).trigger('change');
            }
        });
        return result;
    }
    return originalVal.apply(this, arguments);
};

// --- RUNTIME MAINTENANCE & BETA/TEST MODE OVERLAY SYSTEM ---
window.checkVikingMaintenance = async function(zoneKey) {
    if (!zoneKey) return;

    // 1. Check session cache or global user variables for admin status
    let isAdmin = false;
    try {
        const cachedUserStr = localStorage.getItem('tcg_session');
        if (cachedUserStr) {
            const cachedUser = JSON.parse(cachedUserStr);
            if (cachedUser && (cachedUser.role === 'admin' || cachedUser.role === 'admin_store')) {
                isAdmin = true;
            }
        }
    } catch(e){}

    if (!isAdmin && typeof currentUser !== 'undefined' && currentUser && (currentUser.role === 'admin' || currentUser.role === 'admin_store')) {
        isAdmin = true;
    }
    if (!isAdmin && typeof window.currentUser !== 'undefined' && window.currentUser && (window.currentUser.role === 'admin' || window.currentUser.role === 'admin_store')) {
        isAdmin = true;
    }

    if (!isAdmin && typeof _supabase !== 'undefined') {
        try {
            const { data: { session } } = await _supabase.auth.getSession();
            if (session && session.user) {
                const { data: user } = await _supabase.from('usuarios').select('role').eq('id', session.user.id).single();
                if (user && (user.role === 'admin' || user.role === 'admin_store')) {
                    isAdmin = true;
                }
            }
        } catch(e){}
    }

    // Admin bypass: Admins bypass maintenance/beta overlays entirely to test freely
    if (isAdmin) {
        console.log(`[VikingDev] Modo Admin detectado. Ignorando overlay de mantenimiento/beta para ${zoneKey}.`);
        return;
    }

    // 2. Fetch maintenance config from localStorage or Supabase
    let maintenanceConfig = null;
    const savedLocal = localStorage.getItem('viking_maintenance_config');
    if (savedLocal) {
        try {
            maintenanceConfig = JSON.parse(savedLocal);
        } catch(e){}
    }

    let activeAssignment = null;
    if (typeof _supabase !== 'undefined') {
        try {
            const { data: assignments } = await _supabase
                .from('build_assignments')
                .select('*')
                .eq('view_name', zoneKey)
                .eq('target', 'public')
                .eq('is_active', true)
                .maybeSingle();

            if (assignments) {
                activeAssignment = assignments;
            }
        } catch(e){}
    }

    // Determine configuration for this zone
    let rawConf = null;
    if (maintenanceConfig && maintenanceConfig.zones && maintenanceConfig.zones[zoneKey]) {
        rawConf = maintenanceConfig.zones[zoneKey];
    } else if (activeAssignment) {
        rawConf = {
            active: true,
            mode: 'test',
            gltfUrl: "https://vikingantonio.github.io/vikingdev3D/assets/letrasVIKINGDEVfb.glb",
            title: "Modo Prueba / Beta",
            message: 'Aún estamos trabajando en esta área y puede haber errores o inconsistencias. Si tienes alguna sugerencia o comentario, escríbenos en <a href="https://m.me/vikingdevtj" target="_blank">VikingDev</a>.',
            scale: 1.8
        };
    }

    if (!rawConf) return;

    let active = false;
    let mode = 'maintenance';
    let gltfUrl = "https://vikingantonio.github.io/vikingdev3D/assets/letrasVIKINGDEVfb.glb";
    let title = "Mantenimiento en curso";
    let message = "Estamos realizando actualizaciones importantes para brindarte la mejor experiencia. Regresaremos pronto.";
    let scale = 1.8;

    if (typeof rawConf === 'boolean') {
        active = rawConf;
    } else if (typeof rawConf === 'object') {
        active = rawConf.active === true;
        mode = rawConf.mode || 'maintenance';
        gltfUrl = rawConf.gltfUrl || gltfUrl;
        title = rawConf.title || (mode === 'test' ? "Modo Prueba / Beta" : title);
        message = rawConf.message || (mode === 'test' ? 'Aún estamos trabajando en esta área y puede haber errores o inconsistencias. Si tienes alguna sugerencia o comentario, escríbenos en <a href="https://m.me/vikingdevtj" target="_blank">VikingDev</a>.' : message);
        scale = rawConf.scale || scale;
    }

    if (!active) return;


    // Render Overlay Screen if not already present
    let $overlay = $('#viking-maintenance-overlay-screen');
    if (!$overlay.length) {
        const overlayHtml = `
            <div id="viking-maintenance-overlay-screen" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(4, 7, 16, 0.96);
                backdrop-filter: blur(25px);
                -webkit-backdrop-filter: blur(25px);
                z-index: 999999;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 24px;
                text-align: center;
                user-select: none;
                box-sizing: border-box;
                color: #ffffff;
                font-family: 'Outfit', 'Montserrat', sans-serif;
            ">
                <button id="viking-overlay-close-x" style="
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: #fff;
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    font-size: 1.4rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    z-index: 1000000;
                    backdrop-filter: blur(10px);
                    transition: all 0.2s ease;
                " title="Cerrar / Continuar en Modo Prueba">
                    <i class="fas fa-times"></i>
                </button>

                <div style="width: 100%; max-width: 650px; height: 380px; position: relative; margin-bottom: 20px;">
                    <model-viewer id="viking-maintenance-overlay-viewer"
                        src="${gltfUrl}"
                        scale="${scale} ${scale} ${scale}"
                        auto-rotate
                        camera-controls
                        shadow-intensity="1"
                        exposure="1.2"
                        style="width: 100%; height: 100%; outline: none;">
                    </model-viewer>
                </div>

                <div id="viking-overlay-badge" style="
                    background: linear-gradient(135deg, rgba(255, 71, 87, 0.25), rgba(255, 165, 0, 0.25));
                    border: 1px solid #ff4757;
                    color: #ff6b81;
                    padding: 6px 18px;
                    border-radius: 30px;
                    font-size: 0.85rem;
                    font-weight: 800;
                    letter-spacing: 1.5px;
                    text-transform: uppercase;
                    margin-bottom: 16px;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    box-shadow: 0 0 15px rgba(255, 71, 87, 0.3);
                "><i class="fas fa-hard-hat"></i> ${mode === 'test' ? 'Modo Prueba / Beta' : 'Mantenimiento en curso'}</div>

                <h2 style="font-size: 2rem; font-weight: 900; color: #ffffff; margin-bottom: 12px; text-transform: uppercase; letter-spacing: -0.5px; text-shadow: 0 4px 20px rgba(0, 210, 255, 0.4);">${title}</h2>
                <div style="font-size: 1.05rem; color: #cbd5e1; max-width: 650px; line-height: 1.6; margin-bottom: 24px;">${message}</div>
            </div>
        `;
        $('body').append(overlayHtml);
        $overlay = $('#viking-maintenance-overlay-screen');

        $('#viking-overlay-close-x').click(function() {
            $overlay.fadeOut(300, function() { $(this).remove(); });
        });
    }

    if (mode === 'test') {
        $('#viking-overlay-close-x').show();
    } else {
        $('#viking-overlay-close-x').hide();
    }
};
