/*
 * VikingDev TCG — Modo Máquina: conocimiento de cartas.
 * Resuelve estadísticas reales (YGOPRODeck / TCGdex) con caché en localStorage.
 * Si la red falla, devuelve metadatos heurísticos para que el duelo nunca se rompa.
 */
(function () {
    'use strict';

    const CACHE_KEY = 'tcg_ai_cardmeta_v4';
    const CACHE_TTL = 1000 * 60 * 60 * 24 * 30;
    const memory = new Map();
    let cache = null;

    function loadCache() {
        if (cache) return cache;
        try {
            cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {};
        } catch (e) {
            cache = {};
        }
        return cache;
    }

    function saveCache() {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        } catch (e) { /* quota llena: se ignora */ }
    }

    function normalizeName(name) {
        return String(name || '')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function stripParens(name) {
        return String(name || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
    }

    function guessGame(card, layout) {
        const img = String(card.image_url || card.img || '').toLowerCase();
        if (img.includes('ygoprodeck') || img.includes('yugioh')) return 'ygo';
        if (img.includes('tcgdex') || img.includes('pokemontcg')) return 'pokemon';
        if (layout === 'pokemon') return 'pokemon';
        return 'ygo';
    }

    function guessYgoKind(name, desc) {
        const text = normalizeName(`${name} ${desc || ''}`);
        if (/trampa|\btrap\b|agujero trampa|cilindro magico|fuerza de espejo|espejo de fuerza|ataque negado|armadura sakuretsu|dispositivo de evacuacion/.test(text)) return 'trap';
        if (/magia|\bspell\b|\bhechizo\b|polimerizacion|olla de la codicia|tifon del espacio|agujero oscuro|fisura|monstruo renacido|cambio de corazon|espadas de luz/.test(text)) return 'spell';
        return 'monster';
    }

    function heuristicYgo(name, desc) {
        const kind = guessYgoKind(name, desc);
        if (kind !== 'monster') {
            return { game: 'ygo', kind, desc: desc || '', heuristic: true };
        }
        const lvlMatch = String(desc || '').match(/level\s*(\d)/i);
        const level = lvlMatch ? Number(lvlMatch[1]) : 4;
        const atkTable = { 1: 500, 2: 800, 3: 1100, 4: 1600, 5: 2000, 6: 2300, 7: 2500, 8: 2800, 9: 3000, 10: 3200 };
        const atk = atkTable[level] || 1600;
        return {
            game: 'ygo', kind: 'monster', level,
            atk, def: Math.round(atk * 0.8),
            attribute: 'EARTH', race: 'Unknown', typeLine: 'Monster',
            desc: desc || '', heuristic: true
        };
    }

    function heuristicPokemon(name, desc) {
        const text = `${name} ${desc || ''}`.toLowerCase();
        if (/\benerg[ií]a\b|\benergy\b/.test(text)) return { game: 'pokemon', kind: 'energy', desc: desc || '', heuristic: true };
        if (/entrenador|\btrainer\b|\bobjeto\b|\bpartidario\b|\b supporter\b/.test(text)) {
            return { game: 'pokemon', kind: 'trainer', isItem: /objeto|item/.test(text), isSupporter: /partidario|supporter/.test(text), desc: desc || '', heuristic: true };
        }
        return {
            game: 'pokemon', kind: 'pokemon', hp: 100, types: ['Colorless'], stage: 'basic',
            attacks: [{ name: 'Ataque', cost: ['Colorless'], damage: 20, text: '' }],
            weakness: null, resistance: null, retreat: 1, desc: desc || '', heuristic: true
        };
    }

    function withTimeout(url, ms) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), ms || 12000);
        return fetch(url, { signal: ctrl.signal })
            .finally(() => clearTimeout(timer));
    }

    function mapYgoApiCard(card) {
        const type = String(card.type || '');
        const isMonster = /monster/i.test(type) && !/spell|trap/i.test(type);
        return {
            game: 'ygo',
            kind: isMonster ? 'monster' : (/trap/i.test(type) ? 'trap' : 'spell'),
            atk: typeof card.atk === 'number' ? card.atk : null,
            def: typeof card.def === 'number' ? card.def : null,
            level: card.level || card.linkval || 0,
            attribute: card.attribute || '',
            race: card.race || '',
            typeLine: type,
            desc: card.desc || '',
            img: (card.card_images && card.card_images[0] && card.card_images[0].image_url) || '',
            apiId: card.id || null,
            apiName: card.name || '',
            subtype: card.humanReadableCardType || type,
            isExtra: /fusion|synchro|xyz|link/i.test(type)
        };
    }

    function mapTcgdexDetail(card) {
        const isPokemon = /pok[eé]mon/i.test(card.category || '');
        if (!isPokemon) {
            const trainerType = String(card.trainerType || card.category || '');
            const energy = /energ/i.test(card.category || '');
            return {
                game: 'pokemon',
                kind: energy ? 'energy' : 'trainer',
                isItem: /objeto|item/i.test(trainerType),
                isSupporter: /partidario|supporter/i.test(trainerType),
                isStadium: /estadio|stadium/i.test(trainerType),
                subtypes: [trainerType].filter(Boolean),
                desc: card.effect || card.description || '',
                img: card.image ? `${card.image}/high.png` : ''
            };
        }
        const stageRaw = String(card.stage || '').toLowerCase();
        const stage = /stage2|fase 2/.test(stageRaw) ? 'stage2' : (/stage1|fase 1/.test(stageRaw) ? 'stage1' : 'basic');
        return {
            game: 'pokemon',
            kind: 'pokemon',
            hp: Number(card.hp) || 100,
            types: card.types || ['Colorless'],
            stage,
            evolvesFrom: card.evolveFrom || null,
            attacks: (card.attacks || []).map(a => ({
                name: a.name || 'Ataque',
                cost: a.cost || [],
                damage: String(a.damage || '0'),
                text: a.effect || ''
            })),
            abilities: (card.abilities || []).map(a => ({ name: a.name, text: a.effect || '' })),
            weakness: card.weaknesses && card.weaknesses[0] ? card.weaknesses[0] : null,
            resistance: card.resistances && card.resistances[0] ? card.resistances[0] : null,
            retreat: card.retreat || 0,
            desc: card.effect || card.description || '',
            img: card.image ? `${card.image}/high.png` : '',
            apiId: card.id || null,
            rarity: card.rarity || ''
        };
    }

    // Las cartas guardadas traen la imagen de YGOPRODeck, cuyo nombre de
    // archivo ES el id de la carta (…/cards/89631139.jpg). Consultar por id
    // resuelve la carta sin depender del idioma del mazo.
    function ygoIdFromCard(card) {
        const url = String((card && (card.image_url || card.img)) || '');
        const match = url.match(/ygoprodeck\.com\/images\/cards\/(\d+)\.(?:jpg|jpeg|png)/i) ||
            url.match(/ygoprodeck\.com\/images\/cards\/[^/]*\/(\d+)\.(?:jpg|jpeg|png)/i);
        return match ? match[1] : null;
    }

    async function fetchYgoMetaById(id) {
        try {
            const res = await withTimeout(`https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${encodeURIComponent(id)}`);
            if (!res.ok) return null;
            const json = await res.json();
            if (!json || !Array.isArray(json.data) || !json.data.length) return null;
            return mapYgoApiCard(json.data[0]);
        } catch (e) {
            return null;
        }
    }

    async function fetchYgoMeta(name) {
        const clean = canonicalName(name);
        const urls = [
            `https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(clean)}`,
            `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(clean)}`
        ];
        for (const url of urls) {
            try {
                const res = await withTimeout(url);
                if (!res.ok) continue;
                const json = await res.json();
                if (!json || !Array.isArray(json.data) || !json.data.length) continue;
                const exact = json.data.find(c => normalizeName(c.name) === normalizeName(clean));
                return mapYgoApiCard(exact || json.data[0]);
            } catch (e) { /* siguiente url */ }
        }
        return null;
    }

    async function fetchPokemonMeta(name) {
        const clean = stripParens(name);
        for (const lang of ['es', 'en']) {
            try {
                const listRes = await withTimeout(`https://api.tcgdex.net/v2/${lang}/cards?name=${encodeURIComponent(clean)}`);
                if (!listRes.ok) continue;
                const list = await listRes.json();
                if (!Array.isArray(list) || !list.length) continue;
                const exact = list.find(c => normalizeName(c.name) === normalizeName(clean) && c.image);
                const chosen = exact || list.find(c => c.image) || list[0];
                if (!chosen || !chosen.id) continue;
                const detailRes = await withTimeout(`https://api.tcgdex.net/v2/${lang}/cards/${chosen.id}`);
                if (!detailRes.ok) continue;
                return mapTcgdexDetail(await detailRes.json());
            } catch (e) { /* siguiente idioma */ }
        }
        return null;
    }

    // Los mazos guardados usan nombres en español ("Fuerza de Espejo",
    // "Tifón del Espacio Místico"), pero las APIs solo entienden el nombre
    // inglés. Sin este mapa la búsqueda falla y la heurística convierte
    // trampas y magias en monstruos 1600/1280: la IA jugaba a ciegas.
    const ES_TO_EN = {
        'dragon blanco de ojos azules': 'Blue-Eyes White Dragon',
        'dragon blanco de ojos azules (alt)': 'Blue-Eyes White Dragon',
        'mago oscuro': 'Dark Magician',
        'chica maga oscura': 'Dark Magician Girl',
        'dragon negro de ojos rojos': 'Red-Eyes Black Dragon',
        'kuriboh': 'Kuriboh',
        'exodia el prohibido': 'Exodia the Forbidden One',
        'polimerizacion': 'Polymerization',
        'fuerza de espejo': 'Mirror Force',
        'tifon del espacio mistiko': 'Mystical Space Typhoon',
        'tifon del espacio misti': 'Mystical Space Typhoon',
        'tifon del espacio mitico': 'Mystical Space Typhoon',
        'tifon del espacio mistico': 'Mystical Space Typhoon',
        'olla de la codicia': 'Pot of Greed',
        'agujero oscuro': 'Dark Hole',
        'fisura': 'Fissure',
        'monstruo renacido': 'Monster Reborn',
        'cambio de corazon': 'Change of Heart',
        'espadas de luz reveladora': 'Swords of Revealing Light',
        'cilindro magico': 'Magic Cylinder',
        'ataque negado': 'Negate Attack',
        'armadura sakuretsu': 'Sakuretsu Armor',
        'agujero trampa': 'Trap Hole',
        'dispositivo de evacuacion obligatoria': 'Compulsory Evacuation Device',
        'tierra aplastante': 'Smashing Ground',
        'caridad graciosa': 'Graceful Charity',
        'dragon de la flama espada': 'Flame Swordsman',
        'mago de la tempestad': 'Magician of Black Chaos',
        'dragon de la rosa negra': 'Black Rose Dragon',
        'duende gemelo': 'Gemini Elf',
        'maga de la fe': 'Magician of Faith',
        'rompehechizos': 'Breaker the Magical Warrior',
        'sangan': 'Sangan',
        'kaibaman': 'Kaibaman',
        'dragon de luster': 'Luster Dragon',
        'dragon alejandrita': 'Alexandrite Dragon',
        'elfo mistiko': 'Mystical Elf',
        'energia de rayo': 'Lightning Energy',
        'energia de fuego': 'Fire Energy',
        'energia de agua': 'Water Energy',
        'energia de planta': 'Grass Energy',
        'energia de lucha': 'Fighting Energy',
        'energia psiquica': 'Psychic Energy',
        'investigacion del profesor': 'Professor\'s Research',
        'ultra ball': 'Ultra Ball',
        'nido ball': 'Nest Ball',
        'ordenes del jefe': 'Boss\'s Orders',
        'cambio': 'Switch',
        'pocion': 'Potion',
        'factura': 'Bill'
    };

    function canonicalName(name) {
        const key = normalizeName(stripParens(name));
        return ES_TO_EN[key] || stripParens(name);
    }

    // Estadísticas de los monstruos que aparecen en los mazos del repo.
    // Permiten jugar bien sin red: sin esto todos valían 1600/1280.
    const KNOWN_YGO_MONSTER = {
        'blue-eyes white dragon': { atk: 3000, def: 2500, level: 8 },
        'dark magician': { atk: 2500, def: 2100, level: 7 },
        'dark magician girl': { atk: 2000, def: 1700, level: 6 },
        'red-eyes black dragon': { atk: 2400, def: 2000, level: 7 },
        'exodia the forbidden one': { atk: 1000, def: 1000, level: 3 },
        'summoned skull': { atk: 2500, def: 1200, level: 6 },
        'gemini elf': { atk: 1900, def: 900, level: 4 },
        'luster dragon': { atk: 1900, def: 1600, level: 4 },
        'alexandrite dragon': { atk: 2000, def: 100, level: 4 },
        'mystical elf': { atk: 800, def: 2000, level: 4 },
        'kuriboh': { atk: 300, def: 200, level: 1 },
        'sangan': { atk: 1000, def: 600, level: 3 },
        'kaibaman': { atk: 200, def: 700, level: 3 },
        'magician of faith': { atk: 300, def: 400, level: 1 },
        'breaker the magical warrior': { atk: 1600, def: 1000, level: 4 },
        'skilled dark magician': { atk: 1900, def: 1700, level: 4 },
        'flame swordsman': { atk: 1800, def: 1600, level: 5 },
        'magician of black chaos': { atk: 2800, def: 2600, level: 8 },
        'black rose dragon': { atk: 2400, def: 1800, level: 7 }
    };

    function knownYgoMonster(name) {
        const entry = KNOWN_YGO_MONSTER[normalizeName(canonicalName(name))];
        if (!entry) return null;
        return Object.assign({ game: 'ygo', kind: 'monster', attribute: 'DARK', race: 'Unknown', typeLine: 'Monster', desc: '' }, entry, { known: true });
    }

    // ---------------------------------------------------------------
    // Conocimiento propio de cartas frecuentes.
    // Se consulta ANTES que las APIs: las búsquedas por nombre de las APIs
    // devuelven coincidencias parciales (p. ej. "Bill" → "Análisis de Bill",
    // o un Pokémon llamado "Switch"), y eso corrompía el tipo de carta.
    // ---------------------------------------------------------------
    const KNOWN_POKEMON = {
        pikachu: { hp: 60, stage: 'basic', types: ['Lightning'], retreat: 1, weakness: { type: 'Fighting', value: '×2' }, attacks: [{ name: 'Impactrueno', cost: ['Lightning'], damage: '20' }] },
        raichu: { hp: 120, stage: 'stage1', evolvesFrom: 'Pikachu', types: ['Lightning'], retreat: 1, weakness: { type: 'Fighting', value: '×2' }, attacks: [{ name: 'Chispa', cost: ['Lightning'], damage: '30' }, { name: 'Trueno', cost: ['Lightning', 'Lightning'], damage: '70' }] },
        voltorb: { hp: 60, stage: 'basic', types: ['Lightning'], retreat: 1, weakness: { type: 'Fighting', value: '×2' }, attacks: [{ name: 'Impacto', cost: ['Lightning'], damage: '20' }] },
        electrode: { hp: 100, stage: 'stage1', evolvesFrom: 'Voltorb', types: ['Lightning'], retreat: 1, weakness: { type: 'Fighting', value: '×2' }, attacks: [{ name: 'Bomba', cost: ['Lightning', 'Colorless'], damage: '60' }] },
        magnemite: { hp: 60, stage: 'basic', types: ['Lightning'], retreat: 1, weakness: { type: 'Fighting', value: '×2' }, attacks: [{ name: 'Chispazo', cost: ['Lightning'], damage: '10' }] },
        magneton: { hp: 90, stage: 'stage1', evolvesFrom: 'Magnemite', types: ['Lightning'], retreat: 2, weakness: { type: 'Fighting', value: '×2' }, attacks: [{ name: 'Onda Magnética', cost: ['Lightning', 'Colorless'], damage: '50' }] },
        zapdos: { hp: 130, stage: 'basic', types: ['Lightning'], retreat: 2, weakness: { type: 'Fighting', value: '×2' }, attacks: [{ name: 'Pico Taladro', cost: ['Lightning', 'Lightning', 'Colorless'], damage: '110' }] },
        charmander: { hp: 60, stage: 'basic', types: ['Fire'], retreat: 1, weakness: { type: 'Water', value: '×2' }, attacks: [{ name: 'Ascuas', cost: ['Fire'], damage: '20' }] },
        charmeleon: { hp: 90, stage: 'stage1', evolvesFrom: 'Charmander', types: ['Fire'], retreat: 1, weakness: { type: 'Water', value: '×2' }, attacks: [{ name: 'Colmillo Ígneo', cost: ['Fire', 'Colorless'], damage: '50' }] },
        charizard: { hp: 170, stage: 'stage2', evolvesFrom: 'Charmeleon', types: ['Fire'], retreat: 3, weakness: { type: 'Water', value: '×2' }, attacks: [{ name: 'Llamarada', cost: ['Fire', 'Fire', 'Colorless'], damage: '120' }] },
        vulpix: { hp: 60, stage: 'basic', types: ['Fire'], retreat: 1, weakness: { type: 'Water', value: '×2' }, attacks: [{ name: 'Llama', cost: ['Fire'], damage: '20' }] },
        ninetales: { hp: 110, stage: 'stage1', evolvesFrom: 'Vulpix', types: ['Fire'], retreat: 1, weakness: { type: 'Water', value: '×2' }, attacks: [{ name: 'Fuego Fatuo', cost: ['Fire', 'Colorless'], damage: '60' }] },
        growlithe: { hp: 60, stage: 'basic', types: ['Fire'], retreat: 1, weakness: { type: 'Water', value: '×2' }, attacks: [{ name: 'Mordisco', cost: ['Colorless'], damage: '20' }] },
        arcanine: { hp: 130, stage: 'stage1', evolvesFrom: 'Growlithe', types: ['Fire'], retreat: 2, weakness: { type: 'Water', value: '×2' }, attacks: [{ name: 'Colmillo Ígneo', cost: ['Fire', 'Colorless'], damage: '70' }] }
    };

    const KNOWN_TRAINERS = {
        'bill': { desc: 'Roba 2 cartas', isSupporter: false },
        'professor s research': { desc: 'Descarta tu mano y roba 7 cartas', isSupporter: true },
        'professors research': { desc: 'Descarta tu mano y roba 7 cartas', isSupporter: true },
        'ultra ball': { desc: 'Descarta 2 cartas y busca un Pokémon', isSupporter: false },
        'nest ball': { desc: 'Busca un Pokémon básico y ponlo en la Banca', isSupporter: false },
        'boss s orders': { desc: 'Cambia el Pokémon Activo del rival', isSupporter: true },
        'bosss orders': { desc: 'Cambia el Pokémon Activo del rival', isSupporter: true },
        'switch': { desc: 'Cambia tu Pokémon Activo por uno de la Banca', isSupporter: false },
        'potion': { desc: 'Cura 30 puntos de daño', isSupporter: false }
    };

    function knownPokemonMeta(name) {
        const key = normalizeName(name);
        const entry = KNOWN_POKEMON[key];
        if (!entry) return null;
        return Object.assign({ game: 'pokemon', kind: 'pokemon', resistance: null, desc: '', known: true }, entry);
    }

    function knownTrainerMeta(name) {
        // "Professor's Research" y "Professor s Research" deben coincidir:
        // normalizeName conserva el apóstrofo, así que se prueba sin signos.
        const key = normalizeName(name);
        const plain = key.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const entry = KNOWN_TRAINERS[key] || KNOWN_TRAINERS[plain] ||
            KNOWN_TRAINERS[key.replace(/\s+/g, '')] || KNOWN_TRAINERS[plain.replace(/\s+/g, '')];
        if (!entry) return null;
        return {
            game: 'pokemon', kind: 'trainer', desc: entry.desc,
            isItem: !entry.isSupporter, isSupporter: entry.isSupporter,
            subtypes: [entry.isSupporter ? 'Supporter' : 'Item'], known: true
        };
    }

    // Los presets incluyen Magias/Trampas conocidas. Si la API no responde,
    // la heurística las clasificaría como monstruos (rompía las reglas).
    const KNOWN_YGO_NONMONSTER = {
        'pot of greed': 'spell', 'graceful charity': 'spell', 'dark hole': 'spell',
        'fissure': 'spell', 'smashing ground': 'spell', 'mystical space typhoon': 'spell',
        'monster reborn': 'spell', 'change of heart': 'spell',
        'swords of revealing light': 'spell', 'compulsory evacuation device': 'trap',
        'mirror force': 'trap', 'magic cylinder': 'trap', 'negate attack': 'trap',
        'sakuretsu armor': 'trap', 'trap hole': 'trap'
    };

    function knownYgoKind(name) {
        return KNOWN_YGO_NONMONSTER[normalizeName(canonicalName(name))] || null;
    }

    function knownEnergyMeta(name) {
        if (!/\benergy\b|energ[ií]a/i.test(name)) return null;
        return { game: 'pokemon', kind: 'energy', desc: 'Energía básica', known: true };
    }

    async function resolveOne(card, layout) {
        const name = card.name || card.card_name || 'Carta';
        const game = guessGame(card, layout);
        const key = `${game}:${normalizeName(stripParens(name))}`;

        if (memory.has(key)) return memory.get(key);

        const ygoKind = game === 'ygo' ? knownYgoKind(name) : null;
        if (ygoKind) {
            const meta = {
                game: 'ygo', kind: ygoKind, desc: '', name: name,
                canonical: canonicalName(name),
                img: card.image_url || card.img || '', known: true
            };
            memory.set(key, meta);
            return meta;
        }

        if (game === 'ygo') {
            const monster = knownYgoMonster(name);
            if (monster) {
                monster.name = name;
                monster.canonical = canonicalName(name);
                monster.img = card.image_url || card.img || '';
                memory.set(key, monster);
                return monster;
            }
        }

        if (game === 'pokemon') {
            // Los entrenadores conocidos están en inglés; el mazo puede traer
            // el nombre en español ("Poción", "Cambio").
            const en = canonicalName(name);
            const known = knownPokemonMeta(name) || knownPokemonMeta(en) ||
                knownTrainerMeta(name) || knownTrainerMeta(en) ||
                knownEnergyMeta(name) || knownEnergyMeta(en);
            if (known) {
                known.name = name;
                known.canonical = en;
                known.img = card.image_url || card.img || '';
                memory.set(key, known);
                return known;
            }
        }
        const entry = loadCache()[key];
        if (entry && entry.savedAt && (Date.now() - entry.savedAt) < CACHE_TTL && entry.meta) {
            memory.set(key, entry.meta);
            return entry.meta;
        }

        let meta = null;
        try {
            if (game === 'ygo') {
                const apiId = ygoIdFromCard(card);
                if (apiId) meta = await fetchYgoMetaById(apiId);
            }
            if (!meta) meta = game === 'pokemon' ? await fetchPokemonMeta(name) : await fetchYgoMeta(name);
        } catch (e) {
            meta = null;
        }

        if (!meta) {
            meta = game === 'pokemon'
                ? heuristicPokemon(name, card.description || card.effect || card.desc)
                : heuristicYgo(name, card.description || card.effect || card.desc);
        }

        meta.name = name;
        if (game === 'ygo') meta.canonical = meta.apiName || canonicalName(name);
        meta.img = meta.img || card.image_url || card.img || '';
        memory.set(key, meta);
        loadCache()[key] = { meta, savedAt: Date.now() };
        saveCache();
        return meta;
    }

    /**
     * Expande las filas de deck_cards (con quantity y section) a instancias de carta.
     * Mantiene el orden de posición del deck original.
     */
    function expandDeckRows(rows, layout) {
        const out = [];
        (rows || []).forEach((row) => {
            const qty = Math.max(1, Number(row.quantity) || 1);
            const section = String(row.section || 'Main').trim();
            for (let i = 0; i < qty; i++) {
                out.push({
                    name: row.name || 'Carta',
                    img: row.image_url || '',
                    section,
                    rarity: row.rarity || '',
                    description: row.description || row.effect || row.desc || '',
                    layout
                });
            }
        });
        return out;
    }

    async function resolveDeck(rows, layout, onProgress) {
        const expanded = expandDeckRows(rows, layout);
        const seen = new Map();
        const unique = [];
        expanded.forEach(c => {
            const k = `${guessGame(c, layout)}:${normalizeName(stripParens(c.name))}`;
            if (!seen.has(k)) {
                seen.set(k, true);
                unique.push(c);
            }
        });

        let done = 0;
        const chunkSize = 5;
        for (let i = 0; i < unique.length; i += chunkSize) {
            const chunk = unique.slice(i, i + chunkSize);
            await Promise.all(chunk.map(c => resolveOne(c, layout)));
            done += chunk.length;
            if (typeof onProgress === 'function') onProgress(Math.min(1, done / unique.length), done, unique.length);
        }

        return expanded.map(c => {
            const meta = memory.get(`${guessGame(c, layout)}:${normalizeName(stripParens(c.name))}`) || {};
            return Object.assign({}, meta, {
                name: c.name,
                img: c.img || meta.img || '',
                section: c.section,
                rarity: c.rarity
            });
        });
    }

    // ---------------------------------------------------------------
    // Mazos preestablecidos (por si el usuario no tiene decks cargados)
    // ---------------------------------------------------------------
    const PRESETS = {
        yugioh: {
            dragon: {
                label: 'Dragón Azul (clásico)',
                cards: [
                    ['Blue-Eyes White Dragon', 3, 'Main'],
                    ['Kaibaman', 2, 'Main'],
                    ['Luster Dragon', 2, 'Main'],
                    ['Alexandrite Dragon', 2, 'Main'],
                    ['Mystical Elf', 2, 'Main'],
                    ['Kuriboh', 2, 'Main'],
                    ['Sangan', 2, 'Main'],
                    ['Pot of Greed', 2, 'Main'],
                    ['Graceful Charity', 1, 'Main'],
                    ['Mystical Space Typhoon', 2, 'Main'],
                    ['Dark Hole', 1, 'Main'],
                    ['Monster Reborn', 1, 'Main'],
                    ['Mirror Force', 2, 'Main'],
                    ['Magic Cylinder', 2, 'Main'],
                    ['Negate Attack', 2, 'Main'],
                    ['Sakuretsu Armor', 2, 'Main'],
                    ['Trap Hole', 2, 'Main'],
                    ['Fissure', 2, 'Main'],
                    ['Smashing Ground', 2, 'Main'],
                    ['Compulsory Evacuation Device', 2, 'Main'],
                    ['Blue-Eyes White Dragon', 2, 'Main'],
                    ['Luster Dragon', 2, 'Main'],
                    ['Dark Hole', 1, 'Main'],
                    ['Mirror Force', 2, 'Main']
                ]
            },
            magician: {
                label: 'Mago Oscuro (clásico)',
                cards: [
                    ['Dark Magician', 3, 'Main'],
                    ['Magician of Faith', 2, 'Main'],
                    ['Skilled Dark Magician', 2, 'Main'],
                    ['Breaker the Magical Warrior', 2, 'Main'],
                    ['Gemini Elf', 2, 'Main'],
                    ['Kuriboh', 2, 'Main'],
                    ['Sangan', 2, 'Main'],
                    ['Pot of Greed', 2, 'Main'],
                    ['Graceful Charity', 1, 'Main'],
                    ['Mystical Space Typhoon', 2, 'Main'],
                    ['Dark Hole', 1, 'Main'],
                    ['Monster Reborn', 1, 'Main'],
                    ['Change of Heart', 1, 'Main'],
                    ['Mirror Force', 2, 'Main'],
                    ['Magic Cylinder', 2, 'Main'],
                    ['Negate Attack', 2, 'Main'],
                    ['Sakuretsu Armor', 2, 'Main'],
                    ['Trap Hole', 2, 'Main'],
                    ['Fissure', 2, 'Main'],
                    ['Compulsory Evacuation Device', 2, 'Main'],
                    ['Dark Magician', 2, 'Main'],
                    ['Gemini Elf', 2, 'Main'],
                    ['Pot of Greed', 1, 'Main'],
                    ['Mirror Force', 1, 'Main']
                ]
            }
        },
        pokemon: {
            electric: {
                label: 'Rayo Veloz',
                cards: [
                    ['Pikachu', 4, 'Main'], ['Raichu', 2, 'Main'], ['Voltorb', 3, 'Main'],
                    ['Electrode', 2, 'Main'], ['Magnemite', 3, 'Main'], ['Magneton', 2, 'Main'],
                    ['Zapdos', 1, 'Main'], ['Lightning Energy', 16, 'Main'],
                    ['Professor\'s Research', 3, 'Main'], ['Ultra Ball', 3, 'Main'],
                    ['Nest Ball', 3, 'Main'], ['Boss\'s Orders', 2, 'Main'],
                    ['Switch', 3, 'Main'], ['Potion', 3, 'Main'], ['Bill', 3, 'Main']
                ]
            },
            fire: {
                label: 'Fuego Ardiente',
                cards: [
                    ['Charmander', 4, 'Main'], ['Charmeleon', 2, 'Main'], ['Charizard', 2, 'Main'],
                    ['Vulpix', 3, 'Main'], ['Ninetales', 2, 'Main'], ['Growlithe', 3, 'Main'],
                    ['Arcanine', 2, 'Main'], ['Fire Energy', 16, 'Main'],
                    ['Professor\'s Research', 3, 'Main'], ['Ultra Ball', 3, 'Main'],
                    ['Nest Ball', 3, 'Main'], ['Boss\'s Orders', 2, 'Main'],
                    ['Switch', 3, 'Main'], ['Potion', 3, 'Main'], ['Bill', 3, 'Main']
                ]
            }
        }
    };

    function presetRows(key, layout) {
        const group = PRESETS[layout === 'pokemon' ? 'pokemon' : 'yugioh'];
        const preset = group[key];
        if (!preset) return null;
        return preset.cards.map(([name, quantity, section]) => ({ name, quantity, section, image_url: '' }));
    }

    function listPresets(layout) {
        const group = PRESETS[layout === 'pokemon' ? 'pokemon' : 'yugioh'];
        return Object.keys(group).map(key => ({ key, label: group[key].label }));
    }

    window.DuelAICards = {
        resolveDeck,
        resolveOne,
        expandDeckRows,
        presetRows,
        listPresets,
        normalizeName,
        stripParens,
        guessGame,
        canonicalName
    };
})();
