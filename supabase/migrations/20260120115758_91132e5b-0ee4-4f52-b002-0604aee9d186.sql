-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can create project tasks" ON project_tasks;

-- Create updated INSERT policy that allows any authenticated user to create tasks
CREATE POLICY "Users can create project tasks"
ON project_tasks
FOR INSERT
WITH CHECK (
  -- Admins and managers can create any task
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
  -- Any authenticated user can create tasks where they are the creator
  OR (auth.uid() IS NOT NULL AND (created_by IS NULL OR created_by = auth.uid()))
  -- Project-based access
  OR ((project_id IS NOT NULL) AND EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = project_tasks.project_id 
    AND (p.project_manager = auth.uid() OR auth.uid() = ANY(p.assigned_team))
  ))
  -- Brand-based access
  OR ((brand_id IS NOT NULL) AND user_has_brand_access(auth.uid(), brand_id))
  -- Client-based access
  OR ((client_id IS NOT NULL) AND user_has_client_access(auth.uid(), client_id))
);