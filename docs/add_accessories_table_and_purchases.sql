-- SQL Migration: Add Accessories Table and Purchases for Deck Customization Monetization
-- Run this in Supabase SQL Editor to support Accessories management via Cloudinary/Supabase and Paid Accessories

-- 1. Create accessories table
CREATE TABLE IF NOT EXISTS public.accessories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'sleeves', -- 'sleeves', 'deckbox', 'coin', 'mats'
    sale_status TEXT DEFAULT 'disponible', -- 'disponible', 'de_paga', 'oculto'
    price_mxn NUMERIC DEFAULT 25.00,
    stripe_price_id TEXT DEFAULT NULL,
    target_roles TEXT[] DEFAULT ARRAY['starter', 'premium', 'tienda'],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Add purchased_accessory_ids to usuarios table to record single micro-purchases
ALTER TABLE public.usuarios
ADD COLUMN IF NOT EXISTS purchased_accessory_ids TEXT DEFAULT '';

-- 3. Comments for documentation
COMMENT ON TABLE public.accessories IS 'Catálogo central de accesorios (sleeves, deckbox, coin, mats) administrado desde packages.html';
COMMENT ON COLUMN public.accessories.category IS 'Categoría del accesorio: sleeves (micas), deckbox (portadecks), coin (monedas), mats (playmat)';
COMMENT ON COLUMN public.accessories.sale_status IS 'Estado: disponible (incluido gratis para el plan), de_paga (requiere micropago), oculto (no visible)';
COMMENT ON COLUMN public.accessories.target_roles IS 'Planes que tienen acceso al accesorio: starter, premium, tienda';
COMMENT ON COLUMN public.usuarios.purchased_accessory_ids IS 'Lista separada por comas de IDs de accesorios comprados individualmente por el usuario';

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.accessories ENABLE ROW LEVEL SECURITY;

-- 5. Policies: Public can read, Admins can do everything
CREATE POLICY "Allow public read accessories" ON public.accessories
    FOR SELECT USING (true);

CREATE POLICY "Allow admin all accessories" ON public.accessories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.usuarios
            WHERE usuarios.id = auth.uid() AND usuarios.role = 'admin'
        ) OR auth.role() = 'service_role' OR auth.role() = 'authenticated'
    );

-- 6. Migrate existing accessories from viking_data if any exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'viking_data'
    ) THEN
        INSERT INTO public.accessories (name, image_url, category, sale_status, price_mxn, target_roles)
        SELECT
            vd.name,
            vd.image_url,
            CASE
                WHEN LOWER(COALESCE(vd.rarity, vd.expansion, '')) IN ('mats', 'playmat', 'playmats', 'mat') THEN 'mats'
                WHEN LOWER(COALESCE(vd.rarity, vd.expansion, '')) = 'deckbox' THEN 'deckbox'
                WHEN LOWER(COALESCE(vd.rarity, vd.expansion, '')) = 'coin' THEN 'coin'
                ELSE 'sleeves'
            END AS category,
            'disponible' AS sale_status,
            25.00 AS price_mxn,
            ARRAY['starter', 'premium', 'tienda'] AS target_roles
        FROM public.viking_data vd
        WHERE (vd.type = 'accessories' OR vd.type = 'accessory')
          AND vd.image_url IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.accessories a WHERE a.image_url = vd.image_url
          );
    END IF;
END $$;
