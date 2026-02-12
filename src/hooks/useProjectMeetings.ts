import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProjectMeeting {
  id: string;
  project_id: string;
  meeting_id: string;
  meeting_title: string;
  meeting_description?: string;
  meeting_type?: string;
  start_time: string;
  end_time: string;
  location?: string;
  attendees?: string[];
  organizer?: string;
  meeting_link?: string;
  meeting_data: any;
  created_at: string;
  updated_at: string;
}

/**
 * Hook for managing project meetings
 */
export const useProjectMeetings = (projectId?: string) => {
  const queryClient = useQueryClient();

  // Fetch all meetings mapped to this project
  const { data: meetings = [], isLoading, refetch } = useQuery({
    queryKey: ['project-meetings', projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from('project_meetings')
        .select('*')
        .eq('project_id', projectId)
        .order('start_time', { ascending: false });

      if (error) throw error;
      return data as ProjectMeeting[];
    },
  });

  // Map a meeting to the project
  const mapMeeting = useMutation({
    mutationFn: async (meeting: {
      meeting_id: string;
      meeting_title: string;
      meeting_description?: string;
      meeting_type?: string;
      start_time: string;
      end_time: string;
      location?: string;
      attendees?: string[];
      organizer?: string;
      meeting_link?: string;
      meeting_data: any;
    }) => {
      if (!projectId) throw new Error('Project ID is required');

      // Check if meeting is already mapped
      const { data: existing } = await supabase
        .from('project_meetings')
        .select('id')
        .eq('project_id', projectId)
        .eq('meeting_id', meeting.meeting_id)
        .maybeSingle();

      if (existing) {
        throw new Error('This meeting is already mapped to this project');
      }

      const { data, error } = await supabase
        .from('project_meetings')
        .insert({
          project_id: projectId,
          ...meeting,
        })
        .select()
        .single();

      if (error) throw error;

      // Add meeting to knowledge base
      try {
        // Use the meeting description which contains the transcript summary
        let transcript = meeting.meeting_description || '';

        const meetingText = `
Meeting: ${meeting.meeting_title}
Type: ${meeting.meeting_type || 'N/A'}
Date: ${new Date(meeting.start_time).toLocaleString()}
Location: ${meeting.location || 'N/A'}
Description: ${meeting.meeting_description || 'N/A'}
Attendees: ${meeting.attendees?.join(', ') || 'N/A'}
Organizer: ${meeting.organizer || 'N/A'}

${transcript ? `Transcript:\n${transcript}` : ''}
        `.trim();

        await supabase.functions.invoke('add-meeting-to-knowledge', {
          body: {
            projectId,
            meetingId: meeting.meeting_id,
            meetingText,
            meetingData: meeting,
          },
        });
      } catch (kbError) {
        console.error('Failed to add meeting to knowledge base:', kbError);
        // Don't throw - the meeting is still mapped even if KB addition fails
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-meetings', projectId] });
      toast.success('Meeting mapped successfully and added to knowledge base');
    },
    onError: (error: Error) => {
      toast.error(`Failed to map meeting: ${error.message}`);
    },
  });

  // Unmap a meeting from the project
  const unmapMeeting = useMutation({
    mutationFn: async (meetingId: string) => {
      const { error } = await supabase
        .from('project_meetings')
        .delete()
        .eq('id', meetingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-meetings', projectId] });
      toast.success('Meeting unmapped successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to unmap meeting: ${error.message}`);
    },
  });

  return {
    meetings,
    isLoading,
    refetch,
    mapMeeting,
    unmapMeeting,
  };
};
