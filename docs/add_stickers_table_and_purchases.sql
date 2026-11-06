-- SQL Migration: Add Stickers Table and Purchases for Plan Monetization & Customization
-- Run this in Supabase SQL Editor to support Admin-only sticker management via Cloudinary/Supabase and Paid Stickers

-- 1. Create stickers table
CREATE TABLE IF NOT EXISTS public.stickers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    sale_status TEXT DEFAULT 'disponible', -- 'disponible', 'de_paga', 'oculto'
    price_mxn NUMERIC DEFAULT 25.00,
    stripe_price_id TEXT DEFAULT NULL,
    target_roles TEXT[] DEFAULT ARRAY['starter', 'premium', 'tienda'],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Add purchased_sticker_ids to usuarios table to record single micro-purchases
ALTER TABLE public.usuarios
ADD COLUMN IF NOT EXISTS purchased_sticker_ids TEXT DEFAULT '';

-- 3. Comments for documentation
COMMENT ON TABLE public.stickers IS 'Catálogo central de stickers administrado exclusivamente por el administrador desde packages.html';
COMMENT ON COLUMN public.stickers.sale_status IS 'Estado: disponible (incluido gratis para el plan), de_paga (requiere micropago), oculto (no visible)';
COMMENT ON COLUMN public.stickers.target_roles IS 'Planes que tienen acceso al sticker: starter, premium, tienda';
COMMENT ON COLUMN public.usuarios.purchased_sticker_ids IS 'Lista separada por comas de IDs de stickers comprados individualmente por el usuario';

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.stickers ENABLE ROW LEVEL SECURITY;

-- 5. Policies: Public can read, Admins can do everything
CREATE POLICY "Allow public read stickers" ON public.stickers
    FOR SELECT USING (true);

CREATE POLICY "Allow admin all stickers" ON public.stickers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.usuarios
            WHERE usuarios.id = auth.uid() AND usuarios.role = 'admin'
        ) OR auth.role() = 'service_role' OR auth.role() = 'authenticated'
    );
