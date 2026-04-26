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
window.applyFoilToElement = function($el, holo, mask) {
    if (!holo) return;

    const POKEMON_FOILS = {
        'pk-rare-holo': 'rare holo', 'pk-rare-holo-cosmos': 'rare holo cosmos', 'pk-rare-holo-v': 'rare holo v',
        'pk-rare-holo-vmax': 'rare holo vmax', 'pk-rare-holo-vstar': 'rare holo vstar', 'pk-rare-rainbow': 'rare rainbow',
        'pk-rare-rainbow-alt': 'rare rainbow alt', 'pk-rare-secret': 'rare secret', 'pk-rare-shiny': 'rare shiny',
        'pk-rare-shiny-v': 'rare shiny v', 'pk-rare-shiny-vmax': 'rare shiny vmax', 'pk-amazing-rare': 'amazing rare',
        'pk-radiant-rare': 'radiant rare', 'pk-rare-ultra': 'rare ultra pokemon', 'pk-trainer-gallery': 'trainer gallery rare holo',
        'pk-trainer-gallery-secret-rare': 'trainer gallery rare secret', 'pk-trainer-gallery-v-max': 'trainer gallery rare holo vmax',
        'pk-trainer-gallery-v-regular': 'trainer gallery rare holo v', 'pk-trainer-full-art': 'rare ultra supporter',
        'pk-rare-holo-v-full-art': 'rare holo v full art', 'pk-reverse-holo': 'reverse holo'
    };

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

$(document).ready(function() {
    window.initMaskEditor();

    // Isolated navigation for public.html if it's there
    if (window.location.pathname.includes('public.html')) {
         // handle deep links etc if needed
    }

    $(document).on('click', '#btn-nav-home', function() {
        window.location.href = 'index.html';
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
