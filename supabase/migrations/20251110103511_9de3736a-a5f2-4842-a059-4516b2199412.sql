-- Create table for storing Google Drive service account credentials
CREATE TABLE IF NOT EXISTS google_drive_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_account_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE google_drive_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can manage Google Drive settings
CREATE POLICY "Admins can manage Google Drive settings"
ON google_drive_settings
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
);