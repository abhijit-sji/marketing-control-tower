-- Add column comments to document Base64-encoded JSON format
COMMENT ON COLUMN public.activecollab_credentials.email_base64 IS 'Base64-encoded JSON containing user email (e.g., {"user_email": "email@domain.com"})';
COMMENT ON COLUMN public.activecollab_credentials.bearer_token IS 'Base64-encoded JSON token for API authentication, auto-synced from email_base64';