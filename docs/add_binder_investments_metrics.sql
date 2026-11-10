-- Migration: Support queries and indexes for Binder Investments and Page-level valuations
-- Table references: public.binders, public.binder_pages, public.binder_card_slots

-- 1. Ensure required columns exist on binder_card_slots before indexing
ALTER TABLE public.binder_card_slots
  ADD COLUMN IF NOT EXISTS cost_price TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS price TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS extra_images JSONB DEFAULT '[]'::jsonb;

-- 2. Index on binder_card_slots to optimize cost_price, price and quantity calculations per page
CREATE INDEX IF NOT EXISTS idx_binder_card_slots_page_metrics
ON public.binder_card_slots (page_id, price, cost_price, quantity);

-- 3. Index on binder_pages to accelerate binder hierarchy lookups
CREATE INDEX IF NOT EXISTS idx_binder_pages_binder_index
ON public.binder_pages (binder_id, page_index);

COMMENT ON COLUMN public.binder_card_slots.cost_price IS 'Costo de inversión o compra de la carta para el dueño del binder';
COMMENT ON COLUMN public.binder_card_slots.price IS 'Precio de venta de la carta en el binder';
COMMENT ON COLUMN public.binder_card_slots.quantity IS 'Cantidad o stock disponible de la carta en este slot';
COMMENT ON TABLE public.binder_card_slots IS 'Almacena los slots de cartas en las páginas de binders con precios, costos de inversión y stock';
