-- Migration: 005_create_products_table.sql
-- Description: Create products table for e-commerce MVP
-- Date: 2026-02-17

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    category_id UUID REFERENCES product_categories (id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(220) NOT NULL UNIQUE,
    description TEXT,
    price DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
    image_url VARCHAR(500),
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);

CREATE INDEX IF NOT EXISTS idx_products_is_available ON products (is_available);

CREATE INDEX IF NOT EXISTS idx_products_slug ON products (slug);

CREATE INDEX IF NOT EXISTS idx_products_price ON products (price);

-- Comment
COMMENT ON TABLE products IS 'E-commerce products for Umah Tani';