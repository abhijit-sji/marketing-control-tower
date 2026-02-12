-- Migration: Analytics and safety tables for Nano Banana Image Generation System
-- Description: Creates tables for stats aggregation, safety blocks, prompt templates, and user quotas

-- Pre-aggregated stats (computed by cron, not live queries)
CREATE TABLE IF NOT EXISTS public.image_generation_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  total_generations INTEGER DEFAULT 0,
  successful_generations INTEGER DEFAULT 0,
  failed_generations INTEGER DEFAULT 0,
  blocked_generations INTEGER DEFAULT 0,
  total_cost_cents DECIMAL(12,6) DEFAULT 0,
  avg_generation_time_ms INTEGER,
  model_name TEXT,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, user_id, model_name)
);

-- Enable RLS
ALTER TABLE public.image_generation_stats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'image_generation_stats'
    AND policyname = 'Users can view their own stats'
  ) THEN
    CREATE POLICY "Users can view their own stats"
    ON public.image_generation_stats
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'image_generation_stats'
    AND policyname = 'Admins can view all stats'
  ) THEN
    CREATE POLICY "Admins can view all stats"
    ON public.image_generation_stats
    FOR ALL
    USING (
      public.has_role(auth.uid(), 'super_admin') OR
      public.has_role(auth.uid(), 'manager')
    );
  END IF;
END $$;

-- Safety blocks with admin appeal workflow (CRITICAL for marketing false positives)
CREATE TABLE IF NOT EXISTS public.image_safety_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID REFERENCES public.ai_generated_images(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  blocked_categories JSONB NOT NULL,
  safety_scores JSONB,
  -- Admin appeal workflow
  admin_status TEXT DEFAULT 'pending' CHECK (admin_status IN ('pending', 'approved', 'rejected')),
  override_by UUID REFERENCES public.users(id),
  override_at TIMESTAMPTZ,
  admin_notes TEXT,
  -- User appeal
  user_appeal_reason TEXT,
  appealed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.image_safety_blocks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'image_safety_blocks'
    AND policyname = 'Users can view their own safety blocks'
  ) THEN
    CREATE POLICY "Users can view their own safety blocks"
    ON public.image_safety_blocks
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'image_safety_blocks'
    AND policyname = 'Users can appeal their own blocks'
  ) THEN
    CREATE POLICY "Users can appeal their own blocks"
    ON public.image_safety_blocks
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'image_safety_blocks'
    AND policyname = 'Admins can manage all safety blocks'
  ) THEN
    CREATE POLICY "Admins can manage all safety blocks"
    ON public.image_safety_blocks
    FOR ALL
    USING (
      public.has_role(auth.uid(), 'super_admin') OR
      public.has_role(auth.uid(), 'manager')
    );
  END IF;
END $$;

-- Global prompt templates
CREATE TABLE IF NOT EXISTS public.image_prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  prompt_template TEXT NOT NULL,
  category TEXT,
  usage_count INTEGER DEFAULT 0,
  avg_success_rate DECIMAL(5,4),
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.image_prompt_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'image_prompt_templates'
    AND policyname = 'Anyone can view active templates'
  ) THEN
    CREATE POLICY "Anyone can view active templates"
    ON public.image_prompt_templates
    FOR SELECT
    USING (is_active = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'image_prompt_templates'
    AND policyname = 'Users can create templates'
  ) THEN
    CREATE POLICY "Users can create templates"
    ON public.image_prompt_templates
    FOR INSERT
    WITH CHECK (auth.uid() = created_by);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'image_prompt_templates'
    AND policyname = 'Users can update their own templates'
  ) THEN
    CREATE POLICY "Users can update their own templates"
    ON public.image_prompt_templates
    FOR UPDATE
    USING (auth.uid() = created_by);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'image_prompt_templates'
    AND policyname = 'Admins can manage all templates'
  ) THEN
    CREATE POLICY "Admins can manage all templates"
    ON public.image_prompt_templates
    FOR ALL
    USING (
      public.has_role(auth.uid(), 'super_admin') OR
      public.has_role(auth.uid(), 'manager')
    );
  END IF;
END $$;

-- User quota tracking (for rate limiting)
CREATE TABLE IF NOT EXISTS public.image_user_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  daily_limit INTEGER DEFAULT 50,
  monthly_cost_limit_cents INTEGER DEFAULT 5000, -- $50 default
  current_daily_count INTEGER DEFAULT 0,
  current_monthly_cost_cents DECIMAL(12,6) DEFAULT 0,
  last_reset_date DATE DEFAULT CURRENT_DATE,
  last_monthly_reset DATE DEFAULT date_trunc('month', CURRENT_DATE)::DATE,
  -- Override settings
  has_unlimited BOOLEAN DEFAULT false,
  override_reason TEXT,
  override_by UUID REFERENCES public.users(id),
  override_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.image_user_quotas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'image_user_quotas'
    AND policyname = 'Users can view their own quota'
  ) THEN
    CREATE POLICY "Users can view their own quota"
    ON public.image_user_quotas
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'image_user_quotas'
    AND policyname = 'Admins can manage all quotas'
  ) THEN
    CREATE POLICY "Admins can manage all quotas"
    ON public.image_user_quotas
    FOR ALL
    USING (
      public.has_role(auth.uid(), 'super_admin') OR
      public.has_role(auth.uid(), 'manager')
    );
  END IF;
END $$;

-- Atomic quota increment function (CRITICAL: prevents race conditions)
-- Two requests in same millisecond could both pass a SELECT-based check
-- Use UPDATE with condition + RETURNING for atomic increment
CREATE OR REPLACE FUNCTION increment_image_quota(p_user_id UUID)
RETURNS SETOF public.image_user_quotas AS $$
  UPDATE public.image_user_quotas
  SET
    current_daily_count = current_daily_count + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND (current_daily_count < daily_limit OR has_unlimited = true)
  RETURNING *;
$$ LANGUAGE sql;

-- Function to add cost to monthly tracking
CREATE OR REPLACE FUNCTION add_image_cost(p_user_id UUID, p_cost_cents DECIMAL)
RETURNS SETOF public.image_user_quotas AS $$
  UPDATE public.image_user_quotas
  SET
    current_monthly_cost_cents = current_monthly_cost_cents + p_cost_cents,
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND (current_monthly_cost_cents + p_cost_cents <= monthly_cost_limit_cents OR has_unlimited = true)
  RETURNING *;
$$ LANGUAGE sql;

-- Function to check if user has quota (without incrementing)
CREATE OR REPLACE FUNCTION check_image_quota(p_user_id UUID)
RETURNS TABLE (
  has_quota BOOLEAN,
  current_count INTEGER,
  daily_limit INTEGER,
  monthly_cost DECIMAL,
  monthly_limit INTEGER,
  has_unlimited BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (q.current_daily_count < q.daily_limit OR q.has_unlimited) AS has_quota,
    q.current_daily_count,
    q.daily_limit,
    q.current_monthly_cost_cents,
    q.monthly_cost_limit_cents,
    q.has_unlimited
  FROM public.image_user_quotas q
  WHERE q.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to ensure user has a quota record (idempotent)
CREATE OR REPLACE FUNCTION ensure_user_quota(p_user_id UUID)
RETURNS public.image_user_quotas AS $$
DECLARE
  v_quota public.image_user_quotas;
BEGIN
  -- Try to get existing record
  SELECT * INTO v_quota
  FROM public.image_user_quotas
  WHERE user_id = p_user_id;

  -- If no record exists, create one
  IF v_quota IS NULL THEN
    INSERT INTO public.image_user_quotas (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING * INTO v_quota;

    -- Handle race condition - re-fetch if insert was no-op
    IF v_quota IS NULL THEN
      SELECT * INTO v_quota
      FROM public.image_user_quotas
      WHERE user_id = p_user_id;
    END IF;
  END IF;

  RETURN v_quota;
END;
$$ LANGUAGE plpgsql;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_gen_stats_date
ON public.image_generation_stats(date DESC);

CREATE INDEX IF NOT EXISTS idx_gen_stats_user_date
ON public.image_generation_stats(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_safety_blocks_status
ON public.image_safety_blocks(admin_status);

CREATE INDEX IF NOT EXISTS idx_safety_blocks_user
ON public.image_safety_blocks(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_safety_blocks_pending
ON public.image_safety_blocks(admin_status, created_at DESC)
WHERE admin_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_prompt_templates_category
ON public.image_prompt_templates(category, is_active);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_featured
ON public.image_prompt_templates(is_featured, is_active)
WHERE is_featured = true;

CREATE INDEX IF NOT EXISTS idx_user_quotas_user
ON public.image_user_quotas(user_id);

-- Seed some default prompt templates
INSERT INTO public.image_prompt_templates (name, description, prompt_template, category)
VALUES
  ('Professional Headshot', 'Clean professional portrait style', 'Professional headshot portrait of {subject}, studio lighting, neutral background, business attire, sharp focus, high resolution', 'portrait'),
  ('Product on White', 'Clean product photography', '{product} on pure white background, product photography, studio lighting, commercial quality, centered composition', 'product'),
  ('Social Media Banner', 'Engaging social media cover', 'Social media banner featuring {theme}, modern design, vibrant colors, eye-catching, 16:9 aspect ratio', 'marketing'),
  ('Blog Feature Image', 'Article header illustration', 'Blog feature image for article about {topic}, professional, clean design, conceptual illustration', 'content'),
  ('Team Photo Background', 'Virtual team photo backdrop', 'Modern office environment backdrop, blurred background, professional setting, warm lighting, suitable for virtual team photos', 'business')
ON CONFLICT DO NOTHING;

-- Comments
COMMENT ON TABLE public.image_generation_stats IS 'Pre-aggregated daily stats computed by cron job';
COMMENT ON TABLE public.image_safety_blocks IS 'Safety block events with admin appeal workflow';
COMMENT ON TABLE public.image_prompt_templates IS 'Reusable prompt templates for common use cases';
COMMENT ON TABLE public.image_user_quotas IS 'Per-user daily and monthly generation quotas';
COMMENT ON FUNCTION increment_image_quota IS 'Atomically increment quota count, returns empty if quota exceeded';
COMMENT ON FUNCTION add_image_cost IS 'Atomically add cost to monthly tracking, returns empty if limit exceeded';
