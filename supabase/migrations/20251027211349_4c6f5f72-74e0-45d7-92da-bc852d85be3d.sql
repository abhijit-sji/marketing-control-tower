-- Update LinkedIn agent configuration to include all data sources
UPDATE ai_agents
SET 
  data_sources = jsonb_build_array(
    'company_knowledge_base',
    'influencer_style_library', 
    'linkedin_agent_templates',
    'thought_leaders',
    'leader_uploads',
    'weekly_trends'
  ),
  system_prompt = 'You are a LinkedIn content strategist creating engaging, authentic posts. Use company knowledge and leader expertise to craft valuable content that resonates with professional audiences.',
  output_actions = jsonb_build_object(
    'generate_structured_post', true,
    'include_carousel_options', true,
    'provide_caption_variants', true
  )
WHERE slug = 'linkedin-content-gen';

-- Ensure the agent exists and is active
INSERT INTO ai_agents (
  slug,
  name,
  description,
  category,
  system_prompt,
  data_sources,
  is_enabled,
  required_role,
  output_actions
)
VALUES (
  'linkedin-content-gen',
  'LinkedIn Content Generator',
  'Generate compelling LinkedIn posts for thought leaders using company knowledge and performance insights',
  'content_generation',
  'You are a LinkedIn content strategist creating engaging, authentic posts. Use company knowledge and leader expertise to craft valuable content that resonates with professional audiences.',
  jsonb_build_array(
    'company_knowledge_base',
    'influencer_style_library', 
    'linkedin_agent_templates',
    'thought_leaders',
    'leader_uploads',
    'weekly_trends'
  ),
  true,
  'manager',
  jsonb_build_object(
    'generate_structured_post', true,
    'include_carousel_options', true,
    'provide_caption_variants', true
  )
)
ON CONFLICT (slug) DO UPDATE SET
  data_sources = EXCLUDED.data_sources,
  system_prompt = EXCLUDED.system_prompt,
  output_actions = EXCLUDED.output_actions,
  is_enabled = true;
