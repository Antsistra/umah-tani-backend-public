-- Add Biteship-related address fields
ALTER TABLE user_addresses
  ADD COLUMN IF NOT EXISTS subdistrict VARCHAR(100),
  ADD COLUMN IF NOT EXISTS village VARCHAR(100),
  ADD COLUMN IF NOT EXISTS biteship_area_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS biteship_location_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) DEFAULT 'ID';

-- Optional indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_addresses_biteship_area_id ON user_addresses(biteship_area_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_biteship_location_id ON user_addresses(biteship_location_id);
