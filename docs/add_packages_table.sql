-- Migration for Packages, Dynamic Limits, and Pro Notifications System

-- 1. Create table for package configurations
CREATE TABLE IF NOT EXISTS public.package_configs (
    id TEXT PRIMARY KEY, -- 'starter', 'premium', etc.
    name TEXT NOT NULL,
    price_mxn NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'MXN',
    description TEXT,
    max_albums INTEGER DEFAULT 5,
    max_pages INTEGER DEFAULT 9,
    max_decks INTEGER DEFAULT 10,
    max_cards_per_deck INTEGER DEFAULT 90,
    max_wishlist INTEGER DEFAULT 8,
    max_sealed INTEGER DEFAULT 20,
    max_preorders INTEGER DEFAULT 5,
    max_clients_count INTEGER DEFAULT 10,
    max_auctions_count INTEGER DEFAULT 10,
    max_claims_count INTEGER DEFAULT 10,
    max_events INTEGER DEFAULT 5,
    allowed_spirit_ids TEXT DEFAULT '',
    has_widgets BOOLEAN DEFAULT FALSE,
    priority_support BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Seed initial default configurations if not present
INSERT INTO public.package_configs (
    id, name, price_mxn, description,
    max_albums, max_pages, max_decks, max_cards_per_deck, max_wishlist,
    max_sealed, max_preorders, max_clients_count, max_auctions_count, max_claims_count, max_events,
    allowed_spirit_ids, has_widgets, priority_support
) VALUES
(
    'starter', 'Starter', 0, 'Plan gratuito ideal para comenzar a organizar tus colecciones.',
    5, 9, 10, 90, 8,
    20, 5, 10, 10, 10, 5,
    '', false, false
),
(
    'premium', 'Premium', 300, 'Plan avanzado para coleccionistas y tiendas profesionales.',
    15, 10, 30, 90, 50,
    60, 30, 100, 100, 100, 50,
    'all', true, true
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create table for system broadcast notifications
CREATE TABLE IF NOT EXISTS public.app_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    messages TEXT[] DEFAULT '{}',
    images TEXT[] DEFAULT '{}',
    target_role TEXT DEFAULT 'all', -- 'all', 'starter', 'premium', 'admin'
    sender_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Create table for user notification states (read / deleted tracking for announcements and sales)
CREATE TABLE IF NOT EXISTS public.user_notification_states (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    notification_id UUID NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, notification_id)
);

-- Enable RLS and simple policies
ALTER TABLE public.package_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read package_configs" ON public.package_configs FOR SELECT USING (true);
CREATE POLICY "Allow admin all package_configs" ON public.package_configs FOR ALL USING (true);

CREATE POLICY "Allow public read app_notifications" ON public.app_notifications FOR SELECT USING (true);
CREATE POLICY "Allow admin all app_notifications" ON public.app_notifications FOR ALL USING (true);

CREATE POLICY "Allow public all user_notification_states" ON public.user_notification_states FOR ALL USING (true);
