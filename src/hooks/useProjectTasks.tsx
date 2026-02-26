import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

// Task categories
export const TASK_CATEGORIES = [
  'general',
  'clients',
  'development',
  'design',
  'marketing',
  'content',
  'seo',
  'analytics',
  'support',
  'other'
] as const;

export type TaskCategory = typeof TASK_CATEGORIES[number];

export interface ProjectTask {
  id: string;
  project_id?: string;
  client_id?: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: TaskCategory;
  brand_id?: string;
  assigned_to?: string;
  created_by?: string;
  estimated_hours?: number;
  actual_hours?: number;
  due_date?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  activecollab_task_id?: string;
  activecollab_created_on?: string;
  activecollab_updated_on?: string;
  // Joined data
  brand?: {
    id: string;
    name: string;
    slug: string;
  };
  client?: {
    id: string;
    name: string;
    company?: string;
  };
  creator?: {
    id: string;
    email: string;
    full_name?: string;
  };
}

export interface CreateProjectTaskData {
  project_id?: string;
  client_id?: string;
  title: string;
  description?: string;
  status?: 'todo' | 'in_progress' | 'review' | 'completed' | 'blocked';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: TaskCategory;
  brand_id?: string;
  assigned_to?: string;
  created_by?: string;
  estimated_hours?: number;
  due_date?: string;
}

export interface UpdateProjectTaskData {
  title?: string;
  description?: string;
  status?: 'todo' | 'in_progress' | 'review' | 'completed' | 'blocked';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: TaskCategory;
  brand_id?: string | null;
  client_id?: string | null;
  assigned_to?: string;
  estimated_hours?: number;
  actual_hours?: number;
  due_date?: string;
  completed_at?: string | null;
}

export const useProjectTasks = (projectId?: string) => {
  return useQuery({
    queryKey: ['project-tasks', projectId],
    queryFn: async () => {
      let query = supabase
        .from('project_tasks')
        .select(`
          *,
          brand:brand_id(id, name, slug),
          client:client_id(id, name, company)
        `)
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching project tasks:', error);
        throw error;
      }

      return (data || []) as unknown as ProjectTask[];
    },
    retry: 2,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

export const useAllProjectTasks = () => {
  return useQuery({
    queryKey: ['all-project-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_tasks')
        .select(`
          *,
          brand:brand_id(id, name, slug),
          client:client_id(id, name, company)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching all project tasks:', error);
        throw error;
      }

      return (data || []) as unknown as ProjectTask[];
    },
    retry: 2,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

// Fetch tasks by brand ID
export const useBrandTasks = (brandId?: string) => {
  return useQuery({
    queryKey: ['brand-tasks', brandId],
    queryFn: async () => {
      if (!brandId) return [];

      const { data, error } = await (supabase as any)
        .from('project_tasks')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching brand tasks:', error);
        throw error;
      }

      return (data || []) as unknown as ProjectTask[];
    },
    enabled: !!brandId,
    retry: 2,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
};

export const useCreateProjectTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskData: CreateProjectTaskData) => {
      const { data, error } = await supabase
        .from('project_tasks')
        .insert([taskData])
        .select()
        .single();

      if (error) {
        console.error('Error creating project task:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      // Invalidate all task-related queries to ensure UI updates immediately
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-project-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['brand-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project-task'] }); // Invalidate task detail queries
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] }); // Invalidate my tasks
      queryClient.invalidateQueries({ queryKey: ['my-tasks-stats'] }); // Invalidate task stats
      toast({
        title: "Task created",
        description: "Project task has been created successfully.",
      });
    },
    onError: (error) => {
      console.error('Create project task error:', error);
      toast({
        title: "Error",
        description: "Failed to create project task. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateProjectTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateProjectTaskData }) => {
      const updateData = { ...updates };

      // Set completed_at when status changes to completed
      if (updates.status === 'completed' && !updateData.completed_at) {
        updateData.completed_at = new Date().toISOString();
      } else if (updates.status !== 'completed') {
        updateData.completed_at = null;
      }

      // Use RPC function to bypass WITH CHECK RLS limitation
      // The RPC function performs its own permission checks against the OLD row
      const { data, error } = await (supabase as any)
        .rpc('update_project_task', {
          p_task_id: id,
          p_updates: updateData,
        });

      if (error) {
        console.error('Error updating project task:', error);
        throw error;
      }

      return data;
    },
    onMutate: async ({ id, updates }) => {
      // Optimistic update: immediately reflect changes in the UI
      // This is especially important for assignee changes where the user
      // might temporarily lose SELECT access before past_assignees is checked
      await queryClient.cancelQueries({ queryKey: ['project-task', id] });

      const previousTask = queryClient.getQueryData(['project-task', id]);

      if (previousTask) {
        queryClient.setQueryData(['project-task', id], (old: any) => ({
          ...old,
          ...updates,
        }));
      }

      return { previousTask, id };
    },
    onSuccess: () => {
      // Invalidate all task-related queries to ensure UI updates immediately
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-project-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['brand-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project-task'] }); // Invalidate task detail queries
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] }); // Invalidate my tasks
      queryClient.invalidateQueries({ queryKey: ['my-tasks-stats'] }); // Invalidate task stats
      toast({
        title: "Task updated",
        description: "Project task has been updated successfully.",
      });
    },
    onError: (error, _variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousTask) {
        queryClient.setQueryData(['project-task', context.id], context.previousTask);
      }
      console.error('Update project task error:', error);
      toast({
        title: "Error",
        description: "Failed to update project task. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteProjectTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_tasks')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting project task:', error);
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate all task-related queries to ensure UI updates immediately
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-project-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['brand-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project-task'] }); // Invalidate task detail queries
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] }); // Invalidate my tasks
      queryClient.invalidateQueries({ queryKey: ['my-tasks-stats'] }); // Invalidate task stats
      toast({
        title: "Task deleted",
        description: "Project task has been deleted successfully.",
      });
    },
    onError: (error) => {
      console.error('Delete project task error:', error);
      toast({
        title: "Error",
        description: "Failed to delete project task. Please try again.",
        variant: "destructive",
      });
    },
  });
};