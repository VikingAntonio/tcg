// Duel Simulator Engine

// JSON Playmat layouts for Yu-Gi-Oh and Pokémon TCG
// Scaled layout for a 1120x600 playmat board.
// Card Width: 80px, Height: 116px.
// Let's position things symmetrically and nicely.
const BOARD_LAYOUTS = {
    yugioh: [
        // Player 2 (Top Half, Mirrored) - Red/Pink Theme
        { id: "deck_2", name: "P2 Deck", player: 2, x: 50, y: 30, type: "deck" },
        { id: "grave_2", name: "P2 Cementerio", player: 2, x: 50, y: 160, type: "grave" },
        { id: "banished_2", name: "P2 Desterrado", player: 2, x: 880, y: 160, type: "banished" },
        { id: "extra_2", name: "P2 Extra", player: 2, x: 990, y: 30, type: "extra" },
        { id: "field_2", name: "P2 Campo", player: 2, x: 990, y: 160, type: "field" },
        { id: "monster_2_5", name: "P2 Monstruo 5", player: 2, x: 190, y: 160, type: "monster" },
        { id: "monster_2_4", name: "P2 Monstruo 4", player: 2, x: 310, y: 160, type: "monster" },
        { id: "monster_2_3", name: "P2 Monstruo 3", player: 2, x: 430, y: 160, type: "monster" },
        { id: "monster_2_2", name: "P2 Monstruo 2", player: 2, x: 550, y: 160, type: "monster" },
        { id: "monster_2_1", name: "P2 Monstruo 1", player: 2, x: 670, y: 160, type: "monster" },
        { id: "spell_2_5", name: "P2 Magia/Trampa 5", player: 2, x: 190, y: 30, type: "spell" },
        { id: "spell_2_4", name: "P2 Magia/Trampa 4", player: 2, x: 310, y: 30, type: "spell" },
        { id: "spell_2_3", name: "P2 Magia/Trampa 3", player: 2, x: 430, y: 30, type: "spell" },
        { id: "spell_2_2", name: "P2 Magia/Trampa 2", player: 2, x: 550, y: 30, type: "spell" },
        { id: "spell_2_1", name: "P2 Magia/Trampa 1", player: 2, x: 670, y: 30, type: "spell" },

        // Player 1 (Bottom Half) - Blue Theme
        { id: "extra_1", name: "P1 Extra", player: 1, x: 50, y: 450, type: "extra" },
        { id: "field_1", name: "P1 Campo", player: 1, x: 50, y: 320, type: "field" },
        { id: "banished_1", name: "P1 Desterrado", player: 1, x: 880, y: 320, type: "banished" },
        { id: "deck_1", name: "P1 Deck", player: 1, x: 990, y: 450, type: "deck" },
        { id: "grave_1", name: "P1 Cementerio", player: 1, x: 990, y: 320, type: "grave" },
        { id: "monster_1_1", name: "P1 Monstruo 1", player: 1, x: 190, y: 320, type: "monster" },
        { id: "monster_1_2", name: "P1 Monstruo 2", player: 1, x: 310, y: 320, type: "monster" },
        { id: "monster_1_3", name: "P1 Monstruo 3", player: 1, x: 430, y: 320, type: "monster" },
        { id: "monster_1_4", name: "P1 Monstruo 4", player: 1, x: 550, y: 320, type: "monster" },
        { id: "monster_1_5", name: "P1 Monstruo 5", player: 1, x: 670, y: 320, type: "monster" },
        { id: "spell_1_1", name: "P1 Magia/Trampa 1", player: 1, x: 190, y: 450, type: "spell" },
        { id: "spell_1_2", name: "P1 Magia/Trampa 2", player: 1, x: 310, y: 450, type: "spell" },
        { id: "spell_1_3", name: "P1 Magia/Trampa 3", player: 1, x: 430, y: 450, type: "spell" },
        { id: "spell_1_4", name: "P1 Magia/Trampa 4", player: 1, x: 550, y: 450, type: "spell" },
        { id: "spell_1_5", name: "P1 Magia/Trampa 5", player: 1, x: 670, y: 450, type: "spell" }
    ],
    pokemon: [
        // Player 2 (Top Half, Mirrored) - Red/Pink Theme
        { id: "deck_2", name: "P2 Deck", player: 2, x: 50, y: 30, type: "deck" },
        { id: "grave_2", name: "P2 Descarte", player: 2, x: 50, y: 160, type: "grave" },
        { id: "active_2", name: "P2 Activo", player: 2, x: 590, y: 160, type: "active" },
        { id: "bench_2_5", name: "P2 Banca 5", player: 2, x: 350, y: 30, type: "bench" },
        { id: "bench_2_4", name: "P2 Banca 4", player: 2, x: 470, y: 30, type: "bench" },
        { id: "bench_2_3", name: "P2 Banca 3", player: 2, x: 590, y: 30, type: "bench" },
        { id: "bench_2_2", name: "P2 Banca 2", player: 2, x: 710, y: 30, type: "bench" },
        { id: "bench_2_1", name: "P2 Banca 1", player: 2, x: 830, y: 30, type: "bench" },
        { id: "prize_2_1", name: "P2 Premio 1", player: 2, x: 990, y: 160, type: "prize" },
        { id: "prize_2_2", name: "P2 Premio 2", player: 2, x: 990, y: 30, type: "prize" },
        { id: "prize_2_3", name: "P2 Premio 3", player: 2, x: 910, y: 160, type: "prize" },
        { id: "prize_2_4", name: "P2 Premio 4", player: 2, x: 910, y: 30, type: "prize" },
        { id: "prize_2_5", name: "P2 Premio 5", player: 2, x: 830, y: 160, type: "prize" },
        { id: "prize_2_6", name: "P2 Premio 6", player: 2, x: 830, y: 30, type: "prize" },

        // Player 1 (Bottom Half) - Blue Theme
        { id: "prize_1_1", name: "P1 Premio 1", player: 1, x: 50, y: 320, type: "prize" },
        { id: "prize_1_2", name: "P1 Premio 2", player: 1, x: 50, y: 450, type: "prize" },
        { id: "prize_1_3", name: "P1 Premio 3", player: 1, x: 130, y: 320, type: "prize" },
        { id: "prize_1_4", name: "P1 Premio 4", player: 1, x: 130, y: 450, type: "prize" },
        { id: "prize_1_5", name: "P1 Premio 5", player: 1, x: 210, y: 320, type: "prize" },
        { id: "prize_1_6", name: "P1 Premio 6", player: 1, x: 210, y: 450, type: "prize" },
        { id: "active_1", name: "P1 Activo", player: 1, x: 590, y: 320, type: "active" },
        { id: "bench_1_1", name: "P1 Banca 1", player: 1, x: 350, y: 450, type: "bench" },
        { id: "bench_1_2", name: "P1 Banca 2", player: 1, x: 470, y: 450, type: "bench" },
        { id: "bench_1_3", name: "P1 Banca 3", player: 1, x: 590, y: 450, type: "bench" },
        { id: "bench_1_4", name: "P1 Banca 4", player: 1, x: 710, y: 450, type: "bench" },
        { id: "bench_1_5", name: "P1 Banca 5", player: 1, x: 830, y: 450, type: "bench" },
        { id: "deck_1", name: "P1 Deck", player: 1, x: 990, y: 450, type: "deck" },
        { id: "grave_1", name: "P1 Descarte", player: 1, x: 990, y: 320, type: "grave" }
    ]
};

// High-Fidelity Mock card collection to preload if no custom "test" deck exists
// Contains explicit section definitions for Deck Division: Main and Extra. Side is omitted/ignored on load.
const HIGH_FIDELITY_MOCKS = [
    // Main deck cards
    { name: "Dragón Blanco de Ojos Azules", image_url: "https://images.ygoprodeck.com/images/cards/89631139.jpg", section: "Main" },
    { name: "Mago Oscuro", image_url: "https://images.ygoprodeck.com/images/cards/46986414.jpg", section: "Main" },
    { name: "Chica Maga Oscura", image_url: "https://images.ygoprodeck.com/images/cards/31755083.jpg", section: "Main" },
    { name: "Dragón Negro de Ojos Rojos", image_url: "https://images.ygoprodeck.com/images/cards/74677422.jpg", section: "Main" },
    { name: "Kuriboh", image_url: "https://images.ygoprodeck.com/images/cards/40640057.jpg", section: "Main" },
    { name: "Exodia el Prohibido", image_url: "https://images.ygoprodeck.com/images/cards/33396948.jpg", section: "Main" },
    { name: "Polimerización", image_url: "https://images.ygoprodeck.com/images/cards/24094653.jpg", section: "Main" },
    { name: "Fuerza de Espejo", image_url: "https://images.ygoprodeck.com/images/cards/44095762.jpg", section: "Main" },
    { name: "Tifón del Espacio Místico", image_url: "https://images.ygoprodeck.com/images/cards/5318639.jpg", section: "Main" },
    { name: "Olla de la Codicia", image_url: "https://images.ygoprodeck.com/images/cards/55144522.jpg", section: "Main" },

    // Extra deck cards
    { name: "Dragón de la Flama Espada", image_url: "https://images.ygoprodeck.com/images/cards/90884155.jpg", section: "Extra" },
    { name: "Mago de la Tempestad", image_url: "https://images.ygoprodeck.com/images/cards/20563450.jpg", section: "Extra" },
    { name: "Dragón de la Rosa Negra", image_url: "https://images.ygoprodeck.com/images/cards/73580471.jpg", section: "Extra" },

    // Side deck cards (Will be filtered out and ignored according to instructions)
    { name: " side deck placeholder (ignored)", image_url: "", section: "Side" }
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
let dragCardPending = null;
let dragActive = false;
let dragOffset = { x: 0, y: 0 };
let dragStartCoords = { x: 0, y: 0 };
let dragStartCardPos = { left: 0, top: 0 };
let dragStartTime = 0;
let activeMenuCard = null;
let activeMenuDeckPlayer = null; // tracking which player deck is clicked

// Targeting system state
let targetingCard = null;
let targetActionType = null; // "summon", "set", "defense"

// Page initialization
$(document).ready(async function() {
    initLayout();
    await checkUserSessionAndPreload();
    setupEventListeners();
});

// Targeting system state for Attach attachment process
let attachingCard = null;

// Configure Playmat Field Zones & Scale
function initLayout() {
    $("#dynamic-zones-container").empty();

    // Add central separator
    $("#dynamic-zones-container").append('<div class="playmat-divider"></div>');

    // DYNAMIC CARD BACK SETTING BASED ON THE SELECTED LAYOUT
    if (state.layout === "yugioh") {
        $("body").addClass("layout-yugioh").removeClass("layout-pokemon");
        document.body.style.setProperty('--card-back-url', "url('img/bocabajo.jpg')");
    } else {
        $("body").addClass("layout-pokemon").removeClass("layout-yugioh");
        document.body.style.setProperty('--card-back-url', "url('img/pokeBocaAbajo.jpg')");
    }

    const zones = BOARD_LAYOUTS[state.layout];

    $("#pile-counters-container").empty();
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

        // Render top-level floating count badge for piles
        if (zone.type === "deck" || zone.type === "grave" || zone.type === "extra" || zone.type === "banished") {
            const borderColor = zone.player === 1 ? 'var(--primary-color)' : 'var(--secondary-color)';
            const shadowColor = zone.player === 1 ? 'rgba(0, 210, 255, 0.4)' : 'rgba(255, 27, 107, 0.4)';
            const badgeHTML = `
                <div class="floating-zone-count" id="floating-count-${zone.id}" style="left: ${zone.x + 58}px; top: ${zone.y - 8}px; border-color: ${borderColor}; box-shadow: 0 0 10px ${shadowColor};">
                    0
                </div>
            `;
            $("#pile-counters-container").append(badgeHTML);
        }
    });

    renderAllCards();
}

// Fetch active user session or public/mock decks
async function checkUserSessionAndPreload() {
    try {
        if (typeof _supabase === 'undefined') {
            loadMockDecks();
            return;
        }
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
// Partition: only "Main" section cards populate the Deck pile; "Extra" section cards populate the Extra Deck pile. "Side" cards are ignored.
function instantiateDeck(playerKey) {
    const deckCards = state.decks[playerKey];
    if (!deckCards || deckCards.length === 0) return;

    // Filter out previously loaded cards of this player from game cards
    state.cards = state.cards.filter(c => c.owner !== playerKey);

    const playerSuffix = playerKey === "player1" ? 1 : 2;

    // Create virtual card instances with exact section mapping
    deckCards.forEach((c, index) => {
        const section = c.section || "Main";
        if (section === "Side") {
            // Ignore Side deck completely according to instructions
            return;
        }

        let targetZone = `deck_${playerSuffix}`; // Default is Main Deck
        let isExtra = false;
        if (section === "Extra") {
            if (state.layout === "yugioh") {
                targetZone = `extra_${playerSuffix}`; // Extra Deck pile
                isExtra = true;
            } else {
                targetZone = `deck_${playerSuffix}`; // Force Main Deck for Pokémon
                isExtra = false;
            }
        }

        // Get matching zone coordinates for initial positioning
        const zoneObj = BOARD_LAYOUTS[state.layout].find(z => z.id === targetZone) || { x: 50, y: 30 };

        state.cards.push({
            instanceId: `card_${playerKey}_${Date.now()}_${index}_${Math.floor(Math.random() * 1000)}`,
            name: c.name || "Carta",
            imageUrl: c.image_url || "https://vikingtcg.xyz/favi.png",
            owner: playerKey,
            controller: playerKey,
            zone: targetZone,
            faceDown: true, // Initial pile cards are face down by default
            tapped: false,
            counters: 0,
            attachedTo: null, // Keep track of attached card instances (Energies, Tools, Xyz materials)
            x: zoneObj.x,
            y: zoneObj.y,
            z: index + 1,
            isExtra: isExtra
        });
    });

    if (state.layout === "pokemon") {
        shuffleDeckSilent(playerKey);
    }

    renderAllCards();
}

// Helper to move a card to a zone with a small random crooked/chueco offset so they stack naturally and can be easily dragged
function setCardZoneWithCrookedOffset(cardObj, zoneId) {
    cardObj.zone = zoneId;
    const zoneObj = BOARD_LAYOUTS[state.layout].find(z => z.id === zoneId);
    if (zoneObj) {
        const offsetRange = 14; // max offset of 14px in any direction
        const rx = Math.floor(Math.random() * (offsetRange * 2 + 1)) - offsetRange;
        const ry = Math.floor(Math.random() * (offsetRange * 2 + 1)) - offsetRange;
        cardObj.x = zoneObj.x + rx;
        cardObj.y = zoneObj.y + ry;
    }
}

// Multi-deck setup / Rendering
function renderAllCards() {
    // ENFORCE SANITIZATION RULES SECURELY
    state.cards.forEach(card => {
        // If attached, inherit zone of the parent card to stay logically in play
        if (card.attachedTo) {
            const parent = state.cards.find(c => c.instanceId === card.attachedTo);
            if (parent) {
                card.zone = parent.zone;
                card.faceDown = parent.faceDown;
            } else {
                card.attachedTo = null; // orphan cleanup
            }
        }

        // Rule 1: Hand cards are always face-up
        if (card.zone.startsWith("hand_")) {
            card.faceDown = false;
            card.attachedTo = null; // attached cards returned to hand get detached
        }

        // Rule 2: In Pokémon, field cards are always face-up (except deck and prizes)
        if (state.layout === "pokemon") {
            if (!card.zone.startsWith("deck_") && !card.zone.startsWith("prize_") && !card.zone.startsWith("hand_")) {
                card.faceDown = false;
            }
        }
    });

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
        if (card.isDrawing) return; // Hide card during draw flight animation
        if (card.attachedTo) return; // Render cascades separately below parent!

        const isHand = card.zone.startsWith("hand_");

        // Count cards in piles
        const isPile = card.zone.startsWith("deck_") || card.zone.startsWith("grave_") || card.zone.startsWith("banished_") || card.zone.startsWith("extra_");
        if (isPile) {
            zoneCounts[card.zone] = (zoneCounts[card.zone] || 0) + 1;
        }

        // Render card (Including Hand and Field action overlays dynamically for interactive play)
        let handActionOverlayHTML = "";
        let fieldActionOverlayHTML = "";

        // Find count of cards attached to this parent
        const attachedCards = state.cards.filter(c => c.attachedTo === card.instanceId);
        const attachedCount = attachedCards.length;

        if (isHand) {
            handActionOverlayHTML = `
                <div class="hand-card-actions">
                    <button class="hand-action-btn btn-summon" data-instance-id="${card.instanceId}">Invocar</button>
                    ${state.layout === 'pokemon' ?
                        `<button class="hand-action-btn btn-activate" data-instance-id="${card.instanceId}">Activar</button>
                         <button class="hand-action-btn btn-pokemon-field" data-instance-id="${card.instanceId}">Field</button>` :
                        `<button class="hand-action-btn btn-set" data-instance-id="${card.instanceId}">Set</button>`
                    }
                    <button class="hand-action-btn btn-attach" data-instance-id="${card.instanceId}">Acoplar</button>
                    <button class="hand-action-btn btn-grave" data-instance-id="${card.instanceId}">Cementerio</button>
                    <button class="hand-action-btn btn-banish" data-instance-id="${card.instanceId}">Remover</button>
                    <button class="hand-action-btn btn-deck" data-instance-id="${card.instanceId}">Deck</button>
                </div>
            `;
        } else if (!isPile) {
            // Cards on active playmat slots get a quick field action horizontal ribbon bar - Text only (No icons)
            const returnBtnLabel = card.isExtra ? "Deck" : "Mano";
            fieldActionOverlayHTML = `
                <div class="field-card-actions">
                    <button class="field-action-btn btn-field-flip" data-instance-id="${card.instanceId}">Voltear</button>
                    <button class="field-action-btn btn-field-tap" data-instance-id="${card.instanceId}">Girar</button>
                    <button class="field-action-btn btn-field-attach" data-instance-id="${card.instanceId}">Acoplar</button>
                    <button class="field-action-btn btn-field-flash" data-instance-id="${card.instanceId}">Efecto</button>
                    <button class="field-action-btn btn-field-return" data-instance-id="${card.instanceId}">${returnBtnLabel}</button>
                    <button class="field-action-btn btn-field-grave" data-instance-id="${card.instanceId}">Cementerio</button>
                    <button class="field-action-btn btn-field-banish" data-instance-id="${card.instanceId}">Remover</button>
                </div>
            `;
        }

        // Attached badge for visual tracking of quantity
        const attachedBadgeHTML = attachedCount > 0 ? `<div class="card-attached-badge">📎${attachedCount}</div>` : "";

        const cardHTML = `
            <div class="duel-card ${card.faceDown ? 'face-down' : ''} ${card.tapped ? 'tapped' : ''}"
                 id="${card.instanceId}"
                 data-instance-id="${card.instanceId}"
                 style="--tilt: ${card.tiltAngle || 0}deg;">
                <div class="card-img-wrapper">
                    <img src="${card.imageUrl}" alt="${card.name}">
                </div>
                ${card.counters > 0 ? `<div class="card-counter">${card.counters}</div>` : ""}
                ${attachedBadgeHTML}
                ${handActionOverlayHTML}
                ${fieldActionOverlayHTML}
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
                // Position card exactly at its coordinates, but make sure it falls back to zone coordinates if not initialized
                let finalX = card.x;
                let finalY = card.y;
                if (finalX === undefined || finalX === null || finalX === 0) {
                    const zoneObj = BOARD_LAYOUTS[state.layout].find(z => z.id === card.zone);
                    if (zoneObj) {
                        finalX = zoneObj.x;
                        finalY = zoneObj.y;
                        card.x = finalX;
                        card.y = finalY;
                    }
                }
                $(`#${card.instanceId}`).css({
                    left: `${finalX}px`,
                    top: `${finalY}px`
                });
            }
        } else {
            // Render freely on playmat
            $("#field-cards-container").append(cardHTML);

            // Determine position - render EXACTLY at card.x and card.y without snaps
            let finalX = card.x;
            let finalY = card.y;

            // Fallback to zone if coordinates are missing/uninitialized
            if (finalX === undefined || finalX === null) {
                const zoneObj = BOARD_LAYOUTS[state.layout].find(z => z.id === card.zone);
                if (zoneObj) {
                    finalX = zoneObj.x;
                    finalY = zoneObj.y;
                    card.x = finalX;
                    card.y = finalY;
                }
            }

            $(`#${card.instanceId}`).css({
                left: `${finalX}px`,
                top: `${finalY}px`
            });

            // RENDER ATTACHED CARDS UNDER THIS PARENT CARD AS A SLIGHT CASCADE
            const attachedCards = state.cards.filter(c => c.attachedTo === card.instanceId);
            attachedCards.sort((a, b) => {
                const aExtra = a.isExtra ? 1 : 0;
                const bExtra = b.isExtra ? 1 : 0;
                if (aExtra !== bExtra) {
                    return bExtra - aExtra; // 1 (Extra Deck) comes before 0 (Normal)
                }
                const aTime = a.attachedAt || 0;
                const bTime = b.attachedAt || 0;
                return bTime - aTime;
            });

            let cumulativeOffset = 0;
            attachedCards.forEach(childCard => {
                cumulativeOffset += 14; // cascade offset
                const childZ = card.z - cumulativeOffset; // below parent

                const childCardHTML = `
                    <div class="duel-card attached-card-cascade ${childCard.faceDown ? 'face-down' : ''} ${childCard.tapped ? 'tapped' : ''}"
                         id="${childCard.instanceId}"
                         data-instance-id="${childCard.instanceId}"
                         data-parent-id="${card.instanceId}"
                         style="left: ${finalX + cumulativeOffset}px; top: ${finalY + cumulativeOffset}px; z-index: ${childZ}; --tilt: ${childCard.tiltAngle || 0}deg;">
                        <div class="card-img-wrapper">
                            <img src="${childCard.imageUrl}" alt="${childCard.name}">
                        </div>
                    </div>
                `;
                $("#field-cards-container").append(childCardHTML);
            });
        }
    });

    // Update pile count labels on the playmat UI
    BOARD_LAYOUTS[state.layout].forEach(zone => {
        const count = zoneCounts[zone.id] || 0;
        $(`#count-${zone.id}`).text(count);

        // Update floating counters
        const $floatCount = $(`#floating-count-${zone.id}`);
        if ($floatCount.length) {
            $floatCount.text(count);
            if (count === 0) {
                $floatCount.css("opacity", "0.4");
            } else {
                $floatCount.css("opacity", "1");
            }
        }
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

    // Event handlers for Hand Quick Actions
    $(".hand-action-btn").off("click").on("click", function(e) {
        e.preventDefault();
        e.stopPropagation();

        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (!cardObj) return;

        const playerSuffix = cardObj.owner === "player1" ? 1 : 2;

        if ($(this).hasClass("btn-summon")) {
            startGraphicalTargeting(cardObj, "summon");
        } else if ($(this).hasClass("btn-set")) {
            startGraphicalTargeting(cardObj, "set");
        } else if ($(this).hasClass("btn-attach")) {
            // Start Attachment Targeting mode
            startAttachmentTargeting(cardObj);
        } else if ($(this).hasClass("btn-activate")) {
            // Pokémon "Activar" action path: drops card straight face-up next to the discard pile (grave)
            cardObj.zone = "field_free";
            cardObj.faceDown = false;
            cardObj.tapped = false;
            if (playerSuffix === 1) {
                cardObj.x = 870;
                cardObj.y = 320;
            } else {
                cardObj.x = 170;
                cardObj.y = 160;
            }
            renderAllCards();

            // Trigger activation glow flash
            setTimeout(() => {
                const $cardElem = $(`#${cardObj.instanceId}`);
                $cardElem.addClass("activating-flash");
                setTimeout(() => {
                    $cardElem.removeClass("activating-flash");
                }, 800);
            }, 100);

            Swal.fire({
                icon: 'success',
                title: 'Efecto Activado',
                text: `${cardObj.name} ha sido colocada en el campo de activación.`,
                toast: true,
                position: 'top-end',
                timer: 2000,
                showConfirmButton: false
            });
        } else if ($(this).hasClass("btn-pokemon-field")) {
            // Pokémon "Field" Stadium card action: places the card between active and prize cards
            cardObj.zone = "field_free";
            cardObj.faceDown = false;
            cardObj.tapped = false;
            if (playerSuffix === 1) {
                // Symmetrical slot on Player 1 between Active (x:590, y:320) and Prizes (x:50-210, y:320-450) -> e.g. x: 310, y: 320
                cardObj.x = 310;
                cardObj.y = 320;
            } else {
                // Symmetrical slot on Player 2 between Active (x:590, y:160) and Prizes (x:830-990, y:30-160) -> e.g. x: 730, y: 160
                cardObj.x = 730;
                cardObj.y = 160;
            }
            renderAllCards();

            setTimeout(() => {
                const $cardElem = $(`#${cardObj.instanceId}`);
                $cardElem.addClass("activating-flash");
                setTimeout(() => {
                    $cardElem.removeClass("activating-flash");
                }, 800);
            }, 100);

            Swal.fire({
                icon: 'success',
                title: 'Estadio Activado',
                text: `${cardObj.name} colocada como Estadio (Field).`,
                toast: true,
                position: 'top-end',
                timer: 2000,
                showConfirmButton: false
            });
        } else if ($(this).hasClass("btn-grave")) {
            setCardZoneWithCrookedOffset(cardObj, `grave_${playerSuffix}`);
            cardObj.faceDown = false;
            cardObj.tapped = false;
            renderAllCards();
        } else if ($(this).hasClass("btn-deck")) {
            setCardZoneWithCrookedOffset(cardObj, `deck_${playerSuffix}`);
            cardObj.faceDown = true;
            cardObj.tapped = false;
            renderAllCards();
        } else if ($(this).hasClass("btn-banish")) {
            setCardZoneWithCrookedOffset(cardObj, `banished_${playerSuffix}`);
            cardObj.faceDown = false;
            cardObj.tapped = false;
            renderAllCards();
        }
    });

    // Event handlers for Field Quick Actions (Overlays)
    $(".field-action-btn").off("click").on("click", function(e) {
        e.preventDefault();
        e.stopPropagation();

        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (!cardObj) return;

        const playerSuffix = cardObj.owner === "player1" ? 1 : 2;

        if ($(this).hasClass("btn-field-flip")) {
            cardObj.faceDown = !cardObj.faceDown;
            renderAllCards();
        } else if ($(this).hasClass("btn-field-tap")) {
            cardObj.tapped = !cardObj.tapped;
            renderAllCards();
        } else if ($(this).hasClass("btn-field-attach")) {
            startAttachmentTargeting(cardObj);
        } else if ($(this).hasClass("btn-field-flash")) {
            // Trigger beautiful temporary activation glow animation
            const $cardElem = $(`#${cardObj.instanceId}`);
            $cardElem.addClass("activating-flash");
            setTimeout(() => {
                $cardElem.removeClass("activating-flash");
            }, 800);
        } else if ($(this).hasClass("btn-field-return")) {
            detachAllChildren(cardObj.instanceId);
            if (cardObj.isExtra) {
                // Return to Extra Deck face-down
                const playerSuffix = cardObj.owner === "player1" ? 1 : 2;
                setCardZoneWithCrookedOffset(cardObj, `extra_${playerSuffix}`);
                cardObj.faceDown = true;
                cardObj.tapped = false;
            } else {
                cardObj.zone = cardObj.owner === "player1" ? "hand_1" : "hand_2";
            }
            cardObj.attachedTo = null; // detach on return
            renderAllCards();
        } else if ($(this).hasClass("btn-field-grave")) {
            detachAllChildren(cardObj.instanceId);
            setCardZoneWithCrookedOffset(cardObj, `grave_${playerSuffix}`);
            cardObj.faceDown = false;
            cardObj.tapped = false;
            cardObj.attachedTo = null; // detach on discard
            renderAllCards();
        } else if ($(this).hasClass("btn-field-banish")) {
            detachAllChildren(cardObj.instanceId);
            setCardZoneWithCrookedOffset(cardObj, `banished_${playerSuffix}`);
            cardObj.faceDown = false;
            cardObj.tapped = false;
            cardObj.attachedTo = null; // detach on banish
            renderAllCards();
        }
    });

    // Click / Contextmenu on attached card cascade to open the Attached Cards Modal
    $(".attached-card-cascade").off("click contextmenu").on("click contextmenu", function(e) {
        e.preventDefault();
        e.stopPropagation();
        const parentId = $(this).data("parent-id");
        openAttachedCardsModal(parentId);
    });

    cards.off('mousedown touchstart').on('mousedown touchstart', function(e) {
        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (!cardObj) return;

        // Prevent dragging deck cards or attached cards
        if (cardObj.zone.startsWith("deck_") || cardObj.attachedTo) {
            return;
        }

        // Prevent standard scrolling on touch, but preserve click capability
        if (e.type === 'touchstart') {
            e.preventDefault();
        }
        e.stopPropagation();

        // Capture starting positions as pending (do not alter layout/DOM until threshold is crossed)
        dragCardPending = $(this);
        dragActive = false;

        const pos = getEventCoords(e);
        dragStartCoords = { x: pos.x, y: pos.y };
        dragStartTime = Date.now();

        // Visual preview selection
        updatePreview(cardObj);
    });
}

// Helper to resolve client touch vs mouse coords
function getEventCoords(e) {
    const oe = e.originalEvent || e;
    if (e.type && e.type.startsWith('touch')) {
        const t = (oe.touches && oe.touches[0]) || (oe.changedTouches && oe.changedTouches[0]);
        if (t) {
            return { x: t.clientX, y: t.clientY };
        }
    }
    if (oe.touches && oe.touches.length) {
        return { x: oe.touches[0].clientX, y: oe.touches[0].clientY };
    }
    if (oe.changedTouches && oe.changedTouches.length) {
        return { x: oe.changedTouches[0].clientX, y: oe.changedTouches[0].clientY };
    }
    return { x: e.clientX || oe.clientX || 0, y: e.clientY || oe.clientY || 0 };
}

// Global window event listeners for active drag tracking
$(window).on('mousemove touchmove', function(e) {
    if (!dragCardPending) return;

    const instId = dragCardPending.data("instance-id");
    const cardObj = state.cards.find(c => c.instanceId === instId);
    if (!cardObj) return;

    const pos = getEventCoords(e);

    // Calculate mouse displacement (delta) since starting the drag
    const dx = pos.x - dragStartCoords.x;
    const dy = pos.y - dragStartCoords.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // If drag is not active yet, and we exceed threshold (8px)
    if (!dragActive && dist > 8) {
        dragActive = true;
        dragCard = dragCardPending;
        dragCard.addClass("dragging").removeClass("snapping");

        // Bring to front physically on screen
        const maxZ = state.cards.length > 0 ? Math.max(...state.cards.map(c => c.z)) : 10;
        cardObj.z = maxZ + 1;
        dragCard.css("z-index", cardObj.z);

        // Get the card's screen coordinates and translate them relative to #playmat
        const cardOffset = dragCard.offset();
        const matOffset = $("#playmat").offset();
        const initialX = cardOffset.left - matOffset.left;
        const initialY = cardOffset.top - matOffset.top;

        // Decouple immediately from Hand Tray flexbox or any other parent and append to playmat container
        $("#field-cards-container").append(dragCard);

        dragStartCardPos = {
            left: initialX,
            top: initialY
        };

        dragCard.css({
            position: 'absolute',
            left: `${initialX}px`,
            top: `${initialY}px`
        });
    }

    if (dragActive && dragCard) {
        // Direct movement rendering
        const newLeft = dragStartCardPos.left + dx;
        const newTop = dragStartCardPos.top + dy;

        dragCard.css({
            left: `${newLeft}px`,
            top: `${newTop}px`
        });

        // Translate coordinates relative to the playmat board to detect collision highlights
        const cardOffset = dragCard.offset();
        const matOffset = $("#playmat").offset();
        const relativeX = cardOffset.left - matOffset.left;
        const relativeY = cardOffset.top - matOffset.top;

        // Check collision highlights against zones underneath the dragged card
        const centerCoords = {
            x: relativeX + 40,
            y: relativeY + 58
        };

        $(".board-zone").removeClass("highlighted");
        const overlappingZone = findOverlappingZone(centerCoords);
        if (overlappingZone) {
            $(`#zone-${overlappingZone.id}`).addClass("highlighted");
        }
    }
});

$(window).on('mouseup touchend', function(e) {
    if (!dragCardPending) return;

    const instId = dragCardPending.data("instance-id");
    const cardObj = state.cards.find(c => c.instanceId === instId);
    if (!cardObj) {
        dragCard = null;
        dragCardPending = null;
        dragActive = false;
        return;
    }

    if (dragActive && dragCard) {
        dragCard.removeClass("dragging").addClass("snapping");
        $(".board-zone").removeClass("highlighted");

        // Calculate real playmat relative position on release
        const cardOffset = dragCard.offset();
        const matOffset = $("#playmat").offset();
        const relativeX = cardOffset.left - matOffset.left;
        const relativeY = cardOffset.top - matOffset.top;

        // Center point of dropped card relative to playmat
        const centerCoords = {
            x: relativeX + 40,
            y: relativeY + 58
        };

        // Determine target dropping destination (Zone, Hand tray, or Free Board float)
        const hoverZone = findOverlappingZone(centerCoords);
        const isOverP1Hand = checkHandTrayHover(e, "#hand-tray-p1");
        const isOverP2Hand = checkHandTrayHover(e, "#hand-tray-p2");

        if (isOverP1Hand) {
            // Return/move to Player 1 hand
            cardObj.zone = "hand_1";
            cardObj.controller = "player1";
            cardObj.attachedTo = null;
        } else if (isOverP2Hand) {
            // Return/move to Player 2 hand
            cardObj.zone = "hand_2";
            cardObj.controller = "player2";
            cardObj.attachedTo = null;
        } else if (hoverZone) {
            // Drop card inside target zone and preserve exactly where the user drops it!
            cardObj.zone = hoverZone.id;
            cardObj.x = relativeX;
            cardObj.y = relativeY;
            cardObj.attachedTo = null; // Detach if dragged to a fresh board zone
        } else {
            // Check if dropped directly on top of another field card to attach it!
            const droppedOnCard = findOverlappingCard(centerCoords, cardObj.instanceId);
            if (droppedOnCard) {
                cardObj.attachedTo = droppedOnCard.instanceId;
                cardObj.attachedAt = Date.now() + Math.random(); // tracking timestamp
                cardObj.zone = droppedOnCard.zone;

                Swal.fire({
                    icon: 'success',
                    title: 'Carta Acoplada',
                    text: `${cardObj.name} ha sido acoplada a ${droppedOnCard.name}.`,
                    toast: true,
                    position: 'top-end',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                // Card was dropped freely on field
                cardObj.zone = "field_free";
                cardObj.x = relativeX;
                cardObj.y = relativeY;
                cardObj.attachedTo = null; // Detach if dragged freely to the board background
            }
        }
    } else {
        // This is a click!
        // Toggle tilt on cardObj if it's on the field (not in hand, deck, extra, grave, banished)
        const isField = !cardObj.zone.startsWith("hand_") && !cardObj.zone.startsWith("deck_") && !cardObj.zone.startsWith("extra_") && !cardObj.zone.startsWith("grave_") && !cardObj.zone.startsWith("banished_");
        if (isField) {
            if (cardObj.tiltAngle && cardObj.tiltAngle !== 0) {
                cardObj.tiltAngle = 0;
            } else {
                // Set a small random angle between -8 and 8 (excluding -2 to 2)
                const sign = Math.random() < 0.5 ? -1 : 1;
                const angle = sign * (4 + Math.random() * 5); // 4 to 9 degrees
                cardObj.tiltAngle = Math.round(angle);
            }
        }
    }

    dragCard = null;
    dragCardPending = null;
    dragActive = false;
    renderAllCards();
});

// Helper to find parent cards under coordinate
function findOverlappingCard(coords, excludeInstanceId) {
    // Only search active field/mat parent cards (no hand, no decks, no discarded)
    const candidates = state.cards.filter(c =>
        c.instanceId !== excludeInstanceId &&
        !c.attachedTo &&
        !c.zone.startsWith("hand_") &&
        !c.zone.startsWith("deck_") &&
        !c.zone.startsWith("extra_") &&
        !c.zone.startsWith("grave_") &&
        !c.zone.startsWith("banished_") &&
        !c.zone.startsWith("prize_")
    );

    for (let i = candidates.length - 1; i >= 0; i--) {
        const c = candidates[i];
        const $elem = $(`#${c.instanceId}`);
        if ($elem.length) {
            const offset = $elem.offset();
            const matOffset = $("#playmat").offset();
            const x = offset.left - matOffset.left;
            const y = offset.top - matOffset.top;

            if (coords.x >= x && coords.x <= x + 80 &&
                coords.y >= y && coords.y <= y + 116) {
                return c;
            }
        }
    }
    return null;
}

// Collision handler against zones
function findOverlappingZone(coords) {
    const zones = BOARD_LAYOUTS[state.layout];
    for (let i = 0; i < zones.length; i++) {
        const z = zones[i];
        // simple box overlaps adjusted for the new larger card size (80x116px)
        const width = 80;
        const height = 116;
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
// SECURE ANTI-CHEAT preview system: masks details of face-down cards and deck piles
function updatePreview(card) {
    const isPile = card.zone.startsWith("deck_") || card.zone.startsWith("extra_") || card.zone.startsWith("prize_");
    let isFaceDown = card.faceDown && !card.zone.startsWith("hand_");

    // Seteadas de mi lado (player1) en el campo se pueden ver en el preview
    if (isFaceDown && card.owner === "player1" && !isPile) {
        isFaceDown = false;
    }

    if (isPile || isFaceDown) {
        const backImg = state.layout === "yugioh" ? "img/bocabajo.jpg" : "img/pokeBocaAbajo.jpg";
        $("#detail-card-img").attr("src", backImg);
        $("#detail-card-name").text("Carta Boca Abajo");
        $("#detail-card-desc").text(`Propietario: ${card.owner === "player1" ? "Jugador 1" : "Jugador 2"}\nZona: ${card.zone.toUpperCase()}\nEstado: Boca Abajo\nContadores: ${card.counters}\n\n[Detalles ocultos para evitar trampas]`);
    } else {
        $("#detail-card-img").attr("src", card.imageUrl);
        $("#detail-card-name").text(card.name);
        $("#detail-card-desc").text(`Propietario: ${card.owner === "player1" ? "Jugador 1" : "Jugador 2"}\nZona: ${card.zone.toUpperCase()}\nEstado: ${card.faceDown ? "Boca Abajo (Revelada para ti)" : "Boca Arriba"}\nContadores: ${card.counters}`);
    }
}

// Shuffle deck piles silently without notification
function shuffleDeckSilent(playerKey) {
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
}

// Shuffle deck piles
function shuffleDeck(playerKey) {
    shuffleDeckSilent(playerKey);
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

// Set up 6 face-down Prize Cards for Pokemon
function setupPokemonPrizes(playerKey) {
    const playerSuffix = playerKey === "player1" ? 1 : 2;
    const deckZone = `deck_${playerSuffix}`;
    const prizePrefix = `prize_${playerSuffix}_`;

    // Filter and sort deck cards descending by z-index (top cards first)
    const deckCards = state.cards
        .filter(c => c.zone === deckZone)
        .sort((a, b) => b.z - a.z);

    if (deckCards.length < 6) {
        Swal.fire({
            icon: 'error',
            title: 'Insuficientes cartas',
            text: `No hay suficientes cartas en el Deck para colocar los 6 Premios.`
        });
        return;
    }

    // Move top 6 cards to prize zones 1 to 6
    for (let i = 0; i < 6; i++) {
        const card = deckCards[i];
        setCardZoneWithCrookedOffset(card, `${prizePrefix}${i + 1}`);
        card.faceDown = true; // Prize cards are always face-down
        card.tapped = false;
    }

    renderAllCards();

    Swal.fire({
        icon: 'success',
        title: 'Premios Colocados',
        text: `Se han colocado 6 cartas de Premio boca abajo.`,
        toast: true,
        position: 'top-end',
        timer: 2000,
        showConfirmButton: false
    });
}

// Draw cards from top deck with stunning flight motion animation
function drawCards(playerKey, count = 1) {
    const deckZone = playerKey === "player1" ? "deck_1" : "deck_2";
    const targetHand = playerKey === "player1" ? "hand_1" : "hand_2";

    // Gather cards currently inside player's deck, sorted by stack depth (z-index)
    const deckCards = state.cards
        .filter(c => c.zone === deckZone)
        .sort((a, b) => b.z - a.z); // top card is largest z-index

    if (deckCards.length === 0) {
        return;
    }

    const drawCount = Math.min(count, deckCards.length);

    // Draw cards one by one
    for (let i = 0; i < drawCount; i++) {
        const card = deckCards[i];

        // Find zone coordinates directly from BOARD_LAYOUTS configuration
        const zoneObj = BOARD_LAYOUTS[state.layout].find(z => z.id === deckZone);
        if (zoneObj) {
            // Hide card during transition and immediately update the deck count label
            card.isDrawing = true;
            card.zone = targetHand;
            renderAllCards();

            // Spawn temporary flying card visual clone relative to #playmat
            const $flying = $('<div class="flying-card card-back"></div>');
            $flying.css({
                top: `${zoneObj.y}px`,
                left: `${zoneObj.x}px`,
                transform: 'scale(1) rotate(0deg)'
            });
            $('#playmat').append($flying);

            // Landing coordinates relative to #playmat
            const targetLeft = 450;
            const targetTop = playerKey === "player1" ? 580 : -100;

            // Trigger transition using requestAnimationFrame to ensure states are evaluated
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    $flying.css({
                        top: `${targetTop}px`,
                        left: `${targetLeft}px`,
                        transform: 'scale(1.1) rotate(360deg)'
                    });
                });
            });

            // After animation ends, remove clone, clear drawing state, and render inside hand tray
            setTimeout(() => {
                $flying.remove();
                card.isDrawing = false;
                card.faceDown = false; // Draw face up
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

// Interactive Extra Deck viewer overlay and Summoning system
function openExtraDeckModal(playerKey) {
    const extraZone = playerKey === "player1" ? "extra_1" : "extra_2";
    const extraCards = state.cards.filter(c => c.zone === extraZone);

    $("#extra-modal-title").text(`Extra Deck: ${playerKey === "player1" ? "P1" : "P2"}`);
    $("#extra-cards-grid").empty();

    if (extraCards.length === 0) {
        $("#extra-cards-grid").append('<p style="color: #999; grid-column: 1/-1; text-align: center;">No hay cartas en el Extra Deck.</p>');
    } else {
        extraCards.forEach(card => {
            const cardHTML = `
                <div class="extra-deck-card-container" data-instance-id="${card.instanceId}">
                    <img src="${card.imageUrl}" alt="${card.name}">
                    <div class="extra-deck-card-hover-overlay">
                        <button class="extra-card-action-btn" data-instance-id="${card.instanceId}">Invocar</button>
                    </div>
                </div>
            `;
            $("#extra-cards-grid").append(cardHTML);
        });
    }

    $("#extra-overlay").fadeIn(200).css("display", "flex");

    // Click Invocar button to start targeting mode on the field
    $(".extra-card-action-btn").off("click").on("click", function() {
        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (cardObj) {
            $("#extra-overlay").fadeOut(200);
            startGraphicalTargeting(cardObj, "summon");
        }
    });
}

// Graphical zone selection mechanics
function startGraphicalTargeting(cardObj, actionType) {
    targetingCard = cardObj;
    targetActionType = actionType;

    // Display the guidance overlay
    $("#zone-picker-overlay").fadeIn(200).css("display", "flex");
    $("#playmat").addClass("selecting-zone");

    // Temporarily bind click event strictly to the playmat board to place card EXACTLY where clicked
    $("#playmat").off("click.targeting").on("click.targeting", function(e) {
        e.preventDefault();
        e.stopPropagation();

        const matOffset = $("#playmat").offset();
        // Calculate coordinate of click relative to playmat
        let clickX = e.clientX - matOffset.left;
        let clickY = e.clientY - matOffset.top;

        // Since the card is 80x116px, center the card at the click position
        let finalX = clickX - 40;
        let finalY = clickY - 58;

        // Execute the targeted action!
        if (targetingCard) {
            targetingCard.zone = "field_free"; // Freely placed on playmat background
            targetingCard.x = finalX;
            targetingCard.y = finalY;
            targetingCard.attachedTo = null; // Detach on summon

            if (state.layout === "yugioh") {
                if (targetActionType === "set") {
                    targetingCard.faceDown = true;
                    targetingCard.tapped = true; // Monster set is rotated/defense
                } else if (targetActionType === "defense") {
                    targetingCard.faceDown = false;
                    targetingCard.tapped = true;
                } else {
                    targetingCard.faceDown = false;
                    targetingCard.tapped = false;
                }
            } else {
                // Pokémon placement rules (everything on the playmat is face-up except deck and prizes)
                targetingCard.faceDown = false;
                targetingCard.tapped = false;
            }

            renderAllCards();

            Swal.fire({
                icon: 'success',
                title: 'Carta Colocada',
                text: `${targetingCard.name} colocada en el campo.`,
                toast: true,
                position: 'top-end',
                timer: 2000,
                showConfirmButton: false
            });
        }

        // Cleanup targeting state
        stopGraphicalTargeting();
    });

    // Let user cancel targeting mode by clicking anywhere else or pressing escape
    $(document).off("keydown.targeting").on("keydown.targeting", function(e) {
        if (e.key === "Escape") {
            stopGraphicalTargeting();
        }
    });
}

function stopGraphicalTargeting() {
    targetingCard = null;
    targetActionType = null;
    $("#zone-picker-overlay").fadeOut(150);
    $("#playmat").removeClass("selecting-zone");
    $(".board-zone").off("click.targeting");
    $("#playmat").off("click.targeting");
    $(document).off("keydown.targeting");
}

function detachAllChildren(parentId) {
    state.cards.forEach(c => {
        if (c.attachedTo === parentId) {
            c.attachedTo = null;
            c.zone = "field_free";
        }
    });
}

function moveAllAttachedTo(parentId, targetType) {
    const parent = state.cards.find(c => c.instanceId === parentId);
    if (!parent) return;

    const attached = state.cards.filter(c => c.attachedTo === parentId);
    if (attached.length === 0) return;

    attached.forEach(cardObj => {
        cardObj.attachedTo = null;
        const playerSuffix = cardObj.owner === "player1" ? 1 : 2;

        if (targetType === "hand") {
            cardObj.zone = cardObj.owner === "player1" ? "hand_1" : "hand_2";
            cardObj.faceDown = false;
            cardObj.tapped = false;
        } else if (targetType === "grave") {
            cardObj.zone = `grave_${playerSuffix}`;
            cardObj.faceDown = false;
            cardObj.tapped = false;
        } else if (targetType === "banished") {
            cardObj.zone = `banished_${playerSuffix}`;
            cardObj.faceDown = false;
            cardObj.tapped = false;
        } else if (targetType === "deck") {
            cardObj.zone = `deck_${playerSuffix}`;
            cardObj.faceDown = true;
            cardObj.tapped = false;
        }
    });

    renderAllCards();
    $("#attached-overlay").fadeOut(200);

    Swal.fire({
        icon: 'success',
        title: 'Cartas Enviadas',
        text: `Todas las cartas acopladas han sido enviadas.`,
        toast: true,
        position: 'top-end',
        timer: 2000,
        showConfirmButton: false
    });
}

// Interactive Attached Cards viewer overlay
function openAttachedCardsModal(parentId) {
    const parentCard = state.cards.find(c => c.instanceId === parentId);
    if (!parentCard) return;

    const attachedCards = state.cards.filter(c => c.attachedTo === parentId);
    attachedCards.sort((a, b) => {
        const aExtra = a.isExtra ? 1 : 0;
        const bExtra = b.isExtra ? 1 : 0;
        if (aExtra !== bExtra) {
            return bExtra - aExtra;
        }
        const aTime = a.attachedAt || 0;
        const bTime = b.attachedAt || 0;
        return bTime - aTime;
    });

    $("#attached-modal-title").text(`Cartas Acopladas a: ${parentCard.name}`);
    $("#attached-cards-grid").empty();

    // Store active parentId on the bulk buttons to read on click
    $("#bulk-to-hand").data("parent-id", parentId);
    $("#bulk-to-grave").data("parent-id", parentId);
    $("#bulk-to-banish").data("parent-id", parentId);
    $("#bulk-to-deck").data("parent-id", parentId);

    if (attachedCards.length === 0) {
        $("#attached-cards-grid").append('<p style="color: #999; grid-column: 1/-1; text-align: center;">No hay cartas acopladas.</p>');
        $(".attached-bulk-actions").hide();
    } else {
        $(".attached-bulk-actions").show();
        attachedCards.forEach(card => {
            const cardHTML = `
                <div class="pile-card-container" data-instance-id="${card.instanceId}">
                    <img src="${card.imageUrl}" alt="${card.name}">
                    <div class="pile-card-hover-overlay">
                        <div class="pile-card-menu">
                            <button class="pile-card-action-btn btn-attached-hand" data-instance-id="${card.instanceId}">Mano</button>
                            <button class="pile-card-action-btn btn-attached-grave" data-instance-id="${card.instanceId}">Grave</button>
                            <button class="pile-card-action-btn btn-attached-banish" data-instance-id="${card.instanceId}">Remover</button>
                            <button class="pile-card-action-btn btn-attached-deck" data-instance-id="${card.instanceId}">Deck</button>
                        </div>
                    </div>
                </div>
            `;
            $("#attached-cards-grid").append(cardHTML);
        });
    }

    $("#attached-overlay").fadeIn(200).css("display", "flex");

    // Click events inside results for individual cards
    $("#attached-cards-grid").off("click").on("click", ".pile-card-action-btn", function(e) {
        e.preventDefault();
        e.stopPropagation();

        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (!cardObj) return;

        const playerSuffix = cardObj.owner === "player1" ? 1 : 2;

        cardObj.attachedTo = null; // Detach first!

        if ($(this).hasClass("btn-attached-hand")) {
            cardObj.zone = cardObj.owner === "player1" ? "hand_1" : "hand_2";
            cardObj.faceDown = false;
            cardObj.tapped = false;
        } else if ($(this).hasClass("btn-attached-grave")) {
            setCardZoneWithCrookedOffset(cardObj, `grave_${playerSuffix}`);
            cardObj.faceDown = false;
            cardObj.tapped = false;
        } else if ($(this).hasClass("btn-attached-banish")) {
            setCardZoneWithCrookedOffset(cardObj, `banished_${playerSuffix}`);
            cardObj.faceDown = false;
            cardObj.tapped = false;
        } else if ($(this).hasClass("btn-attached-deck")) {
            setCardZoneWithCrookedOffset(cardObj, `deck_${playerSuffix}`);
            cardObj.faceDown = true;
            cardObj.tapped = false;
        }

        renderAllCards();
        openAttachedCardsModal(parentId); // Refresh
    });
}

// Dynamic Graphical Attachment Targeting Mode
function startAttachmentTargeting(cardObj) {
    attachingCard = cardObj;

    // Display targeting instructions Toast
    $("#zone-picker-overlay").html(`
        <div class="zone-picker-toast" style="background: linear-gradient(135deg, #ffd32d, #ff5e13); box-shadow: 0 10px 30px rgba(255, 94, 19, 0.5);">
            <i class="fas fa-paperclip animate-pulse"></i> Elige una carta en el campo para acoplar esta carta
        </div>
    `).fadeIn(200).css("display", "flex");

    $("#playmat").addClass("selecting-zone");

    // Bind temporary click event exclusively to visible field parent cards
    setTimeout(() => {
        // Prevent clicking the attaching card itself
        $(".duel-card").not(`#${cardObj.instanceId}`).not(".attached-card-cascade").off("click.attach").on("click.attach", function(e) {
            e.preventDefault();
            e.stopPropagation();

            const targetInstId = $(this).data("instance-id");
            const parentCardObj = state.cards.find(c => c.instanceId === targetInstId);

            if (parentCardObj && attachingCard) {
                attachingCard.attachedTo = parentCardObj.instanceId;
                attachingCard.attachedAt = Date.now() + Math.random(); // tracking timestamp
                attachingCard.zone = parentCardObj.zone;
                attachingCard.faceDown = parentCardObj.faceDown;

                renderAllCards();

                Swal.fire({
                    icon: 'success',
                    title: 'Carta Acoplada',
                    text: `${attachingCard.name} acoplada a ${parentCardObj.name}.`,
                    toast: true,
                    position: 'top-end',
                    timer: 2000,
                    showConfirmButton: false
                });
            }

            stopAttachmentTargeting();
        });
    }, 100);

    // Cancel on ESC
    $(document).off("keydown.attach").on("keydown.attach", function(e) {
        if (e.key === "Escape") {
            stopAttachmentTargeting();
        }
    });
}

function stopAttachmentTargeting() {
    attachingCard = null;
    $("#zone-picker-overlay").fadeOut(150).html(`
        <div class="zone-picker-toast">
            <i class="fas fa-bullseye animate-pulse"></i> Selecciona la zona del tablero para colocar la carta
        </div>
    `);
    $("#playmat").removeClass("selecting-zone");
    $(".duel-card").off("click.attach");
    $(document).off("keydown.attach");
}

// Search and extract from deck (UPGRADED WITH COMPREHENSIVE MULTI-ACTIONS)
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
                <div class="pile-card-container" data-instance-id="${card.instanceId}">
                    <img src="${card.imageUrl}" alt="${card.name}">
                    <div class="pile-card-hover-overlay">
                        <div class="pile-card-menu">
                            <button class="pile-card-action-btn btn-search-hand" data-instance-id="${card.instanceId}">Mano</button>
                            <button class="pile-card-action-btn btn-search-summon" data-instance-id="${card.instanceId}">Invocar</button>
                            <button class="pile-card-action-btn btn-search-set" data-instance-id="${card.instanceId}">Set</button>
                                    <button class="pile-card-action-btn btn-search-attach" data-instance-id="${card.instanceId}">Acoplar</button>
                            <button class="pile-card-action-btn btn-search-grave" data-instance-id="${card.instanceId}">Grave</button>
                            <button class="pile-card-action-btn btn-search-banish" data-instance-id="${card.instanceId}">Remover</button>
                        </div>
                    </div>
                </div>
            `;
            $("#search-cards-grid").append(cardHTML);
        });
    }

    $("#search-overlay").fadeIn(200).css("display", "flex");

    // Click events inside results
    $("#search-cards-grid").off("click").on("click", ".pile-card-action-btn", function(e) {
        e.preventDefault();
        e.stopPropagation();

        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (!cardObj) return;

        const pSuffix = cardObj.owner === "player1" ? 1 : 2;

        if ($(this).hasClass("btn-search-hand")) {
            $("#search-overlay").fadeOut(200);
            cardObj.zone = cardObj.owner === "player1" ? "hand_1" : "hand_2";
            cardObj.faceDown = false;
            cardObj.tapped = false;
            renderAllCards();

            // Symmetrical reveal to opponent
            Swal.fire({
                title: '¡Carta Revelada!',
                html: `
                    <p style="margin-bottom: 15px; font-weight: 600;">El jugador ha buscado y añadido esta carta a su mano:</p>
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                        <img src="${cardObj.imageUrl}" style="width: 150px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.5);" />
                        <h3 style="color: #00d2ff; font-family: 'Orbitron', sans-serif; font-size: 1.1rem; margin-top: 5px;">${cardObj.name}</h3>
                    </div>
                `,
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#00d2ff'
            });
        } else if ($(this).hasClass("btn-search-summon")) {
            $("#search-overlay").fadeOut(200);
            startGraphicalTargeting(cardObj, "summon");
        } else if ($(this).hasClass("btn-search-set")) {
            $("#search-overlay").fadeOut(200);
            startGraphicalTargeting(cardObj, "set");
        } else if ($(this).hasClass("btn-search-attach")) {
            $("#search-overlay").fadeOut(200);
            startAttachmentTargeting(cardObj);
        } else if ($(this).hasClass("btn-search-grave")) {
            setCardZoneWithCrookedOffset(cardObj, `grave_${pSuffix}`);
            cardObj.faceDown = false;
            cardObj.tapped = false;
            renderAllCards();
            openSearchModal(playerKey); // refresh
        } else if ($(this).hasClass("btn-search-banish")) {
            setCardZoneWithCrookedOffset(cardObj, `banished_${pSuffix}`);
            cardObj.faceDown = false;
            cardObj.tapped = false;
            renderAllCards();
            openSearchModal(playerKey); // refresh
        }
    });
}

// Open Graveyard or Banished Pile Modal Viewer
function openPileModal(playerKey, pileType) {
    const playerSuffix = playerKey === "player1" ? 1 : 2;
    const zoneId = `${pileType}_${playerSuffix}`;
    const pileCards = state.cards.filter(c => c.zone === zoneId);

    // Dynamic titles depending on pileType and layout
    let title = "";
    if (pileType === "grave") {
        title = state.layout === "yugioh" ? "Cementerio" : "Descarte";
    } else {
        title = state.layout === "yugioh" ? "Desterrado" : "Mano de Premios / Removido";
    }

    $("#pile-modal-title").text(`${title} (${playerKey === "player1" ? "P1" : "P2"})`);
    $("#pile-cards-grid").empty();

    if (pileCards.length === 0) {
        $("#pile-cards-grid").append('<p style="color: #999; grid-column: 1/-1; text-align: center;">No hay cartas aquí.</p>');
    } else {
        pileCards.forEach(card => {
            const cardHTML = `
                <div class="pile-card-container" data-instance-id="${card.instanceId}">
                    <img src="${card.imageUrl}" alt="${card.name}">
                    <div class="pile-card-hover-overlay">
                        <div class="pile-card-menu">
                            <button class="pile-card-action-btn btn-pile-summon" data-instance-id="${card.instanceId}">Invocar</button>
                            <button class="pile-card-action-btn btn-pile-set" data-instance-id="${card.instanceId}">Set</button>
                            <button class="pile-card-action-btn btn-pile-attach" data-instance-id="${card.instanceId}">Acoplar</button>
                            <button class="pile-card-action-btn btn-pile-hand" data-instance-id="${card.instanceId}">Mano</button>
                            <button class="pile-card-action-btn btn-pile-deck" data-instance-id="${card.instanceId}">Deck</button>
                            ${pileType === 'grave' ?
                                `<button class="pile-card-action-btn btn-pile-banish" data-instance-id="${card.instanceId}">Remover</button>` :
                                `<button class="pile-card-action-btn btn-pile-grave" data-instance-id="${card.instanceId}">Cementerio</button>`
                            }
                        </div>
                    </div>
                </div>
            `;
            $("#pile-cards-grid").append(cardHTML);
        });
    }

    $("#pile-overlay").fadeIn(200).css("display", "flex");

    // Click events inside results
    $("#pile-cards-grid").off("click").on("click", ".pile-card-action-btn", function(e) {
        e.preventDefault();
        e.stopPropagation();

        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (!cardObj) return;

        const pSuffix = cardObj.owner === "player1" ? 1 : 2;

        if ($(this).hasClass("btn-pile-summon")) {
            $("#pile-overlay").fadeOut(200);
            startGraphicalTargeting(cardObj, "summon");
        } else if ($(this).hasClass("btn-pile-set")) {
            $("#pile-overlay").fadeOut(200);
            startGraphicalTargeting(cardObj, "set");
        } else if ($(this).hasClass("btn-pile-attach")) {
            $("#pile-overlay").fadeOut(200);
            startAttachmentTargeting(cardObj);
        } else if ($(this).hasClass("btn-pile-hand")) {
            cardObj.zone = cardObj.owner === "player1" ? "hand_1" : "hand_2";
            cardObj.faceDown = false;
            cardObj.tapped = false;
            renderAllCards();
            openPileModal(playerKey, pileType); // refresh view
        } else if ($(this).hasClass("btn-pile-deck")) {
            setCardZoneWithCrookedOffset(cardObj, `deck_${pSuffix}`);
            cardObj.faceDown = true;
            cardObj.tapped = false;
            renderAllCards();
            openPileModal(playerKey, pileType); // refresh view
        } else if ($(this).hasClass("btn-pile-banish")) {
            setCardZoneWithCrookedOffset(cardObj, `banished_${pSuffix}`);
            cardObj.faceDown = false;
            cardObj.tapped = false;
            renderAllCards();
            openPileModal(playerKey, pileType); // refresh view
        } else if ($(this).hasClass("btn-pile-grave")) {
            setCardZoneWithCrookedOffset(cardObj, `grave_${pSuffix}`);
            cardObj.faceDown = false;
            cardObj.tapped = false;
            renderAllCards();
            openPileModal(playerKey, pileType); // refresh view
        }
    });
}

function setupEventListeners() {
    // Menu layout toggle
    $("#select-board-layout").change(async function() {
        state.layout = $(this).val();
        state.cards = [];
        await checkUserSessionAndPreload();
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
        // If targeting mode is active, do not interrupt
        if ($("#playmat").hasClass("selecting-zone")) return;

        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (!cardObj) return;

        // If card is inside a deck zone, open the deck menu instead of card menu
        if (cardObj.zone.startsWith("deck_")) {
            e.preventDefault();
            e.stopPropagation();
            activeMenuDeckPlayer = cardObj.zone === "deck_1" ? "player1" : "player2";
            $("#card-menu").removeClass("active");
            $("#deck-menu").css({
                left: `${e.clientX}px`,
                top: `${e.clientY}px`
            }).addClass("active");
            return;
        }

        // If card is inside an extra deck zone, open the Extra Deck overlay instead
        if (cardObj.zone.startsWith("extra_")) {
            e.preventDefault();
            e.stopPropagation();
            const playerKey = cardObj.zone === "extra_1" ? "player1" : "player2";
            openExtraDeckModal(playerKey);
            return;
        }

        // If card is inside a graveyard zone, open the Graveyard Pile modal viewer instead
        if (cardObj.zone.startsWith("grave_")) {
            e.preventDefault();
            e.stopPropagation();
            const playerKey = cardObj.zone === "grave_1" ? "player1" : "player2";
            openPileModal(playerKey, "grave");
            return;
        }

        // If card is inside a banished zone, open the Banished Pile modal viewer instead
        if (cardObj.zone.startsWith("banished_")) {
            e.preventDefault();
            e.stopPropagation();
            const playerKey = cardObj.zone === "banished_1" ? "player1" : "player2";
            openPileModal(playerKey, "banished");
            return;
        }

        e.preventDefault();
        e.stopPropagation();
        activeMenuCard = cardObj;
        $("#deck-menu").removeClass("active");
        $("#card-menu").css({
            left: `${e.clientX}px`,
            top: `${e.clientY}px`
        }).addClass("active");
    });

    // Handle left click directly on a deck, extra deck, grave, or banished card to toggle correct overlays/menus
    $(document).on("click", ".duel-card", function(e) {
        if ($("#playmat").hasClass("selecting-zone")) return;

        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (!cardObj) return;

        if (cardObj.zone.startsWith("deck_")) {
            e.preventDefault();
            e.stopPropagation();
            activeMenuDeckPlayer = cardObj.zone === "deck_1" ? "player1" : "player2";
            $("#card-menu").removeClass("active");
            $("#deck-menu").css({
                left: `${e.clientX}px`,
                top: `${e.clientY}px`
            }).addClass("active");
        } else if (cardObj.zone.startsWith("extra_")) {
            e.preventDefault();
            e.stopPropagation();
            const playerKey = cardObj.zone === "extra_1" ? "player1" : "player2";
            openExtraDeckModal(playerKey);
        } else if (cardObj.zone.startsWith("grave_")) {
            e.preventDefault();
            e.stopPropagation();
            const playerKey = cardObj.zone === "grave_1" ? "player1" : "player2";
            openPileModal(playerKey, "grave");
        } else if (cardObj.zone.startsWith("banished_")) {
            e.preventDefault();
            e.stopPropagation();
            const playerKey = cardObj.zone === "banished_1" ? "player1" : "player2";
            openPileModal(playerKey, "banished");
        }
    });

    // Left or Right click context menu on Deck Zone elements
    $(document).on("click contextmenu", ".board-zone.zone-type-deck", function(e) {
        if ($("#playmat").hasClass("selecting-zone")) return;
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

    // Left or Right click context menu on Extra Deck Zone elements
    $(document).on("click contextmenu", ".board-zone.zone-type-extra", function(e) {
        if ($("#playmat").hasClass("selecting-zone")) return;
        e.preventDefault();
        e.stopPropagation();

        const zoneId = $(this).data("id");
        const playerKey = zoneId === "zone-extra_1" || zoneId === "extra_1" ? "player1" : "player2";
        openExtraDeckModal(playerKey);
    });

    // Left or Right click context menu on Graveyard Zone elements
    $(document).on("click contextmenu", ".board-zone.zone-type-grave", function(e) {
        if ($("#playmat").hasClass("selecting-zone")) return;
        e.preventDefault();
        e.stopPropagation();

        const zoneId = $(this).data("id");
        const playerKey = zoneId === "zone-grave_1" || zoneId === "grave_1" ? "player1" : "player2";
        openPileModal(playerKey, "grave");
    });

    // Left or Right click context menu on Banished Zone elements
    $(document).on("click contextmenu", ".board-zone.zone-type-banished", function(e) {
        if ($("#playmat").hasClass("selecting-zone")) return;
        e.preventDefault();
        e.stopPropagation();

        const zoneId = $(this).data("id");
        const playerKey = zoneId === "zone-banished_1" || zoneId === "banished_1" ? "player1" : "player2";
        openPileModal(playerKey, "banished");
    });

    // Hide context menus on global left click
    $(document).on("click", function() {
        $("#card-menu").removeClass("active");
        $("#deck-menu").removeClass("active");
    });

    // Context Menu Detach handler
    $("#card-menu").append(`
        <div class="menu-item" id="menu-detach"><i class="fas fa-paperclip"></i> Desacoplar todo</div>
    `);

    $(document).on("click", "#menu-detach", function() {
        if (!activeMenuCard) return;
        let count = 0;
        state.cards.forEach(c => {
            if (c.attachedTo === activeMenuCard.instanceId) {
                c.attachedTo = null;
                c.zone = "field_free";
                count++;
            }
        });
        if (count > 0) {
            renderAllCards();
            Swal.fire({
                icon: 'info',
                title: 'Cartas Desacopladas',
                text: `Se han desacoplado ${count} cartas de ${activeMenuCard.name}.`,
                toast: true,
                position: 'top-end',
                timer: 2000,
                showConfirmButton: false
            });
        }
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
        detachAllChildren(activeMenuCard.instanceId);
        activeMenuCard.zone = activeMenuCard.owner === "player1" ? "hand_1" : "hand_2";
        renderAllCards();
    });

    $("#menu-to-grave").click(function() {
        if (!activeMenuCard) return;
        detachAllChildren(activeMenuCard.instanceId);
        setCardZoneWithCrookedOffset(activeMenuCard, activeMenuCard.owner === "player1" ? "grave_1" : "grave_2");
        activeMenuCard.faceDown = false; // face up in grave
        activeMenuCard.tapped = false;
        renderAllCards();
    });

    $("#menu-to-deck-top").click(function() {
        if (!activeMenuCard) return;
        detachAllChildren(activeMenuCard.instanceId);
        const targetZone = activeMenuCard.owner === "player1" ? "deck_1" : "deck_2";
        setCardZoneWithCrookedOffset(activeMenuCard, targetZone);
        activeMenuCard.faceDown = true;
        activeMenuCard.tapped = false;

        const zoneCards = state.cards.filter(c => c.zone === targetZone);
        const maxZ = zoneCards.length > 0 ? Math.max(...zoneCards.map(c => c.z)) : 1;
        activeMenuCard.z = maxZ + 1;

        renderAllCards();
    });

    $("#menu-to-deck-bottom").click(function() {
        if (!activeMenuCard) return;
        detachAllChildren(activeMenuCard.instanceId);
        const targetZone = activeMenuCard.owner === "player1" ? "deck_1" : "deck_2";
        setCardZoneWithCrookedOffset(activeMenuCard, targetZone);
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

    $("#deck-menu-prizes").click(function() {
        if (activeMenuDeckPlayer) {
            setupPokemonPrizes(activeMenuDeckPlayer);
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

    // Extra Deck Close
    $("#btn-close-extra").click(function() {
        $("#extra-overlay").fadeOut(200);
    });

    // Pile View Close
    $("#btn-close-pile").click(function() {
        $("#pile-overlay").fadeOut(200);
    });

    // Attached Cards Modal Close
    $("#btn-close-attached").click(function() {
        $("#attached-overlay").fadeOut(200);
    });

    // Bulk Attached Card Operations
    $("#bulk-to-hand").click(function() {
        const parentId = $(this).data("parent-id");
        moveAllAttachedTo(parentId, "hand");
    });
    $("#bulk-to-grave").click(function() {
        const parentId = $(this).data("parent-id");
        moveAllAttachedTo(parentId, "grave");
    });
    $("#bulk-to-banish").click(function() {
        const parentId = $(this).data("parent-id");
        moveAllAttachedTo(parentId, "banished");
    });
    $("#bulk-to-deck").click(function() {
        const parentId = $(this).data("parent-id");
        moveAllAttachedTo(parentId, "deck");
    });
}
