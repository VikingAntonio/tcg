let currentUser = null;

$(document).ready(async function() {
    await checkSession();

    $('#btn-new-event').click(() => {
        resetModal();
        $('#event-modal').addClass('active');
    });

    $('#btn-save-event').click(saveEvent);

    $(document).on('click', '.btn-edit-event', function() {
        editEvent($(this).data('id'));
    });

    $(document).on('click', '.btn-delete-event', function() {
        deleteEvent($(this).data('id'));
    });

    const $dropZone = $('#drop-zone');
    // Jules: Click handled by label/for logic in HTML

    $dropZone.on('dragover', function(e) {
        e.preventDefault();
        $(this).addClass('dragover');
    });

    $dropZone.on('dragleave drop', function(e) {
        e.preventDefault();
        $(this).removeClass('dragover');
    });

    $dropZone.on('drop', async function(e) {
        const file = e.originalEvent.dataTransfer.files[0];
        if (file) {
            handleFileUpload(file);
        }
    });

    $('#input-file').on('change', async function() {
        if (this.files[0]) {
            handleFileUpload(this.files[0]);
        }
    });
});

async function handleFileUpload(file) {
    try {
        Swal.fire({ title: 'Subiendo...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
        const url = await CloudinaryUpload.uploadImage(file);
        $('#input-image-url').val(url);
        $('#img-preview').attr('src', url).show();
        $('#drop-text').hide();
        Swal.close();
    } catch (e) {
        console.error(e);
        Swal.fire('Error', 'No se pudo subir la imagen', 'error');
    }
}

async function checkSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        const { data: user } = await _supabase.from('usuarios').select('*').eq('id', session.user.id).single();
        if (user) {
            currentUser = user;
            $('#authenticated-content').show();
            loadEvents();
        } else window.location.href = 'admin.html';
    } else window.location.href = 'admin.html';
}

async function loadEvents() {
    const { data: items } = await _supabase.from('events').select('*').eq('user_id', currentUser.id).order('event_date', { ascending: true });
    const $container = $('#event-container');
    $container.empty();

    if (!items || items.length === 0) {
        $container.html('<div class="empty">No hay eventos creados.</div>');
        return;
    }

    items.forEach(e => {
        const dateStr = e.event_date ? new Date(e.event_date).toLocaleString() : 'Sin fecha';
        const featuredBadge = e.is_featured ? '<div class="featured-badge">Destacado</div>' : '';
        const typeLabel = e.type ? e.type.charAt(0).toUpperCase() + e.type.slice(1) : 'General';

        $container.append(`
            <div class="album-card ${e.is_featured ? 'featured-event' : ''} event-type-${e.type || 'informativo'}">
                ${featuredBadge}
                <div class="event-type-badge">${typeLabel}</div>
                ${e.image_url ? `
                <div class="product-image-container" style="height: 150px; background: rgba(0,0,0,0.2);">
                    <img src="${e.image_url}" class="sealed-product-img">
                </div>
                ` : '<div style="height: 20px;"></div>'}
                <h3 style="margin-top: 10px;">${e.name}</h3>
                <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 10px;"><i class="fas fa-calendar"></i> ${dateStr}</div>
                <div class="event-desc-preview" style="font-size: 0.85rem; color: #aaa; margin-bottom: 15px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                    ${e.description || 'Sin descripción'}
                </div>
                <div style="display:flex; gap:10px; margin-top:auto; width: 100%;">
                    <button class="btn btn-sm btn-edit-event" data-id="${e.id}" style="flex: 1;">Editar</button>
                    <button class="btn btn-sm btn-danger btn-delete-event" data-id="${e.id}" style="flex: 1;">Borrar</button>
                </div>
            </div>
        `);
    });
}

async function saveEvent() {
    const id = $('#edit-id').val();
    const eventDate = $('#input-date').val();
    const name = $('#input-name').val().trim();
    const imageUrl = $('#input-image-url').val();

    if (!name && !imageUrl) {
        Swal.fire('Atención', 'Debes poner al menos un nombre o una imagen.', 'warning');
        return;
    }

    const data = {
        user_id: currentUser.id,
        name: name || 'Evento sin nombre',
        type: $('#input-type').val() || 'informativo',
        event_date: eventDate || null,
        image_url: imageUrl || null,
        description: $('#input-desc').val() || null,
        is_featured: $('#input-featured').is(':checked'),
        promo_details: $('#input-promo').val() || null
    };

    if (id) await _supabase.from('events').update(data).eq('id', id);
    else await _supabase.from('events').insert([data]);
    $('#event-modal').removeClass('active');
    loadEvents();
}

async function editEvent(id) {
    const { data: e } = await _supabase.from('events').select('*').eq('id', id).single();
    $('#edit-id').val(e.id);
    $('#input-name').val(e.name);
    $('#input-type').val(e.type || 'informativo');
    $('#input-date').val(e.event_date ? e.event_date.slice(0, 16) : '');
    $('#input-image-url').val(e.image_url);
    if (e.image_url) {
        $('#img-preview').attr('src', e.image_url).show();
        $('#drop-text').hide();
    } else {
        $('#img-preview').hide();
        $('#drop-text').show();
    }
    $('#input-desc').val(e.description);
    $('#input-featured').prop('checked', e.is_featured);
    $('#input-promo').val(e.promo_details);
    $('#event-modal').addClass('active');
}

async function deleteEvent(id) {
    if ((await Swal.fire({ title: '¿Borrar evento?', icon: 'warning', showCancelButton: true })).isConfirmed) {
        await _supabase.from('events').delete().eq('id', id);
        loadEvents();
    }
}

function resetModal() {
    $('#edit-id').val('');
    $('#input-name').val('');
    $('#input-type').val('informativo');
    $('#input-image-url').val('');
    $('#img-preview').hide().attr('src', '');
    $('#drop-text').show();
    $('#input-date').val('');
    $('#input-desc').val('');
    $('#input-promo').val('');
    $('#input-featured').prop('checked', false);
}
