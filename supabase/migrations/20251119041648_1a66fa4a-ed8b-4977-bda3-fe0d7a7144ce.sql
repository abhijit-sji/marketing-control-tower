-- Create newsletter_sources table
CREATE TABLE IF NOT EXISTS public.newsletter_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  feed_url TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.newsletter_sources ENABLE ROW LEVEL SECURITY;

-- Create policies for newsletter_sources
-- Super admins can do everything
CREATE POLICY "Super admins have full access to newsletter sources"
  ON public.newsletter_sources
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'::app_role
    )
  );

-- All authenticated users can view active sources
CREATE POLICY "Authenticated users can view active newsletter sources"
  ON public.newsletter_sources
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND is_active = true
  );

-- Create updated_at trigger
CREATE TRIGGER update_newsletter_sources_updated_at
  BEFORE UPDATE ON public.newsletter_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();