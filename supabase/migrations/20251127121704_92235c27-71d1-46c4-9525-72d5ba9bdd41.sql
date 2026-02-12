-- ============================================================================
-- Keyword Research System
-- ============================================================================

-- Main keyword tracking table (per brand)
CREATE TABLE IF NOT EXISTS public.keyword_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Keyword Data
  keyword TEXT NOT NULL,
  keyword_normalized TEXT NOT NULL,
  
  -- Metrics (from Perplexity or manual entry)
  search_volume INTEGER,
  competition TEXT CHECK (competition IN ('low', 'medium', 'high')),
  difficulty_score INTEGER CHECK (difficulty_score BETWEEN 0 AND 100),
  
  -- Tracking
  current_rank INTEGER,
  target_rank INTEGER,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'tracking' CHECK (status IN ('tracking', 'targeting', 'achieved', 'archived')),
  
  -- Tags and Notes
  tags TEXT[],
  notes TEXT,
  
  -- Usage tracking
  used_in_blog_count INTEGER DEFAULT 0,
  last_used_in_blog TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ,
  
  -- Unique constraint per brand
  UNIQUE(brand_id, keyword_normalized)
);

-- Keyword suggestions from AI (temporary cache)
CREATE TABLE IF NOT EXISTS public.keyword_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seed_keyword TEXT NOT NULL,
  
  -- Suggested keywords
  suggestions JSONB NOT NULL,
  
  -- AI metadata
  model_used TEXT DEFAULT 'perplexity',
  prompt_used TEXT,
  tokens_used INTEGER,
  
  -- Cache management
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Historical ranking data
CREATE TABLE IF NOT EXISTS public.keyword_ranking_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  keyword_id UUID NOT NULL REFERENCES public.keyword_research(id) ON DELETE CASCADE,
  
  rank INTEGER NOT NULL,
  search_volume INTEGER,
  page_url TEXT,
  
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link keywords to generated SEO blogs
CREATE TABLE IF NOT EXISTS public.keyword_blog_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  keyword_id UUID NOT NULL REFERENCES public.keyword_research(id) ON DELETE CASCADE,
  blog_id UUID NOT NULL REFERENCES public.seo_blog_content(id) ON DELETE CASCADE,
  
  keyword_type TEXT NOT NULL CHECK (keyword_type IN ('primary', 'secondary', 'third')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(blog_id, keyword_type)
);

-- Indexes
CREATE INDEX idx_keyword_research_brand_id ON public.keyword_research(brand_id);
CREATE INDEX idx_keyword_research_status ON public.keyword_research(status);
CREATE INDEX idx_keyword_research_priority ON public.keyword_research(priority);
CREATE INDEX idx_keyword_suggestions_brand_id ON public.keyword_suggestions(brand_id);
CREATE INDEX idx_keyword_suggestions_expires ON public.keyword_suggestions(expires_at);
CREATE INDEX idx_keyword_ranking_history_keyword_id ON public.keyword_ranking_history(keyword_id);
CREATE INDEX idx_keyword_ranking_history_checked_at ON public.keyword_ranking_history(checked_at DESC);
CREATE INDEX idx_keyword_blog_usage_keyword_id ON public.keyword_blog_usage(keyword_id);
CREATE INDEX idx_keyword_blog_usage_blog_id ON public.keyword_blog_usage(blog_id);

-- RLS Policies
ALTER TABLE public.keyword_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword_ranking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword_blog_usage ENABLE ROW LEVEL SECURITY;

-- Users can manage keywords for their brands
CREATE POLICY "Users can manage brand keywords"
  ON public.keyword_research FOR ALL
  USING (
    user_has_brand_access(auth.uid(), brand_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  );

-- Users can view suggestions for their brands
CREATE POLICY "Users can view brand suggestions"
  ON public.keyword_suggestions FOR SELECT
  USING (
    user_has_brand_access(auth.uid(), brand_id)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  );

-- Users can create suggestions
CREATE POLICY "Users can create suggestions"
  ON public.keyword_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view ranking history for their keywords
CREATE POLICY "Users can view ranking history"
  ON public.keyword_ranking_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.keyword_research
      WHERE id = keyword_id
        AND (user_has_brand_access(auth.uid(), brand_id)
             OR has_role(auth.uid(), 'super_admin'::app_role)
             OR has_role(auth.uid(), 'manager'::app_role))
    )
  );

-- Service role can insert ranking history
CREATE POLICY "Service role can insert ranking history"
  ON public.keyword_ranking_history FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Users can view blog usage for their keywords
CREATE POLICY "Users can view blog usage"
  ON public.keyword_blog_usage FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.keyword_research
      WHERE id = keyword_id
        AND (user_has_brand_access(auth.uid(), brand_id)
             OR has_role(auth.uid(), 'super_admin'::app_role)
             OR has_role(auth.uid(), 'manager'::app_role))
    )
  );

-- Service role can manage blog usage
CREATE POLICY "Service role can manage blog usage"
  ON public.keyword_blog_usage FOR ALL
  USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Updated_at trigger
CREATE TRIGGER update_keyword_research_updated_at
  BEFORE UPDATE ON public.keyword_research
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Cleanup function for expired suggestions
CREATE OR REPLACE FUNCTION cleanup_expired_keyword_suggestions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.keyword_suggestions
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;