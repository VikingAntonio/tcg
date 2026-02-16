$(document).ready(function() {
    let currentUser = null;
    let selectedLogoFile = null;

    checkSession();
    initTheme();

    async function checkSession() {
        const session = localStorage.getItem('tcg_session');
        if (!session) {
            window.location.href = 'admin.html';
            return;
        }

        currentUser = JSON.parse(session);

        // Refresh data from Supabase to get latest
        const { data, error } = await _supabase
            .from('usuarios')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (!error && data) {
            currentUser = data;
            localStorage.setItem('tcg_session', JSON.stringify(data));
        }

        loadProfileData();
        updateHeader();
    }

    function loadProfileData() {
        $('#profile-username').val(currentUser.username);
        $('#profile-email').val(currentUser.email || '');

        if (currentUser.is_store) {
            $('.store-only-field').show();
            $('#profile-store-name').val(currentUser.store_name || '');
            $('#profile-whatsapp').val(currentUser.whatsapp_link || '');
            $('#profile-messenger').val(currentUser.messenger_link || '');
            $('#profile-horario').val(currentUser.horario || '');
            $('#profile-ubicacion').val(currentUser.ubicacion || '');

            if (currentUser.store_logo) {
                $('#profile-logo-preview').attr('src', currentUser.store_logo);
            }
        } else {
            $('.store-only-field').hide();
        }
    }

    function updateHeader() {
        $('#dropdown-user-name').text(currentUser.username);
        $('#dropdown-user-role').text(currentUser.role || 'Usuario');
        if (typeof Cart !== 'undefined') {
            $('#cart-count').text(Cart.getCount());
        }
    }

    // --- Logo Upload Logic ---
    $('#btn-change-logo').click(function() {
        $('#input-logo-file').click();
    });

    $('#input-logo-file').change(function() {
        const file = this.files[0];
        if (file) {
            selectedLogoFile = file;
            const reader = new FileReader();
            reader.onload = function(e) {
                $('#profile-logo-preview').attr('src', e.target.result);
            };
            reader.readAsDataURL(file);
        }
    });

    // --- Save Profile ---
    $('#btn-save-profile').click(async function() {
        const email = $('#profile-email').val().trim();
        const storeName = $('#profile-store-name').val().trim();
        const whatsapp = $('#profile-whatsapp').val().trim();
        const messenger = $('#profile-messenger').val().trim();
        const horario = $('#profile-horario').val().trim();
        const ubicacion = $('#profile-ubicacion').val().trim();

        Swal.fire({
            title: 'Guardando...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            let logoUrl = currentUser.store_logo;

            // 1. Upload Logo if changed
            if (selectedLogoFile) {
                const fileExt = selectedLogoFile.name.split('.').pop();
                const fileName = `${currentUser.id}_${Date.now()}.${fileExt}`;
                const filePath = `${fileName}`;

                const { data, error: uploadError } = await _supabase.storage
                    .from('logos')
                    .upload(filePath, selectedLogoFile);

                if (uploadError) throw uploadError;

                const { data: publicData } = _supabase.storage
                    .from('logos')
                    .getPublicUrl(filePath);

                logoUrl = publicData.publicUrl;
            }

            // 2. Update DB
            const updateData = {
                email: email,
                store_name: storeName,
                whatsapp_link: whatsapp,
                messenger_link: messenger,
                horario: horario,
                ubicacion: ubicacion,
                store_logo: logoUrl
            };

            const { error: dbError } = await _supabase
                .from('usuarios')
                .update(updateData)
                .eq('id', currentUser.id);

            if (dbError) throw dbError;

            // Update local session
            const newUserData = { ...currentUser, ...updateData };
            localStorage.setItem('tcg_session', JSON.stringify(newUserData));
            currentUser = newUserData;

            Swal.fire({
                title: '¡Actualizado!',
                text: 'Tu perfil ha sido guardado correctamente.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });

        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'No se pudo actualizar el perfil: ' + (err.message || ''), 'error');
        }
    });

    // --- Header Actions ---
    $('#avatar-btn').click(function(e) {
        e.stopPropagation();
        $('#user-dropdown').toggleClass('active');
    });

    $(document).on('click', function(e) {
        if (!$(e.target).closest('.user-menu-container').length) {
            $('#user-dropdown').removeClass('active');
        }
    });

    $('#btn-logout').click(function(e) {
        e.preventDefault();
        localStorage.removeItem('tcg_session');
        window.location.href = 'index.html';
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
});
