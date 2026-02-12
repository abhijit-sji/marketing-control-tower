-- Fix remaining functions missing search_path by dropping and recreating

-- Drop existing functions first
DROP FUNCTION IF EXISTS public.match_brand_knowledge_embeddings(uuid, vector, integer);
DROP FUNCTION IF EXISTS public.match_knowledge_embeddings(uuid, vector, integer);

-- Recreate match_brand_knowledge_embeddings with search_path
CREATE FUNCTION public.match_brand_knowledge_embeddings(
  p_brand_id uuid,
  p_query_embedding vector,
  p_match_count integer
)
RETURNS TABLE(
  file_id uuid,
  chunk_index integer,
  chunk_text text,
  score double precision,
  metadata jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
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

-- Recreate match_knowledge_embeddings with search_path
CREATE FUNCTION public.match_knowledge_embeddings(
  p_category_id uuid,
  p_query_embedding vector,
  p_match_count integer
)
RETURNS TABLE(
  file_id uuid,
  score double precision,
  metadata jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    e.file_id,
    1 - (e.embedding <=> p_query_embedding) as score,
    e.metadata
  FROM public.knowledge_embeddings e
  WHERE e.category_id = p_category_id
  ORDER BY e.embedding <-> p_query_embedding
  LIMIT p_match_count;
$$;