-- ============================================================================
-- Add Additional Keywords to SEO Blog Generator
-- ============================================================================
-- Migration: Add secondary_keyword and third_keyword columns
-- These fields are optional and provide additional context to the AI
-- for content generation without strict placement requirements
-- ============================================================================

-- Add additional keyword columns
ALTER TABLE public.seo_blog_content
  ADD COLUMN IF NOT EXISTS secondary_keyword TEXT,
  ADD COLUMN IF NOT EXISTS third_keyword TEXT;

-- Add comments to document the new columns
COMMENT ON COLUMN public.seo_blog_content.secondary_keyword IS 'Optional additional keyword phrase for AI context. No strict placement requirements.';
COMMENT ON COLUMN public.seo_blog_content.third_keyword IS 'Optional additional keyword phrase for AI context. No strict placement requirements.';

-- Update table comment
COMMENT ON TABLE public.seo_blog_content IS 'Stores SEO-optimized blog posts generated with strict validation rules. Uses primary keyword with strict placement, plus optional additional keywords for context.';
