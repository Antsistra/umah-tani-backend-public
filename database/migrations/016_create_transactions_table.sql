-- Transactions (Payment Gateway - Midtrans)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  transaction_id VARCHAR(100) UNIQUE,
  gross_amount DECIMAL(10,2) NOT NULL,
  payment_type VARCHAR(50), -- qris, bank_transfer
  transaction_status VARCHAR(50), -- pending, settlement, capture, deny, cancel, expire
  fraud_status VARCHAR(50),
  midtrans_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_id ON transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(transaction_status);
