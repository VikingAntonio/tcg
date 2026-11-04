/**
 * custom.js — VikingTCG Store Customization & Visual Grid Editor (Fase 1)
 * Reflects identical look and feel of admin.html and public.html.
 * Sizing adjusted purely via border dots / resize handles.
 * Controls reduced strictly to 4 styling properties (border color, bg color, text color, typography).
 */

// All real platform slots definitions with exact native classes from admin.html
const ADMIN_SLOTS = [
    { id: 'btn-home', title: 'Home', icon: 'fas fa-home', defaultClass: 'tile-blue tile-large', defaultPcSpan: { col: 2, row: 2 }, defaultMobileSpan: { col: 2, row: 1 } },
    { id: 'btn-perfil', title: 'Mi Perfil', icon: 'fas fa-user-circle', defaultClass: 'tile-cyan', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-show-decks', title: 'Mis Decks', icon: 'fas fa-layer-group', defaultClass: 'tile-green tile-wide', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 2, row: 1 } },
    { id: 'btn-show-binders', title: 'Mis Binders', icon: 'fas fa-book', defaultClass: 'tile-purple tile-wide', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 2, row: 1 } },
    { id: 'btn-show-spirits', title: 'Asistente', icon: 'fas fa-ghost', defaultClass: 'tile-yellow tile-tall', defaultPcSpan: { col: 1, row: 2 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-scanner', title: 'Scanner', icon: 'fas fa-barcode', defaultClass: 'tile-orange', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-show-expansiones', title: 'Expansiones', icon: 'fas fa-th-large', defaultClass: 'tile-orange', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-users-panel', title: 'Usuarios', icon: 'fas fa-users', defaultClass: 'tile-pink', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-bdd-panel', title: 'BDD', icon: 'fas fa-database', defaultClass: 'tile-yellow', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-wishlist', title: 'Wantlist Pro', icon: 'fas fa-heart', defaultClass: 'tile-blue', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-sealed', title: 'Producto Sellado', icon: 'fas fa-box', defaultClass: 'tile-cyan tile-wide', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 2, row: 1 } },
    { id: 'btn-preventas', title: 'Preventas', icon: 'fas fa-fire', defaultClass: 'tile-yellow tile-wide', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 2, row: 1 } },
    { id: 'btn-tracking', title: 'Tracking', icon: 'fas fa-shipping-fast', defaultClass: 'tile-blue', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-clientes', title: 'Clientes', icon: 'fas fa-address-book', defaultClass: 'tile-green', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-claims', title: 'Claims', icon: 'fas fa-hand-holding-heart', defaultClass: 'tile-orange', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-admin-claims', title: 'Gestión Claims', icon: 'fas fa-tasks', defaultClass: 'tile-pink', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-subastas', title: 'Subastas', icon: 'fas fa-gavel', defaultClass: 'tile-purple', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-eventos', title: 'Eventos', icon: 'fas fa-calendar-alt', defaultClass: 'tile-cyan', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-chatbot-config', title: 'Chatbot', icon: 'fas fa-robot', defaultClass: 'tile-purple tile-wide', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 2, row: 1 } },
    { id: 'btn-show-investments', title: 'Inversiones', icon: 'fas fa-chart-line', defaultClass: 'tile-green', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-widgets', title: 'Widgets', icon: 'fas fa-code', defaultClass: 'tile-blue', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-logout-tile', title: 'Salir', icon: 'fas fa-sign-out-alt', defaultClass: 'tile-pink', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } }
];

const PUBLIC_SLOTS = [
    { id: 'public-binders', title: 'Binders', icon: 'fas fa-book', defaultClass: 'tile-purple tile-wide', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-decks', title: 'Decks', icon: 'fas fa-layer-group', defaultClass: 'tile-blue tile-wide', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-auctions', title: 'Subastas', icon: 'fas fa-gavel', defaultClass: 'tile-pink', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-sealed', title: 'Productos', icon: 'fas fa-box', defaultClass: 'tile-green', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-preorders', title: 'Preventas', icon: 'fas fa-fire', defaultClass: 'tile-yellow tile-wide', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 2, row: 1 } },
    { id: 'public-wishlist', title: 'Buscamos', icon: 'fas fa-heart', defaultClass: 'tile-pink', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-investments', title: 'Inversiones', icon: 'fas fa-chart-line', defaultClass: 'tile-orange', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-claims', title: 'Claims', icon: 'fas fa-hand-holding-heart', defaultClass: 'tile-cyan', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-events', title: 'Eventos y Noticias', icon: 'fas fa-calendar-alt', defaultClass: 'tile-cyan tile-wide', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } }
];

// Test Stickers Library (transparent PNGs)
const TEST_STICKERS = [
    { id: 'stk-flame', name: 'Fuego', url: 'https://cdn-icons-png.flaticon.com/512/785/785116.png' },
    { id: 'stk-star', name: 'Estrella Dorada', url: 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png' },
    { id: 'stk-sparkles', name: 'Destellos', url: 'https://cdn-icons-png.flaticon.com/512/1828/1828970.png' },
    { id: 'stk-crown', name: 'Corona', url: 'https://cdn-icons-png.flaticon.com/512/6941/6941697.png' },
    { id: 'stk-diamond', name: 'Diamante', url: 'https://cdn-icons-png.flaticon.com/512/1828/1828882.png' },
    { id: 'stk-verified', name: 'Verificado', url: 'https://cdn-icons-png.flaticon.com/512/7595/7595571.png' },
    { id: 'stk-discount', name: 'Oferta', url: 'https://cdn-icons-png.flaticon.com/512/726/726488.png' },
    { id: 'stk-tcg-card', name: 'Carta', url: 'https://cdn-icons-png.flaticon.com/512/4743/4743048.png' },
    { id: 'stk-ghost', name: 'Espíritu', url: 'https://cdn-icons-png.flaticon.com/512/1067/1067357.png' },
    { id: 'stk-shield', name: 'Escudo', url: 'https://cdn-icons-png.flaticon.com/512/1067/1067347.png' }
];

window.CustomStoreState = {
    currentUser: null,
    currentDevice: 'pc', // 'pc' or 'mobile'
    currentTargetView: 'admin', // 'admin' or 'public'
    selectedSlotId: null,

    // Global Visual Settings (Only 4 Properties: border_color, bg_color, text_color, font_family)
    globalStyles: {
        bg_color: '',
        border_color: '',
        text_color: '',
        font_family: "'Montserrat', sans-serif"
    },

    // Individual Slot Customizations: { [slotId]: { bg_color, border_color, text_color, font_family, stickers: [] } }
    slotsConfig: {},

    // Grid Layouts: { [view]: { order: [slotIds...], spans: { [slotId]: { col: number, row: number } } } }
    gridPc: {
        admin: { order: [], spans: {} },
        public: { order: [], spans: {} }
    },
    gridMobile: {
        admin: { order: [], spans: {} },
        public: { order: [], spans: {} }
    }
};

$(document).ready(async function() {
    initThemeManager();
    await initSession();
    initStickersLibrary();
    bindEvents();
    await loadCustomizations();
    renderGrid();
});

// 1. Theme Switcher Manager matching platform standard
function initThemeManager() {
    const savedTheme = localStorage.getItem('site_theme') || 'theme-dark';
    $('body').removeClass('theme-light theme-purple theme-dark').addClass(savedTheme);
    $('.theme-btn-small').removeClass('active');
    $(`.theme-btn-small[data-theme="${savedTheme}"]`).addClass('active');

    $('.theme-btn-small').on('click', function() {
        const theme = $(this).data('theme');
        $('body').removeClass('theme-light theme-purple theme-dark').addClass(theme);
        $('.theme-btn-small').removeClass('active');
        $(`.theme-btn-small[data-theme="${theme}"]`).addClass('active');
        localStorage.setItem('site_theme', theme);
    });

    $('#avatar-btn').on('click', function(e) {
        e.stopPropagation();
        $('#user-dropdown').toggleClass('active');
    });

    $(document).on('click', function(e) {
        if (!$(e.target).closest('.user-menu-container').length) {
            $('#user-dropdown').removeClass('active');
        }
    });

    // Minimize sidebar button
    $('#btn-toggle-sidebar').on('click', function() {
        const $body = $('#sidebar-controls-body');
        if ($body.is(':visible')) {
            $body.slideUp(200);
            $(this).text('Expandir');
        } else {
            $body.slideDown(200);
            $(this).text('Minimizar');
        }
    });
}

// 2. Session Initialization
async function initSession() {
    try {
        if (typeof _supabase !== 'undefined' && _supabase.auth) {
            const { data: { session } } = await _supabase.auth.getSession();
            if (session && session.user) {
                const { data: userProfile } = await _supabase
                    .from('usuarios')
                    .select('*')
                    .eq('id', session.user.id)
                    .maybeSingle();
                window.CustomStoreState.currentUser = userProfile || { id: session.user.id, username: session.user.email };
                if (window.CustomStoreState.currentUser.username) {
                    $('#dropdown-user-name').text(window.CustomStoreState.currentUser.username);
                }
                return;
            }
        }
    } catch (e) {
        console.warn('Supabase auth session check failed, using fallback:', e);
    }

    const savedSession = localStorage.getItem('tcg_session');
    if (savedSession) {
        try {
            window.CustomStoreState.currentUser = JSON.parse(savedSession);
            if (window.CustomStoreState.currentUser.username) {
                $('#dropdown-user-name').text(window.CustomStoreState.currentUser.username);
            }
        } catch (e) {
            console.error('Error parsing tcg_session', e);
        }
    }

    if (!window.CustomStoreState.currentUser) {
        window.CustomStoreState.currentUser = { id: '00000000-0000-0000-0000-000000000000', username: 'Demo' };
    }
}

// 3. Load Customizations from Supabase
async function loadCustomizations() {
    const state = window.CustomStoreState;
    if (!state.currentUser || !state.currentUser.id || state.currentUser.id === '00000000-0000-0000-0000-000000000000') {
        populateDefaultGridStructure();
        applyGlobalStylesToInputs();
        return;
    }

    try {
        const { data, error } = await _supabase
            .from('store_customizations')
            .select('*')
            .eq('user_id', state.currentUser.id)
            .maybeSingle();

        if (error) {
            console.warn('Notice loading store_customizations:', error.message);
        }

        if (data) {
            if (data.global_styles) state.globalStyles = { ...state.globalStyles, ...data.global_styles };
            if (data.slots_config) state.slotsConfig = data.slots_config;
            if (data.grid_pc && Object.keys(data.grid_pc).length > 0) state.gridPc = data.grid_pc;
            if (data.grid_mobile && Object.keys(data.grid_mobile).length > 0) state.gridMobile = data.grid_mobile;
        }
    } catch (e) {
        console.warn('Error fetching store_customizations from Supabase:', e);
    }

    populateDefaultGridStructure();
    applyGlobalStylesToInputs();
}

function populateDefaultGridStructure() {
    const state = window.CustomStoreState;

    ['admin', 'public'].forEach(target => {
        const slots = target === 'admin' ? ADMIN_SLOTS : PUBLIC_SLOTS;

        // PC Grid Defaults
        if (!state.gridPc[target]) state.gridPc[target] = { order: [], spans: {} };
        if (!state.gridPc[target].order || state.gridPc[target].order.length === 0) {
            state.gridPc[target].order = slots.map(s => s.id);
        }
        slots.forEach(s => {
            if (!state.gridPc[target].spans[s.id]) {
                state.gridPc[target].spans[s.id] = { ...s.defaultPcSpan };
            }
        });

        // Mobile Grid Defaults
        if (!state.gridMobile[target]) state.gridMobile[target] = { order: [], spans: {} };
        if (!state.gridMobile[target].order || state.gridMobile[target].order.length === 0) {
            state.gridMobile[target].order = slots.map(s => s.id);
        }
        slots.forEach(s => {
            if (!state.gridMobile[target].spans[s.id]) {
                state.gridMobile[target].spans[s.id] = { ...s.defaultMobileSpan };
            }
        });
    });
}

// 4. Render Grid exactly as in admin.html / public.html
function renderGrid() {
    const state = window.CustomStoreState;
    const isMobile = state.currentDevice === 'mobile';
    const target = state.currentTargetView;
    const gridData = isMobile ? state.gridMobile[target] : state.gridPc[target];
    const availableSlots = target === 'admin' ? ADMIN_SLOTS : PUBLIC_SLOTS;
    const slotMap = new Map(availableSlots.map(s => [s.id, s]));

    const $grid = $('#custom-grid-container');
    $grid.empty();

    const renderedOrder = [...(gridData.order || [])];
    availableSlots.forEach(s => {
        if (!renderedOrder.includes(s.id)) renderedOrder.push(s.id);
    });

    const maxCols = isMobile ? 2 : 4;

    renderedOrder.forEach(slotId => {
        const slotMeta = slotMap.get(slotId);
        if (!slotMeta) return;

        const span = gridData.spans[slotId] || { col: 1, row: 1 };
        const safeColSpan = Math.min(span.col || 1, maxCols);
        const safeRowSpan = span.row || 1;

        // 4 properties: Individual or Global
        const slotConfig = state.slotsConfig[slotId] || {};
        const bg = slotConfig.bg_color || state.globalStyles.bg_color || '';
        const borderCol = slotConfig.border_color || state.globalStyles.border_color || '';
        const textCol = slotConfig.text_color || state.globalStyles.text_color || '';
        const fontFamily = (slotConfig.font_family && slotConfig.font_family !== 'inherit')
            ? slotConfig.font_family
            : (state.globalStyles.font_family || "'Montserrat', sans-serif");

        const isSelected = state.selectedSlotId === slotId;

        let customInlineStyles = `
            grid-column: span ${safeColSpan} !important;
            grid-row: span ${safeRowSpan} !important;
        `;
        if (bg) customInlineStyles += ` background-color: ${bg} !important;`;
        if (borderCol) customInlineStyles += ` border-color: ${borderCol} !important;`;
        if (textCol) customInlineStyles += ` color: ${textCol} !important;`;
        if (fontFamily) customInlineStyles += ` font-family: ${fontFamily} !important;`;

        // Render matching exact tile markup from admin.html
        const $slot = $(`
            <div class="tile ${slotMeta.defaultClass || ''} ${isSelected ? 'slot-selected' : ''}"
                 id="${slotId}"
                 data-slot-id="${slotId}"
                 draggable="true"
                 style="${customInlineStyles}">

                <!-- Protected Text Zone -->
                <div class="slot-protected-zone">
                    <span class="slot-protected-zone-tag">Zona Protegida</span>
                </div>

                <!-- Native Content -->
                <i class="${slotMeta.icon}" style="${textCol ? `color: ${textCol} !important;` : ''}"></i>
                <span style="${textCol ? `color: ${textCol} !important;` : ''}">${slotMeta.title}</span>

                <!-- Stickers Layer -->
                <div class="slot-stickers-layer" id="stickers-layer-${slotId}"></div>

                <!-- Sizing Handles on Borders (Yellow dots) -->
                <div class="slot-resize-dot dot-right" title="Ajustar ancho"></div>
                <div class="slot-resize-dot dot-bottom" title="Ajustar alto"></div>
                <div class="slot-resize-dot dot-corner" title="Ajustar ancho y alto"></div>
            </div>
        `);

        renderSlotStickers($slot.find('.slot-stickers-layer'), slotConfig.stickers || []);
        $grid.append($slot);
    });

    bindSlotInteractions();
}

// 5. Render Stickers in Slot
function renderSlotStickers($container, stickers) {
    $container.empty();
    if (!stickers || stickers.length === 0) return;

    stickers.forEach((stk, idx) => {
        const x = stk.x || 50;
        const y = stk.y || 50;
        const size = stk.size || 40;
        const rot = stk.rotation || 0;

        const $stkItem = $(`
            <div class="sticker-item" data-index="${idx}" style="
                left: ${x}%;
                top: ${y}%;
                width: ${size}px;
                height: ${size}px;
                transform: translate(-50%, -50%) rotate(${rot}deg);
            ">
                <img src="${stk.url}" alt="${stk.name || 'Sticker'}">
            </div>
        `);

        bindStickerDragAndDrop($stkItem, $container.closest('.tile'));
        $container.append($stkItem);
    });
}

// 6. Slot Interactions: Click to edit slot & Drag to reorder
let draggedSlotId = null;

function bindSlotInteractions() {
    const $slots = $('.custom-viewport-frame .tile');

    // Drag and Drop Ordering
    $slots.on('dragstart', function(e) {
        draggedSlotId = $(this).data('slot-id');
        $(this).addClass('is-dragging');
        e.originalEvent.dataTransfer.effectAllowed = 'move';
        e.originalEvent.dataTransfer.setData('text/plain', draggedSlotId);
    });

    $slots.on('dragend', function() {
        $(this).removeClass('is-dragging');
        $('.custom-viewport-frame .tile').removeClass('drag-over');
        draggedSlotId = null;
    });

    $slots.on('dragover', function(e) {
        e.preventDefault();
        e.originalEvent.dataTransfer.dropEffect = 'move';
        $(this).addClass('drag-over');
    });

    $slots.on('dragleave', function() {
        $(this).removeClass('drag-over');
    });

    $slots.on('drop', function(e) {
        e.preventDefault();
        $(this).removeClass('drag-over');
        const targetSlotId = $(this).data('slot-id');

        if (draggedSlotId && targetSlotId && draggedSlotId !== targetSlotId) {
            reorderSlots(draggedSlotId, targetSlotId);
        }
    });

    // Clicking slot selects it or opens individual modal
    $slots.on('click', function(e) {
        if ($(e.target).closest('.slot-resize-dot, .sticker-item').length > 0) return;

        const slotId = $(this).data('slot-id');
        window.CustomStoreState.selectedSlotId = slotId;
        $('.custom-viewport-frame .tile').removeClass('slot-selected');
        $(this).addClass('slot-selected');

        // Open Individual Slot Customization Modal
        openSlotStylesModal(slotId);
    });

    bindResizeDots();
}

function reorderSlots(fromId, toId) {
    const state = window.CustomStoreState;
    const target = state.currentTargetView;
    const gridData = state.currentDevice === 'mobile' ? state.gridMobile[target] : state.gridPc[target];

    const oldIndex = gridData.order.indexOf(fromId);
    const newIndex = gridData.order.indexOf(toId);

    if (oldIndex > -1 && newIndex > -1) {
        gridData.order.splice(oldIndex, 1);
        gridData.order.splice(newIndex, 0, fromId);
        renderGrid();
    }
}

// 7. Interactive Resize Dots (Sizing exclusively by dragging border dots)
function bindResizeDots() {
    $('.slot-resize-dot').off('mousedown touchstart').on('mousedown touchstart', function(e) {
        e.stopPropagation();
        e.preventDefault();

        const $slot = $(this).closest('.tile');
        const slotId = $slot.data('slot-id');
        const isRight = $(this).hasClass('dot-right') || $(this).hasClass('dot-corner');
        const isBottom = $(this).hasClass('dot-bottom') || $(this).hasClass('dot-corner');

        const startX = e.pageX || (e.originalEvent.touches ? e.originalEvent.touches[0].pageX : 0);
        const startY = e.pageY || (e.originalEvent.touches ? e.originalEvent.touches[0].pageY : 0);

        function onMouseMove(moveEvent) {
            // Live indicator can optionally update
        }

        function onMouseUp(upEvent) {
            $(document).off('mousemove touchmove', onMouseMove);
            $(document).off('mouseup touchend', onMouseUp);

            const endX = upEvent.pageX || (upEvent.originalEvent && upEvent.originalEvent.changedTouches ? upEvent.originalEvent.changedTouches[0].pageX : startX);
            const endY = upEvent.pageY || (upEvent.originalEvent && upEvent.originalEvent.changedTouches ? upEvent.originalEvent.changedTouches[0].pageY : startY);

            const deltaX = endX - startX;
            const deltaY = endY - startY;

            let colChange = 0;
            let rowChange = 0;

            if (isRight) {
                if (deltaX > 45) colChange = 1;
                else if (deltaX < -45) colChange = -1;
            }

            if (isBottom) {
                if (deltaY > 45) rowChange = 1;
                else if (deltaY < -45) rowChange = -1;
            }

            if (colChange !== 0 || rowChange !== 0) {
                adjustSlotSpan(slotId, colChange, rowChange);
            }
        }

        $(document).on('mousemove touchmove', onMouseMove);
        $(document).on('mouseup touchend', onMouseUp);
    });
}

function adjustSlotSpan(slotId, colDelta, rowDelta) {
    const state = window.CustomStoreState;
    const isMobile = state.currentDevice === 'mobile';
    const target = state.currentTargetView;
    const gridData = isMobile ? state.gridMobile[target] : state.gridPc[target];
    const maxCols = isMobile ? 2 : 4;
    const maxRows = 3;

    if (!gridData.spans[slotId]) gridData.spans[slotId] = { col: 1, row: 1 };
    const currentSpan = gridData.spans[slotId];

    const nextCol = Math.max(1, Math.min(maxCols, (currentSpan.col || 1) + colDelta));
    const nextRow = Math.max(1, Math.min(maxRows, (currentSpan.row || 1) + rowDelta));

    currentSpan.col = nextCol;
    currentSpan.row = nextRow;

    renderGrid();
}

// 8. Sticker Drag and Placement inside Slot
function bindStickerDragAndDrop($stickerEl, $slotEl) {
    $stickerEl.on('mousedown touchstart', function(e) {
        e.stopPropagation();
        e.preventDefault();
        const slotId = $slotEl.data('slot-id');
        const stickerIdx = parseInt($(this).data('index'), 10);

        const slotRect = $slotEl[0].getBoundingClientRect();
        const $item = $(this);
        $item.addClass('sticker-selected');

        function onStickerMove(moveEvent) {
            const pageX = moveEvent.pageX || (moveEvent.originalEvent.touches ? moveEvent.originalEvent.touches[0].pageX : 0);
            const pageY = moveEvent.pageY || (moveEvent.originalEvent.touches ? moveEvent.originalEvent.touches[0].pageY : 0);

            const relX = ((pageX - slotRect.left) / slotRect.width) * 100;
            const relY = ((pageY - slotRect.top) / slotRect.height) * 100;

            $item.css({
                left: `${Math.round(relX)}%`,
                top: `${Math.round(relY)}%`
            });
        }

        function onStickerUp(upEvent) {
            $(document).off('mousemove touchmove', onStickerMove);
            $(document).off('mouseup touchend', onStickerUp);
            $item.removeClass('sticker-selected');

            const finalLeft = parseFloat($item[0].style.left) || 50;
            const finalTop = parseFloat($item[0].style.top) || 50;

            const slotConfig = window.CustomStoreState.slotsConfig[slotId];
            if (slotConfig && slotConfig.stickers && slotConfig.stickers[stickerIdx]) {
                slotConfig.stickers[stickerIdx].x = Math.round(finalLeft);
                slotConfig.stickers[stickerIdx].y = Math.round(finalTop);
            }
        }

        $(document).on('mousemove touchmove', onStickerMove);
        $(document).on('mouseup touchend', onStickerUp);
    });
}

// 9. Global Styles to Inputs
function applyGlobalStylesToInputs() {
    const s = window.CustomStoreState.globalStyles;
    if (s.bg_color) {
        $('#global-bg-color').val(s.bg_color);
        $('#global-bg-text').val(s.bg_color);
    }
    if (s.border_color) {
        $('#global-border-color').val(s.border_color);
        $('#global-border-text').val(s.border_color);
    }
    if (s.text_color) {
        $('#global-text-color').val(s.text_color);
        $('#global-text-color-val').val(s.text_color);
    }
    if (s.font_family) {
        $('#global-font-family').val(s.font_family);
    }
}

function updateGlobalStylesFromInputs() {
    const s = window.CustomStoreState.globalStyles;
    s.bg_color = $('#global-bg-text').val();
    s.border_color = $('#global-border-text').val();
    s.text_color = $('#global-text-color-val').val();
    s.font_family = $('#global-font-family').val();

    renderGrid();
}

// 10. Individual Slot Modal (Strictly 4 properties + stickers)
function openSlotStylesModal(slotId) {
    const state = window.CustomStoreState;
    const target = state.currentTargetView;
    const availableSlots = target === 'admin' ? ADMIN_SLOTS : PUBLIC_SLOTS;
    const slotMeta = availableSlots.find(s => s.id === slotId);
    if (!slotMeta) return;

    state.selectedSlotId = slotId;
    $('#modal-slot-title').text(slotMeta.title);

    const slotConfig = state.slotsConfig[slotId] || {};
    const bg = slotConfig.bg_color || state.globalStyles.bg_color || '';
    const borderCol = slotConfig.border_color || state.globalStyles.border_color || '';
    const textCol = slotConfig.text_color || state.globalStyles.text_color || '';
    const fontFamily = slotConfig.font_family || 'inherit';

    $('#slot-bg-color').val(bg || '#1e272e');
    $('#slot-bg-text').val(bg);
    $('#slot-border-color').val(borderCol || '#00d2ff');
    $('#slot-border-text').val(borderCol);
    $('#slot-text-color').val(textCol || '#f5f6fa');
    $('#slot-text-color-val').val(textCol);
    $('#slot-font-family').val(fontFamily);

    renderStickersManagerList(slotId);
    $('#slot-modal-overlay').addClass('active');
}

function applySlotStylesFromModal() {
    const state = window.CustomStoreState;
    const slotId = state.selectedSlotId;
    if (!slotId) return;

    if (!state.slotsConfig[slotId]) state.slotsConfig[slotId] = {};
    const sc = state.slotsConfig[slotId];

    sc.bg_color = $('#slot-bg-text').val();
    sc.border_color = $('#slot-border-text').val();
    sc.text_color = $('#slot-text-color-val').val();
    sc.font_family = $('#slot-font-family').val();

    $('#slot-modal-overlay').removeClass('active');
    renderGrid();
}

function resetSlotToGlobal(slotId) {
    const state = window.CustomStoreState;
    if (state.slotsConfig[slotId]) {
        const stickers = state.slotsConfig[slotId].stickers || [];
        delete state.slotsConfig[slotId];
        if (stickers.length > 0) {
            state.slotsConfig[slotId] = { stickers };
        }
    }
    $('#slot-modal-overlay').removeClass('active');
    renderGrid();
}

// 11. Stickers Library & Manager
function initStickersLibrary() {
    const $lib = $('#stickers-lib-container');
    $lib.empty();

    TEST_STICKERS.forEach(stk => {
        const $item = $(`
            <div class="sticker-lib-item" data-id="${stk.id}" title="${stk.name}">
                <img src="${stk.url}" alt="${stk.name}">
            </div>
        `);
        $item.on('click', function() {
            addStickerToCurrentSlot(stk);
        });
        $lib.append($item);
    });
}

function renderStickersManagerList(slotId) {
    const state = window.CustomStoreState;
    const sc = state.slotsConfig[slotId] || {};
    const stickers = sc.stickers || [];

    $('#slot-stickers-count').text(stickers.length);
    const $list = $('#slot-stickers-list');
    $list.empty();

    if (stickers.length === 0) {
        $list.html('<div style="color: var(--text-muted); font-size: 0.75rem; text-align: center; padding: 6px;">Sin stickers</div>');
        return;
    }

    stickers.forEach((stk, idx) => {
        const $row = $(`
            <div class="sticker-manager-row">
                <img src="${stk.url}" alt="Sticker" class="sticker-row-preview">
                <div class="sticker-row-controls">
                    <label style="font-size: 0.65rem; color: var(--text-muted);">Tamaño: </label>
                    <input type="range" class="stk-scale-range" min="20" max="100" value="${stk.size || 40}" style="flex: 1;">

                    <label style="font-size: 0.65rem; color: var(--text-muted); margin-left: 6px;">Giro: </label>
                    <input type="range" class="stk-rot-range" min="-180" max="180" value="${stk.rotation || 0}" style="flex: 1;">
                </div>
                <button class="btn-delete-sticker" data-index="${idx}">Eliminar</button>
            </div>
        `);

        $row.find('.stk-scale-range').on('input', function() {
            stk.size = parseInt($(this).val(), 10);
            renderGrid();
        });

        $row.find('.stk-rot-range').on('input', function() {
            stk.rotation = parseInt($(this).val(), 10);
            renderGrid();
        });

        $row.find('.btn-delete-sticker').on('click', function() {
            stickers.splice(idx, 1);
            renderStickersManagerList(slotId);
            renderGrid();
        });

        $list.append($row);
    });
}

function addStickerToCurrentSlot(stkTemplate) {
    const state = window.CustomStoreState;
    const slotId = state.selectedSlotId;
    if (!slotId) return;

    if (!state.slotsConfig[slotId]) state.slotsConfig[slotId] = {};
    if (!state.slotsConfig[slotId].stickers) state.slotsConfig[slotId].stickers = [];

    const stickers = state.slotsConfig[slotId].stickers;
    if (stickers.length >= 10) {
        Swal.fire('Límite alcanzado', 'Máximo 10 stickers por slot.', 'warning');
        return;
    }

    const cornerPositions = [
        { x: 15, y: 20 },
        { x: 85, y: 20 },
        { x: 15, y: 80 },
        { x: 85, y: 80 },
        { x: 50, y: 15 },
        { x: 50, y: 85 }
    ];
    const pos = cornerPositions[stickers.length % cornerPositions.length];

    stickers.push({
        id: `stk_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: stkTemplate.name,
        url: stkTemplate.url,
        x: pos.x,
        y: pos.y,
        size: 38,
        rotation: 0
    });

    renderStickersManagerList(slotId);
    renderGrid();
}

// 12. Save Customizations to Supabase
async function saveCustomizationsToSupabase() {
    const state = window.CustomStoreState;
    if (!state.currentUser || !state.currentUser.id || state.currentUser.id === '00000000-0000-0000-0000-000000000000') {
        Swal.fire({
            icon: 'info',
            title: 'Modo Demostración',
            text: 'Tus cambios han sido aplicados visualmente. Inicia sesión para guardar permanentemente.'
        });
        return;
    }

    Swal.fire({
        title: 'Guardando...',
        text: 'Sincronizando diseño y distribución',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const payload = {
            user_id: state.currentUser.id,
            global_styles: state.globalStyles,
            slots_config: state.slotsConfig,
            grid_pc: state.gridPc,
            grid_mobile: state.gridMobile,
            updated_at: new Date().toISOString()
        };

        const { error } = await _supabase
            .from('store_customizations')
            .upsert(payload, { onConflict: 'user_id' });

        if (error) throw error;

        Swal.fire({
            icon: 'success',
            title: '¡Diseño Guardado!',
            text: 'Tu personalización ha sido guardada con éxito.',
            timer: 1800,
            showConfirmButton: false
        });
    } catch (err) {
        console.error('Error saving store customizations:', err);
        Swal.fire({
            icon: 'error',
            title: 'Error al Guardar',
            text: err.message || 'No se pudo guardar la personalización.'
        });
    }
}

// 13. Reset All Configuration
function resetAllCustomizations() {
    Swal.fire({
        title: '¿Restablecer todo el diseño?',
        text: 'Se restablecerán los estilos y la distribución a los valores predeterminados.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4757',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, restablecer',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            const state = window.CustomStoreState;
            state.globalStyles = {
                bg_color: '',
                border_color: '',
                text_color: '',
                font_family: "'Montserrat', sans-serif"
            };
            state.slotsConfig = {};
            state.gridPc = { admin: { order: [], spans: {} }, public: { order: [], spans: {} } };
            state.gridMobile = { admin: { order: [], spans: {} }, public: { order: [], spans: {} } };

            populateDefaultGridStructure();
            applyGlobalStylesToInputs();
            renderGrid();

            Swal.fire('Restablecido', 'El diseño ha sido restablecido.', 'success');
        }
    });
}

// 14. Event Bindings
function bindEvents() {
    // Device Toggle (PC vs Celular)
    $('#btn-device-pc').on('click', function() {
        $('.segmented-group button[data-device]').removeClass('active');
        $(this).addClass('active');
        window.CustomStoreState.currentDevice = 'pc';
        $('#custom-viewport-frame').removeClass('mode-mobile').addClass('mode-pc');
        renderGrid();
    });

    $('#btn-device-mobile').on('click', function() {
        $('.segmented-group button[data-device]').removeClass('active');
        $(this).addClass('active');
        window.CustomStoreState.currentDevice = 'mobile';
        $('#custom-viewport-frame').removeClass('mode-pc').addClass('mode-mobile');
        renderGrid();
    });

    // Target View Toggle (Panel Admin vs Tienda Pública)
    $('#btn-target-admin').on('click', function() {
        $('.segmented-group button[data-target]').removeClass('active');
        $(this).addClass('active');
        window.CustomStoreState.currentTargetView = 'admin';
        window.CustomStoreState.selectedSlotId = null;
        renderGrid();
    });

    $('#btn-target-public').on('click', function() {
        $('.segmented-group button[data-target]').removeClass('active');
        $(this).addClass('active');
        window.CustomStoreState.currentTargetView = 'public';
        window.CustomStoreState.selectedSlotId = null;
        renderGrid();
    });

    // Global Style Inputs Sync (Only 4 Properties)
    $('#global-bg-color').on('input', function() {
        $('#global-bg-text').val($(this).val());
        updateGlobalStylesFromInputs();
    });
    $('#global-bg-text').on('change', function() {
        $('#global-bg-color').val($(this).val());
        updateGlobalStylesFromInputs();
    });

    $('#global-border-color').on('input', function() {
        $('#global-border-text').val($(this).val());
        updateGlobalStylesFromInputs();
    });
    $('#global-border-text').on('change', function() {
        $('#global-border-color').val($(this).val());
        updateGlobalStylesFromInputs();
    });

    $('#global-text-color').on('input', function() {
        $('#global-text-color-val').val($(this).val());
        updateGlobalStylesFromInputs();
    });
    $('#global-text-color-val').on('change', function() {
        $('#global-text-color').val($(this).val());
        updateGlobalStylesFromInputs();
    });

    $('#global-font-family').on('change', updateGlobalStylesFromInputs);

    // Slot Modal Inputs Sync
    $('#slot-bg-color').on('input', function() { $('#slot-bg-text').val($(this).val()); });
    $('#slot-bg-text').on('change', function() { $('#slot-bg-color').val($(this).val()); });
    $('#slot-border-color').on('input', function() { $('#slot-border-text').val($(this).val()); });
    $('#slot-border-text').on('change', function() { $('#slot-border-color').val($(this).val()); });
    $('#slot-text-color').on('input', function() { $('#slot-text-color-val').val($(this).val()); });
    $('#slot-text-color-val').on('change', function() { $('#slot-text-color').val($(this).val()); });

    $('#btn-apply-slot-styles').on('click', applySlotStylesFromModal);
    $('#btn-reset-slot-to-global').on('click', function() {
        resetSlotToGlobal(window.CustomStoreState.selectedSlotId);
    });
    $('#btn-close-slot-modal').on('click', function() {
        $('#slot-modal-overlay').removeClass('active');
    });

    // Save & Reset Buttons
    $('#btn-save-all').on('click', saveCustomizationsToSupabase);
    $('#btn-reset-all').on('click', resetAllCustomizations);
}
