let adminClaimUser = null;

$(document).ready(async function() {
    await checkAdminClaimSession();

    $('#btn-tab-mis-claims').on('click', function() {
        $('.tab-pill').removeClass('active');
        $(this).addClass('active');
        $('#my-claims-winners').show();
        $('#won-claims').hide();
        loadMyClaimsWinners();
    });

    $('#btn-tab-ganados').on('click', function() {
        $('.tab-pill').removeClass('active');
        $(this).addClass('active');
        $('#my-claims-winners').hide();
        $('#won-claims').show();
        loadWonClaims();
    });
});

async function checkAdminClaimSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        const { data: user } = await _supabase.from('usuarios').select('*').eq('id', session.user.id).single();
        if (user) {
            adminClaimUser = user;
            loadMyClaimsWinners();
        } else {
            window.location.href = 'admin.html';
        }
    } else {
        window.location.href = 'admin.html';
    }
}

async function loadMyClaimsWinners() {
    if (!adminClaimUser) return;
    $('#my-claims-winners').html('<div class="loading">Cargando ganadores...</div>');

    const { data: claims, error } = await _supabase
        .from('claims')
        .select('*, winner:winner_id(id, username, store_name, whatsapp_link, messenger_link)')
        .eq('user_id', adminClaimUser.id)
        .eq('status', 'Reclamada')
        .order('claimed_at', { ascending: false });

    if (error) return;

    if (!claims || claims.length === 0) {
        $('#my-claims-winners').html('<div class="empty">Nadie ha reclamado tus productos aún.</div>');
        return;
    }

    // Group by winner
    const groups = {};
    claims.forEach(c => {
        const wid = c.winner_id;
        if (!groups[wid]) groups[wid] = { winner: c.winner, items: [] };
        groups[wid].items.push(c);
    });

    const $container = $('#my-claims-winners');
    $container.empty();

    Object.values(groups).forEach(group => {
        const winner = group.winner;
        const winnerDisplayName = winner.store_name || winner.username || 'Usuario';

        const $groupEl = $(`
            <div class="winner-group">
                <div class="winner-header">
                    <div class="winner-name"><i class="fas fa-crown"></i> ${winnerDisplayName}</div>
                    <div class="claimed-count">${group.items.length} producto(s)</div>
                </div>
                <div class="claimed-items-list">
                    ${group.items.map(item => `
                        <div class="claimed-item-mini">
                            <img src="${item.image_urls[0]}" alt="${item.title}">
                            <div class="claimed-item-info">
                                <div class="claimed-item-title">${item.title}</div>
                                <div class="claimed-item-price">$${item.price}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="contact-buttons">
                    ${winner.whatsapp_link ? `<button class="btn btn-wa" onclick="window.open('https://wa.me/${winner.whatsapp_link.replace(/\D/g, '')}', '_blank')"><i class="fab fa-whatsapp"></i> WhatsApp</button>` : ''}
                    ${winner.messenger_link ? `<button class="btn btn-ms" onclick="window.open('https://m.me/${winner.messenger_link}', '_blank')"><i class="fab fa-facebook-messenger"></i> Messenger</button>` : ''}
                </div>
            </div>
        `);
        $container.append($groupEl);
    });
}

async function loadWonClaims() {
    if (!adminClaimUser) return;
    $('#won-claims').html('<div class="loading">Cargando tus compras...</div>');

    const { data: claims, error } = await _supabase
        .from('claims')
        .select('*, seller:user_id(id, username, store_name, whatsapp_link, messenger_link)')
        .eq('winner_id', adminClaimUser.id)
        .order('claimed_at', { ascending: false });

    if (error) return;

    if (!claims || claims.length === 0) {
        $('#won-claims').html('<div class="empty">No has reclamado ningún producto todavía.</div>');
        return;
    }

    // Group by seller
    const groups = {};
    claims.forEach(c => {
        const sid = c.user_id;
        if (!groups[sid]) groups[sid] = { seller: c.seller, items: [] };
        groups[sid].items.push(c);
    });

    const $container = $('#won-claims');
    $container.empty();

    Object.values(groups).forEach(group => {
        const seller = group.seller;
        const sellerDisplayName = seller.store_name || seller.username || 'Vendedor';

        const $groupEl = $(`
            <div class="winner-group" style="border-color: #00ff88;">
                <div class="winner-header">
                    <div class="winner-name" style="color: #00ff88;"><i class="fas fa-store"></i> ${sellerDisplayName}</div>
                    <div class="claimed-count">${group.items.length} producto(s) ganados</div>
                </div>
                <div class="claimed-items-list">
                    ${group.items.map(item => `
                        <div class="claimed-item-mini">
                            <img src="${item.image_urls[0]}" alt="${item.title}">
                            <div class="claimed-item-info">
                                <div class="claimed-item-title">${item.title}</div>
                                <div class="claimed-item-price">$${item.price}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="contact-buttons">
                    ${seller.whatsapp_link ? `<button class="btn btn-wa" onclick="window.open('https://wa.me/${seller.whatsapp_link.replace(/\D/g, '')}', '_blank')"><i class="fab fa-whatsapp"></i> Contactar Vendedor</button>` : ''}
                    ${seller.messenger_link ? `<button class="btn btn-ms" onclick="window.open('https://m.me/${seller.messenger_link}', '_blank')"><i class="fab fa-facebook-messenger"></i> Messenger</button>` : ''}
                </div>
            </div>
        `);
        $container.append($groupEl);
    });
}
