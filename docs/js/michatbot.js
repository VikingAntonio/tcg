/**
 * michatbot.js - Nuevo Chatbot GLTF Vikingdev
 * Centralizado para admin y público.
 * V3.3 - Posicionamiento a la derecha, estética profesional y tips dinámicos.
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
            const size = 180 * scale;
            $wrapper.css({
                width: size + 'px',
                height: size + 'px'
            });
        }
    }
};

async function initMichatbot(forceRefresh = false) {
    console.log("Iniciando Michatbot V3.3...");

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
                    right: 20px; /* Cambiado de left a right por solicitud */
                    left: auto;
                    z-index: 999999999;
                    width: 180px;
                    height: 180px;
                    touch-action: none;
                    transition: width 0.2s, height 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .michatbot-dragging-active {
                    user-select: none !important;
                    -webkit-user-select: none !important;
                }

                #michatbot-drag-handle {
                    position: absolute;
                    top: 15%;
                    right: 0%; /* Ajustado para el lado derecho */
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
                    right: 50%;
                    transform: translateX(50%);
                    background: #000;
                    color: #fff;
                    padding: 8px 25px;
                    border-radius: 50px;
                    font-family: 'Montserrat', sans-serif;
                    font-size: 0.85rem;
                    font-weight: 300;
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
                    right: 0;
                    background: #000;
                    border-radius: 15px;
                    padding: 6px;
                    min-width: 200px;
                    border: 1px solid rgba(255,255,255,0.25);
                    margin-bottom: 20px;
                    box-shadow: 0 15px 40px rgba(0,0,0,0.9);
                    z-index: 10;
                }
                .michatbot-menu-item {
                    color: #fff;
                    padding: 8px 18px;
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
                    padding-right: 22px; /* Ajustado para el lado derecho */
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
                <div class="chat-messages" id="michatbot-chat-messages"></div>
                <div class="chat-footer">
                    <div class="chat-faq-quick" id="michatbot-faq-quick"></div>
                    <div class="chat-input-wrapper">
                        <input type="text" id="michatbot-chat-input" placeholder="Escribe un mensaje...">
                        <div class="chat-send-btn" id="michatbot-chat-send">
                            <i class="fas fa-paper-plane"></i>
                        </div>
                    </div>
                </div>
            </div>
        `);
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
                let sessionUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : null;
                if (!sessionUser) {
                    const stored = localStorage.getItem('tcg_session');
                    if (stored) sessionUser = JSON.parse(stored);
                }

                if (sessionUser) {
                    const { data: userRow } = await _supabase.from('usuarios').select('selected_spirit_id').eq('id', sessionUser.id).maybeSingle();
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
            } catch (e) { console.warn("Michatbot: Error buscando spirit", e); }
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
            if (dist > 10) isInteractingWithModel = true;
        });

        viewer.addEventListener('click', (e) => {
            const touchDuration = Date.now() - touchStartTime;
            if (touchDuration < 300 && !isInteractingWithModel) {
                e.stopPropagation();
                $('#michatbot-menu').fadeToggle(250);
            }
        });
    }

    $(document).off('click.michatbot').on('click.michatbot', function(e) {
        if (!$(e.target).closest('#companion-wrapper').length) {
            $('#michatbot-menu').fadeOut(250);
        }
    });

    $('#michatbot-opt-chat').off('click').on('click', function(e) {
        e.stopPropagation();
        $('#michatbot-chat-container').css('display', 'flex').hide().fadeIn(300);
        $('#michatbot-menu').fadeOut(250);
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
        window.botInstance.setScale($(this).val());
    });

    $(document).off('click', '.chat-faq-pill').on('click', '.chat-faq-pill', function(e) {
        e.stopPropagation();
        addUserMessage($(this).text());
        const ans = $(this).data('ans');
        setTimeout(() => addBotMessage(ans), 600);
    });

    $('#michatbot-chat-send').off('click').on('click', function() {
        const text = $('#michatbot-chat-input').val().trim();
        if (!text) return;
        addUserMessage(text);
        $('#michatbot-chat-input').val('');
        setTimeout(() => addBotMessage("Por ahora solo puedo responder a las preguntas frecuentes, pero pronto seré más inteligente."), 800);
    });

    $('#michatbot-chat-input').on('keypress', (e) => { if (e.which === 13) $('#michatbot-chat-send').click(); });
    $('#close-michatbot-chat').on('click', () => $('#michatbot-chat-container').fadeOut(250));
    $('#close-michatbot-detail').on('click', () => $('#michatbot-detail-overlay').fadeOut(400));

    initMichatbotIntegration();
    setTimeout(checkAuctionStatusOnLoad, 3000);
}

function addUserMessage(text) {
    const $c = $('#michatbot-chat-messages');
    $c.append(`<div class="msg-user">${text}</div>`);
    $c.scrollTop($c[0].scrollHeight);
}

function addBotMessage(text) {
    const $c = $('#michatbot-chat-messages');
    $c.append(`<div class="msg-bot">${text}</div>`);
    $c.scrollTop($c[0].scrollHeight);
}

function renderContextFAQs() {
    const isAdmin = /admin|perfil|scanner|binders|inversiones|build|clientes|tracking/.test(window.location.pathname);
    const $q = $('#michatbot-faq-quick');
    $q.empty();
    let faqs = isAdmin ? [
        { q: "¿Cómo uso el scanner?", a: "Usa la sección Scanner para identificar tus cartas rápidamente." },
        { q: "¿Dónde veo mis decks?", a: "Tus decks están en 'Mis Decks'. Puedes editarlos y compartirlos." },
        { q: "¿Cómo añado cartas?", a: "En tus álbumes, haz clic en espacios vacíos para buscar y añadir." },
        { q: "¿Inversiones?", a: "Mira el valor de mercado de tus cartas en la sección Inversiones." }
    ] : [
        { q: "¿Cómo comprar?", a: "Añade cartas al carrito y contacta por WhatsApp para finalizar." },
        { q: "¿Hacen envíos?", a: "Consulta el horario y ubicación de la tienda en mis mensajes dinámicos." },
        { q: "¿Tienda física?", a: "Revisa la info de la tienda en la parte inferior o en mis tips." }
    ];
    faqs.forEach(f => $q.append(`<div class="chat-faq-pill" data-ans="${f.a}">${f.q}</div>`));
}

function makeMichatbotDraggable() {
    const w = document.getElementById('companion-wrapper');
    const h = document.getElementById('michatbot-drag-handle');
    if (!w || !h) return;
    let isDragging = false, startX, startY, initX, initY;
    h.addEventListener('pointerdown', (e) => {
        isDragging = true;
        startX = e.clientX; startY = e.clientY;
        const rect = w.getBoundingClientRect();
        initX = rect.left; initY = rect.top;
        w.setPointerCapture(e.pointerId);
        h.style.cursor = 'grabbing';
        $('body').addClass('michatbot-dragging-active');
    });
    window.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        let nx = initX + (e.clientX - startX), ny = initY + (e.clientY - startY);
        nx = Math.max(0, Math.min(window.innerWidth - w.offsetWidth, nx));
        ny = Math.max(0, Math.min(window.innerHeight - w.offsetHeight, ny));
        w.style.left = nx + 'px'; w.style.top = ny + 'px';
        w.style.bottom = 'auto'; w.style.right = 'auto'; w.style.margin = '0';
    });
    window.addEventListener('pointerup', () => {
        if (!isDragging) return;
        isDragging = false; h.style.cursor = 'grab';
        $('body').removeClass('michatbot-dragging-active');
    });
}

async function checkAuctionStatusOnLoad() {
    if (typeof _supabase === 'undefined') return;
    const isAuction = /subastas|public/.test(window.location.pathname);
    if (!isAuction) return;
    const uid = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : (localStorage.getItem('tcg_session') ? JSON.parse(localStorage.getItem('tcg_session')).id : null);
    if (!uid) return;
    try {
        const oid = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : window.currentStoreId;
        const { data: auctions } = await _supabase.from('subastas').select('id').eq('user_id', oid).eq('status', 'active');
        if (!auctions?.length) return;
        const ids = auctions.map(a => a.id);
        const { data: bids } = await _supabase.from('subastas_pujas').select('*').in('subasta_id', ids).eq('bidder_id', uid);
        if (!bids?.length) return;
        const topBids = {}; bids.forEach(b => { if(!topBids[b.subasta_id] || b.amount > topBids[b.subasta_id].amount) topBids[b.subasta_id] = b; });
        let win = 0, lose = 0;
        for (const aid of Object.keys(topBids)) {
            const { data: top } = await _supabase.from('subastas_pujas').select('amount').eq('subasta_id', aid).order('amount', { ascending: false }).limit(1).maybeSingle();
            if (top && top.amount === topBids[aid].amount) win++; else lose++;
        }
        if (win > 0 && lose === 0) window.botInstance.say(`¡Vas ganando en ${win} subasta(s)!`);
        else if (lose > 0) window.botInstance.say(`¡Atención! Te han superado en ${lose} subasta(s).`);
    } catch (e) {}
}

async function initMichatbotIntegration() {
    if (typeof _supabase === 'undefined') return;
    let oid = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : window.currentStoreId;
    if (!oid) { const s = localStorage.getItem('tcg_session'); if (s) oid = JSON.parse(s).id; }
    if (!oid) return;
    const isAdmin = /admin|perfil|scanner|binders|inversiones|build|clientes|tracking/.test(window.location.pathname);
    let tips = isAdmin ? [
        "¡Mira cómo va el mercado de tus productos en Inversiones!",
        "Puedes crear carpetas digitales para organizar tu colección.",
        "¡Armar tu deck desde PC es mucho más cómodo!",
        "Usa el scanner para subir tus cartas sin escribir.",
        "Comparte tus álbumes con un solo link."
    ] : [];
    if (!isAdmin) {
        try {
            const { data: store } = await _supabase.from('usuarios').select('horario, ubicacion, store_name').eq('id', oid).maybeSingle();
            if (store) {
                if (store.horario) tips.push(`Nuestro horario: ${store.horario}`);
                if (store.ubicacion) tips.push(`Nos encuentras en: ${store.ubicacion}`);
                tips.push(`¡Bienvenido a ${store.store_name || 'nuestra tienda'}!`);
            }
        } catch (e) {}
        tips.push("Si tienes dudas, mira el detalle de la carta en 3D.");
        tips.push("¡No olvides revisar nuestras subastas!");
    }
    if (window.botMessageInterval) clearInterval(window.botMessageInterval);
    window.botMessageInterval = setInterval(async () => {
        if (Math.random() > 0.5 || tips.length === 0) {
            try {
                const { data: msgs } = await _supabase.from('bot_messages').select('*').eq('user_id', oid).eq('is_active', true);
                if (msgs?.length) {
                    const m = msgs[Math.floor(Math.random() * msgs.length)];
                    window.botInstance.say(m.content, (m.duration || 5) * 1000);
                } else if (tips.length) window.botInstance.say(tips[Math.floor(Math.random() * tips.length)], 5000);
            } catch (e) {}
        } else { window.botInstance.say(tips[Math.floor(Math.random() * tips.length)], 5000); }
    }, 45000);
    if (!window.botRealtimeSubscribed) {
        const { data: act } = await _supabase.from('subastas').select('id').eq('user_id', oid).eq('status', 'active');
        const aids = (act || []).map(a => a.id);
        _supabase.channel('bot-pujas').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'subastas_pujas' }, p => {
            if (aids.includes(p.new.subasta_id)) {
                const uid = currentUser?.id;
                if (uid && String(p.new.bidder_id) === String(uid)) window.botInstance.say(`¡Puja registrada! $${p.new.amount}. ¡Vas ganando!`);
                else window.botInstance.say(`¡Nueva puja! $${p.new.amount}. ¡No te quedes atrás!`);
            }
        }).subscribe();
        window.botRealtimeSubscribed = true;
    }
}

$(document).ready(() => initMichatbot());
