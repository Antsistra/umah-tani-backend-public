-- ============================================================
-- Migration: Update transactions table for manual payment flow
-- Replaces Midtrans-specific columns with generic manual payment columns
-- ============================================================

-- 1. Rename midtrans_response -> payment_gateway_response (backward compatible)
ALTER TABLE transactions RENAME COLUMN midtrans_response TO payment_gateway_response;

-- 2. Add new columns for manual payment flow
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS proof_of_payment_url TEXT,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS payment_info JSONB;

-- payment_info JSONB stores:
-- For QRIS:          { qrisString, amount }
-- For bank_transfer: { bankAccountId, bankName, accountNumber, accountName, amount }

-- transaction_status values for manual payment:
-- 'pending_verification'  -> transaction created, user has not yet uploaded proof
-- 'awaiting_verification' -> proof uploaded, waiting for admin to verify
-- 'approved'              -> admin confirmed payment
-- 'rejected'              -> admin rejected (with reason)
-- 'expired'               -> payment window expired, no action taken
-- 'cancelled'             -> manually cancelled

-- 3. Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_transactions_proof_status
  ON transactions(transaction_status)
  WHERE transaction_status IN ('pending_verification', 'awaiting_verification');

CREATE INDEX IF NOT EXISTS idx_transactions_verified_by
  ON transactions(verified_by);
