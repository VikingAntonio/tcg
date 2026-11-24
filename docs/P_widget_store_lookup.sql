-- ============================================================================
-- Widget embebible: leer la tienda sin exponer columnas privadas
-- ----------------------------------------------------------------------------
-- El widget (`js/viking-widget.js`) se instala en webs de terceros y habla con
-- Supabase usando la clave anónima. Después de cerrar la escritura/lectura
-- anónima de `usuarios` (migración `M_`), la consulta
--
--     select('..., subscription_status, ...') from usuarios where id = ...
--
-- devuelve 400 ("permission denied"), así que el widget no podía saber qué
-- asistente mostrar y siempre acababa pidiendo el modelo por defecto (1.8 MB
-- desde Storage en cada visita).
--
-- Devuelve un JSON con SOLO los campos que el widget necesita mostrar y
-- autorizar. No incluye correo, teléfono ni ningún dato de contacto. Se usa
-- JSON y no una tabla con tipos para no depender del tipo exacto de cada
-- columna.
--
-- Es idempotente: se puede ejecutar varias veces sin errores.
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_widget_store(p_user_id UUID)
RETURNS JSON
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT to_jsonb(t)
    FROM (
        SELECT u.id,
               u.username,
               u.store_name,
               u.selected_spirit_id,
               u.store_logo,
               u.custom_domain,
               u.role,
               u.subscription_status
        FROM public.usuarios u
        WHERE u.id = p_user_id
        LIMIT 1
    ) t;
$$;

GRANT EXECUTE ON FUNCTION public.get_widget_store(UUID) TO anon, authenticated;
