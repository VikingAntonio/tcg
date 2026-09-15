-- Migration Script: add_learn_table.sql
-- Description: Creates the public.learn_items table for business learnings and custom store information per user.

CREATE TABLE IF NOT EXISTS public.learn_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    image_url TEXT DEFAULT '',
    type TEXT DEFAULT 'nota', -- 'qa', 'sheet', 'file', 'nota'
    sheet_name TEXT DEFAULT '',
    sheet_url TEXT DEFAULT '',
    file_url TEXT DEFAULT '',
    file_name TEXT DEFAULT '',
    question TEXT DEFAULT '',
    answer TEXT DEFAULT '',
    position INT DEFAULT 0,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Safely add extended columns if table exists from previous migration
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learn_items' AND column_name='type') THEN
        ALTER TABLE public.learn_items ADD COLUMN type TEXT DEFAULT 'nota';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learn_items' AND column_name='sheet_name') THEN
        ALTER TABLE public.learn_items ADD COLUMN sheet_name TEXT DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learn_items' AND column_name='sheet_url') THEN
        ALTER TABLE public.learn_items ADD COLUMN sheet_url TEXT DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learn_items' AND column_name='file_url') THEN
        ALTER TABLE public.learn_items ADD COLUMN file_url TEXT DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learn_items' AND column_name='file_name') THEN
        ALTER TABLE public.learn_items ADD COLUMN file_name TEXT DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learn_items' AND column_name='question') THEN
        ALTER TABLE public.learn_items ADD COLUMN question TEXT DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learn_items' AND column_name='answer') THEN
        ALTER TABLE public.learn_items ADD COLUMN answer TEXT DEFAULT '';
    END IF;
END $$;

-- Index for fast user queries
CREATE INDEX IF NOT EXISTS idx_learn_items_user_id ON public.learn_items(user_id);
CREATE INDEX IF NOT EXISTS idx_learn_items_public ON public.learn_items(user_id, is_public);

-- Enable Row Level Security (RLS)
ALTER TABLE public.learn_items ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read public learn items
DROP POLICY IF EXISTS "Public learn items are viewable by everyone" ON public.learn_items;
CREATE POLICY "Public learn items are viewable by everyone" ON public.learn_items
    FOR SELECT USING (is_public = true OR (auth.uid() IS NOT NULL AND auth.uid() = user_id));

-- Policy: Owners can manage their own learn items
DROP POLICY IF EXISTS "Users can insert their own learn items" ON public.learn_items;
CREATE POLICY "Users can insert their own learn items" ON public.learn_items
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own learn items" ON public.learn_items;
CREATE POLICY "Users can update their own learn items" ON public.learn_items
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own learn items" ON public.learn_items;
CREATE POLICY "Users can delete their own learn items" ON public.learn_items
    FOR DELETE USING (auth.uid() = user_id);
