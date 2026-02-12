-- Insert the Content Lifecycle Manager agent
INSERT INTO public.ai_agents (
  slug,
  name,
  description,
  category,
  scope,
  system_prompt,
  is_enabled,
  data_sources,
  config
) VALUES (
  'content-lifecycle',
  'Content Lifecycle Manager',
  'Monitors content production pipeline from research to publication. Identifies stuck content, failed generations, unused trends, and keyword gaps. Recommends actions to maximize content velocity.',
  'content_operations',
  'global',
  'You are the Content Lifecycle Manager for a B2B marketing agency. Analyze the content production pipeline and provide actionable insights on pipeline status, stuck content, content gaps, velocity metrics, and recommended actions.',
  true,
  '["seo_blog_content", "weekly_trends", "keyword_research", "keyword_blog_usage", "brands"]'::jsonb,
  '{
    "model_provider": "openai",
    "model_version": "gpt-4o-mini",
    "max_tokens": 4096,
    "knowledge": {
      "collections": []
    }
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  scope = EXCLUDED.scope,
  is_enabled = EXCLUDED.is_enabled,
  data_sources = EXCLUDED.data_sources,
  config = EXCLUDED.config,
  updated_at = now();