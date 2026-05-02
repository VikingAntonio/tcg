// --- TCGAPI.dev CONFIGURATION ---
window.TCG_API_KEY = 'tcg_live_830032ddb812433fc16a783454caaa5353708266';
window.TCG_API_BASE = 'https://api.tcgapi.dev/v1';

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

    let baseHolo = holo;
    let isCustomFoil = false;
    if (holo.startsWith('custom-foil|')) {
        isCustomFoil = true;
        baseHolo = holo.split('|')[1] || 'foil';
    }

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

    $el.css({
        '--angle': '135deg',
        '--card-opacity': 1
    });

    if ($el.find('.holo-layer').length === 0) $el.append('<div class="holo-layer"></div>');
    $el.addClass('active foil-loop');
};

// --- Global Navigation ---
// --- Mask Editor Logic ---
window.maskCanvas = null;
window.maskCtx = null;
window.isPainting = false;
window.currentBrushSize = 10;
window.currentTool = 'brush'; // 'brush' or 'eraser'
window.maskHistory = [];
const MAX_MASK_HISTORY = 20;

window.initMaskEditor = function() {
    window.maskCanvas = document.getElementById('mask-canvas');
    if (!window.maskCanvas) return;
    window.maskCtx = window.maskCanvas.getContext('2d');

    $(window.maskCanvas).off('mousedown touchstart').on('mousedown touchstart', function(e) {
        window.isPainting = true;
        window.saveMaskHistory();
        window.drawMask(e);
    });

    $(window).off('mousemove touchmove').on('mousemove touchmove', function(e) {
        if (window.isPainting) window.drawMask(e);
    });

    $(window).off('mouseup touchend').on('mouseup touchend', function() {
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
        $(this).addClass('active');
    });

    $('#tool-eraser').off('click').on('click', function() {
        window.currentTool = 'eraser';
        $('.editor-controls .btn-secondary').removeClass('active');
        $(this).addClass('active');
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
};

window.initMaskCanvas = function() {
    // Supports all integrated form input IDs
    const currentMask = $('#slot-custom-mask, #modal-custom-mask, #owner-card-mask').val();

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
    window.maskCtx.strokeStyle = window.currentTool === 'brush' ? 'white' : 'black';

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

window.searchExternalCard = async function(inputSelector, resultsSelector, onSelectCallback) {
    const query = $(inputSelector).val().trim();

    if (query.length < 3) {
        Swal.fire('Atención', 'Por favor, escribe al menos 3 caracteres para buscar.', 'info');
        return;
    }

    $(resultsSelector).html('<div style="grid-column: 1/-1; text-align: center; padding: 10px; color: #666;">Buscando...</div>');

    try {
        // Special YGO search logic for passcodes and set codes
        const ygoSpecialSearch = async () => {
            const q = query.toUpperCase();
            // Passcode (Numeric 5-10 digits)
            if (/^\d{5,10}$/.test(q)) {
                const r = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${q}`).then(res => res.json()).catch(() => ({data:[]}));
                return r.data || [];
            }
            // Set Code (Format XXX-123 or XXX-EN123)
            const setMatch = q.match(/^([A-Z0-9]{3,6})-([A-Z0-9]{3,8})$/);
            if (setMatch) {
                const prefix = setMatch[1];
                const sets = await window.getYgoSets();
                const setObj = sets.find(s => s.set_code.toUpperCase() === prefix);
                if (setObj) {
                    const r = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(setObj.set_name)}`).then(res => res.json()).catch(() => ({data:[]}));
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
            if (!window.TCG_API_KEY) return [];
            try {
                const response = await fetch(`${window.TCG_API_BASE}/search?q=${encodeURIComponent(q)}&game=${game}`, {
                    headers: { 'X-API-Key': window.TCG_API_KEY }
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
            // Yu-Gi-Oh! Name Search
            fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : {data:[]}).catch(() => ({data:[]})),
            // Yu-Gi-Oh! Code/Set Search
            fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : {data:[]}).catch(() => ({data:[]})),
            // Special YGO Search
            ygoSpecialSearch(),
            // Pokémon TCGdex - English
            fetch(`https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : []).catch(() => []),
            // Pokémon TCGdex - Spanish
            fetch(`https://api.tcgdex.net/v2/es/cards?name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : []).catch(() => []),
            // Pokémon TCGdex - Japanese
            fetch(`https://api.tcgdex.net/v2/ja/cards?name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : []).catch(() => []),
            // Lorcana Search
            fetch(`https://api.lorcana-api.com/cards/fetch?search=name~${encodeURIComponent(query)}&displayonly=name;image;cost;set_num`).then(r => r.ok ? r.json() : []).catch(() => []),
            // Viking Search
            (typeof VikingData !== 'undefined' ? VikingData.search(query) : Promise.resolve([])),
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
            window.displayExternalResults(uniqueResults.slice(0, 50), resultsSelector, onSelectCallback);
        }

    } catch (err) {
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

                <div id="mask-canvas-wrapper" style="position: relative; margin-bottom: 20px; border: 2px solid #333; border-radius: 12px; overflow: hidden; width: 168px; height: 244px;">
                    <canvas id="mask-canvas" width="168" height="244" style="cursor: crosshair; display: block;"></canvas>
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
