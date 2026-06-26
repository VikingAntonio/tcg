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

    // Check for "List View" prefix L:
    // If not present and not in admin, we don't apply the effect to list items
    const isPublic = !window.location.pathname.includes('admin.html') && !window.location.pathname.includes('deseos.html') && !window.location.pathname.includes('binders.html');

    let actualHolo = holo;
    if (holo.startsWith('L:')) {
        actualHolo = holo.substring(2);
    } else if (isPublic) {
        // Skip rendering if not explicitly enabled for lists and we are in a public list view
        // Note: Modal/Popup uses applyVisualsToModal which doesn't have this check
        return;
    }

    // Remove existing multi-layers if any
    $el.find('.holo-layer-multi').remove();

    if (actualHolo.startsWith('custom-textures|')) {
        // Multi-Texture Logic
        $el.addClass('active foil-loop multi-texture-mode');
        if (mask) {
            $el.addClass('masked').css({'--mask-url': `url(${mask})`, '--mask': `url(${mask})`});
        }

        const parts = actualHolo.split('|');
        if (parts.length > 1) {
            const config = parts[1];
            const channels = config.split(','); // R:tex,G:tex,B:tex

            channels.forEach(chanStr => {
                const chanParts = chanStr.split(':');
                if (chanParts.length > 1) {
                    const chan = chanParts[0];
                    const tex = chanParts[1];
                    const $layer = $('<div class="holo-layer holo-layer-multi"></div>');
                    $layer.addClass(`layer-chan-${chan.toLowerCase()}`);

                    // Apply texture to layer
                    window.applyTextureToLayer($layer, tex);
                    $el.append($layer);
                }
            });
        }

        $el.css({'--mx': 0.5, '--my': 0.5, '--angle': '135deg', '--card-opacity': 1});
        return;
    }

    // Standard single texture logic
    const POKEMON_FOILS = window.POKEMON_FOILS;
    let baseHolo = actualHolo;
    let isCustomFoil = false;

    if (actualHolo.startsWith('custom-foil|')) {
        isCustomFoil = true;
        const parts = actualHolo.split('|');
        baseHolo = parts.length > 1 ? parts[1] : 'foil';
    }

    // Cleanup previous multi-texture classes
    $el.removeClass('multi-texture-mode');

    if (POKEMON_FOILS[baseHolo]) {
        let rarityVal = POKEMON_FOILS[baseHolo];
        $el.addClass("card");
        if (rarityVal.includes('trainer gallery')) { $el.attr("data-trainer-gallery", "true"); rarityVal = rarityVal.replace('trainer gallery', ''); }
        if (rarityVal.includes('supporter')) { $el.attr("data-subtypes", "supporter"); rarityVal = rarityVal.replace('supporter', ''); }
        if (rarityVal.includes('pokemon')) { $el.attr("data-supertype", "pokémon"); rarityVal = rarityVal.replace('pokemon', ''); }
        $el.attr("data-rarity", rarityVal.trim());

        if ((isCustomFoil || baseHolo === 'custom-texture') && mask) {
            $el.addClass("masked").css({"--mask": `url(${mask})`, "--mask-url": `url(${mask})`});
        }
        const rx = 0.5, ry = 0.5;
        $el.css({'--mx': rx, '--my': ry, '--seedx': rx, '--seedy': ry, '--cosmosbg': `${Math.floor(rx * 734)}px ${Math.floor(ry * 1280)}px`});
    } else {
        $el.addClass(baseHolo);
        if ((isCustomFoil || baseHolo === 'custom-texture') && mask) {
            $el.addClass("masked").css({"--mask": `url(${mask})`, "--mask-url": `url(${mask})`});
        }
        $el.css({'--mx': 0.5, '--my': 0.5});
    }

    $el.css({'--angle': '135deg', '--card-opacity': 1});

    if ($el.find('.holo-layer:not(.holo-layer-multi)').length === 0) {
        $el.append('<div class="holo-layer"></div>');
    }
    $el.addClass('active foil-loop');
};

window.applyTextureToLayer = function($layer, tex) {
    const POKEMON_FOILS = window.POKEMON_FOILS;
    if (POKEMON_FOILS[tex]) {
        let rarityVal = POKEMON_FOILS[tex];
        if (rarityVal.includes('trainer gallery')) { $layer.attr("data-trainer-gallery", "true"); rarityVal = rarityVal.replace('trainer gallery', ''); }
        if (rarityVal.includes('supporter')) { $layer.attr("data-subtypes", "supporter"); rarityVal = rarityVal.replace('supporter', ''); }
        if (rarityVal.includes('pokemon')) { $layer.attr("data-supertype", "pokémon"); rarityVal = rarityVal.replace('pokemon', ''); }
        $layer.attr("data-rarity", rarityVal.trim());
        $layer.addClass('card');
    } else {
        $layer.addClass(tex);
    }
};

// --- Global Navigation ---
// --- Mask Editor Logic ---
window.maskCanvas = null;
window.maskCtx = null;
window.isPainting = false;
window.currentBrushSize = 10;
window.currentTool = 'brush'; // 'brush' or 'eraser'
window.maskEditorMode = 'simple'; // 'simple' or 'multi'
window.selectedChannel = 'R'; // 'R', 'G', 'B' for multi mode
window.maskHistory = [];
const MAX_MASK_HISTORY = 20;

// Default textures for Multi-Mode
window.multiTextures = {
    R: 'pk-rare-holo-cosmos',
    G: 'starlight-rare',
    B: 'secret-rare'
};

// Zoom/Pan State
window.maskZoom = 1;
window.maskPanX = 0;
window.maskPanY = 0;
window.isPanning = false;
window.lastPanX = 0;
window.lastPanY = 0;

window.updateMaskTransform = function() {
    const $wrapper = $('#mask-canvas-wrapper');
    if (!$wrapper.length) return;
    $wrapper.css('transform', `translate(${window.maskPanX}px, ${window.maskPanY}px) scale(${window.maskZoom})`);
    $('#mask-zoom-val').text(Math.round(window.maskZoom * 100) + '%');
};

window.initMaskEditor = function() {
    window.maskCanvas = document.getElementById('mask-canvas');
    if (!window.maskCanvas) return;
    window.maskCtx = window.maskCanvas.getContext('2d');

    // UI Mode Switching
    $('#btn-mode-simple').off('click').on('click', function() {
        window.maskEditorMode = 'simple';
        $(this).addClass('active').siblings().removeClass('active');
        $('#simple-texture-picker').show();
        $('#multi-texture-picker').hide();
        $('#mask-instruction-text').text('Dibuja en blanco donde quieras aplicar el efecto foil.');
    });

    $('#btn-mode-multi').off('click').on('click', function() {
        window.maskEditorMode = 'multi';
        $(this).addClass('active').siblings().removeClass('active');
        $('#simple-texture-picker').hide();
        $('#multi-texture-picker').css('display', 'flex');
        $('#mask-instruction-text').text('Pinta con colores (R, G, B) para aplicar diferentes texturas.');
    });

    // Channel Selection
    $('.btn-channel').off('click').on('click', function() {
        window.selectedChannel = $(this).data('channel');
        $('.btn-channel').removeClass('active').css('border', 'none');
        $(this).addClass('active').css('border', '2px solid white');
        window.currentTool = 'brush';
        $('#tool-brush').addClass('active').siblings().removeClass('active');
    });

    // Texture Select Change
    $('#select-simple-texture').off('change').on('change', function() {
        // No immediate action needed, will be used on Save
    });

    $('.multi-tex-select').off('change').on('change', function() {
        const channel = $(this).data('channel');
        window.multiTextures[channel] = $(this).val();
    });

    $(window.maskCanvas).off('mousedown touchstart').on('mousedown touchstart', function(e) {
        if (window.currentTool === 'pan') {
            window.isPanning = true;
            const ev = e.type.includes('touch') ? e.originalEvent.touches[0] : e;
            window.lastPanX = ev.clientX;
            window.lastPanY = ev.clientY;
            return;
        }
        window.isPainting = true;
        window.saveMaskHistory();
        window.drawMask(e);
    });

    $(window).off('mousemove touchmove').on('mousemove touchmove', function(e) {
        if (window.isPanning) {
            const ev = e.type.includes('touch') ? e.originalEvent.touches[0] : e;
            const dx = ev.clientX - window.lastPanX;
            const dy = ev.clientY - window.lastPanY;
            window.maskPanX += dx;
            window.maskPanY += dy;
            window.lastPanX = ev.clientX;
            window.lastPanY = ev.clientY;
            window.updateMaskTransform();
            return;
        }
        if (window.isPainting) window.drawMask(e);
    });

    $(window).off('mouseup touchend').on('mouseup touchend', function() {
        window.isPainting = false;
        window.isPanning = false;
        if (window.maskCtx) window.maskCtx.beginPath();
    });

    // Mouse Wheel Zoom
    $('#mask-viewport').off('wheel').on('wheel', function(e) {
        e.preventDefault();
        const delta = e.originalEvent.deltaY;
        const zoomStep = 0.15;
        if (delta < 0) {
            window.maskZoom = Math.min(8, window.maskZoom + zoomStep);
        } else {
            window.maskZoom = Math.max(0.2, window.maskZoom - zoomStep);
        }
        window.updateMaskTransform();
    });

    $('#btn-zoom-in-mask').off('click').on('click', () => {
        window.maskZoom = Math.min(8, window.maskZoom + 0.5);
        window.updateMaskTransform();
    });

    $('#btn-zoom-out-mask').off('click').on('click', () => {
        window.maskZoom = Math.max(0.2, window.maskZoom - 0.5);
        window.updateMaskTransform();
    });

    $('#btn-zoom-reset-mask').off('click').on('click', () => {
        window.maskZoom = 1;
        window.maskPanX = 0;
        window.maskPanY = 0;
        window.updateMaskTransform();
    });

    $('#brush-size').off('input').on('input', function() {
        window.currentBrushSize = $(this).val();
        $('#brush-size-val').text(window.currentBrushSize);
    });

    $('#tool-brush').off('click').on('click', function() {
        window.currentTool = 'brush';
        $('.editor-controls .btn-secondary').removeClass('active');
        $(this).addClass('active');
        $('#mask-viewport').css('cursor', 'crosshair');
    });

    $('#tool-eraser').off('click').on('click', function() {
        window.currentTool = 'eraser';
        $('.editor-controls .btn-secondary').removeClass('active');
        $(this).addClass('active');
        $('#mask-viewport').css('cursor', 'crosshair');
    });

    $('#tool-pan').off('click').on('click', function() {
        window.currentTool = 'pan';
        $('.editor-controls .btn-secondary').removeClass('active');
        $(this).addClass('active');
        $('#mask-viewport').css('cursor', 'grab');
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

    $('#btn-save-mask').off('click').on('click', function() {
        const dataUrl = window.maskCanvas.toDataURL('image/png');

        let finalHolo = '';
        if (window.maskEditorMode === 'simple') {
            const tex = $('#select-simple-texture').val();
            finalHolo = `custom-foil|${tex}`;
        } else {
            const r = $('#select-multi-r').val();
            const g = $('#select-multi-g').val();
            const b = $('#select-multi-b').val();
            finalHolo = `custom-textures|R:${r},G:${g},B:${b}`;
        }

        // Use explicit target if set, otherwise fallback to standard IDs
        if (window.maskTargetInput) {
            $(window.maskTargetInput).val(dataUrl).trigger('change');
            // Try to find the corresponding holo effect select
            let holoTarget = window.maskTargetInput.replace('custom-mask', 'holo-effect').replace('mask', 'holo-effect');
            if (window.maskTargetInput === '#input-card-custom-mask') holoTarget = '#input-card-holo-effect';

            if ($(holoTarget).length) {
                if (!$(holoTarget + ` option[value="${finalHolo}"]`).length) {
                    $(holoTarget).append(`<option value="${finalHolo}">Custom: ${window.maskEditorMode === 'simple' ? 'Foil' : 'Multi'}</option>`);
                }
                $(holoTarget).val(finalHolo).trigger('change');
            }
        } else {
            $('#slot-custom-mask, #modal-custom-mask, #owner-card-mask, #bdd-custom-mask, #input-card-custom-mask, #inv-card-custom-mask').val(dataUrl).trigger('change');
            $('#slot-holo-effect, #modal-holo-effect, #owner-card-holo, #bdd-holo-effect, #input-card-holo-effect, #inv-card-holo-effect').each(function() {
                if (!$(this).find(`option[value="${finalHolo}"]`).length) {
                    $(this).append(`<option value="${finalHolo}">Custom: ${window.maskEditorMode === 'simple' ? 'Foil' : 'Multi'}</option>`);
                }
                $(this).val(finalHolo).trigger('change');
            });
        }

        $('#mask-editor-overlay').removeClass('active');
        Swal.fire('Guardado', 'La máscara y textura se han generado correctamente.', 'success');
    });
};

window.initMaskCanvas = function() {
    // Reset Zoom/Pan
    window.maskZoom = 1;
    window.maskPanX = 0;
    window.maskPanY = 0;
    window.updateMaskTransform();

    // Support simple mode by default
    $('#btn-mode-simple').trigger('click');

    // Supports all integrated form input IDs
    const currentMask = $(window.maskTargetInput || '#slot-custom-mask, #modal-custom-mask, #owner-card-mask, #inv-card-custom-mask, #input-card-custom-mask').val();
    let currentHolo = '';
    if (window.maskTargetInput) {
        let holoTarget = window.maskTargetInput.replace('custom-mask', 'holo-effect').replace('mask', 'holo-effect');
        if (window.maskTargetInput === '#input-card-custom-mask') holoTarget = '#input-card-holo-effect';
        currentHolo = $(holoTarget).val() || '';
    } else {
        currentHolo = $('#slot-holo-effect, #modal-holo-effect, #owner-card-holo, #inv-card-holo-effect, #bdd-holo-effect, #input-card-holo-effect').val() || '';
    }

    // Set Background Image to Editor
    let currentImg = '';
    if (window.maskTargetInput) {
        let imgTarget = window.maskTargetInput.replace('custom-mask', 'image-url').replace('mask', 'image-url');
        if (window.maskTargetInput === '#input-card-custom-mask') imgTarget = '#input-card-image';
        currentImg = $(imgTarget).val() || '';
    } else {
        currentImg = $('#slot-image-url, #modal-wishlist-image, #owner-card-img, #bdd-image-url, #input-card-image').filter(function() { return $(this).val(); }).first().val() || '';
    }
    $('#mask-canvas-wrapper').css('background-image', currentImg ? `url(${currentImg})` : 'none');

    // Initialize values from current holo string
    if (currentHolo.startsWith('custom-textures|')) {
        $('#btn-mode-multi').trigger('click');
        const parts = currentHolo.split('|')[1].split(',');
        parts.forEach(p => {
            const [chan, tex] = p.split(':');
            if (chan === 'R') { $('#select-multi-r').val(tex); window.multiTextures.R = tex; }
            if (chan === 'G') { $('#select-multi-g').val(tex); window.multiTextures.G = tex; }
            if (chan === 'B') { $('#select-multi-b').val(tex); window.multiTextures.B = tex; }
        });
    } else if (currentHolo.startsWith('custom-foil|')) {
        const tex = currentHolo.split('|')[1];
        $('#select-simple-texture').val(tex);
    }

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

    // Enhanced coordinate mapping with Zoom and Pan support
    // Standard coordinate mapping (the canvas element is what gets transformed)
    x = x * (window.maskCanvas.width / rect.width);
    y = y * (window.maskCanvas.height / rect.height);

    window.maskCtx.lineWidth = window.currentBrushSize;
    window.maskCtx.lineCap = 'round';
    window.maskCtx.lineJoin = 'round';

    if (window.currentTool === 'eraser') {
        window.maskCtx.strokeStyle = 'black';
    } else {
        if (window.maskEditorMode === 'simple') {
            window.maskCtx.strokeStyle = 'white';
        } else {
            if (window.selectedChannel === 'R') window.maskCtx.strokeStyle = '#ff0000';
            else if (window.selectedChannel === 'G') window.maskCtx.strokeStyle = '#00ff00';
            else if (window.selectedChannel === 'B') window.maskCtx.strokeStyle = '#0000ff';
        }
    }

    window.maskCtx.lineTo(x, y);
    window.maskCtx.stroke();
    window.maskCtx.beginPath();
    window.maskCtx.moveTo(x, y);
};

// --- GLOBAL SEARCH FUNCTIONS ---
let ygoSetsCache = null;
window.getYgoSets = async function() {
    if (ygoSetsCache) return ygoSetsCache;
    try {
        const response = await fetch('https://db.ygoprodeck.com/api/v7/cardsets.php');
        ygoSetsCache = await response.json();
    } catch (e) {
        console.warn("Error fetching YGO sets:", e);
        ygoSetsCache = [];
    }
    return ygoSetsCache;
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

        const finalYgoUrl = ygoUrl + ygoParams.join('&');

        // Special YGO search logic for passcodes and set codes
        const ygoSpecialSearch = async () => {
            if (query.length < 1) return [];
            const q = query.toUpperCase();
            // Passcode (Numeric 5-10 digits)
            if (/^\d{5,10}$/.test(q)) {
                const r = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${q}`, { signal }).then(res => res.json()).catch(() => ({data:[]}));
                return r.data || [];
            }
            // Set Code (Format XXX-123 or XXX-EN123)
            const setMatch = q.match(/^([A-Z0-9]{3,6})-([A-Z0-9]{3,8})$/);
            if (setMatch) {
                const prefix = setMatch[1];
                const sets = await window.getYgoSets();
                const setObj = sets.find(s => s.set_code.toUpperCase() === prefix);
                if (setObj) {
                    const r = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(setObj.set_name)}`, { signal }).then(res => res.json()).catch(() => ({data:[]}));
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
            query.length >= 1 ? fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(query)}`, { signal }).then(r => r.ok ? r.json() : {data:[]}).catch(() => ({data:[]})) : Promise.resolve({data:[]}),

            // Special YGO Search
            ygoSpecialSearch(),

            // Pokémon TCGdex - English
            query.length >= 1 ? fetch(`https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(query)}`, { signal }).then(r => r.ok ? r.json() : []).catch(() => []) : Promise.resolve([]),

            // Pokémon TCGdex - Spanish
            query.length >= 1 ? fetch(`https://api.tcgdex.net/v2/es/cards?name=${encodeURIComponent(query)}`, { signal }).then(r => r.ok ? r.json() : []).catch(() => []) : Promise.resolve([]),

            // Pokémon TCGdex - Japanese
            query.length >= 1 ? fetch(`https://api.tcgdex.net/v2/ja/cards?name=${encodeURIComponent(query)}`, { signal }).then(r => r.ok ? r.json() : []).catch(() => []) : Promise.resolve([]),

            // Lorcana Search
            query.length >= 1 ? fetch(`https://api.lorcana-api.com/cards/fetch?search=name~${encodeURIComponent(query)}&displayonly=name;image;cost;set_num`, { signal }).then(r => r.ok ? r.json() : []).catch(() => []) : Promise.resolve([]),

            // Viking Search
            query.length >= 1 ? (typeof VikingData !== 'undefined' ? VikingData.search(query) : Promise.resolve([])) : Promise.resolve([]),

            // TCGAPI.dev (Top games)
            searchTCGAPI(query, 'pokemon'),
            searchTCGAPI(query, 'yugioh'),
            searchTCGAPI(query, 'magic'),
            searchTCGAPI(query, 'onepiece'),
            searchTCGAPI(query, 'lorcana')
        ];

        const [ygName, ygCode, ygSpecial, pkEn, pkEs, pkJa, lorResults, vikResults, tcgPk, tcgYgo, tcgMg, tcgOp, tcgLor] = await Promise.all(searchPromises);

        let combinedResults = [];

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
    // Inject SVG Filters for RGB Masking
    if ($('#rgb-mask-filters').length === 0) {
        const svgFilters = `
        <svg id="rgb-mask-filters" style="position: absolute; width: 0; height: 0; overflow: hidden;" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="extract-red"><feColorMatrix type="matrix" values="0 0 0 0 1, 0 0 0 0 1, 0 0 0 0 1, 1 0 0 0 0"/></filter>
            <filter id="extract-green"><feColorMatrix type="matrix" values="0 0 0 0 1, 0 0 0 0 1, 0 0 0 0 1, 0 1 0 0 0"/></filter>
            <filter id="extract-blue"><feColorMatrix type="matrix" values="0 0 0 0 1, 0 0 0 0 1, 0 0 0 0 1, 0 0 1 0 0"/></filter>
          </defs>
        </svg>`;
        $('body').append(svgFilters);
    }

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
        const foilOptions = `
            <optgroup label="Pokemon TCG Foils">
                <option value="pk-rare-holo">PK: Rare Holo</option>
                <option value="pk-rare-holo-cosmos">PK: Cosmos Holo</option>
                <option value="pk-rare-holo-v">PK: Rare Holo V</option>
                <option value="pk-rare-holo-vmax">PK: Rare Holo VMAX</option>
                <option value="pk-rare-holo-vstar">PK: Rare Holo VSTAR</option>
                <option value="pk-rare-rainbow">PK: Rare Rainbow</option>
                <option value="pk-rare-secret">PK: Rare Secret</option>
                <option value="pk-amazing-rare">PK: Amazing Rare</option>
                <option value="pk-radiant-rare">PK: Radiant Rare</option>
                <option value="pk-reverse-holo">PK: Reverse Holo</option>
            </optgroup>
            <optgroup label="Efectos Genéricos">
                <option value="foil">Foil Standard</option>
                <option value="super-rare">Super Rare (Brillo)</option>
                <option value="secret-rare">Secret Rare (Rayas)</option>
                <option value="ghost-rare">Ghost Rare (3D)</option>
                <option value="starlight-rare">Starlight Rare (Diamantina)</option>
                <option value="rainbow">Rainbow (Arcoíris)</option>
                <option value="custom-texture">Textura 3D</option>
            </optgroup>
        `;

        const maskEditorHTML = `
        <style>
            #mask-editor-overlay .overlay-content {
                background: #111;
                border: 1px solid #333;
                box-shadow: 0 20px 50px rgba(0,0,0,0.8);
            }
            @media (max-width: 768px) {
                .mask-editor-main-layout { flex-direction: column !important; overflow-y: auto !important; }
                .mask-sidebar { width: 100% !important; order: 2; height: auto !important; overflow: visible !important; }
                #mask-viewport { height: 40vh !important; min-height: 250px !important; order: 1; flex: none !important; }
            }
        </style>
        <div id="mask-editor-overlay" class="overlay">
            <div class="overlay-content" style="max-width: 900px; width: 98%; height: 95vh; display: flex; flex-direction: column; padding: 20px;">
                <span id="close-mask-editor" class="close-btn">&times;</span>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h2 style="margin: 0;">Editor de Foil</h2>
                    <div style="display: flex; gap: 10px;">
                        <button id="btn-undo-mask" class="btn btn-secondary btn-sm" title="Deshacer"><i class="fas fa-undo"></i></button>
                        <button id="btn-clear-mask" class="btn btn-danger btn-sm" title="Limpiar Todo"><i class="fas fa-trash"></i></button>
                        <button id="btn-save-mask" class="btn btn-sm" style="background: var(--primary-color); color: #000; font-weight: 800;"><i class="fas fa-save"></i> GUARDAR</button>
                    </div>
                </div>

                <div class="mask-editor-main-layout" style="display: flex; gap: 20px; flex: 1; min-height: 0;">
                    <!-- Sidebar Controls -->
                    <div class="mask-sidebar" style="width: 280px; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; padding-right: 10px;">
                        <div class="mask-control-group">
                            <label style="font-size: 11px; font-weight: 800; color: #888; text-transform: uppercase;">Modo de Edición</label>
                            <div style="display: flex; gap: 5px; margin-top: 8px;">
                                <button id="btn-mode-simple" class="btn btn-secondary active" style="flex: 1; font-size: 10px; padding: 8px;">SIMPLE</button>
                                <button id="btn-mode-multi" class="btn btn-secondary" style="flex: 1; font-size: 10px; padding: 8px;">MULTI</button>
                            </div>
                        </div>

                        <div id="simple-texture-picker">
                            <label style="font-size: 11px; font-weight: 800; color: #888; text-transform: uppercase;">Textura Foil</label>
                            <select id="select-simple-texture" style="width: 100%; margin-top: 8px; background: #252525; color: white; border: 1px solid #444; padding: 8px; border-radius: 6px; font-size: 12px;">
                                ${foilOptions}
                            </select>
                        </div>

                        <div id="multi-texture-picker" style="display: none; flex-direction: column; gap: 12px;">
                            <label style="font-size: 11px; font-weight: 800; color: #888; text-transform: uppercase;">Canales RGB</label>
                            <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px; display: flex; flex-direction: column; gap: 10px;">
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    <button class="btn-channel active" data-channel="R" style="width: 24px; height: 24px; background: #ff4757; border: 2px solid white; border-radius: 4px; cursor: pointer; flex-shrink: 0;"></button>
                                    <select id="select-multi-r" data-channel="R" class="multi-tex-select" style="flex: 1; background: #1a1a1a; color: white; border: 1px solid #333; padding: 5px; border-radius: 4px; font-size: 11px;">
                                        ${foilOptions}
                                    </select>
                                </div>
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    <button class="btn-channel" data-channel="G" style="width: 24px; height: 24px; background: #2ed573; border: none; border-radius: 4px; cursor: pointer; flex-shrink: 0;"></button>
                                    <select id="select-multi-g" data-channel="G" class="multi-tex-select" style="flex: 1; background: #1a1a1a; color: white; border: 1px solid #333; padding: 5px; border-radius: 4px; font-size: 11px;">
                                        ${foilOptions}
                                    </select>
                                </div>
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    <button class="btn-channel" data-channel="B" style="width: 24px; height: 24px; background: #1e90ff; border: none; border-radius: 4px; cursor: pointer; flex-shrink: 0;"></button>
                                    <select id="select-multi-b" data-channel="B" class="multi-tex-select" style="flex: 1; background: #1a1a1a; color: white; border: 1px solid #333; padding: 5px; border-radius: 4px; font-size: 11px;">
                                        ${foilOptions}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="mask-control-group">
                            <label style="font-size: 11px; font-weight: 800; color: #888; text-transform: uppercase;">Herramientas</label>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 8px;">
                                <button id="tool-brush" class="btn btn-secondary active btn-sm"><i class="fas fa-paint-brush"></i> Pincel</button>
                                <button id="tool-eraser" class="btn btn-secondary btn-sm"><i class="fas fa-eraser"></i> Borrador</button>
                                <button id="tool-pan" class="btn btn-secondary btn-sm" style="grid-column: span 2;"><i class="fas fa-arrows-alt"></i> Mover / Pan</button>
                            </div>
                        </div>

                        <div class="mask-control-group">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <label style="font-size: 11px; font-weight: 800; color: #888; text-transform: uppercase;">Tamaño Pincel</label>
                                <span id="brush-size-val" style="font-weight: 800; color: var(--primary-color);">10</span>
                            </div>
                            <input type="range" id="brush-size" min="1" max="50" value="10" style="width: 100%; margin-top: 10px;">
                        </div>

                        <div class="mask-control-group" style="margin-top: auto; background: rgba(0,210,255,0.05); padding: 15px; border-radius: 12px; border: 1px solid rgba(0,210,255,0.1);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <label style="font-size: 11px; font-weight: 800; color: var(--primary-color); text-transform: uppercase;">Zoom Viewport</label>
                                <span id="mask-zoom-val" style="font-weight: 800; color: #fff;">100%</span>
                            </div>
                            <div style="display: flex; gap: 5px;">
                                <button id="btn-zoom-out-mask" class="btn btn-secondary btn-sm" style="flex: 1;"><i class="fas fa-search-minus"></i></button>
                                <button id="btn-zoom-reset-mask" class="btn btn-secondary btn-sm" style="flex: 1;"><i class="fas fa-sync-alt"></i></button>
                                <button id="btn-zoom-in-mask" class="btn btn-secondary btn-sm" style="flex: 1;"><i class="fas fa-search-plus"></i></button>
                            </div>
                        </div>
                    </div>

                    <!-- Viewport Area -->
                    <div id="mask-viewport" style="flex: 1; background: #0a0a0a; overflow: hidden; border: 1px solid #333; border-radius: 12px; display: flex; align-items: center; justify-content: center; touch-action: none; position: relative;">
                        <div id="mask-zoom-container" style="position: relative; transform-origin: center; transition: transform 0.1s ease-out; pointer-events: none;">
                            <div id="mask-canvas-wrapper" style="position: relative; border: 1px solid #444; width: 168px; height: 244px; background-size: cover; background-position: center; pointer-events: auto;">
                                <canvas id="mask-canvas" width="168" height="244" style="cursor: crosshair; display: block;"></canvas>
                            </div>
                        </div>
                        <div style="position: absolute; bottom: 15px; left: 15px; background: rgba(0,0,0,0.6); padding: 8px 15px; border-radius: 20px; font-size: 11px; color: #eee; pointer-events: none;">
                            <i class="fas fa-mouse"></i> Rueda para Zoom | <i class="fas fa-hand-pointer"></i> Espacio + Arrastrar para Mover
                        </div>
                    </div>
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
        window.maskTargetInput = null;
        $('#mask-editor-overlay').addClass('active');
        window.initMaskCanvas();
    });

    $(document).on('click', '.btn-edit-mask-nexus', function() {
        window.maskTargetInput = '#input-card-custom-mask';
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

function makeCompanionDraggable() {
    const wrapper = document.getElementById('companion-wrapper');
    const handle = document.getElementById('companion-drag-handle');
    if (!wrapper || !handle) return;

    let isDragging = false;
    let startX, startY;
    let initialX, initialY;
    window.isCompanionDragging = false;

    // Reset touchAction on the companion container to allow internal interactions
    const companion = document.getElementById('floating-companion-container');
    if (companion) companion.style.touchAction = 'auto';

    handle.style.touchAction = 'none';

    handle.addEventListener('pointerdown', (e) => {
        isDragging = true;
        window.isCompanionDragging = false;
        startX = e.clientX;
        startY = e.clientY;
        const rect = wrapper.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
        handle.setPointerCapture(e.pointerId);
        e.stopPropagation();
    });

    window.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) window.isCompanionDragging = true;
        let newX = initialX + dx;
        let newY = initialY + dy;
        newX = Math.max(0, Math.min(window.innerWidth - wrapper.offsetWidth, newX));
        newY = Math.max(0, Math.min(window.innerHeight - wrapper.offsetHeight, newY));

        wrapper.style.left = newX + 'px';
        wrapper.style.top = newY + 'px';
        wrapper.style.bottom = 'auto';
        wrapper.style.right = 'auto';
        wrapper.style.margin = '0';
    });

    window.addEventListener('pointerup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        setTimeout(() => { window.isCompanionDragging = false; }, 100);
    });
}
