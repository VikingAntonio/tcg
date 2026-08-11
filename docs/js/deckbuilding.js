// Dedicated JavaScript for standalone landscape mobile deckbuilder

let currentUser = null;
let currentDeckId = null;
let currentDeck = null;
let localDeckCards = [];
let activeSection = 'Main';

// Accessories State
let selectedSleeves = null;
let selectedDeckbox = null;
let selectedCoin = null;
let selectedMats = null;

$(document).ready(async function() {
    await checkSession();

    // Auth Login triggers
    $('#btn-login').click(function(e) {
        e.preventDefault();
        handleLogin();
    });
    $('#login-username, #login-password').on('keypress', function(e) {
        if (e.which === 13) {
            handleLogin();
        }
    });

    // Back Button on workspace returns to selection
    $('#btn-back').click(function() {
        currentDeckId = null;
        window.history.pushState(null, '', window.location.pathname);
        $('#deck-workspace').hide();
        $('#deck-selection-panel').show();
        loadUserDecksList();
    });

    // Back Button on Selection Panel returns to admin
    $('#btn-selection-back').click(function() {
        window.location.href = 'admin.html';
    });

    // Create Deck in Selection panel
    $('#btn-create-deck-selection').click(function() {
        createNewDeckPrompt();
    });

    // Toggle Filters panel
    $('#btn-toggle-filters').click(function() {
        $('.filters-grid').slideToggle(200);
    });

    // Real-time Search Event handler
    let searchTimeout = null;
    $('#search-input').on('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(triggerCardSearch, 300);
    });

    $('#filter-card-type, #filter-attribute, #filter-level, #filter-format').on('change', function() {
        triggerCardSearch();
    });

    // Section header switcher with collapsible toggle
    $(document).on('click', '.section-header', function() {
        const sec = $(this).data('section');
        activeSection = sec;

        $('.section-header').removeClass('active');
        $(this).addClass('active');

        // Toggle the grid display
        const $grid = $('#grid-' + sec.toLowerCase());
        $grid.slideToggle(200);
        $(this).toggleClass('collapsed');
    });

    // Accessories triggers
    $('#btn-deck-accessories').click(function() {
        $('#accessories-modal').addClass('active');
    });

    $('#close-accessories-modal, #btn-save-accessories').click(function() {
        $('#accessories-modal').removeClass('active');
    });

    // Tab accessory selector
    $(document).on('click', '.acc-tab-btn', function() {
        const tab = $(this).data('tab');
        $('.acc-tab-btn').removeClass('active');
        $(this).addClass('active');

        $('.acc-tab-pane').removeClass('active');
        $(`#pane-${tab}`).addClass('active');
    });

    // Accessory selection
    $(document).on('click', '.accessory-item', function() {
        const $item = $(this);
        const val = $item.data('value') || null;
        const key = $item.data('type');

        if (key === 'sleeves') selectedSleeves = val;
        else if (key === 'deckbox') selectedDeckbox = val;
        else if (key === 'coin') selectedCoin = val;
        else if (key === 'mats') selectedMats = val;

        $item.siblings().removeClass('selected');
        $item.addClass('selected');

        // Update preview thumbnail inside modal
        const $previewBox = $(`#preview-box-${key}`);
        if (val) {
            $previewBox.html(`<img src="${val}" style="width:100%;height:100%;object-fit:cover;">`);
        } else {
            $previewBox.html(`<span class="acc-preview-none">Ninguno</span>`);
        }
    });

    // Save Button
    $('#btn-save-deck').click(async function() {
        await saveDeck();
    });
});

// Check Session & Auth Fallback
async function checkSession() {
    try {
        const { data: { session } } = await _supabase.auth.getSession();
        if (session) {
            const { data: user, error } = await _supabase
                .from('usuarios')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (user) {
                currentUser = user;
                localStorage.setItem('tcg_session', JSON.stringify(user));
                showAuthenticatedContent();
                return;
            }
        }
    } catch (e) {
        console.error("Session check failed:", e);
    }

    // Fallback to cache for offline/local
    const cachedUser = localStorage.getItem('tcg_session');
    if (cachedUser) {
        currentUser = JSON.parse(cachedUser);
        showAuthenticatedContent();
    } else {
        // Show login modal if unauthenticated
        $('#login-modal').addClass('active');
    }
}

function showAuthenticatedContent() {
    $('#login-modal').removeClass('active');

    // Parse Query Params
    const urlParams = new URLSearchParams(window.location.search);
    currentDeckId = urlParams.get('deckId');

    if (currentDeckId) {
        $('#deck-selection-panel').hide();
        $('#deck-workspace').show();
        loadDeckData();
    } else {
        $('#deck-workspace').hide();
        $('#deck-selection-panel').show();
        loadUserDecksList();
    }
}

// Fetch and list user decks
async function loadUserDecksList() {
    const $list = $('#deck-selection-list');
    $list.html('<div class="loading-decks">Cargando tus decks...</div>');

    try {
        const { data: decks, error } = await _supabase
            .from('decks')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('position', { ascending: true })
            .order('id', { ascending: true });

        if (error) throw error;

        $list.empty();

        if (!decks || decks.length === 0) {
            $list.html(`
                <div class="empty-decks-state" style="grid-column: 1/-1; text-align: center; padding: 40px; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
                    <i class="fas fa-folder-open" style="font-size: 2.5rem; color: #475569; margin-bottom: 15px; display: block;"></i>
                    <p style="color: #94a3b8; font-size: 0.95rem; margin-bottom: 15px;">No tienes ningún deck creado todavía.</p>
                    <button class="btn btn-success" id="btn-create-first-deck"><i class="fas fa-plus"></i> Crear mi primer Deck</button>
                </div>
            `);
            $('#btn-create-first-deck').click(function() {
                createNewDeckPrompt();
            });
            return;
        }

        decks.forEach(deck => {
            const matImg = deck.mats || 'https://via.placeholder.com/300x150?text=Viking+TCG';
            const $card = $(`
                <div class="deck-selection-card">
                    <div class="deck-card-bg" style="background-image: linear-gradient(rgba(15,23,42,0.6), rgba(15,23,42,0.95)), url('${matImg}');"></div>
                    <div class="deck-card-info">
                        <h3>${deck.name}</h3>
                        <p class="deck-card-meta">
                            <span><i class="fas fa-eye"></i> ${deck.is_public !== false ? 'Público' : 'Privado'}</span>
                        </p>
                    </div>
                    <div class="deck-card-actions">
                        <button class="btn btn-primary btn-sm btn-edit-deck" data-id="${deck.id}"><i class="fas fa-hammer"></i> Construir</button>
                        <button class="btn btn-danger btn-sm btn-delete-deck" data-id="${deck.id}" data-name="${deck.name}"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
            `);

            // Edit trigger
            $card.find('.btn-edit-deck').click(function() {
                const id = $(this).data('id');
                currentDeckId = id;
                window.history.pushState(null, '', '?deckId=' + id);
                $('#deck-selection-panel').hide();
                $('#deck-workspace').show();
                loadDeckData();
            });

            // Delete trigger
            $card.find('.btn-delete-deck').click(async function(e) {
                e.stopPropagation();
                const id = $(this).data('id');
                const name = $(this).data('name');

                const confirm = await Swal.fire({
                    title: '¿Eliminar deck?',
                    text: `¿Estás seguro de que deseas eliminar "${name}"? Esta acción no se puede deshacer.`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#ef4444',
                    cancelButtonColor: '#334155',
                    confirmButtonText: 'Sí, eliminar',
                    cancelButtonText: 'Cancelar'
                });

                if (confirm.isConfirmed) {
                    await deleteDeck(id);
                }
            });

            $list.append($card);
        });

    } catch (e) {
        console.error("Error loading user decks:", e);
        $list.html('<div class="error-decks" style="grid-column: 1/-1; text-align: center; padding: 20px; color: #ef4444;">No se pudieron cargar tus decks.</div>');
    }
}

// Delete Deck & associated cards
async function deleteDeck(id) {
    try {
        Swal.fire({
            title: 'Eliminando...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        // 1. Delete deck cards
        await _supabase.from('deck_cards').delete().eq('deck_id', id);

        // 2. Delete deck
        const { error } = await _supabase.from('decks').delete().eq('id', id);

        if (error) throw error;

        Swal.fire({
            icon: 'success',
            title: 'Eliminado',
            text: 'El deck ha sido eliminado.',
            timer: 1500,
            showConfirmButton: false
        });

        loadUserDecksList();
    } catch (e) {
        console.error("Error deleting deck:", e);
        Swal.fire('Error', 'No se pudo eliminar el deck: ' + e.message, 'error');
    }
}

// Create New Deck Dialog Flow
async function createNewDeckPrompt() {
    // Check max decks limit
    try {
        const { count, error } = await _supabase
            .from('decks')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id);

        if (!error && currentUser.max_decks && count >= currentUser.max_decks) {
            Swal.fire('Límite alcanzado', `Tu plan actual permite un máximo de ${currentUser.max_decks} decks.`, 'warning');
            return;
        }
    } catch (e) {
        console.warn("Could not check deck limit, continuing anyway", e);
    }

    const { value: name } = await Swal.fire({
        title: 'Crear Nuevo Deck',
        input: 'text',
        inputLabel: 'Nombre de tu nuevo deck:',
        placeholder: 'Ej. Mi Deck de HÉROES',
        showCancelButton: true,
        confirmButtonText: 'Crear',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => {
            if (!value || !value.trim()) {
                return '¡Necesitas ingresar un nombre!';
            }
        }
    });

    if (name) {
        await createNewDeck(name.trim());
    }
}

// Insert Deck row to Supabase
async function createNewDeck(name) {
    try {
        Swal.fire({
            title: 'Creando deck...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        // Get max position to append
        let nextPos = 0;
        const { data: posData } = await _supabase
            .from('decks')
            .select('position')
            .eq('user_id', currentUser.id)
            .order('position', { ascending: false })
            .limit(1);

        if (posData && posData.length > 0) {
            nextPos = (posData[0].position || 0) + 1;
        }

        const { data, error } = await _supabase
            .from('decks')
            .insert([{ name, user_id: currentUser.id, position: nextPos }])
            .select();

        if (error) throw error;
        if (!data || data.length === 0) throw new Error("No se pudo crear el registro en la base de datos.");

        const newDeck = data[0];

        Swal.fire({
            icon: 'success',
            title: '¡Creado!',
            text: 'Cargando editor del deck...',
            timer: 1000,
            showConfirmButton: false
        });

        // Set state and show workspace
        currentDeckId = newDeck.id;
        window.history.pushState(null, '', '?deckId=' + newDeck.id);
        $('#deck-selection-panel').hide();
        $('#deck-workspace').show();
        await loadDeckData();

    } catch (e) {
        console.error("Error creating deck:", e);
        Swal.fire('Error', 'No se pudo crear el deck: ' + e.message, 'error');
    }
}

// User Login function matching admin.html logic
async function handleLogin() {
    const userInput = $('#login-username').val().trim();
    const password = $('#login-password').val().trim();

    if (!userInput || !password) {
        Swal.fire('Atención', 'Por favor, completa todos los campos', 'warning');
        return;
    }

    try {
        Swal.fire({
            title: 'Iniciando sesión...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        let emailToUse = userInput;

        if (!userInput.includes('@')) {
            // Attempt to find the real email in the 'usuarios' table for existing accounts
            const { data: userRow } = await _supabase
                .from('usuarios')
                .select('email')
                .eq('username', userInput)
                .maybeSingle();

            if (userRow && userRow.email) {
                emailToUse = userRow.email;
            } else {
                // Fallback to our convention for new accounts
                emailToUse = `${userInput}@tcgdual.com`;
            }
        }

        const { data, error } = await _supabase.auth.signInWithPassword({
            email: emailToUse,
            password: password,
        });

        if (error) throw error;

        const { data: profile, error: profError } = await _supabase
            .from('usuarios')
            .select('id, username, store_name, store_logo, is_store, role, whatsapp_link, messenger_link, selected_spirit_id, max_albums, max_pages, max_decks, max_cards_per_deck, allowed_spirit_ids, has_tracking, has_clients, has_auctions, has_events, max_events, auction_reset_date, monthly_created_count, monthly_bid_count')
            .eq('id', data.user.id)
            .single();

        if (profError) throw profError;

        currentUser = profile;
        localStorage.setItem('tcg_session', JSON.stringify(profile));

        Swal.close();
        showAuthenticatedContent();

    } catch (e) {
        console.error("Login failed:", e);
        Swal.fire('Error', 'Error al iniciar sesión: ' + e.message, 'error');
    }
}

// Load deck metadata and card slots
async function loadDeckData() {
    try {
        const { data: deck, error } = await _supabase
            .from('decks')
            .select('*')
            .eq('id', currentDeckId)
            .single();

        if (error || !deck) {
            throw new Error(error ? error.message : "Deck no encontrado.");
        }

        currentDeck = deck;
        $('#deck-title').text(deck.name);
        $('#deck-name-input').val(deck.name);
        $('#deck-public-checkbox').prop('checked', deck.is_public !== false);

        // Accessories init
        selectedSleeves = deck.sleeves || null;
        selectedDeckbox = deck.deckbox || null;
        selectedCoin = deck.coin || null;
        selectedMats = deck.mats || null;

        // Fetch Deck Cards
        const { data: cards, error: cardsErr } = await _supabase
            .from('deck_cards')
            .select('*')
            .eq('deck_id', currentDeckId)
            .order('position', { ascending: true });

        if (cardsErr) throw cardsErr;

        localDeckCards = cards || [];
        renderDeckGrids();
        loadAndRenderAccessories();

    } catch (e) {
        console.error("Error loading deck data:", e);
        Swal.fire('Error', 'No se pudo cargar el deck: ' + e.message, 'error');
    }
}

// Card Search logic integrated with js/utils.js
function triggerCardSearch() {
    const query = $('#search-input').val().trim();
    const filters = {
        cardType: $('#filter-card-type').val(),
        attribute: $('#filter-attribute').val(),
        level: $('#filter-level').val(),
        format: $('#filter-format').val(),
        displayFn: displaySearchResults
    };

    const hasFilters = Object.values(filters).some(v => v !== '' && typeof v !== 'function');

    if (query.length < 1 && !hasFilters) {
        $('#search-results').empty();
        return;
    }

    if (typeof window.searchExternalCard === 'function') {
        window.searchExternalCard('#search-input', '#search-results', function(card) {
            addCardToDeck(card);
        }, filters);
    } else {
        console.warn("window.searchExternalCard helper is missing from window context.");
    }
}

function displaySearchResults(results) {
    const $container = $('#search-results');
    $container.empty();

    if (!results || results.length === 0) {
        $container.html('<div style="grid-column: 1/-1; text-align: center; padding: 10px; color: #64748b;">Sin resultados</div>');
        return;
    }

    results.forEach(card => {
        const imageSrc = card.high_res || card.image;
        const $item = $(`
            <div class="external-card-result" title="${card.name}">
                <img src="${imageSrc}" loading="lazy">
            </div>
        `);

        // Preview trigger
        $item.on('click', function() {
            previewCard({
                name: card.name,
                image_url: imageSrc,
                desc: card.set || card.rarity || 'Detalles no disponibles'
            });
            // Single tap automatically adds
            addCardToDeck(card);
        });

        $container.append($item);
    });
}

function previewCard(card) {
    if (!card) return;
    $('#card-preview-img').attr('src', card.image_url);
    $('#card-preview-name').text(card.name);
    $('#card-preview-desc').text(card.desc || '');
}

function addCardToDeck(card, targetSection = null) {
    const sec = targetSection || activeSection || 'Main';

    // Calculate maximum position to append correctly
    const sectionCards = localDeckCards.filter(c => (c.section || 'Main') === sec);
    const maxPos = sectionCards.length > 0 ? Math.max(...sectionCards.map(c => c.position || 0)) : -1;

    const newCard = {
        localId: 'new_' + Date.now() + Math.random(),
        deck_id: currentDeckId,
        image_url: card.high_res || card.image,
        name: card.name,
        quantity: 1,
        section: sec,
        position: maxPos + 1,
        obtained: true
    };

    localDeckCards.push(newCard);
    renderDeckGrids();
}

function renderDeckGrids() {
    const sections = ['Main', 'Extra', 'Side', 'Tokens'];

    sections.forEach(sec => {
        const $grid = $('#grid-' + sec.toLowerCase());
        $grid.empty();

        const sectionCards = localDeckCards
            .filter(c => (c.section || 'Main') === sec)
            .sort((a, b) => (a.position || 0) - (b.position || 0));

        // Fill empty slots up to standard values (60 for Main, 20 for others)
        const minSlots = sec === 'Main' ? 60 : 20;
        const totalSlots = Math.max(minSlots, Math.ceil(sectionCards.length / 10) * 10);

        for (let i = 0; i < totalSlots; i++) {
            const card = sectionCards[i];
            if (card) {
                const $item = $(`
                    <div class="nexus-card" title="${card.name}" data-id="${card.id || ''}" data-local-id="${card.localId || ''}">
                        <div class="nexus-card-zoom" title="Ver carta"><i class="fas fa-search-plus"></i></div>
                        <div class="nexus-card-remove" title="Quitar carta"><i class="fas fa-times"></i></div>
                        <img src="${card.image_url}" loading="lazy">
                        ${card.quantity > 1 ? `<div class="nexus-card-qty">x${card.quantity}</div>` : ''}
                    </div>
                `);

                // Touch/Click to preview or action
                $item.on('click', function(e) {
                    if ($(e.target).closest('.nexus-card-remove').length) {
                        removeCardFromDeck(card);
                        return;
                    }
                    if ($(e.target).closest('.nexus-card-zoom').length) {
                        Swal.fire({
                            title: card.name,
                            imageUrl: card.image_url,
                            imageAlt: card.name,
                            showConfirmButton: false,
                            showCloseButton: true,
                            background: '#0f172a',
                            color: '#fff',
                            customClass: {
                                popup: 'swal-card-zoom-popup',
                                image: 'swal-card-zoom-image'
                            }
                        });
                        return;
                    }
                    previewCard({
                        name: card.name,
                        image_url: card.image_url,
                        desc: card.expansion || card.rarity || 'Carta de tu Deck'
                    });
                });

                $grid.append($item);
            } else {
                $grid.append('<div class="nexus-card empty"></div>');
            }
        }

        // Update counts
        $('#count-' + sec.toLowerCase()).text(sectionCards.length);
    });
}

function removeCardFromDeck(card) {
    localDeckCards = localDeckCards.filter(c => c !== card);
    renderDeckGrids();
}

// Load and Render Accessories in Modal
async function loadAndRenderAccessories() {
    try {
        const { data: accessories, error } = await _supabase
            .from('viking_data')
            .select('*')
            .or('type.eq.accessories,type.eq.accessory');

        if (error) throw error;

        const types = ['sleeves', 'deckbox', 'coin', 'mats'];

        types.forEach(key => {
            const $grid = $('#grid-' + key);
            $grid.empty();

            // Filter accessories for current type
            const filtered = (accessories || []).filter(acc => {
                const r = (acc.rarity || '').toLowerCase();
                const e = (acc.expansion || '').toLowerCase();
                if (key === 'mats') {
                    return r === 'mats' || r === 'playmat' || r === 'playmats' || r === 'mat' ||
                           e === 'mats' || e === 'playmat' || e === 'playmats' || e === 'mat';
                }
                return r === key || e === key;
            });

            // Set current selected values on previews
            let activeVal = null;
            if (key === 'sleeves') activeVal = selectedSleeves;
            else if (key === 'deckbox') activeVal = selectedDeckbox;
            else if (key === 'coin') activeVal = selectedCoin;
            else if (key === 'mats') activeVal = selectedMats;

            const $previewBox = $(`#preview-box-${key}`);
            if (activeVal) {
                $previewBox.html(`<img src="${activeVal}" style="width:100%;height:100%;object-fit:cover;">`);
            } else {
                $previewBox.html(`<span class="acc-preview-none">Ninguno</span>`);
            }

            // "Ninguno" Option
            const isNoneSelected = !activeVal;
            const $noneItem = $(`
                <div class="accessory-item none-option ${isNoneSelected ? 'selected' : ''}" data-type="${key}" data-value="">
                    <div style="font-size: 10px; opacity: 0.7;">Ninguno</div>
                </div>
            `);
            $grid.append($noneItem);

            filtered.forEach(acc => {
                const isSelected = acc.image_url === activeVal;
                const $item = $(`
                    <div class="accessory-item ${isSelected ? 'selected' : ''}" data-type="${key}" data-value="${acc.image_url}" title="${acc.name}">
                        <img src="${acc.image_url}" onerror="this.src='https://via.placeholder.com/150?text=Error'">
                    </div>
                `);
                $grid.append($item);
            });
        });

    } catch (e) {
        console.error("Error rendering accessories:", e);
    }
}

// Supabase Save Mechanics
async function saveDeck() {
    Swal.fire({
        title: 'Guardando cambios...',
        text: 'Estamos procesando todas las cartas de tu deck.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    const name = $('#deck-name-input').val().trim();
    const is_public = $('#deck-public-checkbox').is(':checked');

    if (!name) {
        Swal.fire('Atención', 'El nombre del deck no puede estar vacío.', 'warning');
        return;
    }

    try {
        // 1. Update deck metadata & accessories
        const deckUpdate = {
            name,
            is_public,
            sleeves: selectedSleeves,
            deckbox: selectedDeckbox,
            coin: selectedCoin,
            mats: selectedMats
        };

        const { error: deckErr } = await _supabase
            .from('decks')
            .update(deckUpdate)
            .eq('id', currentDeckId);

        if (deckErr) throw deckErr;

        // 2. Clear old deck cards
        const { error: clearErr } = await _supabase
            .from('deck_cards')
            .delete()
            .eq('deck_id', currentDeckId);

        if (clearErr) throw clearErr;

        // 3. Batch insert new cards
        if (localDeckCards.length > 0) {
            const cardsToInsert = localDeckCards.map((c, index) => ({
                deck_id: currentDeckId,
                image_url: c.image_url,
                name: c.name,
                quantity: c.quantity || 1,
                position: index,
                section: c.section || 'Main',
                holo_effect: c.holo_effect || '',
                custom_mask_url: c.custom_mask_url || '',
                rarity: c.rarity || '',
                expansion: c.expansion || '',
                condition: c.condition || 'M',
                price: c.price || '',
                obtained: c.obtained !== false
            }));

            const { error: insErr } = await _supabase
                .from('deck_cards')
                .insert(cardsToInsert);

            if (insErr) throw insErr;
        }

        Swal.fire({
            icon: 'success',
            title: '¡Guardado!',
            text: 'Tu deck ha sido guardado exitosamente.',
            timer: 1500,
            showConfirmButton: false
        });

        // Re-load current status to sync IDs
        await loadDeckData();

    } catch (e) {
        console.error("Error saving deck:", e);
        Swal.fire('Error', 'No se pudo guardar el deck: ' + e.message, 'error');
    }
}
