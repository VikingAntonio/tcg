let auctionUser = null;
let pendingAuctions = [];
let isDraggingAdmin = false;
let startXAdmin, startYAdmin;
let currentAdminAuctionFilter = 'active';

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
        minuteIncrement: 1,
        onOpen: function(selectedDates, dateStr, instance) {
            if (window.innerWidth <= 768) {
                instance.element.blur();
            }
        },
        onReady: function(selectedDates, dateStr, instance) {
            const $timeInputs = $(instance.calendarContainer).find('.flatpickr-time input');
            $timeInputs.on('click', function() {
                $(this).focus();
            });
        },
        plugins: [confirmDatePlugin({
            confirmIcon: "<i class='fas fa-check'></i>",
            confirmText: "ACEPTAR",
            showAlways: true,
            theme: "light"
        })]
    });

    flatpickr("#auction-delivery-date", {
        enableTime: false,
        noCalendar: false,
        dateFormat: "Y-m-d",
        allowInput: true,
        disableMobile: true,
        onOpen: function(selectedDates, dateStr, instance) {
            if (window.innerWidth <= 768) instance.element.blur();
        }
    });

    flatpickr(".time-picker-simple", {
        enableTime: true,
        noCalendar: true,
        dateFormat: "h:i K",
        time_24hr: false,
        allowInput: true,
        disableMobile: true,
        onOpen: function(selectedDates, dateStr, instance) {
            if (window.innerWidth <= 768) instance.element.blur();
        }
    });

    // Drop zones (using delegation for better mobile click support)
    $(document).on('dragover dragenter', '#drop-zone-single-auction', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).addClass('dragover');
    });
    $(document).on('dragleave dragend drop', '#drop-zone-single-auction', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('dragover');
    });
    $(document).on('drop', '#drop-zone-single-auction', function(e) {
        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) handleSingleUpload(Array.from(files));
    });
    $(document).on('change', '#input-single-auction-file', function() {
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

    $(document).on('click', '#admin-auction-tabs .tab-pill', function() {
        $('#admin-auction-tabs .tab-pill').removeClass('active');
        $(this).addClass('active');
        currentAdminAuctionFilter = $(this).data('filter');
        loadLiveAuctions();
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

    const now = new Date();
    const endDate = item.end_date ? new Date(item.end_date.replace(' ', 'T')) : null;
    const isEnded = endDate && now > endDate;

    const $card = $(`
        <div class="pretty-auction-card ${isEnded ? 'status-ended' : ''}" id="card-${id}">
            ${isLive ? `<div class="status-badge" style="${isEnded ? 'background:#ff4757;' : ''}">${isEnded ? 'FINALIZADA' : (item.status || 'ACTIVA')}</div>` : '<div class="status-badge" style="background:#adb5bd;">DRAFT</div>'}

            <div class="card-img-container">
                <img src="${item.image_url}" alt="Auction">
                ${isEnded ? '<div class="status-ended-seal" style="font-size: 1.2rem; border-width: 3px; padding: 5px 10px;"></div>' : ''}
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

    // Delivery fields
    $('#auction-delivery-place').val(auctionData.delivery_place || '');
    const deliveryDateFp = document.querySelector("#auction-delivery-date")._flatpickr;
    if (deliveryDateFp && auctionData.delivery_date) deliveryDateFp.setDate(new Date(auctionData.delivery_date));

    const startTimeFp = document.querySelector("#auction-delivery-time-start")._flatpickr;
    const endTimeFp = document.querySelector("#auction-delivery-time-end")._flatpickr;
    if (startTimeFp && auctionData.delivery_time_start) startTimeFp.setDate(auctionData.delivery_time_start, false, "h:i K");
    if (endTimeFp && auctionData.delivery_time_end) endTimeFp.setDate(auctionData.delivery_time_end, false, "h:i K");

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
    // Monthly Reset Logic and Limits
    const { data: limitData, error: rpcErr } = await _supabase.rpc('check_and_reset_auction_limits', { target_user_id: auctionUser.id });

    if (rpcErr) {
        console.error("RPC Error:", rpcErr);
    } else if (limitData && limitData.length > 0) {
        const stats = limitData[0];
        auctionUser.monthly_bid_count = stats.curr_bid_count;
        auctionUser.monthly_created_count = stats.curr_created_count;
        auctionUser.auction_reset_date = stats.reset_date;
    }

    let limit = (auctionUser.role === 'premium') ? 150 : 50;
    if (['admin', 'admin_store', 'tienda'].includes(auctionUser.role)) limit = 9999;

    if ((auctionUser.monthly_created_count + tryingToAdd) > limit) {
        const resetDate = new Date(auctionUser.auction_reset_date);
        const now = new Date();
        const diff = resetDate - now;

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        Swal.fire({
            title: 'Límite Mensual Alcanzado',
            html: `Has alcanzado tu límite de creación de <b>${limit}</b> subastas por mes.<br><br>Faltan <b>${days}d ${hours}h</b> para que se reinicie tu contador.`,
            icon: 'info'
        });
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

    const now = new Date();
    const filteredItems = items.filter(item => {
        const endDate = item.end_date ? new Date(item.end_date.replace(' ', 'T')) : null;
        if (currentAdminAuctionFilter === 'active') {
            return !endDate || now <= endDate;
        } else {
            return endDate && now > endDate;
        }
    });

    if (filteredItems.length === 0) {
        const msg = currentAdminAuctionFilter === 'active' ? 'No tienes subastas activas.' : 'No tienes subastas finalizadas.';
        $container.html(`<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 40px;">${msg}</div>`);
        return;
    }

    if (window.botInstance && currentAdminAuctionFilter === 'active') {
        const activeCount = filteredItems.length;
        window.botInstance.say(`Tienes ${activeCount} subastas activas en este momento.`, { duration: 6 });
    }

    filteredItems.forEach(item => {
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
    $('#preview-grid-auction').data('urls', []); // Clear URLs data

    $('#auction-delivery-place').val('');
    const deliveryDateFp = document.querySelector("#auction-delivery-date")._flatpickr;
    if (deliveryDateFp) deliveryDateFp.clear();
    const startTimeFp = document.querySelector("#auction-delivery-time-start")._flatpickr;
    const endTimeFp = document.querySelector("#auction-delivery-time-end")._flatpickr;
    if (startTimeFp) startTimeFp.clear();
    if (endTimeFp) endTimeFp.clear();

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

    const deliveryPlace = $('#auction-delivery-place').val();
    const deliveryDate = document.querySelector("#auction-delivery-date")._flatpickr.selectedDates[0];
    const deliveryTimeStart = $('#auction-delivery-time-start').val();
    const deliveryTimeEnd = $('#auction-delivery-time-end').val();

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
        status: 'Activa',
        delivery_place: deliveryPlace,
        delivery_date: deliveryDate ? deliveryDate.toISOString() : null,
        delivery_time_start: deliveryTimeStart,
        delivery_time_end: deliveryTimeEnd
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
        // Increment monthly created counter
        const newCount = (auctionUser.monthly_created_count || 0) + dataToInsert.length;
        await _supabase.from('usuarios').update({ monthly_created_count: newCount }).eq('id', auctionUser.id);
        auctionUser.monthly_created_count = newCount;

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
