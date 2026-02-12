-- Add RLS policy for team members to view task comments
CREATE POLICY "Users can view comments for accessible tasks" 
ON project_task_comments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM project_tasks pt
    LEFT JOIN projects p ON p.id = pt.project_id
    WHERE pt.id = project_task_comments.task_id
      AND (
        pt.assigned_to = auth.uid()
        OR p.project_manager = auth.uid() 
        OR auth.uid() = ANY(p.assigned_team)
        OR has_role(auth.uid(), 'super_admin'::app_role)
        OR has_role(auth.uid(), 'manager'::app_role)
        OR has_role(auth.uid(), 'pm'::app_role)
      )
  )
);