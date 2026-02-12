-- Update existing records to set bearer_token from email_base64
UPDATE public.activecollab_credentials
SET bearer_token = email_base64
WHERE bearer_token IS NULL AND email_base64 IS NOT NULL;

-- Create trigger function to auto-populate bearer_token from email_base64
CREATE OR REPLACE FUNCTION public.sync_bearer_token_from_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-set bearer_token to email_base64 if not explicitly provided
  IF NEW.bearer_token IS NULL AND NEW.email_base64 IS NOT NULL THEN
    NEW.bearer_token := NEW.email_base64;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT
DROP TRIGGER IF EXISTS sync_bearer_token_on_insert ON public.activecollab_credentials;
CREATE TRIGGER sync_bearer_token_on_insert
BEFORE INSERT ON public.activecollab_credentials
FOR EACH ROW
EXECUTE FUNCTION public.sync_bearer_token_from_email();

-- Create trigger for UPDATE (when email_base64 changes and bearer_token is null)
DROP TRIGGER IF EXISTS sync_bearer_token_on_update ON public.activecollab_credentials;
CREATE TRIGGER sync_bearer_token_on_update
BEFORE UPDATE ON public.activecollab_credentials
FOR EACH ROW
WHEN (NEW.email_base64 IS DISTINCT FROM OLD.email_base64 AND NEW.bearer_token IS NULL)
EXECUTE FUNCTION public.sync_bearer_token_from_email();