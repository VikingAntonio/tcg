-- SQL Migration: Add Stripe subscription tracking to usuarios table
-- Allows widgets and domain authorization system to verify active monthly subscription status.

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMPTZ;

-- Create index for fast subscription status lookups
CREATE INDEX IF NOT EXISTS idx_usuarios_subscription_status ON usuarios(subscription_status);

-- Ensure public select permissions on subscription_status if needed for widget verification
COMMENT ON COLUMN usuarios.subscription_status IS 'Tracks Stripe subscription status: active, past_due, canceled, unpaid, inactive';
