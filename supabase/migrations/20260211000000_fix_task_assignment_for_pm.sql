-- Fix project_tasks UPDATE RLS policy to allow all users to assign tasks to others.
--
-- PROBLEM: The WITH CHECK clause used `assigned_to = auth.uid()` which checks the NEW
-- row value after update. This means non-admin users could only set assigned_to to
-- themselves (self-assign), not to other team members.
--
-- FIX: Create a SECURITY DEFINER helper function to check the old row's assigned_to
-- without triggering RLS recursion, then use it in WITH CHECK.

-- Helper function to check if a user is currently assigned to a task.
-- Uses SECURITY DEFINER to bypass RLS and avoid infinite recursion.
CREATE OR REPLACE FUNCTION public.is_task_assigned_to(task_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_tasks
    WHERE id = task_id AND assigned_to = user_id
  );
$$;

DROP POLICY IF EXISTS "Users can update project tasks" ON public.project_tasks;

CREATE POLICY "Users can update project tasks"
ON public.project_tasks
FOR UPDATE
TO authenticated
USING (
  -- Who can update this task (checked against existing/old row):
  has_role(auth.uid(), 'super_admin')
  OR has_role(auth.uid(), 'manager')
  OR has_role(auth.uid(), 'pm')
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
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
  -- What values are allowed in the updated row (checked against new row):
  has_role(auth.uid(), 'super_admin')
  OR has_role(auth.uid(), 'manager')
  OR has_role(auth.uid(), 'pm')
  OR created_by = auth.uid()
  -- Check if the user was assigned to the task BEFORE the update.
  -- Uses a SECURITY DEFINER function to read the old row without RLS recursion.
  OR is_task_assigned_to(project_tasks.id, auth.uid())
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
