-- Create newsletter_sources table for RSS feed configurations
CREATE TABLE IF NOT EXISTS public.newsletter_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  feed_url TEXT NOT NULL,
  category TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create newsletter_drafts table for storing generated newsletters
CREATE TABLE IF NOT EXISTS public.newsletter_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  generated_content JSONB NOT NULL DEFAULT '[]'::jsonb,
  html_content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_newsletter_sources_category ON public.newsletter_sources(category);
CREATE INDEX IF NOT EXISTS idx_newsletter_sources_active ON public.newsletter_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_newsletter_drafts_user ON public.newsletter_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_drafts_created ON public.newsletter_drafts(created_at DESC);

-- Enable row level security
ALTER TABLE public.newsletter_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_drafts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for newsletter_sources
-- Admins can manage all sources
DROP POLICY IF EXISTS "newsletter_sources_admin_manage" ON public.newsletter_sources;

CREATE POLICY "newsletter_sources_admin_manage"
ON public.newsletter_sources
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin') OR
  public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin') OR
  public.has_role(auth.uid(), 'manager')
);

-- Users can read active sources
DROP POLICY IF EXISTS "newsletter_sources_user_read" ON public.newsletter_sources;

CREATE POLICY "newsletter_sources_user_read"
ON public.newsletter_sources
FOR SELECT
TO authenticated
USING (is_active = true);

-- RLS Policies for newsletter_drafts
-- Users can manage their own drafts
DROP POLICY IF EXISTS "newsletter_drafts_user_manage" ON public.newsletter_drafts;

CREATE POLICY "newsletter_drafts_user_manage"
ON public.newsletter_drafts
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admins can view all drafts
DROP POLICY IF EXISTS "newsletter_drafts_admin_view" ON public.newsletter_drafts;

CREATE POLICY "newsletter_drafts_admin_view"
ON public.newsletter_drafts
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin') OR
  public.has_role(auth.uid(), 'manager')
);

-- Updated-at triggers
DROP TRIGGER IF EXISTS update_newsletter_sources_updated_at ON public.newsletter_sources;

CREATE TRIGGER update_newsletter_sources_updated_at
  BEFORE UPDATE ON public.newsletter_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_newsletter_drafts_updated_at ON public.newsletter_drafts;

CREATE TRIGGER update_newsletter_drafts_updated_at
  BEFORE UPDATE ON public.newsletter_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

