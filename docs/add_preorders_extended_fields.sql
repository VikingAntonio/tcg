-- ====================================================================
-- ACTUALIZACIÓN DE SCHEMA PARA PREVENTAS (public.preorders)
-- ====================================================================
-- Ejecuta este script SQL en el editor SQL de Supabase para añadir los
-- nuevos campos solicitados para la gestión avanzada de preventas.

ALTER TABLE public.preorders
  ADD COLUMN IF NOT EXISTS cost_price text DEFAULT '',
  ADD COLUMN IF NOT EXISTS max_stock numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS per_person_limit numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reserve_amount text DEFAULT '',
  ADD COLUMN IF NOT EXISTS start_date text DEFAULT '',
  ADD COLUMN IF NOT EXISTS arrival_date text DEFAULT '',
  ADD COLUMN IF NOT EXISTS clients_list jsonb DEFAULT '[]'::jsonb;

-- Comentarios explicativos
COMMENT ON COLUMN public.preorders.reserve_amount IS 'Monto mínimo para apartar el producto en preventa';
COMMENT ON COLUMN public.preorders.cost_price IS 'Precio de compra o costo privado para la tienda';
COMMENT ON COLUMN public.preorders.max_stock IS 'Cantidad máxima de productos disponibles en preventa';
COMMENT ON COLUMN public.preorders.per_person_limit IS 'Límite máximo de productos por cliente';
COMMENT ON COLUMN public.preorders.start_date IS 'Fecha de inicio de la preventa';
COMMENT ON COLUMN public.preorders.arrival_date IS 'Fecha estimada de llegada del producto';
COMMENT ON COLUMN public.preorders.clients_list IS 'Lista interna de clientes en JSONB. Estructura recomendada por cliente: { id, name, qty, deposit, status_payment ("Pendiente"|"Pago Parcial"|"Liquidado"), status_delivery ("Por Entregar"|"En Camino"|"Entregado"|"Retrasado"), date }';
