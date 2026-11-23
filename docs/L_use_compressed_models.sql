-- ============================================================================
-- Usar los modelos 3D comprimidos (GLB + Draco)
-- ============================================================================
-- Los tres asistentes más pesados ya tienen una versión comprimida subida al
-- mismo bucket, en la misma carpeta que el original:
--
--   Eveningstar   12.98 MB → 1.97 MB   (3.1M → 0.33M triángulos)
--   alluber        8.99 MB → 1.46 MB
--   ghostOgre      8.98 MB → 1.73 MB
--
-- La compresión es con `gltf-transform optimize --compress draco
-- --simplify-ratio 0.08 --simplify-error 0.001`. Se verificó que model-viewer
-- (escritorio) y three.js + DRACOLoader (móvil) cargan el .glb sin errores y
-- que el render a 320 px es visualmente idéntico.
--
-- Este script solo cambia `spirits.gltf_url` para esos tres registros. Los
-- archivos originales (.gltf + .bin + texturas) NO se borran: quedan como
-- respaldo y se pueden recuperar revirtiendo esta actualización.
--
-- Ejecutar en Supabase → SQL Editor. Es idempotente.
-- ============================================================================

with cambios(carpeta, archivo) as (
    values
        ('1786875591304_944', 'Eveningstar'),
        ('1786870284300_175', 'alluber'),
        ('1786875797409_956', 'ghostOgre')
)
update public.spirits s
set gltf_url = regexp_replace(s.gltf_url, '\.gltf$', '.glb')
from cambios c
where s.gltf_url like '%/models/' || c.carpeta || '/' || c.archivo || '.gltf';

-- Verificación: las tres URLs deben terminar en .glb
select id, name, gltf_url
from public.spirits
where gltf_url like '%/models/1786875591304_944/%'
   or gltf_url like '%/models/1786870284300_175/%'
   or gltf_url like '%/models/1786875797409_956/%'
order by id;
