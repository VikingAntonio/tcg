-- Add show_foil column to investment_cards
ALTER TABLE investment_cards ADD COLUMN IF NOT EXISTS show_foil BOOLEAN DEFAULT false;
