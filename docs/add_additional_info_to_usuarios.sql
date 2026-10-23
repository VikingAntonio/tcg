-- SQL Migration: Add additional_info JSONB column to usuarios table for assistant context
-- Enables users to store custom text blocks (title and description) for their AI assistant.

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS additional_info JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN usuarios.additional_info IS 'Stores user-defined additional business information blocks (array of objects with title and description) for the AI assistant context.';
