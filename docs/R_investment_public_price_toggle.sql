-- Precio que se muestra en el link público de inversiones, carta por carta.
-- false (por defecto) = precio de venta (sale_price, con current_price de respaldo)
-- true                = precio de mercado (current_price, en USD)
-- Idempotente: se puede ejecutar varias veces sin efectos secundarios.

alter table public.investment_cards
    add column if not exists show_market_price boolean not null default false;

comment on column public.investment_cards.show_market_price is
    'Si es true, el link público muestra current_price (mercado) en vez de sale_price.';

notify pgrst, 'reload schema';
