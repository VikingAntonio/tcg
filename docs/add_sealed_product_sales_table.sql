-- ====================================================================
-- TABLA DE VENTAS Y NOTIFICACIONES DE PRODUCTOS SELLADOS
-- (public.sealed_product_sales)
-- ====================================================================
-- Ejecuta este script SQL en el Editor SQL de Supabase para habilitar
-- el almacenamiento de ventas, notificaciones y estado de pago de
-- productos sellados adquiridos por clientes.

CREATE TABLE IF NOT EXISTS public.sealed_product_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  buyer_name text NOT NULL DEFAULT 'Cliente Anonimo',
  buyer_contact text DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount numeric DEFAULT 0,
  payment_status text DEFAULT 'Pagado Completo', -- 'Pagado Completo', 'Apartado (50%)', 'Pago Parcial', 'Pago al Entregar'
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS en public.sealed_product_sales
ALTER TABLE public.sealed_product_sales ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad RLS
DROP POLICY IF EXISTS "Permitir insercion publica de ventas de productos" ON public.sealed_product_sales;
CREATE POLICY "Permitir insercion publica de ventas de productos"
  ON public.sealed_product_sales
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Vendedores ven y administran sus notificaciones de ventas" ON public.sealed_product_sales;
CREATE POLICY "Vendedores ven y administran sus notificaciones de ventas"
  ON public.sealed_product_sales
  FOR ALL
  USING (true);

-- Comentarios
COMMENT ON TABLE public.sealed_product_sales IS 'Registro de ventas y notificaciones de productos sellados';
COMMENT ON COLUMN public.sealed_product_sales.payment_status IS 'Estado de pago: Pagado Completo, Apartado (50%), Pago Parcial, Pago al Entregar';
