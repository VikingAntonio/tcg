-- Migration script to add optional fields and extra_images to public.card_slots table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'card_slots' AND column_name = 'language'
    ) THEN
        ALTER TABLE public.card_slots ADD COLUMN language TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'card_slots' AND column_name = 'edition'
    ) THEN
        ALTER TABLE public.card_slots ADD COLUMN edition TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'card_slots' AND column_name = 'description'
    ) THEN
        ALTER TABLE public.card_slots ADD COLUMN description TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'card_slots' AND column_name = 'extra_images'
    ) THEN
        ALTER TABLE public.card_slots ADD COLUMN extra_images TEXT[];
    END IF;
END $$;
