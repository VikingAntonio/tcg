/**
 * migltf.js - Chatbot GLTF Core Logic (Centralized)
 * Optimized for reliability across admin and public views.
 */

// Global interaction handler for companion menu
$(document).on('click', function(e) {
    if (!$(e.target).closest('#floating-companion-container, #companion-menu').length) {
        $('#companion-menu').removeClass('active');
    }
});

async function initFloatingCompanion() {
    console.log("Initializing Floating Companion...");
    let $wrapper = $('#companion-wrapper');

    // 1. Ensure HTML structure exists
    if (!$wrapper.length) {
        $('body').append(`
            <div id="companion-wrapper">
                <div class="companion-drag-handle" id="companion-drag-handle">
                    <i class="fas fa-arrows-alt"></i>
                </div>
                <div class="companion-bubble" id="companion-bubble"></div>
                <div id="floating-companion-container"></div>
                <div class="companion-menu-popup" id="companion-menu">
                    <div class="companion-menu-item" id="menu-item-chat"><i class="fas fa-comment-dots"></i> Chatear</div>
                    <div class="companion-menu-item" id="menu-item-play"><i class="fas fa-gamepad"></i> Jugar</div>
                    <div class="companion-menu-item" id="menu-item-details"><i class="fas fa-search-plus"></i> Ver Detalle</div>
                </div>
            </div>
        `);
        $wrapper = $('#companion-wrapper');
    }

    if (!$('#chatbot-container').length) {
        $('body').append(`
            <div id="chatbot-container">
                <div class="chatbot-header">
                    <h3><i class="fas fa-robot"></i> Vikingdev Assistant</h3>
                    <span id="close-chatbot" style="cursor:pointer; font-size: 1.5rem;">&times;</span>
                </div>
                <div class="chatbot-messages" id="chat-messages">
                    <div class="chat-msg msg-bot">¡Hola! Soy tu asistente. ¿En qué puedo ayudarte hoy?</div>
                </div>
                <div class="chatbot-input-area">
                    <div class="chat-input-wrapper">
                        <input type="text" id="chat-input" placeholder="Escribe tu duda...">
                        <button id="send-chat" class="btn btn-sm"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>
            </div>
        `);
    }

    // 2. Force Visibility & High Z-Index
    $wrapper.css({
        'z-index': '999999999',
        'display': 'block',
        'visibility': 'visible',
        'opacity': '1',
        'position': 'fixed',
        'bottom': '20px',
        'left': '20px'
    });

    // 3. Wait for data (polling)
    const userObj = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);

    if (!window.currentSpirit) {
        // Try to fetch a public fallback if we are in a public view or no spirit selected
        if (typeof _supabase !== 'undefined') {
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
                console.warn("Could not fetch fallback spirit:", e);
            }
        }

        if (!window.currentSpirit) {
            setTimeout(initFloatingCompanion, 2000);
            return;
        }
    }

    // Also wait for user if on admin-like pages to init bot properly
    if (!userObj && (window.location.pathname.includes('admin') || window.location.pathname.includes('binders'))) {
        setTimeout(initFloatingCompanion, 2000);
        return;
    }

    // 4. Update UI Branding & Greeting
    $('.chatbot-header h3').html('<i class="fas fa-robot"></i> Vikingdev Assistant');
    if (window.currentSpirit && window.currentSpirit.name) {
        const $greeting = $('#chat-messages .msg-bot').first();
        if ($greeting.length && ($greeting.text().includes('asistente Vikingo') || $greeting.text() === '¡Hola! Soy tu asistente. ¿En qué puedo ayudarte hoy?')) {
            $greeting.text(`¡Hola! Soy ${window.currentSpirit.name}, tu asistente. ¿En qué puedo ayudarte hoy?`);
        }
    }

    // 5. Initialize Model Viewer (if not already matching)
    const $targetContainer = $('#floating-companion-container');
    const currentSrc = $targetContainer.find('model-viewer').attr('src');

    if (currentSrc !== window.currentSpirit.gltf_url) {
        $targetContainer.html(`
            <model-viewer
                src="${window.currentSpirit.gltf_url}"
                auto-rotate
                camera-controls
                rotation="0deg 0deg 0deg"
                shadow-intensity="1"
                environment-image="neutral"
                exposure="1"
                interaction-prompt="none"
                style="width: 100%; height: 100%;"
                oncontextmenu="return false;">
            </model-viewer>
        `);

        // Click to toggle menu
        $targetContainer.off('click').on('click', function(e) {
            if (window.isCompanionDragging) return;
            e.stopPropagation();
            $('#companion-menu').toggleClass('active');
        });

        // Drag handle logic
        setTimeout(() => {
            if (typeof makeCompanionDraggable === 'function') {
                makeCompanionDraggable();
            }
        }, 1000);
    }

    // 6. Interaction Handlers
    $('#menu-item-chat').off('click').on('click', function(e) {
        e.stopPropagation();
        $('#chatbot-container').toggleClass('active');
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

    $('#close-chatbot').off('click').on('click', () => {
        $('#chatbot-container').removeClass('active');
    });

    // 7. CompanionBot Tips Integration
    if (typeof CompanionBot === 'function' && !window.botInstance && userObj && userObj.id) {
        window.botInstance = new CompanionBot({
            supabase: _supabase,
            userId: userObj.id,
            userType: userObj.role === 'admin' || userObj.role === 'admin_store' ? 'admin' : 'user',
            onAction: (msg) => {
                if (msg.type === 'album_link') {
                    if (typeof showView === 'function') showView('dashboard');
                } else if (msg.redirect_url && msg.redirect_url.startsWith('http')) {
                    window.open(msg.redirect_url, '_blank');
                }
            }
        });
        window.botInstance.init();
    }
}

// Ensure it runs
$(document).ready(function() {
    initFloatingCompanion();
});
