-- ============================================================================
-- INVESTMENT MODULE - SALES TRACKING + TRANSACTIONS LEDGER
-- Idempotent and non-destructive: only adds columns / creates a new table.
-- Safe to run multiple times on the existing Supabase database.
-- ============================================================================

-- 1. investment_cards: sale target + sold state (spreadsheet-like registry)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'investment_cards' AND column_name = 'sale_price') THEN
        ALTER TABLE public.investment_cards ADD COLUMN sale_price DECIMAL(10,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'investment_cards' AND column_name = 'is_sold') THEN
        ALTER TABLE public.investment_cards ADD COLUMN is_sold BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'investment_cards' AND column_name = 'sold_price') THEN
        ALTER TABLE public.investment_cards ADD COLUMN sold_price DECIMAL(10,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'investment_cards' AND column_name = 'sold_quantity') THEN
        ALTER TABLE public.investment_cards ADD COLUMN sold_quantity INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'investment_cards' AND column_name = 'sold_at') THEN
        ALTER TABLE public.investment_cards ADD COLUMN sold_at TIMESTAMPTZ;
    END IF;
END $$;

COMMENT ON COLUMN public.investment_cards.sale_price IS 'Precio al que el dueño planea vender la carta (objetivo de venta)';
COMMENT ON COLUMN public.investment_cards.is_sold IS 'Indica si la carta ya fue vendida';
COMMENT ON COLUMN public.investment_cards.sold_price IS 'Precio real de venta registrado al marcar la carta como vendida';
COMMENT ON COLUMN public.investment_cards.sold_quantity IS 'Cantidad de unidades vendidas';
COMMENT ON COLUMN public.investment_cards.sold_at IS 'Fecha y hora en que se registró la venta';

-- 2. Ledger of every movement (buy / sale / price update) for the vault spreadsheet
CREATE TABLE IF NOT EXISTS public.investment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.investment_categories(id) ON DELETE CASCADE,
    card_id UUID REFERENCES public.investment_cards(id) ON DELETE SET NULL,
    card_name TEXT,
    type TEXT NOT NULL DEFAULT 'purchase', -- 'purchase' | 'sale' | 'price_update'
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) DEFAULT 0,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investment_transactions_category ON public.investment_transactions (category_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_investment_transactions_user ON public.investment_transactions (user_id, created_at DESC);

COMMENT ON TABLE public.investment_transactions IS 'Registro de movimientos de la bóveda de inversión (compras, ventas y actualizaciones de precio)';

-- 3. Row Level Security for the ledger
ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'investment_transactions' AND policyname = 'Users can manage their own transactions') THEN
        CREATE POLICY "Users can manage their own transactions" ON public.investment_transactions
            FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;
