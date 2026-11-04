/**
 * custom.js — VikingTCG Store Customization & Visual Grid Editor (Fase 1)
 * Handles global styles, per-slot styles, independent PC & Mobile layouts,
 * drag-and-drop ordering, column/row span resizing, protected text zones,
 * and sticker management with Supabase persistence.
 */

// All real platform slots definitions
const ADMIN_SLOTS = [
    { id: 'btn-home', title: 'Home', icon: 'fas fa-home', defaultPcSpan: { col: 2, row: 2 }, defaultMobileSpan: { col: 2, row: 1 } },
    { id: 'btn-perfil', title: 'Mi Perfil', icon: 'fas fa-user-circle', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-show-decks', title: 'Mis Decks', icon: 'fas fa-layer-group', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 2, row: 1 } },
    { id: 'btn-show-binders', title: 'Mis Binders', icon: 'fas fa-book', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 2, row: 1 } },
    { id: 'btn-show-spirits', title: 'Asistente', icon: 'fas fa-ghost', defaultPcSpan: { col: 1, row: 2 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-scanner', title: 'Scanner', icon: 'fas fa-barcode', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-show-expansiones', title: 'Expansiones', icon: 'fas fa-th-large', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-users-panel', title: 'Usuarios', icon: 'fas fa-users', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-bdd-panel', title: 'BDD', icon: 'fas fa-database', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-wishlist', title: 'Wantlist Pro', icon: 'fas fa-heart', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-sealed', title: 'Producto Sellado', icon: 'fas fa-box', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 2, row: 1 } },
    { id: 'btn-preventas', title: 'Preventas', icon: 'fas fa-fire', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 2, row: 1 } },
    { id: 'btn-tracking', title: 'Tracking', icon: 'fas fa-shipping-fast', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-clientes', title: 'Clientes', icon: 'fas fa-address-book', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-claims', title: 'Claims', icon: 'fas fa-hand-holding-heart', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-admin-claims', title: 'Gestión Claims', icon: 'fas fa-tasks', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-subastas', title: 'Subastas', icon: 'fas fa-gavel', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-eventos', title: 'Eventos', icon: 'fas fa-calendar-alt', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-chatbot-config', title: 'Chatbot', icon: 'fas fa-robot', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 2, row: 1 } },
    { id: 'btn-show-investments', title: 'Inversiones', icon: 'fas fa-chart-line', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-widgets', title: 'Widgets', icon: 'fas fa-code', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-logout-tile', title: 'Salir', icon: 'fas fa-sign-out-alt', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } }
];

const PUBLIC_SLOTS = [
    { id: 'public-binders', title: 'Binders', icon: 'fas fa-book', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-decks', title: 'Decks', icon: 'fas fa-layer-group', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-auctions', title: 'Subastas', icon: 'fas fa-gavel', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-sealed', title: 'Productos', icon: 'fas fa-box', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-preorders', title: 'Preventas', icon: 'fas fa-fire', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-wishlist', title: 'Buscamos', icon: 'fas fa-heart', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-investments', title: 'Inversiones', icon: 'fas fa-chart-line', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-claims', title: 'Claims', icon: 'fas fa-hand-holding-heart', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-events', title: 'Eventos y Noticias', icon: 'fas fa-calendar-alt', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-learn', title: 'Aprender', icon: 'fas fa-graduation-cap', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } }
];

// Test Stickers Library (transparent PNGs and high-res vector badges)
const TEST_STICKERS = [
    { id: 'stk-flame', name: 'Fuego / Hot', url: 'https://cdn-icons-png.flaticon.com/512/785/785116.png' },
    { id: 'stk-star', name: 'Estrella Dorada', url: 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png' },
    { id: 'stk-sparkles', name: 'Destellos / Foil', url: 'https://cdn-icons-png.flaticon.com/512/1828/1828970.png' },
    { id: 'stk-crown', name: 'Corona Pro', url: 'https://cdn-icons-png.flaticon.com/512/6941/6941697.png' },
    { id: 'stk-diamond', name: 'Diamante / Rare', url: 'https://cdn-icons-png.flaticon.com/512/1828/1828882.png' },
    { id: 'stk-verified', name: 'Verificado', url: 'https://cdn-icons-png.flaticon.com/512/7595/7595571.png' },
    { id: 'stk-discount', name: 'Oferta / Promo', url: 'https://cdn-icons-png.flaticon.com/512/726/726488.png' },
    { id: 'stk-tcg-card', name: 'Carta Mágica', url: 'https://cdn-icons-png.flaticon.com/512/4743/4743048.png' },
    { id: 'stk-ghost', name: 'Espíritu', url: 'https://cdn-icons-png.flaticon.com/512/1067/1067357.png' },
    { id: 'stk-shield', name: 'Escudo', url: 'https://cdn-icons-png.flaticon.com/512/1067/1067347.png' }
];

// State Manager
window.CustomStoreState = {
    currentUser: null,
    currentDevice: 'pc', // 'pc' or 'mobile'
    currentTargetView: 'admin', // 'admin' or 'public'
    selectedSlotId: null,

    // Global Visual Settings
    globalStyles: {
        bg_color: '#121824',
        border_color: '#00d2ff',
        border_width: '2px',
        border_radius: '24px',
        text_color: '#ffffff',
        font_family: "'Montserrat', sans-serif",
        font_size: '16px'
    },

    // Individual Slot Customizations: { [slotId]: { bg_color, border_color, border_width, border_radius, text_color, font_family, font_size, stickers: [] } }
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
    await initSession();
    initStickersLibrary();
    bindEvents();
    await loadCustomizations();
    renderGrid();
});

// 1. Session Initialization
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
                return;
            }
        }
    } catch (e) {
        console.warn('Supabase auth session check failed, using fallback:', e);
    }

    // Fallback: localStorage
    const savedSession = localStorage.getItem('tcg_session');
    if (savedSession) {
        try {
            window.CustomStoreState.currentUser = JSON.parse(savedSession);
        } catch (e) {
            console.error('Error parsing tcg_session', e);
        }
    }

    if (!window.CustomStoreState.currentUser) {
        // Guest / Demo Mode
        window.CustomStoreState.currentUser = { id: '00000000-0000-0000-0000-000000000000', username: 'Demo' };
    }
}

// 2. Load Customizations from Supabase
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

// 3. Render Interactive Grid
function renderGrid() {
    const state = window.CustomStoreState;
    const isMobile = state.currentDevice === 'mobile';
    const target = state.currentTargetView;
    const gridData = isMobile ? state.gridMobile[target] : state.gridPc[target];
    const availableSlots = target === 'admin' ? ADMIN_SLOTS : PUBLIC_SLOTS;
    const slotMap = new Map(availableSlots.map(s => [s.id, s]));

    const $grid = $('#custom-grid-container');
    $grid.empty();

    // Ensure all slots are in the order list
    const renderedOrder = [...(gridData.order || [])];
    availableSlots.forEach(s => {
        if (!renderedOrder.includes(s.id)) renderedOrder.push(s.id);
    });

    const maxCols = isMobile ? 2 : 4;

    renderedOrder.forEach((slotId, index) => {
        const slotMeta = slotMap.get(slotId);
        if (!slotMeta) return;

        const span = gridData.spans[slotId] || { col: 1, row: 1 };
        const safeColSpan = Math.min(span.col || 1, maxCols);
        const safeRowSpan = span.row || 1;

        // Slot styling: Individual or Global
        const slotConfig = state.slotsConfig[slotId] || {};
        const bg = slotConfig.bg_color || state.globalStyles.bg_color;
        const borderCol = slotConfig.border_color || state.globalStyles.border_color;
        const borderWidth = slotConfig.border_width || state.globalStyles.border_width;
        const borderRadius = slotConfig.border_radius || state.globalStyles.border_radius;
        const textCol = slotConfig.text_color || state.globalStyles.text_color;
        const fontFamily = (slotConfig.font_family && slotConfig.font_family !== 'inherit') ? slotConfig.font_family : state.globalStyles.font_family;
        const fontSize = slotConfig.font_size || state.globalStyles.font_size;

        const isSelected = state.selectedSlotId === slotId;

        const $slot = $(`
            <div class="custom-grid-slot ${isSelected ? 'slot-selected show-protected' : ''}"
                 id="slot-element-${slotId}"
                 data-slot-id="${slotId}"
                 draggable="true"
                 style="
                    grid-column: span ${safeColSpan};
                    grid-row: span ${safeRowSpan};
                    --slot-bg: ${bg};
                    --slot-border-color: ${borderCol};
                    --slot-border-width: ${borderWidth};
                    --slot-border-radius: ${borderRadius};
                    --slot-text-color: ${textCol};
                    --slot-font-family: ${fontFamily};
                    --slot-font-size: ${fontSize};
                 ">

                <!-- Slot Action Ribbon -->
                <div class="slot-quick-ribbon">
                    <button class="btn-slot-quick btn-open-stickers" title="Administrar Stickers">
                        <i class="fas fa-icons"></i> Stickers
                    </button>
                    <button class="btn-slot-quick btn-edit-slot-styles" title="Editar Estilos">
                        <i class="fas fa-palette"></i> Estilos
                    </button>
                    <button class="btn-slot-quick btn-col-dec" title="Reducir Ancho">- Col</button>
                    <button class="btn-slot-quick btn-col-inc" title="Aumentar Ancho">+ Col</button>
                </div>

                <!-- Protected Text Zone -->
                <div class="slot-protected-zone">
                    <span class="slot-protected-zone-tag"><i class="fas fa-shield-alt"></i> Zona Protegida</span>
                </div>

                <!-- Main Content -->
                <div class="slot-icon-box">
                    <i class="${slotMeta.icon}"></i>
                </div>
                <div class="slot-title-box">
                    ${slotMeta.title}
                </div>

                <!-- Stickers Layer -->
                <div class="slot-stickers-layer" id="stickers-layer-${slotId}">
                    <!-- Stickers appended here -->
                </div>

                <!-- Resize Handles -->
                <div class="slot-resize-handle handle-right" title="Arrastrar para ajustar ancho"></div>
                <div class="slot-resize-handle handle-bottom" title="Arrastrar para ajustar alto"></div>
                <div class="slot-resize-handle handle-corner" title="Arrastrar para ajustar ancho y alto"></div>
            </div>
        `);

        // Render stickers inside slot
        renderSlotStickers($slot.find('.slot-stickers-layer'), slotConfig.stickers || []);

        $grid.append($slot);
    });

    bindDragAndDropEvents();
}

// 4. Render Stickers in Slot
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

        bindStickerDragAndDrop($stkItem, $container.closest('.custom-grid-slot'));
        $container.append($stkItem);
    });
}

// 5. Interactive Drag & Drop for Slots Sorting
let draggedSlotId = null;

function bindDragAndDropEvents() {
    const $slots = $('.custom-grid-slot');

    $slots.on('dragstart', function(e) {
        draggedSlotId = $(this).data('slot-id');
        $(this).addClass('is-dragging');
        e.originalEvent.dataTransfer.effectAllowed = 'move';
        e.originalEvent.dataTransfer.setData('text/plain', draggedSlotId);
    });

    $slots.on('dragend', function() {
        $(this).removeClass('is-dragging');
        $('.custom-grid-slot').removeClass('drag-over');
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

    // Slot Selection
    $slots.on('click', function(e) {
        // If clicking on ribbon buttons, don't trigger selection toggle
        if ($(e.target).closest('.slot-quick-ribbon, .sticker-item').length > 0) return;

        const slotId = $(this).data('slot-id');
        if (window.CustomStoreState.selectedSlotId === slotId) {
            window.CustomStoreState.selectedSlotId = null;
            $('.custom-grid-slot').removeClass('slot-selected show-protected');
        } else {
            window.CustomStoreState.selectedSlotId = slotId;
            $('.custom-grid-slot').removeClass('slot-selected show-protected');
            $(this).addClass('slot-selected show-protected');
        }
    });

    // Resize Handles logic
    bindResizeHandles();
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

// 6. Interactive Column/Row Span Adjustment via Handles & Ribbon
function bindResizeHandles() {
    $('.btn-col-inc').off('click').on('click', function(e) {
        e.stopPropagation();
        const slotId = $(this).closest('.custom-grid-slot').data('slot-id');
        adjustSlotSpan(slotId, 1, 0);
    });

    $('.btn-col-dec').off('click').on('click', function(e) {
        e.stopPropagation();
        const slotId = $(this).closest('.custom-grid-slot').data('slot-id');
        adjustSlotSpan(slotId, -1, 0);
    });

    // Handle corner drag for continuous intuitive sizing
    $('.slot-resize-handle').off('mousedown touchstart').on('mousedown touchstart', function(e) {
        e.stopPropagation();
        e.preventDefault();
        const $slot = $(this).closest('.custom-grid-slot');
        const slotId = $slot.data('slot-id');
        const isRight = $(this).hasClass('handle-right') || $(this).hasClass('handle-corner');
        const isBottom = $(this).hasClass('handle-bottom') || $(this).hasClass('handle-corner');

        const startX = e.pageX || (e.originalEvent.touches ? e.originalEvent.touches[0].pageX : 0);
        const startY = e.pageY || (e.originalEvent.touches ? e.originalEvent.touches[0].pageY : 0);

        function onMouseMove(moveEvent) {
            // Drag tracking indicator can be added here
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
                if (deltaX > 60) colChange = 1;
                else if (deltaX < -60) colChange = -1;
            }

            if (isBottom) {
                if (deltaY > 60) rowChange = 1;
                else if (deltaY < -60) rowChange = -1;
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

// 7. Sticker Drag and Placement inside Slot
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

            // Compute relative percentage inside the slot
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

            // Save new position into state
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

// 8. Global Styles Application to Inputs and Grid
function applyGlobalStylesToInputs() {
    const s = window.CustomStoreState.globalStyles;
    $('#global-bg-color').val(s.bg_color);
    $('#global-bg-text').val(s.bg_color);
    $('#global-border-color').val(s.border_color);
    $('#global-border-text').val(s.border_color);

    const bWidthNum = parseInt(s.border_width, 10) || 2;
    $('#global-border-width').val(bWidthNum);
    $('#global-border-width-badge').text(`${bWidthNum}px`);

    const bRadiusNum = parseInt(s.border_radius, 10) || 24;
    $('#global-border-radius').val(bRadiusNum);
    $('#global-border-radius-badge').text(`${bRadiusNum}px`);

    $('#global-text-color').val(s.text_color);
    $('#global-text-color-val').val(s.text_color);

    $('#global-font-family').val(s.font_family);

    const fSizeNum = parseInt(s.font_size, 10) || 16;
    $('#global-font-size').val(fSizeNum);
    $('#global-font-size-badge').text(`${fSizeNum}px`);
}

function updateGlobalStylesFromInputs() {
    const s = window.CustomStoreState.globalStyles;
    s.bg_color = $('#global-bg-text').val() || $('#global-bg-color').val();
    s.border_color = $('#global-border-text').val() || $('#global-border-color').val();
    s.border_width = `${$('#global-border-width').val()}px`;
    s.border_radius = `${$('#global-border-radius').val()}px`;
    s.text_color = $('#global-text-color-val').val() || $('#global-text-color').val();
    s.font_family = $('#global-font-family').val();
    s.font_size = `${$('#global-font-size').val()}px`;

    renderGrid();
}

// 9. Individual Slot Modal
function openSlotStylesModal(slotId) {
    const state = window.CustomStoreState;
    const target = state.currentTargetView;
    const availableSlots = target === 'admin' ? ADMIN_SLOTS : PUBLIC_SLOTS;
    const slotMeta = availableSlots.find(s => s.id === slotId);
    if (!slotMeta) return;

    state.selectedSlotId = slotId;
    $('#modal-slot-title').text(slotMeta.title);
    $('#modal-current-device-label').text(state.currentDevice.toUpperCase());

    const slotConfig = state.slotsConfig[slotId] || {};
    const bg = slotConfig.bg_color || state.globalStyles.bg_color;
    const borderCol = slotConfig.border_color || state.globalStyles.border_color;
    const borderWidth = parseInt(slotConfig.border_width || state.globalStyles.border_width, 10) || 2;
    const borderRadius = parseInt(slotConfig.border_radius || state.globalStyles.border_radius, 10) || 24;
    const textCol = slotConfig.text_color || state.globalStyles.text_color;
    const fontFamily = slotConfig.font_family || 'inherit';
    const fontSize = parseInt(slotConfig.font_size || state.globalStyles.font_size, 10) || 16;

    $('#slot-bg-color').val(bg);
    $('#slot-bg-text').val(bg);
    $('#slot-border-color').val(borderCol);
    $('#slot-border-text').val(borderCol);
    $('#slot-border-width').val(borderWidth);
    $('#slot-border-width-badge').text(`${borderWidth}px`);
    $('#slot-border-radius').val(borderRadius);
    $('#slot-border-radius-badge').text(`${borderRadius}px`);
    $('#slot-text-color').val(textCol);
    $('#slot-text-color-val').val(textCol);
    $('#slot-font-family').val(fontFamily);
    $('#slot-font-size').val(fontSize);
    $('#slot-font-size-badge').text(`${fontSize}px`);

    // Span
    const gridData = state.currentDevice === 'mobile' ? state.gridMobile[target] : state.gridPc[target];
    const span = (gridData.spans && gridData.spans[slotId]) ? gridData.spans[slotId] : { col: 1, row: 1 };
    $('#slot-col-span-select').val(span.col || 1);
    $('#slot-row-span-select').val(span.row || 1);

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
    sc.border_width = `${$('#slot-border-width').val()}px`;
    sc.border_radius = `${$('#slot-border-radius').val()}px`;
    sc.text_color = $('#slot-text-color-val').val();
    sc.font_family = $('#slot-font-family').val();
    sc.font_size = `${$('#slot-font-size').val()}px`;

    // Spans
    const isMobile = state.currentDevice === 'mobile';
    const target = state.currentTargetView;
    const gridData = isMobile ? state.gridMobile[target] : state.gridPc[target];
    if (!gridData.spans[slotId]) gridData.spans[slotId] = {};
    gridData.spans[slotId].col = parseInt($('#slot-col-span-select').val(), 10) || 1;
    gridData.spans[slotId].row = parseInt($('#slot-row-span-select').val(), 10) || 1;

    $('#slot-modal-overlay').removeClass('active');
    renderGrid();
}

function resetSlotToGlobal(slotId) {
    const state = window.CustomStoreState;
    if (state.slotsConfig[slotId]) {
        // Keep stickers intact, reset visual styles
        const stickers = state.slotsConfig[slotId].stickers || [];
        delete state.slotsConfig[slotId];
        if (stickers.length > 0) {
            state.slotsConfig[slotId] = { stickers };
        }
    }
    $('#slot-modal-overlay').removeClass('active');
    renderGrid();
}

// 10. Stickers Library & Management Modal
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

function openStickersModal(slotId) {
    const state = window.CustomStoreState;
    const target = state.currentTargetView;
    const availableSlots = target === 'admin' ? ADMIN_SLOTS : PUBLIC_SLOTS;
    const slotMeta = availableSlots.find(s => s.id === slotId);
    if (!slotMeta) return;

    state.selectedSlotId = slotId;
    $('#stickers-modal-slot-title').text(slotMeta.title);
    renderStickersManagerList(slotId);
    $('#stickers-modal-overlay').addClass('active');
}

function renderStickersManagerList(slotId) {
    const state = window.CustomStoreState;
    const sc = state.slotsConfig[slotId] || {};
    const stickers = sc.stickers || [];

    $('#slot-stickers-count').text(stickers.length);
    const $list = $('#slot-stickers-list');
    $list.empty();

    if (stickers.length === 0) {
        $list.html('<div style="color: #64748b; font-size: 0.8rem; text-align: center; padding: 10px;">No hay stickers añadidos a este slot.</div>');
        return;
    }

    stickers.forEach((stk, idx) => {
        const $row = $(`
            <div class="sticker-manager-row">
                <img src="${stk.url}" alt="Sticker" class="sticker-row-preview">
                <div class="sticker-row-controls">
                    <label style="font-size: 0.7rem; color: #94a3b8;">Tamaño: </label>
                    <input type="range" class="custom-range-slider stk-scale-range" min="20" max="100" value="${stk.size || 40}" style="flex: 1;">
                    <span style="font-size: 0.75rem; color: #00d2ff; min-width: 35px;">${stk.size || 40}px</span>

                    <label style="font-size: 0.7rem; color: #94a3b8; margin-left: 10px;">Giro: </label>
                    <input type="range" class="custom-range-slider stk-rot-range" min="-180" max="180" value="${stk.rotation || 0}" style="flex: 1;">
                    <span style="font-size: 0.75rem; color: #ffcc00; min-width: 35px;">${stk.rotation || 0}°</span>
                </div>
                <button class="btn-delete-sticker" data-index="${idx}" title="Eliminar sticker">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `);

        // Change size
        $row.find('.stk-scale-range').on('input', function() {
            const val = parseInt($(this).val(), 10);
            stk.size = val;
            $(this).next().text(`${val}px`);
            renderGrid();
        });

        // Change rotation
        $row.find('.stk-rot-range').on('input', function() {
            const val = parseInt($(this).val(), 10);
            stk.rotation = val;
            $(this).next().text(`${val}°`);
            renderGrid();
        });

        // Delete
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
        Swal.fire('Límite alcanzado', 'Has alcanzado el límite máximo de 10 stickers por slot.', 'warning');
        return;
    }

    // Default positioning in corners to avoid the protected text zone
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
        size: 42,
        rotation: 0
    });

    renderStickersManagerList(slotId);
    renderGrid();
}

// 11. Save Customizations to Supabase
async function saveCustomizationsToSupabase() {
    const state = window.CustomStoreState;
    if (!state.currentUser || !state.currentUser.id || state.currentUser.id === '00000000-0000-0000-0000-000000000000') {
        Swal.fire({
            icon: 'info',
            title: 'Modo Demostración',
            text: 'Tus cambios han sido aplicados visualmente. Inicia sesión en tu cuenta para guardar permanentemente en tu tienda.'
        });
        return;
    }

    Swal.fire({
        title: 'Guardando personalización...',
        text: 'Sincronizando diseño y distribución con tu tienda',
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
            text: 'Tu tienda y panel de control han sido actualizados con tu personalización.',
            timer: 2000,
            showConfirmButton: false
        });
    } catch (err) {
        console.error('Error saving store customizations:', err);
        Swal.fire({
            icon: 'error',
            title: 'Error al Guardar',
            text: err.message || 'No se pudo guardar la personalización en la base de datos.'
        });
    }
}

// 12. Reset All Configuration
function resetAllCustomizations() {
    Swal.fire({
        title: '¿Restablecer todo el diseño?',
        text: 'Se restablecerán los estilos globales, individuales y la distribución GRID a los valores por defecto.',
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
                bg_color: '#121824',
                border_color: '#00d2ff',
                border_width: '2px',
                border_radius: '24px',
                text_color: '#ffffff',
                font_family: "'Montserrat', sans-serif",
                font_size: '16px'
            };
            state.slotsConfig = {};
            state.gridPc = { admin: { order: [], spans: {} }, public: { order: [], spans: {} } };
            state.gridMobile = { admin: { order: [], spans: {} }, public: { order: [], spans: {} } };

            populateDefaultGridStructure();
            applyGlobalStylesToInputs();
            renderGrid();

            Swal.fire('Restablecido', 'El diseño ha sido restablecido a los valores predeterminados.', 'success');
        }
    });
}

// 13. DOM Event Listeners
function bindEvents() {
    // Device Toggle
    $('#btn-device-pc').on('click', function() {
        $('.btn-device').removeClass('active');
        $(this).addClass('active');
        window.CustomStoreState.currentDevice = 'pc';
        $('#device-stage-wrapper').removeClass('mode-mobile').addClass('mode-pc');
        renderGrid();
    });

    $('#btn-device-mobile').on('click', function() {
        $('.btn-device').removeClass('active');
        $(this).addClass('active');
        window.CustomStoreState.currentDevice = 'mobile';
        $('#device-stage-wrapper').removeClass('mode-pc').addClass('mode-mobile');
        renderGrid();
    });

    // Target View Toggle (Admin Dashboard vs Public Store)
    $('#btn-target-admin').on('click', function() {
        $('.btn-target-view').removeClass('active');
        $(this).addClass('active');
        window.CustomStoreState.currentTargetView = 'admin';
        window.CustomStoreState.selectedSlotId = null;
        renderGrid();
    });

    $('#btn-target-public').on('click', function() {
        $('.btn-target-view').removeClass('active');
        $(this).addClass('active');
        window.CustomStoreState.currentTargetView = 'public';
        window.CustomStoreState.selectedSlotId = null;
        renderGrid();
    });

    // Global Style Inputs Sync
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

    $('#global-border-width').on('input', function() {
        $('#global-border-width-badge').text(`${$(this).val()}px`);
        updateGlobalStylesFromInputs();
    });

    $('#global-border-radius').on('input', function() {
        $('#global-border-radius-badge').text(`${$(this).val()}px`);
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

    $('#global-font-size').on('input', function() {
        $('#global-font-size-badge').text(`${$(this).val()}px`);
        updateGlobalStylesFromInputs();
    });

    // Individual Slot Customizer Triggers
    $(document).on('click', '.btn-edit-slot-styles', function(e) {
        e.stopPropagation();
        const slotId = $(this).closest('.custom-grid-slot').data('slot-id');
        openSlotStylesModal(slotId);
    });

    $(document).on('click', '.btn-open-stickers', function(e) {
        e.stopPropagation();
        const slotId = $(this).closest('.custom-grid-slot').data('slot-id');
        openStickersModal(slotId);
    });

    // Slot Modal Inputs Sync
    $('#slot-bg-color').on('input', function() { $('#slot-bg-text').val($(this).val()); });
    $('#slot-bg-text').on('change', function() { $('#slot-bg-color').val($(this).val()); });
    $('#slot-border-color').on('input', function() { $('#slot-border-text').val($(this).val()); });
    $('#slot-border-text').on('change', function() { $('#slot-border-color').val($(this).val()); });
    $('#slot-border-width').on('input', function() { $('#slot-border-width-badge').text(`${$(this).val()}px`); });
    $('#slot-border-radius').on('input', function() { $('#slot-border-radius-badge').text(`${$(this).val()}px`); });
    $('#slot-text-color').on('input', function() { $('#slot-text-color-val').val($(this).val()); });
    $('#slot-text-color-val').on('change', function() { $('#slot-text-color').val($(this).val()); });
    $('#slot-font-size').on('input', function() { $('#slot-font-size-badge').text(`${$(this).val()}px`); });

    $('#btn-apply-slot-styles').on('click', applySlotStylesFromModal);
    $('#btn-reset-slot-to-global').on('click', function() {
        resetSlotToGlobal(window.CustomStoreState.selectedSlotId);
    });
    $('#btn-close-slot-modal').on('click', function() {
        $('#slot-modal-overlay').removeClass('active');
    });

    // Stickers Modal Controls
    $('#btn-close-stickers-modal, #btn-finish-stickers').on('click', function() {
        $('#stickers-modal-overlay').removeClass('active');
    });

    // Save & Reset Buttons
    $('#btn-save-all').on('click', saveCustomizationsToSupabase);
    $('#btn-reset-all').on('click', resetAllCustomizations);
}
