-- SQL para agregar la columna format_tag (clave/tipo/formato) a la tabla public.decks
-- Esta consulta es 100% segura y no modifica ni rompe ninguna tabla existente.

ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS format_tag TEXT DEFAULT '';
