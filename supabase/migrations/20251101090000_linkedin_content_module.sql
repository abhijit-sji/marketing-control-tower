-- Create enum for generated post source types
DO $$
BEGIN
  CREATE TYPE public.linkedin_post_source AS ENUM ('trend', 'influencer', 'custom');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Table storing LinkedIn thought leaders
CREATE TABLE IF NOT EXISTS public.thought_leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  department TEXT,
  linkedin_url TEXT,
  target_audience JSONB NOT NULL DEFAULT '{}'::jsonb,
  persona_tone TEXT NOT NULL,
  default_prompt TEXT NOT NULL,
  guide_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Uploaded influencer reference documents per leader
CREATE TABLE IF NOT EXISTS public.leader_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id UUID NOT NULL REFERENCES public.thought_leaders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Weekly trend research generated via Perplexity
CREATE TABLE IF NOT EXISTS public.weekly_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id UUID NOT NULL REFERENCES public.thought_leaders(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  topic_title TEXT NOT NULL,
  topic_summary TEXT NOT NULL,
  relevance_score DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Generated LinkedIn post drafts
CREATE TABLE IF NOT EXISTS public.generated_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id UUID NOT NULL REFERENCES public.thought_leaders(id) ON DELETE CASCADE,
  source_type public.linkedin_post_source NOT NULL DEFAULT 'custom',
  source_reference UUID,
  post_title TEXT NOT NULL,
  post_body TEXT NOT NULL,
  extra_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful indexes for lookups
CREATE INDEX IF NOT EXISTS idx_leader_uploads_leader ON public.leader_uploads(leader_id);
CREATE INDEX IF NOT EXISTS idx_weekly_trends_leader_week ON public.weekly_trends(leader_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_generated_posts_leader ON public.generated_posts(leader_id);

-- Avoid duplicate trend topics per week per leader
DO $$
BEGIN
  ALTER TABLE public.weekly_trends
    ADD CONSTRAINT weekly_trends_unique_topic UNIQUE (leader_id, week_start, topic_title);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Enable row level security
ALTER TABLE public.thought_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leader_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_posts ENABLE ROW LEVEL SECURITY;

-- Policies leveraging has_role helper
DROP POLICY IF EXISTS "linkedin_content_read" ON public.thought_leaders;

CREATE POLICY "linkedin_content_read"
ON public.thought_leaders
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'pm')
);

DROP POLICY IF EXISTS "linkedin_content_manage" ON public.thought_leaders;

CREATE POLICY "linkedin_content_manage"
ON public.thought_leaders
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'pm')
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'pm')
);

DROP POLICY IF EXISTS "leader_uploads_access" ON public.leader_uploads;

CREATE POLICY "leader_uploads_access"
ON public.leader_uploads
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'pm')
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'pm')
);

DROP POLICY IF EXISTS "weekly_trends_access" ON public.weekly_trends;

CREATE POLICY "weekly_trends_access"
ON public.weekly_trends
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'pm')
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'pm')
);

DROP POLICY IF EXISTS "generated_posts_access" ON public.generated_posts;

CREATE POLICY "generated_posts_access"
ON public.generated_posts
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'pm')
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'pm')
);

-- Updated-at triggers
DROP TRIGGER IF EXISTS update_thought_leaders_updated_at ON public.thought_leaders;

CREATE TRIGGER update_thought_leaders_updated_at
  BEFORE UPDATE ON public.thought_leaders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_generated_posts_updated_at ON public.generated_posts;

CREATE TRIGGER update_generated_posts_updated_at
  BEFORE UPDATE ON public.generated_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
