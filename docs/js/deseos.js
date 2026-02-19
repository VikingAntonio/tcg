let currentUser = null;
let ygoSetsCache = null;

async function getYgoSets() {
    if (ygoSetsCache) return ygoSetsCache;
    try {
        const response = await fetch('https://db.ygoprodeck.com/api/v7/cardsets.php');
        ygoSetsCache = await response.json();
    } catch (e) {
        console.warn("Error fetching YGO sets:", e);
        ygoSetsCache = [];
    }
    return ygoSetsCache;
}

$(document).ready(async function() {
    await checkSession();
    initTheme();

    // Search event
    $('#btn-deseos-external-search').click(function(e) {
        e.preventDefault();
        searchExternalCard('#deseos-external-search-input', '#deseos-external-search-results', function(card) {
            addCardToWishlist(card);
        });
    });

    $('#deseos-external-search-input').keypress(function(e) {
        if (e.which == 13) {
            e.preventDefault();
            $('#btn-deseos-external-search').click();
        }
    });

    // Navigation and Logout
    $('#avatar-btn').click(function(e) {
        e.stopPropagation();
        $('#user-dropdown').toggleClass('active');
    });

    $(document).on('click', function(e) {
        if (!$(e.target).closest('.user-menu-container').length) {
            $('#user-dropdown').removeClass('active');
        }
    });

    $('#menu-btn-logout').click(async function(e) {
        e.preventDefault();
        await _supabase.auth.signOut();
        location.href = 'admin.html';
    });
});

async function checkSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        const { data: user } = await _supabase
            .from('usuarios')
            .select('id, username')
            .eq('id', session.user.id)
            .single();

        if (user) {
            currentUser = user;
            $('#authenticated-content').show();
            $('#top-panel').show();
            $('#dropdown-user-name').text(user.username);
            loadWishlist();
        } else {
            showLoginView();
        }
    } else {
        showLoginView();
    }
}

function showLoginView() {
    $('#login-modal').addClass('active');
    $('#authenticated-content').hide();
}

function initTheme() {
    const savedTheme = localStorage.getItem('tcg_theme') || 'theme-dark';
    $('body').addClass(savedTheme);
}

async function loadWishlist() {
    $('#wishlist-list').html('<div class="loading">Cargando lista de deseos...</div>');

    const { data: wishlist, error } = await _supabase
        .from('wishlist')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        $('#wishlist-list').html('<div class="error">Error al cargar la lista.</div>');
        console.error(error);
        return;
    }

    if (wishlist.length === 0) {
        $('#wishlist-list').html('<div class="empty">No tienes cartas en tu lista de deseos. ¡Busca una arriba para empezar!</div>');
        return;
    }

    const $container = $('#wishlist-list');
    $container.empty();

    wishlist.forEach(item => {
        const $card = $(`
            <div class="album-card wishlist-item" data-id="${item.id}" style="position: relative; padding: 15px; gap: 8px; ${item.obtained ? 'opacity: 0.7;' : ''}">
                <div class="btn-delete-card-top btn-delete-wishlist" data-id="${item.id}" title="Eliminar"><i class="fas fa-times"></i></div>

                <div style="position: relative; width: 100%;">
                    <div style="position: absolute; top: 5px; left: 5px; z-index: 10;">
                        <label class="wishlist-checkbox-container">
                            <input type="checkbox" class="wishlist-toggle-obtained" ${item.obtained ? 'checked' : ''}>
                            <span class="wishlist-checkbox-custom"></span>
                            <span class="wishlist-status-text">${item.obtained ? '¡CONSEGUIDA!' : 'BUSCANDO'}</span>
                        </label>
                    </div>
                    <img src="${item.image_url}" style="width: 100%; height: 160px; object-fit: contain; border-radius: 8px; background: rgba(0,0,0,0.2);">
                </div>

                <div style="font-weight: bold; font-size: 13px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.name}">${item.name}</div>

                <div style="display: flex; gap: 8px; width: 100%;">
                    <div class="form-group" style="margin-bottom: 0; flex: 2;">
                        <label style="font-size: 9px; margin-bottom: 2px;">RAREZA</label>
                        <input type="text" class="wishlist-field" data-field="rarity" value="${item.rarity || ''}" placeholder="Rareza" style="padding: 6px; font-size: 11px;">
                    </div>
                    <div class="form-group" style="margin-bottom: 0; flex: 1;">
                        <label style="font-size: 9px; margin-bottom: 2px;">CANT.</label>
                        <input type="number" class="wishlist-field" data-field="quantity" value="${item.quantity || 1}" style="padding: 6px; font-size: 11px;">
                    </div>
                </div>

                <div class="form-group" style="margin-bottom: 0; width: 100%;">
                    <label style="font-size: 9px; margin-bottom: 2px;">NOTAS</label>
                    <input type="text" class="wishlist-field" data-field="notes" value="${item.notes || ''}" placeholder="Notas adicionales..." style="padding: 6px; font-size: 11px;">
                </div>
            </div>
        `);

        // Listeners
        $card.find('.wishlist-field').on('change', function() {
            const field = $(this).data('field');
            const value = $(this).val();
            updateWishlistItem(item.id, { [field]: value });
        });

        $card.find('.wishlist-toggle-obtained').on('change', function() {
            const obtained = $(this).is(':checked');
            updateWishlistItem(item.id, { obtained });
            $card.css('opacity', obtained ? '0.7' : '1');
            $card.find('.wishlist-status-text').text(obtained ? '¡CONSEGUIDA!' : 'BUSCANDO');
        });

        $card.find('.btn-delete-wishlist').click(function(e) {
            e.stopPropagation();
            deleteWishlistItem(item.id);
        });

        $container.append($card);
    });
}

async function addCardToWishlist(card) {
    const { error } = await _supabase
        .from('wishlist')
        .insert([{
            user_id: currentUser.id,
            name: card.name,
            image_url: card.high_res,
            game: card.image.includes('tcgdex') ? 'pokemon' : 'yugioh'
        }]);

    if (error) {
        Swal.fire('Error', 'No se pudo añadir a la lista', 'error');
    } else {
        Swal.fire({
            title: '¡Añadida!',
            text: card.name,
            icon: 'success',
            timer: 1000,
            showConfirmButton: false
        });
        loadWishlist();
    }
}

async function updateWishlistItem(id, data) {
    const { error } = await _supabase
        .from('wishlist')
        .update(data)
        .eq('id', id);

    if (error) {
        console.error("Error updating wishlist item:", error);
    }
}

async function deleteWishlistItem(id) {
    const result = await Swal.fire({
        title: '¿Eliminar de la lista?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4757',
        confirmButtonText: 'Sí, eliminar'
    });

    if (result.isConfirmed) {
        const { error } = await _supabase.from('wishlist').delete().eq('id', id);
        if (error) {
            Swal.fire('Error', 'No se pudo eliminar', 'error');
        } else {
            loadWishlist();
        }
    }
}

async function searchExternalCard(inputSelector, resultsSelector, onSelectCallback) {
    const query = $(inputSelector).val().trim();

    if (query.length < 3) {
        Swal.fire('Atención', 'Por favor, escribe al menos 3 caracteres para buscar.', 'info');
        return;
    }

    $(resultsSelector).html('<div style="grid-column: 1/-1; text-align: center; padding: 10px; color: #666;">Buscando...</div>');

    try {
        const ygoSpecialSearch = async () => {
            const q = query.toUpperCase();
            if (/^\d{5,10}$/.test(q)) {
                const r = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${q}`).then(res => res.json()).catch(() => ({data:[]}));
                return r.data || [];
            }
            const setMatch = q.match(/^([A-Z0-9]{3,6})-([A-Z0-9]{3,8})$/);
            if (setMatch) {
                const prefix = setMatch[1];
                const sets = await getYgoSets();
                const setObj = sets.find(s => s.set_code.toUpperCase() === prefix);
                if (setObj) {
                    const r = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(setObj.set_name)}`).then(res => res.json()).catch(() => ({data:[]}));
                    if (r.data) {
                        return r.data.filter(c => c.card_sets && c.card_sets.some(s => s.set_code.toUpperCase() === q));
                    }
                }
            }
            return [];
        };

        const searchPromises = [
            fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : {data:[]}).catch(() => ({data:[]})),
            ygoSpecialSearch(),
            fetch(`https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : []).catch(() => []),
            fetch(`https://api.tcgdex.net/v2/es/cards?name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : []).catch(() => [])
        ];

        const [ygName, ygSpecial, pkEn, pkEs] = await Promise.all(searchPromises);

        let combinedResults = [];
        [...(ygName.data || []), ...ygSpecial].forEach(c => {
            if (c.card_images) {
                c.card_images.forEach(img => {
                    combinedResults.push({ name: c.name, image: img.image_url_small, high_res: img.image_url });
                });
            }
        });

        [...(pkEn || []), ...(pkEs || [])].forEach(c => {
            if (c.image) {
                combinedResults.push({ name: c.name, image: `${c.image}/low.webp`, high_res: `${c.image}/high.webp` });
            }
        });

        const uniqueResults = [];
        const seenImages = new Set();
        combinedResults.forEach(card => {
            if (!seenImages.has(card.image)) {
                seenImages.add(card.image);
                uniqueResults.push(card);
            }
        });

        displayExternalResults(uniqueResults.slice(0, 50), resultsSelector, onSelectCallback);
    } catch (err) {
        console.error(err);
        $(resultsSelector).html('<div style="grid-column: 1/-1; text-align: center; padding: 10px; color: #ff4757;">Error al buscar.</div>');
    }
}

function displayExternalResults(results, resultsSelector, onSelectCallback) {
    const $container = $(resultsSelector);
    $container.empty();
    if (results.length === 0) {
        $container.html('<div style="grid-column: 1/-1; text-align: center; padding: 10px; color: #666;">No hay resultados.</div>');
        return;
    }
    results.forEach(card => {
        const $item = $(`
            <div class="external-card-result" title="${card.name}" style="cursor: pointer; transition: transform 0.2s;">
                <img src="${card.image}" style="width: 100%; border-radius: 4px; border: 1px solid #333;">
            </div>
        `);
        $item.click(() => onSelectCallback(card));
        $container.append($item);
    });
}
