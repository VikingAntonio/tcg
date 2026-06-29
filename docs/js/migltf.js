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
    // If no spirit selected, try to get a public one from DB
    if (!window.currentSpirit) {
        try {
            const { data: publicSpirits } = await _supabase
                .from('spirits')
                .select('*')
                .eq('is_public', true)
                .limit(1);
            if (publicSpirits && publicSpirits.length > 0) {
                window.currentSpirit = publicSpirits[0];
            }
        } catch (e) {
            console.warn("Could not fetch fallback public spirit", e);
        }
    }

    if (!window.currentSpirit) return;

    const $container = $('#floating-companion-container');
    if (!$container.length) return;

    // Avoid redundant initialization if the same spirit is already loaded
    if ($container.find('model-viewer').attr('src') === window.currentSpirit.gltf_url) {
        return;
    }

    setTimeout(makeCompanionDraggable, 1000);
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

    // Initialize CompanionBot Tips
    if (typeof CompanionBot === 'function') {
        const bot = new CompanionBot({
            supabase: _supabase,
            userId: currentUser.id,
            userType: 'admin',
            customMessages: window.currentStoreDataForBot ? window.currentStoreDataForBot.customMessages : [],
            onAction: (msg) => {
                if (msg.type === 'album_link') {
                    showView('dashboard');
                    loadAlbums();
                } else if (msg.redirect_url && msg.redirect_url.startsWith('http')) {
                    window.open(msg.redirect_url, '_blank');
                }
            }
        });
        bot.init();
        window.botInstance = bot;
    }
}
