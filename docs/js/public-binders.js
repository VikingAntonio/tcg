/*
   Vista pública de Binders (public.html, ?view=binders).

   Replica el comportamiento de la vista pública de Inversiones:
   primero un menú con todas las colecciones (binders) y, al hacer click,
   se renderiza SOLO ese binder con turn.js (flip) y las mismas pestañas
   de modo (binders / vikingSlide / lista).

   Todo el CSS propio vive en css/public-binders.css, acotado a #binders-view.
   La vista pública de Inversiones no se toca.
*/
(function () {
    'use strict';

    const EMBED_PARAMS = ['embed', 'limit', 'max', 'albumId'];

    let currentBinder = null;
    let currentBinderMode = 'album';
    let binderCards = [];
    let binderPages = [];

    // ---------------------------------------------------------------- helpers

    function storeId() {
        return window.currentStoreId || null;
    }

    // Modo clásico (widget embebido): se mantiene el listado antiguo, sin
    // menú, para no romper los iframes del widget de Binders.
    function needsClassicRender() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('embed') === 'true') return true;
        return EMBED_PARAMS.some(p => p !== 'embed' && params.has(p));
    }
    window.publicBindersNeedsClassicRender = needsClassicRender;

    function slotQuantity(slot) {
        const raw = slot.quantity;
        if (raw === undefined || raw === null || raw === '') return 1;
        const n = parseInt(raw, 10);
        return isNaN(n) ? 1 : n;
    }

    // Normaliza un slot de binder al formato "carta" que usan los modos
    // slide/lista (mismo shape que las cartas de inversiones).
    function slotToCard(slot) {
        const qty = slotQuantity(slot);
        return {
            id: slot.id,
            card_name: slot.name || 'Carta',
            image_url: slot.image_url || '',
            current_price: parseFloat(slot.price) || 0,
            rarity: slot.rarity || '',
            set_name: slot.expansion || '',
            quantity: qty,
            is_available: qty > 0,
            notes: slot.description || '',
            extra_images: Array.isArray(slot.extra_images) ? slot.extra_images : [],
            holo_effect: slot.holo_effect || '',
            custom_mask_url: slot.custom_mask_url || '',
            show_foil: !!slot.holo_effect,
            slot: slot
        };
    }

    function cardPriceLabel(card) {
        return `$${parseFloat(card.current_price || 0).toFixed(2)}`;
    }

    function gridSlotCount(gridLayout) {
        if (gridLayout === '4x3') return 12;
        if (gridLayout === '4x4') return 16;
        if (gridLayout === '2x2') return 4;
        if (gridLayout === '1x1') return 1;
        return 9;
    }

    function albumSize($container, gridLayout) {
        let size = typeof window.getAlbumSize === 'function'
            ? window.getAlbumSize($container)
            : { width: 600, height: 420 };
        if (window.innerWidth <= 768 && gridLayout === '4x3') {
            const containerWidth = $container.width() || $(window).width();
            const width = Math.max(240, containerWidth - 2);
            size = { width: width, height: Math.floor(width * (420 / 600)) };
        }
        return size;
    }

    // Abre el modal nativo de carta reutilizando un .card-slot "fantasma"
    // con los data-* que espera openCardModal (app.js).
    function openBinderCardModal(card) {
        if (!card || !card.image_url || typeof window.openCardModal !== 'function') return;
        const slot = card.slot || {};
        const $stub = $('<div class="card-slot"></div>').attr({
            'data-id': card.id || '',
            'data-full-img': card.image_url,
            'data-name': card.card_name || '',
            'data-rarity': card.rarity || '',
            'data-holo': card.holo_effect || '',
            'data-mask': card.custom_mask_url || '',
            'data-expansion': card.set_name || '',
            'data-condition': slot.condition || '',
            'data-quantity': card.quantity,
            'data-price': slot.price || '',
            'data-language': slot.language || '',
            'data-edition': slot.edition || '',
            'data-description': card.notes || '',
            'data-extra-images': JSON.stringify(card.extra_images || [])
        });
        window.openCardModal($stub);
    }

    // ------------------------------------------------------- menú de binders

    async function loadPublicBinderCategories(userId) {
        userId = userId || storeId();
        if (!userId) {
            const identifier = window.currentStoreIdentifier
                || new URLSearchParams(window.location.search).get('id')
                || new URLSearchParams(window.location.search).get('store')
                || new URLSearchParams(window.location.search).get('user');
            if (identifier && typeof window.resolveUser === 'function') {
                const user = await window.resolveUser(identifier);
                if (user) {
                    userId = user.id;
                    window.currentStoreId = userId;
                }
            }
        }

        $('#public-binder-header').hide();
        $('#public-binder-tabs').hide();
        $('#binders-container').hide().empty();
        const $container = $('#public-binder-categories').show();
        $container.html('<div class="loading">Cargando Binders...</div>');

        if (!userId) {
            $container.html('<div class="empty">No hay Binders disponibles.</div>');
            return;
        }

        const { data: binders, error } = await _supabase
            .from('binders')
            .select('*')
            .eq('user_id', userId)
            .order('position', { ascending: true })
            .order('id', { ascending: true });

        if (error) {
            $container.html('<div class="error">Error al cargar Binders.</div>');
            return;
        }

        const publicBinders = (binders || []).filter(b => b.is_public !== false);
        window.currentBinders = publicBinders;

        if (publicBinders.length === 0) {
            $container.html('<div class="empty">No hay Binders disponibles.</div>');
            return;
        }

        // Enlace directo a un binder (?binderId=...): se abre tal cual.
        const binderId = new URLSearchParams(window.location.search).get('binderId');
        if (binderId) {
            const target = publicBinders.find(b => String(b.id) === String(binderId));
            if (target) {
                openPublicBinder(target);
                return;
            }
        }

        $container.empty();
        publicBinders.forEach(binder => {
            const coverImg = (binder.cover_image_url || '').trim();
            const coverColor = binder.cover_color || '#1a1a1a';
            const coverInner = coverImg
                ? `<img src="${coverImg}" alt="${escapeHtml(binder.title || 'Binder')}">`
                : `<div class="pub-binder-vault-cover-inner" style="background-color: ${coverColor};"><i class="fas fa-book pub-binder-vault-icon"></i></div>`;

            const $card = $(`
                <div class="pub-binder-vault" data-id="${binder.id}">
                    <div class="pub-binder-vault-cover">${coverInner}</div>
                    <div class="pub-binder-vault-body">
                        <h3 class="pub-binder-vault-name">${escapeHtml(binder.title || 'Binder')}</h3>
                        <div class="pub-binder-vault-meta">Binder</div>
                        <button type="button" class="pub-binder-vault-btn">Ver binder <i class="fas fa-arrow-right"></i></button>
                    </div>
                </div>
            `);
            $card.on('click', () => openPublicBinder(binder));
            $container.append($card);
        });
    }
    window.loadPublicBinderCategories = loadPublicBinderCategories;

    window.showPublicBinderCategories = function () {
        currentBinder = null;
        binderCards = [];
        currentBinderMode = 'album';
        loadPublicBinderCategories(storeId());
    };

    window.shareCurrentPublicBinder = function () {
        if (!currentBinder) return;
        if (typeof window.openShareModal === 'function') {
            window.openShareModal(currentBinder.title || 'Binder', 'binders', currentBinder.id);
        }
    };

    // ------------------------------------------------------ binder individual

    async function openPublicBinder(binder) {
        currentBinder = binder;
        currentBinderMode = 'album';
        $('#public-binder-title').text((binder.title || 'Binder').toUpperCase());
        $('#public-binder-header').show();
        $('#public-binder-tabs').show();
        $('#public-binder-categories').hide();
        const $container = $('#binders-container').show();
        $container.html('<div class="loading">Cargando binder...</div>');

        const { data: pages, error } = await _supabase
            .from('binder_pages')
            .select('*')
            .eq('binder_id', binder.id)
            .order('page_index', { ascending: true });

        if (error) {
            $container.html('<div class="error">Error al cargar el binder.</div>');
            return;
        }

        const pageList = pages || [];
        const pageIds = pageList.map(p => p.id);
        let allSlots = [];
        if (pageIds.length > 0) {
            const { data: slotsData } = await _supabase
                .from('binder_card_slots')
                .select('*')
                .in('page_id', pageIds)
                .order('slot_index', { ascending: true });
            allSlots = slotsData || [];
        }

        // Guarda las cartas normalizadas para los modos slide/lista y las
        // páginas reales (con sus slots) para respetar el layout del binder.
        binderCards = [];
        binderPages = pageList.map(page => {
            const slots = allSlots.filter(s => s.page_id === page.id);
            slots.forEach(s => {
                if (s && s.image_url) binderCards.push(slotToCard(s));
            });
            return { page: page, slots: slots };
        });

        if (binderCards.length === 0) {
            $container.html('<div class="empty">Este binder todavía no tiene cartas.</div>');
            return;
        }

        renderPublicBinder();
    }
    window.openPublicBinder = openPublicBinder;

    $(document).on('click', '#public-binder-tabs .tab-pill', function () {
        $('#public-binder-tabs .tab-pill').removeClass('active');
        $(this).addClass('active');
        currentBinderMode = $(this).data('mode');
        renderPublicBinder();
    });

    function renderPublicBinder() {
        const $container = $('#binders-container');
        $container.empty();
        if (currentBinderMode === 'album') {
            renderPublicBinderAlbum($container);
        } else if (currentBinderMode === 'slide') {
            renderPublicBinderSlide($container);
        } else {
            renderPublicBinderList($container);
        }
    }

    // ---------------------------------------------------------------- álbum

    function renderPublicBinderAlbum($container) {
        $container.addClass('pub-binder-album-layout')
            .removeClass('pub-binder-list-layout pub-binder-slide-layout');

        const gridLayout = (currentBinder && currentBinder.grid_layout) ? currentBinder.grid_layout : '3x3';
        const numSlots = gridSlotCount(gridLayout);

        $container.removeClass('inv-album-3x3 inv-album-4x3 inv-album-4x4 inv-album-2x2 inv-album-1x1')
            .addClass(`inv-album-${gridLayout}`);

        const { width, height } = albumSize($container, gridLayout);
        const $albumWrapper = $(`<div class="album-wrapper" style="width: ${width}px; height: ${height}px;"><div class="album public-binder-album"></div></div>`);
        const $album = $albumWrapper.find('.album');
        $container.append($albumWrapper);

        // Portada: se conserva la del binder (imagen propia o portada cósmica).
        const coverImg = (currentBinder.cover_image_url || '').trim();
        const coverColor = currentBinder.cover_color || '#1a1a1a';
        if (coverImg) {
            $album.append(`<div class="page cover-page"><img src="${coverImg}" alt="${escapeHtml(currentBinder.title || 'Binder')}"></div>`);
        } else {
            $album.append(`<div class="page cover-page">${getCoverHtml('style-cosmic', currentBinder.title, coverColor)}</div>`);
        }

        // Agrupa los slots por página respetando el orden real.
        renderAlbumPages($album, gridLayout, numSlots);

        if ($album.find('.page').length % 2 !== 0) {
            $album.append('<div class="page album-page"></div>');
        }

        // Contraportada
        const backImg = (currentBinder.back_image_url || '').trim();
        const backColor = currentBinder.back_color || 'transparent';
        if (backImg) {
            $album.append(`<div class="page cover-page"><img src="${backImg}"></div>`);
        } else {
            $album.append(`<div class="page cover-page"><div class="textured-cover style-cosmic" style="background-color: ${backColor}"></div></div>`);
        }

        setTimeout(() => {
            $album.turn({
                width: width,
                height: height,
                autoCenter: false,
                noCenter: true,
                display: 'double',
                gradients: false,
                acceleration: true,
                elevation: 50,
                duration: 800
            });
        }, 100);
    }

    // Construye las páginas de cartas del álbum respetando el layout real del
    // binder (mismo nº de slots por página y slot_index), con .card-slot +
    // zoom-btn para que el modal nativo siga funcionando.
    function renderAlbumPages($album, gridLayout, numSlots) {
        binderPages.forEach(entry => {
            const slots = entry.slots || [];
            if (slots.length === 0) return;
            const $page = $('<div class="page album-page"></div>');
            const $grid = $(`<div class="grid-container grid-layout-${gridLayout}"></div>`);

            for (let i = 0; i < numSlots; i++) {
                const slot = slots.find(s => s.slot_index === i);
                const $slot = $('<div class="card-slot pub-binder-slot"></div>');
                if (slot && slot.image_url) {
                    const card = slotToCard(slot);
                    $slot.attr({
                        'data-id': slot.id || '',
                        'data-full-img': slot.image_url || '',
                        'data-name': slot.name || '',
                        'data-rarity': slot.rarity || '',
                        'data-holo': slot.holo_effect || '',
                        'data-mask': slot.custom_mask_url || '',
                        'data-expansion': slot.expansion || '',
                        'data-condition': slot.condition || '',
                        'data-quantity': card.quantity,
                        'data-price': slot.price || '',
                        'data-language': slot.language || '',
                        'data-edition': slot.edition || '',
                        'data-description': slot.description || '',
                        'data-extra-images': JSON.stringify(slot.extra_images || [])
                    });

                    const stamp = card.is_available ? '' : '<div class="pub-binder-stamp">AGOTADO</div>';
                    $slot.append(`
                        <img src="${card.image_url}" class="tcg-card" alt="${escapeHtml(card.card_name)}" decoding="async">
                        ${stamp}
                        <div class="pub-binder-slot-price">${cardPriceLabel(card)}</div>
                        <button type="button" class="zoom-btn pub-binder-slot-zoom" aria-label="Ver ${escapeHtml(card.card_name)}"><i class="fas fa-search"></i></button>
                    `);
                    // La lupa abre el popup sin girar la hoja. En móvil turn.js gira
                    // la hoja al tocar cualquier punto de la página, así que el toque
                    // se frena en captura (app.js: protectedElements incluye .zoom-btn)
                    // y aquí se corta la propagación para que no llegue al handler
                    // global de .card-slot.
                    $slot.find('.pub-binder-slot-zoom').on('click', function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        openBinderCardModal(card);
                    }).on('mousedown touchstart pointerdown', function (e) {
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                    });
                    if (card.show_foil && typeof window.applyFoilToElement === 'function') {
                        window.applyFoilToElement($slot, card.holo_effect, card.custom_mask_url);
                    }
                    $slot.on('click', function (e) {
                        e.stopPropagation();
                        e.preventDefault();
                        // En móvil, turn.js se queda con el toque del cuerpo de la
                        // carta (gira la hoja); el popup se abre solo con la lupa.
                        if (window.innerWidth <= 768) return;
                        openBinderCardModal(card);
                    });
                }
                $grid.append($slot);
            }
            $page.append($grid);
            $album.append($page);
        });
    }

    // ---------------------------------------------------------------- slide

    function renderPublicBinderSlide($container) {
        $container.addClass('pub-binder-slide-layout')
            .removeClass('pub-binder-list-layout pub-binder-album-layout');
        const swiperId = `pub-binder-swiper-${Date.now()}`;
        const $swiper = $(`
            <div class="swiper ${swiperId} pub-binder-swiper">
                <div class="swiper-wrapper">
                    ${binderCards.map(card => {
                        const stamp = card.is_available ? '' : '<div class="pub-binder-stamp">AGOTADO</div>';
                        return `
                        <div class="swiper-slide pub-binder-slide" data-id="${card.id}">
                            <div class="pub-binder-slide-media">
                                <img src="${card.image_url}" alt="${escapeHtml(card.card_name)}">
                                ${stamp}
                            </div>
                            <div class="pub-binder-slide-body">
                                <h4>${escapeHtml(card.card_name)}</h4>
                                <p>${escapeHtml(card.set_name)}${card.rarity ? ' · ' + escapeHtml(card.rarity) : ''}</p>
                                <div class="pub-binder-slide-price">${cardPriceLabel(card)}</div>
                            </div>
                        </div>
                    `;
                    }).join('')}
                </div>
            </div>
        `);
        $container.append($swiper);

        const swiper = new Swiper(`.${swiperId}`, {
            effect: 'cards',
            grabCursor: true,
            centeredSlides: true,
            slidesPerView: 'auto',
            slideToClickedSlide: true,
            preventClicks: false
        });

        $container.find('.swiper-slide').each(function (idx) {
            const card = binderCards[idx];
            if (card && card.show_foil && typeof window.applyFoilToElement === 'function') {
                window.applyFoilToElement($(this), card.holo_effect, card.custom_mask_url);
            }
        });

        let dragging = false;
        $container.find('.swiper-slide').on('pointerdown touchstart', function () {
            dragging = false;
        }).on('pointermove touchmove', function () {
            dragging = true;
        }).on('click', function (e) {
            if (dragging) return;
            e.stopPropagation();
            e.preventDefault();
            const card = binderCards.find(c => String(c.id) === String($(this).attr('data-id')));
            if (card) openBinderCardModal(card);
        });
    }

    // ----------------------------------------------------------------- lista

    function renderPublicBinderList($container) {
        $container.addClass('pub-binder-list-layout')
            .removeClass('pub-binder-slide-layout pub-binder-album-layout');
        const $list = $('<div class="pub-binder-list"></div>');

        binderCards.forEach(card => {
            const badge = card.is_available ? '' : '<span class="pub-binder-list-out"><i class="fas fa-ban"></i> Agotado</span>';
            const stamp = card.is_available ? '' : '<div class="pub-binder-stamp">AGOTADO</div>';
            const $item = $(`
                <div class="pub-binder-list-item" data-id="${card.id}">
                    <div class="pub-binder-list-img">
                        <img src="${card.image_url}" alt="${escapeHtml(card.card_name)}">
                        ${stamp}
                    </div>
                    <div class="pub-binder-list-details">
                        <div class="pub-binder-list-name">${escapeHtml(card.card_name)} ${badge}</div>
                        <div class="pub-binder-list-set">${escapeHtml(card.set_name)}${card.rarity ? ' · ' + escapeHtml(card.rarity) : ''}</div>
                    </div>
                    <div class="pub-binder-list-price">
                        <span>Precio</span>
                        <b>${cardPriceLabel(card)}</b>
                    </div>
                </div>
            `);
            if (card.show_foil && typeof window.applyFoilToElement === 'function') {
                window.applyFoilToElement($item.find('.pub-binder-list-img'), card.holo_effect, card.custom_mask_url);
            }
            $item.on('click', function (e) {
                e.stopPropagation();
                e.preventDefault();
                openBinderCardModal(card);
            });
            $list.append($item);
        });
        $container.append($list);
    }
})();
