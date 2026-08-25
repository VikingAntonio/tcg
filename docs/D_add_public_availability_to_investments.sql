-- Migration: Add is_public and is_available columns to investment_cards table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='investment_cards' AND column_name='is_public') THEN
        ALTER TABLE investment_cards ADD COLUMN is_public BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='investment_cards' AND column_name='is_available') THEN
        ALTER TABLE investment_cards ADD COLUMN is_available BOOLEAN DEFAULT true;
    END IF;
END $$;
