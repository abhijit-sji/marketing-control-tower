import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProjectTaskComment {
  id: string;
  task_id: string;
  activecollab_comment_id: string;
  comment_body: string | null;
  created_by_name: string | null;
  created_by_email: string | null;
  created_at: string;
  synced_at: string;
}

export const useProjectTaskComments = (taskId?: string) => {
  return useQuery<ProjectTaskComment[]>({
    queryKey: ['project-task-comments', taskId],
    queryFn: async () => {
      if (!taskId) {
        return [];
      }

      const { data, error } = await (supabase as any)
        .from('project_task_comments')
        .select('*')
        .eq('task_id', taskId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useProjectTaskComments] Error:', error);
        throw error;
      }
      
      console.log(`[useProjectTaskComments] Fetched ${data?.length || 0} comments for task ${taskId}`);
      console.log('[useProjectTaskComments] Raw comment data:', JSON.stringify(data, null, 2));
      
      // Log comment structure for debugging
      if (data && data.length > 0) {
        console.log('[useProjectTaskComments] First comment structure:', {
          id: data[0].id,
          task_id: data[0].task_id,
          activecollab_comment_id: data[0].activecollab_comment_id,
          comment_body_length: data[0].comment_body?.length || 0,
          comment_body_preview: data[0].comment_body?.substring(0, 200),
          created_by_name: data[0].created_by_name,
          created_at: data[0].created_at,
          synced_at: data[0].synced_at,
        });
      }
      
      return (data || []) as ProjectTaskComment[];
    },
    enabled: !!taskId,
  });
};
