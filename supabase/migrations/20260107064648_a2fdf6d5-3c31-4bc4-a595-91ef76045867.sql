-- ============================================================================
-- Make Secondary and Third Keywords Optional in SEO Blog Generator
-- ============================================================================

-- Add columns if they don't exist (from 20260107 migration)
ALTER TABLE public.seo_blog_content
  ADD COLUMN IF NOT EXISTS secondary_keyword TEXT,
  ADD COLUMN IF NOT EXISTS third_keyword TEXT;

-- Remove NOT NULL constraint if it exists (from 20260106 migration)
DO $$
BEGIN
  -- Check if the columns have NOT NULL and remove it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'seo_blog_content' 
    AND column_name = 'secondary_keyword'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.seo_blog_content ALTER COLUMN secondary_keyword DROP NOT NULL;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'seo_blog_content' 
    AND column_name = 'third_keyword'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.seo_blog_content ALTER COLUMN third_keyword DROP NOT NULL;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN public.seo_blog_content.secondary_keyword IS 'Optional additional keyword phrase for AI context. No strict placement requirements.';
COMMENT ON COLUMN public.seo_blog_content.third_keyword IS 'Optional additional keyword phrase for AI context. No strict placement requirements.';
COMMENT ON TABLE public.seo_blog_content IS 'Stores SEO-optimized blog posts generated with strict validation rules. Uses primary keyword with strict placement, plus optional additional keywords for context.';