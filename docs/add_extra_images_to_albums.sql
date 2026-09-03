-- Migration script to add extra_images column to public.albums table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'albums'
          AND column_name = 'extra_images'
    ) THEN
        ALTER TABLE public.albums ADD COLUMN extra_images TEXT[];
    END IF;
END $$;
