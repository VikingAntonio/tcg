-- SQL Migration to create claims table and functions
-- Execute this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES usuarios(id) ON DELETE CASCADE, -- The seller
    title TEXT NOT NULL,
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

-- Policies
-- Anyone can see active or recently claimed products
CREATE POLICY "Public can view claims" ON claims
    FOR SELECT USING (true);

-- Only the seller (authenticated) can create claims
-- Using auth.uid() = user_id to ensure they only create claims for themselves
CREATE POLICY "Users can create claims" ON claims
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Owners can update their own claims (for editing)
-- Also allow updates to the winner fields (this is usually handled by SECURITY DEFINER function)
CREATE POLICY "Owners can update their claims" ON claims
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete their claims" ON claims
    FOR DELETE USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_claims_user_id ON claims(user_id);
CREATE INDEX IF NOT EXISTS idx_claims_winner_id ON claims(winner_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

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
