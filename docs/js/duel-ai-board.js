/*
 * Modo "vs IA": puente entre el motor de reglas (duel-ai-engine.js) y el
 * tablero real de duel.html / duelmobile.html.
 *
 * No modifica esos tableros: lee `state` (declarado en duel.js), proyecta el
 * estado del motor sobre `state.cards` y vuelve a pintar con renderAllCards().
 * Todo lo que hace la IA pasa por el mismo motor que valida los clics del
 * humano, así que las reglas se aplican igual para los dos.
 */
(function () {
    'use strict';

    const params = new URLSearchParams(window.location.search);
    const LAYOUT = params.get('layout') || 'yugioh';
    const DIFFICULTY = params.get('difficulty') || 'normal';
    const DECK1 = params.get('deck1') || '';
    const DECK2 = params.get('deck2') || '';
    const IS_POKEMON = LAYOUT === 'pokemon';

    const AI_KEY = 'p2';
    const HUMAN_KEY = 'p1';

    // Quién mueve primero: 'human', 'ai' o 'coin' (aleatorio).
    const FIRST = (function () {
        const v = String(params.get('first') || 'human').toLowerCase();
        return (v === 'ai' || v === 'coin') ? v : 'human';
    })();

    // Marca el body para que el CSS de este modo no afecte a las demás vistas.
    document.body.classList.add('duel-ai-mode');

    const ui = {
        game: null,
        brain: null,
        busy: false,
        ready: false,
        lastActionAt: 0
    };

    // ---------------------------------------------------------------
    // Utilidades
    // ---------------------------------------------------------------
    function $(sel) { return document.querySelector(sel); }

    function el(tag, cls, text) {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function toast(message) {
        const node = el('div', 'dai-toast', message);
        document.body.appendChild(node);
        requestAnimationFrame(function () { node.classList.add('dai-toast-in'); });
        setTimeout(function () {
            node.classList.remove('dai-toast-in');
            setTimeout(function () { node.remove(); }, 260);
        }, 2200);
    }

    function log(text, kind) {
        // duel.html y duelmobile.html usan #game-log-box; otros ids quedan
        // como respaldo por si cambia el markup.
        const box = $('#game-log-box') || $('#game-log-list') || $('#game-log');
        if (box) {
            const row = el('div', 'dai-log-row ' + (kind || 'sys'), text);
            box.appendChild(row);
            box.scrollTop = box.scrollHeight;
        }
        const chat = $('#chat-msg-box');
        if (chat) {
            const row = el('div', 'dai-chat-row', text);
            chat.appendChild(row);
            chat.scrollTop = chat.scrollHeight;
        }
    }

    // ---------------------------------------------------------------
    // Carga de mazos: reutiliza las filas del tablero (deck_cards) y las
    // resuelve con DuelAICards (metadatos: ATK/DEF, PS, ataques...).
    // ---------------------------------------------------------------
    async function deckRowsFor(deckId) {
        if (!deckId || deckId === 'mock') return [];
        const { data, error } = await _supabase
            .from('deck_cards')
            .select('*')
            .eq('deck_id', deckId)
            .order('position', { ascending: true });
        if (error) throw error;
        return data || [];
    }

    async function buildGame() {
        const [rows1, rows2] = await Promise.all([deckRowsFor(DECK1), deckRowsFor(DECK2)]);
        const [cards1, cards2] = await Promise.all([
            DuelAICards.resolveDeck(rows1, LAYOUT),
            DuelAICards.resolveDeck(rows2, LAYOUT)
        ]);

        if (!cards1.length || !cards2.length) {
            throw new Error('No se pudieron cargar las cartas de los mazos.');
        }

        const game = DuelAIEngine.createGame({
            layout: LAYOUT,
            difficulty: DIFFICULTY,
            p1: { name: 'Tú', isAI: false, cards: cards1 },
            p2: { name: 'Máquina', isAI: true, cards: cards2 }
        });
        game.setup();
        applyFirstTurn(game);
        return game;
    }

    // El motor reparte y deja el turno 1 a p1. Si empieza la IA se le cede
    // el turno (sin robo extra: startTurn del turno 1 no roba).
    function applyFirstTurn(game) {
        let starter = FIRST;
        if (starter === 'coin') starter = Math.random() < 0.5 ? 'human' : 'ai';
        if (starter === 'ai') {
            game.turn = AI_KEY;
            game.turnNumber = 0;
            game.startTurn(AI_KEY);
            // En Pokémon startTurn siempre roba; en el primer turno nadie
            // debe robar, así que se devuelve la carta al mazo.
            if (game.isPokemon) {
                const p = game.player(AI_KEY);
                const drawn = p.hand.pop();
                if (drawn) p.deck.unshift(drawn);
            }
            game.pushLog('La IA empieza la partida.', 'sys');
        } else {
            game.pushLog('Empiezas tú la partida.', 'sys');
        }
    }

    // ---------------------------------------------------------------
    // Proyección: motor -> state.cards del tablero real
    // ---------------------------------------------------------------
    let projectionSeq = 0;

    function zoneFor(playerKey, kind, index) {
        const suffix = playerKey === HUMAN_KEY ? '1' : '2';
        if (kind === 'hand') return 'hand_' + suffix;
        if (kind === 'deck') return 'deck_' + suffix;
        if (kind === 'grave') return 'grave_' + suffix;
        if (kind === 'banished') return 'banished_' + suffix;
        if (kind === 'extra') return 'extra_' + suffix;
        if (kind === 'monster') return 'monster_' + suffix + '_' + (index + 1);
        if (kind === 'spell') return 'spell_' + suffix + '_' + (index + 1);
        if (kind === 'active') return 'active_' + suffix;
        if (kind === 'bench') return 'bench_' + suffix + '_' + (index + 1);
        if (kind === 'prize') return 'prize_' + suffix + '_' + (index + 1);
        if (kind === 'field') return 'field_' + suffix;
        return 'deck_' + suffix;
    }

    // El tablero compara `owner` con "player1"/"player2" (duel.js). Si se
    // guarda "p1"/"p2" las cartas de la IA se pintan como del humano y los
    // botones de la mano actúan sobre el jugador equivocado.
    function ownerFor(playerKey) {
        return playerKey === HUMAN_KEY ? 'player1' : 'player2';
    }

    function uidFor(playerKey, card, kind, index) {
        return 'ai_' + playerKey + '_' + kind + '_' + index + '_' + (card ? card.uid : 'x');
    }

    // Construye la lista completa de cartas visibles a partir del motor.
    function projectCards() {
        const g = ui.game;
        const out = [];
        const seq = ++projectionSeq;

        function push(playerKey, card, kind, index, opts) {
            if (!card) return;
            opts = opts || {};
            const meta = card.meta || {};
            out.push({
                instanceId: uidFor(playerKey, card, kind, index),
                name: card.name,
                imageUrl: card.img || meta.img || 'https://vikingtcg.xyz/favi.png',
                owner: ownerFor(playerKey),
                controller: ownerFor(playerKey),
                zone: zoneFor(playerKey, kind, index),
                faceDown: !!opts.faceDown,
                tapped: !!opts.tapped,
                counters: 0,
                attachedTo: null,
                x: 0,
                y: 0,
                z: seq,
                isExtra: kind === 'extra',
                description: meta.desc || '',
                customAtkDef: meta.kind === 'monster' || meta.kind === 'pokemon'
                    ? { atk: String(meta.atk != null ? meta.atk : '?'), def: String(meta.def != null ? meta.def : '?') }
                    : null,
                isNotMonster: !(meta.kind === 'monster' || meta.kind === 'pokemon'),
                _aiCard: card,
                _aiKind: kind,
                _aiIndex: index
            });
        }

        [HUMAN_KEY, AI_KEY].forEach(function (key) {
            const p = g.player(key);

            // La mano de la IA no se proyecta: duel.js fuerza las cartas de
            // mano boca arriba, así que mostrarla revelaría su mano.
            if (key === HUMAN_KEY) {
                p.hand.forEach(function (c) { push(key, c, 'hand', 0, { faceDown: false }); });
            }

            if (g.isPokemon) {
                if (p.active) {
                    push(key, p.active.card, 'active', 0, { tapped: false });
                    p.active.energies.forEach(function (e) { push(key, e.card, 'active', 0, { faceDown: false }); });
                    (p.active.tools || []).forEach(function (t) { push(key, t.card || t, 'active', 0, { faceDown: false }); });
                }
                (p.bench || []).forEach(function (slot, i) {
                    if (!slot) return;
                    push(key, slot.card, 'bench', i, {});
                    slot.energies.forEach(function (e) { push(key, e.card, 'bench', i, { faceDown: false }); });
                    (slot.tools || []).forEach(function (t) { push(key, t.card || t, 'bench', i, { faceDown: false }); });
                });
                (p.prizes || []).forEach(function (c, i) { push(key, c, 'prize', i, { faceDown: true }); });
                p.discard.forEach(function (c, i) { push(key, c, 'grave', i, { faceDown: false }); });
            } else {
                p.monsters.forEach(function (slot, i) {
                    if (!slot) return;
                    push(key, slot.card, 'monster', i, {
                        faceDown: slot.position === 'set' || !!slot.faceDown,
                        tapped: slot.position === 'def'
                    });
                });
                p.spells.forEach(function (slot, i) {
                    if (!slot) return;
                    push(key, slot.card, 'spell', i, { faceDown: !!slot.faceDown });
                });
                p.grave.forEach(function (c, i) { push(key, c, 'grave', i, { faceDown: false }); });
                p.banished.forEach(function (c, i) { push(key, c, 'banished', i, { faceDown: false }); });
            }

            p.deck.forEach(function (c, i) { push(key, c, 'deck', i, { faceDown: true }); });
        });

        return out;
    }

    function renderBoard() {
        if (typeof window.renderAllCards !== 'function') return;
        window.renderAllCards();
    }

    // duel.js carga sus propios mazos de forma asíncrona y llama a
    // renderAllCards, lo que pisaría la proyección del motor. Enganchamos el
    // render para que cada pintado vuelva a aplicar el estado del motor.
    let originalRender = null;
    let projecting = false;

    function installRenderHook() {
        if (originalRender) return;
        originalRender = window.renderAllCards;
        window.renderAllCards = function () {
            if (ui.ready && ui.game && !projecting) {
                projecting = true;
                try {
                    state.cards = projectCards();
                } finally {
                    projecting = false;
                }
            }
            return originalRender.apply(this, arguments);
        };
    }

    // DP y SP no dan decisiones al jugador: se avanzan solas hasta Main 1
    // para que el panel ofrezca invocar en vez de "Ir a Standby".
    function advanceIdlePhases() {
        const g = ui.game;
        if (!g || g.isPokemon || g.pendingResponse || g.winner) return;
        if (g.turn !== HUMAN_KEY) return;
        let guard = 0;
        while ((g.phase === 'DP' || g.phase === 'SP') && guard++ < 3) {
            g.applyAction({ type: 'nextPhase' }, HUMAN_KEY);
        }
    }

    function syncBoard() {
        if (!ui.game) return;
        try {
            state.cards = projectCards();
        } catch (e) {
            console.error('No se pudo proyectar el estado sobre el tablero:', e);
            return;
        }
        renderBoard();
        syncHud();
    }

    function syncHud() {
        const g = ui.game;
        if (!g) return;

        const turnEl = $('#turn-display');
        if (turnEl) {
            turnEl.textContent = g.turn === HUMAN_KEY ? 'P1' : 'P2';
            turnEl.classList.toggle('p1-turn', g.turn === HUMAN_KEY);
            turnEl.classList.toggle('p2-turn', g.turn === AI_KEY);
        }

        const phaseEl = $('#current-phase-display');
        if (phaseEl) phaseEl.textContent = g.isPokemon ? 'MAIN' : g.phase;

        if (!g.isPokemon) {
            document.querySelectorAll('.phase-btn').forEach(function (btn) {
                btn.classList.toggle('active', btn.dataset.phase === g.phase);
            });
        }

        const lp1 = $('#lp-display-p1');
        const lp2 = $('#lp-display-p2');
        const h1 = $('#lp-header-p1');
        const h2 = $('#lp-header-p2');
        if (g.isPokemon) {
            // En Pokémon el marcador relevante son los premios tomados.
            if (lp1) lp1.textContent = String(g.player(HUMAN_KEY).prizesTaken);
            if (lp2) lp2.textContent = String(g.player(AI_KEY).prizesTaken);
            if (h1) h1.textContent = 'P1 PREMIOS';
            if (h2) h2.textContent = 'IA PREMIOS';
        } else {
            if (lp1) lp1.textContent = String(g.player(HUMAN_KEY).lp);
            if (lp2) lp2.textContent = String(g.player(AI_KEY).lp);
            if (h1) h1.textContent = 'P1 LP';
            if (h2) h2.textContent = 'IA LP';
        }

        renderActions();
        syncLog();
    }

    // Vuelca al panel de registro las entradas del motor que aún no se han
    // mostrado. El motor es la fuente de verdad de lo que pasó en el duelo.
    let logCursor = 0;
    function syncLog() {
        const g = ui.game;
        const box = $('#game-log-box');
        if (!g || !box) return;
        if (logCursor > g.log.length) logCursor = 0;
        g.log.slice(logCursor).forEach(function (entry) {
            box.appendChild(el('div', 'dai-log-row ' + (entry.cls || 'sys'), entry.text));
        });
        logCursor = g.log.length;
        box.scrollTop = box.scrollHeight;
    }

    // ---------------------------------------------------------------
    // Panel de acciones: el humano juega con botones generados a partir de
    // las acciones legales del motor (misma validación que la IA).
    // ---------------------------------------------------------------
    function renderActions() {
        const g = ui.game;
        const panel = $('#dai-actions-slot');
        if (!panel || !g) return;
        panel.innerHTML = '';

        if (g.winner) {
            // El motivo de la victoria solo vive en el log del motor, así que
            // se recupera de la última entrada de tipo 'win'.
            const lastWin = (g.log || []).filter(function (r) { return r.cls === 'win'; }).pop();
            panel.appendChild(el('div', 'dai-banner dai-banner-win', g.winner === HUMAN_KEY ? '¡Ganaste!' : 'Ganó la IA'));
            if (lastWin) {
                const reason = lastWin.text.split('—').pop().trim();
                panel.appendChild(el('div', 'dai-banner', reason));
            }
            return;
        }

        // Una cadena pendiente puede ser tuya aunque el turno sea de la IA
        // (p. ej. su ataque dispara tu trampa), así que se comprueba antes.
        if (g.pendingResponse && g.pendingResponse.player === HUMAN_KEY) {
            const box = el('div', 'dai-response');
            box.appendChild(el('div', 'dai-response-title', '¿Respondes a la cadena?'));
            g.pendingResponse.options.forEach(function (opt) {
                const btn = el('button', 'dai-action', opt.label || ('Activar ' + opt.card.name));
                btn.addEventListener('click', function () { respond(opt.card.uid); });
                box.appendChild(btn);
            });
            const pass = el('button', 'dai-action dai-action-pass', 'Pasar');
            pass.addEventListener('click', function () { passChain(); });
            box.appendChild(pass);
            panel.appendChild(box);
            return;
        }

        if (g.turn !== HUMAN_KEY) {
            panel.appendChild(el('div', 'dai-banner', 'Turno de la IA...'));
            return;
        }

        const actions = g.getActions(HUMAN_KEY);
        const groups = {};
        actions.forEach(function (a) {
            const group = a.group || (a.type === 'endTurn' || a.type === 'nextPhase' ? 'flow' : 'other');
            (groups[group] = groups[group] || []).push(a);
        });

        const order = ['summon', 'spell', 'energy', 'pokemon', 'trainer', 'retreat', 'attack', 'flow', 'other'];
        order.forEach(function (name) {
            const list = groups[name];
            if (!list || !list.length) return;
            const wrap = el('div', 'dai-action-group');
            list.forEach(function (a) {
                const btn = el('button', 'dai-action' + (a.primary ? ' dai-action-primary' : '') + (a.secondary ? ' dai-action-secondary' : ''), a.label);
                btn.addEventListener('click', function () { playAction(a); });
                wrap.appendChild(btn);
            });
            panel.appendChild(wrap);
        });

        if (!actions.length) {
            panel.appendChild(el('div', 'dai-banner', 'Sin acciones disponibles'));
        }
    }

    // ---------------------------------------------------------------
    // Botones nativos del tablero: en este modo no mueven cartas por su
    // cuenta, se traducen a acciones del motor (que valida las reglas).
    // ---------------------------------------------------------------
    const NATIVE_MAP = {
        '.btn-summon': function (card) { return findAction('summon', card, 'atk'); },
        '.btn-defense': function (card) { return findAction('summon', card, 'def'); },
        '.btn-set': function (card) { return findAction('set', card); },
        '.btn-field-flip': function (card) { return findAction('set', card); },
        '.btn-field-attack': function (card) { return findAttackAction(card); },
        '.btn-field-direct': function (card) { return findDirectAttack(card); },
        '.btn-pokemon-set': function (card) { return findPlayBasic(card); },
        '.btn-activate': function (card) { return findAction('activate', card); },
        '.btn-pokemon-field': function (card) { return findPlayBasic(card); },
        '.btn-energy': function (card) { return findAction('attachEnergy', card); },
        '.btn-retreat': function (card) { return findAction('retreat', card); },
        '.btn-trainer': function (card) { return findAction('playTrainer', card); },
        '.btn-play-trainer': function (card) { return findAction('playTrainer', card); },
        '.btn-evolve': function (card) { return findAction('evolve', card); }
    };

    // Los botones que el motor no gobierna (mover cartas a mano, contadores,
    // acoplar...) no tienen equivalente en las reglas. En este modo no se
    // dejan al tablero: moverían cartas que la proyección revierte en el
    // siguiente pintado, y el usuario veía "no hace nada".
    const UNSUPPORTED_NOTE = 'En el modo vs IA esa acción la controlan las reglas.';

    function actionCard(action) {
        const g = ui.game;
        if (!g || !action) return null;
        const p = g.player(HUMAN_KEY);
        // `retreat` no lleva cardUid: el botón vive en la banca y la acción
        // se identifica por benchIndex.
        if (action.type === 'retreat' && Number.isInteger(action.benchIndex)) {
            const slot = (p.bench || [])[action.benchIndex];
            if (slot && slot.card) return slot.card;
        }
        const pool = p.hand.concat(
            p.monsters.filter(Boolean).map(function (s) { return s.card; })
        );
        return pool.find(function (c) { return c.uid === action.cardUid; }) || null;
    }

    // La misma carta puede estar repetida en la mano, así que se busca por
    // uid y solo si no aparece se recurre al nombre.
    function matchesCard(action, card) {
        if (action.cardUid && card.uid && action.cardUid === card.uid) return true;
        const c = actionCard(action);
        return !!(c && card && c.name === card.name);
    }

    function findAction(type, card, position) {
        const g = ui.game;
        if (!g) return null;
        const acts = g.getActions(HUMAN_KEY).filter(function (a) {
            return a.type === type && (!position || a.position === position);
        });
        return acts.find(function (a) { return matchesCard(a, card); }) || null;
    }

    function findPlayBasic(card) {
        const g = ui.game;
        if (!g) return null;
        const acts = g.getActions(HUMAN_KEY).filter(function (a) {
            return a.type === 'playBasicActive' || a.type === 'playBasicBench';
        });
        return acts.find(function (a) { return matchesCard(a, card); }) || null;
    }

    // Las acciones de ataque del motor no llevan cardUid: identifican al
    // atacante por su slot. Se resuelve el slot de la carta para elegir la
    // acción correcta (antes se devolvía la primera y atacaba otro monstruo).
    function findAttackAction(card) {
        const g = ui.game;
        if (!g) return null;
        const slots = g.player(HUMAN_KEY).monsters;
        const slotIndex = slots.findIndex(function (s) { return s && s.card === card; });
        if (slotIndex < 0) return null;
        const acts = g.getActions(HUMAN_KEY).filter(function (a) {
            return (a.type === 'attack' || a.type === 'attackDirect' || a.type === 'attackPokemon') && a.slotIndex === slotIndex;
        });
        return acts[0] || null;
    }

    // "Atk Directo" del tablero solo debe declarar ataque directo; si no es
    // legal (la IA tiene monstruos) no se sustituye por un ataque dirigido.
    function findDirectAttack(card) {
        const g = ui.game;
        if (!g) return null;
        const slotIndex = g.player(HUMAN_KEY).monsters
            .findIndex(function (s) { return s && s.card === card; });
        if (slotIndex < 0) return null;
        return g.getActions(HUMAN_KEY).find(function (a) {
            return a.type === 'attackDirect' && a.slotIndex === slotIndex;
        }) || null;
    }

    function cardFromButton(btn) {
        const id = btn.dataset.instanceId;
        const card = (state.cards || []).find(function (c) { return c.instanceId === id; });
        return card && card._aiCard ? card._aiCard : null;
    }

    function interceptFlowButtons() {
        document.addEventListener('click', function (ev) {
            if (!ui.ready || !ui.game) return;
            const endTurn = ev.target.closest && ev.target.closest('#btn-end-turn');
            if (endTurn) {
                ev.preventDefault();
                ev.stopPropagation();
                ev.stopImmediatePropagation();
                if (ui.game.turn === HUMAN_KEY) playAction({ type: 'endTurn' });
                return;
            }
            const phase = ev.target.closest && ev.target.closest('.phase-btn');
            if (phase) {
                // Las fases las lleva el motor: el clic nativo solo cambiaba
                // el texto y desincronizaba el estado.
                ev.preventDefault();
                ev.stopPropagation();
                ev.stopImmediatePropagation();
                if (ui.game.turn === HUMAN_KEY && !ui.game.isPokemon) playAction({ type: 'nextPhase' });
            }
        }, true);
    }

    function interceptNativeButtons() {
        document.addEventListener('click', function (ev) {
            if (!ui.ready || !ui.game) return;
            const btn = ev.target.closest && ev.target.closest('.hand-action-btn, .field-action-btn');
            if (!btn) return;

            // Todos los botones de carta quedan bajo las reglas en este modo:
            // si no hay acción legal, se avisa en vez de dejar que el tablero
            // mueva la carta y la proyección la revierta sin explicación.
            let action = null;
            Object.keys(NATIVE_MAP).forEach(function (sel) {
                if (action || !btn.matches(sel)) return;
                const card = cardFromButton(btn);
                if (!card) return;
                action = NATIVE_MAP[sel](card);
            });

            ev.preventDefault();
            ev.stopPropagation();
            ev.stopImmediatePropagation();

            if (!action) {
                toast(ui.game.turn !== HUMAN_KEY ? 'Espera tu turno.' : UNSUPPORTED_NOTE);
                return;
            }
            playAction(action);
        }, true);
    }

    // ---------------------------------------------------------------
    // Turnos
    // ---------------------------------------------------------------
    function playAction(action) {
        const g = ui.game;
        if (!g) return;
        if (ui.busy) { toast('La IA está jugando, espera un momento.'); return; }
        if (g.turn !== HUMAN_KEY) { toast('Espera tu turno.'); return; }
        if (g.pendingResponse) { toast('Resuelve la cadena primero.'); return; }
        const res = g.applyAction(action, HUMAN_KEY);
        if (res && res.ok === false) {
            toast(res.error || 'Acción no válida');
            return;
        }
        log(action.label, 'pc');
        afterAction();
    }

    function respond(cardUid) {
        const g = ui.game;
        if (!g || !g.pendingResponse) return;
        const res = g.respondChain(HUMAN_KEY, cardUid);
        if (res && res.ok === false) { toast(res.error || 'No puedes responder'); return; }
        afterAction();
    }

    function passChain() {
        const g = ui.game;
        if (!g || !g.pendingResponse) return;
        g.passChain(HUMAN_KEY);
        afterAction();
    }

    function afterAction() {
        advanceIdlePhases();
        syncBoard();
        maybeRunAI();
    }

    function maybeRunAI() {
        const g = ui.game;
        if (!g || ui.busy) return;

        // Hay una cadena esperando tu respuesta: el duelo queda en pausa
        // hasta que decidas, aunque el turno siga siendo de la IA.
        if (g.pendingResponse && g.pendingResponse.player === HUMAN_KEY) return;

        if (g.pendingResponse && g.pendingResponse.player === AI_KEY) {
            ui.busy = true;
            setTimeout(function () {
                const opt = ui.brain.chooseResponse(g.pendingResponse.options, g.pendingResponse.chainType);
                if (opt) {
                    g.respondChain(AI_KEY, opt.card.uid);
                    log('La IA encadena ' + opt.card.name, 'ai');
                } else {
                    g.passChain(AI_KEY);
                }
                ui.busy = false;
                syncBoard();
                maybeRunAI();
            }, 550);
            return;
        }

        if (g.turn !== AI_KEY || g.winner) return;

        ui.busy = true;
        setTimeout(function () {
            if (!ui.game || ui.game !== g) { ui.busy = false; return; }
            const action = ui.brain.chooseAction();
            if (!action) {
                g.applyAction({ type: 'endTurn' }, AI_KEY);
            } else {
                const res = g.applyAction(action, AI_KEY);
                if (res && res.ok === false) {
                    g.applyAction({ type: 'endTurn' }, AI_KEY);
                } else {
                    log(action.label, 'ai');
                }
            }
            ui.busy = false;
            advanceIdlePhases();
            syncBoard();
            maybeRunAI();
        }, 700);
    }

    // ---------------------------------------------------------------
    // Arranque
    // ---------------------------------------------------------------
    function buildPanel() {
        if ($('#ai-actions-panel')) return;
        const panel = el('aside', 'dai-panel');
        panel.id = 'ai-actions-panel';
        const title = el('div', 'dai-panel-title', 'vs IA');
        const toggle = el('button', 'dai-toggle', '–');
        toggle.title = 'Ocultar / mostrar acciones';
        toggle.addEventListener('click', function () {
            panel.classList.toggle('dai-collapsed');
            toggle.textContent = panel.classList.contains('dai-collapsed') ? '+' : '–';
        });
        title.appendChild(toggle);
        panel.appendChild(title);
        // El panel arranca abierto: en móvil es la única forma de jugar
        // (los botones del tablero se traducen a acciones, pero sin panel
        // no se ve qué se puede hacer). El usuario puede plegarlo.
        const slot = el('div', 'dai-actions-slot');
        slot.id = 'dai-actions-slot';
        panel.appendChild(slot);
        document.body.appendChild(panel);

        const style = el('style');
        style.textContent = [
            '.dai-panel{position:fixed;right:12px;top:96px;width:264px;max-height:calc(100vh - 120px);overflow-y:auto;z-index:9000;',
            'background:rgba(10,16,24,.94);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:12px;',
            'display:flex;flex-direction:column;gap:8px;backdrop-filter:blur(8px);font-family:inherit}',
            '.dai-panel-title{font-weight:800;letter-spacing:.06em;font-size:.8rem;color:#ffd32d;text-transform:uppercase}',
            '.dai-action-group{display:flex;flex-direction:column;gap:6px}',
            '.dai-action{cursor:pointer;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);',
            'color:#eaf2ff;border-radius:9px;padding:8px 10px;font-size:.78rem;text-align:left;line-height:1.3}',
            '.dai-action:hover{background:rgba(255,255,255,.13);border-color:rgba(255,255,255,.3)}',
            '.dai-action-primary{background:linear-gradient(135deg,#ffd32d,#e0a800);color:#1a1400;font-weight:700;border-color:transparent}',
            '.dai-action-secondary{opacity:.85}',
            '.dai-action-pass{opacity:.75}',
            '.dai-banner{font-size:.78rem;color:#9fb3c8;text-align:center;padding:6px}',
            '.dai-banner-win{font-size:1rem;font-weight:800;color:#ffd32d}',
            '.dai-response{border:1px solid rgba(255,211,45,.4);border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:6px}',
            '.dai-response-title{font-size:.75rem;color:#ffd32d;font-weight:700}',
            '.dai-toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%) translateY(10px);opacity:0;',
            'background:rgba(12,18,26,.96);border:1px solid rgba(255,255,255,.18);color:#fff;padding:9px 14px;',
            'border-radius:10px;font-size:.8rem;z-index:99999;transition:all .25s ease}',
            '.dai-toast-in{opacity:1;transform:translateX(-50%) translateY(0)}',
            '.dai-log-row,.dai-chat-row{font-size:.74rem;line-height:1.35;color:#cfdae6;padding:2px 0}',
            '.dai-log-row.ai{color:#ffb3c7}.dai-log-row.pc{color:#8fd3ff}.dai-log-row.sys{color:#8fe0b0}',
            '.dai-panel-title{display:flex;align-items:center;justify-content:space-between;gap:8px}',
            '.dai-toggle{cursor:pointer;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);',
            'color:#ffd32d;border-radius:6px;width:22px;height:22px;line-height:1;font-size:.85rem;font-weight:700}',
            '.dai-actions-slot{display:flex;flex-direction:column;gap:8px;overflow-y:auto}',
            '.dai-panel.dai-collapsed .dai-actions-slot{display:none}',
            '@media(max-width:768px){.dai-panel{right:6px;left:6px;width:auto;top:auto;bottom:8px;max-height:44vh}}',

            // --- Ajustes SOLO del modo IA (body.duel-ai-mode) ---
            // En móvil la bandeja de mano flota sobre el tablero y tapaba las
            // dos filas de monstruos. Se ancla al fondo de la pantalla (debajo
            // del playmat) y el panel de acciones pasa arriba, así el campo
            // queda despejado.
            'body.duel-ai-mode #hand-tray-p1{pointer-events:auto}',
            '@media(max-width:768px){',
            'body.duel-ai-mode .hand-tray{top:auto!important;bottom:4px!important;max-height:88px!important}',
            'body.duel-ai-mode .hand-cards-wrapper{padding-bottom:0!important}',
            'body.duel-ai-mode .hand-cards-container{padding:2px 8px!important;max-width:94vw!important}',
            'body.duel-ai-mode .hand-tray .duel-card{width:44px!important;height:62px!important}',
            'body.duel-ai-mode .dai-panel{top:8px!important;bottom:auto!important;left:6px!important;right:6px!important;',
            'width:auto!important;max-height:23vh!important}',
            '}'
        ].join('');
        document.head.appendChild(style);
    }

    async function start() {
        buildPanel();
        log('Cargando mazos...', 'sys');

        try {
            ui.game = await buildGame();
        } catch (e) {
            console.error(e);
            log('Error cargando mazos: ' + e.message, 'sys');
            toast('No se pudieron cargar los mazos');
            return;
        }

        ui.brain = new DuelAIEngine.AIBrain(ui.game, AI_KEY);
        ui.ready = true;
        installRenderHook();
        interceptNativeButtons();
        interceptFlowButtons();

        logCursor = 0;
        log('¡Comienza el duelo! Turno de ' + ui.game.player(ui.game.turn).name, 'sys');
        advanceIdlePhases();
        syncBoard();
        maybeRunAI();
    }

    // Espera a que el tablero (duel.js) haya montado el estado y el DOM.
    function whenBoardReady(cb) {
        let tries = 0;
        const timer = setInterval(function () {
            tries++;
            const ok = typeof state !== 'undefined' && typeof window.renderAllCards === 'function' && $('#field-cards-container');
            if (ok) {
                clearInterval(timer);
                cb();
            } else if (tries > 200) {
                clearInterval(timer);
                console.error('El tablero no terminó de inicializar.');
            }
        }, 100);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { whenBoardReady(start); });
    } else {
        whenBoardReady(start);
    }
})();
