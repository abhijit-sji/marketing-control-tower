-- Add actual_hours column to project_tasks
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS actual_hours numeric DEFAULT 0;

-- Populate with dummy data based on status
UPDATE public.project_tasks SET actual_hours = CASE
  WHEN status = 'completed' THEN round((random() * 20 + 4)::numeric, 1)
  WHEN status = 'in_progress' THEN round((random() * 12 + 2)::numeric, 1)
  WHEN status = 'todo' THEN 0
  ELSE round((random() * 8)::numeric, 1)
END;