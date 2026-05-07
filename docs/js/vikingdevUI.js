(function() {
    const SUPABASE_URL = 'https://ehszvqwftqgxjggnbcmt.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoc3p2cXdmdHFneGpnZ25iY210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NDI5MjAsImV4cCI6MjA4NTMxODkyMH0.wh8_Xy4_w9roFxMgbJ-J9A3r5V7duUjnStl4ZsZ0804';

    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function init() {
        // Load jQuery if not present
        if (typeof jQuery === 'undefined') {
            await loadScript('https://code.jquery.com/jquery-3.6.0.min.js');
        }

        // Load Supabase if not present
        if (typeof supabase === 'undefined') {
            await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
        }

        const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        // Load Turn.js if not present
        if (typeof $.fn.turn === 'undefined') {
             const currentScript = document.querySelector('script[src*="vikingdevUI.js"]');
             const baseUrl = currentScript ? currentScript.src.replace('/js/vikingdevUI.js', '') : '';
             await loadScript(baseUrl + '/js/turn.js');
        }

        const binders = document.querySelectorAll('vikingdev-binders');
        for (const binder of binders) {
            renderBinder(binder, _supabase);
        }
    }

    async function renderBinder(el, _supabase) {
        const domain = el.getAttribute('domain');
        const albumId = el.getAttribute('album-id');
        const albumTitle = el.getAttribute('album-name') || el.getAttribute('album-title');

        if (!domain || (!albumId && !albumTitle)) return;

        // Verify user by domain
        const { data: user, error: userError } = await _supabase
            .from('usuarios')
            .select('id')
            .eq('custom_domain', domain)
            .single();

        if (userError || !user) {
            el.innerHTML = `<p style="color: red; font-family: sans-serif; font-size: 12px;">Error: Domain "${domain}" not authorized or user not found.</p>`;
            return;
        }

        // Fetch Album
        let query = _supabase.from('albums').select('*').eq('user_id', user.id);

        if (albumId) {
            query = query.eq('id', albumId);
        } else {
            query = query.eq('title', albumTitle);
        }

        const { data: album, error: albumError } = await query.maybeSingle();

        if (albumError || !album) {
            el.innerHTML = `<p style="color: red; font-family: sans-serif; font-size: 12px;">Error: Album "${albumId || albumTitle}" not found.</p>`;
            return;
        }

        const $el = $(el);
        $el.empty();

        const $container = $('<div class="vikingdev-binders-container"></div>');
        const $wrapper = $('<div class="viking-album-wrapper"></div>');
        const $albumDiv = $(`<div class="viking-album"></div>`);

        $wrapper.append($albumDiv);
        $container.append($wrapper);
        $el.append($container);

        // Fetch Pages
        let { data: pages } = await _supabase
            .from('pages')
            .select('*')
            .eq('album_id', album.id)
            .order('page_index', { ascending: true });

        if (!pages) pages = [];

        // Render Cover
        if (album.cover_image_url) {
            $albumDiv.append(`<div class="page cover-page"><img src="${album.cover_image_url}"></div>`);
        } else {
            const coverColor = album.cover_color || '#1a1a1a';
            $albumDiv.append(`
                <div class="page cover-page">
                    <div class="textured-cover" style="background-color: ${coverColor}">
                        <h2>${album.title}</h2>
                    </div>
                </div>
            `);
        }

        // Fetch all slots for this album at once to minimize requests
        const pageIds = pages.map(p => p.id);
        let allSlots = [];
        if (pageIds.length > 0) {
            const { data: slots } = await _supabase
                .from('card_slots')
                .select('*')
                .in('page_id', pageIds)
                .order('slot_index', { ascending: true });
            allSlots = slots || [];
        }

        for (const page of pages) {
            const $pageDiv = $('<div class="page"></div>');
            const $grid = $('<div class="grid-container"></div>');
            const pageSlots = allSlots.filter(s => s.page_id === page.id);

            for (let i = 0; i < 9; i++) {
                const slotData = pageSlots.find(s => s.slot_index === i);
                const $slot = $('<div class="card-slot"></div>');
                if (slotData && slotData.image_url) {
                    $slot.append(`<img src="${slotData.image_url}" alt="${slotData.name || 'Carta'}">`);
                }
                $grid.append($slot);
            }
            $pageDiv.append($grid).appendTo($albumDiv);
        }

        // Filler page if needed for even page count (excluding back cover)
        // Pages count so far: 1 (cover) + pages.length
        if ((1 + pages.length) % 2 !== 0) {
            $albumDiv.append('<div class="page empty-page" style="background: #1a1a1a;"></div>');
        }

        // Back cover
        if (album.back_image_url) {
            $albumDiv.append(`<div class="page back-page"><img src="${album.back_image_url}"></div>`);
        } else {
            const backColor = album.back_color || '#1a1a1a';
            $albumDiv.append(`
                <div class="page back-page">
                    <div class="textured-cover" style="background-color: ${backColor}"></div>
                </div>
            `);
        }

        // Initialize Turn.js
        setTimeout(() => {
            const updateSize = () => {
                const isMobile = window.innerWidth <= 768;
                const width = isMobile ? 340 : 600;
                const height = isMobile ? 250 : 420;
                if ($albumDiv.turn('is')) {
                    $albumDiv.turn('size', width, height);
                } else {
                    $albumDiv.turn({
                        width: width,
                        height: height,
                        autoCenter: true,
                        duration: 1000,
                        gradients: true,
                        acceleration: true,
                        elevation: 50
                    });
                }
            };

            updateSize();
            $(window).on('resize', updateSize);
        }, 200);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
