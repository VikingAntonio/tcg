-- ====================================================================
-- ACTUALIZACIÓN DE SCHEMA PARA PRODUCTOS SELLADOS (public.sealed_products)
-- ====================================================================
-- Ejecuta este script SQL en el editor SQL de Supabase para añadir los
-- nuevos campos solicitados para la gestión de productos sellados.

ALTER TABLE public.sealed_products
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'Disponible',
  ADD COLUMN IF NOT EXISTS discount text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cost_price text DEFAULT '',
  ADD COLUMN IF NOT EXISTS estimated_profit text DEFAULT '';

-- Comentario explicativo
COMMENT ON COLUMN public.sealed_products.status IS 'Estado del producto: Disponible, Agotado, Poco Stock, En Camino';
COMMENT ON COLUMN public.sealed_products.discount IS 'Descuento aplicado al producto (ej. 10% o $100)';
COMMENT ON COLUMN public.sealed_products.cost_price IS 'Precio de compra o costo privado del vendedor';
COMMENT ON COLUMN public.sealed_products.estimated_profit IS 'Ganancia unitaria estimada calculada para el vendedor';
