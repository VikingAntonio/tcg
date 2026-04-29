/**
 * Inversiones (Investments) Module
 * Logic for managing card investments with manual price tracking and history.
 */

// --- STATE ---
let currentInvestmentCategoryId = null;
let currentInvestmentViewMode = 'album'; // 'album', 'slide', 'list'
let localInvestmentCards = [];
let invPriceChart = null;
let currentInvExtraImages = [];

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

    // Modal Tabs logic
    $(document).on('click', '#investment-card-modal .slot-tab-btn', function() {
        const tabId = $(this).data('tab');
        $('#investment-card-modal .slot-tab-btn').removeClass('active');
        $(this).addClass('active');
        $('#investment-card-modal .slot-tab-content').removeClass('active');
        $(`#${tabId}`).addClass('active');

        if (tabId === 'inv-tab-movimientos' && currentEditingInvCardId) {
            renderPriceHistoryChart(currentEditingInvCardId);
        }
    });

    // Drag & Drop for extra images
    const $dropZone = $('#drop-zone-inv-extra');
    $dropZone.on('dragover', function(e) { e.preventDefault(); $(this).addClass('dragover'); });
    $dropZone.on('dragleave', function() { $(this).removeClass('dragover'); });
    $dropZone.on('drop', async function(e) {
        e.preventDefault();
        $(this).removeClass('dragover');
        const files = e.originalEvent.dataTransfer.files;
        handleInvExtraImages(files);
    });

    $('#input-inv-extra-files').on('change', function() {
        handleInvExtraImages(this.files);
    });
}

async function handleInvExtraImages(files) {
    if (!files.length) return;
    Swal.fire({ title: 'Subiendo imágenes...', didOpen: () => Swal.showLoading() });

    for (const file of files) {
        try {
            // Reusing cloudinary logic from js/cloudinary-upload.js
            const url = await CloudinaryUpload.uploadImage(file);
            if (url) {
                currentInvExtraImages.push(url);
            }
        } catch (e) {
            console.error("Error uploading extra image:", e);
        }
    }
    renderInvExtraImagesPreview();
    Swal.close();
}

function renderInvExtraImagesPreview() {
    const $container = $('#inv-extra-images-preview');
    $container.empty();
    currentInvExtraImages.forEach((url, idx) => {
        const $item = $(`
            <div style="position: relative; width: 80px; height: 80px;">
                <img src="${url}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">
                <button class="btn-danger" style="position: absolute; top: -5px; right: -5px; padding: 2px 5px; font-size: 10px; border-radius: 50%;" onclick="removeInvExtraImage(${idx})">&times;</button>
            </div>
        `);
        $container.append($item);
    });
}

window.removeInvExtraImage = function(idx) {
    currentInvExtraImages.splice(idx, 1);
    renderInvExtraImagesPreview();
};

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
            <div class="inv-category-item" data-id="${cat.id}">
                <div class="inv-category-preview">
                    <i class="fas fa-chart-pie fa-3x"></i>
                </div>
                <div class="inv-category-info">
                    <h3>${escapeHtml(cat.name)}</h3>

                    <div class="inv-category-public-toggle">
                        <label class="switch">
                            <input type="checkbox" class="toggle-inv-cat-public" data-id="${cat.id}" ${isPublic ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                        <span>${isPublic ? 'Público' : 'Privado'}</span>
                    </div>
                </div>

                <div class="inv-category-actions">
                    <button class="btn-primary-modern btn-view-inv-cat" style="flex: 1;">VER</button>
                    <button class="btn-secondary-modern btn-edit-inv-cat"><i class="fas fa-edit"></i></button>
                    <button class="btn-danger-modern btn-delete-inv-cat"><i class="fas fa-trash"></i></button>
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

function getTrendIcon(current, previous) {
    if (previous === undefined || previous === null || current === previous) return '';
    const isUp = current > previous;
    return `<i class="fas fa-chart-line" style="color: ${isUp ? '#00ff88' : '#ff4757'}; margin-left: 5px;"></i>`;
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
                const trend = getTrendIcon(card.current_price, card.previous_price);
                $slot.append(`
                    <img src="${card.image_url}" class="tcg-card">
                    <div class="inv-card-info-badge">$${parseFloat(card.current_price || 0).toFixed(2)} ${trend}</div>
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
                ${localInvestmentCards.map(card => {
                    const trend = getTrendIcon(card.current_price, card.previous_price);
                    return `
                    <div class="swiper-slide card-slot inv-card-item" data-id="${card.id}">
                        <img src="${card.image_url}" style="width: 100%; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                        <div class="inv-card-info-overlay">
                            <h4>${escapeHtml(card.card_name)}</h4>
                            <p>${escapeHtml(card.set_name)} - ${escapeHtml(card.rarity)}</p>
                            <div class="inv-price-tag">Actual: $${parseFloat(card.current_price || 0).toFixed(2)} ${trend}</div>
                            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 10px;">
                                <button class="btn btn-sm btn-edit-inv-card-slide" data-id="${card.id}"><i class="fas fa-edit"></i></button>
                                <button class="btn btn-sm btn-danger btn-delete-inv-card-slide" data-id="${card.id}"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    </div>
                `}).join('')}
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
        const trend = getTrendIcon(card.current_price, card.previous_price);
        const $item = $(`
            <div class="inv-list-item">
                <img src="${card.image_url}" class="inv-list-thumb">
                <div class="inv-list-details">
                    <div class="inv-list-name">${escapeHtml(card.card_name)}</div>
                    <div class="inv-list-set">${escapeHtml(card.set_name)} - ${escapeHtml(card.rarity)}</div>
                </div>
                <div class="inv-list-prices">
                    <div class="inv-price-row"><span>Compra:</span> <b>$${parseFloat(card.purchase_price || 0).toFixed(2)}</b></div>
                    <div class="inv-price-row"><span>Actual:</span> <b class="${diffClass}">$${parseFloat(card.current_price || 0).toFixed(2)} ${trend}</b></div>
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
    currentInvExtraImages = card ? (card.extra_images || []) : [];

    // Reset Tabs
    $('#investment-card-modal .slot-tab-btn').removeClass('active');
    $('#investment-card-modal .slot-tab-btn[data-tab="inv-tab-datos"]').addClass('active');
    $('#investment-card-modal .slot-tab-content').removeClass('active');
    $('#inv-tab-datos').addClass('active');

    // Populate Fields
    $('#inv-card-modal-title').text(card ? 'Editar Inversión' : 'Añadir Carta a Inversión');
    $('#inv-card-name').val(card ? card.card_name : '');
    $('#inv-card-purchase-price').val(card ? card.purchase_price : '');
    $('#inv-card-current-price').val(card ? card.current_price : '');
    $('#inv-card-quantity').val(card ? card.quantity : 1);
    $('#inv-card-rarity-input').val(card ? card.rarity : '');
    $('#inv-card-notes').val(card ? card.notes : '');

    $('#inv-card-external-id').val(card ? card.external_id : '');
    $('#inv-card-image-url').val(card ? card.image_url : '');
    $('#inv-card-set-name').val(card ? card.set_name : '');
    $('#inv-card-set-number').val(card ? card.set_number : '');
    $('#inv-card-rarity').val(card ? card.rarity : '');
    $('#inv-card-game').val(card ? card.tcg_game : 'pokemon');

    $('#inv-card-search-results').empty();
    $('#inv-card-search-input').val('');

    renderInvExtraImagesPreview();

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
        $('#inv-card-rarity-input').val(card.rarity || '');
        $('#inv-card-current-price').val(card.price || 0);
        $('#inv-card-game').val(card.game || 'pokemon');
        $('#inv-card-external-id').val(card.external_id || card.id || '');

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
    const newPrice = parseFloat($('#inv-card-current-price').val()) || 0;

    const cardData = {
        category_id: currentInvestmentCategoryId,
        user_id: currentUser.id,
        card_name: $('#inv-card-name').val(),
        external_id: $('#inv-card-external-id').val(),
        tcg_game: $('#inv-card-game').val(),
        image_url: $('#inv-card-image-url').val(),
        rarity: $('#inv-card-rarity-input').val(),
        set_name: $('#inv-card-set-name').val(),
        set_number: $('#inv-card-set-number').val(),
        purchase_price: parseFloat($('#inv-card-purchase-price').val()) || 0,
        current_price: newPrice,
        quantity: parseInt($('#inv-card-quantity').val()) || 1,
        notes: $('#inv-card-notes').val(),
        extra_images: currentInvExtraImages
    };

    if (!cardData.card_name || !cardData.image_url) {
        Swal.fire('Atención', 'Selecciona una carta de los resultados de búsqueda o ingresa los datos mínimos.', 'warning');
        return;
    }

    Swal.fire({ title: 'Guardando...', didOpen: () => Swal.showLoading() });

    try {
        let error;
        let finalCardId = currentEditingInvCardId;

        if (currentEditingInvCardId) {
            // Check if price changed to update previous_price and history
            const oldCard = localInvestmentCards.find(c => c.id === currentEditingInvCardId);
            if (oldCard && oldCard.current_price !== newPrice) {
                cardData.previous_price = oldCard.current_price;
                // Log history
                await _supabase.from('investment_price_history').insert([{
                    card_id: currentEditingInvCardId,
                    price: newPrice
                }]);
            }

            const { error: err } = await _supabase
                .from('investment_cards')
                .update(cardData)
                .eq('id', currentEditingInvCardId);
            error = err;
        } else {
            cardData.position = localInvestmentCards.length;
            const { data: newCards, error: err } = await _supabase
                .from('investment_cards')
                .insert([cardData])
                .select();
            error = err;
            if (!error && newCards.length > 0) {
                finalCardId = newCards[0].id;
                // Log initial history
                await _supabase.from('investment_price_history').insert([{
                    card_id: finalCardId,
                    price: newPrice
                }]);
            }
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

async function renderPriceHistoryChart(cardId) {
    const { data: history, error } = await _supabase
        .from('investment_price_history')
        .select('*')
        .eq('card_id', cardId)
        .order('recorded_at', { ascending: true });

    if (error || !history) return;

    const ctx = document.getElementById('inv-price-chart').getContext('2d');

    if (invPriceChart) invPriceChart.destroy();

    invPriceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(h => new Date(h.recorded_at).toLocaleDateString()),
            datasets: [{
                label: 'Precio Mercado',
                data: history.map(h => h.price),
                borderColor: '#00d2ff',
                backgroundColor: 'rgba(0, 210, 255, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: false, grid: { color: '#f1f2f6' }, ticks: { color: '#2d3436' } },
                x: { grid: { color: '#f1f2f6' }, ticks: { color: '#2d3436' } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });

    // Render list history
    const $list = $('#inv-history-list');
    $list.empty();
    history.reverse().forEach(h => {
        $list.append(`
            <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 10px 0; border-bottom: 1px solid #f1f2f6; color: #2d3436;">
                <span>${new Date(h.recorded_at).toLocaleString()}</span>
                <b>$${parseFloat(h.price).toFixed(2)}</b>
            </div>
        `);
    });
}
