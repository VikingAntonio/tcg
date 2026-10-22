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
                top: 45px;
                right: 0;
                width: 360px;
                max-width: 92vw;
                max-height: 520px;
                background: rgba(15, 23, 42, 0.96);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(0, 210, 255, 0.35);
                border-radius: 20px;
                box-shadow: 0 20px 45px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 210, 255, 0.25);
                z-index: 99999;
                overflow: hidden;
                flex-direction: column;
            }
            .notifications-dropdown-menu.active {
                display: flex;
            }
            .notifications-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: rgba(0, 210, 255, 0.12);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                font-weight: 800;
                font-size: 0.88rem;
                color: #00d2ff;
            }
            .notifications-actions-bar {
                display: flex;
                gap: 8px;
            }
            .btn-clear-notifications, .btn-purge-notifications {
                background: rgba(255,255,255,0.08);
                border: 1px solid rgba(255,255,255,0.15);
                color: #e2e8f0;
                cursor: pointer;
                font-size: 0.75rem;
                padding: 4px 10px;
                border-radius: 8px;
                font-weight: 700;
                transition: all 0.2s;
            }
            .btn-clear-notifications:hover {
                background: rgba(0, 255, 136, 0.2);
                color: #00ff88;
                border-color: #00ff88;
            }
            .btn-purge-notifications:hover {
                background: rgba(255, 71, 87, 0.2);
                color: #ff4757;
                border-color: #ff4757;
            }
            .notifications-list {
                overflow-y: auto;
                max-height: 440px;
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .notification-card {
                background: rgba(30, 41, 59, 0.75);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 14px;
                padding: 12px 14px;
                font-size: 0.82rem;
                color: #e2e8f0;
                transition: all 0.25s ease;
                position: relative;
            }
            .notification-card.unread {
                border-color: rgba(0, 255, 136, 0.4);
                background: rgba(0, 255, 136, 0.06);
            }
            .notification-card.completed {
                opacity: 0.55;
                filter: grayscale(40%);
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
                gap: 8px;
                margin-bottom: 6px;
            }
            .notif-title-text {
                font-weight: 800;
                color: #00ff88;
                font-size: 0.9rem;
                line-height: 1.25;
            }
            .notif-title-text.broadcast {
                color: #38bdf8;
            }
            .notif-card-actions {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-shrink: 0;
            }
            .btn-notif-action {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: #cbd5e1;
                border-radius: 6px;
                width: 24px;
                height: 24px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 0.7rem;
                transition: all 0.2s;
            }
            .btn-notif-action.strike:hover {
                background: rgba(56, 189, 248, 0.3);
                color: #38bdf8;
                border-color: #38bdf8;
            }
            .btn-notif-action.delete:hover {
                background: rgba(239, 68, 68, 0.3);
                color: #ef4444;
                border-color: #ef4444;
            }
            .notif-body-text {
                font-size: 0.8rem;
                color: #cbd5e1;
                line-height: 1.35;
                margin-bottom: 8px;
            }
            .notif-gallery {
                display: flex;
                gap: 6px;
                overflow-x: auto;
                margin-bottom: 8px;
                padding-bottom: 4px;
            }
            .notif-gallery-img {
                width: 60px;
                height: 60px;
                object-fit: cover;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                cursor: pointer;
            }
            .notif-meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 0.72rem;
                color: #94a3b8;
            }
            .notif-badge-type {
                background: rgba(0, 210, 255, 0.15);
                color: #00d2ff;
                border: 1px solid rgba(0, 210, 255, 0.3);
                padding: 2px 8px;
                border-radius: 10px;
                font-weight: 800;
                font-size: 0.68rem;
            }
            .notifications-empty {
                text-align: center;
                padding: 35px 15px;
                color: #64748b;
                font-size: 0.85rem;
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
            // 1. Fetch Store Sales Notifications
            const salesPromise = _supabase
                .from('sealed_product_sales')
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

            // 3. Fetch User States (read / deleted)
            const statesPromise = _supabase
                .from('user_notification_states')
                .select('*')
                .eq('user_id', user.id);

            const [salesRes, broadcastRes, statesRes] = await Promise.all([salesPromise, broadcastPromise, statesPromise]);

            const sales = salesRes.data || [];
            const broadcasts = broadcastRes.data || [];
            const statesMap = {};

            if (statesRes.data) {
                statesRes.data.forEach(st => {
                    statesMap[st.notification_id] = st;
                });
            }

            const combined = [];

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

            const $card = $(`
                <div class="notification-card ${!isRead ? 'unread' : 'completed'}" data-id="${item.id}">
                    <div class="notif-title-row">
                        <div class="notif-title-text ${item.type}">${item.title}</div>
                        <div class="notif-card-actions">
                            <button class="btn-notif-action strike" title="${isRead ? 'Destachar' : 'Tachar / Leer'}"><i class="fas ${isRead ? 'fa-undo' : 'fa-check'}"></i></button>
                            <button class="btn-notif-action delete" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>
                    <div class="notif-body-text">${escapeHtml(item.body).replace(/\n/g, '<br>')}</div>
                    ${imagesHtml}
                    <div class="notif-meta">
                        <span class="notif-badge-type">${item.type === 'sale' ? 'VENTA' : 'NOVEDAD'}</span>
                        <span>${dateStr}</span>
                    </div>
                </div>
            `);

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
