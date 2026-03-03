$(document).ready(function() {
    // --- Navigation ---
    $(document).on('click', '#btn-fast-mode', function(e) {
        e.preventDefault();
        showFastMode();
    });

    function showFastMode() {
        showView('fast-mode');
        loadFastTargets();
        $('#fast-search-input').focus();
    }

    // --- Target Selection ---
    $('#fast-target-type').change(function() {
        const type = $(this).val();
        $('#fast-target-label').text(type === 'album' ? 'Seleccionar Álbum' : 'Seleccionar Deck');
        loadFastTargets();
    });

    window.loadFastTargets = async function() {
        const type = $('#fast-target-type').val();
        const table = type === 'album' ? 'albums' : 'decks';
        const $select = $('#fast-target-select');

        $select.html('<option value="">Cargando...</option>');

        const { data, error } = await _supabase
            .from(table)
            .select('id, ' + (type === 'album' ? 'title' : 'name'))
            .eq('user_id', currentUser.id)
            .order('id', { ascending: false });

        if (error) {
            $select.html('<option value="">Error al cargar</option>');
            return;
        }

        $select.empty();
        if (data && data.length > 0) {
            data.forEach(item => {
                $select.append(`<option value="${item.id}">${item.title || item.name}</option>`);
            });
        } else {
            $select.append(`<option value="">No hay ${type}s</option>`);
        }
    };

    // --- Create New Album/Deck ---
    $('#btn-fast-create-new').click(async function() {
        if (!currentUser) return;
        const type = $('#fast-target-type').val();
        const table = type === 'album' ? 'albums' : 'decks';
        const limit = type === 'album' ? (currentUser.max_albums || 3) : (currentUser.max_decks || 1);

        const { count } = await _supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id);

        if (count >= limit) {
            Swal.fire('Límite alcanzado', `Tu plan actual permite un máximo de ${limit} ${type === 'album' ? 'álbumes' : 'deck'}.`, 'warning');
            return;
        }

        const { value: name } = await Swal.fire({
            title: `Crear Nuevo ${type === 'album' ? 'Álbum' : 'Deck'}`,
            input: 'text',
            inputLabel: 'Nombre',
            placeholder: `Escribe el nombre del ${type}...`,
            showCancelButton: true,
            confirmButtonColor: '#ff4757'
        });

        if (name) {
            const insertData = { user_id: currentUser.id };
            if (type === 'album') insertData.title = name;
            else insertData.name = name;

            const { data, error } = await _supabase
                .from(table)
                .insert([insertData])
                .select();

            if (error) {
                Swal.fire('Error', 'No se pudo crear: ' + error.message, 'error');
            } else {
                await loadFastTargets();
                $('#fast-target-select').val(data[0].id);
            }
        }
    });

    // --- Search Logic ---
    let fastSearchTimer = null;

    $('#fast-search-input').on('input', function() {
        clearTimeout(fastSearchTimer);
        const query = $(this).val().trim();

        if (query.length < 3) {
            $('#fast-results-grid').html('<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 20px;">Escribe al menos 3 letras para buscar...</div>');
            return;
        }

        fastSearchTimer = setTimeout(() => {
            performFastSearch(query);
        }, 500);
    });

    window.performFastSearch = async function(inputQueries) {
        const queries = Array.isArray(inputQueries) ? inputQueries : [inputQueries];

        $('#fast-search-loading').show();
        $('#fast-results-grid').html('<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 20px;">Buscando coincidencias...</div>');

        try {
            const allResultsPromises = queries.map(async (query) => {
                const ygoSpecialSearch = async () => {
                    const q = query.toUpperCase();
                    if (/^\d{5,10}$/.test(q)) {
                        const r = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${q}`).then(res => res.json()).catch(() => ({data:[]}));
                        return r.data || [];
                    }
                    const setMatch = q.match(/^([A-Z0-9]{3,6})-([A-Z0-9]{3,8})$/);
                    if (setMatch) {
                        const prefix = setMatch[1];
                        const sets = typeof getYgoSets === 'function' ? await getYgoSets() : [];
                        const setObj = sets.find(s => s.set_code.toUpperCase() === prefix);
                        if (setObj) {
                            const r = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(setObj.set_name)}`).then(res => res.json()).catch(() => ({data:[]}));
                            if (r.data) return r.data.filter(c => c.card_sets && c.card_sets.some(s => s.set_code.toUpperCase() === q));
                        }
                    }
                    return [];
                };

                const searchPromises = [
                    fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : {data:[]}).catch(() => ({data:[]})),
                    ygoSpecialSearch(),
                    fetch(`https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : []).catch(() => []),
                    fetch(`https://api.tcgdex.net/v2/es/cards?name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : []).catch(() => []),
                    fetch(`https://api.lorcana-api.com/cards/fetch?search=name~${encodeURIComponent(query)}&displayonly=name;image;cost;set_num`).then(r => r.ok ? r.json() : []).catch(() => []),
                    VikingData.search(query)
                ];

                const [ygName, ygSpecial, pkEn, pkEs, lorResults, vikResults] = await Promise.all(searchPromises);

                let localResults = [];
                if (Array.isArray(vikResults)) localResults.push(...vikResults);

                (Array.isArray(lorResults) ? lorResults : []).forEach(c => {
                    if (c.Image) localResults.push({ name: c.Name, image: c.Image, high_res: c.Image });
                });

                const ygoResults = [...(ygName.data || []), ...ygSpecial];
                ygoResults.forEach(c => {
                    if (c.card_images) {
                        c.card_images.forEach(img => {
                            localResults.push({ name: c.name, image: img.image_url_small, high_res: img.image_url });
                        });
                    }
                });

                const pkResults = [...(pkEn || []), ...(pkEs || [])];
                pkResults.forEach(c => {
                    if (c.image) localResults.push({ name: c.name, image: `${c.image}/low.webp`, high_res: `${c.image}/high.webp` });
                });

                return localResults;
            });

            const allBatches = await Promise.all(allResultsPromises);
            const combinedResults = [].concat(...allBatches);

            const uniqueResults = [];
            const seenImages = new Set();
            combinedResults.forEach(card => {
                if (!seenImages.has(card.image)) {
                    seenImages.add(card.image);
                    uniqueResults.push(card);
                }
            });

            displayFastResults(uniqueResults.slice(0, 60));

        } catch (err) {
            console.error(err);
            $('#fast-results-grid').html('<div style="grid-column: 1/-1; text-align: center; color: #ff4757; padding: 20px;">Error al buscar. Reintenta.</div>');
        } finally {
            $('#fast-search-loading').hide();
        }
    }

    function displayFastResults(results) {
        const $container = $('#fast-results-grid');
        $container.empty();

        if (results.length === 0) {
            $container.html('<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 20px;">No se encontraron resultados.</div>');
            return;
        }

        results.forEach(card => {
            const $item = $(`
                <div class="fast-result-item" title="${card.name}">
                    <img src="${card.image}" alt="${card.name}">
                    <span>${card.name}</span>
                </div>
            `);

            $item.click(() => {
                registerFastCard(card);
            });

            $container.append($item);
        });
    }

    async function registerFastCard(card) {
        const targetType = $('#fast-target-type').val();
        const targetId = $('#fast-target-select').val();

        if (!targetId) {
            Swal.fire('Atención', 'Selecciona un destino (Álbum o Deck) primero.', 'warning');
            return;
        }

        $('#fast-search-loading').show();

        try {
            if (targetType === 'album') {
                await handleFastAlbumRegistration(card, targetId);
            } else {
                await handleFastDeckRegistration(card, targetId);
            }
        } catch (err) {
            console.error("Fast Registration Error:", err);
            Swal.fire('Error', 'No se pudo registrar la carta: ' + err.message, 'error');
        } finally {
            $('#fast-search-loading').hide();
        }
    }

    async function handleFastAlbumRegistration(card, albumId) {
        // 1. Get all pages for this album
        let { data: pages, error: pErr } = await _supabase
            .from('pages')
            .select('id, page_index')
            .eq('album_id', albumId)
            .order('page_index', { ascending: true });

        if (pErr) throw pErr;

        if (!pages || pages.length === 0) {
            // Create first page if none exists
            const { data: newPage, error: npe } = await _supabase
                .from('pages')
                .insert([{ album_id: albumId, page_index: 0 }])
                .select();
            if (npe) throw npe;
            pages = newPage;
        }

        // 2. Get all slots for these pages to find empty ones
        const pageIds = pages.map(p => p.id);
        const { data: occupiedSlots, error: sErr } = await _supabase
            .from('card_slots')
            .select('page_id, slot_index')
            .in('page_id', pageIds);

        if (sErr) throw sErr;

        let targetPageId = null;
        let targetSlotIndex = null;

        // Find first empty slot (0-8)
        for (const page of pages) {
            const occupiedIndexes = occupiedSlots.filter(s => s.page_id === page.id).map(s => s.slot_index);
            for (let i = 0; i < 9; i++) {
                if (!occupiedIndexes.includes(i)) {
                    targetPageId = page.id;
                    targetSlotIndex = i;
                    break;
                }
            }
            if (targetPageId !== null) break;
        }

        // 3. If no empty slot, try creating a new page
        if (targetPageId === null) {
            if (pages.length >= (currentUser.max_pages || 5)) {
                throw new Error(`Límite de páginas alcanzado (${currentUser.max_pages || 5}).`);
            }

            const nextIdx = pages[pages.length - 1].page_index + 1;
            const { data: nPage, error: npe2 } = await _supabase
                .from('pages')
                .insert([{ album_id: albumId, page_index: nextIdx }])
                .select();

            if (npe2) throw npe2;
            targetPageId = nPage[0].id;
            targetSlotIndex = 0;
        }

        // 4. Insert the card
        const { error: insErr } = await _supabase
            .from('card_slots')
            .insert([{
                page_id: targetPageId,
                slot_index: targetSlotIndex,
                name: card.name,
                image_url: card.high_res || card.image,
                condition: 'M',
                quantity: 1
            }]);

        if (insErr) throw insErr;
        finalizeFastRegistration(card.name);
    }

    async function handleFastDeckRegistration(card, deckId) {
        // 1. Check deck limit
        const { count, error: cErr } = await _supabase
            .from('deck_cards')
            .select('*', { count: 'exact', head: true })
            .eq('deck_id', deckId);

        if (cErr) throw cErr;

        if (count >= (currentUser.max_cards_per_deck || 60)) {
            throw new Error(`Límite de cartas en deck alcanzado (${currentUser.max_cards_per_deck || 60}).`);
        }

        // 2. Insert card
        const { error: insErr } = await _supabase
            .from('deck_cards')
            .insert([{
                deck_id: deckId,
                name: card.name,
                image_url: card.high_res || card.image,
                quantity: 1
            }]);

        if (insErr) throw insErr;
        finalizeFastRegistration(card.name);
    }

    function cleanFastTranscript(text) {
        if (!text) return "";
        // Remove extra spaces and leading/trailing whitespace
        return text.replace(/\s+/g, ' ').trim();
    }

    function finalizeFastRegistration(cardName) {
        // Feedback
        Swal.fire({
            title: '¡Registrada!',
            text: cardName,
            icon: 'success',
            timer: 1000,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });

        // Clear UI and reset
        $('#fast-search-input').val('').focus();
        $('#fast-results-grid').html('<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 20px;">Lista para la siguiente carta...</div>');
    }

    // --- Voice Input ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.interimResults = false;
        recognition.maxAlternatives = 5;

        recognition.onstart = () => {
            $('#btn-fast-voice').addClass('voice-pulse').find('i').removeClass('fa-microphone').addClass('fa-spinner fa-spin');
        };

        recognition.onresult = (event) => {
            const results = event.results[0];
            const queries = [];

            for (let i = 0; i < results.length; i++) {
                const cleaned = cleanFastTranscript(results[i].transcript);
                if (cleaned && !queries.includes(cleaned)) {
                    queries.push(cleaned);
                }
            }

            if (queries.length > 0) {
                $('#fast-search-input').val(queries[0]);
                performFastSearch(queries);
            }
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            Swal.fire('Error de Voz', 'No se pudo reconocer la voz: ' + event.error, 'error');
        };

        recognition.onend = () => {
            $('#btn-fast-voice').removeClass('voice-pulse').find('i').removeClass('fa-spinner fa-spin').addClass('fa-microphone');
        };

        $('#btn-fast-voice').click(function() {
            recognition.start();
        });
    } else {
        $('#btn-fast-voice').hide();
    }

    // --- Image/Drawing Helper (OCR) ---
    let tesseractWorker = null;
    async function getTesseractWorker() {
        if (tesseractWorker) return tesseractWorker;
        tesseractWorker = await Tesseract.createWorker('eng');
        return tesseractWorker;
    }

    // --- Drawing Input ---
    const drawCanvas = document.getElementById('fast-draw-canvas');
    if (drawCanvas) {
        const dctx = drawCanvas.getContext('2d');
        let isDrawing = false;

        dctx.lineWidth = 3;
        dctx.lineCap = 'round';
        dctx.strokeStyle = '#000';

        function getMousePos(e) {
            const rect = drawCanvas.getBoundingClientRect();
            if (e.touches) {
                return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
            }
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }

        $(drawCanvas).on('mousedown touchstart', (e) => {
            isDrawing = true;
            const pos = getMousePos(e.originalEvent);
            dctx.beginPath();
            dctx.moveTo(pos.x, pos.y);
            if (e.type === 'touchstart') e.preventDefault();
        });

        $(window).on('mousemove touchmove', (e) => {
            if (!isDrawing) return;
            const pos = getMousePos(e.originalEvent);
            dctx.lineTo(pos.x, pos.y);
            dctx.stroke();
        });

        $(window).on('mouseup touchend', () => {
            isDrawing = false;
        });

        $('#btn-fast-draw').click(() => {
            dctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
            $('#fast-draw-modal').addClass('active');
        });

        $('#close-fast-draw').click(() => {
            $('#fast-draw-modal').removeClass('active');
        });

        $('#btn-fast-draw-clear').click(() => {
            dctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        });

        $('#btn-fast-draw-search').click(async () => {
            const dataUrl = drawCanvas.toDataURL('image/png');
            $('#fast-draw-modal').removeClass('active');

            Swal.fire({
                title: 'Leyendo dibujo...',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            try {
                const worker = await getTesseractWorker();
                const { data: { text } } = await worker.recognize(dataUrl);

                const cleanText = text.replace(/[^a-zA-Z0-9\s-]/g, ' ').trim();
                if (cleanText.length > 1) {
                    $('#fast-search-input').val(cleanText).trigger('input');
                    Swal.close();
                } else {
                    Swal.fire('Atención', 'No pudimos reconocer el texto. Dibuja más claro.', 'warning');
                }
            } catch (err) {
                console.error("Draw OCR Error:", err);
                Swal.fire('Error', 'Error al procesar el dibujo.', 'error');
            }
        });
    }
});
