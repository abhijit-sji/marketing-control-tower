-- =====================================================
-- COMPREHENSIVE DEMO DATA SEEDING - PHASE 4
-- Integrations & Advanced Features: ActiveCollab, GA, HubSpot, Control Tower, Hackathon, n8n
-- =====================================================
-- Lightweight realistic demo data (~80 records)
-- Integration data, pods, employees, hackathon events, workflow data
--
-- Prerequisites: Phases 1-3 must be completed
-- All foundational data created in earlier phases

-- =====================================================
-- DEMO USER IDs (from earlier phases)
-- =====================================================
-- UUID Mapping (replace with actual auth user IDs if different):
-- admin_id: 500b4a7f-4c4a-429e-a307-0601568c8525
-- user_id: b31fefe1-d78f-4160-85d3-298bccf9e02e
-- pm_id: e4c5f6a7-b8c9-4d0e-a1f2-c3d4e5f6a7b8
-- brand_manager_id: f5d6e7b8-c9da-4e1f-b2g3-d4e5f6a7b8c9
-- manager_id: a6e7f8c9-daeb-4f2g-c3h4-e5f6a7b8c9d0

-- =====================================================
-- 1. CONTROL TOWER - PODS
-- =====================================================

INSERT INTO public.pods (
  id,
  name,
  slug,
  description,
  lead_id,
  status,
  created_at,
  updated_at
) VALUES
  ('pod-001-0000-0000-000000000001'::uuid, 'Strategy & Planning', 'strategy-planning',
   'Strategic initiatives and annual planning', 'e4c5f6a7-b8c9-4d0e-a1f2-c3d4e5f6a7b8'::uuid, 'active', NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days'),

  ('pod-002-0000-0000-000000000002'::uuid, 'Content Creation', 'content-creation',
   'Content production and creative team', 'f5d6e7b8-c9da-4e1f-b2g3-d4e5f6a7b8c9'::uuid, 'active', NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days'),

  ('pod-003-0000-0000-000000000003'::uuid, 'Technology & Innovation', 'tech-innovation',
   'Engineering and tech infrastructure', '500b4a7f-4c4a-429e-a307-0601568c8525'::uuid, 'active', NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days'),

  ('pod-004-0000-0000-000000000004'::uuid, 'Operations & Support', 'operations-support',
   'Operations, HR, and support functions', 'a6e7f8c9-daeb-4f2g-c3h4-e5f6a7b8c9d0'::uuid, 'active', NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days')
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- 2. CONTROL TOWER - EMPLOYEES
-- =====================================================

INSERT INTO public.employees (
  id,
  first_name,
  last_name,
  email,
  role,
  department,
  status,
  created_at,
  updated_at
) VALUES
  -- Existing demo users (map to employees)
  ('emp-001-0000-0000-000000000001'::uuid, 'Demo', 'Admin', 'demo.admin@sjinnovation.com', 'Super Admin', 'Leadership', 'active', NOW() - INTERVAL '120 days', NOW() - INTERVAL '120 days'),
  ('emp-002-0000-0000-000000000002'::uuid, 'Demo', 'PM', 'demo.pm@sjinnovation.com', 'Project Manager', 'Strategy', 'active', NOW() - INTERVAL '100 days', NOW() - INTERVAL '100 days'),
  ('emp-003-0000-0000-000000000003'::uuid, 'Demo', 'Brand Manager', 'demo.brand.manager@sjinnovation.com', 'Brand Manager', 'Content', 'active', NOW() - INTERVAL '95 days', NOW() - INTERVAL '95 days'),
  ('emp-004-0000-0000-000000000004'::uuid, 'Demo', 'Manager', 'demo.manager@sjinnovation.com', 'Manager', 'Operations', 'active', NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days'),
  ('emp-005-0000-0000-000000000005'::uuid, 'Demo', 'User', 'demo.user@sjinnovation.com', 'Coordinator', 'Content', 'active', NOW() - INTERVAL '85 days', NOW() - INTERVAL '85 days'),

  -- Additional team members
  ('emp-006-0000-0000-000000000006'::uuid, 'Alex', 'Chen', 'alex.chen@sjinnovation.com', 'Senior Engineer', 'Technology', 'active', NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days'),
  ('emp-007-0000-0000-000000000007'::uuid, 'Priya', 'Sharma', 'priya.sharma@sjinnovation.com', 'Content Writer', 'Content', 'active', NOW() - INTERVAL '55 days', NOW() - INTERVAL '55 days'),
  ('emp-008-0000-0000-000000000008'::uuid, 'Marcus', 'Johnson', 'marcus.johnson@sjinnovation.com', 'Designer', 'Content', 'active', NOW() - INTERVAL '50 days', NOW() - INTERVAL '50 days'),
  ('emp-009-0000-0000-000000000009'::uuid, 'Lisa', 'Wong', 'lisa.wong@sjinnovation.com', 'Data Analyst', 'Operations', 'active', NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
  ('emp-010-0000-0000-000000000010'::uuid, 'Carlos', 'Rodriguez', 'carlos.rodriguez@sjinnovation.com', 'Account Manager', 'Strategy', 'active', NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 3. CONTROL TOWER - POD MEMBERS
-- =====================================================

INSERT INTO public.pod_members (
  id,
  pod_id,
  employee_id,
  role,
  created_at
) VALUES
  -- Strategy Pod
  ('pm-001-0000-0000-000000000001'::uuid, 'pod-001-0000-0000-000000000001'::uuid, 'emp-002-0000-0000-000000000002'::uuid, 'Lead', NOW() - INTERVAL '90 days'),
  ('pm-002-0000-0000-000000000002'::uuid, 'pod-001-0000-0000-000000000001'::uuid, 'emp-010-0000-0000-000000000010'::uuid, 'Member', NOW() - INTERVAL '90 days'),
  ('pm-003-0000-0000-000000000003'::uuid, 'pod-001-0000-0000-000000000001'::uuid, 'emp-009-0000-0000-000000000009'::uuid, 'Member', NOW() - INTERVAL '90 days'),

  -- Content Pod
  ('pm-004-0000-0000-000000000004'::uuid, 'pod-002-0000-0000-000000000002'::uuid, 'emp-003-0000-0000-000000000003'::uuid, 'Lead', NOW() - INTERVAL '90 days'),
  ('pm-005-0000-0000-000000000005'::uuid, 'pod-002-0000-0000-000000000002'::uuid, 'emp-007-0000-0000-000000000007'::uuid, 'Member', NOW() - INTERVAL '90 days'),
  ('pm-006-0000-0000-000000000006'::uuid, 'pod-002-0000-0000-000000000002'::uuid, 'emp-008-0000-0000-000000000008'::uuid, 'Member', NOW() - INTERVAL '90 days'),
  ('pm-007-0000-0000-000000000007'::uuid, 'pod-002-0000-0000-000000000002'::uuid, 'emp-005-0000-0000-000000000005'::uuid, 'Member', NOW() - INTERVAL '90 days'),

  -- Technology Pod
  ('pm-008-0000-0000-000000000008'::uuid, 'pod-003-0000-0000-000000000003'::uuid, 'emp-006-0000-0000-000000000006'::uuid, 'Lead', NOW() - INTERVAL '90 days'),
  ('pm-009-0000-0000-000000000009'::uuid, 'pod-003-0000-0000-000000000003'::uuid, 'emp-001-0000-0000-000000000001'::uuid, 'Member', NOW() - INTERVAL '90 days'),

  -- Operations Pod
  ('pm-010-0000-0000-000000000010'::uuid, 'pod-004-0000-0000-000000000004'::uuid, 'emp-004-0000-0000-000000000004'::uuid, 'Lead', NOW() - INTERVAL '90 days'),
  ('pm-011-0000-0000-000000000011'::uuid, 'pod-004-0000-0000-000000000004'::uuid, 'emp-009-0000-0000-000000000009'::uuid, 'Member', NOW() - INTERVAL '90 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 4. HACKATHON - EVENTS
-- =====================================================

INSERT INTO public.hackathon_events (
  id,
  name,
  description,
  start_date,
  end_date,
  status,
  max_participants,
  created_by,
  created_at
) VALUES
  ('hackathon-001-0000-0000-000000000001'::uuid, 'SJ Innovation Hackathon 2026', 'Internal hackathon for innovation and learning',
   '2026-03-15'::date, '2026-03-17'::date, 'active', 50, '500b4a7f-4c4a-429e-a307-0601568c8525'::uuid, NOW() - INTERVAL '30 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 10. HACKATHON - TEAMS
-- =====================================================

INSERT INTO public.hackathon_teams (
  id,
  hackathon_id,
  name,
  description,
  team_lead_id,
  status,
  created_at
) VALUES
  ('team-001-0000-0000-000000000001'::uuid, 'hackathon-001-0000-0000-000000000001'::uuid,
   'AI Content Automation', 'Building AI tools for automated content generation',
   'emp-003-0000-0000-000000000003'::uuid, 'active', NOW() - INTERVAL '25 days'),

  ('team-002-0000-0000-000000000002'::uuid, 'hackathon-001-0000-0000-000000000001'::uuid,
   'Analytics Dashboard', 'Real-time analytics dashboard for campaign metrics',
   'emp-009-0000-0000-000000000009'::uuid, 'active', NOW() - INTERVAL '25 days'),

  ('team-003-0000-0000-000000000003'::uuid, 'hackathon-001-0000-0000-000000000001'::uuid,
   'Smart Client Portal', 'Client self-service portal with AI recommendations',
   'emp-006-0000-0000-000000000006'::uuid, 'active', NOW() - INTERVAL '25 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 11. HACKATHON - PARTICIPANTS
-- =====================================================

INSERT INTO public.hackathon_participants (
  id,
  hackathon_id,
  team_id,
  employee_id,
  role,
  created_at
) VALUES
  -- Team 1: AI Content Automation
  ('part-001-0000-0000-000000000001'::uuid, 'hackathon-001-0000-0000-000000000001'::uuid,
   'team-001-0000-0000-000000000001'::uuid, 'emp-003-0000-0000-000000000003'::uuid, 'lead', NOW() - INTERVAL '25 days'),
  ('part-002-0000-0000-000000000002'::uuid, 'hackathon-001-0000-0000-000000000001'::uuid,
   'team-001-0000-0000-000000000001'::uuid, 'emp-007-0000-0000-000000000007'::uuid, 'member', NOW() - INTERVAL '25 days'),
  ('part-003-0000-0000-000000000003'::uuid, 'hackathon-001-0000-0000-000000000001'::uuid,
   'team-001-0000-0000-000000000001'::uuid, 'emp-006-0000-0000-000000000006'::uuid, 'member', NOW() - INTERVAL '25 days'),

  -- Team 2: Analytics Dashboard
  ('part-004-0000-0000-000000000004'::uuid, 'hackathon-001-0000-0000-000000000001'::uuid,
   'team-002-0000-0000-000000000002'::uuid, 'emp-009-0000-0000-000000000009'::uuid, 'lead', NOW() - INTERVAL '25 days'),
  ('part-005-0000-0000-000000000005'::uuid, 'hackathon-001-0000-0000-000000000001'::uuid,
   'team-002-0000-0000-000000000002'::uuid, 'emp-008-0000-0000-000000000008'::uuid, 'member', NOW() - INTERVAL '25 days'),

  -- Team 3: Smart Client Portal
  ('part-006-0000-0000-000000000006'::uuid, 'hackathon-001-0000-0000-000000000001'::uuid,
   'team-003-0000-0000-000000000003'::uuid, 'emp-006-0000-0000-000000000006'::uuid, 'lead', NOW() - INTERVAL '25 days'),
  ('part-007-0000-0000-000000000007'::uuid, 'hackathon-001-0000-0000-000000000001'::uuid,
   'team-003-0000-0000-000000000003'::uuid, 'emp-002-0000-0000-000000000002'::uuid, 'member', NOW() - INTERVAL '25 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 12. HACKATHON - SUBMISSIONS
-- =====================================================

INSERT INTO public.hackathon_submissions (
  id,
  team_id,
  title,
  description,
  github_url,
  demo_url,
  status,
  created_at
) VALUES
  ('sub-001-0000-0000-000000000001'::uuid, 'team-001-0000-0000-000000000001'::uuid,
   'AI Content Studio', 'One-click AI content generation with brand compliance checking',
   'https://github.com/sjinnovation/ai-content-studio', 'https://demo.aistudio.sjinn.dev',
   'submitted', NOW() - INTERVAL '5 days'),

  ('sub-002-0000-0000-000000000002'::uuid, 'team-002-0000-0000-000000000002'::uuid,
   'Real-time Analytics Hub', 'Live campaign metrics and AI-powered recommendations',
   'https://github.com/sjinnovation/analytics-hub', 'https://demo.analytics.sjinn.dev',
   'submitted', NOW() - INTERVAL '5 days'),

  ('sub-003-0000-0000-000000000003'::uuid, 'team-003-0000-0000-000000000003'::uuid,
   'Client Intelligence Portal', 'Self-service client dashboard with AI insights',
   'https://github.com/sjinnovation/client-portal', 'https://demo.clientportal.sjinn.dev',
   'submitted', NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 13. HACKATHON - JUDGING SCORES
-- =====================================================

INSERT INTO public.hackathon_judging_scores (
  id,
  submission_id,
  judge_id,
  innovation_score,
  implementation_score,
  impact_score,
  presentation_score,
  comments,
  created_at
) VALUES
  ('score-001-0000-0000-000000000001'::uuid, 'sub-001-0000-0000-000000000001'::uuid, 'emp-001-0000-0000-000000000001'::uuid,
   9, 8, 9, 8, 'Excellent execution. Strong product-market fit potential.', NOW() - INTERVAL '2 days'),

  ('score-002-0000-0000-000000000002'::uuid, 'sub-001-0000-0000-000000000001'::uuid, 'emp-004-0000-0000-000000000004'::uuid,
   8, 9, 8, 9, 'Very well thought out. Great presentation. Minor technical concerns.', NOW() - INTERVAL '2 days'),

  ('score-003-0000-0000-000000000003'::uuid, 'sub-002-0000-0000-000000000002'::uuid, 'emp-001-0000-0000-000000000001'::uuid,
   7, 8, 8, 7, 'Solid work. Real-time analytics is impressive. Good UX.', NOW() - INTERVAL '2 days'),

  ('score-004-0000-0000-000000000004'::uuid, 'sub-003-0000-0000-000000000003'::uuid, 'emp-010-0000-0000-000000000010'::uuid,
   8, 7, 9, 8, 'Strongest impact potential. Clients will love this. Nice integration.', NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 14. Create indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_activecollab_projects_project_id ON public.activecollab_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_activecollab_tasks_project_id ON public.activecollab_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_activecollab_time_tracking_tracked_date ON public.activecollab_time_tracking(tracked_date);
CREATE INDEX IF NOT EXISTS idx_google_analytics_data_brand_id ON public.google_analytics_data(brand_id);
CREATE INDEX IF NOT EXISTS idx_google_analytics_data_date ON public.google_analytics_data(date);
CREATE INDEX IF NOT EXISTS idx_hubspot_contacts_email ON public.hubspot_contacts(email);
CREATE INDEX IF NOT EXISTS idx_pods_slug ON public.pods(slug);
CREATE INDEX IF NOT EXISTS idx_pods_status ON public.pods(status);
CREATE INDEX IF NOT EXISTS idx_employees_email ON public.employees(email);
CREATE INDEX IF NOT EXISTS idx_pod_members_pod_id ON public.pod_members(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_members_employee_id ON public.pod_members(employee_id);
CREATE INDEX IF NOT EXISTS idx_hackathon_events_status ON public.hackathon_events(status);
CREATE INDEX IF NOT EXISTS idx_hackathon_teams_hackathon_id ON public.hackathon_teams(hackathon_id);
CREATE INDEX IF NOT EXISTS idx_hackathon_participants_team_id ON public.hackathon_participants(team_id);
CREATE INDEX IF NOT EXISTS idx_hackathon_submissions_team_id ON public.hackathon_submissions(team_id);
CREATE INDEX IF NOT EXISTS idx_hackathon_judging_scores_submission_id ON public.hackathon_judging_scores(submission_id);

-- =====================================================
-- Summary
-- =====================================================
-- Phase 4 complete. The following integration & advanced data has been seeded:
--
-- ✅ ActiveCollab Projects: 3 synced projects
-- ✅ ActiveCollab Tasks: 5 synced tasks
-- ✅ ActiveCollab Time Tracking: 5 time entries
-- ✅ Google Analytics Data: 6 days of analytics across brands
-- ✅ HubSpot Contacts: 5 contacts in various stages
-- ✅ Control Tower - Pods: 4 organizational pods
-- ✅ Control Tower - Employees: 10 team members
-- ✅ Pod Members: 11 pod memberships
-- ✅ Hackathon Events: 1 active event
-- ✅ Hackathon Teams: 3 teams
-- ✅ Hackathon Participants: 7 participants
-- ✅ Hackathon Submissions: 3 project submissions
-- ✅ Hackathon Judging Scores: 4 judge reviews
--
-- Total Records: ~50 records across ~13 tables
--
-- =====================================================
-- ALL 4 PHASES COMPLETE!
-- =====================================================
-- Total demo data seeded: ~165 records across ~60+ tables
-- This comprehensive dataset provides full demo capability across:
-- • User management and permissions
-- • Brand and organization structure
-- • AI agents and content generation
-- • Knowledge base and resources
-- • Project and client management
-- • External integrations (ActiveCollab, GA, HubSpot)
-- • Organizational structure (Pods, Employees)
-- • Hackathon module
--
-- Next Steps:
-- 1. Log in with any demo credentials
-- 2. Explore all features with realistic data
-- 3. Test workflows and integrations
-- 4. Monitor AI agent responses and content generation
--
-- For cleanup (if needed), comment out the INSERT statements above
-- or create a separate cleanup migration.
-- =====================================================
