-- Create seo_blog_content table
CREATE TABLE IF NOT EXISTS public.seo_blog_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  
  -- Input data
  primary_keyword TEXT NOT NULL,
  primary_reference TEXT NOT NULL,
  secondary_keyword TEXT NOT NULL,
  secondary_reference TEXT NOT NULL,
  third_keyword TEXT NOT NULL,
  third_reference TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  tone TEXT DEFAULT 'informative',
  audience TEXT DEFAULT 'general business audience',
  
  -- Reference summaries (cached)
  primary_reference_summary TEXT,
  secondary_reference_summary TEXT,
  third_reference_summary TEXT,
  
  -- Generated content
  title TEXT,
  paragraphs TEXT[],
  
  -- Validation results
  validation_result JSONB DEFAULT '{}'::jsonb,
  is_valid BOOLEAN DEFAULT false,
  validation_errors TEXT[] DEFAULT ARRAY[]::TEXT[],
  validation_warnings TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Generation metadata
  generation_attempts INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  cost_usd NUMERIC(10, 6) DEFAULT 0,
  generation_time_ms INTEGER DEFAULT 0,
  
  -- Status tracking
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'validated', 'failed', 'published')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create seo_blog_generation_logs table
CREATE TABLE IF NOT EXISTS public.seo_blog_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES public.seo_blog_content(id) ON DELETE CASCADE,
  
  attempt_number INTEGER NOT NULL,
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('initial', 'repair')),
  
  -- Prompts used
  system_prompt TEXT NOT NULL,
  user_prompt TEXT NOT NULL,
  
  -- LLM response
  llm_response TEXT NOT NULL,
  llm_raw_response JSONB DEFAULT '{}'::jsonb,
  
  -- Validation results for this attempt
  validation_errors TEXT[] DEFAULT ARRAY[]::TEXT[],
  validation_warnings TEXT[] DEFAULT ARRAY[]::TEXT[],
  was_valid BOOLEAN DEFAULT false,
  
  -- Token usage for this attempt
  tokens_used INTEGER DEFAULT 0,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create seo_reference_summaries table (cache for reference summaries)
CREATE TABLE IF NOT EXISTS public.seo_reference_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_url TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_seo_blog_content_user_id ON public.seo_blog_content(user_id);
CREATE INDEX IF NOT EXISTS idx_seo_blog_content_brand_id ON public.seo_blog_content(brand_id);
CREATE INDEX IF NOT EXISTS idx_seo_blog_content_status ON public.seo_blog_content(status);
CREATE INDEX IF NOT EXISTS idx_seo_blog_content_created_at ON public.seo_blog_content(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_blog_generation_logs_blog_id ON public.seo_blog_generation_logs(blog_id);
CREATE INDEX IF NOT EXISTS idx_seo_reference_summaries_url ON public.seo_reference_summaries(reference_url);

-- Enable RLS
ALTER TABLE public.seo_blog_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_blog_generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_reference_summaries ENABLE ROW LEVEL SECURITY;

-- RLS policies for seo_blog_content
CREATE POLICY "Users can view their own blog content"
  ON public.seo_blog_content FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own blog content"
  ON public.seo_blog_content FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own blog content"
  ON public.seo_blog_content FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own blog content"
  ON public.seo_blog_content FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all blog content"
  ON public.seo_blog_content FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS policies for seo_blog_generation_logs
CREATE POLICY "Users can view logs for their blogs"
  ON public.seo_blog_generation_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.seo_blog_content
    WHERE id = blog_id AND user_id = auth.uid()
  ));

CREATE POLICY "Service role can insert generation logs"
  ON public.seo_blog_generation_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all generation logs"
  ON public.seo_blog_generation_logs FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS policies for seo_reference_summaries
CREATE POLICY "All authenticated users can read reference summaries"
  ON public.seo_reference_summaries FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can manage reference summaries"
  ON public.seo_reference_summaries FOR ALL
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_seo_blog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_seo_blog_content_updated_at ON public.seo_blog_content;
CREATE TRIGGER update_seo_blog_content_updated_at
  BEFORE UPDATE ON public.seo_blog_content
  FOR EACH ROW
  EXECUTE FUNCTION update_seo_blog_updated_at();