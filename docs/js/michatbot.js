/**
 * michatbot.js - Nuevo Chatbot GLTF Vikingdev
 * Centralizado para admin y público.
 */

// Global bot instance for access from other scripts
window.botInstance = {
    say: function(text, duration = 4000) {
        const $bubble = $('#michatbot-bubble');
        if (!$bubble.length) return;
        $bubble.find('.bubble-text').text(text);
        $bubble.stop(true, true).fadeIn(300);

        if (window.bubbleTimeout) clearTimeout(window.bubbleTimeout);
        window.bubbleTimeout = setTimeout(() => {
            $bubble.fadeOut(300);
        }, duration);
    },
    setScale: function(scale) {
        const $wrapper = $('#companion-wrapper');
        if ($wrapper.length) {
            $wrapper.css({
                width: (150 * scale) + 'px',
                height: (150 * scale) + 'px'
            });
        }
    }
};

async function initMichatbot(forceRefresh = false) {
    console.log("Iniciando Michatbot V2...");

    // 1. Limpiar elementos antiguos si existen para evitar conflictos
    if ($('#companion-wrapper').length && !$('#michatbot-model-container').length) {
        $('#companion-wrapper').remove();
    }
    if ($('#chatbot-container').length) {
        $('#chatbot-container').remove();
    }

    // 2. Inyectar Estilos Base
    if (!$('#michatbot-styles').length) {
        $('head').append(`
            <style id="michatbot-styles">
                #companion-wrapper {
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    z-index: 999999999;
                    width: 150px;
                    height: 150px;
                    touch-action: none;
                    transition: width 0.2s, height 0.2s;
                }
                #michatbot-drag-handle {
                    position: absolute;
                    top: -10px;
                    right: -10px;
                    background: var(--primary-color, #00d2ff);
                    color: black;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: grab;
                    z-index: 10;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                    opacity: 0.7;
                    transition: opacity 0.2s;
                }
                #companion-wrapper:hover #michatbot-drag-handle { opacity: 1; }

                #michatbot-bubble {
                    position: absolute;
                    bottom: 110%;
                    left: 50%;
                    transform: translateX(-50%);
                    background: white;
                    color: black;
                    padding: 10px 15px;
                    border-radius: 15px;
                    font-family: sans-serif;
                    font-size: 0.9rem;
                    font-weight: 600;
                    min-width: 120px;
                    text-align: center;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                    display: none;
                    pointer-events: none;
                    z-index: 11;
                }
                #michatbot-bubble::after {
                    content: '';
                    position: absolute;
                    top: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    border-width: 8px;
                    border-style: solid;
                    border-color: white transparent transparent transparent;
                }

                #michatbot-menu {
                    display: none;
                    position: absolute;
                    bottom: 100%;
                    left: 0;
                    background: rgba(0,0,0,0.9);
                    border-radius: 12px;
                    padding: 10px;
                    min-width: 160px;
                    border: 1px solid var(--primary-color, #00d2ff);
                    margin-bottom: 20px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.5);
                }
                .michatbot-menu-item {
                    color: white;
                    padding: 10px;
                    cursor: pointer;
                    border-bottom: 1px solid #333;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-family: sans-serif;
                    font-size: 0.9rem;
                    transition: background 0.2s;
                }
                .michatbot-menu-item:hover { background: rgba(255,255,255,0.1); }
                .michatbot-menu-item:last-child { border-bottom: none; }

                #michatbot-resize-control {
                    padding: 8px 10px;
                    border-top: 1px solid #333;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                #michatbot-resize-control input {
                    flex: 1;
                    accent-color: var(--primary-color, #00d2ff);
                    cursor: pointer;
                }
            </style>
        `);
    }

    // 3. Inyectar HTML si no existe
    if (!$('#companion-wrapper').length) {
        $('body').append(`
            <div id="companion-wrapper">
                <div id="michatbot-drag-handle"><i class="fas fa-arrows-alt"></i></div>
                <div id="michatbot-bubble"><span class="bubble-text">¡Hola!</span></div>
                <div id="michatbot-model-container" style="width: 100%; height: 100%;"></div>

                <div id="michatbot-menu">
                    <div class="michatbot-menu-item" id="michatbot-opt-chat"><i class="fas fa-comment-dots"></i> Chatear</div>
                    <div class="michatbot-menu-item" id="michatbot-opt-play"><i class="fas fa-bolt"></i> Hora del duelo</div>
                    <div class="michatbot-menu-item" id="michatbot-opt-detail"><i class="fas fa-search-plus"></i> Ver Detalle</div>
                    <div id="michatbot-resize-control">
                        <i class="fas fa-compress-alt" style="color: #888; font-size: 0.8rem;"></i>
                        <input type="range" id="michatbot-scale-slider" min="0.5" max="2.5" step="0.1" value="1.0">
                        <i class="fas fa-expand-alt" style="color: #888; font-size: 0.8rem;"></i>
                    </div>
                </div>
            </div>
        `);
    }

    // FAQ y Detail Containers
    if (!$('#michatbot-faq-container').length) {
        $('body').append(`
            <div id="michatbot-faq-container" style="display: none; position: fixed; bottom: 180px; left: 20px; z-index: 999999999; background: #1a1a1a; border-radius: 15px; width: 300px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); padding: 20px; color: white; border: 1px solid #333; font-family: sans-serif;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 15px;">
                    <h3 style="margin: 0; font-size: 1.1rem; color: #00d2ff;">Vikingdev Assistant</h3>
                    <span id="close-michatbot-faq" style="cursor: pointer; font-size: 1.5rem; color: #888;">&times;</span>
                </div>
                <div id="michatbot-faq-list" style="display: flex; flex-direction: column; gap: 10px;">
                    <button class="michatbot-faq-btn" data-ans="Puedes usar el scanner en la sección de Scanner del menú principal para identificar tus cartas rápidamente.">¿Cómo uso el scanner?</button>
                    <button class="michatbot-faq-btn" data-ans="Tus decks están en la sección 'Mis Decks'. Puedes editarlos, ponerles precio y compartirlos.">¿Dónde veo mis decks?</button>
                    <button class="michatbot-faq-btn" data-ans="En tus álbumes, haz clic en cualquier espacio vacío para abrir el buscador y añadir la carta que desees.">¿Cómo añado cartas?</button>
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

    // 4. Buscar espíritu actual
    if (forceRefresh || !window.currentSpirit) {
        if (typeof _supabase !== 'undefined') {
            try {
                // Prioridad 1: currentUser (Panel Admin)
                if (typeof currentUser !== 'undefined' && currentUser) {
                    const { data: userRow } = await _supabase.from('usuarios').select('selected_spirit_id').eq('id', currentUser.id).maybeSingle();
                    if (userRow && userRow.selected_spirit_id) {
                        const { data: spirit } = await _supabase.from('spirits').select('*').eq('id', userRow.selected_spirit_id).maybeSingle();
                        if (spirit) window.currentSpirit = spirit;
                    }
                }

                // Prioridad 2: window.currentStoreId (Link Público)
                if (!window.currentSpirit && window.currentStoreId) {
                    const { data: userRow } = await _supabase.from('usuarios').select('selected_spirit_id').eq('id', window.currentStoreId).maybeSingle();
                    if (userRow && userRow.selected_spirit_id) {
                        const { data: spirit } = await _supabase.from('spirits').select('*').eq('id', userRow.selected_spirit_id).maybeSingle();
                        if (spirit) window.currentSpirit = spirit;
                    }
                }

                // Fallback público
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

    // 5. Renderizar Model Viewer
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

    // 6. Implementar Drag and Drop desde el Handle
    if (!window.michatbotDraggableInit) {
        makeMichatbotDraggable();
        window.michatbotDraggableInit = true;
    }

    // 7. Eventos
    $('#michatbot-model-container').off('click').on('click', function(e) {
        e.stopPropagation();
        $('#michatbot-menu').fadeToggle(200);
    });

    $(document).off('click.michatbot').on('click.michatbot', function(e) {
        if (!$(e.target).closest('#companion-wrapper').length && !$(e.target).closest('#michatbot-faq-container').length) {
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

    $('#michatbot-scale-slider').off('input').on('input', function() {
        const val = $(this).val();
        window.botInstance.setScale(val);
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

    // 8. Integración con Base de Datos y Realtime
    initMichatbotIntegration();

    // Initial greeting
    setTimeout(() => {
        window.botInstance.say(`¡Hola, soy ${window.currentSpirit.name}!`);
    }, 2000);
}

function makeMichatbotDraggable() {
    const wrapper = document.getElementById('companion-wrapper');
    const handle = document.getElementById('michatbot-drag-handle');
    if (!wrapper || !handle) return;

    let isDragging = false;
    let startX, startY, initialX, initialY;

    handle.addEventListener('pointerdown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = wrapper.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
        wrapper.setPointerCapture(e.pointerId);
        handle.style.cursor = 'grabbing';
    });

    window.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

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
        handle.style.cursor = 'grab';
    });
}

async function initMichatbotIntegration() {
    if (typeof _supabase === 'undefined') return;

    const ownerId = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : window.currentStoreId;
    if (!ownerId) return;

    // A. Mensajes periódicos desde 'bot_messages'
    try {
        const { data: messages } = await _supabase
            .from('bot_messages')
            .select('*')
            .eq('user_id', ownerId)
            .eq('is_active', true);

        if (messages && messages.length > 0) {
            if (window.botMessageInterval) clearInterval(window.botMessageInterval);
            window.botMessageInterval = setInterval(() => {
                const randomMsg = messages[Math.floor(Math.random() * messages.length)];
                window.botInstance.say(randomMsg.content, (randomMsg.duration || 5) * 1000);
            }, 30000);
        }
    } catch (e) { console.error("Michatbot: Error cargando mensajes", e); }

    // B. Realtime Subscriptions para Subastas (Filtradas por Store)
    if (!window.botRealtimeSubscribed) {
        // Obtenemos los IDs de las subastas activas de este dueño para filtrar
        const { data: activeAuctions } = await _supabase.from('subastas').select('id').eq('user_id', ownerId).eq('status', 'active');
        const auctionIds = (activeAuctions || []).map(a => a.id);

        const channel = _supabase
            .channel('bot-pujas')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'subastas_pujas' }, payload => {
                const bid = payload.new;
                // Solo anunciar si la puja pertenece a una subasta de esta tienda
                if (auctionIds.includes(bid.subasta_id)) {
                    window.botInstance.say(`¡Nueva puja detectada! Alguien ofreció $${bid.amount}.`);
                }
            })
            .subscribe();
        window.botRealtimeSubscribed = true;
    }
}

// Iniciar cuando el DOM esté listo
$(document).ready(function() {
    initMichatbot();
});
