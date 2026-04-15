let currentUser = null;

$(document).ready(async function() {
    await checkSession();

    // --- Navigation & UI ---
    $('#btn-save-live').click(function() {
        saveLiveAuction();
    });

    $(document).on('click', '.btn-edit-live', function() {
        const data = $(this).data('item');
        editLiveAuction(data);
    });

    $(document).on('click', '.btn-delete-live', function() {
        const id = $(this).data('id');
        deleteLiveAuction(id);
    });

    // --- Drag & Drop for Live Auction ---
    const $dropZone = $('#drop-zone-auction');
    $dropZone.on('dragover dragenter', function(e) {
        e.preventDefault(); e.stopPropagation();
        $(this).addClass('dragover');
    });
    $dropZone.on('dragleave dragend drop', function(e) {
        e.preventDefault(); e.stopPropagation();
        $(this).removeClass('dragover');
    });
    $dropZone.on('drop', function(e) {
        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) handleAuctionImageUpload(files[0]);
    });
    $dropZone.on('click', function() {
        $('#input-auction-file').click();
    });
    $('#input-auction-file').on('change', function() {
        if (this.files.length > 0) handleAuctionImageUpload(this.files[0]);
    });
});

async function checkSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        const { data: user } = await _supabase
            .from('usuarios')
            .select('id, username, store_name, role, max_auctions_count')
            .eq('id', session.user.id)
            .single();

        if (user) {
            currentUser = user;
            loadLiveAuctions();
        } else {
            window.location.href = 'admin.html';
        }
    } else {
        window.location.href = 'admin.html';
    }
}

async function handleAuctionImageUpload(file) {
    const $fileName = $('#drop-zone-auction .file-name');
    $fileName.text("Subiendo...").css('color', '#aaa');
    try {
        const url = await CloudinaryUpload.uploadImage(file);
        $('#live-input-image').val(url);
        $fileName.text("¡Imagen lista!").css('color', '#00ff88');
    } catch (err) {
        $fileName.text("Error al subir").css('color', '#ff4757');
    }
}

async function loadLiveAuctions() {
    $('#live-auction-list').html('<div class="loading">Cargando subastas...</div>');

    // Fetch auctions with their highest bids
    const { data: items, error } = await _supabase
        .from('subastas')
        .select(`
            *,
            subastas_pujas (
                amount,
                bidder_name,
                bidder_id
            )
        `)
        .eq('user_id', currentUser.id)
        .eq('is_live', true)
        .order('created_at', { ascending: false });

    if (error) {
        $('#live-auction-list').html('<div class="error">Error al cargar datos.</div>');
        return;
    }

    if (!items || items.length === 0) {
        $('#live-auction-list').html('<div class="empty">Aún no has creado subastas.</div>');
        return;
    }

    const $container = $('#live-auction-list');
    $container.empty();

    items.forEach(item => {
        const bids = item.subastas_pujas || [];
        bids.sort((a, b) => b.amount - a.amount);
        const highestBid = bids[0];
        const isEnded = new Date(item.end_date) < new Date();

        let winnerHtml = "";
        if (highestBid) {
            winnerHtml = `<div class="winner-pill">
                <i class="fas fa-crown"></i> ${highestBid.bidder_name}: $${highestBid.amount}
            </div>`;
        } else {
            winnerHtml = `<div style="font-size: 0.75rem; color: #666; margin-top: 10px;">Sin pujas aún</div>`;
        }

        const $card = $(`
            <div class="manage-card">
                <img src="${item.image_url || 'https://via.placeholder.com/300x150?text=Sin+Imagen'}" alt="${item.nombre}">
                <h3 style="margin: 10px 0 5px; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.nombre}</h3>
                <div style="font-size: 0.8rem; color: #aaa;">
                    <i class="fas fa-clock"></i> ${isEnded ? 'Finalizada' : 'Cierra: ' + new Date(item.end_date).toLocaleDateString()}
                </div>
                ${winnerHtml}

                <div style="display: flex; gap: 8px; margin-top: 15px;">
                    ${isEnded && highestBid ? `
                        <button class="btn btn-sm btn-success btn-contact-winner" style="flex: 2;">
                            <i class="fab fa-whatsapp"></i> Contactar Ganador
                        </button>
                    ` : `
                        <button class="btn btn-sm btn-edit-live" style="flex: 1;">Editar</button>
                    `}
                    <button class="btn btn-danger btn-sm btn-delete-live" data-id="${item.id}" style="flex: 0 0 40px;"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `);

        $card.find('.btn-edit-live').data('item', item);

        if (highestBid) {
            $card.find('.btn-contact-winner').click(() => contactWinner(item, highestBid));
        }

        $container.append($card);
    });
}

async function contactWinner(auction, bid) {
    // We need the winner's phone or contact info.
    // In this system, we'll try to find if the bidder has a whatsapp_link in 'usuarios'
    const { data: winner } = await _supabase
        .from('usuarios')
        .select('whatsapp_link, username')
        .eq('id', bid.bidder_id)
        .single();

    const msg = `¡Hola ${winner ? winner.username : bid.bidder_name}! 🎉 Gracias por participar en mi subasta en VikingTCG. Ganaste el artículo "${auction.nombre}" con una puja de $${bid.amount}.
    Acordemos los detalles de la entrega y el pago aquí mismo.`;

    if (winner && winner.whatsapp_link) {
        window.open(`https://wa.me/${winner.whatsapp_link.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
        // Fallback: copy to clipboard and alert
        navigator.clipboard.writeText(msg);
        Swal.fire({
            title: 'Mensaje Generado',
            text: 'Hemos copiado el mensaje de contacto al portapapeles. Pégalo en tu chat con el cliente.',
            icon: 'success'
        });
    }
}

async function saveLiveAuction() {
    const id = $('#live-edit-id').val();

    // Plan-based Limits check
    if (!id) {
        const { count } = await _supabase
            .from('subastas')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .eq('is_live', true);

        let limit = (currentUser.role === 'premium') ? 20 : 10;
        if (currentUser.role === 'admin' || currentUser.role === 'admin_store') limit = 9999;

        if (count >= limit) {
            Swal.fire('Límite alcanzado', `Tu plan actual permite un máximo de ${limit} subastas activas.`, 'warning');
            return;
        }
    }

    const nombre = $('#live-input-nombre').val().trim();
    const imageUrl = $('#live-input-image').val();
    const startBid = parseFloat($('#live-input-start-bid').val()) || 1;
    const incType = $('#live-input-inc-type').val();
    const startDate = $('#live-input-start-date').val();
    const endDate = $('#live-input-end-date').val();
    const description = $('#live-input-description').val().trim();

    if (!nombre || !startDate || !endDate) {
        Swal.fire('Atención', 'Nombre y fechas son obligatorios.', 'warning');
        return;
    }

    const data = {
        user_id: currentUser.id,
        nombre,
        image_url: imageUrl,
        starting_bid: startBid,
        increment_type: incType === 'free' ? 'free' : 'fixed',
        min_increment: incType.startsWith('fixed_') ? parseInt(incType.split('_')[1]) : 1,
        start_date: startDate,
        end_date: endDate,
        description,
        is_live: true,
        status: 'Activa'
    };

    let res;
    if (id) {
        res = await _supabase.from('subastas').update(data).eq('id', id);
    } else {
        res = await _supabase.from('subastas').insert([data]);
    }

    if (res.error) {
        Swal.fire('Error', 'No se pudo guardar: ' + res.error.message, 'error');
    } else {
        Swal.fire('¡Éxito!', 'Subasta publicada.', 'success');
        resetLiveModal();
        loadLiveAuctions();
    }
}

function editLiveAuction(item) {
    $('#live-edit-id').val(item.id);
    $('#live-input-nombre').val(item.nombre);
    $('#live-input-image').val(item.image_url);
    if (item.image_url) $('#drop-zone-auction .file-name').text('Imagen cargada');
    $('#live-input-start-bid').val(item.starting_bid);

    if (item.increment_type === 'free') $('#live-input-inc-type').val('free');
    else $('#live-input-inc-type').val(`fixed_${item.min_increment}`);

    if (item.start_date) $('#live-input-start-date').val(new Date(item.start_date).toISOString().slice(0, 16));
    if (item.end_date) $('#live-input-end-date').val(new Date(item.end_date).toISOString().slice(0, 16));

    $('#live-input-description').val(item.description);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteLiveAuction(id) {
    const result = await Swal.fire({
        title: '¿Eliminar subasta?',
        text: "Esta acción no se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4757',
        confirmButtonText: 'Sí, eliminar'
    });

    if (result.isConfirmed) {
        await _supabase.from('subastas').delete().eq('id', id);
        loadLiveAuctions();
    }
}

function resetLiveModal() {
    $('#live-edit-id').val('');
    $('#live-input-nombre').val('');
    $('#live-input-image').val('');
    $('#drop-zone-auction .file-name').text('');
    $('#live-input-start-bid').val(1);
    $('#live-input-inc-type').val('free');
    $('#live-input-start-date').val('');
    $('#live-input-end-date').val('');
    $('#live-input-description').val('');
}
