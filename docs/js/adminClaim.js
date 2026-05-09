let adminClaimUser = null;
let currentMyClaimsFilter = 'Reclamada';

$(document).ready(async function() {
    await checkAdminClaimSession();

    // UI Interactions
    $(document).on('click', '#avatar-btn', function(e) {
        e.stopPropagation();
        $('#user-dropdown').toggleClass('active');
    });

    $(document).on('click', function(e) {
        if (!$(e.target).closest('.user-menu-container').length) {
            $('#user-dropdown').removeClass('active');
        }
    });

    $('#menu-btn-logout').on('click', async function() {
        await _supabase.auth.signOut();
        window.location.href = 'index.html';
    });

    $('.theme-btn-small').on('click', function() {
        const theme = $(this).data('theme');
        $('body').removeClass('theme-light theme-purple theme-dark').addClass(theme);
        localStorage.setItem('tcg_theme', theme);
        $('.theme-btn-small').removeClass('active');
        $(this).addClass('active');
    });

    $('#btn-tab-mis-claims').on('click', function() {
        $('.tab-pill').removeClass('active');
        $(this).addClass('active');
        $('#my-claims-view').show();
        $('#won-claims-view').hide();
        loadMyClaims();
    });

    $('#btn-tab-ganados').on('click', function() {
        $('.tab-pill').removeClass('active');
        $(this).addClass('active');
        $('#my-claims-view').hide();
        $('#won-claims-view').show();
        loadWonClaims();
    });

    $('.filter-btn').on('click', function() {
        $('.filter-btn').removeClass('active');
        $(this).addClass('active');
        currentMyClaimsFilter = $(this).data('filter');
        loadMyClaims();
    });
});

async function checkAdminClaimSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        const { data: user } = await _supabase.from('usuarios').select('*').eq('id', session.user.id).single();
        if (user) {
            adminClaimUser = user;

            // UI Update
            if (user.store_logo) $('#dropdown-user-logo').attr('src', user.store_logo).show();
            $('#dropdown-user-name').text(user.store_name || user.username);
            $('#dropdown-user-role').text(user.role || 'Vendedor').show();

            const savedTheme = localStorage.getItem('tcg_theme') || 'theme-dark';
            $('body').addClass(savedTheme);
            $(`.theme-btn-small[data-theme="${savedTheme}"]`).addClass('active');

            // Load current spirit
            if (user.selected_spirit_id) {
                const { data: spiritData } = await _supabase.from('spirits').select('*').eq('id', user.selected_spirit_id).single();
                if (spiritData) window.currentSpirit = spiritData;
            }
            const { data: botMessages } = await _supabase.from('bot_messages').select('*').eq('user_id', user.id).eq('is_active', true);
            window.currentStoreDataForBot = { user: user, customMessages: botMessages };

            initFloatingCompanion();
            loadMyClaims();
        } else { window.location.href = 'admin.html'; }
    } else { window.location.href = 'admin.html'; }
}

async function initFloatingCompanion() {
    if (!window.currentSpirit) {
        const { data: publicSpirits } = await _supabase.from('spirits').select('*').eq('is_public', true).limit(1);
        if (publicSpirits && publicSpirits.length > 0) window.currentSpirit = publicSpirits[0];
    }
    if (!window.currentSpirit) return;
    const $container = $('#floating-companion-container');
    if (!$container.length) return;
    if (typeof makeCompanionDraggable === 'function') setTimeout(makeCompanionDraggable, 1000);
    $container.html(`<model-viewer src="${window.currentSpirit.gltf_url}" auto-rotate camera-controls rotation="0deg 0deg 0deg" shadow-intensity="1" environment-image="neutral" exposure="1" interaction-prompt="none" oncontextmenu="return false;"></model-viewer>`);
    $container.on('click', function(e) { if (!window.isCompanionDragging) { e.stopPropagation(); $('#companion-menu').toggleClass('active'); } });
    $('#menu-item-chat').on('click', function(e) { e.stopPropagation(); $('#chatbot-container').addClass('active'); $('#companion-menu').removeClass('active'); });
    if (typeof CompanionBot === 'function') {
        const bot = new CompanionBot({ supabase: _supabase, userId: adminClaimUser.id, userType: 'admin', customMessages: window.currentStoreDataForBot ? window.currentStoreDataForBot.customMessages : [] });
        bot.init(); window.botInstance = bot;
    }
}

async function loadMyClaims() {
    if (!adminClaimUser) return;
    const $list = $('#my-claims-list');
    $list.html('<div class="loading">Cargando...</div>');
    const { data: claims, error } = await _supabase.from('claims').select('*, winner:winner_id(id, username, store_name, whatsapp_link, messenger_link)').eq('user_id', adminClaimUser.id).eq('status', currentMyClaimsFilter).order('created_at', { ascending: false });
    if (error) return;
    if (!claims || claims.length === 0) { $list.html('<div style="text-align:center; padding:40px; color:#666;">No hay claims para mostrar.</div>'); return; }
    $list.empty();
    if (currentMyClaimsFilter === 'Reclamada') {
        const groups = {};
        claims.forEach(c => { const wid = c.winner_id; if (!groups[wid]) groups[wid] = { winner: c.winner, items: [] }; groups[wid].items.push(c); });
        Object.values(groups).forEach(group => {
            const winner = group.winner || { username: 'Usuario Desconocido' };
            const winnerDisplayName = winner.store_name || winner.username || 'Usuario';
            $list.append(`
                <div class="winner-group">
                    <div class="winner-header">
                        <div class="winner-name"><i class="fas fa-crown"></i> ${winnerDisplayName}</div>
                        <div class="claimed-count">${group.items.length} producto(s)</div>
                    </div>
                    <div class="claimed-items-list">
                        ${group.items.map(item => `
                            <div class="claimed-item-mini"><img src="${item.image_urls[0]}"><div class="claimed-item-info"><div class="claimed-item-title">${item.title}</div><div class="claimed-item-price">$${item.price}</div></div></div>
                        `).join('')}
                    </div>
                    <div class="contact-buttons">
                        ${winner.whatsapp_link ? `<button class="btn btn-wa" onclick="window.open('https://wa.me/${winner.whatsapp_link.replace(/\D/g, '')}', '_blank')"><i class="fab fa-whatsapp"></i> WhatsApp</button>` : ''}
                        ${winner.messenger_link ? `<button class="btn btn-ms" onclick="window.open('https://m.me/${winner.messenger_link}', '_blank')"><i class="fab fa-facebook-messenger"></i> Messenger</button>` : ''}
                    </div>
                </div>
            `);
        });
    } else {
        const $grid = $('<div class="claim-management-grid"></div>');
        claims.forEach(claim => {
            $grid.append(`<div class="pretty-claim-card"><div class="status-badge">${claim.status}</div><div class="card-img-container"><img src="${claim.image_urls[0]}"></div><div class="card-title">${claim.title}</div><div class="claim-info"><span class="info-label">PRECIO</span><span class="info-value">$${claim.price || '0.00'}</span></div></div>`);
        });
        $list.append($grid);
    }
}

async function loadWonClaims() {
    if (!adminClaimUser) return;
    const $list = $('#won-claims-list'); $list.html('<div class="loading">Cargando...</div>');
    const { data: claims, error } = await _supabase.from('claims').select('*, seller:user_id(id, username, store_name, whatsapp_link, messenger_link)').eq('winner_id', adminClaimUser.id).order('claimed_at', { ascending: false });
    if (error || !claims || claims.length === 0) { $list.html('<div style="text-align:center; padding:40px; color:#666;">No has reclamado productos.</div>'); return; }
    const groups = {};
    claims.forEach(c => { const sid = c.user_id; if (!groups[sid]) groups[sid] = { seller: c.seller, items: [] }; groups[sid].items.push(c); });
    $list.empty();
    Object.values(groups).forEach(group => {
        const seller = group.seller; const sellerDisplayName = seller.store_name || seller.username || 'Vendedor';
        $list.append(`<div class="winner-group" style="border-color: #00ff88;"><div class="winner-header"><div class="winner-name" style="color: #00ff88;"><i class="fas fa-store"></i> ${sellerDisplayName}</div><div class="claimed-count">${group.items.length} producto(s)</div></div><div class="claimed-items-list">${group.items.map(item => `<div class="claimed-item-mini"><img src="${item.image_urls[0]}"><div class="claimed-item-info"><div class="claimed-item-title">${item.title}</div><div class="claimed-item-price">$${item.price}</div></div></div>`).join('')}</div><div class="contact-buttons">${seller.whatsapp_link ? `<button class="btn btn-wa" onclick="window.open('https://wa.me/${seller.whatsapp_link.replace(/\D/g, '')}', '_blank')"><i class="fab fa-whatsapp"></i> Contactar</button>` : ''}${seller.messenger_link ? `<button class="btn btn-ms" onclick="window.open('https://m.me/${seller.messenger_link}', '_blank')"><i class="fab fa-facebook-messenger"></i> Messenger</button>` : ''}</div></div>`);
    });
}
