// Magic Mode: Free Sandbox Duel Engine
// 100% Free-form positioning, dragging, attaching, and local gameplay testing.

const HIGH_FIDELITY_MOCKS = [
    { name: "Dragón Blanco de Ojos Azules", image_url: "https://images.ygoprodeck.com/images/cards/89631139.jpg", section: "Main", desc: "Este legendario dragón es una poderosa máquina de destrucción. Prácticamente invencible, muy pocos se han enfrentado a esta magnífica criatura y han vivido para contarlo." },
    { name: "Mago Oscuro", image_url: "https://images.ygoprodeck.com/images/cards/46986414.jpg", section: "Main", desc: "El más grande de los magos en lo referente al ataque y la defensa." },
    { name: "Chica Maga Oscura", image_url: "https://images.ygoprodeck.com/images/cards/31755083.jpg", section: "Main", desc: "Gana 300 ATK por cada 'Mago Oscuro' o 'Mago de la Ilusión Negra' en los Cementerios." },
    { name: "Dragón Negro de Ojos Rojos", image_url: "https://images.ygoprodeck.com/images/cards/74677422.jpg", section: "Main", desc: "Un dragón feroz con un ataque mortífero." },
    { name: "Olla de la Codicia", image_url: "https://images.ygoprodeck.com/images/cards/55144522.jpg", section: "Main", desc: "Roba 2 cartas de tu Deck." },
    { name: "Fuerza de Espejo", image_url: "https://images.ygoprodeck.com/images/cards/44095762.jpg", section: "Main", desc: "Cuando un monstruo del adversario declara un ataque: destruye todos los monstruos en Posición de Ataque de tu adversario." },
    { name: "Monstruo Renacido", image_url: "https://images.ygoprodeck.com/images/cards/83764718.jpg", section: "Main", desc: "Selecciona 1 monstruo en cualquier Cementerio; Invócalo de Modo Especial." },
    { name: "Tifón del Espacio Místico", image_url: "https://images.ygoprodeck.com/images/cards/05318639.jpg", section: "Main", desc: "Selecciona 1 Carta de Magia/Trampa en el Campo; destrúyela." },
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
    layout: "yugioh",
    mode: "practice",
    cards: [],
    decks: { player1: [], player2: [] },
    attacks: [],
    viewPerspective: "player1"
};

let hasPlayer2 = false, dragCard = null, targetingCard = null, couplingSourceCard = null, xyzSummonSourceCard = null;
const dragOffset = { x: 0, y: 0 }, dragStartCoords = { x: 0, y: 0 };
let dragStartTime = 0;

$(document).ready(async function() {
    const urlParams = new URLSearchParams(window.location.search);
    state.layout = urlParams.get("layout") || "yugioh";
    state.mode = urlParams.get("mode") || "practice";
    hasPlayer2 = (urlParams.get("deck2") && urlParams.get("deck2") !== "none");

    if (state.layout === "pokemon") {
        $("body").addClass("layout-pokemon").removeClass("layout-yugioh");
        $("#zone-prizes-p1").css("display", "flex");
        if (hasPlayer2) $("#zone-prizes-p2").css("display", "flex");
        $(".floating-lp-widget").hide();
    } else {
        $("body").addClass("layout-yugioh").removeClass("layout-pokemon");
        $(".floating-lp-widget").show();
    }

    $(".perspective-switcher").toggle(state.mode !== "practice");
    if (hasPlayer2) {
        $("#zone-hand-p2, #zone-grave-p2, #zone-banish-p2").css("display", "flex");
    }

    $("#detail-card-img").attr("src", state.layout === "pokemon" ? "img/pokeBocaAbajo.jpg" : "img/bocabajo.jpg");

    initializePiles();
    setupAccessories();
    setupLPTrackers();
    setupCardInteractions();
    setupGlobalEvents();
    makeLandingZonesDraggableAndResizable();
    bindDropdownContextMenus();
    bindBatchSelectionHandlers();
    setupPerspectiveSwitcher();
    bindAttachmentHandlers();

    Swal.fire({ title: 'Cargando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const defaultMocks = (state.layout === "pokemon") ? POKE_MOCKS : HIGH_FIDELITY_MOCKS;
        if (urlParams.get("deck1") && urlParams.get("deck1") !== "mock") {
            await fetchDeckCards(urlParams.get("deck1"), "player1");
        } else {
            state.decks.player1 = JSON.parse(JSON.stringify(defaultMocks));
        }
        if (hasPlayer2) {
            if (urlParams.get("deck2") !== "mock") {
                await fetchDeckCards(urlParams.get("deck2"), "player2");
            } else {
                state.decks.player2 = JSON.parse(JSON.stringify(defaultMocks));
            }
        }
        shuffleDeck("player1");
        if (hasPlayer2) shuffleDeck("player2");
        Swal.close();
        renderAllCards();
    } catch (e) {
        console.error(e);
        Swal.fire('Error', 'Error al cargar decks.', 'error');
    }
});

async function fetchDeckCards(deckId, playerKey) {
    const { data: deckCards, error: deckErr } = await _supabase.from('deck_cards').select('*').eq('deck_id', deckId);
    if (deckErr) throw deckErr;
    if (!deckCards || deckCards.length === 0) {
        state.decks[playerKey] = JSON.parse(JSON.stringify(state.layout === "pokemon" ? POKE_MOCKS : HIGH_FIDELITY_MOCKS));
        return;
    }
    state.decks[playerKey] = deckCards.map(item => ({
        name: item.name,
        image_url: item.image_url || "https://via.placeholder.com/150x218?text=Vikingdev+TCG",
        section: item.section || "Main",
        desc: item.description || item.effect || item.desc || ""
    }));
}

function initializePiles() {
    const $container = $("#piles-container").empty();
    const width = window.innerWidth, height = window.innerHeight;
    createPileElement($container, "deck_1", "Main J1", 35, height - 170, "player1", "deck");
    if (state.layout !== "pokemon") {
        createPileElement($container, "extra_1", "Extra J1", 35, height - 340, "player1", "extra");
    }
    if (hasPlayer2) {
        createPileElement($container, "deck_2", "Main J2", width - 530, 25, "player2", "deck");
        if (state.layout !== "pokemon") {
            createPileElement($container, "extra_2", "Extra J2", width - 530, 195, "player2", "extra");
        }
    }
    updatePileCounts();
}

function createPileElement($parent, id, label, x, y, owner, type) {
    $parent.append(`
        <div class="magic-pile-zone ${owner === "player1" ? "p1-pile" : "p2-pile"}" id="zone-${id}" style="left: ${x}px; top: ${y}px; width: 95px; height: 138px;">
            <i class="fas fa-arrows-alt pile-drag-handle" style="position: absolute; top: 10px; left: 10px; color: rgba(255,255,255,0.4); cursor: move; font-size: 0.85rem; z-index: 405;"></i>
            <div class="pile-count-badge" id="count-${id}">0</div>
            <div class="pile-label" style="font-size: 0.6rem; margin-top: 10px;">${label}</div>
            <button class="pile-menu-trigger" data-pile="${id}" style="font-size: 0.6rem; padding: 2px 4px; bottom: 5px;"><i class="fas fa-ellipsis-h"></i> Acciones</button>
        </div>
    `);
    const $el = $(`#zone-${id}`);
    $el.on("mousedown touchstart", function(e) {
        if ($(e.target).hasClass("pile-menu-trigger") || $(e.target).closest(".pile-menu-trigger").length) return;
        const clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;
        const isHandle = $(e.target).hasClass("pile-drag-handle") || $(e.target).closest(".pile-drag-handle").length;

        if (isHandle) {
            e.preventDefault();
            const offset = $el.offset();
            const deltaX = clientX - offset.left, deltaY = clientY - offset.top;
            $(document).on("mousemove.piledrag touchmove.piledrag", function(moveEvent) {
                const mX = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientX : moveEvent.clientX;
                const mY = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientY : moveEvent.clientY;
                $el.css({ left: Math.max(10, Math.min(window.innerWidth - 110, mX - deltaX)), top: Math.max(10, Math.min(window.innerHeight - 150, mY - deltaY)) });
            }).on("mouseup.piledrag touchend.piledrag", () => $(document).off(".piledrag"));
            return;
        }

        if (type === "deck") {
            e.preventDefault();
            const deck = state.decks[owner], mainCards = deck.filter(c => c.section !== "Extra");
            if (mainCards.length === 0) return Swal.fire('Deck Vacío', '', 'warning');
            const cardData = deck.splice(deck.findIndex(c => c.section !== "Extra"), 1)[0];
            const cardId = "card_" + Math.random().toString(36).substr(2, 9);
            const offset = $el.offset();

            const newCard = { id: cardId, name: cardData.name, image_url: cardData.image_url, desc: cardData.desc || "", x: offset.left, y: offset.top, faceUp: true, tapped: false, counters: { glass: 0, poke: 0 }, owner, section: "Main", attachedTo: null };
            state.cards.push(newCard);
            renderAllCards();
            updatePileCounts();

            dragCard = newCard;
            const $cardEl = $(`#${cardId}`).addClass("dragging");
            dragOffset.x = clientX - dragCard.x;
            dragOffset.y = clientY - dragCard.y;

            $(document).on("mousemove.carddrag touchmove.carddrag", function(moveEvent) {
                if (!dragCard) return;
                const mX = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientX : moveEvent.clientX;
                const mY = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientY : moveEvent.clientY;
                dragCard.x = Math.max(0, Math.min(window.innerWidth - 95, mX - dragOffset.x));
                dragCard.y = Math.max(0, Math.min(window.innerHeight - 138, mY - dragOffset.y));
                $cardEl.css({ left: dragCard.x, top: dragCard.y });
                updateLandingHoverState(dragCard.x, dragCard.y);
            }).on("mouseup.carddrag touchend.carddrag", function() {
                if (dragCard) {
                    $cardEl.removeClass("dragging");
                    const zone = getCardCurrentZone(dragCard);
                    if (zone === "hand_p1" || zone === "hand_p2") dragCard.faceUp = true;
                    else if (zone === "grave_p1" || zone === "grave_p2") { dragCard.faceUp = true; dragCard.tapped = false; }
                    $(".magic-landing-zone").removeClass("drag-over");
                    updateLandingZoneCounts();
                    renderAllCards();
                }
                dragCard = null;
                $(document).off(".carddrag");
            });
        }
    });
}

function updatePileCounts() {
    const p1Deck = (state.decks.player1 || []).filter(c => c.section !== "Extra").length;
    const p1Extra = (state.decks.player1 || []).filter(c => c.section === "Extra").length;
    $("#count-deck_1").text(p1Deck);
    $("#count-extra_1").text(p1Extra);

    let p2Deck = 0, p2Extra = 0;
    if (hasPlayer2 && state.decks.player2) {
        p2Deck = state.decks.player2.filter(c => c.section !== "Extra").length;
        p2Extra = state.decks.player2.filter(c => c.section === "Extra").length;
        $("#count-deck_2").text(p2Deck);
        $("#count-extra_2").text(p2Extra);
    }

    const backImg = (state.layout === "pokemon") ? "img/pokeBocaAbajo.jpg" : "img/bocabajo.jpg";
    togglePileBackground("#zone-deck_1", p1Deck, backImg);
    if (state.layout !== "pokemon") togglePileBackground("#zone-extra_1", p1Extra, backImg);
    if (hasPlayer2) {
        togglePileBackground("#zone-deck_2", p2Deck, backImg);
        if (state.layout !== "pokemon") togglePileBackground("#zone-extra_2", p2Extra, backImg);
    }
    updateLandingZoneCounts();
}

function togglePileBackground(selector, count, imgUrl) {
    const $el = $(selector);
    if (count > 0) {
        $el.css({ "background-image": `url('${imgUrl}')`, "background-size": "cover", "background-position": "center", "border-style": "solid", "border-color": "rgba(255, 255, 255, 0.15)", "box-shadow": "0 10px 20px rgba(0,0,0,0.5)" });
    } else {
        $el.css({ "background-image": "none", "border-style": "dashed", "border-color": "rgba(255, 255, 255, 0.25)", "box-shadow": "none" });
    }
}

function updateLandingZoneCounts() {
    const counts = { hand_p1: 0, grave_p1: 0, banish_p1: 0, prizes_p1: 0, hand_p2: 0, grave_p2: 0, banish_p2: 0, prizes_p2: 0 };
    state.cards.forEach(card => {
        const zone = getCardCurrentZone(card);
        if (zone) counts[zone]++;
    });
    $("#count-hand-p1").text(counts.hand_p1);
    $("#count-grave-p1").text(counts.grave_p1);
    $("#count-banish-p1").text(counts.banish_p1);
    $("#count-prizes-p1").text(counts.prizes_p1);
    if (hasPlayer2) {
        $("#count-hand-p2").text(counts.hand_p2);
        $("#count-grave-p2").text(counts.grave_p2);
        $("#count-banish-p2").text(counts.banish_p2);
        $("#count-prizes-p2").text(counts.prizes_p2);
    }
}

function getCardCurrentZone(card) {
    const cardMidX = card.x + 47, cardMidY = card.y + 69;
    if (isPointInElement(cardMidX, cardMidY, "#zone-hand-p1")) return "hand_p1";
    if (isPointInElement(cardMidX, cardMidY, "#zone-grave-p1")) return "grave_p1";
    if (isPointInElement(cardMidX, cardMidY, "#zone-banish-p1")) return "banish_p1";
    if (isPointInElement(cardMidX, cardMidY, "#zone-prizes-p1")) return "prizes_p1";
    if (hasPlayer2) {
        if (isPointInElement(cardMidX, cardMidY, "#zone-hand-p2")) return "hand_p2";
        if (isPointInElement(cardMidX, cardMidY, "#zone-grave-p2")) return "grave_p2";
        if (isPointInElement(cardMidX, cardMidY, "#zone-banish-p2")) return "banish_p2";
        if (isPointInElement(cardMidX, cardMidY, "#zone-prizes-p2")) return "prizes_p2";
    }
    return null;
}

function drawCards(owner, amount) {
    const deck = state.decks[owner], mainCards = deck.filter(c => c.section !== "Extra");
    if (mainCards.length === 0) return Swal.fire('Deck Vacío', '', 'warning');
    const actualDraw = Math.min(amount, mainCards.length);
    const windowW = window.innerWidth, windowH = window.innerHeight;
    const targetXBase = windowW * 0.15 + 50;
    const targetY = (owner === "player1") ? (windowH - 180) : 40;

    for (let i = 0; i < actualDraw; i++) {
        const idx = deck.findIndex(c => c.section !== "Extra");
        const cardData = deck.splice(idx, 1)[0];
        const cardId = "card_" + Math.random().toString(36).substr(2, 9);
        const cardX = targetXBase + (state.cards.filter(c => getCardCurrentZone(c) === (owner === 'player1' ? 'hand_p1' : 'hand_p2')).length * 50);

        state.cards.push({ id: cardId, name: cardData.name, image_url: cardData.image_url, desc: cardData.desc || "", x: cardX, y: targetY, faceUp: true, tapped: false, counters: { glass: 0, poke: 0 }, owner, section: "Main", attachedTo: null });
    }
    renderAllCards();
    updatePileCounts();
}

function setupPokemonPrizes(owner) {
    const deck = state.decks[owner], mainCards = deck.filter(c => c.section !== "Extra");
    if (mainCards.length < 6) return Swal.fire('Error', 'Insuficientes cartas para Premios.', 'warning');
    const offset = $(owner === "player1" ? "#zone-prizes-p1" : "#zone-prizes-p2").offset();

    for (let i = 0; i < 6; i++) {
        const cardData = deck.splice(deck.findIndex(c => c.section !== "Extra"), 1)[0];
        state.cards.push({
            id: "card_" + Math.random().toString(36).substr(2, 9), name: cardData.name, image_url: cardData.image_url, desc: cardData.desc || "", x: offset.left + (i * 24) + 15, y: offset.top + 15, faceUp: false, tapped: false, counters: { glass: 0, poke: 0 }, owner, section: "Main", attachedTo: null
        });
    }
    renderAllCards();
    updatePileCounts();
}

function openSearchModal(owner) {
    const mainCards = state.decks[owner].filter(c => c.section !== "Extra");
    if (mainCards.length === 0) return Swal.fire('Vacio', '', 'warning');
    $("#pile-multi-select-toggle").prop("checked", false).trigger("change");
    $("#pile-modal-title").text(`Deck: ${owner === 'player1' ? 'J1' : 'J2'}`);
    const $grid = $("#pile-cards-grid").empty();

    mainCards.forEach((card, index) => {
        $grid.append(`
            <div class="pile-card-container" data-index="${index}" data-owner="${owner}" data-source="deck">
                <img src="${card.image_url}">
                <div class="pile-card-hover-overlay">
                    <div class="pile-card-menu">
                        <button class="pile-card-action-btn search-to-hand">A Mano</button>
                        <button class="pile-card-action-btn search-to-field">Invocar</button>
                        <button class="pile-card-action-btn search-to-grave">Cementerio</button>
                        <button class="pile-card-action-btn search-to-banish">Destierro</button>
                    </div>
                </div>
            </div>
        `);
    });
    $("#pile-overlay").fadeIn(200);
}

function openExtraModal(owner) {
    const extraCards = state.decks[owner].filter(c => c.section === "Extra");
    if (extraCards.length === 0) return Swal.fire('Vacio', '', 'warning');
    $("#extra-modal-title").text(`Extra Deck: ${owner === 'player1' ? 'J1' : 'J2'}`);
    const $grid = $("#extra-cards-grid").empty();

    extraCards.forEach((card, index) => {
        $grid.append(`
            <div class="pile-card-container" data-index="${index}" data-owner="${owner}" data-source="extra">
                <img src="${card.image_url}">
                <div class="pile-card-hover-overlay">
                    <div class="pile-card-menu">
                        <button class="pile-card-action-btn search-to-field">Invocar</button>
                        <button class="pile-card-action-btn search-extra-to-xyz">Invocación XYZ</button>
                    </div>
                </div>
            </div>
        `);
    });
    $("#extra-overlay").fadeIn(200);
}

$(document).on("click", ".search-to-hand", function() {
    const $container = $(this).closest(".pile-card-container");
    if ($("#pile-multi-select-toggle").is(":checked")) return;
    const idx = parseInt($container.attr("data-index")), owner = $container.attr("data-owner"), source = $container.attr("data-source");
    const deck = state.decks[owner], filtered = deck.filter(c => source === "extra" ? c.section === "Extra" : c.section !== "Extra"), cardData = filtered[idx];

    deck.splice(deck.indexOf(cardData), 1);
    const targetY = (owner === "player1") ? (window.innerHeight - 180) : 40;
    state.cards.push({ id: "card_" + Math.random().toString(36).substr(2, 9), name: cardData.name, image_url: cardData.image_url, desc: cardData.desc || "", x: window.innerWidth * 0.15 + 50 + (state.cards.filter(c => getCardCurrentZone(c) === (owner === 'player1' ? 'hand_p1' : 'hand_p2')).length * 50), y: targetY, faceUp: true, tapped: false, counters: { glass: 0, poke: 0 }, owner, section: "Main", attachedTo: null });

    $("#pile-overlay, #extra-overlay").fadeOut(200);
    renderAllCards();
    updatePileCounts();
});

$(document).on("click", ".search-to-field", function() {
    const $container = $(this).closest(".pile-card-container");
    if ($("#pile-multi-select-toggle").is(":checked")) return;
    const idx = parseInt($container.attr("data-index")), owner = $container.attr("data-owner"), source = $container.attr("data-source");
    const deck = state.decks[owner], filtered = deck.filter(c => source === "extra" ? c.section === "Extra" : c.section !== "Extra"), cardData = filtered[idx];

    deck.splice(deck.indexOf(cardData), 1);
    state.cards.push({ id: "card_" + Math.random().toString(36).substr(2, 9), name: cardData.name, image_url: cardData.image_url, desc: cardData.desc || "", x: window.innerWidth / 2 - 47, y: window.innerHeight / 2 - 69, faceUp: true, tapped: false, counters: { glass: 0, poke: 0 }, owner, section: "Main", attachedTo: null });

    $("#pile-overlay, #extra-overlay").fadeOut(200);
    renderAllCards();
    updatePileCounts();
});

$(document).on("click", ".search-to-grave, .search-to-banish", function() {
    const $container = $(this).closest(".pile-card-container");
    const idx = parseInt($container.attr("data-index")), owner = $container.attr("data-owner"), isBanish = $(this).hasClass("search-to-banish");
    const deck = state.decks[owner], cardData = deck.filter(c => c.section !== "Extra")[idx];

    deck.splice(deck.indexOf(cardData), 1);
    const newCard = { id: "card_" + Math.random().toString(36).substr(2, 9), name: cardData.name, image_url: cardData.image_url, desc: cardData.desc || "", x: window.innerWidth / 2 - 47, y: window.innerHeight / 2 - 69, faceUp: true, tapped: false, counters: { glass: 0, poke: 0 }, owner, section: "Main", attachedTo: null };
    state.cards.push(newCard);
    sendCardToZone(newCard, isBanish ? "banish" : "grave");

    $("#pile-overlay").fadeOut(200);
    renderAllCards();
    updatePileCounts();
});

$(document).on("click", ".search-extra-to-xyz", function() {
    const $container = $(this).closest(".pile-card-container");
    xyzSummonSourceCard = state.decks[$container.attr("data-owner")].filter(c => c.section === "Extra")[parseInt($container.attr("data-index"))];
    $("#extra-overlay").fadeOut(150);
    $("#playmat").addClass("selecting-zone");
    Swal.fire({ toast: true, position: 'bottom', showConfirmButton: false, timer: 3000, icon: 'info', title: 'Haz clic en una carta de tu campo para invocar XYZ' });
});

function bindBatchSelectionHandlers() {
    $(document).on("change", "#pile-multi-select-toggle", function() {
        const active = $(this).is(":checked");
        $("#pile-overlay").toggleClass("pile-multi-select-active", active);
        $("#pile-batch-actions").toggle(active);
        if (!active) $(".pile-card-container").removeClass("selected-for-batch");
    });
    $(document).on("click", ".pile-card-container", function(e) {
        if ($("#pile-multi-select-toggle").is(":checked")) { e.preventDefault(); e.stopPropagation(); $(this).toggleClass("selected-for-batch"); }
    });
    $(document).on("click", ".btn-pile-batch-hand", function() {
        const $selected = $(".pile-card-container.selected-for-batch");
        if ($selected.length === 0) return Swal.fire('Sin Selección', '', 'warning');
        const addedNames = [], windowW = window.innerWidth, windowH = window.innerHeight;
        const items = [];

        $selected.each(function() {
            const cardId = $(this).attr("data-card-id");
            if (cardId) {
                // Moving from a list view (field cards) to hand in batch!
                const card = state.cards.find(c => c.id === cardId);
                if (card) {
                    card.faceUp = true;
                    card.x = windowW * 0.15 + 50 + (state.cards.filter(c => getCardCurrentZone(c) === (card.owner === 'player1' ? 'hand_p1' : 'hand_p2')).length * 50);
                    card.y = (card.owner === "player1") ? (windowH - 180) : 40;
                    addedNames.push(card.name);
                }
            } else {
                items.push({ idx: parseInt($(this).attr("data-index")), owner: $(this).attr("data-owner"), source: $(this).attr("data-source") });
            }
        });

        if (items.length > 0) {
            items.sort((a, b) => b.idx - a.idx);
            items.forEach(item => {
                const deck = state.decks[item.owner], filtered = deck.filter(c => item.source === "extra" ? c.section === "Extra" : c.section !== "Extra"), cardData = filtered[item.idx];
                deck.splice(deck.indexOf(cardData), 1);
                state.cards.push({ id: "card_" + Math.random().toString(36).substr(2, 9), name: cardData.name, image_url: cardData.image_url, desc: cardData.desc || "", x: windowW * 0.15 + 50 + (state.cards.filter(c => getCardCurrentZone(c) === (item.owner === 'player1' ? 'hand_p1' : 'hand_p2')).length * 50), y: item.owner === "player1" ? windowH - 180 : 40, faceUp: true, tapped: false, counters: { glass: 0, poke: 0 }, owner: item.owner, section: "Main", attachedTo: null });
                addedNames.push(cardData.name);
            });
        }

        $("#pile-multi-select-toggle").prop("checked", false).trigger("change");
        $("#pile-overlay").fadeOut(200);
        renderAllCards();
        updateLandingZoneCounts();
        updatePileCounts();
        if (addedNames.length > 0) {
            Swal.fire({ title: 'Agregadas a la Mano', html: addedNames.map(n => `<div>🃏 ${n}</div>`).join(''), icon: 'success', background: '#12181e', color: '#fff' });
        }
    });

    $(document).on("click", ".btn-pile-batch-deck", function() {
        const $selected = $(".pile-card-container.selected-for-batch");
        if ($selected.length === 0) return Swal.fire('Sin Selección', '', 'warning');

        const addedNames = [];
        $selected.each(function() {
            const cardId = $(this).attr("data-card-id");
            if (cardId) {
                const card = state.cards.find(c => c.id === cardId);
                if (card) {
                    state.decks[card.owner].push({ name: card.name, image_url: card.image_url, desc: card.desc, section: card.section });
                    state.cards = state.cards.filter(c => c.id !== cardId);
                    addedNames.push(card.name);
                }
            }
        });

        $("#pile-multi-select-toggle").prop("checked", false).trigger("change");
        $("#pile-overlay").fadeOut(200);
        updatePileCounts();
        renderAllCards();
        if (addedNames.length > 0) {
            Swal.fire({ title: 'Devueltas al Deck', html: addedNames.map(n => `<div>🃏 ${n}</div>`).join(''), icon: 'success', background: '#12181e', color: '#fff' });
        }
    });
}

function decoupleAllChildren(parentCard, destination) {
    state.cards.filter(c => c.attachedTo === parentCard.id).forEach(child => {
        child.attachedTo = null;
        if (destination === "hand") {
            child.x = window.innerWidth * 0.15 + 50 + (state.cards.filter(c => getCardCurrentZone(c) === (child.owner === 'player1' ? 'hand_p1' : 'hand_p2')).length * 50);
            child.y = (child.owner === "player1") ? (window.innerHeight - 180) : 40;
            child.faceUp = true;
        } else if (destination === "grave") {
            sendCardToZone(child, "grave");
        } else if (destination === "banish") {
            sendCardToZone(child, "banish");
        }
    });
}

function bindAttachmentHandlers() {
    $("#menu-card-attach").click(function() {
        const data = $("#card-ctx-menu").data("context-data");
        if (data && data.card) {
            couplingSourceCard = data.card;
            $("#playmat").addClass("selecting-zone");
            Swal.fire({ toast: true, position: 'bottom', showConfirmButton: false, timer: 3000, icon: 'info', title: 'Haz clic en la carta destino para acoplar' });
        }
        $("#card-ctx-menu").removeClass("active");
    });
    $("#menu-card-attached-view").click(function() {
        const data = $("#card-ctx-menu").data("context-data");
        if (data && data.card) openAttachedCardsModal(data.card);
        $("#card-ctx-menu").removeClass("active");
    });
    $("#bulk-to-hand").click(function() {
        decoupleAllChildren(state.cards.find(c => c.id === $("#attached-overlay").data("parent-id")), "hand");
        $("#attached-overlay").fadeOut(200); renderAllCards();
    });
    $("#bulk-to-grave").click(function() {
        decoupleAllChildren(state.cards.find(c => c.id === $("#attached-overlay").data("parent-id")), "grave");
        $("#attached-overlay").fadeOut(200); renderAllCards();
    });
    $("#bulk-to-banish").click(function() {
        decoupleAllChildren(state.cards.find(c => c.id === $("#attached-overlay").data("parent-id")), "banish");
        $("#attached-overlay").fadeOut(200); renderAllCards();
    });
    $("#bulk-to-deck").click(function() {
        const pId = $("#attached-overlay").data("parent-id");
        state.cards.filter(c => c.attachedTo === pId).forEach(child => {
            child.attachedTo = null;
            state.decks[child.owner].push({ name: child.name, image_url: child.image_url, desc: child.desc, section: child.section });
            state.cards = state.cards.filter(c => c.id !== child.id);
        });
        $("#attached-overlay").fadeOut(200); updatePileCounts(); renderAllCards();
    });

    $(document).on("click", ".attached-material-hand", function() {
        const cardObj = state.cards.find(c => c.id === $(this).attr("data-card-id"));
        if (cardObj) {
            cardObj.attachedTo = null;
            cardObj.x = window.innerWidth * 0.15 + 50 + (state.cards.filter(c => getCardCurrentZone(c) === (cardObj.owner === 'player1' ? 'hand_p1' : 'hand_p2')).length * 50);
            cardObj.y = cardObj.owner === "player1" ? window.innerHeight - 180 : 40;
            cardObj.faceUp = true;
            $(this).closest(".pile-card-container").remove();
            if ($("#attached-cards-grid").children().length === 0) $("#attached-overlay").fadeOut(200);
            renderAllCards();
        }
    });
    $(document).on("click", ".attached-material-grave", function() {
        const cardObj = state.cards.find(c => c.id === $(this).attr("data-card-id"));
        if (cardObj) {
            cardObj.attachedTo = null; sendCardToZone(cardObj, "grave");
            $(this).closest(".pile-card-container").remove();
            if ($("#attached-cards-grid").children().length === 0) $("#attached-overlay").fadeOut(200);
            renderAllCards();
        }
    });
    $(document).on("click", ".attached-material-decouple", function() {
        const cardObj = state.cards.find(c => c.id === $(this).attr("data-card-id"));
        if (cardObj) {
            cardObj.attachedTo = null; cardObj.x += 100; cardObj.faceUp = true;
            $(this).closest(".pile-card-container").remove();
            if ($("#attached-cards-grid").children().length === 0) $("#attached-overlay").fadeOut(200);
            renderAllCards();
        }
    });
}

function openAttachedCardsModal(parentCard) {
    const children = state.cards.filter(c => c.attachedTo === parentCard.id);
    if (children.length === 0) return;
    $("#attached-overlay").data("parent-id", parentCard.id);
    $("#attached-modal-title").text(`Materiales de: ${parentCard.name}`);
    const $grid = $("#attached-cards-grid").empty();

    children.forEach(card => {
        $grid.append(`
            <div class="pile-card-container" style="width: 100px; height: 146px;">
                <img src="${card.image_url}">
                <div class="pile-card-hover-overlay">
                    <div class="pile-card-menu">
                        <button class="pile-card-action-btn attached-material-hand" data-card-id="${card.id}">A Mano</button>
                        <button class="pile-card-action-btn attached-material-grave" data-card-id="${card.id}">Cementerio</button>
                        <button class="pile-card-action-btn attached-material-decouple" data-card-id="${card.id}">Desacoplar</button>
                    </div>
                </div>
            </div>
        `);
    });
    $("#attached-overlay").fadeIn(200);
}

function makeLandingZonesDraggableAndResizable() {
    $(".magic-landing-zone").each(function() {
        const $zone = $(this);
        $zone.css("pointer-events", "auto").on("mousedown touchstart", function(e) {
            if ($(e.target).closest(".resize-handle, button, input").length) return;
            e.preventDefault();
            const clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
            const clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;
            const offset = $zone.offset(), deltaX = clientX - offset.left, deltaY = clientY - offset.top;

            $(document).on("mousemove.zonedrag touchmove.zonedrag", function(moveEvent) {
                const mX = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientX : moveEvent.clientX;
                const mY = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientY : moveEvent.clientY;
                $zone.css({ left: mX - deltaX, top: mY - deltaY, bottom: "auto", right: "auto" });
            }).on("mouseup.zonedrag touchend.zonedrag", () => { $(document).off(".zonedrag"); updateLandingZoneCounts(); });
        });

        const $handle = $zone.find(".resize-handle");
        if ($handle.length) {
            $handle.on("mousedown touchstart", function(e) {
                e.preventDefault(); e.stopPropagation();
                const startWidth = $zone.outerWidth(), startHeight = $zone.outerHeight();
                const startX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
                const startY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;

                $(document).on("mousemove.zoneresize touchmove.zoneresize", function(moveEvent) {
                    const mX = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientX : moveEvent.clientX;
                    const mY = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientY : moveEvent.clientY;
                    $zone.css({ width: Math.max(150, startWidth + (mX - startX)), height: Math.max(150, startHeight + (mY - startY)) });
                }).on("mouseup.zoneresize touchend.zoneresize", () => { $(document).off(".zoneresize"); updateLandingZoneCounts(); });
            });
        }
    });
}

function bindDropdownContextMenus() {
    $(document).on("click", ".pile-menu-trigger", function(e) {
        e.preventDefault(); e.stopPropagation();
        const pileId = $(this).attr("data-pile"), owner = pileId.endsWith("_1") ? "player1" : "player2";
        const offset = $(this).offset();
        if (pileId.startsWith("deck")) {
            showContextMenu("#deck-ctx-menu", offset.left, offset.top + $(this).outerHeight(), { owner });
            $("#menu-deck-prizes").toggle(state.layout === "pokemon");
        } else {
            showContextMenu("#extra-ctx-menu", offset.left, offset.top + $(this).outerHeight(), { owner });
        }
    });

    $(document).on("contextmenu", ".duel-card", function(e) {
        e.preventDefault(); e.stopPropagation();
        const card = state.cards.find(c => c.id === $(this).attr("id"));
        if (card) {
            showContextMenu("#card-ctx-menu", e.clientX, e.clientY, { card });
            $("#menu-card-attached-view").toggle(state.cards.some(c => c.attachedTo === card.id));
        }
    });

    // Binder items
    $("#menu-card-flip").click(function() {
        const d = $("#card-ctx-menu").data("context-data");
        if (d && d.card) { d.card.faceUp = !d.card.faceUp; renderAllCards(); }
        $("#card-ctx-menu").removeClass("active");
    });
    $("#menu-card-tap").click(function() {
        const d = $("#card-ctx-menu").data("context-data");
        if (d && d.card) { d.card.tapped = !d.card.tapped; renderAllCards(); }
        $("#card-ctx-menu").removeClass("active");
    });
    $("#menu-card-counter-glass").click(function() {
        const d = $("#card-ctx-menu").data("context-data");
        if (d && d.card) { d.card.counters.glass++; renderAllCards(); }
        $("#card-ctx-menu").removeClass("active");
    });
    $("#menu-card-counter-glass-sub").click(function() {
        const d = $("#card-ctx-menu").data("context-data");
        if (d && d.card) { d.card.counters.glass = Math.max(0, d.card.counters.glass - 1); renderAllCards(); }
        $("#card-ctx-menu").removeClass("active");
    });
    $(document).on("click", ".menu-card-counter-dmg", function() {
        const d = $("#card-ctx-menu").data("context-data");
        if (d && d.card) { d.card.counters.poke = Math.max(0, d.card.counters.poke + parseInt($(this).attr("data-val"))); renderAllCards(); }
        $("#card-ctx-menu").removeClass("active");
    });
    $("#menu-card-counter-clear").click(function() {
        const d = $("#card-ctx-menu").data("context-data");
        if (d && d.card) { d.card.counters.glass = 0; d.card.counters.poke = 0; renderAllCards(); }
        $("#card-ctx-menu").removeClass("active");
    });
    $("#menu-card-deck-bottom, #menu-card-deck-top").click(function() {
        const d = $("#card-ctx-menu").data("context-data"), top = $(this).attr("id").endsWith("top");
        if (d && d.card) {
            state.decks[d.card.owner][top ? "unshift" : "push"]({ name: d.card.name, image_url: d.card.image_url, desc: d.card.desc, section: d.card.section });
            state.cards = state.cards.filter(c => c.id !== d.card.id);
            updatePileCounts(); renderAllCards();
        }
        $("#card-ctx-menu").removeClass("active");
    });
    $("#menu-card-grave").click(function() {
        const d = $("#card-ctx-menu").data("context-data");
        if (d && d.card) sendCardToZone(d.card, "grave");
        $("#card-ctx-menu").removeClass("active");
    });
    $("#menu-card-banish").click(function() {
        const d = $("#card-ctx-menu").data("context-data");
        if (d && d.card) sendCardToZone(d.card, "banish");
        $("#card-ctx-menu").removeClass("active");
    });
    $("#menu-card-delete").click(function() {
        const d = $("#card-ctx-menu").data("context-data");
        if (d && d.card) { state.cards = state.cards.filter(c => c.id !== d.card.id); renderAllCards(); }
        $("#card-ctx-menu").removeClass("active");
    });
}

function setupAccessories() {
    let isDiceRolling = false, isCoinFlipping = false;
    $("#btn-roll-dice").click(function() {
        if (isDiceRolling) return; isDiceRolling = true;
        const $dice = $("#visual-dice-wrapper"), $icon = $("#visual-dice-icon"), val = Math.floor(Math.random() * 6) + 1;
        const diceClasses = ["fa-dice-one", "fa-dice-two", "fa-dice-three", "fa-dice-four", "fa-dice-five", "fa-dice-six"];
        $dice.css({ "transform": "rotateX(720deg) rotateY(720deg) scale(1.15)", "transition": "transform 0.6s ease-out" });
        let interval = setInterval(() => $icon.attr("class", "fas " + diceClasses[Math.floor(Math.random() * 6)]), 80);
        setTimeout(() => { clearInterval(interval); $icon.attr("class", "fas " + diceClasses[val - 1]); $dice.css({ "transform": "rotateX(0deg) rotateY(0deg) scale(1)", "transition": "transform 0.1s" }); isDiceRolling = false; }, 600);
    });
    $("#btn-flip-coin").click(function() {
        if (isCoinFlipping) return; isCoinFlipping = true;
        const $coin = $("#visual-coin-wrapper"), $text = $("#visual-coin-text"), isHeads = Math.random() < 0.5;
        $coin.css({ "transform": "rotateY(1080deg) scale(1.15)", "transition": "transform 0.6s ease-out" });
        setTimeout(() => {
            $text.text(isHeads ? "CARA" : "CRUZ");
            $coin.css(isHeads ? { "border-color": "#00d2ff", "background": "rgba(0, 210, 255, 0.15)", "color": "#00d2ff", "box-shadow": "0 0 12px rgba(0,210,255,0.4)" } : { "border-color": "#ff1b6b", "background": "rgba(255, 27, 107, 0.15)", "color": "#ff1b6b", "box-shadow": "0 0 12px rgba(255,27,107,0.4)" });
            $coin.css({ "transform": "rotateY(0deg) scale(1)", "transition": "transform 0.1s" });
            isCoinFlipping = false;
        }, 600);
    });
    $("#btn-spawn-token").click(function() {
        state.cards.push({ id: "card_" + Math.random().toString(36).substr(2, 9), name: "Ficha / Token", image_url: "https://images.ygoprodeck.com/images/cards/73915051.jpg", desc: "Ficha.", x: window.innerWidth / 2 - 47, y: window.innerHeight / 2 - 69, faceUp: true, tapped: false, counters: { glass: 0, poke: 0 }, owner: "player1", section: "Main", attachedTo: null });
        renderAllCards();
    });
}

function setupLPTrackers() {
    $(".lp-widget-btn").click(function() {
        const player = $(this).attr("data-player"), action = $(this).hasClass("lp-btn-add") ? "add" : $(this).hasClass("lp-btn-sub") ? "sub" : "half";
        const $input = $(`#lp-calc-${player}`), $display = $(`#lp-display-${player}`);
        let val = parseInt($input.val()) || 0, current = parseInt($display.text()) || 0;
        if (action === "add") current += val;
        else if (action === "sub") current = Math.max(0, current - val);
        else current = Math.ceil(current / 2);
        $display.text(current); $input.val('');
    });
}

function setupPerspectiveSwitcher() {
    $(".perspective-btn").click(function() {
        $(".perspective-btn").removeClass("active").css("background", "rgba(255,255,255,0.05)").css("color", "#fff");
        $(this).addClass("active");
        state.viewPerspective = $(this).attr("data-player");
        $(this).css("background", state.viewPerspective === "player1" ? "rgba(0,210,255,0.15)" : "rgba(255,27,107,0.15)").css("color", state.viewPerspective === "player1" ? "#00d2ff" : "#ff1b6b");
        renderAllCards();
    });
}

// Click subtraction of bead counters
$(document).on("click", ".stacked-counter-bead.ygo-bead", function(e) {
    e.preventDefault(); e.stopPropagation();
    const card = state.cards.find(c => c.id === $(this).attr("data-card-id"));
    if (card) { card.counters.glass = Math.max(0, card.counters.glass - 1); renderAllCards(); }
});
$(document).on("click", ".stacked-counter-bead.poke-bead", function(e) {
    e.preventDefault(); e.stopPropagation();
    const card = state.cards.find(c => c.id === $(this).attr("data-card-id"));
    if (card) { card.counters.poke = Math.max(0, card.counters.poke - parseInt($(this).attr("data-val"))); renderAllCards(); }
});

// Drag to delete counter logic
$(document).on("mousedown touchstart", ".card-counter-badge", function(e) {
    e.preventDefault(); e.stopPropagation();
    const $badge = $(this), cardId = $badge.attr("data-card-id"), type = $badge.attr("data-type"), card = state.cards.find(c => c.id === cardId);
    if (!card) return;
    const offset = $badge.offset();
    const $clone = $badge.clone().css({ position: "fixed", left: offset.left, top: offset.top, "pointer-events": "none", "z-index": 110000 }).appendTo("body");
    $badge.css("opacity", 0.3);

    $(document).on("mousemove.counterdrag touchmove.counterdrag", function(moveEvent) {
        const mX = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const mY = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientY : moveEvent.clientY;
        $clone.css({ left: mX - 10, top: mY - 10 });
    }).on("mouseup.counterdrag touchend.counterdrag", function(upEvent) {
        $(document).off(".counterdrag"); $clone.remove(); $badge.css("opacity", 1);
        const endX = upEvent.type === "touchend" ? upEvent.changedTouches[0].clientX : upEvent.clientX;
        const endY = upEvent.type === "touchend" ? upEvent.changedTouches[0].clientY : upEvent.clientY;
        if (Math.hypot(endX - (card.x + 47), endY - (card.y + 69)) > 95) {
            if (type === "glass") card.counters.glass = 0; else card.counters.poke = 0;
            Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'Contadores eliminados', showConfirmButton: false, timer: 1000 });
        }
        renderAllCards();
    });
});

function drawAttackArrows() {
    const $overlay = $("#attack-arrows-overlay").empty();
    $(".attack-text-badge, .attack-direct-badge").remove();
    $(".duel-card").removeClass("card-is-attacker card-under-attack");

    state.attacks.forEach(atk => {
        const attacker = state.cards.find(c => c.id === atk.attackerId);
        if (!attacker) return;
        const $atkEl = $(`#${attacker.id}`);
        if (!$atkEl.length) return;
        const startX = $atkEl.position().left + $atkEl.outerWidth() / 2, startY = $atkEl.position().top + $atkEl.outerHeight() / 2;

        $atkEl.addClass("card-is-attacker").append(`<div class="attack-text-badge">⚔️ Atacante</div>`);
        let endX = startX, endY = attacker.owner === "player1" ? 40 : window.innerHeight - 100;

        if (atk.isDirect) {
            $("#playmat").append(`<div class="attack-direct-badge" style="left: ${startX - 80}px; top: ${attacker.owner === "player1" ? startY - 100 : startY + 60}px;">💥 Ataque Directo</div>`);
        } else {
            const target = state.cards.find(c => c.id === atk.targetId);
            if (!target) return;
            const $tgtEl = $(`#${target.id}`);
            if ($tgtEl.length) {
                endX = $tgtEl.position().left + $tgtEl.outerWidth() / 2;
                endY = $tgtEl.position().top + $tgtEl.outerHeight() / 2;
                $tgtEl.addClass("card-under-attack").append(`<div class="attack-text-badge defender">🎯 Atacando</div>`);
            }
        }

        const angle = Math.atan2(endY - startY, endX - startX), arrowSize = 16;
        const headX1 = endX - arrowSize * Math.cos(angle - Math.PI / 6), headY1 = endY - arrowSize * Math.sin(angle - Math.PI / 6);
        const headX2 = endX - arrowSize * Math.cos(angle + Math.PI / 6), headY2 = endY - arrowSize * Math.sin(angle + Math.PI / 6);
        const strokeColor = attacker.owner === "player1" ? "#00d2ff" : "#ff1b6b";

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", "attack-line"); path.setAttribute("d", `M ${startX} ${startY} L ${endX} ${endY}`); path.setAttribute("stroke", strokeColor); path.setAttribute("fill", "none");
        const head = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        head.setAttribute("class", "attack-head"); head.setAttribute("points", `${endX},${endY} ${headX1},${headY1} ${headX2},${headY2}`); head.setAttribute("fill", strokeColor);

        $overlay[0].appendChild(path); $overlay[0].appendChild(head);
    });
}

function renderAllCards() {
    const $container = $("#field-cards-container");
    // Preserve cards that are currently being dragged to avoid tearing them out of the drag-and-drop flow.
    const activeDrags = {};
    $(".duel-card.dragging").each(function() {
        const id = $(this).attr("id");
        activeDrags[id] = $(this).detach();
    });
    $container.empty();

    // Render non-attached cards first (parent cards)
    const baseCards = state.cards.filter(c => !c.attachedTo);
    baseCards.forEach(card => {
        let $el = activeDrags[card.id];
        if (!$el) $el = createCardDOM(card);
        $container.append($el);
        applyCardVisuals($el, card);
        renderAttachedChildren(card.id, $container, activeDrags);
    });

    // Re-attach any orphaned cards to prevent lost references
    const orphans = state.cards.filter(c => c.attachedTo && !state.cards.some(p => p.id === c.attachedTo));
    orphans.forEach(card => {
        card.attachedTo = null;
        let $el = activeDrags[card.id];
        if (!$el) $el = createCardDOM(card);
        $container.append($el);
        applyCardVisuals($el, card);
    });

    drawAttackArrows();
}

function renderAttachedChildren(parentId, $container, activeDrags) {
    const children = state.cards.filter(c => c.attachedTo === parentId);
    children.forEach((child, idx) => {
        let $childEl = activeDrags[child.id];
        if (!$childEl) $childEl = createCardDOM(child);
        $container.append($childEl);

        // Calculate offset cascade relative to the parent card
        const parent = state.cards.find(c => c.id === parentId);
        if (parent) {
            child.x = parent.x + (idx * 16);
            child.y = parent.y + 24;
            child.faceUp = parent.faceUp; // Match faceUp visibility with parent standard
        }
        applyCardVisuals($childEl, child);
        // Cascading multi-tier attachment rendering
        renderAttachedChildren(child.id, $container, activeDrags);
    });
}

function createCardDOM(card) {
    return $(`
        <div class="duel-card" id="${card.id}">
            <div class="card-inner">
                <div class="card-front">
                    <img class="card-img" src="${card.image_url}" alt="${card.name}">
                </div>
                <div class="card-back">
                    <img class="card-back-img" src="${state.layout === 'pokemon' ? 'img/pokeBocaAbajo.jpg' : 'img/bocabajo.jpg'}">
                </div>
            </div>
            <!-- Quick hover ribbon actions -->
            <div class="card-quick-actions">
                <button class="quick-btn btn-voltear" title="Voltear (F)"><i class="fas fa-redo-alt"></i></button>
                <button class="quick-btn btn-girar" title="Girar (R)"><i class="fas fa-sync-alt"></i></button>
                <button class="quick-btn btn-atacar" title="Atacar (A)"><i class="fas fa-bolt"></i></button>
                <button class="quick-btn btn-atk-directo" title="Atk Directo (Shift+A)"><i class="fas fa-crosshairs"></i></button>
                <button class="quick-btn btn-efecto" title="Efecto (E)"><i class="fas fa-magic"></i></button>
            </div>
            <div class="card-indicator-flags"></div>
            <div class="card-counters-layer"></div>
        </div>
    `);
}

function applyCardVisuals($el, card) {
    const zone = getCardCurrentZone(card);
    const isMini = (zone === "hand_p1" || zone === "hand_p2" || zone === "grave_p1" || zone === "grave_p2" || zone === "banish_p1" || zone === "banish_p2" || zone === "prizes_p1" || zone === "prizes_p2");

    // Scale size dynamically
    const width = isMini ? 80 : 95;
    const height = isMini ? 116 : 138;
    $el.css({
        left: card.x,
        top: card.y,
        width: `${width}px`,
        height: `${height}px`,
        transform: card.tapped ? "rotate(90deg)" : "none",
        "z-index": card.attachedTo ? 310 : 300
    });

    // Check faceup/down perspective and visibility
    let isFlipped = !card.faceUp;
    if (state.mode !== "practice") {
        const isOpponent = (state.viewPerspective === "player1" && card.owner === "player2") || (state.viewPerspective === "player2" && card.owner === "player1");
        if (isOpponent) {
            // Anti-peeking masking: opponent's hand or face-down field cards appear face-down
            if (zone === "hand_p1" || zone === "hand_p2" || !card.faceUp) {
                isFlipped = true;
            }
        }
    }
    $el.toggleClass("flipped", isFlipped);

    // Apply indicators
    const $flags = $el.find(".card-indicator-flags").empty();
    if (card.attachedTo) {
        $flags.append(`<span class="card-flag-badge flag-attached"><i class="fas fa-paperclip"></i></span>`);
    }
    const hasAttachments = state.cards.some(c => c.attachedTo === card.id);
    if (hasAttachments) {
        $flags.append(`<span class="card-flag-badge flag-parent"><i class="fas fa-layer-group"></i> Attached</span>`);
    }

    // Apply counters
    const $countersLayer = $el.find(".card-counters-layer").empty();
    let hasCounters = false;

    if (card.counters.glass > 0) {
        hasCounters = true;
        $countersLayer.append(`
            <div class="card-counter-badge glass-badge" data-card-id="${card.id}" data-type="glass">
                🟢 ${card.counters.glass}
            </div>
            <div class="stacked-counters-container container-glass"></div>
        `);
        const $glassContainer = $countersLayer.find(".container-glass");
        for (let i = 0; i < Math.min(10, card.counters.glass); i++) {
            $glassContainer.append(`<span class="stacked-counter-bead ygo-bead" data-card-id="${card.id}"></span>`);
        }
    }

    if (card.counters.poke > 0) {
        hasCounters = true;
        $countersLayer.append(`
            <div class="card-counter-badge poke-badge" data-card-id="${card.id}" data-type="poke">
                💥 ${card.counters.poke}
            </div>
            <div class="stacked-counters-container container-poke"></div>
        `);
        const $pokeContainer = $countersLayer.find(".container-poke");
        let sum = card.counters.poke;
        const chips = [100, 50, 10];
        chips.forEach(chipVal => {
            const count = Math.floor(sum / chipVal);
            for (let i = 0; i < count; i++) {
                $pokeContainer.append(`<span class="stacked-counter-bead poke-bead val-${chipVal}" data-card-id="${card.id}" data-val="${chipVal}">${chipVal}</span>`);
            }
            sum %= chipVal;
        });
    }

    $el.toggleClass("has-counters", hasCounters);
}

function sendCardToZone(card, zoneType) {
    const pKey = card.owner;
    let zoneId = "";
    if (zoneType === "grave") zoneId = pKey === "player1" ? "#zone-grave-p1" : "#zone-grave-p2";
    else if (zoneType === "banish") zoneId = pKey === "player1" ? "#zone-banish-p1" : "#zone-banish-p2";

    const $zone = $(zoneId);
    if ($zone.length) {
        const offset = $zone.offset();
        const existingCount = state.cards.filter(c => getCardCurrentZone(c) === zoneId.substring(1)).length;

        // Unattach children first
        decoupleAllChildren(card, "grave");

        card.x = offset.left + 15 + (existingCount * 8);
        card.y = offset.top + 15;
        card.faceUp = true;
        card.tapped = false;
        renderAllCards();
        updateLandingZoneCounts();
    }
}

function updateLandingHoverState(x, y) {
    const midX = x + 47, midY = y + 69;
    $(".magic-landing-zone").removeClass("drag-over");

    let hoveredSelector = null;
    if (isPointInElement(midX, midY, "#zone-hand-p1")) hoveredSelector = "#zone-hand-p1";
    else if (isPointInElement(midX, midY, "#zone-grave-p1")) hoveredSelector = "#zone-grave-p1";
    else if (isPointInElement(midX, midY, "#zone-banish-p1")) hoveredSelector = "#zone-banish-p1";
    else if (isPointInElement(midX, midY, "#zone-prizes-p1")) hoveredSelector = "#zone-prizes-p1";
    else if (hasPlayer2) {
        if (isPointInElement(midX, midY, "#zone-hand-p2")) hoveredSelector = "#zone-hand-p2";
        else if (isPointInElement(midX, midY, "#zone-grave-p2")) hoveredSelector = "#zone-grave-p2";
        else if (isPointInElement(midX, midY, "#zone-banish-p2")) hoveredSelector = "#zone-banish-p2";
        else if (isPointInElement(midX, midY, "#zone-prizes-p2")) hoveredSelector = "#zone-prizes-p2";
    }

    if (hoveredSelector) {
        $(hoveredSelector).addClass("drag-over");
    }
}

function setupCardInteractions() {
    $(document).on("mousedown touchstart", ".duel-card", function(e) {
        if ($(e.target).closest(".quick-btn, .stacked-counter-bead, .card-counter-badge").length) return;
        const clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;

        const cardId = $(this).attr("id");
        const cardObj = state.cards.find(c => c.id === cardId);
        if (!cardObj) return;

        // Visual targeting / Summoning selection intersection
        if ($("#playmat").hasClass("selecting-zone")) {
            e.preventDefault(); e.stopPropagation();
            $("#playmat").removeClass("selecting-zone");

            if (couplingSourceCard) {
                if (couplingSourceCard.id === cardObj.id) {
                    couplingSourceCard = null;
                    return Swal.fire('Error', 'No puedes acoplar una carta a sí misma', 'warning');
                }
                // Couple source card under this cardObj
                couplingSourceCard.attachedTo = cardObj.id;
                couplingSourceCard = null;
                renderAllCards();
                return;
            }

            if (xyzSummonSourceCard) {
                // Perform XYZ Summon on top of cardObj
                const idx = state.decks[cardObj.owner].indexOf(xyzSummonSourceCard);
                if (idx !== -1) state.decks[cardObj.owner].splice(idx, 1);

                const newCardId = "card_" + Math.random().toString(36).substr(2, 9);
                const newXYZParent = {
                    id: newCardId, name: xyzSummonSourceCard.name, image_url: xyzSummonSourceCard.image_url, desc: xyzSummonSourceCard.desc || "",
                    x: cardObj.x, y: cardObj.y, faceUp: true, tapped: false, counters: { glass: 0, poke: 0 }, owner: cardObj.owner, section: "Extra", attachedTo: null
                };

                state.cards.push(newXYZParent);
                cardObj.attachedTo = newXYZParent.id; // Original parent becomes child of newly overlayed card

                // Transfer any existing attached cards underneath cardObj to the newXYZParent
                state.cards.forEach(c => {
                    if (c.attachedTo === cardObj.id && c.id !== newXYZParent.id) {
                        c.attachedTo = newXYZParent.id;
                    }
                });

                xyzSummonSourceCard = null;
                updatePileCounts();
                renderAllCards();
                return;
            }
            return;
        }

        if (targetingCard) {
            e.preventDefault(); e.stopPropagation();
            if (targetingCard.id !== cardObj.id) {
                // Add attack targeting reference
                state.attacks = state.attacks.filter(atk => atk.attackerId !== targetingCard.id);
                state.attacks.push({ attackerId: targetingCard.id, targetId: cardObj.id, isDirect: false });
            }
            targetingCard = null;
            $("#playmat").removeClass("targeting-active");
            drawAttackArrows();
            return;
        }

        // Setup dragging parameters
        dragCard = cardObj;
        dragStartCoords.x = clientX;
        dragStartCoords.y = clientY;
        dragStartTime = Date.now();
        dragOffset.x = clientX - dragCard.x;
        dragOffset.y = clientY - dragCard.y;

        const $cardEl = $(this).addClass("dragging");
        // Bring parent and attached sub-tree to top z-index stack during drags
        $cardEl.css("z-index", 500);

        $(document).on("mousemove.carddrag touchmove.carddrag", function(moveEvent) {
            if (!dragCard) return;
            const mX = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const mY = moveEvent.type === "touchmove" ? moveEvent.touches[0].clientY : moveEvent.clientY;

            const dx = mX - dragOffset.x;
            const dy = mY - dragOffset.y;
            const deltaX = dx - dragCard.x;
            const deltaY = dy - dragCard.y;

            // Move this card along with all of its attached sub-children dynamically
            dragCard.x = Math.max(0, Math.min(window.innerWidth - 95, dx));
            dragCard.y = Math.max(0, Math.min(window.innerHeight - 138, dy));
            $cardEl.css({ left: dragCard.x, top: dragCard.y });

            function cascadeMove(pId) {
                state.cards.filter(c => c.attachedTo === pId).forEach(child => {
                    child.x += deltaX;
                    child.y += deltaY;
                    $(`#${child.id}`).css({ left: child.x, top: child.y });
                    cascadeMove(child.id);
                });
            }
            cascadeMove(dragCard.id);

            updateLandingHoverState(dragCard.x, dragCard.y);
        }).on("mouseup.carddrag touchend.carddrag", function(upEvent) {
            if (dragCard) {
                $cardEl.removeClass("dragging");
                $(".magic-landing-zone").removeClass("drag-over");

                const endX = upEvent.type === "touchend" ? upEvent.changedTouches[0].clientX : upEvent.clientX;
                const endY = upEvent.type === "touchend" ? upEvent.changedTouches[0].clientY : upEvent.clientY;

                // Fine-click rotation tilt (distance < 15px, duration < 500ms)
                const dist = Math.hypot(endX - dragStartCoords.x, endY - dragStartCoords.y);
                const duration = Date.now() - dragStartTime;
                if (dist < 15 && duration < 500) {
                    triggerSidebarUpdate(dragCard);
                } else {
                    // Check zone constraints
                    const zone = getCardCurrentZone(dragCard);
                    if (zone === "hand_p1" || zone === "hand_p2") {
                        dragCard.faceUp = true;
                    } else if (zone === "grave_p1" || zone === "grave_p2") {
                        dragCard.faceUp = true;
                        dragCard.tapped = false;
                        decoupleAllChildren(dragCard, "grave");
                    }
                    updateLandingZoneCounts();
                    renderAllCards();
                }
            }
            dragCard = null;
            $(document).off(".carddrag");
        });
    });

    // Quick hover ribbon click listeners
    $(document).on("click", ".btn-voltear", function(e) {
        e.preventDefault(); e.stopPropagation();
        const id = $(this).closest(".duel-card").attr("id");
        const card = state.cards.find(c => c.id === id);
        if (card) { card.faceUp = !card.faceUp; renderAllCards(); }
    });

    $(document).on("click", ".btn-girar", function(e) {
        e.preventDefault(); e.stopPropagation();
        const id = $(this).closest(".duel-card").attr("id");
        const card = state.cards.find(c => c.id === id);
        if (card) { card.tapped = !card.tapped; renderAllCards(); }
    });

    $(document).on("click", ".btn-atacar", function(e) {
        e.preventDefault(); e.stopPropagation();
        const id = $(this).closest(".duel-card").attr("id");
        const card = state.cards.find(c => c.id === id);
        if (card) {
            targetingCard = card;
            $("#playmat").addClass("targeting-active");
            Swal.fire({ toast: true, position: 'bottom', showConfirmButton: false, timer: 3000, icon: 'info', title: 'Haz clic en una carta enemiga para atacar, o haz clic en el playmat para cancelar' });
        }
    });

    $(document).on("click", ".btn-atk-directo", function(e) {
        e.preventDefault(); e.stopPropagation();
        const id = $(this).closest(".duel-card").attr("id");
        const card = state.cards.find(c => c.id === id);
        if (card) {
            state.attacks = state.attacks.filter(atk => atk.attackerId !== card.id);
            state.attacks.push({ attackerId: card.id, targetId: null, isDirect: true });
            drawAttackArrows();
        }
    });

    $(document).on("click", ".btn-efecto", function(e) {
        e.preventDefault(); e.stopPropagation();
        const id = $(this).closest(".duel-card").attr("id");
        const $cardEl = $(`#${id}`);
        $cardEl.addClass("flash-activation");
        setTimeout(() => $cardEl.removeClass("flash-activation"), 800);
    });
}

function triggerSidebarUpdate(card) {
    $("#magic-sidebar").data("active-card-id", card.id);
    $("#detail-card-title").text(card.name);
    $("#detail-card-desc").text(card.desc || "Sin descripción de efecto.");
    $("#detail-card-img").attr("src", card.image_url);
    $("#sidebar-magnifier").show().off("click").on("click", function() {
        Swal.fire({
            title: card.name,
            text: card.desc || "Sin descripción de efecto.",
            imageUrl: card.image_url,
            imageHeight: 300,
            background: '#12181e',
            color: '#ffffff',
            confirmButtonColor: '#ff1b6b'
        });
    });
}

function sendCardToPile(card, pileId) {
    const owner = pileId.endsWith("_1") ? "player1" : "player2";
    state.decks[owner].push({ name: card.name, image_url: card.image_url, desc: card.desc, section: card.section });
    state.cards = state.cards.filter(c => c.id !== card.id);
    updatePileCounts(); renderAllCards();
}

// Click event handlers for .btn-view-list to view contents of Cemetery / Banish / Prizes
$(document).on("click", ".btn-view-list", function() {
    const rawZone = $(this).attr("data-zone");
    const zoneKey = rawZone.replace("_1", "_p1").replace("_2", "_p2");
    const listCards = state.cards.filter(c => getCardCurrentZone(c) === zoneKey);

    if (listCards.length === 0) {
        return Swal.fire('Vacío', 'No hay cartas en esta zona.', 'info');
    }

    $("#pile-multi-select-toggle").prop("checked", false).trigger("change");

    let title = "Cartas en ";
    if (zoneKey.startsWith("grave")) title += "Cementerio";
    else if (zoneKey.startsWith("banish")) title += "Destierro";
    else title += "Premios";
    title += (zoneKey.endsWith("p1") ? " J1" : " J2");

    $("#pile-modal-title").text(title);
    const $grid = $("#pile-cards-grid").empty();

    listCards.forEach((card) => {
        $grid.append(`
            <div class="pile-card-container" data-card-id="${card.id}">
                <img src="${card.image_url}">
                <div class="pile-card-hover-overlay">
                    <div class="pile-card-menu">
                        <button class="pile-card-action-btn zone-card-to-hand" data-card-id="${card.id}">A Mano</button>
                        <button class="pile-card-action-btn zone-card-to-field" data-card-id="${card.id}">Sacar</button>
                        <button class="pile-card-action-btn zone-card-to-deck-top" data-card-id="${card.id}">A Deck Top</button>
                    </div>
                </div>
            </div>
        `);
    });

    $("#pile-overlay").fadeIn(200);
});

$(document).on("click", ".zone-card-to-hand", function() {
    const cardId = $(this).attr("data-card-id");
    const card = state.cards.find(c => c.id === cardId);
    if (card) {
        card.faceUp = true;
        card.x = window.innerWidth * 0.15 + 50 + (state.cards.filter(c => getCardCurrentZone(c) === (card.owner === 'player1' ? 'hand_p1' : 'hand_p2')).length * 50);
        card.y = (card.owner === "player1") ? (window.innerHeight - 180) : 40;
        $(this).closest(".pile-card-container").remove();
        if ($("#pile-cards-grid").children().length === 0) $("#pile-overlay").fadeOut(200);
        renderAllCards();
        updateLandingZoneCounts();
    }
});

$(document).on("click", ".zone-card-to-field", function() {
    const cardId = $(this).attr("data-card-id");
    const card = state.cards.find(c => c.id === cardId);
    if (card) {
        card.x = window.innerWidth / 2 - 47 + (Math.random() * 40 - 20);
        card.y = window.innerHeight / 2 - 69 + (Math.random() * 40 - 20);
        $(this).closest(".pile-card-container").remove();
        if ($("#pile-cards-grid").children().length === 0) $("#pile-overlay").fadeOut(200);
        renderAllCards();
        updateLandingZoneCounts();
    }
});

$(document).on("click", ".zone-card-to-deck-top", function() {
    const cardId = $(this).attr("data-card-id");
    const card = state.cards.find(c => c.id === cardId);
    if (card) {
        state.decks[card.owner].unshift({ name: card.name, image_url: card.image_url, desc: card.desc, section: card.section });
        state.cards = state.cards.filter(c => c.id !== cardId);
        $(this).closest(".pile-card-container").remove();
        if ($("#pile-cards-grid").children().length === 0) $("#pile-overlay").fadeOut(200);
        updatePileCounts();
        renderAllCards();
    }
});

function setupGlobalEvents() {
    $("#sidebar-toggle-btn").click(function() {
        $(this).toggleClass("collapsed");
        $("#magic-sidebar").toggleClass("collapsed");
    });

    $("#toggle-acc-btn").click(function() {
        const $icon = $(this).find("i");
        $("#acc-body-container").slideToggle(200, function() {
            if ($(this).is(":visible")) {
                $icon.removeClass("fa-chevron-up").addClass("fa-chevron-down");
            } else {
                $icon.removeClass("fa-chevron-down").addClass("fa-chevron-up");
            }
        });
    });

    $(".btn-add-glass-counter").click(function() {
        const cardId = $("#magic-sidebar").data("active-card-id");
        if (!cardId) return Swal.fire('Ninguna carta seleccionada', 'Haz clic en una carta para verla en el panel lateral primero.', 'warning');
        const card = state.cards.find(c => c.id === cardId);
        if (card) {
            card.counters.glass++;
            renderAllCards();
        }
    });

    $(".btn-add-poke-counter").click(function() {
        const cardId = $("#magic-sidebar").data("active-card-id");
        if (!cardId) return Swal.fire('Ninguna carta seleccionada', 'Haz clic en una carta para verla en el panel lateral primero.', 'warning');
        const card = state.cards.find(c => c.id === cardId);
        if (card) {
            card.counters.poke = (card.counters.poke || 0) + 10;
            renderAllCards();
        }
    });

    $(document).on("click", function(e) {
        if (!$(e.target).closest("#card-ctx-menu, .duel-card, .pile-menu-trigger").length) {
            $("#card-ctx-menu, #deck-ctx-menu, #extra-ctx-menu").removeClass("active");
        }
        if (!$(e.target).closest(".duel-card, .quick-btn").length && $("#playmat").hasClass("targeting-active")) {
            $("#playmat").removeClass("targeting-active");
            targetingCard = null;
        }
        if (!$(e.target).closest(".duel-card, .pile-card-container").length && $("#playmat").hasClass("selecting-zone")) {
            $("#playmat").removeClass("selecting-zone");
            couplingSourceCard = null;
            xyzSummonSourceCard = null;
        }
    });

    $("#btn-close-pile-modal").click(() => $("#pile-overlay").fadeOut(200));
    $("#btn-close-extra-modal").click(() => $("#extra-overlay").fadeOut(200));
    $("#btn-close-attached-modal").click(() => $("#attached-overlay").fadeOut(200));

    $("#btn-clear-arrows").click(function() {
        state.attacks = []; drawAttackArrows();
    });

    $("#menu-deck-shuffle").click(function() {
        const d = $("#deck-ctx-menu").data("context-data");
        if (d) shuffleDeck(d.owner);
        $("#deck-ctx-menu").removeClass("active");
    });
    $("#menu-deck-draw1").click(function() {
        const d = $("#deck-ctx-menu").data("context-data");
        if (d) drawCards(d.owner, 1);
        $("#deck-ctx-menu").removeClass("active");
    });
    $("#menu-deck-draw5").click(function() {
        const d = $("#deck-ctx-menu").data("context-data");
        if (d) drawCards(d.owner, 5);
        $("#deck-ctx-menu").removeClass("active");
    });
    $("#menu-deck-search").click(function() {
        const d = $("#deck-ctx-menu").data("context-data");
        if (d) openSearchModal(d.owner);
        $("#deck-ctx-menu").removeClass("active");
    });
    $("#menu-deck-prizes").click(function() {
        const d = $("#deck-ctx-menu").data("context-data");
        if (d) setupPokemonPrizes(d.owner);
        $("#deck-ctx-menu").removeClass("active");
    });

    $("#menu-extra-search").click(function() {
        const d = $("#extra-ctx-menu").data("context-data");
        if (d) openExtraModal(d.owner);
        $("#extra-ctx-menu").removeClass("active");
    });

    // Keyboard bindings for hover card states
    $(document).on("mouseenter", ".duel-card", function() {
        $(this).addClass("kbd-hover-focus");
    }).on("mouseleave", ".duel-card", function() {
        $(this).removeClass("kbd-hover-focus");
    });

    $(document).keydown(function(e) {
        const $hovered = $(".duel-card.kbd-hover-focus");
        if ($hovered.length === 0) return;
        const card = state.cards.find(c => c.id === $hovered.attr("id"));
        if (!card) return;

        const key = e.key.toLowerCase();
        if (key === 'f') {
            e.preventDefault(); card.faceUp = !card.faceUp; renderAllCards();
        } else if (key === 'r') {
            e.preventDefault(); card.tapped = !card.tapped; renderAllCards();
        } else if (key === 'e') {
            e.preventDefault(); $hovered.addClass("flash-activation"); setTimeout(() => $hovered.removeClass("flash-activation"), 800);
        } else if (key === 'a') {
            e.preventDefault();
            if (e.shiftKey) {
                // Direct attack
                state.attacks = state.attacks.filter(atk => atk.attackerId !== card.id);
                state.attacks.push({ attackerId: card.id, targetId: null, isDirect: true });
                drawAttackArrows();
            } else {
                targetingCard = card;
                $("#playmat").addClass("targeting-active");
            }
        }
    });
}

function shuffleDeck(owner) {
    const deck = state.decks[owner];
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Deck Barajado', showConfirmButton: false, timer: 1500 });
}

function showContextMenu(menuId, x, y, data) {
    $(".magic-dropdown-menu").removeClass("active");
    $(menuId).addClass("active").css({
        left: Math.min(window.innerWidth - 200, x),
        top: Math.min(window.innerHeight - 250, y)
    }).data("context-data", data);
}

function isPointInElement(x, y, selector) {
    const $el = $(selector);
    if (!$el.length) return false;
    const offset = $el.offset();
    return (x >= offset.left && x <= offset.left + $el.outerWidth() && y >= offset.top && y <= offset.top + $el.outerHeight());
}
