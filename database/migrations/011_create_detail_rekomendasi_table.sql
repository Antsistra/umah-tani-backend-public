-- Migration: 011_create_detail_rekomendasi_table.sql
-- Description: Rule action details (THEN part) - Fertilizer Recommendation System
-- Date: 2026-02-21

CREATE TABLE IF NOT EXISTS detail_rekomendasi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    aturan_id UUID NOT NULL REFERENCES aturan_rekomendasi (id) ON DELETE CASCADE,
    pupuk_id UUID NOT NULL REFERENCES pupuk (id) ON DELETE CASCADE,
    dosis_per_ha DECIMAL(10, 2) NOT NULL CHECK (dosis_per_ha > 0),
    keterangan TEXT,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        UNIQUE (aturan_id, pupuk_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_detail_rekomendasi_aturan_id ON detail_rekomendasi (aturan_id);

CREATE INDEX IF NOT EXISTS idx_detail_rekomendasi_pupuk_id ON detail_rekomendasi (pupuk_id);

COMMENT ON
TABLE detail_rekomendasi IS 'Detail pupuk & dosis per aturan rekomendasi (bagian THEN dari rule forward chaining)';

COMMENT ON COLUMN detail_rekomendasi.dosis_per_ha IS 'Dosis pupuk dalam satuan per hektar';