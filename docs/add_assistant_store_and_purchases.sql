-- SQL Migration: Add monetization fields for 3D assistants (spirits) and user purchases
-- Run this in Supabase SQL Editor if columns do not exist yet.

-- 1. Add fields to spirits table for status and pricing
ALTER TABLE public.spirits
ADD COLUMN IF NOT EXISTS sale_status TEXT DEFAULT 'disponible',
ADD COLUMN IF NOT EXISTS price_mxn NUMERIC DEFAULT 50.00,
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT DEFAULT NULL;

-- 2. Add purchased_spirit_ids to usuarios table to track unlocked micropurchases
ALTER TABLE public.usuarios
ADD COLUMN IF NOT EXISTS purchased_spirit_ids TEXT DEFAULT '';

-- Comment description
COMMENT ON COLUMN public.spirits.sale_status IS 'Estado del asistente: disponible (gratis/según paquete), oculto (no visible), de_paga (requiere micropago)';
COMMENT ON COLUMN public.spirits.price_mxn IS 'Precio en Pesos Mexicanos (MXN) para desbloqueo permanente';
COMMENT ON COLUMN public.spirits.stripe_price_id IS 'Opcional: ID de precio de Stripe (ej: price_...)';
COMMENT ON COLUMN public.usuarios.purchased_spirit_ids IS 'Lista separada por comas de IDs de espíritus/asistentes comprados por el usuario';
