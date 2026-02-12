-- ============================================================================
-- Migration: Switch from OpenAI to Gemini embeddings
--
-- Changes vector dimensions from 1536 (OpenAI text-embedding-3-small)
-- to 768 (Gemini text-embedding-004)
--
-- WARNING: This will delete all existing embeddings!
-- They will need to be regenerated using Gemini.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────
-- Step 1: Clear existing embeddings (they're incompatible dimensions)
-- ─────────────────────────────────────────────────────────────────

TRUNCATE TABLE knowledge_embeddings;
TRUNCATE TABLE brand_knowledge_embeddings;
TRUNCATE TABLE agent_memories;

-- ─────────────────────────────────────────────────────────────────
-- Step 2: Drop indexes that reference the vector columns
-- ─────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS knowledge_embeddings_embedding_idx;
DROP INDEX IF EXISTS brand_knowledge_embeddings_embedding_idx;
DROP INDEX IF EXISTS agent_memories_embedding_idx;

-- ─────────────────────────────────────────────────────────────────
-- Step 3: Alter vector columns to 768 dimensions
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE knowledge_embeddings
  ALTER COLUMN embedding TYPE vector(768);

ALTER TABLE brand_knowledge_embeddings
  ALTER COLUMN embedding TYPE vector(768);

ALTER TABLE agent_memories
  ALTER COLUMN embedding TYPE vector(768);

-- ─────────────────────────────────────────────────────────────────
-- Step 4: Recreate indexes with IVFFlat for efficient similarity search
-- ─────────────────────────────────────────────────────────────────

CREATE INDEX knowledge_embeddings_embedding_idx
  ON knowledge_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX brand_knowledge_embeddings_embedding_idx
  ON brand_knowledge_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX agent_memories_embedding_idx
  ON agent_memories
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ─────────────────────────────────────────────────────────────────
-- Step 5: Update RPC functions for 768-dimension vectors
-- ─────────────────────────────────────────────────────────────────

-- Update search_knowledge_embeddings function
CREATE OR REPLACE FUNCTION search_knowledge_embeddings(
  query_embedding vector(768),
  category_ids uuid[],
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.7
)
RETURNS TABLE (
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ke.content,
    ke.metadata,
    1 - (ke.embedding <=> query_embedding) as similarity
  FROM knowledge_embeddings ke
  JOIN knowledge_files kf ON ke.file_id = kf.id
  JOIN knowledge_sources ks ON kf.source_id = ks.id
  WHERE ks.category_id = ANY(category_ids)
    AND 1 - (ke.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Update match_brand_knowledge_embeddings function
CREATE OR REPLACE FUNCTION match_brand_knowledge_embeddings(
  query_embedding vector(768),
  p_brand_ids uuid[],
  match_count int DEFAULT 5,
  match_threshold float DEFAULT 0.7
)
RETURNS TABLE (
  id uuid,
  file_id uuid,
  brand_id uuid,
  chunk_text text,
  chunk_index int,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bke.id,
    bke.file_id,
    bke.brand_id,
    bke.chunk_text,
    bke.chunk_index,
    bke.metadata,
    1 - (bke.embedding <=> query_embedding) as similarity
  FROM brand_knowledge_embeddings bke
  WHERE bke.brand_id = ANY(p_brand_ids)
    AND 1 - (bke.embedding <=> query_embedding) >= match_threshold
  ORDER BY bke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Update match_agent_memories function
CREATE OR REPLACE FUNCTION match_agent_memories(
  query_embedding vector(768),
  p_user_id uuid,
  p_agent_id uuid DEFAULT NULL,
  match_count int DEFAULT 5,
  match_threshold float DEFAULT 0.6
)
RETURNS TABLE (
  id uuid,
  memory_text text,
  tags text[],
  context jsonb,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    am.id,
    am.memory_text,
    am.tags,
    am.context,
    am.created_at,
    1 - (am.embedding <=> query_embedding) as similarity
  FROM agent_memories am
  WHERE am.agent_user_id = p_user_id
    AND (p_agent_id IS NULL OR am.agent_id = p_agent_id)
    AND 1 - (am.embedding <=> query_embedding) >= match_threshold
  ORDER BY am.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────────
-- Step 6: Reset all knowledge files to pending for re-processing
-- ─────────────────────────────────────────────────────────────────

UPDATE knowledge_files
SET processing_status = 'pending',
    retry_count = 0,
    last_error = NULL,
    error_timestamp = NULL,
    is_indexed = false,
    embedding_count = 0
WHERE processing_status IN ('completed', 'processing', 'failed');

-- ─────────────────────────────────────────────────────────────────
-- Add comment documenting the embedding model
-- ─────────────────────────────────────────────────────────────────

COMMENT ON TABLE knowledge_embeddings IS 'Vector embeddings for knowledge files using Gemini text-embedding-004 (768 dimensions)';
COMMENT ON TABLE brand_knowledge_embeddings IS 'Vector embeddings for brand knowledge files using Gemini text-embedding-004 (768 dimensions)';
COMMENT ON TABLE agent_memories IS 'Agent memory storage with Gemini text-embedding-004 embeddings (768 dimensions)';
