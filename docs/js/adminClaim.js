let adminClaimUser = null;

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
        $('.modal-tab-btn').removeClass('active');
        $(this).addClass('active');
        $('#my-claims-view').show();
        $('#won-claims-view').hide();
        loadMyClaims();
    });

    $('#btn-tab-ganados').on('click', function() {
        $('.modal-tab-btn').removeClass('active');
        $(this).addClass('active');
        $('#my-claims-view').hide();
        $('#won-claims-view').show();
        loadWonClaims();
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

            initMichatbot(true);
            loadMyClaims();
        } else { window.location.href = 'admin.html'; }
    } else { window.location.href = 'admin.html'; }
}



async function loadMyClaims() {
    if (!adminClaimUser) return;
    const $list = $('#my-claims-list');
    $list.html('<div class="loading">Cargando...</div>');
    const { data: claims, error } = await _supabase.from('claims')
        .select('*, winner:winner_id(id, username, store_name, whatsapp_link, messenger_link)')
        .eq('user_id', adminClaimUser.id)
        .order('created_at', { ascending: false });

    if (error) return;
    if (!claims || claims.length === 0) {
        $list.html('<div style="text-align:center; padding:40px; color:#666;">No has creado ningún claim aún.</div>');
        return;
    }

    $list.empty();

    const claimed = claims.filter(c => c.status === 'Reclamada');
    const active = claims.filter(c => c.status === 'Activa');

    // Render Active Claims first
    if (active.length > 0) {
        $list.append('<h3 style="margin: 20px 0 15px; font-weight: 900; opacity: 0.7;">CLAIMS ACTIVOS (EN VENTA)</h3>');
        const $grid = $('<div class="claim-management-grid"></div>');
        active.forEach(claim => {
            $grid.append(`
                <div class="pretty-claim-card">
                    <div class="status-badge">${claim.status}</div>
                    <div class="card-img-container"><img src="${claim.image_urls[0]}"></div>
                    <div class="card-title">${claim.title}</div>
                    <div class="claim-info">
                        <span class="info-label">PRECIO</span>
                        <span class="info-value">$${claim.price || '0.00'}</span>
                    </div>
                </div>
            `);
        });
        $list.append($grid);
    }

    // Render Reclamados grouped by winner
    if (claimed.length > 0) {
        $list.append('<h3 style="margin: 40px 0 15px; font-weight: 900; opacity: 0.7;">CLAIMS RECLAMADOS (VENTAS)</h3>');
        const groups = {};
        claimed.forEach(c => {
            const wid = c.winner_id;
            if (!groups[wid]) groups[wid] = { winner: c.winner, items: [] };
            groups[wid].items.push(c);
        });

        Object.entries(groups).forEach(([wid, group]) => {
            const winner = group.winner || { username: 'Usuario Desconocido' };
            const winnerDisplayName = (winner.store_name || winner.username || 'Usuario').replace(/'/g, "\\'");
            $list.append(`
                <div class="winner-group">
                    <div class="winner-header">
                        <div class="winner-name"><i class="fas fa-crown"></i> ${winnerDisplayName.replace(/\\'/g, "'")}</div>
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div class="claimed-count">${group.items.length} producto(s)</div>
                            <button class="btn btn-sm btn-danger btn-delete-group" onclick="deleteWinnerClaims('${wid}', '${winnerDisplayName}')" title="Eliminar todos los claims de este usuario"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>
                    <div class="claimed-items-list">
                        ${group.items.map(item => `
                            <div class="claimed-item-mini" style="position: relative; cursor: pointer;" onclick="showClaimDetails('${item.id}')">
                                <img src="${item.image_urls[0]}">
                                <div class="claimed-item-info">
                                    <div class="claimed-item-title">${item.title}</div>
                                    <div class="claimed-item-price">$${item.price}</div>
                                </div>
                                <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteClaim('${item.id}')" style="position: absolute; top: 5px; right: 5px; width: 25px; height: 25px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%;">
                                    <i class="fas fa-trash" style="font-size: 10px;"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    <div class="contact-buttons">
                        ${winner.whatsapp_link ? `<button class="btn btn-wa" onclick="window.open('https://wa.me/${winner.whatsapp_link.replace(/\D/g, '')}', '_blank')"><i class="fab fa-whatsapp"></i> WhatsApp</button>` : ''}
                        ${winner.messenger_link ? `<button class="btn btn-ms" onclick="window.open('https://m.me/${winner.messenger_link}', '_blank')"><i class="fab fa-facebook-messenger"></i> Messenger</button>` : ''}
                    </div>
                </div>
            `);
        });
    }
}

async function deleteClaim(id) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Eliminar Claim?',
        text: 'Esta acción no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4757',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (isConfirmed) {
        const { error } = await _supabase.from('claims').delete().eq('id', id);
        if (!error) {
            Swal.fire('Eliminado', 'El claim ha sido eliminado.', 'success');
            loadMyClaims();
        } else {
            Swal.fire('Error', 'No se pudo eliminar: ' + error.message, 'error');
        }
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
        $list.append(`<div class="winner-group" style="border-color: #00ff88;"><div class="winner-header"><div class="winner-name" style="color: #00ff88;"><i class="fas fa-store"></i> ${sellerDisplayName}</div><div class="claimed-count">${group.items.length} producto(s)</div></div><div class="claimed-items-list">${group.items.map(item => `<div class="claimed-item-mini" style="cursor: pointer;" onclick="showClaimDetails('${item.id}')"><img src="${item.image_urls[0]}"><div class="claimed-item-info"><div class="claimed-item-title">${item.title}</div><div class="claimed-item-price">$${item.price}</div></div></div>`).join('')}</div><div class="contact-buttons">${seller.whatsapp_link ? `<button class="btn btn-wa" onclick="window.open('https://wa.me/${seller.whatsapp_link.replace(/\D/g, '')}', '_blank')"><i class="fab fa-whatsapp"></i> Contactar</button>` : ''}${seller.messenger_link ? `<button class="btn btn-ms" onclick="window.open('https://m.me/${seller.messenger_link}', '_blank')"><i class="fab fa-facebook-messenger"></i> Messenger</button>` : ''}</div></div>`);
    });
}

async function deleteWinnerClaims(winnerId, winnerDisplayName) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Eliminar todos los claims?',
        text: `Se eliminarán todos los productos reclamados por ${winnerDisplayName}. Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4757',
        confirmButtonText: 'Sí, eliminar todos',
        cancelButtonText: 'Cancelar'
    });

    if (isConfirmed) {
        const { error } = await _supabase.from('claims')
            .delete()
            .eq('winner_id', winnerId)
            .eq('user_id', adminClaimUser.id)
            .eq('status', 'Reclamada');

        if (!error) {
            Swal.fire('Eliminados', 'Todos los claims del usuario han sido eliminados.', 'success');
            loadMyClaims();
        } else {
            Swal.fire('Error', 'No se pudieron eliminar: ' + error.message, 'error');
        }
    }
}

async function showClaimDetails(claimId) {
    const { data: claim, error } = await _supabase.from('claims').select('*').eq('id', claimId).single();
    if (error || !claim) {
        Swal.fire('Error', 'No se pudo cargar la información del producto.', 'error');
        return;
    }

    Swal.fire({
        title: claim.title,
        html: `
            <div style="text-align: center;">
                <img src="${claim.image_urls[0]}" style="max-width: 100%; max-height: 300px; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.3);">
                <div style="font-size: 1.2rem; font-weight: 800; color: var(--primary-color); margin-bottom: 10px;">$${claim.price}</div>
                <div style="text-align: left; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; font-size: 0.9rem; max-height: 200px; overflow-y: auto;">
                    ${claim.description || 'Sin descripción disponible.'}
                </div>
            </div>
        `,
        showCloseButton: true,
        showConfirmButton: false,
        width: '500px',
        background: 'var(--card-bg)',
        color: 'var(--text-color)'
    });
}
