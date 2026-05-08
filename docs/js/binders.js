// Shared variables
let currentAlbumId = null;
let currentUser = null;
let localAlbumSlots = [];
let albumSlotsToDelete = [];
let localVikingData = [];
let currentPageId = null;
let currentSlotIndex = null;

// Auth & Session
async function checkSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        const { data: user } = await _supabase.from('usuarios').select('*').eq('id', session.user.id).single();
        if (user) { currentUser = user; showAuthenticatedContent(); } else showLoginView();
    } else showLoginView();
}
function showLoginView() { $('#login-modal').addClass('active'); $('#authenticated-content').hide(); }
async function handleLogout() { await _supabase.auth.signOut(); location.reload(); }
function initTheme() { applyTheme(localStorage.getItem('tcg_theme') || 'theme-dark'); }
function applyTheme(t) { $('body').removeClass('theme-light theme-purple theme-dark').addClass(t); localStorage.setItem('tcg_theme', t); }

function showAuthenticatedContent() {
    $('#login-modal').removeClass('active');
    $('#authenticated-content').show();
    $('#top-panel').show();
    $('#dropdown-user-name').text(currentUser.username);
    loadAlbums();
    initFloatingCompanion();
}

// Navigation
function showView(v) { $('.admin-section').hide().removeClass('active'); $(`#view-${v}`).show().addClass('active'); }

// Album Logic
async function loadAlbums() {
    const { data: albums } = await _supabase.from('albums').select('*').eq('user_id', currentUser.id).order('position', { ascending: true });
    const $list = $('#album-list').empty();
    if (!albums || albums.length === 0) { $list.html('<div class=\"empty\">No tienes álbumes.</div>'); return; }
    albums.forEach(album => {
        const cover = album.cover_image_url || 'https://via.placeholder.com/300x150?text=Sin+Portada';
        const $card = $(`
            <div class=\"album-card\" data-id=\"${album.id}\">
                <img src=\"${cover}\">
                <h3>${album.title}</h3>
                <div style=\"display:flex; gap:10px; margin-top:auto;\">
                    <button class=\"btn btn-edit-album\">Editar</button>
                    <button class=\"btn btn-danger btn-delete-album\"><i class=\"fas fa-trash\"></i></button>
                </div>
            </div>
        `);
        $card.find('.btn-edit-album').click(() => editAlbum(album));
        $card.find('.btn-delete-album').click(() => deleteAlbum(album.id));
        $list.append($card);
    });
}

async function createAlbum() { await _supabase.from('albums').insert([{ title: 'Nuevo Álbum', user_id: currentUser.id }]); loadAlbums(); }

async function editAlbum(album) {
    currentAlbumId = album.id;
    $('#editor-title').text(`Editando: ${album.title}`);
    $('#input-album-title').val(album.title);
    $('#input-album-cover').val(album.cover_image_url || '');
    $('#input-album-back').val(album.back_image_url || '');
    showView('editor');
    loadAlbumPages(album.id);
}

async function loadAlbumPages(id) {
    const { data: pages } = await _supabase.from('pages').select('*').eq('album_id', id).order('page_index', { ascending: true });
    const pageIds = (pages || []).map(p => p.id);
    if (pageIds.length > 0) {
        const { data: slots } = await _supabase.from('card_slots').select('*').in('page_id', pageIds);
        localAlbumSlots = slots || [];
    }
    renderPages(pages || []);
}

function renderPages(pages) {
    const $list = $('#page-list').empty();
    pages.forEach(page => {
        const $grid = $('<div class=\"grid-container admin-grid-preview\"></div>');
        for (let i = 0; i < 9; i++) {
            const slot = localAlbumSlots.find(s => s.page_id === page.id && s.slot_index === i);
            const $slot = $(`<div class=\"card-slot\" data-index=\"${i}\"></div>`);
            if (slot && slot.image_url) {
                $slot.append(`<img src=\"${slot.image_url}\">`);
            }
            $grid.append($slot);
        }
        $list.append($(`<div class=\"admin-page-item\" data-id=\"${page.id}\"><h3>Página ${page.page_index + 1}</h3></div>`).append($grid));
    });
}

async function saveAlbumMeta() {
    const data = { title: $('#input-album-title').val(), cover_image_url: $('#input-album-cover').val(), back_image_url: $('#input-album-back').val() };
    await _supabase.from('albums').update(data).eq('id', currentAlbumId);
    showView('dashboard'); loadAlbums();
}

async function deleteAlbum(id) {
    const res = await Swal.fire({ title: '¿Eliminar?', icon: 'warning', showCancelButton: true });
    if (res.isConfirmed) { await _supabase.from('albums').delete().eq('id', id); loadAlbums(); }
}

async function loadSlotData(pageId, slotIdx) {
    const data = localAlbumSlots.find(s => s.page_id === pageId && s.slot_index === slotIdx);
    $('#slot-image-url').val(data ? data.image_url : '');
    $('#slot-name').val(data ? data.name : '');
    $('#slot-modal').addClass('active');
}

function saveSlot() {
    const data = { page_id: currentPageId, slot_index: currentSlotIndex, image_url: $('#slot-image-url').val(), name: $('#slot-name').val() };
    const idx = localAlbumSlots.findIndex(s => s.page_id === currentPageId && s.slot_index === currentSlotIndex);
    if (idx !== -1) localAlbumSlots[idx] = { ...localAlbumSlots[idx], ...data }; else localAlbumSlots.push(data);
    $('#slot-modal').removeClass('active');
    loadAlbumPages(currentAlbumId);
}

// Bot & Companion Fallback
async function initFloatingCompanion() {
    const { data: publicSpirits } = await _supabase.from('spirits').select('*').eq('is_public', true).limit(1);
    if (publicSpirits && publicSpirits.length > 0) {
        $('#floating-companion-container').html(`<model-viewer src=\"${publicSpirits[0].gltf_url}\" auto-rotate camera-controls interaction-prompt=\"none\"></model-viewer>`);
    }
}

$(document).ready(function() {
    checkSession();
    initTheme();
    $(document).on('click', '#avatar-btn', (e) => { e.stopPropagation(); $('#user-dropdown').toggleClass('active'); });
    $(document).on('click', '#menu-btn-logout', handleLogout);
    $(document).on('click', '#btn-create-album', createAlbum);
    $(document).on('click', '#btn-save-album-meta', saveAlbumMeta);
    $(document).on('click', '#btn-back-to-main', () => window.location.href = 'admin.html');
});
