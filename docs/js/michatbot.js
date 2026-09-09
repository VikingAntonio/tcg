/**
 * michatbot.js - AI Spirit Chatbot GLTF Vikingdev
 * Integrado con Gemini AI a través de Supabase Edge Function 'spirit-chat'.
 * Soporta consulta e instrucciones administrativas completas en admin.html
 * e interacción de solo consulta en vistas públicas.
 */

window.botConversationHistory = [];
window.selectedChatImageBase64 = null;
window.speechRecognitionInstance = null;

// Global bot instance
window.botInstance = {
    isMuted: localStorage.getItem('michatbot_muted') === 'true',
    say: function(text, duration = 5000) {
        if (this.isMuted || !text) return;
        const $bubble = $('#michatbot-bubble');
        if (!$bubble.length) return;
        // Clean markdown symbols for speech bubble display
        const cleanText = text.replace(/[*_#`~]/g, '').trim();
        $bubble.find('.bubble-text').text(cleanText.length > 120 ? cleanText.substring(0, 117) + '...' : cleanText);
        $bubble.stop(true, true).fadeIn(300);

        if (window.bubbleTimeout) clearTimeout(window.bubbleTimeout);
        window.bubbleTimeout = setTimeout(() => {
            $bubble.fadeOut(300);
        }, duration);
    },
    setScale: function(scale) {
        const $wrapper = $('#companion-wrapper');
        if ($wrapper.length) {
            const size = 150 * scale;
            $wrapper.css({ width: size + 'px', height: size + 'px' });
        }
    },
    toggleMute: function() {
        this.isMuted = !this.isMuted;
        localStorage.setItem('michatbot_muted', this.isMuted);
        this.updateMuteUI();
        if (this.isMuted) $('#michatbot-bubble').fadeOut(200);
        else this.say("Notificaciones activadas");
    },
    updateMuteUI: function() {
        const iconClass = this.isMuted ? 'fas fa-volume-mute' : 'fas fa-volume-up';
        const text = this.isMuted ? 'Activar Sonido' : 'Silenciar';
        $('#michatbot-opt-mute').html(`<i class="${iconClass}"></i> ${text}`);
    },
    setContext: function(view) {
        console.log("Chatbot context set to:", view);
    },
    saySequence: function(messages) {
        console.log("Chatbot saySequence called:", messages);
    },
    fetchDetailedCardInfo: function(name) {
        console.log("Chatbot fetchDetailedCardInfo called for:", name);
    }
};

async function initMichatbot(forceRefresh = false) {
    console.log("Iniciando Michatbot V6.0...");

    if ($('#companion-wrapper').length && !$('#michatbot-model-container').length) {
        $('#companion-wrapper').remove();
    }

    if (!$('#michatbot-styles').length) {
        $('head').append(`
            <style id="michatbot-styles">
                @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap');

                #companion-wrapper {
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    z-index: 999999999;
                    width: 150px;
                    height: 150px;
                    touch-action: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: transparent;
                }

                #michatbot-drag-handle {
                    position: absolute;
                    top: 8px;
                    left: 0;
                    background: rgba(15, 23, 42, 0.9);
                    color: #38bdf8;
                    width: 34px;
                    height: 34px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: grab;
                    z-index: 20;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
                    opacity: 0.85;
                    border: 1px solid rgba(56, 189, 248, 0.3);
                    pointer-events: auto;
                    transition: transform 0.2s ease, background 0.2s ease;
                }

                #michatbot-drag-handle:hover {
                    transform: scale(1.1);
                    background: rgba(30, 41, 59, 0.95);
                }

                #michatbot-bubble {
                    position: absolute;
                    bottom: 92%;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(15, 23, 42, 0.92);
                    backdrop-filter: blur(12px);
                    color: #f1f5f9;
                    padding: 8px 20px;
                    border-radius: 20px;
                    font-family: 'Montserrat', sans-serif;
                    font-size: 0.82rem;
                    min-width: 180px;
                    max-width: 320px;
                    text-align: center;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8), 0 0 15px rgba(56, 189, 248, 0.2);
                    display: none;
                    pointer-events: none;
                    z-index: 15;
                    border: 1px solid rgba(56, 189, 248, 0.3);
                }

                #michatbot-menu {
                    display: none;
                    position: absolute;
                    bottom: 100%;
                    left: 0;
                    background: rgba(15, 23, 42, 0.95);
                    backdrop-filter: blur(16px);
                    border-radius: 18px;
                    padding: 8px;
                    min-width: 210px;
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    margin-bottom: 15px;
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.9);
                    z-index: 10;
                }
                .michatbot-menu-item {
                    color: #e2e8f0;
                    padding: 10px 16px;
                    cursor: pointer;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-family: 'Montserrat', sans-serif;
                    font-size: 0.8rem;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    transition: background 0.2s ease, color 0.2s ease;
                }
                .michatbot-menu-item:hover {
                    background: rgba(56, 189, 248, 0.15);
                    color: #38bdf8;
                }

                #michatbot-chat-container {
                    display: none;
                    position: fixed;
                    bottom: 25px;
                    right: 25px;
                    width: 390px;
                    height: 620px;
                    max-height: 85vh;
                    background: rgba(10, 15, 28, 0.94);
                    backdrop-filter: blur(25px);
                    -webkit-backdrop-filter: blur(25px);
                    border-radius: 28px;
                    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.85), 0 0 30px rgba(56, 189, 248, 0.12);
                    z-index: 2000000000;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    flex-direction: column;
                    overflow: hidden;
                    font-family: 'Montserrat', sans-serif;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }

                @media (max-width: 640px) {
                    #michatbot-chat-container {
                        bottom: 0 !important;
                        right: 0 !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100vw !important;
                        height: 100dvh !important;
                        max-height: 100dvh !important;
                        border-radius: 0 !important;
                        border: none !important;
                    }
                }

                .chat-header {
                    padding: 16px 20px;
                    background: linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.4) 100%);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .chat-header-title {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .chat-header-avatar {
                    width: 38px;
                    height: 38px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #0284c7, #6366f1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
                    font-size: 1.1rem;
                    box-shadow: 0 0 12px rgba(56, 189, 248, 0.4);
                }

                .chat-status-indicator {
                    width: 9px;
                    height: 9px;
                    background: #22c55e;
                    border-radius: 50%;
                    box-shadow: 0 0 8px #22c55e;
                    display: inline-block;
                    margin-left: 6px;
                }

                .chat-close-btn {
                    cursor: pointer;
                    width: 34px;
                    height: 34px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.06);
                    color: #94a3b8;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.1rem;
                    transition: background 0.2s ease, color 0.2s ease;
                }

                .chat-close-btn:hover {
                    background: rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                }

                .chat-messages {
                    flex: 1 1 auto;
                    min-height: 0;
                    overflow-y: auto;
                    padding: 18px 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    scroll-behavior: smooth;
                }

                .chat-messages::-webkit-scrollbar {
                    width: 5px;
                }

                .chat-messages::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.15);
                    border-radius: 10px;
                }

                .msg-user {
                    align-self: flex-end;
                    background: linear-gradient(135deg, #0284c7 0%, #4f46e5 100%);
                    color: #ffffff;
                    padding: 12px 18px;
                    border-radius: 20px 20px 4px 20px;
                    max-width: 82%;
                    font-size: 0.88rem;
                    line-height: 1.45;
                    word-wrap: break-word;
                    white-space: pre-wrap;
                    word-break: break-word;
                    box-shadow: 0 4px 15px rgba(2, 132, 199, 0.25);
                }

                .msg-user img {
                    max-width: 100%;
                    border-radius: 12px;
                    margin-bottom: 8px;
                    display: block;
                }

                .msg-bot {
                    align-self: flex-start;
                    background: rgba(30, 41, 59, 0.7);
                    color: #f1f5f9;
                    padding: 14px 18px;
                    border-radius: 20px 20px 20px 4px;
                    max-width: 88%;
                    font-size: 0.88rem;
                    line-height: 1.5;
                    word-wrap: break-word;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.3);
                }

                .msg-bot strong {
                    color: #38bdf8;
                }

                .msg-bot-loading {
                    align-self: flex-start;
                    background: rgba(30, 41, 59, 0.5);
                    color: #38bdf8;
                    padding: 12px 18px;
                    border-radius: 20px;
                    font-size: 0.85rem;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    border: 1px solid rgba(56, 189, 248, 0.2);
                }

                /* Image Attachment Preview Box */
                #michatbot-image-preview-container {
                    display: none;
                    padding: 8px 16px;
                    background: rgba(15, 23, 42, 0.8);
                    border-top: 1px solid rgba(255, 255, 255, 0.08);
                    align-items: center;
                    gap: 12px;
                }

                #michatbot-image-preview-container img {
                    width: 48px;
                    height: 48px;
                    object-fit: cover;
                    border-radius: 8px;
                    border: 1px solid rgba(56, 189, 248, 0.4);
                }

                #michatbot-remove-image-btn {
                    color: #ef4444;
                    cursor: pointer;
                    font-size: 1rem;
                }

                .chat-footer {
                    padding: 12px 16px;
                    background: rgba(15, 23, 42, 0.95);
                    border-top: 1px solid rgba(255, 255, 255, 0.12);
                    flex-shrink: 0;
                    position: relative;
                    z-index: 10;
                }

                .chat-input-wrapper {
                    display: flex;
                    background: rgba(30, 41, 59, 0.7);
                    border-radius: 30px;
                    padding: 6px 6px 6px 14px;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    align-items: center;
                    gap: 8px;
                    transition: border-color 0.2s ease;
                }

                .chat-input-wrapper:focus-within {
                    border-color: #38bdf8;
                    box-shadow: 0 0 12px rgba(56, 189, 248, 0.2);
                }

                .chat-action-btn {
                    color: #94a3b8;
                    cursor: pointer;
                    font-size: 1.1rem;
                    padding: 4px 6px;
                    transition: color 0.2s ease;
                }

                .chat-action-btn:hover {
                    color: #38bdf8;
                }

                .chat-action-btn.recording {
                    color: #ef4444;
                    animation: micPulse 1.2s infinite;
                }

                @keyframes micPulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.2); }
                    100% { transform: scale(1); }
                }

                .chat-input-wrapper textarea {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: #f8fafc;
                    outline: none;
                    font-family: 'Montserrat', sans-serif;
                    font-size: 0.88rem;
                    resize: none;
                    rows: 1;
                    max-height: 120px;
                    line-height: 1.35;
                    padding: 4px 0;
                    margin: 0;
                    overflow-y: auto;
                    box-sizing: border-box;
                }

                .chat-input-wrapper textarea::placeholder {
                    color: #64748b;
                }

                .chat-send-btn {
                    width: 38px;
                    height: 38px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #0ea5e9, #0284c7);
                    color: #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    box-shadow: 0 0 10px rgba(14, 165, 233, 0.4);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
                }

                .chat-send-btn:hover, .chat-send-btn:active {
                    transform: scale(1.08);
                    background: linear-gradient(135deg, #38bdf8, #0369a1);
                    box-shadow: 0 0 16px rgba(56, 189, 248, 0.6);
                }

                .chat-send-btn i {
                    font-size: 0.95rem;
                    transform: translateX(1px);
                }

                .michatbot-dragging-active { user-select: none !important; -webkit-user-select: none !important; }

                /* Ver Detalle Popup Responsive Styles */
                #michatbot-detail-overlay {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.98);
                    z-index: 1000000000;
                    align-items: center;
                    justify-content: center;
                    flex-direction: column;
                    font-family: 'Montserrat', sans-serif;
                    box-sizing: border-box;
                    padding: 20px;
                }

                #close-michatbot-detail {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.15);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2rem;
                    line-height: 1;
                    cursor: pointer;
                    z-index: 1000000005;
                    transition: background 0.3s ease, transform 0.2s ease;
                    user-select: none;
                    -webkit-tap-highlight-color: transparent;
                }

                #close-michatbot-detail:hover, #close-michatbot-detail:active {
                    background: rgba(255, 255, 255, 0.3);
                    transform: scale(1.05);
                }

                #michatbot-detail-viewer-container {
                    width: 90%;
                    height: 60%;
                    max-width: 900px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto;
                    position: relative;
                }

                #michatbot-detail-name {
                    color: white;
                    margin-top: 24px;
                    font-size: clamp(1.4rem, 4vw, 2.2rem);
                    font-weight: 300;
                    letter-spacing: 3px;
                    text-transform: uppercase;
                    text-align: center;
                    width: 100%;
                    max-width: 90%;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    line-height: 1.3;
                }

                @media (max-width: 640px) {
                    #michatbot-detail-viewer-container {
                        height: 50%;
                        width: 95%;
                    }
                    #close-michatbot-detail {
                        top: 15px;
                        right: 15px;
                        width: 44px;
                        height: 44px;
                        font-size: 1.8rem;
                    }
                }
            </style>
        `);
    }

    if (!$('#companion-wrapper').length) {
        $('body').append(`
            <div id="companion-wrapper">
                <div id="michatbot-drag-handle" title="Desplazar"><i class="fas fa-arrows-alt"></i></div>
                <div id="michatbot-bubble"><span class="bubble-text">¡Hola!</span></div>
                <div id="michatbot-model-container" style="width: 100%; height: 100%;"></div>

                <div id="michatbot-menu">
                    <div class="michatbot-menu-item" id="michatbot-opt-chat"><i class="fas fa-comment-dots"></i> Chatear</div>
                    <div class="michatbot-menu-item" id="michatbot-opt-mute"></div>
                    <div class="michatbot-menu-item" id="michatbot-opt-play-duel"><i class="fas fa-gamepad"></i> Jugar</div>
                    <div class="michatbot-menu-item" id="michatbot-opt-play"><i class="fas fa-bolt"></i> Hora del duelo</div>
                    <div class="michatbot-menu-item" id="michatbot-opt-detail"><i class="fas fa-search-plus"></i> Ver Detalle</div>
                    <div id="michatbot-resize-control" style="padding: 10px 16px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; gap: 12px;">
                        <input type="range" id="michatbot-scale-slider" min="0.5" max="2.5" step="0.1" value="1.0" style="flex: 1; accent-color: #38bdf8;">
                    </div>
                </div>
            </div>
        `);
        window.botInstance.updateMuteUI();
        makeMichatbotDraggable();
    }

    if (!$('#michatbot-chat-container').length) {
        $('body').append(`
            <div id="michatbot-chat-container">
                <div class="chat-header">
                    <div class="chat-header-title">
                        <div class="chat-header-avatar"><i class="fas fa-robot"></i></div>
                        <div>
                            <h3 style="margin:0; font-size: 0.95rem; font-weight: 600; color: #f8fafc; letter-spacing: 0.5px;">VikingTCG</h3>
                            <div style="font-size: 0.72rem; color: #94a3b8; display: flex; align-items: center;">
                                En línea <span class="chat-status-indicator"></span>
                            </div>
                        </div>
                    </div>
                    <div class="chat-close-btn" id="close-michatbot-chat">&times;</div>
                </div>
                <div class="chat-messages" id="michatbot-chat-messages"></div>

                <div id="michatbot-image-preview-container">
                    <img id="michatbot-image-preview" src="" alt="Vista previa">
                    <span style="font-size: 0.78rem; color: #cbd5e1; flex: 1;">Imagen adjunta lista para enviar</span>
                    <i class="fas fa-times" id="michatbot-remove-image-btn" title="Quitar imagen"></i>
                </div>

                <div class="chat-footer">
                    <div class="chat-input-wrapper">
                        <input type="file" id="michatbot-file-input" accept="image/*" style="display: none;">
                        <div class="chat-action-btn" id="michatbot-btn-attach" title="Adjuntar imagen"><i class="fas fa-image"></i></div>
                        <div class="chat-action-btn" id="michatbot-btn-mic" title="Dictar por voz"><i class="fas fa-microphone"></i></div>
                        <textarea id="michatbot-chat-input" placeholder="Escribe tu mensaje..." rows="1" autocomplete="off"></textarea>
                        <div class="chat-send-btn" id="michatbot-chat-send"><i class="fas fa-paper-plane"></i></div>
                    </div>
                </div>
            </div>
        `);
    }

    if (!$('#michatbot-detail-overlay').length) {
        $('body').append(`
            <div id="michatbot-detail-overlay">
                <span id="close-michatbot-detail">&times;</span>
                <div id="michatbot-detail-viewer-container"></div>
                <h2 id="michatbot-detail-name">Nombre</h2>
            </div>
        `);
    }

    setupImageUploadAndVoiceHandlers();

    if (forceRefresh || !window.currentSpirit) {
        if (typeof _supabase !== 'undefined') {
            try {
                const isPublicSpace = window.location.pathname.includes('public.html') || !!window.currentStoreId;

                if (isPublicSpace && window.currentStoreId) {
                    const { data: userRow } = await _supabase.from('usuarios').select('selected_spirit_id').eq('id', window.currentStoreId).maybeSingle();
                    if (userRow?.selected_spirit_id) {
                        const { data: spirit } = await _supabase.from('spirits').select('*').eq('id', userRow.selected_spirit_id).maybeSingle();
                        if (spirit) window.currentSpirit = spirit;
                    }
                } else {
                    let sessionUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : null;
                    if (!sessionUser) { const stored = localStorage.getItem('tcg_session'); if (stored) sessionUser = JSON.parse(stored); }
                    if (sessionUser) {
                        const { data: userRow } = await _supabase.from('usuarios').select('selected_spirit_id').eq('id', sessionUser.id).maybeSingle();
                        if (userRow?.selected_spirit_id) {
                            const { data: spirit } = await _supabase.from('spirits').select('*').eq('id', userRow.selected_spirit_id).maybeSingle();
                            if (spirit) window.currentSpirit = spirit;
                        }
                    }
                }
                if (!window.currentSpirit) {
                    const { data } = await _supabase.from('spirits').select('*').eq('is_public', true).limit(1).maybeSingle();
                    if (data) window.currentSpirit = data;
                }
            } catch (e) {}
        }
        if (!window.currentSpirit) { setTimeout(() => initMichatbot(), 2000); return; }
    }

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
                disable-pan
                bounds="tight"
                interpolation-decay="200"
                auto-rotate-delay="0"
                rotation-speed="0.5"
                style="width: 100%; height: 100%; background-color: transparent;"
                oncontextmenu="return false;">
            </model-viewer>
        `);
    }

    const viewer = document.getElementById('michatbot-viewer');
    let touchStartTime = 0, startX_click, startY_click, isInteractingWithModel = false;
    if (viewer) {
        viewer.addEventListener('pointerdown', (e) => { touchStartTime = Date.now(); startX_click = e.clientX; startY_click = e.clientY; isInteractingWithModel = false; });
        viewer.addEventListener('pointermove', (e) => { if (startX_click === undefined) return; const dist = Math.sqrt(Math.pow(e.clientX - startX_click, 2) + Math.pow(e.clientY - startY_click, 2)); if (dist > 10) isInteractingWithModel = true; });
        viewer.addEventListener('click', (e) => { const touchDuration = Date.now() - touchStartTime; if (touchDuration < 300 && !isInteractingWithModel) { e.stopPropagation(); $('#michatbot-menu').fadeToggle(250); } });
    }

    $(document).off('click.michatbot').on('click.michatbot', function(e) { if (!$(e.target).closest('#companion-wrapper').length) { $('#michatbot-menu').fadeOut(250); } });

    $('#michatbot-opt-chat').off('click').on('click', function(e) {
        e.stopPropagation();
        openMichatbotChat();
    });

    $('#michatbot-opt-mute').off('click').on('click', function(e) { e.stopPropagation(); window.botInstance.toggleMute(); });
    $('#michatbot-opt-play').off('click').on('click', function(e) { e.stopPropagation(); window.location.href = 'play.html'; });

    // Handle "Jugar" button click with device auto-detection
    $('#michatbot-opt-play-duel').off('click').on('click', function(e) {
        e.stopPropagation();
        $('#michatbot-menu').fadeOut(250);
        const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            window.location.href = 'configDuelMobile.html';
        } else {
            window.location.href = 'configDuel.html';
        }
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
                interaction-prompt="none"
                camera-orbit="auto 75deg auto"
                field-of-view="auto"
                min-field-of-view="5deg"
                max-field-of-view="45deg"
                disable-zoom
                disable-pan
                bounds="tight"
                interpolation-decay="200"
                auto-rotate-delay="0"
                rotation-speed="0.5"
                style="width: 100%; height: 100%; background-color: transparent;"
                oncontextmenu="return false;">
            </model-viewer>
        `);
        $('#michatbot-detail-name').text(window.currentSpirit.name);
        $('#michatbot-detail-overlay').css('display', 'flex').hide().fadeIn(400);
        $('#michatbot-menu').fadeOut(250);
    });

    $('#michatbot-scale-slider').on('input', function() { window.botInstance.setScale($(this).val()); });

    $('#michatbot-chat-send').off('click').on('click', function() { handleSendAIChatMessage(); });
    $('#michatbot-chat-input').off('keydown input').on('keydown', function(e) {
        if (e.key === 'Enter' || e.keyCode === 13) {
            if (!e.shiftKey) {
                e.preventDefault();
                handleSendAIChatMessage();
            }
        }
    }).on('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
    $('#close-michatbot-chat').on('click', closeMichatbotChat);
    $('#close-michatbot-detail').on('click touchend', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $('#michatbot-detail-overlay').fadeOut(400);
    });

    setTimeout(checkAuctionStatusOnLoad, 3000);
}

function setupImageUploadAndVoiceHandlers() {
    $('#michatbot-btn-attach').off('click').on('click', function() {
        $('#michatbot-file-input').click();
    });

    $('#michatbot-file-input').off('change').on('change', function(e) {
        const file = e.target.files && e.target.files[0];
        if (file) handleSelectedImageFile(file);
    });

    $('#michatbot-remove-image-btn').off('click').on('click', function() {
        window.selectedChatImageBase64 = null;
        $('#michatbot-file-input').val('');
        $('#michatbot-image-preview-container').hide();
    });

    const $chatContainer = $('#michatbot-chat-container');
    $chatContainer.off('dragover dragenter').on('dragover dragenter', function(e) {
        e.preventDefault();
        e.stopPropagation();
    });

    $chatContainer.off('drop').on('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const files = e.originalEvent?.dataTransfer?.files;
        if (files && files.length > 0 && files[0].type.startsWith('image/')) {
            handleSelectedImageFile(files[0]);
        }
    });

    // Voice recognition setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        $('#michatbot-btn-mic').off('click').on('click', function() {
            const $micBtn = $(this);
            if ($micBtn.hasClass('recording')) {
                if (window.speechRecognitionInstance) window.speechRecognitionInstance.stop();
                return;
            }

            const rec = new SpeechRecognition();
            rec.lang = 'es-ES';
            rec.interimResults = false;
            rec.maxAlternatives = 1;

            rec.onstart = function() {
                $micBtn.addClass('recording');
                $('#michatbot-chat-input').attr('placeholder', 'Escuchando...');
            };

            rec.onresult = function(event) {
                const transcript = event.results[0][0].transcript;
                if (transcript) {
                    $('#michatbot-chat-input').val(transcript);
                }
            };

            rec.onerror = function() {
                $micBtn.removeClass('recording');
                $('#michatbot-chat-input').attr('placeholder', 'Escribe tu mensaje...');
            };

            rec.onend = function() {
                $micBtn.removeClass('recording');
                $('#michatbot-chat-input').attr('placeholder', 'Escribe tu mensaje...');
            };

            window.speechRecognitionInstance = rec;
            rec.start();
        });
    } else {
        $('#michatbot-btn-mic').hide();
    }
}

function handleSelectedImageFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        window.selectedChatImageBase64 = e.target.result;
        $('#michatbot-image-preview').attr('src', window.selectedChatImageBase64);
        $('#michatbot-image-preview-container').css('display', 'flex');
    };
    reader.readAsDataURL(file);
}

function checkIsAdminSession() {
    const isAdminPath = /admin|perfil|scanner|binders|inversiones|build|clientes|tracking/.test(window.location.pathname);
    if (!isAdminPath) return false;

    let user = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : null;
    if (!user) {
        const stored = localStorage.getItem('tcg_session');
        if (stored) {
            try { user = JSON.parse(stored); } catch (e) {}
        }
    }
    return !!user;
}

function getActiveStoreId() {
    const isPublicSpace = window.location.pathname.includes('public.html') || !!window.currentStoreId;
    if (isPublicSpace && window.currentStoreId) return window.currentStoreId;

    let user = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : null;
    if (!user) {
        const stored = localStorage.getItem('tcg_session');
        if (stored) {
            try { user = JSON.parse(stored); } catch (e) {}
        }
    }
    return user ? user.id : null;
}

async function handleSendAIChatMessage() {
    const $input = $('#michatbot-chat-input');
    const text = $input.val().trim();
    const imageBase64 = window.selectedChatImageBase64;

    if (!text && !imageBase64) return;

    addUserMessage(text, imageBase64);

    $input.val('');
    $input.css('height', 'auto');
    window.selectedChatImageBase64 = null;
    $('#michatbot-file-input').val('');
    $('#michatbot-image-preview-container').hide();

    const $c = $('#michatbot-chat-messages');
    const $loadingMsg = $('<div class="msg-bot-loading" id="michatbot-loading"><i class="fas fa-circle-notch fa-spin"></i> Procesando...</div>');
    $c.append($loadingMsg);
    $c.scrollTop($c[0].scrollHeight);

    const isAdmin = checkIsAdminSession();
    const targetStoreId = getActiveStoreId();

    try {
        if (typeof _supabase === 'undefined') {
            throw new Error("Conexión con la base de datos no disponible.");
        }

        const payload = {
            message: text,
            image_base64: imageBase64,
            is_admin: isAdmin,
            store_id: targetStoreId,
            conversation_history: window.botConversationHistory
        };

        const { data, error } = await _supabase.functions.invoke('spirit-chat', {
            body: payload
        });

        $('#michatbot-loading').remove();

        if (error) {
            console.error("Error Edge Function spirit-chat:", error);
            addBotMessage("Ocurrió un inconveniente al procesar tu solicitud. Intenta de nuevo en unos momentos.");
            return;
        }

        if (data && data.reply) {
            const cleanText = removeEmojis(data.reply);
            addBotMessage(formatMarkdownResponse(cleanText));
            window.botInstance.say(cleanText);

            // Update conversation history for multi-turn chat
            window.botConversationHistory.push({ role: "user", parts: [{ text }] });
            window.botConversationHistory.push({ role: "model", parts: [{ text: cleanText }] });

            // If an administrative creation/update happened, refresh page UI if functions exist
            if (isAdmin) {
                if (typeof loadAlbums === 'function') loadAlbums();
                if (typeof loadDecks === 'function') loadDecks();
                if (typeof loadProducts === 'function') loadProducts();
                if (typeof loadWishlist === 'function') loadWishlist();
            }
        } else if (data && data.error) {
            addBotMessage(removeEmojis(data.error));
        } else {
            addBotMessage("No recibí respuesta del servidor.");
        }
    } catch (err) {
        $('#michatbot-loading').remove();
        console.error("Error mandando mensaje a chatbot IA:", err);
        addBotMessage("Ocurrió un error al procesar tu mensaje.");
    }
}

function removeEmojis(str) {
    if (!str) return "";
    return str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
}

function formatMarkdownResponse(text) {
    if (!text) return "";

    let formatted = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\n\n/g, "<br><br>")
        .replace(/\n/g, "<br>");

    return formatted;
}

let cleanupMobileViewportEvents = null;

function openMichatbotChat() {
    const $container = $('#michatbot-chat-container');
    $container.css('display', 'flex').hide().fadeIn(300);
    $('#michatbot-menu').fadeOut(250);

    if ($('#michatbot-chat-messages').is(':empty')) {
        const spiritName = window.currentSpirit ? window.currentSpirit.name : "VikingTCG";
        addBotMessage(`¡Hola! Soy **${spiritName}**, ¿En qué te puedo ayudar hoy?`);
    }

    setupMobileViewportKeyboardHandling();
}

function closeMichatbotChat() {
    $('#michatbot-chat-container').fadeOut(250);
    resetMobileViewportChatLayout();
}

function setupMobileViewportKeyboardHandling() {
    const isMobile = window.innerWidth <= 640 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) return;

    const container = document.getElementById('michatbot-chat-container');
    const input = document.getElementById('michatbot-chat-input');
    if (!container) return;

    if (cleanupMobileViewportEvents) {
        cleanupMobileViewportEvents();
    }

    const updateLayout = () => {
        if (!container || $(container).is(':hidden')) return;

        if (window.visualViewport) {
            const viewport = window.visualViewport;
            container.style.position = 'fixed';
            container.style.top = viewport.offsetTop + 'px';
            container.style.left = viewport.offsetLeft + 'px';
            container.style.width = viewport.width + 'px';
            container.style.height = viewport.height + 'px';
            container.style.maxHeight = viewport.height + 'px';
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
        }

        const $c = $('#michatbot-chat-messages');
        if ($c.length) {
            $c.scrollTop($c[0].scrollHeight);
        }
    };

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', updateLayout);
        window.visualViewport.addEventListener('scroll', updateLayout);
    }

    const handleFocus = () => {
        setTimeout(updateLayout, 50);
        setTimeout(updateLayout, 200);
        setTimeout(updateLayout, 400);
    };

    if (input) {
        input.addEventListener('focus', handleFocus);
        input.addEventListener('click', handleFocus);
    }

    cleanupMobileViewportEvents = () => {
        if (window.visualViewport) {
            window.visualViewport.removeEventListener('resize', updateLayout);
            window.visualViewport.removeEventListener('scroll', updateLayout);
        }
        if (input) {
            input.removeEventListener('focus', handleFocus);
            input.removeEventListener('click', handleFocus);
        }
    };

    updateLayout();
}

function resetMobileViewportChatLayout() {
    if (cleanupMobileViewportEvents) {
        cleanupMobileViewportEvents();
        cleanupMobileViewportEvents = null;
    }
    const container = document.getElementById('michatbot-chat-container');
    if (container) {
        container.style.top = '';
        container.style.left = '';
        container.style.width = '';
        container.style.height = '';
        container.style.maxHeight = '';
    }
}

function addUserMessage(text, imageBase64 = null) {
    const $c = $('#michatbot-chat-messages');
    const $msg = $('<div class="msg-user"></div>');
    if (imageBase64) {
        $msg.append(`<img src="${imageBase64}" alt="Imagen enviada">`);
    }
    if (text) {
        $msg.append(document.createTextNode(text));
    }
    $c.append($msg);
    $c.scrollTop($c[0].scrollHeight);
}

function addBotMessage(htmlContent) {
    const $c = $('#michatbot-chat-messages');
    const $msg = $('<div class="msg-bot"></div>').html(htmlContent);
    $c.append($msg);
    $c.scrollTop($c[0].scrollHeight);
}

function makeMichatbotDraggable() {
    const w = document.getElementById('companion-wrapper');
    const h = document.getElementById('michatbot-drag-handle');
    if (!w || !h) return;

    let isDragging = false;
    let startX, startY, initX, initY;

    h.addEventListener('pointerdown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = w.getBoundingClientRect();
        initX = rect.left;
        initY = rect.top;
        h.setPointerCapture(e.pointerId);
        h.style.cursor = 'grabbing';
        $('body').addClass('michatbot-dragging-active');
        e.preventDefault();
    });

    window.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let nx = initX + dx;
        let ny = initY + dy;

        nx = Math.max(0, Math.min(window.innerWidth - w.offsetWidth, nx));
        ny = Math.max(0, Math.min(window.innerHeight - w.offsetHeight, ny));

        w.style.left = nx + 'px';
        w.style.top = ny + 'px';
        w.style.bottom = 'auto';
        w.style.right = 'auto';
        w.style.margin = '0';
    });

    window.addEventListener('pointerup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        h.style.cursor = 'grab';
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
        const isPublicSpace = window.location.pathname.includes('public.html') || !!window.currentStoreId;
        const oid = (isPublicSpace && window.currentStoreId) ? window.currentStoreId : ((typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : null);
        if (!oid) return;
        const { data: auctions } = await _supabase.from('subastas').select('id').eq('user_id', oid).eq('status', 'active');
        if (!auctions?.length) return;
        const ids = auctions.map(a => a.id);
        const { data: bids } = await _supabase.from('subastas_pujas').select('*').in('subasta_id', ids).eq('bidder_id', uid);
        if (!bids?.length) return;
        const topBids = {}; bids.forEach(b => { if(!topBids[b.subasta_id] || b.amount > topBids[b.subasta_id].amount) topBids[b.subasta_id] = b; });
        let win = 0, lose = 0;
        for (const aid of Object.keys(topBids)) { const { data: top } = await _supabase.from('subastas_pujas').select('amount').eq('subasta_id', aid).order('amount', { ascending: false }).limit(1).maybeSingle(); if (top?.amount === topBids[aid].amount) win++; else lose++; }
        if (win > 0 && lose === 0) window.botInstance.say(`Vas ganando en ${win} subasta(s)`); else if (lose > 0) window.botInstance.say(`Atención: Te han superado en ${lose} subasta(s)`);
    } catch (e) {}
}

$(document).ready(() => initMichatbot());
