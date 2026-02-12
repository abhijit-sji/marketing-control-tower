-- Create hackathon_events table
CREATE TABLE IF NOT EXISTS public.hackathon_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  registration_deadline TIMESTAMPTZ,
  max_team_size INTEGER DEFAULT 5,
  min_team_size INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'active', 'completed', 'cancelled')),
  rules JSONB DEFAULT '{}',
  prizes JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create hackathon_participants table
CREATE TABLE IF NOT EXISTS public.hackathon_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.hackathon_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'registered', 'confirmed', 'withdrawn')),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  registered_at TIMESTAMPTZ,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  skills JSONB DEFAULT '[]',
  interests TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Create employee_user_mapping table
CREATE TABLE IF NOT EXISTS public.employee_user_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id),
  UNIQUE(user_id)
);

-- Create hackathon_teams table
CREATE TABLE IF NOT EXISTS public.hackathon_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.hackathon_events(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  description TEXT,
  captain_id UUID NOT NULL REFERENCES public.hackathon_participants(id),
  status TEXT NOT NULL DEFAULT 'forming' CHECK (status IN ('forming', 'confirmed', 'disbanded')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, team_name)
);

-- Create hackathon_team_members table
CREATE TABLE IF NOT EXISTS public.hackathon_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.hackathon_teams(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.hackathon_participants(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('captain', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, participant_id)
);

-- Create hackathon_submissions table
CREATE TABLE IF NOT EXISTS public.hackathon_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.hackathon_events(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.hackathon_teams(id) ON DELETE CASCADE,
  project_title TEXT NOT NULL,
  description TEXT NOT NULL,
  demo_video_url TEXT,
  github_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES public.hackathon_participants(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, team_id)
);

-- Create hackathon_judges table
CREATE TABLE IF NOT EXISTS public.hackathon_judges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.hackathon_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision TEXT CHECK (decision IN ('accept', 'decline', 'pending')),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Create hackathon_scores table
CREATE TABLE IF NOT EXISTS public.hackathon_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.hackathon_submissions(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES public.hackathon_judges(id) ON DELETE CASCADE,
  criteria JSONB NOT NULL DEFAULT '{}',
  total_score NUMERIC(5,2),
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(submission_id, judge_id)
);

-- Enable RLS
ALTER TABLE public.hackathon_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hackathon_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_user_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hackathon_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hackathon_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hackathon_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hackathon_judges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hackathon_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies for hackathon_events
CREATE POLICY "Anyone can view published events" ON public.hackathon_events
  FOR SELECT USING (status IN ('published', 'active', 'completed'));

CREATE POLICY "Admins can manage events" ON public.hackathon_events
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

-- RLS Policies for hackathon_participants
CREATE POLICY "Users can view their own participation" ON public.hackathon_participants
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own participation" ON public.hackathon_participants
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage participants" ON public.hackathon_participants
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

-- RLS Policies for employee_user_mapping
CREATE POLICY "Users can view their own mapping" ON public.employee_user_mapping
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage mappings" ON public.employee_user_mapping
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

-- RLS Policies for hackathon_teams
CREATE POLICY "Participants can view teams in their events" ON public.hackathon_teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.hackathon_participants hp
      WHERE hp.event_id = hackathon_teams.event_id
      AND hp.user_id = auth.uid()
    )
  );

CREATE POLICY "Team captains can update their teams" ON public.hackathon_teams
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.hackathon_participants hp
      WHERE hp.id = hackathon_teams.captain_id
      AND hp.user_id = auth.uid()
    )
  );

CREATE POLICY "Participants can create teams" ON public.hackathon_teams
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hackathon_participants hp
      WHERE hp.id = hackathon_teams.captain_id
      AND hp.user_id = auth.uid()
    )
  );

-- RLS Policies for hackathon_team_members
CREATE POLICY "Team members can view their team" ON public.hackathon_team_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.hackathon_participants hp
      WHERE hp.id = hackathon_team_members.participant_id
      AND hp.user_id = auth.uid()
    )
  );

CREATE POLICY "Team captains can manage members" ON public.hackathon_team_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.hackathon_teams ht
      JOIN public.hackathon_participants hp ON hp.id = ht.captain_id
      WHERE ht.id = hackathon_team_members.team_id
      AND hp.user_id = auth.uid()
    )
  );

-- RLS Policies for hackathon_submissions
CREATE POLICY "Team members can view their submissions" ON public.hackathon_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.hackathon_team_members htm
      JOIN public.hackathon_participants hp ON hp.id = htm.participant_id
      WHERE htm.team_id = hackathon_submissions.team_id
      AND hp.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can create submissions" ON public.hackathon_submissions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hackathon_team_members htm
      JOIN public.hackathon_participants hp ON hp.id = htm.participant_id
      WHERE htm.team_id = hackathon_submissions.team_id
      AND hp.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can update their submissions" ON public.hackathon_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.hackathon_team_members htm
      JOIN public.hackathon_participants hp ON hp.id = htm.participant_id
      WHERE htm.team_id = hackathon_submissions.team_id
      AND hp.user_id = auth.uid()
    )
  );

CREATE POLICY "Judges can view submissions" ON public.hackathon_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.hackathon_judges hj
      WHERE hj.event_id = hackathon_submissions.event_id
      AND hj.user_id = auth.uid()
    )
  );

-- RLS Policies for hackathon_judges
CREATE POLICY "Judges can view their assignments" ON public.hackathon_judges
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Judges can update their responses" ON public.hackathon_judges
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage judges" ON public.hackathon_judges
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

-- RLS Policies for hackathon_scores
CREATE POLICY "Judges can manage their scores" ON public.hackathon_scores
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.hackathon_judges hj
      WHERE hj.id = hackathon_scores.judge_id
      AND hj.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can view scores for their submissions" ON public.hackathon_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.hackathon_submissions hs
      JOIN public.hackathon_team_members htm ON htm.team_id = hs.team_id
      JOIN public.hackathon_participants hp ON hp.id = htm.participant_id
      WHERE hs.id = hackathon_scores.submission_id
      AND hp.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_hackathon_participants_event_user ON public.hackathon_participants(event_id, user_id);
CREATE INDEX idx_hackathon_participants_employee ON public.hackathon_participants(employee_id);
CREATE INDEX idx_hackathon_teams_event ON public.hackathon_teams(event_id);
CREATE INDEX idx_hackathon_team_members_team ON public.hackathon_team_members(team_id);
CREATE INDEX idx_hackathon_submissions_event ON public.hackathon_submissions(event_id);
CREATE INDEX idx_hackathon_submissions_team ON public.hackathon_submissions(team_id);
CREATE INDEX idx_employee_user_mapping_employee ON public.employee_user_mapping(employee_id);
CREATE INDEX idx_employee_user_mapping_user ON public.employee_user_mapping(user_id);