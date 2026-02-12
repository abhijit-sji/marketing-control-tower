-- Create organization_integrations table
CREATE TABLE IF NOT EXISTS public.organization_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration TEXT NOT NULL UNIQUE,
  config JSONB DEFAULT '{}'::jsonb,
  connected BOOLEAN DEFAULT false,
  last_checked_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.organization_integrations ENABLE ROW LEVEL SECURITY;

-- Only super_admin can manage organization integrations
CREATE POLICY "Super admins can manage organization integrations"
  ON public.organization_integrations
  FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Add updated_at trigger
CREATE TRIGGER set_organization_integrations_updated_at
  BEFORE UPDATE ON public.organization_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index
CREATE INDEX idx_organization_integrations_integration 
  ON public.organization_integrations(integration);