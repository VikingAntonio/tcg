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

                /* Chat Professional UI */
                #michatbot-chat-container {
                    display: none;
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 380px;
                    height: 600px;
                    max-height: 85vh;
                    background: rgba(10, 10, 10, 0.95);
                    backdrop-filter: blur(25px);
                    border-radius: 24px;
                    box-shadow: 0 25px 80px rgba(0,0,0,0.8);
                    z-index: 2000000000;
                    border: 1px solid rgba(255,255,255,0.15);
                    flex-direction: column;
                    overflow: hidden;
                    font-family: 'Montserrat', sans-serif;
                    transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
                }
                @media (max-width: 640px) {
                    #michatbot-chat-container {
                        bottom: 0;
                        right: 0;
                        width: 100vw;
                        height: 100vh;
                        max-height: 100vh;
                        border-radius: 0;
                        z-index: 2147483647;
                    }
                }

                .chat-header {
                    padding: 20px 25px;
                    background: rgba(255,255,255,0.03);
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .chat-header h3 {
                    margin: 0;
                    font-size: 0.85rem;
                    letter-spacing: 3px;
                    font-weight: 500;
                    color: #fff;
                    text-transform: uppercase;
                }
                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                    scrollbar-width: none;
                }
                .chat-messages::-webkit-scrollbar { display: none; }

                .msg-bot, .msg-user {
                    max-width: 85%;
                    padding: 12px 18px;
                    border-radius: 18px;
                    font-size: 0.85rem;
                    line-height: 1.5;
                    font-weight: 300;
                }
                .msg-bot {
                    align-self: flex-start;
                    background: rgba(255,255,255,0.08);
                    color: #eee;
                    border-bottom-left-radius: 4px;
                }
                .msg-user {
                    align-self: flex-end;
                    background: #fff;
                    color: #000;
                    border-bottom-right-radius: 4px;
                }

                .chat-footer {
                    padding: 20px;
                    background: rgba(0,0,0,0.3);
                    border-top: 1px solid rgba(255,255,255,0.1);
                }
                .chat-input-wrapper {
                    display: flex;
                    background: rgba(255,255,255,0.05);
                    border-radius: 50px;
                    padding: 5px 5px 5px 20px;
                    border: 1px solid rgba(255,255,255,0.1);
                    align-items: center;
                }
                .chat-input-wrapper input {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: #fff;
                    font-size: 0.85rem;
                    font-family: 'Montserrat', sans-serif;
                    outline: none;
                }
                .chat-send-btn {
                    width: 35px;
                    height: 35px;
                    border-radius: 50%;
                    background: #fff;
                    color: #000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .chat-send-btn:hover { transform: scale(1.1); }

                .chat-faq-quick {
                    display: flex;
                    gap: 10px;
                    overflow-x: auto;
                    padding: 10px 0;
                    scrollbar-width: none;
                }
                .chat-faq-quick::-webkit-scrollbar { display: none; }
                .chat-faq-pill {
                    white-space: nowrap;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: #aaa;
                    padding: 6px 15px;
                    border-radius: 50px;
                    font-size: 0.7rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .chat-faq-pill:hover {
                    background: rgba(255,255,255,0.15);
                    color: #fff;
                    border-color: #fff;
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

    // Chat y Detail Containers
    if (!$('#michatbot-chat-container').length) {
        $('body').append(`
            <div id="michatbot-chat-container">
                <div class="chat-header">
                    <h3>VIKINGDEV</h3>
                    <span id="close-michatbot-chat" style="cursor: pointer; font-size: 1.5rem; color: #555; transition: color 0.2s;">&times;</span>
                </div>
                <div class="chat-messages" id="michatbot-chat-messages">
                    <!-- Messages will be added here -->
                </div>
                <div class="chat-footer">
                    <div class="chat-faq-quick" id="michatbot-faq-quick">
                        <!-- FAQ pills will be added here -->
                    </div>
                    <div class="chat-input-wrapper">
                        <input type="text" id="michatbot-chat-input" placeholder="Escribe un mensaje...">
                        <div class="chat-send-btn" id="michatbot-chat-send">
                            <i class="fas fa-paper-plane"></i>
                        </div>
                    </div>
                </div>
            </div>
        `);
        $('#close-michatbot-chat').hover(function() { $(this).css('color', '#fff'); }, function() { $(this).css('color', '#555'); });
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
                // Detectar usuario de sesión (LocalStorage como fallback si la variable global no existe)
                let sessionUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : null;
                if (!sessionUser) {
                    const stored = localStorage.getItem('tcg_session');
                    if (stored) sessionUser = JSON.parse(stored);
                }

                // Prioridad 1: sessionUser (Panel Admin)
                if (sessionUser) {
                    const { data: userRow } = await _supabase.from('usuarios').select('selected_spirit_id').eq('id', sessionUser.id).maybeSingle();
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
                disable-zoom
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
        $('#michatbot-chat-container').css('display', 'flex').hide().fadeIn(300);
        $('#michatbot-menu').fadeOut(250);

        // Mensaje inicial si está vacío
        if ($('#michatbot-chat-messages').is(':empty')) {
            addBotMessage(`¡Hola! Soy ${window.currentSpirit.name}, tu asistente de Vikingdev. ¿En qué puedo ayudarte hoy?`);
            renderContextFAQs();
        }
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

    $(document).off('click', '.chat-faq-pill').on('click', '.chat-faq-pill', function(e) {
        e.stopPropagation();
        const question = $(this).text();
        const answer = $(this).data('ans');

        addUserMessage(question);
        setTimeout(() => {
            addBotMessage(answer);
        }, 600);
    });

    $('#michatbot-chat-send').off('click').on('click', function() {
        const text = $('#michatbot-chat-input').val().trim();
        if (!text) return;

        addUserMessage(text);
        $('#michatbot-chat-input').val('');

        setTimeout(() => {
            addBotMessage("Por ahora solo puedo responder a las preguntas frecuentes, pero pronto seré más inteligente. ¡Prueba con los botones de arriba!");
        }, 800);
    });

    $('#michatbot-chat-input').off('keypress').on('keypress', function(e) {
        if (e.which === 13) $('#michatbot-chat-send').click();
    });

    $('#close-michatbot-chat').off('click').on('click', function(e) {
        e.stopPropagation();
        $('#michatbot-chat-container').fadeOut(250);
    });

    $('#close-michatbot-detail').off('click').on('click', function(e) {
        e.stopPropagation();
        $('#michatbot-detail-overlay').fadeOut(400);
    });

    // 8. Integración con Base de Datos y Realtime
    initMichatbotIntegration();

    // 9. Comprobar estado de subastas al cargar (si aplica)
    setTimeout(() => {
        checkAuctionStatusOnLoad();
    }, 3000);

    // Initial greeting
    setTimeout(() => {
        // window.botInstance.say(`¡Hola, soy ${window.currentSpirit.name}!`); // Desactivado por solicitud
    }, 2000);
}

function addUserMessage(text) {
    const $container = $('#michatbot-chat-messages');
    $container.append(`<div class="msg-user">${text}</div>`);
    $container.scrollTop($container[0].scrollHeight);
}

function addBotMessage(text) {
    const $container = $('#michatbot-chat-messages');
    $container.append(`<div class="msg-bot">${text}</div>`);
    $container.scrollTop($container[0].scrollHeight);
}

function renderContextFAQs() {
    const isAdmin = window.location.pathname.includes('admin') || window.location.pathname.includes('perfil') || window.location.pathname.includes('scanner') || window.location.pathname.includes('binders');
    const $faqContainer = $('#michatbot-faq-quick');
    $faqContainer.empty();

    let faqs = [];
    if (isAdmin) {
        faqs = [
            { q: "¿Cómo uso el scanner?", a: "Puedes usar el scanner en la sección de Scanner del menú principal para identificar tus cartas rápidamente." },
            { q: "¿Dónde veo mis decks?", a: "Tus decks están en la sección 'Mis Decks'. Puedes editarlos, ponerles precio y compartirlos." },
            { q: "¿Cómo añado cartas?", a: "En tus álbumes, haz clic en cualquier espacio vacío para abrir el buscador y añadir la carta que desees." },
            { q: "¿Inversiones?", a: "En Inversiones puedes ver el valor de mercado de tus cartas y cómo evoluciona tu colección." }
        ];
    } else {
        faqs = [
            { q: "¿Cómo comprar?", a: "Añade las cartas que te gusten al carrito y luego contacta con la tienda por WhatsApp para finalizar." },
            { q: "¿Hacen envíos?", a: "Depende de la tienda. Puedes consultar su horario y ubicación en los mensajes que voy mostrando." },
            { q: "¿Tienen tienda física?", a: "Revisa la sección de información de la tienda para ver su ubicación y horario de atención." }
        ];
    }

    faqs.forEach(faq => {
        $faqContainer.append(`<div class="chat-faq-pill" data-ans="${faq.a}">${faq.q}</div>`);
    });
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

async function checkAuctionStatusOnLoad() {
    if (typeof _supabase === 'undefined') return;
    const isAuctionView = window.location.pathname.includes('subastas') || (window.location.pathname.includes('public') && $('#auctions-view').hasClass('active'));
    if (!isAuctionView) return;

    const currentUserId = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : (localStorage.getItem('tcg_session') ? JSON.parse(localStorage.getItem('tcg_session')).id : null);
    if (!currentUserId) return;

    try {
        const ownerId = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : window.currentStoreId;
        const { data: activeAuctions } = await _supabase.from('subastas').select('id, nombre').eq('user_id', ownerId).eq('status', 'active');
        if (!activeAuctions || activeAuctions.length === 0) return;

        const auctionIds = activeAuctions.map(a => a.id);
        const { data: myBids } = await _supabase.from('subastas_pujas').select('*').in('subasta_id', auctionIds).eq('bidder_id', currentUserId);

        if (myBids && myBids.length > 0) {
            // Agrupar por subasta para ver si es la más alta
            const bidGroups = {};
            myBids.forEach(b => {
                if (!bidGroups[b.subasta_id] || b.amount > bidGroups[b.subasta_id].amount) bidGroups[b.subasta_id] = b;
            });

            let winningCount = 0;
            let losingCount = 0;

            for (const auctionId of Object.keys(bidGroups)) {
                const { data: topBid } = await _supabase.from('subastas_pujas').select('amount').eq('subasta_id', auctionId).order('amount', { ascending: false }).limit(1).maybeSingle();
                if (topBid && topBid.amount === bidGroups[auctionId].amount) {
                    winningCount++;
                } else {
                    losingCount++;
                }
            }

            if (winningCount > 0 && losingCount === 0) {
                window.botInstance.say(`¡Vas ganando en ${winningCount} subasta(s)! Sigue así.`);
            } else if (losingCount > 0) {
                window.botInstance.say(`¡Atención! Te han superado en ${losingCount} subasta(s). ¡Puja de nuevo para ganar!`);
            }
        }
    } catch (e) { console.warn("Michatbot: Error comprobando estado subastas", e); }
}

async function initMichatbotIntegration() {
    if (typeof _supabase === 'undefined') return;

    let ownerId = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : window.currentStoreId;
    if (!ownerId) {
        const stored = localStorage.getItem('tcg_session');
        if (stored) ownerId = JSON.parse(stored).id;
    }
    if (!ownerId) return;

    // Detectar Contexto
    const isAdmin = window.location.pathname.includes('admin') || window.location.pathname.includes('perfil') || window.location.pathname.includes('scanner') || window.location.pathname.includes('binders') || window.location.pathname.includes('inversiones');

    // A. Mensajes Dinámicos
    let contextTips = [];
    if (isAdmin) {
        contextTips = [
            "¡Mira cómo va el mercado de tus productos en Inversiones!",
            "Puedes crear carpetas digitales para organizar tu colección fácilmente.",
            "¡Armar tu deck desde PC es mucho más cómodo y rápido!",
            "¿Sabías que puedes compartir tus álbumes con un solo link?",
            "Usa el scanner para subir tus cartas sin escribir ni un solo nombre."
        ];
    } else {
        // En el link público, buscamos info de la tienda
        try {
            const { data: storeInfo } = await _supabase.from('usuarios').select('horario, ubicacion, store_name').eq('id', ownerId).maybeSingle();
            if (storeInfo) {
                if (storeInfo.horario) contextTips.push(`Nuestro horario es: ${storeInfo.horario}`);
                if (storeInfo.ubicacion) contextTips.push(`Nos encuentras en: ${storeInfo.ubicacion}`);
                contextTips.push(`¡Bienvenido a ${storeInfo.store_name || 'nuestra tienda'}!`);
            }
        } catch (e) { console.warn("Michatbot: Error buscando info tienda", e); }

        contextTips.push("Si tienes dudas sobre una carta, puedes ver el detalle en 3D.");
        contextTips.push("¡No olvides revisar nuestras subastas activas!");
    }

    // Intervalo de mensajes (Tips de Contexto + Mensajes de usuario de la DB)
    if (window.botMessageInterval) clearInterval(window.botMessageInterval);
    window.botMessageInterval = setInterval(async () => {
        // 50% de probabilidad de mostrar un tip de contexto o un mensaje de la DB
        if (Math.random() > 0.5 || contextTips.length === 0) {
            try {
                const { data: messages } = await _supabase
                    .from('bot_messages')
                    .select('*')
                    .eq('user_id', ownerId)
                    .eq('is_active', true);

                if (messages && messages.length > 0) {
                    const randomMsg = messages[Math.floor(Math.random() * messages.length)];
                    window.botInstance.say(randomMsg.content, (randomMsg.duration || 5) * 1000);
                } else if (contextTips.length > 0) {
                    const randomTip = contextTips[Math.floor(Math.random() * contextTips.length)];
                    window.botInstance.say(randomTip, 5000);
                }
            } catch (e) { console.error("Michatbot: Error cargando mensajes", e); }
        } else {
            const randomTip = contextTips[Math.floor(Math.random() * contextTips.length)];
            window.botInstance.say(randomTip, 5000);
        }
    }, 45000);

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
                    // Si el usuario es el que pujó
                    const currentUserId = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : null;
                    if (currentUserId && String(bid.bidder_id) === String(currentUserId)) {
                        window.botInstance.say(`¡Genial! Tu puja de $${bid.amount} ha sido registrada. ¡Vas ganando!`);
                    } else {
                        window.botInstance.say(`¡Nueva puja detectada! Alguien ofreció $${bid.amount}. ¡No te quedes atrás!`);
                    }
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
