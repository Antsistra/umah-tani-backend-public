-- Add proof of delivery column to order_shipments table
-- This column stores the URL/link to the delivery proof image
ALTER TABLE order_shipments
ADD COLUMN IF NOT EXISTS proof_of_delivery_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN order_shipments.proof_of_delivery_url IS 'URL link to the proof of delivery image';
