/**
 * Inversiones (Investments) Module
 * Logic for managing card investments with manual price tracking and history.
 */

// --- STATE ---
let currentInvestmentCategoryId = null;
let currentInvestmentCategory = null;
let currentInvestmentViewMode = 'album'; // 'album', 'slide', 'list'
let localInvestmentCards = [];
let invPriceChart = null;
let invDetailChart = null;
let currentInvExtraImages = [];
let currentLedgerCategory = null;
// Global slot index chosen by the user when adding an asset from an empty
// binder slot (null = append at the end).
let pendingSlotIndex = null;
// Timestamp of the last finished slot drag, to swallow the follow-up click.
let invDragJustEnded = 0;

// --- UTILS ---
function invNum(v) {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
}

function fmtMoney(v) {
    return '$' + invNum(v).toFixed(2);
}

function fmtSignedMoney(v) {
    const n = invNum(v);
    return (n >= 0 ? '+' : '-') + '$' + Math.abs(n).toFixed(2);
}

function fmtPct(v) {
    const n = invNum(v);
    return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
}

// Human-readable explanation for every metric shown in the UI. Keyed by the
// same id used by invInfoIcon(), so tapping the ⓘ opens the right help text.
const INV_METRIC_HELP = {
    cost: {
        title: '¿Cuánto me costó?',
        body: 'Lo que pagaste por estas cartas que aún tienes disponibles. Es la suma de tu precio de compra (o el precio del lote si definiste uno para la colección).'
    },
    market: {
        title: '¿Cuánto valen hoy en el mercado?',
        body: 'El valor actual de las cartas disponibles según el precio de mercado que registraste. Es lo que recibirías si las vendieras hoy a ese precio.'
    },
    saleTarget: {
        title: '¿En cuánto las quiero vender?',
        body: 'El valor total al precio de venta que tú fijaste para cada carta disponible. Es tu objetivo de venta.'
    },
    unrealized: {
        title: 'Ganancia al precio de mercado',
        body: 'Si vendieras hoy al precio de mercado: valor de mercado menos lo que te costó. Es ganancia "en papel", todavía no realizada.'
    },
    projected: {
        title: 'Ganancia al precio de venta',
        body: 'Si vendieras al precio de venta que fijaste: valor de venta menos lo que te costó. Es tu ganancia esperada.'
    },
    margin: {
        title: 'Margen sobre el mercado',
        body: 'Cuánto más caro estás vendiendo respecto al precio de mercado: valor de venta menos valor de mercado. Te dice si tu precio está por encima o por debajo del mercado.'
    },
    roi: {
        title: 'Rendimiento sobre lo invertido',
        body: 'La ganancia esperada (al precio de venta) como porcentaje de lo que te costó. Ejemplo: invertiste $500 y esperas ganar $100 → 20%.'
    },
    realized: {
        title: 'Ganancia ya realizada (ventas)',
        body: 'Lo que ya ganaste con las cartas que marcaste como VENDIDAS: precio real de venta menos lo que te costaron.'
    },
    sold: {
        title: 'Cartas fuera de cartera',
        body: 'Cartas que ya no cuentan como disponibles: las que marcaste como VENDIDAS o como no disponibles. No entran en los cálculos generales de arriba.'
    }
};

// Small ⓘ button that opens the explanation for a metric.
function invInfoIcon(key) {
    return `<span class="inv-info-icon" data-help="${key}" title="Ver explicación"><i class="fas fa-circle-info"></i></span>`;
}

// Profit/loss + margin calculations for a single card.
// `costOverride` lets a collection lot price replace the card's own cost.
function computeCardMetrics(card, costOverride) {
    const qty = parseInt(card.quantity) || 1;
    const cost = (costOverride !== undefined && costOverride !== null)
        ? invNum(costOverride)
        : invNum(card.purchase_price) * qty;
    const market = invNum(card.current_price) * qty;
    const saleTarget = invNum(card.sale_price) * qty;
    const isSold = card.is_sold === true;
    const isAvailable = card.is_available !== false;
    const isActive = !isSold && isAvailable;   // Disponible para vender
    const soldQty = parseInt(card.sold_quantity) || qty;
    const soldTotal = invNum(card.sold_price) * soldQty;

    return {
        qty,
        cost,
        market,
        saleTarget,
        unrealized: market - cost,            // Ganancia/pérdida si vendo al precio de mercado
        projected: saleTarget - cost,         // Ganancia/pérdida si vendo al precio de venta fijado
        marginVsMarket: saleTarget - market,  // Diferencia entre precio de venta y mercado
        roi: cost > 0 ? ((saleTarget - cost) / cost) * 100 : 0,
        marginPct: market > 0 ? ((saleTarget - market) / market) * 100 : 0,
        isSold,
        isAvailable,
        isActive,
        soldQty,
        soldTotal,
        realized: isSold ? soldTotal - cost : 0
    };
}

// Distributes a collection lot price across its cards, proportionally to each
// card's own purchase value (or by quantity when no prices were entered).
// Returns a map of card id -> allocated cost.
function allocateLotCost(cards, lot) {
    const map = {};
    if (lot === null || lot === undefined || lot === '' || isNaN(invNum(lot))) return map;
    const total = invNum(lot);
    const list = cards || [];
    let basis = 0;
    let units = 0;
    list.forEach(c => {
        const q = parseInt(c.quantity) || 1;
        basis += invNum(c.purchase_price) * q;
        units += q;
    });
    list.forEach(c => {
        const q = parseInt(c.quantity) || 1;
        const factor = basis > 0 ? (invNum(c.purchase_price) * q / basis) : (units > 0 ? q / units : 0);
        map[c.id] = total * factor;
    });
    return map;
}

// Aggregated totals for a whole vault / collection.
// `lotOverride` (collection lot price) replaces the sum of per-card purchase
// prices and is distributed proportionally so per-card profit stays coherent.
// The "general" figures (cost, market, saleTarget, unrealized, projected, roi)
// cover ONLY the available cards; sold / unavailable ones are reported apart.
function computeVaultTotals(cards, lotOverride) {
    const list = cards || [];
    const hasLot = lotOverride !== null && lotOverride !== undefined && lotOverride !== '' && !isNaN(invNum(lotOverride));
    const lotCosts = hasLot ? allocateLotCost(list, lotOverride) : {};
    const totals = {
        count: 0, units: 0,
        cost: 0, market: 0, saleTarget: 0,
        unrealized: 0, projected: 0, realized: 0,
        activeCount: 0, activeUnits: 0,
        soldCount: 0, soldUnits: 0, soldTotal: 0,
        soldCost: 0,
        hasLotCost: hasLot, lotCost: hasLot ? invNum(lotOverride) : null
    };

    list.forEach(card => {
        const m = computeCardMetrics(card, hasLot ? lotCosts[card.id] : undefined);
        totals.count++;
        totals.units += m.qty;
        if (m.isActive) {
            totals.activeCount++;
            totals.activeUnits += m.qty;
            totals.cost += m.cost;
            totals.market += m.market;
            totals.saleTarget += m.saleTarget;
            totals.unrealized += m.unrealized;
            totals.projected += m.projected;
        } else {
            totals.soldCount++;
            totals.soldUnits += m.isSold ? m.soldQty : m.qty;
            totals.soldCost += m.cost;
            totals.soldTotal += m.isSold ? m.soldTotal : 0;
            totals.realized += m.realized;
        }
    });

    totals.roi = totals.cost > 0 ? (totals.projected / totals.cost) * 100 : 0;
    totals.marginPct = totals.market > 0 ? ((totals.saleTarget - totals.market) / totals.market) * 100 : 0;
    totals.latentGain = totals.unrealized;
    return totals;
}

function invPlClass(v) {
    return invNum(v) >= 0 ? 'inv-pl-up' : 'inv-pl-down';
}

// Reads the optional lot price stored on a collection (null when unset).
function catLotCost(cat) {
    if (!cat) return null;
    const v = cat.total_purchase_cost;
    if (v === null || v === undefined || v === '') return null;
    const n = invNum(v);
    return isNaN(n) ? null : n;
}

// Per-card lot allocation for the currently open collection (id -> cost),
// or null when the collection has no lot price.
function currentLotMap(cards) {
    const lot = catLotCost(currentInvestmentCategory);
    if (lot === null) return null;
    return allocateLotCost(cards || localInvestmentCards, lot);
}

// Cost to use for a single card in the currently open collection.
function currentCardCost(card, lotMap) {
    return lotMap && lotMap[card.id] !== undefined ? lotMap[card.id] : undefined;
}

// Shows the collection lot price (or the per-card mode) in the vault header.
function updateVaultLotIndicators() {
    const lot = catLotCost(currentInvestmentCategory);
    const text = lot !== null
        ? `Lote: ${fmtMoney(lot)} (costo total de la colección)`
        : 'Costo por carta (sin lote definido)';
    $('#inv-desktop-lot-cost, #inv-mobile-lot-cost').text(text);
}

// Writes the current array order back as `position` (0..n-1), only for cards
// whose stored position actually changed.
async function persistInvestmentPositions() {
    const updates = [];
    localInvestmentCards.forEach((card, idx) => {
        if (invNum(card.position) !== idx) {
            card.position = idx;
            updates.push(
                _supabase.from('investment_cards').update({ position: idx }).eq('id', card.id)
            );
        }
    });
    if (!updates.length) return;
    const results = await Promise.all(updates);
    const failed = results.find(r => r && r.error);
    if (failed) console.warn('No se pudo guardar el orden:', failed.error);
}

// Moves the card at `fromIdx` so it lands on `toIdx` (used by drag & drop).
function moveInvestmentCard(fromIdx, toIdx) {
    if (fromIdx === toIdx || fromIdx < 0 || fromIdx >= localInvestmentCards.length) return false;
    const [card] = localInvestmentCards.splice(fromIdx, 1);
    const clamped = Math.max(0, Math.min(toIdx, localInvestmentCards.length));
    localInvestmentCards.splice(clamped, 0, card);
    return true;
}

// Wires drag & drop reordering onto a binder slot. turn.js is paused while
// dragging so it does not page-turn under the pointer.
function bindInvSlotDrop($slot, $album) {
    $slot.on('dragover', function(e) {
        if (!$('.inv-slot-dragging').length) return;
        e.preventDefault();
        e.originalEvent.dataTransfer.dropEffect = 'move';
        $(this).addClass('inv-slot-drop-target');
    });
    $slot.on('dragleave', function() {
        $(this).removeClass('inv-slot-drop-target');
    });
    $slot.on('drop', function(e) {
        e.preventDefault();
        $(this).removeClass('inv-slot-drop-target');
        invDragJustEnded = Date.now();
        if ($album.turn('is')) $album.turn('disable', false);
        const fromIdx = parseInt(e.originalEvent.dataTransfer.getData('text/plain'), 10);
        const toIdx = parseInt($(this).attr('data-slot-index'), 10);
        if (isNaN(fromIdx) || isNaN(toIdx)) return;
        if (moveInvestmentCard(fromIdx, toIdx)) {
            renderInvestmentCards(currentInvestmentViewMode);
            persistInvestmentPositions();
        }
    });
}

// Best-effort ledger entry (never blocks the main flow if the table is absent)
async function logInvestmentTransaction(entry) {
    try {
        await _supabase.from('investment_transactions').insert([entry]);
    } catch (e) {
        console.warn('No se pudo registrar el movimiento:', e);
    }
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}

// --- INITIALIZATION ---
$(document).ready(function() {
    initInvestmentListeners();
});

// Updates the DATOS tab mini preview ("VISTA PREVIA"). Module scope so the
// inversiones.html override can wrap it (the old nested copy was unreachable).
function syncAddPreview() {
    const url = $('#inv-card-image-url').val();
    const $img = $('#inv-add-preview-image');
    const $placeholder = $('#inv-add-preview-placeholder');

    if (url) {
        $img.attr('src', url).one('load', function() {
            $placeholder.hide();
            $(this).css('opacity', '1');
        });
    } else {
        $img.attr('src', '').css('opacity', '0');
        $placeholder.show();
    }
}

function initInvestmentListeners() {
    // Navigation to Investments (Removido para redirección nativa)

    // Back to Dashboard
    $(document).on('click', '#btn-back-to-main-from-investments', function(e) {
        e.preventDefault();
        showView('main-dashboard');
    });

    // Back to Categories from Details
    $(document).on('click', '#btn-back-to-investments, #btn-back-to-investments-mobile', function(e) {
        e.preventDefault();
        showView('investments');
        // Ensure side panel is closed
        $('#inv-mobile-side-panel, #inv-side-panel-overlay').removeClass('active');
    });

    // Mobile Side Panel Toggle
    $(document).on('click', '#inv-side-panel-tab', function() {
        $('#inv-mobile-side-panel, #inv-side-panel-overlay').toggleClass('active');
    });

    // Lot price editor (desktop header, mobile panel and card form shortcut)
    $(document).on('click', '#btn-edit-vault-lot, #btn-edit-vault-lot-mobile, #btn-inv-lot-from-card', function(e) {
        e.preventDefault();
        editVaultLotCost();
    });

    // ⓘ help: explains each metric in plain Spanish
    $(document).on('click', '.inv-info-icon', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const help = INV_METRIC_HELP[$(this).data('help')];
        if (!help) return;
        Swal.fire({
            title: help.title,
            html: `<div style="text-align:left; font-size:0.95rem; line-height:1.5; color:#333;">${help.body}</div>`,
            confirmButtonText: 'ENTENDIDO',
            customClass: { popup: 'inv-swal-popup', confirmButton: 'btn-inv-main' }
        });
    });

    $(document).on('click', '#inv-side-panel-overlay', function() {
        $('#inv-mobile-side-panel, #inv-side-panel-overlay').removeClass('active');
    });

    // Create Category with Grid Layout Selector
    $('#btn-create-investment-category').click(async function() {
        const { value: formValues } = await Swal.fire({
            title: 'NUEVO VAULT',
            html: `
                <div style="text-align: left; display: flex; flex-direction: column; gap: 15px; padding-top: 10px;">
                    <div>
                        <label style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #333; display: block; margin-bottom: 5px;">Nombre de la Colección</label>
                        <input id="swal-inv-vault-name" class="swal2-input" placeholder="Ej: POKÉMON VINTAGE HOLOS" style="margin: 0; width: 100%; box-sizing: border-box;">
                    </div>
                    <div>
                        <label style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #333; display: block; margin-bottom: 5px;">Tamaño de Carpeta (Layout)</label>
                        <select id="swal-inv-vault-layout" class="swal2-select" style="margin: 0; width: 100%; padding: 10px; border-radius: 4px; border: 1px solid #ccc; font-weight: 700;">
                            <option value="3x3" selected>3x3 (9 Cartas)</option>
                            <option value="4x3">4x3 (12 Cartas)</option>
                            <option value="4x4">4x4 (16 Cartas)</option>
                            <option value="2x2">2x2 (4 Cartas)</option>
                            <option value="1x1">1x1 (1 Carta)</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #333; display: block; margin-bottom: 5px;">Precio total de compra del lote <span style="color:#aaa; font-weight:600;">(opcional)</span></label>
                        <input id="swal-inv-vault-lot" type="number" step="0.01" min="0" class="swal2-input" placeholder="Ej: 1000 (si compraste todo junto)" style="margin: 0; width: 100%; box-sizing: border-box;">
                        <small style="display:block; color:#888; font-size:0.65rem; margin-top:4px;">Si lo defines, se usa este monto como costo total de la colección en vez de sumar el precio de cada carta.</small>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'CREAR',
            cancelButtonText: 'CANCELAR',
            customClass: {
                popup: 'inv-swal-popup',
                confirmButton: 'btn-inv-main',
                cancelButton: 'btn-inv-outline'
            },
            preConfirm: () => {
                const name = $('#swal-inv-vault-name').val().trim();
                const layout = $('#swal-inv-vault-layout').val() || '3x3';
                const lotRaw = $('#swal-inv-vault-lot').val();
                if (!name) {
                    Swal.showValidationMessage('Ingresa un nombre para la colección');
                    return false;
                }
                return { name: name.toUpperCase(), grid_layout: layout, total_purchase_cost: lotRaw === '' ? null : parseFloat(lotRaw) };
            }
        });

        if (formValues) {
            saveInvestmentCategory(formValues);
        }
    });

    // View Mode Switches
    $(document).on('click', '.btn-inv-mode', function() {
        const mode = $(this).data('mode');
        $('.btn-inv-mode').removeClass('active').css({
            'background': 'transparent',
            'color': '#666',
            'border-radius': '0px'
        });

        // Sync desktop and mobile buttons
        $(`.btn-inv-mode[data-mode="${mode}"]`).addClass('active').css({
            'background': '#000',
            'color': '#fff',
            'border-radius': '2px'
        });

        currentInvestmentViewMode = mode;
        renderInvestmentCards(mode);

        // Close side panel on mobile after selection
        if (window.innerWidth <= 768) {
            $('#inv-mobile-side-panel, #inv-side-panel-overlay').removeClass('active');
        }
    });

    // Add Card to Investment
    $(document).on('click', '#btn-add-investment-card, #btn-add-investment-card-mobile', function() {
        pendingSlotIndex = null;
        openInvestmentCardModal(null, 'inv-tab-datos');
        // Close side panel on mobile
        $('#inv-mobile-side-panel, #inv-side-panel-overlay').removeClass('active');
    });

    // Auto-clear or select-all on focus for price and quantity inputs to avoid annoying manual backspacing
    $(document).on('focus', '#inv-card-purchase-price, #inv-card-current-price, #inv-card-quantity', function() {
        const val = $(this).val().trim();
        if (val === '0' || val === '0.0' || val === '0.00' || val === '0.000') {
            $(this).val('');
        } else if (val !== '') {
            $(this).select();
        }
    });

    // Modal Tabs logic
    $(document).on('click', '#investment-card-modal .inv-tab-link', function() {
        const tabId = $(this).data('tab');
        $('#investment-card-modal .inv-tab-link').removeClass('active');
        $(this).addClass('active');
        $('#investment-card-modal .slot-tab-content').removeClass('active');
        $(`#${tabId}`).addClass('active');

        if (tabId === 'inv-tab-resumen' && currentEditingInvCardId) {
            const card = localInvestmentCards.find(c => c.id === currentEditingInvCardId);
            if (card) updateSummaryTab(card);
        }
        if (tabId === 'inv-tab-rentabilidad' && currentEditingInvCardId) {
            const card = localInvestmentCards.find(c => c.id === currentEditingInvCardId);
            if (card) renderProfitabilityTab(card);
        }
        if (tabId === 'inv-tab-datos') {
            syncAddPreview();
        }
    });

    // Mark card as sold (register the real sale)
    $(document).on('click', '#btn-inv-sell-card', async function() {
        const card = localInvestmentCards.find(c => c.id === currentEditingInvCardId);
        if (!card) return;

        const suggested = card.sale_price !== null && card.sale_price !== undefined && card.sale_price !== ''
            ? card.sale_price
            : (card.current_price || 0);

        const { value: formValues } = await Swal.fire({
            title: 'REGISTRAR VENTA',
            html: `
                <div style="text-align: left; display: flex; flex-direction: column; gap: 15px; padding-top: 10px;">
                    <div>
                        <label style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #333; display: block; margin-bottom: 5px;">Precio de venta real (unitario)</label>
                        <input id="swal-inv-sold-price" type="number" step="0.01" class="swal2-input" value="${suggested}" style="margin: 0; width: 100%; box-sizing: border-box;">
                    </div>
                    <div>
                        <label style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #333; display: block; margin-bottom: 5px;">Cantidad vendida</label>
                        <input id="swal-inv-sold-qty" type="number" min="1" class="swal2-input" value="${parseInt(card.quantity) || 1}" style="margin: 0; width: 100%; box-sizing: border-box;">
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'CONFIRMAR VENTA',
            cancelButtonText: 'CANCELAR',
            customClass: {
                popup: 'inv-swal-popup',
                confirmButton: 'btn-inv-main',
                cancelButton: 'btn-inv-outline'
            },
            preConfirm: () => {
                const price = parseFloat($('#swal-inv-sold-price').val());
                const qty = parseInt($('#swal-inv-sold-qty').val());
                if (isNaN(price) || price < 0) {
                    Swal.showValidationMessage('Ingresa un precio de venta válido');
                    return false;
                }
                if (isNaN(qty) || qty < 1) {
                    Swal.showValidationMessage('Ingresa una cantidad válida');
                    return false;
                }
                return { price, qty };
            }
        });

        if (formValues) {
            await registerCardSale(card, formValues.price, formValues.qty);
        }
    });

    // Undo a sale
    $(document).on('click', '#btn-inv-undo-sale', async function() {
        const card = localInvestmentCards.find(c => c.id === currentEditingInvCardId);
        if (!card) return;

        const { isConfirmed } = await Swal.fire({
            title: '¿REVERTIR VENTA?',
            text: 'La carta volverá a contar como activo en cartera.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'REVERTIR',
            cancelButtonText: 'CANCELAR',
            customClass: {
                popup: 'inv-swal-popup',
                confirmButton: 'btn-inv-main',
                cancelButton: 'btn-inv-outline'
            }
        });

        if (!isConfirmed) return;

        const { error } = await _supabase
            .from('investment_cards')
            .update({ is_sold: false, sold_price: null, sold_quantity: null, sold_at: null })
            .eq('id', card.id);

        if (error) {
            Swal.fire('Error', 'No se pudo revertir la venta', 'error');
            return;
        }

        const { data: updatedCard } = await _supabase.from('investment_cards').select('*').eq('id', card.id).single();
        const idx = localInvestmentCards.findIndex(c => c.id === card.id);
        if (idx !== -1) localInvestmentCards[idx] = updatedCard;

        renderInvestmentCards(currentInvestmentViewMode);
        renderProfitabilityTab(updatedCard);
        Swal.fire({ icon: 'success', title: 'Venta revertida', timer: 1200, showConfirmButton: false, customClass: { popup: 'inv-swal-popup' } });
    });

    // Vault Ledger modal
    $(document).on('click', '#close-vault-ledger', function() {
        $('#vault-ledger-modal').removeClass('active');
    });
    $(document).on('click', '#vault-ledger-modal', function(e) {
        if (e.target === this) $(this).removeClass('active');
    });

    $('#btn-inv-add-price').click(async function() {
        if (!currentEditingInvCardId) return;

        const { value: newPrice } = await Swal.fire({
            title: 'NUEVO PRECIO DE MERCADO',
            input: 'number',
            inputLabel: 'VALOR ACTUAL ($)',
            inputPlaceholder: '0.00',
            showCancelButton: true,
            confirmButtonText: 'ACTUALIZAR',
            cancelButtonText: 'CANCELAR',
            customClass: {
                popup: 'inv-swal-popup',
                confirmButton: 'btn-inv-main',
                cancelButton: 'btn-inv-outline'
            }
        });

        if (newPrice !== undefined && newPrice !== '') {
            saveNewPrice(currentEditingInvCardId, parseFloat(newPrice));
        }
    });

    // Drag & Drop for extra images
    const $dropZone = $('#drop-zone-inv-extra');
    $dropZone.on('dragover', function(e) { e.preventDefault(); $(this).addClass('dragover'); });
    $dropZone.on('dragleave', function() { $(this).removeClass('dragover'); });
    $dropZone.on('drop', async function(e) {
        e.preventDefault();
        $(this).removeClass('dragover');
        const files = e.originalEvent.dataTransfer.files;
        handleInvExtraImages(files);
    });

    $('#input-inv-extra-files').on('change', function() {
        handleInvExtraImages(this.files);
    });

    // Real-time automatic search on typing & auto-clear when search input is empty
    let invSearchDebounceTimer = null;
    $(document).on('input', '#inv-card-search-input', function() {
        clearTimeout(invSearchDebounceTimer);
        const term = $(this).val().trim();
        if (!term) {
            $('#inv-card-search-results').empty().hide();
            return;
        }
        invSearchDebounceTimer = setTimeout(() => {
            $('#btn-inv-card-search').click();
        }, 350);
    });

    // Drag & Drop for Main Image (Datos tab)
    const $dropZoneMain = $('#drop-zone-inv-main');
    $dropZoneMain.on('dragover', function(e) { e.preventDefault(); $(this).addClass('dragover'); });
    $dropZoneMain.on('dragleave', function() { $(this).removeClass('dragover'); });
    $dropZoneMain.on('drop', async function(e) {
        e.preventDefault();
        $(this).removeClass('dragover');
        const files = e.originalEvent.dataTransfer.files;
        if (files.length) handleInvMainImage(files[0]);
    });

    $('#input-inv-main-file').on('change', function() {
        if (this.files.length) handleInvMainImage(this.files[0]);
    });

    $(document).on('click', '#drop-zone-inv-main', function() {
        $('#input-inv-main-file').click();
    });

    $(document).on('change', '#inv-card-public-toggle', function() {
        const isChecked = $(this).is(':checked');
        $('#inv-card-public-status').text(isChecked ? 'PÚBLICO' : 'PRIVADO').css('color', isChecked ? '#333' : '#ff4757');
    });

    $(document).on('change', '#inv-card-available-toggle', function() {
        const isChecked = $(this).is(':checked');
        $('#inv-card-available-status').text(isChecked ? 'DISPONIBLE' : 'VENDIDO').css('color', isChecked ? '#2ed573' : '#ff4757');
    });
}

async function handleInvMainImage(file) {
    if (!file) return;
    Swal.fire({ title: 'Subiendo imagen...', didOpen: () => Swal.showLoading() });
    try {
        const url = await CloudinaryUpload.uploadImage(file);
        if (url) {
            $('#inv-card-image-url').val(url);
            syncAddPreview();
            Swal.fire({ icon: 'success', title: 'Imagen cargada', timer: 1000, showConfirmButton: false });
        }
    } catch (e) {
        console.error("Error uploading main image:", e);
        Swal.fire('Error', 'No se pudo subir la imagen', 'error');
    }
}

async function handleInvExtraImages(files) {
    if (!files.length) return;
    Swal.fire({ title: 'Subiendo imágenes...', didOpen: () => Swal.showLoading() });

    for (const file of files) {
        try {
            // Reusing cloudinary logic from js/cloudinary-upload.js
            const url = await CloudinaryUpload.uploadImage(file);
            if (url) {
                currentInvExtraImages.push(url);
            }
        } catch (e) {
            console.error("Error uploading extra image:", e);
        }
    }
    renderInvExtraImagesPreview();
    Swal.close();
}

function renderInvExtraImagesPreview() {
    const $container = $('#inv-extra-images-preview');
    $container.empty();
    currentInvExtraImages.forEach((url, idx) => {
        const $item = $(`
            <div style="position: relative; width: 80px; height: 80px;">
                <img src="${url}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">
                <button class="btn-danger" style="position: absolute; top: -5px; right: -5px; padding: 2px 5px; font-size: 10px; border-radius: 50%;" onclick="removeInvExtraImage(${idx})">&times;</button>
            </div>
        `);
        $container.append($item);
    });
}

window.removeInvExtraImage = function(idx) {
    currentInvExtraImages.splice(idx, 1);
    renderInvExtraImagesPreview();
};

// --- CATEGORY FUNCTIONS ---

async function loadInvestmentCategories() {
    if (!currentUser) return;

    $('#investment-category-list').html('<div class="loading">Cargando categorías...</div>');

    const { data: categories, error } = await _supabase
        .from('investment_categories')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('position', { ascending: true });

    if (error) {
        $('#investment-category-list').html('<div class="error">Error al cargar categorías.</div>');
        return;
    }

    if (categories.length === 0) {
        $('#investment-category-list').html('<div class="empty">No tienes categorías de inversión. Crea una para empezar.</div>');
        return;
    }

    // Load all cards for this user once so we can compute per-vault totals
    const { data: allCards } = await _supabase
        .from('investment_cards')
        .select('*')
        .eq('user_id', currentUser.id);

    const cardsByCategory = {};
    (allCards || []).forEach(c => {
        (cardsByCategory[c.category_id] = cardsByCategory[c.category_id] || []).push(c);
    });

    const $container = $('#investment-category-list');
    $container.empty();

    categories.forEach(cat => {
        const isPublic = cat.is_public !== false;
        const t = computeVaultTotals(cardsByCategory[cat.id] || [], catLotCost(cat));
        const $card = $(`
            <div class="inv-category-item" data-id="${cat.id}">
                <div class="inv-category-preview">
                    <img src="https://images.unsplash.com/photo-1613771404721-1f92d799e49f?q=80&w=800&auto=format&fit=crop" alt="preview">
                    <button class="inv-ledger-open" data-id="${cat.id}" title="Hoja de cálculo de la colección"><i class="fas fa-table"></i></button>
                </div>
                <div class="inv-category-info">
                    <div>
                        <h3>${escapeHtml(cat.name)}</h3>
                        <div class="inv-category-meta">${t.activeCount} disponible${t.activeCount === 1 ? '' : 's'} · ${t.activeUnits} unidad${t.activeUnits === 1 ? '' : 'es'}${t.soldCount > 0 ? ` · ${t.soldCount} fuera de cartera` : ''}</div>
                    </div>

                    <div class="inv-cat-metrics">
                        <div class="inv-cat-metric">
                            <span>Lo que pagué${t.hasLotCost ? ' (lote)' : ''}</span>
                            <b>${fmtMoney(t.cost)}</b>
                        </div>
                        <div class="inv-cat-metric">
                            <span>Vale hoy</span>
                            <b>${fmtMoney(t.market)}</b>
                        </div>
                        <div class="inv-cat-metric">
                            <span>Lo venderé en</span>
                            <b>${fmtMoney(t.saleTarget)}</b>
                        </div>
                        <div class="inv-cat-metric">
                            <span>Ganancia a mi precio</span>
                            <b class="${invPlClass(t.projected)}">${fmtSignedMoney(t.projected)}</b>
                        </div>
                    </div>

                    <div class="inv-category-public-toggle">
                        <label class="switch">
                            <input type="checkbox" class="toggle-inv-cat-public" data-id="${cat.id}" ${isPublic ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                        <span style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em;">${isPublic ? 'Público' : 'Privado'}</span>
                    </div>

                    <div style="display: flex; gap: 8px; margin-top: 15px;">
                        <button class="btn-inv-main btn-view-inv-cat" style="flex: 1;">GESTIONAR</button>
                        <button class="btn-inv-outline btn-ledger-inv-cat" title="Hoja de cálculo"><i class="fas fa-table"></i></button>
                        <button class="btn-inv-outline btn-edit-inv-cat"><i class="fas fa-pen"></i></button>
                        <button class="btn-inv-danger btn-delete-inv-cat"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `);

        $card.find('.btn-view-inv-cat').click(() => openInvestmentCategory(cat));
        $card.find('.btn-edit-inv-cat').click(() => editInvestmentCategory(cat));
        $card.find('.btn-delete-inv-cat').click(() => deleteInvestmentCategory(cat.id));
        $card.find('.btn-ledger-inv-cat, .inv-ledger-open').click((e) => {
            e.stopPropagation();
            openVaultLedger(cat);
        });
        $card.find('.toggle-inv-cat-public').change(function() {
            updateInvestmentCategory(cat.id, { is_public: $(this).is(':checked') });
        });

        $container.append($card);
    });
}

async function saveInvestmentCategory(data) {
    Swal.fire({
        title: 'CREATING VAULT...',
        didOpen: () => Swal.showLoading(),
        customClass: { popup: 'inv-swal-popup' }
    });

    if (data.is_public === undefined) {
        data.is_public = true;
    }

    let { error } = await _supabase
        .from('investment_categories')
        .insert([{ ...data, user_id: currentUser.id }]);

    // If an optional column is missing in the DB, retry without it so the
    // vault is still created (the SQL migration can be run later).
    if (error && (error.code === '42703' || (error.message && (error.message.includes('grid_layout') || error.message.includes('total_purchase_cost'))))) {
        const fallbackData = { ...data };
        delete fallbackData.grid_layout;
        delete fallbackData.total_purchase_cost;
        const res = await _supabase
            .from('investment_categories')
            .insert([{ ...fallbackData, user_id: currentUser.id }]);
        error = res.error;
    }

    Swal.close();
    if (error) {
        Swal.fire('Error', 'No se pudo crear la categoría', 'error');
    } else {
        loadInvestmentCategories();
    }
}

async function updateInvestmentCategory(id, data, refresh = false) {
    let { error } = await _supabase
        .from('investment_categories')
        .update(data)
        .eq('id', id);

    if (error && (error.code === '42703' || (error.message && (error.message.includes('grid_layout') || error.message.includes('total_purchase_cost'))))) {
        const fallbackData = { ...data };
        delete fallbackData.grid_layout;
        delete fallbackData.total_purchase_cost;
        const res = await _supabase
            .from('investment_categories')
            .update(fallbackData)
            .eq('id', id);
        error = res.error;
    }

    if (error) {
        Swal.fire({
            title: 'ERROR',
            text: 'Could not update vault.',
            icon: 'error',
            customClass: { popup: 'inv-swal-popup' }
        });
    } else {
        if (currentInvestmentCategory && currentInvestmentCategory.id === id) {
            Object.assign(currentInvestmentCategory, data);
        }
        if (refresh) {
            loadInvestmentCategories();
            if ($('#view-investment-details').is(':visible') && currentInvestmentCategoryId === id) {
                loadInvestmentCards();
            }
        }
    }
}

async function editInvestmentCategory(cat) {
    const currentLayout = cat.grid_layout || '3x3';
    const currentLot = (cat.total_purchase_cost !== null && cat.total_purchase_cost !== undefined) ? cat.total_purchase_cost : '';
    const { value: formValues } = await Swal.fire({
        title: 'EDITAR VAULT',
        html: `
            <div style="text-align: left; display: flex; flex-direction: column; gap: 15px; padding-top: 10px;">
                <div>
                    <label style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #333; display: block; margin-bottom: 5px;">Nombre de la Colección</label>
                    <input id="swal-inv-vault-name" class="swal2-input" value="${escapeHtml(cat.name)}" placeholder="Ej: POKÉMON VINTAGE HOLOS" style="margin: 0; width: 100%; box-sizing: border-box;">
                </div>
                <div>
                    <label style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #333; display: block; margin-bottom: 5px;">Tamaño de Carpeta (Layout)</label>
                    <select id="swal-inv-vault-layout" class="swal2-select" style="margin: 0; width: 100%; padding: 10px; border-radius: 4px; border: 1px solid #ccc; font-weight: 700;">
                        <option value="3x3" ${currentLayout === '3x3' ? 'selected' : ''}>3x3 (9 Cartas)</option>
                        <option value="4x3" ${currentLayout === '4x3' ? 'selected' : ''}>4x3 (12 Cartas)</option>
                        <option value="4x4" ${currentLayout === '4x4' ? 'selected' : ''}>4x4 (16 Cartas)</option>
                        <option value="2x2" ${currentLayout === '2x2' ? 'selected' : ''}>2x2 (4 Cartas)</option>
                        <option value="1x1" ${currentLayout === '1x1' ? 'selected' : ''}>1x1 (1 Carta)</option>
                    </select>
                </div>
                <div>
                    <label style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #333; display: block; margin-bottom: 5px;">Precio total de compra del lote <span style="color:#aaa; font-weight:600;">(opcional)</span></label>
                    <input id="swal-inv-vault-lot" type="number" step="0.01" min="0" class="swal2-input" value="${currentLot}" placeholder="Vacío = suma por carta" style="margin: 0; width: 100%; box-sizing: border-box;">
                    <small style="display:block; color:#888; font-size:0.65rem; margin-top:4px;">Si lo defines, se usa este monto como costo total de la colección en vez de sumar el precio de cada carta. Déjalo vacío para volver al cálculo por carta.</small>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'ACTUALIZAR',
        cancelButtonText: 'CANCELAR',
        customClass: {
            popup: 'inv-swal-popup',
            confirmButton: 'btn-inv-main',
            cancelButton: 'btn-inv-outline'
        },
        preConfirm: () => {
            const name = $('#swal-inv-vault-name').val().trim();
            const layout = $('#swal-inv-vault-layout').val() || '3x3';
            const lotRaw = $('#swal-inv-vault-lot').val();
            if (!name) {
                Swal.showValidationMessage('Ingresa un nombre para la colección');
                return false;
            }
            return { name: name.toUpperCase(), grid_layout: layout, total_purchase_cost: lotRaw === '' ? null : parseFloat(lotRaw) };
        }
    });

    if (formValues) {
        updateInvestmentCategory(cat.id, formValues, true);
    }
}

// Quick editor for the collection lot price, reachable from inside the binder.
async function editVaultLotCost() {
    if (!currentInvestmentCategory) return;
    const cat = currentInvestmentCategory;
    const currentLot = (cat.total_purchase_cost !== null && cat.total_purchase_cost !== undefined) ? cat.total_purchase_cost : '';
    const { value: lotRaw } = await Swal.fire({
        title: 'PRECIO DEL LOTE',
        html: `
            <div style="text-align: left; padding-top: 10px;">
                <label style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #333; display: block; margin-bottom: 5px;">Precio total de compra de la colección</label>
                <input id="swal-inv-lot-only" type="number" step="0.01" min="0" class="swal2-input" value="${currentLot}" placeholder="Ej: 1000" style="margin: 0; width: 100%; box-sizing: border-box;">
                <small style="display:block; color:#888; font-size:0.65rem; margin-top:6px;">Si compraste todas las cartas juntas por un solo precio, escríbelo aquí. Se usará como costo total de la colección. Déjalo vacío para volver a sumar el precio de cada carta.</small>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'GUARDAR',
        cancelButtonText: 'CANCELAR',
        customClass: {
            popup: 'inv-swal-popup',
            confirmButton: 'btn-inv-main',
            cancelButton: 'btn-inv-outline'
        },
        preConfirm: () => {
            const raw = $('#swal-inv-lot-only').val();
            return { total_purchase_cost: raw === '' ? null : parseFloat(raw) };
        }
    });

    if (lotRaw) {
        await updateInvestmentCategory(cat.id, lotRaw, true);
    }
}

async function deleteInvestmentCategory(id) {
    const { isConfirmed } = await Swal.fire({
        title: 'DESTROY VAULT?',
        text: 'All assets inside this collection will be permanently removed.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'CONFIRM DESTRUCTION',
        cancelButtonText: 'CANCEL',
        customClass: {
            popup: 'inv-swal-popup',
            confirmButton: 'btn-inv-danger',
            cancelButton: 'btn-inv-outline'
        }
    });

    if (isConfirmed) {
        const { error } = await _supabase.from('investment_categories').delete().eq('id', id);
        if (error) {
            Swal.fire({
                title: 'ERROR',
                text: 'Could not delete vault.',
                icon: 'error',
                customClass: { popup: 'inv-swal-popup' }
            });
        } else {
            loadInvestmentCategories();
        }
    }
}

// --- CARD FUNCTIONS ---

async function openInvestmentCategory(cat) {
    currentInvestmentCategory = cat;
    currentInvestmentCategoryId = cat.id;
    const upperName = cat.name.toUpperCase();
    $('#inv-category-title').text(upperName);
    $('#inv-category-title-mobile').text(upperName);
    showView('investment-details');
    loadInvestmentCards();
}

async function loadInvestmentCards() {
    $('#investment-card-container').html('<div class="loading">Cargando cartas...</div>');

    if (currentInvestmentCategoryId) {
        const { data: catData } = await _supabase
            .from('investment_categories')
            .select('*')
            .eq('id', currentInvestmentCategoryId)
            .single();
        if (catData) {
            currentInvestmentCategory = catData;
            const upperName = catData.name.toUpperCase();
            $('#inv-category-title').text(upperName);
            $('#inv-category-title-mobile').text(upperName);
        }
    }

    updateVaultLotIndicators();

    const { data: cards, error } = await _supabase
        .from('investment_cards')
        .select('*')
        .eq('category_id', currentInvestmentCategoryId)
        .order('position', { ascending: true });

    if (error) {
        $('#investment-card-container').html('<div class="error">Error al cargar cartas.</div>');
        return;
    }

    localInvestmentCards = cards || [];
    renderInvestmentCards(currentInvestmentViewMode);
}

function renderInvestmentCards(mode) {
    const $container = $('#investment-card-container');
    $container.empty();

    if (mode === 'album') {
        renderAlbumMode($container);
    } else if (mode === 'slide') {
        if (localInvestmentCards.length === 0) {
            $container.html('<div class="empty" style="text-align: center; padding: 40px; color: #888; font-weight: 700; text-transform: uppercase;">No hay activos en este vault.</div>');
            return;
        }
        renderSlideMode($container);
    } else {
        if (localInvestmentCards.length === 0) {
            $container.html('<div class="empty" style="text-align: center; padding: 40px; color: #888; font-weight: 700; text-transform: uppercase;">No hay activos en este vault.</div>');
            return;
        }
        renderListMode($container);
    }
}

function getTrendIcon(current, previous, showPercentage = false) {
    if (previous === undefined || previous === null || current === previous || previous === 0) return '';
    const isUp = current > previous;
    const iconClass = isUp ? 'fa-arrow-up' : 'fa-arrow-down';
    const color = isUp ? '#00ff88' : '#ff4757';
    let html = `<i class="fas ${iconClass} inv-trend-icon" style="color: ${color};"></i>`;

    if (showPercentage) {
        const percent = ((current - previous) / previous) * 100;
        const sign = percent > 0 ? '+' : '';
        html += `<span style="color: ${color}; font-weight: 800; font-size: 1rem; margin-left: 5px;">${sign}${percent.toFixed(2)}%</span>`;
    }

    return html;
}

function renderAlbumMode($container) {
    $container.addClass('investment-album-layout').removeClass('investment-list-layout investment-slide-layout');
    const { width, height } = window.getAlbumSize($container);
    const $albumWrapper = $(`<div class="album-wrapper" style="width: ${width}px; height: ${height}px;"><div class="album investment-album"></div></div>`);
    const $album = $albumWrapper.find('.album');

    $container.append($albumWrapper);

    const gridLayout = (currentInvestmentCategory && currentInvestmentCategory.grid_layout) ? currentInvestmentCategory.grid_layout : '3x3';
    let numSlots = 9;
    if (gridLayout === '4x3') numSlots = 12;
    else if (gridLayout === '4x4') numSlots = 16;
    else if (gridLayout === '2x2') numSlots = 4;
    else if (gridLayout === '1x1') numSlots = 1;

    // Minimum 5 pages (hojas)
    const cardPages = Math.ceil(localInvestmentCards.length / numSlots) || 1;
    const totalPages = Math.max(5, cardPages);

    // Front Cover with Space/Cosmic Particles and no title/text
    $album.append(`
        <div class="page cover-page">
            <div class="textured-cover style-cosmic" style="background-color: #000000; width: 100%; height: 100%; border: none;"></div>
        </div>
    `);

    // Inner Pages with visible slots
    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        const $page = $('<div class="page album-page"></div>');
        const $grid = $(`<div class="grid-container grid-layout-${gridLayout}"></div>`);

        for (let slotIdx = 0; slotIdx < numSlots; slotIdx++) {
            const cardIdx = pageIdx * numSlots + slotIdx;
            const card = localInvestmentCards[cardIdx];
            const $slot = $('<div class="inv-card-slot card-slot" style="position: relative;"></div>');
            $slot.attr('data-slot-index', cardIdx);

            if (card) {
                const trend = getTrendIcon(card.current_price, card.previous_price);
                const isPrivate = card.is_public === false;
                const isUnavailable = card.is_available === false;
                const privateBadge = isPrivate ? `<div class="inv-card-private-badge" style="position: absolute; top: 5px; right: 5px; background: rgba(255, 71, 87, 0.9); color: #fff; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: 800; z-index: 115;" title="Privado (Oculto en link público)"><i class="fas fa-lock"></i></div>` : '';
                const stampOverlay = isUnavailable ? `<div class="inv-stamp-unavailable">VENDIDO</div>` : '';

                $slot.append(`
                    <img src="${card.image_url}" class="tcg-card" style="border-radius: 4px; border: 1px solid #000; width: 100%; height: 100%; object-fit: contain; position: relative; z-index: 1;">
                    ${stampOverlay}
                    ${privateBadge}
                    <div class="inv-card-info-badge" style="z-index: 110;">$${parseFloat(card.current_price || 0).toFixed(2)} ${trend}</div>
                    <div class="zoom-btn" style="z-index: 110;"><i class="fas fa-search"></i></div>
                `);

                $slot.find('.zoom-btn').on('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    openInvestmentCardModal(card);
                }).on('mousedown touchstart', (e) => {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                });

                $slot.attr('draggable', 'true');
                $slot.on('dragstart', function(e) {
                    invDragJustEnded = 0;
                    e.originalEvent.dataTransfer.setData('text/plain', String(cardIdx));
                    e.originalEvent.dataTransfer.effectAllowed = 'move';
                    $(this).addClass('inv-slot-dragging');
                    if ($album.turn('is')) $album.turn('disable', true);
                });
                $slot.on('dragend', function() {
                    invDragJustEnded = Date.now();
                    $(this).removeClass('inv-slot-dragging');
                    $('.inv-slot-drop-target').removeClass('inv-slot-drop-target');
                    if ($album.turn('is')) $album.turn('disable', false);
                });

                $slot.click(function(e) {
                    if (Date.now() - invDragJustEnded < 400) return;
                    const isMobile = window.innerWidth <= 768;
                    const isZoomBtn = $(e.target).closest('.zoom-btn').length > 0;

                    if (isMobile) {
                        if (isZoomBtn) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    } else {
                        if (!isZoomBtn) {
                            openInvestmentCardModal(card);
                        }
                    }
                });
            } else {
                // Empty visible slot
                $slot.addClass('empty-inv-slot').css({
                    'border': '2px dashed rgba(0,0,0,0.15)',
                    'border-radius': '4px',
                    'display': 'flex',
                    'flex-direction': 'column',
                    'align-items': 'center',
                    'justify-content': 'center',
                    'background': 'rgba(0,0,0,0.02)',
                    'cursor': 'pointer',
                    'transition': 'all 0.2s ease',
                    'min-height': '60px'
                }).html(`
                    <i class="fas fa-plus" style="color: #888; font-size: 1rem; margin-bottom: 3px;"></i>
                    <span style="font-size: 0.6rem; color: #888; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">AÑADIR</span>
                `);

                $slot.click(function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    pendingSlotIndex = cardIdx;
                    openInvestmentCardModal(null, 'inv-tab-datos');
                });
            }

            bindInvSlotDrop($slot, $album);

            $grid.append($slot);
        }

        $page.append($grid);
        $album.append($page);
    }

    // Add empty page if needed for double display pairing
    const innerPagesCount = $album.find('.album-page').length;
    if (innerPagesCount % 2 !== 0) {
        const $fillerPage = $('<div class="page album-page"></div>');
        const $grid = $(`<div class="grid-container grid-layout-${gridLayout}"></div>`);
        for (let slotIdx = 0; slotIdx < numSlots; slotIdx++) {
            const $slot = $('<div class="inv-card-slot card-slot empty-inv-slot" style="position: relative; border: 2px dashed rgba(0,0,0,0.15); border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.02); cursor: pointer; transition: all 0.2s ease; min-height: 60px;"></div>').html(`
                <i class="fas fa-plus" style="color: #888; font-size: 1rem; margin-bottom: 3px;"></i>
                <span style="font-size: 0.6rem; color: #888; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">AÑADIR</span>
            `);
            // Filler slots sit past the last card: they only append.
            $slot.attr('data-slot-index', localInvestmentCards.length);
            $slot.click(function(e) {
                e.preventDefault();
                e.stopPropagation();
                pendingSlotIndex = localInvestmentCards.length;
                openInvestmentCardModal(null, 'inv-tab-datos');
            });
            bindInvSlotDrop($slot, $album);
            $grid.append($slot);
        }
        $fillerPage.append($grid);
        $album.append($fillerPage);
    }

    // Back Cover with Space/Cosmic Particles
    $album.append(`
        <div class="page cover-page">
            <div class="textured-cover style-cosmic" style="background-color: #000000; width: 100%; height: 100%; border: none;"></div>
        </div>
    `);

    setTimeout(() => {
        if ($album.turn('is')) {
            $album.turn('destroy');
        }
        $album.turn({
            width: width,
            height: height,
            autoCenter: true,
            display: 'double',
            gradients: false,
            acceleration: true,
            elevation: 50,
            duration: 800,
            when: {
                turning: function(e, page, view) {
                    $(this).css('position', 'relative');
                }
            }
        });

        $album.css({
            'margin-left': 'auto',
            'margin-right': 'auto'
        });
    }, 200);
}

function renderSlideMode($container) {
    $container.addClass('investment-slide-layout').removeClass('investment-list-layout investment-album-layout');
    const isMobile = window.innerWidth <= 768;
    const swiperId = `inv-swiper-${Date.now()}`;
    const swiperWidth = isMobile ? '82vw' : '350px';
    const swiperHeight = isMobile ? '60vh' : '500px';

    const $swiper = $(`
        <div class="swiper ${swiperId}" style="width: 100%; max-width: ${swiperWidth}; margin: 0 auto; height: ${swiperHeight}; padding: 20px 0;">
            <div class="swiper-wrapper"></div>
        </div>
    `);

    localInvestmentCards.forEach(card => {
        const isPrivate = card.is_public === false;
        const isUnavailable = card.is_available === false;
        const privateBadge = isPrivate ? `<div class="inv-card-private-badge" style="position: absolute; top: 10px; right: 10px; background: rgba(255, 71, 87, 0.9); color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; z-index: 115;" title="Privado (Oculto en link público)"><i class="fas fa-lock"></i> PRIVADO</div>` : '';
        const stampOverlay = isUnavailable ? `<div class="inv-stamp-unavailable">VENDIDO</div>` : '';

        const $slide = $(`
            <div class="swiper-slide inv-card-slot inv-card-item" data-id="${card.id}" style="background: transparent; cursor: pointer; position: relative; display: flex; align-items: center; justify-content: center; height: 100%;">
                <img src="${card.image_url}" style="width: auto; max-width: 100%; height: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; border: 2px solid #000; box-shadow: 0 20px 40px rgba(0,0,0,0.3); position: relative; z-index: 1; display: block; margin: 0 auto;">
                ${stampOverlay}
                ${privateBadge}
            </div>
        `);

        $swiper.find('.swiper-wrapper').append($slide);
    });

    $container.append($swiper);

    let lastOpenTime = 0;
    const tryOpenModal = (cardId) => {
        const now = Date.now();
        if (now - lastOpenTime < 400) return;
        lastOpenTime = now;
        const card = localInvestmentCards.find(c => String(c.id) === String(cardId));
        if (card) {
            openInvestmentCardModal(card);
        }
    };

    let startX = 0, startY = 0;
    $swiper.on('pointerdown touchstart', '.inv-card-item', function(e) {
        const touch = e.originalEvent && e.originalEvent.touches ? e.originalEvent.touches[0] : e;
        startX = touch.clientX || 0;
        startY = touch.clientY || 0;
    });

    $swiper.on('pointerup touchend click', '.inv-card-item', function(e) {
        if ($(e.target).closest('button').length) return;
        const touch = e.originalEvent && e.originalEvent.changedTouches ? e.originalEvent.changedTouches[0] : e;
        const endX = touch.clientX !== undefined ? touch.clientX : startX;
        const endY = touch.clientY !== undefined ? touch.clientY : startY;
        const dist = Math.hypot(endX - startX, endY - startY);
        if (dist < 15) {
            const id = $(this).attr('data-id');
            if (id) {
                tryOpenModal(id);
            }
        }
    });

    const invSwiper = new Swiper(`.${swiperId}`, {
        effect: "cards",
        grabCursor: true,
        centeredSlides: true,
        slidesPerView: 'auto',
        threshold: 8,
        preventClicks: false,
        preventClicksPropagation: false,
        on: {
            click: function(swiper, event) {
                const targetSlide = swiper.clickedSlide || (event && event.target ? event.target.closest('.inv-card-item') : null);
                if (targetSlide && !(event && event.target && event.target.closest('button'))) {
                    const id = $(targetSlide).attr('data-id');
                    if (id) {
                        tryOpenModal(id);
                    }
                }
            }
        }
    });
}

// "Hoja de cálculos": a clear, spreadsheet-like panel shown above the card
// list. Every figure refers ONLY to the available cards; sold / unavailable
// ones are summarised apart so the general numbers are always understandable.
function renderCalcSheet(totals) {
    const none = totals.activeCount === 0;
    const card = (key, label, value, cls = '') => `
        <div class="inv-calc-card">
            <div class="inv-calc-card-label">${label}${invInfoIcon(key)}</div>
            <div class="inv-calc-card-value ${cls}">${value}</div>
        </div>`;

    return `
        <div class="inv-calc-sheet">
            <div class="inv-calc-head">
                <div>
                    <div class="inv-calc-eyebrow"><i class="fas fa-table"></i> HOJA DE CÁLCULOS</div>
                    <div class="inv-calc-title">Resumen de tus cartas disponibles</div>
                </div>
                <div class="inv-calc-chips">
                    <span class="inv-calc-chip"><i class="fas fa-layer-group"></i> ${totals.activeCount} disponible${totals.activeCount === 1 ? '' : 's'} · ${totals.activeUnits} u.</span>
                    ${totals.soldCount > 0 ? `<span class="inv-calc-chip inv-calc-chip-muted"><i class="fas fa-box-archive"></i> ${totals.soldCount} fuera de cartera${invInfoIcon('sold')}</span>` : ''}
                </div>
            </div>
            ${none ? '<div class="inv-calc-empty">Todavía no tienes cartas disponibles en esta colección. Las vendidas o no disponibles no entran en estos cálculos.</div>' : `
            <div class="inv-calc-grid">
                ${card('cost', 'LO QUE PAGUÉ', fmtMoney(totals.cost))}
                ${card('market', 'VALE HOY EN EL MERCADO', fmtMoney(totals.market))}
                ${card('saleTarget', 'LO VENDERÉ EN', fmtMoney(totals.saleTarget))}
                ${card('unrealized', 'GANANCIA AL PRECIO DE MERCADO', fmtSignedMoney(totals.unrealized), invPlClass(totals.unrealized))}
                ${card('projected', 'GANANCIA AL PRECIO DE VENTA', fmtSignedMoney(totals.projected), invPlClass(totals.projected))}
                ${card('margin', 'MARGEN SOBRE EL MERCADO', `${fmtSignedMoney(totals.saleTarget - totals.market)} (${fmtPct(totals.marginPct)})`, invPlClass(totals.saleTarget - totals.market))}
                ${card('roi', 'RENDIMIENTO SOBRE LO INVERTIDO', fmtPct(totals.roi), invPlClass(totals.roi))}
            </div>`}
            <div class="inv-calc-sold">
                <div class="inv-calc-sold-item"><span>Ganancia ya realizada (ventas)${invInfoIcon('realized')}</span><b class="${invPlClass(totals.realized)}">${fmtSignedMoney(totals.realized)}</b></div>
                <div class="inv-calc-sold-item"><span>Vendidas / fuera de cartera</span><b>${totals.soldCount}</b></div>
            </div>
        </div>
    `;
}

function renderListMode($container) {
    $container.addClass('investment-list-layout').removeClass('investment-slide-layout investment-album-layout');

    // "Hoja de cálculos" for the available cards
    const totals = computeVaultTotals(localInvestmentCards, catLotCost(currentInvestmentCategory));
    const $summary = $(renderCalcSheet(totals));

    const $list = $('<div class="inv-list-container" style="margin: 20px 0;"></div>');

    const listLotMap = currentLotMap(localInvestmentCards);
    localInvestmentCards.forEach(card => {
        const m = computeCardMetrics(card, currentCardCost(card, listLotMap));
        const trend = getTrendIcon(card.current_price, card.previous_price);
        const isPrivate = card.is_public === false;
        const isUnavailable = card.is_available === false;
        const privateBadge = isPrivate ? `<span style="background: rgba(255, 71, 87, 0.1); color: #ff4757; border: 1px solid #ff4757; padding: 2px 6px; border-radius: 3px; font-size: 0.65rem; font-weight: 800; margin-left: 8px;"><i class="fas fa-lock"></i> PRIVADO</span>` : '';
        const unavailableBadge = isUnavailable ? `<span style="background: rgba(0, 0, 0, 0.85); color: #ff3344; border: 1px solid #ff3344; padding: 2px 6px; border-radius: 3px; font-size: 0.65rem; font-weight: 800; margin-left: 8px;"><i class="fas fa-ban"></i> VENDIDO</span>` : '';
        const soldBadge = m.isSold ? `<span class="inv-sold-badge"><i class="fas fa-check-circle"></i> VENDIDA</span>` : '';
        const stampOverlay = isUnavailable ? `<div class="inv-stamp-unavailable" style="font-size: 0.65rem; padding: 2px 6px;">VENDIDO</div>` : '';

        const $item = $(`
            <div class="inv-list-item ${m.isActive ? '' : 'inv-list-item-out'}" style="border: 1px solid #eee; border-radius: 4px; padding: 15px; background: white; margin-bottom: 10px; display: flex; align-items: center; gap: 20px; cursor: pointer;">
                <div class="inv-list-img-wrapper" style="position: relative; width: 60px; height: 84px; flex-shrink: 0;">
                    <img src="${card.image_url}" class="inv-list-thumb" style="width: 100%; height: 100%; object-fit: contain; border: 1px solid #000; border-radius: 2px; position: relative; z-index: 1;">
                    ${stampOverlay}
                </div>
                <div class="inv-list-details" style="flex: 1; min-width: 0;">
                    <div class="inv-list-name" style="font-weight: 800; text-transform: uppercase; font-size: 0.9rem; color: #000; display: flex; align-items: center; flex-wrap: wrap;">${escapeHtml(card.card_name)} ${privateBadge} ${unavailableBadge} ${soldBadge}</div>
                    <div class="inv-list-set" style="font-size: 0.7rem; color: #666; font-weight: 700; text-transform: uppercase;">${escapeHtml(card.set_name)} - ${escapeHtml(card.rarity)} · x${m.qty}</div>
                </div>
                <div class="inv-list-metrics">
                    <div class="inv-metric-cell">
                        <span>Lo que pagué</span>
                        <b>${fmtMoney(m.cost)}</b>
                    </div>
                    <div class="inv-metric-cell">
                        <span>Vale hoy (mercado)</span>
                        <b>${fmtMoney(m.market)} ${trend}</b>
                    </div>
                    <div class="inv-metric-cell">
                        <span>Lo venderé en</span>
                        <b>${fmtMoney(m.saleTarget)}</b>
                    </div>
                    <div class="inv-metric-cell">
                        <span>Ganancia a mercado</span>
                        <b class="${invPlClass(m.unrealized)}">${fmtSignedMoney(m.unrealized)}</b>
                    </div>
                    <div class="inv-metric-cell">
                        <span>Ganancia a mi precio</span>
                        <b class="${invPlClass(m.projected)}">${fmtSignedMoney(m.projected)}</b>
                    </div>
                    <div class="inv-metric-cell">
                        <span>Margen vs mercado</span>
                        <b class="${invPlClass(m.marginVsMarket)}">${fmtSignedMoney(m.marginVsMarket)} (${fmtPct(m.marginPct)})</b>
                    </div>
                </div>
                <div class="inv-list-actions" style="display: flex; gap: 8px; flex-direction: column;">
                    <button class="btn-inv-outline btn-edit-inv-card" data-id="${card.id}" style="padding: 8px 12px;"><i class="fas fa-pen"></i></button>
                    <button class="btn-inv-danger btn-delete-inv-card" data-id="${card.id}" style="padding: 8px 12px;"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `);

        $item.click((e) => {
            if ($(e.target).closest('button').length) return;
            e.preventDefault();
            e.stopPropagation();
            openInvestmentCardModal(card);
        });
        $item.find('.btn-edit-inv-card').click((e) => { e.stopPropagation(); openInvestmentCardModal(card); });
        $item.find('.btn-delete-inv-card').click((e) => { e.stopPropagation(); deleteInvestmentCard(card.id); });
        $list.append($item);
    });
    $container.append($summary);
    $container.append($list);
}

// --- CARD MODAL & API ---

let currentEditingInvCardId = null;

// Shows the lot allocation hint under the card purchase price field.
function updateCardLotHint(card) {
    const $hint = $('#inv-card-lot-hint');
    const lot = catLotCost(currentInvestmentCategory);
    if (lot === null) {
        $hint.hide().text('');
        return;
    }
    let assigned = '';
    if (card && card.id) {
        const map = currentLotMap(localInvestmentCards);
        if (map && map[card.id] !== undefined) assigned = ` · Esta carta: ${fmtMoney(map[card.id])}`;
    }
    $hint.text(`Lote de la colección: ${fmtMoney(lot)}${assigned}`).show();
}

function openInvestmentCardModal(card = null, defaultTab = 'inv-tab-resumen') {
    if (window.sharedCard3D) window.sharedCard3D.stop();

    // Opening an existing asset never uses the "chosen slot" of a new one.
    if (card) pendingSlotIndex = null;

    currentEditingInvCardId = card ? card.id : null;
    currentInvExtraImages = card ? (card.extra_images || []) : [];

    // Reset Tabs visibility and active state
    $('#investment-card-modal .inv-tab-link').removeClass('active').show();
    $('#investment-card-modal .slot-tab-content').removeClass('active');

    if (!card) {
        // New Card Mode: Hide RESUMEN, RENTABILIDAD and MOVIMIENTOS tabs until created
        $('#inv-card-modal-title').text('AÑADIR NUEVO ACTIVO');
        $('#investment-card-modal .inv-tab-link[data-tab="inv-tab-resumen"]').hide();
        $('#investment-card-modal .inv-tab-link[data-tab="inv-tab-rentabilidad"]').hide();
        $('#investment-card-modal .inv-tab-link[data-tab="inv-tab-movimientos"]').hide();
        $('#inv-card-search-container').show();

        // Reset previews
        $('#inv-detail-image').attr('src', '').css('opacity', '0');
        $('#inv-main-image-status').hide();

        // Default to DATOS tab for new assets
        $(`#investment-card-modal .inv-tab-link[data-tab="inv-tab-datos"]`).addClass('active');
        $('#inv-tab-datos').addClass('active');

        // Clear Fields for clean state without pre-filled '0's
        $('#inv-card-name').val('').prop('readonly', false);
        $('#inv-card-purchase-price').val('');
        $('#inv-card-current-price').val('');
        $('#inv-card-sale-price').val('');
        $('#inv-card-quantity').val(1);
        $('#inv-card-rarity-input').val('');
        $('#inv-card-notes').val('');
        $('#inv-card-external-id, #inv-card-image-url, #inv-card-set-name, #inv-card-set-number, #inv-card-rarity').val('');
        $('#inv-card-game').val('pokemon');

        $('#inv-card-public-toggle').prop('checked', true);
        $('#inv-card-public-status').text('PÚBLICO').css('color', '#333');
        $('#inv-card-available-toggle').prop('checked', true);
        $('#inv-card-available-status').text('DISPONIBLE').css('color', '#2ed573');

        // Cleanup search
        $('#inv-card-search-results').empty().hide();
        $('#inv-card-search-input').val('');

        updateCardLotHint(null);
    } else {
        // Edit / View Mode: Show all tabs
        $('#inv-card-modal-title').text(card.card_name.toUpperCase());
        $('#inv-card-search-container').show();
        $('#inv-card-name').prop('readonly', false);
        $('#inv-main-image-status').hide();

        // Set requested tab or default to resumen
        $(`#investment-card-modal .inv-tab-link[data-tab="${defaultTab}"]`).addClass('active');
        $(`#${defaultTab}`).addClass('active');

        // Populate Metadata Fields
        $('#inv-card-name').val(card.card_name ? card.card_name.toUpperCase() : '');
        $('#inv-card-purchase-price').val(card.purchase_price !== null && card.purchase_price !== undefined ? card.purchase_price : '');
        $('#inv-card-current-price').val(card.current_price !== null && card.current_price !== undefined ? card.current_price : '');
        $('#inv-card-sale-price').val(card.sale_price !== null && card.sale_price !== undefined ? card.sale_price : '');
        $('#inv-card-quantity').val(card.quantity || 1);
        $('#inv-card-rarity-input').val(card.rarity || '');
        $('#inv-card-notes').val(card.notes || '');

        $('#inv-card-external-id').val(card.external_id || '');
        $('#inv-card-image-url').val(card.image_url || '');
        $('#inv-card-set-name').val(card.set_name || '');
        $('#inv-card-set-number').val(card.set_number || '');
        $('#inv-card-rarity').val(card.rarity || '');
        $('#inv-card-game').val(card.tcg_game || 'pokemon');

        const isPublic = card.is_public !== false;
        const isAvailable = card.is_available !== false;
        $('#inv-card-public-toggle').prop('checked', isPublic);
        $('#inv-card-public-status').text(isPublic ? 'PÚBLICO' : 'PRIVADO').css('color', isPublic ? '#333' : '#ff4757');
        $('#inv-card-available-toggle').prop('checked', isAvailable);
        $('#inv-card-available-status').text(isAvailable ? 'DISPONIBLE' : 'VENDIDO').css('color', isAvailable ? '#2ed573' : '#ff4757');

        if (defaultTab === 'inv-tab-resumen') {
            updateSummaryTab(card);
        }
        if (defaultTab === 'inv-tab-rentabilidad') {
            renderProfitabilityTab(card);
        }

        updateCardLotHint(card);
    }

    renderInvExtraImagesPreview();
    syncAddPreview();
    $('#investment-card-modal').addClass('active');
}

$('#close-investment-card-modal').click(() => {
    $('#investment-card-modal').removeClass('active');
    pendingSlotIndex = null;
    if (invPriceChart) { invPriceChart.destroy(); invPriceChart = null; }
    if (window.sharedCard3D) window.sharedCard3D.stop();
    $('#companion-wrapper').show();
});

$('#btn-inv-card-search').click(async function() {
    $('#inv-card-search-results').show();
    window.searchExternalCard('#inv-card-search-input', '#inv-card-search-results', async function(card) {
        // When a card is selected from combined search
        const finalUrl = card.high_res || card.image;
        $('#inv-card-name').val(card.name.toUpperCase());
        $('#inv-card-image-url').val(finalUrl);

        $('#inv-card-set-name').val(card.set || card.set_name || '');
        $('#inv-card-set-number').val(card.number || '');
        $('#inv-card-rarity').val(card.rarity || '');
        $('#inv-card-rarity-input').val(card.rarity || '');
        $('#inv-card-current-price').val(card.price ? card.price : '');
        $('#inv-card-game').val(card.game || 'pokemon');
        $('#inv-card-external-id').val(card.external_id || card.id || '');

        // Update Preview
        syncAddPreview();

        Swal.fire({
            title: 'CARTA SELECCIONADA',
            text: card.name,
            icon: 'success',
            timer: 1000,
            showConfirmButton: false,
            customClass: { popup: 'inv-swal-popup' }
        });
    });
});

$('#btn-save-investment-card').click(async function() {
    const purchaseVal = $('#inv-card-purchase-price').val();
    const currentVal = $('#inv-card-current-price').val();
    const saleVal = $('#inv-card-sale-price').val();
    const newPrice = currentVal !== '' ? parseFloat(currentVal) : 0;
    const purchasePrice = purchaseVal !== '' ? parseFloat(purchaseVal) : 0;
    const salePrice = saleVal !== '' ? parseFloat(saleVal) : null;

    const cardData = {
        category_id: currentInvestmentCategoryId,
        user_id: currentUser.id,
        card_name: $('#inv-card-name').val().toUpperCase(),
        external_id: $('#inv-card-external-id').val(),
        tcg_game: $('#inv-card-game').val() || 'pokemon',
        image_url: $('#inv-card-image-url').val(),
        rarity: $('#inv-card-rarity-input').val(),
        set_name: $('#inv-card-set-name').val(),
        set_number: $('#inv-card-set-number').val(),
        purchase_price: purchasePrice,
        current_price: newPrice,
        sale_price: salePrice,
        quantity: parseInt($('#inv-card-quantity').val()) || 1,
        show_foil: false,
        notes: $('#inv-card-notes').val(),
        extra_images: currentInvExtraImages,
        is_public: $('#inv-card-public-toggle').is(':checked'),
        is_available: $('#inv-card-available-toggle').is(':checked'),
        holo_effect: null,
        custom_mask_url: null
    };

    if (!cardData.card_name || !cardData.image_url) {
        Swal.fire({
            title: 'ATTENTION',
            text: 'Select a card or enter required data.',
            icon: 'warning',
            customClass: { popup: 'inv-swal-popup' }
        });
        return;
    }

    Swal.fire({
        title: 'SAVING ASSET...',
        didOpen: () => Swal.showLoading(),
        customClass: { popup: 'inv-swal-popup' }
    });

    try {
        let error;
        let finalCardId = currentEditingInvCardId;

        if (currentEditingInvCardId) {
            // Check if price changed to update previous_price and history
            const oldCard = localInvestmentCards.find(c => c.id === currentEditingInvCardId);
            if (oldCard && oldCard.current_price !== newPrice) {
                cardData.previous_price = oldCard.current_price;
                // Log history
                await _supabase.from('investment_price_history').insert([{
                    card_id: currentEditingInvCardId,
                    price: newPrice
                }]);
            }

            const { error: err } = await _supabase
                .from('investment_cards')
                .update(cardData)
                .eq('id', currentEditingInvCardId);
            error = err;
            if (!error) {
                logInvestmentTransaction({
                    user_id: currentUser.id,
                    category_id: currentInvestmentCategoryId,
                    card_id: currentEditingInvCardId,
                    card_name: cardData.card_name,
                    type: 'price_update',
                    quantity: cardData.quantity,
                    unit_price: newPrice,
                    total: newPrice * cardData.quantity,
                    note: 'Actualización de datos del activo'
                });
            }
        } else {
            // Insert at the slot the user picked (empty slot click); otherwise append.
            const insertAt = (pendingSlotIndex !== null && pendingSlotIndex >= 0 && pendingSlotIndex <= localInvestmentCards.length)
                ? pendingSlotIndex
                : localInvestmentCards.length;
            cardData.position = insertAt;
            const { data: newCards, error: err } = await _supabase
                .from('investment_cards')
                .insert([cardData])
                .select();
            error = err;
            if (!error && newCards.length > 0) {
                finalCardId = newCards[0].id;
                currentEditingInvCardId = finalCardId; // Update state to "editing"
                // Log initial history
                await _supabase.from('investment_price_history').insert([{
                    card_id: finalCardId,
                    price: newPrice
                }]);
                // Log the purchase movement
                logInvestmentTransaction({
                    user_id: currentUser.id,
                    category_id: currentInvestmentCategoryId,
                    card_id: finalCardId,
                    card_name: cardData.card_name,
                    type: 'purchase',
                    quantity: cardData.quantity,
                    unit_price: purchasePrice,
                    total: purchasePrice * cardData.quantity,
                    note: 'Compra inicial del activo'
                });
            }
        }

        if (error) throw error;

        Swal.fire({
            icon: 'success',
            title: 'ACTIVO GUARDADO',
            timer: 1500,
            showConfirmButton: false,
            customClass: { popup: 'inv-swal-popup' }
        });

        // Update local state and UI
        const { data: updatedCard } = await _supabase.from('investment_cards').select('*').eq('id', finalCardId).single();
        const idx = localInvestmentCards.findIndex(c => c.id === finalCardId);
        if (idx !== -1) {
            localInvestmentCards[idx] = updatedCard;
        } else if (pendingSlotIndex !== null && pendingSlotIndex >= 0 && pendingSlotIndex <= localInvestmentCards.length) {
            // Land the new asset on the slot the user chose, not always at the end.
            localInvestmentCards.splice(pendingSlotIndex, 0, updatedCard);
            await persistInvestmentPositions();
        } else {
            localInvestmentCards.push(updatedCard);
        }
        pendingSlotIndex = null;

        renderInvestmentCards(currentInvestmentViewMode);

        // Re-open the modal in "Edit" mode to show all tabs and summary
        openInvestmentCardModal(updatedCard, 'inv-tab-resumen');

    } catch (e) {
        console.error(e);
        Swal.fire({
            title: 'ERROR',
            text: 'Could not save asset: ' + (e.message || e),
            icon: 'error',
            customClass: { popup: 'inv-swal-popup' }
        });
    }
});

async function deleteInvestmentCard(id) {
    const { isConfirmed } = await Swal.fire({
        title: 'LIQUIDATE ASSET?',
        text: 'This action will remove the card from your vault.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'CONFIRM DELETE',
        cancelButtonText: 'CANCEL',
        customClass: {
            popup: 'inv-swal-popup',
            confirmButton: 'btn-inv-danger',
            cancelButton: 'btn-inv-outline'
        }
    });

    if (isConfirmed) {
        const { error } = await _supabase.from('investment_cards').delete().eq('id', id);
        if (error) {
            Swal.fire({
                title: 'ERROR',
                text: 'Could not remove asset.',
                icon: 'error',
                customClass: { popup: 'inv-swal-popup' }
            });
        } else {
            loadInvestmentCards();
        }
    }
}

function updateSummaryTab(card) {
    // 1. Force stop and cleanup any existing 3D loops to prevent rapid movement/flickering
    if (window.sharedCard3D) window.sharedCard3D.stop();

    $('#inv-card-modal-title').text('ASSET DETAILS');
    $('#inv-detail-name').text(card.card_name.toUpperCase());

    // Smooth image update to prevent flickering
    const $img = $('#inv-detail-image');
    if ($img.attr('src') !== card.image_url) {
        $img.stop().css('opacity', '0');
        $img.attr('src', card.image_url).one('load', function() {
            $(this).animate({ opacity: 1 }, 300);
        });
    } else {
        $img.css('opacity', '1');
    }

    // Reset card wrapper state and styles to prevent LERP fighting
    $('#inv-card-3d').removeClass().addClass('card-3d').attr('style', 'transform: none !important;');
    $('.holo-layer').removeClass('active foil-loop').hide();

    const setInfo = (card.set_name || 'UNKNOWN EXPANSION').toUpperCase();
    const rarityInfo = (card.rarity || 'UNKNOWN RARITY').toUpperCase();
    $('#inv-detail-set').text(`${setInfo} - ${rarityInfo}`);

    $('#inv-detail-price').text(`$${parseFloat(card.current_price || 0).toFixed(2)}`);

    const trendIcon = getTrendIcon(card.current_price, card.previous_price, true);
    $('#inv-detail-trend').html(trendIcon);

    // Quick profitability strip
    const m = computeCardMetrics(card, currentCardCost(card, currentLotMap(localInvestmentCards)));
    $('#inv-detail-metrics').html(`
        <div class="inv-summary-metric">
            <span>Lo que pagué${invInfoIcon('cost')}</span>
            <b>${fmtMoney(m.cost)}</b>
        </div>
        <div class="inv-summary-metric">
            <span>Vale hoy (mercado)${invInfoIcon('market')}</span>
            <b>${fmtMoney(m.market)}</b>
        </div>
        <div class="inv-summary-metric">
            <span>Lo venderé en${invInfoIcon('saleTarget')}</span>
            <b>${fmtMoney(m.saleTarget)}</b>
        </div>
        <div class="inv-summary-metric">
            <span>Ganancia a mercado${invInfoIcon('unrealized')}</span>
            <b class="${invPlClass(m.unrealized)}">${fmtSignedMoney(m.unrealized)}</b>
        </div>
        <div class="inv-summary-metric">
            <span>Ganancia a mi precio${invInfoIcon('projected')}</span>
            <b class="${invPlClass(m.projected)}">${fmtSignedMoney(m.projected)}</b>
        </div>
        <div class="inv-summary-metric">
            <span>Margen vs mercado${invInfoIcon('margin')}</span>
            <b class="${invPlClass(m.marginVsMarket)}">${fmtSignedMoney(m.marginVsMarket)}</b>
        </div>
    `);

    // 2. Load History Chart - delayed to ensure modal layout is fully stable and visible
    setTimeout(() => {
        if ($('#inv-tab-resumen').is(':visible')) {
            renderPriceHistoryChart(card.id);
        }
    }, 400);
}

function renderProfitabilityTab(card) {
    if (!card) return;
    const m = computeCardMetrics(card, currentCardCost(card, currentLotMap(localInvestmentCards)));

    $('#inv-renta-name').text((card.card_name || '').toUpperCase());
    $('#inv-renta-set').text(`${(card.set_name || 'SIN SET').toUpperCase()} - ${(card.rarity || 'SIN RAREZA').toUpperCase()}`);

    const statusHtml = m.isSold
        ? `<span class="inv-renta-pill inv-renta-pill-sold"><i class="fas fa-check-circle"></i> VENDIDA ${card.sold_at ? '· ' + new Date(card.sold_at).toLocaleDateString() : ''}</span>`
        : (m.isAvailable
            ? `<span class="inv-renta-pill inv-renta-pill-open"><i class="fas fa-circle-dot"></i> DISPONIBLE</span>`
            : `<span class="inv-renta-pill inv-renta-pill-sold"><i class="fas fa-ban"></i> VENDIDO / FUERA DE CARTERA</span>`);
    $('#inv-renta-status').html(statusHtml);

    const pctOfCost = m.cost > 0 ? (m.unrealized / m.cost) * 100 : 0;

    const row = (label, value, cls = '', hint = '') => `
        <div class="inv-renta-row">
            <span class="inv-renta-label">${label}${hint ? `<i class="inv-renta-hint" title="${hint}">?</i>` : ''}</span>
            <b class="inv-renta-value ${cls}">${value}</b>
        </div>
    `;

    let gridHtml = '';
    gridHtml += `<div class="inv-renta-block">
        <div class="inv-renta-block-title">INVERSIÓN</div>
        ${row('Precio de compra (unitario)', fmtMoney(card.purchase_price))}
        ${row('Cantidad', 'x' + m.qty)}
        ${row('Costo total', fmtMoney(m.cost))}
    </div>`;

    gridHtml += `<div class="inv-renta-block">
        <div class="inv-renta-block-title">VALORACIÓN ACTUAL</div>
        ${row('Precio de mercado (unitario)', fmtMoney(card.current_price))}
        ${row('Valor de mercado total', fmtMoney(m.market))}
        ${row('Ganancia / pérdida latente', fmtSignedMoney(m.unrealized), invPlClass(m.unrealized), 'Diferencia entre valor de mercado y costo')}
        ${row('Variación sobre costo', fmtPct(pctOfCost), invPlClass(pctOfCost))}
    </div>`;

    gridHtml += `<div class="inv-renta-block">
        <div class="inv-renta-block-title">VENTA OBJETIVO</div>
        ${row('Precio de venta fijado', fmtMoney(card.sale_price))}
        ${row('Valor de venta total', fmtMoney(m.saleTarget))}
        ${row('Ganancia / pérdida estimada', fmtSignedMoney(m.projected), invPlClass(m.projected), 'Ganancia si vendo al precio de venta fijado')}
        ${row('ROI estimado', fmtPct(m.roi), invPlClass(m.roi))}
    </div>`;

    gridHtml += `<div class="inv-renta-block">
        <div class="inv-renta-block-title">MARGEN VS MERCADO</div>
        ${row('Diferencia venta - mercado', fmtSignedMoney(m.marginVsMarket), invPlClass(m.marginVsMarket))}
        ${row('Margen porcentual', fmtPct(m.marginPct), invPlClass(m.marginPct))}
        ${row('Estado del precio', m.marginVsMarket >= 0 ? 'Venta por encima del mercado' : 'Venta por debajo del mercado', invPlClass(m.marginVsMarket))}
    </div>`;

    if (m.isSold) {
        gridHtml += `<div class="inv-renta-block inv-renta-block-sold">
            <div class="inv-renta-block-title">VENTA REALIZADA</div>
            ${row('Precio de venta real', fmtMoney(card.sold_price))}
            ${row('Unidades vendidas', 'x' + m.soldQty)}
            ${row('Ingreso total', fmtMoney(m.soldTotal))}
            ${row('Ganancia / pérdida realizada', fmtSignedMoney(m.realized), invPlClass(m.realized))}
        </div>`;
    }

    $('#inv-renta-grid').html(gridHtml);

    // Actions: sell or undo sale
    if (m.isSold) {
        $('#inv-renta-actions').html(`
            <button class="btn-inv-outline" id="btn-inv-undo-sale" style="width: 100%;"><i class="fas fa-rotate-left"></i> MARCAR COMO NO VENDIDA</button>
        `);
    } else {
        $('#inv-renta-actions').html(`
            <button class="btn-inv-main" id="btn-inv-sell-card" style="width: 100%;"><i class="fas fa-hand-holding-dollar"></i> MARCAR COMO VENDIDA</button>
        `);
    }
}

async function saveNewPrice(cardId, newPrice) {
    Swal.fire({ title: 'Actualizando precio...', didOpen: () => Swal.showLoading(), customClass: { popup: 'inv-swal-popup' } });

    try {
        const oldCard = localInvestmentCards.find(c => c.id === cardId);
        const previousPrice = oldCard ? oldCard.current_price : 0;

        // 1. Insert history
        await _supabase.from('investment_price_history').insert([{
            card_id: cardId,
            price: newPrice
        }]);

        // 2. Update card
        const { error } = await _supabase
            .from('investment_cards')
            .update({
                current_price: newPrice,
                previous_price: previousPrice
            })
            .eq('id', cardId);

        if (error) throw error;

        // 3. Refresh local data and UI
        const { data: updatedCard } = await _supabase.from('investment_cards').select('*').eq('id', cardId).single();
        const idx = localInvestmentCards.findIndex(c => c.id === cardId);
        if (idx !== -1) localInvestmentCards[idx] = updatedCard;

        updateSummaryTab(updatedCard);
        renderPriceHistoryChart(cardId); // Main chart
        renderInvestmentCards(currentInvestmentViewMode);

        Swal.fire({ icon: 'success', title: 'Precio Actualizado', timer: 1000, showConfirmButton: false, customClass: { popup: 'inv-swal-popup' } });

    } catch (e) {
        console.error(e);
        Swal.fire({ title: 'Error', text: 'No se pudo actualizar el precio: ' + (e.message || e), icon: 'error', customClass: { popup: 'inv-swal-popup' } });
    }
}

async function renderPriceHistoryChart(cardId) {
    // 1. Prevent overlapping renders and ensure DOM is ready
    const canvasId = 'inv-price-chart';
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Check if modal and correct tab is visible to avoid glitches
    // Only render if RESUMEN tab is visible
    if (!$('#investment-card-modal').hasClass('active') || !$('#inv-tab-resumen').is(':visible')) return;

    const { data: history, error } = await _supabase
        .from('investment_price_history')
        .select('*')
        .eq('card_id', cardId)
        .order('recorded_at', { ascending: true });

    if (error || !history) return;

    const ctx = canvas.getContext('2d');

    if (invPriceChart) {
        invPriceChart.destroy();
        invPriceChart = null;
    }

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(h => new Date(h.recorded_at).toLocaleDateString()),
            datasets: [{
                label: 'Market Price',
                data: history.map(h => h.price),
                borderColor: '#000000',
                borderWidth: 3,
                backgroundColor: 'rgba(0, 0, 0, 0.03)',
                fill: true,
                tension: 0.2,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#000000',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: '#f5f5f5' },
                    ticks: { color: '#000', font: { weight: '800', size: 11 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#999', font: { size: 10, weight: '600' } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#000',
                    titleFont: { size: 12, weight: 'bold' },
                    bodyFont: { size: 12 },
                    padding: 10,
                    cornerRadius: 2,
                    displayColors: false
                }
            }
        }
    });

    invPriceChart = chart;

    // Render list history (cloning to avoid in-place reversal issues)
    const listId = '#inv-history-list';
    const $list = $(listId);
    $list.empty();
    [...history].reverse().forEach(h => {
        $list.append(`
            <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 10px 0; border-bottom: 1px solid #f1f2f6; color: #2d3436;">
                <span>${new Date(h.recorded_at).toLocaleString()}</span>
                <b>$${parseFloat(h.price).toFixed(2)}</b>
            </div>
        `);
    });
}

// --- SALES & LEDGER ---

async function registerCardSale(card, soldPrice, soldQty) {
    Swal.fire({ title: 'Registrando venta...', didOpen: () => Swal.showLoading(), customClass: { popup: 'inv-swal-popup' } });

    const updatePayload = {
        is_sold: true,
        sold_price: soldPrice,
        sold_quantity: soldQty,
        sold_at: new Date().toISOString()
    };

    const { error } = await _supabase
        .from('investment_cards')
        .update(updatePayload)
        .eq('id', card.id);

    if (error) {
        Swal.fire({ title: 'Error', text: 'No se pudo registrar la venta: ' + error.message, icon: 'error', customClass: { popup: 'inv-swal-popup' } });
        return;
    }

    await logInvestmentTransaction({
        user_id: currentUser.id,
        category_id: card.category_id || currentInvestmentCategoryId,
        card_id: card.id,
        card_name: card.card_name,
        type: 'sale',
        quantity: soldQty,
        unit_price: soldPrice,
        total: soldPrice * soldQty,
        note: 'Venta registrada'
    });

    const { data: updatedCard } = await _supabase.from('investment_cards').select('*').eq('id', card.id).single();
    const idx = localInvestmentCards.findIndex(c => c.id === card.id);
    if (idx !== -1) localInvestmentCards[idx] = updatedCard;

    renderInvestmentCards(currentInvestmentViewMode);
    renderProfitabilityTab(updatedCard);

    Swal.fire({ icon: 'success', title: 'Venta registrada', timer: 1300, showConfirmButton: false, customClass: { popup: 'inv-swal-popup' } });
}

async function openVaultLedger(cat) {
    currentLedgerCategory = cat;
    $('#ledger-title').text((cat.name || 'VAULT').toUpperCase());
    $('#ledger-totals, #ledger-tbody, #ledger-tfoot, #ledger-history-list').html('<div class="loading">Cargando...</div>');
    $('#vault-ledger-modal').addClass('active');

    const { data: cards, error } = await _supabase
        .from('investment_cards')
        .select('*')
        .eq('category_id', cat.id)
        .order('position', { ascending: true });

    if (error) {
        $('#ledger-totals').html('<div class="error">Error al cargar los datos.</div>');
        return;
    }

    const list = cards || [];
    const lot = catLotCost(cat);
    const lotMap = lot !== null ? allocateLotCost(list, lot) : null;
    const t = computeVaultTotals(list, lot);

    // Totals cards (general figures = available cards only)
    $('#ledger-totals').html(`
        <div class="inv-ledger-total"><span>Lo que pagué (disponibles)</span><b>${fmtMoney(t.cost)}</b></div>
        <div class="inv-ledger-total"><span>Vale hoy (disponibles)</span><b>${fmtMoney(t.market)}</b></div>
        <div class="inv-ledger-total"><span>Lo venderé en (disponibles)</span><b>${fmtMoney(t.saleTarget)}</b></div>
        <div class="inv-ledger-total"><span>Ganancia a mercado</span><b class="${invPlClass(t.unrealized)}">${fmtSignedMoney(t.unrealized)}</b></div>
        <div class="inv-ledger-total"><span>Ganancia a mi precio</span><b class="${invPlClass(t.projected)}">${fmtSignedMoney(t.projected)}</b></div>
        <div class="inv-ledger-total"><span>Rendimiento sobre lo invertido</span><b class="${invPlClass(t.roi)}">${fmtPct(t.roi)}</b></div>
        <div class="inv-ledger-total"><span>Ganancia ya realizada (ventas)</span><b class="${invPlClass(t.realized)}">${fmtSignedMoney(t.realized)}</b></div>
        <div class="inv-ledger-total"><span>Disponibles / fuera de cartera</span><b>${t.activeCount} / ${t.soldCount}</b></div>
    `);

    // Rows
    if (list.length === 0) {
        $('#ledger-tbody').html('<tr><td colspan="12" style="text-align:center; padding: 30px; color:#888;">Sin activos en esta colección.</td></tr>');
        $('#ledger-tfoot').empty();
    } else {
        const $tbody = $('#ledger-tbody').empty();
        list.forEach(card => {
            const m = computeCardMetrics(card, currentCardCost(card, lotMap));
            const statusPill = m.isSold
                ? '<span class="inv-ledger-status sold">VENDIDA</span>'
                : (m.isActive
                    ? '<span class="inv-ledger-status open">DISPONIBLE</span>'
                    : '<span class="inv-ledger-status open">FUERA</span>');
            $tbody.append(`
                <tr class="inv-ledger-row ${m.isActive ? '' : 'inv-ledger-row-out'}" data-id="${card.id}">
                    <td class="inv-ledger-card-cell">
                        <img src="${card.image_url || ''}" class="inv-ledger-thumb" alt="">
                        <span>${escapeHtml(card.card_name)}</span>
                    </td>
                    <td>${escapeHtml(card.set_name || '-')}<br><small>${escapeHtml(card.rarity || '-')}</small></td>
                    <td class="num">x${m.qty}</td>
                    <td class="num">${lotMap ? fmtMoney(m.qty > 0 ? m.cost / m.qty : 0) : fmtMoney(card.purchase_price)}${lotMap ? '<br><small>(lote)</small>' : ''}</td>
                    <td class="num">${fmtMoney(m.cost)}</td>
                    <td class="num">${fmtMoney(m.market)}</td>
                    <td class="num">${fmtMoney(m.saleTarget)}</td>
                    <td class="num ${invPlClass(m.unrealized)}">${fmtSignedMoney(m.unrealized)}</td>
                    <td class="num ${invPlClass(m.projected)}">${fmtSignedMoney(m.projected)}</td>
                    <td class="num ${invPlClass(m.marginVsMarket)}">${fmtSignedMoney(m.marginVsMarket)}<br><small>${fmtPct(m.marginPct)}</small></td>
                    <td class="num ${invPlClass(m.roi)}">${fmtPct(m.roi)}</td>
                    <td>${statusPill}</td>
                </tr>
            `);
        });

        $('#ledger-tfoot').html(`
            <tr>
                <td colspan="2">TOTALES (solo disponibles)</td>
                <td class="num">x${t.activeUnits}</td>
                <td class="num">—</td>
                <td class="num">${fmtMoney(t.cost)}</td>
                <td class="num">${fmtMoney(t.market)}</td>
                <td class="num">${fmtMoney(t.saleTarget)}</td>
                <td class="num ${invPlClass(t.unrealized)}">${fmtSignedMoney(t.unrealized)}</td>
                <td class="num ${invPlClass(t.projected)}">${fmtSignedMoney(t.projected)}</td>
                <td class="num ${invPlClass(t.marginPct)}">${fmtSignedMoney(t.saleTarget - t.market)}<br><small>${fmtPct(t.marginPct)}</small></td>
                <td class="num ${invPlClass(t.roi)}">${fmtPct(t.roi)}</td>
                <td></td>
            </tr>
        `);
    }

    // Click a row to open the card manager
    $('#ledger-tbody').off('click', '.inv-ledger-row').on('click', '.inv-ledger-row', function() {
        const id = $(this).data('id');
        const card = list.find(c => c.id === id);
        if (card) {
            $('#vault-ledger-modal').removeClass('active');
            openInvestmentCardModal(card);
        }
    });

    // Movements history
    const { data: movements } = await _supabase
        .from('investment_transactions')
        .select('*')
        .eq('category_id', cat.id)
        .order('created_at', { ascending: false })
        .limit(100);

    const $hist = $('#ledger-history-list').empty();
    if (!movements || movements.length === 0) {
        $hist.html('<div class="inv-ledger-history-empty">Sin movimientos registrados todavía.</div>');
    } else {
        const typeLabel = { purchase: 'COMPRA', sale: 'VENTA', price_update: 'PRECIO' };
        const typeClass = { purchase: 'purchase', sale: 'sale', price_update: 'update' };
        movements.forEach(mv => {
            $hist.append(`
                <div class="inv-ledger-movement">
                    <span class="inv-ledger-mv-type ${typeClass[mv.type] || 'update'}">${typeLabel[mv.type] || mv.type}</span>
                    <span class="inv-ledger-mv-name">${escapeHtml(mv.card_name || '-')}</span>
                    <span class="inv-ledger-mv-qty">x${mv.quantity || 1}</span>
                    <span class="inv-ledger-mv-total">${fmtMoney(mv.total)}</span>
                    <span class="inv-ledger-mv-date">${new Date(mv.created_at).toLocaleString()}</span>
                </div>
            `);
        });
    }
}
