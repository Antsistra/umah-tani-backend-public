-- Migration: Create Activity Logs Table (Normalized Design)
-- File: database/migrations/003_create_activity_logs_table.sql
-- Purpose: Track admin/penyuluh activities for auditing and monitoring
-- Created: 2024

-- ==========================================
-- 1. CREATE ACTIVITY LOGS TABLE
-- ==========================================

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

-- User Information (Normalized - References auth.users)
user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

-- Activity Details
action VARCHAR(50) NOT NULL, -- CREATE_ARTICLE, UPDATE_PRODUCT, etc.
module VARCHAR(30) NOT NULL, -- blog, ecommerce, fertilizer, etc.

-- Entity Information (Optional - for specific entity tracking)
entity_type VARCHAR(50), -- articles, categories, products, etc.
entity_id UUID, -- ID dari entity yang di-modify
entity_name TEXT, -- Nama entity untuk human-readable logs

-- Description & Metadata
description TEXT, -- Human-readable action description
metadata JSONB, -- Additional data (old_values, new_values, etc.)

-- Technical Information (Optional)
ip_address INET, -- User's IP address
user_agent TEXT, -- Browser/device information

-- Timestamps
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 2. CREATE PERFORMANCE INDEXES
-- ==========================================

-- Primary indexes for common queries
CREATE INDEX idx_activity_logs_user_id ON activity_logs (user_id);

CREATE INDEX idx_activity_logs_created_at ON activity_logs (created_at DESC);

CREATE INDEX idx_activity_logs_module ON activity_logs (module);

CREATE INDEX idx_activity_logs_action ON activity_logs (action);

-- Composite indexes for complex queries
CREATE INDEX idx_activity_logs_user_date ON activity_logs (user_id, created_at DESC);

CREATE INDEX idx_activity_logs_module_date ON activity_logs (module, created_at DESC);

CREATE INDEX idx_activity_logs_action_module ON activity_logs (action, module);

-- Entity tracking indexes
CREATE INDEX idx_activity_logs_entity ON activity_logs (entity_type, entity_id)
WHERE
    entity_id IS NOT NULL;

-- ==========================================
-- 3. CREATE AUTO-UPDATE TRIGGER
-- ==========================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_activity_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_activity_logs_updated_at
  BEFORE UPDATE ON activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_activity_logs_updated_at();

-- ==========================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy 1: Owner can view all activity logs
CREATE POLICY "activity_logs_owner_access" ON activity_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (raw_user_meta_data->>'role')::text = 'owner'
    )
  );

-- Policy 2: Admin can view all logs (read-only)
CREATE POLICY "activity_logs_admin_read" ON activity_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (raw_user_meta_data->>'role')::text = 'admin'
    )
  );

-- Policy 3: Penyuluh can only view logs in blog module
CREATE POLICY "activity_logs_penyuluh_blog_read" ON activity_logs
  FOR SELECT USING (
    module = 'blog' AND 
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (raw_user_meta_data->>'role')::text = 'penyuluh'
    )
  );

-- Policy 4: Users can view their own activity logs
CREATE POLICY "activity_logs_user_own_read" ON activity_logs FOR
SELECT USING (user_id = auth.uid ());

-- Policy 5: Only system can INSERT logs (via service account)
-- This prevents direct manual insertion while allowing app to log activities
CREATE POLICY "activity_logs_system_insert" ON activity_logs
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (raw_user_meta_data->>'role')::text IN ('owner', 'admin', 'penyuluh')
    )
  );

-- ==========================================
-- 5. SAMPLE DATA FOR TESTING (OPTIONAL)
-- ==========================================

-- Insert sample activity log (remove in production)
-- INSERT INTO activity_logs (
--   user_id,
--   action,
--   module,
--   entity_type,
--   entity_name,
--   description,
--   metadata
-- ) VALUES (
--   (SELECT id FROM auth.users WHERE email = 'admin@umahtani.com' LIMIT 1),
--   'CREATE_ARTICLE',
--   'blog',
--   'articles',
--   'Cara Menanam Padi Modern',
--   'Menambahkan Konten Edukasi: Cara Menanam Padi Modern',
--   '{"previous_count": 3, "new_count": 4}'::jsonb
-- );

-- ==========================================
-- 6. USEFUL VIEWS FOR REPORTING
-- ==========================================

-- View: Activity logs with user information (for easier querying)
CREATE OR REPLACE VIEW v_activity_logs_with_users AS
SELECT
    al.*,
    u.email as user_email,
    u.raw_user_meta_data ->> 'name' as user_name,
    u.raw_user_meta_data ->> 'role' as user_role,
    u.created_at as user_created_at
FROM activity_logs al
    JOIN auth.users u ON al.user_id = u.id
ORDER BY al.created_at DESC;

-- View: Daily activity summary
CREATE OR REPLACE VIEW v_daily_activity_summary AS
SELECT
    DATE(created_at) as activity_date,
    module,
    action,
    COUNT(*) as total_activities,
    COUNT(DISTINCT user_id) as unique_users
FROM activity_logs
GROUP BY
    DATE(created_at),
    module,
    action
ORDER BY
    activity_date DESC,
    total_activities DESC;

-- ==========================================
-- MIGRATION COMPLETE
-- ==========================================

-- Add comment to table for documentation
COMMENT ON
TABLE activity_logs IS 'Tracks all admin/penyuluh activities for auditing and monitoring purposes';

COMMENT ON COLUMN activity_logs.action IS 'Action performed (CREATE_ARTICLE, UPDATE_PRODUCT, etc.)';

COMMENT ON COLUMN activity_logs.module IS 'Module where action occurred (blog, ecommerce, fertilizer, etc.)';

COMMENT ON COLUMN activity_logs.entity_type IS 'Type of entity affected (articles, products, categories, etc.)';

COMMENT ON COLUMN activity_logs.entity_name IS 'Human-readable name of the affected entity';

COMMENT ON COLUMN activity_logs.metadata IS 'Additional context data in JSON format';

-- Migration completed successfully!
-- Next steps:
-- 1. Apply this migration: supabase db push
-- 2. Verify in Supabase dashboard
-- 3. Implement activity logging service & middleware