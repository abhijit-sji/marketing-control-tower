-- Add OpenAI file tracking columns to leader_uploads
ALTER TABLE leader_uploads 
ADD COLUMN IF NOT EXISTS openai_file_id TEXT,
ADD COLUMN IF NOT EXISTS openai_vector_store_id TEXT,
ADD COLUMN IF NOT EXISTS file_indexed_at TIMESTAMPTZ;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_leader_uploads_openai_file ON leader_uploads(openai_file_id) WHERE openai_file_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN leader_uploads.openai_file_id IS 'OpenAI Files API ID for file_search tool';
COMMENT ON COLUMN leader_uploads.file_indexed_at IS 'Timestamp when file was uploaded to OpenAI';