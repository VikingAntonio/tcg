/**
 * MultiFoils Manager
 * Handles the color foil floating palette selection within form editors.
 */

window.MultiFoils = {
    colors: [
        { id: 'rojo', name: 'Rojo' },
        { id: 'dorado', name: 'Dorado' },
        { id: 'verde', name: 'Verde' },
        { id: 'azul', name: 'Azul' },
        { id: 'clasico', name: 'Clásico' },
        { id: 'amarillo', name: 'Amarillo' },
        { id: 'naranja', name: 'Naranja' },
        { id: 'rosa', name: 'Rosa' },
        { id: 'morado', name: 'Morado' },
        { id: 'guinda', name: 'Guinda' },
        { id: 'gris', name: 'Gris' },
        { id: 'negro', name: 'Negro' }
    ],

    // Generate HTML for the picker widget
    generatePickerHTML: function(pickerId) {
        const gridItems = this.colors.map(c =>
            `<div class="multi-foils-color-btn btn-mf-${c.id}" data-color="${c.id}" title="${c.name}"></div>`
        ).join('');

        return `
            <div id="${pickerId}" class="multi-foils-selector-container">
                <div class="multi-foils-selector-title">Selecciona un Color Foil</div>
                <div class="multi-foils-colors-grid">
                    ${gridItems}
                </div>
            </div>
        `;
    },

    // Initialize picker on a target select element
    setupPicker: function(selectSelector, pickerId, valueStoreSelector, onColorSelected) {
        const $select = $(selectSelector);
        if (!$select.length) return;

        // Inject picker HTML directly after the select element if not already present
        if ($(`#${pickerId}`).length === 0) {
            const html = this.generatePickerHTML(pickerId);
            $select.parent().after(html);
        }

        const $picker = $(`#${pickerId}`);

        // Handle select change event
        $select.on('change', function() {
            if ($(this).val() === 'multiFoils') {
                $picker.css('display', 'flex');
                // Select first color by default if none is set
                const currentVal = $(this).attr('data-complex-val') || '';
                if (!currentVal.startsWith('multiFoils|')) {
                    const defaultColor = 'clasico';
                    $(this).attr('data-complex-val', `multiFoils|${defaultColor}`).trigger('change');
                    $picker.find('.multi-foils-color-btn').removeClass('active');
                    $picker.find(`.btn-mf-${defaultColor}`).addClass('active');
                    if (onColorSelected) onColorSelected(defaultColor);
                }
            } else {
                $picker.hide();
                $(this).removeAttr('data-complex-val');
            }
        });

        // Handle color button clicks
        $picker.off('click', '.multi-foils-color-btn').on('click', '.multi-foils-color-btn', function(e) {
            e.stopPropagation();
            const color = $(this).data('color');
            $picker.find('.multi-foils-color-btn').removeClass('active');
            $(this).addClass('active');

            // Save the value with multiFoils prefix on the select's data attribute
            $select.attr('data-complex-val', `multiFoils|${color}`).trigger('change');

            // Collapse picker on selection
            $picker.fadeOut(200);

            if (onColorSelected) {
                onColorSelected(color);
            }
        });

        // Allow clicking the select or a button to toggle the picker back open if needed
        $select.on('click', function() {
            if ($(this).val() === 'multiFoils' && $picker.is(':hidden')) {
                $picker.css('display', 'flex').hide().fadeIn(250);
            }
        });
    },

    // Sync state when loading a card into the modal
    syncState: function(selectSelector, pickerId, fullHoloValue) {
        const $select = $(selectSelector);
        const $picker = $(`#${pickerId}`);
        if (!$select.length || !$picker.length) return;

        let baseHolo = fullHoloValue || '';
        if (baseHolo.startsWith('L:')) baseHolo = baseHolo.substring(2);

        if (baseHolo.startsWith('multiFoils|')) {
            const color = baseHolo.split('|')[1] || 'clasico';
            $select.val('multiFoils');
            $select.attr('data-complex-val', baseHolo);
            $picker.css('display', 'flex');
            $picker.find('.multi-foils-color-btn').removeClass('active');
            $picker.find(`.btn-mf-${color}`).addClass('active');
        } else {
            $picker.hide();
            $select.removeAttr('data-complex-val');
        }
    }
};

// Automatic document ready setup if elements are present
$(document).ready(function() {
    // 1. Setup in slot-modal (Albums and Decks context)
    MultiFoils.setupPicker(
        '#slot-holo-effect',
        'slot-multi-foils-picker',
        '#slot-holo-effect', // Store on the select's data-complex-val
        function(color) {
            // Also update any other custom places
            $('#slot-modal').attr('data-complex-val', `multiFoils|${color}`);
            // Force render preview in slot modal if active
            if (typeof window.applyVisualsToModal === 'function') {
                const mask = $('#slot-custom-mask').val() || '';
                const use3d = $('#slot-modal').data('current-obtained') !== false; // or whatever represents 3D state
                window.applyVisualsToModal(`multiFoils|${color}`, mask, use3d);
            }
        }
    );

    // 2. Setup in wishlist-modal-admin
    MultiFoils.setupPicker(
        '#modal-wishlist-holo-effect',
        'wishlist-admin-multi-foils-picker',
        '#modal-wishlist-holo-effect', // Store on the select's data-complex-val
        function(color) {
            // Callback to update modal visual preview if applicable
        }
    );

    // 3. Setup in wishlist deseos.html
    MultiFoils.setupPicker(
        '#modal-holo-effect',
        'wishlist-public-multi-foils-picker',
        '#modal-holo-effect', // Store on the select's data-complex-val
        function(color) {
            // Callback
        }
    );
});
