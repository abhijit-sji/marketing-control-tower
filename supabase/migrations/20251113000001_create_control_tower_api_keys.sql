-- ================================================
-- Control Tower API Integration
-- Database Migration for API Keys Table
-- ================================================

-- Create control_tower_api_keys table
CREATE TABLE IF NOT EXISTS control_tower_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name text NOT NULL,
  api_key_encrypted text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  rate_limit_per_hour integer DEFAULT 1000,
  CONSTRAINT unique_key_name UNIQUE (key_name)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_control_tower_api_keys_active
  ON control_tower_api_keys(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE control_tower_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only managers and super_admins can view API keys
CREATE POLICY "Admins can view API keys"
ON control_tower_api_keys FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'manager')
  )
);

-- RLS Policy: Only super_admins can insert API keys
CREATE POLICY "Super admins can insert API keys"
ON control_tower_api_keys FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

-- RLS Policy: Only super_admins can update API keys
CREATE POLICY "Super admins can update API keys"
ON control_tower_api_keys FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

-- RLS Policy: Only super_admins can delete API keys
CREATE POLICY "Super admins can delete API keys"
ON control_tower_api_keys FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_control_tower_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_control_tower_api_keys_updated_at
  BEFORE UPDATE ON control_tower_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_control_tower_api_keys_updated_at();

-- Add comment to table
COMMENT ON TABLE control_tower_api_keys IS 'Stores API keys for SJ Control Tower API integration';
COMMENT ON COLUMN control_tower_api_keys.api_key_encrypted IS 'Encrypted API key for Control Tower API';
COMMENT ON COLUMN control_tower_api_keys.scopes IS 'Array of API scopes/permissions (e.g., employees:read:full, pods:read)';
COMMENT ON COLUMN control_tower_api_keys.rate_limit_per_hour IS 'Rate limit for API calls per hour';
