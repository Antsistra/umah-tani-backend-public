-- Migration: 008_create_varietas_table.sql
-- Description: Master table for plant varieties (varietas) - Fertilizer Recommendation System
-- Date: 2026-02-21

CREATE TABLE IF NOT EXISTS varietas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    tanaman_id UUID NOT NULL REFERENCES tanaman (id) ON DELETE CASCADE,
    nama VARCHAR(100) NOT NULL,
    deskripsi TEXT,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        UNIQUE (tanaman_id, nama)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_varietas_tanaman_id ON varietas (tanaman_id);

CREATE INDEX IF NOT EXISTS idx_varietas_nama ON varietas (nama);

-- Auto-update updated_at
CREATE TRIGGER update_varietas_updated_at
    BEFORE UPDATE ON varietas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON
TABLE varietas IS 'Master data varietas tanaman, relasi ke tabel tanaman';