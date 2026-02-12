import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TeamDailySummary {
  id: string;
  user_id: string;
  summary_date: string;
  ai_summary: {
    overall_summary?: string;
    key_accomplishments?: string[];
    concerns?: string[];
    recommendations?: string[];
    hours_analysis?: string;
  };
  tasks_completed: number;
  hours_logged: number;
  productivity_score: number | null;
  key_accomplishments: string[];
  concerns: string[];
  eod_submission_id: string | null;
  created_at: string;
  users?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    title: string | null;
    department: string | null;
  };
}

export interface EODSubmission {
  id: string;
  user_id: string;
  submission_date: string;
  task_links: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useTeamSummaries(date?: Date) {
  const dateStr = date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  
  return useQuery({
    queryKey: ['team-summaries', dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_daily_summaries')
        .select(`
          *,
          users (
            id,
            email,
            first_name,
            last_name,
            title,
            department
          )
        `)
        .eq('summary_date', dateStr)
        .order('productivity_score', { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data as TeamDailySummary[];
    },
  });
}

export function useUserSummary(userId: string, date?: Date) {
  const dateStr = date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  
  return useQuery({
    queryKey: ['user-summary', userId, dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_daily_summaries')
        .select(`
          *,
          users (
            id,
            email,
            first_name,
            last_name,
            title,
            department
          )
        `)
        .eq('user_id', userId)
        .eq('summary_date', dateStr)
        .maybeSingle();

      if (error) throw error;
      return data as TeamDailySummary | null;
    },
  });
}

export function useEODSubmissions(userId?: string, date?: Date) {
  const dateStr = date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  
  return useQuery({
    queryKey: ['eod-submissions', userId, dateStr],
    queryFn: async () => {
      let query = supabase
        .from('team_eod_submissions')
        .select('*')
        .eq('submission_date', dateStr);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EODSubmission[];
    },
  });
}

export function useSubmitEOD() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (submission: {
      submission_date: string;
      task_links: string[];
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('team_eod_submissions')
        .upsert({
          user_id: user.id,
          ...submission,
        }, {
          onConflict: 'user_id,submission_date'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eod-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['team-summaries'] });
    },
  });
}

export function useEODSubmissionStatus(date?: Date) {
  const dateStr = date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  
  return useQuery({
    queryKey: ['eod-submission-status', dateStr],
    queryFn: async () => {
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('id, email, first_name, last_name')
        .eq('status', 'active');

      if (usersError) throw usersError;

      const { data: submissions, error: submissionsError } = await supabase
        .from('team_eod_submissions')
        .select('user_id')
        .eq('submission_date', dateStr);

      if (submissionsError) throw submissionsError;

      const submittedUserIds = new Set(submissions.map(s => s.user_id));

      return {
        total: allUsers.length,
        submitted: submissions.length,
        pending: allUsers.length - submissions.length,
        users: allUsers.map(user => ({
          ...user,
          hasSubmitted: submittedUserIds.has(user.id),
        })),
      };
    },
  });
}
