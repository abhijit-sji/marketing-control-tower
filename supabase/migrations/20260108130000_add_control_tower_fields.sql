-- Add Control Tower tracking columns to projects table
-- This allows importing and tracking projects from an external Control Tower system

-- Add Control Tower project ID and sync timestamp columns
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS control_tower_project_id UUID,
ADD COLUMN IF NOT EXISTS control_tower_last_synced_at TIMESTAMPTZ;

-- Create index for performance when looking up projects by Control Tower ID
CREATE INDEX IF NOT EXISTS idx_projects_control_tower_id
ON projects(control_tower_project_id);

-- Add comments for documentation
COMMENT ON COLUMN projects.control_tower_project_id IS 'UUID from external Control Tower system for tracking imported projects';
COMMENT ON COLUMN projects.control_tower_last_synced_at IS 'Timestamp of last sync from Control Tower system';
