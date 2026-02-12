-- Add Mohan Pai as manager with thought leader profile
-- PREREQUISITE: Create user mohan@sjinnovation.com via Supabase Dashboard first

-- Step 1: Assign 'manager' role to Mohan
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'manager'::app_role
FROM auth.users
WHERE email = 'mohan@sjinnovation.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 2: Create thought leader profile for Mohan Pai
INSERT INTO public.thought_leaders (
  id,
  name,
  title,
  department,
  linkedin_url,
  persona_tone,
  target_audience,
  agent_template_id,
  personal_context
)
SELECT 
  gen_random_uuid(),
  'Mohan Pai',
  'CTO',
  'Technology',
  'https://www.linkedin.com/in/mohanpai/',
  'Technical thought leader with deep expertise in AI and software architecture',
  '{
    "primary": ["CTOs", "Engineering Leaders", "Tech Entrepreneurs"],
    "secondary": ["Product Managers", "AI Practitioners"]
  }'::jsonb,
  'd7c6a3c7-c8d3-4130-971e-89bbabd88f92',
  '{
    "bio": "CTO at SJ Innovation with extensive experience in AI, machine learning, and software architecture. Passionate about building scalable systems and mentoring engineering teams.",
    "expertise_areas": ["AI/ML", "Software Architecture", "Team Leadership", "Product Development"],
    "content_themes": ["Technical Leadership", "AI Innovation", "Engineering Best Practices"]
  }'::jsonb
FROM auth.users
WHERE email = 'mohan@sjinnovation.com'
AND NOT EXISTS (
  SELECT 1 FROM public.thought_leaders WHERE name = 'Mohan Pai'
);