-- ============================================================================
-- Cache-Control en los objetos de Storage (modelos 3D y accesorios)
-- ============================================================================
-- OJO / IMPORTANTE (verificado en producción):
--   Este script actualiza la columna `storage.objects.metadata->>'cacheControl'`
--   (el "espejo" en la base de datos), pero NO cambia la cabecera que se sirve
--   en /storage/v1/object/public/... En el Storage actual (backend S3) la
--   cabecera Cache-Control sale de los metadatos del objeto en S3, que solo se
--   fijan al SUBIR el archivo (header `cache-control`).
--   Resultado real medido con curl:
--     GET  /object/public/spirits/...  ->  cache-control: public, max-age=3600
--     HEAD /object/public/spirits/...  ->  cache-control: private, no-cache
--   Es decir: los objetos antiguos siguen con 1 hora de caché aunque este
--   script diga `max-age=31536000`.
--
--   Para que un objeto tenga caché larga de verdad hay que volver a subirlo:
--     supabase.storage.from('spirits').upload(path, file, {
--       cacheControl: '31536000', upsert: true
--     })
--   (storage-js envía `cache-control: max-age=31536000`).
--
--   La solución recomendada para los modelos 3D es NO servirlos desde Supabase:
--   el plan gratuito solo incluye 5 GB de "Cached Egress" y los .bin pesan
--   varios MB. En admin.html -> Mis Asistentes -> "Migrar modelos a Cloudinary"
--   se copian los modelos a Cloudinary (25 GB gratis) y se actualiza su URL.
--
--   Además, según la documentación de Supabase, "Cached Egress" es justo el
--   egress servido por su CDN con cache hits. Es decir, el contador sube cuando
--   Cloudflare responde HIT. Cachear más tiempo en el CDN no reduce la cuota:
--   solo reduce peticiones si el navegador ya tiene el archivo en su caché (o
--   en el Service Worker), o si el archivo se sirve desde otro host.
--
-- Este script se mantiene porque deja el metadato de la BD coherente y algunas
-- herramientas (dashboard/SDK) lo leen. Es idempotente.
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

-- Comprobación del metadato en la BD (NO es lo que se sirve por HTTP).
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
