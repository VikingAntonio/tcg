-- Migration: Tablas para Promociones, Packs Compuestos y Campañas de Regalos
-- VikingTCG Commercial Extensions

-- 1. Promociones
CREATE TABLE IF NOT EXISTS public.product_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL,
    product_category TEXT NOT NULL, -- 'stickers', 'sleeves', 'deckbox', 'mats', 'coin', 'spirits', 'packs'
    original_price NUMERIC(10, 2) NOT NULL,
    promo_price NUMERIC(10, 2) NOT NULL,
    discount_percent NUMERIC(5, 2) DEFAULT 0,
    discount_type TEXT DEFAULT 'percent', -- 'percent', 'fixed'
    is_permanent BOOLEAN DEFAULT FALSE,
    is_limited_time BOOLEAN DEFAULT FALSE,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    status TEXT DEFAULT 'active', -- 'active', 'paused', 'finished'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Packs Compuestos
CREATE TABLE IF NOT EXISTS public.product_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    image_url TEXT NOT NULL,
    extra_images JSONB DEFAULT '[]'::jsonb,
    items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {id, name, category, quantity, image_url, price_mxn}
    normal_price NUMERIC(10, 2) NOT NULL,
    promo_price NUMERIC(10, 2),
    is_limited_time BOOLEAN DEFAULT FALSE,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    status TEXT DEFAULT 'published', -- 'published', 'paused', 'finished'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Registro de compras de packs (Snapshot inmutable)
CREATE TABLE IF NOT EXISTS public.pack_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    pack_id UUID REFERENCES public.product_packs(id) ON DELETE SET NULL,
    pack_name TEXT NOT NULL,
    price_paid NUMERIC(10, 2) NOT NULL,
    delivered_items JSONB NOT NULL,
    stripe_session_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Campañas de Regalos
CREATE TABLE IF NOT EXISTS public.gift_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    custom_message TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {id, name, category, quantity, image_url}
    target_type TEXT NOT NULL DEFAULT 'all', -- 'all', 'plan', 'specific_users'
    target_plan TEXT DEFAULT '',
    target_users JSONB DEFAULT '[]'::jsonb, -- Array of user IDs if specific
    expires_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active', -- 'active', 'finished', 'expired'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Control de Regalos Reclamados
CREATE TABLE IF NOT EXISTS public.gift_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.gift_campaigns(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    claimed_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_items JSONB NOT NULL,
    UNIQUE (campaign_id, user_id)
);

-- 6. Ampliación de columnas de inventario en public.usuarios si no existen
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS purchased_accessory_ids TEXT DEFAULT '';
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS purchased_sticker_ids TEXT DEFAULT '';
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS purchased_spirit_ids TEXT DEFAULT '';
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS purchased_pack_ids TEXT DEFAULT '';

-- 7. Políticas RLS
ALTER TABLE public.product_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_claims ENABLE ROW LEVEL SECURITY;

-- Lectura pública para promociones y packs activos
CREATE POLICY "Public read active promotions" ON public.product_promotions
    FOR SELECT USING (true);

CREATE POLICY "Public read published packs" ON public.product_packs
    FOR SELECT USING (true);

-- Permisos de administrador completos
CREATE POLICY "Admins full access product_promotions" ON public.product_promotions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND (role = 'admin' OR role = 'superadmin'))
    );

CREATE POLICY "Admins full access product_packs" ON public.product_packs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND (role = 'admin' OR role = 'superadmin'))
    );

CREATE POLICY "Admins full access gift_campaigns" ON public.gift_campaigns
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND (role = 'admin' OR role = 'superadmin'))
    );

-- Lectura de regalos para usuarios
CREATE POLICY "Users can read campaigns" ON public.gift_campaigns
    FOR SELECT USING (true);

CREATE POLICY "Users can read their claims" ON public.gift_claims
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their claims" ON public.gift_claims
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their pack purchases" ON public.pack_purchases
    FOR SELECT USING (auth.uid() = user_id);
