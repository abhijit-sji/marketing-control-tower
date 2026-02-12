-- Add bearer_token column to activecollab_credentials table
-- This token is used specifically for fetching task comments from ActiveCollab
-- While Basic Auth (email + password) is still used for projects and tasks

ALTER TABLE public.activecollab_credentials
ADD COLUMN IF NOT EXISTS bearer_token TEXT;

-- Add comment to clarify the purpose of each auth field
COMMENT ON COLUMN public.activecollab_credentials.email_base64 IS 'Base64 encoded email address used as username for Basic Auth (projects/tasks)';
COMMENT ON COLUMN public.activecollab_credentials.password_encrypted IS 'Encrypted password used for Basic Auth (projects/tasks)';
COMMENT ON COLUMN public.activecollab_credentials.bearer_token IS 'Bearer token used for fetching task comments';

