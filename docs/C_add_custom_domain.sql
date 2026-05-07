-- SQL Migration: Add custom_domain to usuarios table
-- This allows users to authorize a specific external domain for embedding their binders.

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS custom_domain TEXT;

-- Index for faster lookups by domain (useful for the integration script)
CREATE INDEX IF NOT EXISTS idx_usuarios_custom_domain ON usuarios(custom_domain);
