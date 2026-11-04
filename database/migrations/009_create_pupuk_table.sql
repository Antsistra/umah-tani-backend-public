-- Migration: 009_create_pupuk_table.sql
-- Description: Master table for fertilizers (pupuk) - Fertilizer Recommendation System
-- Date: 2026-02-21

CREATE TABLE IF NOT EXISTS pupuk (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    nama VARCHAR(100) NOT NULL UNIQUE,
    satuan VARCHAR(20) NOT NULL DEFAULT 'kg',
    deskripsi TEXT,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Index for name lookup
CREATE INDEX IF NOT EXISTS idx_pupuk_nama ON pupuk (nama);

-- Auto-update updated_at
CREATE TRIGGER update_pupuk_updated_at
    BEFORE UPDATE ON pupuk
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON
TABLE pupuk IS 'Master data pupuk (Urea, SP-36, KCl, ZA, NPK Phonska, dll)';