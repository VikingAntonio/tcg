-- Vinculación de activos con precios de mercado automáticos.
--
-- Cada carta se vincula UNA vez a una impresión concreta de una base pública
-- (Pokémon = TCGdex, Yu-Gi-Oh! = YGOPRODeck, Magic = Scryfall). A partir de ahí
-- el precio se refresca solo y se guarda en market_price.
--
-- IMPORTANTE: market_price NO sustituye a current_price. current_price sigue
-- siendo el valor (en MXN) que el dueño usa en sus cálculos. Para pasarlo hay
-- que pulsar "Usar precio de mercado" en el modal de la carta.
--
-- Idempotente: solo agrega columnas si faltan.

ALTER TABLE public.investment_cards
    ADD COLUMN IF NOT EXISTS market_provider TEXT,
    ADD COLUMN IF NOT EXISTS market_card_id TEXT,
    ADD COLUMN IF NOT EXISTS market_variant TEXT,
    ADD COLUMN IF NOT EXISTS market_price NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS market_price_currency TEXT,
    ADD COLUMN IF NOT EXISTS market_price_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.investment_cards.market_provider IS 'Base pública del precio automático: tcgdex | ygoprodeck | scryfall';
COMMENT ON COLUMN public.investment_cards.market_card_id IS 'Id de la carta en esa base (se conserva aunque cambie el nombre)';
COMMENT ON COLUMN public.investment_cards.market_variant IS 'Impresión/acabado elegido (holofoil, usd_foil, código de set, etc.)';
COMMENT ON COLUMN public.investment_cards.market_price IS 'Último precio de mercado obtenido, en market_price_currency';
COMMENT ON COLUMN public.investment_cards.market_price_currency IS 'Moneda del precio de mercado (USD o EUR)';
COMMENT ON COLUMN public.investment_cards.market_price_updated_at IS 'Momento en que se obtuvo market_price';

NOTIFY pgrst, 'reload schema';
