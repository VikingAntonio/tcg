/**
 * CompanionBot - Sistema de mensajes dinámicos para el acompañante (Espíritu)
 * Centraliza la lógica de burbujas informativas, limpieza de emojis y acciones.
 */
class CompanionBot {
    constructor(options = {}) {
        this.supabase = options.supabase;
        this.userId = options.userId;
        this.userType = options.userType || 'public'; // 'public' o 'admin'
        this.elementId = options.elementId || 'companion-bubble';
        this.intervalRange = options.intervalRange || [30000, 60000]; // 30-60s
        this.onAction = options.onAction;

        this.messages = [];
        this.currentIndex = 0;
        this.timer = null;
        this.bubble = document.getElementById(this.elementId);

        // Cargar mensajes iniciales si se proveen
        if (options.customMessages && Array.isArray(options.customMessages)) {
            this.messages = options.customMessages;
        }
    }

    async init() {
        if (!this.bubble) {
            this.bubble = document.getElementById(this.elementId);
            if (!this.bubble) return;
        }

        await this.loadBaseMessages();

        // Solo cargar si no se pasaron mensajes en el constructor
        // loadBaseMessages añade 2 mensajes si es admin
        const baseLength = (this.userType === 'admin') ? 2 : 0;
        if (this.messages.length <= baseLength) {
            await this.loadCustomMessages();
        }

        // Shuffler inicial
        this.shuffleMessages();

        // Iniciar ciclo con un delay inicial aleatorio
        const initialDelay = Math.floor(Math.random() * 10000) + 5000; // 5-15s
        setTimeout(() => {
            this.showBubble();
            this.startLoop();
        }, initialDelay);
    }

    async loadBaseMessages() {
        const base = [];
        try {
            if (this.userType === 'public') {
                // No base messages for public anymore, everything comes from DB custom messages
            } else {
                // Tips for Admin
                base.push({ content: "Tip: Usa el escáner para registrar cartas más rápido.", type: 'custom', duration: 5 });
                base.push({ content: "¿Necesitas soporte? Contáctanos por Messenger.", type: 'custom', redirect_url: 'https://m.me/vikingdevtj', duration: 5 });
            }
        } catch (err) {
            console.error("Error loading base bot messages:", err);
        }
        this.messages = [...base, ...this.messages];
    }

    async loadCustomMessages() {
        try {
            // All configured messages are for public use per user request
            const { data, error } = await this.supabase
                .from('bot_messages')
                .select('*')
                .eq('user_id', this.userId)
                .eq('is_active', true);

            if (data && data.length > 0) {
                // Combine with base tips if admin, otherwise use directly
                if (this.userType === 'admin') {
                    this.messages = [...this.messages, ...data];
                } else {
                    this.messages = data;
                }
            }
        } catch (err) {
            console.error("Error loading custom bot messages:", err);
        }
    }

    shuffleMessages() {
        for (let i = this.messages.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.messages[i], this.messages[j]] = [this.messages[j], this.messages[i]];
        }
    }

    startLoop() {
        if (this.timer) clearTimeout(this.timer);

        const nextInterval = Math.floor(Math.random() * (this.intervalRange[1] - this.intervalRange[0])) + this.intervalRange[0];
        this.timer = setTimeout(() => {
            this.showBubble();
            this.startLoop();
        }, nextInterval);
    }

    stripEmojis(text) {
        if (!text) return "";
        return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
    }

    showBubble() {
        if (this.messages.length === 0 || !this.bubble) return;

        const msg = this.messages[this.currentIndex];
        const duration = (msg.duration || msg.display_duration || 5) * 1000;

        this.bubble.textContent = this.stripEmojis(msg.content);

        // Configurar acción al hacer clic
        const hasAction = (msg.redirect_url && msg.redirect_url !== '') || msg.type === 'album_link';

        if (hasAction) {
            this.bubble.classList.add('clickable');
            this.bubble.onclick = () => this.handleAction(msg);
        } else {
            this.bubble.classList.remove('clickable');
            this.bubble.onclick = null;
        }

        // Mostrar con animación
        this.bubble.classList.remove('fade-out');
        this.bubble.classList.add('fade-in');

        // Ocultar después de la duración configurada
        setTimeout(() => {
            this.bubble.classList.remove('fade-in');
            this.bubble.classList.add('fade-out');
        }, duration);

        // Avanzar índice
        this.currentIndex++;
        if (this.currentIndex >= this.messages.length) {
            this.currentIndex = 0;
            this.shuffleMessages();
        }
    }

    handleAction(msg) {
        if (this.onAction) {
            this.onAction(msg);
        } else {
            if (msg.redirect_url && msg.redirect_url.startsWith('http')) {
                window.open(msg.redirect_url, '_blank');
            }
        }
    }
}
