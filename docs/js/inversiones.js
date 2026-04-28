/**
 * Inversiones (Investments) Module
 * Logic for managing card investments with TCGAPI.dev integration.
 */

// --- STATE ---
let currentInvestmentCategoryId = null;

// --- UTILS ---
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}
let currentInvestmentViewMode = 'album'; // 'album', 'slide', 'list'
let localInvestmentCards = [];

// --- INITIALIZATION ---
$(document).ready(function() {
    initInvestmentListeners();
});

function initInvestmentListeners() {
    // Navigation to Investments
    $(document).on('click', '#btn-show-investments', function(e) {
        e.preventDefault();
        showView('investments');
        loadInvestmentCategories();
    });

    // Back to Dashboard
    $(document).on('click', '#btn-back-to-main-from-investments', function(e) {
        e.preventDefault();
        showView('main-dashboard');
    });

    // Back to Categories from Details
    $(document).on('click', '#btn-back-to-investments', function(e) {
        e.preventDefault();
        showView('investments');
    });

    // Create Category
    $('#btn-create-investment-category').click(async function() {
        const { value: name } = await Swal.fire({
            title: 'Nueva Categoría de Inversión',
            input: 'text',
            inputLabel: 'Nombre de la categoría',
            inputPlaceholder: 'Ej: Pokémon Moderno, YGO Vintage...',
            showCancelButton: true
        });

        if (name) {
            saveInvestmentCategory({ name });
        }
    });

    // View Mode Switches
    $(document).on('click', '.btn-inv-mode', function() {
        const mode = $(this).data('mode');
        $('.btn-inv-mode').removeClass('active');
        $(this).addClass('active');
        currentInvestmentViewMode = mode;
        renderInvestmentCards(mode);
    });

    // Add Card to Investment
    $('#btn-add-investment-card').click(function() {
        openInvestmentCardModal();
    });

    // Refresh Prices Button
    $(document).on('click', '#btn-refresh-inv-prices', async function() {
        if (!currentInvestmentCategoryId) return;

        const res = await Swal.fire({
            title: '¿Actualizar precios?',
            text: 'Se consultará la API para obtener los precios más recientes de todas las cartas en esta categoría.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, actualizar'
        });

        if (res.isConfirmed) {
            Swal.fire({ title: 'Actualizando precios...', didOpen: () => Swal.showLoading() });
            await updateCategoryPrices(currentInvestmentCategoryId);
            Swal.close();
            loadInvestmentCards();
        }
    });
}

// --- CATEGORY FUNCTIONS ---

async function loadInvestmentCategories() {
    if (!currentUser) return;

    $('#investment-category-list').html('<div class="loading">Cargando categorías...</div>');

    const { data: categories, error } = await _supabase
        .from('investment_categories')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('position', { ascending: true });

    if (error) {
        $('#investment-category-list').html('<div class="error">Error al cargar categorías.</div>');
        return;
    }

    if (categories.length === 0) {
        $('#investment-category-list').html('<div class="empty">No tienes categorías de inversión. Crea una para empezar.</div>');
        return;
    }

    const $container = $('#investment-category-list');
    $container.empty();

    categories.forEach(cat => {
        const isPublic = cat.is_public !== false;
        const $card = $(`
            <div class="album-card inv-category-item" data-id="${cat.id}">
                <div class="deck-preview-icon"><i class="fas fa-chart-line fa-3x"></i></div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                    <h3 style="margin:0;">${escapeHtml(cat.name)}</h3>
                </div>
                <div style="margin-top: 5px; display: flex; align-items: center; gap: 8px;">
                    <label class="switch">
                        <input type="checkbox" class="toggle-inv-cat-public" data-id="${cat.id}" ${isPublic ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <span style="font-size: 10px; color: #aaa;">${isPublic ? 'Público' : 'Privado'}</span>
                </div>
                <div style="display:flex; gap:10px; margin-top:auto; flex-wrap: wrap;">
                    <button class="btn btn-view-inv-cat" style="flex: 1;">Ver Inversiones</button>
                    <button class="btn btn-secondary btn-edit-inv-cat" style="width: 45px;"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-delete-inv-cat" style="width: 45px;"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `);

        $card.find('.btn-view-inv-cat').click(() => openInvestmentCategory(cat));
        $card.find('.btn-edit-inv-cat').click(() => editInvestmentCategory(cat));
        $card.find('.btn-delete-inv-cat').click(() => deleteInvestmentCategory(cat.id));
        $card.find('.toggle-inv-cat-public').change(function() {
            updateInvestmentCategory(cat.id, { is_public: $(this).is(':checked') });
        });

        $container.append($card);
    });
}

async function saveInvestmentCategory(data) {
    Swal.fire({ title: 'Guardando...', didOpen: () => Swal.showLoading() });

    const { error } = await _supabase
        .from('investment_categories')
        .insert([{ ...data, user_id: currentUser.id }]);

    Swal.close();
    if (error) {
        Swal.fire('Error', 'No se pudo crear la categoría', 'error');
    } else {
        loadInvestmentCategories();
    }
}

async function updateInvestmentCategory(id, data, refresh = false) {
    const { error } = await _supabase
        .from('investment_categories')
        .update(data)
        .eq('id', id);

    if (error) {
        Swal.fire('Error', 'No se pudo actualizar la categoría', 'error');
    } else if (refresh) {
        loadInvestmentCategories();
    }
}

async function editInvestmentCategory(cat) {
    const { value: name } = await Swal.fire({
        title: 'Editar Categoría',
        input: 'text',
        inputValue: cat.name,
        showCancelButton: true
    });

    if (name && name !== cat.name) {
        updateInvestmentCategory(cat.id, { name }, true);
    }
}

async function deleteInvestmentCategory(id) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Eliminar categoría?',
        text: 'Se eliminarán todas las cartas dentro de esta categoría.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4757',
        confirmButtonText: 'Sí, eliminar'
    });

    if (isConfirmed) {
        const { error } = await _supabase.from('investment_categories').delete().eq('id', id);
        if (error) Swal.fire('Error', 'No se pudo eliminar', 'error');
        else loadInvestmentCategories();
    }
}

// --- CARD FUNCTIONS ---

async function openInvestmentCategory(cat) {
    currentInvestmentCategoryId = cat.id;
    $('#inv-category-title').text(cat.name);
    showView('investment-details');
    loadInvestmentCards();
}

async function loadInvestmentCards() {
    $('#investment-card-container').html('<div class="loading">Cargando cartas...</div>');

    const { data: cards, error } = await _supabase
        .from('investment_cards')
        .select('*')
        .eq('category_id', currentInvestmentCategoryId)
        .order('position', { ascending: true });

    if (error) {
        $('#investment-card-container').html('<div class="error">Error al cargar cartas.</div>');
        return;
    }

    localInvestmentCards = cards || [];
    renderInvestmentCards(currentInvestmentViewMode);
}

function renderInvestmentCards(mode) {
    const $container = $('#investment-card-container');
    $container.empty();

    if (localInvestmentCards.length === 0) {
        $container.html('<div class="empty">No hay cartas en esta categoría.</div>');
        return;
    }

    if (mode === 'album') {
        renderAlbumMode($container);
    } else if (mode === 'slide') {
        renderSlideMode($container);
    } else {
        renderListMode($container);
    }
}

function renderAlbumMode($container) {
    $container.addClass('investment-album-layout').removeClass('investment-list-layout investment-slide-layout');
    const $albumWrapper = $('<div class="album-wrapper"><div class="album investment-album"></div></div>');
    const $album = $albumWrapper.find('.album');
    $container.append($albumWrapper);

    // Cover
    $album.append(`
        <div class="page cover-page">
            <div class="textured-cover" style="background-color: var(--viking-blue)">
                <h2 style="color:white; text-align:center; padding: 20% 10%;">${escapeHtml($('#inv-category-title').text())}</h2>
                <div style="text-align:center; color:rgba(255,255,255,0.5); font-size: 0.8rem;">INVERSIONES</div>
            </div>
        </div>
    `);

    // Group cards into pages of 9
    for (let i = 0; i < localInvestmentCards.length; i += 9) {
        const pageCards = localInvestmentCards.slice(i, i + 9);
        const $page = $('<div class="page album-page"></div>');
        const $grid = $('<div class="grid-container"></div>');

        for (let j = 0; j < 9; j++) {
            const card = pageCards[j];
            const $slot = $('<div class="card-slot"></div>');
            if (card) {
                $slot.append(`
                    <img src="${card.image_url}" class="tcg-card">
                    <div class="inv-card-info-badge">$${parseFloat(card.current_price || 0).toFixed(2)}</div>
                    <div class="zoom-btn"><i class="fas fa-search-plus"></i></div>
                `);
                $slot.find('.zoom-btn').click(() => openInvestmentCardModal(card));
            }
            $grid.append($slot);
        }
        $page.append($grid);
        $album.append($page);
    }

    // Add empty page if needed for double display
    const totalPages = $album.find('.page').length;
    if (totalPages % 2 !== 0) {
        $album.append('<div class="page album-page"></div>');
    }

    // Back Cover
    $album.append(`
        <div class="page cover-page">
            <div class="textured-cover" style="background-color: #1a1a1a"></div>
        </div>
    `);

    setTimeout(() => {
        $album.turn({
            width: 600,
            height: 420,
            autoCenter: true,
            display: 'double',
            acceleration: true,
            elevation: 50,
            duration: 800
        });
    }, 100);
}

function renderSlideMode($container) {
    $container.addClass('investment-slide-layout').removeClass('investment-list-layout investment-album-layout');
    const swiperId = `inv-swiper-${Date.now()}`;
    const $swiper = $(`
        <div class="swiper ${swiperId}" style="width: 100%; max-width: 350px; margin: 0 auto; height: 500px; padding: 20px 0;">
            <div class="swiper-wrapper">
                ${localInvestmentCards.map(card => `
                    <div class="swiper-slide card-slot inv-card-item" data-id="${card.id}">
                        <img src="${card.image_url}" style="width: 100%; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                        <div class="inv-card-info-overlay">
                            <h4>${escapeHtml(card.card_name)}</h4>
                            <p>${escapeHtml(card.set_name)} - ${escapeHtml(card.rarity)}</p>
                            <div class="inv-price-tag">Actual: $${parseFloat(card.current_price || 0).toFixed(2)}</div>
                            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 10px;">
                                <button class="btn btn-sm btn-edit-inv-card-slide" data-id="${card.id}"><i class="fas fa-edit"></i></button>
                                <button class="btn btn-sm btn-danger btn-delete-inv-card-slide" data-id="${card.id}"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `);
    $container.append($swiper);

    $swiper.find('.btn-edit-inv-card-slide').click(function(e) {
        e.stopPropagation();
        const id = $(this).data('id');
        const card = localInvestmentCards.find(c => c.id === id);
        openInvestmentCardModal(card);
    });

    $swiper.find('.btn-delete-inv-card-slide').click(function(e) {
        e.stopPropagation();
        const id = $(this).data('id');
        deleteInvestmentCard(id);
    });

    new Swiper(`.${swiperId}`, {
        effect: "cards",
        grabCursor: true,
        centeredSlides: true,
        slidesPerView: 'auto'
    });
}

function renderListMode($container) {
    $container.addClass('investment-list-layout').removeClass('investment-slide-layout investment-album-layout');
    const $list = $('<div class="inv-list-container"></div>');

    localInvestmentCards.forEach(card => {
        const diff = (card.current_price || 0) - (card.purchase_price || 0);
        const diffClass = diff >= 0 ? 'price-up' : 'price-down';
        const $item = $(`
            <div class="inv-list-item">
                <img src="${card.image_url}" class="inv-list-thumb">
                <div class="inv-list-details">
                    <div class="inv-list-name">${escapeHtml(card.card_name)}</div>
                    <div class="inv-list-set">${escapeHtml(card.set_name)} - ${escapeHtml(card.rarity)}</div>
                </div>
                <div class="inv-list-prices">
                    <div class="inv-price-row"><span>Compra:</span> <b>$${parseFloat(card.purchase_price || 0).toFixed(2)}</b></div>
                    <div class="inv-price-row"><span>Actual:</span> <b class="${diffClass}">$${parseFloat(card.current_price || 0).toFixed(2)}</b></div>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button class="btn btn-sm btn-edit-inv-card" data-id="${card.id}"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger btn-delete-inv-card" data-id="${card.id}"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `);
        $item.find('.btn-edit-inv-card').click(() => openInvestmentCardModal(card));
        $item.find('.btn-delete-inv-card').click(() => deleteInvestmentCard(card.id));
        $list.append($item);
    });
    $container.append($list);
}

// --- CARD MODAL & API ---

let currentEditingInvCardId = null;

function openInvestmentCardModal(card = null) {
    currentEditingInvCardId = card ? card.id : null;

    // Reset Modal
    $('#inv-card-modal-title').text(card ? 'Editar Inversión' : 'Añadir Carta a Inversión');
    $('#inv-card-name').val(card ? card.card_name : '');
    $('#inv-card-purchase-price').val(card ? card.purchase_price : '');
    $('#inv-card-current-price').val(card ? card.current_price : '');
    $('#inv-card-quantity').val(card ? card.quantity : 1);
    $('#inv-card-public').prop('checked', card ? card.is_public : false);

    $('#inv-card-external-id').val(card ? card.external_id : '');
    $('#inv-card-image-url').val(card ? card.image_url : '');
    $('#inv-card-set-name').val(card ? card.set_name : '');
    $('#inv-card-set-number').val(card ? card.set_number : '');
    $('#inv-card-rarity').val(card ? card.rarity : '');
    $('#inv-card-game').val(card ? card.tcg_game : 'pokemon');

    $('#inv-card-search-results').empty();
    $('#inv-card-search-input').val('');

    $('#investment-card-modal').addClass('active');
}

$('#close-investment-card-modal').click(() => $('#investment-card-modal').removeClass('active'));

$('#btn-inv-card-search').click(async function() {
    window.searchExternalCard('#inv-card-search-input', '#inv-card-search-results', async function(card) {
        // When a card is selected from combined search
        $('#inv-card-name').val(card.name);
        $('#inv-card-image-url').val(card.high_res || card.image);
        $('#inv-card-set-name').val(card.set || card.set_name || '');
        $('#inv-card-set-number').val(card.number || '');
        $('#inv-card-rarity').val(card.rarity || '');

        // If it already has price/game info from TCGAPI (via searchExternalCard)
        if (card.price !== undefined) {
            $('#inv-card-current-price').val(card.price);
            $('#inv-card-game').val(card.game);
            $('#inv-card-external-id').val(card.external_id || card.id);
        } else {
            // It came from another source (Viking, TCGDex, etc.)
            // Attempt to find price on TCGAPI.dev
            $('#inv-card-current-price').val('Buscando precio...');

            const games = ['pokemon', 'yugioh', 'magic', 'lorcana', 'onepiece'];
            let foundPrice = 0;
            let foundGame = '';
            let foundId = '';

            for (const g of games) {
                const results = await window.searchTCGAPI_internal(card.name, g);
                if (results.length > 0) {
                    // Try to match set if possible
                    const match = results.find(r => r.set === card.set) || results[0];
                    foundPrice = match.price;
                    foundGame = g;
                    foundId = match.external_id;
                    break;
                }
            }

            $('#inv-card-current-price').val(foundPrice || 0);
            $('#inv-card-game').val(foundGame);
            $('#inv-card-external-id').val(foundId);
        }

        Swal.fire({
            title: 'Carta Seleccionada',
            text: card.name,
            icon: 'success',
            timer: 1000,
            showConfirmButton: false
        });
    });
});

$('#btn-save-investment-card').click(async function() {
    const cardData = {
        category_id: currentInvestmentCategoryId,
        user_id: currentUser.id,
        card_name: $('#inv-card-name').val(),
        external_id: $('#inv-card-external-id').val(),
        tcg_game: $('#inv-card-game').val(),
        image_url: $('#inv-card-image-url').val(),
        rarity: $('#inv-card-rarity').val(),
        set_name: $('#inv-card-set-name').val(),
        set_number: $('#inv-card-set-number').val(),
        purchase_price: parseFloat($('#inv-card-purchase-price').val()) || 0,
        current_price: parseFloat($('#inv-card-current-price').val()) || 0,
        quantity: parseInt($('#inv-card-quantity').val()) || 1,
        is_public: $('#inv-card-public').is(':checked')
    };

    if (!cardData.card_name || !cardData.image_url) {
        Swal.fire('Atención', 'Selecciona una carta de los resultados de búsqueda.', 'warning');
        return;
    }

    Swal.fire({ title: 'Guardando...', didOpen: () => Swal.showLoading() });

    try {
        let error;
        if (currentEditingInvCardId) {
            const { error: err } = await _supabase
                .from('investment_cards')
                .update(cardData)
                .eq('id', currentEditingInvCardId);
            error = err;
        } else {
            // Get next position
            cardData.position = localInvestmentCards.length;
            const { error: err } = await _supabase
                .from('investment_cards')
                .insert([cardData]);
            error = err;
        }

        if (error) throw error;

        Swal.fire({ icon: 'success', title: 'Guardado', timer: 1500, showConfirmButton: false });
        $('#investment-card-modal').removeClass('active');
        loadInvestmentCards();

    } catch (e) {
        console.error(e);
        Swal.fire('Error', 'No se pudo guardar la carta.', 'error');
    }
});

async function deleteInvestmentCard(id) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Eliminar carta?',
        text: 'Se quitará esta carta de tus inversiones.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4757',
        confirmButtonText: 'Sí, eliminar'
    });

    if (isConfirmed) {
        const { error } = await _supabase.from('investment_cards').delete().eq('id', id);
        if (error) Swal.fire('Error', 'No se pudo eliminar', 'error');
        else loadInvestmentCards();
    }
}

// Helper used internally for price lookup
window.searchTCGAPI_internal = async function(query, game = 'pokemon') {
    if (!window.TCG_API_KEY) return [];

    try {
        const response = await fetch(`${window.TCG_API_BASE}/search?q=${encodeURIComponent(query)}&game=${game}`, {
            headers: { 'X-API-Key': window.TCG_API_KEY }
        });

        if (!response.ok) return [];

        const data = await response.json();

        return (data.data || []).map(c => ({
            external_id: c.id,
            name: c.name,
            image: c.image_url || `https://images.tcgplayer.com/product/${c.id}_200w.jpg`,
            set: c.set,
            number: c.number,
            rarity: c.rarity,
            price: c.price || c.market_price || 0
        }));
    } catch (e) {
        return [];
    }
};

async function updateCategoryPrices(categoryId) {
    if (!window.TCG_API_KEY) return;

    const { data: cards } = await _supabase
        .from('investment_cards')
        .select('id, external_id, tcg_game')
        .eq('category_id', categoryId);

    if (!cards || cards.length === 0) return;

    for (const card of cards) {
        if (!card.external_id) continue;

        try {
            const response = await fetch(`${window.TCG_API_BASE}/card/${card.external_id}`, {
                headers: { 'X-API-Key': window.TCG_API_KEY }
            });
            if (response.ok) {
                const result = await response.json();
                const data = result.data || result;
                const newPrice = data.price || data.market_price || 0;

                await _supabase
                    .from('investment_cards')
                    .update({ current_price: newPrice })
                    .eq('id', card.id);
            }
        } catch (e) {
            console.warn(`Could not update price for card ${card.id}:`, e);
        }
    }
}
