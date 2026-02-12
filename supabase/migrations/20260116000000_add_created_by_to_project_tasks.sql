-- Add created_by field to project_tasks table to track who created each task
ALTER TABLE public.project_tasks
ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- Create an index for better query performance
CREATE INDEX idx_project_tasks_created_by ON public.project_tasks(created_by);

-- Add a comment to document the field
COMMENT ON COLUMN public.project_tasks.created_by IS 'User ID of the person who created this task';
