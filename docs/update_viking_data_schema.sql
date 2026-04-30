-- Update viking_data table to add missing columns for holographic effects
ALTER TABLE public.viking_data ADD COLUMN IF NOT EXISTS holo_effect TEXT;
ALTER TABLE public.viking_data ADD COLUMN IF NOT EXISTS custom_mask_url TEXT;
