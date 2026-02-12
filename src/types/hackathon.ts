// ================================================
// HACKATHON MODULE - TypeScript Types
// ================================================

export interface Employee {
  id: string;
  employee_id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string | null;
  department: string | null;
  location: string | null;
  title: string | null;
  phone: string | null;
  role: string | null;
  is_active: boolean;
  reporting_manager_id: string | null;
  reporting_manager_name: string | null;
  reporting_manager_email: string | null;
  dotted_line_manager_email: string | null;
  api_metadata: Record<string, any>;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeUserMapping {
  id: string;
  employee_id: string;
  user_id: string;
  created_at: string;
}

export type HackathonEventStatus = 'draft' | 'published' | 'active' | 'completed' | 'cancelled';

export interface HackathonEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  registration_deadline: string | null;
  max_team_size: number;
  min_team_size: number;
  status: HackathonEventStatus;
  rules: Record<string, any>;
  prizes: any[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export type ParticipantStatus = 'invited' | 'registered' | 'confirmed' | 'withdrawn';

export interface HackathonParticipant {
  id: string;
  event_id: string;
  user_id: string;
  employee_id: string;
  status: ParticipantStatus;
  invited_at: string;
  registered_at: string | null;
  onboarding_completed: boolean;
  skills: string[];
  interests: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  employee?: Employee;
  event?: HackathonEvent;
}

export type TeamStatus = 'forming' | 'confirmed' | 'disbanded';

export interface HackathonTeam {
  id: string;
  event_id: string;
  team_name: string;
  description: string | null;
  captain_id: string;
  status: TeamStatus;
  created_at: string;
  updated_at: string;
  // Joined data
  event?: HackathonEvent;
  captain?: HackathonParticipant;
  team_members?: HackathonTeamMember[];
  submission?: HackathonSubmission;
}

export interface HackathonTeamMember {
  id: string;
  team_id: string;
  participant_id: string;
  role: string | null;
  joined_at: string;
  // Joined data
  participant?: HackathonParticipant;
  team?: HackathonTeam;
}

export type SubmissionStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';

export interface HackathonSubmission {
  id: string;
  event_id: string;
  team_id: string;
  project_title: string;
  description: string;
  demo_video_url: string | null;
  github_url: string | null;
  status: SubmissionStatus;
  submitted_at: string | null;
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  team?: HackathonTeam;
  event?: HackathonEvent;
  scores?: HackathonScore[];
}

export interface HackathonJudge {
  id: string;
  event_id: string;
  user_id: string;
  judge_name: string;
  judge_title: string | null;
  expertise_domains: string[];
  assigned_at: string;
  // Joined data
  event?: HackathonEvent;
}

export type JudgeDecision = 'pass' | 'fail';

export interface HackathonScore {
  id: string;
  submission_id: string;
  judge_id: string;
  innovation_score: number | null;
  execution_score: number | null;
  usefulness_score: number | null;
  presentation_score: number | null;
  total_score: number;
  comments: string | null;
  decision: JudgeDecision | null;
  scored_at: string;
  // Joined data
  judge?: HackathonJudge;
  submission?: HackathonSubmission;
}

// ================================================
// API Response Types
// ================================================

export interface EmployeeSyncResponse {
  success: boolean;
  synced_count: number;
  total_employees: number;
  errors?: Array<{
    batch: number;
    error: string;
  }>;
  timestamp: string;
}

export interface InviteResult {
  employee_id: string;
  email: string;
  success: boolean;
  error?: string;
}

export interface HackathonInviteResponse {
  success: boolean;
  event_id: string;
  event_title: string;
  results: InviteResult[];
  summary: {
    total: number;
    sent: number;
    failed: number;
  };
  timestamp: string;
}

// ================================================
// Form Types
// ================================================

export interface CreateEventForm {
  title: string;
  description: string;
  rules: string;
  start_date: string;
  end_date: string;
  demo_day: string;
  winner_announcement_date: string;
  team_size_min: number;
  team_size_max: number;
  domains: string[];
  allow_individual_participation: boolean;
  auto_team_assignment: boolean;
}

export interface ParticipantRegistrationForm {
  preferred_domains: string[];
  preferred_role: string;
  skills: string[];
}

export interface CreateTeamForm {
  team_name: string;
  domain: string;
}

export interface SubmissionForm {
  problem_statement: string;
  solution_summary: string;
  core_features: string[];
  tech_stack: string[];
  video_demo_url: string;
  github_url: string;
  slide_url: string;
  live_demo_url: string;
}

export interface JudgeScoreForm {
  innovation_score: number;
  execution_score: number;
  usefulness_score: number;
  presentation_score: number;
  comments: string;
  decision: JudgeDecision;
}

// ================================================
// Dashboard Stats Types
// ================================================

export interface HackathonStats {
  total_events: number;
  active_events: number;
  total_participants: number;
  total_teams: number;
  total_submissions: number;
}

export interface EventStats {
  event_id: string;
  participants_count: number;
  teams_count: number;
  submissions_count: number;
  average_team_size: number;
}

export interface TeamWithMembers extends HackathonTeam {
  member_count: number;
  member_names: string[];
}

export interface SubmissionWithScores extends HackathonSubmission {
  average_score: number;
  judge_count: number;
  all_judges_scored: boolean;
}
