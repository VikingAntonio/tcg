-- SQL for Spirits Management System

-- 1. Create spirits table
CREATE TABLE IF NOT EXISTS spirits (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    gltf_url TEXT NOT NULL,
    texture_url TEXT,
    animation_type TEXT DEFAULT 'orbit', -- 'orbit' or 'float'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add selected_spirit_id to usuarios table
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS selected_spirit_id INTEGER REFERENCES spirits(id);

-- 3. Enable Storage (Optional: Run if your storage bucket 'spirits' is not created yet)
-- Note: You should also create a public bucket named 'spirits' in the Supabase Dashboard.

-- 4. Initial seed data (Optional: Ash default)
-- INSERT INTO spirits (name, gltf_url, animation_type) VALUES ('Ash Ketchum', 'https://your-storage.supabase.co/storage/v1/object/public/assets/ash.gltf', 'orbit');
