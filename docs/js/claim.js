let claimUser = null;

$(document).ready(async function() {
    await checkClaimSession();

    // UI Interactions
    $(document).on('click', '#avatar-btn', function(e) {
        e.stopPropagation();
        $('#user-dropdown').toggleClass('active');
    });

    $(document).on('click', function(e) {
        if (!$(e.target).closest('.user-menu-container').length) {
            $('#user-dropdown').removeClass('active');
        }
    });

    $('#menu-btn-logout').on('click', async function() {
        await _supabase.auth.signOut();
        window.location.href = 'index.html';
    });

    $('.theme-btn-small').on('click', function() {
        const theme = $(this).data('theme');
        $('body').removeClass('theme-light theme-purple theme-dark').addClass(theme);
        localStorage.setItem('tcg_theme', theme);
        $('.theme-btn-small').removeClass('active');
        $(this).addClass('active');
    });

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

            // UI Update
            if (user.store_logo) $('#dropdown-user-logo').attr('src', user.store_logo).show();
            $('#dropdown-user-name').text(user.store_name || user.username);
            $('#dropdown-user-role').text(user.role || 'Vendedor').show();

            const savedTheme = localStorage.getItem('tcg_theme') || 'theme-dark';
            $('body').addClass(savedTheme);
            $(`.theme-btn-small[data-theme="${savedTheme}"]`).addClass('active');

            // Load current spirit
            if (user.selected_spirit_id) {
                const { data: spiritData } = await _supabase
                    .from('spirits')
                    .select('*')
                    .eq('id', user.selected_spirit_id)
                    .single();
                if (spiritData) {
                    window.currentSpirit = spiritData;
                }
            }

            // Fetch additional data for CompanionBot
            const { data: botMessages } = await _supabase.from('bot_messages').select('*').eq('user_id', user.id).eq('is_active', true);
            window.currentStoreDataForBot = { user: user, customMessages: botMessages };

            initFloatingCompanion();
            loadClaims();
        } else {
            window.location.href = 'admin.html';
        }
    } else {
        window.location.href = 'admin.html';
    }
}

async function initFloatingCompanion() {
    if (!window.currentSpirit) {
        try {
            const { data: publicSpirits } = await _supabase.from('spirits').select('*').eq('is_public', true).limit(1);
            if (publicSpirits && publicSpirits.length > 0) window.currentSpirit = publicSpirits[0];
        } catch (e) {}
    }
    if (!window.currentSpirit) return;

    const $container = $('#floating-companion-container');
    if (!$container.length) return;

    if (typeof makeCompanionDraggable === 'function') setTimeout(makeCompanionDraggable, 1000);
    $container.html(`
        <model-viewer
            src="${window.currentSpirit.gltf_url}"
            auto-rotate camera-controls rotation="0deg 0deg 0deg" shadow-intensity="1" environment-image="neutral" exposure="1" interaction-prompt="none" oncontextmenu="return false;">
        </model-viewer>
    `);

    $container.on('click', function(e) {
        if (window.isCompanionDragging) return;
        e.stopPropagation();
        $('#companion-menu').toggleClass('active');
    });

    $('#menu-item-chat').on('click', function(e) {
        e.stopPropagation();
        $('#chatbot-container').addClass('active');
        $('#companion-menu').removeClass('active');
    });

    $('#menu-item-details').on('click', function(e) {
        e.stopPropagation();
        Swal.fire({ title: window.currentSpirit.name, text: 'Tu fiel compañero de aventuras.', imageUrl: window.currentSpirit.poster_url, imageWidth: 200 });
        $('#companion-menu').removeClass('active');
    });

    if (typeof CompanionBot === 'function') {
        const bot = new CompanionBot({
            supabase: _supabase,
            userId: claimUser.id,
            userType: 'admin',
            customMessages: window.currentStoreDataForBot ? window.currentStoreDataForBot.customMessages : []
        });
        bot.init();
        window.botInstance = bot;
    }
}

async function handleClaimUpload(fileList) {
    try {
        Swal.fire({ title: 'Subiendo...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        let entries = $('#preview-grid-claim').data('entries') || [];
        for (const file of fileList) {
            const url = await CloudinaryUpload.uploadImage(file);
            entries.push({ url: url, price: '', description: '' });
        }
        renderClaimEntries(entries);
        Swal.close();
    } catch (err) { Swal.fire('Error', 'No se pudo subir la imagen.', 'error'); }
}

function renderClaimEntries(entries) {
    const $grid = $('#preview-grid-claim');
    $grid.empty().data('entries', entries);
    if (entries && entries.length > 0) {
        entries.forEach((entry, index) => {
            const $row = $(`
                <div class="claim-entry-row" data-index="${index}">
                    <div class="remove-claim-entry" onclick="removeClaimEntry(${index})"><i class="fas fa-times"></i></div>
                    <div class="claim-entry-image"><img src="${entry.url}"></div>
                    <div class="claim-entry-inputs">
                        <div style="display:flex; gap:10px; align-items:center;">
                            <label style="font-size: 0.7rem; color: #ffffff !important; white-space: nowrap; font-weight: 800;">PRECIO ($):</label>
                            <input type="text" class="entry-price" placeholder="Ej: 25.00" value="${entry.price || ''}" style="flex:1; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff;">
                        </div>
                        <label style="font-size: 0.7rem; color: #ffffff !important; margin-top: 5px; display:block; font-weight: 800;">REGLAS / DESCRIPCIÓN:</label>
                        <textarea class="entry-desc" placeholder="Detalles específicos..." rows="2" style="width:100%; resize: none; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff;">${entry.description || ''}</textarea>
                    </div>
                </div>
            `);
            $row.find('input, textarea').on('input', function() {
                const idx = $(this).closest('.claim-entry-row').data('index');
                const val = $(this).val();
                if ($(this).hasClass('entry-price')) entries[idx].price = val;
                if ($(this).hasClass('entry-desc')) entries[idx].description = val;
            });
            $grid.append($row);
        });
    }
}

window.removeClaimEntry = (index) => {
    let entries = $('#preview-grid-claim').data('entries') || [];
    entries.splice(index, 1);
    renderClaimEntries(entries);
};

async function loadClaims() {
    if (!claimUser) return;
    const { data: claims, error } = await _supabase.from('claims').select('*').eq('user_id', claimUser.id).order('created_at', { ascending: false });
    if (error) return;
    const $container = $('#claim-list');
    $container.empty();
    const filtered = claims.filter(c => c.status === 'Activa');
    if (filtered.length === 0) {
        $container.html('<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 40px;">No hay claims activos para gestionar.</div>');
        return;
    }
    filtered.forEach(claim => {
        const firstImg = claim.image_urls && claim.image_urls.length > 0 ? claim.image_urls[0] : 'https://via.placeholder.com/300x200?text=Sin+Imagen';
        const $card = $(`
            <div class="pretty-claim-card">
                <div class="status-badge">${claim.status}</div>
                <div class="card-img-container"><img src="${firstImg}" alt="${claim.title}"></div>
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

function openClaimModal() { $('#claim-modal').addClass('active'); resetClaimModal(); }
function closeClaimModal() { $('#claim-modal').removeClass('active'); }
function resetClaimModal() {
    $('#claim-modal').removeData('editing-id');
    $('#claim-modal-title').text('LANZAR CLAIMS');
    $('#claim-start-date').val(''); $('#claim-end-date').val('');
    renderClaimEntries([]);
    $('.modal-tab-btn[data-tab="tab-claim-info"]').click();
}

async function handleSaveClaim() {
    const entries = $('#preview-grid-claim').data('entries') || [];
    if (entries.length === 0) return Swal.fire('Atención', 'Debes cargar al menos una imagen.', 'warning');

    const startVal = document.querySelector("#claim-start-date").value;
    const endVal = document.querySelector("#claim-end-date").value;
    const start = startVal ? new Date(startVal) : null;
    const end = endVal ? new Date(endVal) : null;
    const editingId = $('#claim-modal').data('editing-id');
    Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        if (editingId) {
            const entry = entries[0];
            const { error } = await _supabase.from('claims').update({
                description: entry.description || null,
                price: entry.price || '0',
                image_urls: [entry.url],
                start_date: start ? start.toISOString() : null,
                end_date: end ? end.toISOString() : null
            }).eq('id', editingId);
            if (error) throw error;
        } else {
            const claimsToInsert = entries.map(entry => ({
                title: 'Producto Claim',
                description: entry.description || null,
                price: entry.price || '0',
                image_urls: [entry.url],
                start_date: start ? start.toISOString() : null,
                end_date: end ? end.toISOString() : null,
                user_id: claimUser.id,
                status: 'Activa'
            }));
            const { error } = await _supabase.from('claims').insert(claimsToInsert);
            if (error) throw error;
        }
        Swal.fire('¡Éxito!', 'Claims guardados correctamente.', 'success');
        closeClaimModal(); loadClaims();
    } catch (err) { Swal.fire('Error', err.message, 'error'); }
}

async function editClaim(id) {
    const { data: claim, error } = await _supabase.from('claims').select('*').eq('id', id).single();
    if (error) return;
    resetClaimModal(); $('#claim-modal').data('editing-id', id).addClass('active');
    $('#claim-modal-title').text('EDITAR CLAIM');

    if (claim.start_date) {
        const d = new Date(claim.start_date);
        const offset = d.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(d - offset)).toISOString().slice(0, 16);
        document.querySelector("#claim-start-date").value = localISOTime;
    }
    if (claim.end_date) {
        const d = new Date(claim.end_date);
        const offset = d.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(d - offset)).toISOString().slice(0, 16);
        document.querySelector("#claim-end-date").value = localISOTime;
    }

    renderClaimEntries([{ url: claim.image_urls[0], price: claim.price, description: claim.description }]);
}

async function deleteClaim(id) {
    const { isConfirmed } = await Swal.fire({ title: '¿Eliminar?', text: 'Esta acción no se puede deshacer.', icon: 'warning', showCancelButton: true });
    if (isConfirmed && !(await _supabase.from('claims').delete().eq('id', id)).error) loadClaims();
}
