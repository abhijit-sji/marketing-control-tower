-- ============================================================================
-- Simplify SEO Blog Generator: Single Keyword + Notes Field
-- ============================================================================
-- Migration: Remove secondary and third keyword columns, add additional_notes
-- This simplifies the SEO blog generator to focus on a single keyword phrase
-- with a dedicated notes field for additional requirements
-- ============================================================================

-- Remove secondary keyword columns
ALTER TABLE public.seo_blog_content
  DROP COLUMN IF EXISTS secondary_keyword,
  DROP COLUMN IF EXISTS secondary_reference,
  DROP COLUMN IF EXISTS secondary_reference_summary;

-- Remove third keyword columns
ALTER TABLE public.seo_blog_content
  DROP COLUMN IF EXISTS third_keyword,
  DROP COLUMN IF EXISTS third_reference,
  DROP COLUMN IF EXISTS third_reference_summary;

-- Add notes field for additional requirements
ALTER TABLE public.seo_blog_content
  ADD COLUMN IF NOT EXISTS additional_notes TEXT;

-- Add comment to document the new column
COMMENT ON COLUMN public.seo_blog_content.additional_notes IS 'User provided additional requirements or instructions for blog generation. These will be included in the AI prompt as additional instructions.';

-- Update table comment to reflect simplified approach
COMMENT ON TABLE public.seo_blog_content IS 'Stores SEO-optimized blog posts generated with strict validation rules. Uses single keyword phrase approach with optional additional notes.';
