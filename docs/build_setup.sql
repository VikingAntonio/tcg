-- Setup for the Build System
-- This allows admins and stores to upload GLTF models and assign them to specific views as "Under Construction" or custom placeholders.

-- Table for Build Assets (GLTF Models)
CREATE TABLE IF NOT EXISTS build_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    gltf_url TEXT NOT NULL,
    poster_url TEXT,
    animation_type TEXT DEFAULT 'orbit',
    scale FLOAT DEFAULT 1.8,
    particle_asset TEXT DEFAULT 'cerezo.png',
    particle_movement_type TEXT DEFAULT 'falling',
    texture_url TEXT,
    user_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for Build Assignments
-- Maps an asset to a specific view (e.g., 'sealed', 'albums') for public or admin interfaces.
CREATE TABLE IF NOT EXISTS build_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    view_name TEXT NOT NULL, -- 'sealed', 'albums', 'decks', 'auctions', 'wishlist', 'investments', 'claims', 'events'
    asset_id UUID REFERENCES build_assets(id) ON DELETE CASCADE,
    target TEXT NOT NULL DEFAULT 'public', -- 'public' or 'admin'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, view_name, target) -- Only one active asset per view/target per user
);

-- Enable RLS
ALTER TABLE build_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_assignments ENABLE ROW LEVEL SECURITY;

-- Policies for build_assets
CREATE POLICY "Users can manage their own build assets"
ON build_assets FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can view active build assets"
ON build_assets FOR SELECT
USING (TRUE);

-- Policies for build_assignments
CREATE POLICY "Users can manage their own build assignments"
ON build_assignments FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can view build assignments"
ON build_assignments FOR SELECT
USING (TRUE);

-- Realtime setup
ALTER TABLE build_assignments REPLICA IDENTITY FULL;
-- Note: Make sure to add build_assignments to the supabase_realtime publication if needed
-- ALTER PUBLICATION supabase_realtime ADD TABLE build_assignments;
