let currentUser = null;
let auctionDrafts = [];

$(document).ready(async function() {
    await checkSession();

    // --- Bulk Drop Zone Events ---
    const $mainDropZone = $('#main-drop-zone-auction');
    $mainDropZone.on('dragover dragenter', function(e) {
        e.preventDefault(); e.stopPropagation();
        $(this).addClass('dragover');
    });
    $mainDropZone.on('dragleave dragend drop', function(e) {
        e.preventDefault(); e.stopPropagation();
        $(this).removeClass('dragover');
    });
    $mainDropZone.on('drop', function(e) {
        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) handleBulkUpload(files);
    });
    $mainDropZone.on('click', function() {
        $('#input-auction-files-bulk').click();
    });
    $('#input-auction-files-bulk').on('change', function() {
        if (this.files.length > 0) handleBulkUpload(this.files);
    });

    // --- Bulk Toolbar Actions ---
    $('#btn-apply-bulk').click(applyBulkSettings);
    $('#btn-save-all-drafts').click(saveAllDrafts);

    $(document).on('click', '.btn-delete-live', function() {
        const id = $(this).data('id');
        deleteLiveAuction(id);
    });
});

async function checkSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        const { data: user } = await _supabase
            .from('usuarios')
            .select('id, username, store_name, role')
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

async function handleBulkUpload(files) {
    const fileArray = Array.from(files);

    // Limits Check
    let currentTotal = auctionDrafts.length;
    const { count: activeCount } = await _supabase
        .from('subastas')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .eq('is_live', true);

    let maxAllowed = (currentUser.role === 'premium') ? 20 : 10;
    if (currentUser.role === 'admin' || currentUser.role === 'admin_store') maxAllowed = 999;

    if (activeCount + currentTotal + fileArray.length > maxAllowed) {
        Swal.fire('Límite alcanzado', `Tu plan actual permite un máximo de ${maxAllowed} subastas activas. Ya tienes ${activeCount} publicadas y ${currentTotal} borradores.`, 'warning');
        return;
    }

    Swal.fire({
        title: 'Procesando imágenes...',
        text: `Subiendo ${fileArray.length} imágenes al servidor.`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    for (const file of fileArray) {
        try {
            const url = await CloudinaryUpload.uploadImage(file);
            const now = new Date();
            const defaultEnd = new Date(now.getTime() + (24 * 60 * 60 * 1000));

            auctionDrafts.push({
                id: 'draft_' + Date.now() + Math.random(),
                nombre: file.name.split('.')[0],
                image_url: url,
                starting_bid: 1,
                increment_type: 'free',
                min_increment: 1,
                start_date: now.toISOString().slice(0, 16),
                end_date: defaultEnd.toISOString().slice(0, 16),
                description: ''
            });
        } catch (err) {
            console.error("Error uploading file:", file.name, err);
        }
    }

    Swal.close();
    renderDrafts();
}

function renderDrafts() {
    const $container = $('#auction-drafts-list');
    const $toolbar = $('#bulk-actions-toolbar');
    $container.empty();

    if (auctionDrafts.length === 0) {
        $toolbar.hide();
        return;
    }

    $toolbar.show();
    $('#draft-count').text(auctionDrafts.length);

    auctionDrafts.forEach((draft, index) => {
        const $card = $(`
            <div class="draft-card" data-id="${draft.id}">
                <div class="remove-draft"><i class="fas fa-times"></i></div>
                <img src="${draft.image_url}" alt="Borrador">
                <div class="draft-form">
                    <input type="text" class="input-name" placeholder="Nombre del artículo" value="${draft.nombre}">
                    <div class="draft-date-group">
                        <div>
                            <label style="font-size: 9px; color: #666; display: block; margin-bottom: 3px;">Puja Inicial</label>
                            <input type="number" class="input-bid" value="${draft.starting_bid}" min="1">
                        </div>
                        <div>
                            <label style="font-size: 9px; color: #666; display: block; margin-bottom: 3px;">Incremento</label>
                            <select class="input-inc">
                                <option value="free" ${draft.increment_type === 'free' ? 'selected' : ''}>Libre</option>
                                <option value="fixed_5" ${draft.min_increment === 5 ? 'selected' : ''}>$5</option>
                                <option value="fixed_10" ${draft.min_increment === 10 ? 'selected' : ''}>$10</option>
                                <option value="fixed_20" ${draft.min_increment === 20 ? 'selected' : ''}>$20</option>
                            </select>
                        </div>
                    </div>
                    <div class="draft-date-group">
                        <div>
                            <label style="font-size: 9px; color: #666; display: block; margin-bottom: 3px;">Inicia</label>
                            <input type="datetime-local" class="input-start" value="${draft.start_date}">
                        </div>
                        <div>
                            <label style="font-size: 9px; color: #666; display: block; margin-bottom: 3px;">Termina</label>
                            <input type="datetime-local" class="input-end" value="${draft.end_date}">
                        </div>
                    </div>
                    <textarea class="input-desc" placeholder="Descripción y reglas..." style="font-size: 11px; height: 60px; resize: none;">${draft.description || ''}</textarea>
                </div>
            </div>
        `);

        // Update local data on change
        $card.find('input, select').on('change', function() {
            updateDraftData(draft.id, $(this));
        });

        $card.find('.remove-draft').click(() => {
            auctionDrafts.splice(index, 1);
            renderDrafts();
        });

        $container.append($card);
    });
}

function updateDraftData(id, $input) {
    const draft = auctionDrafts.find(d => d.id === id);
    if (!draft) return;

    if ($input.hasClass('input-name')) draft.nombre = $input.val();
    if ($input.hasClass('input-desc')) draft.description = $input.val();
    if ($input.hasClass('input-bid')) draft.starting_bid = parseFloat($input.val());
    if ($input.hasClass('input-start')) draft.start_date = $input.val();
    if ($input.hasClass('input-end')) draft.end_date = $input.val();
    if ($input.hasClass('input-inc')) {
        const val = $input.val();
        draft.increment_type = val === 'free' ? 'free' : 'fixed';
        draft.min_increment = val.startsWith('fixed_') ? parseInt(val.split('_')[1]) : 1;
    }
}

function applyBulkSettings() {
    const bid = parseFloat($('#bulk-start-bid').val()) || 1;
    const incType = $('#bulk-inc-type').val();
    const durationHrs = parseInt($('#bulk-duration').val()) || 24;

    const now = new Date();
    const startStr = now.toISOString().slice(0, 16);
    const endStr = new Date(now.getTime() + (durationHrs * 60 * 60 * 1000)).toISOString().slice(0, 16);

    auctionDrafts.forEach(draft => {
        draft.starting_bid = bid;
        draft.increment_type = incType === 'free' ? 'free' : 'fixed';
        draft.min_increment = incType.startsWith('fixed_') ? parseInt(incType.split('_')[1]) : 1;
        draft.start_date = startStr;
        draft.end_date = endStr;
    });

    renderDrafts();
    Swal.fire({ title: '¡Ajustes aplicados!', icon: 'success', timer: 1000, showConfirmButton: false, toast: true, position: 'top-end' });
}

async function saveAllDrafts() {
    if (auctionDrafts.length === 0) return;

    Swal.fire({
        title: 'Publicando subastas...',
        text: `Estamos activando tus ${auctionDrafts.length} subastas.`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    const dataToInsert = auctionDrafts.map(d => ({
        user_id: currentUser.id,
        nombre: d.nombre,
        image_url: d.image_url,
        starting_bid: d.starting_bid,
        increment_type: d.increment_type,
        min_increment: d.min_increment,
        start_date: d.start_date,
        end_date: d.end_date,
        description: d.description,
        is_live: true,
        status: 'Activa'
    }));

    try {
        const { error } = await _supabase.from('subastas').insert(dataToInsert);
        if (error) throw error;

        Swal.fire('¡Éxito!', 'Todas tus subastas han sido publicadas correctamente.', 'success');
        auctionDrafts = [];
        renderDrafts();
        loadLiveAuctions();
    } catch (err) {
        console.error(err);
        Swal.fire('Error', 'No se pudieron publicar todas las subastas: ' + err.message, 'error');
    }
}

async function loadLiveAuctions() {
    $('#live-auction-list').html('<div class="loading">Cargando subastas...</div>');

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

    const $container = $('#live-auction-list');
    $container.empty();

    if (!items || items.length === 0) {
        $container.html('<div class="empty">Aún no hay subastas publicadas.</div>');
        return;
    }

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
                    <i class="fas fa-clock"></i> ${isEnded ? 'Finalizada' : 'Cierra: ' + new Date(item.end_date).toLocaleString()}
                </div>
                ${winnerHtml}

                <div style="display: flex; gap: 8px; margin-top: 15px;">
                    ${isEnded && highestBid ? `
                        <button class="btn btn-sm btn-success btn-contact-winner" style="flex: 2;">
                            <i class="fab fa-whatsapp"></i> Contactar Ganador
                        </button>
                    ` : `
                        <div style="font-size: 11px; opacity: 0.5;">En curso...</div>
                    `}
                    <button class="btn btn-danger btn-sm btn-delete-live" data-id="${item.id}" style="flex: 0 0 40px;"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `);

        if (isEnded && highestBid) {
            $card.find('.btn-contact-winner').click(() => contactWinner(item, highestBid));
        }

        $container.append($card);
    });
}

async function contactWinner(auction, bid) {
    const { data: winner } = await _supabase
        .from('usuarios')
        .select('whatsapp_link, username')
        .eq('id', bid.bidder_id)
        .single();

    const msg = `¡Hola ${winner ? winner.username : bid.bidder_name}! 🎉 Ganaste la subasta de "${auction.nombre}" por $${bid.amount}. Acordemos el pago y envío.`;

    if (winner && winner.whatsapp_link) {
        window.open(`https://wa.me/${winner.whatsapp_link.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
        navigator.clipboard.writeText(msg);
        Swal.fire({ title: 'Mensaje Copiado', text: 'Pégalo en tu chat con el cliente.', icon: 'success' });
    }
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
