// Supabase configuration
const SUPABASE_URL = 'https://ehszvqwftqgxjggnbcmt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoc3p2cXdmdHFneGpnZ25iY210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NDI5MjAsImV4cCI6MjA4NTMxODkyMH0.wh8_Xy4_w9roFxMgbJ-J9A3r5V7duUjnStl4ZsZ0804';

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
window._supabase = _supabase;

// Global SweetAlert2 configuration
if (typeof Swal !== 'undefined') {
    window.Swal = Swal.mixin({
        position: 'top',
        showConfirmButton: true
    });
}

// El Service Worker se registra desde aquí porque este script lo cargan casi
// todas las vistas. Antes solo lo hacían 15 de 45, así que en el resto el
// modelo 3D (~2.7 MB en Supabase Storage) se volvía a descargar en cada visita.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('./sw.js').catch(function(err) {
            console.warn('Service Worker no registrado:', err && err.message);
        });
    });
}
