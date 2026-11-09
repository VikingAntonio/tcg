// ====================================================================
// ADVANCED NOTIFICATION MANAGER (docs/js/notifications.js)
// Supports Store Sales & Broadcast Announcements with Strikethrough & Delete
// ====================================================================

(function() {
    let knownSalesCount = 0;
    let initialLoadDone = false;
    let salesPollingInterval = null;
    let activeNotifications = [];

    function injectNotificationStyles() {
        if ($('#viking-notification-styles').length > 0) return;

        const css = `
            .user-notifications-container {
                position: relative;
                display: inline-block;
            }
            .notifications-dropdown-menu {
                display: none;
                position: absolute;
                top: 48px;
                right: 0;
                width: 390px;
                max-width: 95vw;
                max-height: 560px;
                background: linear-gradient(165deg, rgba(13, 20, 36, 0.98) 0%, rgba(8, 12, 22, 0.99) 100%);
                backdrop-filter: blur(24px);
                -webkit-backdrop-filter: blur(24px);
                border: 1.5px solid rgba(0, 210, 255, 0.45);
                border-radius: 20px;
                box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(0, 210, 255, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15);
                z-index: 99999;
                overflow: hidden;
                flex-direction: column;
                font-family: 'Montserrat', system-ui, -apple-system, sans-serif;
            }
            .notifications-dropdown-menu.active {
                display: flex;
                animation: gameHudSlideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            @keyframes gameHudSlideDown {
                from { opacity: 0; transform: translateY(-12px) scale(0.97); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .notifications-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 14px 18px;
                background: linear-gradient(90deg, rgba(0, 210, 255, 0.2) 0%, rgba(147, 51, 234, 0.15) 100%);
                border-bottom: 1.5px solid rgba(0, 210, 255, 0.3);
                font-weight: 800;
                font-size: 0.92rem;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                color: #e0f2fe;
                text-shadow: 0 0 10px rgba(0, 210, 255, 0.6);
            }
            .notifications-actions-bar {
                display: flex;
                gap: 8px;
            }
            .btn-clear-notifications, .btn-purge-notifications {
                background: rgba(255,255,255,0.06);
                border: 1px solid rgba(255,255,255,0.18);
                color: #cbd5e1;
                cursor: pointer;
                font-size: 0.72rem;
                padding: 5px 10px;
                border-radius: 8px;
                font-weight: 700;
                letter-spacing: 0.3px;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .btn-clear-notifications:hover {
                background: rgba(0, 255, 136, 0.2);
                color: #00ff88;
                border-color: #00ff88;
                box-shadow: 0 0 10px rgba(0, 255, 136, 0.3);
                transform: translateY(-1px);
            }
            .btn-purge-notifications:hover {
                background: rgba(255, 71, 87, 0.2);
                color: #ff4757;
                border-color: #ff4757;
                box-shadow: 0 0 10px rgba(255, 71, 87, 0.3);
                transform: translateY(-1px);
            }
            .notifications-list {
                overflow-y: auto;
                max-height: 450px;
                padding: 14px;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .notifications-list::-webkit-scrollbar {
                width: 6px;
            }
            .notifications-list::-webkit-scrollbar-thumb {
                background: rgba(0, 210, 255, 0.3);
                border-radius: 4px;
            }
            .notification-card {
                background: linear-gradient(135deg, rgba(22, 32, 54, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 14px;
                padding: 14px 15px;
                font-size: 0.82rem;
                color: #e2e8f0;
                transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            .notification-card:hover {
                border-color: rgba(0, 210, 255, 0.4);
                transform: translateY(-1px);
                box-shadow: 0 6px 18px rgba(0,0,0,0.45);
            }
            .notification-card.unread {
                border-color: rgba(0, 210, 255, 0.5);
                background: linear-gradient(135deg, rgba(0, 210, 255, 0.1) 0%, rgba(15, 23, 42, 0.95) 100%);
                box-shadow: 0 4px 16px rgba(0, 210, 255, 0.15), inset 0 0 15px rgba(0, 210, 255, 0.05);
            }
            .notification-card.type-gift {
                border-color: rgba(168, 85, 247, 0.45);
                background: linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(15, 23, 42, 0.95) 100%);
                box-shadow: 0 4px 16px rgba(168, 85, 247, 0.15);
            }
            .notification-card.type-gift.unread {
                border-color: rgba(192, 132, 252, 0.7);
                box-shadow: 0 4px 20px rgba(168, 85, 247, 0.25), inset 0 0 20px rgba(168, 85, 247, 0.08);
            }
            .notification-card.completed {
                opacity: 0.5;
                filter: grayscale(45%);
            }
            .notification-card.completed .notif-title-text,
            .notification-card.completed .notif-body-text {
                text-decoration: line-through;
                color: #94a3b8;
            }
            .notif-title-row {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 10px;
                margin-bottom: 8px;
            }
            .notif-title-text {
                font-weight: 800;
                color: #00ff88;
                font-size: 0.92rem;
                line-height: 1.3;
                letter-spacing: 0.2px;
            }
            .notif-title-text.broadcast {
                color: #38bdf8;
            }
            .notif-title-text.gift {
                color: #e879f9;
                text-shadow: 0 0 8px rgba(232, 121, 249, 0.4);
            }
            .notif-card-actions {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-shrink: 0;
            }
            .btn-notif-action {
                background: rgba(255, 255, 255, 0.06);
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: #94a3b8;
                border-radius: 8px;
                width: 26px;
                height: 26px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 0.72rem;
                transition: all 0.2s;
            }
            .btn-notif-action.strike:hover {
                background: rgba(56, 189, 248, 0.25);
                color: #38bdf8;
                border-color: #38bdf8;
                box-shadow: 0 0 8px rgba(56, 189, 248, 0.3);
            }
            .btn-notif-action.delete:hover {
                background: rgba(239, 68, 68, 0.25);
                color: #ef4444;
                border-color: #ef4444;
                box-shadow: 0 0 8px rgba(239, 68, 68, 0.3);
            }
            .notif-body-text {
                font-size: 0.82rem;
                color: #cbd5e1;
                line-height: 1.45;
                margin-bottom: 10px;
                word-break: break-word;
            }
            .notif-gallery {
                display: flex;
                gap: 8px;
                overflow-x: auto;
                margin-bottom: 10px;
                padding-bottom: 4px;
            }
            .notif-gallery-img {
                width: 64px;
                height: 64px;
                object-fit: cover;
                border-radius: 10px;
                border: 1.5px solid rgba(0, 210, 255, 0.3);
                cursor: pointer;
                transition: transform 0.2s;
                background: #000;
            }
            .notif-gallery-img:hover {
                transform: scale(1.08);
                border-color: #00f3ff;
                box-shadow: 0 0 10px rgba(0, 243, 255, 0.4);
            }
            .notif-meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 0.72rem;
                color: #94a3b8;
                margin-top: 8px;
            }
            .notif-badge-type {
                background: rgba(0, 210, 255, 0.12);
                color: #00d2ff;
                border: 1px solid rgba(0, 210, 255, 0.3);
                padding: 3px 9px;
                border-radius: 12px;
                font-weight: 800;
                font-size: 0.68rem;
                letter-spacing: 0.5px;
            }
            .btn-claim-gift-action {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                width: 100%;
                margin: 10px 0 4px 0;
                padding: 10px 16px;
                background: linear-gradient(135deg, #a855f7 0%, #7e22ce 50%, #6b21a8 100%);
                color: #ffffff !important;
                border: 1px solid #d8b4fe;
                border-radius: 12px;
                font-weight: 800;
                font-size: 0.86rem;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                cursor: pointer;
                position: relative;
                overflow: hidden;
                box-shadow: 0 6px 18px rgba(168, 85, 247, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.35), inset 0 -2px 0 rgba(0, 0, 0, 0.3);
                transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .btn-claim-gift-action:before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 60%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.35), transparent);
                transform: skewX(-20deg);
                animation: gameBtnShimmer 2.8s infinite;
            }
            @keyframes gameBtnShimmer {
                0% { left: -100%; }
                40%, 100% { left: 180%; }
            }
            .btn-claim-gift-action:hover {
                background: linear-gradient(135deg, #c084fc 0%, #9333ea 50%, #7e22ce 100%);
                box-shadow: 0 8px 24px rgba(168, 85, 247, 0.65), 0 0 15px rgba(216, 180, 254, 0.5);
                transform: translateY(-2px) scale(1.01);
            }
            .btn-claim-gift-action:active {
                transform: translateY(1px) scale(0.99);
                box-shadow: 0 2px 8px rgba(168, 85, 247, 0.4);
            }
            .btn-claim-gift-action:disabled {
                opacity: 0.65;
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
            }
            .notifications-empty {
                text-align: center;
                padding: 40px 15px;
                color: #64748b;
                font-size: 0.88rem;
                font-weight: 600;
            }
        `;
        $('<style id="viking-notification-styles">').text(css).appendTo('head');
    }

    function injectNotificationPill() {
        if ($('#notification-btn').length > 0) return;

        const $pillPanel = $('.pill-panel');
        if ($pillPanel.length === 0) return;

        const html = `
            <div class="user-notifications-container" id="user-notifications-container">
                <button class="pill-icon" id="notification-btn" title="Notificaciones" style="position: relative;">
                    <i class="fas fa-bell"></i>
                    <span id="notification-badge" class="nav-badge" style="display: none; position: absolute; top: -4px; right: -4px; background: #ff4757; color: white; font-size: 10px; font-weight: bold; padding: 2px 5px; border-radius: 10px; line-height: 1;">0</span>
                </button>
                <div class="notifications-dropdown-menu" id="notifications-dropdown">
                    <div class="notifications-header">
                        <span><i class="fas fa-bell"></i> Notificaciones</span>
                        <div class="notifications-actions-bar">
                            <button class="btn-clear-notifications" id="btn-clear-notifications" title="Tachar todas / Marcar leídas"><i class="fas fa-check-double"></i> Tachar</button>
                            <button class="btn-purge-notifications" id="btn-purge-notifications" title="Eliminar todas"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                    <div class="notifications-list" id="notifications-list">
                        <div class="notifications-empty"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>
                    </div>
                </div>
            </div>
        `;

        if ($('#cart-btn').length > 0) {
            $(html).insertBefore('#cart-btn');
        } else if ($('.user-menu-container').length > 0) {
            $(html).insertBefore('.user-menu-container');
        } else {
            $pillPanel.append(html);
        }
    }

    async function getUserSession() {
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.id) {
            return currentUser;
        }
        if (typeof _supabase !== 'undefined') {
            try {
                const { data: { session } } = await _supabase.auth.getSession();
                if (session && session.user) return session.user;
            } catch (e) {}
        }
        const stored = localStorage.getItem('tcg_session');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed && parsed.id) return parsed;
            } catch (e) {}
        }
        return null;
    }

    async function checkNotifications() {
        const user = await getUserSession();
        if (!user || typeof _supabase === 'undefined') return;

        try {
            // 1. Fetch Store Sales & Binder Sales Notifications
            const salesPromise = _supabase
                .from('sealed_product_sales')
                .select('*')
                .eq('seller_id', user.id)
                .order('created_at', { ascending: false })
                .limit(15);

            const binderSalesPromise = _supabase
                .from('binder_sales')
                .select('*')
                .eq('seller_id', user.id)
                .order('created_at', { ascending: false })
                .limit(15);

            // 2. Fetch Broadcast App Notifications
            const targetFilter = (user.role === 'admin' || user.role === 'admin_store') ? 'all' : (user.role || 'starter');
            const broadcastPromise = _supabase
                .from('app_notifications')
                .select('*')
                .or(`target_role.eq.all,target_role.eq.${targetFilter}`)
                .order('created_at', { ascending: false })
                .limit(15);

            // 3. Fetch Active Gift Campaigns & User Claims
            const giftsPromise = _supabase
                .from('gift_campaigns')
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            const giftClaimsPromise = _supabase
                .from('gift_claims')
                .select('campaign_id')
                .eq('user_id', user.id);

            // 4. Fetch User States (read / deleted)
            const statesPromise = _supabase
                .from('user_notification_states')
                .select('*')
                .eq('user_id', user.id);

            const [salesRes, binderSalesRes, broadcastRes, giftsRes, giftClaimsRes, statesRes] = await Promise.all([
                salesPromise,
                binderSalesPromise,
                broadcastPromise,
                giftsPromise,
                giftClaimsPromise,
                statesPromise
            ]);

            const sales = salesRes.data || [];
            const binderSales = binderSalesRes.data || [];
            const broadcasts = broadcastRes.data || [];
            const rawGifts = giftsRes.data || [];
            const claimedCampaignIds = (giftClaimsRes.data || []).map(c => String(c.campaign_id));
            const statesMap = {};

            if (statesRes.data) {
                statesRes.data.forEach(st => {
                    statesMap[st.notification_id] = st;
                });
            }

            const combined = [];

            // Add binder sales items
            binderSales.forEach(bsale => {
                let itemsText = '';
                if (Array.isArray(bsale.items) && bsale.items.length > 0) {
                    itemsText = bsale.items.map(i => `${i.cart_quantity || 1}x ${i.name || 'Carta'}`).join(', ');
                } else {
                    itemsText = 'Cartas de Binder';
                }

                const localState = statesMap[bsale.id];
                if (localState && localState.is_deleted) return;

                const statusLabel = bsale.status === 'confirmada' ? 'Venta Confirmada' : (bsale.status === 'cancelada' ? 'Cancelada' : 'Pendiente de Confirmar');

                combined.push({
                    id: bsale.id,
                    type: 'sale',
                    title: `¡Pedido de Binder! @${bsale.buyer_username || 'Cliente'}`,
                    body: `${itemsText} - $${parseFloat(bsale.total_amount || 0).toFixed(2)} (${statusLabel})`,
                    images: [],
                    is_read: localState ? localState.is_read : !!bsale.is_read,
                    created_at: bsale.created_at
                });
            });

            // Add sales items
            sales.forEach(sale => {
                let itemsText = '';
                if (Array.isArray(sale.items) && sale.items.length > 0) {
                    itemsText = sale.items.map(i => `${i.cart_quantity || i.qty || 1}x ${i.name || 'Producto'}`).join(', ');
                } else if (typeof sale.items === 'string') {
                    itemsText = sale.items;
                } else {
                    itemsText = 'Producto Venta';
                }

                const localState = statesMap[sale.id];
                if (localState && localState.is_deleted) return;

                combined.push({
                    id: sale.id,
                    type: 'sale',
                    title: `¡Venta! ${sale.buyer_name || 'Cliente'}`,
                    body: `${itemsText} - $${parseFloat(sale.total_amount || 0).toFixed(2)} (${sale.payment_status || 'Pagado'})`,
                    images: [],
                    is_read: localState ? localState.is_read : !!sale.is_read,
                    created_at: sale.created_at
                });
            });

            // Add broadcast items
            broadcasts.forEach(bc => {
                const localState = statesMap[bc.id];
                if (localState && localState.is_deleted) return;

                let bodyText = '';
                if (Array.isArray(bc.messages)) {
                    bodyText = bc.messages.join('\n');
                } else if (typeof bc.messages === 'string') {
                    bodyText = bc.messages;
                }

                combined.push({
                    id: bc.id,
                    type: 'broadcast',
                    title: bc.title || 'Aviso de Viking TCG',
                    body: bodyText,
                    images: Array.isArray(bc.images) ? bc.images : [],
                    is_read: localState ? localState.is_read : false,
                    created_at: bc.created_at
                });
            });

            // Add Gift Campaign items targeted to this user and not yet claimed
            const now = new Date();
            const userRole = (user.role || 'starter').toLowerCase();

            rawGifts.forEach(gift => {
                const giftId = String(gift.id);
                // Skip if already claimed by this user
                if (claimedCampaignIds.includes(giftId)) return;

                // Check expiration
                if (gift.expires_at && new Date(gift.expires_at) < now) return;

                // Audience validation
                if (gift.target_type === 'plan') {
                    if (gift.target_plan && gift.target_plan.toLowerCase() !== userRole && userRole !== 'admin') {
                        return;
                    }
                } else if (gift.target_type === 'specific_users') {
                    const targetUsers = Array.isArray(gift.target_users) ? gift.target_users.map(String) : [];
                    if (!targetUsers.includes(String(user.id)) && userRole !== 'admin') {
                        return;
                    }
                }

                const localState = statesMap[gift.id];
                if (localState && localState.is_deleted) return;

                // Build item descriptions
                const items = Array.isArray(gift.items) ? gift.items : [];
                const itemsSummary = items.map(it => `${it.quantity || 1}x ${it.name || 'Artículo'}`).join(', ');
                const fullMsg = gift.custom_message || gift.description || '';
                const bodyMsg = fullMsg ? `${fullMsg}\n🎁 Incluye: ${itemsSummary}` : `🎁 Incluye: ${itemsSummary}`;

                const images = [];
                if (gift.image_url) images.push(gift.image_url);
                items.forEach(it => {
                    if (it.image_url && !images.includes(it.image_url)) images.push(it.image_url);
                });

                combined.push({
                    id: gift.id,
                    type: 'gift',
                    title: `🎁 ¡Regalo Disponible!: ${gift.title}`,
                    body: bodyMsg,
                    images: images,
                    giftCampaign: gift,
                    is_read: localState ? localState.is_read : false,
                    created_at: gift.created_at
                });
            });

            // Sort combined list descending
            combined.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

            activeNotifications = combined;

            const unreadCount = combined.filter(n => !n.is_read).length;
            const $badge = $('#notification-badge');
            if (unreadCount > 0) {
                $badge.text(unreadCount > 99 ? '99+' : unreadCount).show();
            } else {
                $badge.hide();
            }

            // Proactive chatbot notification on new items
            if (initialLoadDone && unreadCount > knownSalesCount) {
                const newest = combined.find(n => !n.is_read);
                if (newest && window.botInstance && typeof window.botInstance.say === 'function') {
                    window.botInstance.say(`¡Atención! Nueva notificación: ${newest.title}`, 12000, true);
                }
            }

            knownSalesCount = unreadCount;
            initialLoadDone = true;

            renderNotificationsList(combined);

        } catch (e) {
            console.warn("Error checking notifications:", e);
        }
    }

    function renderNotificationsList(list) {
        const $container = $('#notifications-list');
        if (!$container.length) return;

        $container.empty();

        if (!list || list.length === 0) {
            $container.html('<div class="notifications-empty"><i class="fas fa-box-open" style="font-size: 1.8rem; display: block; margin-bottom: 8px; opacity: 0.5;"></i>No tienes notificaciones por ahora.</div>');
            return;
        }

        list.forEach(item => {
            const isRead = !!item.is_read;
            const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Reciente';

            let imagesHtml = '';
            if (item.images && item.images.length > 0) {
                imagesHtml = `<div class="notif-gallery">${item.images.map(img => `<img src="${img}" class="notif-gallery-img" onclick="openNotifImageModal('${img.replace(/'/g, "\\'")}')">`).join('')}</div>`;
            }

            let giftClaimBtnHtml = '';
            if (item.type === 'gift' && item.giftCampaign) {
                giftClaimBtnHtml = `
                    <button type="button" class="btn-claim-gift-action" data-gift-id="${item.id}">
                        <i class="fas fa-gift"></i> Reclamar Regalo
                    </button>
                `;
            }

            const typeClass = item.type === 'gift' ? 'type-gift' : '';
            const $card = $(`
                <div class="notification-card ${!isRead ? 'unread' : 'completed'} ${typeClass}" data-id="${item.id}">
                    <div class="notif-title-row">
                        <div class="notif-title-text ${item.type}">${item.title}</div>
                        <div class="notif-card-actions">
                            <button class="btn-notif-action strike" title="${isRead ? 'Destachar' : 'Tachar / Leer'}"><i class="fas ${isRead ? 'fa-undo' : 'fa-check'}"></i></button>
                            <button class="btn-notif-action delete" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>
                    <div class="notif-body-text">${escapeHtml(item.body).replace(/\n/g, '<br>')}</div>
                    ${imagesHtml}
                    ${giftClaimBtnHtml}
                    <div class="notif-meta" style="margin-top: 8px;">
                        <span class="notif-badge-type" style="${item.type === 'gift' ? 'background: rgba(168, 85, 247, 0.2); color: #c084fc; border-color: rgba(168, 85, 247, 0.4);' : ''}">${item.type === 'sale' ? 'VENTA' : item.type === 'gift' ? 'REGALO' : 'NOVEDAD'}</span>
                        <span>${dateStr}</span>
                    </div>
                </div>
            `);

            if (item.type === 'gift' && item.giftCampaign) {
                $card.find('.btn-claim-gift-action').click(async function(e) {
                    e.stopPropagation();
                    const $btn = $(this);
                    $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Reclamando...');
                    try {
                        await window.claimGiftItem(item.giftCampaign);
                        await checkNotifications();
                    } catch (err) {
                        $btn.prop('disabled', false).html('<i class="fas fa-gift"></i> Reclamar Regalo');
                    }
                });
            }

            $card.find('.btn-notif-action.strike').click(async function(e) {
                e.stopPropagation();
                await toggleNotificationRead(item.id, !isRead, item.type);
            });

            $card.find('.btn-notif-action.delete').click(async function(e) {
                e.stopPropagation();
                await deleteNotification(item.id, item.type);
            });

            $container.append($card);
        });
    }

    async function toggleNotificationRead(notifId, newReadStatus, type) {
        const user = await getUserSession();
        if (!user || typeof _supabase === 'undefined') return;

        try {
            if (type === 'sale') {
                await _supabase.from('sealed_product_sales').update({ is_read: newReadStatus }).eq('id', notifId);
            }

            await _supabase.from('user_notification_states').upsert([{
                user_id: user.id,
                notification_id: notifId,
                is_read: newReadStatus,
                updated_at: new Date().toISOString()
            }], { onConflict: 'user_id,notification_id' });

            await checkNotifications();
        } catch (e) { console.error("Error toggling read status:", e); }
    }

    async function deleteNotification(notifId, type) {
        const user = await getUserSession();
        if (!user || typeof _supabase === 'undefined') return;

        try {
            await _supabase.from('user_notification_states').upsert([{
                user_id: user.id,
                notification_id: notifId,
                is_deleted: true,
                updated_at: new Date().toISOString()
            }], { onConflict: 'user_id,notification_id' });

            await checkNotifications();
        } catch (e) { console.error("Error deleting notification:", e); }
    }

    async function markAllAsRead() {
        const user = await getUserSession();
        if (!user || typeof _supabase === 'undefined') return;

        try {
            for (const n of activeNotifications) {
                if (!n.is_read) {
                    await toggleNotificationRead(n.id, true, n.type);
                }
            }
        } catch (e) { console.error("Error marking all read:", e); }
    }

    async function purgeAll() {
        const user = await getUserSession();
        if (!user || typeof _supabase === 'undefined') return;

        const { isConfirmed } = await Swal.fire({
            title: '¿Eliminar todas las notificaciones?',
            text: 'Esta acción no se puede deshacer.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Sí, eliminar todas'
        });

        if (isConfirmed) {
            try {
                for (const n of activeNotifications) {
                    await deleteNotification(n.id, n.type);
                }
            } catch (e) { console.error("Error purging all:", e); }
        }
    }

    window.openNotifImageModal = function(imgUrl) {
        Swal.fire({
            imageUrl: imgUrl,
            showConfirmButton: false,
            showCloseButton: true,
            background: '#0f172a',
            color: '#fff'
        });
    };

    function initNotificationUI() {
        injectNotificationStyles();
        injectNotificationPill();

        $(document).off('click', '#notification-btn').on('click', '#notification-btn', function(e) {
            e.stopPropagation();
            $('#notifications-dropdown').toggleClass('active');
            checkNotifications();
        });

        $(document).off('click', '#btn-clear-notifications').on('click', '#btn-clear-notifications', function(e) {
            e.stopPropagation();
            markAllAsRead();
        });

        $(document).off('click', '#btn-purge-notifications').on('click', '#btn-purge-notifications', function(e) {
            e.stopPropagation();
            purgeAll();
        });

        $(document).on('click', function(e) {
            if (!$(e.target).closest('#user-notifications-container').length) {
                $('#notifications-dropdown').removeClass('active');
            }
        });

        checkNotifications();
        if (!salesPollingInterval) {
            salesPollingInterval = setInterval(checkNotifications, 15000);
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    $(document).ready(function() {
        setTimeout(initNotificationUI, 300);
    });

    window.VikingNotifications = {
        check: checkNotifications,
        markAllAsRead: markAllAsRead,
        purgeAll: purgeAll
    };
})();


// ==========================================
// ==========================================
// VIDEO GAME GIFT OPENING ANIMATION SEQUENCE
// ==========================================
function playGiftOpeningSequence(giftCampaign) {
    return new Promise((resolve) => {
        // Inject styles if not already present
        if (!$('#gift-opening-anim-styles').length) {
            $('<style id="gift-opening-anim-styles">').text(`
                .gift-opening-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: radial-gradient(circle at center, rgba(30, 20, 60, 0.96) 0%, rgba(5, 8, 18, 0.99) 100%);
                    z-index: 100000;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    animation: giftOverlayFadeIn 0.3s ease-out forwards;
                    font-family: 'Montserrat', system-ui, sans-serif;
                    overflow: hidden;
                    user-select: none;
                }
                @keyframes giftOverlayFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .gift-opening-rays {
                    position: absolute;
                    width: 700px;
                    height: 700px;
                    border-radius: 50%;
                    background: conic-gradient(from 0deg, rgba(168, 85, 247, 0.25), transparent 45deg, rgba(236, 72, 153, 0.3) 90deg, transparent 135deg, rgba(0, 210, 255, 0.25) 180deg, transparent 225deg, rgba(168, 85, 247, 0.25) 270deg, transparent 315deg, rgba(236, 72, 153, 0.3) 360deg);
                    animation: giftRaysSpin 12s linear infinite;
                    pointer-events: none;
                }
                @keyframes giftRaysSpin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .gift-box-container {
                    position: relative;
                    width: 180px;
                    height: 180px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    z-index: 2;
                }
                .gift-box-wrapper {
                    position: relative;
                    width: 140px;
                    height: 140px;
                    animation: giftBoxFloat 2s ease-in-out infinite;
                }
                @keyframes giftBoxFloat {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-12px); }
                }
                .gift-box-wrapper.shaking {
                    animation: giftBoxShake 0.6s ease-in-out infinite !important;
                }
                @keyframes giftBoxShake {
                    0%, 100% { transform: rotate(0deg) scale(1); }
                    20% { transform: rotate(-8deg) scale(1.05); }
                    40% { transform: rotate(8deg) scale(1.08); }
                    60% { transform: rotate(-6deg) scale(1.1); }
                    80% { transform: rotate(6deg) scale(1.12); }
                }
                .gift-box-base {
                    position: absolute;
                    bottom: 0;
                    left: 10px;
                    width: 120px;
                    height: 90px;
                    background: linear-gradient(145deg, #a855f7, #6b21a8);
                    border-radius: 12px;
                    border: 2px solid #d8b4fe;
                    box-shadow: 0 15px 35px rgba(147, 51, 234, 0.5), inset 0 2px 0 rgba(255, 255, 255, 0.3);
                }
                .gift-box-base::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 48px;
                    width: 24px;
                    height: 100%;
                    background: linear-gradient(180deg, #fef08a, #eab308);
                    box-shadow: 0 0 10px rgba(250, 204, 21, 0.6);
                }
                .gift-box-lid {
                    position: absolute;
                    top: 25px;
                    left: 2px;
                    width: 136px;
                    height: 35px;
                    background: linear-gradient(145deg, #c084fc, #7e22ce);
                    border-radius: 10px;
                    border: 2px solid #f3e8ff;
                    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4), inset 0 2px 0 rgba(255, 255, 255, 0.4);
                    transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .gift-box-lid::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 56px;
                    width: 24px;
                    height: 100%;
                    background: linear-gradient(180deg, #fef08a, #eab308);
                }
                .gift-box-bow {
                    position: absolute;
                    top: 5px;
                    left: 50px;
                    width: 40px;
                    height: 25px;
                    display: flex;
                    justify-content: center;
                }
                .gift-box-bow::before, .gift-box-bow::after {
                    content: '';
                    width: 20px;
                    height: 20px;
                    border: 3px solid #fde047;
                    border-radius: 50% 50% 0 50%;
                    background: #eab308;
                    box-shadow: 0 0 10px rgba(250, 204, 21, 0.6);
                }
                .gift-box-bow::after {
                    border-radius: 50% 50% 50% 0;
                }
                .gift-box-wrapper.opened .gift-box-lid {
                    transform: translateY(-90px) rotate(-35deg) scale(1.1);
                    opacity: 0;
                }
                .gift-box-wrapper.opened .gift-box-base {
                    transform: scale(0.9);
                    filter: brightness(1.2);
                    box-shadow: 0 0 50px rgba(250, 204, 21, 0.8), 0 0 100px rgba(168, 85, 247, 0.8);
                }
                .gift-burst-sparks {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 10px;
                    height: 10px;
                    transform: translate(-50%, -50%);
                    pointer-events: none;
                }
                .gift-spark {
                    position: absolute;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #fde047;
                    box-shadow: 0 0 12px #fde047;
                    animation: giftSparkShoot 0.8s ease-out forwards;
                }
                @keyframes giftSparkShoot {
                    0% { transform: translate(0, 0) scale(1); opacity: 1; }
                    100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
                }
                .gift-opening-title {
                    margin-top: 35px;
                    font-size: 1.35rem;
                    font-weight: 800;
                    color: #f8fafc;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    text-align: center;
                    text-shadow: 0 0 15px rgba(168, 85, 247, 0.7);
                    z-index: 2;
                }
                .gift-opening-sub {
                    margin-top: 8px;
                    font-size: 0.95rem;
                    color: #cbd5e1;
                    letter-spacing: 0.5px;
                    text-align: center;
                    z-index: 2;
                }
            `).appendTo('head');
        }

        const title = (giftCampaign && giftCampaign.title) || 'Recompensa Especial';
        const $overlay = $(`
            <div class="gift-opening-overlay">
                <div class="gift-opening-rays"></div>
                <div class="gift-box-container">
                    <div class="gift-box-wrapper shaking">
                        <div class="gift-box-bow"></div>
                        <div class="gift-box-lid"></div>
                        <div class="gift-box-base"></div>
                    </div>
                    <div class="gift-burst-sparks"></div>
                </div>
                <div class="gift-opening-title">🎁 ¡Abriendo Regalo!</div>
                <div class="gift-opening-sub">${title}</div>
            </div>
        `).appendTo('body');

        // Play shaking, then pop open after 900ms
        setTimeout(() => {
            const $wrapper = $overlay.find('.gift-box-wrapper');
            $wrapper.removeClass('shaking').addClass('opened');
            $overlay.find('.gift-opening-title').text('✨ ¡RECOMPENSA DESBLOQUEADA! ✨');

            // Generate particles / sparks
            const $sparks = $overlay.find('.gift-burst-sparks');
            const colors = ['#fde047', '#38bdf8', '#c084fc', '#f43f5e', '#4ade80'];
            for (let i = 0; i < 32; i++) {
                const angle = (i / 32) * 2 * Math.PI;
                const distance = 80 + Math.random() * 140;
                const dx = `${Math.cos(angle) * distance}px`;
                const dy = `${Math.sin(angle) * distance}px`;
                const bg = colors[i % colors.length];
                const $spark = $(`<div class="gift-spark" style="--dx: ${dx}; --dy: ${dy}; background: ${bg}; box-shadow: 0 0 12px ${bg};"></div>`);
                $sparks.append($spark);
            }

            // After celebration frame, clean up overlay and proceed to reward celebration
            setTimeout(() => {
                $overlay.fadeOut(300, function() {
                    $(this).remove();
                    resolve();
                });
            }, 1000);
        }, 900);
    });
}

// GIFT CLAIMING LOGIC FOR NOTIFICATIONS
// ==========================================
async function claimGiftItem(giftCampaign) {
    if (!giftCampaign || !giftCampaign.id) return;

    // Check if expired
    if (giftCampaign.expires_at && new Date() > new Date(giftCampaign.expires_at)) {
        Swal.fire('Regalo Expirado', 'Lo sentimos, el periodo para reclamar este regalo ha finalizado.', 'warning');
        return;
    }

    try {
        const { data: { session } } = await _supabase.auth.getSession();
        let userId = session ? session.user.id : null;
        if (!userId) {
            const raw = localStorage.getItem('tcg_session');
            if (raw) {
                try { userId = JSON.parse(raw).id; } catch(e){}
            }
        }
        if (!userId) {
            Swal.fire('Inicia Sesión', 'Debes iniciar sesión para reclamar este regalo.', 'info');
            return;
        }

        // Verify if already claimed
        const { data: existingClaim } = await _supabase
            .from('gift_claims')
            .select('id')
            .eq('campaign_id', giftCampaign.id)
            .eq('user_id', userId)
            .maybeSingle();

        if (existingClaim) {
            Swal.fire('Ya Reclamado', 'Ya has reclamado los artículos de este regalo anteriormente.', 'info');
            return;
        }

        // Record claim
        const { error: claimErr } = await _supabase.from('gift_claims').insert([{
            campaign_id: giftCampaign.id,
            user_id: userId,
            delivered_items: giftCampaign.items
        }]);
        if (claimErr) throw claimErr;

        // Deliver items into user's inventory
        const { data: userData } = await _supabase.from('usuarios').select('*').eq('id', userId).single();
        if (userData) {
            let stickers = (userData.purchased_sticker_ids || '').split(',').map(s=>s.trim()).filter(Boolean);
            let accessories = (userData.purchased_accessory_ids || '').split(',').map(s=>s.trim()).filter(Boolean);
            let spirits = (userData.purchased_spirit_ids || '').split(',').map(s=>s.trim()).filter(Boolean);

            (giftCampaign.items || []).forEach(it => {
                const idStr = String(it.id);
                if (it.category === 'stickers' && !stickers.includes(idStr)) stickers.push(idStr);
                else if (it.category === 'spirits' && !spirits.includes(idStr)) spirits.push(idStr);
                else if (!accessories.includes(idStr)) accessories.push(idStr);
            });

            await _supabase.from('usuarios').update({
                purchased_sticker_ids: stickers.join(','),
                purchased_accessory_ids: accessories.join(','),
                purchased_spirit_ids: spirits.join(',')
            }).eq('id', userId);

            // Update local cache
            const raw = localStorage.getItem('tcg_session');
            if (raw) {
                try {
                    const u = JSON.parse(raw);
                    u.purchased_sticker_ids = stickers.join(',');
                    u.purchased_accessory_ids = accessories.join(',');
                    u.purchased_spirit_ids = spirits.join(',');
                    localStorage.setItem('tcg_session', JSON.stringify(u));
                } catch(e){}
            }
        }

        // 1. Play video game gift opening animation
        try {
            await playGiftOpeningSequence(giftCampaign);
        } catch(animErr) {
            console.warn('Gift anim sequence error:', animErr);
        }

        // 2. Play item acquisition celebration animation
        if (window.TCGPurchase && typeof window.TCGPurchase.playAcquisitionAnimation === 'function') {
            await window.TCGPurchase.playAcquisitionAnimation({
                name: giftCampaign.title,
                imageUrl: giftCampaign.image_url,
                category: 'Regalo Reclamado'
            });
        }

        Swal.fire({
            title: '¡Felicidades!',
            text: 'Has reclamado tu regalo exitosamente. Los artículos ya se encuentran en tu inventario.',
            icon: 'success',
            background: '#0f172a',
            color: '#f8fafc',
            confirmButtonColor: '#a855f7'
        });
        if (typeof loadNotifications === 'function') loadNotifications();
    } catch (err) {
        console.error('Error claiming gift:', err);
        Swal.fire('Error', 'No se pudo reclamar el regalo. Inténtalo más tarde.', 'error');
    }
}
window.claimGiftItem = claimGiftItem;
