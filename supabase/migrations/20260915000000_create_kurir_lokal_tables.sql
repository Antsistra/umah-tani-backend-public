-- Kurir Lokal Umah Tani Agriculture
-- Migration to add coordinates to user_addresses and create local delivery tables

ALTER TABLE user_addresses 
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

COMMENT ON COLUMN user_addresses.latitude IS 'Latitude koordinat alamat untuk pengiriman kurir lokal';
COMMENT ON COLUMN user_addresses.longitude IS 'Longitude koordinat alamat untuk pengiriman kurir lokal';

CREATE TABLE IF NOT EXISTS local_delivery_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active BOOLEAN DEFAULT true,
  delivery_fee INTEGER NOT NULL DEFAULT 10000,
  max_radius_km DOUBLE PRECISION DEFAULT 10.0,
  origin_latitude DOUBLE PRECISION NOT NULL DEFAULT -6.194032,
  origin_longitude DOUBLE PRECISION NOT NULL DEFAULT 106.208621,
  origin_label TEXT DEFAULT 'Umah Tani Agriculture',
  delivery_slots JSONB NOT NULL DEFAULT '[
    {"id": "pagi", "label": "Pagi (09:00 - 10:00)", "start": "09:00", "end": "10:00"},
    {"id": "siang", "label": "Siang (13:00 - 15:00)", "start": "13:00", "end": "15:00"}
  ]'::jsonb,
  cutoff_minutes INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO local_delivery_config (is_active, delivery_fee, max_radius_km, origin_latitude, origin_longitude, origin_label, delivery_slots, cutoff_minutes)
SELECT true, 10000, 10.0, -6.194032, 106.208621, 'Umah Tani Agriculture', '[{"id": "pagi", "label": "Pagi (09:00 - 10:00)", "start": "09:00", "end": "10:00"}, {"id": "siang", "label": "Siang (13:00 - 15:00)", "start": "13:00", "end": "15:00"}]'::jsonb, 60
WHERE NOT EXISTS (SELECT 1 FROM local_delivery_config);

CREATE TABLE IF NOT EXISTS local_delivery_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  delivery_slot_id TEXT NOT NULL,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  destination_latitude DOUBLE PRECISION NOT NULL,
  destination_longitude DOUBLE PRECISION NOT NULL,
  distance_km DOUBLE PRECISION,
  recipient_name TEXT,
  recipient_phone TEXT,
  recipient_address TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'picked_up', 'on_the_way', 'delivered', 'failed')),
  notes TEXT,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_local_delivery_date_slot ON local_delivery_orders (delivery_date, delivery_slot_id);
CREATE INDEX IF NOT EXISTS idx_local_delivery_order_id ON local_delivery_orders (order_id);
