// Duel Simulator Engine

// JSON Playmat layouts for Yu-Gi-Oh and Pokémon TCG
const BOARD_LAYOUTS = {
    yugioh: [
        // Player 2 (Top Half, Mirrored) - Red/Pink Theme
        { id: "deck_2", name: "P2 Deck", player: 2, x: 40, y: 20, type: "deck" },
        { id: "grave_2", name: "P2 Cementerio", player: 2, x: 40, y: 130, type: "grave" },
        { id: "banished_2", name: "P2 Desterrado", player: 2, x: 755, y: 130, type: "banished" },
        { id: "extra_2", name: "P2 Extra", player: 2, x: 860, y: 20, type: "extra" },
        { id: "field_2", name: "P2 Campo", player: 2, x: 860, y: 130, type: "field" },
        { id: "monster_2_5", name: "P2 Monstruo 5", player: 2, x: 170, y: 130, type: "monster" },
        { id: "monster_2_4", name: "P2 Monstruo 4", player: 2, x: 290, y: 130, type: "monster" },
        { id: "monster_2_3", name: "P2 Monstruo 3", player: 2, x: 410, y: 130, type: "monster" },
        { id: "monster_2_2", name: "P2 Monstruo 2", player: 2, x: 530, y: 130, type: "monster" },
        { id: "monster_2_1", name: "P2 Monstruo 1", player: 2, x: 650, y: 130, type: "monster" },
        { id: "spell_2_5", name: "P2 Magia/Trampa 5", player: 2, x: 170, y: 20, type: "spell" },
        { id: "spell_2_4", name: "P2 Magia/Trampa 4", player: 2, x: 290, y: 20, type: "spell" },
        { id: "spell_2_3", name: "P2 Magia/Trampa 3", player: 2, x: 410, y: 20, type: "spell" },
        { id: "spell_2_2", name: "P2 Magia/Trampa 2", player: 2, x: 530, y: 20, type: "spell" },
        { id: "spell_2_1", name: "P2 Magia/Trampa 1", player: 2, x: 650, y: 20, type: "spell" },

        // Player 1 (Bottom Half) - Blue Theme
        { id: "extra_1", name: "P1 Extra", player: 1, x: 40, y: 400, type: "extra" },
        { id: "field_1", name: "P1 Campo", player: 1, x: 40, y: 290, type: "field" },
        { id: "banished_1", name: "P1 Desterrado", player: 1, x: 755, y: 290, type: "banished" },
        { id: "deck_1", name: "P1 Deck", player: 1, x: 860, y: 400, type: "deck" },
        { id: "grave_1", name: "P1 Cementerio", player: 1, x: 860, y: 290, type: "grave" },
        { id: "monster_1_1", name: "P1 Monstruo 1", player: 1, x: 170, y: 290, type: "monster" },
        { id: "monster_1_2", name: "P1 Monstruo 2", player: 1, x: 290, y: 290, type: "monster" },
        { id: "monster_1_3", name: "P1 Monstruo 3", player: 1, x: 410, y: 290, type: "monster" },
        { id: "monster_1_4", name: "P1 Monstruo 4", player: 1, x: 530, y: 290, type: "monster" },
        { id: "monster_1_5", name: "P1 Monstruo 5", player: 1, x: 650, y: 290, type: "monster" },
        { id: "spell_1_1", name: "P1 Magia/Trampa 1", player: 1, x: 170, y: 400, type: "spell" },
        { id: "spell_1_2", name: "P1 Magia/Trampa 2", player: 1, x: 290, y: 400, type: "spell" },
        { id: "spell_1_3", name: "P1 Magia/Trampa 3", player: 1, x: 410, y: 400, type: "spell" },
        { id: "spell_1_4", name: "P1 Magia/Trampa 4", player: 1, x: 530, y: 400, type: "spell" },
        { id: "spell_1_5", name: "P1 Magia/Trampa 5", player: 1, x: 650, y: 400, type: "spell" }
    ],
    pokemon: [
        // Player 2 (Top Half, Mirrored) - Red/Pink Theme
        { id: "deck_2", name: "P2 Deck", player: 2, x: 40, y: 20, type: "deck" },
        { id: "grave_2", name: "P2 Descarte", player: 2, x: 40, y: 130, type: "grave" },
        { id: "active_2", name: "P2 Activo", player: 2, x: 510, y: 130, type: "active" },
        { id: "bench_2_5", name: "P2 Banca 5", player: 2, x: 310, y: 20, type: "bench" },
        { id: "bench_2_4", name: "P2 Banca 4", player: 2, x: 410, y: 20, type: "bench" },
        { id: "bench_2_3", name: "P2 Banca 3", player: 2, x: 510, y: 20, type: "bench" },
        { id: "bench_2_2", name: "P2 Banca 2", player: 2, x: 610, y: 20, type: "bench" },
        { id: "bench_2_1", name: "P2 Banca 1", player: 2, x: 710, y: 20, type: "bench" },
        { id: "prize_2_1", name: "P2 Premio 1", player: 2, x: 850, y: 130, type: "prize" },
        { id: "prize_2_2", name: "P2 Premio 2", player: 2, x: 850, y: 20, type: "prize" },
        { id: "prize_2_3", name: "P2 Premio 3", player: 2, x: 780, y: 130, type: "prize" },
        { id: "prize_2_4", name: "P2 Premio 4", player: 2, x: 780, y: 20, type: "prize" },
        { id: "prize_2_5", name: "P2 Premio 5", player: 2, x: 710, y: 130, type: "prize" },
        { id: "prize_2_6", name: "P2 Premio 6", player: 2, x: 710, y: 20, type: "prize" },

        // Player 1 (Bottom Half) - Blue Theme
        { id: "prize_1_1", name: "P1 Premio 1", player: 1, x: 40, y: 290, type: "prize" },
        { id: "prize_1_2", name: "P1 Premio 2", player: 1, x: 40, y: 400, type: "prize" },
        { id: "prize_1_3", name: "P1 Premio 3", player: 1, x: 110, y: 290, type: "prize" },
        { id: "prize_1_4", name: "P1 Premio 4", player: 1, x: 110, y: 400, type: "prize" },
        { id: "prize_1_5", name: "P1 Premio 5", player: 1, x: 180, y: 290, type: "prize" },
        { id: "prize_1_6", name: "P1 Premio 6", player: 1, x: 180, y: 400, type: "prize" },
        { id: "active_1", name: "P1 Activo", player: 1, x: 510, y: 290, type: "active" },
        { id: "bench_1_1", name: "P1 Banca 1", player: 1, x: 310, y: 400, type: "bench" },
        { id: "bench_1_2", name: "P1 Banca 2", player: 1, x: 410, y: 400, type: "bench" },
        { id: "bench_1_3", name: "P1 Banca 3", player: 1, x: 510, y: 400, type: "bench" },
        { id: "bench_1_4", name: "P1 Banca 4", player: 1, x: 610, y: 400, type: "bench" },
        { id: "bench_1_5", name: "P1 Banca 5", player: 1, x: 710, y: 400, type: "bench" },
        { id: "deck_1", name: "P1 Deck", player: 1, x: 860, y: 400, type: "deck" },
        { id: "grave_1", name: "P1 Descarte", player: 1, x: 860, y: 290, type: "grave" }
    ]
};

// High-Fidelity Mock card collection to preload if no custom "test" deck exists
const HIGH_FIDELITY_MOCKS = [
    { name: "Dragón Blanco de Ojos Azules", image_url: "https://images.ygoprodeck.com/images/cards/89631139.jpg" },
    { name: "Mago Oscuro", image_url: "https://images.ygoprodeck.com/images/cards/46986414.jpg" },
    { name: "Chica Maga Oscura", image_url: "https://images.ygoprodeck.com/images/cards/31755083.jpg" },
    { name: "Dragón Negro de Ojos Rojos", image_url: "https://images.ygoprodeck.com/images/cards/74677422.jpg" },
    { name: "Kuriboh", image_url: "https://images.ygoprodeck.com/images/cards/40640057.jpg" },
    { name: "Exodia el Prohibido", image_url: "https://images.ygoprodeck.com/images/cards/33396948.jpg" },
    { name: "Polimerización", image_url: "https://images.ygoprodeck.com/images/cards/24094653.jpg" },
    { name: "Fuerza de Espejo", image_url: "https://images.ygoprodeck.com/images/cards/44095762.jpg" },
    { name: "Tifón del Espacio Místico", image_url: "https://images.ygoprodeck.com/images/cards/5318639.jpg" },
    { name: "Olla de la Codicia", image_url: "https://images.ygoprodeck.com/images/cards/55144522.jpg" }
];

// Application State
const state = {
    roomId: null,
    mode: "practice", // "practice" mode is fully enabled
    layout: "yugioh",
    cards: [], // All active card instances currently in game
    decks: { player1: [], player2: [] }, // Raw decks selected
    currentUser: null
};

// Active drag tracking
let dragCard = null;
let dragOffset = { x: 0, y: 0 };
let activeMenuCard = null;
let activeMenuDeckPlayer = null; // tracking which player deck is clicked

// Page initialization
$(document).ready(async function() {
    initLayout();
    await checkUserSessionAndPreload();
    setupEventListeners();
});

// Configure Playmat Field Zones & Scale
function initLayout() {
    $("#dynamic-zones-container").empty();

    // Add central separator
    $("#dynamic-zones-container").append('<div class="playmat-divider"></div>');

    const zones = BOARD_LAYOUTS[state.layout];

    zones.forEach(zone => {
        const playerClass = zone.player === 1 ? "zone-player-1" : "zone-player-2";
        const typeClass = `zone-type-${zone.type}`;
        const zoneHTML = `
            <div class="board-zone ${playerClass} ${typeClass}" id="zone-${zone.id}" style="left: ${zone.x}px; top: ${zone.y}px;" data-id="${zone.id}" data-player="${zone.player}">
                <div class="zone-label">${zone.name}</div>
                ${(zone.type === "deck" || zone.type === "grave" || zone.type === "extra" || zone.type === "banished") ? `<div class="zone-card-count" id="count-${zone.id}">0</div>` : ""}
            </div>
        `;
        $("#dynamic-zones-container").append(zoneHTML);
    });

    renderAllCards();
}

// Fetch active user session or public/mock decks
async function checkUserSessionAndPreload() {
    try {
        const { data: { session } } = await _supabase.auth.getSession();
        let loadedCustom = false;

        if (session && session.user) {
            state.currentUser = session.user;
            loadedCustom = await loadDecksForUser(session.user.id);
        }

        if (!loadedCustom) {
            // Preload high-fidelity mocks directly immediately!
            loadMockDecks();
        }
    } catch (err) {
        console.error("Error checking user session:", err);
        loadMockDecks();
    }
}

// Load custom user decks specifically belonging to the active logged-in user
async function loadDecksForUser(userId) {
    try {
        const { data: decks, error } = await _supabase
            .from('decks')
            .select('id, name')
            .eq('user_id', userId);

        if (error) throw error;

        if (decks && decks.length > 0) {
            // Search for a deck named "test"
            const testDeck = decks.find(d => d.name.toLowerCase() === "test") || decks[0];
            if (testDeck) {
                await fetchDeckCards(testDeck.id, "player1");
                instantiateDeck("player1");

                // Duplicate for player 2 in practice mode to have an opponent deck pre-populated
                state.decks["player2"] = [...state.decks["player1"]];
                instantiateDeck("player2");
                return true;
            }
        }
    } catch (err) {
        console.error("Error loading user decks:", err);
    }
    return false;
}

// Load Mock high-fidelity cards
function loadMockDecks() {
    state.decks["player1"] = [...HIGH_FIDELITY_MOCKS];
    state.decks["player2"] = [...HIGH_FIDELITY_MOCKS];
    instantiateDeck("player1");
    instantiateDeck("player2");
}

// Fetch raw card templates for selected deck
async function fetchDeckCards(deckId, playerKey) {
    try {
        const { data: cards, error } = await _supabase
            .from('deck_cards')
            .select('*')
            .eq('deck_id', deckId)
            .order('position', { ascending: true });

        if (error) throw error;
        state.decks[playerKey] = cards || [];
    } catch (err) {
        console.error("Error loading deck cards:", err);
    }
}

// Populate virtual card instances on board
function instantiateDeck(playerKey) {
    const deckCards = state.decks[playerKey];
    if (!deckCards || deckCards.length === 0) return;

    // Filter out previously loaded cards of this player from game cards
    state.cards = state.cards.filter(c => c.owner !== playerKey);

    // Create virtual card instances
    deckCards.forEach((c, index) => {
        state.cards.push({
            instanceId: `card_${playerKey}_${Date.now()}_${index}_${Math.floor(Math.random() * 1000)}`,
            name: c.name || "Carta",
            imageUrl: c.image_url || "https://vikingtcg.xyz/favi.png",
            owner: playerKey,
            controller: playerKey,
            zone: `deck_${playerKey === "player1" ? 1 : 2}`, // Initial zone is the player's deck pile
            faceDown: true, // Face down in deck by default
            tapped: false,
            counters: 0,
            x: 0,
            y: 0,
            z: index + 1
        });
    });

    renderAllCards();
}

// Multi-deck setup / Rendering
function renderAllCards() {
    // Clear field and hand containers
    $("#field-cards-container").empty();
    $("#hand-p1").empty();
    $("#hand-p2").empty();

    // Reset zone stack trackers
    const zoneCounts = {};
    BOARD_LAYOUTS[state.layout].forEach(z => {
        zoneCounts[z.id] = 0;
    });

    // Sort cards by z-index
    state.cards.sort((a, b) => a.z - b.z);

    state.cards.forEach(card => {
        const isHand = card.zone.startsWith("hand_");

        // Count cards in piles
        const isPile = card.zone.startsWith("deck_") || card.zone.startsWith("grave_") || card.zone.startsWith("banished_") || card.zone.startsWith("extra_");
        if (isPile) {
            zoneCounts[card.zone] = (zoneCounts[card.zone] || 0) + 1;
        }

        // Render card
        const cardHTML = `
            <div class="duel-card ${card.faceDown ? 'face-down' : ''} ${card.tapped ? 'tapped' : ''}"
                 id="${card.instanceId}"
                 data-instance-id="${card.instanceId}">
                <div class="card-img-wrapper">
                    <img src="${card.imageUrl}" alt="${card.name}">
                </div>
                ${card.counters > 0 ? `<div class="card-counter">${card.counters}</div>` : ""}
            </div>
        `;

        if (isHand) {
            // Render inside Hand Tray
            const targetTray = card.zone === "hand_1" ? "#hand-p1" : "#hand-p2";
            $(targetTray).append(cardHTML);
        } else if (isPile) {
            // Stacked card at pile position (Only render top card or none, but with active count badge)
            // To make dragging pile top card interactive, we render only the TOP CARD of the deck/pile!
            const totalInPile = zoneCounts[card.zone];

            // Check if this card is indeed the top card in pile
            const cardsInThisZone = state.cards.filter(c => c.zone === card.zone);
            const topCard = cardsInThisZone[cardsInThisZone.length - 1];

            if (topCard && topCard.instanceId === card.instanceId) {
                $("#field-cards-container").append(cardHTML);
                // Position card at zone coordinates
                const zoneObj = BOARD_LAYOUTS[state.layout].find(z => z.id === card.zone);
                if (zoneObj) {
                    $(`#${card.instanceId}`).css({
                        left: `${zoneObj.x}px`,
                        top: `${zoneObj.y}px`
                    });
                }
            }
        } else {
            // Render freely on playmat
            $("#field-cards-container").append(cardHTML);

            // Determine position
            const zoneObj = BOARD_LAYOUTS[state.layout].find(z => z.id === card.zone);
            if (zoneObj) {
                // Snapped to board slot center
                $(`#${card.instanceId}`).css({
                    left: `${zoneObj.x}px`,
                    top: `${zoneObj.y}px`
                });
            } else {
                // Free absolute float placement
                $(`#${card.instanceId}`).css({
                    left: `${card.x}px`,
                    top: `${card.y}px`
                });
            }
        }
    });

    // Update pile count labels on the playmat UI
    BOARD_LAYOUTS[state.layout].forEach(zone => {
        const count = zoneCounts[zone.id] || 0;
        $(`#count-${zone.id}`).text(count);
    });

    bindCardDragEvents();
}

// Bind custom touch/mouse drag handlers on freshly rendered cards
function bindCardDragEvents() {
    const cards = $(".duel-card");

    // Hover preview update
    cards.off('mouseenter').on('mouseenter', function() {
        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (cardObj) {
            updatePreview(cardObj);
        }
    });

    cards.off('mousedown touchstart').on('mousedown touchstart', function(e) {
        e.preventDefault();
        e.stopPropagation();

        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (!cardObj) return;

        // Visual preview selection
        updatePreview(cardObj);

        dragCard = $(this);
        dragCard.addClass("dragging").removeClass("snapping");

        // Bring to front physically on screen
        const maxZ = state.cards.length > 0 ? Math.max(...state.cards.map(c => c.z)) : 10;
        cardObj.z = maxZ + 1;
        dragCard.css("z-index", cardObj.z);

        const pos = getEventCoords(e);
        const cardOffset = dragCard.offset();

        // Calculate offset relative to mouse/touch position
        dragOffset.x = pos.x - cardOffset.left;
        dragOffset.y = pos.y - cardOffset.top;
    });
}

// Helper to resolve client touch vs mouse coords
function getEventCoords(e) {
    if (e.type.startsWith('touch')) {
        const t = e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
        return { x: t.clientX, y: t.clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

// Global window event listeners for active drag tracking
$(window).on('mousemove touchmove', function(e) {
    if (!dragCard) return;
    e.preventDefault();

    const instId = dragCard.data("instance-id");
    const cardObj = state.cards.find(c => c.instanceId === instId);
    if (!cardObj) return;

    const pos = getEventCoords(e);
    const matOffset = $("#playmat").offset();

    // Free movement boundaries relative to playmat container
    const x = pos.x - matOffset.left - dragOffset.x;
    const y = pos.y - matOffset.top - dragOffset.y;

    // Constrain inside mat viewport boundaries + offset spacing
    const boundedX = Math.max(-10, Math.min(960 - 55, x));
    const boundedY = Math.max(-10, Math.min(520 - 85, y));

    cardObj.x = boundedX;
    cardObj.y = boundedY;

    // Apply immediate position overrides (bypassing smooth snaps during live movement)
    dragCard.css({
        left: `${boundedX}px`,
        top: `${boundedY}px`
    });

    // Check collision highlights against zones underneath the dragged card
    const centerCoords = {
        x: boundedX + 33,
        y: boundedY + 48
    };

    $(".board-zone").removeClass("highlighted");
    const overlappingZone = findOverlappingZone(centerCoords);
    if (overlappingZone) {
        $(`#zone-${overlappingZone.id}`).addClass("highlighted");
    }
});

$(window).on('mouseup touchend', function(e) {
    if (!dragCard) return;

    const instId = dragCard.data("instance-id");
    const cardObj = state.cards.find(c => c.instanceId === instId);
    if (!cardObj) return;

    dragCard.removeClass("dragging").addClass("snapping");
    $(".board-zone").removeClass("highlighted");

    // Center point of dropped card
    const centerCoords = {
        x: cardObj.x + 33,
        y: cardObj.y + 48
    };

    // Determine target dropping destination (Zone, Hand tray, or Free Board float)
    const hoverZone = findOverlappingZone(centerCoords);
    const isOverP1Hand = checkHandTrayHover(e, "#hand-tray-p1");
    const isOverP2Hand = checkHandTrayHover(e, "#hand-tray-p2");

    if (isOverP1Hand) {
        // Return/move to Player 1 hand
        cardObj.zone = "hand_1";
        cardObj.controller = "player1";
    } else if (isOverP2Hand) {
        // Return/move to Player 2 hand
        cardObj.zone = "hand_2";
        cardObj.controller = "player2";
    } else if (hoverZone) {
        // Drop card inside target zone
        cardObj.zone = hoverZone.id;
        // Snap coordinates are mapped to zone centers automatically in render
    } else {
        // Card was dropped freely on field
        cardObj.zone = "field_free";
    }

    dragCard = null;
    renderAllCards();
});

// Collision handler against zones
function findOverlappingZone(coords) {
    const zones = BOARD_LAYOUTS[state.layout];
    for (let i = 0; i < zones.length; i++) {
        const z = zones[i];
        // simple box overlaps
        const width = 66;
        const height = 96;
        if (coords.x >= z.x && coords.x <= z.x + width &&
            coords.y >= z.y && coords.y <= z.y + height) {
            return z;
        }
    }
    return null;
}

// Collision helper against hands trays
function checkHandTrayHover(e, traySelector) {
    const tray = $(traySelector);
    if (!tray.length) return false;

    const coords = getEventCoords(e);
    const offset = tray.offset();
    const w = tray.width();
    const h = tray.height();

    return (coords.x >= offset.left && coords.x <= offset.left + w &&
            coords.y >= offset.top && coords.y <= offset.top + h);
}

// Side info detailed previewer
function updatePreview(card) {
    $("#detail-card-img").attr("src", card.imageUrl);
    $("#detail-card-name").text(card.name);
    $("#detail-card-desc").text(`Propietario: ${card.owner === "player1" ? "Jugador 1" : "Jugador 2"}\nZona: ${card.zone.toUpperCase()}\nEstado: ${card.faceDown ? "Boca Abajo" : "Boca Arriba"}\nContadores: ${card.counters}`);
}

// Shuffle deck piles
function shuffleDeck(playerKey) {
    const deckZone = playerKey === "player1" ? "deck_1" : "deck_2";
    const deckCards = state.cards.filter(c => c.zone === deckZone);

    if (deckCards.length === 0) {
        return;
    }

    // Fisher-Yates shuffle cards array
    for (let i = deckCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tempZ = deckCards[i].z;
        deckCards[i].z = deckCards[j].z;
        deckCards[j].z = tempZ;
    }

    renderAllCards();

    Swal.fire({
        icon: 'success',
        title: 'Barajado',
        text: `El deck ha sido barajado.`,
        toast: true,
        position: 'top-end',
        timer: 1500,
        showConfirmButton: false
    });
}

// Draw cards from top deck with stunning flight motion animation
function drawCards(playerKey, count = 1) {
    const deckZone = playerKey === "player1" ? "deck_1" : "deck_2";
    const targetHand = playerKey === "player1" ? "hand_1" : "hand_2";
    const traySelector = playerKey === "player1" ? "#hand-p1" : "#hand-p2";

    // Gather cards currently inside player's deck, sorted by stack depth (z-index)
    const deckCards = state.cards
        .filter(c => c.zone === deckZone)
        .sort((a, b) => b.z - a.z); // top card is largest z-index

    if (deckCards.length === 0) {
        return;
    }

    const drawCount = Math.min(count, deckCards.length);

    // For single cards, animate beautifully. For multiple, execute sequential flying cards.
    for (let i = 0; i < drawCount; i++) {
        const card = deckCards[i];

        // Find screen coordinates of the deck zone element
        const $deckZoneEl = $(`#zone-${deckZone}`);
        if ($deckZoneEl.length) {
            const deckOffset = $deckZoneEl.offset();
            const deckWidth = $deckZoneEl.outerWidth();
            const deckHeight = $deckZoneEl.outerHeight();

            // Spawn a temporary flying card visual clone
            const $flying = $('<div class="flying-card card-back"></div>');
            $flying.css({
                top: deckOffset.top,
                left: deckOffset.left,
                transform: 'scale(1) rotate(0deg)'
            });
            $('body').append($flying);

            // Determine target landing hand position
            const $handTray = $(traySelector);
            let targetLeft = window.innerWidth / 2 - 33;
            let targetTop = playerKey === "player1" ? window.innerHeight - 110 : 10;

            if ($handTray.length) {
                const trayOffset = $handTray.offset();
                const cardsCount = $handTray.children().length;
                targetTop = trayOffset.top + ($handTray.height() / 2) - 48;
                // Distribute slightly to the right of current hand cards
                targetLeft = trayOffset.left + ($handTray.width() / 2) - 33 + (cardsCount * 15);
            }

            // Trigger the transition using requestAnimationFrame to ensure the initial state is registered
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    $flying.css({
                        top: targetTop,
                        left: targetLeft,
                        transform: 'scale(1.1) rotate(360deg)'
                    });
                });
            });

            // After animation ends, remove clone and add to visual hand tray state
            setTimeout(() => {
                $flying.remove();
                card.zone = targetHand;
                card.faceDown = false; // Draw face up for ease in Practice
                renderAllCards();
            }, 500);
        } else {
            // Fallback without animation
            card.zone = targetHand;
            card.faceDown = false;
            renderAllCards();
        }
    }
}

// Search and extract from deck
function openSearchModal(playerKey) {
    const deckZone = playerKey === "player1" ? "deck_1" : "deck_2";
    const deckCards = state.cards.filter(c => c.zone === deckZone);

    $("#search-modal-title").text(`Buscando en: ${playerKey === "player1" ? "P1 Deck" : "P2 Deck"}`);
    $("#search-cards-grid").empty();

    if (deckCards.length === 0) {
        $("#search-cards-grid").append('<p style="color: #999; grid-column: 1/-1; text-align: center;">No hay cartas en el Deck.</p>');
    } else {
        deckCards.forEach(card => {
            const cardHTML = `
                <div class="search-card-item" data-instance-id="${card.instanceId}">
                    <img src="${card.imageUrl}" alt="${card.name}">
                </div>
            `;
            $("#search-cards-grid").append(cardHTML);
        });
    }

    $("#search-overlay").fadeIn(200).css("display", "flex");

    // Click inside search results to pull card directly to hand
    $(".search-card-item").off("click").on("click", function() {
        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (cardObj) {
            cardObj.zone = playerKey === "player1" ? "hand_1" : "hand_2";
            cardObj.faceDown = false;
            renderAllCards();
            $("#search-overlay").fadeOut(200);
            Swal.fire({
                icon: 'success',
                title: 'Añadida',
                text: `${cardObj.name} añadida a la mano.`,
                toast: true,
                position: 'top-end',
                timer: 1500,
                showConfirmButton: false
            });
        }
    });
}

function setupEventListeners() {
    // Menu layout toggle
    $("#select-board-layout").change(function() {
        state.layout = $(this).val();
        initLayout();
    });

    $("#btn-reset-game").click(function() {
        Swal.fire({
            title: '¿Limpiar Tablero?',
            text: 'Se eliminarán todas las cartas y se recargarán los decks iniciales.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, reiniciar',
            cancelButtonText: 'Cancelar'
        }).then((res) => {
            if (res.isConfirmed) {
                state.cards = [];
                checkUserSessionAndPreload();
            }
        });
    });

    // Right click context menu overrides on card items
    $(document).on("contextmenu", ".duel-card", function(e) {
        e.preventDefault();
        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (!cardObj) return;

        activeMenuCard = cardObj;
        $("#deck-menu").removeClass("active");
        $("#card-menu").css({
            left: `${e.clientX}px`,
            top: `${e.clientY}px`
        }).addClass("active");
    });

    // Right click context menu on Deck Zone elements (Or Left click to open deck options)
    $(document).on("click contextmenu", ".board-zone.zone-type-deck", function(e) {
        e.preventDefault();
        e.stopPropagation();

        const zoneId = $(this).data("id");
        activeMenuDeckPlayer = zoneId === "zone-deck_1" || zoneId === "deck_1" ? "player1" : "player2";

        $("#card-menu").removeClass("active");
        $("#deck-menu").css({
            left: `${e.clientX}px`,
            top: `${e.clientY}px`
        }).addClass("active");
    });

    // Hide context menus on global left click
    $(document).on("click", function() {
        $("#card-menu").removeClass("active");
        $("#deck-menu").removeClass("active");
    });

    // Card Menu Action handlers
    $("#menu-flip").click(function() {
        if (!activeMenuCard) return;
        activeMenuCard.faceDown = !activeMenuCard.faceDown;
        renderAllCards();
    });

    $("#menu-tap").click(function() {
        if (!activeMenuCard) return;
        activeMenuCard.tapped = !activeMenuCard.tapped;
        renderAllCards();
    });

    $("#menu-add-counter").click(function() {
        if (!activeMenuCard) return;
        activeMenuCard.counters += 1;
        renderAllCards();
    });

    $("#menu-sub-counter").click(function() {
        if (!activeMenuCard) return;
        activeMenuCard.counters = Math.max(0, activeMenuCard.counters - 1);
        renderAllCards();
    });

    $("#menu-to-hand").click(function() {
        if (!activeMenuCard) return;
        activeMenuCard.zone = activeMenuCard.owner === "player1" ? "hand_1" : "hand_2";
        renderAllCards();
    });

    $("#menu-to-grave").click(function() {
        if (!activeMenuCard) return;
        activeMenuCard.zone = activeMenuCard.owner === "player1" ? "grave_1" : "grave_2";
        activeMenuCard.faceDown = false; // face up in grave
        activeMenuCard.tapped = false;
        renderAllCards();
    });

    $("#menu-to-deck-top").click(function() {
        if (!activeMenuCard) return;
        const targetZone = activeMenuCard.owner === "player1" ? "deck_1" : "deck_2";
        activeMenuCard.zone = targetZone;
        activeMenuCard.faceDown = true;
        activeMenuCard.tapped = false;

        const zoneCards = state.cards.filter(c => c.zone === targetZone);
        const maxZ = zoneCards.length > 0 ? Math.max(...zoneCards.map(c => c.z)) : 1;
        activeMenuCard.z = maxZ + 1;

        renderAllCards();
    });

    $("#menu-to-deck-bottom").click(function() {
        if (!activeMenuCard) return;
        const targetZone = activeMenuCard.owner === "player1" ? "deck_1" : "deck_2";
        activeMenuCard.zone = targetZone;
        activeMenuCard.faceDown = true;
        activeMenuCard.tapped = false;

        const zoneCards = state.cards.filter(c => c.zone === targetZone);
        const minZ = zoneCards.length > 0 ? Math.min(...zoneCards.map(c => c.z)) : 1;
        activeMenuCard.z = minZ - 1;

        renderAllCards();
    });

    // Deck Menu Action handlers
    $("#deck-menu-draw").click(function() {
        if (activeMenuDeckPlayer) {
            drawCards(activeMenuDeckPlayer, 1);
        }
    });

    $("#deck-menu-shuffle").click(function() {
        if (activeMenuDeckPlayer) {
            shuffleDeck(activeMenuDeckPlayer);
        }
    });

    $("#deck-menu-search").click(function() {
        if (activeMenuDeckPlayer) {
            openSearchModal(activeMenuDeckPlayer);
        }
    });

    $("#deck-menu-concede").click(function() {
        Swal.fire({
            title: '¿Rendirse?',
            text: 'Concedes el juego. El tablero se reiniciará.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, conceder',
            cancelButtonText: 'Cancelar'
        }).then((res) => {
            if (res.isConfirmed) {
                state.cards = [];
                checkUserSessionAndPreload();
            }
        });
    });

    // Modal Search Close
    $("#btn-close-search").click(function() {
        $("#search-overlay").fadeOut(200);
    });
}
