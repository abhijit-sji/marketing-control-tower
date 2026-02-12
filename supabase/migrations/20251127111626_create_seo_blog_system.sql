-- ============================================================================
-- SEO Blog Content Generation System
-- ============================================================================
-- Migration: Create tables and policies for SEO blog generation with strict
-- validation rules and OpenAI integration
-- ============================================================================

-- Main table for generated blogs
CREATE TABLE IF NOT EXISTS public.seo_blog_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Input Parameters
  primary_keyword TEXT NOT NULL,
  primary_reference TEXT,
  primary_reference_summary TEXT,

  secondary_keyword TEXT NOT NULL,
  secondary_reference TEXT,
  secondary_reference_summary TEXT,

  third_keyword TEXT NOT NULL,
  third_reference TEXT,
  third_reference_summary TEXT,

  brand_name TEXT NOT NULL,
  tone TEXT DEFAULT 'informative',
  audience TEXT,

  -- Generated Output
  title TEXT,
  paragraphs JSONB, -- Array of paragraph strings

  -- Validation Results
  validation_result JSONB,
  is_valid BOOLEAN DEFAULT false,
  validation_errors TEXT[],
  validation_warnings TEXT[],

  -- Generation Metadata
  generation_attempts INTEGER DEFAULT 0,
  llm_model TEXT DEFAULT 'gpt-4-turbo',
  total_tokens_used INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost_usd DECIMAL(10, 4),
  generation_time_ms INTEGER,

  -- Status Management
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'validated', 'failed', 'published')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Generation attempt logs for debugging and analysis
CREATE TABLE IF NOT EXISTS public.seo_blog_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES public.seo_blog_content(id) ON DELETE CASCADE,

  attempt_number INTEGER NOT NULL,
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('initial', 'repair')),

  -- Prompts and Responses
  system_prompt TEXT,
  user_prompt TEXT,
  llm_response TEXT,
  llm_raw_response JSONB,

  -- Validation for this attempt
  validation_errors JSONB,
  validation_warnings JSONB,
  was_valid BOOLEAN DEFAULT false,

  -- Token usage for this attempt
  tokens_used INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reference summaries cache (to avoid re-summarizing same content)
CREATE TABLE IF NOT EXISTS public.seo_reference_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  reference_url TEXT UNIQUE,
  reference_hash TEXT UNIQUE, -- Hash of full text content
  summary TEXT NOT NULL,

  tokens_used INTEGER,
  model_used TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_seo_blogs_brand_id ON public.seo_blog_content(brand_id);
CREATE INDEX IF NOT EXISTS idx_seo_blogs_user_id ON public.seo_blog_content(user_id);
CREATE INDEX IF NOT EXISTS idx_seo_blogs_status ON public.seo_blog_content(status);
CREATE INDEX IF NOT EXISTS idx_seo_blogs_created_at ON public.seo_blog_content(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_blogs_is_valid ON public.seo_blog_content(is_valid);

CREATE INDEX IF NOT EXISTS idx_seo_blog_logs_blog_id ON public.seo_blog_generation_logs(blog_id);
CREATE INDEX IF NOT EXISTS idx_seo_blog_logs_created_at ON public.seo_blog_generation_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seo_reference_expires ON public.seo_reference_summaries(expires_at);
CREATE INDEX IF NOT EXISTS idx_seo_reference_hash ON public.seo_reference_summaries(reference_hash);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.seo_blog_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_blog_generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_reference_summaries ENABLE ROW LEVEL SECURITY;

-- Users can view their own blogs
CREATE POLICY "Users can view own blogs"
  ON public.seo_blog_content FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert blogs
CREATE POLICY "Users can create blogs"
  ON public.seo_blog_content FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own blogs
CREATE POLICY "Users can update own blogs"
  ON public.seo_blog_content FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own blogs
CREATE POLICY "Users can delete own blogs"
  ON public.seo_blog_content FOR DELETE
  USING (auth.uid() = user_id);

-- Logs are viewable by blog owners
CREATE POLICY "Users can view own blog logs"
  ON public.seo_blog_generation_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.seo_blog_content
      WHERE id = blog_id AND user_id = auth.uid()
    )
  );

-- Reference summaries are readable by authenticated users
CREATE POLICY "Authenticated users can view reference summaries"
  ON public.seo_reference_summaries FOR SELECT
  USING (auth.role() = 'authenticated');

-- Service role can manage reference summaries (for edge functions)
CREATE POLICY "Service role can manage reference summaries"
  ON public.seo_reference_summaries FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- Triggers
-- ============================================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_seo_blog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to seo_blog_content table
DROP TRIGGER IF EXISTS update_seo_blog_content_updated_at ON public.seo_blog_content;
CREATE TRIGGER update_seo_blog_content_updated_at
  BEFORE UPDATE ON public.seo_blog_content
  FOR EACH ROW
  EXECUTE FUNCTION update_seo_blog_updated_at();

-- ============================================================================
-- Utility Functions
-- ============================================================================

-- Function to cleanup expired reference summaries (can be called by cron or manually)
CREATE OR REPLACE FUNCTION cleanup_expired_reference_summaries()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.seo_reference_summaries
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_expired_reference_summaries() TO authenticated;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE public.seo_blog_content IS 'Stores SEO-optimized blog posts generated with strict validation rules';
COMMENT ON TABLE public.seo_blog_generation_logs IS 'Logs each generation attempt for debugging and analysis';
COMMENT ON TABLE public.seo_reference_summaries IS 'Caches reference content summaries to reduce LLM API costs';

COMMENT ON COLUMN public.seo_blog_content.validation_result IS 'Full validation result including stats and detailed errors';
COMMENT ON COLUMN public.seo_blog_content.paragraphs IS 'Array of paragraph strings in JSON format';
COMMENT ON COLUMN public.seo_blog_content.status IS 'Current status: draft, generating, validated, failed, or published';
COMMENT ON COLUMN public.seo_blog_content.cost_usd IS 'Total cost in USD for generating this blog (OpenAI API)';
COMMENT ON COLUMN public.seo_blog_content.generation_time_ms IS 'Total time in milliseconds from request to completion';

COMMENT ON COLUMN public.seo_reference_summaries.reference_hash IS 'SHA-256 hash of reference content for deduplication';
COMMENT ON COLUMN public.seo_reference_summaries.expires_at IS 'Expiration date for cache entry (default 30 days)';
