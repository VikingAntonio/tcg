let currentUser = null;
let auctionDrafts = [];
let isBulkMode = false;
let userSpirit = null;

$(document).ready(async function() {
    await checkSession();
    await loadUserSpirit();

    // --- Events ---
    $('#btn-open-create-auction').click(() => openAuctionModal(false));
    $('#btn-open-bulk-settings').click(() => openAuctionModal(true));
    $('#close-auction-modal').click(closeAuctionModal);
    $('#btn-save-auction').click(handleSaveAuction);
    $('#btn-save-all-drafts').click(saveAllDrafts);

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

    $('#drop-zone-single-auction').click(() => $('#input-single-auction-file').click());
    $('#input-single-auction-file').on('change', function() { if (this.files.length > 0) handleSingleUpload(this.files[0]); });

    $(document).on('click', '.btn-delete-live', function() {
        const id = $(this).data('id');
        deleteLiveAuction(id);
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

    // Load saved position
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

async function loadUserSpirit() {
    if (!currentUser) return;

    // Fetch user's selected spirit
    const spiritId = localStorage.getItem(`selectedSpirit_${currentUser.id}`);
    if (spiritId) {
        const { data: spirit } = await _supabase.from('spirits').select('*').eq('id', spiritId).single();
        if (spirit) {
            userSpirit = spirit;
            initSpiritViewer(spirit);
        }
    } else {
        // Default to first allowed or generic
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
    viewer.style.width = '100%';
    viewer.style.height = '100%';
    viewer.style.cursor = 'grab';

    if (spirit.animation_type === 'float' || spirit.animation_type === 'float-static') {
        viewer.setAttribute('autoplay', '');
    }

    $container.append(viewer);

    // Initialize Bot logic
    if (typeof CompanionBot === 'function') {
        window.botInstance = new CompanionBot({
            supabase: _supabase,
            userId: currentUser.id,
            userType: 'admin'
        });
        window.botInstance.init();
        window.botInstance.setContext('auctions');
        window.botInstance.say("¡Hola! Vamos a lanzar unas subastas increíbles hoy.");
    }
}

async function handleBulkUpload(files) {
    const fileArray = Array.from(files);

    Swal.fire({
        title: 'Cargando imágenes...',
        text: `Subiendo ${fileArray.length} artículos al servidor.`,
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

    if (window.botInstance) window.botInstance.say(`¡Genial! He preparado ${fileArray.length} borradores. Configúralos a tu gusto.`);
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
                    <input type="text" class="input-name" placeholder="Nombre" value="${draft.nombre}">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 10px; font-weight: 800;">PUJA BASE ($)</label>
                        <input type="number" class="input-bid" value="${draft.starting_bid}" step="0.01">
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
        $('#modal-photo-group').hide();
        $('#bulk-info-msg').show();
        $('#btn-save-auction').text('APLICAR AJUSTES');
    } else {
        $('#auction-modal-title').text('LANZAR SUBASTA');
        $('#modal-photo-group').show();
        $('#bulk-info-msg').hide();
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
    $('#drop-zone-single-auction').data('url', '');

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
        if (window.botInstance) window.botInstance.say("¡Perfecto! He actualizado todos los borradores con estos ajustes.");
    } else {
        const imageUrl = $('#drop-zone-single-auction').data('url');
        if (!imageUrl) return Swal.fire('Error', 'Debes subir una imagen.', 'warning');
        if (!title || isNaN(startBid)) return Swal.fire('Error', 'Completa el título y la puja base.', 'warning');

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
            if (window.botInstance) window.botInstance.say("¡Excelente! La subasta ya está activa para todos tus clientes.");
            Swal.fire('¡Éxito!', 'Subasta lanzada correctamente.', 'success');
            closeAuctionModal();
            loadLiveAuctions();
        }
    }
}

async function saveAllDrafts() {
    if (auctionDrafts.length === 0) return;

    Swal.fire({ title: 'Lanzando todo...', text: 'Publicando tus subastas masivas.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

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
        if (window.botInstance) window.botInstance.say("¡Misión cumplida! Todas las subastas han sido lanzadas.");
        Swal.fire('¡Éxito!', 'Catálogo de subastas publicado.', 'success');
        auctionDrafts = [];
        renderDrafts();
        loadLiveAuctions();
    }
}

async function loadLiveAuctions() {
    const { data: items, error } = await _supabase
        .from('subastas')
        .select(`*, subastas_pujas(amount)`)
        .eq('user_id', currentUser.id)
        .eq('is_live', true)
        .order('created_at', { ascending: false });

    if (error) return;

    const $container = $('#live-auction-list');
    $container.empty();

    if (items.length === 0) {
        $container.html('<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 40px;">No tienes subastas activas actualmente.</div>');
        return;
    }

    items.forEach(item => {
        const bids = item.subastas_pujas || [];
        const highestBid = bids.length > 0 ? Math.max(...bids.map(b => b.amount)) : null;
        const isEnded = new Date(item.end_date) < new Date();

        const $card = $(`
            <div class="manage-card">
                <div class="card-img-wrapper">
                    <img src="${item.image_url}" alt="${item.nombre}">
                </div>
                <div class="card-content">
                    <h3>${item.nombre}</h3>
                    <div class="price-info">
                        <span class="label">Pujada:</span>
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
        text: 'La subasta desaparecerá inmediatamente del catálogo público.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (res.isConfirmed) {
        const { error } = await _supabase.from('subastas').delete().eq('id', id);
        if (!error) {
            if (window.botInstance) window.botInstance.say("Subasta eliminada.");
            loadLiveAuctions();
        }
    }
}
