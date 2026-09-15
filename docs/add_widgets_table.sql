-- SQL Migration: Add widget_domains table for Custom Labels / Widgets embedding
-- This table tracks domain registrations, authorization, and activation status for external embeds.

CREATE TABLE IF NOT EXISTS widget_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    widget_type TEXT NOT NULL DEFAULT 'chatbot',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_domain_widget UNIQUE (user_id, domain, widget_type)
);

-- Index for fast domain verification lookups by external widgets
CREATE INDEX IF NOT EXISTS idx_widget_domains_lookup ON widget_domains(domain, widget_type, is_active);
CREATE INDEX IF NOT EXISTS idx_widget_domains_user ON widget_domains(user_id);

-- Enable RLS
ALTER TABLE widget_domains ENABLE ROW LEVEL SECURITY;

-- Policy 1: Everyone (anon and authenticated) can query active widget domain authorizations
CREATE POLICY "Public domain authorization lookup" ON widget_domains
    FOR SELECT
    USING (is_active = true);

-- Policy 2: Authenticated users can view all their registered domains (active or inactive)
CREATE POLICY "Users can select own widget domains" ON widget_domains
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'admin'));

-- Policy 3: Authenticated users can insert their own domains
CREATE POLICY "Users can insert own widget domains" ON widget_domains
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'admin'));

-- Policy 4: Authenticated users can update their own domains (or Admin full update)
CREATE POLICY "Users and admin can update widget domains" ON widget_domains
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'admin'));

-- Policy 5: Authenticated users can delete their own domains (or Admin full delete)
CREATE POLICY "Users and admin can delete widget domains" ON widget_domains
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'admin'));
