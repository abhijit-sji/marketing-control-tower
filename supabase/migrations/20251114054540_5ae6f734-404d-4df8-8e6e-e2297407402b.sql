-- Create a function to get projects with task and comment counts
CREATE OR REPLACE FUNCTION public.get_projects_with_sync_counts()
RETURNS TABLE (
  id UUID,
  name TEXT,
  activecollab_project_id TEXT,
  activecollab_sync_at TIMESTAMPTZ,
  task_count BIGINT,
  comment_count BIGINT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT 
    p.id,
    p.name,
    p.activecollab_project_id,
    p.activecollab_sync_at,
    COUNT(DISTINCT pt.id) as task_count,
    COUNT(DISTINCT ptc.id) as comment_count
  FROM projects p
  LEFT JOIN project_tasks pt ON pt.project_id = p.id
  LEFT JOIN project_task_comments ptc ON ptc.task_id = pt.id
  WHERE p.activecollab_project_id IS NOT NULL
  GROUP BY p.id, p.name, p.activecollab_project_id, p.activecollab_sync_at
  ORDER BY p.name;
$$;