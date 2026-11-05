/**
 * custom.js — VikingTCG Store Customization & Visual Grid Editor (Fase 1)
 * Reflects identical look and feel of admin.html and public.html.
 * Sizing adjusted purely via border dots / 8 resize handles with real-time responsive grid preview.
 * Clean single-row unit customization bar with swatches without hex inputs.
 * Text protected zone tight (minimal 1px) and text at highest z-index.
 * In-slot sticker manipulation (drag, corner scale handle, rotate handle, delete).
 * Slots stripped of icons; strictly clean text.
 */

// All real platform slots definitions with exact native classes from admin.html (Icons removed)
const ADMIN_SLOTS = [
    { id: 'btn-custom-tile', title: 'Personalizar', defaultClass: 'tile-cyan', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-home', title: 'Home', defaultClass: 'tile-blue tile-large', defaultPcSpan: { col: 2, row: 2 }, defaultMobileSpan: { col: 2, row: 1 } },
    { id: 'btn-perfil', title: 'Mi Perfil', defaultClass: 'tile-cyan', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-scanner', title: 'Scanner', defaultClass: 'tile-orange', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-show-expansiones', title: 'Expansiones', defaultClass: 'tile-orange', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-show-decks', title: 'Mis Decks', defaultClass: 'tile-green tile-wide', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 2, row: 1 } },
    { id: 'btn-show-binders', title: 'Mis Binders', defaultClass: 'tile-purple tile-wide', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 2, row: 1 } },
    { id: 'btn-show-spirits', title: 'Asistente', defaultClass: 'tile-yellow tile-tall', defaultPcSpan: { col: 1, row: 2 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-users-panel', title: 'Usuarios', defaultClass: 'tile-pink', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-bdd-panel', title: 'BDD', defaultClass: 'tile-yellow', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-wishlist', title: 'Wantlist Pro', defaultClass: 'tile-blue', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-sealed', title: 'Producto Sellado', defaultClass: 'tile-cyan tile-wide', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 2, row: 1 } },
    { id: 'btn-tracking', title: 'Tracking', defaultClass: 'tile-blue', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-preventas', title: 'Preventas', defaultClass: 'tile-yellow tile-wide', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 2, row: 1 } },
    { id: 'btn-clientes', title: 'Clientes', defaultClass: 'tile-green', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-claims', title: 'Claims', defaultClass: 'tile-orange', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-admin-claims', title: 'Gestión Claims', defaultClass: 'tile-pink', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-subastas', title: 'Subastas', defaultClass: 'tile-purple', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-eventos', title: 'Eventos', defaultClass: 'tile-cyan', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-show-investments', title: 'Inversiones', defaultClass: 'tile-green', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-chatbot-config', title: 'Chatbot', defaultClass: 'tile-purple tile-wide', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 2, row: 1 } },
    { id: 'btn-widgets', title: 'Widgets', defaultClass: 'tile-blue', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'btn-logout-tile', title: 'Salir', defaultClass: 'tile-pink', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } }
];

const PUBLIC_SLOTS = [
    { id: 'public-binders', title: 'Binders', defaultClass: 'tile-purple tile-wide', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-decks', title: 'Decks', defaultClass: 'tile-blue tile-wide', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-auctions', title: 'Subastas', defaultClass: 'tile-pink', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-sealed', title: 'Productos', defaultClass: 'tile-green', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-preorders', title: 'Preventas', defaultClass: 'tile-yellow tile-wide', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 2, row: 1 } },
    { id: 'public-wishlist', title: 'Buscamos', defaultClass: 'tile-pink', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-investments', title: 'Inversiones', defaultClass: 'tile-orange', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-claims', title: 'Claims', defaultClass: 'tile-cyan', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-events', title: 'Eventos y Noticias', defaultClass: 'tile-cyan tile-wide', defaultPcSpan: { col: 2, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } },
    { id: 'public-learn', title: 'Aprender', defaultClass: 'tile-green', defaultPcSpan: { col: 1, row: 1 }, defaultMobileSpan: { col: 1, row: 1 } }
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
    activeStickerIdx: null,

    // Global Visual Settings (Only 4 Properties: Fondo, Borde, Letra, Tipografía)
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
    initStickersPicker();
    bindEvents();
    await loadCustomizations();
    renderGrid();
});

// 1. Theme Switcher Manager matching platform standard
function initThemeManager() {
    const savedTheme = localStorage.getItem('tcg_theme') || localStorage.getItem('site_theme') || 'theme-dark';
    $('body').removeClass('theme-light theme-medium theme-dark theme-purple').addClass(savedTheme);
    $('.theme-btn-small').removeClass('active');
    $(`.theme-btn-small[data-theme="${savedTheme}"]`).addClass('active');

    $('.theme-btn-small').on('click', function() {
        const theme = $(this).data('theme');
        $('body').removeClass('theme-light theme-medium theme-dark theme-purple').addClass(theme);
        $('.theme-btn-small').removeClass('active');
        $(`.theme-btn-small[data-theme="${theme}"]`).addClass('active');
        localStorage.setItem('tcg_theme', theme);
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

        // Render matching exact tile markup from admin.html without icons
        const $slot = $(`
            <div class="tile ${slotMeta.defaultClass || ''} ${isSelected ? 'slot-selected' : ''}"
                 id="${slotId}"
                 data-slot-id="${slotId}"
                 draggable="true"
                 style="${customInlineStyles}">

                <!-- Floating 'Personalizar' button -->
                <button class="btn-floating-customize" type="button">Personalizar</button>

                <!-- Stickers Layer (Behind text, z-index: 10) -->
                <div class="slot-stickers-layer" id="stickers-layer-${slotId}"></div>

                <!-- Slot Content with Tight Protected Text Zone -->
                <div class="slot-content-wrapper">
                    <span class="slot-title-text" style="${textCol ? `color: ${textCol} !important;` : ''}">${slotMeta.title}</span>
                    <div class="slot-protected-zone">
                        <span class="slot-protected-zone-tag">Zona Protegida</span>
                    </div>
                </div>

                <!-- 8 Sizing Handles on Borders (4 corners + 4 midpoints) -->
                <div class="slot-resize-dot dot-n" data-handle="n" title="Ajustar alto"></div>
                <div class="slot-resize-dot dot-s" data-handle="s" title="Ajustar alto"></div>
                <div class="slot-resize-dot dot-w" data-handle="w" title="Ajustar ancho"></div>
                <div class="slot-resize-dot dot-e" data-handle="e" title="Ajustar ancho"></div>
                <div class="slot-resize-dot dot-nw" data-handle="nw" title="Ajustar tamaño"></div>
                <div class="slot-resize-dot dot-ne" data-handle="ne" title="Ajustar tamaño"></div>
                <div class="slot-resize-dot dot-sw" data-handle="sw" title="Ajustar tamaño"></div>
                <div class="slot-resize-dot dot-se" data-handle="se" title="Ajustar tamaño"></div>
            </div>
        `);

        renderSlotStickers($slot.find('.slot-stickers-layer'), slotConfig.stickers || [], slotId);
        $grid.append($slot);
    });

    bindSlotInteractions();
}

// 5. Render Stickers in Slot with In-Slot Handles & Responsive Scaling
function renderSlotStickers($container, stickers, slotId) {
    $container.empty();
    if (!stickers || stickers.length === 0) return;

    const isSlotSelected = window.CustomStoreState.selectedSlotId === slotId;
    const isMobile = window.CustomStoreState.currentDevice === 'mobile';
    // In mobile preview, scale sticker dimensions by factor of 0.75 for proportionate harmony
    const scaleFactor = isMobile ? 0.75 : 1.0;

    stickers.forEach((stk, idx) => {
        const x = stk.x || 50;
        const y = stk.y || 50;
        const baseSize = stk.size || 40;
        const renderedSize = Math.round(baseSize * scaleFactor);
        const rot = stk.rotation || 0;
        const isActiveStk = isSlotSelected && window.CustomStoreState.activeStickerIdx === idx;

        const $stkItem = $(`
            <div class="sticker-item ${isActiveStk ? 'active-sticker' : ''}" data-index="${idx}" style="
                left: ${x}%;
                top: ${y}%;
                width: ${renderedSize}px;
                height: ${renderedSize}px;
                transform: translate(-50%, -50%) rotate(${rot}deg);
            ">
                <img src="${stk.url}" alt="${stk.name || 'Sticker'}">
                <div class="stk-btn-del" title="Eliminar">&times;</div>
                <div class="stk-handle stk-scale-handle" title="Cambiar tamaño"></div>
                <div class="stk-handle stk-rotate-handle" title="Girar"></div>
            </div>
        `);

        bindDirectStickerControls($stkItem, $container.closest('.tile'), slotId, idx, scaleFactor);
        $container.append($stkItem);
    });
}

// 6. Slot Interactions: Click to select & Smooth Drag to reorder
let draggedSlotId = null;

function bindSlotInteractions() {
    const $slots = $('.custom-viewport-frame .tile');

    // Smooth Drag-and-Drop:
    // Keeps active slot steady under cursor, highlights candidate drop targets without intermediate DOM jumping,
    // and commits the new grid position smoothly on mouse release (drop).
    $slots.on('dragstart', function(e) {
        if ($(e.target).closest('.slot-resize-dot, .sticker-item, .btn-floating-customize').length > 0) {
            e.preventDefault();
            return false;
        }
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
        const targetSlotId = $(this).data('slot-id');
        if (draggedSlotId && targetSlotId !== draggedSlotId) {
            $('.custom-viewport-frame .tile').removeClass('drag-over');
            $(this).addClass('drag-over');
        }
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

    // Clicking slot selects it (showing 8 dots + 'Personalizar' button)
    $slots.on('click', function(e) {
        if ($(e.target).closest('.slot-resize-dot, .sticker-item').length > 0) return;

        const slotId = $(this).data('slot-id');

        if ($(e.target).closest('.btn-floating-customize').length > 0) {
            e.stopPropagation();
            toggleUnitCustomBar(slotId);
            return;
        }

        window.CustomStoreState.selectedSlotId = slotId;
        window.CustomStoreState.activeStickerIdx = null;
        $('.custom-viewport-frame .tile').removeClass('slot-selected');
        $(this).addClass('slot-selected');
    });

    bind8ResizeDots();
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

// 7. 8 Resize Dots with Smooth Anchored Interaction
// Slots remain rock steady without jitter; handles anchor cleanly; preview updates smoothly without collapsing or resetting
function bind8ResizeDots() {
    $('.slot-resize-dot').off('mousedown touchstart pointerdown').on('mousedown touchstart pointerdown', function(e) {
        e.stopPropagation();
        e.preventDefault();

        const $dot = $(this);
        const handle = $dot.data('handle');
        const $slot = $dot.closest('.tile');
        const slotId = $slot.data('slot-id');

        const state = window.CustomStoreState;
        const isMobile = state.currentDevice === 'mobile';
        const target = state.currentTargetView;
        const gridData = isMobile ? state.gridMobile[target] : state.gridPc[target];
        const maxCols = isMobile ? 2 : 4;
        const maxRows = 3;

        if (!gridData.spans[slotId]) gridData.spans[slotId] = { col: 1, row: 1 };
        const initialCol = gridData.spans[slotId].col || 1;
        const initialRow = gridData.spans[slotId].row || 1;

        let workingCol = initialCol;
        let workingRow = initialRow;

        const startX = e.pageX !== undefined ? e.pageX : (e.originalEvent.touches ? e.originalEvent.touches[0].pageX : 0);
        const startY = e.pageY !== undefined ? e.pageY : (e.originalEvent.touches ? e.originalEvent.touches[0].pageY : 0);

        // Precise drag sensitivity thresholds
        const cellWidthStep = isMobile ? 130 : 180;
        const cellHeightStep = 110;

        // Visual feedback during active resizing
        $slot.css('box-shadow', '0 0 0 2px #a29bfe, 0 10px 30px rgba(0,0,0,0.5)');

        function onResizeMove(moveEvent) {
            const curX = moveEvent.pageX !== undefined ? moveEvent.pageX : (moveEvent.originalEvent.touches ? moveEvent.originalEvent.touches[0].pageX : startX);
            const curY = moveEvent.pageY !== undefined ? moveEvent.pageY : (moveEvent.originalEvent.touches ? moveEvent.originalEvent.touches[0].pageY : startY);

            const deltaX = curX - startX;
            const deltaY = curY - startY;

            let colDelta = 0;
            let rowDelta = 0;

            if (handle.includes('e')) {
                colDelta = Math.round(deltaX / cellWidthStep);
            } else if (handle.includes('w')) {
                colDelta = -Math.round(deltaX / cellWidthStep);
            }

            if (handle.includes('s')) {
                rowDelta = Math.round(deltaY / cellHeightStep);
            } else if (handle.includes('n')) {
                rowDelta = -Math.round(deltaY / cellHeightStep);
            }

            const targetCol = Math.max(1, Math.min(maxCols, initialCol + colDelta));
            const targetRow = Math.max(1, Math.min(maxRows, initialRow + rowDelta));

            if (workingCol !== targetCol || workingRow !== targetRow) {
                workingCol = targetCol;
                workingRow = targetRow;
                // Live preview real-time
                $slot.css({
                    'grid-column': `span ${workingCol}`,
                    'grid-row': `span ${workingRow}`
                });
            }
        }

        function onResizeUp() {
            $(document).off('mousemove touchmove pointermove', onResizeMove);
            $(document).off('mouseup touchend pointerup', onResizeUp);

            gridData.spans[slotId].col = workingCol;
            gridData.spans[slotId].row = workingRow;
            $slot.css('box-shadow', '');
            renderGrid();
        }

        $(document).on('mousemove touchmove pointermove', onResizeMove);
        $(document).on('mouseup touchend pointerup', onResizeUp);
    });
}

// 8. Direct In-Slot Sticker Controls (Drag, Scale handle, Rotate handle, Delete)
function bindDirectStickerControls($stkItem, $slotEl, slotId, stickerIdx, scaleFactor = 1.0) {
    // Select active sticker on click
    $stkItem.on('click', function(e) {
        e.stopPropagation();
        window.CustomStoreState.selectedSlotId = slotId;
        window.CustomStoreState.activeStickerIdx = stickerIdx;
        $('.custom-viewport-frame .tile').removeClass('slot-selected');
        $slotEl.addClass('slot-selected');
        $('.sticker-item').removeClass('active-sticker');
        $stkItem.addClass('active-sticker');
    });

    // Delete Button
    $stkItem.find('.stk-btn-del').on('click', function(e) {
        e.stopPropagation();
        const state = window.CustomStoreState;
        const sc = state.slotsConfig[slotId];
        if (sc && sc.stickers) {
            sc.stickers.splice(stickerIdx, 1);
            window.CustomStoreState.activeStickerIdx = null;
            renderGrid();
        }
    });

    // Fluid Scale Handle (Distance-from-Center math: perfectly smooth regardless of rotation angle)
    $stkItem.find('.stk-scale-handle').on('mousedown touchstart', function(e) {
        e.stopPropagation();
        e.preventDefault();

        const stkRect = $stkItem[0].getBoundingClientRect();
        const centerX = stkRect.left + stkRect.width / 2;
        const centerY = stkRect.top + stkRect.height / 2;

        const startX = e.pageX || (e.originalEvent.touches ? e.originalEvent.touches[0].pageX : centerX);
        const startY = e.pageY || (e.originalEvent.touches ? e.originalEvent.touches[0].pageY : centerY);
        const initialDist = Math.hypot(startX - centerX, startY - centerY) || 1;
        const currentRenderedSize = parseFloat($stkItem.css('width')) || 40;

        function onScaleMove(ev) {
            const curX = ev.pageX || (ev.originalEvent.touches ? ev.originalEvent.touches[0].pageX : centerX);
            const curY = ev.pageY || (ev.originalEvent.touches ? ev.originalEvent.touches[0].pageY : centerY);

            const curDist = Math.hypot(curX - centerX, curY - centerY);
            const distRatio = curDist / initialDist;
            const newRenderedSize = Math.max(16, Math.min(150, Math.round(currentRenderedSize * distRatio)));
            const normalizedBaseSize = Math.max(16, Math.min(150, Math.round(newRenderedSize / scaleFactor)));

            $stkItem.css({ width: `${newRenderedSize}px`, height: `${newRenderedSize}px` });

            const sc = window.CustomStoreState.slotsConfig[slotId];
            if (sc && sc.stickers && sc.stickers[stickerIdx]) {
                sc.stickers[stickerIdx].size = normalizedBaseSize;
            }
        }

        function onScaleEnd() {
            $(document).off('mousemove touchmove', onScaleMove);
            $(document).off('mouseup touchend', onScaleEnd);
        }

        $(document).on('mousemove touchmove', onScaleMove);
        $(document).on('mouseup touchend', onScaleEnd);
    });

    // Rotate Handle
    $stkItem.find('.stk-rotate-handle').on('mousedown touchstart', function(e) {
        e.stopPropagation();
        e.preventDefault();

        const stkRect = $stkItem[0].getBoundingClientRect();
        const centerX = stkRect.left + stkRect.width / 2;
        const centerY = stkRect.top + stkRect.height / 2;

        function onRotateMove(ev) {
            const curX = ev.pageX || (ev.originalEvent.touches ? ev.originalEvent.touches[0].pageX : centerX);
            const curY = ev.pageY || (ev.originalEvent.touches ? ev.originalEvent.touches[0].pageY : centerY);
            const rad = Math.atan2(curY - centerY, curX - centerX);
            let deg = Math.round(rad * (180 / Math.PI)) + 90; // offset top handle

            const sc = window.CustomStoreState.slotsConfig[slotId];
            if (sc && sc.stickers && sc.stickers[stickerIdx]) {
                sc.stickers[stickerIdx].rotation = deg;
            }

            $stkItem.css('transform', `translate(-50%, -50%) rotate(${deg}deg)`);
        }

        function onRotateEnd() {
            $(document).off('mousemove touchmove', onRotateMove);
            $(document).off('mouseup touchend', onRotateEnd);
        }

        $(document).on('mousemove touchmove', onRotateMove);
        $(document).on('mouseup touchend', onRotateEnd);
    });

    // Drag Position inside Slot
    $stkItem.on('mousedown touchstart', function(e) {
        if ($(e.target).closest('.stk-handle, .stk-btn-del').length > 0) return;
        e.stopPropagation();
        e.preventDefault();

        const slotRect = $slotEl[0].getBoundingClientRect();

        function onStickerMove(moveEvent) {
            const pageX = moveEvent.pageX || (moveEvent.originalEvent.touches ? moveEvent.originalEvent.touches[0].pageX : 0);
            const pageY = moveEvent.pageY || (moveEvent.originalEvent.touches ? moveEvent.originalEvent.touches[0].pageY : 0);

            const relX = ((pageX - slotRect.left) / slotRect.width) * 100;
            const relY = ((pageY - slotRect.top) / slotRect.height) * 100;

            $stkItem.css({
                left: `${Math.round(relX)}%`,
                top: `${Math.round(relY)}%`
            });
        }

        function onStickerUp() {
            $(document).off('mousemove touchmove', onStickerMove);
            $(document).off('mouseup touchend', onStickerUp);

            const finalLeft = parseFloat($stkItem[0].style.left) || 50;
            const finalTop = parseFloat($stkItem[0].style.top) || 50;

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

// 9. Global Styles Sync
function applyGlobalStylesToInputs() {
    const s = window.CustomStoreState.globalStyles;
    const bg = s.bg_color || '#1e272e';
    const border = s.border_color || '#00d2ff';
    const text = s.text_color || '#f5f6fa';

    $('#global-bg-color').val(bg);
    $('#swatch-global-bg').css('background-color', bg);

    $('#global-border-color').val(border);
    $('#swatch-global-border').css('border-color', border);

    $('#global-text-color').val(text);
    $('#swatch-global-text').css('background-color', text);

    if (s.font_family) {
        $('#global-font-family').val(s.font_family);
    }
}

function updateGlobalStylesFromInputs() {
    const s = window.CustomStoreState.globalStyles;
    s.bg_color = $('#global-bg-color').val();
    s.border_color = $('#global-border-color').val();
    s.text_color = $('#global-text-color').val();
    s.font_family = $('#global-font-family').val();

    $('#swatch-global-bg').css('background-color', s.bg_color);
    $('#swatch-global-border').css('border-color', s.border_color);
    $('#swatch-global-text').css('background-color', s.text_color);

    renderGrid();
}

// 10. Centered Unit Customization Modal
function toggleUnitCustomBar(slotId) {
    const state = window.CustomStoreState;
    const $backdrop = $('#unit-custom-modal-backdrop');

    if ($backdrop.hasClass('active') && state.selectedSlotId === slotId) {
        $backdrop.removeClass('active');
        return;
    }

    state.selectedSlotId = slotId;

    // Find slot title
    const currentSlots = state.currentTargetView === 'admin' ? ADMIN_SLOTS : PUBLIC_SLOTS;
    const slotMeta = currentSlots.find(s => s.id === slotId);
    $('#unit-modal-slot-title').text(slotMeta ? `Personalizar: ${slotMeta.title}` : 'Personalizar Slot');

    const slotConfig = state.slotsConfig[slotId] || {};

    const bg = slotConfig.bg_color || state.globalStyles.bg_color || '#1e272e';
    const border = slotConfig.border_color || state.globalStyles.border_color || '#00d2ff';
    const text = slotConfig.text_color || state.globalStyles.text_color || '#f5f6fa';
    const font = slotConfig.font_family || 'inherit';

    $('#unit-bg-color').val(bg);
    $('#swatch-unit-bg').css('background-color', bg);

    $('#unit-border-color').val(border);
    $('#swatch-unit-border').css('border-color', border);

    $('#unit-text-color').val(text);
    $('#swatch-unit-text').css('background-color', text);

    $('#unit-font-family').val(font);

    $backdrop.addClass('active');
}

function updateActiveSlotStyles() {
    const state = window.CustomStoreState;
    const slotId = state.selectedSlotId;
    if (!slotId) return;

    if (!state.slotsConfig[slotId]) state.slotsConfig[slotId] = {};
    const sc = state.slotsConfig[slotId];

    sc.bg_color = $('#unit-bg-color').val();
    sc.border_color = $('#unit-border-color').val();
    sc.text_color = $('#unit-text-color').val();
    sc.font_family = $('#unit-font-family').val();

    $('#swatch-unit-bg').css('background-color', sc.bg_color);
    $('#swatch-unit-border').css('border-color', sc.border_color);
    $('#swatch-unit-text').css('background-color', sc.text_color);

    renderGrid();
}

function resetActiveSlotToGlobal() {
    const state = window.CustomStoreState;
    const slotId = state.selectedSlotId;
    if (!slotId) return;

    if (state.slotsConfig[slotId]) {
        const stickers = state.slotsConfig[slotId].stickers || [];
        delete state.slotsConfig[slotId];
        if (stickers.length > 0) {
            state.slotsConfig[slotId] = { stickers };
        }
    }

    // Reset unit inputs back to global values
    const bg = state.globalStyles.bg_color || '#1e272e';
    const border = state.globalStyles.border_color || '#00d2ff';
    const text = state.globalStyles.text_color || '#f5f6fa';

    $('#unit-bg-color').val(bg);
    $('#swatch-unit-bg').css('background-color', bg);

    $('#unit-border-color').val(border);
    $('#swatch-unit-border').css('border-color', border);

    $('#unit-text-color').val(text);
    $('#swatch-unit-text').css('background-color', text);

    $('#unit-font-family').val('inherit');

    renderGrid();
}

// 11. Stickers Picker Popup
function initStickersPicker() {
    const $picker = $('#stickers-picker-popup');
    $picker.empty();

    TEST_STICKERS.forEach(stk => {
        const $item = $(`
            <div class="picker-sticker-item" title="Agregar ${stk.name}">
                <img src="${stk.url}" alt="${stk.name}">
            </div>
        `);
        $item.on('click', function(e) {
            e.stopPropagation();
            addStickerToCurrentSlot(stk);
        });
        $picker.append($item);
    });
}

function addStickerToCurrentSlot(stkTemplate) {
    const state = window.CustomStoreState;
    const slotId = state.selectedSlotId;
    if (!slotId) {
        Swal.fire('Selecciona un slot', 'Haz clic en un slot antes de añadir un sticker.', 'info');
        return;
    }

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

    state.activeStickerIdx = stickers.length - 1;
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

        // Cache synchronously in localStorage immediately to eliminate latency when navigating to admin or public view
        try {
            localStorage.setItem(`tcg_customization_${state.currentUser.id}`, JSON.stringify(payload));
        } catch (e) {
            console.warn('Could not cache customization in localStorage:', e);
        }

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
        text: 'Se restablecerán los estilos, controles y la distribución a los valores predeterminados.',
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
            state.selectedSlotId = null;
            state.activeStickerIdx = null;

            // Hide unit modal
            $('#unit-custom-modal-backdrop').removeClass('active');

            populateDefaultGridStructure();
            applyGlobalStylesToInputs();
            renderGrid();

            // Clear or update local cache
            if (state.currentUser && state.currentUser.id) {
                try {
                    localStorage.removeItem(`tcg_customization_${state.currentUser.id}`);
                } catch (_) {}
            }

            Swal.fire('Restablecido', 'El diseño y los controles han sido restablecidos.', 'success');
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
        $('#unit-custom-modal-backdrop').removeClass('active');
        renderGrid();
    });

    $('#btn-target-public').on('click', function() {
        $('.segmented-group button[data-target]').removeClass('active');
        $(this).addClass('active');
        window.CustomStoreState.currentTargetView = 'public';
        window.CustomStoreState.selectedSlotId = null;
        $('#unit-custom-modal-backdrop').removeClass('active');
        renderGrid();
    });

    // Global Style Inputs Sync
    $('#global-bg-color').on('input change', updateGlobalStylesFromInputs);
    $('#global-border-color').on('input change', updateGlobalStylesFromInputs);
    $('#global-text-color').on('input change', updateGlobalStylesFromInputs);
    $('#global-font-family').on('change', updateGlobalStylesFromInputs);

    // Unit Style Inputs Sync
    $('#unit-bg-color').on('input change', updateActiveSlotStyles);
    $('#unit-border-color').on('input change', updateActiveSlotStyles);
    $('#unit-text-color').on('input change', updateActiveSlotStyles);
    $('#unit-font-family').on('change', updateActiveSlotStyles);

    $('#btn-unit-reset').on('click', resetActiveSlotToGlobal);
    $('#btn-close-unit-modal').on('click', function() {
        $('#unit-custom-modal-backdrop').removeClass('active');
    });

    // Close when clicking outside card
    $('#unit-custom-modal-backdrop').on('click', function(e) {
        if ($(e.target).is('#unit-custom-modal-backdrop')) {
            $(this).removeClass('active');
        }
    });

    // Save & Reset Buttons
    $('#btn-save-all').on('click', saveCustomizationsToSupabase);
    $('#btn-reset-all').on('click', resetAllCustomizations);
}
