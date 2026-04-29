/**
 * Admin Wishlist (Wishlist) Module
 * Ported from js/deseos.js to work within the admin.js context.
 */

let currentWishlistSlot = 0;
let currentEditingWishlistId = null;
let pendingWishlistAdmin = [];

$(document).ready(function() {
    initAdminWishlistListeners();
});

function initAdminWishlistListeners() {
    // Search event
    $('#btn-wishlist-external-search-admin').click(function(e) {
        e.preventDefault();
        window.searchExternalCard('#wishlist-external-search-input', '#wishlist-external-search-results-admin', function(card) {
            addCardToWishlistAdmin(card);
        });
    });

    // Slot switching
    $(document).on('click', '#view-wishlist .wishlist-tab-btn', function() {
        $('#view-wishlist .wishlist-tab-btn').removeClass('active');
        $(this).addClass('active');
        currentWishlistSlot = parseInt($(this).data('index'));
        loadWishlistAdmin();
    });

    // Share current slot button
    if ($('#btn-share-slot-admin').length === 0) {
        $('<button id="btn-share-slot-admin" class="btn btn-sm" style="margin-left: 10px; background: rgba(255,255,255,0.1);"><i class="fas fa-share-alt"></i> Compartir Slot</button>')
            .appendTo('#view-wishlist .wishlist-tabs-container')
            .on('click', () => {
                window.openShareModal(`Buscamos - Slot ${currentWishlistSlot+1}`, 'wishlist', currentWishlistSlot);
            });
    }

    // Modal listeners
    $('#close-wishlist-modal-admin').click(() => $('#wishlist-modal-admin').removeClass('active'));

    $('#modal-wishlist-holo-effect').on('change', function() {
        const val = $(this).val();
        if (val === 'custom-texture' || val === 'custom-foil') {
            $('#modal-wishlist-mask-container').show();
        } else {
            $('#modal-wishlist-mask-container').hide();
        }
    });

    $('#btn-open-mask-editor-wishlist').click(function(e) {
        e.preventDefault();
        const cardImgUrl = $('#modal-wishlist-card-img').attr('src');
        if (!cardImgUrl) {
            Swal.fire('Atención', 'No hay imagen de referencia.', 'warning');
            return;
        }
        window.maskTargetInput = '#modal-wishlist-custom-mask';
        $('#mask-canvas-wrapper').css('background-image', `url(${cardImgUrl})`);
        window.initMaskCanvas();
        $('#mask-editor-overlay').addClass('active');
    });

    $('#btn-wishlist-save-batch-admin').click(function() {
        saveWishlistBatchAdmin();
    });

    $('#btn-save-wishlist-modal-admin').click(async function() {
        if (!currentEditingWishlistId) return;

        const data = {
            rarity: $('#modal-wishlist-rarity').val(),
            quantity: parseInt($('#modal-wishlist-quantity').val()) || 1,
            holo_effect: $('#modal-wishlist-holo-effect').val(),
            custom_mask_url: $('#modal-wishlist-custom-mask').val(),
            use_3d: $('#modal-wishlist-use-3d').is(':checked'),
            show_foil_in_list: $('#modal-wishlist-show-foil-list').is(':checked'),
            notes: $('#modal-wishlist-notes').val()
        };

        Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        await updateWishlistItemAdmin(currentEditingWishlistId, data);

        Swal.fire({ icon: 'success', title: '¡Guardado!', timer: 1500, showConfirmButton: false });
        $('#wishlist-modal-admin').removeClass('active');
        loadWishlistAdmin();
    });
}

async function loadWishlistAdmin() {
    if (!currentUser) return;

    const $container = $('#wishlist-list-admin');
    $container.html('<div class="loading">Cargando Wishlist...</div>');

    const { data: wishlist, error } = await _supabase
        .from('wishlist')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('list_index', currentWishlistSlot)
        .order('created_at', { ascending: false });

    if (error) {
        $container.html('<div class="error">Error al cargar la lista.</div>');
        console.error(error);
        return;
    }

    if (wishlist.length === 0) {
        $container.html('<div class="empty">No tienes cartas en tu Wishlist. ¡Busca una arriba para empezar!</div>');
        return;
    }

    $container.empty();

    wishlist.forEach(item => {
        const $card = $(`
            <div class="album-card wishlist-item" data-id="${item.id}" style="position: relative; padding: 15px; gap: 8px; ${item.obtained ? 'opacity: 0.7;' : ''}">
                <div style="position: absolute; top: 5px; right: 5px; display: flex; gap: 5px; z-index: 20;">
                    <div class="btn-delete-card-top btn-edit-wishlist" data-id="${item.id}" title="Efectos y Más" style="background: var(--primary-color) !important; position: static;"><i class="fas fa-magic"></i></div>
                    <div class="btn-delete-card-top btn-delete-wishlist" data-id="${item.id}" title="Eliminar" style="position: static;"><i class="fas fa-times"></i></div>
                </div>

                <div style="position: relative; width: 100%;">
                    <div style="position: absolute; top: 5px; left: 5px; z-index: 10;">
                        <label class="wishlist-checkbox-container">
                            <input type="checkbox" class="wishlist-toggle-obtained" ${item.obtained ? 'checked' : ''}>
                            <span class="wishlist-checkbox-custom"></span>
                            <span class="wishlist-status-text">${item.obtained ? '¡CONSEGUIDA!' : 'BUSCANDO'}</span>
                        </label>
                    </div>
                    <div class="wishlist-img-container" style="width: 100%; height: 160px; position: relative;">
                        <img src="${item.image_url}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px; background: rgba(0,0,0,0.2);">
                    </div>
                </div>

                <div style="font-weight: bold; font-size: 13px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.name}">${item.name}</div>

                <div style="display: flex; gap: 8px; width: 100%;">
                    <div class="form-group" style="margin-bottom: 0; flex: 2;">
                        <label style="font-size: 9px; margin-bottom: 2px;">RAREZA</label>
                        <input type="text" class="wishlist-field" data-field="rarity" value="${item.rarity || ''}" placeholder="Rareza" style="padding: 6px; font-size: 11px;">
                    </div>
                    <div class="form-group" style="margin-bottom: 0; flex: 1;">
                        <label style="font-size: 9px; margin-bottom: 2px;">CANT.</label>
                        <input type="number" class="wishlist-field" data-field="quantity" value="${item.quantity || 1}" style="padding: 6px; font-size: 11px;">
                    </div>
                </div>

                <div class="form-group" style="margin-bottom: 0; width: 100%;">
                    <label style="font-size: 9px; margin-bottom: 2px;">NOTAS</label>
                    <input type="text" class="wishlist-field" data-field="notes" value="${item.notes || ''}" placeholder="Notas adicionales..." style="padding: 6px; font-size: 11px;">
                </div>
            </div>
        `);

        // Listeners
        $card.find('.wishlist-field').on('change', function() {
            const field = $(this).data('field');
            const value = $(this).val();
            updateWishlistItemAdmin(item.id, { [field]: value });
        });

        $card.find('.wishlist-toggle-obtained').on('change', function() {
            const obtained = $(this).is(':checked');
            updateWishlistItemAdmin(item.id, { obtained });
            $card.css('opacity', obtained ? '0.7' : '1');
            $card.find('.wishlist-status-text').text(obtained ? '¡CONSEGUIDA!' : 'BUSCANDO');
        });

        $card.find('.btn-delete-wishlist').click(function(e) {
            e.stopPropagation();
            deleteWishlistItemAdmin(item.id);
        });

        $card.find('.btn-edit-wishlist').click(function(e) {
            e.stopPropagation();
            openEditWishlistModalAdmin(item);
        });

        if (item.show_foil_in_list && item.holo_effect) {
            const $foilTarget = $card.find('.wishlist-img-container');
            if (typeof window.applyFoilToElement === 'function') {
                window.applyFoilToElement($foilTarget, item.holo_effect, item.custom_mask_url);
            }
        }

        $container.append($card);
    });
}

function openEditWishlistModalAdmin(item) {
    currentEditingWishlistId = item.id;
    $('#modal-wishlist-card-img').attr('src', item.image_url);
    $('#modal-wishlist-card-name').text(item.name);
    $('#modal-wishlist-rarity').val(item.rarity || '');
    $('#modal-wishlist-quantity').val(item.quantity || 1);
    $('#modal-wishlist-holo-effect').val(item.holo_effect || '');
    $('#modal-wishlist-custom-mask').val(item.custom_mask_url || '');
    $('#modal-wishlist-use-3d').prop('checked', item.use_3d !== false);
    $('#modal-wishlist-show-foil-list').prop('checked', item.show_foil_in_list === true);
    $('#modal-wishlist-notes').val(item.notes || '');

    if (item.holo_effect === 'custom-texture' || item.holo_effect === 'custom-foil') {
        $('#modal-wishlist-mask-container').show();
    } else {
        $('#modal-wishlist-mask-container').hide();
    }

    $('#wishlist-modal-admin').addClass('active');
}

async function addCardToWishlistAdmin(card) {
    if (!currentUser) return;

    // Check limit (Including pending) - Admin bypass
    if (currentUser.role !== 'admin') {
        const { count, error: countError } = await _supabase
            .from('wishlist')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id);

        if (countError) {
            console.error("Error checking wishlist limit:", countError);
        } else {
            const limit = currentUser.max_wishlist || 10;
            const total = count + (pendingWishlistAdmin ? pendingWishlistAdmin.length : 0);
            if (total >= limit) {
                Swal.fire({
                    title: 'Límite alcanzado',
                    text: `Has alcanzado el límite de ${limit} cartas en tu Wishlist.`,
                    icon: 'warning'
                });
                return;
            }
        }
    }

    pendingWishlistAdmin.push(card);
    renderPendingWishlistAdmin();

    Swal.fire({
        title: '¡Preparada!',
        text: card.name + ' añadida a la cola.',
        icon: 'success',
        timer: 1000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
    });
}

function renderPendingWishlistAdmin() {
    const $container = $('#pending-wishlist-container-admin');
    const $grid = $('#pending-wishlist-grid-admin');
    $grid.empty();

    if (pendingWishlistAdmin.length === 0) {
        $container.hide();
        return;
    }

    $container.show();

    pendingWishlistAdmin.forEach((card, index) => {
        const $item = $(`
            <div class="fast-result-item" style="position: relative; width: 80px; height: 110px;" title="${card.name}">
                <img src="${card.image || card.high_res}" alt="${card.name}" style="width: 100%; height: 80px; object-fit: cover; border-radius: 4px;">
                <span style="font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; color: #fff;">${card.name}</span>
                <div class="btn-delete-card-top" style="top: -5px; right: -5px; width: 20px; height: 20px; font-size: 10px; line-height: 20px;" data-index="${index}">
                    <i class="fas fa-times"></i>
                </div>
            </div>
        `);

        $item.find('.btn-delete-card-top').click((e) => {
            e.stopPropagation();
            pendingWishlistAdmin.splice(index, 1);
            renderPendingWishlistAdmin();
        });

        $grid.append($item);
    });
}

async function saveWishlistBatchAdmin() {
    if (pendingWishlistAdmin.length === 0) return;

    Swal.fire({
        title: 'Guardando...',
        text: `Añadiendo ${pendingWishlistAdmin.length} cartas a tu lista.`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const cardsToInsert = pendingWishlistAdmin.map(card => ({
            user_id: currentUser.id,
            name: card.name,
            image_url: card.high_res,
            list_index: currentWishlistSlot,
            game: (card.game) ? card.game : (card.image && card.image.includes('tcgdex') ? 'pokemon' : (card.image && card.image.includes('lorcana-api') ? 'lorcana' : 'yugioh')),
            obtained: false,
            quantity: 1
        }));

        const { error } = await _supabase.from('wishlist').insert(cardsToInsert);

        if (error) throw error;

        Swal.fire({
            title: '¡Guardado!',
            text: 'Todas las cartas se han añadido con éxito.',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });

        pendingWishlistAdmin = [];
        renderPendingWishlistAdmin();
        loadWishlistAdmin();

    } catch (err) {
        console.error("Batch Error:", err);
        Swal.fire('Error', 'No se pudieron añadir las cartas: ' + err.message, 'error');
    }
}

async function updateWishlistItemAdmin(id, data) {
    const { error } = await _supabase
        .from('wishlist')
        .update(data)
        .eq('id', id);

    if (error) {
        console.error("Error updating wishlist item:", error);
    }
}

async function deleteWishlistItemAdmin(id) {
    const result = await Swal.fire({
        title: '¿Eliminar de la lista?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4757',
        confirmButtonText: 'Sí, eliminar'
    });

    if (result.isConfirmed) {
        const { error } = await _supabase.from('wishlist').delete().eq('id', id);
        if (error) {
            Swal.fire('Error', 'No se pudo eliminar', 'error');
        } else {
            loadWishlistAdmin();
        }
    }
}
