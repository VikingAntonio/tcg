-- Migration: Add description to binder_card_slots table
ALTER TABLE public.binder_card_slots ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
