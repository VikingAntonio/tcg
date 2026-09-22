/**
 * viking-widget.js - Custom Label Web Components for VikingTCG
 * Embeds the active 3D Spirit Companion and AI Chatbot on authorized client websites (<vikingdev-chatbot domain="example.com">).
 * Strictly loads the user's selected 3D Spirit Companion configured in admin.html and updates in real-time.
 */

(function () {
    const SUPABASE_URL = 'https://ehszvqwftqgxjggnbcmt.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoc3p2cXdmdHFneGpnZ25iY210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NDI5MjAsImV4cCI6MjA4NTMxODkyMH0.wh8_Xy4_w9roFxMgbJ-J9A3r5V7duUjnStl4ZsZ0804';
    const DEFAULT_GLTF_URL = 'https://ehszvqwftqgxjggnbcmt.supabase.co/storage/v1/object/public/spirits/models/1771399870010_984/wingedKuriboh.gltf';
    const DEFAULT_SPIRIT_NAME = 'Winged Kuriboh';

    function cleanDomain(d) {
        if (!d) return '';
        return d.toLowerCase()
            .replace(/^https?:\/\//i, '')
            .replace(/^www\./i, '')
            .split('/')[0]
            .split(':')[0]
            .trim();
    }

    function ensureHeadAssets() {
        if (!document.querySelector('link[href*="font-awesome"]')) {
            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
            document.head.appendChild(css);
        }
        if (!document.querySelector('link[href*="Montserrat"]')) {
            const font = document.createElement('link');
            font.rel = 'stylesheet';
            font.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap';
            document.head.appendChild(font);
        }
        if (!document.querySelector('script[src*="model-viewer"]')) {
            const mv = document.createElement('script');
            mv.type = 'module';
            mv.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js';
            document.head.appendChild(mv);
        }
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

    ensureHeadAssets();

    class VikingChatbotElement extends HTMLElement {
        constructor() {
            super();
            this.activeStoreId = null;
            this.selectedSpiritId = null;
            this.currentSpirit = { name: DEFAULT_SPIRIT_NAME, gltf_url: DEFAULT_GLTF_URL };
            this.storeName = 'VikingTCG';
            this.conversationHistory = [];
            this._realtimeChannel = null;
        }

        async connectedCallback() {
            const attrDomain = this.getAttribute('domain') || window.location.hostname || '';
            const targetDomain = cleanDomain(attrDomain);

            console.log('[VikingChatbot] Renderizando componente custom label para dominio:', targetDomain || '(local/preview)');

            // 1. Render base structure immediately with default fallback GLTF so model viewer is NEVER blank
            this.renderWidget();

            // 2. Asynchronously verify domain authorization and load user's selected 3D spirit
            await this.verifyAndFetchData(targetDomain);
        }

        disconnectedCallback() {
            if (this._realtimeChannel && this._supabase) {
                this._supabase.removeChannel(this._realtimeChannel);
            }
        }

        async verifyAndFetchData(targetDomain) {
            try {
                if (typeof window.supabase === 'undefined') {
                    await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
                }

                if (window.supabase) {
                    this._supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                }

                if (!this._supabase) return;

                let matchedUserId = null;
                let isDomainExplicitlyDisabled = false;

                // Check active session user first (for widgets.html / admin preview)
                let sessionUser = null;
                try {
                    const stored = localStorage.getItem('tcg_session');
                    if (stored) sessionUser = JSON.parse(stored);
                } catch(e) {}

                // Step A: Query widget_domains table
                if (targetDomain) {
                    try {
                        const { data: allDomains } = await this._supabase
                            .from('widget_domains')
                            .select('user_id, is_active, domain');

                        if (allDomains && allDomains.length > 0) {
                            const found = allDomains.find(d => cleanDomain(d.domain) === targetDomain);
                            if (found) {
                                if (!found.is_active) {
                                    isDomainExplicitlyDisabled = true;
                                } else {
                                    matchedUserId = found.user_id;
                                }
                            }
                        }
                    } catch (e) {
                        console.info('[VikingChatbot] widget_domains lookup error:', e);
                    }
                }

                // If explicitly turned off by admin in dominios.html, hide the widget
                if (isDomainExplicitlyDisabled) {
                    console.warn('[VikingChatbot] Widget DESACTIVADO por el administrador para:', targetDomain);
                    this.style.display = 'none';
                    return;
                }

                // Step B: Fallback check against usuarios custom_domain, store_name, or username
                if (!matchedUserId && targetDomain) {
                    try {
                        const { data: users } = await this._supabase
                            .from('usuarios')
                            .select('id, custom_domain, store_name, username');

                        if (users && users.length > 0) {
                            const foundUser = users.find(u => {
                                return (u.custom_domain && cleanDomain(u.custom_domain) === targetDomain) ||
                                       (u.store_name && cleanDomain(u.store_name) === targetDomain) ||
                                       (u.username && cleanDomain(u.username) === targetDomain);
                            });
                            if (foundUser) {
                                matchedUserId = foundUser.id;
                            }
                        }
                    } catch (e) {
                        console.info('[VikingChatbot] usuarios lookup error:', e);
                    }
                }

                // Step C: Fallback to logged-in session user if no domain match or testing in preview/widgets.html
                if (!matchedUserId && sessionUser?.id) {
                    matchedUserId = sessionUser.id;
                }

                if (matchedUserId) {
                    this.activeStoreId = matchedUserId;

                    // Fetch user details & active spirit selected by the user in admin.html
                    const { data: userRow } = await this._supabase
                        .from('usuarios')
                        .select('id, username, store_name, selected_spirit_id')
                        .eq('id', this.activeStoreId)
                        .maybeSingle();

                    if (userRow) {
                        this.storeName = userRow.store_name || userRow.username || 'VikingTCG';
                        this.selectedSpiritId = userRow.selected_spirit_id;

                        if (this.selectedSpiritId) {
                            await this.fetchSpiritById(this.selectedSpiritId);
                        } else {
                            // If user has not selected a spirit yet, fetch default public spirit
                            await this.fetchDefaultSpirit();
                        }

                        // Subscribe to real-time updates for user changes (e.g. changing spirit in admin.html)
                        this.subscribeToRealtimeUserChanges(matchedUserId);
                    }
                } else {
                    await this.fetchDefaultSpirit();
                }

                this.updateWidgetData();
            } catch (err) {
                console.error('[VikingChatbot] Error en verificación:', err);
            }
        }

        async fetchSpiritById(spiritId) {
            if (!spiritId || !this._supabase) return;
            const { data: spirit } = await this._supabase
                .from('spirits')
                .select('*')
                .eq('id', spiritId)
                .maybeSingle();

            if (spirit && spirit.gltf_url) {
                this.currentSpirit = spirit;
                console.log('[VikingChatbot] Personaje 3D seleccionado cargado:', spirit.name, spirit.gltf_url);
            }
        }

        async fetchDefaultSpirit() {
            if (!this._supabase) return;
            const { data: spirit } = await this._supabase
                .from('spirits')
                .select('*')
                .eq('is_public', true)
                .limit(1)
                .maybeSingle();

            if (spirit && spirit.gltf_url) {
                this.currentSpirit = spirit;
            }
        }

        subscribeToRealtimeUserChanges(userId) {
            if (!this._supabase || !userId) return;

            if (this._realtimeChannel) {
                this._supabase.removeChannel(this._realtimeChannel);
            }

            this._realtimeChannel = this._supabase
                .channel(`realtime-viking-widget-${userId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'usuarios',
                        filter: `id=eq.${userId}`
                    },
                    async (payload) => {
                        console.log('[VikingChatbot] Cambio detectado en usuario:', payload.new);
                        if (payload.new) {
                            if (payload.new.store_name) {
                                this.storeName = payload.new.store_name;
                            }
                            if (payload.new.selected_spirit_id !== this.selectedSpiritId) {
                                this.selectedSpiritId = payload.new.selected_spirit_id;
                                if (this.selectedSpiritId) {
                                    await this.fetchSpiritById(this.selectedSpiritId);
                                } else {
                                    await this.fetchDefaultSpirit();
                                }
                            }
                            this.updateWidgetData();
                        }
                    }
                )
                .subscribe();
        }

        updateWidgetData() {
            const spiritName = this.currentSpirit?.name || DEFAULT_SPIRIT_NAME;
            const gltfUrl = this.currentSpirit?.gltf_url || DEFAULT_GLTF_URL;

            const viewers = this.querySelectorAll('model-viewer');
            viewers.forEach(v => {
                if (gltfUrl && v.getAttribute('src') !== gltfUrl) {
                    v.setAttribute('src', gltfUrl);
                }
            });

            const storeEl = this.querySelector('#vk-store-name-label');
            if (storeEl) storeEl.textContent = this.storeName;

            const storeMsgEl = this.querySelector('#vk-store-name-msg-label');
            if (storeMsgEl) storeMsgEl.textContent = this.storeName;

            const spiritEls = this.querySelectorAll('.vk-spirit-name-label');
            spiritEls.forEach(el => el.textContent = spiritName);

            console.log('[VikingChatbot] Widget actualizado con personaje:', spiritName, '| Tienda:', this.storeName);
        }

        renderWidget() {
            const spiritName = this.currentSpirit?.name || DEFAULT_SPIRIT_NAME;
            const gltfUrl = this.currentSpirit?.gltf_url || DEFAULT_GLTF_URL;

            // Embedded SVG icons for guaranteed rendering regardless of external FontAwesome CSS loading
            const svgDrag = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>`;
            const svgChat = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
            const svgSearch = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`;
            const svgRobot = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="16" y1="16" x2="16.01" y2="16"/></svg>`;
            const svgSend = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
            const svgCloudUpload = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 3 16.3"/><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/></svg>`;

            this.innerHTML = `
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');

                    vikingdev-chatbot {
                        display: block !important;
                    }

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

                    #vk-model-container {
                        width: 100% !important;
                        height: 100% !important;
                        position: absolute !important;
                        top: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        bottom: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        overflow: hidden !important;
                    }

                    #vk-model-container model-viewer, #vk-gltf-stage model-viewer {
                        width: 100% !important;
                        height: 100% !important;
                        display: block !important;
                        margin: auto !important;
                        padding: 0 !important;
                        background: transparent !important;
                        cursor: pointer;
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
                        min-width: 190px;
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

                    /* Drag & Drop Overlay Animation Widget */
                    #vk-drop-overlay {
                        display: none;
                        position: absolute;
                        top: 10px;
                        left: 10px;
                        right: 10px;
                        bottom: 10px;
                        background: linear-gradient(135deg, rgba(14, 165, 233, 0.94), rgba(2, 132, 199, 0.94));
                        backdrop-filter: blur(8px);
                        -webkit-backdrop-filter: blur(8px);
                        border: 3px dashed rgba(255, 255, 255, 0.9);
                        border-radius: 20px;
                        z-index: 1000;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        color: #ffffff;
                        pointer-events: none;
                        box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6);
                        animation: vkDropPulse 1.4s infinite alternate ease-in-out;
                    }

                    @keyframes vkDropPulse {
                        from { border-color: rgba(255, 255, 255, 0.75); transform: scale(0.985); }
                        to { border-color: #ffffff; transform: scale(1); }
                    }

                    #vk-drop-overlay svg {
                        width: 60px;
                        height: 60px;
                        margin-bottom: 12px;
                        filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.35));
                    }

                    #vk-drop-overlay span {
                        font-size: 1.2rem;
                        font-weight: 700;
                        letter-spacing: 0.5px;
                        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
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
                        display: flex; align-items: center; justify-content: center; overflow: hidden;
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
                        width: 36px; height: 36px; border-radius: 50%; background: transparent;
                        color: #94a3b8; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none;
                        font-size: 1.1rem; transition: color 0.2s ease, transform 0.2s ease;
                    }
                    .vk-send-btn:hover, .vk-send-btn:active {
                        color: #38bdf8; transform: scale(1.1); background: transparent;
                    }
                </style>

                <div class="vk-widget-root">
                    <!-- Floating 3D Companion Avatar -->
                    <div id="vk-companion-wrapper">
                        <div id="vk-drag-handle" title="Mover">${svgDrag}</div>
                        <div id="vk-bubble"><span>¡Hola!</span></div>
                        <div id="vk-model-container">
                            <model-viewer
                                id="vk-viewer"
                                src="${gltfUrl}"
                                loading="eager"
                                auto-rotate
                                camera-controls
                                shadow-intensity="1"
                                environment-image="neutral"
                                exposure="1"
                                interaction-prompt="none"
                                camera-orbit="auto 75deg auto"
                                camera-target="auto auto auto"
                                field-of-view="auto"
                                min-field-of-view="5deg"
                                max-field-of-view="45deg"
                                disable-zoom
                                disable-pan
                                bounds="tight"
                                interpolation-decay="200"
                                auto-rotate-delay="0"
                                rotation-speed="0.5"
                                style="width: 100%; height: 100%; display: block; margin: auto; background: transparent;">
                            </model-viewer>
                        </div>

                        <!-- Companion Popup Menu -->
                        <div id="vk-menu">
                            <div class="vk-menu-item" id="vk-opt-chat">${svgChat} Chatear</div>
                            <div class="vk-slider-box">
                                <span style="color: #38bdf8; display: flex; align-items: center;">${svgSearch}</span>
                                <input type="range" id="vk-scale-slider" min="0.5" max="2.5" step="0.1" value="1.0" title="Tamaño del personaje">
                            </div>
                        </div>
                    </div>

                    <!-- Chat Overlay Modal -->
                    <div id="vk-chat-container">
                        <div id="vk-drop-overlay">
                            ${svgCloudUpload}
                            <span>Suelta tu imagen aquí</span>
                        </div>
                        <div class="vk-chat-header">
                            <div class="vk-chat-title">
                                ${svgRobot}
                                <div>
                                    <h4 class="vk-spirit-name-label">${spiritName}</h4>
                                    <div class="vk-chat-sub"><span class="vk-status-dot"></span> <span id="vk-store-name-label">${this.storeName}</span></div>
                                </div>
                            </div>
                            <div class="vk-chat-close" id="vk-chat-close">&times;</div>
                        </div>

                        <div id="vk-gltf-stage">
                            <model-viewer
                                src="${gltfUrl}"
                                loading="eager"
                                auto-rotate
                                camera-controls
                                shadow-intensity="1"
                                environment-image="neutral"
                                exposure="1.2"
                                interaction-prompt="none"
                                disable-zoom
                                disable-pan
                                camera-orbit="auto 75deg auto"
                                camera-target="auto auto auto"
                                field-of-view="auto"
                                bounds="tight"
                                style="width: 100%; height: 100%; display: block; margin: auto; background: transparent;">
                            </model-viewer>
                        </div>

                        <div class="vk-chat-messages" id="vk-chat-messages"></div>

                        <div class="vk-chat-footer">
                            <div class="vk-input-box">
                                <input type="text" id="vk-chat-input" placeholder="Escribe tu consulta..." autocomplete="off">
                                <button class="vk-send-btn" id="vk-chat-send">${svgSend}</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            this.bindEvents();
            this.makeDraggable();
        }

        bindEvents() {
            const modelContainer = this.querySelector('#vk-model-container');
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

            if (modelContainer) {
                modelContainer.addEventListener('pointerdown', (e) => {
                    if (e.target.closest('#vk-drag-handle')) return;
                    touchStartTime = Date.now();
                    startX = e.clientX;
                    startY = e.clientY;
                    isMoved = false;
                });

                modelContainer.addEventListener('pointermove', (e) => {
                    if (startX === undefined) return;
                    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
                    if (dist > 8) isMoved = true;
                });

                modelContainer.addEventListener('click', (e) => {
                    if (e.target.closest('#vk-drag-handle')) return;
                    if (Date.now() - touchStartTime < 400 && !isMoved) {
                        e.stopPropagation();
                        if (menu) {
                            menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
                        }
                    }
                });
            }

            document.addEventListener('click', (e) => {
                if (!this.contains(e.target)) {
                    if (menu) menu.style.display = 'none';
                }
            });

            if (optChat) {
                optChat.addEventListener('click', (e) => {
                    e.stopPropagation();
                    menu.style.display = 'none';
                    chatContainer.style.display = 'flex';
                });
            }

            if (chatClose) {
                chatClose.addEventListener('click', () => {
                    chatContainer.style.display = 'none';
                });
            }

            if (chatContainer) {
                let vkDragCounter = 0;
                const dropOverlay = this.querySelector('#vk-drop-overlay');

                chatContainer.addEventListener('dragenter', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    vkDragCounter++;
                    if (dropOverlay) dropOverlay.style.display = 'flex';
                });

                chatContainer.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });

                chatContainer.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    vkDragCounter--;
                    if (vkDragCounter <= 0) {
                        vkDragCounter = 0;
                        if (dropOverlay) dropOverlay.style.display = 'none';
                    }
                });

                chatContainer.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    vkDragCounter = 0;
                    if (dropOverlay) dropOverlay.style.display = 'none';

                    const files = e.dataTransfer?.files;
                    if (files && files.length > 0 && files[0].type.startsWith('image/')) {
                        const file = files[0];
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            this.pendingImageBase64 = ev.target.result;
                            this.showPendingImagePreview(this.pendingImageBase64);
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }

            if (slider) {
                slider.addEventListener('input', (e) => {
                    const scaleVal = parseFloat(e.target.value);
                    const wrapper = this.querySelector('#vk-companion-wrapper');
                    if (wrapper) {
                        const size = 150 * scaleVal;
                        wrapper.style.width = size + 'px';
                        wrapper.style.height = size + 'px';
                    }
                });
            }

            if (sendBtn) {
                sendBtn.addEventListener('click', () => this.handleSendMessage());
            }

            if (input) {
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.handleSendMessage();
                    }
                });
            }
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

        showPendingImagePreview(base64) {
            let prev = this.querySelector('#vk-image-preview-container');
            if (!prev) {
                const footer = this.querySelector('.vk-chat-footer');
                prev = document.createElement('div');
                prev.id = 'vk-image-preview-container';
                prev.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(15, 23, 42, 0.8); border-top: 1px solid rgba(255,255,255,0.08);';
                prev.innerHTML = `
                    <img id="vk-image-preview" src="${base64}" style="width: 42px; height: 42px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(56, 189, 248, 0.4);">
                    <span style="font-size: 0.75rem; color: #cbd5e1; flex: 1;">Imagen adjunta lista para enviar</span>
                    <span id="vk-remove-image-btn" style="color: #ef4444; cursor: pointer; font-size: 1.1rem; padding: 2px 6px;">&times;</span>
                `;
                footer.parentNode.insertBefore(prev, footer);
                prev.querySelector('#vk-remove-image-btn').addEventListener('click', () => {
                    this.pendingImageBase64 = null;
                    prev.remove();
                });
            } else {
                const img = prev.querySelector('#vk-image-preview');
                if (img) img.src = base64;
                prev.style.display = 'flex';
            }
        }

        async handleSendMessage() {
            const input = this.querySelector('#vk-chat-input');
            const text = input.value.trim();
            const imageBase64 = this.pendingImageBase64 || null;

            if (!text && !imageBase64) return;

            input.value = '';
            this.pendingImageBase64 = null;
            const prev = this.querySelector('#vk-image-preview-container');
            if (prev) prev.remove();

            const msgContainer = this.querySelector('#vk-chat-messages');

            // Append user message
            const uMsg = document.createElement('div');
            uMsg.className = 'vk-msg-user';
            if (imageBase64) {
                const imgEl = document.createElement('img');
                imgEl.src = imageBase64;
                imgEl.style.cssText = 'max-width: 100%; border-radius: 10px; margin-bottom: 6px; display: block;';
                uMsg.appendChild(imgEl);
            }
            if (text) {
                const txtEl = document.createTextNode(text);
                uMsg.appendChild(txtEl);
            }
            msgContainer.appendChild(uMsg);

            // Append loading indicator
            const lMsg = document.createElement('div');
            lMsg.className = 'vk-msg-loading';
            lMsg.id = 'vk-loading';
            lMsg.innerHTML = 'Pensando...';
            msgContainer.appendChild(lMsg);
            msgContainer.scrollTop = msgContainer.scrollHeight;

            try {
                if (!this._supabase) throw new Error('Supabase no disponible');

                const { data, error } = await this._supabase.functions.invoke('spirit-chat', {
                    body: {
                        message: text,
                        image_base64: imageBase64,
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

                    if (text) {
                        this.conversationHistory.push({ role: "user", parts: [{ text }] });
                        this.conversationHistory.push({ role: "model", parts: [{ text: cleanReply }] });
                    }
                    if (this.conversationHistory.length > 16) {
                        this.conversationHistory = this.conversationHistory.slice(-16);
                    }
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

    if (!customElements.get('vikingdev-chatbot')) {
        customElements.define('vikingdev-chatbot', VikingChatbotElement);
    }

    class VikingdevBinderElement extends HTMLElement {
        constructor() {
            super();
            this.activeStoreId = null;
            this.userIdentifier = null;
            this._supabase = null;
        }

        static get observedAttributes() {
            return ['domain', 'user', 'album-id', 'albumid'];
        }

        attributeChangedCallback(name, oldValue, newValue) {
            if (oldValue !== newValue && this.isConnected) {
                this.initBinder();
            }
        }

        async connectedCallback() {
            await this.initBinder();
        }

        async initBinder() {
            const attrDomain = this.getAttribute('domain') || window.location.hostname || '';
            const targetDomain = cleanDomain(attrDomain);
            const userAttr = this.getAttribute('user');
            const albumId = this.getAttribute('album-id') || this.getAttribute('albumid') || '';

            console.log('[VikingdevBinder] Inicializando binder custom label para dominio:', targetDomain, '| user:', userAttr, '| album:', albumId);

            if (typeof window.supabase === 'undefined') {
                await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
            }

            if (window.supabase && !this._supabase) {
                this._supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            }

            let matchedUserId = null;
            let userIdentifier = userAttr || null;
            let isDomainExplicitlyDisabled = false;

            let sessionUser = null;
            try {
                const stored = localStorage.getItem('tcg_session');
                if (stored) sessionUser = JSON.parse(stored);
            } catch(e) {}

            // Step A: Check explicit user attribute
            if (userAttr && this._supabase) {
                try {
                    const { data: userRow } = await this._supabase
                        .from('usuarios')
                        .select('id, username, store_name')
                        .or(`username.eq."${userAttr}",store_name.eq."${userAttr}",id.eq."${userAttr}"`)
                        .maybeSingle();

                    if (userRow) {
                        matchedUserId = userRow.id;
                        userIdentifier = userRow.store_name || userRow.username || userRow.id;
                    }
                } catch(e) {}
            }

            // Step B: Check domain authorization in widget_domains
            if (!matchedUserId && targetDomain && this._supabase) {
                try {
                    const { data: allDomains } = await this._supabase
                        .from('widget_domains')
                        .select('user_id, is_active, domain');

                    if (allDomains && allDomains.length > 0) {
                        const found = allDomains.find(d => cleanDomain(d.domain) === targetDomain);
                        if (found) {
                            if (!found.is_active) {
                                isDomainExplicitlyDisabled = true;
                            } else {
                                matchedUserId = found.user_id;
                            }
                        }
                    }
                } catch(e) {}
            }

            if (isDomainExplicitlyDisabled) {
                console.warn('[VikingdevBinder] Binder DESACTIVADO por el administrador para:', targetDomain);
                this.style.display = 'none';
                return;
            }

            // Step C: Fallback check against usuarios domain/store
            if (!matchedUserId && targetDomain && this._supabase) {
                try {
                    const { data: users } = await this._supabase
                        .from('usuarios')
                        .select('id, custom_domain, store_name, username');

                    if (users && users.length > 0) {
                        const foundUser = users.find(u => {
                            return (u.custom_domain && cleanDomain(u.custom_domain) === targetDomain) ||
                                   (u.store_name && cleanDomain(u.store_name) === targetDomain) ||
                                   (u.username && cleanDomain(u.username) === targetDomain);
                        });
                        if (foundUser) {
                            matchedUserId = foundUser.id;
                            userIdentifier = foundUser.store_name || foundUser.username;
                        }
                    }
                } catch(e) {}
            }

            // Step D: Fallback to active logged-in user
            if (!matchedUserId && sessionUser?.id) {
                matchedUserId = sessionUser.id;
                userIdentifier = sessionUser.store_name || sessionUser.username || sessionUser.id;
            }

            if (matchedUserId && !userIdentifier && this._supabase) {
                const { data: u } = await this._supabase.from('usuarios').select('username, store_name').eq('id', matchedUserId).maybeSingle();
                if (u) userIdentifier = u.store_name || u.username;
            }

            if (!userIdentifier) {
                userIdentifier = 'vikingtcg';
            }

            this.renderBinder(userIdentifier, albumId);
        }

        renderBinder(userIdentifier, albumId) {
            const baseUrl = 'https://vikingtcg.xyz/public.html';
            let embedUrl = `${baseUrl}?id=${encodeURIComponent(userIdentifier)}&view=albums&embed=true`;
            if (albumId) {
                embedUrl += `&albumId=${encodeURIComponent(albumId)}`;
            }

            this.innerHTML = `
                <style>
                    vikingdev-binder {
                        display: block !important;
                        width: 100%;
                        max-width: 1100px;
                        margin: 20px auto;
                        box-sizing: border-box;
                    }
                    .vk-binder-container {
                        position: relative;
                        width: 100%;
                        padding-bottom: 75%;
                        height: 0;
                        background: rgba(15, 23, 42, 0.85);
                        border-radius: 18px;
                        overflow: hidden;
                        border: 1px solid rgba(255, 255, 255, 0.12);
                        box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5);
                    }
                    @media (max-width: 640px) {
                        .vk-binder-container {
                            padding-bottom: 125%;
                        }
                    }
                    .vk-binder-iframe {
                        position: absolute;
                        top: 0; left: 0; width: 100%; height: 100%;
                        border: none; background: transparent;
                    }
                    .vk-binder-badge {
                        display: flex; align-items: center; justify-content: center; gap: 6px;
                        text-align: center; margin-top: 10px; font-family: 'Montserrat', sans-serif;
                        font-size: 0.72rem; color: #94a3b8; text-decoration: none;
                        font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
                        transition: color 0.2s ease;
                    }
                    .vk-binder-badge:hover { color: #38bdf8; }
                </style>
                <div class="vk-binder-container">
                    <iframe class="vk-binder-iframe" src="${embedUrl}" allow="gyroscope; accelerometer" allowtransparency="true"></iframe>
                </div>
                <a href="https://vikingtcg.xyz" target="_blank" class="vk-binder-badge">Powered by VikingTCG Binders</a>
            `;
        }
    }

    if (!customElements.get('vikingdev-binder')) {
        customElements.define('vikingdev-binder', VikingdevBinderElement);
    }

    class VikingdevSubastasElement extends HTMLElement {
        constructor() {
            super();
            this.activeStoreId = null;
            this.userIdentifier = null;
            this.currentUser = null;
            this._supabase = null;
            this._realtimeChannel = null;
            this.auctionsMap = {};
            this.auctionTimers = {};
            this.currentFilter = 'active';
            this.activeModalAuctionId = null;
        }

        static get observedAttributes() {
            return ['domain', 'user', 'auction-id', 'auctionid'];
        }

        attributeChangedCallback(name, oldValue, newValue) {
            if (oldValue !== newValue && this.isConnected) {
                this.initSubastas();
            }
        }

        async connectedCallback() {
            await this.initSubastas();
        }

        disconnectedCallback() {
            if (this._realtimeChannel && this._supabase) {
                this._supabase.removeChannel(this._realtimeChannel);
            }
            Object.values(this.auctionTimers).forEach(t => clearInterval(t));
        }

        async initSubastas() {
            const attrDomain = this.getAttribute('domain') || window.location.hostname || '';
            const targetDomain = cleanDomain(attrDomain);
            const userAttr = this.getAttribute('user');
            const targetAuctionId = this.getAttribute('auction-id') || this.getAttribute('auctionid') || '';

            console.log('[VikingdevSubastas] Inicializando componente nativo subastas para dominio:', targetDomain, '| user:', userAttr);

            if (typeof window.supabase === 'undefined') {
                await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
            }

            if (window.supabase && !this._supabase) {
                this._supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            }

            if (!this._supabase) return;

            // Detect logged-in VikingTCG session user automatically
            await this.detectCurrentUserSession();

            let matchedUserId = null;
            let userIdentifier = userAttr || null;
            let isDomainExplicitlyDisabled = false;

            // Step A: Check explicit user attribute
            if (userAttr && this._supabase) {
                try {
                    const { data: userRow } = await this._supabase
                        .from('usuarios')
                        .select('id, username, store_name')
                        .or(`username.eq."${userAttr}",store_name.eq."${userAttr}",id.eq."${userAttr}"`)
                        .maybeSingle();

                    if (userRow) {
                        matchedUserId = userRow.id;
                        userIdentifier = userRow.store_name || userRow.username || userRow.id;
                    }
                } catch(e) {}
            }

            // Step B: Check domain authorization in widget_domains
            if (!matchedUserId && targetDomain && this._supabase) {
                try {
                    const { data: allDomains } = await this._supabase
                        .from('widget_domains')
                        .select('user_id, is_active, domain');

                    if (allDomains && allDomains.length > 0) {
                        const found = allDomains.find(d => cleanDomain(d.domain) === targetDomain);
                        if (found) {
                            if (!found.is_active) {
                                isDomainExplicitlyDisabled = true;
                            } else {
                                matchedUserId = found.user_id;
                            }
                        }
                    }
                } catch(e) {}
            }

            if (isDomainExplicitlyDisabled) {
                console.warn('[VikingdevSubastas] Subastas DESACTIVADAS por el administrador para:', targetDomain);
                this.style.display = 'none';
                return;
            }

            // Step C: Fallback check against usuarios custom_domain/store
            if (!matchedUserId && targetDomain && this._supabase) {
                try {
                    const { data: users } = await this._supabase
                        .from('usuarios')
                        .select('id, custom_domain, store_name, username');

                    if (users && users.length > 0) {
                        const foundUser = users.find(u => {
                            return (u.custom_domain && cleanDomain(u.custom_domain) === targetDomain) ||
                                   (u.store_name && cleanDomain(u.store_name) === targetDomain) ||
                                   (u.username && cleanDomain(u.username) === targetDomain);
                        });
                        if (foundUser) {
                            matchedUserId = foundUser.id;
                            userIdentifier = foundUser.store_name || foundUser.username;
                        }
                    }
                } catch(e) {}
            }

            // Step D: Fallback to active logged-in user
            if (!matchedUserId && this.currentUser?.id) {
                matchedUserId = this.currentUser.id;
                userIdentifier = this.currentUser.store_name || this.currentUser.username || this.currentUser.id;
            }

            this.activeStoreId = matchedUserId;
            this.userIdentifier = userIdentifier || 'vikingtcg';

            // Render native layout directly in this element
            this.renderNativeLayout();
            this.bindNativeEvents();

            // Load auctions from database
            await this.loadAuctions(targetAuctionId);

            // Subscribe to real-time updates
            if (this.activeStoreId) {
                this.subscribeToRealtime(this.activeStoreId);
            }
        }

        async detectCurrentUserSession() {
            try {
                let detectedUserId = null;

                // 1. Check localStorage for tcg_session or Supabase auth tokens
                const stored = localStorage.getItem('tcg_session');
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        if (parsed?.id) {
                            detectedUserId = parsed.id;
                            this.currentUser = parsed;
                        }
                    } catch(e) {}
                }

                if (!detectedUserId) {
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && (key.startsWith('sb-') || key.includes('supabase.auth.token'))) {
                            try {
                                const val = JSON.parse(localStorage.getItem(key));
                                const uid = val?.user?.id || val?.currentSession?.user?.id;
                                if (uid) {
                                    detectedUserId = uid;
                                    break;
                                }
                            } catch(e) {}
                        }
                    }
                }

                // 2. Check Supabase client auth session
                if (this._supabase) {
                    const { data: { session } } = await this._supabase.auth.getSession();
                    if (session?.user?.id) {
                        detectedUserId = session.user.id;
                    }
                }

                if (detectedUserId && this._supabase) {
                    const { data: user } = await this._supabase
                        .from('usuarios')
                        .select('id, username, store_name, store_logo, is_store, role, whatsapp_link, messenger_link, auction_reset_date, monthly_created_count, monthly_bid_count')
                        .eq('id', detectedUserId)
                        .maybeSingle();

                    if (user) {
                        this.currentUser = user;
                        localStorage.setItem('tcg_session', JSON.stringify(user));
                    }
                }
            } catch (err) {
                console.info('[VikingdevSubastas] Error detectando sesión de usuario:', err);
            }
        }

        renderNativeLayout() {
            this.innerHTML = `
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap');

                    vikingdev-subastas {
                        display: block !important;
                        width: 100%;
                        max-width: 1200px;
                        margin: 20px auto;
                        box-sizing: border-box;
                        font-family: 'Montserrat', sans-serif;
                        color: #ffffff;
                    }

                    .vk-subastas-root {
                        width: 100%;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }

                    .vk-tabs-container {
                        display: flex;
                        gap: 12px;
                        background: rgba(15, 23, 42, 0.8);
                        padding: 8px 12px;
                        border-radius: 50px;
                        border: 1px solid rgba(255, 255, 255, 0.12);
                        margin-bottom: 25px;
                        backdrop-filter: blur(12px);
                    }

                    .vk-tab-pill {
                        background: transparent;
                        border: none;
                        color: #94a3b8;
                        padding: 10px 24px;
                        border-radius: 50px;
                        font-weight: 800;
                        font-size: 0.88rem;
                        cursor: pointer;
                        transition: all 0.25s ease;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }

                    .vk-tab-pill:hover {
                        color: #ffffff;
                        background: rgba(255, 255, 255, 0.06);
                    }

                    .vk-tab-pill.active {
                        background: linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%);
                        color: #ffffff;
                        box-shadow: 0 4px 15px rgba(0, 210, 255, 0.35);
                    }

                    .vk-auction-grid {
                        width: 100%;
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                        gap: 20px;
                    }

                    .vk-auction-card {
                        background: rgba(15, 23, 42, 0.85);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 18px;
                        overflow: hidden;
                        position: relative;
                        aspect-ratio: 1 / 1.25;
                        transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), border-color 0.3s ease;
                        cursor: pointer;
                        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
                    }

                    .vk-auction-card:hover {
                        transform: translateY(-6px) scale(1.02);
                        border-color: #00d2ff;
                        box-shadow: 0 15px 35px rgba(0, 210, 255, 0.25);
                    }

                    .vk-auction-card.status-ended img {
                        filter: grayscale(1) opacity(0.65);
                    }

                    .vk-auction-img-wrapper {
                        width: 100%;
                        height: 100%;
                        background: #000000;
                        position: relative;
                    }

                    .vk-auction-img-wrapper img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }

                    .vk-auction-bid-badge {
                        position: absolute;
                        bottom: 12px;
                        right: 12px;
                        background: rgba(255, 107, 107, 0.95);
                        color: #ffffff;
                        padding: 6px 14px;
                        border-radius: 14px;
                        font-size: 1.05rem;
                        font-weight: 900;
                        backdrop-filter: blur(8px);
                        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
                        z-index: 5;
                    }

                    .vk-auction-overlay {
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        width: 100%;
                        padding: 45px 14px 14px 14px;
                        background: linear-gradient(transparent, rgba(15, 23, 42, 0.95) 60%);
                        pointer-events: none;
                        display: flex;
                        flex-direction: column;
                        justify-content: flex-end;
                    }

                    .vk-auction-footer-info {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                        width: 100%;
                    }

                    .vk-auction-timer {
                        color: #ffffff;
                        font-size: 0.92rem;
                        font-weight: 800;
                    }

                    .vk-auction-bidder-info {
                        display: flex;
                        flex-direction: column;
                        align-items: flex-end;
                        font-size: 0.85rem;
                        color: #f1f5f9;
                        font-weight: 800;
                    }

                    .vk-auction-bidder-info .bidder-name {
                        font-size: 0.68rem;
                        color: #94a3b8;
                        text-transform: uppercase;
                        font-weight: 700;
                    }

                    .vk-ended-seal {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%) rotate(-20deg);
                        border: 4px solid #ef4444;
                        color: #ef4444;
                        padding: 8px 18px;
                        font-size: 1.8rem;
                        font-weight: 900;
                        text-transform: uppercase;
                        border-radius: 14px;
                        background: rgba(15, 23, 42, 0.92);
                        z-index: 10;
                        pointer-events: none;
                        box-shadow: 0 0 20px rgba(0,0,0,0.6);
                    }

                    /* Auction Detail Modal */
                    .vk-modal-overlay {
                        display: none;
                        position: fixed;
                        top: 0; left: 0; width: 100vw; height: 100vh;
                        background: rgba(11, 15, 25, 0.85);
                        backdrop-filter: blur(16px);
                        z-index: 99999999;
                        align-items: center;
                        justify-content: center;
                        padding: 20px;
                        box-sizing: border-box;
                    }

                    .vk-modal-overlay.active {
                        display: flex;
                    }

                    .vk-modal-card {
                        background: #ffffff;
                        color: #1e293b;
                        max-width: 900px;
                        width: 100%;
                        border-radius: 28px;
                        padding: 28px;
                        position: relative;
                        max-height: 90vh;
                        overflow-y: auto;
                        box-shadow: 0 25px 80px rgba(0,0,0,0.6);
                    }

                    .vk-modal-close {
                        position: absolute;
                        top: 18px;
                        right: 22px;
                        font-size: 2rem;
                        color: #64748b;
                        cursor: pointer;
                        line-height: 1;
                        transition: color 0.2s;
                    }

                    .vk-modal-close:hover {
                        color: #ef4444;
                    }

                    .vk-bidding-layout {
                        display: grid;
                        grid-template-columns: 1fr 1.2fr;
                        gap: 25px;
                        margin-top: 10px;
                    }

                    @media (max-width: 768px) {
                        .vk-bidding-layout { grid-template-columns: 1fr; }
                    }

                    .vk-modal-media img {
                        width: 100%;
                        height: 320px;
                        object-fit: contain;
                        background: #0f172a;
                        border-radius: 18px;
                    }

                    .vk-modal-timer {
                        text-align: center;
                        margin-top: 14px;
                        font-size: 1.3rem;
                        font-weight: 800;
                        color: #38bdf8;
                    }

                    .vk-bid-info-box {
                        background: #f8fafc;
                        border-radius: 18px;
                        padding: 16px 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border: 1px solid #e2e8f0;
                        margin-bottom: 16px;
                    }

                    .vk-current-bid-val {
                        color: #ef4444;
                        font-size: 2.5rem;
                        font-weight: 900;
                    }

                    .vk-quick-grid {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 10px;
                        margin-bottom: 14px;
                    }

                    .vk-btn-bid-pill {
                        background: #bae6fd;
                        color: #0369a1;
                        border: 2px solid #38bdf8;
                        padding: 12px;
                        border-radius: 16px;
                        font-weight: 900;
                        font-size: 1.05rem;
                        cursor: pointer;
                        transition: all 0.2s;
                    }

                    .vk-btn-bid-pill:hover {
                        background: #38bdf8;
                        color: #ffffff;
                        transform: translateY(-2px);
                    }

                    .vk-free-bid-input {
                        width: 100%;
                        background: #f1f5f9;
                        border: 2px solid #cbd5e1;
                        padding: 14px;
                        border-radius: 16px;
                        font-weight: 800;
                        font-size: 1.1rem;
                        text-align: center;
                        outline: none;
                        box-sizing: border-box;
                    }

                    .vk-free-bid-input:focus {
                        border-color: #38bdf8;
                        background: #ffffff;
                    }

                    .vk-btn-place-bid {
                        width: 100%;
                        background: linear-gradient(135deg, #0284c7 0%, #4f46e5 100%);
                        color: #ffffff;
                        border: none;
                        padding: 16px;
                        border-radius: 18px;
                        font-size: 1.2rem;
                        font-weight: 900;
                        cursor: pointer;
                        margin-top: 14px;
                        transition: transform 0.2s, box-shadow 0.2s;
                        box-shadow: 0 10px 25px rgba(2, 132, 199, 0.3);
                    }

                    .vk-btn-place-bid:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 15px 35px rgba(2, 132, 199, 0.45);
                    }

                    .vk-bidders-list {
                        margin-top: 20px;
                    }

                    .vk-bidder-item {
                        display: flex;
                        justify-content: space-between;
                        padding: 10px 14px;
                        border-radius: 10px;
                        margin-bottom: 6px;
                        background: #f1f5f9;
                        font-size: 0.88rem;
                        font-weight: 700;
                    }

                    .vk-bidder-item.winner {
                        background: #dcfce7;
                        border: 2px solid #22c55e;
                        color: #15803d;
                    }
                </style>

                <div class="vk-subastas-root">
                    <div class="vk-tabs-container">
                        <button class="vk-tab-pill active" id="vk-tab-active">Activas</button>
                        <button class="vk-tab-pill" id="vk-tab-finished">Finalizadas</button>
                    </div>

                    <div class="vk-auction-grid" id="vk-auction-grid">
                        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #94a3b8;">
                            <i class="fas fa-spinner fa-spin"></i> Cargando subastas...
                        </div>
                    </div>

                    <!-- Detail Modal -->
                    <div class="vk-modal-overlay" id="vk-modal-overlay">
                        <div class="vk-modal-card">
                            <span class="vk-modal-close" id="vk-modal-close">&times;</span>
                            <div class="vk-bidding-layout">
                                <div class="vk-modal-media">
                                    <img id="vk-modal-img" src="" alt="Auction Image">
                                    <div class="vk-modal-timer" id="vk-modal-timer">--:--:--</div>
                                </div>
                                <div>
                                    <h2 id="vk-modal-title" style="margin: 0 0 8px 0; font-size: 1.5rem; font-weight: 900; color: #0f172a;">-</h2>
                                    <p id="vk-modal-desc" style="font-size: 0.88rem; color: #64748b; margin-bottom: 18px; white-space: pre-wrap;"></p>

                                    <div class="vk-bid-info-box">
                                        <div>
                                            <div style="font-size: 0.7rem; font-weight: 800; color: #64748b; text-transform: uppercase;">Puja Actual</div>
                                            <div class="vk-current-bid-val" id="vk-modal-current-bid">$0.00</div>
                                        </div>
                                        <div style="text-align: right;">
                                            <div style="font-size: 0.7rem; font-weight: 800; color: #64748b; text-transform: uppercase;">Base</div>
                                            <div style="font-weight: 800; font-size: 1.1rem; color: #0f172a;" id="vk-modal-start-bid">$0.00</div>
                                        </div>
                                    </div>

                                    <div id="vk-modal-bid-controls">
                                        <div class="vk-quick-grid" id="vk-quick-bid-container"></div>
                                        <input type="number" id="vk-input-bid-amount" class="vk-free-bid-input" placeholder="Ingresa tu puja ($)" step="1">
                                        <button class="vk-btn-place-bid" id="vk-btn-submit-bid">Realizar Puja</button>
                                    </div>

                                    <div class="vk-bidders-list">
                                        <h4 style="margin: 0 0 10px 0; font-size: 0.8rem; text-transform: uppercase; color: #64748b;">Historial de Pujas</h4>
                                        <div id="vk-modal-bidders-list"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        bindNativeEvents() {
            const btnActive = this.querySelector('#vk-tab-active');
            const btnFinished = this.querySelector('#vk-tab-finished');
            const modalOverlay = this.querySelector('#vk-modal-overlay');
            const modalClose = this.querySelector('#vk-modal-close');
            const submitBidBtn = this.querySelector('#vk-btn-submit-bid');
            const freeBidInput = this.querySelector('#vk-input-bid-amount');

            if (btnActive) {
                btnActive.addEventListener('click', () => {
                    btnActive.classList.add('active');
                    btnFinished?.classList.remove('active');
                    this.currentFilter = 'active';
                    this.renderGrid();
                });
            }

            if (btnFinished) {
                btnFinished.addEventListener('click', () => {
                    btnFinished.classList.add('active');
                    btnActive?.classList.remove('active');
                    this.currentFilter = 'finished';
                    this.renderGrid();
                });
            }

            if (modalClose) {
                modalClose.addEventListener('click', () => {
                    modalOverlay?.classList.remove('active');
                    this.activeModalAuctionId = null;
                });
            }

            if (modalOverlay) {
                modalOverlay.addEventListener('click', (e) => {
                    if (e.target === modalOverlay) {
                        modalOverlay.classList.remove('active');
                        this.activeModalAuctionId = null;
                    }
                });
            }

            if (submitBidBtn) {
                submitBidBtn.addEventListener('click', () => {
                    this.handlePlaceBid();
                });
            }

            if (freeBidInput) {
                freeBidInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.handlePlaceBid();
                    }
                });
            }
        }

        async loadAuctions(targetAuctionId) {
            if (!this._supabase) return;

            this.auctionsMap = this.auctionsMap || {};

            try {
                let query = this._supabase
                    .from('subastas')
                    .select(`
                        *,
                        subastas_pujas (
                            amount,
                            bidder_name,
                            bidder_id,
                            created_at
                        )
                    `)
                    .eq('is_live', true)
                    .order('end_date', { ascending: true });

                if (this.activeStoreId) {
                    query = query.eq('user_id', this.activeStoreId);
                }

                if (targetAuctionId) {
                    query = query.eq('id', targetAuctionId);
                }

                const { data, error } = await query;

                if (error) throw error;

                this.auctionsMap = {};
                if (data && Array.isArray(data)) {
                    data.forEach(item => {
                        if (item && item.id) {
                            this.auctionsMap[item.id] = item;
                        }
                    });
                }

                this.renderGrid();
            } catch (err) {
                console.error('[VikingdevSubastas] Error cargando subastas:', err);
                const grid = this.querySelector('#vk-auction-grid');
                if (grid) grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 40px;">Error al cargar subastas.</div>`;
            }
        }

        renderGrid() {
            const grid = this.querySelector('#vk-auction-grid');
            if (!grid) return;

            grid.innerHTML = '';
            const existingTimers = this.auctionTimers || {};
            Object.values(existingTimers).forEach(t => clearInterval(t));
            this.auctionTimers = {};

            const now = new Date();
            const auctions = Object.values(this.auctionsMap || {});

            const filtered = auctions.filter(a => {
                if (!a) return false;
                const endDate = a.end_date ? new Date(typeof a.end_date === 'string' ? a.end_date.replace(' ', 'T') : a.end_date) : null;
                const isEnded = endDate && now > endDate;
                return this.currentFilter === 'active' ? !isEnded : isEnded;
            });

            if (filtered.length === 0) {
                grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #94a3b8; padding: 40px;">No hay subastas ${this.currentFilter === 'active' ? 'activas' : 'finalizadas'} en este momento.</div>`;
                return;
            }

            filtered.forEach(a => {
                const card = this.createCardElement(a);
                grid.appendChild(card);
                this.startTimer(a);
            });
        }

        createCardElement(a) {
            const bids = a.subastas_pujas || [];
            bids.sort((x, y) => y.amount - x.amount);
            const topBid = bids.length > 0 ? bids[0] : null;
            const currentBid = topBid ? topBid.amount : a.starting_bid;

            const endDate = a.end_date ? new Date(typeof a.end_date === 'string' ? a.end_date.replace(' ', 'T') : a.end_date) : null;
            const isEnded = endDate && new Date() > endDate;

            const card = document.createElement('div');
            card.className = `vk-auction-card ${isEnded ? 'status-ended' : ''}`;
            card.id = `vk-card-${a.id}`;

            card.innerHTML = `
                <div class="vk-auction-img-wrapper">
                    <img src="${a.image_url || 'https://via.placeholder.com/300x200?text=Sin+Imagen'}" alt="${a.nombre || 'Subasta'}">
                    ${isEnded ? '<div class="vk-ended-seal">FINALIZADA</div>' : ''}
                    <div class="vk-auction-bid-badge">$${parseFloat(currentBid).toFixed(2)}</div>
                </div>
                <div class="vk-auction-overlay">
                    <div class="vk-auction-footer-info">
                        <div class="vk-auction-timer" id="vk-timer-${a.id}">--:--:--</div>
                        <div class="vk-auction-bidder-info">
                            <span>${topBid ? topBid.bidder_name : 'Sin pujas'}</span>
                            <span class="bidder-name">${topBid ? '$' + parseFloat(topBid.amount).toFixed(2) : ''}</span>
                        </div>
                    </div>
                </div>
            `;

            card.addEventListener('click', () => this.openAuctionModal(a.id));
            return card;
        }

        startTimer(a) {
            if (this.auctionTimers[a.id]) clearInterval(this.auctionTimers[a.id]);

            const endDate = a.end_date ? new Date(typeof a.end_date === 'string' ? a.end_date.replace(' ', 'T') : a.end_date) : null;
            if (!endDate) return;

            const endMs = endDate.getTime();

            const update = () => {
                const nowMs = Date.now();
                const dist = endMs - nowMs;

                const cardTimer = this.querySelector(`#vk-timer-${a.id}`);
                const modalTimer = (this.activeModalAuctionId === a.id) ? this.querySelector('#vk-modal-timer') : null;

                if (dist <= 0) {
                    if (cardTimer) cardTimer.textContent = 'FINALIZADA';
                    if (modalTimer) modalTimer.textContent = 'FINALIZADA';
                    clearInterval(this.auctionTimers[a.id]);
                    return;
                }

                if (dist > 24 * 60 * 60 * 1000) {
                    const formatted = endDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
                    const str = `Termina el ${formatted}`;
                    if (cardTimer) cardTimer.textContent = str;
                    if (modalTimer) modalTimer.textContent = str;
                } else {
                    const hours = Math.floor((dist % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((dist % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((dist % (1000 * 60)) / 1000);
                    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

                    if (cardTimer) cardTimer.textContent = timeStr;
                    if (modalTimer) modalTimer.textContent = timeStr;
                }
            };

            update();
            this.auctionTimers[a.id] = setInterval(update, 1000);
        }

        openAuctionModal(auctionId) {
            const a = this.auctionsMap[auctionId];
            if (!a) return;

            this.activeModalAuctionId = auctionId;

            const modalOverlay = this.querySelector('#vk-modal-overlay');
            const modalImg = this.querySelector('#vk-modal-img');
            const modalTitle = this.querySelector('#vk-modal-title');
            const modalDesc = this.querySelector('#vk-modal-desc');
            const quickContainer = this.querySelector('#vk-quick-bid-container');

            if (modalImg) modalImg.src = a.image_url || 'https://via.placeholder.com/300x200?text=Sin+Imagen';
            if (modalTitle) modalTitle.textContent = a.nombre || 'Subasta';
            if (modalDesc) modalDesc.textContent = a.description || 'Sin descripción.';

            if (quickContainer) {
                quickContainer.innerHTML = '';
                const inc = a.min_increment || 5;
                [inc, inc * 2, inc * 5].forEach(val => {
                    const btn = document.createElement('button');
                    btn.className = 'vk-btn-bid-pill';
                    btn.textContent = `+$${val}`;
                    btn.addEventListener('click', () => {
                        const cur = parseFloat(this.querySelector('#vk-modal-current-bid')?.textContent.replace('$', '')) || 0;
                        const input = this.querySelector('#vk-input-bid-amount');
                        if (input) input.value = (cur + val).toFixed(2);
                    });
                    quickContainer.appendChild(btn);
                });
            }

            this.updateModalBidsUI(auctionId);
            if (modalOverlay) modalOverlay.classList.add('active');
        }

        updateModalBidsUI(auctionId) {
            const a = this.auctionsMap[auctionId];
            if (!a) return;

            const bids = a.subastas_pujas || [];
            bids.sort((x, y) => y.amount - x.amount);
            const topBid = bids.length > 0 ? bids[0] : null;
            const currentBid = topBid ? topBid.amount : a.starting_bid;

            const currentBidEl = this.querySelector('#vk-modal-current-bid');
            const startBidEl = this.querySelector('#vk-modal-start-bid');
            const biddersList = this.querySelector('#vk-modal-bidders-list');
            const bidControls = this.querySelector('#vk-modal-bid-controls');

            if (currentBidEl) currentBidEl.textContent = `$${parseFloat(currentBid).toFixed(2)}`;
            if (startBidEl) startBidEl.textContent = `$${parseFloat(a.starting_bid).toFixed(2)}`;

            const endDate = a.end_date ? new Date(typeof a.end_date === 'string' ? a.end_date.replace(' ', 'T') : a.end_date) : null;
            const isEnded = endDate && new Date() > endDate;

            if (isEnded && bidControls) {
                bidControls.style.display = 'none';
            } else if (bidControls) {
                bidControls.style.display = 'block';
            }

            if (biddersList) {
                biddersList.innerHTML = '';
                if (bids.length === 0) {
                    biddersList.innerHTML = `<div style="font-size: 0.82rem; color: #94a3b8;">No hay pujas registradas aún. ¡Sé el primero!</div>`;
                } else {
                    bids.forEach((b, idx) => {
                        const isWin = idx === 0;
                        const isSelf = this.currentUser && String(b.bidder_id) === String(this.currentUser.id);
                        const item = document.createElement('div');
                        item.className = `vk-bidder-item ${isWin ? 'winner' : ''}`;
                        item.innerHTML = `
                            <span>${idx + 1}. ${b.bidder_name} ${isWin ? '👑' : ''} ${isSelf ? '(Tú)' : ''}</span>
                            <span>$${parseFloat(b.amount).toFixed(2)}</span>
                        `;
                        biddersList.appendChild(item);
                    });
                }
            }
        }

        async handlePlaceBid() {
            if (!this.activeModalAuctionId) return;
            const a = this.auctionsMap[this.activeModalAuctionId];
            if (!a) return;

            // Detect active VikingTCG session user if not detected earlier
            if (!this.currentUser) {
                await this.detectCurrentUserSession();
            }

            if (!this.currentUser || !this.currentUser.id) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        title: '¿Quieres participar?',
                        text: 'Para colocar pujas en esta subasta, inicia sesión o crea tu cuenta en VikingTCG.',
                        icon: 'info',
                        showCancelButton: true,
                        confirmButtonText: 'Ir a VikingTCG',
                        cancelButtonText: 'Cancelar'
                    }).then((res) => {
                        if (res.isConfirmed) {
                            window.open('https://vikingtcg.xyz', '_blank');
                        }
                    });
                } else {
                    alert('Para participar en subastas, inicia sesión en VikingTCG.xyz');
                }
                return;
            }

            const input = this.querySelector('#vk-input-bid-amount');
            const amount = parseFloat(input?.value);

            if (isNaN(amount) || amount <= 0) {
                if (typeof Swal !== 'undefined') Swal.fire('Monto inválido', 'Por favor ingresa un monto mayor a 0.', 'warning');
                return;
            }

            const bids = a.subastas_pujas || [];
            bids.sort((x, y) => y.amount - x.amount);
            const currentTop = bids.length > 0 ? bids[0].amount : a.starting_bid;

            if (amount <= currentTop) {
                if (typeof Swal !== 'undefined') Swal.fire('Puja superada', `Tu puja debe ser mayor que el monto actual ($${parseFloat(currentTop).toFixed(2)}).`, 'warning');
                return;
            }

            const bidderName = this.currentUser.store_name || this.currentUser.username || 'Usuario';

            try {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({ title: 'Registrando puja...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                }

                const { error } = await this._supabase.from('subastas_pujas').insert([{
                    subasta_id: a.id,
                    bidder_id: this.currentUser.id,
                    bidder_name: bidderName,
                    amount: amount
                }]);

                if (typeof Swal !== 'undefined') Swal.close();

                if (error) throw error;

                if (input) input.value = '';

                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: '¡Puja registrada!',
                        text: `Tu puja de $${amount.toFixed(2)} se registró con éxito.`,
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 2000
                    });
                }

                // Reload local auction data immediately
                await this.loadAuctions(a.id);
                if (this.activeModalAuctionId) {
                    this.updateModalBidsUI(this.activeModalAuctionId);
                }

            } catch (err) {
                console.error('[VikingdevSubastas] Error al pujar:', err);
                if (typeof Swal !== 'undefined') Swal.fire('Error', 'No se pudo registrar la puja: ' + err.message, 'error');
            }
        }

        subscribeToRealtime(userId) {
            if (!this._supabase || !userId) return;

            if (this._realtimeChannel) {
                this._supabase.removeChannel(this._realtimeChannel);
            }

            this._realtimeChannel = this._supabase
                .channel(`realtime-vk-subastas-${userId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'subastas_pujas' }, async () => {
                    console.log('[VikingdevSubastas] Cambio detectado en pujas realtime');
                    await this.loadAuctions();
                    if (this.activeModalAuctionId) {
                        this.updateModalBidsUI(this.activeModalAuctionId);
                    }
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'subastas' }, async () => {
                    console.log('[VikingdevSubastas] Cambio detectado en subastas realtime');
                    await this.loadAuctions();
                    if (this.activeModalAuctionId) {
                        this.updateModalBidsUI(this.activeModalAuctionId);
                    }
                })
                .subscribe();
        }
    }

    if (!customElements.get('vikingdev-subastas')) {
        customElements.define('vikingdev-subastas', VikingdevSubastasElement);
    }
})();
