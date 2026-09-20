-- Añadir columna voice_type a la tabla public.spirits si no existe
ALTER TABLE public.spirits
ADD COLUMN IF NOT EXISTS voice_type TEXT DEFAULT 'hombreAdulto';

COMMENT ON COLUMN public.spirits.voice_type IS 'Tipo de voz asignada al personaje (hombreAdulto, mujerAdulta, niño, niña)';
