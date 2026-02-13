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
let lastAutoScanTime = Date.now();
let tesseractWorker = null;

async function initTesseract() {
    if (tesseractWorker) return;
    tesseractWorker = await Tesseract.createWorker('eng');
    await tesseractWorker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/-'
    });
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

function drawFeedback(maxContour, video) {
    const canvas = document.getElementById('overlay-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (maxContour) {
        const scaleX = canvas.width / video.videoWidth;
        const scaleY = canvas.height / video.videoHeight;

        ctx.strokeStyle = '#00d2ff';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < maxContour.rows; i++) {
            let x = maxContour.data32S[i * 2] * scaleX;
            let y = maxContour.data32S[i * 2 + 1] * scaleY;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();

        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00d2ff';
        ctx.stroke();
    }
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

    // Multi-approach detection: Canny + Thresholding
    let thresh = new cv.Mat();
    cv.adaptiveThreshold(gray, thresh, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);

    cv.Canny(blurred, edges, 50, 150);
    cv.add(edges, thresh, edges); // Combine for better edges

    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let maxContour = null;
    let maxArea = 0;

    for (let i = 0; i < contours.size(); ++i) {
        let cnt = contours.get(i);
        let area = cv.contourArea(cnt);
        if (area > 10000) {
            let peri = cv.arcLength(cnt, true);
            let approx = new cv.Mat();
            cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

            // Allow 4 to 6 points to be more lenient with rounded corners/sleeves
            if (approx.rows >= 4 && approx.rows <= 6) {
                let rect = cv.boundingRect(approx);
                let ratio = rect.width / rect.height;
                // Standard TCG ratio is ~0.71. Accept 0.6 to 0.85 (vertical)
                if ((ratio > 0.55 && ratio < 0.9) || (ratio > 1.1 && ratio < 1.8)) {
                    if (area > maxArea) {
                        maxArea = area;
                        if (maxContour) maxContour.delete();
                        maxContour = approx.clone();
                    }
                }
            }
            approx.delete();
        }
    }

    drawFeedback(maxContour, video);

    const now = Date.now();
    if (maxContour) {
        lastAutoScanTime = now; // Reset auto-scan timer
        if (!lastContourTime) {
            lastContourTime = now;
        } else if (now - lastContourTime > 600) {
            captureAndProcess(src.clone(), maxContour.clone());
            lastContourTime = 0;
        }
    } else {
        lastContourTime = 0;
        // Fallback: If no card detected for 4 seconds, scan the center area
        if (now - lastAutoScanTime > 4000) {
            lastAutoScanTime = now;
            captureAndProcess(src.clone(), null);
        }
    }

    src.delete(); gray.delete(); blurred.delete(); edges.delete(); contours.delete(); hierarchy.delete(); thresh.delete();
    if (maxContour) maxContour.delete();
}

async function captureAndProcess(src, contour) {
    let warped = new cv.Mat();
    let dsize = new cv.Size(800, 1120);

    if (contour) {
        let corners = getOrderedPoints(contour);
        let srcCoords = cv.matFromArray(4, 1, cv.CV_32FC2, corners);
        let dstCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, 800, 0, 800, 1120, 0, 1120]);
        let M = cv.getPerspectiveTransform(srcCoords, dstCoords);
        cv.warpPerspective(src, warped, M, dsize);
        srcCoords.delete(); dstCoords.delete(); M.delete();
    } else {
        // Center crop fallback
        let rect = new cv.Rect(src.cols * 0.2, src.rows * 0.1, src.cols * 0.6, src.rows * 0.8);
        let crop = src.roi(rect);
        cv.resize(crop, warped, dsize);
        crop.delete();
    }

    // Preview original warped
    cv.imshow('cv-preview', warped);
    $('#cv-preview').show();

    $('#status-text').text('Identificando...');
    $('#status-container').addClass('status-working');

    // Bottom 30% crop (y from 784 to 1120)
    let bottomRegion = new cv.Rect(0, 784, 800, 336);
    let bottomMat = warped.roi(bottomRegion);

    // Split left/right halves
    let leftRect = new cv.Rect(0, 0, 400, 336);
    let rightRect = new cv.Rect(400, 0, 400, 336);
    let leftCrop = bottomMat.roi(leftRect);
    let rightCrop = bottomMat.roi(rightRect);

    const processForOCR = (mat) => {
        let gray = new cv.Mat();
        let contrast = new cv.Mat();
        let thresh = new cv.Mat();

        cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
        // Increase contrast (1.5x alpha)
        cv.convertScaleAbs(gray, contrast, 1.5, 0);
        // B&W conversion
        cv.threshold(contrast, thresh, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);

        gray.delete(); contrast.delete();
        return thresh;
    };

    let leftProcessed = processForOCR(leftCrop);
    let rightProcessed = processForOCR(rightCrop);

    await initTesseract();
    const canvas = document.getElementById('hidden-canvas');
    let combinedText = "";

    // OCR Left
    cv.imshow(canvas, leftProcessed);
    const { data: { text: textL } } = await tesseractWorker.recognize(canvas);
    combinedText += textL + " ";

    // OCR Right
    cv.imshow(canvas, rightProcessed);
    const { data: { text: textR } } = await tesseractWorker.recognize(canvas);
    combinedText += textR;

    await processDetectedText(combinedText);

    // Deallocate everything
    leftProcessed.delete(); rightProcessed.delete();
    leftCrop.delete(); rightCrop.delete();
    bottomMat.delete();
    warped.delete();
    src.delete(); if (contour) contour.delete();
}

function identifyFromText(text) {
    const normalizeDigits = (s) => s.replace(/O/g, '0').replace(/I/g, '1').replace(/L/g, '1').replace(/S/g, '5').replace(/B/g, '8').replace(/Z/g, '2').replace(/G/g, '6');

    // Remove unwanted characters except essential ones for codes
    const cleanText = text.replace(/[^a-zA-Z0-9\/\-\|]/g, ' ');

    // 1. Yu-Gi-Oh (Strict regex: MP23-EN001, LOB-005)
    // Format: [Prefix]-[Optional SubPrefix][Number]
    const regexYG = /[A-Z0-9]{2,6}-[A-Z0-9]{3,}/i;
    const matchYG = cleanText.match(regexYG);
    if (matchYG) {
        let full = matchYG[0].toUpperCase();
        let parts = full.split('-');
        let secondPart = parts[1];
        // Normalize only the trailing digits which are most prone to OCR errors
        let normalizedSecond = secondPart.replace(/[0-9OILS BZG]+$/, (m) => normalizeDigits(m.replace(/\s/g, '')));
        return { code: parts[0] + '-' + normalizedSecond, type: 'yugioh' };
    }

    // 2. Pokemon (58/102, TG17/TG30, SWSH020)
    const regexPK_Fraction = /\b([A-Z0-9]{1,5})[\/\|]([A-Z0-9]{1,5})\b/i;
    const matchFraction = cleanText.match(regexPK_Fraction);

    if (matchFraction) {
        let n1 = matchFraction[1].toUpperCase();
        let n2 = matchFraction[2].toUpperCase();

        // Helper to decide if we should normalize (only if it's mostly numeric)
        const shouldNormalize = (s) => {
            const digitCount = (s.match(/[0-9]/g) || []).length;
            const errorProneCount = (s.match(/[OILS BZG]/g) || []).length;
            return digitCount + errorProneCount >= s.length;
        };

        if (shouldNormalize(n1)) n1 = normalizeDigits(n1);
        if (shouldNormalize(n2)) n2 = normalizeDigits(n2);

        return { code: n1 + '/' + n2, type: 'pokemon' };
    }

    const regexPK_Promo = /\b([A-Z]{2,5})([0-9OILS BZG]{2,3})\b/i;
    const matchPromo = cleanText.match(regexPK_Promo);
    if (matchPromo) {
        let prefix = matchPromo[1].toUpperCase();
        let num = normalizeDigits(matchPromo[2].toUpperCase().trim());
        return { code: prefix + num, type: 'pokemon' };
    }

    return { code: null, type: null };
}

async function processDetectedText(text) {
    const { code, type } = identifyFromText(text);

    if (code) {
        $('#detected-code').text(code);
        await handleFoundCode(code, type);
    } else {
        const clean = text.trim().replace(/[\n\r]/g, ' ').substring(0, 20);
        if (clean.length > 3) {
            $('#detected-code').html(`<span style="opacity: 0.5; font-size: 0.8rem;">? ${clean}</span> <i class="fas fa-edit" style="cursor:pointer; margin-left: 5px;" onclick="promptCorrection('${clean.replace(/'/g, "\\'")}')"></i>`);
        }
        $('#status-text').text('Escaneando...');
        $('#status-container').removeClass('status-working');
    }
}

async function promptCorrection(detectedText) {
    const { value: correctedCode } = await Swal.fire({
        title: 'Corregir Código',
        input: 'text',
        inputValue: detectedText,
        inputLabel: 'El scanner no está seguro, corrígelo:',
        showCancelButton: true,
        confirmButtonColor: '#00d2ff',
        background: '#1a1a2e',
        color: '#fff'
    });

    if (correctedCode) {
        const detected = identifyFromText(correctedCode.toUpperCase());
        await handleFoundCode(detected.code || correctedCode.toUpperCase(), detected.type || 'pokemon');
    }
}

async function handleFoundCode(code, type) {
    if (window.lastProcessedCode === code) return;
    window.lastProcessedCode = code;

    const cardData = await fetchCardData(code, type);
    if (cardData) {
        const saved = await saveCard(cardData);
        if (saved) {
            showToast('success', 'Carta Añadida', cardData.name, cardData.image_url);
        }
    } else {
        showToast('error', 'Error de Búsqueda', `No se encontró la carta ${code}`);
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
            // YGOPRODeck API uses cardset for set code searches
            const res = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${code}`);
            const data = await res.json();
            if (data.data && data.data.length > 0) {
                const card = data.data[0];
                return {
                    name: card.name,
                    image_url: card.card_images[0].image_url,
                    rarity: card.card_sets?.find(s => s.set_code === code)?.set_rarity || '',
                    expansion: card.card_sets?.find(s => s.set_code === code)?.set_name || '',
                    type: 'yugioh'
                };
            }
        } else {
            // Pokemon - Try api.pokemontcg.io primary
            let number = code;
            if (code.includes('/')) {
                number = code.split('/')[0];
            }

            try {
                const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=number:${number}`);
                const data = await res.json();
                if (data.data && data.data.length > 0) {
                    let card = data.data[0];
                    // If we have a fraction, try to match the total too for better accuracy
                    if (code.includes('/')) {
                        const total = code.split('/')[1];
                        const bestMatch = data.data.find(c => c.set.printedTotal == total);
                        if (bestMatch) card = bestMatch;
                    }

                    return {
                        name: card.name,
                        image_url: card.images.large,
                        rarity: card.rarity || '',
                        expansion: card.set.name || '',
                        type: 'pokemon'
                    };
                }
            } catch (err) {
                console.error("Pokemon TCG API Error:", err);
            }

            // Fallback to tcgdex.net
            let resFallback = await fetch(`https://api.tcgdex.net/v2/en/cards/${code.toLowerCase()}`);
            if (resFallback.ok) {
                const card = await resFallback.json();
                return {
                    name: card.name,
                    image_url: `${card.image}/high.webp`,
                    rarity: card.rarity || '',
                    expansion: card.set.name || '',
                    type: 'pokemon'
                };
            }

            // Try searching by localId on tcgdex
            if (code.includes('/')) {
                const localId = code.split('/')[0];
                const resLocal = await fetch(`https://api.tcgdex.net/v2/en/cards?localId=${localId}`);
                if (resLocal.ok) {
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
        }
    } catch (err) {
        console.error("Error fetching card data:", err);
    }
    return null;
}

function showToast(type, title, message, imageUrl = null) {
    const $toast = $('#result-toast');
    $toast.removeClass('success error active');

    $('#toast-title').text(title);
    $('#toast-name').text(message);

    if (imageUrl) {
        $('#toast-img').attr('src', imageUrl).show();
        $('#toast-icon-err').hide();
    } else {
        $('#toast-img').hide();
        $('#toast-icon-err').css('display', 'flex');
    }

    $toast.addClass(type).addClass('active');

    setTimeout(() => {
        $toast.removeClass('active');
    }, 3000);
}

function getOrderedPoints(contour) {
    let pts = [];
    if (contour.rows !== 4) {
        let rect = cv.minAreaRect(contour);
        let vertices;
        try {
            vertices = cv.rotatedRectPoints(rect);
        } catch (e) {
            // Fallback for different OpenCV versions
            let box = new cv.Mat();
            cv.boxPoints(rect, box);
            vertices = [];
            for (let i = 0; i < 4; i++) {
                vertices.push({ x: box.data32F[i * 2], y: box.data32F[i * 2 + 1] });
            }
            box.delete();
        }
        for (let i = 0; i < 4; i++) {
            pts.push({ x: vertices[i].x, y: vertices[i].y });
        }
    } else {
        for (let i = 0; i < 4; i++) {
            pts.push({ x: contour.data32S[i * 2], y: contour.data32S[i * 2 + 1] });
        }
    }
    pts.sort((a, b) => a.y - b.y);
    let top = pts.slice(0, 2).sort((a, b) => a.x - b.x);
    let bottom = pts.slice(2, 4).sort((a, b) => a.x - b.x);
    return [top[0].x, top[0].y, top[1].x, top[1].y, bottom[1].x, bottom[1].y, bottom[0].x, bottom[0].y];
}
