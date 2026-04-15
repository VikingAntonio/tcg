let isDragging = false;
let isMoving = false;
let isManualPageTurn = false;
let startX, startY;

const POKEMON_FOILS = {
    'pk-rare-holo': 'rare holo',
    'pk-rare-holo-cosmos': 'rare holo cosmos',
    'pk-rare-holo-v': 'rare holo v',
    'pk-rare-holo-vmax': 'rare holo vmax',
    'pk-rare-holo-vstar': 'rare holo vstar',
    'pk-rare-rainbow': 'rare rainbow',
    'pk-rare-rainbow-alt': 'rare rainbow alt',
    'pk-rare-secret': 'rare secret',
    'pk-rare-shiny': 'rare shiny',
    'pk-rare-shiny-v': 'rare shiny v',
    'pk-rare-shiny-vmax': 'rare shiny vmax',
    'pk-amazing-rare': 'amazing rare',
    'pk-radiant-rare': 'radiant rare',
    'pk-rare-ultra': 'rare ultra pokemon',
    'pk-trainer-gallery': 'trainer gallery rare holo',
    'pk-trainer-gallery-secret-rare': 'trainer gallery rare secret',
    'pk-trainer-gallery-v-max': 'trainer gallery rare holo vmax',
    'pk-trainer-gallery-v-regular': 'trainer gallery rare holo v',
    'pk-trainer-full-art': 'rare ultra supporter',
    'pk-rare-holo-v-full-art': 'rare holo v full art',
    'pk-reverse-holo': 'reverse holo'
};

// --- Loading Screen Functions ---
window.isLoading = false;
window.loadingMessage = '';

window.showLoading = function(message) {
    window.isLoading = true;
    window.loadingMessage = message;
    window.dispatchEvent(new CustomEvent('show-loading', {
        detail: { message: message }
    }));
}

window.hideLoading = function() {
    window.isLoading = false;
    window.dispatchEvent(new CustomEvent('hide-loading'));
}

// Aliases for internal use
const showLoading = window.showLoading;
const hideLoading = window.hideLoading;

// --- Sharing System Functions ---
window.shareQR = null;

window.clearShareFilters = function() {
    const url = new URL(window.location);
    url.searchParams.delete('albumId');
    url.searchParams.delete('deckId');
    url.searchParams.delete('productId');
    url.searchParams.delete('preorderId');
    url.searchParams.delete('eventId');
    url.searchParams.delete('wishlistId');
    url.searchParams.delete('slot');
    window.history.replaceState({}, '', url);

    $('.shared-highlight').removeClass('shared-highlight');
    $('body').removeClass('focus-mode-active');
    $('body').removeClass('modal-open');
    $('#shared-item-modal').removeClass('active');

    // Refresh current view to show all items
    const view = url.searchParams.get('view') || 'albums';
    switchView(view);
};

window.openShareModal = function(title, type, id, extraId) {
    const baseUrl = window.location.origin + window.location.pathname;
    const identifier = window.currentStoreIdentifier || '';

    // Build direct link
    let shareUrl = `${baseUrl}?id=${encodeURIComponent(identifier)}&view=${type}`;
    if (id !== null && id !== undefined) {
        if (type === 'wishlist') {
            shareUrl += `&slot=${id}`;
            if (extraId) shareUrl += `&wishlistId=${extraId}`;
        } else {
            const paramName = type === 'albums' ? 'albumId' :
                            type === 'decks' ? 'deckId' :
                            type === 'sealed' ? 'productId' :
                            type === 'preorders' ? 'preorderId' : 'eventId';
            shareUrl += `&${paramName}=${id}`;
        }
    }

    $('#share-modal-title').text(`Compartir ${title}`);
    $('#share-link-input').val(shareUrl);
    $('#share-overlay').addClass('active');

    // Bot interaction for sharing
    if (window.botInstance) {
        const shareMsg = `¡Genial! Comparte este link con quien quieras para mostrarle "${title}". También puedes usar el código QR para que lo escaneen directamente.`;
        window.botInstance.say(shareMsg, { duration: 10 });
    }

    // Generate QR Code
    $('#share-qr-code').empty();
    window.shareQR = new QRCode(document.getElementById("share-qr-code"), {
        text: shareUrl,
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    // Setup Social Links
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(`¡Mira esto en VikingTCG: ${title}!`);

    $('#share-wa').off('click').on('click', () => window.open(`https://wa.me/?text=${encodedText}%20${encodedUrl}`, '_blank'));
    $('#share-tg').off('click').on('click', () => window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, '_blank'));
    $('#share-fb').off('click').on('click', () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank'));
    $('#share-ms').off('click').on('click', () => window.open(`fb-messenger://share/?link=${encodedUrl}`, '_blank'));
};

window.handleDeepLinking = function(retries = 10) {
    const params = new URLSearchParams(window.location.search);
    let targetEl = null;
    let isDeepLink = false;
    let shareType = '';

    if (params.has('albumId')) {
        targetEl = document.getElementById(`album-container-${params.get('albumId')}`);
        isDeepLink = true;
        shareType = 'album';
    } else if (params.has('deckId')) {
        targetEl = document.getElementById(`deck-item-${params.get('deckId')}`);
        isDeepLink = true;
        shareType = 'deck';
    } else if (params.has('productId')) {
        targetEl = document.getElementById(`product-item-${params.get('productId')}`);
        isDeepLink = true;
        shareType = 'product';
    } else if (params.has('preorderId')) {
        targetEl = document.getElementById(`preorder-item-${params.get('preorderId')}`);
        isDeepLink = true;
        shareType = 'preorder';
    } else if (params.has('eventId')) {
        targetEl = document.getElementById(`event-${params.get('eventId')}`);
        isDeepLink = true;
        shareType = 'event';
    } else if (params.has('wishlistId')) {
        targetEl = document.getElementById(`wishlist-item-${params.get('wishlistId')}`);
        isDeepLink = true;
        shareType = 'wishlist-item';
    } else if (params.has('slot')) {
        const slotIdx = params.get('slot');
        $('.wishlist-tab[data-index="' + slotIdx + '"]').click();
        targetEl = document.getElementById('wishlist-container');
        isDeepLink = true;
        shareType = 'wishlist-slot';
    }

    // If target not found yet, retry a few times (elements might still be rendering)
    if (!targetEl && isDeepLink && retries > 0) {
        setTimeout(() => window.handleDeepLinking(retries - 1), 300);
        return;
    }

    if (targetEl && isDeepLink) {
        // --- Isolation Mode (Focus on original element) ---
        $('.shared-highlight').removeClass('shared-highlight');
        $(targetEl).addClass('shared-highlight');
        $('body').addClass('focus-mode-active');

        // Scroll to item
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Automations
        if (shareType === 'wishlist-item' && $(targetEl).hasClass('card-slot')) {
            openCardModal($(targetEl));
        } else if (shareType === 'event') {
            showGeneralEventDetails(params.get('eventId'));
        }

        console.log(`Deep-link focused: ${shareType} #${targetEl.id}`);
    }
};

$(document).ready(async function() {
    // --- Share Modal Close & Actions ---
    $(document).on('click', '#btn-share-card-modal', function() {
        if (!window.currentCardData || !window.currentCardData.id) return;
        const name = window.currentCardData.name;
        const id = window.currentCardData.id;
        const type = window.currentCardData.type || 'wishlist'; // Default to wishlist if type not set
        const slot = window.currentCardData.slot || 0;

        window.openShareModal(name, type, slot, id);
    });

    $('#close-share-modal, #share-overlay').on('click', function(e) {
        if (e.target === this || $(this).hasClass('close-btn')) {
            $('#share-overlay').removeClass('active');
        }
    });

    $('#close-shared-modal, #shared-item-modal, #btn-close-focus-mode').on('click', function(e) {
        if (e.target === this || $(this).attr('id') === 'close-shared-modal' || $(this).attr('id') === 'btn-close-focus-mode' || $(this).closest('#close-shared-modal, #btn-close-focus-mode').length) {
            window.clearShareFilters();
        }
    });

    $('#btn-copy-share-link').on('click', function() {
        const input = document.getElementById('share-link-input');
        input.select();
        input.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(input.value);

        const $btn = $(this);
        const originalHtml = $btn.html();
        $btn.html('<i class="fas fa-check"></i>').css('background', '#22c55e');
        setTimeout(() => {
            $btn.html(originalHtml).css('background', '');
        }, 2000);

        Swal.fire({
            icon: 'success',
            title: 'Enlace copiado',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
        });
    });

    await checkSession();
    initTheme();

    // Theme Switcher
    $(document).on('click', '.theme-btn, .theme-btn-small', function() {
        const theme = $(this).data('theme');
        applyTheme(theme);
    });

    // --- Floating Panel Logic ---
    $(document).on('click', '#avatar-btn', function(e) {
        e.stopPropagation();
        $('#user-dropdown').toggleClass('active');
    });

    $(document).on('click', function(e) {
        if (!$(e.target).closest('.user-menu-container').length) {
            if ($('#user-dropdown').hasClass('active')) {
                $('#user-dropdown').removeClass('active');
            }
        }
    });

    $('#menu-spirit-btn, #menu-wishlist-btn').click(function(e) {
        e.preventDefault();
        if ($(this).attr('id') === 'menu-spirit-btn') {
            $('#spirit-modal').addClass('active');
            loadPublicSpirits();
        } else {
            switchView('wishlist');
        }
        $('#user-dropdown').removeClass('active');
    });

    // Zoom Toggle (Public)
    $('#btn-toggle-zoom-public').on('click', function() {
        const viewer = document.getElementById('public-spirit-viewer');
        const icon = $(this).find('i');

        if (viewer.hasAttribute('disable-zoom')) {
            viewer.removeAttribute('disable-zoom');
            icon.removeClass('fa-search-plus').addClass('fa-search-minus');
            $(this).css('background', 'rgba(0, 210, 255, 0.6)');
            Swal.fire({
                title: 'Zoom Activado',
                text: 'Ahora puedes usar la rueda del ratón o pellizcar para hacer zoom.',
                icon: 'info',
                timer: 1500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        } else {
            viewer.setAttribute('disable-zoom', '');
            icon.removeClass('fa-search-minus').addClass('fa-search-plus');
            $(this).css('background', 'rgba(0,0,0,0.5)');
        }
    });

    // --- Mobile Interaction Priority (Priority over turn.js) ---
    // Interceptamos eventos en la fase de captura para evitar que turn.js
    // detecte el toque si el usuario está interactuando con un botón.
    const protectedElements = '.zoom-btn, #close-btn, .nav-btn, #clear-search';

    const stopInterference = (e) => {
        if (e.target.closest(protectedElements)) {
            // Detenemos la propagación en fase de captura.
            // Esto evita que el evento llegue a los listeners de turn.js
            e.stopPropagation();
        }
    };

    // Bloqueamos touchstart y mousedown en fase de captura
    document.addEventListener('touchstart', stopInterference, true);
    document.addEventListener('mousedown', stopInterference, true);
    document.addEventListener('pointerdown', stopInterference, true);

    if ($.isTouch === undefined) {
        $.isTouch = 'ontouchstart' in window;
    }

    const urlParams = new URLSearchParams(window.location.search);
    let initialView = urlParams.get('view') || 'albums';

    // Auto-detect view from deep-links if 'view' is missing
    if (!urlParams.has('view')) {
        if (urlParams.has('albumId')) initialView = 'albums';
        else if (urlParams.has('deckId')) initialView = 'decks';
        else if (urlParams.has('productId')) initialView = 'sealed';
        else if (urlParams.has('preorderId')) initialView = 'preorders';
        else if (urlParams.has('eventId')) initialView = 'events';
        else if (urlParams.has('wishlistId') || urlParams.has('slot')) initialView = 'wishlist';
    }

    // Solo mostramos pantalla de carga inicial si la vista es álbumes
    if (initialView === 'albums') {
        showLoading('Cargando Tienda...');
    }

    await loadStoreData();

    $('.nav-btn').click(function() {
        const view = $(this).data('view');
        if (view) switchView(view);
    });

    // Explicitly call the initial loader
    if (initialView === 'albums') {
        if (window.currentStoreId) {
            loadPublicAlbums(window.currentStoreId).then(() => {
                setTimeout(() => window.handleDeepLinking(), 800);
            });
        }
        else hideLoading();
    } else {
        switchView(initialView).then(() => {
            setTimeout(() => window.handleDeepLinking(), 800);
        });
    }

    $('#spirit-btn').click(function() {
        $('#spirit-modal').addClass('active');
        loadPublicSpirits();
    });

    $('#wishlist-nav-btn').click(function() {
        switchView('wishlist');
    });

    // Wishlist Tabs Logic
    window.currentWishlistTab = 0;
    $(document).on('click', '.wishlist-tab', function() {
        $('.wishlist-tab').removeClass('active');
        $(this).addClass('active');
        window.currentWishlistTab = parseInt($(this).data('index')) || 0;
        loadPublicWishlist();
    });

    // Owner "Add Card" Modal Logic
    $('#btn-owner-add-wishlist').click(function() {
        $('#wishlist-external-search-results').empty();
        $('#wishlist-external-search-input').val('');
        $('#wishlist-search-modal').addClass('active');
    });

    $('#close-wishlist-search-modal').click(function() {
        $('#wishlist-search-modal').removeClass('active');
    });

    $('#btn-wishlist-external-search').click(function(e) {
        e.preventDefault();
        searchExternalCard('#wishlist-external-search-input', '#wishlist-external-search-results', async function(card) {
            const { isConfirmed } = await Swal.fire({
                title: '¿Añadir a la Wishlist?',
                text: card.name,
                imageUrl: card.high_res,
                imageWidth: 200,
                showCancelButton: true,
                confirmButtonText: 'Sí, añadir'
            });

            if (isConfirmed) {
                const { error } = await _supabase.from('wishlist').insert([{
                    user_id: window.currentStoreId,
                    name: card.name,
                    image_url: card.high_res,
                    list_index: window.currentWishlistTab,
                    obtained: false,
                    quantity: 1
                }]);

                if (!error) {
                    Swal.fire({ icon: 'success', title: 'Añadida', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
                    loadPublicWishlist();
                } else {
                    Swal.fire('Error', 'No se pudo añadir la carta.', 'error');
                }
            }
        });
    });

    $('#preorders-nav-btn').click(function() {
        switchView('preorders');
    });

    $('#close-spirit-modal').click(function() {
        $('#spirit-modal').removeClass('active');
        if (window.spiritViewer) window.spiritViewer.cleanupAllViewers();
    });

    // --- Expanded GLTF Viewer Logic ---
    $(document).on('click', '.spirit-card', function() {
        const gltf = $(this).data('gltf');
        const name = $(this).data('name');
        const spiritId = $(this).data('id');

        if (gltf) {
            $('#expanded-gltf-viewer').attr('src', gltf);
            $('#expanded-gltf-name').text(name);
            $('#gltf-overlay').addClass('active');
            $('body').addClass('modal-open');
        }
    });

    $('#close-gltf-overlay').click(function() {
        $('#gltf-overlay').removeClass('active');
        // Clear src to stop rendering/loading
        $('#expanded-gltf-viewer').attr('src', '');
        if (!$('#image-overlay').hasClass('active') && !$('#spirit-modal').hasClass('active')) {
            $('body').removeClass('modal-open');
        }
    });

    // Spirit Navigation
    $('#btn-prev-spirit-public').click(function() {
        if (!window.allSpirits || window.allSpirits.length <= 1) return;
        window.currentSpiritIndex = (window.currentSpiritIndex - 1 + window.allSpirits.length) % window.allSpirits.length;
        updatePublicSpiritViewer(window.allSpirits[window.currentSpiritIndex], window.currentSpirit ? window.currentSpirit.id : null);
    });

    $('#btn-next-spirit-public').click(function() {
        if (!window.allSpirits || window.allSpirits.length <= 1) return;
        window.currentSpiritIndex = (window.currentSpiritIndex + 1) % window.allSpirits.length;
        updatePublicSpiritViewer(window.allSpirits[window.currentSpiritIndex], window.currentSpirit ? window.currentSpirit.id : null);
    });

    // --- Card Interaction Logic (Click Protection) ---
    $(document).on("touchstart mousedown", ".card-slot", function(e) {
        isDragging = false;
        const ev = e.type.startsWith('touch') ? e.originalEvent.touches[0] : e;
        startX = ev.pageX;
        startY = ev.pageY;
    });

    $(document).on("touchmove mousemove", ".card-slot", function(e) {
        if (startX === undefined || startY === undefined) return;
        const ev = e.type.startsWith('touch') ? e.originalEvent.touches[0] : e;
        if (Math.abs(ev.pageX - startX) > 5 || Math.abs(ev.pageY - startY) > 5) {
            isDragging = true;
        }
    });

    $(document).on("touchend mouseup", function() {
        startX = undefined;
        startY = undefined;
        setTimeout(() => { isDragging = false; }, 100);
    });

    // Delegated click handler as a fallback for desktop or cards without direct listeners
    $(document).on("click", ".card-slot", function(e) {
        if (isDragging) return;
        const $slot = $(this);

        // If it's part of a Swiper (carousel), we skip this global listener
        // and let the Swiper's own click handler deal with it.
        if ($slot.closest('.swiperyg').length > 0) {
            return;
        }

        // On mobile, the zoom button handles the click directly to avoid turn.js interference.
        // If we are here on mobile and it's not the zoom button, we ignore it.
        const isMobile = window.innerWidth <= 640;
        if (isMobile) {
            if ($slot.hasClass('grid-card-item')) {
                // In grid mode, we allow clicks directly on the card
            } else if (!$(e.target).closest('.zoom-btn').length) {
                return;
            }
        }

        if ($slot.closest('.album').length > 0) {
            e.stopPropagation();
        }
        openCardModal($slot);
    });

    $(document).on("click", "#close-btn, #image-overlay", function(e) {
        if (e.target === this || $(this).attr('id') === 'close-btn') {
            $("#image-overlay").removeClass("active");
            $("body").removeClass("modal-open");

            // Clean up 3D effects
            window.card3dActive = false;
            if (card3dOrientationHandler) {
                window.removeEventListener('deviceorientation', card3dOrientationHandler);
                card3dOrientationHandler = null;
            }
        }
    });

    // Search Logic with Debounce
    let searchTimeout;
    $('#search-input').on('input', function() {
        const query = $(this).val().toLowerCase().trim();
        clearTimeout(searchTimeout);

        if (query.length > 0) {
            $('#clear-search').show();
            searchTimeout = setTimeout(() => {
                filterContent(query);
            }, 300); // 300ms debounce
        } else {
            $('#clear-search').hide();
            resetFilter();
        }
    });

    $('#clear-search').click(function() {
        $('#search-input').val('');
        $(this).hide();
        resetFilter();
    });

    // --- Chatbot Logic ---
    const faqResponses = {
        'album': 'Para crear un álbum, ve al Panel de Control, inicia sesión y haz clic en "Crear Nuevo Álbum". Luego puedes añadir páginas y cartas.',
        'scanner': 'El scanner te permite añadir cartas rápidamente usando la cámara de tu móvil. Escanea el código de la carta y se añadirá automáticamente a tu álbum o deck.',
        'theme': 'Puedes cambiar el tema (Claro, Medio, Oscuro) usando los iconos en la esquina superior izquierda de la pantalla.',
        'spirit': 'Elige a tu Compañero ideal, quien te guiará y acompañará a través de toda la web en tu aventura coleccionista.'
    };

    window.addChatMessage = function(sender, text) {
        const $container = $('#chat-messages');
        const $msg = $(`<div class="chat-msg msg-${sender}"></div>`).text(text);
        $container.append($msg);
        $container.scrollTop($container[0].scrollHeight);
    };

    $('#send-chat').click(function() {
        const text = $('#chat-input').val().trim();
        if (!text) return;
        addChatMessage('user', text);
        $('#chat-input').val('');
        setTimeout(() => {
            addChatMessage('bot', 'Aún estoy aprendiendo a responder mensajes libres. Por favor, usa los botones de preguntas frecuentes para obtener ayuda inmediata.');
        }, 800);
    });

    $('#chat-input').keypress(function(e) {
        if (e.which == 13) $('#send-chat').click();
    });

    $('.faq-btn').click(function() {
        const faq = $(this).data('faq');
        const question = $(this).text();
        const answer = faqResponses[faq];

        addChatMessage('user', question);
        setTimeout(() => {
            addChatMessage('bot', answer);
        }, 500);
    });

    $('#close-chatbot').click(function() {
        $('#chatbot-container').removeClass('active');
    });

    $(document).on('click', '#events-container .deck-public-item', function(e) {
        if ($(e.target).closest('button').length) return;
        const id = $(this).attr('id');
        if (id && id.startsWith('event-')) {
            const eventId = id.replace('event-', '');
            showGeneralEventDetails(eventId);
        }
    });

    $('#close-ed-overlay').click(() => $('#event-details-overlay').removeClass('active'));

    // --- Companion Menu Logic ---
    $(document).on('click', function(e) {
        if (!$(e.target).closest('#floating-companion-container, #companion-menu').length) {
            $('#companion-menu').removeClass('active');
        }
    });

    $('#menu-item-chat').click(function() {
        $('#chatbot-container').addClass('active');
        $('#companion-menu').removeClass('active');
    });

    $('#menu-item-details').click(function() {
        if (window.currentSpirit) {
            $('#expanded-gltf-viewer').attr('src', window.currentSpirit.gltf_url);
            $('#expanded-gltf-name').text(window.currentSpirit.name);
            $('#gltf-overlay').addClass('active');
            $('body').addClass('modal-open');
        }
        $('#companion-menu').removeClass('active');
    });

    $('#menu-item-play').click(function() {
        window.location.href = 'play.html';
    });

    // --- Cart Integration ---
    $(document).on('click', '#btn-add-to-cart', function(e) {
        e.preventDefault();
        if (window.currentCardData) {
            Cart.add(window.currentCardData);
            if (window.botInstance) {
                window.botInstance.say(`¡Excelente elección! He añadido ${window.currentCardData.name} a tu carrito. Puedes ver tus opciones de compra por WhatsApp o Messenger.`, { duration: 8 });
            }
            Swal.fire({
                title: '¡Añadido!',
                text: `${window.currentCardData.name} se ha agregado al carrito.`,
                icon: 'success',
                timer: 1500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        }
    });

    // --- Dynamic Album Resizing ---
    let resizeTimeout;
    $(window).on('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            $('.album').each(function() {
                const $album = $(this);
                if ($album.turn('is')) {
                    const $container = $album.closest('.public-album-item');
                    if ($container.length) {
                        const { width, height } = getAlbumSize($container);
                        $album.turn('size', width, height).turn('center');
                    }
                }
            });
        }, 250);
    });

    // --- Wishlist Contact Buttons Logic ---
    $(document).on('click', '#btn-wishlist-whatsapp', function() {
        if (!window.currentCardData) return;
        const contact = window.currentStoreContact;
        if (!contact || !contact.whatsapp) {
            Swal.fire({
                title: 'Error',
                text: 'No hay WhatsApp configurado para este vendedor.',
                icon: 'error',
                toast: true,
                position: 'top'
            });
            return;
        }

        const message = `¡Hola! Vi tu lista de "Buscamos" en Vikingdev TCG y tengo esta carta: ${window.currentCardData.name} (${window.currentCardData.rarity || 'N/A'}). ¿Te interesa?`;
        const waNumber = contact.whatsapp.replace(/\D/g, '');
        window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`, '_blank');
    });

    $(document).on('click', '#btn-wishlist-messenger', function() {
        if (!window.currentCardData) return;
        const contact = window.currentStoreContact;
        if (!contact || !contact.messenger) {
            Swal.fire({
                title: 'Error',
                text: 'No hay Messenger configurado para este vendedor.',
                icon: 'error',
                toast: true,
                position: 'top'
            });
            return;
        }

        const message = `¡Hola! Vi tu lista de "Buscamos" en Vikingdev TCG y tengo esta carta: ${window.currentCardData.name} (${window.currentCardData.rarity || 'N/A'}). ¿Te interesa?`;
        let messengerLink = contact.messenger;
        if (!messengerLink.startsWith('http')) {
            messengerLink = `https://m.me/${messengerLink}`;
        }
        const separator = messengerLink.includes('?') ? '&' : '?';
        window.open(`${messengerLink}${separator}text=${encodeURIComponent(message)}`, '_blank');
    });
});

function filterContent(query) {
    let anyVisible = false;
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 0);

    if (keywords.length === 0) {
        resetFilter();
        return;
    }

    // Clear previous highlights
    $('.search-highlight').removeClass('search-highlight');

    // Filtrar álbumes
    $('.public-album-item').each(function() {
        const $albumItem = $(this);
        const albumTitle = $albumItem.find('.public-album-header').text().toLowerCase();

        // El álbum coincide si el título contiene TODOS los keywords
        let albumTitleMatch = keywords.every(k => albumTitle.includes(k));

        let firstMatchPage = -1;
        let anyCardMatches = false;

        $albumItem.find('.card-slot').each(function() {
            const $slot = $(this);
            const cardName = ($slot.attr('data-name') || '').toLowerCase();

            // La búsqueda debe ser insensible a mayúsculas/minúsculas y buscar en data-name
            const cardMatch = cardName && keywords.every(k => cardName.includes(k));

            if (cardMatch) {
                anyCardMatches = true;
                $slot.addClass('search-highlight');
                if (firstMatchPage === -1) {
                    // Usar el atributo data-page pre-calculado para mayor fiabilidad
                    firstMatchPage = parseInt($slot.attr('data-page')) || -1;
                }
            }
        });

        if (albumTitleMatch || anyCardMatches) {
            $albumItem.show();
            anyVisible = true;
            // Si hubo coincidencia en cartas, girar a la primera página que coincide usando turn.js
            if (anyCardMatches && firstMatchPage !== -1) {
                const $turnAlbum = $albumItem.find('.album');
                if ($turnAlbum.turn('is')) {
                    const currentPage = $turnAlbum.turn('page');
                    // En modo double, las páginas vienen en pares (2-3, 4-5, etc.)
                    // Verificamos si la página destino ya está visible
                    const isAlreadyVisible = (currentPage === firstMatchPage) ||
                                           (currentPage % 2 === 0 && currentPage + 1 === firstMatchPage) ||
                                           (currentPage % 2 !== 0 && currentPage - 1 === firstMatchPage && currentPage > 1);

                    if (!isAlreadyVisible) {
                        isManualPageTurn = true;
                        $turnAlbum.turn('page', firstMatchPage);
                        // Aumentamos el tiempo del flag para asegurar que termine la animación
                        setTimeout(() => { isManualPageTurn = false; }, 1500);
                    }
                }
            }
        } else {
            $albumItem.hide();
        }
    });

    // Filtrar decks
    $('.deck-public-item').each(function() {
        const $deck = $(this);
        const deckName = $deck.find('h3').text().toLowerCase();

        let deckNameMatch = keywords.every(k => deckName.includes(k));
        let anyCardMatches = false;
        let firstMatchIndex = -1;

        $deck.find('.swiper-slide').each(function(index) {
            const $slot = $(this);
            const cardName = ($slot.attr('data-name') || '').toLowerCase();
            const cardMatch = cardName && keywords.every(k => cardName.includes(k));

            if (cardMatch) {
                anyCardMatches = true;
                $slot.addClass('search-highlight');
                if (firstMatchIndex === -1) firstMatchIndex = index;
            }
        });

        if (deckNameMatch || anyCardMatches) {
            $deck.show();
            anyVisible = true;
            if (anyCardMatches && firstMatchIndex !== -1) {
                const swiperEl = $deck.find('.swiper')[0];
                if (swiperEl && swiperEl.swiper) {
                    swiperEl.swiper.slideTo(firstMatchIndex);
                }
            }
        } else {
            $deck.hide();
        }
    });

    if (anyVisible) {
        $('#no-results').hide();
    } else {
        $('#no-results').show();
    }
}

function resetFilter() {
    $('.public-album-item, .deck-public-item').show();
    $('.search-highlight').removeClass('search-highlight');
    $('#no-results').hide();
}

let card3dZtext = null;
let targetRX = 0;
let targetRY = 0;
let currentRX = 0;
let currentRY = 0;
window.card3dActive = false;
let card3dOrientationHandler = null;
let card3dTouchHandler = null;

window.updateRotation = function() {
    if (!window.card3dActive) return;

    const card3d = document.getElementById('card-3d');
    if (!card3d || !$(card3d).is(':visible')) {
        window.card3dActive = false;
        return;
    }

    // LERP for smooth motion
    currentRX += (targetRX - currentRX) * 0.1;
    currentRY += (targetRY - currentRY) * 0.1;

    const mx = (currentRY + 20) / 40;
    const my = (currentRX + 20) / 40;
    const angle = (Math.atan2(currentRX, currentRY) * 180 / Math.PI) + 135;

    // Pokemon style variables
    const px = mx * 100;
    const py = my * 100;
    const cx = (mx - 0.5) * 100;
    const cy = (my - 0.5) * 100;
    const pointerFromCenter = Math.min(Math.sqrt(cx * cx + cy * cy) / 50, 1);

    const s = card3d.style;
    s.transform = `rotateX(${currentRX}deg) rotateY(${currentRY}deg)`;
    s.setProperty('--mx', mx);
    s.setProperty('--my', my);
    s.setProperty('--angle', `${angle}deg`);
    s.setProperty('--pointer-x', `${px}%`);
    s.setProperty('--pointer-y', `${py}%`);
    s.setProperty('--background-x', `${px}%`);
    s.setProperty('--background-y', `${py}%`);
    s.setProperty('--pointer-from-center', pointerFromCenter);
    s.setProperty('--pointer-from-top', my);
    s.setProperty('--pointer-from-left', mx);
    s.setProperty('--card-opacity', '1');

    requestAnimationFrame(window.updateRotation);
}

function init3DCard() {
    const $container = $('#card-3d-container');
    const $card = $('#card-3d');
    const $zContainer = $('#z-text-container');

    if (!$zContainer.length) return;

    // Reset styles
    $card.css('transform', '');
    currentRX = 0;
    currentRY = 0;
    targetRX = 0;
    targetRY = 0;

    // Initialize ztext
    try {
        card3dZtext = new Ztextify('#z-text-container', {
            depth: "10px",
            layers: 10,
            fade: true,
            direction: "backwards",
            event: "none",
            perspective: "800px"
        });
    } catch (e) {
        console.error("Ztext init error:", e);
    }

    $container.off('mousemove mouseleave touchend');
    if (card3dTouchHandler) {
        $container[0].removeEventListener('touchmove', card3dTouchHandler);
    }

    $container.on('mousemove', (e) => {
        const rect = $container[0].getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        targetRY = ((x / rect.width) - 0.5) * 40;
        targetRX = ((y / rect.height) - 0.5) * -40;
    });

    $container.on('mouseleave', () => {
        targetRX = 0;
        targetRY = 0;
    });

    // Touch support - use native listener with {passive: false} to allow e.preventDefault()
    card3dTouchHandler = (e) => {
        const rect = $container[0].getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        targetRY = ((x / rect.width) - 0.5) * 40;
        targetRX = ((y / rect.height) - 0.5) * -40;

        if (e.cancelable) e.preventDefault();
    };

    $container[0].addEventListener('touchmove', card3dTouchHandler, { passive: false });

    $container.on('touchend', () => {
        targetRX = 0;
        targetRY = 0;
    });

    // Device Orientation support
    if (window.DeviceOrientationEvent) {
        if (card3dOrientationHandler) {
            window.removeEventListener('deviceorientation', card3dOrientationHandler);
        }
        card3dOrientationHandler = (e) => {
            if (!window.card3dActive) return;
            if (e.gamma !== null && e.beta !== null) {
                targetRY = Math.max(-20, Math.min(20, e.gamma)) * 1.5;
                targetRX = Math.max(-20, Math.min(20, e.beta - 45)) * 1.5;
            }
        };

        // iOS 13+ requires permission
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(state => {
                    if (state === 'granted') {
                        window.addEventListener('deviceorientation', card3dOrientationHandler);
                    }
                })
                .catch(err => console.error("Gyroscope permission denied:", err));
        } else {
            window.addEventListener('deviceorientation', card3dOrientationHandler);
        }
    }

    if (!window.card3dActive) {
        window.card3dActive = true;
        requestAnimationFrame(window.updateRotation);
    }
}

// Global target values for LERP
window.set3DTarget = function(rx, ry) {
    targetRX = rx;
    targetRY = ry;
};

async function openCardModal($slot) {
    const imgSrc = $slot.find("img").attr("src");

    if (!imgSrc || imgSrc.includes('placeholder')) return;

    const id = $slot.data("id");
    const name = $slot.data("name") || "Carta de Colección";
    const rarity = $slot.data("rarity") || "-";
    const holo = $slot.data("holo") || "";
    const mask = $slot.data("mask") || "";
    const use3d = $slot.data("3d") !== false && $slot.data("3d") !== "false";
    const expansion = $slot.data("expansion") || "-";
    const condition = $slot.data("condition") || "-";
    const quantity = $slot.data("quantity") || "1";
    const price = $slot.data("price") || "-";
    const isWishlist = $slot.hasClass('wishlist-card-item');
    const notes = $slot.data("notes") || "";
    const obtained = $slot.data("obtained") === true || $slot.data("obtained") === "true";

    // Detect if owner
    const isOwner = window.currentUserId === window.currentStoreId;

    // Reset the card container
    $("#card-3d").html(`
        <div id="z-text-container">
            <img id="expanded-image" src="${imgSrc}" alt="${name}" class="card__front">
        </div>
        <div class="holo-layer"></div>
        <div class="card__shine"></div>
        <div class="card__glare"></div>
    `).addClass("card-3d");

    const $card3d = $("#card-3d-container");
    const $card = $("#card-3d");

    // Cleanup Pokemon styles
    $card.removeClass("card masked interacting");
    $card.removeAttr("data-rarity data-trainer-gallery data-subtypes data-supertype");
    $card.css({'--seedx': '', '--seedy': '', '--cosmosbg': '', '--card-opacity': '0'});
    $card3d.removeClass("super-rare secret-rare ghost-rare foil rainbow starlight-rare custom-texture custom-foil active");
    $card3d.find('.holo-layer').css('--mask-url', '');

    let baseHolo = holo;
    let isCustomFoil = false;
    if (holo.startsWith('custom-foil|')) {
        isCustomFoil = true;
        baseHolo = holo.split('|')[1] || 'foil';
    }

    if (baseHolo) {
        if (POKEMON_FOILS[baseHolo]) {
            let rarityVal = POKEMON_FOILS[baseHolo];
            $card.addClass("card");
            if (rarityVal.includes('trainer gallery')) { $card.attr("data-trainer-gallery", "true"); rarityVal = rarityVal.replace('trainer gallery', ''); }
            else { $card.removeAttr("data-trainer-gallery"); }
            if (rarityVal.includes('supporter')) { $card.attr("data-subtypes", "supporter"); rarityVal = rarityVal.replace('supporter', ''); }
            else { $card.removeAttr("data-subtypes"); }
            if (rarityVal.includes('pokemon')) { $card.attr("data-supertype", "pokémon"); rarityVal = rarityVal.replace('pokemon', ''); }
            else { $card.removeAttr("data-supertype"); }
            $card.attr("data-rarity", rarityVal.trim());
            if ((isCustomFoil || baseHolo === 'custom-texture') && mask) {
                $card.addClass("masked");
                const maskVal = `url(${mask})`;
                $card.css("--mask", maskVal);
                $card.css("--mask-url", maskVal);
            }
            const rx = Math.random(), ry = Math.random();
            $card.css({'--seedx': rx, '--seedy': ry, '--cosmosbg': `${Math.floor(rx * 734)}px ${Math.floor(ry * 1280)}px`});
        } else {
            $card3d.addClass(baseHolo);
            if ((isCustomFoil || baseHolo === 'custom-texture') && mask) {
                $card.addClass("masked");
                const maskVal = `url(${mask})`;
                $card.css("--mask", maskVal);
                $card.css("--mask-url", maskVal);
            }
        }
    }

    // Modal UI logic
    if (isWishlist && isOwner) {
        $('#owner-wishlist-controls').show();
        $('#visitor-card-info').hide();
        $('#btn-add-to-cart').hide();
        $('#wishlist-contact-buttons').hide();

        $('#owner-card-name').val(name);
        $('#owner-card-rarity').val(rarity === '-' ? '' : rarity);
        $('#owner-card-quantity').val(quantity);
        $('#owner-card-obtained').prop('checked', obtained);
        $('#owner-obtained-label').text(obtained ? 'CONSEGUIDA' : 'BUSCANDO');
        $('#owner-card-holo').val(holo);
        $('#owner-card-mask').val(mask);
        $('#owner-card-3d').prop('checked', use3d);

        if (holo === 'custom-texture' || holo === 'custom-foil') $('#owner-mask-container').show();
        else $('#owner-mask-container').hide();

        // Setup real-time listeners for owner
        $('.wishlist-edit-input, #owner-card-obtained, #owner-card-3d').off('change').on('change', async function() {
            const updName = $('#owner-card-name').val();
            const updRarity = $('#owner-card-rarity').val();
            const updQty = parseInt($('#owner-card-quantity').val()) || 1;
            const updObtained = $('#owner-card-obtained').is(':checked');
            const updHolo = $('#owner-card-holo').val();
            const updMask = $('#owner-card-mask').val();
            const upd3d = $('#owner-card-3d').is(':checked');

            if (updHolo === 'custom-texture' || updHolo === 'custom-foil') $('#owner-mask-container').show();
            else $('#owner-mask-container').hide();

            $('#owner-obtained-label').text(updObtained ? 'CONSEGUIDA' : 'BUSCANDO');

            const { error } = await _supabase.from('wishlist').update({
                name: updName,
                rarity: updRarity,
                quantity: updQty,
                obtained: updObtained,
                holo_effect: updHolo,
                custom_mask_url: updMask,
                use_3d: upd3d
            }).eq('id', id);

            if (!error) {
                // Update the grid item attributes and style
                $slot.data('name', updName).attr('data-name', updName);
                $slot.data('rarity', updRarity).attr('data-rarity', updRarity);
                $slot.data('quantity', updQty).attr('data-quantity', updQty);
                $slot.data('obtained', updObtained).attr('data-obtained', updObtained);
                $slot.data('holo', updHolo).attr('data-holo', updHolo);
                $slot.data('mask', updMask).attr('data-mask', updMask);
                $slot.data('3d', upd3d).attr('data-3d', upd3d);
                $slot.find('h3').text(updName);
                $slot.css('opacity', updObtained ? '0.5' : '1');

                // Re-render the "CONSEGUIDA" badge if needed
                $slot.find('.event-type-badge').remove();
                if (updObtained) {
                    $slot.append('<div class="event-type-badge" style="background: #00ff88; color: #000; bottom: 5px; top: auto;">CONSEGUIDA</div>');
                }

                // Update visual effects in the current modal without closing it
                applyVisualsToModal(updHolo, updMask, upd3d);
            } else {
                Swal.fire({ icon: 'error', title: 'Error al guardar', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
            }
        });

        $('#btn-owner-delete-wishlist').off('click').on('click', async function() {
            const { isConfirmed } = await Swal.fire({
                title: '¿Eliminar de la lista?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ff4757',
                confirmButtonText: 'Sí, eliminar'
            });

            if (isConfirmed) {
                const { error } = await _supabase.from('wishlist').delete().eq('id', id);
                if (!error) {
                    $("#image-overlay").removeClass("active");
                    $("body").removeClass("modal-open");
                    $slot.fadeOut(300, function() { $(this).remove(); });
                }
            }
        });

    } else {
        $('#owner-wishlist-controls').hide();
        $('#visitor-card-info').show();

        $("#card-name").text(name);
        $("#card-rarity").text(rarity);
        $("#card-expansion").text(expansion);
        $("#card-condition").text(condition);
        $("#card-quantity").text(quantity);
        $("#card-price").text(price);

        if (isWishlist) {
            $('#wishlist-contact-buttons').css('display', 'flex');
            $('#btn-add-to-cart').hide();
            $('#expansion-item, #condition-item, #price-item').hide();
            $('#card-notes').text(notes || 'Sin notas adicionales.');
            $('#wishlist-info-extra').css('display', 'flex');
        } else {
            $('#wishlist-contact-buttons').hide();
            $('#btn-add-to-cart').show();
            $('#expansion-item, #condition-item, #price-item').show();
            $('#wishlist-info-extra').hide();
        }
    }

    if (window.botInstance && name) {
        (async () => {
            const sequence = [`¡Mira esta carta: ${name}!`];
            if (price && price !== '-') sequence.push(`Tiene un precio de ${price}.`);
            if (expansion && expansion !== '-') sequence.push(`Pertenece a la expansión ${expansion}.`);
            if (condition && condition !== '-') sequence.push(`Su estado de conservación es ${condition}.`);

            // Fetch deeper details from database
            const extra = await window.botInstance.fetchDetailedCardInfo(name);
            if (extra) {
                if (extra.tcg) sequence.push(`Es una carta de ${extra.tcg}.`);
                if (extra.type) sequence.push(`Tipo: ${extra.type}.`);
                if (extra.rarity && extra.rarity !== rarity) sequence.push(`Rareza original: ${extra.rarity}.`);
                if (extra.description) {
                    // Split description into short chunks if it's too long
                    const desc = extra.description.substring(0, 150) + (extra.description.length > 150 ? '...' : '');
                    sequence.push(`Efecto: ${desc}`);
                }
            }
            window.botInstance.saySequence(sequence);
        })();
    }

    // Store current card data for cart and sharing
    window.currentCardData = {
        id, name, image_url: imgSrc, rarity, expansion, condition, price, quantity,
        type: isWishlist ? 'wishlist' : 'albums',
        slot: isWishlist ? window.currentWishlistTab : null,
        whatsapp_link: window.currentStoreContact ? window.currentStoreContact.whatsapp : null,
        messenger_link: window.currentStoreContact ? window.currentStoreContact.messenger : null
    };

    if (isWishlist) $('#btn-share-card-modal').show();
    else $('#btn-share-card-modal').hide();

    $("#image-overlay").addClass("active");
    $("body").addClass("modal-open");

    setTimeout(() => {
        applyVisualsToModal(holo, mask, use3d);
        $card3d.addClass("active");
    }, 150);
}

function applyVisualsToModal(holo, mask, use3d) {
    const $card3d = $("#card-3d-container");
    const $card = $("#card-3d");

    // Cleanup all possible holo classes and styles
    $card.removeClass("card masked interacting");
    $card.removeAttr("data-rarity data-trainer-gallery data-subtypes data-supertype");
    $card.css({'--seedx': '', '--seedy': '', '--cosmosbg': '', '--card-opacity': '0', '--mask': '', '--mask-url': ''});
    $card3d.removeClass("super-rare secret-rare ghost-rare foil rainbow starlight-rare custom-texture custom-foil active");
    $card3d.find('.holo-layer').css('--mask-url', '');

    let baseHolo = holo;
    let isCustomFoil = false;
    if (holo && holo.startsWith('custom-foil|')) {
        isCustomFoil = true;
        baseHolo = holo.split('|')[1] || 'foil';
    }

    if (baseHolo) {
        if (POKEMON_FOILS[baseHolo]) {
            let rarityVal = POKEMON_FOILS[baseHolo];
            $card.addClass("card");
            if (rarityVal.includes('trainer gallery')) { $card.attr("data-trainer-gallery", "true"); rarityVal = rarityVal.replace('trainer gallery', ''); }
            if (rarityVal.includes('supporter')) { $card.attr("data-subtypes", "supporter"); rarityVal = rarityVal.replace('supporter', ''); }
            if (rarityVal.includes('pokemon')) { $card.attr("data-supertype", "pokémon"); rarityVal = rarityVal.replace('pokemon', ''); }
            $card.attr("data-rarity", rarityVal.trim());

            if ((isCustomFoil || baseHolo === 'custom-texture') && mask) {
                $card.addClass("masked");
                const maskVal = `url(${mask})`;
                $card.css("--mask", maskVal);
                $card.css("--mask-url", maskVal);
            }
            const rx = Math.random(), ry = Math.random();
            $card.css({'--seedx': rx, '--seedy': ry, '--cosmosbg': `${Math.floor(rx * 734)}px ${Math.floor(ry * 1280)}px`});
        } else {
            $card3d.addClass(baseHolo);
            if ((isCustomFoil || baseHolo === 'custom-texture') && mask) {
                $card.addClass("masked");
                const maskVal = `url(${mask})`;
                $card.css("--mask", maskVal);
                $card.css("--mask-url", maskVal);
            }
        }
    }

    if (use3d) {
        init3DCard();
    } else {
        $card.css('transform', 'none');
        window.card3dActive = false;
        if (card3dOrientationHandler) {
            window.removeEventListener('deviceorientation', card3dOrientationHandler);
            card3dOrientationHandler = null;
        }
    }

    $card3d.addClass("active");
}

async function switchView(view) {
    if (!view) return;

    $('.nav-btn').removeClass('active');
    $(`.nav-btn[data-view="${view}"]`).addClass('active');

    $('.view-section').removeClass('active');
    $(`#${view}-view`).addClass('active');

    if (view === 'albums') {
        $('#public-view-title').text('Colección de Álbumes');
        $('.public-header p').text('Explora nuestra selección de cartas y colecciones exclusivas.');
        if (window.currentStoreId) await loadPublicAlbums(window.currentStoreId);
    } else if (view === 'sealed') {
        $('#public-view-title').text('Productos Sellados');
        $('.public-header p').text('Encuentra cajas, sobres y productos especiales de tus TCG favoritos.');
        await loadPublicSealed();
    } else if (view === 'preorders') {
        $('#public-view-title').text('Preventas');
        $('.public-header p').text('Asegura tus productos antes que nadie con nuestras preventas exclusivas.');
        await loadPublicPreorders();
    } else if (view === 'decks') {
        $('#public-view-title').text('Decks de Cartas');
        $('.public-header p').text('Explora nuestra selección de cartas y colecciones exclusivas.');
        await loadPublicDecks();
    } else if (view === 'wishlist') {
        $('#public-view-title').text('Buscamos lo siguiente');
        $('.public-header p').text('Si tienes alguno de estos productos ponte en coontacto con nosotros');
        await loadPublicWishlist();
    } else if (view === 'events') {
        $('#public-view-title').text('Eventos');
        $('.public-header p').text('Participa en nuestros eventos para ganar premios increíbles.');
        await loadPublicEvents();
    } else if (view === 'auctions') {
        $('#public-view-title').text('Subastas');
        $('.public-header p').text('Participa y llévate las mejores cartas al mejor precio.');
        await loadPublicAuctions();
        if (window.botInstance) {
            window.botInstance.say("¡Bienvenido a la sección de subastas! Elige un artículo para ver los detalles y colocar tu puja. ¡Mucha suerte!", { duration: 8 });
        }
    }

    const url = new URL(window.location);
    url.searchParams.set('view', view);
    window.history.pushState({}, '', url);

    if (window.botInstance) {
        window.botInstance.setContext(view);
    }
}

// Helper to resolve user by identifier (store_name or username)
async function resolveUser(identifier) {
    if (!identifier) return null;
    const safeId = identifier.replace(/['"]/g, '');
    const { data } = await _supabase
        .from('usuarios')
        .select('id, username, store_name, whatsapp_link, messenger_link, store_logo, is_store')
        .or(`store_name.eq."${safeId}",username.eq."${safeId}"`)
        .maybeSingle();
    return data;
}

async function loadStoreData() {
    const urlParams = new URLSearchParams(window.location.search);
    const identifier = urlParams.get('id') || urlParams.get('store') || urlParams.get('user');

    if (!identifier) {
        $('#public-store-name').hide();
        return;
    }

    // --- Clean URL Handling ---
    if (urlParams.has('id')) {
        const params = new URLSearchParams(window.location.search);
        params.delete('id');
        params.delete('store');
        params.delete('user');
        const search = params.toString();
        const newUrl = `${window.location.origin}/${encodeURIComponent(identifier)}${search ? '?' + search : ''}${window.location.hash}`;
        window.history.replaceState({}, '', newUrl);
        window.currentStoreIdentifier = identifier;
    } else {
        window.currentStoreIdentifier = identifier;
    }

    try {
        const userData = await resolveUser(identifier);

        if (!userData) {
            $('#albums-container').html(`<div class="error">Tienda o Usuario no encontrado.</div>`);
            return;
        }

        // --- Immediate Identity Assignment ---
        window.currentStoreId = userData.id;
        window.currentStoreContact = {
            whatsapp: userData.whatsapp_link,
            messenger: userData.messenger_link
        };

        // Check localStorage first for guest selection
        const localSpirit = localStorage.getItem('selected_spirit');
        if (localSpirit) {
            window.currentSpirit = JSON.parse(localSpirit);
        } else {
            // Fetch selected spirit from DB (owner's preference or default)
            const { data: spiritRef } = await _supabase
                .from('usuarios')
                .select('selected_spirit_id')
                .eq('id', userData.id)
                .single();

            if (spiritRef && spiritRef.selected_spirit_id) {
                const { data: spiritData } = await _supabase
                    .from('spirits')
                    .select('*')
                    .eq('id', spiritRef.selected_spirit_id)
                    .single();
                if (spiritData) window.currentSpirit = spiritData;
            }
        }

        if (userData.is_store) {
            if (userData.store_logo) {
                $('#public-store-logo').show().attr('src', userData.store_logo);
                $('#public-store-icon').hide();
            } else {
                $('#public-store-logo').hide();
                $('#public-store-icon').show();
            }
            $('#public-store-name').text(`Tienda: ${userData.store_name}`).show();
        } else {
            $('#public-store-logo').hide();
            $('#public-store-icon').hide();
            $('#public-store-name').text(userData.username).show();
        }

        // Update cart link to include store name or user name
        const cartIdentifier = userData.is_store ? `store=${encodeURIComponent(userData.store_name)}` : `user=${encodeURIComponent(userData.username)}`;
        $('#cart-btn').attr('href', `carrito.html?${cartIdentifier}`);

        // Fetch additional data for CompanionBot
        const [{ data: botMessages }, { data: sealedProducts }] = await Promise.all([
            _supabase.from('bot_messages').select('*').eq('user_id', userData.id).eq('is_active', true).or('view_type.eq.public,view_type.eq.both'),
            _supabase.from('sealed_products').select('id').eq('user_id', userData.id).limit(1)
        ]);

        window.currentStoreDataForBot = {
            user: userData,
            customMessages: botMessages,
            hasSealed: sealedProducts && sealedProducts.length > 0
        };

        // Initialize companion bot
        initFloatingCompanion();
    } catch (e) {
        console.error("Error in loadStoreData:", e);
    }
}

function loadPublicPreorders() {
    return new Promise(async (resolve) => {
    let userId = window.currentStoreId;
    if (!userId) {
        const identifier = window.currentStoreIdentifier;
        const user = await resolveUser(identifier);
        if (user) {
            userId = user.id;
            window.currentStoreId = userId;
        }
    }
    if (!userId) { resolve(); return; }

    $('#preorders-container').html('<div class="loading">Cargando preventas...</div>');

    const params = new URLSearchParams(window.location.search);
    const filterId = params.get('preorderId');

    try {
        let query = _supabase
            .from('preorders')
            .select('*')
            .eq('user_id', userId)
            .eq('is_public', true)
            .order('created_at', { ascending: false });

        if (filterId) {
            query = query.eq('id', filterId);
        }

        const { data: preorders, error } = await query;

        if (error) throw error;

        if (!preorders || preorders.length === 0) {
            $('#preorders-container').html('<div class="empty">No hay preventas disponibles.</div>');
            return;
        }

        $('#preorders-container').empty();
        if (filterId && preorders && preorders.length > 0) {
            $('<div class="focus-mode-exception" style="grid-column: 1/-1; margin-bottom: 20px; text-align: center;"><button class="btn btn-primary" onclick="clearShareFilters()"><i class="fas fa-th-list"></i> Ver Todas las Preventas</button></div>').appendTo('#preorders-container');
        }
        preorders.forEach(preorder => {
            const $item = $(`
                <div class="deck-public-item sealed-product-item" id="preorder-item-${preorder.id}" style="position: relative;">
                    <button class="btn-share-item btn-share-floating" onclick="openShareModal('${preorder.name.replace(/'/g, "\\'")}', 'preorders', '${preorder.id}')" title="Compartir Preventa">
                        <i class="fas fa-share-alt"></i>
                    </button>
                    <div class="product-image-container">
                        <img src="${preorder.image_url || 'https://via.placeholder.com/300x150?text=Sin+Imagen'}"
                             alt="${preorder.name}" class="sealed-product-img">
                    </div>
                    <h3 style="margin: 10px 0; font-size: 1.1rem; min-height: 2.4em; display: flex; align-items: center; justify-content: center;">${preorder.name}</h3>
                    <div style="color: #00d2ff; font-weight: bold; font-size: 1.2rem;">${preorder.price || 'Consultar'}</div>
                    <div style="color: #ff4757; font-size: 0.85rem; font-weight: 600; margin-bottom: 15px;">Límite: ${preorder.payment_deadline || '-'}</div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-add-preorder-cart" style="flex: 1;">
                            <i class="fas fa-cart-plus"></i>
                        </button>
                        <button class="btn btn-secondary" onclick="openShareModal('${preorder.name.replace(/'/g, "\\'")}', 'preorders', '${preorder.id}')" title="Compartir">
                            <i class="fas fa-share-alt"></i>
                        </button>
                    </div>
                </div>
            `);

            $item.find('.btn-add-preorder-cart').click(function(e) {
                e.stopPropagation();
                Cart.add({
                    name: preorder.name,
                    image_url: preorder.image_url,
                    price: preorder.price,
                    tcg: preorder.tcg,
                    deadline: preorder.payment_deadline
                });
                Swal.fire({
                    title: '¡Añadido!',
                    text: `${preorder.name} se ha agregado al carrito.`,
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
            });

            $('#preorders-container').append($item);
        });

    } catch (e) {
        console.error("Error loading preorders:", e);
        $('#preorders-container').html('<div class="error">Error al cargar preventas.</div>');
    } finally {
        hideLoading();
        resolve();
    }
    });
}

function initFloatingCompanion() {
    if (!window.currentSpirit) return;

    const $container = $('#floating-companion-container');
    setTimeout(makeCompanionDraggable, 1000);
    $container.html(`
        <model-viewer
            src="${window.currentSpirit.gltf_url}"
            auto-rotate
            camera-controls
            rotation="0deg 0deg 0deg"
            shadow-intensity="1"
            environment-image="neutral"
            exposure="1"
            interaction-prompt="none">
        </model-viewer>
    `);

    $container.on('click', function(e) {
        if (window.isCompanionDragging) return;
        e.stopPropagation();
        $('#companion-menu').toggleClass('active');
    });

    // Initialize CompanionBot Tips
    if (typeof CompanionBot === 'function') {
        const bot = new CompanionBot({
            supabase: _supabase,
            userId: window.currentStoreId,
            userType: 'public',
            customMessages: window.currentStoreDataForBot ? window.currentStoreDataForBot.customMessages : [],
            onAction: (msg) => {
                if (msg.type === 'album_link' && msg.redirect_url) {
                    switchView('albums');
                    setTimeout(() => {
                        const albumTitle = msg.redirect_url.toLowerCase();
                        $('.public-album-item').each(function() {
                            const title = $(this).find('.public-album-header').text().toLowerCase();
                            if (title.includes(albumTitle)) {
                                this.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                return false;
                            }
                        });
                    }, 600);
                } else if (msg.type === 'pre_sales') {
                    switchView('preorders');
                } else if (msg.redirect_url && msg.redirect_url.startsWith('http')) {
                    window.open(msg.redirect_url, '_blank');
                }
            }
        });
        bot.init();
        window.botInstance = bot;
    }
}

function loadPublicAlbums(userId) {
    return new Promise(async (resolve) => {
    if (!userId) { resolve(); return; }
    const isAlbumsView = $('.nav-btn[data-view="albums"]').hasClass('active');
    if (isAlbumsView) showLoading('Cargando interfaz...');

    const params = new URLSearchParams(window.location.search);
    const filterId = params.get('albumId');

    try {
        let query = _supabase
            .from('albums')
            .select('*')
            .eq('user_id', userId)
            .order('position', { ascending: true });

        if (filterId) {
            query = query.eq('id', filterId);
        }

        let { data: albums, error } = await query;

        // Fallback if query failed (might be schema mismatch)
        if (error) {
            console.warn("Error al cargar álbumes, intentando consulta básica.");
            const retry = await _supabase
                .from('albums')
                .select('*')
                .eq('user_id', userId)
                .order('position', { ascending: true });
            albums = retry.data;
            error = retry.error;
        }

        if (albums) {
            // Filtrar en JS para tratar null como público (true)
            // Solo ocultamos si is_public es explícitamente false
            albums = albums.filter(a => a.is_public !== false);
            window.currentAlbums = albums;
        }

        if (error) {
            $('#albums-container').html('<div class="error">Error al cargar álbumes.</div>');
            return;
        }

        if (albums.length === 0) {
            $('#albums-container').html('<div class="empty">No hay álbumes disponibles.</div>');
            return;
        }

        $('#albums-container').empty();
        if (filterId && albums && albums.length > 0) {
            $('<div class="focus-mode-exception" style="margin-bottom: 30px; text-align: center;"><button class="btn btn-primary" onclick="clearShareFilters()"><i class="fas fa-th-list"></i> Ver Toda la Colección</button></div>').appendTo('#albums-container');
        }
        await Promise.all(albums.map(album => renderAlbum(album)));
    } catch (e) {
        console.error("Error in loadPublicAlbums:", e);
        $('#albums-container').html('<div class="error">Error al cargar la colección.</div>');
    } finally {
        hideLoading();
        resolve();
    }
    });
}

function loadPublicDecks() {
    return new Promise(async (resolve) => {
    const identifier = window.currentStoreIdentifier;
    if (!identifier) { resolve(); return; }

    $('#decks-container').html('<div class="loading">Cargando decks...</div>');

    const params = new URLSearchParams(window.location.search);
    const filterId = params.get('deckId');

    try {
        let user;
        if (window.currentStoreId) {
            user = { id: window.currentStoreId };
        } else {
            user = await resolveUser(identifier);
            if (user) window.currentStoreId = user.id;
        }

        if (!user) {
            resolve();
            return;
        }

        let deckQuery = _supabase
            .from('decks')
            .select(`
                *,
                deck_cards (*)
            `)
            .eq('user_id', user.id)
            .order('position', { ascending: true })
            .order('position', { foreignTable: 'deck_cards', ascending: true });

        if (filterId) {
            deckQuery = deckQuery.eq('id', filterId);
        }

        let { data: decks, error } = await deckQuery;

        // Fallback if query failed
        if (error) {
            console.warn("Error al cargar decks, intentando consulta básica.");
            const retry = await _supabase
                .from('decks')
                .select(`
                    *,
                    deck_cards (*)
                `)
                .eq('user_id', user.id)
                .order('position', { ascending: true })
                .order('position', { foreignTable: 'deck_cards', ascending: true });
            decks = retry.data;
            error = retry.error;
        }

        if (decks) {
            // Filtrar en JS para tratar null como público (true)
            decks = decks.filter(d => d.is_public !== false);
        }

        if (error || !decks) {
            $('#decks-container').html('<div class="error">No se pudieron cargar los decks.</div>');
            return;
        }

        $('#decks-container').empty();
        if (filterId && decks && decks.length > 0) {
            $('<div class="focus-mode-exception" style="grid-column: 1/-1; margin-bottom: 20px; text-align: center;"><button class="btn btn-primary" onclick="clearShareFilters()"><i class="fas fa-th-list"></i> Ver Todos los Decks</button></div>').appendTo('#decks-container');
        }
        if (decks.length === 0) {
            $('#decks-container').html('<div class="empty">Esta tienda aún no tiene decks públicos.</div>');
            return;
        }

        decks.forEach(deck => {
            // Ensure cards are sorted by position locally as a fallback
            if (deck.deck_cards) {
                deck.deck_cards.sort((a, b) => (a.position || 0) - (b.position || 0));
            }
            const deckId = `deck-swiper-${deck.id}`;

            // Calculate Total Sum
            const totalSum = (deck.deck_cards || []).reduce((sum, card) => {
                const priceStr = card.price || '0';
                const price = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
                const qty = parseInt(card.quantity) || 1;
                return sum + (price * qty);
            }, 0);

            const hasSpecialPrice = deck.use_special_price && deck.special_price;
            const priceDisplay = hasSpecialPrice
                ? `<div class="deck-price-container">
                    <span class="price-total price-strikethrough">$${totalSum.toFixed(2)}</span>
                    <span class="price-special">${deck.special_price}</span>
                   </div>`
                : `<div class="deck-price-container">
                    <span class="price-total">$${totalSum.toFixed(2)}</span>
                   </div>`;

            const $deckItem = $(`
                <div class="deck-public-item" id="deck-item-${deck.id}">
                    <div class="deck-header-info">
                        <h3 style="margin-bottom: 5px;">${deck.name}</h3>
                        ${priceDisplay}
                    </div>
                    <button class="btn-share-item btn-share-floating" onclick="openShareModal('${deck.name.replace(/'/g, "\\'")}', 'decks', '${deck.id}')" title="Compartir Deck">
                        <i class="fas fa-share-alt"></i>
                    </button>

                    <div class="container deck-carousel-container">
                        <div class="swiper swiperyg ${deckId}">
                            <div class="swiper-wrapper">
                                ${deck.deck_cards.map(card => `
                                    <div class="swiper-slide card-slot"
                                         data-name="${card.name || ''}"
                                         data-rarity="${card.rarity || ''}"
                                         data-holo="${card.holo_effect || ''}"
                                         data-mask="${card.custom_mask_url || ''}"
                                         data-expansion="${card.expansion || ''}"
                                         data-condition="${card.condition || ''}"
                                         data-quantity="${card.quantity || '1'}"
                                         data-price="${card.price || ''}"
                                         data-obtained="${card.obtained !== false}">
                                        <img src="${card.image_url}" alt="${card.name || 'Carta'}" />
                                        <div class="zoom-btn"><i class="fas fa-search-plus"></i></div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <div class="deck-toggle-container">
                        <button class="btn btn-sm btn-toggle-deck-view" data-deck-id="${deck.id}" title="Ver Lista">
                            <i class="fas fa-th"></i> Modo Lista
                        </button>
                    </div>
                </div>
            `);

            $('#decks-container').append($deckItem);

            // El manejo de clics se mantiene normal, la prioridad táctil
            // ya se maneja con el listener global en fase de captura.
            $deckItem.find('.zoom-btn').on('click', function(e) {
                e.stopPropagation();
                openCardModal($(this).closest('.card-slot'));
            });

            new Swiper(`.${deckId}`, {
                effect: "cards",
                grabCursor: true,
                perSlideOffset: 8,
                perSlideRotate: 2,
                rotate: true,
                slideShadows: true,
                preventClicksPropagation: false,
                on: {
                    click: function(s, e) {
                        if (!isDragging) {
                            const $slot = $(e.target).closest('.card-slot');
                            if ($slot.length) {
                                // Popup fix: Only open if it's the active slide
                                if (s.clickedIndex !== s.activeIndex) return;

                                openCardModal($slot);
                            }
                        }
                    }
                }
            });
        });
    } catch (e) {
        console.error("Error in loadPublicDecks:", e);
        $('#decks-container').html('<div class="error">Error al cargar los decks.</div>');
    } finally {
        setTimeout(() => {
            hideLoading();
            resolve();
        }, 500);
    }
    });
}

function initTheme() {
    const savedTheme = localStorage.getItem('tcg_theme') || 'theme-dark';
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    $('body').removeClass('theme-light theme-medium theme-dark').addClass(theme);
    localStorage.setItem('tcg_theme', theme);

    // Update theme icons
    $('.theme-btn, .theme-btn-small').removeClass('active');
    $(`.theme-btn[data-theme="${theme}"], .theme-btn-small[data-theme="${theme}"]`).addClass('active');
}

async function checkSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        window.currentUserId = session.user.id;
        const { data: user } = await _supabase
            .from('usuarios')
            .select('id, username, store_name, store_logo, is_store, role')
            .eq('id', session.user.id)
            .single();

        try {
            if (user) {
                localStorage.setItem('tcg_session', JSON.stringify(user));
                window.currentUser = user;
                if (user.is_store) {
                    $('#dropdown-user-logo').show().attr('src', user.store_logo || 'https://midominio.com/placeholder-logo.png');
                    $('#dropdown-user-name').text(user.store_name || user.username);
                    $('#dropdown-user-role').hide();
                } else {
                    $('#dropdown-user-logo').hide();
                    $('#dropdown-user-name').text(user.username);
                    $('#dropdown-user-role').hide();
                }
            }
        } catch (e) {
            console.error("Error parsing session:", e);
        }
    } else {
        $('#dropdown-user-logo').hide();
        $('#dropdown-user-name').text('Invitado');
        $('#dropdown-user-role').text('Invitado').show();
    }
}

async function loadPublicSpirits() {
    // El usuario no quiere pantalla de carga completa (loading screen) aquí
    $('#public-spirits-grid').html('<div class="loading">Cargando interfaz...</div>');

    const { data: spirits, error } = await _supabase
        .from('spirits')
        .select('*')
        .order('name', { ascending: true });

    if (error || !spirits) {
        $('#public-spirits-grid').html('<div class="error">Error al cargar compañeros.</div>');
        return;
    }

    // Filtrar solo públicos
    const visibleSpirits = spirits.filter(s => s.is_public !== false);

    const selectedId = window.currentSpirit ? window.currentSpirit.id : null;

    if (visibleSpirits.length === 0) {
        $('#public-spirits-grid').html('<div class="empty">No hay compañeros disponibles.</div>');
        return;
    }

    const $grid = $('#public-spirits-grid');
    $grid.empty();

    window.dispatchEvent(new CustomEvent('hide-loading'));

    visibleSpirits.forEach(spirit => {
        const isSelected = spirit.id == selectedId;

        const $card = $(`
            <div class="spirit-card ${isSelected ? 'selected' : ''}"
                 data-id="${spirit.id}"
                 data-gltf="${spirit.gltf_url}"
                 data-name="${spirit.name}">
                <div class="badge-selected">Actual</div>
                <model-viewer
                    src="${spirit.gltf_url}"
                    loading="lazy"
                    camera-controls
                    shadow-intensity="1"
                    environment-image="neutral"
                    exposure="1.2">
                </model-viewer>
                <h3>${spirit.name}</h3>
                <div class="zoom-btn" style="display: flex;"><i class="fas fa-search-plus"></i></div>
            </div>
        `);

        $grid.append($card);
    });
}

function getAlbumSize($albumContainer) {
    const isMobile = window.innerWidth <= 640;
    let width = 600;
    let height = 420;

    if (isMobile) {
        // En móvil usamos el ancho del contenedor con un pequeño margen
        const containerWidth = $albumContainer.width() || $(window).width();
        const availableWidth = Math.min(600, containerWidth - 20);
        width = availableWidth;
        height = Math.floor(width * (420 / 600));
    }
    return { width, height };
}

function loadPageImages($album, page) {
    // turn.js standard class is .p[number], and we also use data-page-num
    const $page = $album.find(`.page[data-page-num="${page}"], .p${page}`);
    if (!$page.length) return;

    $page.find('img[data-src]').each(function() {
        const $img = $(this);
        const src = $img.attr('data-src');
        if (src) {
            $img.attr('src', src);
            $img.removeAttr('data-src');
        }
    });
}

function renderAlbum(album) {
    return new Promise(async (resolve) => {
    const $albumContainer = $(`
        <div class="public-album-item" id="album-container-${album.id}">
            <div class="public-album-header">
                <i class="fas fa-book-open"></i> ${album.title}
                <button class="btn-share-item" onclick="openShareModal('${album.title.replace(/'/g, "\\'")}', 'albums', '${album.id}')" title="Compartir Álbum">
                    <i class="fas fa-share-alt"></i>
                </button>
            </div>
            <div class="album-wrapper">
                <div id="album-${album.id}" class="album"></div>
            </div>
        </div>
    `);

    const $albumDiv = $albumContainer.find('.album');
    $('#albums-container').append($albumContainer);

    let { data: pages } = await _supabase
        .from('pages')
        .select('*')
        .eq('album_id', album.id)
        .order('page_index', { ascending: true });

    if (!pages) pages = [];

    const coverImg = album.cover_image_url;
    const coverColor = album.cover_color || '#1a1a1a';
    let pageCount = 1;

    if (coverImg) {
        $albumDiv.append(`<div class="page album-page cover-page" data-page-num="${pageCount}"><img src="${coverImg}"></div>`);
    } else {
        $albumDiv.append(`
            <div class="page album-page cover-page" data-page-num="${pageCount}">
                <div class="textured-cover" style="background-color: ${coverColor}">
                    <h2>${album.title}</h2>
                </div>
            </div>
        `);
    }

    for (const page of pages) {
        pageCount++;
        const $pageDiv = $(`<div class="page album-page" data-page-num="${pageCount}"></div>`);
        const $grid = $('<div class="grid-container"></div>');

        const { data: slots } = await _supabase
            .from('card_slots')
            .select('*')
            .eq('page_id', page.id)
            .order('slot_index', { ascending: true });

        for (let i = 0; i < 9; i++) {
            const slotData = slots ? slots.find(s => s.slot_index === i) : null;
            const $slot = $('<div class="card-slot"></div>');

            if (slotData) {
                // El nombre de la carta se almacena como atributo data-name para búsquedas (invisible en UI)
                // data-page almacena el número de página para navegación directa
                $slot.attr({
                    'data-name': slotData.name || '',
                    'data-page': pageCount,
                    'data-rarity': slotData.rarity || '',
                    'data-holo': slotData.holo_effect || '',
                    'data-mask': slotData.custom_mask_url || '',
                    'data-expansion': slotData.expansion || '',
                    'data-condition': slotData.condition || '',
                    'data-quantity': slotData.quantity || '',
                    'data-price': slotData.price || ''
                });
                if (slotData.image_url) {
                    const cardAlt = slotData.name || 'Carta';
                    $slot.append(`<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" data-src="${slotData.image_url}" class="tcg-card" alt="${cardAlt}">`);
                    const $zoomBtn = $('<div class="zoom-btn"><i class="fas fa-search-plus"></i></div>');

                    // Prioridad para móvil: el listener global captura el touchstart.
                    // Aquí manejamos el clic final para abrir el modal.
                    $zoomBtn.on('click', function(e) {
                        e.stopPropagation();
                        openCardModal($(this).closest('.card-slot'));
                    });

                    $slot.append($zoomBtn);
                }
            }
            $grid.append($slot);
        }

        $pageDiv.append($grid).appendTo($albumDiv);
    }

    // Asegurarnos de que el álbum siempre termine con una contraportada independiente.
    // Para que la contraportada quede al final (lado izquierdo en double-page),
    // el total de páginas debe ser par.
    // Total = 1 (portada) + pages.length (internas) + [1 si hay relleno] + 1 (contraportada).
    // Si (1 + pages.length + 1) es impar (es decir, pages.length es impar), añadimos relleno.
    if (pages.length % 2 !== 0) {
        pageCount++;
        $albumDiv.append(`<div class="page album-page" data-page-num="${pageCount}"></div>`);
    }

    // Añadir contraportada siempre
    pageCount++;
    const backImg = album.back_image_url;
    const backColor = album.back_color || '#1a1a1a';

    if (backImg) {
        $albumDiv.append(`<div class="page album-page cover-page" data-page-num="${pageCount}"><img src="${backImg}"></div>`);
    } else {
        $albumDiv.append(`
            <div class="page album-page cover-page" data-page-num="${pageCount}">
                <div class="textured-cover" style="background-color: ${backColor}"></div>
            </div>
        `);
    }

    const $images = $albumDiv.find('img');
    let loadedCount = 0;
    let turnInitialized = false;

    const initTurn = () => {
        if (turnInitialized) return;
        turnInitialized = true;

        const isMobile = window.innerWidth <= 640;
        const { width, height } = getAlbumSize($albumContainer);

        $albumDiv.turn({
            width: width,
            height: height,
            autoCenter: true,
            gradients: true,
            acceleration: true,
            display: 'double',
            elevation: 50,
            duration: 800, // Duración equilibrada para rapidez y suavidad
            cornerSize: isMobile ? 50 : 100, // Menor área en móvil para evitar tirones accidentales
            when: {
                start: function(event, pageObject, corner) {
                    if (!corner && !isManualPageTurn) {
                        event.preventDefault();
                        return;
                    }
                },
                turning: function(e, page) {
                    $(this).addClass('is-turning');
                    // Pre-load images for the current, next and following pages
                    loadPageImages($(this), page);
                    loadPageImages($(this), page + 1);
                    loadPageImages($(this), page + 2);
                    loadPageImages($(this), page + 3);
                },
                turned: function() {
                    $(this).removeClass('is-turning');
                    // Forzamos el re-ajuste y centrado para asegurar que la hoja quede bien anclada
                    const $el = $(this);
                    setTimeout(() => {
                        $el.turn('stop').turn('resize').turn('center');
                    }, 0);
                }
            }
        });
        resolve();
    };

    // Pre-load first 4 pages
    loadPageImages($albumDiv, 1);
    loadPageImages($albumDiv, 2);
    loadPageImages($albumDiv, 3);
    loadPageImages($albumDiv, 4);

    const $initialImages = $albumDiv.find('img').filter(function() {
        return $(this).attr('src') && !$(this).attr('src').startsWith('data:image');
    });

    if ($initialImages.length === 0) setTimeout(initTurn, 150);
    else {
        $initialImages.on('load error', function() {
            loadedCount++;
            if (loadedCount >= $initialImages.length) setTimeout(initTurn, 200);
        });
        // Safety timeout
        setTimeout(initTurn, 3000);
    }

    // Si ya hay una búsqueda activa al terminar de cargar el álbum, aplicarla
    const currentQuery = $('#search-input').val().trim();
    if (currentQuery) {
        setTimeout(() => { filterContent(currentQuery); }, 2000);
    }
    });
}

function loadPublicSealed() {
    return new Promise(async (resolve) => {
    let userId = window.currentStoreId;
    if (!userId) {
        const identifier = window.currentStoreIdentifier;
        const user = await resolveUser(identifier);
        if (user) {
            userId = user.id;
            window.currentStoreId = userId;
        }
    }
    if (!userId) { resolve(); return; }

    $('#sealed-container').html('<div class="loading">Cargando productos sellados...</div>');

    const params = new URLSearchParams(window.location.search);
    const filterId = params.get('productId');

    try {
        let query = _supabase
            .from('sealed_products')
            .select('*')
            .eq('user_id', userId)
            .eq('is_public', true)
            .order('created_at', { ascending: false });

        if (filterId) {
            query = query.eq('id', filterId);
        }

        const { data: products, error } = await query;

        if (error) throw error;

        if (!products || products.length === 0) {
            $('#sealed-container').html('<div class="empty">No hay productos sellados disponibles.</div>');
            return;
        }

        $('#sealed-container').empty();
        if (filterId && products && products.length > 0) {
            $('<div class="focus-mode-exception" style="grid-column: 1/-1; margin-bottom: 20px; text-align: center;"><button class="btn btn-primary" onclick="clearShareFilters()"><i class="fas fa-th-list"></i> Ver Todos los Productos</button></div>').appendTo('#sealed-container');
        }
        products.forEach(product => {
            const $item = $(`
                <div class="deck-public-item sealed-product-item" id="product-item-${product.id}" style="position: relative;">
                    <button class="btn-share-item btn-share-floating" onclick="openShareModal('${product.name.replace(/'/g, "\\'")}', 'sealed', '${product.id}')" title="Compartir Producto">
                        <i class="fas fa-share-alt"></i>
                    </button>
                    <div class="product-image-container">
                        <img src="${product.image_url || 'https://via.placeholder.com/300x150?text=Sin+Imagen'}"
                             alt="${product.name}" class="sealed-product-img">
                    </div>
                    <h3 style="margin: 10px 0; font-size: 1.1rem; min-height: 2.4em; display: flex; align-items: center; justify-content: center;">${product.name}</h3>
                    <div style="color: #00d2ff; font-weight: bold; font-size: 1.2rem; margin-bottom: 15px;">${product.price || 'Consultar'}</div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-add-sealed-cart" style="flex: 1;">
                            <i class="fas fa-cart-plus"></i>
                        </button>
                        <button class="btn btn-secondary" onclick="openShareModal('${product.name.replace(/'/g, "\\'")}', 'sealed', '${product.id}')" title="Compartir">
                            <i class="fas fa-share-alt"></i>
                        </button>
                    </div>
                </div>
            `);

            $item.find('.btn-add-sealed-cart').click(function(e) {
                e.stopPropagation();
                Cart.add({
                    name: product.name,
                    image_url: product.image_url,
                    price: product.price,
                    tcg: product.tcg
                });
                Swal.fire({
                    title: '¡Añadido!',
                    text: `${product.name} se ha agregado al carrito.`,
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
            });

            $('#sealed-container').append($item);
        });

    } catch (e) {
        console.error("Error loading sealed products:", e);
        $('#sealed-container').html('<div class="error">Error al cargar productos.</div>');
    } finally {
        hideLoading();
        resolve();
    }
    });
}

function loadPublicEvents() {
    return new Promise(async (resolve) => {
    let userId = window.currentStoreId;
    if (!userId) {
        const identifier = window.currentStoreIdentifier;

        const user = await resolveUser(identifier);
        if (user) {
            userId = user.id;
            window.currentStoreId = userId;
        }
    }
    if (!userId) { resolve(); return; }

    $('#events-container').html('<div class="loading">Cargando...</div>');

    const params = new URLSearchParams(window.location.search);
    const filterId = params.get('eventId');

    try {
        let query = _supabase.from('events').select('*').eq('user_id', userId).eq('is_public', true).order('event_date', { ascending: true });

        if (filterId) {
            query = query.eq('id', filterId);
        }

        const { data: events, error } = await query;

        if (error) throw error;

        if (!events || events.length === 0) {
            $('#events-container').html('<div class="empty">No hay eventos programados.</div>');
            return;
        }

        $('#events-container').empty();
        if (filterId && events && events.length > 0) {
            $('<div class="focus-mode-exception" style="grid-column: 1/-1; margin-bottom: 20px; text-align: center;"><button class="btn btn-primary" onclick="clearShareFilters()"><i class="fas fa-th-list"></i> Ver Todos los Eventos</button></div>').appendTo('#events-container');
        }
        events.forEach((item, index) => {
            const now = new Date();
            const eventDate = item.event_date ? new Date(item.event_date) : null;
            const isPast = eventDate && eventDate < now;
            const itemId = `event-${item.id}`;

            // Check if ending soon (within 2 days)
            let endingSoonHtml = "";
            if (eventDate && !isPast) {
                const diffTime = eventDate - now;
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                if (diffDays <= 2) {
                    endingSoonHtml = `<div class="ending-soon-warning"><i class="fas fa-exclamation-triangle"></i> Queda poco para que este evento termine</div>`;
                }
            }

            const typeClass = item.type ? `public-event-${item.type}` : 'public-event-informativo';
            const typeLabel = item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : 'Evento';

            const $card = $(`
                <div id="${itemId}" class="deck-public-item sealed-product-item public-event-card ${typeClass}"
                     style="${isPast ? 'opacity: 0.6; filter: grayscale(1);' : ''}; animation-delay: ${index * 0.1}s; position: relative;">
                    <button class="btn-share-item btn-share-floating" onclick="openShareModal('${item.name.replace(/'/g, "\\'")}', 'events', '${item.id}')" title="Compartir Evento">
                        <i class="fas fa-share-alt"></i>
                    </button>
                    ${item.image_url ? `
                    <div class="product-image-container">
                        <img src="${item.image_url}" class="sealed-product-img">
                    </div>
                    ` : ''}
                    <div class="event-content-wrapper" style="padding: 15px; flex: 1; display: flex; flex-direction: column;">
                        ${item.name ? `<h3 style="margin: 10px 0;">${item.name}</h3>` : ''}
                        ${item.event_date ? `
                        <div style="font-size: 0.85rem; color: #00d2ff; font-weight: bold; margin-bottom: 5px;">
                            <i class="fas fa-calendar-day"></i> ${eventDate.toLocaleString()}
                        </div>
                        ` : ''}
                        ${endingSoonHtml}
                        ${item.description ? `<p style="font-size: 0.85rem; color: #aaa; text-align: left; line-height: 1.5; margin-top: 10px;">${item.description}</p>` : ''}
                        ${isPast ? '<div style="color: #666; font-weight: bold; text-transform: uppercase; font-size: 0.8rem; margin-top: auto; padding-top: 15px;">Finalizado</div>' : ''}
                    </div>
                </div>
            `);
            $('#events-container').append($card);
        });
    } catch (e) {
        console.error(e);
        $('#events-container').html('<div class="error">Error al cargar la sección.</div>');
    } finally {
        hideLoading();
        resolve();
    }
    });
}


function loadPublicWishlist() {
    return new Promise(async (resolve) => {
    let userId = window.currentStoreId;

    if (!userId) {
        const identifier = window.currentStoreIdentifier;
        const user = await resolveUser(identifier);
        if (user) {
            userId = user.id;
            window.currentStoreId = userId;
        }
    }

    if (!userId) { resolve(); return; }

    // Show/Hide owner controls
    const isOwner = window.currentUserId === window.currentStoreId;

    // Share button for current slot
    if (!$('#btn-share-wishlist').length) {
        $('<button id="btn-share-wishlist" class="btn btn-sm" style="border-radius: 50px; background: rgba(255,255,255,0.1); margin-right: 10px;"><i class="fas fa-share-alt"></i> Compartir Lista</button>')
            .insertAfter('#btn-owner-add-wishlist')
            .on('click', () => {
                const activeSlot = $('.wishlist-tab.active').data('index') || 0;
                window.openShareModal(`Buscamos - Slot ${parseInt(activeSlot)+1}`, 'wishlist', activeSlot);
            });
    }

    if (isOwner) {
        $('#btn-owner-add-wishlist').show();
        // Owners see all tabs
        $('.wishlist-tab').show();
    } else {
        $('#btn-owner-add-wishlist').hide();

        // Non-owners: only show tabs that have items
        try {
            const { data: slotCounts } = await _supabase
                .from('wishlist')
                .select('list_index')
                .eq('user_id', userId);

            const activeSlots = new Set((slotCounts || []).map(s => s.list_index));
            $('.wishlist-tab').each(function() {
                const idx = parseInt($(this).data('index'));
                if (activeSlots.has(idx)) $(this).show();
                else $(this).hide();
            });

            // If current tab is hidden, switch to first visible
            if (!activeSlots.has(window.currentWishlistTab || 0)) {
                const firstSlot = Array.from(activeSlots).sort((a,b) => a-b)[0];
                if (firstSlot !== undefined) {
                    window.currentWishlistTab = firstSlot;
                    $('.wishlist-tab').removeClass('active');
                    $(`.wishlist-tab[data-index="${firstSlot}"]`).addClass('active');
                }
            }
        } catch(e) { console.warn(e); }
    }

    $('#wishlist-container').removeClass('decks-grid').addClass('wishlist-grid');
    $('#wishlist-container').html('<div class="loading">Cargando lista de deseos...</div>');

    const params = new URLSearchParams(window.location.search);
    const filterId = params.get('wishlistId');

    try {
        const listIdx = window.currentWishlistTab || 0;
        let query = _supabase
            .from('wishlist')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (filterId) {
            query = query.eq('id', filterId);
        } else {
            query = query.eq('list_index', listIdx);
        }

        const { data: wishlist, error } = await query;

        let finalWishlist = wishlist;
        if (error) {
            // Reintentar sin filtro de list_index si falla (por si la columna no existe aún)
            const retry = await _supabase.from('wishlist').select('*').eq('user_id', userId).order('created_at', { ascending: false });
            if (retry.error) throw retry.error;
            finalWishlist = retry.data;
        }

        if (!finalWishlist || finalWishlist.length === 0) {
            $('#wishlist-container').html('<div class="empty">No se encontró el elemento o la lista está vacía.</div>');
            return;
        }

        $('#wishlist-container').empty();
        if (filterId && finalWishlist && finalWishlist.length > 0) {
            $('<div class="focus-mode-exception" style="grid-column: 1/-1; margin-bottom: 20px; text-align: center;"><button class="btn btn-primary" onclick="clearShareFilters()"><i class="fas fa-th-list"></i> Ver Lista Completa</button></div>').appendTo('#wishlist-container');
        }
        finalWishlist.forEach(item => {
            const $el = $(`
                <div class="wishlist-card-item card-slot" id="wishlist-item-${item.id}"
                     data-id="${item.id}"
                     data-name="${item.name}"
                     data-rarity="${item.rarity || '-'}"
                     data-notes="${item.notes || ''}"
                     data-quantity="${item.quantity || '1'}"
                     data-obtained="${item.obtained}"
                     data-holo="${item.holo_effect || ''}"
                     data-mask="${item.custom_mask_url || ''}"
                     data-3d="${item.use_3d !== false}"
                     style="${item.obtained ? 'opacity: 0.5;' : ''}">
                    <button class="btn-share-item btn-share-floating" onclick="event.stopPropagation(); window.openShareModal('${item.name.replace(/'/g, "\\'")}', 'wishlist', '${item.list_index}', '${item.id}')" title="Compartir Carta">
                        <i class="fas fa-share-alt"></i>
                    </button>
                    <h3>${item.name}</h3>
                    <img src="${item.image_url}" alt="${item.name}">
                    ${item.obtained ? '<div class="event-type-badge" style="background: #00ff88; color: #000; bottom: 5px; top: auto;">CONSEGUIDA</div>' : ''}
                    <div class="zoom-btn" style="display: flex; bottom: 5px; right: 5px; left: auto;"><i class="fas fa-search-plus"></i></div>
                </div>
            `);

            $el.click(function(e) {
                if (isDragging) return;
                openCardModal($el);
            });

            $el.find('.zoom-btn').click(function(e) {
                e.stopPropagation();
                openCardModal($el);
            });

            $('#wishlist-container').append($el);
        });
    } catch (e) {
        console.error("Error loading wishlist:", e);
        $('#wishlist-container').html('<div class="error">Error al cargar los deseos.</div>');
    } finally {
        hideLoading();
        resolve();
    }
    });
}

function makeCompanionDraggable() {
    const wrapper = document.getElementById('companion-wrapper');
    const handle = document.getElementById('companion-drag-handle');
    if (!wrapper || !handle) return;

    let isDragging = false;
    let startX, startY;
    let initialX, initialY;
    window.isCompanionDragging = false;

    // Reset touchAction on the companion container to allow internal interactions
    const companion = document.getElementById('floating-companion-container');
    if (companion) companion.style.touchAction = 'auto';

    handle.style.touchAction = 'none';

    handle.addEventListener('pointerdown', (e) => {
        isDragging = true;
        window.isCompanionDragging = false;
        startX = e.clientX;
        startY = e.clientY;
        const rect = wrapper.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
        handle.setPointerCapture(e.pointerId);
        e.stopPropagation();
    });

    window.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) window.isCompanionDragging = true;
        let newX = initialX + dx;
        let newY = initialY + dy;
        newX = Math.max(0, Math.min(window.innerWidth - wrapper.offsetWidth, newX));
        newY = Math.max(0, Math.min(window.innerHeight - wrapper.offsetHeight, newY));

        wrapper.style.left = newX + 'px';
        wrapper.style.top = newY + 'px';
        wrapper.style.bottom = 'auto';
        wrapper.style.right = 'auto';
        wrapper.style.margin = '0';
    });

    window.addEventListener('pointerup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        setTimeout(() => { window.isCompanionDragging = false; }, 100);
    });
}

$(document).on('click', '.btn-toggle-deck-view', function() {
    const deckId = $(this).data('deck-id');
    const $deckItem = $(`#deck-item-${deckId}`);
    const deckName = $deckItem.find('h3').text();

    // Fill modal with cards from Swiper slides
    const $container = $('#deck-grid-container');
    $container.empty();
    $('#deck-list-title').text(deckName);

    $deckItem.find('.swiper-slide:not(.swiper-slide-duplicate)').each(function() {
        const $slide = $(this);
        const obtained = $slide.data('obtained');
        const $card = $(`
            <div class="grid-card-item card-slot"
                 data-name="${$slide.data('name')}"
                 data-rarity="${$slide.data('rarity')}"
                 data-holo="${$slide.data('holo')}"
                 data-mask="${$slide.data('mask')}"
                 data-expansion="${$slide.data('expansion')}"
                 data-condition="${$slide.data('condition')}"
                 data-quantity="${$slide.data('quantity')}"
                 data-price="${$slide.data('price')}"
                 data-obtained="${obtained}">
                <img src="${$slide.find('img').attr('src')}" alt="${$slide.data('name')}" />
            </div>
        `);
        $container.append($card);
    });

    // Reset filters
    $('.deck-filter-tab').removeClass('active');
    $('.deck-filter-tab[data-filter="all"]').addClass('active');

    $('#deck-list-overlay').addClass('active');
    $('body').addClass('modal-open');
});

$(document).on('click', '.deck-filter-tab', function() {
    const filter = $(this).data('filter');
    $('.deck-filter-tab').removeClass('active');
    $(this).addClass('active');

    if (filter === 'all') {
        $('#deck-grid-container .grid-card-item').show();
    } else {
        $('#deck-grid-container .grid-card-item').each(function() {
            const obtained = $(this).data('obtained');
            // If it's a string from data-obtained, check against "false"
            if (obtained === false || obtained === "false") $(this).show();
            else $(this).hide();
        });
    }
});

// --- Auction Logic ---
let auctionTimers = {};

function loadPublicAuctions() {
    return new Promise(async (resolve) => {
        let userId = window.currentStoreId;
        if (!userId) {
            const identifier = window.currentStoreIdentifier;
            const user = await resolveUser(identifier);
            if (user) userId = user.id;
        }
        if (!userId) { resolve(); return; }

        $('#auctions-container').html('<div class="loading">Cargando subastas...</div>');

        try {
            const { data: auctions, error } = await _supabase
                .from('subastas')
                .select(`
                    *,
                    subastas_pujas (
                        amount,
                        bidder_name,
                        created_at
                    )
                `)
                .eq('user_id', userId)
                .eq('is_live', true)
                .eq('status', 'Activa')
                .order('end_date', { ascending: true });

            if (error) throw error;

            if (!auctions || auctions.length === 0) {
                $('#auctions-container').html('<div class="empty">No hay subastas activas en este momento.</div>');
                return;
            }

            $('#auctions-container').empty();
            auctions.forEach(auction => {
                renderAuctionCard(auction);
            });

        } catch (e) {
            console.error("Error loading auctions:", e);
            $('#auctions-container').html('<div class="error">Error al cargar subastas.</div>');
        } finally {
            hideLoading();
            resolve();
        }
    });
}

function renderAuctionCard(auction) {
    const bids = auction.subastas_pujas || [];
    const currentBid = bids.length > 0 ? Math.max(...bids.map(b => b.amount)) : auction.starting_bid;

    const $card = $(`
        <div class="auction-card" id="auction-${auction.id}">
            <div class="auction-status-badge status-live">En Vivo</div>
            <div class="auction-image-container">
                <img src="${auction.image_url || 'https://via.placeholder.com/300x200?text=Sin+Imagen'}" alt="${auction.nombre}">
            </div>
            <div class="auction-info">
                <h3 class="auction-title">${auction.nombre}</h3>
                <div class="auction-bid-info">
                    <div>
                        <div class="current-bid-label">Puja Actual</div>
                        <div class="current-bid-value">$${currentBid.toFixed(2)}</div>
                    </div>
                    <div class="auction-timer" id="timer-${auction.id}">--:--:--</div>
                </div>
                <button class="btn btn-sm btn-view-auction" style="width: 100%; margin-top: 10px;">
                    <i class="fas fa-gavel"></i> Participar
                </button>
            </div>
        </div>
    `);

    $card.find('.btn-view-auction').click(() => openAuctionDetail(auction));
    $('#auctions-container').append($card);

    startAuctionTimer(auction);
}

function startAuctionTimer(auction) {
    if (auctionTimers[auction.id]) clearInterval(auctionTimers[auction.id]);

    const endDate = new Date(auction.end_date).getTime();

    const update = () => {
        const now = new Date().getTime();
        const distance = endDate - now;

        if (distance < 0) {
            $(`#timer-${auction.id}, #auction-modal-timer`).text("FINALIZADA");
            $(`#auction-${auction.id}`).find('.auction-status-badge').removeClass('status-live').addClass('status-ended').text('Finalizada');
            $(`#auction-${auction.id}`).removeClass('auction-ending-soon');
            clearInterval(auctionTimers[auction.id]);
            return;
        }

        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        $(`#timer-${auction.id}, #auction-modal-timer`).text(timeStr);

        // Alert Effects
        if (distance < (1000 * 60 * 60)) { // 1 Hour
            $(`#auction-${auction.id}`).addClass('auction-ending-soon');

            // Bot Interaction (Only if view is auctions and distance is close to thresholds)
            if (window.botInstance && $('.nav-btn[data-view="auctions"]').hasClass('active')) {
                const minsLeft = Math.floor(distance / (1000 * 60));
                if (minsLeft === 59 && seconds === 0) {
                    window.botInstance.say(`¡Huy! Falta solo una hora para que termine la subasta de "${auction.nombre}". ¡No te quedes fuera!`, { duration: 10 });
                } else if (minsLeft === 5 && seconds === 0) {
                    window.botInstance.say(`¡Atención! Solo quedan 5 minutos para el cierre de "${auction.nombre}". ¡Es ahora o nunca!`, { duration: 8 });
                }
            }
        }
    };

    update();
    auctionTimers[auction.id] = setInterval(update, 1000);
}

async function openAuctionDetail(auction) {
    const $modal = $('#auction-detail-modal');
    $('#auction-modal-title').text(auction.nombre);
    $('#auction-modal-desc').text(auction.description || 'Sin descripción.');
    $('#auction-modal-rules').text(auction.rules || 'Reglas estándar de subasta.');
    $('#auction-modal-image').attr('src', auction.image_url);
    $('#auction-modal-start-bid').text(`$${auction.starting_bid.toFixed(2)}`);

    window.currentAuctionId = auction.id;
    window.currentAuctionData = auction;

    updateAuctionBidsUI(auction.id);

    // Setup Quick Bids
    const $quickContainer = $('#quick-bid-container');
    $quickContainer.empty();

    if (auction.increment_type === 'fixed') {
        const inc = auction.min_increment;
        [inc, inc * 2, inc * 5].forEach(val => {
            $quickContainer.append(`<button class="btn-bid-amount" onclick="quickBid(${val})">+$${val}</button>`);
        });
    } else {
        [5, 10, 20].forEach(val => {
            $quickContainer.append(`<button class="btn-bid-amount" onclick="quickBid(${val})">+$${val}</button>`);
        });
    }

    $modal.addClass('active');
    $('body').addClass('modal-open');

    // Subscribe to bids (Realtime)
    const channel = _supabase
        .channel(`auction-${auction.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'subastas_pujas', filter: `subasta_id=eq.${auction.id}` }, payload => {
            updateAuctionBidsUI(auction.id);
        })
        .subscribe();

    window.currentAuctionChannel = channel;
}

async function updateAuctionBidsUI(auctionId) {
    const { data: bids, error } = await _supabase
        .from('subastas_pujas')
        .select('*')
        .eq('subasta_id', auctionId)
        .order('amount', { ascending: false });

    if (error) return;

    const currentBid = bids.length > 0 ? bids[0].amount : window.currentAuctionData.starting_bid;
    $('#auction-modal-current-bid').text(`$${currentBid.toFixed(2)}`);
    $(`#auction-${auctionId} .current-bid-value`).text(`$${currentBid.toFixed(2)}`);

    // Top 5 Bidders
    const $topList = $('#auction-top-bidders');
    $topList.empty();

    const isEnded = new Date(window.currentAuctionData.end_date) < new Date();

    if (isEnded && bids.length > 0) {
        $('#bid-input-container').hide();
        $('#auction-winner-display').show();
        $('#auction-winner-name').text(bids[0].bidder_name);
        $('#auction-winner-amount').text(`$${bids[0].amount.toFixed(2)}`);

        if (window.botInstance && !window.winnerAnnounced) {
            window.botInstance.say(`¡Tenemos un ganador para "${window.currentAuctionData.nombre}"! Felicidades a ${bids[0].bidder_name} por llevarse esta joya.`, { duration: 10 });
            window.winnerAnnounced = true;
        }
    } else {
        $('#bid-input-container').show();
        $('#auction-winner-display').hide();
        window.winnerAnnounced = false;
    }

    bids.slice(0, 5).forEach((bid, idx) => {
        $topList.append(`
            <div class="bidder-item ${idx === 0 && isEnded ? 'winner' : ''}">
                <span class="bidder-name">${idx + 1}. ${bid.bidder_name}</span>
                <span class="bid-amount">$${bid.amount.toFixed(2)}</span>
            </div>
        `);
    });
}

window.quickBid = function(amount) {
    const current = parseFloat($('#auction-modal-current-bid').text().replace('$', '')) || 0;
    $('#input-bid-amount').val(current + amount);
};

$('#btn-place-bid').click(async function() {
    if (!window.currentUser || !window.currentUser.id) {
        Swal.fire('Atención', 'Debes iniciar sesión para participar en las subastas.', 'warning');
        return;
    }

    // Role-based limits for participating
    const { count, error: countErr } = await _supabase
        .from('subastas_pujas')
        .select('subasta_id', { count: 'exact', head: true })
        .eq('bidder_id', window.currentUser.id);

    // This counts total bids, we need total unique ACTIVE auctions participated in
    const { data: participated } = await _supabase
        .from('subastas_pujas')
        .select('subasta_id, subastas(is_live, status)')
        .eq('bidder_id', window.currentUser.id);

    const activeParticipations = new Set(participated.filter(p => p.subastas && p.subastas.is_live && p.subastas.status === 'Activa').map(p => p.subasta_id)).size;

    let partLimit = (window.currentUser.role === 'premium') ? 20 : 10;
    if (window.currentUser.role === 'admin' || window.currentUser.role === 'admin_store') partLimit = 9999;

    if (activeParticipations >= partLimit) {
        Swal.fire('Límite alcanzado', `Tu plan permite participar en un máximo de ${partLimit} subastas activas simultáneamente.`, 'warning');
        return;
    }

    const bidAmount = parseFloat($('#input-bid-amount').val());
    const currentBid = parseFloat($('#auction-modal-current-bid').text().replace('$', '')) || 0;
    const minInc = window.currentAuctionData.min_increment || 1;

    if (isNaN(bidAmount) || bidAmount <= currentBid) {
        Swal.fire('Error', 'Tu puja debe ser mayor a la puja actual.', 'error');
        return;
    }

    if (window.currentAuctionData.increment_type === 'fixed' && (bidAmount - currentBid) < minInc) {
        Swal.fire('Error', `El incremento mínimo es de $${minInc}.`, 'error');
        return;
    }

    const { error } = await _supabase.from('subastas_pujas').insert([{
        subasta_id: window.currentAuctionId,
        bidder_id: window.currentUser.id,
        bidder_name: window.currentUser.username,
        amount: bidAmount
    }]);

    if (error) {
        Swal.fire('Error', 'No se pudo registrar tu puja.', 'error');
    } else {
        Swal.fire({ icon: 'success', title: 'Puja registrada', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
        $('#input-bid-amount').val('');
    }
});

$('#close-auction-modal, #auction-detail-modal').click(function(e) {
    if (e.target === this || $(this).hasClass('close-btn')) {
        $('#auction-detail-modal').removeClass('active');
        $('body').removeClass('modal-open');
        if (window.currentAuctionChannel) {
            _supabase.removeChannel(window.currentAuctionChannel);
            window.currentAuctionChannel = null;
        }
    }
});

$(document).on('click', '#close-deck-list, #deck-list-overlay', function(e) {
    if (e.target === this || $(this).attr('id') === 'close-deck-list') {
        $('#deck-list-overlay').removeClass('active');
        if (!$("#image-overlay").hasClass("active") && !$('#spirit-modal').hasClass('active')) {
            $('body').removeClass('modal-open');
        }
    }
});

async function showGeneralEventDetails(id) {
    try {
        const { data: event, error } = await _supabase.from('events').select('*').eq('id', id).single();
        if (error) throw error;

        $('#ed-name').text(event.name);
        $('#ed-desc').text(event.description || 'Sin descripción.');
        if (event.image_url) {
            $('#ed-image').attr('src', event.image_url).show();
        } else {
            $('#ed-image').hide();
        }

        $('#event-details-overlay').addClass('active');
    } catch (e) {
        console.error(e);
        Swal.fire('Error', 'No se pudieron cargar los detalles del evento.', 'error');
    }
}
