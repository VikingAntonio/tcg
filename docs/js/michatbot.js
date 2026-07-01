/**
 * michatbot.js - Nuevo Chatbot GLTF Vikingdev
 * Centralizado para admin y público.
 * V3.2 - Corrección de escalado (SOLO GLTF), centrado y FAQs contextuales.
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
        const $container = $('#michatbot-model-container');
        if (!$wrapper.length || !$container.length) return;
        window.michatbotCurrentScale = scale;

        // El usuario pide que SOLO crezca el GLTF y su campo, pero las demás cosas NO.
        // Cambiamos el tamaño del contenedor del modelo.
        const baseSize = 150;
        const newSize = baseSize * scale;

        $container.css({
            'width': `${newSize}px`,
            'height': `${newSize}px`
        });

        // El wrapper debe ajustarse para contener el nuevo tamaño del modelo
        $wrapper.css({
            'width': `${newSize}px`,
            'height': `${newSize}px`
        });

        // Reposicionamos los elementos UI para que sigan el borde del nuevo tamaño
        // pero mantienen su tamaño original (32px, etc.)
        $('#michatbot-drag-handle').css({
            'top': '-10px',
            'left': '-10px'
        });

        $('#michatbot-bubble').css({
            'bottom': '105%',
            'left': '50%',
            'transform': 'translateX(-50%)'
        });

        $('#michatbot-menu').css({
            'bottom': '100%',
            'left': '0',
            'transform': 'none' // Aseguramos que no tenga escala
        });
    }
};

async function initMichatbot(forceRefresh = false) {
    console.log("Iniciando Michatbot V3.2...");

    if (window.michatbotCurrentScale === undefined) window.michatbotCurrentScale = 1.0;

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
                @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Quicksand:wght@300;400;500;600&display=swap');

                #companion-wrapper {
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    z-index: 999999999;
                    width: 150px;
                    height: 150px;
                    touch-action: none;
                    pointer-events: none; /* Dejamos pasar clicks en áreas vacías */
                    display: block;
                }

                #michatbot-drag-handle,
                #michatbot-bubble,
                #michatbot-model-container,
                #michatbot-menu {
                    pointer-events: auto; /* Elementos específicos sí reciben clicks */
                }

                /* Prevención de selección de texto al arrastrar */
                .michatbot-dragging-active {
                    user-select: none !important;
                    -webkit-user-select: none !important;
                }

                #michatbot-drag-handle {
                    position: absolute;
                    top: -10px;
                    left: -10px;
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
                    transition: opacity 0.3s;
                    border: 1px solid rgba(255,255,255,0.3);
                }
                #michatbot-drag-handle:hover { opacity: 1; }

                #michatbot-bubble {
                    position: absolute;
                    bottom: 105%;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0, 0, 0, 0.85) !important;
                    backdrop-filter: blur(10px);
                    color: #fff;
                    padding: 10px 20px;
                    border-radius: 50px;
                    font-family: 'Quicksand', sans-serif;
                    font-size: 0.9rem;
                    font-weight: 500;
                    min-width: 180px;
                    max-width: 300px;
                    text-align: center;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.8);
                    display: none;
                    pointer-events: none;
                    z-index: 15;
                    border: 1px solid #3498db !important;
                    line-height: 1.4;
                    animation: bubbleFloat 3s ease-in-out infinite;
                }
                #michatbot-bubble::after {
                    content: '';
                    position: absolute;
                    top: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    border-width: 8px;
                    border-style: solid;
                    border-color: rgba(0, 0, 0, 0.85) transparent transparent transparent;
                }
                @keyframes bubbleFloat {
                    0%, 100% { margin-bottom: 0px; }
                    50% { margin-bottom: 5px; }
                }

                #michatbot-menu {
                    display: none;
                    position: absolute;
                    bottom: 100%;
                    left: 0;
                    background: rgba(0, 0, 0, 0.85) !important;
                    backdrop-filter: blur(15px);
                    border-radius: 15px;
                    padding: 8px;
                    min-width: 180px;
                    border: 1px solid #3498db !important;
                    margin-bottom: 15px;
                    box-shadow: 0 15px 40px rgba(0,0,0,0.9);
                    z-index: 25;
                }
                .michatbot-menu-item {
                    color: #fff;
                    padding: 10px 15px;
                    cursor: pointer;
                    border-bottom: 1px solid rgba(255,255,255,0.08);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-family: 'Cinzel', serif;
                    font-size: 0.75rem;
                    transition: all 0.2s ease;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .michatbot-menu-item:hover {
                    background: rgba(52, 152, 219, 0.2);
                    padding-left: 20px;
                }
                .michatbot-menu-item:last-of-type { border-bottom: none; }

                #michatbot-resize-control {
                    padding: 10px 15px;
                    border-top: 1px solid rgba(255,255,255,0.1);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                #michatbot-resize-control input {
                    flex: 1;
                    accent-color: #3498db;
                    cursor: pointer;
                }

                #michatbot-chat-container {
                    position: fixed;
                    bottom: 180px;
                    left: 20px;
                    z-index: 999999999;
                    display: none;
                }

                @media (min-width: 641px) {
                    #michatbot-chat-container {
                        left: auto !important;
                        right: 20px !important;
                        bottom: 20px !important;
                    }
                }

                .chatbot-msg {
                    padding: 10px 14px;
                    border-radius: 18px;
                    margin-bottom: 10px;
                    font-size: 0.85rem;
                    max-width: 85%;
                }
                .chatbot-msg.bot { background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.1); }
                .chatbot-msg.user { background: #3498db; color: #fff; align-self: flex-end; }

                #michatbot-chat-area::-webkit-scrollbar { width: 4px; }
                #michatbot-chat-area::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }

                .michatbot-faq-btn {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: white;
                    padding: 8px 12px;
                    border-radius: 12px;
                    cursor: pointer;
                    font-size: 0.8rem;
                    text-align: left;
                    font-family: 'Quicksand', sans-serif;
                    transition: all 0.2s;
                }
                .michatbot-faq-btn:hover { background: rgba(255,255,255,0.15); border-color: #3498db; }
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
                        <i class="fas fa-compress-alt" style="font-size: 0.8rem; color: #777;"></i>
                        <input type="range" id="michatbot-scale-slider" min="0.6" max="2.0" step="0.1" value="${window.michatbotCurrentScale}">
                        <i class="fas fa-expand-alt" style="font-size: 0.8rem; color: #777;"></i>
                    </div>
                </div>
            </div>
        `);
    }

    // Chat y Detail Containers
    if (!$('#michatbot-chat-container').length) {
        $('body').append(`
            <div id="michatbot-chat-container" style="background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(15px); border-radius: 20px; width: 320px; box-shadow: 0 20px 50px rgba(0,0,0,0.8); padding: 20px; color: white; border: 1px solid #3498db; font-family: 'Quicksand', sans-serif;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; margin-bottom: 15px;">
                    <h3 style="margin: 0; font-size: 1rem; font-family: 'Cinzel', serif; color: #3498db;">VIKINGDEV</h3>
                    <span id="close-michatbot-chat" style="cursor: pointer; font-size: 1.5rem;">&times;</span>
                </div>
                <div id="michatbot-chat-area" style="display: flex; flex-direction: column; height: 250px; overflow-y: auto; margin-bottom: 10px;"></div>
                <div style="font-size: 0.7rem; color: #777; margin-bottom: 8px; font-family: 'Cinzel', serif;">Preguntas Frecuentes</div>
                <div id="michatbot-faq-list" style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 15px;"></div>
                <div style="position: relative;">
                    <input type="text" id="michatbot-chat-input" placeholder="Escribe..." style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 10px 40px 10px 15px; color: white; outline: none;">
                    <i class="fas fa-paper-plane" id="michatbot-send-btn" style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); color: #3498db; cursor: pointer;"></i>
                </div>
            </div>
        `);
    }

    if (!$('#michatbot-detail-overlay').length) {
        $('body').append(`
            <div id="michatbot-detail-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 1000000000; align-items: center; justify-content: center; flex-direction: column;">
                <span id="close-michatbot-detail" style="position: absolute; top: 20px; right: 30px; font-size: 3rem; color: #3498db; cursor: pointer;">&times;</span>
                <div id="michatbot-detail-viewer-container" style="width: 90%; height: 80%;"></div>
                <h2 id="michatbot-detail-name" style="color: white; font-family: 'Cinzel', serif; margin-top: 20px;"></h2>
            </div>
        `);
    }

    // 4. Buscar espíritu actual
    if (forceRefresh || !window.currentSpirit) {
        if (typeof _supabase !== 'undefined') {
            try {
                if (typeof currentUser !== 'undefined' && currentUser) {
                    const { data: userRow } = await _supabase.from('usuarios').select('selected_spirit_id').eq('id', currentUser.id).maybeSingle();
                    if (userRow && userRow.selected_spirit_id) {
                        const { data: spirit } = await _supabase.from('spirits').select('*').eq('id', userRow.selected_spirit_id).maybeSingle();
                        if (spirit) window.currentSpirit = spirit;
                    }
                }
                if (!window.currentSpirit && window.currentStoreId) {
                    const { data: userRow } = await _supabase.from('usuarios').select('selected_spirit_id').eq('id', window.currentStoreId).maybeSingle();
                    if (userRow && userRow.selected_spirit_id) {
                        const { data: spirit } = await _supabase.from('spirits').select('*').eq('id', userRow.selected_spirit_id).maybeSingle();
                        if (spirit) window.currentSpirit = spirit;
                    }
                }
                if (!window.currentSpirit) {
                    const { data } = await _supabase.from('spirits').select('*').eq('is_public', true).limit(1).maybeSingle();
                    if (data) window.currentSpirit = data;
                }
            } catch (e) { console.warn("Michatbot: Error", e); }
        }
        if (!window.currentSpirit) {
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
                camera-target="auto auto auto"
                field-of-view="14deg"
                shadow-intensity="1"
                environment-image="neutral"
                exposure="1"
                interaction-prompt="none"
                style="width: 100%; height: 100%; --poster-color: transparent;"
                oncontextmenu="return false;">
            </model-viewer>
        `);
    }

    // Aplicar escala guardada
    window.botInstance.setScale(window.michatbotCurrentScale);

    // 6. Implementar Drag and Drop
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
            if (dist > 5) isInteractingWithModel = true;
        });
        viewer.addEventListener('click', (e) => {
            const touchDuration = Date.now() - touchStartTime;
            if (touchDuration < 300 && !isInteractingWithModel) {
                e.stopPropagation();
                $('#michatbot-menu').fadeToggle(200);
            }
        });
    }

    $(document).off('click.michatbot').on('click.michatbot', function(e) {
        if (!$(e.target).closest('#companion-wrapper').length) {
            $('#michatbot-menu').fadeOut(200);
        }
    });

    $('#michatbot-opt-chat').off('click').on('click', function(e) {
        e.stopPropagation();
        $('#michatbot-chat-container').fadeToggle(300);
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
                camera-controls auto-rotate camera-target="auto auto auto" field-of-view="14deg"
                shadow-intensity="1" environment-image="neutral" exposure="1.2"
                style="width: 100%; height: 100%; --poster-color: transparent;">
            </model-viewer>
        `);
        $('#michatbot-detail-name').text(window.currentSpirit.name);
        $('#michatbot-detail-overlay').fadeIn(300).css('display', 'flex');
        $('#michatbot-menu').fadeOut(200);
    });

    $('#michatbot-scale-slider').off('input').on('input', function() {
        window.botInstance.setScale($(this).val());
    }).off('change').on('change', function() {
        $('#michatbot-menu').fadeOut(200);
    });

    // FAQs Dinámicas
    const $faqList = $('#michatbot-faq-list');
    $faqList.empty();
    const isEditing = window.location.pathname.includes('admin') ||
                       window.location.pathname.includes('binders') ||
                       window.location.pathname.includes('perfil');

    if (isEditing) {
        $faqList.append(`
            <button class="michatbot-faq-btn" data-q="¿Cómo funciona cada slot del grid?" data-ans="Cada slot representa una carta en el grid. Main Deck (40-60), Extra (15) y Side (15) tienen sus respectivos espacios. Haz clic en el '+' para añadir y en la carta para editar metadatos.">Grid Slots</button>
            <button class="michatbot-faq-btn" data-q="¿Cómo guardar cambios?" data-ans="Para guardar el deck completo, usa el icono de guardado azul en la barra superior. Asegúrate de guardar antes de salir para no perder los cambios.">Guardar Deck</button>
            <button class="michatbot-faq-btn" data-q="¿Cómo funciona el editor?" data-ans="El editor permite arrastrar cartas para moverlas, cambiar rarezas y aplicar efectos foil avanzados directamente en cada carta.">Uso Editor</button>
        `);
    } else {
        $faqList.append(`
            <button class="michatbot-faq-btn" data-q="¿Qué es esta tienda?" data-ans="Es una plataforma TCG personalizada donde puedes ver colecciones, decks públicos y comprar cartas con efectos visuales únicos.">Info Tienda</button>
            <button class="michatbot-faq-btn" data-q="¿Cómo veo los decks?" data-ans="Puedes explorar los decks públicos en la galería. Haz clic en 'Ver Detalle' para ver las cartas en 3D y apreciar sus efectos foil.">Ver Decks</button>
            <button class="michatbot-faq-btn" data-q="¿Efectos 3D?" data-ans="Nuestras cartas utilizan tecnología GLTF para mostrar efectos holográficos realistas. Haz clic en cualquier carta para interactuar con ella.">Efectos Foil</button>
        `);
    }

    $('.michatbot-faq-btn').off('click').on('click', function(e) {
        e.stopPropagation();
        const q = $(this).data('q');
        const ans = $(this).data('ans');
        handleBotChat(q, ans);
    });

    $('#michatbot-chat-input').off('keypress').on('keypress', function(e) {
        if(e.which == 13) $('#michatbot-send-btn').click();
    });

    $('#michatbot-send-btn').off('click').on('click', function() {
        const msg = $('#michatbot-chat-input').val().trim();
        if(!msg) return;
        $('#michatbot-chat-input').val('');
        handleBotChat(msg, "¡Qué interesante! Estoy aprendiendo mucho, pero por ahora te sugiero usar las <b>Preguntas Frecuentes</b>.");
    });

    $('#close-michatbot-chat').off('click').on('click', function(e) {
        e.stopPropagation();
        $('#michatbot-chat-container').fadeOut(300);
    });

    // Inicializar integración
    initMichatbotIntegration();

    // Saludo inicial
    setTimeout(() => {
        const spiritName = window.currentSpirit ? window.currentSpirit.name : 'tu asistente';
        window.botInstance.say(`¡Hola! Soy ${spiritName}, ¿en qué puedo ayudarte hoy?`);
    }, 2000);
}

function handleBotChat(q, ans) {
    const $area = $('#michatbot-chat-area');
    const $userMsg = $('<div class="chatbot-msg user"></div>').text(q);
    $area.append($userMsg);
    $area.animate({ scrollTop: $area[0].scrollHeight }, 300);
    setTimeout(() => {
        const $botMsg = $('<div class="chatbot-msg bot"></div>').html(ans);
        $area.append($botMsg);
        $area.animate({ scrollTop: $area[0].scrollHeight }, 300);
    }, 600);
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

    try {
        const { data: messages } = await _supabase.from('bot_messages').select('*').eq('user_id', ownerId).eq('is_active', true);
        if (messages?.length > 0) {
            if (window.botMessageInterval) clearInterval(window.botMessageInterval);
            window.botMessageInterval = setInterval(() => {
                const m = messages[Math.floor(Math.random() * messages.length)];
                window.botInstance.say(m.content, (m.duration || 5) * 1000);
            }, 30000);
        }
    } catch (e) {}

    // Restaurar subscripción de subastas
    if (!window.botRealtimeSubscribed) {
        const { data: activeAuctions } = await _supabase.from('subastas').select('id').eq('user_id', ownerId).eq('status', 'active');
        const auctionIds = (activeAuctions || []).map(a => a.id);

        _supabase.channel('bot-pujas').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'subastas_pujas' }, payload => {
            if (auctionIds.includes(payload.new.subasta_id)) {
                window.botInstance.say(`¡Nueva puja detectada! Alguien ofreció $${payload.new.amount}.`);
            }
        }).subscribe();
        window.botRealtimeSubscribed = true;
    }
}

$(document).ready(() => initMichatbot());
