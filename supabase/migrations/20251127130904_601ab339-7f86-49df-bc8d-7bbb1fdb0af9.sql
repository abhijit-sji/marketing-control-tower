-- Add soft delete support to project_task_comments
ALTER TABLE project_task_comments 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add index for querying active comments
CREATE INDEX IF NOT EXISTS idx_project_task_comments_is_deleted 
ON project_task_comments(task_id, is_deleted) 
WHERE is_deleted = false;