-- Create storage bucket for leader documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'leader-documents',
  'leader-documents',
  true,
  52428800, -- 50MB limit
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint'
  ]
);

-- RLS policies for leader-documents bucket
CREATE POLICY "Managers can upload leader documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'leader-documents' 
  AND (
    has_role(auth.uid(), 'super_admin'::app_role) 
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'pm'::app_role)
  )
);

CREATE POLICY "Managers can update leader documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'leader-documents' 
  AND (
    has_role(auth.uid(), 'super_admin'::app_role) 
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'pm'::app_role)
  )
);

CREATE POLICY "Managers can delete leader documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'leader-documents' 
  AND (
    has_role(auth.uid(), 'super_admin'::app_role) 
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'pm'::app_role)
  )
);

CREATE POLICY "Anyone can view leader documents"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'leader-documents');

-- Update leader_uploads table to support both file uploads and URLs
ALTER TABLE leader_uploads 
ADD COLUMN file_type text NOT NULL DEFAULT 'url' CHECK (file_type IN ('url', 'upload')),
ADD COLUMN file_size bigint,
ADD COLUMN mime_type text;

-- Create index for better query performance
CREATE INDEX idx_leader_uploads_type ON leader_uploads(file_type);
CREATE INDEX idx_leader_uploads_leader_type ON leader_uploads(leader_id, file_type);