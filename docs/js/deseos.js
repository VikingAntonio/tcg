let currentUser = null;
let ygoSetsCache = null;
let currentSlot = 0;
let currentEditingId = null;
let pendingWishlist = [];

function captureScroll() {
    return window.scrollY;
}

function restoreScroll(pos) {
    window.scrollTo(0, pos);
}

async function getYgoSets() {
    if (ygoSetsCache) return ygoSetsCache;
    try {
        const response = await fetch('https://db.ygoprodeck.com/api/v7/cardsets.php');
        ygoSetsCache = await response.json();
    } catch (e) {
        console.warn("Error fetching YGO sets:", e);
        ygoSetsCache = [];
    }
    return ygoSetsCache;
}

// --- Sharing System Functions ---
window.shareQR = null;

window.openShareModal = function(title, type, id) {
    const baseUrl = window.location.origin + '/public.html';
    const identifier = currentUser.username;

    // Build direct link
    let shareUrl = `${baseUrl}?id=${encodeURIComponent(identifier)}&view=${type}`;
    if (id !== null && id !== undefined) {
        if (type === 'wishlist') {
            shareUrl += `&slot=${id}`;
        }
    }

    $('#share-modal-title').text(`Compartir ${title}`);
    $('#share-link-input').val(shareUrl);
    $('#share-overlay').addClass('active');

    // Generate QR Code
    $('#share-qr-code').empty();
    window.shareQR = new QRCode(document.getElementById("share-qr-code"), {
        text: shareUrl,
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    // Setup Social Links
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(`¡Mira esto en VikingTCG: ${title}!`);

    $('#share-wa').off('click').on('click', () => window.open(`https://wa.me/?text=${encodedText}%20${encodedUrl}`, '_blank'));
    $('#share-tg').off('click').on('click', () => window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, '_blank'));
    $('#share-fb').off('click').on('click', () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank'));
    $('#share-ms').off('click').on('click', () => window.open(`fb-messenger://share/?link=${encodedUrl}`, '_blank'));
};

$(document).ready(async function() {
    // --- Share Modal Close & Actions ---
    $(document).on('click', '#close-share-modal, #share-overlay', function(e) {
        if (e.target === this || $(this).hasClass('close-btn')) {
            $('#share-overlay').removeClass('active');
        }
    });

    $(document).on('click', '#btn-copy-share-link', function() {
        const input = document.getElementById('share-link-input');
        input.select();
        input.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(input.value);

        const $btn = $(this);
        const originalHtml = $btn.html();
        $btn.html('<i class="fas fa-check"></i>').css('background', '#22c55e');
        setTimeout(() => {
            $btn.html(originalHtml).css('background', '');
        }, 2000);

        Swal.fire({
            icon: 'success',
            title: 'Enlace copiado',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
        });
    });

    await checkSession();
    initTheme();

    // Search event
    $('#btn-deseos-external-search').click(function(e) {
        e.preventDefault();
        searchExternalCard('#deseos-external-search-input', '#deseos-external-search-results', function(card) {
            addCardToWishlist(card);
        });
    });

    $('#deseos-external-search-input').keypress(function(e) {
        if (e.which == 13) {
            e.preventDefault();
            $('#btn-deseos-external-search').click();
        }
    });

    // Navigation and Logout
    $('#avatar-btn').click(function(e) {
        e.stopPropagation();
        $('#user-dropdown').toggleClass('active');
    });

    $(document).on('click', function(e) {
        if (!$(e.target).closest('.user-menu-container').length) {
            $('#user-dropdown').removeClass('active');
        }
    });

    // Slot switching
    $('.wishlist-tab-btn').click(function() {
        $('.wishlist-tab-btn').removeClass('active');
        $(this).addClass('active');
        currentSlot = parseInt($(this).data('index'));
        loadWishlist();
    });

    // Share current slot button
    $('<button id="btn-share-slot" class="btn btn-sm" style="margin-left: 10px; background: rgba(255,255,255,0.1);"><i class="fas fa-share-alt"></i> Compartir Slot</button>')
        .appendTo('.wishlist-tabs-container')
        .on('click', () => {
            window.openShareModal(`Buscamos - Slot ${currentSlot+1}`, 'wishlist', currentSlot);
        });

    $('#menu-btn-logout').click(async function(e) {
        e.preventDefault();
        await _supabase.auth.signOut();
        location.href = 'admin.html';
    });

    // Modal listeners
    $('#close-wishlist-modal').click(() => $('#wishlist-modal').removeClass('active'));

    $('#modal-holo-effect').on('change', function() {
        const val = $(this).val();
        if (val === 'custom-texture' || val === 'custom-foil') {
            $('#modal-mask-container').show();
        } else {
            $('#modal-mask-container').hide();
        }
    });

    $('#btn-wishlist-save-batch').click(function() {
        saveWishlistBatch();
    });

    $('#btn-save-wishlist-modal').click(async function() {
        if (!currentEditingId) return;

        const data = {
            rarity: $('#modal-rarity').val(),
            quantity: parseInt($('#modal-quantity').val()) || 1,
            holo_effect: $('#modal-holo-effect').val(),
            custom_mask_url: $('#modal-custom-mask').val(),
            use_3d: $('#modal-use-3d').is(':checked'),
            notes: $('#modal-notes').val()
        };

        Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        await updateWishlistItem(currentEditingId, data);

        Swal.fire({ icon: 'success', title: '¡Guardado!', timer: 1500, showConfirmButton: false });
        $('#wishlist-modal').removeClass('active');
        loadWishlist();
    });
});

function renderPendingWishlist() {
    const $container = $('#pending-wishlist-container');
    const $grid = $('#pending-wishlist-grid');
    $grid.empty();

    if (pendingWishlist.length === 0) {
        $container.hide();
        return;
    }

    $container.show();

    pendingWishlist.forEach((card, index) => {
        const $item = $(`
            <div class="fast-result-item" style="position: relative; width: 80px; height: 110px;" title="${card.name}">
                <img src="${card.image}" alt="${card.name}" style="width: 100%; height: 80px; object-fit: cover; border-radius: 4px;">
                <span style="font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; color: #fff;">${card.name}</span>
                <div class="btn-delete-card-top" style="top: -5px; right: -5px; width: 20px; height: 20px; font-size: 10px; line-height: 20px;" data-index="${index}">
                    <i class="fas fa-times"></i>
                </div>
            </div>
        `);

        $item.find('.btn-delete-card-top').click((e) => {
            e.stopPropagation();
            pendingWishlist.splice(index, 1);
            renderPendingWishlist();
        });

        $grid.append($item);
    });
}

async function saveWishlistBatch() {
    if (pendingWishlist.length === 0) return;

    Swal.fire({
        title: 'Guardando...',
        text: `Añadiendo ${pendingWishlist.length} cartas a tu lista.`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const cardsToInsert = pendingWishlist.map(card => ({
            user_id: currentUser.id,
            name: card.name,
            image_url: card.high_res,
            list_index: currentSlot,
            game: card.image.includes('tcgdex') ? 'pokemon' : (card.image.includes('lorcana-api') ? 'lorcana' : 'yugioh'),
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

        pendingWishlist = [];
        renderPendingWishlist();
        loadWishlist();

    } catch (err) {
        console.error("Batch Error:", err);
        Swal.fire('Error', 'No se pudieron añadir las cartas: ' + err.message, 'error');
    }
}

async function checkSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        const { data: user } = await _supabase
            .from('usuarios')
            .select('id, username, max_wishlist')
            .eq('id', session.user.id)
            .single();

        if (user) {
            currentUser = user;
            $('#authenticated-content').show();
            $('#top-panel').show();
            $('#dropdown-user-name').text(user.username);
            loadWishlist();
        } else {
            showLoginView();
        }
    } else {
        showLoginView();
    }
}

function showLoginView() {
    $('#login-modal').addClass('active');
    $('#authenticated-content').hide();
}

function initTheme() {
    const savedTheme = localStorage.getItem('tcg_theme') || 'theme-dark';
    $('body').addClass(savedTheme);
}

async function loadWishlist() {
    const scrollPos = captureScroll();
    if ($('#wishlist-list').children().length === 0) {
        $('#wishlist-list').html('<div class="loading">Cargando lista de deseos...</div>');
    }

    const { data: wishlist, error } = await _supabase
        .from('wishlist')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('list_index', currentSlot)
        .order('created_at', { ascending: false });

    if (error) {
        $('#wishlist-list').html('<div class="error">Error al cargar la lista.</div>');
        console.error(error);
        return;
    }

    if (wishlist.length === 0) {
        $('#wishlist-list').html('<div class="empty">No tienes cartas en tu lista de deseos. ¡Busca una arriba para empezar!</div>');
        return;
    }

    const $container = $('#wishlist-list');
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
                    <img src="${item.image_url}" style="width: 100%; height: 160px; object-fit: contain; border-radius: 8px; background: rgba(0,0,0,0.2);">
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
            updateWishlistItem(item.id, { [field]: value });
        });

        $card.find('.wishlist-toggle-obtained').on('change', function() {
            const obtained = $(this).is(':checked');
            updateWishlistItem(item.id, { obtained });
            $card.css('opacity', obtained ? '0.7' : '1');
            $card.find('.wishlist-status-text').text(obtained ? '¡CONSEGUIDA!' : 'BUSCANDO');
        });

        $card.find('.btn-delete-wishlist').click(function(e) {
            e.stopPropagation();
            deleteWishlistItem(item.id);
        });

        $card.find('.btn-edit-wishlist').click(function(e) {
            e.stopPropagation();
            openEditModal(item);
        });

        $container.append($card);
    });
    restoreScroll(scrollPos);
}

function openEditModal(item) {
    currentEditingId = item.id;
    $('#modal-card-img').attr('src', item.image_url);
    $('#modal-card-name').text(item.name);
    $('#modal-rarity').val(item.rarity || '');
    $('#modal-quantity').val(item.quantity || 1);
    $('#modal-holo-effect').val(item.holo_effect || '');
    $('#modal-custom-mask').val(item.custom_mask_url || '');
    $('#modal-use-3d').prop('checked', item.use_3d !== false);
    $('#modal-notes').val(item.notes || '');

    if (item.holo_effect === 'custom-texture' || item.holo_effect === 'custom-foil') {
        $('#modal-mask-container').show();
    } else {
        $('#modal-mask-container').hide();
    }

    $('#wishlist-modal').addClass('active');
}

async function addCardToWishlist(card) {
    // Check limit (Including pending)
    const { count, error: countError } = await _supabase
        .from('wishlist')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id);

    if (countError) {
        console.error("Error checking wishlist limit:", countError);
    } else {
        const limit = currentUser.max_wishlist || 10;
        const total = count + pendingWishlist.length;
        if (total >= limit) {
            Swal.fire({
                title: 'Límite alcanzado',
                text: `Has alcanzado el límite de ${limit} cartas en tu lista de deseos.`,
                icon: 'warning',
                footer: '<a href="admin.html">Sube a Premium para aumentar tu límite</a>'
            });
            return;
        }
    }

    pendingWishlist.push(card);
    renderPendingWishlist();

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

async function updateWishlistItem(id, data) {
    const { error } = await _supabase
        .from('wishlist')
        .update(data)
        .eq('id', id);

    if (error) {
        console.error("Error updating wishlist item:", error);
    }
}

async function deleteWishlistItem(id) {
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
            loadWishlist();
        }
    }
}

async function searchExternalCard(inputSelector, resultsSelector, onSelectCallback) {
    const query = $(inputSelector).val().trim();

    if (query.length < 3) {
        Swal.fire('Atención', 'Por favor, escribe al menos 3 caracteres para buscar.', 'info');
        return;
    }

    $(resultsSelector).html('<div style="grid-column: 1/-1; text-align: center; padding: 10px; color: #666;">Buscando en todas las bases de datos...</div>');

    try {
        // Special YGO search logic for passcodes and set codes
        const ygoSpecialSearch = async () => {
            const q = query.toUpperCase();
            // Passcode (Numeric 5-10 digits)
            if (/^\d{5,10}$/.test(q)) {
                const r = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${q}`).then(res => res.json()).catch(() => ({data:[]}));
                return r.data || [];
            }
            // Set Code (Format XXX-123 or XXX-EN123)
            const setMatch = q.match(/^([A-Z0-9]{3,6})-([A-Z0-9]{3,8})$/);
            if (setMatch) {
                const prefix = setMatch[1];
                const sets = await getYgoSets();
                const setObj = sets.find(s => s.set_code.toUpperCase() === prefix);
                if (setObj) {
                    const r = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(setObj.set_name)}`).then(res => res.json()).catch(() => ({data:[]}));
                    if (r.data) {
                        // Filter for the exact set code
                        return r.data.filter(c => c.card_sets && c.card_sets.some(s => s.set_code.toUpperCase() === q));
                    }
                }
            }
            return [];
        };

        // Concurrent search across all databases (Yu-Gi-Oh and Pokémon in 3 languages)
        const searchPromises = [
            // Yu-Gi-Oh! Name Search
            fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : {data:[]}).catch(() => ({data:[]})),
            // Yu-Gi-Oh! Code/Set Search
            fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : {data:[]}).catch(() => ({data:[]})),
            // Special YGO Search
            ygoSpecialSearch(),
            // Pokémon TCGdex - English
            fetch(`https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : []).catch(() => []),
            // Pokémon TCGdex - Spanish
            fetch(`https://api.tcgdex.net/v2/es/cards?name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : []).catch(() => []),
            // Pokémon TCGdex - Japanese
            fetch(`https://api.tcgdex.net/v2/ja/cards?name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : []).catch(() => []),
            // Lorcana Search
            fetch(`https://api.lorcana-api.com/cards/fetch?search=name~${encodeURIComponent(query)}&displayonly=name;image;cost;set_num`).then(r => r.ok ? r.json() : []).catch(() => []),
            // Viking Search
            VikingData.search(query)
        ];

        const [ygName, ygCode, ygSpecial, pkEn, pkEs, pkJa, lorResults, vikResults] = await Promise.all(searchPromises);

        let combinedResults = [];

        // Process VikingData
        if (Array.isArray(vikResults)) {
            combinedResults.push(...vikResults);
        }

        // Process Lorcana Results
        const lorResultsSafe = Array.isArray(lorResults) ? lorResults : [];
        lorResultsSafe.forEach(c => {
            if (c.Image) {
                combinedResults.push({
                    name: c.Name,
                    image: c.Image,
                    high_res: c.Image
                });
            }
        });

        // Process Yu-Gi-Oh Results
        const ygoResults = [...(ygName.data || []), ...(ygCode.data || []), ...ygSpecial];
        ygoResults.forEach(c => {
            if (c.card_images && c.card_images.length > 0) {
                // Iterate through all alternate arts
                c.card_images.forEach(img => {
                    combinedResults.push({
                        name: c.name,
                        image: img.image_url_small,
                        high_res: img.image_url
                    });
                });
            }
        });

        // Process Pokémon Results
        const pkResults = [...(pkEn || []), ...(pkEs || []), ...(pkJa || [])];
        pkResults.forEach(c => {
            if (c.image) {
                combinedResults.push({
                    name: c.name,
                    image: `${c.image}/low.webp`,
                    high_res: `${c.image}/high.webp`
                });
            }
        });

        // Deduplicate by Image URL
        const uniqueResults = [];
        const seenImages = new Set();
        combinedResults.forEach(card => {
            if (!seenImages.has(card.image)) {
                seenImages.add(card.image);
                uniqueResults.push(card);
            }
        });

        if (uniqueResults.length === 0) {
            $(resultsSelector).html('<div style="grid-column: 1/-1; text-align: center; padding: 10px; color: #ff4757;">No se encontraron cartas en ninguna base de datos.</div>');
        } else {
            displayExternalResults(uniqueResults.slice(0, 50), resultsSelector, onSelectCallback);
        }

    } catch (err) {
        console.error(err);
        $(resultsSelector).html('<div style="grid-column: 1/-1; text-align: center; padding: 10px; color: #ff4757;">Error al buscar. Inténtalo de nuevo.</div>');
    }
}


function displayExternalResults(results, resultsSelector, onSelectCallback) {
    const $container = $(resultsSelector);
    $container.empty();

    if (results.length === 0) {
        $container.html('<div style="grid-column: 1/-1; text-align: center; padding: 10px; color: #666;">No se encontraron resultados.</div>');
        return;
    }

    results.forEach(card => {
        const $item = $(`
            <div class="external-card-result" title="${card.name}" style="cursor: pointer; transition: transform 0.2s;">
                <img src="${card.image}" style="width: 100%; border-radius: 4px; border: 1px solid #333;">
            </div>
        `);

        $item.hover(
            function() { $(this).css('transform', 'scale(1.1)'); },
            function() { $(this).css('transform', 'scale(1)'); }
        );

        $item.click(function() {
            onSelectCallback(card);
        });

        $container.append($item);
    });
}
