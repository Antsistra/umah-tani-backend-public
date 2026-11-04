-- Migration: 007_create_tanaman_table.sql
-- Description: Master table for plants (tanaman) - Fertilizer Recommendation System
-- Date: 2026-02-21

CREATE TABLE IF NOT EXISTS tanaman (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    nama VARCHAR(100) NOT NULL UNIQUE,
    deskripsi TEXT,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Index for name lookup
CREATE INDEX IF NOT EXISTS idx_tanaman_nama ON tanaman (nama);

-- Auto-update updated_at
CREATE TRIGGER update_tanaman_updated_at
    BEFORE UPDATE ON tanaman
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON
TABLE tanaman IS 'Master data tanaman untuk sistem rekomendasi pupuk (forward chaining)';