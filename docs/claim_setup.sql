-- SQL Migration to create claims table and functions
-- Execute this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES usuarios(id) ON DELETE CASCADE, -- The seller
    title TEXT DEFAULT 'Producto Claim',
    description TEXT,
    rules TEXT,
    price TEXT,
    image_urls TEXT[], -- Array of image URLs
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    winner_id UUID REFERENCES usuarios(id), -- The buyer
    winner_name TEXT,
    claimed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'Activa',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Public can view claims" ON claims;
DROP POLICY IF EXISTS "Users can create claims" ON claims;
DROP POLICY IF EXISTS "Owners can update their claims" ON claims;
DROP POLICY IF EXISTS "Owners can delete their claims" ON claims;

-- Policies
-- Anyone can see active or recently claimed products
CREATE POLICY "Public can view claims" ON claims
    FOR SELECT USING (true);

-- Only the seller (authenticated) can create claims
-- Using authenticated role check + user_id check
CREATE POLICY "Users can create claims" ON claims
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Owners can update their own claims (for editing)
CREATE POLICY "Owners can update their claims" ON claims
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete their claims" ON claims
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_claims_user_id ON claims(user_id);
CREATE INDEX IF NOT EXISTS idx_claims_winner_id ON claims(winner_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

-- Enable Realtime for claims table
-- Note: This might need to be run manually if the publication already exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE claims;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not automatically add to realtime publication. Please do it manually in the Supabase Dashboard.';
END $$;

-- Atomic function to claim a product
-- This prevents race conditions where two users claim the same product at once
CREATE OR REPLACE FUNCTION claim_product(p_claim_id UUID, p_claimant_id UUID, p_claimant_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_winner UUID;
    v_status TEXT;
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Select for update to lock the row
    SELECT winner_id, status, start_date, end_date
    INTO v_current_winner, v_status, v_start, v_end
    FROM claims
    WHERE id = p_claim_id
    FOR UPDATE;

    -- Basic validations
    IF v_current_winner IS NOT NULL THEN
        RETURN FALSE; -- Already claimed
    END IF;

    IF v_status = 'Reclamada' OR v_status = 'Finalizada' THEN
        RETURN FALSE; -- Not available
    END IF;

    IF v_start IS NOT NULL AND v_now < v_start THEN
        RETURN FALSE; -- Not started yet
    END IF;

    IF v_end IS NOT NULL AND v_now > v_end THEN
        RETURN FALSE; -- Already ended
    END IF;

    -- Perform the claim
    UPDATE claims
    SET winner_id = p_claimant_id,
        winner_name = p_claimant_name,
        claimed_at = v_now,
        status = 'Reclamada'
    WHERE id = p_claim_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
