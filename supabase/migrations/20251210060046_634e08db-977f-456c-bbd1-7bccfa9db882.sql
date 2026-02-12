-- Complete vector tables setup (missing from partial migrations)

-- Create brand_knowledge_embeddings table if not exists
CREATE TABLE IF NOT EXISTS public.brand_knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.brand_knowledge_files(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  chunk_text TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create agent_memories table if not exists
CREATE TABLE IF NOT EXISTS public.agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID,
  memory_type TEXT NOT NULL DEFAULT 'conversation',
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add missing columns to knowledge_files if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'knowledge_files' AND column_name = 'embedding_count') THEN
    ALTER TABLE public.knowledge_files ADD COLUMN embedding_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'knowledge_files' AND column_name = 'reindex_required') THEN
    ALTER TABLE public.knowledge_files ADD COLUMN reindex_required BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add missing columns to brand_knowledge_files if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'brand_knowledge_files' AND column_name = 'embedding_count') THEN
    ALTER TABLE public.brand_knowledge_files ADD COLUMN embedding_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'brand_knowledge_files' AND column_name = 'reindex_required') THEN
    ALTER TABLE public.brand_knowledge_files ADD COLUMN reindex_required BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create indexes for vector search
CREATE INDEX IF NOT EXISTS idx_brand_knowledge_embeddings_file_id ON public.brand_knowledge_embeddings(file_id);
CREATE INDEX IF NOT EXISTS idx_brand_knowledge_embeddings_brand_id ON public.brand_knowledge_embeddings(brand_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_agent_id ON public.agent_memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_user_id ON public.agent_memories(user_id);

-- Enable RLS on new tables
ALTER TABLE public.brand_knowledge_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_memories ENABLE ROW LEVEL SECURITY;

-- RLS policies for brand_knowledge_embeddings
CREATE POLICY "Team members can view brand embeddings" ON public.brand_knowledge_embeddings
  FOR SELECT USING (
    user_has_brand_access(auth.uid(), brand_id) 
    OR has_role(auth.uid(), 'super_admin'::app_role) 
    OR has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Team members can manage brand embeddings" ON public.brand_knowledge_embeddings
  FOR ALL USING (
    user_has_brand_access(auth.uid(), brand_id) 
    OR has_role(auth.uid(), 'super_admin'::app_role) 
    OR has_role(auth.uid(), 'manager'::app_role)
  );

-- RLS policies for agent_memories
CREATE POLICY "Users can view their own memories" ON public.agent_memories
  FOR SELECT USING (
    user_id = auth.uid() 
    OR has_role(auth.uid(), 'super_admin'::app_role) 
    OR has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "Users can manage their own memories" ON public.agent_memories
  FOR ALL USING (
    user_id = auth.uid() 
    OR has_role(auth.uid(), 'super_admin'::app_role) 
    OR has_role(auth.uid(), 'manager'::app_role)
  );

-- Create vector search function for brand knowledge
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

-- Create vector search function for agent memories
CREATE OR REPLACE FUNCTION public.match_agent_memories(
  p_agent_id UUID,
  p_user_id UUID,
  p_query_embedding vector(1536),
  p_match_count INTEGER DEFAULT 5
)
RETURNS TABLE(id UUID, content TEXT, memory_type TEXT, score REAL, metadata JSONB, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE
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