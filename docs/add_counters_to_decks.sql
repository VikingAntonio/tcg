-- Migration: Add counters to decks table and support custom counter accessories
ALTER TABLE public.decks
ADD COLUMN IF NOT EXISTS counters TEXT DEFAULT NULL;

COMMENT ON COLUMN public.decks.counters IS 'URL de imagen o diseño de contador personalizado (.png) configurado para el deck';
