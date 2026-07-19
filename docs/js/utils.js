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

        if ((isCustomFoil || baseHolo === 'custom-texture' || baseHolo === 'custom-textures') && mask) {
            $el.addClass("masked").css({"--mask": `url(${mask})`, "--mask-url": `url(${mask})`});
        }
        const rx = 0.5, ry = 0.5;
        $el.css({'--mx': rx, '--my': ry, '--seedx': rx, '--seedy': ry, '--cosmosbg': `${Math.floor(rx * 734)}px ${Math.floor(ry * 1280)}px`});
    } else {
        if (isMultiFoils) {
            $el.addClass('multi-foils');
            if (multiFoilsColor) {
                $el.addClass(`multi-foils-${multiFoilsColor}`);
            }
            if (mask) {
                $el.addClass("masked").css({"--mask": `url(${mask})`, "--mask-url": `url(${mask})`});
            }
            $el.css({'--mx': 0.5, '--my': 0.5});
        } else {
            $el.addClass(baseHolo);
            if ((isCustomFoil || baseHolo === 'custom-texture' || baseHolo === 'custom-textures') && mask) {
                $el.addClass("masked").css({"--mask": `url(${mask})`, "--mask-url": `url(${mask})`});
            }
            $el.css({'--mx': 0.5, '--my': 0.5});
        }
    }

    $el.css({
        '--angle': '135deg',
        '--card-opacity': 1,
        'will-change': 'transform, opacity'
    });

    if ($el.find('.holo-layer').length === 0) {
        $el.append('<div class="holo-layer"></div>');
    }
    if (baseHolo === 'pokeball-rare' && $el.find('.holo-layer-red').length === 0) {
        $el.append('<div class="holo-layer-red"></div>');
    }

    // Explicitly enforce 3D rendering context and backface-visibility on the appended layer to guarantee zero flickering
    $el.find('.holo-layer, .holo-layer-red').css({
        'will-change': 'transform, opacity',
        'backface-visibility': 'hidden',
        '-webkit-backface-visibility': 'hidden'
    });

    $el.addClass('active foil-loop');
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

    $('#btn-save-mask').off('click').on('click', function() {
        const dataUrl = window.maskCanvas.toDataURL('image/png');

        // Use explicit target if set, otherwise fallback to standard IDs
        if (window.maskTargetInput) {
            $(window.maskTargetInput).val(dataUrl).trigger('change');
        } else {
            $('#slot-custom-mask, #modal-custom-mask, #owner-card-mask, #bdd-custom-mask').val(dataUrl).trigger('change');
        }

        $('#mask-editor-overlay').removeClass('active');
        Swal.fire('Guardado', 'La máscara se ha generado correctamente.', 'success');
    });

    if (window.MultiFoils && typeof window.MultiFoils.initFloatingPalette === 'function') {
        window.MultiFoils.initFloatingPalette();
    }
};

window.initMaskCanvas = function() {
    // Supports all integrated form input IDs
    const currentMask = $('#slot-custom-mask, #modal-custom-mask, #owner-card-mask, #inv-card-custom-mask').val();

    window.maskZoom = 1;
    window.maskPanX = 0;
    window.maskPanY = 0;

    // Determine if multiFoils is active to show/hide palette
    let isMultiFoilsActive = false;
    const bddHolo = $('#bdd-holo-effect').val() || '';
    const slotHolo = $('#slot-holo-effect').val() || '';
    const wishlistHolo = $('#modal-wishlist-holo-effect').val() || '';
    const clientHolo = $('#modal-holo-effect').val() || '';

    if (bddHolo.startsWith('multiFoils') ||
        slotHolo.startsWith('multiFoils') ||
        wishlistHolo.startsWith('multiFoils') ||
        clientHolo.startsWith('multiFoils')) {
        isMultiFoilsActive = true;
    }
    window.isMultiFoilsActive = isMultiFoilsActive;

    if (isMultiFoilsActive) {
        $('.multifoil-controls-lateral').show();
    } else {
        $('.multifoil-controls-lateral').hide();
        $('#multifoil-palette-dropdown').hide();
    }

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
                        </div>
                    </div>

                    <div class="multifoil-controls-lateral">
                        <button id="btn-multifoil-active-color" class="btn-multifoil-trigger" title="Color Foil" style="background: linear-gradient(135deg, #ff00ff, #00ffff);"></button>
                        <div id="multifoil-palette-dropdown" class="multifoil-palette-dropdown"></div>
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

