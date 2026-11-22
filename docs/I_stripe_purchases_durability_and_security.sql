-- ============================================================================
-- VIKING TCG — COMPRAS PERMANENTES, REGALOS Y SEGURIDAD DE PRIVILEGIOS
-- ----------------------------------------------------------------------------
-- Objetivo:
--   1. Que TODO lo que un usuario paga (accesorios, stickers, asistentes 3D,
--      packs y productos del carrito) quede guardado para siempre en su cuenta,
--      aunque el admin borre el artículo del catálogo.
--   2. Que los regalos reclamados queden permanentes en la cuenta.
--   3. Que nadie pueda darse privilegios (role = 'admin'), activar su
--      suscripción ni "regalarse" compras desde el frontend / consola.
--   4. Que solo el admin pueda modificar precios, catálogo, packs, promociones
--      y paquetes.
--
-- Es idempotente: se puede ejecutar varias veces sin errores.
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Helpers de autorización
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin(p_uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.id = p_uid AND u.role IN ('admin', 'superadmin', 'admin_store')
    );
$$;

COMMENT ON FUNCTION public.is_admin(UUID) IS 'TRUE si el usuario indicado es administrador. Usada por RLS y triggers.';

-- ----------------------------------------------------------------------------
-- 0.1 Columnas de inventario (por si la migración de packs no se ejecutó)
-- ----------------------------------------------------------------------------

ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS purchased_accessory_ids TEXT DEFAULT '';
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS purchased_sticker_ids TEXT DEFAULT '';
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS purchased_spirit_ids TEXT DEFAULT '';
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS purchased_pack_ids TEXT DEFAULT '';

-- ----------------------------------------------------------------------------
-- 1. Libro mayor de compras (inmutable): public.user_entitlements
--    Guarda una FOTO (snapshot) del artículo al momento de comprarlo, para que
--    el usuario conserve acceso aunque el artículo se elimine del catálogo.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL,          -- 'accessory' | 'sticker' | 'spirit' | 'pack'
    item_id TEXT NOT NULL,
    item_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    source TEXT NOT NULL DEFAULT 'purchase', -- 'purchase' | 'gift' | 'pack' | 'backfill'
    price_paid NUMERIC(10, 2) DEFAULT 0,
    currency TEXT DEFAULT 'MXN',
    stripe_session_id TEXT,
    parent_item_id TEXT,              -- pack del que proviene el artículo
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_user_entitlements_user ON public.user_entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_entitlements_type ON public.user_entitlements(user_id, item_type);

COMMENT ON TABLE public.user_entitlements IS 'Compras/regalos permanentes por usuario con snapshot del artículo. Solo el backend (service_role) escribe.';

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own entitlements" ON public.user_entitlements;
CREATE POLICY "Users read own entitlements" ON public.user_entitlements
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all entitlements" ON public.user_entitlements;
CREATE POLICY "Admins read all entitlements" ON public.user_entitlements
    FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()));

-- Sin políticas de INSERT/UPDATE/DELETE: solo service_role (edge functions) escribe.

-- ----------------------------------------------------------------------------
-- 2. Pedidos del carrito (para el pago con tarjeta de productos físicos)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.checkout_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    buyer_name TEXT DEFAULT '',
    buyer_contact TEXT DEFAULT '',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'MXN',
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'paid' | 'failed'
    stripe_session_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_checkout_orders_user ON public.checkout_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_checkout_orders_session ON public.checkout_orders(stripe_session_id);

ALTER TABLE public.checkout_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own orders" ON public.checkout_orders;
CREATE POLICY "Users read own orders" ON public.checkout_orders
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all orders" ON public.checkout_orders;
CREATE POLICY "Admins read all orders" ON public.checkout_orders
    FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 3. Backfill: convertir las compras existentes en entitlements con snapshot
--    (primero packs y regalos, que ya traen el snapshot completo)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    v_pack RECORD;
    v_claim RECORD;
    v_item JSONB;
    v_type TEXT;
BEGIN
    -- 3.1 Artículos entregados por packs
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pack_purchases') THEN
        FOR v_pack IN SELECT * FROM public.pack_purchases LOOP
            FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_pack.delivered_items, '[]'::jsonb)) LOOP
                CONTINUE WHEN COALESCE(v_item->>'id', '') = '';
                v_type := CASE lower(COALESCE(v_item->>'category', ''))
                    WHEN 'stickers' THEN 'sticker'
                    WHEN 'sticker' THEN 'sticker'
                    WHEN 'spirits' THEN 'spirit'
                    WHEN 'spirit' THEN 'spirit'
                    WHEN 'assistants' THEN 'spirit'
                    ELSE 'accessory'
                END;
                INSERT INTO public.user_entitlements (user_id, item_type, item_id, item_snapshot, source, price_paid, stripe_session_id, parent_item_id, granted_at)
                VALUES (v_pack.user_id, v_type, COALESCE(v_item->>'id', ''), v_item, 'pack', 0, v_pack.stripe_session_id, v_pack.pack_id::text, COALESCE(v_pack.created_at, now()))
                ON CONFLICT (user_id, item_type, item_id) DO NOTHING;
            END LOOP;
        END LOOP;
    END IF;

    -- 3.2 Artículos entregados por regalos reclamados
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'gift_claims') THEN
        FOR v_claim IN SELECT * FROM public.gift_claims LOOP
            FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_claim.delivered_items, '[]'::jsonb)) LOOP
                CONTINUE WHEN COALESCE(v_item->>'id', '') = '';
                v_type := CASE lower(COALESCE(v_item->>'category', ''))
                    WHEN 'stickers' THEN 'sticker'
                    WHEN 'sticker' THEN 'sticker'
                    WHEN 'spirits' THEN 'spirit'
                    WHEN 'spirit' THEN 'spirit'
                    WHEN 'assistants' THEN 'spirit'
                    ELSE 'accessory'
                END;
                INSERT INTO public.user_entitlements (user_id, item_type, item_id, item_snapshot, source, price_paid, granted_at)
                VALUES (v_claim.user_id, v_type, COALESCE(v_item->>'id', ''), v_item, 'gift', 0, COALESCE(v_claim.claimed_at, now()))
                ON CONFLICT (user_id, item_type, item_id) DO NOTHING;
            END LOOP;
        END LOOP;
    END IF;
END $$;

-- 3.3 Accesorios comprados (columna CSV histórica) → snapshot del catálogo si existe
INSERT INTO public.user_entitlements (user_id, item_type, item_id, item_snapshot, source, granted_at)
SELECT u.id,
       'accessory',
       trim(x.item_id),
       COALESCE(to_jsonb(a), jsonb_build_object('id', trim(x.item_id))),
       'backfill',
       now()
FROM public.usuarios u
CROSS JOIN LATERAL unnest(string_to_array(COALESCE(u.purchased_accessory_ids, ''), ',')) AS x(item_id)
LEFT JOIN public.accessories a ON a.id::text = trim(x.item_id)
WHERE trim(x.item_id) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
ON CONFLICT (user_id, item_type, item_id) DO NOTHING;

-- 3.4 Stickers comprados
INSERT INTO public.user_entitlements (user_id, item_type, item_id, item_snapshot, source, granted_at)
SELECT u.id,
       'sticker',
       trim(x.item_id),
       COALESCE(to_jsonb(s), jsonb_build_object('id', trim(x.item_id))),
       'backfill',
       now()
FROM public.usuarios u
CROSS JOIN LATERAL unnest(string_to_array(COALESCE(u.purchased_sticker_ids, ''), ',')) AS x(item_id)
LEFT JOIN public.stickers s ON s.id::text = trim(x.item_id)
WHERE trim(x.item_id) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
ON CONFLICT (user_id, item_type, item_id) DO NOTHING;

-- 3.5 Asistentes 3D comprados
INSERT INTO public.user_entitlements (user_id, item_type, item_id, item_snapshot, source, granted_at)
SELECT u.id,
       'spirit',
       trim(x.item_id),
       COALESCE(to_jsonb(sp), jsonb_build_object('id', trim(x.item_id))),
       'backfill',
       now()
FROM public.usuarios u
CROSS JOIN LATERAL unnest(string_to_array(COALESCE(u.purchased_spirit_ids, ''), ',')) AS x(item_id)
LEFT JOIN public.spirits sp ON sp.id::text = trim(x.item_id)
WHERE trim(x.item_id) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
ON CONFLICT (user_id, item_type, item_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Regalos: reclamar 100% del lado servidor (RPC)
--    Valida campaña activa / vigente / audiencia, registra el claim (idempotente)
--    y entrega entitlements permanentes con snapshot.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_gift(p_campaign_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_campaign public.gift_campaigns%ROWTYPE;
    v_role TEXT;
    v_item JSONB;
    v_type TEXT;
    v_items JSONB := '[]'::jsonb;
    v_acc TEXT[] := ARRAY[]::TEXT[];
    v_stk TEXT[] := ARRAY[]::TEXT[];
    v_spr TEXT[] := ARRAY[]::TEXT[];
    v_pck TEXT[] := ARRAY[]::TEXT[];
    v_target_ok BOOLEAN;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_campaign FROM public.gift_campaigns WHERE id = p_campaign_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'GIFT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF COALESCE(v_campaign.status, '') <> 'active' THEN
        RAISE EXCEPTION 'GIFT_INACTIVE' USING ERRCODE = 'P0001';
    END IF;

    IF v_campaign.expires_at IS NOT NULL AND v_campaign.expires_at < now() THEN
        RAISE EXCEPTION 'GIFT_EXPIRED' USING ERRCODE = 'P0001';
    END IF;

    SELECT lower(COALESCE(role, 'starter')) INTO v_role FROM public.usuarios WHERE id = v_uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_campaign.target_type = 'plan' AND COALESCE(v_campaign.target_plan, '') <> '' THEN
        v_target_ok := (v_role = lower(v_campaign.target_plan));
    ELSIF v_campaign.target_type = 'specific_users' THEN
        v_target_ok := EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(COALESCE(v_campaign.target_users, '[]'::jsonb)) t
            WHERE t = v_uid::text
        );
    ELSE
        v_target_ok := TRUE;
    END IF;

    IF NOT v_target_ok THEN
        RAISE EXCEPTION 'GIFT_NOT_FOR_USER' USING ERRCODE = '42501';
    END IF;

    -- Idempotente: si ya lo reclamó, no se duplica nada
    IF EXISTS (SELECT 1 FROM public.gift_claims WHERE campaign_id = p_campaign_id AND user_id = v_uid) THEN
        RETURN jsonb_build_object('already_claimed', true, 'items', COALESCE(v_campaign.items, '[]'::jsonb));
    END IF;

    INSERT INTO public.gift_claims (campaign_id, user_id, delivered_items)
    VALUES (p_campaign_id, v_uid, COALESCE(v_campaign.items, '[]'::jsonb));

    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_campaign.items, '[]'::jsonb)) LOOP
        CONTINUE WHEN COALESCE(v_item->>'id', '') = '';

        v_type := CASE lower(COALESCE(v_item->>'category', ''))
            WHEN 'stickers' THEN 'sticker'
            WHEN 'sticker' THEN 'sticker'
            WHEN 'spirits' THEN 'spirit'
            WHEN 'spirit' THEN 'spirit'
            WHEN 'assistants' THEN 'spirit'
            WHEN 'packs' THEN 'pack'
            WHEN 'pack' THEN 'pack'
            ELSE 'accessory'
        END;

        INSERT INTO public.user_entitlements (user_id, item_type, item_id, item_snapshot, source, price_paid)
        VALUES (v_uid, v_type, v_item->>'id', v_item, 'gift', 0)
        ON CONFLICT (user_id, item_type, item_id) DO UPDATE
            SET item_snapshot = public.user_entitlements.item_snapshot || EXCLUDED.item_snapshot;

        IF v_type = 'sticker' THEN v_stk := array_append(v_stk, v_item->>'id');
        ELSIF v_type = 'spirit' THEN v_spr := array_append(v_spr, v_item->>'id');
        ELSIF v_type = 'pack' THEN v_pck := array_append(v_pck, v_item->>'id');
        ELSE v_acc := array_append(v_acc, v_item->>'id');
        END IF;

        v_items := v_items || jsonb_build_array(v_item);
    END LOOP;

    -- Compatibilidad con el código existente que lee las columnas CSV
    UPDATE public.usuarios SET
        purchased_accessory_ids = NULLIF((
            SELECT string_agg(DISTINCT t, ',') FROM unnest(
                string_to_array(COALESCE(purchased_accessory_ids, ''), ',') || v_acc
            ) AS t WHERE t <> ''
        ), ''),
        purchased_sticker_ids = NULLIF((
            SELECT string_agg(DISTINCT t, ',') FROM unnest(
                string_to_array(COALESCE(purchased_sticker_ids, ''), ',') || v_stk
            ) AS t WHERE t <> ''
        ), ''),
        purchased_spirit_ids = NULLIF((
            SELECT string_agg(DISTINCT t, ',') FROM unnest(
                string_to_array(COALESCE(purchased_spirit_ids, ''), ',') || v_spr
            ) AS t WHERE t <> ''
        ), ''),
        purchased_pack_ids = NULLIF((
            SELECT string_agg(DISTINCT t, ',') FROM unnest(
                string_to_array(COALESCE(purchased_pack_ids, ''), ',') || v_pck
            ) AS t WHERE t <> ''
        ), '')
    WHERE id = v_uid;

    RETURN jsonb_build_object(
        'already_claimed', false,
        'campaign_id', p_campaign_id,
        'title', v_campaign.title,
        'image_url', v_campaign.image_url,
        'items', v_items
    );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_gift(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_gift(UUID) TO authenticated;

COMMENT ON FUNCTION public.claim_gift(UUID) IS 'Reclama un regalo de forma atómica y entrega los artículos como entitlements permanentes.';

-- ----------------------------------------------------------------------------
-- 5. Protección de columnas sensibles de public.usuarios
--    Un usuario normal no puede cambiarse el rol, activar su suscripción ni
--    escribir sus listas de compras desde el navegador (devtools/consola).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_usuario_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
BEGIN
    -- service_role (edge functions), SQL Editor y funciones SECURITY DEFINER
    -- (claim_gift, etc.) sí pueden escribir.
    IF COALESCE(auth.role(), '') = 'service_role'
       OR current_user IN ('postgres', 'supabase_admin', 'service_role', 'supabase_auth_admin') THEN
        RETURN NEW;
    END IF;

    -- Un administrador puede editar a cualquiera
    IF v_uid IS NOT NULL AND public.is_admin(v_uid) THEN
        RETURN NEW;
    END IF;

    -- El resto: se ignoran los cambios en columnas privilegiadas
    IF NEW.role IS DISTINCT FROM OLD.role THEN NEW.role := OLD.role; END IF;
    IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN NEW.subscription_status := OLD.subscription_status; END IF;
    IF NEW.subscription_end IS DISTINCT FROM OLD.subscription_end THEN NEW.subscription_end := OLD.subscription_end; END IF;
    IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id THEN NEW.stripe_customer_id := OLD.stripe_customer_id; END IF;
    IF NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id THEN NEW.stripe_subscription_id := OLD.stripe_subscription_id; END IF;
    IF NEW.purchased_accessory_ids IS DISTINCT FROM OLD.purchased_accessory_ids THEN NEW.purchased_accessory_ids := OLD.purchased_accessory_ids; END IF;
    IF NEW.purchased_sticker_ids IS DISTINCT FROM OLD.purchased_sticker_ids THEN NEW.purchased_sticker_ids := OLD.purchased_sticker_ids; END IF;
    IF NEW.purchased_spirit_ids IS DISTINCT FROM OLD.purchased_spirit_ids THEN NEW.purchased_spirit_ids := OLD.purchased_spirit_ids; END IF;
    IF NEW.purchased_pack_ids IS DISTINCT FROM OLD.purchased_pack_ids THEN NEW.purchased_pack_ids := OLD.purchased_pack_ids; END IF;
    IF NEW.allowed_spirit_ids IS DISTINCT FROM OLD.allowed_spirit_ids THEN NEW.allowed_spirit_ids := OLD.allowed_spirit_ids; END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_usuario_privileged_columns ON public.usuarios;
CREATE TRIGGER trg_protect_usuario_privileged_columns
    BEFORE UPDATE ON public.usuarios
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_usuario_privileged_columns();

-- ----------------------------------------------------------------------------
-- 6. Precios del asistente 3D: solo el admin puede cambiarlos
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_spirit_pricing()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
BEGIN
    IF COALESCE(auth.role(), '') = 'service_role'
       OR current_user IN ('postgres', 'supabase_admin', 'service_role', 'supabase_auth_admin')
       OR (v_uid IS NOT NULL AND public.is_admin(v_uid)) THEN
        RETURN NEW;
    END IF;

    IF NEW.price_mxn IS DISTINCT FROM OLD.price_mxn THEN NEW.price_mxn := OLD.price_mxn; END IF;
    IF NEW.stripe_price_id IS DISTINCT FROM OLD.stripe_price_id THEN NEW.stripe_price_id := OLD.stripe_price_id; END IF;
    IF NEW.sale_status IS DISTINCT FROM OLD.sale_status THEN NEW.sale_status := OLD.sale_status; END IF;
    IF NEW.is_public IS DISTINCT FROM OLD.is_public THEN NEW.is_public := OLD.is_public; END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_spirit_pricing ON public.spirits;
CREATE TRIGGER trg_protect_spirit_pricing
    BEFORE UPDATE ON public.spirits
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_spirit_pricing();

-- ----------------------------------------------------------------------------
-- 7. RLS: catálogo y configuración solo los administran los admins
--    (antes, cualquier usuario autenticado podía editar precios y borrar
--    accesorios/stickers por la API REST).
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    t TEXT;
    r RECORD;
    v_tables TEXT[] := ARRAY[
        'accessories', 'stickers', 'product_packs', 'product_promotions',
        'gift_campaigns', 'package_configs'
    ];
BEGIN
    FOREACH t IN ARRAY v_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

            -- El catálogo sigue siendo de lectura pública (la tienda lo necesita).
            -- Se recrea la política para que al activar RLS nadie pierda acceso.
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Public read ' || t, t);
            EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
                           'Public read ' || t, t);

            -- Eliminar cualquier política de escritura previa (incluidas las que
            -- permitían a cualquier 'authenticated' modificar el catálogo).
            FOR r IN
                SELECT policyname FROM pg_policies
                WHERE schemaname = 'public' AND tablename = t AND cmd <> 'SELECT'
            LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
            END LOOP;

            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Admins manage ' || t, t);
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()))',
                'Admins manage ' || t, t
            );
        END IF;
    END LOOP;
END $$;

-- Asistentes 3D: el admin administra todo y cada usuario puede subir/editar los suyos.
DO $$
DECLARE
    r RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'spirits') THEN
        EXECUTE 'ALTER TABLE public.spirits ENABLE ROW LEVEL SECURITY';

        EXECUTE 'DROP POLICY IF EXISTS "Public read spirits" ON public.spirits';
        EXECUTE 'CREATE POLICY "Public read spirits" ON public.spirits FOR SELECT TO anon, authenticated USING (true)';

        FOR r IN
            SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'spirits' AND cmd <> 'SELECT'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.spirits', r.policyname);
        END LOOP;

        EXECUTE 'DROP POLICY IF EXISTS "Admins manage spirits" ON public.spirits';
        EXECUTE 'CREATE POLICY "Admins manage spirits" ON public.spirits '
             || 'FOR ALL TO authenticated USING (public.is_admin(auth.uid())) '
             || 'WITH CHECK (public.is_admin(auth.uid()))';

        EXECUTE 'DROP POLICY IF EXISTS "Owners manage own spirits" ON public.spirits';
        EXECUTE 'CREATE POLICY "Owners manage own spirits" ON public.spirits '
             || 'FOR ALL TO authenticated USING (user_id = auth.uid()) '
             || 'WITH CHECK (user_id = auth.uid())';
    END IF;
END $$;

-- Regalos: los usuarios solo ven sus propios claims (el RPC inserta por ellos).
DO $$
DECLARE
    r RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'gift_claims') THEN
        EXECUTE 'ALTER TABLE public.gift_claims ENABLE ROW LEVEL SECURITY';

        FOR r IN
            SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'gift_claims' AND cmd <> 'SELECT'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.gift_claims', r.policyname);
        END LOOP;

        EXECUTE 'DROP POLICY IF EXISTS "Users read their claims" ON public.gift_claims';
        EXECUTE 'CREATE POLICY "Users read their claims" ON public.gift_claims '
             || 'FOR SELECT TO authenticated USING (auth.uid() = user_id)';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 8. Recargar el esquema de PostgREST para que las nuevas tablas/RPC existan
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
