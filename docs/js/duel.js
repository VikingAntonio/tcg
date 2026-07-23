// Vikingdev Duel Simulator Engine

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

// Application State
const state = {
    roomId: null,
    mode: "practice", // "practice" or "online"
    layout: "yugioh",
    myRole: "player1", // Default role. Online connects P1 (creator) or P2 (joiner)
    lp: { player1: 8000, player2: 8000 },
    cards: [], // All active card instances currently in game
    decks: { player1: [], player2: [] }, // Raw decks selected
    userList: [],
    syncChannel: null,
    currentUser: null
};

// Active drag tracking
let dragCard = null;
let dragOffset = { x: 0, y: 0 };
let activeMenuCard = null;

// Page initialization
$(document).ready(async function() {
    initLayout();
    await checkUserSession();
    setupEventListeners();
    parseUrlParameters();
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
            <div class="board-zone ${playerClass} ${typeClass}" id="zone-${zone.id}" style="left: ${zone.x}px; top: ${zone.y}px;" data-id="${zone.id}">
                <div class="zone-label">${zone.name}</div>
                ${(zone.type === "deck" || zone.type === "grave" || zone.type === "extra" || zone.type === "banished") ? `<div class="zone-card-count" id="count-${zone.id}">0</div>` : ""}
            </div>
        `;
        $("#dynamic-zones-container").append(zoneHTML);
    });

    renderAllCards();
}

// Fetch active user session or public/mock decks
async function checkUserSession() {
    $("#select-user-deck").prop('disabled', true).html('<option value="">Verificando sesión...</option>');
    $("#btn-load-p1, #btn-load-p2").prop('disabled', true);

    try {
        const { data: { session } } = await _supabase.auth.getSession();

        if (session && session.user) {
            state.currentUser = session.user;
            // Load custom user decks
            await loadDecksForUser(session.user.id);
        } else {
            // User is not logged in
            state.currentUser = null;
            $("#select-user-deck").html('<option value="">Inicia sesión para cargar decks</option>');
            Swal.fire({
                icon: 'info',
                title: 'No has iniciado sesión',
                text: 'Para usar tus decks construidos en el simulador, por favor inicia sesión. Puedes seguir probando las mecánicas usando el simulador libremente.',
                confirmButtonText: 'Entendido'
            });
        }
    } catch (err) {
        console.error("Error checking user session:", err);
        $("#select-user-deck").html('<option value="">Error al verificar sesión</option>');
    }
}

// Load custom user decks specifically belonging to the active logged-in user
async function loadDecksForUser(userId) {
    $("#select-user-deck").prop('disabled', true).html('<option value="">Cargando tus decks...</option>');

    try {
        const { data: decks, error } = await _supabase
            .from('decks')
            .select('id, name')
            .eq('user_id', userId)
            .order('name', { ascending: true });

        if (error) throw error;

        if (!decks || decks.length === 0) {
            $("#select-user-deck").html('<option value="">No tienes decks creados</option>');
            return;
        }

        let html = '<option value="">-- Elige tu Deck --</option>';
        decks.forEach(deck => {
            html += `<option value="${deck.id}">${deck.name}</option>`;
        });
        $("#select-user-deck").html(html).prop('disabled', false);
    } catch (err) {
        console.error("Error loading user decks:", err);
        $("#select-user-deck").html('<option value="">Error al cargar decks</option>');
    }
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
        Swal.fire({
            icon: 'success',
            title: 'Deck cargado',
            text: `Se cargaron ${cards.length} cartas para ${playerKey === "player1" ? "Jugador 1" : "Jugador 2"}`,
            toast: true,
            position: 'top-end',
            timer: 2000,
            showConfirmButton: false
        });
    } catch (err) {
        console.error("Error loading deck cards:", err);
        Swal.fire('Error', 'No se pudieron descargar las cartas del deck', 'error');
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
    broadcastState();
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

    cards.off('mousedown touchstart').on('mousedown touchstart', function(e) {
        e.preventDefault();
        e.stopPropagation();

        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (!cardObj) return;

        // Visual preview selection
        updatePreview(cardObj);

        // Dragging is permitted if in Practice, or if Online & you are the controller/owner
        if (state.mode === "online" && cardObj.controller !== state.myRole) {
            // You can only drag your own controlled cards, but can hover or view anything
            Swal.fire({
                icon: 'warning',
                title: 'No te pertenece',
                text: 'Solo puedes mover tus propias cartas.',
                toast: true,
                position: 'top-end',
                timer: 1500,
                showConfirmButton: false
            });
            return;
        }

        dragCard = $(this);
        dragCard.addClass("dragging").removeClass("snapping");

        // Bring to front physically on screen
        const maxZ = state.cards.length > 0 ? Math.max(...state.cards.map(c => c.z)) : 10;
        cardObj.z = maxZ + 1;
        dragCard.css("z-index", cardObj.z);

        const pos = getEventCoords(e);
        const cardOffset = dragCard.offset();
        const matOffset = $("#playmat").offset();

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
    broadcastState();
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
    $("#detail-card-desc").text(`Propietario: ${card.owner === "player1" ? "Jugador 1" : "Jugador 2"}\nControlador: ${card.controller === "player1" ? "Jugador 1" : "Jugador 2"}\nZona: ${card.zone.toUpperCase()}\nEstado: ${card.faceDown ? "Boca Abajo" : "Boca Arriba"}\nContadores: ${card.counters}`);
}

// Life points mechanics
function adjustLP(player, op, valInputId) {
    const val = parseInt($(valInputId).val()) || 0;
    if (op === "half") {
        state.lp[`player${player}`] = Math.ceil(state.lp[`player${player}`] / 2);
    } else if (op === "add") {
        state.lp[`player${player}`] += val;
    } else if (op === "sub") {
        state.lp[`player${player}`] = Math.max(0, state.lp[`player${player}`] - val);
    }

    updateLPUI();
    broadcastState();
}

// Synchronize LP states visually
function updateLPUI() {
    $("#lp-p1-val").text(state.lp.player1);
    $("#lp-p2-val").text(state.lp.player2);

    // Short glowing scale animations
    $("#lp-p1-val, #lp-p2-val").addClass("glowing");
    setTimeout(() => {
        $("#lp-p1-val, #lp-p2-val").removeClass("glowing");
    }, 400);
}

// Manual play mechanics (monedas / dados)
function flipCoin() {
    $("#coin-res").text("GIRANDO...");
    setTimeout(() => {
        const res = Math.random() < 0.5 ? "CARA" : "CRUZ";
        $("#coin-res").text(res);
        broadcastUtil("coin", res);
    }, 800);
}

// Roll randomized 6-sided die
function rollDice() {
    $("#dice-res").text("LANZANDO...");
    setTimeout(() => {
        const res = Math.floor(Math.random() * 6) + 1;
        $("#dice-res").text(`RESULTADO: ${res}`);
        broadcastUtil("dice", res);
    }, 800);
}

// Shuffle deck piles
function shuffleDeck(playerKey) {
    const deckZone = playerKey === "player1" ? "deck_1" : "deck_2";
    const deckCards = state.cards.filter(c => c.zone === deckZone);

    if (deckCards.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Sin cartas',
            text: 'El deck de este jugador no tiene cartas para barajar.',
            toast: true,
            position: 'top-end',
            timer: 1500,
            showConfirmButton: false
        });
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
    broadcastState();

    Swal.fire({
        icon: 'success',
        title: 'Deck barajado',
        text: `Se barajaron ${deckCards.length} cartas del deck.`,
        toast: true,
        position: 'top-end',
        timer: 1500,
        showConfirmButton: false
    });
}

// Draw cards from top deck
function drawCards(playerKey, count = 1) {
    const deckZone = playerKey === "player1" ? "deck_1" : "deck_2";
    const targetHand = playerKey === "player1" ? "hand_1" : "hand_2";

    // Gather cards currently inside player's deck, sorted by stack depth (z-index)
    const deckCards = state.cards
        .filter(c => c.zone === deckZone)
        .sort((a, b) => b.z - a.z); // top card is largest z-index

    if (deckCards.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Sin cartas',
            text: 'No quedan cartas en el deck para robar.',
            toast: true,
            position: 'top-end',
            timer: 1500,
            showConfirmButton: false
        });
        return;
    }

    const drawCount = Math.min(count, deckCards.length);
    for (let i = 0; i < drawCount; i++) {
        const card = deckCards[i];
        card.zone = targetHand;
        card.faceDown = (playerKey === "player2" && state.mode === "online"); // hidden card backs if opponent
    }

    renderAllCards();
    broadcastState();
}

// Long-press or Right-click interactive Context Menu logic
function setupEventListeners() {
    // Menu layout toggle
    $("#select-board-layout").change(function() {
        state.layout = $(this).val();
        initLayout();
        broadcastState();
    });

    // Practice/Online Mode selector toggle
    $(".mode-btn").click(function() {
        const mode = $(this).data("mode");
        $(".mode-btn").removeClass("active");
        $(this).addClass("active");

        state.mode = mode;
        if (mode === "online") {
            $(".online-only").slideDown(300);
            initOnlineMode();
        } else {
            $(".online-only").slideUp(300);
            disconnectOnline();
        }
    });

    // Deck Loader Event Bindings
    $("#select-user-deck").change(function() {
        const deckId = $(this).val();
        if (deckId) {
            $("#btn-load-p1, #btn-load-p2").prop('disabled', false);
        } else {
            $("#btn-load-p1, #btn-load-p2").prop('disabled', true);
        }
    });

    $("#btn-load-p1").click(async function() {
        const deckId = $("#select-user-deck").val();
        if (!deckId) return;
        $(this).prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Cargando...');
        await fetchDeckCards(deckId, "player1");
        instantiateDeck("player1");
        $(this).prop('disabled', false).html('<i class="fas fa-download"></i> Cargar a P1');
    });

    $("#btn-load-p2").click(async function() {
        const deckId = $("#select-user-deck").val();
        if (!deckId) return;
        $(this).prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Cargando...');
        await fetchDeckCards(deckId, "player2");
        instantiateDeck("player2");
        $(this).prop('disabled', false).html('<i class="fas fa-download"></i> Cargar a P2');
    });

    // LP trackers bind adjustments
    $(".lp-add").click(function() {
        const player = $(this).data("player");
        adjustLP(player, "add", `#lp-p${player}-input`);
    });

    $(".lp-sub").click(function() {
        const player = $(this).data("player");
        adjustLP(player, "sub", `#lp-p${player}-input`);
    });

    $(".lp-half").click(function() {
        const player = $(this).data("player");
        adjustLP(player, "half", null);
    });

    // Util trigger actions
    $("#btn-flip-coin").click(flipCoin);
    $("#btn-roll-dice").click(rollDice);

    // Fast tool grid bind actions
    $("#btn-shuffle-p1").click(() => shuffleDeck("player1"));
    $("#btn-shuffle-p2").click(() => shuffleDeck("player2"));
    $("#btn-draw-1-p1").click(() => drawCards("player1", 1));
    $("#btn-draw-1-p2").click(() => drawCards("player2", 1));
    $("#btn-draw-5-p1").click(() => drawCards("player1", 5));
    $("#btn-draw-5-p2").click(() => drawCards("player2", 5));

    $("#btn-reset-game").click(function() {
        Swal.fire({
            title: '¿Limpiar Tablero?',
            text: 'Se eliminarán todas las cartas cargadas y se reiniciarán los Life Points.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, reiniciar',
            cancelButtonText: 'Cancelar'
        }).then((res) => {
            if (res.isConfirmed) {
                resetGameSimulator();
                broadcastState();
            }
        });
    });

    // Right click context menu overrides on duel playmat card items
    $(document).on("contextmenu", ".duel-card", function(e) {
        e.preventDefault();
        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (!cardObj) return;

        // Verify controllers to restrict online context triggers
        if (state.mode === "online" && cardObj.controller !== state.myRole) return;

        activeMenuCard = cardObj;
        $("#card-menu").css({
            display: "block",
            left: `${e.clientX}px`,
            top: `${e.clientY}px`
        });
    });

    // Hide context menu on left click clicks
    $(document).on("click", function() {
        $("#card-menu").hide();
    });

    // Context Action handlers
    $("#menu-flip").click(function() {
        if (!activeMenuCard) return;
        activeMenuCard.faceDown = !activeMenuCard.faceDown;
        renderAllCards();
        broadcastState();
    });

    $("#menu-tap").click(function() {
        if (!activeMenuCard) return;
        activeMenuCard.tapped = !activeMenuCard.tapped;
        renderAllCards();
        broadcastState();
    });

    $("#menu-add-counter").click(function() {
        if (!activeMenuCard) return;
        activeMenuCard.counters += 1;
        renderAllCards();
        broadcastState();
    });

    $("#menu-sub-counter").click(function() {
        if (!activeMenuCard) return;
        activeMenuCard.counters = Math.max(0, activeMenuCard.counters - 1);
        renderAllCards();
        broadcastState();
    });

    $("#menu-to-hand").click(function() {
        if (!activeMenuCard) return;
        activeMenuCard.zone = activeMenuCard.owner === "player1" ? "hand_1" : "hand_2";
        renderAllCards();
        broadcastState();
    });

    $("#menu-to-grave").click(function() {
        if (!activeMenuCard) return;
        activeMenuCard.zone = activeMenuCard.owner === "player1" ? "grave_1" : "grave_2";
        activeMenuCard.faceDown = false; // face up in grave
        activeMenuCard.tapped = false;
        renderAllCards();
        broadcastState();
    });

    $("#menu-to-deck-top").click(function() {
        if (!activeMenuCard) return;
        const targetZone = activeMenuCard.owner === "player1" ? "deck_1" : "deck_2";
        activeMenuCard.zone = targetZone;
        activeMenuCard.faceDown = true;
        activeMenuCard.tapped = false;

        // Elevate z-index so it sits at deck top
        const zoneCards = state.cards.filter(c => c.zone === targetZone);
        const maxZ = zoneCards.length > 0 ? Math.max(...zoneCards.map(c => c.z)) : 1;
        activeMenuCard.z = maxZ + 1;

        renderAllCards();
        broadcastState();
    });

    $("#menu-to-deck-bottom").click(function() {
        if (!activeMenuCard) return;
        const targetZone = activeMenuCard.owner === "player1" ? "deck_1" : "deck_2";
        activeMenuCard.zone = targetZone;
        activeMenuCard.faceDown = true;
        activeMenuCard.tapped = false;

        // Reduce z-index so it sits at deck bottom
        const zoneCards = state.cards.filter(c => c.zone === targetZone);
        const minZ = zoneCards.length > 0 ? Math.min(...zoneCards.map(c => c.z)) : 1;
        activeMenuCard.z = minZ - 1;

        renderAllCards();
        broadcastState();
    });

    // Room connection buttons
    $("#btn-create-room").click(createOnlineRoom);
    $("#btn-join-room").click(function() {
        const code = $("#room-code-input").val().trim();
        if (code) {
            joinOnlineRoom(code);
        }
    });

    $("#btn-copy-link").click(function() {
        if (!state.roomId) return;
        const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${state.roomId}`;
        navigator.clipboard.writeText(inviteUrl);
        Swal.fire({
            icon: 'success',
            title: 'Copiado',
            text: 'Enlace de invitación copiado al portapapeles.',
            toast: true,
            position: 'top-end',
            timer: 2000,
            showConfirmButton: false
        });
    });
}

function resetGameSimulator() {
    state.cards = [];
    state.lp = { player1: 8000, player2: 8000 };
    updateLPUI();
    renderAllCards();
}

// Parse initial URL triggers to directly hook into shared rooms
function parseUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam) {
        $("#btn-mode-online").click();
        $("#room-code-input").val(roomParam);
        joinOnlineRoom(roomParam);
    }
}

// Real-time synchronization routines using Supabase Broadcast Channels
function initOnlineMode() {
    updateOnlineUI("connecting", "Estableciendo canal...");
}

function disconnectOnline() {
    if (state.syncChannel) {
        _supabase.removeChannel(state.syncChannel);
        state.syncChannel = null;
    }
    state.roomId = null;
    updateOnlineUI("offline", "Sin conectar");
    $("#btn-copy-link").hide();
}

function updateOnlineUI(status, text) {
    const indicator = $("#room-status span.status-indicator");
    indicator.removeClass("offline connecting online").addClass(status);
    $("#room-status-text").text(text);
}

// Create unique room code and register channel
function createOnlineRoom() {
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    state.myRole = "player1"; // Creator is player 1
    joinOnlineRoom(randomCode);
}

// Join active channel and listen to broadcasts
function joinOnlineRoom(code) {
    disconnectOnline();
    state.roomId = code;
    $("#room-code-input").val(code);
    updateOnlineUI("connecting", "Uniéndose a sala: " + code);

    // Create channel
    state.syncChannel = _supabase.channel(`room:${code}`, {
        config: {
            broadcast: { self: false } // Only receive peer updates
        }
    });

    state.syncChannel
        .on('broadcast', { event: 'JOIN' }, payload => {
            console.log("Peer joined room:", payload);
            updateOnlineUI("online", "Jugador conectado");
            // As creator (Player 1), upon peer connect, push them the current full state
            if (state.myRole === "player1") {
                pushCompleteStateToPeer();
            }
        })
        .on('broadcast', { event: 'STATE_UPDATE' }, payload => {
            console.log("Broadcast state received:", payload);
            updateOnlineUI("online", "Jugador conectado");

            // Re-apply state
            if (payload.payload) {
                state.cards = payload.payload.cards || [];
                state.lp = payload.payload.lp || { player1: 8000, player2: 8000 };
                state.layout = payload.payload.layout || "yugioh";

                // Update Layout selectors if mismatch
                $("#select-board-layout").val(state.layout);
                updateLPUI();
                renderAllCards();
            }
        })
        .on('broadcast', { event: 'UTIL' }, payload => {
            // Coin or dice broadcast
            const data = payload.payload;
            if (data.type === "coin") {
                $("#coin-res").text(data.result);
            } else if (data.type === "dice") {
                $("#dice-res").text(`RESULTADO: ${data.result}`);
            }
        })
        .on('broadcast', { event: 'REQUEST_SYNC' }, payload => {
            if (state.myRole === "player1") {
                pushCompleteStateToPeer();
            }
        })
        .subscribe(status => {
            if (status === 'SUBSCRIBED') {
                updateOnlineUI("online", "Esperando oponente...");
                $("#btn-copy-link").show();

                // If joining as player 2, notify join and ask for sync state
                if (state.myRole !== "player1") {
                    state.myRole = "player2";
                    state.syncChannel.send({
                        type: 'broadcast',
                        event: 'JOIN',
                        payload: { role: 'player2' }
                    });
                }
            } else {
                updateOnlineUI("offline", "Error de canal");
            }
        });
}

// Broadcast revised state to peer
function broadcastState() {
    if (state.mode !== "online" || !state.syncChannel) return;

    state.syncChannel.send({
        type: 'broadcast',
        event: 'STATE_UPDATE',
        payload: {
            cards: state.cards,
            lp: state.lp,
            layout: state.layout
        }
    });
}

// Broadcast dice or coins updates
function broadcastUtil(type, result) {
    if (state.mode !== "online" || !state.syncChannel) return;

    state.syncChannel.send({
        type: 'broadcast',
        event: 'UTIL',
        payload: { type, result }
    });
}

// Explicit state sender
function pushCompleteStateToPeer() {
    broadcastState();
}
