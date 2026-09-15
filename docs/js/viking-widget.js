/**
 * viking-widget.js - Custom Label Web Components for VikingTCG
 * Allows users to embed VikingTCG widgets (such as <viking-chatbot>) on external domains.
 * Validates domain authorization against Supabase `widget_domains` table.
 */

(function () {
    const SUPABASE_URL = 'https://ehszvqwftqgxjggnbcmt.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInRefiI6ImVoc3p2cXdmdHFneGpnZ25iY210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NDI5MjAsImV4cCI6MjA4NTMxODkyMH0.wh8_Xy4_w9roFxMgbJ-J9A3r5V7duUjnStl4ZsZ0804';

    function cleanDomain(d) {
        if (!d) return '';
        return d.toLowerCase()
            .replace(/^https?:\/\//i, '')
            .replace(/^www\./i, '')
            .split('/')[0]
            .split(':')[0]
            .trim();
    }

    // Helper to dynamically load external scripts
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Helper to dynamically load external CSS
    function loadCSS(href) {
        if (document.querySelector(`link[href="${href}"]`)) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    }

    class VikingChatbotElement extends HTMLElement {
        constructor() {
            super();
            this.activeStoreId = null;
            this.currentSpirit = null;
            this.conversationHistory = [];
            this.selectedImageBase64 = null;
            this.isMuted = false;
            this.isVoiceEnabled = false;
        }

        async connectedCallback() {
            const rawDomain = this.getAttribute('domain') || window.location.hostname || '';
            const domain = cleanDomain(rawDomain);

            if (!domain) {
                console.warn('[VikingChatbot] No domain provided or detected.');
                return;
            }

            try {
                // Load dependencies
                if (typeof supabase === 'undefined') {
                    await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
                }
                if (!customElements.get('model-viewer')) {
                    const mvModule = document.createElement('script');
                    mvModule.type = 'module';
                    mvModule.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js';
                    document.head.appendChild(mvModule);
                }
                loadCSS('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css');
                loadCSS('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap');

                const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

                // Verify domain authorization in widget_domains table
                const { data: domains, error: domainErr } = await _supabase
                    .from('widget_domains')
                    .select('user_id, is_active, domain')
                    .eq('widget_type', 'chatbot')
                    .eq('is_active', true);

                if (domainErr || !domains || domains.length === 0) {
                    console.info('[VikingChatbot] Widget domain not active or not authorized:', domain);
                    return;
                }

                const matchedDomain = domains.find(d => cleanDomain(d.domain) === domain);

                if (!matchedDomain) {
                    console.info('[VikingChatbot] Domain does not match active authorized widgets:', domain);
                    return;
                }

                this.activeStoreId = matchedDomain.user_id;

                // Fetch target user store & spirit data
                const { data: userRow } = await _supabase
                    .from('usuarios')
                    .select('id, username, store_name, selected_spirit_id')
                    .eq('id', this.activeStoreId)
                    .maybeSingle();

                if (!userRow) return;

                this.storeName = userRow.store_name || userRow.username || 'VikingTCG';

                if (userRow.selected_spirit_id) {
                    const { data: spirit } = await _supabase
                        .from('spirits')
                        .select('*')
                        .eq('id', userRow.selected_spirit_id)
                        .maybeSingle();
                    if (spirit) this.currentSpirit = spirit;
                }

                if (!this.currentSpirit) {
                    const { data: defaultSpirit } = await _supabase
                        .from('spirits')
                        .select('*')
                        .eq('is_public', true)
                        .limit(1)
                        .maybeSingle();
                    if (defaultSpirit) this.currentSpirit = defaultSpirit;
                }

                this._supabase = _supabase;
                this.renderWidget();
            } catch (e) {
                console.error('[VikingChatbot] Initialization error:', e);
            }
        }

        renderWidget() {
            if (!this.currentSpirit) return;

            const spiritName = this.currentSpirit.name || 'VikingTCG';
            const gltfUrl = this.currentSpirit.gltf_url;

            this.innerHTML = `
                <style>
                    .viking-widget-container * { box-sizing: border-box; font-family: 'Montserrat', sans-serif; }
                    .viking-widget-fab {
                        position: fixed;
                        bottom: 20px;
                        right: 20px;
                        z-index: 99999990;
                        width: 110px;
                        height: 110px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: transparent;
                        transition: transform 0.2s ease;
                    }
                    .viking-widget-fab:hover { transform: scale(1.08); }
                    .viking-widget-bubble {
                        position: absolute;
                        bottom: 100%;
                        right: 0;
                        background: rgba(15, 23, 42, 0.95);
                        backdrop-filter: blur(12px);
                        color: #f1f5f9;
                        padding: 8px 16px;
                        border-radius: 18px;
                        font-size: 0.8rem;
                        font-weight: 600;
                        white-space: nowrap;
                        box-shadow: 0 10px 25px rgba(0,0,0,0.6), 0 0 12px rgba(56,189,248,0.3);
                        border: 1px solid rgba(56,189,248,0.4);
                        display: none;
                        margin-bottom: 8px;
                        z-index: 10;
                    }
                    .viking-widget-chat {
                        display: none;
                        position: fixed;
                        bottom: 25px;
                        right: 25px;
                        width: 380px;
                        height: 600px;
                        max-height: 85vh;
                        background: rgba(10, 15, 28, 0.95);
                        backdrop-filter: blur(25px);
                        border-radius: 24px;
                        box-shadow: 0 25px 80px rgba(0,0,0,0.85), 0 0 30px rgba(56,189,248,0.15);
                        z-index: 99999999;
                        border: 1px solid rgba(255,255,255,0.12);
                        flex-direction: column;
                        overflow: hidden;
                    }
                    @media (max-width: 640px) {
                        .viking-widget-chat {
                            bottom: 0 !important; right: 0 !important; left: 0 !important; top: 0 !important;
                            width: 100vw !important; height: 100dvh !important; max-height: 100dvh !important;
                            border-radius: 0 !important; border: none !important;
                        }
                    }
                    .vw-header {
                        padding: 14px 18px;
                        background: linear-gradient(180deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.5) 100%);
                        border-bottom: 1px solid rgba(255,255,255,0.08);
                        display: flex; justify-content: space-between; align-items: center;
                    }
                    .vw-title { display: flex; align-items: center; gap: 10px; }
                    .vw-title h4 { margin: 0; font-size: 0.92rem; color: #f8fafc; font-weight: 700; }
                    .vw-sub { font-size: 0.72rem; color: #38bdf8; display: flex; align-items: center; gap: 4px; }
                    .vw-dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 8px #22c55e; }
                    .vw-close { cursor: pointer; color: #94a3b8; font-size: 1.2rem; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.06); }
                    .vw-close:hover { color: #ef4444; background: rgba(239,68,68,0.2); }
                    .vw-stage {
                        width: 100%; height: 150px; position: relative;
                        background: radial-gradient(circle at center, rgba(56,189,248,0.2) 0%, rgba(15,23,42,0.8) 80%);
                        border-bottom: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;
                    }
                    .vw-messages {
                        flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;
                    }
                    .vw-messages::-webkit-scrollbar { width: 5px; }
                    .vw-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; }
                    .vw-msg-user {
                        align-self: flex-end; background: linear-gradient(135deg, #0284c7 0%, #4f46e5 100%);
                        color: #fff; padding: 10px 16px; border-radius: 18px 18px 4px 18px; max-width: 82%; font-size: 0.85rem; line-height: 1.4; word-break: break-word;
                    }
                    .vw-msg-bot {
                        align-self: flex-start; background: rgba(30,41,59,0.7); color: #f1f5f9; padding: 12px 16px;
                        border-radius: 18px 18px 18px 4px; max-width: 88%; font-size: 0.85rem; line-height: 1.45; word-break: break-word; border: 1px solid rgba(255,255,255,0.08);
                    }
                    .vw-msg-bot strong { color: #38bdf8; }
                    .vw-msg-loading {
                        align-self: flex-start; color: #38bdf8; font-size: 0.82rem; display: flex; align-items: center; gap: 8px;
                    }
                    .vw-footer { padding: 12px; background: rgba(15,23,42,0.95); border-top: 1px solid rgba(255,255,255,0.1); }
                    .vw-input-box {
                        display: flex; background: rgba(30,41,59,0.7); border-radius: 25px; padding: 4px 6px 4px 14px;
                        border: 1px solid rgba(255,255,255,0.12); align-items: center; gap: 6px;
                    }
                    .vw-input-box input {
                        flex: 1; background: transparent; border: none; color: #fff; outline: none; font-size: 0.85rem; padding: 6px 0;
                    }
                    .vw-send-btn {
                        width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #0ea5e9, #0284c7);
                        color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none;
                    }
                </style>

                <div class="viking-widget-container">
                    <!-- FAB 3D Avatar -->
                    <div class="viking-widget-fab" id="vw-fab" title="Hablar con ${spiritName}">
                        <div class="viking-widget-bubble" id="vw-bubble">¡Hola! ¿En qué puedo ayudarte?</div>
                        <model-viewer
                            src="${gltfUrl}"
                            auto-rotate
                            camera-controls
                            shadow-intensity="1"
                            exposure="1.1"
                            interaction-prompt="none"
                            disable-zoom
                            disable-pan
                            camera-orbit="auto 75deg auto"
                            style="width:100%; height:100%; background:transparent;">
                        </model-viewer>
                    </div>

                    <!-- Chat Modal -->
                    <div class="viking-widget-chat" id="vw-chat">
                        <div class="vw-header">
                            <div class="vw-title">
                                <i class="fas fa-robot" style="color: #38bdf8;"></i>
                                <div>
                                    <h4>${spiritName}</h4>
                                    <div class="vw-sub"><span class="vw-dot"></span> ${this.storeName}</div>
                                </div>
                            </div>
                            <div class="vw-close" id="vw-close">&times;</div>
                        </div>

                        <div class="vw-stage">
                            <model-viewer
                                src="${gltfUrl}"
                                auto-rotate
                                camera-controls
                                shadow-intensity="1"
                                exposure="1.1"
                                interaction-prompt="none"
                                disable-zoom
                                disable-pan
                                camera-orbit="auto 75deg auto"
                                style="width:100%; height:100%; background:transparent;">
                            </model-viewer>
                        </div>

                        <div class="vw-messages" id="vw-messages">
                            <div class="vw-msg-bot">¡Hola! Soy <strong>${spiritName}</strong>, el asistente virtual de <strong>${this.storeName}</strong>. ¿En qué te puedo ayudar hoy?</div>
                        </div>

                        <div class="vw-footer">
                            <div class="vw-input-box">
                                <input type="text" id="vw-input" placeholder="Escribe tu consulta..." autocomplete="off">
                                <button class="vw-send-btn" id="vw-send"><i class="fas fa-paper-plane"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            this.bindEvents();
        }

        bindEvents() {
            const fab = this.querySelector('#vw-fab');
            const chat = this.querySelector('#vw-chat');
            const close = this.querySelector('#vw-close');
            const sendBtn = this.querySelector('#vw-send');
            const input = this.querySelector('#vw-input');

            fab.addEventListener('click', () => {
                chat.style.display = 'flex';
            });

            close.addEventListener('click', () => {
                chat.style.display = 'none';
            });

            sendBtn.addEventListener('click', () => this.handleSendMessage());

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleSendMessage();
                }
            });
        }

        async handleSendMessage() {
            const input = this.querySelector('#vw-input');
            const text = input.value.trim();
            if (!text) return;

            input.value = '';

            const msgContainer = this.querySelector('#vw-messages');

            // User message
            const uMsg = document.createElement('div');
            uMsg.className = 'vw-msg-user';
            uMsg.textContent = text;
            msgContainer.appendChild(uMsg);

            // Loading message
            const lMsg = document.createElement('div');
            lMsg.className = 'vw-msg-loading';
            lMsg.id = 'vw-loading';
            lMsg.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Pensando...';
            msgContainer.appendChild(lMsg);
            msgContainer.scrollTop = msgContainer.scrollHeight;

            try {
                const { data, error } = await this._supabase.functions.invoke('spirit-chat', {
                    body: {
                        message: text,
                        is_admin: false,
                        store_id: this.activeStoreId,
                        conversation_history: this.conversationHistory
                    }
                });

                const loader = this.querySelector('#vw-loading');
                if (loader) loader.remove();

                if (error) {
                    throw error;
                }

                if (data && data.reply) {
                    const cleanReply = data.reply.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
                    const bMsg = document.createElement('div');
                    bMsg.className = 'vw-msg-bot';
                    bMsg.innerHTML = cleanReply
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/\n/g, '<br>');
                    msgContainer.appendChild(bMsg);

                    this.conversationHistory.push({ role: "user", parts: [{ text }] });
                    this.conversationHistory.push({ role: "model", parts: [{ text: cleanReply }] });
                } else {
                    const bMsg = document.createElement('div');
                    bMsg.className = 'vw-msg-bot';
                    bMsg.textContent = 'No recibí respuesta del servidor.';
                    msgContainer.appendChild(bMsg);
                }
            } catch (err) {
                const loader = this.querySelector('#vw-loading');
                if (loader) loader.remove();
                const errMsg = document.createElement('div');
                errMsg.className = 'vw-msg-bot';
                errMsg.textContent = 'Ocurrió un error al procesar tu solicitud.';
                msgContainer.appendChild(errMsg);
            }

            msgContainer.scrollTop = msgContainer.scrollHeight;
        }
    }

    if (!customElements.get('viking-chatbot')) {
        customElements.define('viking-chatbot', VikingChatbotElement);
    }
})();
