-- ============================================================================
-- Widget embebible: columnas de suscripción + lectura pública acotada
-- ----------------------------------------------------------------------------
-- Dos cosas en un solo archivo (antes estaban separadas y la primera nunca se
-- ejecutó, que es la causa del error `42703: column u.subscription_status does
-- not exist`):
--
--   1. Crear las columnas de Stripe en `usuarios` que ya esperaba
--      `docs/add_stripe_subscriptions.sql`. Sin ellas, cualquier consulta que
--      pida `subscription_status` devuelve 400 y el widget nunca resolvía la
--      tienda: caía siempre al modelo por defecto (1.8 MB) desde Storage.
--
--   2. Crear `get_widget_store(uuid)`, que devuelve SOLO los campos que el
--      widget necesita mostrar y autorizar (sin correo ni teléfono). La clave
--      anónima no puede leer `usuarios` entera, así que el widget usa esta RPC.
--
-- OJO: al existir la columna, la comprobación de suscripción del widget pasa a
-- funcionar de verdad. Se permite el acceso si: el rol es `admin`, el estado es
-- `active`/`trialing`, o el dominio está autorizado en `widget_domains`.
--
-- Es idempotente: se puede ejecutar varias veces sin errores.
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Columnas de suscripción (espejo de add_stripe_subscriptions.sql)
-- ----------------------------------------------------------------------------

ALTER TABLE public.usuarios
    ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'inactive',
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_usuarios_subscription_status ON public.usuarios(subscription_status);

COMMENT ON COLUMN public.usuarios.subscription_status IS 'Estado de la suscripción de Stripe: active, trialing, past_due, canceled, unpaid, inactive';

-- Un admin no necesita suscripción (el widget ya lo deja pasar por rol); esto
-- solo evita que el panel lo muestre como inactivo.
UPDATE public.usuarios SET subscription_status = 'active' WHERE role = 'admin';

-- ----------------------------------------------------------------------------
-- 2. Lectura acotada para el widget
-- ----------------------------------------------------------------------------

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
