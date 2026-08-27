-- Migration: Add grid_layout column to investment_categories table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='investment_categories' AND column_name='grid_layout') THEN
        ALTER TABLE public.investment_categories ADD COLUMN grid_layout TEXT DEFAULT '3x3';
    END IF;
END $$;
