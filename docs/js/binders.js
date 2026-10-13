let currentAlbumId = null;
let currentPageId = null;
let currentSlotIndex = null;
let currentUser = null;
let localAlbumSlots = [];
let albumSlotsToDelete = [];
let localVikingData = [];
let editingType = 'slot';
let currentSlotExtraImages = [];

function getActiveScrollContainer() {
    const activeView = $('.admin-section.active')[0];
    if (activeView) return activeView;
    return window;
}

function captureScroll() {
    const container = getActiveScrollContainer();
    return container === window ? window.scrollY : container.scrollTop;
}

function restoreScroll(pos) {
    const container = getActiveScrollContainer();
    if (container === window) {
        window.scrollTo(0, pos);
    } else {
        container.scrollTop = pos;
    }
}

window.shareQR = null;

window.openShareModal = function(title, type, id, extraId) {
    const baseUrl = window.location.origin + '/public.html';
    const identifier = currentUser.is_store && currentUser.store_name ? currentUser.store_name : currentUser.username;

    let shareUrl = `${baseUrl}?id=${encodeURIComponent(identifier)}&view=${type}`;
    if (id !== null && id !== undefined) {
        const paramName = type === 'binders' || type === 'albums' ? 'binderId' : 'deckId';
        shareUrl += `&${paramName}=${id}`;
    }

    $('#share-modal-title').text(`Compartir ${title}`);
    $('#share-link-input').val(shareUrl);
    $('#share-overlay').addClass('active');

    if (window.botInstance) {
        const shareMsg = `¡Genial! Comparte este link con quien quieras para mostrarle "${title}". También puedes usar el código QR para que lo escaneen directamente.`;
        window.botInstance.say(shareMsg, { duration: 10 });
    }

    $('#share-qr-code').empty();
    window.shareQR = new QRCode(document.getElementById("share-qr-code"), {
        text: shareUrl,
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(`¡Mira esto en VikingTCG: ${title}!`);

    $('#share-wa').off('click').on('click', () => window.open(`https://wa.me/?text=${encodedText}%20${encodedUrl}`, '_blank'));
    $('#share-tg').off('click').on('click', () => window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, '_blank'));
    $('#share-fb').off('click').on('click', () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank'));
    $('#share-ms').off('click').on('click', () => window.open(`fb-messenger://share/?link=${encodedUrl}`, '_blank'));
};

function renderExtraImagesPreview() {
    const $preview = $('#slot-extra-images-preview').empty();
    if (!currentSlotExtraImages || currentSlotExtraImages.length === 0) return;

    currentSlotExtraImages.forEach((imgUrl, idx) => {
        const $thumb = $(`
            <div style="position: relative; width: 70px; height: 95px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.2); background: #000;">
                <img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                <button type="button" class="btn-delete-extra-img" data-index="${idx}" style="position: absolute; top: 3px; right: 3px; background: rgba(255,71,87,0.9); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `);
        $thumb.find('.btn-delete-extra-img').click(function(e) {
            e.stopPropagation();
            const removeIdx = $(this).data('index');
            currentSlotExtraImages.splice(removeIdx, 1);
            renderExtraImagesPreview();
        });
        $preview.append($thumb);
    });
}

async function handleFilesUpload(files) {
    if (!files || files.length === 0) return;
    Swal.fire({ title: 'Subiendo imágenes...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) continue;
            const uploadedUrl = await CloudinaryUpload.uploadImage(file);
            if (uploadedUrl) {
                currentSlotExtraImages.push(uploadedUrl);
            }
        }
        renderExtraImagesPreview();
        Swal.close();
    } catch (err) {
        Swal.fire('Error', 'No se pudieron subir las imágenes: ' + (err.message || ''), 'error');
    }
}

$(document).ready(async function() {
    await checkSession();
    initTheme();

    $("#btn-login").click(function(e) { e.preventDefault(); handleLogin(); });
    $(document).on("click", "#btn-back-to-web", function(e) { e.preventDefault(); window.location.href = "index.html"; });

    // Drag and Drop & File Upload handlers for Extra Images
    $(document).on('click', '#slot-dropzone', function() { $('#slot-file-input').click(); });
    $(document).on('change', '#slot-file-input', function() {
        handleFilesUpload(this.files);
        $(this).val('');
    });
    $(document).on('dragover dragenter', '#slot-dropzone', function(e) {
        e.preventDefault(); e.stopPropagation();
        $(this).css('border-color', '#00ff88');
    });
    $(document).on('dragleave drop', '#slot-dropzone', function(e) {
        e.preventDefault(); e.stopPropagation();
        $(this).css('border-color', 'rgba(0, 210, 255, 0.4)');
    });
    $(document).on('drop', '#slot-dropzone', function(e) {
        const files = e.originalEvent.dataTransfer ? e.originalEvent.dataTransfer.files : null;
        if (files && files.length > 0) {
            handleFilesUpload(files);
        }
    });

    $(document).on('click', '#btn-create-album', async function(e) {
        e.preventDefault();
        if (!currentUser) return;

        const { count } = await _supabase.from('binders').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id);
        if (count >= (currentUser.max_albums || 10)) {
            Swal.fire('Límite alcanzado', `Tu plan actual permite un máximo de ${currentUser.max_albums || 10} álbumes.`, 'warning');
            return;
        }

        const { data, error } = await _supabase.from('binders').insert([{ title: 'Nuevo Álbum', user_id: currentUser.id }]).select();
        if (error) Swal.fire('Error', 'No se pudo crear el álbum', 'error');
        else loadAlbums();
    });

    $(document).on('click', '#btn-save-album-meta', async function(e) {
        e.preventDefault();
        Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

        const title = $('#input-album-title').val();
        const cover = $('#input-album-cover').val();
        const back = $('#input-album-back').val();
        const is_public = $('#input-album-public').is(':checked');
        const grid_layout = $('#input-album-grid-layout').val() || '3x3';

        let updateData = { title, cover_image_url: cover, back_image_url: back, cover_color: '#1a1a1a', back_color: '#1a1a1a', is_public, grid_layout };

        try {
            let { error: albumErr } = await _supabase.from('binders').update(updateData).eq('id', currentAlbumId);
            if (albumErr) throw albumErr;

            // Clear all existing slots of these pages to prevent duplicate leftover slots from layout shifts
            const { data: albumPages } = await _supabase
                .from('binder_pages')
                .select('id')
                .eq('binder_id', currentAlbumId);
            const pageIds = albumPages ? albumPages.map(p => p.id) : [];
            if (pageIds.length > 0) {
                const { error: clearErr } = await _supabase
                    .from('binder_card_slots')
                    .delete()
                    .in('page_id', pageIds);
                if (clearErr) throw clearErr;
            }

            if (localAlbumSlots.length > 0) {
                const slotsToUpsert = localAlbumSlots.map(s => { const { id, obtained, ...rest } = s; return rest; });
                await _supabase.from('binder_card_slots').upsert(slotsToUpsert, { onConflict: 'page_id,slot_index' });
            }

            Swal.fire({ title: '¡Guardado!', icon: 'success', timer: 2000, showConfirmButton: false });
            localAlbumSlots = []; albumSlotsToDelete = [];
            loadAlbums();
            showView('dashboard');
        } catch (err) {
            Swal.fire('Error', 'No se pudieron guardar los cambios: ' + (err.message || ''), 'error');
        }
    });

    $(document).on('click', '#btn-add-page, #btn-add-page-bottom', async function(e) {
        e.preventDefault();
        const { count } = await _supabase.from('binder_pages').select('*', { count: 'exact', head: true }).eq('binder_id', currentAlbumId);
        if (count >= (currentUser.max_pages || 30)) {
            Swal.fire('Límite alcanzado', `Máximo ${currentUser.max_pages || 30} páginas.`, 'warning');
            return;
        }
        await _supabase.from('binder_pages').insert([{ binder_id: currentAlbumId, page_index: count }]);
        loadAlbumPages(currentAlbumId, false);
    });

    // Live update image thumbnail preview box
    $(document).on('input change', '#slot-image-url', function() {
        const url = $(this).val().trim();
        if (url) {
            $('#slot-preview-img').attr('src', url).show();
            $('#slot-preview-placeholder').hide();
        } else {
            $('#slot-preview-img').attr('src', '').hide();
            $('#slot-preview-placeholder').show();
        }
    });

    $(document).on('click', '#btn-save-slot', async function(e) {
        e.preventDefault();
        const imageUrl = $('#slot-image-url').val();
        if (!imageUrl) { Swal.fire('Error', 'URL de la imagen requerida', 'warning'); return; }

        const cardData = {
            image_url: imageUrl,
            name: $('#slot-name').val() || '',
            rarity: $('#slot-rarity').val() || '',
            expansion: $('#slot-expansion').val() || '',
            condition: $('#slot-condition').val() || 'M',
            price: $('#slot-price').val() || '',
            cost_price: $('#slot-cost-price').val() || '',
            extra_images: currentSlotExtraImages || [],
            obtained: true
        };

        const slotData = { ...cardData, page_id: currentPageId, slot_index: currentSlotIndex };
        const existingIdx = localAlbumSlots.findIndex(s => s.page_id === currentPageId && s.slot_index === currentSlotIndex);
        if (existingIdx !== -1) localAlbumSlots[existingIdx] = { ...localAlbumSlots[existingIdx], ...slotData };
        else localAlbumSlots.push(slotData);

        $('#slot-modal').removeClass('active');
        loadAlbumPages(currentAlbumId, false);
    });

    $(document).on('click', '.card-slot', function() {
        if ($(event.target).closest('.btn-delete-card-top, .switch-searching').length) return;
        currentPageId = $(this).closest('.admin-page-item').data('id');
        currentSlotIndex = $(this).data('index');
        loadSlotData(currentPageId, currentSlotIndex);
    });

    $(document).on('click', '#btn-back-to-albums', function(e) { e.preventDefault(); showView('dashboard'); loadAlbums(); });

    async function redistributeLocalSlots(newLayout) {
        const { data: pages, error } = await _supabase
            .from('binder_pages')
            .select('*')
            .eq('binder_id', currentAlbumId)
            .order('page_index', { ascending: true });

        if (error || !pages || pages.length === 0) return;

        const pageMap = {};
        pages.forEach(p => pageMap[p.id] = p.page_index);

        let activeSlots = localAlbumSlots.filter(s => pageMap[s.page_id] !== undefined && s.image_url);
        activeSlots.sort((a, b) => {
            const pageDiff = pageMap[a.page_id] - pageMap[b.page_id];
            if (pageDiff !== 0) return pageDiff;
            return a.slot_index - b.slot_index;
        });

        let numSlots = 9;
        if (newLayout === '4x3') numSlots = 12;
        else if (newLayout === '4x4') numSlots = 16;
        else if (newLayout === '2x2') numSlots = 4;
        else if (newLayout === '1x1') numSlots = 1;

        const redistributed = [];
        let currentSlotCount = 0;

        for (const slot of activeSlots) {
            const pageIdx = Math.floor(currentSlotCount / numSlots);
            const slotIdx = currentSlotCount % numSlots;

            if (pageIdx < pages.length) {
                const targetPage = pages[pageIdx];
                const { id, page_id, slot_index, ...rest } = slot;
                redistributed.push({
                    ...rest,
                    page_id: targetPage.id,
                    slot_index: slotIdx
                });
                currentSlotCount++;
            }
        }

        localAlbumSlots = redistributed;
    }

    $(document).on('change', '#input-album-grid-layout', async function() {
        const newLayout = $(this).val();
        window.currentAlbumGridLayout = newLayout;

        Swal.fire({
            title: 'Acomodando cartas...',
            text: 'Reorganizando las cartas para el nuevo tamaño',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        await redistributeLocalSlots(newLayout);

        Swal.close();
        loadAlbumPages(currentAlbumId, false);
    });

    // Live typing external card search with debounce
    let externalSearchTimeout = null;
    $(document).on('input', '#external-search-input', function() {
        clearTimeout(externalSearchTimeout);
        const query = $(this).val().trim();
        if (query.length < 2) {
            $('#external-search-results').empty();
            return;
        }
        externalSearchTimeout = setTimeout(() => {
            window.searchExternalCard('#external-search-input', '#external-search-results', (card) => {
                $('#slot-image-url').val(card.high_res || card.image).trigger('change');
                $('#slot-name').val(card.name);
                $('#slot-rarity').val(card.rarity || '');
                $('#slot-expansion').val(card.set || '');
                $('#slot-price').val(card.price || '');
            });
        }, 350);
    });

    $(document).on('click', '#btn-external-search', async function() {
        window.searchExternalCard('#external-search-input', '#external-search-results', (card) => {
            $('#slot-image-url').val(card.high_res || card.image).trigger('change');
            $('#slot-name').val(card.name);
            $('#slot-rarity').val(card.rarity || '');
            $('#slot-expansion').val(card.set || '');
            $('#slot-price').val(card.price || '');
        });
    });

    $(document).on('click', '.slot-tab-btn', function() {
        const tabId = $(this).data('tab');
        $('.slot-tab-btn').removeClass('active'); $(this).addClass('active');
        $('.slot-tab-content').removeClass('active').hide();
        $(`#${tabId}`).addClass('active').show();
    });

    $(document).on('click', '#close-slot-modal', function() { $('#slot-modal').removeClass('active'); });

    $(document).on('click', '#btn-organize-albums', function(e) { e.preventDefault(); openOrganizeModal('binders'); });
    $(document).on('click', '#btn-finish-organize', function() { $('#organize-modal').removeClass('active'); });

    $(document).on('click', '#avatar-btn', function(e) { e.stopPropagation(); $('#user-dropdown').toggleClass('active'); });
    $(document).on('click', function(e) { if (!$(e.target).closest('.user-menu-container').length) $('#user-dropdown').removeClass('active'); });

    $(document).on('click', '.theme-btn, .theme-btn-small', function() { applyTheme($(this).data('theme')); });
});

async function checkSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        const { data: user } = await _supabase.from('usuarios').select('*').eq('id', session.user.id).single();
        if (user) { currentUser = user; showAuthenticatedContent(); }
        else showLoginView();
    } else showLoginView();
}

async function handleLogin() {
    const user = $('#login-username').val().trim();
    const pass = $('#login-password').val().trim();
    const { error } = await _supabase.auth.signInWithPassword({ email: `${user}@vikingtcg.xyz`, password: pass });
    if (error) Swal.fire('Error', 'Credenciales incorrectas', 'error');
    else window.location.reload();
}

async function handleLogout() {
    await _supabase.auth.signOut();
    window.location.reload();
}

function initTheme() { applyTheme(localStorage.getItem('tcg_theme') || 'theme-dark'); }
function applyTheme(theme) {
    $('body').removeClass('theme-light theme-medium theme-dark theme-purple').addClass(theme);
    localStorage.setItem('tcg_theme', theme);
    $('.theme-btn, .theme-btn-small').removeClass('active');
    $(`.theme-btn[data-theme="${theme}"], .theme-btn-small[data-theme="${theme}"]`).addClass('active');
}

async function showAuthenticatedContent() {
    $('body').addClass('public-body');
    $('#login-modal').removeClass('active');
    $('#authenticated-content').show();
    $('#top-panel').show();
    $('#dropdown-user-name').text(currentUser.username);
    showView('dashboard');
    loadAlbums();
    initMichatbot(true);
}

function showLoginView() { $('#login-modal').addClass('active'); $('#authenticated-content, #top-panel').hide(); }
function showView(view) { $('.admin-section').hide().removeClass('active'); $(`#view-${view}`).show().addClass('active'); if (window.botInstance) window.botInstance.setContext(view); }

async function loadAlbums() {
    const { data: albums } = await _supabase.from('binders').select('*').eq('user_id', currentUser.id).order('position', { ascending: true });
    const $list = $('#album-list').empty();
    if (!albums || albums.length === 0) { $list.html('<div class="empty">No tienes álbumes.</div>'); return; }
    albums.forEach(album => {
        const $card = $(`
            <div class="album-card album-item" data-id="${album.id}">
                <img src="${album.cover_image_url || 'https://via.placeholder.com/300x150'}">
                <h3>${album.title}</h3>
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button class="btn btn-edit-album" style="flex:1;">Editar</button>
                    <button class="btn btn-secondary btn-share-album"><i class="fas fa-share-alt"></i></button>
                    <button class="btn btn-danger btn-delete-album">Eliminar</button>
                </div>
            </div>
        `);
        $card.find('.btn-edit-album').click(() => editAlbum(album));
        $card.find('.btn-delete-album').click(() => deleteAlbum(album.id));
        $card.find('.btn-share-album').click(() => openShareModal(album.title, 'binders', album.id));
        $list.append($card);
    });
}

async function deleteAlbum(id) {
    const res = await Swal.fire({ title: '¿Eliminar?', icon: 'warning', showCancelButton: true });
    if (res.isConfirmed) { await _supabase.from('binders').delete().eq('id', id); loadAlbums(); }
}

async function editAlbum(album) {
    currentAlbumId = album.id;
    $('#editor-title').text(`Editando: ${album.title}`);
    $('#input-album-title').val(album.title);
    $('#input-album-cover').val(album.cover_image_url || '');
    $('#input-album-back').val(album.back_image_url || '');

    const gridLayout = album.grid_layout || '3x3';
    $('#input-album-grid-layout').val(gridLayout);
    window.currentAlbumGridLayout = gridLayout;

    $('#input-album-public').prop('checked', album.is_public !== false);
    showView('editor');
    loadAlbumPages(album.id, true);
}

async function loadAlbumPages(albumId, fetchSlots = true) {
    const { data: pages } = await _supabase.from('binder_pages').select('*').eq('binder_id', albumId).order('page_index', { ascending: true });
    if (fetchSlots && pages) {
        const { data: slots } = await _supabase.from('binder_card_slots').select('*').in('page_id', pages.map(p => p.id));
        localAlbumSlots = slots || [];
    }
    renderAlbumPagesLocal(pages || []);
}

function renderAlbumPagesLocal(pages) {
    const $list = $('#page-list').empty();
    pages.forEach(page => {
        const $page = $(`
            <div class="admin-page-item" data-id="${page.id}">
                <h3>Página ${page.page_index + 1} <button class="btn btn-danger btn-sm btn-delete-page">Eliminar</button></h3>
                <div class="grid-container admin-grid-preview"></div>
            </div>
        `);
        $page.find('.btn-delete-page').click(() => deletePage(page.id));
        const $grid = $page.find('.grid-container');
        const gridLayout = window.currentAlbumGridLayout || '3x3';
        $grid.addClass('grid-layout-' + gridLayout);

        let numSlots = 9;
        if (gridLayout === '4x3') numSlots = 12;
        else if (gridLayout === '4x4') numSlots = 16;
        else if (gridLayout === '2x2') numSlots = 4;
        else if (gridLayout === '1x1') numSlots = 1;

        for (let i = 0; i < numSlots; i++) {
            const slot = localAlbumSlots.find(s => s.page_id === page.id && s.slot_index === i);
            const $slot = $(`<div class="card-slot" data-index="${i}"></div>`);
            if (slot && slot.image_url) {
                let slotHtml = `<img src="${slot.image_url}" class="tcg-card">`;
                if (slot.price) slotHtml += `<div style="position: absolute; bottom: 2px; right: 2px; background: rgba(0,255,136,0.9); color: #000; font-weight: 900; font-size: 10px; padding: 1px 4px; border-radius: 4px;">$${slot.price}</div>`;
                $slot.html(slotHtml);
            } else {
                $slot.html('<div style="color:#444; font-size:10px; text-align:center; padding-top:10px;">Vacío</div>');
            }
            $grid.append($slot);
        }
        $list.append($page);
    });
}

async function deletePage(id) {
    const res = await Swal.fire({ title: '¿Eliminar?', icon: 'warning', showCancelButton: true });
    if (res.isConfirmed) { await _supabase.from('binder_pages').delete().eq('id', id); loadAlbumPages(currentAlbumId, false); }
}

async function loadSlotData(pageId, slotIndex) {
    const data = localAlbumSlots.find(s => s.page_id === pageId && s.slot_index === slotIndex);
    $('#slot-image-url, #slot-name, #slot-rarity, #slot-expansion, #slot-condition, #slot-price, #slot-cost-price').val('');
    currentSlotExtraImages = [];

    if (data) {
        $('#slot-image-url').val(data.image_url || '').trigger('change');
        $('#slot-name').val(data.name || '');
        $('#slot-rarity').val(data.rarity || '');
        $('#slot-expansion').val(data.expansion || '');
        $('#slot-condition').val(data.condition || '');
        $('#slot-price').val(data.price || '');
        $('#slot-cost-price').val(data.cost_price || '');
        if (data.extra_images && Array.isArray(data.extra_images)) {
            currentSlotExtraImages = [...data.extra_images];
        }
    } else {
        $('#slot-image-url').trigger('change');
    }
    $('.slot-tab-btn[data-tab="slot-tab-info"]').click();
    renderExtraImagesPreview();
    $('#slot-modal').addClass('active');
}

async function openOrganizeModal(type) {
    const $grid = $('#organize-grid').empty();
    $('#organize-modal').addClass('active');
    const { data: items } = await _supabase.from('binders').select('id, title, cover_image_url').eq('user_id', currentUser.id).order('position', { ascending: true });
    if (!items) return;
    items.forEach(item => {
        $grid.append(`<div class="organize-item" data-id="${item.id}"><img src="${item.cover_image_url || ''}"><span>${item.title}</span></div>`);
    });
    if (window.Sortable) {
        Sortable.create($grid[0], { animation: 150, onEnd: async () => {
            const ids = []; $grid.find('.organize-item').each(function() { ids.push($(this).data('id')); });
            const promises = ids.map((id, index) => _supabase.from('binders').update({ position: index }).eq('id', id));
            await Promise.all(promises);
            loadAlbums();
        }});
    }
}
