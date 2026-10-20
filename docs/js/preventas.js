let currentUser = null;
let allPreorders = [];
let activeClientsPreorder = null;
let currentClientsList = [];
let isTableEditMode = false;
let pendingTableChanges = {};

$(document).ready(async function() {
    console.log("Initializing Preorders Module...");
    try {
        await checkSession();
    } catch (err) {
        console.error("Critical initialization error:", err);
    }

    // --- Navigation & Filter Drawer ---
    $('#btn-toggle-admin-filters').click(function() {
        $(this).toggleClass('active');
        $('#admin-filter-drawer').slideToggle(200).css('display', $(this).hasClass('active') ? 'flex' : 'none');
    });

    $('#btn-toggle-edit-mode').click(function() {
        toggleTableEditMode();
    });

    $('#btn-open-add-modal').click(function() {
        resetModal();
        $('#preorder-modal').addClass('active');
    });

    $('#close-preorder-modal').click(function() {
        $('#preorder-modal').removeClass('active');
    });

    $('#close-clients-modal').click(function() {
        $('#preorder-clients-modal').removeClass('active');
    });

    $('#admin-search-input, #admin-filter-tcg, #admin-filter-visibility').on('input change', function() {
        filterAndRenderPreorders();
    });

    $(document).on('click', '#avatar-btn', function(e) {
        e.stopPropagation();
        $('#user-dropdown').toggleClass('active');
    });

    $('#menu-btn-logout').click(function(e) {
        e.preventDefault();
        handleLogout();
    });

    // --- Tabs Switch Logic ---
    $('#preorder-modal-tabs .modal-tab-btn').click(function() {
        const targetTab = $(this).data('tab');
        $('#preorder-modal-tabs .modal-tab-btn').removeClass('active');
        $(this).addClass('active');
        $('#preorder-modal .tab-pane').removeClass('active');
        $('#' + targetTab).addClass('active');
    });

    // --- Save Preorder Logic ---
    $('#btn-save-preorder').click(function() {
        savePreorder();
    });

    // --- Client Entry Management ---
    $('#btn-add-client-entry').click(function() {
        addClientEntry();
    });

    $('#btn-save-clients-list').click(function() {
        saveClientsListForActivePreorder();
    });

    // Cloudinary Drag & Drop for Preorder
    $(document).on('drop', '#drop-zone-preorder', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) {
            handleCloudinaryUpload(files[0], '#preorder-image-url', '#drop-zone-preorder .file-name');
        }
    });

    $(document).on('dragover dragenter', '#drop-zone-preorder', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).addClass('dragover');
    });

    $(document).on('dragleave dragend drop', '#drop-zone-preorder', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('dragover');
    });

    $(document).on('change', '#input-preorder-file', function() {
        if (this.files.length > 0) {
            handleCloudinaryUpload(this.files[0], '#preorder-image-url', '#drop-zone-preorder .file-name');
        }
    });

    async function handleCloudinaryUpload(file, inputSelector, nameSelector) {
        $(nameSelector).text("Subiendo...").css('color', '#aaa');
        try {
            const url = await CloudinaryUpload.uploadImage(file);
            $(inputSelector).val(url);
            $(nameSelector).text("¡Imagen subida!").css('color', '#00ff88');
            Swal.fire({
                title: '¡Subida Exitosa!',
                text: 'Imagen cargada con éxito',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        } catch (err) {
            $(nameSelector).text("Error al subir").css('color', '#ff4757');
            Swal.fire('Error', 'No se pudo subir la imagen: ' + err.message, 'error');
        }
    }
});

async function checkSession() {
    console.log("Checking session...");
    try {
        const { data: { session }, error: sessionError } = await _supabase.auth.getSession();

        if (sessionError || !session) {
            console.warn("No active session or session error.");
            window.location.href = 'admin.html';
            return;
        }

        const { data: user, error: userError } = await _supabase
            .from('usuarios')
            .select('id, username, max_preorders')
            .eq('id', session.user.id)
            .single();

        if (userError || !user) {
            console.error("User fetch error or user not found.");
            window.location.href = 'admin.html';
            return;
        }

        currentUser = user;
        $('#dropdown-user-name').text(user.username);
        $('#top-panel, #authenticated-content').fadeIn();
        loadPreorders();
    } catch (err) {
        console.error("Unexpected session check error:", err);
        window.location.href = 'admin.html';
    }
}

async function handleLogout() {
    await _supabase.auth.signOut();
    window.location.href = 'admin.html';
}

async function loadPreorders() {
    $('#preorder-table-body').html(`
        <tr>
            <td colspan="13" style="padding: 60px; text-align: center; color: #94a3b8; font-size: 1rem;">
                <i class="fas fa-circle-notch fa-spin fa-2x" style="color: #00d2ff; margin-bottom: 12px;"></i><br>Cargando preventas...
            </td>
        </tr>
    `);

    try {
        const { data: preorders, error } = await _supabase
            .from('preorders')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        allPreorders = preorders || [];
        filterAndRenderPreorders();
    } catch (err) {
        console.error("Load preorders error:", err);
        $('#preorder-table-body').html(`
            <tr>
                <td colspan="13" style="padding: 60px; text-align: center; color: #ff4757; font-size: 1rem;">
                    Error al cargar preventas. Por favor, refresca la página.
                </td>
            </tr>
        `);
    }
}

function filterAndRenderPreorders() {
    const searchVal = ($('#admin-search-input').val() || '').toLowerCase().trim();
    const tcgVal = $('#admin-filter-tcg').val();
    const visVal = $('#admin-filter-visibility').val();

    let filtered = allPreorders.filter(p => {
        if (searchVal && !(p.name || '').toLowerCase().includes(searchVal)) return false;
        if (tcgVal !== 'all' && (p.tcg || '').toLowerCase() !== tcgVal) return false;
        if (visVal === 'public' && p.is_public === false) return false;
        if (visVal === 'private' && p.is_public !== false) return false;
        return true;
    });

    $('#preorder-table-wrapper').show();
    renderAdminPreorderTable(filtered);
}

async function toggleTableEditMode() {
    if (isTableEditMode) {
        // Save batch changes
        const modifiedIds = Object.keys(pendingTableChanges);
        if (modifiedIds.length > 0) {
            Swal.fire({
                title: 'Guardando cambios...',
                text: 'Actualizando preventas en Supabase...',
                didOpen: () => Swal.showLoading()
            });

            try {
                for (const id of modifiedIds) {
                    const updates = pendingTableChanges[id];
                    const preorder = allPreorders.find(p => p.id == id);
                    if (!preorder) continue;

                    let savePayload = { ...updates };

                    let res = await _supabase.from('preorders').update(savePayload).eq('id', id);

                    // Fallbacks for schema errors
                    if (res.error) {
                        delete savePayload.cost_price;
                        delete savePayload.reserve_amount;
                        delete savePayload.start_date;
                        delete savePayload.arrival_date;
                        res = await _supabase.from('preorders').update(savePayload).eq('id', id);
                    }
                    if (res.error) {
                        delete savePayload.max_stock;
                        delete savePayload.per_person_limit;
                        delete savePayload.payment_deadline;
                        res = await _supabase.from('preorders').update(savePayload).eq('id', id);
                    }

                    if (!res.error) {
                        Object.assign(preorder, updates);
                    }
                }

                pendingTableChanges = {};
                Swal.fire({
                    title: '¡Cambios Guardados!',
                    text: 'Toda la tabla ha sido actualizada correctamente en Supabase.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            } catch (err) {
                console.error("Batch save error:", err);
                Swal.fire('Error', 'Hubo un problema guardando algunas preventas', 'error');
            }
        }

        isTableEditMode = false;
        $('#preorder-table-wrapper').removeClass('editing-mode');
        $('#btn-toggle-edit-mode').html('<i class="fas fa-edit"></i> EDITAR TABLA').css({
            background: 'rgba(0, 210, 255, 0.15)',
            borderColor: '#00d2ff',
            color: '#00d2ff'
        });
        filterAndRenderPreorders();
    } else {
        isTableEditMode = true;
        pendingTableChanges = {};
        $('#preorder-table-wrapper').addClass('editing-mode');
        $('#btn-toggle-edit-mode').html('<i class="fas fa-save"></i> GUARDAR CAMBIOS').css({
            background: 'linear-gradient(135deg, #00ff88 0%, #00b894 100%)',
            borderColor: '#00ff88',
            color: '#fff'
        });
        filterAndRenderPreorders();
    }
}

window.renderAdminPreorderTable = renderAdminPreorderTable;
function renderAdminPreorderTable(preorders) {
    const $tbody = $('#preorder-table-body');
    $tbody.empty();

    if (!preorders || preorders.length === 0) {
        $tbody.html(`
            <tr>
                <td colspan="13" style="text-align: center; padding: 50px; color: #64748b;">
                    <i class="fas fa-box-open" style="font-size: 2.5rem; margin-bottom: 10px; opacity: 0.4;"></i>
                    <p style="font-size: 1rem; font-weight: 700; color: #94a3b8; margin: 0;">No se encontraron preventas en el registro.</p>
                </td>
            </tr>
        `);
        return;
    }

    preorders.forEach(preorder => {
        const isPublic = preorder.is_public !== false;
        const maxStock = parseInt(preorder.max_stock) || 0;
        const costPrice = preorder.cost_price || '';
        const priceVal = preorder.price || '';
        const reserveVal = preorder.reserve_amount || '';
        const perPersonLimitVal = preorder.per_person_limit !== null && preorder.per_person_limit !== undefined ? preorder.per_person_limit : '';
        const startDateVal = preorder.start_date || '';
        const deadlineVal = preorder.payment_deadline || preorder.deadline || '';
        const arrivalDateVal = preorder.arrival_date || '';

        let clients = preorder.clients_list;
        if (typeof clients === 'string') {
            try { clients = JSON.parse(clients); } catch (e) { clients = []; }
        }
        if (!Array.isArray(clients)) clients = [];
        const reservedCount = clients.reduce((sum, c) => sum + (parseInt(c.qty) || 0), 0);

        const disabledAttr = isTableEditMode ? '' : 'disabled';
        const pointerEvents = isTableEditMode ? 'auto' : 'none';

        const $tr = $(`
            <tr class="sheet-tr" data-id="${preorder.id}">
                <td class="sheet-td" style="text-align: center;">
                    <img src="${preorder.image_url || 'https://via.placeholder.com/100?text=Sin+Imagen'}" class="sheet-img-thumb" alt="${preorder.name}">
                </td>
                <td class="sheet-td">
                    <input type="text" class="sheet-input sheet-input-name" value="${preorder.name || ''}" style="width: 100%; min-width: 180px; pointer-events: ${pointerEvents};" ${disabledAttr}>
                </td>
                <td class="sheet-td">
                    <select class="sheet-select sheet-select-tcg" style="pointer-events: ${pointerEvents};" ${disabledAttr}>
                        <option value="yugioh" ${(preorder.tcg || '').toLowerCase() === 'yugioh' ? 'selected' : ''}>Yu-Gi-Oh!</option>
                        <option value="pokemon" ${(preorder.tcg || '').toLowerCase() === 'pokemon' ? 'selected' : ''}>Pokémon</option>
                        <option value="onepiece" ${(preorder.tcg || '').toLowerCase() === 'onepiece' ? 'selected' : ''}>One Piece</option>
                        <option value="lorcana" ${(preorder.tcg || '').toLowerCase() === 'lorcana' ? 'selected' : ''}>Lorcana</option>
                        <option value="other" ${(preorder.tcg || '').toLowerCase() === 'other' ? 'selected' : ''}>Otro</option>
                    </select>
                </td>
                <td class="sheet-td" style="text-align: center;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                        <button class="sheet-btn-quick sub btn-sub-stock" title="Reducir Stock Total (-1)" style="pointer-events: ${pointerEvents};" ${disabledAttr}>-</button>
                        <input type="number" class="sheet-input sheet-input-stock" value="${maxStock}" min="0" style="pointer-events: ${pointerEvents};" ${disabledAttr}>
                        <button class="sheet-btn-quick add btn-add-stock" title="Aumentar Stock Total (+1)" style="pointer-events: ${pointerEvents};" ${disabledAttr}>+</button>
                    </div>
                </td>
                <td class="sheet-td">
                    <input type="text" class="sheet-input sheet-input-price input-price" value="${priceVal}" style="pointer-events: ${pointerEvents};" ${disabledAttr}>
                </td>
                <td class="sheet-td">
                    <input type="text" class="sheet-input sheet-input-price input-reserve" value="${reserveVal}" style="pointer-events: ${pointerEvents};" ${disabledAttr}>
                </td>
                <td class="sheet-td">
                    <input type="text" class="sheet-input sheet-input-price input-cost" value="${costPrice}" style="pointer-events: ${pointerEvents};" ${disabledAttr}>
                </td>
                <td class="sheet-td" style="text-align: center;">
                    <input type="number" class="sheet-input sheet-input-stock input-per-person" value="${perPersonLimitVal}" min="1" style="pointer-events: ${pointerEvents};" ${disabledAttr}>
                </td>
                <td class="sheet-td">
                    <input type="date" class="sheet-input sheet-input-date input-start-date" value="${startDateVal}" style="pointer-events: ${pointerEvents};" ${disabledAttr}>
                </td>
                <td class="sheet-td">
                    <input type="date" class="sheet-input sheet-input-date input-deadline" value="${deadlineVal}" style="pointer-events: ${pointerEvents};" ${disabledAttr}>
                </td>
                <td class="sheet-td">
                    <input type="date" class="sheet-input sheet-input-date input-arrival-date" value="${arrivalDateVal}" style="pointer-events: ${pointerEvents};" ${disabledAttr}>
                </td>
                <td class="sheet-td" style="text-align: center;">
                    <label class="switch" style="transform: scale(0.7); margin: 0 auto; display: block; pointer-events: ${pointerEvents};">
                        <input type="checkbox" class="toggle-public-sheet" ${isPublic ? 'checked' : ''} ${disabledAttr}>
                        <span class="slider"></span>
                    </label>
                </td>
                <td class="sheet-td" style="text-align: center;">
                    <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
                        <button class="btn-clients-badge btn-clients" title="Ver Lista de Clientes (${reservedCount})">
                            <i class="fas fa-users"></i> Clientes (${reservedCount})
                        </button>
                        <button class="btn-icon-square btn-edit-sheet" title="${isTableEditMode ? 'Guardar Cambios' : 'Editar'}"><i class="fas ${isTableEditMode ? 'fa-save' : 'fa-pen'}"></i></button>
                        <button class="btn-icon-square danger btn-delete-sheet" title="Eliminar"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `);

        // Helper to record changes locally in pendingTableChanges
        const trackChange = (fieldUpdates) => {
            if (!pendingTableChanges[preorder.id]) {
                pendingTableChanges[preorder.id] = {};
            }
            Object.assign(pendingTableChanges[preorder.id], fieldUpdates);
        };

        // Row events
        $tr.find('.btn-clients').click(() => openClientsModal(preorder));
        $tr.find('.btn-edit-sheet').click(() => {
            if (!isTableEditMode) {
                editPreorder(preorder);
            } else {
                toggleTableEditMode(); // Save batch
            }
        });
        $tr.find('.btn-delete-sheet').click(() => deletePreorder(preorder.id));

        $tr.find('.toggle-public-sheet').change(function() {
            const val = $(this).is(':checked');
            trackChange({ is_public: val });
        });

        // Quick Stock -1
        $tr.find('.btn-sub-stock').click(function() {
            const current = parseInt($tr.find('.sheet-input-stock').val()) || 0;
            if (current <= 0) return;
            const newStock = current - 1;
            $tr.find('.sheet-input-stock').val(newStock);
            trackChange({ max_stock: newStock });
        });

        // Quick Stock +1
        $tr.find('.btn-add-stock').click(function() {
            const current = parseInt($tr.find('.sheet-input-stock').val()) || 0;
            const newStock = current + 1;
            $tr.find('.sheet-input-stock').val(newStock);
            trackChange({ max_stock: newStock });
        });

        // Stock input direct change
        $tr.find('.sheet-input-stock').on('input change', function() {
            const newStock = parseInt($(this).val()) || 0;
            trackChange({ max_stock: newStock });
        });

        // Name change
        $tr.find('.sheet-input-name').on('input change', function() {
            const newName = $(this).val().trim();
            if (newName) {
                trackChange({ name: newName });
            }
        });

        // TCG change
        $tr.find('.sheet-select-tcg').on('change', function() {
            trackChange({ tcg: $(this).val() });
        });

        // Price change
        $tr.find('.input-price').on('input change', function() {
            trackChange({ price: $(this).val().trim() });
        });

        // Reserve Amount change
        $tr.find('.input-reserve').on('input change', function() {
            trackChange({ reserve_amount: $(this).val().trim() });
        });

        // Cost Price change
        $tr.find('.input-cost').on('input change', function() {
            trackChange({ cost_price: $(this).val().trim() });
        });

        // Per Person Limit change
        $tr.find('.input-per-person').on('input change', function() {
            const val = $(this).val().trim();
            trackChange({ per_person_limit: val ? (parseInt(val) || null) : null });
        });

        // Start Date change
        $tr.find('.input-start-date').on('change', function() {
            trackChange({ start_date: $(this).val() });
        });

        // Deadline change
        $tr.find('.input-deadline').on('change', function() {
            const val = $(this).val();
            trackChange({ payment_deadline: val, deadline: val });
        });

        // Arrival Date change
        $tr.find('.input-arrival-date').on('change', function() {
            trackChange({ arrival_date: $(this).val() });
        });

        $tbody.append($tr);
    });
}

function openClientsModal(preorder) {
    activeClientsPreorder = preorder;
    $('#active-clients-preorder-id').val(preorder.id);
    $('#clients-modal-preorder-title').text('Clientes: ' + preorder.name);

    let clients = preorder.clients_list;
    if (typeof clients === 'string') {
        try { clients = JSON.parse(clients); } catch (e) { clients = []; }
    }
    if (!Array.isArray(clients)) clients = [];

    currentClientsList = [...clients];

    $('#client-input-name').val('');
    $('#client-input-qty').val('');
    $('#client-input-deposit').val('');
    $('#client-input-status-payment').val('Pendiente');
    $('#client-input-status-delivery').val('Por Entregar');

    renderClientsTable();
    $('#preorder-clients-modal').addClass('active');
}

function addClientEntry() {
    const name = $('#client-input-name').val().trim();
    const qty = parseInt($('#client-input-qty').val()) || 1;
    const rawDeposit = $('#client-input-deposit').val().trim();
    const statusPayment = $('#client-input-status-payment').val() || 'Pendiente';
    const statusDelivery = $('#client-input-status-delivery').val() || 'Por Entregar';

    if (!name) {
        Swal.fire('Atención', 'Escribe el nombre del cliente', 'warning');
        return;
    }

    const deposit = parseFloat(rawDeposit.replace(/[^0-9.]/g, '')) || 0;

    currentClientsList.push({
        id: Date.now(),
        name,
        qty,
        deposit,
        status_payment: statusPayment,
        status_delivery: statusDelivery,
        status: statusPayment // fallback
    });

    $('#client-input-name').val('');
    $('#client-input-qty').val('');
    $('#client-input-deposit').val('');

    renderClientsTable();
}

function removeClientEntry(clientId) {
    currentClientsList = currentClientsList.filter(c => c.id !== clientId);
    renderClientsTable();
}

function renderClientsTable() {
    const $tbody = $('#client-table-body');
    $tbody.empty();

    const maxStock = activeClientsPreorder ? (parseInt(activeClientsPreorder.max_stock) || 0) : 0;
    const rawPrice = activeClientsPreorder ? (activeClientsPreorder.price || '0') : '0';
    const unitPrice = parseFloat(rawPrice.replace(/[^0-9.]/g, '')) || 0;

    let totalReserved = 0;

    if (currentClientsList.length === 0) {
        $tbody.html('<tr><td colspan="7" style="padding: 20px; text-align: center; color: #64748b;">Sin clientes registrados</td></tr>');
    } else {
        currentClientsList.forEach(client => {
            totalReserved += (parseInt(client.qty) || 0);

            const totalCost = unitPrice * (parseInt(client.qty) || 0);
            const remaining = Math.max(0, totalCost - (parseFloat(client.deposit) || 0));

            const paymentStatus = client.status_payment || client.status || (client.deposit >= totalCost && totalCost > 0 ? 'Liquidado' : (client.deposit > 0 ? 'Pago Parcial' : 'Pendiente'));
            const deliveryStatus = client.status_delivery || 'Por Entregar';

            let paymentColor = '#f5af19';
            if (paymentStatus === 'Liquidado') paymentColor = '#00ff88';
            if (paymentStatus === 'Pago Parcial') paymentColor = '#00d2ff';

            let deliveryColor = '#cbd5e1';
            if (deliveryStatus === 'Entregado') deliveryColor = '#00ff88';
            if (deliveryStatus === 'En Camino') deliveryColor = '#00d2ff';
            if (deliveryStatus === 'Retrasado') deliveryColor = '#ff4757';

            const $row = $(`
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.06); transition: background 0.2s;">
                    <td style="padding: 10px 8px; font-weight: 700; color: #fff;">${client.name}</td>
                    <td style="padding: 10px 8px; text-align: center; font-weight: 800; color: #00d2ff;">${client.qty}</td>
                    <td style="padding: 10px 8px;">$${(parseFloat(client.deposit) || 0).toFixed(2)}</td>
                    <td style="padding: 10px 8px; color: ${remaining > 0 ? '#ff4757' : '#00ff88'}; font-weight: 700;">$${remaining.toFixed(2)}</td>
                    <td style="padding: 10px 8px;">
                        <select class="select-client-payment" style="background: rgba(15,23,42,0.8); border: 1px solid ${paymentColor}; color: ${paymentColor}; border-radius: 6px; padding: 4px 6px; font-size: 0.75rem; font-weight: 800; outline: none; cursor: pointer;">
                            <option value="Pendiente" ${paymentStatus === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="Pago Parcial" ${paymentStatus === 'Pago Parcial' ? 'selected' : ''}>Pago Parcial</option>
                            <option value="Liquidado" ${paymentStatus === 'Liquidado' ? 'selected' : ''}>Liquidado</option>
                        </select>
                    </td>
                    <td style="padding: 10px 8px;">
                        <select class="select-client-delivery" style="background: rgba(15,23,42,0.8); border: 1px solid ${deliveryColor}; color: ${deliveryColor}; border-radius: 6px; padding: 4px 6px; font-size: 0.75rem; font-weight: 800; outline: none; cursor: pointer;">
                            <option value="Por Entregar" ${deliveryStatus === 'Por Entregar' ? 'selected' : ''}>Por Entregar</option>
                            <option value="En Camino" ${deliveryStatus === 'En Camino' ? 'selected' : ''}>En Camino</option>
                            <option value="Entregado" ${deliveryStatus === 'Entregado' ? 'selected' : ''}>Entregado</option>
                            <option value="Retrasado" ${deliveryStatus === 'Retrasado' ? 'selected' : ''}>Retrasado</option>
                        </select>
                    </td>
                    <td style="padding: 10px 8px; text-align: center;">
                        <button type="button" class="btn-del-client" style="background: rgba(255,71,87,0.1); border: 1px solid rgba(255,71,87,0.3); color: #ff4757; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 0.82rem;"><i class="fas fa-times"></i></button>
                    </td>
                </tr>
            `);

            $row.find('.select-client-payment').on('change', function() {
                client.status_payment = $(this).val();
                client.status = $(this).val();
                renderClientsTable();
            });

            $row.find('.select-client-delivery').on('change', function() {
                client.status_delivery = $(this).val();
                renderClientsTable();
            });

            $row.find('.btn-del-client').click(() => removeClientEntry(client.id));
            $tbody.append($row);
        });
    }

    $('#lbl-total-reserved').text(totalReserved);
    $('#lbl-total-max').text(maxStock);
}

async function saveClientsListForActivePreorder() {
    if (!activeClientsPreorder) return;

    Swal.fire({ title: 'Guardando clientes...', didOpen: () => Swal.showLoading() });

    try {
        const { error } = await _supabase
            .from('preorders')
            .update({ clients_list: currentClientsList })
            .eq('id', activeClientsPreorder.id);

        if (error) throw error;

        Swal.fire({
            title: '¡Guardado!',
            text: 'Lista de clientes actualizada',
            icon: 'success',
            timer: 1200,
            showConfirmButton: false
        });

        $('#preorder-clients-modal').removeClass('active');
        loadPreorders();
    } catch (e) {
        Swal.fire('Error', 'No se pudieron guardar los clientes: ' + (e.message || e), 'error');
    }
}

async function savePreorder() {
    const id = $('#edit-preorder-id').val();

    if (!id) {
        try {
            const { count, error: countError } = await _supabase
                .from('preorders')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', currentUser.id);

            if (!countError) {
                const limit = currentUser.max_preorders || 1;
                if (count >= limit) {
                    Swal.fire({
                        title: 'Límite alcanzado',
                        text: `Has alcanzado el límite de ${limit} preventas.`,
                        icon: 'warning',
                        footer: '<a href="admin.html">Sube a Premium para aumentar tu límite</a>'
                    });
                    return;
                }
            }
        } catch (e) { console.error("Limit check fail:", e); }
    }

    const name = $('#preorder-name').val().trim();
    const imageUrl = $('#preorder-image-url').val().trim();
    const tcg = $('#preorder-tcg').val();
    const maxStock = parseInt($('#preorder-max-stock').val()) || 0;
    const costPrice = $('#preorder-cost-price').val().trim();
    const price = $('#preorder-price').val().trim();
    const reserveAmount = $('#preorder-reserve-amount').val().trim();
    const personLimit = $('#preorder-person-limit').val().trim();
    const startDate = $('#preorder-start-date').val();
    const deadline = $('#preorder-deadline').val();
    const arrivalDate = $('#preorder-arrival-date').val();
    const isPublic = $('#preorder-public').is(':checked');

    if (!name) {
        Swal.fire('Atención', 'El nombre de la preventa es obligatorio', 'warning');
        return;
    }

    const preorderData = {
        user_id: currentUser.id,
        name,
        image_url: imageUrl,
        tcg,
        max_stock: maxStock,
        cost_price: costPrice,
        price,
        reserve_amount: reserveAmount,
        per_person_limit: personLimit ? (parseInt(personLimit) || null) : null,
        start_date: startDate,
        payment_deadline: deadline,
        arrival_date: arrivalDate,
        is_public: isPublic
    };

    Swal.fire({ title: 'Guardando...', didOpen: () => Swal.showLoading() });

    let error;
    try {
        if (id) {
            const result = await _supabase
                .from('preorders')
                .update(preorderData)
                .eq('id', id);
            error = result.error;
        } else {
            const result = await _supabase
                .from('preorders')
                .insert([preorderData]);
            error = result.error;
        }
    } catch (e) { error = e; }

    // Fallback attempt if Supabase PostgREST complains about unknown columns
    if (error && error.message && error.message.includes('column')) {
        console.warn("Retrying save with standard core fields due to schema cache limit:", error.message);
        const fallbackData = {
            user_id: currentUser.id,
            name,
            image_url: imageUrl,
            price,
            payment_deadline: deadline,
            tcg,
            is_public: isPublic
        };
        try {
            if (id) {
                const res = await _supabase.from('preorders').update(fallbackData).eq('id', id);
                error = res.error;
            } else {
                const res = await _supabase.from('preorders').insert([fallbackData]);
                error = res.error;
            }
        } catch (e) { error = e; }
    }

    Swal.close();

    if (error) {
        Swal.fire('Error', 'No se pudo guardar la preventa: ' + (error.message || error), 'error');
    } else {
        if (typeof VikingData !== 'undefined') {
            try {
                VikingData.save({
                    ...preorderData,
                    type: 'preorder'
                });
            } catch (e) { console.warn("VikingData sync fail:", e); }
        }

        Swal.fire({
            title: '¡Éxito!',
            text: 'Preventa guardada correctamente',
            icon: 'success',
            timer: 1200,
            showConfirmButton: false
        });

        $('#preorder-modal').removeClass('active');
        loadPreorders();
    }
}

function editPreorder(preorder) {
    resetModal();
    $('#edit-preorder-id').val(preorder.id);
    $('#preorder-name').val(preorder.name || '');
    $('#preorder-image-url').val(preorder.image_url || '');
    if (preorder.image_url) $('#drop-zone-preorder .file-name').text('Imagen cargada').css('color', '#00ff88');
    $('#preorder-tcg').val(preorder.tcg || 'yugioh');
    $('#preorder-max-stock').val(preorder.max_stock !== undefined && preorder.max_stock !== null ? preorder.max_stock : '');
    $('#preorder-cost-price').val(preorder.cost_price || '');
    $('#preorder-price').val(preorder.price || '');
    $('#preorder-reserve-amount').val(preorder.reserve_amount || '');
    $('#preorder-person-limit').val(preorder.per_person_limit !== null && preorder.per_person_limit !== undefined ? preorder.per_person_limit : '');
    $('#preorder-start-date').val(preorder.start_date || '');
    $('#preorder-deadline').val(preorder.payment_deadline || preorder.deadline || '');
    $('#preorder-arrival-date').val(preorder.arrival_date || '');
    $('#preorder-public').prop('checked', preorder.is_public !== false);

    $('#preorder-modal').addClass('active');
}

async function deletePreorder(id) {
    const result = await Swal.fire({
        title: '¿Eliminar preventa?',
        text: "Esta acción no se puede deshacer",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4757',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            const { error } = await _supabase.from('preorders').delete().eq('id', id);
            if (error) throw error;
            loadPreorders();
        } catch (err) {
            Swal.fire('Error', 'No se pudo eliminar la preventa', 'error');
        }
    }
}

async function updateVisibility(id, isPublic) {
    try {
        const { error } = await _supabase
            .from('preorders')
            .update({ is_public: isPublic })
            .eq('id', id);

        if (error) throw error;

        Swal.fire({
            title: isPublic ? 'Público' : 'Privado',
            icon: 'info',
            timer: 800,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });

        loadPreorders();
    } catch (err) {
        Swal.fire('Error', 'No se pudo actualizar la visibilidad', 'error');
    }
}

window.openShareModal = function(title, type, id) {
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/');
    const shareUrl = `${baseUrl}public.html?user=${currentUser.username}&view=${type}&id=${id}`;

    $('#share-modal-title').text('Compartir ' + title);
    $('#share-link-input').val(shareUrl);

    // QR Code
    $('#share-qr-code').empty();
    new QRCode(document.getElementById("share-qr-code"), {
        text: shareUrl,
        width: 160,
        height: 160,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });

    // Social buttons
    $('#share-wa').off('click').on('click', () => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent('Mira esta preventa en mi tienda: ' + shareUrl)}`, '_blank'));
    $('#share-tg').off('click').on('click', () => window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Mira esta preventa en mi tienda')}`, '_blank'));
    $('#share-fb').off('click').on('click', () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank'));
    $('#share-ms').off('click').on('click', () => window.open(`fb-messenger://share/?link=${encodeURIComponent(shareUrl)}`, '_blank'));

    $('#share-overlay').addClass('active');
};

$('#btn-copy-share-link').click(function() {
    const input = document.getElementById('share-link-input');
    input.select();
    document.execCommand('copy');
    Swal.fire({
        title: '¡Copiado!',
        text: 'Enlace copiado al portapapeles',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
    });
});

function resetModal() {
    $('#edit-preorder-id').val('');
    $('#preorder-name').val('');
    $('#preorder-image-url').val('');
    $('#drop-zone-preorder .file-name').text('');
    $('#preorder-tcg').val('yugioh');
    $('#preorder-max-stock').val('');
    $('#preorder-cost-price').val('');
    $('#preorder-price').val('');
    $('#preorder-reserve-amount').val('');
    $('#preorder-person-limit').val('');
    $('#preorder-start-date').val('');
    $('#preorder-deadline').val('');
    $('#preorder-arrival-date').val('');
    $('#preorder-public').prop('checked', true);

    // Reset active tab to first tab
    $('#preorder-modal-tabs .modal-tab-btn').removeClass('active');
    $('#preorder-modal-tabs .modal-tab-btn[data-tab="preorder-tab-info"]').addClass('active');
    $('#preorder-modal .tab-pane').removeClass('active');
    $('#preorder-tab-info').addClass('active');

    activeClientsPreorder = null;
    currentClientsList = [];
}
