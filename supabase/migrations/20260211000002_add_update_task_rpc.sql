-- Create a SECURITY DEFINER RPC function for updating project tasks.
--
-- PROBLEM: The WITH CHECK RLS policy cannot reliably access the OLD row's assigned_to
-- during an UPDATE. Neither SECURITY DEFINER helper functions nor BEFORE UPDATE triggers
-- solve this because PostgreSQL evaluates WITH CHECK against the NEW row, and the old
-- row is not visible via SELECT during the same statement.
--
-- FIX: Use an RPC function with SECURITY DEFINER that bypasses RLS entirely but
-- performs its own authorization checks using the OLD row values directly.

-- Clean up previous trigger-based attempt
DROP TRIGGER IF EXISTS before_update_store_assigned_to ON public.project_tasks;
DROP FUNCTION IF EXISTS public.store_old_task_assigned_to();

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
BEGIN
  -- Fetch the existing task (bypasses RLS due to SECURITY DEFINER)
  SELECT * INTO v_task FROM project_tasks WHERE id = p_task_id;

  IF v_task IS NULL THEN
    RAISE EXCEPTION 'Task not found' USING ERRCODE = 'P0002';
  END IF;

  -- Permission check: mirrors the USING clause of the RLS policy
  -- Super admin, manager, or PM
  IF has_role(v_user_id, 'super_admin')
     OR has_role(v_user_id, 'manager')
     OR has_role(v_user_id, 'pm') THEN
    v_has_permission := TRUE;
  END IF;

  -- Currently assigned to the user
  IF NOT v_has_permission AND v_task.assigned_to = v_user_id THEN
    v_has_permission := TRUE;
  END IF;

  -- Created by the user
  IF NOT v_has_permission AND v_task.created_by = v_user_id THEN
    v_has_permission := TRUE;
  END IF;

  -- Project team member
  IF NOT v_has_permission AND v_task.project_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = v_task.project_id
        AND (p.project_manager = v_user_id OR v_user_id = ANY(p.assigned_team))
    ) THEN
      v_has_permission := TRUE;
    END IF;
  END IF;

  -- Brand access
  IF NOT v_has_permission AND v_task.brand_id IS NOT NULL THEN
    IF user_has_brand_access(v_user_id, v_task.brand_id) THEN
      v_has_permission := TRUE;
    END IF;
  END IF;

  -- Client access
  IF NOT v_has_permission AND v_task.client_id IS NOT NULL THEN
    IF user_has_client_access(v_user_id, v_task.client_id) THEN
      v_has_permission := TRUE;
    END IF;
  END IF;

  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  -- Perform the update with only the provided fields
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
    assigned_to = CASE
      WHEN p_updates ? 'assigned_to' THEN (p_updates->>'assigned_to')::UUID
      ELSE assigned_to
    END,
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
    END
  WHERE id = p_task_id
  RETURNING to_jsonb(project_tasks.*) INTO v_result;

  RETURN v_result;
END;
$$;
