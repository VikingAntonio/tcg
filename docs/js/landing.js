$(document).ready(function() {
    checkSession();
    initTheme();
    loadStoresSlider();
    updateCartCount();

    // --- Auth Modal Toggling ---
    $('#btn-open-auth, #btn-cta-register').click(function(e) {
        e.preventDefault();
        $('#auth-modal').addClass('active');
        if ($(this).attr('id') === 'btn-cta-register') {
            showRegister();
        } else {
            showLogin();
        }
    });

    $('#close-auth-modal, #auth-modal').click(function(e) {
        if (e.target === this || $(e.target).attr('id') === 'close-auth-modal') {
            $('#auth-modal').removeClass('active');
        }
    });

    $('#link-show-register').click(function(e) {
        e.preventDefault();
        showRegister();
    });

    $('#link-show-login').click(function(e) {
        e.preventDefault();
        showLogin();
    });

    function showLogin() {
        $('#register-view').hide();
        $('#login-view').show();
    }

    function showRegister() {
        $('#login-view').hide();
        $('#register-view').show();
    }

    // --- Authentication ---
    $('#btn-login').click(handleLogin);
    $('#btn-register').click(handleRegister);

    async function handleLogin() {
        const username = $('#login-username').val().trim();
        const password = $('#login-password').val().trim();

        if (!username || !password) {
            Swal.fire('Atención', 'Por favor, completa todos los campos', 'warning');
            return;
        }

        const { data, error } = await _supabase
            .from('usuarios')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (error || !data) {
            Swal.fire('Error', 'Usuario o contraseña incorrectos', 'error');
        } else {
            localStorage.setItem('tcg_session', JSON.stringify(data));
            Swal.fire({
                title: '¡Bienvenido!',
                text: 'Has iniciado sesión correctamente',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            }).then(() => {
                location.reload();
            });
        }
    }

    async function handleRegister() {
        const email = $('#reg-email').val().trim();
        const username = $('#reg-username').val().trim();
        const password = $('#reg-password').val().trim();

        if (!email || !username || !password) {
            Swal.fire('Atención', 'Por favor, completa todos los campos', 'warning');
            return;
        }

        // Check if username already exists
        const { data: existingUser } = await _supabase
            .from('usuarios')
            .select('username')
            .eq('username', username)
            .single();

        if (existingUser) {
            Swal.fire('Error', 'El nombre de usuario ya está en uso', 'error');
            return;
        }

        // Create new user
        const { data, error } = await _supabase
            .from('usuarios')
            .insert([{
                username,
                password,
                email,
                role: 'starter',
                is_store: false,
                max_albums: 3,
                max_pages: 5,
                max_decks: 1,
                max_cards_per_deck: 60
            }])
            .select()
            .single();

        if (error) {
            Swal.fire('Error', 'No se pudo crear la cuenta: ' + error.message, 'error');
        } else {
            localStorage.setItem('tcg_session', JSON.stringify(data));
            Swal.fire({
                title: '¡Cuenta Creada!',
                text: 'Tu cuenta ha sido creada y has iniciado sesión',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            }).then(() => {
                location.reload();
            });
        }
    }

    // --- Session & Header ---
    function checkSession() {
        const session = localStorage.getItem('tcg_session');
        const $authItems = $('#auth-menu-items');
        $authItems.empty();

        if (session) {
            const user = JSON.parse(session);
            $('#dropdown-user-name').text(user.username);
            $('#dropdown-user-role').text(user.role || 'Usuario');

            $authItems.append('<a href="admin.html" class="menu-item"><i class="fas fa-lock"></i> Panel Admin</a>');
            $authItems.append('<a href="#" class="menu-item logout" id="btn-logout"><i class="fas fa-sign-out-alt"></i> Cerrar Sesión</a>');

            $('#btn-open-auth').text('Ir al Panel').attr('href', 'admin.html').attr('id', '');
        } else {
            $('#dropdown-user-name').text('Invitado');
            $('#dropdown-user-role').text('Invitado');
            $authItems.append('<a href="#" class="menu-item" id="btn-menu-login"><i class="fas fa-sign-in-alt"></i> Iniciar Sesión</a>');
        }
    }

    $(document).on('click', '#btn-logout', function(e) {
        e.preventDefault();
        localStorage.removeItem('tcg_session');
        location.reload();
    });

    $(document).on('click', '#btn-menu-login', function(e) {
        e.preventDefault();
        $('#auth-modal').addClass('active');
        showLogin();
        $('#user-dropdown').removeClass('active');
    });

    // --- Floating Panel Logic ---
    $('#avatar-btn').click(function(e) {
        e.stopPropagation();
        $('#user-dropdown').toggleClass('active');
    });

    $(document).on('click', function(e) {
        if (!$(e.target).closest('.user-menu-container').length) {
            $('#user-dropdown').removeClass('active');
        }
    });

    // --- Theme Logic ---
    function initTheme() {
        const savedTheme = localStorage.getItem('tcg_theme') || 'theme-dark';
        applyTheme(savedTheme);
    }

    function applyTheme(theme) {
        $('body').removeClass('theme-light theme-medium theme-dark').addClass(theme);
        localStorage.setItem('tcg_theme', theme);
        $('.theme-btn-small').removeClass('active');
        $(`.theme-btn-small[data-theme="${theme}"]`).addClass('active');
    }

    $('.theme-btn-small').click(function() {
        const theme = $(this).data('theme');
        applyTheme(theme);
    });

    // --- Slider Logic ---
    window.allStoresData = [];

    async function loadStoresSlider() {
        const $wrapper = $('#stores-slider-wrapper');
        $wrapper.html('<div class="loading">Cargando tiendas...</div>');

        const { data: stores, error } = await _supabase
            .from('usuarios')
            .select('*')
            .eq('is_store', true);

        if (error || !stores || stores.length === 0) {
            $wrapper.html('<div class="empty">Próximamente más tiendas.</div>');
            return;
        }

        window.allStoresData = stores;
        $wrapper.empty();
        stores.forEach(store => {
            const storeDisplay = store.store_name || store.username;
            const logoUrl = store.store_logo || 'https://midominio.com/placeholder-logo.png';

            const $slide = $(`
                <div class="swiper-slide">
                    <div class="store-slide" onclick="openBusinessModal('${store.username}')">
                        <div class="store-logo-circle">
                            ${store.store_logo
                                ? `<img src="${store.store_logo}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
                                : `<i class="fas fa-store" style="font-size: 3rem; color: var(--primary-color); display: flex; justify-content: center; align-items: center; height: 100%;"></i>`
                            }
                        </div>
                        <div class="store-name-slide">${storeDisplay}</div>
                        <div style="font-size: 0.8rem; color: #888; margin-top: 5px;">@${store.username}</div>
                    </div>
                </div>
            `);
            $wrapper.append($slide);
        });

        new Swiper('.logos-swiper', {
            slidesPerView: 1,
            spaceBetween: 40,
            loop: stores.length >= 3,
            speed: 1000,
            grabCursor: true,
            centeredSlides: false,
            autoplay: {
                delay: 2500,
                disableOnInteraction: false,
                pauseOnMouseEnter: true
            },
            pagination: {
                el: '.swiper-pagination',
                clickable: true,
                dynamicBullets: true
            },
            breakpoints: {
                640: {
                    slidesPerView: 2,
                    spaceBetween: 30
                },
                1024: {
                    slidesPerView: 3,
                    spaceBetween: 50
                }
            }
        });
    }

    // --- Business Modal ---
    window.openBusinessModal = function(username) {
        const store = window.allStoresData.find(s => s.username === username);
        if (!store) return;

        const storeDisplay = store.store_name || store.username;
        $('#modal-business-name').text(storeDisplay);
        $('#modal-business-logo').attr('src', store.store_logo || 'https://midominio.com/placeholder-logo.png');
        $('#modal-business-email').text(store.email || 'No disponible');
        $('#modal-business-address').text(store.ubicacion || 'Ubicación no disponible');
        $('#modal-business-hours').text(store.horario || 'Horario no disponible');

        const publicUrl = `public.html?store=${encodeURIComponent(storeDisplay)}`;
        $('#modal-business-link').attr('href', publicUrl);

        if (store.messenger_link) {
            $('#row-messenger').show();
            $('#modal-business-messenger').attr('href', store.messenger_link);
        } else {
            $('#row-messenger').hide();
        }

        if (store.whatsapp_link) {
            $('#row-whatsapp').show();
            $('#modal-business-whatsapp').attr('href', store.whatsapp_link);
        } else {
            $('#row-whatsapp').hide();
        }

        $('#business-modal').addClass('active');
    };

    window.closeBusinessModal = function() {
        $('#business-modal').removeClass('active');
    };

    $('#business-modal').click(function(e) {
        if (e.target === this) closeBusinessModal();
    });

    // --- Cart Logic ---
    function updateCartCount() {
        if (typeof Cart !== 'undefined') {
            $('#cart-count').text(Cart.getCount());
        }
    }
});
