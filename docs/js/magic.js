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
    mode: "practice", // practice, multiplayer
    cards: [], // Array of card instances { id, name, image_url, x, y, faceUp, tapped, counters: { glass: 0, poke: 0 }, owner: 'player1'/'player2' }
    decks: { player1: [], player2: [] },
    attacks: [],
    viewPerspective: "player1" // player1 or player2 perspective for anti-peeking
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
    state.mode = urlParams.get("mode") || "practice";
    const deck1Id = urlParams.get("deck1");
    const deck2Id = urlParams.get("deck2");

    hasPlayer2 = (deck2Id && deck2Id !== "none");

    // Apply layout guide visual and body theme classes
    if (state.layout === "yugioh") {
        $("#layout-guide-bg").addClass("yugioh");
        $("body").addClass("layout-yugioh").removeClass("layout-pokemon");
    } else if (state.layout === "pokemon") {
        $("#layout-guide-bg").addClass("pokemon");
        $("body").addClass("layout-pokemon").removeClass("layout-yugioh");
    } else {
        $("body").addClass("layout-yugioh").removeClass("layout-pokemon");
    }

    // Hide/Show perspective switcher
    if (state.mode === "practice") {
        $(".perspective-switcher").hide();
    } else {
        $(".perspective-switcher").show();
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
    makeLandingZonesDraggableAndResizable();
    bindDropdownContextMenus();
    bindBatchSelectionHandlers();
    setupPerspectiveSwitcher();

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
        }

        // Player 2 Deck load
        if (hasPlayer2) {
            if (deck2Id !== "mock") {
                await fetchDeckCards(deck2Id, "player2");
            } else {
                state.decks.player2 = JSON.parse(JSON.stringify(defaultMocks));
            }
        }

        // Shuffle decks on startup
        shuffleDeck("player1");
        if (hasPlayer2) {
            shuffleDeck("player2");
        }

        Swal.close();
        renderAllCards();

    } catch (err) {
        console.error(err);
        Swal.fire('Error', 'No se pudieron cargar los mazos de la base de datos.', 'error');
    }
});

// Fetch cards from Supabase schema
async function fetchDeckCards(deckId, playerKey) {
    const { data: deckCards, error: deckErr } = await _supabase
        .from('deck_cards')
        .select('*')
        .eq('deck_id', deckId);

    if (deckErr) throw deckErr;

    if (!deckCards || deckCards.length === 0) {
        const defaultMocks = (state.layout === "pokemon") ? POKE_MOCKS : HIGH_FIDELITY_MOCKS;
        state.decks[playerKey] = JSON.parse(JSON.stringify(defaultMocks));
        return;
    }

    const formatted = deckCards.map(item => {
        return {
            name: item.name,
            image_url: item.image_url || "https://via.placeholder.com/150x218?text=Vikingdev+TCG",
            section: item.section || "Main",
            desc: item.description || item.effect || item.desc || item.text || ""
        };
    });

    state.decks[playerKey] = formatted;
}

// Initialize Physical Draggable Pile Sources
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

    const p2_deck_x = width - 530;
    const p2_deck_y = 25;
    const p2_extra_x = width - 530;
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

    const html = `
        <div class="magic-pile-zone ${themeClass}" id="zone-${id}" style="left: ${x}px; top: ${y}px;">
            <i class="fas fa-arrows-alt pile-drag-handle" style="position: absolute; top: 10px; left: 10px; color: rgba(255,255,255,0.4); cursor: move; font-size: 0.85rem; z-index: 405;"></i>
            <div class="pile-count-badge" id="count-${id}">0</div>
            <div class="pile-label">${label}</div>
            <button class="pile-menu-trigger" data-pile="${id}"><i class="fas fa-ellipsis-h"></i> Acciones</button>
        </div>
    `;
    $parent.append(html);

    // Make piles draggable OR support pulling the top card visually
    const $el = $(`#zone-${id}`);
    $el.on("mousedown touchstart", function(e) {
        if ($(e.target).hasClass("pile-menu-trigger") || $(e.target).closest(".pile-menu-trigger").length) return;

        const clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;

        const isHandle = $(e.target).hasClass("pile-drag-handle") || $(e.target).closest(".pile-drag-handle").length;

        // If they dragged the explicit handle, drag the pile container cleanly!
        if (isHandle) {
            e.preventDefault();
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

                finalX = Math.max(10, Math.min(window.innerWidth - 160, finalX));
                finalY = Math.max(10, Math.min(window.innerHeight - 230, finalY));

                $el.css({ left: finalX, top: finalY });
            });

            $(document).on("mouseup.piledrag touchend.piledrag", function() {
                $(document).off(".piledrag");
            });
            return;
        }

        // Otherwise (clicking anywhere else on the pile container), pull top card!
        if (type === "deck") {
            e.preventDefault();
            const deck = state.decks[owner];
            const mainCards = deck.filter(c => c.section !== "Extra");
            if (mainCards.length === 0) {
                Swal.fire('Deck Vacío', 'No quedan cartas en el Main Deck para arrastrar.', 'warning');
                return;
            }

            // Pop top card
            const idx = deck.findIndex(c => c.section !== "Extra");
            const cardData = deck.splice(idx, 1)[0];

            const cardId = "card_" + Math.random().toString(36).substr(2, 9);
            const offset = $el.offset();

            const newCardObj = {
                id: cardId,
                name: cardData.name,
                image_url: cardData.image_url,
                desc: cardData.desc || "",
                x: offset.left,
                y: offset.top,
                faceUp: false, // Starts face-down cleanly!
                tapped: false,
                counters: { glass: 0, poke: 0 },
                owner: owner,
                section: cardData.section || "Main"
            };

            state.cards.push(newCardObj);
            renderAllCards();
            updatePileCounts();

            // Transition directly into dragging state for the pulled card!
            dragCard = newCardObj;
            const $cardEl = $(`#${cardId}`);
            $cardEl.addClass("dragging");

            dragOffset.x = clientX - dragCard.x;
            dragOffset.y = clientY - dragCard.y;

            $(document).on("mousemove.carddrag touchmove.carddrag", function(moveEvent) {
                if (!dragCard) return;

                const mX = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientX : moveEvent.clientX;
                const mY = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientY : moveEvent.clientY;

                let targetX = mX - dragOffset.x;
                let targetY = mY - dragOffset.y;

                targetX = Math.max(0, Math.min(window.innerWidth - 150, targetX));
                targetY = Math.max(0, Math.min(window.innerHeight - 218, targetY));

                dragCard.x = targetX;
                dragCard.y = targetY;

                $(`#${dragCard.id}`).css({ left: targetX, top: targetY });
                updateLandingHoverState(targetX, targetY);
            });

            $(document).on("mouseup.carddrag touchend.carddrag", function() {
                if (dragCard) {
                    $(`#${dragCard.id}`).removeClass("dragging");
                    $(".magic-landing-zone").removeClass("drag-over");

                    // Automatically flip card face-up if dropped inside J1 or J2 Hand zones!
                    const currentZone = getCardCurrentZone(dragCard);
                    if (currentZone === "hand_p1" || currentZone === "hand_p2") {
                        dragCard.faceUp = true;
                    }

                    updateLandingZoneCounts();
                    renderAllCards(); // Re-render instantly on mouse up to recalculate card sizes!
                }
                dragCard = null;
                $(document).off(".carddrag");
            });
        }
    });
}

// Update counts on visual piles and landing zones
function updatePileCounts() {
    // Deck counts
    const p1Deck = (state.decks.player1 || []).filter(c => c.section !== "Extra").length;
    const p1Extra = (state.decks.player1 || []).filter(c => c.section === "Extra").length;
    $("#count-deck_1").text(p1Deck);
    $("#count-extra_1").text(p1Extra);

    let p2Deck = 0;
    let p2Extra = 0;
    if (hasPlayer2 && state.decks.player2) {
        p2Deck = state.decks.player2.filter(c => c.section !== "Extra").length;
        p2Extra = state.decks.player2.filter(c => c.section === "Extra").length;
        $("#count-deck_2").text(p2Deck);
        $("#count-extra_2").text(p2Extra);
    }

    // Assign appropriate card-back backgrounds to decks physically
    const backImg = (state.layout === "pokemon") ? "img/pokeBocaAbajo.jpg" : "img/bocabajo.jpg";

    togglePileBackground("#zone-deck_1", p1Deck, backImg);
    togglePileBackground("#zone-extra_1", p1Extra, backImg);
    if (hasPlayer2) {
        togglePileBackground("#zone-deck_2", p2Deck, backImg);
        togglePileBackground("#zone-extra_2", p2Extra, backImg);
    }

    // Refresh landing zone counts based on absolute cards coordinates
    updateLandingZoneCounts();
}

function togglePileBackground(selector, count, imgUrl) {
    const $el = $(selector);
    if (count > 0) {
        $el.css({
            "background-image": `url('${imgUrl}')`,
            "background-size": "cover",
            "background-position": "center",
            "border-style": "solid",
            "border-color": "rgba(255, 255, 255, 0.15)",
            "box-shadow": "0 10px 20px rgba(0,0,0,0.5), 0 0 10px rgba(255,255,255,0.05)"
        });
    } else {
        $el.css({
            "background-image": "none",
            "border-style": "dashed",
            "border-color": "rgba(255, 255, 255, 0.25)",
            "box-shadow": "none"
        });
    }
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

// Shuffling logic
function shuffleDeck(owner) {
    const deck = state.decks[owner];
    // Fisher-Yates
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    updatePileCounts();
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
            faceUp: true, // Automatically flip cards face-up in the hand!
            tapped: false,
            counters: { glass: 0, poke: 0 },
            owner: owner,
            section: cardData.section || "Main"
        });
    }

    renderAllCards();
    updatePileCounts();
}

// Search Modal operations (A Mano, Invocar, Al Cementerio, Al Destierro)
function openSearchModal(owner) {
    const deck = state.decks[owner];
    const mainCards = deck.filter(c => c.section !== "Extra");

    if (mainCards.length === 0) {
        Swal.fire('Mazo Vacío', 'No hay cartas para buscar en el Main Deck.', 'warning');
        return;
    }

    // Reset multiselect state
    $("#pile-multi-select-toggle").prop("checked", false).trigger("change");

    $("#pile-modal-title").text(`Buscador de Deck: ${owner === "player1" ? "Jugador 1" : "Jugador 2"}`);
    const $grid = $("#pile-cards-grid");
    $grid.empty();

    mainCards.forEach((card, index) => {
        const html = `
            <div class="pile-card-container" data-index="${index}" data-owner="${owner}" data-source="deck">
                <img src="${card.image_url}" alt="${card.name}">
                <div class="pile-card-hover-overlay">
                    <div class="pile-card-menu">
                        <button class="pile-card-action-btn search-to-hand">A Mano</button>
                        <button class="pile-card-action-btn search-to-field">Invocar</button>
                        <button class="pile-card-action-btn search-to-grave">Al Cementerio</button>
                        <button class="pile-card-action-btn search-to-banish">Al Destierro</button>
                    </div>
                </div>
            </div>
        `;
        $grid.append(html);
    });

    $("#pile-overlay").fadeIn(200);
}

// Extra Modal operations (Invocar Only)
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
            <div class="pile-card-container" data-index="${index}" data-owner="${owner}" data-source="extra">
                <img src="${card.image_url}" alt="${card.name}">
                <div class="pile-card-hover-overlay">
                    <div class="pile-card-menu">
                        <button class="pile-card-action-btn search-to-field">Invocar</button>
                    </div>
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

// Handle search and extra operations
$(document).on("click", ".search-to-hand", function(e) {
    e.preventDefault();
    e.stopPropagation();

    const $container = $(this).closest(".pile-card-container");
    if ($("#pile-multi-select-toggle").is(":checked")) return; // handled by multi-select click

    const idx = parseInt($container.attr("data-index"));
    const owner = $container.attr("data-owner");
    const source = $container.attr("data-source");

    const deck = state.decks[owner];
    const filtered = deck.filter(c => source === "extra" ? c.section === "Extra" : c.section !== "Extra");
    const cardData = filtered[idx];

    // Remove from deck source
    const exactIdx = deck.indexOf(cardData);
    if (exactIdx > -1) {
        deck.splice(exactIdx, 1);
    }

    // Add card to hand zone coordinates
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
        faceUp: true, // Automatically flip cards face-up in hand!
        tapped: false,
        counters: { glass: 0, poke: 0 },
        owner: owner,
        section: cardData.section || "Main"
    });

    $("#pile-overlay").fadeOut(200);
    $("#extra-overlay").fadeOut(200);
    renderAllCards();
    updatePileCounts();
});

$(document).on("click", ".search-to-field", function(e) {
    e.preventDefault();
    e.stopPropagation();

    const $container = $(this).closest(".pile-card-container");
    if ($("#pile-multi-select-toggle").is(":checked")) return; // handled by multi-select click

    const idx = parseInt($container.attr("data-index"));
    const owner = $container.attr("data-owner");
    const source = $container.attr("data-source");

    const deck = state.decks[owner];
    const filtered = deck.filter(c => source === "extra" ? c.section === "Extra" : c.section !== "Extra");
    const cardData = filtered[idx];

    // Remove from deck source
    const exactIdx = deck.indexOf(cardData);
    if (exactIdx > -1) {
        deck.splice(exactIdx, 1);
    }

    // Spawn at center of the viewport
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
});

// Al Cementerio and Al Destierro inside Search Modal list
$(document).on("click", ".search-to-grave, .search-to-banish", function(e) {
    e.preventDefault();
    e.stopPropagation();

    const $container = $(this).closest(".pile-card-container");
    if ($("#pile-multi-select-toggle").is(":checked")) return; // handled by multi-select click

    const idx = parseInt($container.attr("data-index"));
    const owner = $container.attr("data-owner");
    const isBanish = $(this).hasClass("search-to-banish");

    const deck = state.decks[owner];
    const filtered = deck.filter(c => c.section !== "Extra");
    const cardData = filtered[idx];

    // Remove from deck source
    const exactIdx = deck.indexOf(cardData);
    if (exactIdx > -1) {
        deck.splice(exactIdx, 1);
    }

    // Spawn card
    const cardId = "card_" + Math.random().toString(36).substr(2, 9);
    const newCard = {
        id: cardId,
        name: cardData.name,
        image_url: cardData.image_url,
        desc: cardData.desc || "",
        x: window.innerWidth / 2 - 75,
        y: window.innerHeight / 2 - 109,
        faceUp: true,
        tapped: false,
        counters: { glass: 0, poke: 0 },
        owner: owner,
        section: cardData.section || "Main"
    };

    state.cards.push(newCard);
    sendCardToZone(newCard, isBanish ? "banish" : "grave");

    $("#pile-overlay").fadeOut(200);
    renderAllCards();
    updatePileCounts();
});

// Bind Multi-Selection toggle logic in Search modals
function bindBatchSelectionHandlers() {
    $(document).on("change", "#pile-multi-select-toggle", function() {
        const active = $(this).is(":checked");
        if (active) {
            $("#pile-overlay").addClass("pile-multi-select-active");
            $("#pile-batch-actions").css("display", "flex");
        } else {
            $("#pile-overlay").removeClass("pile-multi-select-active");
            $("#pile-batch-actions").hide();
            $(".pile-card-container").removeClass("selected-for-batch");
        }
    });

    $(document).on("click", ".pile-card-container", function(e) {
        if ($("#pile-multi-select-toggle").is(":checked")) {
            e.preventDefault();
            e.stopPropagation();
            $(this).toggleClass("selected-for-batch");
        }
    });

    // Batch add to Hand handler with visual SweetAlert popup display of cards!
    $(document).on("click", ".btn-pile-batch-hand", function() {
        const $selected = $(".pile-card-container.selected-for-batch");
        if ($selected.length === 0) {
            Swal.fire('Sin Selección', 'Por favor selecciona al menos una carta.', 'warning');
            return;
        }

        const addedNames = [];
        const windowW = window.innerWidth;
        const windowH = window.innerHeight;

        const items = [];
        $selected.each(function() {
            const idx = parseInt($(this).attr("data-index"));
            const owner = $(this).attr("data-owner");
            const source = $(this).attr("data-source");
            items.push({ idx, owner, source, $el: $(this) });
        });

        // Sort descending by index to avoid splice index shifts
        items.sort((a, b) => b.idx - a.idx);

        items.forEach(item => {
            const deck = state.decks[item.owner];
            const filtered = deck.filter(c => item.source === "extra" ? c.section === "Extra" : c.section !== "Extra");
            const cardData = filtered[item.idx];

            const exactIdx = deck.indexOf(cardData);
            if (exactIdx > -1) {
                deck.splice(exactIdx, 1);
            }

            const cardId = "card_" + Math.random().toString(36).substr(2, 9);
            const targetX = windowW * 0.15 + 50 + (state.cards.filter(c => getCardCurrentZone(c) === (item.owner === 'player1' ? 'hand_p1' : 'hand_p2')).length * 50);
            const targetY = (item.owner === "player1") ? (windowH - 180) : 40;

            state.cards.push({
                id: cardId,
                name: cardData.name,
                image_url: cardData.image_url,
                desc: cardData.desc || "",
                x: targetX,
                y: targetY,
                faceUp: true, // Automatically flip cards face-up in hand!
                tapped: false,
                counters: { glass: 0, poke: 0 },
                owner: item.owner,
                section: cardData.section || "Main"
            });

            addedNames.push(cardData.name);
        });

        // Turn off toggle and close search overlay
        $("#pile-multi-select-toggle").prop("checked", false).trigger("change");
        $("#pile-overlay").fadeOut(200);

        renderAllCards();
        updatePileCounts();

        // Beautiful SweetAlert popup display of all cards added to hand
        Swal.fire({
            title: 'Cartas Agregadas a la Mano',
            html: `
                <p>Se agregaron con éxito las siguientes cartas a tu mano:</p>
                <ul style="text-align: left; margin-top: 15px; max-height: 200px; overflow-y: auto; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; list-style-type: none;">
                    ${addedNames.map(name => `<li style="margin-bottom: 5px; color: #00d2ff; font-weight: bold;">🃏 ${name}</li>`).join('')}
                </ul>
            `,
            icon: 'success',
            background: '#12181e',
            color: '#fff',
            confirmButtonColor: '#00d2ff',
            confirmButtonText: 'Excelente'
        });
    });
}


// Core drag-and-drop implementation (Absolute Playmat coordinates)
function setupCardInteractions() {
    const $field = $("#field-cards-container");

    $field.on("mousedown touchstart", ".duel-card", function(e) {
        // Prevent trigger during context triggers or submenu interaction
        if ($(e.target).closest(".field-card-actions").length || $(e.target).hasClass("card-counter-badge")) return;

        // Prevent dragging when in targeting mode
        if (targetingCard) return;

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
                }

                // Automatically flip card face-up if dropped inside J1 or J2 Hand zones!
                const currentZone = getCardCurrentZone(dragCard);
                if (currentZone === "hand_p1" || currentZone === "hand_p2") {
                    dragCard.faceUp = true;
                }

                // Remove landing hover states
                $(".magic-landing-zone").removeClass("drag-over");
                updateLandingZoneCounts();
                renderAllCards(); // Re-render instantly on mouse up to recalculate card sizes!
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

    // Accessories body toggle interaction inside sidebar
    $("#toggle-acc-btn").click(function() {
        const $body = $("#acc-body-container");
        const isCollapsed = $body.is(":visible");
        if (isCollapsed) {
            $body.slideUp(200);
            $("#toggle-acc-btn i").attr("class", "fas fa-chevron-up");
        } else {
            $body.slideDown(200);
            $("#toggle-acc-btn i").attr("class", "fas fa-chevron-down");
        }
    });

    // Interactive button inside Graveyard and Banish landing zones to view list
    $(document).on("click", ".btn-view-list", function(e) {
        e.preventDefault();
        e.stopPropagation();

        const zoneKey = $(this).attr("data-zone"); // e.g., "grave_1"
        const isP1 = zoneKey.endsWith("_1");
        const isBanish = zoneKey.startsWith("banish");

        // Gather all cards geometrically inside this target landing zone
        const targetZoneId = isBanish ? (isP1 ? "banish_p1" : "banish_p2") : (isP1 ? "grave_p1" : "grave_p2");
        const listCards = state.cards.filter(c => getCardCurrentZone(c) === targetZoneId);

        if (listCards.length === 0) {
            Swal.fire('Zona Vacía', 'No hay cartas apiladas en esta zona para listar.', 'info');
            return;
        }

        $("#pile-modal-title").text(isBanish ? "Lista de Cartas en Destierro" : "Lista de Cartas en Descarte");
        const $grid = $("#pile-cards-grid");
        $grid.empty();

        listCards.forEach((card, index) => {
            const html = `
                <div class="pile-card-container" data-card-id="${card.id}">
                    <img src="${card.image_url}" alt="${card.name}">
                    <div class="pile-card-hover-overlay">
                        <div class="pile-card-menu">
                            <button class="pile-card-action-btn search-list-to-hand">A Mano</button>
                            <button class="pile-card-action-btn search-list-to-field">Invocar</button>
                        </div>
                    </div>
                </div>
            `;
            $grid.append(html);
        });

        $("#pile-overlay").fadeIn(200);
    });

    // Handle search-list actions
    $(document).on("click", ".search-list-to-hand", function(e) {
        e.preventDefault();
        e.stopPropagation();

        const cardId = $(this).closest(".pile-card-container").attr("data-card-id");
        const cardObj = state.cards.find(c => c.id === cardId);
        if (cardObj) {
            const windowW = window.innerWidth;
            const windowH = window.innerHeight;
            const targetX = windowW * 0.15 + 50 + (state.cards.filter(c => getCardCurrentZone(c) === (cardObj.owner === 'player1' ? 'hand_p1' : 'hand_p2')).length * 50);
            const targetY = (cardObj.owner === "player1") ? (windowH - 180) : 40;

            cardObj.x = targetX;
            cardObj.y = targetY;
            cardObj.faceUp = true;
            cardObj.tapped = false;

            $("#pile-overlay").fadeOut(200);
            renderAllCards();
        }
    });

    $(document).on("click", ".search-list-to-field", function(e) {
        e.preventDefault();
        e.stopPropagation();

        const cardId = $(this).closest(".pile-card-container").attr("data-card-id");
        const cardObj = state.cards.find(c => c.id === cardId);
        if (cardObj) {
            cardObj.x = window.innerWidth / 2 - 75;
            cardObj.y = window.innerHeight / 2 - 109;
            cardObj.faceUp = true;
            cardObj.tapped = false;

            $("#pile-overlay").fadeOut(200);
            renderAllCards();
        }
    });
}

// Side Image-only Preview (respects anti-peeking masking)
function updatePreview(card) {
    const backImg = (state.layout === "pokemon") ? "img/pokeBocaAbajo.jpg" : "img/bocabajo.jpg";

    let isMasked = false;
    if (state.mode === "multiplayer") {
        const zone = getCardCurrentZone(card);
        if (zone === "hand_p1" && state.viewPerspective !== "player1") isMasked = true;
        if (zone === "hand_p2" && state.viewPerspective !== "player2") isMasked = true;
        if (!card.faceUp && !zone) {
            if (card.owner === "player1" && state.viewPerspective !== "player1") isMasked = true;
            if (card.owner === "player2" && state.viewPerspective !== "player2") isMasked = true;
        }
    }

    const src = isMasked ? backImg : card.image_url;
    $("#detail-card-img").attr("src", src);
}

// Global Accessories (Coin / Dice / Token spawning with visual inline animations)
function setupAccessories() {
    // Dice 3D rolling animation
    let isDiceRolling = false;
    $("#btn-roll-dice").click(function() {
        if (isDiceRolling) return;
        isDiceRolling = true;

        const $dice = $("#visual-dice-wrapper");
        const $icon = $("#visual-dice-icon");

        // Random roll value
        const val = Math.floor(Math.random() * 6) + 1;
        const diceClasses = [
            "fa-dice-one",
            "fa-dice-two",
            "fa-dice-three",
            "fa-dice-four",
            "fa-dice-five",
            "fa-dice-six"
        ];

        // Start spinning rotation
        $dice.css({
            "transform": "rotateX(720deg) rotateY(720deg) scale(1.15)",
            "transition": "transform 0.6s cubic-bezier(0.18, 0.89, 0.32, 1.28)"
        });

        // Rapidly change icons during spin
        let interval = setInterval(() => {
            const tempVal = Math.floor(Math.random() * 6);
            $icon.attr("class", "fas " + diceClasses[tempVal]);
        }, 80);

        setTimeout(() => {
            clearInterval(interval);
            // Set final value class
            $icon.attr("class", "fas " + diceClasses[val - 1]);
            $dice.css({
                "transform": "rotateX(0deg) rotateY(0deg) scale(1)",
                "transition": "transform 0.1s"
            });
            isDiceRolling = false;
        }, 600);
    });

    // Flip Coin animation
    let isCoinFlipping = false;
    $("#btn-flip-coin").click(function() {
        if (isCoinFlipping) return;
        isCoinFlipping = true;

        const $coin = $("#visual-coin-wrapper");
        const $text = $("#visual-coin-text");

        const isHeads = Math.random() < 0.5;

        // Add spin and perspective
        $coin.css({
            "transform": "rotateY(1080deg) scale(1.15)",
            "transition": "transform 0.6s cubic-bezier(0.18, 0.89, 0.32, 1.28)"
        });

        setTimeout(() => {
            if (isHeads) {
                $text.text("CARA");
                $coin.css({
                    "border-color": "#00d2ff",
                    "background": "rgba(0, 210, 255, 0.15)",
                    "color": "#00d2ff",
                    "text-shadow": "0 0 8px rgba(0,210,255,0.5)",
                    "box-shadow": "0 0 12px rgba(0,210,255,0.4)"
                });
            } else {
                $text.text("CRUZ");
                $coin.css({
                    "border-color": "#ff1b6b",
                    "background": "rgba(255, 27, 107, 0.15)",
                    "color": "#ff1b6b",
                    "text-shadow": "0 0 8px rgba(255,27,107,0.5)",
                    "box-shadow": "0 0 12px rgba(255,27,107,0.4)"
                });
            }

            $coin.css({
                "transform": "rotateY(0deg) scale(1)",
                "transition": "transform 0.1s"
            });
            isCoinFlipping = false;
        }, 600);
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
    });

    // Generar Esfera de Vidrio Cian info
    $(".btn-add-glass-counter").click(function() {
        Swal.fire({
            title: 'Contador Esfera',
            text: 'Usa el menú secundario (clic derecho) en cualquier carta para añadir esferas de vidrio.',
            icon: 'info',
            background: "#12181e",
            color: "#fff"
        });
    });

    // Generar Chip de Daño Pokemon info
    $(".btn-add-poke-counter").click(function() {
        Swal.fire({
            title: 'Contador de Daño',
            text: 'Usa el menú secundario (clic derecho) en cualquier carta para añadir puntos de daño acumulativo.',
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
    });
}

// Setup Perspective Switcher for single screen Anti-Peeking
function setupPerspectiveSwitcher() {
    $(".perspective-btn").click(function() {
        $(".perspective-btn").removeClass("active").css("background", "rgba(255,255,255,0.05)").css("color", "#fff").css("border-color", "rgba(255,255,255,0.15)");
        $(this).addClass("active");

        state.viewPerspective = $(this).attr("data-player");

        if (state.viewPerspective === "player1") {
            $(this).css("background", "rgba(0,210,255,0.15)").css("color", "#00d2ff").css("border-color", "#00d2ff");
        } else {
            $(this).css("background", "rgba(255,27,107,0.15)").css("color", "#ff1b6b").css("border-color", "#ff1b6b");
        }

        renderAllCards();
    });
}

// Re-render whole card stack on workspace
function renderAllCards() {
    const $field = $("#field-cards-container");
    $field.empty();

    const backImg = (state.layout === "pokemon") ? "img/pokeBocaAbajo.jpg" : "img/bocabajo.jpg";

    state.cards.forEach(card => {
        const currentZone = getCardCurrentZone(card);
        const inGraveOrBanish = (currentZone === "grave_p1" || currentZone === "grave_p2" || currentZone === "banish_p1" || currentZone === "banish_p2");
        const sizeClass = inGraveOrBanish ? "miniature-card" : "";

        // Anti-peeking logic
        let isMaskedAsBack = false;

        if (state.mode === "multiplayer") {
            // If card is inside hands
            if (currentZone === "hand_p1") {
                if (state.viewPerspective !== "player1") isMaskedAsBack = true;
            } else if (currentZone === "hand_p2") {
                if (state.viewPerspective !== "player2") isMaskedAsBack = true;
            }

            // If card is placed face-down on the playmat/field
            if (!card.faceUp && !currentZone) {
                // Check if card belongs to P1 or P2
                if (card.owner === "player1" && state.viewPerspective !== "player1") {
                    isMaskedAsBack = true;
                } else if (card.owner === "player2" && state.viewPerspective !== "player2") {
                    isMaskedAsBack = true;
                }
            }
        }

        const rotationClass = card.tapped ? "tapped" : "";
        const faceClass = (card.faceUp && !isMaskedAsBack) ? "" : "face-down";
        const srcImg = (card.faceUp && !isMaskedAsBack) ? card.image_url : backImg;

        let counterHtml = "";
        if (card.counters.glass > 0) {
            counterHtml += `<div class="card-counter-badge glass-counter" data-type="glass" data-card-id="${card.id}"><i class="fas fa-gem"></i> ${card.counters.glass}</div>`;
        }
        if (card.counters.poke > 0) {
            counterHtml += `<div class="card-counter-badge poke-counter" data-type="poke" data-card-id="${card.id}"><i class="fas fa-heart-pulse"></i> +${card.counters.poke}</div>`;
        }

        const html = `
            <div class="duel-card ${faceClass} ${rotationClass} ${sizeClass}" id="${card.id}" style="left: ${card.x}px; top: ${card.y}px;">
                <div class="card-counter-container">${counterHtml}</div>
                <div class="card-img-wrapper" style="${card.tapped ? 'transform: rotate(90deg);' : ''}">
                    <img class="card-img" src="${srcImg}" alt="${card.name}">
                </div>
                <!-- Dynamic Horizontal quick actions bar on hover (hidden if Miniature) -->
                ${inGraveOrBanish ? '' : `
                <div class="field-card-actions">
                    <button class="field-action-btn btn-field-attack" data-id="${card.id}">Atacar</button>
                    <button class="field-action-btn btn-field-direct" data-id="${card.id}">Atk Directo</button>
                    <button class="field-action-btn btn-field-set" data-id="${card.id}">Set</button>
                    <button class="field-action-btn btn-field-flip" data-id="${card.id}">Voltear</button>
                    <button class="field-action-btn btn-field-tap" data-id="${card.id}">Girar</button>
                    <button class="field-action-btn btn-field-flash" data-id="${card.id}">Efecto</button>
                </div>
                `}
            </div>
        `;
        $field.append(html);
    });

    updateLandingZoneCounts();
    drawAttackArrows();
}

// Implement draggable and resizable logic on Landing Zones
function makeLandingZonesDraggableAndResizable() {
    $(".magic-landing-zone").each(function() {
        const $zone = $(this);

        // Draggable logic (apply to all zones)
        $zone.css("pointer-events", "auto");

        $zone.on("mousedown touchstart", function(e) {
            // Ignore if clicking on a resize handle, buttons, or child content inputs
            if ($(e.target).closest(".resize-handle").length || $(e.target).closest("button").length || $(e.target).closest("input").length) return;
            e.preventDefault();

            const clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
            const clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;

            const offset = $zone.offset();
            const startX = offset.left;
            const startY = offset.top;

            const deltaX = clientX - startX;
            const deltaY = clientY - startY;

            $(document).on("mousemove.zonedrag touchmove.zonedrag", function(moveEvent) {
                const mX = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientX : moveEvent.clientX;
                const mY = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientY : moveEvent.clientY;

                let finalX = mX - deltaX;
                let finalY = mY - deltaY;

                // Move container freely in absolute page coordinates
                $zone.css({
                    left: finalX + "px",
                    top: finalY + "px",
                    bottom: "auto",
                    right: "auto"
                });
            });

            $(document).on("mouseup.zonedrag touchend.zonedrag", function() {
                $(document).off(".zonedrag");
                updateLandingZoneCounts();
            });
        });

        // Resizable logic for zones containing a .resize-handle
        const $handle = $zone.find(".resize-handle");
        if ($handle.length) {
            $handle.on("mousedown touchstart", function(e) {
                e.preventDefault();
                e.stopPropagation();

                const startWidth = $zone.outerWidth();
                const startHeight = $zone.outerHeight();

                const startX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
                const startY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;

                $(document).on("mousemove.zoneresize touchmove.zoneresize", function(moveEvent) {
                    const mX = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientX : moveEvent.clientX;
                    const mY = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientY : moveEvent.clientY;

                    const newWidth = Math.max(150, startWidth + (mX - startX));
                    const newHeight = Math.max(150, startHeight + (mY - startY));

                    $zone.css({
                        width: newWidth + "px",
                        height: newHeight + "px"
                    });
                });

                $(document).on("mouseup.zoneresize touchend.zoneresize", function() {
                    $(document).off(".zoneresize");
                    updateLandingZoneCounts();
                });
            });
        }
    });
}

// Reusable inline context menu positioner
function showContextMenu(menuId, x, y, contextData = {}) {
    // Hide all context menus first
    $(".card-context-menu, .deck-context-menu").removeClass("active");

    const $menu = $(menuId);
    $menu.data("context-data", contextData);

    const menuW = $menu.outerWidth() || 230;
    const menuH = $menu.outerHeight() || 300;

    let posX = x;
    let posY = y;

    if (posX + menuW > window.innerWidth) {
        posX = window.innerWidth - menuW - 10;
    }
    if (posY + menuH > window.innerHeight) {
        posY = window.innerHeight - menuH - 10;
    }

    $menu.css({
        left: posX + "px",
        top: posY + "px"
    }).addClass("active");
}

// Clear active context menus on outer click
$(document).on("click mousedown", function(e) {
    if (!$(e.target).closest(".card-context-menu, .deck-context-menu, .pile-menu-trigger").length) {
        $(".card-context-menu, .deck-context-menu").removeClass("active");
    }
});

// Align context triggers with inline dropdown placements
function bindDropdownContextMenus() {
    // Handle pile menu trigger or right click on piles
    $(document).on("click", ".pile-menu-trigger", function(e) {
        e.preventDefault();
        e.stopPropagation();

        const pileId = $(this).attr("data-pile");
        const owner = pileId.endsWith("_1") ? "player1" : "player2";
        const type = pileId.startsWith("deck") ? "deck" : "extra";

        const offset = $(this).offset();
        const x = offset.left;
        const y = offset.top + $(this).outerHeight();

        if (type === "deck") {
            showContextMenu("#deck-ctx-menu", x, y, { owner: owner });
        } else {
            showContextMenu("#extra-ctx-menu", x, y, { owner: owner });
        }
    });

    $(document).on("contextmenu", ".magic-pile-zone", function(e) {
        e.preventDefault();
        e.stopPropagation();

        const pileId = $(this).attr("id").replace("zone-", "");
        const owner = pileId.endsWith("_1") ? "player1" : "player2";
        const type = pileId.startsWith("deck") ? "deck" : "extra";

        if (type === "deck") {
            showContextMenu("#deck-ctx-menu", e.clientX, e.clientY, { owner: owner });
        } else {
            showContextMenu("#extra-ctx-menu", e.clientX, e.clientY, { owner: owner });
        }
    });

    // Handle card right-clicks
    $(document).on("contextmenu", ".duel-card", function(e) {
        e.preventDefault();
        e.stopPropagation();

        const cardId = $(this).attr("id");
        const card = state.cards.find(c => c.id === cardId);
        if (!card) return;

        showContextMenu("#card-ctx-menu", e.clientX, e.clientY, { card: card });
    });

    // Deck dropdown item triggers
    $("#menu-deck-draw1").click(function() {
        const data = $("#deck-ctx-menu").data("context-data");
        if (data && data.owner) {
            drawCards(data.owner, 1);
        }
        $("#deck-ctx-menu").removeClass("active");
    });

    $("#menu-deck-draw5").click(function() {
        const data = $("#deck-ctx-menu").data("context-data");
        if (data && data.owner) {
            drawCards(data.owner, 5);
        }
        $("#deck-ctx-menu").removeClass("active");
    });

    $("#menu-deck-shuffle").click(function() {
        const data = $("#deck-ctx-menu").data("context-data");
        if (data && data.owner) {
            shuffleDeck(data.owner);
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Deck barajado',
                showConfirmButton: false,
                timer: 1500
            });
        }
        $("#deck-ctx-menu").removeClass("active");
    });

    $("#menu-deck-search").click(function() {
        const data = $("#deck-ctx-menu").data("context-data");
        if (data && data.owner) {
            openSearchModal(data.owner);
        }
        $("#deck-ctx-menu").removeClass("active");
    });

    // Extra actions
    $("#menu-extra-search").click(function() {
        const data = $("#extra-ctx-menu").data("context-data");
        if (data && data.owner) {
            openExtraModal(data.owner);
        }
        $("#extra-ctx-menu").removeClass("active");
    });

    // Card actions
    $("#menu-card-flip").click(function() {
        const data = $("#card-ctx-menu").data("context-data");
        if (data && data.card) {
            data.card.faceUp = !data.card.faceUp;
            renderAllCards();
        }
        $("#card-ctx-menu").removeClass("active");
    });

    $("#menu-card-tap").click(function() {
        const data = $("#card-ctx-menu").data("context-data");
        if (data && data.card) {
            data.card.tapped = !data.card.tapped;
            renderAllCards();
        }
        $("#card-ctx-menu").removeClass("active");
    });

    $("#menu-card-counter-glass").click(function() {
        const data = $("#card-ctx-menu").data("context-data");
        if (data && data.card) {
            data.card.counters.glass++;
            renderAllCards();
        }
        $("#card-ctx-menu").removeClass("active");
    });

    // Dynamic Pokémon multiple damage selections
    $(document).on("click", ".menu-card-counter-dmg", function(e) {
        e.preventDefault();
        e.stopPropagation();

        const data = $("#card-ctx-menu").data("context-data");
        if (data && data.card) {
            const val = parseInt($(this).attr("data-val"));
            data.card.counters.poke += val;
            renderAllCards();
        }
        $("#card-ctx-menu").removeClass("active");
    });

    $("#menu-card-counter-clear").click(function() {
        const data = $("#card-ctx-menu").data("context-data");
        if (data && data.card) {
            data.card.counters.glass = 0;
            data.card.counters.poke = 0;
            renderAllCards();
        }
        $("#card-ctx-menu").removeClass("active");
    });

    $("#menu-card-deck-bottom").click(function() {
        const data = $("#card-ctx-menu").data("context-data");
        if (data && data.card) {
            state.decks[data.card.owner].push({
                name: data.card.name,
                image_url: data.card.image_url,
                desc: data.card.desc,
                section: data.card.section
            });
            state.cards = state.cards.filter(c => c.id !== data.card.id);
            updatePileCounts();
            renderAllCards();
        }
        $("#card-ctx-menu").removeClass("active");
    });

    $("#menu-card-deck-top").click(function() {
        const data = $("#card-ctx-menu").data("context-data");
        if (data && data.card) {
            state.decks[data.card.owner].unshift({
                name: data.card.name,
                image_url: data.card.image_url,
                desc: data.card.desc,
                section: data.card.section
            });
            state.cards = state.cards.filter(c => c.id !== data.card.id);
            updatePileCounts();
            renderAllCards();
        }
        $("#card-ctx-menu").removeClass("active");
    });

    $("#menu-card-grave").click(function() {
        const data = $("#card-ctx-menu").data("context-data");
        if (data && data.card) {
            sendCardToZone(data.card, "grave");
        }
        $("#card-ctx-menu").removeClass("active");
    });

    $("#menu-card-banish").click(function() {
        const data = $("#card-ctx-menu").data("context-data");
        if (data && data.card) {
            sendCardToZone(data.card, "banish");
        }
        $("#card-ctx-menu").removeClass("active");
    });

    $("#menu-card-delete").click(function() {
        const data = $("#card-ctx-menu").data("context-data");
        if (data && data.card) {
            state.cards = state.cards.filter(c => c.id !== data.card.id);
            renderAllCards();
        }
        $("#card-ctx-menu").removeClass("active");
    });
}

function sendCardToZone(card, zoneType) {
    let selector = "";
    if (card.owner === "player1") {
        selector = zoneType === "grave" ? "#zone-grave-p1" : "#zone-banish-p1";
    } else {
        selector = zoneType === "grave" ? "#zone-grave-p2" : "#zone-banish-p2";
    }

    const $zone = $(selector);
    if ($zone.length) {
        const offset = $zone.offset();
        const w = $zone.outerWidth();
        const h = $zone.outerHeight();
        // Place card centered in landing zone
        card.x = offset.left + (w / 2) - 75;
        card.y = offset.top + (h / 2) - 109;
        renderAllCards();
    }
}

// Horizontal Quick-Action Ribbon Menu events
$(document).on("click", ".btn-field-attack", function(e) {
    e.preventDefault();
    e.stopPropagation();
    const cardId = $(this).attr("data-id");
    const card = state.cards.find(c => c.id === cardId);
    if (card) {
        startAttackTargeting(card);
    }
});

$(document).on("click", ".btn-field-direct", function(e) {
    e.preventDefault();
    e.stopPropagation();
    const cardId = $(this).attr("data-id");
    const card = state.cards.find(c => c.id === cardId);
    if (card) {
        // Direct attack registered
        state.attacks.push({
            attackerId: card.id,
            targetId: null,
            isDirect: true
        });
        drawAttackArrows();
    }
});

$(document).on("click", ".btn-field-set", function(e) {
    e.preventDefault();
    e.stopPropagation();
    const cardId = $(this).attr("data-id");
    const card = state.cards.find(c => c.id === cardId);
    if (card) {
        card.faceUp = false;
        renderAllCards();
    }
});

$(document).on("click", ".btn-field-flip", function(e) {
    e.preventDefault();
    e.stopPropagation();
    const cardId = $(this).attr("data-id");
    const card = state.cards.find(c => c.id === cardId);
    if (card) {
        card.faceUp = !card.faceUp;
        renderAllCards();
    }
});

$(document).on("click", ".btn-field-tap", function(e) {
    e.preventDefault();
    e.stopPropagation();
    const cardId = $(this).attr("data-id");
    const card = state.cards.find(c => c.id === cardId);
    if (card) {
        card.tapped = !card.tapped;
        renderAllCards();
    }
});

// Flash Activation visual effects trigger
$(document).on("click", ".btn-field-flash", function(e) {
    e.preventDefault();
    e.stopPropagation();
    const cardId = $(this).attr("data-id");
    const $card = $(`#${cardId}`);
    if ($card.length) {
        $card.addClass("activating-flash");
        setTimeout(() => {
            $card.removeClass("activating-flash");
        }, 800);
    }
});

// Drag-to-delete counter badge logic: Dragging any counter badge outside its card removes it cleanly!
$(document).on("mousedown touchstart", ".card-counter-badge", function(e) {
    e.preventDefault();
    e.stopPropagation();

    const $badge = $(this);
    const cardId = $badge.attr("data-card-id");
    const counterType = $badge.attr("data-type"); // "glass" or "poke"

    const card = state.cards.find(c => c.id === cardId);
    if (!card) return;

    const startX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
    const startY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;

    const offset = $badge.offset();
    const $clone = $badge.clone().css({
        position: "fixed",
        left: offset.left,
        top: offset.top,
        "pointer-events": "none",
        "z-index": 110000
    }).appendTo("body");

    $badge.css("opacity", 0.3);

    $(document).on("mousemove.counterdrag touchmove.counterdrag", function(moveEvent) {
        const mX = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const mY = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientY : moveEvent.clientY;

        $clone.css({
            left: mX - 10,
            top: mY - 10
        });
    });

    $(document).on("mouseup.counterdrag touchend.counterdrag", function(upEvent) {
        $(document).off(".counterdrag");
        $clone.remove();
        $badge.css("opacity", 1);

        const endX = upEvent.type === "touchend" ? upEvent.changedTouches[0].clientX : upEvent.clientX;
        const endY = upEvent.type === "touchend" ? upEvent.changedTouches[0].clientY : upEvent.clientY;

        // Calculate distance from card center coordinate
        const cardMidX = card.x + 75;
        const cardMidY = card.y + 109;

        const distance = Math.hypot(endX - cardMidX, endY - cardMidY);

        // If dragged outside the card boundary (threshold 100px from card center)
        if (distance > 105) {
            if (counterType === "glass") {
                card.counters.glass = 0;
            } else {
                card.counters.poke = 0;
            }

            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'info',
                title: 'Contadores eliminados',
                showConfirmButton: false,
                timer: 1500
            });
        }

        renderAllCards();
    });
});

// Attack targeting arrow renderer system
function startAttackTargeting(card) {
    targetingCard = card;
    $("#playmat").addClass("selecting-zone");

    // Show instruction toast
    Swal.fire({
        toast: true,
        position: 'bottom',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        icon: 'info',
        title: 'Elige el objetivo del ataque en la arena',
        background: '#12181e',
        color: '#fff'
    });
}

$(document).on("click", ".duel-card", function(e) {
    if (targetingCard) {
        e.preventDefault();
        e.stopPropagation();

        const targetId = $(this).attr("id");
        if (targetId !== targetingCard.id) {
            // Register attack target
            state.attacks.push({
                attackerId: targetingCard.id,
                targetId: targetId,
                isDirect: false
            });
            targetingCard = null;
            $("#playmat").removeClass("selecting-zone");
            drawAttackArrows();
        }
    }
});

$(document).on("click", "#playmat", function(e) {
    if ($(e.target).closest(".duel-card, .field-card-actions, .pile-menu-trigger").length) return;

    if (targetingCard) {
        targetingCard = null;
        $("#playmat").removeClass("selecting-zone");
        return;
    }

    // Clear active attacks
    state.attacks = [];
    drawAttackArrows();
});

function drawAttackArrows() {
    const $overlay = $("#attack-arrows-overlay");
    $overlay.empty();

    // Clear any existing badges and glowing classes
    $(".attack-text-badge, .attack-direct-badge").remove();
    $(".duel-card").removeClass("card-is-attacker card-under-attack");

    state.attacks.forEach(atk => {
        const attackerObj = state.cards.find(c => c.id === atk.attackerId);
        if (!attackerObj) return;

        const $atkEl = $(`#${attackerObj.id}`);
        if (!$atkEl.length) return;

        // Start coords (center of attacker)
        const atkPos = $atkEl.position();
        const startX = atkPos.left + $atkEl.outerWidth() / 2;
        const startY = atkPos.top + $atkEl.outerHeight() / 2;

        // Add highlight class
        $atkEl.addClass("card-is-attacker");
        $atkEl.append(`<div class="attack-text-badge">⚔️ Atacante</div>`);

        let endX = 0, endY = 0;
        if (atk.isDirect) {
            endX = startX;
            endY = attackerObj.owner === "player1" ? 40 : window.innerHeight - 100;

            const badgeLeft = startX;
            const badgeTop = attackerObj.owner === "player1" ? startY - 100 : startY + 60;
            $("#playmat").append(`
                <div class="attack-direct-badge" style="left: ${badgeLeft - 80}px; top: ${badgeTop}px;">
                    💥 Ataque Directo
                </div>
            `);
        } else {
            const targetObj = state.cards.find(c => c.id === atk.targetId);
            if (!targetObj) return;

            const $tgtEl = $(`#${targetObj.id}`);
            if (!$tgtEl.length) return;

            const tgtPos = $tgtEl.position();
            endX = tgtPos.left + $tgtEl.outerWidth() / 2;
            endY = tgtPos.top + $tgtEl.outerHeight() / 2;

            $tgtEl.addClass("card-under-attack");
            $tgtEl.append(`<div class="attack-text-badge defender">🎯 Atacando</div>`);
        }

        // Draw SVG line
        const angle = Math.atan2(endY - startY, endX - startX);
        const arrowSize = 16;

        const headX1 = endX - arrowSize * Math.cos(angle - Math.PI / 6);
        const headY1 = endY - arrowSize * Math.sin(angle - Math.PI / 6);
        const headX2 = endX - arrowSize * Math.cos(angle + Math.PI / 6);
        const headY2 = endY - arrowSize * Math.sin(angle + Math.PI / 6);

        const strokeColor = attackerObj.owner === "player1" ? "#00d2ff" : "#ff1b6b";
        const svgNamespace = "http://www.w3.org/2000/svg";

        // Create line
        const path = document.createElementNS(svgNamespace, "path");
        path.setAttribute("class", "attack-line");
        path.setAttribute("d", `M ${startX} ${startY} L ${endX} ${endY}`);
        path.setAttribute("stroke", strokeColor);
        path.setAttribute("fill", "none");

        // Create arrowhead
        const head = document.createElementNS(svgNamespace, "polygon");
        head.setAttribute("class", "attack-head");
        head.setAttribute("points", `${endX},${endY} ${headX1},${headY1} ${headX2},${headY2}`);
        head.setAttribute("fill", strokeColor);

        $overlay[0].appendChild(path);
        $overlay[0].appendChild(head);
    });
}
