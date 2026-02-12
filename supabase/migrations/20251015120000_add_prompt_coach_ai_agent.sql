-- Seed Prompt Coach AI agent for dashboard exposure
INSERT INTO public.ai_agents (
  name,
  slug,
  description,
  category,
  system_prompt,
  data_sources,
  is_enabled,
  required_role,
  created_by
)
SELECT
  'Prompt Coach',
  'prompt-coach',
  'Guides marketers in crafting effective AI prompts with structured feedback and rewrite suggestions.',
  'enablement',
  'You are the Prompt Coach, a collaborative AI assistant that helps business users craft high-impact prompts. When a user shares a draft prompt or business objective: 1) Assess clarity, context, and desired outcome. 2) Ask up to two focused questions if critical details are missing. 3) Provide a concise critique that highlights strengths and opportunities to improve. 4) Deliver a polished rewrite in markdown with sections for Context, Goal, Key Inputs, and Desired Output. 5) Offer two follow-up variations that explore different tones or levels of detail. Keep responses encouraging, actionable, and tailored to marketing use cases.',
  '[]'::jsonb,
  true,
  'manager',
  (
    SELECT id FROM public.users
    WHERE role = 'super_admin'
    ORDER BY created_at ASC
    LIMIT 1
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_agents WHERE slug = 'prompt-coach'
);
