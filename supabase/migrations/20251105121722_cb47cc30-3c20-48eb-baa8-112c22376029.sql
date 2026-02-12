-- Add ActiveCollab integration columns to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS activecollab_project_id TEXT,
ADD COLUMN IF NOT EXISTS activecollab_sync_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS activecollab_budget NUMERIC,
ADD COLUMN IF NOT EXISTS activecollab_metadata JSONB DEFAULT '{}'::jsonb;

-- Add ActiveCollab integration columns to project_tasks table
ALTER TABLE project_tasks
ADD COLUMN IF NOT EXISTS activecollab_task_id TEXT,
ADD COLUMN IF NOT EXISTS activecollab_sync_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_activecollab_id ON projects(activecollab_project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_activecollab_id ON project_tasks(activecollab_task_id);

-- Create table for ActiveCollab sync logs
CREATE TABLE IF NOT EXISTS activecollab_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  entity_type TEXT NOT NULL,
  entity_count INTEGER DEFAULT 0,
  error_message TEXT,
  triggered_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE activecollab_sync_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for sync logs
CREATE POLICY "Admins can view sync logs"
  ON activecollab_sync_logs
  FOR SELECT
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'pm'::app_role)
  );

CREATE POLICY "Service role can manage sync logs"
  ON activecollab_sync_logs
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role');