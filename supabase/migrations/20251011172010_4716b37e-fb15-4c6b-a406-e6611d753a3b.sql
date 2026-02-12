-- Create integration_logs table for storing API test results and usage
CREATE TABLE IF NOT EXISTS public.integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_type TEXT NOT NULL,
  action TEXT NOT NULL,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_data JSONB,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  execution_time_ms INTEGER,
  error_message TEXT,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_integration_logs_type ON public.integration_logs(integration_type);
CREATE INDEX IF NOT EXISTS idx_integration_logs_performed_by ON public.integration_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created_at ON public.integration_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

-- Allow super_admin and manager to view logs
CREATE POLICY "Admins and managers can view integration logs"
ON public.integration_logs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin') OR 
  public.has_role(auth.uid(), 'manager')
);

-- Allow service role to insert logs (for edge functions)
CREATE POLICY "Service role can insert logs"
ON public.integration_logs
FOR INSERT
TO authenticated
WITH CHECK (true);