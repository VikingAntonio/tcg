-- Migration: Support queries and indexes for Binder Investments and Page-level valuations
-- Table references: public.binders, public.binder_pages, public.binder_card_slots

-- 1. Index on binder_card_slots to optimize cost_price, price and quantity calculations per page
CREATE INDEX IF NOT EXISTS idx_binder_card_slots_page_metrics
ON public.binder_card_slots (page_id, price, cost_price, quantity);

-- 2. Index on binder_pages to accelerate binder hierarchy lookups
CREATE INDEX IF NOT EXISTS idx_binder_pages_binder_index
ON public.binder_pages (binder_id, page_index);

COMMENT ON TABLE public.binder_card_slots IS 'Almacena los slots de cartas en las páginas de binders con precios, costos de inversión y stock';
