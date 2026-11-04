-- SQL Migration: Crear tabla store_customizations para el personalizador visual de tiendas (custom.html)
-- Fase 1: Personalización visual, distribución GRID (PC y Celular) y stickers

CREATE TABLE IF NOT EXISTS public.store_customizations (
    user_id UUID PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
    global_styles JSONB DEFAULT '{
        "bg_color": "#121824",
        "border_color": "#00d2ff",
        "border_width": "2px",
        "border_radius": "24px",
        "text_color": "#ffffff",
        "font_family": "Montserrat, sans-serif",
        "font_size": "16px"
    }'::jsonb,
    slots_config JSONB DEFAULT '{}'::jsonb,
    grid_pc JSONB DEFAULT '{}'::jsonb,
    grid_mobile JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.store_customizations ENABLE ROW LEVEL SECURITY;

-- 1. Política de lectura pública: cualquier visitante puede ver la personalización de la tienda
CREATE POLICY "Permitir lectura publica de personalizacion de tienda"
    ON public.store_customizations
    FOR SELECT
    USING (true);

-- 2. Política de inserción: Cada usuario solo puede insertar su propia personalización
CREATE POLICY "Permitir insercion de personalizacion propia"
    ON public.store_customizations
    FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IN (SELECT id FROM public.usuarios WHERE id = auth.uid() OR role = 'admin'));

-- 3. Política de actualización: Cada usuario solo puede modificar su propia personalización
CREATE POLICY "Permitir actualizacion de personalizacion propia"
    ON public.store_customizations
    FOR UPDATE
    USING (auth.uid() = user_id OR user_id IN (SELECT id FROM public.usuarios WHERE id = auth.uid() OR role = 'admin'))
    WITH CHECK (auth.uid() = user_id OR user_id IN (SELECT id FROM public.usuarios WHERE id = auth.uid() OR role = 'admin'));

-- 4. Política de eliminación: Cada usuario solo puede eliminar su propia personalización
CREATE POLICY "Permitir eliminacion de personalizacion propia"
    ON public.store_customizations
    FOR DELETE
    USING (auth.uid() = user_id OR user_id IN (SELECT id FROM public.usuarios WHERE id = auth.uid() OR role = 'admin'));

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_store_customizations_user_id ON public.store_customizations(user_id);

COMMENT ON TABLE public.store_customizations IS 'Almacena configuraciones de personalización visual, distribución GRID (PC y Celular) y stickers para tiendas VikingTCG';
