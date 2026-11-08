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
         * Checks if the user already owns the given item
         * @param {string} type 'accessory' | 'sticker' | 'spirit'
         * @param {string|number} itemId
         * @param {object} user
         */
        hasUserPurchased(type, itemId, user) {
            if (!user || !itemId) return false;
            const strId = String(itemId);
            const userRole = (user.role || '').toLowerCase();
            if (userRole === 'admin') return true;

            if (type === 'accessory') {
                const list = (user.purchased_accessory_ids || '').split(',').map(s => s.trim()).filter(Boolean);
                return list.includes(strId);
            } else if (type === 'sticker') {
                const list = (user.purchased_sticker_ids || '').split(',').map(s => s.trim()).filter(Boolean);
                return list.includes(strId);
            } else if (type === 'spirit') {
                const list = (user.purchased_spirit_ids || '').split(',').map(s => s.trim()).filter(Boolean);
                return list.includes(strId);
            }
            return false;
        },

        /**
         * Records purchase in Supabase & memory immediately
         * @param {string} type 'accessory' | 'sticker' | 'spirit'
         * @param {string|number} itemId
         * @param {object} user
         */
        async recordUnlockInDatabase(type, itemId, user) {
            if (!user?.id || !itemId) return;
            const strId = String(itemId);

            let colName = '';
            if (type === 'accessory') colName = 'purchased_accessory_ids';
            else if (type === 'sticker') colName = 'purchased_sticker_ids';
            else if (type === 'spirit') colName = 'purchased_spirit_ids';
            if (!colName) return;

            // Consultar datos actualizados de Supabase si es posible para no perder compras previas
            let remoteList = [];
            const sbClient = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
            if (sbClient) {
                try {
                    const { data: dbUser } = await sbClient
                        .from('usuarios')
                        .select(colName)
                        .eq('id', user.id)
                        .maybeSingle();
                    if (dbUser && dbUser[colName]) {
                        remoteList = (dbUser[colName] || '').split(',').map(s => s.trim()).filter(Boolean);
                    }
                } catch (_) {}
            }

            const localList = (user[colName] || '').split(',').map(s => s.trim()).filter(Boolean);
            const mergedList = Array.from(new Set([...remoteList, ...localList]));

            if (!mergedList.includes(strId)) {
                mergedList.push(strId);
            }

            user[colName] = mergedList.join(',');

            // Sincronizar en memoria global de la app
            if (window.currentUser) window.currentUser[colName] = user[colName];
            if (window.CustomStoreState?.currentUser) window.CustomStoreState.currentUser[colName] = user[colName];

            try {
                // Actualizar cache local asegurando que tcg_session conserve el campo
                let cachedObj = {};
                try {
                    cachedObj = JSON.parse(localStorage.getItem('tcg_session') || '{}');
                } catch (_) {}
                const updatedSession = Object.assign({}, cachedObj, user);
                updatedSession[colName] = user[colName];
                localStorage.setItem('tcg_session', JSON.stringify(updatedSession));
            } catch (_) {}

            // Guardar en Supabase
            try {
                if (sbClient) {
                    const updateObj = {};
                    updateObj[colName] = user[colName];
                    if (type === 'spirit') {
                        updateObj.selected_spirit_id = itemId;
                    }
                    await sbClient
                        .from('usuarios')
                        .update(updateObj)
                        .eq('id', user.id);
                }
            } catch (e) {
                console.warn(`Notice updating ${colName}:`, e);
            }

            // Notificar a todos los escuchadores y pestañas en tiempo real
            try {
                window.dispatchEvent(new CustomEvent('tcg_item_unlocked', {
                    detail: { type, itemId: strId, list: user[colName] }
                }));
            } catch (_) {}
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
                        ${categoryLower.includes('coin') ? 'border-radius: 50%;' : ''}
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
         * Initiates Stripe checkout for an item (Accessory, Sticker, or Spirit)
         * If the user is admin or running in test/demo, handles direct unlock.
         */
        async purchaseItemViaStripe(type, item, options = {}) {
            const user = await this.getCurrentUser();
            if (!user || !user.id || user.id === '00000000-0000-0000-0000-000000000000') {
                Swal.fire('Inicia sesión', 'Debes iniciar sesión para realizar la compra.', 'info');
                return;
            }

            const itemName = item.name || 'Accesorio TCG';
            const price = Math.max(5, Number(item.price_mxn) || 25);
            const returnUrl = window.location.origin + window.location.pathname;

            // Confirm intent with a sleek TCG modal
            const { isConfirmed } = await Swal.fire({
                title: `¿Adquirir ${itemName}?`,
                html: `
                    <div style="text-align: center; margin: 15px 0;">
                        <img src="${item.image_url || item.url || ''}" style="max-height: 140px; border-radius: 10px; border: 2px solid #00d2ff; box-shadow: 0 0 20px rgba(0, 210, 255, 0.4); margin-bottom: 12px; object-fit: contain;">
                        <div style="font-size: 1.25rem; font-weight: 800; color: #ffd700;">$${price} MXN</div>
                        <p style="color: #94a3b8; font-size: 0.85rem; margin-top: 6px;">Desbloqueo permanente e ilimitado para tu cuenta.</p>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonColor: '#00d2ff',
                cancelButtonColor: '#334155',
                confirmButtonText: `<i class="fas fa-shopping-cart"></i> Comprar Ahora`,
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
         * Checks URL search params for payment=success and executes instant animation + unlock without reloading
         */
        async checkPostPaymentCallback(callbackMap = {}) {
            const params = new URLSearchParams(window.location.search);
            const paymentStatus = params.get('payment');
            const paymentType = params.get('type');

            if (paymentStatus === 'success') {
                const user = await this.getCurrentUser();
                if (!user) return;

                let itemId = null;
                let itemCategory = 'Accesorio';
                let itemData = null;

                if (paymentType === 'accessory') {
                    itemId = params.get('accessory_id');
                    itemCategory = 'Accesorio';
                    if (itemId && window._supabase) {
                        const { data } = await window._supabase.from('accessories').select('*').eq('id', itemId).maybeSingle();
                        itemData = data;
                    }
                } else if (paymentType === 'sticker') {
                    itemId = params.get('sticker_id');
                    itemCategory = 'Sticker';
                    if (itemId && window._supabase) {
                        const { data } = await window._supabase.from('stickers').select('*').eq('id', itemId).maybeSingle();
                        itemData = data;
                    }
                } else if (paymentType === 'spirit') {
                    itemId = params.get('spirit_id');
                    itemCategory = 'Asistente 3D';
                    if (itemId && window._supabase) {
                        const { data } = await window._supabase.from('spirits').select('*').eq('id', itemId).maybeSingle();
                        itemData = data;
                    }
                }

                if (itemId && user) {
                    await this.recordUnlockInDatabase(paymentType, itemId, user);

                    // Clean URL without reloading page
                    window.history.replaceState({}, document.title, window.location.pathname);

                    // Execute acquisition animation
                    const displayImg = itemData?.image_url || itemData?.url || itemData?.poster_url || '';
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
            } else if (paymentStatus === 'canceled') {
                window.history.replaceState({}, document.title, window.location.pathname);
                Swal.fire({
                    title: 'Pago Cancelado',
                    text: 'La transacción no se completó. Puedes intentarlo nuevamente cuando desees.',
                    icon: 'info',
                    background: '#0d1527',
                    color: '#fff'
                });
            }
        }
    };

    TCGPurchase.init();
    window.TCGPurchase = TCGPurchase;

})(window, jQuery);
