-- Fix brand_knowledge_embeddings table schema to match the latest structure
-- This migration ensures brand_knowledge_embeddings uses the correct column names

-- Drop the conflicting table if it exists (it will be recreated with correct schema)
DROP TABLE IF EXISTS public.brand_knowledge_embeddings CASCADE;

-- Recreate brand_knowledge_embeddings with correct schema
CREATE TABLE public.brand_knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.knowledge_files(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  chunk_text TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_brand_knowledge_embeddings_file_id ON public.brand_knowledge_embeddings(file_id);
CREATE INDEX IF NOT EXISTS idx_brand_knowledge_embeddings_brand_id ON public.brand_knowledge_embeddings(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_knowledge_embeddings_chunk ON public.brand_knowledge_embeddings(file_id, chunk_index);

-- Create vector similarity index (HNSW for fast approximate nearest neighbor search)
CREATE INDEX IF NOT EXISTS idx_brand_knowledge_embeddings_vector ON public.brand_knowledge_embeddings
USING hnsw (embedding vector_cosine_ops);

-- Create unique constraint for file_id + chunk_index
CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_knowledge_embeddings_unique_file_chunk
ON public.brand_knowledge_embeddings(file_id, chunk_index);

-- Enable RLS
ALTER TABLE public.brand_knowledge_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS policies for brand_knowledge_embeddings
DROP POLICY IF EXISTS "Team members can view brand embeddings" ON public.brand_knowledge_embeddings;
CREATE POLICY "Team members can view brand embeddings" ON public.brand_knowledge_embeddings
  FOR SELECT USING (
    user_has_brand_access(auth.uid(), brand_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  );

DROP POLICY IF EXISTS "Team members can manage brand embeddings" ON public.brand_knowledge_embeddings;
CREATE POLICY "Team members can manage brand embeddings" ON public.brand_knowledge_embeddings
  FOR ALL USING (
    user_has_brand_access(auth.uid(), brand_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  );

-- Recreate vector search function for brand knowledge
CREATE OR REPLACE FUNCTION public.match_brand_knowledge_embeddings(
  p_brand_id UUID,
  p_query_embedding vector(1536),
  p_match_count INTEGER DEFAULT 5
)
RETURNS TABLE(file_id UUID, chunk_index INTEGER, chunk_text TEXT, score REAL, metadata JSONB)
LANGUAGE sql STABLE
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