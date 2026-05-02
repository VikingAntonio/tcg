/**
 * Inversiones (Investments) Module
 * Logic for managing card investments with manual price tracking and history.
 */

// --- STATE ---
let currentInvestmentCategoryId = null;
let currentInvestmentViewMode = 'album'; // 'album', 'slide', 'list'
let localInvestmentCards = [];
let invPriceChart = null;
let invDetailChart = null;
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
            title: 'NUEVO VAULT',
            input: 'text',
            inputLabel: 'NOMBRE DE LA COLECCIÓN',
            inputPlaceholder: 'Ej: POKÉMON VINTAGE HOLOS',
            showCancelButton: true,
            confirmButtonText: 'CREAR',
            cancelButtonText: 'CANCELAR',
            customClass: {
                popup: 'inv-swal-popup',
                confirmButton: 'btn-inv-main',
                cancelButton: 'btn-inv-outline'
            }
        });

        if (name) {
            saveInvestmentCategory({ name: name.toUpperCase() });
        }
    });

    // View Mode Switches
    $(document).on('click', '.btn-inv-mode', function() {
        const mode = $(this).data('mode');
        $('.btn-inv-mode').removeClass('active').css({
            'background': 'transparent',
            'color': '#666',
            'border-radius': '0px'
        });
        $(this).addClass('active').css({
            'background': '#000',
            'color': '#fff',
            'border-radius': '2px'
        });
        currentInvestmentViewMode = mode;
        renderInvestmentCards(mode);
    });

    // Add Card to Investment
    $('#btn-add-investment-card').click(function() {
        openInvestmentCardModal(null, 'inv-tab-datos');
    });

    // Modal Tabs logic
    $(document).on('click', '#investment-card-modal .inv-tab-link', function() {
        const tabId = $(this).data('tab');
        $('#investment-card-modal .inv-tab-link').removeClass('active');
        $(this).addClass('active');
        $('#investment-card-modal .slot-tab-content').removeClass('active');
        $(`#${tabId}`).addClass('active');

        if (tabId === 'inv-tab-movimientos' && currentEditingInvCardId) {
            renderPriceHistoryChart(currentEditingInvCardId);
        }
        if (tabId === 'inv-tab-resumen' && currentEditingInvCardId) {
            const card = localInvestmentCards.find(c => c.id === currentEditingInvCardId);
            if (card) updateSummaryTab(card);
        }
    });

    $('#btn-inv-add-price').click(async function() {
        if (!currentEditingInvCardId) return;

        const { value: newPrice } = await Swal.fire({
            title: 'NUEVO PRECIO DE MERCADO',
            input: 'number',
            inputLabel: 'VALOR ACTUAL ($)',
            inputPlaceholder: '0.00',
            showCancelButton: true,
            confirmButtonText: 'ACTUALIZAR',
            cancelButtonText: 'CANCELAR',
            customClass: {
                popup: 'inv-swal-popup',
                confirmButton: 'btn-inv-main',
                cancelButton: 'btn-inv-outline'
            }
        });

        if (newPrice !== undefined && newPrice !== '') {
            saveNewPrice(currentEditingInvCardId, parseFloat(newPrice));
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
                    <img src="https://images.unsplash.com/photo-1613771404721-1f92d799e49f?q=80&w=800&auto=format&fit=crop" alt="preview">
                </div>
                <div class="inv-category-info">
                    <div>
                        <h3>${escapeHtml(cat.name)}</h3>
                        <div class="inv-category-meta">Colección de Activos TCG</div>
                    </div>

                    <div class="inv-category-public-toggle">
                        <label class="switch">
                            <input type="checkbox" class="toggle-inv-cat-public" data-id="${cat.id}" ${isPublic ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                        <span style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em;">${isPublic ? 'Público' : 'Privado'}</span>
                    </div>

                    <div style="display: flex; gap: 8px; margin-top: 15px;">
                        <button class="btn-inv-main btn-view-inv-cat" style="flex: 1;">GESTIONAR</button>
                        <button class="btn-inv-outline btn-edit-inv-cat"><i class="fas fa-pen"></i></button>
                        <button class="btn-inv-danger btn-delete-inv-cat"><i class="fas fa-trash"></i></button>
                    </div>
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
    Swal.fire({
        title: 'CREATING VAULT...',
        didOpen: () => Swal.showLoading(),
        customClass: { popup: 'inv-swal-popup' }
    });

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
        Swal.fire({
            title: 'ERROR',
            text: 'Could not update vault.',
            icon: 'error',
            customClass: { popup: 'inv-swal-popup' }
        });
    } else if (refresh) {
        loadInvestmentCategories();
    }
}

async function editInvestmentCategory(cat) {
    const { value: name } = await Swal.fire({
        title: 'RENAME VAULT',
        input: 'text',
        inputValue: cat.name,
        showCancelButton: true,
        confirmButtonText: 'UPDATE',
        cancelButtonText: 'CANCEL',
        customClass: {
            popup: 'inv-swal-popup',
            confirmButton: 'btn-inv-main',
            cancelButton: 'btn-inv-outline'
        }
    });

    if (name && name !== cat.name) {
        updateInvestmentCategory(cat.id, { name: name.toUpperCase() }, true);
    }
}

async function deleteInvestmentCategory(id) {
    const { isConfirmed } = await Swal.fire({
        title: 'DESTROY VAULT?',
        text: 'All assets inside this collection will be permanently removed.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'CONFIRM DESTRUCTION',
        cancelButtonText: 'CANCEL',
        customClass: {
            popup: 'inv-swal-popup',
            confirmButton: 'btn-inv-danger',
            cancelButton: 'btn-inv-outline'
        }
    });

    if (isConfirmed) {
        const { error } = await _supabase.from('investment_categories').delete().eq('id', id);
        if (error) {
            Swal.fire({
                title: 'ERROR',
                text: 'Could not delete vault.',
                icon: 'error',
                customClass: { popup: 'inv-swal-popup' }
            });
        } else {
            loadInvestmentCategories();
        }
    }
}

// --- CARD FUNCTIONS ---

async function openInvestmentCategory(cat) {
    currentInvestmentCategoryId = cat.id;
    $('#inv-category-title').text(cat.name.toUpperCase());
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

function getTrendIcon(current, previous, showPercentage = false) {
    if (previous === undefined || previous === null || current === previous || previous === 0) return '';
    const isUp = current > previous;
    const iconClass = isUp ? 'fa-arrow-up' : 'fa-arrow-down';
    const color = isUp ? '#00ff88' : '#ff4757';
    let html = `<i class="fas ${iconClass}" style="color: ${color}; margin-left: 10px; font-size: 1.2rem;"></i>`;

    if (showPercentage) {
        const percent = ((current - previous) / previous) * 100;
        const sign = percent > 0 ? '+' : '';
        html += `<span style="color: ${color}; font-weight: 800; font-size: 1rem; margin-left: 5px;">${sign}${percent.toFixed(2)}%</span>`;
    }

    return html;
}

function renderAlbumMode($container) {
    $container.addClass('investment-album-layout').removeClass('investment-list-layout investment-slide-layout');
    const isMobile = window.innerWidth <= 768;
    const { width, height } = window.getAlbumSize($container);
    const $albumWrapper = $(`<div class="album-wrapper" style="width: ${width}px; height: ${height}px;"><div class="album investment-album"></div></div>`);
    const $album = $albumWrapper.find('.album');

    $container.append($albumWrapper);

    // Cover
    $album.append(`
        <div class="page cover-page">
            <div class="textured-cover" style="background-color: #000000; display: flex; flex-direction: column; align-items: center; justify-content: center; border: ${isMobile ? '5px' : '10px'} solid #111;">
                <h2 style="color:white; text-align:center; padding: 10%; font-size: ${isMobile ? '1rem' : '1.5rem'}; letter-spacing: 0.1em; border-top: 1px solid white; border-bottom: 1px solid white; width: 80%;">${escapeHtml($('#inv-category-title').text()).toUpperCase()}</h2>
                <div style="text-align:center; color:rgba(255,255,255,0.7); font-size: 0.5rem; letter-spacing: 0.3em; margin-top: 10px; font-weight: 800;">VAULT COLLECTION</div>
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
            // Rename to .inv-card-slot to avoid global admin.js click listeners
            const $slot = $('<div class="inv-card-slot" style="position: relative;"></div>');
            if (card) {
                const trend = getTrendIcon(card.current_price, card.previous_price);
                $slot.append(`
                    <img src="${card.image_url}" class="tcg-card" style="border-radius: 4px; border: 1px solid #000; width: 100%; height: 100%; object-fit: contain;">
                    <div class="inv-card-info-badge" style="background: #000; border-radius: 2px; position: absolute; top: 5px; left: 5px; padding: 2px 5px; color: white; font-size: 10px; font-weight: 800; z-index: 5;">$${parseFloat(card.current_price || 0).toFixed(2)} ${trend}</div>
                    <div class="zoom-btn"><i class="fas fa-search"></i></div>
                `);

                $slot.find('.zoom-btn').on('click mousedown touchstart', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation(); // Force stop Turn.js from seeing this
                    if (e.type === 'click') {
                        openInvestmentCardModal(card);
                    }
                });

                $slot.click(function(e) {
                    const isMobile = window.innerWidth <= 768;
                    const isZoomBtn = $(e.target).closest('.zoom-btn').length > 0;

                    if (isMobile) {
                        // En móvil, si no es la lupa, no hacemos nada (permitimos que el evento suba para el flip)
                        if (isZoomBtn) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    } else {
                        // En desktop, permitimos abrir el modal al clickear cualquier parte de la carta
                        if (!isZoomBtn) {
                            openInvestmentCardModal(card);
                        }
                    }
                });
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
            <div class="textured-cover" style="background-color: #000000"></div>
        </div>
    `);

    setTimeout(() => {
        if ($album.turn('is')) {
            $album.turn('destroy');
        }
        $album.turn({
            width: width,
            height: height,
            autoCenter: true,
            display: isMobile ? 'single' : 'double',
            acceleration: true,
            elevation: 50,
            duration: 800,
            when: {
                turning: function(e, page, view) {
                    // Prevent page jumps by forcing fixed position
                    $(this).css('position', 'relative');
                }
            }
        });

        // Manual centering fix
        $album.css({
            'margin-left': 'auto',
            'margin-right': 'auto'
        });
    }, 200);
}

function renderSlideMode($container) {
    $container.addClass('investment-slide-layout').removeClass('investment-list-layout investment-album-layout');
    const isMobile = window.innerWidth <= 768;
    const swiperId = `inv-swiper-${Date.now()}`;
    const swiperWidth = isMobile ? '260px' : '350px';
    const swiperHeight = isMobile ? '420px' : '500px';

    const $swiper = $(`
        <div class="swiper ${swiperId}" style="width: 100%; max-width: ${swiperWidth}; margin: 0 auto; height: ${swiperHeight}; padding: 20px 0;">
            <div class="swiper-wrapper">
                ${localInvestmentCards.map(card => {
                    const trend = getTrendIcon(card.current_price, card.previous_price);
                    return `
                    <div class="swiper-slide inv-card-slot inv-card-item" data-id="${card.id}" style="background: transparent; cursor: pointer;">
                        <img src="${card.image_url}" style="width: 100%; border-radius: 4px; border: 2px solid #000; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
                        <div class="inv-card-info-overlay" style="background: rgba(255,255,255,0.95); padding: ${isMobile ? '10px' : '20px'}; border-radius: 4px; border: 1px solid #000; margin-top: ${isMobile ? '10px' : '15px'}; text-align: center;">
                            <h4 style="margin: 0; font-weight: 800; text-transform: uppercase; color: #000; font-size: ${isMobile ? '0.8rem' : '0.9rem'};">${escapeHtml(card.card_name)}</h4>
                            <p style="margin: 5px 0; font-size: 0.7rem; color: #666; font-weight: 700; text-transform: uppercase;">${escapeHtml(card.set_name)} - ${escapeHtml(card.rarity)}</p>
                            <div class="inv-price-tag" style="font-weight: 900; color: #000; font-size: 1rem; margin-top: 10px;">$${parseFloat(card.current_price || 0).toFixed(2)} ${trend}</div>
                            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 15px;">
                                <button class="btn-inv-outline btn-edit-inv-card-slide" data-id="${card.id}"><i class="fas fa-pen"></i></button>
                                <button class="btn-inv-danger btn-delete-inv-card-slide" data-id="${card.id}"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    </div>
                `}).join('')}
            </div>
        </div>
    `);
    $container.append($swiper);

    $swiper.find('.inv-card-item').click(function(e) {
        if ($(e.target).closest('button').length) return;
        e.preventDefault();
        e.stopPropagation();
        const id = $(this).data('id');
        const card = localInvestmentCards.find(c => c.id === id);
        openInvestmentCardModal(card);
    });

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
    const $list = $('<div class="inv-list-container" style="margin: 20px 0;"></div>');

    localInvestmentCards.forEach(card => {
        const diff = (card.current_price || 0) - (card.purchase_price || 0);
        const diffClass = diff >= 0 ? 'price-up' : 'price-down';
        const trend = getTrendIcon(card.current_price, card.previous_price);
        const $item = $(`
            <div class="inv-list-item" style="border: 1px solid #eee; border-radius: 4px; padding: 15px; background: white; margin-bottom: 10px; display: flex; align-items: center; gap: 20px; cursor: pointer;">
                <img src="${card.image_url}" class="inv-list-thumb" style="width: 60px; height: 84px; object-fit: contain; border: 1px solid #000; border-radius: 2px;">
                <div class="inv-list-details" style="flex: 1;">
                    <div class="inv-list-name" style="font-weight: 800; text-transform: uppercase; font-size: 0.9rem; color: #000;">${escapeHtml(card.card_name)}</div>
                    <div class="inv-list-set" style="font-size: 0.7rem; color: #666; font-weight: 700; text-transform: uppercase;">${escapeHtml(card.set_name)} - ${escapeHtml(card.rarity)}</div>
                </div>
                <div class="inv-list-prices" style="display: flex; gap: 30px; text-align: right;">
                    <div class="inv-price-row" style="display: flex; flex-direction: column;"><span style="font-size: 0.6rem; text-transform: uppercase; color: #999;">Purchase</span> <b style="color: #000;">$${parseFloat(card.purchase_price || 0).toFixed(2)}</b></div>
                    <div class="inv-price-row" style="display: flex; flex-direction: column;"><span style="font-size: 0.6rem; text-transform: uppercase; color: #999;">Market</span> <b class="${diffClass}" style="color: #000;">$${parseFloat(card.current_price || 0).toFixed(2)} ${trend}</b></div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-inv-outline btn-edit-inv-card" data-id="${card.id}" style="padding: 8px 12px;"><i class="fas fa-pen"></i></button>
                    <button class="btn-inv-danger btn-delete-inv-card" data-id="${card.id}" style="padding: 8px 12px;"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `);
        $item.click((e) => {
            if ($(e.target).closest('button').length) return;
            e.preventDefault();
            e.stopPropagation();
            openInvestmentCardModal(card);
        });
        $item.find('.btn-edit-inv-card').click(() => openInvestmentCardModal(card));
        $item.find('.btn-delete-inv-card').click(() => deleteInvestmentCard(card.id));
        $list.append($item);
    });
    $container.append($list);
}

// --- CARD MODAL & API ---

let currentEditingInvCardId = null;

function openInvestmentCardModal(card = null, defaultTab = 'inv-tab-resumen') {
    currentEditingInvCardId = card ? card.id : null;
    currentInvExtraImages = card ? (card.extra_images || []) : [];

    // Reset Tabs
    $('#investment-card-modal .inv-tab-link').removeClass('active');
    $(`#investment-card-modal .inv-tab-link[data-tab="${defaultTab}"]`).addClass('active');
    $('#investment-card-modal .slot-tab-content').removeClass('active');
    $(`#${defaultTab}`).addClass('active');

    if (!card) {
        // New Card Mode
        $('#inv-card-modal-title').text('AÑADIR NUEVO ACTIVO');
        $('#investment-card-modal .inv-tab-link[data-tab="inv-tab-resumen"]').hide();
        $('#inv-card-search-container').show(); // Show search when adding new
        // If it was the default, switch to datos
        if (defaultTab === 'inv-tab-resumen') {
            $('#investment-card-modal .inv-tab-link[data-tab="inv-tab-datos"]').addClass('active');
            $('#inv-tab-resumen').removeClass('active');
            $('#inv-tab-datos').addClass('active');
        }
    } else {
        $('#investment-card-modal .inv-tab-link[data-tab="inv-tab-resumen"]').show();
        $('#inv-card-search-container').hide(); // Hide search when editing
        updateSummaryTab(card);
    }

    // Populate Fields
    $('#inv-card-modal-title').text(card ? card.card_name.toUpperCase() : 'NUEVO ACTIVO');
    $('#inv-card-name').val(card ? card.card_name.toUpperCase() : '');
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
        $('#inv-card-name').val(card.name.toUpperCase());
        $('#inv-card-image-url').val(card.high_res || card.image);
        $('#inv-card-set-name').val(card.set || card.set_name || '');
        $('#inv-card-set-number').val(card.number || '');
        $('#inv-card-rarity').val(card.rarity || '');
        $('#inv-card-rarity-input').val(card.rarity || '');
        $('#inv-card-current-price').val(card.price || 0);
        $('#inv-card-game').val(card.game || 'pokemon');
        $('#inv-card-external-id').val(card.external_id || card.id || '');

        Swal.fire({
            title: 'ASSET SELECTED',
            text: card.name,
            icon: 'success',
            timer: 1000,
            showConfirmButton: false,
            customClass: { popup: 'inv-swal-popup' }
        });
    });
});

$('#btn-save-investment-card').click(async function() {
    const newPrice = parseFloat($('#inv-card-current-price').val()) || 0;

    const cardData = {
        category_id: currentInvestmentCategoryId,
        user_id: currentUser.id,
        card_name: $('#inv-card-name').val().toUpperCase(),
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
        Swal.fire({
            title: 'ATTENTION',
            text: 'Select a card or enter required data.',
            icon: 'warning',
            customClass: { popup: 'inv-swal-popup' }
        });
        return;
    }

    Swal.fire({
        title: 'SAVING ASSET...',
        didOpen: () => Swal.showLoading(),
        customClass: { popup: 'inv-swal-popup' }
    });

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
                currentEditingInvCardId = finalCardId; // Update state to "editing"
                // Log initial history
                await _supabase.from('investment_price_history').insert([{
                    card_id: finalCardId,
                    price: newPrice
                }]);
            }
        }

        if (error) throw error;

        Swal.fire({
            icon: 'success',
            title: 'ACTIVO GUARDADO',
            timer: 1500,
            showConfirmButton: false,
            customClass: { popup: 'inv-swal-popup' }
        });

        // Update local state and UI
        const { data: updatedCard } = await _supabase.from('investment_cards').select('*').eq('id', finalCardId).single();
        const idx = localInvestmentCards.findIndex(c => c.id === finalCardId);
        if (idx !== -1) {
            localInvestmentCards[idx] = updatedCard;
        } else {
            localInvestmentCards.push(updatedCard);
        }

        updateSummaryTab(updatedCard);
        renderInvestmentCards(currentInvestmentViewMode);

        // Hide search bar now that asset is loaded/saved
        $('#inv-card-search-container').hide();

        // Show summary tab after saving
        $('#investment-card-modal .inv-tab-link[data-tab="inv-tab-resumen"]').show().click();

    } catch (e) {
        console.error(e);
        Swal.fire({
            title: 'ERROR',
            text: 'Could not save asset.',
            icon: 'error',
            customClass: { popup: 'inv-swal-popup' }
        });
    }
});

async function deleteInvestmentCard(id) {
    const { isConfirmed } = await Swal.fire({
        title: 'LIQUIDATE ASSET?',
        text: 'This action will remove the card from your vault.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'CONFIRM DELETE',
        cancelButtonText: 'CANCEL',
        customClass: {
            popup: 'inv-swal-popup',
            confirmButton: 'btn-inv-danger',
            cancelButton: 'btn-inv-outline'
        }
    });

    if (isConfirmed) {
        const { error } = await _supabase.from('investment_cards').delete().eq('id', id);
        if (error) {
            Swal.fire({
                title: 'ERROR',
                text: 'Could not remove asset.',
                icon: 'error',
                customClass: { popup: 'inv-swal-popup' }
            });
        } else {
            loadInvestmentCards();
        }
    }
}

function updateSummaryTab(card) {
    $('#inv-card-modal-title').text('ASSET DETAILS');
    $('#inv-detail-name').text(card.card_name.toUpperCase());
    $('#inv-detail-image').attr('src', card.image_url);

    const setInfo = (card.set_name || 'UNKNOWN EXPANSION').toUpperCase();
    const rarityInfo = (card.rarity || 'UNKNOWN RARITY').toUpperCase();
    $('#inv-detail-set').text(`${setInfo} - ${rarityInfo}`);

    $('#inv-detail-price').text(`$${parseFloat(card.current_price || 0).toFixed(2)}`);

    const trendIcon = getTrendIcon(card.current_price, card.previous_price, true);
    $('#inv-detail-trend').html(trendIcon);

    // Load History Chart for summary
    renderPriceHistoryChart(card.id, true);
}

async function saveNewPrice(cardId, newPrice) {
    Swal.fire({ title: 'Actualizando precio...', didOpen: () => Swal.showLoading(), customClass: { popup: 'inv-swal-popup' } });

    try {
        const oldCard = localInvestmentCards.find(c => c.id === cardId);
        const previousPrice = oldCard ? oldCard.current_price : 0;

        // 1. Insert history
        await _supabase.from('investment_price_history').insert([{
            card_id: cardId,
            price: newPrice
        }]);

        // 2. Update card
        const { error } = await _supabase
            .from('investment_cards')
            .update({
                current_price: newPrice,
                previous_price: previousPrice
            })
            .eq('id', cardId);

        if (error) throw error;

        // 3. Refresh local data and UI
        const { data: updatedCard } = await _supabase.from('investment_cards').select('*').eq('id', cardId).single();
        const idx = localInvestmentCards.findIndex(c => c.id === cardId);
        if (idx !== -1) localInvestmentCards[idx] = updatedCard;

        updateSummaryTab(updatedCard);
        renderPriceHistoryChart(cardId); // Main chart
        renderInvestmentCards(currentInvestmentViewMode);

        Swal.fire({ icon: 'success', title: 'Precio Actualizado', timer: 1000, showConfirmButton: false, customClass: { popup: 'inv-swal-popup' } });

    } catch (e) {
        console.error(e);
        Swal.fire({ title: 'Error', text: 'No se pudo actualizar el precio', icon: 'error', customClass: { popup: 'inv-swal-popup' } });
    }
}

async function renderPriceHistoryChart(cardId, isDetail = false) {
    const { data: history, error } = await _supabase
        .from('investment_price_history')
        .select('*')
        .eq('card_id', cardId)
        .order('recorded_at', { ascending: true });

    if (error || !history) return;

    const canvasId = isDetail ? 'inv-detail-chart' : 'inv-price-chart';
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (isDetail) {
        if (invDetailChart) invDetailChart.destroy();
    } else {
        if (invPriceChart) invPriceChart.destroy();
    }

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(h => new Date(h.recorded_at).toLocaleDateString()),
            datasets: [{
                label: 'Market Price',
                data: history.map(h => h.price),
                borderColor: '#000000',
                borderWidth: 3,
                backgroundColor: 'rgba(0, 0, 0, 0.03)',
                fill: true,
                tension: 0.2,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#000000',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: '#f5f5f5' },
                    ticks: { color: '#000', font: { weight: '800', size: 11 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#999', font: { size: 10, weight: '600' } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#000',
                    titleFont: { size: 12, weight: 'bold' },
                    bodyFont: { size: 12 },
                    padding: 10,
                    cornerRadius: 2,
                    displayColors: false
                }
            }
        }
    });

    if (isDetail) {
        invDetailChart = chart;
    } else {
        invPriceChart = chart;
    }

    // Render list history (cloning to avoid in-place reversal issues)
    const listId = isDetail ? '#inv-detail-history-list' : '#inv-history-list';
    const $list = $(listId);
    $list.empty();
    [...history].reverse().forEach(h => {
        $list.append(`
            <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 10px 0; border-bottom: 1px solid #f1f2f6; color: #2d3436;">
                <span>${new Date(h.recorded_at).toLocaleString()}</span>
                <b>$${parseFloat(h.price).toFixed(2)}</b>
            </div>
        `);
    });
}
