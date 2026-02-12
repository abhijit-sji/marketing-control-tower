-- Integration Migration: LinkedIn Content Generator Agent
-- This migration registers the LinkedIn Agent in the unified ai_agents table

-- Insert LinkedIn Content Generator agent
INSERT INTO ai_agents (
  name,
  slug,
  category,
  description,
  system_prompt,
  is_enabled,
  data_sources,
  required_role,
  created_at,
  updated_at
)
SELECT
  'LinkedIn Content Generator',
  'linkedin-content-gen',
  'content_generation',
  'Generates LinkedIn posts using thought leader personas, company knowledge, and influencer styles',
  COALESCE(
    (SELECT system_prompt FROM linkedin_agent_templates WHERE is_active = true ORDER BY created_at DESC LIMIT 1),
    'You are a LinkedIn content generation assistant. Create engaging, professional posts tailored to thought leaders.'
  ),
  true,
  jsonb_build_array('company_knowledge_base', 'influencer_style_library', 'linkedin_agent_templates'),
  'manager'::app_role,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM ai_agents WHERE slug = 'linkedin-content-gen'
);

-- Store the agent ID in a variable for subsequent updates
DO $$
DECLARE
  linkedin_agent_id uuid;
BEGIN
  -- Get the LinkedIn agent ID
  SELECT id INTO linkedin_agent_id 
  FROM ai_agents 
  WHERE slug = 'linkedin-content-gen';

  -- Update thought leaders to reference the agent (if table exists and has config column)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'thought_leaders' 
    AND column_name = 'config'
  ) THEN
    UPDATE thought_leaders 
    SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object('ai_agent_id', linkedin_agent_id)
    WHERE config IS NULL OR config->>'ai_agent_id' IS NULL;
  END IF;
END $$;