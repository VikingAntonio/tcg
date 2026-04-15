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
        this.intervalRange = options.intervalRange || [23000, 53000]; // 23-53s
        this.onAction = options.onAction;

        this.allMessages = []; // Almacena todos los mensajes base y personalizados
        this.messages = [];    // Mensajes activos para el ciclo actual (filtrados por contexto)
        this.currentIndex = 0;
        this.timer = null;
        this.bubble = document.getElementById(this.elementId);
        this.currentContext = 'all';
        this.isSpeakingSequence = false;

        // Cargar mensajes iniciales si se proveen
        if (options.customMessages && Array.isArray(options.customMessages)) {
            this.allMessages = options.customMessages;
        }
    }

    async init() {
        if (!this.bubble) {
            this.bubble = document.getElementById(this.elementId);
            if (!this.bubble) return;
        }

        await this.loadBaseMessages();

        // Solo cargar si no se pasaron mensajes en el constructor
        const baseLength = (this.userType === 'admin') ? 9 : 1;
        if (this.allMessages.length <= baseLength) {
            await this.loadCustomMessages();
        }

        // Inicializar pool de mensajes
        this.messages = [...this.allMessages];
        this.shuffleMessages();

        // Iniciar ciclo con un delay inicial aleatorio
        const initialDelay = Math.floor(Math.random() * 10000) + 5000; // 5-15s
        setTimeout(() => {
            if (!this.isSpeakingSequence) {
                this.showBubble();
                this.startLoop();
            }
        }, initialDelay);
    }

    async loadBaseMessages() {
        const base = [];
        try {
            if (this.userType === 'public') {
                base.push({ content: "Sugerencia: Puedes colocar a tu compañero en la posición que prefieras usando el icono de movimiento.", type: 'custom', duration: 8 });
                base.push({ content: "¡No olvides revisar tu carrito! Tengo muchas ganas de ver qué cartas elegiste.", type: 'cart', duration: 8 });
                base.push({ content: "¿Sabías que puedes jugar partidas de Yu-Gi-Oh! aquí mismo? ¡Es súper divertido!", type: 'all', duration: 8 });
            } else {
                // Tips for Admin
                base.push({ content: "Dato útil: Ahora puedes mover libremente a tu compañero por la pantalla usando su icono de movimiento.", type: 'custom', duration: 8 });
                base.push({ content: "Tip: Usa el escáner para registrar cartas más rápido.", type: 'custom', duration: 6 });
                base.push({ content: "¿Necesitas soporte? Contáctanos por Messenger.", type: 'custom', redirect_url: 'https://m.me/vikingdevtj', duration: 6 });
                base.push({ content: "Dato útil: Para añadir cartas a tu álbum, entra a 'Editar' y haz clic en un espacio vacío.", type: 'custom', duration: 7 });
                base.push({ content: "Sabías que: Si vinculas tu WhatsApp en 'Mi Perfil', los pedidos de tus clientes te llegarán directamente.", type: 'custom', duration: 8 });
                base.push({ content: "Efecto especial: Prueba el editor de máscaras para resaltar el foil de tus cartas favoritas.", type: 'custom', duration: 8 });
                base.push({ content: "Sugerencia: Usa la sección de 'Deseos' para listar las cartas que buscas; así tus clientes sabrán qué ofrecerte.", type: 'custom', duration: 7 });
                base.push({ content: "Consejo: Mantén tus 'Preventas' actualizadas para que tus clientes puedan apartar lo más nuevo de inmediato.", type: 'custom', duration: 7 });
                base.push({ content: "Tip: ¡Ya puedes poner precio a tus Decks! Puedes usar la suma automática o definir un precio especial.", type: 'custom', duration: 7 });
            }
        } catch (err) {
            console.error("Error loading base bot messages:", err);
        }
        this.allMessages = [...base, ...this.allMessages];
    }

    async loadCustomMessages() {
        try {
            let query = this.supabase
                .from('bot_messages')
                .select('*')
                .eq('user_id', this.userId)
                .eq('is_active', true);

            if (this.userType === 'admin') {
                query = query.or('view_type.eq.admin,view_type.eq.both');
            }

            const { data, error } = await query;

            if (data && data.length > 0) {
                this.allMessages = [...this.allMessages, ...data];
            }
        } catch (err) {
            console.error("Error loading custom bot messages:", err);
        }
    }

    async setContext(view) {
        this.currentContext = view;

        // Base contextual messages
        const contextBase = [];
        if (view === 'decks') {
            contextBase.push({ content: "¡Mira estos mazos! Están diseñados para ganar. ¿Cuál es tu favorito?", type: 'decks' });
            contextBase.push({ content: "Recuerda que puedes ver la lista completa de cartas haciendo clic en 'Modo Lista'.", type: 'decks' });
        } else if (view === 'albums') {
            contextBase.push({ content: "Nuestros álbumes están llenos de joyas. ¡Haz clic en las páginas para pasar de hoja!", type: 'albums' });
            contextBase.push({ content: "Si buscas algo específico, ¡usa el buscador en la parte superior!", type: 'albums' });
        } else if (view === 'cart') {
            contextBase.push({ content: "¡Excelente elección! Recuerda que puedes finalizar tu compra por WhatsApp o Messenger.", type: 'cart' });
            contextBase.push({ content: "¿Sabías que aceptamos diversos métodos de pago? Pregúntanos al contactarnos.", type: 'cart' });
        } else if (view === 'events') {
            contextBase.push({ content: "¡No te pierdas nuestros próximos torneos! La comunidad te espera.", type: 'events' });
        }

        // Filtrar mensajes que coincidan con el tipo/view o sean 'custom' (base)
        this.messages = [...contextBase, ...this.allMessages].filter(m => {
            // Check for explicit context in view_type (saved as public:context)
            if (m.view_type && m.view_type.startsWith('public:')) {
                const context = m.view_type.split(':')[1];
                if (context === 'all') return true;
                if (context === view) return true;
                return false;
            }
            if (m.type === 'custom' || !m.type) return true;
            if (m.type === view) return true;
            if (view === 'albums' && m.type === 'album_link') return true;
            if (view === 'preorders' && m.type === 'pre_sales') return true;
            return false;
        });

        if (this.messages.length === 0) {
            this.messages = this.allMessages.filter(m => m.type === 'custom');
        }

        this.currentIndex = 0;
        this.shuffleMessages();

        // Cargar info automática de la BD
        await this.loadAutomaticMessages(view);

        // Si cambiamos de contexto, forzar que el bot diga algo pronto (3-8s)
        if (this.timer && !this.isSpeakingSequence) {
            clearTimeout(this.timer);
            const quickInterval = Math.floor(Math.random() * 5000) + 3000;
            this.timer = setTimeout(() => {
                if (!this.isSpeakingSequence) {
                    this.showBubble();
                    this.startLoop();
                }
            }, quickInterval);
        }
    }

    async loadAutomaticMessages(view) {
        if (this.userType !== 'public' || !this.userId) return;

        try {
            let autoMsg = "";
            if (view === 'albums') {
                const { count } = await this.supabase.from('albums').select('*', { count: 'exact', head: true }).eq('user_id', this.userId).eq('is_public', true);
                if (count > 0) autoMsg = `¡Actualmente tenemos ${count} álbumes disponibles para que los explores!`;
            } else if (view === 'decks') {
                const { count } = await this.supabase.from('decks').select('*', { count: 'exact', head: true }).eq('user_id', this.userId).eq('is_public', true);
                if (count > 0) autoMsg = `¡Echa un vistazo a nuestros ${count} decks personalizados! Seguro encuentras algo interesante.`;
            } else if (view === 'wishlist') {
                const { count } = await this.supabase.from('wishlist').select('*', { count: 'exact', head: true }).eq('user_id', this.userId).eq('obtained', false);
                if (count > 0) autoMsg = `Estamos buscando ${count} cartas específicas. ¡Si las tienes, contáctanos!`;
            } else if (view === 'events') {
                const { count } = await this.supabase.from('eventos').select('*', { count: 'exact', head: true }).eq('user_id', this.userId);
                if (count > 0) autoMsg = `Tenemos ${count} eventos programados. ¡No te quedes fuera!`;
            } else if (view === 'auctions') {
                const { count } = await this.supabase.from('subastas').select('*', { count: 'exact', head: true }).eq('user_id', this.userId).eq('is_live', true).eq('status', 'Activa');
                if (count > 0) autoMsg = `¡Hay ${count} subastas en vivo ahora mismo! ¿Qué esperas para pujar?`;
            }

            if (autoMsg) {
                // Insertar al inicio de la rotación para que sea lo primero que diga
                this.messages.unshift({ content: autoMsg, type: 'auto', duration: 8 });
            }
        } catch (err) {
            console.warn("Error loading auto messages:", err);
        }
    }

    say(content, options = {}) {
        if (!this.bubble || !content) return;

        // Limpiar timer actual para que no se encime
        if (this.timer) clearTimeout(this.timer);

        const duration = (options.duration || 6) * 1000;
        this.bubble.textContent = this.stripEmojis(content);

        if (options.clickable) {
            this.bubble.classList.add('clickable');
            this.bubble.onclick = () => {
                if (options.onAction) options.onAction();
                else if (options.url) window.open(options.url, '_blank');
            };
        } else {
            this.bubble.classList.remove('clickable');
            this.bubble.onclick = null;
        }

        this.bubble.classList.remove('fade-out');
        this.bubble.classList.add('fade-in');

        setTimeout(() => {
            this.bubble.classList.remove('fade-in');
            this.bubble.classList.add('fade-out');
            // Reanudar ciclo normal después de un breve silencio
            if (!this.isSpeakingSequence) {
                setTimeout(() => this.startLoop(), 5000);
            }
        }, duration);
    }

    async fetchDetailedCardInfo(name) {
        if (!name) return null;
        try {
            const { data, error } = await this.supabase
                .from('viking_data')
                .select('*')
                .ilike('name', name)
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            return data;
        } catch (err) {
            console.warn("Error fetching detailed card info:", err);
            return null;
        }
    }

    async saySequence(messages) {
        // Cooldown mechanism to prevent rapid-fire triggers
        const now = Date.now();
        if (this.lastSequenceTime && now - this.lastSequenceTime < 3000) {
            console.log("CompanionBot: Sequence cooldown active");
            return;
        }
        this.lastSequenceTime = now;

        if (this.timer) clearTimeout(this.timer);
        this.isSpeakingSequence = true;

        for (const msg of messages) {
            const text = typeof msg === 'string' ? msg : msg.content;
            // Increased duration for better readability (min 8s)
            const duration = Math.max((typeof msg === 'object' ? msg.duration : 8) || 8, 8);

            this.bubble.textContent = this.stripEmojis(text);
            this.bubble.classList.remove('fade-out');
            this.bubble.classList.add('fade-in');

            await new Promise(r => setTimeout(r, duration * 1000));

            this.bubble.classList.remove('fade-in');
            this.bubble.classList.add('fade-out');

            await new Promise(r => setTimeout(r, 1500)); // Longer pause between bubbles
        }

        this.isSpeakingSequence = false;
        this.startLoop();
    }

    shuffleMessages() {
        for (let i = this.messages.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.messages[i], this.messages[j]] = [this.messages[j], this.messages[i]];
        }
    }

    startLoop() {
        if (this.timer) clearTimeout(this.timer);
        if (this.isSpeakingSequence) return;

        const nextInterval = Math.floor(Math.random() * (this.intervalRange[1] - this.intervalRange[0])) + this.intervalRange[0];
        this.timer = setTimeout(() => {
            if (!this.isSpeakingSequence) {
                this.showBubble();
                this.startLoop();
            }
        }, nextInterval);
    }

    stripEmojis(text) {
        if (!text) return "";
        return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
    }

    showBubble() {
        if (this.messages.length === 0 || !this.bubble || this.isSpeakingSequence) return;

        const msg = this.messages[this.currentIndex];
        const duration = (msg.duration || msg.display_duration || 5) * 1000;

        this.bubble.textContent = this.stripEmojis(msg.content);

        const hasAction = (msg.redirect_url && msg.redirect_url !== '') || msg.type === 'album_link';

        if (hasAction) {
            this.bubble.classList.add('clickable');
            this.bubble.onclick = () => this.handleAction(msg);
        } else {
            this.bubble.classList.remove('clickable');
            this.bubble.onclick = null;
        }

        this.bubble.classList.remove('fade-out');
        this.bubble.classList.add('fade-in');

        setTimeout(() => {
            this.bubble.classList.remove('fade-in');
            this.bubble.classList.add('fade-out');
        }, duration);

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
