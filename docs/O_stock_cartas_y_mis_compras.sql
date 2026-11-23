-- ============================================================================
-- Existencias de cartas sueltas + respaldo del historial de compras
-- ----------------------------------------------------------------------------
-- 1) `viking_data` (cartas sueltas) nunca tuvo columna de existencias, pero
--    `create-checkout-session` pedía `quantity` en el SELECT. PostgREST
--    responde 400 "column quantity does not exist", la función no encuentra la
--    carta y devuelve "<carta> ya no está disponible en la tienda.":
--    NINGUNA carta suelta se podía pagar con tarjeta.
--    Se agrega la columna con 1 por defecto (cada carta suelta = 1 pieza).
--
-- 2) `checkout_orders` ya guarda el snapshot JSON de los artículos, así que el
--    historial sobrevive aunque el producto se borre. Solo se agregan índices
--    para la pantalla "Mis compras".
--
-- Idempotente: se puede ejecutar varias veces.
-- ============================================================================

ALTER TABLE public.viking_data ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

UPDATE public.viking_data SET quantity = 1 WHERE quantity IS NULL;

ALTER TABLE public.viking_data ALTER COLUMN quantity SET DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_checkout_orders_user_status
    ON public.checkout_orders(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_entitlements_user_granted
    ON public.user_entitlements(user_id, granted_at DESC);

NOTIFY pgrst, 'reload schema';
