// Shared variables
let currentDeckId = null;
let currentUser = null;
let localDeckCards = [];
let deckCardsToDelete = [];
let localVikingData = [];
let currentDeckCardId = null;

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
    loadDecks();
    initFloatingCompanion();
}

// Navigation
function showView(v) { $('.admin-section').hide().removeClass('active'); $(`#view-${v}`).show().addClass('active'); }

// Deck Logic
async function loadDecks() {
    const { data: decks } = await _supabase.from('decks').select('*').eq('user_id', currentUser.id).order('position', { ascending: true });
    const $list = $('#deck-list').empty();
    if (!decks || decks.length === 0) { $list.html('<div class=\"empty\">No tienes mazos.</div>'); return; }
    decks.forEach(deck => {
        const $card = $(`
            <div class=\"album-card\" data-id=\"${deck.id}\">
                <div class=\"deck-preview-icon\"><i class=\"fas fa-layer-group fa-3x\"></i></div>
                <h3>${deck.name}</h3>
                <div style=\"display:flex; gap:10px; margin-top:auto;\">
                    <button class=\"btn btn-edit-deck\">Editar</button>
                    <button class=\"btn btn-danger btn-delete-deck\"><i class=\"fas fa-trash\"></i></button>
                </div>
            </div>
        `);
        $card.find('.btn-edit-deck').click(() => editDeck(deck));
        $card.find('.btn-delete-deck').click(() => deleteDeck(deck.id));
        $list.append($card);
    });
}

async function createDeck() { await _supabase.from('decks').insert([{ name: 'Nuevo Deck', user_id: currentUser.id }]); loadDecks(); }

async function editDeck(deck) {
    currentDeckId = deck.id;
    $('#deck-editor-title').text(`Editando: ${deck.name}`);
    $('#input-deck-name').val(deck.name);
    showView('deck-editor');
    loadDeckCards(deck.id);
}

async function loadDeckCards(id) {
    const { data: cards } = await _supabase.from('deck_cards').select('*').eq('deck_id', id).order('position', { ascending: true });
    localDeckCards = cards || [];
    renderDeckCardsLocal();
}

function renderDeckCardsLocal() {
    const $list = $('#deck-card-list').empty();
    localDeckCards.forEach(card => {
        const $item = $(`
            <div class=\"album-card deck-card-item\">
                <img src=\"${card.image_url}\">
                <div style=\"font-size: 12px; margin-top: 5px; text-align: center;\">${card.name}</div>
            </div>
        `);
        $list.append($item);
    });
}

async function saveDeckMeta() {
    await _supabase.from('decks').update({ name: $('#input-deck-name').val() }).eq('id', currentDeckId);
    showView('decks'); loadDecks();
}

async function deleteDeck(id) {
    const res = await Swal.fire({ title: '¿Eliminar?', icon: 'warning', showCancelButton: true });
    if (res.isConfirmed) { await _supabase.from('decks').delete().eq('id', id); loadDecks(); }
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
    $(document).on('click', '#btn-create-deck', createDeck);
    $(document).on('click', '#btn-save-deck-meta', saveDeckMeta);
    $(document).on('click', '#btn-back-to-main', () => window.location.href = 'admin.html');
});
