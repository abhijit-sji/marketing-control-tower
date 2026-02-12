-- Add scope column to ai_agents table
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS scope text DEFAULT 'global';

-- Update existing agents with appropriate scopes
UPDATE public.ai_agents SET scope = 'brand' WHERE slug IN ('data-strategist', 'content-strategist', 'seo-blog-generator', 'linkedin-content-gen');
UPDATE public.ai_agents SET scope = 'operations' WHERE slug IN ('chief-of-staff');
UPDATE public.ai_agents SET scope = 'project' WHERE slug IN ('weekly-client-email');

-- Add comment for documentation
COMMENT ON COLUMN public.ai_agents.scope IS 'Defines where this agent can be run: brand, project, operations, or global';