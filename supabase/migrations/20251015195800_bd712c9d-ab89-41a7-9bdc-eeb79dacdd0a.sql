-- Create n8n workflow configurations table
CREATE TABLE IF NOT EXISTS public.n8n_workflow_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name text NOT NULL,
  workflow_slug text NOT NULL UNIQUE,
  base_url text NOT NULL,
  is_enabled boolean DEFAULT false,
  api_key_encrypted text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.n8n_workflow_configs ENABLE ROW LEVEL SECURITY;

-- Admins and managers can manage n8n workflows
CREATE POLICY "Admins and managers can manage n8n workflows"
  ON public.n8n_workflow_configs
  FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

-- Trigger for updated_at
CREATE TRIGGER update_n8n_workflow_configs_updated_at
  BEFORE UPDATE ON public.n8n_workflow_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();