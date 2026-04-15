let currentUser = null;
let auctionDrafts = [];
let isBulkMode = false;

$(document).ready(async function() {
    await checkSession();
    initializeSpirit();

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

    // --- Modal Actions ---
    $('#btn-open-bulk-settings').click(() => openAuctionModal(true));
    $('#close-auction-modal').click(closeAuctionModal);
    $('#btn-save-auction').click(handleSaveAuction);
    $('#btn-save-all-drafts').click(saveAllDrafts);

    // --- Single Upload in Modal ---
    $('#drop-zone-single-auction').click(() => $('#input-single-auction-file').click());
    $('#input-single-auction-file').on('change', function() {
        if (this.files.length > 0) handleSingleUpload(this.files[0]);
    });

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
            .select('*')
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

function initializeSpirit() {
    if (window.botInstance) {
        window.botInstance.setContext('subastas');
        window.botInstance.say("¡Bienvenido al panel de subastas! Aquí puedes lanzar tus artículos al mejor postor.");
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
        if (window.botInstance) window.botInstance.say("¡Vaya! Parece que has alcanzado el límite de subastas para tu plan.");
        Swal.fire('Límite alcanzado', `Tu plan actual permite un máximo de ${maxAllowed} subastas activas.`, 'warning');
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
                start_date: now.toISOString().slice(0, 16),
                end_date: defaultEnd.toISOString().slice(0, 16),
                description: '',
                increments: [5, 10],
                allow_free: true
            });
        } catch (err) {
            console.error("Error uploading file:", file.name, err);
        }
    }

    if (window.botInstance) window.botInstance.say(`¡Listo! He cargado ${fileArray.length} borradores. Configúralos y lánzalos.`);
    Swal.close();
    renderDrafts();
}

async function handleSingleUpload(file) {
    try {
        Swal.fire({ title: 'Subiendo...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const url = await CloudinaryUpload.uploadImage(file);
        $('#single-auction-preview').html(`<img src="${url}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;">`);
        $('#drop-zone-single-auction').data('url', url).addClass('has-image');
        Swal.close();
    } catch (err) {
        Swal.fire('Error', 'No se pudo subir la imagen.', 'error');
    }
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
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 10px;">PUJA INICIAL ($)</label>
                        <input type="number" class="input-bid" value="${draft.starting_bid}" min="1" step="0.01">
                    </div>
                </div>
            </div>
        `);

        $card.find('.input-name').on('change', function() { draft.nombre = $(this).val(); });
        $card.find('.input-bid').on('change', function() { draft.starting_bid = parseFloat($(this).val()) || 1; });

        $card.find('.remove-draft').click((e) => {
            e.stopPropagation();
            auctionDrafts.splice(index, 1);
            renderDrafts();
        });

        $container.append($card);
    });
}

function openAuctionModal(bulk = false) {
    isBulkMode = bulk;
    $('#auction-modal').addClass('active');

    if (bulk) {
        $('#auction-modal-title').text('CONFIGURAR TODO');
        $('#auction-photo-group').hide();
        $('#bulk-info-message').show();
        $('#btn-save-auction').text('APLICAR A TODO');
    } else {
        $('#auction-modal-title').text('LANZAR SUBASTA');
        $('#auction-photo-group').show();
        $('#bulk-info-message').hide();
        $('#btn-save-auction').text('LANZAR SUBASTA');
        resetModalFields();
    }
}

function closeAuctionModal() {
    $('#auction-modal').removeClass('active');
}

function resetModalFields() {
    $('#auction-title').val('');
    $('#auction-description').val('');
    $('#auction-start-bid').val('');
    $('#auction-free-bid').prop('checked', true);
    $('.inc-check').prop('checked', false);
    $('.inc-check[value="5"], .inc-check[value="10"]').prop('checked', true);
    $('#single-auction-preview').empty();
    $('#drop-zone-single-auction').data('url', '').removeClass('has-image');

    const now = new Date();
    const end = new Date(now.getTime() + (24 * 60 * 60 * 1000));
    $('#auction-start-date').val(now.toISOString().slice(0, 16));
    $('#auction-end-date').val(end.toISOString().slice(0, 16));
}

async function handleSaveAuction() {
    const title = $('#auction-title').val();
    const desc = $('#auction-description').val();
    const startBid = parseFloat($('#auction-start-bid').val());
    const startDate = $('#auction-start-date').val();
    const endDate = $('#auction-end-date').val();
    const freeBid = $('#auction-free-bid').is(':checked');
    const increments = $('.inc-check:checked').map(function() { return parseInt($(this).val()); }).get();

    if (isBulkMode) {
        // Apply to all drafts
        auctionDrafts.forEach(d => {
            if (title) d.nombre = title;
            d.description = desc;
            if (!isNaN(startBid)) d.starting_bid = startBid;
            d.start_date = startDate;
            d.end_date = endDate;
            d.allow_free = freeBid;
            d.increments = increments;
        });
        renderDrafts();
        closeAuctionModal();
        if (window.botInstance) window.botInstance.say("¡Ajustes aplicados a todos tus borradores!");
    } else {
        // Create single auction
        const imageUrl = $('#drop-zone-single-auction').data('url');
        if (!imageUrl) return Swal.fire('Falta imagen', 'Por favor selecciona una imagen.', 'warning');
        if (!title || isNaN(startBid)) return Swal.fire('Faltan datos', 'Completa el título y la puja inicial.', 'warning');

        Swal.fire({ title: 'Publicando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const { error } = await _supabase.from('subastas').insert({
            user_id: currentUser.id,
            nombre: title,
            image_url: imageUrl,
            starting_bid: startBid,
            description: desc,
            start_date: startDate,
            end_date: endDate,
            increment_type: freeBid ? 'free' : 'fixed',
            min_increment: increments.length > 0 ? Math.min(...increments) : 1,
            is_live: true,
            status: 'Activa'
        });

        if (error) {
            Swal.fire('Error', error.message, 'error');
        } else {
            if (window.botInstance) window.botInstance.say("¡Excelente! Tu subasta ya está en vivo.");
            Swal.fire('¡Éxito!', 'Subasta publicada.', 'success');
            closeAuctionModal();
            loadLiveAuctions();
        }
    }
}

async function saveAllDrafts() {
    if (auctionDrafts.length === 0) return;

    Swal.fire({
        title: 'Publicando todo...',
        text: `Lanzando ${auctionDrafts.length} subastas.`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    const dataToInsert = auctionDrafts.map(d => ({
        user_id: currentUser.id,
        nombre: d.nombre,
        image_url: d.image_url,
        starting_bid: d.starting_bid,
        description: d.description,
        start_date: d.start_date,
        end_date: d.end_date,
        increment_type: d.allow_free ? 'free' : 'fixed',
        min_increment: d.increments.length > 0 ? Math.min(...d.increments) : 1,
        is_live: true,
        status: 'Activa'
    }));

    const { error } = await _supabase.from('subastas').insert(dataToInsert);

    if (error) {
        Swal.fire('Error', error.message, 'error');
    } else {
        if (window.botInstance) window.botInstance.say(`¡Magnífico! Las ${auctionDrafts.length} subastas han sido publicadas.`);
        Swal.fire('¡Éxito!', 'Todas las subastas han sido publicadas.', 'success');
        auctionDrafts = [];
        renderDrafts();
        loadLiveAuctions();
    }
}

async function loadLiveAuctions() {
    const { data: items, error } = await _supabase
        .from('subastas')
        .select(`*, subastas_pujas(amount, bidder_name)`)
        .eq('user_id', currentUser.id)
        .eq('is_live', true)
        .order('created_at', { ascending: false });

    if (error) return console.error(error);

    const $container = $('#live-auction-list');
    $container.empty();

    if (items.length === 0) {
        $container.html('<div style="text-align: center; width: 100%; color: #666; padding: 40px;">Aún no tienes subastas activas.</div>');
        return;
    }

    items.forEach(item => {
        const bids = item.subastas_pujas || [];
        const highestBid = bids.length > 0 ? Math.max(...bids.map(b => b.amount)) : null;
        const isEnded = new Date(item.end_date) < new Date();

        const $card = $(`
            <div class="manage-card ${isEnded ? 'ended' : ''}">
                <div class="card-img-wrapper">
                    <img src="${item.image_url}" alt="${item.nombre}">
                    ${isEnded ? '<div class="ended-overlay">FINALIZADA</div>' : ''}
                </div>
                <div class="card-content">
                    <h3>${item.nombre}</h3>
                    <div class="price-info">
                        <span class="label">Puja Actual:</span>
                        <span class="value">$${highestBid || item.starting_bid}</span>
                    </div>
                    <div class="time-info">
                        <i class="fas fa-clock"></i> ${isEnded ? 'Finalizada' : new Date(item.end_date).toLocaleString()}
                    </div>
                    <div class="card-actions">
                        <button class="btn-delete-live" data-id="${item.id}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `);
        $container.append($card);
    });
}

async function deleteLiveAuction(id) {
    const res = await Swal.fire({
        title: '¿Eliminar subasta?',
        text: 'Esta acción detendrá la subasta inmediatamente.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (res.isConfirmed) {
        const { error } = await _supabase.from('subastas').delete().eq('id', id);
        if (error) {
            Swal.fire('Error', error.message, 'error');
        } else {
            if (window.botInstance) window.botInstance.say("Subasta eliminada correctamente.");
            loadLiveAuctions();
        }
    }
}
