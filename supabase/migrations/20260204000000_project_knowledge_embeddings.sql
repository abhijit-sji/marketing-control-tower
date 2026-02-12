-- ============================================================================
-- Migration: Project Knowledge Base - Vector Embeddings & Async Processing
--
-- This migration adds brand-like knowledge base features to projects:
-- 1. project_knowledge_embeddings table with vector storage
-- 2. Async processing columns to project_knowledge_files
-- 3. claim_pending_project_knowledge_jobs RPC function
-- 4. match_project_knowledge_embeddings search function
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────
-- 1. Add processing columns to project_knowledge_files
-- ─────────────────────────────────────────────────────────────────

-- Add name column (for consistency with knowledge_files pattern)
ALTER TABLE public.project_knowledge_files
ADD COLUMN IF NOT EXISTS name TEXT;

-- Update existing rows to use file_name as name
UPDATE public.project_knowledge_files
SET name = file_name
WHERE name IS NULL;

-- Add storage path column
ALTER TABLE public.project_knowledge_files
ADD COLUMN IF NOT EXISTS path TEXT;

-- Add processing status column (enum-like text)
ALTER TABLE public.project_knowledge_files
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending'
CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'));

-- Add retry tracking columns
ALTER TABLE public.project_knowledge_files
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

ALTER TABLE public.project_knowledge_files
ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE public.project_knowledge_files
ADD COLUMN IF NOT EXISTS error_timestamp TIMESTAMPTZ;

-- Add embedding tracking columns
ALTER TABLE public.project_knowledge_files
ADD COLUMN IF NOT EXISTS embedding_count INTEGER DEFAULT 0;

ALTER TABLE public.project_knowledge_files
ADD COLUMN IF NOT EXISTS is_indexed BOOLEAN DEFAULT false;

ALTER TABLE public.project_knowledge_files
ADD COLUMN IF NOT EXISTS last_indexed TIMESTAMPTZ;

-- Add metadata column for additional file info
ALTER TABLE public.project_knowledge_files
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment documenting status values
COMMENT ON COLUMN public.project_knowledge_files.processing_status IS
'Job status: pending (waiting), processing (in progress), completed (done), failed (error - will retry)';

-- Create index for processing queue
CREATE INDEX IF NOT EXISTS idx_project_knowledge_files_processing_queue
ON public.project_knowledge_files (processing_status, retry_count, created_at)
WHERE processing_status IN ('pending', 'failed');

-- ─────────────────────────────────────────────────────────────────
-- 2. Create project_knowledge_embeddings table
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.project_knowledge_files(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  chunk_text TEXT NOT NULL,
  embedding vector(1536),  -- OpenAI text-embedding-3-small dimension
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_knowledge_embeddings_file_id
ON public.project_knowledge_embeddings(file_id);

CREATE INDEX IF NOT EXISTS idx_project_knowledge_embeddings_project_id
ON public.project_knowledge_embeddings(project_id);

CREATE INDEX IF NOT EXISTS idx_project_knowledge_embeddings_chunk
ON public.project_knowledge_embeddings(file_id, chunk_index);

-- Create vector similarity index (HNSW for fast approximate nearest neighbor search)
CREATE INDEX IF NOT EXISTS idx_project_knowledge_embeddings_vector
ON public.project_knowledge_embeddings
USING hnsw (embedding vector_cosine_ops);

-- Create unique constraint for file_id + chunk_index
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_knowledge_embeddings_unique_file_chunk
ON public.project_knowledge_embeddings(file_id, chunk_index);

-- ─────────────────────────────────────────────────────────────────
-- 3. Enable RLS and create policies for project_knowledge_embeddings
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.project_knowledge_embeddings ENABLE ROW LEVEL SECURITY;

-- Helper function to check project access
CREATE OR REPLACE FUNCTION user_has_project_access(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = _project_id
    AND (
      p.project_manager = _user_id
      OR _user_id = ANY(p.assigned_team)
    )
  );
$$;

-- RLS policy for viewing project embeddings
CREATE POLICY "Users can view project embeddings" ON public.project_knowledge_embeddings
  FOR SELECT USING (
    user_has_project_access(auth.uid(), project_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  );

-- RLS policy for managing project embeddings
CREATE POLICY "Users can manage project embeddings" ON public.project_knowledge_embeddings
  FOR ALL USING (
    user_has_project_access(auth.uid(), project_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  );

-- ─────────────────────────────────────────────────────────────────
-- 4. Create claim_pending_project_knowledge_jobs function
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION claim_pending_project_knowledge_jobs(
  job_limit INT DEFAULT 5,
  max_retries INT DEFAULT 3
)
RETURNS SETOF project_knowledge_files
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id
    FROM project_knowledge_files
    WHERE processing_status IN ('pending', 'failed')
      AND (retry_count IS NULL OR retry_count < max_retries)
    ORDER BY
      CASE WHEN processing_status = 'failed' THEN 1 ELSE 0 END,  -- Retry failed first
      created_at ASC
    LIMIT job_limit
    FOR UPDATE SKIP LOCKED  -- Atomic lock, skip if locked by another worker
  )
  UPDATE project_knowledge_files f
  SET processing_status = 'processing',
      updated_at = NOW()
  FROM claimed c
  WHERE f.id = c.id
  RETURNING f.*;
END;
$$;

-- Grant execute to service role (used by edge functions)
GRANT EXECUTE ON FUNCTION claim_pending_project_knowledge_jobs TO service_role;

-- ─────────────────────────────────────────────────────────────────
-- 5. Create match_project_knowledge_embeddings search function
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.match_project_knowledge_embeddings(
  p_project_id UUID,
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
  FROM public.project_knowledge_embeddings e
  WHERE e.project_id = p_project_id
  ORDER BY e.embedding <-> p_query_embedding
  LIMIT p_match_count;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION match_project_knowledge_embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_project_access TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_project_access TO service_role;

-- ─────────────────────────────────────────────────────────────────
-- 6. Create updated_at trigger for embeddings table
-- ─────────────────────────────────────────────────────────────────

CREATE TRIGGER update_project_knowledge_embeddings_updated_at
  BEFORE UPDATE ON public.project_knowledge_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
