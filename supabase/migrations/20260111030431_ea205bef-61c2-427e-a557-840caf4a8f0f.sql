-- Add category and brand_id columns to project_tasks table
ALTER TABLE public.project_tasks 
ADD COLUMN IF NOT EXISTS category text DEFAULT 'general',
ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_project_tasks_category ON public.project_tasks(category);
CREATE INDEX IF NOT EXISTS idx_project_tasks_brand_id ON public.project_tasks(brand_id);

-- Add RLS policy for brand-based access (users with brand access can view related tasks)
CREATE POLICY "Users can view tasks for their brands" 
ON public.project_tasks 
FOR SELECT 
USING (
  brand_id IS NULL 
  OR public.user_has_brand_access(auth.uid(), brand_id)
);