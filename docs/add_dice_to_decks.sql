-- Migration: Add dice to decks table and support dice accessories
ALTER TABLE public.decks
ADD COLUMN IF NOT EXISTS dice TEXT DEFAULT NULL;

COMMENT ON COLUMN public.decks.dice IS 'URL de imagen o modelo 3D (.gltf/.glb) del dado configurado para el deck';
