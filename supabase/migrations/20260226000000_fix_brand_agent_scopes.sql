-- Fix brand agent scopes
-- Ensures all brand-context agents have scope = 'brand'
-- so they appear on brand pages in the AI Solutions tab

-- Ensure scope column exists
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS scope text DEFAULT 'global';

-- Set scope = 'brand' for all agents that belong in the brand context
UPDATE public.ai_agents
SET scope = 'brand'
WHERE slug IN (
  'data-strategist',
  'content-strategist',
  'seo-blog-generator',
  'linkedin-content-gen',
  'linkedin-content-generator',
  'brand-performance-optimization',
  'brand-docs-generator',
  'hero-section-optimizer',
  'reel-hook-generator'
)
AND scope IS DISTINCT FROM 'brand';
