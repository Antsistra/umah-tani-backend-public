-- Migration: Add cost_price and sold_count to products and order_items
-- Date: 2026-09-22

-- 1. Add cost_price & sold_count to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sold_count INTEGER DEFAULT 0;

-- 2. Add cost_price snapshot to order_items table for historical profit/loss calculation
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2) DEFAULT 0;

-- 3. Create or replace trigger function to update sold_count on products & snapshot cost_price when order is paid/completed
CREATE OR REPLACE FUNCTION update_product_sold_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if status changed to 'paid' or 'completed'
    IF (NEW.status IN ('paid', 'completed') AND (OLD.status IS NULL OR OLD.status NOT IN ('paid', 'completed'))) THEN
        -- Snapshot cost_price from products to order_items
        UPDATE order_items oi
        SET cost_price = COALESCE(p.cost_price, 0)
        FROM products p
        WHERE oi.order_id = NEW.id AND oi.product_id = p.id;

        -- Increment sold_count in products table
        UPDATE products p
        SET sold_count = COALESCE(p.sold_count, 0) + oi.quantity
        FROM order_items oi
        WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger on orders table
DROP TRIGGER IF EXISTS trg_update_sold_count ON orders;
CREATE TRIGGER trg_update_sold_count
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_product_sold_count();
