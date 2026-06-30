/**
 * michatbot.js - Nuevo Chatbot GLTF Vikingdev
 * Centralizado para admin y público.
 */

async function initMichatbot(forceRefresh = false) {
    console.log("Iniciando Michatbot...");

    // 1. Limpiar elementos antiguos si existen para evitar conflictos
    if ($('#companion-wrapper').length && !$('#michatbot-model-container').length) {
        $('#companion-wrapper').remove();
    }
    if ($('#chatbot-container').length) {
        $('#chatbot-container').remove();
    }

    // 2. Inyectar HTML si no existe
    if (!$('#companion-wrapper').length) {
        $('body').append(`
            <div id="companion-wrapper" style="position: fixed; bottom: 20px; left: 20px; z-index: 999999999; width: 150px; height: 150px; cursor: grab; user-select: none; touch-action: none;">
                <div id="michatbot-model-container" style="width: 100%; height: 100%;"></div>
                <div id="michatbot-menu" style="display: none; position: absolute; bottom: 100%; left: 0; background: rgba(0,0,0,0.9); border-radius: 12px; padding: 10px; min-width: 150px; border: 1px solid #00d2ff; margin-bottom: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.5);">
                    <div class="michatbot-menu-item" id="michatbot-opt-chat" style="color: white; padding: 8px; cursor: pointer; border-bottom: 1px solid #333; display: flex; align-items: center; gap: 10px; font-family: sans-serif;"><i class="fas fa-comment-dots"></i> Chatear</div>
                    <div class="michatbot-menu-item" id="michatbot-opt-play" style="color: white; padding: 8px; cursor: pointer; border-bottom: 1px solid #333; display: flex; align-items: center; gap: 10px; font-family: sans-serif;"><i class="fas fa-gamepad"></i> Jugar</div>
                    <div class="michatbot-menu-item" id="michatbot-opt-detail" style="color: white; padding: 8px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-family: sans-serif;"><i class="fas fa-search-plus"></i> Ver Detalle</div>
                </div>
            </div>
        `);
    }

    if (!$('#michatbot-faq-container').length) {
        $('body').append(`
            <div id="michatbot-faq-container" style="display: none; position: fixed; bottom: 180px; left: 20px; z-index: 999999999; background: #1a1a1a; border-radius: 15px; width: 300px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); padding: 20px; color: white; border: 1px solid #333; font-family: sans-serif;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 15px;">
                    <h3 style="margin: 0; font-size: 1.1rem; color: #00d2ff;">Asistente Vikingo</h3>
                    <span id="close-michatbot-faq" style="cursor: pointer; font-size: 1.5rem; color: #888;">&times;</span>
                </div>
                <div id="michatbot-faq-list" style="display: flex; flex-direction: column; gap: 10px;">
                    <button class="michatbot-faq-btn" data-ans="Puedes usar el scanner en la sección de Scanner del menú principal para identificar tus cartas rápidamente." style="background: #333; border: none; color: white; padding: 10px; border-radius: 8px; text-align: left; cursor: pointer; font-size: 0.9rem;">¿Cómo uso el scanner?</button>
                    <button class="michatbot-faq-btn" data-ans="Tus decks están en la sección 'Mis Decks'. Puedes editarlos, ponerles precio y compartirlos." style="background: #333; border: none; color: white; padding: 10px; border-radius: 8px; text-align: left; cursor: pointer; font-size: 0.9rem;">¿Dónde veo mis decks?</button>
                    <button class="michatbot-faq-btn" data-ans="En tus álbumes, haz clic en cualquier espacio vacío para abrir el buscador y añadir la carta que desees." style="background: #333; border: none; color: white; padding: 10px; border-radius: 8px; text-align: left; cursor: pointer; font-size: 0.9rem;">¿Cómo añado cartas?</button>
                </div>
                <div id="michatbot-faq-answer" style="margin-top: 20px; font-size: 0.95rem; color: #ccc; line-height: 1.4; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 10px; border-left: 3px solid #00d2ff; display: none;"></div>
            </div>
        `);
    }

    if (!$('#michatbot-detail-overlay').length) {
        $('body').append(`
            <div id="michatbot-detail-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 1000000000; align-items: center; justify-content: center; flex-direction: column; font-family: sans-serif;">
                <span id="close-michatbot-detail" style="position: absolute; top: 20px; right: 30px; font-size: 3rem; color: white; cursor: pointer;">&times;</span>
                <div id="michatbot-detail-viewer-container" style="width: 80%; height: 70%; max-width: 800px;"></div>
                <h2 id="michatbot-detail-name" style="color: white; margin-top: 20px; font-size: 2rem; font-family: 'Montserrat', sans-serif;">Nombre del Compañero</h2>
            </div>
        `);
    }

    // 3. Esperar por window.currentSpirit o currentUser para buscar el espíritu actual
    if (forceRefresh || !window.currentSpirit) {
        if (typeof _supabase !== 'undefined') {
            try {
                // Si hay usuario, buscar el espíritu que tiene activo en la tabla 'usuarios'
                if (typeof currentUser !== 'undefined' && currentUser) {
                    const { data: userRow } = await _supabase.from('usuarios').select('selected_spirit_id').eq('id', currentUser.id).maybeSingle();
                    if (userRow && userRow.selected_spirit_id) {
                        const { data: spirit } = await _supabase.from('spirits').select('*').eq('id', userRow.selected_spirit_id).maybeSingle();
                        if (spirit) window.currentSpirit = spirit;
                    }
                }

                // Fallback a público si no hay seleccionado
                if (!window.currentSpirit) {
                    const { data } = await _supabase.from('spirits').select('*').eq('is_public', true).limit(1).maybeSingle();
                    if (data) window.currentSpirit = data;
                }
            } catch (e) { console.warn("Michatbot: Error buscando spirit", e); }
        }

        if (!window.currentSpirit) {
            console.log("Michatbot: Esperando datos de espíritu...");
            setTimeout(() => initMichatbot(), 2000);
            return;
        }
    }

    // 4. Renderizar Model Viewer (Solo si cambió el src o si forzamos)
    const gltfUrl = window.currentSpirit.gltf_url;
    const $viewer = $('#michatbot-viewer');

    if (forceRefresh || !$viewer.length || $viewer.attr('src') !== gltfUrl) {
        $('#michatbot-model-container').html(`
            <model-viewer
                id="michatbot-viewer"
                src="${gltfUrl}"
                auto-rotate
                camera-controls
                shadow-intensity="1"
                environment-image="neutral"
                exposure="1"
                interaction-prompt="none"
                style="width: 100%; height: 100%;"
                oncontextmenu="return false;">
            </model-viewer>
        `);
    }

    // 5. Implementar Drag and Drop (Solo una vez)
    if (!window.michatbotDraggableInit) {
        makeMichatbotDraggable();
        window.michatbotDraggableInit = true;
    }

    // 6. Eventos (Usar .off() para evitar duplicados en re-init)
    $('#michatbot-model-container').off('click').on('click', function(e) {
        if (window.michatbotIsDragging) return;
        e.stopPropagation();
        $('#michatbot-menu').fadeToggle(200);
    });

    $(document).off('click.michatbot').on('click.michatbot', function(e) {
        if (!$(e.target).closest('#companion-wrapper').length) {
            $('#michatbot-menu').fadeOut(200);
        }
    });

    $('#michatbot-opt-chat').off('click').on('click', function(e) {
        e.stopPropagation();
        $('#michatbot-faq-container').fadeToggle(200);
        $('#michatbot-menu').fadeOut(200);
    });

    $('#michatbot-opt-play').off('click').on('click', function(e) {
        e.stopPropagation();
        window.location.href = 'play.html';
    });

    $('#michatbot-opt-detail').off('click').on('click', function(e) {
        e.stopPropagation();
        $('#michatbot-detail-viewer-container').html(`
            <model-viewer
                src="${window.currentSpirit.gltf_url}"
                camera-controls
                auto-rotate
                shadow-intensity="1"
                environment-image="neutral"
                exposure="1.2"
                style="width: 100%; height: 100%;">
            </model-viewer>
        `);
        $('#michatbot-detail-name').text(window.currentSpirit.name);
        $('#michatbot-detail-overlay').css('display', 'flex').hide().fadeIn(300);
        $('#michatbot-menu').fadeOut(200);
    });

    $('.michatbot-faq-btn').off('click').on('click', function(e) {
        e.stopPropagation();
        const ans = $(this).data('ans');
        $('#michatbot-faq-answer').text(ans).fadeIn();
    });

    $('#close-michatbot-faq').off('click').on('click', function(e) {
        e.stopPropagation();
        $('#michatbot-faq-container').fadeOut(200);
    });

    $('#close-michatbot-detail').off('click').on('click', function(e) {
        e.stopPropagation();
        $('#michatbot-detail-overlay').fadeOut(300);
    });
}

function makeMichatbotDraggable() {
    const wrapper = document.getElementById('companion-wrapper');
    if (!wrapper) return;

    let isDragging = false;
    let startX, startY, initialX, initialY;
    window.michatbotIsDragging = false;

    wrapper.addEventListener('pointerdown', (e) => {
        if ($(e.target).closest('#michatbot-menu').length) return;

        isDragging = true;
        window.michatbotIsDragging = false;
        startX = e.clientX;
        startY = e.clientY;
        const rect = wrapper.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
        wrapper.setPointerCapture(e.pointerId);
    });

    window.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            window.michatbotIsDragging = true;
        }

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
        setTimeout(() => {
            window.michatbotIsDragging = false;
        }, 100);
    });
}

// Iniciar cuando el DOM esté listo
$(document).ready(function() {
    initMichatbot();
});
