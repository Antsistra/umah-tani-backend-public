-- Migration: Add Biteship tracking columns to order_shipments table
-- Date: 2026-07-11

ALTER TABLE order_shipments
ADD COLUMN IF NOT EXISTS biteship_order_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS biteship_label_url TEXT,
ADD COLUMN IF NOT EXISTS tracking_history JSONB;

-- Add comments for documentation
COMMENT ON COLUMN order_shipments.biteship_order_id IS 'ID transaksi pengiriman unik dari Biteship';
COMMENT ON COLUMN order_shipments.biteship_label_url IS 'URL download label pengiriman (PDF) dari Biteship';
COMMENT ON COLUMN order_shipments.tracking_history IS 'Histori pelacakan status pengiriman dalam format array JSON';
