-- Webhook Logs (for Midtrans notifications)
CREATE TABLE IF NOT EXISTS payment_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id VARCHAR(100),
  notification_body JSONB,
  signature_key VARCHAR(255),
  is_verified BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_payment_notifications_transaction_id ON payment_notifications(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_created_at ON payment_notifications(created_at);
