-- Add column to store OpenAI vector store ID for leader files
ALTER TABLE thought_leaders 
ADD COLUMN IF NOT EXISTS openai_vector_store_id TEXT;

COMMENT ON COLUMN thought_leaders.openai_vector_store_id IS 'OpenAI vector store ID for this leader''s indexed knowledge files';