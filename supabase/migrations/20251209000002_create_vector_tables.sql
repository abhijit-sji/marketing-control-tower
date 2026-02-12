-- Create vector storage tables for knowledge embeddings and agent memories
-- This replaces ChromaDB and Mem0 with native Supabase pgvector

-- ============================================================================
-- COMPANY KNOWLEDGE EMBEDDINGS
-- Stores vector embeddings for company knowledge files
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES knowledge_files(id) ON DELETE CASCADE,

  -- Vector embedding (OpenAI text-embedding-3-small = 1536 dimensions)
  embedding vector(1536) NOT NULL,

  -- Content and metadata
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL, -- SHA-256 hash to detect changes

  -- Metadata for context
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Tracking
  indexed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- For future chunking support
  chunk_index INTEGER DEFAULT 0,
  total_chunks INTEGER DEFAULT 1,

  CONSTRAINT knowledge_embeddings_file_chunk_unique UNIQUE(file_id, chunk_index)
);

-- Indexes for vector similarity search
CREATE INDEX knowledge_embeddings_vector_idx
  ON knowledge_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Indexes for filtering
CREATE INDEX knowledge_embeddings_file_id_idx ON knowledge_embeddings(file_id);
CREATE INDEX knowledge_embeddings_metadata_idx ON knowledge_embeddings USING GIN(metadata);
CREATE INDEX knowledge_embeddings_indexed_at_idx ON knowledge_embeddings(indexed_at DESC);

COMMENT ON TABLE knowledge_embeddings IS 'Vector embeddings for company knowledge files';
COMMENT ON COLUMN knowledge_embeddings.embedding IS '1536-dimensional vector from OpenAI text-embedding-3-small';
COMMENT ON COLUMN knowledge_embeddings.content_hash IS 'SHA-256 hash for detecting content changes';

-- ============================================================================
-- BRAND KNOWLEDGE EMBEDDINGS
-- Stores vector embeddings for brand-specific documents
-- ============================================================================

CREATE TABLE IF NOT EXISTS brand_knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_file_id UUID NOT NULL REFERENCES brand_knowledge_files(id) ON DELETE CASCADE,

  -- Vector embedding
  embedding vector(1536) NOT NULL,

  -- Content and metadata
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,

  -- Metadata for context
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Tracking
  indexed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Chunking support
  chunk_index INTEGER DEFAULT 0,
  total_chunks INTEGER DEFAULT 1,

  CONSTRAINT brand_embeddings_file_chunk_unique UNIQUE(brand_file_id, chunk_index)
);

-- Vector search index
CREATE INDEX brand_embeddings_vector_idx
  ON brand_knowledge_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Filtering indexes
CREATE INDEX brand_embeddings_file_id_idx ON brand_knowledge_embeddings(brand_file_id);
CREATE INDEX brand_embeddings_metadata_idx ON brand_knowledge_embeddings USING GIN(metadata);
CREATE INDEX brand_embeddings_indexed_at_idx ON brand_knowledge_embeddings(indexed_at DESC);

COMMENT ON TABLE brand_knowledge_embeddings IS 'Vector embeddings for brand-specific knowledge files';

-- ============================================================================
-- AGENT MEMORY (Replaces Mem0)
-- Stores agent memories with vector embeddings for semantic search
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Agent identification (user who created the agent)
  agent_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,

  -- Memory content
  memory_text TEXT NOT NULL,
  embedding vector(1536) NOT NULL,

  -- Metadata
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  context JSONB DEFAULT '{}'::jsonb,

  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  access_count INTEGER DEFAULT 0,

  -- Memory importance/relevance (for future pruning)
  importance_score FLOAT DEFAULT 0.5 CHECK (importance_score >= 0 AND importance_score <= 1)
);

-- Vector search index
CREATE INDEX agent_memories_vector_idx
  ON agent_memories
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Filtering indexes
CREATE INDEX agent_memories_user_idx ON agent_memories(agent_user_id);
CREATE INDEX agent_memories_agent_idx ON agent_memories(agent_id);
CREATE INDEX agent_memories_tags_idx ON agent_memories USING GIN(tags);
CREATE INDEX agent_memories_created_at_idx ON agent_memories(created_at DESC);

COMMENT ON TABLE agent_memories IS 'Agent memories with vector embeddings, replaces Mem0';
COMMENT ON COLUMN agent_memories.importance_score IS 'Score for future memory pruning (0.0 to 1.0)';

-- ============================================================================
-- HELPER FUNCTIONS FOR VECTOR SEARCH
-- ============================================================================

-- Function to search knowledge embeddings by similarity
CREATE OR REPLACE FUNCTION search_knowledge_embeddings(
  query_embedding vector(1536),
  category_ids UUID[],
  match_count INTEGER DEFAULT 5,
  similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  file_id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ke.file_id,
    ke.content,
    ke.metadata,
    1 - (ke.embedding <=> query_embedding) AS similarity
  FROM knowledge_embeddings ke
  JOIN knowledge_files kf ON ke.file_id = kf.id
  JOIN knowledge_sources ks ON kf.source_id = ks.id
  WHERE ks.category_id = ANY(category_ids)
    AND (1 - (ke.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_knowledge_embeddings IS 'Search company knowledge by vector similarity';

-- Function to search brand knowledge embeddings
CREATE OR REPLACE FUNCTION search_brand_embeddings(
  query_embedding vector(1536),
  brand_ids UUID[],
  match_count INTEGER DEFAULT 5,
  similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  brand_file_id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bke.brand_file_id,
    bke.content,
    bke.metadata,
    1 - (bke.embedding <=> query_embedding) AS similarity
  FROM brand_knowledge_embeddings bke
  JOIN brand_knowledge_files bkf ON bke.brand_file_id = bkf.id
  WHERE bkf.brand_id = ANY(brand_ids)
    AND (1 - (bke.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY bke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_brand_embeddings IS 'Search brand knowledge by vector similarity';

-- Function to search agent memories
CREATE OR REPLACE FUNCTION search_agent_memories(
  query_embedding vector(1536),
  user_id UUID,
  agent_id_param UUID DEFAULT NULL,
  match_count INTEGER DEFAULT 5,
  similarity_threshold FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id UUID,
  memory_text TEXT,
  tags TEXT[],
  context JSONB,
  created_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    am.id,
    am.memory_text,
    am.tags,
    am.context,
    am.created_at,
    1 - (am.embedding <=> query_embedding) AS similarity
  FROM agent_memories am
  WHERE am.agent_user_id = user_id
    AND (agent_id_param IS NULL OR am.agent_id = agent_id_param)
    AND (1 - (am.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY am.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_agent_memories IS 'Search agent memories by vector similarity';
