/**
 * MultiFoils Manager
 * Handles the floating multi-color mask editor palette.
 */

window.MultiFoils = {
    colors: [
        { id: 'clasico', name: 'Clásico', hex: '#ffffff', gradient: 'linear-gradient(135deg, #ff00ff, #00ffff)' },
        { id: 'rojo', name: 'Rojo', hex: '#ff4d4d', gradient: 'linear-gradient(135deg, #ff4d4d, #990000)' },
        { id: 'dorado', name: 'Dorado', hex: '#ffd700', gradient: 'linear-gradient(135deg, #ffd700, #aa8418)' },
        { id: 'verde', name: 'Verde', hex: '#00ff66', gradient: 'linear-gradient(135deg, #00ff66, #006622)' },
        { id: 'azul', name: 'Azul', hex: '#0099ff', gradient: 'linear-gradient(135deg, #0099ff, #002266)' },
        { id: 'amarillo', name: 'Amarillo', hex: '#ffff00', gradient: 'linear-gradient(135deg, #ffff00, #888800)' },
        { id: 'naranja', name: 'Naranja', hex: '#ff7700', gradient: 'linear-gradient(135deg, #ff7700, #993300)' },
        { id: 'rosa', name: 'Rosa', hex: '#ff66cc', gradient: 'linear-gradient(135deg, #ff66cc, #aa0066)' },
        { id: 'morado', name: 'Morado', hex: '#aa00ff', gradient: 'linear-gradient(135deg, #aa00ff, #440099)' },
        { id: 'guinda', name: 'Guinda', hex: '#800020', gradient: 'linear-gradient(135deg, #800020, #40000d)' },
        { id: 'gris', name: 'Gris', hex: '#aaaaaa', gradient: 'linear-gradient(135deg, #aaaaaa, #444444)' },
        { id: 'negro', name: 'Negro', hex: '#3a3a3a', gradient: 'linear-gradient(135deg, #555555, #111111)' },
        { id: 'blanco', name: 'Blanco', hex: '#ffffff', gradient: 'linear-gradient(135deg, #ffffff, #cccccc)' }
    ],
    currentColor: 'clasico',

    // Gets current brush color hex
    getBrushHex: function() {
        const colorObj = this.colors.find(c => c.id === this.currentColor);
        return colorObj ? colorObj.hex : '#ffffff';
    },

    // Populate and initialize the floating palette
    initFloatingPalette: function() {
        const $palette = $('#multifoil-palette-dropdown');
        if (!$palette.length) return;

        // Generate color buttons
        const btnHtml = this.colors.map(c =>
            `<div class="multifoil-palette-color-btn btn-mf-${c.id}" data-color="${c.id}" title="${c.name}" style="background: ${c.gradient};"></div>`
        ).join('');

        $palette.html(btnHtml);

        // Highlight active color initially
        $palette.find('.multifoil-palette-color-btn').removeClass('active');
        $palette.find(`.btn-mf-${this.currentColor}`).addClass('active');

        // Set trigger background to current color
        const activeColorObj = this.colors.find(c => c.id === this.currentColor);
        if (activeColorObj) {
            $('#btn-multifoil-active-color').css('background', activeColorObj.gradient);
        }

        // Active color trigger click handler
        $('#btn-multifoil-active-color').off('click').on('click', function(e) {
            e.stopPropagation();
            $palette.slideToggle(200);
        });

        // Color buttons click handler
        const self = this;
        $palette.off('click', '.multifoil-palette-color-btn').on('click', '.multifoil-palette-color-btn', function(e) {
            e.stopPropagation();
            const colorId = $(this).data('color');
            self.currentColor = colorId;

            // Highlight selected
            $palette.find('.multifoil-palette-color-btn').removeClass('active');
            $(this).addClass('active');

            // Update floating trigger button background
            const colorObj = self.colors.find(c => c.id === colorId);
            if (colorObj) {
                $('#btn-multifoil-active-color').css('background', colorObj.gradient);
            }

            // Set current brush tool automatically
            window.currentTool = 'brush';
            $('.editor-controls .btn-secondary').removeClass('active');
            $('.zoom-controls-lateral .btn-secondary').removeClass('active');
            $('#tool-brush').addClass('active');

            // Collapse palette
            $palette.slideUp(150);
        });

        // Hide palette when clicking outside
        $(document).on('click', function() {
            $palette.slideUp(150);
        });
    }
};
