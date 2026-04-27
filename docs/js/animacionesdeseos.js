/*
   Logic to ensure wishlist items with foil enabled
   automatically get the necessary classes and layers.
*/
(function() {
    function initFoilIntegration() {
        // Watch for wishlist container rendering
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element
                            const $el = $(node);
                            // Check if it's a wishlist item with foil enabled
                            if ($el.hasClass('wishlist-card-item') && $el.attr('data-show-foil') === 'true') {
                                applyFoilLayers($el);
                            }
                            // Also check children
                            $el.find('.wishlist-card-item[data-show-foil="true"]').each(function() {
                                applyFoilLayers($(this));
                            });
                        }
                    });
                }
            });
        });

        const config = { childList: true, subtree: true };
        const container = document.getElementById('wishlist-container');
        if (container) {
            observer.observe(container, config);
        }

        // Initial check for existing elements
        $('.wishlist-card-item[data-show-foil="true"]').each(function() {
            applyFoilLayers($(this));
        });
    }

    function applyFoilLayers($el) {
        // Handle both the case where $el is the wishlist item or the container itself
        let $container = $el.hasClass('wishlist-image-container') ? $el : $el.find('.wishlist-image-container');

        if ($container.length === 0) {
            const $img = $el.find('img').first();
            if ($img.length) {
                $img.wrap('<div class="wishlist-image-container"></div>');
                $container = $el.find('.wishlist-image-container');
            } else {
                $container = $el; // Fallback
            }
        }

        // Ensure classes are applied correctly for the holographic engine on the container
        if (!$container.hasClass('foil-loop')) {
            $container.addClass('foil-loop');
        }

        // If it doesn't have the .card class (needed for Pokemon engine styles), add it
        if (!$container.hasClass('card')) {
            $container.addClass('card');
        }

        // Ensure holographic layer exists in the container
        if ($container.find('.holo-layer').length === 0) {
            $container.append('<div class="holo-layer"></div>');
        }

        // If pokemon-style foils are used, ensure shine/glare exist
        const holo = $el.attr('data-holo');
        if (holo && holo.startsWith('pk-')) {
            if ($container.find('.card__shine').length === 0) {
                $container.append('<div class="card__shine"></div><div class="card__glare"></div>');
            }
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFoilIntegration);
    } else {
        initFoilIntegration();
    }

    console.log("Wishlist foil logic active");
})();
