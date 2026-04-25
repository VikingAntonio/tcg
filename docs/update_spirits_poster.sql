-- SQL para agregar columna de poster a la tabla de spirits
-- Ejecuta esto en el SQL Editor de tu panel de Supabase

ALTER TABLE spirits
ADD COLUMN IF NOT EXISTS poster_url TEXT;
