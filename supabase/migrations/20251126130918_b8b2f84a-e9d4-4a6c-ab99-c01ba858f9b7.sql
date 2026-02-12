-- Create activecollab_credentials table
CREATE TABLE IF NOT EXISTS public.activecollab_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_base64 text NOT NULL,
  password_encrypted text NOT NULL,
  api_url text NOT NULL,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activecollab_credentials ENABLE ROW LEVEL SECURITY;

-- Only super admins can access credentials
CREATE POLICY "Super admins can manage ActiveCollab credentials"
  ON public.activecollab_credentials
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'::app_role
    )
  );

-- Update trigger
CREATE TRIGGER update_activecollab_credentials_updated_at
  BEFORE UPDATE ON public.activecollab_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();