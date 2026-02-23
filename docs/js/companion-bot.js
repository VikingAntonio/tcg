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
        await this.loadCustomMessages();

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
                // Info de la tienda
                const { data: user } = await this.supabase
                    .from('usuarios')
                    .select('horario, ubicacion')
                    .eq('id', this.userId)
                    .single();

                if (user) {
                    if (user.horario) base.push({ message_text: `Nuestro horario es: ${user.horario}` });
                    if (user.ubicacion) base.push({ message_text: `Visítanos en: ${user.ubicacion}` });
                }

                // Links contextuales
                base.push({ message_text: "¿Te gustaría ver nuestra carpeta de Pokémon?", action_url: 'view-pokemon' });
                base.push({ message_text: "Mira nuestras preventas y productos sellados", action_url: 'view-products' });
                base.push({ message_text: "¿Buscas algo? Revisa nuestra lista de buscados", action_url: 'view-wishlist' });
            } else {
                // Tips para Admin
                base.push({ message_text: "Tip: Usa el escáner para registrar cartas más rápido." });
                base.push({ message_text: "Puedes personalizar los mensajes de este bot en la base de datos." });
                base.push({ message_text: "¿Necesitas soporte? Contáctanos por Messenger.", action_url: 'https://m.me/vikingdevtcg' });
            }
        } catch (err) {
            console.error("Error loading base bot messages:", err);
        }
        this.messages = [...base, ...this.messages];
    }

    async loadCustomMessages() {
        // Si ya tenemos mensajes (pasados por constructor), evitamos redundancia
        // Pero si queremos asegurar frescura o complementar, podemos buscar aquí.
        // Por ahora, asumimos que si se pasaron en el constructor ya son los de la DB.
        if (this.messages.some(m => m.id)) return;

        try {
            const { data, error } = await this.supabase
                .from('bot_messages')
                .select('*')
                .eq('is_active', true)
                .or(`view_type.eq.${this.userType},view_type.eq.both`);

            if (data) {
                this.messages = [...this.messages, ...data];
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
        this.bubble.textContent = this.stripEmojis(msg.message_text);

        // Configurar acción al hacer clic
        const hasAction = msg.action_url || (msg.message_text && msg.message_text.toLowerCase().includes('pokemon'));

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

        // Ocultar después de 10 segundos
        setTimeout(() => {
            this.bubble.classList.remove('fade-in');
            this.bubble.classList.add('fade-out');
        }, 10000);

        // Avanzar índice
        this.currentIndex++;
        if (this.currentIndex >= this.messages.length) {
            this.currentIndex = 0;
            this.shuffleMessages();
        }
    }

    handleAction(msg) {
        const action = msg.action_url;

        // Acciones especiales predefinidas
        if (action === 'view-pokemon' || (msg.message_text && msg.message_text.toLowerCase().includes('pokemon'))) {
            this.navigateToPokemon();
        } else if (action === 'view-products') {
            if (typeof showView === 'function') showView('sealed-products');
        } else if (action === 'view-wishlist') {
            if (typeof showView === 'function') showView('wishlist');
        } else if (action && action.startsWith('http')) {
            window.open(action, '_blank');
        }
    }

    navigateToPokemon() {
        // En el link público, cambiar a vista albums y buscar Pokémon
        if (typeof showView === 'function') {
            showView('public-albums');
            setTimeout(() => {
                const searchInput = document.getElementById('album-search');
                if (searchInput) {
                    searchInput.value = 'Pokemon';
                    searchInput.dispatchEvent(new Event('input'));
                    // Scroll suave
                    window.scrollTo({ top: searchInput.offsetTop - 100, behavior: 'smooth' });
                }
            }, 300);
        }
    }
}
