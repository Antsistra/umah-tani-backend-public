-- Update orders table with shipping address snapshot and pricing breakdown
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_address_id UUID REFERENCES user_addresses(id),
  ADD COLUMN IF NOT EXISTS shipping_recipient_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipping_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS shipping_address TEXT,
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

-- Rename total_price to total_amount if exists (for consistency)
DO $$ 
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns 
            WHERE table_name='orders' AND column_name='total_price') THEN
    ALTER TABLE orders RENAME COLUMN total_price TO total_amount;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
