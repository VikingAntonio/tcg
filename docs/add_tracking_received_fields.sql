-- SQL Migration: Extend tracking table to handle sent & received packages
-- and configure Supabase Cron for automated background tracking checks.

ALTER TABLE public.tracking
ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'sent',
ADD COLUMN IF NOT EXISTS seller_name TEXT,
ADD COLUMN IF NOT EXISTS carrier TEXT,
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS tracking_url TEXT,
ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_notified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

-- Backfill legacy records to ensure backward compatibility
UPDATE public.tracking
SET
  direction = COALESCE(direction, 'sent'),
  carrier = COALESCE(carrier, paqueteria),
  tracking_number = COALESCE(tracking_number, guia),
  seller_name = COALESCE(seller_name, nombre_cliente)
WHERE direction IS NULL OR carrier IS NULL OR tracking_number IS NULL OR seller_name IS NULL;

-- Enable pg_cron and pg_net extensions if available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule Supabase Cron job to execute Edge Function 'tracking' daily at midnight
-- Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY with actual Supabase project settings in your dashboard.
/*
SELECT cron.schedule(
    'auto-check-received-trackings-daily',
    '0 0 * * *',
    $$
    SELECT net.http_post(
        url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/tracking',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    );
    $$
);
*/
