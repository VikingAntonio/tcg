let currentAlbumId = null;
let currentPageId = null;
let currentSlotIndex = null;
let currentUser = null;
let localAlbumSlots = [];
let albumSlotsToDelete = [];
let localVikingData = [];
let editingType = 'slot';

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
        const paramName = type === 'albums' ? 'albumId' : 'deckId';
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

$(document).ready(async function() {
    await checkSession();
    initTheme();

    $("#btn-login").click(function(e) { e.preventDefault(); handleLogin(); });
    $(document).on("click", "#btn-back-to-web", function(e) { e.preventDefault(); window.location.href = "index.html"; });
    $("#close-chatbot").click(function() { $("#chatbot-container").removeClass("active"); });
    $("#send-chat").click(function() {
        const text = $("#chat-input").val().trim();
        if (!text) return;
        $("#chat-messages").append(`<div class="chat-msg msg-user">${text}</div>`);
        $("#chat-input").val("");
        setTimeout(() => { $("#chat-messages").append(`<div class="chat-msg msg-bot">Aún estoy aprendiendo...</div>`); }, 800);
    });

    $(document).on('click', '#btn-create-album', async function(e) {
        e.preventDefault();
        if (!currentUser) return;

        const { count } = await _supabase.from('albums').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id);
        if (count >= (currentUser.max_albums || 3)) {
            Swal.fire('Límite alcanzado', `Tu plan actual permite un máximo de ${currentUser.max_albums || 3} álbumes.`, 'warning');
            return;
        }

        const { data, error } = await _supabase.from('albums').insert([{ title: 'Nuevo Álbum', user_id: currentUser.id }]).select();
        if (error) Swal.fire('Error', 'No se pudo crear el álbum', 'error');
        else loadAlbums();
    });

    $(document).on('click', '#btn-save-album-meta', async function(e) {
        e.preventDefault();
        Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

        const title = $('#input-album-title').val();
        const cover = $('#input-album-cover').val();
        const back = $('#input-album-back').val();
        const coverColor = $('#input-album-cover-color').val();
        const backColor = $('#input-album-back-color').val();
        const is_public = $('#input-album-public').is(':checked');

        let updateData = { title, cover_image_url: cover, back_image_url: back, cover_color: coverColor, back_color: backColor, is_public };

        try {
            let { error: albumErr } = await _supabase.from('albums').update(updateData).eq('id', currentAlbumId);
            if (albumErr) throw albumErr;

            if (albumSlotsToDelete.length > 0) await _supabase.from('card_slots').delete().in('id', albumSlotsToDelete);
            if (localAlbumSlots.length > 0) {
                const slotsToUpsert = localAlbumSlots.map(s => { const { id, obtained, ...rest } = s; return rest; });
                await _supabase.from('card_slots').upsert(slotsToUpsert, { onConflict: 'page_id,slot_index' });
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
        const { count } = await _supabase.from('pages').select('*', { count: 'exact', head: true }).eq('album_id', currentAlbumId);
        if (count >= (currentUser.max_pages || 10)) {
            Swal.fire('Límite alcanzado', `Máximo ${currentUser.max_pages || 10} páginas.`, 'warning');
            return;
        }
        await _supabase.from('pages').insert([{ album_id: currentAlbumId, page_index: count }]);
        loadAlbumPages(currentAlbumId, false);
    });

    $(document).on('click', '#btn-save-slot', async function(e) {
        e.preventDefault();
        const imageUrl = $('#slot-image-url').val();
        if (!imageUrl) { Swal.fire('Error', 'URL requerida', 'warning'); return; }

        let holoEffect = $('#slot-holo-effect').val() || '';
        if (holoEffect === 'custom-foil') holoEffect = `custom-foil|${$('#slot-custom-foil-type').val() || 'foil'}`;

        const cardData = {
            image_url: imageUrl, name: $('#slot-name').val() || '', holo_effect: holoEffect,
            custom_mask_url: $('#slot-custom-mask').val() || '', rarity: $('#slot-rarity').val() || '',
            expansion: $('#slot-expansion').val() || '', condition: $('#slot-condition').val() || 'M',
            quantity: parseInt($('#slot-quantity').val()) || 1, price: $('#slot-price').val() || '',
            obtained: $('#slot-modal').data('current-obtained') !== false,
            show_foil_in_list: $('#slot-show-foil-list').is(':checked')
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

    $(document).on('click', '#btn-external-search', async function() {
        window.searchExternalCard('#external-search-input', '#external-search-results', (card) => {
            $('#slot-image-url').val(card.high_res || card.image);
            $('#slot-name').val(card.name);
            $('#slot-rarity').val(card.rarity || '');
            $('#slot-expansion').val(card.set || '');
            $('#slot-price').val(card.price || '');
        });
    });

    $(document).on('click', '.slot-tab-btn', function() {
        const tabId = $(this).data('tab');
        $('.slot-tab-btn').removeClass('active'); $(this).addClass('active');
        $('.slot-tab-content').removeClass('active'); $(`#${tabId}`).addClass('active');
    });

    $(document).on('click', '#btn-open-mask-editor', function(e) {
        e.preventDefault();
        const cardImgUrl = $('#slot-image-url').val();
        if (!cardImgUrl) return;
        window.maskTargetInput = '#slot-custom-mask';
        $('#mask-canvas-wrapper').css('background-image', `url(${cardImgUrl})`);
        window.initMaskCanvas();
        $('#mask-editor-overlay').addClass('active');
    });

    $(document).on('click', '#close-slot-modal', function() { $('#slot-modal').removeClass('active'); });

    $(document).on('click', '#btn-organize-albums', function(e) { e.preventDefault(); openOrganizeModal('albums'); });
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
    initFloatingCompanion();
}

function showLoginView() { $('#login-modal').addClass('active'); $('#authenticated-content, #top-panel').hide(); }
function showView(view) { $('.admin-section').hide().removeClass('active'); $(`#view-${view}`).show().addClass('active'); if (window.botInstance) window.botInstance.setContext(view); }

async function loadAlbums() {
    const { data: albums } = await _supabase.from('albums').select('*').eq('user_id', currentUser.id).order('position', { ascending: true });
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
        $card.find('.btn-share-album').click(() => openShareModal(album.title, 'albums', album.id));
        $list.append($card);
    });
}

async function deleteAlbum(id) {
    const res = await Swal.fire({ title: '¿Eliminar?', icon: 'warning', showCancelButton: true });
    if (res.isConfirmed) { await _supabase.from('albums').delete().eq('id', id); loadAlbums(); }
}

async function editAlbum(album) {
    currentAlbumId = album.id;
    $('#editor-title').text(`Editando: ${album.title}`);
    $('#input-album-title').val(album.title);
    $('#input-album-cover').val(album.cover_image_url || '');
    $('#input-album-back').val(album.back_image_url || '');
    $('#input-album-cover-color').val(album.cover_color || '#1a1a1a');
    $('#input-album-back-color').val(album.back_color || '#1a1a1a');
    $('#input-album-public').prop('checked', album.is_public !== false);
    showView('editor');
    loadAlbumPages(album.id, true);
}

async function loadAlbumPages(albumId, fetchSlots = true) {
    const { data: pages } = await _supabase.from('pages').select('*').eq('album_id', albumId).order('page_index', { ascending: true });
    if (fetchSlots && pages) {
        const { data: slots } = await _supabase.from('card_slots').select('*').in('page_id', pages.map(p => p.id));
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
        for (let i = 0; i < 9; i++) {
            const slot = localAlbumSlots.find(s => s.page_id === page.id && s.slot_index === i);
            const $slot = $(`<div class="card-slot" data-index="${i}"></div>`);
            if (slot) $slot.append(`<img src="${slot.image_url}" class="tcg-card">`);
            else $slot.html('<div style="color:#444; font-size:10px; text-align:center; padding-top:10px;">Vacío</div>');
            $grid.append($slot);
        }
        $list.append($page);
    });
}

async function deletePage(id) {
    const res = await Swal.fire({ title: '¿Eliminar?', icon: 'warning', showCancelButton: true });
    if (res.isConfirmed) { await _supabase.from('pages').delete().eq('id', id); loadAlbumPages(currentAlbumId, false); }
}

async function initFloatingCompanion() {
    if (typeof CompanionBot === 'function') {
        window.botInstance = new CompanionBot({ supabase: _supabase, userId: currentUser.id, userType: 'admin' });
        window.botInstance.init();
    }
}

async function loadSlotData(pageId, slotIndex) {
    const data = localAlbumSlots.find(s => s.page_id === pageId && s.slot_index === slotIndex);
    $('#slot-image-url, #slot-name, #slot-custom-mask, #slot-rarity, #slot-expansion, #slot-condition, #slot-quantity, #slot-price').val('');
    $('#slot-holo-effect').val('');
    if (data) {
        $('#slot-image-url').val(data.image_url || '');
        $('#slot-name').val(data.name || '');
        $('#slot-rarity').val(data.rarity || '');
        $('#slot-expansion').val(data.expansion || '');
        $('#slot-condition').val(data.condition || '');
        $('#slot-quantity').val(data.quantity || '');
        $('#slot-price').val(data.price || '');
    }
    $('#slot-modal').addClass('active');
}

async function openOrganizeModal(type) {
    const $grid = $('#organize-grid').empty();
    $('#organize-modal').addClass('active');
    const { data: items } = await _supabase.from('albums').select('id, title, cover_image_url').eq('user_id', currentUser.id).order('position', { ascending: true });
    if (!items) return;
    items.forEach(item => {
        $grid.append(`<div class="organize-item" data-id="${item.id}"><img src="${item.cover_image_url || ''}"><span>${item.title}</span></div>`);
    });
    if (window.Sortable) {
        Sortable.create($grid[0], { animation: 150, onEnd: async () => {
            const ids = []; $grid.find('.organize-item').each(function() { ids.push($(this).data('id')); });
            const promises = ids.map((id, index) => _supabase.from('albums').update({ position: index }).eq('id', id));
            await Promise.all(promises);
            loadAlbums();
        }});
    }
}
