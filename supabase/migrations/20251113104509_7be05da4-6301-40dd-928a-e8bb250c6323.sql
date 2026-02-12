-- Create admin_google_drive_folders table for Google Drive Integration
CREATE TABLE IF NOT EXISTS public.admin_google_drive_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  category TEXT,
  last_synced TIMESTAMP WITH TIME ZONE,
  file_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_google_drive_folders_folder_id ON public.admin_google_drive_folders(folder_id);
CREATE INDEX IF NOT EXISTS idx_admin_google_drive_folders_created_by ON public.admin_google_drive_folders(created_by);

-- Enable RLS
ALTER TABLE public.admin_google_drive_folders ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only super admins and managers can access
CREATE POLICY "Super admins and managers can view Google Drive folders"
  ON public.admin_google_drive_folders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin'::app_role, 'manager'::app_role)
    )
  );

CREATE POLICY "Super admins and managers can insert Google Drive folders"
  ON public.admin_google_drive_folders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin'::app_role, 'manager'::app_role)
    )
  );

CREATE POLICY "Super admins and managers can update Google Drive folders"
  ON public.admin_google_drive_folders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin'::app_role, 'manager'::app_role)
    )
  );

CREATE POLICY "Super admins and managers can delete Google Drive folders"
  ON public.admin_google_drive_folders
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin'::app_role, 'manager'::app_role)
    )
  );

-- Add updated_at trigger
CREATE TRIGGER update_admin_google_drive_folders_updated_at
  BEFORE UPDATE ON public.admin_google_drive_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
