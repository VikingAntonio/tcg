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
        // Ensure classes are applied correctly for the holographic engine
        if (!$el.hasClass('foil-loop')) {
            $el.addClass('foil-loop');
        }

        // If it doesn't have the .card class (needed for Pokemon engine styles), add it
        if (!$el.hasClass('card')) {
            $el.addClass('card');
        }

        // Ensure holographic layer exists
        if ($el.find('.holo-layer').length === 0) {
            $el.append('<div class="holo-layer"></div>');
        }

        // If pokemon-style foils are used, ensure shine/glare exist
        const holo = $el.attr('data-holo');
        if (holo && holo.startsWith('pk-')) {
            if ($el.find('.card__shine').length === 0) {
                $el.append('<div class="card__shine"></div><div class="card__glare"></div>');
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
