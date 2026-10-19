// ====================================================================
// NOTIFICATION MANAGER FOR STORE SALES (docs/js/notifications.js)
// ====================================================================

(function() {
    let knownSalesCount = 0;
    let initialLoadDone = false;
    let salesPollingInterval = null;

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
                width: 320px;
                max-width: 90vw;
                max-height: 450px;
                background: rgba(15, 23, 42, 0.95);
                backdrop-filter: blur(16px);
                border: 1px solid rgba(0, 210, 255, 0.3);
                border-radius: 18px;
                box-shadow: 0 15px 35px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0, 210, 255, 0.2);
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
                background: rgba(0, 210, 255, 0.1);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                font-weight: 800;
                font-size: 0.85rem;
                color: #00d2ff;
            }
            .btn-clear-notifications {
                background: transparent;
                border: none;
                color: #ff4757;
                cursor: pointer;
                font-size: 0.85rem;
                padding: 4px 8px;
                border-radius: 6px;
                transition: background 0.2s;
            }
            .btn-clear-notifications:hover {
                background: rgba(255, 71, 87, 0.15);
            }
            .notifications-list {
                overflow-y: auto;
                max-height: 380px;
                padding: 10px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .notification-card {
                background: rgba(30, 41, 59, 0.7);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
                padding: 10px 12px;
                font-size: 0.82rem;
                color: #e2e8f0;
                transition: all 0.2s ease;
                position: relative;
            }
            .notification-card.unread {
                border-color: rgba(0, 255, 136, 0.4);
                background: rgba(0, 255, 136, 0.06);
            }
            .notification-card .notif-buyer {
                font-weight: 800;
                color: #00ff88;
                font-size: 0.88rem;
                margin-bottom: 4px;
            }
            .notification-card .notif-items {
                font-size: 0.78rem;
                color: #cbd5e1;
                margin-bottom: 6px;
                line-height: 1.3;
            }
            .notification-card .notif-meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 0.72rem;
                color: #94a3b8;
            }
            .notification-card .notif-badge-pay {
                background: rgba(0, 210, 255, 0.15);
                color: #00d2ff;
                border: 1px solid rgba(0, 210, 255, 0.3);
                padding: 2px 6px;
                border-radius: 10px;
                font-weight: bold;
                font-size: 0.68rem;
            }
            .notification-card .btn-mark-read {
                background: rgba(255,255,255,0.1);
                border: none;
                color: #aaa;
                border-radius: 50%;
                width: 22px;
                height: 22px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 0.65rem;
            }
            .notification-card .btn-mark-read:hover {
                background: #00ff88;
                color: #000;
            }
            .notifications-empty {
                text-align: center;
                padding: 30px 15px;
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
                <button class="pill-icon" id="notification-btn" title="Notificaciones de Ventas" style="position: relative;">
                    <i class="fas fa-bell"></i>
                    <span id="notification-badge" class="nav-badge" style="display: none; position: absolute; top: -4px; right: -4px; background: #ff4757; color: white; font-size: 10px; font-weight: bold; padding: 2px 5px; border-radius: 10px; line-height: 1;">0</span>
                </button>
                <div class="notifications-dropdown-menu" id="notifications-dropdown">
                    <div class="notifications-header">
                        <span><i class="fas fa-bell"></i> Ventas & Compras</span>
                        <button class="btn-clear-notifications" id="btn-clear-notifications" title="Marcar todas como leídas"><i class="fas fa-check-double"></i> Leídas</button>
                    </div>
                    <div class="notifications-list" id="notifications-list">
                        <div class="notifications-empty"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>
                    </div>
                </div>
            </div>
        `;

        // Insert right before user menu or cart button
        if ($('#cart-btn').length > 0) {
            $(html).insertBefore('#cart-btn');
        } else if ($('.user-menu-container').length > 0) {
            $(html).insertBefore('.user-menu-container');
        } else {
            $pillPanel.append(html);
        }
    }

    async function getSellerId() {
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.id) {
            return currentUser.id;
        }
        if (typeof _supabase !== 'undefined') {
            try {
                const { data: { session } } = await _supabase.auth.getSession();
                if (session && session.user) return session.user.id;
            } catch (e) {}
        }
        const stored = localStorage.getItem('tcg_session');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed && parsed.id) return parsed.id;
            } catch (e) {}
        }
        return null;
    }

    async function checkNotifications() {
        const sellerId = await getSellerId();
        if (!sellerId || typeof _supabase === 'undefined') return;

        try {
            const { data: sales, error } = await _supabase
                .from('sealed_product_sales')
                .select('*')
                .eq('seller_id', sellerId)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) return;

            const unreadSales = (sales || []).filter(s => !s.is_read);
            const unreadCount = unreadSales.length;

            const $badge = $('#notification-badge');
            if (unreadCount > 0) {
                $badge.text(unreadCount > 99 ? '99+' : unreadCount).show();
            } else {
                $badge.hide();
            }

            // Proactive chatbot notification on new sales
            if (initialLoadDone && unreadCount > knownSalesCount) {
                const newest = unreadSales[0];
                if (newest && window.botInstance && typeof window.botInstance.say === 'function') {
                    let itemSummary = '';
                    if (Array.isArray(newest.items)) {
                        itemSummary = newest.items.map(i => `${i.cart_quantity || i.qty || 1}x ${i.name || 'Producto'}`).join(', ');
                    } else {
                        itemSummary = 'Productos Sellados';
                    }
                    const alertMsg = `¡Atención! ${newest.buyer_name || 'Un cliente'} adquirió: ${itemSummary} ($${newest.total_amount || 0} - ${newest.payment_status || 'Pagado'})`;
                    window.botInstance.say(alertMsg, 15000, true);
                }
            }

            knownSalesCount = unreadCount;
            initialLoadDone = true;

            renderNotificationsList(sales || []);
        } catch (e) {
            console.warn("Error checking notifications:", e);
        }
    }

    function renderNotificationsList(sales) {
        const $container = $('#notifications-list');
        if (!$container.length) return;

        $container.empty();

        if (!sales || sales.length === 0) {
            $container.html('<div class="notifications-empty"><i class="fas fa-box-open" style="font-size: 1.5rem; display: block; margin-bottom: 8px; opacity: 0.5;"></i>No tienes notificaciones de ventas recientes.</div>');
            return;
        }

        sales.forEach(sale => {
            let itemsText = '';
            if (Array.isArray(sale.items) && sale.items.length > 0) {
                itemsText = sale.items.map(i => `${i.cart_quantity || i.qty || 1}x ${i.name || 'Producto'}`).join(', ');
            } else if (typeof sale.items === 'string') {
                itemsText = sale.items;
            } else {
                itemsText = 'Artículo(s) adquiridos';
            }

            const isUnread = !sale.is_read;
            const dateStr = sale.created_at ? new Date(sale.created_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Reciente';

            const $card = $(`
                <div class="notification-card ${isUnread ? 'unread' : ''}" data-id="${sale.id}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div class="notif-buyer">${sale.buyer_name || 'Cliente Anónimo'} ${sale.buyer_contact ? `<span style="font-size:0.72rem; color:#94a3b8; font-weight:normal;">(${sale.buyer_contact})</span>` : ''}</div>
                        ${isUnread ? `<button class="btn-mark-read" title="Marcar como leída"><i class="fas fa-check"></i></button>` : ''}
                    </div>
                    <div class="notif-items">${itemsText}</div>
                    <div class="notif-meta">
                        <span class="notif-badge-pay">${sale.payment_status || 'Pagado Completo'}</span>
                        <span style="font-weight: 800; color: #00ff88;">$${parseFloat(sale.total_amount || 0).toFixed(2)}</span>
                        <span>${dateStr}</span>
                    </div>
                </div>
            `);

            $card.find('.btn-mark-read').click(async function(e) {
                e.stopPropagation();
                await markAsRead(sale.id);
            });

            $container.append($card);
        });
    }

    async function markAsRead(saleId) {
        if (typeof _supabase === 'undefined') return;
        try {
            await _supabase.from('sealed_product_sales').update({ is_read: true }).eq('id', saleId);
            checkNotifications();
        } catch (e) { console.error("Error marking sale as read:", e); }
    }

    async function markAllAsRead() {
        const sellerId = await getSellerId();
        if (!sellerId || typeof _supabase === 'undefined') return;
        try {
            await _supabase.from('sealed_product_sales').update({ is_read: true }).eq('seller_id', sellerId);
            checkNotifications();
        } catch (e) { console.error("Error marking all sales as read:", e); }
    }

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

    $(document).ready(function() {
        setTimeout(initNotificationUI, 300);
    });

    window.VikingNotifications = {
        check: checkNotifications,
        markAsRead: markAsRead,
        markAllAsRead: markAllAsRead
    };
})();
