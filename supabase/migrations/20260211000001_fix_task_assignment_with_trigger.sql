-- Fix project_tasks UPDATE RLS policy for regular users reassigning tasks.
--
-- PROBLEM: The previous fix used is_task_assigned_to() SECURITY DEFINER function in
-- WITH CHECK to read the old row's assigned_to. However, during an UPDATE, PostgreSQL's
-- MVCC means the SELECT inside that function cannot reliably see the old row while it's
-- being modified within the same statement.
--
-- FIX: Use a BEFORE UPDATE trigger to capture the old assigned_to into a session variable
-- (via set_config). The trigger fires BEFORE the WITH CHECK policy is evaluated, so the
-- session variable is available when the policy runs.

-- 1. Create trigger function to store old assigned_to in a session variable
CREATE OR REPLACE FUNCTION public.store_old_task_assigned_to()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.old_task_assigned_to', COALESCE(OLD.assigned_to::text, ''), true);
  RETURN NEW;
END;
$$;

-- 2. Create the BEFORE UPDATE trigger
DROP TRIGGER IF EXISTS before_update_store_assigned_to ON public.project_tasks;

CREATE TRIGGER before_update_store_assigned_to
BEFORE UPDATE ON public.project_tasks
FOR EACH ROW
EXECUTE FUNCTION public.store_old_task_assigned_to();

-- 3. Recreate the UPDATE policy using the session variable instead of the function
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
  -- The BEFORE UPDATE trigger stores old assigned_to in a session variable.
  OR (
    COALESCE(current_setting('app.old_task_assigned_to', true), '') = auth.uid()::text
  )
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
