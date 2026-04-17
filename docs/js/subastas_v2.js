let auctionUser = null;
let pendingAuctions = [];
let isDraggingAdmin = false;
let startXAdmin, startYAdmin;

$(document).ready(async function() {
    await checkAuctionSession();

    // --- Events with Delegation ---
    $(document).on('click', '#btn-open-create-auction', () => {
        openAuctionModal();
    });
    $(document).on('click', '#close-auction-modal', closeAuctionModal);
    $(document).on('click', '#btn-save-auction', handleSaveAuction);

    // Flatpickr initialization
    flatpickr("#auction-start-date, #auction-end-date", {
        enableTime: true,
        noCalendar: false,
        dateFormat: "Y-m-d h:i A",
        time_24hr: false,
        allowInput: true,
        clickOpens: true,
        disableMobile: true,
        plugins: [confirmDatePlugin({
            confirmIcon: "<i class='fas fa-check'></i>",
            confirmText: "ACEPTAR",
            showAlways: true,
            theme: "light"
        })]
    });

    // Drop zones
    const $bulkDropZone = $('#main-drop-zone-auction');
    $bulkDropZone.on('dragover dragenter', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).addClass('dragover');
    });
    $bulkDropZone.on('dragleave dragend drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('dragover');
    });
    $bulkDropZone.on('drop', function(e) {
        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) handleBulkUpload(files);
    });
    $bulkDropZone.on('click', () => $('#input-auction-files-bulk').click());
    $('#input-auction-files-bulk').on('change', function() { if (this.files.length > 0) handleBulkUpload(this.files); });

    const $singleDropZone = $('#drop-zone-single-auction');
    $singleDropZone.on('dragover dragenter', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).addClass('dragover');
    });
    $singleDropZone.on('dragleave dragend drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('dragover');
    });
    $singleDropZone.on('drop', function(e) {
        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) handleSingleUpload(Array.from(files));
    });
    $singleDropZone.click(() => $('#input-single-auction-file').click());
    $('#input-single-auction-file').on('change', function() {
        if (this.files.length > 0) handleSingleUpload(Array.from(this.files));
    });

    $(document).on('click', '.remove-btn', function() {
        const id = $(this).data('id');
        const isLive = $(this).data('live') === true;
        if (isLive) {
            deleteLiveAuction(id);
        } else {
            pendingAuctions = pendingAuctions.filter(a => a.id !== id);
            renderPendingAuctions();
        }
    });
});

async function checkAuctionSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        const { data: user } = await _supabase.from('usuarios').select('*').eq('id', session.user.id).single();
        if (user) {
            auctionUser = user;
            loadLiveAuctions();
        } else if (!window.location.pathname.endsWith('admin.html')) {
            window.location.href = 'admin.html';
        }
    } else if (!window.location.pathname.endsWith('admin.html')) {
        window.location.href = 'admin.html';
    }
}

async function handleBulkUpload(files) {
    const fileArray = Array.from(files);
    Swal.fire({ title: 'Subiendo imágenes...', text: `Procesando ${fileArray.length} archivos.`, allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const urls = [];
    for (const file of fileArray) {
        try {
            const url = await CloudinaryUpload.uploadImage(file);
            urls.push(url);
        } catch (err) { console.error("Error upload:", err); }
    }

    Swal.close();
    if (urls.length > 0) {
        openAuctionModal();
        renderModalPreviews(urls);
    }
}

async function handleSingleUpload(fileList) {
    try {
        Swal.fire({ title: 'Subiendo...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        let currentUrls = $('#preview-grid-auction').data('urls') || [];
        const newUrls = [];
        for (const file of fileList) {
            const url = await CloudinaryUpload.uploadImage(file);
            newUrls.push(url);
        }
        const totalUrls = [...currentUrls, ...newUrls];
        renderModalPreviews(totalUrls);
        Swal.close();
    } catch (err) { Swal.fire('Error', 'No se pudo subir la imagen.', 'error'); }
}

function renderModalPreviews(urls) {
    const $grid = $('#preview-grid-auction');
    const $dropZone = $('#drop-zone-single-auction');

    $grid.empty().data('urls', urls);

    if (urls && urls.length > 0) {
        $dropZone.hide();
        $grid.show();
        urls.forEach(url => {
            $grid.append(`
                <div class="preview-item-mini" title="Click para quitar" onclick="removePreviewFromModal('${url}')">
                    <img src="${url}">
                    <div style="position:absolute; top:2px; right:2px; background:rgba(255,0,0,0.7); color:white; border-radius:50%; width:16px; height:16px; font-size:10px; display:flex; align-items:center; justify-content:center; cursor:pointer;"><i class="fas fa-times"></i></div>
                </div>
            `);
        });
        // Add a "Add More" box in the grid
        $grid.append(`
            <div class="preview-item-mini" style="border: 2px dashed #eee; display:flex; align-items:center; justify-content:center; cursor:pointer;" onclick="$('#input-single-auction-file').click()">
                <i class="fas fa-plus" style="color:#ccc;"></i>
            </div>
        `);
    } else {
        $dropZone.show();
        $grid.hide();
    }
}

window.removePreviewFromModal = (url) => {
    let urls = $('#preview-grid-auction').data('urls') || [];
    urls = urls.filter(u => u !== url);
    renderModalPreviews(urls);
};

function renderPendingAuctions() {
    // Legacy - No longer using intermediate bulk view
}

function createPrettyCard(item, isLive) {
    const id = item.id;
    const bidValue = item.starting_bid || 0;
    const bidCount = 0;

    const $card = $(`
        <div class="pretty-auction-card" id="card-${id}">
            ${isLive ? `<div class="status-badge">${item.status || 'ACTIVA'}</div>` : '<div class="status-badge" style="background:#adb5bd;">DRAFT</div>'}

            <div class="card-img-container">
                <img src="${item.image_url}" alt="Auction">
            </div>

            <div class="card-title">${item.nombre || 'Sin título'}</div>

            <div class="bid-stats">
                <div class="stat-box">
                    <span class="stat-label">PUJA ACTUAL</span>
                    <span class="stat-value">$${parseFloat(bidValue).toFixed(2)}</span>
                </div>
                <div class="stat-box">
                    <span class="stat-label">PUJAS</span>
                    <span class="stat-value">${bidCount}</span>
                </div>
            </div>

            <div style="display:flex; justify-content: space-between; align-items: center; margin-top: auto;">
                <div class="gestionar-link btn-gestionar-admin">
                    GESTIONAR <i class="fas fa-chevron-right" style="font-size: 0.6rem;"></i>
                </div>
                <button class="remove-btn" data-id="${id}" data-live="${isLive}"><i class="fas fa-trash-alt"></i></button>
            </div>
        </div>
    `);

    $card.on('touchstart mousedown', function(e) {
        isDraggingAdmin = false;
        const ev = e.type.startsWith('touch') ? e.originalEvent.touches[0] : e;
        startXAdmin = ev.pageX;
        startYAdmin = ev.pageY;
    });

    $card.on('touchmove mousemove', function(e) {
        if (startXAdmin === undefined || startYAdmin === undefined) return;
        const ev = e.type.startsWith('touch') ? e.originalEvent.touches[0] : e;
        if (Math.abs(ev.pageX - startXAdmin) > 5 || Math.abs(ev.pageY - startYAdmin) > 5) {
            isDraggingAdmin = true;
        }
    });

    $card.on('touchend mouseup', function() {
        startXAdmin = undefined;
        startYAdmin = undefined;
        setTimeout(() => { isDraggingAdmin = false; }, 100);
    });

    $card.find('.btn-gestionar-admin').on('click', function() {
        if (isDraggingAdmin) return;
        editAuctionFromCard(id, isLive);
    });

    return $card;
}

window.editAuctionFromCard = async (id, isLive) => {
    let auctionData;
    if (isLive) {
        const { data } = await _supabase.from('subastas').select('*').eq('id', id).single();
        auctionData = data;
    } else {
        return; // No pending edits anymore
    }

    if (!auctionData) return;

    openAuctionModal();

    $('#auction-modal').data('editing-id', id);
    $('#auction-modal').data('is-live', isLive);

    $('#auction-title').val(auctionData.nombre || '');
    $('#auction-start-bid').val(auctionData.starting_bid || '');

    const startFp = document.querySelector("#auction-start-date")._flatpickr;
    const endFp = document.querySelector("#auction-end-date")._flatpickr;
    if (startFp && auctionData.start_date) startFp.setDate(new Date(auctionData.start_date));
    if (endFp && auctionData.end_date) endFp.setDate(new Date(auctionData.end_date));

    $('#auction-description').val(auctionData.description || '');

    if (auctionData.allowed_increments) {
        const incs = auctionData.allowed_increments.split(',');
        $('.inc-check').prop('checked', false);
        incs.forEach(inc => {
            $(`.inc-check[value="${inc}"]`).prop('checked', true);
        });
    }
    $('#auction-free-bid').prop('checked', auctionData.increment_type === 'free');

    renderModalPreviews([auctionData.image_url]);
};

async function checkRoleLimit(tryingToAdd = 1) {
    let limit = (auctionUser.role === 'premium') ? 20 : 10;
    if (['admin', 'admin_store', 'tienda'].includes(auctionUser.role)) limit = 9999;

    const { count } = await _supabase.from('subastas').select('*', { count: 'exact', head: true }).eq('user_id', auctionUser.id).eq('status', 'Activa');
    if ((count + tryingToAdd) > limit) {
        Swal.fire('Límite Alcanzado', `Tu plan permite ${limit} subastas activas. Actualmente tienes ${count}.`, 'warning');
        return false;
    }
    return true;
}


async function loadLiveAuctions() {
    if (!auctionUser) return;
    const { data: items, error } = await _supabase.from('subastas').select('*').eq('user_id', auctionUser.id).order('created_at', { ascending: false });
    if (error) return;

    const $container = $('#live-auction-list');
    $container.empty();
    if (items.length === 0) {
        $container.html('<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 40px;">No tienes subastas activas.</div>');
        return;
    }

    if (window.botInstance) {
        const activeCount = items.filter(i => i.status === 'Activa').length;
        window.botInstance.say(`Tienes ${activeCount} subastas activas en este momento.`, { duration: 6 });
    }

    items.forEach(item => {
        const $card = createPrettyCard(item, true);
        $container.append($card);
    });
}

function openAuctionModal() {
    $('#auction-modal').addClass('active');
    resetModalFields();
    $('#auction-modal-title').text('LANZAR SUBASTA');
    $('#btn-save-auction').text('LANZAR SUBASTA');
}

function closeAuctionModal() { $('#auction-modal').removeClass('active'); }

function resetModalFields() {
    $('#auction-modal').removeData('editing-id').removeData('is-live');
    $('#auction-title').val('');
    $('#auction-description').val('');
    $('#auction-start-bid').val('');
    $('#auction-custom-increment').val('');
    $('#input-single-auction-file').val('');
    $('#input-auction-files-bulk').val('');
    $('#preview-grid-auction').data('urls', []); // Clear URLs data

    const now = new Date();
    const end = new Date(now.getTime() + (24 * 60 * 60 * 1000));

    const startFp = document.querySelector("#auction-start-date")._flatpickr;
    const endFp = document.querySelector("#auction-end-date")._flatpickr;
    if (startFp) startFp.setDate(now);
    if (endFp) endFp.setDate(end);

    renderModalPreviews([]); // This will restore the drop zone UI
    $('.inc-check').prop('checked', true);
    $('#auction-free-bid').prop('checked', true);
}

async function handleSaveAuction() {
    const urls = $('#preview-grid-auction').data('urls') || [];
    if (urls.length === 0) return Swal.fire('Atención', 'Debes cargar al menos una imagen.', 'warning');

    const title = $('#auction-title').val();
    const bid = parseFloat($('#auction-start-bid').val()) || 0;

    const startFp = document.querySelector("#auction-start-date")._flatpickr;
    const endFp = document.querySelector("#auction-end-date")._flatpickr;

    // Ensure we save as ISO strings for UTC consistency
    const start = startFp.selectedDates[0] ? startFp.selectedDates[0].toISOString() : null;
    const end = endFp.selectedDates[0] ? endFp.selectedDates[0].toISOString() : null;

    const desc = $('#auction-description').val();

    const increments = [];
    $('.inc-check:checked').each(function() { increments.push($(this).val()); });
    const customInc = parseFloat($('#auction-custom-increment').val());
    if (!isNaN(customInc)) increments.push(customInc);

    const allowFree = $('#auction-free-bid').is(':checked');

    const editingId = $('#auction-modal').data('editing-id');
    const isLive = $('#auction-modal').data('is-live');

    // Prepare common auction data
    const auctionBaseData = {
        nombre: title || 'Nueva Subasta',
        starting_bid: bid,
        start_date: start,
        end_date: end,
        description: desc,
        increment_type: allowFree ? 'free' : 'fixed',
        min_increment: increments.length > 0 ? Math.min(...increments) : 1,
        allowed_increments: increments.join(','),
        is_live: true,
        status: 'Activa'
    };

    if (editingId && isLive) {
        const { error } = await _supabase.from('subastas').update(auctionBaseData).eq('id', editingId);
        if (error) return Swal.fire('Error', error.message, 'error');

        Swal.fire('¡Éxito!', 'Subasta actualizada.', 'success');
        closeAuctionModal();
        loadLiveAuctions();
        return;
    }

    // New auctions creation (Single or Multi)
    const limitRes = await checkRoleLimit(urls.length);
    if (!limitRes) return;

    Swal.fire({ title: 'Lanzando subastas...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const dataToInsert = urls.map(url => ({
        ...auctionBaseData,
        user_id: auctionUser.id,
        image_url: url
    }));

    const { error } = await _supabase.from('subastas').insert(dataToInsert);
    if (error) {
        Swal.fire('Error', error.message, 'error');
    } else {
        Swal.fire('¡Éxito!', `${urls.length} subastas lanzadas al catálogo.`, 'success');
        if (window.botInstance) window.botInstance.say("¡Hecho! Tus subastas ya están disponibles para todos.");
        closeAuctionModal();
        if (typeof showView === 'function') showView('manage-auctions');
        loadLiveAuctions();
    }
}

async function deleteLiveAuction(id) {
    const res = await Swal.fire({ title: '¿Eliminar subasta?', text: 'Se borrará permanentemente.', icon: 'warning', showCancelButton: true });
    if (res.isConfirmed) {
        const { error } = await _supabase.from('subastas').delete().eq('id', id);
        if (!error) {
            loadLiveAuctions();
        }
    }
}
