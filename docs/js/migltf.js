/**
 * migltf.js - Chatbot GLTF Core Logic
 */

// Global interaction handler for companion menu
$(document).on('click', function(e) {
    if (!$(e.target).closest('#floating-companion-container, #companion-menu').length) {
        $('#companion-menu').removeClass('active');
    }
});

async function initFloatingCompanion() {
    // Force visibility and extreme z-index to stay on top
    const $wrapper = $('#companion-wrapper');
    if ($wrapper.length) {
        $wrapper.css({
            'z-index': '999999999',
            'display': 'block',
            'visibility': 'visible',
            'opacity': '1',
            'position': 'fixed'
        });
    }

    // If no spirit selected, try to get a public one from DB
    if (!window.currentSpirit) {
        try {
            if (typeof _supabase !== 'undefined') {
                const { data: publicSpirits } = await _supabase
                    .from('spirits')
                    .select('*')
                    .eq('is_public', true)
                    .limit(1);
                if (publicSpirits && publicSpirits.length > 0) {
                    window.currentSpirit = publicSpirits[0];
                }
            }
        } catch (e) {
            console.warn("Could not fetch fallback public spirit", e);
        }
    }

    if (!window.currentSpirit) {
        // Retry spirit fetch if not found (might be waiting for Supabase)
        setTimeout(initFloatingCompanion, 2000);
        return;
    }

    const $container = $('#floating-companion-container');
    if (!$container.length) return;

    // Avoid redundant model reloading
    if ($container.find('model-viewer').attr('src') !== window.currentSpirit.gltf_url) {
        $container.html(`
            <model-viewer
                src="${window.currentSpirit.gltf_url}"
                auto-rotate
                camera-controls
                rotation="0deg 0deg 0deg"
                shadow-intensity="1"
                environment-image="neutral"
                exposure="1"
                interaction-prompt="none"
                oncontextmenu="return false;">
            </model-viewer>
        `);

        $container.off('click').on('click', function(e) {
            if (window.isCompanionDragging) return;
            e.stopPropagation();
            $('#companion-menu').toggleClass('active');
        });

        // Ensure draggable logic is applied
        setTimeout(() => {
            if (typeof makeCompanionDraggable === 'function') {
                makeCompanionDraggable();
            }
        }, 1000);
    }

    // --- Interaction Menu Actions ---
    $('#menu-item-chat').off('click').on('click', function(e) {
        e.stopPropagation();
        $('#chatbot-container').addClass('active');
        $('#companion-menu').removeClass('active');
    });

    $('#menu-item-play').off('click').on('click', function(e) {
        e.stopPropagation();
        window.location.href = 'play.html';
    });

    $('#menu-item-details').off('click').on('click', function(e) {
        e.stopPropagation();
        if (window.currentSpirit) {
            $('#expanded-gltf-viewer').attr('src', window.currentSpirit.gltf_url);
            $('#expanded-gltf-viewer').attr('poster', window.currentSpirit.poster_url || '');
            $('#expanded-gltf-name').text(window.currentSpirit.name);
            $('#gltf-overlay').addClass('active');
            $('body').addClass('modal-open');
        }
        $('#companion-menu').removeClass('active');
    });

    // Initialize CompanionBot Tips with safe user check
    const userObj = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);

    if (typeof CompanionBot === 'function' && !window.botInstance && userObj && userObj.id) {
        const bot = new CompanionBot({
            supabase: _supabase,
            userId: userObj.id,
            userType: 'admin',
            customMessages: window.currentStoreDataForBot ? window.currentStoreDataForBot.customMessages : [],
            onAction: (msg) => {
                if (msg.type === 'album_link') {
                    if (typeof showView === 'function') showView('dashboard');
                    if (typeof loadAlbums === 'function') loadAlbums();
                } else if (msg.redirect_url && msg.redirect_url.startsWith('http')) {
                    window.open(msg.redirect_url, '_blank');
                }
            }
        });
        bot.init();
        window.botInstance = bot;
    } else if (typeof CompanionBot === 'function' && !window.botInstance) {
        // Wait for user session and retry bot initialization
        setTimeout(initFloatingCompanion, 2000);
    }
}

// Auto-trigger on script load and document ready
$(document).ready(function() {
    initFloatingCompanion();
});
