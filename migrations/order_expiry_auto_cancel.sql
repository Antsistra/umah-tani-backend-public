-- =============================================================================
-- MIGRATION: Order Expiry Auto-Cancel
-- Jalankan di: Supabase Dashboard → SQL Editor
-- Project: ulmijyepndzvxhcujxii (UT-Backend)
-- =============================================================================

-- ─── Step 1: Tambah kolom expires_at dan payment_reminder_sent ke tabel orders ─
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_reminder_sent BOOLEAN DEFAULT false;

-- Backfill untuk order lama yang masih awaiting_payment_method
UPDATE orders
SET expires_at = created_at + INTERVAL '10 minutes'
WHERE status = 'awaiting_payment_method'
  AND expires_at IS NULL;

-- Index untuk query cron yang efisien
CREATE INDEX IF NOT EXISTS idx_orders_expires_at_status
  ON orders (status, expires_at)
  WHERE status = 'awaiting_payment_method';


-- ─── Step 2: Enable pg_cron extension ────────────────────────────────────────
-- (Supabase sudah include pg_cron secara default)
CREATE EXTENSION IF NOT EXISTS pg_cron;


-- ─── Step 3: Function cancel_expired_orders ──────────────────────────────────
CREATE OR REPLACE FUNCTION cancel_expired_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec    RECORD;
  item   RECORD;
  prod   RECORD;
BEGIN
  -- A. Kirim pengingat 5 menit jika sisa waktu <= 5 menit dan pengingat belum dikirim
  FOR rec IN
    SELECT id, user_id, order_number
    FROM orders
    WHERE status = 'awaiting_payment_method'
      AND expires_at IS NOT NULL
      AND payment_reminder_sent = false
      AND expires_at - INTERVAL '5 minutes' <= now()
      AND expires_at > now()
  LOOP
    -- 1. Send warning notification
    INSERT INTO notifications (title, body, type, target_user_id, is_read)
    VALUES (
      'Selesaikan Pembayaran ⏳',
      'Segera pilih metode pembayaran untuk pesanan #' || rec.order_number || '. Batas waktu pembayaran sisa 5 menit lagi.',
      'personal',
      rec.user_id,
      false
    );

    -- 2. Mark reminder as sent
    UPDATE orders
    SET payment_reminder_sent = true
    WHERE id = rec.id;
  END LOOP;

  -- B. Iterate semua order yang sudah expired dan masih awaiting_payment_method
  FOR rec IN
    SELECT id, user_id, order_number
    FROM orders
    WHERE status = 'awaiting_payment_method'
      AND expires_at IS NOT NULL
      AND expires_at <= now()
  LOOP
    -- 1. Restore stock per item
    FOR item IN
      SELECT product_id, quantity
      FROM order_items
      WHERE order_id = rec.id
    LOOP
      IF item.product_id IS NOT NULL AND item.quantity > 0 THEN
        SELECT id, stock_quantity INTO prod
        FROM products
        WHERE id = item.product_id;

        IF FOUND THEN
          UPDATE products
          SET stock_quantity = COALESCE(prod.stock_quantity, 0) + item.quantity
          WHERE id = item.product_id;
        END IF;
      END IF;
    END LOOP;

    -- 2. Cancel order
    UPDATE orders
    SET status         = 'cancelled',
        payment_status = 'failed',
        updated_at     = now()
    WHERE id = rec.id;

    -- 3. Send notification to user
    INSERT INTO notifications (title, body, type, target_user_id, is_read)
    VALUES (
      'Pesanan Dibatalkan ⏳',
      'Batas waktu pemilihan metode pembayaran untuk pesanan #' || rec.order_number || ' telah habis.',
      'personal',
      rec.user_id,
      false
    );

    RAISE LOG 'Order % auto-cancelled due to expiry', rec.id;
  END LOOP;
END;
$$;


-- ─── Step 4: Schedule cron job (setiap menit) ─────────────────────────────────
-- Hapus schedule lama jika ada (idempotent)
SELECT cron.unschedule('cancel-expired-orders')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cancel-expired-orders'
);

SELECT cron.schedule(
  'cancel-expired-orders',             -- nama job
  '* * * * *',                         -- setiap menit
  'SELECT cancel_expired_orders()'     -- SQL yang dijalankan
);


-- ─── Verifikasi ───────────────────────────────────────────────────────────────
-- Cek cron job terdaftar
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'cancel-expired-orders';

-- Test manual function (jalankan terpisah jika mau test)
-- SELECT cancel_expired_orders();
