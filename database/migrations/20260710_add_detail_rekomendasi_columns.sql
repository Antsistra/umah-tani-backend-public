-- Migration: 20260710_add_detail_rekomendasi_columns.sql
-- Description: Add columns for fertilizer recommendations detailing application instructions and spacing
-- Date: 2026-07-10

-- 1. Add spacing columns to aturan_rekomendasi table
ALTER TABLE aturan_rekomendasi
  ADD COLUMN IF NOT EXISTS jarak_tanam_lebar INTEGER,
  ADD COLUMN IF NOT EXISTS jarak_tanam_panjang INTEGER;

COMMENT ON COLUMN aturan_rekomendasi.jarak_tanam_lebar
  IS 'Lebar jarak antar tanaman (dalam satuan cm)';
COMMENT ON COLUMN aturan_rekomendasi.jarak_tanam_panjang
  IS 'Panjang jarak antar tanaman (dalam satuan cm)';

-- 2. Add description and frequency columns to detail_rekomendasi table
ALTER TABLE detail_rekomendasi
  ADD COLUMN IF NOT EXISTS frekuensi_aplikasi VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cara_penggunaan TEXT;

COMMENT ON COLUMN detail_rekomendasi.frekuensi_aplikasi
  IS 'Berapa kali/frekuensi pemakaian pupuk dalam rentang HST, contoh: "3 kali aplikasi", "2 hari sekali", "1 kali pakai"';
COMMENT ON COLUMN detail_rekomendasi.cara_penggunaan
  IS 'Petunjuk cara mengaplikasikan pupuk, contoh: "Ditaburkan merata di sekitar pangkal batang"';
