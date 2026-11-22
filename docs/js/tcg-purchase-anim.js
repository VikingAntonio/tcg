/**
 * tcg-purchase-anim.js — Unified TCG Purchase Flow & Acquisition Animation
 * Reusable system for purchasing customizable items:
 * - Stickers (custom.html)
 * - 3D GLTF Assistants / Spirits (admin.html)
 * - Accessories: Sleeves, Decks, Coins, Playmats (admin.html, deckbuilding.html, accesorios.html)
 *
 * Provides:
 * 1. Visual card lift, glowing particle trail, displacement to user's collection / preview slot.
 * 2. Instant database & memory unlock of purchased item.
 * 3. Keeps user within the current editor/flow without needing to exit or reload.
 */

(function(window, $) {
    'use strict';

    // Inject required styles for the TCG Acquisition animation if not already injected
    function injectPurchaseAnimationStyles() {
        if (document.getElementById('tcg-purchase-anim-styles')) return;

        const css = `
            @keyframes tcgCardAcquirePop {
                0% {
                    transform: translate(-50%, -50%) scale(0.7) rotate(-4deg);
                    opacity: 0;
                    filter: brightness(1.8) drop-shadow(0 0 30px #00d2ff);
                }
                40% {
                    transform: translate(-50%, -50%) scale(1.15) rotate(1deg);
                    opacity: 1;
                    filter: brightness(1.3) drop-shadow(0 0 45px #00f3ff);
                }
                60% {
                    transform: translate(-50%, -50%) scale(1.05) rotate(0deg);
                    opacity: 1;
                    filter: brightness(1.1) drop-shadow(0 0 35px #ffd700);
                }
                100% {
                    transform: translate(-50%, -50%) scale(1) rotate(0deg);
                    opacity: 1;
                    filter: brightness(1) drop-shadow(0 0 25px rgba(0, 210, 255, 0.7));
                }
            }

            @keyframes tcgBurstRays {
                0% { transform: translate(-50%, -50%) rotate(0deg) scale(0.6); opacity: 0; }
                50% { opacity: 0.85; }
                100% { transform: translate(-50%, -50%) rotate(180deg) scale(1.3); opacity: 0; }
            }

            @keyframes tcgParticleFloat {
                0% { transform: translate(0, 0) scale(1); opacity: 1; }
                100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
            }

            @keyframes tcgFlashFade {
                0% { opacity: 0.85; }
                100% { opacity: 0; }
            }

            .tcg-acquire-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: radial-gradient(circle at center, rgba(10, 22, 40, 0.85) 0%, rgba(3, 7, 18, 0.95) 100%);
                z-index: 999999;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                pointer-events: auto;
                transition: opacity 0.4s ease;
            }

            .tcg-acquire-rays {
                position: absolute;
                top: 50%;
                left: 50%;
                width: 500px;
                height: 500px;
                background: conic-gradient(from 0deg, transparent 0deg, rgba(0, 210, 255, 0.25) 20deg, transparent 40deg, rgba(255, 215, 0, 0.25) 70deg, transparent 90deg, rgba(0, 210, 255, 0.25) 130deg, transparent 150deg, rgba(255, 215, 0, 0.25) 200deg, transparent 230deg, rgba(0, 210, 255, 0.25) 290deg, transparent 320deg);
                border-radius: 50%;
                pointer-events: none;
                animation: tcgBurstRays 2.8s linear infinite;
            }

            .tcg-acquire-card {
                position: absolute;
                top: 45%;
                left: 50%;
                transform: translate(-50%, -50%);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 10;
                animation: tcgCardAcquirePop 0.85s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }

            .tcg-acquire-img-wrapper {
                position: relative;
                max-width: 280px;
                max-height: 380px;
                border-radius: 16px;
                overflow: hidden;
                border: 3px solid #00f3ff;
                box-shadow: 0 0 35px rgba(0, 243, 255, 0.6), inset 0 0 20px rgba(0, 243, 255, 0.3);
                background: #0b1329;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 6px;
            }

            .tcg-acquire-img-wrapper.type-coin {
                border-radius: 50%;
                width: 220px;
                height: 220px;
            }

            .tcg-acquire-img-wrapper.type-mats {
                max-width: 380px;
                max-height: 240px;
                aspect-ratio: 16/9;
            }

            .tcg-acquire-img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 12px;
                display: block;
            }

            .tcg-acquire-text {
                margin-top: 24px;
                text-align: center;
                z-index: 12;
            }

            .tcg-acquire-badge {
                display: inline-block;
                background: linear-gradient(135deg, #00f3ff, #0088ff);
                color: #030a16;
                font-weight: 900;
                font-size: 0.78rem;
                padding: 4px 14px;
                border-radius: 50px;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                margin-bottom: 8px;
                box-shadow: 0 0 15px rgba(0, 243, 255, 0.6);
            }

            .tcg-acquire-title {
                color: #ffffff;
                font-size: 1.6rem;
                font-weight: 900;
                margin: 0;
                text-shadow: 0 0 20px rgba(0, 243, 255, 0.8), 0 2px 4px rgba(0,0,0,0.8);
                letter-spacing: 0.5px;
            }

            .tcg-acquire-sub {
                color: #94a3b8;
                font-size: 0.9rem;
                margin-top: 6px;
                font-weight: 600;
            }

            .tcg-flying-element {
                position: fixed;
                z-index: 1000000;
                pointer-events: none;
                transition: all 0.75s cubic-bezier(0.25, 1, 0.5, 1);
                border-radius: 12px;
                box-shadow: 0 0 30px #00f3ff, 0 0 60px rgba(255, 215, 0, 0.6);
                border: 2px solid #00f3ff;
                object-fit: cover;
            }
        `;

        const styleEl = document.createElement('style');
        styleEl.id = 'tcg-purchase-anim-styles';
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
    }

    const TCGPurchase = {
        init() {
            injectPurchaseAnimationStyles();
        },

        /**
         * Resolves current user session or cached session
         */
        async getCurrentUser() {
            try {
                if (window.currentUser && window.currentUser.id) return window.currentUser;
                if (window.CustomStoreState?.currentUser?.id) return window.CustomStoreState.currentUser;

                if (window._supabase?.auth) {
                    const { data: { session } } = await window._supabase.auth.getSession();
                    if (session?.user?.id) {
                        const { data: user } = await window._supabase
                            .from('usuarios')
                            .select('*')
                            .eq('id', session.user.id)
                            .maybeSingle();
                        if (user) return user;
                    }
                }

                const cached = localStorage.getItem('tcg_session');
                if (cached) return JSON.parse(cached);
            } catch (e) {
                console.warn('Error resolving user for purchase:', e);
            }
            return null;
        },

        /**
         * Resolves the effective pricing according to Viking TCG priority rules:
         * 1. Gift campaign available for user ($0 / Gift) -> lowest price wins!
         * 2. Active promotion within validity period -> discounted promo price (crossed out original)
         * 3. Base price configured in Configuration & Packages
         */
        resolveProductPricing(params) {
            const {
                id,
                category = '',
                basePrice = 25,
                promotions = [],
                giftCampaigns = [],
                user = null
            } = params;

            const strId = String(id || '');
            const parsedBase = Math.max(0, Number(basePrice) || 0);

            // 1. Check for Active Gift Campaign targeting this user
            if (giftCampaigns && giftCampaigns.length > 0) {
                const now = new Date();
                const userRole = (user?.role || 'starter').toLowerCase();
                const userId = user?.id || '';

                const matchingGift = giftCampaigns.find(g => {
                    if (g.status && g.status !== 'active') return false;
                    if (g.expires_at && new Date(g.expires_at) < now) return false;

                    // Check audience targeting
                    if (g.target_type === 'plan') {
                        if (g.target_plan && g.target_plan.toLowerCase() !== userRole) return false;
                    } else if (g.target_type === 'specific_users') {
                        const targetUsers = Array.isArray(g.target_users) ? g.target_users.map(String) : [];
                        if (!targetUsers.includes(String(userId))) return false;
                    }

                    // Check if this item is inside the gift's items array
                    const items = Array.isArray(g.items) ? g.items : [];
                    return items.some(it => String(it.id) === strId);
                });

                if (matchingGift) {
                    return {
                        effectivePrice: 0,
                        originalPrice: parsedBase,
                        hasPromo: false,
                        isGift: true,
                        giftCampaign: matchingGift,
                        discountPercent: 100,
                        priceDisplay: '¡Gratis / Regalo!'
                    };
                }
            }

            // 2. Check for Active Promotion
            if (promotions && promotions.length > 0) {
                const now = new Date();
                const matchingPromo = promotions.find(p => {
                    if (String(p.product_id) !== strId) return false;
                    if (p.status && p.status !== 'active') return false;

                    if (!p.is_permanent) {
                        if (p.start_date && new Date(p.start_date) > now) return false;
                        if (p.end_date && new Date(p.end_date) < now) return false;
                    }
                    return true;
                });

                if (matchingPromo) {
                    const promoPrice = Math.max(0, Number(matchingPromo.promo_price));
                    if (promoPrice < parsedBase) {
                        const percent = matchingPromo.discount_percent || Math.round(((parsedBase - promoPrice) / parsedBase) * 100);
                        return {
                            effectivePrice: promoPrice,
                            originalPrice: parsedBase,
                            hasPromo: true,
                            isGift: false,
                            promo: matchingPromo,
                            discountPercent: percent,
                            priceDisplay: `$${promoPrice} MXN`
                        };
                    }
                }
            }

            // 3. Fallback to Base Price
            return {
                effectivePrice: parsedBase,
                originalPrice: parsedBase,
                hasPromo: false,
                isGift: false,
                discountPercent: 0,
                priceDisplay: `$${parsedBase} MXN`
            };
        },

        /**
         * Checks if the user already owns the given item.
         * Consulta las columnas CSV históricas y el libro de compras permanente
         * (`user_entitlements`), que sobrevive aunque el artículo se borre del catálogo.
         * @param {string} type 'accessory' | 'sticker' | 'spirit' | 'pack'
         * @param {string|number} itemId
         * @param {object} user
         */
        hasUserPurchased(type, itemId, user) {
            if (!user || !itemId) return false;
            const strId = String(itemId);
            const userRole = (user.role || '').toLowerCase();
            if (userRole === 'admin' || userRole === 'superadmin' || userRole === 'admin_store') return true;

            const columns = {
                accessory: 'purchased_accessory_ids',
                sticker: 'purchased_sticker_ids',
                spirit: 'purchased_spirit_ids',
                pack: 'purchased_pack_ids'
            };
            const col = columns[type];
            if (!col) return false;

            const list = (user[col] || '').split(',').map(s => s.trim()).filter(Boolean);
            if (list.includes(strId)) return true;

            const owned = this.getEntitlements(user.id);
            return owned.some(e => e.item_type === type && String(e.item_id) === strId);
        },

        /** Cache en memoria de los entitlements del usuario */
        _entitlements: { userId: null, items: [], loadedAt: 0, promise: null },

        /**
         * Carga (una sola vez por sesión) el libro de compras del usuario.
         */
        async loadEntitlements(user, force = false) {
            const userId = user?.id || window.currentUser?.id || window.CustomStoreState?.currentUser?.id;
            if (!userId) return [];

            const cache = this._entitlements;
            const freshMs = 30000;
            if (!force && cache.userId === userId && cache.loadedAt && (Date.now() - cache.loadedAt) < freshMs) {
                return cache.items;
            }
            if (!force && cache.userId === userId && cache.promise) return cache.promise;

            const sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
            if (!sb) return [];

            cache.userId = userId;
            cache.promise = (async () => {
                try {
                    const { data, error } = await sb
                        .from('user_entitlements')
                        .select('item_type, item_id, item_snapshot, source, granted_at')
                        .eq('user_id', userId);
                    if (error) {
                        // La migración puede no estar aplicada todavía: no romper la vista.
                        console.warn('No se pudieron cargar los entitlements:', error.message);
                        cache.items = [];
                    } else {
                        cache.items = data || [];
                    }
                    cache.loadedAt = Date.now();
                } catch (e) {
                    console.warn('Error cargando entitlements:', e);
                    cache.items = [];
                }
                cache.promise = null;
                return cache.items;
            })();

            return cache.promise;
        },

        getEntitlements(userId) {
            const cache = this._entitlements;
            if (!userId || cache.userId !== userId) return [];
            return cache.items || [];
        },

        /**
         * Devuelve los artículos comprados/regalados que ya NO existen en el
         * catálogo, reconstruidos desde el snapshot guardado al pagar.
         */
        getOwnedSnapshots(type, user) {
            const items = this.getEntitlements(user?.id);
            return items
                .filter(e => e.item_type === type && e.item_snapshot && typeof e.item_snapshot === 'object')
                .map(e => {
                    const snap = Object.assign({}, e.item_snapshot);
                    const id = String(e.item_id);
                    const image = snap.image_url || snap.url || snap.gltf_url || snap.poster_url || '';
                    return Object.assign(snap, {
                        id,
                        name: snap.name || snap.card_name || 'Artículo comprado',
                        image_url: image,
                        url: snap.url || image,
                        sale_status: 'disponible',
                        price_mxn: Number(snap.price_mxn) || 0,
                        target_roles: ['starter', 'premium', 'tienda'],
                        _owned_snapshot: true,
                        _entitlement_source: e.source
                    });
                });
        },

        /**
         * Une el catálogo vivo con los artículos que el usuario ya pagó y que
         * el admin pudo haber eliminado. Así "lo comprado" nunca desaparece.
         */
        mergeOwnedIntoCatalog(catalog, type, user) {
            const list = Array.isArray(catalog) ? catalog.slice() : [];
            const known = new Set(list.map(it => String(it.id)));
            const owned = this.getOwnedSnapshots(type, user);

            owned.forEach(it => {
                if (!known.has(String(it.id))) {
                    list.push(it);
                    known.add(String(it.id));
                }
            });

            return list;
        },

        /**
         * Carga el catálogo de un tipo desde Supabase y lo fusiona con lo comprado.
         * @param {string} type 'accessory' | 'sticker' | 'spirit'
         */
        async fetchCatalog(type, user, options = {}) {
            const sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
            if (!sb) return this.getOwnedSnapshots(type, user);

            const table = type === 'accessory' ? 'accessories' : type === 'sticker' ? 'stickers' : type === 'spirit' ? 'spirits' : null;
            if (!table) return [];

            const owner = user || await this.getCurrentUser();
            await this.loadEntitlements(owner);

            let data = [];
            try {
                let query = sb.from(table).select('*');
                if (options.orderBy) query = query.order(options.orderBy, { ascending: options.ascending !== false });
                const res = await query;
                if (!res.error && Array.isArray(res.data)) data = res.data;
            } catch (e) {
                console.warn(`Error cargando catálogo ${table}:`, e);
            }

            return this.mergeOwnedIntoCatalog(data, type, owner);
        },

        /**
         * Refresca en memoria / localStorage el perfil del usuario y los
         * entitlements. No escribe nada en la base de datos.
         */
        async refreshUserFromDb(user) {
            const sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
            const current = user || window.currentUser || window.CustomStoreState?.currentUser || null;
            const userId = current?.id;
            if (!sb || !userId) return current;

            try {
                const { data } = await sb.from('usuarios').select('*').eq('id', userId).maybeSingle();
                if (data) {
                    if (window.currentUser) Object.assign(window.currentUser, data);
                    if (window.CustomStoreState?.currentUser) Object.assign(window.CustomStoreState.currentUser, data);
                    try {
                        const cached = JSON.parse(localStorage.getItem('tcg_session') || '{}');
                        localStorage.setItem('tcg_session', JSON.stringify(Object.assign({}, cached, data)));
                    } catch (_) {}
                }
            } catch (e) {
                console.warn('No se pudo refrescar el usuario:', e);
            }

            await this.loadEntitlements({ id: userId }, true);

            try {
                window.dispatchEvent(new CustomEvent('tcg_item_unlocked', {
                    detail: { type: 'refresh', itemId: null }
                }));
            } catch (_) {}

            return window.currentUser || current;
        },

        /**
         * Aplica en memoria/localStorage los artículos que el SERVIDOR ya
         * confirmó (respuesta de `verify-checkout-session`).
         * No escribe en la base de datos: eso lo hace exclusivamente el backend.
         */
        applyGrantedEntitlements(entitlements, user) {
            if (!Array.isArray(entitlements) || entitlements.length === 0) return;

            const columns = {
                accessory: 'purchased_accessory_ids',
                sticker: 'purchased_sticker_ids',
                spirit: 'purchased_spirit_ids',
                pack: 'purchased_pack_ids'
            };

            const cache = this._entitlements;
            const userId = user?.id || cache.userId;
            if (userId && cache.userId !== userId) {
                cache.userId = userId;
                cache.items = [];
            }
            const known = new Set(cache.items.map(e => `${e.item_type}:${e.item_id}`));

            entitlements.forEach(e => {
                const type = e.item_type || e.type;
                const id = String(e.item_id || e.id || '');
                if (!type || !id) return;

                if (!known.has(`${type}:${id}`)) {
                    cache.items.push({
                        item_type: type,
                        item_id: id,
                        item_snapshot: e.item_snapshot || e.snapshot || {},
                        source: e.source || 'purchase'
                    });
                    known.add(`${type}:${id}`);
                }

                const col = columns[type];
                if (col && user) {
                    const list = (user[col] || '').split(',').map(s => s.trim()).filter(Boolean);
                    if (!list.includes(id)) {
                        list.push(id);
                        user[col] = list.join(',');
                        if (window.currentUser) window.currentUser[col] = user[col];
                        if (window.CustomStoreState?.currentUser) window.CustomStoreState.currentUser[col] = user[col];
                        try {
                            const cached = JSON.parse(localStorage.getItem('tcg_session') || '{}');
                            cached[col] = user[col];
                            localStorage.setItem('tcg_session', JSON.stringify(cached));
                        } catch (_) {}
                    }
                }
            });

            try {
                window.dispatchEvent(new CustomEvent('tcg_item_unlocked', {
                    detail: { type: 'entitlements', items: entitlements }
                }));
            } catch (_) {}
        },

        /**
         * Compatibilidad: antes esta función escribía las compras directamente
         * en `usuarios` desde el navegador (cualquiera podía regalarse artículos
         * desde la consola). Ahora solo se usa para refrescar la memoria tras
         * una confirmación del servidor.
         */
        async recordUnlockInDatabase(type, itemId, user) {
            if (!user?.id || !itemId) return;
            await this.refreshUserFromDb(user);
        },

        /**
         * Plays the TCG item acquisition animation
         * @param {object} options
         * @param {string} options.imageUrl URL of the acquired design
         * @param {string} options.name Item name
         * @param {string} options.category Category name ('Sleeves', 'Deckbox', 'Coin', 'Playmat', 'Sticker', 'Asistente')
         * @param {HTMLElement|jQuery} [options.sourceElement] Source card to animate from
         * @param {HTMLElement|jQuery} [options.targetElement] Destination container (e.g. preview box)
         * @param {Function} [options.onComplete] Callback when animation finishes
         */
        async playAcquisitionAnimation(options) {
            injectPurchaseAnimationStyles();

            const {
                imageUrl,
                name = 'Nuevo Accesorio',
                category = 'Accesorio TCG',
                sourceElement = null,
                targetElement = null,
                onComplete = null
            } = options;

            const categoryLower = (category || '').toLowerCase();
            let wrapperClass = '';
            if (categoryLower.includes('coin')) wrapperClass = 'type-coin';
            else if (categoryLower.includes('counter')) wrapperClass = 'type-counters';
            else if (categoryLower.includes('mat')) wrapperClass = 'type-mats';

            // 1. Create Acquisition Overlay
            const $overlay = $(`
                <div class="tcg-acquire-overlay">
                    <div class="tcg-acquire-rays"></div>
                    <div class="tcg-acquire-card">
                        <div class="tcg-acquire-img-wrapper ${wrapperClass}">
                            <img src="${imageUrl}" alt="${name}" class="tcg-acquire-img" onerror="this.src='https://via.placeholder.com/200?text=TCG'">
                        </div>
                        <div class="tcg-acquire-text">
                            <span class="tcg-acquire-badge"><i class="fas fa-sparkles"></i> ¡Desbloqueado!</span>
                            <h2 class="tcg-acquire-title">${name}</h2>
                            <p class="tcg-acquire-sub">${category} añadido permanentemente a tu colección</p>
                        </div>
                    </div>
                </div>
            `);

            $('body').append($overlay);

            // Audio / Haptic feedback if supported
            if (window.navigator?.vibrate) {
                window.navigator.vibrate([40, 60, 100]);
            }

            // 2. Wait for admiration phase (1.8s)
            await new Promise(r => setTimeout(r, 1800));

            // 3. Smooth flying transition if targetElement is provided or visible
            const $target = $(targetElement);
            if ($target.length && $target.is(':visible')) {
                const targetRect = $target[0].getBoundingClientRect();
                const $card = $overlay.find('.tcg-acquire-img-wrapper');
                const cardRect = $card[0].getBoundingClientRect();

                const $flying = $(`
                    <img src="${imageUrl}" class="tcg-flying-element" style="
                        top: ${cardRect.top}px;
                        left: ${cardRect.left}px;
                        width: ${cardRect.width}px;
                        height: ${cardRect.height}px;
                        ${categoryLower.includes('coin') || categoryLower.includes('counter') ? 'border-radius: 50%;' : ''}
                    ">
                `);
                $('body').append($flying);

                $overlay.css({ opacity: 0 });

                // Force reflow
                $flying[0].getBoundingClientRect();

                // Fly to target
                $flying.css({
                    top: targetRect.top + 'px',
                    left: targetRect.left + 'px',
                    width: targetRect.width + 'px',
                    height: targetRect.height + 'px',
                    opacity: 0.9,
                    transform: 'scale(1)'
                });

                await new Promise(r => setTimeout(r, 750));
                $flying.remove();
                $overlay.remove();
            } else {
                $overlay.css({ opacity: 0 });
                await new Promise(r => setTimeout(r, 400));
                $overlay.remove();
            }

            if (typeof onComplete === 'function') {
                onComplete();
            }
        },

        /**
         * Inicia el Checkout de Stripe para un artículo (accesorio, sticker,
         * asistente 3D o pack). El precio SIEMPRE lo resuelve el servidor: aquí
         * solo se usa para mostrarlo en la confirmación.
         */
        async purchaseItemViaStripe(type, item, options = {}) {
            const user = await this.getCurrentUser();
            if (!user || !user.id || user.id === '00000000-0000-0000-0000-000000000000') {
                Swal.fire('Inicia sesión', 'Debes iniciar sesión para realizar la compra.', 'info');
                return;
            }

            const isPack = type === 'pack';
            const itemName = item.name || (isPack ? 'Pack TCG' : 'Accesorio TCG');
            const price = isPack
                ? (Number(item.promo_price || item.normal_price) || 0)
                : (Number(item.price_mxn) || 0);
            const returnUrl = window.location.origin + window.location.pathname;

            // Confirm intent with a clean, pastel purple TCG modal
            const displayImg = item.image_url || item.url || item.poster_url || '';
            const { isConfirmed } = await Swal.fire({
                title: `${isPack ? 'Comprar' : 'Desbloquear'} ${itemName}`,
                html: `
                    <div style="text-align: center; margin: 12px 0;">
                        ${displayImg ? `<img src="${displayImg}" style="max-height: 130px; border-radius: 12px; margin-bottom: 12px; object-fit: contain;">` : ''}
                        <div style="font-size: 1.5rem; font-weight: 900; color: #c084fc;">$${price} MXN</div>
                        <p style="font-size: 0.75rem; color: #94a3b8; margin: 6px 0 0;">El cargo final lo confirma el servidor con el precio oficial.</p>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonColor: '#a855f7',
                cancelButtonColor: '#475569',
                confirmButtonText: 'Comprar',
                cancelButtonText: 'Cancelar',
                background: '#0d1527',
                color: '#fff',
                customClass: {
                    popup: 'tcg-custom-confirm-popup'
                }
            });

            if (!isConfirmed) return;

            Swal.fire({
                title: 'Conectando con pasarela segura...',
                text: 'Generando orden de pago con Stripe.',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            try {
                const sbClient = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
                let token = '';
                if (sbClient && sbClient.auth) {
                    const { data } = await sbClient.auth.getSession();
                    token = data?.session?.access_token || '';
                }

                const bodyPayload = {
                    user_id: user.id,
                    purchase_type: type,
                    return_url: returnUrl
                };

                if (type === 'accessory') bodyPayload.accessory_id = item.id;
                else if (type === 'sticker') bodyPayload.sticker_id = item.id;
                else if (type === 'spirit') bodyPayload.spirit_id = item.id;
                else if (type === 'pack') bodyPayload.pack_id = item.id;

                const response = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${token || SUPABASE_KEY}`
                    },
                    body: JSON.stringify(bodyPayload)
                });

                const data = await response.json();

                if (!response.ok || !data.url) {
                    throw new Error(data.error || 'No se pudo iniciar la sesión de Stripe.');
                }

                // Redirect user to Stripe Checkout
                window.location.href = data.url;

            } catch (err) {
                console.error('Error initiating checkout:', err);
                Swal.fire('Error de Pago', err.message || 'No se pudo procesar la orden en este momento.', 'error');
            }
        },

        /**
         * Confirma el pago del lado servidor (`verify-checkout-session`).
         * El navegador solo aporta el session_id; el backend valida contra Stripe
         * y entrega los artículos. Si la función aún no está desplegada, se
         * reintenta leyendo los entitlements (el webhook ya los habrá creado).
         */
        async confirmCheckoutSession(sessionId, user, opts = {}) {
            const sb = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
            let token = '';
            if (sb?.auth) {
                const { data } = await sb.auth.getSession();
                token = data?.session?.access_token || '';
            }

            await this.loadEntitlements(user, true);
            const ownedBefore = this.getEntitlements(user?.id).length;

            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-checkout-session`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': SUPABASE_KEY,
                            'Authorization': `Bearer ${token || SUPABASE_KEY}`
                        },
                        body: JSON.stringify({ session_id: sessionId })
                    });

                    if (res.status === 404) {
                        // Función no desplegada todavía: se usa el webhook como fuente
                        break;
                    }

                    const data = await res.json().catch(() => ({}));

                    if (res.ok && data.ok) {
                        if (Array.isArray(data.entitlements)) {
                            this.applyGrantedEntitlements(data.entitlements, user);
                        }
                        await this.refreshUserFromDb(user);
                        return true;
                    }

                    // Pago aún no confirmado por Stripe: reintentar
                    if (res.status === 409) {
                        await new Promise(r => setTimeout(r, 2500));
                        continue;
                    }

                    console.warn('verify-checkout-session:', data.error || res.status);
                    break;
                } catch (e) {
                    console.warn('No se pudo verificar la sesión de pago:', e);
                    break;
                }
            }

            if (opts.expectEntitlement === false) return false;

            // Fallback: el webhook pudo haber entregado ya los artículos
            for (let attempt = 0; attempt < 5; attempt++) {
                await this.refreshUserFromDb(user);
                await this.loadEntitlements(user, true);
                if (this.getEntitlements(user?.id).length > ownedBefore) return true;
                await new Promise(r => setTimeout(r, 2000));
            }

            return false;
        },

        /**
         * Detecta `?payment=success` al volver de Stripe, confirma el pago con
         * el servidor y lanza la animación. Nunca desbloquea nada por sí solo.
         */
        async checkPostPaymentCallback(callbackMap = {}) {
            const params = new URLSearchParams(window.location.search);
            const paymentStatus = params.get('payment');
            const paymentType = params.get('type');
            const sessionId = params.get('session_id') || '';

            if (paymentStatus === 'canceled') {
                window.history.replaceState({}, document.title, window.location.pathname);
                Swal.fire({
                    title: 'Pago Cancelado',
                    text: 'La transacción no se completó. Puedes intentarlo nuevamente cuando desees.',
                    icon: 'info',
                    background: '#0d1527',
                    color: '#fff'
                });
                return;
            }

            if (paymentStatus !== 'success') return;

            const user = await this.getCurrentUser();
            if (!user) return;

            // Carrito / suscripción: los maneja cada vista con su propio callback
            if (paymentType === 'cart' || paymentType === 'subscription' || !paymentType) {
                if (sessionId) {
                    await this.confirmCheckoutSession(sessionId, user, {
                        expectEntitlement: paymentType !== 'subscription'
                    });
                }
                window.history.replaceState({}, document.title, window.location.pathname);
                if (typeof callbackMap[paymentType] === 'function') {
                    callbackMap[paymentType]({ session_id: sessionId });
                } else if (typeof callbackMap.default === 'function') {
                    callbackMap.default({ session_id: sessionId });
                }
                return;
            }

            let itemId = null;
            let itemCategory = 'Accesorio';
            let table = null;

            if (paymentType === 'accessory') {
                itemId = params.get('accessory_id');
                itemCategory = 'Accesorio';
                table = 'accessories';
            } else if (paymentType === 'sticker') {
                itemId = params.get('sticker_id');
                itemCategory = 'Sticker';
                table = 'stickers';
            } else if (paymentType === 'spirit') {
                itemId = params.get('spirit_id');
                itemCategory = 'Asistente 3D';
                table = 'spirits';
            } else if (paymentType === 'pack') {
                itemId = params.get('pack_id');
                itemCategory = 'Pack';
                table = 'product_packs';
            }

            // Confirmar contra el servidor (nunca escribir compras desde aquí)
            let verified = false;
            if (sessionId) {
                verified = await this.confirmCheckoutSession(sessionId, user);
            } else {
                // Sin session_id (URL antigua): solo se acepta si el webhook ya lo registró
                await this.refreshUserFromDb(user);
                await this.loadEntitlements(user, true);
                verified = itemId
                    ? this.hasUserPurchased(paymentType, itemId, user)
                    : this.getEntitlements(user.id).length > 0;
            }

            window.history.replaceState({}, document.title, window.location.pathname);

            if (!verified) {
                Swal.fire({
                    title: 'Pago en proceso',
                    text: 'Tu pago se está confirmando. Si ya se cobró, el artículo aparecerá en tu cuenta en unos segundos; recarga la página si no lo ves.',
                    icon: 'info',
                    background: '#0d1527',
                    color: '#fff'
                });
                return;
            }

            let itemData = null;
            if (itemId && table && window._supabase) {
                const { data } = await window._supabase.from(table).select('*').eq('id', itemId).maybeSingle();
                itemData = data;
            }
            if (!itemData && itemId) {
                // Artículo borrado del catálogo: se usa el snapshot del entitlement
                const owned = this.getOwnedSnapshots(paymentType, user);
                itemData = owned.find(it => String(it.id) === String(itemId)) || null;
            }

            const displayImg = itemData?.image_url || itemData?.url || itemData?.poster_url || itemData?.gltf_url || '';
            const displayName = itemData?.name || `${itemCategory} Desbloqueado`;

            await this.playAcquisitionAnimation({
                imageUrl: displayImg,
                name: displayName,
                category: itemCategory,
                onComplete: () => {
                    if (typeof callbackMap[paymentType] === 'function') {
                        callbackMap[paymentType](itemData || { id: itemId });
                    }
                }
            });
        }
    };

    TCGPurchase.init();
    window.TCGPurchase = TCGPurchase;

})(window, jQuery);
