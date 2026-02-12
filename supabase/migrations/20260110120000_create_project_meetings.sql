-- Create project_meetings table
CREATE TABLE IF NOT EXISTS project_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  meeting_id TEXT NOT NULL,
  meeting_title TEXT NOT NULL,
  meeting_description TEXT,
  meeting_type TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location TEXT,
  attendees TEXT[],
  organizer TEXT,
  meeting_link TEXT,
  meeting_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, meeting_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_project_meetings_project_id ON project_meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_project_meetings_meeting_id ON project_meetings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_project_meetings_start_time ON project_meetings(start_time DESC);

-- Enable RLS
ALTER TABLE project_meetings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow users with pm role or higher to view project meetings
CREATE POLICY "Users with pm role can view project meetings"
  ON project_meetings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('pm', 'manager', 'super_admin')
    )
  );

-- Allow users with pm role or higher to insert project meetings
CREATE POLICY "Users with pm role can insert project meetings"
  ON project_meetings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('pm', 'manager', 'super_admin')
    )
  );

-- Allow users with pm role or higher to update project meetings
CREATE POLICY "Users with pm role can update project meetings"
  ON project_meetings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('pm', 'manager', 'super_admin')
    )
  );

-- Allow users with pm role or higher to delete project meetings
CREATE POLICY "Users with pm role can delete project meetings"
  ON project_meetings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('pm', 'manager', 'super_admin')
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_project_meetings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_meetings_updated_at_trigger
  BEFORE UPDATE ON project_meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_project_meetings_updated_at();
