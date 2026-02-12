-- Add columns to weekly_trends for content idea workflow
ALTER TABLE public.weekly_trends
ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS source_url text,
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Add source_type column to leader_uploads for tracking research origin
ALTER TABLE public.leader_uploads
ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'manual';

-- Add leader_id to seo_blog_content to link blogs to thought leaders
ALTER TABLE public.seo_blog_content
ADD COLUMN IF NOT EXISTS leader_id uuid REFERENCES public.thought_leaders(id);

-- Add index for efficient querying of ready trends
CREATE INDEX IF NOT EXISTS idx_weekly_trends_status ON public.weekly_trends(status);
CREATE INDEX IF NOT EXISTS idx_weekly_trends_leader_status ON public.weekly_trends(leader_id, status);
CREATE INDEX IF NOT EXISTS idx_seo_blog_content_leader ON public.seo_blog_content(leader_id);

-- Add marketing role to app_role enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'marketing' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'marketing';
  END IF;
END$$;

-- Comment on new columns
COMMENT ON COLUMN public.weekly_trends.status IS 'Workflow status: draft, ready, in_progress, used';
COMMENT ON COLUMN public.weekly_trends.source_url IS 'Source URL if content came from web research';
COMMENT ON COLUMN public.weekly_trends.created_by IS 'User who created this trend (marketing team member)';
COMMENT ON COLUMN public.leader_uploads.source_type IS 'Origin of file: manual, perplexity, url_scrape';
COMMENT ON COLUMN public.seo_blog_content.leader_id IS 'Link to thought leader who authored the blog';