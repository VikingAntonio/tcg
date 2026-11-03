-- SQL Migration: Asistentes 3D (Spirits) Tienda, Micropagos y Desbloqueos
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase.

-- 1. Añadir campos a la tabla 'spirits' para soporte de micropagos y estados de venta
-- sale_status: 'available' (disponible para todos o según plan), 'for_sale' (de paga en la tienda), 'hidden' (oculto / privado)
-- price_mxn: precio en Pesos Mexicanos (ej. 50.00)
-- stripe_price_id: opcional, si deseas vincular un Price ID directo de Stripe
ALTER TABLE public.spirits
ADD COLUMN IF NOT EXISTS sale_status TEXT DEFAULT 'available',
ADD COLUMN IF NOT EXISTS price_mxn NUMERIC DEFAULT 50,
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

COMMENT ON COLUMN public.spirits.sale_status IS 'Estado del asistente: available (gratis/plan), for_sale (de paga en tienda), hidden (oculto)';
COMMENT ON COLUMN public.spirits.price_mxn IS 'Precio en Pesos Mexicanos para compras directas tipo micropago en la tienda';
COMMENT ON COLUMN public.spirits.stripe_price_id IS 'ID de precio opcional en Stripe (price_...)';

-- 2. Añadir columna a la tabla 'usuarios' para registrar los asistentes comprados de por vida
ALTER TABLE public.usuarios
ADD COLUMN IF NOT EXISTS purchased_spirit_ids TEXT DEFAULT '';

COMMENT ON COLUMN public.usuarios.purchased_spirit_ids IS 'Lista separada por comas de IDs de asistentes adquiridos mediante pago único';

-- 3. Crear índice para optimizar consultas de asistentes en venta
CREATE INDEX IF NOT EXISTS idx_spirits_sale_status ON public.spirits(sale_status);
