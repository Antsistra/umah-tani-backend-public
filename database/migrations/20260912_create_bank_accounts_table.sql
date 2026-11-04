-- ============================================================
-- Migration: Create bank_accounts table
-- Stores company bank account info for manual bank transfer payments
-- ============================================================

CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name VARCHAR(50) NOT NULL,       -- 'BCA', 'BRI', 'Mandiri', 'BNI', 'DANA'
  account_number VARCHAR(50) NOT NULL,
  account_name VARCHAR(100) NOT NULL,   -- e.g. 'Umah Tani Agriculture'
  bank_code VARCHAR(10),                -- internal bank code if needed
  logo_url TEXT,                        -- optional logo URL for display
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for active accounts lookup
CREATE INDEX IF NOT EXISTS idx_bank_accounts_active ON bank_accounts(is_active);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_bank_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_bank_accounts_updated_at ON bank_accounts;
CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_accounts_updated_at();

-- Seed: Insert placeholder bank account
-- TODO: Replace with real company bank account data before production deploy
INSERT INTO bank_accounts (bank_name, account_number, account_name, is_active)
VALUES
  ('BCA', '1234567890', 'Umah Tani Agriculture', true),
  ('BRI', '9876543210', 'Umah Tani Agriculture', true)
ON CONFLICT DO NOTHING;
