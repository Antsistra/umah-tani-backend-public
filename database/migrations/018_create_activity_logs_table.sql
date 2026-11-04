-- Activity Logs (ADMIN ONLY - for internal audit trail)
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, -- admin yang melakukan action
  action VARCHAR(100) NOT NULL, -- 'order_shipped', 'order_cancelled', 'shipment_updated', 'refund_processed', etc
  resource_type VARCHAR(50), -- 'order', 'shipment', 'refund'
  resource_id UUID, -- ID dari resource yang diubah
  details JSONB, -- additional info (tracking_number, reason, etc)
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON activity_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
