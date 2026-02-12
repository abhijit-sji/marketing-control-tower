-- ================================================
-- Analytics API Edge Function - Database Setup
-- API keys table, rate limiting, and query indexes
-- ================================================

-- ======================
-- 1. API Keys Table
-- ======================
CREATE TABLE IF NOT EXISTS public.analytics_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  rate_limit_per_minute INTEGER DEFAULT 100,
  allowed_actions TEXT[] DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_api_keys_hash
  ON public.analytics_api_keys(key_hash) WHERE is_active = true;

ALTER TABLE public.analytics_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view analytics API keys"
ON public.analytics_api_keys FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

CREATE POLICY "Super admins can insert analytics API keys"
ON public.analytics_api_keys FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

CREATE POLICY "Super admins can update analytics API keys"
ON public.analytics_api_keys FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

CREATE POLICY "Super admins can delete analytics API keys"
ON public.analytics_api_keys FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_analytics_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_analytics_api_keys_updated_at
  BEFORE UPDATE ON public.analytics_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_analytics_api_keys_updated_at();

COMMENT ON TABLE public.analytics_api_keys IS 'API keys for external analytics API access (hashed, revocable, per-client rate limits)';
COMMENT ON COLUMN public.analytics_api_keys.key_hash IS 'SHA-256 hex hash of the raw API key — raw key is never stored';
COMMENT ON COLUMN public.analytics_api_keys.allowed_actions IS 'Empty array = all actions allowed; otherwise restricts to listed actions';

-- ======================
-- 2. Rate Limits Table
-- ======================
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_key_window UNIQUE (api_key_hash, window_start)
);

CREATE INDEX idx_api_rate_limits_lookup
  ON public.api_rate_limits(api_key_hash, window_start);

-- ======================
-- 3. Rate Limit RPC
-- ======================
CREATE OR REPLACE FUNCTION check_analytics_api_rate_limit(
  p_api_key_hash TEXT,
  p_max_requests INTEGER DEFAULT 100
)
RETURNS TABLE (allowed BOOLEAN, current_count INTEGER, limit_max INTEGER, window_resets_at TIMESTAMPTZ)
LANGUAGE plpgsql AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  v_window_start := date_trunc('minute', NOW());

  INSERT INTO public.api_rate_limits (api_key_hash, window_start, request_count)
  VALUES (p_api_key_hash, v_window_start, 1)
  ON CONFLICT (api_key_hash, window_start)
  DO UPDATE SET request_count = api_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  -- Probabilistic cleanup: ~1% of requests clean old rows
  IF random() < 0.01 THEN
    DELETE FROM public.api_rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
  END IF;

  RETURN QUERY SELECT
    (v_count <= p_max_requests),
    v_count,
    p_max_requests,
    v_window_start + INTERVAL '1 minute';
END;
$$;

-- ======================
-- 4. Query Performance Indexes
-- ======================

-- ai_agent_runs
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_created_at ON ai_agent_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_agent_created ON ai_agent_runs(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_status_created ON ai_agent_runs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_provider_created ON ai_agent_runs(model_provider, created_at DESC);

-- content_performance_metrics
CREATE INDEX IF NOT EXISTS idx_content_perf_posted_date ON content_performance_metrics(posted_date DESC);
CREATE INDEX IF NOT EXISTS idx_content_perf_leader_posted ON content_performance_metrics(leader_id, posted_date DESC);
CREATE INDEX IF NOT EXISTS idx_content_perf_type_posted ON content_performance_metrics(post_type, posted_date DESC);

-- brand_analytics_data
CREATE INDEX IF NOT EXISTS idx_brand_analytics_brand_date ON brand_analytics_data(brand_id, date_range_start DESC);
CREATE INDEX IF NOT EXISTS idx_brand_analytics_type_date ON brand_analytics_data(data_type, date_range_start DESC);

-- ai_generated_images
CREATE INDEX IF NOT EXISTS idx_ai_images_created_at ON ai_generated_images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_images_user_created ON ai_generated_images(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_images_provider_created ON ai_generated_images(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_images_status_created ON ai_generated_images(status, created_at DESC);

-- sora_videos
CREATE INDEX IF NOT EXISTS idx_sora_videos_created_at ON sora_videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sora_videos_user_created ON sora_videos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sora_videos_brand_created ON sora_videos(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sora_videos_status_created ON sora_videos(status, created_at DESC);

-- gemini_videos
CREATE INDEX IF NOT EXISTS idx_gemini_videos_created_at ON gemini_videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gemini_videos_user_created ON gemini_videos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gemini_videos_status_created ON gemini_videos(status, created_at DESC);

-- keyword_research
CREATE INDEX IF NOT EXISTS idx_keyword_research_brand_id ON keyword_research(brand_id);
CREATE INDEX IF NOT EXISTS idx_keyword_research_brand_priority ON keyword_research(brand_id, priority);
CREATE INDEX IF NOT EXISTS idx_keyword_research_status ON keyword_research(status);

-- integration_logs
CREATE INDEX IF NOT EXISTS idx_integration_logs_created_at ON integration_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_logs_type_created ON integration_logs(integration_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_logs_status_created ON integration_logs(status, created_at DESC);
