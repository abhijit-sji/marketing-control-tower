-- Add activecollab timestamp columns to project_tasks
ALTER TABLE project_tasks 
ADD COLUMN IF NOT EXISTS activecollab_created_on timestamp with time zone,
ADD COLUMN IF NOT EXISTS activecollab_updated_on timestamp with time zone;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_project_tasks_activecollab_created_on 
ON project_tasks(activecollab_created_on);

COMMENT ON COLUMN project_tasks.activecollab_created_on IS 'Original creation timestamp from ActiveCollab API';
COMMENT ON COLUMN project_tasks.activecollab_updated_on IS 'Last update timestamp from ActiveCollab API';