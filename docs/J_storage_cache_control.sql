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
-- se guardan con un nombre único por subida (models/<timestamp>_<random>/...),
-- así que son seguros de cachear para siempre: si se reemplaza un modelo,
-- cambia la ruta.
--
-- OJO con el esquema: las instalaciones nuevas de Supabase ya no tienen la
-- columna `storage.objects.cache_control`; el valor vive en
-- `storage.objects.metadata->>'cacheControl'`. El bloque de abajo detecta cuál
-- existe y usa la que corresponda, así que sirve en ambos casos.
--
-- Es idempotente: se puede ejecutar las veces que haga falta.
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================================

DO $$
DECLARE
    tiene_columna boolean;
    valor          text := 'public, max-age=31536000, immutable';
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'storage'
          AND table_name = 'objects'
          AND column_name = 'cache_control'
    ) INTO tiene_columna;

    IF tiene_columna THEN
        EXECUTE 'UPDATE storage.objects
                    SET cache_control = ''public, max-age=31536000, immutable''
                  WHERE bucket_id IN (''spirits'', ''accessories'')
                    AND coalesce(cache_control, '''') NOT LIKE ''%max-age=31536000%''';
    ELSE
        UPDATE storage.objects
           SET metadata = jsonb_set(
                   coalesce(metadata, '{}'::jsonb),
                   '{cacheControl}',
                   to_jsonb(valor),
                   true
               )
         WHERE bucket_id IN ('spirits', 'accessories')
           AND coalesce(metadata ->> 'cacheControl', '') NOT LIKE '%max-age=31536000%';
    END IF;
END
$$;

-- Comprobación: debe mostrar "con_cache_largo" = "objetos" en cada bucket.
-- to_jsonb(o) funciona con los dos esquemas (con o sin columna cache_control).
SELECT bucket_id,
       count(*) AS objetos,
       count(*) FILTER (
           WHERE coalesce(to_jsonb(o) ->> 'cache_control',
                          o.metadata ->> 'cacheControl',
                          '') LIKE '%max-age=31536000%'
       ) AS con_cache_largo
FROM storage.objects o
WHERE bucket_id IN ('spirits', 'accessories')
GROUP BY bucket_id;
