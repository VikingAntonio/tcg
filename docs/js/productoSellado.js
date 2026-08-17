let currentUser = null;
let allAdminProducts = [];

$(document).ready(async function() {
    console.log("Initializing Sealed Products Module...");
    try {
        await checkSession();
    } catch (err) {
        console.error("Critical initialization error:", err);
    }

    // --- Navigation & UI ---
    $('#btn-toggle-admin-filters').click(function() {
        $(this).toggleClass('active');
        $('#admin-filter-drawer').slideToggle(250).css('display', $('#admin-filter-drawer').is(':visible') ? 'flex' : 'none');
    });

    $('#btn-open-add-modal').click(function() {
        resetModal();
        $('#product-modal').addClass('active');
        switchTab('tab-search');
    });

    $('#close-product-modal').click(function() {
        $('#product-modal').removeClass('active');
    });

    $(document).on('click', '#avatar-btn', function(e) {
        e.stopPropagation();
        $('#user-dropdown').toggleClass('active');
    });

    $(document).on('click', function(e) {
        if (!$(e.target).closest('.user-menu-container').length) {
            $('#user-dropdown').removeClass('active');
        }
    });

    $('#menu-btn-logout').click(function(e) {
        e.preventDefault();
        handleLogout();
    });

    // --- Tab Logic ---
    $('.modal-nav-tab').click(function() {
        const tabId = $(this).data('tab');
        switchTab(tabId);
    });

    function switchTab(tabId) {
        $('.modal-nav-tab').removeClass('active');
        $(`.modal-nav-tab[data-tab="${tabId}"]`).addClass('active');
        $('.tab-content').hide();
        $(`#${tabId}`).fadeIn(200);
    }

    // --- Search Logic ---
    $('#btn-external-search').click(function() {
        searchInternalAndExternalProducts();
    });

    $('#external-search-input').keypress(function(e) {
        if (e.which === 13) searchInternalAndExternalProducts();
    });

    // --- Filter & Toolbar Logic ---
    $('#admin-search-input').on('input', function() {
        applyAdminFiltersAndSort();
    });

    $('#admin-filter-tcg, #admin-filter-visibility, #admin-filter-stock, #admin-sort-by').on('change', function() {
        applyAdminFiltersAndSort();
    });

    // --- Save Logic ---
    $('#btn-save-product').click(function() {
        saveProduct();
    });

    // Cloudinary Drag & Drop for Product Image
    $(document).on('drop', '#drop-zone-product', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) {
            handleCloudinaryUpload(files[0], '#product-image-url', '#drop-zone-product .file-name');
        }
    });

    $(document).on('dragover dragenter', '#drop-zone-product', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).addClass('dragover');
    });

    $(document).on('dragleave dragend drop', '#drop-zone-product', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('dragover');
    });

    $(document).on('change', '#input-product-file', function() {
        if (this.files.length > 0) {
            handleCloudinaryUpload(this.files[0], '#product-image-url', '#drop-zone-product .file-name');
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
            .select('id, username, max_sealed, store_name, store_logo')
            .eq('id', session.user.id)
            .single();

        if (userError || !user) {
            console.error("User fetch error or user not found.");
            window.location.href = 'admin.html';
            return;
        }

        currentUser = user;
        $('#dropdown-user-name').text(user.store_name || user.username);
        if (user.store_logo) {
            $('#dropdown-user-logo').attr('src', user.store_logo).show();
        }
        console.log("Auth success. Showing content for", user.username);
        $('#top-panel, #authenticated-content').fadeIn();
        loadProducts();
    } catch (err) {
        console.error("Unexpected session check error:", err);
        window.location.href = 'admin.html';
    }
}

async function handleLogout() {
    await _supabase.auth.signOut();
    window.location.href = 'admin.html';
}

async function loadProducts() {
    $('#product-list').html('<div class="loading" style="grid-column: 1/-1; padding: 80px; text-align: center; color: #94a3b8;"><i class="fas fa-circle-notch fa-spin fa-2x" style="color: #00d2ff;"></i><br><br>Cargando productos...</div>');

    try {
        const { data: products, error } = await _supabase
            .from('sealed_products')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        allAdminProducts = products || [];
        updateMetricsSummary(allAdminProducts);
        applyAdminFiltersAndSort();
    } catch (err) {
        console.error("Load products error:", err);
        $('#product-list').html('<div class="error" style="grid-column: 1/-1; padding: 60px; text-align: center; color: #ff4757;">Error al cargar productos. Por favor, refresca la página.</div>');
    }
}

function updateMetricsSummary(products) {
    const total = products.length;
    const publicCount = products.filter(p => p.is_public !== false).length;
    let totalStock = 0;
    let totalValue = 0;

    products.forEach(p => {
        const stockVal = parseInt(p.stock !== undefined ? p.stock : (p.quantity || 1)) || 0;
        totalStock += stockVal;

        const priceStr = (p.price || "0").toString().replace(/[^0-9.,]/g, '').replace(',', '.');
        const numPrice = parseFloat(priceStr) || 0;
        totalValue += (numPrice * (stockVal || 1));
    });

    $('#stat-total-products').text(total);
    $('#stat-public-products').text(publicCount);
    $('#stat-total-stock').text(totalStock);
    $('#stat-total-value').text(`$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
}

function applyAdminFiltersAndSort() {
    let filtered = [...allAdminProducts];

    // Search filter
    const query = $('#admin-search-input').val().trim().toLowerCase();
    if (query) {
        filtered = filtered.filter(p => (p.name || '').toLowerCase().includes(query) || (p.description || '').toLowerCase().includes(query));
    }

    // TCG Filter
    const tcgFilter = $('#admin-filter-tcg').val();
    if (tcgFilter !== 'all') {
        filtered = filtered.filter(p => (p.tcg || '').toLowerCase() === tcgFilter);
    }

    // Visibility Filter
    const visFilter = $('#admin-filter-visibility').val();
    if (visFilter === 'public') {
        filtered = filtered.filter(p => p.is_public !== false);
    } else if (visFilter === 'private') {
        filtered = filtered.filter(p => p.is_public === false);
    }

    // Stock Filter
    const stockFilter = $('#admin-filter-stock').val();
    if (stockFilter === 'in_stock') {
        filtered = filtered.filter(p => (p.stock !== undefined ? parseInt(p.stock) : (parseInt(p.quantity) || 1)) > 0);
    } else if (stockFilter === 'out_of_stock') {
        filtered = filtered.filter(p => (p.stock !== undefined ? parseInt(p.stock) : (parseInt(p.quantity) || 1)) <= 0);
    }

    // Sort
    const sortBy = $('#admin-sort-by').val();
    filtered.sort((a, b) => {
        const priceA = parseFloat((a.price || "0").toString().replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
        const priceB = parseFloat((b.price || "0").toString().replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;

        if (sortBy === 'price_desc') return priceB - priceA;
        if (sortBy === 'price_asc') return priceA - priceB;
        if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
        // Default recent
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    renderAdminProductGrid(filtered);
}

function renderAdminProductGrid(products) {
    const $container = $('#product-list');
    $container.empty();

    if (!products || products.length === 0) {
        $container.html(`
            <div class="empty" style="grid-column: 1/-1; padding: 80px; text-align: center; color: #64748b; background: rgba(15, 23, 36, 0.4); border-radius: 20px; border: 1px dashed rgba(255,255,255,0.08);">
                <i class="fas fa-box-open" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.4;"></i>
                <p style="font-size: 1.1rem; font-weight: 700; color: #94a3b8; margin: 0;">No se encontraron productos en el inventario.</p>
            </div>
        `);
        return;
    }

    products.forEach(product => {
        const isPublic = product.is_public !== false;
        const stockCount = product.stock !== undefined ? parseInt(product.stock) : (parseInt(product.quantity) || 1);
        const isOutOfStock = stockCount <= 0;

        const $card = $(`
            <div class="product-ecom-card">
                <div class="card-img-box">
                    <span class="badge-tcg-pill">${(product.tcg || 'Otro').toUpperCase()}</span>
                    <span class="badge-stock-pill ${isOutOfStock ? 'out-of-stock' : ''}">${isOutOfStock ? 'Agotado' : 'Stock: ' + stockCount}</span>
                    <img src="${product.image_url || 'https://via.placeholder.com/300x200?text=Sin+Imagen'}" alt="${product.name}">
                </div>

                <div class="card-content-body">
                    <div>
                        <h3 class="card-title">${product.name}</h3>
                        ${product.description ? `<p class="card-desc">${product.description}</p>` : ''}
                    </div>

                    <div class="card-price-row">
                        <span class="card-price-val">${product.price || 'Consultar'}</span>
                    </div>

                    <div class="card-actions-bar">
                        <label class="public-toggle-label">
                            <label class="switch" style="transform: scale(0.75); margin: 0;">
                                <input type="checkbox" class="toggle-public" data-id="${product.id}" ${isPublic ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                            <span>${isPublic ? 'PÚBLICO' : 'PRIVADO'}</span>
                        </label>

                        <div style="display: flex; gap: 6px;">
                            <button class="btn-icon-square btn-edit" title="Editar"><i class="fas fa-pen"></i></button>
                            <button class="btn-icon-square danger btn-delete" title="Eliminar"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `);

        $card.find('.btn-edit').click(() => editProduct(product));
        $card.find('.btn-delete').click(() => deleteProduct(product.id));
        $card.find('.toggle-public').change(function() {
            updateVisibility(product.id, $(this).is(':checked'));
        });

        $container.append($card);
    });
}

async function searchInternalAndExternalProducts() {
    const query = $('#external-search-input').val().trim().toLowerCase();

    if (query.length < 2) {
        Swal.fire('Atención', 'Por favor, escribe al menos 2 caracteres para buscar.', 'info');
        return;
    }

    $('#external-search-results').html('<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: #94a3b8;"><i class="fas fa-circle-notch fa-spin fa-2x" style="color: #00d2ff;"></i><br><br>Buscando en catálogo interno y mundial...</div>');

    try {
        const searchPromises = [
            // Internal Supabase Sealed Products
            _supabase.from('sealed_products').select('*').ilike('name', `%${query}%`).limit(10),
            // Internal VikingData
            (typeof VikingData !== 'undefined' ? VikingData.search(query) : Promise.resolve([])),
            // Yu-Gi-Oh Sets
            (typeof getYgoSets === 'function' ? getYgoSets() : Promise.resolve([])),
            // Yu-Gi-Oh Cards
            fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : {data:[]}).catch(() => ({data:[]})),
            // Pokémon Sets
            fetch('https://api.tcgdex.net/v2/en/sets').then(r => r.json()).catch(() => []),
            // Pokémon Cards
            fetch(`https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : []).catch(() => []),
            // Lorcana Cards & Sets
            fetch(`https://api.lorcana-api.com/cards/fetch?search=name~${encodeURIComponent(query)}&displayonly=name;image`).then(r => r.json()).catch(() => [])
        ];

        const [intProductsRes, vikResults, ygoSets, ygoCards, pkSets, pkCards, lorCards] = await Promise.all(searchPromises);

        let combinedResults = [];

        // Internal Supabase
        if (intProductsRes && intProductsRes.data) {
            intProductsRes.data.forEach(p => {
                combinedResults.push({
                    name: p.name,
                    image: p.image_url,
                    tcg: p.tcg || 'custom',
                    price: p.price || '',
                    description: p.description || '',
                    source: 'Catálogo Interno'
                });
            });
        }

        // Process Viking
        if (Array.isArray(vikResults)) {
            vikResults.forEach(i => {
                combinedResults.push({
                    name: i.name,
                    image: i.image,
                    tcg: i.tcg || 'custom',
                    source: 'VikingData'
                });
            });
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
            ygoCards.data.slice(0, 15).forEach(c => {
                combinedResults.push({
                    name: c.name,
                    image: c.card_images[0].image_url_small,
                    tcg: 'yugioh',
                    description: c.desc || '',
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
            pkCards.slice(0, 15).forEach(c => {
                combinedResults.push({
                    name: c.name,
                    image: `${c.image}/low.webp`,
                    tcg: 'pokemon',
                    source: 'PKMCard'
                });
            });
        }

        // Process Lorcana Cards
        if (Array.isArray(lorCards)) {
            lorCards.slice(0, 10).forEach(c => {
                combinedResults.push({
                    name: c.Name,
                    image: c.Image,
                    tcg: 'lorcana',
                    source: 'LorCard'
                });
            });
        }

        // Static One Piece Sets
        const opSets = [
            { name: 'Romance Dawn (OP-01) Booster Box', image: 'https://m.media-amazon.com/images/I/71b2S7A7VWL._AC_SL1500_.jpg', tcg: 'onepiece' },
            { name: 'Paramount War (OP-02) Booster Box', image: 'https://m.media-amazon.com/images/I/71-0fV5oIIL._AC_SL1500_.jpg', tcg: 'onepiece' },
            { name: 'Pillars of Strength (OP-03) Booster Box', image: 'https://m.media-amazon.com/images/I/71K6Ew5L9VL._AC_SL1500_.jpg', tcg: 'onepiece' },
            { name: 'Kingdoms of Intrigue (OP-04) Booster Box', image: 'https://m.media-amazon.com/images/I/71Y8e6lE-KL._AC_SL1500_.jpg', tcg: 'onepiece' },
            { name: 'Awakening of the New Era (OP-05) Booster Box', image: 'https://m.media-amazon.com/images/I/71f-W-q7GOL._AC_SL1500_.jpg', tcg: 'onepiece' },
            { name: 'Wings of the Captain (OP-06) Booster Box', image: 'https://m.media-amazon.com/images/I/71Z8I6qG5OL._AC_SL1500_.jpg', tcg: 'onepiece' },
            { name: '500 Years in the Future (OP-07) Booster Box', image: 'https://m.media-amazon.com/images/I/71H-Z-W-GOL._AC_SL1500_.jpg', tcg: 'onepiece' }
        ];
        opSets.filter(s => s.name.toLowerCase().includes(query)).forEach(s => combinedResults.push({...s, source: 'One Piece'}));

        // Deduplicate
        const unique = [];
        const seen = new Set();
        combinedResults.forEach(i => {
            const key = (i.name + i.image).toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(i);
            }
        });

        displayExternalResults(unique);
    } catch (e) {
        console.error("Search error:", e);
        $('#external-search-results').html('<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #ff4757;">Error al realizar la búsqueda. Revisa tu conexión.</div>');
    }
}

function displayExternalResults(results) {
    const $container = $('#external-search-results');
    $container.empty();

    if (results.length === 0) {
        $container.html('<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: #64748b;">No se encontraron productos coincidentes.</div>');
        return;
    }

    results.forEach(item => {
        const $item = $(`
            <div class="search-result-item" title="${item.name}">
                <img src="${item.image}" onerror="this.src='https://via.placeholder.com/100x80?text=Set'">
                <div style="font-size: 11px; font-weight: 800; color: #fff; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; width: 100%; line-height: 1.2;">${item.name}</div>
                <div style="font-size: 9px; color: #00d2ff; text-transform: uppercase; font-weight: 800; margin-top: 6px;">${item.tcg}</div>
                <div style="font-size: 8px; color: #64748b; text-transform: uppercase; margin-top: 2px;">${item.source}</div>
            </div>
        `);

        $item.click(() => {
            $('#product-name').val(item.name);
            $('#product-image-url').val(item.image);
            $('#product-tcg').val(item.tcg || 'yugioh');
            if (item.price) $('#product-price').val(item.price);
            if (item.description) $('#product-description').val(item.description);

            // Switch to DATOS tab
            $('.modal-nav-tab[data-tab="tab-data"]').click();

            Swal.fire({
                title: '¡Seleccionado!',
                text: item.name,
                icon: 'success',
                timer: 1200,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        });

        $container.append($item);
    });
}

async function saveProduct() {
    const id = $('#edit-product-id').val();

    // Limit check for new products
    if (!id) {
        try {
            const { count, error: countError } = await _supabase
                .from('sealed_products')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', currentUser.id);

            if (!countError) {
                const limit = currentUser.max_sealed || 10;
                if (count >= limit) {
                    Swal.fire({
                        title: 'Límite alcanzado',
                        text: `Has alcanzado el límite de ${limit} productos sellados.`,
                        icon: 'warning',
                        footer: '<a href="admin.html">Aumenta tu plan para ampliar tu catálogo</a>'
                    });
                    return;
                }
            }
        } catch (e) { console.error("Limit check fail:", e); }
    }

    const name = $('#product-name').val().trim();
    const imageUrl = $('#product-image-url').val().trim();
    const price = $('#product-price').val().trim();
    const tcg = $('#product-tcg').val();
    const description = $('#product-description').val().trim();
    const stockVal = parseInt($('#product-stock').val()) || 0;
    const isPublic = $('#product-public').is(':checked');

    if (!name) {
        Swal.fire('Atención', 'El nombre del producto es obligatorio', 'warning');
        return;
    }

    const fullProductData = {
        user_id: currentUser.id,
        name,
        image_url: imageUrl,
        price,
        tcg,
        description,
        stock: stockVal,
        quantity: stockVal,
        is_public: isPublic
    };

    Swal.fire({ title: 'Guardando producto...', didOpen: () => Swal.showLoading() });

    let error = null;
    try {
        if (id) {
            let res = await _supabase.from('sealed_products').update(fullProductData).eq('id', id);
            if (res.error) {
                // Fallback to core fields if custom columns fail
                const coreData = { user_id: currentUser.id, name, image_url: imageUrl, price, tcg, is_public: isPublic };
                res = await _supabase.from('sealed_products').update(coreData).eq('id', id);
            }
            error = res.error;
        } else {
            let res = await _supabase.from('sealed_products').insert([fullProductData]);
            if (res.error) {
                // Fallback to core fields
                const coreData = { user_id: currentUser.id, name, image_url: imageUrl, price, tcg, is_public: isPublic };
                res = await _supabase.from('sealed_products').insert([coreData]);
            }
            error = res.error;
        }
    } catch (e) { error = e; }

    Swal.close();

    if (error) {
        Swal.fire('Error', 'No se pudo guardar el producto: ' + (error.message || error), 'error');
    } else {
        // VikingData internal sync
        if (typeof VikingData !== 'undefined') {
            try {
                VikingData.save({ ...fullProductData, type: 'product' });
            } catch (e) { console.warn("VikingData sync fail:", e); }
        }

        Swal.fire('¡Éxito!', 'Producto guardado correctamente', 'success');
        $('#product-modal').removeClass('active');
        loadProducts();
    }
}

function editProduct(product) {
    resetModal();
    $('#modal-title').text('EDITAR PRODUCTO');
    $('#edit-product-id').val(product.id);
    $('#product-name').val(product.name || '');
    $('#product-image-url').val(product.image_url || '');
    $('#product-price').val(product.price || '');
    $('#product-description').val(product.description || '');
    $('#product-stock').val(product.stock !== undefined ? product.stock : (product.quantity || 1));
    $('#product-tcg').val(product.tcg || 'yugioh');
    $('#product-public').prop('checked', product.is_public !== false);

    $('#product-modal').addClass('active');

    // Switch to DATOS tab for editing
    $('.modal-nav-tab[data-tab="tab-data"]').click();
}

async function deleteProduct(id) {
    const result = await Swal.fire({
        title: '¿Eliminar producto?',
        text: "Esta acción no se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4757',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            const { error } = await _supabase.from('sealed_products').delete().eq('id', id);
            if (error) throw error;
            loadProducts();
        } catch (err) {
            Swal.fire('Error', 'No se pudo eliminar el producto', 'error');
        }
    }
}

async function updateVisibility(id, isPublic) {
    try {
        const { error } = await _supabase
            .from('sealed_products')
            .update({ is_public: isPublic })
            .eq('id', id);

        if (error) throw error;

        Swal.fire({
            title: isPublic ? 'Visibilidad: Público' : 'Visibilidad: Privado',
            icon: 'info',
            timer: 1000,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });

        // Update local object & metrics
        const prod = allAdminProducts.find(p => p.id == id);
        if (prod) prod.is_public = isPublic;
        updateMetricsSummary(allAdminProducts);
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
        width: 170,
        height: 170,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });

    // Social share links
    $('#share-wa').off('click').on('click', () => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent('Mira este producto en mi catálogo: ' + shareUrl)}`, '_blank'));
    $('#share-tg').off('click').on('click', () => window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Mira este producto en mi catálogo')}`, '_blank'));
    $('#share-fb').off('click').on('click', () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank'));
    $('#share-ms').off('click').on('click', () => window.open(`fb-messenger://share/?link=${encodeURIComponent(shareUrl)}`, '_blank'));

    $('#share-overlay').addClass('active');
};

$('#btn-copy-share-link').click(function() {
    const input = document.getElementById('share-link-input');
    input.select();
    document.execCommand('copy');
    Swal.fire({
        title: '¡Enlace copiado!',
        text: 'Copiado al portapapeles',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
    });
});

function resetModal() {
    $('#modal-title').text('NUEVO PRODUCTO');
    $('#edit-product-id').val('');
    $('#product-name').val('');
    $('#product-description').val('');
    $('#product-image-url').val('');
    $('#drop-zone-product .file-name').text('');
    $('#product-price').val('');
    $('#product-stock').val(1);
    $('#product-tcg').val('yugioh');
    $('#product-public').prop('checked', true);
    $('#external-search-input').val('');
    $('#external-search-results').html(`
        <div style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 50px;">
            <i class="fas fa-search" style="font-size: 2.5rem; margin-bottom: 12px; opacity: 0.4;"></i>
            <p style="font-weight: 600; font-size: 0.9rem;">Busca un producto para auto-completar título, imagen y detalles automáticamente.</p>
        </div>
    `);

    $('.modal-nav-tab').removeClass('active');
    $('.modal-nav-tab[data-tab="tab-search"]').addClass('active');
    $('#tab-search').show();
    $('#tab-data').hide();
}
