// Supabase configuration
const SUPABASE_URL = 'https://ehszvqwftqgxjggnbcmt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoc3p2cXdmdHFneGpnZ25iY210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NDI5MjAsImV4cCI6MjA4NTMxODkyMH0.wh8_Xy4_w9roFxMgbJ-J9A3r5V7duUjnStl4ZsZ0804';

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Convierte una URL pública de Supabase a una URL firmada (signed URL) para mayor protección.
 * Esto dificulta que los usuarios capturen la URL original desde el inspector de red.
 * Nota: Para máxima seguridad, el bucket debe estar configurado como privado.
 */
async function getProtectedUrl(publicUrl) {
    if (!publicUrl || !publicUrl.includes('storage/v1/object/public/')) {
        return publicUrl;
    }
    try {
        const parts = publicUrl.split('/storage/v1/object/public/');
        const pathParts = parts[1].split('/');
        const bucket = pathParts[0];
        const filePath = pathParts.slice(1).join('/');

        const { data, error } = await _supabase.storage.from(bucket).createSignedUrl(filePath, 3600);
        if (error) throw error;
        return data.signedUrl;
    } catch (e) {
        console.warn("No se pudo generar URL firmada, usando URL pública:", e);
        return publicUrl;
    }
}

// Global SweetAlert2 configuration
if (typeof Swal !== 'undefined') {
    window.Swal = Swal.mixin({
        position: 'top',
        showConfirmButton: true
    });
}
