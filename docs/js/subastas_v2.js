let currentUser = null;

$(document).ready(async function() {
    await checkSession();

    // --- Tab Navigation ---
    $('.tab-btn').click(function() {
        $('.tab-btn').removeClass('active');
        $(this).addClass('active');
        const tab = $(this).data('tab');
        $('.tab-content').hide();
        $(`#view-${tab}`).show();
    });

    // --- Navigation & UI ---
    $('#btn-open-add-modal').click(function() {
        resetModal();
        $('#auction-modal').addClass('active');
    });

    $('#btn-new-live-auction').click(function() {
        resetLiveModal();
        $('#live-auction-modal').addClass('active');
    });

    $('#close-modal').click(function() {
        $('#auction-modal').removeClass('active');
    });

    $('#close-live-modal').click(function() {
        $('#live-auction-modal').removeClass('active');
    });

    $(document).on('click', '#avatar-btn', function(e) {
        e.stopPropagation();
        $('#user-dropdown').toggleClass('active');
    });

    $('#menu-btn-logout').click(function(e) {
        e.preventDefault();
        handleLogout();
    });

    // --- Save Logic ---
    $('#btn-save').click(function() {
        saveAuction();
    });

    $('#btn-save-live').click(function() {
        saveLiveAuction();
    });

    $(document).on('click', '.btn-edit', function() {
        const data = $(this).data('item');
        editAuction(data);
    });

    $(document).on('click', '.btn-edit-live', function() {
        const data = $(this).data('item');
        editLiveAuction(data);
    });

    $(document).on('click', '.btn-delete', function() {
        const id = $(this).data('id');
        deleteAuction(id);
    });

    $(document).on('click', '.btn-delete-live', function() {
        const id = $(this).data('id');
        deleteLiveAuction(id);
    });

    $(document).on('click', '.btn-pdf', function() {
        const data = $(this).data('item');
        generatePDF(data);
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
            .select('id, username, store_name, store_logo, role, max_auctions_count')
            .eq('id', session.user.id)
            .single();

        if (user) {
            currentUser = user;
            $('#dropdown-user-name').text(user.username);
            $('#top-panel, #authenticated-content').show();

            // Set store data in template
            $('#tpl-store-name').text(user.store_name || user.username);
            $('.tpl-store-name-inline').text(user.store_name || user.username);

            // Starter users only see their name, no logo
            if (user.store_logo && user.role !== 'starter') {
                $('#tpl-logo').attr('src', user.store_logo).show();
            } else {
                $('#tpl-logo').hide();
            }

            loadAuctions();
            loadLiveAuctions();
        } else {
            window.location.href = 'admin.html';
        }
    } else {
        window.location.href = 'admin.html';
    }
}

async function handleLogout() {
    await _supabase.auth.signOut();
    window.location.href = 'admin.html';
}

async function handleAuctionImageUpload(file) {
    const $fileName = $('#drop-zone-auction .file-name');
    $fileName.text("Subiendo...").css('color', '#aaa');
    try {
        const url = await CloudinaryUpload.uploadImage(file);
        $('#live-input-image').val(url);
        $fileName.text("¡Imagen lista!").css('color', '#00ff88');
        Swal.fire({ icon: 'success', title: 'Imagen subida', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
    } catch (err) {
        $fileName.text("Error al subir").css('color', '#ff4757');
        Swal.fire('Error', 'No se pudo subir la imagen: ' + err.message, 'error');
    }
}

async function loadAuctions() {
    $('#auction-list').html('<tr><td colspan="6" class="loading">Cargando datos...</td></tr>');

    const { data: items, error } = await _supabase
        .from('subastas')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('is_live', false) // Legacy/Finished auctions are not live
        .order('created_at', { ascending: false });

    if (error) {
        $('#auction-list').html('<tr><td colspan="6" class="error">Error al cargar datos.</td></tr>');
        return;
    }

    if (!items || items.length === 0) {
        $('#auction-list').html('<tr><td colspan="6" class="empty">No tienes subastas registradas.</td></tr>');
        return;
    }

    const $container = $('#auction-list');
    $container.empty();

    items.forEach(item => {
        const $row = $(`
            <tr>
                <td><strong>${item.nombre}</strong></td>
                <td style="font-size: 13px; color: #aaa;">${item.detalles ? (item.detalles.length > 50 ? item.detalles.substring(0, 50) + '...' : item.detalles) : '-'}</td>
                <td style="color: #6c5ce7; font-weight: bold;">${item.precio_total}</td>
                <td>${item.dia_entrega || '-'}</td>
                <td><span class="status-badge">${item.status}</span></td>
                <td>
                    <div style="display:flex; gap:10px;">
                        <button class="btn btn-pdf btn-sm" title="Generar PDF"><i class="fas fa-file-pdf"></i></button>
                        <button class="btn btn-secondary btn-sm btn-edit" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-danger btn-sm btn-delete" data-id="${item.id}" title="Eliminar"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `);

        $row.find('.btn-edit, .btn-pdf').data('item', item);
        $container.append($row);
    });
}

async function loadLiveAuctions() {
    $('#live-auction-list').html('<div class="loading">Cargando subastas...</div>');

    const { data: items, error } = await _supabase
        .from('subastas')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('is_live', true)
        .order('created_at', { ascending: false });

    if (error) {
        $('#live-auction-list').html('<div class="error">Error al cargar subastas.</div>');
        return;
    }

    if (!items || items.length === 0) {
        $('#live-auction-list').html('<div class="empty">No tienes subastas en vivo activas.</div>');
        return;
    }

    const $container = $('#live-auction-list');
    $container.empty();

    items.forEach(item => {
        const $card = $(`
            <div class="admin-auction-card">
                <img src="${item.image_url || 'https://via.placeholder.com/300x150?text=Sin+Imagen'}" alt="${item.nombre}">
                <h3 style="margin: 5px 0; font-size: 1rem;">${item.nombre}</h3>
                <div style="font-size: 0.85rem; color: #aaa;">
                    <i class="fas fa-clock"></i> ${new Date(item.end_date).toLocaleString()}
                </div>
                <div style="font-weight: 800; color: var(--primary-color);">Puja: $${item.starting_bid}</div>
                <div style="display: flex; gap: 10px; margin-top: auto;">
                    <button class="btn btn-sm btn-edit-live" style="flex: 1;">Editar</button>
                    <button class="btn btn-danger btn-sm btn-delete-live" data-id="${item.id}" style="flex: 1;">Borrar</button>
                </div>
            </div>
        `);

        $card.find('.btn-edit-live').data('item', item);
        $container.append($card);
    });
}

async function saveAuction() {
    const id = $('#edit-id').val();
    const nombre = $('#input-nombre').val().trim();
    const detalles = $('#input-detalles').val().trim();
    const total = $('#input-total').val().trim();
    const entrega = $('#input-entrega').val().trim();
    const status = $('#input-status').val();

    if (!nombre || !total) {
        Swal.fire('Atención', 'El nombre y el precio final son obligatorios', 'warning');
        return;
    }

    const data = {
        user_id: currentUser.id,
        nombre,
        detalles,
        precio_total: total,
        dia_entrega: entrega,
        status,
        is_live: false
    };

    let error;
    if (id) {
        const result = await _supabase.from('subastas').update(data).eq('id', id);
        error = result.error;
    } else {
        const result = await _supabase.from('subastas').insert([data]);
        error = result.error;
    }

    if (error) {
        Swal.fire('Error', 'No se pudo guardar el registro: ' + error.message, 'error');
    } else {
        Swal.fire('Guardado', 'Registro actualizado correctamente', 'success');
        $('#auction-modal').removeClass('active');
        loadAuctions();
    }
}

async function saveLiveAuction() {
    const id = $('#live-edit-id').val();

    // Plan-based Limits check
    if (!id) {
        const { count, error: countError } = await _supabase
            .from('subastas')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .eq('is_live', true);

        if (!countError) {
            let limit = 0;
            if (currentUser.role === 'starter' || currentUser.role === 'user') limit = 10;
            else if (currentUser.role === 'premium') limit = 20;
            else limit = 9999;

            if (count >= limit) {
                Swal.fire({
                    title: 'Límite alcanzado',
                    text: `Tu plan actual permite un máximo de ${limit} subastas en vivo activas.`,
                    icon: 'warning',
                    footer: '<a href="admin.html">Sube a Premium para aumentar tu límite</a>'
                });
                return;
            }
        }
    }

    const nombre = $('#live-input-nombre').val().trim();
    const imageUrl = $('#live-input-image').val();
    const startBid = parseFloat($('#live-input-start-bid').val()) || 1;
    const incType = $('#live-input-inc-type').val();
    const startDate = $('#live-input-start-date').val();
    const endDate = $('#live-input-end-date').val();
    const description = $('#live-input-description').val().trim();
    const isActive = $('#live-input-active').is(':checked');

    if (!nombre || !startDate || !endDate) {
        Swal.fire('Atención', 'Nombre, fecha de inicio y cierre son obligatorios.', 'warning');
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
        status: isActive ? 'Activa' : 'Inactiva'
    };

    let error;
    if (id) {
        const result = await _supabase.from('subastas').update(data).eq('id', id);
        error = result.error;
    } else {
        const result = await _supabase.from('subastas').insert([data]);
        error = result.error;
    }

    if (error) {
        Swal.fire('Error', 'No se pudo guardar la subasta: ' + error.message, 'error');
    } else {
        Swal.fire('¡Éxito!', 'Subasta guardada correctamente.', 'success');
        $('#live-auction-modal').removeClass('active');
        loadLiveAuctions();
    }
}

function editAuction(item) {
    resetModal();
    $('#modal-title').text('Editar Registro');
    $('#edit-id').val(item.id);
    $('#input-nombre').val(item.nombre);
    $('#input-detalles').val(item.detalles);
    $('#input-total').val(item.precio_total);
    $('#input-entrega').val(item.dia_entrega);
    $('#input-status').val(item.status);

    $('#auction-modal').addClass('active');
}

function editLiveAuction(item) {
    resetLiveModal();
    $('#live-modal-title').text('Editar Subasta en Vivo');
    $('#live-edit-id').val(item.id);
    $('#live-input-nombre').val(item.nombre);
    $('#live-input-image').val(item.image_url);
    if (item.image_url) {
        $('#drop-zone-auction .file-name').text('Imagen cargada').css('color', '#00ff88');
    }
    $('#live-input-start-bid').val(item.starting_bid);

    if (item.increment_type === 'free') {
        $('#live-input-inc-type').val('free');
    } else {
        $('#live-input-inc-type').val(`fixed_${item.min_increment}`);
    }

    // Format dates for datetime-local input (YYYY-MM-DDThh:mm)
    if (item.start_date) $('#live-input-start-date').val(new Date(item.start_date).toISOString().slice(0, 16));
    if (item.end_date) $('#live-input-end-date').val(new Date(item.end_date).toISOString().slice(0, 16));

    $('#live-input-description').val(item.description);
    $('#live-input-active').prop('checked', item.status === 'Activa');

    $('#live-auction-modal').addClass('active');
}

async function deleteAuction(id) {
    const result = await Swal.fire({
        title: '¿Eliminar registro?',
        text: "Esta acción no se puede deshacer",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4757',
        confirmButtonText: 'Sí, eliminar'
    });

    if (result.isConfirmed) {
        const { error } = await _supabase.from('subastas').delete().eq('id', id);
        if (error) {
            Swal.fire('Error', 'No se pudo eliminar el registro', 'error');
        } else {
            loadAuctions();
        }
    }
}

async function deleteLiveAuction(id) {
    const result = await Swal.fire({
        title: '¿Eliminar subasta?',
        text: "Se eliminará la subasta y todo el historial de pujas asociado.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4757',
        confirmButtonText: 'Sí, eliminar'
    });

    if (result.isConfirmed) {
        const { error } = await _supabase.from('subastas').delete().eq('id', id);
        if (error) {
            Swal.fire('Error', 'No se pudo eliminar la subasta', 'error');
        } else {
            loadLiveAuctions();
        }
    }
}

function resetModal() {
    $('#modal-title').text('Registrar Ganador');
    $('#edit-id').val('');
    $('#input-nombre').val('');
    $('#input-detalles').val('');
    $('#input-total').val('');
    $('#input-entrega').val('');
    $('#input-status').val('Pendiente');
}

function resetLiveModal() {
    $('#live-modal-title').text('Nueva Subasta en Vivo');
    $('#live-edit-id').val('');
    $('#live-input-nombre').val('');
    $('#live-input-image').val('');
    $('#drop-zone-auction .file-name').text('');
    $('#live-input-start-bid').val(1);
    $('#live-input-inc-type').val('free');
    $('#live-input-start-date').val('');
    $('#live-input-end-date').val('');
    $('#live-input-description').val('');
    $('#live-input-active').prop('checked', true);
}

async function generatePDF(item) {
    Swal.fire({
        title: 'Generando PDF...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    // Populate Template
    $('#tpl-nombre').text(item.nombre);
    $('#tpl-fecha').text(new Date(item.created_at).toLocaleDateString());
    $('#tpl-detalles').text(item.detalles || 'Sin detalles');
    $('#tpl-total').text(item.precio_total);
    $('#tpl-entrega').text(item.dia_entrega || 'Por definir');

    const template = document.getElementById('pdf-template');

    try {
        const canvas = await html2canvas(template, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');

        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Subasta_${item.nombre.replace(/\s+/g, '_')}.pdf`);

        Swal.fire('¡Éxito!', 'PDF generado correctamente', 'success');
    } catch (err) {
        console.error(err);
        Swal.fire('Error', 'No se pudo generar el PDF', 'error');
    }
}
