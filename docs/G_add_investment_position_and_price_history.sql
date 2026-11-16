-- ============================================================================
-- INVESTMENT MODULE - BINDER SLOT ORDER + PRICE HISTORY
-- Idempotent and non-destructive: only adds a column / creates a table.
-- Safe to run multiple times on the existing Supabase database.
-- ============================================================================

-- 1. investment_cards.position: binder slot order (0-based, per category).
--    Used to keep the card in the slot the user picked and to persist
--    drag & drop reordering inside the binder.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'investment_cards' AND column_name = 'position'
    ) THEN
        ALTER TABLE public.investment_cards ADD COLUMN position INTEGER DEFAULT 0;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_investment_cards_category_position
    ON public.investment_cards (category_id, position);

COMMENT ON COLUMN public.investment_cards.position IS 'Orden de la carta dentro del binder de su colección (0-based)';

-- 2. investment_price_history: market price snapshots shown in the chart.
CREATE TABLE IF NOT EXISTS public.investment_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID REFERENCES public.investment_cards(id) ON DELETE CASCADE,
    price DECIMAL(10,2) DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investment_price_history_card
    ON public.investment_price_history (card_id, recorded_at ASC);

COMMENT ON TABLE public.investment_price_history IS 'Historial de precios de mercado por carta de inversión';

-- 3. Row Level Security for the price history (owner of the card can manage it)
ALTER TABLE public.investment_price_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'investment_price_history' AND policyname = 'Users can manage their own price history'
    ) THEN
        CREATE POLICY "Users can manage their own price history" ON public.investment_price_history
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.investment_cards c
                    WHERE c.id = investment_price_history.card_id AND c.user_id = auth.uid()
                )
            ) WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.investment_cards c
                    WHERE c.id = investment_price_history.card_id AND c.user_id = auth.uid()
                )
            );
    END IF;
END $$;
