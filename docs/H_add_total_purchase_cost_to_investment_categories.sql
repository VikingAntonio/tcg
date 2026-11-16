-- ============================================================================
-- INVESTMENT MODULE - TOTAL PURCHASE COST PER COLLECTION (LOT PRICE)
-- Idempotent and non-destructive: only adds a nullable column.
-- Safe to run multiple times on the existing Supabase database.
--
-- Use case: buying a lot of cards for a single price (e.g. 10 cards for 1000).
-- When set, the collection's lot price replaces the sum of the per-card
-- purchase prices in every general calculation (cost, profit, ROI).
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'investment_categories' AND column_name = 'total_purchase_cost'
    ) THEN
        ALTER TABLE public.investment_categories ADD COLUMN total_purchase_cost DECIMAL(12,2);
    END IF;
END $$;

COMMENT ON COLUMN public.investment_categories.total_purchase_cost IS 'Precio total de compra del lote para esta colección (opcional). Si está definido, sustituye la suma de precios de compra por carta.';
