-- ============================================================================
-- Cache-Control en los objetos de Storage (modelos 3D y accesorios)
-- ============================================================================
-- OJO / IMPORTANTE (verificado en producción):
--   Este script actualiza la columna `storage.objects.metadata->>'cacheControl'`
--   (el "espejo" en la base de datos), pero NO cambia la cabecera que se sirve
--   en /storage/v1/object/public/... En el Storage actual (backend S3) la
--   cabecera Cache-Control sale del `CacheControl` del objeto en S3.
--
--   Cómo se arregla de verdad (sin descargar ni re-subir bytes):
--     POST /storage/v1/object/copy
--     { "bucketId": "spirits", "sourceKey": "<path>", "destinationKey": "<path>",
--       "metadata": { "cacheControl": "public, max-age=31536000, immutable" },
--       "copyMetadata": false }
--     con header `x-upsert: true`.
--   Es un S3 CopyObject con MetadataDirective=REPLACE: conserva contenido,
--   tamaño y mimetype y solo cambia los metadatos. En admin.html -> Mis
--   Asistentes -> "Reparar caché de modelos" se hace para todo el bucket.
--
--   También hay que subir los archivos nuevos con el valor COMPLETO:
--     cacheControl: 'public, max-age=31536000, immutable'
--   Si se pasa solo '31536000', la cabecera sale `public, 31536000` (inválida)
--   y el CDN termina sirviendo 3600.
--
--   "Cached Egress" es el egress servido por el CDN con cache hits. Con la
--   cabecera de 1 año el navegador no vuelve a pedir el modelo, así que cada
--   visitante solo lo descarga una vez.
--
--   Cloudinary sigue disponible como opción secundaria (selector del modal y
--   botón "Copiar modelos a Cloudinary"), pero ya no es necesaria.
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
