-- Create thought leader records for all 5 leaders
INSERT INTO public.thought_leaders (name, title, department, persona_tone, guide_text, target_audience, url_slug, default_prompt)
VALUES 
  -- Pritesh Parshekar - Claude Code Expert
  (
    'Pritesh Parshekar',
    'Technical Lead',
    'Engineering',
    'Technical, practical, hands-on. Shares real-world coding experiences with Claude Code. Direct and developer-friendly.',
    E'My name: Pritesh Parshekar\nI''m a Technical Lead at SJ Innovation.\nI specialize in Claude Code and AI-assisted development.\n\nWhat I focus on:\n- Claude Code implementation patterns\n- AI pair programming best practices\n- Code generation and review with Claude\n- Prompt engineering for developers\n- Building production-ready AI applications\n\nI share practical tips and real-world experiences using Claude Code in enterprise environments.',
    '{"primary": "Software developers and technical leads", "secondary": "Engineering managers exploring AI tools", "interests": ["AI coding assistants", "Developer productivity", "Claude AI"], "pain_points": ["Learning new AI tools", "Integrating AI into workflows", "Code quality with AI"]}',
    'pritesh-parshekar',
    'Write a LinkedIn post about Claude Code best practices, AI pair programming, or developer productivity tips. Focus on practical, hands-on advice from real-world implementation experience.'
  ),
  -- Daisyn Fernandes - Lovable Expert
  (
    'Daisyn Fernandes',
    'Product Developer',
    'Engineering',
    'Creative, enthusiastic, accessible. Makes AI-powered development approachable. Tutorial-focused and encouraging.',
    E'My name: Daisyn Fernandes\nI''m a Product Developer at SJ Innovation.\nI specialize in building applications with Lovable.\n\nWhat I focus on:\n- Rapid prototyping with Lovable\n- AI-powered app development\n- No-code to low-code transitions\n- Building MVPs in hours, not weeks\n- Integrating Supabase with Lovable projects\n\nI share tutorials, tips, and real project experiences to help others build faster with AI-powered tools.',
    '{"primary": "Startup founders and product managers", "secondary": "Developers curious about AI-powered development", "interests": ["Rapid prototyping", "AI development tools", "Lovable platform"], "pain_points": ["Slow development cycles", "MVP costs", "Technical barriers"]}',
    'daisyn-fernandes',
    'Write a LinkedIn post about building apps with Lovable, rapid prototyping, or AI-powered development. Focus on tutorials, tips, and real project experiences to help others build faster.'
  ),
  -- Amol Bhandari - Supabase Expert
  (
    'Amol Bhandari',
    'Backend Architect',
    'Engineering',
    'Analytical, detail-oriented, educator. Deep technical expertise shared clearly. Focuses on best practices and security.',
    E'My name: Amol Bhandari\nI''m a Backend Architect at SJ Innovation.\nI specialize in Supabase and modern backend architecture.\n\nWhat I focus on:\n- Supabase database design and optimization\n- Row Level Security (RLS) best practices\n- Edge Functions and serverless architecture\n- Real-time subscriptions and performance\n- Authentication and authorization patterns\n\nI share deep dives into Supabase features and practical implementation guides.',
    '{"primary": "Backend developers and full-stack engineers", "secondary": "CTOs evaluating backend solutions", "interests": ["PostgreSQL", "Serverless", "Supabase", "Backend-as-a-Service"], "pain_points": ["Database scaling", "Security implementation", "Real-time features"]}',
    'amol-bhandari',
    'Write a LinkedIn post about Supabase, PostgreSQL, RLS policies, Edge Functions, or backend architecture. Focus on deep technical dives and practical implementation guides.'
  ),
  -- Mohan Pai - Culture & Process Expert
  (
    'Mohan Pai',
    'Operations Lead',
    'Operations',
    'Thoughtful, experienced, strategic. Shares wisdom from years of agency operations. Storytelling approach with practical takeaways.',
    E'My name: Mohan Pai\nI''m an Operations Lead at SJ Innovation.\nI specialize in agency culture and process optimization.\n\nWhat I focus on:\n- Building high-performance agency culture\n- Remote team management best practices\n- Process frameworks that scale\n- Client success methodologies\n- Team motivation and retention\n\nI share insights from years of agency operations and lessons learned building SJ Innovation''s culture.',
    '{"primary": "Agency owners and operations managers", "secondary": "HR leaders and team leads", "interests": ["Agency growth", "Team culture", "Process optimization", "Remote work"], "pain_points": ["Team retention", "Scaling operations", "Maintaining culture during growth"]}',
    'mohan-pai',
    'Write a LinkedIn post about agency culture, team management, process optimization, or leadership insights. Focus on storytelling with practical takeaways from years of experience.'
  ),
  -- Shahera Choudhury - Finance & HR AI Expert
  (
    'Shahera Choudhury',
    'Co-Founder & CFO',
    'Executive',
    'Strategic, insightful, practical. Executive perspective on AI in finance/HR. Focuses on ROI and business impact.',
    E'My name: Shahera Choudhury\nI''m Co-Founder and CFO of SJ Innovation.\nI co-founded the company with Shahed in 2004.\nI specialize in Finance, HR, and AI applications.\n\nWhat I focus on:\n- AI automation for finance operations\n- HR tech and AI-powered recruiting\n- Financial planning with AI tools\n- Compliance and risk management\n- Building efficient back-office operations\n\nI share practical insights on how AI is transforming finance and HR functions in mid-sized companies.',
    '{"primary": "CFOs and HR Directors", "secondary": "COOs and Finance Managers", "interests": ["Finance automation", "HR AI", "Business operations", "AI ROI"], "pain_points": ["Manual financial processes", "Hiring efficiency", "Compliance complexity"]}',
    'shahera-choudhury',
    'Write a LinkedIn post about AI in finance, HR technology, business operations, or leadership. Focus on strategic insights with practical business impact and ROI considerations.'
  );

-- Link Pritesh's existing user to his thought leader record
UPDATE public.thought_leaders 
SET user_id = '605515ce-e6e7-402d-8dca-b2340452f63d'
WHERE url_slug = 'pritesh-parshekar';

-- Assign content_creator role to Pritesh (he already exists in users table)
INSERT INTO public.user_roles (user_id, role)
VALUES ('605515ce-e6e7-402d-8dca-b2340452f63d', 'content_creator'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;

-- Create a function to auto-link thought leaders when they sign up via magic link
CREATE OR REPLACE FUNCTION public.auto_link_thought_leader()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  leader_record RECORD;
  email_username TEXT;
BEGIN
  -- Extract username from email (e.g., 'daisyn' from 'daisyn@sjinnovation.com')
  email_username := LOWER(SPLIT_PART(NEW.email, '@', 1));
  
  -- Find unlinked thought leader where url_slug starts with the email username
  SELECT * INTO leader_record
  FROM public.thought_leaders
  WHERE user_id IS NULL
    AND url_slug LIKE email_username || '%'
  LIMIT 1;
  
  -- If found, link the user and assign content_creator role
  IF leader_record.id IS NOT NULL THEN
    UPDATE public.thought_leaders 
    SET user_id = NEW.id 
    WHERE id = leader_record.id;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'content_creator'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to run after new user is created
DROP TRIGGER IF EXISTS on_auth_user_created_link_leader ON public.users;
CREATE TRIGGER on_auth_user_created_link_leader
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_thought_leader();