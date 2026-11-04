-- Order Items (products in the order with snapshot)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name VARCHAR(255) NOT NULL, -- snapshot
  product_price DECIMAL(10,2) NOT NULL, -- snapshot
  quantity INTEGER NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL, -- price * quantity
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
