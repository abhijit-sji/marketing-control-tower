-- Add bearer_token column to activecollab_credentials for comment fetching
ALTER TABLE public.activecollab_credentials
ADD COLUMN IF NOT EXISTS bearer_token TEXT;