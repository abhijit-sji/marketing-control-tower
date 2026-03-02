-- =====================================================
-- Add 4 dummy projects for demo purposes
-- Fix projects RLS to allow all authenticated users to view projects
-- =====================================================

-- =====================================================
-- 1. FIX PROJECTS RLS POLICY
-- =====================================================

DROP POLICY IF EXISTS "Users view projects" ON public.projects;

CREATE POLICY "Users view projects" ON public.projects
FOR SELECT USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 2. INSERT 4 DUMMY PROJECTS
-- =====================================================

INSERT INTO public.projects (
  id, name, slug, description, client_id,
  status, start_date, end_date,
  project_manager_id, activecollab_id,
  metadata, created_at, updated_at
) VALUES
  (
    'e1000000-0000-0000-0000-000000000001'::uuid,
    'AI-Powered Lead Generation',
    'ai-lead-generation',
    'Build and launch a full-funnel AI-assisted lead generation system targeting mid-market SaaS buyers.',
    'f1000000-0000-0000-0000-000000000001'::uuid,
    'in_progress',
    '2026-01-15'::date, '2026-06-30'::date,
    NULL, 20001,
    '{"budget": 85000, "deliverables": ["Landing pages", "Email sequences", "Ad campaigns"]}'::jsonb,
    NOW() - INTERVAL '45 days', NOW() - INTERVAL '2 days'
  ),
  (
    'e1000000-0000-0000-0000-000000000002'::uuid,
    'Q2 Digital Marketing Campaign',
    'q2-digital-campaign',
    'Multi-channel Q2 campaign across paid social, SEO, and email for brand awareness and conversions.',
    'f1000000-0000-0000-0000-000000000002'::uuid,
    'planning',
    '2026-04-01'::date, '2026-06-30'::date,
    NULL, 20002,
    '{"budget": 60000, "deliverables": ["Campaign strategy", "Creative assets", "Analytics setup"]}'::jsonb,
    NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 day'
  ),
  (
    'e1000000-0000-0000-0000-000000000003'::uuid,
    'Brand Identity Overhaul',
    'brand-identity-overhaul',
    'Full rebrand including logo, color system, messaging framework, and brand guidelines document.',
    'f1000000-0000-0000-0000-000000000004'::uuid,
    'in_progress',
    '2026-02-01'::date, '2026-05-31'::date,
    NULL, 20003,
    '{"budget": 45000, "deliverables": ["Logo suite", "Brand guidelines", "Tone of voice doc"]}'::jsonb,
    NOW() - INTERVAL '30 days', NOW() - INTERVAL '3 days'
  ),
  (
    'e1000000-0000-0000-0000-000000000004'::uuid,
    'Content & SEO Program',
    'content-seo-program',
    'Ongoing monthly content production: 6 SEO blogs, 12 LinkedIn posts, and keyword tracking.',
    'f1000000-0000-0000-0000-000000000005'::uuid,
    'in_progress',
    '2026-01-01'::date, '2026-12-31'::date,
    NULL, 20004,
    '{"budget": 72000, "deliverables": ["6 SEO blogs/month", "12 LinkedIn posts/month", "Monthly report"]}'::jsonb,
    NOW() - INTERVAL '60 days', NOW()
  )
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- 3. INSERT TASKS FOR EACH PROJECT
-- =====================================================

INSERT INTO public.project_tasks (
  id, project_id, title, description,
  status, priority, due_date, created_at, updated_at
) VALUES
  -- AI Lead Generation tasks
  ('f0000000-0000-0000-0003-000000000001'::uuid,
   'e1000000-0000-0000-0000-000000000001'::uuid,
   'Audience persona research', 'Define 3 ICP personas with pain points and buying triggers',
   'completed', 'high', '2026-02-15', NOW() - INTERVAL '40 days', NOW() - INTERVAL '30 days'),

  ('f0000000-0000-0000-0003-000000000002'::uuid,
   'e1000000-0000-0000-0000-000000000001'::uuid,
   'Landing page copywriting', 'Write conversion-focused copy for 2 landing pages',
   'in_progress', 'high', '2026-03-20', NOW() - INTERVAL '20 days', NOW() - INTERVAL '2 days'),

  ('f0000000-0000-0000-0003-000000000003'::uuid,
   'e1000000-0000-0000-0000-000000000001'::uuid,
   'Email nurture sequence (5-part)', 'Write and schedule 5-email drip campaign for MQL nurturing',
   'todo', 'medium', '2026-04-10', NOW() - INTERVAL '10 days', NOW()),

  -- Q2 Campaign tasks
  ('f0000000-0000-0000-0003-000000000004'::uuid,
   'e1000000-0000-0000-0000-000000000002'::uuid,
   'Campaign strategy document', 'Define goals, KPIs, channels, budget allocation, and timeline',
   'in_progress', 'high', '2026-03-15', NOW() - INTERVAL '8 days', NOW() - INTERVAL '1 day'),

  ('f0000000-0000-0000-0003-000000000005'::uuid,
   'e1000000-0000-0000-0000-000000000002'::uuid,
   'Creative brief and moodboard', 'Develop visual direction and creative guidelines for campaign',
   'todo', 'medium', '2026-03-25', NOW() - INTERVAL '5 days', NOW()),

  ('f0000000-0000-0000-0003-000000000006'::uuid,
   'e1000000-0000-0000-0000-000000000002'::uuid,
   'Analytics and tracking setup', 'Configure GA4, UTM parameters, and conversion events',
   'todo', 'low', '2026-03-30', NOW() - INTERVAL '3 days', NOW()),

  -- Brand Identity tasks
  ('f0000000-0000-0000-0003-000000000007'::uuid,
   'e1000000-0000-0000-0000-000000000003'::uuid,
   'Discovery workshop', 'Run brand discovery session with client stakeholders',
   'completed', 'high', '2026-02-10', NOW() - INTERVAL '28 days', NOW() - INTERVAL '20 days'),

  ('f0000000-0000-0000-0003-000000000008'::uuid,
   'e1000000-0000-0000-0000-000000000003'::uuid,
   'Logo concepts (3 directions)', 'Design 3 distinct logo directions for client review',
   'completed', 'high', '2026-03-01', NOW() - INTERVAL '20 days', NOW() - INTERVAL '10 days'),

  ('f0000000-0000-0000-0003-000000000009'::uuid,
   'e1000000-0000-0000-0000-000000000003'::uuid,
   'Brand guidelines document', 'Compile full brand guidelines covering logo, color, typography, tone',
   'in_progress', 'high', '2026-04-15', NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 day'),

  ('f0000000-0000-0000-0003-000000000010'::uuid,
   'e1000000-0000-0000-0000-000000000003'::uuid,
   'Client sign-off presentation', 'Present final brand system to client for approval',
   'todo', 'medium', '2026-05-01', NOW() - INTERVAL '5 days', NOW()),

  -- Content & SEO tasks
  ('f0000000-0000-0000-0003-000000000011'::uuid,
   'e1000000-0000-0000-0000-000000000004'::uuid,
   'Master keyword research', 'Build keyword cluster map for all content verticals',
   'completed', 'high', '2026-01-20', NOW() - INTERVAL '55 days', NOW() - INTERVAL '45 days'),

  ('f0000000-0000-0000-0003-000000000012'::uuid,
   'e1000000-0000-0000-0000-000000000004'::uuid,
   'January SEO blogs (6)', 'Write and publish 6 SEO-optimized blog posts',
   'completed', 'high', '2026-01-31', NOW() - INTERVAL '50 days', NOW() - INTERVAL '35 days'),

  ('f0000000-0000-0000-0003-000000000013'::uuid,
   'e1000000-0000-0000-0000-000000000004'::uuid,
   'February SEO blogs (6)', 'Write and publish 6 SEO blogs targeting mid-funnel keywords',
   'completed', 'high', '2026-02-28', NOW() - INTERVAL '30 days', NOW() - INTERVAL '15 days'),

  ('f0000000-0000-0000-0003-000000000014'::uuid,
   'e1000000-0000-0000-0000-000000000004'::uuid,
   'March SEO blogs (6)', 'Write and publish 6 SEO blogs for March',
   'in_progress', 'high', '2026-03-31', NOW() - INTERVAL '10 days', NOW())

ON CONFLICT (id) DO NOTHING;
