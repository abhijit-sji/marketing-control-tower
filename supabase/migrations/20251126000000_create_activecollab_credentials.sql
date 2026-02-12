-- Create table for ActiveCollab credentials
-- This table stores ActiveCollab API credentials for super admins only
-- Email is stored as base64 encoded for basic obfuscation

CREATE TABLE IF NOT EXISTS public.activecollab_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_base64 TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  api_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activecollab_credentials ENABLE ROW LEVEL SECURITY;

-- Create policies - only super admins can access
CREATE POLICY "Super admins can view activecollab credentials"
  ON public.activecollab_credentials
  FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can insert activecollab credentials"
  ON public.activecollab_credentials
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update activecollab credentials"
  ON public.activecollab_credentials
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete activecollab credentials"
  ON public.activecollab_credentials
  FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_activecollab_credentials_active
  ON public.activecollab_credentials(is_active);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_activecollab_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_activecollab_credentials_updated_at
  BEFORE UPDATE ON public.activecollab_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_activecollab_credentials_updated_at();

-- Add comment to table
COMMENT ON TABLE public.activecollab_credentials IS 'Stores ActiveCollab API credentials. Only accessible by super admins. Email is base64 encoded.';
