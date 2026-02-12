-- Migration: Add category and brand_id to project_tasks table
-- This enables task categorization and brand association

-- Add category column with predefined options
ALTER TABLE project_tasks
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';

-- Add brand_id column with foreign key to brands table
ALTER TABLE project_tasks
ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

-- Create index for brand_id for faster queries
CREATE INDEX IF NOT EXISTS idx_project_tasks_brand_id ON project_tasks(brand_id);

-- Create index for category for faster filtering
CREATE INDEX IF NOT EXISTS idx_project_tasks_category ON project_tasks(category);

-- Add comment for documentation
COMMENT ON COLUMN project_tasks.category IS 'Task category: general, development, design, marketing, content, seo, analytics, support, other';
COMMENT ON COLUMN project_tasks.brand_id IS 'Optional brand association for brand-specific tasks';

-- Update RLS policies to allow brand-based access
-- Users can view tasks for brands they have access to
CREATE POLICY IF NOT EXISTS "Users can view brand tasks" ON project_tasks
    FOR SELECT
    USING (
        brand_id IS NULL
        OR brand_id IN (
            SELECT brand_id FROM user_brands WHERE user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('super_admin', 'manager')
        )
    );
