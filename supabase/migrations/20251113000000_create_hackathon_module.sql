-- ================================================
-- HACKATHON MODULE - Complete Database Schema
-- ================================================
-- This migration creates all tables for the Hackathon Module
-- including employee management, events, teams, submissions, and judging

-- ================================================
-- 1. EMPLOYEES TABLE
-- ================================================
-- Stores all company employees (synced from external API)
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT UNIQUE NOT NULL,
  email CITEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  department TEXT,
  office_location TEXT,
  job_title TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  api_metadata JSONB DEFAULT '{}'::jsonb,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for employees
CREATE INDEX IF NOT EXISTS idx_employees_email ON public.employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON public.employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON public.employees(is_active);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employees
CREATE POLICY "Admins can manage all employees"
ON public.employees FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('super_admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('super_admin', 'manager')
  )
);

CREATE POLICY "Authenticated users can view active employees"
ON public.employees FOR SELECT
TO authenticated
USING (is_active = true);

-- ================================================
-- 2. EMPLOYEE-USER MAPPING TABLE
-- ================================================
-- Links employees to authenticated users (after magic link login)
CREATE TABLE IF NOT EXISTS public.employee_user_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  linked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(employee_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employee_user_mapping_employee ON public.employee_user_mapping(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_user_mapping_user ON public.employee_user_mapping(user_id);

-- Enable RLS
ALTER TABLE public.employee_user_mapping ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own mapping"
ON public.employee_user_mapping FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all mappings"
ON public.employee_user_mapping FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'super_admin'
  )
);

-- ================================================
-- 3. HACKATHON EVENTS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS public.hackathon_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  rules TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  demo_day DATE,
  winner_announcement_date DATE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed', 'archived')),

  -- Configuration
  team_size_min INTEGER DEFAULT 2,
  team_size_max INTEGER DEFAULT 5,
  domains JSONB DEFAULT '[]'::jsonb,

  -- Settings
  allow_individual_participation BOOLEAN DEFAULT false,
  auto_team_assignment BOOLEAN DEFAULT false,

  -- Metadata
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hackathon_events_status ON public.hackathon_events(status);
CREATE INDEX IF NOT EXISTS idx_hackathon_events_dates ON public.hackathon_events(start_date, end_date);

-- Enable RLS
ALTER TABLE public.hackathon_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Everyone can view open hackathons"
ON public.hackathon_events FOR SELECT
TO authenticated
USING (status IN ('open', 'closed'));

CREATE POLICY "Admins can manage hackathons"
ON public.hackathon_events FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('super_admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('super_admin', 'manager')
  )
);

-- ================================================
-- 4. HACKATHON PARTICIPANTS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS public.hackathon_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.hackathon_events(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Preferences
  preferred_domains JSONB DEFAULT '[]'::jsonb,
  preferred_role TEXT,
  skills JSONB DEFAULT '[]'::jsonb,

  -- Status
  status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'team_assigned', 'withdrawn')),
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  UNIQUE(event_id, employee_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hackathon_participants_event ON public.hackathon_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_hackathon_participants_employee ON public.hackathon_participants(employee_id);
CREATE INDEX IF NOT EXISTS idx_hackathon_participants_status ON public.hackathon_participants(status);

-- Enable RLS
ALTER TABLE public.hackathon_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view participants for open events"
ON public.hackathon_participants FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.hackathon_events he
    WHERE he.id = event_id AND he.status IN ('open', 'closed')
  )
);

CREATE POLICY "Users can register themselves"
ON public.hackathon_participants FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.hackathon_events he
    WHERE he.id = event_id AND he.status = 'open'
  )
);

CREATE POLICY "Users can update their own participation"
ON public.hackathon_participants FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage participants"
ON public.hackathon_participants FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('super_admin', 'manager')
  )
);

-- ================================================
-- 5. HACKATHON TEAMS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS public.hackathon_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.hackathon_events(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  team_lead_id UUID NOT NULL REFERENCES public.users(id),

  -- Team details
  domain TEXT NOT NULL,
  status TEXT DEFAULT 'forming' CHECK (status IN ('forming', 'active', 'submitted', 'disqualified')),

  -- Results
  final_score NUMERIC,
  final_rank INTEGER,
  award TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  UNIQUE(event_id, team_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hackathon_teams_event ON public.hackathon_teams(event_id);
CREATE INDEX IF NOT EXISTS idx_hackathon_teams_lead ON public.hackathon_teams(team_lead_id);
CREATE INDEX IF NOT EXISTS idx_hackathon_teams_status ON public.hackathon_teams(status);

-- Enable RLS
ALTER TABLE public.hackathon_teams ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view teams for open events"
ON public.hackathon_teams FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.hackathon_events he
    WHERE he.id = event_id AND he.status IN ('open', 'closed')
  )
);

CREATE POLICY "Team leads can update their teams"
ON public.hackathon_teams FOR UPDATE
TO authenticated
USING (team_lead_id = auth.uid())
WITH CHECK (team_lead_id = auth.uid());

CREATE POLICY "Users can create teams for open events"
ON public.hackathon_teams FOR INSERT
TO authenticated
WITH CHECK (
  team_lead_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.hackathon_events he
    WHERE he.id = event_id AND he.status = 'open'
  )
);

CREATE POLICY "Admins can manage all teams"
ON public.hackathon_teams FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('super_admin', 'manager')
  )
);

-- ================================================
-- 6. HACKATHON TEAM MEMBERS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS public.hackathon_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.hackathon_teams(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.hackathon_participants(id) ON DELETE CASCADE,
  role TEXT,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  UNIQUE(team_id, participant_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hackathon_team_members_team ON public.hackathon_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_hackathon_team_members_participant ON public.hackathon_team_members(participant_id);

-- Enable RLS
ALTER TABLE public.hackathon_team_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view team members"
ON public.hackathon_team_members FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Team leads can manage their team members"
ON public.hackathon_team_members FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.hackathon_teams ht
    WHERE ht.id = team_id AND ht.team_lead_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hackathon_teams ht
    WHERE ht.id = team_id AND ht.team_lead_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all team members"
ON public.hackathon_team_members FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('super_admin', 'manager')
  )
);

-- ================================================
-- 7. HACKATHON SUBMISSIONS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS public.hackathon_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.hackathon_events(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.hackathon_teams(id) ON DELETE CASCADE,

  -- Submission content
  problem_statement TEXT NOT NULL,
  solution_summary TEXT NOT NULL,
  core_features JSONB DEFAULT '[]'::jsonb,
  tech_stack JSONB DEFAULT '[]'::jsonb,

  -- Links
  video_demo_url TEXT,
  github_url TEXT,
  slide_url TEXT,
  live_demo_url TEXT,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'reviewed')),
  submitted_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  UNIQUE(event_id, team_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hackathon_submissions_event ON public.hackathon_submissions(event_id);
CREATE INDEX IF NOT EXISTS idx_hackathon_submissions_team ON public.hackathon_submissions(team_id);
CREATE INDEX IF NOT EXISTS idx_hackathon_submissions_status ON public.hackathon_submissions(status);

-- Enable RLS
ALTER TABLE public.hackathon_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Team members can view their submission"
ON public.hackathon_submissions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.hackathon_teams ht
    JOIN public.hackathon_team_members htm ON htm.team_id = ht.id
    JOIN public.hackathon_participants hp ON hp.id = htm.participant_id
    WHERE ht.id = team_id AND hp.user_id = auth.uid()
  )
);

CREATE POLICY "Team leads can manage their submission"
ON public.hackathon_submissions FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.hackathon_teams ht
    WHERE ht.id = team_id AND ht.team_lead_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hackathon_teams ht
    WHERE ht.id = team_id AND ht.team_lead_id = auth.uid()
  )
);

CREATE POLICY "Judges can view all submissions"
ON public.hackathon_submissions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.hackathon_judges hj
    WHERE hj.event_id = hackathon_submissions.event_id AND hj.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all submissions"
ON public.hackathon_submissions FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('super_admin', 'manager')
  )
);

-- ================================================
-- 8. HACKATHON JUDGES TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS public.hackathon_judges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.hackathon_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  judge_name TEXT NOT NULL,
  judge_title TEXT,
  expertise_domains JSONB DEFAULT '[]'::jsonb,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  UNIQUE(event_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hackathon_judges_event ON public.hackathon_judges(event_id);
CREATE INDEX IF NOT EXISTS idx_hackathon_judges_user ON public.hackathon_judges(user_id);

-- Enable RLS
ALTER TABLE public.hackathon_judges ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Everyone can view judges"
ON public.hackathon_judges FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage judges"
ON public.hackathon_judges FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('super_admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('super_admin', 'manager')
  )
);

-- ================================================
-- 9. HACKATHON SCORES TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS public.hackathon_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.hackathon_submissions(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES public.hackathon_judges(id) ON DELETE CASCADE,

  -- Scores (1-10 scale)
  innovation_score INTEGER CHECK (innovation_score BETWEEN 1 AND 10),
  execution_score INTEGER CHECK (execution_score BETWEEN 1 AND 10),
  usefulness_score INTEGER CHECK (usefulness_score BETWEEN 1 AND 10),
  presentation_score INTEGER CHECK (presentation_score BETWEEN 1 AND 10),

  -- Calculated total
  total_score INTEGER GENERATED ALWAYS AS (
    COALESCE(innovation_score, 0) + COALESCE(execution_score, 0) +
    COALESCE(usefulness_score, 0) + COALESCE(presentation_score, 0)
  ) STORED,

  -- Feedback
  comments TEXT,
  decision TEXT CHECK (decision IN ('pass', 'fail')),

  scored_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  UNIQUE(submission_id, judge_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hackathon_scores_submission ON public.hackathon_scores(submission_id);
CREATE INDEX IF NOT EXISTS idx_hackathon_scores_judge ON public.hackathon_scores(judge_id);

-- Enable RLS
ALTER TABLE public.hackathon_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Judges can manage their own scores"
ON public.hackathon_scores FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.hackathon_judges hj
    WHERE hj.id = judge_id AND hj.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hackathon_judges hj
    WHERE hj.id = judge_id AND hj.user_id = auth.uid()
  )
);

CREATE POLICY "Team members can view scores for their submission"
ON public.hackathon_scores FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.hackathon_submissions hs
    JOIN public.hackathon_teams ht ON ht.id = hs.team_id
    JOIN public.hackathon_team_members htm ON htm.team_id = ht.id
    JOIN public.hackathon_participants hp ON hp.id = htm.participant_id
    WHERE hs.id = submission_id AND hp.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all scores"
ON public.hackathon_scores FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('super_admin', 'manager')
  )
);

-- ================================================
-- TRIGGERS FOR updated_at COLUMNS
-- ================================================
-- Assuming update_updated_at_column function exists from previous migrations

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER hackathon_events_updated_at
BEFORE UPDATE ON public.hackathon_events
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER hackathon_teams_updated_at
BEFORE UPDATE ON public.hackathon_teams
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER hackathon_submissions_updated_at
BEFORE UPDATE ON public.hackathon_submissions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- COMMENTS FOR DOCUMENTATION
-- ================================================
COMMENT ON TABLE public.employees IS 'Stores all company employees synced from external API';
COMMENT ON TABLE public.employee_user_mapping IS 'Links employees to authenticated users after magic link login';
COMMENT ON TABLE public.hackathon_events IS 'Hackathon events with configuration and timeline';
COMMENT ON TABLE public.hackathon_participants IS 'Tracks employee registration for hackathon events';
COMMENT ON TABLE public.hackathon_teams IS 'Teams formed for hackathon events';
COMMENT ON TABLE public.hackathon_team_members IS 'Members of hackathon teams';
COMMENT ON TABLE public.hackathon_submissions IS 'Project submissions from teams';
COMMENT ON TABLE public.hackathon_judges IS 'Judges assigned to hackathon events';
COMMENT ON TABLE public.hackathon_scores IS 'Judging scores for submissions';
