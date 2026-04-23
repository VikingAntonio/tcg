-- Update decks table to support cover images
ALTER TABLE decks ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Update deck_cards table to support sections (Main, Extra, Side)
ALTER TABLE deck_cards ADD COLUMN IF NOT EXISTS section TEXT DEFAULT 'Main';

-- Optional: Ensure existing records have a default section
UPDATE deck_cards SET section = 'Main' WHERE section IS NULL;
