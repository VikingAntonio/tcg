/**
 * viking-widget.js - Custom Label Web Components for VikingTCG
 * Embeds the active 3D Spirit Companion and AI Chatbot on authorized client websites (<viking-chatbot domain="example.com">).
 * Validates domain authorization against Supabase `widget_domains` and `usuarios` tables.
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

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.crossOrigin = 'anonymous';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

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
            this.storeName = 'VikingTCG';
            this.conversationHistory = [];
            this.scale = 1.0;
        }

        async connectedCallback() {
            const rawDomain = this.getAttribute('domain') || window.location.hostname || '';
            const domain = cleanDomain(rawDomain);

            if (!domain) {
                console.warn('[VikingChatbot] No domain provided or detected.');
                return;
            }

            try {
                // Ensure dependencies loaded
                if (typeof window.supabase === 'undefined' && typeof window.createClient === 'undefined') {
                    await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
                }
                if (!customElements.get('model-viewer')) {
                    const mvModule = document.createElement('script');
                    mvModule.type = 'module';
                    mvModule.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js';
                    document.head.appendChild(mvModule);
                }
                loadCSS('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css');
                loadCSS('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');

                const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
                if (!supabaseClient) {
                    console.error('[VikingChatbot] Failed to initialize Supabase client.');
                    return;
                }
                this._supabase = supabaseClient;

                // Lookup active domain authorization
                const { data: domains } = await this._supabase
                    .from('widget_domains')
                    .select('user_id, is_active, domain')
                    .eq('is_active', true);

                let matchedUserId = null;
                if (domains && domains.length > 0) {
                    const found = domains.find(d => cleanDomain(d.domain) === domain);
                    if (found) matchedUserId = found.user_id;
                }

                // Fallback check against usuarios custom_domain
                if (!matchedUserId) {
                    const { data: usersWithDomain } = await this._supabase
                        .from('usuarios')
                        .select('id, custom_domain')
                        .not('custom_domain', 'is', null);

                    if (usersWithDomain && usersWithDomain.length > 0) {
                        const foundUser = usersWithDomain.find(u => cleanDomain(u.custom_domain) === domain);
                        if (foundUser) matchedUserId = foundUser.id;
                    }
                }

                if (!matchedUserId) {
                    console.info('[VikingChatbot] Widget domain not authorized or not active:', domain);
                    return;
                }

                this.activeStoreId = matchedUserId;

                // Fetch store owner and companion spirit details
                const { data: userRow } = await this._supabase
                    .from('usuarios')
                    .select('id, username, store_name, selected_spirit_id')
                    .eq('id', this.activeStoreId)
                    .maybeSingle();

                if (!userRow) return;

                this.storeName = userRow.store_name || userRow.username || 'VikingTCG';

                if (userRow.selected_spirit_id) {
                    const { data: spirit } = await this._supabase
                        .from('spirits')
                        .select('*')
                        .eq('id', userRow.selected_spirit_id)
                        .maybeSingle();
                    if (spirit) this.currentSpirit = spirit;
                }

                if (!this.currentSpirit) {
                    const { data: defaultSpirit } = await this._supabase
                        .from('spirits')
                        .select('*')
                        .eq('is_public', true)
                        .limit(1)
                        .maybeSingle();
                    if (defaultSpirit) this.currentSpirit = defaultSpirit;
                }

                this.renderWidget();
            } catch (e) {
                console.error('[VikingChatbot] Error during initialization:', e);
            }
        }

        renderWidget() {
            if (!this.currentSpirit) return;

            const spiritName = this.currentSpirit.name || 'VikingTCG';
            const gltfUrl = this.currentSpirit.gltf_url;

            this.innerHTML = `
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');

                    .vk-widget-root * { box-sizing: border-box; font-family: 'Montserrat', sans-serif; }

                    #vk-companion-wrapper {
                        position: fixed;
                        bottom: 20px;
                        left: 20px;
                        z-index: 99999990;
                        width: 150px;
                        height: 150px;
                        touch-action: none;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: transparent;
                    }

                    #vk-drag-handle {
                        position: absolute;
                        top: 8px;
                        left: 0;
                        background: rgba(15, 23, 42, 0.9);
                        color: #38bdf8;
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: grab;
                        z-index: 20;
                        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.6);
                        border: 1px solid rgba(56, 189, 248, 0.3);
                        font-size: 0.8rem;
                    }

                    #vk-bubble {
                        position: absolute;
                        bottom: 95%;
                        left: 50%;
                        transform: translateX(-50%);
                        background: rgba(15, 23, 42, 0.92);
                        backdrop-filter: blur(12px);
                        color: #f1f5f9;
                        padding: 8px 18px;
                        border-radius: 20px;
                        font-size: 0.8rem;
                        font-weight: 600;
                        min-width: 160px;
                        max-width: 280px;
                        text-align: center;
                        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.8), 0 0 15px rgba(56, 189, 248, 0.2);
                        display: none;
                        pointer-events: none;
                        z-index: 15;
                        border: 1px solid rgba(56, 189, 248, 0.3);
                    }

                    #vk-menu {
                        display: none;
                        position: absolute;
                        bottom: 100%;
                        left: 0;
                        background: rgba(15, 23, 42, 0.95);
                        backdrop-filter: blur(16px);
                        border-radius: 18px;
                        padding: 8px;
                        min-width: 200px;
                        border: 1px solid rgba(255, 255, 255, 0.15);
                        margin-bottom: 12px;
                        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.9);
                        z-index: 25;
                    }

                    .vk-menu-item {
                        color: #e2e8f0;
                        padding: 10px 14px;
                        cursor: pointer;
                        border-radius: 12px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        font-size: 0.8rem;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        transition: background 0.2s ease, color 0.2s ease;
                    }

                    .vk-menu-item:hover {
                        background: rgba(56, 189, 248, 0.18);
                        color: #38bdf8;
                    }

                    .vk-slider-box {
                        padding: 10px 14px;
                        border-top: 1px solid rgba(255, 255, 255, 0.08);
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }

                    .vk-slider-box input[type="range"] {
                        flex: 1;
                        accent-color: #38bdf8;
                        cursor: pointer;
                    }

                    #vk-chat-container {
                        display: none;
                        position: fixed;
                        bottom: 25px;
                        right: 25px;
                        width: 390px;
                        height: 600px;
                        max-height: 85vh;
                        background: rgba(10, 15, 28, 0.95);
                        backdrop-filter: blur(25px);
                        border-radius: 26px;
                        box-shadow: 0 25px 80px rgba(0, 0, 0, 0.85), 0 0 30px rgba(56, 189, 248, 0.12);
                        z-index: 99999999;
                        border: 1px solid rgba(255, 255, 255, 0.12);
                        flex-direction: column;
                        overflow: hidden;
                    }

                    @media (max-width: 640px) {
                        #vk-chat-container {
                            bottom: 0 !important; right: 0 !important; left: 0 !important; top: 0 !important;
                            width: 100vw !important; height: 100dvh !important; max-height: 100dvh !important;
                            border-radius: 0 !important; border: none !important;
                        }
                    }

                    .vk-chat-header {
                        padding: 14px 18px;
                        background: linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.5) 100%);
                        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }

                    .vk-chat-title { display: flex; align-items: center; gap: 10px; }
                    .vk-chat-title h4 { margin: 0; font-size: 0.92rem; font-weight: 700; color: #f8fafc; }
                    .vk-chat-sub { font-size: 0.72rem; color: #38bdf8; display: flex; align-items: center; gap: 6px; }
                    .vk-status-dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 8px #22c55e; }

                    .vk-chat-close {
                        cursor: pointer; width: 32px; height: 32px; border-radius: 50%;
                        background: rgba(255, 255, 255, 0.06); color: #94a3b8;
                        display: flex; align-items: center; justify-content: center; font-size: 1.1rem;
                    }
                    .vk-chat-close:hover { background: rgba(239, 68, 68, 0.2); color: #ef4444; }

                    #vk-gltf-stage {
                        width: 100%; height: 155px; position: relative;
                        background: radial-gradient(circle at center, rgba(56, 189, 248, 0.18) 0%, rgba(15, 23, 42, 0.75) 80%);
                        border-bottom: 1px solid rgba(255, 255, 255, 0.1); flex-shrink: 0;
                    }

                    .vk-chat-messages {
                        flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;
                    }
                    .vk-chat-messages::-webkit-scrollbar { width: 5px; }
                    .vk-chat-messages::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 10px; }

                    .vk-msg-user {
                        align-self: flex-end; background: linear-gradient(135deg, #0284c7 0%, #4f46e5 100%);
                        color: #ffffff; padding: 10px 16px; border-radius: 18px 18px 4px 18px; max-width: 82%; font-size: 0.85rem; line-height: 1.4; word-break: break-word;
                    }

                    .vk-msg-bot {
                        align-self: flex-start; background: rgba(30, 41, 59, 0.7); color: #f1f5f9; padding: 12px 16px;
                        border-radius: 18px 18px 18px 4px; max-width: 88%; font-size: 0.85rem; line-height: 1.45; word-break: break-word; border: 1px solid rgba(255, 255, 255, 0.08);
                    }
                    .vk-msg-bot strong { color: #38bdf8; }

                    .vk-msg-loading {
                        align-self: flex-start; color: #38bdf8; font-size: 0.82rem; display: flex; align-items: center; gap: 8px;
                    }

                    .vk-chat-footer {
                        padding: 12px; background: rgba(15, 23, 42, 0.95); border-top: 1px solid rgba(255, 255, 255, 0.1);
                    }

                    .vk-input-box {
                        display: flex; background: rgba(30, 41, 59, 0.7); border-radius: 25px; padding: 4px 6px 4px 14px;
                        border: 1px solid rgba(255, 255, 255, 0.12); align-items: center; gap: 6px;
                    }

                    .vk-input-box input {
                        flex: 1; background: transparent; border: none; color: #f8fafc; outline: none; font-size: 0.85rem; padding: 6px 0;
                    }

                    .vk-send-btn {
                        width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #0ea5e9, #0284c7);
                        color: #ffffff; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none;
                    }
                </style>

                <div class="vk-widget-root">
                    <!-- Floating 3D Companion Avatar -->
                    <div id="vk-companion-wrapper">
                        <div id="vk-drag-handle" title="Mover"><i class="fas fa-arrows-alt"></i></div>
                        <div id="vk-bubble"><span>¡Hola!</span></div>
                        <div id="vk-model-container" style="width: 100%; height: 100%;">
                            <model-viewer
                                id="vk-viewer"
                                src="${gltfUrl}"
                                auto-rotate
                                camera-controls
                                shadow-intensity="1"
                                exposure="1.1"
                                interaction-prompt="none"
                                disable-zoom
                                disable-pan
                                camera-orbit="auto 75deg auto"
                                style="width: 100%; height: 100%; background: transparent;">
                            </model-viewer>
                        </div>

                        <!-- Companion Popup Menu -->
                        <div id="vk-menu">
                            <div class="vk-menu-item" id="vk-opt-chat"><i class="fas fa-comment-dots"></i> Chatear</div>
                            <div class="vk-slider-box">
                                <i class="fas fa-search-plus" style="color: #38bdf8; font-size: 0.8rem;"></i>
                                <input type="range" id="vk-scale-slider" min="0.5" max="2.5" step="0.1" value="1.0">
                            </div>
                        </div>
                    </div>

                    <!-- Chat Overlay Modal -->
                    <div id="vk-chat-container">
                        <div class="vk-chat-header">
                            <div class="vk-chat-title">
                                <i class="fas fa-robot" style="color: #38bdf8;"></i>
                                <div>
                                    <h4>${spiritName}</h4>
                                    <div class="vk-chat-sub"><span class="vk-status-dot"></span> ${this.storeName}</div>
                                </div>
                            </div>
                            <div class="vk-chat-close" id="vk-chat-close">&times;</div>
                        </div>

                        <div id="vk-gltf-stage">
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
                                style="width: 100%; height: 100%; background: transparent;">
                            </model-viewer>
                        </div>

                        <div class="vk-chat-messages" id="vk-chat-messages">
                            <div class="vk-msg-bot">¡Hola! Soy <strong>${spiritName}</strong>, el asistente virtual de <strong>${this.storeName}</strong>. ¿En qué te puedo ayudar hoy?</div>
                        </div>

                        <div class="vk-chat-footer">
                            <div class="vk-input-box">
                                <input type="text" id="vk-chat-input" placeholder="Escribe tu consulta..." autocomplete="off">
                                <button class="vk-send-btn" id="vk-chat-send"><i class="fas fa-paper-plane"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            this.bindEvents();
            this.makeDraggable();
        }

        bindEvents() {
            const viewer = this.querySelector('#vk-viewer');
            const menu = this.querySelector('#vk-menu');
            const chatContainer = this.querySelector('#vk-chat-container');
            const chatClose = this.querySelector('#vk-chat-close');
            const optChat = this.querySelector('#vk-opt-chat');
            const slider = this.querySelector('#vk-scale-slider');
            const sendBtn = this.querySelector('#vk-chat-send');
            const input = this.querySelector('#vk-chat-input');

            let touchStartTime = 0;
            let startX, startY;
            let isMoved = false;

            if (viewer) {
                viewer.addEventListener('pointerdown', (e) => {
                    touchStartTime = Date.now();
                    startX = e.clientX;
                    startY = e.clientY;
                    isMoved = false;
                });

                viewer.addEventListener('pointermove', (e) => {
                    if (startX === undefined) return;
                    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
                    if (dist > 8) isMoved = true;
                });

                viewer.addEventListener('click', (e) => {
                    if (Date.now() - touchStartTime < 300 && !isMoved) {
                        e.stopPropagation();
                        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                    }
                });
            }

            document.addEventListener('click', (e) => {
                if (!this.contains(e.target)) {
                    if (menu) menu.style.display = 'none';
                }
            });

            optChat.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.style.display = 'none';
                chatContainer.style.display = 'flex';
            });

            chatClose.addEventListener('click', () => {
                chatContainer.style.display = 'none';
            });

            slider.addEventListener('input', (e) => {
                const scaleVal = parseFloat(e.target.value);
                const wrapper = this.querySelector('#vk-companion-wrapper');
                if (wrapper) {
                    const size = 150 * scaleVal;
                    wrapper.style.width = size + 'px';
                    wrapper.style.height = size + 'px';
                }
            });

            sendBtn.addEventListener('click', () => this.handleSendMessage());

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleSendMessage();
                }
            });
        }

        makeDraggable() {
            const wrapper = this.querySelector('#vk-companion-wrapper');
            const handle = this.querySelector('#vk-drag-handle');
            if (!wrapper || !handle) return;

            let isDragging = false;
            let startX, startY, initX, initY;

            handle.addEventListener('pointerdown', (e) => {
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                const rect = wrapper.getBoundingClientRect();
                initX = rect.left;
                initY = rect.top;
                handle.setPointerCapture(e.pointerId);
                handle.style.cursor = 'grabbing';
                e.preventDefault();
            });

            window.addEventListener('pointermove', (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                let nx = initX + dx;
                let ny = initY + dy;

                nx = Math.max(0, Math.min(window.innerWidth - wrapper.offsetWidth, nx));
                ny = Math.max(0, Math.min(window.innerHeight - wrapper.offsetHeight, ny));

                wrapper.style.left = nx + 'px';
                wrapper.style.top = ny + 'px';
                wrapper.style.bottom = 'auto';
                wrapper.style.right = 'auto';
            });

            window.addEventListener('pointerup', () => {
                if (!isDragging) return;
                isDragging = false;
                handle.style.cursor = 'grab';
            });
        }

        async handleSendMessage() {
            const input = this.querySelector('#vk-chat-input');
            const text = input.value.trim();
            if (!text) return;

            input.value = '';

            const msgContainer = this.querySelector('#vk-chat-messages');

            // Append user message
            const uMsg = document.createElement('div');
            uMsg.className = 'vk-msg-user';
            uMsg.textContent = text;
            msgContainer.appendChild(uMsg);

            // Append loading indicator
            const lMsg = document.createElement('div');
            lMsg.className = 'vk-msg-loading';
            lMsg.id = 'vk-loading';
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

                const loader = this.querySelector('#vk-loading');
                if (loader) loader.remove();

                if (error) throw error;

                if (data && data.reply) {
                    const cleanReply = data.reply.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
                    const bMsg = document.createElement('div');
                    bMsg.className = 'vk-msg-bot';
                    bMsg.innerHTML = cleanReply
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/\n/g, '<br>');
                    msgContainer.appendChild(bMsg);

                    this.conversationHistory.push({ role: "user", parts: [{ text }] });
                    this.conversationHistory.push({ role: "model", parts: [{ text: cleanReply }] });
                } else {
                    const bMsg = document.createElement('div');
                    bMsg.className = 'vk-msg-bot';
                    bMsg.textContent = 'No recibí respuesta del servidor.';
                    msgContainer.appendChild(bMsg);
                }
            } catch (err) {
                const loader = this.querySelector('#vk-loading');
                if (loader) loader.remove();
                const errMsg = document.createElement('div');
                errMsg.className = 'vk-msg-bot';
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
