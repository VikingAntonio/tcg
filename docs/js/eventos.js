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
    $dropZone.click(() => $('#input-file').click());

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
            const url = await CloudinaryUpload.uploadImage(file);
            $('#input-image-url').val(url);
        }
    });

    $('#input-file').change(async function() {
        if (this.files[0]) {
            const url = await CloudinaryUpload.uploadImage(this.files[0]);
            $('#input-image-url').val(url);
        }
    });
});

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

        $container.append(`
            <div class="album-card ${e.is_featured ? 'featured-event' : ''}">
                ${featuredBadge}
                <div class="product-image-container" style="height: 150px; background: rgba(0,0,0,0.2);">
                    <img src="${e.image_url || 'https://via.placeholder.com/300x150?text=Vikingdev'}" class="sealed-product-img">
                </div>
                <h3>${e.name}</h3>
                <div style="font-size: 12px; color: var(--text-muted);"><i class="fas fa-calendar"></i> ${dateStr}</div>
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
    const data = {
        user_id: currentUser.id,
        name: $('#input-name').val(),
        event_date: $('#input-date').val(),
        image_url: $('#input-image-url').val(),
        description: $('#input-desc').val(),
        is_featured: $('#input-featured').is(':checked'),
        promo_details: $('#input-promo').val()
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
    $('#input-date').val(e.event_date ? e.event_date.slice(0, 16) : '');
    $('#input-image-url').val(e.image_url);
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
    $('#input-image-url').val('');
}
