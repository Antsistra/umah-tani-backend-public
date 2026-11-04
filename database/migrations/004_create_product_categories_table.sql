-- Migration: 004_create_product_categories_table.sql
-- Description: Create product_categories table for e-commerce MVP
-- Date: 2026-02-17

CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_product_categories_is_active ON product_categories (is_active);

CREATE INDEX IF NOT EXISTS idx_product_categories_slug ON product_categories (slug);

-- Comment
COMMENT ON
TABLE product_categories IS 'E-commerce product categories for Umah Tani';