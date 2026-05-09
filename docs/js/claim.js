let claimUser = null;
let currentAdminClaimFilter = 'active';

$(document).ready(async function() {
    await checkClaimSession();

    // --- Events ---
    $('#btn-open-create-claim').on('click', openClaimModal);
    $('#close-claim-modal').on('click', closeClaimModal);
    $('#btn-save-claim').on('click', handleSaveClaim);

    // Tabs switching logic
    $('.modal-tab-btn').on('click', function() {
        const tabId = $(this).data('tab');
        $('.modal-tab-btn').removeClass('active');
        $(this).addClass('active');
        $('.modal-tab-pane').removeClass('active');
        $(`#${tabId}`).addClass('active');
    });

    // Flatpickr initialization
    flatpickr("#claim-start-date, #claim-end-date", {
        enableTime: true,
        dateFormat: "Y-m-d h:i A",
        time_24hr: false,
        disableMobile: true
    });

    // Drop zones
    $('#drop-zone-claim').on('dragover dragenter', function(e) {
        e.preventDefault(); e.stopPropagation();
        $(this).addClass('dragover');
    });
    $('#drop-zone-claim').on('dragleave dragend drop', function(e) {
        e.preventDefault(); e.stopPropagation();
        $(this).removeClass('dragover');
    });
    $('#drop-zone-claim').on('drop', function(e) {
        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) handleClaimUpload(Array.from(files));
    });
    $('#input-claim-file').on('change', function() {
        if (this.files.length > 0) handleClaimUpload(Array.from(this.files));
    });

    $('#admin-claim-tabs .tab-pill').on('click', function() {
        $('#admin-claim-tabs .tab-pill').removeClass('active');
        $(this).addClass('active');
        currentAdminClaimFilter = $(this).data('filter');
        loadClaims();
    });

    $(document).on('click', '.btn-edit-claim', function() {
        const id = $(this).data('id');
        editClaim(id);
    });

    $(document).on('click', '.btn-delete-claim', function() {
        const id = $(this).data('id');
        deleteClaim(id);
    });
});

async function checkClaimSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        const { data: user } = await _supabase.from('usuarios').select('*').eq('id', session.user.id).single();
        if (user) {
            claimUser = user;
            loadClaims();
        } else {
            window.location.href = 'admin.html';
        }
    } else {
        window.location.href = 'admin.html';
    }
}

async function handleClaimUpload(fileList) {
    try {
        Swal.fire({ title: 'Subiendo...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        let currentUrls = $('#preview-grid-claim').data('urls') || [];
        const newUrls = [];
        for (const file of fileList) {
            const url = await CloudinaryUpload.uploadImage(file);
            newUrls.push(url);
        }
        const totalUrls = [...currentUrls, ...newUrls];
        renderClaimPreviews(totalUrls);
        Swal.close();
    } catch (err) { Swal.fire('Error', 'No se pudo subir la imagen.', 'error'); }
}

function renderClaimPreviews(urls) {
    const $grid = $('#preview-grid-claim');
    const $dropZone = $('#drop-zone-claim');
    $grid.empty().data('urls', urls);

    if (urls && urls.length > 0) {
        $dropZone.hide();
        $grid.show();
        urls.forEach(url => {
            $grid.append(`
                <div class="preview-item-mini">
                    <img src="${url}">
                    <div class="remove-preview" onclick="removeClaimPreview('${url}')" style="position:absolute; top:2px; right:2px; background:rgba(255,0,0,0.7); color:white; border-radius:50%; width:18px; height:18px; font-size:10px; display:flex; align-items:center; justify-content:center; cursor:pointer;"><i class="fas fa-times"></i></div>
                </div>
            `);
        });
        $grid.append(`<div class="preview-item-mini" style="border: 2px dashed #333; display:flex; align-items:center; justify-content:center; cursor:pointer;" onclick="$('#input-claim-file').click()"><i class="fas fa-plus"></i></div>`);
    } else {
        $dropZone.show();
        $grid.hide();
    }
}

window.removeClaimPreview = (url) => {
    let urls = $('#preview-grid-claim').data('urls') || [];
    urls = urls.filter(u => u !== url);
    renderClaimPreviews(urls);
};

async function loadClaims() {
    if (!claimUser) return;
    const { data: claims, error } = await _supabase
        .from('claims')
        .select('*')
        .eq('user_id', claimUser.id)
        .order('created_at', { ascending: false });

    if (error) return;

    const $container = $('#claim-list');
    $container.empty();

    const filtered = claims.filter(c => {
        if (currentAdminClaimFilter === 'active') return c.status === 'Activa';
        return c.status === 'Reclamada' || c.status === 'Finalizada';
    });

    if (filtered.length === 0) {
        $container.html('<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 40px;">No hay claims para mostrar.</div>');
        return;
    }

    filtered.forEach(claim => {
        const firstImg = claim.image_urls && claim.image_urls.length > 0 ? claim.image_urls[0] : 'https://via.placeholder.com/300x200?text=Sin+Imagen';
        const isReclamada = claim.status === 'Reclamada';

        const $card = $(`
            <div class="pretty-claim-card">
                <div class="status-badge" style="${isReclamada ? 'background:#ff4757; color:white;' : ''}">${claim.status} ${isReclamada ? 'por ' + claim.winner_name : ''}</div>
                <div class="card-img-container">
                    <img src="${firstImg}" alt="${claim.title}">
                    ${isReclamada ? '<div class="claimed-stamp" style="font-size: 1rem;">RECLAMADO</div>' : ''}
                </div>
                <div class="card-title">${claim.title}</div>
                <div class="claim-info">
                    <span class="info-label">PRECIO</span>
                    <span class="info-value">$${claim.price || '0.00'}</span>
                </div>
                <div style="display:flex; justify-content: space-between; margin-top: auto; padding-top: 10px;">
                    <button class="btn btn-sm btn-secondary btn-edit-claim" data-id="${claim.id}"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger btn-delete-claim" data-id="${claim.id}"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `);
        $container.append($card);
    });
}

function openClaimModal() {
    $('#claim-modal').addClass('active');
    resetClaimModal();
}

function closeClaimModal() {
    $('#claim-modal').removeClass('active');
}

function resetClaimModal() {
    $('#claim-modal').removeData('editing-id');
    $('#claim-title').val('');
    $('#claim-description').val('');
    $('#claim-price').val('');
    $('#claim-start-date').val('');
    $('#claim-end-date').val('');
    renderClaimPreviews([]);
    $('.modal-tab-btn[data-tab="tab-claim-info"]').click();
}

async function handleSaveClaim() {
    const urls = $('#preview-grid-claim').data('urls') || [];
    if (urls.length === 0) return Swal.fire('Atención', 'Debes cargar al menos una imagen.', 'warning');

    const title = $('#claim-title').val().trim();
    if (!title) return Swal.fire('Atención', 'Ingresa un título.', 'warning');

    const price = $('#claim-price').val().trim();
    const start = document.querySelector("#claim-start-date")._flatpickr.selectedDates[0];
    const end = document.querySelector("#claim-end-date")._flatpickr.selectedDates[0];

    const claimData = {
        title: title,
        description: $('#claim-description').val(),
        price: price,
        image_urls: urls,
        start_date: start ? start.toISOString() : null,
        end_date: end ? end.toISOString() : null,
        user_id: claimUser.id
    };

    const editingId = $('#claim-modal').data('editing-id');

    Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    let result;
    if (editingId) {
        result = await _supabase.from('claims').update(claimData).eq('id', editingId);
    } else {
        result = await _supabase.from('claims').insert([claimData]);
    }

    if (result.error) {
        Swal.fire('Error', result.error.message, 'error');
    } else {
        Swal.fire('¡Éxito!', 'Claim guardado correctamente.', 'success');
        closeClaimModal();
        loadClaims();
    }
}

async function editClaim(id) {
    const { data: claim, error } = await _supabase.from('claims').select('*').eq('id', id).single();
    if (error) return;

    resetClaimModal();
    $('#claim-modal').data('editing-id', id);
    $('#claim-modal-title').text('EDITAR CLAIM');

    $('#claim-title').val(claim.title);
    $('#claim-description').val(claim.description);
    $('#claim-price').val(claim.price);

    if (claim.start_date) document.querySelector("#claim-start-date")._flatpickr.setDate(new Date(claim.start_date));
    if (claim.end_date) document.querySelector("#claim-end-date")._flatpickr.setDate(new Date(claim.end_date));

    renderClaimPreviews(claim.image_urls || []);
    $('#claim-modal').addClass('active');
}

async function deleteClaim(id) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Eliminar Claim?',
        text: 'Esta acción no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4757'
    });

    if (isConfirmed) {
        const { error } = await _supabase.from('claims').delete().eq('id', id);
        if (!error) loadClaims();
    }
}
