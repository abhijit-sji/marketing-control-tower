-- Add columns for direct Google Analytics integration
ALTER TABLE brand_analytics_integrations
  ADD COLUMN IF NOT EXISTS ga4_property_id TEXT,
  ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS service_account_email TEXT,
  ADD COLUMN IF NOT EXISTS service_account_key_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS metrics_config JSONB DEFAULT '{"sessions": true, "users": true, "pageviews": true, "conversions": true}'::jsonb;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_brand_analytics_ga4_property 
  ON brand_analytics_integrations(ga4_property_id) 
  WHERE ga4_property_id IS NOT NULL;