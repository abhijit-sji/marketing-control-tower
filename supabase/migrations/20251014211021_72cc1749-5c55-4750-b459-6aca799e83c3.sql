-- Make webhook_secret nullable since it's not used in the simplified GA integration
ALTER TABLE brand_analytics_integrations 
ALTER COLUMN webhook_secret DROP NOT NULL;