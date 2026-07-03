/**
 * michatbot.js - Nuevo Chatbot GLTF Vikingdev
 * Centralizado para admin y público.
 * V3.6 - XSS fixed, Robust Admin check, High frequency messages.
 */

// Global bot instance for access from other scripts
window.botInstance = {
    isMuted: localStorage.getItem('michatbot_muted') === 'true',
    say: function(text, duration = 4000) {
        if (this.isMuted) return;
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
            $wrapper.css({ width: size + 'px', height: size + 'px' });
        }
    },
    toggleMute: function() {
        this.isMuted = !this.isMuted;
        localStorage.setItem('michatbot_muted', this.isMuted);
        const icon = this.isMuted ? 'fa-volume-mute' : 'fa-volume-up';
        $('#michatbot-opt-mute i').attr('class', 'fas ' + icon);
        if (this.isMuted) $('#michatbot-bubble').fadeOut(200);
    }
};

async function initMichatbot(forceRefresh = false) {
    console.log("Iniciando Michatbot V3.6...");

    if ($('#companion-wrapper').length && !$('#michatbot-model-container').length) {
        $('#companion-wrapper').remove();
    }

    if (!$('#michatbot-styles').length) {
        $('head').append(`
            <style id="michatbot-styles">
                @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@200;300;400&display=swap');

                #companion-wrapper {
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    right: auto;
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
                    left: 0;
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
                        bottom: 0; right: 0; width: 100vw; height: 100vh;
                        border-radius: 0; z-index: 2147483647;
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
                    margin: 0; font-size: 0.85rem; letter-spacing: 3px; font-weight: 500;
                    color: #fff; text-transform: uppercase;
                }
                .chat-messages {
                    flex: 1; overflow-y: auto; padding: 20px;
                    display: flex; flex-direction: column; gap: 15px; scrollbar-width: none;
                }
                .chat-messages::-webkit-scrollbar { display: none; }

                .msg-bot, .msg-user {
                    max-width: 85%; padding: 12px 18px; border-radius: 18px;
                    font-size: 0.85rem; line-height: 1.5; font-weight: 300;
                }
                .msg-bot { align-self: flex-start; background: rgba(255,255,255,0.08); color: #eee; border-bottom-left-radius: 4px; }
                .msg-user { align-self: flex-end; background: #fff; color: #000; border-bottom-right-radius: 4px; }

                .chat-footer { padding: 20px; background: rgba(0,0,0,0.3); border-top: 1px solid rgba(255,255,255,0.1); }
                .chat-input-wrapper {
                    display: flex; background: rgba(255,255,255,0.05); border-radius: 50px;
                    padding: 5px 5px 5px 20px; border: 1px solid rgba(255,255,255,0.1); align-items: center;
                }
                .chat-input-wrapper input {
                    flex: 1; background: transparent; border: none; color: #fff;
                    font-size: 0.85rem; font-family: 'Montserrat', sans-serif; outline: none;
                }
                .chat-send-btn {
                    width: 35px; height: 35px; border-radius: 50%; background: #fff; color: #000;
                    display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;
                }
                .chat-send-btn:hover { transform: scale(1.1); }

                .chat-faq-quick { display: flex; gap: 10px; overflow-x: auto; padding: 10px 0; scrollbar-width: none; }
                .chat-faq-pill {
                    white-space: nowrap; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                    color: #aaa; padding: 6px 15px; border-radius: 50px; font-size: 0.7rem;
                    cursor: pointer; transition: all 0.2s; text-transform: uppercase; letter-spacing: 1px;
                }
                .chat-faq-pill:hover { background: rgba(255,255,255,0.15); color: #fff; border-color: #fff; }
            </style>
        `);
    }

    if (!$('#companion-wrapper').length) {
        $('body').append(`
            <div id="companion-wrapper">
                <div id="michatbot-drag-handle"><i class="fas fa-arrows-alt"></i></div>
                <div id="michatbot-bubble"><span class="bubble-text">¡Hola!</span></div>
                <div id="michatbot-model-container" style="width: 100%; height: 100%;"></div>

                <div id="michatbot-menu">
                    <div class="michatbot-menu-item" id="michatbot-opt-chat"><i class="fas fa-comment-dots"></i> Chatear</div>
                    <div class="michatbot-menu-item" id="michatbot-opt-mute">
                        <i class="fas ${window.botInstance.isMuted ? 'fa-volume-mute' : 'fa-volume-up'}"></i> Silenciar
                    </div>
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
                    if (userRow?.selected_spirit_id) {
                        const { data: spirit } = await _supabase.from('spirits').select('*').eq('id', userRow.selected_spirit_id).maybeSingle();
                        if (spirit) window.currentSpirit = spirit;
                    }
                }
                if (!window.currentSpirit && window.currentStoreId) {
                    const { data: userRow } = await _supabase.from('usuarios').select('selected_spirit_id').eq('id', window.currentStoreId).maybeSingle();
                    if (userRow?.selected_spirit_id) {
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
        if (!window.currentSpirit) { setTimeout(() => initMichatbot(), 2000); return; }
    }

    const gltfUrl = window.currentSpirit.gltf_url;
    const $viewer = $('#michatbot-viewer');
    if (forceRefresh || !$viewer.length || $viewer.attr('src') !== gltfUrl) {
        $('#michatbot-model-container').html(`
            <model-viewer id="michatbot-viewer" src="${gltfUrl}" auto-rotate camera-controls shadow-intensity="1" environment-image="neutral" exposure="1" interaction-prompt="none" camera-orbit="auto 75deg auto" field-of-view="auto" min-field-of-view="5deg" max-field-of-view="45deg" disable-zoom interpolation-decay="200" bounds="tight" auto-rotate-delay="0" rotation-speed="0.5" style="width: 120%; height: 120%; background-color: transparent; margin-left: -10%; margin-top: -10%;" oncontextmenu="return false;"></model-viewer>
        `);
    }

    if (!window.michatbotDraggableInit) { makeMichatbotDraggable(); window.michatbotDraggableInit = true; }

    const viewer = document.getElementById('michatbot-viewer');
    let touchStartTime = 0, startX_click, startY_click, isInteractingWithModel = false;
    if (viewer) {
        viewer.addEventListener('pointerdown', (e) => { touchStartTime = Date.now(); startX_click = e.clientX; startY_click = e.clientY; isInteractingWithModel = false; });
        viewer.addEventListener('pointermove', (e) => { if (startX_click === undefined) return; const dist = Math.sqrt(Math.pow(e.clientX - startX_click, 2) + Math.pow(e.clientY - startY_click, 2)); if (dist > 10) isInteractingWithModel = true; });
        viewer.addEventListener('click', (e) => { const touchDuration = Date.now() - touchStartTime; if (touchDuration < 300 && !isInteractingWithModel) { e.stopPropagation(); $('#michatbot-menu').fadeToggle(250); } });
    }

    $(document).off('click.michatbot').on('click.michatbot', function(e) { if (!$(e.target).closest('#companion-wrapper').length) { $('#michatbot-menu').fadeOut(250); } });
    $('#michatbot-opt-chat').on('click', function(e) { e.stopPropagation(); $('#michatbot-chat-container').css('display', 'flex').hide().fadeIn(300); $('#michatbot-menu').fadeOut(250); if ($('#michatbot-chat-messages').is(':empty')) { addBotMessage(`¡Hola! Soy ${window.currentSpirit.name}, tu asistente. ¿En qué puedo ayudarte?`); renderContextFAQs(); } });
    $('#michatbot-opt-mute').on('click', function(e) { e.stopPropagation(); window.botInstance.toggleMute(); });
    $('#michatbot-opt-play').on('click', function(e) { e.stopPropagation(); window.location.href = 'play.html'; });
    $('#michatbot-scale-slider').on('input', function() { window.botInstance.setScale($(this).val()); });
    $(document).off('click', '.chat-faq-pill').on('click', '.chat-faq-pill', function(e) { e.stopPropagation(); addUserMessage($(this).text()); const ans = $(this).data('ans'); setTimeout(() => addBotMessage(ans), 600); });
    $('#michatbot-chat-send').on('click', function() { const text = $('#michatbot-chat-input').val().trim(); if (!text) return; addUserMessage(text); $('#michatbot-chat-input').val(''); setTimeout(() => addBotMessage("Pronto seré más inteligente. ¡Prueba las FAQs!"), 800); });
    $('#michatbot-chat-input').on('keypress', (e) => { if (e.which === 13) $('#michatbot-chat-send').click(); });
    $('#close-michatbot-chat').on('click', () => $('#michatbot-chat-container').fadeOut(250));

    initMichatbotIntegration();
}

function addUserMessage(text) {
    const $c = $('#michatbot-chat-messages');
    const $msg = $('<div class="msg-user"></div>').text(text);
    $c.append($msg);
    $c.scrollTop($c[0].scrollHeight);
}
function addBotMessage(text) {
    const $c = $('#michatbot-chat-messages');
    const $msg = $('<div class="msg-bot"></div>').html(text);
    $c.append($msg);
    $c.scrollTop($c[0].scrollHeight);
}

function renderContextFAQs() {
    const isAdmin = /admin|perfil|scanner|binders|inversiones|build|clientes|tracking/.test(window.location.pathname);
    const $q = $('#michatbot-faq-quick'); $q.empty();
    let faqs = isAdmin ? [
        { q: "¿Scanner?", a: "Usa Scanner para identificar tus cartas rápidamente." },
        { q: "¿Decks?", a: "Gestiona y comparte tus decks en 'Mis Decks'." },
        { q: "¿Inversiones?", a: "Mira el valor de tu colección en tiempo real." }
    ] : [
        { q: "¿Cómo comprar?", a: "Añade al carrito y contacta por WhatsApp." },
        { q: "¿Envíos?", a: "Consulta el horario y ubicación en mis tips." }
    ];
    faqs.forEach(f => $q.append(`<div class="chat-faq-pill" data-ans="${f.a}">${f.q}</div>`));
}

function makeMichatbotDraggable() {
    const w = document.getElementById('companion-wrapper');
    const h = document.getElementById('michatbot-drag-handle');
    if (!w || !h) return;
    let isDragging = false, startX, startY, initX, initY;
    h.addEventListener('pointerdown', (e) => { isDragging = true; startX = e.clientX; startY = e.clientY; const rect = w.getBoundingClientRect(); initX = rect.left; initY = rect.top; w.setPointerCapture(e.pointerId); h.style.cursor = 'grabbing'; $('body').addClass('michatbot-dragging-active'); });
    window.addEventListener('pointermove', (e) => { if (!isDragging) return; let nx = initX + (e.clientX - startX), ny = initY + (e.clientY - startY); nx = Math.max(0, Math.min(window.innerWidth - w.offsetWidth, nx)); ny = Math.max(0, Math.min(window.innerHeight - w.offsetHeight, ny)); w.style.left = nx + 'px'; w.style.top = ny + 'px'; w.style.bottom = 'auto'; w.style.right = 'auto'; w.style.margin = '0'; });
    window.addEventListener('pointerup', () => { if (!isDragging) return; isDragging = false; h.style.cursor = 'grab'; $('body').removeClass('michatbot-dragging-active'); });
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
        for (const aid of Object.keys(topBids)) { const { data: top } = await _supabase.from('subastas_pujas').select('amount').eq('subasta_id', aid).order('amount', { ascending: false }).limit(1).maybeSingle(); if (top?.amount === topBids[aid].amount) win++; else lose++; }
        if (win > 0 && lose === 0) window.botInstance.say(`¡Vas ganando en ${win} subasta(s)!`); else if (lose > 0) window.botInstance.say(`¡Atención! Te han superado en ${lose} subasta(s).`);
    } catch (e) {}
}

async function initMichatbotIntegration() {
    if (typeof _supabase === 'undefined') return;
    let oid = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : window.currentStoreId;
    if (!oid) { const s = localStorage.getItem('tcg_session'); if (s) oid = JSON.parse(s).id; }
    if (!oid) return;
    const isAdmin = /admin|perfil|scanner|binders|inversiones|build|clientes|tracking/.test(window.location.pathname);
    let tips = isAdmin ? [
        "¡Revisa el valor total de tu colección en la sección de Inversiones!",
        "Organiza tus cartas en carpetas digitales para un control total.",
        "Tip: Gestionar tu inventario y armar decks es mucho más ágil desde una PC.",
        "¿Colección grande? El Scanner es tu mejor aliado para subir cartas rápido.",
        "Puedes compartir tus álbumes con clientes usando tu link público.",
        "Sigue el histórico de precios de tus cartas en el panel de Inversiones."
    ] : [
        "¡Haz clic en cualquier carta para ver su precio y disponibilidad!",
        "Añade productos al carrito y envíanos tu pedido directamente por WhatsApp.",
        "¡No te pierdas nuestras subastas! Puedes ganar cartas increíbles a buen precio.",
        "Revisa la sección de 'Claims' para cazar ofertas antes que nadie."
    ];
    if (!isAdmin) {
        try {
            const { data: store } = await _supabase.from('usuarios').select('horario, ubicacion, store_name').eq('id', oid).maybeSingle();
            if (store) {
                if (store.horario) tips.push(`Nuestro horario de atención: ${store.horario}`);
                if (store.ubicacion) tips.push(`Visítanos en: ${store.ubicacion}`);
                tips.push(`¡Bienvenido a ${store.store_name || 'nuestra tienda'}!`);
            }
        } catch (e) {}
    }
    if (window.botMessageInterval) clearInterval(window.botMessageInterval);
    const showRandomTip = async () => {
        if (isAdmin || Math.random() > 0.5 || tips.length === 0) {
            if (isAdmin) { window.botInstance.say(tips[Math.floor(Math.random() * tips.length)], 6000); }
            else {
                try {
                    const { data: msgs } = await _supabase.from('bot_messages').select('*').eq('user_id', oid).eq('is_active', true);
                    if (msgs?.length) { const m = msgs[Math.floor(Math.random() * msgs.length)]; window.botInstance.say(m.content, (m.duration || 5) * 1000); }
                    else if (tips.length) window.botInstance.say(tips[Math.floor(Math.random() * tips.length)], 6000);
                } catch (e) {}
            }
        } else { window.botInstance.say(tips[Math.floor(Math.random() * tips.length)], 6000); }
    };
    setTimeout(showRandomTip, 3000);
    window.botMessageInterval = setInterval(showRandomTip, 12000);

    if (!window.botRealtimeSubscribed) {
        const { data: act } = await _supabase.from('subastas').select('id').eq('user_id', oid).eq('status', 'active');
        const aids = (act || []).map(a => a.id);
        _supabase.channel('bot-pujas').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'subastas_pujas' }, p => { if (aids.includes(p.new.subasta_id)) { const uid = (typeof currentUser !== 'undefined') ? currentUser?.id : null; if (uid && String(p.new.bidder_id) === String(uid)) window.botInstance.say(`¡Puja registrada! $${p.new.amount}. ¡Vas ganando!`); else window.botInstance.say(`¡Nueva puja! $${p.new.amount}. ¡No te quedes atrás!`); } }).subscribe();
        window.botRealtimeSubscribed = true;
    }
}
$(document).ready(() => initMichatbot());
