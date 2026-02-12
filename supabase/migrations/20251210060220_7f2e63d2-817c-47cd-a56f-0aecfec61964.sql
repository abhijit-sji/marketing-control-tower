-- Fix function search_path security warnings
CREATE OR REPLACE FUNCTION public.match_brand_knowledge_embeddings(
  p_brand_id UUID,
  p_query_embedding vector(1536),
  p_match_count INTEGER DEFAULT 5
)
RETURNS TABLE(file_id UUID, chunk_index INTEGER, chunk_text TEXT, score REAL, metadata JSONB)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    e.file_id,
    e.chunk_index,
    e.chunk_text,
    1 - (e.embedding <=> p_query_embedding) as score,
    e.metadata
  FROM public.brand_knowledge_embeddings e
  WHERE e.brand_id = p_brand_id
  ORDER BY e.embedding <-> p_query_embedding
  LIMIT p_match_count;
$$;

CREATE OR REPLACE FUNCTION public.match_agent_memories(
  p_agent_id UUID,
  p_user_id UUID,
  p_query_embedding vector(1536),
  p_match_count INTEGER DEFAULT 5
)
RETURNS TABLE(id UUID, content TEXT, memory_type TEXT, score REAL, metadata JSONB, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    m.id,
    m.content,
    m.memory_type,
    1 - (m.embedding <=> p_query_embedding) as score,
    m.metadata,
    m.created_at
  FROM public.agent_memories m
  WHERE m.agent_id = p_agent_id
    AND (m.user_id = p_user_id OR m.user_id IS NULL)
    AND (m.expires_at IS NULL OR m.expires_at > now())
  ORDER BY m.embedding <-> p_query_embedding
  LIMIT p_match_count;
$$;