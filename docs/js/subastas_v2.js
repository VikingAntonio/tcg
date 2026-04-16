let auctionUser = null;
let pendingAuctions = [];
let userSpirit = null;

let isBulkMode = false;

$(document).ready(async function() {
    await checkAuctionSession();
    await loadUserSpirit();

    // --- Events with Delegation ---
    $(document).on('click', '#btn-open-create-auction', () => {
        isBulkMode = false;
        openAuctionModal(false);
    });
    $(document).on('click', '#btn-open-bulk-settings', () => {
        isBulkMode = true;
        openAuctionModal(true);
    });
    $(document).on('click', '#close-auction-modal', closeAuctionModal);
    $(document).on('click', '#btn-save-auction', handleSaveAuction);
    $(document).on('click', '#btn-save-all-drafts', saveAllPending);

    // Drop zones
    const $bulkDropZone = $('#main-drop-zone-auction');
    $bulkDropZone.on('dragover dragenter', function(e) { e.preventDefault(); e.stopPropagation(); $(this).addClass('dragover'); });
    $bulkDropZone.on('dragleave dragend drop', function(e) { e.preventDefault(); e.stopPropagation(); $(this).removeClass('dragover'); });
    $bulkDropZone.on('drop', function(e) {
        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) handleBulkUpload(files);
    });
    $bulkDropZone.on('click', () => $('#input-auction-files-bulk').click());
    $('#input-auction-files-bulk').on('change', function() { if (this.files.length > 0) handleBulkUpload(this.files); });

    const $singleDropZone = $('#drop-zone-single-auction');
    $singleDropZone.on('dragover dragenter', function(e) { e.preventDefault(); e.stopPropagation(); $(this).addClass('dragover'); });
    $singleDropZone.on('dragleave dragend drop', function(e) { e.preventDefault(); e.stopPropagation(); $(this).removeClass('dragover'); });
    $singleDropZone.on('drop', function(e) {
        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) handleSingleUpload(files[0]);
    });
    $singleDropZone.click(() => $('#input-single-auction-file').click());
    $('#input-single-auction-file').on('change', function() {
        if (this.files.length > 0) handleSingleUpload(this.files[0]);
    });

    $(document).on('click', '.btn-card-save', async function() {
        const id = $(this).data('id');
        const isLive = $(this).data('live') === true;
        saveIndividualAuction(id, isLive);
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

    // Companion interactions
    $('#floating-companion-container').click(() => {
        if (window.isCompanionDragging) return;
        $('#companion-menu').toggleClass('active');
    });

    initCompanionDraggability();
});

function initCompanionDraggability() {
    const wrapper = document.getElementById('companion-wrapper');
    const handle = document.getElementById('companion-drag-handle');
    if (!wrapper || !handle) return;

    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    const savedPos = localStorage.getItem('companionPosition');
    if (savedPos) {
        const pos = JSON.parse(savedPos);
        xOffset = pos.x;
        yOffset = pos.y;
        setTranslate(xOffset, yOffset, wrapper);
    }

    handle.addEventListener("mousedown", dragStart);
    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", dragEnd);

    handle.addEventListener("touchstart", dragStart, { passive: false });
    document.addEventListener("touchmove", drag, { passive: false });
    document.addEventListener("touchend", dragEnd);

    function dragStart(e) {
        if (e.type === "touchstart") {
            initialX = e.touches[0].clientX - xOffset;
            initialY = e.touches[0].clientY - yOffset;
        } else {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
        }
        if (e.target === handle || handle.contains(e.target)) {
            isDragging = true;
            window.isCompanionDragging = true;
            wrapper.style.transition = 'none';
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            if (e.type === "touchmove") {
                currentX = e.touches[0].clientX - initialX;
                currentY = e.touches[0].clientY - initialY;
            } else {
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
            }
            xOffset = currentX;
            yOffset = currentY;
            setTranslate(currentX, currentY, wrapper);
        }
    }

    function dragEnd() {
        if (!isDragging) return;
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
        setTimeout(() => window.isCompanionDragging = false, 100);
        wrapper.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        localStorage.setItem('companionPosition', JSON.stringify({ x: xOffset, y: yOffset }));
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = "translate3d(" + xPos + "px, " + yPos + "px, 0)";
    }
}

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

async function loadUserSpirit() {
    if (!auctionUser) return;
    const spiritId = localStorage.getItem(`selectedSpirit_${auctionUser.id}`);
    if (spiritId) {
        const { data: spirit } = await _supabase.from('spirits').select('*').eq('id', spiritId).single();
        if (spirit) {
            userSpirit = spirit;
            initSpiritViewer(spirit);
        }
    } else {
        const { data: spirits } = await _supabase.from('spirits').select('*').limit(1);
        if (spirits && spirits.length > 0) {
            userSpirit = spirits[0];
            initSpiritViewer(spirits[0]);
        }
    }
}

function initSpiritViewer(spirit) {
    const $container = $('#floating-companion-container');
    $container.empty();
    const viewer = document.createElement('model-viewer');
    viewer.setAttribute('src', spirit.gltf_url);
    viewer.setAttribute('auto-rotate', '');
    viewer.setAttribute('rotation-speed', '200%');
    viewer.setAttribute('camera-controls', '');
    viewer.setAttribute('disable-zoom', '');
    viewer.setAttribute('shadow-intensity', '1');
    viewer.style.width = '100%'; viewer.style.height = '100%'; viewer.style.cursor = 'grab';
    if (spirit.animation_type === 'float' || spirit.animation_type === 'float-static') viewer.setAttribute('autoplay', '');
    $container.append(viewer);

    if (typeof CompanionBot === 'function') {
        window.botInstance = new CompanionBot({ supabase: _supabase, userId: auctionUser.id, userType: 'admin' });
        window.botInstance.init();
        window.botInstance.setContext('auctions');
        window.botInstance.say("¡Hola! Vamos a lanzar unas subastas increíbles hoy.");
    }
}

async function handleBulkUpload(files) {
    const fileArray = Array.from(files);
    Swal.fire({ title: 'Subiendo imágenes...', text: `Procesando ${fileArray.length} archivos.`, allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    for (const file of fileArray) {
        try {
            const url = await CloudinaryUpload.uploadImage(file);
            const now = new Date();
            const defaultEnd = new Date(now.getTime() + (24 * 60 * 60 * 1000));
            pendingAuctions.push({
                id: 'pending_' + Date.now() + Math.random(),
                nombre: file.name.split('.')[0],
                image_url: url,
                starting_bid: 1,
                start_date: now.toISOString().slice(0, 16),
                end_date: defaultEnd.toISOString().slice(0, 16),
                description: '',
                increment_type: 'free',
                min_increment: 1,
                allowed_increments: '5,10'
            });
        } catch (err) { console.error("Error upload:", err); }
    }

    if (window.botInstance) window.botInstance.say(`¡Listo! He cargado ${fileArray.length} subastas nuevas. Edítalas individualmente aquí abajo.`);
    Swal.close();
    if (typeof showView === 'function') showView('bulk-auctions');
    renderPendingAuctions();
}

async function handleSingleUpload(file) {
    try {
        Swal.fire({ title: 'Subiendo...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const url = await CloudinaryUpload.uploadImage(file);
        $('#single-auction-preview').html(`<img src="${url}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;">`);
        $('#drop-zone-single-auction').data('url', url).addClass('has-image');
        Swal.close();
    } catch (err) { Swal.fire('Error', 'No se pudo subir la imagen.', 'error'); }
}

function renderPendingAuctions() {
    const $container = $('#auction-pending-list');
    const $toolbar = $('#bulk-actions-toolbar');
    $container.empty();

    if (pendingAuctions.length === 0) { $toolbar.hide(); return; }
    $toolbar.show();
    $('#pending-auction-count').text(pendingAuctions.length);

    pendingAuctions.forEach(auction => {
        const $card = createPrettyCard(auction, false);
        $container.append($card);
    });
}

function createPrettyCard(item, isLive) {
    const id = item.id;
    const $card = $(`
        <div class="pretty-auction-card" id="card-${id}">
            <button class="remove-btn" data-id="${id}" data-live="${isLive}"><i class="fas fa-times"></i></button>
            <div class="card-img-container">
                <img src="${item.image_url}" alt="Auction">
            </div>
            <div class="card-inputs">
                <div class="form-group">
                    <label>Título</label>
                    <input type="text" class="card-input-title" value="${item.nombre || ''}" placeholder="Ej: Carta Especial">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div class="form-group">
                        <label>Puja Base ($)</label>
                        <input type="number" class="card-input-bid" value="${item.starting_bid || 1}" step="0.01">
                    </div>
                    <div class="form-group">
                        <label>Estado</label>
                        <div style="padding: 10px; background: #222; border-radius: 12px; font-size: 0.7rem; text-align: center; color: ${isLive ? '#00d2ff' : '#666'}; font-weight: 800;">
                            ${isLive ? 'ACTIVA' : 'PENDIENTE'}
                        </div>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div class="form-group">
                        <label>Inicio</label>
                        <input type="datetime-local" class="card-input-start" value="${item.start_date ? item.start_date.slice(0, 16) : ''}">
                    </div>
                    <div class="form-group">
                        <label>Fin</label>
                        <input type="datetime-local" class="card-input-end" value="${item.end_date ? item.end_date.slice(0, 16) : ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Descripción</label>
                    <textarea class="card-input-desc" style="height: 60px;">${item.description || ''}</textarea>
                </div>
            </div>
            <div class="card-footer">
                <button class="btn-card-save" data-id="${id}" data-live="${isLive}">
                    <i class="fas fa-save"></i> ${isLive ? 'ACTUALIZAR' : 'GUARDAR'}
                </button>
            </div>
        </div>
    `);

    // Dynamic sync for pending
    if (!isLive) {
        $card.find('input, textarea').on('change', function() {
            const field = $(this).attr('class');
            if (field.includes('title')) item.nombre = $(this).val();
            if (field.includes('bid')) item.starting_bid = parseFloat($(this).val()) || 1;
            if (field.includes('start')) item.start_date = $(this).val();
            if (field.includes('end')) item.end_date = $(this).val();
            if (field.includes('desc')) item.description = $(this).val();
        });
    }

    return $card;
}

async function saveIndividualAuction(id, isLive) {
    const $card = $(`#card-${id}`);
    const title = $card.find('.card-input-title').val();
    const bid = parseFloat($card.find('.card-input-bid').val());
    const start = $card.find('.card-input-start').val();
    const end = $card.find('.card-input-end').val();
    const desc = $card.find('.card-input-desc').val();

    if (!title || isNaN(bid)) return Swal.fire('Error', 'Título y Puja Base son obligatorios.', 'warning');

    Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const auctionData = {
        nombre: title,
        starting_bid: bid,
        start_date: start,
        end_date: end,
        description: desc,
        status: 'Activa',
        is_live: true
    };

    if (isLive) {
        const { error } = await _supabase.from('subastas').update(auctionData).eq('id', id);
        if (error) Swal.fire('Error', error.message, 'error');
        else {
            Swal.fire('¡Éxito!', 'Subasta actualizada.', 'success');
            if (window.botInstance) window.botInstance.say("He guardado los cambios en esta subasta.");
            loadLiveAuctions();
        }
    } else {
        // First persistence for pending items
        const item = pendingAuctions.find(a => a.id === id);
        const insertData = {
            ...auctionData,
            user_id: auctionUser.id,
            image_url: item.image_url,
            increment_type: item.increment_type || 'free',
            min_increment: item.min_increment || 1,
            allowed_increments: item.allowed_increments || '5,10'
        };

        // Role Limit Check
        const limitRes = await checkRoleLimit(1);
        if (!limitRes) return;

        const { error } = await _supabase.from('subastas').insert(insertData);
        if (error) Swal.fire('Error', error.message, 'error');
        else {
            Swal.fire('¡Lanzada!', 'La subasta ahora es pública.', 'success');
            if (window.botInstance) window.botInstance.say("¡Subasta lanzada con éxito!");
            pendingAuctions = pendingAuctions.filter(a => a.id !== id);
            renderPendingAuctions();
            loadLiveAuctions();
        }
    }
}

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

async function saveAllPending() {
    if (pendingAuctions.length === 0) return;
    const limitRes = await checkRoleLimit(pendingAuctions.length);
    if (!limitRes) return;

    Swal.fire({ title: 'Lanzando todas...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const dataToInsert = pendingAuctions.map(a => ({
        user_id: auctionUser.id,
        nombre: a.nombre,
        image_url: a.image_url,
        starting_bid: a.starting_bid,
        start_date: a.start_date,
        end_date: a.end_date,
        description: a.description,
        increment_type: a.increment_type || 'free',
        min_increment: a.min_increment || 1,
        allowed_increments: a.allowed_increments || '5,10',
        is_live: true,
        status: 'Activa'
    }));

    const { error } = await _supabase.from('subastas').insert(dataToInsert);
    if (error) Swal.fire('Error', error.message, 'error');
    else {
        Swal.fire('¡Éxito!', `${pendingAuctions.length} subastas lanzadas.`, 'success');
        if (window.botInstance) window.botInstance.say("¡Impresionante! He lanzado todas tus subastas al catálogo.");
        pendingAuctions = [];
        renderPendingAuctions();
        if (typeof showView === 'function') showView('manage-auctions');
        loadLiveAuctions();
    }
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
        window.botInstance.say(`Tienes ${activeCount} subastas activas en este momento. ¡Asegúrate de que todo esté en orden!`, { duration: 6 });
    }

    items.forEach(item => {
        const $card = createPrettyCard(item, true);
        $container.append($card);
    });
}

function openAuctionModal(isConfig = false) {
    $('#auction-modal').addClass('active');
    resetModalFields();

    if (isConfig) {
        $('#auction-modal-title').text('CONFIGURACIÓN MASIVA');
        $('#bulk-info-msg').show();
        $('#modal-photo-group').hide();
        $('#btn-save-auction').text('APLICAR A TODO');
        // Clear title as it might be individual
        $('#auction-title').attr('placeholder', '(Opcional) Título base para todas');
    } else {
        $('#auction-modal-title').text('LANZAR SUBASTA');
        $('#bulk-info-msg').hide();
        $('#modal-photo-group').show();
        $('#btn-save-auction').text('LANZAR SUBASTA');
        $('#auction-title').attr('placeholder', 'Ej: Playera Firmada Edición Limitada');
    }
}

function closeAuctionModal() { $('#auction-modal').removeClass('active'); }

function resetModalFields() {
    $('#auction-title').val(''); $('#auction-description').val(''); $('#auction-start-bid').val('');
    const now = new Date(); const end = new Date(now.getTime() + (24 * 60 * 60 * 1000));
    $('#auction-start-date').val(now.toISOString().slice(0, 16)); $('#auction-end-date').val(end.toISOString().slice(0, 16));
    $('#single-auction-preview').empty(); $('#drop-zone-single-auction').data('url', '');
}

async function handleSaveAuction() {
    const title = $('#auction-title').val();
    const bid = parseFloat($('#auction-start-bid').val());
    const start = $('#auction-start-date').val();
    const end = $('#auction-end-date').val();
    const desc = $('#auction-description').val();

    if (isBulkMode) {
        // Get increments from checkboxes
        const increments = [];
        $('.inc-check:checked').each(function() { increments.push($(this).val()); });
        const allowFree = $('#auction-free-bid').is(':checked');

        // Apply to all pending
        pendingAuctions.forEach(a => {
            if (title) a.nombre = title;
            if (!isNaN(bid)) a.starting_bid = bid;
            if (start) a.start_date = start;
            if (end) a.end_date = end;
            if (desc) a.description = desc;

            a.increment_type = allowFree ? 'free' : 'fixed';
            a.min_increment = increments.length > 0 ? Math.min(...increments) : 1;
            a.allowed_increments = increments.join(',');
        });
        renderPendingAuctions();
        Swal.fire('¡Aplicado!', 'Se han actualizado los ajustes para todas las subastas de la lista.', 'success');
        closeAuctionModal();
        if (window.botInstance) window.botInstance.say("He aplicado estos ajustes a todas las subastas pendientes.");
        return;
    }

    const imageUrl = $('#drop-zone-single-auction').data('url');
    if (!imageUrl || !title || isNaN(bid)) return Swal.fire('Error', 'Completa todos los campos obligatorios.', 'warning');
    const limitRes = await checkRoleLimit(1);
    if (!limitRes) return;

    Swal.fire({ title: 'Lanzando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    // Get increments from checkboxes
    const increments = [];
    $('.inc-check:checked').each(function() { increments.push($(this).val()); });
    const allowFree = $('#auction-free-bid').is(':checked');

    const { error } = await _supabase.from('subastas').insert({
        user_id: auctionUser.id,
        nombre: title,
        image_url: imageUrl,
        starting_bid: bid,
        start_date: start,
        end_date: end,
        description: desc,
        increment_type: allowFree ? 'free' : 'fixed',
        min_increment: increments.length > 0 ? Math.min(...increments) : 1,
        allowed_increments: increments.join(','),
        is_live: true,
        status: 'Activa'
    });

    if (error) Swal.fire('Error', error.message, 'error');
    else {
        Swal.fire('¡Éxito!', 'Subasta lanzada.', 'success');
        if (window.botInstance) window.botInstance.say("¡Subasta lanzada exitosamente!");
        closeAuctionModal();
        loadLiveAuctions();
    }
}

async function deleteLiveAuction(id) {
    const res = await Swal.fire({ title: '¿Eliminar subasta?', text: 'Se borrará permanentemente.', icon: 'warning', showCancelButton: true });
    if (res.isConfirmed) {
        const { error } = await _supabase.from('subastas').delete().eq('id', id);
        if (!error) {
            if (window.botInstance) window.botInstance.say("Subasta eliminada.");
            loadLiveAuctions();
        }
    }
}
