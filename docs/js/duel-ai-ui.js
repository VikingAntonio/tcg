/*
 * VikingDev TCG — Modo "Contra la Máquina": controlador de la interfaz.
 *
 * Página propia (duelAI.html / duelAIMobile.html). No comparte estado ni
 * markup con duel.html / duelmobile.html, así que los modos 1 Jugador y
 * 2 Jugadores quedan intactos.
 */
(function () {
    'use strict';

    const E = window.DuelAIEngine;
    const Cards = window.DuelAICards;
    const params = new URLSearchParams(window.location.search);

    const ui = {
        game: null,
        humanKey: 'p1',
        aiKey: 'p2',
        brain: null,
        busy: false,
        aiTimer: null,
        pendingChain: null,
        selectedAction: null
    };

    const dom = {};
    function $(id) { return document.getElementById(id); }
    function el(tag, cls, text) {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }
    function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

    // ---------------------------------------------------------------
    // Arranque
    // ---------------------------------------------------------------
    async function boot() {
        dom.app = $('dai-app');
        dom.setup = $('dai-setup');
        dom.board = $('dai-board');
        dom.log = $('dai-log');
        dom.actions = $('dai-actions');
        dom.chainOverlay = $('dai-chain-overlay');
        dom.chainList = $('dai-chain-list');
        dom.winner = $('dai-winner');
        dom.turnChip = $('dai-turn-chip');
        dom.phaseChip = $('dai-phase-chip');
        dom.turnBtn = $('dai-turn-badge');

        const layout = params.get('layout') || 'yugioh';
        dom.app.classList.toggle('is-pokemon', layout === 'pokemon');

        const difficulty = params.get('difficulty') || 'normal';
        const deck1 = params.get('deck1') || '';
        const deck2 = params.get('deck2') || '';
        const side = params.get('side') || 'p1';

        if (deck1 && deck2) {
            await startMatch({ layout: layout, difficulty: difficulty, deck1: deck1, deck2: deck2, side: side });
            return;
        }
        renderSetup(layout, difficulty);
    }

    // ---------------------------------------------------------------
    // Pantalla de configuración (cuando se abre la página directamente)
    // ---------------------------------------------------------------
    function renderSetup(layout, difficulty) {
        dom.setup.style.display = 'flex';
        dom.board.style.display = 'none';
        dom.actions.style.display = 'none';
        clear(dom.setup);

        const h2 = el('h2', null, 'Duelo contra la Máquina');
        const info = el('p', null, 'Elige el tablero, tu deck y el deck que usará la máquina. La máquina conoce las cartas y juega sola.');
        dom.setup.appendChild(h2);
        dom.setup.appendChild(info);

        const gLayout = fieldGroup('Tipo de tablero');
        const selLayout = el('select', 'dai-select');
        [['yugioh', 'Yu-Gi-Oh! Clásico'], ['yugioh_advanced', 'Yu-Gi-Oh! Avanzado'], ['pokemon', 'Pokémon TCG']]
            .forEach(function (pair) {
                const opt = el('option', null, pair[1]);
                opt.value = pair[0];
                if (pair[0] === layout) opt.selected = true;
                selLayout.appendChild(opt);
            });
        gLayout.appendChild(selLayout);
        dom.setup.appendChild(gLayout);

        const gDiff = fieldGroup('Dificultad de la máquina');
        const selDiff = el('select', 'dai-select');
        [['easy', 'Fácil'], ['normal', 'Normal'], ['hard', 'Difícil']].forEach(function (pair) {
            const opt = el('option', null, pair[1]);
            opt.value = pair[0];
            if (pair[0] === difficulty) opt.selected = true;
            selDiff.appendChild(opt);
        });
        gDiff.appendChild(selDiff);
        dom.setup.appendChild(gDiff);

        const gMine = fieldGroup('Tu deck');
        const selMine = el('select', 'dai-select');
        gMine.appendChild(selMine);
        dom.setup.appendChild(gMine);

        const gAi = fieldGroup('Deck de la máquina');
        const selAi = el('select', 'dai-select');
        gAi.appendChild(selAi);
        dom.setup.appendChild(gAi);

        const status = el('p', null, 'Cargando tus decks...');
        dom.setup.appendChild(status);

        const startBtn = el('button', 'dai-btn primary', 'Iniciar duelo');
        startBtn.type = 'button';
        startBtn.disabled = true;
        dom.setup.appendChild(startBtn);

        const hint = el('p', null, 'Consejo: puedes usar cualquiera de tus decks guardados como rival. La máquina consultará las estadísticas reales de cada carta.');
        dom.setup.appendChild(hint);

        // Cambiar layout recarga la lista (presets distintos)
        selLayout.addEventListener('change', function () {
            const p = new URLSearchParams(window.location.search);
            p.set('layout', selLayout.value);
            p.set('difficulty', selDiff.value);
            window.location.search = p.toString();
        });

        fillDeckSelectors(selLayout.value, selMine, selAi, status, startBtn);

        startBtn.addEventListener('click', function () {
            const p = new URLSearchParams();
            p.set('layout', selLayout.value);
            p.set('difficulty', selDiff.value);
            p.set('deck1', selMine.value);
            p.set('deck2', selAi.value);
            p.set('side', 'p1');
            window.location.search = p.toString();
        });
    }

    function fieldGroup(labelText) {
        const group = el('div', 'dai-field-group');
        group.appendChild(el('label', null, labelText));
        return group;
    }

    async function fillDeckSelectors(layout, selMine, selAi, status, startBtn) {
        let myDecks = [];
        try {
            myDecks = await loadUserDecks();
        } catch (e) {
            myDecks = [];
        }

        const presets = Cards.listPresets(layout);
        const addOption = function (select, value, label) {
            const opt = el('option', null, label);
            opt.value = value;
            select.appendChild(opt);
        };

        myDecks.forEach(function (d) {
            addOption(selMine, 'deck:' + d.id, d.name + (d.format_tag ? ' · ' + d.format_tag : ''));
            addOption(selAi, 'deck:' + d.id, d.name + (d.format_tag ? ' · ' + d.format_tag : ''));
        });
        presets.forEach(function (p) {
            addOption(selMine, 'preset:' + p.key, 'Preestablecido · ' + p.label);
            addOption(selAi, 'preset:' + p.key, 'Preestablecido · ' + p.label);
        });

        if (!selMine.options.length) {
            status.textContent = 'No hay decks disponibles. Crea un deck o usa un preestablecido.';
            startBtn.disabled = true;
            return;
        }

        // Por defecto: tú con tu primer deck (o preset) y la máquina con otro preset distinto
        if (myDecks.length) {
            selMine.value = 'deck:' + myDecks[0].id;
            selAi.value = myDecks.length > 1 ? 'deck:' + myDecks[1].id : 'preset:' + presets[0].key;
        } else {
            selMine.value = 'preset:' + presets[0].key;
            selAi.value = 'preset:' + (presets[1] ? presets[1].key : presets[0].key);
        }

        status.textContent = myDecks.length
            ? 'Detectamos ' + myDecks.length + ' deck(s) tuyos. Puedes dárselos a la máquina.'
            : 'No hay decks guardados: usaremos los preestablecidos.';
        startBtn.disabled = false;
    }

    async function loadUserDecks() {
        if (typeof _supabase === 'undefined' || !_supabase) return [];
        let userId = null;
        try {
            const sessionRes = await _supabase.auth.getSession();
            const session = sessionRes && sessionRes.data && sessionRes.data.session;
            if (session && session.user) userId = session.user.id;
        } catch (e) { /* sin sesión */ }
        if (!userId) {
            try {
                const cached = JSON.parse(localStorage.getItem('tcg_session') || 'null');
                if (cached && cached.id) userId = cached.id;
            } catch (e) { /* ignore */ }
        }
        if (!userId) return [];
        const res = await _supabase.from('decks').select('id, name, format_tag').eq('user_id', userId);
        if (res.error) throw res.error;
        return res.data || [];
    }

    async function fetchDeckRows(source) {
        if (source.indexOf('preset:') === 0) {
            const layout = params.get('layout') || 'yugioh';
            const rows = Cards.presetRows(source.slice(7), layout);
            if (rows) return rows;
            throw new Error('Preestablecido no encontrado');
        }
        const deckId = source.indexOf('deck:') === 0 ? source.slice(5) : source;
        const res = await _supabase.from('deck_cards').select('*').eq('deck_id', deckId).order('position', { ascending: true });
        if (res.error) throw res.error;
        if (!res.data || !res.data.length) throw new Error('Ese deck está vacío');
        return res.data;
    }

    // ---------------------------------------------------------------
    // Iniciar partida
    // ---------------------------------------------------------------
    async function startMatch(cfg) {
        dom.setup.style.display = 'flex';
        dom.board.style.display = 'none';
        dom.actions.style.display = 'none';
        clear(dom.setup);
        dom.setup.appendChild(el('h2', null, 'Preparando el duelo...'));
        const loading = el('p', null, 'Consultando las cartas de ambos decks.');
        dom.setup.appendChild(loading);
        const bar = el('p', null, '');
        dom.setup.appendChild(bar);

        let mineRows;
        let aiRows;
        try {
            const results = await Promise.all([fetchDeckRows(cfg.deck1), fetchDeckRows(cfg.deck2)]);
            mineRows = results[0];
            aiRows = results[1];
        } catch (e) {
            loading.textContent = 'No se pudo cargar el deck: ' + (e.message || e);
            const back = el('button', 'dai-btn', 'Volver a la configuración');
            back.type = 'button';
            back.addEventListener('click', function () { window.location.search = '?layout=' + cfg.layout; });
            dom.setup.appendChild(back);
            return;
        }

        const isPokemon = cfg.layout === 'pokemon';
        let mineCards;
        let aiCards;
        try {
            mineCards = await Cards.resolveDeck(mineRows, cfg.layout, function (p, done, total) {
                bar.textContent = 'Cartas conocidas: ' + done + '/' + total;
            });
            aiCards = await Cards.resolveDeck(aiRows, cfg.layout, function (p, done, total) {
                bar.textContent = 'Cartas conocidas: ' + done + '/' + total;
            });
        } catch (e) {
            loading.textContent = 'Error consultando cartas: ' + (e.message || e);
            return;
        }

        const humanIsP1 = cfg.side !== 'p2';
        const game = E.createGame({
            layout: cfg.layout,
            difficulty: cfg.difficulty,
            seed: Date.now(),
            p1: {
                name: humanIsP1 ? 'Tú' : 'Máquina',
                isAI: !humanIsP1,
                cards: humanIsP1 ? mineCards : aiCards
            },
            p2: {
                name: humanIsP1 ? 'Máquina' : 'Tú',
                isAI: humanIsP1,
                cards: humanIsP1 ? aiCards : mineCards
            }
        });
        game.setup();

        ui.game = game;
        ui.humanKey = humanIsP1 ? 'p1' : 'p2';
        ui.aiKey = humanIsP1 ? 'p2' : 'p1';
        ui.brain = new E.AIBrain(game, ui.aiKey);
        ui.busy = false;

        dom.setup.style.display = 'none';
        dom.board.style.display = 'flex';
        dom.actions.style.display = 'flex';
        dom.winner.classList.remove('show');

        render();
        maybeRunAI();
    }

    // ---------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------
    function render() {
        const game = ui.game;
        if (!game) return;
        renderSide(ui.aiKey, true);
        renderHand();
        renderSide(ui.humanKey, false);
        renderStatus();
        renderLog();
        renderActions();
        renderChainPrompt();
        if (game.winner) showWinner();
    }

    function renderStatus() {
        const game = ui.game;
        if (!game) return;
        const label = game.phaseLabel(game.phase);
        dom.phaseChip.textContent = label;
        const myTurn = game.turn === ui.humanKey;
        dom.turnChip.textContent = myTurn ? 'TU TURNO' : 'TURNO DE LA MÁQUINA';
        dom.turnChip.className = 'dai-chip ' + (myTurn ? 'turn-me' : 'turn-ai');
        if (dom.turnBtn) {
            dom.turnBtn.textContent = myTurn ? 'Turno ' + game.turnNumber + ' · tú' : 'Turno ' + game.turnNumber + ' · máquina';
        }
    }

    function renderSide(key, isAI) {
        const game = ui.game;
        const p = game.player(key);
        const host = $(isAI ? 'dai-side-top' : 'dai-side-bottom');
        clear(host);
        host.classList.toggle('is-ai', isAI);
        host.classList.toggle('is-me', !isAI);
        host.classList.toggle('is-active', game.turn === key);

        const head = el('div', 'dai-side-head');
        head.appendChild(el('span', 'dai-name', p.name));
        const life = el('div', 'dai-life');
        if (game.isPokemon) {
            life.appendChild(el('b', null, 'Premios ' + p.prizesTaken + '/6'));
            const remaining = el('span', null, '· rival ' + game.player(game.opponentOf(key)).prizesTaken + '/6');
            life.appendChild(remaining);
        } else {
            if (p.lp <= 2000) life.classList.add('low');
            life.appendChild(el('b', null, p.lp + ' LP'));
        }
        head.appendChild(life);
        host.appendChild(head);

        const rows = el('div', 'dai-rows');

        // Pila izquierda
        const left = el('div', 'dai-piles');
        left.appendChild(pileNode('Deck', p.deck.length, p.deck.length ? p.deck[p.deck.length - 1] : null, isAI));
        left.appendChild(pileNode(game.isPokemon ? 'Descarte' : 'Cement.', game.isPokemon ? p.discard.length : p.grave.length, null, isAI));
        rows.appendChild(left);

        // Campo
        const field = el('div', 'dai-field');
        if (game.isPokemon) {
            const benchRow = el('div', 'dai-slot-row');
            p.bench.forEach(function (slot, i) {
                benchRow.appendChild(slotNode(slot, { kind: 'bench', index: i }, key, isAI));
            });
            field.appendChild(benchRow);
            const activeRow = el('div', 'dai-slot-row dai-active-row');
            activeRow.style.gridTemplateColumns = 'repeat(5, minmax(0,1fr))';
            for (let i = 0; i < 5; i++) {
                if (i === 2) activeRow.appendChild(activeNode(p.active, key, isAI));
                else activeRow.appendChild(el('div', 'dai-slot empty'));
            }
            field.appendChild(activeRow);
        } else {
            const backRow = el('div', 'dai-slot-row');
            p.spells.forEach(function (slot, i) {
                backRow.appendChild(backrowNode(slot, key, isAI));
            });
            field.appendChild(backRow);
            const monRow = el('div', 'dai-slot-row');
            p.monsters.forEach(function (slot, i) {
                monRow.appendChild(monsterNode(slot, i, key, isAI));
            });
            field.appendChild(monRow);
        }
        rows.appendChild(field);

        // Pila derecha
        const right = el('div', 'dai-piles');
        right.appendChild(pileNode(game.isPokemon ? 'Desterrado' : 'Extra', game.isPokemon ? p.banished.length : p.extra.length, null, isAI));
        if (game.isPokemon) {
            right.appendChild(pileNode('Mano', p.hand.length, null, isAI, true));
        } else {
            right.appendChild(pileNode('Desterrado', p.banished.length, null, isAI));
        }
        rows.appendChild(right);

        host.appendChild(rows);
    }

    function pileNode(label, count, card, hideImage, hideCount) {
        const node = el('div', 'dai-pile');
        if (card && !hideImage) {
            const img = el('img');
            img.src = 'img/bocabajo.jpg';
            img.alt = label;
            node.appendChild(img);
        }
        const badge = el('span', 'dai-pile-badge', hideCount ? String(count) : label + ' ' + count);
        node.appendChild(badge);
        return node;
    }

    function monsterNode(slot, index, ownerKey, isAI) {
        const node = el('div', 'dai-slot');
        if (!slot) { node.classList.add('empty'); return node; }
        const card = slot.card;
        const nodeCard = el('div', 'dai-card');
        const img = el('img');
        img.src = card.img || 'img/bocabajo.jpg';
        img.alt = card.name;
        img.loading = 'lazy';
        nodeCard.appendChild(img);
        if (slot.faceDown) nodeCard.classList.add('face-down');
        if (slot.position === 'def') nodeCard.classList.add('tapped');
        const tag = el('span', 'dai-card-tag' + (slot.position === 'def' ? ' def' : ''), slot.position === 'def' ? 'DEF' : 'ATK');
        nodeCard.appendChild(tag);
        nodeCard.title = card.name + ' · ATK ' + E.cardAtk(card) + ' / DEF ' + E.cardDef(card);
        node.appendChild(nodeCard);
        applySelectable(node, nodeCard, { kind: 'monster', index: index }, ownerKey);
        return node;
    }

    function backrowNode(slot, ownerKey, isAI) {
        const node = el('div', 'dai-slot');
        if (!slot) { node.classList.add('empty'); return node; }
        const nodeCard = el('div', 'dai-card');
        const img = el('img');
        img.src = slot.card.img || 'img/bocabajo.jpg';
        img.alt = slot.card.name;
        nodeCard.appendChild(img);
        if (slot.faceDown) nodeCard.classList.add('face-down');
        nodeCard.title = slot.faceDown ? 'Carta boca abajo' : slot.card.name;
        node.appendChild(nodeCard);
        return node;
    }

    function activeNode(slot, ownerKey, isAI) {
        const node = el('div', 'dai-slot');
        if (!slot) { node.classList.add('empty'); return node; }
        const card = slot.card;
        const nodeCard = el('div', 'dai-card');
        const img = el('img');
        img.src = card.img || 'img/bocabajo.jpg';
        img.alt = card.name;
        nodeCard.appendChild(img);
        const hpLeft = (card.meta.hp || 0) - (slot.damage || 0);
        nodeCard.title = card.name + ' · ' + hpLeft + '/' + (card.meta.hp || 0) + ' PS';
        node.appendChild(nodeCard);
        if (slot.damage > 0) node.appendChild(el('span', 'dai-card-dmg', '-' + slot.damage));
        node.appendChild(el('span', 'dai-card-energy', slot.energies.length + 'E'));
        return node;
    }

    function slotNode(slot, meta, ownerKey) {
        const node = el('div', 'dai-slot');
        if (!slot) { node.classList.add('empty'); return node; }
        const card = slot.card;
        const nodeCard = el('div', 'dai-card');
        const img = el('img');
        img.src = card.img || 'img/bocabajo.jpg';
        img.alt = card.name;
        nodeCard.appendChild(img);
        node.appendChild(nodeCard);
        if (slot.damage > 0) node.appendChild(el('span', 'dai-card-dmg', '-' + slot.damage));
        if (slot.energies.length) node.appendChild(el('span', 'dai-card-energy', slot.energies.length + 'E'));
        return node;
    }

    // Ninguna interacción directa sobre cartas: todas las jugadas salen de
    // la barra de acciones (así la IA y el humano usan exactamente la misma API).
    function applySelectable() { /* reservado */ }

    function renderHand() {
        const game = ui.game;
        const host = $('dai-hand');
        clear(host);
        const p = game.player(ui.humanKey);
        const label = $('dai-hand-label');
        if (label) label.textContent = 'Tu mano · ' + p.hand.length;
        p.hand.forEach(function (card) {
            const box = el('div', 'dai-hand-card');
            const img = el('img');
            img.src = card.img || 'img/bocabajo.jpg';
            img.alt = card.name;
            img.loading = 'lazy';
            box.appendChild(img);
            box.title = card.name + extraInfo(card);
            host.appendChild(box);
        });
        if (!p.hand.length) {
            host.appendChild(el('div', 'dai-hand-label', 'Mano vacía'));
        }
    }

    function extraInfo(card) {
        const meta = card.meta || {};
        if (meta.kind === 'monster') return ' · ATK ' + (meta.atk || 0) + ' / DEF ' + (meta.def || 0) + ' · Nv ' + (meta.level || 0);
        if (meta.kind === 'pokemon') return ' · ' + (meta.hp || 0) + ' PS';
        if (meta.desc) return ' · ' + meta.desc.slice(0, 90);
        return '';
    }

    function renderLog() {
        const game = ui.game;
        clear(dom.log);
        game.log.slice().reverse().forEach(function (entry) {
            const node = el('div', 'dai-log-entry ' + entry.cls);
            node.textContent = entry.text;
            dom.log.appendChild(node);
        });
    }

    // ---------------------------------------------------------------
    // Acciones
    // ---------------------------------------------------------------
    function renderActions() {
        const game = ui.game;
        clear(dom.actions);
        if (!game || game.winner) {
            dom.actions.appendChild(el('div', 'dai-hint', game && game.winner ? 'La partida terminó.' : ''));
            return;
        }
        if (game.turn !== ui.humanKey) {
            const hint = el('div', 'dai-hint');
            hint.innerHTML = 'La <b>máquina</b> está jugando...';
            dom.actions.appendChild(hint);
            return;
        }
        if (ui.pendingChain) {
            dom.actions.appendChild(el('div', 'dai-hint', 'Responde en la ventana de cadena.'));
            return;
        }

        const actions = game.getActions(ui.humanKey);
        const groups = {};
        actions.forEach(function (a) {
            const g = a.group || (a.type === 'endTurn' || a.type === 'nextPhase' ? 'turno' : 'otros');
            (groups[g] = groups[g] || []).push(a);
        });

        const titles = {
            summon: 'Invocar / Colocar',
            spell: 'Magia y Trampa',
            attack: 'Ataques',
            energy: 'Energía',
            pokemon: 'Pokémon',
            trainer: 'Entrenadores',
            retreat: 'Retirada',
            turno: 'Turno',
            otros: 'Otras acciones'
        };

        Object.keys(groups).forEach(function (keyName) {
            const group = el('div', 'dai-action-group');
            group.appendChild(el('div', 'dai-action-group-title', titles[keyName] || keyName));
            const list = el('div', 'dai-action-list');
            groups[keyName].forEach(function (action) {
                const btn = el('button', 'dai-btn' + (action.primary ? ' primary' : ''), action.label);
                btn.type = 'button';
                btn.addEventListener('click', function () { runHumanAction(action); });
                list.appendChild(btn);
            });
            group.appendChild(list);
            dom.actions.appendChild(group);
        });

        const hint = el('div', 'dai-hint');
        hint.innerHTML = game.isPokemon
            ? 'Une 1 energía por turno, ataca y toma premios al dejar fuera de combate al rival.'
            : 'Fase actual: <b>' + game.phaseLabel(game.phase) + '</b>. Invoca, activa cartas y ataca en la Fase de Batalla.';
        dom.actions.appendChild(hint);
    }

    function runHumanAction(action) {
        const game = ui.game;
        if (!game || ui.busy || game.turn !== ui.humanKey) return;
        const res = game.applyAction(action, ui.humanKey);
        if (res && res.ok === false) {
            toast(res.error || 'Acción no válida');
            return;
        }
        afterAction();
    }

    function afterAction() {
        render();
        maybeRunAI();
    }

    function toast(message) {
        const node = el('div', 'dai-chip turn-ai', message);
        node.style.position = 'fixed';
        node.style.bottom = '16px';
        node.style.left = '50%';
        node.style.transform = 'translateX(-50%)';
        node.style.zIndex = '9800';
        document.body.appendChild(node);
        setTimeout(function () { node.remove(); }, 2400);
    }

    // ---------------------------------------------------------------
    // IA
    // ---------------------------------------------------------------
    function maybeRunAI() {
        const game = ui.game;
        if (!game || game.winner) return;
        if (ui.aiTimer) { clearTimeout(ui.aiTimer); ui.aiTimer = null; }

        if (game.pendingResponse && game.pendingResponse.player === ui.aiKey) {
            ui.aiTimer = setTimeout(runAIChainResponse, 650);
            return;
        }
        if (game.turn !== ui.aiKey) return;
        ui.aiTimer = setTimeout(runAIStep, 620);
    }

    function runAIChainResponse() {
        ui.aiTimer = null;
        const game = ui.game;
        if (!game || !game.pendingResponse) return;
        const pending = game.pendingResponse;
        const brain = new E.AIBrain(game, ui.aiKey);
        const pick = brain.chooseResponse(pending.options, game.chain[0].kind);
        if (pick) game.respondChain(ui.aiKey, pick.card.uid);
        else game.passChain(ui.aiKey);
        render();
        maybeRunAI();
    }

    function runAIStep() {
        ui.aiTimer = null;
        const game = ui.game;
        if (!game || game.winner || game.turn !== ui.aiKey) return;
        if (game.pendingResponse) { maybeRunAI(); return; }

        const brain = new E.AIBrain(game, ui.aiKey);
        const action = brain.chooseAction();
        if (!action) { game.applyAction({ type: 'endTurn' }, ui.aiKey); render(); maybeRunAI(); return; }

        const res = game.applyAction(action, ui.aiKey);
        if (res && res.ok === false) {
            // La IA propone algo que el motor rechaza: cierra el turno en vez de bloqueares
            const fallback = game.applyAction({ type: 'endTurn' }, ui.aiKey);
            render();
            if (fallback && fallback.ok === false) return;
            maybeRunAI();
            return;
        }
        render();
        maybeRunAI();
    }

    // ---------------------------------------------------------------
    // Cadena (respuesta del humano)
    // ---------------------------------------------------------------
    function renderChainPrompt() {
        const game = ui.game;
        const pending = game && game.pendingResponse;
        if (!pending || pending.player !== ui.humanKey) {
            ui.pendingChain = null;
            dom.chainOverlay.classList.remove('show');
            return;
        }
        ui.pendingChain = pending;
        clear(dom.chainList);
        dom.chainOverlay.classList.add('show');

        pending.options.forEach(function (option) {
            const row = el('div', 'dai-chain-card');
            if (option.card.img) {
                const img = el('img');
                img.src = option.card.img;
                img.alt = option.card.name;
                row.appendChild(img);
            }
            const info = el('div');
            info.appendChild(el('div', null, option.card.name));
            info.appendChild(el('div', 'dai-hint', (option.effect && option.effect.desc) || 'Sin efecto programado'));
            row.appendChild(info);
            const btn = el('button', 'dai-btn small', 'Encadenar');
            btn.type = 'button';
            btn.style.marginLeft = 'auto';
            btn.addEventListener('click', function () {
                game.respondChain(ui.humanKey, option.card.uid);
                dom.chainOverlay.classList.remove('show');
                ui.pendingChain = null;
                afterAction();
            });
            row.appendChild(btn);
            dom.chainList.appendChild(row);
        });
    }

    function bindChainPass() {
        const btn = $('dai-chain-pass');
        if (!btn) return;
        btn.addEventListener('click', function () {
            const game = ui.game;
            if (!game || !game.pendingResponse) return;
            game.passChain(ui.humanKey);
            dom.chainOverlay.classList.remove('show');
            ui.pendingChain = null;
            afterAction();
        });
    }

    // ---------------------------------------------------------------
    // Ganador
    // ---------------------------------------------------------------
    function showWinner() {
        const game = ui.game;
        if (!game || !game.winner || dom.winner.classList.contains('show')) return;
        const isMe = game.winner === ui.humanKey;
        $('dai-winner-title').textContent = isMe ? '¡Ganaste!' : 'Gana la máquina';
        $('dai-winner-desc').textContent = isMe
            ? 'Derrotaste al oponente automático.'
            : 'La máquina se llevó la partida. ¡Intenta otra vez!';
        const icon = $('dai-winner-icon');
        if (icon) icon.className = isMe ? 'fas fa-trophy' : 'fas fa-robot';
        dom.winner.classList.add('show');
    }

    function bindButtons() {
        const again = $('dai-winner-again');
        if (again) again.addEventListener('click', function () { window.location.reload(); });
        const config = $('dai-winner-config');
        if (config) {
            config.addEventListener('click', function () {
                window.location.href = (document.body.classList.contains('dai-mobile') ? 'configDuelMobile.html' : 'configDuel.html');
            });
        }
        const surrender = $('dai-surrender');
        if (surrender) {
            surrender.addEventListener('click', function () {
                const game = ui.game;
                if (!game || game.winner) return;
                game.declareWinner(ui.aiKey, 'te rendiste');
                render();
            });
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        bindChainPass();
        bindButtons();
        boot().catch(function (err) {
            const setup = document.getElementById('dai-setup');
            if (setup) {
                setup.style.display = 'flex';
                setup.textContent = 'Error al iniciar el modo: ' + (err && err.message ? err.message : err);
            }
        });
    });
})();
