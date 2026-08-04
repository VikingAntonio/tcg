-- SQL to add sleeves, deckbox, and coin columns to the decks table
-- Run this script in your Supabase SQL Editor

ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS sleeves TEXT;
ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS deckbox TEXT;
ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS coin TEXT;
