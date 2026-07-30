// Magic Mode: Free Sandbox Duel Engine
// 100% Free-form positioning, dragging, attaching, and local gameplay testing.

const HIGH_FIDELITY_MOCKS = [
    // Yu-Gi-Oh! Mock Cards
    { name: "Dragón Blanco de Ojos Azules", image_url: "https://images.ygoprodeck.com/images/cards/89631139.jpg", section: "Main", desc: "Este legendario dragón es una poderosa máquina de destrucción. Prácticamente invencible, muy pocos se han enfrentado a esta magnífica criatura y han vivido para contarlo." },
    { name: "Mago Oscuro", image_url: "https://images.ygoprodeck.com/images/cards/46986414.jpg", section: "Main", desc: "El más grande de los magos en lo referente al ataque y la defense." },
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
    { name: "Caramelo Raro", image_url: "https://images.pokemontcg.io/sv1/191_hires.png", section: "Objeto: Evoluciona uno de tus Pokémon." }
];

// Local state configuration
const state = {
    layout: "none", // none, yugioh, pokemon
    cards: [],
    decks: { player1: [], player2: [] },
    attacks: [],
    pileCoords: {}
};

let hasPlayer2 = false;
let dragCard = null;
const dragOffset = { x: 0, y: 0 };
let dragStartCoords = { x: 0, y: 0 };
let dragStartTime = 0;
let targetingCard = null;
let targetActionType = null; // summon, set
let xyzCard = null;
let activeMenuCard = null;

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
        $("#hand-tray-p2").css("display", "block");
        $("#lp-widget-p2").css("display", "block");
    }

    // Initialize Default Pile Coordinates dynamically centered based on viewport dimensions
    const width = window.innerWidth;
    const height = window.innerHeight;
    state.pileCoords = {
        deck_1: { x: 20, y: height - 165 },
        extra_1: { x: 20, y: height - 310 },
        grave_1: { x: width - 110, y: height - 165 },
        banished_1: { x: width - 110, y: height - 310 },
        deck_2: { x: width - 110, y: 55 },
        extra_2: { x: width - 110, y: 200 },
        grave_2: { x: 20, y: 55 },
        banished_2: { x: 20, y: 200 }
    };

    initializePileZones();
    setupAccessories();
    setupLPTrackers();

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
            state.decks["player1"] = JSON.parse(JSON.stringify(defaultMocks));
        }
        instantiateDeck("player1");

        // Player 2 Deck load
        if (hasPlayer2) {
            if (deck2Id && deck2Id !== "mock") {
                await fetchDeckCards(deck2Id, "player2");
            } else {
                state.decks["player2"] = JSON.parse(JSON.stringify(defaultMocks));
            }
            instantiateDeck("player2");
        }

        Swal.close();
        logGameMessage("⚡ Arena Magic cargada correctamente. ¡Disfruta el juego libre!");
    } catch (e) {
        console.error(e);
        Swal.fire("Error", "No se pudieron inicializar los mazos.", "error");
    }

    // Bind Collapsible triggers for Hand Trays
    $(".btn-toggle-tray").click(function(e) {
        e.stopPropagation();
        const targetId = $(this).data("target");
        const $tray = $(`#${targetId}`);
        $tray.toggleClass("collapsed");
    });

    // Sidebar panel toggle
    $("#sidebar-toggle-btn").click(function() {
        $("#magic-sidebar").toggleClass("collapsed");
        $(this).toggleClass("collapsed");
        $("body").toggleClass("sidebar-collapsed-body");
    });

    // Close Modals / Overlays
    $("#btn-close-pile").click(() => $("#pile-overlay").fadeOut(150));
    $("#btn-close-extra").click(() => $("#extra-overlay").fadeOut(150));
    $("#btn-close-attached").click(() => $("#attached-overlay").fadeOut(150));

    // Handle generic clicks on playmat to clear targeting modes or active attack arrows
    $("#playmat").on("click", function(e) {
        if ($(e.target).closest(".duel-card, .magic-pile-zone").length === 0) {
            // Clicked empty ground on playmat
            if ($("#playmat").hasClass("selecting-zone")) {
                stopGraphicalTargeting();
            }
            // Clear attack arrows
            state.attacks = [];
            drawAttackArrows();
        }
    });
});

// Fetch raw cards from Supabase db
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
        state.decks[playerKey] = [];
    }
}

// Populate cards in state
function instantiateDeck(playerKey) {
    const deckCards = state.decks[playerKey];
    if (!deckCards || deckCards.length === 0) return;

    // Filter out previously loaded cards of this player
    state.cards = state.cards.filter(c => c.owner !== playerKey);
    const playerSuffix = playerKey === "player1" ? 1 : 2;

    deckCards.forEach((c, index) => {
        const section = c.section || "Main";
        if (section === "Side") return; // Ignore Side completely

        let targetZone = `deck_${playerSuffix}`;
        let isExtra = false;
        if (section === "Extra") {
            if (state.layout === "yugioh") {
                targetZone = `extra_${playerSuffix}`;
                isExtra = true;
            } else {
                targetZone = `deck_${playerSuffix}`;
            }
        }

        state.cards.push({
            instanceId: `card_${playerKey}_${Date.now()}_${index}_${Math.floor(Math.random() * 1000)}`,
            name: c.name || "Carta",
            imageUrl: c.image_url || "https://vikingtcg.xyz/favi.png",
            owner: playerKey,
            controller: playerKey,
            zone: targetZone,
            faceDown: true,
            tapped: false,
            counters: 0,
            attachedTo: null,
            x: 0,
            y: 0,
            z: index + 1,
            isExtra: isExtra,
            description: c.description || c.effect || c.desc || c.text || ""
        });
    });

    if (state.layout === "pokemon") {
        shuffleDeckSilent(playerKey);
    }

    renderAllCards();
}

// Render Draggable Piles (HTML slots)
function initializePileZones() {
    $("#piles-container").empty();
    const piles = [
        { id: "deck_1", label: "Deck P1", class: "p1-pile" },
        { id: "extra_1", label: "Extra P1", class: "p1-pile" },
        { id: "grave_1", label: "Grave P1", class: "p1-pile" },
        { id: "banished_1", label: "Banish P1", class: "p1-pile" }
    ];

    if (hasPlayer2) {
        piles.push(
            { id: "deck_2", label: "Deck P2", class: "p2-pile" },
            { id: "extra_2", label: "Extra P2", class: "p2-pile" },
            { id: "grave_2", label: "Grave P2", class: "p2-pile" },
            { id: "banished_2", label: "Banish P2", class: "p2-pile" }
        );
    }

    piles.forEach(p => {
        const coords = state.pileCoords[p.id];
        const menuIconClass = p.id.startsWith("deck_") ? "fa-bars" : "fa-ellipsis-v";
        $("#piles-container").append(`
            <div class="magic-pile-zone ${p.class}" id="zone-${p.id}" data-id="${p.id}" style="left: ${coords.x}px; top: ${coords.y}px;">
                <span class="pile-label" id="label-${p.id}">${p.label}</span>
                <button class="pile-menu-trigger" data-id="${p.id}"><i class="fas ${menuIconClass}"></i></button>
                <div class="pile-count-badge" id="count-${p.id}">0</div>
            </div>
        `);
    });

    // Draggable pile zones themselves!
    $(".magic-pile-zone").off("mousedown touchstart").on("mousedown touchstart", function(e) {
        if ($(e.target).closest(".pile-menu-trigger").length) return;
        e.preventDefault();
        e.stopPropagation();

        const pileId = $(this).data("id");
        const $pile = $(this);
        const startPos = getEventCoords(e);
        const offset = $pile.offset();

        // DELEGATE DRAG START TO TOP CARD IF PILE NOT EMPTY & DRAGGED BY INNER FACE (NOT LABEL)
        const isDraggingLabel = $(e.target).closest(".pile-label").length > 0;
        const pileCards = state.cards.filter(c => c.zone === pileId);

        if (pileCards.length > 0 && !isDraggingLabel) {
            // Drag the TOP CARD instead!
            const topCard = pileCards[pileCards.length - 1];
            topCard.zone = "field_free";
            topCard.x = state.pileCoords[pileId].x;
            topCard.y = state.pileCoords[pileId].y;

            // Make that card the active dragCard
            dragCard = $(`#${topCard.instanceId}`);
            if (!dragCard.length) {
                // If top card element not rendered yet, render first
                renderAllCards();
                dragCard = $(`#${topCard.instanceId}`);
            }

            if (dragCard.length) {
                dragCard.addClass("dragging").removeClass("snapping");
                const maxZ = state.cards.length > 0 ? Math.max(...state.cards.map(c => c.z)) : 10;
                topCard.z = maxZ + 1;
                dragCard.css("z-index", topCard.z);

                const cardOffset = dragCard.offset();
                dragOffset.x = startPos.x - cardOffset.left;
                dragOffset.y = startPos.y - cardOffset.top;
                dragStartCoords = { x: startPos.x, y: startPos.y };
                dragStartTime = Date.now();
                return;
            }
        }

        // Otherwise, drag the empty/labeled pile zone itself!
        $(window).on("mousemove.pile_drag touchmove.pile_drag", function(me) {
            me.preventDefault();
            const pos = getEventCoords(me);
            const dx = pos.x - startPos.x;
            const dy = pos.y - startPos.y;

            let finalX = offset.left + dx;
            let finalY = offset.top + dy;

            // boundaries
            finalX = Math.max(10, Math.min(window.innerWidth - 90, finalX));
            finalY = Math.max(10, Math.min(window.innerHeight - 130, finalY));

            state.pileCoords[pileId].x = finalX;
            state.pileCoords[pileId].y = finalY;

            $pile.css({ left: `${finalX}px`, top: `${finalY}px` });
            renderAllCards();
        });

        $(window).on("mouseup.pile_drag touchend.pile_drag", function() {
            $(window).off(".pile_drag");
        });
    });

    // Click trigger on pile menu
    $(".pile-menu-trigger").off("click").on("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        const pileId = $(this).data("id");
        openPileActionMenu(pileId);
    });
}

// Render All Cards
function renderAllCards() {
    $("#field-cards-container").empty();
    $("#hand-p1").empty();
    $("#hand-p2").empty();

    // Attached cards logic inheritance
    state.cards.forEach(card => {
        if (card.attachedTo) {
            const parent = state.cards.find(c => c.instanceId === card.attachedTo);
            if (parent) {
                card.zone = parent.zone;
                card.faceDown = parent.faceDown;
            } else {
                card.attachedTo = null; // cleanup
            }
        }
        // Force hands to face-up
        if (card.zone.startsWith("hand_")) {
            card.faceDown = false;
            card.attachedTo = null;
        }
    });

    const zoneCounts = {};

    // Sort cards by z-index
    state.cards.sort((a, b) => a.z - b.z);

    state.cards.forEach(card => {
        if (card.attachedTo) return; // Cascades separately below

        const isHand = card.zone.startsWith("hand_");
        const isPile = card.zone.startsWith("deck_") || card.zone.startsWith("grave_") || card.zone.startsWith("banished_") || card.zone.startsWith("extra_");

        if (isPile) {
            zoneCounts[card.zone] = (zoneCounts[card.zone] || 0) + 1;
        }

        let handOverlayHTML = "";
        let fieldOverlayHTML = "";

        const attachedCount = state.cards.filter(c => c.attachedTo === card.instanceId).length;

        if (isHand) {
            handOverlayHTML = `
                <div class="hand-card-actions">
                    <button class="hand-action-btn btn-summon" data-instance-id="${card.instanceId}">Invocar</button>
                    ${state.layout === 'pokemon' ?
                        `<button class="hand-action-btn btn-activate" data-instance-id="${card.instanceId}">Activar</button>` :
                        `<button class="hand-action-btn btn-set" data-instance-id="${card.instanceId}">Set</button>`
                    }
                    <button class="hand-action-btn btn-attach" data-instance-id="${card.instanceId}">Acoplar</button>
                    <button class="hand-action-btn btn-grave" data-instance-id="${card.instanceId}">Descarte</button>
                    <button class="hand-action-btn btn-banish" data-instance-id="${card.instanceId}">Remover</button>
                    <button class="hand-action-btn btn-deck" data-instance-id="${card.instanceId}">Deck</button>
                </div>
            `;
        } else if (!isPile) {
            const returnLabel = card.isExtra ? "Deck" : "Mano";
            const isP2 = card.owner === "player2" || card.zone.endsWith("_2") || card.zone === "hand_2";
            const p2Class = isP2 ? "p2-card-actions" : "";
            fieldOverlayHTML = `
                <div class="field-card-actions ${p2Class}">
                    <button class="field-action-btn btn-field-attack" data-instance-id="${card.instanceId}">Atacar</button>
                    <button class="field-action-btn btn-field-direct" data-instance-id="${card.instanceId}">Atk Directo</button>
                    <button class="field-action-btn btn-field-flip" data-instance-id="${card.instanceId}">Voltear</button>
                    <button class="field-action-btn btn-field-tap" data-instance-id="${card.instanceId}">Girar</button>
                    <button class="field-action-btn btn-field-control" data-instance-id="${card.instanceId}">Control</button>
                    <button class="field-action-btn btn-field-attach" data-instance-id="${card.instanceId}">Acoplar</button>
                    <button class="field-action-btn btn-field-flash" data-instance-id="${card.instanceId}">Efecto</button>
                    <button class="field-action-btn btn-field-return" data-instance-id="${card.instanceId}">${returnLabel}</button>
                    <button class="field-action-btn btn-field-grave" data-instance-id="${card.instanceId}">Descarte</button>
                    <button class="field-action-btn btn-field-banish" data-instance-id="${card.instanceId}">Remover</button>
                </div>
            `;
        }

        const attachedBadgeHTML = attachedCount > 0 ? `<div class="card-attached-badge">📎${attachedCount}</div>` : "";
        const zStyle = isHand ? "" : `z-index: ${card.z};`;

        const cardHTML = `
            <div class="duel-card ${card.faceDown ? 'face-down' : ''} ${card.tapped ? 'tapped' : ''}"
                 id="${card.instanceId}"
                 data-instance-id="${card.instanceId}"
                 style="--tilt: ${card.tiltAngle || 0}deg; ${zStyle}">
                <div class="card-img-wrapper">
                    <img src="${card.imageUrl}" alt="${card.name}">
                </div>
                ${card.counters > 0 ? `<div class="card-counter">${card.counters}</div>` : ""}
                ${attachedBadgeHTML}
                ${handOverlayHTML}
                ${fieldOverlayHTML}
            </div>
        `;

        if (isHand) {
            const tray = card.zone === "hand_1" ? "#hand-p1" : "#hand-p2";
            $(tray).append(cardHTML);
        } else if (isPile) {
            // Only render top-most card of the pile
            const cardsInThisZone = state.cards.filter(c => c.zone === card.zone);
            const topCard = cardsInThisZone[cardsInThisZone.length - 1];

            if (topCard && topCard.instanceId === card.instanceId) {
                $("#field-cards-container").append(cardHTML);
                const pileCoords = state.pileCoords[card.zone];
                if (pileCoords) {
                    $(`#${card.instanceId}`).css({
                        left: `${pileCoords.x}px`,
                        top: `${pileCoords.y}px`
                    });
                }
            }
        } else {
            // Render free floating card on field
            $("#field-cards-container").append(cardHTML);
            $(`#${card.instanceId}`).css({
                left: `${card.x}px`,
                top: `${card.y}px`
            });

            // Cascaded attachments
            const attachedCards = state.cards.filter(c => c.attachedTo === card.instanceId);
            attachedCards.sort((a, b) => (a.attachedAt || 0) - (b.attachedAt || 0));

            let cumulativeOffset = 0;
            attachedCards.forEach((child, idx) => {
                if (idx < 2) cumulativeOffset += 14;
                const childZ = card.z - 14 * (idx + 1);

                const childHTML = `
                    <div class="duel-card attached-card-cascade ${child.faceDown ? 'face-down' : ''} ${child.tapped ? 'tapped' : ''}"
                         id="${child.instanceId}"
                         data-instance-id="${child.instanceId}"
                         data-parent-id="${card.instanceId}"
                         style="left: ${card.x + cumulativeOffset}px; top: ${card.y + cumulativeOffset}px; z-index: ${childZ}; --tilt: ${child.tiltAngle || 0}deg;">
                        <div class="card-img-wrapper">
                            <img src="${child.imageUrl}" alt="${child.name}">
                        </div>
                    </div>
                `;
                $("#field-cards-container").append(childHTML);
            });
        }
    });

    // Update pile badge counts
    const pileIds = ["deck_1", "extra_1", "grave_1", "banished_1", "deck_2", "extra_2", "grave_2", "banished_2"];
    pileIds.forEach(pId => {
        const count = zoneCounts[pId] || 0;
        $(`#count-${pId}`).text(count);
    });

    bindCardDragAndEvents();
}

// Bind Card Event Handlers
function bindCardDragAndEvents() {
    const cards = $(".duel-card");

    cards.off('mouseenter').on('mouseenter', function() {
        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (cardObj) {
            updatePreview(cardObj);
        }
    });

    // Hand Buttons click events
    $(".hand-action-btn").off("click").on("click", function(e) {
        e.preventDefault();
        e.stopPropagation();

        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (!cardObj) return;

        if ($(this).hasClass("btn-summon") || $(this).hasClass("btn-activate")) {
            startGraphicalTargeting(cardObj, "summon");
        } else if ($(this).hasClass("btn-set")) {
            startGraphicalTargeting(cardObj, "set");
        } else if ($(this).hasClass("btn-attach")) {
            startXYZTargeting(cardObj);
        } else if ($(this).hasClass("btn-grave")) {
            moveCardToPile(cardObj, `grave_${cardObj.owner === "player1" ? 1 : 2}`);
        } else if ($(this).hasClass("btn-banish")) {
            moveCardToPile(cardObj, `banished_${cardObj.owner === "player1" ? 1 : 2}`);
        } else if ($(this).hasClass("btn-deck")) {
            moveCardToPile(cardObj, `deck_${cardObj.owner === "player1" ? 1 : 2}`);
        }
    });

    // Field Buttons click events
    $(".field-action-btn").off("click").on("click", function(e) {
        e.preventDefault();
        e.stopPropagation();

        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (!cardObj) return;

        if ($(this).hasClass("btn-field-attack")) {
            window.activeAttackSourceCard = cardObj;
            $("#playmat").addClass("selecting-zone");
            logGameMessage(`🎯 Seleccionando objetivo para ataque con: ${cardObj.name}`);
        } else if ($(this).hasClass("btn-field-direct")) {
            logGameMessage(`⚔️ Direct Attack con ${cardObj.name}!`);
            createDirectAttackLine(cardObj);
        } else if ($(this).hasClass("btn-field-flip")) {
            cardObj.faceDown = !cardObj.faceDown;
            logGameMessage(`🔄 Volteó a ${cardObj.faceDown ? "Boca Abajo" : "Boca Arriba"} la carta: ${cardObj.name}`);
            renderAllCards();
        } else if ($(this).hasClass("btn-field-tap")) {
            cardObj.tapped = !cardObj.tapped;
            logGameMessage(`📐 Giró la carta: ${cardObj.name} a modo ${cardObj.tapped ? "Defensa / Horizontal" : "Vertical / Ataque"}`);
            renderAllCards();
        } else if ($(this).hasClass("btn-field-control")) {
            cardObj.controller = (cardObj.controller === "player1") ? "player2" : "player1";
            logGameMessage(`👑 Cambió control de: ${cardObj.name} al ${cardObj.controller === "player1" ? "Jugador 1" : "Jugador 2"}`);
            renderAllCards();
        } else if ($(this).hasClass("btn-field-attach")) {
            startXYZTargeting(cardObj);
        } else if ($(this).hasClass("btn-field-flash")) {
            triggerVfxFlash(cardObj.instanceId);
        } else if ($(this).hasClass("btn-field-return")) {
            const isHand = $(this).text().trim() === "Mano";
            if (isHand) {
                cardObj.zone = `hand_${cardObj.owner === "player1" ? 1 : 2}`;
                cardObj.controller = cardObj.owner;
                logGameMessage(`📥 Retornó a Mano la carta: ${cardObj.name}`);
            } else {
                moveCardToPile(cardObj, `deck_${cardObj.owner === "player1" ? 1 : 2}`);
            }
            renderAllCards();
        } else if ($(this).hasClass("btn-field-grave")) {
            moveCardToPile(cardObj, `grave_${cardObj.owner === "player1" ? 1 : 2}`);
        } else if ($(this).hasClass("btn-field-banish")) {
            moveCardToPile(cardObj, `banished_${cardObj.owner === "player1" ? 1 : 2}`);
        }
    });

    // Dragon/Dnd Physics engine mapping
    cards.off('mousedown touchstart').on('mousedown touchstart', function(e) {
        if ($(e.target).closest('.hand-card-actions, .field-card-actions, .field-action-btn, .hand-action-btn').length) {
            return;
        }

        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (!cardObj) return;

        // Interactive attack targeting clicking mechanics
        if ($("#playmat").hasClass("selecting-zone") && window.activeAttackSourceCard) {
            e.preventDefault();
            e.stopPropagation();

            if (instId !== window.activeAttackSourceCard.instanceId) {
                logGameMessage(`⚔️ Declaró ataque de ${window.activeAttackSourceCard.name} hacia ${cardObj.name}`);
                state.attacks.push({
                    attackerId: window.activeAttackSourceCard.instanceId,
                    targetId: cardObj.instanceId,
                    isDirect: false,
                    timestamp: Date.now()
                });
                drawAttackArrows();
                stopGraphicalTargeting();
            }
            return;
        }

        // Prevent dragging deck cards or attached cards directly
        if (cardObj.attachedTo) {
            // Redirect drag event to parent card instead!
            const parent = state.cards.find(c => c.instanceId === cardObj.attachedTo);
            if (parent) {
                openAttachedCardsModal(parent.instanceId);
            }
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        updatePreview(cardObj);

        dragCard = $(this);
        dragCard.addClass("dragging").removeClass("snapping");

        // Set top z-index physically
        const maxZ = state.cards.length > 0 ? Math.max(...state.cards.map(c => c.z)) : 10;
        cardObj.z = maxZ + 1;
        dragCard.css("z-index", cardObj.z);

        const pos = getEventCoords(e);
        const cardOffset = dragCard.offset();

        dragOffset.x = pos.x - cardOffset.left;
        dragOffset.y = pos.y - cardOffset.top;
        dragStartCoords = { x: pos.x, y: pos.y };
        dragStartTime = Date.now();
    });
}

// Window Arrastre Listeners
$(window).off("pointermove mousemove touchmove").on("mousemove touchmove", function(e) {
    if (!dragCard) return;
    e.preventDefault();

    const instId = dragCard.data("instance-id");
    const cardObj = state.cards.find(c => c.instanceId === instId);
    if (!cardObj) return;

    const pos = getEventCoords(e);
    const matOffset = $("#playmat").offset();

    const x = pos.x - matOffset.left - dragOffset.x;
    const y = pos.y - matOffset.top - dragOffset.y;

    // Boundary constraints
    const boundedX = Math.max(-10, Math.min(window.innerWidth - 70, x));
    const boundedY = Math.max(-10, Math.min(window.innerHeight - 100, y));

    cardObj.x = boundedX;
    cardObj.y = boundedY;

    dragCard.css({
        left: `${boundedX}px`,
        top: `${boundedY}px`
    });
});

$(window).off("pointerup mouseup touchend").on("mouseup touchend", function(e) {
    if (!dragCard) return;

    const instId = dragCard.data("instance-id");
    const cardObj = state.cards.find(c => c.instanceId === instId);
    if (!cardObj) return;

    const endPos = getEventCoords(e);
    const dx = endPos.x - dragStartCoords.x;
    const dy = endPos.y - dragStartCoords.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const duration = Date.now() - dragStartTime;

    const isClick = (dist < 15 && duration < 500);

    dragCard.removeClass("dragging").addClass("snapping");

    if (isClick) {
        // Toggle tilt on click
        const isField = !cardObj.zone.startsWith("hand_") && !cardObj.zone.startsWith("deck_") && !cardObj.zone.startsWith("extra_") && !cardObj.zone.startsWith("grave_") && !cardObj.zone.startsWith("banished_");
        if (isField) {
            const hasAttached = state.cards.some(c => c.attachedTo === cardObj.instanceId);
            if (hasAttached) {
                openAttachedCardsModal(cardObj.instanceId);
            } else {
                if (cardObj.tiltAngle && cardObj.tiltAngle !== 0) {
                    cardObj.tiltAngle = 0;
                } else {
                    const sign = Math.random() < 0.5 ? -1 : 1;
                    const angle = sign * (4 + Math.random() * 5);
                    cardObj.tiltAngle = Math.round(angle);
                }
            }
        }
    } else {
        // Card was dragged and dropped!
        const oldZone = cardObj.zone;

        // 1. Check if dropped over hand tray
        const isOverP1Hand = checkHandTrayHover(e, "#hand-tray-p1");
        const isOverP2Hand = checkHandTrayHover(e, "#hand-tray-p2");

        if (isOverP1Hand) {
            cardObj.zone = "hand_1";
            cardObj.controller = "player1";
            logGameMessage(`📥 Arrastró a Mano 1 la carta: ${cardObj.name}`);
        } else if (isOverP2Hand && hasPlayer2) {
            cardObj.zone = "hand_2";
            cardObj.controller = "player2";
            logGameMessage(`📥 Arrastró a Mano 2 la carta: ${cardObj.name}`);
        } else {
            // 2. Check if dropped over a pile zone
            const centerCoords = {
                x: cardObj.x + 40,
                y: cardObj.y + 58
            };
            const hitPileId = findOverlappingPile(centerCoords);

            if (hitPileId) {
                moveCardToPile(cardObj, hitPileId);
            } else {
                // 3. Check if dropped over another card to Attach
                const parentCard = findOverlappingCard(centerCoords, cardObj.instanceId);
                if (parentCard) {
                    // attach all attached materials as well
                    state.cards.forEach(c => {
                        if (c.attachedTo === cardObj.instanceId) {
                            c.attachedTo = parentCard.instanceId;
                        }
                    });

                    const maxZ = state.cards.length > 0 ? Math.max(...state.cards.map(c => c.z)) : 10;
                    parentCard.z = maxZ + 1;

                    cardObj.attachedTo = parentCard.instanceId;
                    cardObj.attachedAt = Date.now() + Math.random();
                    cardObj.zone = parentCard.zone;

                    logGameMessage(`📎 Acopló ${cardObj.name} debajo de ${parentCard.name}`);
                    Swal.fire({
                        icon: 'success',
                        title: 'Carta Acoplada',
                        text: `${cardObj.name} acoplada a ${parentCard.name}.`,
                        toast: true,
                        position: 'top-end',
                        timer: 1500,
                        showConfirmButton: false
                    });
                } else {
                    // Dropped freely on field
                    cardObj.zone = "field_free";
                    cardObj.attachedTo = null;
                }
            }
        }
    }

    dragCard = null;
    renderAllCards();
});

// Coordinate helper
function getEventCoords(e) {
    if (e.type.startsWith('touch')) {
        const t = e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
        return { x: t.clientX, y: t.clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

// Bounding box checks
function checkHandTrayHover(e, selector) {
    const $tray = $(selector);
    if (!$tray.length || $tray.hasClass("collapsed")) return false;

    const coords = getEventCoords(e);
    const offset = $tray.offset();
    const w = $tray.width();
    const h = $tray.height();

    return (coords.x >= offset.left && coords.x <= offset.left + w &&
            coords.y >= offset.top && coords.y <= offset.top + h);
}

// Overlapping piles checker
function findOverlappingPile(coords) {
    const pileKeys = Object.keys(state.pileCoords);
    for (let i = 0; i < pileKeys.length; i++) {
        const key = pileKeys[i];
        if (!hasPlayer2 && key.endsWith("_2")) continue; // ignore disabled P2 piles

        const pc = state.pileCoords[key];
        // Pile is 80x116
        if (coords.x >= pc.x && coords.x <= pc.x + 80 &&
            coords.y >= pc.y && coords.y <= pc.y + 116) {
            return key;
        }
    }
    return null;
}

// Overlapping card checker
function findOverlappingCard(coords, excludeId) {
    const candidates = state.cards.filter(c =>
        c.instanceId !== excludeId &&
        !c.attachedTo &&
        !c.zone.startsWith("hand_") &&
        !c.zone.startsWith("deck_") &&
        !c.zone.startsWith("extra_") &&
        !c.zone.startsWith("grave_") &&
        !c.zone.startsWith("banished_")
    );

    for (let i = candidates.length - 1; i >= 0; i--) {
        const c = candidates[i];
        const $el = $(`#${c.instanceId}`);
        if ($el.length) {
            const offset = $el.offset();
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

// Move card to specific pile (and send attached cards to grave)
function moveCardToPile(cardObj, pileId) {
    const suffix = cardObj.owner === "player1" ? 1 : 2;

    // Send any attached cards to Graveyard
    const attached = state.cards.filter(c => c.attachedTo === cardObj.instanceId);
    attached.forEach(c => {
        c.attachedTo = null;
        c.zone = `grave_${suffix}`;
        c.movedToPileAt = Date.now() + Math.random();
    });

    cardObj.zone = pileId;
    cardObj.attachedTo = null;
    cardObj.movedToPileAt = Date.now() + Math.random();

    logGameMessage(`📦 Envió a ${pileId.toUpperCase()} la carta: ${cardObj.name}`);
}

// Anti-cheat detailed sidebar previewer
function updatePreview(card) {
    const isPile = card.zone.startsWith("deck_") || card.zone.startsWith("extra_") || card.zone.startsWith("grave_") || card.zone.startsWith("banished_");
    let isFaceDown = card.faceDown && !card.zone.startsWith("hand_");

    if (isFaceDown && card.owner === "player1" && !isPile) {
        isFaceDown = false; // Player 1 can view its own face-down field cards
    }

    if (isPile || isFaceDown) {
        const backImg = state.layout === "pokemon" ? "img/pokeBocaAbajo.jpg" : "img/bocabajo.jpg";
        $("#detail-card-img").attr("src", backImg);
        $("#detail-card-name").text("Carta Oculta");
        $("#detail-card-desc").text(`Propietario: ${card.owner === "player1" ? "Jugador 1" : "Jugador 2"}\nZona: ${card.zone.toUpperCase()}\n\n[Contenido oculto en pilas/boca-abajo]`);
    } else {
        $("#detail-card-img").attr("src", card.imageUrl);
        $("#detail-card-name").text(card.name);
        let desc = `Propietario: ${card.owner === "player1" ? "Jugador 1" : "Jugador 2"}\nZona: ${card.zone.toUpperCase()}\nEstado: ${card.faceDown ? "Boca Abajo (Revelada)" : "Boca Arriba"}\nContadores: ${card.counters}`;
        if (card.description) {
            desc += `\n\nEfecto:\n${card.description}`;
        }
        $("#detail-card-desc").text(desc);
    }
}

// Graphical click-to-place summoning targeting
function startGraphicalTargeting(cardObj, actionType) {
    targetingCard = cardObj;
    targetActionType = actionType;

    $("#zone-picker-overlay").fadeIn(150).css("display", "flex");
    $("#playmat").addClass("selecting-zone");

    // Click on playmat to summon
    $("#playmat").off("click.targeting").on("click.targeting", function(e) {
        if ($(e.target).closest(".magic-pile-zone").length) return; // avoid pile zone collision clicks
        e.preventDefault();
        e.stopPropagation();

        const offset = $(this).offset();
        const clickX = e.clientX - offset.left;
        const clickY = e.clientY - offset.top;

        if (targetingCard) {
            targetingCard.zone = "field_free";
            targetingCard.x = Math.max(10, Math.min(window.innerWidth - 90, clickX - 40));
            targetingCard.y = Math.max(10, Math.min(window.innerHeight - 130, clickY - 58));
            targetingCard.attachedTo = null;

            if (targetActionType === "set") {
                targetingCard.faceDown = true;
                targetingCard.tapped = true;
            } else {
                targetingCard.faceDown = false;
                targetingCard.tapped = false;
            }

            logGameMessage(`🚀 Colocó libremente en el campo (${targetingCard.x}x, ${targetingCard.y}y): ${targetingCard.name}`);
            renderAllCards();
        }

        stopGraphicalTargeting();
    });
}

function stopGraphicalTargeting() {
    targetingCard = null;
    targetActionType = null;
    $("#zone-picker-overlay").fadeOut(150);
    $("#playmat").removeClass("selecting-zone");
    $("#playmat").off("click.targeting");
    window.activeAttackSourceCard = null;
}

// Card Attachment mode
function startXYZTargeting(cardObj) {
    xyzCard = cardObj;

    Swal.fire({
        icon: 'info',
        title: 'Acoplar Carta',
        text: 'Haz clic en la carta destino en el campo para acoplar esta debajo.',
        toast: true,
        position: 'top-end',
        timer: 3000,
        showConfirmButton: false
    });

    $("#playmat").addClass("selecting-zone");

    // Bind temporary click onto any field card
    setTimeout(() => {
        $(".duel-card").off("click.xyz").on("click.xyz", function(e) {
            e.preventDefault();
            e.stopPropagation();

            const targetId = $(this).data("instance-id");
            const targetObj = state.cards.find(c => c.instanceId === targetId);

            if (targetObj && xyzCard && targetObj.instanceId !== xyzCard.instanceId) {
                // transfer attached cards
                state.cards.forEach(c => {
                    if (c.attachedTo === xyzCard.instanceId) {
                        c.attachedTo = targetObj.instanceId;
                    }
                });

                xyzCard.attachedTo = targetObj.instanceId;
                xyzCard.attachedAt = Date.now() + Math.random();
                xyzCard.zone = targetObj.zone;

                logGameMessage(`📎 Acopló ${xyzCard.name} debajo de ${targetObj.name}`);
                renderAllCards();
            }

            $("#playmat").removeClass("selecting-zone");
            $(".duel-card").off("click.xyz");
            xyzCard = null;
        });
    }, 100);
}

// Access-menu on piles click
function openPileActionMenu(pileId) {
    const isP1 = pileId.endsWith("_1");
    const playerKey = isP1 ? "player1" : "player2";
    const title = pileId.toUpperCase().replace("_", " ");

    let menuHTML = `<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">`;

    if (pileId.startsWith("deck_")) {
        menuHTML += `
            <button class="btn-play btn-play-practice" onclick="drawCardFromDeck('${playerKey}')">Robar 1 Carta</button>
            <button class="btn-play btn-play-practice" onclick="drawFiveFromDeck('${playerKey}')">Robar 5 Cartas</button>
            <button class="btn-play btn-play-practice" onclick="shuffleDeck('${playerKey}')">Barajar Mazo</button>
            <button class="btn-play btn-play-practice" onclick="openSearchModal('${pileId}')">Ver / Buscar en Deck</button>
            ${state.layout === 'pokemon' ? `<button class="btn-play btn-play-practice" onclick="setupPokemonPrizes('${playerKey}')">Colocar Premios (6 Cartas)</button>` : ""}
        `;
    } else {
        menuHTML += `
            <button class="btn-play btn-play-practice" onclick="openSearchModal('${pileId}')">Ver / Buscar en ${title}</button>
        `;
    }

    menuHTML += `</div>`;

    Swal.fire({
        title: `Menú ${title}`,
        html: menuHTML,
        showConfirmButton: false,
        showCloseButton: true
    });
}

// Robar cards
window.drawCardFromDeck = function(playerKey) {
    Swal.close();
    const suffix = playerKey === "player1" ? 1 : 2;
    const deckZone = `deck_${suffix}`;
    const deckCards = state.cards.filter(c => c.zone === deckZone);

    if (deckCards.length === 0) {
        Swal.fire("Mazo vacío", "No quedan cartas en el Deck.", "warning");
        return;
    }

    // Top card is last element
    const cardObj = deckCards[deckCards.length - 1];
    cardObj.zone = `hand_${suffix}`;
    cardObj.controller = playerKey;
    cardObj.faceDown = false;

    logGameMessage(`🃏 Robó 1 carta del Deck: ${cardObj.name}`);
    renderAllCards();
};

window.drawFiveFromDeck = function(playerKey) {
    Swal.close();
    const suffix = playerKey === "player1" ? 1 : 2;
    const deckZone = `deck_${suffix}`;

    for (let i = 0; i < 5; i++) {
        const deckCards = state.cards.filter(c => c.zone === deckZone);
        if (deckCards.length === 0) break;
        const cardObj = deckCards[deckCards.length - 1];
        cardObj.zone = `hand_${suffix}`;
        cardObj.controller = playerKey;
        cardObj.faceDown = false;
    }

    logGameMessage(`🃏 Robó 5 cartas de su Deck.`);
    renderAllCards();
};

window.shuffleDeck = function(playerKey) {
    Swal.close();
    shuffleDeckSilent(playerKey);
    logGameMessage(`🔀 Barajó el Deck.`);
    Swal.fire({
        icon: 'success',
        title: 'Mazo Barajado',
        toast: true,
        position: 'top-end',
        timer: 1500,
        showConfirmButton: false
    });
};

function shuffleDeckSilent(playerKey) {
    const suffix = playerKey === "player1" ? 1 : 2;
    const deckZone = `deck_${suffix}`;
    const deckCards = state.cards.filter(c => c.zone === deckZone);

    for (let i = deckCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tempZ = deckCards[i].z;
        deckCards[i].z = deckCards[j].z;
        deckCards[j].z = tempZ;
    }
}

// Pokemon setup prizes
window.setupPokemonPrizes = function(playerKey) {
    Swal.close();
    const suffix = playerKey === "player1" ? 1 : 2;
    const deckCards = state.cards.filter(c => c.zone === `deck_${suffix}`);

    if (deckCards.length < 6) {
        Swal.fire("Cartas insuficientes", "No hay suficientes cartas para colocar los premios.", "warning");
        return;
    }

    // Draw top 6 as prizes
    for (let i = 0; i < 6; i++) {
        const cardObj = deckCards[deckCards.length - 1 - i];
        cardObj.zone = `field_free`; // Place them on field freely
        cardObj.faceDown = true;
        // spread coordinates nicely
        cardObj.x = suffix === 1 ? 50 + i * 25 : window.innerWidth - 200 - i * 25;
        cardObj.y = suffix === 1 ? window.innerHeight - 450 : 250;
    }

    logGameMessage(`🎁 Colocó 6 Premios boca abajo en la arena.`);
    renderAllCards();
};

// Interactive Search Modal inside piles
window.openSearchModal = function(pileId) {
    Swal.close();
    const title = pileId.toUpperCase().replace("_", " ");
    $("#pile-modal-title").text(`Buscador: ${title}`);

    // Grab all cards in this pile
    const pileCards = state.cards.filter(c => c.zone === pileId);
    pileCards.sort((a, b) => (b.movedToPileAt || 0) - (a.movedToPileAt || 0));

    const $grid = $("#pile-cards-grid");
    $grid.empty();

    if (pileCards.length === 0) {
        $grid.append(`<div style="color: #666; font-style: italic; width: 100%; text-align: center; padding: 20px;">Esta pila está vacía.</div>`);
    } else {
        pileCards.forEach(card => {
            $grid.append(`
                <div class="search-card-item" style="display: flex; flex-direction: column; align-items: center; gap: 8px; background: rgba(255,255,255,0.02); padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
                    <img src="${card.imageUrl}" style="width: 100px; border-radius: 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);" />
                    <span style="font-size: 0.75rem; text-align: center; font-weight: bold; height: 32px; overflow: hidden; text-overflow: ellipsis;">${card.name}</span>
                    <div style="display: flex; gap: 5px; width: 100%; justify-content: center; flex-wrap: wrap;">
                        <button class="lp-widget-btn" onclick="retrieveCardFromPile('${card.instanceId}', 'hand')" style="font-size:0.65rem; padding: 2px 6px;">Mano</button>
                        <button class="lp-widget-btn" onclick="retrieveCardFromPile('${card.instanceId}', 'summon')" style="font-size:0.65rem; padding: 2px 6px;">Invocar</button>
                    </div>
                </div>
            `);
        });
    }

    $("#pile-overlay").fadeIn(150);
};

window.retrieveCardFromPile = function(instanceId, action) {
    const cardObj = state.cards.find(c => c.instanceId === instanceId);
    if (!cardObj) return;

    $("#pile-overlay").fadeOut(150);

    const suffix = cardObj.owner === "player1" ? 1 : 2;

    if (action === "hand") {
        cardObj.zone = `hand_${suffix}`;
        cardObj.controller = cardObj.owner;
        cardObj.faceDown = false;
        logGameMessage(`📥 Añadió a Mano la carta: ${cardObj.name} desde la pila.`);
        renderAllCards();
    } else if (action === "summon") {
        startGraphicalTargeting(cardObj, "summon");
    }
};

// Attached materials list modal
function openAttachedCardsModal(parentId) {
    const parent = state.cards.find(c => c.instanceId === parentId);
    if (!parent) return;

    $("#attached-modal-title").text(`Materiales: ${parent.name}`);

    const attached = state.cards.filter(c => c.attachedTo === parentId);
    const $grid = $("#attached-cards-grid");
    $grid.empty();

    attached.forEach(card => {
        $grid.append(`
            <div class="search-card-item" style="display: flex; flex-direction: column; align-items: center; gap: 8px; background: rgba(255,255,255,0.02); padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
                <img src="${card.imageUrl}" style="width: 100px; border-radius: 6px;" />
                <span style="font-size: 0.75rem; text-align: center; font-weight: bold;">${card.name}</span>
                <div style="display: flex; gap: 5px; width: 100%; justify-content: center;">
                    <button class="lp-widget-btn" onclick="detachIndividualCard('${card.instanceId}', 'hand')" style="font-size:0.65rem; padding: 2px 6px;">Mano</button>
                    <button class="lp-widget-btn" onclick="detachIndividualCard('${card.instanceId}', 'grave')" style="font-size:0.65rem; padding: 2px 6px;">Cementerio</button>
                </div>
            </div>
        `);
    });

    // Bulk actions
    $("#bulk-to-hand").off("click").on("click", () => {
        attached.forEach(c => {
            c.attachedTo = null;
            c.zone = `hand_${c.owner === "player1" ? 1 : 2}`;
        });
        $("#attached-overlay").fadeOut(150);
        logGameMessage(`📥 Desacopló todos los materiales a la Mano de: ${parent.name}`);
        renderAllCards();
    });

    $("#bulk-to-grave").off("click").on("click", () => {
        attached.forEach(c => {
            c.attachedTo = null;
            c.zone = `grave_${c.owner === "player1" ? 1 : 2}`;
            c.movedToPileAt = Date.now() + Math.random();
        });
        $("#attached-overlay").fadeOut(150);
        logGameMessage(`📥 Desacopló todos los materiales al Descarte de: ${parent.name}`);
        renderAllCards();
    });

    $("#attached-overlay").fadeIn(150);
}

window.detachIndividualCard = function(instanceId, dest) {
    const cardObj = state.cards.find(c => c.instanceId === instanceId);
    if (!cardObj) return;

    $("#attached-overlay").fadeOut(150);
    cardObj.attachedTo = null;

    if (dest === "hand") {
        cardObj.zone = `hand_${cardObj.owner === "player1" ? 1 : 2}`;
        logGameMessage(`📥 Desacopló y regresó a mano la carta: ${cardObj.name}`);
    } else {
        cardObj.zone = `grave_${cardObj.owner === "player1" ? 1 : 2}`;
        cardObj.movedToPileAt = Date.now() + Math.random();
        logGameMessage(`📥 Desacopló y envió al Cementerio la carta: ${cardObj.name}`);
    }
    renderAllCards();
};

// Floating LP Trackers logic
function setupLPTrackers() {
    $(".lp-widget-btn").click(function() {
        const player = $(this).data("player"); // p1, p2
        const suffix = player === "p1" ? 1 : 2;
        const calcVal = parseInt($(`#lp-calc-${player}`).val()) || 0;
        const currentLP = parseInt($(`#lp-display-${player}`).text()) || 0;

        let finalLP = currentLP;

        if ($(this).hasClass("lp-btn-add")) {
            finalLP = currentLP + calcVal;
            logGameMessage(`💚 Jugador ${suffix} aumentó LP: +${calcVal} (${finalLP})`);
        } else if ($(this).hasClass("lp-btn-sub")) {
            finalLP = Math.max(0, currentLP - calcVal);
            logGameMessage(`💔 Jugador ${suffix} restó LP: -${calcVal} (${finalLP})`);
        } else if ($(this).hasClass("lp-btn-half")) {
            finalLP = Math.round(currentLP / 2);
            logGameMessage(`💔 Jugador ${suffix} dividió sus LP a la mitad (${finalLP})`);
        }

        $(`#lp-display-${player}`).text(finalLP);
        $(`#lp-calc-${player}`).val("");
    });
}

// Spawner Accessories & Tokens
function setupAccessories() {
    // 1. Spawner Tokens (YGOPRODeck)
    let cachedTokens = [];
    async function fetchTokens() {
        try {
            const res = await fetch("https://db.ygoprodeck.com/api/v7/cardinfo.php?type=Token");
            const data = await res.json();
            if (data && data.data) cachedTokens = data.data;
        } catch (e) {
            console.warn("Could not fetch tokens list from YGOPRODeck:", e);
        }
    }
    fetchTokens();

    $("#btn-spawn-token").click(function() {
        let tName = "Monster Token";
        let tImg = "https://images.ygoprodeck.com/images/cards/10000000.jpg";
        let tDesc = "Token invocado de forma especial.";

        if (cachedTokens.length > 0) {
            const random = cachedTokens[Math.floor(Math.random() * cachedTokens.length)];
            tName = random.name;
            tImg = random.card_images[0].image_url;
            tDesc = random.desc || "Token Especial.";
        }

        const newToken = {
            instanceId: `token_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            name: tName,
            imageUrl: tImg,
            owner: "player1",
            controller: "player1",
            zone: "field_free",
            faceDown: false,
            tapped: false,
            counters: 0,
            attachedTo: null,
            x: 100,
            y: 100,
            z: state.cards.length + 1,
            isExtra: false,
            description: tDesc
        };

        state.cards.push(newToken);
        startGraphicalTargeting(newToken, "summon");
        logGameMessage(`🌟 Invocando de Forma Especial Token: ${tName}`);
    });

    // 2. Roll 3D Dice / Coins
    $("#btn-roll-dice").click(function() {
        const result = Math.floor(Math.random() * 6) + 1;
        logGameMessage(`🎲 Dado: Salió un magnífico ${result}`);
        Swal.fire({
            title: `Dado: ${result}`,
            text: `¡Salió el número ${result}!`,
            icon: 'info',
            timer: 1500,
            showConfirmButton: false
        });
    });

    $("#btn-flip-coin").click(function() {
        const isHeads = Math.random() < 0.5;
        const result = isHeads ? "CARA" : "CRUZ";
        logGameMessage(`🪙 Moneda: Salió ${result}`);
        Swal.fire({
            title: `Moneda: ${result}`,
            text: `¡Salió ${result}!`,
            icon: 'info',
            timer: 1500,
            showConfirmButton: false
        });
    });

    // 3. Counter Generation
    $(".btn-add-glass-counter").click(function() {
        Swal.fire({
            icon: 'info',
            title: 'Agregar Contadores (YGO)',
            text: 'Haz clic en cualquier carta del campo para agregarle un contador de vidrio cian.',
            toast: true,
            position: 'top-end',
            timer: 3000,
            showConfirmButton: false
        });

        $(".duel-card").off("click.counter").on("click.counter", function(e) {
            e.preventDefault();
            e.stopPropagation();

            const instId = $(this).data("instance-id");
            const cardObj = state.cards.find(c => c.instanceId === instId);
            if (cardObj) {
                cardObj.counters = (cardObj.counters || 0) + 1;
                logGameMessage(`💎 Agregó 1 contador a ${cardObj.name} (Total: ${cardObj.counters})`);
                renderAllCards();
            }

            $(".duel-card").off("click.counter");
        });
    });

    $(".btn-add-poke-counter").click(function() {
        Swal.fire({
            icon: 'info',
            title: 'Agregar Daño Pokémon',
            text: 'Haz clic en una carta del campo para sumarle +10 de daño.',
            toast: true,
            position: 'top-end',
            timer: 3000,
            showConfirmButton: false
        });

        $(".duel-card").off("click.counter").on("click.counter", function(e) {
            e.preventDefault();
            e.stopPropagation();

            const instId = $(this).data("instance-id");
            const cardObj = state.cards.find(c => c.instanceId === instId);
            if (cardObj) {
                cardObj.counters = (cardObj.counters || 0) + 10;
                logGameMessage(`🩹 Agregó +10 de Daño a ${cardObj.name} (Total Daño: ${cardObj.counters})`);
                renderAllCards();
            }

            $(".duel-card").off("click.counter");
        });
    });

    // Toggle counters on field cards directly to heal/remove counters
    $(document).on("click", ".card-counter", function(e) {
        e.preventDefault();
        e.stopPropagation();

        const instId = $(this).closest(".duel-card").data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (cardObj) {
            if (state.layout === "pokemon") {
                cardObj.counters = Math.max(0, cardObj.counters - 10);
                logGameMessage(`❤️ Curó -10 de Daño a ${cardObj.name} (Total Daño: ${cardObj.counters})`);
            } else {
                cardObj.counters = Math.max(0, cardObj.counters - 1);
                logGameMessage(`💎 Removió 1 contador de ${cardObj.name} (Total: ${cardObj.counters})`);
            }
            renderAllCards();
        }
    });

    // Toggle accessories collapsible menu
    $("#toggle-acc-btn").click(function() {
        $("#acc-body-container").toggle(200);
        $(this).toggleClass("collapsed");
    });
}

// Log actions
function logGameMessage(msg) {
    const $container = $("#game-log-messages");
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    $container.append(`
        <div class="log-message">
            <span class="log-time">[${timestamp}]</span> ${msg}
        </div>
    `);
    // auto scroll
    $container.scrollTop($container[0].scrollHeight);
}

// Direct attack visual canvas indicator
function createDirectAttackLine(cardObj) {
    const $overlay = $("#attack-arrows-overlay");
    $overlay.empty();

    const $card = $(`#${cardObj.instanceId}`);
    if (!$card.length) return;

    const offset = $card.offset();
    const startX = offset.left + 40;
    const startY = offset.top + 58;

    // Direct attacks flow to top border
    const endX = startX;
    const endY = 20;

    $overlay.append(`
        <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}"
              stroke="#ff1b6b" stroke-width="4" stroke-dasharray="8 6"
              style="filter: drop-shadow(0 0 8px rgba(255, 27, 107, 0.85)); animation: flowAttack 1s linear infinite;" />
        <circle cx="${endX}" cy="${endY}" r="10" fill="#ff1b6b"
                style="filter: drop-shadow(0 0 10px rgba(255, 27, 107, 0.9));" />
    `);

    setTimeout(() => { $overlay.empty(); }, 8000);
}

// Multi-targeting attack arrows renderer
function drawAttackArrows() {
    const $overlay = $("#attack-arrows-overlay");
    $overlay.empty();

    state.attacks.forEach(atk => {
        const $att = $(`#${atk.attackerId}`);
        const $tar = $(`#${atk.targetId}`);

        if ($att.length && $tar.length) {
            const attOff = $att.offset();
            const tarOff = $tar.offset();

            const x1 = attOff.left + 40;
            const y1 = attOff.top + 58;
            const x2 = tarOff.left + 40;
            const y2 = tarOff.top + 58;

            $overlay.append(`
                <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                      stroke="#00d2ff" stroke-width="4" stroke-dasharray="8 6"
                      style="filter: drop-shadow(0 0 8px rgba(0, 210, 255, 0.85)); animation: flowAttack 1s linear infinite;" />
                <polygon points="${x2},${y2} ${x2-8},${y2-14} ${x2+8},${y2-14}" fill="#00d2ff"
                         transform="rotate(${Math.atan2(y2-y1, x2-x1)*180/Math.PI + 90} ${x2} ${y2})"
                         style="filter: drop-shadow(0 0 6px rgba(0, 210, 255, 0.9));" />
            `);
        }
    });
}

// Flash visual effect
function triggerVfxFlash(id) {
    const $el = $(`#${id}`);
    if (!$el.length) return;

    $el.addClass("vfx-flash-active");
    logGameMessage(`✨ Activó Efecto Visual Destello en la carta.`);
    setTimeout(() => { $el.removeClass("vfx-flash-active"); }, 1200);
}
