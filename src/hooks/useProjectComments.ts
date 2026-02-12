import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ProjectTaskComment } from './useProjectTaskComments';

export interface ProjectCommentWithTask extends ProjectTaskComment {
  task_title: string;
  task_status: string;
  task_priority: string;
}

export const useProjectComments = (projectId?: string) => {
  return useQuery<ProjectCommentWithTask[]>({
    queryKey: ['project-all-comments', projectId],
    queryFn: async () => {
      if (!projectId) {
        return [];
      }

      // First, get all tasks for this project
      const { data: tasks, error: tasksError } = await supabase
        .from('project_tasks')
        .select('id, title, status, priority')
        .eq('project_id', projectId);

      if (tasksError) {
        console.error('[useProjectComments] Error fetching tasks:', tasksError);
        throw tasksError;
      }

      if (!tasks || tasks.length === 0) {
        return [];
      }

      const taskIds = tasks.map(t => t.id);

      // Fetch all comments for these tasks (no limit to get ALL comments)
      const { data: comments, error: commentsError } = await (supabase as any)
        .from('project_task_comments')
        .select('*')
        .in('task_id', taskIds)
        .order('created_at', { ascending: false });

      if (commentsError) {
        console.error('[useProjectComments] Error fetching comments:', commentsError);
        throw commentsError;
      }

      console.log(`[useProjectComments] Fetched ${comments?.length || 0} total comments for ${tasks.length} tasks`);
      console.log('[useProjectComments] Comment distribution by task:', 
        comments?.reduce((acc: any, c: any) => {
          acc[c.task_id] = (acc[c.task_id] || 0) + 1;
          return acc;
        }, {})
      );
      
      // Log sample of comment data structure
      if (comments && comments.length > 0) {
        console.log('[useProjectComments] Sample comment data:', {
          total_comments: comments.length,
          sample_comment: {
            id: comments[0].id,
            task_id: comments[0].task_id,
            activecollab_comment_id: comments[0].activecollab_comment_id,
            comment_body_length: comments[0].comment_body?.length || 0,
            created_by: comments[0].created_by_name,
            created_at: comments[0].created_at,
          }
        });
      }

      // Map comments to include task information
      const commentsWithTasks: ProjectCommentWithTask[] = (comments || []).map((comment: ProjectTaskComment) => {
        const task = tasks.find(t => t.id === comment.task_id);
        return {
          ...comment,
          task_title: task?.title || 'Unknown Task',
          task_status: task?.status || 'unknown',
          task_priority: task?.priority || 'normal',
        };
      });

      return commentsWithTasks;
    },
    enabled: !!projectId,
  });
};
