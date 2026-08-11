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

    // Parse Query Params
    const urlParams = new URLSearchParams(window.location.search);
    currentDeckId = urlParams.get('deckId');

    if (!currentDeckId) {
        Swal.fire({
            title: 'Error',
            text: 'No se especificó ningún Deck ID en la URL.',
            icon: 'error',
            confirmButtonText: 'Aceptar'
        }).then(() => {
            window.location.href = 'decks.html';
        });
        return;
    }

    if (currentUser) {
        await loadDeckData();
    }

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

    // Section header switcher
    $(document).on('click', '.section-header', function() {
        $('.section-header').removeClass('active');
        $(this).addClass('active');
        activeSection = $(this).data('section');
    });

    // Back Button
    $('#btn-back').click(function() {
        window.location.href = 'decks.html';
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
                $('#deck-workspace').show();
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
        $('#deck-workspace').show();
    } else {
        // Show login modal if unauthenticated
        $('#login-modal').addClass('active');
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
            .eq('id', currentDeckId)
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

        // Fill empty slots up to standard values
        const minSlots = sec === 'Main' ? 40 : 15;
        const totalSlots = Math.max(minSlots, Math.ceil(sectionCards.length / 10) * 10);

        for (let i = 0; i < totalSlots; i++) {
            const card = sectionCards[i];
            if (card) {
                const $item = $(`
                    <div class="nexus-card" title="${card.name}" data-id="${card.id || ''}" data-local-id="${card.localId || ''}">
                        <div class="nexus-card-remove"><i class="fas fa-times"></i></div>
                        <img src="${card.image_url}" loading="lazy">
                        ${card.quantity > 1 ? `<div class="nexus-card-qty">x${card.quantity}</div>` : ''}
                    </div>
                `);

                // Touch/Click to preview
                $item.on('click', function(e) {
                    if ($(e.target).closest('.nexus-card-remove').length) {
                        removeCardFromDeck(card);
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
