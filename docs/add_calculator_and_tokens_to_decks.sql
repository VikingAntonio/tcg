-- Migration: Add calculator and token accessories to decks table
-- Allows players to customize their LP calculator theme and token cards per deck

ALTER TABLE public.decks
ADD COLUMN IF NOT EXISTS calculator TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS token TEXT DEFAULT '';

-- Comments for documentation
COMMENT ON COLUMN public.decks.calculator IS 'Custom LP calculator design/theme accessory ID or JSON';
COMMENT ON COLUMN public.decks.token IS 'Custom token card accessory ID or JSON';
