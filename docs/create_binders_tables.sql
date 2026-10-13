-- SQL Script to create standalone tables for binders mode (binders.html & public link binders slot)

-- 1. Table for Binders
CREATE TABLE IF NOT EXISTS public.binders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Nuevo Álbum',
    cover_image_url TEXT,
    back_image_url TEXT,
    cover_color TEXT DEFAULT '#1a1a1a',
    back_color TEXT DEFAULT '#1a1a1a',
    is_public BOOLEAN DEFAULT true,
    grid_layout TEXT DEFAULT '3x3',
    position INT DEFAULT 0,
    extra_images TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table for Binder Pages
CREATE TABLE IF NOT EXISTS public.binder_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    binder_id UUID NOT NULL REFERENCES public.binders(id) ON DELETE CASCADE,
    page_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table for Binder Card Slots
CREATE TABLE IF NOT EXISTS public.binder_card_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES public.binder_pages(id) ON DELETE CASCADE,
    slot_index INT NOT NULL,
    image_url TEXT,
    name TEXT,
    rarity TEXT,
    expansion TEXT,
    condition TEXT DEFAULT 'M',
    price TEXT DEFAULT '',
    cost_price TEXT DEFAULT '',
    extra_images TEXT[],
    obtained BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_binder_slot_per_page UNIQUE(page_id, slot_index)
);

-- Migration check in case table already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'binder_card_slots' AND column_name = 'cost_price'
    ) THEN
        ALTER TABLE public.binder_card_slots ADD COLUMN cost_price TEXT DEFAULT '';
    END IF;
END $$;

-- Enable RLS and permissions if applicable
ALTER TABLE public.binders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.binder_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.binder_card_slots ENABLE ROW LEVEL SECURITY;

-- Allow public reads
CREATE POLICY "Public read binders" ON public.binders FOR SELECT USING (true);
CREATE POLICY "Public read binder_pages" ON public.binder_pages FOR SELECT USING (true);
CREATE POLICY "Public read binder_card_slots" ON public.binder_card_slots FOR SELECT USING (true);

-- Allow all operations for service role or authenticated users
CREATE POLICY "Owners full binders" ON public.binders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Owners full binder_pages" ON public.binder_pages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Owners full binder_card_slots" ON public.binder_card_slots FOR ALL USING (true) WITH CHECK (true);
