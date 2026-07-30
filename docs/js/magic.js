// Magic Mode: Free Sandbox Duel Engine
// 100% Free-form positioning, dragging, attaching, and local gameplay testing.

const HIGH_FIDELITY_MOCKS = [
    // Yu-Gi-Oh! Mock Cards
    { name: "Dragón Blanco de Ojos Azules", image_url: "https://images.ygoprodeck.com/images/cards/89631139.jpg", section: "Main", desc: "Este legendario dragón es una poderosa máquina de destrucción. Prácticamente invencible, muy pocos se han enfrentado a esta magnífica criatura y han vivido para contarlo." },
    { name: "Mago Oscuro", image_url: "https://images.ygoprodeck.com/images/cards/46986414.jpg", section: "Main", desc: "El más grande de los magos en lo referente al ataque y la defensa." },
    { name: "Chica Maga Oscura", image_url: "https://images.ygoprodeck.com/images/cards/31755083.jpg", section: "Main", desc: "Gana 300 ATK por cada 'Mago Oscuro' o 'Mago de la Ilusión Negra' en los Cementerios." },
    { name: "Dragón Negro de Ojos Rojos", image_url: "https://images.ygoprodeck.com/images/cards/74677422.jpg", section: "Main", desc: "Un dragón feroz con un ataque mortífero." },
    { name: "Olla de la Codicia", image_url: "https://images.ygoprodeck.com/images/cards/55144522.jpg", section: "Main", desc: "Roba 2 cartas de tu Deck." },
    { name: "Fuerza de Espejo", image_url: "https://images.ygoprodeck.com/images/cards/44095762.jpg", section: "Main", desc: "Cuando un monstruo del adversario declara un ataque: destruye todos los monstruos en Posición de Ataque de tu adversario." },
    { name: "Monstruo Renacido", image_url: "https://images.ygoprodeck.com/images/cards/83764718.jpg", section: "Main", desc: "Selecciona 1 monstruo en cualquier Cementerio; Invócalo de Modo Especial." },
    { name: "Tifón del Espacio Místico", image_url: "https://images.ygoprodeck.com/images/cards/05318639.jpg", section: "Main", desc: "Selecciona 1 Carta de Magia/Trampa en el Campo; destrúyela." },
    // Extra Deck
    { name: "Dragón de la Flama de Ojos Rojos", image_url: "https://images.ygoprodeck.com/images/cards/03437179.jpg", section: "Extra", desc: "2 monstruos de Nivel 7. No puede ser destruido por efectos de cartas mientras tenga materiales Xyz." },
    { name: "Mago de la Ilusión Ebon", image_url: "https://images.ygoprodeck.com/images/cards/94380839.jpg", section: "Extra", desc: "2 monstruos de Nivel 7. Puedes desacoplar 1 material de esta carta para Invocar de Modo Especial 1 Monstruo Normal Lanzador de Conjuros desde tu mano o Deck." }
];

const POKE_MOCKS = [
    { name: "Charizard ex", image_url: "https://images.pokemontcg.io/sv3/125_hires.png", section: "Main", desc: "PS 330 - Tipo Fuego. Ataque: Oscuridad Reinante (180+)" },
    { name: "Pikachu", image_url: "https://images.pokemontcg.io/cel25/2_hires.png", section: "Main", desc: "PS 60 - Tipo Rayo. Ataque: Impactrueno (30)" },
    { name: "Investigación de Profesores", image_url: "https://images.pokemontcg.io/swsh1/178_hires.png", section: "Main", desc: "Partidario: Descarta tu mano y roba 7 cartas." },
    { name: "Energía Fuego", image_url: "https://images.pokemontcg.io/sve/2_hires.png", section: "Main", desc: "Energía básica de tipo Fuego." },
    { name: "Energía Rayo", image_url: "https://images.pokemontcg.io/sve/4_hires.png", section: "Main", desc: "Energía básica de tipo Rayo." },
    { name: "Caramelo Raro", image_url: "https://images.pokemontcg.io/sv1/191_hires.png", section: "Main", desc: "Objeto: Evoluciona uno de tus Pokémon." }
];

// Local state configuration
const state = {
    layout: "none", // none, yugioh, pokemon
    cards: [], // Array of card instances { id, name, image_url, x, y, faceUp, tapped, counters: { glass: 0, poke: 0 }, owner: 'player1'/'player2' }
    decks: { player1: [], player2: [] },
    attacks: []
};

let hasPlayer2 = false;
let dragCard = null;
const dragOffset = { x: 0, y: 0 };
let dragStartCoords = { x: 0, y: 0 };
let dragStartTime = 0;
let targetingCard = null;

// Initialize Magic Engine
$(document).ready(async function() {
    const urlParams = new URLSearchParams(window.location.search);
    state.layout = urlParams.get("layout") || "none";
    const deck1Id = urlParams.get("deck1");
    const deck2Id = urlParams.get("deck2");

    hasPlayer2 = (deck2Id && deck2Id !== "none");

    // Apply layout guide visual
    if (state.layout === "yugioh") {
        $("#layout-guide-bg").addClass("yugioh");
    } else if (state.layout === "pokemon") {
        $("#layout-guide-bg").addClass("pokemon");
    }

    // Hide/Show P2 components
    if (hasPlayer2) {
        $("#zone-hand-p2").css("display", "flex");
        $("#zone-grave-p2").css("display", "flex");
        $("#zone-banish-p2").css("display", "flex");
        $("#lp-widget-p2").css("display", "block");
    }

    initializePiles();
    setupAccessories();
    setupLPTrackers();
    setupCardInteractions();
    setupGlobalEvents();

    // Load Decks
    Swal.fire({
        title: 'Cargando Mazos...',
        html: 'Preparando la arena libre sin restricciones.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const defaultMocks = (state.layout === "pokemon") ? POKE_MOCKS : HIGH_FIDELITY_MOCKS;

        // Player 1 Deck load
        if (deck1Id && deck1Id !== "mock") {
            await fetchDeckCards(deck1Id, "player1");
        } else {
            state.decks.player1 = JSON.parse(JSON.stringify(defaultMocks));
            logEvent("Sistema", "Mazo preestablecido cargado para el Jugador 1.");
        }

        // Player 2 Deck load
        if (hasPlayer2) {
            if (deck2Id !== "mock") {
                await fetchDeckCards(deck2Id, "player2");
            } else {
                state.decks.player2 = JSON.parse(JSON.stringify(defaultMocks));
                logEvent("Sistema", "Mazo preestablecido cargado para el Jugador 2.");
            }
        }

        // Shuffle decks on startup
        shuffleDeck("player1");
        if (hasPlayer2) {
            shuffleDeck("player2");
        }

        Swal.close();
        renderAllCards();
        logEvent("Sistema", "¡La Arena Libre Magic está lista! Arrastra cartas a cualquier parte de la pantalla.");

    } catch (err) {
        console.error(err);
        Swal.fire('Error', 'No se pudieron cargar los mazos de la base de datos.', 'error');
    }
});

// Fetch cards from Supabase schema
async function fetchDeckCards(deckId, playerKey) {
    const { data: deckCards, error: deckErr } = await _supabase
        .from('deck_cards')
        .select(`
            id,
            card_slots (
                id,
                name,
                image_url,
                section,
                description
            )
        `)
        .eq('deck_id', deckId);

    if (deckErr) throw deckErr;

    if (!deckCards || deckCards.length === 0) {
        logEvent("Sistema", `El mazo del ${playerKey} está vacío. Cargando cartas de prueba...`);
        const defaultMocks = (state.layout === "pokemon") ? POKE_MOCKS : HIGH_FIDELITY_MOCKS;
        state.decks[playerKey] = JSON.parse(JSON.stringify(defaultMocks));
        return;
    }

    const formatted = deckCards.map(item => {
        const slot = item.card_slots;
        return {
            name: slot.name,
            image_url: slot.image_url || "https://via.placeholder.com/150x218?text=Vikingdev+TCG",
            section: slot.section || "Main",
            desc: slot.description || ""
        };
    });

    state.decks[playerKey] = formatted;
    logEvent("Sistema", `Mazo personalizado (${formatted.length} cartas) cargado para ${playerKey === 'player1' ? 'Jugador 1' : 'Jugador 2'}.`);
}

// Initialize Physical Draggable Pile Sources (Main and Extra Decks only)
function initializePiles() {
    const $container = $("#piles-container");
    $container.empty();

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Deck & Extra coordinates
    const p1_deck_x = 35;
    const p1_deck_y = height - 245;
    const p1_extra_x = 35;
    const p1_extra_y = height - 485;

    const p2_deck_x = width - 185;
    const p2_deck_y = 25;
    const p2_extra_x = width - 185;
    const p2_extra_y = 265;

    // Render P1 Deck
    createPileElement($container, "deck_1", "Main Deck J1", p1_deck_x, p1_deck_y, "player1", "deck");
    // Render P1 Extra
    createPileElement($container, "extra_1", "Extra Deck J1", p1_extra_x, p1_extra_y, "player1", "extra");

    if (hasPlayer2) {
        // Render P2 Deck
        createPileElement($container, "deck_2", "Main Deck J2", p2_deck_x, p2_deck_y, "player2", "deck");
        // Render P2 Extra
        createPileElement($container, "extra_2", "Extra Deck J2", p2_extra_x, p2_extra_y, "player2", "extra");
    }

    updatePileCounts();
}

function createPileElement($parent, id, label, x, y, owner, type) {
    const themeClass = owner === "player1" ? "p1-pile" : "p2-pile";
    const backImg = (state.layout === "pokemon") ? "img/pokeBocaAbajo.jpg" : "img/bocabajo.jpg";

    const html = `
        <div class="magic-pile-zone ${themeClass}" id="zone-${id}" style="left: ${x}px; top: ${y}px;">
            <div class="pile-count-badge" id="count-${id}">0</div>
            <div class="pile-label">${label}</div>
            <button class="pile-menu-trigger" data-pile="${id}"><i class="fas fa-ellipsis-h"></i> Acciones</button>
        </div>
    `;
    $parent.append(html);

    // Make piles draggable
    const $el = $(`#zone-${id}`);
    $el.on("mousedown touchstart", function(e) {
        if ($(e.target).hasClass("pile-menu-trigger")) return;
        e.preventDefault();

        const clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;

        const offset = $el.offset();
        const startX = offset.left;
        const startY = offset.top;

        const deltaX = clientX - startX;
        const deltaY = clientY - startY;

        $(document).on("mousemove.piledrag touchmove.piledrag", function(moveEvent) {
            const mX = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const mY = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientY : moveEvent.clientY;

            let finalX = mX - deltaX;
            let finalY = mY - deltaY;

            // Constrain within viewport bounds
            finalX = Math.max(10, Math.min(window.innerWidth - 160, finalX));
            finalY = Math.max(10, Math.min(window.innerHeight - 230, finalY));

            $el.css({ left: finalX, top: finalY });
        });

        $(document).on("mouseup.piledrag touchend.piledrag", function() {
            $(document).off(".piledrag");
        });
    });
}

// Update counts on visual piles and landing zones
function updatePileCounts() {
    // Deck counts
    const p1Deck = state.decks.player1.filter(c => c.section !== "Extra").length;
    const p1Extra = state.decks.player1.filter(c => c.section === "Extra").length;
    $("#count-deck_1").text(p1Deck);
    $("#count-extra_1").text(p1Extra);

    if (hasPlayer2) {
        const p2Deck = state.decks.player2.filter(c => c.section !== "Extra").length;
        const p2Extra = state.decks.player2.filter(c => c.section === "Extra").length;
        $("#count-deck_2").text(p2Deck);
        $("#count-extra_2").text(p2Extra);
    }

    // Refresh landing zone counts based on absolute cards coordinates
    updateLandingZoneCounts();
}

// Calculate containing zone geometrically
function updateLandingZoneCounts() {
    const counts = {
        hand_p1: 0, grave_p1: 0, banish_p1: 0,
        hand_p2: 0, grave_p2: 0, banish_p2: 0
    };

    state.cards.forEach(card => {
        const zone = getCardCurrentZone(card);
        if (zone) {
            counts[zone]++;
        }
    });

    $("#count-hand-p1").text(counts.hand_p1);
    $("#count-grave-p1").text(counts.grave_p1);
    $("#count-banish-p1").text(counts.banish_p1);

    if (hasPlayer2) {
        $("#count-hand-p2").text(counts.hand_p2);
        $("#count-grave-p2").text(counts.grave_p2);
        $("#count-banish-p2").text(counts.banish_p2);
    }
}

// Fetch bounding boxes dynamically
function getCardCurrentZone(card) {
    const cardMidX = card.x + 75;
    const cardMidY = card.y + 109;

    // Hand P1
    if (isPointInElement(cardMidX, cardMidY, "#zone-hand-p1")) return "hand_p1";
    // Grave P1
    if (isPointInElement(cardMidX, cardMidY, "#zone-grave-p1")) return "grave_p1";
    // Banish P1
    if (isPointInElement(cardMidX, cardMidY, "#zone-banish-p1")) return "banish_p1";

    if (hasPlayer2) {
        if (isPointInElement(cardMidX, cardMidY, "#zone-hand-p2")) return "hand_p2";
        if (isPointInElement(cardMidX, cardMidY, "#zone-grave-p2")) return "grave_p2";
        if (isPointInElement(cardMidX, cardMidY, "#zone-banish-p2")) return "banish_p2";
    }

    return null;
}

function isPointInElement(x, y, selector) {
    const $el = $(selector);
    if (!$el.length || $el.css("display") === "none") return false;

    const offset = $el.offset();
    const w = $el.outerWidth();
    const h = $el.outerHeight();

    return (x >= offset.left && x <= offset.left + w && y >= offset.top && y <= offset.top + h);
}

// Deck Pile operations and context menus
$(document).on("click", ".pile-menu-trigger", function(e) {
    e.stopPropagation();
    const pileId = $(this).attr("data-pile");
    const owner = pileId.endsWith("_1") ? "player1" : "player2";
    const type = pileId.startsWith("deck") ? "deck" : "extra";

    let menuHtml = "";
    if (type === "deck") {
        menuHtml = `
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button class="swal2-confirm swal2-styled pile-action-btn" data-action="draw1" data-owner="${owner}" style="background-color: var(--primary-color); color: #000; margin: 0; font-weight: bold;">Robar 1 Carta</button>
                <button class="swal2-confirm swal2-styled pile-action-btn" data-action="draw5" data-owner="${owner}" style="background-color: var(--primary-color); color: #000; margin: 0; font-weight: bold;">Robar 5 Cartas</button>
                <button class="swal2-confirm swal2-styled pile-action-btn" data-action="shuffle" data-owner="${owner}" style="background-color: #3085d6; margin: 0;">Barajar Todo el Deck</button>
                <button class="swal2-confirm swal2-styled pile-action-btn" data-action="search" data-owner="${owner}" style="background-color: #444; margin: 0;">Buscar en el Deck</button>
            </div>
        `;
    } else {
        menuHtml = `
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button class="swal2-confirm swal2-styled pile-action-btn" data-action="openExtra" data-owner="${owner}" style="background-color: var(--primary-color); color: #000; margin: 0; font-weight: bold;">Ver Extra Deck</button>
            </div>
        `;
    }

    Swal.fire({
        title: type === "deck" ? "Acciones de Deck" : "Acciones de Extra Deck",
        html: menuHtml,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: "Cancelar",
        background: "#12181e",
        color: "#fff"
    });
});

// Delegate Pile SwAl interactions
$(document).on("click", ".pile-action-btn", function() {
    const action = $(this).attr("data-action");
    const owner = $(this).attr("data-owner");
    Swal.close();

    if (action === "draw1") {
        drawCards(owner, 1);
    } else if (action === "draw5") {
        drawCards(owner, 5);
    } else if (action === "shuffle") {
        shuffleDeck(owner);
        Swal.fire('Barajado', 'El mazo se ha barajado con éxito.', 'success');
    } else if (action === "search") {
        openSearchModal(owner);
    } else if (action === "openExtra") {
        openExtraModal(owner);
    }
});

// Shuffling logic
function shuffleDeck(owner) {
    const deck = state.decks[owner];
    // Fisher-Yates
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    updatePileCounts();
    logEvent(owner === "player1" ? "Jugador 1" : "Jugador 2", "Barajó su Main Deck.");
}

// Drawing cards to Hand Zone coordinates
function drawCards(owner, amount) {
    const deck = state.decks[owner];
    const mainCards = deck.filter(c => c.section !== "Extra");

    if (mainCards.length === 0) {
        Swal.fire('Deck Vacío', 'No quedan cartas en el Main Deck para robar.', 'warning');
        return;
    }

    const actualDraw = Math.min(amount, mainCards.length);
    const windowW = window.innerWidth;
    const windowH = window.innerHeight;

    // Coordinates landing within transparent hand borders
    const targetXBase = windowW * 0.15 + 50;
    const targetY = (owner === "player1") ? (windowH - 180) : 40;

    for (let i = 0; i < actualDraw; i++) {
        // Find and remove first main card
        const idx = deck.findIndex(c => c.section !== "Extra");
        const cardData = deck.splice(idx, 1)[0];

        const cardId = "card_" + Math.random().toString(36).substr(2, 9);
        const cardX = targetXBase + (state.cards.filter(c => getCardCurrentZone(c) === (owner === 'player1' ? 'hand_p1' : 'hand_p2')).length * 50);

        state.cards.push({
            id: cardId,
            name: cardData.name,
            image_url: cardData.image_url,
            desc: cardData.desc || "",
            x: cardX,
            y: targetY,
            faceUp: (owner === "player1" || state.layout === "pokemon"), // Pokemon is always faceup in sandbox
            tapped: false,
            counters: { glass: 0, poke: 0 },
            owner: owner,
            section: cardData.section || "Main"
        });
    }

    renderAllCards();
    updatePileCounts();
    logEvent(owner === "player1" ? "Jugador 1" : "Jugador 2", `Robó ${actualDraw} carta(s) a la mano.`);
}

// Search Modal operations
function openSearchModal(owner) {
    const deck = state.decks[owner];
    const mainCards = deck.filter(c => c.section !== "Extra");

    if (mainCards.length === 0) {
        Swal.fire('Mazo Vacío', 'No hay cartas para buscar en el Main Deck.', 'warning');
        return;
    }

    $("#pile-modal-title").text(`Buscador de Deck: ${owner === "player1" ? "Jugador 1" : "Jugador 2"}`);
    const $grid = $("#pile-cards-grid");
    $grid.empty();

    mainCards.forEach((card, index) => {
        const html = `
            <div class="search-card-wrapper" data-index="${index}" data-owner="${owner}">
                <img src="${card.image_url}" alt="${card.name}">
                <div class="search-card-overlay">
                    <button class="search-action-btn search-to-hand" title="Añadir a la mano"><i class="fas fa-hand-holding"></i> Mano</button>
                    <button class="search-action-btn search-to-field" title="Invocar al campo"><i class="fas fa-play"></i> Campo</button>
                </div>
            </div>
        `;
        $grid.append(html);
    });

    // Close on escape/click
    $("#pile-overlay").fadeIn(200);
}

// Extra Modal operations
function openExtraModal(owner) {
    const deck = state.decks[owner];
    const extraCards = deck.filter(c => c.section === "Extra");

    if (extraCards.length === 0) {
        Swal.fire('Extra Deck Vacío', 'No hay cartas en el Extra Deck.', 'warning');
        return;
    }

    $("#extra-modal-title").text(`Extra Deck: ${owner === "player1" ? "Jugador 1" : "Jugador 2"}`);
    const $grid = $("#extra-cards-grid");
    $grid.empty();

    extraCards.forEach((card, index) => {
        const html = `
            <div class="search-card-wrapper" data-index="${index}" data-owner="${owner}">
                <img src="${card.image_url}" alt="${card.name}">
                <div class="search-card-overlay">
                    <button class="search-action-btn extra-to-hand" title="Añadir a la mano"><i class="fas fa-hand-holding"></i> Mano</button>
                    <button class="search-action-btn extra-to-field" title="Invocar al campo"><i class="fas fa-play"></i> Campo</button>
                </div>
            </div>
        `;
        $grid.append(html);
    });

    $("#extra-overlay").fadeIn(200);
}

// Close overlays
$("#btn-close-pile").click(() => $("#pile-overlay").fadeOut(200));
$("#btn-close-extra").click(() => $("#extra-overlay").fadeOut(200));

// Handle modal actions
$(document).on("click", ".search-to-hand, .extra-to-hand", function() {
    const $wrapper = $(this).closest(".search-card-wrapper");
    const idx = parseInt($wrapper.attr("data-index"));
    const owner = $wrapper.attr("data-owner");
    const isExtra = $(this).hasClass("extra-to-hand");

    const deck = state.decks[owner];
    const filtered = deck.filter(c => isExtra ? c.section === "Extra" : c.section !== "Extra");
    const cardData = filtered[idx];

    // Remove from array source
    const exactIdx = deck.indexOf(cardData);
    if (exactIdx > -1) {
        deck.splice(exactIdx, 1);
    }

    // Add to state cards
    const cardId = "card_" + Math.random().toString(36).substr(2, 9);
    const windowW = window.innerWidth;
    const windowH = window.innerHeight;
    const targetX = windowW * 0.15 + 50 + (state.cards.filter(c => getCardCurrentZone(c) === (owner === 'player1' ? 'hand_p1' : 'hand_p2')).length * 50);
    const targetY = (owner === "player1") ? (windowH - 180) : 40;

    state.cards.push({
        id: cardId,
        name: cardData.name,
        image_url: cardData.image_url,
        desc: cardData.desc || "",
        x: targetX,
        y: targetY,
        faceUp: true,
        tapped: false,
        counters: { glass: 0, poke: 0 },
        owner: owner,
        section: cardData.section || "Main"
    });

    $("#pile-overlay").fadeOut(200);
    $("#extra-overlay").fadeOut(200);
    renderAllCards();
    updatePileCounts();
    logEvent(owner === "player1" ? "Jugador 1" : "Jugador 2", `Buscó e introdujo a su mano: ${cardData.name}`);
});

$(document).on("click", ".search-to-field, .extra-to-field", function() {
    const $wrapper = $(this).closest(".search-card-wrapper");
    const idx = parseInt($wrapper.attr("data-index"));
    const owner = $wrapper.attr("data-owner");
    const isExtra = $(this).hasClass("extra-to-field");

    const deck = state.decks[owner];
    const filtered = deck.filter(c => isExtra ? c.section === "Extra" : c.section !== "Extra");
    const cardData = filtered[idx];

    // Remove from source
    const exactIdx = deck.indexOf(cardData);
    if (exactIdx > -1) {
        deck.splice(exactIdx, 1);
    }

    // Spawn centered on viewport
    const cardId = "card_" + Math.random().toString(36).substr(2, 9);
    const spawnX = window.innerWidth / 2 - 75;
    const spawnY = window.innerHeight / 2 - 109;

    state.cards.push({
        id: cardId,
        name: cardData.name,
        image_url: cardData.image_url,
        desc: cardData.desc || "",
        x: spawnX,
        y: spawnY,
        faceUp: true,
        tapped: false,
        counters: { glass: 0, poke: 0 },
        owner: owner,
        section: cardData.section || "Main"
    });

    $("#pile-overlay").fadeOut(200);
    $("#extra-overlay").fadeOut(200);
    renderAllCards();
    updatePileCounts();
    logEvent(owner === "player1" ? "Jugador 1" : "Jugador 2", `Invocó al campo directamente: ${cardData.name}`);
});


// Core drag-and-drop implementation (Absolute Playmat coordinates)
function setupCardInteractions() {
    const $field = $("#field-cards-container");

    $field.on("mousedown touchstart", ".duel-card", function(e) {
        // Prevent trigger during context triggers or submenu interaction
        if ($(e.target).closest(".card-quick-actions").length || $(e.target).hasClass("card-counter-badge")) return;

        e.preventDefault();
        const cardId = $(this).attr("id");
        dragCard = state.cards.find(c => c.id === cardId);

        if (!dragCard) return;

        const clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;

        dragOffset.x = clientX - dragCard.x;
        dragOffset.y = clientY - dragCard.y;

        dragStartCoords.x = dragCard.x;
        dragStartCoords.y = dragCard.y;
        dragStartTime = Date.now();

        $(this).addClass("dragging");

        // Put active card on top z-index hierarchy
        state.cards = state.cards.filter(c => c.id !== cardId).concat([dragCard]);
        renderAllCards();

        $(document).on("mousemove.carddrag touchmove.carddrag", function(moveEvent) {
            if (!dragCard) return;

            const mX = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const mY = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientY : moveEvent.clientY;

            let targetX = mX - dragOffset.x;
            let targetY = mY - dragOffset.y;

            // Restrict coordinates inside viewport
            targetX = Math.max(0, Math.min(window.innerWidth - 150, targetX));
            targetY = Math.max(0, Math.min(window.innerHeight - 218, targetY));

            dragCard.x = targetX;
            dragCard.y = targetY;

            // Reposition element instantaneously in real-time
            $(`#${dragCard.id}`).css({ left: targetX, top: targetY });

            // Highlight hover targets
            updateLandingHoverState(targetX, targetY);
        });

        $(document).on("mouseup.carddrag touchend.carddrag", function() {
            if (dragCard) {
                const $el = $(`#${dragCard.id}`);
                $el.removeClass("dragging");

                // Check click vs drag threshold
                const distance = Math.hypot(dragCard.x - dragStartCoords.x, dragCard.y - dragStartCoords.y);
                const duration = Date.now() - dragStartTime;

                if (distance < 8 && duration < 250) {
                    // Click trigger: show card sidebar preview & toggle orientation parameters
                    updatePreview(dragCard);
                } else {
                    // End of drag coordinates check
                    const finalZone = getCardCurrentZone(dragCard);
                    if (finalZone) {
                        logEvent(dragCard.owner === "player1" ? "Jugador 1" : "Jugador 2", `Colocó ${dragCard.name} en ${finalZone.toUpperCase().replace('_', ' ')}`);
                    }
                }

                // Remove landing hover states
                $(".magic-landing-zone").removeClass("drag-over");
                updateLandingZoneCounts();
            }

            dragCard = null;
            $(document).off(".carddrag");
        });
    });
}

function updateLandingHoverState(x, y) {
    const cardMidX = x + 75;
    const cardMidY = y + 109;

    $(".magic-landing-zone").removeClass("drag-over");

    if (isPointInElement(cardMidX, cardMidY, "#zone-hand-p1")) {
        $("#zone-hand-p1").addClass("drag-over");
    } else if (isPointInElement(cardMidX, cardMidY, "#zone-grave-p1")) {
        $("#zone-grave-p1").addClass("drag-over");
    } else if (isPointInElement(cardMidX, cardMidY, "#zone-banish-p1")) {
        $("#zone-banish-p1").addClass("drag-over");
    } else if (hasPlayer2) {
        if (isPointInElement(cardMidX, cardMidY, "#zone-hand-p2")) {
            $("#zone-hand-p2").addClass("drag-over");
        } else if (isPointInElement(cardMidX, cardMidY, "#zone-grave-p2")) {
            $("#zone-grave-p2").addClass("drag-over");
        } else if (isPointInElement(cardMidX, cardMidY, "#zone-banish-p2")) {
            $("#zone-banish-p2").addClass("drag-over");
        }
    }
}

// Side-Collapsible Sidebar & Accessories animations
function setupGlobalEvents() {
    // Sidebar toggle button slide interaction
    $("#sidebar-toggle-btn").click(function() {
        const collapsed = $("#magic-sidebar").hasClass("collapsed");
        if (collapsed) {
            $("#magic-sidebar").removeClass("collapsed");
            $(this).removeClass("collapsed");
            $("body").removeClass("sidebar-collapsed-body");
        } else {
            $("#magic-sidebar").addClass("collapsed");
            $(this).addClass("collapsed");
            $("body").addClass("sidebar-collapsed-body");
        }
    });

    // P1 accessories sliding edge tab deployer
    $("#toggle-acc-btn").click(function() {
        const collapsed = $("#p1-accessories").hasClass("collapsed");
        if (collapsed) {
            $("#p1-accessories").removeClass("collapsed");
            $("#toggle-acc-btn i").attr("class", "fas fa-chevron-left");
        } else {
            $("#p1-accessories").addClass("collapsed");
            $("#toggle-acc-btn i").attr("class", "fas fa-chevron-right");
        }
    });

    // Right-click context menus for manual operations
    $(document).on("contextmenu", ".duel-card", function(e) {
        e.preventDefault();
        const cardId = $(this).attr("id");
        const card = state.cards.find(c => c.id === cardId);
        if (!card) return;

        activeMenuCard = card;

        // Custom sandbox context actions
        Swal.fire({
            title: card.name,
            html: `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <button class="swal2-confirm swal2-styled context-opt" data-action="flip" style="background-color: #3085d6; margin: 0;">Voltear Carta (Cara ${card.faceUp ? 'Abajo' : 'Arriba'})</button>
                    <button class="swal2-confirm swal2-styled context-opt" data-action="rotate" style="background-color: #3085d6; margin: 0;">Girar (Modo Defensa/Tapped)</button>
                    <button class="swal2-confirm swal2-styled context-opt" data-action="add-glass" style="background-color: #00d2ff; color:#000; margin: 0; font-weight: bold;">+1 Contador Esfera</button>
                    <button class="swal2-confirm swal2-styled context-opt" data-action="add-poke" style="background-color: #ff1b6b; margin: 0; font-weight: bold;">+1 Contador Daño (+10)</button>
                    <button class="swal2-confirm swal2-styled context-opt" data-action="clear-counters" style="background-color: #777; margin: 0;">Remover Contadores</button>
                    <button class="swal2-confirm swal2-styled context-opt" data-action="send-deck" style="background-color: #e5a93b; color:#000; margin: 0; font-weight: bold;">Devolver al Deck (Fondo)</button>
                    <button class="swal2-confirm swal2-styled context-opt" data-action="delete" style="background-color: #ff1b6b; margin: 0;">Eliminar de la Arena</button>
                </div>
            `,
            showConfirmButton: false,
            showCancelButton: true,
            cancelButtonText: "Cerrar",
            background: "#12181e",
            color: "#fff"
        });
    });
}

// Handle context triggers
$(document).on("click", ".context-opt", function() {
    if (!activeMenuCard) return;
    const action = $(this).attr("data-action");
    Swal.close();

    if (action === "flip") {
        activeMenuCard.faceUp = !activeMenuCard.faceUp;
        logEvent(activeMenuCard.owner === "player1" ? "Jugador 1" : "Jugador 2", `Volteó ${activeMenuCard.name} boca ${activeMenuCard.faceUp ? 'arriba' : 'abajo'}.`);
    } else if (action === "rotate") {
        activeMenuCard.tapped = !activeMenuCard.tapped;
        logEvent(activeMenuCard.owner === "player1" ? "Jugador 1" : "Jugador 2", `Giró/Tappeó ${activeMenuCard.name}.`);
    } else if (action === "add-glass") {
        activeMenuCard.counters.glass++;
    } else if (action === "add-poke") {
        activeMenuCard.counters.poke += 10;
    } else if (action === "clear-counters") {
        activeMenuCard.counters.glass = 0;
        activeMenuCard.counters.poke = 0;
    } else if (action === "send-deck") {
        // Return to deck storage array
        state.decks[activeMenuCard.owner].push({
            name: activeMenuCard.name,
            image_url: activeMenuCard.image_url,
            desc: activeMenuCard.desc,
            section: activeMenuCard.section
        });
        state.cards = state.cards.filter(c => c.id !== activeMenuCard.id);
        updatePileCounts();
        logEvent(activeMenuCard.owner === "player1" ? "Jugador 1" : "Jugador 2", `Devolvió ${activeMenuCard.name} al fondo del mazo.`);
    } else if (action === "delete") {
        state.cards = state.cards.filter(c => c.id !== activeMenuCard.id);
        logEvent(activeMenuCard.owner === "player1" ? "Jugador 1" : "Jugador 2", `Eliminó ${activeMenuCard.name} de la arena.`);
    }

    renderAllCards();
    activeMenuCard = null;
});

// Real-time Event Logging
function logEvent(sender, message) {
    const $msgContainer = $("#game-log-messages");
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const cssClass = sender === "Sistema" ? "system-msg" : sender === "Jugador 1" ? "p1-msg" : "p2-msg";

    const html = `
        <div class="log-message ${cssClass}" style="margin-bottom: 6px; font-size: 0.8rem; line-height: 1.4; border-bottom: 1px solid rgba(255,255,255,0.02); padding-bottom: 4px;">
            <span style="color: #666; font-size: 0.7rem; margin-right: 4px;">[${timestamp}]</span>
            <strong style="font-family: 'Orbitron';">${sender}:</strong> ${message}
        </div>
    `;
    $msgContainer.append(html);
    $msgContainer.scrollTop($msgContainer[0].scrollHeight);
}

// Side Image-only Preview
function updatePreview(card) {
    const backImg = (state.layout === "pokemon") ? "img/pokeBocaAbajo.jpg" : "img/bocabajo.jpg";
    const src = card.faceUp ? card.image_url : backImg;
    $("#detail-card-img").attr("src", src);
}

// Global Accessories (Coin / Dice / Token spawning)
function setupAccessories() {
    // Dice 3D
    $("#btn-roll-dice").click(function() {
        const val = Math.floor(Math.random() * 6) + 1;
        logEvent("Sistema", `🎲 Tirada de Dado: ¡Obtuvo un ${val}!`);
        Swal.fire({
            title: `Dado: ${val}`,
            text: `¡Lanzaste un dado de 6 caras!`,
            icon: 'info',
            background: "#12181e",
            color: "#fff"
        });
    });

    // Flip Coin
    $("#btn-flip-coin").click(function() {
        const side = Math.random() < 0.5 ? "Cara" : "Cruz";
        logEvent("Sistema", `🪙 Lanzamiento de Moneda: ¡Cayó ${side}!`);
        Swal.fire({
            title: `Moneda: ${side}`,
            text: `¡Lanzaste una moneda al aire!`,
            icon: 'info',
            background: "#12181e",
            color: "#fff"
        });
    });

    // YGO Token Spawner directly centered on field
    $("#btn-spawn-token").click(function() {
        const cardId = "card_" + Math.random().toString(36).substr(2, 9);
        const spawnX = window.innerWidth / 2 - 75;
        const spawnY = window.innerHeight / 2 - 109;

        state.cards.push({
            id: cardId,
            name: "Ficha / Token",
            image_url: "https://images.ygoprodeck.com/images/cards/73915051.jpg",
            desc: "Ficha generada para el campo libre.",
            x: spawnX,
            y: spawnY,
            faceUp: true,
            tapped: false,
            counters: { glass: 0, poke: 0 },
            owner: "player1",
            section: "Main"
        });

        renderAllCards();
        logEvent("Sistema", "Invocó una Ficha/Token de Yu-Gi-Oh! en el campo.");
    });

    // Generar Esfera de Vidrio Cian
    $(".btn-add-glass-counter").click(function() {
        Swal.fire({
            title: 'Contador Esfera',
            text: 'Haz clic en una carta de la arena para agregar un contador, o usa el menú secundario derecho.',
            icon: 'info',
            background: "#12181e",
            color: "#fff"
        });
    });

    // Generar Chip de Daño Pokemon
    $(".btn-add-poke-counter").click(function() {
        Swal.fire({
            title: 'Contador de Daño',
            text: 'Usa el botón secundario derecho en cualquier carta para añadir puntos de daño acumulativo.',
            icon: 'info',
            background: "#12181e",
            color: "#fff"
        });
    });
}

// Setup LP Floating Trackers logic
function setupLPTrackers() {
    $(".lp-widget-btn").click(function() {
        const player = $(this).attr("data-player");
        const action = $(this).hasClass("lp-btn-add") ? "add" : $(this).hasClass("lp-btn-sub") ? "sub" : "half";

        const $input = $(`#lp-calc-${player}`);
        const $display = $(`#lp-display-${player}`);

        let val = parseInt($input.val()) || 0;
        let current = parseInt($display.text()) || 0;

        if (action === "add") {
            current += val;
        } else if (action === "sub") {
            current = Math.max(0, current - val);
        } else {
            current = Math.ceil(current / 2);
        }

        $display.text(current);
        $input.val('');

        logEvent(player === "p1" ? "Jugador 1" : "Jugador 2", `Actualizó sus Puntos de Vida a ${current} LP.`);
    });
}

// Re-render whole card stack on workspace
function renderAllCards() {
    const $field = $("#field-cards-container");
    $field.empty();

    const backImg = (state.layout === "pokemon") ? "img/pokeBocaAbajo.jpg" : "img/bocabajo.jpg";

    state.cards.forEach(card => {
        const rotationClass = card.tapped ? "tapped" : "";
        const faceClass = card.faceUp ? "" : "face-down";
        const srcImg = card.faceUp ? card.image_url : backImg;

        let counterHtml = "";
        if (card.counters.glass > 0) {
            counterHtml += `<div class="card-counter-badge glass-counter"><i class="fas fa-gem"></i> ${card.counters.glass}</div>`;
        }
        if (card.counters.poke > 0) {
            counterHtml += `<div class="card-counter-badge poke-counter"><i class="fas fa-heart-pulse"></i> +${card.counters.poke}</div>`;
        }

        const html = `
            <div class="duel-card ${faceClass} ${rotationClass}" id="${card.id}" style="left: ${card.x}px; top: ${card.y}px;">
                <div class="card-counter-container">${counterHtml}</div>
                <div class="card-img-wrapper" style="${card.tapped ? 'transform: rotate(90deg);' : ''}">
                    <img class="card-img" src="${srcImg}" alt="${card.name}">
                </div>
            </div>
        `;
        $field.append(html);
    });

    updateLandingZoneCounts();
}
