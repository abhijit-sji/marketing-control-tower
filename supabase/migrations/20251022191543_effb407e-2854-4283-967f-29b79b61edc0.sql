-- Add index for brand_analytics_integrations by brand_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_brand_analytics_integrations_brand_id 
ON brand_analytics_integrations(brand_id);

-- Enforce one google_analytics integration per brand
CREATE UNIQUE INDEX IF NOT EXISTS uniq_brand_google_analytics
ON brand_analytics_integrations(brand_id)
WHERE integration_type = 'google_analytics';

-- Add helpful comment
COMMENT ON INDEX uniq_brand_google_analytics IS 'Ensures each brand can only have one google_analytics integration type. Multiple legacy types (ga4, n8n_analytics) may still exist but new configs use google_analytics.';