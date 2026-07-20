-- SQL para añadir la columna 'grid_layout' a la tabla de álbumes sin romper los datos existentes.
-- Ejecuta este script en el editor SQL de Supabase (SQL Editor).

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='albums' AND column_name='grid_layout'
    ) THEN
        ALTER TABLE public.albums ADD COLUMN grid_layout TEXT DEFAULT '3x3';
    END IF;
END $$;
