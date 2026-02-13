let isScanning = false;
let stream = null;
let currentUser = null;
let tesseractWorker = null;
let scanTimer = null;

$(document).ready(async function() {
    checkSession();
    await loadInitialData();
    await initTesseract();

    $('#select-target-type').change(function() {
        const type = $(this).val();
        $('#dest-label').text(type === 'album' ? 'Seleccionar Álbum' : 'Seleccionar Deck');
        loadDestinations(type);
    });

    $('#btn-new-dest').click(createNewDestination);

    $('#btn-toggle-scan').click(async function() {
        if (!isScanning) {
            await startCamera();
        } else {
            stopCamera();
        }
    });

    $('#btn-upload').click(function() {
        $('#file-upload').click();
    });

    $('#file-upload').change(handleFileUpload);

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
            await processDetectedText(code.toUpperCase());
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

async function initTesseract() {
    if (tesseractWorker) return;
    $('#status-text').text('Iniciando OCR...');
    tesseractWorker = await Tesseract.createWorker('eng');
    await tesseractWorker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/-'
    });
    $('#status-text').text('Motor Listo');
    $('#status-container').addClass('status-ready');
}

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        const video = document.getElementById('video-preview');
        video.srcObject = stream;
        video.style.display = 'block';
        $('#file-preview').hide();

        isScanning = true;
        $('#btn-toggle-scan').html('<i class="fas fa-stop"></i> Detener').removeClass('btn-primary').addClass('btn-secondary');
        $('#scanner-viewport').addClass('scanner-active');
        $('#status-text').text('Escaneando...');

        startScanningLoop();
    } catch (err) {
        console.error("Error accessing camera:", err);
        Swal.fire('Error', 'No se pudo acceder a la cámara.', 'error');
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        document.getElementById('video-preview').srcObject = null;
    }
    isScanning = false;
    clearTimeout(scanTimer);
    $('#btn-toggle-scan').html('<i class="fas fa-camera"></i> Cámara').removeClass('btn-secondary').addClass('btn-primary');
    $('#scanner-viewport').removeClass('scanner-active');
    $('#status-text').text('Pausado');
    $('#status-container').removeClass('status-working');
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    stopCamera();

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = async function() {
            $('#file-preview').attr('src', event.target.result).show();
            $('#video-preview').hide();
            $('#status-text').text('Procesando Imagen...');
            $('#status-container').addClass('status-working');

            await processImage(img);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function startScanningLoop() {
    if (!isScanning) return;

    scanTimer = setTimeout(async () => {
        if (!isScanning) return;

        const video = document.getElementById('video-preview');
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            await captureAndProcessFrame(video);
        }

        startScanningLoop();
    }, 1500); // Scan every 1.5 seconds
}

async function captureAndProcessFrame(video) {
    const canvas = document.getElementById('hidden-canvas');
    const ctx = canvas.getContext('2d');

    // We want to capture the central slit area
    // The slit in UI is 80% width, 15% height
    const vW = video.videoWidth;
    const vH = video.videoHeight;

    // Calculate crop coordinates based on video dimensions
    // Assuming video is shown in a 1:1 container with object-fit: cover
    let cropW, cropH, cropX, cropY;

    if (vW > vH) {
        // Landscape: height is matched to container height
        cropH = vH * 0.15;
        cropW = vH * 0.80; // 80% of the visible width (which is vH)
        cropX = (vW - vH) / 2 + (vH * 0.10); // Center + 10% offset
        cropY = vH * 0.425; // Centered vertically (0.5 - 0.15/2)
    } else {
        // Portrait: width is matched to container width
        cropW = vW * 0.80;
        cropH = vW * 0.15;
        cropX = vW * 0.10;
        cropY = (vH - vW) / 2 + (vW * 0.425);
    }

    canvas.width = 600; // Fixed width for OCR optimization
    canvas.height = 112; // 600 * 0.15/0.80 = 112.5

    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);

    // Apply some basic preprocessing
    preprocessCanvas(canvas);

    $('#status-text').text('Identificando...');
    $('#status-container').addClass('status-working');

    await processImage(canvas);
}

function preprocessCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        // Grayscale
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        // Increase contrast
        const contrast = 1.5;
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        const newValue = factor * (avg - 128) + 128;

        data[i] = data[i + 1] = data[i + 2] = newValue;
    }
    ctx.putImageData(imageData, 0, 0);
}

async function processImage(imageOrCanvas) {
    try {
        const { data: { text } } = await tesseractWorker.recognize(imageOrCanvas);
        await processDetectedText(text);
    } catch (err) {
        console.error("OCR Error:", err);
        $('#status-text').text('Error en OCR');
        $('#status-container').removeClass('status-working');
    }
}

function identifyFromText(text) {
    const cleanText = text.replace(/[^a-zA-Z0-9\/\-\s]/g, ' ').toUpperCase();

    // Specific regex patterns from prompt
    const regexes = [
        // Yu-Gi-Oh: LOB-005, SDY-001, MP23-EN001
        /\b([A-Z0-9]{3,5}-[A-Z]{0,2}\d{3,5})\b/i,
        // Pokémon Fraction: 58/102, 123/198, TG17/TG30
        /\b([A-Z0-9]{1,5}\/[A-Z0-9]{1,5})\b/i,
        // Pokémon Promo: SWSH020
        /\b([A-Z]{2,5}\d{3,5})\b/i
    ];

    for (const regex of regexes) {
        const match = cleanText.match(regex);
        if (match) {
            return { code: match[1].replace(/\s/g, ''), type: regex.toString().includes('-') ? 'yugioh' : 'pokemon' };
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
        const raw = text.trim().replace(/[\n\r]/g, ' ').substring(0, 30);
        if (raw.length > 3) {
            $('#detected-code').html(`<span style="opacity: 0.5; font-size: 0.8rem;">? ${raw}</span> <i class="fas fa-edit" style="cursor:pointer; margin-left: 5px;" onclick="promptCorrection('${raw.replace(/'/g, "\\'")}')"></i>`);

            // If it's a camera scan, we don't auto-popup to avoid annoyance, but if it's a file upload, we might
            if (!$('#file-preview').is(':visible')) {
                 $('#status-text').text('Escaneando...');
                 $('#status-container').removeClass('status-working');
            } else {
                Swal.fire({
                    title: 'Código no detectado',
                    text: 'No pudimos encontrar un código válido. ¿Quieres ingresarlo manualmente?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, editar',
                    cancelButtonText: 'No'
                }).then((result) => {
                    if (result.isConfirmed) {
                        promptCorrection(raw);
                    }
                });
            }
        } else {
            $('#status-text').text('Escaneando...');
            $('#status-container').removeClass('status-working');
            $('#detected-code').text('');
        }
    }
}

async function promptCorrection(detectedText) {
    const { value: correctedCode } = await Swal.fire({
        title: 'Corregir Código',
        input: 'text',
        inputValue: detectedText,
        inputLabel: 'Introduce el código correcto:',
        showCancelButton: true,
        confirmButtonColor: '#00d2ff',
        background: '#1a1a2e',
        color: '#fff'
    });

    if (correctedCode) {
        const { code, type } = identifyFromText(correctedCode);
        await handleFoundCode(code || correctedCode.toUpperCase(), type || 'pokemon');
    }
}

async function handleFoundCode(code, type) {
    if (window.lastProcessedCode === code) return;
    window.lastProcessedCode = code;

    $('#status-text').text('Buscando...');
    const cardData = await fetchCardData(code, type);

    if (cardData) {
        const saved = await saveCard(cardData);
        if (saved) {
            showToast('success', 'Carta Añadida', cardData.name, cardData.image_url);
        }
    } else {
        showToast('error', 'No encontrado', `No se encontró la carta ${code}`);
    }

    setTimeout(() => {
        window.lastProcessedCode = null;
        if (isScanning) {
            $('#status-text').text('Escaneando...');
            $('#status-container').removeClass('status-working');
            $('#detected-code').text('');
        } else {
            $('#status-text').text('Listo');
            $('#status-container').removeClass('status-working');
        }
    }, 4000);
}

async function fetchCardData(code, type) {
    try {
        if (type === 'yugioh') {
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
            // Pokemon
            let query = code.includes('/') ? `number:${code.split('/')[0]} set.printedTotal:${code.split('/')[1]}` : `number:${code}`;
            const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}`);
            const data = await res.json();

            if (data.data && data.data.length > 0) {
                let card = data.data[0];
                return {
                    name: card.name,
                    image_url: card.images.large,
                    rarity: card.rarity || '',
                    expansion: card.set.name || '',
                    type: 'pokemon'
                };
            }

            // Fallback tcgdex
            const resFb = await fetch(`https://api.tcgdex.net/v2/en/cards/${code.toLowerCase()}`);
            if (resFb.ok) {
                const card = await resFb.json();
                return {
                    name: card.name,
                    image_url: `${card.image}/high.webp`,
                    rarity: card.rarity || '',
                    expansion: card.set.name || '',
                    type: 'pokemon'
                };
            }
        }
    } catch (err) {
        console.error("Fetch Error:", err);
    }
    return null;
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
            let { data: pages } = await _supabase.from('pages').select('id, page_index').eq('album_id', destId).order('page_index', { ascending: true });
            if (!pages || pages.length === 0) {
                const { data: newPage } = await _supabase.from('pages').insert([{ album_id: destId, page_index: 0 }]).select();
                pages = newPage;
            }

            const { data: allSlots } = await _supabase.from('card_slots').select('page_id, slot_index').in('page_id', pages.map(p => p.id));
            let saved = false;
            for (const page of pages) {
                const occupied = (allSlots || []).filter(s => s.page_id === page.id).map(s => s.slot_index);
                for (let i = 0; i < 9; i++) {
                    if (!occupied.includes(i)) {
                        await _supabase.from('card_slots').insert([{
                            page_id: page.id, slot_index: i, name: cardData.name, image_url: cardData.image_url,
                            rarity: cardData.rarity, expansion: cardData.expansion, condition: 'M', quantity: 1
                        }]);
                        saved = true; break;
                    }
                }
                if (saved) break;
            }

            if (!saved) {
                const lastIdx = pages[pages.length - 1].page_index;
                const { data: nPage } = await _supabase.from('pages').insert([{ album_id: destId, page_index: lastIdx + 1 }]).select();
                await _supabase.from('card_slots').insert([{
                    page_id: nPage[0].id, slot_index: 0, name: cardData.name, image_url: cardData.image_url,
                    rarity: cardData.rarity, expansion: cardData.expansion, condition: 'M', quantity: 1
                }]);
            }
            return true;
        } else {
            await _supabase.from('deck_cards').insert([{
                deck_id: destId, name: cardData.name, image_url: cardData.image_url,
                rarity: cardData.rarity, expansion: cardData.expansion, quantity: 1
            }]);
            return true;
        }
    } catch (err) {
        console.error("Save Error:", err);
        return false;
    }
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
    setTimeout(() => $toast.removeClass('active'), 3000);
}
