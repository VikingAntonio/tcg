// Duel Simulator Engine

// Offline / Sandbox compatibility guard for Supabase when offline
if (typeof _supabase === 'undefined' || !_supabase) {
    window._supabase = {
        auth: {
            getSession: async () => ({ data: { session: null }, error: null })
        }
    };
}

// Fullscreen card zoom helper functions
window.getCardZoomImage = function(card) {
    if (!card) return "";
    if (card.zone && card.zone.startsWith("prize_") && card.faceDown) {
        const defaultBack = (state.layout === "pokemon") ? "img/pokeBocaAbajo.jpg" : "img/bocabajo.jpg";
        return (card.owner && state.deckSleeves && state.deckSleeves[card.owner]) ? state.deckSleeves[card.owner] : defaultBack;
    }

    const isExtraFaceUp = (card.zone && card.zone.startsWith("extra_") && !card.zone.startsWith("extra_monster") && card.faceDown === false);
    const isPile = card.zone && (card.zone.startsWith("deck_") || (card.zone.startsWith("extra_") && !card.zone.startsWith("extra_monster")) || card.zone.startsWith("prize_")) && !isExtraFaceUp;
    let isFaceDown = card.faceDown && card.zone && !card.zone.startsWith("hand_");

    let showAsBack = false;
    if (state.mode === 'practice') {
        // In practice mode, all non-prize cards are fully visible in Zoom
        showAsBack = false;
    } else {
        const viewerRole = window.currentRole || "player1";
        const isMyCard = (card.owner === viewerRole);
        if (isMyCard) {
            // Players can always view their own cards (zoom) in any zone/state
            showAsBack = false;
        } else {
            // For opponents' cards, hide them if they are in a pile or face-down
            showAsBack = isPile || isFaceDown;
        }
    }

    if (showAsBack) {
        const defaultBack = (state.layout === "pokemon") ? "img/pokeBocaAbajo.jpg" : "img/bocabajo.jpg";
        return (card.owner && state.deckSleeves && state.deckSleeves[card.owner]) ? state.deckSleeves[card.owner] : defaultBack;
    } else {
        return card.imageUrl;
    }
};

window.showCustomCardZoom = function(imageUrl) {
    if (!imageUrl || imageUrl.includes("placeholder") || imageUrl.includes("via.placeholder.com")) {
        return;
    }
    // Collapse any mobile accessories sidebar first
    $(".duel-sidebar").removeClass("mobile-sidebar-active");

    $("#custom-card-zoom-img").attr("src", imageUrl);
    $("#custom-card-zoom-overlay").fadeIn(150).css("display", "flex");
};

// Bind custom card zoom overlay click handlers
$(document).ready(function() {
    $("#custom-card-zoom-overlay, #custom-card-zoom-close").click(function(e) {
        if (e.target.id === "custom-card-zoom-img") {
            return;
        }
        $("#custom-card-zoom-overlay").fadeOut(150);
    });
});

// Helper to check if current layout is a Yu-Gi-Oh! format
function isYGOLayout(layout) {
    const l = layout || (typeof state !== 'undefined' ? state.layout : '');
    return l === "yugioh" || l === "yugioh_advanced" || l === "speed_rush";
}

// JSON Playmat layouts for Yu-Gi-Oh and Pokémon TCG
// Scaled layout for a 1120x600 playmat board.
// Card Width: 80px, Height: 116px.
// Let's position things symmetrically and nicely.
const BOARD_LAYOUTS = {
    yugioh: [
        // Player 2 (Top Half, Mirrored) - Red/Pink Theme
        { id: "deck_2", name: "P2 Deck", player: 2, x: 50, y: 30, type: "deck" },
        { id: "grave_2", name: "P2 Cementerio", player: 2, x: 50, y: 160, type: "grave" },
        { id: "banished_2", name: "P2 Desterrado", player: 2, x: 160, y: 160, type: "banished" },
        { id: "extra_2", name: "P2 Extra", player: 2, x: 990, y: 30, type: "extra" },
        { id: "field_2", name: "P2 Campo", player: 2, x: 990, y: 160, type: "field" },
        { id: "monster_2_5", name: "P2 Monstruo 5", player: 2, x: 300, y: 160, type: "monster" },
        { id: "monster_2_4", name: "P2 Monstruo 4", player: 2, x: 410, y: 160, type: "monster" },
        { id: "monster_2_3", name: "P2 Monstruo 3", player: 2, x: 520, y: 160, type: "monster" },
        { id: "monster_2_2", name: "P2 Monstruo 2", player: 2, x: 630, y: 160, type: "monster" },
        { id: "monster_2_1", name: "P2 Monstruo 1", player: 2, x: 740, y: 160, type: "monster" },
        { id: "spell_2_5", name: "P2 Magia/Trampa 5", player: 2, x: 300, y: 30, type: "spell" },
        { id: "spell_2_4", name: "P2 Magia/Trampa 4", player: 2, x: 410, y: 30, type: "spell" },
        { id: "spell_2_3", name: "P2 Magia/Trampa 3", player: 2, x: 520, y: 30, type: "spell" },
        { id: "spell_2_2", name: "P2 Magia/Trampa 2", player: 2, x: 630, y: 30, type: "spell" },
        { id: "spell_2_1", name: "P2 Magia/Trampa 1", player: 2, x: 740, y: 30, type: "spell" },

        // Player 1 (Bottom Half) - Blue Theme
        { id: "extra_1", name: "P1 Extra", player: 1, x: 50, y: 450, type: "extra" },
        { id: "field_1", name: "P1 Campo", player: 1, x: 50, y: 320, type: "field" },
        { id: "banished_1", name: "P1 Desterrado", player: 1, x: 880, y: 320, type: "banished" },
        { id: "deck_1", name: "P1 Deck", player: 1, x: 990, y: 450, type: "deck" },
        { id: "grave_1", name: "P1 Cementerio", player: 1, x: 990, y: 320, type: "grave" },
        { id: "monster_1_1", name: "P1 Monstruo 1", player: 1, x: 300, y: 320, type: "monster" },
        { id: "monster_1_2", name: "P1 Monstruo 2", player: 1, x: 410, y: 320, type: "monster" },
        { id: "monster_1_3", name: "P1 Monstruo 3", player: 1, x: 520, y: 320, type: "monster" },
        { id: "monster_1_4", name: "P1 Monstruo 4", player: 1, x: 630, y: 320, type: "monster" },
        { id: "monster_1_5", name: "P1 Monstruo 5", player: 1, x: 740, y: 320, type: "monster" },
        { id: "spell_1_1", name: "P1 Magia/Trampa 1", player: 1, x: 300, y: 450, type: "spell" },
        { id: "spell_1_2", name: "P1 Magia/Trampa 2", player: 1, x: 410, y: 450, type: "spell" },
        { id: "spell_1_3", name: "P1 Magia/Trampa 3", player: 1, x: 520, y: 450, type: "spell" },
        { id: "spell_1_4", name: "P1 Magia/Trampa 4", player: 1, x: 630, y: 450, type: "spell" },
        { id: "spell_1_5", name: "P1 Magia/Trampa 5", player: 1, x: 740, y: 450, type: "spell" }
    ],
    yugioh_advanced: [
        // Player 2 (Top Half, Mirrored) - Red/Pink Theme
        { id: "deck_2", name: "P2 Deck", player: 2, x: 50, y: 6, type: "deck" },
        { id: "grave_2", name: "P2 Cementerio", player: 2, x: 50, y: 125, type: "grave" },
        { id: "banished_2", name: "P2 Desterrado", player: 2, x: 160, y: 125, type: "banished" },
        { id: "extra_2", name: "P2 Extra", player: 2, x: 990, y: 6, type: "extra" },
        { id: "field_2", name: "P2 Campo", player: 2, x: 990, y: 125, type: "field" },
        { id: "monster_2_5", name: "P2 Monstruo 5", player: 2, x: 300, y: 125, type: "monster" },
        { id: "monster_2_4", name: "P2 Monstruo 4", player: 2, x: 410, y: 125, type: "monster" },
        { id: "monster_2_3", name: "P2 Monstruo 3", player: 2, x: 520, y: 125, type: "monster" },
        { id: "monster_2_2", name: "P2 Monstruo 2", player: 2, x: 630, y: 125, type: "monster" },
        { id: "monster_2_1", name: "P2 Monstruo 1", player: 2, x: 740, y: 125, type: "monster" },
        { id: "spell_2_5", name: "P2 Péndulo Izq", player: 2, x: 300, y: 6, type: "spell" },
        { id: "spell_2_4", name: "P2 Magia/Trampa 4", player: 2, x: 410, y: 6, type: "spell" },
        { id: "spell_2_3", name: "P2 Magia/Trampa 3", player: 2, x: 430, y: 6, type: "spell" },
        { id: "spell_2_2", name: "P2 Magia/Trampa 2", player: 2, x: 550, y: 6, type: "spell" },
        { id: "spell_2_1", name: "P2 Péndulo Der", player: 2, x: 740, y: 6, type: "spell" },

        // Shared Extra Monster Zones placed in the middle
        { id: "extra_monster_2", name: "Extra Monstruo 2", player: 2, x: 410, y: 244, type: "monster" },
        { id: "extra_monster_1", name: "Extra Monstruo 1", player: 1, x: 630, y: 244, type: "monster" },

        // Player 1 (Bottom Half) - Blue Theme
        { id: "extra_1", name: "P1 Extra", player: 1, x: 50, y: 482, type: "extra" },
        { id: "field_1", name: "P1 Campo", player: 1, x: 50, y: 363, type: "field" },
        { id: "banished_1", name: "P1 Desterrado", player: 1, x: 880, y: 363, type: "banished" },
        { id: "deck_1", name: "P1 Deck", player: 1, x: 990, y: 482, type: "deck" },
        { id: "grave_1", name: "P1 Cementerio", player: 1, x: 990, y: 363, type: "grave" },
        { id: "monster_1_1", name: "P1 Monstruo 1", player: 1, x: 300, y: 363, type: "monster" },
        { id: "monster_1_2", name: "P1 Monstruo 2", player: 1, x: 410, y: 363, type: "monster" },
        { id: "monster_1_3", name: "P1 Monstruo 3", player: 1, x: 520, y: 363, type: "monster" },
        { id: "monster_1_4", name: "P1 Monstruo 4", player: 1, x: 630, y: 363, type: "monster" },
        { id: "monster_1_5", name: "P1 Monstruo 5", player: 1, x: 740, y: 363, type: "monster" },
        { id: "spell_1_1", name: "P1 Péndulo Izq", player: 1, x: 300, y: 482, type: "spell" },
        { id: "spell_1_2", name: "P1 Magia/Trampa 2", player: 1, x: 410, y: 482, type: "spell" },
        { id: "spell_1_3", name: "P1 Magia/Trampa 3", player: 1, x: 520, y: 482, type: "spell" },
        { id: "spell_1_4", name: "P1 Magia/Trampa 4", player: 1, x: 630, y: 482, type: "spell" },
        { id: "spell_1_5", name: "P1 Péndulo Der", player: 1, x: 740, y: 482, type: "spell" }
    ],
    pokemon: [
        // Player 2 (Top Half, Mirrored) - Red/Pink Theme
        { id: "deck_2", name: "P2 Deck", player: 2, x: 50, y: 30, type: "deck" },
        { id: "grave_2", name: "P2 Descarte", player: 2, x: 50, y: 160, type: "grave" },
        { id: "banished_2", name: "P2 Desterrado", player: 2, x: -95, y: 30, type: "banished" },
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
        { id: "grave_1", name: "P1 Descarte", player: 1, x: 990, y: 320, type: "grave" },
        { id: "banished_1", name: "P1 Desterrado", player: 1, x: 1135, y: 450, type: "banished" }
    ],
    speed_rush: [
        // Player 2 (Top Half, Mirrored) - Red/Pink Theme
        { id: "deck_2", name: "P2 Deck", player: 2, x: 50, y: 30, type: "deck" },
        { id: "grave_2", name: "P2 Cementerio", player: 2, x: 50, y: 160, type: "grave" },
        { id: "banished_2", name: "P2 Desterrado", player: 2, x: 160, y: 160, type: "banished" },
        { id: "extra_2", name: "P2 Extra", player: 2, x: 990, y: 30, type: "extra" },
        { id: "field_2", name: "P2 Campo", player: 2, x: 990, y: 160, type: "field" },
        { id: "monster_2_3", name: "P2 Monstruo 3", player: 2, x: 410, y: 160, type: "monster" },
        { id: "monster_2_2", name: "P2 Monstruo 2", player: 2, x: 520, y: 160, type: "monster" },
        { id: "monster_2_1", name: "P2 Monstruo 1", player: 2, x: 630, y: 160, type: "monster" },
        { id: "spell_2_3", name: "P2 Magia/Trampa 3", player: 2, x: 410, y: 30, type: "spell" },
        { id: "spell_2_2", name: "P2 Magia/Trampa 2", player: 2, x: 520, y: 30, type: "spell" },
        { id: "spell_2_1", name: "P2 Magia/Trampa 1", player: 2, x: 630, y: 30, type: "spell" },

        // Player 1 (Bottom Half) - Blue Theme
        { id: "extra_1", name: "P1 Extra", player: 1, x: 50, y: 450, type: "extra" },
        { id: "field_1", name: "P1 Campo", player: 1, x: 50, y: 320, type: "field" },
        { id: "banished_1", name: "P1 Desterrado", player: 1, x: 880, y: 320, type: "banished" },
        { id: "deck_1", name: "P1 Deck", player: 1, x: 990, y: 450, type: "deck" },
        { id: "grave_1", name: "P1 Cementerio", player: 1, x: 990, y: 320, type: "grave" },
        { id: "monster_1_1", name: "P1 Monstruo 1", player: 1, x: 410, y: 320, type: "monster" },
        { id: "monster_1_2", name: "P1 Monstruo 2", player: 1, x: 520, y: 320, type: "monster" },
        { id: "monster_1_3", name: "P1 Monstruo 3", player: 1, x: 630, y: 320, type: "monster" },
        { id: "spell_1_1", name: "P1 Magia/Trampa 1", player: 1, x: 410, y: 450, type: "spell" },
        { id: "spell_1_2", name: "P1 Magia/Trampa 2", player: 1, x: 520, y: 450, type: "spell" },
        { id: "spell_1_3", name: "P1 Magia/Trampa 3", player: 1, x: 630, y: 450, type: "spell" }
    ],
    one_piece: [
        // Player 2 (Top Half, Mirrored)
        { id: "deck_2", name: "P2 Mazo", player: 2, x: 50, y: 30, type: "deck" },
        { id: "grave_2", name: "P2 Trash", player: 2, x: 50, y: 160, type: "grave" },
        { id: "prize_2_1", name: "P2 Vidas", player: 2, x: 160, y: 30, type: "prize" },
        { id: "leader_2", name: "P2 Líder", player: 2, x: 520, y: 30, type: "active" },
        { id: "field_2", name: "P2 Escenario", player: 2, x: 630, y: 30, type: "field" },
        { id: "extra_2", name: "P2 Mazo DON!!", player: 2, x: 990, y: 30, type: "extra" },
        { id: "don_2", name: "P2 Área DON!!", player: 2, x: 990, y: 160, type: "spell" },
        { id: "char_2_5", name: "P2 Personaje 5", player: 2, x: 300, y: 160, type: "monster" },
        { id: "char_2_4", name: "P2 Personaje 4", player: 2, x: 410, y: 160, type: "monster" },
        { id: "char_2_3", name: "P2 Personaje 3", player: 2, x: 520, y: 160, type: "monster" },
        { id: "char_2_2", name: "P2 Personaje 2", player: 2, x: 630, y: 160, type: "monster" },
        { id: "char_2_1", name: "P2 Personaje 1", player: 2, x: 740, y: 160, type: "monster" },

        // Player 1 (Bottom Half)
        { id: "extra_1", name: "P1 Mazo DON!!", player: 1, x: 50, y: 450, type: "extra" },
        { id: "don_1", name: "P1 Área DON!!", player: 1, x: 50, y: 320, type: "spell" },
        { id: "prize_1_1", name: "P1 Vidas", player: 1, x: 160, y: 450, type: "prize" },
        { id: "leader_1", name: "P1 Líder", player: 1, x: 520, y: 450, type: "active" },
        { id: "field_1", name: "P1 Escenario", player: 1, x: 410, y: 450, type: "field" },
        { id: "deck_1", name: "P1 Mazo", player: 1, x: 990, y: 450, type: "deck" },
        { id: "grave_1", name: "P1 Trash", player: 1, x: 990, y: 320, type: "grave" },
        { id: "char_1_1", name: "P1 Personaje 1", player: 1, x: 300, y: 320, type: "monster" },
        { id: "char_1_2", name: "P1 Personaje 2", player: 1, x: 410, y: 320, type: "monster" },
        { id: "char_1_3", name: "P1 Personaje 3", player: 1, x: 520, y: 320, type: "monster" },
        { id: "char_1_4", name: "P1 Personaje 4", player: 1, x: 630, y: 320, type: "monster" },
        { id: "char_1_5", name: "P1 Personaje 5", player: 1, x: 740, y: 320, type: "monster" }
    ],
    digimon: [
        // Player 2 (Top Half, Mirrored)
        { id: "extra_2", name: "P2 Digi-Egg", player: 2, x: 50, y: 30, type: "extra" },
        { id: "hatch_2", name: "P2 Crianza", player: 2, x: 50, y: 160, type: "bench" },
        { id: "prize_2_1", name: "P2 Seguridad", player: 2, x: 160, y: 30, type: "prize" },
        { id: "battle_2_5", name: "P2 Área Batalla 5", player: 2, x: 300, y: 160, type: "monster" },
        { id: "battle_2_4", name: "P2 Área Batalla 4", player: 2, x: 410, y: 160, type: "monster" },
        { id: "battle_2_3", name: "P2 Área Batalla 3", player: 2, x: 520, y: 160, type: "monster" },
        { id: "battle_2_2", name: "P2 Área Batalla 2", player: 2, x: 630, y: 160, type: "monster" },
        { id: "battle_2_1", name: "P2 Área Batalla 1", player: 2, x: 740, y: 160, type: "monster" },
        { id: "option_2_5", name: "P2 Opciones 5", player: 2, x: 300, y: 30, type: "spell" },
        { id: "option_2_4", name: "P2 Opciones 4", player: 2, x: 410, y: 30, type: "spell" },
        { id: "option_2_3", name: "P2 Opciones 3", player: 2, x: 520, y: 30, type: "spell" },
        { id: "option_2_2", name: "P2 Opciones 2", player: 2, x: 630, y: 30, type: "spell" },
        { id: "option_2_1", name: "P2 Opciones 1", player: 2, x: 740, y: 30, type: "spell" },
        { id: "deck_2", name: "P2 Mazo", player: 2, x: 990, y: 30, type: "deck" },
        { id: "grave_2", name: "P2 Trash", player: 2, x: 990, y: 160, type: "grave" },

        // Player 1 (Bottom Half)
        { id: "extra_1", name: "P1 Digi-Egg", player: 1, x: 50, y: 450, type: "extra" },
        { id: "hatch_1", name: "P1 Crianza", player: 1, x: 50, y: 320, type: "bench" },
        { id: "prize_1_1", name: "P1 Seguridad", player: 1, x: 160, y: 450, type: "prize" },
        { id: "battle_1_1", name: "P1 Área Batalla 1", player: 1, x: 300, y: 320, type: "monster" },
        { id: "battle_1_2", name: "P1 Área Batalla 2", player: 1, x: 410, y: 320, type: "monster" },
        { id: "battle_1_3", name: "P1 Área Batalla 3", player: 1, x: 520, y: 320, type: "monster" },
        { id: "battle_1_4", name: "P1 Área Batalla 4", player: 1, x: 630, y: 320, type: "monster" },
        { id: "battle_1_5", name: "P1 Área Batalla 5", player: 1, x: 740, y: 320, type: "monster" },
        { id: "option_1_1", name: "P1 Opciones 1", player: 1, x: 300, y: 450, type: "spell" },
        { id: "option_1_2", name: "P1 Opciones 2", player: 1, x: 410, y: 450, type: "spell" },
        { id: "option_1_3", name: "P1 Opciones 3", player: 1, x: 520, y: 450, type: "spell" },
        { id: "option_1_4", name: "P1 Opciones 4", player: 1, x: 630, y: 450, type: "spell" },
        { id: "option_1_5", name: "P1 Opciones 5", player: 1, x: 740, y: 450, type: "spell" },
        { id: "deck_1", name: "P1 Mazo", player: 1, x: 990, y: 450, type: "deck" },
        { id: "grave_1", name: "P1 Trash", player: 1, x: 990, y: 320, type: "grave" }
    ],
    naruto: [
        // Player 2 (Top Half, Mirrored)
        { id: "deck_2", name: "P2 Mazo", player: 2, x: 50, y: 30, type: "deck" },
        { id: "grave_2", name: "P2 Cementerio", player: 2, x: 50, y: 160, type: "grave" },
        { id: "banished_2", name: "P2 Exilio", player: 2, x: 160, y: 160, type: "banished" },
        { id: "ninja_2_5", name: "P2 Ninja 5", player: 2, x: 300, y: 160, type: "monster" },
        { id: "ninja_2_4", name: "P2 Ninja 4", player: 2, x: 410, y: 160, type: "monster" },
        { id: "ninja_2_3", name: "P2 Ninja 3", player: 2, x: 520, y: 160, type: "monster" },
        { id: "ninja_2_2", name: "P2 Ninja 2", player: 2, x: 630, y: 160, type: "monster" },
        { id: "ninja_2_1", name: "P2 Ninja 1", player: 2, x: 740, y: 160, type: "monster" },
        { id: "chakra_2_5", name: "P2 Chakra/Soporte 5", player: 2, x: 300, y: 30, type: "spell" },
        { id: "chakra_2_4", name: "P2 Chakra/Soporte 4", player: 2, x: 410, y: 30, type: "spell" },
        { id: "chakra_2_3", name: "P2 Chakra/Soporte 3", player: 2, x: 520, y: 30, type: "spell" },
        { id: "chakra_2_2", name: "P2 Chakra/Soporte 2", player: 2, x: 630, y: 30, type: "spell" },
        { id: "chakra_2_1", name: "P2 Chakra/Soporte 1", player: 2, x: 740, y: 30, type: "spell" },
        { id: "active_2", name: "P2 Aldea/Líder", player: 2, x: 990, y: 160, type: "active" },
        { id: "extra_2", name: "P2 Mazo Extra", player: 2, x: 990, y: 30, type: "extra" },

        // Player 1 (Bottom Half)
        { id: "extra_1", name: "P1 Mazo Extra", player: 1, x: 50, y: 450, type: "extra" },
        { id: "active_1", name: "P1 Aldea/Líder", player: 1, x: 50, y: 320, type: "active" },
        { id: "banished_1", name: "P1 Exilio", player: 1, x: 880, y: 320, type: "banished" },
        { id: "ninja_1_1", name: "P1 Ninja 1", player: 1, x: 300, y: 320, type: "monster" },
        { id: "ninja_1_2", name: "P1 Ninja 2", player: 1, x: 410, y: 320, type: "monster" },
        { id: "ninja_1_3", name: "P1 Ninja 3", player: 1, x: 520, y: 320, type: "monster" },
        { id: "ninja_1_4", name: "P1 Ninja 4", player: 1, x: 630, y: 320, type: "monster" },
        { id: "ninja_1_5", name: "P1 Ninja 5", player: 1, x: 740, y: 320, type: "monster" },
        { id: "chakra_1_1", name: "P1 Chakra/Soporte 1", player: 1, x: 300, y: 450, type: "spell" },
        { id: "chakra_1_2", name: "P1 Chakra/Soporte 2", player: 1, x: 410, y: 450, type: "spell" },
        { id: "chakra_1_3", name: "P1 Chakra/Soporte 3", player: 1, x: 520, y: 450, type: "spell" },
        { id: "chakra_1_4", name: "P1 Chakra/Soporte 4", player: 1, x: 630, y: 450, type: "spell" },
        { id: "chakra_1_5", name: "P1 Chakra/Soporte 5", player: 1, x: 740, y: 450, type: "spell" },
        { id: "grave_1", name: "P1 Cementerio", player: 1, x: 990, y: 320, type: "grave" },
        { id: "deck_1", name: "P1 Mazo", player: 1, x: 990, y: 450, type: "deck" }
    ],
    magic_commander: [
        // Player 2 (Top Half, Mirrored)
        { id: "deck_2", name: "P2 Biblioteca", player: 2, x: 50, y: 30, type: "deck" },
        { id: "grave_2", name: "P2 Cementerio", player: 2, x: 50, y: 160, type: "grave" },
        { id: "banished_2", name: "P2 Exilio", player: 2, x: 160, y: 160, type: "banished" },
        { id: "creature_2_5", name: "P2 Criatura 5", player: 2, x: 300, y: 160, type: "monster" },
        { id: "creature_2_4", name: "P2 Criatura 4", player: 2, x: 410, y: 160, type: "monster" },
        { id: "creature_2_3", name: "P2 Criatura 3", player: 2, x: 520, y: 160, type: "monster" },
        { id: "creature_2_2", name: "P2 Criatura 2", player: 2, x: 630, y: 160, type: "monster" },
        { id: "creature_2_1", name: "P2 Criatura 1", player: 2, x: 740, y: 160, type: "monster" },
        { id: "land_2_5", name: "P2 Tierras/Permanentes 5", player: 2, x: 300, y: 30, type: "spell" },
        { id: "land_2_4", name: "P2 Tierras/Permanentes 4", player: 2, x: 410, y: 30, type: "spell" },
        { id: "land_2_3", name: "P2 Tierras/Permanentes 3", player: 2, x: 520, y: 30, type: "spell" },
        { id: "land_2_2", name: "P2 Tierras/Permanentes 2", player: 2, x: 630, y: 30, type: "spell" },
        { id: "land_2_1", name: "P2 Tierras/Permanentes 1", player: 2, x: 740, y: 30, type: "spell" },
        { id: "active_2", name: "P2 Permanentes", player: 2, x: 990, y: 160, type: "active" },
        { id: "extra_2", name: "P2 Comandante", player: 2, x: 990, y: 30, type: "extra" },

        // Player 1 (Bottom Half)
        { id: "extra_1", name: "P1 Comandante", player: 1, x: 50, y: 450, type: "extra" },
        { id: "active_1", name: "P1 Permanentes", player: 1, x: 50, y: 320, type: "active" },
        { id: "banished_1", name: "P1 Exilio", player: 1, x: 880, y: 320, type: "banished" },
        { id: "creature_1_1", name: "P1 Criatura 1", player: 1, x: 300, y: 320, type: "monster" },
        { id: "creature_1_2", name: "P1 Criatura 2", player: 1, x: 410, y: 320, type: "monster" },
        { id: "creature_1_3", name: "P1 Criatura 3", player: 1, x: 520, y: 320, type: "monster" },
        { id: "creature_1_4", name: "P1 Criatura 4", player: 1, x: 630, y: 320, type: "monster" },
        { id: "creature_1_5", name: "P1 Criatura 5", player: 1, x: 740, y: 320, type: "monster" },
        { id: "land_1_1", name: "P1 Tierras/Permanentes 1", player: 1, x: 300, y: 450, type: "spell" },
        { id: "land_1_2", name: "P1 Tierras/Permanentes 2", player: 1, x: 410, y: 450, type: "spell" },
        { id: "land_1_3", name: "P1 Tierras/Permanentes 3", player: 1, x: 520, y: 450, type: "spell" },
        { id: "land_1_4", name: "P1 Tierras/Permanentes 4", player: 1, x: 630, y: 450, type: "spell" },
        { id: "land_1_5", name: "P1 Tierras/Permanentes 5", player: 1, x: 740, y: 450, type: "spell" },
        { id: "grave_1", name: "P1 Cementerio", player: 1, x: 990, y: 320, type: "grave" },
        { id: "deck_1", name: "P1 Biblioteca", player: 1, x: 990, y: 450, type: "deck" }
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
const stateParams = new URLSearchParams(window.location.search);
const state = {
    roomId: stateParams.get('room') || null,
    mode: stateParams.get('mode') || "practice",
    layout: stateParams.get('layout') || "yugioh",
    cards: [], // All active card instances currently in game
    decks: { player1: [], player2: [] }, // Raw decks selected
    deckSleeves: { player1: null, player2: null }, // Store selected sleeve URL for each player
    deckMats: { player1: null, player2: null }, // Store selected playmat URL for each player
    currentUser: null
};

// Active drag tracking
let dragCard = null;
let dragOffset = { x: 0, y: 0 };

// Global selection sets for batch transfers
let selectedHandCards = { player1: [], player2: [] };
let selectedPileCards = [];
let activePileModalType = ""; // "grave" or "banished"
let activePileModalPlayer = ""; // "player1" or "player2"
let dragStartCoords = { x: 0, y: 0 };
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

// Targeting system state for XYZ summon process
let xyzCard = null;

// Configure Playmat Field Zones & Scale
function initLayout() {
    $("#dynamic-zones-container").empty();

    // Add central separator
    $("#dynamic-zones-container").append('<div class="playmat-divider"></div>');

    // DYNAMIC CARD BACK SETTING BASED ON THE SELECTED LAYOUT
    if (state.layout === "pokemon") {
        $("body").addClass("layout-pokemon").removeClass("layout-yugioh");
        document.body.style.setProperty('--card-back-url', "url('img/pokeBocaAbajo.jpg')");
    } else if (isYGOLayout(state.layout)) {
        $("body").addClass("layout-yugioh").removeClass("layout-pokemon");
        document.body.style.setProperty('--card-back-url', "url('img/bocabajo.jpg')");
    } else {
        $("body").removeClass("layout-yugioh").removeClass("layout-pokemon");
        document.body.style.setProperty('--card-back-url', "url('img/bocabajo.jpg')");
    }

    const zones = BOARD_LAYOUTS[state.layout];

    $("#pile-counters-container").empty();
    zones.forEach(zone => {
        const playerClass = zone.player === 1 ? "zone-player-1" : "zone-player-2";
        const typeClass = `zone-type-${zone.type}`;

        let customClass = "";
        if (state.layout === "yugioh_advanced") {
            if (zone.id === "spell_1_1" || zone.id === "spell_2_5") {
                customClass = "zone-pendulum-blue";
            } else if (zone.id === "spell_1_5" || zone.id === "spell_2_1") {
                customClass = "zone-pendulum-red";
            } else if (zone.id === "extra_monster_1" || zone.id === "extra_monster_2") {
                customClass = "zone-extra-monster";
            }
        }

        const zoneHTML = `
            <div class="board-zone ${playerClass} ${typeClass} ${customClass}" id="zone-${zone.id}" style="left: ${zone.x}px; top: ${zone.y}px;" data-id="${zone.id}" data-player="${zone.player}">
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
        const { data: { session } } = await _supabase.auth.getSession();
        if (session && session.user) {
            state.currentUser = session.user;
        }

        const params = new URLSearchParams(window.location.search);
        const deck1Id = params.get('deck1');
        const deck2Id = params.get('deck2');
        const userRole = params.get('role') || 'player1';

        if (state.mode === 'practice') {
            // Load deck1 (Player 1)
            if (deck1Id && deck1Id !== 'mock') {
                await fetchDeckCards(deck1Id, 'player1');
                instantiateDeck('player1');
            } else {
                state.decks['player1'] = [...HIGH_FIDELITY_MOCKS];
                instantiateDeck('player1');
            }

            // Load deck2 (Player 2)
            if (deck2Id && deck2Id !== 'mock') {
                await fetchDeckCards(deck2Id, 'player2');
                instantiateDeck('player2');
            } else {
                state.decks['player2'] = [...HIGH_FIDELITY_MOCKS];
                instantiateDeck('player2');
            }
        } else {
            // Multiplayer mode: only load the player's own deck based on their configured role
            if (userRole === 'player1') {
                if (deck1Id && deck1Id !== 'mock') {
                    await fetchDeckCards(deck1Id, 'player1');
                    instantiateDeck('player1');
                } else {
                    state.decks['player1'] = [...HIGH_FIDELITY_MOCKS];
                    instantiateDeck('player1');
                }
            } else if (userRole === 'player2') {
                if (deck2Id && deck2Id !== 'mock') {
                    await fetchDeckCards(deck2Id, 'player2');
                    instantiateDeck('player2');
                } else {
                    state.decks['player2'] = [...HIGH_FIDELITY_MOCKS];
                    instantiateDeck('player2');
                }
            }
        }
    } catch (err) {
        console.error("Error checking user session:", err);
        loadMockDecks();
    }
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

        // Fetch deck custom sleeve & mat metadata safely
        try {
            const { data: deckMeta, error: deckErr } = await _supabase
                .from('decks')
                .select('sleeves, mats')
                .eq('id', deckId)
                .single();
            if (!deckErr && deckMeta) {
                state.deckSleeves[playerKey] = deckMeta.sleeves || null;
                state.deckMats[playerKey] = deckMeta.mats || null;

                // Apply player1's custom mat to the playmat background
                if (playerKey === 'player1' && deckMeta.mats) {
                    $("#playmat").css({
                        "background-image": `url('${deckMeta.mats}')`,
                        "background-size": "cover",
                        "background-position": "center"
                    });
                }
            } else {
                state.deckSleeves[playerKey] = null;
                state.deckMats[playerKey] = null;
            }
        } catch (metaE) {
            console.warn("Error fetching deck accessories, fallback:", metaE);
            state.deckSleeves[playerKey] = null;
            state.deckMats[playerKey] = null;
        }
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

    // Initialize tokens array for this player
    if (!state.deckTokens) {
        state.deckTokens = { player1: [], player2: [] };
    }
    state.deckTokens[playerKey] = [];

    // Create virtual card instances with exact section mapping
    deckCards.forEach((c, index) => {
        const section = c.section || "Main";
        if (section === "Side") {
            // Ignore Side deck completely according to instructions
            return;
        }

        // Match Tokens or Token case-insensitively
        const normalizedSection = section.trim().toLowerCase();
        if (normalizedSection === "tokens" || normalizedSection === "token") {
            state.deckTokens[playerKey].push({
                name: c.name || "Token",
                imageUrl: c.image_url || "https://vikingtcg.xyz/favi.png",
                description: c.description || c.effect || c.desc || c.text || "Ficha Especial."
            });
            return;
        }

        let targetZone = `deck_${playerSuffix}`; // Default is Main Deck
        let isExtra = false;
        if (section === "Extra") {
            if (isYGOLayout(state.layout)) {
                targetZone = `extra_${playerSuffix}`; // Extra Deck pile
                isExtra = true;
            } else {
                targetZone = `deck_${playerSuffix}`; // Force Main Deck for non-YGO
                isExtra = false;
            }
        }

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

// Multi-deck setup / Rendering
let insideRenderAllCards = false;
function renderAllCards() {
    if (window.renderAllCards && window.renderAllCards !== renderAllCards && !insideRenderAllCards) {
        insideRenderAllCards = true;
        try {
            return window.renderAllCards.apply(this, arguments);
        } finally {
            insideRenderAllCards = false;
        }
    }
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
        const isPile = card.zone.startsWith("deck_") || card.zone.startsWith("grave_") || card.zone.startsWith("banished_") || (card.zone.startsWith("extra_") && !card.zone.startsWith("extra_monster"));
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
                        `<button class="hand-action-btn btn-defense" data-instance-id="${card.instanceId}">Invoc. Def.</button>
                         <button class="hand-action-btn btn-set" data-instance-id="${card.instanceId}">Set</button>`
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
            const isP2 = card.owner === "player2" || card.zone.endsWith("_2") || card.zone === "hand_2";
            const p2Class = isP2 ? "p2-card-actions" : "";
            const isFieldZone = card.zone === "field_1" || card.zone === "field_2" || card.zone === "stadium_1" || card.zone === "stadium_2";
            const fieldZoneClass = isFieldZone ? (card.zone === "field_1" ? "field-zone-right" : "field-zone-left") : "";
            const isPokeFieldCard = state.layout === "pokemon" && card.zone && (card.zone.startsWith("active_") || card.zone.startsWith("bench_"));
            const swapBtnHTML = isPokeFieldCard ? `<button class="field-action-btn btn-field-swap" data-instance-id="${card.instanceId}">Activo/Banca</button>` : "";
            fieldActionOverlayHTML = `
                <div class="field-card-actions ${p2Class} ${fieldZoneClass}">
                    <button class="field-action-btn btn-field-attack" data-instance-id="${card.instanceId}">Atacar</button>
                    <button class="field-action-btn btn-field-direct" data-instance-id="${card.instanceId}">Atk Directo</button>
                    <button class="field-action-btn btn-field-flip" data-instance-id="${card.instanceId}">Voltear</button>
                    <button class="field-action-btn btn-field-tap" data-instance-id="${card.instanceId}">Girar</button>
                    <button class="field-action-btn btn-field-control" data-instance-id="${card.instanceId}">Control</button>
                    <button class="field-action-btn btn-field-attach" data-instance-id="${card.instanceId}">Acoplar</button>
                    <button class="field-action-btn btn-field-flash" data-instance-id="${card.instanceId}">Efecto</button>
                    <button class="field-action-btn btn-field-return" data-instance-id="${card.instanceId}">${returnBtnLabel}</button>
                    ${swapBtnHTML}
                    <button class="field-action-btn btn-field-grave" data-instance-id="${card.instanceId}">Cementerio</button>
                    <button class="field-action-btn btn-field-banish" data-instance-id="${card.instanceId}">Remover</button>
                </div>
            `;
        }

        // Attached badge for visual tracking of quantity
        const attachedBadgeHTML = attachedCount > 0 ? `<div class="card-attached-badge">📎${attachedCount}</div>` : "";

        const zIndexStyle = isHand ? "" : `z-index: ${card.z};`;

        const sleeveUrl = (card.owner && state.deckSleeves && state.deckSleeves[card.owner]) ? state.deckSleeves[card.owner] : "";
        const sleeveStyle = sleeveUrl ? `--custom-sleeve: url('${sleeveUrl}');` : "";

        let revealFaceDownClass = "";
        if (card.faceDown && !isHand && !isPile) {
            const viewerRole = window.currentRole || "player1";
            if (state.mode === "practice") {
                revealFaceDownClass = "reveal-face-down";
            } else if (state.mode === "multiplayer" && card.owner === viewerRole) {
                revealFaceDownClass = "reveal-face-down";
            }
        }
        if (card.zone && card.zone.startsWith("prize_")) {
            revealFaceDownClass = "";
        }

        const cardHTML = `
            <div class="duel-card ${card.faceDown ? 'face-down' : ''} ${revealFaceDownClass} ${card.tapped ? 'tapped' : ''}"
                 id="${card.instanceId}"
                 data-instance-id="${card.instanceId}"
                 style="--tilt: ${card.tiltAngle || 0}deg; ${sleeveStyle} ${zIndexStyle}">
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
            cardsInThisZone.sort((a, b) => (a.movedToPileAt || 0) - (b.movedToPileAt || 0));
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
            let finalX = card.x;
            let finalY = card.y;
            if (zoneObj) {
                finalX = zoneObj.x;
                finalY = zoneObj.y;
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
            attachedCards.forEach((childCard, idx) => {
                if (idx < 2) {
                    cumulativeOffset += 14; // cascade offset only for first two cards
                }
                const childZ = card.z - 14 * (idx + 1); // Maintain correct stacking order below the parent and each other

                const childSleeveUrl = (childCard.owner && state.deckSleeves && state.deckSleeves[childCard.owner]) ? state.deckSleeves[childCard.owner] : "";
                const childSleeveStyle = childSleeveUrl ? `--custom-sleeve: url('${childSleeveUrl}');` : "";

                let childRevealClass = "";
                if (childCard.faceDown) {
                    const viewerRole = window.currentRole || "player1";
                    if (state.mode === "practice") {
                        childRevealClass = "reveal-face-down";
                    } else if (state.mode === "multiplayer" && childCard.owner === viewerRole) {
                        childRevealClass = "reveal-face-down";
                    }
                }
                if (childCard.zone && childCard.zone.startsWith("prize_")) {
                    childRevealClass = "";
                }

                const childCardHTML = `
                    <div class="duel-card attached-card-cascade ${childCard.faceDown ? 'face-down' : ''} ${childRevealClass} ${childCard.tapped ? 'tapped' : ''}"
                         id="${childCard.instanceId}"
                         data-instance-id="${childCard.instanceId}"
                         data-parent-id="${card.instanceId}"
                         style="left: ${finalX + cumulativeOffset}px; top: ${finalY + cumulativeOffset}px; z-index: ${childZ}; --tilt: ${childCard.tiltAngle || 0}deg; ${childSleeveStyle}">
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
        } else if ($(this).hasClass("btn-defense")) {
            startGraphicalTargeting(cardObj, "defense");
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
            cardObj.zone = `grave_${playerSuffix}`;
            cardObj.faceDown = false;
            cardObj.tapped = false;
            cardObj.movedToPileAt = Date.now() + Math.random();
            renderAllCards();
        } else if ($(this).hasClass("btn-deck")) {
            cardObj.zone = `deck_${playerSuffix}`;
            cardObj.faceDown = true;
            cardObj.tapped = false;
            renderAllCards();

            Swal.fire({
                title: '¡Carta enviada al Deck!',
                html: `
                    <p style="margin-bottom: 15px; font-weight: 600;">Se ha enviado esta carta desde la Mano al Deck:</p>
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                        <img src="${cardObj.imageUrl}" style="width: 150px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.5);" />
                        <h3 style="color: #00d2ff; font-family: 'Orbitron', sans-serif; font-size: 1.1rem; margin-top: 5px;">${cardObj.name}</h3>
                    </div>
                `,
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#00d2ff'
            });
        } else if ($(this).hasClass("btn-banish")) {
            cardObj.zone = `banished_${playerSuffix}`;
            cardObj.faceDown = false;
            cardObj.tapped = false;
            cardObj.movedToPileAt = Date.now() + Math.random();
            renderAllCards();
        }
    });

    // Event handlers for Field Quick Actions (Overlays)
    $(".field-action-btn").off("click").on("click", function(e) {
        if ($(this).hasClass("btn-field-attack") || $(this).hasClass("btn-field-direct")) {
            // Let these bubble up to duel.html's attack handlers!
            return;
        }

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
        } else if ($(this).hasClass("btn-field-control")) {
            // Swap controller ONLY, leave owner intact!
            cardObj.controller = cardObj.controller === "player1" ? "player2" : "player1";
            detachAllChildren(cardObj.instanceId);
            startGraphicalTargeting(cardObj, "summon");

            Swal.fire({
                icon: 'info',
                title: 'Control Cambiado',
                text: `Ahora controlas a ${cardObj.name}. Selecciona una zona para colocarla de tu lado.`,
                toast: true,
                position: 'top-end',
                timer: 2500,
                showConfirmButton: false
            });
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
            const originalOwnerSuffix = cardObj.owner === "player1" ? 1 : 2;
            if (cardObj.isExtra) {
                // Return to original owner's Extra Deck face-down
                cardObj.zone = `extra_${originalOwnerSuffix}`;
                cardObj.faceDown = true;
                cardObj.tapped = false;
            } else {
                // Return to original owner's Hand
                cardObj.zone = `hand_${originalOwnerSuffix}`;
            }
            cardObj.controller = cardObj.owner; // Reset controller back to owner
            cardObj.attachedTo = null; // detach on return
            renderAllCards();
        } else if ($(this).hasClass("btn-field-grave")) {
            const originalOwnerSuffix = cardObj.owner === "player1" ? 1 : 2;
            const pileId = `grave_${originalOwnerSuffix}`;
            sendAttachedCardsToPile(cardObj.instanceId, pileId);
            cardObj.zone = pileId;
            cardObj.controller = cardObj.owner; // Reset controller back to owner
            cardObj.faceDown = false;
            cardObj.tapped = false;
            cardObj.attachedTo = null; // detach on discard
            renderAllCards();
        } else if ($(this).hasClass("btn-field-swap")) {
            startPokemonSwapTargeting(cardObj);
        } else if ($(this).hasClass("btn-field-banish")) {
            const originalOwnerSuffix = cardObj.owner === "player1" ? 1 : 2;
            const pileId = `banished_${originalOwnerSuffix}`;
            sendAttachedCardsToPile(cardObj.instanceId, pileId);
            cardObj.zone = pileId;
            cardObj.controller = cardObj.owner; // Reset controller back to owner
            cardObj.faceDown = false;
            cardObj.tapped = false;
            cardObj.attachedTo = null; // detach on banish
            renderAllCards();
        }
    });

    // Click / Contextmenu on attached card cascade to open the Attached Cards Modal
    $(".attached-card-cascade").off("click contextmenu mousedown").on("click contextmenu mousedown", function(e) {
        e.preventDefault();
        e.stopPropagation();
        const parentId = $(this).data("parent-id");
        openAttachedCardsModal(parentId);
    });

    cards.off('mousedown touchstart').on('mousedown touchstart', function(e) {
        // If clicking on any quick-action button, menu, or counter container, do NOT drag or intercept!
        if ($(e.target).closest('.hand-card-actions, .field-card-actions, .field-action-btn, .hand-action-btn, .card-counter-container').length) {
            return;
        }

        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (!cardObj) return;

        // If we are in attack targeting mode, bypass dragging and click handling in mousedown
        if (typeof window.activeAttackSourceCard !== "undefined" && window.activeAttackSourceCard) {
            return;
        }

        // Prevent dragging deck cards or attached cards
        if (cardObj.zone.startsWith("deck_") || cardObj.attachedTo) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        // Visual preview selection
        updatePreview(cardObj);

        dragCard = $(this);
        dragCard.addClass("dragging").removeClass("snapping");

        // Bring to front physically on screen
        const maxZ = state.cards.length > 0 ? Math.max(...state.cards.map(c => c.z)) : 10;
        cardObj.z = maxZ + 1;
        dragCard.css("z-index", cardObj.z);

        const pos = getEventCoords(e);
        const cardOffset = $(this).offset();
        const matOffset = $("#playmat").offset();
        const rect = $("#playmat")[0].getBoundingClientRect();
        const scale = rect.width / $("#playmat")[0].offsetWidth || 1;

        // Physical position of the card inside the playmat coordinates (unscaled)
        const elemLeft = (cardOffset.left - matOffset.left) / scale;
        const elemTop = (cardOffset.top - matOffset.top) / scale;

        // Calculate offset in internal coordinates relative to mouse/touch position
        dragOffset.x = (pos.x - matOffset.left) / scale - elemLeft;
        dragOffset.y = (pos.y - matOffset.top) / scale - elemTop;
        dragStartCoords = { x: pos.x, y: pos.y };
        dragStartTime = Date.now();
    });
}

// Helper to resolve client touch vs mouse coords
function getEventCoords(e) {
    const oe = e.originalEvent || e;
    if (oe.touches && oe.touches.length > 0) {
        return { x: oe.touches[0].clientX, y: oe.touches[0].clientY, clientX: oe.touches[0].clientX, clientY: oe.touches[0].clientY };
    }
    if (oe.changedTouches && oe.changedTouches.length > 0) {
        return { x: oe.changedTouches[0].clientX, y: oe.changedTouches[0].clientY, clientX: oe.changedTouches[0].clientX, clientY: oe.changedTouches[0].clientY };
    }
    return { x: e.clientX || oe.clientX || 0, y: e.clientY || oe.clientY || 0, clientX: e.clientX || oe.clientX || 0, clientY: e.clientY || oe.clientY || 0 };
}

// Global window event listeners for active drag tracking

// Helper to find parent cards under coordinate
function findOverlappingCard(coords, excludeInstanceId) {
    // Only search active field/mat parent cards (no hand, no decks, no discarded)
    const candidates = state.cards.filter(c =>
        c.instanceId !== excludeInstanceId &&
        !c.attachedTo &&
        !c.zone.startsWith("hand_") &&
        !c.zone.startsWith("deck_") &&
        !(c.zone.startsWith("extra_") && !c.zone.startsWith("extra_monster")) &&
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
    if (card.zone && card.zone.startsWith("prize_") && card.faceDown) {
        const defaultBack = (state.layout === "pokemon") ? "img/pokeBocaAbajo.jpg" : "img/bocabajo.jpg";
        const backImg = (card.owner && state.deckSleeves && state.deckSleeves[card.owner]) ? state.deckSleeves[card.owner] : defaultBack;
        $("#detail-card-img").attr("src", backImg);
        $("#detail-card-name").text("Carta Boca Abajo");
        $("#detail-card-desc").text(`Propietario: ${card.owner === "player1" ? "Jugador 1" : "Jugador 2"}\nZona: ${card.zone.toUpperCase()}\nEstado: Boca Abajo\nContadores: ${card.counters}\n\n[Detalles ocultos para evitar trampas]`);
        return;
    }

    // Face-up Pendulum cards in the Extra Deck can be previewed by anyone
    const isExtraFaceUp = (card.zone.startsWith("extra_") && !card.zone.startsWith("extra_monster") && card.faceDown === false);
    const isPile = (card.zone.startsWith("deck_") || (card.zone.startsWith("extra_") && !card.zone.startsWith("extra_monster")) || card.zone.startsWith("prize_")) && !isExtraFaceUp;
    let isFaceDown = card.faceDown && !card.zone.startsWith("hand_");

    // Seteadas de mi lado (player1) en el campo se pueden ver en el preview
    if (isFaceDown && card.owner === "player1" && !isPile) {
        isFaceDown = false;
    }

    if (isPile || isFaceDown) {
        const defaultBack = (state.layout === "pokemon") ? "img/pokeBocaAbajo.jpg" : "img/bocabajo.jpg";
        const backImg = (card.owner && state.deckSleeves && state.deckSleeves[card.owner]) ? state.deckSleeves[card.owner] : defaultBack;
        $("#detail-card-img").attr("src", backImg);
        $("#detail-card-name").text("Carta Boca Abajo");
        $("#detail-card-desc").text(`Propietario: ${card.owner === "player1" ? "Jugador 1" : "Jugador 2"}\nZona: ${card.zone.toUpperCase()}\nEstado: Boca Abajo\nContadores: ${card.counters}\n\n[Detalles ocultos para evitar trampas]`);
    } else {
        $("#detail-card-img").attr("src", card.imageUrl);
        $("#detail-card-name").text(card.name);
        let descText = `Propietario: ${card.owner === "player1" ? "Jugador 1" : "Jugador 2"}\nZona: ${card.zone.toUpperCase()}\nEstado: ${card.faceDown ? "Boca Abajo (Revelada para ti)" : "Boca Arriba"}\nContadores: ${card.counters}`;
        $("#detail-card-desc").text(descText);
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
let insideShuffleDeck = false;
function shuffleDeck(playerKey) {
    if (window.shuffleDeck && window.shuffleDeck !== shuffleDeck && !insideShuffleDeck) {
        insideShuffleDeck = true;
        try {
            return window.shuffleDeck.apply(this, arguments);
        } finally {
            insideShuffleDeck = false;
        }
    }
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
let insideSetupPokemonPrizes = false;
function setupPokemonPrizes(playerKey) {
    if (window.setupPokemonPrizes && window.setupPokemonPrizes !== setupPokemonPrizes && !insideSetupPokemonPrizes) {
        insideSetupPokemonPrizes = true;
        try {
            return window.setupPokemonPrizes.apply(this, arguments);
        } finally {
            insideSetupPokemonPrizes = false;
        }
    }
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
        card.zone = `${prizePrefix}${i + 1}`;
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
let insideDrawCards = false;
function drawCards(playerKey, count = 1) {
    if (window.drawCards && window.drawCards !== drawCards && !insideDrawCards) {
        insideDrawCards = true;
        try {
            return window.drawCards.apply(this, arguments);
        } finally {
            insideDrawCards = false;
        }
    }
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
        const isOwner = (playerKey === (typeof currentRole !== "undefined" ? currentRole : "player1"));
        extraCards.forEach(card => {
            // Anti-cheat: mask image if the card is face-down and viewer is NOT the owner of the Extra Deck (always bypass in Practice Mode so both players' Extra Decks are fully visible face-up in the list modal)
            const showBack = (card.faceDown !== false) && !isOwner && (state.mode !== "practice");
            const defaultBack = (state.layout === "pokemon") ? "img/pokeBocaAbajo.jpg" : "img/bocabajo.jpg";
            const backImg = (card.owner && state.deckSleeves && state.deckSleeves[card.owner]) ? state.deckSleeves[card.owner] : defaultBack;
            const imgSrc = showBack ? backImg : card.imageUrl;

            const cardHTML = `
                <div class="extra-deck-card-container" data-instance-id="${card.instanceId}">
                    <img src="${imgSrc}" alt="${card.name}">
                    <div class="extra-deck-card-hover-overlay" style="flex-direction: column; gap: 6px;">
                        <button class="extra-card-action-btn btn-extra-summon" data-instance-id="${card.instanceId}">Invocar</button>
                        <button class="extra-card-action-btn btn-extra-defense" data-instance-id="${card.instanceId}">Invocar en defensa</button>
                        <button class="extra-card-action-btn btn-extra-xyz" data-instance-id="${card.instanceId}" style="background: #ffd32d; color: black; box-shadow: 0 4px 10px rgba(255, 211, 45, 0.5);">XYZ</button>
                        <button class="extra-card-action-btn btn-extra-zoom" data-instance-id="${card.instanceId}">Ver carta</button>
                    </div>
                </div>
            `;
            $("#extra-cards-grid").append(cardHTML);
        });
    }

    $("#extra-overlay").fadeIn(200).css("display", "flex");

    // Click Invocar button to start targeting mode on the field (Delegated for loop cloning support)
    $("#extra-cards-grid").off("click").on("click", ".btn-extra-summon", function(e) {
        e.preventDefault();
        e.stopPropagation();
        const container = $(this).closest(".extra-deck-card-container");
        if (!container.hasClass("active-menu")) {
            $(".pile-card-container, .extra-deck-card-container, .search-card-item").removeClass("active-menu");
            container.addClass("active-menu");
            return;
        }
        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (cardObj) {
            $("#extra-overlay").fadeOut(200);
            startGraphicalTargeting(cardObj, "summon");
        }
    });

    // Click Invocar en defensa button to start defense targeting mode
    $("#extra-cards-grid").on("click", ".btn-extra-defense", function(e) {
        e.preventDefault();
        e.stopPropagation();
        const container = $(this).closest(".extra-deck-card-container");
        if (!container.hasClass("active-menu")) {
            $(".pile-card-container, .extra-deck-card-container, .search-card-item").removeClass("active-menu");
            container.addClass("active-menu");
            return;
        }
        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (cardObj) {
            $("#extra-overlay").fadeOut(200);
            startGraphicalTargeting(cardObj, "defense");
        }
    });

    // Click zoom button to view card details (Delegated for loop cloning support)
    $("#extra-cards-grid").on("click", ".btn-extra-zoom", function(e) {
        e.preventDefault();
        e.stopPropagation();
        const container = $(this).closest(".extra-deck-card-container");
        if (!container.hasClass("active-menu")) {
            $(".pile-card-container, .extra-deck-card-container, .search-card-item").removeClass("active-menu");
            container.addClass("active-menu");
            return;
        }
        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (cardObj) {
            const zoomUrl = window.getCardZoomImage(cardObj);
            window.showCustomCardZoom(zoomUrl);
        }
    });

    // Click XYZ button to start XYZ targeting mode on the field (Delegated for loop cloning support)
    $("#extra-cards-grid").on("click", ".btn-extra-xyz", function(e) {
        e.preventDefault();
        e.stopPropagation();
        const container = $(this).closest(".extra-deck-card-container");
        if (!container.hasClass("active-menu")) {
            $(".pile-card-container, .extra-deck-card-container, .search-card-item").removeClass("active-menu");
            container.addClass("active-menu");
            return;
        }
        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (cardObj) {
            $("#extra-overlay").fadeOut(200);
            startXYZTargeting(cardObj);
        }
    });
}

// Graphical zone selection mechanics
function startGraphicalTargeting(cardObj, actionType) {
    targetingCard = cardObj;
    targetActionType = actionType;

    // Display the guidance overlay
    if (actionType !== "set") {
        $("#zone-picker-overlay").fadeIn(200).css("display", "flex");
    }
    $("#playmat").addClass("selecting-zone");

    // Temporarily bind click event strictly to board zones
    $(".board-zone").off("click.targeting").on("click.targeting", function(e) {
        e.preventDefault();
        e.stopPropagation();

        const zoneId = $(this).data("id");
        const zoneObj = BOARD_LAYOUTS[state.layout].find(z => z.id === zoneId);

        // Execute the targeted action on the selected zone!
        if (targetingCard) {
            targetingCard.zone = zoneId;

            const isMonsterZone = (zoneObj && zoneObj.type === "monster") || (zoneId && (zoneId.startsWith("monster_") || zoneId.startsWith("extra_monster_") || zoneId.startsWith("char_") || zoneId.startsWith("ninja_") || zoneId.startsWith("creature_") || zoneId.startsWith("battle_")));

            if (isYGOLayout(state.layout)) {
                // Symmetrical placement rules for Yu-Gi-Oh!
                if (targetActionType === "set") {
                    targetingCard.faceDown = true;
                    targetingCard.tapped = isMonsterZone ? true : false; // Monster set is rotated/horizontal, Spell/Trap set is upright
                } else if (targetActionType === "defense") {
                    targetingCard.faceDown = false;
                    targetingCard.tapped = true; // Defense mode is rotated/horizontal, face-up
                } else {
                    targetingCard.faceDown = false;
                    targetingCard.tapped = false; // Summon mode is upright, face-up
                }
            } else {
                // Pokémon placement rules (everything on the playmat is face-up except deck and prizes)
                targetingCard.faceDown = false;
                if (targetActionType === "defense") {
                    targetingCard.tapped = true;
                } else {
                    targetingCard.tapped = false;
                }
            }

            renderAllCards();

            if (targetActionType !== "set") {
                Swal.fire({
                    icon: 'success',
                    title: 'Carta Colocada',
                    text: `${targetingCard.name} colocada en ${$(this).find('.zone-label').text() || zoneId}.`,
                    toast: true,
                    position: 'top-end',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
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
    $(document).off("keydown.targeting");
}

function startXYZTargeting(cardObj) {
    xyzCard = cardObj;

    // Display targeting instructions Toast
    $("#zone-picker-overlay").html(`
        <div class="zone-picker-toast" style="background: linear-gradient(135deg, #00d2ff, #ffd32d); box-shadow: 0 10px 30px rgba(0, 210, 255, 0.5);">
            <i class="fas fa-layer-group animate-pulse"></i> Elige una carta en el campo para colocar esta carta encima (XYZ)
        </div>
    `).fadeIn(200).css("display", "flex");

    $("#playmat").addClass("selecting-zone");

    // Bind temporary click event exclusively to visible field parent cards
    setTimeout(() => {
        // Prevent clicking any card that is currently attached
        $(".duel-card").not(".attached-card-cascade").off("click.xyz").on("click.xyz", function(e) {
            e.preventDefault();
            e.stopPropagation();

            const targetInstId = $(this).data("instance-id");
            const parentCardObj = state.cards.find(c => c.instanceId === targetInstId);

            if (parentCardObj && xyzCard) {
                // Bring xyzCard to front so it is visually on top of everything
                const maxZ = state.cards.length > 0 ? Math.max(...state.cards.map(c => c.z)) : 10;
                xyzCard.z = maxZ + 1;

                // target/parentCardObj becomes attached to the new xyzCard
                xyzCard.zone = parentCardObj.zone;
                xyzCard.x = parentCardObj.x;
                xyzCard.y = parentCardObj.y;
                xyzCard.faceDown = false;
                xyzCard.tapped = parentCardObj.tapped;
                xyzCard.isExtra = true;

                // Move all currently attached cards of target to the new parent (xyzCard)
                state.cards.forEach(c => {
                    if (c.attachedTo === parentCardObj.instanceId) {
                        c.attachedTo = xyzCard.instanceId;
                    }
                });

                // Parent itself gets attached to xyzCard
                parentCardObj.attachedTo = xyzCard.instanceId;
                parentCardObj.attachedAt = Date.now() + Math.random();

                renderAllCards();

                Swal.fire({
                    icon: 'success',
                    title: 'Invocación XYZ',
                    text: `${xyzCard.name} ha sido colocada encima de ${parentCardObj.name} (XYZ).`,
                    toast: true,
                    position: 'top-end',
                    timer: 2000,
                    showConfirmButton: false
                });
            }

            stopXYZTargeting();
        });
    }, 100);

    // Cancel on ESC
    $(document).off("keydown.xyz").on("keydown.xyz", function(e) {
        if (e.key === "Escape") {
            stopXYZTargeting();
        }
    });
}

function stopXYZTargeting() {
    xyzCard = null;
    $("#zone-picker-overlay").fadeOut(150).html(`
        <div class="zone-picker-toast">
            <i class="fas fa-bullseye animate-pulse"></i> Selecciona la zona del tablero para colocar la carta
        </div>
    `);
    $("#playmat").removeClass("selecting-zone");
    $(".duel-card").off("click.xyz");
    $(document).off("keydown.xyz");
}

function detachAllChildren(parentId) {
    const parent = state.cards.find(c => c.instanceId === parentId);
    if (!parent) return;
    const playerSuffix = parent.owner === "player1" ? 1 : 2;
    const pileId = `grave_${playerSuffix}`;
    state.cards.forEach(c => {
        if (c.attachedTo === parentId) {
            c.attachedTo = null;
            c.zone = pileId;
            c.faceDown = false;
            c.tapped = false;
            c.movedToPileAt = Date.now() + Math.random();
        }
    });
}

function sendAttachedCardsToPile(parentId, pileId) {
    const parent = state.cards.find(c => c.instanceId === parentId);
    if (!parent) return;

    // Get all attached cards
    const attached = state.cards.filter(c => c.attachedTo === parentId);

    // Sort attached cards by attachedAt ascending (first attached first)
    attached.sort((a, b) => (a.attachedAt || 0) - (b.attachedAt || 0));

    // Assign timestamps to maintain perfect graveyard ordering: earlier attached -> older timestamp, parent -> absolute newest
    const baseTime = Date.now();
    attached.forEach((c, index) => {
        c.attachedTo = null;
        c.zone = pileId;
        c.faceDown = false;
        c.tapped = false;
        c.movedToPileAt = baseTime + index;
    });

    // Parent itself is newer than any child
    parent.movedToPileAt = baseTime + attached.length + 10;
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
                            <button class="pile-card-action-btn btn-attached-extra" data-instance-id="${card.instanceId}">Extra Deck</button>
                            <button class="pile-card-action-btn btn-attached-pendulum" data-instance-id="${card.instanceId}">Péndulo</button>
                            <button class="pile-card-action-btn btn-attached-zoom" data-instance-id="${card.instanceId}">Ver carta</button>
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

        const container = $(this).closest(".pile-card-container, .extra-deck-card-container, .search-card-item");
        if (!container.hasClass("active-menu")) {
            $(".pile-card-container, .extra-deck-card-container, .search-card-item").removeClass("active-menu");
            container.addClass("active-menu");
            return;
        }

        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (!cardObj) return;

        const playerSuffix = cardObj.owner === "player1" ? 1 : 2;

        if ($(this).hasClass("btn-attached-zoom")) {
            const zoomUrl = window.getCardZoomImage(cardObj);
            window.showCustomCardZoom(zoomUrl);
            return;
        }

        cardObj.attachedTo = null; // Detach first!

        if ($(this).hasClass("btn-attached-hand")) {
            cardObj.zone = cardObj.owner === "player1" ? "hand_1" : "hand_2";
            cardObj.faceDown = false;
            cardObj.tapped = false;
        } else if ($(this).hasClass("btn-attached-grave")) {
            cardObj.zone = `grave_${playerSuffix}`;
            cardObj.faceDown = false;
            cardObj.tapped = false;
            cardObj.movedToPileAt = Date.now() + Math.random();
        } else if ($(this).hasClass("btn-attached-banish")) {
            cardObj.zone = `banished_${playerSuffix}`;
            cardObj.faceDown = false;
            cardObj.tapped = false;
            cardObj.movedToPileAt = Date.now() + Math.random();
        } else if ($(this).hasClass("btn-attached-deck")) {
            cardObj.zone = `deck_${playerSuffix}`;
            cardObj.faceDown = true;
            cardObj.tapped = false;
        } else if ($(this).hasClass("btn-attached-extra")) {
            cardObj.zone = `extra_${playerSuffix}`;
            cardObj.faceDown = true;
            cardObj.tapped = false;
            if (typeof sendGameAction === "function") {
                sendGameAction(`Desacopló y envió al Extra Deck: 📁 ${cardObj.name}`);
            }
        } else if ($(this).hasClass("btn-attached-pendulum")) {
            cardObj.zone = `extra_${playerSuffix}`;
            cardObj.faceDown = false;
            cardObj.tapped = false;
            if (typeof sendGameAction === "function") {
                sendGameAction(`Desacopló y envió al Extra Deck (Péndulo Boca Arriba): 🌟 ${cardObj.name}`);
            }
        }

        renderAllCards();
        openAttachedCardsModal(parentId); // Refresh
    });
}

let equipSourceCard = null;

function startEquipTargeting(cardObj) {
    equipSourceCard = cardObj;

    $("#zone-picker-overlay").html(`
        <div class="zone-picker-toast" style="background: linear-gradient(135deg, #00d2ff, #0072ff); box-shadow: 0 10px 30px rgba(0, 210, 255, 0.5);">
            <i class="fas fa-link animate-pulse"></i> Elige una carta en el campo para equipar esta carta
        </div>
    `).fadeIn(200).css("display", "flex");

    $("#playmat").addClass("selecting-zone");

    setTimeout(() => {
        $(".duel-card").not(`#${cardObj.instanceId}`).off("click.equip").on("click.equip", function(e) {
            e.preventDefault();
            e.stopPropagation();

            const targetInstId = $(this).data("instance-id");
            const targetCardObj = state.cards.find(c => c.instanceId === targetInstId);

            if (targetCardObj && equipSourceCard) {
                equipSourceCard.equippedTo = targetCardObj.instanceId;

                renderAllCards();

                Swal.fire({
                    icon: 'success',
                    title: 'Carta Equipada',
                    text: `${equipSourceCard.name} equipada a ${targetCardObj.name}.`,
                    toast: true,
                    position: 'top-end',
                    timer: 2000,
                    showConfirmButton: false
                });
            }

            stopEquipTargeting();
        });
    }, 100);

    $(document).off("keydown.equip").on("keydown.equip", function(e) {
        if (e.key === "Escape") {
            stopEquipTargeting();
        }
    });
}

function stopEquipTargeting() {
    equipSourceCard = null;
    $("#zone-picker-overlay").fadeOut(200);
    $("#playmat").removeClass("selecting-zone");
    $(".duel-card").off("click.equip");
    $(document).off("keydown.equip");
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
                // Flat-map transfer any cards already attached to attachingCard
                state.cards.forEach(c => {
                    if (c.attachedTo === attachingCard.instanceId) {
                        c.attachedTo = parentCardObj.instanceId;
                    }
                });

                // Bring parentCardObj to front so it is visually on top of everything
                const maxZ = state.cards.length > 0 ? Math.max(...state.cards.map(c => c.z)) : 10;
                parentCardObj.z = maxZ + 1;

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

let activeSwapSourceCard = null;

function startPokemonSwapTargeting(cardObj) {
    activeSwapSourceCard = cardObj;

    // Close any open menus
    $("#card-menu").removeClass("active");

    // Display targeting instructions Toast
    $("#zone-picker-overlay").html(`
        <div class="zone-picker-toast" style="background: linear-gradient(135deg, #a855f7, #6366f1); box-shadow: 0 10px 30px rgba(99, 102, 241, 0.5); padding: 12px 24px; border-radius: 8px; font-weight: bold; color: #fff; display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-exchange-alt animate-pulse"></i> Elige un Pokémon o zona (Activo/Banca) de tu lado para cambiar posición
        </div>
    `).fadeIn(200).css("display", "flex");

    $("#playmat").addClass("selecting-zone");

    // Bind click to zones and other cards
    setTimeout(() => {
        // Prevent clicking the same card
        $(".duel-card").not(`#${cardObj.instanceId}`).off("click.swap").on("click.swap", function(e) {
            e.preventDefault();
            e.stopPropagation();

            const targetInstId = $(this).data("instance-id");
            const targetCardObj = state.cards.find(c => c.instanceId === targetInstId);

            if (targetCardObj && activeSwapSourceCard) {
                const playerSuffix = activeSwapSourceCard.owner === "player1" ? 1 : 2;
                // We check if target is inside P1/P2 active or bench zones
                const targetZone = targetCardObj.zone;
                const isTargetValid = targetZone === `active_${playerSuffix}` || targetZone.startsWith(`bench_${playerSuffix}_`);

                if (isTargetValid) {
                    const tempZone = activeSwapSourceCard.zone;
                    activeSwapSourceCard.zone = targetZone;
                    targetCardObj.zone = tempZone;
                    renderAllCards();

                    Swal.fire({
                        icon: 'success',
                        title: 'Posición Cambiada',
                        text: `${activeSwapSourceCard.name} se intercambió con ${targetCardObj.name}.`,
                        toast: true,
                        position: 'top-end',
                        timer: 2000,
                        showConfirmButton: false
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Zona Inválida',
                        text: 'Solo puedes cambiar posición con Pokémon de tu lado (Activo/Banca).',
                        toast: true,
                        position: 'top-end',
                        timer: 2500,
                        showConfirmButton: false
                    });
                }
            }
            stopPokemonSwapTargeting();
        });

        // Click empty zone
        $(".board-zone").off("click.swap").on("click.swap", function(e) {
            e.preventDefault();
            e.stopPropagation();

            const zoneId = $(this).data("id");
            if (activeSwapSourceCard) {
                const playerSuffix = activeSwapSourceCard.owner === "player1" ? 1 : 2;
                const isTargetValid = zoneId === `active_${playerSuffix}` || zoneId.startsWith(`bench_${playerSuffix}_`);

                if (isTargetValid) {
                    activeSwapSourceCard.zone = zoneId;
                    renderAllCards();

                    Swal.fire({
                        icon: 'success',
                        title: 'Posición Cambiada',
                        text: `${activeSwapSourceCard.name} se movió a la zona seleccionada.`,
                        toast: true,
                        position: 'top-end',
                        timer: 2000,
                        showConfirmButton: false
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Zona Inválida',
                        text: 'Solo puedes mover el Pokémon a tu lado del campo (Activo/Banca).',
                        toast: true,
                        position: 'top-end',
                        timer: 2500,
                        showConfirmButton: false
                    });
                }
            }
            stopPokemonSwapTargeting();
        });
    }, 100);

    // Cancel on click outside cards/zones
    $(document).off("click.swap_cancel").on("click.swap_cancel", function(e) {
        if (!$(e.target).closest(".duel-card, .board-zone, .field-card-actions, #card-menu").length) {
            stopPokemonSwapTargeting();
        }
    });

    // Cancel on ESC
    $(document).off("keydown.swap").on("keydown.swap", function(e) {
        if (e.key === "Escape") {
            stopPokemonSwapTargeting();
        }
    });
}

function stopPokemonSwapTargeting() {
    activeSwapSourceCard = null;
    $("#zone-picker-overlay").fadeOut(150).html(`
        <div class="zone-picker-toast">
            <i class="fas fa-bullseye animate-pulse"></i> Selecciona la zona del tablero para colocar la carta
        </div>
    `);
    $("#playmat").removeClass("selecting-zone");
    $(".duel-card").off("click.swap");
    $(".board-zone").off("click.swap");
    $(document).off("click.swap_cancel");
    $(document).off("keydown.swap");
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
                            <button class="pile-card-action-btn btn-search-defense" data-instance-id="${card.instanceId}">Invocar en defensa</button>
                            <button class="pile-card-action-btn btn-search-set" data-instance-id="${card.instanceId}">Set</button>
                                    <button class="pile-card-action-btn btn-search-attach" data-instance-id="${card.instanceId}">Acoplar</button>
                            <button class="pile-card-action-btn btn-search-grave" data-instance-id="${card.instanceId}">Grave</button>
                            <button class="pile-card-action-btn btn-search-banish" data-instance-id="${card.instanceId}">Remover</button>
                            <button class="pile-card-action-btn btn-search-extra" data-instance-id="${card.instanceId}">Extra Deck</button>
                            <button class="pile-card-action-btn btn-search-pendulum" data-instance-id="${card.instanceId}">Péndulo</button>
                            <button class="pile-card-action-btn btn-search-zoom" data-instance-id="${card.instanceId}">Ver carta</button>
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

        const container = $(this).closest(".pile-card-container, .extra-deck-card-container, .search-card-item");
        if (!container.hasClass("active-menu")) {
            $(".pile-card-container, .extra-deck-card-container, .search-card-item").removeClass("active-menu");
            container.addClass("active-menu");
            return;
        }

        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (!cardObj) return;

        const pSuffix = cardObj.owner === "player1" ? 1 : 2;

        if ($(this).hasClass("btn-search-zoom")) {
            const zoomUrl = window.getCardZoomImage(cardObj);
            window.showCustomCardZoom(zoomUrl);
            return;
        }

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
        } else if ($(this).hasClass("btn-search-defense")) {
            $("#search-overlay").fadeOut(200);
            startGraphicalTargeting(cardObj, "defense");
        } else if ($(this).hasClass("btn-search-set")) {
            $("#search-overlay").fadeOut(200);
            startGraphicalTargeting(cardObj, "set");
        } else if ($(this).hasClass("btn-search-attach")) {
            $("#search-overlay").fadeOut(200);
            startAttachmentTargeting(cardObj);
        } else if ($(this).hasClass("btn-search-grave")) {
            cardObj.zone = `grave_${pSuffix}`;
            cardObj.faceDown = false;
            cardObj.tapped = false;
            cardObj.movedToPileAt = Date.now() + Math.random();
            renderAllCards();
            openSearchModal(playerKey); // refresh
        } else if ($(this).hasClass("btn-search-banish")) {
            cardObj.zone = `banished_${pSuffix}`;
            cardObj.faceDown = false;
            cardObj.tapped = false;
            cardObj.movedToPileAt = Date.now() + Math.random();
            renderAllCards();
            openSearchModal(playerKey); // refresh
        } else if ($(this).hasClass("btn-search-extra")) {
            cardObj.zone = `extra_${pSuffix}`;
            cardObj.faceDown = true;
            cardObj.tapped = false;
            renderAllCards();
            openSearchModal(playerKey); // refresh
            if (typeof sendGameAction === "function") {
                sendGameAction(`Buscó y envió al Extra Deck: 📁 ${cardObj.name}`);
            }
        } else if ($(this).hasClass("btn-search-pendulum")) {
            cardObj.zone = `extra_${pSuffix}`;
            cardObj.faceDown = false;
            cardObj.tapped = false;
            renderAllCards();
            openSearchModal(playerKey); // refresh
            if (typeof sendGameAction === "function") {
                sendGameAction(`Buscó y envió al Extra Deck (Péndulo Boca Arriba): 🌟 ${cardObj.name}`);
            }
        }
    });
}

// Open Graveyard or Banished Pile Modal Viewer
function openPileModal(playerKey, pileType) {
    activePileModalType = pileType;
    activePileModalPlayer = playerKey;
    selectedPileCards = [];
    $("#pile-multi-select-toggle").prop("checked", false);
    $("#pile-batch-actions").hide();
    $("#pile-overlay").removeClass("pile-multi-select-active");

    const playerSuffix = playerKey === "player1" ? 1 : 2;
    const zoneId = `${pileType}_${playerSuffix}`;
    const pileCards = state.cards.filter(c => c.zone === zoneId);

    // Sort pileCards descending by movedToPileAt so latest is displayed first
    pileCards.sort((a, b) => (b.movedToPileAt || 0) - (a.movedToPileAt || 0));

    // Dynamic titles depending on pileType and layout
    let title = "";
    if (pileType === "grave") {
        if (isYGOLayout(state.layout)) {
            title = "Cementerio";
        } else {
            title = "Descarte / Trash";
        }
    } else {
        if (isYGOLayout(state.layout)) {
            title = "Desterrado";
        } else if (state.layout === "pokemon") {
            title = "Mano de Premios / Removido";
        } else {
            title = "Exilio / Desterrado";
        }
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
                            <button class="pile-card-action-btn btn-pile-defense" data-instance-id="${card.instanceId}">Invocar en defensa</button>
                            <button class="pile-card-action-btn btn-pile-set" data-instance-id="${card.instanceId}">Set</button>
                            <button class="pile-card-action-btn btn-pile-attach" data-instance-id="${card.instanceId}">Acoplar</button>
                            <button class="pile-card-action-btn btn-pile-hand" data-instance-id="${card.instanceId}">Mano</button>
                            <button class="pile-card-action-btn btn-pile-deck" data-instance-id="${card.instanceId}">Deck</button>
                            ${pileType === 'grave' ?
                                `<button class="pile-card-action-btn btn-pile-banish" data-instance-id="${card.instanceId}">Remover</button>` :
                                `<button class="pile-card-action-btn btn-pile-grave" data-instance-id="${card.instanceId}">Cementerio</button>`
                            }
                            <button class="pile-card-action-btn btn-pile-extra" data-instance-id="${card.instanceId}">Extra Deck</button>
                            <button class="pile-card-action-btn btn-pile-pendulum" data-instance-id="${card.instanceId}">Péndulo</button>
                            <button class="pile-card-action-btn btn-pile-effect" data-instance-id="${card.instanceId}">Efecto</button>
                            <button class="pile-card-action-btn btn-pile-zoom" data-instance-id="${card.instanceId}">Ver carta</button>
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

        const container = $(this).closest(".pile-card-container, .extra-deck-card-container, .search-card-item");
        if (!container.hasClass("active-menu")) {
            $(".pile-card-container, .extra-deck-card-container, .search-card-item").removeClass("active-menu");
            container.addClass("active-menu");
            return;
        }

        const instId = $(this).data("instance-id");
        const cardObj = state.cards.find(c => c.instanceId === instId);
        if (!cardObj) return;

        const pSuffix = cardObj.owner === "player1" ? 1 : 2;

        if ($(this).hasClass("btn-pile-zoom")) {
            const zoomUrl = window.getCardZoomImage(cardObj);
            window.showCustomCardZoom(zoomUrl);
            return;
        }

        if ($(this).hasClass("btn-pile-summon")) {
            $("#pile-overlay").fadeOut(200);
            startGraphicalTargeting(cardObj, "summon");
        } else if ($(this).hasClass("btn-pile-defense")) {
            $("#pile-overlay").fadeOut(200);
            startGraphicalTargeting(cardObj, "defense");
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

            const sourceLabel = pileType === "grave" ? "el Cementerio" : "el Desterrado";
            Swal.fire({
                title: '¡Carta añadida a la Mano!',
                html: `
                    <p style="margin-bottom: 15px; font-weight: 600;">Se ha añadido esta carta desde ${sourceLabel} a la Mano:</p>
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                        <img src="${cardObj.imageUrl}" style="width: 150px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.5);" />
                        <h3 style="color: #00d2ff; font-family: 'Orbitron', sans-serif; font-size: 1.1rem; margin-top: 5px;">${cardObj.name}</h3>
                    </div>
                `,
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#00d2ff'
            });
        } else if ($(this).hasClass("btn-pile-deck")) {
            cardObj.zone = `deck_${pSuffix}`;
            cardObj.faceDown = true;
            cardObj.tapped = false;
            renderAllCards();
            openPileModal(playerKey, pileType); // refresh view

            const sourceLabel = pileType === "grave" ? "el Cementerio" : "el Desterrado";
            Swal.fire({
                title: '¡Carta enviada al Deck!',
                html: `
                    <p style="margin-bottom: 15px; font-weight: 600;">Se ha enviado esta carta desde ${sourceLabel} al Deck:</p>
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                        <img src="${cardObj.imageUrl}" style="width: 150px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.5);" />
                        <h3 style="color: #00d2ff; font-family: 'Orbitron', sans-serif; font-size: 1.1rem; margin-top: 5px;">${cardObj.name}</h3>
                    </div>
                `,
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#00d2ff'
            });
        } else if ($(this).hasClass("btn-pile-banish")) {
            cardObj.zone = `banished_${pSuffix}`;
            cardObj.faceDown = false;
            cardObj.tapped = false;
            cardObj.movedToPileAt = Date.now() + Math.random();
            renderAllCards();
            openPileModal(playerKey, pileType); // refresh view
        } else if ($(this).hasClass("btn-pile-grave")) {
            cardObj.zone = `grave_${pSuffix}`;
            cardObj.faceDown = false;
            cardObj.tapped = false;
            cardObj.movedToPileAt = Date.now() + Math.random();
            renderAllCards();
            openPileModal(playerKey, pileType); // refresh view
        } else if ($(this).hasClass("btn-pile-extra")) {
            cardObj.zone = `extra_${pSuffix}`;
            cardObj.faceDown = true;
            cardObj.tapped = false;
            cardObj.attachedTo = null;
            renderAllCards();
            openPileModal(playerKey, pileType); // refresh view
            if (typeof sendGameAction === "function") {
                sendGameAction(`Envió al Extra Deck: 📁 ${cardObj.name}`);
            }
        } else if ($(this).hasClass("btn-pile-pendulum")) {
            cardObj.zone = `extra_${pSuffix}`;
            cardObj.faceDown = false;
            cardObj.tapped = false;
            cardObj.attachedTo = null;
            renderAllCards();
            openPileModal(playerKey, pileType); // refresh view
            if (typeof sendGameAction === "function") {
                sendGameAction(`Envió al Extra Deck (Péndulo Boca Arriba): 🌟 ${cardObj.name}`);
            }
        } else if ($(this).hasClass("btn-pile-effect")) {
            $("#pile-overlay").fadeOut(200);

            // Bring card to top of the pile on the playmat
            cardObj.movedToPileAt = Date.now();
            renderAllCards();

            // Trigger beautiful temporary activation glow animation on the playmat card element
            setTimeout(() => {
                const $cardElem = $(`#${cardObj.instanceId}`);
                if ($cardElem.length) {
                    $cardElem.addClass("activating-flash");
                    setTimeout(() => {
                        $cardElem.removeClass("activating-flash");
                    }, 800);
                }
            }, 100);

            if (typeof sendGameAction === "function") {
                const sourceLabel = pileType === "grave" ? "el Cementerio" : "el Desterrado";
                sendGameAction(`Activó el efecto de ${cardObj.name} desde ${sourceLabel}`);
            }
        }
    });
}

function setupEventListeners() {
    // Click listener for detailed preview magnifying glass zoom popup
    $("#btn-magnify-preview").click(function(e) {
        e.preventDefault();
        e.stopPropagation();
        const src = $("#detail-card-img").attr("src");
        if (!src || src.includes("placeholder") || src.includes("via.placeholder.com")) {
            return;
        }
        window.showCustomCardZoom(src);
    });

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

        if (cardObj.attachedTo) {
            e.preventDefault();
            e.stopPropagation();
            openAttachedCardsModal(cardObj.attachedTo);
            return;
        }

        // If card is inside a deck zone, open the deck menu instead of card menu
        if (cardObj.zone.startsWith("deck_")) {
            e.preventDefault();
            e.stopPropagation();
            activeMenuDeckPlayer = cardObj.zone === "deck_1" ? "player1" : "player2";
            $("#card-menu").removeClass("active");
            const clamped = (window.clampMenuCoords) ? window.clampMenuCoords(e.clientX, e.clientY, "#deck-menu") : { x: e.clientX - 140, y: e.clientY };
            $("#deck-menu").css({
                left: `${clamped.x}px`,
                top: `${clamped.y}px`
            }).addClass("active");
            return;
        }

        // If card is inside an extra deck zone, open the Extra Deck overlay instead
        if (cardObj.zone.startsWith("extra_") && !cardObj.zone.startsWith("extra_monster")) {
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

        if (window.updateCardMenuOptions) {
            window.updateCardMenuOptions(cardObj);
        }

        const clamped = (window.clampMenuCoords) ? window.clampMenuCoords(e.clientX, e.clientY, "#card-menu") : { x: e.clientX, y: e.clientY };
        $("#card-menu").css({
            left: `${clamped.x}px`,
            top: `${clamped.y}px`
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
            const clamped = (window.clampMenuCoords) ? window.clampMenuCoords(e.clientX, e.clientY, "#deck-menu") : { x: e.clientX - 140, y: e.clientY };
            $("#deck-menu").css({
                left: `${clamped.x}px`,
                top: `${clamped.y}px`
            }).addClass("active");
        } else if (cardObj.zone.startsWith("extra_") && !cardObj.zone.startsWith("extra_monster")) {
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
        const clamped = (window.clampMenuCoords) ? window.clampMenuCoords(e.clientX, e.clientY, "#deck-menu") : { x: e.clientX - 140, y: e.clientY };
        $("#deck-menu").css({
            left: `${clamped.x}px`,
            top: `${clamped.y}px`
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

    // New Menu Action handlers for Hand/Acoplar/View
    $(document).on("click", "#menu-view-card-detail", function() {
        if (!activeMenuCard) return;
        $("#card-menu").removeClass("active");
        const zoomUrl = window.getCardZoomImage(activeMenuCard);
        window.showCustomCardZoom(zoomUrl);
    });

    $(document).on("click", "#menu-summon", function() {
        if (!activeMenuCard) return;
        $("#card-menu").removeClass("active");
        startGraphicalTargeting(activeMenuCard, "summon");
    });

    $(document).on("click", "#menu-defense", function() {
        if (!activeMenuCard) return;
        $("#card-menu").removeClass("active");
        startGraphicalTargeting(activeMenuCard, "defense");
    });

    $(document).on("click", "#menu-set", function() {
        if (!activeMenuCard) return;
        $("#card-menu").removeClass("active");
        startGraphicalTargeting(activeMenuCard, "set");
    });

    $(document).on("click", "#menu-activate", function() {
        if (!activeMenuCard) return;
        $("#card-menu").removeClass("active");
        activeMenuCard.zone = "field_free";
        activeMenuCard.faceDown = false;
        activeMenuCard.tapped = false;

        const playerSuffix = activeMenuCard.owner === "player1" ? 1 : 2;
        if (playerSuffix === 1) {
            activeMenuCard.x = 870;
            activeMenuCard.y = 320;
        } else {
            activeMenuCard.x = 170;
            activeMenuCard.y = 160;
        }

        renderAllCards();
    });

    $("#menu-to-extra").click(function() {
        if (!activeMenuCard) return;
        const playerSuffix = activeMenuCard.owner === "player1" ? 1 : 2;
        detachAllChildren(activeMenuCard.instanceId);
        activeMenuCard.zone = `extra_${playerSuffix}`;
        activeMenuCard.faceDown = true;
        activeMenuCard.tapped = false;
        $("#card-menu").removeClass("active");
        renderAllCards();
        if (typeof sendGameAction === "function") {
            sendGameAction(`Envió al Extra Deck: 📁 ${activeMenuCard.name}`);
        }
    });

    $("#menu-pendulum").click(function() {
        if (!activeMenuCard) return;
        const playerSuffix = activeMenuCard.owner === "player1" ? 1 : 2;
        detachAllChildren(activeMenuCard.instanceId);
        activeMenuCard.zone = `extra_${playerSuffix}`;
        activeMenuCard.faceDown = false; // face up!
        activeMenuCard.tapped = false;
        $("#card-menu").removeClass("active");
        renderAllCards();
        if (typeof sendGameAction === "function") {
            sendGameAction(`Envió al Extra Deck (Péndulo Boca Arriba): 🌟 ${activeMenuCard.name}`);
        }
    });

    $(document).on("click", "#menu-equip-option", function() {
        if (!activeMenuCard) return;
        $("#card-menu").removeClass("active");
        startEquipTargeting(activeMenuCard);
    });

    $(document).on("click", "#menu-attach-option", function() {
        if (!activeMenuCard) return;
        $("#card-menu").removeClass("active");
        startAttachmentTargeting(activeMenuCard);
    });

    $(document).on("click", "#menu-view-attached", function() {
        if (!activeMenuCard) return;
        $("#card-menu").removeClass("active");
        openAttachedCardsModal(activeMenuCard.instanceId);
    });

    // Card Menu Action handlers
    $("#menu-trigger-effect").click(function() {
        if (!activeMenuCard) return;
        const cardObj = activeMenuCard;
        $("#card-menu").removeClass("active");

        // Trigger beautiful temporary activation glow animation on the playmat card element
        setTimeout(() => {
            const $cardElem = $(`#${cardObj.instanceId}`);
            if ($cardElem.length) {
                $cardElem.addClass("activating-flash");
                setTimeout(() => {
                    $cardElem.removeClass("activating-flash");
                }, 800);
            }
        }, 100);

        if (typeof sendGameAction === "function") {
            sendGameAction(`Activó el efecto de ${cardObj.name}`);
        }
    });

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
        activeMenuCard.controller = activeMenuCard.owner; // Reset controller
        renderAllCards();
    });

    $("#menu-to-grave").click(function() {
        if (!activeMenuCard) return;
        const pileId = activeMenuCard.owner === "player1" ? "grave_1" : "grave_2";
        sendAttachedCardsToPile(activeMenuCard.instanceId, pileId);
        activeMenuCard.zone = pileId;
        activeMenuCard.controller = activeMenuCard.owner; // Reset controller
        activeMenuCard.faceDown = false; // face up in grave
        activeMenuCard.tapped = false;
        renderAllCards();
    });

    $(document).on("click", "#menu-destroy-token", function() {
        if (!activeMenuCard) return;
        const tokenName = activeMenuCard.name;

        // Remove from state.cards completely
        state.cards = state.cards.filter(c => c.instanceId !== activeMenuCard.instanceId);

        // Broadcast / Log the action
        if (typeof sendGameAction === "function") {
            sendGameAction(`Destruyó Token: 💥 ${tokenName}`);
        }

        $("#card-menu").removeClass("active");
        renderAllCards();
    });

    $("#menu-to-banish").click(function() {
        if (!activeMenuCard) return;
        const pileId = activeMenuCard.owner === "player1" ? "banished_1" : "banished_2";
        sendAttachedCardsToPile(activeMenuCard.instanceId, pileId);
        activeMenuCard.zone = pileId;
        activeMenuCard.controller = activeMenuCard.owner; // Reset controller
        activeMenuCard.faceDown = false;
        activeMenuCard.tapped = false;
        renderAllCards();
    });

    $("#menu-swap-active-bench").click(function() {
        if (!activeMenuCard) return;
        startPokemonSwapTargeting(activeMenuCard);
    });

    $("#menu-to-deck-top").click(function() {
        if (!activeMenuCard) return;
        detachAllChildren(activeMenuCard.instanceId);
        const oldZone = activeMenuCard.zone;
        const targetZone = activeMenuCard.owner === "player1" ? "deck_1" : "deck_2";
        activeMenuCard.zone = targetZone;
        activeMenuCard.controller = activeMenuCard.owner; // Reset controller
        activeMenuCard.faceDown = true;
        activeMenuCard.tapped = false;

        const zoneCards = state.cards.filter(c => c.zone === targetZone);
        const maxZ = zoneCards.length > 0 ? Math.max(...zoneCards.map(c => c.z)) : 1;
        activeMenuCard.z = maxZ + 1;

        renderAllCards();

        const isFromGrave = oldZone.startsWith("grave_");
        const isFromBanish = oldZone.startsWith("banished_");
        const isFromHand = oldZone.startsWith("hand_");
        const sourceLabel = isFromGrave ? "el Cementerio" : (isFromBanish ? "el Desterrado" : (isFromHand ? "la Mano" : "el Campo"));

        Swal.fire({
            title: '¡Carta enviada al Deck!',
            html: `
                <p style="margin-bottom: 15px; font-weight: 600;">Se ha enviado esta carta desde ${sourceLabel} al tope del Deck:</p>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                    <img src="${activeMenuCard.imageUrl}" style="width: 150px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.5);" />
                    <h3 style="color: #00d2ff; font-family: 'Orbitron', sans-serif; font-size: 1.1rem; margin-top: 5px;">${activeMenuCard.name}</h3>
                </div>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#00d2ff'
        });
    });

    $("#menu-control").click(function() {
        if (!activeMenuCard) return;
        detachAllChildren(activeMenuCard.instanceId);
        // Swap controller ONLY, leave owner intact!
        activeMenuCard.controller = activeMenuCard.controller === "player1" ? "player2" : "player1";
        startGraphicalTargeting(activeMenuCard, "summon");

        Swal.fire({
            icon: 'info',
            title: 'Control Cambiado',
            text: `Ahora controlas a ${activeMenuCard.name}. Selecciona una zona para colocarla de tu lado.`,
            toast: true,
            position: 'top-end',
            timer: 2500,
            showConfirmButton: false
        });
    });

    $("#menu-to-deck-bottom").click(function() {
        if (!activeMenuCard) return;
        detachAllChildren(activeMenuCard.instanceId);
        const oldZone = activeMenuCard.zone;
        const targetZone = activeMenuCard.owner === "player1" ? "deck_1" : "deck_2";
        activeMenuCard.zone = targetZone;
        activeMenuCard.controller = activeMenuCard.owner; // Reset controller
        activeMenuCard.faceDown = true;
        activeMenuCard.tapped = false;

        const zoneCards = state.cards.filter(c => c.zone === targetZone);
        const minZ = zoneCards.length > 0 ? Math.min(...zoneCards.map(c => c.z)) : 1;
        activeMenuCard.z = minZ - 1;

        renderAllCards();

        const isFromGrave = oldZone.startsWith("grave_");
        const isFromBanish = oldZone.startsWith("banished_");
        const isFromHand = oldZone.startsWith("hand_");
        const sourceLabel = isFromGrave ? "el Cementerio" : (isFromBanish ? "el Desterrado" : (isFromHand ? "la Mano" : "el Campo"));

        Swal.fire({
            title: '¡Carta enviada al Deck!',
            html: `
                <p style="margin-bottom: 15px; font-weight: 600;">Se ha enviado esta carta desde ${sourceLabel} al fondo del Deck:</p>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                    <img src="${activeMenuCard.imageUrl}" style="width: 150px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.5);" />
                    <h3 style="color: #00d2ff; font-family: 'Orbitron', sans-serif; font-size: 1.1rem; margin-top: 5px;">${activeMenuCard.name}</h3>
                </div>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#00d2ff'
        });
    });

    // Deck Menu Action handlers
    $("#deck-menu-draw").click(function() {
        if (activeMenuDeckPlayer) {
            drawCards(activeMenuDeckPlayer, 1);
        }
    });

    $("#deck-menu-draw-5").click(function() {
        if (activeMenuDeckPlayer) {
            drawCards(activeMenuDeckPlayer, 5);
        }
    });

    $("#deck-menu-show-top").click(async function() {
        if (!activeMenuDeckPlayer) return;

        const { value: countStr } = await Swal.fire({
            title: 'Mostrar cartas del tope',
            input: 'number',
            inputLabel: 'Cantidad de cartas a mostrar',
            inputValue: 5,
            inputAttributes: {
                min: 1,
                step: 1
            },
            showCancelButton: true,
            confirmButtonText: 'Mostrar',
            cancelButtonText: 'Cancelar',
            background: '#121824',
            color: '#ffffff',
            confirmButtonColor: '#00d2ff',
            cancelButtonColor: '#ff4757'
        });

        if (countStr === undefined || countStr === null) return;
        const count = parseInt(countStr, 10);
        if (isNaN(count) || count <= 0) return;

        const playerKey = activeMenuDeckPlayer;
        const playerSuffix = playerKey === "player1" ? 1 : 2;
        const deckZone = playerKey === "player1" ? "deck_1" : "deck_2";
        const deckCards = state.cards
            .filter(c => c.zone === deckZone)
            .sort((a, b) => b.z - a.z);

        if (deckCards.length === 0) {
            Swal.fire({
                title: 'Deck vacío',
                text: 'No hay cartas en el Deck.',
                icon: 'warning',
                background: '#121824',
                color: '#ffffff',
                confirmButtonColor: '#00d2ff'
            });
            return;
        }

        const finalCount = Math.min(count, deckCards.length);
        const topCards = deckCards.slice(0, finalCount);

        let cardsHtml = topCards.map(card => `
            <div class="top-card-item" id="top-card-item-${card.instanceId}" style="display: flex; flex-direction: column; align-items: center; gap: 6px; width: 95px; background: rgba(255,255,255,0.02); padding: 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); box-sizing: border-box;">
                <img src="${card.imageUrl}" style="width: 80px; height: 116px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 8px rgba(0,0,0,0.5); object-fit: cover;" />
                <div style="font-size: 9px; color: #aaa; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; width: 100%; text-align: center; font-weight: bold;" title="${card.name}">${card.name}</div>
                <div style="display: flex; flex-direction: column; gap: 3px; width: 100%;">
                    <button class="top-individual-btn btn-to-hand" data-id="${card.instanceId}" style="background: rgba(0, 210, 255, 0.15); border: 1px solid #00d2ff; color: #00d2ff; font-size: 9px; font-weight: bold; padding: 3px; border-radius: 4px; cursor: pointer; text-transform: uppercase;">Mano</button>
                    <button class="top-individual-btn btn-to-grave" data-id="${card.instanceId}" style="background: rgba(255, 71, 87, 0.15); border: 1px solid #ff4757; color: #ff4757; font-size: 9px; font-weight: bold; padding: 3px; border-radius: 4px; cursor: pointer; text-transform: uppercase;">Grave</button>
                    <button class="top-individual-btn btn-to-banish" data-id="${card.instanceId}" style="background: rgba(168, 85, 247, 0.15); border: 1px solid #a855f7; color: #a855f7; font-size: 9px; font-weight: bold; padding: 3px; border-radius: 4px; cursor: pointer; text-transform: uppercase;">Remover</button>
                    <button class="top-individual-btn btn-to-deck" data-id="${card.instanceId}" style="background: rgba(255, 255, 255, 0.15); border: 1px solid #ffffff; color: #ffffff; font-size: 9px; font-weight: bold; padding: 3px; border-radius: 4px; cursor: pointer; text-transform: uppercase;">A Deck</button>
                </div>
            </div>
        `).join('');

        const htmlContent = `
            <div class="bulk-switch-container" style="display: flex; align-items: center; justify-content: space-between; gap: 10px; background: rgba(255,255,255,0.05); padding: 8px 15px; border-radius: 6px; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.1); width: 100%; box-sizing: border-box;">
                <div style="font-size: 13px; color: #ccc; font-weight: bold; text-align: left;">Acción en lote (Enviar todo a):</div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button id="top-bulk-hand" style="background: #00d2ff; border: none; color: #000; font-size: 11px; font-weight: bold; padding: 6px 12px; border-radius: 4px; cursor: pointer; transition: opacity 0.2s;">Mano</button>
                    <button id="top-bulk-grave" style="background: #ff4757; border: none; color: #fff; font-size: 11px; font-weight: bold; padding: 6px 12px; border-radius: 4px; cursor: pointer; transition: opacity 0.2s;">Cementerio</button>
                    <button id="top-bulk-banish" style="background: #a855f7; border: none; color: #fff; font-size: 11px; font-weight: bold; padding: 6px 12px; border-radius: 4px; cursor: pointer; transition: opacity 0.2s;">Remover</button>
                    <button id="top-bulk-deck" style="background: #ffffff; border: none; color: #000; font-size: 11px; font-weight: bold; padding: 6px 12px; border-radius: 4px; cursor: pointer; transition: opacity 0.2s;">A Deck</button>
                </div>
            </div>
            <div class="top-cards-grid" style="display: flex; flex-wrap: wrap; gap: 15px; justify-content: center; max-height: 400px; overflow-y: auto; padding: 10px; width: 100%; box-sizing: border-box;">
                ${cardsHtml}
            </div>
        `;

        Swal.fire({
            title: `Cartas del tope (${finalCount})`,
            html: htmlContent,
            background: '#121824',
            color: '#ffffff',
            width: '680px',
            showConfirmButton: false,
            showCloseButton: true,
            didOpen: () => {
                let activeCardsInPopup = [...topCards];

                function removeCardFromPopupDOM(id) {
                    $(`#top-card-item-${id}`).fadeOut(300, function() {
                        $(this).remove();
                        activeCardsInPopup = activeCardsInPopup.filter(c => c.instanceId !== id);
                        if (activeCardsInPopup.length === 0) {
                            Swal.close();
                        }
                    });
                }

                // Individual "Mano"
                $(".btn-to-hand").click(function() {
                    const id = $(this).data("id");
                    const cardObj = state.cards.find(c => c.instanceId === id);
                    if (!cardObj) return;

                    cardObj.zone = cardObj.owner === "player1" ? "hand_1" : "hand_2";
                    cardObj.faceDown = false;
                    cardObj.tapped = false;
                    renderAllCards();

                    if (typeof sendGameAction === "function") {
                        sendGameAction(`Añadió ${cardObj.name} a la Mano desde el tope del Deck`);
                    }

                    removeCardFromPopupDOM(id);
                });

                // Individual "Grave"
                $(".btn-to-grave").click(function() {
                    const id = $(this).data("id");
                    const cardObj = state.cards.find(c => c.instanceId === id);
                    if (!cardObj) return;

                    cardObj.zone = `grave_${playerSuffix}`;
                    cardObj.faceDown = false;
                    cardObj.tapped = false;
                    cardObj.movedToPileAt = Date.now() + Math.random();
                    renderAllCards();

                    if (typeof sendGameAction === "function") {
                        sendGameAction(`Envió ${cardObj.name} al Cementerio desde el tope del Deck`);
                    }

                    removeCardFromPopupDOM(id);
                });

                // Individual "Remover"
                $(".btn-to-banish").click(function() {
                    const id = $(this).data("id");
                    const cardObj = state.cards.find(c => c.instanceId === id);
                    if (!cardObj) return;

                    cardObj.zone = `banished_${playerSuffix}`;
                    cardObj.faceDown = false;
                    cardObj.tapped = false;
                    cardObj.movedToPileAt = Date.now() + Math.random();
                    renderAllCards();

                    if (typeof sendGameAction === "function") {
                        sendGameAction(`Envió ${cardObj.name} al Desterrado desde el tope del Deck`);
                    }

                    removeCardFromPopupDOM(id);
                });

                // Individual "A Deck" (re-insert into deck stack, face down)
                $(".btn-to-deck").click(function() {
                    const id = $(this).data("id");
                    const cardObj = state.cards.find(c => c.instanceId === id);
                    if (!cardObj) return;

                    cardObj.zone = `deck_${playerSuffix}`;
                    cardObj.faceDown = true;
                    cardObj.tapped = false;
                    renderAllCards();

                    if (typeof sendGameAction === "function") {
                        sendGameAction(`Reinsertó ${cardObj.name} al Deck`);
                    }

                    removeCardFromPopupDOM(id);
                });

                // Bulk "Mano"
                $("#top-bulk-hand").click(function() {
                    if (activeCardsInPopup.length === 0) return;
                    activeCardsInPopup.forEach(c => {
                        const cardObj = state.cards.find(card => card.instanceId === c.instanceId);
                        if (cardObj) {
                            cardObj.zone = cardObj.owner === "player1" ? "hand_1" : "hand_2";
                            cardObj.faceDown = false;
                            cardObj.tapped = false;
                        }
                    });
                    renderAllCards();

                    if (typeof sendGameAction === "function") {
                        sendGameAction(`Añadió ${activeCardsInPopup.length} cartas a la Mano desde el tope del Deck`);
                    }
                    Swal.close();
                });

                // Bulk "A Deck"
                $("#top-bulk-deck").click(function() {
                    if (activeCardsInPopup.length === 0) return;
                    activeCardsInPopup.forEach(c => {
                        const cardObj = state.cards.find(card => card.instanceId === c.instanceId);
                        if (cardObj) {
                            cardObj.zone = `deck_${playerSuffix}`;
                            cardObj.faceDown = true;
                            cardObj.tapped = false;
                        }
                    });
                    renderAllCards();

                    if (typeof sendGameAction === "function") {
                        sendGameAction(`Reinsertó ${activeCardsInPopup.length} cartas al Deck`);
                    }
                    Swal.close();
                });

                // Bulk "Grave"
                $("#top-bulk-grave").click(function() {
                    if (activeCardsInPopup.length === 0) return;
                    const baseTime = Date.now();
                    activeCardsInPopup.forEach((c, index) => {
                        const cardObj = state.cards.find(card => card.instanceId === c.instanceId);
                        if (cardObj) {
                            cardObj.zone = `grave_${playerSuffix}`;
                            cardObj.faceDown = false;
                            cardObj.tapped = false;
                            cardObj.movedToPileAt = baseTime + index;
                        }
                    });
                    renderAllCards();

                    if (typeof sendGameAction === "function") {
                        sendGameAction(`Envió ${activeCardsInPopup.length} cartas al Cementerio desde el tope del Deck`);
                    }
                    Swal.close();
                });

                // Bulk "Remover"
                $("#top-bulk-banish").click(function() {
                    if (activeCardsInPopup.length === 0) return;
                    const baseTime = Date.now();
                    activeCardsInPopup.forEach((c, index) => {
                        const cardObj = state.cards.find(card => card.instanceId === c.instanceId);
                        if (cardObj) {
                            cardObj.zone = `banished_${playerSuffix}`;
                            cardObj.faceDown = false;
                            cardObj.tapped = false;
                            cardObj.movedToPileAt = baseTime + index;
                        }
                    });
                    renderAllCards();

                    if (typeof sendGameAction === "function") {
                        sendGameAction(`Envió ${activeCardsInPopup.length} cartas al Desterrado desde el tope del Deck`);
                    }
                    Swal.close();
                });
            }
        });
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

    // Hand Multi-Select Toggle Handlers
    $(document).on("change", ".hand-multi-select-toggle", function() {
        const playerKey = $(this).data("player");
        const isChecked = $(this).is(":checked");
        const handTraySelector = playerKey === "player1" ? "#hand-tray-p1" : "#hand-tray-p2";
        const handSelector = playerKey === "player1" ? "#hand-p1" : "#hand-p2";
        const batchActionsSelector = playerKey === "player1" ? "#hand-batch-p1" : "#hand-batch-p2";

        if (isChecked) {
            $(handTraySelector).addClass("hand-multi-select-active");
            $(batchActionsSelector).css("display", "flex");
            selectedHandCards[playerKey] = [];
        } else {
            $(handTraySelector).removeClass("hand-multi-select-active");
            $(batchActionsSelector).hide();
            // Clear visual selection classes
            $(handSelector).find(".duel-card").removeClass("selected-for-batch");
            selectedHandCards[playerKey] = [];
        }
    });

    $(document).on("click", ".btn-batch-deck", function(e) {
        e.preventDefault();
        e.stopPropagation();
        const playerKey = $(this).data("player");
        const playerSuffix = playerKey === "player1" ? 1 : 2;
        const targetZone = `deck_${playerSuffix}`;
        const selectedIds = selectedHandCards[playerKey] || [];

        if (selectedIds.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Sin selección',
                text: 'Por favor selecciona al menos una carta de tu mano.',
                toast: true,
                position: 'top-end',
                timer: 2000,
                showConfirmButton: false
            });
            return;
        }

        const cardsToMove = [];
        selectedIds.forEach(id => {
            const cardObj = state.cards.find(c => c.instanceId === id);
            if (cardObj) {
                cardObj.zone = targetZone;
                cardObj.faceDown = true;
                cardObj.tapped = false;
                cardsToMove.push(cardObj);
            }
        });

        // Clear selection
        selectedHandCards[playerKey] = [];
        $(`.hand-multi-select-toggle[data-player="${playerKey}"]`).prop("checked", false).trigger("change");
        renderAllCards();

        // Show single consolidated notification for all cards
        let cardsListHtml = cardsToMove.map(c => `
            <div style="text-align: center; margin: 5px;">
                <img src="${c.imageUrl}" style="width: 100px; border-radius: 6px; box-shadow: 0 3px 8px rgba(0,0,0,0.5);" />
                <p style="color: #00d2ff; font-size: 0.85rem; font-weight: bold; margin-top: 3px; max-width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.name}</p>
            </div>
        `).join('');

        Swal.fire({
            title: '¡Cartas enviadas al Deck!',
            html: `
                <p style="margin-bottom: 15px; font-weight: 600;">Se han enviado estas ${cardsToMove.length} cartas desde la Mano al Deck:</p>
                <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; max-height: 300px; overflow-y: auto;">
                    ${cardsListHtml}
                </div>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#00d2ff'
        });
    });

    $(document).on("click", ".btn-batch-grave", function(e) {
        e.preventDefault();
        e.stopPropagation();
        const playerKey = $(this).data("player");
        const playerSuffix = playerKey === "player1" ? 1 : 2;
        const targetZone = `grave_${playerSuffix}`;
        const selectedIds = selectedHandCards[playerKey] || [];

        if (selectedIds.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Sin selección',
                text: 'Por favor selecciona al menos una carta de tu mano.',
                toast: true,
                position: 'top-end',
                timer: 2000,
                showConfirmButton: false
            });
            return;
        }

        const cardsToMove = [];
        selectedIds.forEach(id => {
            const cardObj = state.cards.find(c => c.instanceId === id);
            if (cardObj) {
                cardObj.zone = targetZone;
                cardObj.faceDown = false;
                cardObj.tapped = false;
                cardObj.movedToPileAt = Date.now() + Math.random();
                cardsToMove.push(cardObj);
            }
        });

        // Clear selection
        selectedHandCards[playerKey] = [];
        $(`.hand-multi-select-toggle[data-player="${playerKey}"]`).prop("checked", false).trigger("change");
        renderAllCards();

        // Show single consolidated notification for all cards
        let cardsListHtml = cardsToMove.map(c => `
            <div style="text-align: center; margin: 5px;">
                <img src="${c.imageUrl}" style="width: 100px; border-radius: 6px; box-shadow: 0 3px 8px rgba(0,0,0,0.5);" />
                <p style="color: #ff1b6b; font-size: 0.85rem; font-weight: bold; margin-top: 3px; max-width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.name}</p>
            </div>
        `).join('');

        const destLabel = isYGOLayout(state.layout) ? "Cementerio" : "Descarte";
        Swal.fire({
            title: `¡Cartas enviadas al ${destLabel}!`,
            html: `
                <p style="margin-bottom: 15px; font-weight: 600;">Se han enviado estas ${cardsToMove.length} cartas desde la Mano al ${destLabel}:</p>
                <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; max-height: 300px; overflow-y: auto;">
                    ${cardsListHtml}
                </div>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#ff1b6b'
        });
    });

    // Pile modal selection and batching
    $(document).on("change", "#pile-multi-select-toggle", function() {
        const isChecked = $(this).is(":checked");
        if (isChecked) {
            $("#pile-overlay").addClass("pile-multi-select-active");
            $("#pile-batch-actions").css("display", "flex");
            selectedPileCards = [];
        } else {
            $("#pile-overlay").removeClass("pile-multi-select-active");
            $("#pile-batch-actions").hide();
            $("#pile-cards-grid").find(".pile-card-container").removeClass("selected-for-batch");
            selectedPileCards = [];
        }
    });

    $(document).off("click.pile_batch_select", ".pile-card-container").on("click.pile_batch_select", ".pile-card-container", function(e) {
        if ($("#pile-multi-select-toggle").is(":checked")) {
            e.preventDefault();
            e.stopPropagation();
            const instId = $(this).data("instance-id");
            const idx = selectedPileCards.indexOf(instId);
            if (idx > -1) {
                selectedPileCards.splice(idx, 1);
                $(this).removeClass("selected-for-batch");
            } else {
                selectedPileCards.push(instId);
                $(this).addClass("selected-for-batch");
            }
        }
    });

    $(document).on("click", ".btn-pile-batch-deck", function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (selectedPileCards.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Sin selección',
                text: 'Por favor selecciona al menos una carta.',
                toast: true,
                position: 'top-end',
                timer: 2000,
                showConfirmButton: false
            });
            return;
        }

        const playerSuffix = activePileModalPlayer === "player1" ? 1 : 2;
        const targetZone = `deck_${playerSuffix}`;
        const cardsToMove = [];

        selectedPileCards.forEach(id => {
            const cardObj = state.cards.find(c => c.instanceId === id);
            if (cardObj) {
                cardObj.zone = targetZone;
                cardObj.faceDown = true;
                cardObj.tapped = false;
                cardsToMove.push(cardObj);
            }
        });

        // Hide overlay and clear selection
        $("#pile-overlay").fadeOut(200);
        selectedPileCards = [];
        renderAllCards();

        // Show single consolidated notification for all cards
        let cardsListHtml = cardsToMove.map(c => `
            <div style="text-align: center; margin: 5px;">
                <img src="${c.imageUrl}" style="width: 100px; border-radius: 6px; box-shadow: 0 3px 8px rgba(0,0,0,0.5);" />
                <p style="color: #00d2ff; font-size: 0.85rem; font-weight: bold; margin-top: 3px; max-width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.name}</p>
            </div>
        `).join('');

        const sourceLabel = activePileModalType === "grave" ? "el Cementerio" : "el Desterrado";
        Swal.fire({
            title: '¡Cartas enviadas al Deck!',
            html: `
                <p style="margin-bottom: 15px; font-weight: 600;">Se han enviado estas ${cardsToMove.length} cartas desde ${sourceLabel} al Deck:</p>
                <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; max-height: 300px; overflow-y: auto;">
                    ${cardsListHtml}
                </div>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#00d2ff'
        });
    });

    $(document).on("click", ".btn-pile-batch-hand", function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (selectedPileCards.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Sin selección',
                text: 'Por favor selecciona al menos una carta.',
                toast: true,
                position: 'top-end',
                timer: 2000,
                showConfirmButton: false
            });
            return;
        }

        const playerSuffix = activePileModalPlayer === "player1" ? 1 : 2;
        const targetZone = `hand_${playerSuffix}`;
        const cardsToMove = [];

        selectedPileCards.forEach(id => {
            const cardObj = state.cards.find(c => c.instanceId === id);
            if (cardObj) {
                cardObj.zone = targetZone;
                cardObj.faceDown = false;
                cardObj.tapped = false;
                cardsToMove.push(cardObj);
            }
        });

        // Hide overlay and clear selection
        $("#pile-overlay").fadeOut(200);
        selectedPileCards = [];
        renderAllCards();

        // Show single consolidated notification for all cards
        let cardsListHtml = cardsToMove.map(c => `
            <div style="text-align: center; margin: 5px;">
                <img src="${c.imageUrl}" style="width: 100px; border-radius: 6px; box-shadow: 0 3px 8px rgba(0,0,0,0.5);" />
                <p style="color: #00d2ff; font-size: 0.85rem; font-weight: bold; margin-top: 3px; max-width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.name}</p>
            </div>
        `).join('');

        const sourceLabel = activePileModalType === "grave" ? "el Cementerio" : "el Desterrado";
        Swal.fire({
            title: '¡Cartas añadidas a la Mano!',
            html: `
                <p style="margin-bottom: 15px; font-weight: 600;">Se han añadido estas ${cardsToMove.length} cartas desde ${sourceLabel} a la Mano:</p>
                <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; max-height: 300px; overflow-y: auto;">
                    ${cardsListHtml}
                </div>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#00d2ff'
        });
    });
}

// Explicitly assign key functions to the window object to allow external wrapping and decoration
window.renderAllCards = renderAllCards;
window.drawCards = drawCards;
window.shuffleDeck = shuffleDeck;
window.setupPokemonPrizes = setupPokemonPrizes;


/* ==========================================================================
   EXTRACTED INLINE SCRIPTS FROM DUELMOBILE.HTML
   ========================================================================== */

// 1. Supabase real-time channel monkey-patch & sync guard

        $(document).ready(function() {
            // 1. Initialize State & Room Connection
            const params = new URLSearchParams(window.location.search);
            state.mode = params.get('mode') || 'practice';
            state.layout = params.get('layout') || 'yugioh';

            // Custom Game State Variables for turn, phase and life points
            state.activeTurn = 'player1'; // 'player1' or 'player2'
            state.activePhase = 'DP'; // 'DP', 'SP', 'M1', 'BP', 'M2', 'EP'
            state.lp = { player1: 8000, player2: 8000 };
            state.turnActionTaken = false; // Disable flashing of End Turn button once gameplay action is done

            // Helper to hide/show features depending on selected layout
            function updateLayoutFeatureVisibility() {
                if (isYGOLayout(state.layout)) {
                    // Show phases, turn indicator, and show LP counters
                    $("#phases-container").show();
                    $("#turn-display").show();
                    $("#lp-counter-p1").show();
                    $("#lp-counter-p2").show();
                } else {
                    // Hide phases, turn indicator, and hide LP counters (Pokémon layout has no phases or LP counters)
                    $("#phases-container").hide();
                    $("#turn-display").hide();
                    $("#lp-counter-p1").hide();
                    $("#lp-counter-p2").hide();
                }
                updateTurnUI();
            }

            let currentRole = params.get('role') || "player1"; // default to URL param
            window.currentRole = currentRole;
            let roomId = params.get('room');
            if (!roomId) {
                roomId = 'R' + Math.floor(10000 + Math.random() * 90000);
                params.set('room', roomId);
                window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
            }
            state.roomId = roomId;
            $("#display-room-id").text(roomId);

            // Fetch username for chat and logs
            let myUsername = "Jugador";
            async function fetchMyUsername() {
                try {
                    const { data: { session } } = await _supabase.auth.getSession();
                    if (session && session.user) {
                        const { data: userData } = await _supabase
                            .from('usuarios')
                            .select('username')
                            .eq('id', session.user.id)
                            .maybeSingle();
                        if (userData && userData.username) {
                            myUsername = userData.username;
                        } else {
                            myUsername = session.user.email.split('@')[0];
                        }
                    } else {
                        myUsername = currentRole === "player1" ? "Jugador 1" : "Jugador 2";
                    }
                } catch (e) {
                    console.error("Error fetching username:", e);
                }
            }

            // Lock role and config UI in multiplayer mode
            if (state.mode === "multiplayer") {
                $(".role-btn").removeClass("active").css("pointer-events", "none");
                $(`#btn-role-${currentRole}`).addClass("active");
                $(".role-btn").click(function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                });
            } else {
                // Apply initial active role in practice mode
                $(".role-btn").removeClass("active");
                $(`#btn-role-${currentRole}`).addClass("active");
            }

            // Copy room link
            $("#btn-copy-room").click(function() {
                navigator.clipboard.writeText(window.location.href);
                Swal.fire({
                    icon: 'success',
                    title: '¡Enlace Copiado!',
                    text: 'Compártelo con tu rival para jugar en la misma sala.',
                    toast: true,
                    position: 'top-end',
                    timer: 2000,
                    showConfirmButton: false
                });
            });

            // 2. Setup Supabase Realtime Channel
            const commChannel = _supabase.channel(`room:${roomId}`);

            // 3. Role Picker Logic (only active in practice mode)
            $(".role-btn").click(function() {
                if (state.mode === "multiplayer") return;
                $(".role-btn").removeClass("active");
                $(this).addClass("active");
                currentRole = $(this).data("role");
                window.currentRole = currentRole;

                // Visual feedback of my own role changes
                appendSystemMsg(`Te has conectado como ${currentRole === 'player1' ? 'Jugador 1' : 'Jugador 2'}`);
            });

            // 4. Game Log & Chat append utilities
            function appendGameLog(player, action, cardName, username) {
                const now = new Date();
                const timeStr = now.toTimeString().split(' ')[0];
                const playerClass = player === "player1" ? "p1-log" : (player === "player2" ? "p2-log" : "sys-log");

                const displayPrefix = username || (player === "player1" ? "P1" : (player === "player2" ? "P2" : "SYS"));

                // Escaping variables strictly for perfect XSS safety
                const escapedAction = action; // Actions are hardcoded strings, completely safe
                const escapedCardName = escapeHtml(cardName);

                let text = `<b>[${displayPrefix}]</b> ${escapedAction}`;
                if (escapedCardName) {
                    text += ` (<i>${escapedCardName}</i>)`;
                }

                const logHTML = `
                    <div class="log-entry ${playerClass}">
                        <span class="log-time">${timeStr}</span> ${text}
                    </div>
                `;

                const $box = $("#game-log-box");
                $box.append(logHTML);
                $box.scrollTop($box[0].scrollHeight);
            }

            function appendChatMessage(player, message, username) {
                const playerClass = player === "player1" ? "p1-msg" : "p2-msg";
                const displayPrefix = username || (player === "player1" ? "Jugador 1" : "Jugador 2");

                const chatHTML = `
                    <div class="chat-message ${playerClass}">
                        <div class="message-header">${displayPrefix}</div>
                        <div>${escapeHtml(message)}</div>
                    </div>
                `;

                const $box = $("#chat-msg-box");
                $box.append(chatHTML);
                $box.scrollTop($box[0].scrollHeight);
            }

            function appendSystemMsg(message) {
                const chatHTML = `
                    <div class="chat-message system-msg">
                        <div>${escapeHtml(message)}</div>
                    </div>
                `;
                const $box = $("#chat-msg-box");
                $box.append(chatHTML);
                $box.scrollTop($box[0].scrollHeight);
            }

            function escapeHtml(text) {
                if (!text) return "";
                return String(text)
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            }

            // 5. Broadcast helper functions with crash safety guards for practice mode
            function sendGameAction(action, cardName, isImportant = false) {
                const actionData = { player: currentRole, action, cardName, isImportant, username: myUsername };

                // Append locally
                appendGameLog(currentRole, action, cardName, myUsername);

                // Send via realtime safely
                try {
                    if (typeof commChannel !== "undefined" && commChannel && typeof commChannel.send === "function") {
                        commChannel.send({
                            type: 'broadcast',
                            event: 'game_action',
                            payload: actionData
                        });
                    }
                } catch (e) {
                    console.warn("Could not broadcast action:", e);
                }
            }

            function sendChatMessage(message) {
                const chatData = { player: currentRole, message, username: myUsername };

                // Append locally
                appendChatMessage(currentRole, message, myUsername);

                // Send via realtime safely
                try {
                    if (typeof commChannel !== "undefined" && commChannel && typeof commChannel.send === "function") {
                        commChannel.send({
                            type: 'broadcast',
                            event: 'chat_msg',
                            payload: chatData
                        });
                    }
                } catch (e) {
                    console.warn("Could not broadcast chat:", e);
                }
            }

            function sendOpponentResponse(response) {
                const responseData = { player: currentRole, response, username: myUsername };

                // Append locally
                appendGameLog(currentRole, `Responde a la acción anterior: <b>${escapeHtml(response)}</b>`, null, myUsername);

                // Send via realtime safely
                try {
                    if (typeof commChannel !== "undefined" && commChannel && typeof commChannel.send === "function") {
                        commChannel.send({
                            type: 'broadcast',
                            event: 'opponent_response',
                            payload: responseData
                        });
                    }
                } catch (e) {
                    console.warn("Could not broadcast response:", e);
                }
            }

            // 6. Action and Chat bindings
            $("#btn-send-chat").click(function() {
                const msg = $("#chat-input").val().trim();
                if (msg) {
                    sendChatMessage(msg);
                    $("#chat-input").val("");
                }
            });

            $("#chat-input").keypress(function(e) {
                if (e.which === 13) { // Enter key
                    $("#btn-send-chat").click();
                }
            });

            // Quick Response Buttons
            $(".quick-btn").click(function() {
                const msg = $(this).data("msg");
                sendChatMessage(msg);
            });

            // Interactive response prompt button click handlers
            $(".response-prompt-btn").click(function() {
                const resp = $(this).data("response");
                sendOpponentResponse(resp);
                $("#pending-response-box").slideUp(150);
            });

            // Attack tracking state
            state.attacks = []; // { attackerId, targetId, isDirect }

            // Helper to render all active attack arrows, neon glow and badges
            window.drawAttackArrows = function() {
                const $overlay = $("#attack-arrows-overlay");
                $overlay.find(".active-attack-element").remove();

                // Clear any existing badges and glowing classes
                $(".attack-text-badge, .attack-direct-badge").remove();
                $(".duel-card").removeClass("card-is-attacker card-under-attack");

                const isCardOnField = (card) => {
                    if (!card) return false;
                    const z = card.zone;
                    if (!z) return false;
                    if (z.startsWith("hand_") || z.startsWith("deck_") || (z.startsWith("extra_") && !z.startsWith("extra_monster")) || z.startsWith("grave_") || z.startsWith("banished_")) {
                        return false;
                    }
                    return true;
                };

                // Filter out attacks where cards left the active field
                state.attacks = state.attacks.filter(atk => {
                    const attackerObj = state.cards.find(c => c.instanceId === atk.attackerId);
                    if (!attackerObj || !isCardOnField(attackerObj)) return false;
                    if (!atk.isDirect) {
                        const targetObj = state.cards.find(c => c.instanceId === atk.targetId);
                        if (!targetObj || !isCardOnField(targetObj)) return false;
                    }
                    return true;
                });

                state.attacks.forEach(atk => {
                    const attackerObj = state.cards.find(c => c.instanceId === atk.attackerId);
                    if (!attackerObj) return;

                    // Calculate exact mathematical center in unscaled 1120x600 coordinates
                    let startX = 0, startY = 0;
                    const zoneObj = BOARD_LAYOUTS[state.layout].find(z => z.id === attackerObj.zone);
                    let finalX = attackerObj.x;
                    let finalY = attackerObj.y;
                    if (zoneObj) {
                        finalX = zoneObj.x;
                        finalY = zoneObj.y;
                    }
                    startX = finalX + 40;
                    startY = finalY + 58;

                    // Add attacker neon class and badge if element is loaded on field
                    const $atkEl = $(`#${attackerObj.instanceId}`);
                    if ($atkEl.length) {
                        $atkEl.addClass("card-is-attacker");
                        $atkEl.append(`<div class="attack-text-badge">⚔️ Atacante</div>`);
                    }

                    let endX = 0, endY = 0;
                    if (atk.isDirect) {
                        // Direct attack target coordinate goes directly to top/bottom of playmat depending on controller
                        endX = startX;
                        endY = attackerObj.controller === "player1" ? 30 : 570;

                        // Add a beautiful direct attack badge floating on the screen
                        const badgeLeft = startX;
                        const badgeTop = attackerObj.controller === "player1" ? startY - 100 : startY + 60;
                        $("#playmat").append(`
                            <div class="attack-direct-badge" style="left: ${badgeLeft - 80}px; top: ${badgeTop}px;">
                                💥 Ataque Directo
                            </div>
                        `);
                    } else {
                        const targetObj = state.cards.find(c => c.instanceId === atk.targetId);
                        if (!targetObj) return;

                        const tZoneObj = BOARD_LAYOUTS[state.layout].find(z => z.id === targetObj.zone);
                        let finalTX = targetObj.x;
                        let finalTY = targetObj.y;
                        if (tZoneObj) {
                            finalTX = tZoneObj.x;
                            finalTY = tZoneObj.y;
                        }
                        endX = finalTX + 40;
                        endY = finalTY + 58;

                        const $tgtEl = $(`#${targetObj.instanceId}`);
                        if ($tgtEl.length) {
                            // Add defender neon class and badge
                            $tgtEl.addClass("card-under-attack");
                            $tgtEl.append(`<div class="attack-text-badge defender">🎯 Atacando</div>`);
                        }
                    }

                    // Calculate arrow angle to render the arrowhead properly
                    const angle = Math.atan2(endY - startY, endX - startX);
                    const arrowSize = 16;

                    const headX1 = endX - arrowSize * Math.cos(angle - Math.PI / 6);
                    const headY1 = endY - arrowSize * Math.sin(angle - Math.PI / 6);
                    const headX2 = endX - arrowSize * Math.cos(angle + Math.PI / 6);
                    const headY2 = endY - arrowSize * Math.sin(angle + Math.PI / 6);

                    // Dynamic colors based on controller: Cyan (#00d2ff) for Player 1, Pink (#ff1b6b) for Player 2
                    const strokeColor = attackerObj.controller === "player1" ? "#00d2ff" : "#ff1b6b";

                    // Create path and polygon SVG elements using the CORRECT SVG namespace
                    const svgNamespace = "http://www.w3.org/2000/svg";

                    const path = document.createElementNS(svgNamespace, "path");
                    path.setAttribute("class", "attack-line active-attack-element");
                    path.setAttribute("d", `M ${startX} ${startY} L ${endX} ${endY}`);
                    path.setAttribute("stroke", strokeColor);
                    path.setAttribute("fill", "none");

                    const head = document.createElementNS(svgNamespace, "polygon");
                    head.setAttribute("class", "attack-head active-attack-element");
                    head.setAttribute("points", `${endX},${endY} ${headX1},${headY1} ${headX2},${headY2}`);
                    head.setAttribute("fill", strokeColor);

                    $overlay[0].appendChild(path);
                    $overlay[0].appendChild(head);
                });
            };

            // Trigger arrow redraw anytime cards are rendered or updated
            const oldRenderAllCards = window.renderAllCards;
            window.renderAllCards = function() {
                oldRenderAllCards.apply(this, arguments);
                if (typeof window.drawAttackArrows === "function") {
                    window.drawAttackArrows();
                }
            };

            // 7. Subscribe to Broadcast channel events
            commChannel
                .on('broadcast', { event: 'attack_sync' }, ({ payload }) => {
                    const incomingAttacks = payload.attacks || [];
                    if (incomingAttacks.length === 0) {
                        state.attacks = [];
                        if (typeof window.drawAttackArrows === "function") {
                            window.drawAttackArrows();
                        }
                        return;
                    }

                    incomingAttacks.forEach(incomingAtk => {
                        const exists = state.attacks.some(atk => atk.attackerId === incomingAtk.attackerId && atk.targetId === incomingAtk.targetId && atk.isDirect === incomingAtk.isDirect);
                        if (!exists) {
                            state.attacks.push(incomingAtk);
                        }
                    });
                    if (typeof window.drawAttackArrows === "function") {
                        window.drawAttackArrows();
                    }
                })
                .on('broadcast', { event: 'game_action' }, ({ payload }) => {
                    appendGameLog(payload.player, payload.action, payload.cardName, payload.username);

                    // Show real-time attack alert warning to opponent
                    if (payload.action.startsWith("Declaró ataque") || payload.action.startsWith("Declaró Ataque Directo")) {
                        if (payload.player !== currentRole) {
                            Swal.fire({
                                icon: 'warning',
                                title: '¡BAJO ATAQUE!',
                                html: `<div style="font-family: 'Montserrat', sans-serif;"><span style="color: #ff1b6b; font-weight: 800;">${payload.username}</span> está declarando un ataque:<br><br><b style="font-size: 1.05rem; color: #ff8c00;">${payload.action}</b></div>`,
                                background: '#0a0508',
                                color: '#fff',
                                confirmButtonText: '⚡ Responder / Cadena',
                                cancelButtonText: 'OK',
                                showCancelButton: true,
                                confirmButtonColor: '#ff1b6b',
                                cancelButtonColor: '#222',
                                customClass: {
                                    popup: 'cyber-swal'
                                }
                            }).then((res) => {
                                if (res.isConfirmed) {
                                    // Slide down the response options bar instantly
                                    $("#pending-response-box").slideDown(150);
                                }
                            });
                        }
                    }

                    // Show response options to rival if action is marked important and sent by the other player
                    if (payload.isImportant && payload.player !== currentRole) {
                        $("#pending-response-box").slideDown(150);
                    }
                })
                .on('broadcast', { event: 'chat_msg' }, ({ payload }) => {
                    appendChatMessage(payload.player, payload.message, payload.username);
                })
                .on('broadcast', { event: 'opponent_response' }, ({ payload }) => {
                    appendGameLog(payload.player, `Responde a la acción anterior: <b>${escapeHtml(payload.response)}</b>`, null, payload.username);
                    // Clear flashing prompt if it was resolved
                    if (payload.player !== currentRole) {
                        $("#pending-response-box").slideUp(150);
                    }
                })
                .on('broadcast', { event: 'player_joined' }, ({ payload }) => {
                    const joinedRole = payload.role === "player1" ? "Jugador 1" : "Jugador 2";
                    appendSystemMsg(`${payload.username} se ha unido como ${joinedRole}`);

                    // If we are already connected, broadcast our current cards and turn state to the newcomer
                    if (payload.role !== currentRole) {
                        try {
                            if (typeof commChannel !== "undefined" && commChannel && typeof commChannel.send === "function") {
                                commChannel.send({
                                    type: 'broadcast',
                                    event: 'card_sync',
                                    payload: { cards: state.cards }
                                });
                                // Send active turn state
                                commChannel.send({
                                    type: 'broadcast',
                                    event: 'turn_state_sync',
                                    payload: {
                                        activeTurn: state.activeTurn,
                                        activePhase: state.activePhase,
                                        lp: state.lp
                                    }
                                });
                            }
                        } catch (e) {
                            console.warn("Could not sync with newcomer:", e);
                        }
                    }
                })
                .on('broadcast', { event: 'card_sync' }, ({ payload }) => {
                    window.isIncomingSync = true;
                    try {
                        payload.cards.forEach(remoteCard => {
                            const localCard = state.cards.find(c => c.instanceId === remoteCard.instanceId);
                            if (localCard) {
                                localCard.x = remoteCard.x;
                                localCard.y = remoteCard.y;
                                localCard.z = remoteCard.z;
                                localCard.zone = remoteCard.zone;
                                localCard.faceDown = remoteCard.faceDown;
                                localCard.tapped = remoteCard.tapped;
                                localCard.counters = remoteCard.counters;
                                localCard.pokemonDamageCounters = remoteCard.pokemonDamageCounters;
                                localCard.attachedTo = remoteCard.attachedTo;
                                localCard.controller = remoteCard.controller;
                                localCard.isExtra = remoteCard.isExtra;
                                localCard.tiltAngle = remoteCard.tiltAngle;
                                localCard.attachedAt = remoteCard.attachedAt;
                            } else {
                                state.cards.push(remoteCard);
                            }
                        });
                        window.renderAllCards();
                    } finally {
                        window.isIncomingSync = false;
                    }
                })
                .on('broadcast', { event: 'turn_state_sync' }, ({ payload }) => {
                    state.activeTurn = payload.activeTurn;
                    state.activePhase = payload.activePhase;
                    state.lp = payload.lp;
                    state.turnActionTaken = payload.turnActionTaken || false;
                    updateTurnUI();
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        await fetchMyUsername();
                        appendSystemMsg(`Conectado a la sala: ${roomId}`);

                        // Send player_joined event to let the other player know
                        try {
                            if (typeof commChannel !== "undefined" && commChannel && typeof commChannel.send === "function") {
                                commChannel.send({
                                    type: 'broadcast',
                                    event: 'player_joined',
                                    payload: { role: currentRole, username: myUsername }
                                });
                            }
                        } catch (e) {
                            console.warn("Could not notify joining:", e);
                        }
                    }
                });

            // UI updater for state variables
            function updateTurnUI() {
                // Update turn indicator text & style
                const $turnDisplay = $("#turn-display");
                if (state.activeTurn === 'player1') {
                    $turnDisplay.text("P1").removeClass("p2-turn").addClass("p1-turn");
                } else {
                    $turnDisplay.text("P2").removeClass("p1-turn").addClass("p2-turn");
                }

                // Update phase button active state
                $(".phase-btn").removeClass("active");
                $(`.phase-btn[data-phase="${state.activePhase}"]`).addClass("active");

                // Animated LP transition (Anime-style ticker)
                function animateLPCounter(elementId, startValue, endValue, duration = 800) {
                    const $el = $(elementId);
                    const startTime = performance.now();

                    function update(currentTime) {
                        const elapsed = currentTime - startTime;
                        const progress = Math.min(elapsed / duration, 1);

                        // Linear interpolation or ease-out
                        const currentValue = Math.floor(startValue + (endValue - startValue) * progress);
                        $el.text(currentValue);

                        if (progress < 1) {
                            requestAnimationFrame(update);
                        } else {
                            $el.text(endValue);
                        }
                    }
                    requestAnimationFrame(update);
                }

                // Update LP Displays with anime-style counting animations
                const currentP1Disp = parseInt($("#lp-display-p1").text()) || 0;
                if (currentP1Disp !== state.lp.player1 && currentP1Disp !== 0) {
                    animateLPCounter("#lp-display-p1", currentP1Disp, state.lp.player1);
                } else {
                    $("#lp-display-p1").text(state.lp.player1);
                }

                const currentP2Disp = parseInt($("#lp-display-p2").text()) || 0;
                if (currentP2Disp !== state.lp.player2 && currentP2Disp !== 0) {
                    animateLPCounter("#lp-display-p2", currentP2Disp, state.lp.player2);
                } else {
                    $("#lp-display-p2").text(state.lp.player2);
                }

                // End Turn Blinking Logic:
                const $endTurnBtn = $("#btn-end-turn");
                $endTurnBtn.removeClass("flashing");

                // Do not flash if the current player has performed any gameplay actions this turn
                if (!state.turnActionTaken) {
                    if (isYGOLayout(state.layout)) {
                        // Blinks if the turn player has selected EP (End Phase), indicating the rival should click it
                        if (state.activePhase === 'EP') {
                            // The player who is NOT active should see the button flashing
                            // Or if in single player practice mode, let it flash to prompt the transition
                            $endTurnBtn.addClass("flashing");
                        }
                    } else {
                        // For Pokemon, it just blinks until the rival/player touches it to swap turns
                        $endTurnBtn.addClass("flashing");
                    }
                }
            }

            // Hook layout change menu changes
            $("#select-board-layout").on("change", function() {
                // Read from menu option to align state
                state.layout = $(this).val();
                updateLayoutFeatureVisibility();
            });

            // Initial feature check
            updateLayoutFeatureVisibility();

            // Intercept renderAllCards to apply layout specific styles for the accessories panel
            const baseUpdateLayoutFeatureVisibility = updateLayoutFeatureVisibility;
            updateLayoutFeatureVisibility = function() {
                baseUpdateLayoutFeatureVisibility();
                if (isYGOLayout(state.layout)) {
                    $(".ygo-only-tool").show();
                    $(".pokemon-only-tool").hide();
                    $(".counter-section-title").text("Contadores YGO");
                    $("#menu-to-banish").html('<i class="fas fa-ban"></i> Enviar a Desterrado');
                } else {
                    $(".ygo-only-tool").hide();
                    if (state.layout === 'pokemon') {
                        $(".pokemon-only-tool").show();
                        $(".counter-section-title").text("Daño Pokémon");
                    } else {
                        $(".pokemon-only-tool").hide();
                    }
                    $("#menu-to-banish").html('<i class="fas fa-ban"></i> Enviar a Removido');
                }
            };
            updateLayoutFeatureVisibility();

            // 1. Dice Roll Logic
            $(".dice-action-btn").click(function() {
                const $dice = $(this);
                if ($dice.hasClass("rolling")) return;

                const playerSuffix = (currentRole === "player1" ? "p1" : "p2").toUpperCase();
                $dice.addClass("rolling");
                sendGameAction(`[${playerSuffix}] Está lanzando un dado...`);

                let rollInterval = setInterval(() => {
                    $dice.text(Math.floor(Math.random() * 6) + 1);
                }, 80);

                setTimeout(() => {
                    clearInterval(rollInterval);
                    const finalRoll = Math.floor(Math.random() * 6) + 1;
                    $dice.text(finalRoll).removeClass("rolling");
                    sendGameAction(`[${playerSuffix}] Lanzó un dado y obtuvo: 🎲 ${finalRoll}`);
                }, 600);
            });

            // 2. Coin Flip Logic
            $(".coin-action-btn").click(function() {
                const $coin = $(this);
                if ($coin.hasClass("flipping")) return;

                const playerSuffix = (currentRole === "player1" ? "p1" : "p2").toUpperCase();
                $coin.addClass("flipping");
                sendGameAction(`[${playerSuffix}] Está lanzando una moneda...`);

                setTimeout(() => {
                    $coin.removeClass("flipping");
                    const isHeads = Math.random() < 0.5;
                    const finalResult = isHeads ? "Cara" : "Cruz";

                    if (isHeads) {
                        $coin.find(".coin-inner").css("transform", "rotateY(0deg)");
                    } else {
                        $coin.find(".coin-inner").css("transform", "rotateY(180deg)");
                    }
                    sendGameAction(`[${playerSuffix}] Lanzó una moneda y obtuvo: 🪙 ${finalResult}`);
                }, 800);
            });

            // 3. Spawning Token Cards with Selective Zone Placing (Yu-Gi-Oh!)
            const DEFAULT_TOKENS = [
                { name: "Ficha de Monstruo (Token)", imageUrl: "https://images.ygoprodeck.com/images/cards/10000000.jpg", description: "Ficha Especial." },
                { name: "Ficha de Chivo Expiatorio (Scapegoat)", imageUrl: "https://images.ygoprodeck.com/images/cards/73915051.jpg", description: "Ficha Especial invocada por Chivo Expiatorio." },
                { name: "Ficha de Kuriboh", imageUrl: "https://images.ygoprodeck.com/images/cards/40640051.jpg", description: "Ficha Especial de Kuriboh." },
                { name: "Ficha de Planta (Plant)", imageUrl: "https://images.ygoprodeck.com/images/cards/11384281.jpg", description: "Ficha Especial tipo Planta." },
                { name: "Ficha de Dragón (Dragon)", imageUrl: "https://images.ygoprodeck.com/images/cards/84687107.jpg", description: "Ficha Especial tipo Dragón." }
            ];

            $(".token-action-btn").click(function() {
                // Collapse the mobile sidebar panel to clearly view the popup and the playmat
                $(".duel-sidebar").removeClass("mobile-sidebar-active");

                const spawnerPlayer = currentRole === "player1" ? "p1" : "p2";
                const activeRoleKey = currentRole === "player1" ? "player1" : "player2";
                const pSuffix = currentRole === "player1" ? 1 : 2;

                const userTokens = state.deckTokens && state.deckTokens[activeRoleKey] ? state.deckTokens[activeRoleKey] : [];

                let availableTokens = [];
                if (userTokens.length > 0) {
                    availableTokens = userTokens;
                } else {
                    availableTokens = DEFAULT_TOKENS;
                }

                // Show a SweetAlert2 dialog with tokens to choose from
                Swal.fire({
                    title: 'Invocar Token',
                    html: `
                        <div style="margin-bottom: 15px; text-align: left;">
                            <label for="token-select" style="display:block; margin-bottom: 5px; color:#ffd32d; font-weight:bold; font-size: 0.9rem;">Selecciona un Token:</label>
                            <select id="token-select" class="swal2-select" style="display: block; width: 100%; box-sizing: border-box; margin: 0 auto; background: #2a3540; color: #fff; border: 1px solid #4f5f73; border-radius: 4px; padding: 8px;">
                                <!-- populated via JS -->
                            </select>
                        </div>
                        <div style="margin-bottom: 15px; text-align: center;">
                            <img id="token-preview-img" style="max-height: 180px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); display: none;" src="" alt="Token Preview" />
                        </div>
                    `,
                    showCancelButton: true,
                    confirmButtonText: 'Invocar',
                    cancelButtonText: 'Cancelar',
                    background: '#12181e',
                    color: '#fff',
                    confirmButtonColor: '#ffd32d',
                    cancelButtonColor: '#ff4a4a',
                    didOpen: () => {
                        const select = document.getElementById('token-select');
                        const img = document.getElementById('token-preview-img');

                        availableTokens.forEach((t, i) => {
                            const opt = document.createElement('option');
                            opt.value = i;
                            opt.textContent = t.name;
                            select.appendChild(opt);
                        });

                        const updatePreview = () => {
                            const selectedIdx = select.value;
                            if (availableTokens[selectedIdx]) {
                                img.src = availableTokens[selectedIdx].imageUrl || availableTokens[selectedIdx].image_url;
                                img.style.display = 'inline-block';
                            } else {
                                img.style.display = 'none';
                            }
                        };

                        select.addEventListener('change', updatePreview);
                        updatePreview();
                    },
                    preConfirm: () => {
                        const select = document.getElementById('token-select');
                        const selectedIdx = select.value;
                        return availableTokens[selectedIdx];
                    }
                }).then((result) => {
                    if (result.isConfirmed && result.value) {
                        const token = result.value;

                        const newTokenObj = {
                            instanceId: `token_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                            name: token.name,
                            imageUrl: token.imageUrl || token.image_url,
                            owner: activeRoleKey,
                            controller: activeRoleKey,
                            zone: `monster_${pSuffix}_3`, // placeholder
                            faceDown: false,
                            tapped: false, // Default to Attack Position
                            counters: 0,
                            attachedTo: null,
                            x: 430,
                            y: pSuffix === 1 ? 320 : 160,
                            z: state.cards.length + 10,
                            isExtra: false,
                            isToken: true,
                            description: token.description || token.effect || "Ficha Especial."
                        };

                        state.cards.push(newTokenObj);

                        setTimeout(() => {
                            startGraphicalTargeting(newTokenObj, "summon");
                            sendGameAction(`Está invocando de forma especial un Token: 🌟 ${token.name}`);
                        }, 200);
                    }
                });
            });

            // 4. Custom Drag-and-Drop Counter Handlers
            let activeCounterDragVal = null; // null for YGO, integer (10, 20... 100) for Pokémon, or object for CUSTOM_ATK_DEF / REMOVE_ATK_DEF

            $(document).on("dragstart", ".counter-source, .custom-atk-def-source, .custom-atk-def-badge", function(e) {
                $(".duel-sidebar").removeClass("mobile-sidebar-active");
                if ($(this).hasClass("custom-atk-def-source")) {
                    const $parent = $(this).closest(".accessories-section");
                    const atk = parseInt($parent.find(".custom-atk-input").val()) || 0;
                    const def = parseInt($parent.find(".custom-def-input").val()) || 0;
                    activeCounterDragVal = { type: "CUSTOM_ATK_DEF", atk: atk, def: def };
                    if (e.originalEvent.dataTransfer) {
                        e.originalEvent.dataTransfer.setData("text/plain", "custom_atk_def");
                    }
                } else if ($(this).hasClass("custom-atk-def-badge")) {
                    const instId = $(this).data("instance-id");
                    activeCounterDragVal = { type: "REMOVE_ATK_DEF", cardInstanceId: instId };
                    if (e.originalEvent.dataTransfer) {
                        e.originalEvent.dataTransfer.setData("text/plain", "remove_atk_def");
                    }
                } else {
                    // Determine counter type
                    if ($(this).hasClass("ygo-counter-source")) {
                        activeCounterDragVal = "YGO";
                    } else {
                        activeCounterDragVal = parseInt($(this).data("val"));
                    }

                    // Keep clone image invisible or custom
                    if (e.originalEvent.dataTransfer) {
                        e.originalEvent.dataTransfer.setData("text/plain", "counter");
                    }
                }
            });

            // Allow drop targets
            $(document).on("dragover", ".duel-card", function(e) {
                e.preventDefault();
            });

            $(document).on("dragover", "#playmat, body", function(e) {
                e.preventDefault();
            });

            $(document).on("drop", "#playmat, body", function(e) {
                if (activeCounterDragVal && activeCounterDragVal.type === "REMOVE_ATK_DEF") {
                    e.preventDefault();
                    const oldCard = state.cards.find(c => c.instanceId === activeCounterDragVal.cardInstanceId);
                    if (oldCard) {
                        delete oldCard.customAtkDef;
                        sendGameAction(`Quitó ATK/DEF personalizado de ${oldCard.name}`);
                        window.renderAllCards();
                    }
                    activeCounterDragVal = null;
                }
            });

            $(document).on("drop", ".duel-card", function(e) {
                e.preventDefault();
                e.stopPropagation();

                const instId = $(this).data("instance-id");
                const cardObj = state.cards.find(c => c.instanceId === instId);
                if (!cardObj) return;

                if (activeCounterDragVal && activeCounterDragVal.type === "CUSTOM_ATK_DEF") {
                    cardObj.customAtkDef = {
                        atk: activeCounterDragVal.atk,
                        def: activeCounterDragVal.def
                    };
                    sendGameAction(`Colocó ATK/DEF personalizado en ${cardObj.name} (ATK: ${cardObj.customAtkDef.atk} / DEF: ${cardObj.customAtkDef.def})`);
                } else if (activeCounterDragVal && activeCounterDragVal.type === "REMOVE_ATK_DEF") {
                    const oldCard = state.cards.find(c => c.instanceId === activeCounterDragVal.cardInstanceId);
                    if (oldCard && oldCard.instanceId !== cardObj.instanceId) {
                        cardObj.customAtkDef = { ...oldCard.customAtkDef };
                        delete oldCard.customAtkDef;
                        sendGameAction(`Movió ATK/DEF personalizado de ${oldCard.name} a ${cardObj.name}`);
                    }
                } else if (activeCounterDragVal === "YGO") {
                    if (!isYGOLayout(state.layout)) return;
                    cardObj.counters = (cardObj.counters || 0) + 1;
                    sendGameAction(`Colocó un contador en ${cardObj.name} (Total: ${cardObj.counters})`);
                } else if (typeof activeCounterDragVal === "number") {
                    if (state.layout !== 'pokemon') return;
                    if (!cardObj.pokemonDamageCounters) {
                        cardObj.pokemonDamageCounters = [];
                    }
                    cardObj.pokemonDamageCounters.push(activeCounterDragVal);

                    // Sum counters for overall Pokémon tracking
                    const totalDmg = cardObj.pokemonDamageCounters.reduce((a, b) => a + b, 0);
                    sendGameAction(`Agregó contador de daño de ${activeCounterDragVal} a ${cardObj.name} (Daño total: ${totalDmg})`);
                }

                window.renderAllCards();
                activeCounterDragVal = null;
            });

            // Fallback touch-friendly manual drag handler for mobiles
            let activeTouchDragSource = null;
            let $activeTouchDragClone = null;

            $(document).on("touchstart", ".counter-source, .custom-atk-def-source, .custom-atk-def-badge", function(e) {
                $(".duel-sidebar").removeClass("mobile-sidebar-active");
                activeTouchDragSource = $(this);
                if (activeTouchDragSource.hasClass("custom-atk-def-source")) {
                    const $parent = activeTouchDragSource.closest(".accessories-section");
                    const atk = parseInt($parent.find(".custom-atk-input").val()) || 0;
                    const def = parseInt($parent.find(".custom-def-input").val()) || 0;
                    activeCounterDragVal = { type: "CUSTOM_ATK_DEF", atk: atk, def: def };
                } else if (activeTouchDragSource.hasClass("custom-atk-def-badge")) {
                    const instId = activeTouchDragSource.data("instance-id");
                    activeCounterDragVal = { type: "REMOVE_ATK_DEF", cardInstanceId: instId };
                } else {
                    const isYGO = activeTouchDragSource.hasClass("ygo-counter-source");
                    activeCounterDragVal = isYGO ? "YGO" : parseInt(activeTouchDragSource.data("val"));
                }

                const coords = getEventCoords(e);
                $activeTouchDragClone = activeTouchDragSource.clone()
                    .addClass("dragging-counter-clone")
                    .css({
                        left: `${coords.x}px`,
                        top: `${coords.y}px`,
                        position: 'absolute',
                        pointerEvents: 'none',
                        zIndex: 1000000
                    })
                    .appendTo("body");
            });

            $(document).on("touchmove", function(e) {
                if (!$activeTouchDragClone) return;
                const coords = getEventCoords(e);
                $activeTouchDragClone.css({
                    left: `${coords.x}px`,
                    top: `${coords.y}px`
                });
            });

            $(document).on("touchend", function(e) {
                if (!$activeTouchDragClone) return;

                const coords = getEventCoords(e);
                $activeTouchDragClone.remove();
                $activeTouchDragClone = null;

                // Find element under touch point
                const targetEl = document.elementFromPoint(coords.clientX || coords.x, coords.clientY || coords.y);
                const cardElem = $(targetEl).closest(".duel-card");

                if (cardElem.length) {
                    const instId = cardElem.data("instance-id");
                    const cardObj = state.cards.find(c => c.instanceId === instId);
                    if (cardObj) {
                        if (activeCounterDragVal && activeCounterDragVal.type === "CUSTOM_ATK_DEF") {
                            cardObj.customAtkDef = {
                                atk: activeCounterDragVal.atk,
                                def: activeCounterDragVal.def
                            };
                            sendGameAction(`Colocó ATK/DEF personalizado en ${cardObj.name} (ATK: ${cardObj.customAtkDef.atk} / DEF: ${cardObj.customAtkDef.def})`);
                        } else if (activeCounterDragVal && activeCounterDragVal.type === "REMOVE_ATK_DEF") {
                            const oldCard = state.cards.find(c => c.instanceId === activeCounterDragVal.cardInstanceId);
                            if (oldCard && oldCard.instanceId !== cardObj.instanceId) {
                                cardObj.customAtkDef = { ...oldCard.customAtkDef };
                                delete oldCard.customAtkDef;
                                sendGameAction(`Movió ATK/DEF personalizado de ${oldCard.name} a ${cardObj.name}`);
                            }
                        } else if (activeCounterDragVal === "YGO") {
                            if (isYGOLayout(state.layout)) {
                                cardObj.counters = (cardObj.counters || 0) + 1;
                                sendGameAction(`Colocó un contador en ${cardObj.name} (Total: ${cardObj.counters})`);
                            }
                        } else if (typeof activeCounterDragVal === "number") {
                            if (state.layout === 'pokemon') {
                                if (!cardObj.pokemonDamageCounters) {
                                    cardObj.pokemonDamageCounters = [];
                                }
                                cardObj.pokemonDamageCounters.push(activeCounterDragVal);
                                const totalDmg = cardObj.pokemonDamageCounters.reduce((a, b) => a + b, 0);
                                sendGameAction(`Agregó contador de daño de ${activeCounterDragVal} a ${cardObj.name} (Daño total: ${totalDmg})`);
                            }
                        }
                        window.renderAllCards();
                    }
                } else {
                    // Touch dropped outside any card
                    if (activeCounterDragVal && activeCounterDragVal.type === "REMOVE_ATK_DEF") {
                        const oldCard = state.cards.find(c => c.instanceId === activeCounterDragVal.cardInstanceId);
                        if (oldCard) {
                            delete oldCard.customAtkDef;
                            sendGameAction(`Quitó ATK/DEF personalizado de ${oldCard.name}`);
                            window.renderAllCards();
                        }
                    }
                }

                activeTouchDragSource = null;
                activeCounterDragVal = null;
            });

            // Override original renderAllCards to draw our stacked counters overlay cleanly
            const baseRenderAllCards = window.renderAllCards;
            window.renderAllCards = function() {
                baseRenderAllCards();

                // Inject Custom Counters
                state.cards.forEach(card => {
                    const $card = $(`#${card.instanceId}`);
                    if (!$card.length) return;

                    // Remove legacy single counter badge if needed, but we keep it safe.
                    // Instead, let's inject a beautiful clean stacked indicator overlay.
                    $card.find(".card-counter-container").remove();
                    $card.find(".counter-tooltip").remove();

                    const styleOverride = card.counterPosition
                        ? `style="left: ${card.counterPosition.left}px; top: ${card.counterPosition.top}px; bottom: auto; transform: none;"`
                        : "";

                    if (isYGOLayout(state.layout)) {
                        if (card.counters && card.counters > 0) {
                            let beadsHtml = "";
                            const visibleBeadsCount = Math.min(card.counters, 5); // Limit stacked nodes visually to 5 beads maximum
                            for (let i = 0; i < visibleBeadsCount; i++) {
                                beadsHtml += `<div class="stacked-counter-bead ygo-bead" style="transform: translateX(${i * -3}px) translateY(${i * -2}px); z-index: ${10 - i};"></div>`;
                            }

                            $card.append(`
                                <div class="card-counter-container" data-instance-id="${card.instanceId}" ${styleOverride}>
                                    ${beadsHtml}
                                    <div class="counter-tooltip">Contadores: ${card.counters}</div>
                                </div>
                            `);
                        }
                    } else {
                        // Pokémon Layout damage counters
                        const dmgArray = card.pokemonDamageCounters || [];
                        if (dmgArray.length > 0) {
                            let beadsHtml = "";
                            const totalDmg = dmgArray.reduce((a, b) => a + b, 0);
                            const visibleBeadsCount = Math.min(dmgArray.length, 4);

                            for (let i = 0; i < visibleBeadsCount; i++) {
                                const val = dmgArray[i];
                                let colorClass = "dmg-10";
                                if (val >= 50 && val < 80) colorClass = "dmg-50";
                                else if (val >= 80) colorClass = "dmg-80";

                                beadsHtml += `<div class="stacked-counter-bead poke-bead ${colorClass}" style="transform: translateX(${i * -4}px) translateY(${i * -2}px); z-index: ${10 - i};" data-idx="${i}">${val}</div>`;
                            }

                            // Inject visible damage total badge on top left of the card in addition to details
                            $card.append(`
                                <div class="pokemon-damage-badge">${totalDmg}</div>
                                <div class="card-counter-container" data-instance-id="${card.instanceId}" ${styleOverride}>
                                    ${beadsHtml}
                                    <div class="counter-tooltip">Daño Total: ${totalDmg}</div>
                                </div>
                            `);
                        }
                    }

                    // Render Custom ATK/DEF Badge if set
                    $card.find(".custom-atk-def-badge").remove();
                    if (card.customAtkDef) {
                        $card.append(`
                            <div class="custom-atk-def-badge" draggable="true" data-instance-id="${card.instanceId}">
                                <span>ATK: <span class="atk-val">${card.customAtkDef.atk}</span></span>
                                <span>DEF: <span class="def-val">${card.customAtkDef.def}</span></span>
                            </div>
                        `);
                    }
                });
            };

            // Click/Edit Custom ATK/DEF badge
            $(document).on("click", ".custom-atk-def-badge", function(e) {
                e.preventDefault();
                e.stopPropagation();

                const instId = $(this).data("instance-id");
                const cardObj = state.cards.find(c => c.instanceId === instId);
                if (!cardObj || !cardObj.customAtkDef) return;

                Swal.fire({
                    title: `Modificar ATK/DEF - ${cardObj.name}`,
                    html: `
                        <div style="display: flex; gap: 15px; justify-content: center; margin-top: 15px;">
                            <div>
                                <label style="display: block; font-weight: bold; color: #ff4a4a; margin-bottom: 5px; font-size: 0.9rem;">ATK:</label>
                                <input type="number" id="edit-atk-input" class="swal2-input" value="${cardObj.customAtkDef.atk}" style="width: 100px; margin: 0; text-align: center; background: #2a3540; color: #fff; border: 1px solid #4f5f73;">
                            </div>
                            <div>
                                <label style="display: block; font-weight: bold; color: #00d2ff; margin-bottom: 5px; font-size: 0.9rem;">DEF:</label>
                                <input type="number" id="edit-def-input" class="swal2-input" value="${cardObj.customAtkDef.def}" style="width: 100px; margin: 0; text-align: center; background: #2a3540; color: #fff; border: 1px solid #4f5f73;">
                            </div>
                        </div>
                    `,
                    showCancelButton: true,
                    showDenyButton: true,
                    confirmButtonText: 'Guardar',
                    denyButtonText: 'Eliminar',
                    cancelButtonText: 'Cancelar',
                    background: '#12181e',
                    color: '#fff',
                    confirmButtonColor: '#ffd32d',
                    denyButtonColor: '#ff4a4a',
                    preConfirm: () => {
                        const atk = parseInt(document.getElementById('edit-atk-input').value) || 0;
                        const def = parseInt(document.getElementById('edit-def-input').value) || 0;
                        return { atk, def };
                    }
                }).then((result) => {
                    if (result.isConfirmed) {
                        cardObj.customAtkDef = {
                            atk: result.value.atk,
                            def: result.value.def
                        };
                        sendGameAction(`Modificó ATK/DEF en ${cardObj.name} (ATK: ${result.value.atk} / DEF: ${result.value.def})`);
                        window.renderAllCards();
                    } else if (result.isDenied) {
                        delete cardObj.customAtkDef;
                        sendGameAction(`Quitó ATK/DEF personalizado de ${cardObj.name}`);
                        window.renderAllCards();
                    }
                });
            });

            // Remove/Click Individual counters easily
            $(document).on("click", ".card-counter-container .stacked-counter-bead", function(e) {
                e.preventDefault();
                e.stopPropagation();

                const instId = $(this).closest(".card-counter-container").data("instance-id");
                const cardObj = state.cards.find(c => c.instanceId === instId);
                if (!cardObj) return;

                if (isYGOLayout(state.layout)) {
                    cardObj.counters = Math.max(0, (cardObj.counters || 0) - 1);
                    sendGameAction(`Quitó un contador de ${cardObj.name} (Total restante: ${cardObj.counters})`);
                } else {
                    const idx = $(this).data("idx");
                    const dmgArray = cardObj.pokemonDamageCounters || [];
                    if (dmgArray.length > 0) {
                        const removedDmg = dmgArray.splice(idx !== undefined ? idx : dmgArray.length - 1, 1)[0];
                        const totalDmg = dmgArray.reduce((a, b) => a + b, 0);
                        sendGameAction(`Quitó un contador de daño de ${removedDmg} a ${cardObj.name} (Daño restante: ${totalDmg})`);
                    }
                }

                window.renderAllCards();
            });

            // Remove/Click static Pokemon damage total badge directly clears latest or heals 10
            $(document).on("click", ".pokemon-damage-badge", function(e) {
                e.preventDefault();
                e.stopPropagation();

                const instId = $(this).closest(".duel-card").data("instance-id");
                const cardObj = state.cards.find(c => c.instanceId === instId);
                if (!cardObj) return;

                const dmgArray = cardObj.pokemonDamageCounters || [];
                if (dmgArray.length > 0) {
                    const removedDmg = dmgArray.pop();
                    const totalDmg = dmgArray.reduce((a, b) => a + b, 0);
                    sendGameAction(`Quitó un contador de daño de ${removedDmg} a ${cardObj.name} (Daño restante: ${totalDmg})`);
                    window.renderAllCards();
                }
            });

            // Phase buttons manual selection
            $(".phase-btn").click(function() {
                const targetPhase = $(this).data("phase");
                state.activePhase = targetPhase;
                updateTurnUI();

                // Broadcast phase change
                sendTurnStateUpdate();
            });

            // End Turn Button Action
            $("#btn-end-turn").click(function() {
                // Swap Turn between player1 and player2
                state.activeTurn = state.activeTurn === 'player1' ? 'player2' : 'player1';
                // Reset phase to DP
                state.activePhase = 'DP';
                state.turnActionTaken = false; // Reset action taken state for the next turn

                // Clear all active attack arrows automatically on turn swap
                state.attacks = [];
                try {
                    if (typeof commChannel !== "undefined" && commChannel && typeof commChannel.send === "function") {
                        commChannel.send({
                            type: 'broadcast',
                            event: 'attack_sync',
                            payload: { attacks: [] }
                        });
                    }
                } catch (e) {
                    console.warn("Could not sync attack reset:", e);
                }
                if (typeof window.drawAttackArrows === "function") {
                    window.drawAttackArrows();
                }

                updateTurnUI();

                // Log turn change
                const turnLabel = state.activeTurn === 'player1' ? 'Jugador 1' : 'Jugador 2';
                appendGameLog('SYS', `Turno de: ${turnLabel}`);

                // Broadcast Turn/Phase change
                sendTurnStateUpdate();
            });

            // Helper to broadcast custom state updates
            function sendTurnStateUpdate() {
                const turnStateData = {
                    activeTurn: state.activeTurn,
                    activePhase: state.activePhase,
                    lp: state.lp,
                    turnActionTaken: state.turnActionTaken
                };
                try {
                    if (typeof commChannel !== "undefined" && commChannel && typeof commChannel.send === "function") {
                        commChannel.send({
                            type: 'broadcast',
                            event: 'turn_state_sync',
                            payload: turnStateData
                        });
                    }
                } catch (e) {
                    console.warn("Could not sync turn state:", e);
                }
            }

            // Life Points button controls (+, -, /2) with calculator entry
            $(".lp-btn").click(function() {
                const player = $(this).data("player"); // "p1" or "p2"
                const key = player === "p1" ? "player1" : "player2";
                const calcInputId = player === "p1" ? "#lp-calc-p1" : "#lp-calc-p2";
                const enteredValue = parseInt($(calcInputId).val()) || 0;

                if ($(this).hasClass("lp-btn-add")) {
                    state.lp[key] += enteredValue;
                    appendGameLog('SYS', `Sumó ${enteredValue} LP a ${player === "p1" ? "P1" : "P2"} (Total: ${state.lp[key]})`);
                    $(calcInputId).val(""); // Clear after calc
                } else if ($(this).hasClass("lp-btn-sub")) {
                    state.lp[key] = Math.max(0, state.lp[key] - enteredValue);
                    appendGameLog('SYS', `Restó ${enteredValue} LP a ${player === "p1" ? "P1" : "P2"} (Total: ${state.lp[key]})`);
                    $(calcInputId).val(""); // Clear after calc
                } else if ($(this).hasClass("lp-btn-half")) {
                    const originalLP = state.lp[key];
                    state.lp[key] = Math.ceil(state.lp[key] / 2);
                    appendGameLog('SYS', `Dividió a la mitad los LP de ${player === "p1" ? "P1" : "P2"} de ${originalLP} a ${state.lp[key]}`);
                }

                updateTurnUI();
                sendTurnStateUpdate();
            });

            // Mobile Click LP counter to show SweetAlert2 calculator
            $(".lp-counter-container").click(function(e) {
                // If clicking an input/button of desktop layout, ignore
                if ($(e.target).closest(".lp-calc-input, .lp-btn").length) {
                    return;
                }
                const player = $(this).attr("id") === "lp-counter-p1" ? "p1" : "p2";
                const key = player === "p1" ? "player1" : "player2";
                const currentLP = state.lp[key];

                Swal.fire({
                    title: `Calculadora LP - ${player.toUpperCase()}`,
                    html: `
                        <div style="font-family: 'Orbitron', sans-serif; font-size: 1.5rem; font-weight: bold; color: #fff; margin-bottom: 10px; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px;" id="calc-current-display">
                            ${currentLP}
                        </div>
                        <input type="text" id="calc-input-value" class="swal2-input" placeholder="0" readonly style="text-align: center; font-size: 1.5rem; font-family: 'Orbitron', sans-serif; margin: 10px auto; width: 80%; background: #1e2530; color: #fff; border: 1.5px solid var(--primary-color);">

                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 15px auto; max-width: 240px;">
                            <button class="btn btn-calc" data-val="7" style="padding: 10px 0; font-size: 1.1rem;">7</button>
                            <button class="btn btn-calc" data-val="8" style="padding: 10px 0; font-size: 1.1rem;">8</button>
                            <button class="btn btn-calc" data-val="9" style="padding: 10px 0; font-size: 1.1rem;">9</button>
                            <button class="btn btn-calc" data-val="4" style="padding: 10px 0; font-size: 1.1rem;">4</button>
                            <button class="btn btn-calc" data-val="5" style="padding: 10px 0; font-size: 1.1rem;">5</button>
                            <button class="btn btn-calc" data-val="6" style="padding: 10px 0; font-size: 1.1rem;">6</button>
                            <button class="btn btn-calc" data-val="1" style="padding: 10px 0; font-size: 1.1rem;">1</button>
                            <button class="btn btn-calc" data-val="2" style="padding: 10px 0; font-size: 1.1rem;">2</button>
                            <button class="btn btn-calc" data-val="3" style="padding: 10px 0; font-size: 1.1rem;">3</button>
                            <button class="btn btn-calc" data-val="0" style="padding: 10px 0; font-size: 1.1rem;">0</button>
                            <button class="btn btn-calc" data-val="00" style="padding: 10px 0; font-size: 1.1rem;">00</button>
                            <button class="btn btn-calc" data-val="000" style="padding: 10px 0; font-size: 1.1rem;">000</button>
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px auto; max-width: 240px;">
                            <button class="btn btn-calc-op btn-danger" data-op="sub" style="padding: 12px 0; font-weight: bold; font-size: 1.1rem;">-</button>
                            <button class="btn btn-calc-op btn-success" data-op="add" style="padding: 12px 0; font-weight: bold; font-size: 1.1rem;">+</button>
                            <button class="btn btn-calc-op btn-warning" data-op="half" style="padding: 12px 0; font-weight: bold; font-size: 0.9rem; background: #ff9f43; border: none; color: #fff;">/2</button>
                            <button class="btn btn-calc-clear btn-secondary" style="padding: 12px 0; font-weight: bold; font-size: 1.1rem; background: #4b6584; border: none; color: #fff;">C</button>
                        </div>
                    `,
                    background: '#12181e',
                    color: '#fff',
                    showConfirmButton: false,
                    showCloseButton: true,
                    didOpen: () => {
                        const inputVal = $("#calc-input-value");

                        // Handle numbers click
                        $(".btn-calc").click(function() {
                            const val = $(this).data("val");
                            let curr = inputVal.val();
                            if (curr === "0") curr = "";
                            inputVal.val(curr + val);
                        });

                        // Handle clear click
                        $(".btn-calc-clear").click(function() {
                            inputVal.val("");
                        });

                        // Handle operators click
                        $(".btn-calc-op").click(function() {
                            const op = $(this).data("op");
                            const entered = parseInt(inputVal.val()) || 0;

                            if (op === "add") {
                                if (entered > 0) {
                                    state.lp[key] += entered;
                                    appendGameLog('SYS', `Sumó ${entered} LP a ${player === "p1" ? "P1" : "P2"} (Total: ${state.lp[key]})`);
                                }
                            } else if (op === "sub") {
                                if (entered > 0) {
                                    state.lp[key] = Math.max(0, state.lp[key] - entered);
                                    appendGameLog('SYS', `Restó ${entered} LP a ${player === "p1" ? "P1" : "P2"} (Total: ${state.lp[key]})`);
                                }
                            } else if (op === "half") {
                                const originalLP = state.lp[key];
                                state.lp[key] = Math.ceil(state.lp[key] / 2);
                                appendGameLog('SYS', `Dividió a la mitad los LP de ${player === "p1" ? "P1" : "P2"} de ${originalLP} a ${state.lp[key]}`);
                            }

                            updateTurnUI();
                            sendTurnStateUpdate();
                            Swal.close();
                        });

                        // Support physical keyboard entries
                        $(document).off("keydown.calc").on("keydown.calc", function(ke) {
                            if (ke.key >= '0' && ke.key <= '9') {
                                let curr = inputVal.val();
                                if (curr === "0") curr = "";
                                inputVal.val(curr + ke.key);
                            } else if (ke.key === 'Backspace' || ke.key === 'Delete') {
                                let curr = inputVal.val();
                                if (curr.length > 0) {
                                    inputVal.val(curr.slice(0, -1));
                                }
                            } else if (ke.key === '+' || ke.key === 'Enter') {
                                ke.preventDefault();
                                const entered = parseInt(inputVal.val()) || 0;
                                if (entered > 0) {
                                    state.lp[key] += entered;
                                    appendGameLog('SYS', `Sumó ${entered} LP a ${player === "p1" ? "P1" : "P2"} (Total: ${state.lp[key]})`);
                                    updateTurnUI();
                                    sendTurnStateUpdate();
                                }
                                Swal.close();
                            } else if (ke.key === '-') {
                                ke.preventDefault();
                                const entered = parseInt(inputVal.val()) || 0;
                                if (entered > 0) {
                                    state.lp[key] = Math.max(0, state.lp[key] - entered);
                                    appendGameLog('SYS', `Restó ${entered} LP a ${player === "p1" ? "P1" : "P2"} (Total: ${state.lp[key]})`);
                                    updateTurnUI();
                                    sendTurnStateUpdate();
                                }
                                Swal.close();
                            } else if (ke.key === '/') {
                                ke.preventDefault();
                                const originalLP = state.lp[key];
                                state.lp[key] = Math.ceil(state.lp[key] / 2);
                                appendGameLog('SYS', `Dividió a la mitad los LP de ${player === "p1" ? "P1" : "P2"} de ${originalLP} a ${state.lp[key]}`);
                                updateTurnUI();
                                sendTurnStateUpdate();
                                Swal.close();
                            } else if (ke.key === 'c' || ke.key === 'C') {
                                inputVal.val("");
                            }
                        });
                    },
                    willClose: () => {
                        $(document).off("keydown.calc");
                    }
                });
            });

            // 8. Decorate global helper functions in duelmobile.js
            let isDrawingAction = false;

            const originalDrawCards = window.drawCards;
            window.drawCards = function(playerKey, count) {
                const playerLabel = playerKey === "player1" ? "Jugador 1" : "Jugador 2";
                const cardsCount = count || 1;

                // Mark drawing action so Card Diff Tracker ignores moving to hand_X
                isDrawingAction = true;

                sendGameAction(`Robó ${cardsCount} carta(s)`);

                originalDrawCards.apply(this, arguments);

                // Turn action taken
                if (typeof window.markTurnActionTaken === "function") {
                    window.markTurnActionTaken();
                }

                setTimeout(() => { isDrawingAction = false; }, 600);
            };

            const originalShuffleDeck = window.shuffleDeck;
            window.shuffleDeck = function(playerKey) {
                sendGameAction(`Barajó su Deck`);
                originalShuffleDeck.apply(this, arguments);
            };

            const originalSetupPokemonPrizes = window.setupPokemonPrizes;
            window.setupPokemonPrizes = function(playerKey) {
                sendGameAction(`Colocó sus 6 cartas de Premio`);
                originalSetupPokemonPrizes.apply(this, arguments);
            };

            // Trigger gameplay action check
            window.markTurnActionTaken = function() {
                if (!state.turnActionTaken) {
                    state.turnActionTaken = true;
                    updateTurnUI();
                    sendTurnStateUpdate();
                }
            };

            // 9. Card State Diff Tracker
            let previousCardStates = {};

            function isFieldZone(zoneId) {
                if (!zoneId) return false;
                return !zoneId.startsWith("hand_") &&
                       !zoneId.startsWith("deck_") &&
                       !(zoneId.startsWith("extra_") && !zoneId.startsWith("extra_monster")) &&
                       !zoneId.startsWith("prize_") &&
                       !zoneId.startsWith("grave_") &&
                       !zoneId.startsWith("banished_");
            }

            function getZoneFriendlyName(zoneId) {
                if (!zoneId) return "Campo";
                if (zoneId.startsWith("hand_")) return "la Mano";
                if (zoneId.startsWith("deck_")) return "el Deck";
                if (zoneId.startsWith("extra_") && !zoneId.startsWith("extra_monster")) return "el Extra Deck";
                if (zoneId.startsWith("grave_")) {
                    return isYGOLayout(state.layout) ? "el Cementerio" : "la zona de Descarte";
                }
                if (zoneId.startsWith("banished_")) {
                    return isYGOLayout(state.layout) ? "la zona Desterrado" : "zona Removido";
                }
                if (zoneId.startsWith("prize_")) return "la zona de Premios";

                // Active slots mapping
                const zones = BOARD_LAYOUTS[state.layout];
                const zoneObj = zones.find(z => z.id === zoneId);
                return zoneObj ? `<b>${zoneObj.name}</b>` : "el Tablero";
            }

            function trackCardStates() {
                let currentStates = {};
                state.cards.forEach(card => {
                    currentStates[card.instanceId] = {
                        zone: card.zone,
                        faceDown: card.faceDown,
                        tapped: card.tapped,
                        counters: card.counters,
                        pokemonDamageCounters: card.pokemonDamageCounters ? [...card.pokemonDamageCounters] : [],
                        attachedTo: card.attachedTo,
                        controller: card.controller
                    };
                });
                return currentStates;
            }

            // Wrap renderAllCards to perform automatic action logging on diff
            const originalRenderAllCards = window.renderAllCards;
            window.renderAllCards = function() {
                const oldStates = previousCardStates;
                const newStates = trackCardStates();

                // If this render is triggered by a remote sync, do not log or broadcast!
                if (window.isIncomingSync) {
                    previousCardStates = newStates;
                    originalRenderAllCards.apply(this, arguments);
                    return;
                }

                // If rendering or layout triggers, mark turn action if card locations changed
                if (Object.keys(oldStates).length > 0) {
                    let moved = false;
                    Object.keys(newStates).forEach(instId => {
                        const oldC = oldStates[instId];
                        const newC = newStates[instId];
                        if (oldC && newC && (oldC.zone !== newC.zone || oldC.faceDown !== newC.faceDown || oldC.tapped !== newC.tapped)) {
                            moved = true;
                        }
                    });
                    if (moved && typeof window.markTurnActionTaken === "function") {
                        window.markTurnActionTaken();
                    }
                }

                // Diff them
                Object.keys(newStates).forEach(instId => {
                    const oldC = oldStates[instId];
                    const newC = newStates[instId];
                    if (!oldC) return; // Ignore newly spawned or initial cards

                    const cardObj = state.cards.find(c => c.instanceId === instId);
                    if (!cardObj) return;

                    const wasPublic = !oldC.faceDown &&
                                      !oldC.zone.startsWith("hand_") &&
                                      !oldC.zone.startsWith("deck_") &&
                                      !oldC.zone.startsWith("prize_") &&
                                      !(oldC.zone.startsWith("extra_") && !oldC.zone.startsWith("extra_monster"));

                    const isNewPublic = !newC.faceDown &&
                                        !newC.zone.startsWith("hand_") &&
                                        !newC.zone.startsWith("deck_") &&
                                        !newC.zone.startsWith("prize_") &&
                                        !(newC.zone.startsWith("extra_") && !newC.zone.startsWith("extra_monster"));

                    // Escape variables for XSS protection
                    const escapedName = escapeHtml(cardObj.name);
                    const publicName = `<b>${escapedName}</b>`;
                    const privateName = "una carta";
                    const privateFaceDownName = "una carta boca abajo";

                    // A. Zone changes
                    if (oldC.zone !== newC.zone) {
                        // Skip if drawing cards is handling the log
                        if (isDrawingAction && newC.zone.startsWith("hand_")) return;

                        const oldZoneName = getZoneFriendlyName(oldC.zone);
                        const newZoneName = getZoneFriendlyName(newC.zone);

                        if (newC.zone.startsWith("grave_") || newC.zone.startsWith("banished_")) {
                            const nameToUse = (wasPublic || isNewPublic) ? publicName : privateName;
                            const actionLabel = newC.zone.startsWith("grave_") ? "Cementerio / Descarte" : "Desterró / Removió";
                            sendGameAction(`${actionLabel} a ${nameToUse} (desde ${oldZoneName})`);
                        } else if (newC.zone.startsWith("hand_") || newC.zone.startsWith("deck_") || (newC.zone.startsWith("extra_") && !newC.zone.startsWith("extra_monster")) || newC.zone.startsWith("prize_")) {
                            const nameToUse = wasPublic ? publicName : privateName;
                            let actionLabel = "Regresó";
                            let destLabel = "";
                            if (newC.zone.startsWith("hand_")) destLabel = "la mano";
                            else if (newC.zone.startsWith("prize_")) destLabel = "zona de Premios";
                            else destLabel = "el Deck";

                            sendGameAction(`${actionLabel} ${nameToUse} a ${destLabel} (desde ${oldZoneName})`);
                        } else {
                            // Moved to field slots
                            const isSet = newC.faceDown;
                            if (isSet) {
                                sendGameAction(`Colocó una carta boca abajo (Set) en ${newZoneName}`);
                            } else {
                                sendGameAction(`Invocó / Colocó a ${publicName} en ${newZoneName}`, null, true);
                            }
                        }
                    }
                    // B. Face-down status changes, tapped, counters, attachedTo, or controller switches
                    // Only track these if the card is currently in a public field zone!
                    else {
                        if (!isFieldZone(newC.zone)) {
                            return; // No peeking leaks for hands/deck/extra/prizes/etc.
                        }

                        if (oldC.faceDown !== newC.faceDown) {
                            if (newC.faceDown) {
                                sendGameAction(`volteó una carta boca abajo`);
                            } else {
                                sendGameAction(`volteó boca arriba a ${publicName}`, null, true);
                            }
                        }
                        // C. Tapped (Defense position) switches
                        else if (oldC.tapped !== newC.tapped) {
                            const posLabel = newC.tapped ? "Giro / Defensa" : "Vertical / Ataque";
                            const nameToUse = newC.faceDown ? privateFaceDownName : publicName;
                            sendGameAction(`Cambió posición de ${nameToUse} a ${posLabel}`);
                        }
                        // D. Counter badge updates
                        else if (oldC.counters !== newC.counters) {
                            const diff = newC.counters - oldC.counters;
                            const sign = diff > 0 ? `+${diff}` : `${diff}`;
                            const nameToUse = newC.faceDown ? privateFaceDownName : publicName;
                            sendGameAction(`Modificó contadores de ${nameToUse} (${sign})`);
                        }
                        // E. Card attachment modifications
                        else if (oldC.attachedTo !== newC.attachedTo) {
                            if (newC.attachedTo) {
                                const parentCard = state.cards.find(c => c.instanceId === newC.attachedTo);
                                if (parentCard) {
                                    const childName = oldC.faceDown ? privateFaceDownName : publicName;
                                    const parentName = parentCard.faceDown ? privateFaceDownName : `<b>${escapeHtml(parentCard.name)}</b>`;
                                    sendGameAction(`Acopló ${childName} a ${parentName}`);
                                }
                            } else {
                                const nameToUse = oldC.faceDown ? privateFaceDownName : publicName;
                                sendGameAction(`Desacopló ${nameToUse}`);
                            }
                        }
                        // F. Card controller switches
                        else if (oldC.controller !== newC.controller) {
                            const nameToUse = newC.faceDown ? privateFaceDownName : publicName;
                            sendGameAction(`Tomó el control de ${nameToUse}`);
                        }
                    }
                });

                // Keep previous states up to date
                previousCardStates = newStates;

                // Run original render layout
                originalRenderAllCards.apply(this, arguments);

                // Broadcast cards state if in multiplayer mode and not an incoming sync
                if (state.mode === "multiplayer" && !window.isIncomingSync) {
                    try {
                        if (typeof commChannel !== "undefined" && commChannel && typeof commChannel.send === "function") {
                            commChannel.send({
                                type: 'broadcast',
                                event: 'card_sync',
                                payload: { cards: state.cards }
                            });
                        }
                    } catch (e) {
                        console.warn("Could not sync cards state:", e);
                    }
                }
            };

            // Helper to get touch/mouse coordinates locally
            function getEventCoordsLocal(e) {
                const oe = e.originalEvent || e;
                if (oe.touches && oe.touches.length > 0) {
                    return { x: oe.touches[0].clientX, y: oe.touches[0].clientY };
                }
                if (oe.changedTouches && oe.changedTouches.length > 0) {
                    return { x: oe.changedTouches[0].clientX, y: oe.changedTouches[0].clientY };
                }
                return { x: e.clientX || oe.clientX, y: e.clientY || oe.clientY };
            }

            // Custom mouse and touch drag listeners for .card-counter-container to allow free relative positioning inside the card
            $(document).on("mousedown touchstart", ".card-counter-container", function(e) {
                e.preventDefault();
                e.stopPropagation();

                const $container = $(this);
                const instId = $container.data("instance-id");
                const cardObj = state.cards.find(c => c.instanceId === instId);
                if (!cardObj) return;

                const $card = $container.closest(".duel-card");
                const startCoords = getEventCoordsLocal(e);

                // Calculate initial position of the container relative to its offsetParent
                const containerPos = $container.position();
                const startLeft = containerPos.left;
                const startTop = containerPos.top;

                $(document).on("mousemove.counterdrag touchmove.counterdrag", function(ev) {
                    ev.preventDefault();
                    ev.stopPropagation();

                    const currentCoords = getEventCoordsLocal(ev);
                    const dx = currentCoords.x - startCoords.x;
                    const dy = currentCoords.y - startCoords.y;

                    let newLeft = startLeft + dx;
                    let newTop = startTop + dy;

                    // Standard card dimension constraints (card is 80x116 usually)
                    const cardW = $card.width() || 80;
                    const cardH = $card.height() || 116;

                    // Allow dragging slightly outside boundaries for more flexible placement
                    newLeft = Math.max(-15, Math.min(cardW - 15, newLeft));
                    newTop = Math.max(-15, Math.min(cardH - 15, newTop));

                    $container.css({
                        left: `${newLeft}px`,
                        top: `${newTop}px`,
                        bottom: 'auto',
                        transform: 'none'
                    });
                });

                $(document).on("mouseup.counterdrag touchend.counterdrag", function(ev) {
                    $(document).off(".counterdrag");

                    const pos = $container.position();
                    cardObj.counterPosition = {
                        left: pos.left,
                        top: pos.top
                    };

                    // Re-render and sync to broadcast state.cards to other players
                    window.renderAllCards();
                });
            });

            // Seed initial card states on load
            setTimeout(() => {
                previousCardStates = trackCardStates();
            }, 1000);
        });

        // Setup dragging trackers on playmat elements and clamping of context menus
        $(document).ready(function() {
            window.updateCardMenuOptions = function(cardObj) {
                $("#menu-view-card-detail").show();
                // By default, hide all hand-specific items
                $("#menu-summon").hide();
                $("#menu-defense").hide();
                $("#menu-set").hide();
                $("#menu-activate").hide();

                const isHandCard = cardObj.zone && cardObj.zone.startsWith("hand_");

                if (isHandCard) {
                    // Hand Card layout options
                    $("#menu-summon").show();
                    if (isYGOLayout(state.layout)) {
                        $("#menu-defense").show();
                        $("#menu-set").show();
                    } else if (state.layout === 'pokemon') {
                        $("#menu-activate").show();
                    }
                    $("#menu-attach-option").show();
                    $("#menu-view-attached").hide();
                    $("#menu-hr-attached-actions").show();

                    // Hide field-only options
                    $("#menu-attack").hide();
                    $("#menu-direct-attack").hide();
                    $("#menu-hr-attack").hide();
                    $("#menu-flip").hide();
                    $("#menu-tap").hide();
                    $("#menu-swap-active-bench").hide();
                    $("#menu-add-counter").hide();
                    $("#menu-sub-counter").hide();
                    $("#menu-to-hand").hide();
                    $("#menu-destroy-token").hide();
                    $("#menu-control").hide();
                    $("#menu-detach").hide();
                    $("#menu-trigger-effect").hide();
                    $("#menu-hr-trigger-effect").hide();

                    // Show deck / grave / banish options for hand
                    $("#menu-to-grave").show();
                    $("#menu-to-banish").show();
                    $("#menu-to-deck-top").show();
                    $("#menu-to-deck-bottom").show();
                    $("#menu-to-extra").hide();
                    $("#menu-pendulum").hide();
                } else {
                    // Field Card layout options
                    $("#menu-summon").hide();
                    $("#menu-set").hide();
                    $("#menu-activate").hide();

                    // Show "Equipar" and "Acoplar" on field cards!
                    $("#menu-equip-option").show();
                    $("#menu-attach-option").show();

                    // Show "Ver acopladas" if parent card has attached cards
                    const hasAttached = state.cards.some(c => c.attachedTo === cardObj.instanceId);
                    if (hasAttached) {
                        $("#menu-view-attached").show();
                        $("#menu-detach").show();
                    } else {
                        $("#menu-view-attached").hide();
                        $("#menu-detach").hide();
                    }
                    $("#menu-hr-attached-actions").show();

                    // Field options
                    $("#menu-attack").show();
                    $("#menu-direct-attack").show();
                    $("#menu-hr-attack").show();
                    $("#menu-flip").show();
                    $("#menu-tap").show();
                    $("#menu-trigger-effect").show();
                    $("#menu-hr-trigger-effect").show();

                    const isPokeFieldCard = cardObj.zone && (cardObj.zone.startsWith("active_") || cardObj.zone.startsWith("bench_"));
                    if (state.layout === "pokemon" && isPokeFieldCard && !cardObj.isToken) {
                        $("#menu-swap-active-bench").show();
                    } else {
                        $("#menu-swap-active-bench").hide();
                    }

                    $("#menu-add-counter").show();
                    $("#menu-sub-counter").show();

                    if (cardObj.isToken) {
                        $("#menu-destroy-token").show();
                        $("#menu-to-hand").hide();
                        $("#menu-to-grave").hide();
                        $("#menu-to-banish").hide();
                        $("#menu-to-deck-top").hide();
                        $("#menu-to-deck-bottom").hide();
                        $("#menu-control").hide();
                        $("#menu-detach").hide();
                        $("#menu-to-extra").hide();
                        $("#menu-pendulum").hide();
                    } else {
                        $("#menu-destroy-token").hide();
                        $("#menu-to-hand").show();
                        $("#menu-to-grave").show();
                        $("#menu-to-banish").show();
                        $("#menu-to-deck-top").show();
                        $("#menu-to-deck-bottom").show();
                        $("#menu-control").show();
                        $("#menu-to-extra").show();
                        $("#menu-pendulum").show();
                    }
                }

                if (isYGOLayout(state.layout)) {
                    $("#menu-to-banish").html('<i class="fas fa-ban"></i> Enviar a Desterrado');
                } else {
                    $("#menu-to-banish").html('<i class="fas fa-ban"></i> Enviar a Removido');
                }
            };

            // Helper to clamp coordinate bounds of menus so they never bleed off-screen
            window.clampMenuCoords = function(x, y, menuSelector) {
                const menuWidth = 140; // Styled fixed width (both context menus are 140px on mobile landscape)
                const menuHeight = Math.min($(window).height() * 0.6, 250); // Capped scroll height estimate

                const winWidth = $(window).width();
                const winHeight = $(window).height();

                let clampedX = x;
                // If it is the deck menu, unfold to the left of the click coordinate
                if (menuSelector === "#deck-menu") {
                    clampedX = x - menuWidth;
                }
                let clampedY = y;

                if (clampedX + menuWidth > winWidth) {
                    clampedX = winWidth - menuWidth - 10;
                }
                if (clampedX < 10) clampedX = 10;

                if (y + menuHeight > winHeight) {
                    clampedY = winHeight - menuHeight - 10;
                }
                if (clampedY < 10) clampedY = 10;

                return { x: clampedX, y: clampedY };
            };

            // Helper to get client coordinates for menu positioning
            function getClientCoords(e) {
                const oe = e.originalEvent || e;
                if (oe.touches && oe.touches.length > 0) {
                    return { clientX: oe.touches[0].clientX, clientY: oe.touches[0].clientY };
                }
                if (oe.changedTouches && oe.changedTouches.length > 0) {
                    return { clientX: oe.changedTouches[0].clientX, clientY: oe.changedTouches[0].clientY };
                }
                return { clientX: e.clientX || oe.clientX || 0, clientY: e.clientY || oe.clientY || 0 };
            }

            // Helper to handle card tap/click
            function handleCardTap(cardObj, e) {
                if (cardObj.attachedTo) {
                    // It's an attached card underneath! Open the attached list modal for its parent card
                    openAttachedCardsModal(cardObj.attachedTo);
                    return;
                }

                if (cardObj.zone.startsWith("deck_")) {
                    activeMenuDeckPlayer = cardObj.zone === "deck_1" ? "player1" : "player2";
                    $("#card-menu").removeClass("active");
                    const clientCoords = getClientCoords(e);
                    const clamped = window.clampMenuCoords(clientCoords.clientX, clientCoords.clientY, "#deck-menu");
                    $("#deck-menu").css({
                        left: `${clamped.x}px`,
                        top: `${clamped.y}px`
                    }).addClass("active");
                } else if (cardObj.zone.startsWith("extra_") && !cardObj.zone.startsWith("extra_monster")) {
                    const playerKey = cardObj.zone === "extra_1" ? "player1" : "player2";
                    openExtraDeckModal(playerKey);
                } else if (cardObj.zone.startsWith("grave_")) {
                    const playerKey = cardObj.zone === "grave_1" ? "player1" : "player2";
                    openPileModal(playerKey, "grave");
                } else if (cardObj.zone.startsWith("banished_")) {
                    const playerKey = cardObj.zone === "banished_1" ? "player1" : "player2";
                    openPileModal(playerKey, "banished");
                } else {
                    // Hand card or on-field card: open Card Menu `#card-menu`!
                    activeMenuCard = cardObj;
                    $("#deck-menu").removeClass("active");

                    // Dynamically update menu options show/hide state
                    if (window.updateCardMenuOptions) {
                        window.updateCardMenuOptions(cardObj);
                    }

                    const clientCoords = getClientCoords(e);
                    const clamped = window.clampMenuCoords(clientCoords.clientX, clientCoords.clientY, "#card-menu");
                    $("#card-menu").css({
                        left: `${clamped.x}px`,
                        top: `${clamped.y}px`
                    }).addClass("active");
                }
            }

            // Wrap renderAllCards to override card events
            const baseRenderAllCardsWithClamping = window.renderAllCards;
            window.renderAllCards = function() {
                baseRenderAllCardsWithClamping.apply(this, arguments);

                const cards = $(".duel-card");
                // Unbind default handlers from duelmobile.js
                cards.off("mousedown touchstart click contextmenu");

                // Re-bind hover preview
                cards.on('mouseenter', function() {
                    const instId = $(this).data("instance-id");
                    const cardObj = state.cards.find(c => c.instanceId === instId);
                    if (cardObj) {
                        updatePreview(cardObj);
                    }
                });

                // Touch start / Mousedown
                cards.on('mousedown touchstart', function(e) {
                    if ($(e.target).closest('.hand-card-actions, .field-card-actions, .field-action-btn, .hand-action-btn, .card-counter-container').length) {
                        return;
                    }

                    const instId = $(this).data("instance-id");
                    const cardObj = state.cards.find(c => c.instanceId === instId);
                    if (!cardObj) return;

                    if (typeof window.activeAttackSourceCard !== "undefined" && window.activeAttackSourceCard) {
                        return;
                    }

                    if (cardObj.zone.startsWith("deck_")) {
                        // Prevent dragging deck entirely
                        return;
                    }

                    e.preventDefault();
                    e.stopPropagation();

                    updatePreview(cardObj);

                    dragCard = $(this);
                    dragCard.addClass("dragging").removeClass("snapping");

                    const maxZ = state.cards.length > 0 ? Math.max(...state.cards.map(c => c.z)) : 10;
                    cardObj.z = maxZ + 1;
                    dragCard.css("z-index", cardObj.z);

                    const pos = getEventCoords(e);
                    const matOffset = $("#playmat").offset();
                    const rect = $("#playmat")[0].getBoundingClientRect();
                    const scale = rect.width / $("#playmat")[0].offsetWidth || 1;

                    if (cardObj.zone.startsWith("hand_")) {
                        // Move element to playmat container to escape flex relative layout
                        $("#field-cards-container").append(dragCard);
                        const initialX = (pos.x - matOffset.left) / scale - 40;
                        const initialY = (pos.y - matOffset.top) / scale - 58;
                        dragCard.css({
                            position: "absolute",
                            width: "80px",
                            height: "116px",
                            left: `${initialX}px`,
                            top: `${initialY}px`,
                            margin: "0"
                        });
                        cardObj.x = initialX;
                        cardObj.y = initialY;
                        dragOffset.x = 40;
                        dragOffset.y = 58;
                    } else {
                        const elemLeft = parseFloat($(this).css("left")) || 0;
                        const elemTop = parseFloat($(this).css("top")) || 0;
                        dragOffset.x = (pos.x - matOffset.left) / scale - elemLeft;
                        dragOffset.y = (pos.y - matOffset.top) / scale - elemTop;
                    }
                    dragStartCoords = { x: pos.x, y: pos.y };
                    dragStartTime = Date.now();
                    window.wasDragging = false;
                });

                // Re-bind attached cards cascade click/contextmenu for fast taps
                $(".attached-card-cascade").off("click contextmenu mousedown").on("click contextmenu mousedown", function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const parentId = $(this).data("parent-id");
                    openAttachedCardsModal(parentId);
                });
            };

            // Unbind default window mouse/touch move and end listeners from duelmobile.js
            $(window).off('.mobileDrag');

            // Re-bind window mousemove/touchmove with flawless scale handling using namespaced events
            $(window).on('mousemove.mobileDrag touchmove.mobileDrag', function(e) {
                if (!dragCard) return;
                e.preventDefault();

                const instId = dragCard.data("instance-id");
                const cardObj = state.cards.find(c => c.instanceId === instId);
                if (!cardObj) return;

                const pos = getEventCoords(e);
                const matOffset = $("#playmat").offset();
                const rect = $("#playmat")[0].getBoundingClientRect();
                const scale = rect.width / $("#playmat")[0].offsetWidth || 1;

                const x = (pos.x - matOffset.left) / scale - dragOffset.x;
                const y = (pos.y - matOffset.top) / scale - dragOffset.y;

                const boundedX = Math.max(-10, Math.min(1120 - 70, x));
                const boundedY = Math.max(-10, Math.min(600 - 100, y));

                cardObj.x = boundedX;
                cardObj.y = boundedY;

                dragCard.css({
                    left: `${boundedX}px`,
                    top: `${boundedY}px`
                });

                const centerCoords = {
                    x: boundedX + 40,
                    y: boundedY + 58
                };

                $(".board-zone").removeClass("highlighted");
                const overlappingZone = findOverlappingZone(centerCoords);
                if (overlappingZone) {
                    $(`#zone-${overlappingZone.id}`).addClass("highlighted");
                }

                // Toggle wasDragging to true if moved beyond 10px threshold
                const dx = pos.x - dragStartCoords.x;
                const dy = pos.y - dragStartCoords.y;
                if (Math.sqrt(dx * dx + dy * dy) > 10) {
                    window.wasDragging = true;
                }
            });

            // Re-bind window mouseup/touchend to split dragging vs tapping using namespaced events
            $(window).on('mouseup.mobileDrag touchend.mobileDrag', function(e) {
                if (!dragCard) return;

                const instId = dragCard.data("instance-id");
                const cardObj = state.cards.find(c => c.instanceId === instId);
                if (!cardObj) return;

                const endPos = getEventCoords(e);
                const dx = endPos.x - dragStartCoords.x;
                const dy = endPos.y - dragStartCoords.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const duration = Date.now() - dragStartTime;

                // Grounded click check: displacement < 15px and duration < 500ms, or absolute displacement < 10px
                let isClick = (dist < 15 && duration < 500) || (dist < 10);

                dragCard.removeClass("dragging").addClass("snapping");
                $(".board-zone").removeClass("highlighted");

                if (isClick) {
                    // Cancel dragging visual
                    const targetZone = cardObj.zone;
                    const zoneObj = BOARD_LAYOUTS[state.layout].find(z => z.id === targetZone);
                    if (zoneObj) {
                        dragCard.css({
                            left: `${zoneObj.x}px`,
                            top: `${zoneObj.y}px`
                        });
                    } else {
                        dragCard.css({
                            left: `${cardObj.x}px`,
                            top: `${cardObj.y}px`
                        });
                    }

                    if ($("#playmat").hasClass("selecting-zone") || $("#playmat").hasClass("targeting-attack")) {
                        const targetEl = dragCard[0];
                        dragCard = null;
                        if (targetEl) {
                            const clickEvent = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            });
                            targetEl.dispatchEvent(clickEvent);
                        }
                        return;
                    }

                    const isHandCard = cardObj.zone.startsWith("hand_");
                    if (isHandCard) {
                        const playerKey = cardObj.zone === "hand_1" ? "player1" : "player2";
                        const $toggle = $(`.hand-multi-select-toggle[data-player="${playerKey}"]`);
                        if ($toggle.is(":checked")) {
                            e.preventDefault();
                            e.stopPropagation();
                            const idx = selectedHandCards[playerKey].indexOf(cardObj.instanceId);
                            if (idx > -1) {
                                selectedHandCards[playerKey].splice(idx, 1);
                                $(`#${cardObj.instanceId}`).removeClass("selected-for-batch");
                            } else {
                                selectedHandCards[playerKey].push(cardObj.instanceId);
                                $(`#${cardObj.instanceId}`).addClass("selected-for-batch");
                            }
                            renderAllCards();
                            dragCard = null;
                            return;
                        }
                    }

                    // Put it back in hand tray BEFORE tap/click handles so it doesn't move/jump!
                    if (isHandCard) {
                        renderAllCards();
                    }

                    // Call Tap Handler!
                    handleCardTap(cardObj, e);

                } else {
                    // Standard drop logic
                    const centerCoords = {
                        x: cardObj.x + 40,
                        y: cardObj.y + 58
                    };

                    const hoverZone = findOverlappingZone(centerCoords);
                    const isOverP1Hand = checkHandTrayHover(e, "#hand-tray-p1");
                    const isOverP2Hand = checkHandTrayHover(e, "#hand-tray-p2");

                    if (cardObj.isToken) {
                        if (isOverP1Hand || isOverP2Hand || (hoverZone && (hoverZone.id.startsWith("deck_") || (hoverZone.id.startsWith("extra_") && !hoverZone.id.startsWith("extra_monster")) || hoverZone.id.startsWith("grave_") || hoverZone.id.startsWith("banished_")))) {
                            state.cards = state.cards.filter(c => c.instanceId !== cardObj.instanceId);
                            if (typeof sendGameAction === "function") {
                                sendGameAction(`Desapareció Token: ${cardObj.name} al salir del campo`);
                            }
                            dragCard = null;
                            renderAllCards();
                            return;
                        }
                    }

                    const oldZone = cardObj.zone;

                    if (hoverZone) {
                        if (hoverZone.id.startsWith("grave_") || hoverZone.id.startsWith("banished_")) {
                            const zonePrefix = hoverZone.id.split("_")[0];
                            const originalSuffix = cardObj.owner === "player1" ? 1 : 2;
                            const targetPileId = `${zonePrefix}_${originalSuffix}`;
                            sendAttachedCardsToPile(cardObj.instanceId, targetPileId);
                            cardObj.movedToPileAt = Date.now() + Math.random();
                            cardObj.zone = targetPileId;
                            cardObj.controller = cardObj.owner;
                            cardObj.faceDown = false;
                            cardObj.tapped = false;
                        } else if (hoverZone.id.startsWith("deck_")) {
                            const originalSuffix = cardObj.owner === "player1" ? 1 : 2;
                            cardObj.zone = `deck_${originalSuffix}`;
                            cardObj.controller = cardObj.owner;
                        } else {
                            cardObj.zone = hoverZone.id;
                            if (cardObj.faceDown) {
                                const isMonster = hoverZone.type === "monster" || hoverZone.id.startsWith("monster_") || hoverZone.id.startsWith("extra_monster_");
                                cardObj.tapped = isMonster ? true : false;
                            }
                        }
                        cardObj.attachedTo = null;

                        if (hoverZone.id.startsWith("deck_")) {
                            const isFromGrave = oldZone.startsWith("grave_");
                            const isFromBanish = oldZone.startsWith("banished_");
                            const isFromHand = oldZone.startsWith("hand_");
                            if (isFromGrave || isFromBanish || isFromHand) {
                                const sourceLabel = isFromGrave ? "el Cementerio" : (isFromBanish ? "el Desterrado" : "la Mano");
                                Swal.fire({
                                    title: '¡Carta enviada al Deck!',
                                    html: `
                                        <p style="margin-bottom: 15px; font-weight: 600;">Se ha enviado esta carta desde ${sourceLabel} al Deck:</p>
                                        <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                                            <img src="${cardObj.imageUrl}" style="width: 150px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.5);" />
                                            <h3 style="color: #00d2ff; font-family: 'Orbitron', sans-serif; font-size: 1.1rem; margin-top: 5px;">${cardObj.name}</h3>
                                        </div>
                                    `,
                                    confirmButtonText: 'Entendido',
                                    confirmButtonColor: '#00d2ff'
                                });
                            }
                        }
                    } else if (isOverP1Hand || isOverP2Hand) {
                        const originalSuffix = cardObj.owner === "player1" ? 1 : 2;
                        cardObj.zone = `hand_${originalSuffix}`;
                        cardObj.controller = cardObj.owner;
                    } else {
                        cardObj.zone = "field_free";
                        cardObj.attachedTo = null;
                    }
                }

                dragCard = null;
                renderAllCards();
            });

            // Re-bind the delegated contextmenu & clicks on board pile/deck zones
            $(document).off("click contextmenu", ".board-zone.zone-type-deck");
            $(document).off("click contextmenu", ".board-zone.zone-type-extra");
            $(document).off("click contextmenu", ".board-zone.zone-type-grave");
            $(document).off("click contextmenu", ".board-zone.zone-type-banished");

            $(document).on("click contextmenu", ".board-zone.zone-type-deck", function(e) {
                if ($("#playmat").hasClass("selecting-zone")) return;
                e.preventDefault();
                e.stopPropagation();

                const zoneId = $(this).data("id");
                activeMenuDeckPlayer = zoneId === "zone-deck_1" || zoneId === "deck_1" ? "player1" : "player2";

                $("#card-menu").removeClass("active");
                const clientCoords = getClientCoords(e);
                const clamped = window.clampMenuCoords(clientCoords.clientX, clientCoords.clientY, "#deck-menu");
                $("#deck-menu").css({
                    left: `${clamped.x}px`,
                    top: `${clamped.y}px`
                }).addClass("active");
            });

            $(document).on("click contextmenu", ".board-zone.zone-type-extra", function(e) {
                if ($("#playmat").hasClass("selecting-zone")) return;
                e.preventDefault();
                e.stopPropagation();
                const zoneId = $(this).data("id");
                const playerKey = zoneId === "zone-extra_1" || zoneId === "extra_1" ? "player1" : "player2";
                openExtraDeckModal(playerKey);
            });

            $(document).on("click contextmenu", ".board-zone.zone-type-grave", function(e) {
                if ($("#playmat").hasClass("selecting-zone")) return;
                e.preventDefault();
                e.stopPropagation();
                const zoneId = $(this).data("id");
                const playerKey = zoneId === "zone-grave_1" || zoneId === "grave_1" ? "player1" : "player2";
                openPileModal(playerKey, "grave");
            });

            $(document).on("click contextmenu", ".board-zone.zone-type-banished", function(e) {
                if ($("#playmat").hasClass("selecting-zone")) return;
                e.preventDefault();
                e.stopPropagation();
                const zoneId = $(this).data("id");
                const playerKey = zoneId === "zone-banished_1" || zoneId === "banished_1" ? "player1" : "player2";
                openPileModal(playerKey, "banished");
            });

            // Mobile delegated click/tap handler to toggle menu overlay on list-view cards (No SweetAlert2!)
            $(document).off("click.mobile_menu_overlay").on("click.mobile_menu_overlay", ".pile-card-container, .extra-deck-card-container, .search-card-item", function(e) {
                // If multi-select is active on graveyard/banished list modal, bypass popup/overlay menu
                if ($("#pile-multi-select-toggle").is(":checked")) {
                    return;
                }

                // If clicking an action button, let the click go through to its individual handler
                if ($(e.target).closest(".pile-card-action-btn, .extra-card-action-btn, .swal-modal-btn").length) {
                    return;
                }

                e.preventDefault();
                e.stopPropagation();

                // If the clicked card is already active, close it
                if ($(this).hasClass("active-menu")) {
                    $(this).removeClass("active-menu");
                    return;
                }

                // Remove .active-menu from all other sibling containers in the modal grid
                $(".pile-card-container, .extra-deck-card-container, .search-card-item").not(this).removeClass("active-menu");

                // Toggle active menu class on the clicked container
                $(this).addClass("active-menu");
            });

            // Clicking anywhere outside of modal list-view cards closes any open menu overlay
            $(document).on("click", function(e) {
                if (!$(e.target).closest(".pile-card-container, .extra-deck-card-container, .search-card-item").length) {
                    $(".pile-card-container, .extra-deck-card-container, .search-card-item").removeClass("active-menu");
                }
            });

            // Prevent default drag events on window to avoid browser image ghosting
            $(window).on("dragover dragenter drop", function(e) {
                e.preventDefault();
            });

            // Initial layout render trigger to apply custom events
            renderAllCards();
        });

        // Resolution-aware scaling function to fit the playmat board on mobile screens
        window.adjustPlaymatScale = function() {
            const $playmat = $("#playmat");
            if (!$playmat.length) return;
            const matWidth = 1120;
            const matHeight = 600;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // =========================================================================
            // AJUSTES PERSONALIZABLES DEL TABLERO Y LAS MANOS (MODIFICABLES)
            // =========================================================================
            const scaleFactor = 1.05;       // Tamaño del tablero (1.05 = 5% más grande, 1.00 = tamaño original)
            const perspectiveAngle = 15;    // Ángulo de inclinación en grados (15 es más suave que 30)
            const boardOffsetY = -30;       // Desplazamiento vertical en Y del tablero (negativo sube el tablero, positivo lo baja)
            const p2HandTopOffset = -10;    // Desplazamiento de cartas de mano del oponente (P2) (negativo las sube/aleja) -15
            const p1HandBottomOffset = -10; // Desplazamiento de cartas de mano del usuario (P1) (negativo las baja/aleja para quedar igual que P2)
            // =========================================================================

            // Reserve exactly 150px of vertical height split between both hands
            // to make sure they are 100% visible with zero screen scroll and ample margins
            const targetWidth = viewportWidth * 0.98;
            const targetHeight = Math.max(180, viewportHeight - 150);

            const scaleX = targetWidth / matWidth;
            const scaleY = targetHeight / matHeight;
            // Uniformly scale the playmat to fit perfectly
            const scale = Math.min(scaleX, scaleY) * scaleFactor;

            // Actualizar variables CSS dinámicamente para que las cartas hereden la misma perspectiva
            document.documentElement.style.setProperty('--board-tilt', `${perspectiveAngle}deg`);
            document.documentElement.style.setProperty('--board-perspective', '2000px');

            const rotatedAngle = window.isBoardRotated ? 180 : 0;

            $playmat.css({
                "transform": `translate(-50%, calc(-50% + ${boardOffsetY}px)) scale(${scale}) rotateX(${perspectiveAngle}deg) rotate(${rotatedAngle}deg)`,
                "transform-origin": "center center",
                "position": "absolute",
                "left": "50%",
                "top": "50%",
                "margin": "0"
            });

            // Calculate precise visual vertical height of the tilted playmat
            const cosAngle = Math.cos(perspectiveAngle * Math.PI / 180); // cos(15deg)
            const visualHalfHeight = (matHeight / 2) * scale * cosAngle;

            // Pin hand trays exactly to the top and bottom visual borders of the playmat,
            // creating a premium, non-clashing, and perfectly stuck layout (Master Duel style)
            const t2Top = Math.max(2, (viewportHeight / 2) + boardOffsetY - visualHalfHeight + p2HandTopOffset);
            const t1Bottom = Math.max(2, (viewportHeight / 2) - boardOffsetY - visualHalfHeight + p1HandBottomOffset);

            if (window.isBoardRotated) {
                $("#hand-tray-p2").css({
                    "bottom": `${t1Bottom}px`,
                    "top": "auto"
                });

                $("#hand-tray-p1").css({
                    "top": `${t2Top}px`,
                    "bottom": "auto"
                });
            } else {
                $("#hand-tray-p2").css({
                    "top": `${t2Top}px`,
                    "bottom": "auto"
                });

                $("#hand-tray-p1").css({
                    "bottom": `${t1Bottom}px`,
                    "top": "auto"
                });
            }
        };

        $(window).on("resize orientationchange", window.adjustPlaymatScale);
        $(document).ready(function() {
            setTimeout(window.adjustPlaymatScale, 100);
        });


// Extracted Block 2

        $(document).ready(function() {
            // Global variable to track whether a touch/drag happened instead of a single tap
            window.wasDragging = false;

            // Global variables to track the active attack targeting state robustly
            window.activeAttackSourceCard = null;

            // Helper to start targeting mode for selecting attack target
            window.startAttackTargetingMode = function(attackerCard) {
                window.activeAttackSourceCard = attackerCard;

                // Show clean and beautiful instruction toast using Swal (SweetAlert2) exactly like magic.html!
                Swal.fire({
                    toast: true,
                    position: 'bottom',
                    showConfirmButton: false,
                    timer: 3000,
                    timerProgressBar: true,
                    icon: 'info',
                    title: `Elige el objetivo del ataque para ${attackerCard.name}`,
                    background: '#12181e',
                    color: '#fff'
                });

                $("#playmat").addClass("targeting-attack");

                // Cancel targeting on escape key
                $(document).off("keydown.attacktarget").on("keydown.attacktarget", function(e) {
                    if (e.key === "Escape") {
                        window.stopAttackTargetingMode();
                    }
                });
            };

            window.stopAttackTargetingMode = function() {
                window.activeAttackSourceCard = null;
                $("#playmat").removeClass("targeting-attack");
                $(document).off("keydown.attacktarget");
            };

            // Delegated global click handler for target cards - Immune to any DOM refreshes or dynamic card rendering!
            $(document).on("click", ".duel-card", function(e) {
                if (window.activeAttackSourceCard) {
                    e.preventDefault();
                    e.stopPropagation();

                    const targetId = $(this).data("instance-id") || $(this).attr("id");

                    // Prevent attacking itself
                    if (targetId === window.activeAttackSourceCard.instanceId) {
                        return;
                    }

                    const targetCard = state.cards.find(c => c.instanceId === targetId);
                    if (targetCard) {
                        // Add attack entry
                        const newAtk = {
                            attackerId: window.activeAttackSourceCard.instanceId,
                            targetId: targetCard.instanceId,
                            isDirect: false,
                            timestamp: Date.now()
                        };
                        state.attacks.push(newAtk);

                        // Broadcast attack sync
                        if (typeof window.commChannel !== "undefined" && window.commChannel) {
                            window.commChannel.send({
                                type: 'broadcast',
                                event: 'attack_sync',
                                payload: { attacks: state.attacks }
                            });
                        }

                        // Log action
                        if (typeof sendGameAction === "function") {
                            sendGameAction(`Declaró ataque con ${window.activeAttackSourceCard.name} hacia ${targetCard.name}`);
                        }

                        if (typeof window.drawAttackArrows === "function") {
                            window.drawAttackArrows();
                        }
                    }

                    window.stopAttackTargetingMode();
                }
            });

            // Direct attack helper
            window.performDirectAttack = function(attackerCard) {
                const newAtk = {
                    attackerId: attackerCard.instanceId,
                    targetId: null,
                    isDirect: true,
                    timestamp: Date.now()
                };
                state.attacks.push(newAtk);

                // Broadcast attack sync
                if (typeof window.commChannel !== "undefined" && window.commChannel) {
                    window.commChannel.send({
                        type: 'broadcast',
                        event: 'attack_sync',
                        payload: { attacks: state.attacks }
                    });
                }

                // Log action
                if (typeof sendGameAction === "function") {
                    sendGameAction(`Declaró Ataque Directo con ${attackerCard.name}`);
                }

                if (typeof window.drawAttackArrows === "function") {
                    window.drawAttackArrows();
                }
            };

            // Bind the field quick-menu click events for Attack using delegated document listeners
            $(document).on("click", ".btn-field-attack", function(e) {
                e.preventDefault();
                e.stopPropagation();
                const instId = $(this).data("instance-id");
                const cardObj = state.cards.find(c => c.instanceId === instId);
                if (cardObj) {
                    window.startAttackTargetingMode(cardObj);
                }
            });

            // Bind direct attack quick action
            $(document).on("click", ".btn-field-direct", function(e) {
                e.preventDefault();
                e.stopPropagation();
                const instId = $(this).data("instance-id");
                const cardObj = state.cards.find(c => c.instanceId === instId);
                if (cardObj) {
                    window.performDirectAttack(cardObj);
                }
            });

            // Bind context menu click handlers with propagation stopped
            $("#menu-attack").click(function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (activeMenuCard) {
                    window.startAttackTargetingMode(activeMenuCard);
                }
                $("#card-menu").removeClass("active");
            });

            $("#menu-direct-attack").click(function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (activeMenuCard) {
                    window.performDirectAttack(activeMenuCard);
                }
                $("#card-menu").removeClass("active");
            });

            // Clicking outside of cards, menus, or trigger buttons cancels targeting or clears active attacks (from anywhere on the web page!)
            $(document).on("click", function(e) {
                // If we are currently selecting an attack target, let's cancel if we click outside the target card
                if (window.activeAttackSourceCard) {
                    if (!$(e.target).closest(".duel-card, .field-card-actions, .pile-menu-trigger, .btn-field-attack, .btn-field-direct, #menu-attack, #menu-direct-attack, #card-menu").length) {
                        window.stopAttackTargetingMode();
                    }
                    return;
                }

                // Do not clear if we clicked an attack trigger button/menu or a card
                if ($(e.target).closest(".duel-card, .field-card-actions, .pile-menu-trigger, .btn-field-attack, .btn-field-direct, #menu-attack, #menu-direct-attack, #card-menu").length) {
                    return;
                }

                // Clear active attacks
                if (state.attacks.length > 0) {
                    state.attacks = [];
                    try {
                        if (typeof window.commChannel !== "undefined" && window.commChannel && typeof window.commChannel.send === "function") {
                            window.commChannel.send({
                                type: 'broadcast',
                                event: 'attack_sync',
                                payload: { attacks: [] }
                            });
                        }
                    } catch (err) {}
                    if (typeof window.drawAttackArrows === "function") {
                        window.drawAttackArrows();
                    }
                }
            });

            // Initialize board rotated state
            window.isBoardRotated = false;

            // Show rotation button only in Practice Mode
            if (state.mode === 'practice') {
                $("#btn-rotate-board").show().css("display", "flex");
            }

            // Click listener for rotation button
            $("#btn-rotate-board").off("click").on("click", function(e) {
                e.preventDefault();
                e.stopPropagation();
                window.isBoardRotated = !window.isBoardRotated;
                if (window.isBoardRotated) {
                    $("body").addClass("rotated-board");
                } else {
                    $("body").removeClass("rotated-board");
                }
                if (typeof window.adjustPlaymatScale === "function") {
                    window.adjustPlaymatScale();
                }
            });

            // Toggle mobile accessories sidebar
            $("#btn-toggle-mobile-sidebar").off("click").on("click", function(e) {
                e.preventDefault();
                e.stopPropagation();
                $(".duel-sidebar").toggleClass("mobile-sidebar-active");
            });

            // Close mobile accessories sidebar when clicking outside
            $(document).on("click mousedown touchstart", function(e) {
                const sidebar = $(".duel-sidebar");
                if (sidebar.hasClass("mobile-sidebar-active")) {
                    if (!$(e.target).closest(".duel-sidebar, #btn-toggle-mobile-sidebar, #btn-rotate-board, .swal2-container, .swal2-popup").length) {
                        sidebar.removeClass("mobile-sidebar-active");
                    }
                }
            });
        });



// Native touchmove listener to prevent default browser scrolling when dragging a card
window.addEventListener('touchmove', function(e) {
    if (dragCard) {
        e.preventDefault();
    }
}, { passive: false });
