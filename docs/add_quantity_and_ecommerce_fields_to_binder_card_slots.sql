-- Migration script to add quantity and e-commerce fields to public.binder_card_slots table
DO $$
BEGIN
    -- Add quantity column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'binder_card_slots' AND column_name = 'quantity'
    ) THEN
        ALTER TABLE public.binder_card_slots ADD COLUMN quantity INT DEFAULT 1;
    END IF;

    -- Add language column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'binder_card_slots' AND column_name = 'language'
    ) THEN
        ALTER TABLE public.binder_card_slots ADD COLUMN language TEXT DEFAULT '';
    END IF;

    -- Add edition column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'binder_card_slots' AND column_name = 'edition'
    ) THEN
        ALTER TABLE public.binder_card_slots ADD COLUMN edition TEXT DEFAULT '';
    END IF;
END $$;
