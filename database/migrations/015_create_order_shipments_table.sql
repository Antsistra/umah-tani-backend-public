-- Shipping Details (filled by admin after payment success)
CREATE TABLE IF NOT EXISTS order_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  courier VARCHAR(50), -- JNE, J&T, SiCepat, etc
  service_type VARCHAR(50), -- REG, YES, OKE, etc
  tracking_number VARCHAR(100),
  estimated_delivery DATE,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_order_shipments_order_id ON order_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_shipments_tracking_number ON order_shipments(tracking_number);
