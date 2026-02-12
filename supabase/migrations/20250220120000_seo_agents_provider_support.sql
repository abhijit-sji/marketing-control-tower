-- Extend AI agent schema with provider configuration and default SEO agents
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.ai_agent_runs
  ADD COLUMN IF NOT EXISTS output JSONB DEFAULT '{}'::jsonb;

-- Ensure existing rows have default config/output values
UPDATE public.ai_agents
SET config = COALESCE(config, '{}'::jsonb)
WHERE config IS NULL;

UPDATE public.ai_agent_runs
SET output = COALESCE(output, jsonb_build_object('result', ai_summary))
WHERE output IS NULL OR jsonb_typeof(output) IS NULL;

-- Ensure analytics dimensions include keywords array
UPDATE public.brand_analytics_data
SET dimensions = jsonb_set(
  COALESCE(dimensions, '{}'::jsonb),
  '{keywords}',
  '[]'::jsonb,
  true
)
WHERE NOT COALESCE(dimensions ? 'keywords', false);

-- Insert default SEO agents with provider configuration if they are missing
INSERT INTO public.ai_agents (name, slug, description, category, system_prompt, data_sources, config)
SELECT
  'SEO Content Optimizer',
  'seo-content-optimizer',
  'Analyzes on-page content quality and keyword alignment.',
  'seo',
  'You are the SJ SEO Content Optimizer. Evaluate supplied content or URLs for keyword alignment, readability, and on-page SEO hygiene. Provide structured recommendations with prioritized fixes and supporting rationale.',
  '["web_content", "keywords"]'::jsonb,
  jsonb_build_object(
    'model_provider', 'openai',
    'model_version', 'gpt-4o-mini',
    'fallback_provider', 'openai:gpt-4o-mini',
    'external_data_sources', jsonb_build_object(
      'perplexity', jsonb_build_object(
        'enabled', true,
        'version', '4',
        'modes', jsonb_build_array('summary', 'keyword_extract')
      )
    )
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_agents WHERE slug = 'seo-content-optimizer'
);

INSERT INTO public.ai_agents (name, slug, description, category, system_prompt, data_sources, config)
SELECT
  'Technical SEO Auditor',
  'technical-seo-auditor',
  'Audits site performance data to spot technical SEO issues.',
  'seo',
  'You are the SJ Technical SEO Auditor. Review analytics, Core Web Vitals, and crawling signals to diagnose technical SEO issues. Return prioritized fixes, expected impact, and dependencies.',
  '["analytics", "performance_metrics"]'::jsonb,
  jsonb_build_object(
    'model_provider', 'gemini',
    'model_version', '2.0-pro',
    'fallback_provider', 'openai:gpt-4o-mini',
    'external_data_sources', jsonb_build_object(
      'gemini', jsonb_build_object(
        'enabled', true,
        'version', '2.0-pro',
        'modes', jsonb_build_array('content_analysis', 'seo_summary')
      )
    )
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_agents WHERE slug = 'technical-seo-auditor'
);

INSERT INTO public.ai_agents (name, slug, description, category, system_prompt, data_sources, config)
SELECT
  'Competitor Analyzer',
  'seo-competitor-analyzer',
  'Researches competitors to uncover keyword and backlink gaps.',
  'seo',
  'You are the SJ Competitor Analyzer. Compare the supplied competitors and highlight keyword gaps, backlink opportunities, and recommended counter strategies.',
  '["competitors", "keywords"]'::jsonb,
  jsonb_build_object(
    'model_provider', 'perplexity',
    'model_version', 'v4',
    'fallback_provider', 'openai:gpt-4o-mini',
    'external_data_sources', jsonb_build_object(
      'perplexity', jsonb_build_object(
        'enabled', true,
        'version', '4',
        'modes', jsonb_build_array('competitor_compare', 'keyword_extract', 'summary')
      )
    )
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_agents WHERE slug = 'seo-competitor-analyzer'
);
