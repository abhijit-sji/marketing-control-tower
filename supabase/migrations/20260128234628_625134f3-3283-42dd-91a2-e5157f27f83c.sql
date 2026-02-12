-- Update vector columns to match Gemini's 768 dimensions
-- This is needed because we switched from OpenAI (1536) to Gemini (768)

-- First, drop any existing embeddings since they're the wrong dimension
TRUNCATE TABLE knowledge_embeddings;
TRUNCATE TABLE brand_knowledge_embeddings;

-- Update the vector column dimensions
ALTER TABLE knowledge_embeddings 
  ALTER COLUMN embedding TYPE vector(768);

ALTER TABLE brand_knowledge_embeddings 
  ALTER COLUMN embedding TYPE vector(768);

-- Reset stuck files so they can be reprocessed
UPDATE knowledge_files 
SET processing_status = 'pending',
    retry_count = 0,
    last_error = NULL
WHERE processing_status IN ('processing', 'failed');

-- Also reset brand knowledge files
UPDATE brand_knowledge_files
SET reindex_required = true
WHERE openai_file_id IS NOT NULL;