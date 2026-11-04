-- Migration: Create order_refunds table
-- Date: 2026-07-11

CREATE TABLE IF NOT EXISTS public.order_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- e.g., 'Barang Rusak', 'Barang Kurang', etc.
    details TEXT NOT NULL,         -- Kronologi / detail keluhan
    proof_images TEXT[] DEFAULT '{}', -- Array URL foto bukti barang
    status VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    admin_notes TEXT,              -- Catatan admin saat verifikasi
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for lookup performance
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON public.order_refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_user_id ON public.order_refunds(user_id);

-- Add comments for documentation
COMMENT ON TABLE public.order_refunds IS 'Menyimpan data klaim pengajuan komplain refund dari petani';
COMMENT ON COLUMN public.order_refunds.category IS 'Kategori komplain (Barang Rusak, Barang Kurang, Salah Kirim, dll)';
COMMENT ON COLUMN public.order_refunds.details IS 'Penjelasan detail mengenai keluhan fisik barang';
COMMENT ON COLUMN public.order_refunds.proof_images IS 'Daftar URL foto bukti fisik pendukung klaim refund';
