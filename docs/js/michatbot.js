/**
 * michatbot.js - Nuevo Chatbot GLTF Vikingdev
 * Centralizado para admin y público.
 * V3.1 - Estética refinada, fuente elegante y fijación de interacciones.
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
            const size = 180 * scale; // Aumentado base de 150 a 180
            $wrapper.css({
                width: size + 'px',
                height: size + 'px'
            });
        }
    }
};

async function initMichatbot(forceRefresh = false) {
    console.log("Iniciando Michatbot V3.1...");

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
                @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@200;300;400&display=swap');

                #companion-wrapper {
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    z-index: 999999999;
                    width: 180px; /* Aumentado de 150 a 180 */
                    height: 180px;
                    touch-action: none;
                    transition: width 0.2s, height 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                /* Prevención de selección de texto al arrastrar */
                .michatbot-dragging-active {
                    user-select: none !important;
                    -webkit-user-select: none !important;
                }

                #michatbot-drag-handle {
                    position: absolute;
                    top: 15%; /* Porcentaje para que se mueva con el tamaño */
                    left: 0%;
                    background: #000;
                    color: #fff;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: grab;
                    z-index: 20;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.6);
                    opacity: 0.7;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    border: 1px solid rgba(255,255,255,0.3);
                }
                #michatbot-drag-handle:hover { opacity: 1; transform: scale(1.1) rotate(90deg); }

                #michatbot-bubble {
                    position: absolute;
                    bottom: 85%;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #000;
                    color: #fff;
                    padding: 8px 25px; /* Menos alto, más ancho */
                    border-radius: 50px; /* Estilo píldora más elegante */
                    font-family: 'Montserrat', sans-serif;
                    font-size: 0.85rem;
                    font-weight: 300; /* Más elegante */
                    min-width: 200px;
                    max-width: 350px;
                    text-align: center;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.7);
                    display: none;
                    pointer-events: none;
                    z-index: 15;
                    border: 1px solid rgba(255,255,255,0.2);
                    line-height: 1.4;
                    letter-spacing: 0.5px;
                }
                #michatbot-bubble::after {
                    content: '';
                    position: absolute;
                    top: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    border-width: 6px;
                    border-style: solid;
                    border-color: #000 transparent transparent transparent;
                }

                #michatbot-menu {
                    display: none;
                    position: absolute;
                    bottom: 100%;
                    left: 0;
                    background: #000;
                    border-radius: 15px;
                    padding: 6px; /* Menos alto */
                    min-width: 200px;
                    border: 1px solid rgba(255,255,255,0.25);
                    margin-bottom: 20px;
                    box-shadow: 0 15px 40px rgba(0,0,0,0.9);
                    z-index: 10;
                }
                .michatbot-menu-item {
                    color: #fff;
                    padding: 8px 18px; /* Reducido verticalmente */
                    cursor: pointer;
                    border-bottom: 1px solid rgba(255,255,255,0.08);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-family: 'Montserrat', sans-serif;
                    font-size: 0.8rem;
                    transition: all 0.2s ease;
                    font-weight: 300;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                }
                .michatbot-menu-item:hover {
                    background: rgba(255,255,255,0.1);
                    padding-left: 22px;
                }
                .michatbot-menu-item:last-of-type { border-bottom: none; }

                #michatbot-resize-control {
                    padding: 10px 18px;
                    border-top: 1px solid rgba(255,255,255,0.1);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                #michatbot-resize-control input {
                    flex: 1;
                    accent-color: #fff;
                    cursor: pointer;
                    height: 2px;
                    background: rgba(255,255,255,0.2);
                }

                .michatbot-faq-btn {
                    background: transparent;
                    border: 1px solid rgba(255,255,255,0.15);
                    color: #fff;
                    padding: 12px 15px;
                    text-align: left;
                    border-radius: 10px;
                    cursor: pointer;
                    font-family: 'Montserrat', sans-serif;
                    font-size: 0.8rem;
                    transition: all 0.3s ease;
                    font-weight: 300;
                }
                .michatbot-faq-btn:hover {
                    background: rgba(255,255,255,0.08);
                    border-color: rgba(255,255,255,0.4);
                    transform: translateX(5px);
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
                        <i class="fas fa-compress-alt" style="color: #555; font-size: 0.8rem;"></i>
                        <input type="range" id="michatbot-scale-slider" min="0.5" max="2.5" step="0.1" value="1.0">
                        <i class="fas fa-expand-alt" style="color: #555; font-size: 0.8rem;"></i>
                    </div>
                </div>
            </div>
        `);
    }

    // FAQ y Detail Containers
    if (!$('#michatbot-faq-container').length) {
        $('body').append(`
            <div id="michatbot-faq-container" style="display: none; position: fixed; bottom: 180px; left: 20px; z-index: 999999999; background: #000; border-radius: 20px; width: 340px; box-shadow: 0 20px 60px rgba(0,0,0,0.9); padding: 30px; color: white; border: 1px solid rgba(255,255,255,0.2); font-family: 'Montserrat', sans-serif;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px; margin-bottom: 25px;">
                    <h3 style="margin: 0; font-size: 0.9rem; letter-spacing: 2px; font-weight: 400; text-transform: uppercase;">ASSISTANT</h3>
                    <span id="close-michatbot-faq" style="cursor: pointer; font-size: 1.5rem; color: #555; transition: color 0.2s;">&times;</span>
                </div>
                <div id="michatbot-faq-list" style="display: flex; flex-direction: column; gap: 12px;">
                    <button class="michatbot-faq-btn" data-ans="Puedes usar el scanner en la sección de Scanner del menú principal para identificar tus cartas rápidamente.">¿Cómo uso el scanner?</button>
                    <button class="michatbot-faq-btn" data-ans="Tus decks están en la sección 'Mis Decks'. Puedes editarlos, ponerles precio y compartirlos.">¿Dónde veo mis decks?</button>
                    <button class="michatbot-faq-btn" data-ans="En tus álbumes, haz clic en cualquier espacio vacío para abrir el buscador y añadir la carta que desees.">¿Cómo añado cartas?</button>
                </div>
                <div id="michatbot-faq-answer" style="margin-top: 30px; font-size: 0.85rem; color: #bbb; line-height: 1.8; background: rgba(255,255,255,0.03); padding: 20px; border-radius: 12px; border-left: 1px solid rgba(255,255,255,0.5); display: none; font-weight: 200; letter-spacing: 0.5px;"></div>
            </div>
        `);
        $('#close-michatbot-faq').hover(function() { $(this).css('color', '#fff'); }, function() { $(this).css('color', '#555'); });
    }

    if (!$('#michatbot-detail-overlay').length) {
        $('body').append(`
            <div id="michatbot-detail-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.98); z-index: 1000000000; align-items: center; justify-content: center; flex-direction: column; font-family: 'Montserrat', sans-serif;">
                <span id="close-michatbot-detail" style="position: absolute; top: 20px; right: 30px; font-size: 3rem; color: white; cursor: pointer; font-weight: 100;">&times;</span>
                <div id="michatbot-detail-viewer-container" style="width: 85%; height: 75%; max-width: 900px;"></div>
                <h2 id="michatbot-detail-name" style="color: white; margin-top: 30px; font-size: 2.2rem; font-weight: 200; letter-spacing: 5px; text-transform: uppercase;">Nombre del Compañero</h2>
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
                camera-orbit="auto 75deg auto"
                field-of-view="auto"
                min-field-of-view="5deg"
                max-field-of-view="45deg"
                interpolation-decay="200"
                bounds="tight"
                auto-rotate-delay="0"
                rotation-speed="0.5"
                style="width: 120%; height: 120%; background-color: transparent; margin-left: -10%; margin-top: -10%;"
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
    const viewer = document.getElementById('michatbot-viewer');
    let touchStartTime = 0;
    let startX_click, startY_click;
    let isInteractingWithModel = false;

    if (viewer) {
        viewer.addEventListener('pointerdown', (e) => {
            touchStartTime = Date.now();
            startX_click = e.clientX;
            startY_click = e.clientY;
            isInteractingWithModel = false;
        });

        viewer.addEventListener('pointermove', (e) => {
            if (startX_click === undefined) return;
            const dist = Math.sqrt(Math.pow(e.clientX - startX_click, 2) + Math.pow(e.clientY - startY_click, 2));
            if (dist > 10) {
                isInteractingWithModel = true;
            }
        });

        viewer.addEventListener('click', (e) => {
            const touchDuration = Date.now() - touchStartTime;
            // Solo abrir menú si fue un click rápido (no drag para girar) y no hubo movimiento significativo
            if (touchDuration < 300 && !isInteractingWithModel) {
                e.stopPropagation();
                $('#michatbot-menu').fadeToggle(250);
            }
            startX_click = undefined;
            startY_click = undefined;
        });
    }

    $(document).off('click.michatbot').on('click.michatbot', function(e) {
        if (!$(e.target).closest('#companion-wrapper').length && !$(e.target).closest('#michatbot-faq-container').length) {
            $('#michatbot-menu').fadeOut(250);
        }
    });

    $('#michatbot-opt-chat').off('click').on('click', function(e) {
        e.stopPropagation();
        $('#michatbot-faq-container').fadeToggle(300);
        $('#michatbot-menu').fadeOut(250);
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
        $('#michatbot-detail-overlay').css('display', 'flex').hide().fadeIn(400);
        $('#michatbot-menu').fadeOut(250);
    });

    $('#michatbot-scale-slider').off('input').on('input', function() {
        const val = $(this).val();
        window.botInstance.setScale(val);
    });

    $('.michatbot-faq-btn').off('click').on('click', function(e) {
        e.stopPropagation();
        const ans = $(this).data('ans');
        $('#michatbot-faq-answer').text(ans).fadeIn(400);
    });

    $('#close-michatbot-faq').off('click').on('click', function(e) {
        e.stopPropagation();
        $('#michatbot-faq-container').fadeOut(250);
    });

    $('#close-michatbot-detail').off('click').on('click', function(e) {
        e.stopPropagation();
        $('#michatbot-detail-overlay').fadeOut(400);
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

        // Evitar selección de texto
        $('body').addClass('michatbot-dragging-active');
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
        $('body').removeClass('michatbot-dragging-active');
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
