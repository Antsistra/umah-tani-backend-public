-- Migration: Create blog_categories table for blog articles
-- Date: 2026-02-15
-- Description: Table to store blog article categories

-- Create blog_categories table
CREATE TABLE IF NOT EXISTS blog_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    icon_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_blog_categories_slug ON blog_categories (slug);

CREATE INDEX IF NOT EXISTS idx_blog_categories_active ON blog_categories (is_active);

-- Add trigger to update updated_at automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_blog_categories_updated_at 
    BEFORE UPDATE ON blog_categories 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();