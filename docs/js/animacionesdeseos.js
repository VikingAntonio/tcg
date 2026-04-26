/*
   Logic to isolate foil effect to the card image only.
   Migrates foil classes and layers from the wishlist slot to an image wrapper.
*/
(function() {
    function migrateFoil() {
        $('.wishlist-card-item.foil-loop').each(function() {
            const $slot = $(this);

            // Avoid double wrapping
            if ($slot.find('.card-image-foil-wrapper').length > 0) return;

            const $img = $slot.find('img').first();
            if (!$img.length || $img.hasClass('card__back') || $img.hasClass('card__front')) return;

            // 1. Create the wrapper that will contain the foil effect
            const $wrapper = $('<div class="card-image-foil-wrapper"></div>');
            $img.wrap($wrapper);
            const $newWrapper = $img.parent();

            // 2. List of classes to transfer from slot to wrapper
            const classesToTransfer = [
                'card', 'foil-loop', 'super-rare', 'secret-rare', 'ghost-rare',
                'foil', 'rainbow', 'starlight-rare', 'custom-texture', 'custom-foil',
                'pk-rare-holo', 'pk-rare-holo-cosmos', 'pk-rare-holo-v', 'pk-rare-holo-vmax',
                'pk-rare-holo-vstar', 'pk-rare-rainbow', 'pk-rare-rainbow-alt', 'pk-rare-secret',
                'pk-rare-shiny', 'pk-rare-shiny-v', 'pk-rare-shiny-vmax', 'pk-amazing-rare',
                'pk-radiant-rare', 'pk-rare-ultra', 'pk-trainer-gallery',
                'pk-trainer-gallery-secret-rare', 'pk-trainer-gallery-v-max',
                'pk-trainer-gallery-v-regular', 'pk-trainer-full-art',
                'pk-rare-holo-v-full-art', 'pk-reverse-holo', 'masked', 'active'
            ];

            classesToTransfer.forEach(cls => {
                if ($slot.hasClass(cls)) {
                    $newWrapper.addClass(cls);
                    $slot.removeClass(cls);
                }
            });

            // 3. Move holographic layers to the wrapper
            $slot.find('.holo-layer, .card__shine, .card__glare').appendTo($newWrapper);

            // 4. Transfer relevant data attributes for the holographic engine
            const attrs = ['data-rarity', 'data-trainer-gallery', 'data-subtypes', 'data-supertype'];
            attrs.forEach(attr => {
                const val = $slot.attr(attr);
                if (val) {
                    $newWrapper.attr(attr, val);
                    // We keep them on slot too if needed for other logic,
                    // but usually they are for CSS targeting.
                }
            });

            // 5. Transfer CSS variables (like masks)
            const vars = ['--mask', '--mask-url', '--seedx', '--seedy', '--cosmosbg'];
            vars.forEach(v => {
                const val = $slot.get(0).style.getPropertyValue(v);
                if (val) {
                    $newWrapper.get(0).style.setProperty(v, val);
                    $slot.get(0).style.removeProperty(v);
                }
            });

            // 6. Disable default mouse interaction from app.js
            // By changing the attribute, app.js listeners won't target this slot anymore.
            $slot.attr('data-show-foil', 'migrated');

            console.log("Foil migrated to image for:", $slot.data('name'));
        });
    }

    // Run migration frequently to catch newly rendered items
    const migrationInterval = setInterval(migrateFoil, 300);

    // Clean up on page hide just in case
    window.addEventListener('unload', () => clearInterval(migrationInterval));
})();
