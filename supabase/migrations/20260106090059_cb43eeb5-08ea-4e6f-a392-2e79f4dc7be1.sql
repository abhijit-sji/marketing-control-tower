-- Remove NOT NULL constraint from secondary_keyword
ALTER TABLE public.seo_blog_content
  ALTER COLUMN secondary_keyword DROP NOT NULL;

-- Remove NOT NULL constraint from third_keyword
ALTER TABLE public.seo_blog_content
  ALTER COLUMN third_keyword DROP NOT NULL;

-- Add comments to document the change
COMMENT ON COLUMN public.seo_blog_content.secondary_keyword IS 'Optional secondary keyword for SEO optimization (1x in body if provided)';
COMMENT ON COLUMN public.seo_blog_content.third_keyword IS 'Optional third keyword for SEO optimization (1x in body if provided)';