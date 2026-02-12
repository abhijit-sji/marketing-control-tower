-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Team members can upload to knowledge bucket" ON storage.objects;
DROP POLICY IF EXISTS "Team members can view knowledge files" ON storage.objects;
DROP POLICY IF EXISTS "Team members can delete knowledge files" ON storage.objects;

-- RLS policies for knowledge bucket
CREATE POLICY "Team members can upload to knowledge bucket"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'knowledge' AND
  (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'pm'::app_role) OR
    EXISTS (
      SELECT 1 FROM projects p
      WHERE storage.objects.name LIKE 'projects/' || p.id::text || '/%'
      AND (p.project_manager = auth.uid() OR auth.uid() = ANY(p.assigned_team))
    )
  )
);

CREATE POLICY "Team members can view knowledge files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'knowledge' AND
  (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'pm'::app_role) OR
    EXISTS (
      SELECT 1 FROM projects p
      WHERE storage.objects.name LIKE 'projects/' || p.id::text || '/%'
      AND (p.project_manager = auth.uid() OR auth.uid() = ANY(p.assigned_team))
    )
  )
);

CREATE POLICY "Team members can delete knowledge files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'knowledge' AND
  (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    EXISTS (
      SELECT 1 FROM projects p
      WHERE storage.objects.name LIKE 'projects/' || p.id::text || '/%'
      AND p.project_manager = auth.uid()
    )
  )
);