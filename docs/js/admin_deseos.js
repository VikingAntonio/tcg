/**
 * Admin Wishlist (Wishlist) Module
 * Ported from js/deseos.js to work within the admin.js context.
 */

let currentWishlistSlot = 0;
let currentEditingWishlistId = null;
let pendingWishlistAdmin = [];

$(document).ready(function() {
    initAdminWishlistListeners();
    loadWishlistSlotNames();
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

    // Slot renaming
    $(document).on('dblclick', '#view-wishlist .wishlist-tab-btn', async function() {
        const index = $(this).data('index');
        const currentName = $(this).text();

        const { value: newName } = await Swal.fire({
            title: 'Renombrar Slot',
            input: 'text',
            inputLabel: 'Nuevo nombre para este slot',
            inputValue: currentName,
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value) return '¡Debes ingresar un nombre!';
            }
        });

        if (newName && newName !== currentName) {
            $(this).text(newName);
            saveWishlistSlotName(index, newName);
        }
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
        if (val === 'custom-texture' || val === 'custom-foil' || val === 'multiFoils') {
            $('#modal-wishlist-mask-container').show();
        } else {
            $('#modal-wishlist-mask-container').hide();
        }
    });

    $('#btn-add-wishlist-foil-layer').click(function(e) {
        e.preventDefault();
        window.addWishlistFoilLayerRow('', '');
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

        let holoEffect = $('#modal-wishlist-holo-effect').val() || '';

        // Compile additional layers if present
        let finalHolo = holoEffect;
        let finalMask = $('#modal-wishlist-custom-mask').val() || '';

        const layerHolos = [];
        const layerMasks = [];

        $('#wishlist-layers-container .wishlist-layer-row').each(function() {
            let rowHolo = $(this).find('.layer-holo-effect').val() || '';
            const rowMask = $(this).find('.layer-custom-mask').val() || '';
            const rowShowFoil = $(this).find('.layer-show-foil-list').is(':checked');

            if (rowHolo) {
                if (rowShowFoil && !rowHolo.startsWith('L:')) {
                    rowHolo = 'L:' + rowHolo;
                }
                layerHolos.push(rowHolo);
                layerMasks.push(rowMask);
            }
        });

        if (layerHolos.length > 0) {
            finalHolo = finalHolo + ';' + layerHolos.join(';');
            finalMask = finalMask + ';' + layerMasks.join(';');
        }

        const data = {
            rarity: $('#modal-wishlist-rarity').val(),
            quantity: parseInt($('#modal-wishlist-quantity').val()) || 1,
            holo_effect: finalHolo,
            custom_mask_url: finalMask,
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

    // Event delegation on the #wishlist-list-admin container for robust interaction
    $(document).on('change', '#wishlist-list-admin .wishlist-field', function() {
        const $card = $(this).closest('.wishlist-item');
        const item = $card.data('item');
        if (!item) return;
        const field = $(this).data('field');
        const value = $(this).val();
        updateWishlistItemAdmin(item.id, { [field]: value });
    });

    $(document).on('change', '#wishlist-list-admin .wishlist-toggle-obtained', function() {
        const $card = $(this).closest('.wishlist-item');
        const item = $card.data('item');
        if (!item) return;
        const obtained = $(this).is(':checked');
        updateWishlistItemAdmin(item.id, { obtained });
        $card.css('opacity', obtained ? '0.7' : '1');
        $card.find('.wishlist-status-text').text(obtained ? '¡CONSEGUIDA!' : 'BUSCANDO');
    });

    $(document).on('click', '#wishlist-list-admin .btn-delete-wishlist', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const $card = $(this).closest('.wishlist-item');
        const item = $card.data('item');
        if (!item) return;
        deleteWishlistItemAdmin(item.id, $card);
    });

    $(document).on('click', '#wishlist-list-admin .btn-edit-wishlist', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const $card = $(this).closest('.wishlist-item');
        const item = $card.data('item');
        if (item) {
            openEditWishlistModalAdmin(item);
        }
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

        // Store item metadata
        $card.data('item', item);

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
    window.maskGuideUrl = null;

    $('#modal-wishlist-card-img').attr('src', item.image_url);
    $('#modal-wishlist-card-name').text(item.name);
    $('#modal-wishlist-rarity').val(item.rarity || '');
    $('#modal-wishlist-quantity').val(item.quantity || 1);
    $('#wishlist-layers-container').empty();

    const holo = item.holo_effect || '';
    let baseHolo = holo;
    if (holo.includes(';')) {
        baseHolo = holo.split(';')[0];
    }

    if (baseHolo === 'multiFoils' || baseHolo.startsWith('multiFoils|')) {
        $('#modal-wishlist-holo-effect').val('multiFoils');
    } else {
        $('#modal-wishlist-holo-effect').val(baseHolo);
    }

    let mask = item.custom_mask_url || '';
    let baseMask = mask;
    if (mask.includes(';')) {
        baseMask = mask.split(';')[0];
    }
    $('#modal-wishlist-custom-mask').val(baseMask || '');

    $('#modal-wishlist-use-3d').prop('checked', item.use_3d !== false);
    $('#modal-wishlist-show-foil-list').prop('checked', item.show_foil_in_list === true);
    $('#modal-wishlist-notes').val(item.notes || '');

    if (baseHolo === 'custom-texture' || baseHolo === 'custom-foil' || baseHolo === 'multiFoils' || baseHolo.startsWith('multiFoils|')) {
        $('#modal-wishlist-mask-container').show();
    } else {
        $('#modal-wishlist-mask-container').hide();
    }

    // Populate additional layers
    window.initWishlistFoilLayersUI(item.holo_effect || '', item.custom_mask_url || '');

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

async function loadWishlistSlotNames() {
    if (!currentUser) return;
    try {
        const { data, error } = await _supabase
            .from('wishlist_slot_names')
            .select('*')
            .eq('user_id', currentUser.id);

        if (error) throw error;

        if (data && data.length > 0) {
            data.forEach(slot => {
                $(`#view-wishlist .wishlist-tab-btn[data-index="${slot.slot_index}"]`).text(slot.name);
            });
        }
    } catch (err) {
        console.error("Error loading slot names:", err);
    }
}

async function saveWishlistSlotName(index, name) {
    if (!currentUser) return;
    try {
        const { error } = await _supabase
            .from('wishlist_slot_names')
            .upsert({
                user_id: currentUser.id,
                slot_index: index,
                name: name
            }, { onConflict: 'user_id,slot_index' });

        if (error) throw error;

        Swal.fire({
            icon: 'success',
            title: 'Nombre guardado',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
        });
    } catch (err) {
        console.error("Error saving slot name:", err);
        Swal.fire('Error', 'No se pudo guardar el nombre', 'error');
    }
}

async function deleteWishlistItemAdmin(id, $element = null) {
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
            if ($element) {
                $element.fadeOut(300, function() {
                    $(this).remove();
                    const $container = $('#wishlist-list-admin');
                    if ($container.children('.wishlist-item').length === 0) {
                        $container.html('<div class="empty">No tienes cartas en tu Wishlist. ¡Busca una arriba para empezar!</div>');
                    }
                });
            } else {
                loadWishlistAdmin();
            }
        }
    }
}

window.addWishlistFoilLayerRow = function(holoVal = '', maskVal = '') {
    const $container = $('#wishlist-layers-container');
    const optionsHtml = $('#modal-wishlist-holo-effect').html();

    let isListFoil = false;
    let baseHolo = holoVal;
    if (baseHolo.startsWith('L:')) {
        isListFoil = true;
        baseHolo = baseHolo.substring(2);
    }

    const $row = $(`
        <div class="wishlist-layer-row" style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; align-items: end; background: rgba(255,255,255,0.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 10px; color: #888;">Efecto Foil</label>
                <select class="layer-holo-effect" style="width: 100%; background: #252525; color: white; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); font-size: 12px; height: 42px;">
                    ${optionsHtml}
                </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 10px; color: #888;">Máscara (Base64/URL)</label>
                <div style="display: flex; gap: 5px;">
                    <input type="text" class="layer-custom-mask" placeholder="Sin máscara" value="${maskVal}" style="padding: 10px; font-size: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: #1a1a1a; color: white; width: 100%; height: 42px;">
                    <button type="button" class="btn btn-secondary btn-layer-edit-mask-wishlist" style="padding: 10px 15px; font-size: 12px; border-radius: 8px; height: 42px;" title="Editar Máscara"><i class="fas fa-paint-brush"></i></button>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; height: 42px;">
                <label style="display: flex; flex-direction: column; align-items: center; cursor: pointer; margin-bottom: 0; min-width: 45px;">
                    <span style="font-size: 9px; color: #888; margin-bottom: 2px;">List Foil</span>
                    <label class="switch switch-mini" style="transform: scale(0.85); margin-bottom: 0;">
                        <input type="checkbox" class="layer-show-foil-list" ${isListFoil ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </label>
                <button type="button" class="btn btn-danger btn-remove-layer-wishlist" style="padding: 10px 15px; font-size: 12px; border-radius: 8px; height: 42px;" title="Eliminar Capa"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `);

    $row.find('.layer-holo-effect').val(baseHolo);

    $row.find('.btn-remove-layer-wishlist').on('click', function() {
        $row.remove();
    });

    $row.find('.btn-layer-edit-mask-wishlist').on('click', function(e) {
        e.preventDefault();
        const cardImgUrl = $('#modal-wishlist-card-img').attr('src');
        if (!cardImgUrl) {
            Swal.fire('Atención', 'No hay imagen de referencia.', 'warning');
            return;
        }

        let guideUrl = $('#modal-wishlist-custom-mask').val() || '';
        if (!guideUrl) {
            $('.layer-custom-mask').not($row.find('.layer-custom-mask')).each(function() {
                const val = $(this).val();
                if (val) {
                    guideUrl = val;
                    return false;
                }
            });
        }

        window.maskGuideUrl = guideUrl;

        const $maskInput = $row.find('.layer-custom-mask');
        let inputId = $maskInput.attr('id');
        if (!inputId) {
            inputId = 'wishlist-layer-mask-input-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            $maskInput.attr('id', inputId);
        }

        window.maskTargetInput = '#' + inputId;
        $('#mask-canvas-wrapper').css('background-image', `url(${cardImgUrl})`);
        window.initMaskCanvas();
        $('#mask-editor-overlay').addClass('active');
    });

    $container.append($row);
};

window.initWishlistFoilLayersUI = function(holo, mask) {
    $('#wishlist-layers-container').empty();
    if (!holo) return;

    if (holo.includes(';')) {
        const effects = holo.split(';');
        const masks = mask ? mask.split(';') : [];

        for (let i = 1; i < effects.length; i++) {
            window.addWishlistFoilLayerRow(effects[i], masks[i] || '');
        }
    }
};
