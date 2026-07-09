let currentUser = null;

$(document).ready(async function() {
    console.log("Initializing Preorders Module...");
    try {
        await checkSession();
    } catch (err) {
        console.error("Critical initialization error:", err);
    }

    // --- Navigation & UI ---
    $('#btn-open-add-modal').click(function() {
        resetModal();
        $('#preorder-modal').addClass('active');
        switchTab('tab-search');
    });

    $('#close-preorder-modal').click(function() {
        $('#preorder-modal').removeClass('active');
    });

    $(document).on('click', '#avatar-btn', function(e) {
        e.stopPropagation();
        $('#user-dropdown').toggleClass('active');
    });

    $('#menu-btn-logout').click(function(e) {
        e.preventDefault();
        handleLogout();
    });

    // --- Tab Logic ---
    $('.modal-tab-btn').click(function() {
        const tabId = $(this).data('tab');
        switchTab(tabId);
    });

    function switchTab(tabId) {
        $('.modal-tab-btn').removeClass('active');
        $(`.modal-tab-btn[data-tab="${tabId}"]`).addClass('active');
        $('.tab-content').hide();
        $(`#${tabId}`).show();
    }

    // --- Search Logic ---
    $('#btn-external-search').click(function() {
        searchExternalSets();
    });

    $('#external-search-input').keypress(function(e) {
        if (e.which == 13) searchExternalSets();
    });

    // --- Save Logic ---
    $('#btn-save-preorder').click(function() {
        savePreorder();
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

        console.log("Session found for user:", session.user.id);
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
        console.log("Auth success. Showing content for", user.username);
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
    $('#preorder-list').html('<div class="loading" style="grid-column: 1/-1; padding: 100px; text-align: center;"><i class="fas fa-circle-notch fa-spin"></i> Cargando preventas...</div>');

    try {
        const { data: preorders, error } = await _supabase
            .from('preorders')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!preorders || preorders.length === 0) {
            $('#preorder-list').html('<div class="empty" style="grid-column: 1/-1; padding: 100px; text-align: center; color: #666;">No tienes preventas registradas.</div>');
            return;
        }

        const $container = $('#preorder-list');
        $container.empty();

        preorders.forEach(preorder => {
            const isPublic = preorder.is_public !== false;
            const $card = $(`
                <div class="premium-card">
                    <div class="premium-card-image">
                        <img src="${preorder.image_url || 'https://via.placeholder.com/300x150?text=Sin+Imagen'}" alt="${preorder.name}">
                    </div>
                    <div style="flex: 1;">
                        <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: #fff; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${preorder.name}</h3>
                        <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                            <div style="color: #00d2ff; font-weight: 900; font-size: 1.2rem;">${preorder.price || 'Consultar'}</div>
                            <div style="font-size: 0.7rem; color: #aaa; text-transform: uppercase; font-weight: 800; background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">${preorder.tcg}</div>
                        </div>
                        <div style="font-size: 0.8rem; color: #ff4757; font-weight: 800; margin-top: 8px; display: flex; align-items: center; gap: 6px;">
                            <i class="fas fa-clock"></i> Límite: ${preorder.payment_deadline || 'No definido'}
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 5px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label class="switch" style="transform: scale(0.75);">
                                <input type="checkbox" class="toggle-public" data-id="${preorder.id}" ${isPublic ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                            <span style="font-size: 9px; color: #666; font-weight: 800; letter-spacing: 0.5px;">${isPublic ? 'PÚBLICO' : 'PRIVADO'}</span>
                        </div>
                        <div style="display: flex; gap: 8px;">
                             <button class="btn btn-secondary btn-share" style="padding: 8px 12px; border-radius: 10px;"><i class="fas fa-share-alt"></i></button>
                             <button class="btn btn-edit" style="padding: 8px 12px; border-radius: 10px; background: rgba(0,210,255,0.1); color: #00d2ff; border: 1px solid rgba(0,210,255,0.2);"><i class="fas fa-pen"></i></button>
                             <button class="btn btn-danger btn-delete" style="padding: 8px 12px; border-radius: 10px;"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            `);

            $card.find('.btn-edit').click(() => editPreorder(preorder));
            $card.find('.btn-share').click(() => openShareModal(preorder.name, 'preorders', preorder.id));
            $card.find('.btn-delete').click(() => deletePreorder(preorder.id));
            $card.find('.toggle-public').change(function() {
                updateVisibility(preorder.id, $(this).is(':checked'));
            });

            $container.append($card);
        });
    } catch (err) {
        console.error("Load preorders error:", err);
        $('#preorder-list').html('<div class="error" style="grid-column: 1/-1; padding: 100px; text-align: center; color: #ff4757;">Error al cargar preventas. Por favor, refresca la página.</div>');
    }
}

async function searchExternalSets() {
    const query = $('#external-search-input').val().trim().toLowerCase();

    if (query.length < 3) {
        Swal.fire('Atención', 'Por favor, escribe al menos 3 caracteres para buscar.', 'info');
        return;
    }

    $('#external-search-results').html('<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #888;"><i class="fas fa-circle-notch fa-spin fa-2x"></i><br><br>Buscando en bases de datos mundiales...</div>');

    try {
        const searchPromises = [
            // Yu-Gi-Oh Sets
            (typeof getYgoSets === 'function' ? getYgoSets() : Promise.resolve([])),
            // Yu-Gi-Oh Cards
            fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : {data:[]}).catch(() => ({data:[]})),
            // Pokémon Sets
            fetch('https://api.tcgdex.net/v2/en/sets').then(r => r.json()).catch(() => []),
            // Pokémon Cards
            fetch(`https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : []).catch(() => []),
            // Lorcana Sets
            fetch(`https://api.lorcana-api.com/sets/fetch?search=name~${encodeURIComponent(query)}`).then(r => r.json()).catch(() => []),
            // Lorcana Cards
            fetch(`https://api.lorcana-api.com/cards/fetch?search=name~${encodeURIComponent(query)}&displayonly=name;image`).then(r => r.json()).catch(() => []),
            // Viking Search (internal)
            (typeof VikingData !== 'undefined' ? VikingData.search(query) : Promise.resolve([]))
        ];

        const [ygoSets, ygoCards, pkSets, pkCards, lorSets, lorCards, vikResults] = await Promise.all(searchPromises);

        let combinedResults = [];

        // Process Viking
        if (Array.isArray(vikResults)) {
            combinedResults.push(...vikResults.map(i => ({
                name: i.name,
                image: i.image,
                tcg: i.tcg || 'custom',
                source: 'VikingData'
            })));
        }

        // Process YGO Sets
        if (Array.isArray(ygoSets)) {
            ygoSets.filter(s => s.set_name.toLowerCase().includes(query)).forEach(s => {
                combinedResults.push({
                    name: s.set_name,
                    image: `https://images.ygoprodeck.com/images/sets/${s.set_code}.jpg`,
                    tcg: 'yugioh',
                    source: 'YGOSet'
                });
            });
        }

        // Process YGO Cards
        if (ygoCards && ygoCards.data) {
            ygoCards.data.forEach(c => {
                combinedResults.push({
                    name: c.name,
                    image: c.card_images[0].image_url_small,
                    tcg: 'yugioh',
                    source: 'YGOCard'
                });
            });
        }

        // Process PKM Sets
        if (Array.isArray(pkSets)) {
            pkSets.filter(s => s.name.toLowerCase().includes(query)).forEach(s => {
                combinedResults.push({
                    name: s.name,
                    image: `${s.logo}.png`,
                    tcg: 'pokemon',
                    source: 'PKMSet'
                });
            });
        }

        // Process PKM Cards
        if (Array.isArray(pkCards)) {
            pkCards.forEach(c => {
                combinedResults.push({
                    name: c.name,
                    image: `${c.image}/low.webp`,
                    tcg: 'pokemon',
                    source: 'PKMCard'
                });
            });
        }

        // Process Lorcana Sets
        if (Array.isArray(lorSets)) {
            lorSets.forEach(s => {
                combinedResults.push({
                    name: s.Name,
                    image: 'https://lorcana-api.com/img/logo.svg',
                    tcg: 'lorcana',
                    source: 'LorSet'
                });
            });
        }

        // Process Lorcana Cards
        if (Array.isArray(lorCards)) {
            lorCards.forEach(c => {
                combinedResults.push({
                    name: c.Name,
                    image: c.Image,
                    tcg: 'lorcana',
                    source: 'LorCard'
                });
            });
        }

        // Static One Piece
        const opSets = [
            { name: 'Romance Dawn (OP-01)', image: 'https://m.media-amazon.com/images/I/71b2S7A7VWL._AC_SL1500_.jpg', tcg: 'onepiece' },
            { name: 'Paramount War (OP-02)', image: 'https://m.media-amazon.com/images/I/71-0fV5oIIL._AC_SL1500_.jpg', tcg: 'onepiece' },
            { name: 'Pillars of Strength (OP-03)', image: 'https://m.media-amazon.com/images/I/71K6Ew5L9VL._AC_SL1500_.jpg', tcg: 'onepiece' },
            { name: 'Kingdoms of Intrigue (OP-04)', image: 'https://m.media-amazon.com/images/I/71Y8e6lE-KL._AC_SL1500_.jpg', tcg: 'onepiece' },
            { name: 'Awakening of the New Era (OP-05)', image: 'https://m.media-amazon.com/images/I/71f-W-q7GOL._AC_SL1500_.jpg', tcg: 'onepiece' },
            { name: 'Wings of the Captain (OP-06)', image: 'https://m.media-amazon.com/images/I/71Z8I6qG5OL._AC_SL1500_.jpg', tcg: 'onepiece' },
            { name: '500 Years in the Future (OP-07)', image: 'https://m.media-amazon.com/images/I/71H-Z-W-GOL._AC_SL1500_.jpg', tcg: 'onepiece' }
        ];
        opSets.filter(s => s.name.toLowerCase().includes(query)).forEach(s => combinedResults.push({...s, source: 'OPStatic'}));

        // Deduplicate
        const unique = [];
        const seen = new Set();
        combinedResults.forEach(i => {
            const key = (i.image + i.name).toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(i);
            }
        });

        displayExternalResults(unique);
    } catch (e) {
        console.error("Search error:", e);
        $('#external-search-results').html('<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #ff4757;">Error al buscar. Inténtalo de nuevo o revisa tu conexión.</div>');
    }
}

function displayExternalResults(results) {
    const $container = $('#external-search-results');
    $container.empty();

    if (results.length === 0) {
        $container.html('<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #666;">No se encontraron resultados oficiales.</div>');
        return;
    }

    results.forEach(item => {
        const $item = $(`
            <div class="external-card-result" title="${item.name}">
                <div style="width: 100%; height: 120px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                    <img src="${item.image}" style="max-width: 90%; max-height: 90%; object-fit: contain;" onerror="this.src='https://via.placeholder.com/100x80?text=Set'">
                </div>
                <div style="font-size: 10px; font-weight: 800; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.name}</div>
                <div style="font-size: 8px; color: #00d2ff; text-transform: uppercase; font-weight: 700; margin-top: 5px;">${item.tcg}</div>
            </div>
        `);

        $item.click(() => {
            $('#preorder-name').val(item.name);
            $('#preorder-image-url').val(item.image);
            $('#preorder-tcg').val(item.tcg);

            // Switch to DATOS tab
            $('.modal-tab-btn[data-tab="tab-data"]').click();

            Swal.fire({
                title: 'Seleccionado',
                text: item.name,
                icon: 'success',
                timer: 1000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        });

        $container.append($item);
    });
}

async function savePreorder() {
    const id = $('#edit-preorder-id').val();

    // Limit check for new preorders
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
    const price = $('#preorder-price').val().trim();
    const deadline = $('#preorder-deadline').val().trim();
    const tcg = $('#preorder-tcg').val();
    const isPublic = $('#preorder-public').is(':checked');

    if (!name) {
        Swal.fire('Atención', 'El nombre de la preventa es obligatorio', 'warning');
        return;
    }

    const preorderData = {
        user_id: currentUser.id,
        name,
        image_url: imageUrl,
        price,
        payment_deadline: deadline,
        tcg,
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

    Swal.close();

    if (error) {
        Swal.fire('Error', 'No se pudo guardar la preventa: ' + (error.message || error), 'error');
    } else {
        // Save to VikingData (internal sync)
        if (typeof VikingData !== 'undefined') {
            try {
                VikingData.save({
                    ...preorderData,
                    type: 'preorder'
                });
            } catch (e) { console.warn("VikingData sync fail:", e); }
        }

        Swal.fire('¡Éxito!', 'Preventa guardada correctamente', 'success');
        $('#preorder-modal').removeClass('active');
        loadPreorders();
    }
}

function editPreorder(preorder) {
    resetModal();
    $('#modal-title').text('EDITAR PREVENTA');
    $('#edit-preorder-id').val(preorder.id);
    $('#preorder-name').val(preorder.name);
    $('#preorder-image-url').val(preorder.image_url);
    $('#preorder-price').val(preorder.price);
    $('#preorder-deadline').val(preorder.payment_deadline);
    $('#preorder-tcg').val(preorder.tcg);
    $('#preorder-public').prop('checked', preorder.is_public !== false);

    $('#preorder-modal').addClass('active');

    // Switch to DATOS tab for editing
    $('.modal-tab-btn[data-tab="tab-data"]').click();
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
        width: 180,
        height: 180,
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
    $('#modal-title').text('NUEVA PREVENTA');
    $('#edit-preorder-id').val('');
    $('#preorder-name').val('');
    $('#preorder-image-url').val('');
    $('#drop-zone-preorder .file-name').text('');
    $('#preorder-price').val('');
    $('#preorder-deadline').val('');
    $('#preorder-tcg').val('yugioh');
    $('#preorder-public').prop('checked', true);
    $('#external-search-input').val('');
    $('#external-search-results').html(`
        <div style="grid-column: 1/-1; text-align: center; color: #444; padding: 60px;">
            <i class="fas fa-search" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.3;"></i>
            <p style="font-weight: 600; opacity: 0.5;">Busca expansiones oficiales para auto-completar</p>
        </div>
    `);

    // Switch to Search tab by default
    $('.modal-tab-btn').removeClass('active');
    $('.modal-tab-btn[data-tab="tab-search"]').addClass('active');
    $('#tab-search').show();
    $('#tab-data').hide();
}
