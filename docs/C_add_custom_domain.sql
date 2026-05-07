-- Add custom_domain column to usuarios table
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS custom_domain TEXT;

-- Index for faster lookups by domain
CREATE INDEX IF NOT EXISTS idx_usuarios_custom_domain ON usuarios(custom_domain);

-- Ensure the column is public if needed for the integration
-- Note: Depending on your RLS settings, you might need to update policies.
-- Example (Adjust according to your specific policy names):
-- ALTER POLICY "Allow public read access to store info" ON usuarios
-- FOR SELECT USING (true);
