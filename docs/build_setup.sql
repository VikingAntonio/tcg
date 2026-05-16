-- New Build System Migration
-- Table for Build Assets (Separate from Spirits)
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

-- Table for Build Assignments (Dual Interface)
CREATE TABLE IF NOT EXISTS build_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    view_name TEXT NOT NULL, -- 'albums', 'decks', 'sealed', etc.
    asset_id UUID REFERENCES build_assets(id) ON DELETE CASCADE,
    target TEXT NOT NULL DEFAULT 'public', -- 'public' or 'admin'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, view_name, target)
);

-- Enable RLS
ALTER TABLE build_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_assignments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Manage own assets" ON build_assets FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Public view assets" ON build_assets FOR SELECT USING (TRUE);
CREATE POLICY "Manage own assignments" ON build_assignments FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Public view assignments" ON build_assignments FOR SELECT USING (TRUE);
