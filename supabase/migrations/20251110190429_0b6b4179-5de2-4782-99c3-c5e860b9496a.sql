-- Add external_id column to store Google Drive file IDs
ALTER TABLE public.project_knowledge_files 
ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Create unique constraint on source_id and file_name (for backward compatibility)
ALTER TABLE public.project_knowledge_files 
ADD CONSTRAINT project_knowledge_files_source_file_unique 
UNIQUE (source_id, file_name);

-- Create unique constraint on source_id and external_id (for Google Drive files)
CREATE UNIQUE INDEX project_knowledge_files_source_external_unique 
ON public.project_knowledge_files (source_id, external_id) 
WHERE external_id IS NOT NULL;