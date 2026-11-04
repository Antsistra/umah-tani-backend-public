-- Migration: Create blog_articles table for blog content
-- Date: 2026-02-15
-- Description: Table to store blog articles/content for education

-- Create blog_articles table
CREATE TABLE IF NOT EXISTS blog_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL,
    featured_image_url VARCHAR(500),
    category_id UUID REFERENCES blog_categories (id) ON DELETE SET NULL,
    author_name VARCHAR(255) DEFAULT 'Admin',
    is_published BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_blog_articles_slug ON blog_articles (slug);

CREATE INDEX IF NOT EXISTS idx_blog_articles_published ON blog_articles (is_published);

CREATE INDEX IF NOT EXISTS idx_blog_articles_featured ON blog_articles (is_featured);

CREATE INDEX IF NOT EXISTS idx_blog_articles_category ON blog_articles (category_id);

CREATE INDEX IF NOT EXISTS idx_blog_articles_published_at ON blog_articles (published_at);

-- Create compound index for common queries
CREATE INDEX IF NOT EXISTS idx_blog_articles_published_category ON blog_articles (is_published, category_id);

-- Add trigger to update updated_at automatically
CREATE TRIGGER update_blog_articles_updated_at 
    BEFORE UPDATE ON blog_articles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to automatically set published_at when article is published
CREATE OR REPLACE FUNCTION set_published_at()
RETURNS TRIGGER AS $$
BEGIN
    -- If is_published is being changed to true and published_at is null
    IF NEW.is_published = true AND OLD.is_published = false AND NEW.published_at IS NULL THEN
        NEW.published_at = NOW();
    -- If is_published is being changed to false, clear published_at
    ELSIF NEW.is_published = false AND OLD.is_published = true THEN
        NEW.published_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_blog_articles_published_at 
    BEFORE UPDATE ON blog_articles 
    FOR EACH ROW 
    EXECUTE FUNCTION set_published_at();