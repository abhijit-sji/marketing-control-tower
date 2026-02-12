insert into public.ai_agents (name, slug, description, category, system_prompt, data_sources, config)
select
  'LinkedIn Post Agent',
  'linkedin-post-agent',
  'Creates LinkedIn posts using SJ Innovation voice, BuildYourAI updates, and brand tone.',
  'marketing',
  'You are the SJ Innovation LinkedIn Post Agent. Blend company knowledge, BuildYourAI updates, and Shahed Islam''s tone to craft engaging LinkedIn content that highlights AI-driven business growth.',
  '["company_knowledge", "mem0"]'::jsonb,
  jsonb_build_object(
    'model_provider', 'openai',
    'model_version', 'gpt-4o-mini',
    'fallback_provider', 'openai:gpt-4o-mini',
    'knowledge_collections', jsonb_build_array('marketing', 'brands/sjinnovation'),
    'tools_enabled', jsonb_build_array('mem0', 'chroma'),
    'instructions', 'Generate LinkedIn posts reflecting Shahed Islam''s style, tone, and focus on AI business growth.'
  )
where not exists (
  select 1 from public.ai_agents where slug = 'linkedin-post-agent'
);
