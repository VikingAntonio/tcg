-- ====================================================================
-- G) Columnas faltantes para el guardado por lotes de packages.html
-- ====================================================================
-- El guardado por lotes (botón "Guardar en BDD Global") inserta un campo
-- `description` (y `model_url` para accesorios 3D) que no existía en el
-- esquema. PostgREST rechazaba el INSERT completo con:
--   "Could not find the 'description' column of 'viking_data' in the schema cache"
-- y por eso se guardaban 0 registros.
--
-- Este script SOLO AÑADE columnas (idempotente con IF NOT EXISTS).
-- No elimina, renombra ni modifica ninguna columna ni dato existente.
-- Ejecutar en el SQL Editor de Supabase.

-- 1. viking_data: cartas sueltas, accesorios legados, etc.
ALTER TABLE public.viking_data
    ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- 2. accessories: accesorios (sleeves, deckbox, coin, mats, dados...)
ALTER TABLE public.accessories
    ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS model_url TEXT DEFAULT NULL;

-- 3. sealed_products: productos sellados
ALTER TABLE public.sealed_products
    ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- 4. preorders: preventas
ALTER TABLE public.preorders
    ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- 5. Recargar el esquema de PostgREST para que las nuevas columnas queden
--    disponibles de inmediato (evita el error "schema cache").
NOTIFY pgrst, 'reload schema';
