let currentUser = null;
let currentAlbumId = null;
let currentDeckId = null;
let currentPageId = null;

$(document).ready(async function() {
    checkSession();

    // --- UI Event Handlers ---
    $('#select-target-type').change(function() {
        const type = $(this).val();
        if (type === 'album') {
            $('#album-selection-container').show();
            $('#page-selection-container').show();
            $('#deck-selection-container').hide();
        } else {
            $('#album-selection-container').hide();
            $('#page-selection-container').hide();
            $('#deck-selection-container').show();
        }
    });

    $('#select-album').change(function() {
        currentAlbumId = $(this).val();
        loadAlbumPages(currentAlbumId);
    });

    $('#select-page').change(function() {
        currentPageId = $(this).val();
    });

    $('#select-deck').change(function() {
        currentDeckId = $(this).val();
    });

    $('#btn-new-album').click(createNewAlbum);
    $('#btn-new-deck').click(createNewDeck);
    $('#btn-new-page').click(createNewPage);

    $('#btn-manual-entry').click(async function() {
        const { value: code } = await Swal.fire({
            title: 'Entrada Manual',
            input: 'text',
            inputLabel: 'Introduce el código de la carta',
            inputPlaceholder: 'LOB-001 / 58/102',
            showCancelButton: true
        });

        if (code) {
            let type = 'pokemon';
            if (code.includes('-')) type = 'yugioh';
            handleFoundCode(code, type);
        }
    });

    $('#btn-toggle-scan').click(async function() {
        if (!isScanning) {
            const ok = await startCamera();
            if (ok) {
                if (!tesseractWorker) await initScanner();
                startScanning();
                $(this).html('<i class="fas fa-stop"></i> Detener Scanner').addClass('btn-danger');
                $('#scan-status').text('Escaneando...').removeClass('status-idle').addClass('status-scanning');
                isScanning = true;
            }
        } else {
            stopScanning();
            stopCamera();
            $(this).html('<i class="fas fa-play"></i> Iniciar Scanner').removeClass('btn-danger');
            $('#scan-status').text('Pausado').removeClass('status-scanning').addClass('status-idle');
            isScanning = false;
        }
    });

    // Initial Load
    await loadInitialData();
});

let isScanning = false;
let tesseractWorker = null;
let stream = null;
let scanInterval = null;

async function initScanner() {
    $('#scan-status').text('Inicializando OCR...').removeClass('status-idle').addClass('status-loading');
    tesseractWorker = await Tesseract.createWorker('eng');
    $('#scan-status').text('OCR Listo').removeClass('status-loading').addClass('status-idle');
}

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        document.getElementById('video-preview').srcObject = stream;
        return true;
    } catch (err) {
        console.error("Error accessing camera:", err);
        Swal.fire('Error', 'No se pudo acceder a la cámara. Asegúrate de dar permisos.', 'error');
        return false;
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        document.getElementById('video-preview').srcObject = null;
    }
}

function startScanning() {
    if (scanInterval) clearInterval(scanInterval);
    scanInterval = setInterval(async () => {
        if (!isScanning) return;
        await captureAndRecognize();
    }, 2000);
}

function stopScanning() {
    clearInterval(scanInterval);
}

async function captureAndRecognize() {
    const video = document.getElementById('video-preview');
    const canvas = document.getElementById('ocr-canvas');
    const context = canvas.getContext('2d');

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw === 0) return;

    const rw = vw * 0.8;
    const rh = vh * 0.4;
    const rx = (vw - rw) / 2;
    const ry = (vh - rh) / 2;

    canvas.width = rw;
    canvas.height = rh;

    context.drawImage(video, rx, ry, rw, rh, 0, 0, rw, rh);

    try {
        const { data: { text } } = await tesseractWorker.recognize(canvas);
        if (text) processDetectedText(text);
    } catch (err) {
        console.error("OCR Error:", err);
    }
}

function processDetectedText(text) {
    const cleanText = text.replace(/[^a-zA-Z0-9\/\-]/g, ' ');
    const words = cleanText.split(/\s+/);

    const regexYG = /[A-Z0-9]+-[A-Z0-9]+/i;
    const regexPK1 = /\d+\/\d+/;
    const regexPK2 = /[A-Z]{2,}\d+/i;

    let foundCode = null;
    let foundType = null;

    for (const word of words) {
        if (regexYG.test(word)) {
            foundCode = word.match(regexYG)[0].toUpperCase();
            foundType = 'yugioh';
            break;
        } else if (regexPK1.test(word)) {
            foundCode = word.match(regexPK1)[0];
            foundType = 'pokemon';
            break;
        } else if (regexPK2.test(word)) {
            foundCode = word.match(regexPK2)[0].toUpperCase();
            foundType = 'pokemon';
            break;
        }
    }

    if (foundCode) {
        $('#detected-code-display').text(`Código detectado: ${foundCode}`);
        handleFoundCode(foundCode, foundType);
    }
}

async function handleFoundCode(code, type) {
    if (window.lastProcessedCode === code) return;
    window.lastProcessedCode = code;

    stopScanning();
    $('#scan-status').text('Buscando carta...').removeClass('status-scanning').addClass('status-loading');

    const cardData = await fetchCardData(code, type);

    if (cardData) {
        const saved = await saveCard(cardData);
        if (saved) {
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true
            });
            Toast.fire({
                icon: 'success',
                title: `Añadida: ${cardData.name}`
            });
        }
    } else {
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
        });
        Toast.fire({
            icon: 'error',
            title: `No encontrada: ${code}`
        });
    }

    setTimeout(() => {
        if (isScanning) {
            startScanning();
            $('#scan-status').text('Escaneando...').removeClass('status-loading').addClass('status-scanning');
            $('#detected-code-display').text('Esperando código...');
            window.lastProcessedCode = null;
        }
    }, 2500);
}

async function fetchCardData(code, type) {
    try {
        if (type === 'yugioh') {
            const res = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?setcode=${code}`);
            const data = await res.json();
            if (data.data && data.data.length > 0) {
                const card = data.data[0];
                return {
                    name: card.name,
                    image_url: card.card_images[0].image_url,
                    rarity: card.card_sets.find(s => s.set_code === code)?.set_rarity || '',
                    expansion: card.card_sets.find(s => s.set_code === code)?.set_name || '',
                    type: 'yugioh'
                };
            }
        } else {
            let res = await fetch(`https://api.tcgdex.net/v2/en/cards/${code.toLowerCase()}`);
            if (res.ok) {
                const card = await res.json();
                return {
                    name: card.name,
                    image_url: `${card.image}/high.webp`,
                    rarity: card.rarity || '',
                    expansion: card.set.name || '',
                    type: 'pokemon'
                };
            }

            if (code.includes('/')) {
                const localId = code.split('/')[0];
                const resLocal = await fetch(`https://api.tcgdex.net/v2/en/cards?localId=${localId}`);
                const cards = await resLocal.json();
                if (cards && cards.length > 0) {
                    const cardShort = cards[0];
                    const resFull = await fetch(`https://api.tcgdex.net/v2/en/cards/${cardShort.id}`);
                    const card = await resFull.json();
                    return {
                        name: card.name,
                        image_url: `${card.image}/high.webp`,
                        rarity: card.rarity || '',
                        expansion: card.set.name || '',
                        type: 'pokemon'
                    };
                }
            }
        }
    } catch (err) {
        console.error("Error fetching card data:", err);
    }
    return null;
}

async function saveCard(cardData) {
    const targetType = $('#select-target-type').val();

    if (targetType === 'album') {
        if (!currentPageId) {
            Swal.fire('Error', 'No hay ninguna página seleccionada', 'error');
            return false;
        }

        const { data: slots, error: fetchErr } = await _supabase
            .from('card_slots')
            .select('slot_index')
            .eq('page_id', currentPageId);

        if (fetchErr) {
            console.error("Error fetching slots:", fetchErr);
            return false;
        }

        const occupiedSlots = slots.map(s => s.slot_index);
        let nextSlot = -1;
        for (let i = 0; i < 9; i++) {
            if (!occupiedSlots.includes(i)) {
                nextSlot = i;
                break;
            }
        }

        if (nextSlot === -1) {
            // Silently create new page
            await createNewPage();
            return saveCard(cardData);
        }

        const { error: saveErr } = await _supabase
            .from('card_slots')
            .insert([{
                page_id: currentPageId,
                slot_index: nextSlot,
                name: cardData.name,
                image_url: cardData.image_url,
                rarity: cardData.rarity,
                expansion: cardData.expansion,
                condition: 'M',
                quantity: 1
            }]);

        if (saveErr) {
            console.error("Error saving slot:", saveErr);
            return false;
        }
        return true;

    } else {
        if (!currentDeckId) {
            Swal.fire('Error', 'No hay ningún deck seleccionado', 'error');
            return false;
        }

        const { error: saveErr } = await _supabase
            .from('deck_cards')
            .insert([{
                deck_id: currentDeckId,
                name: cardData.name,
                image_url: cardData.image_url,
                rarity: cardData.rarity,
                expansion: cardData.expansion,
                quantity: 1
            }]);

        if (saveErr) {
            console.error("Error saving deck card:", saveErr);
            return false;
        }
        return true;
    }
}

function checkSession() {
    const session = localStorage.getItem('tcg_session');
    if (session) {
        currentUser = JSON.parse(session);
    } else {
        window.location.href = 'admin.html';
    }
}

async function loadInitialData() {
    $('#scan-status').text('Cargando datos...');
    await Promise.all([loadAlbums(), loadDecks()]);

    // Set initial album and load its pages
    if ($('#select-album').val()) {
        currentAlbumId = $('#select-album').val();
        await loadAlbumPages(currentAlbumId);
    }

    if ($('#select-deck').val()) {
        currentDeckId = $('#select-deck').val();
    }

    $('#scan-status').text('Listo').removeClass('status-idle').addClass('status-idle');
}

async function loadAlbums() {
    const { data: albums, error } = await _supabase
        .from('albums')
        .select('id, title')
        .eq('user_id', currentUser.id)
        .order('id', { ascending: true });

    if (error) {
        console.error("Error loading albums:", error);
        return;
    }

    const $select = $('#select-album');
    $select.empty();
    albums.forEach(album => {
        $select.append(`<option value="${album.id}">${album.title}</option>`);
    });
}

async function loadDecks() {
    const { data: decks, error } = await _supabase
        .from('decks')
        .select('id, name')
        .eq('user_id', currentUser.id)
        .order('id', { ascending: true });

    if (error) {
        console.error("Error loading decks:", error);
        return;
    }

    const $select = $('#select-deck');
    $select.empty();
    decks.forEach(deck => {
        $select.append(`<option value="${deck.id}">${deck.name}</option>`);
    });
}

async function loadAlbumPages(albumId) {
    const { data: pages, error } = await _supabase
        .from('pages')
        .select('id, page_index')
        .eq('album_id', albumId)
        .order('page_index', { ascending: true });

    if (error) {
        console.error("Error loading pages:", error);
        return;
    }

    const $select = $('#select-page');
    $select.empty();
    pages.forEach(page => {
        $select.append(`<option value="${page.id}">Página ${page.page_index + 1}</option>`);
    });

    // Select last page by default
    if (pages.length > 0) {
        const lastPageId = pages[pages.length - 1].id;
        $select.val(lastPageId);
        currentPageId = lastPageId;
    } else {
        currentPageId = null;
    }
}

async function createNewAlbum() {
    const { value: title } = await Swal.fire({
        title: 'Nuevo Álbum',
        input: 'text',
        inputLabel: 'Título del Álbum',
        inputPlaceholder: 'Mi Nuevo Álbum',
        showCancelButton: true
    });

    if (title) {
        const { data, error } = await _supabase
            .from('albums')
            .insert([{ title, user_id: currentUser.id }])
            .select();

        if (error) {
            Swal.fire('Error', 'No se pudo crear el álbum', 'error');
        } else {
            await loadAlbums();
            $('#select-album').val(data[0].id).change();
            // Automatically create first page
            await createNewPage();
        }
    }
}

async function createNewDeck() {
    const { value: name } = await Swal.fire({
        title: 'Nuevo Deck',
        input: 'text',
        inputLabel: 'Nombre del Deck',
        inputPlaceholder: 'Mi Nuevo Deck',
        showCancelButton: true
    });

    if (name) {
        const { data, error } = await _supabase
            .from('decks')
            .insert([{ name, user_id: currentUser.id }])
            .select();

        if (error) {
            Swal.fire('Error', 'No se pudo crear el deck', 'error');
        } else {
            await loadDecks();
            const newDeckId = data[0].id;
            $('#select-deck').val(newDeckId).change();
        }
    }
}

async function createNewPage() {
    if (!currentAlbumId) {
        Swal.fire('Atención', 'Selecciona un álbum primero', 'warning');
        return;
    }

    const { data: pages } = await _supabase
        .from('pages')
        .select('page_index')
        .eq('album_id', currentAlbumId)
        .order('page_index', { ascending: false })
        .limit(1);

    const nextIndex = (pages && pages.length > 0) ? pages[0].page_index + 1 : 0;

    const { data, error } = await _supabase
        .from('pages')
        .insert([{ album_id: currentAlbumId, page_index: nextIndex }])
        .select();

    if (error) {
        Swal.fire('Error', 'No se pudo añadir la página', 'error');
    } else {
        await loadAlbumPages(currentAlbumId);
        const newPageId = data[0].id;
        $('#select-page').val(newPageId).change();
    }
}
