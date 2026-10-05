let currentUser = null;
let allPreorders = [];
let activeClientsPreorder = null;
let currentClientsList = [];

$(document).ready(async function() {
    console.log("Initializing Preorders Module...");
    try {
        await checkSession();
    } catch (err) {
        console.error("Critical initialization error:", err);
    }

    // --- Navigation & Filter Drawer ---
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

    $('#btn-toggle-admin-filters').click(function() {
        $(this).toggleClass('active');
        $('#admin-filter-drawer').slideToggle(200).css('display', $(this).hasClass('active') ? 'flex' : 'none');
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
    $('#preorder-list').html('<div class="loading" style="grid-column: 1/-1; padding: 80px; text-align: center; color: #94a3b8; font-size: 1.1rem;"><i class="fas fa-circle-notch fa-spin fa-2x" style="color: #00d2ff;"></i><br><br>Cargando preventas...</div>');

    try {
        const { data: preorders, error } = await _supabase
            .from('preorders')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        allPreorders = preorders || [];
        updateDashboardMetrics();
        filterAndRenderPreorders();
    } catch (err) {
        console.error("Load preorders error:", err);
        $('#preorder-list').html('<div class="error" style="grid-column: 1/-1; padding: 80px; text-align: center; color: #ff4757;">Error al cargar preventas. Por favor, refresca la página.</div>');
    }
}

function updateDashboardMetrics() {
    let totalCount = allPreorders.length;
    let publicCount = 0;
    let totalReservations = 0;
    let totalAvailable = 0;

    allPreorders.forEach(p => {
        if (p.is_public !== false) publicCount++;

        let clients = p.clients_list;
        if (typeof clients === 'string') {
            try { clients = JSON.parse(clients); } catch (e) { clients = []; }
        }
        if (!Array.isArray(clients)) clients = [];

        let reserved = clients.reduce((sum, c) => sum + (parseInt(c.qty) || 0), 0);
        let maxStock = parseInt(p.max_stock) || 0;
        let available = Math.max(0, maxStock - reserved);

        totalReservations += reserved;
        totalAvailable += available;
    });

    $('#stat-total-preorders').text(totalCount);
    $('#stat-public-preorders').text(publicCount);
    $('#stat-total-reservations').text(totalReservations);
    $('#stat-available-stock').text(totalAvailable);
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

    renderPreordersList(filtered);
}

function renderPreordersList(preorders) {
    const $container = $('#preorder-list');
    $container.empty();

    if (!preorders || preorders.length === 0) {
        $container.html('<div class="empty" style="grid-column: 1/-1; padding: 80px; text-align: center; color: #64748b; font-size: 1rem;">No hay preventas registradas.</div>');
        return;
    }

    preorders.forEach(preorder => {
        const isPublic = preorder.is_public !== false;

        let clients = preorder.clients_list;
        if (typeof clients === 'string') {
            try { clients = JSON.parse(clients); } catch (e) { clients = []; }
        }
        if (!Array.isArray(clients)) clients = [];

        let reserved = clients.reduce((sum, c) => sum + (parseInt(c.qty) || 0), 0);
        let maxStock = parseInt(preorder.max_stock) || 0;
        let available = Math.max(0, maxStock - reserved);

        const $card = $(`
            <div class="product-ecom-card">
                <div class="card-img-box">
                    <img src="${preorder.image_url || 'https://via.placeholder.com/300x150?text=Sin+Imagen'}" alt="${preorder.name}">
                    <span class="badge-tcg-pill">${preorder.tcg || 'Otro'}</span>
                    <span class="badge-stock-pill ${available <= 0 ? 'out-of-stock' : ''}">
                        ${maxStock > 0 ? `${available} Disp.` : 'Consultar'}
                    </span>
                </div>

                <div style="padding: 12px 2px 2px 2px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <h3 style="margin: 0 0 6px 0; font-size: 1.05rem; font-weight: 800; color: #fff; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; min-height: 2.6em;">
                            ${preorder.name}
                        </h3>

                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.06);">
                            <div style="font-size: 1.2rem; font-weight: 900; color: #00d2ff;">
                                ${preorder.price || 'Consultar'}
                            </div>
                            <div style="font-size: 0.72rem; color: #ff4757; font-weight: 800; display: flex; align-items: center; gap: 4px;">
                                <i class="fas fa-clock"></i> ${preorder.payment_deadline || preorder.deadline || 'Fin N/A'}
                            </div>
                        </div>

                        ${preorder.reserve_amount ? `
                            <div style="font-size: 0.72rem; color: #f5af19; font-weight: 700; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                                <i class="fas fa-coins"></i> Aparta desde: ${preorder.reserve_amount.toString().includes('$') ? preorder.reserve_amount : `$${preorder.reserve_amount}`}
                            </div>
                        ` : ''}

                        ${preorder.arrival_date ? `
                            <div style="font-size: 0.72rem; color: #00ff88; font-weight: 700; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                                <i class="fas fa-truck"></i> Llegada: ${preorder.arrival_date}
                            </div>
                        ` : ''}
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.06);">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label class="switch" style="transform: scale(0.75);">
                                <input type="checkbox" class="toggle-public" data-id="${preorder.id}" ${isPublic ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                            <span style="font-size: 0.7rem; color: #94a3b8; font-weight: 800;">${isPublic ? 'PÚBLICO' : 'PRIVADO'}</span>
                        </div>
                        <div style="display: flex; gap: 6px;">
                            <button class="btn-icon-square btn-clients" title="Ver Clientes (${reserved})"><i class="fas fa-users"></i></button>
                            <button class="btn-icon-square btn-share" title="Compartir"><i class="fas fa-share-alt"></i></button>
                            <button class="btn-icon-square btn-edit" title="Editar"><i class="fas fa-pen"></i></button>
                            <button class="btn-icon-square danger btn-delete" title="Eliminar"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `);

        $card.find('.btn-clients').click(() => openClientsModal(preorder));
        $card.find('.btn-edit').click(() => editPreorder(preorder));
        $card.find('.btn-share').click(() => openShareModal(preorder.name, 'preorders', preorder.id));
        $card.find('.btn-delete').click(() => deletePreorder(preorder.id));
        $card.find('.toggle-public').change(function() {
            updateVisibility(preorder.id, $(this).is(':checked'));
        });

        $container.append($card);
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
    $('#client-input-qty').val('1');
    $('#client-input-deposit').val('');

    renderClientsTable();
    $('#preorder-clients-modal').addClass('active');
}

function addClientEntry() {
    const name = $('#client-input-name').val().trim();
    const qty = parseInt($('#client-input-qty').val()) || 1;
    const rawDeposit = $('#client-input-deposit').val().trim();
    const status = $('#client-input-status').val();

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
        status
    });

    $('#client-input-name').val('');
    $('#client-input-qty').val('1');
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
        $tbody.html('<tr><td colspan="6" style="padding: 16px; text-align: center; color: #64748b;">Sin clientes registrados</td></tr>');
    } else {
        currentClientsList.forEach(client => {
            totalReserved += client.qty;

            const totalCost = unitPrice * client.qty;
            const remaining = Math.max(0, totalCost - client.deposit);

            let statusColor = '#f5af19';
            if (client.status === 'Liquidado') statusColor = '#00ff88';
            if (client.status === 'Entregado') statusColor = '#00d2ff';

            const $row = $(`
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                    <td style="padding: 8px 6px; font-weight: 700; color: #fff;">${client.name}</td>
                    <td style="padding: 8px 6px; text-align: center;">${client.qty}</td>
                    <td style="padding: 8px 6px;">$${client.deposit.toFixed(2)}</td>
                    <td style="padding: 8px 6px; color: ${remaining > 0 ? '#ff4757' : '#00ff88'};">$${remaining.toFixed(2)}</td>
                    <td style="padding: 8px 6px;"><span style="color: ${statusColor}; font-weight: 800; font-size: 0.72rem;">${client.status}</span></td>
                    <td style="padding: 8px 6px; text-align: center;">
                        <button type="button" class="btn-del-client" style="background: none; border: none; color: #ff4757; cursor: pointer; font-size: 0.85rem;"><i class="fas fa-times"></i></button>
                    </td>
                </tr>
            `);

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
