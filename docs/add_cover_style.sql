-- Add cover_style column to albums table
ALTER TABLE albums ADD COLUMN IF NOT EXISTS cover_style TEXT DEFAULT 'default';
