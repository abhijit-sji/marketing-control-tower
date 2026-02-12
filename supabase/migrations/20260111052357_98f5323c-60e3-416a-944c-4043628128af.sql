-- Fix project_tasks RLS policies to support tasks without project_id
-- Now that project_id is optional, we need to allow INSERT/UPDATE based on brand_id or client_id

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can create project tasks" ON public.project_tasks;

-- Create new INSERT policy that allows:
-- 1. Super admins and managers (any task)
-- 2. Users with project access (via project_id)
-- 3. Users with brand access (via brand_id)
-- 4. Users with client access (via client_id)
CREATE POLICY "Users can create project tasks"
ON public.project_tasks
FOR INSERT
TO authenticated
WITH CHECK (
  -- Super admins and managers can create any task
  has_role(auth.uid(), 'super_admin') 
  OR has_role(auth.uid(), 'manager')
  -- Project team members can create tasks for their projects
  OR (
    project_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_tasks.project_id
        AND (p.project_manager = auth.uid() OR auth.uid() = ANY(p.assigned_team))
    )
  )
  -- Users with brand access can create tasks for that brand
  OR (
    brand_id IS NOT NULL 
    AND user_has_brand_access(auth.uid(), brand_id)
  )
  -- Users with client access can create tasks for that client
  OR (
    client_id IS NOT NULL 
    AND user_has_client_access(auth.uid(), client_id)
  )
);

-- Drop and recreate UPDATE policy with same logic
DROP POLICY IF EXISTS "Users can update project tasks" ON public.project_tasks;

CREATE POLICY "Users can update project tasks"
ON public.project_tasks
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin')
  OR has_role(auth.uid(), 'manager')
  OR assigned_to = auth.uid()
  OR (
    project_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_tasks.project_id
        AND (p.project_manager = auth.uid() OR auth.uid() = ANY(p.assigned_team))
    )
  )
  OR (
    brand_id IS NOT NULL 
    AND user_has_brand_access(auth.uid(), brand_id)
  )
  OR (
    client_id IS NOT NULL 
    AND user_has_client_access(auth.uid(), client_id)
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin')
  OR has_role(auth.uid(), 'manager')
  OR assigned_to = auth.uid()
  OR (
    project_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_tasks.project_id
        AND (p.project_manager = auth.uid() OR auth.uid() = ANY(p.assigned_team))
    )
  )
  OR (
    brand_id IS NOT NULL 
    AND user_has_brand_access(auth.uid(), brand_id)
  )
  OR (
    client_id IS NOT NULL 
    AND user_has_client_access(auth.uid(), client_id)
  )
);

-- Consolidate SELECT policies - drop the redundant one and update main one
DROP POLICY IF EXISTS "Users can view tasks for accessible clients" ON public.project_tasks;

-- Keep the comprehensive SELECT policy (already exists and works)
-- "Users can view project tasks" already covers all cases