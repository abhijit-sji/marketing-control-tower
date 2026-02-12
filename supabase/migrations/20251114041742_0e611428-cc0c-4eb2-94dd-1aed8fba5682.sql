-- Create table for storing ActiveCollab task comments
CREATE TABLE IF NOT EXISTS project_task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  activecollab_comment_id TEXT NOT NULL,
  comment_body TEXT,
  created_by_name TEXT,
  created_by_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(activecollab_comment_id)
);

-- Add RLS policies for project_task_comments
ALTER TABLE project_task_comments ENABLE ROW LEVEL SECURITY;

-- Managers and super admins can view all comments
CREATE POLICY "Managers can view all task comments"
  ON project_task_comments
  FOR SELECT
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    OR has_role(auth.uid(), 'manager'::app_role) 
    OR has_role(auth.uid(), 'pm'::app_role)
  );

-- Service role can manage comments (for sync operations)
CREATE POLICY "Service role can manage task comments"
  ON project_task_comments
  FOR ALL
  USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Add activecollab_sync_at column to projects table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'activecollab_sync_at'
  ) THEN
    ALTER TABLE projects ADD COLUMN activecollab_sync_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create index for faster comment lookups
CREATE INDEX IF NOT EXISTS idx_project_task_comments_task_id ON project_task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_project_task_comments_activecollab_id ON project_task_comments(activecollab_comment_id);