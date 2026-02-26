import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase as _supabase } from '@/integrations/supabase/client';
const supabase = _supabase as any;
import { useToast } from '@/hooks/use-toast';

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
}

export const useTaskComments = (taskId?: string) => {
  return useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: async () => {
      if (!taskId) return [];

      // First get comments
      const { data: comments, error: commentsError } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (commentsError) {
        console.error('[useTaskComments] Error fetching comments:', commentsError);
        throw commentsError;
      }

      if (!comments || comments.length === 0) return [];

      // Get unique user IDs
      const userIds = [...new Set(comments.map(c => c.user_id))];

      // Fetch users
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .in('id', userIds);

      if (usersError) {
        console.error('[useTaskComments] Error fetching users:', usersError);
      }

      // Map users to comments
      const usersMap = new Map(users?.map(u => [u.id, u]) || []);
      
      return comments.map(comment => ({
        ...comment,
        user: usersMap.get(comment.user_id) || undefined,
      })) as TaskComment[];
    },
    enabled: !!taskId,
  });
};

export const useCreateTaskComment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ taskId, content }: { taskId: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          user_id: user.id,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', variables.taskId] });
      toast({ title: 'Comment added' });
    },
    onError: (error) => {
      console.error('[useCreateTaskComment] Error:', error);
      toast({ title: 'Failed to add comment', variant: 'destructive' });
    },
  });
};

export const useUpdateTaskComment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ commentId, content, taskId }: { commentId: string; content: string; taskId: string }) => {
      const { data, error } = await supabase
        .from('task_comments')
        .update({ content })
        .eq('id', commentId)
        .select()
        .single();

      if (error) throw error;
      return { ...data, taskId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', data.taskId] });
      toast({ title: 'Comment updated' });
    },
    onError: (error) => {
      console.error('[useUpdateTaskComment] Error:', error);
      toast({ title: 'Failed to update comment', variant: 'destructive' });
    },
  });
};

export const useDeleteTaskComment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ commentId, taskId }: { commentId: string; taskId: string }) => {
      const { error } = await supabase
        .from('task_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      return { taskId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', data.taskId] });
      toast({ title: 'Comment deleted' });
    },
    onError: (error) => {
      console.error('[useDeleteTaskComment] Error:', error);
      toast({ title: 'Failed to delete comment', variant: 'destructive' });
    },
  });
};
