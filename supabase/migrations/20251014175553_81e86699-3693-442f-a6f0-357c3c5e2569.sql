-- Add foreign key constraint to project_tasks table
-- This enables nested queries in the analytics dashboard

-- First, verify and clean up any orphaned records
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  -- Count orphaned records
  SELECT COUNT(*) INTO orphaned_count
  FROM project_tasks
  WHERE project_id NOT IN (SELECT id FROM projects);
  
  -- Delete any project_tasks with invalid project_id references
  DELETE FROM project_tasks
  WHERE project_id NOT IN (SELECT id FROM projects);
  
  IF orphaned_count > 0 THEN
    RAISE NOTICE 'Cleaned up % orphaned project_tasks records', orphaned_count;
  END IF;
END $$;

-- Add the foreign key constraint
ALTER TABLE project_tasks
ADD CONSTRAINT project_tasks_project_id_fkey
FOREIGN KEY (project_id)
REFERENCES projects(id)
ON DELETE CASCADE;

-- Create an index on project_id for better query performance
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id 
ON project_tasks(project_id);