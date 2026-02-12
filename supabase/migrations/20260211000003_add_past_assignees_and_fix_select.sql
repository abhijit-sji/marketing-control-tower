-- Add past_assignees column and fix SELECT policy so users who were previously
-- assigned to a task can still view it after reassigning.

-- 1. Add past_assignees array column
ALTER TABLE public.project_tasks
ADD COLUMN IF NOT EXISTS past_assignees UUID[] DEFAULT '{}';

-- 2. Update the SELECT policy to include past_assignees and add missing role checks
DROP POLICY IF EXISTS "Users can view project tasks" ON public.project_tasks;

CREATE POLICY "Users can view project tasks"
ON public.project_tasks
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin')
  OR has_role(auth.uid(), 'manager')
  OR has_role(auth.uid(), 'pm')
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
  -- Previously assigned users can still view the task
  OR auth.uid() = ANY(past_assignees)
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

-- 3. Update the RPC function to track past assignees when reassigning
CREATE OR REPLACE FUNCTION public.update_project_task(
  p_task_id UUID,
  p_updates JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_task RECORD;
  v_result JSONB;
  v_has_permission BOOLEAN := FALSE;
  v_new_assigned_to UUID;
BEGIN
  -- Fetch the existing task (bypasses RLS due to SECURITY DEFINER)
  SELECT * INTO v_task FROM project_tasks WHERE id = p_task_id;

  IF v_task IS NULL THEN
    RAISE EXCEPTION 'Task not found' USING ERRCODE = 'P0002';
  END IF;

  -- Permission check: mirrors the USING clause of the RLS policy
  IF has_role(v_user_id, 'super_admin')
     OR has_role(v_user_id, 'manager')
     OR has_role(v_user_id, 'pm') THEN
    v_has_permission := TRUE;
  END IF;

  IF NOT v_has_permission AND v_task.assigned_to = v_user_id THEN
    v_has_permission := TRUE;
  END IF;

  IF NOT v_has_permission AND v_task.created_by = v_user_id THEN
    v_has_permission := TRUE;
  END IF;

  IF NOT v_has_permission AND v_task.project_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = v_task.project_id
        AND (p.project_manager = v_user_id OR v_user_id = ANY(p.assigned_team))
    ) THEN
      v_has_permission := TRUE;
    END IF;
  END IF;

  IF NOT v_has_permission AND v_task.brand_id IS NOT NULL THEN
    IF user_has_brand_access(v_user_id, v_task.brand_id) THEN
      v_has_permission := TRUE;
    END IF;
  END IF;

  IF NOT v_has_permission AND v_task.client_id IS NOT NULL THEN
    IF user_has_client_access(v_user_id, v_task.client_id) THEN
      v_has_permission := TRUE;
    END IF;
  END IF;

  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  -- Track past assignees: if assigned_to is changing, add old assignee to past_assignees
  v_new_assigned_to := CASE
    WHEN p_updates ? 'assigned_to' THEN (p_updates->>'assigned_to')::UUID
    ELSE v_task.assigned_to
  END;

  -- Perform the update
  UPDATE project_tasks SET
    title = COALESCE(p_updates->>'title', title),
    description = COALESCE(p_updates->>'description', description),
    status = COALESCE(p_updates->>'status', status),
    priority = COALESCE(p_updates->>'priority', priority),
    category = COALESCE(p_updates->>'category', category),
    brand_id = CASE
      WHEN p_updates ? 'brand_id' THEN (p_updates->>'brand_id')::UUID
      ELSE brand_id
    END,
    client_id = CASE
      WHEN p_updates ? 'client_id' THEN (p_updates->>'client_id')::UUID
      ELSE client_id
    END,
    assigned_to = v_new_assigned_to,
    estimated_hours = CASE
      WHEN p_updates ? 'estimated_hours' THEN (p_updates->>'estimated_hours')::NUMERIC
      ELSE estimated_hours
    END,
    actual_hours = CASE
      WHEN p_updates ? 'actual_hours' THEN (p_updates->>'actual_hours')::NUMERIC
      ELSE actual_hours
    END,
    due_date = CASE
      WHEN p_updates ? 'due_date' THEN (p_updates->>'due_date')::TIMESTAMPTZ
      ELSE due_date
    END,
    completed_at = CASE
      WHEN p_updates ? 'completed_at' THEN (p_updates->>'completed_at')::TIMESTAMPTZ
      ELSE completed_at
    END,
    -- Add old assignee to past_assignees if assigned_to is changing
    past_assignees = CASE
      WHEN p_updates ? 'assigned_to'
           AND v_task.assigned_to IS NOT NULL
           AND v_task.assigned_to IS DISTINCT FROM v_new_assigned_to
           AND NOT (v_task.assigned_to = ANY(COALESCE(past_assignees, '{}')))
      THEN array_append(COALESCE(past_assignees, '{}'), v_task.assigned_to)
      ELSE COALESCE(past_assignees, '{}')
    END
  WHERE id = p_task_id
  RETURNING to_jsonb(project_tasks.*) INTO v_result;

  RETURN v_result;
END;
$$;
