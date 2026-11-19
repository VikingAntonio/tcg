/*
 * VikingDev TCG — Motor de reglas del modo "Contra la Máquina".
 * Módulo independiente: no modifica duel.js ni duelmobile.js.
 * Cubre turnos, fases, invocaciones, batalla, cadenas y efectos
 * para Yu-Gi-Oh! y Pokémon TCG.
 */
(function () {
    'use strict';

    // ---------------------------------------------------------------
    // Utilidades
    // ---------------------------------------------------------------
    function norm(text) {
        return String(text || '')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function mulberry32(seed) {
        let a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function shuffle(array, rng) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            const t = array[i];
            array[i] = array[j];
            array[j] = t;
        }
        return array;
    }

    let UID = 0;
    function makeCard(raw, layout) {
        const meta = raw.meta || raw;
        return {
            uid: 'c' + (++UID),
            name: raw.name || meta.name || 'Carta',
            img: raw.img || meta.img || '',
            meta: meta,
            section: raw.section || 'Main',
            layout: layout,
            faceDown: false,
            atkMod: 0
        };
    }

    function isMonster(c) { return !!(c && c.meta && c.meta.kind === 'monster'); }
    function isSpell(c) { return !!(c && c.meta && c.meta.kind === 'spell'); }
    function isTrap(c) { return !!(c && c.meta && c.meta.kind === 'trap'); }
    function isPokemon(c) { return !!(c && c.meta && c.meta.kind === 'pokemon'); }
    function isEnergy(c) { return !!(c && c.meta && c.meta.kind === 'energy'); }
    function isTrainer(c) { return !!(c && c.meta && c.meta.kind === 'trainer'); }

    function cardAtk(card) {
        const base = Number(card && card.meta && card.meta.atk);
        return Number.isFinite(base) ? Math.max(0, base + (card.atkMod || 0)) : 0;
    }
    function cardDef(card) {
        const base = Number(card && card.meta && card.meta.def);
        return Number.isFinite(base) ? Math.max(0, base + (card.atkMod || 0)) : 0;
    }
    function cardLevel(card) {
        return Number(card && card.meta && card.meta.level) || 4;
    }
    function numericDamage(raw) {
        const text = String(raw || '');
        const match = text.match(/(\d+)/);
        if (!match) return 0;
        const value = Number(match[1]);
        return /[x×]/i.test(text) ? value * 2 : value;
    }

    const ENERGY_ES = {
        planta: 'grass', hierba: 'grass', fuego: 'fire', agua: 'water', rayo: 'lightning',
        electrico: 'lightning', psiquico: 'psychic', lucha: 'fighting', oscuridad: 'darkness',
        metal: 'metal', hada: 'fairy', dragon: 'dragon', incolora: 'colorless'
    };
    function energyTypeOf(card) {
        const n = norm(card && card.name);
        for (const es of Object.keys(ENERGY_ES)) {
            if (n.includes(es)) return ENERGY_ES[es];
        }
        const known = ['grass', 'fire', 'water', 'lightning', 'psychic', 'fighting', 'darkness', 'metal', 'fairy', 'dragon', 'colorless'];
        for (const t of known) if (n.includes(t)) return t;
        return 'any';
    }

    // ---------------------------------------------------------------
    // Tabla de efectos (Yu-Gi-Oh!)
    // ---------------------------------------------------------------
    const YGO_EFFECTS = {
        'pot of greed': { trigger: null, desc: 'Roba 2 cartas', run: function (g, ctx) { g.draw(ctx.owner, 2); } },
        'graceful charity': { trigger: null, desc: 'Roba 3 y descarta 2', run: function (g, ctx) { g.draw(ctx.owner, 3); g.discardWorst(ctx.owner, 2); } },
        'dark hole': { trigger: null, desc: 'Destruye todos los monstruos', run: function (g) { g.destroyAllMonsters(); } },
        'fissure': { trigger: null, desc: 'Destruye el monstruo rival más débil', run: function (g, ctx) { g.destroyWeakestOpponentMonster(ctx.owner, 'atk'); } },
        'smashing ground': { trigger: null, desc: 'Destruye el monstruo rival con más DEF', run: function (g, ctx) { g.destroyStrongestOpponentMonster(ctx.owner, 'def'); } },
        'mystical space typhoon': { trigger: null, desc: 'Destruye una Magia/Trampa rival', run: function (g, ctx) { g.destroyOpponentBackrow(ctx.owner); } },
        'monster reborn': { trigger: null, desc: 'Revive un monstruo del cementerio', run: function (g, ctx) { g.reviveMonster(ctx.owner); } },
        'change of heart': { trigger: null, desc: 'Toma el control de un monstruo rival', run: function (g, ctx) { g.takeControl(ctx.owner); } },
        'swords of revealing light': { trigger: null, desc: 'El rival no puede atacar', run: function (g, ctx) { g.opponentOf(ctx.owner); g.player(g.opponentOf(ctx.owner)).skipNextBattle = true; } },
        'mirror force': { trigger: 'attack', desc: 'Destruye todos los atacantes', run: function (g) { g.effectMirrorForce(); } },
        'magic cylinder': { trigger: 'attack', desc: 'Niega el ataque y refleja el daño', run: function (g) { g.effectMagicCylinder(); } },
        'negate attack': { trigger: 'attack', desc: 'Niega el ataque', run: function (g) { g.effectNegateAttack(); } },
        'sakuretsu armor': { trigger: 'attack', desc: 'Destruye al atacante', run: function (g) { g.effectSakuretsu(); } },
        'trap hole': { trigger: 'summon', desc: 'Destruye un monstruo invocado', run: function (g) { g.effectTrapHole(); } },
        'compulsory evacuation device': { trigger: null, desc: 'Devuelve un monstruo rival a la mano', run: function (g, ctx) { g.effectCompulsory(ctx); } }
    };

    const POKEMON_TRAINER_EFFECTS = {
        'professor s research': { desc: 'Descarta la mano y roba 7', run: function (g, ctx) { const p = g.player(ctx.owner); p.discard.push.apply(p.discard, p.hand.splice(0)); g.draw(ctx.owner, 7); } },
        'professors research': { desc: 'Descarta la mano y roba 7', run: function (g, ctx) { const p = g.player(ctx.owner); p.discard.push.apply(p.discard, p.hand.splice(0)); g.draw(ctx.owner, 7); } },
        'ultra ball': { desc: 'Descarta 2 cartas y busca un Pokémon básico', run: function (g, ctx) { g.discardWorst(ctx.owner, 2); g.searchBasicToHand(ctx.owner); } },
        'nest ball': { desc: 'Busca un Pokémon básico y ponlo en la Banca', run: function (g, ctx) { g.searchBasicToBench(ctx.owner); } },
        'boss s orders': { desc: 'Cambia el Activo rival por uno de su Banca', run: function (g, ctx) { g.bossOrders(ctx.owner); } },
        'bosss orders': { desc: 'Cambia el Activo rival por uno de su Banca', run: function (g, ctx) { g.bossOrders(ctx.owner); } },
        'switch': { desc: 'Cambia tu Activo por uno de tu Banca', run: function (g, ctx) { g.switchActive(ctx.owner); } },
        'potion': { desc: 'Cura 30 puntos de daño', run: function (g, ctx) { g.healActive(ctx.owner, 30); } },
        'bill': { desc: 'Roba 2 cartas', run: function (g, ctx) { g.draw(ctx.owner, 2); } }
    };

    function effectFor(card) {
        if (!card || !card.meta) return null;
        const n = norm(card.name);
        if (card.meta.kind === 'spell' || card.meta.kind === 'trap') {
            return YGO_EFFECTS[n] || deriveYgoEffect(card);
        }
        if (card.meta.kind === 'trainer') {
            const exact = POKEMON_TRAINER_EFFECTS[n];
            if (exact) return { kind: 'trainer', trigger: null, desc: exact.desc, run: exact.run };
            const desc = norm(card.meta.desc || '');
            if (/roba|draw/.test(desc)) return { kind: 'trainer', trigger: null, desc: 'Roba 1 carta', run: function (g, ctx) { g.draw(ctx.owner, 1); } };
            if (/cura|heal/.test(desc)) return { kind: 'trainer', trigger: null, desc: 'Cura 20 de daño', run: function (g, ctx) { g.healActive(ctx.owner, 20); } };
            if (/busca|search/.test(desc)) return { kind: 'trainer', trigger: null, desc: 'Busca un Pokémon básico', run: function (g, ctx) { g.searchBasicToHand(ctx.owner); } };
            return null;
        }
        return null;
    }

    function deriveYgoEffect(card) {
        const desc = norm(card.meta.desc || '');
        const kind = card.meta.kind;
        if (/niega el ataque|negate the attack/.test(desc)) return { kind: kind, trigger: 'attack', desc: 'Niega el ataque', run: function (g) { g.effectNegateAttack(); } };
        if (/destruye todos los monstruos|destroy all monsters/.test(desc)) return { kind: kind, trigger: null, desc: 'Destruye todos los monstruos', run: function (g) { g.destroyAllMonsters(); } };
        if (/devuelve.*mano|return.*hand/.test(desc)) return { kind: kind, trigger: null, desc: 'Devuelve un monstruo a la mano', run: function (g, ctx) { g.effectCompulsory(ctx); } };
        if (/destruye|destroy/.test(desc) && /monstruo|monster/.test(desc)) return { kind: kind, trigger: null, desc: 'Destruye un monstruo rival', run: function (g, ctx) { g.destroyWeakestOpponentMonster(ctx.owner, 'atk'); } };
        if (/roba|draw/.test(desc)) return { kind: kind, trigger: null, desc: 'Roba 1 carta', run: function (g, ctx) { g.draw(ctx.owner, 1); } };
        return null;
    }

    // ---------------------------------------------------------------
    // Helper para construir respuestas a partir de una cadena
    // ---------------------------------------------------------------
    function getActionCardUid(action) {
        return action ? action.cardUid : undefined;
    }

    // ---------------------------------------------------------------
    // Juego
    // ---------------------------------------------------------------
    class Game {
        constructor(opts) {
            opts = opts || {};
            this.layout = opts.layout || 'yugioh';
            this.isPokemon = this.layout === 'pokemon';
            this.rng = mulberry32(opts.seed || Date.now());
            this.difficulty = opts.difficulty || 'normal';
            this.log = [];
            this.winner = null;
            this.turnNumber = 0;
            this.chain = [];
            this.pendingResponse = null;
            this.players = {
                p1: this.buildPlayer('p1', opts.p1),
                p2: this.buildPlayer('p2', opts.p2)
            };
            this.turn = 'p1';
            this.phase = this.isPokemon ? 'MAIN' : 'DP';
            this.takenControl = [];
        }

        buildPlayer(key, cfg) {
            cfg = cfg || {};
            const p = {
                key: key,
                name: cfg.name || (key === 'p1' ? 'Tú' : 'Máquina'),
                isAI: !!cfg.isAI,
                deck: [],
                hand: [],
                grave: [],
                discard: [],
                banished: [],
                extra: [],
                monsters: [null, null, null, null, null],
                spells: [null, null, null, null, null],
                lp: this.isPokemon ? 0 : 8000,
                prizes: [],
                prizesTaken: 0,
                active: null,
                bench: [null, null, null, null, null],
                normalSummonUsed: false,
                energyAttached: false,
                retreatedThisTurn: false,
                supporterPlayed: false,
                attackedThisTurn: false,
                skipNextBattle: false
            };
            const cards = cfg.cards || [];
            p.deck = shuffle(
                cards.filter(function (c) { return String(c.section || 'Main').toLowerCase() !== 'side'; })
                    .map(function (c) { return makeCard(c, this.layout); }, this),
                this.rng
            );
            return p;
        }

        player(key) { return this.players[key]; }
        opponentOf(key) { return key === 'p1' ? 'p2' : 'p1'; }

        pushLog(text, cls) {
            this.log.push({ text: text, cls: cls || 'sys', at: Date.now() });
            if (this.log.length > 400) this.log.shift();
        }

        // ---------------------------------------------------------------
        // Arranque
        // ---------------------------------------------------------------
        setup() {
            if (this.isPokemon) {
                ['p1', 'p2'].forEach(function (k) {
                    const p = this.player(k);
                    let guard = 0;
                    do {
                        this.draw(k, 7, { silent: true });
                        guard += 1;
                    } while (!p.hand.some(function (c) { return isPokemon(c) && c.meta.stage === 'basic'; }) && p.deck.length > 10 && guard < 5);
                    const basicIdx = p.hand.findIndex(function (c) { return isPokemon(c) && c.meta.stage === 'basic'; });
                    if (basicIdx >= 0) {
                        const card = p.hand.splice(basicIdx, 1)[0];
                        p.active = { card: card, energies: [], damage: 0, tools: [] };
                    }
                    this.setupPrizes(k);
                }, this);
                this.pushLog('¡Comienza el duelo Pokémon! Reparte 6 premios y ataca para ganarlos.', 'sys');
            } else {
                this.draw('p1', 5, { silent: true });
                this.draw('p2', 5, { silent: true });
                this.pushLog('¡Comienza el duelo! Turno de ' + this.player('p1').name + '.', 'sys');
                this.turnNumber = 1;
            }
            return this;
        }

        setupPrizes(key) {
            const p = this.player(key);
            p.prizes = [];
            for (let i = 0; i < 6; i++) {
                const card = p.deck.shift();
                if (!card) break;
                p.prizes.push(card);
            }
            p.prizesTaken = 0;
        }

        // ---------------------------------------------------------------
        // Zonas
        // ---------------------------------------------------------------
        monsterSlots(key) {
            const out = [];
            this.player(key).monsters.forEach(function (slot, i) {
                if (slot) out.push({ index: i, slot: slot });
            });
            return out;
        }
        monsterCountOf(key) { return this.player(key).monsters.filter(Boolean).length; }

        setMonster(key, card, slotIndex, position, faceDown) {
            const p = this.player(key);
            const slot = { card: card, position: position || 'atk', faceDown: !!faceDown, attacked: false, turnsOnField: 0 };
            card.faceDown = !!faceDown;
            let idx = slotIndex;
            if (idx === null || idx === undefined) {
                idx = p.monsters.findIndex(function (s) { return !s; });
                if (idx < 0) idx = 0;
            }
            if (p.monsters[idx]) this.toGrave(key, p.monsters[idx].card);
            p.monsters[idx] = slot;
            return idx;
        }

        setSpell(key, card, slotIndex) {
            const p = this.player(key);
            let idx = slotIndex;
            if (idx === null || idx === undefined) {
                idx = p.spells.findIndex(function (s) { return !s; });
                if (idx < 0) idx = 0;
            }
            if (p.spells[idx]) this.toGrave(key, p.spells[idx].card);
            p.spells[idx] = { card: card, faceDown: !!card.faceDown, setTurn: this.turnNumber };
            return idx;
        }

        toGrave(key, card) {
            if (!card) return;
            const p = this.player(key);
            p.monsters = p.monsters.map(function (s) { return (s && s.card.uid === card.uid) ? null : s; });
            p.spells = p.spells.map(function (s) { return (s && s.card.uid === card.uid) ? null : s; });
            p.bench = p.bench.map(function (s) { return (s && s.card.uid === card.uid) ? null : s; });
            if (p.active && p.active.card.uid === card.uid) p.active = null;
            p.hand = p.hand.filter(function (c) { return c.uid !== card.uid; });
            const pile = this.isPokemon ? p.discard : p.grave;
            if (!pile.some(function (c) { return c.uid === card.uid; })) pile.push(card);
        }

        draw(key, count, opts) {
            const p = this.player(key);
            for (let i = 0; i < (count || 1); i++) {
                if (!p.deck.length) {
                    this.declareWinner(this.opponentOf(key), p.name + ' se quedó sin cartas para robar');
                    return;
                }
                p.hand.push(p.deck.shift());
            }
            if (!(opts && opts.silent)) {
                this.pushLog(p.name + ' roba ' + (count || 1) + ' carta(s).', p.isAI ? 'ai' : 'human');
            }
        }

        discardWorst(key, count) {
            const p = this.player(key);
            const pile = this.isPokemon ? p.discard : p.grave;
            const self = this;
            for (let i = 0; i < count; i++) {
                if (!p.hand.length) return;
                let worst = -1;
                let worstScore = Infinity;
                p.hand.forEach(function (c, idx) {
                    const score = self.handCardValue(c);
                    if (score < worstScore) { worstScore = score; worst = idx; }
                });
                if (worst < 0) return;
                pile.push(p.hand.splice(worst, 1)[0]);
            }
        }

        handCardValue(card) {
            if (isMonster(card)) return 100 + cardAtk(card) / 10;
            if (isPokemon(card)) return 100 + (card.meta.hp || 0) / 10;
            if (isEnergy(card)) return 60;
            if (isSpell(card)) return 80;
            if (isTrap(card)) return 55;
            if (isTrainer(card)) return 50;
            return 40;
        }

        // ---------------------------------------------------------------
        // Turnos y fases
        // ---------------------------------------------------------------
        startTurn(key) {
            this.turn = key;
            this.turnNumber += 1;
            const p = this.player(key);
            p.normalSummonUsed = false;
            p.energyAttached = false;
            p.supporterPlayed = false;
            p.attackedThisTurn = false;
            p.retreatedThisTurn = false;
            if (p.active) { p.active.justPlayed = false; p.active.justEvolved = false; }
            p.monsters.forEach(function (s) {
                if (s) { s.attacked = false; s.turnsOnField = (s.turnsOnField || 0) + 1; }
            });
            p.bench.forEach(function (s) {
                if (s) { s.justPlayed = false; s.justEvolved = false; }
            });
            this.phase = this.isPokemon ? 'MAIN' : 'DP';
            this.pushLog('— Turno ' + this.turnNumber + ': ' + p.name + ' —', 'turn');
            if (this.isPokemon) {
                this.draw(key, 1);
            } else if (this.turnNumber > 1) {
                this.pushLog('Fase de Robo.', 'phase');
                this.draw(key, 1);
            } else {
                this.pushLog('Fase de Robo (primer turno: no se roba).', 'phase');
            }
            return this;
        }

        phaseLabel(phase) {
            return { DP: 'Robo', SP: 'Standby', M1: 'Main 1', BP: 'Batalla', M2: 'Main 2', EP: 'Final', MAIN: 'Principal' }[phase] || phase;
        }

        nextPhaseName() {
            const order = ['DP', 'SP', 'M1', 'BP', 'M2', 'EP'];
            const idx = order.indexOf(this.phase);
            return order[Math.min(order.length - 1, idx + 1)];
        }

        nextPhase() {
            if (this.isPokemon) return this.endTurn();
            const order = ['DP', 'SP', 'M1', 'BP', 'M2', 'EP'];
            const idx = order.indexOf(this.phase);
            if (idx < 0 || idx >= order.length - 1) return this.endTurn();
            const next = order[idx + 1];
            this.phase = next;
            if (next === 'EP') {
                this.pushLog('Fase Final.', 'phase');
            } else {
                this.pushLog('Fase: ' + this.phaseLabel(next) + '.', 'phase');
            }
            return this;
        }

        endTurn() {
            if (this.winner) return this;
            this.returnTakenControl();
            const next = this.opponentOf(this.turn);
            this.startTurn(next);
            return this;
        }

        returnTakenControl() {
            const self = this;
            this.takenControl.slice().forEach(function (entry) {
                const fromP = self.player(entry.from);
                const slot = fromP.monsters[entry.slotIndex];
                if (slot && slot.card.uid === entry.cardUid) {
                    // El monstruo vuelve al lado del dueño original
                    const toP = self.player(entry.owner);
                    const free = toP.monsters.findIndex(function (s) { return !s; });
                    if (free >= 0) {
                        toP.monsters[free] = slot;
                        fromP.monsters[entry.slotIndex] = null;
                    }
                }
            });
            this.takenControl = [];
        }

        declareWinner(key, reason) {
            if (this.winner) return;
            this.winner = key;
            this.pushLog('¡Gana ' + this.player(key).name + '!' + (reason ? ' — ' + reason : ''), 'win');
        }

        checkYgoVictory() {
            if (this.winner) return;
            const self = this;
            ['p1', 'p2'].forEach(function (k) {
                if (self.player(k).lp <= 0) self.declareWinner(self.opponentOf(k), self.player(k).name + ' llegó a 0 LP');
            });
        }

        checkPokemonVictory() {
            if (this.winner) return;
            const self = this;
            ['p1', 'p2'].forEach(function (k) {
                const p = self.player(k);
                if (p.prizesTaken >= 6) self.declareWinner(k, 'tomó los 6 premios');
                if (!p.active && !p.bench.some(Boolean)) self.declareWinner(self.opponentOf(k), p.name + ' no tiene Pokémon en juego');
            });
        }

        // ---------------------------------------------------------------
        // Acciones legales
        // ---------------------------------------------------------------
        getActions(key) {
            if (this.winner) return [];
            if (this.pendingResponse) return [];
            if (this.turn !== key) return [];
            const actions = [];
            if (this.isPokemon) this.pokemonActions(key, actions);
            else this.ygoActions(key, actions);
            actions.push({ type: 'endTurn', key: key + '-end', label: 'Terminar turno', primary: true });
            if (!this.isPokemon && this.phase !== 'EP') {
                actions.push({ type: 'nextPhase', key: key + '-phase', label: 'Ir a ' + this.phaseLabel(this.nextPhaseName()), secondary: true });
            }
            return actions;
        }

        ygoActions(key, actions) {
            const p = this.player(key);
            const self = this;
            const inMain = this.phase === 'M1' || this.phase === 'M2';
            if (inMain) {
                if (!p.normalSummonUsed) {
                    p.hand.forEach(function (card) {
                        if (!isMonster(card)) return;
                        const tributes = self.tributesNeeded(card);
                        if (self.monsterCountOf(key) < tributes) return;
                        const suffix = tributes ? ' (' + tributes + ' tributo' + (tributes > 1 ? 's' : '') + ')' : '';
                        actions.push({ type: 'summon', key: key + '-sum-' + card.uid, cardUid: card.uid, position: 'atk', group: 'summon', label: 'Invocar ' + card.name + suffix });
                        actions.push({ type: 'summon', key: key + '-def-' + card.uid, cardUid: card.uid, position: 'def', group: 'summon', label: 'Invocar en DEF ' + card.name });
                        actions.push({ type: 'set', key: key + '-set-' + card.uid, cardUid: card.uid, group: 'summon', label: 'Colocar boca abajo ' + card.name });
                    });
                }
                p.hand.forEach(function (card) {
                    if (isSpell(card)) {
                        actions.push({ type: 'activate', key: key + '-act-' + card.uid, cardUid: card.uid, group: 'spell', label: 'Activar ' + card.name });
                    } else if (isTrap(card)) {
                        actions.push({ type: 'setSpell', key: key + '-setsp-' + card.uid, cardUid: card.uid, group: 'spell', label: 'Colocar trampa ' + card.name });
                    }
                });
            }
            if (this.phase === 'BP' && !p.skipNextBattle) {
                const oppMonsters = this.monsterSlots(this.opponentOf(key));
                this.monsterSlots(key).forEach(function (entry) {
                    const slot = entry.slot;
                    if (slot.attacked || slot.faceDown || slot.position !== 'atk') return;
                    if (!oppMonsters.length) {
                        actions.push({ type: 'attackDirect', key: key + '-atkdir-' + entry.index, slotIndex: entry.index, group: 'attack', label: 'Ataque directo con ' + slot.card.name });
                    } else {
                        oppMonsters.forEach(function (t) {
                            actions.push({ type: 'attack', key: key + '-atk-' + entry.index + '-' + t.index, slotIndex: entry.index, targetIndex: t.index, group: 'attack', label: 'Atacar ' + t.slot.card.name + ' con ' + slot.card.name });
                        });
                    }
                });
            }
        }

        pokemonActions(key, actions) {
            const p = this.player(key);
            const self = this;
            if (!p.energyAttached) {
                p.hand.forEach(function (card) {
                    if (!isEnergy(card)) return;
                    if (p.active) actions.push({ type: 'attachEnergy', key: key + '-en-a-' + card.uid, cardUid: card.uid, target: 'active', group: 'energy', label: 'Unir ' + card.name + ' al Activo' });
                    p.bench.forEach(function (slot, bi) {
                        if (slot) actions.push({ type: 'attachEnergy', key: key + '-en-b' + bi + '-' + card.uid, cardUid: card.uid, target: 'bench', benchIndex: bi, group: 'energy', label: 'Unir ' + card.name + ' a ' + slot.card.name });
                    });
                });
            }
            p.hand.forEach(function (card) {
                if (!isPokemon(card)) return;
                if (card.meta.stage === 'basic') {
                    if (!p.active) actions.push({ type: 'playBasicActive', key: key + '-ba-' + card.uid, cardUid: card.uid, group: 'pokemon', label: 'Poner ' + card.name + ' como Activo' });
                    p.bench.forEach(function (slot, bi) {
                        if (!slot) actions.push({ type: 'playBasicBench', key: key + '-bb' + bi + '-' + card.uid, cardUid: card.uid, benchIndex: bi, group: 'pokemon', label: 'Poner ' + card.name + ' en Banca' });
                    });
                    return;
                }
                if (self.canEvolveSlot(p.active, card) && !p.active.justEvolved) {
                    actions.push({ type: 'evolve', key: key + '-eva-' + card.uid, cardUid: card.uid, target: 'active', group: 'pokemon', label: 'Evolucionar Activo a ' + card.name });
                }
                p.bench.forEach(function (slot, bi) {
                    if (self.canEvolveSlot(slot, card) && !slot.justEvolved) {
                        actions.push({ type: 'evolve', key: key + '-evb' + bi + '-' + card.uid, cardUid: card.uid, target: 'bench', benchIndex: bi, group: 'pokemon', label: 'Evolucionar ' + slot.card.name + ' a ' + card.name });
                    }
                });
            });
            p.hand.forEach(function (card) {
                if (!isTrainer(card)) return;
                if (!effectFor(card)) return;
                if (card.meta.isSupporter && p.supporterPlayed) return;
                actions.push({ type: 'playTrainer', key: key + '-tr-' + card.uid, cardUid: card.uid, group: 'trainer', label: 'Usar ' + card.name });
            });
            if (p.active && p.bench.some(Boolean) && !p.retreatedThisTurn) {
                const cost = p.active.card.meta.retreat || 0;
                if (p.active.energies.length >= cost) {
                    p.bench.forEach(function (slot, bi) {
                        if (slot) actions.push({ type: 'retreat', key: key + '-ret' + bi, benchIndex: bi, group: 'retreat', label: 'Retirar Activo por ' + slot.card.name });
                    });
                }
            }
            if (p.active && !p.attackedThisTurn && !p.active.justPlayed) {
                (p.active.card.meta.attacks || []).forEach(function (atk, ai) {
                    if (!self.canPayAttack(p.active, atk)) return;
                    actions.push({ type: 'attackPokemon', key: key + '-atk' + ai, attackIndex: ai, group: 'attack', label: 'Atacar con ' + atk.name + (atk.damage ? ' (' + atk.damage + ')' : '') });
                });
            }
        }

        canEvolveSlot(slot, evoCard) {
            if (!slot) return false;
            const from = norm(evoCard.meta.evolvesFrom || '');
            if (from) return norm(slot.card.name) === from;
            const need = evoCard.meta.stage === 'stage2' ? 'stage1' : 'basic';
            return !!(slot.card.meta && slot.card.meta.stage === need);
        }

        tributesNeeded(card) {
            const lvl = cardLevel(card);
            if (lvl <= 4) return 0;
            if (lvl <= 6) return 1;
            return 2;
        }

        canPayAttack(slot, attack) {
            const pool = slot.energies.map(function (e) { return e.energyType; });
            const cost = attack.cost || [];
            const isFlexible = function (need) {
                return need === 'any' || need === 'colorless';
            };
            for (let i = 0; i < cost.length; i++) {
                const need = norm(cost[i]);
                // "Colorless"/"Incolora" se paga con cualquier energía restante.
                let idx = isFlexible(need)
                    ? pool.findIndex(function (t) { return t && t !== 'any'; })
                    : pool.findIndex(function (t) { return t === need; });
                if (idx < 0) idx = pool.findIndex(function (t) { return t === 'any'; });
                if (idx < 0) return false;
                pool.splice(idx, 1);
            }
            return true;
        }

        // ---------------------------------------------------------------
        // Ejecutar una acción
        // ---------------------------------------------------------------
        fail(message) {
            return { ok: false, error: message || 'Acción no válida' };
        }

        takeFromHand(key, cardUid) {
            const p = this.player(key);
            const idx = p.hand.findIndex(function (c) { return c.uid === cardUid; });
            if (idx < 0) return null;
            return p.hand.splice(idx, 1)[0];
        }

        applyAction(action, actorKey) {
            if (!action) return this.fail();
            if (action.type === 'answer') return this.resolvePrompt(action);
            if (this.winner) return this.fail('La partida ya terminó');
            const key = actorKey || this.turn;
            if (key !== this.turn) return this.fail('No es tu turno');
            const p = this.player(key);

            if (action.type === 'nextPhase') {
                this.nextPhase();
                return { ok: true };
            }
            if (action.type === 'endTurn') {
                this.pushLog(p.name + ' termina su turno.', 'phase');
                this.endTurn();
                return { ok: true };
            }

            if (this.chain.length || this.pendingResponse) return this.fail('Hay una cadena pendiente');
            if (this.isPokemon) return this.applyPokemonAction(action, key);
            return this.applyYgoAction(action, key);
        }

        applyYgoAction(action, key) {
            const p = this.player(key);
            switch (action.type) {
                case 'summon':
                case 'set': {
                    const card = p.hand.find(function (c) { return c.uid === action.cardUid; });
                    if (!card) return this.fail('Carta no encontrada');
                    if (!isMonster(card)) return this.fail('Solo se invocan monstruos');
                    if (p.normalSummonUsed) return this.fail('Ya invocaste este turno');
                    const tributes = this.tributesNeeded(card);
                    if (this.monsterCountOf(key) < tributes) return this.fail('Faltan tributos');
                    if (tributes) this.tributeMonsters(key, tributes);
                    this.takeFromHand(key, action.cardUid);
                    const faceDown = action.type === 'set';
                    const position = faceDown ? 'def' : (action.position || 'atk');
                    const slotIndex = this.setMonster(key, card, null, position, faceDown);
                    p.normalSummonUsed = true;
                    this.pushLog(p.name + (faceDown ? ' coloca boca abajo ' : ' invoca en ' + (position === 'atk' ? 'ataque' : 'defensa') + ' a ') + card.name + '.', p.isAI ? 'ai' : 'pc');
                    if (!faceDown) this.maybeTrapHole(key, slotIndex);
                    return { ok: true, focus: card.uid };
                }
                case 'activate': {
                    const card = this.takeFromHand(key, action.cardUid);
                    if (!card) return this.fail('Carta no válida');
                    const eff = effectFor(card);
                    if (!eff) {
                        p.grave.push(card);
                        this.pushLog(p.name + ' activa ' + card.name + '.', p.isAI ? 'ai' : 'pc');
                        return { ok: true };
                    }
                    this.startChain({ owner: key, card: card, effect: eff, kind: 'activate' });
                    return { ok: true, focus: card.uid };
                }
                case 'setSpell': {
                    const card = this.takeFromHand(key, action.cardUid);
                    if (!card) return this.fail('Carta no válida');
                    card.faceDown = true;
                    this.setSpell(key, card, null);
                    this.pushLog(p.name + ' coloca una carta boca abajo.', p.isAI ? 'ai' : 'pc');
                    return { ok: true };
                }
                case 'attack':
                case 'attackDirect': {
                    if (this.phase !== 'BP') return this.fail('Debes estar en la Fase de Batalla');
                    const slot = p.monsters[action.slotIndex];
                    if (!slot) return this.fail('Monstruo no encontrado');
                    if (slot.attacked || slot.faceDown || slot.position !== 'atk') return this.fail('Ese monstruo no puede atacar');
                    slot.attacked = true;
                    const attackInfo = {
                        attackerKey: key,
                        slotIndex: action.slotIndex,
                        direct: action.type === 'attackDirect',
                        targetKey: this.opponentOf(key),
                        targetIndex: action.targetIndex
                    };
                    this.pushLog(p.name + ' declara ataque con ' + slot.card.name + '.', p.isAI ? 'ai' : 'pc');
                    this.startChain({ owner: key, card: null, effect: null, kind: 'attack', attack: attackInfo });
                    return { ok: true };
                }
                default:
                    return this.fail('Acción desconocida');
            }
        }

        applyPokemonAction(action, key) {
            const p = this.player(key);
            switch (action.type) {
                case 'attachEnergy': {
                    if (p.energyAttached) return this.fail('Ya uniste una energía este turno');
                    const card = this.takeFromHand(key, action.cardUid);
                    if (!card) return this.fail('Energía no válida');
                    const energy = { card: card, energyType: energyTypeOf(card) };
                    if (action.target === 'active') {
                        if (!p.active) return this.fail('No hay Activo');
                        p.active.energies.push(energy);
                    } else {
                        const slot = p.bench[action.benchIndex];
                        if (!slot) return this.fail('Banca vacía');
                        slot.energies.push(energy);
                    }
                    p.energyAttached = true;
                    this.pushLog(p.name + ' une ' + card.name + '.', p.isAI ? 'ai' : 'pc');
                    return { ok: true, focus: card.uid };
                }
                case 'playBasicActive': {
                    if (p.active) return this.fail('Ya tienes un Activo');
                    const card = this.takeFromHand(key, action.cardUid);
                    if (!card) return this.fail('Carta no válida');
                    p.active = { card: card, energies: [], damage: 0, tools: [], justPlayed: true };
                    this.pushLog(p.name + ' pone a ' + card.name + ' como Activo.', p.isAI ? 'ai' : 'pc');
                    return { ok: true, focus: card.uid };
                }
                case 'playBasicBench': {
                    const card = this.takeFromHand(key, action.cardUid);
                    if (!card) return this.fail('Carta no válida');
                    if (p.bench[action.benchIndex]) return this.fail('Banca ocupada');
                    p.bench[action.benchIndex] = { card: card, energies: [], damage: 0, tools: [], justPlayed: true };
                    this.pushLog(p.name + ' pone a ' + card.name + ' en la Banca.', p.isAI ? 'ai' : 'pc');
                    return { ok: true, focus: card.uid };
                }
                case 'evolve': {
                    const targetSlot = action.target === 'active' ? p.active : p.bench[action.benchIndex];
                    if (!targetSlot) return this.fail('Sin objetivo para evolucionar');
                    const card = p.hand.find(function (c) { return c.uid === action.cardUid; });
                    if (!card) return this.fail('Carta no válida');
                    if (!this.canEvolveSlot(targetSlot, card)) return this.fail('Esa evolución no aplica');
                    this.takeFromHand(key, action.cardUid);
                    const old = targetSlot.card;
                    p.discard.push(old);
                    targetSlot.card = card;
                    targetSlot.justEvolved = true;
                    targetSlot.justPlayed = true;
                    this.pushLog(p.name + ' evoluciona ' + old.name + ' a ' + card.name + '.', p.isAI ? 'ai' : 'pc');
                    return { ok: true, focus: card.uid };
                }
                case 'playTrainer': {
                    const card = p.hand.find(function (c) { return c.uid === action.cardUid; });
                    if (!card) return this.fail('Carta no válida');
                    const eff = effectFor(card);
                    if (!eff) return this.fail('Ese entrenador no tiene efecto');
                    if (card.meta.isSupporter && p.supporterPlayed) return this.fail('Ya usaste un Partidario');
                    this.takeFromHand(key, action.cardUid);
                    if (card.meta.isSupporter) p.supporterPlayed = true;
                    this.pushLog(p.name + ' usa ' + card.name + ' (' + eff.desc + ').', p.isAI ? 'ai' : 'pc');
                    eff.run(this, { owner: key, card: card });
                    p.discard.push(card);
                    this.checkPokemonVictory();
                    return { ok: true, focus: card.uid };
                }
                case 'retreat': {
                    if (!p.active) return this.fail('No hay Activo');
                    if (p.retreatedThisTurn) return this.fail('Solo puedes retirar una vez por turno');
                    const cost = p.active.card.meta.retreat || 0;
                    if (p.active.energies.length < cost) return this.fail('Energías insuficientes');
                    const target = p.bench[action.benchIndex];
                    if (!target) return this.fail('Banca vacía');
                    p.active.energies.splice(0, cost);
                    const old = p.active;
                    p.active = target;
                    p.bench[action.benchIndex] = old;
                    p.active.justPlayed = false;
                    p.retreatedThisTurn = true;
                    this.pushLog(p.name + ' retira a ' + old.card.name + ' y entra ' + p.active.card.name + '.', p.isAI ? 'ai' : 'pc');
                    return { ok: true };
                }
                case 'attackPokemon':
                    return this.resolvePokemonAttack(key, action);
                default:
                    return this.fail('Acción desconocida');
            }
        }

        // ---------------------------------------------------------------
        // Cadenas (Yu-Gi-Oh!)
        // ---------------------------------------------------------------
        startChain(root) {
            this.chain = [root];
            this.chainOpen = true;
            this.resolveChainWindow(this.opponentOf(root.owner));
        }

        chainCanRespond(playerKey) {
            if (!this.chainOpen) return [];
            const root = this.chain[0];
            if (!root) return [];
            const p = this.player(playerKey);
            const out = [];
            const context = root.kind;
            p.spells.forEach(function (slot, index) {
                if (!slot || !slot.faceDown) return;
                const eff = effectFor(slot.card);
                if (!eff) return;
                if (context === 'attack' && eff.trigger !== 'attack') return;
                if (context !== 'attack' && eff.trigger && eff.trigger !== context) return;
                if (context !== 'attack' && !eff.trigger) return;
                if (slot.setTurn === undefined) return;
                out.push({ kind: 'set', slotIndex: index, card: slot.card, effect: eff });
            });
            return out;
        }

        resolveChainWindow(nextPlayerKey) {
            const self = this;
            let responder = nextPlayerKey;
            let guard = 0;
            const step = function () {
                guard += 1;
                if (guard > 12 || !self.chainOpen) { self.resolveChain(); return; }
                const options = self.chainCanRespond(responder);
                if (!options.length) { self.resolveChain(); return; }
                if (self.player(responder).isAI) {
                    const choice = AIBrain.prototype.chooseResponse.call(new AIBrain(self, responder), options, self.chain[0].kind);
                    if (choice) {
                        self.pushChainedResponse(responder, choice);
                        responder = self.opponentOf(responder);
                        step();
                        return;
                    }
                    self.resolveChain();
                    return;
                }
                self.pendingResponse = { player: responder, options: options, chainType: self.chain[0].kind };
            };
            step();
        }

        pushChainedResponse(playerKey, choice) {
            const p = this.player(playerKey);
            const slot = p.spells[choice.slotIndex];
            if (!slot) return;
            p.spells[choice.slotIndex] = null;
            p.grave.push(slot.card);
            this.chain.push({ owner: playerKey, card: slot.card, effect: choice.effect, kind: 'response' });
            this.pushLog('⛓ ' + p.name + ' encadena ' + slot.card.name + '.', p.isAI ? 'ai' : 'pc');
        }

        respondChain(playerKey, cardUid) {
            if (!this.pendingResponse || this.pendingResponse.player !== playerKey) return this.fail();
            const option = this.pendingResponse.options.find(function (o) { return o.card.uid === cardUid; });
            if (!option) return this.fail();
            this.pendingResponse = null;
            this.pushChainedResponse(playerKey, option);
            this.resolveChainWindow(this.opponentOf(playerKey));
            return { ok: true };
        }

        passChain(playerKey) {
            if (!this.pendingResponse || this.pendingResponse.player !== playerKey) return this.fail();
            this.pendingResponse = null;
            this.resolveChain();
            return { ok: true };
        }

        resolveChain() {
            const chain = this.chain.slice();
            const root = chain[0];
            this.chain = [];
            this.chainOpen = false;
            this.pendingResponse = null;
            const ctx = { owner: root ? root.owner : this.turn };

            for (let i = chain.length - 1; i >= 1; i--) {
                const entry = chain[i];
                if (entry && entry.effect && entry.effect.run) {
                    try {
                        entry.effect.run(this, { owner: entry.owner, card: entry.card, root: root });
                    } catch (e) {
                        this.pushLog('Un efecto no pudo resolverse.', 'sys');
                    }
                }
            }

            if (root) {
                if (root.kind === 'attack' && root.attack) {
                    this.resolveYgoAttack(root.attack);
                } else if (root.kind === 'activate' && root.effect) {
                    try {
                        root.effect.run(this, ctx);
                    } catch (e) {
                        this.pushLog('La carta no pudo resolverse.', 'sys');
                    }
                    const p = this.player(root.owner);
                    if (root.card) this.toGrave(root.owner, root.card);
                    this.pushLog('Se resuelve ' + (root.card ? root.card.name : 'el efecto') + '.', root.owner === 'p1' ? 'pc' : 'ai');
                }
            }

            this.checkYgoVictory();
            return { ok: true };
        }

        // ---------------------------------------------------------------
        // Batalla Yu-Gi-Oh!
        // ---------------------------------------------------------------
        resolveYgoAttack(attack) {
            if (this.attackNegated) {
                this.attackNegated = false;
                this.pushLog('El ataque fue negado.', 'battle');
                return;
            }
            const attackerP = this.player(attack.attackerKey);
            const attackerSlot = attackerP.monsters[attack.slotIndex];
            if (!attackerSlot) return;
            const attacker = attackerSlot.card;
            const atkValue = cardAtk(attacker);
            const defenderKey = attack.targetKey;
            const defenderP = this.player(defenderKey);

            if (attack.direct) {
                if (this.reflectedDamage) {
                    attackerP.lp = Math.max(0, attackerP.lp - this.reflectedDamage);
                    this.pushLog('El daño fue reflejado: ' + attackerP.name + ' recibe ' + this.reflectedDamage + '.', 'battle');
                    this.reflectedDamage = 0;
                    this.checkYgoVictory();
                    return;
                }
                defenderP.lp = Math.max(0, defenderP.lp - atkValue);
                this.pushLog(attacker.name + ' inflige ' + atkValue + ' de daño directo a ' + defenderP.name + '.', 'battle');
                this.checkYgoVictory();
                return;
            }

            const defenderSlot = defenderP.monsters[attack.targetIndex];
            if (!defenderSlot) {
                this.resolveYgoAttack({ attackerKey: attack.attackerKey, slotIndex: attack.slotIndex, direct: true, targetKey: defenderKey });
                return;
            }

            if (defenderSlot.faceDown) {
                defenderSlot.faceDown = false;
                defenderSlot.card.faceDown = false;
                this.pushLog('Se revela ' + defenderSlot.card.name + '.', 'battle');
            }

            if (this.reflectedDamage) {
                attackerP.lp = Math.max(0, attackerP.lp - this.reflectedDamage);
                this.pushLog('El daño fue reflejado: ' + attackerP.name + ' recibe ' + this.reflectedDamage + '.', 'battle');
                this.reflectedDamage = 0;
                this.checkYgoVictory();
                return;
            }

            const defender = defenderSlot.card;

            if (defenderSlot.position === 'def') {
                const defValue = cardDef(defender);
                this.pushLog('Batalla: ' + attacker.name + ' (' + atkValue + ') vs ' + defender.name + ' (DEF ' + defValue + ').', 'battle');
                if (atkValue > defValue) {
                    this.toGrave(defenderKey, defender);
                    defenderP.monsters[attack.targetIndex] = null;
                    this.pushLog(defender.name + ' es destruido. No hay daño de batalla.', 'battle');
                } else if (atkValue < defValue) {
                    const dmg = defValue - atkValue;
                    attackerP.lp = Math.max(0, attackerP.lp - dmg);
                    this.pushLog(attacker.name + ' es repelido y ' + attackerP.name + ' recibe ' + dmg + ' de daño.', 'battle');
                } else {
                    this.pushLog('Empate: ninguna carta es destruida.', 'battle');
                }
                this.checkYgoVictory();
                return;
            }

            const defValue = cardAtk(defender);
            this.pushLog('Batalla: ' + attacker.name + ' (' + atkValue + ') vs ' + defender.name + ' (' + defValue + ').', 'battle');
            if (atkValue > defValue) {
                this.toGrave(defenderKey, defender);
                defenderP.monsters[attack.targetIndex] = null;
                const dmg = atkValue - defValue;
                if (dmg > 0) {
                    defenderP.lp = Math.max(0, defenderP.lp - dmg);
                    this.pushLog(defender.name + ' es destruido y ' + defenderP.name + ' recibe ' + dmg + '.', 'battle');
                }
            } else if (atkValue < defValue) {
                this.toGrave(attack.attackerKey, attacker);
                attackerP.monsters[attack.slotIndex] = null;
                const dmg = defValue - atkValue;
                attackerP.lp = Math.max(0, attackerP.lp - dmg);
                this.pushLog(attacker.name + ' es destruido y ' + attackerP.name + ' recibe ' + dmg + '.', 'battle');
            } else {
                this.toGrave(defenderKey, defender);
                defenderP.monsters[attack.targetIndex] = null;
                this.toGrave(attack.attackerKey, attacker);
                attackerP.monsters[attack.slotIndex] = null;
                this.pushLog('Ambos monstruos son destruidos.', 'battle');
            }
            this.checkYgoVictory();
        }

        tributeMonsters(key, count) {
            const p = this.player(key);
            const self = this;
            const options = p.monsters
                .map(function (slot, i) { return { slot: slot, i: i }; })
                .filter(function (x) { return x.slot; })
                .sort(function (a, b) { return cardAtk(a.slot.card) - cardAtk(b.slot.card); });
            for (let i = 0; i < count && i < options.length; i++) {
                const entry = options[i];
                p.monsters[entry.i] = null;
                self.toGrave(key, entry.slot.card);
                self.pushLog('Tributa ' + entry.slot.card.name + '.', 'sys');
            }
        }

        maybeTrapHole(key, slotIndex) {
            const opp = this.opponentOf(key);
            const options = this.chainCanRespond(opp);
            if (!options.length) return;
            this.chain = [{ owner: key, card: null, effect: null, kind: 'summon' }];
            this.chainOpen = true;
            this._summonContext = { summonedKey: key, slotIndex: slotIndex };
            this.resolveChainWindow(opp);
        }

        // ---------------------------------------------------------------
        // Batalla Pokémon
        // ---------------------------------------------------------------
        resolvePokemonAttack(key, action) {
            const p = this.player(key);
            const attackerSlot = p.active;
            if (!attackerSlot) return this.fail('No hay Activo');
            if (p.attackedThisTurn) return this.fail('Ya atacaste este turno');
            if (attackerSlot.justPlayed) return this.fail('Ese Pokémon acaba de entrar');
            const atk = (attackerSlot.card.meta.attacks || [])[action.attackIndex];
            if (!atk) return this.fail('Ataque no válido');
            if (!this.canPayAttack(attackerSlot, atk)) return this.fail('No tienes la energía necesaria');
            p.attackedThisTurn = true;

            const opp = this.player(this.opponentOf(key));
            const target = opp.active;
            this.pushLog(p.name + ' usa ' + atk.name + ' con ' + attackerSlot.card.name + '.', p.isAI ? 'ai' : 'pc');

            let damage = numericDamage(atk.damage);
            let targetWeakness = false;
            if (target) {
                const weak = target.card.meta.weakness;
                if (weak && weak.type && (attackerSlot.card.meta.types || []).some(function (t) { return norm(t) === norm(weak.type); })) {
                    damage = damage * 2;
                    targetWeakness = true;
                }
                const res = target.card.meta.resistance;
                if (res && res.type && (attackerSlot.card.meta.types || []).some(function (t) { return norm(t) === norm(res.type); })) {
                    damage = Math.max(0, damage - 30);
                }
            }

            if (damage > 0) {
                if (target) {
                    target.damage += damage;
                    this.pushLog(attackerSlot.card.name + ' inflige ' + damage + ' de daño' + (targetWeakness ? ' (¡debilidad!)' : '') + ' a ' + target.card.name + '.', 'battle');
                } else {
                    this.takePrizes(this.opponentOf(key), 1);
                    this.pushLog('¡Ataque directo! ' + p.name + ' toma 1 premio.', 'battle');
                }
            } else {
                this.pushLog('El ataque no causó daño.', 'battle');
            }

            if (target && target.damage >= (target.card.meta.hp || 0)) {
                this.knockOut(this.opponentOf(key), 'active');
            }
            this.checkPokemonVictory();
            return { ok: true, focus: attackerSlot.card.uid };
        }

        knockOut(playerKey, zone) {
            const p = this.player(playerKey);
            const slot = zone === 'active' ? p.active : p.bench[zone];
            if (!slot) return;
            const card = slot.card;
            const prizeCount = this.isPokemonEx(card) ? 2 : 1;
            this.pushLog(card.name + ' queda fuera de combate.', 'battle');
            p.discard.push(card);
            slot.energies.forEach(function (e) { p.discard.push(e.card); });
            if (zone === 'active') {
                p.active = null;
                this.takePrizes(this.opponentOf(playerKey), prizeCount);
                this.promoteBench(playerKey);
            } else {
                p.bench[zone] = null;
                this.takePrizes(this.opponentOf(playerKey), prizeCount);
            }
        }

        isPokemonEx(card) {
            const n = norm(card.name);
            const sub = (card.meta.subtypes || []).map(norm);
            return / ex$/.test(n) || sub.indexOf('ex') >= 0 || sub.indexOf('v') >= 0 || sub.indexOf('vmax') >= 0;
        }

        promoteBench(playerKey) {
            const p = this.player(playerKey);
            if (p.active) return;
            const idx = p.bench.findIndex(Boolean);
            if (idx >= 0) {
                p.active = p.bench[idx];
                p.bench[idx] = null;
                p.active.justPlayed = false;
                this.pushLog(p.name + ' promueve a ' + p.active.card.name + ' como Activo.', 'sys');
            }
        }

        takePrizes(playerKey, count) {
            const p = this.player(playerKey);
            for (let i = 0; i < count; i++) {
                if (!p.prizes.length) break;
                p.hand.push(p.prizes.shift());
                p.prizesTaken += 1;
            }
            if (p.prizesTaken >= 6) this.declareWinner(playerKey, 'tomó los 6 premios');
        }

        // ---------------------------------------------------------------
        // Efectos
        // ---------------------------------------------------------------
        destroyAllMonsters() {
            const self = this;
            ['p1', 'p2'].forEach(function (k) {
                const p = self.player(k);
                p.monsters.forEach(function (slot, i) {
                    if (slot) {
                        self.toGrave(k, slot.card);
                        p.monsters[i] = null;
                    }
                });
            });
            this.pushLog('Todos los monstruos son destruidos.', 'sys');
        }

        destroyWeakestOpponentMonster(ownerKey, stat) {
            const opp = this.player(this.opponentOf(ownerKey));
            const entries = opp.monsters.map(function (s, i) { return { s: s, i: i }; }).filter(function (x) { return x.s; });
            if (!entries.length) {
                this.pushLog('No hay monstruos rivales que destruir.', 'sys');
                return;
            }
            entries.sort(function (a, b) {
                const va = stat === 'def' ? cardDef(a.s.card) : cardAtk(a.s.card);
                const vb = stat === 'def' ? cardDef(b.s.card) : cardAtk(b.s.card);
                return va - vb;
            });
            const target = entries[0];
            this.toGrave(opp.key, target.s.card);
            opp.monsters[target.i] = null;
            this.pushLog(target.s.card.name + ' es destruido.', 'sys');
        }

        destroyStrongestOpponentMonster(ownerKey, stat) {
            const opp = this.player(this.opponentOf(ownerKey));
            const entries = opp.monsters.map(function (s, i) { return { s: s, i: i }; }).filter(function (x) { return x.s; });
            if (!entries.length) {
                this.pushLog('No hay monstruos rivales que destruir.', 'sys');
                return;
            }
            entries.sort(function (a, b) {
                const va = stat === 'def' ? cardDef(a.s.card) : cardAtk(a.s.card);
                const vb = stat === 'def' ? cardDef(b.s.card) : cardAtk(b.s.card);
                return vb - va;
            });
            const target = entries[0];
            this.toGrave(opp.key, target.s.card);
            opp.monsters[target.i] = null;
            this.pushLog(target.s.card.name + ' es destruido.', 'sys');
        }

        destroyOpponentBackrow(ownerKey) {
            const opp = this.player(this.opponentOf(ownerKey));
            const idx = opp.spells.findIndex(Boolean);
            if (idx < 0) {
                this.pushLog('No hay Magia/Trampa rival que destruir.', 'sys');
                return;
            }
            const card = opp.spells[idx].card;
            opp.spells[idx] = null;
            this.toGrave(opp.key, card);
            this.pushLog(card.name + ' es destruida.', 'sys');
        }

        reviveMonster(ownerKey) {
            const p = this.player(ownerKey);
            const idx = p.grave.findIndex(function (c) { return isMonster(c); });
            if (idx < 0) {
                this.pushLog('No hay monstruos en el cementerio.', 'sys');
                return;
            }
            const card = p.grave.splice(idx, 1)[0];
            const free = p.monsters.findIndex(function (s) { return !s; });
            if (free < 0) {
                p.grave.push(card);
                this.pushLog('No hay zona libre para revivir.', 'sys');
                return;
            }
            p.monsters[free] = { card: card, position: 'atk', faceDown: false, attacked: false, turnsOnField: 0 };
            this.pushLog(card.name + ' revive desde el cementerio.', 'sys');
        }

        takeControl(ownerKey) {
            const opp = this.player(this.opponentOf(ownerKey));
            const entries = opp.monsters.map(function (s, i) { return { s: s, i: i }; }).filter(function (x) { return x.s; });
            if (!entries.length) {
                this.pushLog('No hay monstruos para controlar.', 'sys');
                return;
            }
            entries.sort(function (a, b) { return cardAtk(b.s.card) - cardAtk(a.s.card); });
            const target = entries[0];
            const p = this.player(ownerKey);
            const free = p.monsters.findIndex(function (s) { return !s; });
            if (free < 0) {
                this.pushLog('No hay zona libre para tomar el control.', 'sys');
                return;
            }
            p.monsters[free] = target.s;
            opp.monsters[target.i] = null;
            this.takenControl.push({ cardUid: target.s.card.uid, from: opp.key, owner: ownerKey, slotIndex: free });
            this.pushLog(target.s.card.name + ' pasa a ser controlado por ' + p.name + ' este turno.', 'sys');
        }

        effectMirrorForce() {
            const root = this.chain[0];
            if (!root || !root.attack || root.attack.direct) return;
            const defenderP = this.player(root.attack.targetKey);
            const entries = defenderP.monsters.map(function (s, i) { return { s: s, i: i }; }).filter(function (x) { return x.s; });
            if (!entries.length) return;
            this.attackNegated = true;
            entries.forEach(function (e) {
                this.toGrave(defenderP.key, e.s.card);
                defenderP.monsters[e.i] = null;
            }, this);
            this.pushLog('¡Fuerza de Espejo destruye a los atacantes!', 'sys');
        }

        effectMagicCylinder() {
            const root = this.chain[0];
            if (!root || !root.attack) return;
            const attackerP = this.player(root.attack.attackerKey);
            const slot = attackerP.monsters[root.attack.slotIndex];
            this.attackNegated = true;
            const dmg = slot ? cardAtk(slot.card) : 1000;
            attackerP.lp = Math.max(0, attackerP.lp - dmg);
            this.pushLog('¡Cilindro Mágico refleja ' + dmg + ' de daño!', 'sys');
            this.checkYgoVictory();
        }

        effectNegateAttack() {
            this.attackNegated = true;
            this.pushLog('¡El ataque es negado!', 'sys');
        }

        effectSakuretsu() {
            const root = this.chain[0];
            if (!root || !root.attack) return;
            const attackerP = this.player(root.attack.attackerKey);
            const slot = attackerP.monsters[root.attack.slotIndex];
            this.attackNegated = true;
            if (slot) {
                this.toGrave(attackerP.key, slot.card);
                attackerP.monsters[root.attack.slotIndex] = null;
                this.pushLog('¡Armadura Sakuretsu destruye al atacante ' + slot.card.name + '!', 'sys');
            }
        }

        effectTrapHole() {
            const ctx = this._summonContext;
            if (!ctx) return;
            const p = this.player(ctx.summonedKey);
            const slot = p.monsters[ctx.slotIndex];
            if (!slot) return;
            if (cardAtk(slot.card) < 1000) return;
            this.toGrave(ctx.summonedKey, slot.card);
            p.monsters[ctx.slotIndex] = null;
            this.pushLog('¡Agujero Trampa destruye a ' + slot.card.name + '!', 'sys');
        }

        effectCompulsory(ownerKey) {
            const opp = this.player(this.opponentOf(ownerKey));
            const entries = opp.monsters.map(function (s, i) { return { s: s, i: i }; }).filter(function (x) { return x.s; });
            if (!entries.length) return;
            entries.sort(function (a, b) { return cardAtk(b.s.card) - cardAtk(a.s.card); });
            const target = entries[0];
            opp.monsters[target.i] = null;
            opp.hand.push(target.s.card);
            this.pushLog(target.s.card.name + ' vuelve a la mano.', 'sys');
        }

        // ---------------------------------------------------------------
        // Búsquedas Pokémon
        // ---------------------------------------------------------------
        searchBasicToHand(ownerKey) {
            const p = this.player(ownerKey);
            const idx = p.deck.findIndex(function (c) { return isPokemon(c) && c.meta.stage === 'basic'; });
            if (idx < 0) return;
            p.hand.push(p.deck.splice(idx, 1)[0]);
            this.pushLog(p.name + ' busca un Pokémon básico.', 'sys');
        }

        searchBasicToBench(ownerKey) {
            const p = this.player(ownerKey);
            const free = p.bench.findIndex(function (s) { return !s; });
            const idx = p.deck.findIndex(function (c) { return isPokemon(c) && c.meta.stage === 'basic'; });
            if (idx < 0 || free < 0) return;
            const card = p.deck.splice(idx, 1)[0];
            p.bench[free] = { card: card, energies: [], damage: 0, tools: [], justPlayed: true };
            this.pushLog(p.name + ' pone a ' + card.name + ' en la Banca.', 'sys');
        }

        switchActive(ownerKey) {
            const p = this.player(ownerKey);
            const idx = p.bench.findIndex(Boolean);
            if (idx < 0 || !p.active) return;
            const old = p.active;
            p.active = p.bench[idx];
            p.bench[idx] = old;
            p.active.justPlayed = false;
            this.pushLog(p.name + ' cambia a ' + p.active.card.name + ' como Activo.', 'sys');
        }

        bossOrders(ownerKey) {
            const opp = this.player(this.opponentOf(ownerKey));
            const idx = opp.bench.findIndex(Boolean);
            if (idx < 0 || !opp.active) return;
            const old = opp.active;
            opp.active = opp.bench[idx];
            opp.bench[idx] = old;
            opp.active.justPlayed = false;
            this.pushLog('El Activo rival es cambiado por ' + opp.active.card.name + '.', 'sys');
        }

        healActive(ownerKey, amount) {
            const p = this.player(ownerKey);
            if (!p.active) return;
            p.active.damage = Math.max(0, p.active.damage - amount);
            this.pushLog(p.active.card.name + ' recupera ' + amount + ' de daño.', 'sys');
        }

        resolvePrompt(action) {
            return { ok: false, error: 'No hay pregunta pendiente' };
        }
    }

    // -------------------------------------------------------------------
    // IA
    // -------------------------------------------------------------------
    class AIBrain {
        constructor(game, key) {
            this.game = game;
            this.key = key;
            this.opponentKey = game.opponentOf(key);
        }

        chooseResponse(options, contextType) {
            const g = this.game;
            const threatening = contextType === 'attack' || contextType === 'summon';
            if (!threatening) return null;
            let best = null;
            let bestScore = 0;
            const self = this;
            options.forEach(function (opt) {
                const score = self.responseScore(opt, contextType);
                if (score > bestScore) { bestScore = score; best = opt; }
            });
            if (bestScore <= 0) return null;
            const diff = g.difficulty;
            if (diff === 'easy' && g.rng() < 0.45) return null;
            return best;
        }

        responseScore(opt, contextType) {
            const g = this.game;
            const name = norm(opt.card.name);
            const root = g.chain[0];
            if (contextType === 'attack' && root && root.attack) {
                const attackerP = g.player(root.attack.attackerKey);
                const attackerSlot = attackerP.monsters[root.attack.slotIndex];
                const atk = attackerSlot ? cardAtk(attackerSlot.card) : 0;
                if (name === 'mirror force' || name === 'negate attack' || name === 'magic cylinder' || name === 'sakuretsu armor') {
                    const mine = g.monsterSlots(this.key).length;
                    if (root.attack.direct) return atk >= 1500 ? 60 : 20;
                    return 40 + Math.min(40, atk / 100) + (mine > 1 && name === 'mirror force' ? 20 : 0);
                }
                return 0;
            }
            if (contextType === 'summon') {
                if (name === 'trap hole') {
                    const ctx = g._summonContext;
                    if (!ctx) return 0;
                    const slot = g.player(ctx.summonedKey).monsters[ctx.slotIndex];
                    return slot && cardAtk(slot.card) >= 1500 ? 55 : 12;
                }
                return 0;
            }
            return 0;
        }

        // Devuelve la siguiente acción a ejecutar de la IA
        chooseAction() {
            const g = this.game;
            if (g.winner) return null;
            if (g.turn !== this.key) return null;
            const actions = g.getActions(this.key);
            if (!actions.length) return null;

            const p = g.player(this.key);
            if (g.isPokemon) return this.choosePokemonAction(actions);
            return this.chooseYgoAction(actions);
        }

        chooseYgoAction(actions) {
            const g = this.game;
            const p = g.player(this.key);
            const phase = g.phase;
            const diff = g.difficulty;

            if (phase === 'DP' || phase === 'SP') {
                const next = actions.find(function (a) { return a.type === 'nextPhase'; });
                return next || actions.find(function (a) { return a.type === 'endTurn'; });
            }

            if (phase === 'M1' || phase === 'M2') {
                // 1) Activar magias de robo/ventaja primero
                const spellActions = actions.filter(function (a) { return a.type === 'activate'; });
                if (spellActions.length) {
                    const bestSpell = this.pickBestSpell(spellActions);
                    if (bestSpell) return bestSpell;
                }
                // 2) Colocar trampas si no hay backrow suficiente
                const setSpellActions = actions.filter(function (a) { return a.type === 'setSpell'; });
                const backrow = p.spells.filter(Boolean).length;
                if (setSpellActions.length && backrow < 3 && diff !== 'easy') return setSpellActions[0];

                // 3) Invocar el mejor monstruo
                const summonActions = actions.filter(function (a) { return a.group === 'summon' && a.type === 'summon'; });
                if (summonActions.length) {
                    const best = this.pickBestSummon(summonActions);
                    if (best) return best;
                }
                // 4) Fase de batalla si hay atacantes útiles
                const canAttack = g.monsterSlots(this.key).some(function (e) { return !e.slot.faceDown && e.slot.position === 'atk' && !e.slot.attacked; });
                if (canAttack && phase === 'M1') {
                    const next = actions.find(function (a) { return a.type === 'nextPhase' && /Batalla/.test(a.label); });
                    if (next) return next;
                }
                const nextPhase = actions.find(function (a) { return a.type === 'nextPhase'; });
                if (nextPhase) return nextPhase;
                return actions.find(function (a) { return a.type === 'endTurn'; });
            }

            if (phase === 'BP') {
                const attacks = actions.filter(function (a) { return a.group === 'attack'; });
                if (attacks.length) {
                    const choice = this.pickBestAttack(attacks);
                    if (choice) return choice;
                }
                const next = actions.find(function (a) { return a.type === 'nextPhase'; });
                return next || actions.find(function (a) { return a.type === 'endTurn'; });
            }

            return actions.find(function (a) { return a.type === 'endTurn'; });
        }

        pickBestSpell(spellActions) {
            const g = this.game;
            const opp = g.player(this.opponentKey);
            const myMonsters = g.monsterSlots(this.key).length;
            const oppMonsters = g.monsterSlots(this.opponentKey).length;
            let best = null;
            let bestScore = 0;
            spellActions.forEach(function (a) {
                const card = g.player('p1').hand.concat(g.player('p2').hand).find(function (c) { return c.uid === a.cardUid; });
                if (!card) return;
                const n = norm(card.name);
                let score = 0;
                if (n === 'pot of greed' || n === 'graceful charity' || n === 'card of sanctity') score = 90;
                else if (n === 'dark hole' && oppMonsters > myMonsters) score = 85;
                else if (n === 'fissure' || n === 'smashing ground') score = oppMonsters > 0 ? 60 : 0;
                else if (n === 'mystical space typhoon') score = opp.spells.filter(Boolean).length ? 50 : 0;
                else if (n === 'monster reborn') score = 45;
                else if (n === 'change of heart') score = oppMonsters > 0 ? 40 : 0;
                else score = 10;
                if (score > bestScore) { bestScore = score; best = a; }
            });
            return bestScore >= 30 ? best : null;
        }

        pickBestSummon(summonActions) {
            const g = this.game;
            let best = null;
            let bestScore = -1;
            summonActions.forEach(function (a) {
                const p = g.player(g.turn);
                const card = p.hand.find(function (c) { return c.uid === a.cardUid; });
                if (!card) return;
                let score = cardAtk(card);
                if (a.position === 'def') score = score * 0.8;
                if (g.difficulty === 'hard') score += cardLevel(card) * 5;
                if (score > bestScore) { bestScore = score; best = a; }
            });
            return best;
        }

        pickBestAttack(attacks) {
            const g = this.game;
            const oppMonsters = g.monsterSlots(this.opponentKey);
            const p = g.player(this.key);
            const diff = g.difficulty;
            const opponentKey = this.opponentKey;
            let best = null;
            let bestValue = -Infinity;

            const candidates = attacks.slice().sort(function (a, b) { return (b.slotIndex || 0) - (a.slotIndex || 0); });

            candidates.forEach(function (a) {
                const mine = p.monsters[a.slotIndex];
                if (!mine) return;
                const myAtk = cardAtk(mine.card);

                if (a.type === 'attackDirect') {
                    const value = 1000 + myAtk;
                    if (value > bestValue) { bestValue = value; best = a; }
                    return;
                }
                const target = g.player(opponentKey).monsters[a.targetIndex];
                if (!target) return;
                const defVal = target.position === 'def' || target.faceDown ? cardDef(target.card) : cardAtk(target.card);
                const hidden = target.faceDown;
                if (myAtk > defVal) {
                    const dmg = target.position === 'def' || target.faceDown ? 0 : (myAtk - defVal);
                    const value = 500 + dmg;
                    if (value > bestValue) { bestValue = value; best = a; }
                } else if (!hidden && defVal - myAtk < 300 && diff === 'hard') {
                    // intercambio aceptable
                    const value = 100 - (defVal - myAtk);
                    if (value > bestValue) { bestValue = value; best = a; }
                } else if (diff === 'easy' && g.rng() < 0.3) {
                    const value = 50;
                    if (value > bestValue) { bestValue = value; best = a; }
                }
            });

            return bestValue > 0 ? best : null;
        }

        choosePokemonAction(actions) {
            const g = this.game;
            const p = g.player(this.key);
            const opp = g.player(this.opponentKey);
            const diff = g.difficulty;

            // 1) Poner básico si no hay Activo
            if (!p.active) {
                const basic = actions.find(function (a) { return a.type === 'playBasicActive'; });
                if (basic) return basic;
            }
            // 2) Energía al Activo si le falta para su mejor ataque
            const energy = this.pickEnergyAction(actions);
            if (energy) return energy;
            // 3) Evolucionar
            const evo = actions.find(function (a) { return a.type === 'evolve' && a.target === 'active'; })
                || actions.find(function (a) { return a.type === 'evolve'; });
            if (evo) return evo;
            // 4) Llenar banca
            const benchCount = p.bench.filter(Boolean).length;
            if (benchCount < 3) {
                const bench = actions.find(function (a) { return a.type === 'playBasicBench'; });
                if (bench) return bench;
            }
            // 5) Entrenadores de robo
            const trainers = actions.filter(function (a) { return a.type === 'playTrainer'; });
            if (trainers.length && diff !== 'easy') {
                const drawTrainer = trainers.find(function (a) {
                    return /research|bill|professor/i.test(a.label);
                });
                if (drawTrainer) return drawTrainer;
            }
            // 6) Atacar
            const attacks = actions.filter(function (a) { return a.type === 'attackPokemon'; });
            if (attacks.length) {
                const best = this.pickBestPokemonAttack(attacks, p, opp);
                if (best) return best;
            }
            // 7) Retirar si el Activo va a caer
            if (p.active) {
                const hpLeft = (p.active.card.meta.hp || 0) - p.active.damage;
                if (hpLeft <= 30) {
                    const retreat = actions.find(function (a) { return a.type === 'retreat'; });
                    if (retreat) return retreat;
                }
            }
            return actions.find(function (a) { return a.type === 'endTurn'; });
        }

        pickEnergyAction(actions) {
            const g = this.game;
            const p = g.player(this.key);
            const energies = actions.filter(function (a) { return a.type === 'attachEnergy' && a.target === 'active'; });
            if (!energies.length || !p.active) return null;
            const attacks = p.active.card.meta.attacks || [];
            const needed = attacks.length ? attacks[attacks.length - 1].cost || [] : [];
            const have = p.active.energies.length;
            if (have < needed.length) return energies[0];
            const benchEnergy = actions.find(function (a) { return a.type === 'attachEnergy' && a.target === 'bench'; });
            return have === 0 ? energies[0] : (benchEnergy || null);
        }

        pickBestPokemonAttack(attacks, p, opp) {
            const self = this;
            let best = null;
            let bestScore = -1;
            attacks.forEach(function (a) {
                const atk = (p.active.card.meta.attacks || [])[a.attackIndex];
                if (!atk) return;
                const dmg = numericDamage(atk.damage);
                const target = opp.active;
                let score = dmg;
                if (target) {
                    const weak = target.card.meta.weakness;
                    if (weak && weak.type && (p.active.card.meta.types || []).some(function (t) { return norm(t) === norm(weak.type); })) score += 60;
                    const remaining = (target.card.meta.hp || 0) - target.damage;
                    if (dmg >= remaining) score += 200;
                }
                if (score > bestScore) { bestScore = score; best = a; }
            });
            return best;
        }
    }

    // -------------------------------------------------------------------
    // Exportación
    // -------------------------------------------------------------------
    window.DuelAIEngine = {
        Game: Game,
        AIBrain: AIBrain,
        effectFor: effectFor,
        norm: norm,
        cardAtk: cardAtk,
        cardDef: cardDef,
        isMonster: isMonster,
        isSpell: isSpell,
        isTrap: isTrap,
        isPokemon: isPokemon,
        isEnergy: isEnergy,
        isTrainer: isTrainer,
        numericDamage: numericDamage,
        energyTypeOf: energyTypeOf,
        YGO_EFFECTS: YGO_EFFECTS,
        POKEMON_TRAINER_EFFECTS: POKEMON_TRAINER_EFFECTS,
        createGame: function (opts) { return new Game(opts); }
    };
})();


