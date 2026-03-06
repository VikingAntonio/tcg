$(document).ready(async function() {
    // Check if we have a session (Supabase sets it automatically from the recovery link)
    const { data: { session } } = await _supabase.auth.getSession();

    if (!session) {
        // If no session, it might be an invalid or expired link
        Swal.fire({
            title: 'Enlace Inválido',
            text: 'Este enlace de recuperación ha expirado o no es válido.',
            icon: 'error'
        }).then(() => {
            window.location.href = 'index.html';
        });
        return;
    }

    // Show the reset container and hide the loader
    $('#loader-view').hide();
    $('#reset-container').fadeIn();

    $('#btn-update-password').click(async function() {
        const newPassword = $('#new-password').val().trim();
        const confirmPassword = $('#confirm-password').val().trim();

        if (!newPassword || !confirmPassword) {
            Swal.fire('Atención', 'Por favor, completa ambos campos.', 'warning');
            return;
        }

        if (newPassword.length < 6) {
            Swal.fire('Atención', 'La contraseña debe tener al menos 6 caracteres.', 'warning');
            return;
        }

        if (newPassword !== confirmPassword) {
            Swal.fire('Atención', 'Las contraseñas no coinciden.', 'warning');
            return;
        }

        Swal.fire({
            title: 'Actualizando...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            const { error } = await _supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            // Log out and redirect to login
            await _supabase.auth.signOut();
            localStorage.removeItem('tcg_session');

            Swal.fire({
                title: '¡Contraseña Actualizada!',
                text: 'Tu contraseña se ha cambiado correctamente. Ahora puedes iniciar sesión con tus nuevas credenciales.',
                icon: 'success',
                timer: 3000,
                showConfirmButton: true
            }).then(() => {
                window.location.href = 'index.html';
            });

        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'No se pudo actualizar la contraseña: ' + err.message, 'error');
        }
    });
});
