-- ============================================================================
-- Cache-Control largo para los archivos de Storage (modelos 3D y accesorios)
-- ============================================================================
-- Problema: los objetos del bucket `spirits` se sirven con
--   cache-control: private, no-cache
--   cf-cache-status: DYNAMIC
-- así que el navegador (y el CDN de Supabase) vuelven a pedir el archivo en
-- cada visita. Cada asistente pesa ~2.7 MB (.bin) + texturas, y eso infló el
-- "Cached Egress" del plan hasta pasarse del límite.
--
-- Este script marca los objetos como inmutables durante un año. Los archivos
-- del bucket se guardan con un nombre único por subida
-- (models/<timestamp>_<random>/...), así que son seguros de cachear para
-- siempre: si se reemplaza un modelo, cambia la ruta.
--
-- Es idempotente: se puede ejecutar las veces que haga falta.
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================================

UPDATE storage.objects
SET cache_control = 'public, max-age=31536000, immutable'
WHERE bucket_id = 'spirits'
  AND (cache_control IS NULL OR cache_control NOT LIKE '%max-age=31536000%');

UPDATE storage.objects
SET cache_control = 'public, max-age=31536000, immutable'
WHERE bucket_id = 'accessories'
  AND (cache_control IS NULL OR cache_control NOT LIKE '%max-age=31536000%');

-- Comprobación rápida
SELECT bucket_id, count(*) AS objetos, max(cache_control) AS cache_control
FROM storage.objects
WHERE bucket_id IN ('spirits', 'accessories')
GROUP BY bucket_id;
