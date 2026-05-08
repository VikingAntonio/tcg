$(document).ready(function() {
    let currentExpansionCards = [];
    let allSets = []; // Cache for all sets across TCGs
    let searchTimer = null;

    // --- Navigation ---
    window.showExpansionView = function() {
        showView('expansiones');
        loadExpansionAlbums();
        fetchAllTCGSets();
    }

    // --- Data Fetching ---
    async function fetchAllTCGSets() {
        if (allSets.length > 0) return; // Use cache

        try {
            const [ygRes, pkRes] = await Promise.all([
                fetch('https://db.ygoprodeck.com/api/v7/cardsets.php').then(r => r.json()),
                fetch('https://api.tcgdex.net/v2/en/sets').then(r => r.json())
            ]);

            const ygSets = ygRes.map(s => ({ id: s.set_name, name: s.set_name, tcg: 'yugioh' }));
            const pkSets = pkRes.map(s => ({ id: s.id, name: s.name, tcg: 'pokemon' }));
            const opSets = [
                { id: 'OP-01', name: 'Romance Dawn (OP-01)', tcg: 'onepiece' },
                { id: 'OP-02', name: 'Paramount War (OP-02)', tcg: 'onepiece' },
                { id: 'OP-03', name: 'Pillars of Strength (OP-03)', tcg: 'onepiece' },
                { id: 'OP-04', name: 'Kingdoms of Intrigue (OP-04)', tcg: 'onepiece' },
                { id: 'OP-05', name: 'Awakening of the New Era (OP-05)', tcg: 'onepiece' },
                { id: 'OP-06', name: 'Wings of the Captain (OP-06)', tcg: 'onepiece' },
                { id: 'OP-07', name: '500 Years in the Future (OP-07)', tcg: 'onepiece' }
            ];

            allSets = [...ygSets, ...pkSets, ...opSets];
        } catch (err) {
            console.error("Error pre-fetching sets:", err);
        }
    }

    async function fetchExpansionCards(setId, tcg) {
        $('#expansiones-card-grid').html('<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 40px;"><i class="fas fa-spinner fa-spin"></i> Cargando cartas de la expansión...</div>');

        try {
            let cards = [];
            if (tcg === 'yugioh') {
                const response = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(setId)}`);
                const data = await response.json();

                // Improvement: Ensure all card instances are shown (including reprints/variants in the same set)
                (data.data || []).forEach(c => {
                    if (c.card_sets) {
                        const setInstances = c.card_sets.filter(s => s.set_name === setId);
                        setInstances.forEach(inst => {
                            cards.push({
                                name: c.name + (inst.set_rarity ? ` (${inst.set_rarity})` : ''),
                                image_url: c.card_images[0].image_url,
                                expansion: setId,
                                rarity: inst.set_rarity
                            });
                        });
                    } else {
                        cards.push({
                            name: c.name,
                            image_url: c.card_images[0].image_url,
                            expansion: setId
                        });
                    }
                });
            } else if (tcg === 'pokemon') {
                const response = await fetch(`https://api.tcgdex.net/v2/en/sets/${setId}`);
                const data = await response.json();
                cards = (data.cards || []).map(c => ({
                    name: c.name,
                    image_url: c.image ? `${c.image}/high.webp` : 'https://via.placeholder.com/150x210?text=Sin+Imagen',
                    expansion: data.name,
                    rarity: c.rarity || ''
                }));
            } else if (tcg === 'onepiece') {
                const { data: dbCards } = await _supabase
                    .from('viking_data')
                    .select('*')
                    .eq('tcg', 'onepiece')
                    .ilike('expansion', `%${setId}%`);

                cards = (dbCards || []).map(c => ({
                    name: c.name,
                    image_url: c.image_url,
                    expansion: c.expansion
                }));

                if (cards.length === 0) {
                    $('#expansiones-card-grid').html('<div style="grid-column: 1/-1; text-align: center; color: #ff4757; padding: 40px;">No se encontraron cartas para esta expansión en la base de datos de One Piece.</div>');
                    return;
                }
            }

            currentExpansionCards = cards;
            renderExpansionCards();
        } catch (err) {
            console.error("Error fetching cards:", err);
            $('#expansiones-card-grid').html('<div style="grid-column: 1/-1; text-align: center; color: #ff4757; padding: 40px;">Error al cargar las cartas. Reintenta.</div>');
        }
    }

    // --- UI Rendering ---
    function renderExpansionCards() {
        const $grid = $('#expansiones-card-grid');
        $grid.empty();

        if (currentExpansionCards.length === 0) {
            $grid.html('<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 40px;">No hay cartas en esta expansión.</div>');
            return;
        }

        currentExpansionCards.forEach((card, index) => {
            const $item = $(`
                <div class="expansion-card-item">
                    <input type="checkbox" class="expansion-card-checkbox" data-index="${index}" checked>
                    <img src="${card.image_url}" alt="${card.name}" onerror="this.src='https://via.placeholder.com/150x210?text=Sin+Imagen'">
                    <div class="expansion-card-info" title="${card.name}">${card.name}</div>
                </div>
            `);

            $item.on('click', function(e) {
                if (!$(e.target).is('input')) {
                    const $cb = $(this).find('input');
                    $cb.prop('checked', !$cb.is(':checked'));
                    updateSelectAllState();
                }
            });

            $grid.append($item);
        });

        updateSelectAllState();
    }

    function updateSelectAllState() {
        const allChecked = currentExpansionCards.length > 0 && $('.expansion-card-checkbox:checked').length === currentExpansionCards.length;
        $('#expansion-select-all').prop('checked', allChecked);
    }

    // --- Autocomplete Logic ---
    $('#expansion-search-input').on('input', function() {
        clearTimeout(searchTimer);
        const query = $(this).val().toLowerCase().trim();
        const tcgFilter = $('#expansion-tcg-select').val();

        if (query.length < 2) {
            $('#expansion-search-results').removeClass('active').empty();
            return;
        }

        searchTimer = setTimeout(() => {
            const filtered = allSets.filter(s => {
                const matchesTcg = tcgFilter === 'all' || s.tcg === tcgFilter;
                const matchesQuery = s.name.toLowerCase().includes(query);
                return matchesTcg && matchesQuery;
            }).slice(0, 50);

            displayAutocompleteResults(filtered);
        }, 300);
    });

    function displayAutocompleteResults(results) {
        const $container = $('#expansion-search-results');
        $container.empty();

        if (results.length === 0) {
            $container.append('<div class="menu-item">Sin resultados</div>');
        } else {
            results.forEach(s => {
                const $item = $(`
                    <div class="menu-item" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                        <span>${s.name}</span>
                        <small style="opacity:0.5; font-size:10px; text-transform:uppercase;">${s.tcg}</small>
                    </div>
                `);
                $item.click(() => {
                    $('#expansion-search-input').val(s.name);
                    $('#expansion-selected-id').val(s.id);
                    $container.removeClass('active').empty();
                    fetchExpansionCards(s.id, s.tcg);
                });
                $container.append($item);
            });
        }
        $container.addClass('active');
    }

    $(document).on('click', function(e) {
        if (!$(e.target).closest('.form-group').length) {
            $('#expansion-search-results').removeClass('active');
        }
    });

    // --- Event Listeners ---
    $('#expansion-tcg-select').change(function() {
        $('#expansion-search-input').val('').trigger('input');
        $('#expansiones-card-grid').html('<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 40px;">Selecciona una expansión para cargar las cartas.</div>');
    });

    $('#expansion-select-all').change(function() {
        const isChecked = $(this).is(':checked');
        $('.expansion-card-checkbox').prop('checked', isChecked);
    });

    $(document).on('change', '.expansion-card-checkbox', function() {
        updateSelectAllState();
    });

    $('#expansion-album-dest').change(function() {
        if ($(this).val() === 'new') {
            $('#expansion-new-album-group').show();
        } else {
            $('#expansion-new-album-group').hide();
        }
    });

    // --- Album Loading ---
    async function loadExpansionAlbums() {
        const $select = $('#expansion-album-dest');
        const { data: albums, error } = await _supabase
            .from('albums')
            .select('id, title')
            .eq('user_id', currentUser.id)
            .order('id', { ascending: false });

        $select.html('<option value="new">Nuevo Álbum</option>');
        if (albums) {
            albums.forEach(a => {
                $select.append(`<option value="${a.id}">${a.title}</option>`);
            });
        }
    }

    // --- Save Logic ---
    $('#btn-save-expansion-cards').click(async function() {
        const selectedIndexes = $('.expansion-card-checkbox:checked').map(function() {
            return $(this).data('index');
        }).get();

        if (selectedIndexes.length === 0) {
            Swal.fire('Atención', 'Selecciona al menos una carta para guardar.', 'warning');
            return;
        }

        const albumDest = $('#expansion-album-dest').val();
        let albumId = albumDest;
        const newAlbumName = $('#expansion-new-album-name').val().trim();

        if (albumDest === 'new') {
            if (!newAlbumName) {
                Swal.fire('Atención', 'Escribe un nombre para el nuevo álbum.', 'warning');
                return;
            }

            const { count } = await _supabase
                .from('albums')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', currentUser.id);

            if (count >= (currentUser.max_albums || 3)) {
                Swal.fire('Límite alcanzado', `Tu plan actual permite un máximo de ${currentUser.max_albums || 3} álbumes.`, 'warning');
                return;
            }

            Swal.fire({ title: 'Creando álbum...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            const { data: newAlbum, error: albumErr } = await _supabase
                .from('albums')
                .insert([{ title: newAlbumName, user_id: currentUser.id }])
                .select();

            if (albumErr) {
                Swal.fire('Error', 'No se pudo crear el álbum: ' + albumErr.message, 'error');
                return;
            }
            albumId = newAlbum[0].id;
        }

        const selectedCards = selectedIndexes.map(i => currentExpansionCards[i]);

        Swal.fire({
            title: 'Guardando cartas...',
            text: `Procesando ${selectedCards.length} cartas.`,
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            await handleBatchExpansionRegistration(albumId, selectedCards);
            Swal.fire({
                title: '¡Guardado!',
                text: 'Las cartas se han añadido correctamente al álbum.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
            if (albumDest === 'new') {
                loadExpansionAlbums();
                $('#expansion-new-album-name').val('');
            }
        } catch (err) {
            console.error("Batch Expansion Save Error:", err);
            Swal.fire('Error', 'No se pudieron registrar las cartas: ' + err.message, 'error');
        }
    });

    async function handleBatchExpansionRegistration(albumId, cards) {
        // Fetch existing pages for this album
        let { data: pages, error: pErr } = await _supabase
            .from('pages')
            .select('id, page_index')
            .eq('album_id', albumId)
            .order('page_index', { ascending: true });

        if (pErr) throw pErr;

        // If no pages exist, create the first one
        if (!pages || pages.length === 0) {
            const { data: newPage, error: npe } = await _supabase
                .from('pages')
                .insert([{ album_id: albumId, page_index: 0 }])
                .select();
            if (npe) throw npe;
            pages = newPage;
        }

        // Fetch all currently occupied slots in these pages
        const pageIds = pages.map(p => p.id);
        const { data: occupiedSlots, error: sErr } = await _supabase
            .from('card_slots')
            .select('page_id, slot_index')
            .in('page_id', pageIds);

        if (sErr) throw sErr;

        const cardsToInsert = [];
        const maxPages = (currentUser.max_pages || 5);

        let currentPageIdx = 0;
        let startSlotIdx = 0;

        for (const card of cards) {
            let assigned = false;

            while (!assigned) {
                const page = pages[currentPageIdx];
                if (!page) break;

                const pageOccupied = occupiedSlots.filter(s => s.page_id === page.id).map(s => s.slot_index);
                const localOccupied = cardsToInsert.filter(s => s.page_id === page.id).map(s => s.slot_index);
                const allOccupied = [...pageOccupied, ...localOccupied];

                let freeSlot = -1;
                for (let i = startSlotIdx; i < 9; i++) {
                    if (!allOccupied.includes(i)) {
                        freeSlot = i;
                        break;
                    }
                }

                if (freeSlot !== -1) {
                    cardsToInsert.push({
                        page_id: page.id,
                        slot_index: freeSlot,
                        name: card.name,
                        image_url: card.image_url,
                        expansion: card.expansion,
                        rarity: card.rarity || '',
                        condition: 'M',
                        quantity: 1,
                        price: ''
                    });
                    startSlotIdx = freeSlot + 1;
                    assigned = true;
                } else {
                    // Page full, move to next or create new
                    currentPageIdx++;
                    startSlotIdx = 0;

                    if (currentPageIdx >= pages.length) {
                        if (pages.length >= maxPages) {
                            throw new Error(`Se ha alcanzado el límite de ${maxPages} páginas para este álbum.`);
                        }

                        const nextIdx = (pages.length > 0) ? pages[pages.length - 1].page_index + 1 : 0;
                        const { data: nPage, error: npe2 } = await _supabase
                            .from('pages')
                            .insert([{ album_id: albumId, page_index: nextIdx }])
                            .select();

                        if (npe2) throw npe2;
                        pages.push(nPage[0]);
                    }
                }
            }
        }

        // Batch insert all cards
        if (cardsToInsert.length > 0) {
            // Split into chunks of 50 to avoid potential URL/payload limits
            for (let i = 0; i < cardsToInsert.length; i += 50) {
                const chunk = cardsToInsert.slice(i, i + 50);
                const { error: insErr } = await _supabase
                    .from('card_slots')
                    .insert(chunk);
                if (insErr) throw insErr;
            }
        }
    }
});
