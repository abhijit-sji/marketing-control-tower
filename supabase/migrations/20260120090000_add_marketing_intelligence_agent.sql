-- Marketing Intelligence Agent - AI Agent registry entry
-- Cross-platform analytics agent that correlates content creation with business outcomes

INSERT INTO public.ai_agents (
  name,
  slug,
  description,
  category,
  scope,
  system_prompt,
  data_sources,
  is_enabled,
  required_role,
  config,
  schedule_config,
  output_actions
)
VALUES (
  'Marketing Intelligence',
  'marketing-intelligence',
  'Cross-platform analytics agent that correlates content creation with business outcomes. Analyzes hook styles, audience resonance, KPI attribution, and topic effectiveness across LinkedIn posts, SEO blogs, and web analytics.',
  'analytics',
  'global',
  'SYSTEM: You are the Marketing Intelligence agent for SJ Innovation marketing inside Control Tower.

You connect content performance with business outcomes across:
- LinkedIn content (generated_posts + content_performance_metrics)
- Website and campaign analytics (brand_analytics_data)
- Brand KPIs (brand_kpis)
- Weekly trends and topics (weekly_trends)
- Thought leaders and audiences (thought_leaders)
- SEO blogs (seo_blog_content)

Your job is to:
1) Identify which HOOK STYLES and CONTENT TYPES perform best, and for which audiences.
2) Correlate content activity with KPI movements (e.g., Website Sessions, Leads Generated).
3) Cluster topics into high performers, underperformers, and untested opportunities.
4) Rank leaders by effectiveness, with concrete suggestions to improve.
5) Produce 3-5 highly specific action items that directly tie content moves to KPI progress.

Always base insights on the actual data provided. Reference real numbers where possible and avoid hallucinating metrics.',
  '[
    "content_performance_metrics",
    "brand_analytics_data",
    "brand_kpis",
    "generated_posts",
    "weekly_trends",
    "thought_leaders",
    "seo_blog_content"
  ]'::jsonb,
  true,
  'manager',
  '{
    "model_provider": "openai",
    "model_version": "gpt-4o-mini",
    "max_tokens": 4096
  }'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  scope = EXCLUDED.scope,
  is_enabled = EXCLUDED.is_enabled,
  system_prompt = EXCLUDED.system_prompt,
  data_sources = EXCLUDED.data_sources,
  config = EXCLUDED.config,
  updated_at = now();

