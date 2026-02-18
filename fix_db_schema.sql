-- FIX DATABASE SCHEMA FOR TCG DUAL
-- This script ensures all tables have the columns and constraints expected by the frontend.
-- Note: RLS settings are NOT modified as per user instructions.

DO $$
BEGIN
    -----------------------------------------------------------
    -- 1. Table: usuarios
    -----------------------------------------------------------
    -- Ensure limit columns
    ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS max_albums INTEGER DEFAULT 3;
    ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS max_pages INTEGER DEFAULT 5;
    ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS max_decks INTEGER DEFAULT 1;
    ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS max_cards_per_deck INTEGER DEFAULT 60;
    ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS allowed_spirit_ids TEXT DEFAULT '1';

    -- Ensure contact columns
    ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS whatsapp_link TEXT;
    ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS messenger_link TEXT;
    ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS horario TEXT;
    ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS ubicacion TEXT;
    ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS store_logo TEXT;
    ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS is_store BOOLEAN DEFAULT FALSE;

    -----------------------------------------------------------
    -- 2. Table: spirits
    -----------------------------------------------------------
    -- Ensure user_id column exists for RLS policies
    ALTER TABLE public.spirits ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

    -- Rename model_url to gltf_url if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='spirits' AND column_name='model_url') THEN
        ALTER TABLE public.spirits RENAME COLUMN model_url TO gltf_url;
    END IF;
    ALTER TABLE public.spirits ADD COLUMN IF NOT EXISTS gltf_url TEXT;

    -- Rename particle_movement to particle_movement_type if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='spirits' AND column_name='particle_movement') THEN
        ALTER TABLE public.spirits RENAME COLUMN particle_movement TO particle_movement_type;
    END IF;
    ALTER TABLE public.spirits ADD COLUMN IF NOT EXISTS particle_movement_type TEXT DEFAULT 'falling';

    ALTER TABLE public.spirits ADD COLUMN IF NOT EXISTS texture_url TEXT;
    ALTER TABLE public.spirits ADD COLUMN IF NOT EXISTS animation_type TEXT DEFAULT 'orbit';
    ALTER TABLE public.spirits ADD COLUMN IF NOT EXISTS particle_asset TEXT DEFAULT 'cerezo.png';
    ALTER TABLE public.spirits ADD COLUMN IF NOT EXISTS scale FLOAT DEFAULT 1.8;
    ALTER TABLE public.spirits ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;

    -----------------------------------------------------------
    -- 3. Table: albums
    -----------------------------------------------------------
    -- Rename cover_image to cover_image_url
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='albums' AND column_name='cover_image') THEN
        ALTER TABLE public.albums RENAME COLUMN cover_image TO cover_image_url;
    END IF;
    ALTER TABLE public.albums ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

    -- Rename back_image to back_image_url
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='albums' AND column_name='back_image') THEN
        ALTER TABLE public.albums RENAME COLUMN back_image TO back_image_url;
    END IF;
    ALTER TABLE public.albums ADD COLUMN IF NOT EXISTS back_image_url TEXT;

    ALTER TABLE public.albums ADD COLUMN IF NOT EXISTS cover_color TEXT DEFAULT '#1a1a1a';
    ALTER TABLE public.albums ADD COLUMN IF NOT EXISTS back_color TEXT DEFAULT '#1a1a1a';
    ALTER TABLE public.albums ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;

    -----------------------------------------------------------
    -- 4. Table: card_slots
    -----------------------------------------------------------
    -- Rename custom_mask to custom_mask_url
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='card_slots' AND column_name='custom_mask') THEN
        ALTER TABLE public.card_slots RENAME COLUMN custom_mask TO custom_mask_url;
    END IF;
    ALTER TABLE public.card_slots ADD COLUMN IF NOT EXISTS custom_mask_url TEXT;

    ALTER TABLE public.card_slots ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'M';
    ALTER TABLE public.card_slots ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
    ALTER TABLE public.card_slots ADD COLUMN IF NOT EXISTS price TEXT;
    ALTER TABLE public.card_slots ADD COLUMN IF NOT EXISTS holo_effect TEXT;
    ALTER TABLE public.card_slots ADD COLUMN IF NOT EXISTS rarity TEXT;
    ALTER TABLE public.card_slots ADD COLUMN IF NOT EXISTS expansion TEXT;

    -- ADD UNIQUE CONSTRAINT FOR UPSERT (Required by admin.js)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'card_slots_page_id_slot_index_key') THEN
        ALTER TABLE public.card_slots ADD CONSTRAINT card_slots_page_id_slot_index_key UNIQUE (page_id, slot_index);
    END IF;

    -----------------------------------------------------------
    -- 5. Table: decks
    -----------------------------------------------------------
    ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;

    -----------------------------------------------------------
    -- 6. Table: deck_cards
    -----------------------------------------------------------
    ALTER TABLE public.deck_cards ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'M';
    ALTER TABLE public.deck_cards ADD COLUMN IF NOT EXISTS price TEXT;
    ALTER TABLE public.deck_cards ADD COLUMN IF NOT EXISTS holo_effect TEXT;
    ALTER TABLE public.deck_cards ADD COLUMN IF NOT EXISTS custom_mask_url TEXT;
    ALTER TABLE public.deck_cards ADD COLUMN IF NOT EXISTS rarity TEXT;
    ALTER TABLE public.deck_cards ADD COLUMN IF NOT EXISTS expansion TEXT;
    ALTER TABLE public.deck_cards ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

END $$;

-----------------------------------------------------------
-- 7. TEMPLATE FOR SPIRITS (Companions)
-- Use this to manually populate your spirits table if it's empty.
-- Update the URLs with your actual Supabase storage links from the 'spirits' bucket.
-----------------------------------------------------------

/*
-- UNCOMMENT AND RUN THIS IF YOU WANT TO ADD DEFAULT SPIRITS
-- Replace [TU-PROYECTO] with your actual Supabase project ID.
-- Replace [USER-ID] with the UUID of the admin user.

INSERT INTO public.spirits (name, gltf_url, animation_type, is_public, user_id)
VALUES
('Winged Kuriboh', 'https://[TU-PROYECTO].supabase.co/storage/v1/object/public/spirits/models/kuriboh/kuriboh.gltf', 'float', true, '[USER-ID]'),
('Ash Blossom', 'https://[TU-PROYECTO].supabase.co/storage/v1/object/public/spirits/models/ash/ash.gltf', 'orbit', true, '[USER-ID]')
ON CONFLICT DO NOTHING;
*/

-----------------------------------------------------------
-- 8. NOTES FOR LOGOS
-- Ensure your store logos are uploaded to the 'logos' bucket in Supabase.
-- The URL format should be: https://[TU-PROYECTO].supabase.co/storage/v1/object/public/logos/[FILENAME]
-- You can update your store logo via the Profile (Perfil) section in the admin panel.
-----------------------------------------------------------
