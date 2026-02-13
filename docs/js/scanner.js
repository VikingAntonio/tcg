let cvReady = false;
let isScanning = false;
let stream = null;
let currentUser = null;

// OpenCV Entry Point
window.onOpenCvReady = function() {
    cvReady = true;
    $('#status-text').text('Motor Listo');
    $('#status-container').addClass('status-ready');
    $('#btn-toggle-scan').prop('disabled', false);
};

$(document).ready(async function() {
    checkSession();
    await loadInitialData();

    $('#select-target-type').change(function() {
        const type = $(this).val();
        $('#dest-label').text(type === 'album' ? 'Seleccionar Álbum' : 'Seleccionar Deck');
        loadDestinations(type);
    });

    $('#btn-new-dest').click(createNewDestination);

    $('#btn-toggle-scan').click(async function() {
        if (!isScanning) {
            await startScanner();
        } else {
            stopScanner();
        }
    });

    $('#btn-manual').click(async function() {
        const { value: code } = await Swal.fire({
            title: 'Entrada Manual',
            input: 'text',
            inputLabel: 'Introduce el código de la carta',
            inputPlaceholder: 'LOB-001 / 58/102',
            showCancelButton: true,
            confirmButtonColor: '#00d2ff',
            background: '#1a1a2e',
            color: '#fff'
        });

        if (code) {
            const detected = identifyFromText(code.toUpperCase());
            if (detected.code) {
                handleFoundCode(detected.code, detected.type);
            } else {
                // Try as raw code if identification fails
                handleFoundCode(code.toUpperCase(), 'pokemon'); // Pokemon is more common for raw IDs
            }
        }
    });
});

function checkSession() {
    const session = localStorage.getItem('tcg_session');
    if (session) {
        currentUser = JSON.parse(session);
    } else {
        window.location.href = 'admin.html';
    }
}

async function loadInitialData() {
    await loadDestinations('album');
}

async function loadDestinations(type) {
    const table = type === 'album' ? 'albums' : 'decks';
    const { data, error } = await _supabase
        .from(table)
        .select('*')
        .eq('user_id', currentUser.id)
        .order('id', { ascending: true });

    const $select = $('#select-dest');
    $select.empty();
    if (data && data.length > 0) {
        data.forEach(item => {
            $select.append(`<option value="${item.id}">${item.title || item.name}</option>`);
        });
    } else {
        $select.append(`<option value="">No hay ${type}s</option>`);
    }
}

async function createNewDestination() {
    const type = $('#select-target-type').val();
    const { value: name } = await Swal.fire({
        title: `Nuevo ${type === 'album' ? 'Álbum' : 'Deck'}`,
        input: 'text',
        inputLabel: `Nombre del ${type}`,
        showCancelButton: true,
        confirmButtonColor: '#00d2ff',
        background: '#1a1a2e',
        color: '#fff'
    });

    if (name) {
        const table = type === 'album' ? 'albums' : 'decks';
        const field = type === 'album' ? 'title' : 'name';
        const { data, error } = await _supabase
            .from(table)
            .insert([{ [field]: name, user_id: currentUser.id }])
            .select();

        if (!error) {
            await loadDestinations(type);
            $('#select-dest').val(data[0].id);
        }
    }
}

async function startScanner() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        const video = document.getElementById('video-preview');
        video.srcObject = stream;

        isScanning = true;
        $('#btn-toggle-scan').html('<i class="fas fa-stop"></i> Detener Scanner').removeClass('btn-primary').addClass('btn-secondary');
        $('#scanner-viewport').addClass('scanner-active');
        $('#status-text').text('Escaneando...');

        processVideo();
    } catch (err) {
        console.error("Error accessing camera:", err);
        Swal.fire('Error', 'No se pudo acceder a la cámara. Revisa los permisos.', 'error');
    }
}

function stopScanner() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        document.getElementById('video-preview').srcObject = null;
    }
    isScanning = false;
    $('#btn-toggle-scan').html('<i class="fas fa-play"></i> Iniciar Scanner').removeClass('btn-secondary').addClass('btn-primary');
    $('#scanner-viewport').removeClass('scanner-active');
    $('#status-text').text('Pausado');
    $('#status-container').removeClass('status-working');
}

// OpenCV Engine Logic
let lastContourTime = 0;
let tesseractWorker = null;

async function initTesseract() {
    if (tesseractWorker) return;
    tesseractWorker = await Tesseract.createWorker('eng');
}

function processVideo() {
    if (!isScanning || !cvReady) return;

    const video = document.getElementById('video-preview');

    const loop = () => {
        if (!isScanning) return;

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            try {
                detectCard(video);
            } catch (e) {
                console.error("OpenCV Loop Error:", e);
            }
        }

        setTimeout(() => requestAnimationFrame(loop), 100);
    };
    requestAnimationFrame(loop);
}

function detectCard(video) {
    let src = cv.imread(video);
    let gray = new cv.Mat();
    let blurred = new cv.Mat();
    let edges = new cv.Mat();
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 75, 200);

    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let maxContour = null;
    let maxArea = 0;

    for (let i = 0; i < contours.size(); ++i) {
        let cnt = contours.get(i);
        let area = cv.contourArea(cnt);
        if (area > 15000) {
            let peri = cv.arcLength(cnt, true);
            let approx = new cv.Mat();
            cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

            if (approx.rows === 4) {
                let rect = cv.boundingRect(approx);
                let ratio = rect.width / rect.height;
                // Aspect ratio check (vertical or horizontal)
                if ((ratio > 0.6 && ratio < 0.85) || (ratio > 1.2 && ratio < 1.6)) {
                    if (area > maxArea) {
                        maxArea = area;
                        maxContour = approx.clone();
                    }
                }
            }
            approx.delete();
        }
    }

    if (maxContour) {
        const now = Date.now();
        if (!lastContourTime) {
            lastContourTime = now;
        } else if (now - lastContourTime > 600) {
            captureAndProcess(src.clone(), maxContour.clone());
            lastContourTime = 0;
        }
    } else {
        lastContourTime = 0;
    }

    src.delete(); gray.delete(); blurred.delete(); edges.delete(); contours.delete(); hierarchy.delete();
    if (maxContour) maxContour.delete();
}

async function captureAndProcess(src, contour) {
    let warped = new cv.Mat();
    let dsize = new cv.Size(300, 420);

    let corners = getOrderedPoints(contour);
    let srcCoords = cv.matFromArray(4, 1, cv.CV_32FC2, corners);
    let dstCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, 300, 0, 300, 420, 0, 420]);

    let M = cv.getPerspectiveTransform(srcCoords, dstCoords);
    cv.warpPerspective(src, warped, M, dsize);

    cv.imshow('cv-preview', warped);
    $('#cv-preview').show();

    $('#status-text').text('Identificando...');
    $('#status-container').addClass('status-working');

    // OCR Analysis
    const canvas = document.getElementById('hidden-canvas');
    cv.imshow(canvas, warped);

    await initTesseract();
    const { data: { text } } = await tesseractWorker.recognize(canvas);
    await processDetectedText(text);

    warped.delete(); srcCoords.delete(); dstCoords.delete(); M.delete();
    src.delete(); contour.delete();
}

function identifyFromText(text) {
    const cleanText = text.replace(/[^a-zA-Z0-9\/\-]/g, ' ');
    const words = cleanText.split(/\s+/);

    const regexYG = /[A-Z0-9]+-[A-Z0-9-]+/i;
    const regexPK1 = /\d+\/\d+/;
    const regexPK2 = /[A-Z]{2,}\d+/i;
    const regexPK3 = /[A-Z0-9]+\/[A-Z0-9]+/i;

    for (const word of words) {
        if (regexYG.test(word)) {
            return { code: word.match(regexYG)[0].toUpperCase(), type: 'yugioh' };
        } else if (regexPK1.test(word)) {
            return { code: word.match(regexPK1)[0], type: 'pokemon' };
        } else if (regexPK2.test(word)) {
            return { code: word.match(regexPK2)[0].toUpperCase(), type: 'pokemon' };
        } else if (regexPK3.test(word)) {
            return { code: word.match(regexPK3)[0].toUpperCase(), type: 'pokemon' };
        }
    }
    return { code: null, type: null };
}

async function processDetectedText(text) {
    const { code, type } = identifyFromText(text);

    if (code) {
        $('#detected-code').text(code);
        await handleFoundCode(code, type);
    } else {
        $('#status-text').text('Escaneando...');
        $('#status-container').removeClass('status-working');
    }
}

async function handleFoundCode(code, type) {
    if (window.lastProcessedCode === code) return;
    window.lastProcessedCode = code;

    const cardData = await fetchCardData(code, type);
    if (cardData) {
        const saved = await saveCard(cardData);
        if (saved) {
            showToast(cardData);
        }
    } else {
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            background: '#1a1a2e',
            color: '#fff'
        });
        Toast.fire({
            icon: 'error',
            title: `No encontrada: ${code}`
        });
    }

    setTimeout(() => {
        window.lastProcessedCode = null;
        if (isScanning) {
            $('#status-text').text('Escaneando...');
            $('#status-container').removeClass('status-working');
            $('#detected-code').text('');
        }
    }, 4000);
}

async function saveCard(cardData) {
    const targetType = $('#select-target-type').val();
    const destId = $('#select-dest').val();

    if (!destId) {
        Swal.fire('Error', 'Selecciona un destino primero', 'error');
        return false;
    }

    try {
        if (targetType === 'album') {
            // Find pages
            let { data: pages } = await _supabase
                .from('pages')
                .select('id, page_index')
                .eq('album_id', destId)
                .order('page_index', { ascending: true });

            if (!pages || pages.length === 0) {
                const { data: newPage, error: pErr } = await _supabase
                    .from('pages')
                    .insert([{ album_id: destId, page_index: 0 }])
                    .select();
                if (pErr) throw pErr;
                pages = newPage;
            }

            // Find free slot (Optimized Batch lookup)
            const { data: allSlots } = await _supabase
                .from('card_slots')
                .select('page_id, slot_index')
                .in('page_id', pages.map(p => p.id));

            let saved = false;
            for (const page of pages) {
                const occupied = (allSlots || [])
                    .filter(s => s.page_id === page.id)
                    .map(s => s.slot_index);

                for (let i = 0; i < 9; i++) {
                    if (!occupied.includes(i)) {
                        const { error } = await _supabase
                            .from('card_slots')
                            .insert([{
                                page_id: page.id,
                                slot_index: i,
                                name: cardData.name,
                                image_url: cardData.image_url,
                                rarity: cardData.rarity,
                                expansion: cardData.expansion,
                                condition: 'M',
                                quantity: 1
                            }]);
                        if (error) throw error;
                        saved = true;
                        break;
                    }
                }
                if (saved) break;
            }

            if (!saved) {
                // All pages full, silent creation
                const lastIndex = pages[pages.length - 1].page_index;
                const { data: newPage, error: pErr } = await _supabase
                    .from('pages')
                    .insert([{ album_id: destId, page_index: lastIndex + 1 }])
                    .select();
                if (pErr) throw pErr;

                const { error: sErr } = await _supabase
                    .from('card_slots')
                    .insert([{
                        page_id: newPage[0].id,
                        slot_index: 0,
                        name: cardData.name,
                        image_url: cardData.image_url,
                        rarity: cardData.rarity,
                        expansion: cardData.expansion,
                        condition: 'M',
                        quantity: 1
                    }]);
                if (sErr) throw sErr;
            }
            return true;

        } else {
            // Deck
            const { error } = await _supabase
                .from('deck_cards')
                .insert([{
                    deck_id: destId,
                    name: cardData.name,
                    image_url: cardData.image_url,
                    rarity: cardData.rarity,
                    expansion: cardData.expansion,
                    quantity: 1
                }]);
            if (error) throw error;
            return true;
        }
    } catch (err) {
        console.error("Save Error:", err);
        return false;
    }
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
            // Pokemon
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

            // Try searching by localId if / is present
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

function showToast(card) {
    const $toast = $('#result-toast');
    $('#toast-img').attr('src', card.image_url).show();
    $('#toast-name').text(card.name);
    $toast.addClass('active');
    setTimeout(() => { $toast.removeClass('active'); }, 3000);
}

function getOrderedPoints(contour) {
    let pts = [];
    for (let i = 0; i < 4; i++) {
        pts.push({ x: contour.data32S[i * 2], y: contour.data32S[i * 2 + 1] });
    }
    pts.sort((a, b) => a.y - b.y);
    let top = pts.slice(0, 2).sort((a, b) => a.x - b.x);
    let bottom = pts.slice(2, 4).sort((a, b) => a.x - b.x);
    return [top[0].x, top[0].y, top[1].x, top[1].y, bottom[1].x, bottom[1].y, bottom[0].x, bottom[0].y];
}
