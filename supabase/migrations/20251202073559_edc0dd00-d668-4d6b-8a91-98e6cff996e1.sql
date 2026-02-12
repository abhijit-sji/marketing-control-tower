-- Fix search_path for the sync_bearer_token_from_email function
CREATE OR REPLACE FUNCTION public.sync_bearer_token_from_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-set bearer_token to email_base64 if not explicitly provided
  IF NEW.bearer_token IS NULL AND NEW.email_base64 IS NOT NULL THEN
    NEW.bearer_token := NEW.email_base64;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;