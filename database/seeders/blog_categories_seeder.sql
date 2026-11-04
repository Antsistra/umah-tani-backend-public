-- Seeder: blog_categories
-- Date: 2026-02-15
-- Description: Insert sample categories for blog articles

-- Insert sample categories for agricultural education content
INSERT INTO
    blog_categories (name, slug, description)
VALUES (
        'Tanaman Padi',
        'tanaman-padi',
        'Panduan lengkap budidaya tanaman padi dari persiapan lahan hingga panen'
    ),
    (
        'Hidroponik',
        'hidroponik',
        'Teknik bercocok tanam tanpa tanah menggunakan larutan nutrisi'
    ),
    (
        'Pupuk Organik',
        'pupuk-organik',
        'Cara pembuatan dan penggunaan pupuk organik untuk tanaman'
    ),
    (
        'Hama & Penyakit',
        'hama-penyakit',
        'Identifikasi dan cara mengatasi hama serta penyakit tanaman'
    ),
    (
        'Teknik Panen',
        'teknik-panen',
        'Panduan waktu yang tepat dan cara panen yang benar'
    ),
    (
        'Irigasi',
        'irigasi',
        'Sistem pengairan dan manajemen air untuk pertanian'
    ),
    (
        'Tanaman Sayuran',
        'tanaman-sayuran',
        'Budidaya berbagai jenis tanaman sayuran'
    ),
    (
        'Tanaman Buah',
        'tanaman-buah',
        'Cara menanam dan merawat tanaman buah-buahan'
    ),
    (
        'Composting',
        'composting',
        'Pembuatan kompos dari limbah organik untuk kesuburan tanah'
    ),
    (
        'Greenhouse',
        'greenhouse',
        'Teknologi rumah kaca untuk optimalisasi produksi tanaman'
    ) ON CONFLICT (slug) DO NOTHING;