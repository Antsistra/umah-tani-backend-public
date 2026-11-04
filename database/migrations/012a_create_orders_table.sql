-- Create orders table (base structure for e-commerce)
-- This table should be created before running migration 013

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Order identification
  order_number VARCHAR(50) UNIQUE NOT NULL,
  
  -- User reference
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Order status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- Values: pending, processing, shipped, delivered, cancelled
  
  -- Payment status
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  -- Values: unpaid, paid, failed, refunded
  
  -- Pricing (will be enhanced by migration 013)
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at 
  BEFORE UPDATE ON orders 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
