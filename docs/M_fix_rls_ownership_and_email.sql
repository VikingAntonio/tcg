-- ============================================================================
-- VIKING TCG — PROPIEDAD REAL DE LOS DATOS (binders, ventas, notificaciones)
--                y fin de la exposición del correo en `usuarios`
-- ----------------------------------------------------------------------------
-- Problema que corrige:
--   `create_binders_tables.sql` creó políticas con `FOR ALL USING (true)` SIN
--   `TO`, así que aplicaban también a `anon`. Resultado: cualquiera (sin
--   iniciar sesión, solo con la clave pública) podía leer, modificar y borrar
--   los binders, páginas y slots de CUALQUIER usuario.
--   Igual en `sealed_product_sales` (nombre y teléfono de los compradores) y
--   en `user_notification_states`.
--
-- Reglas que quedan:
--   * Cada usuario solo puede crear/editar/borrar SUS binders (y sus páginas y
--     slots). El admin puede todo.
--   * Cualquiera puede LEER un binder público (is_public <> false), porque el
--     link público lo necesita. Los privados solo los ve su dueño y el admin.
--   * `sealed_product_sales`: el comprador invitado (sin cuenta) puede INSERTAR
--     su pedido (flujo WhatsApp / pago en local), pero SOLO el vendedor (o el
--     admin) puede leerlo, marcarlo leído o borrarlo.
--   * `user_notification_states`: solo el dueño.
--   * `app_notifications`: lectura pública, escritura solo admin.
--   * `usuarios`: el rol `anon` ya no puede leer la columna `email`. Para el
--     login/recuperación por nombre de usuario queda la función
--     `public.get_login_email(text)` (SECURITY DEFINER), que devuelve como
--     mucho UN correo y solo si el identificador coincide exactamente.
--
-- Es idempotente: se puede ejecutar varias veces sin errores.
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Helpers de propiedad (SECURITY DEFINER: no re-aplican RLS, sin recursión)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.binder_is_owner(p_binder_id UUID, p_uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.binders b
        WHERE b.id = p_binder_id AND p_uid IS NOT NULL AND b.user_id = p_uid
    );
$$;

CREATE OR REPLACE FUNCTION public.binder_is_visible(p_binder_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT COALESCE((
        SELECT b.is_public FROM public.binders b WHERE b.id = p_binder_id
    ), TRUE);
$$;

CREATE OR REPLACE FUNCTION public.binder_page_is_owner(p_page_id UUID, p_uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.binder_pages p
        JOIN public.binders b ON b.id = p.binder_id
        WHERE p.id = p_page_id AND p_uid IS NOT NULL AND b.user_id = p_uid
    );
$$;

CREATE OR REPLACE FUNCTION public.binder_page_is_visible(p_page_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT COALESCE((
        SELECT b.is_public FROM public.binder_pages p
        JOIN public.binders b ON b.id = p.binder_id
        WHERE p.id = p_page_id
    ), TRUE);
$$;

-- ----------------------------------------------------------------------------
-- 1. binders — solo el dueño escribe; lectura pública si is_public <> false
-- ----------------------------------------------------------------------------

ALTER TABLE public.binders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read binders" ON public.binders;
DROP POLICY IF EXISTS "Owners full binders" ON public.binders;
DROP POLICY IF EXISTS "binders_read" ON public.binders;
DROP POLICY IF EXISTS "binders_insert" ON public.binders;
DROP POLICY IF EXISTS "binders_update" ON public.binders;
DROP POLICY IF EXISTS "binders_delete" ON public.binders;

CREATE POLICY "binders_read" ON public.binders
    FOR SELECT TO anon, authenticated
    USING (
        COALESCE(is_public, TRUE)
        OR user_id = auth.uid()
        OR public.is_admin(auth.uid())
    );

CREATE POLICY "binders_insert" ON public.binders
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "binders_update" ON public.binders
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
    WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "binders_delete" ON public.binders
    FOR DELETE TO authenticated
    USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 2. binder_pages — hereda la propiedad del binder
-- ----------------------------------------------------------------------------

ALTER TABLE public.binder_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read binder_pages" ON public.binder_pages;
DROP POLICY IF EXISTS "Owners full binder_pages" ON public.binder_pages;
DROP POLICY IF EXISTS "binder_pages_read" ON public.binder_pages;
DROP POLICY IF EXISTS "binder_pages_write" ON public.binder_pages;

CREATE POLICY "binder_pages_read" ON public.binder_pages
    FOR SELECT TO anon, authenticated
    USING (
        public.binder_page_is_visible(id)
        OR public.binder_page_is_owner(id, auth.uid())
        OR public.is_admin(auth.uid())
    );

CREATE POLICY "binder_pages_write" ON public.binder_pages
    FOR ALL TO authenticated
    USING (public.binder_page_is_owner(id, auth.uid()) OR public.is_admin(auth.uid()))
    WITH CHECK (public.binder_is_owner(binder_id, auth.uid()) OR public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 3. binder_card_slots — hereda la propiedad de la página
-- ----------------------------------------------------------------------------

ALTER TABLE public.binder_card_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read binder_card_slots" ON public.binder_card_slots;
DROP POLICY IF EXISTS "Owners full binder_card_slots" ON public.binder_card_slots;
DROP POLICY IF EXISTS "binder_card_slots_read" ON public.binder_card_slots;
DROP POLICY IF EXISTS "binder_card_slots_write" ON public.binder_card_slots;

CREATE POLICY "binder_card_slots_read" ON public.binder_card_slots
    FOR SELECT TO anon, authenticated
    USING (
        public.binder_page_is_visible(page_id)
        OR public.binder_page_is_owner(page_id, auth.uid())
        OR public.is_admin(auth.uid())
    );

CREATE POLICY "binder_card_slots_write" ON public.binder_card_slots
    FOR ALL TO authenticated
    USING (public.binder_page_is_owner(page_id, auth.uid()) OR public.is_admin(auth.uid()))
    WITH CHECK (public.binder_page_is_owner(page_id, auth.uid()) OR public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 4. sealed_product_sales — el vendedor es el único que lee/edita sus ventas
--    (el invitado sin cuenta puede seguir registrando su pedido)
-- ----------------------------------------------------------------------------

ALTER TABLE public.sealed_product_sales ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'sealed_product_sales'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.sealed_product_sales', r.policyname);
    END LOOP;
END $$;

CREATE POLICY "sales_public_insert" ON public.sealed_product_sales
    FOR INSERT TO anon, authenticated
    WITH CHECK (seller_id IS NOT NULL);

CREATE POLICY "sales_seller_read" ON public.sealed_product_sales
    FOR SELECT TO authenticated
    USING (seller_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "sales_seller_update" ON public.sealed_product_sales
    FOR UPDATE TO authenticated
    USING (seller_id = auth.uid() OR public.is_admin(auth.uid()))
    WITH CHECK (seller_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "sales_seller_delete" ON public.sealed_product_sales
    FOR DELETE TO authenticated
    USING (seller_id = auth.uid() OR public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 5. user_notification_states — solo el dueño de la notificación
-- ----------------------------------------------------------------------------

ALTER TABLE public.user_notification_states ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'user_notification_states'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_notification_states', r.policyname);
    END LOOP;
END $$;

CREATE POLICY "notification_states_own" ON public.user_notification_states
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 6. app_notifications — lectura pública, escritura solo admin
-- ----------------------------------------------------------------------------

ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'app_notifications' AND cmd <> 'SELECT'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.app_notifications', r.policyname);
    END LOOP;
END $$;

DROP POLICY IF EXISTS "Public read app_notifications" ON public.app_notifications;
CREATE POLICY "Public read app_notifications" ON public.app_notifications
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage app_notifications" ON public.app_notifications;
CREATE POLICY "Admins manage app_notifications" ON public.app_notifications
    FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 7. usuarios — `anon` deja de poder leer la columna `email`
--    (PostgreSQL suma privilegios: hay que quitar el SELECT de tabla y
--     volver a conceder columna por columna, todas menos `email`.)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_login_email(p_identifier TEXT)
RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT u.email
    FROM public.usuarios u
    WHERE u.email IS NOT NULL
      AND (
            lower(u.username) = lower(trim(p_identifier))
         OR lower(u.store_name) = lower(trim(p_identifier))
      )
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_login_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_login_email(TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.get_login_email(TEXT) IS
    'Devuelve el correo de un usuario por username/store_name para el login y la recuperación de contraseña. Necesario porque anon ya no puede leer usuarios.email.';

DO $$
DECLARE
    v_cols TEXT;
BEGIN
    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
      INTO v_cols
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'usuarios'
       AND column_name <> 'email';

    IF v_cols IS NULL THEN
        RAISE NOTICE 'usuarios: no se encontraron columnas, se omite el ajuste de privilegios';
        RETURN;
    END IF;

    EXECUTE 'REVOKE SELECT ON public.usuarios FROM anon';
    EXECUTE format('GRANT SELECT (%s) ON public.usuarios TO anon', v_cols);
END $$;

-- ----------------------------------------------------------------------------
-- 8. Recargar el esquema de PostgREST (funciones nuevas)
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
