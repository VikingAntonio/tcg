/**
 * Inversiones (Investments) Module
 * Logic for managing card investments with manual price tracking and history.
 */

// --- STATE ---
let currentInvestmentCategoryId = null;
let currentInvestmentCategory = null;
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
    // Navigation to Investments (Removido para redirección nativa)

    // Back to Dashboard
    $(document).on('click', '#btn-back-to-main-from-investments', function(e) {
        e.preventDefault();
        showView('main-dashboard');
    });

    // Back to Categories from Details
    $(document).on('click', '#btn-back-to-investments, #btn-back-to-investments-mobile', function(e) {
        e.preventDefault();
        showView('investments');
        // Ensure side panel is closed
        $('#inv-mobile-side-panel, #inv-side-panel-overlay').removeClass('active');
    });

    // Mobile Side Panel Toggle
    $(document).on('click', '#inv-side-panel-tab', function() {
        $('#inv-mobile-side-panel, #inv-side-panel-overlay').toggleClass('active');
    });

    $(document).on('click', '#inv-side-panel-overlay', function() {
        $('#inv-mobile-side-panel, #inv-side-panel-overlay').removeClass('active');
    });

    // Create Category with Grid Layout Selector
    $('#btn-create-investment-category').click(async function() {
        const { value: formValues } = await Swal.fire({
            title: 'NUEVO VAULT',
            html: `
                <div style="text-align: left; display: flex; flex-direction: column; gap: 15px; padding-top: 10px;">
                    <div>
                        <label style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #333; display: block; margin-bottom: 5px;">Nombre de la Colección</label>
                        <input id="swal-inv-vault-name" class="swal2-input" placeholder="Ej: POKÉMON VINTAGE HOLOS" style="margin: 0; width: 100%; box-sizing: border-box;">
                    </div>
                    <div>
                        <label style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #333; display: block; margin-bottom: 5px;">Tamaño de Carpeta (Layout)</label>
                        <select id="swal-inv-vault-layout" class="swal2-select" style="margin: 0; width: 100%; padding: 10px; border-radius: 4px; border: 1px solid #ccc; font-weight: 700;">
                            <option value="3x3" selected>3x3 (9 Cartas)</option>
                            <option value="4x3">4x3 (12 Cartas)</option>
                            <option value="4x4">4x4 (16 Cartas)</option>
                            <option value="2x2">2x2 (4 Cartas)</option>
                            <option value="1x1">1x1 (1 Carta)</option>
                        </select>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'CREAR',
            cancelButtonText: 'CANCELAR',
            customClass: {
                popup: 'inv-swal-popup',
                confirmButton: 'btn-inv-main',
                cancelButton: 'btn-inv-outline'
            },
            preConfirm: () => {
                const name = $('#swal-inv-vault-name').val().trim();
                const layout = $('#swal-inv-vault-layout').val() || '3x3';
                if (!name) {
                    Swal.showValidationMessage('Ingresa un nombre para la colección');
                    return false;
                }
                return { name: name.toUpperCase(), grid_layout: layout };
            }
        });

        if (formValues) {
            saveInvestmentCategory(formValues);
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

        // Sync desktop and mobile buttons
        $(`.btn-inv-mode[data-mode="${mode}"]`).addClass('active').css({
            'background': '#000',
            'color': '#fff',
            'border-radius': '2px'
        });

        currentInvestmentViewMode = mode;
        renderInvestmentCards(mode);

        // Close side panel on mobile after selection
        if (window.innerWidth <= 768) {
            $('#inv-mobile-side-panel, #inv-side-panel-overlay').removeClass('active');
        }
    });

    // Add Card to Investment
    $(document).on('click', '#btn-add-investment-card, #btn-add-investment-card-mobile', function() {
        openInvestmentCardModal(null, 'inv-tab-datos');
        // Close side panel on mobile
        $('#inv-mobile-side-panel, #inv-side-panel-overlay').removeClass('active');
    });

    // Auto-clear or select-all on focus for price and quantity inputs to avoid annoying manual backspacing
    $(document).on('focus', '#inv-card-purchase-price, #inv-card-current-price, #inv-card-sale-price, #inv-card-quantity', function() {
        const val = $(this).val().trim();
        if (val === '0' || val === '0.0' || val === '0.00' || val === '0.000') {
            $(this).val('');
        } else if (val !== '') {
            $(this).select();
        }
    });

    // Modal Tabs logic
    $(document).on('click', '#investment-card-modal .inv-tab-link', function() {
        const tabId = $(this).data('tab');
        $('#investment-card-modal .inv-tab-link').removeClass('active');
        $(this).addClass('active');
        $('#investment-card-modal .slot-tab-content').removeClass('active');
        $(`#${tabId}`).addClass('active');

        if (tabId === 'inv-tab-resumen' && currentEditingInvCardId) {
            const card = localInvestmentCards.find(c => c.id === currentEditingInvCardId);
            if (card) updateSummaryTab(card);
        }
        if (tabId === 'inv-tab-datos') {
            syncAddPreview();
        }
    });

    function syncAddPreview() {
        const url = $('#inv-card-image-url').val();
        const $img = $('#inv-add-preview-image');
        const $placeholder = $('#inv-add-preview-placeholder');

        if (url) {
            $img.attr('src', url).one('load', function() {
                $placeholder.hide();
                $(this).css('opacity', '1');
            });
        } else {
            $img.attr('src', '').css('opacity', '0');
            $placeholder.show();
        }
    }


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

    // Real-time automatic search on typing & auto-clear when search input is empty
    let invSearchDebounceTimer = null;
    $(document).on('input keyup change search', '#inv-card-search-input', function() {
        clearTimeout(invSearchDebounceTimer);
        const term = $(this).val() ? $(this).val().trim() : '';
        if (!term) {
            $('#inv-card-search-results').empty().hide();
            return;
        }
        invSearchDebounceTimer = setTimeout(() => {
            $('#btn-inv-card-search').click();
        }, 350);
    });

    // Drag & Drop for Main Image (Datos tab)
    const $dropZoneMain = $('#drop-zone-inv-main');
    $dropZoneMain.on('dragover', function(e) { e.preventDefault(); $(this).addClass('dragover'); });
    $dropZoneMain.on('dragleave', function() { $(this).removeClass('dragover'); });
    $dropZoneMain.on('drop', async function(e) {
        e.preventDefault();
        $(this).removeClass('dragover');
        const files = e.originalEvent.dataTransfer.files;
        if (files.length) handleInvMainImage(files[0]);
    });

    $('#input-inv-main-file').on('change', function() {
        if (this.files.length) handleInvMainImage(this.files[0]);
    });

    $(document).on('click', '#drop-zone-inv-main', function() {
        $('#input-inv-main-file').click();
    });

    $(document).on('change', '#inv-card-public-toggle', function() {
        const isChecked = $(this).is(':checked');
        $('#inv-card-public-status').text(isChecked ? 'PÚBLICO' : 'PRIVADO').css('color', isChecked ? '#333' : '#ff4757');
    });

    $(document).on('change', '#inv-card-available-toggle', function() {
        const isChecked = $(this).is(':checked');
        $('#inv-card-available-status').text(isChecked ? 'DISPONIBLE' : 'NO DISPONIBLE').css('color', isChecked ? '#2ed573' : '#ff4757');
    });
}

async function handleInvMainImage(file) {
    if (!file) return;
    Swal.fire({ title: 'Subiendo imagen...', didOpen: () => Swal.showLoading() });
    try {
        const url = await CloudinaryUpload.uploadImage(file);
        if (url) {
            $('#inv-card-image-url').val(url);
            syncAddPreview();
            Swal.fire({ icon: 'success', title: 'Imagen cargada', timer: 1000, showConfirmButton: false });
        }
    } catch (e) {
        console.error("Error uploading main image:", e);
        Swal.fire('Error', 'No se pudo subir la imagen', 'error');
    }
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
            const isChecked = $(this).is(':checked');
            updateInvestmentCategory(cat.id, { is_public: isChecked });
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: isChecked ? 'success' : 'info',
                title: isChecked ? 'Bóveda pública: Visible en el link público' : 'Bóveda privada',
                showConfirmButton: false,
                timer: 2000
            });
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

    if (data.is_public === undefined) {
        data.is_public = true;
    }

    let { error } = await _supabase
        .from('investment_categories')
        .insert([{ ...data, user_id: currentUser.id }]);

    if (error && (error.code === '42703' || (error.message && error.message.includes('grid_layout')))) {
        const fallbackData = { ...data };
        delete fallbackData.grid_layout;
        const res = await _supabase
            .from('investment_categories')
            .insert([{ ...fallbackData, user_id: currentUser.id }]);
        error = res.error;
    }

    Swal.close();
    if (error) {
        Swal.fire('Error', 'No se pudo crear la categoría', 'error');
    } else {
        loadInvestmentCategories();
    }
}

async function updateInvestmentCategory(id, data, refresh = false) {
    let { error } = await _supabase
        .from('investment_categories')
        .update(data)
        .eq('id', id);

    if (error && (error.code === '42703' || (error.message && error.message.includes('grid_layout')))) {
        const fallbackData = { ...data };
        delete fallbackData.grid_layout;
        const res = await _supabase
            .from('investment_categories')
            .update(fallbackData)
            .eq('id', id);
        error = res.error;
    }

    if (error) {
        Swal.fire({
            title: 'ERROR',
            text: 'Could not update vault.',
            icon: 'error',
            customClass: { popup: 'inv-swal-popup' }
        });
    } else {
        if (currentInvestmentCategory && currentInvestmentCategory.id === id) {
            Object.assign(currentInvestmentCategory, data);
        }
        if (refresh) {
            loadInvestmentCategories();
            if ($('#view-investment-details').is(':visible') && currentInvestmentCategoryId === id) {
                loadInvestmentCards();
            }
        }
    }
}

async function editInvestmentCategory(cat) {
    const currentLayout = cat.grid_layout || '3x3';
    const { value: formValues } = await Swal.fire({
        title: 'EDITAR VAULT',
        html: `
            <div style="text-align: left; display: flex; flex-direction: column; gap: 15px; padding-top: 10px;">
                <div>
                    <label style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #333; display: block; margin-bottom: 5px;">Nombre de la Colección</label>
                    <input id="swal-inv-vault-name" class="swal2-input" value="${escapeHtml(cat.name)}" placeholder="Ej: POKÉMON VINTAGE HOLOS" style="margin: 0; width: 100%; box-sizing: border-box;">
                </div>
                <div>
                    <label style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #333; display: block; margin-bottom: 5px;">Tamaño de Carpeta (Layout)</label>
                    <select id="swal-inv-vault-layout" class="swal2-select" style="margin: 0; width: 100%; padding: 10px; border-radius: 4px; border: 1px solid #ccc; font-weight: 700;">
                        <option value="3x3" ${currentLayout === '3x3' ? 'selected' : ''}>3x3 (9 Cartas)</option>
                        <option value="4x3" ${currentLayout === '4x3' ? 'selected' : ''}>4x3 (12 Cartas)</option>
                        <option value="4x4" ${currentLayout === '4x4' ? 'selected' : ''}>4x4 (16 Cartas)</option>
                        <option value="2x2" ${currentLayout === '2x2' ? 'selected' : ''}>2x2 (4 Cartas)</option>
                        <option value="1x1" ${currentLayout === '1x1' ? 'selected' : ''}>1x1 (1 Carta)</option>
                    </select>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'ACTUALIZAR',
        cancelButtonText: 'CANCELAR',
        customClass: {
            popup: 'inv-swal-popup',
            confirmButton: 'btn-inv-main',
            cancelButton: 'btn-inv-outline'
        },
        preConfirm: () => {
            const name = $('#swal-inv-vault-name').val().trim();
            const layout = $('#swal-inv-vault-layout').val() || '3x3';
            if (!name) {
                Swal.showValidationMessage('Ingresa un nombre para la colección');
                return false;
            }
            return { name: name.toUpperCase(), grid_layout: layout };
        }
    });

    if (formValues) {
        updateInvestmentCategory(cat.id, formValues, true);
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
    currentInvestmentCategory = cat;
    currentInvestmentCategoryId = cat.id;
    const upperName = cat.name.toUpperCase();
    $('#inv-category-title').text(upperName);
    $('#inv-category-title-mobile').text(upperName);
    showView('investment-details');
    loadInvestmentCards();
}

async function loadInvestmentCards() {
    $('#investment-card-container').html('<div class="loading">Cargando cartas...</div>');

    if (currentInvestmentCategoryId) {
        const { data: catData } = await _supabase
            .from('investment_categories')
            .select('*')
            .eq('id', currentInvestmentCategoryId)
            .single();
        if (catData) {
            currentInvestmentCategory = catData;
            const upperName = catData.name.toUpperCase();
            $('#inv-category-title').text(upperName);
            $('#inv-category-title-mobile').text(upperName);
        }
    }

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

    if (mode === 'album') {
        renderAlbumMode($container);
    } else if (mode === 'slide') {
        if (localInvestmentCards.length === 0) {
            $container.html('<div class="empty" style="text-align: center; padding: 40px; color: #888; font-weight: 700; text-transform: uppercase;">No hay activos en este vault.</div>');
            return;
        }
        renderSlideMode($container);
    } else {
        if (localInvestmentCards.length === 0) {
            $container.html('<div class="empty" style="text-align: center; padding: 40px; color: #888; font-weight: 700; text-transform: uppercase;">No hay activos en este vault.</div>');
            return;
        }
        renderListMode($container);
    }
}

function getTrendIcon(current, previous, showPercentage = false) {
    if (previous === undefined || previous === null || current === previous || previous === 0) return '';
    const isUp = current > previous;
    const iconClass = isUp ? 'fa-arrow-up' : 'fa-arrow-down';
    const color = isUp ? '#00ff88' : '#ff4757';
    let html = `<i class="fas ${iconClass} inv-trend-icon" style="color: ${color};"></i>`;

    if (showPercentage) {
        const percent = ((current - previous) / previous) * 100;
        const sign = percent > 0 ? '+' : '';
        html += `<span style="color: ${color}; font-weight: 800; font-size: 1rem; margin-left: 5px;">${sign}${percent.toFixed(2)}%</span>`;
    }

    return html;
}

function renderAlbumMode($container) {
    $container.addClass('investment-album-layout').removeClass('investment-list-layout investment-slide-layout');
    const { width, height } = window.getAlbumSize($container);
    const $albumWrapper = $(`<div class="album-wrapper" style="width: ${width}px; height: ${height}px;"><div class="album investment-album"></div></div>`);
    const $album = $albumWrapper.find('.album');

    $container.append($albumWrapper);

    const gridLayout = (currentInvestmentCategory && currentInvestmentCategory.grid_layout) ? currentInvestmentCategory.grid_layout : '3x3';
    let numSlots = 9;
    if (gridLayout === '4x3') numSlots = 12;
    else if (gridLayout === '4x4') numSlots = 16;
    else if (gridLayout === '2x2') numSlots = 4;
    else if (gridLayout === '1x1') numSlots = 1;

    // Minimum 5 pages (hojas)
    const cardPages = Math.ceil(localInvestmentCards.length / numSlots) || 1;
    const totalPages = Math.max(5, cardPages);

    // Front Cover with Space/Cosmic Particles and no title/text
    $album.append(`
        <div class="page cover-page">
            <div class="textured-cover style-cosmic" style="background-color: #000000; width: 100%; height: 100%; border: none;"></div>
        </div>
    `);

    // Inner Pages with visible slots
    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        const $page = $('<div class="page album-page"></div>');
        const $grid = $(`<div class="grid-container grid-layout-${gridLayout}"></div>`);

        for (let slotIdx = 0; slotIdx < numSlots; slotIdx++) {
            const cardIdx = pageIdx * numSlots + slotIdx;
            const card = localInvestmentCards[cardIdx];
            const $slot = $('<div class="inv-card-slot card-slot" style="position: relative;"></div>');

            if (card) {
                const trend = getTrendIcon(card.current_price, card.previous_price);
                const isPrivate = card.is_public === false;
                const isUnavailable = card.is_available === false;
                const privateBadge = isPrivate ? `<div class="inv-card-private-badge" style="position: absolute; top: 5px; right: 5px; background: rgba(255, 71, 87, 0.9); color: #fff; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: 800; z-index: 115;" title="Privado (Oculto en link público)"><i class="fas fa-lock"></i></div>` : '';
                const stampOverlay = isUnavailable ? `<div class="inv-stamp-unavailable">NO DISPONIBLE</div>` : '';

                $slot.append(`
                    <img src="${card.image_url}" class="tcg-card" style="border-radius: 4px; border: 1px solid #000; width: 100%; height: 100%; object-fit: contain; position: relative; z-index: 1;">
                    ${stampOverlay}
                    ${privateBadge}
                    <div class="inv-card-info-badge" style="z-index: 110;">$${parseFloat(card.current_price || 0).toFixed(2)} ${trend}</div>
                    <div class="zoom-btn" style="z-index: 110;"><i class="fas fa-search"></i></div>
                `);

                $slot.find('.zoom-btn').on('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    openInvestmentCardModal(card);
                }).on('mousedown touchstart', (e) => {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                });

                $slot.click(function(e) {
                    const isMobile = window.innerWidth <= 768;
                    const isZoomBtn = $(e.target).closest('.zoom-btn').length > 0;

                    if (isMobile) {
                        if (isZoomBtn) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    } else {
                        if (!isZoomBtn) {
                            openInvestmentCardModal(card);
                        }
                    }
                });
            } else {
                // Empty visible slot
                $slot.addClass('empty-inv-slot').css({
                    'border': '2px dashed rgba(0,0,0,0.15)',
                    'border-radius': '4px',
                    'display': 'flex',
                    'flex-direction': 'column',
                    'align-items': 'center',
                    'justify-content': 'center',
                    'background': 'rgba(0,0,0,0.02)',
                    'cursor': 'pointer',
                    'transition': 'all 0.2s ease',
                    'min-height': '60px'
                }).html(`
                    <i class="fas fa-plus" style="color: #888; font-size: 1rem; margin-bottom: 3px;"></i>
                    <span style="font-size: 0.6rem; color: #888; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">AÑADIR</span>
                `);

                $slot.click(function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    openInvestmentCardModal(null, 'inv-tab-datos');
                });
            }

            $grid.append($slot);
        }

        $page.append($grid);
        $album.append($page);
    }

    // Add empty page if needed for double display pairing
    const innerPagesCount = $album.find('.album-page').length;
    if (innerPagesCount % 2 !== 0) {
        const $fillerPage = $('<div class="page album-page"></div>');
        const $grid = $(`<div class="grid-container grid-layout-${gridLayout}"></div>`);
        for (let slotIdx = 0; slotIdx < numSlots; slotIdx++) {
            const $slot = $('<div class="inv-card-slot card-slot empty-inv-slot" style="position: relative; border: 2px dashed rgba(0,0,0,0.15); border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.02); cursor: pointer; transition: all 0.2s ease; min-height: 60px;"></div>').html(`
                <i class="fas fa-plus" style="color: #888; font-size: 1rem; margin-bottom: 3px;"></i>
                <span style="font-size: 0.6rem; color: #888; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">AÑADIR</span>
            `);
            $slot.click(function(e) {
                e.preventDefault();
                e.stopPropagation();
                openInvestmentCardModal(null, 'inv-tab-datos');
            });
            $grid.append($slot);
        }
        $fillerPage.append($grid);
        $album.append($fillerPage);
    }

    // Back Cover with Space/Cosmic Particles
    $album.append(`
        <div class="page cover-page">
            <div class="textured-cover style-cosmic" style="background-color: #000000; width: 100%; height: 100%; border: none;"></div>
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
            display: 'double',
            acceleration: true,
            elevation: 50,
            duration: 800,
            when: {
                turning: function(e, page, view) {
                    $(this).css('position', 'relative');
                }
            }
        });

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
    const swiperWidth = isMobile ? '82vw' : '350px';
    const swiperHeight = isMobile ? '60vh' : '500px';

    const $swiper = $(`
        <div class="swiper ${swiperId}" style="width: 100%; max-width: ${swiperWidth}; margin: 0 auto; height: ${swiperHeight}; padding: 20px 0;">
            <div class="swiper-wrapper"></div>
        </div>
    `);

    localInvestmentCards.forEach(card => {
        const isUnavailable = card.is_available === false;
        const stampOverlay = isUnavailable ? `<div class="inv-stamp-unavailable">NO DISPONIBLE</div>` : '';

        const $slide = $(`
            <div class="swiper-slide inv-card-slot inv-card-item" data-id="${card.id}" style="background: transparent; cursor: pointer; position: relative; display: flex; align-items: center; justify-content: center; height: 100%;">
                <img src="${card.image_url}" style="width: auto; max-width: 100%; height: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; border: 2px solid #000; box-shadow: 0 20px 40px rgba(0,0,0,0.3); position: relative; z-index: 1; display: block; margin: 0 auto;">
                ${stampOverlay}
            </div>
        `);

        $swiper.find('.swiper-wrapper').append($slide);
    });

    $container.append($swiper);

    let lastOpenTime = 0;
    const tryOpenModal = (cardId) => {
        const now = Date.now();
        if (now - lastOpenTime < 400) return;
        lastOpenTime = now;
        const card = localInvestmentCards.find(c => String(c.id) === String(cardId));
        if (card) {
            openInvestmentCardModal(card);
        }
    };

    let startX = 0, startY = 0;
    $swiper.on('pointerdown touchstart', '.inv-card-item', function(e) {
        const touch = e.originalEvent && e.originalEvent.touches ? e.originalEvent.touches[0] : e;
        startX = touch.clientX || 0;
        startY = touch.clientY || 0;
    });

    $swiper.on('pointerup touchend click', '.inv-card-item', function(e) {
        if ($(e.target).closest('button').length) return;
        const touch = e.originalEvent && e.originalEvent.changedTouches ? e.originalEvent.changedTouches[0] : e;
        const endX = touch.clientX !== undefined ? touch.clientX : startX;
        const endY = touch.clientY !== undefined ? touch.clientY : startY;
        const dist = Math.hypot(endX - startX, endY - startY);
        if (dist < 15) {
            const id = $(this).attr('data-id');
            if (id) {
                tryOpenModal(id);
            }
        }
    });

    const invSwiper = new Swiper(`.${swiperId}`, {
        effect: "cards",
        grabCursor: true,
        centeredSlides: true,
        slidesPerView: 'auto',
        threshold: 8,
        preventClicks: false,
        preventClicksPropagation: false,
        on: {
            click: function(swiper, event) {
                const targetSlide = swiper.clickedSlide || (event && event.target ? event.target.closest('.inv-card-item') : null);
                if (targetSlide && !(event && event.target && event.target.closest('button'))) {
                    const id = $(targetSlide).attr('data-id');
                    if (id) {
                        tryOpenModal(id);
                    }
                }
            }
        }
    });
}

function renderListMode($container) {
    $container.addClass('investment-list-layout').removeClass('investment-slide-layout investment-album-layout');
    const $list = $('<div class="inv-list-container" style="margin: 20px 0;"></div>');

    localInvestmentCards.forEach(card => {
        const trend = getTrendIcon(card.current_price, card.previous_price);
        const isUnavailable = card.is_available === false;
        const unavailableBadge = isUnavailable ? `<span style="background: rgba(0, 0, 0, 0.85); color: #ff3344; border: 1px solid #ff3344; padding: 2px 6px; border-radius: 3px; font-size: 0.65rem; font-weight: 800; margin-left: 8px;"><i class="fas fa-ban"></i> NO DISPONIBLE</span>` : '';
        const stampOverlay = isUnavailable ? `<div class="inv-stamp-unavailable" style="font-size: 0.65rem; padding: 2px 6px;">NO DISPONIBLE</div>` : '';
        const salePrice = card.sale_price !== null && card.sale_price !== undefined ? card.sale_price : (card.current_price || 0);

        const $item = $(`
            <div class="inv-list-item" style="border: 1px solid #eee; border-radius: 4px; padding: 15px; background: white; margin-bottom: 10px; display: flex; align-items: center; gap: 20px; cursor: pointer;">
                <div class="inv-list-img-wrapper" style="position: relative; width: 60px; height: 84px; flex-shrink: 0;">
                    <img src="${card.image_url}" class="inv-list-thumb" style="width: 100%; height: 100%; object-fit: contain; border: 1px solid #000; border-radius: 2px; position: relative; z-index: 1;">
                    ${stampOverlay}
                </div>
                <div class="inv-list-details" style="flex: 1;">
                    <div class="inv-list-name" style="font-weight: 800; text-transform: uppercase; font-size: 0.9rem; color: #000; display: flex; align-items: center; flex-wrap: wrap;">${escapeHtml(card.card_name)} ${unavailableBadge}</div>
                    <div class="inv-list-set" style="font-size: 0.7rem; color: #666; font-weight: 700; text-transform: uppercase;">${escapeHtml(card.set_name)} - ${escapeHtml(card.rarity)}</div>
                </div>
                <div class="inv-list-prices" style="display: flex; gap: 20px; text-align: right;">
                    <div class="inv-price-row" style="display: flex; flex-direction: column;"><span style="font-size: 0.6rem; text-transform: uppercase; color: #999;">Compra</span> <b style="color: #000;">$${parseFloat(card.purchase_price || 0).toFixed(2)}</b></div>
                    <div class="inv-price-row" style="display: flex; flex-direction: column;"><span style="font-size: 0.6rem; text-transform: uppercase; color: #999;">Mercado</span> <b style="color: #000;">$${parseFloat(card.current_price || 0).toFixed(2)} ${trend}</b></div>
                    <div class="inv-price-row" style="display: flex; flex-direction: column;"><span style="font-size: 0.6rem; text-transform: uppercase; color: #999;">Venta</span> <b style="color: #2ed573;">$${parseFloat(salePrice).toFixed(2)}</b></div>
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
    if (window.sharedCard3D) window.sharedCard3D.stop();

    currentEditingInvCardId = card ? card.id : null;
    currentInvExtraImages = card ? (card.extra_images || []) : [];

    // Reset Tabs visibility and active state
    $('#investment-card-modal .inv-tab-link').removeClass('active').show();
    $('#investment-card-modal .slot-tab-content').removeClass('active');

    if (!card) {
        // New Card Mode: Hide RESUMEN and MOVIMIENTOS tabs until created
        $('#inv-card-modal-title').text('AÑADIR NUEVO ACTIVO');
        $('#investment-card-modal .inv-tab-link[data-tab="inv-tab-resumen"]').hide();
        $('#investment-card-modal .inv-tab-link[data-tab="inv-tab-movimientos"]').hide();
        $('#inv-card-search-container').show();

        // Reset previews
        $('#inv-detail-image').attr('src', '').css('opacity', '0');
        $('#inv-main-image-status').hide();

        // Default to DATOS tab for new assets
        $(`#investment-card-modal .inv-tab-link[data-tab="inv-tab-datos"]`).addClass('active');
        $('#inv-tab-datos').addClass('active');

        // Clear Fields for clean state without pre-filled '0's
        $('#inv-card-name').val('').prop('readonly', false);
        $('#inv-card-purchase-price').val('');
        $('#inv-card-current-price').val('');
        $('#inv-card-sale-price').val('');
        $('#inv-card-quantity').val(1);
        $('#inv-card-rarity-input').val('');
        $('#inv-card-notes').val('');
        $('#inv-card-external-id, #inv-card-image-url, #inv-card-set-name, #inv-card-set-number, #inv-card-rarity').val('');
        $('#inv-card-game').val('pokemon');

        $('#inv-card-public-toggle').prop('checked', true);
        $('#inv-card-public-status').text('PÚBLICO').css('color', '#333');
        $('#inv-card-available-toggle').prop('checked', true);
        $('#inv-card-available-status').text('DISPONIBLE').css('color', '#2ed573');

        // Cleanup search
        $('#inv-card-search-results').empty().hide();
        $('#inv-card-search-input').val('');
    } else {
        // Edit / View Mode: Show all tabs
        $('#inv-card-modal-title').text(card.card_name.toUpperCase());
        $('#inv-card-search-container').show();
        $('#inv-card-name').prop('readonly', false);
        $('#inv-main-image-status').hide();

        // Set requested tab or default to resumen
        $(`#investment-card-modal .inv-tab-link[data-tab="${defaultTab}"]`).addClass('active');
        $(`#${defaultTab}`).addClass('active');

        // Populate Metadata Fields
        $('#inv-card-name').val(card.card_name ? card.card_name.toUpperCase() : '');
        $('#inv-card-purchase-price').val(card.purchase_price !== null && card.purchase_price !== undefined ? card.purchase_price : '');
        $('#inv-card-current-price').val(card.current_price !== null && card.current_price !== undefined ? card.current_price : '');
        $('#inv-card-sale-price').val(card.sale_price !== null && card.sale_price !== undefined ? card.sale_price : (card.current_price !== null && card.current_price !== undefined ? card.current_price : ''));
        $('#inv-card-quantity').val(card.quantity || 1);
        $('#inv-card-rarity-input').val(card.rarity || '');
        $('#inv-card-notes').val(card.notes || '');

        $('#inv-card-external-id').val(card.external_id || '');
        $('#inv-card-image-url').val(card.image_url || '');
        $('#inv-card-set-name').val(card.set_name || '');
        $('#inv-card-set-number').val(card.set_number || '');
        $('#inv-card-rarity').val(card.rarity || '');
        $('#inv-card-game').val(card.tcg_game || 'pokemon');

        const isPublic = card.is_public !== false;
        const isAvailable = card.is_available !== false;
        $('#inv-card-public-toggle').prop('checked', isPublic);
        $('#inv-card-public-status').text(isPublic ? 'PÚBLICO' : 'PRIVADO').css('color', isPublic ? '#333' : '#ff4757');
        $('#inv-card-available-toggle').prop('checked', isAvailable);
        $('#inv-card-available-status').text(isAvailable ? 'DISPONIBLE' : 'NO DISPONIBLE').css('color', isAvailable ? '#2ed573' : '#ff4757');

        if (defaultTab === 'inv-tab-resumen') {
            updateSummaryTab(card);
        }
    }

    renderInvExtraImagesPreview();
    syncAddPreview();
    $('#investment-card-modal').addClass('active');
}

$('#close-investment-card-modal').click(() => {
    $('#investment-card-modal').removeClass('active');
    if (window.sharedCard3D) window.sharedCard3D.stop();
    $('#companion-wrapper').show();
});

$('#btn-inv-card-search').click(async function() {
    $('#inv-card-search-results').show();
    window.searchExternalCard('#inv-card-search-input', '#inv-card-search-results', async function(card) {
        // When a card is selected from combined search
        const finalUrl = card.high_res || card.image;
        $('#inv-card-name').val(card.name.toUpperCase());
        $('#inv-card-image-url').val(finalUrl);

        $('#inv-card-set-name').val(card.set || card.set_name || '');
        $('#inv-card-set-number').val(card.number || '');
        $('#inv-card-rarity').val(card.rarity || '');
        $('#inv-card-rarity-input').val(card.rarity || '');
        $('#inv-card-current-price').val(card.price ? card.price : '');
        $('#inv-card-sale-price').val(card.price ? card.price : '');
        $('#inv-card-game').val(card.game || 'pokemon');
        $('#inv-card-external-id').val(card.external_id || card.id || '');

        // Update Preview
        syncAddPreview();

        Swal.fire({
            title: 'CARTA SELECCIONADA',
            text: card.name,
            icon: 'success',
            timer: 1000,
            showConfirmButton: false,
            customClass: { popup: 'inv-swal-popup' }
        });
    });
});

$('#btn-save-investment-card').click(async function() {
    const purchaseVal = $('#inv-card-purchase-price').val();
    const currentVal = $('#inv-card-current-price').val();
    const saleVal = $('#inv-card-sale-price').val();

    const purchasePrice = purchaseVal !== '' ? parseFloat(purchaseVal) : 0;
    const newPrice = currentVal !== '' ? parseFloat(currentVal) : 0;
    const salePrice = saleVal !== '' ? parseFloat(saleVal) : newPrice;

    const cardData = {
        category_id: currentInvestmentCategoryId,
        user_id: currentUser.id,
        card_name: $('#inv-card-name').val().toUpperCase(),
        external_id: $('#inv-card-external-id').val(),
        tcg_game: $('#inv-card-game').val() || 'pokemon',
        image_url: $('#inv-card-image-url').val(),
        rarity: $('#inv-card-rarity-input').val(),
        set_name: $('#inv-card-set-name').val(),
        set_number: $('#inv-card-set-number').val(),
        purchase_price: purchasePrice,
        current_price: newPrice,
        sale_price: salePrice,
        quantity: parseInt($('#inv-card-quantity').val()) || 1,
        show_foil: false,
        notes: $('#inv-card-notes').val(),
        extra_images: currentInvExtraImages,
        is_public: $('#inv-card-public-toggle').is(':checked'),
        is_available: $('#inv-card-available-toggle').is(':checked'),
        holo_effect: null,
        custom_mask_url: null
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

        const executeSave = async (dataToSave) => {
            if (currentEditingInvCardId) {
                // Check if price changed to update previous_price and history
                const oldCard = localInvestmentCards.find(c => c.id === currentEditingInvCardId);
                if (oldCard && oldCard.current_price !== newPrice) {
                    dataToSave.previous_price = oldCard.current_price;
                    // Log history
                    await _supabase.from('investment_price_history').insert([{
                        card_id: currentEditingInvCardId,
                        price: newPrice
                    }]);
                }

                return await _supabase
                    .from('investment_cards')
                    .update(dataToSave)
                    .eq('id', currentEditingInvCardId);
            } else {
                dataToSave.position = localInvestmentCards.length;
                return await _supabase
                    .from('investment_cards')
                    .insert([dataToSave])
                    .select();
            }
        };

        let res = await executeSave(cardData);
        error = res.error;

        // Fallback if sale_price column does not exist in DB schema yet
        if (error && (error.code === '42703' || (error.message && error.message.includes('sale_price')))) {
            const fallbackData = { ...cardData };
            delete fallbackData.sale_price;
            res = await executeSave(fallbackData);
            error = res.error;
        }

        if (!error && !currentEditingInvCardId && res.data && res.data.length > 0) {
            finalCardId = res.data[0].id;
            currentEditingInvCardId = finalCardId;
            await _supabase.from('investment_price_history').insert([{
                card_id: finalCardId,
                price: newPrice
            }]);
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

        renderInvestmentCards(currentInvestmentViewMode);

        // Re-open the modal in "Edit" mode to show all tabs and summary
        openInvestmentCardModal(updatedCard, 'inv-tab-resumen');

    } catch (e) {
        console.error(e);
        Swal.fire({
            title: 'ERROR',
            text: 'Could not save asset: ' + (e.message || e),
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
    // 1. Force stop and cleanup any existing 3D loops to prevent rapid movement/flickering
    if (window.sharedCard3D) window.sharedCard3D.stop();

    $('#inv-card-modal-title').text('ASSET DETAILS');
    $('#inv-detail-name').text(card.card_name.toUpperCase());

    // Smooth image update to prevent flickering
    const $img = $('#inv-detail-image');
    if ($img.attr('src') !== card.image_url) {
        $img.stop().css('opacity', '0');
        $img.attr('src', card.image_url).one('load', function() {
            $(this).animate({ opacity: 1 }, 300);
        });
    } else {
        $img.css('opacity', '1');
    }

    // Reset card wrapper state and styles to prevent LERP fighting
    $('#inv-card-3d').removeClass().addClass('card-3d').attr('style', 'transform: none !important;');
    $('.holo-layer').removeClass('active foil-loop').hide();

    const setInfo = (card.set_name || 'UNKNOWN EXPANSION').toUpperCase();
    const rarityInfo = (card.rarity || 'UNKNOWN RARITY').toUpperCase();
    $('#inv-detail-set').text(`${setInfo} - ${rarityInfo}`);

    $('#inv-detail-price').text(`$${parseFloat(card.current_price || 0).toFixed(2)}`);

    const trendIcon = getTrendIcon(card.current_price, card.previous_price, true);
    $('#inv-detail-trend').html(trendIcon);

    // 2. Load History Chart - delayed to ensure modal layout is fully stable and visible
    setTimeout(() => {
        if ($('#inv-tab-resumen').is(':visible')) {
            renderPriceHistoryChart(card.id);
        }
    }, 400);
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
        Swal.fire({ title: 'Error', text: 'No se pudo actualizar el precio: ' + (e.message || e), icon: 'error', customClass: { popup: 'inv-swal-popup' } });
    }
}

async function renderPriceHistoryChart(cardId) {
    // 1. Prevent overlapping renders and ensure DOM is ready
    const canvasId = 'inv-price-chart';
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Check if modal and correct tab is visible to avoid glitches
    // Only render if RESUMEN tab is visible
    if (!$('#investment-card-modal').hasClass('active') || !$('#inv-tab-resumen').is(':visible')) return;

    const { data: history, error } = await _supabase
        .from('investment_price_history')
        .select('*')
        .eq('card_id', cardId)
        .order('recorded_at', { ascending: true });

    if (error || !history) return;

    const ctx = canvas.getContext('2d');

    if (invPriceChart) {
        invPriceChart.destroy();
        invPriceChart = null;
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

    invPriceChart = chart;

    // Render list history (cloning to avoid in-place reversal issues)
    const listId = '#inv-history-list';
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
