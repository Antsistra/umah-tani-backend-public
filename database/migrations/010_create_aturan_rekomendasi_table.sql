-- Migration: 010_create_aturan_rekomendasi_table.sql
-- Description: Forward chaining rules table - Fertilizer Recommendation System
-- Date: 2026-02-21

CREATE TABLE IF NOT EXISTS aturan_rekomendasi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    tanaman_id UUID NOT NULL REFERENCES tanaman (id) ON DELETE CASCADE,
    varietas_id UUID REFERENCES varietas (id) ON DELETE SET NULL,
    hst_min INTEGER NOT NULL CHECK (hst_min >= 0),
    hst_max INTEGER NOT NULL CHECK (hst_max >= 0),
    label_opsi VARCHAR(20) NOT NULL CHECK (
        label_opsi IN (
            'ekonomis',
            'standar',
            'lengkap'
        )
    ),
    created_by UUID,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        CONSTRAINT hst_range_valid CHECK (hst_max >= hst_min)
);

-- Indexes for forward chaining lookups (critical for engine performance)
CREATE INDEX IF NOT EXISTS idx_aturan_tanaman_id ON aturan_rekomendasi (tanaman_id);

CREATE INDEX IF NOT EXISTS idx_aturan_varietas_id ON aturan_rekomendasi (varietas_id);

CREATE INDEX IF NOT EXISTS idx_aturan_label_opsi ON aturan_rekomendasi (label_opsi);

-- Composite index for the main forward chaining query pattern:
-- WHERE tanaman_id = ? AND (varietas_id = ? OR varietas_id IS NULL) AND hst_min <= ? AND hst_max >= ?
CREATE INDEX IF NOT EXISTS idx_aturan_fc_lookup ON aturan_rekomendasi (
    tanaman_id,
    varietas_id,
    hst_min,
    hst_max
);

-- Auto-update updated_at
CREATE TRIGGER update_aturan_rekomendasi_updated_at
    BEFORE UPDATE ON aturan_rekomendasi
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON
TABLE aturan_rekomendasi IS 'Rule base forward chaining: IF tanaman + varietas + rentang HST THEN rekomendasi pupuk (lihat detail_rekomendasi)';

COMMENT ON COLUMN aturan_rekomendasi.hst_min IS 'Hari Setelah Tanam minimum';

COMMENT ON COLUMN aturan_rekomendasi.hst_max IS 'Hari Setelah Tanam maksimum';

COMMENT ON COLUMN aturan_rekomendasi.label_opsi IS 'Opsi rekomendasi: ekonomis, standar, atau lengkap';

COMMENT ON COLUMN aturan_rekomendasi.varietas_id IS 'NULL = berlaku untuk semua varietas tanaman tersebut';