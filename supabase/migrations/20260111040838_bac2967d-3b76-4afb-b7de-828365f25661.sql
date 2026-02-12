-- Add client_id column to project_tasks table
ALTER TABLE public.project_tasks 
ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Make project_id optional (currently required)
ALTER TABLE public.project_tasks 
ALTER COLUMN project_id DROP NOT NULL;

-- Add index for client_id for better query performance
CREATE INDEX idx_project_tasks_client_id ON public.project_tasks(client_id);

-- Add RLS policy for client-based access (users can see tasks for clients they have access to)
CREATE POLICY "Users can view tasks for accessible clients"
ON public.project_tasks
FOR SELECT
USING (
  client_id IS NULL 
  OR user_has_client_access(auth.uid(), client_id)
  OR project_id IS NOT NULL
);