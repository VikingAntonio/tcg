-- SQL para agregar la columna format_tag (clave/tipo/formato) a la tabla public.decks
-- Esta consulta es 100% segura y no modifica ni rompe ninguna tabla existente.

ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS format_tag TEXT DEFAULT 'Avanzado';

-- Opcional: Actualizar registros existentes que tengan NULL para asegurar que tengan un valor por defecto
UPDATE public.decks SET format_tag = 'Avanzado' WHERE format_tag IS NULL;
